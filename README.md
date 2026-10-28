# Entre Nós — plataforma de produtos para casamento

Site estático (HTML, CSS e JavaScript) conectado ao Firebase Authentication e ao Cloud Firestore. Um único site atende todos os clientes: cada casal recebe links próprios (`convite.html?c=marina-rafael`) e um usuário e senha para a área do cliente.

## Produtos

| Produto | Página | Usa os dados de |
| --- | --- | --- |
| Convite virtual interativo de chá de panela | `convite.html?c=<link>` | Chá de panela |
| Lista de presentes de chá de panela | `lista.html?c=<link>` | Chá de panela |
| Ebook PDF chá de panela | baixado na área do cliente | Chá de panela |
| Site de casamento | `site.html?c=<link>` | Casamento |
| Organizador de casamento | `index.html` (com login) | Casamento |

Modelos do convite, da lista e do site: **Terracota**, **Figurinha**, **Elegante** e **Oliva** (`TEMPLATES` em `lib/catalog.js`). O ebook e o organizador continuam com Jardim, Rosé e Gala (`MODELS`).

## Fotos e textos de cada casal

No painel, abra o cliente → **Fotos e textos**:

- **Fotos**: foto principal, dois rostos recortados e até 4 fotos de galeria (polaroids com legenda). As fotos são reduzidas no navegador e salvas em `sites/{link}/fotos/{slot}`. Um PNG sem fundo vira figurinha com contorno branco.
- **Textos**: nome do evento, frases, boas-vindas, roteiro do dia, Pix com valores divertidos, paleta de cores, nossa história e informações do site. Campo vazio usa o texto padrão (`lib/content.js`). Fica em `sites/{link}.custom`.

## Páginas

- `index.html`: organizador de casamento (página principal do site): convidados, financeiro, cronograma etc.
- `cliente.html`: área do cliente. Login com usuário e senha, produtos comprados, Pix pendente, confirmações de presença e presentes escolhidos.
- `admin.html`: painel administrativo. Cadastrar compras, gerar usuário e senha, gerar QR Code Pix, marcar como pago, redefinir senha, cancelar e excluir.
- `convite.html`, `lista.html`, `site.html`: páginas públicas que os convidados abrem.
- `organizador.html`: só redireciona para `index.html` (mantido para links antigos).

## Configuração (uma vez)

1. **E-mail de administrador**: troque `seu-email-de-admin@exemplo.com` pelo seu e-mail em `lib/firebase.js` (`ADMIN_EMAILS`) **e** em `firestore.rules`.
2. **Firebase Console → Authentication → Sign-in method**: ative **E-mail/senha**.
3. **Authentication → Users → Adicionar usuário**: crie o seu usuário administrador com esse e-mail e uma senha.
4. **Authentication → Settings → Domínios autorizados**: adicione o domínio onde o site ficará hospedado.
5. **Firestore Database → Regras**: cole o conteúdo de `firestore.rules` e publique.
6. Hospede todos os arquivos (qualquer hospedagem estática: Firebase Hosting, Netlify, GitHub Pages…). Para testar localmente, sirva a pasta por HTTP (ex.: `python -m http.server`).
7. Entre em `admin.html` → **Configurações** e cadastre sua chave Pix, nome e cidade do recebedor e os preços padrão.

## Fluxo de venda

1. **Novo cliente**: nomes do casal, WhatsApp, produtos e modelos, datas e locais. O usuário e a senha são gerados na hora.
2. **Pix**: gere o QR Code e copie a mensagem de cobrança (ou envie direto pelo WhatsApp). O cliente também vê o Pix ao entrar na área dele.
3. **Marcar como pago**: libera os links públicos e os produtos na área do cliente.
4. **Mensagem de acesso**: copie e envie ao casal (área do cliente, usuário, senha e links).

## Como funciona por dentro

Coleções do Firestore:

- `clients/{uid}`: cadastro completo, inclusive a senha gerada (só o admin lê).
- `accounts/{uid}`: resumo da compra visto pelo cliente (status, produtos, código Pix).
- `sites/{link}`: dados públicos das páginas (casal, datas, locais, modelos, se está liberado).
- `sites/{link}/rsvps`: confirmações de presença do convite e do site.
- `sites/{link}/reservas`: presentes escolhidos na lista (um por presente).
- `sites/{link}/fotos`: fotos do casal usadas nas páginas (só o admin envia).
- `planners/{uid}`: dados do organizador.
- `settings/main`: chave Pix e preços.

Observações:

- Clientes entram com um usuário simples; internamente o Firebase usa o e-mail `usuario@acesso.entrenos.app`.
- Para redefinir a senha sem servidor, o painel entra na conta do cliente com a senha guardada e define uma nova. Por isso os clientes não trocam a senha sozinhos.
- O Pix é um BR Code estático gerado no navegador. A confirmação do pagamento é manual (botão **Marcar como pago**).
- Contas antigas do organizador, criadas antes da plataforma, não têm cadastro em `accounts` e continuam abrindo o organizador normalmente.
- PDFs (ebook e relatórios do organizador) são gerados no navegador com jsPDF carregado por CDN.
