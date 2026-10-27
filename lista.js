import { loadProductPage, eventInfo, watchReservas, reserveGift, renderUnavailable, mapsUrl, esc } from './lib/site.js';
import { dateLong } from './lib/catalog.js';
import { GIFTS, GIFT_CATEGORIES } from './lib/gifts.js';
import { ambient, confetti, splitText, reveal, drawSvg, tilt, magnetic, parallax, buzz, reducedMotion } from './lib/fx.js';

const $ = (s, root = document) => root.querySelector(s);
const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wait = ms => new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : ms));
const EASE = 'cubic-bezier(.2,.8,.2,1)';

// Ícones por categoria. As partes com classe a-* ganham microanimação no hover.
const categoryIcons = {
  'Cozinha': '<path d="M4 11h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M3 11h15M17 13h4"/><g class="a-steam"><path d="M8.5 3.5c-1 1.3 1 2.2 0 4"/><path d="M12.5 3.5c-1 1.3 1 2.2 0 4"/></g>',
  'Utensílios': '<g class="a-wiggle-l"><path d="M7 3v7a2 2 0 0 0 2 2v9M5 3v5M9 3v5"/></g><g class="a-wiggle-r"><path d="M16 21V12c-2-1-2.5-3.5-2.5-5.5S14.5 3 16 3s2.5 1.5 2.5 3.5S18 11 16 12"/></g>',
  'Mesa posta': '<g class="a-spin"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/><path d="M8.6 9.4a4.4 4.4 0 0 1 2.4-2"/></g><g class="a-clink-l"><path d="M3 4v6a1 1 0 0 0 1 1v9"/></g><g class="a-clink-r"><path d="M21 4v16M21 4c-1.5 0-2.5 2-2.5 5s1 4 2.5 4"/></g>',
  'Eletroportáteis': '<g class="a-shake"><path d="M8 3h8l-1 10H9z"/><path d="M7 13h10l1 4H6zM6 17h12v4H6zM16 6h3v4h-2.6"/><path class="a-swirl" d="M10.4 8.6c1-.9 2.2-.9 3.2 0"/></g>',
  'Cama & banho': '<path d="M3 18V8M21 18v-5a3 3 0 0 0-3-3H10v5M3 15h18"/><g class="a-bob"><circle cx="6.5" cy="11.5" r="1.8"/></g><path class="a-z" d="M15 3.5h3l-3 3h3"/>',
  'Organização & limpeza': '<path d="M4 9h16l-1.5 11h-13z"/><path d="M9 13v4M12 13v4M15 13v4"/><g class="a-swing"><path d="M8 9 10 4M16 9l-2-5"/></g><path class="a-sparkle" d="M20 2.5v3M18.5 4h3"/>',
};
const icon = category => `<svg class="gift-icon" viewBox="0 0 24 24" aria-hidden="true">${categoryIcons[category] || categoryIcons['Cozinha']}</svg>`;

function flower(cx, cy, r, base = 0) {
  const petals = [0, 72, 144, 216, 288].map((a, i) => {
    const rad = a * Math.PI / 180, px = (cx + Math.cos(rad) * r * .55).toFixed(1), py = (cy + Math.sin(rad) * r * .55).toFixed(1);
    return `<g transform="rotate(${a} ${px} ${py})"><ellipse class="petal" style="--d:${base + i * 70}ms" cx="${px}" cy="${py}" rx="${(r * .5).toFixed(1)}" ry="${(r * .34).toFixed(1)}" fill="currentColor" fill-opacity=".12"/></g>`;
  }).join('');
  return `${petals}<circle class="petal" style="--d:${base + 380}ms" cx="${cx}" cy="${cy}" r="${(r * .22).toFixed(1)}" fill="currentColor" fill-opacity=".4"/>`;
}

// Folha fechada (sem atributo transform no próprio path para o drawSvg poder animá-la).
const leaf = (x, y, angle, size = 1) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size})"><path d="M0 0c8-11 23-13 31-8-6 10-21 13-31 8z" fill="currentColor" fill-opacity=".16"/></g>`;

