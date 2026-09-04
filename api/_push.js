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
  try {
    webpush.setVapidDetails(sujetoVapid(), publica, privada);
  } catch (err) {
    console.error("Claves VAPID inválidas: las notificaciones quedan desactivadas.", err.message);
    configurado = false;
    return false;
  }
  configurado = true;
  return true;
}

/* web-push exige que el sujeto sea una URL o un "mailto:". Poner ahí el correo
   a secas es el error natural al copiar la variable, y hacía que TODO /api/push
   respondiera 500. Se completa aquí en vez de confiar en que esté bien escrito
   en cada entorno. */
export function sujetoVapid(valor = process.env.VAPID_SUBJECT) {
  const s = String(valor || "").trim();
  if (!s) return "mailto:info@inmobiliariapalanca.com";
  if (/^(https?:|mailto:)/i.test(s)) return s;
  if (s.includes("@")) return `mailto:${s}`;
  return `https://${s}`;
}

export const pushDisponible = () => preparar();

export async function guardarSuscripcion({ tipo, destinatario, suscripcion }) {
  const { endpoint, keys } = suscripcion || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { ok: false, error: "Suscripción incompleta" };
  }
  const sql = db();
  /* La clave es el navegador MÁS el papel. Con solo el endpoint, activar las
     notificaciones en la app de agente desde el mismo Chrome donde se usa el
     panel convertía la suscripción de la oficina en una de agente y la oficina
     dejaba de recibir captaciones nuevas, sin que nadie se enterara.
     Dentro de un mismo papel sí se sustituye: cambiar de agente en un móvil no
     debe dejar activas las notificaciones del anterior. */
  await sql`
    insert into suscripciones_push (endpoint, tipo, destinatario, p256dh, auth)
    values (${endpoint}, ${tipo}, ${destinatario}, ${keys.p256dh}, ${keys.auth})
    on conflict (endpoint, tipo) do update set
      destinatario = excluded.destinatario,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      fallos = 0
  `;
  return { ok: true };
}

/* ¿Está este navegador suscrito en este papel? La pregunta la hace el botón:
   el navegador tiene UNA suscripción compartida por todo el sitio, así que
   mirarla a ella diría que sí en el panel solo porque se activó en la app de
   agente. Quien sabe la verdad es el servidor. */
export async function suscripcionRegistrada(endpoint, tipo) {
  if (!endpoint) return false;
  try {
    const sql = db();
    const r = await sql`
      select 1 from suscripciones_push where endpoint = ${endpoint} and tipo = ${tipo} limit 1
    `;
    return r.length > 0;
  } catch (err) {
    console.error("No se pudo consultar la suscripción", err);
    return false;
  }
}

/* Se da de baja solo el papel que la pide. Borrar por endpoint a secas dejaría
   sin avisos a la oficina porque alguien los apagó en la app de agente desde el
   mismo navegador. */
export async function borrarSuscripcion(endpoint, tipo) {
  if (!endpoint) return { ok: false };
  const sql = db();
  await sql`delete from suscripciones_push where endpoint = ${endpoint} and tipo = ${tipo}`;
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
    const r = await Promise.race([
      notificar(aviso),
      new Promise((r) => setTimeout(() => r({ enviadas: 0, agotado: true }), msMaximo)),
    ]);
    /* Que no llegue un aviso no puede ser invisible: sin esta línea, "no me
       salen las notificaciones" no se distingue de "nadie está suscrito", y
       averiguar cuál de las dos cosas es cuesta horas. No se registra a quién
       se avisa, solo el papel y cuántos. */
    if (!r.enviadas) {
      console.warn(
        `Aviso "${aviso.titulo}" no llegó a nadie (${aviso.tipo}` +
          `${r.agotado ? ", se agotó el tiempo" : ", sin suscripciones"})`
      );
    }
    return r;
  } catch (err) {
    console.warn("Aviso push no enviado", err?.message);
    return { enviadas: 0, error: true };
  }
}
