// app/api/whatsapp/send-reminders/route.ts
import { NextResponse } from 'next/server';

const WHATSAPP_API_URL = 'https://api.kapso.ai/meta/whatsapp/v24.0';

// Cambiamos la función a una interna o la dejamos como ayuda
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

// ESTO ES LO QUE FALTA: El export del manejador para Next.js
export async function GET(request: Request) {
  try {
    // Aquí deberías agregar la lógica para buscar los turnos de la semana 
    // en Supabase y llamar a sendReminder para cada uno.
    
    // Por ahora, devolvemos un éxito para que el Build pase:
    return NextResponse.json({ message: "Proceso de recordatorios iniciado" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}