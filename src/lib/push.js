/* Alta y baja de notificaciones en este navegador.
   El permiso lo concede la persona, no la app: aquí solo se pide y se guarda
   la suscripción que devuelve el navegador. */

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const pushSoportado = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window &&
  Boolean(CLAVE_PUBLICA);

export const permisoActual = () =>
  typeof Notification === "undefined" ? "no-soportado" : Notification.permission;

/* La clave VAPID viaja en base64url y el navegador la quiere en bytes. */
function claveEnBytes(base64url) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(base64);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

async function registro() {
  const r = await navigator.serviceWorker.getRegistration();
  return r || navigator.serviceWorker.ready;
}

export async function suscripcionActual() {
  if (!pushSoportado()) return null;
  try {
    const reg = await registro();
    return (await reg?.pushManager.getSubscription()) || null;
  } catch {
    return null;
  }
}

/* `credenciales` identifica a quién pertenece este navegador:
     agente  → { pin, agenteId }
     oficina → { token }                                                    */
export async function activarPush(credenciales) {
  if (!pushSoportado()) return { ok: false, error: "Este navegador no admite notificaciones" };

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    return {
      ok: false,
      denegado: permiso === "denied",
      error:
        permiso === "denied"
          ? "Has bloqueado las notificaciones para este sitio. Hay que permitirlas desde los ajustes del navegador."
          : "No se han activado las notificaciones",
    };
  }

  let suscripcion;
  let reciennacida = false;
  try {
    const reg = await registro();
    suscripcion = await reg.pushManager.getSubscription();
    if (!suscripcion) {
      suscripcion = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveEnBytes(CLAVE_PUBLICA),
      });
      reciennacida = true;
    }
  } catch (err) {
    return { ok: false, error: err?.message || "El navegador no pudo suscribirse" };
  }

  const r = await enviarAlServidor("alta", suscripcion, credenciales);
  /* Si el servidor no la guarda, no dejamos una suscripción huérfana en el
     navegador: creería estar avisado y no llegaría nada. Pero solo se cancela
     la que acabamos de crear; si ya existía, la está usando el otro papel. */
  if (!r.ok && reciennacida) {
    try { await suscripcion.unsubscribe(); } catch { /* da igual */ }
  }
  return r;
}

/* Se da de baja del servidor, pero NO se llama a unsubscribe(): la suscripción
   es del navegador entero y la comparten el panel y la app de agente. Cancelarla
   aquí dejaría al otro papel con un endpoint muerto. Sin fila en el servidor no
   llega nada, que es lo que se pedía. */
export async function desactivarPush(credenciales) {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return { ok: true };
  return enviarAlServidor("baja", suscripcion, credenciales);
}

/* Si este navegador está suscrito EN ESTE PAPEL. Lo dice el servidor: la
   suscripción del navegador es única para todo el sitio y no distingue entre
   la oficina y el agente. */
export async function notificacionesActivas(credenciales) {
  const suscripcion = await suscripcionActual();
  if (!suscripcion || permisoActual() !== "granted") return false;
  const r = await enviarAlServidor("estado", suscripcion, credenciales);
  return r.ok && r.activa === true;
}

async function enviarAlServidor(accion, suscripcion, { pin, agenteId, token } = {}) {
  try {
    const r = await fetch("/api/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        accion,
        pin,
        agenteId,
        endpoint: suscripcion.endpoint,
        suscripcion: suscripcion.toJSON(),
      }),
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: cuerpo.error || `Error ${r.status}` };
    return { ok: true, ...cuerpo };
  } catch {
    return { ok: false, error: "Sin conexión con el servidor" };
  }
}
