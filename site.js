import { loadProductPage, eventInfo, submitRsvp, mapsUrl, mapsEmbedUrl, calendarUrl, countdownParts, renderUnavailable, esc } from './lib/site.js';
import { dateLong } from './lib/catalog.js';
import { reducedMotion, finePointer, ambient, confetti, splitText, reveal, drawSvg, tilt, magnetic, parallax, tick, countUp, scrollProgress, buzz } from './lib/fx.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const formatTime = time => (time ? time.replace(':', 'h').replace(/h00$/, 'h') : '');
const numericDate = date => (date ? date.split('-').reverse().join(' . ') : 'Em breve');
const themeColors = { 1: '#f4f1e8', 2: '#fbf3f1', 3: '#0d0c0a' };
// Tipo de revelação ao rolar em cada modelo: Jardim suave, Rosé com balanço, Gala com cortes marcantes.
const FX = { 1: { head: 'blur', block: 'up', card: 'up', count: 'up', sides: ['left', 'right'] }, 2: { head: 'rise', block: 'scale', card: 'rise', count: 'up', sides: ['left', 'right'] }, 3: { head: 'clip', block: 'scale', card: 'up', count: 'clip', sides: ['left', 'right'] } };
let particles = { stop() {}, burst() {} };

const icons = {
  dress: '<path d="M12 6.5a2 2 0 1 1 2-2c0 1.1-2 1.4-2 3L3.6 14.3A1.6 1.6 0 0 0 4.6 17h14.8a1.6 1.6 0 0 0 1-2.7L12 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 9v12M12 9C10 5 6 5 6.5 7.5 7 9 12 9 12 9zm0 0c2-4 6-4 5.5-1.5C17 9 12 9 12 9z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" data-fx-draw>${icons[name]}</svg>`;

// Ornamentos em SVG. Cada folha/pétala fica dentro de um <g transform> para poder ser animada sem perder a posição.
const LEAF = 'M0 0C5-7 15-8 22 0C15 8 5 7 0 0Z';
function branch(cls = '', draw = false) {
  let leaves = '';
  const count = 9;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count, x = 14 + t * 232, y = 31 - 9 * Math.sin(Math.PI * t);
    const up = i % 2 === 0, size = 0.6 + 0.5 * Math.sin(Math.PI * t);
    leaves += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(up ? -40 - t * 18 : 34 + t * 14).toFixed(0)}) scale(${size.toFixed(2)})"><path class="leaf" d="${LEAF}"/></g>`;
  }
  return `<svg class="branch ${cls}" viewBox="0 0 260 60" aria-hidden="true"${draw ? ' data-fx-draw' : ''}><path class="stem" d="M6 33C70 18 170 18 254 30"/>${leaves}<circle class="berry" cx="254" cy="30" r="2.4"/><circle class="berry" cx="6" cy="33" r="2.4"/></svg>`;
}
function flower(cx, cy, r, rotation = 0) {
  let petals = '';
  for (let i = 0; i < 5; i++) petals += `<g transform="rotate(${rotation + i * 72} ${cx} ${cy})"><ellipse class="petal" cx="${cx}" cy="${cy - r * 0.5}" rx="${r * 0.42}" ry="${r * 0.56}"/></g>`;
  return `${petals}<circle class="flower-center" cx="${cx}" cy="${cy}" r="${r * 0.22}"/>`;
}
const flowerLeaf = (x, y, a, d = 'M0 0C8-10 26-11 36 0C26 11 8 10 0 0Z') => `<g transform="translate(${x} ${y}) rotate(${a})"><path class="flower-leaf" d="${d}"/></g>`;
function floral(cls = '') {
  const leaves = [[70, 120, 200], [120, 72, -70], [148, 118, 22], [62, 62, 228], [112, 150, 118], [40, 104, 170]].map(([x, y, a]) => flowerLeaf(x, y, a)).join('');
  return `<svg class="floral ${cls}" viewBox="0 0 200 200" aria-hidden="true">${leaves}${flower(100, 100, 36, 8)}${flower(150, 62, 22, 30)}${flower(58, 146, 20, -12)}<circle class="bud" cx="40" cy="78" r="6"/><circle class="bud" cx="162" cy="142" r="5"/></svg>`;
}
const smallLeaf = 'M0 0C4-5 13-5 18 0C13 5 4 5 0 0Z';
const flowerRow = (cls = '', draw = false) => `<svg class="flower-row ${cls}" viewBox="0 0 120 30" aria-hidden="true"${draw ? ' data-fx-draw' : ''}>${flowerLeaf(4, 15, 0, smallLeaf)}${flowerLeaf(116, 15, 180, smallLeaf)}${flower(34, 15, 9, 10)}${flower(60, 15, 12, 0)}${flower(86, 15, 9, -10)}</svg>`;

