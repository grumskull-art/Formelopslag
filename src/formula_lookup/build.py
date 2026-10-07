"""Build a single offline HTML file from independently validated catalogs."""
import base64
import copy
import hashlib
import json
import tempfile
from pathlib import Path

from .catalog import validate_catalog, validate_catalog_sources
from .math_render import MATH_STYLE, formula_png, math_blocks, markup_search_text, math_search_text
from .mathcad import compile_entry

WEB = Path(__file__).parent / "web"


def _web_bytes(names):
    chunks = []
    for name in names:
        path = WEB.joinpath(name)
        if path.exists():
            chunks.append(path.read_bytes())
    return b"".join(chunks)


def _web_text(names):
    parts = []
    for name in names:
        path = WEB.joinpath(name)
        if path.exists():
            parts.append(path.read_text(encoding="utf-8"))
    return "\n".join(parts)


def validate_catalogs(catalogs):
    if len({c["id"] for c in catalogs}) != len(catalogs):
        raise ValueError("Dublerede emnekoder.")
    ids = []
    for catalog in catalogs:
        validate_catalog(catalog)
        validate_catalog_sources(catalog)
        for entry in catalog["entries"]:
            if entry.get("mathcad_metadata"):
                compile_entry(entry)
        ids.extend(e["id"] for e in catalog["entries"])
    if len(set(ids)) != len(ids):
        raise ValueError("Formelkoder skal være unikke på tværs af fag.")
    return {"catalogs": len(catalogs), "entries": len(ids),
            "checked_examples": sum(bool(e.get("example_check")) for c in catalogs for e in c["entries"])}


def export_catalogs(catalogs, output, settings=None, cache=None):
    from PIL import Image
    validate_catalogs(catalogs)
    from .mathcad_report import reports
    coverage, coverage_csv, probes = reports(catalogs)
    catalogs = copy.deepcopy(catalogs)
    for catalog in catalogs:
        catalog.setdefault("notes", [])
        for source in catalog.get("source_inventory", []):
            source.setdefault("pages", len(source.get("slides", [])))
            source.pop("slides", None)  # Only citations belong in the public app.
        for entry in catalog["entries"]:
            entry["mathcad"] = compile_entry(entry)
            # The inventory is written separately; the offline UI needs only XML.
            entry["mathcad"].pop("coverage")
            entry.pop("mathcad_metadata", None)
            for field in ("page", "card_slide_id", "index_slide_id"):
                entry.pop(field, None)
    payload = {"catalogs": catalogs, "math_style": MATH_STYLE, "math_assets": {}, "search_text": {}}
    payload["data_hash"] = hashlib.sha256(json.dumps(catalogs, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    settings = settings or {}
    version_content = _web_bytes(("index.html", "app.css", "app.js", "mathcad.js", "water.js", "gas.js", "motor.js"))
    version_content += json.dumps(settings, ensure_ascii=False, sort_keys=True).encode()
    version_content += payload["data_hash"].encode()
    payload["cheatsheet_version"] = hashlib.sha256(version_content).hexdigest()[:12]
    payload["feedback_email"] = settings.get("feedback_email", "")
    payload["source_base_url"] = settings.get("source_base_url", "")
    color = settings.get("math_color", "17324D")
    with tempfile.TemporaryDirectory(prefix="formelopslag-math-") as temporary:
        cache = Path(cache) if cache else Path(temporary)
        for entry in (e for c in catalogs for e in c["entries"]):
            equations = [entry["latex"]]
            for field in ("steps", "conversion", "pitfall", "example", "explanation"):
                equations.extend(s for kind, s in math_blocks(entry.get(field, "")) if kind == "math")
            payload["search_text"][entry["id"]] = "\n".join(markup_search_text(entry.get(f, "")) for f in ("steps", "conversion", "pitfall", "example", "explanation"))
            for latex in equations:
                if latex in payload["math_assets"]:
                    continue
                asset = formula_png(latex, cache, color)
                with Image.open(asset) as image:
                    width, height = image.size
                payload["math_assets"][latex] = {
                    "src": "data:image/png;base64," + base64.b64encode(asset.read_bytes()).decode(),
                    "width": width / 220 * 96, "height": height / 220 * 96, "search": math_search_text(latex)}
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c")
    html = WEB.joinpath("index.html").read_text(encoding="utf-8")
    # Replace the JSON last so catalog text cannot become a template instruction.
    html = html.replace("__STYLES__", WEB.joinpath("app.css").read_text(encoding="utf-8"))
    html = html.replace("__SCRIPT__", _web_text(("gas.js", "motor.js", "water.js", "app.js", "mathcad.js")))
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html.replace("__DATABASE__", serialized), encoding="utf-8")
    output.with_name("mathcad-coverage.json").write_text(json.dumps(coverage, ensure_ascii=False, indent=2), encoding="utf-8")
    output.with_name("mathcad-coverage.csv").write_text(coverage_csv, encoding="utf-8")
    output.with_name("mathcad-probes.html").write_text(probes, encoding="utf-8")
    return output
