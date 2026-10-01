"""Standalone build, validation and local preview commands."""
import argparse
import copy
import functools
import hashlib
import json
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .build import export_catalogs, validate_catalogs


class PreviewHandler(SimpleHTTPRequestHandler):
    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass  # A browser may cancel a large HTML transfer during navigation.


def load_catalogs(config):
    config = Path(config).resolve()
    settings = json.loads(config.read_text(encoding="utf-8"))
    root = (config.parent / settings["project_root"]).resolve()
    if root != config.parent:
        raise ValueError("Projektets data skal ligge i samme mappe som konfigurationen.")
    catalogs = []
    for item in settings["catalogs"]:
        catalog_path = (root / item["path"]).resolve()
        if not catalog_path.is_relative_to(root):
            raise ValueError("Kataloget skal ligge i projektmappen.")
        data = json.loads(catalog_path.read_text(encoding="utf-8"))
        incoming = copy.deepcopy(data.get("catalogs", [data]))
        for catalog in incoming:
            if "id" not in catalog:
                catalog.update(id=item["id"], discipline=item["discipline"], topic=item["topic"])
            source_root = root / item.get("sources_root", "")
            for source in catalog["source_inventory"]:
                path = (source_root / source["file"]).resolve()
                if not path.is_relative_to(root):
                    raise ValueError("Kildefilen skal ligge i projektmappen.")
                if not path.is_file():
                    raise ValueError("Fysisk kildefil mangler: " + str(path))
                if source.get("sha256") and hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
                    raise ValueError("Kildens kontrolsum har ændret sig: " + source["id"])
            catalogs.append(catalog)
    validate_catalogs(catalogs)
    return catalogs, settings


def main(argv=None):
    parser = argparse.ArgumentParser(prog="formelopslag", description="Selvstændigt, offline formelopslag til EL og TM")
    default_config = "project.json"
    parser.add_argument("--config", default=default_config, help="sti til opslagets egen konfiguration")
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="byg offline HTML uden at generere præsentationer")
    build.add_argument("--output", type=Path, default=Path("docs/index.html"))
    commands.add_parser("validate", help="kontrollér kataloger, kilder og regneeksempler")
    serve = commands.add_parser("serve", help="byg og vis lokalt i en browser")
    serve.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)
    try:
        catalogs, settings = load_catalogs(args.config)
        if args.command == "validate":
            print(json.dumps(validate_catalogs(catalogs), ensure_ascii=False))
        elif args.command == "build":
            print(export_catalogs(catalogs, args.output, settings))
        else:
            with tempfile.TemporaryDirectory(prefix="formelopslag-site-") as temporary:
                export_catalogs(catalogs, Path(temporary) / "index.html", settings)
                handler = functools.partial(PreviewHandler, directory=temporary)
                with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
                    print(f"Formelopslag: http://127.0.0.1:{args.port}/", flush=True)
                    server.serve_forever()
    except (ValueError, KeyError, TypeError, OSError, ArithmeticError) as exc:
        parser.exit(1, f"Formelopslag: {exc}\n")
    except KeyboardInterrupt:
        pass
    return 0
