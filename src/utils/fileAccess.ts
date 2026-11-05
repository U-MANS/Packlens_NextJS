/**
 * Reglas de acceso a archivos del flujo de aprobación.
 * PDF e imágenes: visibles para todos los roles del proyecto.
 * Resto (ZIP, nativos, vídeos, Office…): solo Diseño y Marketing (+ Admin).
 */

export const RESTRICTED_FILE_ROLES = ['Diseño', 'Marketing', 'Admin'] as const;

export function isPublicWorkflowFile(file: {
  mimeType?: string | null;
  fileName?: string | null;
  isImage?: boolean | null;
  isPdf?: boolean | null;
}): boolean {
  if (file.isImage || file.isPdf) return true;
  const mime = (file.mimeType ?? '').toLowerCase();
  const name = (file.fileName ?? '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return true;
  return false;
}

/** ¿Puede este rol ver/descargar archivos no públicos del flujo? */
export function canAccessRestrictedWorkflowFile(role: string | null | undefined): boolean {
  if (!role) return false;
  return (RESTRICTED_FILE_ROLES as readonly string[]).includes(role);
}

/** ¿Puede este rol acceder a este archivo concreto? */
export function canAccessWorkflowFile(
  role: string | null | undefined,
  file: {
    mimeType?: string | null;
    fileName?: string | null;
    isImage?: boolean | null;
    isPdf?: boolean | null;
  },
): boolean {
  if (isPublicWorkflowFile(file)) return true;
  return canAccessRestrictedWorkflowFile(role);
}
