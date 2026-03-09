"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { useCalendarStore } from "../store/calendar-store";

import { EventSheet } from "./event-sheet";
import { CalendarWeekHeader } from "./calendar-week-header";
import { CalendarHoursColumn } from "./calendar-hours-column";
import { CalendarDayColumn } from "./calendar-day-column";
import { HOUR_HEIGHT } from "./calendar-utils";

import { CalendarEvent } from "@/types/types";

export function CalendarView() {
  const {
    goToNextWeek,
    goToPreviousWeek,
    getWeekDays,
    getCurrentWeekEvents,
    fetchEvents,
    startHour,
  } = useCalendarStore();
  const weekDays = getWeekDays();
  const events = getCurrentWeekEvents();
  const hoursScrollRef = useRef<HTMLDivElement>(null);
  const daysScrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasScrolledRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const today = new Date();

  // Reloj
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Agrupar eventos por día
  const eventsByDay: Record<string, CalendarEvent[]> = {};

  weekDays.forEach((day) => {
    const dayStr = format(day, "yyyy-MM-dd");

    eventsByDay[dayStr] = events.filter((e) => e.date === dayStr);
  });

  // Cargar eventos al montar o cambiar semana
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const isTodayInWeek = weekDays.some(
    (day) => format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"),
  );

  // Scroll inteligente
  useEffect(() => {
    const scrollToInitial = () => {
      if (!hasScrolledRef.current && hoursScrollRef.current) {
        const targetHour = 9;
        // startHour viene del store (configuración del usuario)
        const scrollHour = Math.max(0, targetHour - startHour);
        const scrollPixel = scrollHour * HOUR_HEIGHT;

        hoursScrollRef.current.scrollTop = scrollPixel;
        daysScrollRefs.current.forEach((ref) => {
          if (ref) {
            ref.scrollTop = scrollPixel;
          }
        });
        hasScrolledRef.current = true;
      }
    };

    scrollToInitial();
    const timeoutId = setTimeout(scrollToInitial, 100);

    return () => clearTimeout(timeoutId);
  }, [weekDays, startHour]);

  const handleHoursScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;

    daysScrollRefs.current.forEach((ref) => {
      if (ref) {
        ref.scrollTop = scrollTop;
      }
    });
  };

  const handleDayScroll =
    (index: number) => (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;

      if (hoursScrollRef.current) {
        hoursScrollRef.current.scrollTop = scrollTop;
      }
      daysScrollRefs.current.forEach((ref, idx) => {
        if (ref && idx !== index) {
          ref.scrollTop = scrollTop;
        }
      });
    };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  };

  return (
    <>
      <EventSheet
        event={selectedEvent}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
      <div className="flex flex-col h-full overflow-x-auto w-full">
        <CalendarWeekHeader
          weekDays={weekDays}
          onNextWeek={goToNextWeek}
          onPreviousWeek={goToPreviousWeek}
        />

        <div className="flex min-w-full w-max">
          <CalendarHoursColumn
            scrollRef={hoursScrollRef}
            onScroll={handleHoursScroll}
          />

          {weekDays.map((day, dayIndex) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay[dayStr] || [];

            return (
              <CalendarDayColumn
                key={day.toISOString()}
                currentTime={currentTime}
                day={day}
                dayIndex={dayIndex}
                events={dayEvents}
                isTodayInWeek={isTodayInWeek}
                scrollRef={(el) => {
                  daysScrollRefs.current[dayIndex] = el;
                }}
                today={today}
                onEventClick={handleEventClick}
                onScroll={handleDayScroll}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
