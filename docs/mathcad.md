# Kopiér til Mathcad Prime 11

“Kopiér til Mathcad” kopierer opslagets første hovedformel som redigerbar
worksheet50/math50-matematik i `text/plain`. Indsæt på et tomt sted i Prime med
Ctrl+V. “Mathcad-valg” vælger en alternativ beregningsvej, egne inputdefinitioner,
et udvalg af opslagets beregningsformler eller det eksisterende regneeksempel.
Formelvælgeren indeholder også matematik fra omregninger, bemærkninger og forklaringer.
De samme handlinger findes i søgeresultater, gemte opslag og direkte links.
Den genererede `index.html` indeholder eksportdata og hele brugerfladen offline.

## Input og beregningsforløb

Ingen input er forhåndsudfyldt. Punktum og dansk decimalkomma accepteres.
Enheder og betydninger kommer fra det aktuelle katalog og opslagets lookup,
suppleret af eksplicitte bindinger i `catalogs/mathcad.json`.
Dimensionløse brøker indtastes som fx 0,9; MO20/MO21 kræver procentpoint som fx 11.
Masseprocenter ommærkes ikke til enheden `%`, som ville ændre talværdien til 0,11.

Vektorer indtastes med semikolon; matricer har semikolon mellem kolonner og
linjeskift mellem rækker. Arrayindeks starter ved 1; eksporten sætter ORIGIN:=1.
XML gemmer matrixværdier kolonnevis som i PTC's M[i,j]=i+j²-eksempel;
en regression med en ikke-symmetrisk matrix kontrollerer rækkefølgen.
En indekssekvens indtastes som `første;sidste` og eksporteres som et Mathcad-range.
Tal som R₁ er navneindeks, medmindre opslagets eksplicitte metadata angiver array.
Rₖ under en sum og R_ab i knudeligningen er derimod array-/matrixindeks.

Et funktionsinput er et taludtryk i den dimensionsløse parameter x. Dialogen
angiver parameterens normalisering og funktionsværdiernes enhed: fx x=t/s og
resultat i Wb. `2*x^2` definerer da Φ(t):=(2*(t/s)^2)*Wb. Udtrykket understøtter
tal, x, konstanterne pi/π og e, +, -, *, /, ^, parenteser, sqrt, ln, log, exp, sin, cos og tan; ingen
JavaScript, LaTeX, implicit multiplikation eller vilkårlige funktionskald udføres.
Definitionerne placeres før de formler, der bruger dem. Forløb med en cirkulær
afhængighed, dobbelte definitioner eller modstridende enheder afvises.

## Matematisk fortolkning

Python parser katalogets matematiske dialekt til en eksplicit AST. Tal, variable,
enheder, konstanter, funktioner, literal subscripts, arrayindeks, operatorer,
definitioner, relationer og evalueringer er forskellige node-typer. En struktureret
XML-serializer skifter default namespace ved overgangen til matematik/XAML;
der tilføjes ingen namespace med regex og ingen strukturel tekst eller ekstra `>`.
Unit-id'er har altid `labels="UNIT"`, uden `label-is-contextual`.

En kæde som G=1/R=I/U bliver to alternative definitioner, som kan vælges separat.
Knude- og sløjfeligninger forbliver relationer. |I|=… definerer den positive
størrelse I; Mathcad får et redigerbart navn på venstresiden og absval på de
relevante højresider. Startstrøm i(0) eksporteres som i₀, med en note i dialogen.
Regneeksemplers afrundede facit bruges ikke som nye beregningsinput.
De to ≠-betingelser eksporteres ækvivalent som ¬(x=y) med PTC's dokumenterede
not/equal-tags; et ukontrolleret direkte tag-navn for ≠ antages ikke.

Omdrejningstal n i rpm erstattes i formler med eksplicit /60 eller /120 af
`(n/rpm)/s`. Den dokumenterede talværdi i rpm bevares, mens tidsdimensionen
tilføjes; Mathcads rpm-enhed ville ellers allerede indføre omregningen.
MO13's 3600 mærkes kJ/kWh. MO20's empiriske koefficienter mærkes kJ/kg pr.
procentpoint efter MOB:167. W05 tilbyder særskilte masse-/volumenveje med
henholdsvis MJ/kg og MJ/m³. R05/R06 bruger absolut °C; ΔT bruger K.
R05's omregningsrelation for en temperaturforskel bruger UNIT Δ°C i XML,
så den ikke behandles som en absolut Celsius-temperatur med nulpunktsoffset.
Kildens timer h eksporteres med Primes enhedsnavn hr. Ah og kWh eksporteres
som A·hr og kW·hr; talværdier og dimensioner bevares.

Mathcad-operatorer for et uparametriseret reversibelt procesintegral og et lukket
pV-kurveintegral er ikke antaget. De eksporteres med følgende ækvivalente,
dimensionskontrollerede parametriseringer; original katalogtekst bevares:

