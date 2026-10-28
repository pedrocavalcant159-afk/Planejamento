import { loadProductPage, eventInfo, submitRsvp, mapsUrl, mapsEmbedUrl, calendarUrl, countdownParts, renderUnavailable, esc } from './lib/site.js';
import { dateLong } from './lib/catalog.js';
import { custom, customList } from './lib/content.js';
import { doodle, applyDoodlePattern, tornEdge, cuttingBoard, sprig, appButtons, appIcon, sticker, roundPhoto, wavyPhoto, polaroid, coverPhoto, gallery, waveClipDefs, bill, seal, initialsOf, splitCouple, paletteHtml, pixHtml, bindPixCopy } from './lib/decor.js';
import { ambient, confetti, reveal, tilt, magnetic, tick, scrollProgress, buzz, reducedMotion } from './lib/fx.js';

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
const formatTime = time => {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
};
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const dateParts = iso => {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return { day: d.getDate(), month: d.toLocaleDateString('pt-BR', { month: 'long' }), monthShort: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), weekday: d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0], year: d.getFullYear() };
};

/* Pequenos desenhos dos rostos do modelo Oliva: véu e gravata-borboleta. */
const veil = '<svg class="face-veil" viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M38 22c8-14 36-14 44 0"/><path d="M36 24C14 44 10 84 22 112M84 24c22 20 26 60 14 88"/><path d="M30 60c-4 18-2 36 4 50M90 60c4 18 2 36-4 50"/><path d="M46 14l4-8 6 6 4-9 4 9 6-6 4 8"/></svg>';
const bowTie = '<svg class="face-bow" viewBox="0 0 64 32" aria-hidden="true"><path d="M30 16 4 4v24zM34 16 60 4v24z" fill="currentColor"/><rect x="27" y="10" width="10" height="12" rx="3" fill="currentColor"/></svg>';

/* Partes do convite --------------------------------------------------------- */

function heroHtml(ctx) {
  const { model, photos, n1, n2, ev, t } = ctx;
  const names = n2 ? `${n1} e ${n2}` : n1;
  const parts = dateParts(ev.date);
  const time = formatTime(ev.time);
  const place = ev.venue || ev.address;
  const pin = `<span class="pin">${appIcon('local')}</span>`;
  const faces = `${sticker(photos.ela, n1, 'face face-1')}${sticker(photos.ele, n2 || n1, 'face face-2')}`;
  const hasFaces = Boolean(photos.ela || photos.ele);

  if (model === 1) {
    return `<header class="hero">
      <div class="hero-band">
        ${doodle('pote', 'hd hd-a')}${doodle('panelas', 'hd hd-b')}${doodle('batedor', 'hd hd-c')}
        <p class="kicker">Você está convidado para o nosso</p>
        <h1 class="hero-title display" tabindex="-1">${esc(t('chaTitle'))}</h1>
        <p class="hero-names">${esc(names)}</p>
        <div class="hero-faces">${hasFaces ? faces : doodle('panela', 'hero-pot')}</div>
        ${tornEdge('hero-torn', 11)}
      </div>
      <div class="hero-when">
        <p class="hero-date display">${esc(ev.date ? dateLong(ev.date) : 'Data a definir')}</p>
        ${time ? `<p class="hero-time">a partir das ${esc(time)}</p>` : ''}
        ${place ? `<a class="place-pill" href="${esc(mapsUrl(ev))}" target="_blank" rel="noopener">${pin}<span>${esc([ev.venue, ev.address].filter(Boolean).join(' · '))}</span></a>` : ''}
        <p class="hero-lead">${esc(t('chaLead'))}</p>
      </div>
    </header>`;
  }
  if (model === 2) {
    return `<header class="hero doodle-bg">
      <div class="hero-faces">${hasFaces ? faces : `<span class="face-fallback">${doodle('panela')}</span>`}</div>
      <p class="kicker">com muito carinho</p>
      <h1 class="hero-title display" tabindex="-1">${esc(t('chaTitle'))}</h1>
      <p class="hero-names script">${esc(n2 ? `${n1} & ${n2}` : n1)}</p>
      <p class="hero-lead">${esc(t('chaLead'))}</p>
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
        ${ctx.site.custom?.verse?.trim() ? `<p class="verse">${esc(ctx.site.custom.verse.trim())}</p>` : ''}
        <h1 class="hero-names script" tabindex="-1">${esc(n1)}${n2 ? ` <span class="amp">&</span> ${esc(n2)}` : ''}</h1>
        <p class="hero-invite display">convidam para o seu ${esc(t('chaTitle').toLowerCase())}, a realizar-se em</p>
        ${parts ? `<div class="date-block"><span class="date-month display">${esc(parts.month)}</span><div class="date-row"><span class="display">${esc(parts.weekday)}</span><strong class="display">${parts.day}</strong><span class="display">${time ? `às ${esc(ev.time)}` : esc(String(parts.year))}</span></div><span class="date-year display">${parts.year}</span></div>` : '<p class="date-tbd display">Data a definir</p>'}
        ${place ? `<a class="btn place-btn" href="${esc(mapsUrl(ev))}" target="_blank" rel="noopener">${pin}Como chegar</a><p class="venue-line display">${esc([ev.venue, ev.address].filter(Boolean).join(' | '))}</p>` : ''}
      </div>
      ${sprig('hero-sprig hs-a')}${sprig('hero-sprig hs-b')}
    </header>`;
  }
  return `<header class="hero">
    ${doodle('pote', 'hd hd-a')}${doodle('panelas', 'hd hd-b')}
    <h1 class="title-stack" tabindex="-1"><span class="title-pre script">o nosso</span><span class="title-big display">${esc(t('chaTitle'))}</span><span class="title-names script">${esc(names)}</span></h1>
    <div class="hero-faces">${hasFaces ? `<span class="face-wrap fw-1">${photos.ela ? veil : ''}${sticker(photos.ela, n1, 'face')}</span><span class="face-wrap fw-2">${sticker(photos.ele, n2 || n1, 'face')}${photos.ele ? bowTie : ''}</span>` : doodle('panela', 'hero-pot')}</div>
    ${parts ? cuttingBoard(`${parts.day} de ${parts.monthShort}`, time ? `às ${time}` : '') : ''}
    ${place ? `<p class="hero-address">${esc([ev.venue, ev.address].filter(Boolean).join(', '))}</p>` : ''}
    <div class="utensil-row">${['batedor', 'xicara', 'rolo', 'colher', 'chaleira', 'talheres', 'luva'].map(n => doodle(n)).join('')}</div>
  </header>`;
}

