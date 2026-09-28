-- Quita el tope de tamaño del bucket packlens-files (masters / arte final grandes).
-- El límite efectivo pasa a ser el Global file size limit del proyecto en Supabase
-- (Dashboard → Storage → Settings). En plan Free suele ser 50 MB; en Pro se puede subir.
-- Ejecutar en Supabase → SQL Editor.

UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'packlens-files';
