CREATE TABLE public.notificaciones_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID REFERENCES public.reservas(id) ON DELETE SET NULL,
  paciente_nombre TEXT, -- Guardamos el nombre por si se borra la reserva
  tipo TEXT NOT NULL, -- 'reserva', 'recordatorio', 'actualizacion'
  estado TEXT NOT NULL, -- 'success', 'error', 'delivered', 'read'
  mensaje_error TEXT,
  meta_message_id TEXT, -- ID que devuelve Meta para rastrear en el webhook
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Solo lectura para el admin)
ALTER TABLE public.notificaciones_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin ve logs" ON public.notificaciones_log FOR SELECT USING (es_admin());
CREATE POLICY "Service role inserta logs" ON public.notificaciones_log FOR INSERT WITH CHECK (es_admin());