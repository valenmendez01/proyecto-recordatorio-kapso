"use client";

import { Button } from "@heroui/button";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarWeekHeaderProps {
  weekDays: Date[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

export function CalendarWeekHeader({
  weekDays,
  onPreviousWeek,
  onNextWeek,
}: CalendarWeekHeaderProps) {
  return (
    <div className="flex border-b border-gray-200 sticky top-0 z-30 bg-background w-max min-w-full">
      <div className="w-[80px] md:w-[104px] flex items-center gap-1 md:gap-2 p-1.5 md:p-2 border-r border-gray-200 shrink-0">
        <Button isIconOnly size="sm" variant="light" onPress={onPreviousWeek}>
          <ChevronLeft className="size-4 md:size-5" />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={onNextWeek}>
          <ChevronRight className="size-4 md:size-5" />
        </Button>
      </div>
      {weekDays.map((day) => (
        <div
          key={day.toISOString()}
          className="flex-1 border-r border-gray-200 last:border-r-0 p-1.5 md:p-2 min-w-44 flex items-center"
        >
          <div className="text-xs md:text-sm font-medium text-foreground">
            {format(day, "dd EEE").toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  );
}
