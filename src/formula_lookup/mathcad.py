"""Compile the catalog's mathematical dialect to editable Prime 11 math50 XML.

Parsing, semantic decisions and units are separate from XML serialization. No
runtime dependencies, network requests, contextual unit labels or TeX fallback.
See docs/mathcad.md for the PTC operator provenance and equivalent path integrals.
"""
from dataclasses import dataclass, replace
from decimal import Decimal, InvalidOperation
import re
import xml.etree.ElementTree as ET

from .math_render import math_blocks, math_search_text

WS = "http://schemas.mathsoft.com/worksheet50"
ML = "http://schemas.mathsoft.com/math50"
XAML = "http://schemas.microsoft.com/winfx/2006/xaml/presentation"
SUB = "clr-namespace:Ptc.Wpf;assembly=Ptc.Core"
XML = "http://www.w3.org/XML/1998/namespace"
ET.register_namespace("", WS)
ET.register_namespace("ml", ML)
ET.register_namespace("p", XAML)
ET.register_namespace("s", SUB)

GREEK = dict(Delta="Δ", Phi="Φ", Psi="Ψ", eta="η", alpha="α", gamma="γ",
             rho="ρ", mu="μ", kappa="κ", varphi="φ", sigma="σ", tau="τ",
             varepsilon="ε", epsilon="ε", theta="θ", omega="ω", pi="π",
             Omega="Ω", delta="δ", xi="ξ", infty="∞")
RELATIONS = {"=": "equal", "<": "lessThan", ">": "greaterThan",
             r"\ne": "notEqual", r"\le": "lessOrEqual", r"\ge": "greaterOrEqual"}
FUNCTIONS = {"ln", "log", "exp", "sin", "cos", "tan"}


class ExportError(ValueError):
    pass


@dataclass(frozen=True)
class Node:
    kind: str
    value: str = ""
    children: tuple = ()
    subscript: str = ""


def number(value):
    try:
        result = Decimal(str(value).strip().replace(",", "."))
    except InvalidOperation as exc:
        raise ExportError("Indtast et tal; dansk decimalkomma er tilladt.") from exc
    if not result.is_finite() or abs(result.adjusted()) > 300:
        raise ExportError("Tallet skal være endeligt og inden for 10⁻³⁰⁰ til 10³⁰⁰.")
    return Node("number", str(result))


def variable(name):
    base, _, sub = name.partition("_")
    return Node("variable", base, subscript=sub)


def key(node):
    return node.value + ("_" + node.subscript if node.subscript else "")


def op(name, *children):
    return Node("operator", name, tuple(children))


def tokens(source):
    """Tokenize TeX; only lexical whitespace/decimal normalization occurs here."""
    source = source.replace("{,}", ".")
    result = []
    i = 0
    while i < len(source):
        char = source[i]
        if char.isspace():
            i += 1
            continue
        if char == "\\":
            match = re.match(r"\\(?:[A-Za-z]+|.)", source[i:])
            token = match[0]
            i += len(token)
            if token in (r"\,", r"\;", r"\ ") and source[i:].lstrip().startswith("["):
                result.append(r"\annotation")
                continue
            if token not in (r"\left", r"\right", r"\,", r"\!", r"\;", r"\quad", r"\qquad", r"\ "):
                result.append(token)
            continue
        if char.isdigit() or char == "." and i + 1 < len(source) and source[i + 1].isdigit():
            match = re.match(r"(?:\d+(?:\.\d*)?|\.\d+)", source[i:])
            result.append(match[0])
            i += len(match[0])
            continue
        result.append(char)
        i += 1
    return result


