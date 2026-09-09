import { User, MapPin, Euro, Ruler, Sparkles, Layers, FileText } from "lucide-react";
import { RESIDENCIAL, EDIFICADO, CON_PARCELA, EN_EDIFICIO } from "./tipos.js";

/* ==================================================================
   ESQUEMA DE LA FICHA
   ------------------------------------------------------------------
   Cada campo puede declarar:
     tipos     → array de tipos de inmueble donde aplica (si falta, aplica a todos)
     when      → predicado (data) => bool, para dependencias entre campos
     required  → obligatorio para poder enviar
     validate  → nombre del validador en lib/validacion.js
     unidad    → unidad REAL de medida (m², €, plantas). Se muestra en la
                 etiqueta del formulario Y detrás del valor en el panel.
                 Un contador ("nº") o un año NO son unidades: para eso está
                 `ph`, que solo afecta al hueco del campo. Confundirlos hacía
                 que el panel mostrara "4 nº" o "1950 año".
     ph        → texto de ayuda dentro del campo, nunca se muestra con el dato
   Un campo que no aplica no se pinta, no cuenta para el progreso y no
   viaja en el correo.
   ================================================================== */

const txt = (key, label, o = {}) => ({ key, kind: "txt", label, ...o });
const num = (key, label, o = {}) => ({ key, kind: "num", label, ...o });
const seg = (key, label, options, o = {}) => ({ key, kind: "seg", label, options, ...o });
const chips = (key, label, options, o = {}) => ({ key, kind: "chips", label, options, ...o });
const area = (key, label, o = {}) => ({ key, kind: "area", label, ...o });