const ornamentsFor = model => {
  if (model === 1) {
    const vine = `<svg class="orn orn-1" viewBox="0 0 320 60" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M20 30h110M190 30h110"/><path d="M160 18c-6 6-6 18 0 24 6-6 6-18 0-24z" fill="currentColor" fill-opacity=".2"/>${[0, 1, 2, 3].map(i => `<path d="M${125 - i * 26} 30c-6-10-16-12-22-10 4 7 12 11 22 10z" fill="currentColor" fill-opacity=".14"/><path d="M${125 - i * 26} 30c-6 10-16 12-22 10 4-7 12-11 22-10z" fill="currentColor" fill-opacity=".14"/><path d="M${195 + i * 26} 30c6-10 16-12 22-10-4 7-12 11-22 10z" fill="currentColor" fill-opacity=".14"/><path d="M${195 + i * 26} 30c6 10 16 12 22 10-4-7-12-11-22-10z" fill="currentColor" fill-opacity=".14"/>`).join('')}</g></svg>`;
    const branch = side => `<div class="branch-wrap branch-${side}" data-speed="-0.12" aria-hidden="true"><svg class="orn-branch" viewBox="0 0 120 280"><g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M64 278C60 214 70 160 56 108S40 34 66 4"/>${[[60, 240, -150, 1], [62, 210, -30, .9], [62, 172, -160, 1.05], [58, 140, -20, .95], [54, 108, -155, .9], [50, 80, -35, .85], [54, 50, -150, .8], [60, 26, -40, .7]].map(l => leaf(...l)).join('')}</g></svg></div>`;
    return `${vine}${branch('left')}${branch('right')}`;
  }
  if (model === 2) {
    const corner = side => `<div class="orn-wrap orn-wrap-${side}" data-speed="-0.08" aria-hidden="true"><svg class="orn-2 bloom" viewBox="0 0 160 160"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path class="stem" d="M70 70c20 18 34 38 40 70M64 76c-10 20-30 30-56 30M80 50c18-6 40-2 62 12"/>${flower(52, 52, 20, 500)}${flower(104, 28, 12, 800)}${flower(30, 108, 13, 950)}</g></svg></div>`;
    return `${corner('left')}${corner('right')}`;
  }
  return '';
};

const decoCorner = pos => `<svg class="deco-corner deco-${pos}" viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="square"><path d="M2 80V22L22 2H80" stroke-width="1.4"/><path d="M10 80V26L26 10H80" stroke-width=".8"/><path d="M18 80V30L30 18H80" stroke-width=".5" opacity=".6"/><path d="M34 34l5-5 5 5-5 5z" fill="currentColor" fill-opacity=".9"/></g></svg>`;
const decoFan = () => {
  const rays = Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (i / 12), x = 80 - Math.cos(a) * 70, y = 78 - Math.sin(a) * 70; return `<path d="M80 78L${x.toFixed(1)} ${y.toFixed(1)}"/>`; }).join('');
  return `<svg class="deco-fan" viewBox="0 0 160 82" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".9">${rays}<path d="M10 78a70 70 0 0 1 140 0"/><path d="M34 78a46 46 0 0 1 92 0"/><path d="M56 78a24 24 0 0 1 48 0" fill="currentColor" fill-opacity=".18"/></g></svg>`;
};
function nightSky() {
  const stars = Array.from({ length: 70 }, () => {
    const size = Math.random() < .15 ? 3 : Math.random() < .5 ? 2 : 1;
    return `<i style="left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;--s:${size}px;--d:${(Math.random() * 6).toFixed(2)}s;--t:${(2.5 + Math.random() * 4).toFixed(2)}s"></i>`;
  }).join('');
  return `<div class="night-sky" aria-hidden="true">${stars}<b class="shooting" style="--d:3s;top:12%;left:62%"></b><b class="shooting" style="--d:9s;top:30%;left:85%"></b><b class="shooting" style="--d:15s;top:6%;left:35%"></b></div>`;
}

const state = { slug: '', site: null, model: 1, reserved: new Set(), mine: new Set(), category: 'Todos', search: '', current: null, initialized: false, liveSince: 0, fx: null };
const cells = new Map();

function loadMine() { try { return new Set(JSON.parse(localStorage.getItem(`lista-${state.slug}-minhas`)) || []); } catch { return new Set(); } }
function saveMine() { try { localStorage.setItem(`lista-${state.slug}-minhas`, JSON.stringify([...state.mine])); } catch {} }

let toastTimer;
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

