-- PackLens: estados de ciclo al crear/sustituir versiones
-- Ejecutar en SQL Editor de Supabase

alter table public.projects
  drop constraint if exists projects_lifecycle_status_check;

alter table public.projects
  add constraint projects_lifecycle_status_check
  check (
    lifecycle_status in (
      'Borrador',
      'Pendiente SAP',
      'Vigente',
      'Temporal',
      'Obsoleta',
      'En proceso de cambio',
      'Sustituido'
    )
  );

notify pgrst, 'reload schema';
