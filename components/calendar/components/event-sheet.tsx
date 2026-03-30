"use client";

import { useState } from "react";
import { format, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from "@heroui/drawer";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { DatePicker } from "@heroui/date-picker";
import { TimeInput } from "@heroui/date-input";
import { addToast } from "@heroui/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Time } from "@internationalized/date";
import { parseDate, getLocalTimeZone } from "@internationalized/date";
import { Clock, User, FileText, Pencil, Trash2 } from "lucide-react";
import { useSWRConfig } from 'swr';
import { Divider } from "@heroui/divider";

import { useCalendarStore } from "../store/calendar-store";

import { createClient } from "@/utils/supabase/client";
import { CalendarEvent } from "@/types/types";
import { enviarNotificacionWhatsApp } from "@/app/actions/meta-actions";
import { actualizarReservaAction, eliminarReservaAction } from "@/app/actions/reservas-actions";

interface EventSheetProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventSheet({ event, open, onOpenChange }: EventSheetProps) {
  const supabase = createClient();
  const { mutate } = useSWRConfig();
  const { currentWeekStart } = useCalendarStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editHora, setEditHora] = useState<Time | null>(null);
  const [editHoraFin, setEditHoraFin] = useState<Time | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<"confirmado" | "cancelado" | "reservado" | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Al entrar en modo edición, cargamos los valores actuales
  const handleEnterEdit = () => {
    if (!event) return;
    const [y, m, d] = event.date.split("-").map(Number);

    setEditDate(new Date(y, m - 1, d));
    
    // Parsea la hora de inicio
    const [hStart, mStart] = event.startTime.split(":").map(Number);

    setEditHora(new Time(hStart, mStart));

    // Parsea la hora de fin
    const [hEnd, mEnd] = event.endTime.split(":").map(Number);
    
    setEditHoraFin(new Time(hEnd, mEnd));

    setEditNotes(event.description || "");
    setIsEditing(true);
  };

  const handleSaveChanges = async () => {
    if (!event || !editDate || !editHora || !editHoraFin) {
      addToast({ title: "Faltan datos", description: "Por favor completa todos los campos", color: "warning" });

      return;
    }
    
    if (editHoraFin.compare(editHora) <= 0) {
      addToast({ title: "Horario inválido", description: "La hora de fin debe ser posterior a la de inicio", color: "danger" });
      
      return;
    }

    setUpdating(true);
    
    // 1. Preparamos los nuevos valores formateados para comparar
    const nuevaFecha = format(editDate, "yyyy-MM-dd");
    const nuevaHoraInicio = editHora.toString().slice(0, 5);
    const nuevaHoraFin = editHoraFin.toString().slice(0, 5);

    // 2. Verificamos si hubo cambios reales en fecha u hora
    const huboCambioHorario = 
      nuevaFecha !== event.date || 
      nuevaHoraInicio !== event.startTime || 
      nuevaHoraFin !== event.endTime;

    const result = await actualizarReservaAction(event.id, {
      reserva_fecha: nuevaFecha,
      hora_inicio: nuevaHoraInicio,
      hora_fin: nuevaHoraFin,
      notas: editNotes
    });

    if (result.success) {
      // 3. Solo enviamos el WhatsApp si cambió el horario/fecha
      if (huboCambioHorario) {
        await enviarNotificacionWhatsApp(event.id, 'actualizacion');
      }

      addToast({ 
        title: "Turno actualizado", 
        description: "Los cambios se guardaron correctamente.", 
        color: "primary" 
      });

      // No llamar a mutate acá. Realtime ya va a actualizar el cache.
      setIsEditing(false);
    } else {
      addToast({ title: "Error al actualizar", description: result.error, color: "danger" });
    }

    setUpdating(false);
  };

  const updateStatus = async (status: "confirmado" | "cancelado" | "reservado") => {
    if (!event) return;
    
    setStatusUpdating(status); // Marcamos específicamente este estado como "cargando"
    
    const result = await actualizarReservaAction(event.id, { estado: status });

    if (result.success) {
      const startDate = format(currentWeekStart, "yyyy-MM-dd");
      const endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

      addToast({ 
        title: "Estado actualizado", 
        description: `El turno ahora está ${status}.`, 
        color: "primary" 
      });

      await mutate(['reservas-semana', startDate, endDate]);
      onOpenChange(false);
    } else {
      addToast({ title: "Error", description: result.error || "No se pudo cambiar el estado.", color: "danger" });
    }
    
    setStatusUpdating(null); // Limpiamos el estado de carga
  };

  // Esta función se ejecutará cuando el usuario confirme DENTRO del modal
  const confirmDeleteEvent = async () => {
    if (!event) return;
    setIsDeleting(true);
    
    const result = await eliminarReservaAction(event.id);

    if (result.success) {
      const startDate = format(currentWeekStart, "yyyy-MM-dd");
      const endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

      addToast({ 
        title: "Turno eliminado", 
        description: "La reserva ha sido quitada del calendario.", 
        color: "primary" 
      });

      await mutate(['reservas-semana', startDate, endDate]);
      setIsDeleteModalOpen(false); // ← cierra el modal de confirmación
      onOpenChange(false);         // ← cierra el drawer
    } else {
      addToast({ title: "Error al eliminar", description: result.error, color: "danger" }); 
    }
    
    setIsDeleting(false);
  };

  const handleManualReminder = async () => {
    if (!event) return;
    setSendingReminder(true);
    
    const result = await enviarNotificacionWhatsApp(event.id, 'recordatorio');
    
    if (result.success) {
      addToast({ 
        title: "¡Enviado!", 
        description: "El recordatorio de WhatsApp se envió correctamente.", 
        color: "primary" 
      });
    } else {
      addToast({ 
        title: "Error de envío", 
        description: result.error, 
        color: "danger" 
      });
    }
    setSendingReminder(false);
  };

  if (!event) return null;

  return (
    <>
      <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="sm" classNames={{ backdrop: "z-[150]", wrapper: "z-[200]", base: "z-[200]" }}>
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader className="px-6 py-6">
                <h2 className="text-xl font-bold">{isEditing ? "Editar Turno" : "Detalle del Turno"}</h2>
              </DrawerHeader>

              <Divider orientation="horizontal" />

              <DrawerBody className="p-6 gap-3">
                {isEditing ? (
                  <div className="flex flex-col gap-4">
                    <DatePicker
                      label="Fecha"
                      value={editDate ? parseDate(format(editDate, "yyyy-MM-dd")) : undefined}
                      onChange={(val) => setEditDate(val?.toDate(getLocalTimeZone()))}
                    />
                    <TimeInput 
                      label="Hora Inicio" 
                      value={editHora} 
                      onChange={setEditHora} 
                      className="flex-1"
                      hourCycle={24}
                    />
                    <TimeInput 
                      label="Hora Fin" 
                      value={editHoraFin} 
                      onChange={setEditHoraFin} 
                      className="flex-1"
                      isInvalid={!!(editHora && editHoraFin && editHoraFin.compare(editHora) <= 0)}
                      errorMessage="Debe ser mayor"
                      hourCycle={24}
                    />
                    <Input label="Notas" value={editNotes} onValueChange={setEditNotes} />
                    <div className="flex gap-2 pt-4">
                      <Button fullWidth variant="bordered" onPress={() => setIsEditing(false)}>Cancelar</Button>
                      <Button fullWidth color="primary" isLoading={updating} onPress={handleSaveChanges}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5 md:gap-6">
                    <div className="flex items-start gap-4">
                      <User className="size-5 mt-1 text-primary" />
                      <div>
                        <p className="text-xs text-default-500 uppercase font-bold">Paciente</p>
                        <p className="text-lg font-medium">{event.participants[0]}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Clock className="size-5 mt-1 text-primary" />
                      <div>
                        <p className="text-xs text-default-500 uppercase font-bold">Fecha y Hora</p>
                        <p className="text-base">
                          {format(new Date(event.date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                        <p className="text-base font-bold">{event.startTime} hs a {event.endTime} hs</p>
                      </div>
                    </div>
                    {event.description && (
                      <div className="flex items-start gap-4">
                        <FileText className="size-5 mt-1 text-primary" />
                        <div>
                          <p className="text-xs text-default-500 uppercase font-bold">Notas</p>
                          <p className="text-sm p-3 italic">{event.description}</p>
                        </div>
                      </div>
                    )}
                    {!isEditing && (
                      <div className="flex flex-col gap-2">
                        <Button size="sm" color="primary" variant="flat" onPress={handleEnterEdit}>
                          <Pencil className="size-4" /> Modificar Turno
                        </Button>
                        <Button 
                          size="sm" 
                          color="danger" 
                          variant="flat" 
                          onPress={() => setIsDeleteModalOpen(true)} 
                        >
                          <Trash2 className="size-4" /> Eliminar turno
                        </Button>
                      </div>
                    )}

                    <Divider orientation="horizontal" />
                    <div className="flex flex-col gap-5">
                      <p className="text-lg font-medium">Modificar estado manualmente</p>
                      <div className="mt-auto grid grid-cols-2 gap-2">
                        {event.status === "confirmado" && (
                          <>
                            <Button 
                              color="warning" 
                              variant="flat" 
                              isLoading={statusUpdating === "reservado"} 
                              onPress={() => updateStatus("reservado")}
                            >
                              Pendiente
                            </Button>
                            <Button 
                              color="danger" 
                              variant="flat" 
                              isLoading={statusUpdating === "cancelado"} 
                              onPress={() => updateStatus("cancelado")}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}

                        {event.status === "cancelado" && (
                          <>
                            <Button 
                              color="warning" 
                              variant="flat" 
                              isLoading={statusUpdating === "reservado"} 
                              onPress={() => updateStatus("reservado")}
                            >
                              Pendiente
                            </Button>
                            <Button 
                              color="success" 
                              variant="flat" 
                              isLoading={statusUpdating === "confirmado"} 
                              onPress={() => updateStatus("confirmado")}
                            >
                              Confirmar
                            </Button>
                          </>
                        )}

                        {event.status === "reservado" && (
                          <>
                            <Button 
                              color="success" 
                              variant="flat" 
                              isLoading={statusUpdating === "confirmado"} 
                              onPress={() => updateStatus("confirmado")}
                            >
                              Confirmar
                            </Button>
                            <Button 
                              color="danger" 
                              variant="flat" 
                              isLoading={statusUpdating === "cancelado"} 
                              onPress={() => updateStatus("cancelado")}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {event.status === "reservado" && (
                      <>
                        <Divider orientation="horizontal" />
                        <div className="flex flex-col gap-3">
                          <p className="text-lg font-medium">Enviar recordatorio manual</p>
                          <Button 
                            color="primary" 
                            variant="solid" 
                            fullWidth
                            isLoading={sendingReminder}
                            onPress={handleManualReminder}
                          >
                            Enviar WhatsApp
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <Modal classNames={{ backdrop: "z-[250]", wrapper: "z-[300]" }} isOpen={isDeleteModalOpen} placement="center" size="sm" onOpenChange={setIsDeleteModalOpen}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Confirmar eliminación</ModalHeader>
              <ModalBody>
                <p className="text-sm">¿Estás seguro de que deseas eliminar este turno?</p>
                <p className="text-xs text-default-500">
                  Esta acción no se puede deshacer y el horario quedará disponible en el calendario.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onClose} isDisabled={isDeleting}>
                  Cancelar
                </Button>
                <Button color="danger" onPress={confirmDeleteEvent} isLoading={isDeleting}>
                  Sí, eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}