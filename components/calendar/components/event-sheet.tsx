"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from "@heroui/drawer";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { DatePicker } from "@heroui/date-picker";
import { TimeInput } from "@heroui/date-input";
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

import { useCalendarStore } from "../store/calendar-store";
import { createClient } from "@/utils/supabase/client";
import { CalendarEvent } from "@/types/types";
import { Divider } from "@heroui/divider";
import { enviarNotificacionWhatsApp } from "@/app/meta-actions";

interface EventSheetProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventSheet({ event, open, onOpenChange }: EventSheetProps) {
  const supabase = createClient();
  const { fetchEvents } = useCalendarStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editHora, setEditHora] = useState<Time | null>(null);
  const [editHoraFin, setEditHoraFin] = useState<Time | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<"confirmado" | "cancelado" | "reservado" | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      alert("Por favor completa todos los campos.");

      return;
    }
    if (editHoraFin.compare(editHora) <= 0) {
      alert("La hora de fin debe ser posterior a la hora de inicio.");

      return;
    }
    setUpdating(true);
    
    const { error: updateError } = await supabase
      .from("reservas")
      .update({
        reserva_fecha: format(editDate, "yyyy-MM-dd"),
        hora_inicio: editHora.toString().slice(0, 5),
        hora_fin: editHoraFin.toString().slice(0, 5),
        notas: editNotes
      })
      .eq("id", event.id);

    if (!updateError) {
      await enviarNotificacionWhatsApp(event.id, 'actualizacion');
      await fetchEvents();
      setIsEditing(false);
    } else {
      alert("Error al guardar: " + updateError.message);
    }

    setUpdating(false);
  };

  const updateStatus = async (status: "confirmado" | "cancelado" | "reservado") => {
    if (!event) return;
    
    setStatusUpdating(status); // Marcamos específicamente este estado como "cargando"
    
    const { error } = await supabase
      .from("reservas")
      .update({ estado: status })
      .eq("id", event.id);

    if (!error) {
      await fetchEvents();
      onOpenChange(false);
    } else {
      alert("Error al actualizar: " + error.message);
    }
    
    setStatusUpdating(null); // Limpiamos el estado de carga
  };

  // Esta función se ejecutará cuando el usuario confirme DENTRO del modal
  const confirmDeleteEvent = async () => {
    if (!event) return;
    setIsDeleting(true);
    
    const { error } = await supabase
      .from("reservas")
      .delete()
      .eq("id", event.id);

    if (!error) {
      await fetchEvents(); // Recargamos el calendario
      setIsDeleteModalOpen(false); // Cerramos el modal
      onOpenChange(false); // Cerramos el Drawer principal
    } else {
      // Si quieres, luego podemos cambiar este alert por un Toast/Sonner
      alert("Error al eliminar el turno: " + error.message); 
    }
    
    setIsDeleting(false);
  };

  if (!event) return null;

  return (
    <>
      <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="sm">
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader className="px-6 py-6">
                <h2 className="text-xl font-bold">{isEditing ? "Editar Turno" : "Detalle de Reserva"}</h2>
              </DrawerHeader>

              <Divider orientation="horizontal" />

              <DrawerBody className="p-6 gap-6">
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
                  <div className="flex flex-col gap-6">
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
                      <p className="text-lg font-medium">Modificar estado manual a la reserva</p>
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
                  </div>
                )}
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <Modal isOpen={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen} size="sm" placement="center">
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