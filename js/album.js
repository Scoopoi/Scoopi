// Album: alle billeder samlet, med filter – og scanning efter genfangster.
import * as db from './db.js';
import { esc, fmt, fangstDato } from './util.js';
import { fotoUrl, visGalleri, fiskTekst } from './fisk.js';
import { scanGenfangster, markerSamme, afvisPar, sammenlign, navnPaa } from './kendte.js';

const filter = { art: 'alle', sted: 'alle', aar: 'alle', hvem: 'alle' };
let alleSoer = false;

export async function mount(el) {
  const trips = await db.getAll('trips');
  const kendte = Object.fromEntries((await db.getAll('fish')).map((f) => [f.id, f.name]));
  const alle = trips.flatMap((t) => t.catches.map((c) => ({ c, t })))
    .sort((a, b) => ((b.c.date || b.t.date) + (b.c.time || '')).localeCompare((a.c.date || a.t.date) + (a.c.time || '')));
  const uniq = (f) => [...new Set(alle.map(f).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'da'));
  const arter = uniq((x) => x.c.carpType || x.c.species), steder = uniq((x) => x.t.place), år = uniq((x) => (x.t.cirka === 'ukendt' ? 'Ukendt' : (x.c.date || x.t.date).slice(0, 4))).reverse();
  const venner = uniq((x) => x.c.caughtBy);
  const ok = (x) => (filter.art === 'alle' || (x.c.carpType || x.c.species) === filter.art)
    && (filter.sted === 'alle' || x.t.place === filter.sted)
    && (filter.aar === 'alle' || (filter.aar === 'Ukendt' ? x.t.cirka === 'ukendt' : x.t.cirka !== 'ukendt' && (x.c.date || x.t.date).startsWith(filter.aar)))
    && (filter.hvem === 'alle' || (filter.hvem === 'mig' ? !x.c.caughtBy : x.c.caughtBy === filter.hvem));
  const vist = alle.filter(ok);
  const fotos = vist.flatMap((x) => (x.c.photoIds || []).map((id) => ({ id, x })));
  const sel = (navn, værdi, liste, alleTekst) => `<select data-f="${navn}" class="mini-select"><option value="alle">${alleTekst}</option>${liste.map((v) => `<option ${v === værdi ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;

  el.innerHTML = `
    <section class="card">
      <h2>🖼️ Fotogalleri <span class="muted">(${fotos.length} billeder)</span></h2>
      <div class="filtre">
        ${sel('art', filter.art, arter, 'Alle arter')}
        ${sel('sted', filter.sted, steder, 'Alle søer')}
        ${sel('aar', filter.aar, år, 'Alle år')}
        ${venner.length ? `<select data-f="hvem" class="mini-select"><option value="alle">Alle</option><option value="mig" ${filter.hvem === 'mig' ? 'selected' : ''}>Kun mine</option>${venner.map((v) => `<option ${v === filter.hvem ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : ''}
      </div>
      ${fotos.length ? `<div class="album">${fotos.map((f, i) => `<button type="button" class="a-foto" data-i="${i}" aria-label="Billede ${i + 1}"><img alt="" data-id="${f.id}"><span>${f.x.c.weightKg != null ? `${fmt(f.x.c.weightKg)} kg` : esc(f.x.c.carpType || f.x.c.species)}${f.x.c.fishId ? ' 🏷️' : ''}</span></button>`).join('')}</div>`
        : '<p class="muted">Ingen billeder endnu. Tilføj billeder på dine fangster.</p>'}
    </section>
    <section class="card" id="scan">
      <div class="trip-top"><h2>🔍 Genfangster</h2></div>
      <p class="muted small">Find par af fangster, der kan være <b>samme fisk</b> (type, størrelse, vækst og sø). Sammenlign skælmønsteret på billederne, og bekræft eller afvis. Afviste par vises ikke igen.</p>
      <label class="check"><input type="checkbox" id="alle-soer" ${alleSoer ? 'checked' : ''}> Søg på tværs af alle søer</label>
      <button type="button" id="scan-knap">🔍 Scan efter genfangster</button>
      <div id="scan-res"></div>
    </section>`;

  el.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { filter[s.dataset.f] = s.value; mount(el); });
  // Miniaturer (hentes efterhånden)
  el.querySelectorAll('.album img').forEach(async (img) => { const u = await fotoUrl(img.dataset.id); if (u) img.src = u; });
  const tekst = (x) => `${fiskTekst(x.c)}${x.c.fishId && kendte[x.c.fishId] ? ` · 🏷️ <b>${esc(kendte[x.c.fishId])}</b>` : ''}<br><span>${esc(x.t.place)} · ${fangstDato(x.c, x.t)}</span>`;
  el.querySelectorAll('.a-foto').forEach((b) => b.onclick = () => visGalleri(fotos.map((f) => f.id), +b.dataset.i, false, fotos.map((f) => tekst(f.x))));
  el.querySelector('#alle-soer').onchange = (e) => { alleSoer = e.target.checked; };
  el.querySelector('#scan-knap').onclick = () => scan(el, vist);
}

async function scan(el, vist) {
  const res = el.querySelector('#scan-res');
  res.innerHTML = '<p class="muted small">Scanner …</p>';
  const par = await scanGenfangster(vist, { alleSoer });
  if (!par.length) { res.innerHTML = '<p class="muted">Ingen mulige genfangster fundet blandt fangster med billeder. 🎣</p>'; return; }
  const navne = await Promise.all(par.map(async (p) => [await navnPaa(p.a.c.fishId), await navnPaa(p.b.c.fishId)]));
  res.innerHTML = `<p class="small"><b>${par.length}</b> mulige par – mest sandsynlige først:</p>
    <ul class="par">${par.map((p, i) => `
      <li data-p="${i}">
        <div class="par-billeder">
          ${[p.a, p.b].map((x, k) => `<div class="par-fisk"><div class="pf-img"><img alt="" data-id="${x.c.photoIds[0]}">${x.c.photoIds.length > 1 ? `<span class="antal">${x.c.photoIds.length}</span>` : ''}</div>
            <div class="small"><b>${esc(x.c.carpType || x.c.species)}</b> ${x.c.weightKg != null ? fmt(x.c.weightKg) + ' kg' : ''}${x.c.lengthCm != null ? ` · ${fmt(x.c.lengthCm, 1)} cm` : ''}<br><span class="muted">${fangstDato(x.c, x.t)}${x.c.caughtBy ? ` · 👤 ${esc(x.c.caughtBy)}` : ''}</span>${navne[i][k] ? `<br>🏷️ ${esc(navne[i][k])}` : ''}</div></div>`).join('')}
        </div>
        <div class="lig"><b>${p.l.score} %</b> lighed · ${p.l.grunde.join(' · ')}</div>
        <div class="row-btns">
          <button type="button" class="ghost sm" data-sml="${i}">⇅ Sammenlign</button>
          <button type="button" class="sm" data-ja="${i}">✓ Samme fisk</button>
          <button type="button" class="ghost sm" data-nej="${i}">✗ Ikke samme</button>
        </div>
      </li>`).join('')}</ul>`;
  res.querySelectorAll('img[data-id]').forEach(async (img) => { const u = await fotoUrl(img.dataset.id); if (u) img.src = u; });
  res.querySelectorAll('[data-sml]').forEach((b) => b.onclick = () => { const p = par[+b.dataset.sml]; sammenlign(p.a.c, p.b.c); });
  res.querySelectorAll('[data-ja]').forEach((b) => b.onclick = async () => { const p = par[+b.dataset.ja]; if (await markerSamme(p.a, p.b)) scan(el, await friske(vist)); });
  res.querySelectorAll('[data-nej]').forEach((b) => b.onclick = () => { const p = par[+b.dataset.nej]; afvisPar(p.a, p.b); b.closest('li').remove(); });
}

// Efter en kobling: hent de opdaterede fangster (fishId ændret)
async function friske(vist) {
  const ids = new Set(vist.map((x) => x.c.id));
  const trips = await db.getAll('trips');
  return trips.flatMap((t) => t.catches.map((c) => ({ c, t }))).filter((x) => ids.has(x.c.id));
}
