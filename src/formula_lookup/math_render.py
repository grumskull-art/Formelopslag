"""Offline math assets. No slides, domain models or Office dependencies."""
import hashlib
import re
from pathlib import Path

MATH_STYLE = "stix-upright-current-display-v2"


def math_latex(source):
    source = source.replace(r"\mathrm{I}", "I").replace(r"\frac", r"\dfrac")
    return "".join(r"\mathrm{I}" if token == "I" else token
                   for token in re.findall(r"\\[A-Za-z]+|\\.|.", source, re.S))


def formula_png(latex, cache: Path, color="17324D"):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    normalized = math_latex(latex)
    key = hashlib.sha256((MATH_STYLE + normalized + color).encode()).hexdigest()[:16]
    target = cache / f"formula-{key}.png"
    if not target.exists():
        cache.mkdir(parents=True, exist_ok=True)
        with matplotlib.rc_context({"mathtext.fontset": "stix", "font.family": "STIXGeneral"}):
            fig = plt.figure(figsize=(9, 1.5), facecolor="none")
            try:
                fig.text(.5, .5, f"${normalized}$", ha="center", va="center", fontsize=25, color=f"#{color}")
                fig.savefig(target, dpi=220, transparent=True, bbox_inches="tight", pad_inches=.035)
            except ValueError as exc:
                target.unlink(missing_ok=True)
                raise ValueError("Ugyldig matematik: " + latex) from exc
            finally:
                plt.close(fig)
    return target


def math_blocks(source):
    if source.count("$") % 2:
        raise ValueError("Uafsluttet matematikmarkering: " + source)
    return [("math" if i % 2 else "text", s.strip())
            for i, s in enumerate(source.split("$")) if s.strip()]


def math_search_text(source):
    source = source.replace("{,}", ",")
    for _ in range(8):
        source = re.sub(r"\\(?:mathrm|mathit|mathbf)\{([^{}]*)\}", r"\1", source)
        source = re.sub(r"\\(?:dfrac|frac)\{([^{}]*)\}\{([^{}]*)\}", r"(\1)/(\2)", source)
        source = re.sub(r"\\sqrt\{([^{}]*)\}", r"√(\1)", source)
    symbols = dict(Delta="Δ", Phi="Φ", Psi="Ψ", eta="η", alpha="α", gamma="γ", rho="ρ", mu="μ", kappa="κ", varphi="φ", sigma="σ", tau="τ",
                   varepsilon="ε", theta="θ", omega="ω", pi="π", Omega="Ω", cdot="·", times="×",
                   sum="Σ", ne="≠", approx="≈", ge="≥", le="≤", infty="∞", circ="°", cos="cos", sin="sin")
    source = re.sub(r"\\([A-Za-z]+)", lambda m: symbols.get(m[1], "" if m[1] in ("left", "right", "quad", "qquad") else m[1]), source)
    return re.sub(r"\s+", " ", source.replace(r"\,", " ").replace(r"\;", " ").replace(r"\%", "%").replace("{", "").replace("}", "")).strip()


def markup_search_text(source):
    return "\n".join(math_search_text(s) if kind == "math" else s for kind, s in math_blocks(source))
