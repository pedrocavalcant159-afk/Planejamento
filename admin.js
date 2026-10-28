import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword, deleteUser } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot, writeBatch, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db, firebaseConfig, isAdmin, loginToEmail } from './lib/firebase.js';
import { PRODUCTS, PRODUCT_KEYS, TEMPLATES, STATUS, slugify, money, dateLong, esc, productLink, modelsFor, modelName } from './lib/catalog.js';
import { pixPayload, qrSvg } from './lib/pix.js';
import { PHOTO_SLOTS, CUSTOM_GROUPS } from './lib/content.js';

// Segunda instância do Auth: cria e gerencia contas de clientes sem desconectar o administrador.
const clientAuth = getAuth(initializeApp(firebaseConfig, 'gestao-clientes'));

const $ = (s, root = document) => root.querySelector(s);
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V20"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  wallet: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  pending: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/>',
};
const icon = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;

let clients = [];
let settings = { pixKey: '', pixName: '', pixCity: '', prices: {} };
let search = '';
let statusFilter = 'todos';
let stopClients = null;
let toastTimer;

function notify(message) { const t = $('#toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800); }
async function copy(text, message = 'Copiado.') {
  try { await navigator.clipboard.writeText(text); notify(message); }
  catch { prompt('Copie o texto abaixo:', text); }
}
const priceOf = key => Number(settings.prices?.[key] ?? PRODUCTS[key].price);
const randomPassword = () => { const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; const bytes = crypto.getRandomValues(new Uint8Array(8)); return [...bytes].map(b => chars[b % chars.length]).join(''); };
const areaUrl = () => new URL('cliente.html', location.href).href;
const statusBadge = status => `<span class="badge ${status === 'pago' ? 'badge-pago' : status === 'cancelado' ? 'badge-cancelado' : 'badge-pendente'}">${esc(STATUS[status]?.label || status)}</span>`;
const productNames = products => Object.keys(products || {}).filter(k => PRODUCTS[k]).map(k => `${PRODUCTS[k].name} (${modelName(k, products[k])})`);
const txidFor = client => `EN${client.slug.replace(/[^a-z0-9]/gi, '')}`.slice(0, 25).toUpperCase();
const pixFor = client => pixPayload({ key: settings.pixKey, name: settings.pixName, city: settings.pixCity, amount: client.amount, txid: txidFor(client), description: 'Entre Nos' });
const whatsappUrl = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '').replace(/^(?!55)(\d{10,11})$/, '55$1')}?text=${encodeURIComponent(text)}`;

function chargeMessage(client) {
  const code = pixFor(client);
  return [
    `Olá, ${client.couple}! ♡`,
    'Seu pedido na Entre Nós foi registrado:',
    ...productNames(client.products).map(name => `• ${name}`),
    '',
    `Valor: ${money(client.amount)}`,
    ...(code ? ['', 'Pague pelo Pix copia e cola:', code] : []),
    '',
    'Assim que o pagamento for confirmado, seu acesso é liberado.',
  ].join('\n');
}
function accessMessage(client) {
  const links = Object.keys(client.products || {}).filter(k => PRODUCTS[k]?.page && k !== 'organizador').map(k => `• ${PRODUCTS[k].short}: ${productLink(k, client.slug)}`);
  return [
    `Olá, ${client.couple}! ♡`,
    client.status === 'pago' ? 'Pagamento confirmado, está tudo liberado!' : 'Seu acesso já foi criado.',
    '',
    `Sua área: ${areaUrl()}`,
    `Usuário: ${client.username}`,
    `Senha: ${client.password}`,
    ...(links.length ? ['', 'Links para compartilhar com os convidados:', ...links] : []),
  ].join('\n');
}

/* ---------- Render ---------- */
function render() {
  const visible = clients.filter(c => (statusFilter === 'todos' || c.status === statusFilter) && `${c.couple} ${c.username} ${c.slug} ${c.phone || ''}`.toLowerCase().includes(search.toLowerCase()));
  const sum = status => clients.filter(c => c.status === status).reduce((n, c) => n + Number(c.amount || 0), 0);
  const count = status => clients.filter(c => c.status === status).length;
  const stat = (iconName, label, value, foot) => `<article class="card stat-card"><div class="stat-top"><span class="stat-icon">${icon(iconName)}</span><span>${label}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
  const rows = visible.map(c => `<tr data-open="${esc(c.uid)}">
    <td><div class="client-cell"><strong>${esc(c.couple)}</strong><small>${esc(c.slug)}</small></div></td>
    <td><span class="muted-cell">${esc(c.username)}</span></td>
    <td><div class="product-chips">${Object.keys(c.products || {}).filter(k => PRODUCTS[k]).map(k => `<span class="product-chip">${esc(PRODUCTS[k].short)} <em>${esc(modelName(k, c.products[k]))}</em></span>`).join('')}</div></td>
    <td>${money(c.amount)}</td>
    <td>${statusBadge(c.status)}</td>
    <td><span class="muted-cell">${c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('pt-BR') : '—'}</span></td>
    <td><div class="row-buttons">${c.status === 'aguardando' ? `<button class="button button-secondary button-sm" data-pix="${esc(c.uid)}">Pix</button><button class="button button-primary button-sm" data-paid="${esc(c.uid)}">Marcar pago</button>` : ''}<button class="button button-secondary button-sm" data-open="${esc(c.uid)}">Detalhes</button></div></td>
  </tr>`).join('');
  $('#page-content').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">PAINEL ADMINISTRATIVO</p><h1>Clientes.</h1><p>Cadastre compras, gere o Pix e libere o acesso de cada casal.</p></div><div class="heading-actions"><button class="button button-primary" id="new-client">${icon('plus')}Novo cliente</button></div></div>
    <section class="stats-grid">
      ${stat('users', 'Clientes', clients.length, 'cadastrados')}
      ${stat('clock', 'Aguardando', count('aguardando'), 'pagamentos pendentes')}
      ${stat('check', 'Pagos', count('pago'), 'com acesso liberado')}
      ${stat('wallet', 'Recebido', money(sum('pago')), 'em pedidos pagos')}
      ${stat('pending', 'A receber', money(sum('aguardando')), 'em pedidos pendentes')}
    </section>
    <div class="toolbar"><label class="search-box"><span class="search-mark">${icon('search')}</span><input id="client-search" type="search" placeholder="Buscar por casal, usuário ou WhatsApp" value="${esc(search)}"></label>
      <select id="status-filter" class="filter-select"><option value="todos">Todos os status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${statusFilter === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
    <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Casal</th><th>Usuário</th><th>Produtos</th><th>Valor</th><th>Status</th><th>Criado em</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7"><div class="empty-row">${clients.length ? 'Nenhum cliente encontrado com esses filtros.' : 'Nenhum cliente ainda. Clique em "Novo cliente" para cadastrar a primeira compra.'}</div></td></tr>`}</tbody></table></div>
      <div class="table-footer">Exibindo <strong>${visible.length}</strong> de <strong>${clients.length}</strong> clientes</div></section>`;
  const labels = ['Casal', 'Usuário', 'Produtos', 'Valor', 'Status', 'Criado em', ''];
  $('#page-content').querySelectorAll('tbody tr').forEach(row => row.querySelectorAll('td').forEach((cell, i) => { if (!cell.hasAttribute('colspan')) cell.dataset.label = labels[i]; }));
  $('#new-client').addEventListener('click', () => openClientForm());
  $('#client-search').addEventListener('input', e => { const pos = e.target.selectionStart; search = e.target.value; render(); const input = $('#client-search'); input.focus(); input.setSelectionRange(pos, pos); });
  $('#status-filter').addEventListener('change', e => { statusFilter = e.target.value; render(); });
  $('#page-content').querySelectorAll('[data-pix]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openPix(b.dataset.pix); }));
  $('#page-content').querySelectorAll('[data-paid]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setStatus(b.dataset.paid, 'pago'); }));
  $('#page-content').querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openDetail(el.dataset.open); }));
}

/* ---------- Modal helpers ---------- */
function openModal(html) {
  $('#admin-modal-body').innerHTML = html;
  const modal = $('#admin-modal');
  if (!modal.open) modal.showModal();
  modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.close()));
  return modal;
}
const modalHead = (eyebrow, title) => `<div class="modal-head"><div><p class="eyebrow">${eyebrow}</p><h2>${esc(title)}</h2></div><button type="button" class="icon-button" data-close aria-label="Fechar">×</button></div>`;
const field = (name, label, value = '', attrs = '', full = false) => `<div class="field ${full ? 'full' : ''}"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${esc(value)}" ${attrs}></div>`;

/* ---------- Novo / editar cliente ---------- */
function openClientForm(uid = null) {
  const client = uid ? clients.find(c => c.uid === uid) : null;
  const c = client || { couple: '', phone: '', products: {}, casamento: {}, cha: {}, notes: '', amount: 0 };
  const eventBlock = (key, title, hint) => `<div class="event-fields" data-event="${key}"><p class="form-section">${title}<small>${hint}</small></p>
    ${field(`${key}-date`, 'Data', c[key]?.date, 'type="date"')}${field(`${key}-time`, 'Horário', c[key]?.time, 'type="time"')}
    ${field(`${key}-venue`, 'Local', c[key]?.venue, 'placeholder="Ex.: Sítio das Oliveiras"', true)}${field(`${key}-address`, 'Endereço', c[key]?.address, 'placeholder="Rua, número, bairro, cidade"', true)}</div>`;
  const modal = openModal(`<form id="client-form" novalidate>${modalHead(client ? 'EDITAR CLIENTE' : 'NOVA COMPRA', client ? client.couple : 'Cadastrar cliente')}
    <div class="modal-fields">
      ${field('couple', 'Nomes do casal', c.couple, 'required placeholder="Ex.: Marina & Rafael"', true)}
      ${field('phone', 'WhatsApp', c.phone, 'type="tel" placeholder="(11) 99999-0000"')}
      ${client ? `<div class="field"><label>Link</label><input value="${esc(client.slug)}" disabled></div>` : field('slug', 'Link do casal', '', 'required pattern="[a-z0-9-]{3,40}" placeholder="marina-rafael"')}
      ${client ? '' : `${field('username', 'Usuário de acesso', '', 'required autocapitalize="none" spellcheck="false"')}
      <div class="field"><label for="f-password">Senha</label><div class="inline-input"><input id="f-password" name="password" value="${randomPassword()}" required minlength="6"><button type="button" class="button button-secondary button-sm" id="regen-password">Gerar</button></div></div>`}
      <p class="form-section">Produtos comprados<small>Escolha o modelo de cada produto. O valor é somado automaticamente.</small></p>
      <div class="product-picker">${PRODUCT_KEYS.map(key => `<div class="product-option ${c.products[key] ? 'is-on' : ''}" data-product="${key}">
        <input type="checkbox" id="p-${key}" ${c.products[key] ? 'checked' : ''}>
        <label for="p-${key}">${esc(PRODUCTS[key].name)}<small>${PRODUCTS[key].event === 'cha' ? 'Chá de panela' : 'Casamento'}</small></label>
        <select aria-label="Modelo de ${esc(PRODUCTS[key].name)}">${Object.entries(modelsFor(key)).map(([n, m]) => `<option value="${n}" ${Number(c.products[key] || 1) === Number(n) ? 'selected' : ''}>${m.name}</option>`).join('')}</select>
        <span class="price">${money(priceOf(key))}</span></div>`).join('')}</div>
      ${eventBlock('cha', 'Chá de panela', 'Usado no convite, na lista de presentes e no ebook.')}
      ${eventBlock('casamento', 'Casamento', 'Usado no site de casamento e no organizador.')}
      <p class="form-section">Pagamento</p>
      ${field('amount', 'Valor total (R$)', Number(c.amount || 0).toFixed(2), 'type="number" min="0" step="0.01" required')}
      ${field('notes', 'Observações', c.notes, 'placeholder="Opcional"')}
    </div>
    <p class="auth-error" id="form-error" role="alert"></p>
    <div class="modal-actions"><button type="button" class="button button-quiet" data-close>Cancelar</button><button type="submit" class="button button-primary" id="form-submit">${client ? 'Salvar alterações' : 'Cadastrar e gerar acesso'}</button></div></form>`);
  const form = $('#client-form', modal);
  let amountTouched = Boolean(client);
  const selected = () => Object.fromEntries([...form.querySelectorAll('.product-option')].filter(o => o.querySelector('input').checked).map(o => [o.dataset.product, Number(o.querySelector('select').value)]));
  const sync = () => {
    const products = selected();
    form.querySelectorAll('.product-option').forEach(o => o.classList.toggle('is-on', Boolean(products[o.dataset.product])));
    form.querySelectorAll('[data-event]').forEach(block => { block.hidden = !Object.keys(products).some(k => PRODUCTS[k].event === block.dataset.event); });
    if (!amountTouched) form.amount.value = Object.keys(products).reduce((n, k) => n + priceOf(k), 0).toFixed(2);
  };
  form.querySelector('.product-picker').addEventListener('change', sync);
  form.amount.addEventListener('input', () => { amountTouched = true; });
  if (!client) {
    let slugTouched = false, userTouched = false;
    form.couple.addEventListener('input', () => { if (!slugTouched) form.slug.value = slugify(form.couple.value); if (!userTouched) form.username.value = slugify(form.couple.value).replace(/-e-/g, '-'); });
    form.slug.addEventListener('input', () => { slugTouched = true; form.slug.value = slugify(form.slug.value); });
    form.username.addEventListener('input', () => { userTouched = true; });
    $('#regen-password', form).addEventListener('click', () => { form.password.value = randomPassword(); });
  }
  sync();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const products = selected(), error = $('#form-error', form), button = $('#form-submit', form);
    const eventData = key => ({ date: form[`${key}-date`].value, time: form[`${key}-time`].value, venue: form[`${key}-venue`].value.trim(), address: form[`${key}-address`].value.trim() });
    const values = { couple: form.couple.value.trim(), phone: form.phone.value.trim(), products, cha: eventData('cha'), casamento: eventData('casamento'), amount: Number(form.amount.value || 0), notes: form.notes.value.trim() };
    error.textContent = '';
    if (!values.couple) return (error.textContent = 'Informe os nomes do casal.');
    if (!Object.keys(products).length) return (error.textContent = 'Selecione pelo menos um produto.');
    if (!client) {
      values.slug = slugify(form.slug.value);
      values.username = form.username.value.trim().toLowerCase();
      values.password = form.password.value.trim();
      if (!/^[a-z0-9-]{3,40}$/.test(values.slug)) return (error.textContent = 'O link precisa ter de 3 a 40 letras, números ou hífens.');
      if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(values.username)) return (error.textContent = 'O usuário precisa ter de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.');
      if (values.password.length < 6) return (error.textContent = 'A senha precisa ter pelo menos 6 caracteres.');
    }
    button.disabled = true; button.textContent = 'Salvando...';
    try {
      if (client) await saveClient({ ...client, ...values });
      else await createClient(values);
      $('#admin-modal').close();
      if (!client) openDetail(clients.find(c => c.slug === values.slug)?.uid, true);
    } catch (e) {
      console.error(e);
      error.textContent = e.userMessage || 'Não foi possível salvar. Confira as regras do Firestore e tente de novo.';
    } finally { button.disabled = false; button.textContent = client ? 'Salvar alterações' : 'Cadastrar e gerar acesso'; }
  });
}

