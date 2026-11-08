// Drone-analyse: find karper i overfladen på et billede eller en video-frame.
// Alt kører lokalt i browseren. Videoen uploades ikke nogen steder.
import * as db from './db.js';
import { esc, uid, today, datoTekst, toast, fmt } from './util.js';
import { DRONER, parseSRT, vedTid, lasBilledeData, meterPrPixel, pixelTilGps, afstand } from './dji.js';
import * as sokort from './sokort.js';
import { findKarper } from './karpefinder.js';

const MAX_W = 1280; // arbejdsbredde i pixels

let state = null; // { canvas-data, markers, settings ... }
let srt = null; // indlæst .SRT for den aktuelle video
let kilde = null; // { type: 'video'|'billede', bredde, meta }
let fane = 'tael';
let flyvning = null; // { billeder: [{ t, blob, url, w, h, w0, meta, markers }], aktiv }
const STR = [[0, 50, 'Under 50 cm', '#4fc3f7'], [50, 70, '50–70 cm', '#81c784'], [70, 90, '70–90 cm', '#ffb74d'], [90, 999, 'Over 90 cm', '#e57373']];
export const størrelsesKlasse = (cm) => STR.find(([a, b]) => cm >= a && cm < b) || null;
export { STR };
const droneValg = () => { try { return localStorage.getItem('drone-model') || 'mini3pro'; } catch { return 'mini3pro'; } };

