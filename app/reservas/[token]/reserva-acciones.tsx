"use client";

import { Button } from "@heroui/button";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { confirmarReserva, cancelarReserva } from "./actions";

interface Props {
  token: string;
  estado: string;
  expirado: boolean;
  yaProcesado: boolean;
}

export default function ReservaAcciones({ token, estado, expirado, yaProcesado }: Props) {
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<"confirmar" | "cancelar" | null>(null);
  const [estadoLocal, setEstadoLocal] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const estadoEfectivo = estadoLocal ?? estado;
  const yaProcesadoEfectivo = yaProcesado || estadoLocal !== null;

  if (yaProcesadoEfectivo) {
    const esConfirmado = estadoEfectivo === "confirmado";

    return (
      <div className={`flex items-center gap-3 rounded-xl p-4 ${esConfirmado ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>
        {esConfirmado
          ? <><CheckCircle className="size-5" /> Tu asistencia ya fue confirmada. ¡Te espero!</>
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
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl p-3 bg-danger-50 text-danger-700 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <Button
        className="w-full"
        color="success"
        isDisabled={isPending}
        isLoading={isPending && loadingAction === "confirmar"}
        startContent={<CheckCircle className="size-4" />}
        variant="flat"
        onPress={() => {
          setLoadingAction("confirmar");
          setErrorMsg(null);
          startTransition(async () => {
            const result = await confirmarReserva(token);

            if (result?.error) {
              setErrorMsg(result.error);
            } else {
              setEstadoLocal("confirmado");
            }
            setLoadingAction(null);
          });
        }}
      >
        Confirmar Asistencia
      </Button>
      <Button
        className="w-full"
        color="danger"
        isDisabled={isPending}
        isLoading={isPending && loadingAction === "cancelar"}
        startContent={<XCircle className="size-4" />}
        variant="flat"
        onPress={() => {
          setLoadingAction("cancelar");
          setErrorMsg(null);
          startTransition(async () => {
            const result = await cancelarReserva(token);

            if (result?.error) {
              setErrorMsg(result.error);
            } else {
              setEstadoLocal("cancelado");
            }
            setLoadingAction(null);
          });
        }}
      >
        Cancelar Turno
      </Button>
    </div>
  );
}