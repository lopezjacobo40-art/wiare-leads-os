-- Ejecutar en el SQL Editor de Supabase
-- Esto soluciona los errores "permission denied" y "new row violates row-level security policy"
-- al extraer leads desde el panel.

-- 1. Dar permisos a los roles anónimos y autenticados
GRANT ALL ON TABLE public.extracciones_os TO anon, authenticated;
GRANT ALL ON TABLE public.leads_os TO anon, authenticated;

-- 2. Asegurarse de que el uso de secuencias esté permitido (si aplica)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 3. Políticas RLS para extracciones_os (Permitir inserción y lectura anónima)
ALTER TABLE public.extracciones_os ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a anon en extracciones" ON public.extracciones_os;
CREATE POLICY "Permitir todo a anon en extracciones" ON public.extracciones_os
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Políticas RLS para leads_os (Permitir inserción y lectura anónima)
ALTER TABLE public.leads_os ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a anon en leads" ON public.leads_os;
CREATE POLICY "Permitir todo a anon en leads" ON public.leads_os
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
