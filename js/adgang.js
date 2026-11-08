// Adgang: login, oprettelse, venteside med kode og administratorens medlemsliste.
import * as konto from './konto.js';
import { esc, toast, datoTekst } from './util.js';

const skift = () => dispatchEvent(new Event('adgang-aendret'));

// Returnerer true, hvis brugeren er godkendt. Ellers vises login/venteside i `view`.
export async function tjek(view, title) {
  let st;
  try { st = await konto.status(); } catch { st = { tilstand: 'ude' }; }
  if (st.tilstand === 'godkendt' || st.tilstand === 'ikke-klar') return true;
  title.textContent = 'Velkommen';
  if (st.tilstand === 'ude') visLogin(view);
  else if (st.tilstand === 'mangler-profil') visManglerProfil(view);
  else if (st.tilstand === 'afventer') visVenter(view, st.profil);
  else visAfvist(view, st.profil);
  return false;
}

function ramme(indhold) {
  return `
    <section class="hero adgang-hero"><div class="hero-txt"><div class="hero-navn">Karpeloggen</div><div class="hero-sub">Kun for godkendte medlemmer</div></div></section>
    ${indhold}`;
}

function visLogin(view, fane = 'ind') {
  view.innerHTML = ramme(`
    <section class="card form">
      <div class="seg" id="fane">
        <label><input type="radio" name="fane" value="ind" ${fane === 'ind' ? 'checked' : ''}><span>Log ind</span></label>
        <label><input type="radio" name="fane" value="opret" ${fane === 'opret' ? 'checked' : ''}><span>Opret bruger</span></label>
      </div>
      <form id="login" novalidate style="margin-top:12px">
        ${fane === 'opret' ? '<p class="muted small">Lav et brugernavn og en adgangskode. Administratoren skal godkende dig, før du kan se noget. Du får en kode af ham.</p>' : ''}
        <label>Brugernavn <input type="text" name="navn" autocomplete="username" autocapitalize="off" required></label>
        <label>Adgangskode <input type="password" name="kode" autocomplete="${fane === 'opret' ? 'new-password' : 'current-password'}" required></label>
        ${fane === 'opret' ? '<label>Gentag adgangskode <input type="password" name="kode2" autocomplete="new-password" required></label>' : ''}
        <p class="error" id="fejl" hidden></p>
        <div class="actions"><button type="submit">${fane === 'opret' ? 'Opret bruger' : 'Log ind'}</button></div>
      </form>
    </section>`);
  view.querySelectorAll('input[name=fane]').forEach((r) => r.onchange = () => visLogin(view, r.value));
  const f = view.querySelector('#login');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fejl = f.querySelector('#fejl'); fejl.hidden = true;
    const knap = f.querySelector('button[type=submit]'); knap.disabled = true;
    try {
      if (fane === 'opret') {
        if (f.kode.value !== f.kode2.value) throw new Error('De to adgangskoder er ikke ens.');
        await konto.opret(f.navn.value, f.kode.value);
      } else await konto.logInd(f.navn.value, f.kode.value);
      skift();
    } catch (err) { fejl.textContent = err.message; fejl.hidden = false; knap.disabled = false; }
  };
}

function visManglerProfil(view) {
  view.innerHTML = ramme(`
    <section class="card form">
      <h2>Vælg dit brugernavn</h2>
      <form id="prof"><label>Brugernavn <input type="text" name="navn" required></label>
        <p class="error" id="fejl" hidden></p>
        <div class="actions"><button type="submit">Fortsæt</button><button type="button" class="ghost" id="ud">Log ud</button></div></form>
    </section>`);
  const f = view.querySelector('#prof');
  f.onsubmit = async (e) => { e.preventDefault(); try { await konto.lavProfil(f.navn.value); skift(); } catch (err) { const x = f.querySelector('#fejl'); x.textContent = err.message; x.hidden = false; } };
  view.querySelector('#ud').onclick = async () => { await konto.logUd(); skift(); };
}

function visVenter(view, p) {
  view.innerHTML = ramme(`
    <section class="card form">
      <h2>Hej ${esc(p?.brugernavn || '')} 👋</h2>
      <p>Din anmodning er sendt til administratoren. Når du er godkendt, får du en <b>kode</b> af ham. Skriv den her:</p>
      <form id="kodeform" novalidate>
        <label>Kode <input type="text" name="kode" placeholder="KARPE-XXXX-XXXX" autocapitalize="characters" autocomplete="one-time-code"></label>
        <p class="error" id="fejl" hidden></p>
        <div class="actions"><button type="submit">Brug kode</button></div>
      </form>
      <div class="row-btns"><button type="button" class="ghost sm" id="igen">Tjek igen</button><button type="button" class="ghost sm" id="ud">Log ud</button></div>
    </section>`);
  const f = view.querySelector('#kodeform');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fejl = f.querySelector('#fejl'); fejl.hidden = true;
    try {
      if (await konto.brugKode(f.kode.value)) { toast('Velkommen i gruppen! 🎣'); skift(); }
      else { fejl.textContent = 'Koden passer ikke. Tjek den og prøv igen.'; fejl.hidden = false; }
    } catch (err) { fejl.textContent = err.message; fejl.hidden = false; }
  };
  view.querySelector('#igen').onclick = skift;
  view.querySelector('#ud').onclick = async () => { await konto.logUd(); skift(); };
}

