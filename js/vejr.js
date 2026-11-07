// Vejr fra Open-Meteo (gratis, ingen nøgle).
// De seneste ca. 3 måneder: api.open-meteo.com/v1/forecast. Ældre: archive-api.open-meteo.com/v1/archive
// (arkivet er nogle dage forsinket, derfor bruges forecast til nye datoer).
import * as db from './db.js';

const HOURLY = 'temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation';
const RETNINGER = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];

export const retning = (deg) => deg == null ? null : RETNINGER[Math.round(deg / 45) % 8];

function addDays(date, n) {
  const d = new Date(date + 'T12:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function hentVejr(trip) {
  const daysAgo = (Date.now() - new Date(trip.date + 'T12:00').getTime()) / 864e5;
  if (daysAgo < -15) return null; // for langt ude i fremtiden
  const host = daysAgo > 80 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const q = new URLSearchParams({
    latitude: trip.lat.toFixed(4),
    longitude: trip.lon.toFixed(4),
    hourly: HOURLY,
    daily: 'sunrise,sunset',
    wind_speed_unit: 'ms',
    timezone: 'Europe/Copenhagen',
    start_date: addDays(trip.date, -1), // dagen før, så trykændringen kan regnes ud
    end_date: trip.date,
  });
  const res = await fetch(`${host}?${q}`);
  if (!res.ok) throw new Error('Open-Meteo svarede ' + res.status);
  const j = await res.json();
  const h = j.hourly;
  const i = h.time.indexOf(`${trip.date}T${trip.start.slice(0, 2)}:00`);
  if (i < 0) return null;
  const v = (k, idx = i) => (idx >= 0 && h[k][idx] != null ? h[k][idx] : null);
  const diff = (n) => v('pressure_msl') != null && v('pressure_msl', i - n) != null ? +(v('pressure_msl') - v('pressure_msl', i - n)).toFixed(1) : null;
  const di = j.daily?.time?.indexOf(trip.date) ?? -1;
  return {
    tempC: v('temperature_2m'),
    trykHpa: v('pressure_msl'),
    trykAendring3t: diff(3),
    trykAendring12t: diff(12),
    trykAendring24t: diff(24),
    vindMs: v('wind_speed_10m'),
    vindRetningGrader: v('wind_direction_10m'),
    skydaekkePct: v('cloud_cover'),
    nedboerMm: v('precipitation'),
    solop: di >= 0 ? j.daily.sunrise[di]?.slice(11) : null,
    solned: di >= 0 ? j.daily.sunset[di]?.slice(11) : null,
    maane: maanefase(trip.date),
    kilde: 'Open-Meteo',
    hentet: new Date().toISOString(),
  };
}

// Månefase 0–1 (0 = nymåne, 0,5 = fuldmåne). Simpel beregning, præcis nok til fiskeri.
export function maanefase(date) {
  const ref = Date.UTC(2000, 0, 6, 18, 14); // kendt nymåne
  const dage = (new Date(date + 'T12:00Z').getTime() - ref) / 864e5;
  const p = (dage / 29.530588853) % 1;
  return +((p + 1) % 1).toFixed(3);
}
export function maaneNavn(p) {
  if (p == null) return '';
  if (p < 0.03 || p > 0.97) return 'Nymåne';
  if (p < 0.22) return 'Tiltagende segl';
  if (p < 0.28) return 'Første kvarter';
  if (p < 0.47) return 'Tiltagende';
  if (p < 0.53) return 'Fuldmåne';
  if (p < 0.72) return 'Aftagende';
  if (p < 0.78) return 'Sidste kvarter';
  return 'Aftagende segl';
}

// Henter vejr til ture, der mangler det (fx gemt offline). Returnerer antal opdaterede.
let kører = false;
export async function hentManglende() {
  if (kører || !navigator.onLine) return 0;
  kører = true;
  let n = 0;
  try {
    const trips = await db.getAll('trips');
    for (const t of trips) {
      if (t.weather || t.lat == null || !t.start) continue;
      try {
        const w = await hentVejr(t);
        if (w) { await db.put('trips', { ...(await db.get('trips', t.id)), weather: w }); n++; }
      } catch { /* prøv igen senere */ }
    }
  } finally { kører = false; }
  return n;
}
