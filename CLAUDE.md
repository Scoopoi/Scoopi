# Fiske-app – projektbrief

Læg denne fil i roden af repoet `fiske-app`. Claude Code læser den automatisk.

## Om ejeren
- Scoopi, Hvidovre (Danmark). Fisker mest efter karper, også andre arter.
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
- Hvilken drone (for at vide om der kommer `.SRT`-filer)?
