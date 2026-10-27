// Ebook PDF do chá de panela, gerado no navegador com jsPDF (window.jspdf precisa estar carregado).
import { dateLong } from './catalog.js';
import { GIFTS } from './gifts.js';

const STYLES = {
  1: { accent: [95, 107, 42], soft: [232, 235, 214], paper: [250, 248, 241], ink: [47, 51, 32], muted: [133, 138, 108], title: ['times', 'italic'], upper: false, space: 0 },
  2: { accent: [181, 101, 118], soft: [246, 227, 229], paper: [253, 248, 247], ink: [74, 44, 47], muted: [160, 131, 134], title: ['times', 'italic'], upper: false, space: 0 },
  3: { accent: [176, 138, 58], soft: [238, 226, 196], paper: [251, 248, 240], ink: [29, 26, 20], muted: [138, 127, 104], title: ['times', 'normal'], upper: true, space: 1.4, night: [18, 17, 16], gold: [212, 175, 99], goldLight: [241, 213, 138], ivory: [245, 236, 215] },
};
const W = 210, H = 297, M = 20;

export function generateEbook(site, model = 1) {
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF não carregado');
  const s = STYLES[model] || STYLES[1];
  const cha = site?.cha || {};
  const couple = site?.couple || 'Os noivos';
  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: `Chá de Panela · ${couple}`, author: 'Entre Nós' });
  let page = 0;

  const color = (fn, rgb) => pdf[fn](...rgb);
  const titleFont = size => { pdf.setFont(...s.title); pdf.setFontSize(size); };
  const bodyFont = (size = 11, style = 'normal') => { pdf.setFont('helvetica', style); pdf.setFontSize(size); };
  const T = text => (s.upper ? text.toUpperCase() : text);
  // jsPDF não desconta o charSpace ao centralizar, então calculamos a largura manualmente.
  const center = (text, y, space = 0, lineFactor = 1.15) => [].concat(text).forEach((line, i) => pdf.text(line, W / 2 - (pdf.getTextWidth(line) + space * Math.max(0, line.length - 1)) / 2, y + i * pdf.getFontSize() * 0.353 * lineFactor, { charSpace: space }));

  function ornament(x, y, scale = 1, rgb = s.accent) {
    color('setDrawColor', rgb); color('setFillColor', rgb);
    if (model === 1) {
      pdf.setLineWidth(0.35); pdf.line(x - 14 * scale, y, x + 14 * scale, y);
      for (let i = -3; i <= 3; i++) if (i) { pdf.ellipse(x + i * 4 * scale, y - 1.4 * scale, 1.3 * scale, 0.7 * scale, 'F'); pdf.ellipse(x + i * 4 * scale + 1.4 * scale, y + 1.4 * scale, 1.3 * scale, 0.7 * scale, 'F'); }
      pdf.circle(x, y, 1.1 * scale, 'F');
    } else if (model === 2) {
      color('setFillColor', s.soft);
      for (let a = 0; a < 5; a++) pdf.circle(x + Math.cos(a * 1.2566) * 2.6 * scale, y + Math.sin(a * 1.2566) * 2.6 * scale, 2 * scale, 'F');
      color('setFillColor', s.accent); pdf.circle(x, y, 1.3 * scale, 'F');
      pdf.setLineWidth(0.3); pdf.line(x - 20 * scale, y, x - 7 * scale, y); pdf.line(x + 7 * scale, y, x + 20 * scale, y);
    } else {
      pdf.setLineWidth(0.3);
      for (let a = -165; a <= -15; a += 15) { const r = (a % 30 === 0 ? 7 : 4.5) * scale, rad = a * Math.PI / 180; pdf.line(x, y, x + Math.cos(rad) * r, y + Math.sin(rad) * r); }
      pdf.line(x - 26 * scale, y, x - 4 * scale, y); pdf.line(x + 4 * scale, y, x + 26 * scale, y);
      pdf.line(x - 22 * scale, y + 1.6 * scale, x - 8 * scale, y + 1.6 * scale); pdf.line(x + 8 * scale, y + 1.6 * scale, x + 22 * scale, y + 1.6 * scale);
      pdf.lines([[1.6 * scale, 1.6 * scale], [-1.6 * scale, 1.6 * scale], [-1.6 * scale, -1.6 * scale], [1.6 * scale, -1.6 * scale]], x, y - 1.6 * scale, [1, 1], 'F', true);
    }
  }

  function frame() {
    color('setFillColor', s.paper); pdf.rect(0, 0, W, H, 'F');
    color('setDrawColor', s.accent);
    if (model === 1) { pdf.setLineWidth(0.5); pdf.rect(8, 8, W - 16, H - 16); pdf.setLineWidth(0.2); pdf.rect(10, 10, W - 20, H - 20); }
    else if (model === 2) { color('setDrawColor', s.soft); pdf.setLineWidth(1.2); pdf.roundedRect(9, 9, W - 18, H - 18, 8, 8); }
    else { decoFrame(s.accent); }
  }

  // Moldura art déco: filete duplo com cantos escalonados.
  function decoFrame(rgb) {
    color('setDrawColor', rgb);
    pdf.setLineWidth(0.6); pdf.rect(10, 10, W - 20, H - 20);
    pdf.setLineWidth(0.2); pdf.rect(13, 13, W - 26, H - 26);
    [[13, 13, 1, 1], [W - 13, 13, -1, 1], [13, H - 13, 1, -1], [W - 13, H - 13, -1, -1]].forEach(([cx, cy, dx, dy]) => {
      pdf.line(cx, cy + dy * 9, cx + dx * 4, cy + dy * 9); pdf.line(cx + dx * 4, cy + dy * 9, cx + dx * 4, cy + dy * 4);
      pdf.line(cx + dx * 4, cy + dy * 4, cx + dx * 9, cy + dy * 4); pdf.line(cx + dx * 9, cy + dy * 4, cx + dx * 9, cy);
    });
  }
  // Página noturna do Gala (capa e encerramento).
  function nightPage() { color('setFillColor', s.night); pdf.rect(0, 0, W, H, 'F'); decoFrame(s.gold); }
  const gala = model === 3;
  const coverTitle = gala ? s.goldLight : s.ink, coverText = gala ? s.ivory : s.ink, coverMuted = gala ? [163, 149, 119] : s.muted, coverAccent = gala ? s.gold : s.accent;

  function newPage(eyebrow, title) {
    if (page++) pdf.addPage();
    frame();
    bodyFont(8, 'bold'); color('setTextColor', s.accent);
    center(eyebrow.toUpperCase(), 30, 1.5);
    titleFont(s.upper ? 20 : 28); color('setTextColor', s.ink);
    center(T(title), 43, s.space);
    ornament(W / 2, 51, 0.8);
    bodyFont(8); color('setTextColor', s.muted);
    const inset = model === 3 ? 8 : 0; // afasta dos cantos da moldura art déco
    pdf.text(`${couple}  ·  Chá de Panela`, M + inset, H - 16);
    pdf.text(String(page), W - M - inset, H - 16, { align: 'right' });
    return 64;
  }

  function paragraph(text, y, size = 11, width = W - 2 * M) {
    bodyFont(size); color('setTextColor', s.ink);
    const lines = pdf.splitTextToSize(text, width);
    pdf.text(lines, M, y, { lineHeightFactor: 1.55 });
    return y + lines.length * size * 0.353 * 1.55 + 4;
  }

  function checkbox(x, y) { color('setDrawColor', s.accent); pdf.setLineWidth(0.35); model === 2 ? pdf.roundedRect(x, y - 3.4, 4, 4, 1, 1) : pdf.rect(x, y - 3.4, 4, 4); }
  function writeLine(y, x1 = M, x2 = W - M) { color('setDrawColor', s.soft); pdf.setLineWidth(0.4); pdf.line(x1, y, x2, y); }

  // 1. Capa
  page++;
  if (gala) nightPage(); else { frame(); color('setFillColor', s.soft); pdf.circle(W / 2, 112, 48, 'F'); }
  ornament(W / 2, 74, 1.4, coverAccent);
  bodyFont(10, 'bold'); color('setTextColor', coverAccent); center('CHÁ DE PANELA', 98, 3);
  titleFont(gala ? 30 : 38); color('setTextColor', coverTitle);
  center(pdf.splitTextToSize(T(couple), gala ? 150 : 120), 116, s.space);
  ornament(W / 2, 150, 1, coverAccent);
  bodyFont(12); color('setTextColor', coverText); pdf.text(dateLong(cha.date, true), W / 2, 178, { align: 'center' });
  bodyFont(11); color('setTextColor', coverMuted);
  pdf.text([cha.time ? `às ${cha.time}` : '', cha.venue || '', cha.address || ''].filter(Boolean), W / 2, 186, { align: 'center', lineHeightFactor: 1.5 });
  bodyFont(9); pdf.text('Guia de brincadeiras, listas e lembranças para o grande dia', W / 2, 250, { align: 'center' });

  // 2. Boas-vindas
  let y = newPage('Boas-vindas', 'Que comece a festa');
  y = paragraph(`Este caderno foi feito com carinho para o chá de panela de ${couple}. Aqui vocês encontram uma programação sugerida, brincadeiras prontas para imprimir, checklists de organização e espaço para guardar recados e lembranças.`, y);
  y = paragraph('Imprimam as páginas que quiserem usar, distribuam as cartelas entre os convidados e aproveitem cada momento. O mais importante é estar perto de quem vocês amam.', y + 2);
  color('setFillColor', s.soft); pdf.roundedRect(M, y + 6, W - 2 * M, 48, 3, 3, 'F');
  bodyFont(9, 'bold'); color('setTextColor', s.accent); pdf.text('INFORMAÇÕES DO CHÁ', M + 8, y + 17, { charSpace: 1 });
  bodyFont(11); color('setTextColor', s.ink);
  pdf.text([`Data: ${dateLong(cha.date, true)}`, `Horário: ${cha.time || 'a definir'}`, `Local: ${cha.venue || 'a definir'}`, cha.address ? `Endereço: ${cha.address}` : ''].filter(Boolean), M + 8, y + 27, { lineHeightFactor: 1.6, maxWidth: W - 2 * M - 16 });

  // 3. Programação
  y = newPage('Roteiro', 'Programação sugerida');
  const schedule = [['Chegada', 'Recepção dos convidados, música ambiente e petiscos.'], ['Boas-vindas', 'O casal agradece a presença de todos.'], ['Adivinhe o presente', 'Os noivos tentam adivinhar cada presente antes de abrir.'], ['Quiz do casal', 'Quem conhece melhor os noivos?'], ['Bingo do chá', 'Cartelas para os convidados, com prêmio para quem completar.'], ['Bolo e parabéns', 'Hora do bolo, dos doces e das fotos.'], ['Recados', 'Convidados deixam mensagens para o casal.'], ['Despedida', 'Agradecimento final e lembrancinhas.']];
  schedule.forEach(([title, text], i) => {
    const row = y + i * 24;
    color('setFillColor', s.accent); pdf.circle(M + 4, row - 1.2, 1.6, 'F');
    if (i < schedule.length - 1) { color('setDrawColor', s.soft); pdf.setLineWidth(0.6); pdf.line(M + 4, row + 2, M + 4, row + 21); }
    bodyFont(12, 'bold'); color('setTextColor', s.ink); pdf.text(title, M + 12, row);
    bodyFont(10); color('setTextColor', s.muted); pdf.text(text, M + 12, row + 6);
    color('setDrawColor', s.soft); pdf.setLineWidth(0.4); pdf.line(W - M - 30, row + 1, W - M, row + 1);
  });
  bodyFont(8); color('setTextColor', s.muted); pdf.text('Anote o horário de cada momento na linha ao lado.', W - M, y + schedule.length * 24, { align: 'right' });

  // 4. Adivinhe o presente
  y = newPage('Brincadeira', 'Adivinhe o presente');
  y = paragraph('Antes de abrir cada presente, os noivos tentam adivinhar o que é. Cada erro vale uma prenda escolhida pelos convidados: cantar, dançar, contar uma história do casal… Anotem os palpites abaixo.', y);
  color('setFillColor', s.soft); pdf.rect(M, y, W - 2 * M, 9, 'F');
  bodyFont(9, 'bold'); color('setTextColor', s.ink);
  pdf.text('QUEM DEU', M + 3, y + 6); pdf.text('PALPITE', M + 63, y + 6); pdf.text('ERA…', M + 113, y + 6); pdf.text('ACERTOU?', W - M - 3, y + 6, { align: 'right' });
  for (let i = 1; i <= 16; i++) { writeLine(y + 9 + i * 10); checkbox(W - M - 10, y + 6 + i * 10); }

  // 5. Quiz do casal
  y = newPage('Brincadeira', 'Quiz do casal');
  y = paragraph('Cada convidado responde e, no final, os noivos revelam as respostas certas. Quem acertar mais leva um prêmio!', y);
  bodyFont(10); color('setTextColor', s.muted); pdf.text('Nome: ____________________________________________', M, y + 2);
  y += 12;
  ['Onde o casal se conheceu?', 'Quem deu o primeiro "eu te amo"?', 'Qual foi o primeiro filme que viram juntos?', 'Quem é mais romântico(a)?', 'Quem cozinha melhor?', 'Qual a comida preferida do casal?', 'Quem demora mais para se arrumar?', 'Qual foi a primeira viagem juntos?', 'Quem pediu quem em casamento?', 'Quem é mais organizado(a)?', 'Qual a música do casal?', 'Quem acorda mais cedo?', 'Quem ronca?', 'Qual o maior sonho do casal?'].forEach((question, i) => {
    bodyFont(10, 'bold'); color('setTextColor', s.accent); pdf.text(String(i + 1).padStart(2, '0'), M, y);
    bodyFont(10); color('setTextColor', s.ink); pdf.text(question, M + 9, y);
    writeLine(y + 6, M + 9); y += 13;
  });

  // 6. Bingo
  y = newPage('Brincadeira', 'Bingo do chá de panela');
  y = paragraph('Marque o item quando ele aparecer entre os presentes. Quem completar uma linha grita "Chá!" e quem completar a cartela inteira ganha.', y);
  const words = ['Panela', 'Frigideira', 'Liquidificador', 'Jogo de copos', 'Toalha', 'Escorredor', 'Pano de prato', 'Forma de bolo', 'Batedeira', 'Talheres', 'Tábua', 'Concha', 'Garrafa térmica', 'Potes', 'Cesto', 'Assadeira', 'Ralador', 'Abridor', 'Jarra', 'Avental', 'Leiteira', 'Fruteira', 'Saleiro', 'Peneira'];
  const shuffled = seed => [...words].sort((a, b) => ((a.charCodeAt(0) * seed + a.length * 7) % 13) - ((b.charCodeAt(0) * seed + b.length * 7) % 13)).slice(0, 16);
  [3, 7].forEach((seed, card) => {
    const top = y + 2 + card * 98, size = 40, left = (W - size * 4) / 2;
    bodyFont(9, 'bold'); color('setTextColor', s.accent); pdf.text(`CARTELA ${card + 1}`, left, top - 2, { charSpace: 1 });
    shuffled(seed).forEach((word, i) => {
      const cx = left + (i % 4) * size, cy = top + Math.floor(i / 4) * 22;
      color('setDrawColor', s.accent); pdf.setLineWidth(0.3); pdf.rect(cx, cy, size, 22);
      bodyFont(9); color('setTextColor', s.ink); pdf.text(pdf.splitTextToSize(word, size - 6), cx + size / 2, cy + 12, { align: 'center' });
    });
  });

  // 7. Checklist de organização
  y = newPage('Organização', 'Checklist do chá');
  const tasks = { '1 mês antes': ['Definir data, horário e local', 'Fazer a lista de convidados', 'Montar a lista de presentes', 'Enviar o convite'], '2 semanas antes': ['Confirmar presenças', 'Encomendar bolo e doces', 'Planejar o cardápio', 'Escolher a decoração', 'Separar prêmios das brincadeiras'], '1 semana antes': ['Comprar bebidas e descartáveis', 'Imprimir cartelas e o quiz', 'Montar a playlist', 'Separar canetas e pranchetas'], 'No dia': ['Montar a decoração', 'Organizar a mesa de presentes', 'Deixar o espaço das fotos pronto', 'Preparar as lembrancinhas', 'Aproveitar muito!'] };
  Object.entries(tasks).forEach(([group, list]) => {
    bodyFont(10, 'bold'); color('setTextColor', s.accent); pdf.text(group.toUpperCase(), M, y, { charSpace: 1 }); y += 8;
    list.forEach(item => { checkbox(M, y); bodyFont(11); color('setTextColor', s.ink); pdf.text(item, M + 8, y); y += 8.5; });
    y += 5;
  });

  // 8. Lista de presentes sugerida
  y = newPage('Inspiração', 'Lista de presentes sugerida');
  const half = Math.ceil(GIFTS.length / 2);
  GIFTS.forEach((gift, i) => {
    const col = i < half ? 0 : 1, row = i < half ? i : i - half;
    const x = M + col * ((W - 2 * M) / 2), gy = y + row * 8.2;
    checkbox(x, gy); bodyFont(9.5); color('setTextColor', s.ink); pdf.text(pdf.splitTextToSize(gift.name, 76)[0], x + 7, gy);
  });

  // 9. Lista de convidados
  y = newPage('Organização', 'Lista de convidados');
  color('setFillColor', s.soft); pdf.rect(M, y - 6, W - 2 * M, 9, 'F');
  bodyFont(9, 'bold'); color('setTextColor', s.ink);
  pdf.text('NOME', M + 3, y); pdf.text('CONFIRMOU', M + 98, y); pdf.text('PRESENTE', M + 125, y);
  for (let i = 1; i <= 21; i++) { const ly = y + i * 9.4; writeLine(ly + 2); checkbox(M + 103, ly); }

  // 10. Recados
  y = newPage('Lembranças', 'Recados para o casal');
  for (let block = 0; block < 4; block++) {
    const by = y + block * 50;
    color('setDrawColor', s.soft); pdf.setLineWidth(0.5); model === 3 ? pdf.rect(M, by, W - 2 * M, 44) : pdf.roundedRect(M, by, W - 2 * M, 44, 3, 3);
    bodyFont(8, 'bold'); color('setTextColor', s.muted); pdf.text('DE:', M + 5, by + 8);
    for (let l = 0; l < 3; l++) writeLine(by + 18 + l * 9, M + 5, W - M - 5);
  }

  // 11. Encerramento
  page++; pdf.addPage();
  if (gala) nightPage(); else frame();
  ornament(W / 2, 120, 1.4, coverAccent);
  titleFont(s.upper ? 26 : 34); color('setTextColor', coverTitle); center(T('Obrigado!'), 142, s.space);
  bodyFont(12); color('setTextColor', coverMuted);
  pdf.text(pdf.splitTextToSize('Que esta nova casa seja cheia de amor, risadas e muitas receitas compartilhadas.', 130), W / 2, 156, { align: 'center', lineHeightFactor: 1.5 });
  titleFont(s.upper ? 14 : 18); color('setTextColor', coverAccent); center(T(couple), 182, s.space);

  pdf.save(`cha-de-panela-${(site?.slug || 'ebook')}.pdf`);
}