// Gala: ornamentos art déco (leque, divisor com losango, moldura escalonada, cantos geométricos).
function decoFan(cls = '') {
  let rays = '';
  for (let a = 180; a <= 360; a += 15) {
    const r = a * Math.PI / 180;
    rays += `<path d="M${(100 + 34 * Math.cos(r)).toFixed(1)} ${(104 + 34 * Math.sin(r)).toFixed(1)}L${(100 + 96 * Math.cos(r)).toFixed(1)} ${(104 + 96 * Math.sin(r)).toFixed(1)}"/>`;
  }
  return `<svg class="deco deco-fan ${cls}" viewBox="0 0 200 108" aria-hidden="true"><path d="M4 104A96 96 0 0 1 196 104"/><path d="M34 104A66 66 0 0 1 166 104"/><path d="M66 104A34 34 0 0 1 134 104"/>${rays}<path d="M0 104H200"/></svg>`;
}
const decoDivider = (cls = '', draw = false) => `<svg class="deco deco-divider ${cls}" viewBox="0 0 180 24" aria-hidden="true"${draw ? ' data-fx-draw' : ''}><path d="M0 12H66M114 12H180"/><path d="M90 2L100 12L90 22L80 12Z"/><path d="M90 7L95 12L90 17L85 12Z" class="fill"/><path d="M70 8L74 12L70 16M110 8L106 12L110 16"/></svg>`;
const decoFrame = () => '<svg class="deco deco-frame" viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true"><path d="M48 2H352V18H368V34H384V50H398V470H384V486H368V502H352V518H48V502H32V486H16V470H2V50H16V34H32V18H48Z"/><path d="M60 16H340V30H354V44H368V58H384V462H368V476H354V490H340V504H60V490H46V476H32V462H16V58H32V44H46V30H60Z"/><path d="M200 2V16M200 504V518M2 260H16M384 260H398"/></svg>';
const decoCorner = cls => `<svg class="deco deco-corner ${cls}" viewBox="0 0 120 120" aria-hidden="true"><path d="M2 118V30H30V2H118"/><path d="M14 118V42H42V14H118"/><path d="M26 118V54H54V26H118"/><path d="M60 60L72 72"/></svg>`;
const divider = model => (model === 1 ? branch('divider', true) : model === 2 ? flowerRow('divider', true) : decoDivider('divider', true));

