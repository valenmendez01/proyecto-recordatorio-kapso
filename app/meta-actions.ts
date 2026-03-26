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

  console.log("[exchangeToken] Iniciando. appId:", appId, "| apiVersion:", apiVersion, "| code (primeros 10):", code?.slice(0, 10));

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID o META_APP_SECRET no están configurados en las variables de entorno.");
  }

  // Para el flujo de Embedded Signup, Meta espera los parámetros como
  // query string en GET, NO como JSON en POST.
  // Además, redirect_uri debe omitirse completamente (no enviarse vacío).
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code: code,
  });

  const url = `https://graph.facebook.com/${apiVersion}/oauth/access_token?${params.toString()}`;

  const response = await fetch(url, { method: "GET" });

  const data = await response.json();

  console.log("[exchangeToken] Respuesta de Meta:", JSON.stringify(data));

  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message || `Error HTTP ${response.status} al obtener el token empresarial`
    );
  }

  // Meta puede devolver `access_token` o dentro de un objeto anidado
  const token = data.access_token ?? data?.data?.access_token;
  if (!token) {
    throw new Error(`Meta respondió OK pero no incluyó access_token. Respuesta: ${JSON.stringify(data)}`);
  }

  return token as string;
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

// Función integradora
export async function completeOnboarding(code: string, wabaId: string, phoneNumberId: string) {
  console.log("[completeOnboarding] Iniciando con wabaId:", wabaId, "| phoneNumberId:", phoneNumberId, "| code length:", code?.length);
  
  try {
    // 1. Intercambio de código por Token
    const businessToken = await exchangeCodeForBusinessToken(code);
    console.log("[completeOnboarding] Token obtenido. Longitud:", businessToken?.length);

    // 2. Suscribir App a la WABA
    try {
      await subscribeAppToWaba(wabaId, businessToken);
      console.log("[completeOnboarding] Suscripción a WABA exitosa.");
    } catch (webhookError) {
      console.warn("Advertencia al suscribir webhooks (se continuará el flujo):", webhookError);
    }

    // 3. Guardar todo en Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("No hay usuario autenticado.");

    // AGREGAMOS .select() AL FINAL PARA VERIFICAR LA ESCRITURA
    const { data: perfilActualizado, error: dbError } = await supabase
      .from("perfiles")
      .update({
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_customer_id: wabaId,
        whatsapp_access_token: businessToken,
        whatsapp_status: 'connected'
      })
      .eq("id", user.id)
      .select();

    if (dbError) {
      console.error("Error DB:", dbError);
      throw new Error(`Error en Base de Datos: ${dbError.message}`);
    }

    // SI EL ARREGLO ESTÁ VACÍO, SIGNIFICA QUE EL PERFIL NO EXISTE
    if (!perfilActualizado || perfilActualizado.length === 0) {
      throw new Error("El perfil no existe en la base de datos. Crea tu perfil primero.");
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  // Buscamos las credenciales específicas de ESTE profesional
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("whatsapp_access_token, whatsapp_phone_number_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.whatsapp_access_token || !perfil?.whatsapp_phone_number_id) {
    return { error: "Este perfil no tiene WhatsApp configurado." };
  }

  const version = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION || "v25.0";

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${perfil.whatsapp_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          // Usamos el token dinámico de la base de datos
          Authorization: `Bearer ${perfil.whatsapp_access_token}`, 
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
    return { error: error.message };
  }
}

// Las 3 plantillas predefinidas de la app (viven en el servidor)
const PREDEFINED_TEMPLATES = [
  {
    id: "recordatorio",
    header: "Recordatorio de cita",
    body: `Hola {nombre} {apellido}, te recuerdo que tenés un turno: 
📅 Día: *{fecha} a las {hora}*
📍 Dirección: Roca 1239

🔹 Si necesitás reprogramar tu cita, hacelo con al menos 12 h de anticipación.
🔹 En caso de síntomas compatibles con resfrío, por favor reprogramá tu visita.

*Ingresa al siguiente link para responder:* {link}

Muchas gracias! Saludos.`,
  },
  {
    id: "reserva",
    header: "Reserva de turno",
    body: `Hola {nombre} {apellido}, tu turno ha sido confirmado:
📅 Día: *{fecha} a las {hora}*
📍 Dirección: Roca 1239

🔹 Si necesitás reprogramar tu cita, hacelo con al menos 12 h de anticipación.
🔹 En caso de síntomas compatibles con resfrío, por favor reprogramá tu visita.

Muchas gracias! Saludos.`,
  },
  {
    id: "actualizacion",
    header: "Actualización de turno",
    body: `Hola {nombre} {apellido}, tu turno fue modificado: 
📅 Día: *{fecha} a las {hora}*
📍 Dirección: Roca 1239

🔹 Si necesitás reprogramar tu cita, hacelo con al menos 12 h de anticipación.
🔹 En caso de síntomas compatibles con resfrío, por favor reprogramá tu visita.

Muchas gracias! Saludos.`,
  },
];

export async function enviarPlantillasARevision() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Verificar que no las haya enviado ya
  const { data: existentes } = await supabase
    .from("plantillas")
    .select("id")
    .eq("perfil_id", user.id);

  if (existentes && existentes.length > 0) {
    return { error: "Las plantillas ya fueron enviadas a revisión." };
  }

  // Enviar las 3 en paralelo
  const resultados = await Promise.allSettled(
    PREDEFINED_TEMPLATES.map((t) => {
      console.log(`[plantillas] Enviando: ${t.header}`);
      return registrarPlantillaMeta(t.header, t.body);
    })
  );

  // Loguear TODOS los resultados, no solo los errores
  resultados.forEach((r, i) => {
    console.log(`[plantillas] Resultado ${PREDEFINED_TEMPLATES[i].header}:`, JSON.stringify(r));
  });

  const errores = resultados
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message ?? String(r.reason));

  if (errores.length === PREDEFINED_TEMPLATES.length) {
    return { error: `Fallaron todas las plantillas: ${errores.join(", ")}` };
  }

  if (errores.length > 0) {
    return { warning: `Algunas plantillas fallaron: ${errores.join(", ")}` };
  }

  return { success: true };
}

