# Formelopslag

Selvstændigt offline formelopslag til elektroteknik, varmelære og motorlære.
176 kildehenviste opslag, global søgning, direkte links, gemte opslag, temaer,
tastaturbetjening og udskrivning. Kataloger, originaldokumenter, kode og test
ligger i dette projekt; appen læser ikke fra andre projekter.

## Start

Kør fra denne mappe:

```bash
.venv/bin/formelopslag serve --port 8765
```

Åbn `http://127.0.0.1:8765/` i din browser. Tast `/` for at søge. Vælg en
beregningsvej og markér de størrelser, opgaven oplyser. Kontrollér kortets
fysiske betingelser, fortegn og enheder.

## Opsætning og kontroller

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-lock.txt
.venv/bin/python -m pip install --no-deps -e .
.venv/bin/formelopslag validate
.venv/bin/python -m pytest -q
.venv/bin/formelopslag build
node test_browser.cjs
```

`docs/index.html` kan åbnes direkte uden server eller internet. De 30 originale
kildefiler er bevaret i `sources/`, og deres SHA256 kontrolleres ved validering.
Katalogerne i `catalogs/` indeholder 90 numerisk kontrollerede eksempler.
De 51 TM-eksempler bruger illustrative værdier og er ikke måledata.

## Mapper

- `src/formula_lookup/`: app, build og brugerflade.
- `catalogs/`: EL- og TM-katalogerne.
- `sources/`: projektets egne originale undervisningskilder.
- `tests/` og `test_browser.cjs`: Python- og browserkontroller.
- `docs/index.html`: den genererede offline app.
- `project.json`: konfiguration, herunder feedbackmodtager.

AC/RLC/trefase, komplette damptabeller og en kildeunderbygget formel for
polytropisk varmekapacitet er udtrykkeligt markerede kildehuller.
Et match på oplyste størrelser beviser ikke alene fysisk gyldighed.
