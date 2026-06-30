-- Ejecutar en el SQL Editor de Supabase
ALTER TABLE public.leads_os
ADD COLUMN IF NOT EXISTS decisor_nombre text,
ADD COLUMN IF NOT EXISTS decisor_cargo text,
ADD COLUMN IF NOT EXISTS decisor_linkedin text;