function buttonsHtml(ctx) {
  const items = [
    { icon: 'presenca', label: 'Confirmar presença', href: '#rsvp' },
    ...(ctx.hasLista ? [{ icon: 'presente', label: 'Lista de presentes', href: `lista.html?c=${encodeURIComponent(ctx.slug)}` }] : []),
    ...(ctx.ev.venue || ctx.ev.address ? [{ icon: 'local', label: 'Ver localização', href: '#local' }] : []),
    ...(ctx.roteiro.length && ctx.model === 3 ? [{ icon: 'roteiro', label: 'Informações importantes', href: '#roteiro' }] : []),
  ];
  const head = ctx.model === 3 ? '<p class="block-kicker display">Clique nos botões</p><p class="block-script script">para interagir</p>' : ctx.model === 2 ? '<p class="block-kicker">Acesse as informações abaixo</p>' : '';
  return `<section class="block block-buttons" data-fx="up"><div class="buttons-card">${head}${appButtons(items)}</div></section>`;
}

function welcomeHtml(ctx) {
  const { model, photos, t, couple } = ctx;
  const capa = photos.capa;
  const photo = model === 1 ? roundPhoto(capa, `Foto de ${couple}`, 'welcome-photo')
    : model === 2 ? polaroid(capa, '', 'welcome-photo', 4)
      : model === 4 ? wavyPhoto(capa, `Foto de ${couple}`, 'welcome-photo') : '';
  return `<section class="block block-welcome${photo ? ' has-photo' : ''}" data-fx-stagger="up">
    <div class="welcome-text"><h2 class="block-title display">${esc(t('welcomeTitle'))}</h2><p>${esc(t('welcome'))}</p></div>
    ${photo}
  </section>`;
}

function countdownHtml(ctx) {
  const units = [['days', 'dias', '0'], ['hours', 'horas', '00'], ['minutes', 'minutos', '00'], ['seconds', 'segundos', '00']];
  return `<section class="block block-countdown" id="countdown-block" aria-label="Contagem regressiva" data-fx="up">
    <p class="block-kicker display">Esperamos por você!</p>
    <p class="block-script script">Faltam</p>
    <div class="countdown" id="countdown">${units.map(([unit, label, zero], i) => `<div class="cd-unit" style="--n:${i}"><strong data-unit="${unit}">${zero}</strong><span>${label}</span></div>`).join('<span class="cd-sep" aria-hidden="true">:</span>')}</div>
    <p class="countdown-today" id="countdown-today" hidden>É hoje! Esperamos você ♡</p>
  </section>`;
}

