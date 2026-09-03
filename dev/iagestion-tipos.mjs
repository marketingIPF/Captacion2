/* Descarga del CRM las listas reales de tipos de inmueble y de operación,
   para confirmar (o corregir) la tabla TIPOS de api/_iagestion.js.
   Solo LEE: no crea ni modifica nada.

   Uso:  node --env-file=.env dev/iagestion-tipos.mjs                      */
import { BASE, TIPOS } from "../api/_iagestion.js";

const usuario = process.env.IAGESTION_USUARIO;
const password = process.env.IAGESTION_PASSWORD;

if (!usuario || !password) {
  console.error(
    "Faltan IAGESTION_USUARIO e IAGESTION_PASSWORD en .env.\n" +
    "Son las credenciales de la API del CRM; las da iagestión."
  );
  process.exit(1);
}

async function consultar(servicio) {
  const r = await fetch(`${BASE}/${servicio}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${servicio} → ${r.status}: ${texto.slice(0, 200)}`);
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`${servicio} no devolvió JSON: ${texto.slice(0, 200)}`);
  }
}

for (const servicio of ["tipo_inmueble", "tipo_operacion"]) {
  try {
    const datos = await consultar(servicio);
    console.log(`\n— ${servicio} —`);
    console.log(JSON.stringify(datos, null, 1).slice(0, 2000));
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
  }
}

console.log("\n— Nuestra tabla actual —");
for (const [nuestro, suyo] of Object.entries(TIPOS)) {
  console.log(`  ${nuestro.padEnd(16)} → ${suyo}`);
}
console.log("\nCompara las dos listas y ajusta TIPOS en api/_iagestion.js si algo no cuadra.");
