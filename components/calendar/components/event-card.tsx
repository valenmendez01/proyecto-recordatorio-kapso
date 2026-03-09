"use client";

import { Avatar } from "@heroui/avatar";

import { CalendarEvent } from "@/types/types"; // Usar el nuevo tipo
import clsx from "clsx";

interface EventCardProps {
  event: CalendarEvent; // Actualizar tipo
  style: React.CSSProperties;
  onClick: () => void;
  className?: string;
}

export function EventCard({
  event,
  style,
  onClick,
  className,
}: EventCardProps) {
  // Mapeo de estilos según requerimiento del usuario
  const statusStyles = {
    confirmado: {
      base: "bg-green-100 hover:bg-green-200 border-green-500",
      text: "text-green-800",
    },
    reservado: {
      // Amarillo para reservado (seña pagada)
      base: "bg-yellow-100 hover:bg-yellow-200 border-yellow-500",
      text: "text-yellow-800",
    },
    cancelado: {
      // Rojo para cancelado
      base: "bg-red-100 hover:bg-red-200 border-red-500 opacity-60",
      text: "text-red-800",
    },
  };

  // Fallback seguro por si entra un estado raro, aunque el store ya filtra
  const currentStyle = statusStyles[event.status] || statusStyles.reservado;

  return (
    <div
      className={clsx(
        "absolute left-0 right-1 rounded-md border-l-4 text-xs leading-tight cursor-pointer transition-all overflow-hidden flex flex-col z-10",
        currentStyle.base,
        className,
      )}
      role="button"
      style={style}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="sticky top-0 w-full p-2 flex flex-col max-h-full">
        <div
          className={clsx("font-semibold truncate shrink-0", currentStyle.text)}
        >
          {event.title}
        </div>
        <div
          className={clsx(
            "text-[10px] opacity-80 truncate shrink-0",
            currentStyle.text,
          )}
        >
          {event.startTime} - {event.endTime}
        </div>

        {event.description && (
          <div
            className={clsx(
              "mt-1 truncate text-[10px] opacity-70 flex-shrink min-h-0",
              currentStyle.text,
            )}
          >
            {event.description}
          </div>
        )}

        {event.participants && event.participants.length > 0 && (
          <div className="mt-auto pt-1 flex -space-x-1 overflow-hidden shrink-0">
            {event.participants.slice(0, 3).map((name, i) => (
              <Avatar
                key={i}
                className="size-4 border-2 border-background text-[8px]"
                getInitials={(n) => (n ? n.charAt(0).toUpperCase() : "?")}
                name={name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
