# Entre Nós — planejamento de casamento

SPA responsiva em HTML, CSS e JavaScript, sem etapa de build ou dependências externas. Abra `index.html` no navegador para começar. Os dados ficam salvos localmente neste navegador.

## O que está incluído

- Visão geral com contagem regressiva, convidados confirmados, orçamento e tarefas.
- Lista de convidados com busca, filtros, acompanhantes e gestão dos convites.
- Orçamento por categoria, incluindo valores previstos, pagos e forma de pagamento.
- Roteiro do cortejo editável e opção **Exportar roteiro em PDF** (abre a impressão; escolha “Salvar como PDF”).
- Checklist do que levar, com estados pendente, comprado, no carro e no local.
- Cronograma por dia, com horários, detalhes e andamento das tarefas.
- Edição dos nomes, da data e do local do casamento.

Para recomeçar com os dados de exemplo, apague a chave `entre-nos-casamento-v1` do armazenamento local deste site no navegador.

## Importacao e relatorios

- Importe arquivos `.txt` ou cole texto para convidados, gastos, checklist do sitio e musicas/cortejo. A previa permite corrigir campos e escolher entre adicionar ou substituir a lista.
- Exporte PDFs do roteiro da cerimonia, do relatorio financeiro e do checklist com cronograma e responsaveis.
- A geracao de PDF roda no navegador usando jsPDF e AutoTable carregados pelo CDN; e necessaria conexao para carregar essas bibliotecas.