function localHtml(ctx) {
  const { ev, couple } = ctx;
  const hasPlace = Boolean(ev.venue || ev.address);
  const embed = mapsEmbedUrl(ev);
  const calUrl = calendarUrl({ title: `${custom(ctx.site, 'chaTitle')} · ${couple}`, ...ev });
  return `<section class="block block-local" id="local" data-fx-stagger="up">
    <span class="local-pin">${appIcon('local')}</span>
    <h2 class="block-title display">Localização</h2>
    <dl class="details">
      <div><dt>Data</dt><dd>${esc(dateLong(ev.date, true))}</dd></div>
      ${ev.time ? `<div><dt>Horário</dt><dd>às ${esc(formatTime(ev.time))}</dd></div>` : ''}
      ${hasPlace ? `<div><dt>Local</dt><dd>${esc(ev.venue || ev.address)}${ev.venue && ev.address ? `<small>${esc(ev.address)}</small>` : ''}</dd></div>` : ''}
    </dl>
    ${embed ? `<div class="map-window"><iframe src="${esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa do local" allowfullscreen></iframe></div>` : ''}
    <div class="detail-actions">
      ${hasPlace ? `<a class="btn" href="${esc(mapsUrl(ev))}" target="_blank" rel="noopener">Como chegar</a>` : ''}
      ${calUrl ? `<a class="btn btn-ghost" href="${esc(calUrl)}" target="_blank" rel="noopener">Salvar na agenda</a>` : ''}
    </div>
  </section>`;
}

function roteiroHtml(ctx) {
  if (!ctx.roteiro.length) return '';
  const icons = ['xicara', 'presente', 'panelas', 'coracao', 'taca', 'casa'];
  const title = ctx.model === 1 ? 'Programação do dia' : ctx.model === 3 ? 'Informações importantes' : 'Roteiro';
  return `<section class="block block-roteiro" id="roteiro">
    <h2 class="block-title display" data-fx="up">${title}</h2>
    <ol class="roteiro" data-fx-stagger="up">${ctx.roteiro.map((item, i) => `<li><span class="r-icon">${doodle(icons[i % icons.length])}</span><span class="r-time">${esc(item.time)}</span><span class="r-text">${esc(item.text)}</span></li>`).join('')}</ol>
  </section>`;
}

function galleryHtml(ctx) {
  const html = gallery(ctx.photos);
  if (!html) return '';
  return `<section class="block block-gallery" data-fx="up"><h2 class="block-title display">Nossos momentos</h2>${html}</section>`;
}

function stepsHtml(ctx) {
  const palette = paletteHtml(ctx.palette, custom(ctx.site, 'paletteNote'));
  if (!ctx.hasLista) return palette ? `<section class="block block-palette" data-fx="up"><h2 class="block-title display">Paleta de cores</h2>${palette}</section>` : '';
  const steps = ['Escolha um presente na nossa lista', 'Toque nele e coloque o seu nome', 'Compre onde preferir', 'Leve no dia do chá ou mande entregar'];
  return `<section class="block block-steps" id="como">
    ${doodle('pote', 'steps-art')}
    <h2 class="block-title display" data-fx="up">Como fazer parte?</h2>
    <p class="block-text" data-fx="up">${esc(custom(ctx.site, 'listaIntro'))}</p>
    <ol class="steps" data-fx-stagger="up">${steps.map((s, i) => `<li><span class="step-n">${String(i + 1).padStart(2, '0')}</span><span>${s}</span></li>`).join('')}</ol>
    <a class="btn btn-shine steps-btn" data-fx="up" href="lista.html?c=${encodeURIComponent(ctx.slug)}">Clique para acessar a lista</a>
    ${palette ? `<div class="steps-palette" data-fx="up"><h3 class="palette-title display">Paleta de cores</h3>${palette}</div>` : ''}
  </section>`;
}

function pixSection(ctx) {
  const html = pixHtml({ key: custom(ctx.site, 'pixKey'), holder: custom(ctx.site, 'pixHolder'), title: custom(ctx.site, 'pixTitle'), gifts: customList(ctx.site, 'pixGifts') });
  if (!html) return '';
  const bills = ctx.model === 1 ? [8, 22, 74, 88].map((x, i) => bill('', `left:${x}%;top:${(i % 2) * 30 + 6}px;animation-delay:${-i * 1.7}s`)).join('') : '';
  return `<section class="block block-pix" data-fx="up">${bills}${html}</section>`;
}

