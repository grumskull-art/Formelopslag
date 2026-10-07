/* Ideal Otto and Diesel cycles. Entropy is a difference from state 1, per mole. */
const Motor = (() => {
  const R = 8.314;
  const defaults = {
    otto: { p1: 100000, V1: 0.0005, T1: 300, r: 10, kappa: 1.4, T3: 1800 },
    diesel: { p1: 100000, V1: 0.0005, T1: 300, r: 18, kappa: 1.4, phi: 2 }
  };

  function fail(error) { return { ok: false, error }; }

  function nums(input, keys) {
    for (const key of keys) if (!Number.isFinite(input[key])) return false;
    return true;
  }

  function etaOtto(r, kappa) { return 1 - 1 / Math.pow(r, kappa - 1); }

  function etaDiesel(r, kappa, phi) {
    return 1 - (1 / Math.pow(r, kappa - 1)) * (Math.pow(phi, kappa) - 1) / (kappa * (phi - 1));
  }

  function sample(a, b, count) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(a + (b - a) * i / (count - 1));
    return out;
  }

  function finish(kind, input, corner) {
    const kappa = input.kappa;
    const cv = R / (kappa - 1);
    const cp = kappa * cv;
    const [p1, V1, T1, p2, V2, T2, p3, V3, T3, p4, V4, T4] = corner;
    const s1 = 0;
    const s2 = s1 + cv * Math.log(T2 / T1) + R * Math.log(V2 / V1);
    const s3 = s2 + (kind === 'otto' ? cv : cp) * Math.log(T3 / T2);
    const s4 = s3 + cv * Math.log(T4 / T3) + R * Math.log(V4 / V3);
    const Qin = (kind === 'otto' ? cv : cp) * (T3 - T2);
    const Qout = cv * (T4 - T1);
    const names = ['Start', 'Efter kompression', 'Efter varmetilførsel', 'Efter ekspansion'];
    const points = [[1, p1, V1, T1, s1], [2, p2, V2, T2, s2], [3, p3, V3, T3, s3], [4, p4, V4, T4, s4]]
      .map(([n, p, V, T, s], i) => ({ n, name: names[i], p, V, T, s }));
    const heat = kind === 'otto'
      ? sample(T2, T3, 24).map(T => ({ V: V2, p: p2 * (T / T2), T, s: s2 + cv * Math.log(T / T2) }))
      : sample(T2, T3, 24).map(T => ({ V: V2 * (T / T2), p: p2, T, s: s2 + cp * Math.log(T / T2) }));
    const reject = sample(T4, T1, 24).map(T => ({ V: V4, p: p4 * (T / T4), T, s: s4 + cv * Math.log(T / T4) }));
    const compress = sample(V1, V2, 40).map(V => ({ V, p: p1 * Math.pow(V1 / V, kappa), T: T1 * Math.pow(V1 / V, kappa - 1), s: s2 }));
    const expand = sample(V3, V4, 40).map(V => ({ V, p: p3 * Math.pow(V3 / V, kappa), T: T3 * Math.pow(V3 / V, kappa - 1), s: s3 }));
    const path = compress.concat(heat, expand, reject);
    const eta = kind === 'otto' ? etaOtto(input.r, kappa) : etaDiesel(input.r, kappa, input.phi);
    return { ok: true, kind, eta, W: Qin - Qout, Qin, Qout, points, path };
  }

  function otto(input) {
    const src = Object.assign({}, defaults.otto, input || {});
    if (!nums(src, ['p1', 'V1', 'T1', 'r', 'kappa', 'T3'])) return fail('Alle indtastninger skal være tal.');
    if (!(src.p1 > 0) || !(src.V1 > 0) || !(src.T1 >= 1)) return fail('Starttilstanden skal have positivt tryk og volumen, og T₁ mindst 1 K.');
    if (!(src.r > 1)) return fail('Kompressionsforholdet skal være større end 1.');
    if (!(src.kappa > 1)) return fail('κ skal være større end 1.');
    const V2 = src.V1 / src.r;
    const T2 = src.T1 * Math.pow(src.r, src.kappa - 1);
    const p2 = src.p1 * Math.pow(src.r, src.kappa);
    if (!(src.T3 > T2)) return fail('T₃ skal ligge over temperaturen efter kompression (' + T2.toFixed(1) + ' K).');
    const V3 = V2;
    const p3 = p2 * (src.T3 / T2);
    const V4 = src.V1;
    const T4 = src.T3 * Math.pow(V3 / V4, src.kappa - 1);
    const p4 = p3 * Math.pow(V3 / V4, src.kappa);
    return finish('otto', src, [src.p1, src.V1, src.T1, p2, V2, T2, p3, V3, src.T3, p4, V4, T4]);
  }

  function diesel(input) {
    const src = Object.assign({}, defaults.diesel, input || {});
    if (!nums(src, ['p1', 'V1', 'T1', 'r', 'kappa', 'phi'])) return fail('Alle indtastninger skal være tal.');
    if (!(src.p1 > 0) || !(src.V1 > 0) || !(src.T1 >= 1)) return fail('Starttilstanden skal have positivt tryk og volumen, og T₁ mindst 1 K.');
    if (!(src.kappa > 1)) return fail('κ skal være større end 1.');
    if (!(src.phi > 1)) return fail('φ skal være større end 1.');
    if (!(src.r > src.phi)) return fail('Kompressionsforholdet skal være større end indsprøjtningsforholdet.');
    const V2 = src.V1 / src.r;
    const T2 = src.T1 * Math.pow(src.r, src.kappa - 1);
    const p2 = src.p1 * Math.pow(src.r, src.kappa);
    const V3 = src.phi * V2;
    const p3 = p2;
    const T3 = T2 * src.phi;
    const V4 = src.V1;
    const T4 = T3 * Math.pow(V3 / V4, src.kappa - 1);
    const p4 = p3 * Math.pow(V3 / V4, src.kappa);
    return finish('diesel', src, [src.p1, src.V1, src.T1, p2, V2, T2, p3, V3, T3, p4, V4, T4]);
  }

  return { R, defaults, etaOtto, etaDiesel, otto, diesel };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
globalThis.Motor = Motor;
