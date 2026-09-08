/* Las fases del proceso, en el orden en que ocurren. Única definición: la usan
   el servidor (para validar), el panel (para pintar los chips) y la app del
   agente (para su historial). Estaban en tres sitios y bastaba con tocar uno
   para que dejaran de cuadrar.

   Cada fase trae sus variantes de color porque cada sitio necesita una:
     color  → el tono de la fase
     fuerte → versión oscura, para texto blanco encima (el tono claro sobre
              blanco no llega al contraste mínimo)
     claro  → versión clara, para el modo oscuro
     fondo  → tinte muy suave, para las etiquetas sobre fondo blanco

   Baja va al final aunque no sea la última del proceso: no es una fase por la
   que se pasa, es la salida. Vendido y Alquilado son excluyentes entre sí —
   depende de si la operación era venta o alquiler—, pero conviven en el
   filtro del panel, así que llevan tonos bien distintos.

   Los tonos `fuerte` y `claro` están además en index.css como variables CSS,
   que es como el panel las usa en modo oscuro. Hay un test que comprueba que
   los dos sitios dicen lo mismo: es la única copia que no he sabido evitar. */
export const FASES = [
  { key: "nueva",          label: "Nueva",               color: "#cf731c", fuerte: "#9c5310", claro: "#f0a25a", fondo: "#fbeede" },
  { key: "agendada_fotos", label: "Agendada para fotos", color: "#af52de", fuerte: "#7a3aa8", claro: "#d9a2f0", fondo: "#f4e9fb" },
  { key: "pendiente",      label: "Pendiente",           color: "#007aff", fuerte: "#0058b8", claro: "#6fb4ff", fondo: "#e4f0ff" },
  { key: "publicada",      label: "Publicada",           color: "#248a3d", fuerte: "#1e7a34", claro: "#5fd77e", fondo: "#e3f5e8" },
  { key: "reservado",      label: "Reservado",           color: "#0e9594", fuerte: "#0a6f6e", claro: "#5cc9c8", fondo: "#e0f4f4" },
  { key: "vendido",        label: "Vendido",             color: "#c2185b", fuerte: "#9c1349", claro: "#ef7fa8", fondo: "#fce4ec" },
  { key: "alquilado",      label: "Alquilado",           color: "#5856d6", fuerte: "#4340b0", claro: "#a9a8ea", fondo: "#eaeafb" },
  { key: "baja",           label: "Baja",                color: "#8e8e93", fuerte: "#6c6c70", claro: "#b0b0b5", fondo: "#eeeef0" },
];

export const CLAVES_FASE = FASES.map((f) => f.key);

const POR_CLAVE = Object.fromEntries(FASES.map((f) => [f.key, f]));

/* Devuelve null si la fase no se reconoce, para que quien la pinte pueda
   decidir qué hacer en vez de romperse. */
export const faseDe = (clave) => POR_CLAVE[clave] || null;

/* Para el panel, donde siempre hay que pintar algo. */
export const faseOPrimera = (clave) => POR_CLAVE[clave] || FASES[0];
