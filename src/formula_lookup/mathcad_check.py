"""Independent SI dimensional/numerical checks of the emitted math50 XML.

This is not a Mathcad runtime. Numerical differentiation/integration and arrays
are deliberately not simulated; their dimensions and structure are checked.
"""
from dataclasses import dataclass
from fractions import Fraction
import math
import xml.etree.ElementTree as ET

from .mathcad import ML, XAML, SUB, unit_expression, to_element, key, variable

ZERO = (Fraction(0),) * 6  # kg, m, s, A, K, mol


@dataclass(frozen=True)
class Quantity:
    value: float
    dimensions: tuple = ZERO

    def scale(self, other, sign=1):
        return Quantity(self.value * other.value if sign == 1 else self.value / other.value,
                        tuple(a + sign*b for a, b in zip(self.dimensions, other.dimensions)))


def base(index):
    return Quantity(1, tuple(Fraction(int(i == index)) for i in range(6)))


def power(q, exponent):
    return Quantity(q.value ** exponent, tuple(d * Fraction(str(exponent)) for d in q.dimensions))


def units():
    kg, m, s, amp, kelvin, mol = [base(i) for i in range(6)]
    newton = kg.scale(m).scale(power(s, 2), -1)
    joule = newton.scale(m)
    watt = joule.scale(s, -1)
    volt = watt.scale(amp, -1)
    ohm = volt.scale(amp, -1)
    farad = amp.scale(s).scale(volt, -1)
    weber = volt.scale(s)
    henry = weber.scale(amp, -1)
    result = dict(kg=kg, m=m, s=s, A=amp, K=kelvin, mol=mol, N=newton,
                  J=joule, W=watt, V=volt, Ω=ohm, F=farad, Wb=weber,
                  H=henry, S=power(ohm, -1), T=weber.scale(power(m, 2), -1),
                  Pa=newton.scale(power(m, 2), -1), C=amp.scale(s),
                  rad=Quantity(1), deg=Quantity(math.pi/180), rpm=Quantity(2*math.pi/60, tuple(-d for d in s.dimensions)),
                  Hz=power(s, -1), h=Quantity(3600, s.dimensions), L=Quantity(.001, power(m, 3).dimensions),
                  **{"°C": kelvin, "Δ°C": kelvin, "%": Quantity(.01)})
    for prefix, factor in {"k": 1000, "M": 1e6, "c": .01, "m": .001, "μ": 1e-6, "n": 1e-9, "p": 1e-12}.items():
        for name in ("m", "N", "Pa", "W", "J", "Wh", "A", "H", "s", "F", "Wb", "C", "T", "Ω", "V", "S"):
            if name == "Wh":
                q = joule.scale(Quantity(3600))
            else:
                q = result[name]
            result[prefix+name] = Quantity(q.value*factor, q.dimensions)
    result["g"] = Quantity(.001, kg.dimensions)
    result["min"] = Quantity(60, s.dimensions)
    result["hr"] = result["h"]
    result["Ah"] = Quantity(3600, result["C"].dimensions)
    return result


UNITS = units()


def name(node):
    span = node.find(f"{{{XAML}}}Span")
    if span is None:
        return node.text
    return (span.text or "") + "_" + span.find(f"{{{SUB}}}Subscript").text


def unit_quantity(source):
    return evaluate(to_element(unit_expression(source)), {})