function writeClientDocs(batch, client) {
  batch.set(doc(db, 'clients', client.uid), { ...client, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, 'accounts', client.uid), { slug: client.slug, couple: client.couple, products: client.products, status: client.status, amount: client.amount, pix: client.status === 'aguardando' ? pixFor(client) : '', updatedAt: serverTimestamp() });
  batch.set(doc(db, 'sites', client.slug), { slug: client.slug, couple: client.couple, ownerUid: client.uid, active: client.status === 'pago', products: client.products, casamento: client.casamento, cha: client.cha, custom: client.custom || {}, updatedAt: serverTimestamp() });
}

async function createClient(values) {
  if ((await getDoc(doc(db, 'sites', values.slug))).exists()) throw Object.assign(new Error('slug'), { userMessage: 'Já existe um cliente com esse link. Escolha outro.' });
  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(clientAuth, loginToEmail(values.username), values.password);
    uid = cred.user.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') e.userMessage = 'Esse usuário já existe. Escolha outro.';
    if (e.code === 'auth/operation-not-allowed') e.userMessage = 'Ative o login por E-mail/Senha no Firebase Authentication.';
    throw e;
  } finally { await signOut(clientAuth).catch(() => {}); }
  const client = { ...values, uid, status: 'aguardando', createdAt: serverTimestamp(), paidAt: null };
  const batch = writeBatch(db);
  writeClientDocs(batch, client);
  await batch.commit();
  clients = [{ ...client, createdAt: { toDate: () => new Date() } }, ...clients.filter(c => c.uid !== uid)];
  notify('Cliente cadastrado e acesso criado.');
}