// Monograma da abertura: guirlanda (Jardim), aro com flores (Rosé) ou losango art déco dourado (Gala).
function monogramSvg(model) {
  if (model === 1) {
    const R = 78, pt = deg => [100 + R * Math.cos(deg * Math.PI / 180), 100 + R * Math.sin(deg * Math.PI / 180)];
    let leaves = '';
    for (let k = 0; k < 10; k++) {
      [[100 + k * 16, 1], [80 - k * 16, -1]].forEach(([deg, dir], side) => {
        const [x, y] = pt(deg), angle = deg + 90 * dir + (k % 2 ? 32 : -32) * (side ? -1 : 1);
        leaves += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)}) scale(.62)"><path class="leaf" d="${LEAF}"/></g>`;
      });
    }
    const [lx1, ly1] = pt(100), [lx2, ly2] = pt(260), [rx1, ry1] = pt(80), [rx2, ry2] = pt(-80);
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><path class="ring" d="M${lx1.toFixed(1)} ${ly1.toFixed(1)}A${R} ${R} 0 0 1 ${lx2.toFixed(1)} ${ly2.toFixed(1)}"/><path class="ring" d="M${rx1.toFixed(1)} ${ry1.toFixed(1)}A${R} ${R} 0 0 0 ${rx2.toFixed(1)} ${ry2.toFixed(1)}"/>${leaves}<circle class="berry" cx="100" cy="21" r="3"/><circle class="berry" cx="100" cy="179" r="3"/></svg>`;
  }
  if (model === 2) {
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><circle class="ring" cx="100" cy="100" r="80"/><circle class="ring thin" cx="100" cy="100" r="72"/>${flowerLeaf(70, 22, 180, smallLeaf)}${flowerLeaf(130, 22, 0, smallLeaf)}${flower(100, 21, 16, 8)}${flowerLeaf(72, 178, 180, smallLeaf)}${flowerLeaf(128, 178, 0, smallLeaf)}${flower(100, 179, 13, -10)}</svg>`;
  }
  let rays = '';
  for (let a = 200; a <= 340; a += 20) { const r = a * Math.PI / 180; rays += `<path class="ring thin" d="M${(100 + 70 * Math.cos(r)).toFixed(1)} ${(100 + 70 * Math.sin(r)).toFixed(1)}L${(100 + 98 * Math.cos(r)).toFixed(1)} ${(100 + 98 * Math.sin(r)).toFixed(1)}"/>`; }
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><path class="ring" d="M100 6L194 100L100 194L6 100Z"/><path class="ring thin" d="M100 20L180 100L100 180L20 100Z"/><path class="ring" d="M100 34L166 100L100 166L34 100Z"/>${rays}<path class="ring thin" d="M58 140H142M70 150H130"/><path class="gem" d="M100 186L106 192L100 198L94 192Z"/></svg>`;
}

function initialsPair(couple) {
  const parts = couple.split('&').map(part => part.trim()).filter(Boolean);
  return parts.length === 2 ? [parts[0][0], parts[1][0]] : [couple.trim()[0] || '♡', ''];
}
const initials = couple => { const [a, b] = initialsPair(couple); return b ? `${esc(a)} &amp; ${esc(b)}` : esc(couple); };

function namesHtml(couple, model) {
  const parts = couple.split('&').map(part => part.trim()).filter(Boolean);
  if (model === 3) {
    const lines = parts.length === 2 ? [parts[0], '&', parts[1]] : [couple];
    return lines.map((line, i) => `<span class="name-line mask-line${line === '&' ? ' amp' : ''}"><span class="mask-inner gold-text" style="--d:${(0.25 + i * 0.22).toFixed(2)}s">${line === '&' ? '&amp;' : esc(line)}</span></span>`).join('');
  }
  if (parts.length !== 2) return `<span class="name-line">${esc(couple)}</span>`;
  return `<span class="name-line">${esc(parts[0])}</span><span class="amp">&amp;</span><span class="name-line">${esc(parts[1])}</span>`;
}

const anim = (delay, html, cls = '') => `<div class="h-anim ${cls}" style="--d:${delay}s">${html}</div>`;
const scrollCue = '<a class="scroll-cue h-anim" style="--d:1.6s" href="#contagem" aria-label="Rolar para a contagem regressiva"><span class="cue-line" aria-hidden="true"></span><span>Role</span></a>';
// Céu estrelado do Gala: posições fixas por índice para o desenho ser igual a cada visita.
const stars = () => `<div class="stars" aria-hidden="true">${Array.from({ length: 70 }, (_, i) => { const x = (i * 37.7) % 100, y = (i * 61.3 + (i % 7) * 9) % 100, s = 1 + (i % 4) * 0.6; return `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--s:${s.toFixed(1)}px;--t:${(2.2 + (i % 5) * 0.7).toFixed(1)}s;--w:${(-(i % 9) * 0.6).toFixed(1)}s"></i>`; }).join('')}</div>`;

function heroHtml(site, event, model) {
  const longDate = event.date ? capitalize(dateLong(event.date, true)) : 'Data a definir';
  const place = [event.time ? `às ${formatTime(event.time)}` : '', event.venue].filter(Boolean).map(esc).join(' · ');
  const names = namesHtml(site.couple, model);
  const cta = delay => anim(delay, '<a class="btn btn-shine" href="#presenca">Confirmar presença</a>', 'hero-cta');
  if (model === 2) {
    return `<section class="hero hero-2" id="inicio"><div class="bokeh" data-speed="0.25" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
      <div class="hero-frame"><div class="frame-shine" aria-hidden="true"><span></span></div>
        <div class="px px-floral-tl" data-speed="-0.14">${floral('frame-floral frame-floral-tl')}</div><div class="px px-floral-br" data-speed="0.12">${floral('frame-floral frame-floral-br')}</div>
        ${anim(0.1, '<p class="kicker">Vamos nos casar</p>')}<h1 class="hero-names script">${names}</h1>${anim(1.5, `<p class="hero-date">${esc(longDate)}</p>${place ? `<p class="hero-place">${place}</p>` : ''}`)}${cta(1.75)}
      </div>${scrollCue}</section>`;
  }
  if (model === 3) {
    return `<section class="hero hero-3" id="inicio">${stars()}<div class="glow" aria-hidden="true"></div>
      <div class="px px-fan-tl" data-speed="-0.2">${decoFan('fan-tl')}</div><div class="px px-fan-br" data-speed="0.16">${decoFan('fan-br')}</div>
      <div class="px px-corner-tl" data-speed="-0.08">${decoCorner('corner-tl')}</div><div class="px px-corner-br" data-speed="0.08">${decoCorner('corner-br')}</div>
      <div class="hero-content">${decoFrame()}
        ${anim(0.1, `<p class="kicker gala-kicker">${decoDivider('kicker-deco')}<span>Vamos nos casar</span>${decoDivider('kicker-deco')}</p>`)}
        <h1 class="hero-names">${names}</h1>
        ${anim(1.35, `<p class="hero-date">${esc(longDate)}</p>${place ? `<p class="hero-place">${place}</p>` : ''}`)}${cta(1.6)}
      </div>${scrollCue}</section>`;
  }
  return `<section class="hero hero-1" id="inicio"><div class="halo" aria-hidden="true"></div>
    <div class="px px-tl" data-speed="-0.22">${branch('corner corner-tl')}</div><div class="px px-br" data-speed="0.18">${branch('corner corner-br')}</div><div class="px px-mid" data-speed="0.4" aria-hidden="true">${branch('corner corner-mid')}</div>
    <div class="hero-content">${anim(0.1, '<p class="kicker">Vamos nos casar</p>')}${branch('hero-branch')}<h1 class="hero-names script">${names}</h1>${branch('hero-branch flip')}${anim(1.5, `<p class="hero-date">${esc(longDate)}</p>${place ? `<p class="hero-place">${place}</p>` : ''}`)}${cta(1.75)}</div>${scrollCue}</section>`;
}

const sectionHead = (kicker, title, model) => `<div class="section-head" data-fx="${FX[model].head}"><p class="kicker">${kicker}</p><h2 class="section-title display${model === 3 ? ' gold-text' : ''}">${title}</h2>${divider(model)}</div>`;
// Gala: filete dourado que se desenha a partir do centro no topo de cada seção.
const sectionOpen = model => `<div class="wrap section-grid">${model === 3 ? '<span class="rule" data-fx="line" aria-hidden="true"></span>' : ''}`;

function countdownHtml(event) {
  const parts = countdownParts(event.date, event.time);
  if (!parts) return `<p class="countdown-done display">${event.date ? 'O grande dia chegou ♡' : 'Data em breve'}</p>`;
  const units = [['days', parts.days, 'dias'], ['hours', parts.hours, 'horas'], ['minutes', parts.minutes, 'minutos'], ['seconds', parts.seconds, 'segundos']];
  return units.map(([key, value, label]) => `<div class="count-unit"><strong data-unit="${key}">${key === 'days' ? value : String(value).padStart(2, '0')}</strong><span>${label}</span></div>`).join('');
}

const chapters = [
  ['O encontro', 'Toda história bonita começa com um encontro. A nossa ganhou forma aos poucos, em conversas que pareciam não ter fim, em planos feitos a dois e em pequenos gestos que foram construindo o nosso lar.'],
  ['O caminho', 'Entre risadas, desafios e muitos dias comuns que se tornaram especiais, descobrimos que o melhor caminho é aquele que percorremos juntos.'],
  ['O sim', 'Agora queremos celebrar esse amor ao lado das pessoas que fizeram parte de tudo isso. A sua presença vai deixar esse dia ainda mais completo.'],
];

function render({ slug, site, model }) {
  const event = eventInfo(site, 'site');
  const hasGifts = Boolean(site.products?.lista);
  const giftsUrl = `lista.html?c=${encodeURIComponent(slug)}`;
  const timeLabel = formatTime(event.time);
  const embed = mapsEmbedUrl(eventInfo(site, 'site'));
  const fx = FX[model];
  const gold = model === 3 ? ' gold-text' : '';
  const links = [['#historia', 'Nossa história'], ['#cerimonia', 'Cerimônia'], ['#informacoes', 'Informações'], ['#presenca', 'Confirmar presença'], ...(hasGifts ? [['#presentes', 'Presentes']] : [])];

  document.title = `${site.couple} · Nosso casamento`;
  $('meta[name="theme-color"]').content = themeColors[model];

  const app = $('#app');
  app.classList.remove('loading');
  app.removeAttribute('aria-busy');
  app.innerHTML = `
  <header class="nav" id="nav"><div class="wrap nav-inner"><a class="nav-brand${gold}" href="#inicio" aria-label="${esc(site.couple)}, início">${initials(site.couple)}</a><button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Abrir menu"><span></span><span></span><span></span></button><ul class="nav-links" id="nav-links">${links.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul></div></header>
  <main>
    ${heroHtml(site, event, model)}
    <section class="countdown-band" id="contagem" aria-label="Contagem regressiva"><div class="wrap"><p class="kicker" data-fx="up">Contagem regressiva</p><div class="countdown" id="countdown" data-fx-stagger="${fx.count}">${countdownHtml(event)}</div></div></section>
    <section class="section" id="historia">${sectionOpen(model)}${sectionHead('Nossa história', 'Dois caminhos, um só destino', model)}<div class="story"><div class="timeline" id="timeline"><div class="tl-track" aria-hidden="true"><span class="tl-progress"></span></div>
      ${chapters.map(([label, text], i) => `<article class="tl-item" data-fx="${fx.sides[i % 2]}"><span class="tl-dot" aria-hidden="true"></span><p class="tl-label">Capítulo ${String(i + 1).padStart(2, '0')} · ${label}</p><p>${text}</p></article>`).join('')}
      </div><p class="story-quote${gold}" id="story-quote">E foi assim que dois caminhos viraram um só.</p></div></div></section>
    <section class="section section-alt" id="cerimonia">${sectionOpen(model)}${sectionHead('O grande dia', 'Cerimônia &amp; recepção', model)}<div class="event-wrap" data-fx="${fx.block}"><div class="event-card"><dl class="details" data-fx-stagger="up"><div><dt>Data</dt><dd>${esc(event.date ? capitalize(dateLong(event.date, true)) : 'A definir')}</dd></div><div><dt>Horário</dt><dd>${esc(timeLabel || 'A definir')}</dd></div><div><dt>Local</dt><dd>${esc(event.venue || 'A definir')}${event.address ? `<small>${esc(event.address)}</small>` : ''}</dd></div></dl>
      ${embed ? `<div class="map-frame"><iframe src="${esc(embed)}" title="Mapa do local" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}
      <div class="event-actions">${event.venue || event.address ? `<a class="btn btn-shine" href="${mapsUrl(event)}" target="_blank" rel="noopener">Como chegar</a>` : ''}${event.date ? `<a class="btn btn-ghost" href="${calendarUrl({ title: `Casamento de ${site.couple}`, ...event })}" target="_blank" rel="noopener">Salvar na agenda</a>` : ''}</div></div></div></div></section>
    <section class="section" id="informacoes">${sectionOpen(model)}${sectionHead('Para os convidados', 'Informações importantes', model)}<div class="info-grid" data-fx-stagger="${fx.card}">
      <div class="info-cell"><article class="info-card"><span class="info-icon">${icon('dress')}</span><h3 class="display">Traje</h3><p>Esporte fino. Sugerimos tons claros e roupas confortáveis, com sapatos que aguentem a pista de dança.</p></article></div>
      <div class="info-cell"><article class="info-card"><span class="info-icon">${icon('clock')}</span><h3 class="display">Chegada</h3><p>Chegue com cerca de 30 minutos de antecedência para se acomodar com calma.${timeLabel ? ` A cerimônia começa às ${esc(timeLabel)}.` : ''}</p></article></div>
      <div class="info-cell"><article class="info-card"><span class="info-icon">${icon('heart')}</span><h3 class="display">Crianças</h3><p>Os pequenos moram no nosso coração. Para organizar os lugares, confirme com os noivos se as crianças estão incluídas no seu convite.</p></article></div>
      <div class="info-cell"><article class="info-card"><span class="info-icon">${icon('camera')}</span><h3 class="display">Fotos</h3><p>Durante a cerimônia, deixe o celular guardado e viva o momento com a gente. Na festa, fotografe à vontade!</p></article></div>
    </div></div></section>
    <section class="section section-alt" id="presenca">${sectionOpen(model)}${sectionHead('RSVP', 'Confirme sua presença', model)}<div class="rsvp-wrap" id="rsvp-wrap" data-fx="${fx.block}"></div></div></section>
    ${hasGifts ? `<section class="gifts" id="presentes"><div class="wrap" data-fx-stagger="up"><span class="gifts-icon-wrap"><span class="gifts-icon fx-float">${icon('gift')}</span></span><p class="kicker">Lista de presentes</p><h2 class="section-title display${gold}">Com carinho</h2><p class="gifts-text">A sua presença é o nosso maior presente. Se quiser nos presentear, preparamos uma lista com muito carinho.</p><div><a class="btn btn-shine" href="${giftsUrl}">Ver lista de presentes</a></div></div></section>` : ''}
  </main>
  <footer class="footer"><div class="wrap" data-fx="up">${model === 1 ? branch('footer-ornament', true) : model === 2 ? flowerRow('footer-ornament', true) : decoDivider('footer-ornament', true)}<p class="footer-names script${gold}">${esc(site.couple)}</p><p class="footer-date">${esc(numericDate(event.date))}</p><a class="footer-top" href="#inicio">Voltar ao topo ↑</a></div></footer>`;

  renderRsvpForm(slug, model);
  bindNav();
  startCountdown(event);
  prepareHero(model);
  reveal(app);
  parallax(app);
  scrollProgress();
  bindTimeline();
  bindOnEnter(model);
  $$('.info-card, .event-card').forEach(card => tilt(card, { max: card.classList.contains('event-card') ? 3 : 7 }));
  $$('.btn').forEach(btn => magnetic(btn, { strength: 0.18 }));

  const skipIntro = reducedMotion || Boolean(location.hash);
  if (skipIntro) {
    startHero(model);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } else playIntro(site, event, model);
}

