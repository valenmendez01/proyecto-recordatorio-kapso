import { notFound } from "next/navigation";
import { format, parseISO, subHours } from "date-fns";
import { es } from "date-fns/locale";

import ReservaAcciones from "./reserva-acciones";

import { createClient } from "@/utils/supabase/server";

interface Props {
  params: { token: string };
}

export default async function ReservaPublicaPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: reserva, error } = await supabase
    .from("reservas")
    .select(`
      id,
      reserva_fecha,
      hora_inicio,
      estado,
      token,
      pacientes (nombre, apellido)
    `)
    .eq("token", token)
    .single();

  if (error || !reserva) return notFound();

  // --- LÓGICA DE EXPIRACIÓN (en el servidor) ---
  const fechaTurnoISO = `${reserva.reserva_fecha}T${reserva.hora_inicio}`;
  const fechaTurno = parseISO(fechaTurnoISO);
  const limiteExpiracion = subHours(fechaTurno, 12);
  const ahora = new Date();
  const expirado = ahora >= limiteExpiracion;
  const yaProcesado = reserva.estado !== "reservado";

  const paciente = reserva.pacientes as { nombre: string; apellido: string } | null;
  const fechaFormateada = format(fechaTurno, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", { locale: es });

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-divider bg-content1 shadow-md p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-tiny text-default-400 uppercase tracking-widest">Turno médico</p>
          <h1 className="text-2xl font-semibold text-foreground">
            Hola, {paciente?.nombre} {paciente?.apellido}
          </h1>
          <p className="text-default-600 mt-1">
            Tu turno está agendado para el{" "}
            <span className="font-medium text-foreground">{fechaFormateada}</span>.
          </p>
        </div>

        <ReservaAcciones
          estado={reserva.estado}
          expirado={expirado}
          token={params.token}
          yaProcesado={yaProcesado}
        />
      </div>
    </main>
  );
}