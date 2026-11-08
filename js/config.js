// Forbindelse til Karpeloggens Supabase-projekt.
// Publishable key må gerne stå her: den er lavet til browsere, og sikkerheden ligger i databasens regler (RLS).
// Den hemmelige nøgle (secret / service_role) må ALDRIG stå i koden.
export const SUPABASE_URL = 'https://kbcplktbeppmyhuqojkq.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_vFIRFKFWHBQvf142HDtOnA_prJeO0Ir';
// Login sker med brugernavn + adgangskode. Supabase kræver en e-mail, så brugernavnet laves om til en intern adresse,
// der aldrig får post (e-mail-bekræftelse skal derfor være slået fra i Supabase).
export const BRUGER_DOMAENE = 'brugere.karpeloggen.app';
