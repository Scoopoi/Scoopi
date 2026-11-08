// Fælles felter for én fisk. Bruges af både "Ny tur" og "Fangster".
import * as db from './db.js';
import { esc, num, fmt, uid, ugedag, datoTekst } from './util.js';
import { lasExif } from './exif.js';

// Appen er til karpe- og medefiskeri.
export const ARTER = ['Karpe', 'Græskarpe', 'Brasen', 'Suder', 'Karusse', 'Skalle', 'Rudskalle', 'Flire', 'Rimte',
  'Aborre', 'Ål', 'Løje', 'Grundling', 'Hork'];
export const KARPETYPER = ['Skælkarpe', 'Spejlkarpe', 'Læderkarpe', 'Lineær'];
export const AGN = ['Boilie', 'Pop-up', 'Wafter', 'Snowman', 'Majs', 'Tigernødder', 'Hampefrø', 'Partikler', 'Pellets',
  'Brød', 'Dej', 'Orm', 'Maddiker', 'Casters', 'Pasta',
  // Kunstagn til karper
  'Kunstig majs', 'Kunstig pop-up', 'Kunstig boilie', 'Kunstige tigernødder', 'Kunstig maddike', 'Kunstigt brød', 'Zig-skum'];
export const SMAG = ['Scopex', 'Ananas', 'Jordbær', 'Tutti frutti', 'Banan', 'Kokos', 'Scopex/Ananas', 'Fisk', 'Krill',
  'Squid', 'Blæksprutte', 'Hvidløg', 'Honning', 'Vanilje', 'Chili', 'Mulberry', 'Neutral'];
export const FARVER = ['Hvid', 'Gul', 'Pink', 'Orange', 'Rød', 'Grøn', 'Brun', 'Sort', 'Lilla', 'Blå', 'Sølv', 'Naturlig'];
export const STANDARDSTEDER = ['Vallensbæk Sø', 'Tueholm Sø'];

export const erKarpe = (a) => /^karpe$/i.test(String(a || '').trim());
export const opts = (arr) => arr.map((a) => `<option value="${esc(a)}">`).join('');
export const uniq = (arr) => [...new Set(arr.filter(Boolean))];

// Datalister med forslag (standardlister + det, du selv har skrevet før).
export function datalister(trips) {
  const alle = trips.flatMap((t) => t.catches);
  return `
    <datalist id="steder">${opts(uniq([...trips.map((t) => t.place), ...STANDARDSTEDER]))}</datalist>
    <datalist id="arter">${opts(uniq([...ARTER, ...alle.map((c) => c.species)]))}</datalist>
    <datalist id="agn">${opts(uniq([...AGN, ...alle.map((c) => c.bait)]))}</datalist>
    <datalist id="smag">${opts(uniq([...SMAG, ...alle.map((c) => c.flavour)]))}</datalist>
    <datalist id="farver">${opts(uniq([...FARVER, ...alle.map((c) => c.colour)]))}</datalist>
    <datalist id="venner">${opts(uniq(alle.map((c) => c.caughtBy)))}</datalist>`;
}

let tæller = 0;

