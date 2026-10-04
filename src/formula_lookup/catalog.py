"""Catalog integrity and reproducible numerical checks, without PowerPoint."""
import ast
import math
import operator
import re
from .math_render import math_blocks


def checked_number(expression):
    tree = ast.parse(expression, mode="eval")
    if sum(1 for _ in ast.walk(tree)) > 100:
        raise ValueError("Regneudtrykket er for stort.")
    operations = {ast.Add: operator.add, ast.Sub: operator.sub,
                  ast.Mult: operator.mul, ast.Div: operator.truediv, ast.Pow: operator.pow}

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value
        if isinstance(node, ast.Name) and node.id == "pi":
            return math.pi
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return -visit(node.operand) if isinstance(node.op, ast.USub) else visit(node.operand)
        if isinstance(node, ast.BinOp) and type(node.op) in operations:
            a, b = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Pow) and abs(b) > 100:
                raise ValueError("Eksponenten er for stor.")
            return operations[type(node.op)](a, b)
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                and node.func.id in {"sqrt", "exp", "ln"}
                and len(node.args) == 1 and not node.keywords):
            return {"sqrt": math.sqrt, "exp": math.exp, "ln": math.log}[node.func.id](visit(node.args[0]))
        raise ValueError("Ugyldigt regneudtryk.")

    result = visit(tree.body)
    if isinstance(result, complex) or not math.isfinite(result):
        raise ValueError("Regneudtrykket skal give et endeligt reelt tal.")
    return result


def validate_catalog(db):
    entries = db["entries"]
    for label, ids in (("formelkoder", [e["id"] for e in entries]),
                       ("emnegrupper", [g["id"] for g in db["navigation_groups"]])):
        if len(set(ids)) != len(ids):
            raise ValueError("Dublerede " + label + ".")
    groups = {g["id"] for g in db["navigation_groups"]}
    for key, aliases in db.get("quantity_aliases", {}).items():
        if (key not in db["quantities"] or not isinstance(aliases, list) or not aliases
                or any(not isinstance(alias, str) or not alias.strip() for alias in aliases)
                or len(set(aliases)) != len(aliases)):
            raise ValueError("Ugyldige størrelsesaliaser: " + key)
    for group, guide in db.get("given_guides", {}).items():
        keys = [k for section in guide["groups"] for k in section["keys"]]
        if (group not in groups or len(keys) != len(set(keys))
                or set(keys) != set(guide["quantities"]) or not set(keys) <= db["quantities"].keys()
                or any(not isinstance(info.get(f), str) or not info[f].strip()
                       for info in guide["quantities"].values() for f in ("label", "help"))):
            raise ValueError("Ugyldig vejledning til oplysninger: " + group)
    for entry in entries:
        code, meta = entry["id"], entry["lookup"]
        origin = entry.get("derived_from")
        if origin is not None and (origin == code or not any(e["id"] == origin for e in entries)):
            raise ValueError("Ukendt oprindeligt opslag: " + code)
        for field in ("id", "seek", "condition", "latex", "explanation"):
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                raise ValueError(f"Tomt eller ugyldigt felt {field}: {code}")
        for field in ("steps", "conversion", "pitfall", "example", "explanation"):
            math_blocks(entry.get(field, ""))
        if meta["group"] not in groups or meta["seek_key"] not in db["quantities"]:
            raise ValueError("Ukendt opslagstype: " + code)
        if not meta["given_sets"] or any(
            not option or len(set(option)) != len(option)
            or meta["seek_key"] in option or any(k not in db["quantities"] for k in option)
            for option in meta["given_sets"]
        ):
            raise ValueError("Ugyldige givne størrelser: " + code)
        if len({tuple(sorted(option)) for option in meta["given_sets"]}) != len(meta["given_sets"]):
            raise ValueError("Dublerede beregningsveje: " + code)
        if not meta["situations"] or any(s not in db["situations"] for s in meta["situations"]):
            raise ValueError("Ukendt fysisk situation: " + code)
        if len(set(meta["situations"])) != len(meta["situations"]):
            raise ValueError("Dublerede fysiske situationer: " + code)
        if entry.get("example_check"):
            check = entry["example_check"]
            if type(check.get("expected")) not in (int, float) or not math.isfinite(check["expected"]):
                raise ValueError("Ugyldigt regneeksempel: " + code)
            if not math.isclose(checked_number(check["expr"]), check["expected"], rel_tol=1e-10, abs_tol=1e-12):
                raise ValueError("Regneeksempel stemmer ikke: " + code)
    unavailable = set(db.get("unavailable_targets", {}))
    if not unavailable <= db["quantities"].keys() or unavailable & {e["lookup"]["seek_key"] for e in entries}:
        raise ValueError("Kildehuller skal have egne mål uden beregningsmetoder.")


def validate_catalog_sources(db):
    inventory = db.get("source_inventory", [])
    sources = {s["id"]: s for s in inventory}
    if len(sources) != len(inventory):
        raise ValueError("Dublerede kildekoder.")
    for entry in [*db["entries"], *db.get("notes", [])]:
        refs = entry.get("source_locations", [])
        if not refs:
            raise ValueError("Kilde mangler: " + entry.get("id", entry.get("title", "")))
        if len(set(refs)) != len(refs):
            raise ValueError("Dublerede kildehenvisninger: " + entry.get("id", entry.get("title", "")))
        for ref in refs:
            match = re.fullmatch(r"([^:]+):([0-9]+(?:-[0-9]+)?(?:,[0-9]+(?:-[0-9]+)?)*)", ref)
            if not match or match[1] not in sources:
                raise ValueError("Ukendt kildehenvisning: " + ref)
            limit = sources[match[1]].get("pages", len(sources[match[1]].get("slides", [])))
            for part in match[2].split(","):
                pages = [int(n) for n in part.split("-")]
                if not 1 <= pages[0] <= pages[-1] <= limit:
                    raise ValueError("Side uden for kilden: " + ref)
