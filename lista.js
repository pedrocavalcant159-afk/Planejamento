import { loadProductPage, eventInfo, watchReservas, reserveGift, renderUnavailable, mapsUrl, esc } from './lib/site.js';
import { dateLong } from './lib/catalog.js';
import { GIFTS, GIFT_CATEGORIES } from './lib/gifts.js';
import { custom, customList } from './lib/content.js';
import { doodle, applyDoodlePattern, tornEdge, cuttingBoard, sprig, appButtons, sticker, roundPhoto, wavyPhoto, polaroid, coverPhoto, waveClipDefs, bill, seal, initialsOf, splitCouple, paletteHtml, pixHtml, bindPixCopy } from './lib/decor.js';
import { ambient, confetti, splitText, reveal, tilt, magnetic, scrollProgress, buzz, reducedMotion } from './lib/fx.js';

const $ = (s, root = document) => root.querySelector(s);
const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const formatTime = time => {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
};
const dateParts = iso => {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return { day: d.getDate(), month: d.toLocaleDateString('pt-BR', { month: 'long' }), monthShort: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), weekday: d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0], year: d.getFullYear() };
};

/* Desenhos dos presentes ----------------------------------------------------- */
// Traços extras no mesmo estilo de lib/decor.js (viewBox 64x64).
const EXTRA_ART = {
  frigideira: '<path d="M16 22c-2-3 2-5 0-8M26 22c-2-3 2-5 0-8"/><path d="M4 28h38v3c0 7-6 12-13 12H17C10 43 4 38 4 31z"/><path d="M42 31h14a3 3 0 0 1 0 6H44"/>',
  cama: '<path d="M8 52V14M56 52V34M8 44h48M8 36h48"/><path d="M13 36v-5a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4v5"/><path d="M36 36v-4a5 5 0 0 1 5-5h9a6 6 0 0 1 6 6"/>',
  toalha: '<rect x="10" y="42" width="44" height="12" rx="3"/><rect x="14" y="30" width="36" height="12" rx="3"/><rect x="18" y="18" width="28" height="12" rx="3"/><path d="M24 24h16M20 36h24M16 48h32"/>',
  cesto: '<path d="M10 26h44l-5 28a4 4 0 0 1-4 3H19a4 4 0 0 1-4-3z"/><path d="M21 26l6-14M43 26l-6-14"/><path d="M23 34v15M32 34v15M41 34v15"/>',
  copo: '<path d="M20 10h24l-4 44H24z"/><path d="M22 26h20"/><path d="M28 34v12"/>',
  liquidificador: '<path d="M22 6h20l-3 32H25z"/><path d="M42 12h6v14h-5"/><path d="M28 16h8"/><path d="M20 38h24l3 10H17z"/><path d="M17 48h30v8H17z"/><path d="M30 52h4"/>',
};
const art = (name, cls = '') => (EXTRA_ART[name] ? `<svg class="doodle ${cls}" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${EXTRA_ART[name]}</svg>` : doodle(name, cls));
const ART_GROUPS = {
  panelas: 'jogo-panelas assadeiras refratarios travessas forma-bolo', panela: 'panela-pressao cacarola-ferro escorredor air-fryer', frigideira: 'frigideira',
  chaleira: 'chaleira chaleira-eletrica', talheres: 'faqueiro facas-chef aparelho-jantar sousplat', rolo: 'tabuas', pote: 'utensilios-silicone potes-hermeticos ralador porta-temperos organizadores',
  taca: 'tacas abridor-saca', copo: 'jogo-copos jarra', colher: 'medidores', xicara: 'xicaras-cafe cafeteira', coracao: 'toalha-mesa manta-sofa',
  liquidificador: 'liquidificador processador mixer', batedor: 'batedeira', luva: 'sanduicheira', casa: 'ferro-passar aspirador varal lixeira-inox',
  cama: 'jogo-cama edredom travesseiros', toalha: 'toalhas-banho panos-prato tapete-banheiro', cesto: 'cesto-roupa kit-limpeza',
};
const GIFT_ART = Object.fromEntries(Object.entries(ART_GROUPS).flatMap(([name, ids]) => ids.split(' ').map(id => [id, name])));
const CATEGORY_ART = { 'Cozinha': 'panela', 'Utensílios': 'pote', 'Mesa posta': 'talheres', 'Eletroportáteis': 'batedor', 'Cama & banho': 'cama', 'Organização & limpeza': 'casa' };
const giftArt = (gift, cls = '') => art(GIFT_ART[gift.id] || CATEGORY_ART[gift.category] || 'presente', cls);

