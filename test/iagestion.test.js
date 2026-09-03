import { test } from "node:test";
import assert from "node:assert/strict";
import { fichaAInmueble, propietarioAContacto, partirNombre, refIntranet, TIPOS } from "../api/_iagestion.js";

const base = (data = {}, propietarios = [{ nombre: "Carmen Ferrer Ros", telefono: "666 55 44 33" }]) => ({
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  creada: "2026-09-01T10:00:00.000Z",
  agenteName: "Eva Vallés",
  propietarios,
  data: { operacion: "Venta", tipo: "Piso", direccion: "Calle Colón", ...data },
});

test("los cinco campos obligatorios del CRM salen siempre", () => {
  const { ok, faltan, datos } = fichaAInmueble(base());
  assert.equal(ok, true, `faltan: ${faltan}`);
  for (const k of ["Ref_Intranet", "Tipo", "Estado", "Operacion", "Direccion"]) {
    assert.ok(datos[k], `falta ${k}`);
  }
  assert.equal(datos.Estado, "Disponible", "una captación nueva entra como disponible");
});

test("sin dirección no se envía: el CRM lo rechazaría con un 400", () => {
  const f = base();
  delete f.data.direccion;
  const r = fichaAInmueble(f);
  assert.equal(r.ok, false);
  assert.ok(r.faltan.includes("Direccion"));
});

test("los números en formato español se convierten a los suyos", () => {
  const { datos } = fichaAInmueble(base({
    precio: "385.000", mUtiles: "298,5", mConstruidos: "321", anio: "1940", planta: "02", dormitorios: "4",
  }));
  assert.equal(datos.Precio, 385000, "su Precio es entero");
  assert.equal(datos.Metros_Utiles, 298.5, "los decimales sobreviven");
  assert.equal(datos.Metros_Construidos, 321);
  assert.equal(datos.Antiguedad, 1940);
  assert.equal(datos.Planta, 2, "'02' es la planta 2");
  assert.equal(datos.Dormitorios, 4);
});

test("el teléfono va sin espacios, como pide el CRM", () => {
  const { datos } = fichaAInmueble(base());
  assert.equal(datos.Telefono_contacto, "666554433");
});

test("el nombre se parte en nombre y apellidos", () => {
  assert.deepEqual(partirNombre("Carmen Ferrer Ros"), { Nombre: "Carmen", Apellidos: "Ferrer Ros" });
  assert.deepEqual(partirNombre("Josep"), { Nombre: "Josep", Apellidos: "" });
  assert.deepEqual(partirNombre("  "), { Nombre: "", Apellidos: "" });
  assert.deepEqual(partirNombre("Inmuebles Túria S.L."), { Nombre: "Inmuebles", Apellidos: "Túria S.L." });
});

test("nuestras etiquetas se convierten en los 0/1 y contadores del CRM", () => {
  const { datos } = fichaAInmueble(base({
    ascensor: "Sí",
    equipamiento: ["Garaje", "Trastero", "Piscina"],
    vistas: ["Al mar"],
  }));
  assert.equal(datos.Ascensor, 1, "'Sí' es un ascensor");
  assert.equal(datos.Garaje, 1);
  assert.equal(datos.Trastero, 1);
  assert.equal(datos.Piscina, 1);
  assert.equal(datos.CheckVistasMar, 1);
  assert.equal(datos.Terraza, 0, "lo que no está marcado va explícitamente a 0");
});

test("un ático se marca además con es_atico", () => {
  assert.equal(fichaAInmueble(base({ tipo: "Ático" })).datos.es_atico, 1);
  assert.equal(fichaAInmueble(base({ tipo: "Piso" })).datos.es_atico, undefined);
});

test("un tipo sin equivalencia avisa en vez de colarse en silencio", () => {
  const r = fichaAInmueble(base({ tipo: "Nave industrial" }));
  assert.ok(r.avisos.some((a) => a.includes("Nave industrial")));
  assert.equal(r.datos.Tipo, "Nave industrial", "se envía tal cual, pero avisado");
  /* Y los seis nuestros sí tienen equivalencia declarada. */
  for (const t of ["Piso", "Ático", "Casa / Chalet", "Local", "Terreno", "Garaje"]) {
    assert.ok(TIPOS[t], `sin equivalencia para ${t}`);
  }
});

test("la referencia evita duplicados y es estable", () => {
  const f = base({ referencia: "REF-2041" });
  assert.equal(refIntranet(f), "REF-2041", "se respeta la referencia de la agencia");
  const sinRef = base();
  assert.equal(refIntranet(sinRef), refIntranet(sinRef), "sin referencia, deriva del id y no cambia");
  assert.match(refIntranet(sinRef), /^RK-[0-9A-F]{10}$/);
});

test("varios propietarios: avisa y prepara los contactos de más", () => {
  const f = base({}, [
    { nombre: "Carmen Ferrer Ros", telefono: "666554433" },
    { nombre: "Vicente Ferrer Ros", telefono: "610223344", dni: "87654321X" },
  ]);
  const r = fichaAInmueble(f);
  assert.ok(r.avisos.some((a) => a.includes("más de un propietario")));
  assert.equal(r.datos.Nombre_contacto, "Carmen", "el primero va en la misma llamada");

  const c = propietarioAContacto(f.propietarios[1], f);
  assert.equal(c.ok, true);
  assert.equal(c.datos.Movil, "610223344");
  assert.equal(c.datos.CIF_NIF, "87654321X");
});

test("un contacto sin móvil ni email no se puede grabar", () => {
  assert.equal(propietarioAContacto({ nombre: "Solo Nombre" }, base()).ok, false);
  assert.equal(propietarioAContacto({ nombre: "X", email: "x@y.com" }, base()).ok, true);
});

test("lo que el CRM no tiene como campo no se pierde: va a observaciones privadas", () => {
  const { datos } = fichaAInmueble(base({
    refCatastral: "6121104YJ2762A0003RL",
    cargas: "Hipoteca", cargasDetalle: "Pendiente 78.000 € con Sabadell",
    precioMin: "365.000", notasInternas: "Tiene prisa por vender.",
  }));
  const p = datos.Observaciones_Privadas;
  assert.match(p, /Tiene prisa por vender/);
  assert.match(p, /6121104YJ2762A0003RL/, "la referencia catastral no se tira");
  assert.match(p, /Sabadell/, "ni el detalle de las cargas");
  assert.match(p, /365\.000/, "ni el precio mínimo");
  assert.match(p, /Captada por Eva Vallés/, "y queda quién la captó");
});

test("no se envían campos vacíos", () => {
  const { datos } = fichaAInmueble(base());
  for (const [k, v] of Object.entries(datos)) {
    assert.ok(v !== "" && v !== null && v !== undefined, `${k} va vacío`);
  }
});
