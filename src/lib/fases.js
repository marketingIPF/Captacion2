/* Las fases del proceso, en el orden en que ocurren. Única definición: la usan
   el servidor (para validar), el panel (para pintar los chips) y la app del
   agente (para su historial). Estaban en tres sitios y bastaba con tocar uno
   para que dejaran de cuadrar.

   Cada fase trae sus variantes de color porque cada sitio necesita una:
     color  → el tono de la fase
     fuerte → versión oscura, para texto blanco encima (el tono claro sobre
              blanco no llega al contraste mínimo)
     claro  → versión clara, para el modo oscuro
     fondo  → tinte muy suave, para las etiquetas sobre fondo blanco          */
export const FASES = [
  { key: "nueva",          label: "Nueva",               color: "#cf731c", fuerte: "#a95a12", claro: "#f0a25a", fondo: "#fbeede" },
  { key: "agendada_fotos", label: "Agendada para fotos", color: "#af52de", fuerte: "#7a3aa8", claro: "#d9a2f0", fondo: "#f4e9fb" },
  { key: "pendiente",      label: "Pendiente",           color: "#007aff", fuerte: "#0058b8", claro: "#6fb4ff", fondo: "#e4f0ff" },
  { key: "publicada",      label: "Publicada",           color: "#248a3d", fuerte: "#1e7a34", claro: "#5fd77e", fondo: "#e3f5e8" },
  { key: "baja",           label: "Baja",                color: "#8e8e93", fuerte: "#6c6c70", claro: "#b0b0b5", fondo: "#eeeef0" },
];

export const CLAVES_FASE = FASES.map((f) => f.key);

const POR_CLAVE = Object.fromEntries(FASES.map((f) => [f.key, f]));

/* Devuelve null si la fase no se reconoce, para que quien la pinte pueda
   decidir qué hacer en vez de romperse. */
export const faseDe = (clave) => POR_CLAVE[clave] || null;

/* Para el panel, donde siempre hay que pintar algo. */
export const faseOPrimera = (clave) => POR_CLAVE[clave] || FASES[0];
