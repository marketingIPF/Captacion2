import { test } from "node:test";
import assert from "node:assert/strict";
import webpush from "web-push";
import { sujetoVapid } from "../api/_push.js";

test("el sujeto VAPID se completa aunque se configure el correo a secas", () => {
  /* El caso real: en Vercel se guardó "marketing@..." sin el mailto: y
     web-push tiraba en cada llamada, así que /api/push devolvía 500. */
  assert.equal(sujetoVapid("marketing@inmobiliariapalanca.com"), "mailto:marketing@inmobiliariapalanca.com");
  assert.equal(sujetoVapid(" marketing@inmobiliariapalanca.com "), "mailto:marketing@inmobiliariapalanca.com");
  assert.equal(sujetoVapid("captacion2.vercel.app"), "https://captacion2.vercel.app");
});

test("un sujeto ya válido se respeta tal cual", () => {
  assert.equal(sujetoVapid("mailto:info@rk.com"), "mailto:info@rk.com");
  assert.equal(sujetoVapid("https://captacion2.vercel.app"), "https://captacion2.vercel.app");
  assert.match(sujetoVapid(""), /^mailto:/, "sin configurar, un valor por defecto usable");
});

test("web-push acepta todo lo que sale de sujetoVapid", () => {
  /* La comprobación de verdad: que la librería no rechace ninguna de las
     formas que toleramos. Sin esto la prueba solo mediría mi suposición. */
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  for (const v of ["marketing@inmobiliariapalanca.com", "captacion2.vercel.app", "mailto:info@rk.com", ""]) {
    assert.doesNotThrow(
      () => webpush.setVapidDetails(sujetoVapid(v), publicKey, privateKey),
      `web-push rechazó el sujeto derivado de «${v}»`
    );
  }
});
