import { ApiError } from '../api/client';

/** Extrae un mensaje legible de cualquier error (API, Error, desconocido). */
export function getErrorMessage(e: unknown, fallback = 'Ha ocurrido un error'): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return fallback;
}
