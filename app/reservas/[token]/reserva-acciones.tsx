"use client";

import { Button } from "@heroui/button";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { useTransition } from "react";

import { confirmarReserva, cancelarReserva } from "./actions";

interface Props {
  token: string;
  estado: string;
  expirado: boolean;
  yaProcesado: boolean;
}

export default function ReservaAcciones({ token, estado, expirado, yaProcesado }: Props) {
  const [isPending, startTransition] = useTransition();

  if (yaProcesado) {
    const esConfirmado = estado === "confirmado";

    return (
      <div className={`flex items-center gap-3 rounded-xl p-4 ${esConfirmado ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>
        {esConfirmado
          ? <><CheckCircle className="size-5" /> Tu asistencia ya fue confirmada. ¡Te esperamos!</>
          : <><XCircle className="size-5" /> Este turno fue cancelado.</>
        }
      </div>
    );
  }

  if (expirado) {
    return (
      <div className="flex items-center gap-3 rounded-xl p-4 bg-warning-50 text-warning-700">
        <Clock className="size-5 shrink-0" />
        <p className="text-sm">
          Este link ha expirado. Para cambios con menos de 12 horas de anticipación,
          por favor comunicate directamente con el consultorio.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-default-500">¿Podés asistir a tu turno?</p>
      <Button
        className="w-full"
        color="success"
        isLoading={isPending}
        startContent={<CheckCircle className="size-4" />}
        variant="flat"
        onPress={() => startTransition(() => confirmarReserva(token))}
      >
        Confirmar Asistencia
      </Button>
      <Button
        className="w-full"
        color="danger"
        isLoading={isPending}
        startContent={<XCircle className="size-4" />}
        variant="flat"
        onPress={() => startTransition(() => cancelarReserva(token))}
      >
        Cancelar Turno
      </Button>
    </div>
  );
}