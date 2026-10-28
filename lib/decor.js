// Desenhos e peças visuais compartilhadas pelo convite, lista e site (estilos em lib/decor.css).
import { esc } from './catalog.js';
import { GALLERY_SLOTS } from './content.js';

/* Desenhos de cozinha em traço (viewBox 64x64, cor = currentColor) ------- */
export const DOODLES = {
  pote: '<path d="M16 34h32"/><path d="M18 34h28l-3 21a4 4 0 0 1-4 3.5H25a4 4 0 0 1-4-3.5z"/><path d="M21 44h22"/><path d="M25 34V15"/><path d="M25 15c-3 0-4.5-3.2-4.5-6.2S22.4 2.5 25 2.5s4.5 3.3 4.5 6.3S28 15 25 15z"/><path d="M33 34V21"/><path d="M33 21c-6-4-6-15 0-17 6 2 6 13 0 17zM33 21c-2.2-4-2.2-13 0-17"/><path d="M40 34l3.5-13"/><path d="M42 21.5 39.8 12l6.8-1.8 2.2 9.5z"/>',
  panelas: '<path d="M10 42h44v11a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"/><path d="M10 46H5M54 46h5"/><path d="M17 29h30v8a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z"/><path d="M47 31h12"/><path d="M20 25c2-5 7-7 12-7s10 2 12 7"/><path d="M18 25h28"/><path d="M30 18a2 2 0 0 1 4 0"/>',
  panela: '<path d="M25 13c-2-3 2-5 0-8M32 12c-2-3 2-5 0-8M39 13c-2-3 2-5 0-8"/><path d="M29 19a3 3 0 0 1 6 0"/><path d="M14 27c2-6 9-8 18-8s16 2 18 8"/><path d="M11 27h42"/><path d="M14 31h36v13a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z"/><path d="M14 35H9a3 3 0 0 0 0 6h5M50 35h5a3 3 0 0 1 0 6h-5"/><path d="M32 47s-5-3-5-6a2.5 2.5 0 0 1 5-1 2.5 2.5 0 0 1 5 1c0 3-5 6-5 6z"/>',
  chaleira: '<path d="M14 52c0-14 6-23 18-23s18 9 18 23z"/><path d="M11 52h42"/><path d="M24 31c2-4 5-5 8-5s6 1 8 5"/><path d="M30 26a2 2 0 0 1 4 0"/><path d="M20 35c-1-15 25-15 24 0"/><path d="M48 43l8-8 2.5 2.2L52 47"/>',
  xicara: '<path d="M24 22c-2-3 2-5 0-8M32 22c-2-3 2-5 0-8"/><path d="M14 28h30v10a12 12 0 0 1-12 12h-6a12 12 0 0 1-12-12z"/><path d="M44 31h4a5 5 0 0 1 0 10h-5"/><path d="M8 55h44"/>',
  rolo: '<path d="M21 51 13 43l27-27 8 8z"/><path d="M13 43 6 50M48 24l7-7"/><path d="M4.5 51.5 8 55M55 17l3.5 3.5"/><path d="M27 37l8-8"/>',
  batedor: '<path d="M29 4h6v17h-6z"/><path d="M29.5 21C19 29 21 56 32 58c11-2 13-29 2.5-37"/><path d="M31 21c-4 10-3 31 1 35 4-4 5-25 1-35"/>',
  colher: '<path d="M32 60V29"/><path d="M32 29c-6 0-8.5-7-8.5-12.5S26.5 4 32 4s8.5 7 8.5 12.5S38 29 32 29z"/>',
  luva: '<path d="M21 56V31c0-12 6-22 14-22s12 8 12 18v4l6-4c3-2 6 1 4 4l-10 12v13z"/><path d="M18 56h31M18 61h31"/><path d="M27 20c1-3 3-5 6-5"/>',
  talheres: '<path d="M20 5v13a4 4 0 0 0 8 0V5M24 5v11M24 22v36"/><path d="M42 58V5c6 6 7 21 0 26"/>',
  coracao: '<path d="M32 54S10 40 10 24a11 11 0 0 1 22-4 11 11 0 0 1 22 4c0 16-22 30-22 30z"/>',
  casa: '<path d="M10 30 32 12l22 18"/><path d="M15 26v28h34V26"/><path d="M27 54V40h10v14"/><path d="M32 32s-4-2.5-4-5a2 2 0 0 1 4-.8 2 2 0 0 1 4 .8c0 2.5-4 5-4 5z"/>',
  presente: '<path d="M10 26h44v9H10zM14 35h36v21H14zM32 26v30"/><path d="M32 26c-4-8-14-10-14-4 0 4 9 4 14 4 5 0 14 0 14-4 0-6-10-4-14 4"/>',
  taca: '<path d="M22 6h20c0 14-4 22-10 22S22 20 22 6z"/><path d="M32 28v24M24 56h16"/><path d="M23 14h18"/>',
};
export const doodle = (name, cls = '') => `<svg class="doodle ${cls}" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${DOODLES[name] || ''}</svg>`;

