/* IAPWS-IF97 regions 1, 2 and 4 for water.
   Equations 5, 7, 15–17, 30 and 31 from the IAPWS revised release (2007).
   Region 3, around the critical point, is outside this tool. */
const Water = (() => {
  const R = 0.461526;
  const TMIN = 273.15;
  const TMAX = 1073.15;
  const T23 = 623.15;
  const R1I = [0,0,0,0,0,0,0,0,1,1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,4,5,8,8,21,23,29,30,31,32];
  const R1J = [-2,-1,0,1,2,3,4,5,-9,-7,-1,0,1,3,-3,0,1,3,17,-4,0,6,-5,-2,10,-8,-11,-6,-29,-31,-38,-39,-40,-41];
  const R1N = [0.14632971213167,-0.84548187169114,-3.756360367204,3.3855169168385,-0.95791963387872,0.15772038513228,-0.016616417199501,0.00081214629983568,0.00028319080123804,-0.00060706301565874,-0.018990068218419,-0.032529748770505,-0.021841717175414,-5.283835796993e-05,-0.00047184321073267,-0.00030001780793026,4.7661393906987e-05,-4.4141845330846e-06,-7.2694996297594e-16,-3.1679644845054e-05,-2.8270797985312e-06,-8.5205128120103e-10,-2.2425281908e-06,-6.5171222895601e-07,-1.4341729937924e-13,-4.0516996860117e-07,-1.2734301741641e-09,-1.7424871230634e-10,-6.8762131295531e-19,1.4478307828521e-20,2.6335781662795e-23,-1.1947622640071e-23,1.8228094581404e-24,-9.3537087292458e-26];
  const R2I = [1,1,1,1,1,2,2,2,2,2,3,3,3,3,3,4,4,4,5,6,6,6,7,7,7,8,8,9,10,10,10,16,16,18,20,20,20,21,22,23,24,24,24];
  const R2J = [0,1,2,3,6,1,2,4,7,36,0,1,3,6,35,1,2,3,7,3,16,35,0,11,25,8,36,13,4,10,14,29,50,57,20,35,48,21,53,39,26,40,58];
  const R2N = [-0.0017731742473213,-0.017834862292358,-0.045996013696365,-0.057581259083432,-0.05032527872793,-3.3032641670203e-05,-0.00018948987516315,-0.0039392777243355,-0.043797295650573,-2.6674547914087e-05,2.0481737692309e-08,4.3870667284435e-07,-3.227767723857e-05,-0.0015033924542148,-0.040668253562649,-7.8847309559367e-10,1.2790717852285e-08,4.8225372718507e-07,2.2922076337661e-06,-1.6714766451061e-11,-0.0021171472321355,-23.895741934104,-5.905956432427e-18,-1.2621808899101e-06,-0.038946842435739,1.1256211360459e-11,-8.2311340897998,1.9809712802088e-08,1.0406965210174e-19,-1.0234747095929e-13,-1.0018179379511e-09,-8.0882908646985e-11,0.10693031879409,-0.33662250574171,8.9185845355421e-25,3.0629316876232e-13,-4.2002467698208e-06,-5.9056029685639e-26,3.7826947613457e-06,-1.2768608934681e-15,7.3087610595061e-29,5.5414715350778e-17,-9.436970724121e-07];
  const J0 = [0,1,-5,-4,-3,-2,-1,2,3];
  const N0 = [-9.6927686500217,10.086655968018,-0.005608791128302,0.071452738081455,-0.40710498223928,1.4240819171444,-4.383951131945,-0.28408632460772,0.021268463753307];
  const NS = [0,0.11670521452767e4,-0.72421316703206e6,-0.17073846940092e2,0.12020824702470e5,-0.32325550322333e7,0.14915108613530e2,-0.48232657361591e4,0.40511340542057e6,-0.23855557567849,0.65017534844798e3];

  const defaults = {
    QE: 10, TE: 5, TC: 35, dTSH: 5, dTSC: 2, eta: 0.75, fQ: 0, etaVol: 0.85,
    dTevap: 0, dTsuc: 0, dTSHsuc: 0, dPcond: 0, dTdis: 0, dPliq: 0
  };

  function psat(T) {
    if (T < TMIN || T > 647.096) return NaN;
    const n = NS;
    const tita = T + n[9] / (T - n[10]);
    const A = tita * tita + n[1] * tita + n[2];
    const B = n[3] * tita * tita + n[4] * tita + n[5];
    const C = n[6] * tita * tita + n[7] * tita + n[8];
    return (2 * C / (-B + Math.sqrt(B * B - 4 * A * C))) ** 4;
  }

  function tsat(P) {
    if (!(P >= 611.212677e-6 && P <= 22.064)) return NaN;
    const n = NS;
    const beta = P ** 0.25;
    const E = beta * beta + n[3] * beta + n[6];
    const F = n[1] * beta * beta + n[4] * beta + n[7];
    const G = n[2] * beta * beta + n[5] * beta + n[8];
    const D = 2 * G / (-F - Math.sqrt(F * F - 4 * E * G));
    return (n[10] + D - Math.sqrt((n[10] + D) ** 2 - 4 * (n[9] + n[10] * D))) / 2;
  }

  function p23(T) {
    return 0.34805185628969e3 - 0.11671859879975e1 * T + 0.10192970039326e-2 * T * T;
  }

  function region1(T, P) {
    const tau = 1386 / T;
    const pi = P / 16.53;
    const a = 7.1 - pi;
    const b = tau - 1.222;
    let g = 0, gp = 0, gt = 0;
    for (let i = 0; i < R1N.length; i++) {
      const I = R1I[i], J = R1J[i], n = R1N[i];
      const ap = Math.pow(a, I);
      const bp = Math.pow(b, J);
      g += n * ap * bp;
      if (I) gp += -n * I * Math.pow(a, I - 1) * bp;
      if (J) gt += n * J * ap * Math.pow(b, J - 1);
    }
    return {T, P, v: pi * gp * R * T / P / 1000, h: tau * gt * R * T, s: R * (tau * gt - g), region: 1, x: 0};
  }

  function region2(T, P) {
    const tau = 540 / T;
    const pi = P;
    let go = Math.log(pi), got = 0;
    for (let i = 0; i < N0.length; i++) {
      const J = J0[i], n = N0[i];
      go += n * Math.pow(tau, J);
      if (J) got += n * J * Math.pow(tau, J - 1);
    }
    const a = tau - 0.5;
    let gr = 0, grp = 0, grt = 0;
    for (let i = 0; i < R2N.length; i++) {
      const I = R2I[i], J = R2J[i], n = R2N[i];
      const pp = Math.pow(pi, I);
      const tp = Math.pow(a, J);
      gr += n * pp * tp;
      grp += n * I * Math.pow(pi, I - 1) * tp;
      if (J) grt += n * J * pp * Math.pow(a, J - 1);
    }
    const gt = got + grt;
    return {T, P, v: pi * (1 / pi + grp) * R * T / P / 1000, h: tau * gt * R * T, s: R * (tau * gt - (go + gr)), region: 2, x: 1};
  }

  const satCache = new Map();
  function saturation(T) {
    const key = Math.round(T * 1e6);
    const hit = satCache.get(key);
    if (hit) return hit;
    const P = psat(T);
    const f = region1(T, P);
    const g = region2(T, P);
    const sat = {T, P, hf: f.h, hg: g.h, sf: f.s, sg: g.s, vf: f.v, vg: g.v};
    satCache.set(key, sat);
    return sat;
  }

  function bisect(fn, target, lo, hi, tol) {
    let flo = fn(lo), fhi = fn(hi);
    if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return null;
    const rising = fhi >= flo;
    if (rising ? (target < flo - tol || target > fhi + tol) : (target > flo + tol || target < fhi - tol)) return null;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const fm = fn(mid);
      if (!Number.isFinite(fm)) return null;
      if (Math.abs(fm - target) <= tol || hi - lo < 1e-9) return mid;
      if ((rising && fm < target) || (!rising && fm > target)) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function bad(error) { return {ok: false, error}; }

  function pack(state, phase) {
    if (![state.h, state.s, state.v, state.T, state.P].every(Number.isFinite)) return bad('Tilstanden kunne ikke beregnes inden for IAPWS-område 1 og 2.');
    return {ok: true, T: state.T, P: state.P, h: state.h, s: state.s, v: state.v, x: state.x, region: state.region, phase};
  }

  function twoPhase(sat, h, P) {
    const span = sat.hg - sat.hf;
    const x = span ? (h - sat.hf) / span : 0;
    const phase = x <= 1e-5 ? 'mættet væske' : x >= 1 - 1e-5 ? 'mættet damp' : 'våd damp';
    return {ok: true, T: sat.T, P, h, s: sat.sf + x * (sat.sg - sat.sf), v: sat.vf + x * (sat.vg - sat.vf), x, region: 4, phase};
  }

  function pMin() { return psat(TMIN); }
  function pCap() { return psat(T23); }

  function region2ok(T, P) {
    if (!(T >= TMIN && T <= TMAX && P > 0 && P <= 100)) return false;
    if (T <= T23) return true;
    if (T <= 863.15) return P <= p23(T) * (1 + 1e-8);
    return true;
  }

  function statePT(p, tC, side) {
    const T = tC + 273.15;
    if (!(T >= TMIN && T <= TMAX) || !(p > 0 && p <= 100)) return bad('Tilstanden ligger uden for IAPWS-område 1 og 2.');
    if (p < pMin() * (1 - 1e-8)) return bad('Trykket ligger under vands triplepunkt.');
    if (p <= pCap()) {
      const Ts = tsat(p);
      if (!Number.isFinite(Ts)) return bad('Mætningstrykket kan ikke beregnes.');
      if (T > Ts + 1e-4) {
        if (!region2ok(T, p)) return bad('Tilstanden ligger i område 3 nær det kritiske punkt.');
        return pack(region2(T, p), 'overhedet damp');
      }
      if (T < Ts - 1e-4) return pack(region1(T, p), 'væske');
      const sat = saturation(Ts);
      if (side === 'g') return {ok: true, T: Ts, P: p, h: sat.hg, s: sat.sg, v: sat.vg, x: 1, region: 4, phase: 'mættet damp'};
      return {ok: true, T: Ts, P: p, h: sat.hf, s: sat.sf, v: sat.vf, x: 0, region: 4, phase: 'mættet væske'};
    }
    if (T <= T23 && p <= 100) return pack(region1(T, p), 'væske');
    return bad('Tilstanden ligger i område 3 nær det kritiske punkt.');
  }

  function statePH(p, h) {
    if (!(p > 0) || !Number.isFinite(h)) return bad('Ugyldigt tryk eller entalpi.');
    if (p < pMin() * (1 - 1e-8) || p > 100) return bad('Trykket ligger uden for område 1 og 2.');
    if (p > pCap()) return bad('Tryk over 165 bar ligger i område 3, som diagrammet ikke beregner.');
    const Ts = tsat(p);
    const sat = saturation(Ts);
    if (h >= sat.hf && h <= sat.hg) return twoPhase(sat, h, p);
    if (h < sat.hf) {
      const hFloor = region1(TMIN, p).h;
      if (h < hFloor - 1e-3) return bad('Entalpien er under væske ved 0 °C.');
      const T = bisect(t => region1(t, p).h, h, TMIN, Ts, 1e-4);
      if (T == null) return bad('Væsketilstanden kan ikke løses.');
      return pack(region1(T, p), 'væske');
    }
    if (h > region2(TMAX, p).h + 1e-2) return bad('Entalpien er over damp ved 800 °C.');
    const T = bisect(t => region2(t, p).h, h, Ts, TMAX, 1e-4);
    if (T == null || !region2ok(T, p)) return bad('Damptilstanden kan ikke løses i område 2.');
    return pack(region2(T, p), 'overhedet damp');
  }

  function statePS(p, s) {
    if (!(p >= pMin() * (1 - 1e-8) && p <= pCap()) || !Number.isFinite(s)) return bad('Isentropen ligger uden for område 1, 2 og 4.');
    const Ts = tsat(p);
    const sat = saturation(Ts);
    if (s >= sat.sf && s <= sat.sg) return twoPhase(sat, sat.hf + (s - sat.sf) / (sat.sg - sat.sf) * (sat.hg - sat.hf), p);
    if (s > sat.sg) {
      if (s > region2(TMAX, p).s) return bad('Entropien ligger over område 2.');
      const T = bisect(t => region2(t, p).s, s, Ts, TMAX, 1e-7);
      if (T == null || !region2ok(T, p)) return bad('Isentropen kan ikke løses i dampområdet.');
      return pack(region2(T, p), 'overhedet damp');
    }
    if (s < region1(TMIN, p).s - 1e-8) return bad('Entropien ligger under væske ved 0 °C.');
    const T = bisect(t => region1(t, p).s, s, TMIN, Ts, 1e-8);
    if (T == null) return bad('Isentropen kan ikke løses i væsken.');
    return pack(region1(T, p), 'væske');
  }

  function point(n, name, state) {
    return {n, name, T: state.T, P: state.P, h: state.h, s: state.s, v: state.v, x: state.x, region: state.region, phase: state.phase};
  }

  function cycle(input) {
    const src = Object.assign({}, defaults, input || {});
    const {QE, TE, TC, dTSH, dTSC, eta, fQ, etaVol, dTevap, dTsuc, dTSHsuc, dPcond, dTdis, dPliq} = src;
    if (![QE, TE, TC, dTSH, dTSC, eta, fQ, etaVol, dTevap, dTsuc, dTSHsuc, dPcond, dTdis, dPliq].every(Number.isFinite)) return bad('Alle indtastninger skal være tal.');
    if (!(TC > TE)) return bad('TC skal ligge over TE.');
    if (TE < 0 || TC > 349) return bad('TE og TC skal ligge mellem 0 °C og 349 °C. Over 350 °C begynder IAPWS-område 3.');
    if (dTSH < 0 || dTSC < 0 || dTevap < 0 || dTsuc < 0 || dTSHsuc < 0 || dTdis < 0 || dPcond < 0 || dPliq < 0) return bad('Overhedning, underkøling og tryktab kan ikke være negative.');
    if (!(eta > 0 && eta <= 1)) return bad('ηis skal være større end 0 og højst 1.');
    if (!(etaVol > 0 && etaVol <= 1)) return bad('ηvol skal være større end 0 og højst 1.');
    if (!(fQ >= 0 && fQ < 1)) return bad('fQ skal være fra 0 og under 1, som andel af akseleffekten.');
    if (!(QE > 0)) return bad('QE skal være større end nul.');
    if (TE - dTsuc < 0) return bad('Tryktabet i sugeledningen bringer mætningstemperaturen under 0 °C.');
    if (TE + dTevap > 349) return bad('Fordamperens indløbstryk kommer over gyldighedsområdet.');
    if (TC - dTSC < 0) return bad('Underkølingen bringer væsken under 0 °C.');

    const warnings = [];
    const P7 = psat(TE + 273.15);
    const P6 = psat(TE + dTevap + 273.15);
    const T7 = TE + dTSH;
    const st7 = statePT(P7, T7, 'g');
    if (!st7.ok) return st7;

    const P1 = psat(TE - dTsuc + 273.15);
    const T1 = T7 + dTSHsuc;
    const st1 = statePT(P1, T1, 'g');
    if (!st1.ok) return st1;
    if (st1.x < 1 - 1e-4) return bad('Kompressorens indløb er våd damp. Øg overhedningen, så ekspansionen forbliver tør.');

    const P4 = psat(TC + 273.15);
    const P3 = P4 + dPcond * 0.1;
    if (!(P3 > 0 && P3 <= pCap())) return bad('Kondensatortrykket ligger uden for område 1 og 2.');
    const tSat3 = tsat(P3) - 273.15;
    if (tSat3 + dTdis > 349) return bad('Trykledningen kommer for tæt på område 3.');
    const P2 = psat(tSat3 + dTdis + 273.15);
    if (!(P2 > P1)) return bad('Trykforholdet over kompressoren er ikke over 1. Kontrollér TE, TC og tryktabene.');
    if (dPcond * 0.1 > P4) warnings.push('Tryktabet i kondensatoren er større end selve kondensatortrykket. Ved disse temperaturer er vands tryk kun nogle hundrededele bar.');

    const st4 = statePT(P4, TC - dTSC, 'f');
    if (!st4.ok) return bad('Kondensatorudløbet kan ikke beregnes som væske.');
    const P5 = P4 - dPliq * 0.1;
    if (!(P5 > P6)) return bad('Væskeledningens tryk er ikke højere end fordamperens indløbstryk.');
    const st5 = statePH(P5, st4.h);
    if (!st5.ok) return bad('Tilstanden før ventilen kan ikke beregnes.');
    const st6 = statePH(P6, st5.h);
    if (!st6.ok) return bad('Ekspansionen rammer en tilstand uden for område 1, 2 og 4.');
    if (st6.region === 2) return bad('Ekspansionen ender i overhedet damp. Kontrollér tryk og underkøling.');
    if (st6.x <= 1e-4) warnings.push('Der er ingen flashgas efter ventilen. Væsken er stadig underkølet ved fordampertrykket.');

    const st2s = statePS(P2, st1.s);
    if (!st2s.ok) return bad('Den isentropiske kompression kan ikke beregnes.');
    if (st2s.x < 0.999) return bad('Isentropisk kompression ender i vådområdet. Øg overhedningen eller sænk TC.');
    const w = (st2s.h - st1.h) / eta;
    if (!(w > 0)) return bad('Kompressorarbejdet er ikke positivt.');
    const h2 = st1.h + w * (1 - fQ);
    const st2 = statePH(P2, h2);
    if (!st2.ok) return bad('Afgangstilstanden kan ikke beregnes.');
    if (st2.x < 0.999) warnings.push('Afgangen efter varmetab ligger i vådområdet.');
    const st2w = statePH(P2, st1.h + w);
    const st3 = statePH(P3, h2);
    if (!st3.ok) return bad('Tryktabet i trykledningen rammer en ugyldig tilstand.');

    const qe = st7.h - st6.h;
    const qc = st3.h - st4.h;
    if (!(qe > 0)) return bad('Fordamperens entalpiforskel er ikke positiv.');
    if (!(qc > 0)) return bad('Kondensatorens entalpiforskel er ikke positiv.');
    const m = QE / qe;
    const W = m * w;
    const QC = m * qc;
    const Qloss = fQ * W;
    const Qsuc = m * (st1.h - st7.h);
    const TEK = TE + 273.15, TCK = TC + 273.15;
    const points = [
      point(1, 'Kompressor ind', st1),
      point(2, 'Kompressor ud', st2),
      point(3, 'Kondensator ind', st3),
      point(4, 'Kondensator ud', st4),
      point(5, 'Ventil ind', st5),
      point(6, 'Fordamper ind', st6),
      point(7, 'Fordamper ud', st7),
      point(8, 'Sugeledning ud', st1)
    ];
    return {
      ok: true,
      warnings,
      points,
      results: {
        qe, qc, w, m, QE, QC, W, Qloss, Qsuc,
        cop: QE / W,
        copStar: QE / (m * (h2 - st1.h)),
        copCarnot: TEK / (TCK - TEK),
        x6: st6.x,
        T2is: st2s.T,
        T2: st2.T,
        T2w: st2w.ok ? st2w.T : NaN,
        pr: P2 / P1,
        v1: st1.v,
        Vdot: m * st1.v,
        Vs: m * st1.v / etaVol,
        balanceIn: QE + W + Qsuc,
        balanceOut: QC + Qloss
      }
    };
  }

  function logSpace(a, b, n) {
    const la = Math.log(a), lb = Math.log(b), out = [];
    for (let i = 0; i < n; i++) out.push(Math.exp(la + (lb - la) * (n === 1 ? 0 : i / (n - 1))));
    return out;
  }

  function clampView(view) {
    const floor = pMin(), ceil = pCap();
    let hMin = view.hMin, hMax = view.hMax, pMinV = view.pMin, pMaxV = view.pMax;
    if (!(hMax > hMin)) { hMin = 0; hMax = 3000; }
    if (hMax - hMin < 40) { const c = (hMin + hMax) / 2; hMin = c - 20; hMax = c + 20; }
    if (hMin < -80) { hMax += -80 - hMin; hMin = -80; }
    if (hMax > 4500) { hMin -= hMax - 4500; hMax = 4500; }
    if (!(pMaxV > pMinV)) { pMinV = floor; pMaxV = psat(273.15 + 40); }
    pMinV = Math.max(floor, pMinV);
    pMaxV = Math.min(ceil, pMaxV);
    if (Math.log10(pMaxV) - Math.log10(pMinV) < 0.08) {
      const c = (Math.log10(pMaxV) + Math.log10(pMinV)) / 2;
      pMinV = Math.max(floor, 10 ** (c - 0.04));
      pMaxV = Math.min(ceil, 10 ** (c + 0.04));
    }
    return {hMin, hMax, pMin: pMinV, pMax: pMaxV};
  }

  function frameCycle(points) {
    const hs = points.map(p => p.h);
    const ls = points.map(p => Math.log10(p.P));
    const hSpan = Math.max(180, Math.max(...hs) - Math.min(...hs));
    const lSpan = Math.max(0.22, Math.max(...ls) - Math.min(...ls));
    return clampView({
      hMin: Math.min(...hs) - hSpan * 0.22,
      hMax: Math.max(...hs) + hSpan * 0.16,
      pMin: 10 ** (Math.min(...ls) - lSpan * 0.55),
      pMax: 10 ** (Math.max(...ls) + lSpan * 0.5)
    });
  }

  function frameWide() {
    return clampView({hMin: 0, hMax: 3100, pMin: pMin(), pMax: psat(273.15 + 120)});
  }

  function frameDome() {
    return clampView({hMin: 0, hMax: 3700, pMin: pMin(), pMax: pCap()});
  }

  function zoomView(view, factor, hAnchor, pAnchor) {
    const lMin = Math.log10(view.pMin), lMax = Math.log10(view.pMax), lA = Math.log10(Math.min(view.pMax, Math.max(view.pMin, pAnchor)));
    const hA = Math.min(view.hMax, Math.max(view.hMin, hAnchor));
    return clampView({
      hMin: hA - (hA - view.hMin) * factor,
      hMax: hA + (view.hMax - hA) * factor,
      pMin: 10 ** (lA - (lA - lMin) * factor),
      pMax: 10 ** (lA + (lMax - lA) * factor)
    });
  }

  function panView(view, dh, dl) {
    return clampView({
      hMin: view.hMin + dh,
      hMax: view.hMax + dh,
      pMin: 10 ** (Math.log10(view.pMin) + dl),
      pMax: 10 ** (Math.log10(view.pMax) + dl)
    });
  }

  function tempTicks(view, extra) {
    const tLo = tsat(view.pMin) - 273.15;
    const tHi = tsat(Math.min(view.pMax, pCap())) - 273.15;
    const span = Math.max(0, tHi - tLo);
    const step = span > 120 ? 25 : span > 60 ? 10 : span > 25 ? 5 : 2;
    const ticks = new Set();
    for (let t = Math.ceil((tLo - 1e-6) / step) * step; t <= tHi + 1e-6 && ticks.size < 8; t += step) if (t >= 0 && t <= 349) ticks.add(t);
    for (const t of extra || []) {
      const rounded = Math.round(t / 5) * 5;
      if (rounded > tHi && rounded <= 800) ticks.add(rounded);
    }
    return [...ticks].sort((a, b) => a - b).slice(0, 10);
  }

  function entropyTicks(view) {
    const sLo = saturation(tsat(Math.min(view.pMax, pCap()))).sg;
    const sHi = saturation(tsat(view.pMin)).sg;
    const span = sHi - sLo;
    const step = span > 4 ? 0.5 : span > 1.5 ? 0.25 : 0.1;
    const ticks = [];
    for (let s = Math.ceil((sLo + step * 0.35) / step) * step; s < sHi - step * 0.15 && ticks.length < 6; s += step) ticks.push(Math.round(s * 100) / 100);
    return ticks;
  }

  function isotherms(tC, view) {
    const T = tC + 273.15;
    const segments = [];
    let current = [], last = '';
    for (const p of logSpace(view.pMin, view.pMax, 32)) {
      const Ts = tsat(p);
      let side = '', h = null;
      if (Number.isFinite(Ts) && T < Ts - 1e-3) { side = 'l'; h = region1(T, p).h; }
      else if (Number.isFinite(Ts) && T > Ts + 1e-3 && region2ok(T, p)) { side = 'v'; h = region2(T, p).h; }
      if (side !== last) {
        if (current.length > 1) segments.push(current);
        current = [];
      }
      if (h != null && Number.isFinite(h)) current.push({h, p});
      last = side;
    }
    if (current.length > 1) segments.push(current);
    return segments;
  }

  function isolines(view, hints) {
    const safe = clampView(view);
    const bubble = [], dew = [];
    const t0 = tsat(safe.pMin), t1 = tsat(Math.min(safe.pMax, pCap()));
    for (let i = 0; i <= 48; i++) {
      const T = t0 + (t1 - t0) * i / 48;
      const sat = saturation(T);
      bubble.push({h: sat.hf, p: sat.P});
      dew.push({h: sat.hg, p: sat.P});
    }
    const quality = [0.2, 0.4, 0.6, 0.8].map(x => ({
      x,
      points: bubble.map((b, i) => ({h: b.h + x * (dew[i].h - b.h), p: b.p}))
    }));
    const temps = tempTicks(safe, hints && hints.temps);
    const isoT = temps.map(t => ({t, segments: isotherms(t, safe)}));
    const isoS = entropyTicks(safe).map(s => {
      const points = [];
      for (const p of logSpace(safe.pMin, safe.pMax, 22)) {
        const st = statePS(p, s);
        if (st.ok) points.push({h: st.h, p: st.P});
      }
      return {s, points};
    }).filter(line => line.points.length > 2);
    let isoV = [];
    if (hints && hints.volumes) {
      const vols = [];
      for (let i = 1; i <= 4; i++) vols.push(saturation(t0 + (t1 - t0) * i / 5).vg);
      isoV = vols.map(v => {
        const points = [];
        for (const p of logSpace(safe.pMin, safe.pMax, 20)) {
          const sat = saturation(tsat(p));
          if (v > sat.vg) {
            const T = bisect(t => region2(t, p).v, v, tsat(p), TMAX, Math.max(1e-6, v * 1e-4));
            if (T != null) points.push({h: region2(T, p).h, p});
          } else if (v > sat.vf) {
            const x = (v - sat.vf) / (sat.vg - sat.vf);
            points.push({h: sat.hf + x * (sat.hg - sat.hf), p});
          }
        }
        return {v, points};
      }).filter(line => line.points.length > 2);
    }
    return {bubble, dew, quality, isotherms: isoT, isentropes: isoS, isochores: isoV};
  }

  return {
    R, defaults, psat, tsat, p23, region1, region2, saturation, statePT, statePH, statePS,
    cycle, clampView, frameCycle, frameWide, frameDome, zoomView, panView, isolines, pMin, pCap
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Water;
globalThis.Water = Water;
