// app/api/whatsapp/send-reminders/route.ts
import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { format, addDays, addMinutes } from 'date-fns';

import { enviarNotificacionWhatsApp } from "@/app/meta-actions";

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const ahora = new Date();
    // Calculamos el rango de tiempo exactamente 24 horas adelante
    const fechaMañana = format(addDays(ahora, 1), 'yyyy-MM-dd');
    const horaInicioVentana = format(addDays(ahora, 1), 'HH:mm');
    const horaFinVentana = format(addMinutes(addDays(ahora, 1), 30), 'HH:mm');

    // Buscamos turnos para mañana, en estado 'reservado', 
    // cuya hora de inicio esté dentro de los próximos 30 minutos (mañana)
    const { data: turnos, error } = await supabase
      .from('reservas')
      .select('id')
      .eq('reserva_fecha', fechaMañana)
      .eq('estado', 'reservado')
      .gte('hora_inicio', horaInicioVentana)
      .lt('hora_inicio', horaFinVentana);

    if (error) throw error;
    if (!turnos || turnos.length === 0) {
      return NextResponse.json({ message: "No hay turnos en esta ventana de tiempo" });
    }

    const promesasEnvio = turnos.map((turno) => 
      enviarNotificacionWhatsApp(turno.id, 'recordatorio')
    );

    await Promise.allSettled(promesasEnvio);

    return NextResponse.json({ 
      success: true, 
      procesados: turnos.length,
      ventana: `${horaInicioVentana} a ${horaFinVentana}`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}