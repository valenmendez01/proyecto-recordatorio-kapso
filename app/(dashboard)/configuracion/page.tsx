"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { MessageSquare, ExternalLink, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { generateSetupLink } from "@/app/kapso-actions";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function ConfigPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");

  const checkStatus = async () => {
    setStatus("loading");
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data } = await supabase
        .from('perfiles')
        .select('whatsapp_status')
        .eq('id', user.id)
        .single();
        
      setStatus(data?.whatsapp_status === 'connected' ? 'connected' : 'disconnected');
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
        window.open(data.url, "_blank");
      }
    } catch (err) {
      alert("Error al conectar con el servicio de mensajería");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Configuración</h1>
      
      <Card className="shadow-sm border-none bg-default-50/50">
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
          
          {/* Implementación del Chip de Estado */}
          {status === "loading" ? (
            <Chip variant="flat" size="sm">Cargando...</Chip>
          ) : status === "connected" ? (
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
            <Button 
              color="primary" 
              isLoading={loading}
              onPress={handleConnect}
              endContent={!loading && <ExternalLink size={18} />}
            >
              {status === "connected" ? "Reconfigurar Conexión" : "Configurar Conexión"}
            </Button>
            
            <Button 
              isIconOnly
              variant="flat"
              onPress={checkStatus}
              aria-label="Actualizar estado"
            >
              <RefreshCw size={18} className={status === "loading" ? "animate-spin" : ""} />
            </Button>
          </div>

          {status === "disconnected" && (
            <div className="mt-2 p-3 bg-warning-50 border border-warning-200 rounded-medium">
              <p className="text-tiny text-warning-700 font-medium">
                Nota: Necesitas escanear el QR desde tu aplicación de WhatsApp Business 
                para activar el envío de mensajes.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}