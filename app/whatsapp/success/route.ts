import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/app/meta-actions";

// Cliente de Supabase con permisos de administrador (service role).
// Se instancia a nivel de módulo para reutilizar la conexión entre requests.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** URL de fallback para todas las redirecciones */
const REDIRECT_URL = "/configuracion";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Meta devuelve `code` tras un signup exitoso, o `error` si el usuario cancela.
  const code = searchParams.get("code");
  const metaError = searchParams.get("error");
  const metaErrorDescription = searchParams.get("error_description");

  // --- 1. El usuario canceló o Meta devolvió un error ---
  if (metaError) {
    console.error(
      `[whatsapp/success] Meta devolvió error: ${metaError} — ${metaErrorDescription}`
    );
    return NextResponse.redirect(
      new URL(`${REDIRECT_URL}?whatsapp_error=cancelled`, req.url)
    );
  }

  // --- 2. No llegó el código de autorización ---
  if (!code) {
    console.error("[whatsapp/success] No se recibió el parámetro `code`.");
    return NextResponse.redirect(
      new URL(`${REDIRECT_URL}?whatsapp_error=missing_code`, req.url)
    );
  }

  // --- 3. Verificar que hay una sesión activa ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[whatsapp/success] No hay sesión activa.");
    return NextResponse.redirect(
      new URL(`${REDIRECT_URL}?whatsapp_error=unauthenticated`, req.url)
    );
  }

  // --- 4. Intercambiar el código por el token y los IDs de Meta ---
  const tokenResult = await exchangeCodeForToken(code);

  if ("error" in tokenResult) {
    console.error(
      "[whatsapp/success] Error al intercambiar el código:",
      tokenResult.error
    );
    return NextResponse.redirect(
      new URL(`${REDIRECT_URL}?whatsapp_error=token_exchange_failed`, req.url)
    );
  }

  const { phoneNumberId } = tokenResult;

  // --- 5. Persistir el estado en Supabase ---
  const { error: dbError } = await supabaseAdmin
    .from("perfiles")
    .update({
      whatsapp_status: "connected",
      whatsapp_phone_number_id: phoneNumberId,
    })
    .eq("id", user.id);

  if (dbError) {
    console.error(
      "[whatsapp/success] Error actualizando perfiles:",
      dbError
    );
    return NextResponse.redirect(
      new URL(`${REDIRECT_URL}?whatsapp_error=db_update_failed`, req.url)
    );
  }

  console.log(
    `[whatsapp/success] ✅ WhatsApp conectado — usuario: ${user.id} | phoneNumberId: ${phoneNumberId}`
  );

  // --- 6. Redirigir con bandera de éxito ---
  return NextResponse.redirect(
    new URL(`${REDIRECT_URL}?whatsapp_success=true`, req.url)
  );
}