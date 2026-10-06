"""Reproducible coverage inventory and a compact, offline native-test package."""
import csv
import hashlib
import html
import io
import json
import math

from .mathcad import Node, blocks, compile_entry, compile_formula, number, op, serialize, unit_expression, variable
from .mathcad_check import check_formula, unit_quantity

# Existing source-example numbers, used for verification only, never UI defaults.
EXAMPLE_INPUTS = {
    "I01": {"U": 24, "R": 12}, "I03": {"P": 150, "R": .96},
    "R04": {"ρ": .0175, "l": 300, "S": 10}, "R09": {"E": 12.4, "U_kl": 11.2, "I": 6},
    "C20": {"U_s": 440, "u_0": 0, "R": 220, "C": .0001, "t": .022},
    "VH02": {"n": 2, "R": 8.314, "T": 300, "V": .05},
    "VH16": {"p_1": 100000, "V_1": .1, "V_2": .2},
    "VH17": {"p_1": 100000, "V_1": .1, "V_2": .2, "κ": 1.4},
    "MO03": {"p_i": 1000, "V_s": .02, "c": 6, "n": 600},
    "MO04": {"p_i": 1000, "V_s": .02, "c": 6, "n": 600},
    "MO13": {"c_b": .2, "h_i": 42000}, "MO19": {"r": 18, "κ": 1.4, "φ": 2},
    "MO20": {"h": 11, "c": 86, "s": 1, "o": 0, "f": 2},
    "MO21": {"h": 11, "c": 86, "s": 1, "o": 0},
}


def reports(catalogs):
    rows, summaries = [], []
    entries = {e["id"]: e for c in catalogs for e in c["entries"]}
    for catalog in catalogs:
        main_count = 0
        for entry in catalog["entries"]:
            compiled = compile_entry(entry)
            numerically_checked = False
            if entry["id"] in EXAMPLE_INPUTS:
                formula = compiled["formulas"][0]
                symbols = entry["mathcad_metadata"]["symbols"]
                result = check_formula(formula["xml"], symbols, EXAMPLE_INPUTS[entry["id"]])
                value = result.value / unit_quantity(symbols[formula["output"]]["unit"]).value
                if not math.isclose(value, entry["example_check"]["expected"], rel_tol=1e-9, abs_tol=1e-12):
                    raise ValueError("Mathcad-eksporten afviger fra kildeeksemplet: " + entry["id"])
                numerically_checked = True
            main_count += sum(f["field"] == "main" for f in compiled["formulas"])
            for block in compiled["coverage"]:
                rows.append({"catalog": catalog["id"], "entry_id": entry["id"],
                             "field": block["field"], "index": block["index"],
                             "formula": block["latex"], "export_formula": block["export_latex"],
                             "status": "supported-structured", "nodes": ",".join(block["nodes"]),
                             "dimensions_checked": block["field"] == "main",
                             "export_numerically_checked": numerically_checked and block["field"] == "main",
                             "source_example_arithmetic_checked": bool(entry.get("example_check")) and block["field"] == "example",
                             "native_tested": False,
                             "xml_sha256": hashlib.sha256(block["xml"].encode()).hexdigest()})
        summaries.append({"catalog": catalog["id"], "entries": len(catalog["entries"]),
                          "main_variants": main_count, "main_dimensions_checked": True,
                          "source_examples_checked": sum(bool(e.get("example_check")) for e in catalog["entries"]),
                          "native_tested": 0})
    report = {"schema_version": 1, "summary": summaries, "blocks": rows,
              "limits": "Native insertion has not been run in this environment. Source-example arithmetic checks do not imply numerical execution of every emitted XML block.",
              "blockers": []}
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader(); writer.writerows(rows)
    probes = []
    definitions = [Node("define", children=(variable(n), op("scale", number(v), unit_expression(u))))
                   for n, v, u in [("E", 12, "V"), ("U_kl", 10, "V"), ("I", 1, "A")]]
    if "R09" in entries:
        definitions.extend(compile_formula(entries["R09"]["latex"], entries["R09"]["mathcad_metadata"]))
    definitions.append(Node("eval", children=(variable("r_i"), Node("override", children=(unit_expression("Ω"),)))))
    if "R09" in entries:
        probes.append({"id": "reference-v0.5", "label": "Reference: E=12 V, U_kl=10 V, I=1 A; forventet r_i=2 Ω",
                       "xml": serialize(definitions, "reference"), "status": "user-verified method; new serializer requires confirmation"})
    representatives = [("I03", "Kvadratrod og enheder"), ("R08", "Sum, arrayindeks og negativ potens"),
                       ("N02", "Vektorsummer"), ("R05", "Absolut temperatur og temperaturforskel"),
                       ("MO22", "Massestrømme med priknotation"),
                       ("U07", "Indlejrede brøker og summer"), ("N01", "Knuderelation og matrixindeks"),
                       ("C20", "Funktionsdefinition og eksponentialfunktion"), ("C22", "Logaritme og unary minus"),
                       ("F03", "Skalær gange vektor"), ("E02", "Afledt af fluxfunktion"),
                       ("VH09", "Bestemt integral"), ("VH22", "Parametriseret reversibelt procesintegral"),
                       ("VH26", "Parametriseret lukket cyklus"), ("MO03", "rpm med korrekt dimensionsfaktor"),
                       ("MO13", "Omregningskoefficient 3600 kJ/kWh"), ("MO20", "Empiriske koefficienter og masseprocenter")]
    for code, label in representatives:
        if code not in entries:
            continue
        compiled = compile_entry(entries[code])
        probes.append({"id": code, "label": label, "xml": compiled["formulas"][0]["xml"],
                       "note": compiled["note"], "example_xml": compiled["example_xml"], "status": "not native tested"})
    for code, field, token, label in [("P05", "pitfall", r"\prod", "Produktoperator"),
                                     ("E03", "steps", r"\times", "Vektorkrydsprodukt"),
                                     ("M04", "steps", r"\circ", "Grader og radianer"),
                                     ("U02", "steps", r"\ne", "Ulighedsrelation")]:
        if code in entries:
            block = next(b for b in compile_entry(entries[code])["coverage"] if b["field"] == field and token in b["latex"])
            probes.append({"id": code + "-" + field, "label": label, "xml": block["xml"], "status": "not native tested"})
    return report, output.getvalue(), probe_html(probes)