// Laver et element med felterne for én fisk.
export function fiskElement(c = {}, { fjernbar = true, titel = 'Fisk', medDag = false } = {}) {
  const n = tæller++;
  const el = document.createElement('div');
  el.className = 'fish';
  el.innerHTML = `
    <div class="fish-head"><b>${titel}</b>${fjernbar ? '<button type="button" class="x" aria-label="Fjern fisk">✕</button>' : ''}</div>
    <div class="seg who">
      <label><input type="radio" name="who-${n}" value="mig" ${c.caughtBy ? '' : 'checked'}><span>Min fisk</span></label>
      <label><input type="radio" name="who-${n}" value="ven" ${c.caughtBy ? 'checked' : ''}><span>En vens fisk</span></label>
    </div>
    <label class="friend" ${c.caughtBy ? '' : 'hidden'}>Vennens navn <input type="text" name="friend" list="venner" placeholder="Fx Peter" value="${esc(c.caughtBy)}" autocomplete="off"></label>
    <label>Art <input type="text" name="species" list="arter" placeholder="Fx Karpe" value="${esc(c.species ?? 'Karpe')}" autocomplete="off"></label>
    <div class="row tidrow">
      ${medDag ? '<label class="dag" hidden>Dag <select name="cdate"></select></label>' : ''}
      <label class="kl">Kl. <input type="time" name="time" value="${esc(c.time)}"></label>
    </div>
    <label class="karpetype" ${erKarpe(c.species ?? 'Karpe') ? '' : 'hidden'}>Karpetype
      <select name="carpType"><option value="">Ved ikke</option>${KARPETYPER.map((k) => `<option ${k === c.carpType ? 'selected' : ''}>${k}</option>`).join('')}</select>
    </label>
    <div class="row">
      <label>Vægt (kg) <input type="text" inputmode="decimal" name="weight" placeholder="0,0" value="${esc(fmt(c.weightKg))}"></label>
      <label>Længde (cm) <input type="text" inputmode="decimal" name="length" placeholder="0" value="${esc(fmt(c.lengthCm, 1))}"></label>
    </div>
    <label>Fanget på <input type="text" name="bait" list="agn" placeholder="Fx Boilie, majs, orm" value="${esc(c.bait)}" autocomplete="off"></label>
    <div class="row">
      <label>Smag <input type="text" name="flavour" list="smag" placeholder="Fx Scopex" value="${esc(c.flavour)}" autocomplete="off"></label>
      <label>Farve <input type="text" name="colour" list="farver" placeholder="Fx Gul" value="${esc(c.colour)}" autocomplete="off"></label>
    </div>
    <div class="fotos"></div>
    <div class="exif-fisk" hidden></div>
    <label class="foto-btn"><input type="file" accept="image/*" multiple><span>📷 Tilføj billede</span></label>`;
  el.dataset.id = c.id || uid();
  el._dato = c.date || null;
  el._fotoIds = [...(c.photoIds || [])];
  el._nye = []; // { id, blob, url }
  el.querySelector('[name=species]').addEventListener('input', (e) => { el.querySelector('.karpetype').hidden = !erKarpe(e.target.value); });
  el.querySelectorAll('.who input').forEach((r) => r.addEventListener('change', () => {
    const ven = el.querySelector('.who input:checked').value === 'ven';
    el.querySelector('.friend').hidden = !ven;
    if (ven) el.querySelector('[name=friend]').focus();
  }));
  el.querySelector('.foto-btn input').onchange = async (e) => {
    for (const f of e.target.files) {
      try {
        const exif = await lasExif(f);
        if (exif) visExif(el, exif);
        const blob = await komprimer(f);
        el._nye.push({ id: uid(), blob, url: URL.createObjectURL(blob) });
      } catch { /* ikke et billede */ }
    }
    e.target.value = '';
    visFotos(el);
  };
  visFotos(el);
  return el;
}

async function visFotos(el) {
  const box = el.querySelector('.fotos');
  const gamle = await Promise.all(el._fotoIds.map(async (id) => ({ id, url: await fotoUrl(id) })));
  const alle = [...gamle.filter((f) => f.url), ...el._nye];
  box.innerHTML = alle.map((f) => `<span class="thumb"><img src="${f.url}" alt="" data-vis="${f.id}"><button type="button" class="x" data-fjern="${f.id}" aria-label="Fjern billede">✕</button></span>`).join('');
  box.querySelectorAll('[data-vis]').forEach((img, i) => img.onclick = () => visGalleri(alle.map((f) => f.url), i, true));
  box.querySelectorAll('[data-fjern]').forEach((b) => b.onclick = () => {
    const id = b.dataset.fjern;
    el._fotoIds = el._fotoIds.filter((x) => x !== id);
    el._nye = el._nye.filter((x) => x.id !== id);
    visFotos(el);
  });
}