/* ---------- Abertura cinematográfica ---------- */
function playIntro(site, event, model) {
  const [a, b] = initialsPair(site.couple);
  const curtain = model === 2 || model === 3;
  document.body.insertAdjacentHTML('beforeend', `<div class="intro intro-${model}" id="intro">
    ${curtain ? '<div class="intro-panel intro-panel-l"></div><div class="intro-panel intro-panel-r"></div>' : ''}${model === 3 ? '<div class="intro-flash" aria-hidden="true"></div>' : ''}
    <div class="intro-center"><div class="intro-mark">${monogramSvg(model)}<span class="intro-initials${model === 3 ? ' gold-text' : ''}">${esc(a)}${b ? `<em>&amp;</em>${esc(b)}` : ''}</span></div><p class="intro-kicker">Vamos nos casar</p><p class="intro-date">${esc(numericDate(event.date))}</p></div>
    <button class="intro-skip" type="button" aria-label="Entrar no site">Toque para entrar</button></div>`);
  const intro = $('#intro');
  document.documentElement.classList.add('intro-lock');
  drawSvg(intro.querySelector('svg'), { duration: 1300, stagger: model === 1 ? 32 : model === 3 ? 70 : 110 });
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    clearTimeout(timer);
    removeEventListener('keydown', onKey);
    removeEventListener('wheel', open);
    intro.classList.add('intro-open');
    document.documentElement.classList.remove('intro-lock');
    setTimeout(() => startHero(model), curtain ? 350 : 200);
    setTimeout(() => intro.remove(), 1600);
  };
  const onKey = e => { if (['Enter', ' ', 'Escape', 'ArrowDown'].includes(e.key)) open(); };
  const timer = setTimeout(open, model === 3 ? 3000 : 2700);
  intro.addEventListener('click', open);
  addEventListener('keydown', onKey);
  addEventListener('wheel', open, { passive: true });
  intro.querySelector('.intro-skip').focus({ preventScroll: true, focusVisible: false });
}