class Parser:
    """Recursive descent with explicit unary, power and product precedence."""

    def __init__(self, source, arrays=(), unit=False):
        self.items = tokens(source)
        self.pos = 0
        self.arrays = set(arrays)
        self.unit_mode = unit
        self.abs_depth = 0

    def peek(self):
        return self.items[self.pos] if self.pos < len(self.items) else ""

    def take(self, expected=None):
        value = self.peek()
        if not value or expected is not None and value != expected:
            raise ExportError(f"Forventede {expected or 'udtryk'}, fandt {value!r}.")
        self.pos += 1
        return value

    def raw_group(self):
        if self.peek() != "{":
            return self.take()
        self.take("{")
        depth, parts = 1, []
        while depth:
            value = self.take()
            depth += (value == "{") - (value == "}")
            if depth:
                parts.append(value)
        return "".join(parts)

    def parse(self):
        node = self.relation()
        if self.peek():
            raise ExportError("Ikke fortolket token: " + self.peek())
        return node

    def relation(self):
        node = self.addition()
        while self.peek() in RELATIONS or self.peek() == r"\approx":
            token = self.take()
            # Approximation is recorded as an evaluation result, never equality.
            node = Node("approx" if token == r"\approx" else "relation",
                        RELATIONS.get(token, ""), (node, self.addition()))
        return node

    def addition(self):
        node = self.product()
        while self.peek() in ("+", "-"):
            node = op("plus" if self.take() == "+" else "minus", node, self.product())
        return node

    def product(self):
        node = self.unary()
        stops = {"", ")", "]", "}", ",", "=", "<", ">", r"\approx", r"\ne", r"\le", r"\ge", "+", "-"}
        if self.abs_depth:
            stops.add("|")
        while self.peek() not in stops:
            if self.peek() == r"\annotation":
                self.take(); self.take("[")
                unit = self.relation(); self.take("]")
                if any(n.kind in ("variable", "call", "relation") for n in walk(unit)):
                    raise ExportError("Enhedsannotation skal indeholde en enhed.")
                node = Node("annotation", children=(node, unit))
            elif self.peek() in ("*", r"\cdot", r"\times", "/", r"\div"):
                token = self.take()
                rhs = self.unary()
                tag = "div" if token in ("/", r"\div") else "crossProduct" if token == r"\times" and node.kind == rhs.kind == "vector" else "mult"
                node = op(tag, node, rhs)
            elif self.peek() == r"\%":
                self.take()
                node = op("scale", node, Node("unit", "%"))
            else:
                node = op("scale", node, self.unary())
        return node

    def unary(self):
        if (self.items[self.pos:self.pos+1] == ["d"]
                and self.items[self.pos+2:self.pos+4] == ["/", "d"]
                and len(self.items) > self.pos+4):
            body, bound = self.items[self.pos+1], self.items[self.pos+4]
            if body.isalpha() and bound.isalpha():
                self.pos += 5
                return Node("derivative", children=(variable(body), variable(bound)))
        if self.peek() in ("+", "-"):
            sign = self.take()
            node = self.unary()
            return op("neg", node) if sign == "-" else node
        return self.power()

    def script(self):
        if self.peek() == "{":
            self.take()
            node = self.relation()
            self.take("}")
            return node
        return self.unary()

    def power(self):
        node = self.atom()
        if self.peek() == "[":
            saved = self.pos
            try:
                self.take()
                annotation = self.relation()
                self.take("]")
                if not any(n.kind in ("variable", "call", "relation") for n in walk(annotation)):
                    node = op("div", node, annotation)
                else:
                    self.pos = saved
            except ExportError:
                self.pos = saved
        if self.peek() == "^":
            self.take()
            if self.peek() == r"\circ":
                self.take()
                return op("scale", node, Node("unit", "deg"))
            if node.kind == "variable" and node.value == "e" and not node.subscript:
                node = replace(node, kind="constant")
            node = op("pow", node, self.script())
        return node

    def atom(self):
        token = self.take()
        if token in ("(", "[", "{"):
            close = {"(": ")", "[": "]", "{": "}"}[token]
            if token == "{" and self.peek() == "}":
                self.take(); self.take("^"); self.take(r"\circ")
                if self.peek() == r"\mathrm":
                    self.take()
                    if self.raw_group() != "C":
                        raise ExportError("Ukendt temperaturenhed.")
                    return Node("unit", "°C")
                return Node("unit", "deg")
            node = self.relation()
            self.take(close)
            return Node("parens", children=(node,)) if token != "{" else node
        if token == "|":
            self.abs_depth += 1
            node = self.addition()
            self.take("|")
            self.abs_depth -= 1
            return op("absval", node)
        if re.fullmatch(r"\d+(?:\.\d*)?|\.\d+", token):
            return number(token)
        if token in (r"\frac", r"\dfrac"):
            a = self.group()
            b = self.group()
            derivative = self.as_derivative(a, b)
            return derivative or op("div", a, b)
        if token == r"\sqrt":
            degree = Node("placeholder")
            if self.peek() == "[":
                self.take()
                degree = self.relation()
                self.take("]")
            return op("nthRoot", degree, self.group())
        if token in (r"\sum", r"\prod"):
            return self.summation(token)
        if token == r"\int":
            return self.integral()
        if token == r"\oint":
            raise ExportError("Lukket kurveintegral kræver eksplicit parametrisering.")
        if token == r"\dot":
            node = self.atom()
            return replace(node, value=node.value + "̇")
        if token == r"\%":
            return Node("unit", "%")
        if token == r"\vec":
            return Node("vector", children=(self.atom(),))
        if token == r"\Delta":
            node = self.atom()
            return replace(node, value="Δ" + node.value)
        if token in (r"\mathrm", r"\mathit", r"\mathbf"):
            raw = self.raw_group()
            if raw in ("M", "k", "m") and self.peek() == r"\Omega":
                self.take()
                return Node("unit", raw + "Ω")
            if raw == "d":
                return Node("differential")
            try:
                return unit_expression(raw)
            except ExportError:
                if self.unit_mode:
                    raise
            node = Node("variable", raw)
        elif token.startswith("\\"):
            name = token[1:]
            if name in FUNCTIONS:
                # Function application consumes one powered argument, not a whole sum.
                return Node("call", name, (self.unary(),))
            if name not in GREEK:
                raise ExportError("Ukendt matematisk kommando: " + token)
            if name == "Omega":
                return Node("unit", "Ω")
            if name == "mu" and self.peek() == r"\mathrm":
                self.take()
                return Node("unit", "μ" + self.raw_group())
            node = Node("constant" if name in ("pi", "infty") else "variable", GREEK[name])
        elif token.isalpha() or token in ("Ω", "°", "ξ"):
            node = Node("unit" if self.unit_mode else "variable", token)
        else:
            raise ExportError("Ukendt matematisk token: " + token)
        if self.peek() == "_":
            self.take()
            sub = math_search_text(self.raw_group()).replace(" ", "")
            node = replace(node, subscript=sub)
        # TeX adjacent letters are products; only an identifier with an explicit
        # parenthesized argument is a call. C(u_m-u_0) remains multiplication.
        if self.peek() == "(" and key(node) in {"q", "u_C", "i", "i_ud", "e", "Φ", "p", "V", "Q_rev", "T"}:
            self.take()
            arg = self.relation()
            self.take(")")
            node = Node("call", key(node), (arg,))
        if node.kind == "variable" and key(node) in self.arrays:
            base, _, index = key(node).rpartition("_")
            node = Node("index", children=(variable(base), variable(index)))
        return node

    def group(self):
        self.take("{")
        node = self.relation()
        self.take("}")
        return node

    @staticmethod
    def as_derivative(a, b):
        if (a.kind == b.kind == "operator" and a.value == b.value == "scale"
                and (a.children[0].kind == "differential" or a.children[0] == variable("d"))
                and (b.children[0].kind == "differential" or b.children[0] == variable("d"))):
            return Node("derivative", children=(a.children[1], b.children[1]))
        return None

    def summation(self, token):
        bound, lower, upper = Node("placeholder"), None, Node("placeholder")
        if self.peek() == "_":
            self.take()
            sub = self.script()
            if sub.kind == "relation" and sub.value == "equal":
                bound, lower = sub.children
            else:
                bound = sub
        if self.peek() == "^":
            self.take()
            upper = self.script()
        # Sum scope ends at +/-, including products and a fraction as its body.
        body = self.product()
        if bound.kind == "placeholder":
            # Vector sum uses an empty boundVars, confirmed by PTC's example.
            return Node("sum_vector", "summation" if token == r"\sum" else "product", (body,))
        return Node("sum", "summation" if token == r"\sum" else "product",
                    (body, bound, lower or Node("placeholder"), upper),
                    subscript="range" if lower is None else "bounded")

    def integral(self):
        lower = upper = Node("placeholder")
        if self.peek() == "_":
            self.take()
            lower = self.script()
        if self.peek() == "^":
            self.take()
            upper = self.script()
        start, depth, end = self.pos, 0, None
        for i in range(start, len(self.items)):
            token = self.items[i]
            if depth == 0 and token in ("d", r"\mathrm"):
                if token == "d" or self.items[i:i+4] == [r"\mathrm", "{", "d", "}"]:
                    end = i
                    break
            depth += (token in ("{", "(", "[")) - (token in ("}", ")", "]"))
        if end is None:
            raise ExportError("Integralets differential mangler; angiv en procesparameter.")
        parser = Parser("", self.arrays)
        parser.items = self.items[start:end]
        body = parser.parse()
        self.pos = end
        if self.take() == r"\mathrm":
            self.take("{"); self.take("d"); self.take("}")
        bound = self.atom()
        return Node("integral", children=(body, bound, lower, upper))


