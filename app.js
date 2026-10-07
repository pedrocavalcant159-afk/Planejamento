import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAQqVENhMjVPYyauNr4O1Z0SXvb1I5qUBM',
  authDomain: 'plancasa-d6785.firebaseapp.com',
  projectId: 'plancasa-d6785',
  storageBucket: 'plancasa-d6785.firebasestorage.app',
  messagingSenderId: '804042107473',
  appId: '1:804042107473:web:c7d0388851c45dd27ee670',
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
let activeUser = null;
let stopRealtime = null;
let saveQueue = Promise.resolve();
let authMode = 'signin';
const STORAGE_KEY = 'entre-nos-casamento-v1';
const navLabels = { inicio: 'Visão geral', convidados: 'Convidados', financeiro: 'Financeiro', cerimonia: 'Cerimônia & músicas', checklist: 'O que levar', cronograma: 'Cronograma' };
const expenseCategories = ['Comidas & Buffet', 'Decoração & Cenografia', 'Local / Espaço / Sítio', 'Trajes & Beleza', 'Itens Avulsos & Lembrancinhas'];
const guestGroups = ['Família Noiva', 'Família Noivo', 'Padrinhos', 'Amigos'];
const expenseStatuses = ['Pendente', 'Pago Pix', 'Cartão', 'Boleto', 'Presente Ganho'];
const checklistCategories = ['Descartáveis & Limpeza', 'Alimentos & Bebidas', 'Utensílios & Cozinha', 'Eletroportáteis & Ferramentas', 'Itens Pessoais & Documentos'];
const checklistStatuses = ['Pendente', 'Comprado', 'No Carro', 'No Local'];
const taskStatuses = ['A Fazer', 'Em Andamento', 'Concluído'];
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
    { id: 'e6', description: 'Lembrancinhas', category: 'Itens Avulsos & Lembrancinhas', planned: 420, paid: 0, status: 'Pendente', notes: '' },
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
};

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(defaultData);
    return Object.fromEntries(Object.entries(defaultData).map(([key, value]) => [key, key === 'wedding' ? { ...structuredClone(value), ...(saved.wedding || {}) } : saved[key] ?? structuredClone(value)]));
  } catch { return structuredClone(defaultData); }
}
let data = structuredClone(defaultData);
let currentPage = 'inicio';
let guestFilter = 'Todos';
let guestSearch = '';
let expenseFilter = 'Todas';
let toastTimer;
let animateNextRender = true;
const $ = (s, root = document) => root.querySelector(s);
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const totalGuests = () => data.guests.reduce((n, g) => n + 1 + Number(g.companions || 0) + Number(g.children || 0), 0);
const confirmedGuests = () => data.guests.filter(g => g.status === 'Confirmado').reduce((n, g) => n + 1 + Number(g.companions || 0) + Number(g.children || 0), 0);
const spent = () => data.expenses.reduce((n, e) => n + Number(e.paid || 0), 0);
const planned = () => data.expenses.reduce((n, e) => n + Number(e.planned || 0), 0);
const progress = () => Math.round((data.tasks.filter(t => t.status === 'Concluído').length / Math.max(data.tasks.length, 1)) * 100);
const badge = (text, cls = text.toLowerCase().replaceAll(' ', '-')) => `<span class="badge badge-${esc(cls)}">${esc(text)}</span>`;
const empty = message => {
  const actions = { convidados: ['add-guest', 'Adicionar convidado'], financeiro: ['add-expense', 'Adicionar gasto'], cerimonia: ['add-ceremony', 'Adicionar etapa'], checklist: ['add-supply', 'Adicionar item'], cronograma: ['add-task', 'Adicionar tarefa'] };
  const action = actions[currentPage];
  return `<div class="empty-state"><span class="empty-mark" aria-hidden="true">♡</span><span>${esc(message)}</span>${action ? `<button class="button button-secondary" data-action="${action[0]}">＋ ${action[1]}</button>` : ''}</div>`;
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
  if (seconds <= 0) return { complete: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return { complete: false, days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}
function daysRemaining() { return countdownState().days; }
function updateCountdown() {
  const state = countdownState(); const timer = $('#live-countdown');
  if (!timer) return;
  if (state.complete) { timer.classList.add('countdown-complete'); timer.innerHTML = '<strong>O grande dia já aconteceu ♡</strong><span>Atualize a data do casamento nos detalhes</span>'; return; }
  timer.classList.remove('countdown-complete');
  [['days', state.days], ['hours', String(state.hours).padStart(2, '0')], ['minutes', String(state.minutes).padStart(2, '0')], ['seconds', String(state.seconds).padStart(2, '0')]].forEach(([unit, value]) => { const el = timer.querySelector(`[data-count="${unit}"]`); if (el && el.textContent !== String(value)) { el.textContent = value; el.classList.remove('count-tick'); void el.offsetWidth; el.classList.add('count-tick'); } });
}
function dateLabel(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) { if (!value) return 'Defina a data'; return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', options); }
function setPage(page) { currentPage = page; animateNextRender = true; $('.nav-item.active')?.classList.remove('active'); $(`.nav-item[data-page="${page}"]`)?.classList.add('active'); $('#current-section').textContent = navLabels[page]; $('#sidebar').classList.remove('open'); render(); }
function render() {
  const content = $('#page-content');
  $('#wedding-short-name').textContent = data.wedding.couple;
  content.innerHTML = ({ inicio: renderDashboard, convidados: renderGuests, financeiro: renderFinance, cerimonia: renderCeremony, checklist: renderChecklist, cronograma: renderTimeline })[currentPage]();
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
  const countdown = countdownState(), d = countdown.days, tasks = [...data.tasks].filter(t => t.status !== 'Concluído').slice(0, 4), paidRatio = planned() ? Math.min(100, Math.round(spent() / planned() * 100)) : 0;
  const groups = expenseCategories.map(c => { const sum = data.expenses.filter(e => e.category === c).reduce((a, e) => a + Number(e.planned || 0), 0); return { c, sum }; }).filter(x => x.sum).sort((a, b) => b.sum - a.sum);
  return `${heading('SEU GRANDE DIA', 'Tudo está tomando forma.', 'Um espaço só de vocês para cuidar de cada detalhe com calma.')}
  <section class="hero"><div class="hero-copy"><p class="eyebrow">COM CARINHO, PARA ${esc(data.wedding.couple.toLocaleUpperCase('pt-BR'))}</p><h2>O amor mora nos detalhes.</h2><p>${esc(data.wedding.venue || 'Seu lugar especial')} · ${dateLabel(data.wedding.date)} · ${esc(data.wedding.time || '11:30')}</p><button class="button button-secondary" data-action="edit-wedding">Editar data e horário</button></div><div class="countdown ${countdown.complete ? 'countdown-complete' : ''}" id="live-countdown" aria-label="Contagem regressiva">${countdown.complete ? '<strong>O grande dia já aconteceu ♡</strong><span>Atualize a data nos detalhes</span>' : `<div class="count-unit"><strong data-count="days">${countdown.days}</strong><span>dias</span></div><div class="count-unit"><strong data-count="hours">${String(countdown.hours).padStart(2, '0')}</strong><span>horas</span></div><div class="count-unit"><strong data-count="minutes">${String(countdown.minutes).padStart(2, '0')}</strong><span>minutos</span></div><div class="count-unit"><strong data-count="seconds">${String(countdown.seconds).padStart(2, '0')}</strong><span>segundos</span></div>`}</div></section>
  <section class="stats-grid"><article class="card stat-card"><div class="stat-top"><span>Convidados confirmados</span><span class="stat-icon">♧</span></div><div class="stat-value">${confirmedGuests()}</div><div class="stat-foot">de ${totalGuests()} pessoas na lista</div></article><article class="card stat-card"><div class="stat-top"><span>Orçamento planejado</span><span class="stat-icon gold">◉</span></div><div class="stat-value">${money(planned())}</div><div class="stat-foot">${money(spent())} já pagos</div></article><article class="card stat-card"><div class="stat-top"><span>Pagamentos realizados</span><span class="stat-icon rose">♡</span></div><div class="stat-value">${paidRatio}%</div><div class="stat-foot">${money(Math.max(0, planned() - spent()))} restante a pagar</div></article><article class="card stat-card"><div class="stat-top"><span>Tarefas concluídas</span><span class="stat-icon">✓</span></div><div class="stat-value">${progress()}%</div><div class="stat-foot">${data.tasks.filter(t => t.status === 'Concluído').length} de ${data.tasks.length} tarefas prontas</div></article></section>
  <section class="dashboard-grid"><article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Visão do orçamento</h2><p class="panel-subtitle">Um panorama leve dos gastos planejados</p></div><button class="text-button" data-go="financeiro">Ver detalhes →</button></div><div class="budget-total">${money(spent())}</div><div class="budget-meta"><span>do total de ${money(planned())}</span><span>${paidRatio}% pago</span></div><div class="progress-track"><span style="width:${paidRatio}%"></span></div><div class="legend-row"><span><i class="legend-dot"></i>Valor pago</span><span><i class="legend-dot soft"></i>Restante</span></div><div class="category-list" style="margin-top:20px">${groups.length ? groups.map(x => `<div class="category-row"><span class="category-name">${esc(x.c)}</span><span class="category-value">${money(x.sum)}</span><div class="mini-track"><span style="width:${Math.max(3, Math.round(x.sum / planned() * 100))}%"></span></div></div>`).join('') : empty('Adicione seus primeiros gastos.')}</div></article>
  <article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Próximos passos</h2><p class="panel-subtitle">Pequenos passos, grande dia</p></div><button class="text-button" data-go="cronograma">Ver cronograma →</button></div><div class="task-list">${tasks.length ? tasks.map(t => `<label class="task-row"><input class="task-check" type="checkbox" data-task-check="${t.id}" ${t.status === 'Concluído' ? 'checked' : ''}><span class="task-text ${t.status === 'Concluído' ? 'done' : ''}">${esc(t.title)}</span><span class="task-meta">${esc(t.day.replace(' / Dia D', ''))}</span></label>`).join('') : empty('Tudo por aqui concluído!')}</div></article></section>`;
}
function renderGuests() {
  const visible = data.guests.filter(g => (guestFilter === 'Todos' || g.group === guestFilter) && `${g.name} ${g.phone}`.toLowerCase().includes(guestSearch.toLowerCase()));
  const confirmed = confirmedGuests(), invited = data.guests.filter(g => g.status === 'Enviado').length;
  return `${heading('LISTA DE CONVIDADOS', 'Pessoas queridas, pertinho.', 'Acompanhe os convites e tenha a lista na ponta dos dedos.', '<button class="button button-secondary" data-action="import-guests">Importar TXT</button><button class="button button-primary" data-action="add-guest">＋ Adicionar convidado</button>')}
  <div class="summary-row"><span class="summary-chip">Pessoas na lista <strong>${totalGuests()}</strong></span><span class="summary-chip">Confirmadas <strong>${confirmed}</strong></span><span class="summary-chip">Convites enviados <strong>${invited}</strong></span></div>
  <div class="toolbar"><label class="search-box"><span class="search-mark">⌕</span><input id="guest-search" type="search" placeholder="Buscar por nome ou telefone" value="${esc(guestSearch)}"></label><select id="guest-filter" class="filter-select"><option>Todos</option>${guestGroups.map(g => `<option ${guestFilter === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
  <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Convidado</th><th>Grupo</th><th>Telefone / WhatsApp</th><th>Convite</th><th>Acompanhantes</th><th></th></tr></thead><tbody>${visible.length ? visible.map(g => `<tr><td><div class="person-cell"><span class="person-avatar">${esc(g.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase())}</span><span><span class="person-name">${esc(g.name)}</span><span class="person-sub">${Number(g.children) ? `${g.children} criança(s)` : 'Convidado(a)'}</span></span></div></td><td>${esc(g.group)}</td><td>${esc(g.phone || '—')}</td><td>${badge(g.status)}</td><td>${Number(g.companions || 0)} adulto(s) · ${Number(g.children || 0)} criança(s)</td><td><div class="row-actions"><button data-action="edit-guest" data-id="${g.id}" aria-label="Editar">✎</button><button data-action="delete-guest" data-id="${g.id}" aria-label="Excluir">×</button></div></td></tr>`).join('') : `<tr><td colspan="6">${empty('Nenhum convidado encontrado.')}</td></tr>`}</tbody></table></div><div class="table-footer">Exibindo <strong>${visible.length}</strong> de <strong>${data.guests.length}</strong> convidados · Pessoas confirmadas com acompanhantes: <strong>${confirmed}</strong></div></section>`;
}
function renderFinance() {
  const allCategories = [...new Set([...expenseCategories, ...data.expenses.map(e => e.category).filter(Boolean)])];
  const categories = expenseFilter === 'Todas' ? allCategories : [expenseFilter];
  return `${heading('ORÇAMENTO COM TRANSPARÊNCIA', 'O dinheiro também faz parte do plano.', 'Organize os valores com clareza, sem perder a leveza.', '<button class="button button-secondary" data-action="export-finance">Exportar PDF</button><button class="button button-secondary" data-action="import-expenses">Importar TXT</button><button class="button button-primary" data-action="add-expense">＋ Adicionar gasto</button>')}
  <section class="budget-overview"><article class="card budget-box"><span>Total orçado</span><strong>${money(planned())}</strong><small>Somando todos os itens previstos</small></article><article class="card budget-box"><span>Total pago</span><strong>${money(spent())}</strong><small>Valores já quitados</small></article><article class="card budget-box"><span>Saldo a pagar</span><strong>${money(Math.max(0, planned() - spent()))}</strong><small>Dentro do orçamento ♡</small></article></section>
  <div class="toolbar"><select id="expense-filter" class="filter-select"><option>Todas</option>${allCategories.map(c => `<option ${expenseFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
  ${categories.map(cat => { const rows = data.expenses.filter(e => e.category === cat); const sum = rows.reduce((a, e) => a + Number(e.planned || 0), 0); return `<section class="category-section"><div class="card category-head" data-collapse="${esc(cat)}"><div><h3>${esc(cat)}</h3><p>${rows.length} ${rows.length === 1 ? 'item' : 'itens'} · previsto ${money(sum)}</p></div><span class="category-total">${rows.length ? money(rows.reduce((a, e) => a + Number(e.paid || 0), 0)) + ' pagos' : '＋'}</span></div><div class="card table-card"><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Valor previsto</th><th>Valor pago</th><th>Pagamento</th><th></th></tr></thead><tbody>${rows.length ? rows.map(e => `<tr><td><span class="person-name">${esc(e.description)}</span>${e.notes ? `<span class="person-sub">${esc(e.notes)}</span>` : ''}</td><td>${money(e.planned)}</td><td>${money(e.paid)}</td><td>${badge(e.status, e.status.startsWith('Pago') || e.status === 'Presente Ganho' ? 'pago' : 'pendente')}</td><td><div class="row-actions"><button data-action="edit-expense" data-id="${e.id}" aria-label="Editar">✎</button><button data-action="delete-expense" data-id="${e.id}" aria-label="Excluir">×</button></div></td></tr>`).join('') : `<tr><td colspan="5">${empty('Nenhum gasto nesta categoria ainda.')}</td></tr>`}</tbody></table></div></div></section>`; }).join('')}`;
}
function renderCeremony() {
  const ceremonial = [...data.ceremonial].sort((a, b) => a.time.localeCompare(b.time));
  return `${heading('UM MOMENTO DE CADA VEZ', 'A cerimônia, do jeitinho de vocês.', 'Organize a ordem de entrada, as músicas e os combinados do grande dia.', '<button class="button button-secondary" data-action="export-ceremonial">PDF da cerimonial</button><button class="button button-secondary" data-action="export-ceremony">Exportar roteiro em PDF</button><button class="button button-secondary" data-action="import-ceremony">Importar TXT</button><button class="button button-primary" data-action="add-ceremony">＋ Adicionar etapa</button>')}
  <section class="ceremony-print"><header class="print-header"><p class="eyebrow">ROTEIRO DA CERIMÔNIA</p><h1>${esc(data.wedding.couple)}</h1><p>${dateLabel(data.wedding.date)} · ${esc(data.wedding.venue)}</p></header><p class="print-note">Este roteiro é um guia para o cortejo. Obrigada por fazer parte deste momento tão especial!</p>
  <section class="card table-card ceremony-table"><div class="table-wrap"><table><thead><tr><th>#</th><th>Etapa</th><th>Participantes</th><th>Música · artista</th><th>Orientações</th><th class="no-print"></th></tr></thead><tbody>${data.ceremony.length ? data.ceremony.map((c, i) => `<tr class="ceremony-row"><td><span class="step-index">${String(i + 1).padStart(2, '0')}</span></td><td><strong>${esc(c.step)}</strong></td><td>${esc(c.participants)}</td><td class="music-cell"><div class="music-title">${esc(c.music)}</div><div class="music-artist">${esc(c.artist)}</div></td><td><span class="instructions">${esc(c.notes || '—')}</span></td><td class="no-print"><div class="row-actions"><button data-action="edit-ceremony" data-id="${c.id}" aria-label="Editar">✎</button><button data-action="delete-ceremony" data-id="${c.id}" aria-label="Excluir">×</button></div></td></tr>`).join('') : `<tr><td colspan="6">${empty('Adicione as etapas da cerimônia.')}</td></tr>`}</tbody></table></div></section><section class="card print-note orientation-note"><h2>Orientações para os Padrinhos e Auxiliares</h2><ul><li>Evitem levar celular e chaves nos bolsos durante a cerimônia.</li><li>Caminhem em ritmo tranquilo, mantendo espaço entre os casais.</li><li>Sigam o posicionamento combinado e cumprimentem os noivos com calma no altar.</li></ul></section></section><section class="ceremonial-section"><div class="section-heading"><div><p class="eyebrow">DIA DO CASAMENTO</p><h2>Cronograma da cerimonial</h2><p>Sequência operacional para conduzir o dia com segurança.</p></div><button class="button button-primary" data-action="add-ceremonial">＋ Adicionar horário</button></div><article class="card ceremonial-card">${ceremonial.map(item => `<div class="ceremonial-row ${item.status === 'Concluído' ? 'is-complete' : ''}"><time>${esc(item.time)}</time><span class="ceremonial-dot"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.details || 'Sem observações')}</p><small>Responsável: ${esc(item.responsible || 'A definir')}</small></div><select class="status-select" data-ceremonial-status="${item.id}" aria-label="Status de ${esc(item.title)}">${taskStatuses.map(status => `<option ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select><div class="row-actions"><button data-action="edit-ceremonial" data-id="${item.id}" aria-label="Editar">✎</button><button data-action="delete-ceremonial" data-id="${item.id}" aria-label="Excluir">×</button></div></div>`).join('')}</article></section>`;
}
function renderChecklist() {
  const done = data.supplies.filter(s => s.status === 'No Local').length;
  const allCategories = [...new Set([...checklistCategories, ...data.supplies.map(s => s.category).filter(Boolean)])];
  return `${heading('PREPARAR COM CARINHO', 'Tudo que vai com vocês.', 'Uma lista compartilhada para cada item chegar ao lugar certo.', '<button class="button button-secondary" data-action="export-checklist">Exportar checklist PDF</button><button class="button button-secondary" data-action="import-supplies">Importar TXT</button><button class="button button-primary" data-action="add-supply">＋ Adicionar item</button>')}<div class="summary-row"><span class="summary-chip">Itens no checklist <strong>${data.supplies.length}</strong></span><span class="summary-chip">Já no local <strong>${done}</strong></span><span class="summary-chip">Em andamento <strong>${data.supplies.filter(s => ['Comprado', 'No Carro'].includes(s.status)).length}</strong></span></div>
  <section class="check-categories">${allCategories.map(cat => { const items = data.supplies.filter(s => s.category === cat); return `<article class="card check-card"><header class="check-head"><h3>${esc(cat)}</h3><span>${items.filter(i => i.status === 'No Local').length} / ${items.length} no local</span></header><div class="check-items">${items.length ? items.map(s => `<div class="check-item ${s.status === 'No Local' ? 'is-complete' : ''}"><span class="task-text">${esc(s.name)}${s.quantity ? `<span class="person-sub">${esc(s.quantity)}</span>` : ''}</span><div class="check-actions"><label class="supply-check-label"><input class="supply-check" type="checkbox" data-supply-check="${s.id}" ${s.status === 'No Local' ? 'checked' : ''} aria-label="Marcar ${esc(s.name)} como no local"><span>No local</span></label><select class="status-select" data-supply-status="${s.id}" aria-label="Status de ${esc(s.name)}">${checklistStatuses.map(st => `<option ${s.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select><div class="row-actions"><button data-action="edit-supply" data-id="${s.id}" aria-label="Editar">✎</button><button data-action="delete-supply" data-id="${s.id}" aria-label="Excluir">×</button></div></div></div>`).join('') : empty('Nenhum item nesta categoria.')}</div></article>`; }).join('')}</section>`;
}
function renderTimeline() {
  const days = ['Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado / Dia D'];
  return `${heading('CONTAGEM REGRESSIVA', 'A semana do sim.', 'Cada tarefa no seu tempo — e espaço para curtir o caminho.', '<button class="button button-secondary" data-action="export-timeline">Exportar cronograma PDF</button><button class="button button-primary" data-action="add-task">＋ Nova tarefa</button>')}<div class="summary-row"><span class="summary-chip">Tarefas no total <strong>${data.tasks.length}</strong></span><span class="summary-chip">Concluídas <strong>${data.tasks.filter(t => t.status === 'Concluído').length}</strong></span><span class="summary-chip">A fazer <strong>${data.tasks.filter(t => t.status !== 'Concluído').length}</strong></span></div>
  ${days.map(day => { const tasks = data.tasks.filter(t => t.day === day).sort((a, b) => a.time.localeCompare(b.time)); return `<section class="day-section"><h2 class="day-title">${esc(day)} <span>${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}</span></h2><article class="card day-tasks">${tasks.length ? tasks.map(t => `<div class="timeline-row"><span class="timeline-time">${esc(t.time || '—')}</span><span class="timeline-mark"></span><div><div class="timeline-title">${esc(t.title)}</div><div class="timeline-desc">${esc(t.description || '')}</div></div><div style="display:flex;gap:6px;align-items:center"><select class="status-select" data-task-status="${t.id}" aria-label="Status de ${esc(t.title)}">${taskStatuses.map(s => `<option ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><div class="row-actions"><button data-action="edit-task" data-id="${t.id}" aria-label="Editar">✎</button><button data-action="delete-task" data-id="${t.id}" aria-label="Excluir">×</button></div></div></div>`).join('') : empty('Sem tarefas planejadas para este dia.')}</article></section>`; }).join('')}`;
}

function field(name, label, value = '', type = 'text', options = null, full = false, extra = {}) {
  const id = `field-${name}`; let control;
  if (options) control = `<select id="${id}" name="${name}" ${extra.required ? 'required' : ''}>${options.map(o => `<option value="${esc(o)}" ${String(value) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (type === 'textarea') control = `<textarea id="${id}" name="${name}" ${extra.required ? 'required' : ''} placeholder="${esc(extra.placeholder || '')}">${esc(value)}</textarea>`;
  else control = `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${extra.required ? 'required' : ''} ${extra.min !== undefined ? `min="${extra.min}"` : ''} ${extra.step ? `step="${extra.step}"` : ''} placeholder="${esc(extra.placeholder || '')}">`;
  return `<div class="field ${full ? 'full' : ''}"><label for="${id}">${label}</label>${control}</div>`;
}
function openModal(title, fields, onSave) {
  $('#modal-title').textContent = title; $('#modal-fields').innerHTML = fields; const modal = $('#modal');
  $('#modal-submit').textContent = 'Salvar'; $('#modal-submit').classList.remove('button-danger');
  const submit = event => { event.preventDefault(); const form = new FormData($('#modal-form')); onSave(Object.fromEntries(form.entries())); modal.close(); render(); };
  $('#modal-form').onsubmit = submit; modal.showModal(); raiseInteractiveCursor(); setTimeout(() => $('#modal-fields input, #modal-fields select')?.focus(), 50);
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
  if (kind === 'expense') return [field('description', 'Descrição', record.description || '', 'text', null, true, { required: true }), field('category', 'Categoria', record.category || expenseCategories[0], 'text', expenseCategories), field('planned', 'Valor previsto (R$)', record.planned ?? '', 'number', null, false, { min: 0, step: '.01' }), field('paid', 'Valor pago (R$)', record.paid ?? 0, 'number', null, false, { min: 0, step: '.01' }), field('status', 'Forma / status', record.status || 'Pendente', 'text', expenseStatuses), field('notes', 'Observações', record.notes || '', 'text', null, true)].join('');
  if (kind === 'ceremony') return [field('step', 'Etapa', record.step || ceremonySteps[0], 'text', ceremonySteps, true), field('participants', 'Participantes', record.participants || '', 'text', null, true), field('music', 'Música', record.music || '', 'text'), field('artist', 'Artista', record.artist || '', 'text'), field('notes', 'Instruções / observações', record.notes || '', 'textarea', null, true)].join('');
  if (kind === 'supply') return [field('name', 'Item', record.name || '', 'text', null, true, { required: true }), field('category', 'Categoria', record.category || checklistCategories[0], 'text', checklistCategories), field('quantity', 'Quantidade / observação', record.quantity || '', 'text'), field('status', 'Status', record.status || 'Pendente', 'text', checklistStatuses)].join('');
  if (kind === 'task') return [field('title', 'Tarefa', record.title || '', 'text', null, true, { required: true }), field('day', 'Dia', record.day || 'Quarta-feira', 'text', ['Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado / Dia D']), field('time', 'Horário', record.time || '', 'time'), field('status', 'Status', record.status || 'A Fazer', 'text', taskStatuses), field('responsible', 'Responsável', record.responsible || '', 'text'), field('description', 'Detalhes', record.description || '', 'textarea', null, true)].join('');
  if (kind === 'ceremonial') return [field('time', 'Horário', record.time || '', 'time', null, false, { required: true }), field('title', 'Atividade', record.title || '', 'text', null, true, { required: true }), field('responsible', 'Responsável', record.responsible || '', 'text', null, false, { required: true }), field('status', 'Status', record.status || 'A Fazer', 'text', taskStatuses), field('details', 'Orientações para a equipe', record.details || '', 'textarea', null, true)].join('');
  if (kind === 'wedding') return [field('couple', 'Nomes do casal', data.wedding.couple, 'text', null, true, { required: true }), field('date', 'Data do casamento', data.wedding.date, 'date', null, false, { required: true }), field('time', 'Horário do casamento', data.wedding.time || '11:30', 'time', null, false, { required: true }), field('venue', 'Local', data.wedding.venue, 'text', null, true)].join('');
}
function addOrEdit(kind, id = null) {
  const config = { guest: ['guests', 'convidado', 'name', 'id'], expense: ['expenses', 'gasto', 'description', 'id'], ceremony: ['ceremony', 'etapa', 'step', 'id'], ceremonial: ['ceremonial', 'horário da cerimonial', 'title', 'id'], supply: ['supplies', 'item', 'name', 'id'], task: ['tasks', 'tarefa', 'title', 'id'] }[kind];
  const [collection, label, , idKey] = config; const existing = id ? data[collection].find(x => x[idKey] === id) : null;
  openModal(`${existing ? 'Editar' : 'Adicionar'} ${label}`, recordForm(kind, existing || {}), values => {
    for (const k of ['companions', 'children', 'planned', 'paid']) if (values[k] !== undefined) values[k] = Number(values[k] || 0);
    if (existing) Object.assign(existing, values); else data[collection].push({ id: uid(kind[0]), ...values });
    save(existing ? 'Alterações salvas.' : 'Item adicionado.');
  });
}
function deleteRecord(collection, id, label) {
  openModal(`Excluir ${label}?`, '<p class="confirm-copy">Esta ação não pode ser desfeita. O item será removido do planejamento.</p>', () => {
    data[collection] = data[collection].filter(r => r.id !== id);
    save('Item removido.');
  });
  $('#modal-submit').textContent = 'Excluir item';
  $('#modal-submit').classList.add('button-danger');
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
  doc.autoTable({ startY: 36, head: [['Ordem', 'Entrada', 'Participantes', 'Música selecionada', 'Posicionamento / observações']], body: data.ceremony.map((c, i) => [String(i + 1).padStart(2, '0'), c.step, c.participants, [c.music, c.artist].filter(Boolean).join(' — '), c.notes || '—']), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15, overflow: 'linebreak' }, headStyles: { fillColor: [69, 91, 75], textColor: 255, fontStyle: 'bold' }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 45 }, 2: { cellWidth: 52 }, 3: { cellWidth: 62 } } });
  let y = (doc.lastAutoTable?.finalY || 40) + 9; if (y > 160) { doc.addPage(); y = 20; }
  doc.setFillColor(241, 244, 239); doc.roundedRect(14, y, 269, 29, 2, 2, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(48, 69, 54); doc.text('Orientações para os Padrinhos e Auxiliares', 19, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(55); doc.text(['• Evitem levar celular e chaves nos bolsos durante a cerimônia.', '• Caminhem em ritmo tranquilo, mantendo espaço entre os casais.', '• Sigam o posicionamento combinado e cumprimentem os noivos com calma no altar.'], 19, y + 14, { lineHeightFactor: 1.4 });
  pdfFooter(doc); doc.save('roteiro-cerimonia.pdf'); notify('Roteiro da cerimônia exportado em PDF.');
}
function exportCeremonialPdf() {
  const doc = pdfBase('Cronograma da cerimonial'); if (!doc) return;
  pdfHeading(doc, 'Cronograma da cerimonial — Dia D', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(55); doc.text(`Início da cerimônia: ${data.wedding.time || '11:30'}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Horário', 'Atividade', 'Responsável', 'Orientações', 'Status']], body: [...data.ceremonial].sort((a, b) => a.time.localeCompare(b.time)).map(item => [item.time, item.title, item.responsible || 'A definir', item.details || '—', item.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15, overflow: 'linebreak' }, headStyles: { fillColor: [69, 91, 75], textColor: 255, fontStyle: 'bold' }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: 62 }, 2: { cellWidth: 48 }, 4: { cellWidth: 28 } } });
  pdfFooter(doc); doc.save('cronograma-cerimonial-dia-d.pdf'); notify('Cronograma da cerimonial exportado em PDF.');
}
function exportFinancePdf() {
  const doc = pdfBase('Relatório financeiro e orçamento'); if (!doc) return;
  pdfHeading(doc, 'Relatório financeiro', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  const paid = data.expenses.reduce((sum, e) => sum + Number(e.paid || 0), 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45); doc.text(`Total orçado: ${money(planned())}     Total pago: ${money(paid)}     Saldo pendente: ${money(Math.max(0, planned() - paid))}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Categoria', 'Fornecedor / item', 'Valor previsto', 'Valor pago', 'Status']], body: data.expenses.map(e => [e.category, e.description, money(e.planned), money(e.paid), e.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [69, 91, 75], textColor: 255 }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 80 }, 2: { halign: 'right' }, 3: { halign: 'right' } } });
  pdfFooter(doc); doc.save('relatorio-financeiro.pdf'); notify('Relatório financeiro exportado em PDF.');
}
function exportChecklistPdf() {
  const doc = pdfBase('Checklist e cronograma do Dia D'); if (!doc) return;
  pdfHeading(doc, 'Checklist físico para o Dia D', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  doc.autoTable({ startY: 36, head: [['', 'Categoria', 'Item', 'Quantidade / observação', 'Status']], body: data.supplies.map(s => ['', s.category, s.name, s.quantity || '', s.status]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [69, 91, 75], textColor: 255 }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 58 }, 2: { cellWidth: 74 }, 3: { cellWidth: 72 } }, didDrawCell: data => { if (data.section === 'body' && data.column.index === 0) { doc.setDrawColor(90); doc.rect(data.cell.x + 3, data.cell.y + 2.5, 4, 4); } } });
  doc.addPage(); pdfHeading(doc, 'Cronograma e responsáveis', `${data.wedding.couple}  •  Dia da montagem e cerimônia`);
  doc.autoTable({ startY: 36, head: [['Dia', 'Horário', 'Tarefa', 'Responsável', 'Detalhes / andamento']], body: [...data.tasks].sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time)).map(t => [t.day, t.time || '—', t.title, t.responsible || 'A definir', [t.description, t.status].filter(Boolean).join(' · ')]), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15 }, headStyles: { fillColor: [69, 91, 75], textColor: 255 }, rowPageBreak: 'avoid' });
  pdfFooter(doc); doc.save('checklist-e-cronograma.pdf'); notify('Checklist e cronograma exportados em PDF.');
}
function exportTimelinePdf() {
  const doc = pdfBase('Cronograma do casamento'); if (!doc) return;
  pdfHeading(doc, 'Cronograma do casamento', `${data.wedding.couple}  •  ${dateLabel(data.wedding.date)}  •  ${data.wedding.venue}`);
  const completed = data.tasks.filter(task => task.status === 'Concluído').length;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(55);
  doc.text(`Tarefas: ${data.tasks.length}     Concluídas: ${completed}     Em aberto: ${data.tasks.length - completed}`, 14, 39);
  doc.autoTable({ startY: 46, head: [['Dia', 'Horário', 'Tarefa', 'Responsável', 'Detalhes', 'Andamento']], body: [...data.tasks].sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time)).map(task => [task.day, task.time || '—', task.title, task.responsible || 'A definir', task.description || '—', task.status || 'A Fazer']), theme: 'grid', margin: { left: 14, right: 14, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [205, 211, 205], lineWidth: .15, overflow: 'linebreak' }, headStyles: { fillColor: [69, 91, 75], textColor: 255, fontStyle: 'bold' }, rowPageBreak: 'avoid', columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 19 }, 2: { cellWidth: 55 }, 3: { cellWidth: 42 }, 5: { cellWidth: 27 } } });
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
    if (action === 'delete-guest') deleteRecord('guests', id, 'este convite');
    if (action === 'delete-expense') deleteRecord('expenses', id, 'este gasto');
    if (action === 'delete-ceremony') deleteRecord('ceremony', id, 'esta etapa');
    if (action === 'delete-ceremonial') deleteRecord('ceremonial', id, 'este horário');
    if (action === 'delete-supply') deleteRecord('supplies', id, 'este item');
    if (action === 'delete-task') deleteRecord('tasks', id, 'esta tarefa');
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
  $('#page-content').querySelectorAll('[data-task-check]').forEach(input => input.addEventListener('change', () => { const task = data.tasks.find(t => t.id === input.dataset.taskCheck); if (task) { task.status = input.checked ? 'Concluído' : 'A Fazer'; animateStatusChange(input, input.checked ? 'Tarefa concluída.' : 'Tarefa reaberta.', input.checked); } }));
  $('#page-content').querySelectorAll('[data-supply-check]').forEach(input => input.addEventListener('change', () => { const item = data.supplies.find(s => s.id === input.dataset.supplyCheck); if (item) { item.status = input.checked ? 'No Local' : 'Pendente'; animateStatusChange(input, input.checked ? 'Item chegou ao local.' : 'Item voltou para pendente.', input.checked); } }));
  $('#page-content').querySelectorAll('[data-task-status]').forEach(select => select.addEventListener('change', () => { const task = data.tasks.find(t => t.id === select.dataset.taskStatus); if (task) { task.status = select.value; animateStatusChange(select, 'Status da tarefa atualizado.', select.value === 'Concluído'); } }));
  $('#page-content').querySelectorAll('[data-supply-status]').forEach(select => select.addEventListener('change', () => { const item = data.supplies.find(s => s.id === select.dataset.supplyStatus); if (item) { item.status = select.value; animateStatusChange(select, 'Checklist atualizado.', select.value === 'No Local'); } }));
  $('#page-content').querySelectorAll('[data-ceremonial-status]').forEach(select => select.addEventListener('change', () => { const item = data.ceremonial.find(s => s.id === select.dataset.ceremonialStatus); if (item) { item.status = select.value; animateStatusChange(select, 'Cronograma da cerimonial atualizado.', select.value === 'Concluído'); } }));
  $('#page-content').querySelectorAll('[data-collapse]').forEach(head => head.addEventListener('click', event => { if (event.target.closest('button')) return; head.parentElement.classList.toggle('collapsed'); }));
  $('#guest-filter')?.addEventListener('change', e => { guestFilter = e.target.value; render(); });
  $('#guest-search')?.addEventListener('input', e => { const pos = e.target.selectionStart; guestSearch = e.target.value; render(); const input = $('#guest-search'); input.focus(); input.setSelectionRange(pos, pos); });
  $('#expense-filter')?.addEventListener('change', e => { expenseFilter = e.target.value; render(); });
}

document.querySelectorAll('.nav-item[data-page]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)));
$('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
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
$('#today-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
$('#auth-toggle').addEventListener('click', () => {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  $('#auth-heading').textContent = authMode === 'signin' ? 'Acesse seu planejamento' : 'Crie sua conta';
  $('#auth-description').textContent = authMode === 'signin' ? 'Entre com sua conta para acessar os dados em qualquer dispositivo.' : 'Use a mesma conta nos dispositivos que vão compartilhar este planejamento.';
  $('#auth-submit').textContent = authMode === 'signin' ? 'Entrar' : 'Criar conta';
  $('#auth-toggle').textContent = authMode === 'signin' ? 'Criar uma conta' : 'Já tenho uma conta';
  $('#auth-password').autocomplete = authMode === 'signin' ? 'current-password' : 'new-password';
  $('#auth-error').textContent = '';
});
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const button = $('#auth-submit');
  button.disabled = true;
  $('#auth-error').textContent = '';
  try {
    if (authMode === 'signup') await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    const messages = {
      'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Entre nela.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/invalid-email': 'Digite um e-mail válido.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
      'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente novamente.',
      'auth/operation-not-allowed': 'Ative o método E-mail/Senha em Authentication no Firebase Console.',
    };
    $('#auth-error').textContent = messages[error.code] || 'Não foi possível entrar. Confira as configurações do Firebase.';
  } finally { button.disabled = false; }
});
$('#sign-out')?.addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, async user => {
  if (stopRealtime) { stopRealtime(); stopRealtime = null; }
  activeUser = user;
  if (!user) {
    $('#app-shell').hidden = true;
    $('#auth-panel').hidden = false;
    return;
  }
  $('#auth-panel').hidden = true;
  $('#app-shell').hidden = false;
  const plannerRef = doc(db, 'planners', user.uid);
  try {
    const saved = await getDoc(plannerRef);
    if (saved.exists()) data = normalizeData(saved.data().data);
    else {
      data = loadData();
      await setDoc(plannerRef, { data, updatedAt: serverTimestamp() });
      localStorage.removeItem(STORAGE_KEY);
    }
    render();
    updateProgress();
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
  return Object.fromEntries(Object.entries(defaultData).map(([key, value]) => [
    key,
    key === 'wedding' ? { ...structuredClone(value), ...(saved.wedding || {}) } : saved[key] ?? structuredClone(value),
  ]));
}
setInterval(updateCountdown, 1000);
