import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { fichaVacia } from "../lib/ficha.js";
import { llamar } from "./api.js";
import { EditarFicha } from "./EditarFicha.jsx";

/* Captación tecleada desde la oficina.

   Existe para meter las de antes de que hubiera app. No comparte el modal con
   FichaDetalle porque ese carga la ficha por id, y aquí todavía no hay ficha:
   se inventa el id en el navegador, igual que hace la app del agente.

   La lista de agentes se pide aquí y no en el panel entero porque solo se usa
   al crear: no tiene sentido traer nombres del equipo en cada carga del
   listado. */
export function NuevaCaptacion({ onCreada, onCerrar }) {
  const panel = useRef(null);
  const [agentes, setAgentes] = useState(null);
  const vacia = useMemo(() => fichaVacia(null), []);

  useEffect(() => {
    panel.current?.focus();
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  useEffect(() => {
    let vivo = true;
    /* Si falla, se sigue pudiendo crear: el selector se queda vacío y la
       captación va a nombre de la oficina. Peor sería no dejar guardar. */
    llamar("agentes")
      .then((r) => vivo && setAgentes(r.agentes || []))
      .catch(() => vivo && setAgentes([]));
    return () => { vivo = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onCerrar}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Nueva captación"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl h-full overflow-y-auto outline-none bg-white dark:bg-ios-superficie-osc shadow-2xl animate-[deslizar_.25s_cubic-bezier(.16,1,.3,1)]"
      >
        <header className="sticky top-0 z-20 bg-ios-superficie/95 dark:bg-ios-superficie-osc/95 backdrop-blur-xl border-b border-ios-borde dark:border-ios-borde-osc px-6 py-5 flex items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-extrabold text-ios-texto dark:text-ios-texto-osc">
              Nueva captación
            </h2>
            <p className="text-[12.5px] text-ios-texto2 dark:text-ios-texto2-osc mt-0.5">
              Para las que ya teníamos antes de la app. Quedará marcada como
              añadida desde la oficina.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="ml-auto shrink-0 w-9 h-9 rounded-lg bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc flex items-center justify-center active:scale-95 transition"
          >
            <X size={17} />
          </button>
        </header>

        {agentes === null ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 size={26} className="animate-spin text-rk-naranja" aria-label="Cargando" />
          </div>
        ) : (
          <EditarFicha
            ficha={vacia}
            modo="crear"
            agentes={agentes}
            onGuardada={onCreada}
            onCancelar={onCerrar}
          />
        )}
      </div>
    </div>
  );
}
