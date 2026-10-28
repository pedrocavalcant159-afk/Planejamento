// Efeitos visuais compartilhados pelas páginas públicas. Tudo respeita prefers-reduced-motion
// e usa só transform/opacity/canvas para manter 60fps no celular.
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = window.matchMedia('(pointer: fine)').matches;
document.documentElement.classList.add('fx-ready');

const PALETTES = {
  1: ['#bf8152', '#d9a77f', '#f2dcd2', '#e8c3ae', '#a8693c'],
  2: ['#66972f', '#8cc152', '#b5d98a', '#d8ecbf', '#4b7620'],
  3: ['#4f5b3e', '#7d8a68', '#c9a24f', '#e6d39a', '#a7b092'],
  4: ['#849462', '#a9b58a', '#d4d9bd', '#c9b79c', '#5e4636'],
};
// Formato das partículas de cada modelo.
const SHAPES = { 1: 'petal', 2: 'leaf', 3: 'leaf', 4: 'heart' };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];

function makeCanvas(className, layer) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  if (layer === 'front') canvas.style.zIndex = '40';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  return { canvas, ctx, size };
}

function drawShape(ctx, p, model) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(1, Math.cos(p.flip));
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  const shape = SHAPES[model] || 'leaf';
  if (shape === 'leaf') {
    ctx.moveTo(0, -p.size);
    ctx.quadraticCurveTo(p.size * .7, 0, 0, p.size);
    ctx.quadraticCurveTo(-p.size * .7, 0, 0, -p.size);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(0, -p.size * .8); ctx.lineTo(0, p.size * .8); ctx.stroke();
  } else if (shape === 'petal') {
    ctx.moveTo(0, p.size);
    ctx.bezierCurveTo(p.size, p.size * .2, p.size * .7, -p.size, 0, -p.size * .55);
    ctx.bezierCurveTo(-p.size * .7, -p.size, -p.size, p.size * .2, 0, p.size);
    ctx.fill();
  } else { // coração
    const s = p.size * .7;
    ctx.moveTo(0, s * .9);
    ctx.bezierCurveTo(-s * 1.4, 0, -s * .7, -s * 1.1, 0, -s * .35);
    ctx.bezierCurveTo(s * .7, -s * 1.1, s * 1.4, 0, 0, s * .9);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Partículas ambiente em tela cheia no formato do modelo (SHAPES): pétalas, folhas ou corações.
 * layer 'back' fica atrás do conteúdo (o conteúdo precisa de position:relative; z-index:1);
 * 'front' passa por cima com pointer-events:none. Retorna { stop, burst(x, y) }.
 */
export function ambient(model = 1, { density = 1, layer = 'back' } = {}) {
  if (reducedMotion) return { stop() {}, burst() {} };
  const { canvas, ctx, size } = makeCanvas('fx-ambient', layer);
  const palette = PALETTES[model] || PALETTES[1];
  let parts = [], raf = 0, last = performance.now(), running = true;
  const spawn = (initial = false, x, y) => {
    return {
      x: x ?? rand(0, innerWidth),
      y: y ?? (initial ? rand(0, innerHeight) : -20),
      size: rand(5, 11),
      vy: rand(14, 34),
      vx: rand(-6, 6),
      sway: rand(10, 40), freq: rand(.4, 1.2), phase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI * 2), vr: rand(-.8, .8), flip: rand(0, Math.PI), vf: rand(.5, 2),
      color: pick(palette), alpha: rand(.35, .75), t: 0,
    };
  };
  const target = () => Math.round(Math.min(46, (innerWidth * innerHeight) / 38000) * density);
  const fill = () => { while (parts.length < target()) parts.push(spawn(true)); };
  fill();
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach(p => {
      p.t += dt; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.t * p.freq + p.phase) * p.sway * .6) * dt;
      p.rot += p.vr * dt; p.flip += p.vf * dt;
      if (p.burst) { p.vy += 60 * dt; p.life -= dt; p.alpha = Math.max(0, p.life); }
      drawShape(ctx, p, model);
    });
    parts = parts.filter(p => (p.burst ? p.life > 0 : p.y > -40 && p.y < innerHeight + 40 && p.x > -60 && p.x < innerWidth + 60));
    const normal = parts.filter(p => !p.burst).length;
    for (let i = normal; i < target(); i++) parts.push(spawn());
    if (running) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const onVisibility = () => { running = !document.hidden; if (running) { last = performance.now(); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('resize', size);
  return {
    stop() { running = false; cancelAnimationFrame(raf); canvas.remove(); document.removeEventListener('visibilitychange', onVisibility); removeEventListener('resize', size); },
    // Explosão de partículas do próprio tema a partir de um ponto (ex.: ao abrir o envelope).
    burst(x = innerWidth / 2, y = innerHeight / 2, amount = 36) {
      for (let i = 0; i < amount; i++) {
        const a = rand(0, Math.PI * 2), speed = rand(60, 260), p = spawn(false, x, y);
        Object.assign(p, { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 80, sway: 0, burst: true, life: rand(1.2, 2.4), alpha: 1, size: p.size * 1.2 });
        parts.push(p);
      }
    },
  };
}

/** Confete em tela cheia saindo de um ponto (ou de um elemento). Some sozinho. */
export function confetti(origin, model = 1, { amount = 140, spread = 1 } = {}) {
  if (reducedMotion) return;
  let x = innerWidth / 2, y = innerHeight / 2;
  if (origin instanceof Element) { const r = origin.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  else if (origin) ({ x, y } = origin);
  const { canvas, ctx } = makeCanvas('fx-confetti', 'front');
  const palette = PALETTES[model] || PALETTES[1];
  const pieces = Array.from({ length: amount }, () => {
    const a = rand(-Math.PI, 0) * spread + (spread < 1 ? -Math.PI / 2 * (1 - spread) : 0), v = rand(280, 720);
    return { x, y, vx: Math.cos(a) * v * rand(.4, 1), vy: Math.sin(a) * v, w: rand(5, 10), h: rand(8, 16), rot: rand(0, 6), vr: rand(-10, 10), color: pick(palette), shape: Math.random() < .3 ? 'circle' : 'rect', tilt: rand(0, 6) };
  });
  let last = performance.now(), elapsed = 0;
  const frame = now => {
    const dt = Math.min(.04, (now - last) / 1000); last = now; elapsed += dt;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    pieces.forEach(p => {
      p.vy += 900 * dt; p.vx *= .985; p.vy *= .985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.tilt += dt * 8;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.tilt));
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - 2) / 1.2); ctx.fillStyle = p.color;
      if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (elapsed < 3.2) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/**
 * Divide o texto em letras (ou palavras) que entram uma a uma. Chame .play() para animar.
 * Para fontes cursivas (Great Vibes) prefira by:'word' para não quebrar as ligaduras.
 */
export function splitText(el, { by = 'char', delay = 0, stagger = 40 } = {}) {
  if (!el) return { play() {} };
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  let i = 0;
  text.split(/(\s+)/).forEach(chunk => {
    if (/^\s+$/.test(chunk)) { el.append(document.createTextNode(' ')); return; }
    const word = document.createElement('span');
    word.className = 'fx-word'; word.setAttribute('aria-hidden', 'true');
    if (by === 'word') { word.classList.add('fx-char'); word.style.setProperty('--i', i++); word.textContent = chunk; }
    else [...chunk].forEach(ch => { const s = document.createElement('span'); s.className = 'fx-char'; s.style.setProperty('--i', i++); s.textContent = ch; word.append(s); });
    el.append(word);
  });
  el.classList.add('fx-split');
  el.style.setProperty('--fx-delay', `${delay}ms`);
  el.style.setProperty('--fx-stagger', `${stagger}ms`);
  return { play() { el.classList.add('fx-play'); }, count: i };
}

/** Revela elementos com [data-fx] quando entram na tela. Filhos de [data-fx-stagger] entram em cascata. */
export function reveal(root = document, { threshold = .14 } = {}) {
  root.querySelectorAll('[data-fx-stagger]').forEach(parent => [...parent.children].forEach((child, i) => {
    child.style.setProperty('--fx-i', i);
    if (!child.hasAttribute('data-fx')) child.setAttribute('data-fx', parent.dataset.fxStagger || 'up');
  }));
  const els = [...root.querySelectorAll('[data-fx]:not(.fx-in)')];
  if (reducedMotion || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('fx-in')); return; }
  const targets = new Map(); // elemento observado → elementos revelados por ele
  const show = el => { el.classList.add('fx-in'); el.querySelectorAll?.('svg[data-fx-draw]').forEach(svg => drawSvg(svg)); };
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    (targets.get(entry.target) || []).forEach(show);
    io.unobserve(entry.target);
  }), { threshold: 0.01, rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => {
    const target = el.dataset.fx === 'clip' && el.parentElement ? el.parentElement : el;
    targets.set(target, [...(targets.get(target) || []), el]);
    io.observe(target);
  });
}

