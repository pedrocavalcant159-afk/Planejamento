import { loadProductPage, eventInfo, submitRsvp, mapsUrl, mapsEmbedUrl, calendarUrl, countdownParts, renderUnavailable, esc } from './lib/site.js';
import { dateLong } from './lib/catalog.js';
import { ambient, confetti, splitText, reveal, tilt, magnetic, tick, scrollProgress, buzz, reducedMotion } from './lib/fx.js';

const app = document.getElementById('app');
const EASE = 'cubic-bezier(.2,.8,.2,1)';
let toastTimer;
let fxAmbient = { stop() {}, burst() {} };

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

const wait = ms => new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : ms));
function splitCouple(couple = '') {
  const parts = String(couple).split(/\s+(?:&|e)\s+|\s*&\s*/i).map(p => p.trim()).filter(Boolean);
  return [parts[0] || couple, parts.slice(1).join(' & ')];
}
const initial = name => (name || '').trim().charAt(0).toUpperCase();
const formatTime = time => {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
};
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

/* Ornaments ---------------------------------------------------------------- */

// Galho com folhas ao longo de uma curva de Bézier (modelo Jardim).
function branch(className = '', leaves = 9) {
  const p = [[10, 52], [70, 14], [170, 14], [230, 44]];
  const at = t => {
    const u = 1 - t;
    const x = u ** 3 * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t ** 3 * p[3][0];
    const y = u ** 3 * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t ** 3 * p[3][1];
    const dx = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]);
    const dy = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1]);
    return { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI };
  };
  let shapes = '';
  for (let i = 0; i < leaves; i++) {
    const t = 0.08 + i * (0.84 / (leaves - 1)), { x, y, angle } = at(t), side = i % 2 ? 1 : -1;
    const rad = (angle + 90 * side) * Math.PI / 180, ox = x + Math.cos(rad) * 7, oy = y + Math.sin(rad) * 7;
    shapes += `<ellipse cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" rx="11" ry="4.2" transform="rotate(${(angle + 38 * side).toFixed(1)} ${ox.toFixed(1)} ${oy.toFixed(1)})" opacity="${i % 3 ? .55 : .85}"/>`;
  }
  const tip = at(1);
  shapes += `<ellipse cx="${tip.x + 6}" cy="${tip.y + 2}" rx="10" ry="4" transform="rotate(${tip.angle.toFixed(1)} ${tip.x + 6} ${tip.y + 2})" opacity=".8"/>`;
  return `<svg class="orn branch ${className}" viewBox="0 0 250 70" aria-hidden="true"><path d="M10 52 C70 14 170 14 230 44" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><g fill="currentColor">${shapes}</g></svg>`;
}

// Flor de cinco pétalas (modelo Rosé).
function flower(cx, cy, r, tone = 'light') {
  let petals = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * Math.PI / 180;
    petals += `<circle cx="${(cx + Math.cos(a) * r * .55).toFixed(1)}" cy="${(cy + Math.sin(a) * r * .55).toFixed(1)}" r="${(r * .5).toFixed(1)}"/>`;
  }
  return `<g class="petals petals-${tone}">${petals}</g><circle class="flower-center" cx="${cx}" cy="${cy}" r="${(r * .28).toFixed(1)}"/>`;
}
const leaf = (cx, cy, angle, size = 14) => `<ellipse class="leaf" cx="${cx}" cy="${cy}" rx="${size}" ry="${(size * .42).toFixed(1)}" transform="rotate(${angle} ${cx} ${cy})"/>`;
function bouquet(className = '') {
  return `<svg class="orn bouquet ${className}" viewBox="0 0 200 120" aria-hidden="true">
    ${leaf(46, 78, -28, 20)}${leaf(154, 78, 28, 20)}${leaf(70, 98, 20, 16)}${leaf(130, 98, -20, 16)}${leaf(100, 30, 90, 14)}
    ${flower(100, 66, 34, 'dark')}${flower(58, 58, 22, 'light')}${flower(142, 58, 22, 'light')}${flower(78, 94, 13, 'mid')}${flower(122, 94, 13, 'mid')}
    <g class="buds"><circle cx="28" cy="58" r="4"/><circle cx="172" cy="58" r="4"/><circle cx="100" cy="18" r="3.5"/><circle cx="36" cy="92" r="3"/><circle cx="164" cy="92" r="3"/></g>
  </svg>`;
}
const singleFlower = () => `<svg class="orn mini-flower" viewBox="0 0 120 30" aria-hidden="true"><path d="M4 15H44M76 15H116" stroke="currentColor" stroke-width="1"/>${leaf(50, 18, -25, 7)}${leaf(70, 18, 25, 7)}${flower(60, 13, 10, 'dark')}</svg>`;

