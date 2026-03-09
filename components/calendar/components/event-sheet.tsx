"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from "@heroui/drawer";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { DatePicker } from "@heroui/date-picker";
import { parseDate, getLocalTimeZone, today } from "@internationalized/date";
import {
  Calendar,
  Check,
  Cross,
  Clock,
  User,
  FileText,
  X,
  ClipboardClock,
  Pencil,
  Save,
  Undo2,
  ChartNoAxesGantt,
} from "lucide-react";

import { useCalendarStore } from "../store/calendar-store";

import { CalendarEvent } from "@/types/types";
import { createClient } from "@/utils/supabase/server";
import clsx from "clsx";

interface EventSheetProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return format(date, "EEEE, d 'de' MMMM", { locale: es });
}

export function EventSheet({ event, open, onOpenChange }: EventSheetProps) {
  const supabase = createClient();
  const { fetchEvents } = useCalendarStore();

  // --- ESTADOS DE VISTA ---
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // --- ESTADOS DE EDICIÓN (FORMULARIO) ---
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [horariosDisponibles, setHorariosDisponibles] = useState<
    Array<{ id: string; hora_inicio: string }>
  >([]);

  // Datos del formulario
  const [editServiceId, setEditServiceId] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editHorarioId, setEditHorarioId] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Cargar lista de servicios al montar (una sola vez)
  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from("servicios")
        .select("*")
        .eq("esta_activo", true);

      if (data) setServicios(data);
    };

    if (open) fetchServices();
  }, [open]);

  // --- 1. ENTRAR EN MODO EDICIÓN ---
  const handleEnterEditMode = async () => {
    if (!event?.id) return;
    setIsLoadingDetails(true);

    // Obtener la reserva completa (necesitamos los IDs crudos que no están en el CalendarEvent)
    const { data: reserva, error } = await supabase
      .from("reservas")
      .select("servicio_id, horario_servicio_id, reserva_fecha, notas")
      .eq("id", event.id)
      .single();

    if (reserva && !error) {
      setEditServiceId(reserva.servicio_id);

      // Convertir string "YYYY-MM-DD" a Date con zona horaria local segura
      const [y, m, d] = reserva.reserva_fecha.split("-").map(Number);

      setEditDate(new Date(y, m - 1, d));

      setEditHorarioId(reserva.horario_servicio_id);
      setEditNotes(reserva.notas || ""); // Limpiar prefijo si existe o dejar raw

      setIsEditing(true);
    }
    setIsLoadingDetails(false);
  };

  // --- 2. LOGICA DE DISPONIBILIDAD (Similar al Dialog) ---
  useEffect(() => {
    const updateAvailability = async () => {
      // Solo ejecutar si estamos editando y tenemos datos mínimos
      if (!isEditing || !editServiceId || !editDate) {
        setHorariosDisponibles([]);

        return;
      }

      const dateStr = format(editDate, "yyyy-MM-dd");
      const dayOfWeek = editDate.getDay();

      // A. Horarios base del servicio
      const { data: slotsBase } = await supabase
        .from("horarios_servicio")
        .select("id, hora_inicio")
        .eq("servicio_id", editServiceId)
        .eq("dia_semana", dayOfWeek)
        .eq("esta_activo", true)
        .order("hora_inicio");

      if (!slotsBase || slotsBase.length === 0) {
        setHorariosDisponibles([]);

        return;
      }

      // B. Reservas ocupadas
      const { data: ocupados } = await supabase
        .from("reservas")
        .select("horario_servicio_id, id") // Traemos ID también para comparar
        .eq("reserva_fecha", dateStr)
        .in("estado", ["reservado", "confirmado", "bloqueado"]);

      // C. Filtrar: Ocupado si ID está en la lista Y NO es mi propia reserva
      // (Permite mantener mi horario actual aunque salga en la lista de ocupados)
      const idsOcupados =
        ocupados
          ?.filter((o) => o.id !== event?.id) // IMPORTANTE: Excluir mi propia reserva
          .map((o) => o.horario_servicio_id) || [];

      const disponibles = slotsBase.filter(
        (slot) => !idsOcupados.includes(slot.id),
      );

      setHorariosDisponibles(disponibles);
    };

    updateAvailability();
  }, [editServiceId, editDate, isEditing, event?.id]);

  // --- 3. GUARDAR CAMBIOS ---
  const handleSaveChanges = async () => {
    if (!event?.id || !editDate) return;
    setUpdatingStatus("saving");

    try {
      // 1. Actualizar la reserva en Supabase
      const { error } = await supabase
        .from("reservas")
        .update({
          servicio_id: editServiceId,
          reserva_fecha: format(editDate, "yyyy-MM-dd"),
          horario_servicio_id: editHorarioId,
          notas: editNotes,
        })
        .eq("id", event.id);

      if (error) throw new Error(`Error BD: ${error.message}`);

      // ============================================================
      // 2. LOGICA WHATSAPP
      // ============================================================

      // Obtenemos los datos frescos para el mensaje
      const { data: datosReserva, error: errorDatos } = await supabase
        .from("reservas")
        .select(
          `
          perfiles (nombre, apellido, telefono),
          horarios_servicio (hora_inicio)
        `,
        )
        .eq("id", event.id)
        .single();

      if (errorDatos || !datosReserva) {
        alert("Error obteniendo datos para WhatsApp:");
        // No lanzamos error para no bloquear el guardado visual, pero alertamos
      } else {
        const perfil = datosReserva.perfiles;
        // Verificamos si perfil es un array (caso raro) o un objeto y si tiene teléfono
        const telefono = Array.isArray(perfil)
          ? perfil[0]?.telefono
          : perfil?.telefono;
        const nombre = Array.isArray(perfil)
          ? perfil[0]?.nombre
          : perfil?.nombre;
        const apellido = Array.isArray(perfil)
          ? perfil[0]?.apellido
          : perfil?.apellido;

        if (telefono) {
          const nombreCompleto = `${nombre} ${apellido}`.trim();
          const fechaFormateada = format(editDate, "EEEE, d 'de' MMMM", {
            locale: es,
          });
          const horaFormateada =
            datosReserva.horarios_servicio?.hora_inicio.slice(0, 5) || "00:00";

          // Enviar a la API
          const response = await fetch("/api/whatsapp/templates/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: telefono,
              templateName: "actualizacion", // <--- VERIFICA ESTE NOMBRE EN META
              languageCode: "es_AR", // <--- VERIFICA EL IDIOMA EN META (puede ser 'es' o 'es_AR')
              parameters: [nombreCompleto, fechaFormateada, horaFormateada],
              parameterInfo: {
                parameters: [
                  { name: "nombre", component: "BODY" },
                  { name: "fecha", component: "BODY" },
                  { name: "hora", component: "BODY" },
                ],
              },
            }),
          });

          if (!response.ok) {
            alert(
              "Reserva guardada, pero falló el envío de WhatsApp. Revisa la consola.",
            );
          }
        }
      }
      // ============================================================

      await fetchEvents();
      setIsEditing(false);
    } catch (error: any) {
      alert(`Error al guardar: ${error.message || "Desconocido"}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // --- LÓGICA ORIGINAL DE ESTADOS ---
  const statusColors = {
    confirmado: "bg-green-100 text-green-700 border-green-200",
    reservado: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cancelado: "bg-red-100 text-red-700 border-red-200",
  };

  const statusLabels = {
    confirmado: "Confirmado",
    reservado: "Reservado",
    cancelado: "Cancelado",
  };

  const handleUpdateStatus = async (
    nuevoEstado: "confirmado" | "cancelado" | "reservado",
  ) => {
    if (!event?.id) return;
    setUpdatingStatus(nuevoEstado);
    try {
      const { error } = await supabase
        .from("reservas")
        .update({ estado: nuevoEstado })
        .eq("id", event.id);

      if (error) throw error;
      await fetchEvents();
      onOpenChange(false);
    } catch (error) {
      alert(`Error al actualizar estado: ${error}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (!event) return null;
  const currentStatusColor =
    statusColors[event.status] || "bg-gray-100 text-gray-700";

  return (
    <Drawer
      classNames={{
        base: "sm:max-w-[400px] border-l border-border",
        header: "p-0",
        body: "p-0",
        closeButton: "hidden",
      }}
      isOpen={open}
      placement="right"
      size="sm"
      onOpenChange={(isOpen) => {
        if (!isOpen) setIsEditing(false); // Reset al cerrar
        onOpenChange(isOpen);
      }}
    >
      <DrawerContent>
        {(onClose) => (
          <>
            <DrawerHeader className="flex flex-col gap-0 border-b border-border px-6 py-6 bg-gray-50/50">
              <div className="flex items-center justify-between mb-4">
                {/* Badge de Estado (Solo visible si NO edito o como info) */}
                <div
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-xs font-medium border capitalize",
                    currentStatusColor,
                  )}
                >
                  {statusLabels[event.status] || event.status}
                </div>

                <div className="flex gap-2">
                  {/* BOTÓN EDITAR (Solo visible en modo Vista) */}
                  {!isEditing && event.status !== "cancelado" && (
                    <Button
                      isIconOnly
                      isLoading={isLoadingDetails}
                      size="sm"
                      variant="flat"
                      onPress={handleEnterEditMode}
                    >
                      <Pencil className="size-4 text-blue-600" />
                    </Button>
                  )}

                  <Button
                    isIconOnly
                    className="rounded-full bg-white hover:bg-gray-100 border border-gray-200 shadow-sm"
                    size="sm"
                    variant="flat"
                    onPress={onClose}
                  >
                    <Cross className="size-4 text-gray-500 rotate-45" />
                  </Button>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-foreground leading-tight mb-2">
                {isEditing ? "Editar Reserva" : event.title}
              </h2>

              {!isEditing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                  <Calendar className="size-4" />
                  <span className="capitalize">
                    {formatDateDisplay(event.date)}
                  </span>
                </div>
              )}
            </DrawerHeader>

            <DrawerBody className="overflow-y-auto px-6 py-6">
              {/* ================= MODO EDICIÓN ================= */}
              {isEditing ? (
                <div className="flex flex-col gap-6">
                  {/* 1. Selección de Servicio */}
                  <Select
                    label="Servicio"
                    selectedKeys={[editServiceId]}
                    startContent={
                      <ChartNoAxesGantt className="size-4 text-muted-foreground" />
                    }
                    onChange={(e) => {
                      setEditServiceId(e.target.value);
                      setEditHorarioId(""); // Reset horario al cambiar servicio
                    }}
                  >
                    {servicios.map((s) => (
                      <SelectItem key={s.id} textValue={s.nombre}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </Select>

                  {/* 2. Selección de Fecha */}
                  <DatePicker
                    label="Fecha"
                    minValue={today(getLocalTimeZone())}
                    value={
                      editDate
                        ? parseDate(format(editDate, "yyyy-MM-dd"))
                        : undefined
                    }
                    onChange={(val) => {
                      if (val) {
                        setEditDate(val.toDate(getLocalTimeZone()));
                        setEditHorarioId(""); // Reset horario al cambiar fecha
                      }
                    }}
                  />

                  {/* 3. Selección de Horario */}
                  <Select
                    isDisabled={
                      !editServiceId ||
                      !editDate ||
                      horariosDisponibles.length === 0
                    }
                    label="Horario"
                    placeholder={
                      horariosDisponibles.length === 0
                        ? "Sin disponibilidad"
                        : "Seleccionar"
                    }
                    selectedKeys={editHorarioId ? [editHorarioId] : []}
                    startContent={
                      <Clock className="size-4 text-muted-foreground" />
                    }
                    onChange={(e) => setEditHorarioId(e.target.value)}
                  >
                    {horariosDisponibles.map((h) => (
                      <SelectItem
                        key={h.id}
                        textValue={h.hora_inicio.slice(0, 5)}
                      >
                        {h.hora_inicio.slice(0, 5)} hs
                      </SelectItem>
                    ))}
                  </Select>

                  {/* 4. Notas */}
                  <Input
                    label="Notas"
                    value={editNotes}
                    onValueChange={setEditNotes}
                  />

                  <div className="w-full bg-blue-50 p-4 rounded-lg text-blue-800 text-sm">
                    <p>
                      Se enviará al cliente un mensaje de WhatsApp con los
                      nuevos detalles del turno.
                    </p>
                  </div>

                  {/* Botones de Acción Edición */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      fullWidth
                      startContent={<Undo2 className="size-4" />}
                      variant="bordered"
                      onPress={() => setIsEditing(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      fullWidth
                      color="primary"
                      isDisabled={!editHorarioId}
                      isLoading={updatingStatus === "saving"}
                      startContent={<Save className="size-4" />}
                      onPress={handleSaveChanges}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                /* ================= MODO VISTA (Original) ================= */
                <div className="flex flex-col gap-8">
                  <div className="flex gap-4">
                    <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                      <Clock className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Horario
                      </span>
                      <p className="text-base font-medium">
                        {event.startTime} - {event.endTime} hs
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                      <User className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Cliente
                      </span>
                      <div className="flex flex-col gap-2">
                        {event.participants.map((name, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 bg-gray-50 p-2 rounded-md border border-gray-100"
                          >
                            <Avatar
                              className="size-6 text-[10px]"
                              color="primary"
                              getInitials={(n) => n.charAt(0)}
                              name={name}
                            />
                            <span className="text-sm font-medium">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {event.description && (
                    <div className="flex gap-4">
                      <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                        <FileText className="size-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Notas
                        </span>
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-6 border-t border-border space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">
                      Cambiar estado de la reserva
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {event.status !== "confirmado" && (
                        <Button
                          className="text-white font-medium"
                          color="success"
                          isDisabled={
                            updatingStatus !== null &&
                            updatingStatus !== "confirmado"
                          }
                          isLoading={updatingStatus === "confirmado"}
                          startContent={
                            updatingStatus !== "confirmado" && (
                              <Check className="size-4" />
                            )
                          }
                          variant="solid"
                          onPress={() => handleUpdateStatus("confirmado")}
                        >
                          Confirmar
                        </Button>
                      )}

                      {event.status !== "cancelado" && (
                        <Button
                          className="font-medium"
                          color="danger"
                          isDisabled={
                            updatingStatus !== null &&
                            updatingStatus !== "cancelado"
                          }
                          isLoading={updatingStatus === "cancelado"}
                          startContent={
                            updatingStatus !== "cancelado" && (
                              <X className="size-4" />
                            )
                          }
                          variant="flat"
                          onPress={() => handleUpdateStatus("cancelado")}
                        >
                          Cancelar
                        </Button>
                      )}

                      {(event.status === "confirmado" ||
                        event.status === "cancelado") && (
                        <Button
                          className="font-medium"
                          color="warning"
                          isDisabled={
                            updatingStatus !== null &&
                            updatingStatus !== "reservado"
                          }
                          isLoading={updatingStatus === "reservado"}
                          startContent={
                            updatingStatus !== "reservado" && (
                              <ClipboardClock className="size-4" />
                            )
                          }
                          variant="flat"
                          onPress={() => handleUpdateStatus("reservado")}
                        >
                          Pendiente
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