async function saveClient(client) {
  const batch = writeBatch(db);
  const { createdAt, ...rest } = client;
  writeClientDocs(batch, rest);
  await batch.commit();
  notify('Alterações salvas.');
}

async function setStatus(uid, status) {
  const client = clients.find(c => c.uid === uid);
  if (!client) return;
  const { createdAt, ...rest } = client;
  const batch = writeBatch(db);
  writeClientDocs(batch, { ...rest, status, paidAt: status === 'pago' ? serverTimestamp() : null });
  await batch.commit();
  notify(status === 'pago' ? 'Pagamento confirmado. Acesso liberado.' : status === 'cancelado' ? 'Pedido cancelado. Acesso bloqueado.' : 'Pedido voltou para aguardando pagamento.');
  if ($('#admin-modal').open) setTimeout(() => openDetail(uid), 300);
}

// O Firebase só permite trocar a senha estando logado como o cliente; por isso usamos a senha guardada.
async function withClientSession(client, action) {
  try {
    const cred = await signInWithEmailAndPassword(clientAuth, loginToEmail(client.username), client.password);
    return await action(cred.user);
  } catch (e) {
    if (e.code === 'auth/invalid-credential') e.userMessage = 'A senha guardada não confere com a do Firebase. Redefina a senha pelo Firebase Console.';
    throw e;
  } finally { await signOut(clientAuth).catch(() => {}); }
}

