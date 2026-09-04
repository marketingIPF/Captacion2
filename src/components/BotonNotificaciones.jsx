import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, AlertCircle } from "lucide-react";
import { pushSoportado, permisoActual, suscripcionActual, activarPush, desactivarPush } from "../lib/push.js";

/* Interruptor de notificaciones para este navegador.
   El estado real lo tiene el navegador, no la app: se consulta al montar en
   vez de recordarlo, porque la persona puede haberlo cambiado en los ajustes
   sin pasar por aquí. */
export function BotonNotificaciones({ credenciales, descripcion, className = "" }) {
  const [activas, setActivas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    suscripcionActual().then((s) => {
      if (!vivo) return;
      setActivas(Boolean(s) && permisoActual() === "granted");
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  if (!pushSoportado()) return null;

  const alternar = async () => {
    setCargando(true);
    setAviso("");
    const r = activas ? await desactivarPush(credenciales) : await activarPush(credenciales);
    if (r.ok) setActivas(!activas);
    else setAviso(r.error);
    setCargando(false);
  };

  const bloqueado = permisoActual() === "denied";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={alternar}
        disabled={cargando}
        aria-pressed={activas}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition active:scale-[0.99] disabled:opacity-60 ${
          activas ? "text-rk-naranja" : "text-ios-texto2 dark:text-ios-texto2-osc"
        }`}
      >
        {cargando ? (
          <Loader2 size={17} className="animate-spin shrink-0" aria-hidden="true" />
        ) : activas ? (
          <Bell size={17} className="shrink-0" aria-hidden="true" />
        ) : (
          <BellOff size={17} className="shrink-0" aria-hidden="true" />
        )}
        <span className="flex-1">
          <span className="block font-semibold text-[14.5px] text-ios-texto dark:text-ios-texto-osc">
            {activas ? "Notificaciones activadas" : "Activar notificaciones"}
          </span>
          <span className="block text-[12px] text-ios-texto2 dark:text-ios-texto2-osc leading-snug">
            {activas ? "En este dispositivo. Pulsa para desactivarlas." : descripcion}
          </span>
        </span>
      </button>

      {(aviso || bloqueado) && (
        <p role="alert" className="flex items-start gap-1.5 px-5 pb-3 text-[12px] text-amber-700 leading-snug">
          <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
          {aviso ||
            "Este navegador tiene las notificaciones bloqueadas para el sitio. Hay que permitirlas en sus ajustes."}
        </p>
      )}
    </div>
  );
}
