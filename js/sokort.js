// Søkort: alle gemte drone-analyser med GPS samlet på ét kort over søen.
// Karperne vises med farve efter størrelse, og søen deles i felter med antal karper pr. felt.
import { esc, fmt, datoTekst } from './util.js';
import { afstand } from './dji.js';

const LEAFLET = './vendor/leaflet/'; // Leaflet 1.9.4 (BSD-2), ligger i repoet så kortet virker offline
let leafletP;
function hentLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletP) {
    leafletP = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.css';
      document.head.append(css);
      const s = document.createElement('script');
      s.src = LEAFLET + 'leaflet.js';
      s.onload = () => resolve(window.L);
      s.onerror = () => { leafletP = null; reject(new Error('Kortet kunne ikke indlæses.')); };
      document.head.append(s);
    });
  }
  return leafletP;
}

const STR = [[0, 50, 'Under 50 cm', '#4fc3f7'], [50, 70, '50–70 cm', '#81c784'], [70, 90, '70–90 cm', '#ffb74d'], [90, 999, 'Over 90 cm', '#e57373']];
const farve = (cm) => cm == null ? '#f2c14e' : (STR.find(([a, b]) => cm >= a && cm < b) || STR[0])[3];

let valgtSted = null, valgtDato = 'alle', felt = 25, map = null;

