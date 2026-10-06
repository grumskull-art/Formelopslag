"""Prime XML regressions; numerical checks are independent of serialization."""
import copy
import json
import math
import xml.etree.ElementTree as ET

import pytest

from formula_lookup.cli import load_catalogs
from formula_lookup.mathcad import (
    WS, ML, XAML, SUB, Node, Parser, ExportError, attach_metadata, blocks,
    compile_entry, compile_formula, key, number, op, serialize, to_element,
    unit_expression, validate_xml, variable, xml_string,
)
from formula_lookup.mathcad_check import check_formula, evaluate, unit_quantity, Quantity


@pytest.fixture(scope="module")
def catalogs():
    return load_catalogs("project.json")[0]


def entry(catalogs, code):
    return next(e for c in catalogs for e in c["entries"] if e["id"] == code)


def test_every_configured_catalog_and_math_block_has_export(catalogs):
    totals = {}
    for catalog in catalogs:
        totals[catalog["id"]] = len(catalog["entries"])
        for e in catalog["entries"]:
            compiled = compile_entry(e)
            assert len(compiled["coverage"]) == len(list(blocks(e)))
            assert {(f["field"], f["latex"]) for f in compiled["formulas"]} == {(b["field"], b["latex"]) for b in compiled["coverage"]}
            assert compiled["main_dimensions_checked"] and not compiled["native_tested"]
            for block in compiled["coverage"]:
                assert block["status"] == "structured"
                validate_xml(block["xml"])
            assert compiled["formulas"][0]["field"] == "main"
            for f in compiled["formulas"]:
                root = validate_xml(f["xml"])
                assert root.tag == f"{{{WS}}}region"
                assert len(root.findall(f"{{{WS}}}math")) == 1
                for info in f["inputs"]:
                    validate_xml(info["template"])
    assert totals == {"el": 125, "tm-heat": 28, "tm-engine": 23}


def test_regions_default_namespaces_and_no_structural_text():
    node = Node("define", children=(variable("U_kl"), op("scale", number(10), unit_expression("V"))))
    xml = serialize([node])
    assert f'<define xmlns="{ML}">' in xml
    root = validate_xml(xml)
    define = root.find(f".//{{{ML}}}define")
    assert len(define) == 2 and define.text is None
    subscript = define.find(f".//{{{SUB}}}Subscript")
    assert subscript.text == "kl"
    assert define[0].get("labels") == "VARIABLE"
    units = root.findall(f".//{{{ML}}}id[@labels='UNIT']")
    assert [u.text for u in units] == ["V"]
    assert all("label-is-contextual" not in u.attrib for u in units)
    multi = validate_xml(serialize([node, node]))
    assert multi.tag == f"{{{WS}}}worksheet"
    assert len(multi.find(f"{{{WS}}}regions")) == 2
    with pytest.raises(ExportError, match="Utilsigtet"):
        validate_xml(xml.replace(f'<define xmlns="{ML}">', f'<define xmlns="{ML}">>'))


@pytest.mark.parametrize("source, labels, si_value", [
    ("h", ["hr"], 3600), ("Ah", ["A", "hr"], 3600),
    ("kWh", ["kW", "hr"], 3600000), ("kg/kWh", ["kg", "kW", "hr"], 1/3600000),
])
def test_hour_units_use_prime_names_and_preserve_factors(source, labels, si_value):
    xml = to_element(unit_expression(source))
    assert [u.text for u in xml.iter(f"{{{ML}}}id")] == labels
    assert evaluate(xml, {}).value == pytest.approx(si_value)


def test_literals_array_indices_relations_and_function_definitions(catalogs):
    literal = serialize([variable("R_1")])
    assert "Subscript" in literal and "indexer" not in literal
    summed = compile_entry(entry(catalogs, "R07"))["formulas"][0]["xml"]
    assert "indexer" in summed and "summation" in summed
    matrix = compile_entry(entry(catalogs, "N01"))["formulas"][0]["xml"]
    assert "<sequence>" in matrix and "<equal" in matrix and "<define" not in matrix
    func = compile_entry(entry(catalogs, "C20"))["formulas"][0]["xml"]
    assert "<function>" in func and "<boundVars>" in func
    vector = compile_entry(entry(catalogs, "E03"))["coverage"]
    assert any("crossProduct" in b["xml"] for b in vector)
    original = entry(catalogs, "G01")
    formulas = [f for f in compile_entry(original)["formulas"] if f["field"] == "main"]
    assert len(formulas) == 2
    assert all(len(validate_xml(f["xml"]).find(f".//{{{ML}}}define")) == 2 for f in formulas)


