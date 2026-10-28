import { loadProductPage, eventInfo, submitRsvp, mapsUrl, mapsEmbedUrl, calendarUrl, countdownParts, renderUnavailable, esc } from './lib/site.js';
import { dateLong } from './lib/catalog.js';
import { custom, customList } from './lib/content.js';
import { DOODLES, tornEdge, cuttingBoard, sprig, appButtons, appIcon, sticker, roundPhoto, wavyPhoto, polaroid, coverPhoto, gallery, waveClipDefs, seal, initialsOf, splitCouple, pixHtml, bindPixCopy } from './lib/decor.js';
import { reducedMotion, ambient, confetti, reveal, drawSvg, tilt, magnetic, parallax, tick, countUp, scrollProgress, buzz } from './lib/fx.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const formatTime = time => {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
};
const numericDate = date => (date ? date.split('-').reverse().join(' . ') : 'Em breve');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateParts = iso => {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return { day: d.getDate(), month: d.toLocaleDateString('pt-BR', { month: 'long' }), monthShort: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), weekday: d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0], year: d.getFullYear() };
};
const THEME = { 1: '#bf8152', 2: '#ffffff', 3: '#fbfaf5', 4: '#fbf8ef' };
const DOODLE_INK = { 1: '#8a5530', 2: '#4b5a3a', 3: '#4f5b3e', 4: '#66754a' };
let particles = { stop() {}, burst() {} };
let toastTimer;

/* Desenhos de casamento no mesmo traço dos desenhos de lib/decor.js (viewBox 64, currentColor). */
const WED = {
  aliancas: '<circle cx="25" cy="40" r="13"/><circle cx="39" cy="40" r="13"/><path d="M34 21l5-6 5 6-5 5z"/><path d="M34 21h10"/><path d="M14 13l2.5 3M52 11l-2.5 3M27 6l1 3.5"/>',
  tacas: '<g transform="rotate(-14 20 34)"><path d="M14 8h12l-1 16a5 5 0 0 1-10 0z"/><path d="M20 29v21M14 52h12"/><path d="M15 15h10"/></g><g transform="rotate(14 44 34)"><path d="M38 8h12l-1 16a5 5 0 0 1-10 0z"/><path d="M44 29v21M38 52h12"/><path d="M39 15h10"/></g><path d="M32 3v4M27 5l2 3M37 5l-2 3"/>',
  envelope: '<rect x="8" y="16" width="48" height="34" rx="3"/><path d="M8 18l24 18 24-18"/><path d="M8 48l18-14M56 48 38 34"/><path d="M32 30s-5-3-5-6a2.5 2.5 0 0 1 5-1 2.5 2.5 0 0 1 5 1c0 3-5 6-5 6z"/>',
  bolo: '<path d="M12 56h40"/><path d="M16 56V43h32v13"/><path d="M21 43V32h22v11"/><path d="M26 32v-9h12v9"/><path d="M16 49c4 3 8 3 12 0s8-3 12 0 6 2 8 0"/><path d="M21 37c3 2 6 2 9 0s7-2 10 0"/><path d="M32 23v-5"/><path d="M32 18s-3.5-2.2-3.5-4.4a1.7 1.7 0 0 1 3.5-.7 1.7 1.7 0 0 1 3.5.7c0 2.2-3.5 4.4-3.5 4.4z"/>',
  buque: '<circle cx="23" cy="19" r="7"/><circle cx="39" cy="17" r="7"/><circle cx="31" cy="28" r="7"/><path d="M23 19h.01M39 17h.01M31 28h.01"/><path d="M25 34l7 24 7-24"/><path d="M27 42h10"/><path d="M15 26c-4 3-5 7-3 11M48 24c4 3 5 7 3 11"/>',
  traje: '<path d="M24 6l8 8 8-8"/><path d="M24 6 12 14v42h40V14L40 6"/><path d="M32 14v42"/><path d="M28 20l4 4 4-4-4 12z"/><path d="M12 30h8M44 30h8"/>',
  relogio: '<circle cx="32" cy="35" r="20"/><path d="M32 23v12l8 5"/><path d="M26 8h12M32 8v7"/>',
  camera: '<rect x="8" y="20" width="48" height="32" rx="5"/><circle cx="32" cy="36" r="10"/><path d="M22 20l4-7h12l4 7"/><path d="M47 27h3"/>',
  balao: '<path d="M32 40c-9 0-14-9-14-17a14 14 0 0 1 28 0c0 8-5 17-14 17z"/><path d="M30 40h4l-2 4z"/><path d="M32 44c-3 5 3 8 0 14"/><path d="M25 18c1-3 3-5 6-5"/>',
};
const art = (name, cls = '') => `<svg class="doodle ${cls}" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${WED[name] || DOODLES[name] || ''}</svg>`;
// Fundo com desenhos espalhados (mesmo formato de applyDoodlePattern, com os desenhos de casamento).
function weddingPattern(color, opacity) {
  const names = ['aliancas', 'coracao', 'tacas', 'envelope', 'bolo', 'buque', 'presente', 'casa'];
  const spots = [[8, 10, -12], [92, 4, 10], [168, 22, -6], [30, 92, 14], [116, 84, -16], [190, 112, 8], [70, 168, -8], [150, 176, 12]];
  const g = spots.map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r} 22 22) scale(.7)">${WED[names[i]] || DOODLES[names[i]]}</g>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${g}</svg>`;
  document.documentElement.style.setProperty('--doodles', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}
