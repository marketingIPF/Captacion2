/* Genera el valor listo para pegar en las variables de entorno de Vercel
   (AGENTES_JSON, DESTINATARIO) a partir de src/agentes.js. Uso:
   node scripts/print-agentes-env.mjs */
import { AGENTES, DESTINATARIO } from "../src/agentes.js";

console.log("AGENTES_JSON=");
console.log(JSON.stringify(AGENTES));
console.log("\nDESTINATARIO=");
console.log(DESTINATARIO);
