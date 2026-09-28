-- Añade el flujo «Campaña audiovisual» al CHECK de flow_type.
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_flow_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_flow_type_check
  CHECK (
    flow_type IS NULL
    OR flow_type IN ('Nacional', 'Exportación', 'Marca Blanca', 'Campaña audiovisual')
  );
