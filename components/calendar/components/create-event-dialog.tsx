"use client";

import { useState, useRef, useEffect } from "react";
import { I18nProvider } from "@react-aria/i18n";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { DatePicker } from "@heroui/date-picker";
import { TimeInput } from "@heroui/date-input";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { parseDate, getLocalTimeZone, today, Time } from "@internationalized/date";
import { Search, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { addToast } from "@heroui/toast";

import { useCalendarStore } from "../store/calendar-store";
import { useIsMobile } from "../hooks/use-mobile";

import { createClient } from "@/utils/supabase/client";
import { Paciente } from "@/types/types";
import { enviarNotificacionWhatsApp } from "@/app/actions/meta-actions";
import { crearReservaAction } from "@/app/actions/reservas-actions";



interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventDialog({ open, onOpenChange }: CreateEventDialogProps) {
  const supabase = createClient();
  const { goToDate, currentWeekStart } = useCalendarStore();

  // --- ESTADOS DEL FORMULARIO ---
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [horaInicio, setHoraInicio] = useState<Time | null>(new Time(9, 0));
  const [horaFin, setHoraFin] = useState<Time | null>(new Time(10, 0));
  const [pacientesSugeridos, setPacientesSugeridos] = useState<Paciente[]>([]);
  const [clienteEncontrado, setClienteEncontrado] = useState<Paciente | null>(null);
  const [notas, setNotas] = useState("");

  // --- ESTADO CONTROLADO DEL AUTOCOMPLETE ---
  const [inputValue, setInputValue] = useState("");
  // Ref para saber si onInputChange fue disparado por HeroUI tras una selección
  // (no por el usuario escribiendo). Evita limpiar clienteEncontrado en ese caso.
  const justSelectedRef = useRef(false);

  // --- ESTADOS DE UI ---
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) {
      setDate(new Date());
      setHoraInicio(new Time(9, 0));
      setHoraFin(new Time(10, 0));
      setPacientesSugeridos([]);
      setClienteEncontrado(null);
      setNotas("");
      setInputValue("");
      setMensajeError("");
    }
  }, [open]);

  const buscarPacientes = async (texto: string) => {
    if (texto.length < 2) {
      setPacientesSugeridos([]);
      return;
    }

    setIsSearchingClient(true);
    setMensajeError("");

    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .or(`dni.ilike.%${texto}%,nombre.ilike.%${texto}%,apellido.ilike.%${texto}%`)
      .limit(10);

    setIsSearchingClient(false);

    if (error) {
      setMensajeError("Error al buscar pacientes.");
    } else if (data) {
      setPacientesSugeridos(data);
    }
  };

  // HeroUI dispara onInputChange justo después de onSelectionChange al elegir un item.
  // Usamos justSelectedRef para ignorar ese disparo automático y no limpiar la selección.
  const handleInputChange = (value: string) => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;

      return;
    }
    setInputValue(value);
    setClienteEncontrado(null);
    buscarPacientes(value);
  };

  const handleSelectionChange = (key: React.Key | null) => {
    if (!key) return;
    const seleccionado = pacientesSugeridos.find(
      (p) => p.id.toString() === key.toString()
    );

    if (seleccionado) {
      justSelectedRef.current = true;
      setClienteEncontrado(seleccionado);
      setInputValue(`${seleccionado.nombre} ${seleccionado.apellido} - DNI: ${seleccionado.dni}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError("");
    setIsLoading(true);

    if (!date || !horaInicio || !horaFin || !clienteEncontrado) {
      setMensajeError("Faltan datos obligatorios.");
      setIsLoading(false);

      return;
    }

    if (horaFin.compare(horaInicio) <= 0) {
      setMensajeError("La hora de fin debe ser posterior a la de inicio.");
      setIsLoading(false);

      return;
    }

    const fechaStr = format(date, "yyyy-MM-dd");

    const result = await crearReservaAction({
      paciente_id: clienteEncontrado.id,
      reserva_fecha: fechaStr,
      hora_inicio: horaInicio.toString().slice(0, 5),
      hora_fin: horaFin.toString().slice(0, 5),
      estado: "reservado",
      notas: notas || "Sin notas",
    });

    if (result.error) {
      addToast({ title: "Error al crear el turno", description: result.error, color: "danger" });
      setIsLoading(false);

      return;
    }

    // Si llegamos aquí, la reserva se creó correctamente
    if (result.data) {
      addToast({ 
        title: "Turno agendado", 
        description: "El turno se creó correctamente.", 
        color: "primary" 
      });
      
      enviarNotificacionWhatsApp(result.data.id, 'reserva')
        .then(res => {
          if (res.error) addToast({ 
            title: "Turno creado, pero no se pudo enviar el WhatsApp", 
            description: res.error, 
            color: "warning" 
          });
        });

      if (date) goToDate(date);

      onOpenChange(false);
    }

    setIsLoading(false);
  };

  return (
    <Modal classNames={{ backdrop: "z-[250]", wrapper: "z-[300]" }} isOpen={open} placement="center" scrollBehavior="inside" size={isMobile ? "xs" : "lg"} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="md:text-xl">Nueva Reserva</ModalHeader>
            <ModalBody>
              <form className="grid gap-4" id="create-event-form" onSubmit={handleSubmit}>

                {/* 1. Buscador de Paciente — modo completamente controlado */}
                <Autocomplete
                  label="Buscar Paciente"
                  placeholder="Escribe nombre, apellido o DNI..."
                  isLoading={isSearchingClient}
                  items={pacientesSugeridos}
                  // allowsCustomValue evita que el componente limpie el campo al hacer blur.
                  // Sin esto, HeroUI revierte el input porque no tiene selectedKey que coincida.
                  allowsCustomValue
                  inputValue={inputValue}
                  onInputChange={handleInputChange}
                  onSelectionChange={handleSelectionChange}
                  startContent={<Search className="size-4 text-default-400" />}
                  listboxProps={{
                    emptyContent: isSearchingClient ? "Buscando..." : "No se encontraron pacientes.",
                  }}
                >
                  {(paciente) => (
                    <AutocompleteItem
                      key={paciente.id.toString()}
                      textValue={`${paciente.nombre} ${paciente.apellido} - ${paciente.dni}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-small font-medium">
                          {paciente.nombre} {paciente.apellido}
                        </span>
                        <span className="text-tiny text-default-400">
                          DNI: {paciente.dni}
                        </span>
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>

                {/* 2. Fecha y Hora */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <I18nProvider locale="es-AR">
                    <DatePicker
                      label="Fecha"
                      className="flex-1"
                      minValue={today(getLocalTimeZone())}
                      value={date ? parseDate(format(date, "yyyy-MM-dd")) : undefined}
                      onChange={(val) => setDate(val?.toDate(getLocalTimeZone()))}
                    />
                  </I18nProvider>
                  <div className="flex gap-2">
                    <TimeInput
                      label="Hora Inicio"
                      value={horaInicio}
                      onChange={setHoraInicio}
                      className="w-full sm:w-28"
                      hourCycle={24}
                    />
                    <TimeInput
                      label="Hora Fin"
                      value={horaFin}
                      onChange={setHoraFin}
                      className="w-full sm:w-28"
                      isInvalid={!!(horaInicio && horaFin && horaFin.compare(horaInicio) <= 0)}
                      hourCycle={24}
                    />
                  </div>
                </div>

                <Input label="Notas" value={notas} onValueChange={setNotas} />

                {mensajeError && (
                  <div className="flex items-center gap-2 text-tiny text-danger bg-danger-50 p-2 rounded-md">
                    <AlertCircle className="size-4" />
                    {mensajeError}
                  </div>
                )}
              </form>
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={onClose}>Cancelar</Button>
              <Button
                color="primary"
                type="submit"
                form="create-event-form"
                isDisabled={!clienteEncontrado}
                isLoading={isLoading}
              >
                Agendar Cita
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}