export const SECCIONES = [
  {
    id: "ident",
    n: 1,
    title: "Agente e identificación",
    icon: User,
    fields: [
      /* `siempre`: la fila se ve en el panel aunque esté vacía. La oficina
         necesita saber si la captación viene de un prospecto ANTES de subirla
         al CRM, y una fila que desaparece no se distingue de una que nadie ha
         mirado. Es el único campo así de momento; si se marcan muchos, el
         panel se llena de filas sin contenido. */
      txt("prospecto", "Prospecto", { ph: "Nombre del prospecto", siempre: true }),
      txt("referencia", "Referencia interna", {
        ph: "#05618",
        inputMode: "numeric",
        validate: "referencia",
        normalizar: "referencia",
      }),
      seg("operacion", "Operación", ["Venta", "Alquiler"], { required: true }),
      { key: "tipo", kind: "tipo", label: "Tipo de inmueble", required: true },
      { key: "refCatastral", kind: "catastro", label: "Referencia catastral", validate: "refCatastral" },
    ],
  },
  {
    id: "ubic",
    n: 2,
    title: "Ubicación y datos legales",
    icon: MapPin,
    fields: [
      txt("direccion", "Dirección (calle)", { ph: "Calle / Avenida", required: true }),
      txt("numero", "Número", { ph: "Nº" }),
      txt("bloque", "Bloque / Escalera", { ph: "Bloque", tipos: EN_EDIFICIO }),
      txt("planta", "Planta", { ph: "Planta", tipos: EN_EDIFICIO }),
      txt("puerta", "Puerta", { ph: "Puerta", tipos: EN_EDIFICIO }),
      txt("poblacion", "Población", { ph: "Valencia", required: true }),
      txt("cp", "Código postal", { ph: "46000", inputMode: "numeric", validate: "cp" }),
      txt("provincia", "Provincia", { ph: "Valencia" }),
      seg("suelo", "Clasificación del suelo", ["Urbano", "Urbanizable", "Rústico"]),
      seg("cee", "Certificado energético", ["Hecho", "Pendiente", "Exento"]),
      seg("ceeLetra", "Letra CEE", ["A", "B", "C", "D", "E", "F", "G"], {
        when: (d) => d.cee === "Hecho",
      }),
      seg("cargas", "¿Tiene cargas?", ["No", "Hipoteca", "Embargo", "Otras"]),
      txt("cargasDetalle", "Detalle de las cargas", {
        ph: "Importe pendiente, entidad…",
        when: (d) => !!d.cargas && d.cargas !== "No",
      }),
      seg("ocupacion", "Situación", ["Libre", "Alquilado", "Ocupado"]),
      txt("finAlquiler", "Fin del contrato de alquiler", {
        ph: "MM/AAAA",
        when: (d) => d.ocupacion === "Alquilado",
      }),
      seg("autorizacion", "Autorización de venta firmada", ["Sí", "No"]),
      seg("exclusiva", "Régimen", ["Exclusiva", "Sin exclusiva"], {
        when: (d) => d.autorizacion === "Sí",
      }),
      chips("docs", "Documentación aportada", ["DNI", "IBI", "CEE", "Escritura", "Nota simple", "Cédula habitabilidad", "ITE"]),
    ],
  },
  {
    id: "econ",
    n: 3,
    title: "Datos económicos",
    icon: Euro,
    fields: [
      num("precio", "Precio solicitado", { unidad: "€", required: true }),
      num("precioMin", "Precio mínimo aceptable", { unidad: "€", validate: "precioMin" }),
      num("comunidad", "Gastos de comunidad", { unidad: "€/mes", tipos: EN_EDIFICIO }),
      num("ibi", "IBI", { unidad: "€/año" }),
      seg("derrama", "Derrama aprobada", ["Sí", "No"], { tipos: EN_EDIFICIO }),
      num("derramaImporte", "Importe de la derrama", {
        unidad: "€",
        when: (d) => d.derrama === "Sí",
      }),
      seg("vpo", "VPO", ["Sí", "No"], { tipos: RESIDENCIAL }),
      txt("vpoExp", "Nº de expediente VPO", {
        ph: "Expediente",
        when: (d) => d.vpo === "Sí",
      }),
      seg("honorarios", "Honorarios pactados", ["% sobre venta", "Importe fijo", "Pendiente"]),
      num("honorariosValor", "Valor de los honorarios", {
        ph: "3 (%) o 15000 (€)",
        when: (d) => !!d.honorarios && d.honorarios !== "Pendiente",
      }),
    ],
  },
  {
    id: "dist",
    n: 4,
    title: "Distribución y superficies",
    icon: Ruler,
    fields: [
      num("mConstruidos", "M² construidos", { unidad: "m²", tipos: EDIFICADO }),
      num("mUtiles", "M² útiles", { unidad: "m²", tipos: EDIFICADO }),
      num("mParcela", "M² de parcela", { unidad: "m²", tipos: CON_PARCELA }),
      num("edificabilidad", "Edificabilidad", { unidad: "m²/m²", tipos: ["Terreno"] }),
      num("mTerraza", "M² de terraza", { unidad: "m²", tipos: RESIDENCIAL }),
      num("anio", "Año de construcción", { ph: "1950", tipos: EDIFICADO, validate: "anio" }),
      num("alturas", "Alturas del edificio", { unidad: "plantas", tipos: EN_EDIFICIO }),
      num("dormitorios", "Dormitorios", { ph: "Nº", tipos: RESIDENCIAL }),
      num("banos", "Baños", { ph: "Nº", tipos: RESIDENCIAL }),
      num("aseos", "Aseos", { ph: "Nº", tipos: RESIDENCIAL }),
      num("salon", "Salón", { unidad: "m²", tipos: RESIDENCIAL }),
      num("cocinaM", "Cocina", { unidad: "m²", tipos: RESIDENCIAL }),
      num("plazas", "Plazas de aparcamiento", { ph: "Nº", tipos: ["Garaje"] }),
      num("escaparate", "Metros de escaparate", { unidad: "m", tipos: ["Local"] }),
      seg("salidaHumos", "Salida de humos", ["Sí", "No"], { tipos: ["Local"] }),
      chips("equipamiento", "Equipamiento adicional", ["Armarios empotrados", "Garaje", "Trastero", "Terraza", "Balcón", "Piscina", "Jardín", "Buhardilla"], { tipos: RESIDENCIAL }),
    ],
  },
  {
    id: "cal",
    n: 5,
    title: "Calidades y equipamiento",
    icon: Sparkles,
    tipos: [...RESIDENCIAL, "Local"],
    fields: [
      seg("ventanaMat", "Ventanas — material", ["Aluminio", "PVC", "Madera", "Climalit"]),
      seg("ventanaApertura", "Tipo de apertura", ["Correderas", "Abatibles", "Oscilobatientes"]),
      seg("puertas", "Puertas interiores", ["Macizas", "Huecas", "Lacadas", "Roble/Haya"], { tipos: RESIDENCIAL }),
      seg("suelos", "Suelos", ["Tarima", "Gres", "Terrazo", "Mármol", "Porcelánico"]),
      seg("cocinaTipo", "Cocina", ["Independiente", "Abierta", "Americana"], { tipos: RESIDENCIAL }),
      seg("fuegos", "Fuegos", ["Vitrocerámica", "Inducción", "Gas"], { tipos: RESIDENCIAL }),
      seg("acs", "Agua caliente", ["Termo eléctrico", "Gas natural", "Butano", "Solar", "Aerotermia"]),
      seg("clima", "Climatización", ["A/A Splits", "Conductos", "No tiene"]),
      seg("calefaccion", "Calefacción", ["Gas", "Eléctrica", "Suelo radiante", "No tiene"], { tipos: RESIDENCIAL }),
      seg("paredes", "Paredes", ["Lisas", "Gotelé", "Papel pintado"], { tipos: RESIDENCIAL }),
    ],
  },
  {
    id: "edif",
    n: 6,
    title: "Edificio, entorno y estado",
    icon: Layers,
    fields: [
      seg("ascensor", "Ascensor", ["Sí", "No"], { tipos: EN_EDIFICIO }),
      seg("cotaCero", "A cota cero", ["Sí", "No"], { tipos: EDIFICADO }),
      chips("zonasComunes", "Zonas comunes", ["Piscina", "Jardines", "Club social", "Pádel/Tenis", "Zona infantil"], { tipos: EN_EDIFICIO }),
      seg("conserjeria", "Conserjería / vigilancia", ["Sí", "No"], { tipos: EN_EDIFICIO }),
      seg("fachada", "Fachada", ["Ladrillo caravista", "Monocapa", "Pintada", "Piedra"], { tipos: EDIFICADO }),
      seg("estado", "Estado de conservación", ["Para entrar", "Buen estado", "A reformar", "A estrenar"], { tipos: EDIFICADO }),
      seg("orientacion", "Orientación", ["Norte", "Sur", "Este", "Oeste"]),
      seg("acceso", "Acceso rodado", ["Sí", "No"], { tipos: ["Terreno"] }),
      chips("suministros", "Suministros disponibles", ["Agua", "Luz", "Alcantarillado", "Gas"], { tipos: ["Terreno", "Local"] }),
      chips("vistas", "Vistas", ["Al mar", "A la montaña", "Despejadas", "Interior"]),
      chips("servicios", "Servicios a 5 min", ["Metro/Bus", "Supermercado", "Colegios", "Centro médico", "Parques"]),
    ],
  },
  {
    id: "obs",
    n: 7,
    title: "Observaciones del agente",
    icon: FileText,
    fields: [
      area("notasInternas", "Notas internas (no publicables)", { ph: "Anotaciones privadas para la oficina…" }),
      area("descripcionPublica", "Descripción pública (para portales)", { ph: "Texto comercial para publicar…", rows: 5 }),
    ],
  },
];
