import { useEffect, useRef, useState } from "react";
import { X, Loader2, Copy, Check, Phone, Mail } from "lucide-react";
import { bloquesFicha, textoFicha, tituloFicha } from "../lib/resumen.js";
import { fmtFecha, fmtPrecio } from "../lib/format.js";
import { llamar, ESTADOS, estadoDe } from "./api.js";

export function FichaDetalle({ id, onCerrar, onActualizada }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const panel = useRef(null);

  useEffect(() => {
    let vivo = true;
    llamar("detalle", { id })
      .then((r) => {
        if (!vivo) return;
        setFicha(r.ficha);
        setNota(r.ficha.notaOficina || "");
      })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const guardar = async (cambios) => {
    setGuardando(true);
    try {
      const r = await llamar("actualizar", { id, ...cambios });
      setFicha((f) => ({ ...f, estado: r.ficha.estado, notaOficina: r.ficha.nota_oficina }));
      onActualizada?.(r.ficha);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoFicha(ficha));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("El navegador no permitió copiar");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onCerrar}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de la ficha"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl h-full overflow-y-auto outline-none bg-white dark:bg-ios-superficie-osc shadow-2xl animate-[deslizar_.25s_cubic-bezier(.16,1,.3,1)]"
      >
        {!ficha && !error && (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={26} className="animate-spin text-rk-naranja" aria-label="Cargando" />
          </div>
        )}
        {error && <p className="p-8 text-red-600 font-semibold">{error}</p>}

        {ficha && (
          <>
            <header className="sticky top-0 z-10 bg-ios-superficie/90 dark:bg-ios-superficie-osc/90 backdrop-blur-xl border-b border-ios-borde dark:border-ios-borde-osc px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-rk-naranja">
                    {ficha.data.operacion || "Captación"}
                  </p>
                  <h2 className="text-[21px] font-extrabold leading-tight mt-1 text-ios-texto dark:text-ios-texto-osc">{tituloFicha(ficha)}</h2>
                  <p className="text-[13px] text-ios-texto2 dark:text-ios-texto2-osc mt-1">
                    {ficha.agenteName} · recibida {fmtFecha(ficha.recibida)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCerrar}
                  aria-label="Cerrar"
                  className="shrink-0 w-9 h-9 rounded-full bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-[26px] font-extrabold text-rk-naranja mt-3">{fmtPrecio(ficha.data.precio)}</p>
            </header>

            <div className="px-6 py-5 space-y-6">
              {/* Seguimiento */}
              <section>
                <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja mb-2">Seguimiento</h3>
                <div className="flex flex-wrap gap-2">
                  {ESTADOS.map((e) => {
                    const act = ficha.estado === e.key;
                    return (
                      <button
                        key={e.key}
                        type="button"
                        aria-pressed={act}
                        disabled={guardando}
                        onClick={() => guardar({ estado: e.key })}
                        className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition active:scale-95 disabled:opacity-50 ${
                          act ? "text-white border-transparent" : "bg-white dark:bg-ios-elevada-osc text-gray-700 dark:text-ios-texto-osc border-ios-borde dark:border-ios-borde-osc"
                        }`}
                        style={act ? { background: e.fuerte } : undefined}
                      >
                        {e.label}
                      </button>
                    );
                  })}
                </div>
                <label htmlFor="nota" className="block text-[12px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc mt-4 mb-1.5">
                  Nota interna de oficina
                </label>
                <textarea
                  id="nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  onBlur={() => nota !== (ficha.notaOficina || "") && guardar({ nota })}
                  rows={3}
                  placeholder="Anotaciones del seguimiento…"
                  className="w-full rounded-xl px-3.5 py-3 text-[14px] outline-none border transition resize-y bg-white dark:bg-ios-elevada-osc text-ios-texto dark:text-ios-texto-osc border-ios-borde dark:border-ios-borde-osc focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20"
                />
              </section>

              {/* Propietarios, destacados: es a quien hay que llamar */}
              {ficha.propietarios.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja mb-2">Propietarios</h3>
                  <ul className="space-y-2">
                    {ficha.propietarios.filter((p) => p.nombre || p.telefono).map((p, i) => (
                      <li key={i} className="rounded-xl border border-ios-borde dark:border-ios-borde-osc p-3.5 bg-ios-fondo dark:bg-ios-elevada-osc">
                        <p className="font-semibold text-ios-texto dark:text-ios-texto-osc text-[15px]">{p.nombre || "—"}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          {p.telefono && (
                            <a href={`tel:${p.telefono.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-rk-naranja">
                              <Phone size={13} aria-hidden="true" /> {p.telefono}
                            </a>
                          )}
                          {p.email && (
                            <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-rk-naranja break-all">
                              <Mail size={13} aria-hidden="true" /> {p.email}
                            </a>
                          )}
                          {p.dni && <span className="text-[13px] text-ios-texto2 dark:text-ios-texto2-osc">DNI {p.dni}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Resto de la ficha */}
              {bloquesFicha(ficha).filter((b) => b.titulo !== "Propietarios").map((b) => (
                <section key={b.titulo}>
                  <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja mb-2">{b.titulo}</h3>
                  <dl className="divide-y divide-ios-borde dark:divide-ios-borde-osc">
                    {b.filas.map(([k, v]) => (
                      <div key={k} className="flex gap-4 py-2">
                        <dt className="w-2/5 shrink-0 text-[13px] text-ios-texto2 dark:text-ios-texto2-osc">{k}</dt>
                        <dd className="flex-1 text-[13.5px] font-medium text-ios-texto dark:text-ios-texto-osc">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              <button
                type="button"
                onClick={copiar}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-ios-borde dark:border-ios-borde-osc font-semibold text-[14px] text-gray-700 dark:text-ios-texto-osc active:scale-95 transition"
              >
                {copiado ? <Check size={16} className="text-green-600" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copiado ? "Copiado" : "Copiar ficha como texto"}
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes deslizar{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}

export { estadoDe };
