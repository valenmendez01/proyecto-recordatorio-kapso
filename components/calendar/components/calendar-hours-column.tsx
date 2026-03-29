"use client";

import { ScrollShadow } from "@heroui/scroll-shadow";
import { useCalendarStore } from "../store/calendar-store"; // Importar store

import { HOURS_24, HOUR_HEIGHT } from "./calendar-utils";

interface CalendarHoursColumnProps {
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function CalendarHoursColumn({
  onScroll,
  scrollRef,
}: CalendarHoursColumnProps) {
  const { startHour, endHour } = useCalendarStore(); // Obtener rango

  // Filtrar las horas según la selección
  const visibleHours = HOURS_24.filter(
    (_, index) => index >= startHour && index <= endHour,
  );

  return (
    <div
      ref={scrollRef}
      className="w-[80px] md:w-[104px] border-r border-divider shrink-0 overflow-y-auto sticky left-0 z-30 bg-content1"
      onScroll={onScroll}
    >
      {visibleHours.map((hour) => (
        <div
          key={hour}
          className="border-b border-divider p-2 md:p-3 text-xs md:text-sm text-muted-foreground"
          style={{ height: `${HOUR_HEIGHT}px` }}
        >
          {hour}
        </div>
      ))}
    </div>
  );
}
