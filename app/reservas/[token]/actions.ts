"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

export async function confirmarReserva(token: string) {
  const supabase = await createClient();

  await supabase
    .from("reservas")
    .update({ estado: "confirmado" })
    .eq("token", token)
    .eq("estado", "reservado");

  revalidatePath(`/reservas/${token}`);
}

export async function cancelarReserva(token: string) {
  const supabase = await createClient();

  await supabase
    .from("reservas")
    .update({ estado: "cancelado" })
    .eq("token", token)
    .eq("estado", "reservado");

  revalidatePath(`/reservas/${token}`);
}