// Ícone de cada informação pelo título; sem correspondência, segue uma sequência de desenhos.
function infoArt(title, i) {
  const t = String(title).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const rules = [[/traje|roupa|vest/, 'traje'], [/chegada|horario|pontual/, 'relogio'], [/crianc/, 'balao'], [/foto|celular/, 'camera'], [/presente/, 'presente'], [/festa|recep|bebida/, 'tacas'], [/hosped|hotel|casa/, 'casa']];
  return (rules.find(([re]) => re.test(t)) || [0, ['aliancas', 'envelope', 'bolo', 'buque'][i % 4]])[1];
}

/* Rostos do modelo Oliva: véu e gravata-borboleta desenhados. */
const veil = '<svg class="face-veil" viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M38 22c8-14 36-14 44 0"/><path d="M36 24C14 44 10 84 22 112M84 24c22 20 26 60 14 88"/><path d="M30 60c-4 18-2 36 4 50M90 60c4 18 2 36-4 50"/><path d="M46 14l4-8 6 6 4-9 4 9 6-6 4 8"/></svg>';
const bowTie = '<svg class="face-bow" viewBox="0 0 64 32" aria-hidden="true"><path d="M30 16 4 4v24zM34 16 60 4v24z" fill="currentColor"/><rect x="27" y="10" width="10" height="12" rx="3" fill="currentColor"/></svg>';
// Filete com folhinha do modelo Elegante.
const rule = '<svg class="sec-rule" viewBox="0 0 160 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M0 8h64M96 8h64"/><path d="M80 2c-6 2-8 6-8 6s2 4 8 6c6-2 8-6 8-6s-2-4-8-6z"/><path d="M72 8h16"/></svg>';
const pin = `<span class="pin">${appIcon('local')}</span>`;

/* Partes do site --------------------------------------------------------------- */

// Cabeçalho de seção: título + frase cursiva (a ordem e o estilo mudam por modelo no CSS).
const head = (title, note, ctx, { script = false } = {}) => `<div class="sec-head" data-fx="up">${note ? `<p class="sec-note script">${note}</p>` : ''}<h2 class="sec-title ${script ? 'script is-script' : 'display'}">${title}</h2>${ctx.model === 3 ? rule : ''}</div>`;
const section = (id, tone, inner, cls = '') => `<section class="sec ${tone ? `sec-${tone}` : ''} ${cls}"${id ? ` id="${id}"` : ''}>${tone === 'alt' ? tornEdge('torn-top', 5) + tornEdge('torn-bottom', 9) : ''}<div class="wrap">${inner}</div></section>`;

