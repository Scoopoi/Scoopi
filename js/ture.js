// "Ny tur": skema til at registrere en fisketur og dens fangst.
import * as db from './db.js';
import { esc, num, fmt, uid, today, minutes, varighed, datoTekst, STEDTYPER, STEDNAVN, toast } from './util.js';
import { hentManglende, retning, maaneNavn } from './vejr.js';
import { datalister, fiskElement, lasFisk, gemFotos, ryddeFotos, fiskTekst } from './fisk.js';

let editing = null; // id på tur der redigeres
export function retTur(id) { editing = id; location.hash = '#/ture'; }

export async function mount(view) {
  hentManglende().then((n) => { if (n && view.isConnected) mount(view); });
  const trips = (await db.getAll('trips')).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  // Husk position pr. sted
  const posPrSted = {};
  trips.forEach((x) => { if (x.lat != null && !posPrSted[x.place]) posPrSted[x.place] = { lat: x.lat, lon: x.lon }; });
  const t = (editing && trips.find((x) => x.id === editing)) || null;
  if (!t) editing = null;
  let pos = t && t.lat != null ? { lat: t.lat, lon: t.lon } : null;

  view.innerHTML = `
    <form class="card form" id="trip-form" novalidate>
      <h2>${t ? 'Ret tur' : 'Ny tur'}</h2>

      <label>Dato
        <input type="date" name="date" required value="${esc(t?.date || today())}">
      </label>

      <fieldset>
        <legend>Hvor fiskede du?</legend>
        <div class="seg">
          ${STEDTYPER.map(([v, l], i) => `
            <label><input type="radio" name="waterType" value="${v}" ${(t ? t.waterType === v : i === 0) ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
      </fieldset>

      <label>Navn på stedet
        <input type="text" name="place" required list="steder" placeholder="Fx Vallensbæk Sø" value="${esc(t?.place)}" autocomplete="off">
      </label>
      <div class="gps">
        <button type="button" class="ghost sm" id="gps">📍 Brug min position</button>
        <span class="muted small" id="gps-txt"></span>
      </div>

      <div class="row">
        <label>Start
          <input type="time" name="start" required value="${esc(t?.start)}">
        </label>
        <label>Slut
          <input type="time" name="end" value="${esc(t?.end)}">
        </label>
      </div>
      <p class="muted small" id="dur"></p>

      <fieldset>
        <legend>Fik du fisk?</legend>
        <div class="seg">
          <label><input type="radio" name="gotFish" value="ja" ${t && t.catches.length ? 'checked' : ''}><span>Ja</span></label>
          <label><input type="radio" name="gotFish" value="nej" ${t && !t.catches.length ? 'checked' : ''}><span>Nej, ingen fangst</span></label>
        </div>
      </fieldset>

      <div id="fish-wrap" hidden>
        <div id="fish-list"></div>
        <button type="button" class="ghost" id="add-fish">+ Tilføj fisk</button>
      </div>
      ${datalister(trips)}

      <label>Note (valgfri)
        <textarea name="note" rows="2" placeholder="Fx vejr, plads, hvad der virkede">${esc(t?.note)}</textarea>
      </label>

      <p class="error" id="err" hidden></p>
      <div class="actions">
        <button type="submit">${t ? 'Gem ændringer' : 'Gem tur'}</button>
        ${t ? '<button type="button" class="ghost" id="cancel">Annuller</button>' : ''}
      </div>
    </form>

    <section class="card">
      <h2>Mine ture <span class="muted">(${trips.length})</span></h2>
      ${trips.length ? `<ul class="trips">${trips.map(tripItem).join('')}</ul>` : '<p class="muted">Ingen ture endnu.</p>'}
    </section>`;

  const form = view.querySelector('#trip-form');
  const list = form.querySelector('#fish-list');
  const wrap = form.querySelector('#fish-wrap');

  const addFish = (c = {}) => {
    const el = fiskElement(c);
    el.querySelector('.x').onclick = () => { el.remove(); numberFish(); };
    list.append(el);
    numberFish();
  };
  const numberFish = () => list.querySelectorAll('.fish-head b').forEach((b, i) => { b.textContent = `Fisk ${i + 1}`; });

  const syncFish = () => {
    const ja = form.gotFish.value === 'ja';
    wrap.hidden = !ja;
    if (ja && !list.children.length) addFish();
  };
  form.querySelectorAll('input[name=gotFish]').forEach((r) => r.addEventListener('change', syncFish));
  form.querySelector('#add-fish').onclick = () => addFish();
  (t?.catches || []).forEach(addFish);
  syncFish();

  const gpsTxt = form.querySelector('#gps-txt');
  const visPos = () => {
    gpsTxt.textContent = pos ? `Position gemt (${pos.lat.toFixed(4)}, ${pos.lon.toFixed(4)}) – bruges til vejret` : 'Uden position kan vejret ikke hentes.';
  };
  form.place.addEventListener('change', () => {
    if (!pos && posPrSted[form.place.value.trim()]) { pos = posPrSted[form.place.value.trim()]; visPos(); }
  });
  form.querySelector('#gps').onclick = () => {
    if (!navigator.geolocation) { gpsTxt.textContent = 'Din browser kan ikke give position.'; return; }
    gpsTxt.textContent = 'Finder position …';
    navigator.geolocation.getCurrentPosition(
      (p) => { pos = { lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) }; visPos(); },
      () => { gpsTxt.textContent = 'Kunne ikke finde position. Tillad placering for siden.'; },
      { enableHighAccuracy: true, timeout: 15000 });
  };
  visPos();

  const showDur = () => {
    const m = minutes(form.start.value, form.end.value);
    form.querySelector('#dur').textContent = m == null ? '' : `Varighed: ${varighed(m)}`;
  };
  form.start.addEventListener('input', showDur);
  form.end.addEventListener('input', showDur);
  showDur();

  form.addEventListener('input', () => { form.querySelector('#err').hidden = true; });
  form.querySelector('#cancel')?.addEventListener('click', () => { editing = null; mount(view); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('#err');
    const fejl = [];
    if (!form.date.value) fejl.push('dato');
    if (!form.place.value.trim()) fejl.push('navn på stedet');
    if (!form.start.value) fejl.push('starttid');
    if (!form.gotFish.value) fejl.push('om du fik fisk');

    const catches = form.gotFish.value === 'ja' ? [...list.children].map(lasFisk) : [];
    if (form.gotFish.value === 'ja' && !catches.length) fejl.push('mindst én fisk (eller vælg "Nej")');
    if (catches.some((c) => !c.species)) fejl.push('art på hver fisk');

    if (fejl.length) {
      err.textContent = 'Udfyld: ' + fejl.join(', ') + '.';
      err.hidden = false;
      return;
    }
    if (form.gotFish.value === 'ja') for (const el of list.children) await gemFotos(el);
    const now = new Date().toISOString();
    const samePlaceTime = t && pos && t.lat === pos.lat && t.lon === pos.lon && t.date === form.date.value && t.start === form.start.value;
    const trip = {
      id: t?.id || uid(),
      date: form.date.value,
      waterType: form.waterType.value,
      place: form.place.value.trim(),
      start: form.start.value,
      end: form.end.value || null,
      catches,
      note: form.note.value.trim(),
      lat: pos?.lat ?? null,
      lon: pos?.lon ?? null,
      weather: samePlaceTime ? t.weather || null : null,
      createdAt: t?.createdAt || now,
      updatedAt: now,
    };
    await db.put('trips', trip);
    await ryddeFotos();
    editing = null;
    await mount(view);
    toast(t ? 'Turen er rettet' : 'Turen er gemt');
    // Vejret hentes af hentManglende() i mount().
  });

  view.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
    editing = b.dataset.edit;
    mount(view).then(() => scrollTo({ top: 0, behavior: 'smooth' }));
  });
  view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Slet denne tur?')) return;
    await db.remove('trips', b.dataset.del);
    await ryddeFotos();
    if (editing === b.dataset.del) editing = null;
    await mount(view);
    toast('Turen er slettet');
  });
}

function tripItem(t) {
  const type = STEDNAVN[t.waterType] || '';
  const tid = t.end ? `${t.start}–${t.end} (${varighed(minutes(t.start, t.end))})` : `fra ${t.start}`;
  const fangst = t.catches.length
    ? `<ul class="catches">${t.catches.map((c) => `<li>🐟 ${fiskTekst(c)}</li>`).join('')}</ul>`
    : '<p class="muted small">Ingen fangst</p>';
  return `
    <li>
      <div class="trip-top">
        <div><b>${esc(t.place)}</b> <span class="tag">${type}</span><br>
          <span class="muted small">${datoTekst(t.date)} · ${tid}</span></div>
        <div class="trip-btns">
          <button type="button" class="ghost sm" data-edit="${t.id}">Ret</button>
          <button type="button" class="ghost sm danger" data-del="${t.id}">Slet</button>
        </div>
      </div>
      ${t.weather ? `<p class="small muted wx">${vejrTekst(t.weather)}</p>` : t.lat != null ? '<p class="small muted wx">Vejr hentes, når der er net …</p>' : ''}
      ${fangst}
      ${t.note ? `<p class="small note">${esc(t.note)}</p>` : ''}
    </li>`;
}

export function vejrTekst(w) {
  const d = [];
  if (w.tempC != null) d.push(`🌡️ ${fmt(w.tempC, 1)} °C`);
  if (w.trykHpa != null) {
    const a = w.trykAendring12t;
    d.push(`🧭 ${Math.round(w.trykHpa)} hPa${a != null ? ` (${a > 0 ? '+' : ''}${fmt(a, 1)} på 12 t)` : ''}`);
  }
  if (w.vindMs != null) d.push(`💨 ${fmt(w.vindMs, 1)} m/s ${retning(w.vindRetningGrader) || ''}`);
  if (w.skydaekkePct != null) d.push(`☁️ ${w.skydaekkePct} %`);
  if (w.nedboerMm) d.push(`🌧️ ${fmt(w.nedboerMm, 1)} mm`);
  if (w.maane != null) d.push(`🌙 ${maaneNavn(w.maane)}`);
  return d.join(' · ');
}
