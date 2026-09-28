import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";

/* Cada cuánto se pregunta al servidor si hay versión nueva estando la app
   abierta y quieta. */
const CADA = 30 * 60 * 1000;

/* Dos comprobaciones seguidas no averiguan nada distinto, y volver al primer
   plano pasa muchas veces al día. */
const ESPERA_MINIMA = 60 * 1000;

/* Con registerType "autoUpdate" la app se actualiza y se recarga sola, así que
   este aviso casi nunca aparece. Se mantiene como red de seguridad: si el
   navegador deja el service worker nuevo en espera en vez de activarlo, al
   menos hay una forma manual de forzarlo en lugar de quedarse atascado. */
export function ActualizacionDisponible() {
  const registro = useRef(null);
  const ultima = useRef(0);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError: (err) => console.warn("Service worker no registrado", err),
    onRegisteredSW: (url, reg) => { registro.current = reg || null; },
  });

  /* Cuándo mirar si hay versión nueva.

     Al cargar ya lo hace el navegador solo. Lo que faltaba es lo que de
     verdad pasa en un móvil: el agente no recarga la página, sale de la app y
     vuelve horas después. Sin esto, una app instalada y abierta desde el
     lunes podía seguir con la versión del lunes. Igual al recuperar la
     conexión, que es cuando una comprobación que antes falló puede salir. */
  useEffect(() => {
    const comprobar = () => {
      if (!registro.current || navigator.onLine === false) return;
      if (Date.now() - ultima.current < ESPERA_MINIMA) return;
      ultima.current = Date.now();
      registro.current.update().catch(() => {});
    };
    const alVolver = () => { if (document.visibilityState === "visible") comprobar(); };

    const cada = setInterval(comprobar, CADA);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", comprobar);
    return () => {
      clearInterval(cada);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", comprobar);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed left-0 right-0 top-0 z-[70] max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top)+10px)]"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[#2c2c2ef2] backdrop-blur-xl text-white px-4 py-3 shadow-xl">
        <RefreshCw size={17} className="text-rk-naranja shrink-0" aria-hidden="true" />
        <span className="flex-1 text-[13px] font-medium leading-snug">
          Hay una versión nueva. Guarda lo que tengas y actualiza.
        </span>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-xl bg-rk-naranja px-3 py-1.5 text-[12.5px] font-bold active:scale-95 transition"
        >
          Actualizar
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Ahora no"
          className="shrink-0 text-white/50 text-[12.5px] font-semibold"
        >
          Luego
        </button>
      </div>
    </div>
  );
}
