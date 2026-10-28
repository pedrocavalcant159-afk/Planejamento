// Conteúdo que o admin personaliza para cada casal.
// Textos e listas ficam em sites/{slug}.custom; fotos em sites/{slug}/fotos/{slot}.
// Campo vazio = usa o texto padrão abaixo.

/* Fotos ------------------------------------------------------------------- */
// cutout: rosto recortado. Uma imagem PNG sem fundo vira figurinha com contorno branco.
export const PHOTO_SLOTS = [
  { id: 'capa', label: 'Foto principal do casal', hint: 'Usada no topo do site e na mensagem de boas-vindas.', max: 1400 },
  { id: 'ela', label: 'Rosto 1 (recortado)', hint: 'De preferência PNG sem fundo. No modelo Terracota fica em preto e branco (ótimo para foto de infância).', max: 800, cutout: true },
  { id: 'ele', label: 'Rosto 2 (recortado)', hint: 'De preferência PNG sem fundo.', max: 800, cutout: true },
  { id: 'galeria1', label: 'Galeria · foto 1', hint: 'Aparece como polaroid, com legenda.', max: 1100, caption: true },
  { id: 'galeria2', label: 'Galeria · foto 2', max: 1100, caption: true },
  { id: 'galeria3', label: 'Galeria · foto 3', max: 1100, caption: true },
  { id: 'galeria4', label: 'Galeria · foto 4', max: 1100, caption: true },
];
export const GALLERY_SLOTS = PHOTO_SLOTS.filter(s => s.caption).map(s => s.id);

