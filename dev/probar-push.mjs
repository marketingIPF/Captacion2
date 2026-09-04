/* Comprueba la cadena de push sin navegador: registra una suscripción falsa,
   intenta enviarle un aviso y verifica que un endpoint muerto se limpia solo.
   Uso:  node --env-file=.env dev/probar-push.mjs                            */
import { neon } from "@neondatabase/serverless";
import { createECDH, randomBytes } from "node:crypto";
import { guardarSuscripcion, borrarSuscripcion, notificar, pushDisponible } from "../api/_push.js";

/* Una suscripción de mentira pero criptográficamente válida: con claves
   inventadas, web-push falla al cifrar y nunca llega a hablar con el servicio
   de push, así que no se probaría lo que interesa. */
function clavesDeMentira() {
  const ec = createECDH("prime256v1");
  ec.generateKeys();
  return {
    p256dh: ec.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

const sql = neon(process.env.DATABASE_URL);
let fallos = 0;
const ok = (n, c, d = "") => { console.log(`${c ? "  ✓" : "  ✗"} ${n}${c ? "" : "  → " + d}`); if (!c) fallos++; };

console.log("— Configuración —");
ok("las claves VAPID están puestas", pushDisponible());

console.log("\n— Alta de suscripción —");
const falsa = {
  endpoint: "https://fcm.googleapis.com/fcm/send/PRUEBA-" + Date.now(),
  keys: clavesDeMentira(),
};
let r = await guardarSuscripcion({ tipo: "agente", destinatario: "prueba-agente", suscripcion: falsa });
ok("se guarda", r.ok, JSON.stringify(r));

const [{ n }] = await sql`select count(*)::int n from suscripciones_push where destinatario = 'prueba-agente'`;
ok("consta una fila", n === 1, `hay ${n}`);

/* Repetir el alta no debe duplicar: el endpoint es la clave. */
await guardarSuscripcion({ tipo: "agente", destinatario: "prueba-agente", suscripcion: falsa });
const [{ n: n2 }] = await sql`select count(*)::int n from suscripciones_push where destinatario = 'prueba-agente'`;
ok("volver a suscribirse no duplica", n2 === 1, `hay ${n2}`);

r = await guardarSuscripcion({ tipo: "agente", destinatario: "x", suscripcion: { endpoint: "e" } });
ok("una suscripción incompleta se rechaza", !r.ok, JSON.stringify(r));

console.log("\n— Envío —");
/* El endpoint es inventado: el servicio de push responderá con un error, y lo
   que se comprueba es que eso no revienta y que la fila muerta se limpia. */
const res = await notificar({
  tipo: "agente", destinatario: "prueba-agente",
  titulo: "Publicada", cuerpo: "#05619", url: "/", etiqueta: "prueba",
});
ok("notificar() no lanza aunque el endpoint no exista", true);
console.log(`    enviadas: ${res.enviadas} · caducadas limpiadas: ${res.caducadas ?? 0}`);

const [{ n: n3 }] = await sql`select count(*)::int n from suscripciones_push where destinatario = 'prueba-agente'`;
ok("un endpoint muerto se borra solo", n3 === 0 || res.enviadas > 0, `quedan ${n3}`);

console.log("\n— Sin destinatario: a todos los de un tipo —");
const res2 = await notificar({ tipo: "oficina", titulo: "Nueva captación", cuerpo: "prueba" });
ok("no lanza sin suscripciones", typeof res2.enviadas === "number");

await sql`delete from suscripciones_push where destinatario = 'prueba-agente'`;
await borrarSuscripcion(falsa.endpoint);
const [{ n: n4 }] = await sql`select count(*)::int n from suscripciones_push`;
console.log(`\nSuscripciones reales en la base: ${n4}`);

process.exit(fallos ? 1 : 0);
