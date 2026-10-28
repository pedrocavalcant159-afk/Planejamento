// Cerimonialista virtual: checklist por prazo, alertas do painel e respostas às perguntas do casal.
// Só calcula a partir dos dados do planejamento; quem desenha as telas é o app.js.
import { TOPICS, SECTION_INTROS, STAGE_FLOW, dayModel } from './wedding-kb.js';

export const WEDDING_STYLES = ['Romântico', 'Clássico', 'Rústico', 'Praia', 'Campo / sítio', 'Minimalista', 'Boho', 'Mini wedding'];
export const CEREMONY_TYPES = ['Religiosa', 'Religiosa com efeito civil', 'Civil', 'Simbólica'];
export const VENDOR_STATUSES = ['Pesquisando', 'Orçando', 'Orçamento recebido', 'Negociando', 'Contratado', 'Descartado'];

// Divisão sugerida do orçamento (referência de mercado; o casal ajusta no financeiro).
export const BUDGET_SPLIT = { 'Comidas & Buffet': .38, 'Local / Espaço / Sítio': .15, 'Decoração & Cenografia': .12, Audiovisual: .1, 'Trajes & Beleza': .09, 'Banda & DJ': .07, Outros: .09 };

// months: quantos meses antes do casamento (0.25 = uma semana). hire: categoria que fica resolvida ao contratar.
const TEMPLATE = [
  { key: 'orcamento', months: 12, title: 'Definir o orçamento total do casamento', done: d => Number(d.wedding.budget) > 0 },
  { key: 'lista-previa', months: 12, title: 'Fazer a lista prévia de convidados', done: d => d.guests.length >= 10 },
  { key: 'local', months: 12, title: 'Escolher e reservar o local', hire: 'Local / Espaço / Sítio' },
  { key: 'buffet', months: 11, title: 'Contratar o buffet', hire: 'Comidas & Buffet' },
  { key: 'audiovisual', months: 10, title: 'Contratar fotografia e filmagem', hire: 'Audiovisual' },
  { key: 'musica', months: 10, title: 'Contratar banda ou DJ', hire: 'Banda & DJ' },
  { key: 'decoracao', months: 9, title: 'Contratar a decoração', hire: 'Decoração & Cenografia' },
  { key: 'padrinhos', months: 9, title: 'Escolher padrinhos e madrinhas' },
  { key: 'vestido', months: 8, title: 'Escolher o vestido da noiva', hire: 'Trajes & Beleza' },
  { key: 'save-the-date', months: 8, title: 'Enviar o save the date' },
  { key: 'lua-de-mel', months: 7, title: 'Reservar a viagem de lua de mel' },
  { key: 'presentes', months: 6, title: 'Montar a lista de presentes' },
  { key: 'bolo', months: 6, title: 'Contratar bolo e doces' },
  { key: 'beleza', months: 6, title: 'Contratar cabelo e maquiagem' },
  { key: 'noivo', months: 5, title: 'Escolher o traje do noivo' },
  { key: 'musicas', months: 5, title: 'Definir as músicas da cerimônia', done: d => d.ceremony.some(c => c.music) },
  { key: 'aliancas', months: 4, title: 'Comprar as alianças' },
  { key: 'convites', months: 4, title: 'Encomendar convites e papelaria' },
  { key: 'igreja', months: 4, title: 'Agendar curso de noivos e documentos da igreja', only: d => /Religiosa/.test(d.wedding.ceremonyType || '') },
  { key: 'cartorio', months: 3, title: 'Dar entrada na habilitação de casamento no cartório', only: d => /civil|Civil/.test(d.wedding.ceremonyType || '') },
  { key: 'plano-b', months: 3, title: 'Definir o plano B para chuva e vento', only: d => /Praia|Campo|Rústico|Boho/.test(d.wedding.style || '') },
  { key: 'praia', months: 3, title: 'Pedir autorização para uso da praia', only: d => d.wedding.style === 'Praia' },
  { key: 'degustacao', months: 3, title: 'Fazer a degustação do buffet' },
  { key: 'enviar-convites', months: 3, title: 'Enviar os convites' },
  { key: 'teste-beleza', months: 2, title: 'Fazer o teste de cabelo e maquiagem' },
  { key: 'prova', months: 2, title: 'Fazer a prova do vestido' },
  { key: 'lembrancinhas', months: 2, title: 'Definir as lembrancinhas' },
  { key: 'manobrista', months: 2, title: 'Contratar manobrista e segurança', only: d => Number(d.wedding.guestsExpected) > 120 },
  { key: 'rsvp', months: 1.5, title: 'Cobrar a confirmação dos convidados', done: d => d.guests.length > 0 && !d.guests.some(g => ['Pendente', 'Enviado'].includes(g.status)) },
  { key: 'cronograma-dia', months: 1, title: 'Montar o cronograma do dia com os fornecedores', done: d => d.ceremonial.length >= 5 },
  { key: 'numero-final', months: 1, title: 'Fechar o número final de convidados com o buffet' },
  { key: 'quitar', months: 1, title: 'Quitar os pagamentos pendentes' },
  { key: 'ultima-prova', months: .5, title: 'Fazer a última prova do vestido' },
  { key: 'kit', months: .5, title: 'Montar o kit de emergência do dia do casamento' },
  { key: 'confirmar-fornecedores', months: .25, title: 'Confirmar horários com todos os fornecedores' },
  { key: 'documentos', months: .25, title: 'Separar documentos, alianças e trajes' },
];

