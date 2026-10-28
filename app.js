import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db, isAdmin, loginToEmail } from './lib/firebase.js';

let activeUser = null;
let stopRealtime = null;
let saveQueue = Promise.resolve();
const STORAGE_KEY = 'entre-nos-casamento-v1';
const navLabels = { inicio: 'Visão geral', convidados: 'Convidados', financeiro: 'Financeiro', cerimonia: 'Cerimônia & músicas', cerimonial: 'Cerimonial do dia D', checklist: 'O que levar', cronograma: 'Cronograma', anotacoes: 'Anotações' };
const expenseCategories = ['Comidas & Buffet', 'Decoração & Cenografia', 'Local / Espaço / Sítio', 'Trajes & Beleza', 'Audiovisual', 'Banda & DJ', 'Outros'];
const renamedCategories = { 'Itens Avulsos & Lembrancinhas': 'Outros' };
const guestGroups = ['Família Noiva', 'Família Noivo', 'Padrinhos', 'Amigos'];
const expenseStatuses = ['Pendente', 'Pago Pix', 'Cartão', 'Boleto', 'Presente Ganho'];
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
  wedding: { couple: 'Marina & Rafael', date: '2026-11-14', time: '11:30', venue: 'Sítio das Oliveiras' },
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
let expenseFilter = 'Todas';
let weekStart = weekOf(todayIso());
let toastTimer;
let animateNextRender = true;
const $ = (s, root = document) => root.querySelector(s);
const icons = {
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
  const plannerRef = doc(db, 'planners', activeUser.uid);
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
  content.innerHTML = ({ inicio: renderDashboard, convidados: renderGuests, financeiro: renderFinance, cerimonia: renderCeremony, cerimonial: renderCeremonial, checklist: renderChecklist, cronograma: renderTimeline, anotacoes: renderNotes })[currentPage]();
  content.classList.toggle('page-enter', animateNextRender);
  if (animateNextRender) setTimeout(() => content.classList.remove('page-enter'), 900);
  animateNextRender = false;
  content.querySelectorAll('table').forEach(table => {
    const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => row.querySelectorAll('td').forEach((cell, index) => {
      if (!cell.hasAttribute('colspan') && labels[index] !== undefined) cell.dataset.label = labels[index];
    }));
  });
  bindPageEvents(); updateProgress();
}
function heading(kicker, title, desc, action = '') { return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${action}</div></div>`; }
function renderDashboard() {
  const countdown = countdownState();
  const pending = data.tasks.filter(t => t.status !== 'Concluído').sort(byTaskOrder), next = pending[0], tasks = pending.slice(0, 5);
  const doneTasks = data.tasks.length - pending.length, paidRatio = planned() ? Math.min(100, Math.round((planned() - due()) / planned() * 100)) : 0, onSite = data.supplies.filter(s => s.status === 'No Local').length;
  const groups = allExpenseCategories().map(c => { const sum = data.expenses.filter(e => e.category === c).reduce((a, e) => a + Number(e.planned || 0), 0); return { c, sum }; }).filter(x => x.sum).sort((a, b) => b.sum - a.sum);
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const stat = (page, iconName, label, value, foot) => `<button class="card stat-card" data-go="${page}"><div class="stat-top"><span class="stat-icon">${icon(iconName)}</span><span>${label}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></button>`;
  return `${heading('PAINEL DO CASAMENTO', 'Visão geral.', today, '<button class="button button-pill" data-go="convidados">Convidados</button><button class="button button-pill" data-go="financeiro">Financeiro</button><button class="button button-pill" data-action="edit-wedding">Detalhes do casamento</button>')}
  <section class="card event-card"><span class="event-icon">${icon('heart')}</span><div class="event-info"><div class="event-title"><h2>${esc(data.wedding.couple || 'Nosso casamento')}</h2><span class="status-pill ${countdown.complete ? 'is-done' : ''}"><i></i>${countdown.unknown ? 'Data a definir' : countdown.complete ? 'Casamento realizado' : countdown.days === 0 ? 'É hoje!' : `Faltam ${countdown.days} ${countdown.days === 1 ? 'dia' : 'dias'}`}</span></div><p>${[esc(data.wedding.venue || 'Local a definir'), dateLabel(data.wedding.date), esc(data.wedding.time || '')].filter(Boolean).join(' · ')}</p><div class="week-chips">${Array.from({ length: 7 }, (_, i) => addDays(weekOf(todayIso()), i)).map(day => { const list = data.tasks.filter(t => t.date === day), done = list.filter(t => t.status === 'Concluído').length; return `<span class="week-chip ${list.length && done === list.length ? 'is-done' : ''} ${day === todayIso() ? 'is-current' : ''}" title="${esc(shortDate(day))}: ${done} de ${list.length} tarefas">${esc(fromIso(day).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''))} <small>${done}/${list.length}</small></span>`; }).join('')}</div></div>
  <div class="countdown ${countdown.complete || countdown.unknown ? 'countdown-complete' : ''}" id="live-countdown" aria-label="Contagem regressiva">${countdown.unknown ? '<strong>Quando é o grande dia?</strong><span>Defina a data em "Editar detalhes"</span>' : countdown.complete ? '<strong>O grande dia já aconteceu ♡</strong><span>Atualize a data nos detalhes</span>' : `<div class="count-unit"><strong data-count="days">${countdown.days}</strong><span>dias</span></div><div class="count-unit"><strong data-count="hours">${String(countdown.hours).padStart(2, '0')}</strong><span>horas</span></div><div class="count-unit"><strong data-count="minutes">${String(countdown.minutes).padStart(2, '0')}</strong><span>min</span></div><div class="count-unit"><strong data-count="seconds">${String(countdown.seconds).padStart(2, '0')}</strong><span>seg</span></div>`}</div>
  <div class="event-actions"><button class="button button-primary" data-go="cronograma">${icon('calendar')} Ver cronograma</button><button class="button button-secondary" data-action="edit-wedding">${icon('settings')} Editar detalhes</button></div></section>
  <section class="notice-card"><div><strong>${next ? 'Próximo passo' : data.tasks.length ? 'Tudo em dia' : 'Vamos começar?'}</strong><p>${next ? `${esc(next.title)} · ${esc(next.date ? shortDate(next.date) : 'Prioridade')}${next.time ? `, ${esc(next.time)}` : ''}` : data.tasks.length ? 'Todas as tarefas do cronograma foram concluídas. Agora é só aproveitar.' : 'Seu organizador está novinho. Adicione a primeira tarefa do cronograma ou cadastre os convidados.'}</p></div>${next ? `<button class="button button-secondary" data-task-done="${next.id}">Marcar como feita</button>` : data.tasks.length ? '' : `<button class="button button-secondary" data-action="add-task">${icon('plus')} Adicionar tarefa</button>`}</section>
  <section class="stats-grid">${stat('convidados', 'users', 'Confirmados', confirmedGuests(), `de ${totalGuests()} pessoas na lista`)}${stat('financeiro', 'wallet', 'Total pago', money(spent()), `de ${money(planned())} orçados`)}${stat('financeiro', 'clock', 'Saldo a pagar', money(due()), `${paidRatio}% já quitado ou ganho`)}${stat('cronograma', 'check', 'Tarefas', `${doneTasks}/${data.tasks.length}`, `${progress()}% do cronograma`)}${stat('checklist', 'box', 'Itens no local', `${onSite}/${data.supplies.length}`, 'do checklist do que levar')}</section>
  <section class="dashboard-grid"><article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Visão do orçamento</h2><p class="panel-subtitle">Quanto já foi pago e para onde vai o dinheiro</p></div><button class="text-button" data-go="financeiro">Ver detalhes →</button></div><div class="budget-total">${money(spent())}</div><div class="budget-meta"><span>do total de ${money(planned())}</span><span>${paidRatio}% pago</span></div><div class="progress-track"><span style="width:${paidRatio}%"></span></div><div class="legend-row"><span><i class="legend-dot"></i>Valor pago</span><span><i class="legend-dot soft"></i>Restante</span></div><div class="category-list" style="margin-top:22px">${groups.length ? groups.map(x => `<div class="category-row"><span class="category-name">${esc(x.c)}</span><span class="category-value">${money(x.sum)}</span><div class="mini-track"><span style="width:${Math.max(3, Math.round(x.sum / planned() * 100))}%"></span></div></div>`).join('') : empty('Adicione seus primeiros gastos.')}</div></article>
  <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Próximas tarefas</h2><p class="panel-subtitle">${pending.length} ${pending.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}</p></div><button class="text-button" data-go="cronograma">Ver cronograma →</button></div><div class="task-list">${tasks.length ? tasks.map(t => `<label class="task-row"><input class="task-check" type="checkbox" data-task-check="${t.id}"><span class="task-text">${esc(t.title)}</span><span class="task-meta">${esc(t.date ? shortDate(t.date) : 'Prioridade')}${t.time ? ` · ${esc(t.time)}` : ''}</span></label>`).join('') : empty(data.tasks.length ? 'Tudo por aqui concluído!' : 'Nenhuma tarefa ainda.')}</div></article></section>`;
}
function renderGuests() {
  const visible = data.guests.filter(g => (guestFilter === 'Todos' || g.group === guestFilter) && `${g.name} ${g.phone}`.toLowerCase().includes(guestSearch.toLowerCase()));
  const confirmed = confirmedGuests(), invited = data.guests.filter(g => g.status === 'Enviado').length;
  return `${heading('LISTA DE CONVIDADOS', 'Convidados.', 'Acompanhe os convites e tenha a lista na ponta dos dedos.', '<button class="button button-secondary" data-action="import-guests"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 20h14"/></svg>Importar TXT</button><button class="button button-primary" data-action="add-guest"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar convidado</button>')}
  <div class="summary-row"><span class="summary-chip">Pessoas na lista <strong>${totalGuests()}</strong></span><span class="summary-chip">Confirmadas <strong>${confirmed}</strong></span><span class="summary-chip">Convites enviados <strong>${invited}</strong></span></div>
  <div class="toolbar"><label class="search-box"><span class="search-mark">${icon('search')}</span><input id="guest-search" type="search" placeholder="Buscar por nome ou telefone" value="${esc(guestSearch)}"></label><select id="guest-filter" class="filter-select"><option>Todos</option>${guestGroups.map(g => `<option ${guestFilter === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
  <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Convidado</th><th>Grupo</th><th>Telefone / WhatsApp</th><th>Convite</th><th>Acompanhantes</th><th></th></tr></thead><tbody>${visible.length ? visible.map(g => `<tr><td><div class="person-cell"><span class="person-avatar">${esc(g.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase())}</span><span><span class="person-name">${esc(g.name)}</span><span class="person-sub">${Number(g.children) ? `${g.children} criança(s)` : 'Convidado(a)'}</span></span></div></td><td>${esc(g.group)}</td><td>${esc(g.phone || '—')}</td><td>${badge(g.status)}</td><td>${Number(g.companions || 0)} adulto(s) · ${Number(g.children || 0)} criança(s)</td><td><div class="row-actions"><button data-action="edit-guest" data-id="${g.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-guest" data-id="${g.id}" aria-label="Excluir">${icon('trash')}</button></div></td></tr>`).join('') : `<tr><td colspan="6">${empty('Nenhum convidado encontrado.')}</td></tr>`}</tbody></table></div><div class="table-footer">Exibindo <strong>${visible.length}</strong> de <strong>${data.guests.length}</strong> convidados · Pessoas confirmadas com acompanhantes: <strong>${confirmed}</strong></div></section>`;
}
function renderFinance() {
  const allCategories = allExpenseCategories();
  const categories = expenseFilter === 'Todas' ? allCategories : [expenseFilter];
  const suppliers = [...new Set(data.expenses.map(e => (e.supplier || '').trim()).filter(Boolean))].map(name => { const rows = data.expenses.filter(e => (e.supplier || '').trim() === name); return { name, rows, planned: rows.reduce((a, e) => a + Number(e.planned || 0), 0), due: rows.reduce((a, e) => a + dueOf(e), 0) }; }).sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
  const dueCell = e => (isGift(e) ? '<span class="due-gift">Presente</span>' : dueOf(e) > 0 ? `<span class="due-value">${money(dueOf(e))}</span>` : '<span class="due-done">Quitado</span>');
  const totals = rows => { const paid = rows.reduce((a, e) => a + (isGift(e) ? 0 : Number(e.paid || 0)), 0), gift = rows.filter(isGift).reduce((a, e) => a + Number(e.planned || 0), 0), left = rows.reduce((a, e) => a + dueOf(e), 0); return `<div class="category-totals"><span class="category-total">${money(paid)} pagos</span>${gift > 0 ? `<span class="category-total category-gift">${money(gift)} em presentes</span>` : ''}${left > 0 ? `<span class="category-total category-due">${money(left)} faltam</span>` : ''}</div>`; };
  const row = e => { const files = (e.files || []).length + (e.links || []).length; return `<tr><td><span class="person-name">${esc(e.description)}</span>${e.supplier ? `<span class="person-sub">Fornecedor: ${esc(e.supplier)}</span>` : ''}${e.notes ? `<span class="person-sub">${esc(e.notes)}</span>` : ''}</td><td>${money(e.planned)}</td><td>${money(e.paid)}</td><td>${dueCell(e)}</td><td>${badge(e.status, e.status.startsWith('Pago') || isGift(e) ? 'pago' : 'pendente')}</td><td><div class="row-actions"><button class="attach-button" data-action="attach-expense" data-id="${e.id}" aria-label="Anexos (${files})" title="Fotos, PDFs, contratos e links">${icon('clip')}${files ? `<span class="attach-count">${files}</span>` : ''}</button><button data-action="edit-expense" data-id="${e.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-expense" data-id="${e.id}" aria-label="Excluir">${icon('trash')}</button></div></td></tr>`; };
  return `${heading('ORÇAMENTO', 'Financeiro.', 'Organize os valores com clareza, sem perder a leveza.', '<button class="button button-secondary" data-action="export-finance"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar PDF</button><button class="button button-secondary" data-action="import-expenses"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 20h14"/></svg>Importar TXT</button><button class="button button-primary" data-action="add-expense"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar gasto</button>')}
  <section class="budget-overview"><article class="card budget-box"><span>Total orçado</span><strong>${money(planned())}</strong><small>Todos os itens, inclusive presentes</small></article><article class="card budget-box"><span>Total pago</span><strong>${money(spent())}</strong><small>Valores já quitados</small></article><article class="card budget-box"><span>Presentes ganhos</span><strong>${money(gifted())}</strong><small>Não entram no saldo a pagar</small></article><article class="card budget-box budget-due"><span>Saldo a pagar</span><strong>${money(due())}</strong><small>${due() ? 'Ainda falta pagar' : 'Tudo quitado ♡'}</small></article></section>
  ${suppliers.length ? `<section class="card panel supplier-panel"><div class="panel-head"><div><h2 class="panel-title">Por fornecedor</h2><p class="panel-subtitle">Quanto falta pagar para cada um</p></div></div><div class="supplier-list">${suppliers.map(x => `<div class="supplier-row"><span class="supplier-name"><strong>${esc(x.name)}</strong><small>${x.rows.length} ${x.rows.length === 1 ? 'item' : 'itens'} · previsto ${money(x.planned)}</small></span>${x.due > 0 ? `<span class="category-total category-due">${money(x.due)} faltam</span>` : '<span class="category-total">Quitado</span>'}</div>`).join('')}</div></section>` : ''}
  <div class="toolbar"><select id="expense-filter" class="filter-select"><option>Todas</option>${allCategories.map(c => `<option ${expenseFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><button class="button button-secondary" data-action="add-category">${icon('plus')}Categoria</button></div>
  ${categories.map(cat => { const rows = data.expenses.filter(e => e.category === cat); const sum = rows.reduce((a, e) => a + Number(e.planned || 0), 0); const removable = !rows.length && (data.customCategories || []).includes(cat); return `<section class="category-section"><div class="card category-head" data-collapse="${esc(cat)}"><div><h3>${esc(cat)}</h3><p>${rows.length} ${rows.length === 1 ? 'item' : 'itens'} · previsto ${money(sum)}</p></div>${rows.length ? totals(rows) : removable ? `<button class="text-button" data-action="delete-category" data-id="${esc(cat)}">Remover categoria</button>` : '<span class="category-total">＋</span>'}</div><div class="card table-card"><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Valor previsto</th><th>Valor pago</th><th>Falta pagar</th><th>Pagamento</th><th></th></tr></thead><tbody>${rows.length ? rows.map(row).join('') : `<tr><td colspan="6">${empty('Nenhum gasto nesta categoria ainda.')}</td></tr>`}</tbody></table></div></div></section>`; }).join('')}`;
}
function renderCeremony() {
  return `${heading('UM MOMENTO DE CADA VEZ', 'Cerimônia & músicas.', 'Organize a ordem de entrada, as músicas e os combinados do grande dia.', '<button class="button button-secondary" data-action="export-ceremony"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar roteiro em PDF</button><button class="button button-secondary" data-action="import-ceremony"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 20h14"/></svg>Importar TXT</button><button class="button button-primary" data-action="add-ceremony"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar etapa</button>')}
  <section class="ceremony-print"><header class="print-header"><p class="eyebrow">ROTEIRO DA CERIMÔNIA</p><h1>${esc(data.wedding.couple)}</h1><p>${dateLabel(data.wedding.date)} · ${esc(data.wedding.venue)}</p></header><p class="print-note">Este roteiro é um guia para o cortejo. Obrigada por fazer parte deste momento tão especial!</p>
  <section class="card table-card ceremony-table"><div class="table-wrap"><table><thead><tr><th>#</th><th>Etapa</th><th>Participantes</th><th>Música · artista</th><th>Orientações</th><th class="no-print"></th></tr></thead><tbody>${data.ceremony.length ? data.ceremony.map((c, i) => `<tr class="ceremony-row"><td><span class="step-index">${String(i + 1).padStart(2, '0')}</span></td><td><strong>${esc(c.step)}</strong></td><td>${esc(c.participants)}</td><td class="music-cell"><div class="music-title">${esc(c.music)}</div><div class="music-artist">${esc(c.artist)}</div></td><td><span class="instructions">${esc(c.notes || '—')}</span></td><td class="no-print"><div class="row-actions"><button data-action="edit-ceremony" data-id="${c.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-ceremony" data-id="${c.id}" aria-label="Excluir">${icon('trash')}</button></div></td></tr>`).join('') : `<tr><td colspan="6">${empty('Adicione as etapas da cerimônia.')}</td></tr>`}</tbody></table></div></section><section class="card print-note orientation-note"><h2>Orientações para os Padrinhos e Auxiliares</h2><ul><li>Evitem levar celular e chaves nos bolsos durante a cerimônia.</li><li>Caminhem em ritmo tranquilo, mantendo espaço entre os casais.</li><li>Sigam o posicionamento combinado e cumprimentem os noivos com calma no altar.</li></ul></section></section>`;
}
function renderCeremonial() {
  const ceremonial = [...data.ceremonial].sort((a, b) => a.time.localeCompare(b.time)), done = ceremonial.filter(item => item.status === 'Concluído').length;
  return `${heading('DIA DO CASAMENTO', 'Cerimonial do dia D.', 'Sequência operacional para conduzir o dia com segurança.', '<button class="button button-secondary" data-action="export-ceremonial"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar PDF</button><button class="button button-primary" data-action="add-ceremonial"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar horário</button>')}<div class="summary-row"><span class="summary-chip">Horários <strong>${ceremonial.length}</strong></span><span class="summary-chip">Concluídos <strong>${done}</strong></span><span class="summary-chip">A fazer <strong>${ceremonial.length - done}</strong></span><span class="summary-chip">Início da cerimônia <strong>${esc(data.wedding.time || '11:30')}</strong></span></div>
  <article class="card ceremonial-card">${ceremonial.length ? ceremonial.map(item => `<div class="ceremonial-row ${item.status === 'Concluído' ? 'is-complete' : ''}"><time>${esc(item.time)}</time><span class="ceremonial-dot"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.details || 'Sem observações')}</p><small>Responsável: ${esc(item.responsible || 'A definir')}</small></div><input class="supply-check ceremonial-check" type="checkbox" data-ceremonial-check="${item.id}" ${item.status === 'Conclu\u00eddo' ? 'checked' : ''} aria-label="Marcar ${esc(item.title)} como concluida"><div class="row-actions"><button data-action="edit-ceremonial" data-id="${item.id}" aria-label="Editar">${icon('edit')}</button><button data-action="delete-ceremonial" data-id="${item.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('') : empty('Adicione os horários do dia do casamento.')}</article>`;
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
      <span class="task-card-actions"><button type="button" data-action="attach-task" data-id="${t.id}" aria-label="Anexos" title="Fotos, PDFs e links">${icon('clip')}${files ? `<b>${files}</b>` : ''}</button>${t.responsible && t.responsiblePhone ? `<button type="button" data-action="notify-task" data-id="${t.id}" aria-label="Avisar ${esc(t.responsible)} no WhatsApp" title="Avisar no WhatsApp">${icon('chat')}</button>` : ''}<button type="button" data-action="delete-task" data-id="${t.id}" aria-label="Excluir">${icon('trash')}</button></span>
    </article>`;
  };
  const day = d => {
    const tasks = data.tasks.filter(t => t.date === d).sort(byTaskOrder);
    return `<div class="week-day ${d === today ? 'is-today' : ''} ${d === wedding ? 'is-wedding' : ''} ${d < today ? 'is-past' : ''}" data-drop-date="${d}">
      <header class="week-day-head"><span>${fmt(d, { weekday: 'short' })}</span><strong>${fromIso(d).getDate()}</strong>${d === wedding ? '<em>♡ Dia D</em>' : d === today ? '<em>Hoje</em>' : ''}</header>
      <div class="week-day-tasks">${tasks.map(t => card(t)).join('')}</div>
      <button type="button" class="week-add" data-add-task="${d}" aria-label="Nova tarefa em ${fmt(d, { day: 'numeric', month: 'long' })}">${icon('plus')}<span>Tarefa</span></button>
    </div>`;
  };
  const sameMonth = weekStart.slice(0, 7) === days[6].slice(0, 7);
  const label = `${fmt(weekStart, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${heading('PLANEJAMENTO', 'Cronograma.', 'Organize a semana, arraste as tarefas entre os dias e guarde em Prioridades o que ainda não tem data.', '<button class="button button-secondary" data-action="export-timeline"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Exportar PDF</button><button class="button button-primary" data-action="add-task"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nova tarefa</button>')}
  <div class="summary-row"><span class="summary-chip">A fazer <strong>${open.length}</strong></span><span class="summary-chip">Concluídas <strong>${data.tasks.length - open.length}</strong></span><span class="summary-chip">Prioridades <strong>${priorities.length}</strong></span>${overdue.length ? `<span class="summary-chip is-late">Atrasadas <strong>${overdue.length}</strong></span>` : ''}</div>
  <div class="planner-layout">
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
  </div>`;
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
  if (kind === 'guest') return [field('name', 'Nome', record.name || '', 'text', null, true, { required: true }), field('phone', 'Telefone / WhatsApp', record.phone || '', 'tel', null, false, { placeholder: '(11) 99999-0000' }), field('group', 'Grupo', record.group || guestGroups[0], 'text', guestGroups), field('status', 'Status do convite', record.status || 'Pendente', 'text', ['Pendente', 'Enviado', 'Confirmado', 'Recusado']), field('companions', 'Acompanhantes adultos', record.companions ?? 0, 'number', null, false, { min: 0 }), field('children', 'Crianças', record.children ?? 0, 'number', null, false, { min: 0 })].join('');
  if (kind === 'expense') return [field('description', 'Descrição', record.description || '', 'text', null, true, { required: true }), field('category', 'Categoria', record.category || expenseCategories[0], 'text', allExpenseCategories()), field('supplier', 'Fornecedor', record.supplier || '', 'text', null, false, { placeholder: 'Ex.: Buffet Sabor & Arte' }), field('planned', 'Valor previsto (R$)', record.planned ?? '', 'number', null, false, { min: 0, step: '.01' }), field('paid', 'Valor pago (R$)', record.paid ?? 0, 'number', null, false, { min: 0, step: '.01' }), field('status', 'Forma / status', record.status || 'Pendente', 'text', expenseStatuses), field('notes', 'Observações', record.notes || '', 'text', null, true), '<p class="field-hint" style="grid-column:1/-1;margin:0">"Presente Ganho" conta no total do orçamento, mas não no que falta pagar.</p>'].join('');
  if (kind === 'ceremony') return [field('step', 'Etapa', record.step || ceremonySteps[0], 'text', ceremonySteps, true), field('participants', 'Participantes', record.participants || '', 'text', null, true), field('music', 'Música', record.music || '', 'text'), field('artist', 'Artista', record.artist || '', 'text'), field('notes', 'Instruções / observações', record.notes || '', 'textarea', null, true)].join('');
  if (kind === 'supply') return [field('name', 'Item', record.name || '', 'text', null, true, { required: true }), field('category', 'Categoria', record.category || checklistCategories[0], 'text', checklistCategories), field('quantity', 'Quantidade / observação', record.quantity || '', 'text'), field('status', 'Status', record.status || 'Pendente', 'text', checklistStatuses)].join('');
  if (kind === 'task') return [field('title', 'Tarefa', record.title || '', 'text', null, true, { required: true }), field('date', 'Data', record.date || '', 'date'), field('time', 'Horário', record.time || '', 'time'), field('priority', 'Prioridade', record.priority || 'Média', 'text', taskPriorities), field('status', 'Status', record.status || 'A Fazer', 'text', taskStatuses), responsibleFields(record), field('description', 'Detalhes', record.description || '', 'textarea', null, true), '<p class="field-hint" style="grid-column:1/-1;margin:0">Sem data, a tarefa fica em Prioridades. Com responsável e WhatsApp, você avisa a pessoa em um toque.</p>'].join('');
  if (kind === 'note') return [field('title', 'T\u00edtulo', record.title || '', 'text', null, true, { required: true }), `<div class="field full"><label for="note-editor">Anota\u00e7\u00e3o</label><div class="note-toolbar" role="toolbar" aria-label="Formata\u00e7\u00e3o da anota\u00e7\u00e3o"><button type="button" data-note-command="bold" aria-label="Negrito" title="Negrito"><strong>B</strong></button><button type="button" data-note-command="italic" aria-label="It\u00e1lico" title="It\u00e1lico"><em>I</em></button><button type="button" data-note-command="underline" aria-label="Sublinhado" title="Sublinhado"><u>U</u></button><button type="button" data-note-command="strikeThrough" aria-label="Riscado" title="Riscado"><s>S</s></button><span></span><button type="button" data-note-command="createLink" aria-label="Inserir link" title="Inserir link">Link</button><button type="button" data-note-command="insertUnorderedList" aria-label="Lista" title="Lista">Lista</button></div><div id="note-editor" class="note-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Escreva sua ideia, cole um link ou formate o texto...">${sanitizeNoteHtml(record.content || '')}</div><small class="editor-hint">Selecione um trecho para formatar. Links escritos como https://... ficam clic\u00e1veis ao salvar.</small></div>`].join('');
  if (kind === 'ceremonial') return [field('time', 'Horário', record.time || '', 'time', null, false, { required: true }), field('title', 'Atividade', record.title || '', 'text', null, true, { required: true }), field('responsible', 'Responsável', record.responsible || '', 'text', null, false, { required: true }), field('status', 'Status', record.status || 'A Fazer', 'text', taskStatuses), field('details', 'Orientações para a equipe', record.details || '', 'textarea', null, true)].join('');
  if (kind === 'wedding') return [field('couple', 'Nomes do casal', data.wedding.couple, 'text', null, true, { required: true }), field('date', 'Data do casamento', data.wedding.date, 'date', null, false, { required: true }), field('time', 'Horário do casamento', data.wedding.time || '11:30', 'time', null, false, { required: true }), field('venue', 'Local', data.wedding.venue, 'text', null, true)].join('');
}
// Responsável com sugestões dos convidados (o WhatsApp é preenchido sozinho quando a pessoa tem telefone).
const knownPeople = () => new Map([...data.guests.map(g => [g.name, g.phone || '']), ...data.tasks.filter(t => t.responsible).map(t => [t.responsible, t.responsiblePhone || ''])]);
function responsibleFields(record) {
  return `<div class="field"><label for="field-responsible">Responsável</label><input id="field-responsible" name="responsible" list="people-list" value="${esc(record.responsible || '')}" placeholder="Quem cuida disso" autocomplete="off"><datalist id="people-list">${[...knownPeople().keys()].map(name => `<option value="${esc(name)}">`).join('')}</datalist></div><div class="field"><label for="field-responsiblePhone">WhatsApp do responsável</label><input id="field-responsiblePhone" name="responsiblePhone" type="tel" value="${esc(record.responsiblePhone || '')}" placeholder="(11) 99999-0000"></div>`;
}
function whatsappTaskUrl(task) {
  const phone = String(task.responsiblePhone || '').replace(/\D/g, '').replace(/^(?!55)(\d{10,11})$/, '55$1');
  const when = task.date ? `${fromIso(task.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${task.time ? ` às ${task.time}` : ''}` : 'sem data definida ainda';
  const text = [`Oi, ${task.responsible.split(' ')[0]}! ♡`, `Você ficou responsável por: *${task.title}*`, `Quando: ${when}`, ...(task.description ? [`Detalhes: ${task.description}`] : []), '', `Planejamento do casamento de ${data.wedding.couple}`].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
function notifyResponsible(task) {
  if (!task?.responsible || !task.responsiblePhone) return;
  openModal(`Avisar ${task.responsible}?`, `<p class="confirm-copy">Abrir o WhatsApp com uma mensagem para ${esc(task.responsible)} sobre a tarefa <strong>${esc(task.title)}</strong>${task.date ? ` (${esc(shortDate(task.date))}${task.time ? ` às ${esc(task.time)}` : ''})` : ''}. É só tocar em enviar.</p>`, () => window.open(whatsappTaskUrl(task), '_blank', 'noopener'));
  $('#modal-submit').textContent = 'Abrir WhatsApp';
}
function addOrEdit(kind, id = null, preset = {}) {
  const config = { guest: ['guests', 'convidado', 'name', 'id'], expense: ['expenses', 'gasto', 'description', 'id'], ceremony: ['ceremony', 'etapa', 'step', 'id'], ceremonial: ['ceremonial', 'horário da cerimonial', 'title', 'id'], supply: ['supplies', 'item', 'name', 'id'], task: ['tasks', 'tarefa', 'title', 'id'], note: ['notes', 'anotação', 'title', 'id'] }[kind];
  const [collection, label, , idKey] = config; const existing = id ? data[collection].find(x => x[idKey] === id) : null;
  const before = existing ? `${existing.responsible}|${existing.responsiblePhone}|${existing.date}|${existing.time}|${existing.title}` : '';
  openModal(`${existing ? 'Editar' : 'Adicionar'} ${label}`, recordForm(kind, existing || preset), values => {
    for (const k of ['companions', 'children', 'planned', 'paid']) if (values[k] !== undefined) values[k] = Number(values[k] || 0);
    if (existing) Object.assign(existing, values, kind === 'note' ? { updatedAt: new Date().toISOString() } : {}); else data[collection].push({ id: uid(kind[0]), ...values, ...(kind === 'note' ? { updatedAt: new Date().toISOString() } : {}) });
    save(kind === 'note' ? 'Anotação salva.' : existing ? 'Alterações salvas.' : 'Item adicionado.');
    const task = kind === 'task' ? (existing || data.tasks[data.tasks.length - 1]) : null;
    if (task?.responsible && task.responsiblePhone && `${task.responsible}|${task.responsiblePhone}|${task.date}|${task.time}|${task.title}` !== before) setTimeout(() => notifyResponsible(task), 80);
  });
  if (kind === 'task') $('#field-responsible')?.addEventListener('change', event => { const phone = knownPeople().get(event.target.value.trim()); const input = $('#field-responsiblePhone'); if (phone && input && !input.value) input.value = phone; });
}
function deleteRecord(collection, id, label) {
  openModal(`Excluir ${label}?`, '<p class="confirm-copy">Esta ação não pode ser desfeita. O item será removido do planejamento.</p>', () => {
    if (collection === 'expenses' || collection === 'tasks') (data[collection].find(r => r.id === id)?.files || []).forEach(deleteAttachmentParts);
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
const attachRef = (fileId, part) => doc(db, 'planners', activeUser.uid, 'anexos', `${fileId}_${part}`);
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
    $('#attach-body').innerHTML = `<div class="modal-head"><div><p class="eyebrow">ANEXOS</p><h2>${esc(expense.description || expense.title)}</h2></div><button type="button" class="icon-button" data-attach-close aria-label="Fechar">×</button></div>
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
  pdfHeading(doc, 'Cronograma da cerimonial — Dia D', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(55); doc.text(`Início da cerimônia: ${data.wedding.time || '11:30'}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Horário', 'Atividade', 'Responsável', 'Orientações', 'Status']], body: [...data.ceremonial].sort((a, b) => a.time.localeCompare(b.time)).map(item => [item.time, item.title, item.responsible || 'A definir', item.details || '—', item.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15, overflow: 'linebreak' }, headStyles: { fillColor: [95, 107, 42], textColor: 255, fontStyle: 'bold' }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: 62 }, 2: { cellWidth: 48 }, 4: { cellWidth: 18 } }, didParseCell: cell => { if (cell.section === 'body' && cell.column.index === 4) cell.cell.text = ['']; }, didDrawCell: cell => { if (cell.section === 'body' && cell.column.index === 4) { const size = 4.5, x = cell.cell.x + (cell.cell.width - size) / 2, y = cell.cell.y + (cell.cell.height - size) / 2; doc.setDrawColor(100); doc.setLineWidth(.35); doc.rect(x, y, size, size); if (cell.row.raw[4] === 'Conclu\u00eddo') { doc.setDrawColor(45, 90, 67); doc.setLineWidth(.8); doc.line(x + .8, y + 2.3, x + 1.8, y + 3.2); doc.line(x + 1.8, y + 3.2, x + 3.8, y + 1.1); } } } });
  pdfFooter(doc); doc.save('cronograma-cerimonial-dia-d.pdf'); notify('Cronograma da cerimonial exportado em PDF.');
}
function exportFinancePdf() {
  const doc = pdfBase('Relatório financeiro e orçamento'); if (!doc) return;
  pdfHeading(doc, 'Relatório financeiro', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45); doc.text(`Total orçado: ${money(planned())}     Pago: ${money(spent())}     Presentes: ${money(gifted())}     Falta pagar: ${money(due())}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Categoria', 'Item / fornecedor', 'Valor previsto', 'Valor pago', 'Falta pagar', 'Status']], body: data.expenses.map(e => [e.category, e.supplier ? `${e.description}\n${e.supplier}` : e.description, money(e.planned), money(e.paid), isGift(e) ? 'Presente' : money(dueOf(e)), e.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [95, 107, 42], textColor: 255 }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 72 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
  pdfFooter(doc); doc.save('relatorio-financeiro.pdf'); notify('Relatório financeiro exportado em PDF.');
}
function exportChecklistPdf() {
  const doc = pdfBase('Checklist e cronograma do Dia D'); if (!doc) return;
  pdfHeading(doc, 'Checklist físico para o Dia D', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
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
    if (action === 'edit-wedding') openModal('Detalhes do casamento', recordForm('wedding'), values => { data.wedding = values; save('Detalhes do casamento atualizados.'); render(); });
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
    if (action === 'notify-task') notifyResponsible(data.tasks.find(t => t.id === id));
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
  bindWeekEvents();
}
function bindWeekEvents() {
  const page = $('#page-content');
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
  { page: 'inicio', target: '.event-card', title: 'O grande dia', text: 'Aqui ficam o casal, o local, a data e a contagem regressiva. As pílulas Qua, Qui, Sex e Sáb mostram quantas tarefas de cada dia já foram feitas. Use "Editar detalhes" para mudar data, horário ou local.' },
  { page: 'inicio', target: '.notice-card', title: 'Próximo passo', text: 'Mostra a próxima tarefa pendente do cronograma. Terminou? Clique em "Marcar como feita" e o painel já mostra a seguinte.' },
  { page: 'inicio', target: '.stats-grid', title: 'Resumo em números', text: 'Convidados confirmados, quanto já foi pago, o saldo, as tarefas e os itens no local. Clique em qualquer card para abrir a página correspondente.' },
  { page: 'cronograma', target: '.nav-item[data-page="cronograma"]', title: 'Cronograma', text: 'Um calendário semanal: avance ou volte as semanas, arraste as tarefas entre os dias e use Prioridades para o que ainda não tem data. Com responsável e WhatsApp, você avisa a pessoa em um toque.' },
  { page: 'checklist', target: '.nav-item[data-page="checklist"]', title: 'O que levar', text: 'A lista do que precisa chegar ao local, por categoria. Acompanhe cada item como Pendente, Comprado, No carro ou No local, e marque "No local" quando ele chegar.' },
  { page: 'anotacoes', target: '.nav-item[data-page="anotacoes"]', title: 'Anotações', text: 'Guarde ideias, links e lembretes. O editor aceita negrito, itálico, listas e links.' },
  { page: 'convidados', target: '.nav-item[data-page="convidados"]', title: 'Convidados', text: 'Cadastre cada convidado com grupo, telefone, acompanhantes e status do convite. Busque por nome, filtre por grupo ou importe uma lista pronta em TXT.' },
  { page: 'cerimonia', target: '.nav-item[data-page="cerimonia"]', title: 'Cerimônia & músicas', text: 'Monte a ordem de entrada do cortejo com participantes, músicas e orientações. Exporte o roteiro em PDF para os padrinhos.' },
  { page: 'cerimonial', target: '.nav-item[data-page="cerimonial"]', title: 'Cerimonial do dia D', text: 'O passo a passo do dia, com horários e responsáveis. Marque cada horário como concluído e exporte em PDF para a equipe.' },
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
$('#edit-wedding').addEventListener('click', () => openModal('Detalhes do casamento', recordForm('wedding'), values => { data.wedding = values; save('Detalhes do casamento atualizados.'); render(); }));
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
  const plannerRef = doc(db, 'planners', user.uid);
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
