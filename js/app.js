// Fiske-app. Simpel hash-router + PWA-registrering.
import * as ture from './ture.js';
import * as fangster from './fangster.js';
import * as statistik from './statistik.js';
import * as drone from './drone.js';
import * as kort from './kort.js';
import * as album from './album.js';
import * as adgang from './adgang.js';
import { startTidsfelter } from './util.js';
import { omdøbTigernødder } from './fisk.js';
startTidsfelter();
omdøbTigernødder();

const VERSION = '0.25.1';

const routes = {
  fangster: {
    title: 'Gamle fangster',
    mount: fangster.mount,
  },
  ture: {
    title: 'Ny tur',
    mount: ture.mount,
  },
  statistik: {
    title: 'Statistik',
    mount: statistik.mount,
  },
  galleri: {
    title: 'Fotogalleri',
    mount: album.mount,
  },
  drone: {
    title: 'Drone',
    mount: drone.mount,
  },
  kort: {
    title: 'Kort',
    mount: kort.mount,
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
        <p class="muted">Karpeloggen version ${VERSION}</p>
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

let adgangOk = false;
addEventListener('adgang-aendret', () => { adgangOk = false; render(); });

async function render() {
  // Kun godkendte medlemmer må bruge appen
  if (!adgangOk) {
    document.body.classList.add('laast');
    if (!(await adgang.tjek(view, title))) return;
    adgangOk = true;
    document.body.classList.remove('laast');
  }
  const key = location.hash.replace(/^#\//, '') || 'ture';
  const route = routes[key] || routes.ture;
  title.textContent = route.title;
  document.title = `${route.title} – Karpeloggen`;
  if (route.mount) { view.innerHTML = ''; route.mount(view); } else view.innerHTML = route.html;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.route === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (key === 'indstillinger') { setupInstall(); adgang.visKonto(view); }
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
  // Når en ny version er klar, genindlæses siden én gang, så den nye kode bruges med det samme.
  const havdeSw = !!navigator.serviceWorker.controller;
  let genindlæst = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (havdeSw && !genindlæst) { genindlæst = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((r) => {
    // Tjek for ny version, når appen kommer frem igen (fx fra baggrunden på telefonen)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update(); });
  });
}
