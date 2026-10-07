/* Ideal-gas box. Pressure is p = nRT/V. Particles are a picture of that state. */
const Gas = (() => {
  const R = 8.314;
  const TMIN = 1;
  const TMAX = 2000;
  const VMIN = 0.01;
  const VMAX = 0.2;
  const NMAX = 40;
  let raf = 0;
  let running = false;
  let particles = [];
  let flash = 0;
  let shown = 0;

  function clamp(value, lo, hi) { return Math.min(hi, Math.max(lo, value)); }

  function pressure(n, T, V) {
    if (!(n > 0) || !(T > 0) || !(V > 0)) return 0;
    return n * R * T / V;
  }

  function adjust(state, change, hold) {
    const prev = { n: state.n, T: state.T, V: state.V };
    let n = change.n != null ? change.n : prev.n;
    let T = change.T != null ? change.T : prev.T;
    let V = change.V != null ? change.V : prev.V;
    const notes = [];
    if (!Number.isFinite(n) || !Number.isFinite(T) || !Number.isFinite(V)) return { ok: false, error: 'Alle indtastninger skal være tal.' };
    if (n < 0) n = 0;
    if (n > NMAX) { n = NMAX; notes.push('Stofmængden er i top.'); }
    if (T < TMIN) { T = TMIN; notes.push('Temperaturen kan ikke nå 0 K.'); }
    if (T > TMAX) { T = TMAX; notes.push('Temperaturen er i top.'); }
    if (V < VMIN) { V = VMIN; notes.push('Volumen er i bund.'); }
    if (V > VMAX) { V = VMAX; notes.push('Volumen er i top.'); }
    const p0 = pressure(prev.n, prev.T, prev.V);
    if (hold === 'volume') {
      V = prev.V;
      if (change.V != null && change.V !== prev.V) notes.push('Volumen holdes fast.');
    } else if (hold === 'temperature') {
      T = prev.T;
      if (change.T != null && change.T !== prev.T) notes.push('Temperaturen holdes fast.');
    } else if (hold === 'pressure') {
      if (!(p0 > 0) || !(n > 0)) notes.push('Trykket kan ikke holdes uden gas.');
      else if (change.V != null && change.n == null && change.T == null) {
        T = p0 * V / (n * R);
        if (T < TMIN) { T = TMIN; notes.push('Temperaturen er i bund, så trykket kan ikke holdes.'); }
        else if (T > TMAX) { T = TMAX; notes.push('Temperaturen er i top, så trykket kan ikke holdes.'); }
      } else {
        V = n * R * T / p0;
        if (V < VMIN) { V = VMIN; notes.push('Volumen er i bund, så trykket kan ikke holdes.'); }
        else if (V > VMAX) { V = VMAX; notes.push('Volumen er i top, så trykket kan ikke holdes.'); }
      }
    }
    return { ok: true, n, T, V, p: pressure(n, T, V), note: notes[0] || '' };
  }

  function ensure(n) {
    const count = n > 0 ? Math.max(1, Math.min(60, Math.round(n * 6))) : 0;
    if (count === shown && particles.length === count) return;
    shown = count;
    if (count < particles.length) particles.length = count;
    while (particles.length < count) {
      particles.push({ x: Math.random(), y: Math.random(), vx: Math.random() * 2 - 1, vy: Math.random() * 2 - 1, hit: 0 });
    }
  }

  function paint(state) {
    const canvas = document.getElementById('gas-canvas');
    const wall = document.getElementById('gas-wall');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const styles = getComputedStyle(document.documentElement);
    const panel = styles.getPropertyValue('--panel').trim() || '#fff';
    const ink = styles.getPropertyValue('--ink').trim() || '#182a35';
    const accent = styles.getPropertyValue('--accent').trim() || '#076d66';
    const border = styles.getPropertyValue('--border').trim() || '#d8e2e7';
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, width, height);
    const pad = 28;
    const track = Math.max(40, width - pad * 2 - 36);
    const span = Math.max(VMIN, Math.min(VMAX, state.V));
    const boxW = 48 + (span - VMIN) / (VMAX - VMIN) * (track - 48);
    const top = 28;
    const bottom = height - 28;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, top, boxW, bottom - top);
    ctx.fillStyle = border;
    ctx.fillRect(pad, bottom, boxW, 8);
    if (wall) {
      wall.style.left = (pad + boxW - 10) + 'px';
      wall.style.top = top + 'px';
      wall.style.height = (bottom - top) + 'px';
    }
    const speed = 70 * Math.sqrt(Math.max(state.T, TMIN) / 300);
    for (const particle of particles) {
      const px = pad + 10 + particle.x * (boxW - 20);
      const py = top + 10 + particle.y * (bottom - top - 20);
      ctx.beginPath();
      ctx.fillStyle = particle.hit > 0 ? accent : ink;
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (flash > 0) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = Math.min(0.45, flash);
      ctx.fillRect(pad + boxW - 6, top, 6, bottom - top);
      ctx.globalAlpha = 1;
    }
    return { boxW, speed };
  }

  function step(dt, speed) {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : dt;
    flash = Math.max(0, flash - dt * 2.5);
    for (const particle of particles) {
      particle.hit = Math.max(0, particle.hit - dt * 4);
      const norm = Math.hypot(particle.vx, particle.vy) || 1;
      particle.x += particle.vx / norm * speed * motion / 260;
      particle.y += particle.vy / norm * speed * motion / 180;
      if (particle.x < 0) { particle.x = 0; particle.vx = Math.abs(particle.vx); particle.hit = 1; flash = 0.45; }
      if (particle.x > 1) { particle.x = 1; particle.vx = -Math.abs(particle.vx); particle.hit = 1; flash = 0.45; }
      if (particle.y < 0) { particle.y = 0; particle.vy = Math.abs(particle.vy); }
      if (particle.y > 1) { particle.y = 1; particle.vy = -Math.abs(particle.vy); }
    }
  }

  let last = 0;
  let current = { n: 2, T: 300, V: 0.05 };
  function loop(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const painted = paint(current) || { speed: 0 };
    step(dt, painted.speed || 0);
    raf = requestAnimationFrame(loop);
  }

  function sync(state) {
    current = { n: state.n, T: state.T, V: state.V };
    ensure(state.n);
    paint(current);
  }

  function start(state) {
    sync(state);
    running = true;
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    last = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  return { R, TMIN, TMAX, VMIN, VMAX, NMAX, pressure, adjust, start, stop, sync };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Gas;
globalThis.Gas = Gas;
