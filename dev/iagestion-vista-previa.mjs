/* Muestra EXACTAMENTE lo que se enviaría al CRM iagestión por cada ficha que
   hay en Neon, sin llamar a nada. Para validar la traducción con Julia antes
   de escribir un solo registro.

   Uso:  node --env-file=.env dev/iagestion-vista-previa.mjs               */
import { neon } from "@neondatabase/serverless";
import { filaAFicha } from "../api/_ficha.js";
import { fichaAInmueble, propietarioAContacto, BASE } from "../api/_iagestion.js";

const sql = neon(process.env.DATABASE_URL);
const filas = await sql`select * from fichas order by recibida_en desc`;

if (!filas.length) {
  console.log("No hay fichas en Neon. Ejecuta antes: npm run db:prueba");
  process.exit(0);
}

console.log(`Destino: POST ${BASE}/grabar_inmueble/`);
console.log(`(más 'usuario' y 'password' en el propio cuerpo)\n`);

for (const fila of filas) {
  const ficha = filaAFicha(fila);
  const { ok, faltan, datos, avisos } = fichaAInmueble(ficha);

  console.log("═".repeat(74));
  console.log(`${ficha.data.tipo} · ${ficha.data.direccion} ${ficha.data.numero || ""} · ${ficha.agenteName}`);
  console.log("─".repeat(74));
  console.log(ok ? "  ✓ lista para enviar" : `  ✗ faltan campos obligatorios: ${faltan.join(", ")}`);
  avisos.forEach((a) => console.log(`  ⚠ ${a}`));
  console.log(`  ${Object.keys(datos).length} campos:\n`);

  const ancho = Math.max(...Object.keys(datos).map((k) => k.length));
  for (const [k, v] of Object.entries(datos)) {
    const texto = String(v).replace(/\n/g, " ⏎ ");
    console.log(`    ${k.padEnd(ancho)}  ${texto.length > 90 ? texto.slice(0, 90) + "…" : texto}`);
  }

  /* Propietarios de más: el CRM solo admite uno en grabar_inmueble */
  const extra = (ficha.propietarios || []).filter((p) => p?.nombre?.trim()).slice(1);
  if (extra.length) {
    console.log(`\n    → y ${extra.length} propietario(s) más, con grabar_contacto + actualizar_propietarios:`);
    extra.forEach((p) => {
      const c = propietarioAContacto(p, ficha);
      console.log(`      ${c.ok ? "✓" : "✗"} ${JSON.stringify(c.datos)}`);
    });
  }
  console.log();
}

console.log("═".repeat(74));
console.log("Nada de esto se ha enviado: es solo la vista previa.");
