// Casal de exemplo para visualizar os templates sem Firebase (botão "Templates" do painel).
// Uso: convite.html?c=demo&m=<1-4>  ·  &fotos=0 mostra como fica sem fotos e sem textos personalizados.
export const DEMO_SLUG = 'demo';

const inDays = days => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function demoSite(model, withExtras = true) {
  return {
    slug: DEMO_SLUG, couple: 'Marina & Rafael', active: true,
    products: { convite: model, lista: model, site: model },
    cha: { date: inDays(45), time: '15:00', venue: 'Casa da Vó Lúcia', address: 'Rua das Flores, 120 - Recife' },
    casamento: { date: inDays(210), time: '16:30', venue: 'Sítio das Oliveiras', address: 'Estrada do Sol, 900 - Aldeia' },
    custom: withExtras ? {
      pixKey: 'marina.rafael@email.com', pixHolder: 'Marina Souza · Nubank',
      palette: ['#ffffff', '#e8d5b5', '#c9a27a', '#7a8a5c'],
      verse: '“Assim, eles já não são dois, mas uma só carne.” Mateus 19:6',
    } : {},
  };
}

export function demoPhotos() {
  const url = file => new URL(`../demo/${file}`, import.meta.url).href;
  return {
    capa: { data: url('capa.jpg') },
    ela: { data: url('ela.svg'), cutout: true },
    ele: { data: url('ele.svg'), cutout: true },
    galeria1: { data: url('galeria1.jpg'), caption: 'Um chá pra começar' },
    galeria2: { data: url('galeria2.jpg'), caption: 'Cozinha cheia de amor' },
    galeria3: { data: url('galeria3.jpg'), caption: 'Café da tarde' },
    galeria4: { data: url('galeria4.jpg'), caption: 'Bolo da vó' },
  };
}

// Na demonstração, confirmações e reservas não são gravadas.
export const fakeSave = () => new Promise(resolve => setTimeout(resolve, 500));
export const DEMO_RESERVED = ['jogo-panelas', 'tacas'];
