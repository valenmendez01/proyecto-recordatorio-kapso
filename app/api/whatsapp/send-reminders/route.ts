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
    // 1. Obtenemos la hora actual en UTC y la ajustamos a Argentina (UTC-3)
    const ahoraUTC = new Date();
    const ahoraArg = new Date(ahoraUTC.getTime() - (3 * 60 * 60 * 1000));
    
    // 2. Calculamos la ventana para mañana basándonos en hora Argentina
    const mañanaArg = addDays(ahoraArg, 1);
    const fechaMañana = format(mañanaArg, 'yyyy-MM-dd');
    const horaInicioVentana = format(mañanaArg, 'HH:mm');
    const horaFinVentana = format(addMinutes(mañanaArg, 30), 'HH:mm');

    console.log(`Buscando turnos para ${fechaMañana} entre ${horaInicioVentana} y ${horaFinVentana}`);

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