UNIT_NAMES = set("V kV A Ah Ω kΩ MΩ mΩ ohm W J N kN mN μN s min m mm cm km kg g mol Pa kPa MPa K C μC nC F H S mS T mT Wb rad rpm Hz hr L kW kJ MJ kWh mA mH ms μF nF pF mWb °C Δ°C deg %".split())
UNIT_ALIASES = {"ohm": "Ω", "degC": "°C", "delta_degC": "Δ°C", "uF": "μF", "h": "hr"}


def unit_expression(source):
    """Parse a separately typed unit expression; words are whole unit names."""
    if source in ("1", "", "masse-%", "kg luft/kg brændsel"):
        return number(1)
    source = source.replace(r"\cdot", "*").replace("·", "*")
    source = source.replace("²", "^2").replace("³", "^3").replace("⁻¹", "^-1")
    source = source.replace("°C", "degC")
    pieces = re.findall(r"[A-Za-zμΩ]+|\d+|[*/^()+-]", source)
    if "".join(pieces) != source.replace(" ", ""):
        raise ExportError("Ugyldig enhed: " + source)
    parser = Parser("", unit=True)
    # Render whole unit names as \mathrm groups, so kg is not k*g.
    parser.items = []
    for piece in pieces:
        if piece[0].isalpha() or piece in ("μ", "Ω"):
            name = UNIT_ALIASES.get(piece, piece)
            if name not in UNIT_NAMES:
                raise ExportError("Ukendt enhed: " + name)
            parser.items.extend([r"\mathrm", "{", name, "}"])
        else:
            parser.items.append(piece)
    # Avoid recursively parsing a single upright unit.
    if len(pieces) == 1 and pieces[0] not in ("1",):
        name = UNIT_ALIASES.get(pieces[0], pieces[0])
        if name in ("Ah", "kWh"):
            return op("mult", Node("unit", "A" if name == "Ah" else "kW"), Node("unit", "hr"))
        return Node("unit", name)
    return parser.parse()


