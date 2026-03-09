const WHATSAPP_API_URL = 'https://api.kapso.ai/meta/whatsapp/v24.0';

async function sendReminder(phoneNumberId: string, to: string, message: string) {
  return fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.KAPSO_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: message }
    })
  });
}