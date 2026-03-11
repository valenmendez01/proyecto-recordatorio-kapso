"use server";
import { createClient } from "@/utils/supabase/server";

const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const PLATFORM_API_URL = 'https://api.kapso.ai/platform/v1';

export async function generateSetupLink() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autorizado");

  // 1. Verificar si el usuario ya tiene un Customer ID en nuestra DB
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('email, whatsapp_customer_id')
    .eq('id', user.id)
    .single();

  let customerId = perfil?.whatsapp_customer_id;

  // 2. Si no existe, lo creamos en Kapso primero
  if (!customerId) {
    const customerRes = await fetch(`${PLATFORM_API_URL}/customers`, {
      method: 'POST',
      headers: {
        'X-API-Key': KAPSO_API_KEY!, // Usamos X-API-Key según la doc
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        customer: {
          name: perfil?.email || user.email,
          external_customer_id: user.id // Vinculamos con tu ID de Supabase
        } 
      })
    });

    const customerData = await customerRes.json();
    if (!customerRes.ok) throw new Error(customerData.message || "Error al crear cliente");

    customerId = customerData.data.id;

    // Guardamos el ID de Kapso en nuestro perfil
    await supabase
      .from('perfiles')
      .update({ whatsapp_customer_id: customerId })
      .eq('id', user.id);
  }

  // 3. Generamos el Setup Link para ese Customer específico
  const setupRes = await fetch(`${PLATFORM_API_URL}/customers/${customerId}/setup_links`, {
    method: 'POST',
    headers: {
      'X-API-Key': KAPSO_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      setup_link: {
        success_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/whatsapp/success`,
        failure_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/whatsapp/failed`
      } 
    })
  });

  const setupData = await setupRes.json();

  // 👇 Agrega esto
  console.log("📦 Setup link response status:", setupRes.status);
  console.log("📦 Setup link response body:", JSON.stringify(setupData, null, 2));

  if (!setupRes.ok) throw new Error(setupData.message || "Error al generar link");

  return setupData.data;
}