function initials(couple) {
  return String(couple || '').split(/\s*(?:&| e )\s*/i).map(n => n.trim()[0] || '').filter(Boolean).slice(0, 2).join('&').toUpperCase();
}

function animateNumber(el, from, to, { duration = 1200, pad = 0 } = {}) {
  if (!el) return;
  const format = n => String(Math.round(n)).padStart(pad, '0');
  if (reducedMotion || from === to) { el.textContent = format(to); return; }
  const start = performance.now();
  const step = now => { const t = Math.min(1, Math.max(0, (now - start) / duration)), eased = 1 - Math.pow(1 - t, 3); el.textContent = format(from + (to - from) * eased); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------- Estrutura da página ---------- */
function renderShell() {
  const { site, slug, model } = state, cha = eventInfo(site, 'lista');
  const when = [cha.date ? dateLong(cha.date, true) : '', cha.time ? `às ${cha.time}` : ''].filter(Boolean).join(' ');
  const app = $('#app');
  const clip = 'up';
  app.className = `lista model-${model}`; app.removeAttribute('aria-busy');
  document.title = `Lista de presentes · ${site.couple}`;
  app.innerHTML = `
    ${model === 3 ? nightSky() : ''}
    <header class="hero">${model === 3 ? '<span class="beam beam-l" aria-hidden="true"></span><span class="beam beam-r" aria-hidden="true"></span>' : ''}
      ${ornamentsFor(model)}
      <div class="hero-inner">
        ${model === 2 ? `<svg class="arch-bloom bloom" viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2">${flower(40, 40, 28, 250)}</g></svg>` : ''}
        ${model === 3 ? `<div class="deco-frame" aria-hidden="true">${['tl', 'tr', 'bl', 'br'].map(decoCorner).join('')}<span class="deco-edge deco-top"></span><span class="deco-edge deco-bottom"></span><span class="deco-edge deco-left"></span><span class="deco-edge deco-right"></span>${decoFan()}</div><span class="monogram" aria-hidden="true"><svg class="mono-ring" viewBox="0 0 80 80"><g fill="none" stroke="currentColor"><circle cx="40" cy="40" r="38" stroke-width="1"/><circle cx="40" cy="40" r="33" stroke-width=".6"/></g></svg><span class="mono-text gold-text">${esc(initials(site.couple))}</span></span>` : ''}
        <p class="eyebrow" data-fx="${clip}" style="--fx-d:120ms"><span class="fx-inner">Lista de presentes · Chá de Panela</span></p>
        <h1 class="couple gold-chars">${esc(site.couple)}</h1>
        <p class="hero-meta" data-fx="${clip}"><span class="fx-inner">${esc(when || 'Data a definir')}${cha.venue ? `<span class="dot" aria-hidden="true">·</span>${esc(cha.venue)}` : ''}</span></p>
        <div class="hero-actions" data-fx="up">
          ${site.products?.convite ? `<a class="btn btn-shine" href="convite.html?c=${encodeURIComponent(slug)}">Ver convite</a>` : ''}
          ${cha.venue || cha.address ? `<a class="btn btn-ghost" href="${esc(mapsUrl(cha))}" target="_blank" rel="noopener">Como chegar</a>` : ''}
        </div>
      </div>
    </header>
    <main class="content">
      <section class="intro" data-fx="${clip}" id="intro">
        <p>Escolha um presente para ajudar a montar a nossa casa. Ao confirmar, ele fica reservado no seu nome e deixa de aparecer como disponível para os outros convidados.</p>
        <div class="progress" aria-live="polite">
          <div class="progress-label"><strong id="taken-count">0</strong> de ${GIFTS.length} presentes já escolhidos</div>
          <div class="progress-track"><span id="progress-bar"></span></div>
        </div>
      </section>
      <section class="toolbar" aria-label="Filtros da lista" id="toolbar" data-fx="${clip}" style="--fx-d:120ms">
        <div class="chips" role="group" aria-label="Categorias" id="chips"></div>
        <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr-only">Buscar presente</span><input id="search" type="search" placeholder="Buscar presente" autocomplete="off" /></label>
      </section>
      <section class="grid" id="grid" aria-label="Presentes"></section>
      <p class="empty" id="empty" hidden>Nenhum presente encontrado com essa busca.</p>
    </main>
    <footer class="footer" data-fx="up"><span class="footer-couple">${esc(site.couple)}</span><span>Obrigado por fazer parte deste momento ♡</span></footer>
    <button type="button" class="sticky-count" id="sticky-count" tabindex="-1" aria-hidden="true">
      <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-bg" cx="18" cy="18" r="15"/><circle class="ring" id="sticky-ring" cx="18" cy="18" r="15" pathLength="100"/></svg>
      <span><strong id="sticky-taken">0</strong>/${GIFTS.length}<small>escolhidos</small></span>
    </button>`;

  // Nomes letra a letra (palavra a palavra no Rosé, que usa letra cursiva).
  const nameDelay = model === 3 ? 900 : 380, nameStagger = model === 1 ? 42 : model === 2 ? 180 : 230;
  const names = splitText($('.couple'), { by: model === 1 ? 'char' : 'word', delay: nameDelay, stagger: nameStagger });
  const namesEnd = nameDelay + names.count * nameStagger + 300;
  $('.hero-meta').style.setProperty('--fx-d', `${namesEnd}ms`);
  $('.hero-actions').style.setProperty('--fx-d', `${namesEnd + 160}ms`);
  requestAnimationFrame(() => names.play());

  if (model === 1) {
    drawSvg($('.orn-1'), { duration: 1500, stagger: 60, delay: 100 });
    document.querySelectorAll('.orn-branch').forEach(svg => drawSvg(svg, { duration: 1800, stagger: 110, delay: 300 }));
  }
  if (model === 3) {
    document.querySelectorAll('.deco-corner').forEach(svg => drawSvg(svg, { duration: 1300, stagger: 140, delay: 150 }));
    drawSvg($('.deco-fan'), { duration: 1400, stagger: 45, delay: 500 });
    drawSvg($('.mono-ring'), { duration: 1200, stagger: 200, delay: 300 });
  }
  requestAnimationFrame(() => app.classList.add('intro-play'));

  renderChips();
  buildGrid();
  reveal(app);
  parallax(app);
  document.querySelectorAll('.hero-actions .btn').forEach(btn => magnetic(btn, { strength: .3 }));

  let searchTimer;
  $('#search').addEventListener('input', event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.search = event.target.value; applyFilter(); }, 140); });
  $('#chips').addEventListener('click', event => {
    const chip = event.target.closest('[data-category]'); if (!chip) return;
    state.category = chip.dataset.category; updateChips(); applyFilter();
  });
  $('#grid').addEventListener('click', event => {
    const button = event.target.closest('[data-gift]'); if (button) openDialog(button.dataset.gift, button.closest('.gift'));
  });
  $('#sticky-count').addEventListener('click', () => $('#toolbar').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' }));
  watchSticky();
  addEventListener('resize', () => { moveIndicator(); setColumnIndexes(); });
  document.fonts?.ready.then(moveIndicator);
}

/* ---------- Filtros com indicador deslizante ---------- */
function renderChips() {
  const all = ['Todos', ...GIFT_CATEGORIES];
  $('#chips').innerHTML = `<span class="chip-indicator" aria-hidden="true"></span>${all.map(category => {
    const total = category === 'Todos' ? GIFTS.length : GIFTS.filter(g => g.category === category).length;
    return `<button type="button" class="chip" data-category="${esc(category)}" aria-pressed="false">${esc(category)} <small>${total}</small></button>`;
  }).join('')}`;
  updateChips();
}

function updateChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    const active = chip.dataset.category === state.category;
    chip.classList.toggle('active', active); chip.setAttribute('aria-pressed', active);
  });
  moveIndicator();
}

function moveIndicator() {
  const chips = $('#chips'), active = chips?.querySelector('.chip.active'), indicator = chips?.querySelector('.chip-indicator');
  if (!active || !indicator) return;
  indicator.style.setProperty('--x', `${active.offsetLeft}px`);
  indicator.style.setProperty('--y', `${active.offsetTop}px`);
  indicator.style.setProperty('--w', `${active.offsetWidth}px`);
  indicator.style.setProperty('--h', `${active.offsetHeight}px`);
  requestAnimationFrame(() => indicator.classList.add('ready'));
  if (chips.scrollWidth > chips.clientWidth) chips.scrollTo({ left: active.offsetLeft - chips.clientWidth / 2 + active.offsetWidth / 2, behavior: reducedMotion ? 'auto' : 'smooth' });
}

/* ---------- Grade de presentes ---------- */
function cardFoot(gift) {
  const taken = state.reserved.has(gift.id), mine = state.mine.has(gift.id);
  return taken
    ? `<span class="gift-status">${mine ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>Escolhido por você' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Já escolhido'}</span>`
    : `<button type="button" class="btn gift-button" data-gift="${esc(gift.id)}">Quero presentear</button>`;
}

function buildGrid() {
  const grid = $('#grid'), fx = state.model === 1 ? 'up' : state.model === 2 ? 'scale' : 'blur';
  grid.innerHTML = GIFTS.map((gift, index) => `<div class="gift-cell" data-id="${esc(gift.id)}" data-fx="${fx}">
      <article class="gift">
        <span class="gift-number" aria-hidden="true" data-n="${index + 1}">00</span>
        <div class="gift-art">${icon(gift.category)}</div>
        <p class="gift-category">${esc(gift.category)}</p>
        <h2 class="gift-name">${esc(gift.name)}</h2>
        <p class="gift-hint">Sugestão: ${esc(gift.hint)}</p>
        <div class="gift-foot">${cardFoot(gift)}</div>
        <span class="gift-stamp" aria-hidden="true"></span>
        <span class="gift-sheen" aria-hidden="true"></span>
      </article>
    </div>`).join('');
  grid.querySelectorAll('.gift-cell').forEach(cell => {
    cells.set(cell.dataset.id, cell);
    const article = cell.querySelector('.gift');
    tilt(article, { max: state.model === 3 ? 4 : 7, scale: 1.02 });
    syncCard(cell.dataset.id);
  });
  setColumnIndexes();
  observeCells();
}

function columns() { return Math.max(1, getComputedStyle($('#grid')).gridTemplateColumns.split(' ').length); }
function setColumnIndexes() {
  const cols = columns();
  [...cells.values()].filter(c => !c.hidden).forEach((cell, i) => cell.style.setProperty('--fx-i', i % cols));
}

// Revela cada card ao entrar na tela; no Minimal, o número conta de 00 até o número do item.
function observeCells() {
  const show = cell => {
    cell.classList.add('fx-in');
    const number = cell.querySelector('.gift-number');
    if (state.model === 3 && !number.dataset.done) {
      number.dataset.done = '1';
      const delay = Number(cell.style.getPropertyValue('--fx-i') || 0) * 90 + 200;
      setTimeout(() => animateNumber(number, 0, Number(number.dataset.n), { duration: 700, pad: 2 }), reducedMotion ? 0 : delay);
    } else number.textContent = String(number.dataset.n).padStart(2, '0');
  };
  if (reducedMotion || !('IntersectionObserver' in window)) { cells.forEach(show); return; }
  const io = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); } }), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
  cells.forEach(cell => io.observe(cell));
  state.showCell = show;
}

function matches(gift) {
  const term = normalize(state.search.trim());
  return (state.category === 'Todos' || gift.category === state.category) && (!term || normalize(`${gift.name} ${gift.category}`).includes(term));
}

// Reorganiza a grade com animação FLIP: cards que ficam deslizam, os que saem somem, os que entram surgem.
function applyFilter() {
  const grid = $('#grid'), list = [...cells.values()];
  const before = new Map(list.filter(c => !c.hidden).map(c => [c, c.getBoundingClientRect()]));
  let shown = 0;
  list.forEach(cell => { const visible = matches(GIFTS.find(g => g.id === cell.dataset.id)); cell.hidden = !visible; if (visible) shown++; });
  $('#empty').hidden = shown > 0;
  setColumnIndexes();
  if (reducedMotion) { list.forEach(c => !c.hidden && state.showCell?.(c)); return; }
  const gridRect = grid.getBoundingClientRect();
  before.forEach((rect, cell) => {
    if (!cell.hidden || rect.bottom < 0 || rect.top > innerHeight) return;
    const ghost = cell.cloneNode(true);
    ghost.className = 'gift-cell gift-ghost fx-in'; ghost.removeAttribute('data-fx'); ghost.hidden = false; ghost.inert = true; ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { left: `${rect.left - gridRect.left}px`, top: `${rect.top - gridRect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    grid.appendChild(ghost);
    ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.82) translateY(10px)', filter: 'blur(4px)' }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).onfinish = () => ghost.remove();
  });
  let entering = 0;
  list.forEach(cell => {
    if (cell.hidden) return;
    const now = cell.getBoundingClientRect(), old = before.get(cell);
    const onScreen = now.bottom > 0 && now.top < innerHeight;
    if (!onScreen && !old) return; // continua esperando a rolagem para aparecer
    if (!cell.classList.contains('fx-in')) { cell.style.transition = 'none'; state.showCell?.(cell); void cell.offsetWidth; cell.style.transition = ''; }
    if (!onScreen) return;
    if (old) {
      const dx = old.left - now.left, dy = old.top - now.top;
      if (dx || dy) cell.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 620, easing: EASE });
    } else {
      cell.animate([{ opacity: 0, transform: 'scale(.86) translateY(24px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 560, delay: 120 + entering++ * 45, easing: EASE, fill: 'backwards' });
    }
  });
}

function syncCard(id, animate = false) {
  const cell = cells.get(id); if (!cell) return;
  const gift = GIFTS.find(g => g.id === id), article = cell.querySelector('.gift');
  const taken = state.reserved.has(id), mine = state.mine.has(id);
  article.classList.toggle('is-taken', taken);
  article.classList.toggle('is-mine', mine);
  cell.querySelector('.gift-stamp').textContent = mine ? 'Seu presente ♡' : state.model === 3 ? 'Já escolhido' : 'Escolhido';
  cell.querySelector('.gift-foot').innerHTML = cardFoot(gift);
  if (animate && taken && !reducedMotion) {
    article.classList.remove('just-taken'); void article.offsetWidth; article.classList.add('just-taken');
    setTimeout(() => article.classList.remove('just-taken'), 1800);
  }
}

/* ---------- Progresso e contador fixo ---------- */
let shownTaken = 0;
function updateProgress() {
  const taken = GIFTS.filter(g => state.reserved.has(g.id)).length, pct = taken / GIFTS.length;
  $('#progress-bar').style.transform = `scaleX(${pct})`;
  $('#sticky-ring').style.strokeDashoffset = String(100 - pct * 100);
  animateNumber($('#taken-count'), shownTaken, taken, { duration: shownTaken ? 700 : 1600 });
  animateNumber($('#sticky-taken'), shownTaken, taken, { duration: 700 });
  if (shownTaken && taken > shownTaken && !reducedMotion) $('#taken-count').animate([{ transform: 'scale(1.35)', color: 'var(--accent)' }, { transform: 'none' }], { duration: 600, easing: EASE });
  shownTaken = taken;
}

function watchSticky() {
  const sticky = $('#sticky-count'), intro = $('#intro');
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => {
    const visible = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    sticky.classList.toggle('visible', visible);
    sticky.tabIndex = visible ? 0 : -1;
    sticky.setAttribute('aria-hidden', String(!visible));
    sticky.setAttribute('aria-label', `${shownTaken} de ${GIFTS.length} presentes escolhidos. Ir para os filtros`);
  }).observe(intro);
}