async function resetPassword(uid) {
  const client = clients.find(c => c.uid === uid);
  const password = randomPassword();
  try {
    await withClientSession(client, user => updatePassword(user, password));
    await setDoc(doc(db, 'clients', uid), { password, updatedAt: serverTimestamp() }, { merge: true });
    client.password = password;
    notify('Senha redefinida.');
    openDetail(uid);
  } catch (e) { console.error(e); alert(e.userMessage || 'Não foi possível redefinir a senha.'); }
}

async function removeClient(uid) {
  const client = clients.find(c => c.uid === uid);
  if (!client || !confirm(`Excluir ${client.couple}?\n\nO acesso, os links e todos os dados do casal serão apagados. Esta ação não pode ser desfeita.`)) return;
  try {
    await withClientSession(client, user => deleteUser(user)).catch(e => { if (e.code !== 'auth/invalid-credential' && e.code !== 'auth/user-not-found') throw e; });
    for (const sub of ['rsvps', 'reservas', 'fotos']) {
      const snap = await getDocs(collection(db, 'sites', client.slug, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
    await Promise.all([deleteDoc(doc(db, 'sites', client.slug)), deleteDoc(doc(db, 'accounts', uid)), deleteDoc(doc(db, 'planners', uid)), deleteDoc(doc(db, 'clients', uid))]);
    $('#admin-modal').close();
    notify('Cliente excluído.');
  } catch (e) { console.error(e); alert(e.userMessage || 'Não foi possível excluir o cliente.'); }
}

/* ---------- Detalhes ---------- */
function openDetail(uid, justCreated = false) {
  const c = clients.find(x => x.uid === uid);
  if (!c) return;
  const links = Object.keys(c.products || {}).filter(k => PRODUCTS[k]);
  const eventLine = key => c[key]?.date || c[key]?.venue ? `${dateLong(c[key].date)}${c[key].time ? ` às ${c[key].time}` : ''}${c[key].venue ? ` · ${c[key].venue}` : ''}` : 'Não informado';
  const modal = openModal(`<div class="modal-pad">
    <div class="detail-head"><div><p class="eyebrow">CLIENTE</p><h2>${esc(c.couple)}</h2>${statusBadge(c.status)}</div><button type="button" class="icon-button" data-close aria-label="Fechar">×</button></div>
    ${justCreated ? '<div class="credentials-box">Acesso criado! Envie ao cliente a <strong>mensagem de cobrança</strong> com o Pix e, depois de pago, a <strong>mensagem de acesso</strong>.</div><br>' : ''}
    <div class="detail-grid">
      <div class="detail-item"><span>Usuário</span><strong>${esc(c.username)}<button class="copy-mini" data-copy="${esc(c.username)}">Copiar</button></strong></div>
      <div class="detail-item"><span>Senha</span><strong>${esc(c.password)}<button class="copy-mini" data-copy="${esc(c.password)}">Copiar</button></strong></div>
      <div class="detail-item"><span>Valor</span><strong>${money(c.amount)}</strong></div>
      <div class="detail-item"><span>WhatsApp</span><strong>${esc(c.phone || 'Não informado')}</strong></div>
      ${Object.keys(c.products).some(k => PRODUCTS[k].event === 'cha') ? `<div class="detail-item"><span>Chá de panela</span><strong>${esc(eventLine('cha'))}</strong></div>` : ''}
      ${Object.keys(c.products).some(k => PRODUCTS[k].event === 'casamento') ? `<div class="detail-item"><span>Casamento</span><strong>${esc(eventLine('casamento'))}</strong></div>` : ''}
      ${c.paidAt?.toDate ? `<div class="detail-item"><span>Pago em</span><strong>${c.paidAt.toDate().toLocaleDateString('pt-BR')}</strong></div>` : ''}
      ${c.notes ? `<div class="detail-item"><span>Observações</span><strong>${esc(c.notes)}</strong></div>` : ''}
    </div>
    <p class="detail-section-title">Produtos e links</p>
    <div class="link-list">${links.map(k => { const url = productLink(k, c.slug); return `<div class="link-row"><div><strong>${esc(PRODUCTS[k].name)} · ${esc(modelName(k, c.products[k]))}</strong><small>${url ? esc(url) : 'Download na área do cliente'}</small></div>${url ? `<div class="row-buttons"><button class="button button-secondary button-sm" data-copy="${esc(url)}">Copiar</button><a class="button button-secondary button-sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a></div>` : ''}</div>`; }).join('')}
      <div class="link-row"><div><strong>Área do cliente</strong><small>${esc(areaUrl())}</small></div><div class="row-buttons"><button class="button button-secondary button-sm" data-copy="${esc(areaUrl())}">Copiar</button></div></div></div>
    ${c.status === 'pago' ? '' : '<p class="field-hint" style="margin-top:8px">Os links públicos só funcionam depois que o pedido for marcado como pago.</p>'}
    <p class="detail-section-title">Mensagens para o cliente</p>
    <div class="row-buttons" style="justify-content:flex-start">
      ${c.status !== 'pago' ? '<button class="button button-secondary button-sm" data-msg="charge">Copiar mensagem de cobrança</button>' : ''}
      <button class="button button-secondary button-sm" data-msg="access">Copiar mensagem de acesso</button>
      ${c.phone ? `<a class="button button-secondary button-sm" href="${esc(whatsappUrl(c.phone, c.status === 'pago' ? accessMessage(c) : chargeMessage(c)))}" target="_blank" rel="noopener">Enviar no WhatsApp</a>` : ''}
    </div>
    <div class="detail-actions">
      ${c.status === 'aguardando' ? '<button class="button button-secondary" data-act="pix">Gerar Pix</button><button class="button button-primary" data-act="pago">Marcar como pago</button>' : ''}
      ${c.status === 'pago' ? '<button class="button button-secondary" data-act="aguardando">Voltar para aguardando</button>' : ''}
      ${c.status === 'cancelado' ? '<button class="button button-secondary" data-act="aguardando">Reabrir pedido</button>' : ''}
      <button class="button button-secondary" data-act="edit">Editar</button>
      ${links.some(k => PRODUCTS[k].templates) ? '<button class="button button-secondary" data-act="custom">Fotos e textos</button>' : ''}
      <button class="button button-secondary" data-act="password">Redefinir senha</button>
      <span class="spacer"></span>
      ${c.status !== 'cancelado' ? '<button class="button button-secondary" data-act="cancelado">Cancelar pedido</button>' : ''}
      <button class="button button-danger-ghost" data-act="delete">Excluir</button>
    </div></div>`);
  modal.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copy(b.dataset.copy)));
  modal.querySelectorAll('[data-msg]').forEach(b => b.addEventListener('click', () => copy(b.dataset.msg === 'charge' ? chargeMessage(c) : accessMessage(c), 'Mensagem copiada.')));
  modal.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'pix') openPix(uid);
    if (['pago', 'aguardando', 'cancelado'].includes(act)) setStatus(uid, act);
    if (act === 'edit') openClientForm(uid);
    if (act === 'custom') openCustomize(uid);
    if (act === 'password' && confirm('Gerar uma nova senha para este cliente? A senha atual deixará de funcionar.')) resetPassword(uid);
    if (act === 'delete') removeClient(uid);
  }));
}

