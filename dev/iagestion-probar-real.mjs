/* Prueba REAL de subir una ficha a IA Gestión, con un inmueble inventado.

   Crea un inmueble desechable (Estado "Pendiente", sin propietario ni gestor),
   le sube una ficha completa inventada, comprueba lo guardado, repite la
   subida (para ver que no duplica nada) y lo da de baja. NO toca ningún
   inmueble real: la referencia de prueba se elige de un rango que no existe y
   se comprueba antes de crear nada.

   Uso (las credenciales van por entorno, nunca en el código):
     IAGESTION_USUARIO=... IAGESTION_PASSWORD=... node dev/iagestion-probar-real.mjs */
import { llamarIagestion, prepararSubida, subirFicha, buscarInmueble, MARCA_INI } from "../api/_iagestion.js";

const enteroAleatorio = (a, b) => a + Math.floor(Math.random() * (b - a));

/* Una referencia de 5 cifras que no exista (las reales llegan hasta ~05700) */
let ref;
for (let i = 0; i < 20; i++) {
  const candidata = String(enteroAleatorio(90000, 99999));
  const b = await buscarInmueble(candidata);
  if (!b.ok && b.noExiste) { ref = candidata; break; }
}
if (!ref) { console.error("No se encontró una referencia libre"); process.exit(1); }
console.log("Referencia de prueba:", ref);

/* Como lo deja /enviar-exclusiva-firmada: lo básico, con Tipo en vocabulario de entrada */
const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
const alta = await llamarIagestion("grabar_inmueble", {
  Ref_Intranet: ref, Ref_CRM: ref, Fecha: ahora, Tipo: "Piso", Operacion: "Venta", Estado: "Pendiente",
  Direccion: "Calle Prueba Automatica 1", Poblacion: "Foios", Precio: 1,
});
if (!alta.ok || !alta.datos?.insertado) { console.error("No se pudo crear el inmueble de prueba", alta); process.exit(1); }
const id = alta.datos.id_inmueble;
console.log("Creado:", id, "| fecha de alta:", ahora);

const ficha = {
  id: "00000000-0000-4000-8000-000000000001",
  creada: new Date().toISOString(),
  agenteName: "Agente de Prueba",
  propietarios: [{ nombre: "Propietario Inventado" }],
  data: {
    operacion: "Venta", tipo: "Ático", referencia: `#${ref}`, refCatastral: "1234567VK1234C0001AB",
    direccion: "Calle de Prueba", numero: "12", bloque: "B", planta: "4", puerta: "7", poblacion: "Foios", cp: "46134", provincia: "Valencia",
    suelo: "Urbano", cee: "Hecho", ceeLetra: "D", cargas: "Hipoteca", cargasDetalle: "Banco de Prueba, 50.000 €",
    ocupacion: "Libre", autorizacion: "Sí", exclusiva: "Exclusiva", docs: ["DNI", "IBI", "Nota simple"],
    precio: "245.000", precioMin: "230.000", comunidad: "35", ibi: "310,50", derrama: "Sí", derramaImporte: "1.200",
    vpo: "No", honorarios: "% sobre venta", honorariosValor: "3",
    mConstruidos: "112,5", mUtiles: "96", mTerraza: "14", anio: "1998", alturas: "6", dormitorios: "3", banos: "2", aseos: "1",
    salon: "28", cocinaM: "10",
    equipamiento: ["Armarios empotrados", "Garaje", "Trastero", "Terraza", "Piscina"],
    ventanaMat: ["Aluminio", "Climalit"], ventanaApertura: ["Correderas"], puertas: ["Macizas"], suelos: ["Tarima", "Mármol"],
    cocinaTipo: "Americana", fuegos: "Inducción", acs: ["Aerotermia"], clima: ["A/A Splits"], calefaccion: ["Suelo radiante", "Gas"],
    paredes: ["Lisas"], ascensor: "Sí", cotaCero: "No", zonasComunes: ["Piscina", "Jardines"], conserjeria: "No",
    fachada: ["Monocapa"], estado: "Para entrar", orientacion: ["Sur", "Este"], vistas: ["Al mar", "A la montaña"],
    servicios: ["Metro/Bus", "Colegios"],
    notasInternas: "PRUEBA AUTOMATICA: inmueble inventado, se da de baja al terminar.",
    descripcionPublica: "Ático de prueba inventado.",
  },
};

let salida = 0;
try {
  const previa = await prepararSubida(ficha);
  console.log("\n== VISTA PREVIA ==");
  console.log("Inmueble encontrado:", previa.inmueble);
  console.log("Se enviarían", Object.keys(previa.parametros).length, "parámetros:");
  for (const [k, v] of Object.entries(previa.parametros)) console.log(`  ${k} = ${String(v).slice(0, 70)}`);
  console.log("Avisos:", previa.avisos);

  console.log("\n== SUBIDA 1 ==");
  const r1 = await subirFicha(ficha);
  console.log("ok:", r1.ok, "| fecha intacta:", r1.fechaIntacta, "| error:", r1.error || "-");
  console.log("Guardados y verificados:", r1.aplicados?.length, "→", r1.aplicados?.map((a) => a.campo).join(", "));
  console.log("NO guardados:", JSON.stringify(r1.noGuardados));

  console.log("\n== SUBIDA 2 (repetida) ==");
  const r2 = await subirFicha(ficha);
  console.log("ok:", r2.ok, "| noGuardados:", JSON.stringify(r2.noGuardados));

  const fin = (await buscarInmueble(ref)).inmueble;
  const obs = String(fin.Observaciones_Privadas || "");
  console.log("\n== ESTADO FINAL EN IA GESTIÓN ==");
  console.log({ Fecha: fin.Fecha, Tipo: fin.Tipo, CheckAtico: fin.CheckAtico, Estado_General: fin.Estado_General, Precio: fin.Precio,
    Calefaccion: fin.Calefaccion, Certificado_Energetico: fin.Certificado_Energetico, Exclusiva: fin.Exclusiva, Direccion: fin.Direccion,
    Numero: fin.Numero, Planta: fin.Planta, Puerta: fin.Puerta, CP: fin.CP, Metros_Construidos: fin.Metros_Construidos });
  console.log("Bloques de la ficha en observaciones privadas:", obs.split(MARCA_INI).length - 1, "(debe ser 1)");
  console.log("\nObservaciones privadas (HTML):\n" + obs);
  salida = r1.ok && r2.ok && obs.split(MARCA_INI).length - 1 === 1 ? 0 : 1;
} finally {
  const baja = await llamarIagestion("eliminar_inmueble", { Id_Inmueble: id });
  const despues = (await buscarInmueble(ref)).inmueble;
  console.log("\nBaja del inmueble de prueba:", baja.datos?.message, "| Estado ahora:", despues?.Estado);
}
process.exit(salida);
