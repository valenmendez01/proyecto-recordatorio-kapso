"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { generateEmbeddedSignupUrl } from "@/app/meta-actions"; // ✅ nombre corregido
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function ConfigPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [whatsappState, setWhatsappState] = useState<{
    status: "connected" | "disconnected";
    loading: boolean;
  }>({ status: "disconnected", loading: true });

  // ---------------------------------------------------------------------------
  // Consulta el estado actual en la tabla `perfiles`
  // ---------------------------------------------------------------------------
  const checkStatus = async () => {
    setErrorMsg(null);
    setWhatsappState((prev) => ({ ...prev, loading: true }));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setWhatsappState({ status: "disconnected", loading: false });
      return;
    }

    const { data, error } = await supabase
      .from("perfiles")
      .select("whatsapp_status")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[ConfigPage] Error consultando estado:", error);
      setWhatsappState((prev) => ({ ...prev, loading: false }));
      setErrorMsg("No se pudo verificar el estado de la conexión.");
      return;
    }

    setWhatsappState({
      status: data?.whatsapp_status === "connected" ? "connected" : "disconnected",
      loading: false,
    });
  };

  useEffect(() => {
    checkStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Inicia el flujo de Embedded Signup de Meta
  // ---------------------------------------------------------------------------
  const handleConnect = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const result = await generateEmbeddedSignupUrl();

      if ("error" in result) {
        // La Server Action devolvió un error tipado
        setErrorMsg(result.error);
        return;
      }

      // Redirigir al diálogo OAuth de Meta (abre en la misma pestaña)
      window.location.href = result.url;
    } catch (err) {
      console.error("[ConfigPage] Error inesperado al conectar:", err);
      setErrorMsg("Error inesperado al iniciar el registro con Meta.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Desconecta WhatsApp: limpia el estado en `perfiles`
  // ---------------------------------------------------------------------------
  const handleDisconnect = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMsg("No hay sesión activa.");
        return;
      }

      const { error } = await supabase
        .from("perfiles")
        .update({
          whatsapp_status: "disconnected",
          whatsapp_phone_number_id: null,
        })
        .eq("id", user.id);

      if (error) {
        console.error("[ConfigPage] Error al desconectar:", error);
        setErrorMsg("No se pudo desconectar. Intentá de nuevo.");
        return;
      }

      setWhatsappState({ status: "disconnected", loading: false });
    } catch (err) {
      console.error("[ConfigPage] Error inesperado al desconectar:", err);
      setErrorMsg("Error inesperado al desconectar WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="h-full w-full">
      <Card className="flex flex-col gap-6">
        <CardHeader className="flex justify-between items-center px-6 pt-6">
          <div className="flex gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="text-primary" size={24} />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold">Conexión de WhatsApp</p>
              <p className="text-small text-default-500">
                Estado de los recordatorios automáticos
              </p>
            </div>
          </div>

          {/* Chip de estado */}
          {whatsappState.loading ? (
            <Chip variant="flat" size="sm">
              Cargando...
            </Chip>
          ) : whatsappState.status === "connected" ? (
            <Chip
              color="success"
              variant="flat"
              startContent={<CheckCircle2 size={14} />}
            >
              Conectado
            </Chip>
          ) : (
            <Chip
              color="danger"
              variant="flat"
              startContent={<XCircle size={14} />}
            >
              Desconectado
            </Chip>
          )}
        </CardHeader>

        <CardBody className="px-6 pb-6 gap-4">
          <p className="text-sm text-default-600">
            Vincula tu número de WhatsApp Business para que el sistema pueda
            enviar automáticamente los recordatorios de citas a tus pacientes.
          </p>

          {/* Mensaje de error inline */}
          {errorMsg && (
            <p className="text-sm text-danger" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-3 mt-2">
            {whatsappState.status === "connected" ? (
              <Button
                color="danger"
                variant="flat"
                isLoading={loading}
                isDisabled={whatsappState.loading}
                onPress={handleDisconnect}
              >
                Desconectar
              </Button>
            ) : (
              <Button
                color="primary"
                isLoading={loading || whatsappState.loading}
                isDisabled={loading || whatsappState.loading}
                onPress={handleConnect}
                endContent={
                  !loading && !whatsappState.loading ? (
                    <ExternalLink size={18} />
                  ) : undefined
                }
              >
                {whatsappState.loading ? "Cargando..." : "Configurar Conexión"}
              </Button>
            )}

            {/* Botón para refrescar estado manualmente */}
            <Button
              isIconOnly
              variant="flat"
              isDisabled={whatsappState.loading || loading}
              onPress={checkStatus}
              aria-label="Actualizar estado"
            >
              <RefreshCw
                size={18}
                className={whatsappState.loading ? "animate-spin" : ""}
              />
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}