/* ---------- Fotos e textos das páginas ---------- */
// Reduz a foto no navegador para caber num documento do Firestore (limite de 1 MB).
// PNG/WebP com fundo transparente continua transparente e vira figurinha nas páginas.
async function compressPhoto(file, max) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let cutout = false;
  if (/png|webp|gif/.test(file.type)) {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4 * 9) if (pixels[i] < 245) { cutout = true; break; }
  }
  const type = cutout ? 'image/webp' : 'image/jpeg';
  let quality = .86, data = canvas.toDataURL(type, quality);
  if (cutout && !data.startsWith('data:image/webp')) data = canvas.toDataURL('image/png');
  while (data.length > 900000 && quality > .45) { quality -= .1; data = canvas.toDataURL(type, quality); }
  if (data.length > 1000000) throw Object.assign(new Error('foto grande'), { userMessage: 'A foto ficou grande demais. Tente uma imagem menor.' });
  return { data, cutout };
}

function openCustomize(uid, tab = 'fotos') {
  const c = clients.find(x => x.uid === uid);
  if (!c) return;
  const saved = c.custom || {};
  const has = event => Object.keys(c.products || {}).some(k => PRODUCTS[k]?.templates && PRODUCTS[k].event === event);
  const groups = CUSTOM_GROUPS.filter(g => g.title.startsWith('Site') ? has('casamento') : g.title.startsWith('Chá') ? has('cha') : true);
  const listRow = (f, row = {}) => `<div class="custom-row">${f.columns.map(([key, label, ph]) => `<input data-col="${key}" aria-label="${esc(label)}" placeholder="${esc(ph)}" value="${esc(row[key] || '')}">`).join('')}<button type="button" class="icon-button" data-remove-row aria-label="Remover linha">×</button></div>`;
  const colorRow = value => `<div class="custom-color"><input type="color" value="${esc(value)}" aria-label="Cor"><button type="button" class="icon-button" data-remove-row aria-label="Remover cor">×</button></div>`;
  const fieldHtml = f => {
    const value = saved[f.key];
    if (f.type === 'list') return `<div class="field full" data-key="${f.key}" data-type="list"><label>${esc(f.label)}</label><div class="custom-list">${(Array.isArray(value) ? value : f.default).map(row => listRow(f, row)).join('')}</div><button type="button" class="button button-secondary button-sm" data-add-row>Adicionar linha</button></div>`;
    if (f.type === 'colors') return `<div class="field full" data-key="${f.key}" data-type="colors"><label>${esc(f.label)}</label><div class="custom-colors">${(Array.isArray(value) ? value : f.default).map(colorRow).join('')}<button type="button" class="button button-secondary button-sm" data-add-color>+ Cor</button></div></div>`;
    const input = f.type === 'textarea' ? `<textarea id="c-${f.key}" rows="3" placeholder="${esc(f.default)}">${esc(value || '')}</textarea>` : `<input id="c-${f.key}" value="${esc(value || '')}" placeholder="${esc(f.default)}">`;
    return `<div class="field ${f.type === 'textarea' ? 'full' : ''}" data-key="${f.key}" data-type="text"><label for="c-${f.key}">${esc(f.label)}</label>${input}${f.hint ? `<span class="field-hint">${esc(f.hint)}</span>` : ''}</div>`;
  };
  const modal = openModal(`<div class="modal-pad">${modalHead('PERSONALIZAR', c.couple)}
    <div class="custom-tabs" role="tablist"><button type="button" role="tab" data-tab="fotos" aria-selected="${tab === 'fotos'}">Fotos</button><button type="button" role="tab" data-tab="textos" aria-selected="${tab === 'textos'}">Textos</button></div>
    <section data-panel="fotos" ${tab === 'fotos' ? '' : 'hidden'}>
      <p class="field-hint">As fotos aparecem no convite, na lista e no site. Para virar figurinha com contorno branco, envie o rosto em PNG sem fundo (dá para tirar o fundo em sites como remove.bg).</p>
      <div class="photo-grid" id="photo-grid"><p class="muted-cell">Carregando fotos...</p></div>
      <div class="modal-actions"><button type="button" class="button button-quiet" data-back>Voltar</button></div>
    </section>
    <form data-panel="textos" id="custom-form" ${tab === 'textos' ? '' : 'hidden'}>
      <p class="field-hint">Campos em branco usam o texto padrão (aparece apagado dentro do campo). Apague todas as linhas de uma lista para esconder aquela parte.</p>
      ${groups.map(g => `<p class="form-section">${esc(g.title)}${g.hint ? `<small>${esc(g.hint)}</small>` : ''}</p><div class="modal-fields">${g.fields.map(fieldHtml).join('')}</div>`).join('')}
      <div class="modal-actions"><button type="button" class="button button-quiet" data-back>Voltar</button><button type="submit" class="button button-primary">Salvar textos</button></div>
    </form></div>`);
  modal.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    modal.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    modal.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  }));
  modal.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => openDetail(uid)));

  // Textos
  const form = $('#custom-form', modal);
  form.addEventListener('click', e => {
    if (e.target.closest('[data-remove-row]')) e.target.closest('.custom-row, .custom-color').remove();
    const add = e.target.closest('[data-add-row]');
    if (add) {
      const f = groups.flatMap(g => g.fields).find(x => x.key === add.closest('[data-key]').dataset.key);
      add.previousElementSibling.insertAdjacentHTML('beforeend', listRow(f));
      add.previousElementSibling.lastElementChild.querySelector('input').focus();
    }
    const color = e.target.closest('[data-add-color]');
    if (color) color.insertAdjacentHTML('beforebegin', colorRow('#e8d5b5'));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const custom = { ...saved };
    form.querySelectorAll('[data-key]').forEach(box => {
      const key = box.dataset.key;
      if (box.dataset.type === 'text') custom[key] = box.querySelector('input, textarea').value.trim();
      if (box.dataset.type === 'colors') custom[key] = [...box.querySelectorAll('input[type="color"]')].map(i => i.value);
      if (box.dataset.type === 'list') custom[key] = [...box.querySelectorAll('.custom-row')].map(row => Object.fromEntries([...row.querySelectorAll('[data-col]')].map(i => [i.dataset.col, i.value.trim()]))).filter(row => Object.values(row).some(Boolean));
    });
    const button = form.querySelector('[type="submit"]');
    button.disabled = true; button.textContent = 'Salvando...';
    try {
      const { createdAt, ...rest } = c;
      await saveClient({ ...rest, custom });
      c.custom = custom;
      notify('Textos salvos. Já aparecem nas páginas.');
    } catch (e) { console.error(e); notify('Não foi possível salvar. Confira as regras do Firestore.'); }
    finally { button.disabled = false; button.textContent = 'Salvar textos'; }
  });

  // Fotos
  const grid = $('#photo-grid', modal);
  const photosRef = collection(db, 'sites', c.slug, 'fotos');
  let photos = {};
  const renderPhotos = () => {
    grid.innerHTML = PHOTO_SLOTS.map(slot => {
      const photo = photos[slot.id];
      return `<div class="photo-slot ${photo ? 'has-photo' : ''}" data-slot="${slot.id}">
        <div class="photo-preview ${slot.cutout ? 'is-cutout' : ''}">${photo ? `<img src="${esc(photo.data)}" alt="">` : '<span>Sem foto</span>'}</div>
        <div class="photo-info"><strong>${esc(slot.label)}</strong>${slot.hint ? `<small>${esc(slot.hint)}</small>` : ''}
          ${slot.caption ? `<input data-caption placeholder="Legenda (ex.: Comida boa)" value="${esc(photo?.caption || '')}" ${photo ? '' : 'disabled'}>` : ''}
          <div class="row-buttons"><label class="button button-secondary button-sm">${photo ? 'Trocar' : 'Enviar foto'}<input type="file" accept="image/*" hidden></label>${photo ? '<button type="button" class="button button-danger-ghost button-sm" data-remove-photo>Remover</button>' : ''}</div>
        </div></div>`;
    }).join('');
  };
  getDocs(photosRef).then(snap => { photos = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); renderPhotos(); })
    .catch(e => { console.error(e); grid.innerHTML = '<div class="pix-warning">Não foi possível ler as fotos. Publique as regras novas de firestore.rules no Firebase Console.</div>'; });
  grid.addEventListener('change', async e => {
    const box = e.target.closest('[data-slot]'), slot = PHOTO_SLOTS.find(s => s.id === box?.dataset.slot);
    if (!slot) return;
    if (e.target.matches('input[type="file"]') && e.target.files[0]) {
      box.classList.add('is-busy');
      try {
        const { data, cutout } = await compressPhoto(e.target.files[0], slot.max);
        const photo = { data, cutout, caption: photos[slot.id]?.caption || '', updatedAt: serverTimestamp() };
        await setDoc(doc(photosRef, slot.id), photo);
        photos[slot.id] = photo;
        notify(cutout ? 'Foto salva como figurinha (fundo transparente).' : 'Foto salva.');
      } catch (err) { console.error(err); notify(err.userMessage || 'Não foi possível salvar a foto. Confira as regras do Firestore.'); }
      renderPhotos();
    }
    if (e.target.matches('[data-caption]') && photos[slot.id]) {
      try { await setDoc(doc(photosRef, slot.id), { caption: e.target.value.trim() }, { merge: true }); photos[slot.id].caption = e.target.value.trim(); notify('Legenda salva.'); }
      catch (err) { console.error(err); notify('Não foi possível salvar a legenda.'); }
    }
  });
  grid.addEventListener('click', async e => {
    if (!e.target.closest('[data-remove-photo]')) return;
    const id = e.target.closest('[data-slot]').dataset.slot;
    if (!confirm('Remover esta foto?')) return;
    try { await deleteDoc(doc(photosRef, id)); delete photos[id]; renderPhotos(); notify('Foto removida.'); }
    catch (err) { console.error(err); notify('Não foi possível remover a foto.'); }
  });
}

