import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const phone_number_id = searchParams.get("phone_number_id");

  if (status === "completed" && phone_number_id) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabaseAdmin
        .from("perfiles")
        .update({ whatsapp_status: "connected" })
        .eq("id", user.id);

      if (error) console.error("❌ Error actualizando estado:", error);
      else console.log("✅ WhatsApp conectado para usuario:", user.id);
    }
  }

  return NextResponse.redirect(new URL("/configuracion", req.url));
}