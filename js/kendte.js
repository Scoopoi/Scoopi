// Kendte fisk: find ud af, om en karpe er fanget før (af dig eller en ven),
// sammenlign billederne side om side (skælmønsteret), og følg fiskens historik.
import * as db from './db.js';
import { esc, fmt, uid, datoTekst, toast, fangstDato } from './util.js';
import { fotoUrl } from './fisk.js';

const dato = (x) => x.c.date || x.t.date;

// Alle fangster som { c, t }
export async function alleFangster() {
  const trips = await db.getAll('trips');
  return trips.flatMap((t) => t.catches.map((c) => ({ c, t })));
}

// Hvor godt ligner to fangster hinanden? Returnerer null, hvis de umuligt er samme fisk.
export function lighed(a, b) {
  const A = a.c, B = b.c;
  if (A.species?.toLowerCase() !== B.species?.toLowerCase()) return null;
  if (A.carpType && B.carpType && A.carpType !== B.carpType) return null; // skæl ≠ spejl
  if (A.fishId && A.fishId === B.fishId) return null; // allerede koblet
  const år = Math.abs(new Date(dato(a)) - new Date(dato(b))) / (365 * 864e5);
  let score = 50;
  const grunde = [];
  if (A.carpType && A.carpType === B.carpType) { score += 15; grunde.push(`begge ${A.carpType.toLowerCase()}`); }
  if (A.lengthCm && B.lengthCm) {
    const d = Math.abs(A.lengthCm - B.lengthCm);
    const tilladt = 3 + 6 * år; // målefejl + vækst
    if (d > tilladt + 10) return null;
    score += Math.max(-25, 20 - (Math.max(0, d - tilladt) * 3) - d);
    grunde.push(`${fmt(d, 1)} cm forskel`);
  }
  if (A.weightKg && B.weightKg) {
    const r = Math.abs(Math.log(A.weightKg / B.weightKg));
    const tilladt = 0.2 + 0.25 * år; // gyde/sæson ± vækst
    if (r > tilladt + 0.5) return null;
    score += Math.max(-25, 20 - r * 60);
    grunde.push(`${fmt(Math.abs(A.weightKg - B.weightKg), 1)} kg forskel`);
  }
  if (a.t.place.trim().toLowerCase() === b.t.place.trim().toLowerCase()) { score += 15; grunde.push('samme sø'); }
  else score -= 15;
  if (B.photoIds?.length) score += 5;
  return { score: Math.round(Math.max(0, Math.min(100, score))), grunde };
}

export async function kandidater(catchId, { alleSoer = false } = {}) {
  const alle = await alleFangster();
  const mig = alle.find((x) => x.c.id === catchId);
  if (!mig) return { mig: null, liste: [] };
  const liste = alle
    .filter((x) => x.c.id !== catchId && (alleSoer || x.t.place.trim().toLowerCase() === mig.t.place.trim().toLowerCase()))
    .map((x) => ({ ...x, l: lighed(mig, x) }))
    .filter((x) => x.l && x.l.score >= 40)
    .sort((a, b) => b.l.score - a.l.score)
    .slice(0, 8);
  return { mig, liste };
}

// ---------- UI ----------

const navnPaa = async (id) => (id ? (await db.get('fish', id))?.name : null);

export async function visSammeFisk(catchId, efter) {
  let alleSoer = false;
  const ov = document.createElement('div');
  ov.className = 'sheet';
  document.body.append(ov);
  const luk = () => { ov.remove(); efter?.(); };

  async function tegn() {
    const { mig, liste } = await kandidater(catchId, { alleSoer });
    if (!mig) { luk(); return; }
    const mitNavn = await navnPaa(mig.c.fishId);
    const navne = await Promise.all(liste.map((x) => navnPaa(x.c.fishId)));
    ov.innerHTML = `
      <div class="sheet-box">
        <div class="trip-top"><h2>🔍 Samme fisk?</h2><button type="button" class="ghost sm" data-luk>Luk</button></div>
        <p class="muted small">Appen leder efter karper med samme type og en størrelse, der passer (inkl. vækst). Sammenlign <b>skælmønsteret</b> på billederne, og tryk <b>Samme fisk</b>, hvis det er den samme.</p>
        <div class="mig">${kort(mig, mitNavn, true)}</div>
        ${mitNavn ? `<p class="small">Denne fangst er allerede <b>${esc(mitNavn)}</b>. <button type="button" class="ghost sm" data-fjern>Fjern kobling</button></p>` : ''}
        <label class="check"><input type="checkbox" id="alle-soer" ${alleSoer ? 'checked' : ''}> Søg i alle søer</label>
        ${liste.length ? `<ul class="kand">${liste.map((x, i) => `
          <li>
            ${kort(x, navne[i])}
            <div class="lig"><b>${x.l.score} %</b> lighed · ${x.l.grunde.join(' · ')}</div>
            <div class="row-btns">
              <button type="button" class="ghost sm" data-sml="${x.c.id}">⇅ Sammenlign billeder</button>
              <button type="button" class="sm" data-match="${x.c.id}">✓ Samme fisk</button>
            </div>
          </li>`).join('')}</ul>` : '<p class="muted">Ingen mulige match fundet. Det kan være en ny fisk! 🎉</p>'}
      </div>`;
    fyldBilleder(ov);
    ov.querySelector('[data-luk]').onclick = luk;
    ov.querySelector('#alle-soer').onchange = (e) => { alleSoer = e.target.checked; tegn(); };
    ov.querySelector('[data-fjern]')?.addEventListener('click', async () => { await kobl(mig, null); toast('Koblingen er fjernet'); tegn(); });
    ov.querySelectorAll('[data-sml]').forEach((b) => b.onclick = () => sammenlign(mig.c, liste.find((x) => x.c.id === b.dataset.sml).c));
    ov.querySelectorAll("[data-match]").forEach((b) => b.onclick = async () => {
      const x = liste.find((y) => y.c.id === b.dataset.match);
      if (await markerSamme(mig, x)) tegn();
    });
  }
  ov.addEventListener('click', (e) => { if (e.target === ov) luk(); });
  tegn();
}

