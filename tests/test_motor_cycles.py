"""Ideal Otto and Diesel corner states and the published efficiencies."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

MOTOR = Path(__file__).resolve().parents[1] / "src" / "formula_lookup" / "web" / "motor.js"
NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(NODE is None, reason="Node is required to run motor.js")


def motor_eval(expression):
    program = (
        "const Motor=require(process.argv.find(arg=>arg.endsWith('motor.js')));"
        f"const value={expression};"
        "process.stdout.write(JSON.stringify(value));"
    )
    result = subprocess.run([NODE, "-e", program, "--", str(MOTOR)], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)
    return json.loads(result.stdout)


def test_otto_published_efficiency_and_corners():
    got = motor_eval("Motor.otto({p1:100000,V1:0.0005,T1:300,r:10,kappa:1.4,T3:1800})")
    assert got["ok"] is True
    assert got["eta"] == pytest.approx(0.601892829447)
    points = got["points"]
    assert points[0]["V"] / points[1]["V"] == pytest.approx(10)
    assert points[1]["p"] / points[0]["p"] == pytest.approx(10 ** 1.4)
    assert points[1]["s"] == pytest.approx(0, abs=1e-6)
    assert points[3]["s"] == pytest.approx(points[2]["s"])
    assert points[2]["V"] == pytest.approx(points[1]["V"])


def test_diesel_published_efficiency_and_cutoff():
    got = motor_eval("Motor.diesel({p1:100000,V1:0.0005,T1:300,r:18,kappa:1.4,phi:2})")
    assert got["ok"] is True
    assert got["eta"] == pytest.approx(0.6315775314437779)
    points = got["points"]
    assert points[2]["V"] / points[1]["V"] == pytest.approx(2)
    assert points[2]["p"] == pytest.approx(points[1]["p"])
    assert points[0]["V"] / points[1]["V"] == pytest.approx(18)
    assert points[1]["s"] == pytest.approx(0, abs=1e-6)
    assert got["W"] == pytest.approx(got["Qin"] - got["Qout"])


def test_diesel_rejects_cutoff_above_compression():
    got = motor_eval("Motor.diesel({r:2,phi:3,kappa:1.4,p1:1e5,V1:0.001,T1:300})")
    assert got["ok"] is False


def test_otto_rejects_heat_below_compression_temperature():
    got = motor_eval("Motor.otto({r:10,kappa:1.4,p1:1e5,V1:0.001,T1:300,T3:400})")
    assert got["ok"] is False