export async function mount(el, gemte) {
  const geo = gemte.filter((d) => d.geo);
  const steder = [...new Set(geo.map((d) => d.place || 'Uden sted'))].sort((a, b) => a.localeCompare(b, 'da'));
  if (!geo.length) {
    el.innerHTML = `<section class="card"><h2>Søkort</h2>
      <p class="muted">Her samles dine drone-analyser til ét kort over søen, med karperne markeret efter størrelse og antal i hvert område.</p>
      <p class="muted small">Kræver analyser med GPS og højde. Brug en DJI-video <b>med .SRT-fil</b> eller et DJI-billede (de har GPS indbygget), og gem analysen med søens navn.</p></section>`;
    return;
  }
  if (!steder.includes(valgtSted)) valgtSted = steder[0];
  const iSted = geo.filter((d) => (d.place || 'Uden sted') === valgtSted);
  const datoer = [...new Set(iSted.map((d) => d.date))].sort().reverse();
  if (valgtDato !== 'alle' && !datoer.includes(valgtDato)) valgtDato = 'alle';
  const valgte = iSted.filter((d) => valgtDato === 'alle' || d.date === valgtDato);

  // Saml karper; fjern dubletter fra overlappende billeder (samme sted inden for 1 m i forskellige billeder).
  const alle = [];
  for (const d of valgte) for (const m of d.markers) if (m.lat != null) alle.push({ ...m, fra: d.id });
  const karper = [];
  let dubletter = 0;
  for (const m of alle) {
    if (karper.some((k) => k.fra !== m.fra && afstand(k, m) < 1)) { dubletter += m.n; continue; }
    karper.push(m);
  }
  const ialt = karper.reduce((s, m) => s + m.n, 0);
  const medCm = karper.filter((m) => m.cm != null);

  el.innerHTML = `
    <section class="card">
      <div class="row">
        <label class="filter">Sø <select id="sted">${steder.map((s) => `<option ${s === valgtSted ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <label class="filter">Dato <select id="dato"><option value="alle">Alle datoer</option>${datoer.map((d) => `<option value="${d}" ${d === valgtDato ? 'selected' : ''}>${datoTekst(d)}</option>`).join('')}</select></label>
      </div>
      <div class="kpis">
        <div><b>${ialt}</b><span>karper (estimat)</span></div>
        <div><b>${valgte.length}</b><span>billeder</span></div>
        <div><b>${medCm.length ? Math.round(medCm.reduce((s, m) => s + m.cm, 0) / medCm.length) : '–'}</b><span>gns. cm</span></div>
        <div><b>${medCm.length ? Math.max(...medCm.map((m) => m.cm)) : '–'}</b><span>største cm</span></div>
      </div>
      ${dubletter ? `<p class="muted small">${dubletter} karpe${dubletter > 1 ? 'r' : ''} sås i to overlappende billeder og er kun talt én gang.</p>` : ''}
    </section>
    <section class="card map-card">
      <div class="row-btns map-ctrl">
        <span class="small">Feltstørrelse:</span>
        ${[10, 25, 50].map((f) => `<button type="button" class="ghost sm ${f === felt ? 'on' : ''}" data-felt="${f}">${f} m</button>`).join('')}
      </div>
      <div id="map"></div>
      <div class="legend">${STR.map(([, , n, c]) => `<span><i class="sw" style="background:${c}"></i>${n}</span>`).join('')}<span><i class="sw" style="background:#f2c14e"></i>Ukendt str.</span></div>
      <p class="muted small" id="map-err"></p>
    </section>
    <section class="card"><h2>Flest karper</h2><div id="top"></div></section>`;

  el.querySelector('#sted').onchange = (e) => { valgtSted = e.target.value; mount(el, gemte); };
  el.querySelector('#dato').onchange = (e) => { valgtDato = e.target.value; mount(el, gemte); };
  el.querySelectorAll('[data-felt]').forEach((b) => b.onclick = () => { felt = +b.dataset.felt; mount(el, gemte); });

  // Felter (grid) i meter omkring søen
  const lat0 = valgte[0].geo.lat;
  const mLat = 111320, mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const celler = new Map();
  for (const k of karper) {
    const cy = Math.floor((k.lat * mLat) / felt), cx = Math.floor((k.lon * mLon) / felt);
    const key = cx + ',' + cy;
    const c = celler.get(key) || { cx, cy, n: 0, cm: [] };
    c.n += k.n; if (k.cm != null) c.cm.push(k.cm);
    celler.set(key, c);
  }
  const sorted = [...celler.values()].sort((a, b) => b.n - a.n);
  sorted.forEach((c, i) => { c.nr = i + 1; });
  const max = sorted[0]?.n || 1;
  el.querySelector('#top').innerHTML = sorted.length ? `<ul class="bars">${sorted.slice(0, 8).map((c) => `
    <li><span class="bl">Felt ${c.nr}</span><span class="bt"><span class="bf" style="width:${(c.n / max) * 100}%"></span></span><span class="bv">${c.n}</span>
    <span class="bs muted">${c.cm.length ? `gns. ${Math.round(c.cm.reduce((a, b) => a + b, 0) / c.cm.length)} cm · største ${Math.max(...c.cm)} cm` : 'ingen størrelser'}</span></li>`).join('')}</ul>` : '<p class="muted small">Ingen karper med position.</p>';

  let L;
  try { L = await hentLeaflet(); } catch (e) { el.querySelector('#map-err').textContent = e.message; return; }
  if (map) { map.remove(); map = null; }
  map = L.map(el.querySelector('#map'), { zoomControl: true });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, attribution: 'Luftfoto © Esri' });
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
  sat.addTo(map);
  L.control.layers({ 'Luftfoto': sat, 'Kort': osm }, null, { position: 'topright' }).addTo(map);

  const grp = [];
  // Billedernes omrids
  for (const d of valgte) if (d.geo.hjoerner) grp.push(L.polygon(d.geo.hjoerner.map((p) => [p.lat, p.lon]), { color: '#fff', weight: 1, dashArray: '4 4', fill: false }).addTo(map));
  // Felter
  for (const c of sorted) {
    const b = [[(c.cy * felt) / mLat, (c.cx * felt) / mLon], [((c.cy + 1) * felt) / mLat, ((c.cx + 1) * felt) / mLon]];
    L.rectangle(b, { color: '#f2c14e', weight: 1, fillColor: '#f2c14e', fillOpacity: 0.12 + 0.4 * (c.n / max) }).addTo(map)
      .bindTooltip(`Felt ${c.nr}: ${c.n} karpe${c.n > 1 ? 'r' : ''}`, { permanent: true, direction: 'center', className: 'cell-tip' });
  }
  // Karper
  for (const k of karper) {
    const r = k.cm ? Math.max(4, Math.min(12, k.cm / 8)) : 5;
    grp.push(L.circleMarker([k.lat, k.lon], { radius: r * Math.sqrt(k.n), color: '#000', weight: 1, fillColor: farve(k.cm), fillOpacity: 0.9 })
      .addTo(map).bindPopup(k.n > 1 ? `Gruppe på ca. ${k.n} karper` : k.cm ? `Karpe ca. ${k.cm} cm` : 'Karpe (ukendt størrelse)'));
  }
  const fg = L.featureGroup(grp);
  map.fitBounds(fg.getBounds().pad(0.15), { maxZoom: 20 });
}
