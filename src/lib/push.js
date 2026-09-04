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
  try {
    const reg = await registro();
    suscripcion =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveEnBytes(CLAVE_PUBLICA),
      }));
  } catch (err) {
    return { ok: false, error: err?.message || "El navegador no pudo suscribirse" };
  }

  const r = await enviarAlServidor("alta", suscripcion, credenciales);
  if (!r.ok) {
    /* Si el servidor no la guarda, no dejamos una suscripción huérfana en el
       navegador: creería estar avisado y no llegaría nada. */
    try { await suscripcion.unsubscribe(); } catch { /* da igual */ }
  }
  return r;
}

export async function desactivarPush(credenciales) {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return { ok: true };
  await enviarAlServidor("baja", suscripcion, credenciales);
  try { await suscripcion.unsubscribe(); } catch { /* da igual */ }
  return { ok: true };
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
        accion: accion === "baja" ? "baja" : "alta",
        pin,
        agenteId,
        endpoint: suscripcion.endpoint,
        suscripcion: suscripcion.toJSON(),
      }),
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: cuerpo.error || `Error ${r.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sin conexión con el servidor" };
  }
}
