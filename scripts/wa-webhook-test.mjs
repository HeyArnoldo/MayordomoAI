/**
 * Simula un mensaje entrante de WhatsApp contra el webhook local.
 *
 * Uso:  node scripts/wa-webhook-test.mjs "+51999999999" "gasté 8 en pasajes"
 *
 * SIEMPRE usar este script (y no curl/Invoke-RestMethod desde la consola de
 * Windows): la consola codifica el body en CP1252, los acentos llegan como
 * bytes inválidos y se persisten como "�". Node manda UTF-8 siempre.
 */
const [phone, ...words] = process.argv.slice(2);
const text = words.join(' ');

if (!phone || !text) {
  console.error('Uso: node scripts/wa-webhook-test.mjs "+51999999999" "gasté 8 en pasajes"');
  process.exit(1);
}

const url = process.env.API_URL ?? 'http://localhost:3000';
const token = process.env.WA_WEBHOOK_TOKEN;

const payload = {
  event: 'messages.upsert',
  data: {
    key: {
      remoteJid: `${phone.replace('+', '')}@s.whatsapp.net`,
      fromMe: false,
      id: `TEST_${Date.now()}`,
    },
    pushName: 'Test',
    message: { conversation: text },
    messageType: 'conversation',
  },
};

const res = await fetch(`${url}/api/webhook/whatsapp`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    ...(token ? { 'x-webhook-token': token } : {}),
  },
  body: JSON.stringify(payload),
});

console.log(res.status, await res.text());
