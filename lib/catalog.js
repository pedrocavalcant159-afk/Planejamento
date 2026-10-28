// Catálogo de produtos e modelos vendidos na plataforma.
// Modelos do ebook e do organizador.
export const MODELS = {
  1: { name: 'Jardim', description: 'Verde oliva, folhagens e serifa elegante' },
  2: { name: 'Rosé', description: 'Rosa antigo, flores e letra cursiva' },
  3: { name: 'Gala', description: 'Noite escura, dourado e brilho' },
};
// Modelos das páginas públicas (convite, lista de presentes e site de casamento).
export const TEMPLATES = {
  1: { name: 'Terracota', description: 'Caramelo e rosado, papel rasgado, fotos em preto e branco e desenhos de cozinha' },
  2: { name: 'Figurinha', description: 'Verde folha, rostos recortados, polaroids e botões estilo app' },
  3: { name: 'Elegante', description: 'Verde-musgo, selo de cera dourado, foto grande e ramos' },
  4: { name: 'Oliva', description: 'Creme e oliva, traço à mão, tábua com a data e Pix divertido' },
};

// event: qual conjunto de data/local o produto usa ('cha' = chá de panela, 'casamento').
// templates: true quando o produto usa os modelos de TEMPLATES.
export const PRODUCTS = {
  convite: { name: 'Convite virtual interativo', short: 'Convite', event: 'cha', page: 'convite.html', price: 39.9, templates: true },
  lista: { name: 'Lista de presentes', short: 'Lista de presentes', event: 'cha', page: 'lista.html', price: 29.9, templates: true },
  ebook: { name: 'Ebook PDF chá de panela', short: 'Ebook', event: 'cha', page: null, price: 19.9 },
  site: { name: 'Site de casamento', short: 'Site', event: 'casamento', page: 'site.html', price: 59.9, templates: true },
  organizador: { name: 'Organizador de casamento', short: 'Organizador', event: 'casamento', page: 'index.html', price: 49.9 },
};
export const PRODUCT_KEYS = Object.keys(PRODUCTS);
export const modelsFor = product => (PRODUCTS[product]?.templates ? TEMPLATES : MODELS);
export const modelName = (product, model) => modelsFor(product)[model]?.name || '';

export const STATUS = {
  aguardando: { label: 'Aguardando pagamento', tone: 'amber' },
  pago: { label: 'Pago', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' },
};

export const slugify = value => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function dateLong(iso, withWeekday = false) {
  if (!iso) return 'Data a definir';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { ...(withWeekday ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', year: 'numeric' });
}

export const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Link público de um produto para um cliente, relativo à pasta atual do site.
export function productLink(product, slug) {
  const page = PRODUCTS[product]?.page;
  if (!page) return '';
  const base = new URL('.', location.href);
  return new URL(product === 'organizador' ? page : `${page}?c=${encodeURIComponent(slug)}`, base).href;
}