// Fundo com desenhos espalhados (CSS: background-image: var(--doodles)).
export function applyDoodlePattern(color = '#000', opacity = .08, names = ['pote', 'panelas', 'xicara', 'rolo', 'batedor', 'chaleira', 'colher', 'luva']) {
  const spots = [[8, 10, -12], [92, 4, 10], [168, 22, -6], [30, 92, 14], [116, 84, -16], [190, 112, 8], [70, 168, -8], [150, 176, 12]];
  const art = spots.map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r} 22 22) scale(.7)">${DOODLES[names[i % names.length]]}</g>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${art}</svg>`;
  document.documentElement.style.setProperty('--doodles', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}

/* Papel rasgado: borda irregular. Cor = currentColor (use a cor do papel de baixo). */
export function tornEdge(cls = '', seed = 7) {
  let x = 0, d = 'M0 24V10', r = seed;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  while (x < 400) { x += 6 + rnd() * 12; d += `L${Math.min(400, x).toFixed(1)} ${(4 + rnd() * 12).toFixed(1)}`; }
  return `<svg class="torn ${cls}" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path d="${d}V24Z" fill="currentColor"/></svg>`;
}

/* Tábua de cortar com a data (modelo Oliva) */
export const cuttingBoard = (line1, line2 = '') => `<div class="board"><svg class="board-shape" viewBox="0 0 230 110" aria-hidden="true"><path d="M14 8h150a12 12 0 0 1 12 12v22h34a14 14 0 0 1 0 28h-34v22a12 12 0 0 1-12 12H14A12 12 0 0 1 2 92V20A12 12 0 0 1 14 8z" fill="currentColor"/><circle cx="208" cy="56" r="5" fill="var(--bg)"/></svg><span class="board-text"><strong>${esc(line1)}</strong>${line2 ? `<span>${esc(line2)}</span>` : ''}</span></div>`;

/* Ramo de folhas em traço (modelo Elegante) */
export const sprig = (cls = '') => `<svg class="sprig ${cls}" viewBox="0 0 120 140" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 136C30 104 46 70 92 12"/>
  <path d="M30 108c-14-4-22-16-22-30 14 4 22 16 22 30z"/><path d="M30 108 12 82"/>
  <path d="M37 94c14-2 26-12 30-26-14 2-26 12-30 26z"/><path d="M37 94l26-22"/>
  <path d="M50 74c-12-6-17-19-15-32 12 6 17 19 15 32z"/><path d="M50 74 37 46"/>
  <path d="M60 60c13 0 25-8 31-21-13 0-25 8-31 21z"/><path d="M60 60l27-18"/>
  <path d="M74 42c-9-8-11-21-7-32 9 8 11 21 7 32z"/><path d="M74 42 68 13"/>
  <path d="M92 12c4 2 8 1 10-3-4-2-8-1-10 3z"/>
</svg>`;

/* Botões grandes estilo app */
export const APP_ICONS = {
  presente: '<path d="M4 10h16v4H4zM5.5 14h13v7h-13zM12 10v11"/><path d="M12 10c-1.5-3.5-6-4.5-6-1.8C6 10 10 10 12 10c2 0 6 0 6-1.8 0-2.7-4.5-1.7-6 1.8"/>',
  local: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>',
  presenca: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  agenda: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  pix: '<path d="m12 3 4 4-4 4-4-4zM12 13l4 4-4 4-4-4zM3 12l4-4 4 4-4 4zM13 12l4-4 4 4-4 4z"/>',
  roteiro: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};
export const appIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${APP_ICONS[name] || ''}</svg>`;
export const appButtons = items => `<nav class="app-buttons" aria-label="Atalhos">${items.map(({ icon, label, href, external }) => `<a class="app-button" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}><span class="app-icon">${appIcon(icon)}</span><span class="app-label">${esc(label)}</span></a>`).join('')}</nav>`;

/* Fotos ----------------------------------------------------------------------- */
const img = (photo, alt, cls = '') => `<img class="${cls}" src="${esc(photo.data)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;

// Figurinha: PNG sem fundo ganha contorno branco; foto comum vira um recorte arredondado.
export const sticker = (photo, alt, cls = '') => (photo ? `<span class="sticker ${photo.cutout ? 'is-cutout' : 'is-photo'} ${cls}">${img(photo, alt)}</span>` : '');
export const polaroid = (photo, caption = '', cls = '', tilt = 0) => (photo ? `<figure class="polaroid ${cls}" style="--tilt:${tilt}deg">${img(photo, caption || 'Foto do casal')}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>` : '');
export const roundPhoto = (photo, alt, cls = '') => (photo ? `<span class="round-photo ${cls}">${img(photo, alt)}</span>` : '');
export const wavyPhoto = (photo, alt, cls = '') => (photo ? `<span class="wavy-photo ${cls}"><span class="wavy-inner">${img(photo, alt)}</span></span>` : '');
export const coverPhoto = (photo, alt, cls = '') => (photo ? `<div class="cover-photo ${cls}">${img(photo, alt)}</div>` : '');

