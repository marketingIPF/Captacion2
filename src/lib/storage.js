/* Claves de localStorage. Prefijo v2 para no chocar con la versión anterior. */
export const K = {
  DRAFTS: "rk2_fichas_draft",
  SENT: "rk2_fichas_sent",
  AGENT: "rk2_agente_activo",
  CACHE: "rk2_agentes_cache",
  BORRADOR_ACTIVO: "rk2_ficha_en_curso",
  COLA: "rk2_cola_envio",
  PIN: "rk2_pin",
};

/* La caché de agentes lleva datos personales del equipo: caduca sola, para que
   un dispositivo perdido o un agente que se va no la conserven indefinidamente.
   Al caducar, la app vuelve a pedir el PIN. */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export const load = (k, def) => {
  try {
    const r = localStorage.getItem(k);
    return r ? JSON.parse(r) : def;
  } catch {
    return def;
  }
};

export const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (err) {
    /* Cuota llena: lo más probable es un historial demasiado grande. */
    console.warn("No se pudo guardar en localStorage", err);
    return false;
  }
};

export const remove = (k) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* nada que hacer */
  }
};

export function loadCacheAgentes() {
  const c = load(K.CACHE, null);
  if (!c || !c.guardadoEn) return null;
  if (Date.now() - c.guardadoEn > CACHE_TTL_MS) {
    remove(K.CACHE);
    return null;
  }
  return c;
}

export const saveCacheAgentes = (data) => save(K.CACHE, { ...data, guardadoEn: Date.now() });

/* El historial no puede crecer sin límite: localStorage ronda los 5 MB y
   además son datos personales que no deben vivir para siempre en el móvil. */
export const MAX_HISTORIAL = 100;
export const podar = (lista) => lista.slice(-MAX_HISTORIAL);