- VH22: ΔS:=∫₀¹ Q′rev(ξ)/T(ξ) dξ. Qrev er kumulativ reversibel varme langs
  processen; T er absolut temperatur langs samme proces.
- VH26: W_net:=∫₀¹ p(ξ)V′(ξ) dξ. De to funktioner skal beskrive hele den lukkede
  cyklus med den valgte retning og slutte i samme tilstand, som de begynder.

Der indsættes ingen gættet proceskurve eller numeriske standardværdier.
Anvisningerne vises i opslagets Mathcad-dialog. Et almindeligt integral med
ens volumen-grænser ville ikke gengive nettoarbejdet i en pV-cyklus.

## PTC-proveniens for XML-konstruktionerne

Metoden til text/plain-kopiering og worksheet/regions kommer fra PTC's
[Prime 11 page.js](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/scripts/page.js)
og [Prime 12 page.js](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/scripts/page.js).
Prøve 0.5 er brugerbekræftet i Mathcad; den nye serializer og hele kataloget er
ikke derved native-afprøvet. De nye operatorer følger autentiske regions-XML:

| Konstruktion | PTC-eksempel |
| --- | --- |
| pow, plus/minus, mult/scale, parens, neg | [Simplifying expressions](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/simplifying_expressions.html) |
| function/boundVars, nthRoot, indexer | [User-defined functions](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/about_user-defined_functions.html) |
| summation/product, lambda, boundVars, range, grænser | [Sums and products](https://support.ptc.com/help/engineering_notebook/r11.0/en/PTC_Mathcad_Help/example_sums_and_products.html) |
| integral/lambda/lowerBound/upperBound | [Definite integration](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/example_eff_of_tol_and_meth_on_def_int.html) |
| derivative/lambda/degree/placeholder | [Derivatives](https://support.ptc.com/help/engineering_notebook/r11.0/en/PTC_Mathcad_Help/to_evaluate_derivatives_symbolically.html) |
| matrix og indexer/sequence | [Matrix indexing](https://support.ptc.com/help/engineering_notebook/r11.0/en/PTC_Mathcad_Help/example_row_column_and_index_operators.html) og [Matrix values](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/Tutorials/gs_tutorial/task5-2_formatting_a_plot.html) |
| crossProduct | [Vector algebra](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/example_vector_algebra.html) |
| not/equal og lessThan/greaterThan | [Boolean operators](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/example_boolean_operators.html) og [Comparison expressions](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/example_plotting_inequalities_and_piecewise_functions.html) |
| CONSTANT e og funktioner | [Symbolic rewriting](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/example_simplify_rewrite_expressions.html) |
| XAML Span/Subscript, UNIT °C og Δ°C | [Working with temperatures](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/example_working_with_temperatures.html) |
| UNIT hr og min | [Converting hhmmss to time](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/example_converting_hhmmss.html) |

## Dækning og verifikation

Build genererer `mathcad-coverage.json`, `mathcad-coverage.csv` og den selvstændige
offline-prøvepakke `mathcad-probes.html` sammen med appen. Oversigten opdeler
hver blok efter katalog, opslag-ID, felt, kildeformel, eksportformel, AST-noder,
XML-checksum, strukturstatus, dimensionskontrol og native-teststatus.
Alle hovedformler eksporteres; alle 554 matematiske blokke strukturvalideres.
De 176 opslag omfatter 125 EL, 28 varmelære og 23 motorlære.

Hovedformlernes dimensioner kontrolleres uafhængigt ud fra den genererede XML.
Eksporteret XML regnes desuden efter med dokumenterede tal fra hvert katalog,
blandt andet rødder, resistivitet, gaslov, logaritme, rpm, MO13 og MO20/MO21.
Projektets 94 eksisterende aritmetiske eksempelkontroller bevares. Dette er
hverken en implementering af Mathcad eller numerisk afprøvning af alle
integraler, afledte, array- og funktionskonstruktioner.

Chromium-testen kopierer hver hovedformel i offline-HTML og undersøger XML,
inputvalidering, arbejdsrækkefølge, avancerede input, søgeresultater/gemte opslag,
direkte links, navigator.clipboard, text/plain-copy-event og lytteroprydning samt
markeret Ctrl+C-fallback. Desktop og mobil 320/390 px kontrolleres.

Native-indsættelse er endnu ikke kørt i dette miljø, hvor Prime ikke findes.
Prøvepakken indeholder referenceforløbet med forventet 2 Ω og repræsentanter
for de øvrige konstruktioner. Ingen blok angives som native-afprøvet før en
faktisk indsættelse er registreret. Originale kilder og SHA256 bevares.

```sh
.venv/bin/formelopslag validate
.venv/bin/python -m pytest -q
.venv/bin/formelopslag build
node test_browser.cjs
```
