import type { ProjectAttachment } from '../types';
import { getPdfPageCount } from './pdfRenderer';

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });

export const fileToAttachment = async (file: File): Promise<ProjectAttachment> => {
  const dataUrl = await readFileAsDataUrl(file);
  const isPdf = file.type === 'application/pdf';
  const isZip = file.type === 'application/zip' || file.name.endsWith('.zip');

  let pageCount: number | undefined;
  if (isPdf) {
    try {
      pageCount = await getPdfPageCount(dataUrl);
    } catch {
      pageCount = 1;
    }
  }

  return {
    id: `att-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
    dataUrl,
    isImage: (file.type || '').startsWith('image/'),
    isPdf,
    isZip,
    pageCount,
    createdAt: new Date().toISOString(),
  };
};

export const formatFileSize = (kb: number) => {
  if (kb < 1024) return `${kb.toLocaleString()} KB`;
  return `${(kb / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
};

export const isZipFile = (file: File) =>
  file.type === 'application/zip' ||
  file.type === 'application/x-zip-compressed' ||
  file.name.toLowerCase().endsWith('.zip');

export const isZipAttachment = (att: Pick<ProjectAttachment, 'isZip' | 'mimeType' | 'fileName'>) =>
  att.isZip ||
  att.mimeType === 'application/zip' ||
  att.mimeType === 'application/x-zip-compressed' ||
  att.fileName.toLowerCase().endsWith('.zip');

/** Carga bytes desde data URL, blob URL o URL remota (p. ej. Supabase firmada). */
export async function loadArrayBufferFromUrl(fileUrl: string): Promise<ArrayBuffer> {
  if (!fileUrl) throw new Error('URL de archivo vacía');

  if (fileUrl.startsWith('data:')) {
    const base64 = fileUrl.split(',')[1];
    if (!base64) throw new Error('Data URL inválida');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  if (fileUrl.startsWith('blob:')) {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error('No se pudo leer el archivo');
    return res.arrayBuffer();
  }

  let url = fileUrl;
  const headers: Record<string, string> = {};
  if (!url.startsWith('http')) {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1').replace(/\/api\/v1\/?$/, '');
    url = `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  const token = readAccessToken();
  if (token && (url.includes('/api/v1/') || !fileUrl.startsWith('http'))) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('No se pudo cargar el archivo');
  return res.arrayBuffer();
}

const AUTH_STORAGE_KEY = 'packlens-auth';

function readAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
    return parsed.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

/** Descarga un adjunto usando la URL proxy de la API cuando exista. */
export async function downloadAttachment(att: {
  fileName?: string;
  name?: string;
  downloadUrl?: string;
  dataUrl?: string;
}): Promise<void> {
  const fileName = att.fileName ?? att.name;
  if (!fileName) return;
  const url = att.downloadUrl ?? att.dataUrl;
  if (!url) return;
  await downloadFileAs(url, fileName);
}

/** Descarga un archivo remoto conservando el nombre original (evita UUIDs de URLs firmadas). */
export async function downloadFileAs(fileUrl: string, fileName: string): Promise<void> {
  if (!fileUrl) return;

  if (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName;
    a.click();
    return;
  }

  let url = fileUrl;
  if (!url.startsWith('http')) {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1').replace(/\/api\/v1\/?$/, '');
    url = `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    if (!url.includes('filename=')) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}filename=${encodeURIComponent(fileName)}`;
    }
  }

  const headers: Record<string, string> = {};
  const token = readAccessToken();
  const isApiUrl = url.includes('/api/v1/');
  if (token && isApiUrl) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Error al descargar ${fileName}`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
