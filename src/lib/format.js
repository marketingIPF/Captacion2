import { parseNumero } from "./validacion.js";

export const fmtFecha = (iso) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/* Solo el día, sin hora. */
export const fmtDia = (iso) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

/* Cuándo entró una captación, escrito con la precisión que de verdad se sabe.

   De una que llega del móvil se sabe el minuto. De una que teclea la oficina
   solo se sabe el día: el formulario pide una fecha y nada más. Guardarla al
   mediodía y luego pintar esa hora hacía que todas las que añadió Julia una
   mañana salieran "a las 14:00", una hora que no había ocurrido todavía.

   La regla vive aquí y no en cada pantalla para que el listado, la ficha, el
   CSV y el papel no puedan discrepar. */
export const fechaDeFicha = (f) => {
  const cuando = f?.recibida ?? f?.fecha;
  if (!cuando) return "";
  return f?.origen === "oficina" ? fmtDia(cuando) : fmtFecha(cuando);
};

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

/* Los avatares se generan como public/avatars/<id del agente>.webp
   (npm run avatares). El panel solo recibe el id, así que la convención vive
   aquí y no duplicada en cada sitio que la necesite. */
export const rutaAvatar = (id) => (id ? `/avatars/${id}.webp` : null);

export const iniciales = (nombre = "") =>
  nombre.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* Nombre corto de quien usa el panel, para caber en una celda del listado.

   La sesión trae el nombre de Google cuando existe y, si no, el propio correo.
   De un nombre se coge el primero ("Julia Pérez" → "Julia") y de un correo la
   parte de delante de la arroba ("info@..." → "Info"), porque escribir
   "Añadida manualmente por info@inmobiliariapalanca.com" en una columna no
   cabe ni se lee. */
export function nombreCorto(nombreOEmail) {
  const v = String(nombreOEmail ?? "").trim();
  if (!v) return "";
  const base = v.includes("@") ? v.split("@")[0].replace(/[._-]+/g, " ").trim() : v;
  const primero = base.split(/\s+/)[0] || "";
  return primero ? primero[0].toUpperCase() + primero.slice(1) : "";
}
