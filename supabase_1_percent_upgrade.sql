-- Ejecutar en el SQL Editor de Supabase
-- Actualización del 1% (Pro Max) - Telemetría, Secuencias y Audios

-- 1. Añadir columnas a leads_os para secuencias y audios
ALTER TABLE public.leads_os ADD COLUMN IF NOT EXISTS demo_audio_url text;
ALTER TABLE public.leads_os ADD COLUMN IF NOT EXISTS proximo_toque_fecha timestamptz;
ALTER TABLE public.leads_os ADD COLUMN IF NOT EXISTS proximo_toque_tipo text;

-- 2. Crear tabla de telemetría (Radar)
CREATE TABLE IF NOT EXISTS public.telemetria_os (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads_os(id) ON DELETE CASCADE,
  evento text NOT NULL, -- ej: 'demo_escuchada'
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS en telemetria_os
ALTER TABLE public.telemetria_os ENABLE ROW LEVEL SECURITY;

-- Permitir a roles anónimos insertar eventos (cuando el lead entra a la URL pública)
DROP POLICY IF EXISTS "Permitir inserción anónima de telemetría" ON public.telemetria_os;
CREATE POLICY "Permitir inserción anónima de telemetría" ON public.telemetria_os
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Permitir a authenticated leer telemetría
DROP POLICY IF EXISTS "Permitir lectura a authenticated de telemetría" ON public.telemetria_os;
CREATE POLICY "Permitir lectura a authenticated de telemetría" ON public.telemetria_os
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Crear Bucket de Storage para los audios
INSERT INTO storage.buckets (id, name, public) 
VALUES ('demos_audio', 'demos_audio', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas del bucket
CREATE POLICY "Public Access for demos_audio" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'demos_audio');

CREATE POLICY "Authenticated Insert for demos_audio" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'demos_audio');