/* ---------- Visualizar templates ---------- */
// Prévia de cada modelo com o casal de exemplo de lib/demo.js (nada é gravado no Firebase).
const TEMPLATE_PAGES = [['convite', 'Convite do chá'], ['lista', 'Lista de presentes'], ['site', 'Site de casamento']];
function openTemplates(page = 'convite', model = 1, photos = true) {
  const url = `${page}.html?c=demo&m=${model}${photos ? '' : '&fotos=0'}`;
  const tabs = (items, attr, current) => `<div class="custom-tabs" role="tablist">${items.map(([value, label]) => `<button type="button" role="tab" data-${attr}="${value}" aria-selected="${String(value) === String(current)}">${esc(label)}</button>`).join('')}</div>`;
  const modal = openModal(`<div class="modal-pad">${modalHead('TEMPLATES', 'Visualizar modelos')}
    <div class="tpl-controls">
      ${tabs(TEMPLATE_PAGES, 'tpl-page', page)}
      ${tabs(Object.entries(TEMPLATES).map(([n, m]) => [n, m.name]), 'tpl-model', model)}
      <label class="tpl-toggle"><input type="checkbox" data-tpl-photos ${photos ? 'checked' : ''}> Com fotos e textos de exemplo</label>
    </div>
    <p class="field-hint">${esc(TEMPLATES[model].description)}. Casal de exemplo: confirmações e reservas feitas aqui não são gravadas.</p>
    <div class="tpl-stage"><div class="tpl-phone"><iframe src="${esc(url)}" title="Prévia: ${esc(TEMPLATES[model].name)}"></iframe></div></div>
    <div class="modal-actions"><a class="button button-secondary" href="${esc(url)}" target="_blank" rel="noopener">Abrir em nova aba</a><button type="button" class="button button-primary" data-close>Fechar</button></div></div>`);
  modal.querySelectorAll('[data-tpl-page]').forEach(b => b.addEventListener('click', () => openTemplates(b.dataset.tplPage, model, photos)));
  modal.querySelectorAll('[data-tpl-model]').forEach(b => b.addEventListener('click', () => openTemplates(page, Number(b.dataset.tplModel), photos)));
  modal.querySelector('[data-tpl-photos]').addEventListener('change', e => openTemplates(page, model, e.target.checked));
}