/* Datas ---------------------------------------------------------------------- */
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = value => new Date(`${value}T12:00:00`);
export const todayIso = () => iso(new Date());
export function monthsBefore(wedding, months) {
  const d = parse(wedding);
  if (months >= 1) d.setMonth(d.getMonth() - Math.round(months));
  else d.setDate(d.getDate() - Math.round(months * 30));
  return iso(d);
}
const plusDays = (value, n) => { const d = parse(value); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dayMonth = value => parse(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/* Contratações --------------------------------------------------------------- */
// Uma categoria está resolvida quando há fornecedor contratado ou gasto lançado nela.
export const hired = (d, category) => (d.vendors || []).some(v => v.category === category && v.status === 'Contratado') || d.expenses.some(e => e.category === category && Number(e.planned) > 0);
export const vendorFinal = v => Math.max(0, Number(v.price || 0) - Number(v.discount || 0) + Number(v.fees || 0));

/* Checklist do casamento ---------------------------------------------------- */
export function checklist(d, today = todayIso()) {
  if (!d.wedding.date) return [];
  return TEMPLATE.filter(item => !item.only || item.only(d)).map(item => {
    const due = monthsBefore(d.wedding.date, item.months);
    const task = d.tasks.find(t => t.templateKey === item.key);
    const done = task?.status === 'Concluído' || (item.hire ? hired(d, item.hire) : false) || (item.done ? item.done(d) : false);
    return { ...item, due, task, done, added: Boolean(task), late: !done && due < today };
  }).sort((a, b) => a.due.localeCompare(b.due));
}

/* Parcelas ------------------------------------------------------------------ */
export function installments(d) {
  return d.expenses.flatMap(e => (e.installments || []).map(p => ({ ...p, expense: e })));
}

/* Alertas do painel --------------------------------------------------------- */
// level: danger | warn | info | ok. page: aba que resolve o alerta.
export function alerts(d, today = todayIso()) {
  const list = [];
  const parts = installments(d).filter(p => !p.paid);
  const late = parts.filter(p => p.due && p.due < today), soon = parts.filter(p => p.due && p.due >= today && p.due <= plusDays(today, 7));
  if (late.length) list.push({ level: 'danger', page: 'financeiro', title: `${late.length} ${late.length === 1 ? 'parcela vencida' : 'parcelas vencidas'}`, text: `${money(late.reduce((n, p) => n + Number(p.amount || 0), 0))} · ${late.slice(0, 2).map(p => `${p.expense.description} (${dayMonth(p.due)})`).join(', ')}` });
  if (soon.length) list.push({ level: 'warn', page: 'financeiro', title: `${soon.length} ${soon.length === 1 ? 'parcela vence' : 'parcelas vencem'} nos próximos 7 dias`, text: soon.slice(0, 3).map(p => `${p.expense.description}: ${money(p.amount)} em ${dayMonth(p.due)}`).join(' · ') });
  const items = checklist(d, today);
  const hireLate = items.filter(i => i.hire && !i.done && i.due < today), hireSoon = items.filter(i => i.hire && !i.done && i.due >= today && i.due <= plusDays(today, 30));
  hireLate.forEach(i => list.push({ level: 'danger', page: 'fornecedores', title: `Já passou da hora: ${i.title.toLowerCase()}`, text: `O ideal era até ${dayMonth(i.due)}. Cadastre os orçamentos e compare.` }));
  hireSoon.forEach(i => list.push({ level: 'warn', page: 'fornecedores', title: `Está na hora: ${i.title.toLowerCase()}`, text: `Prazo sugerido: ${dayMonth(i.due)}.` }));
  const overdue = d.tasks.filter(t => t.status !== 'Concluído' && t.date && t.date < today);
  const who = t => (t.responsible ? ` (${t.responsible})` : '');
  if (overdue.length) list.push({ level: 'warn', page: 'cronograma', title: `${overdue.length} ${overdue.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`, text: overdue.slice(0, 3).map(t => `${t.title}${who(t)}`).join(' · ') });
  const ending = d.tasks.filter(t => t.status !== 'Concluído' && t.date && t.date >= today && t.date <= plusDays(today, 3)).sort((a, b) => a.date.localeCompare(b.date));
  if (ending.length) list.push({ level: 'warn', page: 'cronograma', title: `${ending.length} ${ending.length === 1 ? 'tarefa com prazo acabando' : 'tarefas com prazo acabando'}`, text: ending.slice(0, 3).map(t => `${t.title}${who(t)}: ${t.date === today ? 'hoje' : t.date === plusDays(today, 1) ? 'amanhã' : dayMonth(t.date)}`).join(' · ') });
  // Presentes ganhos não pesam no orçamento do casal.
  const budget = Number(d.wedding.budget || 0), total = d.expenses.reduce((n, e) => n + (e.status === 'Presente Ganho' ? 0 : Number(e.planned || 0)), 0);
  if (budget && total > budget) list.push({ level: 'danger', page: 'financeiro', title: 'O orçado passou do orçamento máximo', text: `${money(total)} orçados para ${money(budget)} de limite (${money(total - budget)} acima).` });
  else if (budget && total > budget * .9) list.push({ level: 'warn', page: 'financeiro', title: 'Orçamento quase no limite', text: `${Math.round(total / budget * 100)}% do orçamento máximo já está comprometido.` });
  const waiting = d.guests.filter(g => ['Pendente', 'Enviado'].includes(g.status));
  if (d.wedding.date && waiting.length && daysBetween(today, d.wedding.date) <= 60 && d.wedding.date >= today) list.push({ level: 'warn', page: 'convidados', title: `${waiting.length} ${waiting.length === 1 ? 'convidado ainda não respondeu' : 'convidados ainda não responderam'}`, text: 'Faltam menos de 2 meses. Vale cobrar as confirmações.' });
  const quotes = (d.vendors || []).filter(v => v.status === 'Orçamento recebido');
  if (quotes.length) list.push({ level: 'info', page: 'fornecedores', title: `${quotes.length} ${quotes.length === 1 ? 'orçamento esperando' : 'orçamentos esperando'} decisão`, text: 'Compare lado a lado e marque o escolhido como contratado.' });
  if (d.wedding.date && !items.some(i => i.added)) list.push({ level: 'info', page: 'cronograma', action: 'generate-checklist', title: 'Seu checklist do casamento está pronto', text: `${items.length} etapas organizadas mês a mês até o grande dia. Toque para adicionar ao cronograma.` });
  if (!d.wedding.date) list.push({ level: 'info', action: 'edit-wedding', title: 'Defina a data do casamento', text: 'Com a data, eu monto o checklist e os prazos de cada contratação.' });
  if (!budget) list.push({ level: 'info', action: 'edit-wedding', title: 'Defina o orçamento máximo', text: 'Assim eu sugiro quanto gastar em cada categoria.' });
  return list.length ? list : [{ level: 'ok', title: 'Tudo em dia ♡', text: 'Nenhuma pendência urgente agora. Aproveite essa fase!' }];
}

/* Perguntas à cerimonialista ----------------------------------------------- */
// Sem IA: reconhece a intenção pela frase e responde com os dados do casamento.
// Resposta: { title, intro, lines, follow (próximas perguntas), go ({ page, label }) }.
export const QUESTIONS = ['O que eu faço agora?', 'Cronograma do dia do casamento', 'O que ainda preciso contratar?', 'Quanto posso gastar com cada categoria?', 'Quais tarefas devo fazer este mês?', 'Quanto falta pagar?', 'Quais são os próximos vencimentos?', 'Como estão as confirmações?'];
const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pick = (list, seed) => list[Math.abs([...seed].reduce((n, c) => n + c.charCodeAt(0), 0)) % list.length];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const daysLeft = (d, today) => (d.wedding.date ? daysBetween(today, d.wedding.date) : null);

// Os próximos passos mais importantes agora, em ordem de urgência.
function nextSteps(d, today, limit = 3) {
  const steps = [];
  if (!d.wedding.date) steps.push({ text: 'Definir a data do casamento. Com ela eu monto o checklist e os prazos de tudo.', go: null });
  const parts = installments(d).filter(p => !p.paid && p.due), late = parts.filter(p => p.due < today), soon = parts.filter(p => p.due >= today && p.due <= plusDays(today, 7));
  if (late.length) steps.push({ text: `Pagar ${late.length === 1 ? 'a parcela vencida' : `as ${late.length} parcelas vencidas`}: ${late.slice(0, 2).map(p => `${p.expense.description} (${money(p.amount)})`).join(', ')}.`, go: 'financeiro' });
  const overdue = d.tasks.filter(t => t.status !== 'Concluído' && t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date));
  if (overdue.length) steps.push({ text: `Resolver ${overdue.length === 1 ? 'a tarefa atrasada' : `as tarefas atrasadas, começando por`} "${overdue[0].title}" (era para ${dayMonth(overdue[0].date)}).`, go: 'cronograma' });
  const items = checklist(d, today).filter(i => !i.done);
  items.filter(i => i.hire && i.late).slice(0, 2).forEach((i, n) => steps.push({ text: `${i.title} — o ideal era até ${dayMonth(i.due)}.${n ? '' : ' Peça 2 ou 3 orçamentos esta semana.'}`, go: 'fornecedores' }));
  if (soon.length) steps.push({ text: `Separar ${money(soon.reduce((n, p) => n + Number(p.amount || 0), 0))} para ${soon.length === 1 ? 'a parcela que vence' : 'as parcelas que vencem'} nos próximos 7 dias.`, go: 'financeiro' });
  if (!Number(d.wedding.budget)) steps.push({ text: 'Definir o orçamento máximo. Assim eu digo quanto gastar em cada categoria.', go: null });
  if (!d.guests.length) steps.push({ text: 'Começar a lista de convidados, nem que seja só a família por enquanto. Ela define o tamanho do local e do buffet.', go: 'convidados' });
  items.filter(i => !i.late).slice(0, 3).forEach(i => steps.push({ text: `${i.title} (prazo sugerido: ${dayMonth(i.due)}).`, go: i.hire ? 'fornecedores' : 'cronograma' }));
  const seen = new Set();
  return steps.filter(s => !seen.has(s.text) && seen.add(s.text)).slice(0, limit);
}

function phaseTip(left) {
  if (left === null) return 'Assim que a data estiver definida, eu te digo em que fase do planejamento vocês estão.';
  if (left < 0) return 'O casamento já aconteceu. Que tal guardar as fotos e os contratos em Documentos?';
  if (left === 0) return 'É hoje! Respire, delegue e aproveite. A equipe tem o roteiro na Central do dia do casamento.';
  if (left <= 30) return 'Reta final: é hora de confirmar horários com os fornecedores, fechar o número de convidados e quitar os pagamentos.';
  if (left <= 120) return 'Fase dos detalhes: convites, provas do vestido, músicas da cerimônia e degustação.';
  if (left <= 270) return 'Fase dos fornecedores: decoração, trajes, bolo e doces, cabelo e maquiagem.';
  return 'Fase das grandes escolhas: local, buffet, fotografia e música. Quem reserva cedo consegue as melhores datas e preços.';
}

// Momento do casal com o assunto ("tô olhando", "já fechei"...) e a parte pedida ("e o contrato?").
const STAGES = [
  ['contratado', /\b(fechei|fechamos|contratei|contratamos|assinei|assinamos|reservei|reservamos|comprei|compramos|escolhi|escolhemos)\b|ja (tenho|temos|esta fechad|ta fechad|e nosso)/],
  ['fechando', /\bfechar\b|fechando|assinar|negoci|desconto|\bsinal\b/],
  ['olhando', /olhando|vendo|pesquis|de olho|procurando|cotando|orcando|orcamento|pedindo|comparando|achei|encontrei|gostei|visit|conhecendo|conversando|falando com|entrevist|em duvida|entre dois|entre 2|indecis|opcoes/],
  ['preco', /quanto custa|preco|valor|media de|caro|barato|gastar|quanto (cobra|sai|fica)/],
];
const SECTION_WORDS = [
  ['contract', /contrato|clausula/], ['ask', /pergunt/], ['compare', /compar/], ['alert', /alerta|cuidado|golpe|evitar|furada|errar|erro/],
  ['start', /por onde comec|como escolher|primeiro passo/], ['after', /depois de (fechar|contratar)|e agora que|o que alinhar|alinhar/], ['price', /quanto custa|preco|quanto (cobra|sai|fica)/],
];
const MORE_RE = /^(e )?(mais|outra|outras|continua|continue|e depois|o que mais|mais alguma|tem mais|me fala mais|conta mais|e ai)\b|mais dica|outras dica|outra dica|mais coisa|algo mais|que mais/;
const DAY_RE = /cronograma do (dia|casamento)|roteiro do dia|horarios? do (dia|casamento)|como (funciona|e|sera|vai ser) o dia|programacao do|timeline|sequencia do|modelo de cronograma|cronograma pronto|cronograma de casamento|ordem dos acontecimentos|que horas (comeca|termina)|horario de cada coisa/;

function sectionsOf(t) { return ['start', 'ask', 'compare', 'alert', 'contract', 'after', 'price', 'more'].filter(s => (t[s] || []).length); }

function topicStatus(t, d, today, skipBudget = false) {
  const item = t.checklist ? checklist(d, today).find(i => i.key === t.checklist) : null, budget = Number(d.wedding.budget || 0);
  const vendors = t.category ? (d.vendors || []).filter(v => v.category === t.category && v.status !== 'Descartado') : [];
  const out = [];
  if (item && !item.done) out.push(item.late ? `Pelo calendário ideal isso seria até ${dayMonth(item.due)}, então vale priorizar.` : `No seu calendário o prazo sugerido é ${dayMonth(item.due)}.`);
  if (vendors.length) out.push(`Você já tem ${vendors.map(v => `${v.name} (${v.status.toLowerCase()})`).join(', ')} em Fornecedores.`);
  if (!skipBudget && t.category && budget && BUDGET_SPLIT[t.category] && !item?.done) out.push(`Pela divisão do seu orçamento, dá para reservar até ${money(budget * BUDGET_SPLIT[t.category])}.`);
  return out.join(' ');
}

function topicReply(t, { stage, section, more }, d, today, memory) {
  const shown = new Set(memory.topic === t.key ? memory.shown || [] : []);
  const all = sectionsOf(t);
  const flowStage = stage || (memory.topic === t.key ? memory.stage : null) || 'inicio';
  const flow = (all.includes('ask') ? STAGE_FLOW[flowStage] : ['start', 'more']).filter(s => all.includes(s));
  let pickSection = section && all.includes(section) ? section : flow.find(s => !shown.has(s)) || all.find(s => !shown.has(s));
  const name = t.title.toLowerCase();
  const nextMemory = { topic: t.key, stage: flowStage, shown: [...shown], statusShown: memory.topic === t.key ? memory.statusShown : false };
  if (!pickSection) {
    return { title: t.title, intro: `Já te passei tudo o que eu sei sobre ${name} ♡ Se quiser, posso te ajudar com outra parte do casamento.`, lines: [], go: t.go ? { page: t.go, label: 'Abrir' } : null, follow: ['O que eu faço agora?', 'Cronograma do dia do casamento', 'Ordem de entrada na cerimônia'], memory: nextMemory };
  }
  nextMemory.shown = [...shown, pickSection];
  const openers = {
    olhando: [`Que bom que já está de olho ${t.who.replace(/^(o|a|os|as) /, 'n$1 ')}!`, 'Ótimo, pesquisar com calma faz toda a diferença.', 'Boa! Essa é a fase mais importante para escolher bem.'],
    contratado: ['Que notícia boa! ♡', 'Uhul, menos uma! ♡', 'Que bom, isso tira um peso ♡'],
    fechando: ['Hora de fechar, então.', 'Quase lá!'],
  };
  const parts = [];
  if (stage && openers[stage] && !more) parts.push(pick(openers[stage], d.wedding.couple + t.key + stage));
  if (!nextMemory.statusShown && stage !== 'contratado') { const status = topicStatus(t, d, today, pickSection === 'price'); if (status) parts.push(status); nextMemory.statusShown = true; }
  const hiredHere = t.category && (d.vendors || []).some(v => v.category === t.category && v.status === 'Contratado');
  if (stage === 'contratado' && t.category && !hiredHere) parts.push('Marque como Contratado em Fornecedores para as parcelas entrarem no financeiro.');
  parts.push(SECTION_INTROS[pickSection]);
  let lines = [...t[pickSection]];
  if (pickSection === 'price' && t.category && Number(d.wedding.budget) && BUDGET_SPLIT[t.category]) {
    const value = Number(d.wedding.budget) * BUDGET_SPLIT[t.category], guests = Number(d.wedding.guestsExpected || 0);
    lines.unshift(`Pelo seu orçamento, a sugestão é até ${money(value)}${t.key === 'buffet' && guests ? ` (uns ${money(value / guests)} por convidado)` : ''}.`);
  }
  const left = flow.filter(s => !nextMemory.shown.includes(s));
  const chip = { start: `Por onde começar com ${name}?`, ask: `O que perguntar para ${t.who}?`, compare: `Como comparar os orçamentos de ${name}?`, alert: `Que cuidados tomar com ${t.who}?`, contract: `O que conferir no contrato ${t.who.replace(/^o /, 'do ').replace(/^a /, 'da ').replace(/^os /, 'dos ').replace(/^as /, 'das ')}?`, after: `Já fechei ${t.who.replace(/^(o|a|os|as) /, 'com $1 ')}`, price: `Quanto custa ${name}?`, more: `Mais dicas sobre ${name}` };
  const follow = [...left.slice(0, 2).map(s => chip[s]), ...(left.length ? [] : ['O que eu faço agora?'])];
  if (stage !== 'contratado' && all.includes('after') && !nextMemory.shown.includes('after') && !follow.includes(chip.after)) follow.push(chip.after);
  const reply = { title: t.title, intro: parts.join(' '), lines, go: t.go ? { page: stage === 'contratado' && t.category ? 'fornecedores' : t.go, label: 'Abrir' } : null, follow: follow.slice(0, 3), memory: nextMemory };
  if (t.message) Object.assign(reply, { lines: [...lines, `Mensagem pronta: "${t.message}"`], action: { type: 'copy', label: 'Copiar mensagem', text: t.message } });
  return reply;
}

function dayTimelineReply(d, memory) {
  const model = dayModel(d.wedding);
  return {
    title: 'Cronograma do dia do casamento',
    intro: `Este é o formato que costuma funcionar para ${model.name}${model.guessed ? `. Considerei a cerimônia às ${model.ceremony}; ajuste o horário em "Detalhes do casamento"` : `, com a cerimônia às ${model.ceremony}`}. Dá para levar para o Cerimonial e ajustar cada horário:`,
    lines: model.rows.map(r => `${r.time} · ${r.title}${r.track !== 'Geral' ? ` · ${r.track.toLowerCase()}` : ''}`),
    action: { type: 'import-timeline', label: 'Usar no Cerimonial', rows: model.rows },
    go: { page: 'cerimonial', label: 'Abrir' },
    follow: ['Ordem de entrada na cerimônia', 'Dicas de plano B para chuva'],
    memory: { ...memory, topic: null },
  };
}

// memory: o que já foi conversado (assunto atual e partes mostradas). Volta atualizada em reply.memory.
export function answer(question, d, today = todayIso(), memory = {}) {
  const reply = respond(question, d, today, memory);
  return { ...reply, memory: reply.memory || memory };
}

function respond(question, d, today, memory) {
  const q = plain(question).replace(/[?!.,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  const has = re => re.test(q);
  const budget = Number(d.wedding.budget || 0), left = daysLeft(d, today);
  const categories = [...new Set([...Object.keys(BUDGET_SPLIT), ...d.expenses.map(e => e.category)])];
  const plannedIn = c => d.expenses.filter(e => e.category === c).reduce((n, e) => n + (e.status === 'Presente Ganho' ? 0 : Number(e.planned || 0)), 0);
  const asked = categories.find(c => plain(c).split(/[^a-z]+/).some(w => w.length > 3 && q.includes(w)));
  const steps = () => nextSteps(d, today);
  const stepLines = list => list.map((s, i) => `${i + 1}. ${s.text}`);
  const firstGo = list => { const s = list.find(x => x.go); return s ? { page: s.go, label: 'Começar por aqui' } : null; };

  if (!q) return { title: 'Pode perguntar ♡', intro: 'Escreva do seu jeito, como se estivesse falando comigo.', lines: [], follow: QUESTIONS.slice(0, 4) };

  if (has(/^(obrigad|brigad|valeu|vlw|amei|perfeito|otimo|show|top|ajudou)/)) {
    return { title: pick(['Imagina! ♡', 'Por nada! ♡', 'Que bom que ajudou ♡'], q), intro: 'Estou por aqui sempre que precisar. Quer ver mais alguma coisa?', lines: [], follow: ['O que eu faço agora?', 'Como está o planejamento?', 'Quanto falta pagar?'] };
  }

  if (has(/ansios|nervos|estress|cansad|exaust|desesper|medo|chorar|chorando|sobrecarreg|surt|pirando|preocupad|triste|desanim|nao aguento|muita coisa|travad/)) {
    const list = steps().slice(0, 2);
    return { title: 'Calma, vocês não estão sozinhos nisso ♡', intro: `É normal sentir isso${left > 0 ? `, ainda mais com ${left} ${left === 1 ? 'dia' : 'dias'} pela frente` : ''}. Não precisa resolver tudo hoje. Se fizer só isto, já está ótimo:`, lines: stepLines(list), go: firstGo(list), follow: ['Como está o planejamento?', 'O que ainda preciso contratar?'] };
  }

  if (has(DAY_RE)) return dayTimelineReply(d, memory);
  const topic = TOPICS.find(t => t.re.test(q));
  const wantsMore = has(MORE_RE), section = SECTION_WORDS.find(([, re]) => re.test(q))?.[0], stage = STAGES.find(([, re]) => re.test(q))?.[0];
  const flags = { stage, section, more: wantsMore && !stage && !section };
  if (topic && !has(/falta pagar|parcela|vencimento|boleto/)) return topicReply(topic, flags, d, today, memory);
  const current = memory.topic && TOPICS.find(t => t.key === memory.topic);
  if (current && (wantsMore || section || (stage && q.split(' ').length <= 5 && !has(/categoria|cada|total/)))) return topicReply(current, flags, d, today, memory);

  if (has(/perdid|dica|ajud|socorro|por onde|comec|nao sei|proximo passo|proximos passos|o que (eu )?(faco|fazer|devo fazer)|que faco|me orient|me guia|sugest|conselho|prioridade|priorizar|foco|focar|o que falta/) && !topic && !has(/contrat|pagar|vencimento|parcela|convidad/)) {
    const list = steps();
    const intro = list.length ? `Olhei o seu planejamento${left > 0 ? ` (faltam ${left} dias)` : ''}. ${phaseTip(left)} Eu faria nesta ordem:` : 'Olhei tudo e está em dia ♡ Aproveitem para adiantar os detalhes.';
    return { title: pick(['Vamos por partes ♡', 'Deixa comigo ♡', 'Um passo de cada vez ♡'], q), intro, lines: stepLines(list), go: firstGo(list), follow: ['Quais tarefas devo fazer este mês?', 'O que ainda preciso contratar?', 'Como está o planejamento?'] };
  }

  if (has(/^(oi|ola|oie|bom dia|boa tarde|boa noite|e ai|eai|hey|opa|tudo bem)\b/) && q.split(' ').length <= 5) {
    const greet = has(/bom dia/) ? 'Bom dia' : has(/boa tarde/) ? 'Boa tarde' : has(/boa noite/) ? 'Boa noite' : 'Oi';
    const list = steps().slice(0, 1);
    return { title: `${greet}! ♡`, intro: `${left > 0 ? `Faltam ${left} ${left === 1 ? 'dia' : 'dias'} para o casamento. ` : ''}${list.length ? `O mais importante agora: ${list[0].text.charAt(0).toLowerCase()}${list[0].text.slice(1)}` : 'Está tudo em dia por aqui.'} Em que posso ajudar?`, lines: [], go: firstGo(list), follow: ['O que eu faço agora?', 'Como está o planejamento?', 'Quanto falta pagar?'] };
  }

  if (has(/quanto tempo|quantos dias|faltam quantos|falta quanto tempo|dias para o casamento|contagem|quando e o casamento/)) {
    return { title: left === null ? 'Data a definir' : left > 0 ? `Faltam ${left} ${left === 1 ? 'dia' : 'dias'}` : left === 0 ? 'É hoje! ♡' : 'O casamento já aconteceu ♡', intro: phaseTip(left), lines: [], follow: ['O que eu faço agora?', 'Quais tarefas devo fazer este mês?'] };
  }

  if (has(/resumo|como (esta|estou|estamos|ta|anda|vai)|status|andamento|panorama|visao geral|situacao|progresso/) && !has(/convidad|confirm|pagar|contrat|fornecedor|parcela|vencimento/)) {
    const items = checklist(d, today), done = items.filter(i => i.done).length;
    const dueOf = e => (e.status === 'Presente Ganho' ? 0 : Math.max(0, Number(e.planned || 0) - Number(e.paid || 0)));
    const people = list => list.reduce((n, g) => n + 1 + Number(g.companions || 0) + Number(g.children || 0), 0);
    const missing = items.filter(i => i.hire && !i.done).length, open = d.tasks.filter(t => t.status !== 'Concluído').length, late = d.tasks.filter(t => t.status !== 'Concluído' && t.date && t.date < today).length;
    return { title: 'Como está o planejamento', intro: phaseTip(left), lines: [
      ...(left !== null && left >= 0 ? [`Faltam ${left} dias.`] : []),
      ...(items.length ? [`Checklist do casamento: ${done} de ${items.length} etapas resolvidas (${Math.round(done / items.length * 100)}%).`] : []),
      missing ? `Ainda faltam ${missing} ${missing === 1 ? 'contratação principal' : 'contratações principais'}.` : 'Fornecedores principais contratados ♡',
      `${open} ${open === 1 ? 'tarefa em aberto' : 'tarefas em aberto'}${late ? `, ${late} atrasada${late > 1 ? 's' : ''}` : ''}.`,
      `Falta pagar ${money(d.expenses.reduce((n, e) => n + dueOf(e), 0))}${budget ? ` (orçamento máximo de ${money(budget)})` : ''}.`,
      `${plural(people(d.guests.filter(g => g.status === 'Confirmado')), 'pessoa confirmada', 'pessoas confirmadas')} de ${people(d.guests)} na lista.`,
    ], follow: ['O que eu faço agora?', 'O que ainda preciso contratar?', 'Quanto falta pagar?'] };
  }

  if (has(/contrat|fornecedor/)) {
    const missing = checklist(d, today).filter(i => i.hire && !i.done);
    const deciding = (d.vendors || []).filter(v => ['Orçando', 'Orçamento recebido', 'Negociando'].includes(v.status));
    if (!d.wedding.date) return { title: 'Primeiro, a data', intro: 'Defina a data do casamento em "Detalhes do casamento" para eu calcular os prazos de cada contratação.', lines: [], follow: ['O que eu faço agora?'] };
    return { title: missing.length ? 'Ainda falta contratar' : 'Fornecedores principais contratados ♡', intro: missing.length ? (missing.some(i => i.late) ? 'Alguns já passaram do prazo ideal. Comece pelos atrasados:' : 'Está dentro do prazo. Esta é a ordem que eu seguiria:') : 'Agora é cuidar dos detalhes e dos pagamentos.', lines: [
      ...missing.map(i => `${i.title.replace('Contratar ', '').replace('Escolher e reservar ', '').replace(/^o |^a /, '')}: ${i.late ? `atrasado (ideal até ${dayMonth(i.due)})` : `até ${dayMonth(i.due)}`}`),
      ...(deciding.length ? [`Em negociação: ${deciding.map(v => `${v.name} (${v.category})`).join(', ')}.`] : []),
    ], go: { page: 'fornecedores', label: 'Ver fornecedores' }, follow: ['Quanto posso gastar com cada categoria?', 'O que eu faço agora?'] };
  }
  if (has(/gastar|limite|orcamento|categoria|quanto custa|caro|barato|economi/) && !has(/falta|pagar/)) {
    if (!budget) return { title: 'Defina o orçamento máximo', intro: 'Em "Detalhes do casamento", informe o orçamento máximo e o número de convidados. Aí eu divido o valor por categoria.', lines: [], follow: ['O que eu faço agora?'] };
    const rows = (asked ? [asked] : categories.filter(c => BUDGET_SPLIT[c])).map(c => {
      const ideal = budget * (BUDGET_SPLIT[c] || 0), used = plannedIn(c);
      return `${c}: até ${money(ideal)}${used ? ` · orçado ${money(used)}${used > ideal ? ' (acima da sugestão)' : ''}` : ''}`;
    });
    const guests = Number(d.wedding.guestsExpected || 0), over = categories.filter(c => BUDGET_SPLIT[c] && plannedIn(c) > budget * BUDGET_SPLIT[c]);
    const intro = has(/economi|barato|caro/) ? 'Para economizar, o que mais pesa é o número de convidados: cada pessoa a menos reduz buffet, bebida, doces e lembrancinhas. Outras ideias: data fora de sábado, flores da estação e bolo cenográfico.' : over.length ? `Atenção: ${over.join(', ')} ${over.length === 1 ? 'passou' : 'passaram'} da sugestão.` : `Com ${money(budget)} de orçamento, minha sugestão de divisão é esta:`;
    return { title: asked ? `Quanto gastar com ${asked}` : has(/economi|barato|caro/) ? 'Como economizar' : 'Sugestão de divisão do orçamento', intro, lines: [...rows, ...(guests ? [`Referência: ${money(budget / guests)} por convidado (${guests} previstos), considerando o casamento inteiro.`] : [])], go: { page: 'financeiro', label: 'Abrir o financeiro' }, follow: ['Quanto falta pagar?', 'Quais são os próximos vencimentos?'] };
  }
  if (has(/vencimento|parcela|vence|boleto/)) {
    const next = installments(d).filter(p => !p.paid && p.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
    return { title: next.length ? 'Próximos vencimentos' : 'Nenhuma parcela cadastrada', intro: next.length ? (next[0].due < today ? 'Tem parcela vencida. Vale pagar logo para não perder o fornecedor:' : 'Aqui está o que vem por aí:') : 'Ao contratar um fornecedor pela aba Fornecedores, as parcelas entram aqui sozinhas.', lines: next.map(p => `${dayMonth(p.due)}${p.due < today ? ' (vencida)' : ''} · ${p.expense.description}: ${money(p.amount)}`), go: { page: 'financeiro', label: 'Abrir o financeiro' }, follow: ['Quanto falta pagar?'] };
  }
  if (has(/pagar|falta pagar|saldo|devendo|divida|pago|dinheiro/)) {
    const dueOf = e => (e.status === 'Presente Ganho' ? 0 : Math.max(0, Number(e.planned || 0) - Number(e.paid || 0)));
    const total = d.expenses.reduce((n, e) => n + dueOf(e), 0);
    const byCat = categories.map(c => [c, d.expenses.filter(e => e.category === c).reduce((n, e) => n + dueOf(e), 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const monthsToGo = left > 30 ? Math.floor(left / 30) : 0;
    return { title: `Falta pagar ${money(total)}`, intro: !total ? 'Tudo quitado ♡' : monthsToGo ? `Se dividir até o casamento, dá uns ${money(total / monthsToGo)} por mês (${monthsToGo} ${monthsToGo === 1 ? 'mês' : 'meses'}). Por categoria:` : 'Por categoria:', lines: byCat.map(([c, v]) => `${c}: ${money(v)}`), go: { page: 'financeiro', label: 'Abrir o financeiro' }, follow: ['Quais são os próximos vencimentos?', 'Quanto posso gastar com cada categoria?'] };
  }
  if (has(/convidad|confirm|rsvp|presenc|lista de convid|quantas pessoas/)) {
    const count = s => d.guests.filter(g => g.status === s).length;
    const people = list => list.reduce((n, g) => n + 1 + Number(g.companions || 0) + Number(g.children || 0), 0);
    const waiting = count('Enviado') + count('Pendente');
    return { title: 'Confirmações', intro: !d.guests.length ? 'A lista ainda está vazia. Comece pela família e pelos amigos mais próximos; dá para importar as confirmações do site depois.' : waiting && left !== null && left <= 60 ? 'Faltam menos de 2 meses: vale mandar uma mensagem para quem ainda não respondeu.' : 'Assim está a lista:', lines: d.guests.length ? [`${plural(people(d.guests.filter(g => g.status === 'Confirmado')), 'pessoa confirmada', 'pessoas confirmadas')} de ${people(d.guests)} na lista.`, `${plural(count('Enviado'), 'convite enviado', 'convites enviados')} sem resposta e ${plural(count('Pendente'), 'ainda não enviado', 'ainda não enviados')}.`, `${plural(count('Recusado'), 'pessoa não poderá', 'pessoas não poderão')} ir.`, ...(Number(d.wedding.guestsExpected) ? [`Você previu ${d.wedding.guestsExpected} convidados.`] : [])] : [], go: { page: 'convidados', label: 'Ver convidados' }, follow: ['Como está o planejamento?'] };
  }
  if (has(/\bmes\b|tarefa|semana|hoje|amanha/)) {
    const month = today.slice(0, 7);
    const tasks = d.tasks.filter(t => t.status !== 'Concluído' && t.date && t.date.slice(0, 7) <= month).sort((a, b) => a.date.localeCompare(b.date));
    const suggestions = checklist(d, today).filter(i => !i.done && !i.added && i.due.slice(0, 7) <= month);
    const lines = [...tasks.map(t => `${t.date < today ? 'Atrasada · ' : ''}${t.title} (${dayMonth(t.date)})`), ...suggestions.map(i => `Sugestão: ${i.title}`)];
    return { title: lines.length ? 'Para fazer este mês' : 'Mês tranquilo', intro: lines.length ? `São ${lines.length} ${lines.length === 1 ? 'item' : 'itens'}. Comece pelos atrasados:` : 'Nenhuma tarefa marcada para este mês. Que tal adiantar algo das Prioridades?', lines: lines.slice(0, 10), go: { page: 'cronograma', label: 'Abrir o cronograma' }, follow: ['O que eu faço agora?'] };
  }

  if (current) return { title: 'Não entendi direito', intro: `Desculpa, não entendi. Quer continuar falando de ${current.title.toLowerCase()} ou mudar de assunto?`, lines: [], follow: [`Mais dicas sobre ${current.title.toLowerCase()}`, 'O que eu faço agora?', 'Cronograma do dia do casamento'] };
  const list = steps();
  return { title: 'Não entendi direito', intro: `Ainda não sei responder isso${list.length ? ', mas olhando o seu planejamento, eu faria agora:' : '.'} Também posso falar de fornecedores, contrato, cronograma do dia, cortejo, convites, votos e muito mais.`, lines: stepLines(list), go: firstGo(list), follow: ['O que eu faço agora?', 'Cronograma do dia do casamento', 'Ordem de entrada na cerimônia'] };
}
