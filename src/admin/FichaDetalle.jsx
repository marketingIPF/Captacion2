import { useEffect, useRef, useState } from "react";
import { X, Loader2, Phone, Mail, MapPin, MessageCircle, AlertCircle } from "lucide-react";
import {
  bloquesFicha, bloqueComoTexto, textoFicha, tituloFicha, direccionCompleta, cifrasClave,
} from "../lib/resumen.js";
import { fmtFecha, fmtPrecio } from "../lib/format.js";
import { TIPOS_INMUEBLE } from "../data/tipos.js";
import { Avatar } from "../components/Avatar.jsx";
import { llamar, ESTADOS } from "./api.js";
import { useCopiar } from "./useCopiar.js";
import { FilaCopiable, BotonCopiar } from "./Copiable.jsx";

const soloDigitos = (t) => String(t || "").replace(/[^\d+]/g, "");

export function FichaDetalle({ id, onCerrar, onActualizada }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const panel = useRef(null);
  const { copiar, copiado, error: errorCopia } = useCopiar();

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

  const bloques = ficha ? bloquesFicha(ficha).filter((b) => b.titulo !== "Propietarios") : [];
  const Icono = ficha ? (TIPOS_INMUEBLE.find((t) => t.key === ficha.data.tipo)?.icon || MapPin) : MapPin;
  const direccion = ficha ? direccionCompleta(ficha) : "";
  const cifras = ficha ? cifrasClave(ficha) : [];
  const descripcion = ficha?.data?.descripcionPublica;

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
            <header className="sticky top-0 z-10 bg-ios-superficie/95 dark:bg-ios-superficie-osc/95 backdrop-blur-xl border-b border-ios-borde dark:border-ios-borde-osc px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-rk-soft flex items-center justify-center shrink-0">
                    <Icono size={21} className="text-rk-naranja" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-rk-naranja">
                      {ficha.data.operacion || "Captación"}
                    </p>
                    <h2 className="text-[20px] font-extrabold leading-tight text-ios-texto dark:text-ios-texto-osc">
                      {tituloFicha(ficha)}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                      <Avatar agente={{ id: ficha.agenteId, name: ficha.agenteName }} tam={20} />
                      <p className="text-[12.5px] text-ios-texto2 dark:text-ios-texto2-osc truncate">
                        {ficha.agenteName} · {fmtFecha(ficha.recibida)}
                        {ficha.data.referencia ? ` · ${ficha.data.referencia}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[24px] font-extrabold text-rk-naranja whitespace-nowrap">
                    {fmtPrecio(ficha.data.precio)}
                  </span>
                  <button
                    type="button"
                    onClick={onCerrar}
                    aria-label="Cerrar"
                    className="w-9 h-9 rounded-full bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </header>

            {errorCopia && (
              <p role="alert" className="mx-6 mt-4 flex items-start gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
                <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" /> {errorCopia}
              </p>
            )}

            <div className="px-6 py-5 space-y-6">
              {/* Cifras de un vistazo, en vez de buscarlas en la lista */}
              {cifras.length > 0 && (
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {cifras.map((c) => (
                    <li key={c.etiqueta}>
                      <button
                        type="button"
                        onClick={() => copiar(c.valor, `cifra-${c.etiqueta}`)}
                        aria-label={`Copiar ${c.etiqueta}: ${c.valor}`}
                        className="w-full rounded-xl border border-ios-borde dark:border-ios-borde-osc px-3 py-2.5 text-left transition hover:border-rk-naranja active:scale-95"
                      >
                        <div className="text-[17px] font-extrabold text-ios-texto dark:text-ios-texto-osc leading-none">
                          {copiado === `cifra-${c.etiqueta}` ? "Copiado" : c.valor}
                          {c.unidad && copiado !== `cifra-${c.etiqueta}` && (
                            <span className="text-[11px] font-semibold text-ios-texto3 ml-0.5">{c.unidad}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-ios-texto2 dark:text-ios-texto2-osc mt-1">{c.etiqueta}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Dirección en una línea: es lo que piden los portales */}
              <section className="rounded-xl bg-ios-fondo dark:bg-ios-elevada-osc/50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja mb-1">Dirección</p>
                    <p className="text-[14px] font-medium text-ios-texto dark:text-ios-texto-osc leading-snug">{direccion}</p>
                  </div>
                  <BotonCopiar texto={direccion} clave="direccion" copiar={copiar} copiado={copiado} />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-rk-naranja mt-2"
                >
                  <MapPin size={13} aria-hidden="true" /> Ver en el mapa
                </a>
              </section>

              {/* Propietarios: a quien hay que llamar */}
              {ficha.propietarios.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja mb-2">Propietarios</h3>
                  <ul className="space-y-2">
                    {ficha.propietarios.filter((p) => p.nombre || p.telefono).map((p, i) => (
                      <li key={i} className="rounded-xl border border-ios-borde dark:border-ios-borde-osc p-3.5 bg-ios-fondo dark:bg-ios-elevada-osc/50">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-ios-texto dark:text-ios-texto-osc text-[15px]">{p.nombre || "—"}</p>
                          <BotonCopiar
                            texto={[p.nombre, p.telefono, p.dni, p.email].filter(Boolean).join(" · ")}
                            clave={`prop-${i}`}
                            copiar={copiar}
                            copiado={copiado}
                            etiqueta="Copiar todo"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {p.telefono && (
                            <>
                              <a href={`tel:${soloDigitos(p.telefono)}`} className="flex items-center gap-1.5 rounded-lg bg-rk-soft px-2.5 py-1.5 text-[13px] font-bold text-rk-naranja">
                                <Phone size={13} aria-hidden="true" /> {p.telefono}
                              </a>
                              <a
                                href={`https://wa.me/${soloDigitos(p.telefono).replace(/^\+?34?/, "34")}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="flex items-center gap-1.5 rounded-lg bg-ios-fondo dark:bg-ios-elevada-osc px-2.5 py-1.5 text-[12.5px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc"
                              >
                                <MessageCircle size={13} aria-hidden="true" /> WhatsApp
                              </a>
                              <BotonCopiar texto={p.telefono} clave={`tel-${i}`} copiar={copiar} copiado={copiado} etiqueta="Copiar tel." />
                            </>
                          )}
                          {p.email && (
                            <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-[13px] font-semibold text-rk-naranja break-all">
                              <Mail size={13} aria-hidden="true" /> {p.email}
                            </a>
                          )}
                          {p.dni && (
                            <button
                              type="button"
                              onClick={() => copiar(p.dni, `dni-${i}`)}
                              className="text-[12.5px] text-ios-texto2 dark:text-ios-texto2-osc underline underline-offset-2"
                            >
                              {copiado === `dni-${i}` ? "DNI copiado" : `DNI ${p.dni}`}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* La descripción pública es el texto largo que va a los portales */}
              {descripcion && (
                <section className="rounded-xl border border-rk-softBorde bg-rk-soft/50 dark:bg-rk-naranja/10 dark:border-rk-naranja/25 p-3.5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja">
                      Descripción para portales
                    </h3>
                    <BotonCopiar texto={descripcion} clave="descripcion" copiar={copiar} copiado={copiado} etiqueta="Copiar texto" />
                  </div>
                  <p className="text-[13.5px] text-ios-texto dark:text-ios-texto-osc leading-relaxed whitespace-pre-wrap">
                    {descripcion}
                  </p>
                </section>
              )}

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
                          act
                            ? "text-white border-transparent"
                            : "bg-white dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc border-ios-borde dark:border-ios-borde-osc"
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

              {/* El resto de la ficha: cada fila se copia sola, cada bloque entero */}
              {bloques.map((b) => (
                <section key={b.titulo}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja">{b.titulo}</h3>
                    <BotonCopiar
                      texto={bloqueComoTexto(b)}
                      clave={`bloque-${b.titulo}`}
                      copiar={copiar}
                      copiado={copiado}
                      etiqueta="Copiar sección"
                    />
                  </div>
                  <div className="divide-y divide-ios-borde dark:divide-ios-borde-osc">
                    {b.filas.map(([k, v]) => (
                      <FilaCopiable
                        key={k}
                        etiqueta={k}
                        valor={v}
                        clave={`${b.titulo}-${k}`}
                        copiar={copiar}
                        copiado={copiado}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <BotonCopiar
                texto={textoFicha(ficha)}
                clave="ficha-completa"
                copiar={copiar}
                copiado={copiado}
                etiqueta="Copiar la ficha completa"
                className="w-full justify-center py-3 text-[14px]"
              />
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes deslizar{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}
