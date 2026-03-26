"use client";

import { format, isSameDay, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@heroui/button";
import { Plus } from "lucide-react";
import useSWR from 'swr';

import { useCalendarStore } from "../store/calendar-store";
import { useIsMobile } from "../hooks/use-mobile";

import { CreateEventDialog } from "./create-event-dialog";

import { CalendarEvent } from "@/types/types";

export function CalendarHeader() {
  const isMobile = useIsMobile();
  const { currentWeekStart } = useCalendarStore(); // Obtener eventos del store

  const startDate = format(currentWeekStart, "yyyy-MM-dd");
  const endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
  
  const { data: events = [] } = useSWR<CalendarEvent[]>(['reservas-semana', startDate, endDate]);
  const eventsList = events || [];

  // Filtrar eventos de HOY
  const today = new Date();
  const todayEvents = events.filter((e) =>
    // Asegurarse de parsear correctamente la fecha string YYYY-MM-DD
    isSameDay(new Date(e.date + "T00:00:00"), today),
  );

  const confirmedCount = todayEvents.filter(
    (e) => e.status === "confirmado",
  ).length;
  const pendingCount = todayEvents.filter(
    (e) => e.status === "reservado",
  ).length;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <>
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <div className="border-b border-divider bg-transparent">
        <div className="px-3 md:px-6 py-2.5 md:py-3">
          <div className="flex items-center justify-between gap-2 md:gap-3 flex-nowrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <h1 className="text-sm md:text-base lg:text-lg font-semibold text-foreground truncate mb-0 md:mb-1">
                  Semana del{" "}
                  {format(currentWeekStart, "d 'de' MMMM 'de' yyyy", {
                    locale: es,
                  })}
                </h1>
                <p className="hidden md:block text-xs text-muted-foreground">
                  Hoy:{" "}
                  <span className="font-medium text-green-600">
                    {confirmedCount} confirmados
                  </span>
                  ,
                  <span className="font-medium text-yellow-600 ml-1">
                    {pendingCount} pendientes
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-1.5 lg:gap-2 shrink-0">
              <Button
                color="primary"
                isIconOnly={isMobile}
                radius="full"
                size={isMobile ? "sm" : "md"}
                variant="solid"
                onPress={() => setCreateDialogOpen(true)}
              >
                <Plus className="size-4" />
                <span className="hidden lg:inline">Agendar turno</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