/* ---------- Hero ---------- */
let heroSplits = [];
function prepareHero(model) {
  const hero = $('.hero');
  if (model === 1) heroSplits = $$('.hero-1 .name-line').map((line, i) => splitText(line, { delay: 300 + i * 520, stagger: 55 }));
  if (finePointer && !reducedMotion) hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--hx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
    hero.style.setProperty('--hy', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
  });
}

function startHero(model) {
  const hero = $('.hero');
  hero.classList.add('hero-in');
  heroSplits.forEach(split => split.play());
  if (model === 1) {
    $$('.hero-branch').forEach((svg, i) => drawSvg(svg, { duration: 1400, stagger: 45, delay: 200 + i * 700 }));
    $$('.hero-1 .corner').forEach((svg, i) => drawSvg(svg, { duration: 2400, stagger: 60, delay: 300 + i * 300 }));
  }
  if (model === 2) $$('.frame-floral').forEach((svg, i) => drawSvg(svg, { duration: 1500, stagger: 70, delay: 400 + i * 400 }));
  if (model === 3) {
    drawSvg($('.deco-frame'), { duration: 2200, stagger: 180, delay: 100 });
    $$('.hero-3 .deco-fan, .hero-3 .deco-corner, .hero-3 .kicker-deco').forEach((svg, i) => drawSvg(svg, { duration: 1800, stagger: 40, delay: 300 + i * 150 }));
  }
  particles = ambient(model, { layer: 'front', density: innerWidth < 640 ? 0.45 : model === 3 ? 0.9 : 0.7 });
  setTimeout(() => particles.burst(innerWidth / 2, innerHeight * 0.42, model === 3 ? 40 : 26), 250);
}

