// app/(dashboard)/configuracion/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Settings2,
  Zap
} from "lucide-react";
import { sendTestMessage, completeOnboarding } from "@/app/meta-actions"; 
import { createClient } from "@/utils/supabase/client";
import { Input } from "@heroui/input";

const supabase = createClient();

export default function ConfigPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [whatsappState, setWhatsappState] = useState<{
    status: "connected" | "disconnected";
    loading: boolean;
  }>({ status: "disconnected", loading: true });

  const [testLoading, setTestLoading] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  // Almacenamos los IDs (WABA y Phone) que llegan por el 'message event' de Meta
  const [signupData, setSignupData] = useState<{ wabaId?: string; phoneId?: string }>({});

  useEffect(() => {
    // Escuchamos el evento WA_EMBEDDED_SIGNUP configurado en el FacebookSDK
    const handleWaEvent = (e: any) => {
      const { data, type } = e.detail;
      if (type === 'WA_EMBEDDED_SIGNUP' && data.waba_id) {
        setSignupData({
          wabaId: data.waba_id,
          phoneId: data.phone_number_id
        });
      }
    };

    window.addEventListener('wa_signup_event', handleWaEvent);
    return () => window.removeEventListener('wa_signup_event', handleWaEvent);
  }, []);

  // PASO 2 y 3: Abrir Popup y Procesar Devolución de Llamada
  const handleConnect = () => {
    // @ts-ignore
    if (!window.FB) return alert("SDK no cargado");

    // Definimos el callback como una función NORMAL (sin async)
    const fbLoginCallback = (response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        console.log('Response code recibido:', code);

        // Creamos una función interna asíncrona para procesar el onboarding
        const procesarOnboarding = async () => {
          setLoading(true);
          if (signupData.wabaId && signupData.phoneId) {
            try {
              const result = await completeOnboarding(code, signupData.wabaId, signupData.phoneId);
              
              if (result.success) {
                alert("¡Conexión completada y número registrado!");
                window.location.reload();
              } else {
                alert("Error en el registro: " + result.error);
              }
            } catch (err) {
              console.error("Error técnico:", err);
            }
          } else {
            alert("No se recibieron los IDs de la sesión. Intenta de nuevo.");
          }
          setLoading(false);
        };

        // Ejecutamos la lógica asíncrona
        procesarOnboarding();
        
      } else {
        console.log('El usuario canceló el registro:', response);
      }
    };

    // Lanzamos el login pasando la función normal
    // @ts-ignore
    window.FB.login(fbLoginCallback, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      extras: {
        feature: 'whatsapp_embedded_signup',
        setup: {
          business_config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID 
        }
      },
      response_type: 'code',
      override_default_response_type: true,
    });
  };

  const handleSendTest = async () => {
    if (!testPhone) {
      setErrorMsg("Ingresa un número para la prueba.");
      return;
    }
    setTestLoading(true);
    const result = await sendTestMessage(testPhone);
    setTestLoading(false);

    if (result.error) alert("Error: " + result.error);
    else alert("¡Mensaje enviado con éxito!");
  };

  const checkStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("perfiles").select("whatsapp_status").eq("id", user.id).maybeSingle();
    setWhatsappState({
      status: data?.whatsapp_status === "connected" ? "connected" : "disconnected",
      loading: false,
    });
  };

  useEffect(() => { checkStatus(); }, []);

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-default-500">Gestión oficial del Registro Insertado de Meta.</p>
      </div>

      <Card className="bg-content1">
        <CardBody className="flex flex-row items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${whatsappState.status === 'connected' ? 'bg-success/10 text-success' : 'bg-default-100 text-default-400'}`}>
              <Zap size={24} />
            </div>
            <div>
              <p className="font-bold">Estado de la cuenta</p>
              <Chip 
                color={whatsappState.status === "connected" ? "success" : "default"} 
                variant="flat" 
                size="sm"
                startContent={whatsappState.status === "connected" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              >
                {whatsappState.status === "connected" ? "Conectado" : "Desconectado"}
              </Chip>
            </div>
          </div>
          
          {whatsappState.status === "disconnected" ? (
            <div className="flex gap-2">
              <Button color="primary" onPress={handleConnect} isLoading={loading}>
                Conectar WhatsApp
              </Button>
            </div>
          ) : (
            <Button variant="light" color="danger" startContent={<Trash2 size={18} />}>
              Desconectar
            </Button>
          )}
        </CardBody>
      </Card>

      <Card className="border-primary/40 border-2 shadow-lg bg-content1">
        <CardHeader className="flex gap-3 px-6 pt-6">
          <MessageSquare className="text-primary" size={24} />
          <p className="text-lg font-bold">Modo de Validación (Test)</p>
        </CardHeader>
        <CardBody className="px-6 py-6 gap-4">
          <Input
            label="Número de destino"
            placeholder="542994562051"
            value={testPhone}
            onValueChange={setTestPhone}
            startContent={<span className="text-default-400">+</span>}
          />
          {errorMsg && <p className="text-danger text-xs">{errorMsg}</p>}
          <Button color="primary" isLoading={testLoading} onPress={handleSendTest} startContent={<RefreshCw size={20} />}>
            Enviar hello_world
          </Button>
        </CardBody>
      </Card>

      <Card className="shadow-sm border-none bg-content1">
        <CardHeader className="px-6 pt-6">
          <h3 className="text-md font-bold flex items-center gap-2">
            <Settings2 size={18} /> Identificadores
          </h3>
        </CardHeader>
        <CardBody className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-default-50 rounded-lg border border-default-200">
            <p className="text-tiny uppercase font-bold text-default-400">Phone ID</p>
            <p className="font-mono text-small truncate">{process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID || "No configurado"}</p>
          </div>
          <div className="p-3 bg-default-50 rounded-lg border border-default-200">
            <p className="text-tiny uppercase font-bold text-default-400">Versión API</p>
            <p className="font-mono text-small">{process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION || "Error"}</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}