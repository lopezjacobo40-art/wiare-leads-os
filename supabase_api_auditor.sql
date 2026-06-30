-- Migration: API Auditor
-- Description: Creates a table to track API failures and timeouts for the Auditor Agent.

CREATE TABLE IF NOT EXISTS public.api_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    servicio TEXT NOT NULL,
    endpoint TEXT,
    metodo TEXT,
    error_msg TEXT,
    status_code INTEGER,
    payload TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.api_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas (Lectura / Inserción pública o logueada dependiendo del caso, 
-- pero como el dashboard lo verá el admin, permitimos inserción anónima y lectura autenticada)
CREATE POLICY "Permitir inserción de logs" ON public.api_audit_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir lectura de logs" ON public.api_audit_logs
    FOR SELECT USING (true);

-- Notificaciones Realtime para el Dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_audit_logs;
