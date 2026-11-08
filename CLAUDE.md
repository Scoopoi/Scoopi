# Fiske-app – projektbrief

Læg denne fil i roden af repoet `fiske-app`. Claude Code læser den automatisk.

## Om ejeren
- Scoopi, Hvidovre (Danmark). **Appen er kun til karpe- og medefiskeri** (karpe og fredfisk; ingen rovfisk eller havfiskeri. Kunstagn til karper, fx kunstig majs og zig-skum, er med, men ikke rovfiskeagn som blink og wobler).
- Vil have korte svar på enkelt dansk.
- Bruger appen på en Android-telefon og en PC.

## Beslutninger
- **Hosting:** GitHub Pages fra det offentlige repo `fiske-app`. Kun statiske filer, ingen backend.
- **App-type:** PWA (manifest + service worker), så den kan installeres på Android og virker offline.
- **Teknik:** Ren HTML/CSS/JS eller Vite + vanilla/Preact. Holdes simpelt, intet tungt framework.
- **Lagring og sync:** Data gemmes i det **private** repo `fiske-data` via GitHub REST API (contents API).
  - Brugeren indtaster et *fine-grained personal access token* med kun Contents read/write på `fiske-data`. Tokenet gemmes kun lokalt (localStorage) og aldrig i koden.
  - Lokal cache i IndexedDB, så appen virker offline. Sync, når der er net.
  - Én JSON-fil pr. post (fx `catches/2026-11-07T14-30_abc123.json`), så der er færre konflikter mellem tlf og PC.
  - Billeder komprimeres i browseren (maks. ca. 1600 px, JPEG), før de uploades til `photos/`.
- **Drone-videoer gemmes IKKE** i repoet (GitHub tillader maks. 100 MB pr. fil). De analyseres lokalt i browseren. Kun resultatet gemmes: udvalgte frames, kort/overlays og tal.
- **Vejr:** Open-Meteo (gratis, ingen nøgle, tillader kald fra browseren).
  - Prognose og de seneste dage: `api.open-meteo.com/v1/forecast` (med `past_days`)
  - Gamle datoer: `archive-api.open-meteo.com/v1/archive` (har nogle dages forsinkelse)
  - Tjek de præcise parametre i Open-Meteos dokumentation.

## Funktioner

### 1. Fangstlog
- Art, vægt, længde, dato/tid, GPS-position (fra tlf eller valgt på kort), sø/plads, foto(s) og note.
- Ved karpefiskeri også: agntype, smag, farve, rig/forfang og hvilken stang.
- **Vejr hentes automatisk** for tidspunkt og position, også når fangsten tastes ind bagefter. Gemmes på fangsten: temperatur, lufttryk og trykændring de sidste 3–24 timer, vindhastighed og -retning, skydække, nedbør, solop- og nedgang og månefase.

### 2. Fisketure (sessioner), især karper
- Start/slut, sø, antal stænger, agn pr. stang (type, smag, farve) og evt. skift af agn undervejs.
- Fangster kobles til turen og til stangen.
- **Stang-timer** = antal stænger × timer med kroge i vandet.
- Statistik:
  - Stang-timer pr. fisk (i alt, pr. sø, pr. årstid)
  - Bedste smag og farve, målt som **fisk pr. stang-time** (ikke bare flest fisk). Vis også, hvor mange timer hver kombination er testet, så tal med få data ikke snyder.

### 3. Rekorder og album
- Personlige rekorder pr. art (tungeste og længste) og største fisk nogensinde.
- Fotoalbum med filter på art, sø og år.

### 4. Gode fiskedage (prognose)
- Henter 7–16 dages prognose for en valgt sø.
- Sammenligner med vejret ved tidligere fangster og fisketure (også ture uden fangst).
- Giver hver dag en score (fx 1–5 fisk-ikoner) og en kort forklaring, fx "faldende tryk og sydvestenvind, som da du fangede 4 karper i juni".
- Start med en simpel og forklarlig model (lighed med succesfulde ture, vægtet med fangst pr. stang-time). Ingen sort boks.