/* ---------- Pix ---------- */
function openPix(uid) {
  const c = clients.find(x => x.uid === uid);
  if (!c) return;
  const code = pixFor(c);
  const modal = openModal(`<div class="modal-pad">${modalHead('COBRANÇA PIX', c.couple)}
    ${code ? `<div class="pix-box"><div class="pix-qr">${qrSvg(code)}</div><div>
      <p class="pix-amount">${money(c.amount)}</p><p class="field-hint" style="margin:0 0 12px">${esc(productNames(c.products).join(' · '))}</p>
      <label class="field"><span>Pix copia e cola</span><textarea class="pix-code" readonly>${esc(code)}</textarea></label>
      <div class="row-buttons" style="justify-content:flex-start;margin-top:10px"><button class="button button-secondary button-sm" data-copy-pix>Copiar código</button><button class="button button-secondary button-sm" data-copy-msg>Copiar mensagem de cobrança</button>${c.phone ? `<a class="button button-secondary button-sm" href="${esc(whatsappUrl(c.phone, chargeMessage(c)))}" target="_blank" rel="noopener">Enviar no WhatsApp</a>` : ''}</div>
    </div></div>` : '<div class="pix-warning">Cadastre sua chave Pix em <strong>Configurações</strong> para gerar o QR Code.</div>'}
    <div class="modal-actions"><button type="button" class="button button-quiet" data-back>Voltar</button>${code ? '' : '<button type="button" class="button button-secondary" data-settings>Abrir configurações</button>'}<button type="button" class="button button-primary" data-mark>Marcar como pago</button></div></div>`);
  modal.querySelector('[data-copy-pix]')?.addEventListener('click', () => copy(code, 'Código Pix copiado.'));
  modal.querySelector('[data-copy-msg]')?.addEventListener('click', () => copy(chargeMessage(c), 'Mensagem copiada.'));
  modal.querySelector('[data-settings]')?.addEventListener('click', openSettings);
  modal.querySelector('[data-back]').addEventListener('click', () => openDetail(uid));
  modal.querySelector('[data-mark]').addEventListener('click', () => setStatus(uid, 'pago'));
}