def resolve(node, metadata):
    """Apply explicit catalog semantics, not a global letter-to-unit heuristic."""
    node = replace(node, children=tuple(resolve(n, metadata) for n in node.children))
    if node.kind == "annotation":
        return node.children[0]
    if node.kind == "variable" and key(node) in metadata.get("constants", []):
        return replace(node, kind="constant")
    if (node.kind == "operator" and node.value == "div"
            and node.children[0] == variable("ΔT")
            and node.children[1] == Node("unit", "°C")
            and metadata.get("symbols", {}).get("ΔT", {}).get("unit") == "K"):
        node = replace(node, children=(node.children[0], Node("unit", "Δ°C")))
    if node.kind == "call" and node.children[0].kind == "number" and node.value in metadata.get("function_symbols", {}):
        argument = metadata["function_symbols"][node.value]
        unit = metadata["symbols"][argument]["unit"]
        if unit != "1":
            node = replace(node, children=(op("scale", node.children[0], unit_expression(unit)),))
    if node.kind == "variable" and key(node) in metadata.get("index_aliases", {}):
        info = metadata["index_aliases"][key(node)]
        return Node("index", children=(variable(info["name"]),
                    *(variable(i) for i in info["indices"])))
    if node.kind == "variable" and key(node) in metadata.get("arrays", []):
        name, _, index = key(node).rpartition("_")
        return Node("index", children=(variable(name), variable(index)))
    if node.kind == "variable" and key(node) in metadata.get("numeric_inputs", {}):
        unit = metadata["numeric_inputs"][key(node)]
        return op("div", op("div", node, unit_expression(unit)), unit_expression("s"))
    if node.kind == "number" and node.value in metadata.get("coefficient_units", {}):
        return op("scale", node, unit_expression(metadata["coefficient_units"][node.value]))
    return node


def element(tag, children=(), text=None, **attrs):
    node = ET.Element("{" + ML + "}" + tag, attrs)
    node.text = text
    node.extend(children)
    return node


def identifier(node, label=None):
    label = label or {"variable": "VARIABLE", "constant": "CONSTANT", "unit": "UNIT"}[node.kind]
    result = element("id", labels=label, **{"{" + XML + "}space": "preserve"})
    if node.subscript:
        span = ET.SubElement(result, "{" + XAML + "}Span")
        span.text = node.value
        ET.SubElement(span, "{" + SUB + "}Subscript").text = node.subscript
    else:
        result.text = node.value
    return result


