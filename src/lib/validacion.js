/* Validadores. Todos devuelven "" si el valor es válido, o el mensaje de error. */

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

export function validarDni(v) {
  if (!v) return "";
  const s = v.toUpperCase().replace(/[\s-]/g, "");
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(s);
  if (!m) return "Formato de DNI/NIE no válido";
  const prefijo = { X: "0", Y: "1", Z: "2" }[m[1]] ?? "";
  const numero = Number(prefijo + m[2]);
  if (LETRAS_DNI[numero % 23] !== m[3]) return "La letra no corresponde al número";
  return "";
}

export function validarTelefono(v) {
  if (!v) return "";
  const s = v.replace(/[\s+()-]/g, "").replace(/^34/, "");
  if (!/^[6789]\d{8}$/.test(s)) return "Teléfono español no válido (9 dígitos)";
  return "";
}

export function validarCp(v) {
  if (!v) return "";
  if (!/^\d{5}$/.test(v)) return "El código postal tiene 5 dígitos";
  const prov = Number(v.slice(0, 2));
  if (prov < 1 || prov > 52) return "Código postal inexistente";
  return "";
}

export function validarAnio(v) {
  if (!v) return "";
  const n = Number(v);
  const actual = new Date().getFullYear();
  if (!Number.isInteger(n) || n < 1800 || n > actual + 5) return `Año entre 1800 y ${actual + 5}`;
  return "";
}

export function validarRefCatastral(v) {
  if (!v) return "";
  const r = v.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]+$/.test(r)) return "Solo letras y números";
  /* 14 = la parcela; 20 = un inmueble concreto. */
  if (r.length !== 14 && r.length !== 20) return "Tiene 14 caracteres (parcela) o 20 (inmueble)";
  return "";
}

/* La referencia interna de la agencia es "#" + cinco dígitos: #05618.
   Se acepta escrita de cualquier manera razonable (5618, 05618, #5618) y se
   normaliza al salir del campo. */
export function validarReferencia(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (!/^#?\d{1,5}$/.test(s)) return "Formato #00000 (por ejemplo #05618)";
  return "";
}

export function normalizarReferencia(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const m = /^#?(\d{1,5})$/.exec(s);
  if (!m) return s; // si no cuadra, se deja igual y la validación avisa
  return `#${m[1].padStart(5, "0")}`;
}

export function validarEmail(v) {
  if (!v) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Email no válido";
  return "";
}

/* Validadores que necesitan mirar el resto de la ficha. */
const CONTEXTUALES = {
  precioMin: (v, d) => {
    const min = parseNumero(v);
    const pedido = parseNumero(d.precio);
    if (min == null || pedido == null) return "";
    return min > pedido ? "No puede superar el precio solicitado" : "";
  },
};

const SIMPLES = {
  referencia: validarReferencia,
  cp: validarCp,
  anio: validarAnio,
  refCatastral: validarRefCatastral,
  dni: validarDni,
  telefono: validarTelefono,
  email: validarEmail,
};

export function validarCampo(nombre, valor, data) {
  if (!nombre) return "";
  if (CONTEXTUALES[nombre]) return CONTEXTUALES[nombre](valor, data);
  if (SIMPLES[nombre]) return SIMPLES[nombre](valor);
  return "";
}

/* ---- Números con decimales (coma española o punto) ---- */

/* Formato es-ES sin ambigüedad: la coma es el decimal y el punto es separador
   de miles (se descarta). Así "250.000" son doscientos cincuenta mil y no 250,
   y escribir "85,5" m² funciona. El teclado "decimal" en español ofrece coma.
   Se guarda como texto para no pelear con el cursor mientras se escribe. */
export function limpiarNumero(v) {
  const s = String(v).replace(/[^\d.,]/g, "").replace(/\./g, "");
  const [entera, ...resto] = s.split(",");
  return resto.length ? `${entera},${resto.join("").slice(0, 2)}` : entera;
}

export function parseNumero(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
