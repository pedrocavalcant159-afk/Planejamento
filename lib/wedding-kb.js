// Conhecimento da cerimonialista virtual: dicas por assunto e cronogramas prontos do dia.
// Cada assunto tem seções por momento do casal: começando, pesquisando, fechando e depois de contratar.
// Quem decide qual seção mostrar é o answer() em lib/planner.js.

export const SECTION_INTROS = {
  start: 'Para começar:',
  ask: 'Leve estas perguntas para a conversa:',
  compare: 'Na hora de comparar os orçamentos, olhe:',
  alert: 'Fique de olho nestes sinais de alerta:',
  contract: 'Antes de assinar, confira no contrato:',
  after: 'Agora que está fechado, alinhe:',
  price: 'Sobre o preço:',
  more: 'Mais algumas dicas:',
};

// Ordem das seções conforme o momento do casal com aquele assunto.
export const STAGE_FLOW = {
  inicio: ['start', 'ask', 'compare', 'alert', 'contract', 'after', 'more'],
  olhando: ['ask', 'compare', 'alert', 'contract', 'after', 'more'],
  fechando: ['contract', 'alert', 'after', 'more'],
  contratado: ['after', 'more'],
  preco: ['price', 'compare', 'ask', 'contract'],
};

// O que perguntar ao fechar qualquer fornecedor (usado quando o assunto não tem lista própria).
const CONTRACT_BASE = [
  'Data, horário de início e fim do serviço e o endereço do evento.',
  'Tudo o que está incluso, item por item, sem "a combinar".',
  'Valor total, entrada, parcelas e datas de pagamento.',
  'Hora extra: quanto custa e como é cobrada.',
  'Multa e regras se alguém precisar cancelar ou mudar a data.',
  'O que acontece se o profissional ficar doente (quem substitui).',
];