def test_partial_pressure_vector_does_not_overwrite_total_pressure(catalogs):
    formula = compile_entry(entry(catalogs, "VH07"))["formulas"][0]
    assert formula["output"] == "p" and formula["output_type"] == "scalar"
    assert [(i["name"], i["type"]) for i in formula["inputs"]] == [("p_del", "vector"), ("i", "range")]
    assert formula["inputs"][0]["quantity"] == "partials"
    xml = validate_xml(formula["xml"])
    define = xml.find(f".//{{{ML}}}define")
    assert define[0].text == "p"
    array = xml.find(f".//{{{ML}}}indexer/../{{{ML}}}id")
    assert array.find(f"{{{XAML}}}Span/{{{SUB}}}Subscript").text == "del"


def test_indexed_definition_collects_selector_and_preserves_zero_units(catalogs):
    f = next(f for f in compile_entry(entry(catalogs, "U07"))["formulas"] if f["latex"] == "E_k=0")
    assert [(i["name"], i["type"]) for i in f["inputs"]] == [("k", "range")]
    assert f["evaluation"] and '<indexer' in f["evaluation"]
    assert validate_xml(f["xml"]).find(f".//{{{ML}}}id[@labels='UNIT']").text == "V"


@pytest.mark.parametrize("code, name", [("I07", "k"), ("N01", "a")])
def test_array_selectors_are_typed_indices(catalogs, code, name):
    f = next(f for f in compile_entry(entry(catalogs, code))["formulas"] if any(i["name"] == name for i in f["inputs"]))
    assert next(i for i in f["inputs"] if i["name"] == name)["type"] == "index"


@pytest.mark.parametrize("code", ["E05", "C13", "C21"])
def test_scalar_derivative_collects_unbound_time(catalogs, code):
    formulas = compile_entry(entry(catalogs, code))["formulas"]
    derivatives = [f for f in formulas if '<derivative' in f["xml"] and f["output_type"] == "scalar"]
    assert derivatives
    assert all(any(i["name"] == "t" and i["type"] == "scalar" for i in f["inputs"]) for f in derivatives)


@pytest.mark.parametrize("code, output", [("W04", "N_e"), ("I07", "I_k"), ("U05", "ΔU_i")])
def test_unknown_output_units_still_get_an_evaluation(catalogs, code, output):
    f = next(f for f in compile_entry(entry(catalogs, code))["formulas"] if f["output"] == output)
    root = validate_xml(f["evaluation"])
    assert root.find(f".//{{{ML}}}eval/{{{ML}}}unitOverride/{{{ML}}}placeholder") is not None


def test_euler_constant_in_division_is_entry_local(catalogs):
    f = next(f for f in compile_entry(entry(catalogs, "C25"))["formulas"] if '/e' in f["latex"])
    assert 'e' not in {i["name"] for i in f["inputs"]}
    assert validate_xml(f["xml"]).find(f".//{{{ML}}}id[@labels='CONSTANT']").text == "e"
    voltage = compile_entry(entry(catalogs, "E02"))["formulas"][0]
    assert validate_xml(voltage["xml"]).find(f".//{{{ML}}}function/{{{ML}}}id").get('labels') == 'VARIABLE'


def test_trailing_unit_annotation_keeps_equation_dimensions(catalogs):
    f = next(f for f in compile_entry(entry(catalogs, "C05"))["formulas"] if r'\,[' in f["latex"])
    assert '<div' not in f["xml"]
    assert check_formula(f["xml"], entry(catalogs, "C05")["mathcad_metadata"]["symbols"]).value == 1
    formula = compile_formula(r'RC\,[\mathrm{s}]', {"symbols": {}}, 'conversion')[0]
    assert formula.kind == 'eval'
    assert formula.children[1].children[0] == unit_expression('s')


