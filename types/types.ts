import { Database } from "./database.types";

export type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
export type PerfilInsert = Database["public"]["Tables"]["perfiles"]["Insert"];
export type PerfilUpdate = Database["public"]["Tables"]["perfiles"]["Update"];

export type Reserva = Database["public"]["Tables"]["reservas"]["Row"];
export type ReservaInsert = Database["public"]["Tables"]["reservas"]["Insert"];
export type ReservaUpdate = Database["public"]["Tables"]["reservas"]["Update"];

export type PerfilForm = Partial<Omit<Perfil, "role">>;

export type ReservaDraft = Partial<Omit<Reserva, "id" | "estado">> & {
  reserva_hora?: string; // Solo para mostrar en UI, no se guarda en DB
};

// ============================================================================
// TIPOS PARA ESTADOS DE RESERVA
// ============================================================================

export type EstadoReserva =
  | "reservado"
  | "confirmado"
  | "cancelado";

// ============================================================================
// TIPO PARA EL CALENDARIO
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  participants: string[];
  status: "reservado" | "confirmado" | "cancelado"; // Solo los visibles
  description?: string | null;
}