// Marker to fangster som samme fisk (opretter/fletter en kendt fisk). Returnerer false, hvis man fortryder.
export async function markerSamme(a, b) {
  let fishId = b.c.fishId || a.c.fishId;
  if (!fishId) {
    const forslag = `${b.c.carpType || a.c.carpType || b.c.species} fra ${b.t.place}`;
    const navn = prompt('Giv fisken et navn (fx "Store Spejl" eller "Arret"):', forslag);
    if (navn === null) return false;
    fishId = uid();
    await db.put('fish', { id: fishId, name: navn.trim() || forslag, species: b.c.species, carpType: b.c.carpType || a.c.carpType || '', createdAt: new Date().toISOString() });
  } else if (b.c.fishId && a.c.fishId && b.c.fishId !== a.c.fishId) {
    // To kendte fisk er den samme: flet dem
    const gammel = a.c.fishId;
    for (const y of await alleFangster()) if (y.c.fishId === gammel) await kobl(y, fishId);
    await db.remove('fish', gammel);
  }
  await kobl(b, fishId);
  await kobl(a, fishId);
  toast(`Genfangst! 🎉 ${await navnPaa(fishId)}`);
  return true;
}

// Scan: alle par af fangster med billeder, der kan være samme fisk (ikke allerede koblet, ikke afvist).
const AFVIST = 'karpeloggen-ikke-samme';
const afviste = () => { try { return new Set(JSON.parse(localStorage.getItem(AFVIST) || '[]')); } catch { return new Set(); } };
const parNøgle = (a, b) => [a.c.id, b.c.id].sort().join('|');
export function afvisPar(a, b) {
  const s = afviste(); s.add(parNøgle(a, b));
  try { localStorage.setItem(AFVIST, JSON.stringify([...s])); } catch {}
}
export async function scanGenfangster(fangster, { minScore = 55, alleSoer = false } = {}) {
  const af = afviste();
  const med = fangster.filter((x) => x.c.photoIds?.length);
  const par = [];
  for (let i = 0; i < med.length; i++) for (let j = i + 1; j < med.length; j++) {
    const a = med[i], b = med[j];
    if (a.c.fishId && a.c.fishId === b.c.fishId) continue;
    if (!alleSoer && a.t.place.trim().toLowerCase() !== b.t.place.trim().toLowerCase()) continue;
    if (af.has(parNøgle(a, b))) continue;
    const l = lighed(a, b);
    if (l && l.score >= minScore) par.push({ a, b, l });
  }
  return par.sort((x, y) => y.l.score - x.l.score).slice(0, 50);
}
export { sammenlign, kort, fyldBilleder, navnPaa };

async function kobl(x, fishId) {
  const t = await db.get('trips', x.t.id);
  const c = t.catches.find((y) => y.id === x.c.id);
  if (fishId) c.fishId = fishId; else delete c.fishId;
  t.updatedAt = new Date().toISOString();
  await db.put('trips', t);
  x.c.fishId = c.fishId;
  // Fjern kendte fisk uden fangster
  const brugt = new Set((await alleFangster()).map((y) => y.c.fishId).filter(Boolean));
  for (const f of await db.getAll('fish')) if (!brugt.has(f.id)) await db.remove('fish', f.id);
}

function kort(x, navn, stor = false) {
  const c = x.c;
  return `
    <div class="fkort ${stor ? 'stor' : ''}">
      <div class="fbill" data-ids="${(c.photoIds || []).join(',')}">🐟</div>
      <div>
        <b>${esc(c.carpType || c.species)}</b> ${c.weightKg != null ? `${fmt(c.weightKg)} kg` : ''}${c.lengthCm != null ? ` · ${fmt(c.lengthCm, 1)} cm` : ''}
        <div class="muted small">${esc(x.t.place)} · ${fangstDato(x.c, x.t)}${c.caughtBy ? ` · 👤 ${esc(c.caughtBy)}` : ''}</div>
        ${navn ? `<div class="small">🏷️ <b>${esc(navn)}</b></div>` : ''}
      </div>
    </div>`;
}

