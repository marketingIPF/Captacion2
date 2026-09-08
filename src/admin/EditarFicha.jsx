import { useMemo, useState } from "react";
import { Loader2, Save, X, AlertCircle } from "lucide-react";
import { SECCIONES } from "../data/secciones.js";
import { camposAplicables, seccionAplica, revisarFicha } from "../lib/ficha.js";
import { validarCampo, normalizarReferencia } from "../lib/validacion.js";
import { Campo } from "../components/Campo.jsx";
import { TipoSelector } from "../components/TipoSelector.jsx";
import { Propietarios } from "../components/Propietarios.jsx";
import { llamar } from "./api.js";

const NORMALIZADORES = { referencia: normalizarReferencia };
const TODOS = new Map(SECCIONES.flatMap((s) => s.fields.map((f) => [f.key, f])));

const hoy = () => new Date().toISOString().slice(0, 10);

/* Ficha de la oficina: editar una que ya existe, o teclear una nueva.

   Monta los MISMOS componentes y el mismo esquema que usa el agente, así que
   los campos condicionales y las validaciones son idénticos: no hay dos ideas
   distintas de qué es una ficha válida.

   En modo "crear" no se exige nada. Son las captaciones de antes de que
   existiera la app: de algunas no queda el propietario ni el tipo, y obligar a
   rellenarlo llevaría a inventárselo. */
export function EditarFicha({ ficha, modo = "editar", agentes = [], onGuardada, onCancelar }) {
  const creando = modo === "crear";
  const [data, setData] = useState(() => ({ ...ficha.data }));
  const [propietarios, setPropietarios] = useState(() =>
    ficha.propietarios?.length ? ficha.propietarios.map((p) => ({ ...p })) : [{ nombre: "", telefono: "", dni: "", email: "" }]
  );
  const [agenteId, setAgenteId] = useState(ficha.agenteId || "");
  const [recibida, setRecibida] = useState(hoy);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (clave, valor) => setData((d) => ({ ...d, [clave]: valor }));

  const alSalir = (clave) => {
    const normalizar = NORMALIZADORES[TODOS.get(clave)?.normalizar];
    if (!normalizar) return;
    setData((d) => {
      const actual = d[clave];
      if (!actual) return d;
      const limpio = normalizar(actual);
      return limpio === actual ? d : { ...d, [clave]: limpio };
    });
  };

  const secciones = useMemo(() => SECCIONES.filter((s) => seccionAplica(s, data)), [data]);
  const problemas = useMemo(
    () => revisarFicha({ ...ficha, data, propietarios }),
    [ficha, data, propietarios]
  );

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      const r = creando
        ? await llamar("crear", {
            ficha: {
              id: ficha.id,
              data,
              propietarios,
              agenteId,
              agenteName: agentes.find((a) => a.id === agenteId)?.name || "",
            },
            recibida,
          })
        : await llamar("editar", { id: ficha.id, data, propietarios });
      onGuardada(r.ficha);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <div className="px-6 py-5 space-y-5">
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-ios-superficie/95 dark:bg-ios-superficie-osc/95 backdrop-blur-xl border-b border-ios-borde dark:border-ios-borde-osc flex items-center gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 rounded-xl bg-rk-naranja px-4 py-2.5 text-[14px] font-bold text-white active:scale-95 transition disabled:opacity-60"
        >
          {guardando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
          {guardando ? "Guardando…" : creando ? "Guardar captación" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="flex items-center gap-1.5 rounded-xl border border-ios-borde dark:border-ios-borde-osc px-3.5 py-2.5 text-[14px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc active:scale-95 transition"
        >
          <X size={15} aria-hidden="true" /> Cancelar
        </button>
        <span className="ml-auto text-[11.5px] text-ios-texto3">
          {creando
            ? "Rellena solo lo que sepas. No hay campos obligatorios."
            : "Editas la ficha del agente. Queda registrado."}
        </span>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-[13px] font-semibold text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" /> {error}
        </p>
      )}

      {/* Al crear no se listan: una captación antigua incompleta es lo normal, y
          doce avisos de campos que faltan a propósito solo son ruido. Al
          editar sí, porque ahí sí falta algo que el agente debería haber
          puesto. Nunca bloquean: la oficina puede guardar algo a medias
          mientras aclara un dato. */}
      {!creando && problemas.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5">
          <p className="text-[12.5px] font-bold text-amber-800 mb-1">
            {problemas.length} aviso{problemas.length === 1 ? "" : "s"} (no impiden guardar)
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {problemas.slice(0, 5).map((p, i) => (
              <li key={i} className="text-[12px] text-amber-800">{p.msg}</li>
            ))}
          </ul>
        </div>
      )}

      {creando && (
        <section className="rounded-xl bg-ios-fondo dark:bg-ios-elevada-osc/40 border border-ios-borde dark:border-ios-borde-osc p-4 space-y-3">
          <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja">
            De quién y de cuándo
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[12px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc mb-1.5">
                Agente que la captó
              </span>
              <select
                value={agenteId}
                onChange={(e) => setAgenteId(e.target.value)}
                className="w-full rounded-xl border border-ios-borde dark:border-ios-borde-osc bg-white dark:bg-ios-superficie-osc px-3 py-2.5 text-[14px] text-ios-texto dark:text-ios-texto-osc outline-none focus:border-rk-naranja"
              >
                <option value="">Sin asignar (queda a nombre de la oficina)</option>
                {agentes.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc mb-1.5">
                Fecha de la captación
              </span>
              <input
                type="date"
                value={recibida}
                max={hoy()}
                onChange={(e) => setRecibida(e.target.value)}
                className="w-full rounded-xl border border-ios-borde dark:border-ios-borde-osc bg-white dark:bg-ios-superficie-osc px-3 py-2.5 text-[14px] text-ios-texto dark:text-ios-texto-osc outline-none focus:border-rk-naranja"
              />
              <span className="block text-[11.5px] text-ios-texto3 mt-1">
                Pon la de entonces, no la de hoy: si no, las antiguas contarían
                como captaciones de este mes.
              </span>
            </label>
          </div>
        </section>
      )}

      {secciones.map((sec) => {
        const campos = camposAplicables(sec, data);
        if (!campos.length && sec.id !== "ident") return null;
        return (
          <section key={sec.id}>
            <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-rk-naranja mb-2.5">
              {sec.title}
            </h3>
            <div className="space-y-4">
              {campos.map((def) =>
                def.kind === "tipo" ? (
                  <TipoSelector key={def.key} value={data.tipo} onChange={cambiar} sinObligatorios={creando} />
                ) : (
                  <Campo
                    key={def.key}
                    def={def}
                    value={data[def.key]}
                    error={def.validate ? validarCampo(def.validate, data[def.key], data) : ""}
                    onChange={cambiar}
                    onBlur={alSalir}
                    sinObligatorios={creando}
                  />
                )
              )}
              {sec.id === "ident" && (
                <div>
                  <div className="text-[12px] font-semibold text-ios-texto2 dark:text-ios-texto2-osc mb-2">
                    Propietarios
                  </div>
                  <Propietarios list={propietarios} onChange={setPropietarios} />
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
