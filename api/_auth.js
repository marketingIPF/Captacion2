import { timingSafeEqual } from "node:crypto";
import { tokenDe, verificarToken } from "./_jwt.js";

/* Límite de intentos en memoria, compartido por todos los endpoints.
   Cada instancia serverless tiene el suyo, así que no es una defensa perfecta,
   pero convierte la fuerza bruta en algo lento. Para algo serio: Vercel KV. */
const intentos = new Map();
const VENTANA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 8;

export function ipDe(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "desconocida";
}

export function limitado(ip) {
  const ahora = Date.now();
  const reg = intentos.get(ip);
  if (!reg || ahora > reg.hasta) {
    intentos.set(ip, { n: 0, hasta: ahora + VENTANA_MS });
    return false;
  }
  return reg.n >= MAX_INTENTOS;
}

export function anotarFallo(ip) {
  const reg = intentos.get(ip);
  if (reg) reg.n += 1;
  if (intentos.size > 5000) {
    const ahora = Date.now();
    for (const [k, v] of intentos) if (ahora > v.hasta) intentos.delete(k);
  }
}

export function reiniciarLimite() {
  intentos.clear();
}

/* Comparación en tiempo constante: no revela la longitud ni los prefijos. */
export function pinValido(recibido, esperado) {
  if (typeof recibido !== "string" || typeof esperado !== "string" || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function leerBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

export function cabecerasBase(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
}

/* Puerta común: solo POST, con límite de intentos y PIN válido.
   Devuelve el cuerpo si la petición puede continuar; si no, ya respondió. */
export function autorizar(req, res, nombreVariable) {
  cabecerasBase(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Método no permitido" });
    return null;
  }

  const esperado = process.env[nombreVariable];
  if (!esperado) {
    console.error(`${nombreVariable} no está configurado en el entorno`);
    res.status(500).json({ error: "Servicio mal configurado" });
    return null;
  }

  const ip = ipDe(req);
  if (limitado(ip)) {
    res.setHeader("Retry-After", String(VENTANA_MS / 1000));
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    return null;
  }

  const body = leerBody(req);
  if (!pinValido(body.pin, esperado)) {
    anotarFallo(ip);
    res.status(401).json({ error: "PIN incorrecto" });
    return null;
  }

  return body;
}

/* Puerta del panel de oficina: sesión de Neon Auth (Google) en vez de PIN.
   Devuelve { body, usuario } o null si ya se respondió con un error. */
export async function autorizarPanel(req, res) {
  cabecerasBase(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Método no permitido" });
    return null;
  }

  const ip = ipDe(req);
  if (limitado(ip)) {
    res.setHeader("Retry-After", String(VENTANA_MS / 1000));
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    return null;
  }

  const { ok, usuario, code, error } = await verificarToken(tokenDe(req));
  if (!ok) {
    anotarFallo(ip);
    if (code === 401) res.setHeader("WWW-Authenticate", "Bearer");
    res.status(code).json({ error });
    return null;
  }

  return { body: leerBody(req), usuario };
}
