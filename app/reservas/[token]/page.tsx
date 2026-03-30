import { format, parseISO, subHours } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardBody } from "@heroui/card";
import { createClient } from "@supabase/supabase-js";

import ReservaAcciones from "./reserva-acciones";
import { AlertTriangle } from "lucide-react";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReservaPublicaPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createServiceClient();

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

  // --- LÓGICA PARA RESERVAS ELIMINADAS ---
  if (error || !reserva) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardBody className="p-8 flex flex-col items-center text-center gap-6">
            <div className="p-4 rounded-full bg-danger-50 text-danger">
              <AlertTriangle size={40} />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-bold text-foreground">Turno no encontrado</h1>
              <p className="text-default-500">
                Esta reserva ha sido eliminada o el enlace es incorrecto. 
                Por favor, <strong>consulte directamente con la odontóloga</strong> para verificar su turno.
              </p>
            </div>
          </CardBody>
        </Card>
      </main>
    );
  }

  // --- LÓGICA DE EXPIRACIÓN (en el servidor) ---
  const fechaTurnoISO = `${reserva.reserva_fecha}T${reserva.hora_inicio}`;
  const fechaTurno = parseISO(fechaTurnoISO);
  const limiteExpiracion = subHours(fechaTurno, 12);
  const ahora = new Date();
  const expirado = ahora >= limiteExpiracion;
  const yaProcesado = reserva.estado !== "reservado";

  const pacientesData = reserva.pacientes as any;
  const paciente = Array.isArray(pacientesData) ? pacientesData[0] : pacientesData;
  const fechaFormateada = format(fechaTurno, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", { locale: es });

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card>
        <CardBody className="p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-tiny text-default-400 uppercase tracking-widest">Turno</p>
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
            token={token}
            yaProcesado={yaProcesado}
          />
        </CardBody>
      </Card>
    </main>
  );
}