-- Ejecutar en el SQL Editor de Supabase
-- Crea la tabla de historial de demostraciones de audio para Leads OS

CREATE TABLE IF NOT EXISTS public.lead_audio_demos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads_os(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  script jsonb NOT NULL, -- Almacena el array de diálogos [{"speaker": "...", "text": "..."}]
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lead_audio_demos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Allow public read of lead_audio_demos" ON public.lead_audio_demos;
CREATE POLICY "Allow public read of lead_audio_demos" ON public.lead_audio_demos 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert of lead_audio_demos" ON public.lead_audio_demos;
CREATE POLICY "Allow anon insert of lead_audio_demos" ON public.lead_audio_demos 
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete of lead_audio_demos" ON public.lead_audio_demos;
CREATE POLICY "Allow anon delete of lead_audio_demos" ON public.lead_audio_demos 
  FOR DELETE TO anon, authenticated USING (true);
