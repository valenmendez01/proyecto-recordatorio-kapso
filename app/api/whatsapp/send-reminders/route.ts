// app/api/whatsapp/send-reminders/route.ts
import { NextResponse } from 'next/server';

const META_API_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}`;

async function sendMetaReminder(
  to: string,
  templateName: string,
  token: string  // <-- ahora recibe token en vez de idTurno
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tudominio.com";
  const linkConfirmacion = `${baseUrl}/reservas/${token}`;

  return fetch(`${META_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "es_AR" },
        components: [
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: token }] // <-- token como parámetro del botón
          }
        ]
      }
    })
  });
}

export async function GET(request: Request) {
  try {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    // Buscar turnos de mañana que estén en estado 'reservado'
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const fechaStr = manana.toISOString().split("T")[0];

    const { data: turnos, error } = await supabase
      .from("reservas")
      .select(`
        id,
        token,
        hora_inicio,
        estado,
        pacientes (nombre, apellido, telefono)
      `)
      .eq("reserva_fecha", fechaStr)
      .eq("estado", "reservado");

    if (error) throw new Error(error.message);
    if (!turnos || turnos.length === 0) {
      return NextResponse.json({ message: "Sin turnos para mañana." }, { status: 200 });
    }

    const resultados = await Promise.allSettled(
      turnos.map((turno) => {
        const paciente = turno.pacientes as { telefono?: string } | null;
        if (!paciente?.telefono || !turno.token) return Promise.resolve(null);
        return sendMetaReminder(paciente.telefono, "recordatorio_de_cita", turno.token);
      })
    );

    const enviados = resultados.filter(r => r.status === "fulfilled").length;
    return NextResponse.json({ message: `Recordatorios enviados: ${enviados}` }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}