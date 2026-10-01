# Udskillelse af Formelopslag

Projekt: `/home/grumsky/Formelopslag`, eget Git-repository og eget `.venv`.
Ingen runtime-imports eller filopslag i PPmaker. Alle 30 originale kilder har verificerede SHA-256-hashes.
Historiske kilder og præsentationsleverancer i PPmaker er bevaret.

## Filer berørt

- `"sources/EL/EL04/1 J\303\246vnstr\303\270mskredsl\303\270b og kredsl\303\270bsberegninger.pptx"`
- `"sources/EL/EL08/2 Kredsl\303\270bsberegninger (Kirchoff) - L\303\245nt.pptx"`
- `"sources/EL/EL09/2 Kredsl\303\270bsberegninger med kirchhoff.pptx"`
- `"sources/EL/EL10/3 - STA resistansers temperaturafh\303\246ngighed.pptx"`
- `"sources/EL/EL14/4 Faraday lenz hvirvelstr\303\270m selvinduktion induktans bifilar.pptx"`
- `"sources/EL/EL15/6 Kraftp\303\245virkning ledere.pptx"`
- `"sources/TM/MO2/Lektion 3 Dieselmotorens hj\303\246lpesystemer.pptx"`
- `"sources/TM/MOD2/Sp\303\270rgsm\303\245l til filmen How diesel engines work part 1.docx"`
- `.github/workflows/pages.yml`
- `.gitignore`
- `AGENTS.md`
- `MIGRATION.md`
- `README.md`
- `catalogs/el.json`
- `catalogs/tm.json`
- `docs/index.html`
- `project.json`
- `pyproject.toml`
- `requirements-lock.txt`
- `sources/EL/EL01/1 -  4.1 + 4.2 Det magnetiske felt.pptx`
- `sources/EL/EL02/1 - STA Definition af elektriske basisenheder.pptx`
- `sources/EL/EL03/1 Elektrisk felt Coulombs lov.pptx`
- `sources/EL/EL05/2 - 4.3  for den magnetiske kreds formler.pptx`
- `sources/EL/EL06/2 - 4.3 Den magnetiske Kreds+.pptx`
- `sources/EL/EL07/2 - STA Specifik resistans og ledningsevne.pptx`
- `sources/EL/EL11/3 4.4 magnetisering af jern og permanente.pptx`
- `sources/EL/EL12/3 4.7 Induktion.pptx`
- `sources/EL/EL13/4 - for elektrisk energi og effekt.pptx`
- `sources/EL/EL16/6 Leder i magnetfelt.pptx`
- `sources/EL/EL17/2 Kondensator.pdf`
- `sources/EL/EL18/3 Kondensatorer op- og afladning.pdf`
- `sources/TM/MAN/man-l35-44df.pdf`
- `sources/TM/MO1/Lektion 1 og 2 Opstart af fag - motorens funktion og konstruktion overordnet.pptx`
- `sources/TM/MO3/Lektion 4 Dieselmotorens effekter og virkningsgrader.pptx`
- `sources/TM/MOB/Noget om Dieselmotorer version 4.pdf`
- `sources/TM/MOD1/Opgave hovedele for 2-takt diesel.docx`
- `sources/TM/MOD3/Opgave i motoreffekter og virkningsgrader (1).docx`
- `sources/TM/VH1/Lektion 1 og 2 9.14, 9.16-9.19.pptx`
- `sources/TM/VH2/Lektion 3 og 4 9.20-9.21.pptx`
- `sources/TM/VH3/Lektion 5 og 6 9.22-9.27.pptx`
- `sources/TM/VH4/Lektion 7 og 8 9.27 og 9.31-9.33.pptx`
- `src/formula_lookup/__init__.py`
- `src/formula_lookup/__main__.py`
- `src/formula_lookup/build.py`
- `src/formula_lookup/catalog.py`
- `src/formula_lookup/cli.py`
- `src/formula_lookup/math_render.py`
- `src/formula_lookup/web/app.css`
- `src/formula_lookup/web/app.js`
- `src/formula_lookup/web/index.html`
- `test_browser.cjs`
- `tests/test_formula_lookup.py`

## PPmaker-filer berørt

- `.github/workflows/pages.yml`: fjernet; selvstændig workflow i Formelopslag.
- `README.md`: henvisning til selvstændigt projekt.
- `Projects/el-undervisning/cheatsheet/README.md`: markering af historiske leverancer.
- `Projects/el-undervisning/cheatsheet/regenerate.py`: fjernet kopiering til PPmakers webside.

## Ændringsankre

- `project.json`: alle kataloger og kilder ligger inde i dette projekt.
- `load_catalogs()` i CLI: afviser projektrod, kataloger og kildefiler uden for projektet.
- `syncChoice()` i webappen: bevarer den nyeste filtrering uden tomme valgmuligheder.
- `pyproject.toml`, låste krav, workflow og README: selvstændig installation, test og publicering.

## Verifikation

- `.venv/bin/formelopslag validate`: 173 opslag, 87 kontrollerede regneeksempler.
- `.venv/bin/python -m pytest -q`: 22 tests bestået.
- `.venv/bin/formelopslag build`: offline HTML bygget i `docs/index.html`.
- `node test_browser.cjs`: alle 173 opslag og 671 filterkombinationer; ingen fejl eller eksterne kald.
- Lokal server: HTTP 200; desktop og mobil visuelt gennemgået.
- PPmaker: 67 tests bestået; demo valideret med eksisterende review-note om afledte diagramdata.
- `git diff --check`: ingen whitespace-fejl i begge projekter.

Browserrapport og skærmbilleder: `/tmp/formelopslag-browser-VARbDh`.
Tidligere ignorerede byggeartefakter fra PPmaker er bevaret i `/tmp/formelopslag-migration-archive-kz18i9o_/previous-build-artifacts`.
