// Kort-fanen: alle fangster med plads og huggested på luftfoto.
import * as db from './db.js';
import { esc, fmt, fangstDato } from './util.js';
import { hentLeaflet } from './sokort.js';
import { lag, ikon, STANDARD_CENTER } from './kortvaelger.js';
import { fiskTekst } from './fisk.js';

let sted = 'alle', map = null;

export async function mount(view) {
  const trips = await db.getAll('trips');
  const alle = trips.flatMap((t) => t.catches.map((c) => ({ c, t }))).filter((x) => x.c.spot || x.c.plads);
  const steder = [...new Set(alle.map((x) => x.t.place))].sort((a, b) => a.localeCompare(b, 'da'));
  if (sted !== 'alle' && !steder.includes(sted)) sted = 'alle';
  const vist = alle.filter((x) => sted === 'alle' || x.t.place === sted);
  view.innerHTML = `
    <section class="card">
      <div class="trip-top">
        <h2>🗺️ Mine fangster på kortet</h2>
        ${steder.length > 1 ? `<select id="sted" class="mini-select"><option value="alle">Alle søer</option>${steder.map((s) => `<option ${s === sted ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : ''}
      </div>
      <p class="muted small">${vist.length ? `${vist.length} fangst${vist.length > 1 ? 'er' : ''} med position. 🎣 = hvor fisken tog (større prik = tungere fisk), 🏕️ = din plads.` : 'Ingen fangster med position endnu. Under 🐟 Fangster kan du trykke "🗺️ Marker din plads og hvor fisken tog".'}</p>
    </section>
    <section class="card map-card"><div id="kort-stor"></div></section>`;
  view.querySelector('#sted')?.addEventListener('change', (e) => { sted = e.target.value; mount(view); });

  let L;
  try { L = await hentLeaflet(); } catch { return; }
  if (map) { map.stop(); map.remove(); map = null; }
  map = L.map(view.querySelector('#kort-stor')).setView([STANDARD_CENTER.lat, STANDARD_CENTER.lon], STANDARD_CENTER.zoom);
  const { sat, osm } = lag(L); sat.addTo(map);
  L.control.layers({ Luftfoto: sat, Kort: osm }, null, { position: 'topright' }).addTo(map);
  const pkt = [];
  const pladser = new Map();
  const maxKg = Math.max(1, ...vist.map((x) => x.c.weightKg || 0));
  for (const { c, t } of vist) {
    const pop = `<div class="pop">${fiskTekst(c)}<br><span class="muted">${esc(t.place)} · ${fangstDato(c, t)}</span></div>`;
    if (c.spot) {
      const r = 6 + 10 * ((c.weightKg || 0) / maxKg);
      L.circleMarker([c.spot.lat, c.spot.lon], { radius: r, color: '#1f2a1c', weight: 2, fillColor: '#e8c565', fillOpacity: 0.9 }).addTo(map).bindPopup(pop);
      pkt.push([c.spot.lat, c.spot.lon]);
    }
    if (c.plads) {
      const k = `${c.plads.lat.toFixed(4)},${c.plads.lon.toFixed(4)}`; // samme plads (ca. 10 m)
      const p = pladser.get(k) || { ...c.plads, n: 0 };
      p.n++; pladser.set(k, p);
      if (c.spot) L.polyline([[c.plads.lat, c.plads.lon], [c.spot.lat, c.spot.lon]], { color: '#e8cf86', weight: 1.5, opacity: 0.7, dashArray: '4 6' }).addTo(map);
      pkt.push([c.plads.lat, c.plads.lon]);
    }
  }
  for (const p of pladser.values()) L.marker([p.lat, p.lon], { icon: ikon(L, '🏕️', 'plads') }).addTo(map).bindTooltip(`Plads · ${p.n} fisk`);
  if (pkt.length) map.fitBounds(pkt, { padding: [40, 40], maxZoom: 18, animate: false });
  setTimeout(() => map.invalidateSize(), 50);
}