// Galeria de polaroids com as fotos e legendas cadastradas.
export function gallery(photos, cls = '') {
  const tilts = [-4, 3, -2, 5];
  const items = GALLERY_SLOTS.map((id, i) => photos[id] ? polaroid(photos[id], photos[id].caption || '', '', tilts[i]) : '').filter(Boolean);
  return items.length ? `<div class="gallery ${cls}">${items.join('')}</div>` : '';
}

// Recorte em forma de onda usado por .wavy-photo (inserir uma vez por página).
export function waveClipDefs() {
  const pts = [], n = 64, waves = 9, amp = .022;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * Math.PI * 2, r = .5 - amp + Math.sin(a * waves) * amp;
    pts.push(`${(.5 + Math.cos(a) * r * 1.0).toFixed(4)} ${(.5 + Math.sin(a) * r * 1.0).toFixed(4)}`);
  }
  // Retângulo com bordas onduladas: contorno ponto a ponto.
  const edge = [], steps = 12;
  const wave = (k, len) => Math.sin(k / len * Math.PI * 2 * 5) * .012;
  for (let i = 0; i <= steps * 4; i++) {
    const side = Math.floor(i / steps), k = i % steps, f = k / steps;
    let x, y;
    if (side === 0) { x = f; y = .02 + wave(k, steps); }
    else if (side === 1) { x = .98 + wave(k, steps); y = f; }
    else if (side === 2) { x = 1 - f; y = .98 + wave(k, steps); }
    else { x = .02 + wave(k, steps); y = 1 - f; }
    edge.push(`${Math.max(0, Math.min(1, x)).toFixed(4)} ${Math.max(0, Math.min(1, y)).toFixed(4)}`);
  }
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><clipPath id="wave-rect" clipPathUnits="objectBoundingBox"><path d="M${edge.join('L')}Z"/></clipPath><clipPath id="wave-round" clipPathUnits="objectBoundingBox"><path d="M${pts.join('L')}Z"/></clipPath></defs></svg>`;
}

/* Pequenos enfeites ------------------------------------------------------------- */
export const bill = (cls = '', style = '') => `<svg class="bill ${cls}" style="${style}" viewBox="0 0 48 26" aria-hidden="true"><rect x="1" y="1" width="46" height="24" rx="3" fill="#8fbf7a" stroke="#5e8f4c"/><circle cx="24" cy="13" r="6" fill="none" stroke="#5e8f4c"/><path d="M6 6h5M37 20h5" stroke="#5e8f4c"/></svg>`;
export const seal = (text, cls = '') => `<span class="wax-seal ${cls}"><span class="wax-text">${esc(text)}</span></span>`;
export const initialsOf = couple => {
  const parts = String(couple || '').split(/\s+(?:&|e)\s+|\s*&\s*/i).map(p => p.trim()).filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('');
};
export function splitCouple(couple = '') {
  const parts = String(couple).split(/\s+(?:&|e)\s+|\s*&\s*/i).map(p => p.trim()).filter(Boolean);
  return [parts[0] || couple, parts.slice(1).join(' & ')];
}

/* Paleta de cores e Pix ------------------------------------------------------- */
export const paletteHtml = (colors, note) => (colors?.length ? `<div class="palette"><div class="palette-swatches">${colors.map(c => `<span class="swatch" style="--c:${esc(c)}" title="${esc(c)}"></span>`).join('')}</div>${note ? `<p class="palette-note">${esc(note)}</p>` : ''}</div>` : '');

export function pixHtml({ key, holder, title, gifts }, { cls = '' } = {}) {
  if (!key) return '';
  const tilts = [-4, 3, -3, 4];
  return `<div class="pix-block ${cls}">
    <h3 class="pix-title display">${esc(title)}</h3>
    ${gifts?.length ? `<div class="pix-gifts">${gifts.map((g, i) => `<div class="pix-gift" style="--tilt:${tilts[i % 4]}deg"><span class="pix-amount">${esc(g.amount)}</span><span class="pix-caption">${esc(g.caption)}</span></div>`).join('')}</div>` : ''}
    <div class="pix-key"><span class="pix-label">Nosso Pix</span><strong>${esc(key)}</strong>${holder ? `<small>${esc(holder)}</small>` : ''}<button type="button" class="btn btn-ghost pix-copy" data-copy-pix="${esc(key)}">Copiar chave Pix</button></div>
  </div>`;
}
// Liga os botões "Copiar chave Pix" de uma página.
export function bindPixCopy(root, toast) {
  root.querySelectorAll('[data-copy-pix]').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.copyPix); toast('Chave Pix copiada.'); }
    catch { prompt('Copie a chave Pix:', button.dataset.copyPix); }
  }));
}
