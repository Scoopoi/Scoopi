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
export const varighed = (m) => m == null ? '' : `${Math.floor(m / 60)} t${m % 60 ? ` ${m % 60} min` : ''}`;
export const datoTekst = (d) => new Date(d + 'T12:00').toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const STEDTYPER = [['so', 'Sø'], ['hav', 'Hav'], ['aa', 'Å']];

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}
