import { test } from "node:test";
import assert from "node:assert/strict";
import { emailAutorizado, tokenDe } from "../api/_jwt.js";

test("la lista de acceso admite emails sueltos", () => {
  const lista = "julia@empresa.com, roberto@empresa.com";
  assert.equal(emailAutorizado("julia@empresa.com", lista), true);
  assert.equal(emailAutorizado("JULIA@EMPRESA.COM", lista), true, "no distingue mayúsculas");
  assert.equal(emailAutorizado(" julia@empresa.com ", lista), true, "tolera espacios");
  assert.equal(emailAutorizado("otro@empresa.com", lista), false);
});

test("la lista de acceso admite un dominio entero", () => {
  const lista = "@inmobiliariapalanca.com";
  assert.equal(emailAutorizado("julia@inmobiliariapalanca.com", lista), true);
  assert.equal(emailAutorizado("cualquiera@gmail.com", lista), false);
});

test("un dominio parecido no cuela", () => {
  const lista = "@empresa.com";
  assert.equal(emailAutorizado("ataque@noempresa.com", lista), false, "sufijo que no es el dominio");
  assert.equal(emailAutorizado("empresa.com", lista), false, "sin arroba");
});

test("sin lista configurada no entra nadie", () => {
  assert.equal(emailAutorizado("julia@empresa.com", ""), false);
  assert.equal(emailAutorizado("julia@empresa.com", undefined), false);
  assert.equal(emailAutorizado(null, "@empresa.com"), false);
});

test("extrae el token de la cabecera Authorization", () => {
  assert.equal(tokenDe({ headers: { authorization: "Bearer abc.def.ghi" } }), "abc.def.ghi");
  assert.equal(tokenDe({ headers: { authorization: "bearer abc" } }), "abc", "no distingue mayúsculas");
  assert.equal(tokenDe({ headers: { authorization: "Basic abc" } }), null, "solo Bearer");
  assert.equal(tokenDe({ headers: { authorization: "Bearer   " } }), null, "token vacío");
  assert.equal(tokenDe({ headers: {} }), null);
});

test("una errata en NEON_AUTH_BASE_URL no deja el panel inservible", async () => {
  const previos = [process.env.NEON_AUTH_BASE_URL, process.env.NEON_AUTH_JWKS_URL];
  /* Exactamente el fallo que tuvimos: la "h" perdida al pegar en Vercel. */
  process.env.NEON_AUTH_BASE_URL = "ttps://ep-x.neonauth.eu.aws.neon.tech/neondb/auth";
  process.env.NEON_AUTH_JWKS_URL = "https://ep-x.neonauth.eu.aws.neon.tech/neondb/auth/.well-known/jwks.json";

  const { emisoresValidos } = await import("../api/_jwt.js");
  const lista = emisoresValidos();
  assert.ok(lista.includes("https://ep-x.neonauth.eu.aws.neon.tech"), "el origen sale del JWKS");
  assert.ok(
    lista.includes("https://ep-x.neonauth.eu.aws.neon.tech/neondb/auth"),
    "y también la base derivada del JWKS"
  );
  assert.ok(!lista.some((e) => e.startsWith("ttps")), "no cuela el valor con errata");
  assert.ok(!lista.includes("null"), "ni el origen 'null' de una URL inválida");

  [process.env.NEON_AUTH_BASE_URL, process.env.NEON_AUTH_JWKS_URL] = previos;
});

test("con las dos variables bien, se aceptan base y origen", async () => {
  const previos = [process.env.NEON_AUTH_BASE_URL, process.env.NEON_AUTH_JWKS_URL];
  process.env.NEON_AUTH_BASE_URL = "https://ep-x.neonauth.eu.aws.neon.tech/neondb/auth";
  process.env.NEON_AUTH_JWKS_URL = "https://ep-x.neonauth.eu.aws.neon.tech/neondb/auth/.well-known/jwks.json";

  const { emisoresValidos } = await import("../api/_jwt.js");
  const lista = emisoresValidos();
  assert.ok(lista.includes("https://ep-x.neonauth.eu.aws.neon.tech/neondb/auth"));
  assert.ok(lista.includes("https://ep-x.neonauth.eu.aws.neon.tech"), "el iss real que emite Better Auth");

  [process.env.NEON_AUTH_BASE_URL, process.env.NEON_AUTH_JWKS_URL] = previos;
});
