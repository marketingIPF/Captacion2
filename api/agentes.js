/* Función serverless de Vercel — sirve la lista de agentes solo con PIN válido.
   Los datos reales viven en variables de entorno de Vercel, nunca en el bundle del cliente. */
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const { pin } = req.body || {};
  const pinEsperado = process.env.PIN_ACCESO;

  if (!pinEsperado || typeof pin !== "string" || pin !== pinEsperado) {
    res.status(401).json({ error: "PIN incorrecto" });
    return;
  }

  let agentes = [];
  try {
    agentes = JSON.parse(process.env.AGENTES_JSON || "[]");
  } catch {
    agentes = [];
  }

  res.status(200).json({
    agentes,
    destinatario: process.env.DESTINATARIO || "",
  });
}
