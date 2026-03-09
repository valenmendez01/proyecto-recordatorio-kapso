"use server";
import { createClient } from "@/utils/supabase/server";

export async function generateSetupLink() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autorizado");

  // Llamada a Kapso para crear un "Customer" y obtener su link
  // Usamos el ID de Supabase como 'external_id' para linkearlos después
  const res = await fetch(`https://api.kapso.ai/v1/projects/${process.env.KAPSO_PROJECT_ID}/setup-links`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.KAPSO_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      external_id: user.id, 
      modes: ["coexistence"] // El modo que mantiene la App de WhatsApp abierta
    })
  });

  return await res.json();
}