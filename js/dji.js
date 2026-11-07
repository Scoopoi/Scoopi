// Læser data fra DJI-droner: .SRT-filer (video) og XMP i JPEG-billeder.
// Mini 3 Pro skriver fx:  [latitude: 55.676098] [longitude: 12.568337] [rel_alt: 30.200 abs_alt: 45.123]
// Ældre modeller: [latitude : 55.67] [longtitude : 12.56] [altitude: 45]  eller  GPS(12.56,55.67,19) BAROMETER:30.2

// Vandret synsvinkel (grader) ved 1x zoom. Diagonal FOV omregnet til bredden af en 4:3-sensor.
export const DRONER = [
  { id: 'mini3pro', navn: 'DJI Mini 3 Pro / Mini 4 Pro / Mini 3 / Air 3 (24 mm)', hfov: 69.7 },
  { id: 'mavic3', navn: 'DJI Mavic 3 / Air 2S (84°)', hfov: 71.5 },
  { id: 'mini2', navn: 'DJI Mini 2 / Mini SE (83°)', hfov: 70.6 },
];

const tid = (s) => { const [h, m, rest] = s.split(':'); const [sek, ms] = rest.split(/[,.]/); return +h * 3600 + +m * 60 + +sek + +ms / 1000; };
const tal = (re, txt) => { const m = txt.match(re); return m ? parseFloat(m[1]) : null; };

export function parseSRT(text) {
  const blokke = text.replace(/\r/g, '').split(/\n\s*\n/);
  const ud = [];
  for (const b of blokke) {
    const t = b.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/);
    if (!t) continue;
    let lat = tal(/latitude\s*:\s*(-?[\d.]+)/i, b);
    let lon = tal(/longt?itude\s*:\s*(-?[\d.]+)/i, b);
    let alt = tal(/rel_alt\s*:\s*(-?[\d.]+)/i, b);
    const gps = b.match(/GPS\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/i);
    if (lat == null && gps) { lon = +gps[1]; lat = +gps[2]; }
    if (alt == null) alt = tal(/BAROMETER\s*:\s*(-?[\d.]+)/i, b) ?? tal(/H\s*(-?[\d.]+)\s*m/, b);
    const yaw = tal(/gb_yaw\s*:\s*(-?[\d.]+)/i, b) ?? tal(/\byaw\s*:\s*(-?[\d.]+)/i, b);
    const pitch = tal(/gb_pitch\s*:\s*(-?[\d.]+)/i, b);
    const zoom = tal(/dzoom_ratio\s*:\s*([\d.]+)/i, b) ?? tal(/dzoom\s*:\s*([\d.]+)/i, b);
    ud.push({ t0: tid(t[1]), t1: tid(t[2]), lat, lon, alt, yaw, pitch, zoom });
  }
  return ud.filter((e) => e.lat != null && e.lon != null && !(e.lat === 0 && e.lon === 0));
}

export function vedTid(entries, sek) {
  if (!entries?.length) return null;
  let lo = 0, hi = entries.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (entries[mid].t0 <= sek) lo = mid; else hi = mid - 1; }
  const e = entries[lo];
  // Retning fra flyveretningen, hvis SRT ikke har yaw: sammenlign position 1 sek før og efter.
  let retning = e.yaw, kilde = e.yaw != null ? 'SRT' : null;
  if (retning == null) {
    const a = entries.find((x) => x.t0 >= sek - 1) || e;
    const b = [...entries].reverse().find((x) => x.t0 <= sek + 1) || e;
    if (afstand(a, b) > 2) { retning = kurs(a, b); kilde = 'flyveretning'; }
  }
  return { ...e, retning: retning == null ? null : (retning + 360) % 360, retningKilde: kilde };
}

// DJI-billeder har XMP med fx drone-dji:RelativeAltitude="+30.20" og drone-dji:FlightYawDegree="+12.30"
export async function lasBilledeData(file) {
  const buf = await file.slice(0, 256 * 1024).arrayBuffer();
  const txt = new TextDecoder('latin1').decode(buf);
  const x = (n) => tal(new RegExp(`drone-dji:${n}\\s*=\\s*"([+-]?[\\d.]+)"`, 'i'), txt) ?? tal(new RegExp(`<drone-dji:${n}>([+-]?[\\d.]+)<`, 'i'), txt);
  const lat = x('GpsLatitude'), lon = x('GpsLongitude') ?? x('GpsLongtitude');
  if (lat == null || lon == null) return null;
  const yaw = x('GimbalYawDegree') ?? x('FlightYawDegree');
  return { lat, lon, alt: x('RelativeAltitude'), pitch: x('GimbalPitchDegree'), retning: yaw == null ? null : (yaw + 360) % 360, retningKilde: yaw == null ? null : 'billede' };
}

// Meter pr. pixel ved lodret kamera: billedbredden på jorden = 2 · h · tan(HFOV/2)
export const meterPrPixel = (alt, hfov, bredde) => (2 * alt * Math.tan((hfov * Math.PI) / 360)) / bredde;

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
export function afstand(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function kurs(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
// Pixel i billedet -> lat/lon. Billedets top peger i retning `retning` (grader fra nord, med uret).
export function pixelTilGps(px, py, w, h, geo) {
  const dx = (px - w / 2) * geo.mPrPx, dy = (py - h / 2) * geo.mPrPx;
  const th = rad(geo.retning || 0);
  const øst = dx * Math.cos(th) + -dy * Math.sin(th);
  const nord = -dx * Math.sin(th) + -dy * Math.cos(th);
  return { lat: geo.lat + nord / 111320, lon: geo.lon + øst / (111320 * Math.cos(rad(geo.lat))) };
}
