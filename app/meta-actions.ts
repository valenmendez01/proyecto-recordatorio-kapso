"use server";

/**
 * meta-actions.ts
 *
 * Server Actions para la integración con Meta WhatsApp Cloud API.
 * Reemplaza la lógica de kapso-actions.ts con conexión directa a Meta.
 *
 * Variables de entorno requeridas:
 *   NEXT_PUBLIC_META_APP_ID  — ID público de tu App de Meta
 *   META_CONFIG_ID           — ID de configuración del Embedded Signup (WhatsApp Business)
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface EmbeddedSignupUrlResult {
  url: string;
}

export interface EmbeddedSignupUrlError {
  error: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Versión de la Graph API de Meta a usar */
const META_API_VERSION = "v21.0";

/** URL base del diálogo de OAuth de Meta */
const META_OAUTH_BASE_URL = "https://www.facebook.com/dialog/oauth";

/**
 * Scopes requeridos para la integración con WhatsApp Business Cloud API:
 * - whatsapp_business_management : gestionar cuentas y números de teléfono
 * - whatsapp_business_messaging  : enviar mensajes a través de la API
 */
const REQUIRED_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
].join(",");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Devuelve la URL base absoluta del sitio.
 * En producción usa NEXT_PUBLIC_SITE_URL; en desarrollo usa localhost.
 */
function getSiteBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

// ---------------------------------------------------------------------------
// Server Action principal
// ---------------------------------------------------------------------------

/**
 * generateEmbeddedSignupUrl
 *
 * Construye la URL de Embedded Signup de Meta para que el usuario pueda
 * vincular su número de WhatsApp Business directamente (sin intermediarios).
 *
 * @returns La URL lista para redirigir al usuario, o un objeto de error.
 */
export async function generateEmbeddedSignupUrl(): Promise<
  EmbeddedSignupUrlResult | EmbeddedSignupUrlError
> {
  // 1. Validar variables de entorno obligatorias
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.META_CONFIG_ID;

  if (!appId) {
    console.error("[meta-actions] Falta la variable NEXT_PUBLIC_META_APP_ID");
    return { error: "Configuración incompleta: META_APP_ID no definido." };
  }

  if (!configId) {
    console.error("[meta-actions] Falta la variable META_CONFIG_ID");
    return { error: "Configuración incompleta: META_CONFIG_ID no definido." };
  }

  // 2. Construir la URL de redirección tras el signup exitoso
  const redirectUri = `${getSiteBaseUrl()}/whatsapp/success`;

  // 3. Generar un estado aleatorio para protección CSRF
  //    (en producción, persiste este valor en sesión/cookie para validarlo al retornar)
  const state = crypto.randomUUID();

  // 4. Construir los parámetros del diálogo de OAuth
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: REQUIRED_SCOPES,
    response_type: "code",
    config_id: configId,
    override_default_response_type: "true",
    state,
    // Extras recomendados por Meta para Embedded Signup
    extras: JSON.stringify({
      version: META_API_VERSION,
      sessionInfoVersion: "3",
    }),
  });

  // 5. Armar la URL final
  const url = `${META_OAUTH_BASE_URL}?${params.toString()}`;

  console.info("[meta-actions] URL de Embedded Signup generada correctamente.");

  return { url };
}

// ---------------------------------------------------------------------------
// Server Action de intercambio de código por token
// ---------------------------------------------------------------------------

/**
 * exchangeCodeForToken
 *
 * Intercambia el `code` devuelto por Meta tras el Embedded Signup
 * por un token de acceso de larga duración.
 *
 * Llama a esta función desde el Route Handler de /whatsapp/success.
 *
 * @param code - Código de autorización recibido en el query string de la redirección.
 * @returns El token de acceso y el WABA ID, o un error.
 */
export async function exchangeCodeForToken(code: string): Promise<
  | {
      accessToken: string;
      wabaId: string;
      phoneNumberId: string;
    }
  | EmbeddedSignupUrlError
> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return {
      error:
        "Configuración incompleta: META_APP_ID o META_APP_SECRET no definidos.",
    };
  }

  const redirectUri = `${getSiteBaseUrl()}/whatsapp/success`;

  // Intercambiar código por token
  const tokenUrl = new URL(
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`
  );
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || tokenData.error) {
    console.error("[meta-actions] Error al intercambiar código:", tokenData);
    return {
      error: tokenData?.error?.message ?? "Error al obtener el token de Meta.",
    };
  }

  const accessToken: string = tokenData.access_token;

  // Obtener el WABA y el Phone Number ID asociados al token
  const debugUrl = new URL(
    `https://graph.facebook.com/${META_API_VERSION}/debug_token`
  );
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set(
    "access_token",
    `${appId}|${appSecret}` // App token
  );

  const debugRes = await fetch(debugUrl.toString());
  const debugData = await debugRes.json();

  if (!debugRes.ok || debugData.error) {
    console.error("[meta-actions] Error al depurar token:", debugData);
    return {
      error:
        debugData?.error?.message ??
        "No se pudo verificar el token de acceso.",
    };
  }

  // Los granular_scopes de WhatsApp incluyen el WABA ID
  const wabaScope = debugData.data?.granular_scopes?.find(
    (s: { scope: string; target_ids?: string[] }) =>
      s.scope === "whatsapp_business_management"
  );

  const wabaId: string = wabaScope?.target_ids?.[0] ?? "";

  // Obtener el Phone Number ID del WABA
  let phoneNumberId = "";
  if (wabaId) {
    const phoneRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/phone_numbers?access_token=${accessToken}`
    );
    const phoneData = await phoneRes.json();
    phoneNumberId = phoneData?.data?.[0]?.id ?? "";
  }

  console.info(
    "[meta-actions] Token obtenido. WABA ID:",
    wabaId,
    "| Phone Number ID:",
    phoneNumberId
  );

  return { accessToken, wabaId, phoneNumberId };
}