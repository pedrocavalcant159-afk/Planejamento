// Funções usadas pelas páginas públicas (convite, lista de presentes e site de casamento).
import { doc, getDoc, getDocs, collection, addDoc, setDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from './firebase.js';
import { TEMPLATES, PRODUCTS, esc } from './catalog.js';
import { DEMO_SLUG, DEMO_RESERVED, demoSite, demoPhotos, fakeSave } from './demo.js';

export const slugFromUrl = () => new URLSearchParams(location.search).get('c')?.trim().toLowerCase() || '';

/*
  sites/{slug} = {
    slug, couple: 'Marina & Rafael', ownerUid, active: boolean,
    products: { convite: 1, lista: 2, ebook: 1, site: 3, organizador: 1 },  // modelo de cada produto comprado
    casamento: { date: 'AAAA-MM-DD', time: 'HH:MM', venue, address },
    cha: { date, time, venue, address },
    custom: { ... },  // textos personalizados (lib/content.js)
  }
  sites/{slug}/fotos/{slot} = { data: 'data:image/...', caption, cutout }
*/
export async function loadSite(slug) {
  if (!slug) return null;
  const snap = await getDoc(doc(db, 'sites', slug));
  return snap.exists() ? snap.data() : null;
}

// Fotos do casal por slot ({ capa: { data, caption, cutout }, ... }). Sem fotos = objeto vazio.
export async function loadPhotos(slug) {
  try {
    const snap = await getDocs(collection(db, 'sites', slug, 'fotos'));
    return Object.fromEntries(snap.docs.filter(d => d.data().data).map(d => [d.id, d.data()]));
  } catch (error) {
    console.error('Falha ao carregar as fotos:', error);
    return {};
  }
}

// Carrega o site e confere se o produto foi comprado e está liberado. Aplica o modelo em <html data-model>.
export async function loadProductPage(product) {
  const slug = slugFromUrl();
  if (slug === DEMO_SLUG) {
    const q = new URLSearchParams(location.search), model = TEMPLATES[q.get('m')] ? Number(q.get('m')) : 1, withPhotos = q.get('fotos') !== '0';
    document.documentElement.dataset.model = String(model);
    return { slug, site: demoSite(model, withPhotos), model, photos: withPhotos ? demoPhotos() : {} };
  }
  try {
    const site = await loadSite(slug);
    if (!site || !site.active || !site.products?.[product]) return { slug, site: null, model: 1, photos: {} };
    const model = TEMPLATES[site.products[product]] ? Number(site.products[product]) : 1;
    document.documentElement.dataset.model = String(model);
    const photos = await loadPhotos(slug);
    return { slug, site, model, photos };
  } catch (error) {
    console.error('Falha ao carregar o site:', error);
    return { slug, site: null, model: 1, photos: {}, error };
  }
}

export const eventInfo = (site, product) => ({ date: '', time: '', venue: '', address: '', ...(site?.[PRODUCTS[product]?.event || 'casamento'] || {}) });
export const modelName = model => TEMPLATES[model]?.name || '';
export const mapsUrl = ({ venue, address }) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue, address].filter(Boolean).join(', '))}`;
// Mapa para <iframe> (Google Maps, sem chave de API). Vazio quando não há local nem endereço.
export const mapsEmbedUrl = ({ venue, address }) => {
  const q = [venue, address].filter(Boolean).join(', ').trim();
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed&hl=pt-BR&z=15` : '';
};

export function countdownParts(date, time = '12:00') {
  const seconds = Math.floor((new Date(`${date}T${time || '12:00'}:00`) - new Date()) / 1000);
  if (!date || Number.isNaN(seconds) || seconds <= 0) return null;
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}

export function calendarUrl({ title, date, time, venue, address }) {
  if (!date) return '';
  const start = `${date.replaceAll('-', '')}T${(time || '12:00').replace(':', '')}00`;
  const endDate = new Date(`${date}T${time || '12:00'}:00`); endDate.setHours(endDate.getHours() + 4);
  const pad = n => String(n).padStart(2, '0');
  const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&location=${encodeURIComponent([venue, address].filter(Boolean).join(', '))}`;
}

// Confirmação de presença: sites/{slug}/rsvps/{auto}
export function submitRsvp(slug, { name, people = 1, attending = true, message = '', product }) {
  if (slug === DEMO_SLUG) return fakeSave();
  return addDoc(collection(db, 'sites', slug, 'rsvps'), {
    name: String(name).trim().slice(0, 80),
    people: Math.max(0, Math.min(20, Number(people) || 0)),
    attending: Boolean(attending),
    message: String(message || '').trim().slice(0, 500),
    product,
    createdAt: serverTimestamp(),
  });
}

// Presentes escolhidos: sites/{slug}/reservas/{giftId}. Só pode ser criado uma vez por presente.
export function reserveGift(slug, giftId, { name, message = '' }) {
  if (slug === DEMO_SLUG) return fakeSave();
  return setDoc(doc(db, 'sites', slug, 'reservas', giftId), {
    name: String(name).trim().slice(0, 80),
    message: String(message || '').trim().slice(0, 300),
    createdAt: serverTimestamp(),
  });
}
export const watchReservas = (slug, callback) => slug === DEMO_SLUG ? (callback(new Set(DEMO_RESERVED)), () => {}) : onSnapshot(collection(db, 'sites', slug, 'reservas'), snap => callback(new Set(snap.docs.map(d => d.id))), error => console.error(error));

export function renderUnavailable(root = document.body, error = null) {
  document.documentElement.dataset.model ||= '1';
  root.innerHTML = `<main class="unavailable"><div class="unavailable-card"><span class="unavailable-mark">♡</span><h1>${error ? 'Não foi possível abrir esta página' : 'Página não encontrada'}</h1><p>${error ? 'Verifique sua conexão e tente novamente em instantes.' : 'Este link não existe ou ainda não foi liberado. Confira o endereço com quem enviou o convite.'}</p></div></main>`;
}

export { esc };