function rsvpHtml() {
  const people = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? 'pessoas' : 'pessoa'}</option>`).join('');
  return `<section class="block block-rsvp" id="rsvp" aria-labelledby="rsvp-title" data-fx-stagger="up">
    <h2 class="block-title display" id="rsvp-title">Confirme sua presença</h2>
    <p class="block-text">Sua resposta ajuda a gente a caprichar nos quitutes e preparar tudo com carinho.</p>
    <form class="rsvp-form" id="rsvp-form" novalidate>
      <label class="field">Seu nome<input name="name" maxlength="80" autocomplete="name" required /></label>
      <fieldset class="choice">
        <legend>Você vai?</legend>
        <label><input type="radio" name="attending" value="sim" checked /><span><i class="choice-ic" aria-hidden="true">♥</i>Vou sim!</span></label>
        <label><input type="radio" name="attending" value="nao" /><span><i class="choice-ic" aria-hidden="true">✕</i>Não poderei ir</span></label>
      </fieldset>
      <label class="field" id="people-field">Quantas pessoas, contando você<select name="people">${people}</select></label>
      <label class="field"><span>Recado para o casal <em>(opcional)</em></span><textarea name="message" maxlength="500" placeholder="Um recado, um conselho ou aquela receita de família"></textarea></label>
      <p class="form-error" id="form-error" role="alert"></p>
      <button class="btn btn-shine" type="submit">Confirmar presença</button>
    </form>
    <div class="rsvp-done" id="rsvp-done" hidden tabindex="-1">
      <span class="done-mark" aria-hidden="true">♥</span>
      <h3 class="display" id="done-title"></h3>
      <p id="done-text"></p>
      <button class="link-button" type="button" id="rsvp-again">Enviar outra resposta</button>
    </div>
  </section>`;
}

function footerHtml(ctx) {
  const art = ctx.model === 3 ? sprig('footer-sprig') : doodle(ctx.model === 2 ? 'panela' : 'pote', 'footer-art');
  return `<footer class="block block-footer" data-fx="up">
    <p class="closing display">${esc(custom(ctx.site, 'closing'))}</p>
    ${art}
    <p class="footer-from"><span class="script">com carinho,</span> <strong>${esc(ctx.couple)}</strong></p>
  </footer>`;
}

const ORDER = {
  1: ['buttons', 'welcome', 'roteiro', 'gallery', 'countdown', 'local', 'steps', 'pix', 'rsvp'],
  2: ['buttons', 'gallery', 'welcome', 'countdown', 'local', 'roteiro', 'steps', 'pix', 'rsvp'],
  3: ['buttons', 'countdown', 'welcome', 'roteiro', 'gallery', 'local', 'steps', 'pix', 'rsvp'],
  4: ['buttons', 'welcome', 'roteiro', 'countdown', 'local', 'gallery', 'steps', 'pix', 'rsvp'],
};
const SECTIONS = { buttons: buttonsHtml, welcome: welcomeHtml, countdown: countdownHtml, local: localHtml, roteiro: roteiroHtml, gallery: galleryHtml, steps: stepsHtml, pix: pixSection, rsvp: rsvpHtml };

function inviteHtml(ctx) {
  return `<main class="invite" id="invite" hidden>
    ${heroHtml(ctx)}
    ${ORDER[ctx.model].map(key => SECTIONS[key](ctx)).join('')}
    ${footerHtml(ctx)}
  </main>`;
}

function introHtml(ctx) {
  const { model, couple, t } = ctx;
  const initials = initialsOf(couple);
  const ring = model === 3 ? '<svg class="seal-ring" viewBox="0 0 160 160" aria-hidden="true"><defs><path id="seal-path" d="M80 80m-62 0a62 62 0 1 1 124 0a62 62 0 1 1-124 0"/></defs><text><textPath href="#seal-path" textLength="386" lengthAdjust="spacing">Clique para abrir · Clique para abrir · </textPath></text></svg>' : '';
  return `<section class="intro${model === 2 || model === 4 ? ' doodle-bg' : ''}" id="intro">
    <span class="intro-glow" aria-hidden="true"></span>
    ${model === 1 ? `${doodle('pote', 'intro-doodle id-a')}${doodle('chaleira', 'intro-doodle id-b')}${doodle('xicara', 'intro-doodle id-c')}` : ''}
    ${model === 3 ? '' : `<p class="intro-kicker">Tem convite quentinho pra você</p>`}
    <div class="envelope-stage">
      <div class="envelope-float">
        <button class="envelope" id="envelope" type="button" aria-expanded="false" aria-controls="invite" aria-label="Abrir o convite de ${esc(couple)}">
          <span class="env-back"></span>
          <span class="env-letter">${doodle('panela', 'env-pot')}<span class="env-letter-kicker">${esc(t('chaTitle'))}</span><span class="env-letter-names">${esc(couple)}</span></span>
          <span class="env-front"></span>
          <svg class="env-lines" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 150 116 300 0M0 200 124 92M300 200 176 92" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>
          <span class="env-flap"></span>
          <span class="env-seal-wrap">${ring}<span class="seal-pulse" aria-hidden="true"></span>${seal(initials, 'env-seal')}</span>
        </button>
      </div>
      <span class="envelope-shadow" aria-hidden="true"></span>
    </div>
    ${model === 3 ? '' : '<p class="intro-hint"><span class="tap-dot" aria-hidden="true"></span><span class="hint-text">Toque no envelope para abrir</span></p>'}
    <p class="intro-from">com carinho, ${esc(couple)}</p>
  </section>`;
}

/* Comportamento ---------------------------------------------------------------- */

function startCountdown(ev) {
  const block = document.getElementById('countdown-block');
  let first = true;
  const update = () => {
    const parts = countdownParts(ev.date, ev.time);
    if (!parts) {
      document.getElementById('countdown').hidden = true;
      block.querySelector('.block-script').hidden = true;
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
    document.getElementById('done-text').textContent = attending ? `Obrigado, ${first}! Já estamos separando uma xícara pra você.` : `Obrigado por avisar, ${first}. Você vai fazer falta!`;
    form.hidden = true; done.hidden = false;
    done.classList.toggle('is-new', celebrate);
  };
  try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.name) showDone(saved); } catch {}

  const togglePeople = show => {
    if (show === !peopleField.hidden) return;
    peopleField.hidden = !show;
    if (show && !reducedMotion) peopleField.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
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

// Revela o convite: o topo entra em sequência e o resto aparece ao rolar.
function revealInvite(invite) {
  invite.classList.add('is-revealed');
  invite.querySelectorAll('[data-fx-stagger]').forEach(parent => [...parent.children].forEach(child => child.setAttribute('data-fx', parent.dataset.fxStagger)));
  invite.querySelectorAll('[data-fx]').forEach(el => { if (el.getBoundingClientRect().top < innerHeight) el.style.setProperty('--fx-d', '900ms'); });
  reveal(invite);
  invite.querySelectorAll('.btn').forEach(btn => magnetic(btn, { strength: .16 }));
  invite.querySelectorAll('.cd-unit, .pix-gift').forEach(el => tilt(el, { max: 10, scale: 1.04 }));
  scrollProgress();
}

function softenAmbient(model) {
  if (reducedMotion) return;
  const previous = fxAmbient, oldCanvas = document.querySelector('.fx-ambient');
  if (oldCanvas) { oldCanvas.style.transition = 'opacity 1.6s ease'; oldCanvas.style.opacity = '0'; }
  setTimeout(() => previous.stop(), 1700);
  fxAmbient = ambient(model, { density: .35 });
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
    revealInvite(invite);
    invite.querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
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

const DOODLE_INK = { 1: '#8a5530', 2: '#4b5a3a', 3: '#4f5b3e', 4: '#66754a' };

async function main() {
  const { slug, site, model, photos, error } = await loadProductPage('convite');
  app.classList.remove('loading');
  app.removeAttribute('aria-busy');
  if (!site) { document.body.classList.remove('is-locked'); renderUnavailable(app, error); return; }
  const couple = site.couple || 'Os noivos';
  const [n1, n2] = splitCouple(couple);
  const ctx = {
    site, slug, model, photos, couple, n1, n2,
    ev: eventInfo(site, 'convite'),
    t: key => custom(site, key),
    roteiro: customList(site, 'roteiro'),
    palette: customList(site, 'palette'),
    hasLista: Boolean(site.products?.lista),
  };
  document.title = `${ctx.t('chaTitle')} · ${couple}`;
  applyDoodlePattern(DOODLE_INK[model], model === 2 ? .09 : .1);
  app.innerHTML = waveClipDefs() + introHtml(ctx) + inviteHtml(ctx);
  bindPixCopy(app, toast);
  fxAmbient = ambient(model, { density: .8 });
  setupIntro(model);
  startCountdown(ctx.ev);
  setupRsvp(slug, model);
}

main().catch(err => {
  console.error(err);
  app.classList.remove('loading');
  document.body.classList.remove('is-locked');
  renderUnavailable(app, err);
  toast('Não foi possível carregar o convite.');
});
