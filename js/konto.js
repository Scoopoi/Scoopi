// Konto: brugernavn + adgangskode, godkendelse med kode fra administratoren.
import { SUPABASE_URL, SUPABASE_KEY, BRUGER_DOMAENE } from './config.js';

let klientP = null;
export function klient() {
  if (!klientP) {
    klientP = new Promise((resolve, reject) => {
      const lav = () => resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'karpeloggen-login' },
      }));
      if (window.supabase?.createClient) return lav();
      const s = document.createElement('script');
      s.src = './vendor/supabase/supabase.js';
      s.onload = lav;
      s.onerror = () => { klientP = null; reject(new Error('Kunne ikke indlæse login.')); };
      document.head.append(s);
    });
  }
  return klientP;
}

// "Peter Ø." -> "peter-oe" -> peter-oe@brugere.karpeloggen.app
export function tilEmail(brugernavn) {
  const slug = brugernavn.trim().toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `${slug}@${BRUGER_DOMAENE}` : null;
}

const GEMT = 'karpeloggen-profil'; // sidst kendte profil, så appen virker offline
const gemProfil = (p) => { try { p ? localStorage.setItem(GEMT, JSON.stringify(p)) : localStorage.removeItem(GEMT); } catch {} };
export const gemtProfil = () => { try { return JSON.parse(localStorage.getItem(GEMT)); } catch { return null; } };

// Status: { tilstand: 'ude' | 'mangler-profil' | 'afventer' | 'godkendt' | 'afvist', profil, offline }
export async function status() {
  try { if (!(await databaseKlar())) return { tilstand: 'ikke-klar' }; } catch { return offlineStatus(); }
  let sb;
  try { sb = await klient(); } catch { return offlineStatus(); }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { gemProfil(null); return { tilstand: 'ude' }; }
  const { data, error } = await sb.from('profiler').select('*').eq('id', session.user.id).maybeSingle();
  if (error?.code === 'PGRST205') return { tilstand: 'ikke-klar' };
  if (error) return offlineStatus();
  if (!data) return { tilstand: 'mangler-profil' };
  gemProfil(data);
  return { tilstand: data.status, profil: data };
}
// Er databasen sat op (01-brugere.sql kørt i Supabase)? Indtil da kører appen uden login, så ingen låses ude.
let klar = null;
const KLAR = 'karpeloggen-db-klar';
async function databaseKlar() {
  if (klar !== null) return klar;
  const husk = (v) => { try { localStorage.setItem(KLAR, v ? '1' : '0'); } catch {} return (klar = v); };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiler?select=id&limit=1`, { headers: { apikey: SUPABASE_KEY } });
    if (r.ok) return husk(true);
    const j = await r.json().catch(() => ({}));
    if (j.code === 'PGRST205' || j.code === '42P01') return husk(false);
  } catch { /* offline */ }
  // Offline: brug det, vi vidste sidst. Var databasen ikke sat op, kører appen uden login som før.
  let sidst = null; try { sidst = localStorage.getItem(KLAR); } catch {}
  if (sidst === '0') return false;
  throw new Error('offline');
}

function offlineStatus() {
  const p = gemtProfil();
  return p ? { tilstand: p.status, profil: p, offline: true } : { tilstand: 'ude', offline: true };
}

async function oprettelseTilladt() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
  const s = await r.json();
  if (s.disable_signup) return 'Oprettelse af nye brugere er lukket.';
  if (!s.mailer_autoconfirm) return 'Oprettelse virker ikke endnu: administratoren skal slå "Confirm email" fra i Supabase.';
  return null;
}

export async function opret(brugernavn, kode) {
  const navn = brugernavn.trim();
  const email = tilEmail(navn);
  if (!email || navn.length < 2) throw new Error('Brugernavnet skal være mindst 2 tegn.');
  if (kode.length < 6) throw new Error('Adgangskoden skal være mindst 6 tegn.');
  const lukket = await oprettelseTilladt();
  if (lukket) throw new Error(lukket);
  const sb = await klient();
  const { data, error } = await sb.auth.signUp({ email, password: kode, options: { data: { brugernavn: navn } } });
  if (error) throw new Error(/registered|exists/i.test(error.message) ? 'Brugernavnet er optaget.' : oversæt(error.message));
  if (!data.session) throw new Error('Kontoen blev oprettet, men kan ikke logges ind endnu. Bed administratoren slå "Confirm email" fra i Supabase.');
  await lavProfil(navn);
}

export async function lavProfil(brugernavn) {
  const sb = await klient();
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('profiler').insert({ id: user.id, brugernavn: brugernavn.trim() });
  if (error && !/duplicate/i.test(error.message)) throw new Error(/brugernavn/.test(error.message) ? 'Brugernavnet er optaget.' : oversæt(error.message));
}

export async function logInd(brugernavn, kode) {
  const email = tilEmail(brugernavn);
  if (!email) throw new Error('Skriv dit brugernavn.');
  const sb = await klient();
  const { error } = await sb.auth.signInWithPassword({ email, password: kode });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'Forkert brugernavn eller adgangskode.' : oversæt(error.message));
}

export async function logUd() {
  const sb = await klient();
  await sb.auth.signOut();
  gemProfil(null);
}

export async function brugKode(kode) {
  const sb = await klient();
  const { data, error } = await sb.rpc('brug_kode', { kode_ind: kode });
  if (error) throw new Error(oversæt(error.message));
  return data === true;
}

// ---- Administrator ----
export async function medlemmer() {
  const sb = await klient();
  const [{ data: p, error: e1 }, { data: k }] = await Promise.all([
    sb.from('profiler').select('*').order('oprettet'),
    sb.from('koder').select('*'),
  ]);
  if (e1) throw new Error(oversæt(e1.message));
  const koder = Object.fromEntries((k || []).map((x) => [x.bruger_id, x.kode]));
  return p.map((x) => ({ ...x, kode: koder[x.id] || null }));
}
export async function godkend(id) {
  const sb = await klient();
  const { data, error } = await sb.rpc('godkend', { bruger: id });
  if (error) throw new Error(oversæt(error.message));
  return data;
}
export async function afvis(id) {
  const sb = await klient();
  const { error } = await sb.rpc('afvis', { bruger: id });
  if (error) throw new Error(oversæt(error.message));
}

function oversæt(m) {
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Ingen forbindelse. Prøv igen, når der er net.';
  if (/rate limit/i.test(m)) return 'For mange forsøg. Vent lidt og prøv igen.';
  if (/Password should/i.test(m)) return 'Adgangskoden er for svag. Brug mindst 6 tegn.';
  return m;
}