/** Desenha os traços de um SVG (path, line, circle...) como se fosse feito à mão. */
export function drawSvg(svg, { duration = 1600, stagger = 120, delay = 0 } = {}) {
  if (!svg || svg.dataset.fxDrawn) return;
  svg.dataset.fxDrawn = '1';
  const shapes = [...svg.querySelectorAll('path, line, circle, ellipse, polyline, polygon, rect')];
  shapes.forEach((shape, i) => {
    if (reducedMotion || typeof shape.getTotalLength !== 'function') return;
    const len = shape.getTotalLength();
    const hasStroke = getComputedStyle(shape).stroke !== 'none';
    if (hasStroke && len) {
      shape.style.strokeDasharray = len;
      shape.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay: delay + i * stagger, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
    }
    if (getComputedStyle(shape).fill !== 'none') shape.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: delay + duration * .6 + i * stagger, easing: 'ease-out', fill: 'both' });
  });
}

/** Inclinação 3D com brilho que segue o ponteiro (só em mouse/trackpad). */
export function tilt(el, { max = 8, scale = 1.02 } = {}) {
  if (!el || reducedMotion || !finePointer) return;
  el.classList.add('fx-tilt');
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * max}deg`); el.style.setProperty('--ry', `${(px - 0.5) * max}deg`);
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`); el.style.setProperty('--ts', scale);
  });
  el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--ts', 1); });
}

