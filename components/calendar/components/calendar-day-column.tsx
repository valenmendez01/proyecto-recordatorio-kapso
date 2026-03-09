"use client";

import { useCalendarStore } from "../store/calendar-store";

import {
  HOURS_24,
  HOUR_HEIGHT,
  getEventTop,
  getEventHeight,
} from "./calendar-utils";
import { EventCard } from "./event-card";
import { CurrentTimeIndicator } from "./current-time-indicator";

import { CalendarEvent } from "@/types/types";

interface CalendarDayColumnProps {
  day: Date;
  dayIndex: number;
  events: CalendarEvent[];
  today: Date;
  isTodayInWeek: boolean;
  currentTime: Date;
  onScroll: (index: number) => (e: React.UIEvent<HTMLDivElement>) => void;
  scrollRef: (el: HTMLDivElement | null) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function CalendarDayColumn({
  day,
  dayIndex,
  events,
  today,
  isTodayInWeek,
  currentTime,
  onScroll,
  scrollRef,
  onEventClick,
}: CalendarDayColumnProps) {
  // 2. Obtener configuración de horas
  const { startHour, endHour } = useCalendarStore();

  // 3. Filtrar las líneas de la grilla (para mostrar solo el rango seleccionado)
  const visibleHours = HOURS_24.filter(
    (_, index) => index >= startHour && index <= endHour,
  );

  // 4. LÓGICA DE FILTRADO DE EVENTOS
  // Solo renderizamos eventos que se solapen con el rango visible [startHour, endHour + 1]
  const filteredEvents = events.filter((event) => {
    const [startH, startM] = event.startTime.split(":").map(Number);
    const [endH, endM] = event.endTime.split(":").map(Number);

    const eventStartVal = startH + (startM || 0) / 60;
    const eventEndVal = endH + (endM || 0) / 60;

    // Rango de vista: desde startHour hasta el final de la hora endHour
    const viewStart = startHour;
    const viewEnd = endHour + 1;

    // El evento es visible si termina DESPUÉS de que empieza la vista
    // Y empieza ANTES de que termine la vista.
    return eventEndVal > viewStart && eventStartVal < viewEnd;
  });

  return (
    <div
      ref={scrollRef}
      className="flex-1 border-r border-gray-200 last:border-r-0 relative min-w-44 overflow-y-auto"
      onScroll={onScroll(dayIndex)}
    >
      {/* Renderizar solo las horas visibles */}
      {visibleHours.map((hour) => (
        <div
          key={hour}
          className="border-b border-gray-200"
          style={{ height: `${HOUR_HEIGHT}px` }}
        />
      ))}

      <CurrentTimeIndicator
        currentTime={currentTime}
        day={day}
        isTodayInWeek={isTodayInWeek}
        today={today}
      />

      {/* Renderizar solo eventos filtrados */}
      {/* Renderizar solo eventos filtrados */}
      {filteredEvents.map((event) => {
        // 1. Cálculos originales de posición vertical
        const top = getEventTop(event.startTime, startHour);
        const height = getEventHeight(event.startTime, event.endTime);

        // 2. NUEVA LÓGICA: Calcular solapamientos (Overlaps)
        // Buscamos cuántos eventos chocan con el evento actual
        const overlappingEvents = filteredEvents.filter(
          (e) => e.startTime < event.endTime && e.endTime > event.startTime,
        );

        // Los ordenamos para que el orden visual sea siempre el mismo (izquierda a derecha)
        // Usamos ID como desempate si empiezan a la misma hora
        overlappingEvents.sort(
          (a, b) =>
            a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id),
        );

        // Calculamos la posición de ESTE evento dentro del grupo de solapados
        const index = overlappingEvents.findIndex((e) => e.id === event.id);
        const totalOverlaps = overlappingEvents.length;

        // Definimos el ancho y la posición izquierda
        const widthPercent = 100 / totalOverlaps;
        const leftPercent = index * widthPercent;

        return (
          <EventCard
            key={event.id}
            event={event}
            style={{
              top: `${top + 4}px`,
              height: `${height - 8}px`,
              // 3. Aplicamos los nuevos estilos calculados
              width: `${widthPercent}%`,
              left: `${leftPercent}%`,
              position: "absolute", // Aseguramos que sea absoluto
              zIndex: 10 + index, // Opcional: ayuda si hay bordes superpuestos
            }}
            onClick={() => onEventClick(event)}
          />
        );
      })}
    </div>
  );
}
