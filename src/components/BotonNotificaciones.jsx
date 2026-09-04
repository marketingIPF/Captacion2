import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, AlertCircle } from "lucide-react";
import { pushSoportado, permisoActual, notificacionesActivas, activarPush, desactivarPush } from "../lib/push.js";

/* Interruptor de notificaciones para este navegador.
   El estado no se recuerda, se consulta: la persona puede haberlo cambiado en
   los ajustes del navegador sin pasar por aquí.

   Y se le pregunta al SERVIDOR, no al navegador. El navegador tiene una única
   suscripción para todo el sitio, compartida por el panel de oficina y la app
   de agente; mirarla a ella hacía que activar en un sitio pintara el botón del
   otro como activado, sin que llegara nada. */
export function BotonNotificaciones({ credenciales, descripcion, className = "" }) {
  const [activas, setActivas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");

  const clave = JSON.stringify(credenciales || {});
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    notificacionesActivas(credenciales).then((si) => {
      if (!vivo) return;
      setActivas(si);
      setCargando(false);
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

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
