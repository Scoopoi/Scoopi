// Fiske-app. Simpel hash-router + PWA-registrering.
import * as ture from './ture.js';
import * as statistik from './statistik.js';

const VERSION = '0.3.0';

const routes = {
  fangster: {
    title: 'Fangster',
    html: soon('Fangstlog', 'Her logger du dine fangster.', [
      'Art, vægt, længde, tid og GPS-position',
      'Fotos og noter',
      'Agn, smag, farve, rig og stang ved karpefiskeri',
      'Vejret hentes automatisk',
    ]),
  },
  ture: {
    title: 'Ny tur',
    mount: ture.mount,
  },
  statistik: {
    title: 'Statistik',
    mount: statistik.mount,
  },
  prognose: {
    title: 'Prognose',
    html: soon('Gode fiskedage', 'Score for de næste dage ud fra vejret og dine tidligere ture.', [
      'Prognose fra Open-Meteo',
      'Sammenligning med dine gode ture',
      'Kort forklaring for hver dag',
    ]),
  },
  drone: {
    title: 'Drone',
    html: soon('Drone-analyse', 'Find grøde, grødefrie spots og karper i dine drone-optagelser.', [
      'Grøde vs. åbent vand som overlay',
      'Nummererede grødefrie spots',
      'Karpetælling (estimat)',
    ]),
  },
  kort: {
    title: 'Kort',
    html: soon('Kort', 'Søer, pladser, fangster og spots på et kort.', ['Leaflet + OpenStreetMap']),
  },
  indstillinger: {
    title: 'Opsætning',
    html: `
      <section class="card">
        <h2>Installér appen</h2>
        <p class="muted" id="install-text">Åbn menuen i Chrome og vælg <b>Installér app</b> eller <b>Føj til startskærm</b>.</p>
        <button id="install-btn" hidden>Installér</button>
      </section>
      <section class="card">
        <h2>Sync med GitHub <span class="soon">Kommer snart</span></h2>
        <p class="muted">Her skal du senere indtaste dit token til det private repo <code>fiske-data</code>. Tokenet gemmes kun på denne enhed.</p>
      </section>
      <section class="card">
        <h2>Om</h2>
        <p class="muted">Fiske-app version ${VERSION}</p>
      </section>`,
  },
};

function soon(heading, intro, items) {
  return `
    <section class="card">
      <h2>${heading} <span class="soon">Kommer snart</span></h2>
      <p class="muted">${intro}</p>
      <ul class="plan">${items.map((i) => `<li>${i}</li>`).join('')}</ul>
    </section>`;
}

const view = document.getElementById('view');
const title = document.getElementById('title');

function render() {
  const key = location.hash.replace(/^#\//, '') || 'ture';
  const route = routes[key] || routes.ture;
  title.textContent = route.title;
  document.title = `${route.title} – Fiske-app`;
  if (route.mount) { view.innerHTML = ''; route.mount(view); } else view.innerHTML = route.html;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.route === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (key === 'indstillinger') setupInstall();
}

// Installér-knap (Android/Chrome)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setupInstall();
});
function setupInstall() {
  const btn = document.getElementById('install-btn');
  if (!btn) return;
  if (matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('install-text').textContent = 'Appen er installeret.';
    return;
  }
  if (!deferredPrompt) return;
  btn.hidden = false;
  btn.onclick = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.hidden = true;
  };
}

// Online/offline-mærke
const net = document.getElementById('net');
function updateNet() { net.hidden = navigator.onLine; }
addEventListener('online', updateNet);
addEventListener('offline', updateNet);
updateNet();

addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