/* ---------- Modal de escolha ---------- */
function openDialog(giftId, source) {
  const gift = GIFTS.find(g => g.id === giftId);
  if (!gift || state.reserved.has(gift.id)) return;
  state.current = gift;
  const form = $('#gift-form'), dialog = $('#gift-dialog');
  form.innerHTML = `
    <button type="button" class="dialog-close" data-close aria-label="Fechar">×</button>
    <div class="dialog-art">${icon(gift.category)}</div>
    <p class="eyebrow">Presentear o casal</p>
    <h2 id="dialog-title" class="dialog-title">${esc(gift.name)}</h2>
    <p class="dialog-hint">Sugestão de valor: ${esc(gift.hint)}</p>
    <label class="field">Seu nome<input name="name" required maxlength="80" autocomplete="name" placeholder="Como o casal conhece você" /></label>
    <label class="field"><span>Recado para o casal <span class="optional">(opcional)</span></span><textarea name="message" maxlength="300" placeholder="Deixe uma mensagem carinhosa"></textarea></label>
    <p class="dialog-note">Ao confirmar, o presente fica reservado no seu nome e some das opções dos outros convidados.</p>
    <div class="dialog-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-shine" id="confirm-gift">Confirmar presente</button></div>`;
  dialog.showModal();
  if (!reducedMotion) {
    // O modal "nasce" a partir do card clicado.
    const to = dialog.getBoundingClientRect(), from = source?.getBoundingClientRect();
    if (from) dialog.animate([
      { transformOrigin: '0 0', transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: .3 },
      { transformOrigin: '0 0', transform: 'none', opacity: 1 },
    ], { duration: 560, easing: 'cubic-bezier(.2,.9,.25,1)' });
    [...form.children].forEach((child, i) => child.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 200 + i * 45, easing: EASE, fill: 'backwards' }));
    form.querySelector('.dialog-art').animate([{ transform: 'scale(.3) rotate(-25deg)' }, { transform: 'scale(1.12) rotate(6deg)', offset: .7 }, { transform: 'none' }], { duration: 700, delay: 220, easing: EASE, fill: 'backwards' });
  }
  setTimeout(() => form.querySelector('input[name="name"]')?.focus({ preventScroll: true }), 60);
}

