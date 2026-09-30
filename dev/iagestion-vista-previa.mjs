/* Vista previa de lo que se subiría a IA Gestión para una ficha de la base de datos.
   SOLO LEE: no escribe nada en IA Gestión.
   Uso: node --env-file=.env dev/iagestion-vista-previa.mjs <id-de-ficha> */
import { neon } from "@neondatabase/serverless";
import { filaAFicha } from "../api/_ficha.js";
import { prepararSubida } from "../api/_iagestion.js";

const id = process.argv[2];
if (!id) { console.error("Uso: iagestion-vista-previa.mjs <id-de-ficha>"); process.exit(1); }
const [row] = await neon(process.env.DATABASE_URL)`select * from fichas where id = ${id}`;
if (!row) { console.error("No existe esa ficha"); process.exit(1); }

const r = await prepararSubida(filaAFicha(row));
if (!r.ok) { console.error("No se puede subir:", r.error); process.exit(1); }
console.log("Inmueble:", r.inmueble);
console.log("\nCampos:"); for (const [k, v] of Object.entries(r.parametros)) if (k !== "Observaciones_Privadas") console.log(`  ${k} = ${v}`);
console.log("\nTexto en observaciones privadas:"); for (const [k, v] of r.lineas) console.log(`  ${k}: ${v}`);
console.log("\nAvisos:", r.avisos);