def to_element(node):
    if node.kind in ("variable", "constant", "unit"):
        return identifier(node)
    if node.kind == "number":
        return element("real", text=node.value)
    if node.kind == "placeholder":
        return element("placeholder")
    if node.kind == "parens":
        return element("parens", [to_element(node.children[0])])
    if node.kind == "vector":
        return to_element(node.children[0])
    if node.kind in ("operator", "relation", "index"):
        if node.kind == "relation" and node.value == "notEqual":
            # PTC's published regions establish not/equal. Use their exact
            # logical composition rather than assume an unverified ≠ tag name.
            equal = element("apply", [element("equal"), *(to_element(n) for n in node.children)])
            return element("apply", [element("not"), element("parens", [equal])])
        if node.kind == "index" and len(node.children) > 2:
            return element("apply", [element("indexer"), to_element(node.children[0]),
                           element("sequence", [to_element(n) for n in node.children[1:]])])
        return element("apply", [element("indexer" if node.kind == "index" else node.value),
                                 *(to_element(n) for n in node.children)])
    if node.kind == "call":
        name = variable(node.value)
        head = identifier(name, "FUNCTION" if node.value in FUNCTIONS else "VARIABLE")
        return element("apply", [head, to_element(node.children[0])])
    if node.kind == "function":
        return element("function", [identifier(variable(node.value)),
                       element("boundVars", [to_element(n) for n in node.children])])
    if node.kind in ("define", "eval"):
        return element(node.kind, [to_element(n) for n in node.children])
    if node.kind == "override":
        return element("unitOverride", [to_element(node.children[0])])
    if node.kind == "derivative":
        body, bound = node.children
        if body.kind == "variable":
            body = Node("call", key(body), (bound,))
        return element("apply", [element("derivative"),
                       element("lambda", [element("boundVars", [to_element(bound)]), to_element(body)]),
                       element("degree", [element("placeholder")])])
    if node.kind in ("sum", "sum_vector", "integral"):
        body = node.children[0]
        bounds = [element("placeholder")] if node.kind == "sum_vector" else [to_element(node.children[1])]
        result = element("apply", [element("integral" if node.kind == "integral" else node.value),
                         element("lambda", [element("boundVars", bounds), to_element(body)])])
        if node.kind != "sum_vector":
            if node.subscript != "range":
                result.append(element("lowerBound", [to_element(node.children[2])]))
            result.append(element("upperBound", [to_element(node.children[3])]))
        else:
            result.append(element("upperBound", [element("placeholder")]))
        return result
    raise ExportError("Kan ikke serialisere AST-node: " + node.kind)


def region(node, name="formula", top=0):
    result = ET.Element("{" + WS + "}region", id="formelopslag_" + name,
                        actualWidth="600", actualHeight="96", top=str(top), left="0")
    math = ET.SubElement(result, "{" + WS + "}math", resultRef="0")
    math.append(to_element(node))
    return result


def serialize(nodes, name="formula"):
    if not nodes:
        raise ExportError("Ingen matematiske områder valgt.")
    regions = [region(node, f"{name}_{i}", i * 120) for i, node in enumerate(nodes)]
    if len(regions) == 1:
        root = regions[0]
    else:
        root = ET.Element("{" + WS + "}worksheet")
        ET.SubElement(root, "{" + WS + "}regions").extend(regions)
    xml = xml_string(root)
    validate_xml(xml)
    return xml


def xml_string(root):
    """Use explicit default namespaces at transitions, as in Prime's examples."""
    def clone(node, inherited=None):
        namespace, local = node.tag[1:].split("}")
        attrs = {("xml:space" if k == f"{{{XML}}}space" else k): v for k, v in node.attrib.items()}
        if namespace != inherited:
            attrs["xmlns"] = namespace
        result = ET.Element(local, attrs)
        result.text = node.text
        result.extend(clone(child, namespace) for child in node)
        return result
    return ET.tostring(clone(root), encoding="unicode")


def validate_xml(xml):
    root = ET.fromstring(xml)
    if root.tag not in (f"{{{WS}}}region", f"{{{WS}}}worksheet"):
        raise ExportError("Eksporten skal være region eller worksheet.")
    for n in root.iter():
        local = n.tag.rsplit("}", 1)[-1]
        if local not in ("id", "real", "Span", "Subscript") and n.text and n.text.strip():
            raise ExportError("Utilsigtet tekst i " + local)
        if n.tail and n.tail.strip():
            raise ExportError("Utilsigtet tekst efter " + local)
        if local == "define" and len(n) != 2:
            raise ExportError("Definitionen kræver én venstre- og én højreside.")
        if local == "id" and n.get("labels") not in ("VARIABLE", "UNIT", "CONSTANT", "FUNCTION"):
            raise ExportError("Identifikatoren mangler en eksplicit type.")
    return root


def walk(node):
    yield node
    for child in node.children:
        yield from walk(child)


def equal_parts(node):
    if node.kind in ("relation", "approx") and node.value in ("equal", ""):
        return equal_parts(node.children[0]) + [node.children[1]]
    return [node]


def definition(lhs, rhs):
    if lhs.kind == "vector" and lhs.children[0].kind == "variable":
        lhs = lhs.children[0]
    if lhs.kind == "call" and lhs.children[0].kind == "variable":
        lhs = Node("function", lhs.value, lhs.children)
    # |I| describes a magnitude; define the nonnegative magnitude I explicitly.
    if lhs.kind == "operator" and lhs.value == "absval" and lhs.children[0].kind == "variable":
        lhs = lhs.children[0]
    if lhs.kind not in ("variable", "function", "index"):
        return Node("relation", "equal", (lhs, rhs))
    return Node("define", children=(lhs, rhs))