def probe_html(probes):
    cards = []
    for probe in probes:
        cards.append(f'<section><h2>{html.escape(probe["id"] + " · " + probe["label"])}</h2><p>{html.escape(probe.get("note", ""))}</p><label>Formel / reference</label><textarea readonly>{html.escape(probe["xml"])}</textarea><button>Kopiér XML</button>')
        if probe.get("example_xml"):
            cards.append(f'<label>Kildebaseret regneeksempel</label><textarea readonly>{html.escape(probe["example_xml"])}</textarea><button>Kopiér eksempel</button>')
        cards.append('</section>')
    return '''<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mathcad Prime 11 · prøvepakke</title><style>body{font:16px system-ui;max-width:860px;margin:30px auto;padding:0 16px}textarea{display:block;width:100%;height:100px;box-sizing:border-box}section{border-top:1px solid #aaa;padding:16px 0}button{padding:12px;margin:8px 0}h2{font-size:20px}</style><h1>Mathcad Prime 11 · prøvepakke</h1><p>Vælg “Kopiér XML” og indsæt med Ctrl+V på et tomt sted i Prime 11. Kontrollér redigerbare operatorer, navneindeks og enhedsmærkning. For formler med frie variable skal input først defineres; appens Mathcad-valg kan kopiere dem samlet.</p><p>Metoden fra prøve 0.5 er brugerbekræftet. Denne eksportørs konstruktioner er strukturvalideret; pakken er ikke native-afprøvet i dette miljø. Registrér konstruktion, Prime-version, indsættelsesresultat og enhedskontrol efter afprøvning.</p><p id="status" role="status"></p>''' + "".join(cards) + '''<script>document.addEventListener('click',async e=>{if(e.target.tagName!=='BUTTON')return;const input=e.target.previousElementSibling;let copied=false;try{await navigator.clipboard.writeText(input.value);copied=true;}catch{const handler=event=>{if(event.clipboardData){event.clipboardData.setData('text/plain',input.value);event.preventDefault();copied=true;}};document.addEventListener('copy',handler);try{input.focus();input.select();document.execCommand('copy');}finally{document.removeEventListener('copy',handler);}}document.getElementById('status').textContent=copied?'XML kopieret. Indsæt i Prime med Ctrl+V.':'XML markeret; kopiér med Ctrl+C.';});</script></html>'''
