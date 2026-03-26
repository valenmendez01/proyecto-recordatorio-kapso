"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar1Icon,
  CheckIcon,
  CircleDot,
  Clock,
  NotepadText,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@heroui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { Calendar } from "@heroui/calendar";
import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { Divider } from "@heroui/divider";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import clsx from "clsx";

import { useIsMobile } from "../hooks/use-mobile";
import { useCalendarStore } from "../store/calendar-store";

export function CalendarControls() {
  const isMobile = useIsMobile();
  const {
    goToToday,
    goToDate,
    currentWeekStart,
    statusFilter,
    setStatusFilter,
    startHour,
    endHour,
    setStartHour,
    setEndHour,
  } = useCalendarStore();

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const weekStart = format(currentWeekStart, "MMM dd", { locale: es });
  const weekEnd = format(
    new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
    "MMM dd yyyy",
    { locale: es },
  );

  // Verificar si hay algún filtro activo
  const hasActiveFilters = statusFilter !== "all";

  const hoursOptions = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="px-2 md:px-6 py-4 border-b border-divider">
      <div className="flex items-center gap-1 md:gap-3 flex-nowrap">
        <Button
          className="h-8 px-3 shrink-0 font-semibold"
          radius="full"
          size={isMobile ? "sm" : "md"}
          variant="bordered"
          onPress={goToToday}
        >
          Hoy
        </Button>

        {/* Date Picker */}
        <Popover
          isOpen={datePickerOpen}
          placement="bottom-start"
          onOpenChange={setDatePickerOpen}
        >
          <PopoverTrigger>
            <Button
              className="h-8 px-3 gap-2 justify-start text-left font-normal shrink-0 hover:bg-default-100"
              radius="full"
              size={isMobile ? "sm" : "md"}
              variant="bordered"
            >
              <Calendar1Icon className="size-4 text-default-500" />
              <span className="text-xs capitalize">
                {weekStart} - {weekEnd}
              </span>
            </Button>
          </PopoverTrigger>

          <PopoverContent className="p-0">
            <Calendar
              value={
                currentWeekStart
                  ? parseDate(currentWeekStart.toISOString().split("T")[0])
                  : null
              }
              onChange={(date) => {
                if (date) {
                  const jsDate = date.toDate(getLocalTimeZone());

                  goToDate(jsDate);
                  setDatePickerOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>

        <div className="hidden md:block ml-auto" />

        {/* Configuración de Vista (Horas) */}
        <Popover placement="bottom-end">
          <PopoverTrigger>
            <Button className="h-8 px-3 gap-2" isIconOnly={isMobile} radius="full" size={isMobile ? "lg" : "md"} variant="bordered">
              <Settings size={16} />
              <span className="hidden sm:inline text-xs">Vista</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-4 w-72">
            <div className="space-y-4 w-full">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-default-500" />
                <h4 className="text-sm font-semibold">Rango Horario (24h)</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Inicio"
                  selectedKeys={[String(startHour)]}
                  size="sm"
                  variant="bordered"
                  onChange={(e) => {
                    const val = Number(e.target.value);

                    if (!isNaN(val) && val < endHour) setStartHour(val);
                  }}
                >
                  {hoursOptions.map((h) => (
                    <SelectItem
                      key={String(h)}
                      textValue={`${h.toString().padStart(2, "0")}:00`}
                    >
                      {h.toString().padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </Select>

                <Select
                  label="Fin"
                  selectedKeys={[String(endHour)]}
                  size="sm"
                  variant="bordered"
                  onChange={(e) => {
                    const val = Number(e.target.value);

                    if (!isNaN(val) && val > startHour) setEndHour(val);
                  }}
                >
                  {hoursOptions.map((h) => (
                    <SelectItem
                      key={String(h)}
                      textValue={`${h.toString().padStart(2, "0")}:00`}
                    >
                      {h.toString().padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Filtros de Estado */}
        <Popover
          isOpen={filterOpen}
          placement="bottom-end"
          onOpenChange={setFilterOpen}
        >
          <PopoverTrigger>
            <Button
              className={clsx(
                "h-8 px-3 gap-2",
                hasActiveFilters && "bg-default-100 border-primary",
              )}
              isIconOnly={isMobile} 
              radius="full" 
              size={isMobile ? "lg" : "md"}
              variant="bordered"
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline text-xs">Filtrar</span>
              {hasActiveFilters && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="p-4 w-[288px]">
            <div className="space-y-4 w-full">
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <NotepadText className="size-4 text-default-500" />
                  Estados de turnos
                </h4>
                <div className="flex flex-col gap-1">
                  {/* Botón: TODOS */}
                  <Button
                    className="w-full justify-between h-9 px-3"
                    size="sm"
                    variant="light"
                    onPress={() => setStatusFilter("all")}
                  >
                    <span className="text-sm">Todos</span>
                    {statusFilter === "all" && (
                      <CheckIcon className="size-4 text-primary" />
                    )}
                  </Button>

                  {/* Botón: CONFIRMADO */}
                  <Button
                    className="w-full justify-between h-9 px-3"
                    size="sm"
                    variant="light"
                    onPress={() => setStatusFilter("confirmado")}
                  >
                    <div className="flex items-center gap-2.5">
                      <CircleDot className="size-4 text-green-500" />
                      <span className="text-sm">Confirmado</span>
                    </div>
                    {statusFilter === "confirmado" && (
                      <CheckIcon className="size-4 text-primary" />
                    )}
                  </Button>

                  {/* Botón: PENDIENTE (RESERVADO) */}
                  <Button
                    className="w-full justify-between h-9 px-3"
                    size="sm"
                    variant="light"
                    onPress={() => setStatusFilter("reservado")}
                  >
                    <div className="flex items-center gap-2.5">
                      <CircleDot className="size-4 text-yellow-500" />
                      <span className="text-sm">Pendiente</span>
                    </div>
                    {statusFilter === "reservado" && (
                      <CheckIcon className="size-4 text-primary" />
                    )}
                  </Button>

                  {/* Botón: CANCELADO */}
                  <Button
                    className="w-full justify-between h-9 px-3"
                    size="sm"
                    variant="light"
                    onPress={() => setStatusFilter("cancelado")}
                  >
                    <div className="flex items-center gap-2.5">
                      <CircleDot className="size-4 text-red-500" />
                      <span className="text-sm">Cancelado</span>
                    </div>
                    {statusFilter === "cancelado" && (
                      <CheckIcon className="size-4 text-primary" />
                    )}
                  </Button>
                </div>
              </div>

              {hasActiveFilters && (
                <>
                  <Divider />
                  <Button
                    className="w-full h-9"
                    size="sm"
                    variant="bordered"
                    onPress={() => setStatusFilter("all")}
                  >
                    Quitar filtro
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
