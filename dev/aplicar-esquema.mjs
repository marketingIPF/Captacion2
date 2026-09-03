/* Aplica un archivo .sql a la base de datos de Neon.
   Uso:  node --env-file=.env dev/aplicar-esquema.mjs db/schema.sql          */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const archivo = process.argv[2];
if (!archivo) {
  console.error("Uso: node --env-file=.env dev/aplicar-esquema.mjs <archivo.sql>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. ¿Ejecutaste con --env-file=.env?");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const texto = readFileSync(archivo, "utf8");

/* Divide por ";" respetando los bloques $$ … $$ de las funciones plpgsql. */
function sentencias(src) {
  const out = [];
  let actual = "";
  let enDolar = false;
  for (const linea of src.split("\n")) {
    if (linea.trim().startsWith("--") && !actual.trim()) continue;
    const dolares = (linea.match(/\$\$/g) || []).length;
    if (dolares % 2 === 1) enDolar = !enDolar;
    actual += linea + "\n";
    if (!enDolar && linea.trimEnd().endsWith(";")) {
      if (actual.trim()) out.push(actual.trim());
      actual = "";
    }
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}

const lista = sentencias(texto);
console.log(`${archivo}: ${lista.length} sentencias\n`);

for (const s of lista) {
  const etiqueta = s.split("\n")[0].slice(0, 72);
  try {
    await sql(s);
    console.log(`  ✓ ${etiqueta}`);
  } catch (err) {
    console.error(`  ✗ ${etiqueta}\n    ${err.message}`);
    process.exit(1);
  }
}
console.log("\nListo.");
