"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { AlertCircle, CheckCircle2, XCircle, Zap } from "lucide-react";
import { completeOnboarding, enviarPlantillasARevision, verificarYSuscribirWaba } from "@/app/meta-actions";
import { createClient } from "@/utils/supabase/client";
import { addToast } from "@heroui/toast";
import { Alert } from "@heroui/alert";
import { Skeleton } from "@heroui/skeleton";
import { Divider } from "@heroui/divider";
import useSWR from "swr";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const supabase = createClient();

const PREDEFINED_TEMPLATES = [
  {
    id: "recordatorio",
    title: "Recordatorio de cita",
    header: "Recordatorio de cita",
    body: `Hola {nombre} {apellido}, te recuerdo que tenés un turno: 
📅 Día: *{fecha} a las {hora}*
📍 Dirección: Roca 1239

🔹 Si necesitás reprogramar tu cita, hacelo con al menos 12 h de anticipación.
🔹 En caso de síntomas compatibles con resfrío, por favor reprogramá tu visita.

*Ingresa al siguiente link para responder:* {link}

Muchas gracias! Saludos.`,
  },
  {
    id: "reserva",
    title: "Reserva de turno",
    header: "Reserva de turno",
    body: `Hola {nombre} {apellido}, tu turno ha sido confirmado:
📅 Día: *{fecha} a las {hora}*
📍 Dirección: Roca 1239

🔹 Si necesitás reprogramar tu cita, hacelo con al menos 12 h de anticipación.
🔹 En caso de síntomas compatibles con resfrío, por favor reprogramá tu visita.

Muchas gracias! Saludos.`,
  },
  {
    id: "actualizacion",
    title: "Actualización de turno",
    header: "Actualización de turno",
    body: `Hola {nombre} {apellido}, tu turno fue modificado: 
📅 Día: *{fecha} a las {hora}*
📍 Dirección: Roca 1239

🔹 Si necesitás reprogramar tu cita, hacelo con al menos 12 h de anticipación.
🔹 En caso de síntomas compatibles con resfrío, por favor reprogramá tu visita.

Muchas gracias! Saludos.`,
  },
];

