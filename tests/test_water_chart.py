"""IAPWS-IF97 water properties and the one-stage dry-expansion cycle."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

WATER = Path(__file__).resolve().parents[1] / "src" / "formula_lookup" / "web" / "water.js"
NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(NODE is None, reason="Node is required to run water.js")


def water_eval(expression):
    program = (
        "const Water=require(process.argv.find(arg=>arg.endsWith('water.js')));"
        f"const value={expression};"
        "if(!Number.isFinite(value)&&!(value&&typeof value==='object')){console.error(value);process.exit(1);}"
        "process.stdout.write(JSON.stringify(value));"
    )
    result = subprocess.run([NODE, "-e", program, "--", str(WATER)], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)
    return json.loads(result.stdout)


def test_published_iapws_reference_points():
    got = water_eval("""({
      psat500: Water.psat(500),
      tsat10: Water.tsat(10),
      p23: Water.p23(623.15),
      h13: Water.region1(300, 3).h,
      v13: Water.region1(300, 3).v,
      s180: Water.region1(300, 80).s,
      h230: Water.region2(700, 30).h,
      v230: Water.region2(700, 30).v,
      s2low: Water.region2(700, 0.0035).s
    })""")
    assert got["psat500"] == pytest.approx(2.63889776, rel=1e-7)
    assert got["tsat10"] == pytest.approx(584.149488, rel=1e-7)
    assert got["p23"] == pytest.approx(16.52916425, rel=1e-7)
    assert got["h13"] == pytest.approx(115.331273, rel=1e-7)
    assert got["v13"] == pytest.approx(0.00100215168, rel=1e-6)
    assert got["s180"] == pytest.approx(0.368563852, rel=1e-6)
    assert got["h230"] == pytest.approx(2631.49474, rel=1e-7)
    assert got["v230"] == pytest.approx(0.00542946619, rel=1e-6)
    assert got["s2low"] == pytest.approx(10.1749996, rel=1e-7)


def test_refrigeration_states_match_iapws_library():
    iapws = pytest.importorskip("iapws")
    from iapws.iapws97 import IAPWS97

    samples = [
        IAPWS97(T=373.15, x=0),
        IAPWS97(T=373.15, x=1),
        IAPWS97(P=0.1, T=500),
        IAPWS97(T=278.15, x=0),
        IAPWS97(T=308.15, x=1),
    ]
    got = water_eval("""([
      Water.statePT(Water.psat(373.15), 100, 'f'),
      Water.statePT(Water.psat(373.15), 100, 'g'),
      Water.statePT(0.1, 226.85, 'g'),
      Water.statePT(Water.psat(278.15), 5, 'f'),
      Water.statePT(Water.psat(308.15), 35, 'g')
    ])""")
    for state, expected in zip(got, samples, strict=True):
        assert state["ok"] is True
        assert state["P"] == pytest.approx(expected.P, rel=1e-6)
        assert state["h"] == pytest.approx(expected.h, rel=1e-6, abs=1e-3)
        assert state["s"] == pytest.approx(expected.s, rel=1e-6, abs=1e-5)


def test_default_water_cycle_matches_iapws_and_closes_the_balance():
    iapws = pytest.importorskip("iapws")
    from iapws.iapws97 import IAPWS97

    cycle = water_eval("Water.cycle(Water.defaults)")
    assert cycle["ok"] is True
    points = {item["n"]: item for item in cycle["points"]}
    P7 = IAPWS97(T=278.15, x=1).P
    P4 = IAPWS97(T=308.15, x=0).P
    suction = IAPWS97(P=P7, T=283.15)
    liquid = IAPWS97(P=P4, T=306.15)
    isentropic = IAPWS97(P=P4, s=suction.s)
    work = (isentropic.h - suction.h) / 0.75
    discharge = IAPWS97(P=P4, h=suction.h + work)
    assert points[1]["h"] == pytest.approx(suction.h, rel=1e-6)
    assert points[4]["h"] == pytest.approx(liquid.h, rel=1e-6)
    assert points[2]["h"] == pytest.approx(discharge.h, rel=1e-6)
    assert points[6]["h"] == pytest.approx(points[5]["h"])
    assert points[3]["h"] == pytest.approx(points[2]["h"])
    assert points[8]["h"] == pytest.approx(points[1]["h"])
    assert 0 < cycle["results"]["x6"] < 1
    results = cycle["results"]
    assert results["cop"] == pytest.approx(results["copStar"])
    assert results["cop"] < results["copCarnot"]
    assert results["balanceIn"] == pytest.approx(results["balanceOut"], abs=1e-6)
    assert results["W"] > 0 and results["QC"] > results["QE"]
    framed = water_eval("Water.frameCycle(Water.cycle(Water.defaults).points)")
    for item in cycle["points"]:
        assert framed["hMin"] < item["h"] < framed["hMax"]
        assert framed["pMin"] < item["P"] < framed["pMax"]


def test_cycle_rejects_impossible_water_inputs():
    inverted = water_eval("Water.cycle(Object.assign({}, Water.defaults, {TE: 40, TC: 5}))")
    flooded = water_eval("Water.cycle(Object.assign({}, Water.defaults, {dPliq: 5}))")
    assert inverted["ok"] is False
    assert flooded["ok"] is False


def test_chart_isolines_cover_the_cycle_window():
    lines = water_eval("Water.isolines(Water.frameCycle(Water.cycle(Water.defaults).points), {temps:[120], volumes:true})")
    assert len(lines["bubble"]) > 20
    assert lines["bubble"][0]["p"] < lines["bubble"][-1]["p"]
    assert lines["dew"][0]["h"] > lines["bubble"][0]["h"]
    assert len(lines["quality"]) == 4
    assert any(line["segments"] for line in lines["isotherms"])
    assert len(lines["isentropes"]) >= 2
    assert len(lines["isochores"]) >= 1