// Leque art déco (modelo Gala).
function decoFan(className = '') {
  let rays = '';
  for (let a = 195; a <= 345; a += 15) {
    const r = a * Math.PI / 180;
    rays += `M${(100 + Math.cos(r) * 22).toFixed(1)} ${(96 + Math.sin(r) * 22).toFixed(1)}L${(100 + Math.cos(r) * 86).toFixed(1)} ${(96 + Math.sin(r) * 86).toFixed(1)}`;
  }
  return `<svg class="orn deco deco-fan ${className}" viewBox="0 0 200 100" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 96A86 86 0 0 1 186 96"/><path d="M42 96A58 58 0 0 1 158 96"/><path d="${rays}"/><path d="M78 96A22 22 0 0 1 122 96"/><path d="M4 96H196"/><path d="M100 64 106 74 100 84 94 74Z"/></svg>`;
}
// Canto escalonado art déco.
const decoCorner = (className = '') => `<svg class="orn deco deco-corner ${className}" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1"><path d="M2 62V2H62"/><path d="M9 62V9H62"/><path d="M16 44V16H44"/><path d="M16 30H30V16"/><path d="M23 23 27 27"/></svg>`;
const decoDivider = () => `<svg class="orn deco deco-divider" viewBox="0 0 260 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1"><path d="M0 12H100M160 12H260"/><path d="M106 12H114M146 12H154"/><path d="M130 1 141 12 130 23 119 12Z"/><path d="M130 6 136 12 130 18 124 12Z"/></svg>`;
const corners = cls => ['tl', 'tr', 'bl', 'br'].map(c => `<span class="${cls} ${cls}-${c}" aria-hidden="true">${decoCorner()}</span>`).join('');

// Céu noturno com estrelas cintilando (modelo Gala).
function starsHtml(count = 70) {
  let stars = '';
  for (let i = 0; i < count; i++) {
    const big = Math.random() < .12;
    stars += `<i class="${big ? 'spark' : ''}" style="left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;--s:${big ? 3 : (Math.random() * 1.6 + .8).toFixed(1)}px;--t:${(Math.random() * 3 + 2.4).toFixed(1)}s;--dl:${(-Math.random() * 5).toFixed(1)}s"></i>`;
  }
  return `<div class="stars" aria-hidden="true">${stars}</div>`;
}

function divider(model) {
  if (model === 2) return `<div class="divider" data-fx="line">${singleFlower()}</div>`;
  if (model === 3) return `<div class="divider" data-fx="line">${decoDivider()}</div>`;
  return `<div class="divider" data-fx="line">${branch('mini', 5)}</div>`;
}

