// Cerimonialista virtual com IA: Gemini pelo Firebase AI Logic, direto do navegador (sem servidor).
// Se a IA falhar (sem internet, cota esgotada, App Check), o app volta para a cerimonialista local de planner.js.
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';
import { firebaseApp, APP_CHECK_SITE_KEY } from './firebase.js';
import { alerts, checklist, installments, vendorFinal, BUDGET_SPLIT, todayIso } from './planner.js';

// Modelos do Gemini, em ordem: se o primeiro estiver sobrecarregado ou fora do ar, tenta o próximo.
// Se algum for desativado pelo Google, troque aqui (lista em firebase.google.com/docs/ai-logic/models).
// Plano gratuito (Gemini Developer API, sem Blaze): a versão lite vem primeiro porque responde mais rápido na fila gratuita;
// o gemini-3.5-flash (mais elaborado) é a reserva. O 3.8 vivia sobrecarregado.
// thinking: nível de raciocínio antes de responder (só onde o modelo aceita; o 3.8 recusou MINIMAL com erro 400).
export const AI_MODELS = [{ name: 'gemini-3.5-flash-lite' }, { name: 'gemini-3.5-flash', thinking: 'LOW' }];
// A API gratuita do Gemini enfileira pedidos quando está cheia: a primeira palavra já levou de 2 a mais de 15 segundos.
const AI_FIRST_MS = 40000, AI_IDLE_MS = 20000;
export const AI_PAGES = { cronograma: 'Cronograma', anotacoes: 'Anotações', inspiracoes: 'Inspirações', documentos: 'Documentos', convidados: 'Convidados', cerimonia: 'Cerimônia & músicas', fornecedores: 'Fornecedores', financeiro: 'Financeiro', diad: 'Dia do casamento', cerimonial: 'Cerimonial do casamento', checklist: 'O que levar', luademel: 'Lua de mel' };

const PERSONA = `Você é a cerimonialista virtual do "Entre Nós", um organizador de casamento brasileiro. Fala com o casal (ou com quem está organizando) em português do Brasil, com carinho, leveza e segurança de quem já organizou centenas de casamentos.

Como você ajuda:
- Conhece a fundo casamentos no Brasil: cronograma de preparação, contratação de fornecedores (buffet, local, foto e vídeo, decoração, banda/DJ, vestido, beleza, convites, bolo e doces), contratos, cartório e casamento civil, cerimônia religiosa e simbólica, cortejo, votos, recepção, etiqueta com convidados, lista de presentes, chá de panela, lua de mel, plano B e dia do casamento.
- Usa os dados do planejamento abaixo para dar respostas concretas: cite valores, datas, nomes de fornecedores e tarefas do próprio casal. Faça as contas quando ajudar (quanto falta pagar, quanto sobra por categoria, quantos dias faltam).
- Quando algo não estiver nos dados, diga isso com naturalidade e sugira onde cadastrar. Nunca invente fornecedores, valores ou fatos sobre o casal.
- Preços de mercado variam muito por cidade e estilo: dê faixas como referência e deixe claro que são estimativas.
- Se a pessoa estiver ansiosa ou perdida, acolha primeiro e depois proponha um passo pequeno e possível.
- Converse de verdade: responda o que foi perguntado, lembre o que já foi dito na conversa e faça no máximo uma pergunta de volta quando precisar entender melhor.

Formato:
- Respostas curtas e diretas, como numa conversa de WhatsApp com uma profissional atenciosa. Use listas só quando houver passos ou itens.
- Pode usar **negrito** e listas com "- " ou "1. ". Não use títulos, tabelas nem links.
- Só quando a resposta pedir uma ação numa página específica do organizador (cadastrar, conferir, pagar), escreva no fim, numa linha própria, [[pagina:CHAVE]] com uma destas chaves: ${Object.entries(AI_PAGES).map(([k, v]) => `${k} (${v})`).join(', ')}. No máximo uma.
- No fim, sugira até 3 continuações curtas que a pessoa poderia perguntar, cada uma numa linha própria no formato [[pergunta:texto]].`;