export async function mount(view) {
  const trips = await db.getAll('trips');
  const gemte = (await db.getAll('drone')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const gemteSteder = gemte.map((d) => d.place);
  const steder = [...new Set([...trips.map((t) => t.place), ...gemteSteder, 'Vallensbæk Sø', 'Tueholm Sø'].filter(Boolean))];

  view.innerHTML = `
    <div class="seg subtabs">
      <label><input type="radio" name="dfane" value="tael" ${fane === 'tael' ? 'checked' : ''}><span>🔍 Tæl karper</span></label>
      <label><input type="radio" name="dfane" value="kort" ${fane === 'kort' ? 'checked' : ''}><span>🗺️ Søkort</span></label>
    </div>
    <div id="dview"></div>`;
  view.querySelectorAll('input[name=dfane]').forEach((r) => r.onchange = () => { fane = r.value; mount(view); });
  const dv = view.querySelector('#dview');
  if (fane === 'kort') { await sokort.mount(dv, gemte); return; }
  dv.innerHTML = `
    <section class="card">
      <h2>Tæl karper fra drone</h2>
      <p class="muted small">Vælg en drone-video eller et billede. Analysen sker her på enheden, og videoen bliver ikke uploadet. Det virker bedst på PC og med billeder taget lige ovenfra.</p>
      <label class="file-btn">
        <input type="file" id="fil" accept="video/*,image/*,.srt,.SRT" multiple>
        <span>📂 Vælg video eller billede</span>
      </label>
      <label class="file-btn small-file">
        <input type="file" id="srtfil" accept=".srt,.SRT,text/plain,application/x-subrip">
        <span>📄 Tilføj .SRT-fil til videoen (højde og GPS)</span>
      </label>
      <p class="muted small" id="srt-txt">Tip: Slå <b>Video-undertekster</b> til i DJI Fly (kamera-indstillinger), så gemmer dronen en .SRT-fil ved hver video. Flyv med kameraet lige ned (-90°) og 1x zoom.</p>
      <p class="error" id="fil-err" hidden></p>

      <div id="video-wrap" hidden>
        <video id="video" playsinline muted preload="auto"></video>
        <input type="range" id="seek" min="0" max="1000" value="0" aria-label="Spol i videoen">
        <div class="row-btns">
          <span class="muted small" id="tid">0:00</span>
          <button type="button" class="ghost sm" id="back">◀ 1 sek</button>
          <button type="button" class="ghost sm" id="fwd">1 sek ▶</button>
          <button type="button" id="grab">Brug dette billede</button>
        </div>
        <div class="fly">
          <h3>🎬 Gennemgå hele overflyvningen</h3>
          <p class="muted small">Appen tager et billede med jævne mellemrum, leder efter karper og måler dem ud fra højden i .SRT-filen. Bagefter retter du fundene.</p>
          <div class="row-btns">
            <label class="small">Et billede hvert <select id="fly-int"><option value="1">1 sek</option><option value="2" selected>2 sek</option><option value="3">3 sek</option><option value="5">5 sek</option></select></label>
            <button type="button" id="fly-start">▶ Analysér videoen</button>
            <button type="button" class="ghost sm" id="fly-stop" hidden>Stop</button>
          </div>
          <progress id="fly-prog" max="100" value="0" hidden></progress>
          <p class="small" id="fly-txt"></p>
        </div>
      </div>
      <section id="fly-res" hidden></section>
    </section>

    <section class="card" id="ana" hidden>
      <h2>Resultat: <b id="n-sikre">0</b> sikre · <span class="blaa"><b id="n-maaske">0</b> måske</span></h2>
      <p class="muted small">Tallene ved ringene er længden i cm. Appens fund er <span class="blaa"><b>måske</b></span> (blå). Tryk på en markering: <b>måske → sikker → fjernet</b>. Tryk et tomt sted for at tilføje en sikker karpe. <span hidden id="count"></span></p>
      <p class="advarsel" id="for-mange" hidden>⚠️ Meget mange fund. Sæt <b>karpens længde</b> under "Justér søgningen" (træk til den gule ellipse passer med en karpe), eller skriv <b>flyvehøjden</b> under "Målestok og position".</p>
      <div class="row-btns" id="fly-nav" hidden>
        <button type="button" class="ghost sm" id="fly-forr">◀ Forrige</button>
        <span class="small" id="fly-pos"></span>
        <button type="button" class="ghost sm" id="fly-naeste">Næste ▶</button>
      </div>
      <div class="geo" id="geo"></div>
      <div class="sizes" id="sizes"></div>
      <div class="canvas-wrap"><canvas id="cv"></canvas></div>

      <details class="tune">
        <summary>Målestok og position</summary>
        <label>Drone
          <select id="model">${DRONER.map((d) => `<option value="${d.id}" ${d.id === droneValg() ? 'selected' : ''}>${d.navn}</option>`).join('')}</select>
        </label>
        <div class="row">
          <label>Flyvehøjde (m) <input type="text" inputmode="decimal" id="alt" placeholder="Fx 30"></label>
          <label>Retning (° fra nord) <input type="text" inputmode="decimal" id="ret" placeholder="Ukendt"></label>
        </div>
        <p class="muted small">Højde og GPS læses automatisk fra .SRT-filen eller DJI-billedet. Retningen er den vej, toppen af billedet peger. Den bruges til at lægge karperne rigtigt på søkortet.</p>
      </details>

      <details class="tune" open>
        <summary>Justér søgningen</summary>
        <label>Karpens længde på billedet: <b id="len-v"></b>
          <input type="range" id="len" min="8" max="200" value="40">
        </label>
        <p class="muted small">Træk, til den gule ellipse oppe i hjørnet har samme størrelse som en karpe på billedet.</p>
        <label>Følsomhed: <b id="sens-v"></b>
          <input type="range" id="sens" min="1" max="100" value="65">
        </label>
        <div class="seg small-seg">
          <label><input type="radio" name="tone" value="lys" checked><span>Lyse (polfilter)</span></label>
          <label><input type="radio" name="tone" value="mork"><span>Mørke</span></label>
          <label><input type="radio" name="tone" value="begge"><span>Begge</span></label>
        </div>
        <label class="check"><input type="checkbox" id="ingrode" checked> Ignorér grøn grøde</label>
        <label class="check"><input type="checkbox" id="mask"> Vis hvad der blev fundet</label>
        <button type="button" class="ghost sm" id="reset">Find karper igen</button>
      </details>

      <form id="save-form" class="form">
        <div class="row">
          <label>Sted <input type="text" name="place" list="d-steder" placeholder="Fx Vallensbæk Sø" autocomplete="off"></label>
          <label>Dato <input type="date" name="date" value="${today()}"></label>
        </div>
        <datalist id="d-steder">${steder.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
        <label>Note (valgfri) <input type="text" name="note" placeholder="Fx nordlige bred, kl. 14"></label>
        <div class="actions">
          <button type="submit" id="gem-knap">Gem analyse</button>
          <button type="button" class="ghost" id="dl">Hent billede</button>
        </div>
      </form>
    </section>

    <section class="card">
      <h2>Gemte analyser <span class="muted">(${gemte.length})</span></h2>
      ${gemte.length ? `<ul class="drone-list">${gemte.map(item).join('')}</ul>` : '<p class="muted">Ingen endnu.</p>'}
    </section>`;

  bindUpload(dv);
  bindList(dv, gemte, view);
}

function item(d) {
  return `
    <li data-id="${d.id}">
      <img alt="" data-img="${d.id}">
      <div>
        <b>${d.count} karper</b> <span class="muted small">(estimat)</span>${d.geo ? ' <span class="tag">📍 på søkort</span>' : ''}<br>
        <span class="muted small">${esc(d.place || 'Uden sted')} · ${datoTekst(d.date)}</span>
        ${d.note ? `<br><span class="small">${esc(d.note)}</span>` : ''}
        <div class="row-btns"><button type="button" class="ghost sm" data-open="${d.id}">Vis</button>
        <button type="button" class="ghost sm danger" data-del="${d.id}">Slet</button></div>
      </div>
    </li>`;
}

function bindList(view, gemte, root) {
  const urls = [];
  gemte.forEach((d) => {
    const img = view.querySelector(`[data-img="${d.id}"]`);
    if (img && d.image) { const u = URL.createObjectURL(d.image); urls.push(u); img.src = u; }
  });
  view.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => {
    const d = gemte.find((x) => x.id === b.dataset.open);
    const u = URL.createObjectURL(d.image);
    window.open(u, '_blank');
  });
  view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Slet denne analyse?')) return;
    await db.remove('drone', b.dataset.del);
    urls.forEach(URL.revokeObjectURL);
    mount(root);
  });
}

