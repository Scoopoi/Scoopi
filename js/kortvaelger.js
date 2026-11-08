// Kort over søen, hvor man markerer sin plads og hvor fisken tog.
import { hentLeaflet } from './sokort.js';
import { afstand } from './dji.js';
import { fmt } from './util.js';

// Startområde, hvis vi ikke kender søens position endnu (Vallensbæk/Tueholm-området). Kortet kan flyttes frit.
export const STANDARD_CENTER = { lat: 55.637, lon: 12.37, zoom: 14 };

export function lag(L) {
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Luftfoto © Esri' });
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
  return { sat, osm };
}
export const ikon = (L, tegn, kl) => L.divIcon({ className: `kort-ikon ${kl || ''}`, html: tegn, iconSize: [34, 34], iconAnchor: [17, 30] });

// el: container. Returnerer { hent(), destroy() }
export async function kortVaelger(el, { center, plads, spot, onChange }) {
  el.innerHTML = `
    <div class="seg kv-tilstand">
      <label><input type="radio" name="kv" value="plads" checked><span>🏕️ Min plads</span></label>
      <label><input type="radio" name="kv" value="spot"><span>🎣 Hvor fisken tog</span></label>
    </div>
    <div class="kv-kort"></div>
    <p class="muted small kv-txt">Tryk på kortet for at sætte en markering. Du kan trække i den bagefter.</p>`;
  let L;
  try { L = await hentLeaflet(); } catch { el.querySelector('.kv-txt').textContent = 'Kortet kunne ikke indlæses.'; return { hent: () => ({ plads, spot }) }; }
  const c = spot || plads || center || STANDARD_CENTER;
  const map = L.map(el.querySelector('.kv-kort'), { zoomControl: true, attributionControl: true }).setView([c.lat, c.lon], c.zoom || 17);
  const { sat, osm } = lag(L);
  sat.addTo(map);
  L.control.layers({ Luftfoto: sat, Kort: osm }, null, { position: 'topright' }).addTo(map);
  const m = {};
  let linje = null;
  const tegn = () => {
    if (linje) { linje.remove(); linje = null; }
    if (m.plads && m.spot) {
      const a = m.plads.getLatLng(), b = m.spot.getLatLng();
      linje = L.polyline([a, b], { color: '#e8cf86', weight: 3, dashArray: '6 6' }).addTo(map);
      const d = afstand({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng });
      el.querySelector('.kv-txt').innerHTML = `🎣 Fisken tog <b>ca. ${fmt(Math.round(d), 0)} m</b> fra din plads.`;
    }
    onChange?.(hent());
  };
  const sæt = (hvad, ll) => {
    if (m[hvad]) m[hvad].setLatLng(ll);
    else {
      m[hvad] = L.marker(ll, { draggable: true, icon: ikon(L, hvad === 'plads' ? '🏕️' : '🎣', hvad) }).addTo(map);
      m[hvad].on('dragend', tegn);
    }
    tegn();
  };
  if (plads) sæt('plads', [plads.lat, plads.lon]);
  if (spot) sæt('spot', [spot.lat, spot.lon]);
  map.on('click', (e) => {
    const hvad = el.querySelector('input[name=kv]:checked').value;
    sæt(hvad, e.latlng);
    // Efter pladsen er sat, skift automatisk til "hvor fisken tog"
    if (hvad === 'plads' && !m.spot) el.querySelector('input[name=kv][value=spot]').checked = true;
  });
  const hent = () => {
    const p = (x) => (x ? { lat: +x.getLatLng().lat.toFixed(6), lon: +x.getLatLng().lng.toFixed(6) } : null);
    return { plads: p(m.plads), spot: p(m.spot) };
  };
  setTimeout(() => map.invalidateSize(), 50);
  return {
    hent,
    flyt: (p) => { if (!m.plads && !m.spot) map.setView([p.lat, p.lon], 17, { animate: false }); },
    destroy: () => map.remove(),
  };
}

// Lille kort, der kun viser plads og huggested (i en fangst)
export async function visFangstKort(c, titel) {
  const L = await hentLeaflet();
  const ov = document.createElement('div');
  ov.className = 'sheet';
  ov.innerHTML = `<div class="sheet-box"><div class="trip-top"><h2>🗺️ ${titel}</h2><button type="button" class="ghost sm" data-luk>Luk</button></div><div class="kv-kort stor"></div><p class="muted small kv-txt"></p></div>`;
  document.body.append(ov);
  const pkt = [c.plads, c.spot].filter(Boolean);
  const map = L.map(ov.querySelector('.kv-kort')).setView([pkt[0].lat, pkt[0].lon], 17);
  const { sat, osm } = lag(L); sat.addTo(map);
  L.control.layers({ Luftfoto: sat, Kort: osm }, null, { position: 'topright' }).addTo(map);
  if (c.plads) L.marker([c.plads.lat, c.plads.lon], { icon: ikon(L, '🏕️', 'plads') }).addTo(map).bindTooltip('Min plads');
  if (c.spot) L.marker([c.spot.lat, c.spot.lon], { icon: ikon(L, '🎣', 'spot') }).addTo(map).bindTooltip('Her tog fisken');
  if (c.plads && c.spot) {
    L.polyline([[c.plads.lat, c.plads.lon], [c.spot.lat, c.spot.lon]], { color: '#e8cf86', weight: 3, dashArray: '6 6' }).addTo(map);
    map.fitBounds([[c.plads.lat, c.plads.lon], [c.spot.lat, c.spot.lon]], { padding: [40, 40], maxZoom: 18, animate: false });
    ov.querySelector('.kv-txt').innerHTML = `Fisken tog <b>ca. ${Math.round(afstand(c.plads, c.spot))} m</b> fra pladsen.`;
  }
  const luk = () => { map.stop(); map.remove(); ov.remove(); };
  ov.querySelector('[data-luk]').onclick = luk;
  ov.addEventListener('click', (e) => { if (e.target === ov) luk(); });
  setTimeout(() => map.invalidateSize(), 50);
}