function visAfvist(view, p) {
  view.innerHTML = ramme(`
    <section class="card">
      <h2>Ingen adgang</h2>
      <p>${esc(p?.brugernavn || 'Din bruger')} er ikke godkendt til Karpeloggen. Kontakt administratoren, hvis det er en fejl.</p>
      <div class="row-btns"><button type="button" class="ghost sm" id="igen">Tjek igen</button><button type="button" class="ghost sm" id="ud">Log ud</button></div>
    </section>`);
  view.querySelector('#igen').onclick = skift;
  view.querySelector('#ud').onclick = async () => { await konto.logUd(); skift(); };
}

// ---- På Opsætning: konto og (for administratoren) medlemmer ----
export async function visKonto(view) {
  const p = konto.gemtProfil();
  if (!p) return;
  const sek = document.createElement('section');
  sek.className = 'card';
  sek.innerHTML = `
    <h2>Konto</h2>
    <p>Logget ind som <b>${esc(p.brugernavn)}</b>${p.rolle === 'admin' ? ' · <span class="tag">administrator</span>' : ''}</p>
    <button type="button" class="ghost sm" id="logud">Log ud</button>`;
  view.prepend(sek);
  sek.querySelector('#logud').onclick = async () => { if (!confirm('Log ud?')) return; await konto.logUd(); skift(); };
  if (p.rolle === 'admin') {
    const m = document.createElement('section');
    m.className = 'card';
    m.innerHTML = '<h2>👥 Medlemmer</h2><p class="muted small">Henter …</p>';
    sek.after(m);
    tegnMedlemmer(m);
  }
}

async function tegnMedlemmer(m) {
  let liste;
  try { liste = await konto.medlemmer(); } catch (e) { m.innerHTML = `<h2>👥 Medlemmer</h2><p class="error">${esc(e.message)}</p>`; return; }
  const afv = liste.filter((x) => x.status === 'afventer');
  const godk = liste.filter((x) => x.status === 'godkendt');
  const afvist = liste.filter((x) => x.status === 'afvist');
  const række = (x, knapper) => `<li><div><b>${esc(x.brugernavn)}</b>${x.rolle === 'admin' ? ' <span class="tag">admin</span>' : ''}<br><span class="muted small">oprettet ${datoTekst(x.oprettet.slice(0, 10))}</span>${x.kode ? `<div class="kode">Kode: <b>${esc(x.kode)}</b> <button type="button" class="ghost sm" data-del="${esc(x.kode)}" data-navn="${esc(x.brugernavn)}">Send kode</button></div>` : ''}</div><div class="row-btns">${knapper}</div></li>`;
  m.innerHTML = `
    <div class="trip-top"><h2>👥 Medlemmer</h2><button type="button" class="ghost sm" id="opdater">↻ Opdater</button></div>
    <h4>Venter på godkendelse (${afv.length})</h4>
    ${afv.length ? `<ul class="medl">${afv.map((x) => række(x, `<button type="button" class="sm" data-godkend="${x.id}">${x.kode ? 'Ny kode' : 'Godkend'}</button><button type="button" class="ghost sm danger" data-afvis="${x.id}">Afvis</button>`)).join('')}</ul>` : '<p class="muted small">Ingen anmodninger lige nu.</p>'}
    <h4>Medlemmer (${godk.length})</h4>
    <ul class="medl">${godk.map((x) => række(x, x.rolle === 'admin' ? '' : `<button type="button" class="ghost sm danger" data-afvis="${x.id}">Fjern adgang</button>`)).join('')}</ul>
    ${afvist.length ? `<h4>Afvist / fjernet (${afvist.length})</h4><ul class="medl">${afvist.map((x) => række(x, `<button type="button" class="ghost sm" data-godkend="${x.id}">Godkend alligevel</button>`)).join('')}</ul>` : ''}`;
  m.querySelector('#opdater').onclick = () => tegnMedlemmer(m);
  m.querySelectorAll('[data-godkend]').forEach((b) => b.onclick = async () => {
    try { const k = await konto.godkend(b.dataset.godkend); toast(`Kode: ${k}`); tegnMedlemmer(m); } catch (e) { alert(e.message); }
  });
  m.querySelectorAll('[data-afvis]').forEach((b) => b.onclick = async () => {
    if (!confirm('Fjern adgangen for denne bruger?')) return;
    try { await konto.afvis(b.dataset.afvis); tegnMedlemmer(m); } catch (e) { alert(e.message); }
  });
  m.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const tekst = `Hej ${b.dataset.navn}! Din kode til Karpeloggen er: ${b.dataset.del}\nÅbn https://scoopoi.github.io/Scoopi/ og skriv koden.`;
    try {
      if (navigator.share) await navigator.share({ text: tekst });
      else { await navigator.clipboard.writeText(tekst); toast('Beskeden er kopieret – sæt den ind i en sms'); }
    } catch { /* annulleret */ }
  });
}
