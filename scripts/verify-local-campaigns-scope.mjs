/**
 * Verifica aislamiento de campañas locales por usuario+org
 * (dos sesiones consecutivas en el mismo origen).
 * Ejecutar: node scripts/verify-local-campaigns-scope.mjs
 */

const LEGACY = 'packlens-local-campaigns';
const NONE = `${LEGACY}:none`;

function storageKey(userId, orgId) {
  return `${LEGACY}:${userId}:${orgId}`;
}

function createHarness() {
  const idb = new Map();
  let persistPaused = false;
  let activeScope = null;
  let memory = { campaigns: [], hydrated: false, scopeKey: null };
  let persistName = NONE;

  const storage = {
    async getItem(name) {
      if (name === NONE) return null;
      return idb.has(name) ? idb.get(name) : null;
    },
    async setItem(name, value) {
      if (persistPaused || name === NONE) return;
      idb.set(name, value);
    },
  };

  async function persistWrite() {
    if (persistPaused || persistName === NONE) return;
    await storage.setItem(
      persistName,
      JSON.stringify({ state: { campaigns: memory.campaigns }, version: 0 }),
    );
  }

  async function rehydrate() {
    const raw = await storage.getItem(persistName);
    if (!raw) {
      memory = { ...memory, campaigns: [], hydrated: true };
      return;
    }
    const parsed = JSON.parse(raw);
    memory = {
      ...memory,
      campaigns: parsed.state?.campaigns ?? [],
      hydrated: true,
    };
  }

  async function bind(userId, organizationId) {
    const next = userId && organizationId ? storageKey(userId, organizationId) : null;
    if (next === activeScope) return;
    persistPaused = true;
    try {
      activeScope = next;
      persistName = next ?? NONE;
      memory = { campaigns: [], hydrated: false, scopeKey: next };
      if (!next) {
        memory.hydrated = true;
        return;
      }
      await rehydrate();
    } finally {
      persistPaused = false;
    }
  }

  async function addCampaign(name) {
    memory.campaigns = [
      ...memory.campaigns,
      { id: crypto.randomUUID(), name, notes: `nota-${name}` },
    ];
    await persistWrite();
  }

  return {
    idb,
    get memory() {
      return memory;
    },
    get activeScope() {
      return activeScope;
    },
    bind,
    addCampaign,
    storageKey,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const h = createHarness();

// Sesión A: user1 / orgHelios
await h.bind('user-1', 'org-helios');
await h.addCampaign('Campana A');
assert(h.memory.campaigns.length === 1, 'A debe tener 1 campaña');
assert(h.activeScope === storageKey('user-1', 'org-helios'), 'scope A');
assert(h.idb.has(storageKey('user-1', 'org-helios')), 'IDB A persistido');
assert(!h.idb.has(LEGACY), 'no usar clave legacy compartida');

// Logout
await h.bind(null, null);
assert(h.memory.campaigns.length === 0, 'memoria vacía tras logout');
assert(h.memory.scopeKey === null, 'scope null tras logout');
assert(h.idb.has(storageKey('user-1', 'org-helios')), 'IDB A intacto tras logout');

// Sesión B consecutiva: user2 / orgHelios (mismo origen / perfil)
await h.bind('user-2', 'org-helios');
assert(h.memory.campaigns.length === 0, 'B no ve campañas de A en memoria');
assert(h.activeScope === storageKey('user-2', 'org-helios'), 'scope B');
await h.addCampaign('Campana B');
assert(h.memory.campaigns[0].name === 'Campana B', 'B solo ve lo suyo');

// Cambio de org mismo usuario B
await h.bind('user-2', 'org-other');
assert(h.memory.campaigns.length === 0, 'otra org no ve campañas previas');
await h.addCampaign('Campana C');

// Volver a sesión A
await h.bind('user-1', 'org-helios');
assert(h.memory.campaigns.length === 1, 'A recupera su campaña');
assert(h.memory.campaigns[0].name === 'Campana A', 'contenido A intacto');
assert(
  JSON.parse(h.idb.get(storageKey('user-2', 'org-helios'))).state.campaigns[0].name ===
    'Campana B',
  'IDB B intacto',
);

console.log('OK: aislamiento por usuario+org en dos sesiones consecutivas');
