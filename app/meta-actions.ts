"use server";

import { createClient } from "@/utils/supabase/server";

const API_VERSION = process.env.WHATSAPP_API_VERSION;
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Acción de Servidor para Procesar el Objeto
// Para extraer los identificadores (phone_number_id, waba_id) o el paso de abandono (current_step).
export async function handleEmbeddedSignupEvent(payload: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  const { data, event, type } = payload;

  if (type !== 'WA_EMBEDDED_SIGNUP') return;

  // CASO 1: ÉXITO (Captura de identificadores)
  if (data.phone_number_id && data.waba_id) {
    console.log(`[Server] Registro exitoso. PhoneID: ${data.phone_number_id}, WABA: ${data.waba_id}`);
    
    // Actualizamos el perfil con los nuevos IDs
    await supabase
      .from("perfiles")
      .update({
        whatsapp_phone_number_id: data.phone_number_id,
        whatsapp_customer_id: data.waba_id, // Usamos waba_id como identificador de cliente
        whatsapp_status: 'connected'
      })
      .eq("id", user.id);
      
    return { success: true };
  }

  // CASO 2: ABANDONO (Determinación de pantalla)
  if (event === 'CANCEL' && data.current_step) {
    console.warn(`[Server] El usuario abandonó en la pantalla: ${data.current_step}`);
    
    // Aquí podrías registrar el abandono en una tabla de auditoría si fuera necesario
    return { abandoned: true, step: data.current_step };
  }

  // CASO 3: ERROR
  if (event === 'CANCEL' && data.error_message) {
    console.error(`[Server] Error reportado por Meta: ${data.error_message} (ID: ${data.error_id})`);
    return { error: data.error_message };
  }
}

/**
 * PASO 1: Intercambiar el código por un Token Empresarial (Business Token)
 *
 */
export async function exchangeCodeForBusinessToken(code: string) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const apiVersion = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION;

  const url = `https://graph.facebook.com/${apiVersion}/oauth/access_token`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: appId,
      client_secret: appSecret,
      code: code,
      grant_type: "authorization_code",
      // En el flujo del SDK Embebido, el redirect_uri generalmente se envía vacío 
      // o no se envía, ya que no hubo una redirección real de URL.
      redirect_uri: "" 
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Error al obtener el token empresarial");
  }

  return data.access_token as string;
}

/**
 * PASO 2: Suscribirse a los webhooks en la WABA del cliente
 *
 */
export async function subscribeAppToWaba(wabaId: string, businessToken: string) {
  const url = `${BASE_URL}/${wabaId}/subscribed_apps`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${businessToken}`
    }
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Error suscribiendo la app a la WABA:", data);
    throw new Error(data.error?.message || "Fallo en la suscripción de webhooks");
  }

  return data.success; // Retorna true si es correcto
}

/**
 * PASO 3: Registrar el número de teléfono con un PIN
 *
 */
export async function registerPhoneNumber(phoneNumberId: string, businessToken: string) {
  const url = `${BASE_URL}/${phoneNumberId}/register`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${businessToken}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      pin: "123456" // <DESIRED_PIN>: Debe ser de 6 dígitos
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Error al registrar el número");

  return data.success; // Retorna true si es correcto
}

// Función integradora
export async function completeOnboarding(code: string, wabaId: string, phoneNumberId: string) {
  try {
    // 1. Intercambio de código por Token
    const businessToken = await exchangeCodeForBusinessToken(code);

    // 2. Suscribir App a la WABA
    await subscribeAppToWaba(wabaId, businessToken);

    // 3. Registrar el número de teléfono
    await registerPhoneNumber(phoneNumberId, businessToken);

    // 4. Guardar todo en Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("perfiles").update({
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_customer_id: wabaId,
        whatsapp_status: 'connected'
        // Es recomendable guardar también el businessToken si necesitas 
        // realizar acciones administrativas futuras en nombre del cliente.
      }).eq("id", user.id);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Fallo en el Onboarding:", error.message);
    return { error: error.message };
  }
}

// ---------------------------------------------------------------------------
// VER QUE HACER CON ESTO
// ---------------------------------------------------------------------------
/**
 * Envía un mensaje de prueba utilizando la plantilla 'hello_world'
 * para la validación de Meta.
 */
export async function sendTestMessage(recipientPhone: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!accessToken || !phoneNumberId) {
    return { error: "Configuración de WhatsApp incompleta en el servidor." };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "template",
          template: {
            name: "hello_world",
            language: { code: "en_US" },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Error al enviar el mensaje");
    }

    return { success: true, messageId: data.messages[0].id };
  } catch (error: any) {
    console.error("[sendTestMessage] Error:", error);
    return { error: error.message };
  }
}