function heroHtml(ctx) {
  const { model, photos, n1, n2, ev, t, couple } = ctx;
  const names = n2 ? `${n1} e ${n2}` : n1;
  const parts = dateParts(ev.date);
  const time = formatTime(ev.time);
  const place = [ev.venue, ev.address].filter(Boolean).join(' · ');
  const hasFaces = Boolean(photos.ela || photos.ele);
  const faces = `${sticker(photos.ela, n1, 'face face-1')}${sticker(photos.ele, n2 || n1, 'face face-2')}`;

  if (model === 1) {
    const portrait = hasFaces ? faces : photos.capa ? roundPhoto(photos.capa, `Foto de ${names}`, 'hero-round') : art('aliancas', 'hero-rings');
    return `<header class="hero" id="inicio">
      <div class="hero-band">
        <div class="hero-doodles" data-speed="-0.12">${art('aliancas', 'hd hd-a')}${art('tacas', 'hd hd-b')}${art('envelope', 'hd hd-c')}${art('buque', 'hd hd-d')}</div>
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <p class="kicker">Nosso casamento</p>
            <h1 class="hero-title display">${esc(t('siteTitle'))}</h1>
            <p class="hero-names">${esc(names)}</p>
          </div>
          <div class="hero-faces">${portrait}</div>
        </div>
        ${tornEdge('hero-torn', 11)}
      </div>
      <div class="wrap hero-when">
        <p class="hero-date display">${esc(ev.date ? dateLong(ev.date) : 'Data a definir')}</p>
        ${time ? `<p class="hero-time">${parts ? esc(capitalize(parts.weekday)) + ', ' : ''}às ${esc(time)}</p>` : ''}
        ${place ? `<a class="place-pill" href="${esc(mapsUrl(ev))}" target="_blank" rel="noopener">${pin}<span>${esc(place)}</span></a>` : ''}
        <p class="hero-lead">${esc(t('siteLead'))}</p>
      </div>
    </header>`;
  }
  if (model === 2) {
    const portrait = hasFaces ? faces : photos.capa ? sticker({ ...photos.capa, cutout: false }, `Foto de ${names}`, 'face face-solo') : `<span class="face-fallback">${art('aliancas')}</span>`;
    return `<header class="hero doodle-bg" id="inicio">
      <div class="wrap hero-inner">
        <div class="hero-faces">${portrait}</div>
        <p class="kicker">${esc(t('siteTitle'))}</p>
        <h1 class="hero-names script">${esc(n1)}${n2 ? ` <span class="amp">&amp;</span> ${esc(n2)}` : ''}</h1>
        <p class="hero-lead">${esc(t('siteLead'))}</p>
      </div>
      <div class="arch">
        ${parts ? `<div class="cal"><span class="cal-side">${esc(parts.weekday)}</span><strong class="cal-day">${parts.day}</strong><span class="cal-side">${esc(parts.month)}</span></div><p class="cal-year">${parts.year}${time ? ` · às ${esc(time)}` : ''}</p>` : '<p class="cal-tbd">Data a definir</p>'}
      </div>
      ${buttonsHtml(ctx)}
    </header>`;
  }
  if (model === 3) {
    return `<header class="hero" id="inicio">
      ${coverPhoto(photos.capa, `Foto de ${names}`, 'hero-cover') || `<div class="hero-sprigs">${sprig('sp-l')}${sprig('sp-r')}</div>`}
      <div class="wrap hero-body">
        <p class="monogram display">${esc(initialsOf(couple) || '♡')}</p>
        <p class="verse">${esc(t('verse'))}</p>
        <h1 class="hero-names script">${esc(n1)}${n2 ? ` <span class="amp">&amp;</span> ${esc(n2)}` : ''}</h1>
        <p class="hero-invite display">convidam para a cerimônia de seu casamento, a realizar-se em</p>
        ${parts ? `<div class="date-block"><span class="date-month display">${esc(parts.month)}</span><div class="date-row"><span class="display">${esc(parts.weekday)}</span><strong class="display">${parts.day}</strong><span class="display">${ev.time ? `às ${esc(ev.time)}` : esc(String(parts.year))}</span></div><span class="date-year display">${parts.year}</span></div>` : '<p class="date-tbd display">Data a definir</p>'}
        ${place ? `<a class="btn place-btn" href="${esc(mapsUrl(ev))}" target="_blank" rel="noopener">${pin}Como chegar na cerimônia</a><p class="venue-line display">${esc([ev.venue, ev.address].filter(Boolean).join(' | '))}</p>` : ''}
        ${sprig('hero-sprig hs-a')}${sprig('hero-sprig hs-b')}
      </div>
    </header>`;
  }
  return `<header class="hero doodle-bg" id="inicio">
    <div class="wrap hero-inner">
      <div class="hero-doodles" data-speed="-0.1">${art('aliancas', 'hd hd-a')}${art('tacas', 'hd hd-b')}</div>
      <h1 class="title-stack"><span class="title-pre script">o nosso</span><span class="title-big display">Casamento</span><span class="title-names script">${esc(names)}</span></h1>
      <div class="hero-faces">${hasFaces ? `<span class="face-wrap fw-1">${photos.ela ? veil : ''}${sticker(photos.ela, n1, 'face')}</span><span class="face-wrap fw-2">${sticker(photos.ele, n2 || n1, 'face')}${photos.ele ? bowTie : ''}</span>` : art('aliancas', 'hero-rings')}</div>
      ${parts ? cuttingBoard(`${parts.day} de ${parts.monthShort}`, time ? `às ${time}` : String(parts.year)) : '<p class="date-tbd">Data a definir</p>'}
      ${place ? `<p class="hero-address">${esc([ev.venue, ev.address].filter(Boolean).join(', '))}</p>` : ''}
      <div class="doodle-row">${['aliancas', 'tacas', 'bolo', 'coracao', 'buque', 'envelope', 'presente'].map(n => art(n)).join('')}</div>
    </div>
  </header>`;
}

