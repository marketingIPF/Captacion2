/* Genera los valores listos para pegar en las variables de entorno de Vercel
   a partir de src/data/agentes.js.  Uso:  npm run agentes:env  */
import { AGENTES } from "../src/data/agentes.js";

const problemas = [];
const avisos = [];
const vistos = new Set();
AGENTES.forEach((a, i) => {
  /* id, name y role son imprescindibles; email y phone son opcionales. */
  ["id", "name", "role"].forEach((k) => {
    if (!a[k]) problemas.push(`Agente ${i + 1} (${a.name || "sin nombre"}): falta "${k}"`);
  });
  if (vistos.has(a.id)) problemas.push(`Agente ${i + 1}: id duplicado "${a.id}"`);
  vistos.add(a.id);
  if (!a.email) avisos.push(a.name);
});

if (problemas.length) {
  console.error("Revisa src/data/agentes.js:\n" + problemas.map((p) => "  · " + p).join("\n"));
  process.exit(1);
}

console.log(`${AGENTES.length} agentes`);
if (avisos.length) {
  console.log(`Sin email (opcional): ${avisos.length} — ${avisos.join(", ")}`);
}
console.log("");
console.log("AGENTES_JSON=");
console.log(JSON.stringify(AGENTES));
