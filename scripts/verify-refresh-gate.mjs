/**
 * Reproduce la secuencia: 401 sin refreshToken → login → renovación.
 * Compara el comportamiento buggy vs el corregido.
 * Ejecutar: node scripts/verify-refresh-gate.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Réplica del bug: asigna la promesa antes de comprobar el token. */
function createBuggyGate() {
  let refreshInFlight = null;
  let storedRefresh = null;

  async function refreshAccessToken() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      if (!storedRefresh) return false; // sale sin finally
      try {
        return true;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  return {
    setRefresh(token) {
      storedRefresh = token;
    },
    refreshAccessToken,
    get inFlight() {
      return refreshInFlight;
    },
  };
}

/** Fix: comprobar token antes de asignar refreshInFlight. */
function createFixedGate() {
  let refreshInFlight = null;
  let storedRefresh = null;

  async function refreshAccessToken() {
    if (refreshInFlight) return refreshInFlight;
    if (!storedRefresh) return false;

    let flight;
    flight = (async () => {
      try {
        await Promise.resolve(); // cede un tick (como fetch)
        return Boolean(storedRefresh);
      } finally {
        if (refreshInFlight === flight) refreshInFlight = null;
      }
    })();

    refreshInFlight = flight;
    return flight;
  }

  function resetTokenRefreshGate() {
    refreshInFlight = null;
  }

  return {
    setRefresh(token) {
      storedRefresh = token;
    },
    refreshAccessToken,
    resetTokenRefreshGate,
    get inFlight() {
      return refreshInFlight;
    },
  };
}

async function sequence(label, gate, { resetOnLogin = false } = {}) {
  // 1) Sin sesión: 401 sin refreshToken
  gate.setRefresh(null);
  const first = await gate.refreshAccessToken();
  assert(first === false, `${label}: sin token debe ser false`);

  // 2) Login en la misma pestaña
  gate.setRefresh('refresh-after-login');
  if (resetOnLogin) gate.resetTokenRefreshGate();

  // 3) Nueva renovación tras login
  const second = await gate.refreshAccessToken();
  return { first, second, inFlightAfterFirst: Boolean(gate.inFlight) };
}

const buggy = createBuggyGate();
const buggyResult = await sequence('buggy', buggy);
assert(buggyResult.second === false, 'buggy: tras login sigue bloqueado (esperado)');
assert(buggy.inFlight != null, 'buggy: refreshInFlight queda retenido');

const fixed = createFixedGate();
const fixedResult = await sequence('fixed', fixed);
assert(fixedResult.second === true, 'fixed: tras login renueva OK');
assert(fixed.inFlight == null, 'fixed: no deja promesa colgada');

// Defensa: login con reset aunque hubiera estado sucio
const fixedWithReset = createFixedGate();
fixedWithReset.setRefresh(null);
// simular estado sucio residual
fixedWithReset.inFlight; // touch
await fixedWithReset.refreshAccessToken();
fixedWithReset.setRefresh('tok');
fixedWithReset.resetTokenRefreshGate();
assert((await fixedWithReset.refreshAccessToken()) === true, 'reset en login desbloquea');

console.log('OK: renovación no queda bloqueada tras 401 sin refresh + login');