// Faz um SVG "crescer": traços se desenham e folhas/flores brotam (preserva o rotate() do atributo).
function growSvg(svg, { delay = 0, duration = 1300, stagger = 55 } = {}) {
  if (!svg || reducedMotion || svg.dataset.grown) return;
  svg.dataset.grown = '1';
  [...svg.querySelectorAll('path, line')].filter(el => getComputedStyle(el).stroke !== 'none').forEach((el, i) => {
    const len = el.getTotalLength();
    if (!len) return;
    el.style.strokeDasharray = len;
    el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay: delay + i * 120, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
  });
  const pops = [...svg.querySelectorAll('ellipse, circle, g.petals')].filter(el => !el.parentElement.closest('g.petals'));
  pops.forEach((el, i) => {
    const rot = /rotate\(\s*(-?[\d.]+)/.exec(el.getAttribute('transform') || ''), base = rot ? `rotate(${rot[1]}deg) ` : '';
    const petal = el.matches('g.petals');
    el.style.transformBox = 'fill-box';
    el.style.transformOrigin = 'center';
    const animation = el.animate([
      { opacity: 0, transform: `${base}scale(0) rotate(${petal ? -140 : -35}deg)` },
      { opacity: 1, transform: `${base}scale(1.16) rotate(5deg)`, offset: .7 },
      { opacity: 1, transform: `${base}scale(1) rotate(0deg)` },
    ], { duration: petal ? 1150 : 650, delay: delay + duration * .3 + i * stagger, easing: EASE, fill: 'backwards' });
    animation.onfinish = () => { el.style.transformBox = ''; el.style.transformOrigin = ''; };
  });
}

/* Templates ---------------------------------------------------------------- */

function namesHtml(model, n1, n2) {
  const part = (text, cls = '') => `<span class="name-line ${cls}${model === 3 ? ' gold-text' : ''}">${esc(text)}</span>`;
  return `<h1 class="names display" tabindex="-1" aria-label="${esc(n2 ? `${n1} e ${n2}` : n1)}">${part(n1)}${n2 ? `${part('&', 'amp')}${part(n2)}` : ''}</h1>`;
}

function heroHtml(model, { n1, n2, ev }) {
  const names = namesHtml(model, n1, n2);
  const month = ev.date ? new Date(`${ev.date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' }) : '';
  const dateLine = ev.date ? `<p class="hero-date"><span>${esc(ev.date.slice(8, 10))}</span><i></i><span>${esc(month)}</span><i></i><span>${esc(ev.date.slice(0, 4))}</span></p>` : '';
  if (model === 3) {
    return `<header class="hero">
      ${decoFan('hero-fan')}
      <p class="eyebrow"><span class="eyebrow-rule"></span>Chá de Panela<span class="eyebrow-rule"></span></p>
      ${names}
      <p class="lead">convidam você para uma celebração inesquecível</p>
      ${dateLine}
    </header>`;
  }
  if (model === 2) {
    return `<header class="hero">
      <p class="eyebrow">Chá de Panela</p>
      ${names}
      <p class="lead">Com muito carinho, convidamos você para o nosso chá de panela</p>
      ${dateLine}
    </header>`;
  }
  return `<header class="hero">
    ${branch('hero-branch')}
    <p class="eyebrow">Chá de Panela</p>
    ${names}
    <p class="lead">convidam você para celebrar o início da nossa casa</p>
    ${dateLine}
    ${branch('hero-branch flip')}
  </header>`;
}

function introHtml(model, { n1, n2, couple }) {
  const seal = n2 ? `${esc(initial(n1))}<span>&amp;</span>${esc(initial(n2))}` : esc(initial(n1));
  const ornaments = model === 1
    ? `<div class="intro-orn intro-orn-a"><div class="sway">${branch()}</div></div><div class="intro-orn intro-orn-b"><div class="sway sway-late">${branch()}</div></div><div class="intro-orn intro-orn-c"><div class="sway">${branch('', 7)}</div></div>`
    : model === 2 ? `<div class="intro-orn intro-orn-a"><div class="drift">${bouquet()}</div></div><div class="intro-orn intro-orn-b"><div class="drift drift-late">${bouquet()}</div></div>`
      : `<span class="sunburst" aria-hidden="true"></span>${corners('intro-corner')}<div class="intro-fan">${decoFan()}</div>`;
  return `<section class="intro" id="intro">
    <span class="intro-glow" aria-hidden="true"></span>
    ${ornaments}
    <p class="intro-kicker">Você recebeu um convite</p>
    <div class="envelope-stage">
      <div class="envelope-float">
        <button class="envelope" id="envelope" type="button" aria-expanded="false" aria-controls="invite" aria-label="Abrir o convite de ${esc(couple)}">
          <span class="env-back"></span>
          <span class="env-letter"><span class="env-letter-kicker">Chá de Panela</span><span class="env-letter-names">${esc(couple)}</span></span>
          <span class="env-front"></span>
          <svg class="env-lines" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 150 116 300 0M0 200 124 92M300 200 176 92" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>
          <span class="env-flap"></span>
          <span class="seal-pulse" aria-hidden="true"></span>
          <span class="env-seal" aria-hidden="true"><span class="seal-text">${seal}</span><span class="seal-shine"></span></span>
        </button>
      </div>
      <span class="envelope-shadow" aria-hidden="true"></span>
    </div>
    <p class="intro-hint"><span class="tap-dot" aria-hidden="true"></span><span class="hint-text">Toque no envelope para abrir</span></p>
    <p class="intro-from">com carinho, ${esc(couple)}</p>
  </section>`;
}

function inviteHtml(model, ctx) {
  const { ev, site, slug, couple } = ctx;
  const hasPlace = Boolean(ev.venue || ev.address);
  const calUrl = calendarUrl({ title: `Chá de Panela · ${couple}`, ...ev });
  const embed = mapsEmbedUrl(ev);
  const people = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? 'pessoas' : 'pessoa'}</option>`).join('');
  const units = [['days', 'dias', '0'], ['hours', 'horas', '00'], ['minutes', 'min', '00'], ['seconds', 'seg', '00']];
  const sideOrnaments = model === 1
    ? `<div class="invite-orn invite-orn-a" aria-hidden="true"><div class="sway">${branch('', 7)}</div></div><div class="invite-orn invite-orn-b" aria-hidden="true"><div class="sway sway-late">${branch('', 7)}</div></div>`
    : model === 2 ? `<div class="invite-orn invite-orn-a" aria-hidden="true"><div class="drift">${bouquet()}</div></div><div class="invite-orn invite-orn-b" aria-hidden="true"><div class="drift drift-late">${bouquet()}</div></div>` : '';
  return `<main class="invite" id="invite" hidden>
    ${sideOrnaments}
    <article class="card">
      ${model === 2 ? bouquet('card-bouquet') : ''}
      ${model === 3 ? corners('card-corner') : ''}
      ${heroHtml(model, ctx)}
      <section class="countdown-block" id="countdown-block" aria-label="Contagem regressiva">
        <p class="section-kicker">Faltam</p>
        <div class="countdown" id="countdown">
          ${units.map(([unit, label, zero], i) => `<div class="cd-unit" style="--n:${i}"><strong data-unit="${unit}">${zero}</strong><span>${label}</span></div>`).join('')}
        </div>
        <p class="countdown-today" id="countdown-today" hidden>É hoje! Esperamos você ♡</p>
      </section>
      ${divider(model)}
      <section class="details" aria-label="Detalhes do chá de panela" data-fx-stagger="up">
        <div class="detail"><span class="detail-label">Data</span><strong>${esc(dateLong(ev.date, true))}</strong></div>
        ${ev.time ? `<div class="detail"><span class="detail-label">Horário</span><strong>às ${esc(formatTime(ev.time))}</strong></div>` : ''}
        ${hasPlace ? `<div class="detail"><span class="detail-label">Local</span><strong>${esc(ev.venue || ev.address)}</strong>${ev.venue && ev.address ? `<small>${esc(ev.address)}</small>` : ''}</div>` : ''}
      </section>
      ${embed ? `<figure class="map-frame" data-fx="${model === 3 ? 'up' : 'scale'}"><div class="map-window"><iframe src="${esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa do local do chá" allowfullscreen></iframe></div><figcaption>${model === 1 ? branch('map-leaf', 4) : model === 2 ? singleFlower() : ''}<span>${esc(ev.venue || 'Local do chá')}</span></figcaption></figure>` : ''}
      <div class="detail-actions" data-fx="up">
        ${hasPlace ? `<a class="btn btn-ghost" href="${esc(mapsUrl(ev))}" target="_blank" rel="noopener">Como chegar</a>` : ''}
        ${calUrl ? `<a class="btn btn-ghost" href="${esc(calUrl)}" target="_blank" rel="noopener">Salvar na agenda</a>` : ''}
      </div>
      ${divider(model)}
      <section class="rsvp" aria-labelledby="rsvp-title" data-fx-stagger="up">
        <h2 class="section-title display" id="rsvp-title">Confirme sua presença</h2>
        <p class="section-text">Sua resposta ajuda o casal a preparar tudo com carinho.</p>
        <form class="rsvp-form" id="rsvp-form" novalidate>
          <label class="field">Seu nome<input name="name" maxlength="80" autocomplete="name" required /></label>
          <fieldset class="choice">
            <legend>Você vai?</legend>
            <label><input type="radio" name="attending" value="sim" checked /><span><i class="choice-ic" aria-hidden="true">♥</i>Vou sim!</span></label>
            <label><input type="radio" name="attending" value="nao" /><span><i class="choice-ic" aria-hidden="true">✕</i>Não poderei ir</span></label>
          </fieldset>
          <label class="field" id="people-field">Quantas pessoas, contando você<select name="people">${people}</select></label>
          <label class="field"><span>Recado para o casal <em>(opcional)</em></span><textarea name="message" maxlength="500" placeholder="Deixe uma mensagem de carinho"></textarea></label>
          <p class="form-error" id="form-error" role="alert"></p>
          <button class="btn btn-shine" type="submit">Confirmar presença</button>
        </form>
        <div class="rsvp-done" id="rsvp-done" hidden tabindex="-1">
          <span class="done-mark" aria-hidden="true">♥</span>
          <h3 class="display" id="done-title"></h3>
          <p id="done-text"></p>
          <button class="link-button" type="button" id="rsvp-again">Enviar outra resposta</button>
        </div>
      </section>
      ${site.products?.lista ? `${divider(model)}<section class="gifts" data-fx-stagger="up"><h2 class="section-title display">Lista de presentes</h2><p class="section-text">Se quiser presentear, preparamos uma lista com o que vai fazer parte da nossa casa.</p><a class="btn btn-shine" href="lista.html?c=${encodeURIComponent(slug)}">Ver lista de presentes</a></section>` : ''}
      <footer class="card-footer" data-fx="blur"><span class="script">com carinho,</span><strong class="display">${esc(couple)}</strong></footer>
    </article>
  </main>`;
}

/* Behaviour ---------------------------------------------------------------- */

function startCountdown(ev) {
  const block = document.getElementById('countdown-block');
  let first = true;
  const update = () => {
    const parts = countdownParts(ev.date, ev.time);
    if (!parts) {
      document.getElementById('countdown').hidden = true;
      if (ev.date === todayIso()) document.getElementById('countdown-today').hidden = false;
      else block.hidden = true;
      return false;
    }
    for (const [unit, value] of Object.entries(parts)) {
      const el = block.querySelector(`[data-unit="${unit}"]`), text = unit === 'days' ? String(value) : String(value).padStart(2, '0');
      if (first) el.textContent = text; else tick(el, text);
    }
    first = false;
    return true;
  };
  if (update()) setInterval(update, 1000);
}

function setupRsvp(slug, model) {
  const form = document.getElementById('rsvp-form'), done = document.getElementById('rsvp-done'), error = document.getElementById('form-error');
  const peopleField = document.getElementById('people-field');
  const storageKey = `convite-rsvp-${slug}`;
  const showDone = ({ name, attending }, celebrate = false) => {
    const first = String(name).trim().split(/\s+/)[0];
    document.getElementById('done-title').textContent = attending ? 'Presença confirmada!' : 'Resposta enviada';
    document.getElementById('done-text').textContent = attending ? `Obrigado, ${first}! Vai ser lindo ter você com a gente.` : `Obrigado por avisar, ${first}. Você vai fazer falta!`;
    form.hidden = true; done.hidden = false;
    done.classList.toggle('is-new', celebrate);
    done.classList.toggle('is-yes', Boolean(attending));
  };
  try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.name) showDone(saved); } catch {}

  const togglePeople = show => {
    if (show === !peopleField.hidden) return;
    if (show) {
      peopleField.hidden = false;
      if (!reducedMotion) peopleField.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
    } else if (reducedMotion) peopleField.hidden = true;
    else peopleField.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 220, easing: 'ease-in' }).onfinish = () => { peopleField.hidden = true; };
  };
  form.querySelectorAll('.choice input').forEach(input => input.addEventListener('change', () => {
    const yes = input.value === 'sim';
    togglePeople(yes);
    const label = input.nextElementSibling;
    label.classList.remove('just-picked'); void label.offsetWidth; label.classList.add('just-picked');
    if (yes) { const [x, y] = centerOf(label); fxAmbient.burst(x, y, 14); buzz(12); }
  }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = form.elements.name.value.trim(), attending = form.elements.attending.value === 'sim';
    error.textContent = '';
    if (name.length < 2) {
      error.textContent = 'Digite seu nome para confirmar.';
      form.elements.name.focus();
      if (!reducedMotion) form.elements.name.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 380 });
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Enviando...';
    try {
      await submitRsvp(slug, { name, attending, people: attending ? Number(form.elements.people.value) : 0, message: form.elements.message.value, product: 'convite' });
      try { localStorage.setItem(storageKey, JSON.stringify({ name, attending })); } catch {}
      showDone({ name, attending }, true);
      done.focus();
      if (attending) { confetti(done.querySelector('.done-mark'), model); buzz([20, 40, 30]); }
    } catch (err) {
      console.error('Falha ao confirmar presença:', err);
      error.textContent = 'Não foi possível enviar agora. Verifique sua conexão e tente de novo.';
    } finally {
      button.disabled = false; button.textContent = 'Confirmar presença';
    }
  });
  document.getElementById('rsvp-again').addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); } catch {}
    form.reset(); peopleField.hidden = false; done.hidden = true; done.classList.remove('is-new'); form.hidden = false; form.elements.name.focus();
  });
}

