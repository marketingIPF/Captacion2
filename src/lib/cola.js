import { K, load, save } from "./storage.js";

/* Cola de envío offline.
   Sin correo de respaldo, una ficha rellenada en un portal sin cobertura solo
   sobrevive si queda en cola y se reintenta al recuperar red. Cada entrada
   guarda la ficha entera; el servidor es idempotente por `id`, así que
   reintentar nunca duplica. */

const MAX_REINTENTOS = 20;

export const leerCola = () => load(K.COLA, []);
const escribirCola = (c) => save(K.COLA, c);

export function encolar(ficha) {
  const cola = leerCola().filter((e) => e.ficha.id !== ficha.id);
  cola.push({ ficha, intentos: 0, ultimoError: null, encoladaEn: Date.now() });
  escribirCola(cola);
  return cola.length;
}

export function desencolar(id) {
  escribirCola(leerCola().filter((e) => e.ficha.id !== id));
}

export const pendientes = () => leerCola().length;

/* Envía una ficha. Distingue cuatro desenlaces, porque ni se tratan ni se le
   cuentan igual al agente:
     ok        → guardada
     rechazada → la ficha está mal; reintentar no arregla nada
     offline   → no hay red; es cosa del móvil y se reintenta solo
     servidor  → la petición llegó pero la oficina no pudo guardarla (base de
                 datos caída o mal configurada). También se reintenta, pero NO
                 se le dice que no tiene cobertura: buscaría señal por un fallo
                 que no es suyo.                                              */
export async function enviarAlServidor(ficha, pin) {
  try {
    const r = await fetch("/api/fichas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, ficha }),
    });

    if (r.ok) {
      const { recibida, envios } = await r.json();
      return { ok: true, recibida, envios };
    }

    const cuerpo = await r.json().catch(() => ({}));
    /* 400 y 401 no se arreglan reintentando; 429 y 5xx sí. */
    if (r.status === 400 || r.status === 401) {
      return { ok: false, tipo: "rechazada", error: cuerpo.error || "La oficina rechazó la ficha" };
    }
    return {
      ok: false,
      tipo: "servidor",
      estado: r.status,
      causa: cuerpo.causa || null,
      error: cuerpo.error || `La oficina devolvió un error ${r.status}`,
    };
  } catch {
    return { ok: false, tipo: "offline", error: "Sin conexión" };
  }
}

/* Procesa la cola entera. Devuelve { enviadas, fallidas, rechazadas }. */
export async function procesarCola(pin) {
  const cola = leerCola();
  if (!cola.length || !pin) return { enviadas: 0, fallidas: 0, rechazadas: 0, motivo: null };

  let enviadas = 0;
  let rechazadas = 0;
  let motivo = null; // "offline" | "servidor": para poder explicar por qué falla
  const quedan = [];

  for (const entrada of cola) {
    const res = await enviarAlServidor(entrada.ficha, pin);
    if (res.ok) {
      enviadas += 1;
      continue;
    }
    if (res.tipo === "rechazada") {
      rechazadas += 1;
      continue; // no tiene sentido reintentar; se avisa y se saca de la cola
    }
    motivo = res.tipo;
    const intentos = entrada.intentos + 1;
    if (intentos < MAX_REINTENTOS) {
      quedan.push({ ...entrada, intentos, ultimoError: res.error, ultimoTipo: res.tipo });
    } else {
      rechazadas += 1;
    }
  }

  escribirCola(quedan);
  return { enviadas, fallidas: quedan.length, rechazadas, motivo };
}
