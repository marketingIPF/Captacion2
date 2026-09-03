import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";

/* Con registerType "prompt" la app no se recarga sola: avisa y espera.
   Así una actualización no puede borrar una ficha a medio rellenar. */
export function ActualizacionDisponible() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (err) => console.warn("Service worker no registrado", err),
  });

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
