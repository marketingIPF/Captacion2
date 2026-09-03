/* Inserta (o borra) fichas de ejemplo en Neon para poder ver el panel poblado.
   Pasan por el handler real, así que recorren la misma validación y el mismo
   SQL que una ficha enviada desde el móvil.

   Uso:  node --env-file=.env dev/fichas-de-prueba.mjs
         node --env-file=.env dev/fichas-de-prueba.mjs --borrar          */
import { randomUUID } from "node:crypto";
import fichas from "../api/fichas.js";
import { actualizar } from "../api/admin.js";
import { neon } from "@neondatabase/serverless";

const MARCA = "[PRUEBA]"; // va en las notas internas: sirve para localizarlas y borrarlas

const res = () => {
  const r = { code: null, body: null };
  r.setHeader = () => {};
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

const enviar = async (ficha) => {
  const r = res();
  await fichas(
    { method: "POST", body: { pin: process.env.PIN_ACCESO, ficha }, headers: {}, socket: {} },
    r
  );
  return r;
};

const EJEMPLOS = [
  {
    diasAtras: 0,
    agenteId: "eva-valles",
    agenteName: "Eva Vallés",
    estado: "nueva",
    propietarios: [
      { nombre: "Carmen Ferrer Ros", telefono: "666554433", dni: "12345678Z", email: "" },
      { nombre: "Vicente Ferrer Ros", telefono: "610223344", dni: "87654321X", email: "" },
    ],
    data: {
      operacion: "Venta", tipo: "Piso", referencia: "#05619",
      refCatastral: "6121104YJ2762A0003RL",
      direccion: "Calle Colon", numero: "26", bloque: "1", planta: "02", puerta: "02",
      poblacion: "Valencia", provincia: "Valencia", cp: "46004",
      suelo: "Urbano", cee: "Hecho", ceeLetra: "E", cargas: "Hipoteca",
      cargasDetalle: "Pendiente 78.000 € con Sabadell", ocupacion: "Libre",
      autorizacion: "Sí", exclusiva: "Exclusiva",
      docs: ["DNI", "IBI", "CEE", "Nota simple"],
      precio: "385.000", precioMin: "365.000", comunidad: "62", ibi: "540",
      derrama: "No", vpo: "No", honorarios: "% sobre venta", honorariosValor: "3",
      mConstruidos: "321", mUtiles: "298,5", mTerraza: "12", anio: "1940",
      alturas: "6", dormitorios: "4", banos: "2", aseos: "1", salon: "34", cocinaM: "14",
      equipamiento: ["Armarios empotrados", "Trastero", "Balcón"],
      ventanaMat: "Climalit", ventanaApertura: "Oscilobatientes", puertas: "Macizas",
      suelos: "Tarima", cocinaTipo: "Independiente", fuegos: "Inducción",
      acs: "Gas natural", clima: "A/A Splits", calefaccion: "Gas", paredes: "Lisas",
      ascensor: "Sí", cotaCero: "Sí", conserjeria: "Sí", fachada: "Piedra",
      estado: "Buen estado", orientacion: "Sur",
      vistas: ["Despejadas"], servicios: ["Metro/Bus", "Supermercado", "Colegios"],
      notasInternas: `${MARCA} Ficha de ejemplo para la formación. Los propietarios son inventados. Firmada la exclusiva el 28/08; el propietario tiene prisa por vender.`,
      descripcionPublica:
        "Amplia vivienda señorial en pleno centro, con 321 m² construidos, cuatro dormitorios y balcón a Calle Colón. Finca con ascensor y conserjería.",
    },
  },
  {
    diasAtras: 4,
    agenteId: "mavi-castillo",
    agenteName: "Mavi Castillo Esteban",
    estado: "publicada",
    propietarios: [{ nombre: "Josep Marí Tormo", telefono: "622110099", dni: "11111111H", email: "" }],
    data: {
      operacion: "Venta", tipo: "Casa / Chalet", referencia: "#05620",
      direccion: "Cami de Vera", numero: "88",
      poblacion: "Alboraya", provincia: "Valencia", cp: "46120",
      suelo: "Urbano", cee: "Pendiente", cargas: "No", ocupacion: "Libre",
      autorizacion: "Sí", exclusiva: "Sin exclusiva",
      docs: ["DNI", "Escritura"],
      precio: "545.000", precioMin: "520.000", ibi: "890",
      honorarios: "Importe fijo", honorariosValor: "15000",
      mConstruidos: "245", mUtiles: "218", mParcela: "450,5", mTerraza: "35",
      anio: "2004", dormitorios: "4", banos: "3", aseos: "1", salon: "42", cocinaM: "16",
      equipamiento: ["Garaje", "Piscina", "Jardín", "Armarios empotrados"],
      ventanaMat: "PVC", ventanaApertura: "Oscilobatientes", puertas: "Roble/Haya",
      suelos: "Porcelánico", cocinaTipo: "Abierta", fuegos: "Inducción",
      acs: "Aerotermia", clima: "Conductos", calefaccion: "Suelo radiante", paredes: "Lisas",
      cotaCero: "Sí", fachada: "Monocapa", estado: "Para entrar", orientacion: "Sur",
      vistas: ["Despejadas"], servicios: ["Colegios", "Supermercado", "Parques"],
      notasInternas: `${MARCA} Ficha de ejemplo para la formación. Propietario inventado. Publicada en portales el 30/08. Visitas solo por la tarde.`,
      descripcionPublica:
        "Chalet independiente de 245 m² en parcela de 450 m² con piscina y jardín. Cuatro dormitorios, suelo radiante y aerotermia. Listo para entrar a vivir.",
    },
  },
  {
    diasAtras: 11,
    agenteId: "fede-carbonell",
    agenteName: "Fede Carbonell",
    estado: "descartada",
    propietarios: [{ nombre: "Inmuebles Túria S.L.", telefono: "963111222", dni: "", email: "" }],
    data: {
      operacion: "Alquiler", tipo: "Local", referencia: "#05621",
      direccion: "Avenida del Puerto", numero: "145",
      poblacion: "Valencia", provincia: "Valencia", cp: "46022",
      suelo: "Urbano", cee: "Exento", cargas: "No", ocupacion: "Libre",
      autorizacion: "No",
      precio: "1.850", ibi: "1.240",
      honorarios: "Pendiente",
      mConstruidos: "180", mUtiles: "165", anio: "1978",
      escaparate: "8", salidaHumos: "Sí",
      ventanaMat: "Aluminio", suelos: "Gres", acs: "Termo eléctrico", clima: "A/A Splits",
      cotaCero: "Sí", fachada: "Pintada", estado: "A reformar", orientacion: "Este",
      suministros: ["Agua", "Luz", "Alcantarillado"],
      servicios: ["Metro/Bus", "Supermercado"],
      notasInternas: `${MARCA} Ficha de ejemplo para la formación. El propietario pedía un alquiler muy por encima de mercado y no acepta bajarlo. Se descarta, pero conviene volver a llamar en tres meses.`,
      descripcionPublica: "Local comercial de 180 m² a pie de calle en Avenida del Puerto, con 8 metros de escaparate y salida de humos.",
    },
  },
];

const sql = neon(process.env.DATABASE_URL);

if (process.argv.includes("--borrar")) {
  const filas = await sql`
    delete from fichas
    where datos->>'notasInternas' like ${"%" + MARCA + "%"}
    returning id, direccion
  `;
  console.log(filas.length ? `${filas.length} ficha(s) de prueba borradas:` : "No había fichas de prueba.");
  filas.forEach((f) => console.log("  ·", f.direccion));
  process.exit(0);
}

console.log("Insertando fichas de ejemplo…\n");
let fallos = 0;

for (const e of EJEMPLOS) {
  const cuando = new Date(Date.now() - (e.diasAtras ?? 0) * 86400000 - 3 * 3600000);
  const ficha = {
    id: randomUUID(),
    creada: cuando.toISOString(),
    agenteId: e.agenteId,
    agenteName: e.agenteName,
    propietarios: e.propietarios,
    data: e.data,
  };

  const r = await enviar(ficha);
  if (r.code !== 200) {
    console.error(`  ✗ ${e.data.direccion}: ${JSON.stringify(r.body)}`);
    fallos += 1;
    continue;
  }

  /* La fecha de recepción la pone la base de datos; para la demostración
     interesa que el listado no salga todo con la misma hora. */
  if (e.diasAtras) {
    await sql`update fichas set recibida_en = ${cuando.toISOString()} where id = ${ficha.id}`;
  }

  /* Estados variados para poder probar los filtros del panel. */
  if (e.estado !== "nueva") {
    const ru = res();
    await actualizar(sql, { id: ficha.id, estado: e.estado }, ru, {
      email: "julia@inmobiliariapalanca.com",
    });
    if (ru.code && ru.code !== 200) console.error("    (no se pudo fijar el estado)", ru.body);
  }

  const cuandoTxt = e.diasAtras ? `hace ${e.diasAtras} días` : "hoy";
  console.log(`  ✓ ${e.data.tipo.padEnd(14)} ${(e.data.direccion + " " + e.data.numero).padEnd(26)} ${e.estado.padEnd(11)} ${cuandoTxt.padEnd(12)} ${e.agenteName}`);
}

const [{ n }] = await sql`select count(*)::int as n from fichas`;
console.log(`\n${n} ficha(s) en la base de datos.`);
console.log("Para borrarlas:  npm run db:prueba:borrar");
process.exit(fallos ? 1 : 0);
