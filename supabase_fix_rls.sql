-- =====================================================================
-- FIX: Habilitar permisos de lectura en extracciones_os para anon key
-- Ejecutar en Supabase → SQL Editor
-- =====================================================================

-- 1. Habilitar RLS en la tabla (puede que ya esté habilitado)
ALTER TABLE public.extracciones_os ENABLE ROW LEVEL SECURITY;

-- 2. Policy de SELECT (lectura) para todos (anon + authenticated)
CREATE POLICY "Lectura pública extracciones"
ON public.extracciones_os
FOR SELECT
USING (true);

-- 3. Policy de INSERT para todos (necesario para guardar extracciones)
CREATE POLICY "Insertar extracciones"
ON public.extracciones_os
FOR INSERT
WITH CHECK (true);

-- 4. Policy de UPDATE para todos (opcional, por si se actualiza estado)
CREATE POLICY "Actualizar extracciones"
ON public.extracciones_os
FOR UPDATE
USING (true);

-- 5. Policy de DELETE para todos (borrar extracciones vacías)
CREATE POLICY "Borrar extracciones"
ON public.extracciones_os
FOR DELETE
USING (true);

-- =====================================================================
-- VERIFICAR: estas tablas también deben tener sus policies activas
-- =====================================================================

-- token_usage_os (para rate limiting de Claude/Gemini)
ALTER TABLE public.token_usage_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura token usage" ON public.token_usage_os FOR SELECT USING (true);
CREATE POLICY "Insertar token usage" ON public.token_usage_os FOR INSERT WITH CHECK (true);

-- quiz_leads_descartados (para el descarte de leads web)
ALTER TABLE public.quiz_leads_descartados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura descartados" ON public.quiz_leads_descartados FOR SELECT USING (true);
CREATE POLICY "Insertar descartados" ON public.quiz_leads_descartados FOR INSERT WITH CHECK (true);
CREATE POLICY "Upsert descartados" ON public.quiz_leads_descartados FOR UPDATE USING (true);
