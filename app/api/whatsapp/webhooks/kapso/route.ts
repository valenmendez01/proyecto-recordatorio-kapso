import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Inicialización del cliente administrativo de Supabase
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Obtener el cuerpo bruto para la verificación de firma
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const secret = process.env.KAPSO_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.error("Faltan credenciales de seguridad en el webhook");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Calcular la firma esperada usando HMAC SHA256
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // 3. Convertir a Buffers para la comparación segura
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedSigBuffer = Buffer.from(expectedSignature, "hex");

    // Validar longitudes (timingSafeEqual requiere que sean iguales)
    if (sigBuffer.length !== expectedSigBuffer.length) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    // 4. Comparación segura usando Uint8Array para evitar errores de TypeScript
    const isValid = crypto.timingSafeEqual(
      new Uint8Array(sigBuffer),
      new Uint8Array(expectedSigBuffer)
    );

    if (!isValid) {
      console.error("Firma de webhook no coincide");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    // 5. Procesar el payload de Kapso
    const body = JSON.parse(rawBody);
    const { event, data } = body;

    // Evento oficial de Project Webhook para nuevas conexiones
    if (event === "whatsapp.phone_number.created") {
      const { external_customer_id, id: phoneNumberId } = data;

      // Actualizar el estado en la base de datos
      const { error } = await supabaseAdmin
        .from("perfiles")
        .update({ 
          whatsapp_status: "connected",
          whatsapp_phone_number_id: phoneNumberId 
        })
        .eq("id", external_customer_id);

      if (error) throw error;
      
      console.log(`✅ Conexión de WhatsApp vinculada para el usuario: ${external_customer_id}`);
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Error en el procesamiento del webhook:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}