async function fyldBilleder(root) {
  for (const d of root.querySelectorAll('.fbill')) {
    const ids = d.dataset.ids.split(',').filter(Boolean);
    if (!ids.length) continue;
    const u = await fotoUrl(ids[0]);
    if (u) d.innerHTML = `<img src="${u}" alt="">${ids.length > 1 ? `<span class="antal">${ids.length}</span>` : ''}`;
  }
}

// To fisk over hinanden (telefon) eller side om side (PC), hver med egne billeder.
async function sammenlign(a, b) {
  const ua = (await Promise.all((a.photoIds || []).map(fotoUrl))).filter(Boolean);
  const ub = (await Promise.all((b.photoIds || []).map(fotoUrl))).filter(Boolean);
  const ov = document.createElement('div');
  ov.className = 'sml';
  const panel = (urls, titel, k) => `
    <div class="sml-p" data-k="${k}">
      <div class="sml-t">${titel}</div>
      ${urls.length ? `<img alt="">${urls.length > 1 ? '<button type="button" class="g-pil g-forr">‹</button><button type="button" class="g-pil g-naeste">›</button>' : ''}<div class="g-tal"></div>` : '<p class="muted">Ingen billeder</p>'}
    </div>`;
  ov.innerHTML = `${panel(ua, 'Din fangst', 'a')}${panel(ub, 'Mulig match', 'b')}<button type="button" class="g-luk" aria-label="Luk">✕</button>`;
  for (const [k, urls] of [['a', ua], ['b', ub]]) {
    const p = ov.querySelector(`[data-k=${k}]`);
    if (!urls.length) continue;
    let i = 0;
    const vis = () => { p.querySelector('img').src = urls[i]; p.querySelector('.g-tal').textContent = urls.length > 1 ? `${i + 1} / ${urls.length}` : ''; };
    const gå = (d) => { i = (i + d + urls.length) % urls.length; vis(); };
    p.querySelector('.g-forr')?.addEventListener('click', () => gå(-1));
    p.querySelector('.g-naeste')?.addEventListener('click', () => gå(1));
    let x0 = null;
    p.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    p.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) gå(dx < 0 ? 1 : -1); x0 = null; });
    vis();
  }
  ov.querySelector('.g-luk').onclick = () => ov.remove();
  document.body.append(ov);
}

// Sektion til Statistik: alle kendte fisk med historik.
export async function kendteSektion() {
  const fisk = await db.getAll('fish');
  if (!fisk.length) return '';
  const alle = await alleFangster();
  const rows = fisk.map((f) => {
    const g = alle.filter((x) => x.c.fishId === f.id).sort((a, b) => dato(a).localeCompare(dato(b)));
    return { f, g };
  }).filter((r) => r.g.length).sort((a, b) => b.g.length - a.g.length);
  return `
    <section class="card">
      <h2>🏷️ Kendte fisk</h2>
      <p class="muted small">Fisk, der er fanget mere end én gang. Vægten over tid viser, hvordan de vokser.</p>
      <ul class="kendte">${rows.map(({ f, g }) => {
        const v = g.filter((x) => x.c.weightKg != null);
        const ids = g.flatMap((x) => x.c.photoIds || []);
        return `
        <li>
          <div class="trip-top"><b>${esc(f.name)}</b><span class="tag">fanget ${g.length} gange</span></div>
          ${v.length > 1 ? sparkline(v.map((x) => x.c.weightKg)) : ''}
          <ul class="hist">${g.map((x) => `<li>${fangstDato(x.c, x.t)} · ${x.c.weightKg != null ? fmt(x.c.weightKg) + ' kg' : '–'}${x.c.lengthCm != null ? ` · ${fmt(x.c.lengthCm, 1)} cm` : ''} · ${esc(x.t.place)}${x.c.caughtBy ? ` · 👤 ${esc(x.c.caughtBy)}` : ' · 👤 dig'}</li>`).join('')}</ul>
          ${ids.length ? `<button type="button" class="foto-link" data-galleri="${ids.join(',')}">📷 Alle ${ids.length} billeder</button>` : ''}
        </li>`;
      }).join('')}</ul>
    </section>`;
}

function sparkline(vals) {
  const w = 220, h = 40, min = Math.min(...vals), max = Math.max(...vals), sp = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * (w - 8) + 4},${h - 6 - ((v - min) / sp) * (h - 12)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Vægt over tid: ${vals.map((v) => fmt(v)).join(', ')} kg">
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/>
    ${pts.split(' ').map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="currentColor"/>`).join('')}
    <text x="4" y="10" font-size="9" fill="currentColor">${fmt(vals[0])} kg</text>
    <text x="${w - 4}" y="10" font-size="9" fill="currentColor" text-anchor="end">${fmt(vals[vals.length - 1])} kg</text>
  </svg>`;
}