export async function registrarPlantillaMeta(header: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!perfil?.whatsapp_customer_id) throw new Error("WABA ID no encontrado");

  // Definición de mapeo y ejemplos
  const varsMapping = [
    { tag: "{nombre}", example: "Juan" },
    { tag: "{apellido}", example: "Perez" },
    { tag: "{fecha}", example: "Lunes 16 de abril" },
    { tag: "{hora}", example: "09:00 hs" },
    { tag: "{link}", example: "https://www.odontologabetianamorante.com.ar/confirmar" },
  ];

  let finalBody = body;
  const exampleValues: string[] = [];
  let currentIndex = 1;

  varsMapping.forEach((item) => {
    if (finalBody.includes(item.tag)) {
      finalBody = finalBody.replaceAll(item.tag, `{{${currentIndex}}}`);
      exampleValues.push(item.example);
      currentIndex++;
    }
  });

  const nameMap: Record<string, string> = {
    "Recordatorio de cita": "recordatorio_de_cita",
    "Reserva de turno": "reserva_de_turno",
    "Actualización de turno": "actualizacion_de_turno",
  };
  const templateName = `${nameMap[header] ?? "plantilla"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const response = await fetch(
    `https://graph.facebook.com/${process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION}/${perfil.whatsapp_customer_id}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perfil.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: templateName,
        category: "UTILITY",
        language: "es_AR",
        components: [
          ...(header ? [{ type: "HEADER", format: "TEXT", text: header }] : []),
          {
            type: "BODY",
            text: finalBody,
            ...(exampleValues.length > 0 && {
              example: {
                body_text: [exampleValues],
              },
            }),
          },
        ],
      }),
    }
  );

  const metaData = await response.json();

  if (!response.ok) throw new Error(metaData.error?.message || "Error en Meta");

  // Guardamos con templateName (no con metaData.name) para garantizar el match en el webhook
  await supabase.from("plantillas").insert({
    perfil_id: user.id,
    nombre_meta: templateName,
    header_text: header,
    body_text: body, // guardamos el texto original con {tags} para que sea legible
    status: "PENDING",
  });

  return { success: true };
}

export async function enviarNotificacionWhatsApp(reservaId: string, tipo: 'reserva' | 'actualizacion' | 'recordatorio') {
  const supabase = await createClient();
  
  // 1. Obtener datos de la reserva, el paciente y el perfil del profesional
  const { data: reserva, error } = await supabase
    .from("reservas")
    .select(`
      *,
      paciente:pacientes(*),
      perfil:perfiles(*)
    `)
    .eq("id", reservaId)
    .single();

  if (error || !reserva) return { error: "No se encontró la reserva" };

  const { paciente, perfil } = reserva as any;

  if (!perfil.whatsapp_access_token || !perfil.whatsapp_phone_number_id) {
    return { error: "WhatsApp no configurado para este profesional" };
  }

  // 2. Determinar la plantilla según el tipo
  // IMPORTANTE: Estos nombres deben coincidir exactamente con los aprobados en Meta
  const plantillas = {
    reserva: "reserva_de_turno",
    actualizacion: "actualizacion_de_turno",
    recordatorio: "recordatorio_de_cita"
  };

  // 3. Preparar variables (Asegúrate que coincidan con el orden en Meta {{1}}, {{2}}...)
  const components: any[] = [
    {
      type: "body",
      parameters: [
        { type: "text", text: paciente.nombre },
        { type: "text", text: paciente.apellido },
        { type: "text", text: reserva.reserva_fecha },
        { type: "text", text: reserva.hora_inicio }
      ]
    }
  ];

  // Si es recordatorio, agregamos el link con el token como {{5}}
  if (tipo === 'recordatorio') {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;

    components[0].parameters.push({
      type: "text", 
      text: `${baseUrl}/reservas/${reserva.token}`
    });
  }

  // 4. Llamada a la API de Meta
  const response = await fetch(
    `https://graph.facebook.com/${process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION}/${perfil.whatsapp_phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perfil.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: paciente.telefono,
        type: "template",
        template: {
          name: plantillas[tipo],
          language: { code: "es_AR" },
          components
        },
      }),
    }
  );

  return response.ok ? { success: true } : { error: "Error en el envío" };
}