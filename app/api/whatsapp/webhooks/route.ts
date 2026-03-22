import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/utils/supabase/server";

// ---------------------------------------------------------------------------
// Tipos del payload de Meta
// ---------------------------------------------------------------------------

interface WhatsAppMessageStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string }[];
}

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  context?: { from: string; id: string };
}

interface WhatsAppValue {
  messaging_product?: "whatsapp";
  metadata?: { display_phone_number: string; phone_number_id: string };
  statuses?: WhatsAppMessageStatus[];
  messages?: WhatsAppMessage[];
  // account_update fields
  phone_number?: string;
  event?: "PARTNER_REMOVED" | "ACCOUNT_OFFBOARDED" | "ACCOUNT_RECONNECTED" | string;
}

interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

interface WhatsAppEntry {
  id: string; // WABA_ID en eventos de cuenta
  changes: WhatsAppChange[];
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

// ---------------------------------------------------------------------------
// Helpers de seguridad
// ---------------------------------------------------------------------------

/**
 * Valida la firma X-Hub-Signature-256 que Meta incluye en cada POST.
 * Acepta `Request` (Web API base) en lugar de `NextRequest` porque
 * req.clone() devuelve ese tipo. Usa TextEncoder para timingSafeEqual
 * en TypeScript strict mode.
 */
async function validateSignature(req: Request): Promise<boolean> {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.error("[webhook] META_APP_SECRET no está configurado.");
    return false;
  }

  const signature = req.headers.get("x-hub-signature-256");

  if (!signature) {
    console.warn("[webhook] Request sin firma X-Hub-Signature-256.");
    return false;
  }

  const rawBody = await req.text();
  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const encoder = new TextEncoder();
  const sigBytes = encoder.encode(signature);
  const expectedBytes = encoder.encode(expectedSignature);

  if (sigBytes.length !== expectedBytes.length) return false;

  return crypto.timingSafeEqual(sigBytes, expectedBytes);
}

// ---------------------------------------------------------------------------
// Helpers de Supabase
// ---------------------------------------------------------------------------

/**
 * Busca el perfil por whatsapp_customer_id (= WABA_ID) y actualiza su estado.
 * Usamos entry.id como WABA_ID porque en account_update no siempre
 * viene phone_number_id en metadata.
 */
async function updateProfileStatusByWabaId(wabaId: string, status: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("perfiles")
    .update({ whatsapp_status: status })
    .eq("whatsapp_customer_id", wabaId);

  if (error) {
    console.error(`[webhook] Error actualizando estado a '${status}' para WABA ${wabaId}:`, error.message);
  } else {
    console.log(`[webhook] ✅ Estado actualizado a '${status}' para WABA ${wabaId}`);
  }
}

// ---------------------------------------------------------------------------
// GET — Verificación del webhook (handshake inicial con Meta)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[webhook] ✅ Verificación de Meta completada.");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[webhook] ❌ Verificación fallida. Token inválido o modo incorrecto.");
  return new NextResponse("Forbidden", { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — Procesamiento de eventos entrantes de Meta
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Validar firma
  const isValid = await validateSignature(req.clone());

  if (!isValid) {
    console.error("[webhook] ❌ Firma inválida. Request rechazado.");
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // 2. Parsear payload
  let payload: WhatsAppWebhookPayload;

  try {
    payload = await req.json();
  } catch (err) {
    console.error("[webhook] Error al parsear el payload:", err);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // 3. Iterar entradas y cambios
  for (const entry of payload.entry ?? []) {
    const wabaId = entry.id;

    for (const change of entry.changes ?? []) {
      const { field, value } = change;

      // ── Eventos de gestión de cuenta ──────────────────────────────────────
      if (field === "account_update") {
        switch (value.event) {
          case "PARTNER_REMOVED":
            // El cliente se desconectó desde la app de WhatsApp Business
            console.log(`[webhook] 🔌 PARTNER_REMOVED | WABA: ${wabaId} | phone: ${value.phone_number}`);
            await updateProfileStatusByWabaId(wabaId, "disconnected");
            break;

          case "ACCOUNT_OFFBOARDED":
            // El cliente canceló el registro o cambió de dispositivo
            console.log(`[webhook] 📴 ACCOUNT_OFFBOARDED | WABA: ${wabaId}`);
            await updateProfileStatusByWabaId(wabaId, "disconnected");
            break;

          case "ACCOUNT_RECONNECTED":
            // El cliente se volvió a reconectar con el mismo partner
            console.log(`[webhook] 🔄 ACCOUNT_RECONNECTED | WABA: ${wabaId}`);
            await updateProfileStatusByWabaId(wabaId, "connected");
            break;

          default:
            console.log(`[webhook] ℹ️ account_update desconocido | event: ${value.event} | WABA: ${wabaId}`);
        }
        continue;
      }

      // ── Eventos de mensajes ────────────────────────────────────────────────
      if (field !== "messages") continue;

      const phoneNumberId = value.metadata?.phone_number_id;

      // Actualizaciones de estado de mensajes enviados
      // TODO (Paso 5+): actualizar campo `estado_envio` en tabla `reservas`
      for (const statusUpdate of value.statuses ?? []) {
        const { id: messageId, status, timestamp, recipient_id, errors } = statusUpdate;

        switch (status) {
          case "sent":
            console.log(`[webhook] 📤 SENT      | msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId}`);
            break;
          case "delivered":
            console.log(`[webhook] 📬 DELIVERED | msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId}`);
            break;
          case "read":
            console.log(`[webhook] 👁️  READ      | msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId}`);
            break;
          case "failed":
            console.error(`[webhook] ❌ FAILED    | msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId} | errores:`, errors);
            break;
        }
      }

      // Mensajes entrantes (incluyendo echos de Coexistencia)
      // Cuando el profesional responde desde la app del celular, Meta refleja
      // el mensaje al webhook con context.from == propio número (echo).
      for (const message of value.messages ?? []) {
        const isEcho = message.context?.from === value.metadata?.display_phone_number;

        if (isEcho) {
          console.log(`[webhook] 🔁 ECHO      | de: ${message.from} | tipo: ${message.type} | ts: ${message.timestamp} | phone_number_id: ${phoneNumberId}`);
          continue;
        }

        // Mensaje entrante real de un paciente
        console.log(`[webhook] 💬 INBOUND   | de: ${message.from} | tipo: ${message.type} | ts: ${message.timestamp} | phone_number_id: ${phoneNumberId}`);

        // TODO (Paso 5+): si type === "text" y el contenido coincide con
        //   palabras clave ("confirmar", "cancelar"), actualizar `reservas`.
      }
    }
  }

  // 4. Responder 200 siempre para que Meta no reintente el envío
  return NextResponse.json({ status: "ok" }, { status: 200 });
}