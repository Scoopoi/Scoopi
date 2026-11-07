// Drone-analyse: find karper i overfladen på et billede eller en video-frame.
// Alt kører lokalt i browseren. Videoen uploades ikke nogen steder.
import * as db from './db.js';
import { esc, uid, today, datoTekst, toast } from './util.js';

const MAX_W = 1280; // arbejdsbredde i pixels
const GRØDE = 0.3; // grænse for normaliseret Excess Green

let state = null; // { canvas-data, markers, settings ... }

export async function mount(view) {
  const trips = await db.getAll('trips');
  const steder = [...new Set(trips.map((t) => t.place).filter(Boolean))];
  const gemte = (await db.getAll('drone')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  view.innerHTML = `
    <section class="card">
      <h2>Tæl karper fra drone</h2>
      <p class="muted small">Vælg en drone-video eller et billede. Analysen sker her på enheden, og videoen bliver ikke uploadet. Det virker bedst på PC og med billeder taget lige ovenfra.</p>
      <label class="file-btn">
        <input type="file" id="fil" accept="video/*,image/*">
        <span>📂 Vælg video eller billede</span>
      </label>
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
      </div>
    </section>

    <section class="card" id="ana" hidden>
      <h2>Resultat: <span id="count">0</span> karper <span class="soon">Estimat</span></h2>
      <p class="muted small">Tallet er et <b>forslag</b>. Tryk på billedet for at <b>tilføje</b> en karpe, eller tryk på en markering for at <b>fjerne</b> den.</p>
      <div class="canvas-wrap"><canvas id="cv"></canvas></div>

      <details class="tune" open>
        <summary>Justér søgningen</summary>
        <label>Karpens længde på billedet: <b id="len-v"></b>
          <input type="range" id="len" min="8" max="200" value="40">
        </label>
        <p class="muted small">Træk, til den gule ellipse oppe i hjørnet har samme størrelse som en karpe på billedet.</p>
        <label>Følsomhed: <b id="sens-v"></b>
          <input type="range" id="sens" min="1" max="100" value="55">
        </label>
        <div class="seg small-seg">
          <label><input type="radio" name="tone" value="begge" checked><span>Mørke + lyse</span></label>
          <label><input type="radio" name="tone" value="mork"><span>Kun mørke</span></label>
          <label><input type="radio" name="tone" value="lys"><span>Kun lyse</span></label>
        </div>
        <label class="check"><input type="checkbox" id="ingrode" checked> Ignorér grøn grøde</label>
        <label class="check"><input type="checkbox" id="mask"> Vis hvad der blev fundet</label>
        <button type="button" class="ghost sm" id="reset">Find karper igen</button>
      </details>

      <form id="save-form" class="form">
        <div class="row">
          <label>Sted <input type="text" name="place" list="d-steder" placeholder="Fx Damhussøen" autocomplete="off"></label>
          <label>Dato <input type="date" name="date" value="${today()}"></label>
        </div>
        <datalist id="d-steder">${steder.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
        <label>Note (valgfri) <input type="text" name="note" placeholder="Fx nordlige bred, kl. 14"></label>
        <div class="actions">
          <button type="submit">Gem analyse</button>
          <button type="button" class="ghost" id="dl">Hent billede</button>
        </div>
      </form>
    </section>

    <section class="card">
      <h2>Gemte analyser <span class="muted">(${gemte.length})</span></h2>
      ${gemte.length ? `<ul class="drone-list">${gemte.map(item).join('')}</ul>` : '<p class="muted">Ingen endnu.</p>'}
    </section>`;

  bindUpload(view);
  bindList(view, gemte);
}

function item(d) {
  return `
    <li data-id="${d.id}">
      <img alt="" data-img="${d.id}">
      <div>
        <b>${d.count} karper</b> <span class="muted small">(estimat)</span><br>
        <span class="muted small">${esc(d.place || 'Uden sted')} · ${datoTekst(d.date)}</span>
        ${d.note ? `<br><span class="small">${esc(d.note)}</span>` : ''}
        <div class="row-btns"><button type="button" class="ghost sm" data-open="${d.id}">Vis</button>
        <button type="button" class="ghost sm danger" data-del="${d.id}">Slet</button></div>
      </div>
    </li>`;
}

function bindList(view, gemte) {
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
    mount(view);
  });
}

