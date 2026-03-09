"use client";

import { isSameDay } from "date-fns";

import { useCalendarStore } from "../store/calendar-store"; // <--- 1. Importar Store

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

  if (!isTodayInWeek || !isSameDay(day, today)) {
    return null;
  }

  // Ocultar si la hora actual está fuera del rango visible
  const currentHour = currentTime.getHours();

  if (currentHour < startHour || currentHour > endHour) {
    return null;
  }

  // Pasar startHour para calcular la posición relativa
  const currentTimePosition = getCurrentTimePosition(currentTime, startHour);

  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
      style={{
        top: `${currentTimePosition}px`,
        transform: "translateY(-50%)",
      }}
    >
      <div className="size-2 rounded-full bg-red-500 shrink-0 -ml-1" />
      <div className="h-0.5 bg-red-500 flex-1" />
    </div>
  );
}