/* ---------- Configurações ---------- */
function openSettings() {
  const modal = openModal(`<form id="settings-form">${modalHead('CONFIGURAÇÕES', 'Pix e preços')}
    <div class="modal-fields">
      ${field('pixKey', 'Chave Pix', settings.pixKey, 'required placeholder="CPF, CNPJ, e-mail, telefone (+55...) ou chave aleatória"', true)}
      ${field('pixName', 'Nome do recebedor', settings.pixName, 'required maxlength="25" placeholder="Como aparece no banco"')}
      ${field('pixCity', 'Cidade do recebedor', settings.pixCity, 'required maxlength="15" placeholder="Ex.: SAO PAULO"')}
      <p class="form-section">Preço padrão de cada produto<small>Usado para somar o valor de novas compras.</small></p>
      ${PRODUCT_KEYS.map(k => field(`price-${k}`, esc(PRODUCTS[k].name), priceOf(k).toFixed(2), 'type="number" min="0" step="0.01"')).join('')}
    </div>
    <p class="field-hint">Telefone como chave Pix deve ter o formato +5511999990000.</p>
    <div class="modal-actions"><button type="button" class="button button-quiet" data-close>Cancelar</button><button type="submit" class="button button-primary">Salvar configurações</button></div></form>`);
  $('#settings-form', modal).addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const next = { pixKey: form.pixKey.value.trim(), pixName: form.pixName.value.trim(), pixCity: form.pixCity.value.trim(), prices: Object.fromEntries(PRODUCT_KEYS.map(k => [k, Number(form[`price-${k}`].value || 0)])) };
    try {
      await setDoc(doc(db, 'settings', 'main'), { ...next, updatedAt: serverTimestamp() });
      settings = next;
      modal.close();
      notify('Configurações salvas.');
      render();
    } catch (e) { console.error(e); notify('Não foi possível salvar. Confira as regras do Firestore.'); }
  });
}

/* ---------- Login ---------- */
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#auth-submit');
  button.disabled = true; $('#auth-error').textContent = '';
  try { await signInWithEmailAndPassword(auth, $('#auth-email').value.trim(), $('#auth-password').value); }
  catch (error) { $('#auth-error').textContent = error.code === 'auth/invalid-credential' ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.'; }
  finally { button.disabled = false; }
});
$('#sign-out').addEventListener('click', () => signOut(auth));
$('#open-settings').addEventListener('click', openSettings);
$('#open-templates').addEventListener('click', () => openTemplates());

onAuthStateChanged(auth, async user => {
  stopClients?.(); stopClients = null;
  if (!user || !isAdmin(user)) {
    $('#app-shell').hidden = true; $('#auth-panel').hidden = false;
    if (user) { $('#auth-error').textContent = 'Esta conta não tem acesso ao painel administrativo.'; await signOut(auth); }
    return;
  }
  $('#auth-panel').hidden = true; $('#app-shell').hidden = false;
  $('#page-content').innerHTML = '<p class="muted-cell">Carregando clientes...</p>';
  try {
    const saved = await getDoc(doc(db, 'settings', 'main'));
    if (saved.exists()) settings = { ...settings, ...saved.data() };
  } catch (e) { console.error(e); }
  stopClients = onSnapshot(query(collection(db, 'clients'), orderBy('createdAt', 'desc')), snap => {
    clients = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
    render();
  }, error => {
    console.error(error);
    $('#page-content').innerHTML = '<div class="pix-warning">Não foi possível ler os clientes. Publique as regras de firestore.rules no Firebase Console e confira o e-mail de administrador em lib/firebase.js.</div>';
  });
});
