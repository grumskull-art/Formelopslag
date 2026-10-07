"""Ideal-gas box: p = nRT/V and the three hold-constant ratios."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

GAS = Path(__file__).resolve().parents[1] / "src" / "formula_lookup" / "web" / "gas.js"
NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(NODE is None, reason="Node is required to run gas.js")


def gas_eval(expression):
    program = (
        "const Gas=require(process.argv.find(arg=>arg.endsWith('gas.js')));"
        f"const value={expression};"
        "process.stdout.write(JSON.stringify(value));"
    )
    result = subprocess.run([NODE, "-e", program, "--", str(GAS)], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)
    return json.loads(result.stdout)


def test_catalog_reference_pressure():
    assert gas_eval("Gas.pressure(2,300,0.05)") == pytest.approx(99768)


def test_hold_volume_scales_pressure_with_temperature():
    got = gas_eval("Gas.adjust({n:2,T:300,V:0.05},{T:600},'volume')")
    assert got["V"] == pytest.approx(0.05)
    assert got["T"] == pytest.approx(600)
    assert got["p"] == pytest.approx(99768 * 2)


def test_hold_pressure_scales_volume_with_temperature():
    got = gas_eval("Gas.adjust({n:2,T:300,V:0.05},{T:600},'pressure')")
    assert got["p"] == pytest.approx(99768)
    assert got["V"] == pytest.approx(0.10)
    assert got["T"] == pytest.approx(600)


def test_hold_temperature_scales_pressure_with_volume():
    got = gas_eval("Gas.adjust({n:2,T:300,V:0.05},{V:0.10},'temperature')")
    assert got["T"] == pytest.approx(300)
    assert got["V"] == pytest.approx(0.10)
    assert got["p"] == pytest.approx(99768 / 2)


def test_adding_gas_does_not_change_temperature():
    got = gas_eval("Gas.adjust({n:2,T:300,V:0.05},{n:3},'none')")
    assert got["T"] == pytest.approx(300)
    assert got["n"] == pytest.approx(3)
    assert got["p"] == pytest.approx(99768 * 1.5)


def test_empty_box_has_zero_pressure():
    assert gas_eval("Gas.pressure(0,300,0.05)") == 0
