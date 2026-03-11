"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { MessageSquare, ExternalLink, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { generateSetupLink, disconnectWhatsapp } from "@/app/kapso-actions";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function ConfigPage() {
  const [loading, setLoading] = useState(false);
  const [whatsappState, setWhatsappState] = useState<{
    status: "connected" | "disconnected";
    loading: boolean;
  }>({ status: "disconnected", loading: true });

  const checkStatus = async () => {
    setWhatsappState(prev => ({ ...prev, loading: true }));
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('perfiles')
        .select('whatsapp_status')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error("Error consultando estado:", error);
        setWhatsappState(prev => ({ ...prev, loading: false }));
        return;
      }

      setWhatsappState({
        status: data?.whatsapp_status === 'connected' ? 'connected' : 'disconnected',
        loading: false
      });
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const data = await generateSetupLink();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert("Error al conectar con el servicio de mensajería");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectWhatsapp();
      setWhatsappState({ status: "disconnected", loading: false });
    } catch (err) {
      alert("Error al desconectar WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col gap-6">
      <CardHeader className="flex justify-between items-center px-6 pt-6">
        <div className="flex gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="text-primary" size={24} />
          </div>
          <div className="flex flex-col">
            <p className="text-md font-bold">Conexión de WhatsApp</p>
            <p className="text-small text-default-500">Estado de los recordatorios automáticos</p>
          </div>
        </div>

        {whatsappState.loading ? (
          <Chip variant="flat" size="sm">Cargando...</Chip>
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
          Vincula tu número de WhatsApp Business para que el sistema pueda enviar
          automáticamente los recordatorios de citas a tus pacientes.
        </p>

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
              onPress={handleConnect}
              endContent={!loading && !whatsappState.loading && <ExternalLink size={18} />}
            >
              {whatsappState.loading ? "Cargando..." : "Configurar Conexión"}
            </Button>
          )}

          <Button
            isIconOnly
            variant="flat"
            onPress={checkStatus}
            aria-label="Actualizar estado"
          >
            <RefreshCw size={18} className={whatsappState.loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}