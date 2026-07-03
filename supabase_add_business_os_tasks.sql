-- Ejecutar en el SQL Editor de Supabase
-- Crea la tabla de control de tareas de entrega para cada cliente de WIARE

CREATE TABLE IF NOT EXISTS public.lead_tasks_os (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads_os(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  completada boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lead_tasks_os ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Allow public read of tasks" ON public.lead_tasks_os;
CREATE POLICY "Allow public read of tasks" ON public.lead_tasks_os 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write of tasks" ON public.lead_tasks_os;
CREATE POLICY "Allow anon write of tasks" ON public.lead_tasks_os 
  FOR ALL TO anon, authenticated USING (true);