def test_milliohm_conversion_has_a_single_prefixed_unit(catalogs):
    f = next(f for f in compile_entry(entry(catalogs, "G05"))["formulas"] if f["field"] == 'conversion')
    root = validate_xml(f["xml"])
    assert [n.text for n in root.findall(f".//{{{ML}}}id[@labels='UNIT']")] == ['Ω', 'mΩ']
    assert check_formula(f["xml"], entry(catalogs, "G05")["mathcad_metadata"]["symbols"], {'R': 2}).value == 1


@pytest.mark.parametrize("code", ['B04', 'B13', 'C19', 'P08', 'K04'])
def test_approximations_are_evaluated_without_false_exact_equalities(catalogs, code):
    formulas = [f for f in compile_entry(entry(catalogs, code))["formulas"] if r'\approx' in f["latex"] and f["field"] != 'example']
    assert formulas
    for f in formulas:
        root = validate_xml(f["xml"])
        assert root.find(f".//{{{ML}}}eval") is not None
        assert root.find(f".//{{{ML}}}define") is None
        assert root.find(f".//{{{ML}}}equal") is None
        assert f["note"]
    if code == 'C19':
        root = validate_xml(next(f["xml"] for f in formulas if f["field"] == 'steps'))
        assert evaluate(root.find(f".//{{{ML}}}eval"), {}).value == pytest.approx(math.exp(-1))


@pytest.mark.parametrize("source, expected", [
    (r"-2^2", -4), (r"(-2)^2", 4), (r"2^{-3}", .125),
    (r"\frac{2}{\frac{3}{4}}", 8/3), (r"\frac{2-3}{4+5}", -1/9),
    (r"2(3+4)", 14), (r"\sqrt{\frac{16}{4}}", 2),
    (r"\ln(e^2)", 2), (r"\sin(\pi/2)", 1),
])
def test_precedence_signs_functions_and_nested_fractions(source, expected):
    node = Parser(source).parse()
    result = evaluate(to_element(node), {})
    assert result.value == pytest.approx(expected)


@pytest.mark.parametrize("value", ["", "nan", "inf", "1;2", "<script>", "1e999", "1,2,3"])
def test_invalid_numeric_inputs_are_rejected(value):
    with pytest.raises(ExportError):
        number(value)


def test_input_values_and_catalog_identifiers_are_escaped():
    assert number("1,25").value == "1.25"
    xml = serialize([Node("define", children=(variable('U_<&"'), number(2)))], 'a"<&')
    assert '&lt;' in xml and '&amp;' in xml
    assert validate_xml(xml).get("id").startswith('formelopslag_a"<&')
    assert validate_xml(xml).find(f".//{{{SUB}}}Subscript").text == '<&"'


@pytest.mark.parametrize("current, expected", [(0, 0), (1, 1), (-2, 1)])
def test_inequality_uses_verified_logical_tags(current, expected):
    root = validate_xml(serialize([Parser(r"I\ne0").parse()]))
    assert root.find(f".//{{{ML}}}not") is not None
    assert root.find(f".//{{{ML}}}equal") is not None
    assert evaluate(root.find(f".//{{{ML}}}apply"), {"I": Quantity(current)}).value == expected


def test_reference_example_evaluates_to_two_ohms(catalogs):
    e = entry(catalogs, "R09")
    formula = compile_entry(e)["formulas"][0]
    result = check_formula(formula["xml"], e["mathcad_metadata"]["symbols"], {"E": 12, "U_kl": 10, "I": 1})
    assert result.value / unit_quantity("Ω").value == pytest.approx(2)
    nodes = [Node("define", children=(variable(name), op("scale", number(value), unit_expression(unit))))
             for name, value, unit in [("E", 12, "V"), ("U_kl", 10, "V"), ("I", 1, "A")]]
    nodes.extend(compile_formula(e["latex"], e["mathcad_metadata"]))
    nodes.append(Node("eval", children=(variable("r_i"), Node("override", children=(unit_expression("Ω"),)))))
    root = validate_xml(serialize(nodes, "reference"))
    assert len(root.find(f"{{{WS}}}regions")) == 5
    assert [n[0].tag.rsplit("}", 1)[-1] for n in root.findall(f".//{{{WS}}}math")] == ["define"]*4 + ["eval"]