const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : 'sem data');
const people = g => 1 + Number(g.companions || 0) + Number(g.children || 0);
const short = (text, n = 140) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const isGift = e => e.status === 'Presente Ganho';

// Resumo do planejamento em texto, enviado a cada pergunta (sem telefones nem e-mails).
export function weddingContext(d, today = todayIso()) {
  const w = d.wedding, out = [], budget = Number(w.budget || 0);
  const left = w.date ? Math.round((new Date(`${w.date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 864e5) : null;
  out.push(`Hoje: ${br(today)}.`);
  out.push(`Casal: ${w.couple || 'não informado'}. Data: ${w.date ? `${br(w.date)}${w.time ? ` às ${w.time}` : ''} (${left >= 0 ? `faltam ${left} dias` : 'já aconteceu'})` : 'a definir'}. Local: ${w.venue || 'a definir'}. Estilo: ${w.style || 'a definir'}. Cerimônia: ${w.ceremonyType || 'a definir'}. Convidados previstos: ${w.guestsExpected || 'a definir'}. Orçamento máximo: ${budget ? money(budget) : 'a definir'}.`);

  const guests = d.guests || [], byStatus = {};
  guests.forEach(g => { byStatus[g.status || 'Pendente'] = (byStatus[g.status || 'Pendente'] || 0) + people(g); });
  out.push(`\nCONVIDADOS: ${guests.reduce((n, g) => n + people(g), 0)} pessoas na lista (${Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(', ') || 'lista vazia'}).`);
  guests.slice(0, 250).forEach(g => out.push(`- ${g.name} · ${g.group || 'sem grupo'} · ${g.status || 'Pendente'}${Number(g.companions) ? ` · +${g.companions} adulto(s)` : ''}${Number(g.children) ? ` · ${g.children} criança(s)` : ''}${g.notes ? ` · obs: ${short(g.notes, 60)}` : ''}`));

  const expenses = d.expenses || [], plannedAll = expenses.reduce((n, e) => n + (isGift(e) ? 0 : Number(e.planned || 0)), 0), paidAll = expenses.reduce((n, e) => n + (isGift(e) ? 0 : Number(e.paid || 0)), 0);
  out.push(`\nFINANCEIRO: orçado ${money(plannedAll)} (sem presentes ganhos), pago ${money(paidAll)}, falta pagar ${money(plannedAll - paidAll)}, presentes ganhos ${money(expenses.filter(isGift).reduce((n, e) => n + Number(e.planned || 0), 0))}, dos quais quem deu ainda falta pagar ${money(expenses.filter(isGift).reduce((n, e) => n + Math.max(0, Number(e.planned || 0) - Number(e.paid || 0)), 0))} (fora do saldo do casal).`);
  const categories = [...new Set([...Object.keys(BUDGET_SPLIT), ...expenses.map(e => e.category)])];
  categories.forEach(c => { const list = expenses.filter(e => e.category === c && !isGift(e)), sum = list.reduce((n, e) => n + Number(e.planned || 0), 0); if (sum || (budget && BUDGET_SPLIT[c])) out.push(`- Categoria ${c}: orçado ${money(sum)}${budget && BUDGET_SPLIT[c] ? ` (sugestão ${money(budget * BUDGET_SPLIT[c])})` : ''}`); });
  expenses.slice(0, 120).forEach(e => out.push(`- Gasto "${e.description}" (${e.category}${e.supplier ? `, ${e.supplier}` : ''}): previsto ${money(e.planned)}, pago ${money(e.paid)}, ${e.status || 'Pendente'}${e.notes ? `, obs: ${short(e.notes, 80)}` : ''}`));
  const parts = installments(d).filter(p => !p.paid).sort((a, b) => String(a.due).localeCompare(String(b.due)));
  if (parts.length) out.push(`Parcelas em aberto: ${parts.slice(0, 15).map(p => `${p.expense.description} ${money(p.amount)} vence ${br(p.due)}`).join('; ')}.`);

  const vendors = d.vendors || [];
  out.push(`\nFORNECEDORES (${vendors.length}):`);
  vendors.slice(0, 80).forEach(v => out.push(`- ${v.name} · ${v.category} · ${v.status}${vendorFinal(v) ? ` · ${money(vendorFinal(v))}` : ''}${v.includes ? ` · inclui: ${short(v.includes, 100)}` : ''}${v.conditions ? ` · condições: ${short(v.conditions, 80)}` : ''}${v.agreed ? ` · combinado: ${short(v.agreed, 80)}` : ''}${v.contractStatus ? ` · contrato: ${v.contractStatus}` : ''}${v.notes ? ` · obs: ${short(v.notes, 80)}` : ''}`));

  const tasks = d.tasks || [], open = tasks.filter(t => t.status !== 'Concluído').sort((a, b) => `${a.date || '9'}${a.time || ''}`.localeCompare(`${b.date || '9'}${b.time || ''}`));
  out.push(`\nTAREFAS: ${tasks.length - open.length} concluídas, ${open.length} pendentes.`);
  open.slice(0, 60).forEach(t => out.push(`- ${t.title} · ${t.date ? br(t.date) : 'sem data'}${t.time ? ` ${t.time}` : ''} · ${t.status}${t.priority ? ` · prioridade ${t.priority}` : ''}${t.responsible ? ` · ${t.responsible}` : ''}`));

  const steps = checklist(d, today).filter(i => !i.done);
  if (steps.length) out.push(`\nETAPAS DO CHECKLIST AINDA ABERTAS: ${steps.slice(0, 20).map(i => `${i.title} (até ${br(i.due)}${i.late ? ', atrasada' : ''})`).join('; ')}.`);
  if ((d.ceremonial || []).length) out.push(`\nCERIMONIAL DO DIA: ${[...d.ceremonial].sort((a, b) => String(a.time).localeCompare(String(b.time))).map(c => `${c.time} ${c.title}${c.responsible ? ` (${c.responsible})` : ''}`).join('; ')}.`);
  if ((d.ceremony || []).length) out.push(`CORTEJO: ${d.ceremony.map(c => `${c.step}${c.participants ? ` (${c.participants})` : ''}${c.music ? ` — ${c.music}` : ''}`).join('; ')}.`);
  const supplies = d.supplies || [];
  if (supplies.length) out.push(`O QUE LEVAR: ${supplies.filter(s => s.status === 'No Local').length} de ${supplies.length} itens já no local.`);
  const hm = d.honeymoon || {};
  if (hm.destination || Number(hm.budget)) out.push(`LUA DE MEL: ${hm.destination || 'destino a definir'}${hm.start ? `, de ${br(hm.start)} a ${br(hm.end)}` : ''}, orçamento ${money(hm.budget)}, guardado ${money(hm.saved)}.`);
  out.push(`\nAVISOS DO PAINEL: ${alerts(d, today).map(a => `${a.title} (${a.text})`).join('; ')}.`);
  return out.join('\n');
}

let appCheckReady = false;
function ensureAppCheck() {
  if (appCheckReady) return;
  appCheckReady = true;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  if (APP_CHECK_SITE_KEY) initializeAppCheck(firebaseApp, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}

// Pedido de continuação: mostra o fim exato do que chegou para o modelo emendar sem repetir nem pular.
const continueFrom = text => `Sua última resposta foi cortada no meio. Ela termina exatamente assim: "${text.slice(-120)}". Escreva só o restante, começando do caractere seguinte (mesmo que seja no meio de uma palavra ou número), sem repetir nada, sem cumprimentar e sem comentar o corte.`;

// Uma chamada em streaming; o texto novo é somado a `base`. complete = o modelo terminou de verdade (finishReason STOP etc.).
async function streamOnce(ai, { name, thinking }, systemInstruction, history, message, base, onText) {
  // Sem novidade no prazo (primeiro pedaço ou entre pedaços), cancela: o SDK sozinho pode esperar minutos.
  const abort = new AbortController(), started = performance.now();
  let text = base, timer;
  const wait = ms => { clearTimeout(timer); timer = setTimeout(() => abort.abort(new Error(`Gemini ${name} sem resposta em ${ms / 1000}s`)), ms); };
  try {
    wait(AI_FIRST_MS);
    const chat = getGenerativeModel(ai, { model: name, systemInstruction, ...(thinking ? { generationConfig: { thinkingConfig: { thinkingLevel: thinking } } } : {}) }).startChat({ history });
    const result = await chat.sendMessageStream(message, { signal: abort.signal });
    console.info(`Gemini ${name}: começou a responder em ${Math.round(performance.now() - started)} ms.`);
    for await (const chunk of result.stream) { wait(AI_IDLE_MS); text += chunk.text(); onText(text); }
    const finish = (await result.response).candidates?.[0]?.finishReason;
    // O Gemini às vezes encerra com STOP no meio da frase ("Faltam **", "171 dias e"). Conta como cortada se o texto
    // (sem as marcações) não termina numa pontuação final ou emoji, ou se ficou um negrito aberto.
    const body = parseAI(text).text;
    const complete = finish === 'STOP' && (/\[\[[^\]]+\]\]\s*$/.test(text) || /[.!?…)♡"”:]$|\p{Extended_Pictographic}$/u.test(body)) && (body.match(/\*\*/g) || []).length % 2 === 0;
    if (!complete) console.warn(`Gemini ${name} parou antes do fim (finishReason ${finish}, ${text.length} caracteres): "${text.slice(-60)}"`);
    return { text, complete };
  } catch (error) {
    if (text.length > base.length) { console.warn(`Gemini ${name} cortou a transmissão no meio.`, error); return { text, complete: false }; }
    throw abort.signal.aborted ? abort.signal.reason : error;
  } finally { clearTimeout(timer); }
}

// history: [{ question, text }] das trocas anteriores. onText recebe o texto acumulado enquanto chega.
export async function askAI(history, question, d, onText) {
  ensureAppCheck();
  const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() }), systemInstruction = `${PERSONA}\n\nDADOS ATUAIS DO PLANEJAMENTO:\n${weddingContext(d)}`;
  const turns = history.flatMap(m => [{ role: 'user', parts: [{ text: m.question }] }, { role: 'model', parts: [{ text: m.text }] }]);
  let lastError;
  for (const model of AI_MODELS) {
    try {
      let { text, complete } = await streamOnce(ai, model, systemInstruction, turns, question, '', onText);
      // Veio cortada: pede ao mesmo modelo para continuar de onde parou (até 2 vezes).
      for (let tries = 0; !complete && text.trim() && tries < 2; tries++) {
        const cut = [...turns, { role: 'user', parts: [{ text: question }] }, { role: 'model', parts: [{ text }] }];
        try { ({ text, complete } = await streamOnce(ai, model, systemInstruction, cut, continueFrom(text), text, onText)); } catch (error) { console.warn(`Gemini ${model.name} não conseguiu continuar a resposta.`, error); break; }
      }
      if (text.trim()) return text;
      lastError = new Error(`Resposta vazia de ${model.name}`);
    } catch (error) {
      lastError = error;
      console.warn(`Gemini ${model.name} falhou; tentando o próximo modelo.`, error);
    }
  }
  throw lastError;
}

// Separa o texto das marcações [[pagina:...]] e [[pergunta:...]]. Some com marcação ainda incompleta no fim (streaming).
export function parseAI(raw) {
  const go = raw.match(/\[\[pagina:\s*([a-z]+)\s*\]\]/)?.[1];
  const follow = [...raw.matchAll(/\[\[pergunta:\s*([^\]]+?)\s*\]\]/g)].map(m => m[1]).slice(0, 3);
  const text = raw.replace(/\[\[[^\]]*\]\]/g, '').replace(/\[\[[^\]]*$/, '').trim();
  return { text, go: AI_PAGES[go] ? go : null, follow };
}
