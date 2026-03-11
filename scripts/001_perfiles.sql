-- 1. Tabla de Perfiles
CREATE TABLE public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  whatsapp_status TEXT DEFAULT 'disconnected' CHECK (whatsapp_status IN ('connected', 'disconnected')),
  whatsapp_customer_id TEXT
);

-- 2. Tabla de Pacientes (Clientes - No tienen acceso al sistema)
CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(20) UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  telefono TEXT NOT NULL CHECK (telefono ~ '^\+?[1-9]\d{1,14}$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pacientes_dni ON public.pacientes(dni);

-- Habilitamos RLS, pero NO creamos ninguna POLICY.
-- Esto bloquea todo el acceso desde el frontend (PostgREST).
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Función para verificar si eres admin
CREATE OR REPLACE FUNCTION public.es_admin()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND role = 'admin'
    );
  END;
$$;

-- Habilitar RLS
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Políticas para Pacientes (Solo el Admin hace todo)
CREATE POLICY "Admin ve pacientes" 
  ON public.pacientes FOR SELECT USING (es_admin());

CREATE POLICY "Admin crea pacientes" 
  ON public.pacientes FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Admin edita pacientes" 
  ON public.pacientes FOR UPDATE USING (es_admin());

CREATE POLICY "Admin borra pacientes" 
  ON public.pacientes FOR DELETE USING (es_admin());