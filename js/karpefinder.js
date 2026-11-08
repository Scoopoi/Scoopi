// Karpefinder v2: finder svage, aflange fiskeskygger i vand set fra drone.
// Ren funktion (ingen DOM), så den kan testes uden browser.
//  1) Vandmaske: bred/bevoksning (farvemættet, gul/grøn) og meget lyse/mørke pletter sorteres fra.
//  2) Glatning, så krusninger forsvinder, og lokal baggrund trækkes fra.
//  3) Pletter, der er lysere (eller mørkere) end vandet omkring dem, med en karpes længde og aflange form.

function boks(src, w, h, r) { // box-blur (to gennemløb), r = radius
  const tmp = new Float32Array(w * h), ud = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0; const o = y * w;
    for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s;
      s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      ud[y * w + x] = s;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return ud;
}
// Gennemsnit kun over vand (normaliseret foldning)
function vandSnit(v, m, w, h, r) {
  const vm = new Float32Array(w * h);
  for (let i = 0; i < vm.length; i++) vm[i] = v[i] * m[i];
  const a = boks(vm, w, h, r), b = boks(m, w, h, r);
  for (let i = 0; i < a.length; i++) a[i] = b[i] > 0.5 ? a[i] / b[i] : 0;
  return a;
}

// Skaler et Float32-billede ned ved at tage gennemsnit af blokke
function nedskaler(src, w, h, f) {
  const W = Math.max(1, Math.round(w * f)), H = Math.max(1, Math.round(h * f));
  const ud = new Float32Array(W * H), tæl = new Float32Array(W * H);
  for (let y = 0; y < h; y++) {
    const Y = Math.min(H - 1, (y * f) | 0);
    for (let x = 0; x < w; x++) { const i = Y * W + Math.min(W - 1, (x * f) | 0); ud[i] += src[y * w + x]; tæl[i]++; }
  }
  for (let i = 0; i < ud.length; i++) ud[i] /= tæl[i] || 1;
  return { d: ud, W, H };
}

