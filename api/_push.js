import webpush from "web-push";
import { db } from "./_db.js";

/* Envío de notificaciones push.
   Una notificación nunca debe tumbar la operación que la provoca: si el envío
   falla, la ficha ya se ha guardado igual. Por eso todo lo de aquí traga sus
   propios errores y solo deja rastro en el log. */

let configurado = null;

function preparar() {
  if (configurado !== null) return configurado;
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    console.warn("Sin claves VAPID: las notificaciones push quedan desactivadas.");
    configurado = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@inmobiliariapalanca.com",
    publica,
    privada
  );
  configurado = true;
  return true;
}

export const pushDisponible = () => preparar();

export async function guardarSuscripcion({ tipo, destinatario, suscripcion }) {
  const { endpoint, keys } = suscripcion || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { ok: false, error: "Suscripción incompleta" };
  }
  const sql = db();
  /* El endpoint es la clave: si el navegador vuelve a suscribirse, se
     actualiza en vez de duplicar, y se reinicia el contador de fallos. */
  await sql`
    insert into suscripciones_push (endpoint, tipo, destinatario, p256dh, auth)
    values (${endpoint}, ${tipo}, ${destinatario}, ${keys.p256dh}, ${keys.auth})
    on conflict (endpoint) do update set
      tipo = excluded.tipo,
      destinatario = excluded.destinatario,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      fallos = 0
  `;
  return { ok: true };
}

export async function borrarSuscripcion(endpoint) {
  if (!endpoint) return { ok: false };
  const sql = db();
  await sql`delete from suscripciones_push where endpoint = ${endpoint}`;
  return { ok: true };
}

/* Envía a todos los navegadores de un destinatario, o a todos los de un tipo
   si no se indica destinatario: los avisos de la oficina van a quien esté
   suscrito, que ya ha pasado el control de acceso al suscribirse. No hay un
   "email de la oficina" que calcular. Devuelve cuántos lo han recibido; nunca
   lanza. */
export async function notificar({ tipo, destinatario, titulo, cuerpo, url, etiqueta }) {
  if (!preparar()) return { enviadas: 0 };

  let subs = [];
  try {
    const sql = db();
    subs = destinatario
      ? await sql`
          select endpoint, p256dh, auth from suscripciones_push
          where tipo = ${tipo} and destinatario = ${destinatario}
        `
      : await sql`
          select endpoint, p256dh, auth from suscripciones_push where tipo = ${tipo}
        `;
  } catch (err) {
    console.error("No se pudieron leer las suscripciones", err);
    return { enviadas: 0 };
  }
  if (!subs.length) return { enviadas: 0 };

  const carga = JSON.stringify({ titulo, cuerpo, url, etiqueta });
  const caducados = [];
  let enviadas = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          carga,
          { TTL: 3600 }
        );
        enviadas += 1;
      } catch (err) {
        /* 404 y 410 significan que ese navegador ya no existe: se borra en vez
           de reintentar contra él para siempre. */
        if (err?.statusCode === 404 || err?.statusCode === 410) caducados.push(s.endpoint);
        else console.warn(`Push fallido (${err?.statusCode}): ${err?.body || err?.message}`);
      }
    })
  );

  if (caducados.length) {
    try {
      const sql = db();
      await sql`delete from suscripciones_push where endpoint = any(${caducados})`;
    } catch {
      /* si no se pueden limpiar ahora, se limpiarán en el siguiente envío */
    }
  }

  return { enviadas, caducadas: caducados.length };
}

/* Se llama sin await desde los handlers: la notificación no debe retrasar la
   respuesta, pero en una función serverless tampoco puede quedar colgando
   después de responder. Se le da un margen corto y se sigue. */
export async function notificarSinBloquear(aviso, msMaximo = 3000) {
  try {
    await Promise.race([
      notificar(aviso),
      new Promise((r) => setTimeout(() => r({ enviadas: 0, agotado: true }), msMaximo)),
    ]);
  } catch (err) {
    console.warn("Aviso push no enviado", err?.message);
  }
}
