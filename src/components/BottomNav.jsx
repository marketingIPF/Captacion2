import { ClipboardList, History, User } from "lucide-react";

/* El historial llevaba un icono de documento y la ficha uno de portapapeles:
   dos hojas de papel, imposibles de distinguir de un vistazo. Un reloj con
   flecha dice "lo de antes" sin necesidad de leer. */
const ITEMS = [
  { k: "ficha", l: "Ficha", icon: ClipboardList },
  { k: "historial", l: "Historial", icon: History },
  { k: "perfil", l: "Perfil", icon: User },
];

/* Una bandeja flotante en vez de una barra pegada al borde.

   La pestaña donde estás es una pastilla BLANCA que sobresale y se abre para
   enseñar su nombre; las otras dos son círculos hundidos con solo el icono.
   Sale y entra: es la misma idea que el resto de la app —lo que está activo se
   levanta, lo que espera se hunde— y aquí además ahorra el sitio que hacía
   falta para tres etiquetas.

   Las tres siguen teniendo nombre para quien usa lector de pantalla, puesto a
   mano en aria-label: la etiqueta encogida a cero no cuenta como texto.     */
export function BottomNav({ tab, setTab, badge = 0 }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div className="neu-bandeja pointer-events-auto flex items-center gap-2 rounded-full p-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const act = tab === it.k;
          return (
            <button
              key={it.k}
              type="button"
              onClick={() => setTab(it.k)}
              aria-current={act ? "page" : undefined}
              /* El nombre va también aquí: encogido a cero, el navegador deja
                 el <span> fuera del árbol de accesibilidad y los tres botones
                 se anunciaban sin nombre. */
              aria-label={it.l}
              className={`relative h-12 min-w-[48px] px-3.5 rounded-full flex items-center justify-center active:scale-95 transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-naranja/60 ${
                act ? "neu-suave text-rk-naranja" : "neu-hundido text-ios-texto2"
              }`}
            >
              <Icon size={21} strokeWidth={act ? 2.5 : 2} className="shrink-0" aria-hidden="true" />
              <span
                className={`text-[14px] font-bold whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  act ? "max-w-[110px] opacity-100 ml-2" : "max-w-0 opacity-0"
                }`}
              >
                {it.l}
              </span>
              {it.k === "historial" && badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rk-naranja text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
