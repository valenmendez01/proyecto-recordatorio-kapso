-- Tabla de Reservas
CREATE TABLE public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  reserva_fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado TEXT NOT NULL DEFAULT 'reservado' CHECK (estado IN ('reservado', 'confirmado', 'cancelado')),
  notas TEXT,
  token UUID UNIQUE DEFAULT gen_random_uuid() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para la agenda
CREATE INDEX IF NOT EXISTS idx_reservas_agenda ON public.reservas(reserva_fecha, hora_inicio);
-- Índice para búsquedas rápidas por token
CREATE INDEX IF NOT EXISTS idx_reservas_token ON public.reservas(token);

-- Habilitar RLS
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Políticas para Reservas (Solo el Admin gestiona la agenda)
CREATE POLICY "Admin ve reservas" 
  ON public.reservas FOR SELECT USING (es_admin());

CREATE POLICY "Admin crea reservas" 
  ON public.reservas FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Admin edita reservas" 
  ON public.reservas FOR UPDATE USING (es_admin());

CREATE POLICY "Admin borra reservas" 
  ON public.reservas FOR DELETE USING (es_admin());

-- HABILIAR REALTIME para la tabla de reservas
ALTER TABLE public.reservas ENABLE REPLICATION;