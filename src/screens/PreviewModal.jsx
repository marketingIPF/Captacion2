import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Check, CloudOff, ServerCrash } from "lucide-react";
import { textoFicha } from "../lib/resumen.js";
import { enviarAlServidor, encolar } from "../lib/cola.js";
import { useToast } from "../hooks/useToast.jsx";

export function PreviewModal({ ficha, pin, onClose, onEnviada, esCorreccion = false }) {
  const texto = textoFicha(ficha);
  const [estado, setEstado] = useState("idle"); // idle | enviando | ok | offline | servidor | rechazada
  const [detalle, setDetalle] = useState("");
  const yaArchivada = useRef(false);
  const dialogRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && estado !== "enviando") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, estado]);

  const enviar = async () => {
    if (estado === "enviando" || estado === "ok") return;
    setEstado("enviando");
    const res = await enviarAlServidor(ficha, pin);

    if (res.ok) {
      archivar({ estado: "enviada", recibida: res.recibida, envios: res.envios });
      setEstado("ok");
      setTimeout(onClose, 1500);
      return;
    }

    if (res.tipo === "rechazada") {
      setEstado("rechazada");
      setDetalle(res.error);
      toast(res.error, "error", 6000);
      return;
    }

    /* Ni sin red ni con la oficina caída se pierde la ficha: queda en cola y
       sale sola. Lo que cambia es lo que se le cuenta al agente. */
    encolar(ficha);
    archivar({ estado: "pendiente", error: res.error, tipo: res.tipo });
    setDetalle(res.error || "");
    setEstado(res.tipo === "servidor" ? "servidor" : "offline");
  };

  const archivar = (envio) => {
    if (yaArchivada.current) return;
    yaArchivada.current = true;
    onEnviada(ficha, envio);
  };

  const btnBg =
    estado === "ok" ? "#16a34a"
    : estado === "offline" || estado === "servidor" ? "#d97706"
    : estado === "rechazada" ? "#dc2626"
    : "#cf731c";

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={estado === "enviando" ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-titulo"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-auto bg-white rounded-t-[28px] max-h-[88vh] flex flex-col outline-none animate-[slideup_.3s_cubic-bezier(.16,1,.3,1)]"
      >
        <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" aria-hidden="true" />
        <div className="flex items-center justify-between px-6 pt-3 pb-2">
          <h2 id="preview-titulo" className="text-[18px] font-bold text-ios-texto">
            {esCorreccion ? "Revisar y reenviar" : "Revisar y enviar"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full bg-ios-fondo flex items-center justify-center text-ios-texto2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 overflow-y-auto pb-4 flex-1">
          <p className="text-[12.5px] text-ios-texto2 mb-3 leading-snug">
            {esCorreccion
              ? "Esto sustituirá a lo que la oficina tiene ahora mismo."
              : "Esto es lo que recibirá la oficina. Repásalo antes de enviar."}
          </p>
          <pre className="text-[12px] text-gray-800 whitespace-pre-wrap font-mono bg-ios-fondo rounded-xl p-3 leading-relaxed">
            {texto}
          </pre>
        </div>

        <div className="p-4 border-t border-ios-borde" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <button
            type="button"
            onClick={enviar}
            disabled={estado === "enviando" || estado === "ok"}
            className="w-full py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-90"
            style={{ background: btnBg }}
          >
            {estado === "enviando" ? (<><Loader2 size={19} className="animate-spin" aria-hidden="true" /> Enviando…</>)
              : estado === "ok" ? (<><Check size={19} strokeWidth={3} aria-hidden="true" /> Recibida en la oficina</>)
              : estado === "offline" ? (<><CloudOff size={18} aria-hidden="true" /> Guardada · reintentar ahora</>)
              : estado === "servidor" ? (<><ServerCrash size={18} aria-hidden="true" /> Guardada · reintentar ahora</>)
              : estado === "rechazada" ? (<><Send size={18} aria-hidden="true" /> Reintentar</>)
              : (<><Send size={18} aria-hidden="true" /> {esCorreccion ? "Reenviar corregida" : "Enviar a la oficina"}</>)}
          </button>

          <p className="text-center text-[12px] mt-2 leading-snug" role="status">
            {estado === "offline" ? (
              <span className="text-amber-700">
                No hay conexión ahora mismo. La ficha está guardada y se enviará sola
                en cuanto vuelvas a tener red. Puedes cerrar la app.
              </span>
            ) : estado === "servidor" ? (
              <span className="text-amber-700">
                Tu conexión está bien. {detalle || "La oficina no ha podido guardarla."}{" "}
                La ficha está guardada en este móvil y se reintentará sola.
              </span>
            ) : estado === "ok" ? (
              <span className="text-green-700">La oficina ya la tiene.</span>
            ) : estado === "rechazada" ? (
              <span className="text-red-600">{detalle}</span>
            ) : (
              <span className="text-ios-texto2">Se guarda en la base de datos de la oficina.</span>
            )}
          </p>
        </div>
      </div>
      <style>{`@keyframes slideup{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}