export function findKarper(data, w, h, { len = 80, sens = 55, tone = 'lys', ingrode = true, metode = 'toppe', afstand = 0.35, loftFaktor = 7, indFaktor = 0.3 } = {}) {
  const n = w * h;
  const L0 = new Float32Array(n), V0 = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const mæt = mx ? (mx - mn) / mx : 0;
    L0[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const plante = mæt > 0.28 || (r + g) / 2 - b > 22 || (2 * g - r - b) > 25;
    V0[i] = (ingrode && plante) || L0[i] > 235 ? 0 : 1;
  }
  // Arbejd i en skala, hvor en karpe er ca. 40 px lang (hurtigt og ensartet)
  const f = Math.min(1, 40 / len);
  const { d: Lr, W, H } = nedskaler(L0, w, h, f);
  const { d: Vr } = nedskaler(V0, w, h, f);
  const N = W * H, ls = len * f;
  // Vand: overvejende vand i et lille område (ingen strimler mellem grene)
  const vr = Math.max(2, Math.round(ls * 0.1));
  const vandAndel = boks(Vr, W, H, vr), fuldt = (2 * vr + 1) ** 2;
  const m = new Float32Array(N);
  for (let i = 0; i < N; i++) m[i] = Vr[i] > 0.9 && vandAndel[i] / fuldt > 0.85 ? 1 : 0;
  // Glat krusninger væk (bredde ~ en karpes bredde)
  const Ls = vandSnit(Lr, m, W, H, Math.max(1, Math.round(ls / 14)));

  // Aflang skabelon i 12 retninger: lys midterlinje (fiskens krop) mod mørkere vand på begge sider
  const halv = ls * 0.4, side = Math.max(3, ls * 0.2), trin = 2;
  const R = new Float32Array(N), V = new Float32Array(N);
  const tegn = tone === 'mork' ? -1 : 1;
  for (let k = 0; k < 12; k++) {
    const th = (k * Math.PI) / 12, dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
    const pts = [];
    const ind = side * indFaktor; // linjer inde i kroppen: en karpe er lys i hele bredden, en kvist er tynd
    for (let t = -halv; t <= halv; t += trin) pts.push([Math.round(t * dx), Math.round(t * dy), Math.round(t * dx + side * nx), Math.round(t * dy + side * ny), Math.round(t * dx - side * nx), Math.round(t * dy - side * ny),
      Math.round(t * dx + ind * nx), Math.round(t * dy + ind * ny), Math.round(t * dx - ind * nx), Math.round(t * dy - ind * ny)]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!m[i]) continue;
      let c = 0, a = 0, b = 0, nc = 0, na = 0, nb = 0, ia = 0, ib = 0, nia = 0, nib = 0;
      for (const [cx, cy, ax, ay, bx, by, ix1, iy1, ix2, iy2] of pts) {
        let X = x + cx, Y = y + cy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X]) { c += Ls[Y * W + X]; nc++; }
        X = x + ix1; Y = y + iy1;
        if (X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X]) { ia += Ls[Y * W + X]; nia++; }
        X = x + ix2; Y = y + iy2;
        if (X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X]) { ib += Ls[Y * W + X]; nib++; }
        X = x + ax; Y = y + ay;
        if (X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X]) { a += Ls[Y * W + X]; na++; }
        X = x + bx; Y = y + by;
        if (X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X]) { b += Ls[Y * W + X]; nb++; }
      }
      if (nc < pts.length * 0.7 || nia < pts.length * 0.6 || nib < pts.length * 0.6) continue;
      // Kroppens svageste linje (midt eller kant af kroppen) skal være lys – så tynde kviste falder fra
      c = tegn > 0 ? Math.min(c / nc, ia / nia, ib / nib) : Math.max(c / nc, ia / nia, ib / nib);
      let r;
      if (na >= pts.length * 0.5 && nb >= pts.length * 0.5) r = Math.min(c - a / na, c - b / nb) * tegn;
      else if (na >= pts.length * 0.5) r = (c - a / na) * tegn * 0.8; // tæt på bredden: kun én side
      else if (nb >= pts.length * 0.5) r = (c - b / nb) * tegn * 0.8;
      else continue;
      if (tone === 'begge') r = Math.abs(r);
      if (r > R[i]) { R[i] = r; V[i] = th; }
    }
  }
  // Tærskel ud fra støjen i vandet: robust spredning af (glattet lysstyrke − lokal baggrund)
  const Lb = vandSnit(Ls, m, W, H, Math.max(4, Math.round(ls)));
  const hp = [];
  for (let i = 0; i < N; i += 2) if (m[i]) hp.push(Math.abs(Ls[i] - Lb[i]));
  hp.sort((p, q) => p - q);
  const sigma = Math.max(0.5, (hp[hp.length >> 1] || 1) * 1.4826);
  const T = (2.6 - (sens / 100) * 1.8) * sigma; // følsomhed 0 → 2,6σ … 100 → 0,8σ
  if (globalThis.KARPE_DEBUG) { const rv = []; for (let i = 0; i < N; i++) if (m[i] && R[i] > 0) rv.push(R[i]); rv.sort((p, q) => p - q); console.log('sigma', sigma.toFixed(2), 'T', T.toFixed(2), 'R p50/p90/p99/max', [0.5, 0.9, 0.99, 1].map((q) => rv[Math.min(rv.length - 1, (rv.length * q) | 0)]?.toFixed(2)).join('/')); }
  // Karper er svage skygger; meget lyse ting (kviste, blade, genskin) er for kraftige til at være fisk
  const loft = loftFaktor * sigma;
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = R[i] > T && R[i] < loft ? 1 : 0;

  // Mål fiskens længde: gå langs kroppen fra midten, til den ikke længere er lysere end vandet ved siden af
  function målLængde(x0, y0, th) {
    const dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
    const v = (X, Y) => { X = Math.round(X); Y = Math.round(Y); return X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X] ? Ls[Y * W + X] : null; };
    const kontrast = (t) => {
      const c = v(x0 + t * dx, y0 + t * dy), a = v(x0 + t * dx + side * nx, y0 + t * dy + side * ny), b = v(x0 + t * dx - side * nx, y0 + t * dy - side * ny);
      if (c == null || (a == null && b == null)) return null;
      const bg = a == null ? b : b == null ? a : (a + b) / 2;
      return (c - bg) * tegn;
    };
    const k0 = Math.max(0.5, kontrast(0) ?? 0);
    let ud = 0;
    for (const retn of [1, -1]) {
      let t = 0, sidst = 0, huller = 0;
      while (t < ls * 1.2) {
        t++;
        const k = kontrast(retn * t);
        if (k == null) break;
        if (k >= k0 * 0.2) { sidst = t; huller = 0; } else if (++huller > 3) break; // små huller (finner, krusninger) er ok
      }
      ud += sidst;
    }
    return Math.max(ls * 0.5, Math.min(ls * 2.2, ud + 2));
  }

  if (metode === 'toppe') {
    // Fisk i stime ligger klos op ad hinanden: tag hvert lokalt maksimum i responskortet (non-max suppression)
    const r = Math.max(2, Math.round(ls * afstand));
    const kand = [];
    for (let i = 0; i < N; i++) if (mask[i]) kand.push(i);
    kand.sort((p, q) => R[q] - R[p]);
    const taget = new Uint8Array(N), fisk = [];
    for (const i of kand) {
      if (taget[i]) continue;
      const x = i % W, y = (i / W) | 0;
      // Afstand til bredden/bevoksning (i karpelængder) – fund helt inde ved kanten er oftere kviste
      let kant = 99;
      const rr = Math.round(ls * 0.8);
      for (let yy = Math.max(0, y - rr); yy <= Math.min(H - 1, y + rr); yy += 2) for (let xx = Math.max(0, x - rr); xx <= Math.min(W - 1, x + rr); xx += 2) {
        if (!Vr[yy * W + xx] || Vr[yy * W + xx] < 0.5) { const d = Math.hypot(xx - x, yy - y) / ls; if (d < kant) kant = d; }
      }
      fisk.push({ x: x / f, y: y / f, n: 1, area: 0, lengthPx: målLængde(x, y, V[i]) / f, vinkel: V[i], styrke: R[i] / T, kant });
      for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) {
        if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) taget[yy * W + xx] = 1;
      }
    }
    const fuld = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fuld[y * w + x] = mask[Math.min(H - 1, (y * f) | 0) * W + Math.min(W - 1, (x * f) | 0)];
    return { mask: fuld, vand: m, markers: fisk };
  }
  // Pletter i responskortet = fisk. Placering = stærkeste punkt, retning fra skabelonen.
  const set = new Uint8Array(N), stak = new Int32Array(N), fisk = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (!mask[s0] || set[s0]) continue;
    let top = 0, a = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, best = s0;
    stak[top++] = s0; set[s0] = 1;
    while (top) {
      const i = stak[--top], x = i % W, y = (i / W) | 0;
      a++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      if (R[i] > R[best]) best = i;
      if (x > 0 && mask[i - 1] && !set[i - 1]) { set[i - 1] = 1; stak[top++] = i - 1; }
      if (x < W - 1 && mask[i + 1] && !set[i + 1]) { set[i + 1] = 1; stak[top++] = i + 1; }
      if (y > 0 && mask[i - W] && !set[i - W]) { set[i - W] = 1; stak[top++] = i - W; }
      if (y < H - 1 && mask[i + W] && !set[i + W]) { set[i + W] = 1; stak[top++] = i + W; }
    }
    if (a < 6) continue;
    const mx = sx / a, my = sy / a;
    const cxx = sxx / a - mx * mx, cyy = syy / a - my * my, cxy = sxy / a - mx * my;
    const rod = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy);
    const l1 = (cxx + cyy) / 2 + rod;
    const plet = 4 * Math.sqrt(l1); // pletten er ca. lige så lang som fisken minus skabelonen
    const antal = plet > ls * 1.3 ? Math.min(6, 1 + Math.round((plet - ls * 0.3) / ls)) : 1;
    const bx = best % W, by = (best / W) | 0;
    fisk.push({ x: (antal > 1 ? mx : bx) / f, y: (antal > 1 ? my : by) / f, n: antal, area: a / (f * f), lengthPx: len, vinkel: V[best], styrke: R[best] / T });
  }
  // Udvid masken til fuld opløsning (til "Vis hvad der blev fundet")
  const fuld = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fuld[y * w + x] = mask[Math.min(H - 1, (y * f) | 0) * W + Math.min(W - 1, (x * f) | 0)];
  return { mask: fuld, vand: m, markers: fisk };
}

