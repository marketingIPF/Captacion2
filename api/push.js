import { cabecerasBase, leerBody, pinValido, ipDe, limitado, anotarFallo } from "./_auth.js";
import { tokenDe, verificarToken } from "./_jwt.js";
import { guardarSuscripcion, borrarSuscripcion, suscripcionRegistrada, pushDisponible } from "./_push.js";

/* Alta y baja de suscripciones push.
   Atiende a los dos lados: el agente se identifica con el PIN y dice de qué
   agente es el móvil; la oficina, con su sesión de Google. Se resuelve aquí
   en vez de duplicar el endpoint porque el cuerpo es idéntico. */
export default async function handler(req, res) {
  cabecerasBase(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  if (!pushDisponible()) {
    res.status(503).json({ error: "Las notificaciones no están configuradas en el servidor" });
    return;
  }

  const body = leerBody(req);
  const ip = ipDe(req);
  if (limitado(ip)) {
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    return;
  }

  /* Quién pide el alta decide a nombre de quién se guarda. */
  let tipo, destinatario;
  const token = tokenDe(req);

  if (token) {
    const sesion = await verificarToken(token);
    if (!sesion.ok) {
      anotarFallo(ip);
      res.status(sesion.code).json({ error: sesion.error });
      return;
    }
    tipo = "oficina";
    destinatario = sesion.usuario.email;
  } else if (pinValido(body.pin, process.env.PIN_ACCESO)) {
    const agenteId = String(body.agenteId || "").trim();
    if (!agenteId) {
      res.status(400).json({ error: "Falta el agente" });
      return;
    }
    tipo = "agente";
    destinatario = agenteId.slice(0, 100);
  } else {
    anotarFallo(ip);
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  try {
    if (body.accion === "estado") {
      res.status(200).json({ activa: await suscripcionRegistrada(body.endpoint, tipo) });
      return;
    }

    if (body.accion === "baja") {
      await borrarSuscripcion(body.endpoint, tipo);
      res.status(200).json({ ok: true });
      return;
    }

    /* Una acción desconocida se rechaza. Dejarla caer en "alta" convertiría un
       error de escritura en un alta silenciosa. */
    if (body.accion !== "alta") {
      res.status(400).json({ error: "Acción desconocida" });
      return;
    }

    const r = await guardarSuscripcion({ tipo, destinatario, suscripcion: body.suscripcion });
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.status(200).json({ ok: true, tipo, destinatario });
  } catch (err) {
    console.error("Error con la suscripción push", err);
    res.status(503).json({ error: "No se pudo guardar la suscripción" });
  }
}