function closeDialog() {
  const dialog = $('#gift-dialog');
  if (!dialog.open) return Promise.resolve();
  if (reducedMotion) { dialog.close(); return Promise.resolve(); }
  return new Promise(resolve => {
    dialog.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(.96)' }], { duration: 220, easing: 'ease-in' }).onfinish = () => { dialog.close(); resolve(); };
  });
}

$('#gift-dialog').addEventListener('click', event => {
  if (event.target.closest('[data-close]') || event.target === event.currentTarget) closeDialog();
});
$('#gift-dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });

/* ---------- Celebração ao presentear ---------- */
function popShape(model) {
  if (model === 1) return '<path d="M0 0c6-9 18-10 24-6-5 8-16 10-24 6z"/>';
  if (model === 2) return '<path d="M0 3C-5-4-11 1-6 6L0 11 6 6C11 1 5-4 0 3z"/>';
  return '<path d="M0-9 2-2 9 0 2 2 0 9-2 2-9 0-2-2z"/>';
}

function giftBox(model) {
  const pops = [[-70, -10, 0], [-38, 20, 140], [0, -18, 60], [36, 14, 220], [72, -6, 100], [-14, 30, 300], [20, -28, 380]]
    .map(([x, r, d]) => `<g transform="translate(100 112)"><g class="gb-pop" style="--x:${x}px;--r:${r}deg;--d:${d}ms">${popShape(model)}</g></g>`).join('');
  return `<svg class="giftbox" viewBox="0 0 200 220" aria-hidden="true">
    <defs><linearGradient id="gb-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8913f"/><stop offset=".35" stop-color="#f6e3a8"/><stop offset=".6" stop-color="#d4af63"/><stop offset="1" stop-color="#8f6d2c"/></linearGradient></defs>
    <g class="gb-pops">${pops}</g>
    <g class="gb-body"><rect class="gb-box" x="44" y="112" width="112" height="92" rx="6"/><rect class="gb-ribbon" x="92" y="112" width="16" height="92"/></g>
    <g class="gb-lid">
      <rect class="gb-box" x="36" y="88" width="128" height="28" rx="5"/><rect class="gb-ribbon" x="92" y="88" width="16" height="28"/>
      <path class="gb-tail gb-tail-l" d="M98 90c-8 10-14 18-22 22"/><path class="gb-tail gb-tail-r" d="M102 90c8 10 14 18 22 22"/>
      <path class="gb-loop gb-loop-l" d="M100 88c-10-26-44-34-46-14-1 12 24 16 46 14z"/><path class="gb-loop gb-loop-r" d="M100 88c10-26 44-34 46-14 1 12-24 16-46 14z"/>
      <circle class="gb-knot" cx="100" cy="88" r="7"/>
    </g>
  </svg>`;
}

function celebrate(gift, name) {
  const el = $('#celebrate'), first = name.split(' ')[0];
  el.innerHTML = `
    <div class="celebrate-inner">
      <div class="gb-stage"><span class="gb-rays" aria-hidden="true"></span><span class="gb-glow" aria-hidden="true"></span>${giftBox(state.model)}</div>
      <p class="eyebrow c-fade" style="--d:1.5s">Presente reservado</p>
      <h2 id="celebrate-title" class="celebrate-title gold-chars">Obrigado, ${esc(first)}!</h2>
      <p class="celebrate-text c-fade" style="--d:2.1s">O presente <strong>${esc(gift.name)}</strong> está reservado no seu nome. ${esc(state.site.couple)} vão adorar o carinho.</p>
      <button type="button" class="btn btn-shine c-fade" style="--d:2.3s" data-celebrate-close>Voltar para a lista</button>
    </div>`;
  el.hidden = false; $('#app').inert = true; document.documentElement.classList.add('no-scroll');
  splitText($('.celebrate-title'), { by: state.model === 1 ? 'char' : 'word', delay: 1650, stagger: state.model === 1 ? 35 : 160 }).play();
  requestAnimationFrame(() => el.classList.add('play'));
  setTimeout(() => { confetti($('.giftbox'), state.model, { amount: state.model === 3 ? 220 : 170 }); state.fx?.burst(innerWidth / 2, innerHeight * .4, 30); buzz([18, 40, 26]); }, reducedMotion ? 0 : 1300);
  el.querySelector('[data-celebrate-close]').focus({ preventScroll: true });
}

function closeCelebrate() {
  const el = $('#celebrate');
  if (el.hidden) return;
  const finish = () => {
    el.hidden = true; el.classList.remove('play'); el.innerHTML = '';
    $('#app').inert = false; document.documentElement.classList.remove('no-scroll');
    const gift = state.current, cell = gift && cells.get(gift.id);
    if (!cell) return;
    if (!cell.hidden) {
      cell.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => syncCard(gift.id, true), reducedMotion ? 0 : 450);
    }
    $('#search').focus({ preventScroll: true });
  };
  if (reducedMotion) return finish();
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in' }).onfinish = finish;
}
$('#celebrate').addEventListener('click', event => { if (event.target.closest('[data-celebrate-close]')) closeCelebrate(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#celebrate').hidden) closeCelebrate(); });

/* ---------- Reserva ---------- */
$('#gift-form').addEventListener('submit', async event => {
  event.preventDefault();
  const gift = state.current, form = event.currentTarget;
  if (!gift) return;
  const name = form.elements.name.value.trim(), message = form.elements.message.value.trim();
  if (!name) {
    form.elements.name.focus();
    if (!reducedMotion) form.elements.name.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 380 });
    return;
  }
  if (state.reserved.has(gift.id)) { await closeDialog(); toast('Alguém acabou de escolher este presente. Que tal escolher outro?'); return; }
  const button = $('#confirm-gift'); button.disabled = true; button.textContent = 'Reservando…';
  try {
    await reserveGift(state.slug, gift.id, { name, message });
    state.mine.add(gift.id); saveMine();
    state.reserved.add(gift.id); syncCard(gift.id); updateProgress();
    await closeDialog();
    celebrate(gift, name);
  } catch (error) {
    console.error('Falha ao reservar presente:', error);
    button.disabled = false; button.textContent = 'Confirmar presente';
    if (error?.code === 'permission-denied') { await closeDialog(); toast('Poxa, alguém acabou de escolher este presente. Que tal escolher outro?'); }
    else toast('Não foi possível reservar agora. Verifique sua conexão e tente de novo.');
  }
});

/* ---------- Início ---------- */
async function start() {
  const { slug, site, model, error } = await loadProductPage('lista');
  if (!site) { renderUnavailable(document.body, error); return; }
  Object.assign(state, { slug, site, model });
  state.mine = loadMine();
  state.fx = ambient(model, { density: model === 3 ? 1.1 : .9 });
  renderShell();
  watchReservas(slug, ids => {
    const changed = new Set([...ids, ...state.reserved].filter(id => ids.has(id) !== state.reserved.has(id)));
    state.reserved = ids;
    const live = state.initialized && performance.now() > state.liveSince;
    changed.forEach(id => syncCard(id, live));
    if (live) {
      const picked = [...changed].filter(id => ids.has(id) && !state.mine.has(id)).map(id => GIFTS.find(g => g.id === id)?.name).filter(Boolean);
      if (picked.length === 1) toast(`Alguém acabou de escolher: ${picked[0]} ♡`);
    }
    if (!state.initialized) { state.initialized = true; state.liveSince = performance.now() + 2500; setTimeout(updateProgress, reducedMotion ? 0 : 900); }
    else updateProgress();
  });
}

start();