// Revela o convite em sequência: cartão, nomes, ornamentos, data e contagem.
function revealInvite(model, invite) {
  invite.classList.add('is-revealed');
  const names = invite.querySelector('.names');
  const lines = [...names.querySelectorAll('.name-line')];
  if (model === 1 && !reducedMotion) {
    let at = 520;
    lines.forEach(line => {
      if (line.classList.contains('amp')) { line.style.animationDelay = `${at}ms`; at += 260; return; }
      const { count } = splitText(line, { delay: at, stagger: 55 });
      line.classList.add('fx-play');
      at += count * 55 + 180;
    });
    invite.querySelectorAll('.hero-branch').forEach((svg, i) => growSvg(svg, { delay: 250 + i * 700 }));
  }
  if (model !== 1) lines.forEach((line, i) => line.style.setProperty('--d', `${450 + i * (model === 2 ? 520 : 420)}ms`));
  if (model === 3) {
    growSvg(invite.querySelector('.hero-fan'), { delay: 200, duration: 1500 });
    invite.querySelectorAll('.card-corner svg').forEach((svg, i) => growSvg(svg, { delay: 500 + i * 120, duration: 1100 }));
  }
  if (model === 2) growSvg(invite.querySelector('.card-bouquet'), { delay: 150, stagger: 65 });
  invite.querySelectorAll('.invite-orn svg').forEach((svg, i) => (model === 2 ? growSvg(svg, { delay: 900 + i * 400, stagger: 40 }) : growSvg(svg, { delay: 600 + i * 500 })));

  // O que já está na tela espera o herói terminar; o resto aparece ao rolar.
  invite.querySelectorAll('[data-fx-stagger]').forEach(parent => [...parent.children].forEach(child => child.setAttribute('data-fx', parent.dataset.fxStagger)));
  invite.querySelectorAll('[data-fx]').forEach(el => { if (el.getBoundingClientRect().top < innerHeight) el.style.setProperty('--fx-d', '1900ms'); });
  reveal(invite);

  // Divisores crescem quando aparecem.
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      growSvg(entry.target.querySelector('svg'), { delay: 150, duration: 900, stagger: 60 });
      io.unobserve(entry.target);
    }), { threshold: .6 });
    invite.querySelectorAll('.divider').forEach(d => io.observe(d));
  }

  invite.querySelectorAll('.btn').forEach(btn => magnetic(btn, { strength: .18 }));
  invite.querySelectorAll('.cd-unit').forEach(unit => tilt(unit, { max: 14, scale: 1.05 }));
  scrollProgress();
}

