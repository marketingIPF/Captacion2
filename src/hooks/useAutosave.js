import { useEffect, useRef } from "react";
import { save } from "../lib/storage.js";

/* Vuelca el valor a localStorage con debounce. Es el seguro contra el fallo
   más caro de la app: perder una ficha de 60 campos rellenada en la calle
   porque entró una llamada o el navegador descargó la pestaña. */
export function useAutosave(clave, valor, { delay = 600, activo = true } = {}) {
  const guardado = useRef(null);

  useEffect(() => {
    if (!activo) return undefined;
    const t = setTimeout(() => {
      const serie = JSON.stringify(valor);
      if (serie === guardado.current) return;
      guardado.current = serie;
      save(clave, valor);
    }, delay);
    return () => clearTimeout(t);
  }, [clave, valor, delay, activo]);

  /* Última oportunidad al cerrar/ocultar la app: aquí no hay debounce que valga. */
  useEffect(() => {
    if (!activo) return undefined;
    const volcar = () => {
      if (document.visibilityState === "hidden") save(clave, valor);
    };
    document.addEventListener("visibilitychange", volcar);
    window.addEventListener("pagehide", volcar);
    return () => {
      document.removeEventListener("visibilitychange", volcar);
      window.removeEventListener("pagehide", volcar);
    };
  }, [clave, valor, activo]);
}