function bindUpload(view) {
  const $ = (s) => view.querySelector(s);
  const video = $('#video');
  const err = $('#fil-err');
  let videoUrl = null;

  const visSrt = () => {
    $('#srt-txt').innerHTML = srt?.length
      ? `✅ SRT indlæst: ${srt.length} målinger, højde ${fmt(srt[0].alt, 1)} m${srt.some((x) => x.yaw != null) ? ', med retning' : ''}.`
      : $('#srt-txt').innerHTML;
  };
  const lasSrt = async (f) => {
    const e = parseSRT(await f.text());
    if (!e.length) { visFejl2('SRT-filen indeholder ingen GPS-data.'); return; }
    srt = e; visSrt();
  };
  const visFejl2 = (msg) => { err.textContent = msg; err.hidden = false; };
  $('#srtfil').onchange = (e) => { if (e.target.files[0]) lasSrt(e.target.files[0]); };
  $('#fil').onchange = async (e) => {
    const filer = [...e.target.files];
    const sf = filer.find((x) => /\.srt$/i.test(x.name));
    const f = filer.find((x) => !/\.srt$/i.test(x.name));
    err.hidden = true;
    if (sf) await lasSrt(sf);
    if (!f) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (f.type.startsWith('image/')) {
      $('#video-wrap').hidden = true;
      const meta = await lasBilledeData(f).catch(() => null);
      const img = new Image();
      img.onload = () => { kilde = { type: 'billede', meta }; analyseFra(view, img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
      img.onerror = () => visFejl('Billedet kunne ikke åbnes.');
      img.src = URL.createObjectURL(f);
    } else {
      if (!sf) { srt = null; $('#srt-txt').innerHTML = 'Har du .SRT-filen til videoen, så tilføj den for højde og GPS.'; }
      videoUrl = URL.createObjectURL(f);
      video.src = videoUrl;
      $('#video-wrap').hidden = false;
      video.onerror = () => visFejl('Videoen kan ikke afspilles i denne browser. DJI-droner optager tit i H.265/HEVC. Prøv Chrome på PC, slå H.264 til i dronen, eller tag et skærmbillede og upload det i stedet.');
      video.onloadeddata = () => { $('#seek').value = 0; visTid(); };
    }
  };
  const visFejl = (msg) => { err.textContent = msg; err.hidden = false; $('#video-wrap').hidden = true; };
  const visTid = () => {
    const t = video.currentTime || 0;
    $('#tid').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} / ${Math.floor((video.duration || 0) / 60)}:${String(Math.floor((video.duration || 0) % 60)).padStart(2, '0')}`;
  };
  $('#seek').oninput = (e) => { if (video.duration) video.currentTime = (e.target.value / 1000) * video.duration; };
  video.ontimeupdate = () => { visTid(); if (video.duration) $('#seek').value = Math.round((video.currentTime / video.duration) * 1000); };
  $('#back').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 1); };
  $('#fwd').onclick = () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 1); };
  $('#grab').onclick = () => {
    if (!video.videoWidth) { visFejl('Videoen er ikke klar endnu.'); return; }
    kilde = { type: 'video', meta: vedTid(srt, video.currentTime), sek: video.currentTime };
    analyseFra(view, video, video.videoWidth, video.videoHeight);
  };
  let stop = false;
  $('#fly-stop').onclick = () => { stop = true; };
  $('#fly-start').onclick = async () => {
    if (!video.videoWidth || !video.duration) { visFejl('Videoen er ikke klar endnu.'); return; }
    stop = false;
    const trin = +$('#fly-int').value, prog = $('#fly-prog'), txt = $('#fly-txt');
    $('#fly-start').disabled = true; $('#fly-stop').hidden = false; prog.hidden = false;
    if (!srt) txt.textContent = 'Uden .SRT-fil kender appen ikke højden – størrelser kræver, at du skriver flyvehøjden bagefter.';
    flyvning = { billeder: [] };
    const tider = []; for (let t = 0.5; t < video.duration; t += trin) tider.push(t);
    const w0 = video.videoWidth, h0 = video.videoHeight, sc = Math.min(1, MAX_W / w0);
    const w = Math.round(w0 * sc), h = Math.round(h0 * sc);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const model = DRONER.find((d) => d.id === droneValg()) || DRONER[0];
    const manuelHøjde = parseFloat(String(view.querySelector('#alt')?.value || '').replace(',', '.'));
    for (let k = 0; k < tider.length && !stop; k++) {
      const t = tider[k];
      await new Promise((ok) => { video.onseeked = ok; video.currentTime = t; });
      ctx.drawImage(video, 0, 0, w, h);
      const meta = vedTid(srt, t);
      const alt = meta?.alt ?? (Number.isFinite(manuelHøjde) ? manuelHøjde : null);
      const mPrPx = alt ? meterPrPixel(alt, model.hfov, w0) / sc : null;
      const len = mPrPx ? Math.max(8, Math.min(200, Math.round(0.65 / mPrPx))) : +view.querySelector('#len').value;
      const res = findKarper(ctx.getImageData(0, 0, w, h).data, w, h, {
        len, sens: +view.querySelector('#sens').value, tone: view.querySelector('input[name=tone]:checked').value,
        ingrode: view.querySelector('#ingrode').checked, metode: 'toppe', afstand: 0.55,
      });
      const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.8));
      flyvning.billeder.push({ t, blob, url: URL.createObjectURL(blob), w, h, w0, meta, alt, len, mPrPx,
        markers: res.markers.map((m) => ({ ...m, status: 'maaske', cm: mPrPx ? Math.round(m.lengthPx * mPrPx * 100) : null })) });
      prog.value = Math.round(((k + 1) / tider.length) * 100);
      txt.textContent = `Billede ${k + 1} af ${tider.length} · ${flyvning.billeder.reduce((s2, b) => s2 + b.markers.length, 0)} mulige karper indtil nu`;
      await new Promise((ok) => setTimeout(ok, 0)); // lad skærmen opdatere
    }
    $('#fly-start').disabled = false; $('#fly-stop').hidden = true; prog.hidden = true;
    txt.textContent = stop ? 'Stoppet. Du kan rette de billeder, der nåede at blive analyseret.' : 'Færdig! Gå billederne igennem nedenfor.';
    tegnFlyResultat(view);
    if (flyvning.billeder.length) visFlyBillede(view, 0);
  };
}

// ---------- Overflyvning ----------

function visFlyBillede(view, i) {
  if (!flyvning?.billeder[i]) return;
  const b = flyvning.billeder[i];
  const img = new Image();
  img.onload = () => {
    kilde = { type: 'video', meta: b.meta, sek: b.t };
    const alt = view.querySelector('#alt'); if (b.alt != null) alt.value = fmt(b.alt, 1);
    if (b.len) view.querySelector('#len').value = b.len;
    analyseFra(view, img, b.w0, b.h * (b.w0 / b.w), { idx: i, markers: b.markers });
    view.querySelector('#ana').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  img.src = b.url;
}

// Fisk set på flere billeder tælles kun én gang (når der er GPS): inden for 1,5 m
function samletTal() {
  const alle = [];
  let medGps = true;
  for (const b of flyvning.billeder) {
    const geo = b.mPrPx && b.meta?.lat != null ? { lat: b.meta.lat, lon: b.meta.lon, mPrPx: b.mPrPx, retning: b.meta.retning } : null;
    if (!geo) medGps = false;
    for (const m of b.markers) alle.push({ ...m, ...(geo ? pixelTilGps(m.x, m.y, b.w, b.h, geo) : {}), billede: b });
  }
  if (!medGps) return { sikre: tæl('sikker', alle), maaske: tæl('maaske', alle), dubletter: null, alle };
  const unikke = [];
  let dubletter = 0;
  for (const m of alle) {
    const twin = unikke.find((u) => u.billede !== m.billede && afstand(u, m) < 1.5);
    if (twin) { dubletter += m.n; if (m.status === 'sikker') twin.status = 'sikker'; continue; }
    unikke.push({ ...m });
  }
  return { sikre: tæl('sikker', unikke), maaske: tæl('maaske', unikke), dubletter, alle: unikke };
}

function tegnFlyResultat(view) {
  const el = view?.querySelector('#fly-res');
  if (!el || !flyvning?.billeder.length) return;
  const st = samletTal();
  const cm = st.alle.filter((m) => m.cm != null).map((m) => m.cm);
  el.hidden = false;
  el.className = 'card';
  el.innerHTML = `
    <h2>🎬 Overflyvning: <b>${st.sikre}</b> sikre · <span class="blaa"><b>${st.maaske}</b> måske</span></h2>
    <p class="muted small">${flyvning.billeder.length} billeder. ${st.dubletter != null ? `${st.dubletter} fund var med på flere billeder og er kun talt én gang.` : 'Uden GPS (.SRT-fil) kan fisk, der er med på flere billeder, ikke fjernes som dubletter – tallet kan være for højt.'}${cm.length ? ` Størrelse: gns. ${Math.round(cm.reduce((a, b) => a + b, 0) / cm.length)} cm.` : ''}</p>
    <div class="fly-grid">${flyvning.billeder.map((b, i) => `
      <button type="button" class="fly-b ${state?.flyIdx === i ? 'aktiv' : ''}" data-fb="${i}">
        <img src="${b.url}" alt="">
        <span>${Math.floor(b.t / 60)}:${String(Math.floor(b.t % 60)).padStart(2, '0')} · ${tæl('sikker', b.markers)}✓ ${tæl('maaske', b.markers)}?</span>
      </button>`).join('')}</div>`;
  el.querySelectorAll('[data-fb]').forEach((k) => k.onclick = () => visFlyBillede(view, +k.dataset.fb));
}

async function gemFlyvning(view, f) {
  const cv = document.createElement('canvas');
  let n = 0;
  for (const b of flyvning.billeder) {
    const geo = b.mPrPx && b.meta?.lat != null ? { lat: b.meta.lat, lon: b.meta.lon, alt: b.alt, mPrPx: b.mPrPx, retning: b.meta.retning ?? null } : null;
    await db.put('drone', {
      id: uid(), date: f.date.value || today(), place: f.place.value.trim(), note: f.note.value.trim(),
      count: b.markers.reduce((s2, m) => s2 + m.n, 0), sikre: tæl('sikker', b.markers), maaske: tæl('maaske', b.markers),
      markers: b.markers.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), n: m.n, manual: !!m.manual, status: m.status || 'sikker', cm: m.cm ?? null, ...(geo ? pixelTilGps(m.x, m.y, b.w, b.h, geo) : {}) })),
      geo: geo ? { ...geo, hjoerner: [[0, 0], [b.w, 0], [b.w, b.h], [0, b.h]].map(([x, y]) => pixelTilGps(x, y, b.w, b.h, geo)) } : null,
      kilde: { type: 'video', sek: b.t, flyvning: true }, width: b.w, height: b.h, image: b.blob, createdAt: new Date().toISOString(),
    });
    n++;
  }
  toast(`${n} billeder gemt${flyvning.billeder.some((b) => b.meta?.lat != null) ? ' – og lagt på søkortet' : ''}`);
  flyvning.billeder.forEach((b) => URL.revokeObjectURL(b.url));
  flyvning = null; state = null;
  mount(view.closest('main') || view);
}

// ---------- Analyse ----------

function analyseFra(view, source, w0, h0, forvalg = null) {
  const $ = (s) => view.querySelector(s);
  const scale = Math.min(1, MAX_W / w0);
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const base = document.createElement('canvas');
  base.width = w; base.height = h;
  const bctx = base.getContext('2d', { willReadFrequently: true });
  bctx.drawImage(source, 0, 0, w, h);
  const pixels = bctx.getImageData(0, 0, w, h);

  state = { base, pixels, w, h, w0, markers: [], mask: null, settings: null, geo: null, flyIdx: forvalg?.idx ?? null };
  $('#ana').hidden = false;
  const meta = kilde?.meta || null;
  $('#alt').value = meta?.alt != null ? fmt(meta.alt, 1) : $('#alt').value;
  $('#ret').value = meta?.retning != null ? Math.round(meta.retning) : '';
  const opdaterGeo = (saetLaengde) => {
    const model = DRONER.find((d) => d.id === $('#model').value) || DRONER[0];
    const alt = parseFloat(String($('#alt').value).replace(',', '.'));
    const ret = parseFloat(String($('#ret').value).replace(',', '.'));
    const mPrPx = Number.isFinite(alt) && alt > 0 ? meterPrPixel(alt, model.hfov, w0) / scale : null; // pr. arbejdspixel
    state.mPrPx = mPrPx;
    state.geo = mPrPx && meta?.lat != null ? { lat: meta.lat, lon: meta.lon, alt, mPrPx, retning: Number.isFinite(ret) ? ret : null } : null;
    if (saetLaengde && mPrPx) $('#len').value = Math.max(8, Math.min(200, Math.round(0.65 / mPrPx)));
    const dele = [];
    dele.push(mPrPx ? `📏 ${fmt(mPrPx * 100, 2)} cm pr. pixel (højde ${fmt(alt, 1)} m)` : '📏 Ingen højde: angiv flyvehøjden under "Målestok og position" for at få karpernes længde i cm.');
    dele.push(meta?.lat != null ? `📍 GPS ${meta.lat.toFixed(5)}, ${meta.lon.toFixed(5)}` : '📍 Ingen GPS (kan ikke lægges på søkortet)');
    if (meta?.lat != null) dele.push(Number.isFinite(ret) ? `🧭 Retning ${Math.round(ret)}°${meta?.retningKilde && Math.round(meta.retning) === Math.round(ret) ? ` (fra ${meta.retningKilde})` : ''}` : '🧭 Retning ukendt: indtast den, ellers antages nord opad');
    if (meta?.pitch != null && meta.pitch > -80) dele.push(`⚠️ Kameraet hælder (${Math.round(meta.pitch)}°). Størrelser og positioner bliver upræcise.`);
    if (meta?.zoom != null && meta.zoom > 1.05) dele.push(`⚠️ Zoom ${fmt(meta.zoom, 1)}x. Målestokken passer kun ved 1x.`);
    $('#geo').innerHTML = dele.map((d) => `<div>${d}</div>`).join('');
  };
  $('#model').onchange = () => { try { localStorage.setItem('drone-model', $('#model').value); } catch {} opdaterGeo(true); run(); };
  $('#alt').onchange = () => { opdaterGeo(true); run(); };
  $('#ret').onchange = () => { opdaterGeo(false); };
  opdaterGeo(true);
  const cv = $('#cv');
  cv.width = w; cv.height = h;

  const settings = () => ({
    len: +$('#len').value,
    sens: +$('#sens').value,
    tone: view.querySelector('input[name=tone]:checked').value,
    ingrode: $('#ingrode').checked,
  });
  let calib = false;
  let run = () => {
    const s = settings();
    $('#len-v').textContent = `${s.len} px`;
    $('#sens-v').textContent = `${s.sens}`;
    const res = findKarper(pixels.data, w, h, { ...s, metode: 'toppe', afstand: 0.55 });
    state.mask = res.mask;
    state.markers = res.markers.map((m) => ({ ...m, status: 'maaske', cm: state.mPrPx ? Math.round(m.lengthPx * state.mPrPx * 100) : null }));
    state.settings = s;
    draw(view, calib);
  };
  let timer;
  const later = () => { clearTimeout(timer); timer = setTimeout(run, 120); };
  $('#len').oninput = () => { calib = true; $('#len-v').textContent = `${$('#len').value} px`; draw(view, true); later(); };
  $('#len').onchange = () => { calib = false; draw(view, false); };
  $('#sens').oninput = later;
  view.querySelectorAll('input[name=tone]').forEach((r) => r.onchange = run);
  $('#ingrode').onchange = run;
  $('#mask').onchange = () => draw(view, false);
  $('#reset').onclick = run;

  cv.onclick = (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * w;
    const y = ((e.clientY - r.top) / r.height) * h;
    const rad = Math.max(10, state.settings.len * 0.6) * Math.max(1, w / r.width);
    const i = state.markers.findIndex((m) => Math.hypot(m.x - x, m.y - y) < rad);
    // måske → sikker → fjernet; tomt sted → ny sikker karpe
    if (i >= 0) { const m = state.markers[i]; if (m.status === 'maaske') m.status = 'sikker'; else state.markers.splice(i, 1); }
    else state.markers.push({ x, y, n: 1, manual: true, status: 'sikker', cm: state.mPrPx ? Math.round(state.settings.len * state.mPrPx * 100) : null });
    gemFlyBillede();
    draw(view, false);
  };

  $('#save-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    if (state.flyIdx != null) { await gemFlyvning(view, f); return; }
    const blob = await billedeBlob();
    await db.put('drone', {
      id: uid(),
      date: f.date.value || today(),
      place: f.place.value.trim(),
      note: f.note.value.trim(),
      count: antal(),
      sikre: tæl('sikker'), maaske: tæl('maaske'),
      markers: state.markers.map((m) => ({
        x: Math.round(m.x), y: Math.round(m.y), n: m.n, manual: !!m.manual, status: m.status || 'sikker', cm: m.cm ?? null,
        ...(state.geo ? pixelTilGps(m.x, m.y, w, h, state.geo) : {}),
      })),
      geo: state.geo ? { ...state.geo, hjoerner: [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => pixelTilGps(x, y, w, h, state.geo)) } : null,
      kilde: kilde ? { type: kilde.type, sek: kilde.sek ?? null } : null,
      settings: state.settings,
      width: w, height: h,
      image: blob,
      createdAt: new Date().toISOString(),
    });
    toast(state.geo ? 'Gemt – og lagt på søkortet' : 'Analysen er gemt');
    state = null;
    mount(view.closest('main') || view);
  };
  $('#dl').onclick = async () => {
    const blob = await billedeBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `karper-${today()}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (forvalg) {
    state.settings = settings();
    $('#len-v').textContent = `${state.settings.len} px`; $('#sens-v').textContent = `${state.settings.sens}`;
    state.markers = forvalg.markers.map((m) => ({ ...m }));
    draw(view, false);
  } else run();
  // Gennemgang af en overflyvning: forrige/næste billede
  const nav = $('#fly-nav');
  nav.hidden = state.flyIdx == null;
  if (state.flyIdx != null) {
    $('#fly-pos').textContent = `Billede ${state.flyIdx + 1} af ${flyvning.billeder.length}`;
    $('#fly-forr').disabled = state.flyIdx === 0;
    $('#fly-naeste').disabled = state.flyIdx >= flyvning.billeder.length - 1;
    $('#fly-forr').onclick = () => visFlyBillede(view, state.flyIdx - 1);
    $('#fly-naeste').onclick = () => visFlyBillede(view, state.flyIdx + 1);
    $('#gem-knap').textContent = '💾 Gem hele overflyvningen';
  } else $('#gem-knap').textContent = 'Gem analyse';
  // Når søgningen køres igen på et billede fra overflyvningen, gemmes de nye fund på billedet
  const kørOgGem = run; run = () => { kørOgGem(); gemFlyBillede(); };
  if (!forvalg) $('#ana').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Gem rettelserne på det aktuelle billede i overflyvningen
function gemFlyBillede() {
  if (state?.flyIdx == null || !flyvning) return;
  flyvning.billeder[state.flyIdx].markers = state.markers.map((m) => ({ ...m }));
  tegnFlyResultat(document.querySelector('#dview'));
}

const antal = () => state.markers.reduce((s, m) => s + m.n, 0);
const tæl = (status, liste = state.markers) => liste.filter((m) => (m.status || 'sikker') === status).reduce((s, m) => s + m.n, 0);

function billedeBlob() {
  return new Promise((res) => document.querySelector('#cv').toBlob(res, 'image/jpeg', 0.85));
}

function draw(view, calib) {
  const cv = view.querySelector('#cv');
  if (!cv || !state) return;
  const ctx = cv.getContext('2d');
  const { w, h } = state;
  ctx.drawImage(state.base, 0, 0);
  if (view.querySelector('#mask').checked && state.mask) {
    const ov = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < state.mask.length; i++) {
      if (state.mask[i]) { ov.data[i * 4] = 255; ov.data[i * 4 + 1] = 40; ov.data[i * 4 + 2] = 200; }
    }
    ctx.putImageData(ov, 0, 0);
  }
  const len = +view.querySelector('#len').value;
  const r = Math.max(7, len * 0.22); // lille ring midt på fisken, så tætte stimer kan ses
  const lw = Math.max(2, w / 500);
  ctx.lineWidth = lw;
  ctx.font = `bold ${Math.max(11, Math.min(18, Math.round(len * 0.14)))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  state.markers.forEach((m, i) => {
    const kl = m.cm != null ? størrelsesKlasse(m.cm) : null;
    const maaske = m.status === 'maaske';
    ctx.strokeStyle = maaske ? '#4fc3f7' : kl ? kl[3] : '#f2c14e';
    ctx.setLineDash(maaske ? [6, 5] : []);
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * Math.sqrt(m.n), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = m.n > 1 ? `~${m.n}` : m.cm != null ? `${m.cm}` : '';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    if (label) {
      ctx.strokeText(label, m.x, m.y - r * Math.sqrt(m.n) - 8);
      ctx.fillStyle = maaske ? '#bfe9ff' : '#fff';
      ctx.fillText(label, m.x, m.y - r * Math.sqrt(m.n) - 8);
    }
    ctx.lineWidth = lw;
  });
  if (calib) {
    ctx.save();
    ctx.translate(16 + len / 2, 16 + len / 4);
    ctx.fillStyle = 'rgba(242,193,78,.35)';
    ctx.strokeStyle = '#f2c14e';
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, len / 5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  view.querySelector('#count').textContent = antal();
  view.querySelector('#n-sikre').textContent = tæl('sikker');
  view.querySelector('#n-maaske').textContent = tæl('maaske');
  // Urimeligt mange fund betyder næsten altid, at karpens længde på billedet er sat forkert
  const adv = view.querySelector('#for-mange');
  if (adv) adv.hidden = !(tæl('maaske') > 60 && !state.mPrPx);
  const med = state.markers.filter((m) => m.cm != null);
  view.querySelector('#sizes').innerHTML = med.length
    ? STR.map(([a, b, navn, farve]) => { const n = med.filter((m) => m.cm >= a && m.cm < b).length; return n ? `<span class="chip"><i class="sw" style="background:${farve}"></i>${navn}: <b>${n}</b></span>` : ''; }).join('') +
      `<span class="chip">Gns.: <b>${Math.round(med.reduce((s, m) => s + m.cm, 0) / med.length)} cm</b></span>`
    : '';
}