/* Rostos do modelo Oliva: véu e gravata-borboleta (como no convite). */
const veil = '<svg class="face-veil" viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M38 22c8-14 36-14 44 0"/><path d="M36 24C14 44 10 84 22 112M84 24c22 20 26 60 14 88"/><path d="M30 60c-4 18-2 36 4 50M90 60c4 18 2 36-4 50"/><path d="M46 14l4-8 6 6 4-9 4 9 6-6 4 8"/></svg>';
const bowTie = '<svg class="face-bow" viewBox="0 0 64 32" aria-hidden="true"><path d="M30 16 4 4v24zM34 16 60 4v24z" fill="currentColor"/><rect x="27" y="10" width="10" height="12" rx="3" fill="currentColor"/></svg>';

const state = { slug: '', site: null, model: 1, reserved: new Set(), mine: new Set(), category: 'Todos', search: '', current: null, initialized: false, liveSince: 0, fx: null };
const cells = new Map();

function loadMine() { try { return new Set(JSON.parse(localStorage.getItem(`lista-${state.slug}-minhas`)) || []); } catch { return new Set(); } }
function saveMine() { try { localStorage.setItem(`lista-${state.slug}-minhas`, JSON.stringify([...state.mine])); } catch {} }

let toastTimer;
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

function animateNumber(el, from, to, { duration = 1200, pad = 0 } = {}) {
  if (!el) return;
  const format = n => String(Math.round(n)).padStart(pad, '0');
  if (reducedMotion || from === to) { el.textContent = format(to); return; }
  const start = performance.now();
  const step = now => { const t = Math.min(1, Math.max(0, (now - start) / duration)), eased = 1 - Math.pow(1 - t, 3); el.textContent = format(from + (to - from) * eased); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* Partes da página ------------------------------------------------------------ */

function heroHtml(ctx) {
  const { model, photos, n1, n2, ev, t } = ctx;
  const names = n2 ? `${n1} e ${n2}` : n1;
  const parts = dateParts(ev.date), time = formatTime(ev.time);
  const place = [ev.venue, ev.address].filter(Boolean).join(', ');
  const hasFaces = Boolean(photos.ela || photos.ele);
  const faces = `${sticker(photos.ela, n1, 'face face-1')}${sticker(photos.ele, n2 || n1, 'face face-2')}`;

  if (model === 1) {
    return `<header class="hero">
      <div class="hero-band"><div class="hero-inner">
        ${doodle('pote', 'hd hd-a')}${doodle('panelas', 'hd hd-b')}${doodle('batedor', 'hd hd-c')}
        <p class="kicker">Lista de presentes do nosso</p>
        <h1 class="hero-title display" data-split="char">${esc(t('chaTitle'))}</h1>
        <p class="hero-names">${esc(names)}</p>
        <div class="hero-faces">${hasFaces ? faces : doodle('panela', 'hero-pot')}</div>
      </div>${tornEdge('hero-torn', 11)}</div>
      <div class="hero-when" data-fx="up">
        <p class="hero-date display">${esc(ev.date ? dateLong(ev.date) : 'Data a definir')}</p>
        ${time ? `<p class="hero-time">a partir das ${esc(time)}</p>` : ''}
      </div>
    </header>`;
  }
  if (model === 2) {
    return `<header class="hero doodle-bg">
      <div class="hero-faces">${hasFaces ? faces : `<span class="face-fallback">${doodle('presente')}</span>`}</div>
      <p class="kicker">lista de presentes</p>
      <h1 class="hero-title display">${esc(t('chaTitle'))}</h1>
      <p class="hero-names script" data-split="word">${esc(n2 ? `${n1} & ${n2}` : n1)}</p>
      <div class="arch">
        ${parts ? `<div class="cal"><span class="cal-side">${esc(parts.weekday)}</span><strong class="cal-day">${parts.day}</strong><span class="cal-side">${esc(parts.month)}</span></div>` : '<p class="cal-tbd">Data a definir</p>'}
        ${time ? `<p class="cal-time">às ${esc(time)}</p>` : ''}
      </div>
    </header>`;
  }
  if (model === 3) {
    return `<header class="hero">
      ${coverPhoto(photos.capa, `Foto de ${names}`, 'hero-cover') || `<div class="hero-sprigs">${sprig('sp-l')}${sprig('sp-r')}</div>`}
      <div class="hero-body">
        <p class="monogram display">${esc(initialsOf(ctx.couple))}</p>
        <h1 class="hero-names script" data-split="word">${esc(n1)}${n2 ? ` <span class="amp">&</span> ${esc(n2)}` : ''}</h1>
        <p class="hero-invite display">Lista de presentes do nosso ${esc(t('chaTitle').toLowerCase())}</p>
        ${parts ? `<div class="date-block"><div class="date-row"><span class="display">${esc(parts.weekday)}</span><strong class="display">${parts.day}</strong><span class="display">${esc(parts.month)}</span></div><span class="date-year display">${time ? `${parts.year} · às ${esc(time)}` : parts.year}</span></div>` : '<p class="date-tbd display">Data a definir</p>'}
      </div>
      ${sprig('hero-sprig hs-a')}${sprig('hero-sprig hs-b')}
    </header>`;
  }
  return `<header class="hero"><div class="hero-inner">
    ${doodle('pote', 'hd hd-a')}${doodle('panelas', 'hd hd-b')}
    <h1 class="title-stack"><span class="title-pre script">a lista do nosso</span><span class="title-big display">${esc(t('chaTitle'))}</span><span class="title-names script" data-split="word">${esc(names)}</span></h1>
    <div class="hero-faces">${hasFaces ? `<span class="face-wrap fw-1">${photos.ela ? veil : ''}${sticker(photos.ela, n1, 'face')}</span><span class="face-wrap fw-2">${sticker(photos.ele, n2 || n1, 'face')}${photos.ele ? bowTie : ''}</span>` : doodle('panela', 'hero-pot')}</div>
    ${parts ? cuttingBoard(`${parts.day} de ${parts.monthShort}`, time ? `às ${time}` : '') : '<p class="hero-address">Data a definir</p>'}
    ${place ? `<p class="hero-address">${esc(place)}</p>` : ''}
    <div class="utensil-row">${['batedor', 'xicara', 'rolo', 'colher', 'chaleira', 'talheres', 'luva'].map(n => doodle(n)).join('')}</div>
  </div></header>`;
}

function buttonsHtml(ctx) {
  const { ev, site, slug, model } = ctx;
  const items = [
    { icon: 'presente', label: 'Escolher presente', href: '#presentes' },
    ...(site.products?.convite ? [{ icon: 'agenda', label: 'Ver o convite', href: `convite.html?c=${encodeURIComponent(slug)}` }] : []),
    ...(ev.venue || ev.address ? [{ icon: 'local', label: 'Como chegar', href: mapsUrl(ev), external: true }] : []),
    ...(ctx.pixKey ? [{ icon: 'pix', label: 'Contribuir via Pix', href: '#pix' }] : []),
  ];
  const head = model === 3 ? '<p class="block-kicker display">Clique nos botões</p><p class="block-script script">para interagir</p>' : model === 2 ? '<p class="block-kicker">Acesse as informações abaixo</p>' : '';
  return `<section class="block block-buttons" data-fx="up"><div class="buttons-card">${head}${appButtons(items)}</div></section>`;
}

function stepsHtml(ctx) {
  const { model, photos, couple } = ctx;
  const palette = paletteHtml(ctx.palette, custom(ctx.site, 'paletteNote'));
  const steps = ['Escolha um presente na nossa lista', 'Toque nele e coloque o seu nome', 'Compre onde preferir', 'Leve no dia do chá ou mande entregar'];
  const photo = model === 1 ? roundPhoto(photos.capa, `Foto de ${couple}`, 'steps-photo')
    : model === 2 ? polaroid(photos.capa, '', 'steps-photo', -4)
      : model === 4 ? wavyPhoto(photos.capa, `Foto de ${couple}`, 'steps-photo') : '';
  return `<section class="block block-steps" id="como"><div class="wrap">
    ${photo ? `<div class="steps-media" data-fx="up">${photo}</div>` : doodle('pote', 'steps-art')}
    <h2 class="block-title display" data-fx="up">Como fazer parte?</h2>
    <p class="block-text" data-fx="up">${esc(custom(ctx.site, 'listaIntro'))}</p>
    <ol class="steps" data-fx-stagger="up">${steps.map((s, i) => `<li><span class="step-n">${String(i + 1).padStart(2, '0')}</span><span>${s}</span></li>`).join('')}</ol>
    <a class="btn btn-shine steps-btn" data-fx="up" href="#presentes">Ver a lista de presentes</a>
    ${palette ? `<div class="steps-palette" data-fx="up"><h3 class="palette-title display">Paleta de cores</h3>${palette}</div>` : ''}
  </div></section>`;
}

function giftsHtml(ctx) {
  const head = ctx.model === 3 ? '<p class="block-script script">com carinho</p>' : ctx.model === 1 ? `${doodle('presente', 'gifts-art')}` : '';
  return `<section class="block block-gifts" id="presentes" aria-labelledby="gifts-title">
    <div class="gifts-head" data-fx="up">
      ${head}
      <h2 class="block-title display" id="gifts-title">Escolha o seu presente</h2>
      <p class="block-text">Toque em <strong>Quero presentear</strong> e o presente fica reservado no seu nome.</p>
    </div>
    <div class="wrap-wide">
      <div class="progress" id="progress-box" aria-live="polite" data-fx="up">
        <div class="progress-label"><strong id="taken-count">0</strong> de ${GIFTS.length} presentes já escolhidos</div>
        <div class="progress-track"><span id="progress-bar"></span></div>
      </div>
      <div class="toolbar" role="search" aria-label="Filtros da lista" id="toolbar">
        <div class="chips" role="group" aria-label="Categorias" id="chips"></div>
        <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr-only">Buscar presente</span><input id="search" type="search" placeholder="Buscar presente" autocomplete="off" /></label>
      </div>
      <div class="grid" id="grid" aria-label="Presentes"></div>
      <p class="empty" id="empty" hidden>Nenhum presente encontrado com essa busca.</p>
    </div>
  </section>`;
}

function pixSection(ctx) {
  const html = pixHtml({ key: ctx.pixKey, holder: custom(ctx.site, 'pixHolder'), title: custom(ctx.site, 'pixTitle'), gifts: customList(ctx.site, 'pixGifts') });
  if (!html) return '';
  const bills = ctx.model === 1 ? [8, 22, 74, 88].map((x, i) => bill('', `left:${x}%;top:${(i % 2) * 30 + 6}px;animation-delay:${-i * 1.7}s`)).join('') : '';
  return `<section class="block block-pix" id="pix" data-fx="up">${bills}${html}</section>`;
}

function footerHtml(ctx) {
  const { model, site, slug, couple } = ctx;
  const artHtml = model === 3 ? `<div class="footer-seal">${sprig('fs-l')}${seal(initialsOf(couple), 'footer-wax')}${sprig('fs-r')}</div>` : doodle(model === 2 ? 'panela' : 'pote', 'footer-art');
  return `<footer class="block block-footer" data-fx="up">
    <p class="closing display">${esc(custom(site, 'closing'))}</p>
    ${artHtml}
    <p class="footer-from"><span class="script">com carinho,</span> <strong>${esc(couple)}</strong></p>
    ${site.products?.convite ? `<a class="link-button" href="convite.html?c=${encodeURIComponent(slug)}">Ver o convite do chá</a>` : ''}
  </footer>`;
}

function renderShell(ctx) {
  const app = $('#app');
  app.className = 'lista'; app.removeAttribute('aria-busy');
  document.title = `Lista de presentes · ${ctx.couple}`;
  app.innerHTML = `${waveClipDefs()}
    ${heroHtml(ctx)}
    <main class="content">${buttonsHtml(ctx)}${stepsHtml(ctx)}${giftsHtml(ctx)}${pixSection(ctx)}</main>
    ${footerHtml(ctx)}
    <button type="button" class="sticky-count" id="sticky-count" tabindex="-1" aria-hidden="true">
      <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-bg" cx="18" cy="18" r="15"/><circle class="ring" id="sticky-ring" cx="18" cy="18" r="15" pathLength="100"/></svg>
      <span><strong id="sticky-taken">0</strong>/${GIFTS.length}<small>escolhidos</small></span>
    </button>`;

  // Nome do topo entra letra a letra (palavra a palavra nas fontes cursivas).
  const split = $('[data-split]');
  if (split) { const by = split.dataset.split; splitText(split, { by, delay: 250, stagger: by === 'char' ? 45 : 180 }).play(); }
  requestAnimationFrame(() => app.classList.add('is-ready'));

  bindPixCopy(app, toast);
  renderChips();
  buildGrid();
  reveal(app);
  scrollProgress();
  app.querySelectorAll('.steps-btn, .block-pix .btn').forEach(btn => magnetic(btn, { strength: .2 }));
  app.querySelectorAll('.pix-gift').forEach(el => tilt(el, { max: 10, scale: 1.04 }));

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

/* Filtros com indicador deslizante ---------------------------------------------- */
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

/* Grade de presentes -------------------------------------------------------------- */
function cardFoot(gift) {
  const taken = state.reserved.has(gift.id), mine = state.mine.has(gift.id);
  return taken
    ? `<span class="gift-status">${mine ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>Escolhido por você' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Já escolhido'}</span>`
    : `<button type="button" class="btn gift-button" data-gift="${esc(gift.id)}" aria-label="Quero presentear: ${esc(gift.name)}">Quero presentear</button>`;
}

function buildGrid() {
  const grid = $('#grid'), fx = state.model === 2 ? 'scale' : state.model === 3 ? 'blur' : 'up';
  grid.innerHTML = GIFTS.map((gift, index) => `<div class="gift-cell" data-id="${esc(gift.id)}" data-fx="${fx}">
      <article class="gift">
        <span class="gift-number" aria-hidden="true">Nº ${String(index + 1).padStart(2, '0')}</span>
        <div class="gift-art">${giftArt(gift)}</div>
        <p class="gift-category">${esc(gift.category)}</p>
        <h3 class="gift-name">${esc(gift.name)}</h3>
        <p class="gift-hint"><span class="sr-only">Sugestão de valor: </span>${esc(gift.hint)}</p>
        <div class="gift-foot">${cardFoot(gift)}</div>
        <span class="gift-stamp" aria-hidden="true"></span>
      </article>
    </div>`).join('');
  grid.querySelectorAll('.gift-cell').forEach(cell => {
    cells.set(cell.dataset.id, cell);
    tilt(cell.querySelector('.gift'), { max: state.model === 3 ? 4 : 7, scale: 1.02 });
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

// Revela cada card ao entrar na tela.
function observeCells() {
  const show = cell => cell.classList.add('fx-in');
  state.showCell = show;
  if (reducedMotion || !('IntersectionObserver' in window)) { cells.forEach(show); return; }
  const io = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); } }), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
  cells.forEach(cell => io.observe(cell));
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
  cell.querySelector('.gift-stamp').textContent = mine ? 'Seu presente ♡' : 'Escolhido';
  cell.querySelector('.gift-foot').innerHTML = cardFoot(gift);
  if (animate && taken && !reducedMotion) {
    article.classList.remove('just-taken'); void article.offsetWidth; article.classList.add('just-taken');
    setTimeout(() => article.classList.remove('just-taken'), 1800);
  }
}

/* Progresso e contador fixo ------------------------------------------------------- */
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
  const sticky = $('#sticky-count'), box = $('#progress-box');
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => {
    const visible = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    sticky.classList.toggle('visible', visible);
    sticky.tabIndex = visible ? 0 : -1;
    sticky.setAttribute('aria-hidden', String(!visible));
    sticky.setAttribute('aria-label', `${shownTaken} de ${GIFTS.length} presentes escolhidos. Ir para os filtros`);
  }).observe(box);
}

