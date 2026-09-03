/* Descarga del CRM las listas reales de tipos, para confirmar (o corregir) la
   tabla TIPOS de api/_iagestion.js. Solo LEE: no crea ni modifica nada.

   Uso:  node --env-file=.env dev/iagestion-tipos.mjs                      */
import { llamarIagestion, TIPOS } from "../api/_iagestion.js";

let fallo = false;

for (const servicio of ["tipo_inmueble", "tipo_operacion"]) {
  const r = await llamarIagestion(servicio);
  console.log(`\n— ${servicio} —`);
  if (r.ok) {
    console.log(JSON.stringify(r.datos, null, 1).slice(0, 2500));
  } else {
    fallo = true;
    console.error(`  ✗ ${r.error}`);
    if (r.crudo) console.error(`    respuesta del CRM: ${r.crudo.replace(/\s+/g, " ").slice(0, 220)}`);
  }
}

console.log("\n— Nuestra tabla de equivalencias —");
for (const [nuestro, suyo] of Object.entries(TIPOS)) {
  console.log(`  ${nuestro.padEnd(16)} → ${suyo}`);
}

if (fallo) {
  console.log(
    "\nNo se han podido leer las listas del CRM. Las credenciales de la API las\n" +
    "facilita iagestión y no son necesariamente las del acceso web al CRM."
  );
  process.exit(1);
}
console.log("\nCompara las dos listas y ajusta TIPOS en api/_iagestion.js si algo no cuadra.");