def compile_formula(source, metadata, purpose="main"):
    alternatives = split_equations(source)
    if len(alternatives) > 1:
        return [n for s in alternatives for n in compile_formula(s, metadata, purpose)]
    node = Parser(source).parse()
    annotation = node.children[1] if node.kind == "annotation" else None
    semantic_meta = metadata if purpose == "main" else {k: v for k, v in metadata.items() if k not in ("numeric_inputs", "coefficient_units")}
    node = resolve(node, semantic_meta)
    if annotation is not None:
        return [Node("eval", children=(node, Node("override", children=(annotation,))))]
    if node.kind == "approx" and purpose != "example":
        lhs, rhs = node.children
        target = lhs.children[0] if lhs.kind == "operator" and lhs.value in ("absval", "div") else lhs
        info = metadata.get("symbols", {}).get(key(target)) if target.kind == "variable" else None
        value = rhs if info else lhs
        unit = unit_expression(info["unit"]) if info else Node("placeholder")
        if info and lhs.kind == "operator" and lhs.value == "div" and all(n.kind not in ("variable", "call") for n in walk(lhs.children[1])):
            value = op("scale", rhs, lhs.children[1])
        return [Node("eval", children=(value, Node("override", children=(unit,))))]
    parts = equal_parts(node)
    if len(parts) > 1 and parts[0].kind == "variable" and key(parts[0]) in metadata.get("definition_symbols", []):
        return [definition(parts[0], rhs) for rhs in parts[1:]]
    if len(parts) < 2 or purpose in ("pitfall", "conversion", "explanation"):
        return [node] if node.kind != "approx" else [Node("eval", children=(parts[0], Node("override", children=(Node("placeholder"),))))]
    if purpose == "example":
        # A chain is a definition from the calculation, followed by evaluation;
        # displayed rounded results are not fed back into the calculation.
        lhs, rhs = parts[:2]
        unit = None
        if len(parts) > 2:
            last = parts[-1]
            if last.kind == "operator" and last.value == "scale" and any(n.kind == "unit" for n in walk(last.children[1])):
                unit = last.children[1]
        output_name = key(lhs) if lhs.kind == "variable" else lhs.value if lhs.kind == "call" else None
        if output_name in metadata.get("symbols", {}):
            unit = unit_expression(metadata["symbols"][output_name]["unit"])
        if unit is not None and not any(n.kind == "unit" for n in walk(rhs)):
            rhs = op("scale", rhs, unit)
        if lhs.kind != "variable":
            return [Node("eval", children=(rhs, Node("override", children=(unit or Node("placeholder"),))))]
        return [definition(lhs, rhs)]
    if purpose == "steps" and parts[0].kind == "call" and (parts[0].children[0].kind != "variable" or key(parts[0].children[0]) not in ("t", "V", "ξ")):
        return [Node("relation", "equal", (parts[0], rhs)) for rhs in parts[1:]]
    if metadata.get("relation") and purpose == "main":
        return [Node("relation", "equal", (parts[0], rhs)) for rhs in parts[1:]]
    return [definition(parts[0], rhs) for rhs in parts[1:]]


def split_equations(source):
    result, start, depth = [], 0, 0
    # Only separators outside groups split equations; subscript commas stay names.
    separator = r"\quad\mathrm{eller}\quad"
    i = 0
    while i < len(source):
        if depth == 0 and (source[i] == "," and (i == 0 or source[i-1] != "\\") or source.startswith(separator, i)):
            result.append(source[start:i].strip())
            i += len(separator) if source.startswith(separator, i) else 1
            start = i
            continue
        depth += (source[i] in "{([") - (source[i] in "})]")
        i += 1
    result.append(source[start:].strip())
    return result


def blocks(entry):
    yield "main", 0, entry["latex"]
    for field in ("steps", "conversion", "pitfall", "example", "explanation"):
        for index, (kind, source) in enumerate(math_blocks(entry.get(field, ""))):
            if kind == "math":
                yield field, index, source