export const TOPICS = [
  {
    key: 'audiovisual', checklist: 'audiovisual', category: 'Audiovisual', go: 'fornecedores', title: 'Fotografia e filmagem', who: 'o fotógrafo',
    re: /foto|fotograf|video|filmag|filmaker|audiovisual|drone|making of/,
    start: ['Os bons fotógrafos fecham a agenda com 10 a 12 meses de antecedência.', 'Escolha pelo estilo: mais espontâneo (fotojornalismo) ou mais posado e editorial.', 'Separe 3 a 5 nomes e peça para ver um casamento completo de cada um, não só os melhores cliques.'],
    ask: ['Você já fotografou no nosso local? Conhece a luz de lá?', 'Quantas horas de cobertura estão inclusas e a partir de quando (making of, cerimônia, festa)?', 'Vai sozinho ou com segundo fotógrafo ou assistente?', 'Quantas fotos editadas entregamos e em quanto tempo? Por galeria online, pen drive ou álbum?', 'Tem equipamento reserva (câmera, lentes, cartões) no dia?', 'Se faz vídeo também: é teaser, filme curto ou o casamento completo? Tem drone?'],
    compare: ['Compare pelas horas de cobertura e pelo que é entregue, não só pelo preço final.', 'Veja se o álbum impresso está incluso ou é cobrado à parte (costuma pesar bastante).', 'Prazo de entrega: algo entre 30 e 90 dias é comum; mais que isso, pergunte o motivo.', 'Ensaio pré-wedding incluso ou não.', 'Cobrança de deslocamento e alimentação da equipe.'],
    alert: ['Não mostrar um casamento inteiro, só fotos soltas.', 'Não ter contrato por escrito ou pedir pagamento total adiantado.', 'Muitas reclamações de atraso na entrega.', 'Não ter equipamento reserva.'],
    contract: ['Horário de chegada e de saída da equipe e quanto custa a hora extra.', 'Quantidade mínima de fotos editadas e prazo de entrega por escrito.', 'Direito de uso das imagens: se podem postar as suas fotos e se vocês podem pedir que não.', 'Quem substitui o fotógrafo se ele não puder ir.', 'Por quanto tempo ele guarda os arquivos originais (backup).', ...CONTRACT_BASE.slice(2, 5)],
    after: ['Mande a ele o cronograma do dia e o endereço do making of.', 'Faça uma lista das fotos que não podem faltar (avós, padrinhos, amigos de infância).', 'Escolha alguém da família para chamar as pessoas na hora das fotos em grupo.', 'Combine onde a equipe vai comer e se terá mesa reservada.'],
    price: ['O preço muda com as horas de cobertura, segundo fotógrafo, álbum e vídeo.', 'Pacote com foto e vídeo da mesma empresa costuma sair mais barato.', 'Casamento em dia de semana ou fora da alta temporada abre espaço para desconto.'],
    more: ['Ensaio pré-wedding ajuda vocês a perderem a vergonha da câmera antes do dia.', 'Reserve 20 minutos depois da cerimônia só para as fotos com família e padrinhos.', 'Um "momento a sós" de 10 minutos depois da cerimônia rende as fotos mais bonitas do casal.'],
  },
  {
    key: 'buffet', checklist: 'buffet', category: 'Comidas & Buffet', go: 'fornecedores', title: 'Buffet', who: 'o buffet',
    re: /buffet|bufe|comida|cardapio|salgad|jantar|almoco|garcom|garcons|bebida|bar\b|drinks?|chopp|cerveja/,
    start: ['É a maior fatia do orçamento, cerca de 38%. Feche o buffet uns 11 meses antes.', 'Antes de pedir orçamento, tenha uma estimativa de convidados: o preço é por pessoa.', 'Decida o estilo do serviço: jantar empratado, buffet à vontade, ilha de comidas ou coquetel volante.'],
    ask: ['O que está incluso no valor por pessoa: bebidas, garçons, louça, toalhas, mesas?', 'Quantos garçons para o nosso número de convidados?', 'Como cobram crianças? A partir de que idade?', 'Qual a tolerância de convidados a mais ou a menos? Até quando dá para ajustar o número?', 'A degustação é gratuita? Para quantas pessoas?', 'Têm opções para vegetarianos, intolerantes e alérgicos?'],
    compare: ['Compare o valor por pessoa com tudo incluso, não o preço "a partir de".', 'Bebidas: incluso, cobrado à parte ou pode levar a sua (e se cobram taxa de rolha).', 'Duração do serviço e quanto custa a hora extra.', 'Quantidade de salgados, pratos e sobremesas por pessoa.'],
    alert: ['Não oferecer degustação antes de fechar.', 'Valor por pessoa muito abaixo dos outros sem explicar o que fica de fora.', 'Não ter alvará ou não falar sobre vigilância sanitária.'],
    contract: ['Cardápio completo e quantidades por pessoa.', 'Número de convidados contratado e prazo para o número final.', 'Bebidas inclusas e por quanto tempo.', 'Número de garçons, copeiros e cozinheiros.', 'Horário de montagem, de serviço e de desmontagem.', ...CONTRACT_BASE.slice(2, 5)],
    after: ['Marque a degustação uns 3 meses antes.', 'Mande a lista de restrições alimentares (está na aba Convidados).', 'Feche o número final de convidados 1 mês antes.', 'Combine a refeição da equipe de fornecedores.'],
    price: ['O número de convidados é o que mais pesa: cada pessoa a menos reduz buffet, bebida, doces e lembrancinhas.', 'Almoço costuma sair mais barato que jantar.', 'Coquetel volante e ilhas podem ser mais em conta que jantar empratado.'],
    more: ['Para festa de 4 a 5 horas, peça um reforço de comida no fim (um caldinho ou lanchinho na pista).', 'Água e refrigerante sempre à vista evitam fila no bar.'],
  },
  {
    key: 'local', checklist: 'local', category: 'Local / Espaço / Sítio', go: 'fornecedores', title: 'Local', who: 'o local',
    re: /\blocal\b|espaco|sitio|salao|chacara|fazenda|igreja para|onde casar/,
    start: ['É a primeira contratação: a data depende dele. Reserve uns 12 meses antes.', 'Visite pelo menos 3 lugares, de preferência no mesmo horário do casamento, para ver a luz.', 'Tenha uma estimativa de convidados antes de visitar.'],
    ask: ['Qual a capacidade com mesas e com pista de dança?', 'Até que horas pode ter som? Tem horário limite?', 'É obrigatório usar o buffet ou a decoração da casa?', 'Tem gerador, estacionamento, acessibilidade e área coberta?', 'Quantas horas de uso estão inclusas, com montagem e desmontagem?', 'Tem lugar para o making of da noiva e do noivo?'],
    compare: ['Compare o que vem incluso: mesas, cadeiras, toalhas, iluminação, segurança, limpeza.', 'Distância e facilidade de chegada para os convidados.', 'Se a cerimônia e a festa podem ser no mesmo lugar (economiza transporte e decoração).'],
    alert: ['Não deixar visitar antes de fechar.', 'Não ter plano para chuva em local aberto.', 'Regras de fornecedor exclusivo sem tabela de preço.'],
    contract: ['Data, horário de entrada e de saída.', 'Itens inclusos e quantidades.', 'Fornecedores obrigatórios ou proibidos.', 'Regras de som, fogos e decoração (pode furar, pendurar?).', ...CONTRACT_BASE.slice(2, 5)],
    after: ['Combine com o local os horários de montagem de cada fornecedor.', 'Pegue a planta do espaço para montar o mapa de mesas.', 'Defina o plano B de chuva com eles.'],
    price: ['Sexta, domingo e meses fora da alta temporada costumam ser mais baratos.', 'Lugares que já têm estrutura reduzem o gasto com decoração e aluguel de móveis.'],
    more: ['Pense no conforto: sombra para cerimônia de dia, aquecimento ou tenda em lugar frio.', 'Banheiros suficientes para o número de convidados fazem diferença.'],
  },
  {
    key: 'decoracao', checklist: 'decoracao', category: 'Decoração & Cenografia', go: 'inspiracoes', title: 'Decoração', who: 'a decoração',
    re: /decora|\bflor|flores|cenograf|arranjo|centro de mesa|ilumina/,
    start: ['Junte referências no mural de Inspirações antes de pedir orçamento: fica muito mais fácil comparar.', 'Defina a paleta de cores e o estilo (rústico, clássico, boho...).', 'Contrate uns 9 meses antes.'],
    ask: ['O que está incluso: flores, mobiliário, iluminação, toalhas, louça da mesa posta?', 'As flores são naturais, artificiais ou mistas?', 'A decoração da cerimônia pode ser levada para a festa?', 'Fazem uma prévia ou maquete da mesa?', 'Quem monta e desmonta e em que horário?'],
    compare: ['Compare item por item: número de arranjos, tamanho e tipo de flor.', 'Flores da estação custam bem menos.', 'Veja se a iluminação cênica está inclusa (muda muito o resultado à noite).'],
    alert: ['Orçamento sem lista de itens.', 'Fotos só de catálogo, sem eventos reais.'],
    contract: ['Lista de todos os itens, com quantidades e flores escolhidas.', 'Substituição de flor se faltar na época (por qual).', 'Horário de montagem e desmontagem.', ...CONTRACT_BASE.slice(2, 5)],
    after: ['Mande o mapa de mesas e o número de convidados atualizado.', 'Combine com o local os horários de montagem.', 'Decida quem leva para casa os arranjos no fim (família, madrinhas).'],
    price: ['Reaproveitar a decoração da cerimônia na festa economiza bastante.', 'Menos arranjos e mais velas e verde também ficam lindos e custam menos.'],
    more: ['Centro de mesa baixo deixa as pessoas conversarem.', 'Placas de boas-vindas e mapa de mesas ajudam os convidados a se acharem.'],
  },
  {
    key: 'musica', checklist: 'musica', category: 'Banda & DJ', go: 'cerimonia', title: 'Música', who: 'a banda ou o DJ',
    re: /musica|banda|\bdj\b|\bsom\b|playlist|cantor|coral|quarteto|violino/,
    start: ['Banda e DJ costumam ser contratados uns 10 meses antes.', 'Pense em 3 momentos: cerimônia (músicos ao vivo ou som), recepção (música ambiente) e pista.', 'Veja vídeos de eventos reais, não só de estúdio.'],
    ask: ['Quantas horas de som e quantos intervalos?', 'Iluminação de pista e telão estão inclusos?', 'Podemos mandar a lista do que deve e do que não pode tocar?', 'Fazem a música da cerimônia também?', 'Precisam de qual estrutura do local (energia, palco)?'],
    compare: ['Compare as horas de música, os equipamentos e o número de músicos.', 'Hora extra: quanto custa.', 'Se o DJ também faz o som da cerimônia, economiza um fornecedor.'],
    alert: ['Não ter equipamento próprio.', 'Não aceitar sua lista de músicas.'],
    contract: ['Horário de início e fim, intervalos e hora extra.', 'Equipamentos inclusos (som, luz, microfone para o brinde).', ...CONTRACT_BASE.slice(2, 5)],
    after: ['Defina as músicas da entrada, das alianças e da saída em Cerimônia & músicas.', 'Mande o cronograma do dia com os momentos especiais (primeira dança, bolo, buquê).', 'Mande também a lista do que não pode tocar.'],
    price: ['DJ costuma custar menos que banda; uma boa mistura é músicos na cerimônia e DJ na festa.'],
    more: ['A primeira dança fica linda com uma música curta (ou só um trecho).', 'Deixe um microfone combinado para os discursos.'],
  },
  {
    key: 'vestido', checklist: 'vestido', category: 'Trajes & Beleza', go: 'fornecedores', title: 'Trajes', who: 'o ateliê',
    re: /vestido|traje|terno|smoking|roupa|ateli|noivo vai usar|sapato/,
    start: ['Comece a provar vestidos de 8 a 10 meses antes; sob medida pode levar 6 meses ou mais.', 'Decida entre comprar, alugar ou fazer sob medida.', 'O traje do noivo pode ser escolhido uns 5 meses antes.'],
    ask: ['Quantas provas estão inclusas?', 'Os ajustes estão no preço?', 'Qual o prazo de entrega?', 'No aluguel: até quando posso devolver e quem cuida da lavagem?'],
    compare: ['Compare o que está incluso: ajustes, véu, acessórios, lavagem.', 'Prazo de entrega com folga de pelo menos 1 mês antes do casamento.'],
    alert: ['Não ter prazo de entrega por escrito.', 'Cobrar cada ajuste separadamente sem avisar antes.'],
    contract: ['Modelo, tecido e cor descritos.', 'Datas das provas e de entrega.', 'Ajustes inclusos.', ...CONTRACT_BASE.slice(2, 4)],
    after: ['Leve o sapato e a lingerie que vai usar em todas as provas.', 'Primeira prova uns 2 meses antes; última prova uns 15 dias antes.', 'Combine quem ajuda a vestir no dia e quem leva o vestido até o making of.'],
    price: ['Aluguel ou vestido de coleção passada saem bem mais em conta.'],
    more: ['Amacie o sapato em casa antes do dia.', 'Tenha um sapato confortável reserva para a festa.'],
  },
  {
    key: 'beleza', checklist: 'beleza', category: 'Trajes & Beleza', go: 'fornecedores', title: 'Cabelo e maquiagem', who: 'a maquiadora',
    re: /maquiag|cabelo|beleza|\bmake\b|penteado|maquiador/,
    start: ['Contrate uns 6 meses antes.', 'Faça o teste uns 2 meses antes, com fotos de referência.'],
    ask: ['O teste está incluso?', 'Vai até o making of? Cobra deslocamento?', 'Atende também mães e madrinhas? Quanto cobra a mais?', 'Quanto tempo leva para cabelo e maquiagem?', 'A maquiagem dura a festa toda? Deixa um kit de retoque?'],
    compare: ['Compare o pacote (teste, deslocamento, retoque) e não só o preço da noiva.'],
    alert: ['Não fazer teste antes.', 'Agenda muito apertada no dia (vários eventos na mesma data).'],
    contract: ['Horário de chegada e quantas pessoas vai atender.', 'Teste e deslocamento inclusos ou não.', ...CONTRACT_BASE.slice(2, 4)],
    after: ['Coloque o horário de chegada no Cerimonial para não atrasar o making of.', 'Reserve umas 3 horas para a noiva.', 'Separe robe, água e um lanchinho para a hora do making of.'],
    price: ['Pacotes com mães e madrinhas costumam ter desconto.'],
    more: ['Hidrate a pele nas semanas anteriores e evite procedimentos novos perto do dia.'],
  },
  {
    key: 'bolo', checklist: 'bolo', category: 'Comidas & Buffet', go: 'fornecedores', title: 'Bolo e doces', who: 'a confeitaria',
    re: /\bbolo\b|doces|docinho|confeitar|bem casado|bem-casado/,
    start: ['Feche uns 6 meses antes.', 'Conte de 4 a 6 doces por convidado.'],
    ask: ['Fazem degustação?', 'O bolo é de verdade ou cenográfico?', 'Entregam e montam no local? Em que horário?', 'Têm opção sem lactose ou sem glúten?'],
    compare: ['Compare o preço por doce e o tipo de forminha.', 'Bolo cenográfico com um andar de verdade economiza bastante.'],
    alert: ['Não fazer degustação.'],
    contract: ['Quantidade e sabores dos doces.', 'Tamanho, sabor e decoração do bolo.', 'Horário de entrega e montagem.', ...CONTRACT_BASE.slice(2, 4)],
    after: ['Combine com a decoração o lugar da mesa de doces.', 'Decida quem corta e serve o bolo (o buffet costuma fazer).'],
    price: ['Bolo cenográfico com uma camada real e um bolo de corte na cozinha sai bem mais barato.'],
    more: ['Bem-casados são uma lembrancinha comestível que quase todo mundo leva.'],
  },
  {
    key: 'convites', checklist: 'convites', go: 'cronograma', title: 'Convites', who: 'a papelaria',
    re: /convite|save the date|papelaria/,
    start: ['Save the date: 6 a 8 meses antes. Convite: 2 a 3 meses antes.', 'Peça a confirmação até 30 dias antes, para fechar o número com o buffet.', 'Convite digital pelo WhatsApp economiza e já leva o link de confirmação do site.'],
    more: ['Coloque no convite: nomes, data, horário, endereço, traje e como confirmar.', 'Se não forem convidar crianças, escreva o nome de cada convidado no convite.', 'Para padrinhos, um convite especial ou uma caixinha é um carinho a mais.'],
  },
  {
    key: 'padrinhos', checklist: 'padrinhos', go: 'convidados', title: 'Padrinhos e madrinhas', who: 'os padrinhos',
    re: /padrinh|madrinh|daminha|pajem|florista/,
    start: ['Escolha uns 9 meses antes, para eles se programarem.', 'Não há número certo: escolham quem é importante, mesmo que fique ímpar.', 'Combine cores ou paleta dos trajes com antecedência.'],
    more: ['Dê a cada padrinho uma tarefa no dia: alianças, kit de emergência, chamar a família para as fotos.', 'Daminhas e pajens funcionam melhor a partir de uns 4 anos e com um adulto conhecido por perto.', 'Mande para eles o cronograma do dia e o horário de chegada.'],
  },
  {
    key: 'lua-de-mel', checklist: 'lua-de-mel', go: 'luademel', title: 'Lua de mel', who: 'a viagem',
    re: /lua de mel|viagem|destino|passagem|hotel|pousada|resort/,
    start: ['Reserve uns 7 meses antes, principalmente se for alta temporada.', 'Deixe o orçamento da viagem separado do casamento na aba Lua de mel.', 'Muitos hotéis dão mimos para recém-casados: avise que é lua de mel.'],
    more: ['Para viagem internacional, confira passaporte, visto, vacinas e seguro viagem.', 'Viajar 1 ou 2 dias depois do casamento dá tempo de descansar e arrumar a mala.', 'Dá para colocar cotas da lua de mel na lista de presentes.'],
  },
  {
    key: 'plano-b', checklist: 'plano-b', go: 'diad', title: 'Plano B', who: 'o plano B',
    re: /chuva|plano b|previsao|vento|calor|frio|imprevist/,
    start: ['Tenha uma área coberta reservada ou orçamento de tenda já combinado.', 'Defina até quando decidir (por exemplo, 3 dias antes, olhando a previsão).', 'Cadastre o plano B na Central do dia do casamento para a equipe saber o que fazer.'],
    more: ['Guarda-chuvas transparentes ficam lindos nas fotos.', 'Em dia de calor: água, leque e sombra para a cerimônia.', 'Monte o kit de emergência (costura, remédios, curativo, carregador) na Central do dia do casamento.'],
  },
  {
    key: 'cartorio', checklist: 'cartorio', go: 'documentos', title: 'Cartório e documentos', who: 'o cartório',
    re: /cartorio|civil|document|certidao|habilitacao|papelada/,
    start: ['Dê entrada na habilitação de casamento uns 3 meses antes.', 'Normalmente pedem documento com foto, certidão de nascimento atualizada e comprovante de endereço, além de 2 testemunhas. Confirme a lista no seu cartório.', 'Religioso com efeito civil: a habilitação também é feita no cartório.'],
    more: ['Guarde tudo digitalizado na aba Documentos.', 'Decida antes se alguém vai mudar o sobrenome.', 'Pergunte ao cartório a validade da habilitação para não perder o prazo.'],
  },
  {
    key: 'igreja', checklist: 'igreja', go: 'documentos', title: 'Igreja', who: 'a igreja',
    re: /igreja|padre|pastor|paroquia|curso de noivos|religios|celebrante|cerimonia simbolica/,
    start: ['Reserve a igreja junto com a data, uns 12 meses antes.', 'Pergunte quais documentos e cursos são pedidos (curso de noivos, batismo, proclamas).', 'Confirme se a igreja tem regras para fotos, músicas e decoração.'],
    more: ['Na cerimônia simbólica, o celebrante pode contar a história do casal: mande a ele as informações com antecedência.', 'Pergunte quanto tempo vocês têm na igreja (muitas têm horários seguidos).'],
  },
  {
    key: 'aliancas', checklist: 'aliancas', go: 'cronograma', title: 'Alianças', who: 'as alianças',
    re: /alianca/,
    start: ['Compre uns 4 meses antes para dar tempo da gravação e de ajustar o tamanho.', 'Meça o dedo no fim do dia, quando ele está um pouco mais inchado.'],
    more: ['Escolha quem leva as alianças no dia e coloque no Cerimonial.', 'Peça a nota e o certificado do material.'],
  },
  {
    key: 'lembrancinhas', checklist: 'lembrancinhas', go: 'checklist', title: 'Lembrancinhas', who: 'as lembrancinhas',
    re: /lembranc/,
    start: ['Defina uns 2 meses antes.', 'Uma por casal ou família costuma bastar.', 'As comestíveis e as úteis são as que as pessoas mais levam.'],
    more: ['Deixe as lembrancinhas na saída ou entregue na pista, no fim da festa.'],
  },
  {
    key: 'cortejo', go: 'cerimonia', title: 'Ordem de entrada na cerimônia', who: 'o cortejo',
    re: /cortejo|ordem de entrada|quem entra|entrada da noiva|entrada dos padrinhos|ordem da cerimonia|como funciona a cerimonia/,
    start: ['Uma ordem comum é: celebrante, noivo (com a mãe), pais da noiva e do noivo, padrinhos, pajens e daminhas, e por último a noiva (com o pai ou quem ela escolher).', 'Depois vêm a leitura ou a fala do celebrante, os votos, as alianças, a bênção e a saída dos noivos.', 'Não é regra: vocês podem entrar juntos ou mudar a ordem como quiserem.'],
    more: ['Ensaie a entrada com os padrinhos, nem que seja por vídeo.', 'Combine com o músico um sinal para a entrada da noiva.', 'Cadastre as músicas de cada momento em Cerimônia & músicas.'],
  },
  {
    key: 'confirmacao', go: 'convidados', title: 'Cobrar a confirmação', who: 'os convidados',
    re: /cobrar|nao responderam|nao confirmou|mensagem para (os )?convidados|lembrar os convidados/,
    start: ['Mande o lembrete 30 a 40 dias antes, com o link de confirmação.', 'Uma mensagem curta e carinhosa funciona melhor que uma cobrança.', 'Veja na aba Convidados quem ainda está como Enviado ou Pendente.'],
    message: 'Oi! Estamos muito felizes em preparar o nosso casamento e queremos muito você lá. Pode confirmar a sua presença até [data]? É rapidinho pelo link: [link]. Um beijo! ♡',
    more: ['Para quem não responder, uma ligação rápida resolve.', 'Feche o número final com o buffet 1 mês antes.'],
  },
  {
    key: 'criancas', go: 'convidados', title: 'Crianças no casamento', who: 'as crianças',
    re: /crianca|filhos dos convidados|sem criancas|kids|recreacao/,
    start: ['As duas escolhas são válidas. Se não forem convidar crianças, deixe claro no convite (com o nome de cada convidado).', 'Se forem convidar: pergunte ao buffet como cobra criança e pense em um espaço kids ou recreador.'],
    more: ['Cardápio infantil simples e uma mesa para elas ajudam muito.', 'Na aba Convidados dá para registrar as crianças de cada convite.'],
  },
  {
    key: 'presentes', checklist: 'presentes', go: null, title: 'Lista de presentes', who: 'a lista',
    re: /lista de presentes|presente|pix|cotas|cha de panela|cha bar|cha de cozinha/,
    start: ['Monte a lista uns 6 meses antes, com opções de vários valores.', 'Lista com Pix ou cotas (lua de mel, móveis) é cada vez mais comum e prática.', 'Coloque o link da lista no site do casamento e no convite.'],
    more: ['Agradeça cada presente: uma mensagem depois do casamento faz muita diferença.', 'Chá de panela ou chá bar é uma boa forma de montar a casa antes.'],
  },
  {
    key: 'votos', go: 'cerimonia', title: 'Votos e discursos', who: 'os votos',
    re: /voto|discurso|brinde|o que falar|texto para|carta/,
    start: ['Votos de 1 a 2 minutos são o ideal: escreva, leia em voz alta e corte.', 'Uma estrutura simples: como se conheceram, o que admira na pessoa e uma promessa para o futuro.', 'Leve impresso ou no celular, mesmo que saiba de cor.'],
    more: ['Combine com quem vai fazer o brinde (padrinho, pai, amigo) e o tempo de fala.', 'Avise o DJ para ter microfone pronto.'],
  },
  {
    key: 'assessoria', go: 'cerimonial', title: 'Cerimonialista do dia', who: 'a assessoria',
    re: /assessor|cerimonialista|coordenador|quem coordena/,
    start: ['Mesmo planejando sozinhos, ter alguém coordenando no dia deixa vocês livres para curtir.', 'Pode ser uma assessoria só do dia ou uma pessoa de confiança com o roteiro na mão.', 'O Cerimonial do casamento e o Roteiro por pessoa já ajudam essa pessoa a saber tudo.'],
    more: ['Passe a ela a lista de fornecedores com telefone e horário de chegada (está na Central do dia do casamento).', 'Ela deve ter acesso ao plano B e ao kit de emergência.'],
  },
  {
    key: 'transporte', go: 'diad', title: 'Transporte', who: 'o transporte',
    re: /transporte|carro da noiva|van|onibus|motorista|chegada da noiva|estacionamento|manobrista/,
    start: ['Defina como a noiva chega e quem dirige.', 'Para convidados de fora ou local afastado, uma van ajuda muito (e evita beber e dirigir).', 'Com mais de uns 120 convidados, pense em manobrista.'],
    more: ['Coloque o motorista e o horário no Cerimonial.', 'Mande a localização exata para os fornecedores e convidados.'],
  },
];