### 5. Drone-analyse (kører i browseren, bedst på PC)
- Upload en video eller et billede. Spol og vælg frames (`<video>` + canvas).
- **Grøde:** find vegetation med farveindeks (fx Excess Green / HSV-grænser). Vis grøde, åbent vand og bred som overlay. Brugeren kan justere grænserne med sliders.
- **Grødefrie spots:** sammenhængende områder med åbent vand over en minimumsstørrelse. Markér og nummerér dem.
- **Karpetælling:** find blobs i overfladen (form, størrelse og farve). Vis et forslag til antal. Brugeren kan rette med tryk for at tilføje eller fjerne en karpe. Vær ærlig i UI'et: tallet er et estimat.
- **Kort over søen:**
  - Fase 1: gem enkelte frames med overlays som "spot-kort" knyttet til søen.
  - Fase 2: sæt flere frames sammen til et mosaik (OpenCV.js feature matching).
  - Bonus: DJI-droner gemmer en `.SRT`-fil med GPS og højde pr. frame. Hvis den findes, kan spots placeres på et rigtigt kort.
- Resultatet (billeder, spots og tal) gemmes i `fiske-data` under `drone/`.

### 6. Kort
- Leaflet + OpenStreetMap: søer, pladser, fangster og grødefrie spots.

## Byggerækkefølge
1. Projektskelet, PWA, deploy til GitHub Pages
2. Fangstlog + lokal lagring (IndexedDB)
3. Sync med `fiske-data` (token-opsætning, upload, download, billeder)
4. Automatisk vejr på fangster (også gamle datoer)
5. Fisketure, stang-timer og agn-statistik
6. Rekorder og album
7. Gode fiskedage-prognose
8. Drone-analyse: grøde, spots og karpetælling
9. Drone-mosaik og georeference (senere)

## Krav
- Mobil først, men skal også være god på PC-skærm.
- Hele UI'et på dansk. Metriske enheder (kg, cm, °C, m/s, hPa).
- Ingen hemmeligheder i koden. Repoet `fiske-app` er offentligt.
- Gør det let at eksportere og importere alle data som én JSON- eller zip-fil (backup).

## Åbent
- GitHub-brugernavn: scoopoi (koden ligger foreløbig i repoet `scoopoi/scoopi`)
- Drone: **DJI Mini 3 Pro med polfilter** (appen skal virke med DJI-serien generelt). Fisker mest i **Vallensbæk Sø / Tueholm Sø**, men kan være hvor som helst.

