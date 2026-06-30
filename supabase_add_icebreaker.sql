-- Ejecutar en el SQL Editor de Supabase
ALTER TABLE public.leads_os
ADD COLUMN IF NOT EXISTS icebreaker text;
