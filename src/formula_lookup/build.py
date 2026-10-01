"""Build a single offline HTML file from independently validated catalogs."""
import base64
import copy
import hashlib
import json
import tempfile
from pathlib import Path

from .catalog import validate_catalog, validate_catalog_sources
from .math_render import MATH_STYLE, formula_png, math_blocks, markup_search_text, math_search_text

WEB = Path(__file__).parent / "web"


def validate_catalogs(catalogs):
    if len({c["id"] for c in catalogs}) != len(catalogs):
        raise ValueError("Dublerede emnekoder.")
    ids = []
    for catalog in catalogs:
        validate_catalog(catalog)
        validate_catalog_sources(catalog)
        ids.extend(e["id"] for e in catalog["entries"])
    if len(set(ids)) != len(ids):
        raise ValueError("Formelkoder skal være unikke på tværs af fag.")
    return {"catalogs": len(catalogs), "entries": len(ids),
            "checked_examples": sum(bool(e.get("example_check")) for c in catalogs for e in c["entries"])}


def export_catalogs(catalogs, output, settings=None, cache=None):
    from PIL import Image
    validate_catalogs(catalogs)
    catalogs = copy.deepcopy(catalogs)
    for catalog in catalogs:
        catalog.setdefault("notes", [])
        for source in catalog.get("source_inventory", []):
            source.setdefault("pages", len(source.get("slides", [])))
            source.pop("slides", None)  # Only citations belong in the public app.
        for entry in catalog["entries"]:
            for field in ("page", "card_slide_id", "index_slide_id"):
                entry.pop(field, None)
    payload = {"catalogs": catalogs, "math_style": MATH_STYLE, "math_assets": {}, "search_text": {}}
    payload["data_hash"] = hashlib.sha256(json.dumps(catalogs, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    settings = settings or {}
    payload["cheatsheet_version"] = payload["data_hash"][:12]
    payload["feedback_email"] = settings.get("feedback_email", "")
    color = settings.get("math_color", "17324D")
    with tempfile.TemporaryDirectory(prefix="formelopslag-math-") as temporary:
        cache = Path(cache) if cache else Path(temporary)
        for entry in (e for c in catalogs for e in c["entries"]):
            equations = [entry["latex"]]
            for field in ("steps", "conversion", "pitfall", "example"):
                equations.extend(s for kind, s in math_blocks(entry.get(field, "")) if kind == "math")
            payload["search_text"][entry["id"]] = "\n".join(markup_search_text(entry.get(f, "")) for f in ("steps", "conversion", "pitfall", "example"))
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
    html = html.replace("__SCRIPT__", WEB.joinpath("app.js").read_text(encoding="utf-8"))
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html.replace("__DATABASE__", serialized), encoding="utf-8")
    return output