## Ændringer undervejs (aftalt med Scoopi)
- **Kun karpe- og medefiskeri:** artsliste = karpe og fredfisk (+ aborre, ål); agn = karpe-/medeagn (boilies, partikler, majs, orm, maddiker …) + kunstagn til karper (kunstig majs, pop-up, zig-skum …); vandtyper = Sø/Å/Kanal/Dam. Karper har feltet *karpetype* (skæl/spejl/læder/lineær).
- Første fane er **Ny tur**, og appen åbner på den. En tur har: dato, stedtype (sø/å/kanal/dam), stedets navn, start/slut, position (GPS) og fangst (eller "ingen fangst").
- Hver fisk: art, vægt, længde, fanget på (agn), smag, farve og **fanget af** (mig eller en vens navn). Venners fangst tæller med i statistikken, men kan filtreres fra.
- Fanen **Rekorder** er erstattet af **Statistik** (rekorder ligger dér): søjlediagrammer for agn, smag og farve (antal fisk), vejr (fisk pr. time, med antal ture og timer), og gennemsnitlig størrelse pr. art pr. sted.
- Vejr gemmes på turen (ved starttidspunktet) og hentes automatisk, når der er net.
- **Drone (første version):** upload video eller billede, spol og vælg frame, automatisk karpetælling med justering (karpelængde i px, følsomhed, mørke/lyse, ignorér grøde), tryk for at tilføje/fjerne. Gemmes lokalt i IndexedDB (store `drone`).
- **Målestok og GPS:** `.SRT` (video) og DJI-XMP (billeder) læses i `js/dji.js`. cm/px = 2·højde·tan(HFOV/2)/bredde; Mini 3 Pro HFOV ≈ 69,7° ved 1x. Karpelængde fra pletten form (2. ordens momenter). Mini 3 Pro's SRT har ingen yaw: retning tages fra flyveretningen eller indtastes.
- **Søkort** (fane i Drone): alle analyser med GPS for en sø lagt på Leaflet-kort (luftfoto), karper farvet efter størrelse, felter (10/25/50 m) med antal, dubletter fra overlappende billeder (<1 m) tælles én gang. Leaflet ligger i `vendor/leaflet/`.
- **Næste drone-trin:** tune detektionen på rigtige optagelser fra Scoopi; evt. egentlig billed-mosaik (OpenCV.js) oven på GPS-placeringen.
- **Fangster-fanen:** hurtig indtastning af én fangst (dato, kl., sted, vandtype, GPS, fisk, billeder, note). Fangsten lægges på en eksisterende tur samme sted, hvis klokkeslættet ligger i turen (også over midnat); ellers oprettes en tur uden sluttid. Under formularen: alle fangster med billede, filter på art, ret (åbner turen) og slet.
- **Fisk** har nu også *kl.* og *billeder*. Billeder komprimeres (maks. 1600 px JPEG) og gemmes i IndexedDB-store `photos`; fiskene har `photoIds`. Fælles fiskefelter ligger i `js/fisk.js`.
- **Nattefiskeri / flere døgn:** en tur har `date`+`start` og `endDate`+`end`. Slutdatoen skifter selv til næste dag, når slut-kl. er før start-kl. (kan rettes manuelt). Hver fisk har `date` (Dag-felt vises, når turen dækker flere dage; vælges automatisk ud fra klokkeslættet). Ældre ture uden `endDate` regnes som før (over midnat hvis slut < start). Hjælpere i `js/util.js`: `slutDato`, `turMinutter`, `udledDato`, `iTur`, `turTid`.
- **Igangværende tur:** "▶ Start tur nu" gemmer turen med `igang: true` og uden slut. Den vises øverst på Ny tur med "+ Ny fangst", "Ret / tilføj" og "⏹ Afslut tur" (sætter slut = nu). Fangster lægges på den igangværende tur (også over flere døgn).
- **Billeder:** ubegrænset antal pr. fisk; "📷 Tilføj billeder" på hver fangst i listen (også dage efter); galleri i fuld skærm (`visGalleri` i `js/fisk.js`), åbnes fra miniaturer og alle "📷 N"-links.
- **Kendte fisk (genfangster):** `js/kendte.js`. Ved ny fangst foreslås tidligere fangster, der kan være samme fisk (samme art, karpetype må ikke afvige, længde/vægt inden for målefejl + vækst pr. år, samme sø vægtes højt). "Sammenlign billeder" viser de to fisks billeder over/ved siden af hinanden (skælmønster). "Samme fisk" kobler fangsterne via `fishId` til en navngivet fisk i store `fish`. Statistik viser "Kendte fisk" med historik og vægtkurve. Automatisk billedgenkendelse (fx OpenCV.js) er ikke lavet endnu.
- **Gruppe (næste trin, valgt: Supabase):** 6-8 venner skal kunne se hinandens ture, fangster og billeder, så genfangster findes på tværs af gruppen. Login via e-mail-link, data i EU.
  - En gruppe har **egne søer** (fx Vallensbæk Sø og Tueholm Sø). Ture i gruppens søer deles automatisk med gruppen (inkl. billeder og kendte fisk). **Ture i alle andre søer forbliver private** og ligger kun hos ejeren.
  - En tur i en gruppesø kan markeres som privat. Man kan være med i flere grupper.
  - Venner tilføjes med invitationskode/link.
  - **Rettigheder:** alle kan rette og slette deres **egne** ture, fangster, billeder og drone-analyser; **ingen** kan slette andres. **Scoopi er administrator** af gruppen og kan slette alt i gruppen. Håndhæves i databasen (Row Level Security: `ejer = auth.uid()` eller rolle `admin` i gruppen), ikke kun i appen.
  - Lokal-først: IndexedDB er stadig hovedlager (virker offline); delte ture synkroniseres op/ned, når der er net.
  - Venter på at Scoopi opretter et Supabase-projekt (EU-region) og sender Project URL + anon public key (må gerne stå i koden; sikkerheden ligger i Row Level Security). **Aldrig** service_role-nøglen.
