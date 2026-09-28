import { randomUUID } from 'crypto';
import path from 'path';
import { env } from '@/lib/env';
import { getAdminClient } from '@/lib/supabase/admin';

function detectFlags(mimeType: string, fileName: string) {
  const mime = mimeType || '';
  const lower = fileName.toLowerCase();
  return {
    is_image: mime.startsWith('image/'),
    is_pdf: mime === 'application/pdf' || lower.endsWith('.pdf'),
    is_zip:
      mime === 'application/zip' ||
      mime === 'application/x-zip-compressed' ||
      lower.endsWith('.zip'),
  };
}

export function generateStorageKey(prefix: string, fileName: string): string {
  const ext = path.extname(fileName);
  return `${prefix}/${randomUUID()}${ext}`;
}

/** URLs de previsualización: 24h (se renuevan al serializar proyectos). */
const PREVIEW_URL_TTL_SEC = 60 * 60 * 24;

export async function getSignedDownloadUrl(
  storageKey: string,
  expiresIn = PREVIEW_URL_TTL_SEC,
): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(env.storageBucket())
    .createSignedUrl(storageKey, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'No se pudo firmar URL de descarga');
  }
  return data.signedUrl;
}

/** Firma en lote varias keys; las que fallen usan el proxy autenticado. */
export async function getSignedDownloadUrls(
  storageKeys: string[],
  expiresIn = PREVIEW_URL_TTL_SEC,
): Promise<Map<string, string>> {
  const unique = [...new Set(storageKeys.filter(Boolean))];
  const result = new Map<string, string>();
  if (!unique.length) return result;

  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(env.storageBucket())
    .createSignedUrls(unique, expiresIn);

  if (error || !data) {
    for (const key of unique) result.set(key, proxyDownloadUrl(key));
    return result;
  }

  for (const item of data) {
    const key = item.path;
    if (!key) continue;
    if (item.signedUrl) result.set(key, item.signedUrl);
    else result.set(key, proxyDownloadUrl(key));
  }
  for (const key of unique) {
    if (!result.has(key)) result.set(key, proxyDownloadUrl(key));
  }
  return result;
}

export function proxyDownloadUrl(storageKey: string, fileName?: string): string {
  const base = `/api/v1/files/${storageKey}`;
  if (!fileName) return base;
  return `${base}?filename=${encodeURIComponent(fileName)}`;
}

export async function uploadBytes(
  content: Buffer,
  storageKey: string,
  contentType: string,
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.storage.from(env.storageBucket()).upload(storageKey, content, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Error subiendo a Storage: ${error.message}`);
}

export async function createSignedUploadUrl(storageKey: string): Promise<{
  upload_url: string;
  token: string | null;
}> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(env.storageBucket())
    .createSignedUploadUrl(storageKey);
  if (error || !data) {
    throw new Error(error?.message || 'No se pudo crear URL de subida');
  }
  return {
    upload_url: data.signedUrl,
    token: data.token ?? null,
  };
}

export async function fetchFileBytes(storageKey: string): Promise<{ content: Buffer; mime: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage.from(env.storageBucket()).download(storageKey);
  if (error || !data) throw new Error(error?.message || 'Archivo no encontrado');
  const buf = Buffer.from(await data.arrayBuffer());
  const mime = data.type || 'application/octet-stream';
  return { content: buf, mime };
}

export type AttachmentRow = {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size_kb: number | null;
  storage_key: string;
  is_image: boolean;
  is_pdf: boolean;
  is_zip: boolean;
  page_count: number | null;
  created_at: string;
};

export async function createAttachmentFromFile(
  file: File,
  prefix: string,
): Promise<AttachmentRow> {
  const fileName = file.name || 'file';
  const mimeType = file.type || 'application/octet-stream';
  const buffer = Buffer.from(await file.arrayBuffer());
  const sizeKb = Math.max(1, Math.floor(buffer.length / 1024));
  const storageKey = generateStorageKey(prefix, fileName);
  await uploadBytes(buffer, storageKey, mimeType);
  const flags = detectFlags(mimeType, fileName);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('attachments')
    .insert({
      file_name: fileName,
      mime_type: mimeType,
      file_size_kb: sizeKb,
      storage_key: storageKey,
      ...flags,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'No se pudo crear attachment');
  return data as AttachmentRow;
}

export async function createAttachmentFromMeta(payload: {
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
}): Promise<AttachmentRow> {
  const flags = detectFlags(payload.mime_type, payload.file_name);
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('attachments')
    .insert({
      file_name: payload.file_name,
      mime_type: payload.mime_type,
      file_size_kb: Math.max(1, Math.floor(payload.file_size / 1024)),
      storage_key: payload.storage_key,
      ...flags,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'No se pudo crear attachment');
  return data as AttachmentRow;
}

export async function attachmentToRead(att: AttachmentRow) {
  let preview_url: string | null = null;
  try {
    preview_url = await getSignedDownloadUrl(att.storage_key);
  } catch {
    preview_url = proxyDownloadUrl(att.storage_key, att.file_name);
  }
  return {
    ...att,
    preview_url,
    download_url: proxyDownloadUrl(att.storage_key, att.file_name),
  };
}
