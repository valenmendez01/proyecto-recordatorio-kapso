import { Database } from "./database.types";

// --- TIPOS DE PERFILES ---
export type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
export type PerfilInsert = Database["public"]["Tables"]["perfiles"]["Insert"];
export type PerfilUpdate = Database["public"]["Tables"]["perfiles"]["Update"];

// --- TIPOS DE PACIENTES (NUEVO) ---
export type Paciente = Database["public"]["Tables"]["pacientes"]["Row"];
export type PacienteInsert = Database["public"]["Tables"]["pacientes"]["Insert"];
export type PacienteUpdate = Database["public"]["Tables"]["pacientes"]["Update"];

// --- TIPOS DE RESERVAS ---
export type Reserva = Database["public"]["Tables"]["reservas"]["Row"];
export type ReservaInsert = Database["public"]["Tables"]["reservas"]["Insert"];
export type ReservaUpdate = Database["public"]["Tables"]["reservas"]["Update"];

// --- UTILIDADES PARA FORMULARIOS ---
export type PerfilForm = Partial<Omit<Perfil, "role">>;

export type ReservaDraft = Partial<Omit<Reserva, "id" | "estado">> & {
  reserva_hora?: string;
  token?: string;
};

// --- ESTADOS Y CALENDARIO ---
export type EstadoReserva = "reservado" | "confirmado" | "cancelado";

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  participants: string[];
  status: "reservado" | "confirmado" | "cancelado";
  description?: string | null;
  token?: string;
}