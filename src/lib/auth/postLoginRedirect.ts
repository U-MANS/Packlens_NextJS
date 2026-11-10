/** Destino post-login: pathname + search + hash, solo rutas internas. */
export type RedirectLocation = {
  pathname?: string;
  search?: string;
  hash?: string;
};

export function resolvePostLoginPath(
  from: RedirectLocation | null | undefined,
  fallback = '/',
): string {
  const pathname = from?.pathname || fallback;
  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    return fallback;
  }
  const search = from?.search && from.search !== '?' ? from.search : '';
  const hash = from?.hash && from.hash !== '#' ? from.hash : '';
  return `${pathname}${search}${hash}`;
}
