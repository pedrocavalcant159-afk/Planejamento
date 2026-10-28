// Cerimonialista virtual: checklist por prazo, alertas do painel e respostas às perguntas do casal.
// Só calcula a partir dos dados do planejamento; quem desenha as telas é o app.js.

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
  { key: 'kit', months: .5, title: 'Montar o kit de emergência do Dia D' },
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
  if (overdue.length) list.push({ level: 'warn', page: 'cronograma', title: `${overdue.length} ${overdue.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`, text: overdue.slice(0, 3).map(t => t.title).join(' · ') });
  const budget = Number(d.wedding.budget || 0), total = d.expenses.reduce((n, e) => n + Number(e.planned || 0), 0);
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
export const QUESTIONS = ['O que ainda preciso contratar?', 'Quanto posso gastar com cada categoria?', 'Quais tarefas devo fazer este mês?', 'Quanto falta pagar?', 'Quais são os próximos vencimentos?', 'Como estão as confirmações?'];
const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function answer(question, d, today = todayIso()) {
  const q = plain(question);
  const budget = Number(d.wedding.budget || 0);
  const categories = [...new Set([...Object.keys(BUDGET_SPLIT), ...d.expenses.map(e => e.category)])];
  const plannedIn = c => d.expenses.filter(e => e.category === c).reduce((n, e) => n + Number(e.planned || 0), 0);
  const asked = categories.find(c => plain(c).split(/[^a-z]+/).some(w => w.length > 3 && q.includes(w)));

  if (/contrat|fornecedor/.test(q)) {
    const missing = checklist(d, today).filter(i => i.hire && !i.done);
    const deciding = (d.vendors || []).filter(v => ['Orçando', 'Orçamento recebido', 'Negociando'].includes(v.status));
    if (!d.wedding.date) return { title: 'Primeiro, a data', lines: ['Defina a data do casamento em "Detalhes do casamento" para eu calcular os prazos de cada contratação.'] };
    return { title: missing.length ? 'Ainda falta contratar' : 'Fornecedores principais contratados ♡', lines: [
      ...missing.map(i => `${i.title.replace('Contratar ', '').replace('Escolher e reservar ', '').replace(/^o |^a /, '')}: ${i.late ? `atrasado (ideal até ${dayMonth(i.due)})` : `até ${dayMonth(i.due)}`}`),
      ...(deciding.length ? [`Em negociação: ${deciding.map(v => `${v.name} (${v.category})`).join(', ')}.`] : []),
      ...(missing.length ? [] : ['Agora é cuidar dos detalhes e dos pagamentos.']),
    ] };
  }
  if (/gastar|posso|limite|orcamento|categoria|quanto custa/.test(q) && !/falta|pagar/.test(q)) {
    if (!budget) return { title: 'Defina o orçamento máximo', lines: ['Em "Detalhes do casamento", informe o orçamento máximo e o número de convidados. Aí eu divido o valor por categoria.'] };
    const rows = (asked ? [asked] : categories.filter(c => BUDGET_SPLIT[c])).map(c => {
      const ideal = budget * (BUDGET_SPLIT[c] || 0), used = plannedIn(c);
      return `${c}: até ${money(ideal)}${used ? ` · orçado ${money(used)}${used > ideal ? ' (acima da sugestão)' : ''}` : ''}`;
    });
    const guests = Number(d.wedding.guestsExpected || 0);
    return { title: asked ? `Quanto gastar com ${asked}` : 'Sugestão de divisão do orçamento', lines: [...rows, ...(guests ? [`Referência: ${money(budget / guests)} por convidado (${guests} previstos), considerando o casamento inteiro.`] : [])] };
  }
  if (/mes|tarefa|fazer|semana/.test(q)) {
    const month = today.slice(0, 7);
    const tasks = d.tasks.filter(t => t.status !== 'Concluído' && t.date && t.date.slice(0, 7) <= month).sort((a, b) => a.date.localeCompare(b.date));
    const suggestions = checklist(d, today).filter(i => !i.done && !i.added && i.due.slice(0, 7) <= month);
    const lines = [...tasks.map(t => `${t.date < today ? 'Atrasada · ' : ''}${t.title} (${dayMonth(t.date)})`), ...suggestions.map(i => `Sugestão: ${i.title}`)];
    return { title: lines.length ? 'Para fazer este mês' : 'Mês tranquilo', lines: lines.length ? lines.slice(0, 10) : ['Nenhuma tarefa marcada para este mês. Que tal adiantar algo das Prioridades?'] };
  }
  if (/vencimento|parcela|vence/.test(q)) {
    const next = installments(d).filter(p => !p.paid && p.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
    return { title: next.length ? 'Próximos vencimentos' : 'Nenhuma parcela cadastrada', lines: next.length ? next.map(p => `${dayMonth(p.due)}${p.due < today ? ' (vencida)' : ''} · ${p.expense.description}: ${money(p.amount)}`) : ['Ao contratar um fornecedor pela aba Fornecedores, as parcelas entram aqui sozinhas.'] };
  }
  if (/pagar|falta|saldo|devo|divida/.test(q)) {
    const dueOf = e => (e.status === 'Presente Ganho' ? 0 : Math.max(0, Number(e.planned || 0) - Number(e.paid || 0)));
    const total = d.expenses.reduce((n, e) => n + dueOf(e), 0);
    const byCat = categories.map(c => [c, d.expenses.filter(e => e.category === c).reduce((n, e) => n + dueOf(e), 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    return { title: `Falta pagar ${money(total)}`, lines: byCat.length ? byCat.map(([c, v]) => `${c}: ${money(v)}`) : ['Tudo quitado ♡'] };
  }
  if (/convidad|confirm|rsvp|presenc/.test(q)) {
    const count = s => d.guests.filter(g => g.status === s).length;
    const people = list => list.reduce((n, g) => n + 1 + Number(g.companions || 0) + Number(g.children || 0), 0);
    return { title: 'Confirmações', lines: [`${people(d.guests.filter(g => g.status === 'Confirmado'))} pessoas confirmadas de ${people(d.guests)} na lista.`, `${count('Enviado')} convites enviados sem resposta e ${count('Pendente')} ainda não enviados.`, `${count('Recusado')} não poderão ir.`, ...(Number(d.wedding.guestsExpected) ? [`Você previu ${d.wedding.guestsExpected} convidados.`] : [])] };
  }
  return { title: 'Posso ajudar com estas perguntas', lines: QUESTIONS };
}
