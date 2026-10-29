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

## Cerimonialista virtual (organizador)

Os alertas e o checklist ficam em `lib/planner.js` e só usam os dados do planejamento. A conversa usa IA (Gemini pelo Firebase AI Logic, em `lib/ai.js`), sem servidor próprio: a cada pergunta vai um resumo do planejamento (sem telefones nem e-mails) e a resposta aparece enquanto é escrita. Se a IA falhar (sem internet, cota esgotada, App Check), a resposta sai da versão básica abaixo. Os modelos ficam em `AI_MODELS`, em `lib/ai.js`: se o primeiro estiver sobrecarregado, tenta o próximo.

- **Nosso casamento**: data, convidados previstos, orçamento máximo, estilo e tipo de cerimônia (em "Detalhes do casamento"). Gera o orçamento por convidado e a divisão sugerida por categoria (`BUDGET_SPLIT`).
- **Fornecedores**: orçamentos com preço, desconto, taxas, itens inclusos e condições, comparados lado a lado por categoria. "Contratar" cria o gasto no financeiro com entrada e parcelas.
- **Parcelas**: cada gasto pode ter parcelas com vencimento; marcar como paga atualiza o valor pago.
- **Checklist do casamento**: etapas por prazo (12 meses antes até a semana do casamento), ajustadas pelo estilo, tipo de cerimônia e número de convidados. Contratações ficam resolvidas sozinhas quando há fornecedor contratado ou gasto na categoria.
- **Tarefas por pessoa**: no Cronograma, a aba "Por pessoa" junta as tarefas de cada responsável com o prazo (atrasada, vence hoje, vence amanhã, faltam X dias). O menu mostra quantas estão atrasadas ou vencem em até 3 dias. "Na agenda" gera um arquivo `.ics` com as tarefas daquela pessoa e alarmes de 1 dia antes e no dia, para a agenda do celular avisar mesmo com o site fechado (sem servidor).
- **Convidados**: família, restrições alimentares, mesas (arrastar para a mesa), confirmações do site de casamento trazidas para a lista e exportação para o buffet (PDF) e planilha (CSV).
- **Dia do casamento**: linha do tempo do dia (cerimonial, chegada dos fornecedores, tarefas e endereços), contatos de emergência, endereços, plano B, kit de emergência e roteiro por pessoa (WhatsApp ou PDF).
- **Lua de mel**: destinos, comparação de hospedagens e passagens, reservas com anexos, roteiro por dia, malas e documentos, "Nossa viagem dos sonhos" e quanto falta economizar.
- **Inspirações**: murais com fotos, links e paleta de cores para cada parte do casamento.
- **Documentos**: documentos essenciais (checklist), pastas próprias e todos os arquivos e links anexados em qualquer parte do planejamento.
- **Acesso do casal**: no painel admin, "Criar acesso do parceiro(a)" cria um segundo login. A conta dele tem `plannerUid` em `accounts` apontando para o planejamento do dono, e os dois editam o mesmo planejamento em tempo real.
- **Alertas e perguntas** no painel: parcelas vencidas e a vencer, hora de contratar, tarefas atrasadas, orçamento estourado, convidados sem resposta. A versão básica da cerimonialista (reserva quando a IA está fora) conversa em formato de chat: entende pedidos soltos ("tô perdida", "me dá uma dica", "tô nervosa", "oi"), dá os próximos passos pelo planejamento do casal, dicas por assunto (vestido, buffet, decoração, foto, música, convites, lua de mel, plano B, cartório...) e sugere perguntas de continuação. Ela lembra o assunto da conversa e o momento do casal com cada fornecedor ("tô olhando", "e o contrato?", "já fechei", "mais dicas") sem repetir o que já disse. O conhecimento fica em `lib/wedding-kb.js`: por assunto, o que fazer para começar, o que perguntar, como comparar, sinais de alerta, o que conferir no contrato e o que alinhar depois de fechar, além de cronogramas prontos do dia (à noite, almoço e praia) que podem ser levados para o Cerimonial.

## Configuração (uma vez)

1. **E-mail de administrador**: troque `seu-email-de-admin@exemplo.com` pelo seu e-mail em `lib/firebase.js` (`ADMIN_EMAILS`) **e** em `firestore.rules`.
2. **Firebase Console → Authentication → Sign-in method**: ative **E-mail/senha**.
3. **Authentication → Users → Adicionar usuário**: crie o seu usuário administrador com esse e-mail e uma senha.
4. **Authentication → Settings → Domínios autorizados**: adicione o domínio onde o site ficará hospedado.
5. **Firestore Database → Regras**: cole o conteúdo de `firestore.rules` e publique.
6. Hospede todos os arquivos (qualquer hospedagem estática: Firebase Hosting, Netlify, GitHub Pages…). Para testar localmente, sirva a pasta por HTTP (ex.: `python -m http.server`).
7. Entre em `admin.html` → **Configurações** e cadastre sua chave Pix, nome e cidade do recebedor e os preços padrão.
8. **Cerimonialista com IA**: Firebase Console → **AI Services → AI Logic** → **Começar** → escolha **Gemini Developer API**. O assistente ativa as APIs e liga o App Check para o AI Logic.
9. **App Check** (protege a cota da IA): Firebase Console → **App Check → Apps** → registre o app da web com **reCAPTCHA Enterprise** (o domínio do site precisa estar na chave) e cole a chave do site em `APP_CHECK_SITE_KEY`, em `lib/firebase.js`. Para testar em `localhost`, abra o site, copie o *debug token* que aparece no console do navegador e cadastre em **App Check → Apps → Gerenciar tokens de depuração**.

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
- `planners/{uid}/anexos`: fotos, PDFs e contratos anexados aos gastos do financeiro (cada arquivo de até 8 MB é guardado em partes de 700 KB).
- `settings/main`: chave Pix e preços.

Observações:

- Clientes entram com um usuário simples; internamente o Firebase usa o e-mail `usuario@acesso.entrenos.app`.
- Para redefinir a senha sem servidor, o painel entra na conta do cliente com a senha guardada e define uma nova. Por isso os clientes não trocam a senha sozinhos.
- O Pix é um BR Code estático gerado no navegador. A confirmação do pagamento é manual (botão **Marcar como pago**).
- Contas antigas do organizador, criadas antes da plataforma, não têm cadastro em `accounts` e continuam abrindo o organizador normalmente.
- PDFs (ebook e relatórios do organizador) são gerados no navegador com jsPDF carregado por CDN.
