import { SECCIONES } from "../data/secciones.js";
import { validarCampo, validarDni, validarTelefono, parseNumero } from "./validacion.js";

export const nuevoId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `F${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const fichaVacia = (agente) => ({
  id: nuevoId(),
  agenteId: agente?.id || "",
  agenteName: agente?.name || "",
  creada: new Date().toISOString(),
  fecha: new Date().toISOString(),
  propietarios: [{ nombre: "", telefono: "", dni: "", email: "" }],
  data: {},
});

/* ---- Aplicabilidad: un campo solo existe si su tipo y sus dependencias cuadran ---- */

export function seccionAplica(sec, data) {
  if (sec.tipos && data.tipo && !sec.tipos.includes(data.tipo)) return false;
  return true;
}

export function campoAplica(field, data) {
  if (field.tipos && (!data.tipo || !field.tipos.includes(data.tipo))) return false;
  if (field.when && !field.when(data)) return false;
  return true;
}

export function camposAplicables(sec, data) {
  if (!seccionAplica(sec, data)) return [];
  return sec.fields.filter((f) => campoAplica(f, data));
}

const tieneValor = (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/* ---- Progreso sobre campos aplicables, no sobre los 80 del esquema ---- */
export function calcularProgreso(ficha) {
  const d = ficha.data;
  let total = 0;
  let hechos = 0;
  SECCIONES.forEach((sec) => {
    camposAplicables(sec, d).forEach((f) => {
      total += 1;
      if (f.kind === "tipo" ? !!d.tipo : tieneValor(d[f.key])) hechos += 1;
    });
  });
  /* Los propietarios cuentan como un campo más. */
  total += 1;
  if (ficha.propietarios.some((p) => p.nombre?.trim())) hechos += 1;
  return total === 0 ? 0 : Math.round((hechos / total) * 100);
}

/* ---- Qué falta o está mal para poder enviar ---- */
export function revisarFicha(ficha) {
  const d = ficha.data;
  const errores = [];

  SECCIONES.forEach((sec) => {
    camposAplicables(sec, d).forEach((f) => {
      const v = f.kind === "tipo" ? d.tipo : d[f.key];
      if (f.required && !tieneValor(v)) {
        errores.push({ sec: sec.id, campo: f.key, msg: `Falta ${f.label.toLowerCase()}` });
        return;
      }
      if (f.validate && tieneValor(v)) {
        const msg = validarCampo(f.validate, v, d);
        if (msg) errores.push({ sec: sec.id, campo: f.key, msg: `${f.label}: ${msg}` });
      }
    });
  });

  if (!ficha.propietarios.some((p) => p.nombre?.trim())) {
    errores.push({ sec: "ident", campo: "propietarios", msg: "Falta el nombre de un propietario" });
  }
  if (!ficha.propietarios.some((p) => p.telefono?.trim())) {
    errores.push({ sec: "ident", campo: "propietarios", msg: "Falta el teléfono de un propietario" });
  }
  ficha.propietarios.forEach((p, i) => {
    const eTel = validarTelefono(p.telefono);
    if (eTel) errores.push({ sec: "ident", campo: `prop-${i}-telefono`, msg: `Propietario ${i + 1}: ${eTel}` });
    const eDni = validarDni(p.dni);
    if (eDni) errores.push({ sec: "ident", campo: `prop-${i}-dni`, msg: `Propietario ${i + 1}: ${eDni}` });
  });

  return errores;
}

export const resumenFicha = (ficha) => {
  const d = ficha.data;
  const dir = [d.direccion, d.numero].filter(Boolean).join(" ");
  return dir || "Sin dirección";
};

export const precioFicha = (ficha) => parseNumero(ficha.data.precio);