- **Gamle fangster:** Fangster → "📅 Gammel fangst" med ca. måned (eller "ved ikke") og år. Gemmes som tur med `cirka: 'maaned'|'aar'` (dato = 15. i måneden / 1. juli), vises som "ca. juni 2018". Ingen vejr, tæller ikke i timer; tæller i rekorder, kendte fisk og samme-fisk. Billedets EXIF-dato foreslås automatisk ("Brug den dato").
- **Udseende "Spejlskæl":** appen hedder **Karpeloggen**. Oliven/guld-tema bygget på Scoopis egne billeder: `img/hero.jpg` (spejlkarpe, kun fisken – ingen ansigter på den offentlige side), `img/skael-tile.jpg` (zoomede skæl fra en lille fisk, spejlet så mønstret gentages uden samlinger) som baggrund overalt, `img/logo.png` og app-ikoner fra karpens hoved.
- **"Brug billedets data":** `js/exif.js` læser EXIF (DateTimeOriginal + GPS) fra billeder. Ved upload tilbydes knappen i fiskens felt; den udfylder tidspunkt, position og stedets navn (nærmeste tidligere sted inden for 1,5 km). I Ny tur sættes turens start/position, hvis de mangler. Android fjerner ofte GPS fra billeder valgt i browseren; tidspunktet virker normalt.
- **Kort over søen:** Fangster → "🗺️ Marker din plads og hvor fisken tog" (Leaflet, luftfoto fra Esri). Gemmes på fisken som `plads` og `spot` ({lat, lon}); afstanden vises. Pladsen bruges som turens position (vejr), hvis den mangler. "🗺️ Kort" på fangsten viser begge. Fanen **Kort** (`js/kort.js`) viser alle fangster med huggested (prikstørrelse efter vægt) og pladser, filter på sø. Fælles kortkode i `js/kortvaelger.js`.
- **Agn udfylder smag og farve:** naturlige agn (og kunstige kopier) har fast smag/farve i `AGN_STANDARD` i `js/fisk.js` (fx tigernuts/tigernødder → Tigernuts, Brun; majs → Majs, Gul; hamp → Sort; maddiker → Hvid). For andre agn (fx boilies) bruges den kombination, man oftest har brugt før. Kun tomme felter eller felter appen selv har udfyldt ændres (markeret med guldkant); engelske/alternative navne rettes til det danske, når man forlader feltet.
- **Login og godkendelse (Supabase, trin 1):** `supabase/01-brugere.sql` (køres i Supabase SQL Editor) laver `profiler` og `koder` med RLS og funktionerne `godkend`, `brug_kode`, `afvis`. Kun brugernavnet **Scoopi** kan blive administrator. Login = brugernavn + adgangskode (brugernavnet laves om til `<navn>@brugere.karpeloggen.app`; "Confirm email" skal være slået FRA i Supabase). Nye brugere er 'afventer' og ser kun login/venteside, indtil de taster koden fra administratoren. Administratoren ser "👥 Medlemmer" under Opsætning (godkend → kode, send kode, afvis/fjern adgang). Klientkode: `js/config.js` (URL + publishable key), `js/konto.js`, `js/adgang.js`; supabase-js 2.119.0 ligger i `vendor/supabase/`. Indtil SQL'en er kørt, kører appen uden login ('ikke-klar'). Lokale data (IndexedDB) er stadig kun på enheden; deling af ture/billeder i gruppen er næste trin.
- **Tidsfelter skrives:** alle klokkeslæt er tekstfelter med taltastatur (`data-tid`), ikke telefonens urskive. "1530"→15:30, "930"→09:30, "7"→07:00, "15.30"→15:30; ugyldige markeres med rødt. `normTid`, `gyldigTid`, `startTidsfelter` i `js/util.js`.
- **Stænger og agn pr. stang:** turen har `stænger: [{agn, smag, farve}]` (+/− i formularen; ny tur starter med 1 stang, der arver agn fra første stang på seneste tur, helst samme sted; + tilføjer flere; agn udfylder smag/farve). Fisken har `stang` (nr.); valg af stang udfylder agn/smag/farve. Fangster-siden kan vælge stang på den igangværende tur. Statistik "🎣 Fisk pr. stang-time": stang-timer = timer × stænger (også ture uden fangst), fisk pr. stang-time for agn, smag og farve, med antal stang-timer og "få timer, usikkert" under 10 t. Fisk uden stang knyttes til stangen med samme agn.
- **Album og scan efter genfangster:** Fangster har to visninger øverst: "🐟 Fangster" og "🖼️ Album" (`js/album.js`). Albummet viser alle billeder i et gitter med filter på art/karpetype, sø, år og hvem; tryk åbner galleriet med tekst om fisken. "🔍 Scan efter genfangster" finder par af fangster med billeder, der kan være samme fisk (`scanGenfangster` i `js/kendte.js`, samme sø eller alle søer), med "⇅ Sammenlign", "✓ Samme fisk" (`markerSamme`) og "✗ Ikke samme" (huskes i localStorage). Ingen automatisk skælgenkendelse.
- **Navne:** fanen hedder **Gamle fangster** (rute `#/fangster`). Agnet hedder **Tigernuts** (ikke Tigernødder); gamle data omdøbes én gang ved opstart (`omdøbTigernødder`).
- **Ukendt dato:** under Gammel fangst kan år være "Ved ikke" → `cirka: 'ukendt'`, dato `1900-01-01`, vises "dato ukendt". Sådanne ture tæller **ikke** i statistikken (`iStatistik` i `js/util.js`), men er med i album, kendte fisk og samme-fisk (regnes med op til 5 års vækst). Tomme felter (agn, smag, vægt …) tæller ikke med i de diagrammer, hvor de mangler.
- **Karpetælling v2 og overflyvning:** `js/karpefinder.js` (aflang skabelon i 12 retninger, vandmaske, kropsbredde-tjek, `metode: 'toppe'` med non-max suppression `afstand: 0.55`, længdemåling langs kroppen). Indstillet på Scoopis markerede billede (27 sikre + 5 usikre, markeret i artifact "Karpemarkering" https://claude.ai/artifact/2MC83pnaVn5TxnVDaSsHnU, db `billeder`): finder ca. 17 af 27 med ca. lige så mange falske – derfor er alle fund **"måske"** (blå, stiplet); tryk: måske → sikker → fjernet, tomt sted = ny sikker. Standard: kun lyse (polfilter), følsomhed 65. Drone → video: "▶ Analysér videoen" tager et billede hvert 1–5 sek, læser højde/GPS fra .SRT pr. billede (karpelængde i px = 65 cm / cm-pr-px), måler cm, viser alle billeder med tal; "Forrige/Næste" til gennemgang; samlet tal med dubletter fjernet via GPS (<1,5 m); "💾 Gem hele overflyvningen" gemmer hvert billede (med geo) → søkort. Næste skridt: flere markerede billeder → træne en egentlig model.
- **Trænet karpemodel:** `js/karpemodel.js` (200 beslutningsstubbe, AdaBoost) trænet på Scoopis 14 markerede billeder fra Vallensbæk Sø. `kandidater()` i `js/karpefinder.js` finder pletter (49 træk), modellen giver en sandsynlighed; Følsomhed styrer tærsklen. Test (et billede holdt ude ad gangen): ca. 33 af 98 karper fundet med ca. 90 falske (gammel metode: 55 rigtige, 471 falske). Alle fund er stadig "måske". Flere markerede billeder (især lyse karper) gør den bedre.
- **Prognose fjernet → Galleri:** fanen Prognose er erstattet af **Galleri** (`#/galleri`, `js/album.js`: alle billeder med filter + scan efter genfangster). Album-underfanen på Gamle fangster er fjernet. **Vejr pr. fangst:** `hentManglende()` i `js/vejr.js` henter også vejr til hver fisk (fiskens dato/kl. og huggested/plads/turens position) og gemmer det som `c.weather`; listen under Gamle fangster viser det (ellers turens vejr "ved turens start").
- **Billeder som bunke:** en fisk med flere billeder vises som **ét billede med en bunke bagved og et tal** (CSS `.stak`) i formularen, i listen og i Galleri (én bunke pr. fisk). Tryk åbner alle fiskens billeder i galleriet; i formularen kan de fjernes dér (`visGalleri(..., { fjern })`). Knapperne skifter til "Tilføj flere fra galleri" / "Tag et billede mere".
- **Ret fangst:** "✏️ Ret" på Gamle fangster åbner fangsten i samme formular ("Ret fangst"): dato/kl. eller cirka-dato, sted, vandtype, kort (plads/huggested), fiskens felter, billeder og note. `gemRettelse` i `js/fangster.js`: fangsten bliver på turen, hvis den stadig passer (eller er turens eneste fisk – så rettes turen med); ellers flyttes den til en passende/ny tur. Nyt tidspunkt/sted → vejret hentes igen. Rettelse af en tur i Ny tur beholder nu fiskenes `plads`, `spot`, `weather` og `fishId` (før blev de slettet).
- **Art og karpetype i ét felt:** feltet "Art" har Skælkarpe, Spejlkarpe, Læderkarpe, Lineær karpe, Karpe og de andre arter. Gemmes stadig som `species: 'Karpe'` + `carpType` (`delArt`/`artVisning` i `js/fisk.js`); "spejl" rettes til "Spejlkarpe". Fisken vises som fx "Spejlkarpe 11,6 kg".
- **Nye ord i listerne:** skriver man en ny agn, smag eller farve (fx Boilie + Tun), kommer den straks med i forslagslisten (fælles `change`-lytter i `js/fisk.js`) og ligger der fremover, fordi `datalister()` bygges af gemte fisk **og** stænger. `uniq` ser bort fra store/små bogstaver.