/* Modal de escolha ---------------------------------------------------------------- */
function openDialog(giftId, source) {
  const gift = GIFTS.find(g => g.id === giftId);
  if (!gift || state.reserved.has(gift.id)) return;
  state.current = gift;
  const form = $('#gift-form'), dialog = $('#gift-dialog');
  form.innerHTML = `
    <button type="button" class="dialog-close" data-close aria-label="Fechar">×</button>
    <div class="dialog-art">${giftArt(gift)}</div>
    <p class="dialog-kicker">Presentear o casal</p>
    <h2 id="dialog-title" class="dialog-title display">${esc(gift.name)}</h2>
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

/* Celebração ao presentear --------------------------------------------------------- */
function popShape(model) {
  if (model === 1) return '<path d="M0 0c6-9 18-10 24-6-5 8-16 10-24 6z"/>';
  if (model === 4) return '<path d="M0 3C-5-4-11 1-6 6L0 11 6 6C11 1 5-4 0 3z"/>';
  return '<path d="M0-10C6-5 6 5 0 10-6 5-6-5 0-10z"/>';
}

function giftBox(model) {
  const pops = [[-70, -10, 0], [-38, 20, 140], [0, -18, 60], [36, 14, 220], [72, -6, 100], [-14, 30, 300], [20, -28, 380]]
    .map(([x, r, d]) => `<g transform="translate(100 112)"><g class="gb-pop" style="--x:${x}px;--r:${r}deg;--d:${d}ms">${popShape(model)}</g></g>`).join('');
  return `<svg class="giftbox" viewBox="0 0 200 220" aria-hidden="true">
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
      <p class="dialog-kicker c-fade" style="--d:1.5s">Presente reservado</p>
      <h2 id="celebrate-title" class="celebrate-title display">Obrigado, ${esc(first)}!</h2>
      <p class="celebrate-text c-fade" style="--d:2.1s">O presente <strong>${esc(gift.name)}</strong> está reservado no seu nome. ${esc(state.site.couple)} vão adorar o carinho.</p>
      <button type="button" class="btn btn-shine c-fade" style="--d:2.3s" data-celebrate-close>Voltar para a lista</button>
    </div>`;
  el.hidden = false; $('#app').inert = true; document.documentElement.classList.add('no-scroll');
  splitText($('.celebrate-title'), { by: state.model === 1 ? 'char' : 'word', delay: 1650, stagger: state.model === 1 ? 35 : 160 }).play();
  requestAnimationFrame(() => el.classList.add('play'));
  setTimeout(() => { confetti($('.giftbox'), state.model, { amount: 170 }); state.fx?.burst(innerWidth / 2, innerHeight * .4, 30); buzz([18, 40, 26]); }, reducedMotion ? 0 : 1300);
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

/* Reserva ---------------------------------------------------------------------------- */
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

/* Início ------------------------------------------------------------------------------ */
const DOODLE_INK = { 1: '#8a5530', 2: '#4b5a3a', 3: '#4f5b3e', 4: '#66754a' };

async function start() {
  const { slug, site, model, photos, error } = await loadProductPage('lista');
  const app = $('#app');
  if (!site) { app.classList.remove('loading'); app.removeAttribute('aria-busy'); renderUnavailable(app, error); return; }
  Object.assign(state, { slug, site, model });
  state.mine = loadMine();
  const couple = site.couple || 'Os noivos';
  const [n1, n2] = splitCouple(couple);
  const ctx = {
    site, slug, model, photos, couple, n1, n2,
    ev: eventInfo(site, 'lista'),
    t: key => custom(site, key),
    palette: customList(site, 'palette'),
    pixKey: custom(site, 'pixKey'),
  };
  applyDoodlePattern(DOODLE_INK[model], model === 2 ? .09 : .1);
  state.fx = ambient(model, { density: .5 });
  renderShell(ctx);
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

start().catch(error => {
  console.error(error);
  const app = $('#app'); app.classList.remove('loading'); app.removeAttribute('aria-busy');
  renderUnavailable(app, error);
});
