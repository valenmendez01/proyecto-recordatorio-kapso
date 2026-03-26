import { create } from "zustand";
import { persist } from "zustand/middleware";
import { startOfWeek, addWeeks, subWeeks, addDays } from "date-fns";

export type CalendarStatusFilter = "all" | "confirmado" | "reservado" | "cancelado";

interface CalendarState {
  currentWeekStart: Date;
  startHour: number;
  endHour: number;
  statusFilter: CalendarStatusFilter;
  // Navegación
  goToNextWeek: () => void;
  goToPreviousWeek: () => void;
  goToToday: () => void;
  goToDate: (date: Date) => void;
  // Configuración
  setStartHour: (hour: number) => void;
  setEndHour: (hour: number) => void;
  setStatusFilter: (filter: CalendarStatusFilter) => void;
  getWeekDays: () => Date[];
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      currentWeekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
      startHour: 0,
      endHour: 23,
      statusFilter: "all",

      goToNextWeek: () => set((state) => ({ currentWeekStart: addWeeks(state.currentWeekStart, 1) })),
      goToPreviousWeek: () => set((state) => ({ currentWeekStart: subWeeks(state.currentWeekStart, 1) })),
      goToToday: () => set({ currentWeekStart: startOfWeek(new Date(), { weekStartsOn: 1 }) }),
      goToDate: (date: Date) => set({ currentWeekStart: startOfWeek(date, { weekStartsOn: 1 }) }),

      setStartHour: (hour) => set({ startHour: hour }),
      setEndHour: (hour) => set({ endHour: hour }),
      setStatusFilter: (filter) => set({ statusFilter: filter }),

      getWeekDays: () => {
        const { currentWeekStart } = get();
        
        return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
      },
    }),
    {
      name: "calendar-storage",
      partialize: (state) => ({
        startHour: state.startHour,
        endHour: state.endHour,
        statusFilter: state.statusFilter,
      }),
    }
  )
);