/* ---------- Rolagem ---------- */
function bindTimeline() {
  const timeline = $('#timeline');
  if (!timeline) return;
  const items = $$('.tl-item', timeline);
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = timeline.getBoundingClientRect();
    const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.62 - r.top) / r.height));
    timeline.style.setProperty('--p', progress.toFixed(3));
    items.forEach(item => item.classList.toggle('lit', item.offsetTop + 34 <= progress * r.height + 1));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

function onEnter(el, fn, threshold = 0.4) {
  if (!el) return;
  if (reducedMotion || !('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
  io.observe(el);
}

let countingUp = false;
function bindOnEnter(model) {
  // Frase final da história entra palavra por palavra (no Gala o dourado fica no texto inteiro, sem dividir).
  const quote = $('#story-quote');
  if (model !== 3) { const quoteSplit = splitText(quote, { by: 'word', stagger: 110 }); onEnter(quote, () => quoteSplit.play(), 0.6); }
  else onEnter(quote, () => quote.classList.add('quote-in'), 0.6);
  // Os dias "correm" do zero até o valor real quando a contagem aparece.
  const days = $('[data-unit="days"]');
  if (days) onEnter(days, () => {
    if (reducedMotion) return;
    countingUp = true;
    const target = Number(days.textContent) || 0;
    countUp(days, target, { duration: 1500, format: v => String(Math.round(v)) });
    setTimeout(() => { countingUp = false; }, 1600);
  });
  // Nomes do rodapé.
  const footerNames = $('.footer-names');
  if (model === 1) { const footerSplit = splitText(footerNames, { stagger: 35 }); onEnter(footerNames, () => footerSplit.play(), 0.6); }
  else if (model === 2) { const footerSplit = splitText(footerNames, { by: 'word', stagger: 160 }); onEnter(footerNames, () => footerSplit.play(), 0.6); }
}

function bindNav() {
  const nav = $('#nav'), toggle = $('#nav-toggle');
  const setOpen = open => { nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('.nav-links a, .nav-brand').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 30);
    nav.classList.toggle('nav-hidden', !reducedMotion && y > 480 && y > lastY + 4 && !nav.classList.contains('open'));
    if (y < lastY - 4) nav.classList.remove('nav-hidden');
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // Destaca no menu a seção que está na tela.
  if ('IntersectionObserver' in window) {
    const map = new Map($$('.nav-links a').map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      map.forEach(a => a.classList.remove('active'));
      map.get(entry.target.id)?.classList.add('active');
    }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((a, id) => { const section = document.getElementById(id); if (section) io.observe(section); });
  }
}

function startCountdown(event) {
  const timer = setInterval(() => {
    const box = $('#countdown');
    const parts = countdownParts(event.date, event.time);
    if (!box) return clearInterval(timer);
    if (!parts) { box.innerHTML = countdownHtml(event); return clearInterval(timer); }
    Object.entries(parts).forEach(([key, value]) => {
      if (key === 'days' && countingUp) return;
      tick(box.querySelector(`[data-unit="${key}"]`), key === 'days' ? String(value) : String(value).padStart(2, '0'));
    });
  }, 1000);
}

/* ---------- Confirmação de presença ---------- */
function renderRsvpForm(slug, model) {
  const wrap = $('#rsvp-wrap');
  wrap.innerHTML = `<form class="rsvp-card" id="rsvp-form" novalidate>
    <p class="rsvp-intro">Responda até alguns dias antes da data para nos ajudar com a organização.</p>
    <div class="field"><label for="rsvp-name">Seu nome completo</label><input id="rsvp-name" name="name" maxlength="80" autocomplete="name" required /></div>
    <fieldset class="choice"><legend>Você vai ao casamento?</legend><label class="choice-opt"><input type="radio" name="attending" value="sim" checked /><span>Sim, estarei lá</span></label><label class="choice-opt"><input type="radio" name="attending" value="nao" /><span>Não poderei ir</span></label></fieldset>
    <div class="field" id="people-field"><label for="rsvp-people">Quantas pessoas, contando com você?</label><input id="rsvp-people" name="people" type="number" min="1" max="20" value="1" inputmode="numeric" /></div>
    <div class="field"><label for="rsvp-message">Recado para os noivos <span class="optional">(opcional)</span></label><textarea id="rsvp-message" name="message" maxlength="500" placeholder="Deixe uma mensagem carinhosa"></textarea></div>
    <p class="form-error" id="rsvp-error" role="alert"></p>
    <button class="btn btn-block btn-shine" type="submit">Enviar confirmação</button>
  </form>`;
  const form = $('#rsvp-form');
  magnetic(form.querySelector('button[type="submit"]'), { strength: 0.12 });
  form.addEventListener('change', event => {
    if (event.target.name === 'attending') $('#people-field').hidden = event.target.value === 'nao';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const error = $('#rsvp-error'), button = form.querySelector('button[type="submit"]');
    const name = String(values.name || '').trim();
    const attending = values.attending === 'sim';
    const people = Math.max(1, Math.min(20, Number(values.people) || 1));
    error.textContent = '';
    if (name.length < 2) {
      error.textContent = 'Por favor, escreva o seu nome.';
      $('#rsvp-name').focus();
      if (!reducedMotion) form.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 380 });
      return;
    }
    button.disabled = true; button.textContent = 'Enviando...';
    try {
      await submitRsvp(slug, { name, people: attending ? people : 0, attending, message: values.message, product: 'site' });
      const first = esc(name.split(/\s+/)[0]);
      wrap.innerHTML = `<div class="rsvp-card rsvp-done" tabindex="-1"><span class="done-mark" aria-hidden="true"><svg class="done-heart" viewBox="0 0 24 24">${icons.heart}</svg></span><h3 class="display${model === 3 ? ' gold-text' : ''}" id="done-title">Obrigado, ${first}!</h3><p class="pop-in" style="--d:.9s">${attending ? `Sua presença está confirmada${people > 1 ? ` para ${people} pessoas` : ''}. Mal podemos esperar para celebrar com você!` : 'Que pena que você não poderá vir. Obrigado por nos avisar com carinho.'}</p><div class="pop-in" style="--d:1.15s"><button class="btn btn-ghost" type="button" id="rsvp-again">Enviar outra resposta</button></div></div>`;
      drawSvg($('.done-heart'), { duration: 1100 });
      if (model !== 3) splitText($('#done-title'), { by: model === 2 ? 'word' : 'char', delay: 250, stagger: model === 2 ? 140 : 32 }).play();
      $('.rsvp-done').focus({ preventScroll: true });
      // O cartão de agradecimento é menor que o formulário: centraliza na hora e solta o confete do coração.
      $('.rsvp-done').scrollIntoView({ block: 'center', behavior: 'instant' });
      const mark = $('.done-mark').getBoundingClientRect();
      const origin = { x: mark.left + mark.width / 2, y: mark.top + mark.height / 2 };
      if (attending) confetti(origin, model, { amount: model === 3 ? 220 : 170 });
      particles.burst(origin.x, origin.y, attending ? 30 : 14);
      buzz(attending ? [20, 50, 30] : 18);
      $('#rsvp-again').addEventListener('click', () => renderRsvpForm(slug, model));
    } catch (err) {
      console.error('Falha ao enviar confirmação:', err);
      error.textContent = 'Não foi possível enviar agora. Verifique sua conexão e tente novamente.';
      button.disabled = false; button.textContent = 'Enviar confirmação';
    }
  });
}

const page = await loadProductPage('site');
if (page.site) render(page);
else renderUnavailable(document.body, page.error);