function buttonsHtml(ctx) {
  const { model, ev, slug, site } = ctx;
  const cal = ev.date ? calendarUrl({ title: `Casamento de ${ctx.couple}`, ...ev }) : '';
  const items = [
    { icon: 'presenca', label: model === 3 ? 'Confirme sua presença' : 'Confirmar presença', href: '#presenca' },
    ...(ctx.hasLista ? [{ icon: 'presente', label: 'Lista de presentes', href: `lista.html?c=${encodeURIComponent(slug)}` }] : []),
    ...(ev.venue || ev.address ? [{ icon: 'local', label: 'Ver localização', href: '#cerimonia' }] : []),
    ...(model === 3 ? [{ icon: 'roteiro', label: 'Informações importantes', href: '#informacoes' }] : cal ? [{ icon: 'agenda', label: 'Salvar a data', href: cal, external: true }] : []),
  ];
  const top = model === 3 ? '<p class="btn-kicker display">Clique nos botões</p><p class="btn-script script">para interagir</p>' : model === 2 ? '<p class="btn-kicker">Acesse as informações abaixo</p>' : '';
  const note = model === 3 ? `<p class="btn-note display">${esc(custom(site, 'siteLead'))}</p>` : '';
  return `<section class="sec-buttons" aria-label="Atalhos" data-fx="up"><div class="buttons-card">${top}${appButtons(items)}${note}</div></section>`;
}

function welcomeHtml(ctx) {
  const photo = wavyPhoto(ctx.photos.capa, `Foto de ${ctx.couple}`, 'welcome-photo');
  return section('', 'band', `<div class="welcome${photo ? ' has-photo' : ''}">
    <div class="welcome-text" data-fx="up"><h2 class="welcome-title display">${esc(ctx.t('siteTitle'))}</h2><p>${esc(ctx.t('siteLead'))}</p></div>
    ${photo ? `<div class="welcome-art" data-fx="up">${photo}</div>` : `<div class="welcome-art" data-fx="up">${art('aliancas', 'welcome-rings')}</div>`}
  </div>`, 'sec-welcome');
}

function countdownHtml(ctx) {
  const units = [['days', 'dias', '0'], ['hours', 'horas', '00'], ['minutes', 'minutos', '00'], ['seconds', 'segundos', '00']];
  const swap = ctx.model === 2 || ctx.model === 4;
  return section('contagem', ctx.tones.contagem, `${swap ? head('Faltam', 'Esperamos por você!', ctx, { script: ctx.model === 2 }) : head('Esperamos por você!', 'Faltam', ctx)}
    <div class="countdown" id="countdown" data-fx="up">${units.map(([unit, label, zero]) => `<div class="cd-unit"><strong data-unit="${unit}">${zero}</strong><span>${label}</span></div>`).join('<span class="cd-sep" aria-hidden="true">:</span>')}</div>
    <p class="countdown-msg display" id="countdown-msg" hidden></p>
    ${ctx.model === 3 ? sprig('sec-sprig ss-l') + sprig('sec-sprig ss-r') : ''}`, 'sec-countdown');
}

function storyHtml(ctx) {
  const story = customList(ctx.site, 'story');
  if (!story.length) return '';
  const { model, photos } = ctx;
  const photo = model === 1 && (photos.ela || photos.ele) ? roundPhoto(photos.capa, `Foto de ${ctx.couple}`, 'story-photo')
    : model === 2 && (photos.ela || photos.ele) ? polaroid(photos.capa, '', 'story-photo', 4) : '';
  return section('historia', ctx.tones.historia, `${head('Nossa história', 'como tudo começou', ctx)}
    <div class="story${photo ? ' has-photo' : ''}">
      ${photo ? `<div class="story-art" data-fx="up">${photo}</div>` : ''}
      <div>
        <ol class="timeline" id="timeline"><span class="tl-track" aria-hidden="true"><span class="tl-progress"></span></span>
          ${story.map((item, i) => `<li class="tl-item" data-fx="up"><span class="tl-dot" aria-hidden="true">${model === 4 ? art('coracao') : ''}</span><p class="tl-label">Capítulo ${String(i + 1).padStart(2, '0')}</p>${item.label ? `<h3 class="tl-title display">${esc(item.label)}</h3>` : ''}${item.text ? `<p class="tl-text">${esc(item.text)}</p>` : ''}</li>`).join('')}
        </ol>
        <p class="story-quote script" data-fx="up">E foi assim que dois caminhos viraram um só.</p>
      </div>
    </div>`, 'sec-story');
}