def attach_metadata(catalogs, document):
    """Resolve explicit symbol bindings against this catalog's quantity definitions."""
    if document.get("version") != 1:
        raise ExportError("Ukendt Mathcad-metadataversion.")
    known = {e["id"] for c in catalogs for e in c["entries"]}
    if set(document.get("entries", {})) - known:
        raise ExportError("Mathcad-metadata henviser til et ukendt opslag.")
    for catalog in catalogs:
        bindings = document.get("bindings", {}).get(catalog["id"], {})
        units = document.get("unit_overrides", {}).get(catalog["id"], {})
        quantities = catalog["quantities"]

        def info(quantity):
            if isinstance(quantity, dict):
                return dict(quantity)
            if quantity not in quantities:
                raise ExportError("Ukendt størrelsesbinding: " + quantity)
            label = quantities[quantity]
            unit = units.get(quantity)
            if unit is None:
                match = re.search(r"\[([^]]+)\]", label)
                if match:
                    unit = match[1].split(",")[0]
            if unit is None:
                raise ExportError("Enhed mangler for " + quantity)
            unit_expression(unit)
            return {"label": label, "unit": unit, "quantity": quantity}

        for entry in catalog["entries"]:
            specific = document.get("entries", {}).get(entry["id"], {})
            symbols = {}
            for quantity, label in quantities.items():
                if "[" in label or quantity in units:
                    symbol = bindings.get(quantity, quantity)
                    if symbol in symbols and quantity != symbol and symbol in quantities:
                        continue  # Keep canonical meanings until the entry selects an alias.
                    symbols[symbol] = info(quantity)
            # Entry-local lookup selects between homonymous quantities, e.g. n,
            # E, t and h. No global inferred letter-to-unit mapping is used.
            selected = list(dict.fromkeys([entry["lookup"]["seek_key"], *sum(entry["lookup"]["given_sets"], [])]))
            for quantity in selected:
                label = quantities[quantity]
                if "[" in label or quantity in units:
                    symbols[bindings.get(quantity, quantity)] = info(quantity)
            for symbol, quantity in specific.get("symbols", {}).items():
                symbols[symbol] = info(quantity)
            meta = {k: v for k, v in specific.items() if k != "symbols"}
            meta["symbols"] = symbols
            entry["mathcad_metadata"] = meta


def free_inputs(node, symbols):
    """Dependencies respect function, sum and integral binders."""
    result = {}

    def add(name, type_="scalar", argument=None):
        if name not in symbols:
            raise ExportError("Eksportmetadata mangler for variablen " + name)
        value = dict(symbols[name], name=name, type=type_)
        if argument is not None:
            value["argument"] = argument
        result[name] = value

    def visit(n, bound=()):
        if n.kind == "vector" and n.children[0].kind == "variable":
            add(key(n.children[0]), "vector")
        elif n.kind == "variable":
            if key(n) not in bound:
                add(key(n), symbols.get(key(n), {}).get("type", "scalar"))
        elif n.kind == "index":
            add(key(n.children[0]), "matrix" if len(n.children) > 2 else "vector")
            for index in n.children[1:]:
                visit_index(index, bound)
        elif n.kind == "call":
            if n.value not in FUNCTIONS:
                argument = key(n.children[0]) if n.children[0].kind == "variable" else None
                add(n.value, "function", argument)
            for child in n.children:
                visit(child, bound)
        elif n.kind == "define":
            lhs, rhs = n.children
            visit(rhs, (*bound, *(key(a) for a in lhs.children)) if lhs.kind == "function" else bound)
            if lhs.kind == "function":
                for argument in lhs.children:
                    add(key(argument))  # Needed for an optional numerical evaluation.
            elif lhs.kind == "index":
                for index in lhs.children[1:]:
                    visit_index(index, bound)
        elif n.kind == "derivative":
            body, arg = n.children
            if body.kind == "variable":
                add(key(body), "function", key(arg))
            else:
                visit(body, (*bound, key(arg)))
            visit(arg, bound)
        elif n.kind in ("sum", "integral"):
            body, arg, lower, upper = n.children
            visit(body, (*bound, key(arg)))
            if n.subscript == "range":
                add(key(arg), "range")
            else:
                visit(lower, bound); visit(upper, bound)
        elif n.kind == "sum_vector":
            body = n.children[0]
            if body.kind != "variable":
                raise ExportError("Vektorsum kræver et vektornavn.")
            add(key(body), "vector")
        else:
            for child in n.children:
                visit(child, bound)
    def visit_index(index, bound):
        if index.kind == "variable" and key(index) not in bound:
            name = key(index)
            add(name, "range" if symbols.get(name, {}).get("type") == "range" else "index")
        elif index.kind != "variable":
            visit(index, bound)

    visit(node)
    return list(result.values())


def input_template(info):
    name = variable(info["name"])
    value = variable("formelopslaginput")
    unit = unit_expression(info["unit"])
    if info["type"] == "function":
        arg = variable(info["argument"])
        name = Node("function", info["name"], (arg,))
    return serialize([Node("define", children=(name, op("scale", value, unit)))], "input")


