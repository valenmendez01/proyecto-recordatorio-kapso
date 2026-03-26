"use client";

import { isSameDay } from "date-fns";

import { useCalendarStore } from "../store/calendar-store";

import { getCurrentTimePosition } from "./calendar-utils";

interface CurrentTimeIndicatorProps {
  day: Date;
  today: Date;
  isTodayInWeek: boolean;
  currentTime: Date;
}

export function CurrentTimeIndicator({
  day,
  today,
  isTodayInWeek,
  currentTime,
}: CurrentTimeIndicatorProps) {
  const { startHour, endHour } = useCalendarStore();

  // 1. Ahora solo ocultamos el indicador si NO estamos en la semana actual
  if (!isTodayInWeek) {
    return null;
  }

  // Comprobamos si la columna actual es el día de hoy
  const isCurrentDay = isSameDay(day, today);

  // Ocultar si la hora actual está fuera del rango visible
  const currentHour = currentTime.getHours();

  if (currentHour < startHour || currentHour > endHour) {
    return null;
  }

  const currentTimePosition = getCurrentTimePosition(currentTime, startHour);

  // 2. Renderizamos la línea lisa para hoy y la punteada tenue para los demás días
  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
      style={{
        top: `${currentTimePosition}px`,
        transform: "translateY(-50%)",
      }}
    >
      {isCurrentDay ? (
        <>
          {/* Línea azul lisa con el punto para el día actual */}
          <div className="size-2 rounded-full bg-blue-600 shrink-0 -ml-1" />
          <div className="h-0.5 bg-blue-600 flex-1" />
        </>
      ) : (
        /* Línea azul punteada y tenue para los demás días de la semana */
        <div className="border-t-2 border-dashed border-blue-600/30 flex-1" />
      )}
    </div>
  );
}