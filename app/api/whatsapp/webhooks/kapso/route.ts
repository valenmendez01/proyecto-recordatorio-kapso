import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Usamos el cliente administrativo para poder actualizar perfiles sin sesión de usuario
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body.event; // Kapso envía el tipo de evento aquí

    // El evento 'customer.connected' se dispara cuando escanean el QR con éxito
    if (event === "customer.connected") {
      const { external_id } = body.data; // Este es el ID de tu usuario que enviamos antes

      const { error } = await supabaseAdmin
        .from("perfiles")
        .update({ whatsapp_status: "connected" })
        .eq("id", external_id);

      if (error) throw error;
      
      console.log(`WhatsApp conectado para el usuario: ${external_id}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error en Webhook:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}