def compile_entry(entry):
    meta = entry.get("mathcad_metadata")
    if not meta:
        raise ExportError("Mathcad-metadata mangler: " + entry["id"])
    meta = dict(meta, function_symbols=dict(meta.get("function_symbols", {})))
    for statement in compile_formula(meta.get("main_latex", entry["latex"]), meta):
        if statement.kind == "define" and statement.children[0].kind == "function":
            lhs = statement.children[0]
            meta["function_symbols"].setdefault(lhs.value, key(lhs.children[0]))
    formulas, coverage, example_nodes = [], [], []
    for field, index, source in blocks(entry):
        export_source = meta.get("main_latex", source) if field == "main" else source
        nodes = compile_formula(export_source, meta, field)
        for position, node in enumerate(nodes):
            if node.kind == "define" and node.children[1] == number(0):
                lhs = node.children[0]
                name = key(lhs.children[0]) if lhs.kind == "index" else key(lhs) if lhs.kind == "variable" else lhs.value
                if name in meta["symbols"] and meta["symbols"][name]["unit"] != "1":
                    nodes[position] = replace(node, children=(lhs, op("scale", number(0), unit_expression(meta["symbols"][name]["unit"]))))
        if field == "example":
            for node in nodes:
                if node.kind == "define":
                    lhs, rhs = node.children
                    name = key(lhs) if lhs.kind == "variable" else lhs.value
                    if not any(n.kind == "unit" for n in walk(rhs)) and name in meta["symbols"]:
                        node = replace(node, children=(lhs, op("scale", rhs, unit_expression(meta["symbols"][name]["unit"]))))
                example_nodes.append(node)
        xml = serialize(nodes, entry["id"] + "_" + field + str(index))
        coverage.append({"field": field, "index": index, "latex": source,
                         "export_latex": export_source, "status": "structured",
                         "nodes": sorted({n.kind for node in nodes for n in walk(node)}), "xml": xml})
        for variant, node in enumerate(nodes):
            local_symbols = {k: dict(v) for k, v in meta["symbols"].items()}
            if field == "main" and variant < len(meta.get("variant_units", [])):
                for name, unit in meta["variant_units"][variant].items():
                    local_symbols[name]["unit"] = unit
            # Examples have explicit units, or are arithmetic in the documented
            # output unit. They never supply invented scalar input defaults.
            if field == "example" and node.kind == "define":
                lhs, rhs = node.children
                output = key(lhs) if lhs.kind == "variable" else lhs.value
                if not any(n.kind == "unit" for n in walk(rhs)) and output in local_symbols:
                    node = replace(node, children=(lhs, op("scale", rhs, unit_expression(local_symbols[output]["unit"]))))
            inputs = free_inputs(node, local_symbols)
            for info in inputs:
                if info["type"] == "function":
                    info["argument"] = meta.get("function_symbols", {}).get(info["name"], info.get("argument"))
                    if not info.get("argument"):
                        raise ExportError("Funktionsargument mangler for " + info["name"])
                    if info["argument"] not in local_symbols:
                        raise ExportError("Argumentenhed mangler for " + info["argument"])
                    info["argument_unit"] = local_symbols[info["argument"]]["unit"]
                    info["argument_unit_xml"] = xml_string(to_element(unit_expression(info["argument_unit"])))
                info["template"] = input_template(info)
                info["unit_xml"] = xml_string(to_element(unit_expression(info["unit"])))
            lhs = node.children[0] if node.kind == "define" else None
            output_name = (key(lhs) if lhs.kind == "variable" else key(lhs.children[0]) if lhs.kind == "index" else lhs.value) if lhs else None
            output_type = ("function" if lhs.kind == "function" else "matrix" if lhs.kind == "index" and len(lhs.children) > 2 else "vector" if lhs.kind == "index" or any(n.kind == "vector" for n in walk(node.children[1])) else "scalar") if lhs else None
            if field == "main":
                from .mathcad_check import check_formula
                check_formula(serialize([node], entry["id"]), local_symbols)
            evaluation = None
            if lhs is not None:
                value = Node("call", lhs.value, lhs.children) if lhs.kind == "function" else lhs
                unit = unit_expression(local_symbols[output_name]["unit"]) if output_name in local_symbols else Node("placeholder")
                evaluation = serialize([Node("eval", children=(value, Node("override", children=(unit,))))], entry["id"] + "_eval")
            formulas.append({"id": f"{field}-{index}-{variant}", "field": field, "latex": source,
                             "label": {"main": "Hovedformel", "steps": "Beregningsformel", "example": "Kildebaseret regneeksempel", "conversion": "Enhedsomregning", "pitfall": "Faglig bemærkning", "explanation": "Forklaring"}[field] + (f" · vej {variant+1}" if len(nodes) > 1 else ""),
                             "xml": serialize([node], entry["id"] + "_" + field + str(index) + "_" + str(variant)),
                             "inputs": inputs, "evaluation": evaluation, "output": output_name, "output_type": output_type,
                             "note": "Kilden bruger ≈. Eksporten evaluerer udtrykket eller tilnærmelsen uden en eksakt definition eller lighed." if r"\approx" in source and field != "example" else ""})
    return {"formulas": formulas, "coverage": coverage, "note": meta.get("note", ""), "native_tested": False,
            "main_dimensions_checked": True,
            "example_xml": serialize(example_nodes, entry["id"] + "_example") if example_nodes else None,
            "origin_xml": serialize([Node("define", children=(variable("ORIGIN"), number(1)))], "origin")}
