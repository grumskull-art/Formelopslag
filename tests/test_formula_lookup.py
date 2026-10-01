"""Product separation, provenance, malformed data and numerical regressions."""
import copy
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import pytest

from formula_lookup.build import export_catalogs, validate_catalogs
from formula_lookup.catalog import checked_number, validate_catalog
from formula_lookup.cli import load_catalogs

CONFIG = Path("project.json")


@pytest.mark.parametrize("escape", ["root", "catalog", "source"])
def test_neighboring_project_paths_are_rejected(tmp_path, escape):
    catalogs, _ = load_catalogs(CONFIG)
    catalog = catalogs[0]
    settings = {"project_root": ".", "catalogs": [{"path": "catalog.json"}]}
    if escape == "root":
        settings["project_root"] = ".."
    elif escape == "catalog":
        settings["catalogs"][0]["path"] = "../neighbor/catalog.json"
    else:
        catalog["source_inventory"][0]["file"] = "../neighbor/source.pptx"
    (tmp_path / "catalog.json").write_text(json.dumps(catalog))
    config = tmp_path / "project.json"
    config.write_text(json.dumps(settings))
    with pytest.raises(ValueError, match="mappe"):
        load_catalogs(config)


@pytest.mark.parametrize("changed", [False, True])
def test_loader_rejects_missing_or_changed_original_documents(tmp_path, changed):
    catalogs, _ = load_catalogs(CONFIG)
    catalog = catalogs[0]
    for source in catalog["source_inventory"]:
        source["file"] = "lesson.txt"
        source["sha256"] = hashlib.sha256(b"original lesson").hexdigest()
    if changed:
        (tmp_path / "lesson.txt").write_bytes(b"changed lesson")
    (tmp_path / "catalog.json").write_text(json.dumps(catalog))
    config = tmp_path / "project.json"
    config.write_text(json.dumps({"project_root": ".", "catalogs": [{"path": "catalog.json"}]}))
    with pytest.raises(ValueError, match="kontrolsum" if changed else "kildefil mangler"):
        load_catalogs(config)


def test_reference_has_valid_sources_and_all_tm_examples():
    catalogs, _ = load_catalogs(CONFIG)
    assert validate_catalogs(catalogs) == {"catalogs": 3, "entries": 176, "checked_examples": 90}
    for catalog in catalogs[1:]:
        for entry in catalog["entries"]:
            assert all(entry.get(field) for field in ("conversion", "pitfall", "example", "example_check"))


def test_voltage_divider_distinguishes_output_from_supply():
    catalogs, _ = load_catalogs(CONFIG)
    divider = next(e for e in catalogs[0]["entries"] if e["id"] == "U06")
    assert divider["lookup"]["seek_key"] == "U1"
    assert divider["lookup"]["given_sets"] == [["U", "R1", "R2"]]


def test_rc_start_current_requires_only_initial_voltage_difference_and_resistance():
    catalogs, _ = load_catalogs(CONFIG)
    entries = {e["id"]: e for e in catalogs[0]["entries"]}
    assert entries["C41"]["lookup"]["given_sets"] == [["Us", "u0", "R"]]
    assert entries["C42"]["lookup"]["given_sets"] == [["Us", "R"]]
    assert entries["C43"]["lookup"]["given_sets"] == [["u0", "R"]]
    assert entries["C42"]["lookup"]["situations"] == ["rc_charge_empty"]
    assert "uopladet" in entries["C42"]["condition"]
    assert "AC-effektivværdi" in entries["C42"]["pitfall"]
    # Independent KVL checks: capacitor voltage cannot jump through finite R.
    for initial_voltage in (0, 100, 440, 500):
        initial_current = (440 - initial_voltage) / 220
        assert initial_voltage + 220 * initial_current == pytest.approx(440)
    # After one time constant, the remaining current is 1/e of its start value.
    assert 2 * math.exp(-.022 / (220 * .0001)) == pytest.approx(2 / math.e)
    assert entries["C42"]["example_check"]["expected"] == 440 / 220


@pytest.mark.parametrize("explanation", ["", " ", None, "Uafsluttet $i(0)"])
def test_catalog_rejects_missing_or_broken_explanations(explanation):
    catalogs, _ = load_catalogs(CONFIG)
    catalog = copy.deepcopy(catalogs[0])
    catalog["entries"][0]["explanation"] = explanation
    with pytest.raises(ValueError):
        validate_catalog(catalog)