def evaluate(node, env, dimension_only=False):
    tag = node.tag.rsplit("}", 1)[-1]
    children = list(node)
    if tag == "real":
        return Quantity(float(node.text))
    if tag == "id":
        label, symbol = node.get("labels"), name(node)
        if label == "UNIT":
            return UNITS[symbol]
        if label == "CONSTANT":
            return Quantity({"e": math.e, "π": math.pi, "∞": math.inf}[symbol])
        return env[symbol]
    if tag in ("parens", "unitOverride"):
        return evaluate(children[0], env, dimension_only)
    if tag in ("define", "eval"):
        return evaluate(children[1] if tag == "define" else children[0], env, dimension_only)
    if tag != "apply":
        raise ValueError("Unsupported check node: " + tag)
    operator = children[0].tag.rsplit("}", 1)[-1]
    args = children[1:]
    if operator in ("integral", "derivative", "summation", "product"):
        lam = args[0]
        bound = lam[0][0]
        local = dict(env)
        bound_unit = Quantity(1)
        if bound.tag.endswith("id"):
            bound_unit = env.get(name(bound), Quantity(1))
            local[name(bound)] = bound_unit
        body = evaluate(lam[1], local, dimension_only)
        if not dimension_only:
            raise ValueError("Calculus and arrays are not native-validated by this checker.")
        return body.scale(bound_unit, -1 if operator == "derivative" else 1) if operator in ("integral", "derivative") else body
    if operator == "indexer":
        return evaluate(args[0], env, dimension_only)
    if operator == "id":
        symbol = name(children[0])
        if symbol not in ("ln", "log", "exp", "sin", "cos", "tan"):
            return env[symbol]
        q = evaluate(args[0], env, dimension_only)
        if q.dimensions != ZERO:
            raise ValueError(symbol + " requires a dimensionless argument")
        return Quantity(1 if dimension_only else {"ln": math.log, "log": math.log10, "exp": math.exp,
                        "sin": math.sin, "cos": math.cos, "tan": math.tan}[symbol](q.value))
    if operator == "nthRoot":
        exponent = 2 if args[0].tag.endswith("placeholder") else evaluate(args[0], env).value
        return power(evaluate(args[1], env, dimension_only), 1/exponent)
    if operator == "not":
        value = evaluate(args[0], env, dimension_only)
        if value.dimensions != ZERO:
            raise ValueError("Logical not requires a dimensionless operand")
        return Quantity(1 if dimension_only else float(not value.value))
    values = [evaluate(a, env, dimension_only) for a in args]
    a = values[0]
    if operator in ("neg", "absval"):
        return Quantity(-a.value if operator == "neg" else abs(a.value), a.dimensions)
    b = values[1]
    if operator in ("mult", "scale", "crossProduct", "div"):
        if operator == "scale" and args[1].tag.endswith("id") and name(args[1]) == "°C":
            return Quantity(a.value + 273.15, b.dimensions)
        return a.scale(b, -1 if operator == "div" else 1)
    if operator == "pow":
        if b.dimensions != ZERO:
            raise ValueError("Exponent is not dimensionless")
        return power(a, b.value)
    if a.dimensions != b.dimensions and a.value != 0 and b.value != 0:
        raise ValueError(f"{operator}: unequal dimensions {a.dimensions} and {b.dimensions}")
    if operator in ("plus", "minus"):
        if dimension_only:
            return Quantity(1, a.dimensions if a.value != 0 else b.dimensions)
        return Quantity(a.value + b.value if operator == "plus" else a.value - b.value, a.dimensions)
    if operator in ("equal", "lessThan", "greaterThan", "notEqual", "lessOrEqual", "greaterOrEqual"):
        comparisons = {"equal": a.value == b.value, "lessThan": a.value < b.value,
                       "greaterThan": a.value > b.value, "notEqual": a.value != b.value,
                       "lessOrEqual": a.value <= b.value, "greaterOrEqual": a.value >= b.value}
        return Quantity(1 if dimension_only else float(comparisons[operator]))
    raise ValueError("Unsupported check operator: " + operator)


def check_formula(xml, symbols, values=None):
    env = {symbol: unit_quantity(info["unit"]) for symbol, info in symbols.items()}
    if values:
        for symbol, value in values.items():
            if isinstance(value, tuple):
                amount, unit = value
                q = unit_quantity(unit)
                env[symbol] = Quantity(amount*q.value + (273.15 if unit == "°C" else 0), q.dimensions)
            else:
                q = env[symbol]
                env[symbol] = Quantity(float(value)*q.value, q.dimensions)
    root = ET.fromstring(xml)
    statement = root.find(f".//{{{ML}}}define")
    if statement is None:
        statement = root.find(f".//{{{ML}}}math")  # A worksheet relation.
        if statement is None:
            statement = next(n for n in root.iter() if n.tag == f"{{{ML}}}apply")
    result = evaluate(statement, env, dimension_only=values is None)
    if statement.tag.endswith("define"):
        lhs = statement[0]
        symbol = name(lhs[0]) if lhs.tag.endswith("function") else name(lhs) if lhs.tag.endswith("id") else None
        if symbol and result.dimensions != env[symbol].dimensions:
            raise ValueError("Output dimension disagrees with " + symbol)
    return result
