"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { format, endOfWeek } from "date-fns";
import useSWR from 'swr';
import { createClient } from "@/utils/supabase/client";

import { useCalendarStore } from "../store/calendar-store";
import { EventSheet } from "./event-sheet";
import { CalendarWeekHeader } from "./calendar-week-header";
import { CalendarHoursColumn } from "./calendar-hours-column";
import { CalendarDayColumn } from "./calendar-day-column";
import { HOUR_HEIGHT } from "./calendar-utils";
import { CalendarEvent } from "@/types/types";

const supabase = createClient();

export function CalendarView() {
  const { 
    goToNextWeek, goToPreviousWeek, getWeekDays, 
    currentWeekStart, statusFilter, startHour 
  } = useCalendarStore();

  const weekDays = getWeekDays();
  const hoursScrollRef = useRef<HTMLDivElement>(null);
  const daysScrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasScrolledRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 1. Configuración de SWR para Caching
  const startDate = format(currentWeekStart, "yyyy-MM-dd");
  const endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: events, isLoading, mutate } = useSWR<CalendarEvent[]>(
    ['reservas-semana', startDate, endDate],
    async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select(`id, reserva_fecha, hora_inicio, hora_fin, estado, notas, paciente:pacientes(nombre, apellido)`)
        .gte("reserva_fecha", startDate)
        .lte("reserva_fecha", endDate)
        .in("estado", ["reservado", "confirmado", "cancelado"]);

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        title: `${r.paciente.nombre} ${r.paciente.apellido}`,
        startTime: r.hora_inicio.slice(0, 5),
        endTime: r.hora_fin.slice(0, 5),
        date: r.reserva_fecha,
        participants: [`${r.paciente.nombre} ${r.paciente.apellido}`],
        status: r.estado,
        description: r.notas,
      }));
    },
    { keepPreviousData: true } // Muestra la semana anterior mientras carga la nueva
  );

  // 2. Suscripción a Realtime
  useEffect(() => {
    const channel = supabase
      .channel('cambios-reservas-calendario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        // Al detectar un cambio en la base de datos, revalidamos la caché de SWR
        mutate();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mutate]);

  // 3. Filtrado local de eventos
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return statusFilter === "all" ? events : events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter]);

  // Agrupar por día para el renderizado
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    weekDays.forEach((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      grouped[dayStr] = filteredEvents.filter((e) => e.date === dayStr);
    });
    return grouped;
  }, [weekDays, filteredEvents]);

  // --- Lógica de UI (Reloj y Scroll se mantienen igual) ---
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const scrollToInitial = () => {
      if (!hasScrolledRef.current && hoursScrollRef.current) {
        const scrollPixel = Math.max(0, 9 - startHour) * HOUR_HEIGHT;
        hoursScrollRef.current.scrollTop = scrollPixel;
        daysScrollRefs.current.forEach(ref => { if (ref) ref.scrollTop = scrollPixel; });
        hasScrolledRef.current = true;
      }
    };
    scrollToInitial();
  }, [currentWeekStart, startHour]);

  const handleHoursScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    daysScrollRefs.current.forEach(ref => { if (ref) ref.scrollTop = scrollTop; });
  };

  const handleDayScroll = (index: number) => (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (hoursScrollRef.current) hoursScrollRef.current.scrollTop = scrollTop;
    daysScrollRefs.current.forEach((ref, idx) => { if (ref && idx !== index) ref.scrollTop = scrollTop; });
  };

  return (
    <>
      <EventSheet event={selectedEvent} open={sheetOpen} onOpenChange={setSheetOpen} />
      <div className="flex flex-col h-full overflow-x-auto w-full">
        <CalendarWeekHeader weekDays={weekDays} onNextWeek={goToNextWeek} onPreviousWeek={goToPreviousWeek} />
        <div className="flex min-w-full w-max">
          <CalendarHoursColumn scrollRef={hoursScrollRef} onScroll={handleHoursScroll} />
          {weekDays.map((day, dayIndex) => (
            <CalendarDayColumn
              key={day.toISOString()}
              currentTime={currentTime}
              day={day}
              dayIndex={dayIndex}
              events={eventsByDay[format(day, "yyyy-MM-dd")] || []}
              isTodayInWeek={weekDays.some(d => format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"))}
              scrollRef={(el) => { daysScrollRefs.current[dayIndex] = el; }}
              today={new Date()}
              onEventClick={(ev) => { setSelectedEvent(ev); setSheetOpen(true); }}
              onScroll={handleDayScroll}
            />
          ))}
        </div>
      </div>
    </>
  );
}