@pytest.mark.parametrize("code, values, output, expected", [
    ("I01", {"U": 24, "R": 12}, "A", 2),
    ("I03", {"P": 150, "R": .96}, "A", 12.5),
    ("R04", {"ρ": .0175, "l": 300, "S": 10}, "Ω", .525),
    ("R09", {"E": 12.4, "U_kl": 11.2, "I": 6}, "Ω", .2),
    ("C20", {"U_s": 440, "u_0": 0, "R": 220, "C": .0001, "t": .022}, "V", 278.1330458845654),
    ("VH02", {"n": 2, "R": 8.314, "T": 300, "V": .05}, "Pa", 99768),
    ("VH16", {"p_1": 100000, "V_1": .1, "V_2": .2}, "J", -6931.471805599),
    ("VH17", {"p_1": 100000, "V_1": .1, "V_2": .2, "κ": 1.4}, "Pa", 37892.91416276),
    ("MO03", {"p_i": 1000, "V_s": .02, "c": 6, "n": 600}, "kW", 1200),
    ("MO04", {"p_i": 1000, "V_s": .02, "c": 6, "n": 600}, "kW", 600),
    ("MO13", {"c_b": .2, "h_i": 42000}, "1", 3/7),
    ("MO19", {"r": 18, "κ": 1.4, "φ": 2}, "1", .6315775314437779),
    ("MO20", {"h": 11, "c": 86, "s": 1, "o": 0, "f": 2}, "kJ/kg", 42225),
    ("MO21", {"h": 11, "c": 86, "s": 1, "o": 0}, "1", 13.840579710145),
])
def test_emitted_main_xml_against_source_examples(catalogs, code, values, output, expected):
    e = entry(catalogs, code)
    assert e["example_check"]  # The numbers above come from the existing example.
    result = check_formula(compile_entry(e)["formulas"][0]["xml"], e["mathcad_metadata"]["symbols"], values)
    assert result.value / unit_quantity(output).value == pytest.approx(expected, rel=1e-10)


def test_temperatures_dimensionless_inputs_and_contextual_names(catalogs):
    resistor = entry(catalogs, "R05")
    meta = resistor["mathcad_metadata"]
    assert meta["symbols"]["t"]["unit"] == "°C"
    conversion = next(b for b in compile_entry(resistor)["coverage"] if b["field"] == "conversion")
    assert 'labels="UNIT" xml:space="preserve">Δ°C</id>' in conversion["xml"]
    result = check_formula(compile_entry(resistor)["formulas"][0]["xml"], meta["symbols"],
                           {"R_t": 100, "α_t": .004, "T": 30, "t": 20})
    assert result.value == pytest.approx(104)
    assert entry(catalogs, "I05")["mathcad_metadata"]["symbols"]["E"]["unit"] == "V"
    assert entry(catalogs, "F02")["mathcad_metadata"]["symbols"]["E"]["unit"] == "V/m"
    for code in ("VH22", "VH26"):
        compiled = compile_entry(entry(catalogs, code))
        assert "ækvivalent" in compiled["note"]
        assert "<integral" in compiled["formulas"][0]["xml"]
        assert "<derivative" in compiled["formulas"][0]["xml"]
        assert {i["type"] for i in compiled["formulas"][0]["inputs"]} == {"function"}


def test_missing_metadata_and_wrong_units_fail_closed(catalogs):
    original = copy.deepcopy(entry(catalogs, "R09"))
    del original["mathcad_metadata"]["symbols"]["U_kl"]
    with pytest.raises(ExportError, match="U_kl"):
        compile_entry(original)
    original = copy.deepcopy(entry(catalogs, "R09"))
    original["mathcad_metadata"]["symbols"]["I"]["unit"] = "m"
    with pytest.raises(ValueError, match="dimension"):
        compile_entry(original)
