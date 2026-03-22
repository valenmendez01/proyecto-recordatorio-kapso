// app/(dashboard)/configuracion/page.tsx
"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { CheckCircle2, XCircle, Zap } from "lucide-react";
import { sendTestMessage, completeOnboarding } from "@/app/meta-actions"; 
import { createClient } from "@/utils/supabase/client";
import { addToast, ToastProvider } from "@heroui/toast";
import { Alert } from "@heroui/alert";
import { cn } from "@heroui/theme";
import { Skeleton } from "@heroui/skeleton";

const supabase = createClient();

const CustomAlert = forwardRef<HTMLDivElement, React.ComponentProps<typeof Alert> & { title?: string }>(
  ({ title, children, color = "default", className, classNames = {}, ...props }, ref) => {
    const colorClass = useMemo(() => {
      switch (color) {
        case "primary":   return "before:bg-primary";
        case "secondary": return "before:bg-secondary";
        case "success":   return "before:bg-success";
        case "warning":   return "before:bg-warning";
        case "danger":    return "before:bg-danger";
        default:          return "before:bg-default-300";
      }
    }, [color]);

    return (
      <Alert
        ref={ref}
        classNames={{
          ...classNames,
          base: cn(
            "bg-default-50 dark:bg-background shadow-sm",
            "border-1 border-default-200 dark:border-default-100",
            "relative before:content-[''] before:absolute before:z-10",
            "before:left-0 before:top-[-1px] before:bottom-[-1px] before:w-1",
            "rounded-l-none border-l-0",
            colorClass,
            classNames.base,
            className,
          ),
          mainWrapper: cn("pt-1", classNames.mainWrapper),
          iconWrapper: cn("dark:bg-transparent", classNames.iconWrapper),
        }}
        color={color}
        title={title}
        variant="faded"
        {...props}
      >
        {children}
      </Alert>
    );
  },
);
CustomAlert.displayName = "CustomAlert";

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

  // Usamos useRef en lugar de useState para tener el valor disponible de forma instantánea
  const signupDataRef = useRef<{ wabaId?: string; phoneId?: string }>({});

  useEffect(() => {
    // Escuchamos el evento nativo 'message' exactamente como en tu archivo de prueba
    const handleMessage = (event: MessageEvent) => {
      // Log para diagnosticar qué origins llegan realmente
      console.log("[Meta postMessage] Origin recibido:", event.origin);
      
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com" &&
        event.origin !== "https://business.facebook.com"
      ) {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        console.log("[Meta postMessage] Data recibida:", JSON.stringify(data));
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
            const ids = {
              wabaId: data.data.waba_id,
              phoneId: data.data.phone_number_id
            };
            console.log("[Meta postMessage] IDs capturados:", ids);
            // Guardamos en ref Y en state para tener ambos sincronizados
            signupDataRef.current = ids;
            setSignupData(ids);
          }
        }
      } catch (err) {
        console.error("[Meta postMessage] Error al parsear:", err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // PASO 2 y 3: Abrir Popup y Procesar Devolución de Llamada
  const handleConnect = () => {
    // @ts-ignore
    if (!window.FB) return alert("SDK no cargado");

    const fbLoginCallback = (response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        console.log("[FB.login] Callback recibido. Code (primeros 10):", code?.slice(0, 10));
        console.log("[FB.login] signupDataRef al momento del callback:", signupDataRef.current);

        const procesarOnboarding = async () => {
          setLoading(true);
          
          // Esperamos hasta 3 segundos a que lleguen los IDs del postMessage
          // usando polling cada 200ms en vez de un timeout fijo
          const IDS_TIMEOUT_MS = 3000;
          const POLL_INTERVAL_MS = 200;
          let elapsed = 0;

          await new Promise<void>((resolve) => {
            const interval = setInterval(() => {
              elapsed += POLL_INTERVAL_MS;
              const { wabaId, phoneId } = signupDataRef.current;
              if ((wabaId && phoneId) || elapsed >= IDS_TIMEOUT_MS) {
                clearInterval(interval);
                resolve();
              }
            }, POLL_INTERVAL_MS);
          });

          const { wabaId, phoneId } = signupDataRef.current;
          console.log("[procesarOnboarding] IDs después de espera:", { wabaId, phoneId });
          
          if (wabaId && phoneId) {
            try {
              const result = await completeOnboarding(code, wabaId, phoneId);
              console.log("[procesarOnboarding] Resultado:", result);
              
              if (result.success) {
                addToast({
                  title: "¡Conexión completada!",
                  description: "Tus credenciales se han guardado en la base de datos.",
                  color: "success",
                });
                setTimeout(() => window.location.reload(), 1500);
              } else {
                addToast({ title: "Error al guardar", description: result.error, color: "danger" });
              }
            } catch (err: any) {
              console.error("[procesarOnboarding] Error técnico:", err);
              addToast({ title: "Error técnico", description: err.message, color: "danger" });
            }
          } else {
            console.error("[procesarOnboarding] IDs vacíos después de esperar", IDS_TIMEOUT_MS, "ms");
            addToast({
              title: "Error de sincronización",
              description: "Meta no devolvió los identificadores de tu cuenta. Revisá la consola del navegador.",
              color: "danger",
            });
          }
          setLoading(false);
        };

        procesarOnboarding();
        
      } else {
        console.log('El usuario canceló el registro:', response);
      }
    };

    // Usamos EXACTAMENTE la configuración que te funciona en tu archivo de prueba
    // @ts-ignore
    window.FB.login(fbLoginCallback, {
      config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
      // scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        version: "v3",
        setup: {
          business: {
            id: null,
            name: "Recordatorios Coexistence",
            email: "info@odontologabetianamorante.com.ar",
            phone: {},
            address: {},
            timezone: null
          },
          phone: { category: null, description: "" },
        },
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3"
      }
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
            <Skeleton isLoaded={!whatsappState.loading} className="rounded-full">
              <div className={`p-3 rounded-full ${whatsappState.status === 'connected' ? 'bg-success/10 text-success' : 'bg-default-100 text-default-400'}`}>
                <Zap size={24} />
              </div>
            </Skeleton>
            <div className="flex flex-col gap-2">
              <Skeleton isLoaded={!whatsappState.loading} className="rounded-lg">
                <p className="font-bold">Estado de la cuenta</p>
              </Skeleton>
              <Skeleton isLoaded={!whatsappState.loading} className="rounded-lg w-24">
                <Chip
                  color={whatsappState.status === "connected" ? "success" : "default"}
                  variant="flat"
                  size="sm"
                  startContent={whatsappState.status === "connected" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                >
                  {whatsappState.status === "connected" ? "Conectado" : "Desconectado"}
                </Chip>
              </Skeleton>
            </div>
          </div>

          {!whatsappState.loading && whatsappState.status === "disconnected" && (
            <Button color="primary" onPress={handleConnect} isLoading={loading}>
              Conectar WhatsApp
            </Button>
          )}
        </CardBody>
      </Card>

      {whatsappState.status === "connected" && (
        <CustomAlert
          color="danger"
          title="¿Querés desconectar tu cuenta?"
        >
          <p className="text-sm text-default-600 mt-1">
            Abrí WhatsApp Business →{" "}
            <span className="font-semibold">
              Configuración → Cuenta → Plataforma empresarial
            </span>{" "}
            y tocá <span className="font-semibold">{"Desconectar cuenta"}</span>.
            Tu estado se actualizará automáticamente.
          </p>
        </CustomAlert>
      )}

      {/* 
      Solo para pruebas: Enviar mensaje de validación de Meta

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
      */}
    </div>
  );
}