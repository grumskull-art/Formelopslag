# Formelopslag

Selvstændigt offline formelopslag til elektroteknik, varmelære og motorlære.
176 kildehenviste opslag, global søgning, direkte links, gemte opslag, temaer,
tastaturbetjening og udskrivning. Kataloger, originaldokumenter, kode og test
ligger i dette projekt; appen læser ikke fra andre projekter.

## Samarbejde på GitHub

Vi arbejder og committer på `develop`. `main` opdateres gennem en PR efter
gennemgang, én godkendelse fra en anden samarbejdspartner og beståede kontroller.
GitHub beskytter `main` mod direkte pushes, også fra administratorer.

```bash
git fetch origin
git switch develop
git pull --ff-only
git config core.hooksPath .githooks
```

Aktivér hook-indstillingen én gang i hver klon. Den afviser commits på andre
branches og pushes til `main`. Push almindeligt med `git push`; brug ikke force.
Hvis I begge har nye commits, stopper `git pull --ff-only`. Flet da med
`git merge origin/develop`, løs eventuelle konflikter og push igen.
En invitation til repoet skal være accepteret, før en makker kan godkende en PR.

Efter push til `develop`: åbn **Actions → Review Formelopslag**, vælg den
seneste kørsel og download artifactet **formelopslag-preview-…**. Pak det ud,
og åbn `index.html` direkte i browseren. Det er den testede branchversion.
Opret derefter en PR med base `main` og compare `develop`; der er også et
preview på PR-kørslen. Behold `develop` efter merge. Synkronisér derefter
`develop` med både makkerens ændringer og den mergede `main`:

```bash
git fetch origin
git switch develop
git pull --ff-only
git merge origin/main
git push
```

Produktsiden publiceres fra `main`.

## Lokal start

Kør fra denne mappe:

```bash
.venv/bin/formelopslag serve --port 8765
```

Åbn `http://127.0.0.1:8765/` i din browser. Tast `/` for at søge. Vælg en
beregningsvej og markér de størrelser, opgaven oplyser. Kontrollér kortets
fysiske betingelser, fortegn og enheder.

Valg af søgt størrelse viser beregningsvejene med krav pr. metode, også før
oplysninger er markeret. Den samlede inputliste er sammenfoldet; kildehuller
viser en afgrænsning uden inputliste. Eksempler og trin kan foldes ud og kommer
med på udskrift. Formler kan kopieres som almindelig tekst eller LaTeX.

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
Katalogerne i `catalogs/` indeholder 94 numerisk kontrollerede eksempler.
De 51 TM-eksempler bruger illustrative værdier og er ikke måledata.
Kildelinks åbner originalfilerne på GitHub og kræver internet; selve opslaget
virker offline. Versionsnummeret omfatter både kataloger, brugerflade og
konfiguration. Publicering kræver også bestået Chromium-browserkontrol.

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
