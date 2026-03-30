-- Tabla de Reservas
CREATE TABLE public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_reservas_agenda ON public.reservas(perfil_id, reserva_fecha, hora_inicio);
-- Índice para búsquedas rápidas por token
CREATE INDEX IF NOT EXISTS idx_reservas_token ON public.reservas(token);

-- Habilitar RLS
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Políticas para Reservas (Solo el Admin gestiona la agenda)
CREATE POLICY "Profesional gestiona su propia agenda" 
  ON public.reservas FOR ALL 
  USING (es_admin() AND auth.uid() = perfil_id)
  WITH CHECK (es_admin() AND auth.uid() = perfil_id);

-- HABILIAR REALTIME para la tabla de reservas
-- Ir al table editor y presionar el boton para habiliatarlo