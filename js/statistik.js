// Statistik: simple søjlediagrammer over agn, smag, farve og vejr + rekorder.
import * as db from './db.js';
import { esc, fmt, turMinutter, datoTekst, fangstDato } from './util.js';
import { hentManglende, retning, maaneNavn } from './vejr.js';
import { kendteSektion } from './kendte.js';

let artFilter = 'alle';
let hvemFilter = 'alle'; // alle | mig | venner | <navn>

const FARVEKODER = {
  hvid: '#f5f5f0', gul: '#f2d43d', pink: '#f28cc0', orange: '#f28b2e', 'rød': '#d8382e', 'grøn': '#4caf50',
  brun: '#8b5a2b', sort: '#222', lilla: '#8e5bc8', 'blå': '#3b7dd8', 'sølv': '#c0c6cc', naturlig: '#c9b48a',
};

export async function mount(view) {
  hentManglende().then((n) => { if (n && view.isConnected) mount(view); });
  const trips = await db.getAll('trips');
  const arter = [...new Set(trips.flatMap((t) => t.catches.map((c) => c.species)))].sort((a, b) => a.localeCompare(b, 'da'));
  if (artFilter !== 'alle' && !arter.includes(artFilter)) artFilter = 'alle';
  const venner = [...new Set(trips.flatMap((t) => t.catches.map((c) => c.caughtBy)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'da'));
  if (!['alle', 'mig', 'venner', ...venner].includes(hvemFilter)) hvemFilter = 'alle';
  const hvemOk = (c) => hvemFilter === 'alle' || (hvemFilter === 'mig' ? !c.caughtBy : hvemFilter === 'venner' ? !!c.caughtBy : c.caughtBy === hvemFilter);
  const match = (c) => (artFilter === 'alle' || c.species === artFilter) && hvemOk(c);

  const fisk = trips.flatMap((t) => t.catches.filter(match).map((c) => ({ ...c, trip: t })));
  const timer = trips.reduce((s, t) => s + (turMinutter(t) || 0) / 60, 0);

  if (!trips.length) {
    view.innerHTML = `<section class="card"><h2>Statistik</h2><p class="muted">Når du har gemt nogle ture under <a href="#/ture">Ny tur</a>, kommer der diagrammer her.</p></section>`;
    return;
  }

  view.innerHTML = `
    <section class="card">
      <label class="filter">Vis for
        <select id="art">
          <option value="alle">Alle arter</option>
          ${arter.map((a) => `<option ${a === artFilter ? 'selected' : ''}>${esc(a)}</option>`).join('')}
        </select>
      </label>
      ${venner.length ? `<label class="filter">Fanget af
        <select id="hvem">
          <option value="alle">Alle (mig og venner)</option>
          <option value="mig" ${hvemFilter === 'mig' ? 'selected' : ''}>Kun mig</option>
          <option value="venner" ${hvemFilter === 'venner' ? 'selected' : ''}>Kun venner</option>
          ${venner.map((v) => `<option value="${esc(v)}" ${v === hvemFilter ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select>
      </label>` : ''}
      <div class="kpis">
        <div><b>${trips.length}</b><span>ture</span></div>
        <div><b>${fisk.length}</b><span>fisk</span></div>
        <div><b>${fmt(timer, 0)}</b><span>timer</span></div>
        <div><b>${timer ? fmt(fisk.length / timer, 2) : '–'}</b><span>fisk pr. time</span></div>
      </div>
    </section>

    ${rekorder(fisk)}
    ${await kendteSektion()}
    ${gennemsnit(fisk)}

    <h3 class="sek">Agn</h3>
    ${stangTimer(trips, match)}
    ${bars('Fanget på', 'Antal fisk pr. agn', tael(fisk, (c) => c.bait))}
    ${bars('Smag', 'Antal fisk pr. smag', tael(fisk, (c) => c.flavour))}
    ${bars('Farve', 'Antal fisk pr. farve', tael(fisk, (c) => c.colour), true)}

    <h3 class="sek">Vejr</h3>
    ${vejrDiagrammer(trips, match)}
  `;

  view.querySelector('#art').onchange = (e) => { artFilter = e.target.value; mount(view); };
  const hv = view.querySelector('#hvem');
  if (hv) hv.onchange = (e) => { hvemFilter = e.target.value; mount(view); };
}

function tael(fisk, key) {
  const m = new Map();
  for (const c of fisk) {
    const k = (key(c) || '').trim();
    if (!k) continue;
    const navn = k[0].toUpperCase() + k.slice(1);
    m.set(navn, (m.get(navn) || 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]).map(([label, v]) => ({ label, v, txt: `${v}` }));
}

function bars(titel, under, rows, farve = false) {
  if (!rows.length) return `<section class="card"><h2>${titel}</h2><p class="muted small">Ingen data endnu. Udfyld "${titel.toLowerCase()}" på dine fisk.</p></section>`;
  const max = Math.max(...rows.map((r) => r.v)) || 1;
  return `
    <section class="card">
      <h2>${titel}</h2>
      <p class="muted small">${under}</p>
      <ul class="bars">
        ${rows.slice(0, 10).map((r) => `
          <li>
            <span class="bl">${farve ? `<i class="sw" style="background:${FARVEKODER[r.label.toLowerCase()] || 'var(--line)'}"></i>` : ''}${esc(r.label)}</span>
            <span class="bt"><span class="bf" style="width:${Math.max(4, (r.v / max) * 100)}%"></span></span>
            <span class="bv">${r.txt}</span>
            ${r.sub ? `<span class="bs muted">${r.sub}</span>` : ''}
          </li>`).join('')}
      </ul>
    </section>`;
}

// Vejr: fisk pr. time i hver vejrtype, så lange ture ikke snyder. Antal ture og timer vises også.
function vejrDiagrammer(trips, match) {
  const medVejr = trips.filter((t) => t.weather && turMinutter(t));
  const manglerPos = trips.filter((t) => t.lat == null).length;
  const manglerSlut = trips.filter((t) => t.weather && !t.end).length;
  const note = [
    manglerPos ? `${manglerPos} tur${manglerPos > 1 ? 'e' : ''} uden position (tryk "📍 Brug min position" på turen for at få vejr).` : '',
    manglerSlut ? `${manglerSlut} tur${manglerSlut > 1 ? 'e' : ''} uden sluttid tæller ikke med.` : '',
  ].filter(Boolean).join(' ');
  if (!medVejr.length) return `<section class="card"><h2>Vejr</h2><p class="muted small">Ingen ture med vejr endnu. Vejret hentes automatisk, når turen har en position og der er net. ${note}</p></section>`;

  const grupper = (key, orden) => {
    const m = new Map();
    for (const t of medVejr) {
      const k = key(t.weather);
      if (k == null) continue;
      const g = m.get(k) || { ture: 0, timer: 0, fisk: 0 };
      g.ture++;
      g.timer += turMinutter(t) / 60;
      g.fisk += t.catches.filter(match).length;
      m.set(k, g);
    }
    const keys = orden ? orden.filter((k) => m.has(k)) : [...m.keys()];
    return keys.map((k) => {
      const g = m.get(k);
      const v = g.fisk / g.timer;
      return { label: k, v, txt: fmt(v, 2), sub: `${g.fisk} fisk · ${g.ture} tur${g.ture > 1 ? 'e' : ''} · ${fmt(g.timer, 0)} t` };
    });
  };

  const tryk = (w) => w.trykAendring12t == null ? null : w.trykAendring12t <= -2 ? 'Faldende' : w.trykAendring12t >= 2 ? 'Stigende' : 'Stabilt';
  const temp = (w) => w.tempC == null ? null : w.tempC < 5 ? 'Under 5 °C' : w.tempC < 10 ? '5–10 °C' : w.tempC < 15 ? '10–15 °C' : w.tempC < 20 ? '15–20 °C' : 'Over 20 °C';
  const vind = (w) => w.vindMs == null ? null : w.vindMs < 2 ? 'Stille (under 2 m/s)' : w.vindMs < 5 ? 'Let (2–5 m/s)' : w.vindMs < 9 ? 'Frisk (5–9 m/s)' : 'Hård (over 9 m/s)';
  const sky = (w) => w.skydaekkePct == null ? null : w.skydaekkePct < 25 ? 'Klart' : w.skydaekkePct < 75 ? 'Let skyet' : 'Overskyet';
  const maane = (w) => {
    const n = maaneNavn(w.maane);
    return n.includes('Tiltagende') || n === 'Første kvarter' ? 'Tiltagende' : n.includes('Aftagende') || n === 'Sidste kvarter' ? 'Aftagende' : n;
  };
  const u = 'Fisk pr. time. Under hver søjle: hvor meget du har fisket i den slags vejr – få timer giver usikre tal.';
  return `
    ${note ? `<p class="muted small">${note}</p>` : ''}
    ${bars('Lufttryk (12 timer)', u, grupper(tryk, ['Faldende', 'Stabilt', 'Stigende']))}
    ${bars('Vindretning', u, grupper((w) => retning(w.vindRetningGrader), ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']))}
    ${bars('Vindstyrke', u, grupper(vind, ['Stille (under 2 m/s)', 'Let (2–5 m/s)', 'Frisk (5–9 m/s)', 'Hård (over 9 m/s)']))}
    ${bars('Temperatur', u, grupper(temp, ['Under 5 °C', '5–10 °C', '10–15 °C', '15–20 °C', 'Over 20 °C']))}
    ${bars('Skydække', u, grupper(sky, ['Klart', 'Let skyet', 'Overskyet']))}
    ${bars('Måne', u, grupper(maane, ['Nymåne', 'Tiltagende', 'Fuldmåne', 'Aftagende']))}`;
}

function rekorder(fisk) {
  const pr = new Map();
  for (const c of fisk) {
    const r = pr.get(c.species) || {};
    if (c.weightKg != null && (!r.tung || c.weightKg > r.tung.weightKg)) r.tung = c;
    if (c.lengthCm != null && (!r.lang || c.lengthCm > r.lang.lengthCm)) r.lang = c;
    pr.set(c.species, r);
  }
  const rows = [...pr].filter(([, r]) => r.tung || r.lang).sort((a, b) => (b[1].tung?.weightKg || 0) - (a[1].tung?.weightKg || 0));
  if (!rows.length) return '';
  const hvor = (c) => `<span class="muted small">${c.caughtBy ? `👤 ${esc(c.caughtBy)}, ` : ''}${esc(c.trip.place)}, ${fangstDato(c, c.trip)}</span>`;
  return `
    <section class="card">
      <h2>🏆 Rekorder</h2>
      <ul class="rek">
        ${rows.map(([art, r]) => `
          <li><b>${esc(art)}</b>
            ${r.tung ? `<div>Tungeste: <b>${fmt(r.tung.weightKg)} kg</b> ${hvor(r.tung)}</div>` : ''}
            ${r.lang ? `<div>Længste: <b>${fmt(r.lang.lengthCm, 1)} cm</b> ${hvor(r.lang)}</div>` : ''}
          </li>`).join('')}
      </ul>
    </section>`;
}

// Gennemsnitlig størrelse pr. art på hvert sted.
function gennemsnit(fisk) {
  const m = new Map();
  for (const c of fisk) {
    const k = c.trip.place + '\u0000' + c.species;
    const g = m.get(k) || { sted: c.trip.place, art: c.species, n: 0, vN: 0, vSum: 0, lN: 0, lSum: 0 };
    g.n++;
    if (c.weightKg != null) { g.vN++; g.vSum += c.weightKg; }
    if (c.lengthCm != null) { g.lN++; g.lSum += c.lengthCm; }
    m.set(k, g);
  }
  if (!m.size) return '';
  const steder = new Map();
  for (const g of m.values()) steder.set(g.sted, [...(steder.get(g.sted) || []), g]);
  const sorted = [...steder].sort((a, b) => a[0].localeCompare(b[0], 'da'));
  return `
    <section class="card">
      <h2>📏 Gennemsnit pr. sted</h2>
      <p class="muted small">Gennemsnitlig vægt og længde for hver art, der hvor du har fanget den.</p>
      ${sorted.map(([sted, arter]) => `
        <h4 class="sted">${esc(sted)}</h4>
        <table class="gns">
          <thead><tr><th>Art</th><th>Antal</th><th>Gns. vægt</th><th>Gns. længde</th></tr></thead>
          <tbody>
            ${arter.sort((a, b) => b.n - a.n).map((g) => `
              <tr><td>${esc(g.art)}</td><td>${g.n}</td>
                <td>${g.vN ? fmt(g.vSum / g.vN) + ' kg' : '–'}</td>
                <td>${g.lN ? fmt(g.lSum / g.lN, 1) + ' cm' : '–'}</td></tr>`).join('')}
          </tbody>
        </table>`).join('')}
    </section>`;
}

// Fisk pr. stang-time: hver stang tæller med sine timer – også på ture uden fangst.
function stangTimer(trips, match) {
  const ture = trips.filter((t) => t.stænger?.length && !t.cirka && turMinutter(t));
  if (!ture.length) return `<section class="card"><h2>🎣 Fisk pr. stang-time</h2><p class="muted small">Skriv antal stænger og agn på dine ture, så kan appen regne ud, hvad der fanger bedst pr. time – også når du ikke fanger noget.</p></section>`;
  let timerIalt = 0, fiskIalt = 0;
  const dim = { agn: new Map(), smag: new Map(), farve: new Map() };
  const læg = (m, k, timer, fisk) => { if (!k) return; const key = k[0].toUpperCase() + k.slice(1); const g = m.get(key) || { timer: 0, fisk: 0 }; g.timer += timer; g.fisk += fisk; m.set(key, g); };
  for (const t of ture) {
    const h = turMinutter(t) / 60;
    const fiskPrStang = t.stænger.map(() => 0);
    for (const c of t.catches.filter(match)) {
      let i = c.stang ? c.stang - 1 : t.stænger.findIndex((r) => r.agn && c.bait && r.agn.toLowerCase() === c.bait.toLowerCase());
      if (i >= 0 && i < fiskPrStang.length) fiskPrStang[i]++;
    }
    t.stænger.forEach((r, i) => {
      timerIalt += h; fiskIalt += fiskPrStang[i];
      læg(dim.agn, r.agn, h, fiskPrStang[i]); læg(dim.smag, r.smag, h, fiskPrStang[i]); læg(dim.farve, r.farve, h, fiskPrStang[i]);
    });
  }
  const rækker = (m) => [...m].map(([label, g]) => ({ label, v: g.fisk / g.timer, txt: fmt(g.fisk / g.timer, 2), sub: `${g.fisk} fisk · ${fmt(g.timer, 0)} stang-timer${g.timer < 10 ? ' · få timer, usikkert' : ''}` }))
    .sort((a, b) => b.v - a.v);
  const u = 'Fisk pr. stang-time. Under hver søjle: hvor længe den har ligget ude.';
  return `
    <section class="card">
      <h2>🎣 Fisk pr. stang-time</h2>
      <div class="kpis">
        <div><b>${fmt(timerIalt, 0)}</b><span>stang-timer</span></div>
        <div><b>${fiskIalt}</b><span>fisk på stænger</span></div>
        <div><b>${fiskIalt ? fmt(timerIalt / fiskIalt, 1) : '–'}</b><span>stang-timer pr. fisk</span></div>
        <div><b>${ture.length}</b><span>ture med stænger</span></div>
      </div>
    </section>
    ${bars('Agn pr. stang-time', u, rækker(dim.agn))}
    ${bars('Smag pr. stang-time', u, rækker(dim.smag))}
    ${bars('Farve pr. stang-time', u, rækker(dim.farve), true)}`;
}