const c0date = (el) => el._dato || null;
// Læser felterne for én fisk.
export function lasFisk(el) {
  const v = (n) => (el.querySelector(`[name=${n}]`)?.value || '').trim();
  const c = {
    id: el.dataset.id,
    species: v('species'),
    carpType: erKarpe(v('species')) ? el.querySelector('[name=carpType]').value : '',
    time: v('time') || null,
    date: v('cdate') || c0date(el),
    weightKg: num(v('weight')),
    lengthCm: num(v('length')),
    bait: v('bait'),
    flavour: v('flavour'),
    colour: v('colour'),
    caughtBy: el.querySelector('.who input:checked').value === 'ven' ? v('friend') || 'Ven' : '',
    photoIds: [...el._fotoIds, ...el._nye.map((f) => f.id)],
  };
  return c;
}

// Gemmer nye billeder i databasen.
export async function gemFotos(el) {
  for (const f of el._nye) await db.put('photos', { id: f.id, blob: f.blob, createdAt: new Date().toISOString() });
  el._fotoIds.push(...el._nye.map((f) => f.id));
  el._nye = [];
}

// Sletter billeder, der ikke længere bruges af nogen fisk.
export async function ryddeFotos() {
  const trips = await db.getAll('trips');
  const brugt = new Set(trips.flatMap((t) => t.catches.flatMap((c) => c.photoIds || [])));
  const alle = await db.getAll('photos');
  for (const p of alle) if (!brugt.has(p.id)) await db.remove('photos', p.id);
}

const urlCache = new Map();
export async function fotoUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const p = await db.get('photos', id);
  if (!p) return null;
  const u = URL.createObjectURL(p.blob);
  urlCache.set(id, u);
  return u;
}

// Gør billedet mindre (maks. 1600 px, JPEG), så det fylder lidt.
export async function komprimer(file, max = 1600) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Billedet kunne ikke gemmes'))), 'image/jpeg', 0.82));
}

// Én linje tekst om en fisk (til lister).
export function fiskTekst(c, t) {
  const dag = c.date && t && c.date !== t.date ? `${ugedag(c.date)} ` : '';
  return `<b>${esc(c.species)}</b>${c.carpType ? ` <span class="muted">(${esc(c.carpType)})</span>` : ''}`
    + `${c.weightKg != null ? ` ${fmt(c.weightKg)} kg` : ''}${c.lengthCm != null ? ` · ${fmt(c.lengthCm, 1)} cm` : ''}`
    + `${c.time ? ` · ${dag}kl. ${esc(c.time)}` : ''}${c.bait ? ` · på ${esc(c.bait)}` : ''}`
    + `${c.flavour || c.colour ? ` (${esc([c.flavour, c.colour].filter(Boolean).join(', '))})` : ''}`
    + `${c.caughtBy ? ` · <span class="tag">👤 ${esc(c.caughtBy)}</span>` : ''}`
    + `${c.photoIds?.length ? ` · <button type="button" class="foto-link" data-galleri="${c.photoIds.join(',')}">📷 ${c.photoIds.length}</button>` : ''}`;
}

// Tilføj billeder til en fisk, der allerede er gemt (fx dage efter).
export async function tilfoejFotos(tripId, catchId, files) {
  const nye = [];
  for (const f of files) {
    try {
      const blob = await komprimer(f);
      const id = uid();
      await db.put('photos', { id, blob, createdAt: new Date().toISOString() });
      nye.push(id);
    } catch { /* ikke et billede */ }
  }
  if (!nye.length) return 0;
  const t = await db.get('trips', tripId);
  const c = t?.catches.find((x) => x.id === catchId);
  if (!c) return 0;
  c.photoIds = [...(c.photoIds || []), ...nye];
  t.updatedAt = new Date().toISOString();
  await db.put('trips', t);
  return nye.length;
}

