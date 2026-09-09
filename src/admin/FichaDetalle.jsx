import { useEffect, useRef, useState } from "react";
import { X, Loader2, Phone, Mail, MapPin, MessageCircle, AlertCircle, Pencil, Printer, Trash2 } from "lucide-react";
import {
  bloquesFicha, bloqueComoTexto, textoFicha, tituloFicha, direccionCompleta, cifrasClave,
} from "../lib/resumen.js";
import { fmtFecha, fmtPrecio } from "../lib/format.js";
import { TIPOS_INMUEBLE } from "../data/tipos.js";
import { Avatar } from "../components/Avatar.jsx";
import { llamar, ESTADOS } from "./api.js";
import { useCopiar } from "./useCopiar.js";
import { FilaCopiable, BotonCopiar, ValorCopiable } from "./Copiable.jsx";
import { EditarFicha } from "./EditarFicha.jsx";
import { FichaImprimible } from "./Imprimible.jsx";

const soloDigitos = (t) => String(t || "").replace(/[^\d+]/g, "");

export function FichaDetalle({ id, enfocar, onCerrar, onActualizada, onEliminada }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const panel = useRef(null);
  const campoNota = useRef(null);
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

  /* Si se ha entrado por el botón de anotaciones, se va derecho a la nota:
     está por debajo de varias secciones y buscarla a mano cada vez sería el
     trabajo que este botón viene a evitar. */
  useEffect(() => {
    if (!ficha || enfocar !== "nota" || !campoNota.current) return;
    campoNota.current.scrollIntoView({ block: "center", behavior: "smooth" });
    campoNota.current.focus({ preventScroll: true });
  }, [ficha, enfocar]);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  /* El documento se monta, se deja pintar y se abre el diálogo del sistema.
     Sin los dos frames, Chrome puede imprimir la hoja en blanco. */
  const imprimir = async () => {
    setImprimiendo(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.print();
    setImprimiendo(false);
  };

  const eliminar = async () => {
    if (borrando) return;
    setBorrando(true);
    try {
      await llamar("eliminar", { id });
      onEliminada?.(id);
      onCerrar();
    } catch (e) {
      setError(e.message);
      setBorrando(false);
    }
  };

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
                    <ValorCopiable
                      valor={ficha.data.operacion || ""}
                      clave="operacion"
                      copiar={copiar}
                      copiado={copiado}
                      etiqueta="la operación"
                      className="block text-[11px] font-bold tracking-[0.15em] uppercase text-rk-naranja"
                    >
                      {ficha.data.operacion || "Captación"}
                    </ValorCopiable>
                    <ValorCopiable
                      valor={tituloFicha(ficha)}
                      clave="titulo"
                      copiar={copiar}
                      copiado={copiado}
                      etiqueta="el título"
                      className="block text-[20px] font-extrabold leading-tight text-ios-texto dark:text-ios-texto-osc"
                    >
                      <h2>{tituloFicha(ficha)}</h2>
                    </ValorCopiable>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0 text-[12.5px] text-ios-texto2 dark:text-ios-texto2-osc">
                      <Avatar agente={{ id: ficha.agenteId, name: ficha.agenteName }} tam={20} />
                      <ValorCopiable valor={ficha.agenteName} clave="agente" copiar={copiar} copiado={copiado} etiqueta="el agente" />
                      <span aria-hidden="true">·</span>
                      <ValorCopiable valor={fmtFecha(ficha.recibida)} clave="fecha" copiar={copiar} copiado={copiado} etiqueta="la fecha" className="whitespace-nowrap" />
                      {ficha.origen === "oficina" && (
                        /* Aquí sí cabe el nombre completo: es la cabecera de la
                           ficha, no una celda de tabla. */
                        <span className="rounded-md bg-ios-fondo dark:bg-ios-elevada-osc px-1.5 py-0.5 text-[11px] font-bold text-ios-texto2 dark:text-ios-texto2-osc whitespace-nowrap">
                          {ficha.creadaPorNombre || ficha.creadaPor
                            ? `Añadida manualmente por ${ficha.creadaPorNombre || ficha.creadaPor}`
                            : "Añadida manualmente"}
                        </span>
                      )}
                      {ficha.corregida && (
                        <span className="rounded-md bg-rk-soft px-1.5 py-0.5 text-[11px] font-bold text-rk-naranja whitespace-nowrap">
                          Corregida por el agente · {fmtFecha(ficha.corregida)}
                        </span>
                      )}
                      {ficha.data.referencia && (
                        <>
                          <span aria-hidden="true">·</span>
                          <ValorCopiable valor={ficha.data.referencia} clave="referencia" copiar={copiar} copiado={copiado} etiqueta="la referencia" className="font-semibold" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Copia el número pelado (385000), que es lo que pide un
                      campo de formulario. La versión con formato está en la
                      fila de "Datos económicos". */}
                  <ValorCopiable
                    valor={String(ficha.data.precio ?? "")}
                    clave="precio"
                    copiar={copiar}
                    copiado={copiado}
                    etiqueta="el precio"
                    className="text-[24px] font-extrabold text-rk-naranja whitespace-nowrap"
                  >
                    {fmtPrecio(ficha.data.precio)}
                  </ValorCopiable>
                  {!editando && (
                    <button
                      type="button"
                      onClick={imprimir}
                      aria-label="Imprimir la ficha"
                      title="Imprimir la ficha"
                      className="w-9 h-9 rounded-lg bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc flex items-center justify-center active:scale-95 transition"
                    >
                      <Printer size={16} />
                    </button>
                  )}
                  {!editando && (
                    <button
                      type="button"
                      onClick={() => setEditando(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc px-3 h-9 text-[13px] font-semibold active:scale-95 transition"
                    >
                      <Pencil size={14} aria-hidden="true" /> Editar
                    </button>
                  )}
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

            {editando ? (
              <EditarFicha
                ficha={ficha}
                onCancelar={() => setEditando(false)}
                onGuardada={(actualizada) => {
                  setFicha(actualizada);
                  setEditando(false);
                  /* El listado muestra dirección, precio y estado: si cambian
                     hay que refrescarlo, no solo esta ficha. */
                  onActualizada?.({ id: actualizada.id, estado: actualizada.estado, recargar: true });
                }}
              />
            ) : (
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
                    <ValorCopiable
                      valor={direccion}
                      clave="direccion-texto"
                      copiar={copiar}
                      copiado={copiado}
                      etiqueta="la dirección"
                      className="text-[14px] font-medium text-ios-texto dark:text-ios-texto-osc leading-snug"
                    />
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
                          {/* Cada dato se copia por separado; las acciones
                              (llamar, WhatsApp, escribir) van como iconos al
                              lado para no robarle el clic al copiado. */}
                          <ValorCopiable
                            valor={p.nombre || ""}
                            clave={`nombre-${i}`}
                            copiar={copiar}
                            copiado={copiado}
                            etiqueta="el nombre"
                            className="font-semibold text-ios-texto dark:text-ios-texto-osc text-[15px]"
                          >
                            {p.nombre || "—"}
                          </ValorCopiable>
                          <BotonCopiar
                            texto={[p.nombre, p.telefono, p.dni, p.email].filter(Boolean).join(" · ")}
                            clave={`prop-${i}`}
                            copiar={copiar}
                            copiado={copiado}
                            etiqueta="Copiar todo"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
                          {p.telefono && (
                            <span className="flex items-center gap-1 rounded-lg bg-rk-soft pl-2.5 pr-1 py-1">
                              <ValorCopiable
                                valor={p.telefono}
                                clave={`tel-${i}`}
                                copiar={copiar}
                                copiado={copiado}
                                etiqueta="el teléfono"
                                className="text-[13px] font-bold text-rk-naranja"
                              />
                              <a
                                href={`tel:${soloDigitos(p.telefono)}`}
                                aria-label={`Llamar a ${p.nombre || "el propietario"}`}
                                title="Llamar"
                                className="w-6 h-6 rounded flex items-center justify-center text-rk-naranja hover:bg-white/60"
                              >
                                <Phone size={13} aria-hidden="true" />
                              </a>
                              <a
                                href={`https://wa.me/${soloDigitos(p.telefono).replace(/^\+?34?/, "34")}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                aria-label={`Escribir por WhatsApp a ${p.nombre || "el propietario"}`}
                                title="WhatsApp"
                                className="w-6 h-6 rounded flex items-center justify-center text-rk-naranja hover:bg-white/60"
                              >
                                <MessageCircle size={13} aria-hidden="true" />
                              </a>
                            </span>
                          )}
                          {p.email && (
                            <span className="flex items-center gap-1">
                              <ValorCopiable
                                valor={p.email}
                                clave={`email-${i}`}
                                copiar={copiar}
                                copiado={copiado}
                                etiqueta="el email"
                                className="text-[13px] font-semibold text-rk-naranja break-all"
                              />
                              <a
                                href={`mailto:${p.email}`}
                                aria-label={`Escribir a ${p.email}`}
                                title="Escribir un correo"
                                className="w-6 h-6 rounded flex items-center justify-center text-rk-naranja"
                              >
                                <Mail size={13} aria-hidden="true" />
                              </a>
                            </span>
                          )}
                          {p.dni && (
                            <ValorCopiable
                              valor={p.dni}
                              clave={`dni-${i}`}
                              copiar={copiar}
                              copiado={copiado}
                              etiqueta="el DNI"
                              className="text-[12.5px] text-ios-texto2 dark:text-ios-texto2-osc"
                            >
                              DNI {p.dni}
                            </ValorCopiable>
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
                  {/* Este texto NO se convierte en botón a propósito: es
                      largo y hay que poder seleccionar una frase suelta. El
                      botón de arriba copia el conjunto. */}
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
                <div className="flex items-center justify-between gap-3 mt-4 mb-1.5">
                  <label htmlFor="nota" className="text-[12px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc">
                    Nota interna de oficina
                  </label>
                  {nota && (
                    <BotonCopiar texto={nota} clave="nota" copiar={copiar} copiado={copiado} />
                  )}
                </div>
                <textarea
                  id="nota"
                  ref={campoNota}
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
                    {b.filas.map(([k, v, vacia]) => (
                      <FilaCopiable
                        key={k}
                        etiqueta={k}
                        valor={v}
                        vacia={vacia}
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

              {/* Borrar va al final y en dos pasos: es la única acción del
                  panel que quita algo del móvil del agente. */}
              <div className="pt-2 border-t border-ios-borde dark:border-ios-borde-osc">
                {!confirmandoBorrado ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrado(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-red-600 active:scale-95 transition"
                  >
                    <Trash2 size={15} aria-hidden="true" /> Eliminar esta captación
                  </button>
                ) : (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3.5">
                    <p className="text-[13px] text-red-800 leading-snug">
                      Se eliminará del panel y también del historial de{" "}
                      <strong>{ficha.agenteName}</strong> en su móvil, la próxima vez
                      que abra la app.
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <button
                        type="button"
                        onClick={eliminar}
                        disabled={borrando}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 text-white px-3.5 py-2 text-[13px] font-bold active:scale-95 transition disabled:opacity-60"
                      >
                        {borrando && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoBorrado(false)}
                        className="rounded-xl border border-ios-borde dark:border-ios-borde-osc px-3.5 py-2 text-[13px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc active:scale-95 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {ficha.actualizadaPor && (
                <p className="text-[11.5px] text-ios-texto3 text-center">
                  Última modificación en oficina: {ficha.actualizadaPor}
                  {ficha.actualizada ? ` · ${fmtFecha(ficha.actualizada)}` : ""}
                </p>
              )}
            </div>
            )}
          </>
        )}
      </div>
      {imprimiendo && ficha && <FichaImprimible ficha={ficha} />}
      <style>{`@keyframes deslizar{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}
