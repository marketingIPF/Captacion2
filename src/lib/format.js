import { parseNumero } from "./validacion.js";

export const fmtFecha = (iso) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

export const fmtPrecio = (v) => {
  const n = typeof v === "number" ? v : parseNumero(v);
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
};

export const fmtNumero = (v, unidad = "") => {
  const n = parseNumero(v);
  if (n == null) return "—";
  const s = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
  return unidad ? `${s} ${unidad}` : s;
};

export const iniciales = (nombre = "") =>
  nombre.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
