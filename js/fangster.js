// "Fangster": skriv hurtigt én fangst ind, og se alle dine fisk samlet.
import * as db from './db.js';
import { esc, uid, today, datoTekst, STEDTYPER, toast, iTur, slutDato, nu, ugedag } from './util.js';
import { hentManglende } from './vejr.js';
import { datalister, fiskElement, lasFisk, gemFotos, ryddeFotos, fiskTekst, fotoUrl, tilfoejFotos, visGalleri } from './fisk.js';
import { retTur } from './ture.js';

let artFilter = 'alle';

// Finder en tur samme sted, som fangstens dato og klokkeslæt ligger inden for (også over midnat og flere døgn).
function findTur(trips, place, date, time) {
  const p = place.trim().toLowerCase();
  const passer = trips.filter((x) => x.place.trim().toLowerCase() === p && x.start && iTur(x, date, time));
  return passer.find((x) => x.igang) || passer[0]; // igangværende tur først
}

export async function mount(view) {
  hentManglende().then((n) => { if (n && view.isConnected) mount(view); });
  const trips = await db.getAll('trips');
  const posPrSted = {};
  trips.forEach((x) => { if (x.lat != null && !posPrSted[x.place]) posPrSted[x.place] = { lat: x.lat, lon: x.lon }; });
  const igang = trips.filter((x) => x.igang && !x.end).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0];
  const sidst = igang || [...trips].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
  let pos = null;

  const fisk = trips.flatMap((t) => t.catches.map((c) => ({ c, t })))
    .sort((a, b) => (((b.c.date || b.t.date) + (b.c.time || b.t.start)).localeCompare((a.c.date || a.t.date) + (a.c.time || a.t.start))));
  const arter = [...new Set(fisk.map((f) => f.c.species))].sort((a, b) => a.localeCompare(b, 'da'));
  if (artFilter !== 'alle' && !arter.includes(artFilter)) artFilter = 'alle';
  const vist = fisk.filter((f) => artFilter === 'alle' || f.c.species === artFilter);

  view.innerHTML = `
    <form class="card form" id="catch-form" novalidate>
      <h2>Ny fangst</h2>
      ${igang ? `<p class="igang-note">🟢 Igangværende tur: <b>${esc(igang.place)}</b> fra ${ugedag(igang.date)} kl. ${igang.start}</p>` : ''}
      <div class="row">
        <label>Dato <input type="date" name="date" value="${today()}"></label>
        <label>Kl. <input type="time" name="time" value="${nu()}"></label>
      </div>
      <label>Sted
        <input type="text" name="place" list="steder" placeholder="Fx Vallensbæk Sø" value="${esc(sidst?.place || '')}" autocomplete="off">
      </label>
      <div class="seg" id="wt">
        ${STEDTYPER.map(([v, l]) => `<label><input type="radio" name="waterType" value="${v}" ${(sidst?.waterType || 'so') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>
      <div class="gps">
        <button type="button" class="ghost sm" id="gps">📍 Brug min position</button>
        <span class="muted small" id="gps-txt"></span>
      </div>
      <div id="fisk-her"></div>
      <label>Note (valgfri) <textarea name="note" rows="2" placeholder="Fx plads, dybde, hvordan den tog"></textarea></label>
      <p class="muted small" id="tur-txt"></p>
      <p class="error" id="err" hidden></p>
      <div class="actions"><button type="submit">Gem fangst</button></div>
      ${datalister(trips)}
    </form>

    <section class="card">
      <div class="trip-top">
        <h2>Alle fangster <span class="muted">(${vist.length})</span></h2>
        ${arter.length > 1 ? `<select id="art" class="mini-select"><option value="alle">Alle arter</option>${arter.map((a) => `<option ${a === artFilter ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>` : ''}
      </div>
      ${vist.length ? `<ul class="catch-list">${vist.map(({ c, t }) => `
        <li>
          <div class="cimg" data-foto="${c.photoIds?.[0] || ''}" data-alle="${(c.photoIds || []).join(',')}">${c.photoIds?.length ? '' : '🐟'}</div>
          <div class="cbody">
            <div>${fiskTekst(c)}</div>
            <div class="muted small">${esc(t.place)} · ${datoTekst(c.date || t.date)}</div>
            <div class="row-btns">
              <label class="foto-senere"><input type="file" accept="image/*" multiple data-tur="${t.id}" data-fisk="${c.id}"><span>📷 Tilføj billeder</span></label>
              <button type="button" class="ghost sm" data-ret="${t.id}">Ret</button>
              <button type="button" class="ghost sm danger" data-slet="${t.id}|${c.id}">Slet</button>
            </div>
          </div>
        </li>`).join('')}</ul>` : '<p class="muted">Ingen fangster endnu.</p>'}
    </section>`;

  const form = view.querySelector('#catch-form');
  const fel = fiskElement({}, { fjernbar: false, titel: 'Fisken' });
  fel.querySelector('.tidrow').remove(); // tidspunkt står øverst
  view.querySelector('#fisk-her').append(fel);

  // Position
  const gpsTxt = form.querySelector('#gps-txt');
  const visPos = () => { gpsTxt.textContent = pos ? `Position gemt (${pos.lat.toFixed(4)}, ${pos.lon.toFixed(4)})` : 'Bruges til vejret.'; };
  const stedPos = () => { const p = posPrSted[form.place.value.trim()]; if (p) { pos = p; visPos(); } };
  form.place.addEventListener('change', stedPos);
  stedPos(); visPos();
  form.querySelector('#gps').onclick = () => {
    if (!navigator.geolocation) { gpsTxt.textContent = 'Din browser kan ikke give position.'; return; }
    gpsTxt.textContent = 'Finder position …';
    navigator.geolocation.getCurrentPosition(
      (p) => { pos = { lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) }; visPos(); },
      () => { gpsTxt.textContent = 'Kunne ikke finde position. Tillad placering for siden.'; },
      { enableHighAccuracy: true, timeout: 15000 });
  };

  // Vis om fangsten kommer på en eksisterende tur
  const turTxt = () => {
    const f = form.place.value.trim() && form.time.value ? findTur(trips, form.place.value, form.date.value, form.time.value) : null;
    form.querySelector('#tur-txt').textContent = f
      ? `Fangsten lægges på din tur ${datoTekst(f.date)} kl. ${f.start}${f.end ? ` til ${slutDato(f) !== f.date ? datoTekst(slutDato(f)) + ' ' : ''}kl. ${f.end}` : ''}.`
      : 'Der oprettes en ny tur til fangsten. Du kan sætte sluttid på under "Ny tur".';
  };
  ['input', 'change'].forEach((ev) => form.addEventListener(ev, () => { form.querySelector('#err').hidden = true; turTxt(); }));
  turTxt();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fejl = [];
    if (!form.date.value) fejl.push('dato');
    if (!form.time.value) fejl.push('klokkeslæt');
    if (!form.place.value.trim()) fejl.push('sted');
    const c = lasFisk(fel);
    if (!c.species) fejl.push('art');
    if (fejl.length) { const er = form.querySelector('#err'); er.textContent = 'Udfyld: ' + fejl.join(', ') + '.'; er.hidden = false; return; }
    c.time = form.time.value;
    c.date = form.date.value;
    await gemFotos(fel);
    c.photoIds = [...fel._fotoIds];
    const noteTxt = form.note.value.trim();
    const now = new Date().toISOString();
    const tur = findTur(await db.getAll('trips'), form.place.value, form.date.value, form.time.value);
    if (tur) {
      tur.catches.push(c);
      if (noteTxt) tur.note = [tur.note, noteTxt].filter(Boolean).join('\n');
      if (tur.lat == null && pos) { tur.lat = pos.lat; tur.lon = pos.lon; }
      tur.updatedAt = now;
      await db.put('trips', tur);
    } else {
      await db.put('trips', {
        id: uid(), date: form.date.value, waterType: form.waterType.value, place: form.place.value.trim(),
        start: form.time.value, end: null, catches: [c], note: noteTxt,
        lat: pos?.lat ?? null, lon: pos?.lon ?? null, weather: null, createdAt: now, updatedAt: now,
      });
    }
    await mount(view);
    toast('Fangsten er gemt 🎣');
  });

  // Liste
  view.querySelector('#art')?.addEventListener('change', (e) => { artFilter = e.target.value; mount(view); });
  view.querySelectorAll('[data-foto]').forEach(async (d) => {
    if (!d.dataset.foto) return;
    const u = await fotoUrl(d.dataset.foto);
    const ids = d.dataset.alle.split(',').filter(Boolean);
    if (u) {
      d.innerHTML = `<img src="${u}" alt="">${ids.length > 1 ? `<span class="antal">${ids.length}</span>` : ''}`;
      d.onclick = () => visGalleri(ids);
    }
  });
  view.querySelectorAll('[data-ret]').forEach((b) => b.onclick = () => retTur(b.dataset.ret));
  view.querySelectorAll('.foto-senere input').forEach((inp) => inp.onchange = async () => {
    if (!inp.files.length) return;
    inp.nextElementSibling.textContent = 'Gemmer …';
    const n = await tilfoejFotos(inp.dataset.tur, inp.dataset.fisk, [...inp.files]);
    await mount(view);
    toast(n ? `${n} billede${n > 1 ? 'r' : ''} tilføjet` : 'Ingen billeder tilføjet');
  });
  view.querySelectorAll('[data-slet]').forEach((b) => b.onclick = async () => {
    if (!confirm('Slet denne fangst?')) return;
    const [tid, cid] = b.dataset.slet.split('|');
    const t = await db.get('trips', tid);
    t.catches = t.catches.filter((x) => x.id !== cid);
    t.updatedAt = new Date().toISOString();
    await db.put('trips', t);
    await ryddeFotos();
    await mount(view);
    toast('Fangsten er slettet');
  });
}
