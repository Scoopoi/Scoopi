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
  - Venner tilføjes med invitationskode/link. Kun egne ture kan rettes; andres kan ses.
  - Lokal-først: IndexedDB er stadig hovedlager (virker offline); delte ture synkroniseres op/ned, når der er net.
  - Venter på at Scoopi opretter et Supabase-projekt (EU-region) og sender Project URL + anon public key (må gerne stå i koden; sikkerheden ligger i Row Level Security). **Aldrig** service_role-nøglen.
- **Gamle fangster:** Fangster → "📅 Gammel fangst" med ca. måned (eller "ved ikke") og år. Gemmes som tur med `cirka: 'maaned'|'aar'` (dato = 15. i måneden / 1. juli), vises som "ca. juni 2018". Ingen vejr, tæller ikke i timer; tæller i rekorder, kendte fisk og samme-fisk. Billedets EXIF-dato foreslås automatisk ("Brug den dato").
- **Udseende "Spejlskæl":** appen hedder **Karpeloggen**. Oliven/guld-tema bygget på Scoopis egne billeder: `img/hero.jpg` (spejlkarpe, kun fisken – ingen ansigter på den offentlige side), `img/skael-tile.jpg` (zoomede skæl fra en lille fisk, spejlet så mønstret gentages uden samlinger) som baggrund overalt, `img/logo.png` og app-ikoner fra karpens hoved.
- **"Brug billedets data":** `js/exif.js` læser EXIF (DateTimeOriginal + GPS) fra billeder. Ved upload tilbydes knappen i fiskens felt; den udfylder tidspunkt, position og stedets navn (nærmeste tidligere sted inden for 1,5 km). I Ny tur sættes turens start/position, hvis de mangler. Android fjerner ofte GPS fra billeder valgt i browseren; tidspunktet virker normalt.
