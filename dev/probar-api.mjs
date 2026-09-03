/* Ejercita los endpoints reales contra la Neon de verdad, sin navegador.
   Uso:  node --env-file=.env dev/probar-api.mjs                            */
import { randomUUID } from "node:crypto";
import agentes from "../api/agentes.js";
import fichas from "../api/fichas.js";
import admin, { listar, detalle, actualizar, resumen } from "../api/admin.js";

const PIN = process.env.PIN_ACCESO;
let fallos = 0;

const res = () => {
  const r = { headers: {}, code: null, body: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; r.listo?.(); return r; };
  return r;
};
const llamar = async (handler, body, ip = "127.0.0.1", cabeceras = {}) => {
  const r = res();
  const espera = new Promise((ok) => { r.listo = ok; });
  await Promise.resolve(handler({ method: "POST", body, headers: { "x-forwarded-for": ip, ...cabeceras }, socket: {} }, r));
  await Promise.race([espera, new Promise((ok) => setTimeout(ok, 8000))]);
  return r;
};
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${nombre}${cond ? "" : "  → " + detalle}`);
  if (!cond) fallos++;
};

const id = randomUUID();
const ficha = {
  id,
  creada: new Date().toISOString(),
  agenteId: "lorena-lull",
  agenteName: "Lorena Lull",
  propietarios: [{ nombre: "Prueba Automática", telefono: "600111222", dni: "", email: "" }],
  data: {
    operacion: "Venta", tipo: "Ático", direccion: "Calle de Prueba", numero: "1",
    poblacion: "Valencia", provincia: "Valencia", cp: "46001", precio: "199.500",
    mConstruidos: "88,5", dormitorios: "3",
  },
};

console.log("\n— Agentes —");
let r = await llamar(agentes, { pin: "incorrecto" }, "10.0.0.1");
comprobar("PIN incorrecto → 401", r.code === 401, `dio ${r.code}`);
r = await llamar(agentes, { pin: PIN });
comprobar("PIN correcto devuelve la lista", r.code === 200 && Array.isArray(r.body?.agentes), JSON.stringify(r.body).slice(0, 90));
comprobar("son 20 agentes", r.body?.agentes?.length === 20, `hay ${r.body?.agentes?.length}`);

console.log("\n— Guardar ficha —");
r = await llamar(fichas, { pin: PIN, ficha });
comprobar("guarda y devuelve id", r.code === 200 && r.body?.id === id, JSON.stringify(r.body).slice(0, 120));
r = await llamar(fichas, { pin: PIN, ficha });
comprobar("reenviar la misma no duplica (idempotente)", r.code === 200, JSON.stringify(r.body).slice(0, 120));
r = await llamar(fichas, { pin: PIN, ficha: { ...ficha, id: "no-es-uuid" } });
comprobar("rechaza id inválido → 400", r.code === 400, `dio ${r.code}`);

console.log("\n— Panel: la puerta —");
r = await llamar(admin, { accion: "listar" }, "10.0.0.2");
comprobar("sin sesión → 401", r.code === 401, `dio ${r.code}`);
r = await llamar(admin, { accion: "listar" }, "10.0.0.3");
comprobar("no filtra nada al rechazar", !r.body?.fichas, JSON.stringify(r.body));

/* Un token inventado debe caer en la verificación de firma, no colarse. */
const falso = ["eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9",
  Buffer.from(JSON.stringify({ sub: "x", email: "intruso@gmail.com", exp: Math.floor(Date.now()/1e3)+3600 })).toString("base64url"),
  "firmaInventada"].join(".");
r = await llamar(admin, { accion: "listar" }, "10.0.0.4", { authorization: `Bearer ${falso}` });
comprobar("token con firma falsa → 401", r.code === 401, `dio ${r.code} ${JSON.stringify(r.body)}`);

console.log("\n— Panel: las consultas —");
const { neon: neonSql } = await import("@neondatabase/serverless");
const sqlDirecto = neonSql(process.env.DATABASE_URL);
const usuario = { email: "julia@inmobiliariapalanca.com" };
const capturar = () => { const o = res(); o.listo = () => {}; return o; };

let o = capturar();
await listar(sqlDirecto, { busqueda: "Calle de Prueba" }, o);
comprobar("la encuentra por dirección", o.body?.total >= 1, JSON.stringify(o.body).slice(0, 140));
comprobar("no hay duplicados del mismo id", o.body?.fichas?.filter((f) => f.id === id).length === 1);
comprobar("el listado NO expone al propietario",
  !JSON.stringify(o.body).includes("Prueba Automática") && !JSON.stringify(o.body).includes("600111222"));

o = capturar();
await detalle(sqlDirecto, { id }, o);
comprobar("el detalle sí trae al propietario", o.body?.ficha?.propietarios?.[0]?.nombre === "Prueba Automática");
comprobar("los decimales sobreviven a Postgres", o.body?.ficha?.data?.mConstruidos === "88,5", o.body?.ficha?.data?.mConstruidos);

o = capturar();
await actualizar(sqlDirecto, { id, estado: "publicada", nota: "Prueba" }, o, usuario);
comprobar("cambia el estado a publicada", o.body?.ficha?.estado === "publicada", JSON.stringify(o.body).slice(0, 120));
comprobar("registra quién lo tocó", o.body?.ficha?.actualizada_por === usuario.email, o.body?.ficha?.actualizada_por);

o = capturar();
await actualizar(sqlDirecto, { id, estado: "en_curso" }, o, usuario);
comprobar("rechaza el estado eliminado 'en_curso' → 400", o.code === 400, `dio ${o.code}`);

o = capturar();
await resumen(sqlDirecto, o, usuario);
comprobar("el resumen responde", typeof o.body?.totales?.total === "number", JSON.stringify(o.body).slice(0, 140));

console.log("\n— Limpieza —");
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
await sql`delete from fichas where id = ${id}`;
const [{ n }] = await sql`select count(*)::int as n from fichas where id = ${id}`;
comprobar("ficha de prueba eliminada", n === 0);

console.log(fallos ? `\n${fallos} comprobaciones fallaron\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
