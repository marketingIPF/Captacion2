import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Send, Save, User, AlertCircle, Check } from "lucide-react";
import { SECCIONES } from "../data/secciones.js";
import { camposAplicables, calcularProgreso, revisarFicha, seccionAplica } from "../lib/ficha.js";
import { validarCampo } from "../lib/validacion.js";
import { Avatar } from "../components/Avatar.jsx";
import { Campo } from "../components/Campo.jsx";
import { RefCatastral } from "../components/RefCatastral.jsx";
import { TipoSelector } from "../components/TipoSelector.jsx";
import { Propietarios } from "../components/Propietarios.jsx";
import { PreviewModal } from "./PreviewModal.jsx";
import { useToast } from "../hooks/useToast.jsx";

export function Formulario({ agente, agentes, pin, ficha, setFicha, onSaveDraft, onEnviada, onChangeAgent }) {
  const [abierta, setAbierta] = useState("ident");
  const [preview, setPreview] = useState(false);
  const [tocados, setTocados] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const toast = useToast();

  const setData = useCallback(
    (k, v) => setFicha((f) => ({ ...f, data: { ...f.data, [k]: v } })),
    [setFicha]
  );
  const setProps = useCallback(
    (list) => setFicha((f) => ({ ...f, propietarios: list })),
    [setFicha]
  );
  const marcarTocado = useCallback((k) => setTocados((t) => ({ ...t, [k]: true })), []);

  /* Relleno desde el Catastro: sobrescribe lo que hubiera escrito el agente,
     porque el dato oficial manda. El tipo de inmueble es la excepción: decide
     qué campos existen y el Catastro no distingue piso de ático ni de chalet,
     así que solo se propone si aún está vacío. */
  const rellenarDesdeCatastro = useCallback(
    (campos, tipoSugerido) => {
      setFicha((f) => {
        const data = { ...f.data, ...campos };
        if (tipoSugerido && !f.data.tipo) data.tipo = tipoSugerido;
        return { ...f, data };
      });
      setTocados((t) => ({ ...t, ...Object.fromEntries(Object.keys(campos).map((k) => [k, true])) }));
      toast("Datos del Catastro aplicados");
    },
    [setFicha, toast]
  );

  const progreso = useMemo(() => calcularProgreso(ficha), [ficha]);
  const errores = useMemo(() => revisarFicha(ficha), [ficha]);
  const puedeEnviar = errores.length === 0;

  const secciones = useMemo(() => SECCIONES.filter((s) => seccionAplica(s, ficha.data)), [ficha.data]);

  /* Un error solo se pinta si el usuario ya tocó el campo o ya intentó enviar. */
  const errorDe = (campo, valor) => {
    if (!campo.validate) return "";
    if (!tocados[campo.key] && !mostrarErrores) return "";
    return validarCampo(campo.validate, valor, ficha.data);
  };

  const erroresDeSeccion = (secId) =>
    mostrarErrores ? errores.filter((e) => e.sec === secId).length : 0;

  const intentarEnviar = () => {
    if (puedeEnviar) {
      setPreview(true);
      return;
    }
    setMostrarErrores(true);
    const primero = errores[0];
    setAbierta(primero.sec);
    toast(primero.msg, "error");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardarBorrador = () => {
    onSaveDraft();
    toast("Borrador guardado");
  };

  return (
    <div className="min-h-screen bg-ios-fondo pb-[calc(env(safe-area-inset-bottom)+96px)]">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-ios-borde px-5 pt-12 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <Avatar agente={agente} tam={36} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-widest uppercase text-rk-naranja">Nueva ficha</p>
              <p className="text-[15px] font-semibold text-ios-texto truncate">{agente.name}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[20px] font-extrabold text-rk-tinta leading-none">{progreso}%</div>
            <div className="text-[10px] text-ios-texto2">completado</div>
          </div>
        </div>
        <div
          className="h-1.5 bg-ios-fondo rounded-full mt-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de la ficha"
        >
          <div className="h-full rounded-full bg-rk-naranja transition-all duration-500" style={{ width: `${progreso}%` }} />
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {secciones.map((sec) => {
          const Icon = sec.icon;
          const isOpen = abierta === sec.id;
          const campos = camposAplicables(sec, ficha.data);
          const nErrores = erroresDeSeccion(sec.id);
          const panelId = `panel-${sec.id}`;

          return (
            <section key={sec.id} className="bg-white rounded-2xl shadow-sm border border-ios-borde overflow-hidden">
              <h2>
                <button
                  type="button"
                  onClick={() => setAbierta(isOpen ? "" : sec.id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full flex items-center gap-3 p-4 active:bg-ios-fondo transition-colors text-left"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                      isOpen ? "bg-rk-naranja" : "bg-rk-soft"
                    }`}
                  >
                    <Icon size={18} className={isOpen ? "text-white" : "text-rk-naranja"} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-ios-texto2">SECCIÓN {sec.n}</div>
                    <div className="font-semibold text-ios-texto text-[15px]">{sec.title}</div>
                  </div>
                  {nErrores > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 shrink-0">
                      <AlertCircle size={14} aria-hidden="true" />
                      {nErrores}
                      <span className="sr-only">errores en esta sección</span>
                    </span>
                  )}
                  <ChevronDown
                    size={20}
                    className="text-ios-texto3 transition-transform duration-300 shrink-0"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    aria-hidden="true"
                  />
                </button>
              </h2>

              <div
                id={panelId}
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  {/* inert saca el contenido plegado del orden de tabulación y de
                      los lectores de pantalla, sin cortar la animación. */}
                  <div
                    className={`px-4 pb-5 pt-1 space-y-4 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"}`}
                    inert={isOpen ? undefined : ""}
                  >
                    {sec.id === "ident" && (
                      <div>
                        <label htmlFor="agente-select" className="text-[12px] font-semibold text-ios-texto2 mb-1.5 block">
                          Agente captador
                        </label>
                        <div className="relative">
                          <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-rk-naranja" aria-hidden="true" />
                          <select
                            id="agente-select"
                            value={agente.id}
                            onChange={(e) => onChangeAgent(e.target.value)}
                            className="w-full appearance-none bg-white rounded-xl pl-10 pr-9 py-3 text-[15px] font-medium text-ios-texto outline-none border border-ios-borde focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20 transition"
                          >
                            {agentes.map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-texto3 pointer-events-none" aria-hidden="true" />
                        </div>
                      </div>
                    )}

                    {campos.map((def) =>
                      def.kind === "tipo" ? (
                        <TipoSelector key={def.key} value={ficha.data.tipo} onChange={setData} />
                      ) : def.kind === "catastro" ? (
                        <RefCatastral
                          key={def.key}
                          def={def}
                          value={ficha.data[def.key]}
                          error={errorDe(def, ficha.data[def.key])}
                          onChange={setData}
                          onRellenar={rellenarDesdeCatastro}
                          onBlur={marcarTocado}
                          tipoElegido={ficha.data.tipo}
                        />
                      ) : (
                        <Campo
                          key={def.key}
                          def={def}
                          value={ficha.data[def.key]}
                          error={errorDe(def, ficha.data[def.key])}
                          onChange={setData}
                          onBlur={marcarTocado}
                        />
                      )
                    )}

                    {sec.id === "ident" && (
                      <div>
                        <div className="text-[12px] font-semibold text-ios-texto2 mb-2 mt-1">
                          Propietarios<span className="text-rk-naranja ml-0.5" aria-hidden="true">*</span>
                        </div>
                        <Propietarios list={ficha.propietarios} onChange={setProps} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Resumen de lo que falta, en vez de un botón que no explica por qué no va */}
      {mostrarErrores && errores.length > 0 && (
        <div className="mx-4 mt-4 rounded-2xl bg-red-50 border border-red-200 p-4" role="alert">
          <p className="text-[13px] font-bold text-red-700 mb-1.5">
            Falta{errores.length === 1 ? "" : "n"} {errores.length} dato{errores.length === 1 ? "" : "s"} para enviar
          </p>
          <ul className="space-y-1">
            {errores.slice(0, 6).map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setAbierta(e.sec)}
                  className="text-[12.5px] text-red-700 underline underline-offset-2 text-left"
                >
                  {e.msg}
                </button>
              </li>
            ))}
            {errores.length > 6 && (
              <li className="text-[12.5px] text-red-600">y {errores.length - 6} más…</li>
            )}
          </ul>
        </div>
      )}

      <div className="px-4 mt-5 space-y-2.5">
        <button
          type="button"
          onClick={intentarEnviar}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[17px] text-white bg-rk-naranja active:scale-95 transition"
          style={{ boxShadow: "0 8px 24px rgba(207,115,27,.35)" }}
        >
          <Send size={19} aria-hidden="true" /> Revisar y enviar
        </button>
        <button
          type="button"
          onClick={guardarBorrador}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-ios-borde font-semibold text-gray-700 active:scale-95 transition"
        >
          <Save size={18} aria-hidden="true" /> Guardar borrador
        </button>
        <p className="text-center text-[11.5px] text-ios-texto2 flex items-center justify-center gap-1.5">
          <Check size={13} className="text-green-600" aria-hidden="true" />
          Se guarda solo mientras escribes
        </p>
      </div>

      {preview && (
        <PreviewModal
          ficha={ficha}
          pin={pin}
          onClose={() => setPreview(false)}
          onEnviada={onEnviada}
        />
      )}
    </div>
  );
}