export default function ConfigPage() {
  const [loading, setLoading] = useState(false);

  const [enviandoPlantillas, setEnviandoPlantillas] = useState(false);

  // Usamos useRef para tener el valor disponible de forma instantánea en el callback de FB
  const signupDataRef = useRef<{ wabaId?: string; phoneId?: string }>({});

  // SWR para plantillas — reemplaza cargarPlantillas + useState + useEffect derivado
  const { data: plantillasData, mutate: mutatePlantillas } = useSWR(
    "plantillas",
    async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("plantillas")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    { revalidateOnFocus: false }
  );

  const { data: logsData, isLoading: logsLoading } = useSWR(
    "notificaciones-log",
    async () => {
      const { data } = await supabase
        .from("notificaciones_log")
        .select("*")
        .eq("estado", "failed") // 👈 Solo trae los que fallaron
        .order("created_at", { ascending: false });
      return data || [];
    }
  );

  const { data: whatsappStatus, isLoading: whatsappLoading } = useSWR(
    "whatsapp-status",
    async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return "disconnected";
      const { data } = await supabase
        .from("perfiles")
        .select("whatsapp_status")
        .eq("id", user.id)
        .maybeSingle();
      
      if (data?.whatsapp_status === "connected") {
        await verificarYSuscribirWaba();
      }
      
      return data?.whatsapp_status === "connected" ? "connected" : "disconnected";
    },
    { revalidateOnFocus: false } // 👈 clave: no revalida al volver al tab
  );

  const plantillas = plantillasData ?? [];
  const plantillasEnviadas = plantillas.length > 0;

  // Escuchamos el evento nativo 'message' de Meta (Embedded Signup)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
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
        if (data.type === "WA_EMBEDDED_SIGNUP") {
          if (
            data.event === "FINISH" ||
            data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
          ) {
            const ids = {
              wabaId: data.data.waba_id,
              phoneId: data.data.phone_number_id,
            };
            console.log("[Meta postMessage] IDs capturados:", ids);
            signupDataRef.current = ids;
          }
        }
      } catch (err) {
        console.error("[Meta postMessage] Error al parsear:", err);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // PASO 2 y 3: Abrir Popup y Procesar Devolución de Llamada
  const handleConnect = () => {
    // @ts-ignore
    if (!window.FB) {
      addToast({ 
        title: "Error de conexión", 
        description: "El SDK de Facebook no se ha cargado correctamente. Recarga la página.", 
        color: "danger" 
      });
      return;
    }

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
        console.log("El usuario canceló el registro:", response);
      }
    };

    // @ts-ignore
    window.FB.login(fbLoginCallback, {
      config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
      response_type: "code",
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
            timezone: null,
          },
          phone: { category: null, description: "" },
        },
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3",
      },
    });
  };

  // Función para enviar plantillas predefinidas
  async function handleEnviarPlantillas() {
    setEnviandoPlantillas(true);
    const result = await enviarPlantillasARevision();
    setEnviandoPlantillas(false);

    if (result.error) {
      addToast({ title: "Error", description: result.error, color: "danger" });
    } else if (result.warning) {
      addToast({ title: "Atención", description: result.warning, color: "warning" });
    } else {
      addToast({
        title: "¡Listo!",
        description: "Plantillas enviadas. Meta las revisará en hasta 24 hs.",
        color: "success",
      });
      mutatePlantillas(); // SWR recarga para reflejar el estado PENDING en la UI
    }
  }

  function renderWhatsAppText(text: string) {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return <strong key={i}>{part.slice(1, -1)}</strong>;
      }
      return part;
    });
  }

  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const pages = Math.ceil((logsData?.length || 0) / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;

    return (logsData || []).slice(start, start + rowsPerPage);
  }, [page, logsData]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-default-500">Gestión oficial del Registro Insertado de Meta.</p>
      </div>

      <Card className="bg-content1">
        <CardBody className="flex flex-row items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <Skeleton isLoaded={!whatsappLoading} className="rounded-full">
              <div
                className={`p-3 rounded-full ${
                  whatsappStatus === "connected"
                    ? "bg-success/10 text-success"
                    : "bg-default-100 text-default-400"
                }`}
              >
                <Zap size={24} />
              </div>
            </Skeleton>
            <div className="flex flex-col gap-2">
              <Skeleton isLoaded={!whatsappLoading} className="rounded-lg">
                <p className="font-bold">Estado de la cuenta</p>
              </Skeleton>
              <Skeleton isLoaded={!whatsappLoading} className="rounded-lg w-24">
                <Chip
                  color={whatsappStatus === "connected" ? "success" : "default"}
                  variant="flat"
                  size="sm"
                  startContent={
                    whatsappStatus === "connected" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <XCircle size={14} />
                    )
                  }
                >
                  {whatsappStatus === "connected" ? "Conectado" : "Desconectado"}
                </Chip>
              </Skeleton>
            </div>
          </div>

          {!whatsappLoading && whatsappStatus === "disconnected" && (
            <Button color="primary" onPress={handleConnect} isLoading={loading}>
              Conectar WhatsApp
            </Button>
          )}
        </CardBody>
      </Card>

      {whatsappStatus === "connected" && (
        <Alert color="primary" title="¿Querés desconectar tu cuenta?">
          <p className="text-sm text-default-600 mt-1">
            Abrí WhatsApp Business →{" "}
            <span className="font-semibold">
              Configuración → Cuenta → Plataforma empresarial
            </span>{" "}
            y tocá <span className="font-semibold">Desconectar cuenta</span>.<br/> Tu estado se
            actualizará automáticamente.
          </p>
        </Alert>
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

      {/* PLANTILLAS (Solo si está conectado) */}
      {whatsappStatus === "connected" && (
        <>
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-1 px-1">
              <h3 className="text-xl font-bold">Plantillas</h3>
              <p className="text-sm text-default-500">
                Se usan para enviar mensajes automáticos y preaprobados a tus clientes fuera de la
                conversación activa.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PREDEFINED_TEMPLATES.map((temp) => {
                const enDB = plantillas.find((p) => p.header_text === temp.header);
                const statusColor =
                  enDB?.status === "APPROVED"
                    ? "success"
                    : enDB?.status === "REJECTED"
                    ? "danger"
                    : enDB?.status === "PENDING"
                    ? "warning"
                    : "default";

                const statusLabel =
                  enDB?.status === "APPROVED"
                    ? "APROBADA"
                    : enDB?.status === "REJECTED"
                    ? "RECHAZADA"
                    : enDB?.status === "PENDING"
                    ? "PENDIENTE"
                    : enDB?.status;

                const previewBody = temp.body
                  .replace(/{nombre}/g, "Juan")
                  .replace(/{apellido}/g, "Pérez")
                  .replace(/{fecha}/g, "Lunes 16 de abril")
                  .replace(/{hora}/g, "09:00 hs")
                  .replace(/{link}/g, "https://ejemplo.com/confirmar");

                return (
                  <Card key={temp.id} className="bg-content1">
                    <CardHeader className="flex items-center justify-between p-4">
                      <p className="text-sm font-semibold text-default-600">{temp.title}</p>
                      {enDB && (
                        <Chip className="flex justify-end" size="sm" color={statusColor} variant="flat">
                          {statusLabel}
                        </Chip>
                      )}
                    </CardHeader>

                    <Divider />

                    <CardBody className="bg-[#efeae2] dark:bg-[#0d1418] p-4">
                      <div className="relative">
                        <div
                          className="absolute -left-2 top-0 w-0 h-0 
                          border-t-[8px] border-t-white dark:border-t-[#202c33]
                          border-l-[8px] border-l-transparent"
                        />
                        <div className="max-w-[85%] bg-white dark:bg-[#202c33] rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
                          <p className="text-sm font-bold text-[#111b21] dark:text-white mb-1">
                            {temp.header}
                          </p>
                          <p className="text-xs text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap leading-relaxed">
                            {renderWhatsAppText(previewBody)}
                          </p>
                          <p className="text-[10px] text-[#667781] text-right mt-1">1:52</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>

            <Button
              color="primary"
              isLoading={enviandoPlantillas}
              isDisabled={plantillasEnviadas}
              onPress={handleEnviarPlantillas}
              className="self-start"
            >
              {plantillasEnviadas ? "Plantillas enviadas a revisión" : "Enviar plantillas a revisión"}
            </Button>
          </div>
          {/* SECCIÓN: HISTORIAL DE ENVÍO (Solo Errores) */}
          <div className="flex flex-col gap-4 mt-8">
            <div className="flex flex-col gap-1 px-1">
              <h3 className="text-xl font-bold">Registro de errores de envío</h3>
              <p className="text-sm text-default-500">
                Visualización simple de las notificaciones que fallaron al enviarse.
              </p>
            </div>

            <Card className="bg-content1">
              <CardBody className="p-0"> {/* P-0 para que la tabla llegue a los bordes */}
                <Table 
                  aria-label="Tabla de errores de envío"
                  removeWrapper // Da un aspecto más integrado dentro del Card
                  bottomContent={
                    pages > 1 && (
                      <div className="flex w-full justify-center py-4">
                        <Pagination
                          isCompact
                          showControls
                          color="primary"
                          page={page}
                          total={pages}
                          onChange={setPage}
                        />
                      </div>
                    )
                  }
                >
                  <TableHeader>
                    <TableColumn>FECHA</TableColumn>
                    <TableColumn>PACIENTE</TableColumn>
                    <TableColumn>TIPO</TableColumn>
                    <TableColumn>ERROR REPORTADO</TableColumn>
                  </TableHeader>
                  <TableBody 
                    emptyContent={"No se registran errores de envío."}
                    isLoading={logsLoading}
                    loadingContent={<Skeleton className="w-full h-20" />}
                  >
                    {items.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-default-500">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{log.paciente_nombre}</TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" className="capitalize text-tiny">
                            {log.tipo}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-danger text-xs italic">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{log.mensaje_error || "Error de entrega desconocido"}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}