// Cronogramas do dia prontos (minutos em relação ao horário da cerimônia).
const DAY_MODELS = {
  noite: { name: 'cerimônia no fim da tarde ou à noite, com festa', rows: [
    [-300, 'Making of da noiva (cabelo e maquiagem)', 'Noiva'], [-240, 'Making of do noivo', 'Noivo'], [-240, 'Montagem final da decoração', 'Geral'],
    [-180, 'Chegada da fotografia e filmagem', 'Geral'], [-120, 'Buffet e bar chegam para montar', 'Geral'], [-90, 'Passagem de som', 'Geral'],
    [-60, 'Noiva pronta e fotos com a família', 'Noiva'], [-30, 'Recepção dos convidados com música ambiente', 'Geral'], [-15, 'Padrinhos e família se posicionam para o cortejo', 'Geral'],
    [0, 'Início da cerimônia', 'Geral'], [45, 'Saída dos noivos e chuva de pétalas', 'Geral'], [50, 'Fotos com família e padrinhos', 'Geral'],
    [60, 'Coquetel para os convidados', 'Geral'], [90, 'Entrada dos noivos na festa', 'Geral'], [100, 'Primeira dança', 'Geral'],
    [120, 'Jantar servido', 'Geral'], [180, 'Abertura da pista', 'Geral'], [240, 'Corte do bolo e brinde', 'Geral'], [270, 'Buquê', 'Noiva'], [330, 'Saída dos noivos', 'Geral'],
  ] },
  dia: { name: 'cerimônia de manhã com almoço (mini wedding)', rows: [
    [-240, 'Making of da noiva (cabelo e maquiagem)', 'Noiva'], [-180, 'Making of do noivo', 'Noivo'], [-180, 'Montagem final da decoração', 'Geral'],
    [-120, 'Chegada da fotografia e do buffet', 'Geral'], [-30, 'Recepção dos convidados', 'Geral'], [0, 'Início da cerimônia', 'Geral'],
    [40, 'Fotos com família e padrinhos', 'Geral'], [60, 'Almoço servido', 'Geral'], [120, 'Brinde e discursos', 'Geral'],
    [150, 'Corte do bolo', 'Geral'], [180, 'Primeira dança e pista', 'Geral'], [270, 'Saída dos noivos', 'Geral'],
  ] },
  praia: { name: 'cerimônia na praia ao pôr do sol', rows: [
    [-270, 'Making of da noiva (cabelo e maquiagem)', 'Noiva'], [-210, 'Making of do noivo', 'Noivo'], [-180, 'Montagem da estrutura na areia', 'Geral'],
    [-150, 'Chegada da fotografia e filmagem', 'Geral'], [-30, 'Recepção dos convidados (água e leques)', 'Geral'], [0, 'Início da cerimônia (uns 40 minutos antes do pôr do sol)', 'Geral'],
    [35, 'Fotos do casal no pôr do sol', 'Geral'], [40, 'Coquetel', 'Geral'], [90, 'Entrada dos noivos e jantar', 'Geral'],
    [180, 'Pista', 'Geral'], [240, 'Bolo e brinde', 'Geral'], [300, 'Saída dos noivos', 'Geral'],
  ] },
};

export function dayModel(wedding) {
  const time = /^\d{2}:\d{2}$/.test(wedding.time || '') ? wedding.time : '';
  const hour = time ? Number(time.slice(0, 2)) : 17;
  const key = wedding.style === 'Praia' ? 'praia' : hour < 13 ? 'dia' : 'noite';
  const base = time || (key === 'dia' ? '11:00' : key === 'praia' ? '16:30' : '17:00');
  const [h, m] = base.split(':').map(Number);
  const clock = offset => { const total = ((h * 60 + m + offset) % 1440 + 1440) % 1440; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
  return { key, name: DAY_MODELS[key].name, ceremony: base, guessed: !time, rows: DAY_MODELS[key].rows.map(([offset, title, track]) => ({ time: clock(offset), title, track })) };
}
