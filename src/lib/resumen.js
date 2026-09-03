import { SECCIONES } from "../data/secciones.js";
import { camposAplicables, resumenFicha } from "./ficha.js";
import { fmtFecha, fmtPrecio, fmtNumero } from "./format.js";

const valorLegible = (f, v) => {
  if (Array.isArray(v)) return v.join(", ");
  if (f.kind === "num") return fmtNumero(v, f.unidad === "€" ? "" : f.unidad || "");
  return String(v);
};

const tieneValor = (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/* Devuelve [{ titulo, filas: [[etiqueta, valor]] }] — la misma estructura
   alimenta el texto plano y el HTML, para que nunca se desincronicen. */
export function bloquesFicha(ficha) {
  const d = ficha.data;
  const bloques = [];

  const propietarios = ficha.propietarios
    .filter((p) => p.nombre || p.telefono)
    .map((p, i) => [
      `Propietario ${i + 1}`,
      [p.nombre || "—", p.telefono && `Tel: ${p.telefono}`, p.dni && `DNI: ${p.dni}`, p.email]
        .filter(Boolean)
        .join(" · "),
    ]);
  if (propietarios.length) bloques.push({ titulo: "Propietarios", filas: propietarios });

  SECCIONES.forEach((sec) => {
    const filas = [];
    camposAplicables(sec, d).forEach((f) => {
      const v = f.kind === "tipo" ? d.tipo : d[f.key];
      if (!tieneValor(v)) return;
      const etiqueta = f.kind === "num" && f.unidad === "€" ? `${f.label} (€)` : f.label;
      filas.push([etiqueta, valorLegible(f, v)]);
    });
    if (filas.length) bloques.push({ titulo: sec.title, filas });
  });

  return bloques;
}

export function tituloFicha(ficha) {
  const d = ficha.data;
  return `${d.tipo || "Inmueble"} · ${resumenFicha(ficha)}`;
}

export function textoFicha(ficha) {
  const L = [
    "FICHA DE CAPTACIÓN · RK PALANCA FONTESTAD",
    "=========================================",
    `Agente captador: ${ficha.agenteName}`,
    `Fecha: ${fmtFecha(ficha.fecha)}`,
    `Operación: ${ficha.data.operacion || "—"} · Precio: ${fmtPrecio(ficha.data.precio)}`,
    "",
  ];
  bloquesFicha(ficha).forEach((b) => {
    L.push(`— ${b.titulo.toUpperCase()} —`);
    b.filas.forEach(([k, v]) => L.push(`  ${k}: ${v}`));
    L.push("");
  });
  return L.join("\n");
}
