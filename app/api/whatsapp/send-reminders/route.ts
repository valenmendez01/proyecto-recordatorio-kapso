import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { format, addDays } from 'date-fns';

import { enviarNotificacionWhatsApp } from "@/app/meta-actions";

export async function GET(request: Request) {
  // 1. Validar seguridad contra el CRON_SECRET
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('No autorizado', { status: 401 });
  }

  // 2. Crear cliente administrativo (Service Role) para saltar RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 3. Calcular la fecha de mañana (24hs después de hoy)
    const fechaMañana = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    // 4. Buscar reservas para mañana que estén en estado 'reservado'
    const { data: turnos, error } = await supabase
      .from('reservas')
      .select('id, paciente_id, estado')
      .eq('reserva_fecha', fechaMañana)
      .eq('estado', 'reservado');

    if (error) throw error;

    if (!turnos || turnos.length === 0) {
      return NextResponse.json({ message: "No hay turnos para mañana" });
    }

    // 5. Enviar las notificaciones de recordatorio
    const promesasEnvio = turnos.map((turno) => 
      enviarNotificacionWhatsApp(turno.id, 'recordatorio')
    );

    const resultados = await Promise.allSettled(promesasEnvio);

    // 6. Log de resultados para monitoreo
    console.log(`[Cron] Procesados ${turnos.length} recordatorios.`);

    return NextResponse.json({ 
      success: true, 
      procesados: turnos.length 
    });

  } catch (error: any) {
    console.error("[Cron Error]:", error.message);
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}