/** Botão "magnético": puxa levemente na direção do ponteiro. */
export function magnetic(el, { strength = .25 } = {}) {
  if (!el || reducedMotion || !finePointer) return;
  el.classList.add('fx-magnetic');
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--gx', `${(e.clientX - r.left - r.width / 2) * strength}px`); el.style.setProperty('--gy', `${(e.clientY - r.top - r.height / 2) * strength}px`); });
  el.addEventListener('pointerleave', () => { el.style.setProperty('--gx', '0px'); el.style.setProperty('--gy', '0px'); });
}

/** Parallax: elementos com data-speed (ex.: "0.2" ou "-0.15") se movem com a rolagem.
 *  Use em elementos sem outras transformações (ex.: um wrapper de ornamento). */
export function parallax(root = document) {
  const els = [...root.querySelectorAll('[data-speed]')];
  if (!els.length || reducedMotion) return;
  let ticking = false;
  const update = () => {
    const vh = innerHeight;
    els.forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      const offset = (r.top + r.height / 2 - vh / 2) * Number(el.dataset.speed);
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

/** Troca o texto de um número com animação de "deslizar" (use na contagem regressiva). */
export function tick(el, value) {
  if (!el || el.textContent === String(value)) return;
  el.textContent = value;
  if (!reducedMotion) el.animate([{ transform: 'translateY(55%) scale(.9)', opacity: 0, filter: 'blur(3px)' }, { transform: 'none', opacity: 1, filter: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.25,1.2)' });
}

/** Conta de 0 até o valor. */
export function countUp(el, to, { duration = 1400, format = n => Math.round(n).toLocaleString('pt-BR') } = {}) {
  if (!el) return;
  if (reducedMotion) { el.textContent = format(to); return; }
  const start = performance.now();
  const step = now => { const t = Math.max(0, Math.min(1, (now - start) / duration)), eased = 1 - Math.pow(1 - t, 3); el.textContent = format(to * eased); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/** Barra fina no topo que mostra o progresso da rolagem. */
export function scrollProgress() {
  if (reducedMotion) return;
  const bar = document.createElement('div');
  bar.className = 'fx-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const update = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`; };
  addEventListener('scroll', update, { passive: true }); update();
}

/** Vibração curta no celular (ignorada onde não existe). */
export const buzz = (pattern = 18) => { try { navigator.vibrate?.(pattern); } catch {} };
