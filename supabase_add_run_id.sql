-- Ejecutar en el SQL Editor de Supabase
ALTER TABLE public.extracciones_os
ADD COLUMN IF NOT EXISTS run_id text;