// Troca as partículas da abertura por uma versão mais suave para a leitura do convite.
function softenAmbient(model) {
  if (reducedMotion) return;
  const previous = fxAmbient, oldCanvas = document.querySelector('.fx-ambient');
  if (oldCanvas) { oldCanvas.style.transition = 'opacity 1.6s ease'; oldCanvas.style.opacity = '0'; }
  setTimeout(() => previous.stop(), 1700);
  fxAmbient = ambient(model, { density: .45 });
  const fresh = [...document.querySelectorAll('.fx-ambient')].pop();
  if (fresh && fresh !== oldCanvas) {
    fresh.style.opacity = '0';
    fresh.style.transition = 'opacity 2.2s ease';
    requestAnimationFrame(() => requestAnimationFrame(() => { fresh.style.opacity = '1'; }));
  }
}

function setupIntro(model) {
  const envelope = document.getElementById('envelope'), intro = document.getElementById('intro'), invite = document.getElementById('invite');
  tilt(envelope, { max: 10, scale: 1.03 });
  intro.addEventListener('pointermove', event => {
    intro.style.setProperty('--gx', `${event.clientX}px`);
    intro.style.setProperty('--gy', `${event.clientY}px`);
  });

  const finish = () => {
    invite.hidden = false;
    intro.hidden = true;
    document.body.classList.remove('is-locked');
    window.scrollTo(0, 0);
    revealInvite(model, invite);
    invite.querySelector('.names')?.focus({ preventScroll: true });
  };

  envelope.addEventListener('click', async () => {
    envelope.setAttribute('aria-expanded', 'true');
    buzz(25);
    if (reducedMotion) { finish(); return; }
    intro.classList.add('is-opening');
    envelope.classList.add('seal-break');
    const [sx, sy] = centerOf(envelope.querySelector('.env-seal'));
    fxAmbient.burst(sx, sy, 26);
    await wait(380);
    envelope.classList.add('is-open');
    await wait(1250);

    // A carta cresce até cobrir a tela e vira o convite.
    const letter = envelope.querySelector('.env-letter'), r = letter.getBoundingClientRect();
    const paper = document.createElement('div');
    paper.className = 'paper-zoom';
    document.body.appendChild(paper);
    paper.animate([
      { transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / innerWidth}, ${r.height / innerHeight})`, opacity: .4 },
      { opacity: 1, offset: .2 },
      { transform: 'none', opacity: 1 },
    ], { duration: 820, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'both' });
    fxAmbient.burst(innerWidth / 2, innerHeight / 2, 50);
    buzz(15);
    await wait(800);
    finish();
    paper.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 750, easing: 'ease-out', fill: 'both' }).onfinish = () => paper.remove();
    setTimeout(() => softenAmbient(model), 2400);
  }, { once: true });
}

async function main() {
  const { slug, site, model, error } = await loadProductPage('convite');
  app.classList.remove('loading');
  app.removeAttribute('aria-busy');
  if (!site) { document.body.classList.remove('is-locked'); renderUnavailable(app, error); return; }
  const couple = site.couple || 'Os noivos';
  const [n1, n2] = splitCouple(couple);
  const ev = eventInfo(site, 'convite');
  const ctx = { site, slug, model, couple, n1, n2, ev };
  document.title = `Chá de Panela · ${couple}`;
  app.innerHTML = introHtml(model, ctx) + inviteHtml(model, ctx);
  fxAmbient = ambient(model, { density: model === 3 ? 1.3 : 1 });
  if (model === 1) document.querySelectorAll('.intro-orn svg').forEach((svg, i) => growSvg(svg, { delay: 200 + i * 350 }));
  if (model === 2) document.querySelectorAll('.intro-orn svg').forEach((svg, i) => growSvg(svg, { delay: 250 + i * 450, stagger: 45 }));
  if (model === 3) {
    document.body.insertAdjacentHTML('afterbegin', starsHtml(innerWidth < 600 ? 45 : 80));
    document.querySelectorAll('.intro-corner svg').forEach((svg, i) => growSvg(svg, { delay: 150 + i * 140, duration: 1200 }));
    growSvg(document.querySelector('.intro-fan svg'), { delay: 700, duration: 1600 });
  }
  setupIntro(model);
  startCountdown(ev);
  setupRsvp(slug, model);
}

main().catch(err => {
  console.error(err);
  app.classList.remove('loading');
  document.body.classList.remove('is-locked');
  renderUnavailable(app, err);
  toast('Não foi possível carregar o convite.');
});
