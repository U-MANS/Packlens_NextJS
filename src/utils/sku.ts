const PACKAGING_UNITS = new Set(['G', 'KG', 'ML', 'L', 'CL']);

const STOP_WORDS = new Set([
  'DE',
  'LA',
  'EL',
  'Y',
  'DEL',
  'LOS',
  'LAS',
  'EN',
  'CON',
  'PARA',
  'THE',
  'AND',
  'OF',
]);

function isQuantityToken(token: string): boolean {
  return /^\d+(G|KG|ML|CL|L)?$/.test(token);
}

/** Extrae cantidad (y unidad opcional) del nombre para el sufijo del SKU. */
function extractQuantitySuffix(tokens: string[]): string | null {
  let last: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const combined = token.match(/^(\d+)(G|KG|ML|CL|L)$/);
    if (combined) {
      last = `${combined[1]}${combined[2]}`;
      continue;
    }
    if (/^\d+$/.test(token)) {
      const next = tokens[i + 1];
      if (next && PACKAGING_UNITS.has(next)) {
        last = `${token}${next}`;
        i++;
      } else {
        last = token;
      }
    }
  }

  return last;
}

export function tokenizeProductName(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** Tokens de nombre (sin stop-words ni cantidades/unidades). */
function nameTokensForSku(tokens: string[]): string[] {
  const withoutQty = tokens.filter((t) => !isQuantityToken(t) && !PACKAGING_UNITS.has(t));
  const significant = withoutQty.filter((t) => !STOP_WORDS.has(t));
  return significant.length > 0 ? significant : withoutQty;
}

function abbreviateTokens(tokens: string[]): string {
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0].slice(0, 12);
  if (tokens.length === 2) {
    return `${tokens[0].slice(0, 4)}-${tokens[1].slice(0, 8)}`;
  }
  return tokens
    .slice(0, 4)
    .map((t) => t.slice(0, 4))
    .join('-');
}

/** Genera un código de artículo legible a partir del nombre del producto. */
export function slugSkuFromName(name: string): string {
  if (!name.trim()) return '';
  const tokens = tokenizeProductName(name);
  if (!tokens.length) return '';
  const head = abbreviateTokens(nameTokensForSku(tokens));
  const quantity = extractQuantitySuffix(tokens);
  if (!head) return (quantity ?? '').slice(0, 50);
  const base = quantity ? `${head}-${quantity}` : head;
  return base.slice(0, 50);
}

/** Evita colisiones añadiendo un sufijo numérico (-2, -3…). */
export function ensureUniqueSku(base: string, takenSkus: Iterable<string>): string {
  const taken = new Set(
    [...takenSkus].map((s) => s.trim().toUpperCase()).filter(Boolean),
  );
  const normalized = base.trim().toUpperCase();
  if (!normalized) return '';
  if (!taken.has(normalized)) return normalized;

  for (let n = 2; n < 1000; n++) {
    const candidate = `${normalized}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${normalized}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function isSkuTaken(
  sku: string,
  projects: { sku: string; archived?: boolean }[],
): boolean {
  const normalized = sku.trim().toUpperCase();
  return projects.some((p) => !p.archived && p.sku.trim().toUpperCase() === normalized);
}
