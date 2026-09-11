import { SECCIONES } from "../data/secciones.js";
import { camposAplicables } from "./ficha.js";
import { fmtPrecio, fmtNumero, fechaDeFicha } from "./format.js";

const valorLegible = (f, v) => {
  if (Array.isArray(v)) return v.join(", ");
  if (f.kind === "num") return fmtNumero(v, f.unidad === "€" ? "" : f.unidad || "");
  return String(v);
};

export const SIN_RELLENAR = "No tiene";

const tieneValor = (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/* Devuelve [{ titulo, filas: [[etiqueta, valor, vacia]] }] — la misma
   estructura alimenta el texto plano y el HTML, para que nunca se desincronicen.

   `vacia` marca las filas de un campo sin rellenar que se muestran de todas
   formas porque el esquema lo pide (`siempre`). Se pintan en pantalla, pero
   NO entran en el texto que se copia: "No tiene" pegado en un campo del CRM
   sería un dato falso. */
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
      const etiqueta = f.kind === "num" && f.unidad === "€" ? `${f.label} (€)` : f.label;
      if (!tieneValor(v)) {
        if (f.siempre) filas.push([etiqueta, SIN_RELLENAR, true]);
        return;
      }
      filas.push([etiqueta, valorLegible(f, v)]);
    });
    /* Un bloque que solo tiene filas vacías no se pinta: sería una sección
       entera para decir que no hay nada. */
    if (filas.some(([, , vacia]) => !vacia)) bloques.push({ titulo: sec.title, filas });
  });

  return bloques;
}

/* Dirección en una sola línea, como la piden los portales y los CRM:
   "Calle Colón 26, Esc. 1, 2ª, pta. 02 · 46004 Valencia". */
export function direccionCompleta(ficha) {
  const d = ficha.data;
  const calle = [d.direccion, d.numero].filter(Boolean).join(" ");
  const interior = [
    d.bloque && `Esc. ${d.bloque}`,
    d.planta && `Pl. ${d.planta}`,
    d.puerta && `Pta. ${d.puerta}`,
  ].filter(Boolean).join(", ");
  const localidad = [d.cp, d.poblacion].filter(Boolean).join(" ");
  return [calle, interior].filter(Boolean).join(", ") + (localidad ? ` · ${localidad}` : "");
}

/* Las cifras que se miran primero, no las que hay que buscar en una lista. */
export function cifrasClave(ficha) {
  const d = ficha.data;
  const puestos = [
    ["M² construidos", d.mConstruidos, "m²"],
    ["M² útiles", d.mUtiles, "m²"],
    ["Parcela", d.mParcela, "m²"],
    ["Dormitorios", d.dormitorios, ""],
    ["Baños", d.banos, ""],
    ["Planta", d.planta, ""],
    ["Año", d.anio, ""],
  ];
  return puestos
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([etiqueta, valor, unidad]) => ({ etiqueta, valor: String(valor), unidad }));
}

/* Un bloque como texto plano, para copiarlo de golpe. */
export function bloqueComoTexto(bloque) {
  return bloque.filas
    .filter(([, , vacia]) => !vacia)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/* Cómo se llama una captación. La agencia la identifica por su referencia
   (#05619), así que esa manda; la dirección solo entra cuando aún no la tiene.
   Acepta tanto una ficha completa (con `data`) como la fila reducida del
   listado, que trae los campos sueltos. */
const refDe = (f) => String(f?.data?.referencia ?? f?.referencia ?? "").trim();

/* Se compone a mano en vez de usar resumenFicha(), que devuelve su propio
   "Sin dirección" y taparía el respaldo de aquí. */
const direccionDe = (f) =>
  [f?.data?.direccion ?? f?.direccion, f?.data?.numero ?? f?.numero]
    .filter(Boolean)
    .join(" ")
    .trim();

export function nombreDeFicha(f) {
  return refDe(f) || direccionDe(f) || "Sin referencia";
}

/* La dirección cuando el nombre ya la ha desplazado; null si el nombre ES la
   dirección, para no repetirla debajo. */
export function subtituloDeFicha(f) {
  return refDe(f) ? direccionDe(f) || null : null;
}

export function tituloFicha(ficha) {
  const d = ficha.data;
  return `${d.tipo || "Inmueble"} · ${nombreDeFicha(ficha)}`;
}

export function textoFicha(ficha) {
  const L = [
    "FICHA DE CAPTACIÓN · RK PALANCA FONTESTAD",
    "=========================================",
    `Agente captador: ${ficha.agenteName}`,
    /* fechaDeFicha() y no fmtFecha(ficha.fecha): la ficha del panel trae
       `recibida` y no `fecha`, así que esto llevaba desde el principio
       escribiendo "Fecha: Invalid Date" en el texto que copia la oficina. */
    `Fecha: ${fechaDeFicha(ficha)}`,
    `Operación: ${ficha.data.operacion || "—"} · Precio: ${fmtPrecio(ficha.data.precio)}`,
    "",
  ];
  bloquesFicha(ficha).forEach((b) => {
    L.push(`— ${b.titulo.toUpperCase()} —`);
    b.filas.forEach(([k, v, vacia]) => !vacia && L.push(`  ${k}: ${v}`));
    L.push("");
  });
  return L.join("\n");
}
