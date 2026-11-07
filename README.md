# Fiske-app

App til fangstlog, fisketure, prognose og drone-analyse, mest til karpefiskeri.
Det er en PWA, så den kan installeres på Android og virker offline.

Se `CLAUDE.md` for hele planen.

## Kør lokalt

```
python3 -m http.server 8000
```

Åbn http://localhost:8000

## Udgiv på GitHub Pages

1. På GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Flet ændringerne ind i `main`. Så udgives appen automatisk på
   https://scoopoi.github.io/Scoopi/
