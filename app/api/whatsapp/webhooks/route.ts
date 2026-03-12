import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  statuses?: WhatsAppMessageStatus[];
  messages?: WhatsAppMessage[];
}

interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

interface WhatsAppEntry {
  id: string;
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
 *
 * Fix 1: el parámetro es `Request` (Web API estándar) en lugar de `NextRequest`,
 *   porque `req.clone()` devuelve `Request`, no `NextRequest`. Ambos tienen
 *   `.headers` y `.text()`, así que la función funciona igual.
 *
 * Fix 2: se usa `TextEncoder` en lugar de `Buffer.from()` para obtener
 *   `Uint8Array<ArrayBuffer>` puro, que es el tipo exacto que exige
 *   `crypto.timingSafeEqual` en TypeScript strict mode.
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

  // Comparación en tiempo constante para prevenir timing attacks.
  // TextEncoder produce Uint8Array<ArrayBuffer>, compatible con timingSafeEqual.
  const encoder = new TextEncoder();
  const sigBytes = encoder.encode(signature);
  const expectedBytes = encoder.encode(expectedSignature);

  if (sigBytes.length !== expectedBytes.length) return false;

  return crypto.timingSafeEqual(sigBytes, expectedBytes);
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
  // --- 1. Validar firma antes de procesar cualquier dato ---
  // req.clone() devuelve `Request` (no `NextRequest`), por eso validateSignature
  // acepta el tipo base `Request`. La firma se consume aquí; el body original
  // se lee como JSON más abajo.
  const isValid = await validateSignature(req.clone());

  if (!isValid) {
    console.error("[webhook] ❌ Firma inválida. Request rechazado.");
    // Respondemos 200 de todas formas para no revelar información al atacante.
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // --- 2. Parsear el payload ---
  let payload: WhatsAppWebhookPayload;

  try {
    payload = await req.json();
  } catch (err) {
    console.error("[webhook] Error al parsear el payload:", err);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Meta siempre envía object: "whatsapp_business_account"
  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // --- 3. Iterar sobre las entradas y cambios ---
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;

      // ── 3a. Actualizaciones de estado de mensajes enviados ──────────────
      // Útil para saber si el recordatorio llegó, fue leído o falló.
      //
      // TODO (Paso 5+): actualizar campo `estado_envio` en tabla `reservas`
      //   según el `status` y el `messageId`, usando el `phoneNumberId`
      //   para identificar qué perfil/cuenta corresponde.

      for (const statusUpdate of value.statuses ?? []) {
        const { id: messageId, status, timestamp, recipient_id, errors } = statusUpdate;

        switch (status) {
          case "sent":
            console.log(
              `[webhook] 📤 SENT     | msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId}`
            );
            break;

          case "delivered":
            console.log(
              `[webhook] 📬 DELIVERED| msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId}`
            );
            break;

          case "read":
            console.log(
              `[webhook] 👁️  READ     | msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId}`
            );
            break;

          case "failed":
            console.error(
              `[webhook] ❌ FAILED   | msgId: ${messageId} | para: ${recipient_id} | ts: ${timestamp} | phone_number_id: ${phoneNumberId} | errores:`,
              errors
            );
            break;
        }
      }

      // ── 3b. Mensajes entrantes (incluyendo echos de Coexistencia) ────────
      // En Coexistencia, cuando el profesional responde desde la App del
      // celular, Meta dispara un evento con `message.context` que indica
      // que es un "echo" (mensaje saliente reflejado al webhook).
      // Los identificamos por el campo `context.from` == propio número.

      for (const message of value.messages ?? []) {
        const isEcho =
          message.context?.from === value.metadata?.display_phone_number;

        if (isEcho) {
          console.log(
            `[webhook] 🔁 ECHO (Coexistencia) | de: ${message.from} | tipo: ${message.type} | ts: ${message.timestamp} | phone_number_id: ${phoneNumberId}`
          );
          // Los echos solo se registran; no generan respuesta automática.
          continue;
        }

        // Mensaje entrante real de un paciente (respuesta al recordatorio)
        console.log(
          `[webhook] 💬 INBOUND  | de: ${message.from} | tipo: ${message.type} | ts: ${message.timestamp} | phone_number_id: ${phoneNumberId}`
        );

        // TODO (Paso 5+): si el tipo es "text" y el contenido coincide con
        //   palabras clave ("confirmar", "cancelar"), actualizar `reservas`.
      }
    }
  }

  // --- 4. Responder 200 siempre para que Meta no reintente el envío ---
  return NextResponse.json({ status: "ok" }, { status: 200 });
}