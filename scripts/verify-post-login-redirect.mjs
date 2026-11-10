/**
 * Verifica que el retorno post-login conserve search + hash.
 * Ejecutar: node scripts/verify-post-login-redirect.mjs
 */

function resolvePostLoginPath(from, fallback = '/') {
  const pathname = from?.pathname || fallback;
  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    return fallback;
  }
  const search = from?.search && from.search !== '?' ? from.search : '';
  const hash = from?.hash && from.hash !== '#' ? from.hash : '';
  return `${pathname}${search}${hash}`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Enlace profundo con filtros y fragmento
const deep = {
  pathname: '/projects',
  search: '?q=pera&awaitingMe=1',
  hash: '#resultados',
};
assert(
  resolvePostLoginPath(deep) === '/projects?q=pera&awaitingMe=1#resultados',
  'debe conservar search y hash',
);

// Solo pathname (comportamiento previo)
assert(resolvePostLoginPath({ pathname: '/library' }) === '/library', 'pathname solo');

// Sin from
assert(resolvePostLoginPath(null) === '/', 'fallback /');

// Open redirect bloqueado
assert(resolvePostLoginPath({ pathname: '//evil.example' }) === '/', 'bloquea //');
assert(resolvePostLoginPath({ pathname: 'https://evil.example' }) === '/', 'bloquea abs');

// Vacíos
assert(resolvePostLoginPath({ pathname: '/a', search: '?', hash: '#' }) === '/a', 'ignora ? y # vacíos');

console.log('OK: post-login conserva search+hash en enlace profundo');
