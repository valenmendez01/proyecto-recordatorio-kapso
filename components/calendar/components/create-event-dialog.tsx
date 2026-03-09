"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { DatePicker } from "@heroui/date-picker";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { parseDate, getLocalTimeZone, today } from "@internationalized/date";
import {
  Clock,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  ChartNoAxesGantt,
} from "lucide-react";

import { useCalendarStore } from "../store/calendar-store";

import { createClient } from "@/utils/supabase/server";
import { Perfil } from "@/types/types";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventDialog({
  open,
  onOpenChange,
}: CreateEventDialogProps) {
  const supabase = createClient();
  const { goToDate, fetchEvents } = useCalendarStore();

  // --- ESTADOS DE DATOS ---
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [horariosDisponibles, setHorariosDisponibles] = useState<
    Array<{ id: string; hora_inicio: string }>
  >([]);

  // --- ESTADOS DEL FORMULARIO ---
  const [servicioId, setServicioId] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [horarioId, setHorarioId] = useState("");
  const [dniCliente, setDniCliente] = useState("");
  const [clienteEncontrado, setClienteEncontrado] = useState<Perfil | null>(
    null,
  );
  const [notas, setNotas] = useState("");

  // --- ESTADOS DE UI ---
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [mensajeError, setMensajeError] = useState("");

  // 1. Cargar Servicios al montar
  useEffect(() => {
    const cargarServicios = async () => {
      const { data } = await supabase
        .from("servicios")
        .select("*")
        .eq("esta_activo", true)
        .order("nombre");

      if (data) setServicios(data);
    };

    if (open) cargarServicios();
  }, [open]);

  // 2. Cargar Horarios cuando cambia Fecha o Servicio
  useEffect(() => {
    const cargarHorarios = async () => {
      setHorariosDisponibles([]);
      setHorarioId(""); // Resetear selección

      if (!servicioId || !date) return;

      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = date.getDay(); // 0 Domingo, 1 Lunes...

      // Obtener horarios base del servicio para ese día
      const { data: slotsBase } = await supabase
        .from("horarios_servicio")
        .select("id, hora_inicio")
        .eq("servicio_id", servicioId)
        .eq("dia_semana", dayOfWeek)
        .eq("esta_activo", true)
        .order("hora_inicio");

      if (!slotsBase || slotsBase.length === 0) return;

      // Obtener ocupados (reservas existentes o bloqueos)
      // Nota: Para una implementación admin robusta, idealmente reutilizar la lógica completa de disponibilidad
      // Aquí hacemos una verificación rápida de reservas existentes para no duplicar.
      const { data: ocupados } = await supabase
        .from("reservas")
        .select("horario_servicio_id")
        .eq("reserva_fecha", dateStr)
        .in("estado", ["reservado", "confirmado", "bloqueado"]);

      const idsOcupados = ocupados?.map((o) => o.horario_servicio_id) || [];

      const disponibles = slotsBase.filter(
        (slot) => !idsOcupados.includes(slot.id),
      );

      setHorariosDisponibles(disponibles);
    };

    cargarHorarios();
  }, [servicioId, date]);

  // 3. Buscar Cliente por DNI
  const buscarCliente = async () => {
    if (!dniCliente) return;
    setIsSearchingClient(true);
    setClienteEncontrado(null);
    setMensajeError("");

    const { data, error } = await supabase
      .from("perfiles")
      .select("*")
      .eq("dni", dniCliente)
      .single();

    setIsSearchingClient(false);

    if (error || !data) {
      setMensajeError("Cliente no encontrado. Debe registrarse primero.");
    } else {
      setClienteEncontrado(data);
    }
  };

  // 4. GUARDAR RESERVA (La lógica Admin solicitada)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError("");
    setIsLoading(true);

    if (!servicioId || !date || !horarioId || !clienteEncontrado) {
      setMensajeError("Faltan datos obligatorios.");
      setIsLoading(false);

      return;
    }

    const fechaStr = format(date, "yyyy-MM-dd");

    // Insertar directamente la reserva
    const { error } = await supabase.from("reservas").insert({
      user_id: clienteEncontrado.id,
      servicio_id: servicioId,
      horario_servicio_id: horarioId,
      reserva_fecha: fechaStr,
      estado: "reservado",
      sena_pagada: true,
      monto_sena: 0,
      notas: notas
        ? `[Admin Manual]: ${notas}`
        : `[Admin Manual] Reserva creada manualmente.`,
      bloqueado_hasta: null,
    });

    if (error) {
      setMensajeError("Error al crear la reserva: " + error.message);
      setIsLoading(false);

      return;
    }

    // ============================================================
    // NUEVO CÓDIGO: Enviar WhatsApp de confirmación
    // ============================================================
    if (clienteEncontrado.telefono) {
      try {
        // 1. Recuperar la hora del array de horarios disponibles que ya tenemos en memoria
        const horarioSeleccionado = horariosDisponibles.find(
          (h) => h.id === horarioId,
        );
        const horaTexto = horarioSeleccionado
          ? horarioSeleccionado.hora_inicio.slice(0, 5)
          : "00:00";

        // 2. Formatear fecha y nombre
        const fechaTexto = format(date, "EEEE, d 'de' MMMM", { locale: es });
        const nombreCompleto =
          `${clienteEncontrado.nombre} ${clienteEncontrado.apellido}`.trim();

        // 3. Enviar a la API (usando parameterInfo como aprendimos)
        await fetch("/api/whatsapp/templates/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: clienteEncontrado.telefono,
            templateName: "confirmacion", // Asegúrate que este sea el nombre en Meta
            languageCode: "es_AR",
            parameters: [nombreCompleto, fechaTexto, horaTexto],
            parameterInfo: {
              parameters: [
                { name: "nombre", component: "BODY" },
                { name: "fecha", component: "BODY" },
                { name: "hora", component: "BODY" },
              ],
            },
          }),
        });
      } catch {
        alert("Error al enviar WhatsApp manual:");
      }
    }
    // ============================================================

    // Éxito
    await fetchEvents(); // Recargar calendario
    if (date) goToDate(date); // Ir a la fecha
    resetForm();
    onOpenChange(false);
    setIsLoading(false);
  };

  const resetForm = () => {
    setServicioId("");
    setDate(new Date());
    setHorarioId("");
    setDniCliente("");
    setClienteEncontrado(null);
    setNotas("");
    setMensajeError("");
  };

  return (
    <Modal
      isOpen={open}
      placement="center"
      size="md"
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Nueva Reserva Manual
              <span className="text-sm font-normal text-muted-foreground">
                Agendar turno (Admin - Seña considerada pagada)
              </span>
            </ModalHeader>

            <ModalBody>
              <form
                className="grid gap-4"
                id="create-event-form"
                onSubmit={handleSubmit}
              >
                {/* 1. Selección de Servicio */}
                <Select
                  isRequired
                  label="Servicio"
                  placeholder="Selecciona un servicio"
                  selectedKeys={servicioId ? [servicioId] : []}
                  startContent={
                    <ChartNoAxesGantt className="text-muted-foreground size-4" />
                  }
                  onChange={(e) => setServicioId(e.target.value)}
                >
                  {servicios.map((s) => (
                    <SelectItem key={s.id} textValue={s.nombre}>
                      {s.nombre} (${s.precio})
                    </SelectItem>
                  ))}
                </Select>

                {/* 2. Fecha */}
                <DatePicker
                  isRequired
                  label="Fecha"
                  minValue={today(getLocalTimeZone())}
                  value={
                    date ? parseDate(format(date, "yyyy-MM-dd")) : undefined
                  }
                  onChange={(calendarDate) => {
                    if (calendarDate) {
                      setDate(calendarDate.toDate(getLocalTimeZone()));
                    } else {
                      setDate(undefined);
                    }
                  }}
                />

                {/* 3. Horario (Depende de Servicio y Fecha) */}
                <Select
                  isRequired
                  isDisabled={horariosDisponibles.length === 0}
                  label="Horario Disponible"
                  placeholder={
                    !servicioId
                      ? "Primero selecciona un servicio"
                      : horariosDisponibles.length === 0
                        ? "No hay horarios disponibles"
                        : "Selecciona una hora"
                  }
                  selectedKeys={horarioId ? [horarioId] : []}
                  startContent={
                    <Clock className="text-muted-foreground size-4" />
                  }
                  onChange={(e) => setHorarioId(e.target.value)}
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

                {/* 4. Buscador de Cliente */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <Input
                      label="Cliente (DNI)"
                      placeholder="Ingrese DNI"
                      startContent={
                        <User className="text-muted-foreground size-4" />
                      }
                      value={dniCliente}
                      onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                      onValueChange={(val) => {
                        setDniCliente(val);
                        setClienteEncontrado(null); // Reset al escribir
                      }}
                    />
                    <Button
                      isIconOnly
                      color="primary"
                      isLoading={isSearchingClient}
                      variant="flat"
                      onPress={buscarCliente}
                    >
                      <Search className="size-4" />
                    </Button>
                  </div>

                  {/* Feedback Cliente */}
                  {clienteEncontrado && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-md border border-green-200">
                      <CheckCircle2 className="size-4" />
                      <span className="font-medium">
                        {clienteEncontrado.nombre} {clienteEncontrado.apellido}
                      </span>
                    </div>
                  )}
                </div>

                {/* 5. Notas */}
                <Input
                  label="Notas internas"
                  placeholder="Detalles adicionales..."
                  value={notas}
                  onValueChange={setNotas}
                />

                {/* Mensaje de Error General */}
                {mensajeError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                    <AlertCircle className="size-4" />
                    {mensajeError}
                  </div>
                )}
              </form>
            </ModalBody>

            <ModalFooter>
              <Button variant="bordered" onPress={() => onClose()}>
                Cancelar
              </Button>
              <Button
                color="primary"
                form="create-event-form"
                isDisabled={!clienteEncontrado || !horarioId}
                isLoading={isLoading}
                type="submit"
              >
                Confirmar Reserva
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
