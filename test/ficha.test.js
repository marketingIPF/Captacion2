import { test } from "node:test";
import assert from "node:assert/strict";
import { validarDni, validarTelefono, validarCp, limpiarNumero, parseNumero } from "../src/lib/validacion.js";

test("DNI: acepta válidos y rechaza letra incorrecta", () => {
  assert.equal(validarDni("12345678Z"), "");
  assert.equal(validarDni("X1234567L"), "");
  assert.match(validarDni("12345678A"), /letra/i);
  assert.match(validarDni("1234"), /no válido/i);
  assert.equal(validarDni(""), "", "vacío es válido: el campo es opcional");
});

test("Teléfono: 9 dígitos empezando por 6/7/8/9", () => {
  assert.equal(validarTelefono("612345678"), "");
  assert.equal(validarTelefono("+34 612 345 678"), "");
  assert.match(validarTelefono("12345678"), /no válido/i);
});

test("Código postal: 5 dígitos con provincia existente", () => {
  assert.equal(validarCp("46020"), "");
  assert.match(validarCp("4602"), /5 dígitos/);
  assert.match(validarCp("99000"), /inexistente/);
});

test("Números: los decimales sobreviven", () => {
  assert.equal(limpiarNumero("85,5"), "85,5");
  assert.equal(limpiarNumero("85.5"), "855", "el punto es separador de miles, no decimal");
  assert.equal(limpiarNumero("1a2b,3c4"), "12,34");
  assert.equal(limpiarNumero("1.234,56"), "1234,56", "el punto es separador de miles");
  assert.equal(limpiarNumero("85,5"), "85,5", "la coma es el decimal");
  assert.equal(limpiarNumero("250.000"), "250000");
  assert.equal(limpiarNumero("1.234.567"), "1234567");
  assert.equal(parseNumero("85,5"), 85.5);
  assert.equal(parseNumero("250.000"), 250000);
  assert.equal(parseNumero(""), null);
});