@pytest.mark.parametrize("expression", ["__import__('os')", "True", "1/0", "1e309", "(-1)**0.5", "2**101", "pi.real"])
def test_numeric_checks_reject_code_and_nonfinite_results(expression):
    with pytest.raises((ValueError, ArithmeticError)):
        checked_number(expression)


@pytest.mark.parametrize("mutation", ["same-input", "duplicate-input", "duplicate-group", "blank-condition", "bad-example"])
def test_catalog_rejects_ambiguous_or_incorrect_routes(mutation):
    catalogs, _ = load_catalogs(CONFIG)
    catalog = copy.deepcopy(catalogs[1])
    entry = catalog["entries"][0]
    if mutation == "same-input":
        entry["lookup"]["given_sets"][0].append(entry["lookup"]["seek_key"])
    elif mutation == "duplicate-input":
        entry["lookup"]["given_sets"][0] *= 2
    elif mutation == "duplicate-group":
        catalog["navigation_groups"].append(catalog["navigation_groups"][0])
    elif mutation == "blank-condition":
        entry["condition"] = " "
    else:
        entry["example_check"]["expected"] += 1
    with pytest.raises(ValueError):
        validate_catalog(catalog)


def test_thermodynamic_and_engine_checks_match_independent_derivations():
    catalogs, _ = load_catalogs(CONFIG)
    heat = {e["id"]: e for e in catalogs[1]["entries"]}
    engine = {e["id"]: e for e in catalogs[2]["entries"]}
    # Work delivered in an isothermal expansion is positive; the catalog uses work on the gas.
    delivered = 100000 * .1 * math.log(2)
    assert heat["VH16"]["example_check"]["expected"] == pytest.approx(-delivered)
    # One cylinder's work times cylinders times cycles per second.
    work_per_cycle_kj = 1000 * .02
    assert engine["MO03"]["example_check"]["expected"] == work_per_cycle_kj * 6 * 10
    assert engine["MO04"]["example_check"]["expected"] == work_per_cycle_kj * 6 * 5
    # Shaft work per revolution, rather than the stored power expression.
    assert engine["MO06"]["example_check"]["expected"] == pytest.approx((2 * math.pi * 2000) * 10 / 1000)
    fuel_kwh_per_kg = 42000 / 3600
    assert engine["MO13"]["example_check"]["expected"] == pytest.approx(1 / (.2 * fuel_kwh_per_kg))
    assert heat["VH28"]["example_check"]["expected"] == (600 - 300) / 600


def test_web_export_is_offline_and_does_not_embed_presentation_metadata(tmp_path):
    catalogs, _ = load_catalogs(CONFIG)
    catalog = copy.deepcopy(catalogs[0])
    catalog["entries"] = catalog["entries"][:1]
    catalog["entries"][0]["pitfall"] = "</script><script>window.injected=true</script> __SCRIPT__"
    catalog["entries"][0]["explanation"] = "</script> Startstrøm $i(0)=U_s/R$"
    target = export_catalogs([catalog], tmp_path / "index.html")
    html = target.read_text()
    payload = json.loads(html.split('<script id="database" type="application/json">')[1].split("</script>")[0])
    assert "source_inventory" in payload["catalogs"][0]
    assert all("slides" not in source for source in payload["catalogs"][0]["source_inventory"])
    assert "page" not in payload["catalogs"][0]["entries"][0]
    assert "window.injected=true</script>" not in html
    assert payload["catalogs"][0]["entries"][0]["pitfall"].endswith("__SCRIPT__")
    assert "i(0)=U_s/R" in payload["math_assets"]
    assert "Startstrøm" in payload["search_text"][catalog["entries"][0]["id"]]
    assert '<script src=' not in html and 'PPmaker' not in html
    assert html.count('id="database"') == 1


def test_standalone_import_and_validation_never_load_powerpoint():
    program = "from formula_lookup.cli import load_catalogs; load_catalogs('project.json'); import sys; assert not any(n.startswith('powerpoint_app') or n == 'pptx' for n in sys.modules)"
    subprocess.run([sys.executable, "-c", program], check=True)
