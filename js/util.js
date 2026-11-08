// Fælles småfunktioner.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null; };
export const fmt = (n, d = 2) => n == null ? '' : n.toLocaleString('da-DK', { maximumFractionDigits: d });
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export function minutes(start, end) {
  if (!start || !end) return null;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let m = h2 * 60 + m2 - (h1 * 60 + m1);
  if (m < 0) m += 24 * 60; // slutter efter midnat
  return m;
}
// ---- Dato og tid for ture, også over midnat og flere døgn ----
export function addDays(date, n) {
  const d = new Date(date + 'T12:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const ms = (date, time) => Date.parse(`${date}T${time}:00Z`); // "lokal" tid regnet som UTC: ingen sommertids-hop
// Slutdato: gemt, ellers dagen efter hvis sluttid er før starttid (ældre ture).
export const slutDato = (t) => t.endDate || (t.end && t.end < t.start ? addDays(t.date, 1) : t.date);
export function turMinutter(t) {
  if (!t.start || !t.end) return null;
  const m = (ms(slutDato(t), t.end) - ms(t.date, t.start)) / 60000;
  return m >= 0 ? m : null;
}
// Hvilken dag hører et klokkeslæt til på turen? Første dag, hvor tidspunktet ligger inden for turen.
export function udledDato(t, time) {
  if (!time) return t.date;
  const s = ms(t.date, t.start), e = t.end ? ms(slutDato(t), t.end) : s + 864e5;
  for (let d = t.date, i = 0; i < 15; i++, d = addDays(d, 1)) {
    const x = ms(d, time);
    if (x >= s && x <= e) return d;
  }
  return t.date;
}
// Ligger dato+tid inden for turen? (med lidt luft før start)
export function iTur(t, date, time, førMin = 60) {
  const x = ms(date, time), s = ms(t.date, t.start) - førMin * 60000;
  const e = t.end ? ms(slutDato(t), t.end) : t.igang ? Infinity : ms(t.date, t.start) + 24 * 3600000;
  return x >= s && x <= e;
}
// Dage turen dækker
export function turDage(date, endDate) {
  const ud = [date];
  while (endDate && ud.length < 15 && ud[ud.length - 1] < endDate) ud.push(addDays(ud[ud.length - 1], 1));
  return ud;
}
export const ugedag = (d) => new Date(d + 'T12:00').toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'numeric' });
export function turTid(t) {
  if (t.cirka) return `${cirkaTekst(t.date, t.cirka)} · gammel fangst`;
  const m = turMinutter(t);
  if (!t.end) return `${datoTekst(t.date)} · fra ${t.start}${t.igang ? ' · 🟢 i gang' : ''}`;
  const sd = slutDato(t);
  if (sd === t.date) return `${datoTekst(t.date)} · ${t.start}–${t.end}${m != null ? ` (${varighed(m)})` : ''}`;
  return `${ugedag(t.date)} kl. ${t.start} → ${ugedag(sd)} kl. ${t.end}${m != null ? ` (${varighed(m)})` : ''}`;
}

export const nu = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
// Minutter fra turens start til nu (til igangværende ture)
export const minutterSiden = (t) => Math.max(0, Math.round((ms(today(), nu()) - ms(t.date, t.start)) / 60000));

export const varighed = (m) => m == null ? '' : `${Math.floor(m / 60)} t${m % 60 ? ` ${m % 60} min` : ''}`;
export const MÅNEDER = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
// Gamle fangster med cirka-dato: 'aar' = kun år kendt, 'maaned' = år og måned kendt.
export const cirkaTekst = (d, cirka) => cirka === 'aar' ? `ca. ${d.slice(0, 4)}` : `ca. ${MÅNEDER[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
// Dato for en fangst til visning (respekterer cirka-datoer)
export const fangstDato = (c, t) => (t?.cirka ? cirkaTekst(c.date || t.date, t.cirka) : datoTekst(c.date || t.date));
export const datoTekst = (d) => new Date(d + 'T12:00').toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const STEDTYPER = [['so', 'Sø'], ['aa', 'Å'], ['kanal', 'Kanal'], ['dam', 'Dam']];
// Til visning af ældre ture, der blev gemt med 'Hav'
export const STEDNAVN = { ...Object.fromEntries(STEDTYPER), hav: 'Hav' };

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}

// ---- Tidsfelter, man skriver i (i stedet for telefonens urskive) ----
export const gyldigTid = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
// "1530" → "15:30", "930" → "09:30", "7" → "07:00", "15.30" → "15:30". Ugyldigt → null.
export function normTid(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let h, m;
  const del = s.match(/^(\d{1,2})\s*[:.,]\s*(\d{1,2})$/);
  if (del) { h = +del[1]; m = +del[2].padEnd(2, '0'); }
  else {
    const d = s.replace(/\D/g, '');
    if (!d || d.length > 4) return null;
    if (d.length <= 2) { h = +d; m = 0; } else { h = +d.slice(0, -2); m = +d.slice(-2); }
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function gørTidsfelt(inp) {
  if (inp.dataset.tidKlar) return;
  inp.dataset.tidKlar = '1';
  inp.setAttribute('inputmode', 'numeric');
  inp.setAttribute('autocomplete', 'off');
  inp.setAttribute('maxlength', '5');
  inp.placeholder = inp.placeholder || 'tt:mm';
  const sæt = (v) => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); };
  inp.addEventListener('input', (e) => {
    if (!e.isTrusted) return;
    inp.classList.remove('ugyldig');
    const d = inp.value.replace(/\D/g, '');
    if (d.length === 4 && /^\d+$/.test(inp.value)) { const n = normTid(d); if (n) sæt(n); } // 4 cifre → hh:mm med det samme
  });
  inp.addEventListener('blur', () => {
    if (!inp.value) return;
    const n = normTid(inp.value);
    if (n === null) { inp.classList.add('ugyldig'); return; }
    if (n !== inp.value) { sæt(n); inp.dispatchEvent(new Event('change', { bubbles: true })); }
  });
}
// Gør alle tidsfelter i appen til skrive-felter, også dem der tilføjes senere.
export function startTidsfelter(rod = document.body) {
  const scan = (n) => n.querySelectorAll?.('input[data-tid]').forEach(gørTidsfelt);
  scan(rod);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches?.('input[data-tid]')) gørTidsfelt(n); scan(n); } }))).observe(rod, { childList: true, subtree: true });
}