// ======================================================================
// Kandidater + egenskaber (til den trænede model).
// Finder både lyse og mørke aflange pletter og måler egenskaber ved hver,
// så en lille model (trænet på Scoopis markerede droneoptagelser) kan afgøre,
// om det er en karpe – eller sten, grøde, skygge, and osv.
// ======================================================================
export const EGENSKABER = ['styrke', 'mørk', 'længde', 'tværs', 'kant', 'uro', 'dR', 'dG', 'dB', 'mætning', 'lys', 'baggrund', 'skæv', 'dækning'];

export function kandidater(data, w, h, { len = 60, maks = 400 } = {}) {
  const n = w * h;
  const f = Math.min(1, 40 / len);
  const Lf = new Float32Array(n), Rf = new Float32Array(n), Gf = new Float32Array(n), Bf = new Float32Array(n), Vf = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    Rf[i] = r; Gf[i] = g; Bf[i] = b;
    Lf[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), mæt = mx ? (mx - mn) / mx : 0;
    const exg = (2 * g - r - b) / (r + g + b + 1);
    // Kun tydelig landvegetation (kraftigt grøn) og hvide genskin/fugle tæller ikke som vand.
    // Gulgrønt, lavt vand med bund og grøde SKAL med – dér står karperne tit.
    Vf[i] = (exg > 0.18 && mæt > 0.35 && Lf[i] > 60) || Lf[i] > 225 ? 0 : 1;
  }
  const { d: Lr, W, H } = nedskaler(Lf, w, h, f);
  const Rr = nedskaler(Rf, w, h, f).d, Gr = nedskaler(Gf, w, h, f).d, Br = nedskaler(Bf, w, h, f).d, Vr = nedskaler(Vf, w, h, f).d;
  const N = W * H, ls = len * f;
  const m = new Float32Array(N);
  for (let i = 0; i < N; i++) m[i] = Vr[i] > 0.8 ? 1 : 0;
  const Ls = vandSnit(Lr, m, W, H, Math.max(1, Math.round(ls / 14)));
  const Lb = vandSnit(Ls, m, W, H, Math.max(4, Math.round(ls)));
  const D2 = new Float32Array(N);
  for (let i = 0; i < N; i++) D2[i] = m[i] ? (Ls[i] - Lb[i]) ** 2 : 0;
  const lokalVar = vandSnit(D2, m, W, H, Math.max(4, Math.round(ls)));
  const hp = [];
  for (let i = 0; i < N; i += 2) if (m[i]) hp.push(Math.abs(Ls[i] - Lb[i]));
  hp.sort((p, q) => p - q);
  const sigma = Math.max(0.5, (hp[hp.length >> 1] || 1) * 1.4826);

  const halv = ls * 0.4, side = Math.max(3, ls * 0.2), ind = side * 0.3;
  const ok = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X];
  // Respons for én retning i ét punkt: {r (med fortegn: + lys, − mørk), c, a, b}
  function respons(x, y, th) {
    const dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
    let c = 0, a = 0, b = 0, ia = 0, ib = 0, nc = 0, na = 0, nb = 0, nia = 0, nib = 0, tot = 0;
    for (let t = -halv; t <= halv; t += 2) {
      tot++;
      const X = x + t * dx, Y = y + t * dy;
      let P = Math.round(X), Q = Math.round(Y); if (ok(P, Q)) { c += Ls[Q * W + P]; nc++; }
      P = Math.round(X + ind * nx); Q = Math.round(Y + ind * ny); if (ok(P, Q)) { ia += Ls[Q * W + P]; nia++; }
      P = Math.round(X - ind * nx); Q = Math.round(Y - ind * ny); if (ok(P, Q)) { ib += Ls[Q * W + P]; nib++; }
      P = Math.round(X + side * nx); Q = Math.round(Y + side * ny); if (ok(P, Q)) { a += Ls[Q * W + P]; na++; }
      P = Math.round(X - side * nx); Q = Math.round(Y - side * ny); if (ok(P, Q)) { b += Ls[Q * W + P]; nb++; }
    }
    if (nc < tot * 0.7 || nia < tot * 0.6 || nib < tot * 0.6 || (na < tot * 0.5 && nb < tot * 0.5)) return null;
    const cm = c / nc, ci = [cm, ia / nia, ib / nib];
    const A = na >= tot * 0.5 ? a / na : null, B = nb >= tot * 0.5 ? b / nb : null;
    const sider = [A, B].filter((v) => v != null);
    const lysR = Math.min(...ci) - Math.max(...sider); // hele kroppen lysere end begge sider
    const mørkR = Math.min(...sider) - Math.max(...ci); // hele kroppen mørkere end begge sider
    const r = lysR >= mørkR ? lysR : -mørkR;
    return { r, c: cm, a: A, b: B, dækning: (na + nb) / (2 * tot) };
  }
  // 7 × 5 punkter langs og på tværs af fisken (lysstyrke minus baggrund, i σ), vendt så "fiskefarven" er positiv
  function profil(x, y, th, sgn) {
    const dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx, bg = Lb[y * W + x], ud = [];
    for (let a = -3; a <= 3; a++) for (let b = -2; b <= 2; b++) {
      const P = Math.round(x + a * ls * 0.16 * dx + b * side * 0.6 * nx), Q = Math.round(y + a * ls * 0.16 * dy + b * side * 0.6 * ny);
      ud.push(ok(P, Q) ? Math.max(-4, Math.min(4, ((Ls[Q * W + P] - bg) * sgn) / sigma)) : 0);
    }
    return ud;
  }
  // Responskort (bedste retning pr. punkt)
  const R = new Float32Array(N), S = new Float32Array(N), V = new Float32Array(N);
  const st = Math.max(1, Math.round(ls / 20)); // hvert 2. punkt ved normal størrelse – 4× hurtigere
  for (let k = 0; k < 12; k++) {
    const th = (k * Math.PI) / 12;
    for (let y = 0; y < H; y += st) for (let x = 0; x < W; x += st) {
      const i = y * W + x;
      if (!m[i]) continue;
      const rr = respons(x, y, th);
      if (rr && Math.abs(rr.r) > R[i]) { R[i] = Math.abs(rr.r); S[i] = Math.sign(rr.r); V[i] = th; }
    }
  }
  // Toppe (non-max suppression) med lav tærskel → mange kandidater, modellen sorterer
  const T0 = 0.9 * sigma, rad = Math.max(2, Math.round(ls * 0.45));
  const idx = [];
  for (let i = 0; i < N; i++) if (R[i] > T0) idx.push(i);
  idx.sort((p, q) => R[q] - R[p]);
  const taget = new Uint8Array(N), ud = [];
  for (const i of idx) {
    if (taget[i] || ud.length >= maks) continue;
    const x = i % W, y = (i / W) | 0, th = V[i], sgn = S[i];
    for (let yy = Math.max(0, y - rad); yy <= Math.min(H - 1, y + rad); yy++) for (let xx = Math.max(0, x - rad); xx <= Math.min(W - 1, x + rad); xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rad * rad) taget[yy * W + xx] = 1;
    const r0 = respons(x, y, th), rp = respons(x, y, th + Math.PI / 2);
    if (!r0) continue;
    // Længde langs kroppen
    const dx = Math.cos(th), dy = Math.sin(th);
    const k0 = Math.abs(r0.r);
    let lgd = 0;
    for (const retn of [1, -1]) {
      let t = 0, sidst = 0, huller = 0;
      while (t < ls * 1.3) { t++; const q = respons(x + retn * t * dx * 0.5, y + retn * t * dy * 0.5, th); if (!q) break; if (q.r * sgn >= k0 * 0.25) { sidst = t * 0.5; huller = 0; } else if (++huller > 4) break; }
      lgd += sidst;
    }
    // Farve: krop minus baggrund
    const nx = -dy, ny = dx; let kr = 0, kg = 0, kb = 0, br = 0, bg = 0, bb = 0, nk = 0, nbg = 0;
    for (let t = -halv; t <= halv; t += 2) {
      let P = Math.round(x + t * dx), Q = Math.round(y + t * dy);
      if (ok(P, Q)) { const j = Q * W + P; kr += Rr[j]; kg += Gr[j]; kb += Br[j]; nk++; }
      for (const s of [side * 1.2, -side * 1.2]) { P = Math.round(x + t * dx + s * nx); Q = Math.round(y + t * dy + s * ny); if (ok(P, Q)) { const j = Q * W + P; br += Rr[j]; bg += Gr[j]; bb += Br[j]; nbg++; } }
    }
    kr /= nk || 1; kg /= nk || 1; kb /= nk || 1; br /= nbg || 1; bg /= nbg || 1; bb /= nbg || 1;
    const kmx = Math.max(kr, kg, kb), kmn = Math.min(kr, kg, kb);
    const kant = (() => { let d = 3; const rr = Math.round(ls * 1.2); for (let yy = Math.max(0, y - rr); yy <= Math.min(H - 1, y + rr); yy += 2) for (let xx = Math.max(0, x - rr); xx <= Math.min(W - 1, x + rr); xx += 2) if (!m[yy * W + xx]) d = Math.min(d, Math.hypot(xx - x, yy - y) / ls); return d; })();
    const sk = r0.a != null && r0.b != null ? Math.abs(r0.a - r0.b) / (Math.abs(r0.c - r0.a) + Math.abs(r0.c - r0.b) + 1) : 1;
    ud.push({
      x: x / f, y: y / f, vinkel: th, lengthPx: Math.max(ls * 0.4, lgd + 2) / f, mørk: sgn < 0,
      e: [
        Math.min(8, k0 / sigma),                       // styrke
        sgn < 0 ? 1 : 0,                               // mørk
        Math.min(3, (lgd + 2) / ls),                   // længde (i karpelængder)
        rp ? Math.max(-1, Math.min(1.5, (rp.r * sgn) / (k0 + 0.1))) : 0, // tværs: lige så kraftig på tværs = rund klat, ikke fisk
        Math.min(3, kant),                             // afstand til land/vegetation
        Math.min(5, Math.sqrt(lokalVar[i]) / sigma),   // uro i vandet omkring
        (kr - br) / 255, (kg - bg) / 255, (kb - bb) / 255, // farveforskel krop − baggrund
        kmx ? (kmx - kmn) / kmx : 0,                   // kroppens farvemætning
        (0.299 * kr + 0.587 * kg + 0.114 * kb) / 255,  // kroppens lysstyrke
        (0.299 * br + 0.587 * bg + 0.114 * bb) / 255,  // baggrundens lysstyrke
        Math.min(1.5, sk),                             // skævhed mellem siderne
        r0.dækning,                                    // hvor meget vand på siderne
        ...profil(x, y, th, sgn),                      // lille udsnit drejet langs fisken (form: hoved, krop, hale)
      ],
    });
  }
  return { kandidater: ud, sigma, W, H, f };
}