/* Textos ------------------------------------------------------------------ */
// type: text | textarea | list (linhas com colunas) | colors
export const CUSTOM_GROUPS = [
  {
    title: 'Chá de panela (convite e lista)',
    fields: [
      { key: 'chaTitle', label: 'Nome do evento', default: 'Chá de Panela', hint: 'Ex.: Chá de Casa Nova, Chá dos Noivos.' },
      { key: 'chaLead', label: 'Frase do convite', type: 'textarea', default: 'convidam você para o chá de panela que vai inaugurar a nossa cozinha' },
      { key: 'welcomeTitle', label: 'Título da boas-vindas', default: 'Bem-vindos ao nosso lar' },
      { key: 'welcome', label: 'Mensagem de boas-vindas', type: 'textarea', default: 'Com muita alegria e gratidão por essa nova etapa, queremos comemorar com você o nosso chá de panela! A nossa casa só fica completa com as pessoas que a gente ama por perto.' },
      { key: 'roteiro', label: 'Roteiro do dia', type: 'list', columns: [['time', 'Horário', 'Ex.: 16h'], ['text', 'O que acontece', 'Ex.: Abertura dos presentes']], default: [
        { time: '16h', text: 'Chegada, abraços e comes e bebes' },
        { time: '17h', text: 'Brincadeiras e muita risada' },
        { time: '18h', text: 'Abertura dos presentes' },
        { time: '19h', text: 'Parabéns pra gente e despedida' },
      ] },
      { key: 'listaIntro', label: 'Texto da lista de presentes', type: 'textarea', default: 'Preparamos esta lista com muito carinho, pensando em itens que vão fazer parte do nosso dia a dia nessa nova fase. Escolha um presente e ele fica reservado no seu nome.' },
      { key: 'closing', label: 'Frase de despedida', default: 'Te esperamos, hein?' },
    ],
  },
  {
    title: 'Pix para contribuir de outra forma',
    hint: 'Deixe a chave em branco para esconder esta parte.',
    fields: [
      { key: 'pixKey', label: 'Chave Pix do casal', default: '', hint: 'CPF, e-mail, telefone ou chave aleatória.' },
      { key: 'pixHolder', label: 'Nome e banco', default: '', hint: 'Ex.: Júlia Souza · Nubank' },
      { key: 'pixTitle', label: 'Título', default: 'Quer contribuir de outra forma?' },
      { key: 'pixGifts', label: 'Valores sugeridos no chá', type: 'list', columns: [['amount', 'Valor', 'R$ 50'], ['caption', 'Legenda divertida', 'Ex.: primeira conta de luz']], default: [
        { amount: 'R$ 50', caption: 'Só pra não dizer que não dei nada' },
        { amount: 'R$ 100', caption: 'Kit pano de prato chique' },
        { amount: 'R$ 150', caption: 'Nossa primeira conta de luz' },
        { amount: 'R$ 250', caption: 'Pra você ganhar o bingo' },
      ] },
    ],
  },
  {
    title: 'Paleta de cores dos presentes',
    hint: 'Deixe sem cores para esconder esta parte.',
    fields: [
      { key: 'palette', label: 'Cores', type: 'colors', default: [] },
      { key: 'paletteNote', label: 'Texto da paleta', type: 'textarea', default: 'Para manter a harmonia da nossa casa, se puder, prefira presentes nestes tons.' },
    ],
  },
  {
    title: 'Site de casamento',
    fields: [
      { key: 'siteTitle', label: 'Frase de abertura', default: 'Vamos casar!' },
      { key: 'siteLead', label: 'Texto de abertura', type: 'textarea', default: 'O nosso dia está cada vez mais próximo, e a gente quer muito contar com você em mais esse dia especial.' },
      { key: 'verse', label: 'Versículo ou frase', type: 'textarea', default: '“Assim, eles já não são dois, mas uma só carne. Portanto, o que Deus uniu, ninguém separe.” Mateus 19:6' },
      { key: 'story', label: 'Nossa história', type: 'list', columns: [['label', 'Capítulo', 'Ex.: O encontro'], ['text', 'Texto', 'Conte esse momento']], default: [
        { label: 'O encontro', text: 'Tudo começou com um olhar, uma conversa que parecia não ter fim e a sensação de que já nos conhecíamos de algum lugar.' },
        { label: 'O primeiro encontro', text: 'Um café que virou jantar, um jantar que virou passeio, e de repente a gente não queria mais ir embora.' },
        { label: 'O pedido', text: 'Entre risos e lágrimas, veio a pergunta mais fácil de responder da vida: sim, mil vezes sim.' },
      ] },
      { key: 'infos', label: 'Informações importantes', type: 'list', columns: [['title', 'Título', 'Ex.: Traje'], ['text', 'Texto', 'Explique em poucas linhas']], default: [
        { title: 'Traje', text: 'Esporte fino. Sugerimos tons claros e sapatos que aguentem a pista de dança.' },
        { title: 'Chegada', text: 'Chegue com cerca de 30 minutos de antecedência para se acomodar com calma.' },
        { title: 'Crianças', text: 'Confirme com os noivos se as crianças estão incluídas no seu convite.' },
        { title: 'Fotos', text: 'Durante a cerimônia, deixe o celular guardado. Na festa, fotografe à vontade!' },
      ] },
      { key: 'sitePixGifts', label: 'Valores sugeridos no Pix do site', type: 'list', columns: [['amount', 'Valor', 'R$ 100'], ['caption', 'Legenda divertida', 'Ex.: um jantar na lua de mel']], default: [
        { amount: 'R$ 50', caption: 'Um brinde aos noivos' },
        { amount: 'R$ 100', caption: 'Um jantar na lua de mel' },
        { amount: 'R$ 200', caption: 'Um passeio inesquecível' },
        { amount: 'R$ 300', caption: 'Ajuda com as passagens' },
      ] },
      { key: 'siteClosing', label: 'Frase de despedida', default: 'Esperamos você para celebrar conosco!' },
    ],
  },
];
export const CUSTOM_FIELDS = CUSTOM_GROUPS.flatMap(g => g.fields);
const DEFAULTS = Object.fromEntries(CUSTOM_FIELDS.map(f => [f.key, f.default]));

// Texto de um campo para o casal: o personalizado, ou o padrão quando vazio.
export function custom(site, key) {
  const value = site?.custom?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULTS[key];
}
// Listas podem ser esvaziadas de propósito (ex.: sem roteiro). Nunca salva = usa o padrão.
export function customList(site, key) {
  const value = site?.custom?.[key];
  return Array.isArray(value) ? value.filter(row => typeof row === 'string' ? row : Object.values(row).some(v => String(v || '').trim())) : DEFAULTS[key];
}