function galleryHtml(ctx) {
  const html = gallery(ctx.photos, 'site-gallery');
  if (!html) return '';
  return section('galeria', ctx.tones.galeria, `${head('Nossos momentos', 'alguns cliques nossos', ctx, { script: ctx.model === 2 })}<div data-fx="up">${html}</div>`, 'sec-gallery');
}

function ceremonyHtml(ctx) {
  const { ev, couple, model } = ctx;
  const hasPlace = Boolean(ev.venue || ev.address);
  const embed = mapsEmbedUrl(ev);
  const cal = ev.date ? calendarUrl({ title: `Casamento de ${couple}`, ...ev }) : '';
  const title = model === 2 ? 'Localização' : 'Cerimônia &amp; recepção';
  return section('cerimonia', ctx.tones.cerimonia, `${head(title, model === 2 ? '' : 'o grande dia', ctx, { script: model === 2 })}
    <div class="event${embed ? ' has-map' : ''}">
      <div class="event-info" data-fx="up">
        <span class="local-pin">${appIcon('local')}</span>
        <dl class="details">
          <div><dt>Data</dt><dd>${esc(ev.date ? capitalize(dateLong(ev.date, true)) : 'A definir')}</dd></div>
          <div><dt>Horário</dt><dd>${esc(ev.time ? `às ${formatTime(ev.time)}` : 'A definir')}</dd></div>
          <div><dt>Local</dt><dd>${esc(ev.venue || ev.address || 'A definir')}${ev.venue && ev.address ? `<small>${esc(ev.address)}</small>` : ''}</dd></div>
        </dl>
        <div class="detail-actions">
          ${hasPlace ? `<a class="btn btn-shine" href="${esc(mapsUrl(ev))}" target="_blank" rel="noopener">Como chegar</a>` : ''}
          ${cal ? `<a class="btn btn-ghost" href="${esc(cal)}" target="_blank" rel="noopener">Salvar na agenda</a>` : ''}
        </div>
      </div>
      ${embed ? `<div class="map-window" data-fx="up"><iframe src="${esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa do local" allowfullscreen></iframe></div>` : ''}
    </div>`, 'sec-ceremony');
}

function infosHtml(ctx) {
  const infos = customList(ctx.site, 'infos');
  if (!infos.length) return '';
  return section('informacoes', ctx.tones.informacoes, `${head('Informações importantes', 'para os convidados', ctx)}
    <div class="info-grid" style="--cols:${Math.min(4, infos.length)}" data-fx-stagger="up">${infos.map((info, i) => `<article class="info-card"><span class="info-icon">${art(infoArt(info.title, i))}</span>${info.title ? `<h3 class="display">${esc(info.title)}</h3>` : ''}${info.text ? `<p>${esc(info.text)}</p>` : ''}</article>`).join('')}</div>`, 'sec-infos');
}

function giftsHtml(ctx) {
  const pix = pixHtml({ key: custom(ctx.site, 'pixKey'), holder: custom(ctx.site, 'pixHolder'), title: custom(ctx.site, 'pixTitle'), gifts: customList(ctx.site, 'sitePixGifts') });
  if (!ctx.hasLista && !pix) return '';
  const lista = ctx.hasLista ? `<div class="gift-cta" data-fx="up">${art('presente', 'gift-art')}<p class="sec-text">A sua presença é o nosso maior presente. Se quiser nos presentear, preparamos uma lista com muito carinho.</p><a class="btn btn-shine gift-btn" href="lista.html?c=${encodeURIComponent(ctx.slug)}">Ver lista de presentes</a></div>` : '';
  return section('presentes', ctx.tones.presentes, `${head(ctx.hasLista ? 'Lista de presentes' : 'Presentes', 'com carinho', ctx)}${lista}${pix ? `<div class="pix-wrap" data-fx="up">${pix}</div>` : ''}`, 'sec-gifts');
}

