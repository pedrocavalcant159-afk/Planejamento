import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db, isAdmin, loginToEmail } from './lib/firebase.js';
import { WEDDING_STYLES, CEREMONY_TYPES, VENDOR_STATUSES, BUDGET_SPLIT, checklist, alerts, answer, QUESTIONS, vendorFinal } from './lib/planner.js';
import { askAI, parseAI } from './lib/ai.js';

let activeUser = null;
let plannerSlug = '';
let plannerId = '';
let siteRsvps = null;
let stopRealtime = null;
let saveQueue = Promise.resolve();
const STORAGE_KEY = 'entre-nos-casamento-v1';
const navLabels = { documentos: 'Documentos', inspiracoes: 'Inspirações', diad: 'Dia do casamento', luademel: 'Lua de mel', inicio: 'Visão geral', assistente: 'Cerimonialista virtual', convidados: 'Convidados', financeiro: 'Financeiro', fornecedores: 'Fornecedores', cerimonia: 'Cerimônia & músicas', cerimonial: 'Cerimonial do casamento', checklist: 'O que levar', cronograma: 'Cronograma', anotacoes: 'Anotações' };
const expenseCategories = ['Comidas & Buffet', 'Decoração & Cenografia', 'Local / Espaço / Sítio', 'Trajes & Beleza', 'Audiovisual', 'Banda & DJ', 'Outros'];
const renamedCategories = { 'Itens Avulsos & Lembrancinhas': 'Outros' };
const guestGroups = ['Família Noiva', 'Família Noivo', 'Padrinhos', 'Amigos'];
const guestStatuses = ['Pendente', 'Enviado', 'Confirmado', 'Recusado'];
const dietaryOptions = ['Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose', 'Alergia a frutos do mar', 'Alergia a amendoim', 'Diabético'];
const bookingTypes = ['Hospedagem', 'Passagem', 'Passeio', 'Transporte', 'Seguro viagem', 'Outro'];
const bookingStatuses = ['Opção', 'Reservado', 'Pago', 'Cancelado'];
const packingCategories = ['Documentos', 'Roupas', 'Higiene', 'Eletrônicos', 'Saúde', 'Outros'];
const docCategories = ['Contratos', 'Propostas', 'Comprovantes e recibos', 'Notas fiscais', 'Documentos da cerimônia', 'Outros'];
const paletteDefaults = ['#f4efe6', '#e8d5b5', '#c9a27a', '#7a8a5c'];
const expenseStatuses = ['Pendente', 'Pago Pix', 'Cartão', 'Boleto', 'Presente Ganho'];
// Cartão alimentação: forma de pagamento extra, liberada só para as contas listadas aqui.
const FOOD_CARD = 'Cartão alimentação', FOOD_CARD_EMAILS = ['pedrocavalcant159@gmail.com'];
const hasFoodCard = () => FOOD_CARD_EMAILS.includes((activeUser?.email || '').toLowerCase());
const expenseStatusList = () => (hasFoodCard() ? [...expenseStatuses.slice(0, 3), FOOD_CARD, ...expenseStatuses.slice(3)] : expenseStatuses);
const checklistCategories = ['Descartáveis & Limpeza', 'Alimentos & Bebidas', 'Utensílios & Cozinha', 'Eletroportáteis & Ferramentas', 'Itens Pessoais & Documentos'];
const checklistStatuses = ['Pendente', 'Comprado', 'No Carro', 'No Local'];
const taskStatuses = ['A Fazer', 'Em Andamento', 'Concluído'];
const taskPriorities = ['Alta', 'Média', 'Baixa'];
// Tarefas antigas usavam dias da semana do casamento; viram datas reais.
const legacyDayOffsets = { 'Quarta-feira': -3, 'Quinta-feira': -2, 'Sexta-feira': -1, 'Sábado / Dia D': 0 };
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = value => new Date(`${value}T12:00:00`);
const addDays = (value, n) => { const d = fromIso(value); d.setDate(d.getDate() + n); return isoDate(d); };
const weekOf = value => addDays(value, -((fromIso(value).getDay() + 6) % 7));
const todayIso = () => isoDate(new Date());
const shortDate = value => fromIso(value).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
const priorityRank = t => taskPriorities.indexOf(t.priority || 'Média');
const byTaskOrder = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99') || priorityRank(a) - priorityRank(b);
const slugOf = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
const ceremonySteps = ['Entrada com placa', 'Entrada do noivo + mãe', 'Entrada dos padrinhos', 'Floristas', 'Entrada da noiva + pai', 'Alianças', 'Votos', 'Saída'];
const defaultData = {
  wedding: { couple: 'Marina & Rafael', date: '2026-11-14', time: '11:30', venue: 'Sítio das Oliveiras', guestsExpected: 100, budget: 30000, style: 'Romântico', ceremonyType: 'Religiosa', saved: 0 },
  guests: [
    { id: 'g1', name: 'Ana Paula Oliveira', phone: '(11) 98821-4040', group: 'Família Noiva', status: 'Confirmado', companions: 1, children: 0 },
    { id: 'g2', name: 'Carlos Eduardo Souza', phone: '(11) 99752-8163', group: 'Família Noivo', status: 'Confirmado', companions: 0, children: 0 },
    { id: 'g3', name: 'Beatriz Martins', phone: '(11) 98319-0721', group: 'Padrinhos', status: 'Enviado', companions: 1, children: 0 },
    { id: 'g4', name: 'Lucas Ferreira', phone: '(11) 99103-2258', group: 'Amigos', status: 'Pendente', companions: 1, children: 1 },
    { id: 'g5', name: 'Helena Oliveira', phone: '(11) 98402-1009', group: 'Família Noiva', status: 'Confirmado', companions: 0, children: 0 },
    { id: 'g6', name: 'Pedro e Camila', phone: '(11) 97619-5342', group: 'Padrinhos', status: 'Enviado', companions: 0, children: 0 },
  ],
  expenses: [
    { id: 'e1', description: 'Buffet e bebidas', category: 'Comidas & Buffet', planned: 6800, paid: 3200, status: 'Pago Pix', notes: 'Entrada paga; saldo até outubro' },
    { id: 'e2', description: 'Bolo de casamento', category: 'Comidas & Buffet', planned: 950, paid: 0, status: 'Pendente', notes: '' },
    { id: 'e3', description: 'Flores e arranjos', category: 'Decoração & Cenografia', planned: 1800, paid: 600, status: 'Pago Pix', notes: '' },
    { id: 'e4', description: 'Aluguel do sítio', category: 'Local / Espaço / Sítio', planned: 2500, paid: 2500, status: 'Pago Pix', notes: 'Quitado' },
    { id: 'e5', description: 'Vestido de noiva', category: 'Trajes & Beleza', planned: 2400, paid: 1200, status: 'Cartão', notes: '' },
    { id: 'e6', description: 'Lembrancinhas', category: 'Outros', planned: 420, paid: 0, status: 'Pendente', notes: '' },
  ],
  ceremony: [
    { id: 'c1', step: 'Entrada com placa', participants: 'Sofia e Miguel', music: 'Here Comes the Sun', artist: 'The Beatles', notes: 'Crianças entram devagar pelo corredor central.' },
    { id: 'c2', step: 'Entrada do noivo + mãe', participants: 'Rafael e Dona Lúcia', music: 'Trem-Bala', artist: 'Ana Vilela', notes: 'Entram pelo lado direito.' },
    { id: 'c3', step: 'Entrada dos padrinhos', participants: 'Padrinhos e madrinhas', music: 'Velha Infância', artist: 'Tribalistas', notes: 'Um casal por vez, com espaço entre eles.' },
    { id: 'c4', step: 'Floristas', participants: 'Lívia e Clara', music: 'A Thousand Years', artist: 'Christina Perri', notes: 'Distribuir pétalas no caminho.' },
    { id: 'c5', step: 'Entrada da noiva + pai', participants: 'Marina e Sr. Paulo', music: 'Pra Sonhar', artist: 'Marcelo Jeneci', notes: 'Pai acompanha até o início do corredor.' },
    { id: 'c6', step: 'Alianças', participants: 'Miguel', music: 'Perfect', artist: 'Ed Sheeran', notes: 'Alianças ficam com a mãe do noivo até este momento.' },
    { id: 'c7', step: 'Votos', participants: 'Marina e Rafael', music: 'Instrumental suave', artist: 'Playlist da cerimônia', notes: 'Deixar microfone preparado.' },
    { id: 'c8', step: 'Saída', participants: 'Recém-casados + cortejo', music: 'Signed, Sealed, Delivered', artist: 'Stevie Wonder', notes: 'Convidados aguardam no jardim para os cumprimentos.' },
  ],
  ceremonial: [
    { id: 'cm1', time: '07:30', title: 'Chegada e abertura do sítio', responsible: 'Cerimonial', details: 'Conferir acesso, energia, banheiros e equipe de apoio.', status: 'A Fazer' },
    { id: 'cm2', time: '09:30', title: 'Checagem de fornecedores', responsible: 'Cerimonial', details: 'Confirmar buffet, decoração, som, foto e vídeo.', status: 'A Fazer' },
    { id: 'cm3', time: '10:30', title: 'Recepção do cortejo', responsible: 'Cerimonial', details: 'Orientar noivos, pais, padrinhos e crianças para a entrada.', status: 'A Fazer' },
    { id: 'cm4', time: '11:00', title: 'Acomodação dos convidados', responsible: 'Recepção', details: 'Organizar assentos e manter o corredor livre.', status: 'A Fazer' },
    { id: 'cm5', time: '11:20', title: 'Alinhamento final e música', responsible: 'Cerimonial + som', details: 'Confirmar alianças, entradas e playlist.', status: 'A Fazer' },
    { id: 'cm6', time: '11:30', title: 'Início da cerimônia', responsible: 'Cerimonial', details: 'Dar início ao cortejo conforme o roteiro.', status: 'A Fazer' },
    { id: 'cm7', time: '12:30', title: 'Saída e cumprimentos', responsible: 'Cerimonial', details: 'Conduzir saída, fotos e liberação para recepção.', status: 'A Fazer' },
  ],
  supplies: [
    { id: 's1', name: 'Papel toalha e guardanapos', category: 'Descartáveis & Limpeza', status: 'Pendente', quantity: '4 rolos + 200 un.' },
    { id: 's2', name: 'Sacos de lixo reforçados', category: 'Descartáveis & Limpeza', status: 'Comprado', quantity: '2 pacotes' },
    { id: 's3', name: 'Copos e pratos descartáveis', category: 'Descartáveis & Limpeza', status: 'Pendente', quantity: '120 unidades' },
    { id: 's4', name: 'Café, açúcar e temperos', category: 'Alimentos & Bebidas', status: 'No Carro', quantity: '1 de cada' },
    { id: 's5', name: 'Água mineral', category: 'Alimentos & Bebidas', status: 'Pendente', quantity: '10 garrafões' },
    { id: 's6', name: 'Facas, tábuas e travessas', category: 'Utensílios & Cozinha', status: 'Pendente', quantity: 'Conferir cozinha' },
    { id: 's7', name: 'Conchas e espetos', category: 'Utensílios & Cozinha', status: 'Comprado', quantity: '1 conjunto' },
    { id: 's8', name: 'Extensão elétrica', category: 'Eletroportáteis & Ferramentas', status: 'Pendente', quantity: '1 longa' },
    { id: 's9', name: 'Chapinha e carregadores', category: 'Eletroportáteis & Ferramentas', status: 'Pendente', quantity: '' },
    { id: 's10', name: 'Documentos e alianças', category: 'Itens Pessoais & Documentos', status: 'Pendente', quantity: 'Conferir na sexta' },
  ],
  tasks: [
    { id: 't1', title: 'Fechar lista final de convidados', day: 'Quarta-feira', time: '09:00', description: 'Confirmar presenças e restrições alimentares', status: 'Concluído' },
    { id: 't2', title: 'Compras de alimentos e bebidas', day: 'Quarta-feira', time: '13:00', description: 'Atacado e hortifruti', status: 'Em Andamento' },
    { id: 't3', title: 'Preparar bases de comida', day: 'Quarta-feira', time: '16:00', description: 'Organizar em potes com etiquetas', status: 'A Fazer' },
    { id: 't4', title: 'Montagem dos doces', day: 'Quinta-feira', time: '10:00', description: 'Separar bandejas e caixas de transporte', status: 'A Fazer' },
    { id: 't5', title: 'Levar itens para o sítio', day: 'Quinta-feira', time: '15:00', description: 'Usar checklist do que levar', status: 'A Fazer' },
    { id: 't6', title: 'Cartório e decoração do espaço', day: 'Sexta-feira', time: '09:00', description: 'Cerimônia civil pela manhã; montagem à tarde', status: 'A Fazer' },
    { id: 't7', title: 'Teste de som e passagem da cerimônia', day: 'Sexta-feira', time: '17:30', description: 'Conferir playlist e ordem do cortejo', status: 'A Fazer' },
    { id: 't8', title: 'Decoração e últimos detalhes', day: 'Sábado / Dia D', time: '07:00', description: 'Montar mesas, flores e sinalização', status: 'A Fazer' },
    { id: 't9', title: 'Cabelo e maquiagem', day: 'Sábado / Dia D', time: '08:30', description: 'Separar robe, água e lanchinho', status: 'A Fazer' },
    { id: 't10', title: 'Cerimônia', day: 'Sábado / Dia D', time: '11:30', description: 'Respirar fundo e aproveitar cada segundo ♡', status: 'A Fazer' },
  ],
  notes: [],
  customCategories: [],
  vendors: [],
  tables: [],
  importedRsvps: [],
  emergencyContacts: [],
  places: [],
  planB: [
    { id: 'pb1', problem: 'Chuva ou vento forte', solution: 'Tenda reserva confirmada com o local e cerimônia na área coberta.', owner: '' },
    { id: 'pb2', problem: 'Atraso de fornecedor', solution: 'Ligar para o contato de emergência do fornecedor e adiantar o que não depende dele.', owner: '' },
    { id: 'pb3', problem: 'Falta de energia', solution: 'Confirmar gerador com o local e o DJ.', owner: '' },
    { id: 'pb4', problem: 'Ausência de alguém importante', solution: 'Ter um substituto combinado (padrinho, leitura, alianças).', owner: '' },
    { id: 'pb5', problem: 'Falta de algum item', solution: 'Kit de emergência e lista do que levar conferida na véspera.', owner: '' },
  ],
  kit: ['Agulha, linha e alfinetes', 'Curativos e esparadrapo', 'Remédio para dor de cabeça e enjoo', 'Lenços de papel', 'Maquiagem para retoque', 'Grampos e elásticos de cabelo', 'Carregador e bateria portátil', 'Fita dupla face', 'Tesoura pequena', 'Desodorante e perfume', 'Água e um lanchinho', 'Sapato baixo de reserva'].map((item, i) => ({ id: `k${i + 1}`, item, done: false })),
  honeymoon: { destination: '', start: '', end: '', budget: 0, saved: 0, notes: '' },
  hmDestinations: [],
  hmBookings: [],
  hmItinerary: [],
  hmPacking: [['Passaporte / RG', 'Documentos'], ['Reservas e passagens salvas no celular', 'Documentos'], ['Seguro viagem', 'Documentos'], ['Cartões e um pouco de dinheiro', 'Documentos'], ['Roupas de banho', 'Roupas'], ['Roupa para jantar especial', 'Roupas'], ['Protetor solar', 'Saúde'], ['Remédios de uso pessoal', 'Saúde'], ['Kit de higiene', 'Higiene'], ['Carregadores e adaptador de tomada', 'Eletrônicos']].map(([item, category], i) => ({ id: `m${i + 1}`, item, category, done: false })),
  hmBoard: [{ id: 'sonhos', title: 'Nossa viagem dos sonhos', files: [], links: [] }],
  documents: [],
  docChecklist: ['Certidões de nascimento atualizadas dos dois', 'RG e CPF dos dois', 'Comprovante de residência', 'Habilitação de casamento no cartório', 'Certificado do curso de noivos', 'Certidões de batismo (cerimônia religiosa)', 'Contratos assinados dos fornecedores', 'Comprovantes de pagamento'].map((item, i) => ({ id: `d${i + 1}`, item, done: false })),
  inspirations: ['Decoração', 'Vestido', 'Cabelo e maquiagem', 'Flores e buquê', 'Bolo e doces', 'Papelaria'].map((title, i) => ({ id: `ins${i + 1}`, title, notes: '', colors: [], files: [], links: [] })),
};

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalizeData(saved || {});
  } catch { return structuredClone(defaultData); }
}
let data = structuredClone(defaultData);
let currentPage = 'inicio';
let guestFilter = 'Todos';
let guestSearch = '';
let guestStatusFilter = 'Todos';
let guestView = 'lista';
let docFilter = 'Todos';
let docSearch = '';
let expenseFilter = 'Todas';
let weekStart = weekOf(todayIso());
let timelineView = 'semana';
let showDiscarded = false;
let vendorTab = 'Todos';
let askThread = [], askMemory = {}, aiWarned = false, askBusy = false; // conversa com a cerimonialista virtual (só nesta sessão)
let dayTrack = 'Tudo';
const contractStatuses = ['Sem contrato', 'Enviado para assinatura', 'Assinado'];
const tracks = ['Geral', 'Noiva', 'Noivo'];
const people = g => 1 + Number(g.companions || 0) + Number(g.children || 0);
const sameName = (a, b) => slugOf(a).replace(/[^a-z0-9]/g, '') === slugOf(b).replace(/[^a-z0-9]/g, '');
const waLink = (phone, text) => { const n = String(phone || '').replace(/\D/g, '').replace(/^(?!55)(\d{10,11})$/, '55$1'); return `https://wa.me/${n}?text=${encodeURIComponent(text)}`; };
const hourOf = value => String(value || '').slice(0, 5);
let toastTimer;
let animateNextRender = true;
const $ = (s, root = document) => root.querySelector(s);
const icons = {
  phone: '<path d="M5 4h3.5l2 5-2.4 1.6a11 11 0 0 0 5.3 5.3L15 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  plane: '<path d="M10.5 13.5 3 11l1.5-1.5 7 1 4-4.5c1-1 2.5-1.5 3.5-.5s.5 2.5-.5 3.5l-4.5 4 1 7L13.5 21l-2.5-7.5-3 3V19l-1.5 1-1-3-3-1L3.5 15H6z"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  chat: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5z"/><path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01"/>',
  clip: '<path d="m20.5 11.5-8.4 8.4a5 5 0 0 1-7.1-7.1l8.4-8.4a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V20"/>',
  wallet: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
};
const icon = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const totalGuests = () => data.guests.reduce((n, g) => n + 1 + Number(g.companions || 0) + Number(g.children || 0), 0);
const confirmedGuests = () => data.guests.filter(g => g.status === 'Confirmado').reduce((n, g) => n + 1 + Number(g.companions || 0) + Number(g.children || 0), 0);
const isGift = e => e.status === 'Presente Ganho';
const dueOf = e => (isGift(e) ? 0 : Math.max(0, Number(e.planned || 0) - Number(e.paid || 0)));
const spent = () => data.expenses.reduce((n, e) => n + (isGift(e) ? 0 : Number(e.paid || 0)), 0);
const gifted = () => data.expenses.filter(isGift).reduce((n, e) => n + Number(e.planned || 0), 0);
const due = () => data.expenses.reduce((n, e) => n + dueOf(e), 0);
// Presentes não entram no saldo do casal, mas acompanhamos quanto ainda falta quem deu pagar.
const giftDueOf = e => (isGift(e) ? Math.max(0, Number(e.planned || 0) - Number(e.paid || 0)) : 0);
const giftDue = () => data.expenses.reduce((n, e) => n + giftDueOf(e), 0);
const allExpenseCategories = () => [...new Set([...expenseCategories, ...(data.customCategories || []), ...data.expenses.map(e => e.category).filter(Boolean)])];
const planned = () => data.expenses.reduce((n, e) => n + Number(e.planned || 0), 0);
const progress = () => Math.round((data.tasks.filter(t => t.status === 'Concluído').length / Math.max(data.tasks.length, 1)) * 100);
const badge = (text, cls = text.toLowerCase().replaceAll(' ', '-')) => `<span class="badge badge-${esc(cls)}">${esc(text)}</span>`;
const empty = message => {
  const actions = { convidados: ['add-guest', 'Adicionar convidado'], financeiro: ['add-expense', 'Adicionar gasto'], cerimonia: ['add-ceremony', 'Adicionar etapa'], cerimonial: ['add-ceremonial', 'Adicionar horário'], checklist: ['add-supply', 'Adicionar item'], cronograma: ['add-task', 'Adicionar tarefa'] };
  const action = actions[currentPage];
  return `<div class="empty-state"><span class="empty-mark" aria-hidden="true">♡</span><span>${esc(message)}</span>${action ? `<button class="button button-secondary" data-action="${action[0]}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>${action[1]}</button>` : ''}</div>`;
};
function save(message = '', animate = true) {
  updateProgress(); animateNextRender = animate;
  if (message) notify(message);
  if (!activeUser) return;
  const plannerRef = doc(db, 'planners', plannerId || activeUser.uid);
  saveQueue = saveQueue.catch(() => {}).then(() => setDoc(plannerRef, { data, updatedAt: serverTimestamp() }));
  saveQueue.catch(error => { console.error('Falha ao salvar no Firestore:', error); notify('Não foi possível salvar. Verifique sua conexão.'); });
}
function notify(message) { const t = $('#toast'); t.textContent = message; t.classList.remove('show', 'toast-pop'); void t.offsetWidth; t.classList.add('show', 'toast-pop'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show', 'toast-pop'), 2600); }
function updateProgress() { const p = progress(); $('#sidebar-progress').style.width = `${p}%`; $('#sidebar-progress-label').textContent = `${p}% do planejamento concluído`; }
function weddingStart() { return new Date(`${data.wedding.date}T${data.wedding.time || '11:30'}:00`); }
function countdownState() {
  const seconds = Math.floor((weddingStart() - new Date()) / 1000);
  if (!data.wedding.date || Number.isNaN(seconds)) return { unknown: true, complete: false, days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (seconds <= 0) return { complete: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return { complete: false, days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}
function daysRemaining() { return countdownState().days; }
function updateTopbarStatus() {
  const state = countdownState(), pill = $('#topbar-status');
  pill.classList.toggle('is-done', state.complete);
  pill.querySelector('span').textContent = state.unknown ? 'Defina a data' : state.complete ? 'Casamento realizado' : state.days === 0 ? 'É hoje!' : `Faltam ${state.days} ${state.days === 1 ? 'dia' : 'dias'}`;
}
function updateCountdown() {
  updateTopbarStatus();
  const state = countdownState(); const timer = $('#live-countdown');
  if (!timer || state.unknown) return;
  if (state.complete) { timer.classList.add('countdown-complete'); timer.innerHTML = '<strong>O grande dia já aconteceu ♡</strong><span>Atualize a data do casamento nos detalhes</span>'; return; }
  timer.classList.remove('countdown-complete');
  [['days', state.days], ['hours', String(state.hours).padStart(2, '0')], ['minutes', String(state.minutes).padStart(2, '0')], ['seconds', String(state.seconds).padStart(2, '0')]].forEach(([unit, value]) => { const el = timer.querySelector(`[data-count="${unit}"]`); if (el && el.textContent !== String(value)) { el.textContent = value; el.classList.remove('count-tick'); void el.offsetWidth; el.classList.add('count-tick'); } });
}
function dateLabel(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) { if (!value) return 'Defina a data'; return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', options); }
function setPage(page) { currentPage = page; animateNextRender = true; $('.nav-item.active')?.classList.remove('active'); $(`.nav-item[data-page="${page}"]`)?.classList.add('active'); document.title = `${navLabels[page]} — Entre Nós`; $('#sidebar').classList.remove('open'); render(); }
function render() {
  const content = $('#page-content');
  updateTopbarStatus();
  content.innerHTML = ({ inicio: renderDashboard, assistente: renderAssistant, convidados: renderGuests, financeiro: renderFinance, fornecedores: renderVendors, diad: renderDayD, luademel: renderHoneymoon, documentos: renderDocuments, inspiracoes: renderInspirations, cerimonia: renderCeremony, cerimonial: renderCeremonial, checklist: renderChecklist, cronograma: renderTimeline, anotacoes: renderNotes })[currentPage]();
  content.classList.toggle('page-enter', animateNextRender);
  if (animateNextRender) setTimeout(() => content.classList.remove('page-enter'), 900);
  animateNextRender = false;
  content.querySelectorAll('table').forEach(table => {
    const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => row.querySelectorAll('td').forEach((cell, index) => {
      if (!cell.hasAttribute('colspan') && labels[index] !== undefined) cell.dataset.label = labels[index];
    }));
  });
  bindPageEvents(); updateProgress(); updateNavBadges();
}
// Ações das respostas: copiar a mensagem pronta ou levar o cronograma modelo para o Cerimonial.
function askAction(action, button) {
  if (!action) return;
  if (action.type === 'copy') { navigator.clipboard?.writeText(action.text).then(() => notify('Mensagem copiada. É só colar e trocar a data e o link.'), () => notify('Não consegui copiar. Selecione o texto e copie.')); return; }
  if (action.type === 'import-timeline') {
    const have = new Set(data.ceremonial.map(c => normalizeKey(c.title)));
    const rows = action.rows.filter(r => !have.has(normalizeKey(r.title)));
    if (!rows.length) { notify('Esses horários já estão no Cerimonial.'); return; }
    rows.forEach(r => data.ceremonial.push({ id: uid('c'), time: r.time, title: r.title, responsible: r.track === 'Geral' ? '' : r.track, status: 'A Fazer', details: 'Modelo da cerimonialista virtual', track: r.track }));
    save(`${rows.length} ${rows.length === 1 ? 'horário adicionado' : 'horários adicionados'} ao Cerimonial. Ajuste o que precisar.`, false);
    button.disabled = true; button.textContent = 'Adicionado ao Cerimonial ✓';
  }
}
function askThreadHtml() {
  const chips = askChips;
  const hello = `<div class="ask-msg is-bot"><p>Oi! ♡ Sou a sua cerimonialista virtual. Me conte em que pé está cada coisa ("tô olhando o fotógrafo", "já fechei o buffet") ou pergunte o que quiser: fornecedores, contrato, cronograma do dia, cortejo, convites, votos...</p>${askThread.length ? '' : chips(QUESTIONS)}</div>`;
  return hello + askThread.map((m, i) => `<div class="ask-msg is-me">${esc(m.question)}</div>${m.reply?.ai ? aiReplyHtml(m.reply, i) : m.reply ? `<div class="ask-msg is-bot"><h3>${esc(m.reply.title)}</h3>${m.reply.intro ? `<p>${esc(m.reply.intro)}</p>` : ''}${m.reply.lines.length ? (m.reply.lines.every(l => /^\d+\. /.test(l)) ? `<ol>${m.reply.lines.map(l => `<li>${esc(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>` : `<ul>${m.reply.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`) : ''}${m.reply.action ? `<button type="button" class="button button-secondary button-sm ask-action" data-ask-action="${i}">${icon(m.reply.action.type === 'copy' ? 'note' : 'calendar')}${esc(m.reply.action.label)}</button>` : ''}${m.reply.go?.page ? `<button type="button" class="text-button" data-ask-go="${esc(m.reply.go.page)}">${esc(m.reply.go.label || 'Abrir')} → ${esc(navLabels[m.reply.go.page] || '')}</button>` : ''}${i === askThread.length - 1 && m.reply.follow?.length ? chips(m.reply.follow) : ''}</div>` : '<div class="ask-msg is-bot is-typing" aria-label="Digitando"><i></i><i></i><i></i></div>'}`).join('');
}
// Resposta da IA: markdown simples (parágrafos, listas e **negrito**), sempre escapado.
function aiTextHtml(text) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  const blocks = []; let list = null;
  text.split('\n').forEach(line => {
    const t = line.trim().replace(/^#+\s*/, ''), ul = t.match(/^[-*•]\s+(.*)/), ol = t.match(/^\d+[.)]\s+(.*)/);
    if (ul || ol) { const tag = ul ? 'ul' : 'ol'; if (list?.tag !== tag) blocks.push(list = { tag, items: [] }); list.items.push((ul || ol)[1]); return; }
    list = null; if (t) blocks.push({ p: t });
  });
  return blocks.map(b => (b.p ? `<p>${inline(b.p)}</p>` : `<${b.tag}>${b.items.map(item => `<li>${inline(item)}</li>`).join('')}</${b.tag}>`)).join('');
}
const askChips = list => `<div class="ask-chips">${list.map(q => `<button type="button" class="ask-chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
// O balão da IA é atualizado no lugar enquanto a resposta chega (data-ai-reply), sem redesenhar a conversa.
function aiReplyInner(reply, i) {
  const { text, go, follow } = parseAI(reply.raw);
  if (!text) return `<i></i><i></i><i></i>${reply.slow ? '<span>Pensando com carinho…</span>' : ''}`;
  return `${aiTextHtml(text)}${reply.done ? '' : '<span class="ask-more" aria-label="Escrevendo"><i></i><i></i><i></i></span>'}${reply.done && reply.action ? `<button type="button" class="button button-secondary button-sm ask-action" data-ask-action="${i}">${icon('calendar')}${esc(reply.action.label)}</button>` : ''}${reply.done && go ? `<button type="button" class="text-button" data-ask-go="${go}">Abrir → ${esc(navLabels[go])}</button>` : ''}${reply.done && i === askThread.length - 1 && follow.length ? askChips(follow) : ''}`;
}
function aiReplyHtml(reply, i) { return `<div class="ask-msg is-bot ${parseAI(reply.raw).text ? '' : 'is-typing'}" data-ai-reply="${i}">${aiReplyInner(reply, i)}</div>`; }
function heading(kicker, title, desc, action = '') { return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${action}</div></div>`; }
function renderAssistant() {
  return `${heading('SUA CERIMONIALISTA', 'Cerimonialista virtual.', 'Converse do seu jeito e veja o que precisa de atenção agora. Eu respondo com os dados do seu casamento.', askThread.length ? '<button type="button" class="button button-secondary" data-ask-clear>Limpar conversa</button>' : '')}
  <section class="assistant-grid assistant-page">
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Pergunte à cerimonialista</h2><p class="panel-subtitle">Fornecedores, contrato, cronograma do dia, cortejo, convites, votos...</p></div></div><div class="ask-thread" id="ask-thread" aria-live="polite">${askThreadHtml()}</div><form class="ask-form" id="ask-form"><textarea name="q" rows="1" placeholder="Escreva do seu jeito: tô perdida, me dá uma dica..." aria-label="Sua pergunta"></textarea><button class="button button-primary button-sm" type="submit">Enviar</button></form></article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">O que precisa de atenção</h2><p class="panel-subtitle">Avisos a partir do seu planejamento</p></div></div><div class="alert-list">${alerts(data).map(a => `<button type="button" class="alert-item alert-${a.level}" ${a.action ? `data-action="${a.action}"` : a.page ? `data-go="${a.page}"` : 'disabled'}><span class="alert-dot" aria-hidden="true"></span><span><strong>${esc(a.title)}</strong><small>${esc(a.text)}</small></span></button>`).join('')}</div></article>
  </section>`;
}
function renderDashboard() {
  const countdown = countdownState();
  const pending = data.tasks.filter(t => t.status !== 'Concluído').sort(byTaskOrder), next = pending[0], tasks = pending.slice(0, 5);
  const doneTasks = data.tasks.length - pending.length, paidRatio = planned() ? Math.min(100, Math.round((planned() - due()) / planned() * 100)) : 0, onSite = data.supplies.filter(s => s.status === 'No Local').length;
  const groups = allExpenseCategories().map(c => { const sum = data.expenses.filter(e => e.category === c).reduce((a, e) => a + Number(e.planned || 0), 0); return { c, sum }; }).filter(x => x.sum).sort((a, b) => b.sum - a.sum);
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const stat = (page, iconName, label, value, foot) => `<button class="card stat-card" data-go="${page}"><div class="stat-top"><span class="stat-icon">${icon(iconName)}</span><span>${label}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></button>`;
  return `${heading('PAINEL DO CASAMENTO', 'Visão geral.', today, '<button class="button button-pill" data-go="convidados">Convidados</button><button class="button button-pill" data-go="financeiro">Financeiro</button><button class="button button-pill" data-action="edit-wedding">Detalhes do casamento</button>')}
  <section class="card event-card"><span class="event-icon">${icon('heart')}</span><div class="event-info"><div class="event-title"><h2>${esc(data.wedding.couple || 'Nosso casamento')}</h2><span class="status-pill ${countdown.complete ? 'is-done' : ''}"><i></i>${countdown.unknown ? 'Data a definir' : countdown.complete ? 'Casamento realizado' : countdown.days === 0 ? 'É hoje!' : `Faltam ${countdown.days} ${countdown.days === 1 ? 'dia' : 'dias'}`}</span></div><p>${[esc(data.wedding.venue || 'Local a definir'), dateLabel(data.wedding.date), esc(data.wedding.time || '')].filter(Boolean).join(' · ')}</p></div>
  <div class="countdown ${countdown.complete || countdown.unknown ? 'countdown-complete' : ''}" id="live-countdown" aria-label="Contagem regressiva">${countdown.unknown ? '<strong>Quando é o grande dia?</strong><span>Defina a data em "Editar detalhes"</span>' : countdown.complete ? '<strong>O grande dia já aconteceu ♡</strong><span>Atualize a data nos detalhes</span>' : `<div class="count-unit"><strong data-count="days">${countdown.days}</strong><span>dias</span></div><div class="count-unit"><strong data-count="hours">${String(countdown.hours).padStart(2, '0')}</strong><span>horas</span></div><div class="count-unit"><strong data-count="minutes">${String(countdown.minutes).padStart(2, '0')}</strong><span>min</span></div><div class="count-unit"><strong data-count="seconds">${String(countdown.seconds).padStart(2, '0')}</strong><span>seg</span></div>`}</div>
  <div class="event-actions"><button class="button button-primary" data-go="cronograma">${icon('calendar')} Ver cronograma</button><button class="button button-secondary" data-action="edit-wedding">${icon('settings')} Editar detalhes</button></div></section>
  ${weddingProfile()}
  <section class="notice-card"><div><strong>${next ? 'Próximo passo' : data.tasks.length ? 'Tudo em dia' : 'Vamos começar?'}</strong><p>${next ? `${esc(next.title)} · ${esc(next.date ? shortDate(next.date) : 'Prioridade')}${next.time ? `, ${esc(next.time)}` : ''}` : data.tasks.length ? 'Todas as tarefas do cronograma foram concluídas. Agora é só aproveitar.' : 'Seu organizador está novinho. Adicione a primeira tarefa do cronograma ou cadastre os convidados.'}</p></div>${next ? `<button class="button button-secondary" data-task-done="${next.id}">Marcar como feita</button>` : data.tasks.length ? '' : `<button class="button button-secondary" data-action="add-task">${icon('plus')} Adicionar tarefa</button>`}</section>
  <section class="stats-grid">${stat('convidados', 'users', 'Confirmados', confirmedGuests(), `de ${totalGuests()} pessoas na lista`)}${stat('financeiro', 'wallet', 'Total pago', money(spent()), `de ${money(planned() - gifted())} a pagar no total`)}${stat('financeiro', 'clock', 'Saldo a pagar', money(due()), `${paidRatio}% já quitado ou ganho`)}${stat('cronograma', 'check', 'Tarefas', `${doneTasks}/${data.tasks.length}`, `${progress()}% do cronograma`)}${stat('checklist', 'box', 'Itens no local', `${onSite}/${data.supplies.length}`, 'do checklist do que levar')}</section>
  <section class="dashboard-grid"><article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Visão do orçamento</h2><p class="panel-subtitle">Quanto já foi pago e para onde vai o dinheiro</p></div><button class="text-button" data-go="financeiro">Ver detalhes →</button></div><div class="budget-total">${money(spent())}</div><div class="budget-meta"><span>do total de ${money(planned())}</span><span>${paidRatio}% pago</span></div><div class="progress-track"><span style="width:${paidRatio}%"></span></div><div class="legend-row"><span><i class="legend-dot"></i>Valor pago</span><span><i class="legend-dot soft"></i>Restante</span></div><div class="category-list" style="margin-top:22px">${groups.length ? groups.map(x => `<div class="category-row"><span class="category-name">${esc(x.c)}</span><span class="category-value">${money(x.sum)}</span><div class="mini-track"><span style="width:${Math.max(3, Math.round(x.sum / planned() * 100))}%"></span></div></div>`).join('') : empty('Adicione seus primeiros gastos.')}</div></article>
  <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Próximas tarefas</h2><p class="panel-subtitle">${pending.length} ${pending.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}</p></div><button class="text-button" data-go="cronograma">Ver cronograma →</button></div><div class="task-list">${tasks.length ? tasks.map(t => `<label class="task-row"><input class="task-check" type="checkbox" data-task-check="${t.id}"><span class="task-text">${esc(t.title)}</span><span class="task-meta">${esc(t.date ? shortDate(t.date) : 'Prioridade')}${t.time ? ` · ${esc(t.time)}` : ''}</span></label>`).join('') : empty(data.tasks.length ? 'Tudo por aqui concluído!' : 'Nenhuma tarefa ainda.')}</div></article></section>`;
}
function weddingProfile() {
  // Já orçado: só o que o casal vai pagar (presentes ganhos ficam de fora). Por convidado: custo total, com presentes.
  const w = data.wedding, budget = Number(w.budget || 0), guests = Number(w.guestsExpected || 0), gifts = gifted(), used = planned() - gifts;
  const ratio = budget ? Math.round(used / budget * 100) : 0, over = budget && used > budget;
  return `<section class="card wedding-profile"><div class="profile-info"><p class="eyebrow">NOSSO CASAMENTO</p><h2>Um dia para lembrar</h2><ul>${w.date ? `<li>${icon('calendar')}${dateLabel(w.date)}</li>` : ''}<li>${icon('users')}${guests ? `${guests} convidados previstos` : 'Convidados previstos a definir'}</li><li>${icon('heart')}Estilo ${esc((w.style || 'a definir').toLowerCase())}${w.ceremonyType ? ` · cerimônia ${esc(w.ceremonyType.toLowerCase())}` : ''}</li></ul></div>
    <div class="profile-boxes"><div class="profile-box"><span>Orçamento máximo</span><strong class="is-accent">${budget ? money(budget) : '—'}</strong></div><div class="profile-box"><span>Por convidado</span><strong>${guests ? money((used + gifts) / guests) : '—'}</strong>${guests ? `<small>Custo total do casamento${gifts ? `, com ${money(gifts)} em presentes · vocês pagam ${money(used / guests)}` : ''}${budget ? ` · limite ${money(budget / guests)}` : ''}</small>` : ''}</div><div class="profile-box profile-used"><span>Já orçado</span><strong class="${over ? 'is-over' : ''}">${money(used)}</strong>${budget ? `<div class="mini-track ${over ? 'is-over' : ''}"><span style="width:${Math.min(100, ratio)}%"></span></div><small>${over ? `${money(used - budget)} acima do orçamento máximo (${ratio}%)` : `${ratio}% do orçamento máximo`}</small>` : ''}${gifts ? `<small class="profile-gifts">Sem contar ${money(gifts)} em presentes ganhos</small>` : ''}</div></div>
    ${budget && guests ? '<p class="profile-note">O valor por convidado é uma referência para o casamento inteiro, não só para a comida.</p>' : `<button type="button" class="button button-secondary button-sm profile-edit" data-action="edit-wedding">${icon('settings')}Definir orçamento e convidados</button>`}</section>`;
}
function renderVendors() {
  const vendors = data.vendors || [], budget = Number(data.wedding.budget || 0);
  const active = vendors.filter(v => v.status !== 'Descartado');
  const contracted = vendors.filter(v => v.status === 'Contratado');
  const categories = allExpenseCategories().filter(c => vendors.some(v => v.category === c && (vendorTab === 'Todos' ? v.status !== 'Descartado' : vendorTab === 'Contratados' ? v.status === 'Contratado' : vendorTab === 'Em andamento' ? ['Orçando', 'Orçamento recebido', 'Negociando'].includes(v.status) : vendorTab === 'Pesquisando' ? v.status === 'Pesquisando' : v.status === 'Descartado')));
  const missing = checklist(data).filter(i => i.hire && !i.done && !vendors.some(v => v.category === i.hire));
  const card = (v, best) => {
    const final = vendorFinal(v), includes = String(v.includes || '').split('\n').map(x => x.trim()).filter(Boolean), files = (v.files || []).length + (v.links || []).length;
    const phone = String(v.phone || '').replace(/\D/g, '').replace(/^(?!55)(\d{10,11})$/, '55$1');
    const expense = data.expenses.find(e => e.id === v.expenseId);
    return `<article class="vendor-card status-${slugOf(v.status)} ${best ? 'is-best' : ''}">
      <header class="vendor-head"><div><h3>${esc(v.name)}</h3>${v.contact ? `<small>${esc(v.contact)}</small>` : ''}</div><select class="status-select" data-vendor-status="${v.id}" aria-label="Status de ${esc(v.name)}">${VENDOR_STATUSES.map(st => `<option ${v.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select></header>
      ${best ? '<span class="vendor-flag">Menor preço</span>' : ''}
      <div class="vendor-price"><strong>${final ? money(final) : 'Sem valor ainda'}</strong>${Number(v.discount) || Number(v.fees) ? `<small>${money(v.price)}${Number(v.discount) ? ` − ${money(v.discount)} de desconto` : ''}${Number(v.fees) ? ` + ${money(v.fees)} de taxas` : ''}</small>` : ''}${budget && final ? `<small>${(final / budget * 100).toFixed(1).replace('.', ',')}% do orçamento total</small>` : ''}</div>
      ${includes.length ? `<ul class="vendor-includes">${includes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${v.conditions ? `<p class="vendor-text"><b>Condições:</b> ${esc(v.conditions)}</p>` : ''}
      ${v.agreed ? `<p class="vendor-text"><b>O que ficou combinado:</b> ${esc(v.agreed)}</p>` : ''}
      ${v.notes ? `<p class="vendor-text"><b>Negociação:</b> ${esc(v.notes)}</p>` : ''}
      ${Number(v.overtime) ? `<p class="vendor-text"><b>Hora extra:</b> ${money(v.overtime)} por hora</p>` : ''}
      ${expense?.installments?.length ? (() => { const list = expense.installments, next = list.filter(x => !x.paid).sort((a, b) => (a.due || '').localeCompare(b.due || ''))[0]; return `<p class="vendor-text vendor-parts"><b>Parcelas:</b> ${list.filter(x => x.paid).length} de ${list.length} pagas${next ? ` · próxima ${next.due ? esc(shortDate(next.due)) : 'sem data'} (${money(next.amount)})` : ' · tudo pago ♡'} <button type="button" class="text-button" data-action="installments-expense" data-id="${expense.id}">Ver parcelas</button></p>`; })() : ''}
      ${v.status === 'Contratado' || v.contractStatus ? `<button type="button" class="contract-pill contract-${slugOf(v.contractStatus || 'Sem contrato')}" data-action="attach-vendor" data-id="${v.id}">${icon('note')}Contrato: ${esc(v.contractStatus || 'Sem contrato')}${files ? ` · ${files} ${files === 1 ? 'anexo' : 'anexos'}` : ''}</button>` : ''}
      ${phone || v.email || v.link ? `<div class="vendor-contact">${phone ? `<a class="button button-secondary button-sm" href="https://wa.me/${phone}" target="_blank" rel="noopener">${icon('chat')}WhatsApp</a>` : ''}${v.email ? `<a class="button button-secondary button-sm" href="mailto:${esc(v.email)}">E-mail</a>` : ''}${v.link ? `<a class="button button-secondary button-sm" href="${esc(safeNoteUrl(/^[a-z]+:/i.test(v.link) ? v.link : `https://${v.link}`))}" target="_blank" rel="noopener noreferrer">${icon('link')}Site</a>` : ''}</div>` : ''}
      <footer class="vendor-foot">${v.status === 'Contratado' ? `<span class="vendor-hired">✓ Contratado${expense ? ` · ${money(expense.planned)}` : ''}</span>` : `<button type="button" class="button button-primary button-sm" data-action="contract-vendor" data-id="${v.id}">Contratar</button>`}<div class="row-actions"><button type="button" class="attach-button" data-action="attach-vendor" data-id="${v.id}" aria-label="Anexos" title="Propostas, contratos e links">${icon('clip')}${files ? `<span class="attach-count">${files}</span>` : ''}</button><button type="button" data-action="edit-vendor" data-id="${v.id}" aria-label="Editar">${icon('edit')}</button><button type="button" data-action="delete-vendor" data-id="${v.id}" aria-label="Excluir">${icon('trash')}</button></div></footer>
    </article>`;
  };
  const inTab = v => vendorTab === 'Todos' ? v.status !== 'Descartado' : vendorTab === 'Contratados' ? v.status === 'Contratado' : vendorTab === 'Em andamento' ? ['Orçando', 'Orçamento recebido', 'Negociando'].includes(v.status) : vendorTab === 'Pesquisando' ? v.status === 'Pesquisando' : v.status === 'Descartado';
  const section = cat => {
    const list = vendors.filter(v => v.category === cat && inTab(v));
    const priced = list.filter(v => v.status !== 'Descartado' && vendorFinal(v) > 0), best = priced.length > 1 ? priced.reduce((a, b) => (vendorFinal(b) < vendorFinal(a) ? b : a)) : null;
    const hiredOne = vendors.find(v => v.category === cat && v.status === 'Contratado'), ideal = budget && BUDGET_SPLIT[cat] ? budget * BUDGET_SPLIT[cat] : 0;
    return `<section class="vendor-section"><div class="vendor-section-head"><div><h2>${esc(cat)}</h2><p>${list.length} ${list.length === 1 ? 'opção' : 'opções'} · ${hiredOne ? `contratado: ${esc(hiredOne.name)}` : 'ainda não contratado'}${ideal ? ` · sugestão até ${money(ideal)}` : ''}</p></div><button type="button" class="button button-secondary button-sm" data-action="add-vendor" data-id="${esc(cat)}">${icon('plus')}Opção</button></div>${list.length ? `<div class="vendor-grid">${list.map(v => card(v, best && v.id === best.id && !hiredOne)).join('')}</div>` : '<p class="vendor-empty">Só há opções descartadas nesta categoria.</p>'}</section>`;
  };
  return `${heading('FORNECEDORES', 'Orçamentos & fornecedores.', 'Cadastre os orçamentos, compare lado a lado e contrate. O valor e as parcelas vão direto para o financeiro.', `<button class="button button-primary" data-action="add-vendor">${icon('plus')}Adicionar fornecedor</button>`)}
  <div class="summary-row"><span class="summary-chip">Fornecedores <strong>${vendors.length}</strong></span><span class="summary-chip">Contratados <strong>${contracted.length}</strong></span><span class="summary-chip">Não contratados <strong>${vendors.filter(v => !['Contratado', 'Descartado'].includes(v.status)).length}</strong></span><span class="summary-chip">Aguardando decisão <strong>${active.filter(v => ['Orçamento recebido', 'Negociando'].includes(v.status)).length}</strong></span><span class="summary-chip">Total contratado <strong>${money(contracted.reduce((n, v) => n + Number(data.expenses.find(e => e.id === v.expenseId)?.planned ?? vendorFinal(v)), 0))}</strong></span></div>
  ${missing.length ? `<section class="notice-card vendor-missing"><div><strong>Ainda falta pesquisar</strong><p>Pelo prazo do seu casamento, estas contratações já deveriam estar andando.</p></div><div class="row-buttons">${missing.map(i => `<button type="button" class="button button-secondary button-sm" data-action="add-vendor" data-id="${esc(i.hire)}">${icon('plus')}${esc(i.hire)}${i.late ? ' · atrasado' : ''}</button>`).join('')}</div></section>` : ''}
  <div class="custom-tabs view-tabs vendor-tabs" role="tablist">${[['Todos', vendors.filter(v => v.status !== 'Descartado').length], ['Contratados', contracted.length], ['Em andamento', vendors.filter(v => ['Orçando', 'Orçamento recebido', 'Negociando'].includes(v.status)).length], ['Pesquisando', vendors.filter(v => v.status === 'Pesquisando').length], ['Descartados', vendors.filter(v => v.status === 'Descartado').length]].map(([tab, n]) => `<button type="button" role="tab" data-vendor-tab="${tab}" aria-selected="${vendorTab === tab}">${tab} <small>${n}</small></button>`).join('')}</div>
  ${categories.length ? categories.map(section).join('') : `<section class="card">${empty(vendors.length ? 'Nenhum fornecedor nesta aba.' : 'Nenhum fornecedor ainda. Cadastre o primeiro orçamento que você recebeu.')}</section>`}`;
}
function contractVendor(id) {
  const v = data.vendors.find(x => x.id === id);
  if (!v) return;
  openModal(`Contratar ${v.name}`, [
    `<p class="confirm-copy">O gasto entra no financeiro em <strong>${esc(v.category)}</strong>, com a entrada e as parcelas abaixo. Depois é só marcar cada parcela como paga.</p>`,
    field('total', 'Valor fechado (R$)', vendorFinal(v) || '', 'number', null, false, { min: 0, step: '.01', required: true }),
    field('method', 'Forma de pagamento', 'Pix', 'text', ['Pix', 'Cartão', 'Boleto', 'Dinheiro', 'Transferência']),
    field('entry', 'Entrada (R$)', 0, 'number', null, false, { min: 0, step: '.01' }),
    field('entryDate', 'Data da entrada', todayIso(), 'date'),
    field('count', 'Parcelas depois da entrada', 1, 'number', null, false, { min: 0 }),
    field('firstDate', 'Vencimento da 1ª parcela', addDays(todayIso(), 30), 'date'),
  ].join(''), values => {
    const total = Number(values.total || 0), entry = Math.min(total, Number(values.entry || 0)), count = Math.max(0, Math.round(Number(values.count || 0)));
    const parts = [], rest = Math.round((total - entry) * 100) / 100;
    if (entry > 0) parts.push({ id: uid('p'), label: 'Entrada', amount: entry, due: values.entryDate || todayIso(), paid: false });
    if (rest > 0) {
      const n = Math.max(1, count), each = Math.floor(rest / n * 100) / 100;
      for (let i = 0; i < n; i++) {
        const d = fromIso(values.firstDate || todayIso()); d.setMonth(d.getMonth() + i);
        parts.push({ id: uid('p'), label: n === 1 ? 'Pagamento' : `Parcela ${i + 1}/${n}`, amount: i === n - 1 ? Math.round((rest - each * (n - 1)) * 100) / 100 : each, due: isoDate(d), paid: false });
      }
    }
    const fields = { description: v.name, category: v.category, supplier: v.name, planned: total, installments: parts, notes: [`Contratado · ${values.method}`, v.conditions].filter(Boolean).join(' · ').slice(0, 200) };
    let expense = data.expenses.find(e => e.id === v.expenseId);
    if (expense) Object.assign(expense, fields, { paid: 0 });
    else { expense = { id: uid('e'), paid: 0, status: 'Pendente', ...fields }; data.expenses.push(expense); }
    v.status = 'Contratado'; v.expenseId = expense.id;
    data.tasks.filter(t => t.hireCategory === v.category && t.status !== 'Concluído').forEach(t => { t.status = 'Concluído'; });
    save(`${v.name} contratado. ${parts.length} ${parts.length === 1 ? 'pagamento lançado' : 'pagamentos lançados'} no financeiro.`);
  });
  $('#modal-submit').textContent = 'Contratar e lançar no financeiro';
}
function openInstallments(id) {
  const e = data.expenses.find(x => x.id === id);
  if (!e) return;
  const row = p => `<div class="inst-row" data-inst="${p.id}"><input type="checkbox" data-k="paid" ${p.paid ? 'checked' : ''} aria-label="Paga"><input data-k="label" value="${esc(p.label || '')}" placeholder="Parcela" aria-label="Nome"><input type="number" step=".01" min="0" data-k="amount" value="${esc(p.amount ?? '')}" placeholder="Valor" aria-label="Valor"><input type="date" data-k="due" value="${esc(p.due || '')}" aria-label="Vencimento"><button type="button" class="icon-button" data-remove-inst aria-label="Remover parcela">×</button></div>`;
  openModal(`Parcelas · ${e.description}`, `<div class="inst-head" style="grid-column:1/-1"><span>Paga</span><span>Parcela</span><span>Valor</span><span>Vencimento</span><span></span></div><div class="inst-list" id="inst-list" style="grid-column:1/-1">${(e.installments || []).map(row).join('')}</div><button type="button" class="button button-secondary button-sm" id="inst-add" style="grid-column:1/-1;justify-self:start">${icon('plus')}Parcela</button><p class="field-hint" style="grid-column:1/-1;margin:0">Marque as parcelas pagas: o valor pago do gasto se atualiza sozinho e os vencimentos aparecem nos alertas do painel.</p>`, () => {
    const list = [...$('#inst-list').querySelectorAll('.inst-row')].map(r => ({ id: r.dataset.inst, label: r.querySelector('[data-k="label"]').value.trim(), amount: Number(r.querySelector('[data-k="amount"]').value || 0), due: r.querySelector('[data-k="due"]').value, paid: r.querySelector('[data-k="paid"]').checked })).filter(p => p.amount > 0);
    e.installments = list;
    if (list.length) e.paid = Math.round(list.filter(p => p.paid).reduce((n, p) => n + p.amount, 0) * 100) / 100;
    save('Parcelas salvas.');
  });
  $('#inst-add').onclick = () => { $('#inst-list').insertAdjacentHTML('beforeend', row({ id: uid('p'), amount: '', due: '' })); $('#inst-list').lastElementChild.querySelector('[data-k="label"]').focus(); };
  $('#inst-list').onclick = ev => { if (ev.target.closest('[data-remove-inst]')) ev.target.closest('.inst-row').remove(); };
}
function addChecklistItems(keys = null) {
  const today = todayIso();
  const items = checklist(data).filter(i => !i.done && !i.added && (!keys || keys.includes(i.key)));
  items.forEach(i => data.tasks.push({ id: uid('t'), title: i.title, date: i.due < today ? today : i.due, time: '', priority: i.hire || i.late ? 'Alta' : 'Média', status: 'A Fazer', responsible: '', responsiblePhone: '', description: 'Sugestão da cerimonialista virtual', templateKey: i.key, hireCategory: i.hire || '' }));
  return items.length;
}
function renderGuests() {
  const statusOk = g => guestStatusFilter === 'Todos' || g.status === guestStatusFilter;
  const visible = data.guests.filter(g => (guestFilter === 'Todos' || g.group === guestFilter) && statusOk(g) && `${g.name} ${g.phone} ${g.family || ''}`.toLowerCase().includes(guestSearch.toLowerCase()));
  const confirmed = data.guests.filter(g => g.status === 'Confirmado'), waiting = data.guests.filter(g => ['Pendente', 'Enviado'].includes(g.status));
  const adults = confirmed.reduce((n, g) => n + 1 + Number(g.companions || 0), 0), kids = confirmed.reduce((n, g) => n + Number(g.children || 0), 0);
  const diet = data.guests.filter(g => g.dietary && g.status !== 'Recusado'), expected = Number(data.wedding.guestsExpected || 0), total = totalGuests();
  const tableName = id => data.tables.find(t => t.id === id)?.name || '';
  const newRsvps = (siteRsvps || []).filter(r => !data.importedRsvps.includes(r.id));
  const row = g => `<tr><td><div class="person-cell"><span class="person-avatar">${esc(g.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase())}</span><span><span class="person-name">${esc(g.name)}</span><span class="person-sub">${[g.family ? `Família ${esc(g.family)}` : '', Number(g.children) ? `${g.children} criança(s)` : ''].filter(Boolean).join(' · ') || 'Convidado(a)'}</span>${g.dietary ? `<span class="diet-chip">${esc(g.dietary)}</span>` : ''}</span></div></td><td>${esc(g.group)}</td><td>${g.phone ? `<a class="phone-link" href="${esc(waLink(g.phone, `Oi, ${g.name.split(' ')[0]}! ♡`))}" target="_blank" rel="noopener">${esc(g.phone)}</a>` : '—'}</td><td>${badge(g.status)}</td><td>${people(g)} · ${Number(g.companions || 0)} acomp. · ${Number(g.children || 0)} crianças</td><td>${esc(tableName(g.tableId) || '—')}</td><td><div class="row-actions"><button data-action="edit-guest" data-id="${g.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-guest" data-id="${g.id}" aria-label="Excluir">${icon('trash')}</button></div></td></tr>`;
  const families = [...new Set(visible.map(g => g.family || g.name))].sort((a, b) => a.localeCompare(b));
  const chip = g => `<span class="guest-chip status-${slugOf(g.status)}" draggable="true" data-guest-id="${g.id}" title="${esc(g.status)}"><b>${esc(g.name)}</b>${people(g) > 1 ? `<small>+${people(g) - 1}</small>` : ''}${g.dietary ? `<i title="${esc(g.dietary)}">●</i>` : ''}</span>`;
  const seated = t => data.guests.filter(g => g.tableId === t.id && g.status !== 'Recusado');
  const unseated = data.guests.filter(g => !data.tables.some(t => t.id === g.tableId) && g.status !== 'Recusado');
  const view = guestView === 'familia'
    ? `<div class="family-grid">${families.length ? families.map(f => { const members = visible.filter(g => (g.family || g.name) === f); return `<article class="card family-card"><header><h3>${esc(members.length > 1 || members[0]?.family ? `Família ${f}` : f)}</h3><span>${members.reduce((n, g) => n + people(g), 0)} pessoas</span></header><ul>${members.map(g => `<li><button type="button" class="month-task" data-action="edit-guest" data-id="${g.id}">${esc(g.name)}${people(g) > 1 ? ` <small>+${people(g) - 1}</small>` : ''}</button>${badge(g.status)}</li>`).join('')}</ul></article>`; }).join('') : `<section class="card">${empty('Nenhum convidado encontrado.')}</section>`}</div>`
    : guestView === 'mesas'
      ? `<div class="toolbar"><button type="button" class="button button-secondary" data-action="add-table">${icon('plus')}Mesa</button><span class="field-hint">Arraste os convidados para as mesas (no celular, edite o convidado e escolha a mesa).</span></div>
        <div class="tables-layout"><aside class="card table-pool" data-table-drop=""><h3>Sem mesa · ${unseated.reduce((n, g) => n + people(g), 0)} pessoas</h3><div class="chip-wrap">${unseated.map(chip).join('') || '<p class="priority-empty">Todos sentados ♡</p>'}</div></aside>
        <div class="tables-grid">${data.tables.length ? data.tables.map(t => { const list = seated(t), used = list.reduce((n, g) => n + people(g), 0), seats = Number(t.seats || 0); return `<article class="card seat-table ${seats && used > seats ? 'is-over' : ''}" data-table-drop="${t.id}"><header><div><h3>${esc(t.name)}</h3><small>${used}${seats ? ` de ${seats}` : ''} lugares</small></div><div class="row-actions"><button data-action="edit-table" data-id="${t.id}" aria-label="Editar mesa">${icon('edit')}</button><button data-action="delete-table" data-id="${t.id}" aria-label="Excluir mesa">${icon('trash')}</button></div></header>${seats ? `<div class="mini-track"><span style="width:${Math.min(100, Math.round(used / seats * 100))}%"></span></div>` : ''}<div class="chip-wrap">${list.map(chip).join('') || '<p class="priority-empty">Arraste convidados para cá.</p>'}</div></article>`; }).join('') : `<section class="card">${empty('Crie as mesas da festa para organizar os lugares.')}</section>`}</div></div>`
      : `<section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Convidado</th><th>Grupo</th><th>Telefone / WhatsApp</th><th>Convite</th><th>Pessoas</th><th>Mesa</th><th></th></tr></thead><tbody>${visible.length ? visible.map(row).join('') : `<tr><td colspan="7">${empty('Nenhum convidado encontrado.')}</td></tr>`}</tbody></table></div><div class="table-footer">Exibindo <strong>${visible.length}</strong> de <strong>${data.guests.length}</strong> convidados</div></section>`;
  return `${heading('LISTA DE CONVIDADOS', 'Convidados.', 'Família, confirmações, restrições e mesas, prontos para mandar ao buffet.', `<button class="button button-secondary" data-action="export-guests">${icon('download')}Lista para o buffet</button><button class="button button-secondary" data-action="export-guests-csv">${icon('download')}Planilha</button><button class="button button-secondary" data-action="import-guests">${icon('upload')}Importar TXT</button><button class="button button-primary" data-action="add-guest">${icon('plus')}Adicionar convidado</button>`)}
  <div class="summary-row"><span class="summary-chip">Na lista <strong>${total}</strong></span><span class="summary-chip">Confirmados <strong>${adults + kids}</strong> <small>${adults} adultos · ${kids} crianças</small></span><span class="summary-chip">Sem resposta <strong>${waiting.reduce((n, g) => n + people(g), 0)}</strong></span><span class="summary-chip">Restrições <strong>${diet.length}</strong></span>${expected ? `<span class="summary-chip ${total > expected ? 'is-late' : ''}">Previstos <strong>${expected}</strong> <small>${total > expected ? `${total - expected} a mais` : `${expected - total} vagas`}</small></span>` : ''}</div>
  ${(() => { const budget = Number(data.wedding.budget || 0), cost = planned(), going = adults + kids; return budget || cost ? `<section class="card guest-budget"><div><span>Orçamento por convidado</span><strong>${budget && expected ? money(budget / expected) : '—'}</strong><small>${budget && expected ? `orçamento máximo ÷ ${expected} previstos` : 'Defina orçamento e convidados previstos'}</small></div><div><span>Custo atual por pessoa da lista</span><strong>${total ? money(cost / total) : '—'}</strong><small>${money(cost)} orçados ÷ ${total} pessoas</small></div><div><span>Custo por confirmado</span><strong>${going ? money(cost / going) : '—'}</strong><small>${going} ${going === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}</small></div>${budget && expected && total ? `<div><span>Cada convidado a mais</span><strong>${money((data.expenses.filter(e => e.category === 'Comidas & Buffet').reduce((n, e) => n + Number(e.planned || 0), 0) / Math.max(total, expected, 1)) || budget / expected)}</strong><small>buffet orçado ÷ ${Math.max(total, expected)} pessoas</small></div>` : ''}</section>` : ''; })()}
  ${newRsvps.length ? `<section class="notice-card rsvp-notice"><div><strong>${newRsvps.length} ${newRsvps.length === 1 ? 'confirmação chegou' : 'confirmações chegaram'} pelo site</strong><p>${newRsvps.slice(0, 4).map(r => `${esc(r.name)} (${r.attending ? `vai · ${r.people} ${r.people === 1 ? 'pessoa' : 'pessoas'}` : 'não vai'})`).join(' · ')}${newRsvps.length > 4 ? '…' : ''}</p></div><button type="button" class="button button-primary" data-action="import-rsvps">Trazer para a lista</button></section>` : ''}
  <div class="custom-tabs view-tabs" role="tablist"><button type="button" role="tab" data-guest-view="lista" aria-selected="${guestView === 'lista'}">Lista</button><button type="button" role="tab" data-guest-view="familia" aria-selected="${guestView === 'familia'}">Por família</button><button type="button" role="tab" data-guest-view="mesas" aria-selected="${guestView === 'mesas'}">Mesas</button></div>
  ${guestView === 'mesas' ? '' : `<div class="toolbar"><label class="search-box"><span class="search-mark">${icon('search')}</span><input id="guest-search" type="search" placeholder="Buscar por nome, família ou telefone" value="${esc(guestSearch)}"></label><select id="guest-filter" class="filter-select" aria-label="Grupo"><option>Todos</option>${guestGroups.map(g => `<option ${guestFilter === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select><select id="guest-status-filter" class="filter-select" aria-label="Status"><option>Todos</option>${guestStatuses.map(g => `<option ${guestStatusFilter === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>`}
  ${view}`;
}
function renderFinance() {
  const allCategories = allExpenseCategories();
  const categories = expenseFilter === 'Todas' ? allCategories : [expenseFilter];
  const suppliers = [...new Set(data.expenses.map(e => (e.supplier || '').trim()).filter(Boolean))].map(name => { const rows = data.expenses.filter(e => (e.supplier || '').trim() === name); return { name, rows, planned: rows.reduce((a, e) => a + Number(e.planned || 0), 0), due: rows.reduce((a, e) => a + dueOf(e), 0), giftDue: rows.reduce((a, e) => a + giftDueOf(e), 0) }; }).sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
  const dueCell = e => (isGift(e) ? (giftDueOf(e) > 0 ? `<span class="due-gift due-gift-left">${money(giftDueOf(e))}</span><span class="person-sub">do presente</span>` : `<span class="due-gift">${Number(e.planned || 0) ? 'Presente quitado' : 'Presente'}</span>`) : dueOf(e) > 0 ? `<span class="due-value">${money(dueOf(e))}</span>` : '<span class="due-done">Quitado</span>');
  const totals = rows => { const paid = rows.reduce((a, e) => a + (isGift(e) ? 0 : Number(e.paid || 0)), 0), gift = rows.filter(isGift).reduce((a, e) => a + Number(e.planned || 0), 0), left = rows.reduce((a, e) => a + dueOf(e), 0), giftLeft = rows.reduce((a, e) => a + giftDueOf(e), 0); return `<div class="category-totals"><span class="category-total">${money(paid)} pagos</span>${gift > 0 ? `<span class="category-total category-gift">${money(gift)} em presentes</span>` : ''}${left > 0 ? `<span class="category-total category-due">${money(left)} faltam</span>` : ''}${giftLeft > 0 ? `<span class="category-total category-gift">${money(giftLeft)} de presente faltam</span>` : ''}</div>`; };
  const row = e => { const files = (e.files || []).length + (e.links || []).length; return `<tr><td><span class="person-name">${esc(e.description)}</span>${e.supplier ? `<span class="person-sub">Fornecedor: ${esc(e.supplier)}</span>` : ''}${(e.installments || []).length ? (() => { const list = e.installments, next = list.filter(x => !x.paid).sort((a, b) => (a.due || '').localeCompare(b.due || ''))[0]; return `<span class="person-sub inst-sub ${next?.due && next.due < todayIso() ? 'is-late' : ''}">Parcelas: ${list.filter(x => x.paid).length}/${list.length} pagas${next ? ` · próxima ${next.due ? esc(shortDate(next.due)) : 'sem data'} (${money(next.amount)})${next.due && next.due < todayIso() ? ' · vencida' : ''}` : ''}</span>`; })() : ''}${e.notes ? `<span class="person-sub">${esc(e.notes)}</span>` : ''}</td><td>${money(e.planned)}</td><td>${money(e.paid)}</td><td>${dueCell(e)}</td><td>${badge(e.status, e.status.startsWith('Pago') || isGift(e) ? 'pago' : 'pendente')}</td><td><div class="row-actions"><button class="attach-button" data-action="attach-expense" data-id="${e.id}" aria-label="Anexos (${files})" title="Fotos, PDFs, contratos e links">${icon('clip')}${files ? `<span class="attach-count">${files}</span>` : ''}</button><button data-action="installments-expense" data-id="${e.id}" aria-label="Parcelas" title="Parcelas e vencimentos">${icon('calendar')}</button><button data-action="edit-expense" data-id="${e.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-expense" data-id="${e.id}" aria-label="Excluir">${icon('trash')}</button></div></td></tr>`; };
  return `${heading('ORÇAMENTO', 'Financeiro.', 'Organize os valores com clareza, sem perder a leveza.', '<button class="button button-secondary" data-action="export-finance"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar PDF</button><button class="button button-secondary" data-action="import-expenses"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 20h14"/></svg>Importar TXT</button><button class="button button-primary" data-action="add-expense"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar gasto</button>')}
  <section class="budget-overview"><article class="card budget-box"><span>Total com presentes</span><strong>${money(planned())}</strong><small>Todos os itens do casamento</small></article><article class="card budget-box budget-own"><span>Total sem presentes</span><strong>${money(planned() - gifted())}</strong><small>O que vocês vão pagar</small></article><article class="card budget-box budget-gift"><span>Ganhamos de presente</span><strong>${money(gifted())}</strong><small>${giftDue() ? `Ainda faltam ${money(giftDue())} dos presentes` : 'Não entra no que falta pagar'}</small></article><article class="card budget-box budget-due"><span>Falta pagar</span><strong>${money(due())}</strong><small>${due() ? 'Saldo em aberto' : 'Tudo quitado ♡'}</small></article><article class="card budget-box budget-paid"><span>Já pago</span><strong>${money(spent())}</strong><small>Valores já quitados</small></article></section>
  ${hasFoodCard() ? (() => { const rows = data.expenses.filter(e => e.status === FOOD_CARD), left = rows.reduce((n, e) => n + dueOf(e), 0), total = rows.reduce((n, e) => n + Number(e.planned || 0), 0); return `<section class="card budget-box food-card-box"><span>Vamos precisar no cartão alimentação</span><strong>${money(left)}</strong><small>${rows.length ? `${rows.length} ${rows.length === 1 ? 'gasto' : 'gastos'} no cartão · previsto ${money(total)}${total - left > 0 ? ` · já pago ${money(total - left)}` : ''}` : 'Escolha "Cartão alimentação" na forma de pagamento dos gastos para somar aqui.'}</small></section>`; })() : ''}
  ${(() => { const saved = Number(data.wedding.saved || 0), left = due(), cover = left ? Math.min(100, Math.round(saved / left * 100)) : 100; return `<section class="card savings-box"><div class="savings-main"><label for="wedding-saved"><span>Temos guardado</span><small>Quanto vocês já juntaram para o casamento</small></label><div class="savings-input"><span>R$</span><input id="wedding-saved" type="number" inputmode="decimal" min="0" step=".01" placeholder="0,00" value="${saved || ''}"></div></div><div class="savings-info">${left ? `<div class="mini-track"><span style="width:${cover}%"></span></div><small>${saved >= left ? `Dá para pagar tudo o que falta e ainda sobram ${money(saved - left)} ♡` : `Cobre ${cover}% do que falta pagar · faltam juntar ${money(left - saved)}`}</small>` : `<small>${saved ? 'Tudo quitado e o valor guardado fica de folga ♡' : 'Anote aqui o valor que vocês têm guardado.'}</small>`}</div></section>`; })()}
  ${suppliers.length ? `<section class="card panel supplier-panel"><div class="panel-head"><div><h2 class="panel-title">Por fornecedor</h2><p class="panel-subtitle">Quanto falta pagar para cada um</p></div></div><div class="supplier-list">${suppliers.map(x => `<div class="supplier-row"><span class="supplier-name"><strong>${esc(x.name)}</strong><small>${x.rows.length} ${x.rows.length === 1 ? 'item' : 'itens'} · previsto ${money(x.planned)}</small></span><span class="category-totals">${x.due > 0 ? `<span class="category-total category-due">${money(x.due)} faltam</span>` : x.giftDue > 0 ? '' : '<span class="category-total">Quitado</span>'}${x.giftDue > 0 ? `<span class="category-total category-gift">${money(x.giftDue)} de presente faltam</span>` : ''}</span></div>`).join('')}</div></section>` : ''}
  <div class="toolbar"><select id="expense-filter" class="filter-select"><option>Todas</option>${allCategories.map(c => `<option ${expenseFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><button class="button button-secondary" data-action="add-category">${icon('plus')}Categoria</button></div>
  ${categories.map(cat => { const rows = data.expenses.filter(e => e.category === cat); const sum = rows.reduce((a, e) => a + Number(e.planned || 0), 0); const removable = !rows.length && (data.customCategories || []).includes(cat); return `<section class="category-section"><div class="card category-head" data-collapse="${esc(cat)}"><div><h3>${esc(cat)}</h3><p>${rows.length} ${rows.length === 1 ? 'item' : 'itens'} · previsto ${money(sum)}</p></div>${rows.length ? totals(rows) : removable ? `<button class="text-button" data-action="delete-category" data-id="${esc(cat)}">Remover categoria</button>` : '<span class="category-total">＋</span>'}</div><div class="card table-card"><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Valor previsto</th><th>Valor pago</th><th>Falta pagar</th><th>Pagamento</th><th></th></tr></thead><tbody>${rows.length ? rows.map(row).join('') : `<tr><td colspan="6">${empty('Nenhum gasto nesta categoria ainda.')}</td></tr>`}</tbody></table></div></div></section>`; }).join('')}`;
}
function renderCeremony() {
  return `${heading('UM MOMENTO DE CADA VEZ', 'Cerimônia & músicas.', 'Organize a ordem de entrada, as músicas e os combinados do grande dia.', '<button class="button button-secondary" data-action="export-ceremony"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar roteiro em PDF</button><button class="button button-secondary" data-action="import-ceremony"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 20h14"/></svg>Importar TXT</button><button class="button button-primary" data-action="add-ceremony"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar etapa</button>')}
  <section class="ceremony-print"><header class="print-header"><p class="eyebrow">ROTEIRO DA CERIMÔNIA</p><h1>${esc(data.wedding.couple)}</h1><p>${dateLabel(data.wedding.date)} · ${esc(data.wedding.venue)}</p></header><p class="print-note">Este roteiro é um guia para o cortejo. Obrigada por fazer parte deste momento tão especial!</p>
  <section class="card table-card ceremony-table"><div class="table-wrap"><table><thead><tr><th>#</th><th>Etapa</th><th>Participantes</th><th>Música · artista</th><th>Orientações</th><th class="no-print"></th></tr></thead><tbody>${data.ceremony.length ? data.ceremony.map((c, i) => `<tr class="ceremony-row" data-ceremony-id="${c.id}" title="Arraste para mudar a ordem"><td><span class="step-cell"><span class="drag-handle no-print" aria-hidden="true">⋮⋮</span><span class="step-index">${String(i + 1).padStart(2, '0')}</span></span></td><td><strong>${esc(c.step)}</strong></td><td>${esc(c.participants)}</td><td class="music-cell"><div class="music-title">${esc(c.music)}</div><div class="music-artist">${esc(c.artist)}</div></td><td><span class="instructions">${esc(c.notes || '—')}</span></td><td class="no-print"><div class="row-actions"><button data-action="edit-ceremony" data-id="${c.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-ceremony" data-id="${c.id}" aria-label="Excluir">${icon('trash')}</button></div></td></tr>`).join('') : `<tr><td colspan="6">${empty('Adicione as etapas da cerimônia.')}</td></tr>`}</tbody></table></div></section><section class="card print-note orientation-note"><h2>Orientações para os Padrinhos e Auxiliares</h2><ul><li>Evitem levar celular e chaves nos bolsos durante a cerimônia.</li><li>Caminhem em ritmo tranquilo, mantendo espaço entre os casais.</li><li>Sigam o posicionamento combinado e cumprimentem os noivos com calma no altar.</li></ul></section></section>`;
}
function loadSiteRsvps() {
  if (!plannerSlug || siteRsvps !== null) return;
  siteRsvps = [];
  getDocs(collection(db, 'sites', plannerSlug, 'rsvps')).then(snap => {
    siteRsvps = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.product === 'site').map(r => ({ id: r.id, name: String(r.name || '').trim(), people: Number(r.people || 0), attending: Boolean(r.attending), message: r.message || '' })).filter(r => r.name);
    if (currentPage === 'convidados' && siteRsvps.some(r => !data.importedRsvps.includes(r.id))) render();
  }).catch(error => console.warn('Confirmações do site indisponíveis:', error.code || error));
}
function importRsvps() {
  let added = 0, updated = 0;
  (siteRsvps || []).filter(r => !data.importedRsvps.includes(r.id)).forEach(r => {
    const status = r.attending ? 'Confirmado' : 'Recusado', guest = data.guests.find(g => sameName(g.name, r.name));
    if (guest) { guest.status = status; if (r.attending && r.people - 1 > Number(guest.companions || 0) + Number(guest.children || 0)) guest.companions = r.people - 1 - Number(guest.children || 0); updated++; }
    else { data.guests.push({ id: uid('g'), name: r.name, phone: '', group: 'Amigos', status, companions: Math.max(0, r.people - 1), children: 0, family: '', dietary: '', tableId: '', notes: r.message ? `Recado: ${r.message}`.slice(0, 200) : '', fromSite: true }); added++; }
    data.importedRsvps.push(r.id);
  });
  save(`${updated} ${updated === 1 ? 'convidado atualizado' : 'convidados atualizados'} e ${added} ${added === 1 ? 'novo' : 'novos'} na lista.`);
  render();
}
function exportGuestsPdf() {
  const doc = pdfBase('Lista de convidados para o buffet'); if (!doc) return;
  const list = data.guests.filter(g => g.status === 'Confirmado').sort((a, b) => a.name.localeCompare(b.name));
  const adults = list.reduce((n, g) => n + 1 + Number(g.companions || 0), 0), kids = list.reduce((n, g) => n + Number(g.children || 0), 0);
  const tableName = id => data.tables.find(t => t.id === id)?.name || '—';
  pdfHeading(doc, 'Lista de convidados confirmados', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45);
  doc.text(`Confirmados: ${adults + kids} pessoas (${adults} adultos e ${kids} crianças)     Com restrição alimentar: ${list.filter(g => g.dietary).length}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Convidado', 'Família', 'Grupo', 'Adultos', 'Crianças', 'Restrição alimentar', 'Mesa']], body: list.map(g => [g.name, g.family || '—', g.group, 1 + Number(g.companions || 0), Number(g.children || 0), g.dietary || '—', tableName(g.tableId)]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 }, rowPageBreak: 'avoid', columnStyles: { 3: { halign: 'center' }, 4: { halign: 'center' } } });
  const diets = Object.entries(list.filter(g => g.dietary).reduce((acc, g) => ({ ...acc, [g.dietary]: (acc[g.dietary] || 0) + 1 }), {}));
  if (diets.length) doc.autoTable({ startY: doc.lastAutoTable.finalY + 8, head: [['Restrição', 'Quantidade']], body: diets, theme: 'grid', margin: { left: 14, right: 160 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 } });
  pdfFooter(doc); doc.save('lista-convidados-buffet.pdf'); notify('Lista para o buffet exportada em PDF.');
}
function exportGuestsCsv() {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Nome', 'Telefone', 'Grupo', 'Família', 'Status', 'Acompanhantes', 'Crianças', 'Restrição alimentar', 'Mesa', 'Observações'], ...data.guests.map(g => [g.name, g.phone, g.group, g.family, g.status, g.companions || 0, g.children || 0, g.dietary, data.tables.find(t => t.id === g.tableId)?.name || '', g.notes])];
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(cell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'convidados.csv' });
  document.body.append(link); link.click(); link.remove();
  notify('Planilha de convidados baixada.');
}
function dayDTimeline() {
  const wedding = data.wedding.date;
  const items = [
    ...data.ceremonial.map(c => ({ time: hourOf(c.time), title: c.title, who: c.responsible || '', kind: 'cerimonial', track: c.track || 'Geral', done: c.status === 'Concluído' })),
    ...(data.vendors || []).filter(v => v.status === 'Contratado' && v.arrival).map(v => ({ time: hourOf(v.arrival), title: `Chegada: ${v.name}`, who: v.contact || v.name, kind: 'fornecedor', track: 'Equipe' })),
    ...data.tasks.filter(t => wedding && t.date === wedding).map(t => ({ time: hourOf(t.time), title: t.title, who: t.responsible || '', kind: 'tarefa', track: 'Geral', done: t.status === 'Concluído' })),
    ...data.places.filter(p => p.time).map(p => ({ time: hourOf(p.time), title: p.name, who: p.address, kind: 'lugar', track: 'Geral' })),
  ];
  return items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}
function personScripts() {
  const map = new Map();
  const add = (name, phone, item) => { const key = String(name || '').trim(); if (!key) return; const entry = map.get(key) || { name: key, phone: '', items: [] }; entry.phone ||= phone || ''; if (item) entry.items.push(item); map.set(key, entry); };
  const phones = knownPeople();
  data.ceremonial.forEach(c => String(c.responsible || '').split(/\s*[,/;]\s*|\s+e\s+/).forEach(name => add(name, phones.get(name), { time: hourOf(c.time), text: c.title, details: c.details })));
  data.tasks.filter(t => data.wedding.date && t.date === data.wedding.date && t.responsible).forEach(t => add(t.responsible, t.responsiblePhone || phones.get(t.responsible), { time: hourOf(t.time), text: t.title, details: t.description }));
  ['Noiva', 'Noivo'].forEach(track => data.ceremonial.filter(c => (c.track || 'Geral') === track || (c.track || 'Geral') === 'Geral').forEach(c => add(track === 'Noiva' ? 'Noiva' : 'Noivo', '', { time: hourOf(c.time), text: c.title, details: c.details }))); if (!data.ceremonial.some(c => c.track === 'Noiva')) map.delete('Noiva'); if (!data.ceremonial.some(c => c.track === 'Noivo')) map.delete('Noivo');
  (data.vendors || []).filter(v => v.status === 'Contratado').forEach(v => add(v.name, v.phone, v.arrival ? { time: hourOf(v.arrival), text: 'Chegada e montagem', details: v.contact ? `Contato: ${v.contact}` : '' } : null));
  return [...map.values()].filter(p => p.items.length).map(p => ({ ...p, items: p.items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')) })).sort((a, b) => a.name.localeCompare(b.name));
}
function scriptText(person) {
  const contacts = data.emergencyContacts.slice(0, 3).map(c => `${c.name}${c.role ? ` (${c.role})` : ''}: ${c.phone}`);
  return [`Oi, ${person.name.split(' ')[0]}! ♡ Seu roteiro do casamento de ${data.wedding.couple}${data.wedding.date ? ` (${dateLabel(data.wedding.date)})` : ''}:`, '', ...person.items.map(i => `• ${i.time || '--:--'} ${i.text}${i.details ? ` — ${i.details}` : ''}`), '', `Local: ${data.wedding.venue || 'a confirmar'}`, ...data.places.map(p => `${p.name}: ${p.address}`), ...(contacts.length ? ['', 'Contatos de emergência:', ...contacts] : []), '', 'Obrigado por fazer parte desse dia!'].join('\n');
}
function openScripts() {
  const list = personScripts();
  openModal('Roteiro por pessoa', list.length ? `<p class="confirm-copy">Cada pessoa recebe só o que é dela: horários, endereços e contatos de emergência. Envie pelo WhatsApp ou baixe em PDF.</p><div class="script-list" style="grid-column:1/-1">${list.map((p, i) => `<div class="script-row"><span><strong>${esc(p.name)}</strong><small>${p.items.length} ${p.items.length === 1 ? 'compromisso' : 'compromissos'}${p.items[0]?.time ? ` · a partir das ${esc(p.items[0].time)}` : ''}</small></span><a class="button button-secondary button-sm" href="${esc(waLink(p.phone, scriptText(p)))}" target="_blank" rel="noopener">${icon('chat')}WhatsApp</a><button type="button" class="button button-secondary button-sm" data-script-pdf="${i}">PDF</button></div>`).join('')}</div>` : '<p class="confirm-copy">Ainda não há responsáveis no Cerimonial do casamento nem fornecedores contratados com horário de chegada. Preencha essas partes e os roteiros aparecem aqui.</p>', () => {});
  $('#modal-submit').textContent = 'Fechar';
  $('#modal-fields').querySelectorAll('[data-script-pdf]').forEach(b => b.addEventListener('click', () => exportScriptPdf(list[Number(b.dataset.scriptPdf)])));
}
function exportScriptPdf(person) {
  const doc = pdfBase(`Roteiro de ${person.name}`); if (!doc) return;
  pdfHeading(doc, `Roteiro de ${person.name}`, `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.autoTable({ startY: 36, head: [['Horário', 'O que fazer', 'Detalhes']], body: person.items.map(i => [i.time || '—', i.text, i.details || '']), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 }, columnStyles: { 0: { cellWidth: 24 } } });
  const extra = [...data.places.map(p => [p.name, p.address, p.notes || '']), ...data.emergencyContacts.map(c => [c.role || 'Emergência', c.name, c.phone])];
  if (extra.length) doc.autoTable({ startY: doc.lastAutoTable.finalY + 8, head: [['Endereços e contatos', '', '']], body: extra, theme: 'grid', margin: { left: 14, right: 14 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 } });
  pdfFooter(doc); doc.save(`roteiro-${slugOf(person.name)}.pdf`); notify(`Roteiro de ${person.name} exportado.`);
}
function exportDayDPdf() {
  const doc = pdfBase('Dia do casamento'); if (!doc) return;
  pdfHeading(doc, 'Dia do casamento', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  const table = (startY, head, body) => doc.autoTable({ startY, head: [head], body: body.length ? body : [head.map(() => '—')], theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 }, rowPageBreak: 'avoid' });
  table(36, ['Horário', 'O quê', 'Quem / onde'], dayDTimeline().map(i => [i.time || '—', i.title, i.who]));
  table(doc.lastAutoTable.finalY + 8, ['Contato de emergência', 'Função', 'Telefone'], data.emergencyContacts.map(c => [c.name, c.role || '', c.phone]));
  table(doc.lastAutoTable.finalY + 8, ['Se acontecer...', 'O que fazer', 'Quem resolve'], data.planB.map(p => [p.problem, p.solution, p.owner || '']));
  table(doc.lastAutoTable.finalY + 8, ['Kit de emergência', 'Separado'], data.kit.map(k => [k.item, k.done ? 'Sim' : '']));
  pdfFooter(doc); doc.save('dia-do-casamento.pdf'); notify('Dia do casamento exportado em PDF.');
}
function renderDayD() {
  const countdown = countdownState(), fullTimeline = dayDTimeline(), timeline = fullTimeline.filter(i => dayTrack === 'Tudo' || i.track === dayTrack || (i.track === 'Geral' && dayTrack !== 'Equipe')), hiredVendors = (data.vendors || []).filter(v => v.status === 'Contratado');
  const tel = phone => String(phone || '').replace(/[^\d+]/g, '');
  const kitDone = data.kit.filter(k => k.done).length;
  return `${heading('DIA DO CASAMENTO', 'Dia do casamento.', 'O roteiro do grande dia, a equipe, os endereços e o que fazer se algo sair do plano.', `<button class="button button-secondary" data-action="export-dayd">${icon('download')}Exportar PDF</button><button class="button button-primary" data-action="person-scripts">${icon('users')}Roteiro por pessoa</button>`)}
  <div class="summary-row"><span class="summary-chip">${countdown.unknown ? 'Data a definir' : countdown.complete ? 'Casamento realizado ♡' : `Faltam <strong>${countdown.days}</strong> dias`}</span><span class="summary-chip">Na linha do tempo <strong>${timeline.length}</strong></span><span class="summary-chip">Fornecedores com horário <strong>${hiredVendors.filter(v => v.arrival).length}/${hiredVendors.length}</strong></span><span class="summary-chip">Kit separado <strong>${kitDone}/${data.kit.length}</strong></span></div>
  <div class="dayd-grid">
    <article class="card panel dayd-timeline"><div class="panel-head"><div><h2 class="panel-title">Linha do tempo do dia</h2><p class="panel-subtitle">${dayTrack === 'Noiva' ? 'Cronograma da noiva (com os momentos de todos)' : dayTrack === 'Noivo' ? 'Cronograma do noivo (com os momentos de todos)' : dayTrack === 'Equipe' ? 'Chegada e montagem dos fornecedores' : 'Cerimonial, fornecedores e tarefas do dia, em ordem'}</p></div><button class="text-button" data-go="cerimonial">Editar cerimonial →</button></div>
      <div class="custom-tabs view-tabs track-tabs" role="tablist">${['Tudo', 'Noiva', 'Noivo', 'Equipe'].map(t => `<button type="button" role="tab" data-day-track="${t}" aria-selected="${dayTrack === t}">${t}</button>`).join('')}</div>
      ${timeline.length ? `<ol class="dayd-list">${timeline.map(i => `<li class="dayd-${i.kind} ${i.done ? 'is-done' : ''}"><span class="dayd-time">${esc(i.time || '—')}</span><span class="dayd-mark" aria-hidden="true"></span><span><strong>${esc(i.title)}${i.track === 'Noiva' || i.track === 'Noivo' ? ` <em class="track-tag track-${slugOf(i.track)}">${i.track}</em>` : ''}</strong>${i.who ? `<small>${esc(i.who)}</small>` : ''}</span></li>`).join('')}</ol>` : empty(fullTimeline.length ? 'Nada neste cronograma ainda. No Cerimonial do casamento, escolha "Noiva" ou "Noivo" em "Cronograma de quem".' : 'Monte o cerimonial do dia e defina o horário de chegada dos fornecedores.')}</article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Chegada dos fornecedores</h2><p class="panel-subtitle">Horário combinado com cada um</p></div></div>
      ${hiredVendors.length ? `<div class="dayd-rows">${hiredVendors.map(v => `<div class="dayd-row"><span><strong>${esc(v.name)}</strong><small>${esc(v.category)}${v.contact ? ` · ${esc(v.contact)}` : ''}</small></span><input type="time" value="${esc(v.arrival || '')}" data-vendor-arrival="${v.id}" aria-label="Chegada de ${esc(v.name)}">${v.phone ? `<a class="icon-button" href="${esc(waLink(v.phone, `Oi! Confirmando a chegada no casamento de ${data.wedding.couple}${v.arrival ? ` às ${v.arrival}` : ''}.`))}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('chat')}</a>` : ''}</div>`).join('')}</div>` : `<p class="priority-empty">Os fornecedores contratados na aba <button class="text-button" data-go="fornecedores">Fornecedores</button> aparecem aqui.</p>`}</article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Contatos de emergência</h2><p class="panel-subtitle">Quem chamar se precisar</p></div><button class="text-button" data-action="add-contact">+ Contato</button></div>
      ${data.emergencyContacts.length ? `<div class="dayd-rows">${data.emergencyContacts.map(c => `<div class="dayd-row"><span><strong>${esc(c.name)}</strong><small>${esc(c.role || 'Contato')} · ${esc(c.phone)}</small></span><a class="icon-button" href="tel:${esc(tel(c.phone))}" aria-label="Ligar">${icon('phone')}</a><a class="icon-button" href="${esc(waLink(c.phone, ''))}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('chat')}</a><div class="row-actions"><button data-action="edit-contact" data-id="${c.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-contact" data-id="${c.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('')}</div>` : '<p class="priority-empty">Cerimonialista, padrinhos, motorista, alguém da família... quem resolve as coisas no dia.</p>'}</article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Endereços</h2><p class="panel-subtitle">Making of, cerimônia, festa, hotel</p></div><button class="text-button" data-action="add-place">+ Endereço</button></div>
      <div class="dayd-rows">${data.wedding.venue ? `<div class="dayd-row"><span><strong>${esc(data.wedding.venue)}</strong><small>Local do casamento${data.wedding.time ? ` · ${esc(data.wedding.time)}` : ''}</small></span><a class="icon-button" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.wedding.venue)}" target="_blank" rel="noopener" aria-label="Mapa">${icon('pin')}</a></div>` : ''}${data.places.map(p => `<div class="dayd-row"><span><strong>${esc(p.name)}${p.time ? ` · ${esc(p.time)}` : ''}</strong><small>${esc(p.address)}${p.notes ? ` · ${esc(p.notes)}` : ''}</small></span><a class="icon-button" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank" rel="noopener" aria-label="Mapa">${icon('pin')}</a><div class="row-actions"><button data-action="edit-place" data-id="${p.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-place" data-id="${p.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('')}</div></article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Plano B</h2><p class="panel-subtitle">Resolva antes do imprevisto</p></div><button class="text-button" data-action="add-planb">+ Situação</button></div>
      <div class="planb-list">${data.planB.map(p => `<div class="planb-item"><span class="planb-icon">${icon('shield')}</span><div><strong>Se: ${esc(p.problem)}</strong><p>${esc(p.solution)}</p>${p.owner ? `<small>Quem resolve: ${esc(p.owner)}</small>` : ''}</div><div class="row-actions"><button data-action="edit-planb" data-id="${p.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-planb" data-id="${p.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('')}</div></article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Kit de emergência</h2><p class="panel-subtitle">${kitDone} de ${data.kit.length} itens separados</p></div></div>
      <form class="priority-add kit-add" id="kit-add"><input name="item" placeholder="Adicionar item..." aria-label="Novo item do kit" required autocomplete="off"><button class="button button-primary button-sm" type="submit" aria-label="Adicionar">${icon('plus')}</button></form>
      <ul class="kit-list">${data.kit.map(k => `<li class="${k.done ? 'is-done' : ''}"><label><input type="checkbox" class="task-check" data-kit-check="${k.id}" ${k.done ? 'checked' : ''}><span>${esc(k.item)}</span></label><button type="button" class="icon-button" data-action="delete-kit" data-id="${k.id}" aria-label="Remover">${icon('trash')}</button></li>`).join('')}</ul></article>
  </div>`;
}
function renderHoneymoon() {
  const h = data.honeymoon, budget = Number(h.budget || 0), saved = Number(h.saved || 0);
  const live = data.hmBookings.filter(b => b.status !== 'Cancelado' && b.status !== 'Opção');
  const booked = live.reduce((n, b) => n + Number(b.price || 0), 0), paid = live.reduce((n, b) => n + Number(b.paid || 0), 0);
  const nights = h.start && h.end ? Math.max(0, Math.round((fromIso(h.end) - fromIso(h.start)) / 864e5)) : 0;
  const untilTrip = h.start ? Math.round((fromIso(h.start) - fromIso(todayIso())) / 864e5) : null;
  const toSave = Math.max(0, budget - saved), savedRatio = budget ? Math.min(100, Math.round(saved / budget * 100)) : 0;
  const board = data.hmBoard[0] || { files: [], links: [] };
  const types = bookingTypes.filter(t => data.hmBookings.some(b => b.type === t));
  const bookingRow = (b, cheapest) => { const files = (b.files || []).length + (b.links || []).length; return `<tr><td><span class="person-name">${esc(b.title)}${cheapest ? ' <span class="vendor-flag">Menor preço</span>' : ''}</span>${b.code ? `<span class="person-sub">Código: ${esc(b.code)}</span>` : ''}${b.notes ? `<span class="person-sub">${esc(b.notes)}</span>` : ''}</td><td>${b.checkin ? esc(shortDate(b.checkin)) : '—'}${b.checkout ? ` → ${esc(shortDate(b.checkout))}` : ''}</td><td>${money(b.price)}</td><td><select class="status-select" data-booking-status="${b.id}" aria-label="Status">${bookingStatuses.map(st => `<option ${b.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select></td><td><div class="row-actions">${b.link ? `<a class="icon-button" href="${esc(safeNoteUrl(/^[a-z]+:/i.test(b.link) ? b.link : `https://${b.link}`))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir link">${icon('link')}</a>` : ''}<button class="attach-button" data-action="attach-booking" data-id="${b.id}" aria-label="Anexos">${icon('clip')}${files ? `<span class="attach-count">${files}</span>` : ''}</button><button data-action="edit-hmBooking" data-id="${b.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-hmBooking" data-id="${b.id}" aria-label="Excluir">${icon('trash')}</button></div></td></tr>`; };
  const days = [...new Set(data.hmItinerary.map(i => i.date))].sort();
  const packDone = data.hmPacking.filter(m => m.done).length;
  return `${heading('LUA DE MEL', 'Nossa viagem.', 'Destinos, reservas, roteiro e malas, com o orçamento separado do casamento.', `<button class="button button-primary" data-action="edit-honeymoon">${icon('plane')}Detalhes da viagem</button>`)}
  <section class="card wedding-profile honeymoon-hero"><div class="profile-info"><p class="eyebrow">NOSSA VIAGEM DOS SONHOS</p><h2>${esc(h.destination || 'Para onde vamos?')}</h2><ul>${h.start ? `<li>${icon('calendar')}${esc(dateLabel(h.start))}${h.end ? ` a ${esc(dateLabel(h.end))}` : ''}${nights ? ` · ${nights} noites` : ''}</li>` : '<li>' + icon('calendar') + 'Datas a definir</li>'}${untilTrip !== null && untilTrip >= 0 ? `<li>${icon('plane')}${untilTrip === 0 ? 'É hoje! Boa viagem ♡' : `Faltam ${untilTrip} dias para a viagem`}</li>` : ''}</ul></div>
    <div class="profile-boxes"><div class="profile-box"><span>Orçamento da viagem</span><strong class="is-accent">${budget ? money(budget) : '—'}</strong><small>Reservado: ${money(booked)} · pago: ${money(paid)}</small></div><div class="profile-box"><span>Já economizado</span><strong>${money(saved)}</strong>${budget ? `<div class="mini-track"><span style="width:${savedRatio}%"></span></div><small>${savedRatio}% da meta</small>` : ''}</div><div class="profile-box"><span>Falta economizar</span><strong class="${toSave ? 'is-over' : ''}">${budget ? money(toSave) : '—'}</strong><small>${budget && booked > budget ? `As reservas passam do orçamento em ${money(booked - budget)}` : 'Atualize o valor economizado nos detalhes'}</small></div></div></section>
  <div class="dayd-grid">
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Destinos desejados</h2><p class="panel-subtitle">Compare e escolha o seu</p></div><button class="text-button" data-action="add-hmDestination">+ Destino</button></div>
      ${data.hmDestinations.length ? `<div class="dayd-rows">${data.hmDestinations.map(d => `<div class="dayd-row ${h.destination === d.name ? 'is-chosen' : ''}"><span><strong>${esc(d.name)}${h.destination === d.name ? ' ♡' : ''}</strong><small>${[d.estimate ? `cerca de ${money(d.estimate)}` : '', d.season ? `melhor época: ${esc(d.season)}` : '', d.notes ? esc(d.notes) : ''].filter(Boolean).join(' · ') || 'Sem detalhes'}</small></span>${h.destination === d.name ? '' : `<button type="button" class="button button-secondary button-sm" data-choose-destination="${d.id}">Escolher</button>`}<div class="row-actions"><button data-action="edit-hmDestination" data-id="${d.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-hmDestination" data-id="${d.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('')}</div>` : '<p class="priority-empty">Anote os lugares que vocês sonham conhecer, com o custo estimado.</p>'}</article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Nossa viagem dos sonhos</h2><p class="panel-subtitle">Fotos, links e ideias</p></div><button class="text-button" data-action="edit-board">+ Fotos e links</button></div>
      ${(board.files || []).length || (board.links || []).length ? `<div class="dream-grid">${(board.files || []).filter(f => f.type.startsWith('image/')).map(f => `<span class="dream-photo" data-dream-file="${f.id}"><img alt="${esc(f.name)}"></span>`).join('')}</div>${(board.links || []).length ? `<ul class="dream-links">${board.links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon('link')}${esc(l.title || l.url)}</a></li>`).join('')}</ul>` : ''}` : '<p class="priority-empty">Salve fotos de inspiração, vídeos e links de hotéis e passeios.</p>'}</article>
  </div>
  <section class="card panel hm-section"><div class="panel-head"><div><h2 class="panel-title">Hospedagens, passagens e passeios</h2><p class="panel-subtitle">Deixe como "Opção" para comparar e mude para "Reservado" quando fechar</p></div><button class="button button-secondary button-sm" data-action="add-hmBooking">${icon('plus')}Reserva ou opção</button></div>
    ${types.length ? types.map(t => { const list = data.hmBookings.filter(b => b.type === t), options = list.filter(b => b.status === 'Opção' && Number(b.price) > 0), cheapest = options.length > 1 ? options.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a)).id : ''; return `<h3 class="hm-type">${esc(t)}</h3><div class="table-wrap"><table class="hm-table"><thead><tr><th>Reserva</th><th>Datas</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>${list.map(b => bookingRow(b, b.id === cheapest)).join('')}</tbody></table></div>`; }).join('') : empty('Cadastre hotéis, voos e passeios para comparar e controlar as reservas.')}</section>
  <div class="dayd-grid">
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Roteiro por dia</h2><p class="panel-subtitle">Passeios e restaurantes</p></div><button class="text-button" data-action="add-hmItinerary">+ Passeio</button></div>
      ${days.length ? days.map(day => `<h3 class="hm-type">${esc(shortDate(day))}</h3><div class="dayd-rows">${data.hmItinerary.filter(i => i.date === day).sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).map(i => `<div class="dayd-row"><span><strong>${i.time ? `${esc(i.time)} · ` : ''}${esc(i.activity)}</strong>${i.place || i.notes ? `<small>${esc([i.place, i.notes].filter(Boolean).join(' · '))}</small>` : ''}</span>${i.place ? `<a class="icon-button" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.place)}" target="_blank" rel="noopener" aria-label="Mapa">${icon('pin')}</a>` : ''}<div class="row-actions"><button data-action="edit-hmItinerary" data-id="${i.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-hmItinerary" data-id="${i.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('')}</div>`).join('') : '<p class="priority-empty">Monte o roteiro de cada dia da viagem.</p>'}</article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Malas e documentos</h2><p class="panel-subtitle">${packDone} de ${data.hmPacking.length} itens prontos · checklist pré-viagem</p></div></div>
      <form class="priority-add" id="pack-add"><input name="item" placeholder="Adicionar item..." aria-label="Novo item" required autocomplete="off"><select name="category" aria-label="Categoria">${packingCategories.map(c => `<option>${c}</option>`).join('')}</select><button class="button button-primary button-sm" type="submit" aria-label="Adicionar">${icon('plus')}</button></form>
      ${packingCategories.filter(c => data.hmPacking.some(m => m.category === c)).map(c => `<h3 class="hm-type">${c}</h3><ul class="kit-list">${data.hmPacking.filter(m => m.category === c).map(m => `<li class="${m.done ? 'is-done' : ''}"><label><input type="checkbox" class="task-check" data-pack-check="${m.id}" ${m.done ? 'checked' : ''}><span>${esc(m.item)}</span></label><button type="button" class="icon-button" data-action="delete-pack" data-id="${m.id}" aria-label="Remover">${icon('trash')}</button></li>`).join('')}</ul>`).join('')}</article>
  </div>`;
}
// Todos os arquivos e links do planejamento, de onde quer que tenham sido anexados.
function allDocuments() {
  const sources = [
    ['documents', 'Documentos', r => r.title], ['expenses', 'Gastos', r => r.description], ['vendors', 'Fornecedores', r => r.name],
    ['tasks', 'Tarefas', r => r.title], ['hmBookings', 'Lua de mel', r => r.title], ['hmBoard', 'Lua de mel', r => r.title], ['inspirations', 'Inspirações', r => r.title],
  ];
  return sources.flatMap(([coll, origin, label]) => (data[coll] || []).flatMap(record => [
    ...(record.files || []).map(file => ({ kind: 'file', coll, origin, record, label: label(record), file, name: file.name, date: file.addedAt || '' })),
    ...(record.links || []).map(link => ({ kind: 'link', coll, origin, record, label: label(record), link, name: link.title || link.url, date: '' })),
  ]));
}
function openFile(file) {
  const win = window.open('', '_blank');
  readAttachment(file).then(url => { const blobUrl = URL.createObjectURL(dataUrlToBlob(url)); if (win) win.location.href = blobUrl; else location.href = blobUrl; })
    .catch(e => { console.error(e); win?.close(); notify('Não foi possível abrir o arquivo.'); });
}
function renderDocuments() {
  const all = allDocuments(), origins = ['Todos', ...new Set(all.map(d => d.origin))];
  const visible = all.filter(d => (docFilter === 'Todos' || d.origin === docFilter) && `${d.name} ${d.label}`.toLowerCase().includes(docSearch.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const checkDone = data.docChecklist.filter(d => d.done).length;
  const ext = d => d.kind === 'link' ? icon('link') : d.file.type.startsWith('image/') ? `<img alt="" data-thumb="${d.coll}|${d.record.id}|${d.file.id}">` : `<b>${esc((d.name.split('.').pop() || 'arq').slice(0, 4).toUpperCase())}</b>`;
  return `${heading('DOCUMENTOS', 'Central de documentos.', 'Contratos, comprovantes, notas fiscais e documentos da cerimônia, todos num lugar só. Inclui os arquivos anexados nos gastos, fornecedores, tarefas e lua de mel.', `<button class="button button-primary" data-action="add-document">${icon('plus')}Novo documento</button>`)}
  <div class="summary-row"><span class="summary-chip">Arquivos <strong>${all.filter(d => d.kind === 'file').length}</strong></span><span class="summary-chip">Links <strong>${all.filter(d => d.kind === 'link').length}</strong></span><span class="summary-chip">Documentos essenciais <strong>${checkDone}/${data.docChecklist.length}</strong></span></div>
  <div class="dayd-grid">
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Documentos essenciais</h2><p class="panel-subtitle">O que precisa estar pronto para o casamento</p></div></div>
      <form class="priority-add kit-add" id="doccheck-add"><input name="item" placeholder="Adicionar documento..." aria-label="Novo documento essencial" required autocomplete="off"><button class="button button-primary button-sm" type="submit" aria-label="Adicionar">${icon('plus')}</button></form>
      <ul class="kit-list">${data.docChecklist.map(k => `<li class="${k.done ? 'is-done' : ''}"><label><input type="checkbox" class="task-check" data-doccheck="${k.id}" ${k.done ? 'checked' : ''}><span>${esc(k.item)}</span></label><button type="button" class="icon-button" data-action="delete-doccheck" data-id="${k.id}" aria-label="Remover">${icon('trash')}</button></li>`).join('')}</ul></article>
    <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Meus documentos</h2><p class="panel-subtitle">Pastas com arquivos e links</p></div><button class="text-button" data-action="add-document">+ Documento</button></div>
      ${data.documents.length ? `<div class="dayd-rows">${data.documents.map(d => { const n = (d.files || []).length + (d.links || []).length; return `<div class="dayd-row"><span><strong>${esc(d.title)}</strong><small>${esc(d.category || 'Outros')}${d.date ? ` · ${esc(shortDate(d.date))}` : ''} · ${n} ${n === 1 ? 'anexo' : 'anexos'}${d.notes ? ` · ${esc(d.notes)}` : ''}</small></span><button type="button" class="button button-secondary button-sm" data-action="attach-document" data-id="${d.id}">${icon('clip')}Anexos</button><div class="row-actions"><button data-action="edit-document" data-id="${d.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-document" data-id="${d.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`; }).join('')}</div>` : '<p class="priority-empty">Crie uma pasta para cada documento (certidões, contratos, notas) e anexe os arquivos.</p>'}</article>
  </div>
  <section class="card panel"><div class="panel-head"><div><h2 class="panel-title">Todos os arquivos</h2><p class="panel-subtitle">${visible.length} ${visible.length === 1 ? 'item' : 'itens'}</p></div></div>
    <div class="toolbar"><label class="search-box"><span class="search-mark">${icon('search')}</span><input id="doc-search" type="search" placeholder="Buscar arquivo ou origem" value="${esc(docSearch)}"></label><div class="ask-chips doc-filters">${origins.map(o => `<button type="button" class="ask-chip ${docFilter === o ? 'is-on' : ''}" data-doc-filter="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>
    ${visible.length ? `<div class="doc-list">${visible.map((d, i) => `<div class="attach-item"><span class="attach-thumb">${ext(d)}</span><span class="attach-name"><strong>${esc(d.name)}</strong><small>${esc(d.origin)} · ${esc(d.label)}${d.kind === 'file' ? ` · ${fileSize(d.file.size)}` : ''}</small></span>${d.kind === 'link' ? `<a class="button button-secondary button-sm" href="${esc(d.link.url)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : `<button type="button" class="button button-secondary button-sm" data-open-doc="${i}">Abrir</button>`}<button type="button" class="icon-button" data-doc-source="${i}" aria-label="Ver onde está anexado" title="Ver onde está anexado">${icon('clip')}</button></div>`).join('')}</div>` : empty(all.length ? 'Nada encontrado com essa busca.' : 'Os arquivos que vocês anexarem em qualquer parte do planejamento aparecem aqui.')}</section>`;
}
function renderInspirations() {
  const cover = b => (b.files || []).filter(f => f.type.startsWith('image/')).slice(0, 4);
  return `${heading('INSPIRAÇÕES', 'Inspirações.', 'Murais com fotos, links e cores para cada parte do casamento, prontos para mostrar aos fornecedores.', `<button class="button button-primary" data-action="add-inspiration">${icon('plus')}Novo mural</button>`)}
  <div class="insp-grid">${data.inspirations.map(b => { const pics = cover(b), n = (b.files || []).length, l = (b.links || []).length; return `<article class="card insp-card">
    <button type="button" class="insp-mosaic count-${pics.length}" data-action="attach-inspiration" data-id="${b.id}" aria-label="Fotos e links de ${esc(b.title)}">${pics.length ? pics.map(f => `<span><img alt="" data-thumb="inspirations|${b.id}|${f.id}"></span>`).join('') : `<span class="insp-empty">${icon('plus')}Adicionar fotos</span>`}</button>
    <div class="insp-body"><div class="insp-title"><h3>${esc(b.title)}</h3><div class="row-actions"><button data-action="edit-inspiration" data-id="${b.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-inspiration" data-id="${b.id}" aria-label="Excluir">${icon('trash')}</button></div></div>
      <small>${n} ${n === 1 ? 'foto' : 'fotos e arquivos'} · ${l} ${l === 1 ? 'link' : 'links'}</small>
      ${b.notes ? `<p>${esc(b.notes)}</p>` : ''}
      ${b.colors?.length ? `<div class="insp-colors">${b.colors.map(c => `<span style="background:${esc(c)}" title="${esc(c)}"></span>`).join('')}</div>` : ''}
      ${l ? `<ul class="dream-links">${b.links.slice(0, 3).map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${icon('link')}${esc(x.title || x.url)}</a></li>`).join('')}</ul>` : ''}
    </div></article>`; }).join('')}</div>`;
}
function renderCeremonial() {
  const ceremonial = [...data.ceremonial].sort((a, b) => a.time.localeCompare(b.time)), done = ceremonial.filter(item => item.status === 'Concluído').length;
  return `${heading('DIA DO CASAMENTO', 'Cerimonial do casamento.', 'Sequência operacional para conduzir o dia com segurança.', '<button class="button button-secondary" data-action="export-ceremonial"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar PDF</button><button class="button button-primary" data-action="add-ceremonial"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar horário</button>')}<div class="summary-row"><span class="summary-chip">Horários <strong>${ceremonial.length}</strong></span><span class="summary-chip">Concluídos <strong>${done}</strong></span><span class="summary-chip">A fazer <strong>${ceremonial.length - done}</strong></span><span class="summary-chip">Início da cerimônia <strong>${esc(data.wedding.time || '11:30')}</strong></span></div>
  <article class="card ceremonial-card">${ceremonial.length ? ceremonial.map(item => `<div class="ceremonial-row ${item.status === 'Concluído' ? 'is-complete' : ''}"><time>${esc(item.time)}</time><span class="ceremonial-dot"></span><div><strong>${esc(item.title)}${item.track === 'Noiva' || item.track === 'Noivo' ? ` <em class="track-tag track-${slugOf(item.track)}">${item.track}</em>` : ''}</strong><p>${esc(item.details || 'Sem observações')}</p><small>Responsável: ${esc(item.responsible || 'A definir')}</small></div><input class="supply-check ceremonial-check" type="checkbox" data-ceremonial-check="${item.id}" ${item.status === 'Conclu\u00eddo' ? 'checked' : ''} aria-label="Marcar ${esc(item.title)} como concluida"><div class="row-actions"><button data-action="edit-ceremonial" data-id="${item.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-ceremonial" data-id="${item.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('') : empty('Adicione os horários do dia do casamento.')}</article>`;
}
function renderChecklist() {
  const done = data.supplies.filter(s => s.status === 'No Local').length;
  const allCategories = [...new Set([...checklistCategories, ...data.supplies.map(s => s.category).filter(Boolean)])];
  return `${heading('PREPARAR COM CARINHO', 'O que levar.', 'Uma lista compartilhada para cada item chegar ao lugar certo.', '<button class="button button-secondary" data-action="export-checklist"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar checklist PDF</button><button class="button button-secondary" data-action="import-supplies"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 20h14"/></svg>Importar TXT</button><button class="button button-primary" data-action="add-supply"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar item</button>')}<div class="summary-row"><span class="summary-chip">Itens no checklist <strong>${data.supplies.length}</strong></span><span class="summary-chip">Já no local <strong>${done}</strong></span><span class="summary-chip">Em andamento <strong>${data.supplies.filter(s => ['Comprado', 'No Carro'].includes(s.status)).length}</strong></span></div>
  <section class="check-categories">${allCategories.map(cat => { const items = data.supplies.filter(s => s.category === cat); return `<article class="card check-card"><header class="check-head"><h3>${esc(cat)}</h3><span>${items.filter(i => i.status === 'No Local').length} / ${items.length} no local</span></header><div class="check-items">${items.length ? items.map(s => `<div class="check-item ${s.status === 'No Local' ? 'is-complete' : ''}"><span class="task-text">${esc(s.name)}${s.quantity ? `<span class="person-sub">${esc(s.quantity)}</span>` : ''}</span><div class="check-actions"><label class="supply-check-label"><input class="supply-check" type="checkbox" data-supply-check="${s.id}" ${s.status === 'No Local' ? 'checked' : ''} aria-label="Marcar ${esc(s.name)} como no local"><span>No local</span></label><select class="status-select" data-supply-status="${s.id}" aria-label="Status de ${esc(s.name)}">${checklistStatuses.map(st => `<option ${s.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select><div class="row-actions"><button data-action="edit-supply" data-id="${s.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-supply" data-id="${s.id}" aria-label="Excluir">${icon('trash')}</button></div></div></div>`).join('') : empty('Nenhum item nesta categoria.')}</div></article>`; }).join('')}</section>`;
}
function renderTimeline() {
  const today = todayIso(), wedding = data.wedding.date, days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const fmt = (value, options) => fromIso(value).toLocaleDateString('pt-BR', options).replace(/\./g, '');
  const open = data.tasks.filter(t => t.status !== 'Concluído');
  const priorities = open.filter(t => !t.date).sort((a, b) => priorityRank(a) - priorityRank(b));
  const overdue = open.filter(t => t.date && t.date < today).sort(byTaskOrder);
  const doneUndated = data.tasks.filter(t => !t.date && t.status === 'Concluído');
  const weeksLeft = wedding && wedding >= weekStart ? Math.floor((fromIso(weekOf(wedding)) - fromIso(weekStart)) / 6048e5) : null;
  const card = (t, side = false) => {
    const files = (t.files || []).length + (t.links || []).length, done = t.status === 'Concluído';
    return `<article class="task-card prio-${slugOf(t.priority || 'Média')} ${done ? 'is-done' : ''} ${t.status === 'Em Andamento' ? 'is-doing' : ''}" draggable="true" data-task-id="${t.id}">
      <input type="checkbox" class="task-check" data-task-toggle="${t.id}" ${done ? 'checked' : ''} aria-label="Concluir ${esc(t.title)}">
      <button type="button" class="task-card-body" data-action="edit-task" data-id="${t.id}">${side ? `<span class="task-card-tag">${esc(t.date ? shortDate(t.date) : t.priority || 'Média')}</span>` : ''}${t.time ? `<span class="task-card-time">${esc(t.time)}</span>` : ''}<span class="task-card-title">${esc(t.title)}</span>${t.responsible ? `<span class="task-card-who">${icon('users')}${esc(t.responsible)}</span>` : ''}</button>
      <span class="task-card-actions"><button type="button" data-action="attach-task" data-id="${t.id}" aria-label="Anexos" title="Fotos, PDFs e links">${icon('clip')}${files ? `<b>${files}</b>` : ''}</button><button type="button" data-action="delete-task" data-id="${t.id}" aria-label="Excluir">${icon('trash')}</button></span>
    </article>`;
  };
  const day = d => {
    const tasks = data.tasks.filter(t => t.date === d).sort(byTaskOrder);
    return `<div class="week-day ${d === today ? 'is-today' : ''} ${d === wedding ? 'is-wedding' : ''} ${d < today ? 'is-past' : ''}" data-drop-date="${d}">
      <header class="week-day-head"><span>${fmt(d, { weekday: 'short' })}</span><strong>${fromIso(d).getDate()}</strong>${d === wedding ? '<em>♡ Casamento</em>' : d === today ? '<em>Hoje</em>' : ''}</header>
      <div class="week-day-tasks">${tasks.map(t => card(t)).join('')}</div>
      <button type="button" class="week-add" data-add-task="${d}" aria-label="Nova tarefa em ${fmt(d, { day: 'numeric', month: 'long' })}">${icon('plus')}<span>Tarefa</span></button>
    </div>`;
  };
  const sameMonth = weekStart.slice(0, 7) === days[6].slice(0, 7);
  const label = `${fmt(weekStart, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${heading('PLANEJAMENTO', 'Cronograma.', 'Organize a semana, arraste as tarefas entre os dias e guarde em Prioridades o que ainda não tem data.', `<button class="button button-secondary" data-action="generate-checklist">${icon('check')}Checklist do casamento</button>` + '<button class="button button-secondary" data-action="export-timeline"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar PDF</button><button class="button button-primary" data-action="add-task"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nova tarefa</button>')}
  <div class="summary-row"><span class="summary-chip">A fazer <strong>${open.length}</strong></span><span class="summary-chip">Concluídas <strong>${data.tasks.length - open.length}</strong></span><span class="summary-chip">Prioridades <strong>${priorities.length}</strong></span>${overdue.length ? `<span class="summary-chip is-late">Atrasadas <strong>${overdue.length}</strong></span>` : ''}</div>
  <div class="custom-tabs view-tabs" role="tablist"><button type="button" role="tab" data-view="semana" aria-selected="${timelineView === 'semana'}">Semana</button><button type="button" role="tab" data-view="quadro" aria-selected="${timelineView === 'quadro'}">Quadro</button><button type="button" role="tab" data-view="mes" aria-selected="${timelineView === 'mes'}">Mês a mês</button><button type="button" role="tab" data-view="pessoas" aria-selected="${timelineView === 'pessoas'}">Por pessoa</button></div>
  ${timelineView === 'quadro' ? renderBoard() : timelineView === 'mes' ? renderMonths() : timelineView === 'pessoas' ? renderPeople() : `<div class="planner-layout">
    <section class="card week-card">
      <div class="week-bar">
        <div class="week-nav"><button type="button" class="icon-button" data-week="-1" aria-label="Semana anterior">‹</button><h2 class="week-label">${esc(label)}</h2><button type="button" class="icon-button" data-week="1" aria-label="Próxima semana">›</button></div>
        <div class="week-jumps">${weekStart === weekOf(today) ? '<span class="week-badge">Esta semana</span>' : '<button type="button" class="button button-secondary button-sm" data-week="today">Esta semana</button>'}${wedding && weekStart !== weekOf(wedding) ? `<button type="button" class="button button-secondary button-sm" data-week="wedding">${icon('heart')}Semana do casamento</button>` : ''}</div>
        ${weeksLeft !== null ? `<p class="week-hint">${weeksLeft === 0 ? 'É a semana do casamento! ♡' : `${weeksLeft} ${weeksLeft === 1 ? 'semana' : 'semanas'} até a semana do casamento`}</p>` : ''}
      </div>
      <div class="week-grid" id="week-grid">${days.map(day).join('')}</div>
    </section>
    <aside class="card priority-card" data-drop-date="">
      <div class="priority-head"><h2>Prioridades</h2><p>Sem data marcada. Quando decidir, arraste para um dia ou edite e escolha a data.</p></div>
      <form class="priority-add" id="priority-add"><input name="title" placeholder="Nova prioridade..." aria-label="Nova prioridade" required autocomplete="off"><select name="priority" aria-label="Nível">${taskPriorities.map(p => `<option ${p === 'Média' ? 'selected' : ''}>${p}</option>`).join('')}</select><button class="button button-primary button-sm" type="submit" aria-label="Adicionar prioridade">${icon('plus')}</button></form>
      <div class="priority-list">${priorities.length ? priorities.map(t => card(t, true)).join('') : '<p class="priority-empty">Nada por aqui. Anote o que precisa ser feito, mesmo sem data.</p>'}</div>
      ${overdue.length ? `<h3 class="priority-sub is-late">Atrasadas · ${overdue.length}</h3><div class="priority-list">${overdue.map(t => card(t, true)).join('')}</div>` : ''}
      ${doneUndated.length ? `<details class="priority-done"><summary>Concluídas · ${doneUndated.length}</summary><div class="priority-list">${doneUndated.map(t => card(t, true)).join('')}</div></details>` : ''}
    </aside>
  </div>`}`;
}
// Quadro estilo Trello: uma coluna por mês até o casamento; arrastar o cartão muda o prazo.
/* Tarefas por pessoa e lembretes na agenda ------------------------------------ */
const daysUntil = value => Math.round((fromIso(value) - fromIso(todayIso())) / 864e5);
function deadlineOf(t) {
  if (t.status === 'Concluído') return { cls: 'is-done', text: 'Feita' };
  if (!t.date) return { cls: 'is-none', text: 'Sem prazo' };
  const n = daysUntil(t.date);
  if (n < 0) return { cls: 'is-late', text: `Atrasada há ${-n} ${n === -1 ? 'dia' : 'dias'}` };
  if (n === 0) return { cls: 'is-today', text: 'Vence hoje' };
  if (n === 1) return { cls: 'is-soon', text: 'Vence amanhã' };
  if (n <= 7) return { cls: 'is-soon', text: `Faltam ${n} dias` };
  return { cls: 'is-ok', text: shortDate(t.date) };
}
// Tarefas em aberto com prazo vencido ou acabando (até 3 dias).
const urgentTasks = () => data.tasks.filter(t => t.status !== 'Concluído' && t.date && daysUntil(t.date) <= 3);
const NOBODY = 'Sem responsável';
function renderPeople() {
  const groups = new Map();
  data.tasks.forEach(t => { const who = (t.responsible || '').trim() || NOBODY; if (!groups.has(who)) groups.set(who, []); groups.get(who).push(t); });
  const score = list => list.filter(t => t.status !== 'Concluído' && t.date && daysUntil(t.date) < 0).length * 100 + list.filter(t => t.status !== 'Concluído' && t.date && daysUntil(t.date) >= 0 && daysUntil(t.date) <= 7).length;
  const people = [...groups.keys()].sort((a, b) => (a === NOBODY) - (b === NOBODY) || score(groups.get(b)) - score(groups.get(a)) || a.localeCompare(b));
  const canShare = typeof navigator.canShare === 'function';
  const row = t => { const d = deadlineOf(t); return `<li class="${t.status === 'Concluído' ? 'is-done' : ''}"><input type="checkbox" class="task-check" data-task-toggle="${t.id}" ${t.status === 'Concluído' ? 'checked' : ''} aria-label="Concluir ${esc(t.title)}"><button type="button" class="month-task" data-action="edit-task" data-id="${t.id}">${esc(t.title)}${t.time ? ` <small>${esc(t.time)}</small>` : ''}</button><span class="deadline ${d.cls}">${esc(d.text)}</span></li>`; };
  const card = who => {
    const list = groups.get(who), open = list.filter(t => t.status !== 'Concluído').sort(byTaskOrder), done = list.filter(t => t.status === 'Concluído');
    const late = open.filter(t => t.date && daysUntil(t.date) < 0).length, soon = open.filter(t => t.date && daysUntil(t.date) >= 0 && daysUntil(t.date) <= 7).length, dated = open.filter(t => t.date).length;
    return `<section class="card person-card ${late ? 'is-late' : ''}">
      <header class="person-head"><div><h3>${esc(who)}</h3><p>${open.length} ${open.length === 1 ? 'tarefa' : 'tarefas'} a fazer${late ? ` · <b class="is-late">${late} atrasada${late > 1 ? 's' : ''}</b>` : ''}${soon ? ` · <b>${soon} com prazo acabando</b>` : ''}</p></div>${who === NOBODY ? '' : `<button type="button" class="icon-button" data-add-task-for="${esc(who)}" aria-label="Nova tarefa para ${esc(who)}">${icon('plus')}</button>`}</header>
      <ul class="month-list">${open.map(row).join('') || '<li class="person-empty">Nada pendente ♡</li>'}</ul>
      ${done.length ? `<details class="priority-done"><summary>Concluídas · ${done.length}</summary><ul class="month-list">${done.map(row).join('')}</ul></details>` : ''}
      ${dated ? `<div class="person-actions"><button type="button" class="button button-secondary button-sm" data-ics="${esc(who)}">${icon('calendar')}Na agenda</button>${canShare && who !== NOBODY ? `<button type="button" class="button button-secondary button-sm" data-ics-share="${esc(who)}">${icon('share')}Enviar para ${esc(who.split(' ')[0])}</button>` : ''}</div>` : ''}
    </section>`;
  };
  return `<section class="notice-card people-notice"><div><strong>Lembretes que chegam sozinhos</strong><p>Coloque as tarefas na agenda do celular: ela avisa 1 dia antes e no dia, mesmo com o site fechado. Cada pessoa pode receber só a agenda dela.</p></div><button class="button button-secondary" data-ics="*">${icon('calendar')}Todas na minha agenda</button></section>
  ${people.length ? `<div class="people-grid">${people.map(card).join('')}</div>` : '<section class="card empty-state"><p>Ainda não há tarefas. Ao criar uma, escolha o responsável e ela aparece aqui.</p></section>'}`;
}
function icsFile(who) {
  const tasks = data.tasks.filter(t => t.status !== 'Concluído' && t.date && (who === '*' || ((t.responsible || '').trim() || NOBODY) === who));
  const text = v => String(v || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const alarm = (trigger, msg) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(msg)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
  const events = tasks.flatMap(t => {
    const day = t.date.replace(/-/g, ''), timed = /^\d{2}:\d{2}$/.test(t.time || '');
    return ['BEGIN:VEVENT', `UID:${t.id}@entrenos.app`, `DTSTAMP:${stamp}`,
      ...(timed ? [`DTSTART:${day}T${t.time.replace(':', '')}00`, 'DURATION:PT1H'] : [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${addDays(t.date, 1).replace(/-/g, '')}`]),
      `SUMMARY:${text(`${t.title}${who === '*' && t.responsible ? ` (${t.responsible})` : ''}`)}`,
      `DESCRIPTION:${text([t.description, `Casamento de ${data.wedding.couple}`].filter(Boolean).join('\n'))}`,
      ...alarm(timed ? '-P1D' : '-PT15H', `Amanhã: ${t.title}`), ...alarm(timed ? '-PT2H' : 'PT9H', `Hoje: ${t.title}`), 'END:VEVENT'];
  });
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Entre Nos//Cronograma//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${text(`Casamento ${data.wedding.couple}`)}`, ...events, 'END:VCALENDAR'].join('\r\n');
  const name = `tarefas-${who === '*' ? 'casamento' : slugOf(who)}.ics`;
  return { count: tasks.length, file: new File([body], name, { type: 'text/calendar' }) };
}
async function exportIcs(who, share = false) {
  const { count, file } = icsFile(who);
  if (!count) { notify('Só entram na agenda as tarefas com data.'); return; }
  if (share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Tarefas do casamento', text: `Suas tarefas do casamento de ${data.wedding.couple}. Abra o arquivo para colocar na agenda: ela avisa 1 dia antes e no dia.` }); } catch {}
    return;
  }
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  notify(`${count} ${count === 1 ? 'tarefa enviada' : 'tarefas enviadas'} para a agenda. Abra o arquivo baixado para confirmar.`);
}
function updateNavBadges() {
  const urgent = alerts(data).filter(a => a.level === 'danger').length;
  setNavBadge('cronograma', urgentTasks().length, n => `${n} ${n === 1 ? 'tarefa atrasada ou com prazo acabando' : 'tarefas atrasadas ou com prazo acabando'}`);
  setNavBadge('assistente', urgent, n => `${n} ${n === 1 ? 'aviso urgente' : 'avisos urgentes'} da cerimonialista`);
}
function setNavBadge(page, n, title) {
  const item = $(`.nav-item[data-page="${page}"]`); if (!item) return;
  let badge = item.querySelector('.nav-badge');
  if (!n) { badge?.remove(); return; }
  if (!badge) { badge = Object.assign(document.createElement('b'), { className: 'nav-badge' }); item.append(badge); }
  badge.textContent = n; badge.title = title(n);
}
function renderBoard() {
  const today = todayIso(), current = today.slice(0, 7), wedding = data.wedding.date;
  const dated = data.tasks.filter(t => t.date);
  const last = [wedding?.slice(0, 7), ...dated.map(t => t.date.slice(0, 7))].filter(Boolean).sort().pop() || current;
  const months = [];
  for (let d = fromIso(`${current}-01`); isoDate(d).slice(0, 7) <= (last > current ? last : current); d.setMonth(d.getMonth() + 1)) months.push(isoDate(d).slice(0, 7));
  const card = t => { const done = t.status === 'Concluído', late = !done && t.date && t.date < today; return `<article class="task-card board-card prio-${slugOf(t.priority || 'Média')} ${done ? 'is-done' : ''} ${t.status === 'Em Andamento' ? 'is-doing' : ''}" draggable="true" data-task-id="${t.id}"><input type="checkbox" class="task-check" data-task-toggle="${t.id}" ${done ? 'checked' : ''} aria-label="Concluir ${esc(t.title)}"><button type="button" class="task-card-body" data-action="edit-task" data-id="${t.id}"><span class="task-card-title">${esc(t.title)}</span><span class="board-meta">${t.date ? `<span class="${late ? 'is-late' : ''}">${esc(shortDate(t.date))}${t.time ? ` · ${esc(t.time)}` : ''}</span>` : '<span>Sem data</span>'}${badge(t.status)}</span>${t.responsible ? `<span class="task-card-who">${icon('users')}${esc(t.responsible)}</span>` : ''}</button></article>`; };
  const column = (key, title, tag, list, drop) => `<section class="board-col ${key === 'late' ? 'is-late' : ''} ${key === current ? 'is-current' : ''} ${wedding && key === wedding.slice(0, 7) ? 'is-wedding' : ''}" ${drop !== null ? `data-drop-month="${drop}"` : ''}><header class="board-head"><div><h3>${esc(title)}</h3>${tag ? `<span>${tag}</span>` : ''}</div><b>${list.filter(t => t.status !== 'Concluído').length}</b></header><div class="board-list">${list.map(card).join('') || '<p class="priority-empty">Arraste tarefas para cá.</p>'}</div>${drop !== null ? `<button type="button" class="week-add" data-add-month="${drop}">${icon('plus')}<span>Tarefa</span></button>` : ''}</section>`;
  const late = dated.filter(t => t.status !== 'Concluído' && t.date < today).sort(byTaskOrder);
  const byMonth = m => dated.filter(t => t.date.slice(0, 7) === m && !(t.status !== 'Concluído' && t.date < today)).sort((a, b) => (a.status === 'Concluído') - (b.status === 'Concluído') || byTaskOrder(a, b));
  const undated = data.tasks.filter(t => !t.date).sort((a, b) => (a.status === 'Concluído') - (b.status === 'Concluído') || priorityRank(a) - priorityRank(b));
  const monthTag = m => { if (wedding && m === wedding.slice(0, 7)) return 'Mês do casamento ♡'; if (m === current) return 'Este mês'; if (!wedding) return ''; const diff = (Number(wedding.slice(0, 4)) - Number(m.slice(0, 4))) * 12 + Number(wedding.slice(5, 7)) - Number(m.slice(5)); return diff > 0 ? `${diff} ${diff === 1 ? 'mês' : 'meses'} antes` : ''; };
  return `<p class="field-hint board-hint">Arraste os cartões entre os meses para mudar o prazo (no celular, toque no cartão e mude a data). A coluna Atrasadas mostra o que já passou da data.</p>
  <div class="board">${late.length ? column('late', 'Atrasadas', 'Passou da data', late, null) : ''}${months.map(m => column(m, fromIso(`${m}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()), monthTag(m), byMonth(m), m)).join('')}${column('nodate', 'Sem data', 'Prioridades', undated, '')}</div>`;
}
function renderMonths() {
  const today = todayIso(), wedding = data.wedding.date, current = today.slice(0, 7);
  const items = checklist(data).filter(i => !i.done && !i.added);
  const dated = data.tasks.filter(t => t.date);
  const last = [wedding?.slice(0, 7), ...dated.map(t => t.date.slice(0, 7))].filter(Boolean).sort().pop() || current;
  const months = [];
  for (let d = fromIso(`${current}-01`); isoDate(d).slice(0, 7) <= (last > current ? last : current); d.setMonth(d.getMonth() + 1)) months.push(isoDate(d).slice(0, 7));
  const late = dated.filter(t => t.status !== 'Concluído' && t.date.slice(0, 7) < current).sort(byTaskOrder);
  const taskRow = t => `<li class="${t.status === 'Concluído' ? 'is-done' : ''}"><input type="checkbox" class="task-check" data-task-toggle="${t.id}" ${t.status === 'Concluído' ? 'checked' : ''} aria-label="Concluir ${esc(t.title)}"><button type="button" class="month-task" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</button><span class="month-date">${esc(shortDate(t.date))}</span></li>`;
  const suggestionRow = i => `<li class="is-suggestion"><span class="sugg-mark" aria-hidden="true">✦</span><span class="month-task">${esc(i.title)}${i.late ? ' <b>· atrasada</b>' : ''}</span><button type="button" class="text-button" data-add-suggestion="${i.key}">Adicionar</button></li>`;
  const monthCard = m => {
    const tasks = dated.filter(t => t.date.slice(0, 7) === m).sort(byTaskOrder), done = tasks.filter(t => t.status === 'Concluído').length;
    const sugg = items.filter(i => (i.due.slice(0, 7) < current ? current : i.due.slice(0, 7)) === m);
    const diff = (Number(m.slice(0, 4)) - Number(wedding?.slice(0, 4) || 0)) * 12 + Number(m.slice(5)) - Number(wedding?.slice(5, 7) || 0);
    const tag = wedding && m === wedding.slice(0, 7) ? 'Mês do casamento ♡' : m === current ? 'Este mês' : wedding && diff < 0 ? `${-diff} ${diff === -1 ? 'mês' : 'meses'} antes` : '';
    return `<section class="card month-card ${m === current ? 'is-current' : ''} ${wedding && m === wedding.slice(0, 7) ? 'is-wedding' : ''}"><header class="month-head"><div><h3>${esc(fromIso(`${m}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()))}</h3>${tag ? `<span>${tag}</span>` : ''}</div><small>${done}/${tasks.length}</small></header>${tasks.length ? `<div class="mini-track"><span style="width:${Math.round(done / tasks.length * 100)}%"></span></div>` : ''}<ul class="month-list">${tasks.map(taskRow).join('')}${sugg.map(suggestionRow).join('')}</ul>${!tasks.length && !sugg.length ? '<p class="priority-empty">Nada marcado neste mês.</p>' : ''}</section>`;
  };
  return `${items.length ? `<section class="notice-card"><div><strong>A cerimonialista virtual sugeriu ${items.length} ${items.length === 1 ? 'etapa' : 'etapas'}</strong><p>Pelo seu ${esc((data.wedding.style || 'casamento').toLowerCase())} e pela data${wedding ? ` (${esc(dateLabel(wedding))})` : ''}, organizadas mês a mês. As marcadas com ✦ ainda não estão no cronograma.</p></div><button type="button" class="button button-primary" data-action="generate-checklist">Adicionar todas</button></section>` : ''}
  ${late.length ? `<section class="card month-card is-late"><header class="month-head"><div><h3>Atrasadas</h3><span>De meses anteriores</span></div><small>${late.length}</small></header><ul class="month-list">${late.map(taskRow).join('')}</ul></section>` : ''}
  <div class="month-grid">${months.map(monthCard).join('')}</div>`;
}
function renderNotes() {
  const notes = [...data.notes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const action = '<button class="button button-primary" data-action="add-note"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nova anotação</button>';
  return `${heading('SUAS IDEIAS', 'Anotações.', 'Guarde ideias, lembretes e detalhes importantes do planejamento.', action)}
  <section class="notes-grid">${notes.length ? notes.map(note => `<article class="card note-card"><div class="note-card-head"><span class="note-card-icon" aria-hidden="true">${icon('note')}</span><div class="row-actions"><button data-action="edit-note" data-id="${esc(note.id)}" aria-label="Editar anotação">${icon('edit')}</button><button data-action="delete-note" data-id="${esc(note.id)}" aria-label="Excluir anotação">${icon('trash')}</button></div></div><h2>${esc(note.title)}</h2><div class="note-content">${renderNoteContent(note.content)}</div><small>${note.updatedAt ? `Atualizada em ${new Date(note.updatedAt).toLocaleDateString('pt-BR')}` : 'Anotação'}</small></article>`).join('') : `<article class="card notes-empty"><span class="empty-mark" aria-hidden="true">${icon('note')}</span><h2>Nenhuma anotação por enquanto</h2><p>Crie uma anotação para registrar ideias e lembretes do casamento.</p><button class="button button-secondary" data-action="add-note"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Criar primeira anotação</button></article>`}</section>`;
}


const noteTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'A']);
function safeNoteUrl(value) { try { const url = new URL(value, location.href); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function sanitizeNoteHtml(html = '') {
  const parsed = new DOMParser().parseFromString(String(html), 'text/html');
  const clean = node => [...node.childNodes].map(child => {
    if (child.nodeType === Node.TEXT_NODE) return esc(child.textContent);
    if (child.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = child.tagName, content = clean(child);
    if (!noteTags.has(tag)) return content;
    if (tag === 'A') { const href = safeNoteUrl(child.getAttribute('href') || ''); return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${content}</a>` : content; }
    return `<${tag.toLowerCase()}>${content}</${tag.toLowerCase()}>`;
  }).join('');
  return clean(parsed.body);
}
function linkifyNoteText(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const walk = node => [...node.childNodes].forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const fragment = document.createDocumentFragment();
      child.textContent.split(/(https?:\/\/[^\s<]+)/gi).forEach(part => {
        if (/^https?:\/\//i.test(part)) { const href = safeNoteUrl(part); if (href) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = part; fragment.append(a); return; } }
        fragment.append(document.createTextNode(part));
      }); child.replaceWith(fragment);
    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'A') walk(child);
  }); walk(parsed.body); return parsed.body.innerHTML;
}
function renderNoteContent(content = '') { return linkifyNoteText(sanitizeNoteHtml(content).replace(/\n/g, '<br>')); }

function field(name, label, value = '', type = 'text', options = null, full = false, extra = {}) {
  const id = `field-${name}`; let control;
  if (options) control = `<select id="${id}" name="${name}" ${extra.required ? 'required' : ''}>${options.map(o => `<option value="${esc(o)}" ${String(value) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (type === 'textarea') control = `<textarea id="${id}" name="${name}" ${extra.required ? 'required' : ''} placeholder="${esc(extra.placeholder || '')}">${esc(value)}</textarea>`;
  else control = `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${extra.required ? 'required' : ''} ${extra.min !== undefined ? `min="${extra.min}"` : ''} ${extra.step ? `step="${extra.step}"` : ''} placeholder="${esc(extra.placeholder || '')}">`;
  return `<div class="field ${full ? 'full' : ''}"><label for="${id}">${label}</label>${control}</div>`;
}
function openModal(title, fields, onSave) {
  $('#modal-title').textContent = title; $('#modal-fields').innerHTML = fields; const modal = $('#modal');
  const isNote = Boolean($('#note-editor')); modal.classList.toggle('note-modal', isNote);
  $('#modal-submit').textContent = 'Salvar'; $('#modal-submit').classList.remove('button-danger');
  const submit = event => { event.preventDefault(); const form = new FormData($('#modal-form')); const values = Object.fromEntries(form.entries()); if (isNote) { const editor = $('#note-editor'); if (!editor.textContent.trim()) { editor.focus(); notify('Escreva o conte\u00fado da anota\u00e7\u00e3o.'); return; } values.content = sanitizeNoteHtml(editor.innerHTML); } onSave(values); modal.close(); render(); };
  $('#modal-form').onsubmit = submit; modal.showModal(); raiseInteractiveCursor(); setTimeout(() => (isNote ? $('#note-editor') : $('#modal-fields input, #modal-fields select, #modal-fields textarea'))?.focus(), 50);
  if (isNote) $('#modal-fields').querySelectorAll('[data-note-command]').forEach(button => {
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => { const command = button.dataset.noteCommand, editor = $('#note-editor'); editor.focus(); if (command === 'createLink') { const input = prompt('Cole o endere\u00e7o do link (https://...)'); if (!input) return; const href = safeNoteUrl(input.trim()); if (!href || !/^https?:/i.test(href)) { notify('Use um link iniciado por http:// ou https://.'); return; } document.execCommand('createLink', false, href); } else document.execCommand(command, false, null); });
  });
}
function raiseInteractiveCursor() {
  const dot = $('#cursor-dot');
  if (dot?.matches(':popover-open')) {
    dot.hidePopover();
    dot.showPopover();
  }
}
function recordForm(kind, record = {}) {
  if (kind === 'guest') return [field('name', 'Nome', record.name || '', 'text', null, true, { required: true }), field('phone', 'Telefone / WhatsApp', record.phone || '', 'tel', null, false, { placeholder: '(11) 99999-0000' }), field('group', 'Grupo', record.group || guestGroups[0], 'text', guestGroups), field('family', 'Família / núcleo', record.family || '', 'text', null, false, { placeholder: 'Ex.: Oliveira' }), field('status', 'Status do convite', record.status || 'Pendente', 'text', guestStatuses), field('companions', 'Acompanhantes adultos', record.companions ?? 0, 'number', null, false, { min: 0 }), field('children', 'Crianças', record.children ?? 0, 'number', null, false, { min: 0 }), `<div class="field"><label for="field-dietary">Restrição alimentar</label><input id="field-dietary" name="dietary" list="diet-list" value="${esc(record.dietary || '')}" placeholder="Nenhuma" autocomplete="off"><datalist id="diet-list">${dietaryOptions.map(o => `<option value="${esc(o)}">`).join('')}</datalist></div>`, `<div class="field"><label for="field-tableId">Mesa</label><select id="field-tableId" name="tableId"><option value="">Sem mesa</option>${data.tables.map(t => `<option value="${t.id}" ${record.tableId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>`, field('notes', 'Observações', record.notes || '', 'text', null, true)].join('');
  if (kind === 'expense') return [field('description', 'Descrição', record.description || '', 'text', null, true, { required: true }), field('category', 'Categoria', record.category || expenseCategories[0], 'text', allExpenseCategories()), field('supplier', 'Fornecedor', record.supplier || '', 'text', null, false, { placeholder: 'Ex.: Buffet Sabor & Arte' }), field('planned', 'Valor previsto (R$)', record.planned ?? '', 'number', null, false, { min: 0, step: '.01' }), field('paid', 'Valor pago (R$)', record.paid ?? 0, 'number', null, false, { min: 0, step: '.01' }), field('status', 'Forma / status', record.status || 'Pendente', 'text', expenseStatusList()), field('notes', 'Observações', record.notes || '', 'text', null, true), '<p class="field-hint" style="grid-column:1/-1;margin:0">"Presente Ganho" conta no total do orçamento, mas não no que falta pagar.</p>'].join('');
  if (kind === 'document') return [field('title', 'Documento', record.title || '', 'text', null, true, { required: true, placeholder: 'Ex.: Contrato do buffet, certidões, nota fiscal do vestido' }), field('category', 'Categoria', record.category || docCategories[0], 'text', docCategories), field('date', 'Data', record.date || todayIso(), 'date'), field('notes', 'Observações', record.notes || '', 'textarea', null, true)].join('');
  if (kind === 'inspiration') { const colors = record.colors?.length ? record.colors : paletteDefaults; return [field('title', 'Nome do mural', record.title || '', 'text', null, true, { required: true, placeholder: 'Ex.: Mesa do bolo, buquê, convite' }), field('notes', 'O que a gente gostou', record.notes || '', 'textarea', null, true, { placeholder: 'Ex.: flores brancas e folhagem, nada de dourado' }), `<div class="field full"><label>Paleta de cores</label><div class="palette-inputs">${[0, 1, 2, 3].map(i => `<input type="color" name="c${i}" value="${esc(colors[i] || paletteDefaults[i])}" aria-label="Cor ${i + 1}">`).join('')}<label class="tpl-toggle"><input type="checkbox" name="showColors" ${record.colors?.length ? 'checked' : ''}> Mostrar a paleta no mural</label></div></div>`].join(''); }
  if (kind === 'table') return [field('name', 'Nome da mesa', record.name || `Mesa ${data.tables.length + 1}`, 'text', null, false, { required: true }), field('seats', 'Lugares', record.seats ?? 8, 'number', null, false, { min: 0 })].join('');
  if (kind === 'contact') return [field('name', 'Nome', record.name || '', 'text', null, false, { required: true }), field('role', 'Função', record.role || '', 'text', null, false, { placeholder: 'Ex.: Cerimonialista, motorista, padrinho' }), field('phone', 'Telefone / WhatsApp', record.phone || '', 'tel', null, true, { required: true })].join('');
  if (kind === 'place') return [field('name', 'Lugar', record.name || '', 'text', null, false, { required: true, placeholder: 'Ex.: Making of, igreja, hotel' }), field('time', 'Horário', record.time || '', 'time'), field('address', 'Endereço', record.address || '', 'text', null, true, { required: true }), field('notes', 'Ponto de referência / observações', record.notes || '', 'text', null, true)].join('');
  if (kind === 'planb') return [field('problem', 'Se acontecer...', record.problem || '', 'text', null, true, { required: true }), field('solution', 'O que fazer', record.solution || '', 'textarea', null, true, { required: true }), field('owner', 'Quem resolve', record.owner || '', 'text', null, true)].join('');
  if (kind === 'kit') return field('item', 'Item do kit', record.item || '', 'text', null, true, { required: true });
  if (kind === 'honeymoon') { const h = data.honeymoon; return [field('destination', 'Destino escolhido', h.destination || '', 'text', null, true, { placeholder: 'Ex.: Maragogi, Alagoas' }), field('start', 'Ida', h.start || '', 'date'), field('end', 'Volta', h.end || '', 'date'), field('budget', 'Orçamento da viagem (R$)', h.budget || '', 'number', null, false, { min: 0, step: '.01' }), field('saved', 'Já economizado (R$)', h.saved || '', 'number', null, false, { min: 0, step: '.01' }), field('notes', 'Anotações', h.notes || '', 'textarea', null, true)].join(''); }
  if (kind === 'hmDestination') return [field('name', 'Destino', record.name || '', 'text', null, false, { required: true }), field('estimate', 'Custo estimado (R$)', record.estimate ?? '', 'number', null, false, { min: 0, step: '.01' }), field('season', 'Melhor época', record.season || '', 'text'), field('link', 'Link de inspiração', record.link || '', 'text'), field('notes', 'Por que queremos ir', record.notes || '', 'textarea', null, true)].join('');
  if (kind === 'hmBooking') return [field('title', 'Reserva / opção', record.title || '', 'text', null, true, { required: true, placeholder: 'Ex.: Pousada Mar Azul, voo Recife–Maceió' }), field('type', 'Tipo', record.type || bookingTypes[0], 'text', bookingTypes), field('status', 'Status', record.status || 'Opção', 'text', bookingStatuses), field('checkin', 'Data / check-in', record.checkin || '', 'date'), field('checkout', 'Check-out / volta', record.checkout || '', 'date'), field('price', 'Valor (R$)', record.price ?? '', 'number', null, false, { min: 0, step: '.01' }), field('paid', 'Já pago (R$)', record.paid ?? 0, 'number', null, false, { min: 0, step: '.01' }), field('code', 'Código da reserva', record.code || '', 'text'), field('link', 'Link da reserva / comprovante', record.link || '', 'text'), field('notes', 'Observações', record.notes || '', 'text', null, true)].join('');
  if (kind === 'hmItinerary') return [field('date', 'Dia', record.date || data.honeymoon.start || '', 'date', null, false, { required: true }), field('time', 'Horário', record.time || '', 'time'), field('activity', 'Passeio / restaurante', record.activity || '', 'text', null, true, { required: true }), field('place', 'Local / endereço', record.place || '', 'text', null, true), field('notes', 'Observações', record.notes || '', 'text', null, true)].join('');
  if (kind === 'vendor') return [field('name', 'Fornecedor', record.name || '', 'text', null, true, { required: true, placeholder: 'Ex.: Estúdio Luz & Afeto' }), field('category', 'Categoria', record.category || expenseCategories[0], 'text', allExpenseCategories()), field('status', 'Status', record.status || 'Orçamento recebido', 'text', VENDOR_STATUSES), field('contact', 'Contato', record.contact || '', 'text', null, false, { placeholder: 'Nome de quem atende' }), field('phone', 'WhatsApp', record.phone || '', 'tel', null, false, { placeholder: '(11) 99999-0000' }), field('email', 'E-mail', record.email || '', 'email'), field('link', 'Site ou Instagram', record.link || '', 'text', null, true, { placeholder: 'instagram.com/...' }), field('price', 'Preço inicial (R$)', record.price ?? '', 'number', null, false, { min: 0, step: '.01' }), field('discount', 'Desconto (R$)', record.discount ?? 0, 'number', null, false, { min: 0, step: '.01' }), field('fees', 'Taxas extras (R$)', record.fees ?? 0, 'number', null, false, { min: 0, step: '.01' }), '<p class="field-hint" style="align-self:end;margin:0 0 10px">Valor final = preço − desconto + taxas.</p>', field('includes', 'O que está incluído (um item por linha)', record.includes || '', 'textarea', null, true, { placeholder: 'Ex.: 8 horas de cobertura\n400 fotos editadas\nÁlbum 30x30' }), field('conditions', 'Condições e forma de pagamento', record.conditions || '', 'textarea', null, true, { placeholder: 'Ex.: 30% de entrada e o resto em 5x no boleto. Entrega em 60 dias.' }), field('agreed', 'O que ficou combinado', record.agreed || '', 'textarea', null, true, { placeholder: 'Ex.: chega às 14h, inclui 2 assistentes, entrega das fotos em 60 dias' }), field('overtime', 'Hora extra (R$ por hora)', record.overtime ?? '', 'number', null, false, { min: 0, step: '.01' }), field('contractStatus', 'Contrato', record.contractStatus || 'Sem contrato', 'text', contractStatuses), '<p class="field-hint" style="align-self:end;margin:0 0 10px">Anexe o contrato e as propostas pelo botão de clipe do fornecedor.</p>', field('notes', 'Observações e pontos de negociação', record.notes || '', 'textarea', null, true)].join('');
  if (kind === 'ceremony') return [field('step', 'Etapa', record.step || ceremonySteps[0], 'text', ceremonySteps, true), field('participants', 'Participantes', record.participants || '', 'text', null, true), field('music', 'Música', record.music || '', 'text'), field('artist', 'Artista', record.artist || '', 'text'), field('notes', 'Instruções / observações', record.notes || '', 'textarea', null, true)].join('');
  if (kind === 'supply') return [field('name', 'Item', record.name || '', 'text', null, true, { required: true }), field('category', 'Categoria', record.category || checklistCategories[0], 'text', checklistCategories), field('quantity', 'Quantidade / observação', record.quantity || '', 'text'), field('status', 'Status', record.status || 'Pendente', 'text', checklistStatuses)].join('');
  if (kind === 'task') return [field('title', 'Tarefa', record.title || '', 'text', null, true, { required: true }), field('date', 'Data', record.date || '', 'date'), field('time', 'Horário', record.time || '', 'time'), field('priority', 'Prioridade', record.priority || 'Média', 'text', taskPriorities), field('status', 'Status', record.status || 'A Fazer', 'text', taskStatuses), responsibleFields(record), field('description', 'Detalhes', record.description || '', 'textarea', null, true), '<p class="field-hint" style="grid-column:1/-1;margin:0">Sem data, a tarefa fica em Prioridades. Com responsável e WhatsApp, você avisa a pessoa em um toque.</p>'].join('');
  if (kind === 'note') return [field('title', 'T\u00edtulo', record.title || '', 'text', null, true, { required: true }), `<div class="field full"><label for="note-editor">Anota\u00e7\u00e3o</label><div class="note-toolbar" role="toolbar" aria-label="Formata\u00e7\u00e3o da anota\u00e7\u00e3o"><button type="button" data-note-command="bold" aria-label="Negrito" title="Negrito"><strong>B</strong></button><button type="button" data-note-command="italic" aria-label="It\u00e1lico" title="It\u00e1lico"><em>I</em></button><button type="button" data-note-command="underline" aria-label="Sublinhado" title="Sublinhado"><u>U</u></button><button type="button" data-note-command="strikeThrough" aria-label="Riscado" title="Riscado"><s>S</s></button><span></span><button type="button" data-note-command="createLink" aria-label="Inserir link" title="Inserir link">Link</button><button type="button" data-note-command="insertUnorderedList" aria-label="Lista" title="Lista">Lista</button></div><div id="note-editor" class="note-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Escreva sua ideia, cole um link ou formate o texto...">${sanitizeNoteHtml(record.content || '')}</div><small class="editor-hint">Selecione um trecho para formatar. Links escritos como https://... ficam clic\u00e1veis ao salvar.</small></div>`].join('');
  if (kind === 'ceremonial') return [field('time', 'Horário', record.time || '', 'time', null, false, { required: true }), field('title', 'Atividade', record.title || '', 'text', null, true, { required: true }), field('responsible', 'Responsável', record.responsible || '', 'text', null, false, { required: true }), field('track', 'Cronograma de quem', record.track || 'Geral', 'text', tracks), field('status', 'Status', record.status || 'A Fazer', 'text', taskStatuses), field('details', 'Orientações para a equipe', record.details || '', 'textarea', null, true)].join('');
  if (kind === 'wedding') return [field('couple', 'Nomes do casal', data.wedding.couple, 'text', null, true, { required: true }), field('date', 'Data do casamento', data.wedding.date, 'date', null, false, { required: true }), field('time', 'Horário do casamento', data.wedding.time || '11:30', 'time', null, false, { required: true }), field('venue', 'Local', data.wedding.venue, 'text', null, true), field('guestsExpected', 'Convidados previstos', data.wedding.guestsExpected || '', 'number', null, false, { min: 0, placeholder: 'Ex.: 100' }), field('budget', 'Orçamento máximo (R$)', data.wedding.budget || '', 'number', null, false, { min: 0, step: '.01', placeholder: 'Ex.: 30000' }), field('style', 'Estilo', data.wedding.style || WEDDING_STYLES[0], 'text', WEDDING_STYLES), field('ceremonyType', 'Cerimônia', data.wedding.ceremonyType || CEREMONY_TYPES[0], 'text', CEREMONY_TYPES), '<p class="field-hint" style="grid-column:1/-1;margin:0">Com o orçamento e o número de convidados, a cerimonialista virtual sugere quanto gastar em cada categoria e monta o checklist pelo estilo e tipo de cerimônia.</p>'].join('');
}
// Responsável com sugestões dos convidados (o telefone é preenchido sozinho quando a pessoa já tem um).
const knownPeople = () => new Map([...data.guests.map(g => [g.name, g.phone || '']), ...data.tasks.filter(t => t.responsible).map(t => [t.responsible, t.responsiblePhone || ''])]);
function responsibleFields(record) {
  return `<div class="field"><label for="field-responsible">Responsável</label><input id="field-responsible" name="responsible" list="people-list" value="${esc(record.responsible || '')}" placeholder="Quem cuida disso" autocomplete="off"><datalist id="people-list">${[...knownPeople().keys()].map(name => `<option value="${esc(name)}">`).join('')}</datalist></div><div class="field"><label for="field-responsiblePhone">Telefone do responsável</label><input id="field-responsiblePhone" name="responsiblePhone" type="tel" value="${esc(record.responsiblePhone || '')}" placeholder="(11) 99999-0000"></div>`;
}
function addOrEdit(kind, id = null, preset = {}) {
  const config = { document: ['documents', 'documento', 'title', 'id'], inspiration: ['inspirations', 'mural', 'title', 'id'], table: ['tables', 'mesa', 'name', 'id'], contact: ['emergencyContacts', 'contato', 'name', 'id'], place: ['places', 'endereço', 'name', 'id'], planb: ['planB', 'plano B', 'problem', 'id'], kit: ['kit', 'item do kit', 'item', 'id'], hmDestination: ['hmDestinations', 'destino', 'name', 'id'], hmBooking: ['hmBookings', 'reserva', 'title', 'id'], hmItinerary: ['hmItinerary', 'passeio', 'activity', 'id'], vendor: ['vendors', 'fornecedor', 'name', 'id'], guest: ['guests', 'convidado', 'name', 'id'], expense: ['expenses', 'gasto', 'description', 'id'], ceremony: ['ceremony', 'etapa', 'step', 'id'], ceremonial: ['ceremonial', 'horário da cerimonial', 'title', 'id'], supply: ['supplies', 'item', 'name', 'id'], task: ['tasks', 'tarefa', 'title', 'id'], note: ['notes', 'anotação', 'title', 'id'] }[kind];
  const [collection, label, , idKey] = config; const existing = id ? data[collection].find(x => x[idKey] === id) : null;
  openModal(`${existing ? 'Editar' : 'Adicionar'} ${label}`, recordForm(kind, existing || preset), values => {
    for (const k of ['companions', 'children', 'planned', 'paid', 'price', 'discount', 'fees', 'seats', 'estimate', 'overtime']) if (values[k] !== undefined) values[k] = Number(values[k] || 0);
    if (kind === 'inspiration') { values.colors = values.showColors ? [0, 1, 2, 3].map(i => values[`c${i}`]).filter(Boolean) : []; [0, 1, 2, 3].forEach(i => delete values[`c${i}`]); delete values.showColors; }
    if (existing) Object.assign(existing, values, kind === 'note' ? { updatedAt: new Date().toISOString() } : {}); else data[collection].push({ id: uid(kind[0]), ...values, ...(kind === 'note' ? { updatedAt: new Date().toISOString() } : {}) });
    save(kind === 'note' ? 'Anotação salva.' : existing ? 'Alterações salvas.' : 'Item adicionado.');
    if (!existing && (kind === 'document' || kind === 'inspiration')) { const record = data[collection][data[collection].length - 1]; setTimeout(() => openAttachments(record.id, collection), 80); }
  });
  if (kind === 'task') $('#field-responsible')?.addEventListener('change', event => { const phone = knownPeople().get(event.target.value.trim()); const input = $('#field-responsiblePhone'); if (phone && input && !input.value) input.value = phone; });
}
function deleteRecord(collection, id, label) {
  openModal(`Excluir ${label}?`, '<p class="confirm-copy">Esta ação não pode ser desfeita. O item será removido do planejamento.</p>', () => {
    if (['expenses', 'tasks', 'vendors', 'hmBookings', 'documents', 'inspirations'].includes(collection)) (data[collection].find(r => r.id === id)?.files || []).forEach(deleteAttachmentParts);
    data[collection] = data[collection].filter(r => r.id !== id);
    save('Item removido.');
  });
  $('#modal-submit').textContent = 'Excluir item';
  $('#modal-submit').classList.add('button-danger');
}
function addCategory() {
  openModal('Nova categoria', field('name', 'Nome da categoria', '', 'text', null, true, { required: true, placeholder: 'Ex.: Fotografia, Papelaria, Lua de mel' }), values => {
    const name = String(values.name || '').trim();
    if (!name) return;
    if (allExpenseCategories().some(c => c.toLowerCase() === name.toLowerCase())) { notify('Essa categoria já existe.'); return; }
    data.customCategories = [...(data.customCategories || []), name];
    expenseFilter = 'Todas';
    save('Categoria criada.');
  });
}

/* Anexos dos gastos: arquivos em planners/{uid}/anexos (em partes, por causa do limite de 1 MB por documento)
   e links no próprio gasto. */
const ATTACH_PART = 700000, ATTACH_MAX = 8 * 1024 * 1024;
const attachRef = (fileId, part) => doc(db, 'planners', plannerId || activeUser.uid, 'anexos', `${fileId}_${part}`);
const fileSize = bytes => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const readAsDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size < 500000) return readAsDataUrl(file);
  try {
    const bitmap = await createImageBitmap(file), scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .82);
  } catch { return readAsDataUrl(file); }
}
async function uploadAttachment(expense, file) {
  if (file.size > ATTACH_MAX) throw Object.assign(new Error('grande'), { userMessage: `${file.name} passa de 8 MB. Envie um arquivo menor ou salve no Google Drive e adicione o link.` });
  const dataUrl = await shrinkImage(file), id = uid('f'), parts = Math.ceil(dataUrl.length / ATTACH_PART);
  for (let n = 0; n < parts; n++) await setDoc(attachRef(id, n), { fileId: id, part: n, data: dataUrl.slice(n * ATTACH_PART, (n + 1) * ATTACH_PART) });
  expense.files = [...(expense.files || []), { id, name: file.name, type: dataUrl.slice(5, dataUrl.indexOf(';')) || file.type, size: file.size, parts, addedAt: new Date().toISOString() }];
}
async function readAttachment(file) {
  const snaps = await Promise.all(Array.from({ length: file.parts || 1 }, (_, n) => getDoc(attachRef(file.id, n))));
  return snaps.map(snap => snap.data()?.data || '').join('');
}
function deleteAttachmentParts(file) { return Promise.all(Array.from({ length: file.parts || 1 }, (_, n) => deleteDoc(attachRef(file.id, n)).catch(() => {}))); }
function dataUrlToBlob(url) {
  const [head, body] = url.split(','), bytes = atob(body), array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: head.slice(5, head.indexOf(';')) });
}
function openAttachments(recordId, collection = 'expenses') {
  const current = () => data[collection].find(e => e.id === recordId);
  if (!current()) return;
  let dialog = $('#attach-dialog');
  if (!dialog) {
    document.body.insertAdjacentHTML('beforeend', '<dialog id="attach-dialog" class="modal attach-modal"><div id="attach-body"></div></dialog>');
    dialog = $('#attach-dialog');
    dialog.addEventListener('close', () => render());
  }
  const paint = (busy = '') => {
    const expense = current();
    if (!expense) return dialog.close();
    const files = expense.files || [], links = expense.links || [];
    $('#attach-body').innerHTML = `<div class="modal-head"><div><p class="eyebrow">ANEXOS</p><h2>${esc(expense.description || expense.title || expense.name || expense.activity)}</h2></div><button type="button" class="icon-button" data-attach-close aria-label="Fechar">×</button></div>
      <section class="attach-section"><h3>Arquivos <small>Fotos, PDFs e contratos · até 8 MB cada</small></h3>
        <div class="attach-list">${files.length ? files.map(f => `<div class="attach-item" data-file="${f.id}"><span class="attach-thumb">${f.type.startsWith('image/') ? '<img alt="">' : `<b>${esc((f.name.split('.').pop() || 'arq').slice(0, 4).toUpperCase())}</b>`}</span><span class="attach-name"><strong>${esc(f.name)}</strong><small>${fileSize(f.size)}</small></span><button type="button" class="button button-secondary button-sm" data-open-file="${f.id}">Abrir</button><button type="button" class="icon-button" data-delete-file="${f.id}" aria-label="Excluir ${esc(f.name)}">${icon('trash')}</button></div>`).join('') : '<p class="attach-empty">Nenhum arquivo ainda.</p>'}</div>
        <label class="button button-secondary attach-upload ${busy ? 'is-busy' : ''}">${icon('upload')}${busy || 'Enviar arquivos'}<input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" hidden ${busy ? 'disabled' : ''}></label>
      </section>
      <section class="attach-section"><h3>Links <small>Contrato no Drive, site do fornecedor, Instagram...</small></h3>
        <div class="attach-list">${links.length ? links.map(l => `<div class="attach-item"><span class="attach-thumb">${icon('link')}</span><span class="attach-name"><strong>${esc(l.title || l.url)}</strong><small>${esc(l.url)}</small></span><a class="button button-secondary button-sm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Abrir</a><button type="button" class="icon-button" data-delete-link="${l.id}" aria-label="Excluir link">${icon('trash')}</button></div>`).join('') : '<p class="attach-empty">Nenhum link ainda.</p>'}</div>
        <form class="attach-link-form"><input name="title" placeholder="Nome (ex.: Contrato do buffet)" aria-label="Nome do link"><input name="url" placeholder="https://..." aria-label="Endereço do link" required><button class="button button-primary button-sm" type="submit">Adicionar link</button></form>
      </section>`;
    files.filter(f => f.type.startsWith('image/')).forEach(f => readAttachment(f).then(url => { const img = dialog.querySelector(`[data-file="${f.id}"] img`); if (img) img.src = url; }).catch(() => {}));
  };
  dialog.onclick = async event => {
    if (event.target === dialog || event.target.closest('[data-attach-close]')) return dialog.close();
    const expense = current();
    const openId = event.target.closest('[data-open-file]')?.dataset.openFile;
    if (openId) {
      const file = (expense.files || []).find(f => f.id === openId), win = window.open('', '_blank');
      try { const url = URL.createObjectURL(dataUrlToBlob(await readAttachment(file))); if (win) win.location.href = url; else location.href = url; }
      catch (e) { console.error(e); win?.close(); notify('Não foi possível abrir o arquivo.'); }
    }
    const deleteId = event.target.closest('[data-delete-file]')?.dataset.deleteFile;
    if (deleteId && confirm('Excluir este arquivo?')) {
      const file = (expense.files || []).find(f => f.id === deleteId);
      expense.files = (expense.files || []).filter(f => f.id !== deleteId);
      save('Arquivo excluído.'); paint();
      if (file) deleteAttachmentParts(file);
    }
    const linkId = event.target.closest('[data-delete-link]')?.dataset.deleteLink;
    if (linkId) { expense.links = (expense.links || []).filter(l => l.id !== linkId); save('Link excluído.'); paint(); }
  };
  dialog.onchange = async event => {
    if (!event.target.matches('input[type="file"]') || !event.target.files.length) return;
    const list = [...event.target.files];
    for (const [i, file] of list.entries()) {
      paint(`Enviando ${i + 1} de ${list.length}...`);
      try { await uploadAttachment(current(), file); save(); }
      catch (e) { console.error(e); notify(e.userMessage || 'Não foi possível enviar o arquivo. Confira a conexão e as regras do Firestore.'); }
    }
    paint();
    notify(list.length === 1 ? 'Arquivo anexado.' : 'Arquivos anexados.');
  };
  dialog.onsubmit = event => {
    event.preventDefault();
    const form = event.target, raw = form.url.value.trim(), url = safeNoteUrl(/^[a-z]+:/i.test(raw) ? raw : `https://${raw}`);
    if (!url || !/^https?:/i.test(url)) { notify('Confira o endereço do link.'); return; }
    const expense = current();
    expense.links = [...(expense.links || []), { id: uid('l'), title: form.title.value.trim(), url }];
    save('Link adicionado.'); paint();
  };
  paint();
  dialog.showModal();
}
function animateStatusChange(source, message, complete = false) {
  const row = source.closest('.check-item, .timeline-row, .ceremonial-row, .task-row');
  if (row) {
    row.classList.toggle('is-complete', complete);
    row.querySelector('.task-text')?.classList.toggle('done', complete);
    row.classList.remove('status-success'); void row.offsetWidth; row.classList.add('status-success');
    const burst = document.createElement('span'); burst.className = 'status-burst'; burst.setAttribute('aria-hidden', 'true'); burst.textContent = complete ? '✓' : '•'; row.append(burst);
    setTimeout(() => burst.remove(), 650);
  }
  save(message, false);
}
const importSchemas = {
  guests: { title: 'Convidados', columns: ['Nome', 'Grupo', 'Status'], keys: ['name', 'group', 'status'], defaults: ['Família Noiva', 'Pendente'] },
  expenses: { title: 'Gastos', columns: ['Item', 'Categoria', 'Valor', 'Status'], keys: ['description', 'category', 'planned', 'status'], defaults: [expenseCategories[0], 'Pendente'] },
  supplies: { title: 'Checklist do sítio', columns: ['Item', 'Categoria'], keys: ['name', 'category'], defaults: [checklistCategories[0]] },
  ceremony: { title: 'Músicas e cortejo', columns: ['Etapa', 'Participantes', 'Música', 'Artista', 'Observações'], keys: ['step', 'participants', 'music', 'artist', 'notes'], defaults: ['', '', '', ''] },
};
let importType = '';
let importRows = [];
function normalizeKey(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function parseTxtRows(text, type) {
  const schema = importSchemas[type], aliases = {
    nome: 'name', convidado: 'name', item: type === 'expenses' ? 'description' : 'name', descricao: 'description', fornecedor: 'description', categoria: 'category', grupo: 'group', status: 'status', convite: 'status', valor: 'planned', preco: 'planned', etapa: 'step', ordem: 'step', participantes: 'participants', pessoa: 'participants', musica: 'music', artista: 'artist', observacoes: 'notes', posicao: 'notes', anotacoes: 'notes', quantidade: 'quantity', telefone: 'phone', acompanhantes: 'companions', criancas: 'children'
  };
  const result = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim(); if (!line) return;
    let parts = null, parsed = {};
    const pairs = [...line.matchAll(/([^,;|\t]+?)\s*:\s*([^,;|\t]+)/g)];
    if (pairs.length && pairs.some(m => aliases[normalizeKey(m[1])])) {
      pairs.forEach(m => { const k = aliases[normalizeKey(m[1])]; if (k && schema.keys.includes(k)) parsed[k] = m[2].trim(); });
    } else {
      const delimiter = [',', ';', '|', '\t'].sort((a, b) => line.split(b).length - line.split(a).length)[0];
      parts = line.split(delimiter).map(v => v.trim());
      const normalized = parts.map(normalizeKey);
      const headerAliases = { name: ['nome', 'convidado'], description: ['item', 'descricao', 'fornecedor'], category: ['categoria', 'grupo'], planned: ['valor', 'preco'], status: ['status', 'convite'], step: ['etapa', 'ordem'], participants: ['participantes'], music: ['musica'], artist: ['artista'], notes: ['observacoes', 'posicao'] };
      if (result.length === 0 && normalized.some(v => Object.values(headerAliases).flat().includes(v))) return;
      schema.keys.forEach((key, i) => { if (parts[i]) parsed[key] = parts[i]; });
    }
    if (type === 'guests') { parsed.name ||= parts?.[0] || ''; parsed.group ||= schema.defaults[0]; parsed.status ||= schema.defaults[1]; }
    if (type === 'expenses') { parsed.description ||= parts?.[0] || ''; parsed.category ||= schema.defaults[0]; parsed.status ||= parts?.[3] || schema.defaults[1]; parsed.planned = parseMoney(parsed.planned ?? parts?.[2]); parsed.paid = /pago|quitado|pix|cart|boleto/i.test(parsed.status) ? parsed.planned : 0; parsed.notes ||= ''; }
    if (type === 'supplies') { parsed.name ||= parts?.[0] || ''; parsed.category ||= schema.defaults[0]; parsed.status = 'Pendente'; parsed.quantity ||= ''; }
    if (type === 'ceremony') { parsed.step ||= parts?.[0] || ''; parsed.participants ||= ''; parsed.music ||= ''; parsed.artist ||= ''; parsed.notes ||= ''; }
    parsed._line = index + 1; parsed._valid = type === 'expenses' ? Boolean(parsed.description && Number.isFinite(parsed.planned) && parsed.planned >= 0) : Boolean(parsed.name || parsed.step);
    result.push(parsed);
  });
  return result;
}
function parseMoney(value) { const s = String(value ?? '').replace(/R\$\s?/i, '').replace(/\s/g, ''); if (!s) return NaN; const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s; return Number(normalized); }
function openImport(type) {
  importType = type; importRows = [];
  $('#import-title').textContent = `Importar ${importSchemas[type].title}`;
  $('#import-content').innerHTML = `<div class="import-inputs"><label class="field full">Arquivo .TXT<input id="import-file" type="file" accept=".txt,text/plain"></label><label class="field full">Ou cole o texto aqui<textarea id="import-text" placeholder="${esc(importSchemas[type].columns.join(', '))}\nExemplo: ${type === 'guests' ? 'Ana Paula, Padrinhos, Confirmado' : type === 'expenses' ? 'Bolo de Casamento, Doces, 350.00, Pago Pix' : type === 'supplies' ? 'Papel Toalha, Descartáveis' : 'Entrada da noiva, Marina e Paulo, Pra Sonhar, Marcelo Jeneci, Corredor central'}"></textarea></label><div class="import-tools"><span>Separadores: vírgula, ponto e vírgula, barra vertical ou tabulação. Linhas com chave: valor também são aceitas.</span><button type="button" class="button button-secondary" id="parse-import">Pré-visualizar</button></div></div><div id="import-preview"></div><fieldset class="import-mode"><legend>Como importar</legend><label><input type="radio" name="import-mode" value="append" checked> Adicionar à lista atual</label><label><input type="radio" name="import-mode" value="replace"> Substituir lista existente</label></fieldset>`;
  $('#import-confirm').disabled = true;
  $('#import-dialog').showModal();
  raiseInteractiveCursor();
  $('#parse-import').addEventListener('click', () => previewImport($('#import-text').value));
  $('#import-file').addEventListener('change', async event => { const file = event.target.files[0]; if (file) { $('#import-text').value = await file.text(); previewImport($('#import-text').value); } });
  $('#import-preview').addEventListener('input', event => {
    const input = event.target.closest('[data-row][data-key]'); if (!input) return;
    const row = importRows[Number(input.dataset.row)]; row[input.dataset.key] = input.value;
    row._valid = importType === 'expenses' ? Boolean(row.description && Number.isFinite(parseMoney(row.planned)) && parseMoney(row.planned) >= 0) : Boolean(row.name || row.step);
    input.closest('tr').classList.toggle('import-invalid', !row._valid);
    input.closest('tr').querySelector('.import-error').textContent = row._valid ? 'Pronto' : `Linha ${row._line}: confira os campos obrigatórios`;
    $('#import-confirm').disabled = !importRows.length || importRows.some(r => !r._valid);
  });
}
function previewImport(text) {
  importRows = parseTxtRows(text, importType); const schema = importSchemas[importType];
  if (!importRows.length) { $('#import-preview').innerHTML = '<p class="import-feedback">Nenhuma linha de dados encontrada. Verifique o conteúdo do arquivo.</p>'; $('#import-confirm').disabled = true; return; }
  const keys = schema.keys;
  $('#import-preview').innerHTML = `<p class="import-feedback">${importRows.filter(r => r._valid).length} linha(s) válida(s), ${importRows.filter(r => !r._valid).length} com erro. Corrija os campos na tabela antes de importar.</p><div class="import-table-wrap"><table class="import-table"><thead><tr>${schema.columns.map(c => `<th>${esc(c)}</th>`).join('')}<th>Validação</th></tr></thead><tbody>${importRows.map((row, i) => `<tr class="${row._valid ? '' : 'import-invalid'}">${keys.map((key, j) => `<td><input aria-label="${esc(schema.columns[j])}, linha ${row._line}" data-row="${i}" data-key="${key}" value="${esc(row[key] ?? (key === 'name' ? row.description : ''))}"></td>`).join('')}<td class="import-error">${row._valid ? 'Pronto' : `Linha ${row._line}: confira os campos obrigatórios`}</td></tr>`).join('')}</tbody></table></div>`;
  $('#import-confirm').disabled = importRows.some(r => !r._valid);
}
function confirmImport() {
  if (!importRows.length || importRows.some(r => !r._valid)) return;
  const collection = importType, replace = $('#import-form [name="import-mode"]:checked').value === 'replace';
  const clean = importRows.map(row => { const { _line, _valid, ...record } = row; record.id = uid(importType[0]); if (importType === 'expenses') record.planned = parseMoney(record.planned); return record; });
  data[collection] = replace ? clean : [...data[collection], ...clean]; save(`${clean.length} registro(s) importado(s).`); $('#import-dialog').close(); render();
}
function pdfBase(title) {
  if (!window.jspdf?.jsPDF) { notify('Não foi possível carregar a biblioteca de PDF. Verifique a conexão.'); return null; }
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setProperties({ title, author: 'Entre Nós — Planejamento de casamento' });
  return doc;
}
function pdfHeading(doc, title, subtitle) {
  doc.setFont('helvetica', 'normal'); doc.setTextColor(62, 84, 69); doc.setFontSize(9); doc.text('ENTRE NÓS  •  PLANEJAMENTO DE CASAMENTO', 14, 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(35, 47, 39); doc.text(title, 14, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 98, 91); doc.text(subtitle, 14, 30);
}
function pdfFooter(doc) { const pages = doc.getNumberOfPages(); for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setDrawColor(210, 216, 210); doc.line(14, 198, 283, 198); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110); doc.text(`${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}`, 14, 203); doc.text(`Página ${i} de ${pages}`, 283, 203, { align: 'right' }); } }
function exportCeremonyPdf() {
  const doc = pdfBase('Roteiro completo da cerimônia'); if (!doc) return;
  pdfHeading(doc, 'Roteiro da cerimônia e cortejo', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}  •  Início às ${data.wedding.time || '11:30'}`);
  doc.autoTable({ startY: 36, head: [['Ordem', 'Entrada', 'Participantes', 'Música selecionada', 'Posicionamento / observações']], body: data.ceremony.map((c, i) => [String(i + 1).padStart(2, '0'), c.step, c.participants, [c.music, c.artist].filter(Boolean).join(' — '), c.notes || '—']), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15, overflow: 'linebreak' }, headStyles: { fillColor: [95, 107, 42], textColor: 255, fontStyle: 'bold' }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 45 }, 2: { cellWidth: 52 }, 3: { cellWidth: 62 } } });
  let y = (doc.lastAutoTable?.finalY || 40) + 9; if (y > 160) { doc.addPage(); y = 20; }
  doc.setFillColor(241, 244, 239); doc.roundedRect(14, y, 269, 29, 2, 2, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(48, 69, 54); doc.text('Orientações para os Padrinhos e Auxiliares', 19, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(55); doc.text(['• Evitem levar celular e chaves nos bolsos durante a cerimônia.', '• Caminhem em ritmo tranquilo, mantendo espaço entre os casais.', '• Sigam o posicionamento combinado e cumprimentem os noivos com calma no altar.'], 19, y + 14, { lineHeightFactor: 1.4 });
  pdfFooter(doc); doc.save('roteiro-cerimonia.pdf'); notify('Roteiro da cerimônia exportado em PDF.');
}
function exportCeremonialPdf() {
  const doc = pdfBase('Cronograma da cerimonial'); if (!doc) return;
  pdfHeading(doc, 'Cronograma da cerimonial — Dia do casamento', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(55); doc.text(`Início da cerimônia: ${data.wedding.time || '11:30'}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Horário', 'Atividade', 'Responsável', 'Orientações', 'Status']], body: [...data.ceremonial].sort((a, b) => a.time.localeCompare(b.time)).map(item => [item.time, item.title, item.responsible || 'A definir', item.details || '—', item.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15, overflow: 'linebreak' }, headStyles: { fillColor: [95, 107, 42], textColor: 255, fontStyle: 'bold' }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: 62 }, 2: { cellWidth: 48 }, 4: { cellWidth: 18 } }, didParseCell: cell => { if (cell.section === 'body' && cell.column.index === 4) cell.cell.text = ['']; }, didDrawCell: cell => { if (cell.section === 'body' && cell.column.index === 4) { const size = 4.5, x = cell.cell.x + (cell.cell.width - size) / 2, y = cell.cell.y + (cell.cell.height - size) / 2; doc.setDrawColor(100); doc.setLineWidth(.35); doc.rect(x, y, size, size); if (cell.row.raw[4] === 'Conclu\u00eddo') { doc.setDrawColor(45, 90, 67); doc.setLineWidth(.8); doc.line(x + .8, y + 2.3, x + 1.8, y + 3.2); doc.line(x + 1.8, y + 3.2, x + 3.8, y + 1.1); } } } });
  pdfFooter(doc); doc.save('cronograma-do-casamento.pdf'); notify('Cronograma da cerimonial exportado em PDF.');
}
function exportFinancePdf() {
  const doc = pdfBase('Relatório financeiro e orçamento'); if (!doc) return;
  pdfHeading(doc, 'Relatório financeiro', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45); doc.text(`Com presentes: ${money(planned())}   Sem presentes: ${money(planned() - gifted())}   Presentes: ${money(gifted())}${giftDue() ? ` (faltam ${money(giftDue())})` : ''}   Falta pagar: ${money(due())}   Pago: ${money(spent())}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Categoria', 'Item / fornecedor', 'Valor previsto', 'Valor pago', 'Falta pagar', 'Status']], body: data.expenses.map(e => [e.category, e.supplier ? `${e.description}\n${e.supplier}` : e.description, money(e.planned), money(e.paid), isGift(e) ? (giftDueOf(e) > 0 ? `${money(giftDueOf(e))}
(presente)` : 'Presente') : money(dueOf(e)), e.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 72 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
  pdfFooter(doc); doc.save('relatorio-financeiro.pdf'); notify('Relatório financeiro exportado em PDF.');
}
function exportChecklistPdf() {
  const doc = pdfBase('Checklist e cronograma do dia do casamento'); if (!doc) return;
  pdfHeading(doc, 'Checklist físico para o dia do casamento', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.autoTable({ startY: 36, head: [['', 'Categoria', 'Item', 'Quantidade / observação', 'Status']], body: data.supplies.map(s => ['', s.category, s.name, s.quantity || '', s.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 58 }, 2: { cellWidth: 74 }, 3: { cellWidth: 72 } }, didDrawCell: data => { if (data.section === 'body' && data.column.index === 0) { doc.setDrawColor(90); doc.rect(data.cell.x + 3, data.cell.y + 2.5, 4, 4); } } });
  doc.addPage(); pdfHeading(doc, 'Cronograma e responsáveis', `${data.wedding.couple}  •  Dia da montagem e cerimônia`);
  doc.autoTable({ startY: 36, head: [['Dia', 'Horário', 'Tarefa', 'Responsável', 'Detalhes / andamento']], body: [...data.tasks].sort(byTaskOrder).map(t => [t.date ? shortDate(t.date) : 'Prioridade', t.time || '—', t.title, t.responsible || 'A definir', [t.description, t.status].filter(Boolean).join(' · ')]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 }, rowPageBreak: 'avoid' });
  pdfFooter(doc); doc.save('checklist-e-cronograma.pdf'); notify('Checklist e cronograma exportados em PDF.');
}
function exportTimelinePdf() {
  const doc = pdfBase('Cronograma do casamento'); if (!doc) return;
  pdfHeading(doc, 'Cronograma do casamento', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  const completed = data.tasks.filter(task => task.status === 'Concluído').length;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(55);
  doc.text(`Tarefas: ${data.tasks.length}     Concluídas: ${completed}     Em aberto: ${data.tasks.length - completed}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Dia', 'Horário', 'Tarefa', 'Responsável', 'Detalhes', 'Andamento']], body: [...data.tasks].sort(byTaskOrder).map(task => [task.date ? shortDate(task.date) : 'Prioridade', task.time || '—', task.title, task.responsible || 'A definir', task.description || '—', task.status || 'A Fazer']), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15, overflow: 'linebreak' }, headStyles: { fillColor: [95, 107, 42], textColor: 255, fontStyle: 'bold' }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 19 }, 2: { cellWidth: 55 }, 3: { cellWidth: 42 }, 5: { cellWidth: 27 } } });
  pdfFooter(doc); doc.save('cronograma-casamento.pdf'); notify('Cronograma exportado em PDF.');
}
function bindPageEvents() {
  $('#page-content').querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
    const { action, id } = button.dataset;
    if (action === 'edit-wedding') openModal('Detalhes do casamento', recordForm('wedding'), values => { data.wedding = { ...data.wedding, ...values, guestsExpected: Number(values.guestsExpected || 0), budget: Number(values.budget || 0) }; save('Detalhes do casamento atualizados.'); render(); });
    if (action === 'add-guest' || action === 'edit-guest') addOrEdit('guest', id);
    if (action === 'add-expense' || action === 'edit-expense') addOrEdit('expense', id);
    if (action === 'add-ceremony' || action === 'edit-ceremony') addOrEdit('ceremony', id);
    if (action === 'add-ceremonial' || action === 'edit-ceremonial') addOrEdit('ceremonial', id);
    if (action === 'add-supply' || action === 'edit-supply') addOrEdit('supply', id);
    if (action === 'add-task' || action === 'edit-task') addOrEdit('task', id);
    if (action === 'add-note' || action === 'edit-note') addOrEdit('note', id);
    if (action === 'delete-guest') deleteRecord('guests', id, 'este convite');
    if (action === 'delete-expense') deleteRecord('expenses', id, 'este gasto');
    if (action === 'attach-expense') openAttachments(id);
    if (action === 'attach-task') openAttachments(id, 'tasks');
    if (action === 'attach-vendor') openAttachments(id, 'vendors');
    if (action === 'add-vendor') addOrEdit('vendor', null, id ? { category: id } : {});
    if (action === 'edit-vendor') addOrEdit('vendor', id);
    if (action === 'delete-vendor') deleteRecord('vendors', id, 'este fornecedor');
    if (action === 'contract-vendor') contractVendor(id);
    if (action === 'installments-expense') openInstallments(id);
    if (action === 'import-rsvps') importRsvps();
    if (action === 'export-guests') exportGuestsPdf();
    if (action === 'export-guests-csv') exportGuestsCsv();
    if (action === 'add-table' || action === 'edit-table') addOrEdit('table', id);
    if (action === 'delete-table') { openModal('Excluir mesa?', '<p class="confirm-copy">Os convidados desta mesa voltam para "Sem mesa".</p>', () => { data.tables = data.tables.filter(t => t.id !== id); data.guests.forEach(g => { if (g.tableId === id) g.tableId = ''; }); save('Mesa excluída.'); }); $('#modal-submit').textContent = 'Excluir mesa'; }
    for (const kind of ['contact', 'place', 'planb', 'hmDestination', 'hmBooking', 'hmItinerary']) {
      const coll = { contact: 'emergencyContacts', place: 'places', planb: 'planB', hmDestination: 'hmDestinations', hmBooking: 'hmBookings', hmItinerary: 'hmItinerary' }[kind];
      if (action === `add-${kind}` || action === `edit-${kind}`) addOrEdit(kind, id);
      if (action === `delete-${kind}`) deleteRecord(coll, id, 'este item');
    }
    if (action === 'delete-kit') { data.kit = data.kit.filter(k => k.id !== id); save('Item removido.', false); render(); }
    if (action === 'delete-pack') { data.hmPacking = data.hmPacking.filter(k => k.id !== id); save('Item removido.', false); render(); }
    if (action === 'person-scripts') openScripts();
    if (action === 'add-document' || action === 'edit-document') addOrEdit('document', id);
    if (action === 'delete-document') deleteRecord('documents', id, 'este documento');
    if (action === 'attach-document') openAttachments(id, 'documents');
    if (action === 'add-inspiration' || action === 'edit-inspiration') addOrEdit('inspiration', id);
    if (action === 'delete-inspiration') deleteRecord('inspirations', id, 'este mural');
    if (action === 'attach-inspiration') openAttachments(id, 'inspirations');
    if (action === 'delete-doccheck') { data.docChecklist = data.docChecklist.filter(k => k.id !== id); save('Item removido.', false); render(); }
    if (action === 'export-dayd') exportDayDPdf();
    if (action === 'edit-honeymoon') openModal('Detalhes da viagem', recordForm('honeymoon'), values => { data.honeymoon = { ...data.honeymoon, ...values, budget: Number(values.budget || 0), saved: Number(values.saved || 0) }; save('Viagem atualizada.'); });
    if (action === 'attach-booking') openAttachments(id, 'hmBookings');
    if (action === 'edit-board') openAttachments('sonhos', 'hmBoard');
    if (action === 'generate-checklist') { if (!data.wedding.date) { notify('Defina a data do casamento primeiro.'); return; } const n = addChecklistItems(); timelineView = 'mes'; if (currentPage !== 'cronograma') setPage('cronograma'); else render(); save(n ? `${n} etapas adicionadas ao cronograma.` : 'O checklist já está no cronograma.', false); }
    if (action === 'add-category') addCategory();
    if (action === 'delete-category') { data.customCategories = (data.customCategories || []).filter(c => c !== id); if (expenseFilter === id) expenseFilter = 'Todas'; save('Categoria removida.'); render(); }
    if (action === 'delete-ceremony') deleteRecord('ceremony', id, 'esta etapa');
    if (action === 'delete-ceremonial') deleteRecord('ceremonial', id, 'este horário');
    if (action === 'delete-supply') deleteRecord('supplies', id, 'este item');
    if (action === 'delete-task') deleteRecord('tasks', id, 'esta tarefa');
    if (action === 'delete-note') deleteRecord('notes', id, 'esta anotação');
    if (action === 'print-ceremony') exportCeremonyPdf();
    if (action === 'export-ceremony') exportCeremonyPdf();
    if (action === 'export-ceremonial') exportCeremonialPdf();
    if (action === 'export-finance') exportFinancePdf();
    if (action === 'export-checklist') exportChecklistPdf();
    if (action === 'export-timeline') exportTimelinePdf();
    if (action === 'import-guests') openImport('guests');
    if (action === 'import-expenses') openImport('expenses');
    if (action === 'import-supplies') openImport('supplies');
    if (action === 'import-ceremony') openImport('ceremony');
  }));
  $('#page-content').querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.go)));
  $('#page-content').querySelectorAll('[data-task-done]').forEach(button => button.addEventListener('click', () => { const task = data.tasks.find(t => t.id === button.dataset.taskDone); if (task) { task.status = 'Concluído'; save('Tarefa concluída.', false); render(); } }));
  $('#page-content').querySelectorAll('[data-task-check]').forEach(input => input.addEventListener('change', () => { const task = data.tasks.find(t => t.id === input.dataset.taskCheck); if (task) { task.status = input.checked ? 'Concluído' : 'A Fazer'; animateStatusChange(input, input.checked ? 'Tarefa concluída.' : 'Tarefa reaberta.', input.checked); } }));
  $('#page-content').querySelectorAll('[data-supply-check]').forEach(input => input.addEventListener('change', () => { const item = data.supplies.find(s => s.id === input.dataset.supplyCheck); if (item) { item.status = input.checked ? 'No Local' : 'Pendente'; animateStatusChange(input, input.checked ? 'Item chegou ao local.' : 'Item voltou para pendente.', input.checked); } }));
  $('#page-content').querySelectorAll('[data-task-status]').forEach(select => select.addEventListener('change', () => { const task = data.tasks.find(t => t.id === select.dataset.taskStatus); if (task) { task.status = select.value; animateStatusChange(select, 'Status da tarefa atualizado.', select.value === 'Concluído'); } }));
  $('#page-content').querySelectorAll('[data-supply-status]').forEach(select => select.addEventListener('change', () => { const item = data.supplies.find(s => s.id === select.dataset.supplyStatus); if (item) { item.status = select.value; animateStatusChange(select, 'Checklist atualizado.', select.value === 'No Local'); } }));
  $('#page-content').querySelectorAll('[data-ceremonial-check]').forEach(input => input.addEventListener('change', () => { const item = data.ceremonial.find(s => s.id === input.dataset.ceremonialCheck); if (item) { item.status = input.checked ? 'Conclu\u00eddo' : 'A Fazer'; animateStatusChange(input, input.checked ? 'Item do cronograma concluido.' : 'Item do cronograma reaberto.', input.checked); } }));
  $('#page-content').querySelectorAll('[data-collapse]').forEach(head => head.addEventListener('click', event => { if (event.target.closest('button')) return; head.parentElement.classList.toggle('collapsed'); }));
  $('#guest-filter')?.addEventListener('change', e => { guestFilter = e.target.value; render(); });
  $('#guest-search')?.addEventListener('input', e => { const pos = e.target.selectionStart; guestSearch = e.target.value; render(); const input = $('#guest-search'); input.focus(); input.setSelectionRange(pos, pos); });
  $('#expense-filter')?.addEventListener('change', e => { expenseFilter = e.target.value; render(); });
  $('#wedding-saved')?.addEventListener('change', e => { data.wedding.saved = Math.max(0, Number(e.target.value || 0)); save('Valor guardado atualizado.', false); render(); });
  bindWeekEvents();
  page_bindSmart();
}
function page_bindSmart() {
  const page = $('#page-content');
  if (currentPage === 'convidados') loadSiteRsvps();
  page.querySelectorAll('[data-guest-view]').forEach(b => b.addEventListener('click', () => { guestView = b.dataset.guestView; render(); }));
  $('#guest-status-filter')?.addEventListener('change', e => { guestStatusFilter = e.target.value; render(); });
  page.querySelectorAll('.guest-chip[draggable]').forEach(chip => chip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', chip.dataset.guestId); chip.classList.add('is-dragging'); }));
  page.querySelectorAll('[data-table-drop]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-drop'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-drop'); });
    zone.addEventListener('drop', e => { e.preventDefault(); const guest = data.guests.find(g => g.id === e.dataTransfer.getData('text/plain')); if (!guest) return; guest.tableId = zone.dataset.tableDrop; save(guest.tableId ? `${guest.name} na ${data.tables.find(t => t.id === guest.tableId)?.name}.` : `${guest.name} sem mesa.`, false); render(); });
  });
  // Arrastar as etapas da cerimônia para mudar a ordem: com o mouse pela linha inteira; no celular, pela alça ⋮⋮.
  const ceremonyBody = page.querySelector('.ceremony-table tbody');
  ceremonyBody?.querySelectorAll('tr[data-ceremony-id]').forEach(row => row.addEventListener('pointerdown', e => {
    if (e.button || e.target.closest('button') || (e.pointerType !== 'mouse' && !e.target.closest('.drag-handle'))) return;
    e.preventDefault();
    const rows = [...ceremonyBody.querySelectorAll('tr[data-ceremony-id]')], y0 = e.clientY, clear = () => rows.forEach(r => r.classList.remove('drop-before', 'drop-after'));
    let moved = false, target = null, after = false;
    const move = ev => {
      if (!moved && Math.abs(ev.clientY - y0) < 5) return;
      moved = true; row.classList.add('is-dragging'); clear();
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('tr[data-ceremony-id]');
      target = over && over !== row && ceremonyBody.contains(over) ? over : null;
      if (!target) return;
      const box = target.getBoundingClientRect(); after = ev.clientY > box.top + box.height / 2;
      target.classList.add(after ? 'drop-after' : 'drop-before');
    };
    const end = () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end);
      row.classList.remove('is-dragging'); clear();
      if (!target) return;
      const list = data.ceremony, item = list.splice(list.findIndex(c => c.id === row.dataset.ceremonyId), 1)[0];
      list.splice(list.findIndex(c => c.id === target.dataset.ceremonyId) + (after ? 1 : 0), 0, item);
      save('Ordem da cerimônia atualizada.', false); render();
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  }));
  page.querySelectorAll('[data-vendor-arrival]').forEach(input => input.addEventListener('change', () => { const v = data.vendors.find(x => x.id === input.dataset.vendorArrival); if (v) { v.arrival = input.value; save('Horário de chegada salvo.', false); render(); } }));
  page.querySelectorAll('[data-kit-check]').forEach(input => input.addEventListener('change', () => { const k = data.kit.find(x => x.id === input.dataset.kitCheck); if (k) { k.done = input.checked; save('', false); render(); } }));
  page.querySelectorAll('[data-pack-check]').forEach(input => input.addEventListener('change', () => { const k = data.hmPacking.find(x => x.id === input.dataset.packCheck); if (k) { k.done = input.checked; save('', false); render(); } }));
  $('#kit-add')?.addEventListener('submit', e => { e.preventDefault(); const item = e.target.item.value.trim(); if (!item) return; data.kit.push({ id: uid('k'), item, done: false }); save('Item adicionado ao kit.', false); render(); $('#kit-add input')?.focus(); });
  $('#pack-add')?.addEventListener('submit', e => { e.preventDefault(); const item = e.target.item.value.trim(); if (!item) return; data.hmPacking.push({ id: uid('m'), item, category: e.target.category.value, done: false }); save('Item adicionado.', false); render(); $('#pack-add input')?.focus(); });
  page.querySelectorAll('[data-booking-status]').forEach(select => select.addEventListener('change', () => { const b = data.hmBookings.find(x => x.id === select.dataset.bookingStatus); if (b) { b.status = select.value; save('Reserva atualizada.', false); render(); } }));
  page.querySelectorAll('[data-choose-destination]').forEach(button => button.addEventListener('click', () => { const d = data.hmDestinations.find(x => x.id === button.dataset.chooseDestination); if (d) { data.honeymoon.destination = d.name; if (!data.honeymoon.budget && d.estimate) data.honeymoon.budget = d.estimate; save(`${d.name} escolhido ♡`, false); render(); } }));
  page.querySelectorAll('[data-thumb]').forEach(img => { const [coll, recId, fileId] = img.dataset.thumb.split('|'); const file = (data[coll] || []).find(r => r.id === recId)?.files?.find(f => f.id === fileId); if (file) readAttachment(file).then(url => { img.src = url; }).catch(() => {}); });
  page.querySelectorAll('[data-doccheck]').forEach(input => input.addEventListener('change', () => { const k = data.docChecklist.find(x => x.id === input.dataset.doccheck); if (k) { k.done = input.checked; save('', false); render(); } }));
  $('#doccheck-add')?.addEventListener('submit', e => { e.preventDefault(); const item = e.target.item.value.trim(); if (!item) return; data.docChecklist.push({ id: uid('d'), item, done: false }); save('Documento adicionado.', false); render(); $('#doccheck-add input')?.focus(); });
  page.querySelectorAll('[data-doc-filter]').forEach(b => b.addEventListener('click', () => { docFilter = b.dataset.docFilter; render(); }));
  $('#doc-search')?.addEventListener('input', e => { const pos = e.target.selectionStart; docSearch = e.target.value; render(); const input = $('#doc-search'); input.focus(); input.setSelectionRange(pos, pos); });
  if (currentPage === 'documentos') {
    const list = allDocuments().filter(d => (docFilter === 'Todos' || d.origin === docFilter) && `${d.name} ${d.label}`.toLowerCase().includes(docSearch.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
    page.querySelectorAll('[data-open-doc]').forEach(b => b.addEventListener('click', () => openFile(list[Number(b.dataset.openDoc)].file)));
    page.querySelectorAll('[data-doc-source]').forEach(b => b.addEventListener('click', () => { const d = list[Number(b.dataset.docSource)]; openAttachments(d.record.id, d.coll); }));
  }
  const board = data.hmBoard[0];
  page.querySelectorAll('[data-dream-file]').forEach(span => { const f = board?.files?.find(x => x.id === span.dataset.dreamFile); if (f) readAttachment(f).then(url => { span.querySelector('img').src = url; }).catch(() => {}); });
  page.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { timelineView = b.dataset.view; render(); }));
  page.querySelectorAll('[data-ics]').forEach(b => b.addEventListener('click', () => exportIcs(b.dataset.ics)));
  page.querySelectorAll('[data-ics-share]').forEach(b => b.addEventListener('click', () => exportIcs(b.dataset.icsShare, true)));
  page.querySelectorAll('[data-add-task-for]').forEach(b => b.addEventListener('click', () => addOrEdit('task', null, { responsible: b.dataset.addTaskFor })));
  page.querySelectorAll('[data-add-suggestion]').forEach(b => b.addEventListener('click', () => { addChecklistItems([b.dataset.addSuggestion]); save('Etapa adicionada ao cronograma.', false); render(); }));
  page.querySelectorAll('[data-vendor-status]').forEach(select => select.addEventListener('change', () => {
    const v = data.vendors.find(x => x.id === select.dataset.vendorStatus);
    if (!v) return;
    if (select.value === 'Contratado' && v.status !== 'Contratado') { render(); contractVendor(v.id); return; }
    if (v.status === 'Contratado' && select.value !== 'Contratado' && v.expenseId) notify('O gasto deste fornecedor continua no financeiro.');
    v.status = select.value; save('Status atualizado.', false); render();
  }));
  page.querySelectorAll('[data-vendor-tab]').forEach(b => b.addEventListener('click', () => { vendorTab = b.dataset.vendorTab; render(); }));
  page.querySelectorAll('[data-day-track]').forEach(b => b.addEventListener('click', () => { dayTrack = b.dataset.dayTrack; render(); }));
  // A conversa continua mesmo se a página for trocada no meio da resposta: sempre pinta no #ask-thread atual.
  const paint = () => { const thread = $('#ask-thread'); if (!thread) return; thread.innerHTML = askThreadHtml(); thread.scrollTop = thread.scrollHeight; bindThread(thread); };
  const ask = async question => {
    if (askBusy) { notify('Espere eu terminar de responder ♡'); return; }
    askBusy = true;
    try { await askOnce(question); } finally { askBusy = false; }
  };
  const askOnce = async question => {
    const entry = { question, reply: null }, local = answer(question, data, undefined, askMemory);
    const history = askThread.filter(m => m.reply?.ai && m.reply.done).slice(-10).map(m => ({ question: m.question, text: m.reply.raw }));
    askMemory = local.memory;
    entry.reply = { ai: true, raw: '', done: false, action: local.action?.type === 'import-timeline' ? local.action : null };
    askThread = askThread.slice(-11); askThread.push(entry); paint();
    const i = askThread.length - 1;
    const live = () => {
      const el = $(`#ask-thread [data-ai-reply="${i}"]`);
      if (!el) { paint(); return; }
      el.classList.toggle('is-typing', !parseAI(entry.reply.raw).text);
      el.innerHTML = aiReplyInner(entry.reply, i); bindThread(el);
      el.parentElement.scrollTop = el.parentElement.scrollHeight;
    };
    const slow = setTimeout(() => { entry.reply.slow = true; if (!entry.reply.raw) live(); }, 5000);
    try {
      await askAI(history, question, data, raw => { entry.reply.raw = raw; live(); });
      entry.reply.done = true; live();
    } catch (error) {
      console.warn('Cerimonialista com IA indisponível; usando a resposta local.', error);
      if (!aiWarned) { aiWarned = true; notify('A IA está indisponível agora. Respondi com a versão básica da cerimonialista.'); }
      entry.reply = local; paint();
    } finally { clearTimeout(slow); }
  };
  const bindThread = thread => {
    thread.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => ask(b.dataset.ask)));
    thread.querySelectorAll('[data-ask-go]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.askGo)));
    thread.querySelectorAll('[data-ask-action]').forEach(b => b.addEventListener('click', () => askAction(askThread[Number(b.dataset.askAction)]?.reply?.action, b)));
  };
  const thread = $('#ask-thread');
  if (thread) { bindThread(thread); thread.scrollTop = thread.scrollHeight; }
  page.querySelector('[data-ask-clear]')?.addEventListener('click', () => { askThread = []; askMemory = {}; render(); });
  // Caixa da pergunta cresce para baixo conforme o texto; Enter envia e Shift+Enter quebra a linha.
  // A barra de rolagem só aparece quando o texto passa da altura máxima (160px no CSS).
  const askBox = $('#ask-form textarea'), fitAskBox = () => { askBox.style.height = 'auto'; askBox.style.height = `${askBox.scrollHeight + askBox.offsetHeight - askBox.clientHeight}px`; askBox.style.overflowY = askBox.scrollHeight > 160 ? 'auto' : 'hidden'; };
  askBox?.addEventListener('input', fitAskBox);
  askBox?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); askBox.form.requestSubmit(); } });
  $('#ask-form')?.addEventListener('submit', e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) { e.target.q.value = ''; fitAskBox(); ask(q); } });
}
function bindWeekEvents() {
  const page = $('#page-content');
  page.querySelectorAll('[data-add-month]').forEach(b => b.addEventListener('click', () => { const m = b.dataset.addMonth; addOrEdit('task', null, { date: !m ? '' : m === todayIso().slice(0, 7) ? todayIso() : `${m}-01` }); }));
  page.querySelectorAll('[data-drop-month]').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('is-drop'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('is-drop'); });
    col.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation(); col.classList.remove('is-drop');
      const task = data.tasks.find(t => t.id === e.dataTransfer.getData('text/plain')), month = col.dataset.dropMonth;
      if (!task) return;
      if (!month) task.date = '';
      else {
        const day = Number((task.date || todayIso()).slice(8, 10)), lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
        task.date = `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
        if (task.date < todayIso()) task.date = todayIso();
      }
      save(task.date ? `Prazo movido para ${shortDate(task.date)}.` : 'Tarefa movida para Sem data.', false); render();
    });
  });
  const goWeek = value => { weekStart = value === 'today' ? weekOf(todayIso()) : value === 'wedding' ? weekOf(data.wedding.date) : addDays(weekStart, 7 * Number(value)); animateNextRender = false; render(); };
  page.querySelectorAll('[data-week]').forEach(b => b.addEventListener('click', () => goWeek(b.dataset.week)));
  page.querySelectorAll('[data-add-task]').forEach(b => b.addEventListener('click', () => addOrEdit('task', null, { date: b.dataset.addTask })));
  page.querySelectorAll('[data-task-toggle]').forEach(input => input.addEventListener('change', () => { const task = data.tasks.find(t => t.id === input.dataset.taskToggle); if (task) { task.status = input.checked ? 'Concluído' : 'A Fazer'; save(input.checked ? 'Tarefa concluída.' : 'Tarefa reaberta.', false); render(); } }));
  $('#priority-add')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target, title = form.title.value.trim();
    if (!title) return;
    data.tasks.push({ id: uid('t'), title, date: '', time: '', priority: form.priority.value, status: 'A Fazer', responsible: '', responsiblePhone: '', description: '' });
    save('Prioridade adicionada.', false); render(); $('#priority-add input')?.focus();
  });
  // Arrastar tarefas entre os dias (ou para Prioridades, que tira a data).
  page.querySelectorAll('.task-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.taskId); e.dataTransfer.effectAllowed = 'move'; card.classList.add('is-dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
  });
  page.querySelectorAll('[data-drop-date]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-over'); });
    zone.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation(); zone.classList.remove('is-over');
      const task = data.tasks.find(t => t.id === e.dataTransfer.getData('text/plain'));
      if (!task || task.date === zone.dataset.dropDate) return;
      task.date = zone.dataset.dropDate;
      save(task.date ? `Tarefa movida para ${shortDate(task.date)}.` : 'Tarefa movida para Prioridades.', false); render();
    });
  });
  // No celular, deslizar o calendário para o lado troca de semana.
  const grid = $('#week-grid');
  if (grid) {
    let x0 = 0, y0 = 0;
    grid.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    grid.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 70 && Math.abs(dy) < 50) goWeek(dx < 0 ? 1 : -1); }, { passive: true });
  }
}

document.querySelectorAll('.nav-item[data-page]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)));
$('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#quick-add').addEventListener('click', () => addOrEdit('task'));
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  $('#sidebar-toggle').setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
  $('#sidebar-toggle .nav-text').textContent = collapsed ? 'Expandir' : 'Recolher';
  try { localStorage.setItem('entre-nos-sidebar', collapsed ? 'collapsed' : 'open'); } catch {}
}
$('#sidebar-toggle').addEventListener('click', () => setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));
try { if (localStorage.getItem('entre-nos-sidebar') === 'collapsed') setSidebarCollapsed(true); } catch {}

const guideSteps = [
  { title: 'Bem-vindos ao Entre Nós ♡', text: 'Este é o espaço de vocês para organizar o casamento. Em poucos passos mostramos onde fica cada coisa. Tudo o que vocês fizerem é salvo automaticamente na conta.' },
  { page: 'inicio', target: '.event-card', title: 'O grande dia', text: 'Aqui ficam o casal, o local, a data e a contagem regressiva. Use "Editar detalhes" para mudar data, horário ou local.' },
  { page: 'assistente', target: '.nav-item[data-page="assistente"]', title: 'Cerimonialista virtual', text: 'Converse do seu jeito sobre fornecedores, contrato, cronograma do dia e o que mais precisar. Ao lado ficam os avisos do que precisa de atenção agora; o número no menu mostra os urgentes.' },
  { page: 'inicio', target: '.notice-card', title: 'Próximo passo', text: 'Mostra a próxima tarefa pendente do cronograma. Terminou? Clique em "Marcar como feita" e o painel já mostra a seguinte.' },
  { page: 'inicio', target: '.stats-grid', title: 'Resumo em números', text: 'Convidados confirmados, quanto já foi pago, o saldo, as tarefas e os itens no local. Clique em qualquer card para abrir a página correspondente.' },
  { page: 'cronograma', target: '.nav-item[data-page="cronograma"]', title: 'Cronograma', text: 'Um calendário semanal: avance ou volte as semanas, arraste as tarefas entre os dias e use Prioridades para o que ainda não tem data. Em "Por pessoa" ficam as tarefas de cada um com o prazo, e o botão "Na agenda" coloca os lembretes no celular.' },
  { page: 'checklist', target: '.nav-item[data-page="checklist"]', title: 'O que levar', text: 'A lista do que precisa chegar ao local, por categoria. Acompanhe cada item como Pendente, Comprado, No carro ou No local, e marque "No local" quando ele chegar.' },
  { page: 'anotacoes', target: '.nav-item[data-page="anotacoes"]', title: 'Anotações', text: 'Guarde ideias, links e lembretes. O editor aceita negrito, itálico, listas e links.' },
  { page: 'convidados', target: '.nav-item[data-page="convidados"]', title: 'Convidados', text: 'Cadastre cada convidado com grupo, telefone, acompanhantes e status do convite. Busque por nome, filtre por grupo ou importe uma lista pronta em TXT.' },
  { page: 'cerimonia', target: '.nav-item[data-page="cerimonia"]', title: 'Cerimônia & músicas', text: 'Monte a ordem de entrada do cortejo com participantes, músicas e orientações. Exporte o roteiro em PDF para os padrinhos.' },
  { page: 'cerimonial', target: '.nav-item[data-page="cerimonial"]', title: 'Cerimonial do casamento', text: 'O passo a passo do dia, com horários e responsáveis. Marque cada horário como concluído e exporte em PDF para a equipe.' },
  { page: 'inspiracoes', target: '.nav-item[data-page="inspiracoes"]', title: 'Inspirações', text: 'Murais com fotos, links e paleta de cores para decoração, vestido, buquê, bolo e o que mais quiserem, prontos para mostrar aos fornecedores.' },
  { page: 'documentos', target: '.nav-item[data-page="documentos"]', title: 'Documentos', text: 'Todos os contratos, comprovantes e documentos num lugar só, com a lista dos documentos essenciais do casamento. Os arquivos anexados nos gastos, fornecedores e tarefas também aparecem aqui.' },
  { page: 'diad', target: '.nav-item[data-page="diad"]', title: 'Dia do casamento', text: 'O roteiro do grande dia com o cerimonial e a chegada dos fornecedores, contatos de emergência, endereços, plano B e kit de emergência. Em "Roteiro por pessoa", cada um recebe só o que é dele pelo WhatsApp ou em PDF.' },
  { page: 'luademel', target: '.nav-item[data-page="luademel"]', title: 'Lua de mel', text: 'Destinos, comparação de hotéis e passagens, reservas, roteiro por dia, malas e quanto falta economizar, com o orçamento separado do casamento.' },
  { page: 'fornecedores', target: '.nav-item[data-page="fornecedores"]', title: 'Fornecedores', text: 'Cadastre cada orçamento com preço, descontos, taxas, o que está incluído e as condições. Compare as opções lado a lado e toque em Contratar: o valor e as parcelas entram no financeiro sozinhos.' },
  { page: 'financeiro', target: '.nav-item[data-page="financeiro"]', title: 'Financeiro', text: 'Registre os gastos por categoria, com valor previsto, valor pago e forma de pagamento. Clique numa categoria para abrir ou recolher. Também dá para importar TXT e exportar PDF.' },
  { target: '#quick-add', title: 'Nova tarefa', text: 'Atalho para criar uma tarefa no cronograma a partir de qualquer página.' },
  { target: '#edit-wedding', title: 'Detalhes do casamento', text: 'Altere os nomes do casal, a data, o horário e o local. A contagem regressiva se atualiza na hora.' },
  { page: 'inicio', target: '#guide-button', title: 'Sempre que precisar', text: 'O guia fica guardado neste botão para vocês reverem quando quiserem. Bom planejamento ♡' },
];
let guideIndex = 0, guideTimer;
const guideKey = () => `entre-nos-guia-visto-${activeUser?.uid || 'local'}`;
function guideSeen() { try { return localStorage.getItem(guideKey()) === 'sim'; } catch { return false; } }
function startGuide() {
  guideIndex = 0; $('#guide').hidden = false;
  $('#guide-dots').innerHTML = guideSteps.map(() => '<span></span>').join('');
  raiseInteractiveCursor(); showGuideStep();
}
function closeGuide() {
  $('#guide').hidden = true; $('#sidebar').classList.remove('open'); clearTimeout(guideTimer);
  try { localStorage.setItem(guideKey(), 'sim'); } catch {}
}
function showGuideStep() {
  const step = guideSteps[guideIndex], last = guideIndex === guideSteps.length - 1;
  if (step.page && step.page !== currentPage) setPage(step.page);
  const target = step.target && $(step.target);
  $('#sidebar').classList.toggle('open', Boolean(target?.closest('#sidebar')) && window.innerWidth <= 760);
  $('#guide-step').textContent = `GUIA · ${guideIndex + 1} DE ${guideSteps.length}`;
  $('#guide-title').textContent = step.title; $('#guide-text').textContent = step.text;
  $('#guide-prev').hidden = guideIndex === 0;
  $('#guide-next').textContent = last ? 'Concluir' : guideIndex === 0 ? 'Começar' : 'Próximo';
  $('#guide-skip').hidden = last;
  $('#guide-dots').querySelectorAll('span').forEach((dot, i) => { dot.classList.toggle('active', i === guideIndex); dot.classList.toggle('done', i < guideIndex); });
  const card = $('#guide-card'); card.classList.remove('guide-pop'); void card.offsetWidth; card.classList.add('guide-pop');
  if (target && !target.closest('#sidebar, .topbar')) target.scrollIntoView({ block: 'center' });
  placeGuide(); requestAnimationFrame(placeGuide);
  clearTimeout(guideTimer); guideTimer = setTimeout(placeGuide, 450);
  $('#guide-next').focus();
}
function placeGuide() {
  if ($('#guide').hidden) return;
  const step = guideSteps[guideIndex], target = step.target && $(step.target), spot = $('#guide-spot'), card = $('#guide-card');
  $('#guide').classList.toggle('is-center', !target);
  const vw = window.innerWidth, vh = window.innerHeight, gap = 16, pad = 6, cw = card.offsetWidth, ch = card.offsetHeight;
  const clamp = (value, max) => Math.max(12, Math.min(value, max - 12));
  if (!target) {
    Object.assign(spot.style, { top: `${vh / 2}px`, left: `${vw / 2}px`, width: '0px', height: '0px' });
    Object.assign(card.style, { top: `${(vh - ch) / 2}px`, left: `${(vw - cw) / 2}px` });
    return;
  }
  const r = target.getBoundingClientRect();
  Object.assign(spot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  let top, left;
  if (vw <= 760) { left = (vw - cw) / 2; top = r.bottom + gap + ch < vh ? r.bottom + gap : r.top - gap - ch > 0 ? r.top - gap - ch : vh - ch - 12; }
  else if (r.right + gap + cw < vw - 12 && r.width < vw / 2) { left = r.right + gap; top = r.top + r.height / 2 - ch / 2; }
  else if (r.bottom + gap + ch < vh - 12) { top = r.bottom + gap; left = r.left + r.width - cw; }
  else { top = r.top - gap - ch; left = r.left + r.width - cw; }
  Object.assign(card.style, { top: `${clamp(top, vh - ch)}px`, left: `${clamp(left, vw - cw)}px` });
}
$('#guide-button').addEventListener('click', startGuide);
$('#guide-next').addEventListener('click', () => { if (guideIndex === guideSteps.length - 1) { closeGuide(); notify('Guia concluído. Ele fica no botão "Guia".'); } else { guideIndex++; showGuideStep(); } });
$('#guide-prev').addEventListener('click', () => { if (guideIndex > 0) { guideIndex--; showGuideStep(); } });
$('#guide-skip').addEventListener('click', () => { closeGuide(); notify('Você pode rever o guia no botão "Guia".'); });
window.addEventListener('resize', placeGuide);
document.addEventListener('keydown', event => {
  if ($('#guide').hidden) return;
  if (event.key === 'Escape') closeGuide();
  if (event.key === 'ArrowRight') $('#guide-next').click();
  if (event.key === 'ArrowLeft' && guideIndex > 0) $('#guide-prev').click();
});
$('#edit-wedding').addEventListener('click', () => openModal('Detalhes do casamento', recordForm('wedding'), values => { data.wedding = { ...data.wedding, ...values, guestsExpected: Number(values.guestsExpected || 0), budget: Number(values.budget || 0) }; save('Detalhes do casamento atualizados.'); render(); }));
$('#modal-close').addEventListener('click', () => $('#modal').close());
$('#modal-cancel').addEventListener('click', () => $('#modal').close());
$('#import-close').addEventListener('click', () => $('#import-dialog').close());
$('#import-cancel').addEventListener('click', () => $('#import-dialog').close());
$('#import-confirm').addEventListener('click', confirmImport);
function initInteractiveCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const dot = $('#cursor-dot'), ring = $('#cursor-ring');
  if (typeof dot.showPopover === 'function') dot.showPopover();
  let mouseX = -80, mouseY = -80, ringX = -80, ringY = -80;
  const interactive = 'button, a, input, select, textarea, label, [data-action], [data-go], [data-collapse]';
  document.addEventListener('pointermove', event => {
    mouseX = event.clientX; mouseY = event.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });
  document.addEventListener('pointerover', event => document.body.classList.toggle('cursor-over', Boolean(event.target.closest(interactive))));
  document.addEventListener('pointerdown', () => document.body.classList.add('cursor-press'));
  document.addEventListener('pointerup', () => document.body.classList.remove('cursor-press'));
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '1'; });
  const follow = () => { ringX += (mouseX - ringX) * .18; ringY += (mouseY - ringY) * .18; ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`; requestAnimationFrame(follow); };
  follow();
}
initInteractiveCursor();
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#auth-submit');
  button.disabled = true;
  $('#auth-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, loginToEmail($('#auth-email').value), $('#auth-password').value);
  } catch (error) {
    const messages = {
      'auth/invalid-credential': 'Usuário ou senha incorretos.',
      'auth/invalid-email': 'Confira o usuário digitado.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
      'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente novamente.',
    };
    $('#auth-error').textContent = messages[error.code] || 'Não foi possível entrar. Tente novamente.';
  } finally { button.disabled = false; }
});
$('#sign-out')?.addEventListener('click', () => signOut(auth));
function showAccessMessage(message) {
  $('#app-shell').hidden = true;
  $('#auth-panel').hidden = false;
  $('#auth-error').innerHTML = `${esc(message)} <a href="cliente.html">Ir para minha área</a>`;
}
onAuthStateChanged(auth, async user => {
  if (stopRealtime) { stopRealtime(); stopRealtime = null; }
  activeUser = user;
  if (!user) {
    $('#app-shell').hidden = true;
    $('#auth-panel').hidden = false;
    return;
  }
  plannerId = user.uid;
  let plannerRef = doc(db, 'planners', plannerId);
  try {
    let site = null;
    if (!isAdmin(user)) {
      const account = (await getDoc(doc(db, 'accounts', user.uid))).data();
      // Contas antigas, criadas antes da plataforma, não têm cadastro em accounts e continuam abrindo o planejamento.
      if (account) {
        if (!account.products?.organizador) return showAccessMessage('Seu acesso não inclui o Organizador de casamento.');
        if (account.status !== 'pago') return showAccessMessage('O organizador será liberado assim que o pagamento for confirmado.');
        document.body.dataset.theme = `m${account.products.organizador}`;
        if (account.slug) site = (await getDoc(doc(db, 'sites', account.slug))).data() || null;
        plannerSlug = account.slug || '';
        if (account.plannerUid) { plannerId = account.plannerUid; plannerRef = doc(db, 'planners', plannerId); }
      }
    }
    $('#auth-panel').hidden = true;
    $('#app-shell').hidden = false;
    $('#user-avatar').title = user.email || 'Sua conta';
    const saved = await getDoc(plannerRef);
    if (saved.exists()) data = normalizeData(saved.data().data);
    else {
      if (isAdmin(user)) data = loadData();
      else data = { wedding: { couple: site?.couple || '', date: site?.casamento?.date || '', time: site?.casamento?.time || '', venue: site?.casamento?.venue || '' }, guests: [], expenses: [], ceremony: [], ceremonial: [], supplies: [], tasks: [], notes: [] };
      await setDoc(plannerRef, { data, updatedAt: serverTimestamp() });
      localStorage.removeItem(STORAGE_KEY);
    }
    render();
    updateProgress();
    if (!guideSeen()) setTimeout(startGuide, 500);
    stopRealtime = onSnapshot(plannerRef, snapshot => {
      if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;
      data = normalizeData(snapshot.data().data);
      render();
      updateProgress();
    }, error => {
      console.error('Falha ao sincronizar com o Firestore:', error);
      notify('Falha ao sincronizar. Confira as regras do Firestore.');
    });
  } catch (error) {
    console.error('Falha ao carregar o planejamento:', error);
    $('#app-shell').hidden = true;
    $('#auth-panel').hidden = false;
    $('#auth-error').textContent = 'Não foi possível abrir o planejamento. Confira se o Firestore está criado e as regras foram publicadas.';
  }
});
function normalizeData(saved = {}) {
  const result = Object.fromEntries(Object.entries(defaultData).map(([key, value]) => [
    key,
    key === 'wedding' ? { ...structuredClone(value), ...(saved.wedding || {}) } : saved[key] ?? structuredClone(value),
  ]));
  result.expenses = result.expenses.map(e => (renamedCategories[e.category] ? { ...e, category: renamedCategories[e.category] } : e));
  const wedding = result.wedding.date;
  result.tasks = result.tasks.map(({ day, ...task }) => (task.date !== undefined || day === undefined ? task : { ...task, date: wedding && legacyDayOffsets[day] !== undefined ? addDays(wedding, legacyDayOffsets[day]) : '' }));
  return result;
}
setInterval(updateCountdown, 1000);
