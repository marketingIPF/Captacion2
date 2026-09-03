import { timingSafeEqual } from "node:crypto";

/* Sirve la lista de agentes solo con PIN válido.
   Los datos reales viven en variables de entorno, nunca en el bundle. */

/* Límite de intentos en memoria. Cada instancia serverless tiene el suyo, así
   que no es una defensa perfecta — pero convierte la fuerza bruta en algo
   lento y ruidoso. Para algo serio: Vercel KV o Upstash compartido. */
const intentos = new Map();
const VENTANA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 8;

function ipDe(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "desconocida";
}

function limitado(ip) {
  const ahora = Date.now();
  const reg = intentos.get(ip);
  if (!reg || ahora > reg.hasta) {
    intentos.set(ip, { n: 0, hasta: ahora + VENTANA_MS });
    return false;
  }
  return reg.n >= MAX_INTENTOS;
}

function anotarFallo(ip) {
  const reg = intentos.get(ip);
  if (reg) reg.n += 1;
  /* Poda perezosa para que el Map no crezca sin fin. */
  if (intentos.size > 5000) {
    const ahora = Date.now();
    for (const [k, v] of intentos) if (ahora > v.hasta) intentos.delete(k);
  }
}

const iguales = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  /* timingSafeEqual exige misma longitud; comparamos siempre el mismo número
     de bytes para no filtrar la longitud del PIN por el tiempo de respuesta. */
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
};

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const pinEsperado = process.env.PIN_ACCESO;
  if (!pinEsperado) {
    console.error("PIN_ACCESO no está configurado en el entorno");
    res.status(500).json({ error: "Servicio mal configurado" });
    return;
  }

  const ip = ipDe(req);
  if (limitado(ip)) {
    res.setHeader("Retry-After", String(VENTANA_MS / 1000));
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const pin = body?.pin;

  if (typeof pin !== "string" || !iguales(pin, pinEsperado)) {
    anotarFallo(ip);
    res.status(401).json({ error: "PIN incorrecto" });
    return;
  }

  let agentes = [];
  try {
    agentes = JSON.parse(process.env.AGENTES_JSON || "[]");
    if (!Array.isArray(agentes)) agentes = [];
  } catch (err) {
    console.error("AGENTES_JSON no es JSON válido", err);
    agentes = [];
  }

  res.status(200).json({ agentes });
}
