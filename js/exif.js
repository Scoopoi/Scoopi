// Læser optagetidspunkt og GPS-position fra et billedes EXIF-data (JPEG).
// NB: Android fjerner ofte positionen, når et billede vælges i browseren (beskyttelse af privatliv).

export async function lasExif(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return fraTekst(buf); // ikke JPEG: prøv simpel søgning
    let p = 2;
    while (p + 4 < v.byteLength) {
      const marker = v.getUint16(p), len = v.getUint16(p + 2);
      if (marker === 0xffe1 && v.getUint32(p + 4) === 0x45786966) return tiff(v, p + 10) || fraTekst(buf); // "Exif"
      if ((marker & 0xff00) !== 0xff00) break;
      p += 2 + len;
    }
    return fraTekst(buf);
  } catch { return null; }
}

function tiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (o) => v.getUint16(t + o, le), u32 = (o) => v.getUint32(t + o, le);
  const ifd = (o) => {
    const ud = {};
    const n = u16(o);
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      ud[u16(e)] = { type: u16(e + 2), count: u32(e + 4), vo: e + 8 };
    }
    return ud;
  };
  const str = (en) => { const off = en.count > 4 ? u32(en.vo) : en.vo; let s = ''; for (let i = 0; i < en.count - 1; i++) s += String.fromCharCode(v.getUint8(t + off + i)); return s; };
  const rats = (en) => { const off = u32(en.vo); return Array.from({ length: en.count }, (_, i) => u32(off + i * 8) / (u32(off + i * 8 + 4) || 1)); };
  const ascii1 = (en) => String.fromCharCode(v.getUint8(t + en.vo));
  const ifd0 = ifd(u32(4));
  let dt = null, lat = null, lon = null;
  if (ifd0[0x8769]) { const ex = ifd(u32(ifd0[0x8769].vo)); if (ex[0x9003]) dt = str(ex[0x9003]); else if (ex[0x9004]) dt = str(ex[0x9004]); }
  if (!dt && ifd0[0x0132]) dt = str(ifd0[0x0132]);
  if (ifd0[0x8825]) {
    const g = ifd(u32(ifd0[0x8825].vo));
    if (g[2] && g[4]) {
      const dms = (a) => a[0] + a[1] / 60 + a[2] / 3600;
      lat = dms(rats(g[2])) * (g[1] && ascii1(g[1]) === 'S' ? -1 : 1);
      lon = dms(rats(g[4])) * (g[3] && ascii1(g[3]) === 'W' ? -1 : 1);
      if (!lat && !lon) lat = lon = null;
    }
  }
  return lav(dt, lat, lon);
}

function fraTekst(buf) {
  const txt = new TextDecoder('latin1').decode(buf);
  const alle = [...txt.matchAll(/((?:19|20)\d\d):([01]\d):([0-3]\d) ([0-2]\d):([0-5]\d):[0-5]\d/g)].map((m) => m[0]).sort();
  return lav(alle[0] || null, null, null);
}

function lav(dt, lat, lon) {
  let date = null, time = null;
  const m = dt && dt.match(/^((?:19|20)\d\d):(\d\d):(\d\d) (\d\d):(\d\d)/);
  if (m) { date = `${m[1]}-${m[2]}-${m[3]}`; time = `${m[4]}:${m[5]}`; }
  if (date && date > new Date().toISOString().slice(0, 10)) date = time = null;
  if (!date && lat == null) return null;
  return { date, time, lat: lat == null ? null : +lat.toFixed(5), lon: lon == null ? null : +lon.toFixed(5) };
}
