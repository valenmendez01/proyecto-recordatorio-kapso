import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const secret = process.env.KAPSO_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.error("Faltan credenciales de seguridad en el webhook");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const rawSignature = signature.startsWith("sha256=")
      ? signature.slice(7)
      : signature;

    const sigBuffer = Buffer.from(rawSignature, "hex");
    const expectedSigBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedSigBuffer.length) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    const isValid = crypto.timingSafeEqual(
      new Uint8Array(sigBuffer),
      new Uint8Array(expectedSigBuffer)
    );

    if (!isValid) {
      console.error("Firma de webhook no coincide");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { event, data } = body;

    if (event === "whatsapp.phone_number.created") {
      const kapsoCustomerId = data.customer?.id;

      if (!kapsoCustomerId) {
        console.error("❌ No se encontró customer.id en el payload");
        return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from("perfiles")
        .update({ whatsapp_status: "connected" })
        .eq("whatsapp_customer_id", kapsoCustomerId);

      if (error) throw error;

      console.log(`✅ WhatsApp conectado para el customer de Kapso: ${kapsoCustomerId}`);
    }

    if (event === "whatsapp.phone_number.deleted") {
      const kapsoCustomerId = data.customer?.id;

      if (kapsoCustomerId) {
        await supabaseAdmin
          .from("perfiles")
          .update({ whatsapp_status: "disconnected" })
          .eq("whatsapp_customer_id", kapsoCustomerId);

        console.log(`🔌 WhatsApp desconectado para el customer de Kapso: ${kapsoCustomerId}`);
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Error en el procesamiento del webhook:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}