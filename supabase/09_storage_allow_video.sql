-- Permite vídeos en el bucket packlens-files (flujo Campaña audiovisual).
-- Ejecutar en Supabase → SQL Editor.

UPDATE storage.buckets
SET
  file_size_limit = 209715200, -- 200 MB (masters / spots)
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'application/postscript', 'application/illustrator',
    'image/vnd.adobe.photoshop',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg'
  ]
WHERE id = 'packlens-files';