// Billedgalleri i fuld skærm: bladr med pile, swipe eller tastatur.
export async function visGalleri(kilder, start = 0, erUrl = false) {
  // Med billed-id'er (ikke url'er) kan billederne også slettes herfra.
  let ids = erUrl ? null : [...kilder];
  let urls = erUrl ? [...kilder] : await Promise.all(kilder.map(fotoUrl));
  if (ids) { const ok = urls.map((u, k) => (u ? k : -1)).filter((k) => k >= 0); ids = ok.map((k) => ids[k]); urls = ok.map((k) => urls[k]); }
  if (!urls.length) return;
  let i = Math.min(start, urls.length - 1);
  const ov = document.createElement('div');
  ov.className = 'galleri';
  ov.setAttribute('role', 'dialog');
  ov.innerHTML = `
    <img alt="">
    <button type="button" class="g-luk" aria-label="Luk">✕</button>
    ${ids ? '<button type="button" class="g-slet" aria-label="Slet billede">🗑 Slet</button>' : ''}
    <button type="button" class="g-pil g-forr" aria-label="Forrige">‹</button><button type="button" class="g-pil g-naeste" aria-label="Næste">›</button>
    <div class="g-tal"></div>`;
  const img = ov.querySelector('img');
  const vis = () => {
    img.src = urls[i];
    ov.querySelector('.g-tal').textContent = urls.length > 1 ? `${i + 1} / ${urls.length}` : '';
    ov.querySelectorAll('.g-pil').forEach((b) => { b.hidden = urls.length < 2; });
  };
  const gå = (d) => { i = (i + d + urls.length) % urls.length; vis(); };
  const luk = () => { ov.remove(); removeEventListener('keydown', tast); };
  const tast = (e) => { if (e.key === 'Escape') luk(); if (e.key === 'ArrowLeft') gå(-1); if (e.key === 'ArrowRight') gå(1); };
  ov.querySelector('.g-luk').onclick = luk;
  ov.querySelector('.g-forr').addEventListener('click', () => gå(-1));
  ov.querySelector('.g-naeste').addEventListener('click', () => gå(1));
  ov.querySelector('.g-slet')?.addEventListener('click', async () => {
    if (!confirm('Slet dette billede? Det kan ikke fortrydes.')) return;
    await sletFoto(ids[i]);
    ids.splice(i, 1); urls.splice(i, 1);
    // Opdater siden bagved (samme side tegnes igen)
    dispatchEvent(new HashChangeEvent('hashchange'));
    if (!urls.length) { luk(); return; }
    i = Math.min(i, urls.length - 1);
    vis();
  });
  ov.addEventListener('click', (e) => { if (e.target === ov) luk(); });
  let x0 = null;
  ov.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) gå(dx < 0 ? 1 : -1); x0 = null; });
  addEventListener('keydown', tast);
  document.body.append(ov);
  vis();
}

// Sletter ét billede: fjernes fra fisken, der bruger det, og fra databasen.
export async function sletFoto(id) {
  for (const t of await db.getAll('trips')) {
    let ændret = false;
    for (const c of t.catches) {
      if (c.photoIds?.includes(id)) { c.photoIds = c.photoIds.filter((x) => x !== id); ændret = true; }
    }
    if (ændret) { t.updatedAt = new Date().toISOString(); await db.put('trips', t); }
  }
  await db.remove('photos', id);
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
}

// Alle "📷 3"-knapper i appen åbner galleriet.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-galleri]');
  if (b) { e.preventDefault(); visGalleri(b.dataset.galleri.split(',')); }
});

// Tilbyd at bruge billedets tidspunkt og position.
function visExif(el, x) {
  const box = el.querySelector('.exif-fisk');
  const dele = [];
  if (x.date) dele.push(`taget <b>${datoTekst(x.date)} kl. ${x.time}</b>`);
  if (x.lat != null) dele.push('med <b>📍 position</b>');
  box.innerHTML = `📷 Billedet er ${dele.join(' ')}. <button type="button" class="sm">Brug billedets data</button>`;
  box.hidden = false;
  box.querySelector('button').onclick = () => {
    const tid = el.querySelector('[name=time]');
    if (x.time && tid) { tid.value = x.time; tid.dispatchEvent(new Event('input', { bubbles: true })); }
    if (x.date) el._dato = x.date;
    box.hidden = true;
    el.dispatchEvent(new CustomEvent('brugexif', { detail: x, bubbles: true }));
  };
}
