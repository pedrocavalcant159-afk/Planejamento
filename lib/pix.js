// Gera o código Pix "copia e cola" (BR Code estático) seguindo o padrão EMV do Banco Central.
const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;
const clean = (value, max) => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9 .\-@]/g, '').trim().slice(0, max);

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function pixPayload({ key, name, city, amount, txid = '***', description = '' }) {
  if (!key) return '';
  const account = field('00', 'br.gov.bcb.pix') + field('01', String(key).trim()) + (description ? field('02', clean(description, 40)) : '');
  const payload = [
    field('00', '01'),
    field('26', account),
    field('52', '0000'),
    field('53', '986'),
    Number(amount) > 0 ? field('54', Number(amount).toFixed(2)) : '',
    field('58', 'BR'),
    field('59', clean(name, 25) || 'RECEBEDOR'),
    field('60', clean(city, 15) || 'BRASIL'),
    field('62', field('05', clean(txid, 25).replace(/[^A-Za-z0-9]/g, '') || '***')),
    '6304',
  ].join('');
  return payload + crc16(payload);
}

// Requer a biblioteca qrcode-generator carregada na página (window.qrcode).
export function qrSvg(text, cellSize = 5) {
  if (!text || !window.qrcode) return '';
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin: 2, scalable: true });
}