function bindUpload(view) {
  const $ = (s) => view.querySelector(s);
  const video = $('#video');
  const err = $('#fil-err');
  let videoUrl = null;

  $('#fil').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    err.hidden = true;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (f.type.startsWith('image/')) {
      $('#video-wrap').hidden = true;
      const img = new Image();
      img.onload = () => { analyseFra(view, img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
      img.onerror = () => visFejl('Billedet kunne ikke åbnes.');
      img.src = URL.createObjectURL(f);
    } else {
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
    analyseFra(view, video, video.videoWidth, video.videoHeight);
  };
}

// ---------- Analyse ----------

function analyseFra(view, source, w0, h0) {
  const $ = (s) => view.querySelector(s);
  const scale = Math.min(1, MAX_W / w0);
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const base = document.createElement('canvas');
  base.width = w; base.height = h;
  const bctx = base.getContext('2d', { willReadFrequently: true });
  bctx.drawImage(source, 0, 0, w, h);
  const pixels = bctx.getImageData(0, 0, w, h);

  state = { base, pixels, w, h, markers: [], mask: null, settings: null };
  $('#ana').hidden = false;
  const cv = $('#cv');
  cv.width = w; cv.height = h;

  const settings = () => ({
    len: +$('#len').value,
    sens: +$('#sens').value,
    tone: view.querySelector('input[name=tone]:checked').value,
    ingrode: $('#ingrode').checked,
  });
  let calib = false;
  const run = () => {
    const s = settings();
    $('#len-v').textContent = `${s.len} px`;
    $('#sens-v').textContent = `${s.sens}`;
    const res = detect(pixels, w, h, s);
    state.mask = res.mask;
    state.markers = res.markers;
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
    if (i >= 0) state.markers.splice(i, 1);
    else state.markers.push({ x, y, n: 1, manual: true });
    draw(view, false);
  };

  $('#save-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const blob = await billedeBlob();
    await db.put('drone', {
      id: uid(),
      date: f.date.value || today(),
      place: f.place.value.trim(),
      note: f.note.value.trim(),
      count: antal(),
      markers: state.markers.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), n: m.n, manual: !!m.manual })),
      settings: state.settings,
      width: w, height: h,
      image: blob,
      createdAt: new Date().toISOString(),
    });
    toast('Analysen er gemt');
    state = null;
    mount(view);
  };
  $('#dl').onclick = async () => {
    const blob = await billedeBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `karper-${today()}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  run();
  $('#ana').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const antal = () => state.markers.reduce((s, m) => s + m.n, 0);

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
  const r = Math.max(8, len * 0.55);
  const lw = Math.max(2, w / 400);
  ctx.lineWidth = lw;
  ctx.font = `bold ${Math.max(12, Math.round(r * 0.8))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  state.markers.forEach((m, i) => {
    ctx.strokeStyle = m.manual ? '#4fc3f7' : '#f2c14e';
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * Math.sqrt(m.n), 0, Math.PI * 2);
    ctx.stroke();
    const label = m.n > 1 ? `~${m.n}` : String(i + 1);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.strokeText(label, m.x, m.y - r * Math.sqrt(m.n) - r * 0.5);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, m.x, m.y - r * Math.sqrt(m.n) - r * 0.5);
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
}

// Finder pletter, der skiller sig ud fra vandet omkring dem, og har en karpe-agtig størrelse og form.
export function detect(img, w, h, { len, sens, tone, ingrode }) {
  const d = img.data;
  const n = w * h;
  // Lysstyrke og "grønhed" pr. pixel
  const L = new Float32Array(n), G = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = d[p], g = d[p + 1], b = d[p + 2];
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    G[i] = (2 * g - r - b) / (r + g + b + 1); // normaliseret Excess Green: grøde ca. 0,3+, grønligt vand under 0,25
  }
  // Lokal baggrund: gennemsnit i et vindue på ca. 3 karpelængder (integralbillede)
  const rad = Math.max(6, Math.round(len * 1.5));
  const I = new Float64Array((w + 1) * (h + 1));
  const I2 = new Float64Array((w + 1) * (h + 1));
  const IG = new Float64Array((w + 1) * (h + 1)); // andel grøde i vinduet
  for (let y = 0; y < h; y++) {
    let s = 0, s2 = 0, sg = 0;
    for (let x = 0; x < w; x++) {
      const v = L[y * w + x];
      s += v; s2 += v * v; sg += G[y * w + x] > GRØDE ? 1 : 0;
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s;
      I2[(y + 1) * (w + 1) + x + 1] = I2[y * (w + 1) + x + 1] + s2;
      IG[(y + 1) * (w + 1) + x + 1] = IG[y * (w + 1) + x + 1] + sg;
    }
  }
  // Tærskel: høj følsomhed = lav tærskel. Måles i forhold til den lokale spredning (støj i vandet).
  const k = 3.2 - (sens / 100) * 2.6; // 3,2 … 0,6 standardafvigelser
  const minDiff = 6;
  const mask = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rad), y1 = Math.min(h, y + rad + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rad), x1 = Math.min(w, x + rad + 1);
      const a = (y1 * (w + 1) + x1), b = (y0 * (w + 1) + x1), c = (y1 * (w + 1) + x0), e = (y0 * (w + 1) + x0);
      const cnt = (y1 - y0) * (x1 - x0);
      const mean = (I[a] - I[b] - I[c] + I[e]) / cnt;
      const sd = Math.sqrt(Math.max(1, (I2[a] - I2[b] - I2[c] + I2[e]) / cnt - mean * mean));
      const i = y * w + x;
      const diff = L[i] - mean;
      const t = Math.max(minDiff, k * sd);
      let hit = tone === 'mork' ? diff < -t : tone === 'lys' ? diff > t : Math.abs(diff) > t;
      if (hit && L[i] > 240) hit = false; // solglimt
      if (hit && ingrode && G[i] > GRØDE) hit = false; // grøn grøde
      mask[i] = hit ? 1 : 0;
    }
  }
  // Fjern enkeltstående pixels (lille "opening")
  const clean = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!mask[i]) continue;
    const s = mask[i - 1] + mask[i + 1] + mask[i - w] + mask[i + w] + mask[i - w - 1] + mask[i - w + 1] + mask[i + w - 1] + mask[i + w + 1];
    clean[i] = s >= 3 ? 1 : 0;
  }
  // Sammenhængende områder
  const typisk = Math.PI * (len / 2) * (len / 5); // ellipse-areal for en karpe
  const minA = typisk * 0.25, maxEn = typisk * 1.6, maxGruppe = typisk * 8;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const markers = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (!clean[s0] || seen[s0]) continue;
    let top = 0, area = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
    stack[top++] = s0; seen[s0] = 1;
    while (top) {
      const i = stack[--top];
      const x = i % w, y = (i / w) | 0;
      area++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && clean[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && clean[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && clean[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && clean[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    if (area < minA || area > maxGruppe) continue;
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    const fyld = area / (bw * bh);
    const lang = Math.max(bw, bh);
    if (lang > len * 4) continue; // for lang: bred, sivkant, båd …
    if (fyld < 0.15) continue; // trævlet: bølger, grøde
    if (ingrode) {
      // Hul i grøden? Se på en ramme lige uden om pletten. Er den mest grøn, er det ikke en karpe.
      const m = Math.max(3, Math.round(len * 0.3));
      const gx0 = Math.max(0, minx - m), gx1 = Math.min(w, maxx + m + 1), gy0 = Math.max(0, miny - m), gy1 = Math.min(h, maxy + m + 1);
      const ialt = (gx1 - gx0) * (gy1 - gy0) - bw * bh;
      const grøn = (IG[gy1 * (w + 1) + gx1] - IG[gy0 * (w + 1) + gx1] - IG[gy1 * (w + 1) + gx0] + IG[gy0 * (w + 1) + gx0]);
      if (ialt > 0 && grøn / ialt > 0.5) continue;
    }
    const antal = area <= maxEn ? 1 : Math.min(8, Math.round(area / typisk));
    markers.push({ x: sx / area, y: sy / area, n: antal, area });
  }
  return { mask: clean, markers };
}
