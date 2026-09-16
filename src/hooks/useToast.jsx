import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const ESTILOS = {
  ok: { bg: "#2c2c2ef2", icon: CheckCircle2, color: "#30d158" },
  error: { bg: "#2c2c2ef2", icon: AlertTriangle, color: "#ff453a" },
  info: { bg: "#2c2c2ef2", icon: Info, color: "#cf731c" },
};

/* `hueco` es el espacio que hay que dejar por debajo. La app del agente tiene
   la barra de navegación abajo y el aviso no puede taparla; el panel no tiene
   nada ahí. Antes estaba fijo a 88 px, que era la medida de esa barra. */
export function ToastProvider({ children, hueco = 88 }) {
  const [items, setItems] = useState([]);

  const cerrar = useCallback((id) => setItems((p) => p.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (mensaje, tipo = "ok", ms = 3200) => {
      const id = crypto.randomUUID();
      setItems((p) => [...p, { id, mensaje, tipo }]);
      if (ms) setTimeout(() => cerrar(id), ms);
      return id;
    },
    [cerrar]
  );

  const api = useMemo(() => Object.assign(toast, { cerrar }), [toast, cerrar]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + ${hueco}px)` }}
        role="status"
        aria-live="polite"
      >
        {items.map((t) => {
          const e = ESTILOS[t.tipo] || ESTILOS.info;
          const Icon = e.icon;
          return (
            <div
              key={t.id}
              className="pointer-events-auto w-full max-w-sm flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl animate-[toastin_.25s_cubic-bezier(.16,1,.3,1)]"
              style={{ background: e.bg }}
            >
              <Icon size={18} style={{ color: e.color }} className="shrink-0" />
              <span className="flex-1 text-[13.5px] font-medium text-white leading-snug">{t.mensaje}</span>
              <button onClick={() => cerrar(t.id)} aria-label="Cerrar aviso" className="text-white/40 shrink-0">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toastin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastCtx.Provider>
  );
}
