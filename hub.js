import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db, isAdmin, loginToEmail } from './lib/firebase.js';
import { PRODUCTS, money, dateLong, esc, productLink, modelName } from './lib/catalog.js';
import { qrSvg } from './lib/pix.js';

const $ = (s, root = document) => root.querySelector(s);
const icons = {
  convite: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="m3 8 9 6 9-6"/>',
  lista: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 0 6-1.5S14 5 12 9"/>',
  ebook: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 7h6M9 11h6"/>',
  site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  organizador: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3"/>',
};
const icon = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const descriptions = {
  convite: 'Envie o link para os convidados abrirem o convite e confirmarem presença.',
  lista: 'Os convidados escolhem o presente e a lista se atualiza sozinha.',
  ebook: 'Brincadeiras, checklists e cartelas personalizadas para imprimir.',
  site: 'Página do casamento com contagem regressiva, local e confirmação de presença.',
  organizador: 'Convidados, orçamento, cronograma e checklist do casamento.',
};

let account = null, site = null, rsvps = [], reservas = [], gifts = [], unsubscribers = [], toastTimer;

function notify(message) { const t = $('#toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
async function copy(text, message = 'Link copiado.') { try { await navigator.clipboard.writeText(text); notify(message); } catch { prompt('Copie o texto abaixo:', text); } }

function render() {
  const paid = account.status === 'pago';
  const products = Object.keys(account.products || {}).filter(k => PRODUCTS[k]);
  const going = rsvps.filter(r => r.attending), notGoing = rsvps.filter(r => !r.attending);
  const giftName = id => gifts.find(g => g.id === id)?.name || id;
  const card = key => {
    const url = productLink(key, account.slug), model = modelName(key, account.products[key]);
    let actions = '';
    if (!paid) actions = '<span class="field-hint">Liberado após a confirmação do pagamento.</span>';
    else if (key === 'organizador') actions = `<a class="button button-primary button-sm" href="${esc(url)}">Abrir organizador</a>`;
    else if (key === 'ebook') actions = '<button class="button button-primary button-sm" data-ebook>Baixar PDF</button>';
    else actions = `<a class="button button-primary button-sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a><button class="button button-secondary button-sm" data-copy="${esc(url)}">Copiar link</button><a class="button button-secondary button-sm" href="https://wa.me/?text=${encodeURIComponent(url)}" target="_blank" rel="noopener">WhatsApp</a>`;
    return `<article class="card product-card ${paid ? '' : 'is-locked'}"><div class="product-card-head"><span class="product-icon">${icon(key)}</span><div><h3>${esc(PRODUCTS[key].name)}</h3><span class="model-tag">Modelo ${esc(model)}</span></div></div><p>${descriptions[key]}</p><div class="row-buttons">${actions}</div></article>`;
  };
  const hasRsvp = products.some(k => ['convite', 'site'].includes(k)), hasGifts = products.includes('lista');
  $('#page-content').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">ÁREA DO CLIENTE</p><h1>Olá, ${esc(account.couple)}.</h1><p>${paid ? 'Tudo liberado. Compartilhe os links com seus convidados.' : 'Seu pedido está aguardando a confirmação do pagamento.'}</p></div></div>
    ${!paid && account.status !== 'cancelado' ? `<section class="card pay-card">${account.pix ? `<div class="pix-qr">${qrSvg(account.pix)}</div>` : ''}<div><h2>Pagamento pendente · ${money(account.amount)}</h2><p>${account.pix ? 'Pague pelo Pix lendo o QR Code ou usando o código copia e cola. A liberação é feita assim que confirmarmos o pagamento.' : 'Combine o pagamento pelo WhatsApp. A liberação é feita assim que confirmarmos.'}</p>${account.pix ? '<button class="button button-primary" data-copy-pix>Copiar código Pix</button>' : ''}</div></section>` : ''}
    ${account.status === 'cancelado' ? '<div class="pix-warning" style="margin-bottom:20px">Este pedido foi cancelado. Fale com a gente pelo WhatsApp se precisar de ajuda.</div>' : ''}
    <section class="products-grid">${products.map(card).join('')}</section>
    ${paid && (hasRsvp || hasGifts) ? `<section class="hub-panels">
      ${hasRsvp ? `<article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Confirmações de presença</h2><p class="panel-subtitle">${going.reduce((n, r) => n + Number(r.people || 1), 0)} pessoas confirmadas · ${notGoing.length} não poderão ir</p></div></div>
        <div class="hub-list">${rsvps.length ? rsvps.map(r => `<div class="hub-list-row"><div><strong>${esc(r.name)}</strong><small>${r.attending ? `Vai · ${Number(r.people || 1)} ${Number(r.people) === 1 ? 'pessoa' : 'pessoas'}` : 'Não poderá ir'} · ${r.product === 'site' ? 'Site' : 'Convite'}</small>${r.message ? `<q>${esc(r.message)}</q>` : ''}</div><small>${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('pt-BR') : ''}</small></div>`).join('') : '<p class="hub-empty">Nenhuma confirmação ainda. Compartilhe o link com os convidados.</p>'}</div></article>` : ''}
      ${hasGifts ? `<article class="card panel"><div class="panel-head"><div><h2 class="panel-title">Presentes escolhidos</h2><p class="panel-subtitle">${reservas.length} ${reservas.length === 1 ? 'presente escolhido' : 'presentes escolhidos'}${gifts.length ? ` de ${gifts.length}` : ''}</p></div></div>
        <div class="hub-list">${reservas.length ? reservas.map(r => `<div class="hub-list-row"><div><strong>${esc(giftName(r.id))}</strong><small>Por ${esc(r.name)}</small>${r.message ? `<q>${esc(r.message)}</q>` : ''}</div><small>${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('pt-BR') : ''}</small></div>`).join('') : '<p class="hub-empty">Nenhum presente escolhido ainda.</p>'}</div></article>` : ''}
    </section>` : ''}`;
  $('#page-content').querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copy(b.dataset.copy)));
  $('#page-content').querySelector('[data-copy-pix]')?.addEventListener('click', () => copy(account.pix, 'Código Pix copiado.'));
  $('#page-content').querySelector('[data-ebook]')?.addEventListener('click', downloadEbook);
}

async function downloadEbook(event) {
  const button = event.currentTarget;
  button.disabled = true; button.textContent = 'Gerando PDF...';
  try {
    const { generateEbook } = await import('./lib/ebook.js');
    generateEbook(site, Number(account.products.ebook) || 1);
    notify('Ebook gerado. Confira seus downloads.');
  } catch (e) { console.error(e); notify('Não foi possível gerar o PDF. Verifique a conexão.'); }
  finally { button.disabled = false; button.textContent = 'Baixar PDF'; }
}

$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#auth-submit');
  button.disabled = true; $('#auth-error').textContent = '';
  try { await signInWithEmailAndPassword(auth, loginToEmail($('#auth-user').value), $('#auth-password').value); }
  catch (error) { $('#auth-error').textContent = error.code === 'auth/invalid-credential' ? 'Usuário ou senha incorretos.' : error.code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde e tente novamente.' : 'Não foi possível entrar. Tente novamente.'; }
  finally { button.disabled = false; }
});
$('#sign-out').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async user => {
  unsubscribers.forEach(stop => stop()); unsubscribers = [];
  if (!user) { $('#app-shell').hidden = true; $('#auth-panel').hidden = false; return; }
  $('#auth-panel').hidden = true; $('#app-shell').hidden = false;
  $('#admin-link').hidden = !isAdmin(user);
  try {
    account = (await getDoc(doc(db, 'accounts', user.uid))).data() || null;
    if (!account) {
      $('#page-content').innerHTML = isAdmin(user)
        ? '<div class="page-heading"><div><p class="eyebrow">ADMINISTRADOR</p><h1>Olá.</h1><p>Esta conta é de administração. Use o painel para gerenciar os clientes.</p></div><div class="heading-actions"><a class="button button-primary" href="admin.html">Abrir painel admin</a></div></div>'
        : '<div class="pix-warning">Não encontramos produtos nesta conta. Fale com a gente pelo WhatsApp.</div>';
      return;
    }
    site = (await getDoc(doc(db, 'sites', account.slug))).data() || null;
    gifts = (await import('./lib/gifts.js').catch(() => ({ GIFTS: [] }))).GIFTS || [];
    render();
    if (account.status === 'pago') {
      const sorted = snap => snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (account.products.convite || account.products.site) unsubscribers.push(onSnapshot(collection(db, 'sites', account.slug, 'rsvps'), snap => { rsvps = sorted(snap); render(); }, e => console.error(e)));
      if (account.products.lista) unsubscribers.push(onSnapshot(collection(db, 'sites', account.slug, 'reservas'), snap => { reservas = sorted(snap); render(); }, e => console.error(e)));
    }
  } catch (error) {
    console.error(error);
    $('#page-content').innerHTML = '<div class="pix-warning">Não foi possível carregar seus produtos. Verifique a conexão e tente de novo.</div>';
  }
});