function rsvpHtml(ctx) {
  const people = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? 'pessoas' : 'pessoa'}</option>`).join('');
  return section('presenca', ctx.tones.presenca, `<div class="rsvp">
    <div class="rsvp-side">${head('Confirme sua presença', 'conte pra gente', ctx)}<p class="sec-text" data-fx="up">Sua resposta ajuda a gente a organizar tudo com carinho. Responda até alguns dias antes da data.</p>${art(ctx.model === 3 ? 'envelope' : 'tacas', 'rsvp-art')}</div>
    <div class="rsvp-card" data-fx="up">
      <form class="rsvp-form" id="rsvp-form" novalidate>
        <label class="field">Seu nome completo<input name="name" maxlength="80" autocomplete="name" required /></label>
        <fieldset class="choice">
          <legend>Você vai ao casamento?</legend>
          <label><input type="radio" name="attending" value="sim" checked /><span><i class="choice-ic" aria-hidden="true">♥</i>Sim, estarei lá</span></label>
          <label><input type="radio" name="attending" value="nao" /><span><i class="choice-ic" aria-hidden="true">✕</i>Não poderei ir</span></label>
        </fieldset>
        <label class="field" id="people-field">Quantas pessoas, contando você<select name="people">${people}</select></label>
        <label class="field"><span>Recado para os noivos <em>(opcional)</em></span><textarea name="message" maxlength="500" placeholder="Deixe uma mensagem carinhosa"></textarea></label>
        <p class="form-error" id="form-error" role="alert"></p>
        <button class="btn btn-shine" type="submit">Enviar confirmação</button>
      </form>
      <div class="rsvp-done" id="rsvp-done" hidden tabindex="-1">
        <span class="done-mark" aria-hidden="true">♥</span>
        <h3 class="display" id="done-title"></h3>
        <p id="done-text"></p>
        <button class="link-button" type="button" id="rsvp-again">Enviar outra resposta</button>
      </div>
    </div>
  </div>`, 'sec-rsvp');
}

function footerHtml(ctx) {
  const { model, ev, couple } = ctx;
  const ornament = model === 3 ? sprig('footer-sprig') : art(model === 2 ? 'aliancas' : model === 4 ? 'tacas' : 'aliancas', 'footer-art');
  return `<footer class="footer">${model === 1 ? tornEdge('footer-torn', 3) : ''}<div class="wrap" data-fx="up">
    <p class="closing display">${esc(ctx.t('siteClosing'))}</p>
    ${ornament}
    <p class="footer-names script">${esc(couple)}</p>
    <p class="footer-date">${esc(numericDate(ev.date))}</p>
    <a class="footer-top" href="#inicio">Voltar ao topo ↑</a>
  </div></footer>`;
}

// Ordem e tom de cada seção por modelo: alt = faixa de cor clara, band = faixa na cor da marca.
const ORDER = {
  1: ['buttons', 'contagem', 'historia', 'galeria', 'cerimonia', 'informacoes', 'presentes', 'presenca'],
  2: ['historia', 'galeria', 'contagem', 'cerimonia', 'informacoes', 'presentes', 'presenca'],
  3: ['buttons', 'contagem', 'historia', 'galeria', 'cerimonia', 'informacoes', 'presentes', 'presenca'],
  4: ['buttons', 'welcome', 'contagem', 'historia', 'galeria', 'cerimonia', 'informacoes', 'presentes', 'presenca'],
};
const TONES = {
  1: { contagem: 'alt', galeria: 'alt', informacoes: 'alt', presenca: 'alt' },
  2: { galeria: 'band', cerimonia: 'band', informacoes: 'soft', presenca: 'soft' },
  3: { historia: 'soft', cerimonia: 'soft', presentes: 'soft' },
  4: { galeria: 'soft', informacoes: 'soft', presentes: 'band' },
};
const SECTIONS = { buttons: buttonsHtml, welcome: welcomeHtml, contagem: countdownHtml, historia: storyHtml, galeria: galleryHtml, cerimonia: ceremonyHtml, informacoes: infosHtml, presentes: giftsHtml, presenca: rsvpHtml };

function navHtml(ctx) {
  const links = [['#historia', 'Nossa história'], ['#cerimonia', 'Cerimônia'], ['#informacoes', 'Informações'], ...(ctx.hasGifts ? [['#presentes', 'Presentes']] : []), ['#presenca', 'Confirmar presença']]
    .filter(([href]) => ctx.html.includes(`id="${href.slice(1)}"`));
  const [a, b] = [ctx.n1, ctx.n2].map(n => (n || '').charAt(0).toUpperCase());
  return `<header class="nav" id="nav"><div class="wrap nav-inner">
    <a class="nav-brand" href="#inicio" aria-label="${esc(ctx.couple)}, início">${esc(a)}${b ? `<em>&amp;</em>${esc(b)}` : ''}</a>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Abrir menu"><span></span><span></span><span></span></button>
    <ul class="nav-links" id="nav-links">${links.map(([href, label]) => `<li><a href="${href}"${href === '#presenca' ? ' class="nav-cta"' : ''}>${label}</a></li>`).join('')}</ul>
  </div></header>`;
}

function introHtml(ctx) {
  const parts = dateParts(ctx.ev.date);
  return `<div class="intro${ctx.model === 2 || ctx.model === 4 ? ' doodle-bg' : ''}" id="intro" role="button" tabindex="0" aria-label="Entrar no site">
    <div class="intro-center">${seal(initialsOf(ctx.couple) || '♡', 'intro-seal')}
      <p class="intro-kicker">Vamos nos casar</p>
      <p class="intro-names script">${esc(ctx.n2 ? `${ctx.n1} & ${ctx.n2}` : ctx.n1)}</p>
      <p class="intro-date">${esc(parts ? numericDate(ctx.ev.date) : 'Em breve')}</p>
    </div>
    <span class="intro-skip">Toque para entrar</span>
  </div>`;
}

/* Comportamento ---------------------------------------------------------------- */

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function playIntro() {
  const intro = $('#intro');
  document.documentElement.classList.add('intro-lock');
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    clearTimeout(timer);
    removeEventListener('keydown', onKey);
    removeEventListener('wheel', open);
    intro.classList.add('intro-open');
    document.documentElement.classList.remove('intro-lock');
    particles.burst(innerWidth / 2, innerHeight * .4, 30);
    setTimeout(() => intro.remove(), 900);
  };
  const onKey = e => { if (['Enter', ' ', 'Escape', 'ArrowDown'].includes(e.key)) open(); };
  const timer = setTimeout(open, 1700);
  intro.addEventListener('click', open);
  addEventListener('keydown', onKey);
  addEventListener('wheel', open, { passive: true });
  intro.focus({ preventScroll: true });
}

function bindNav() {
  const nav = $('#nav'), toggle = $('#nav-toggle');
  const setOpen = open => { nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  $$('.nav-links a, .nav-brand', nav).forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
  document.addEventListener('click', event => { if (!nav.contains(event.target)) setOpen(false); });
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 20);
    if (!reducedMotion && y > 480 && y > lastY + 4 && !nav.classList.contains('open')) nav.classList.add('nav-hidden');
    if (y < lastY - 4) nav.classList.remove('nav-hidden');
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // Destaca no menu a seção que está na tela.
  if ('IntersectionObserver' in window) {
    const map = new Map($$('.nav-links a', nav).map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      map.forEach(a => a.classList.remove('active'));
      map.get(entry.target.id)?.classList.add('active');
    }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
}

function onEnter(el, fn, threshold = .4) {
  if (!el) return;
  if (reducedMotion || !('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
  io.observe(el);
}

function startCountdown(ev) {
  const box = $('#countdown'), msg = $('#countdown-msg');
  if (!box) return;
  let first = true, counting = false;
  const update = () => {
    const parts = countdownParts(ev.date, ev.time);
    if (!parts) {
      box.hidden = true; msg.hidden = false;
      msg.textContent = !ev.date ? 'Data em breve' : ev.date === todayIso() ? 'É hoje! Esperamos você ♡' : 'O grande dia chegou ♡';
      $('#contagem .sec-note').hidden = true;
      return false;
    }
    for (const [unit, value] of Object.entries(parts)) {
      if (unit === 'days' && counting) continue;
      const el = box.querySelector(`[data-unit="${unit}"]`), text = unit === 'days' ? String(value) : String(value).padStart(2, '0');
      if (first) el.textContent = text; else tick(el, text);
    }
    first = false;
    return true;
  };
  if (!update()) return;
  setInterval(update, 1000);
  // Os dias "correm" do zero até o valor real quando a contagem aparece.
  const days = box.querySelector('[data-unit="days"]');
  onEnter(box, () => {
    if (reducedMotion) return;
    counting = true;
    countUp(days, Number(days.textContent) || 0, { duration: 1400, format: v => String(Math.round(v)) });
    setTimeout(() => { counting = false; }, 1500);
  });
}

function bindTimeline() {
  const timeline = $('#timeline');
  if (!timeline) return;
  const items = $$('.tl-item', timeline);
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = timeline.getBoundingClientRect();
    const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, (innerHeight * .62 - r.top) / r.height));
    timeline.style.setProperty('--p', progress.toFixed(3));
    items.forEach(item => item.classList.toggle('lit', item.offsetTop + 20 <= progress * r.height + 1));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

function setupRsvp(slug, model) {
  const form = $('#rsvp-form'), done = $('#rsvp-done'), error = $('#form-error'), peopleField = $('#people-field');
  const storageKey = `site-rsvp-${slug}`;
  const showDone = ({ name, attending, people }, celebrate = false) => {
    const first = String(name).trim().split(/\s+/)[0];
    $('#done-title').textContent = attending ? 'Presença confirmada!' : 'Resposta enviada';
    $('#done-text').textContent = attending ? `Obrigado, ${first}!${people > 1 ? ` Reservamos lugar para ${people} pessoas.` : ''} Mal podemos esperar para celebrar com você.` : `Obrigado por avisar com carinho, ${first}. Você vai fazer falta!`;
    form.hidden = true; done.hidden = false;
    done.classList.toggle('is-new', celebrate);
  };
  try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.name) showDone(saved); } catch {}

  form.querySelectorAll('.choice input').forEach(input => input.addEventListener('change', () => {
    const yes = input.value === 'sim';
    peopleField.hidden = !yes;
    if (yes && !reducedMotion) peopleField.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const label = input.nextElementSibling;
    label.classList.remove('just-picked'); void label.offsetWidth; label.classList.add('just-picked');
    if (yes) { const r = label.getBoundingClientRect(); particles.burst(r.left + r.width / 2, r.top + r.height / 2, 14); buzz(12); }
  }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = form.elements.name.value.trim(), attending = form.elements.attending.value === 'sim';
    const people = attending ? Number(form.elements.people.value) : 0;
    error.textContent = '';
    if (name.length < 2) {
      error.textContent = 'Por favor, escreva o seu nome.';
      form.elements.name.focus();
      if (!reducedMotion) form.elements.name.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 380 });
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Enviando...';
    try {
      await submitRsvp(slug, { name, attending, people, message: form.elements.message.value, product: 'site' });
      try { localStorage.setItem(storageKey, JSON.stringify({ name, attending, people })); } catch {}
      showDone({ name, attending, people }, true);
      done.focus({ preventScroll: true });
      done.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      if (attending) { confetti(done.querySelector('.done-mark'), model, { amount: 170 }); buzz([20, 40, 30]); }
    } catch (err) {
      console.error('Falha ao enviar confirmação:', err);
      error.textContent = 'Não foi possível enviar agora. Verifique sua conexão e tente novamente.';
    } finally {
      button.disabled = false; button.textContent = 'Enviar confirmação';
    }
  });
  $('#rsvp-again').addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); } catch {}
    form.reset(); peopleField.hidden = false; done.hidden = true; done.classList.remove('is-new'); form.hidden = false; form.elements.name.focus();
  });
}

function render({ slug, site, model, photos }) {
  const couple = site.couple || 'Os noivos';
  const [n1, n2] = splitCouple(couple);
  const ctx = {
    site, slug, model, photos, couple, n1, n2,
    ev: eventInfo(site, 'site'),
    t: key => custom(site, key),
    hasLista: Boolean(site.products?.lista),
    tones: TONES[model],
  };
  ctx.hasGifts = ctx.hasLista || Boolean(custom(site, 'pixKey'));
  document.title = `${couple} · Nosso casamento`;
  $('meta[name="theme-color"]').content = THEME[model];
  weddingPattern(DOODLE_INK[model], model === 2 ? .09 : .1);

  const main = `${heroHtml(ctx)}${ORDER[model].map(key => SECTIONS[key](ctx)).join('')}`;
  ctx.html = main;
  const app = $('#app');
  app.classList.remove('loading');
  app.removeAttribute('aria-busy');
  app.innerHTML = `${waveClipDefs()}${navHtml(ctx)}<main>${main}</main>${footerHtml(ctx)}`;
  if (!$('#toast')) document.body.insertAdjacentHTML('beforeend', '<div class="public-toast" id="toast" role="status" aria-live="polite"></div>');

  bindNav();
  bindPixCopy(app, toast);
  startCountdown(ctx.ev);
  bindTimeline();
  setupRsvp(slug, model);
  reveal(app);
  parallax(app);
  scrollProgress();
  $$('.info-card, .pix-gift', app).forEach(card => tilt(card, { max: 8, scale: 1.03 }));
  $$('.btn', app).forEach(btn => magnetic(btn, { strength: .16 }));
  $$('.sprig, .footer-art, .gift-art, .rsvp-art', app).forEach(svg => onEnter(svg, () => drawSvg(svg, { duration: 1500, stagger: 90 }), .3));
  particles = ambient(model, { layer: 'front', density: innerWidth < 640 ? .3 : .45 });

  if (reducedMotion || location.hash) {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  } else {
    document.body.insertAdjacentHTML('beforeend', introHtml(ctx));
    playIntro();
  }
}

const page = await loadProductPage('site');
if (page.site) render(page);
else renderUnavailable(document.body, page.error);
