import { useRef, useState } from "react";
import { Search, Loader2, Check, AlertCircle, X, Building2 } from "lucide-react";
import { inputBase, inputOk, inputErr, lblBase } from "./Campo.jsx";
import { consultarCatastro, camposDesde, etiquetaUnidad, tipoDeRef, limpiarRef } from "../lib/catastro.js";

/* Referencia catastral con consulta al Catastro.
   Con 20 caracteres rellena la ficha directamente; con 14 (la parcela entera)
   muestra las unidades para que el agente elija la suya. */
export function RefCatastral({ def, value, error, onChange, onRellenar, onBlur, tipoElegido }) {
  const [estado, setEstado] = useState("idle"); // idle | buscando | elegir | ok
  const [unidades, setUnidades] = useState([]);
  const [aviso, setAviso] = useState("");
  const [rellenados, setRellenados] = useState(0);
  const peticion = useRef(null);

  const ref = limpiarRef(value);
  const puedeBuscar = !!tipoDeRef(ref);

  const buscar = async () => {
    if (!puedeBuscar || estado === "buscando") return;
    peticion.current?.abort();
    peticion.current = new AbortController();
    setEstado("buscando");
    setAviso("");
    setUnidades([]);

    const r = await consultarCatastro(ref, { signal: peticion.current.signal });
    if (r.cancelado) return;

    if (!r.ok) {
      setEstado("idle");
      setAviso(r.error);
      return;
    }
    if (r.unidades.length === 1) {
      aplicar(r.unidades[0]);
      return;
    }
    setUnidades(r.unidades);
    setEstado("elegir");
  };

  const aplicar = (unidad) => {
    const campos = camposDesde(unidad);
    onRellenar(campos, unidad.tipoSugerido);
    setRellenados(Object.keys(campos).length);
    setUnidades([]);
    setEstado("ok");
    setAviso("");
  };

  const id = `campo-${def.key}`;
  const errId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className={lblBase}>
        {def.label}
        <span className="text-ios-texto3 font-normal"> · 14 o 20 caracteres</span>
      </label>

      <div className="flex gap-2">
        <input
          id={id}
          value={value ?? ""}
          placeholder="Ej. 6121104YJ2762A0001WJ"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            onChange(def.key, e.target.value.toUpperCase());
            if (estado === "ok" || estado === "elegir") setEstado("idle");
            setAviso("");
          }}
          onBlur={() => onBlur?.(def.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); buscar(); }
          }}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          className={`${inputBase} ${error ? inputErr : inputOk} flex-1 font-mono tracking-tight`}
        />
        <button
          type="button"
          onClick={buscar}
          disabled={!puedeBuscar || estado === "buscando"}
          className="shrink-0 flex items-center gap-1.5 px-3.5 rounded-xl font-semibold text-[13.5px] text-white bg-rk-naranja active:scale-95 transition disabled:opacity-40"
        >
          {estado === "buscando" ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={16} aria-hidden="true" />
          )}
          Buscar
        </button>
      </div>

      {error && <p id={errId} className="text-[12px] font-medium text-red-600 mt-1">{error}</p>}

      {!error && !aviso && estado === "idle" && (
        <p className="text-[11.5px] text-ios-texto3 mt-1.5 leading-snug">
          Rellena dirección, planta, superficie y año desde el Catastro.
        </p>
      )}

      {aviso && (
        <p role="alert" className="flex items-start gap-1.5 text-[12px] font-medium text-amber-700 mt-1.5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" /> {aviso}
        </p>
      )}

      {estado === "ok" && (
        <div role="status" className="mt-1.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-green-700">
            <Check size={14} strokeWidth={3} aria-hidden="true" />
            {rellenados} campo{rellenados === 1 ? "" : "s"} rellenado{rellenados === 1 ? "" : "s"} desde el Catastro
          </p>
          {!tipoElegido && (
            <p className="flex items-start gap-1.5 text-[12px] text-amber-700 mt-1 leading-snug">
              <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
              Elige arriba el tipo de inmueble para ver la planta, la puerta y la
              superficie que ha traído.
            </p>
          )}
        </div>
      )}

      {estado === "elegir" && unidades.length > 0 && (
        <div className="mt-2.5 rounded-2xl border border-rk-softBorde bg-rk-soft overflow-hidden">
          <div className="flex items-start gap-2 px-3.5 py-2.5">
            <Building2 size={15} className="text-rk-naranja shrink-0 mt-0.5" aria-hidden="true" />
            <p className="flex-1 text-[12.5px] text-ios-texto leading-snug">
              Esa referencia es de la parcela entera y tiene{" "}
              <strong>{unidades.length} inmuebles</strong>. Elige el que estás captando.
            </p>
            <button
              type="button"
              onClick={() => { setUnidades([]); setEstado("idle"); }}
              aria-label="Cerrar la lista"
              className="shrink-0 text-ios-texto3"
            >
              <X size={16} />
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto bg-white divide-y divide-ios-borde">
            {unidades.map((u) => {
              const { sitio, datos } = etiquetaUnidad(u);
              return (
                <li key={u.ref}>
                  <button
                    type="button"
                    onClick={() => aplicar(u)}
                    className="w-full text-left px-3.5 py-2.5 active:bg-ios-fondo transition"
                  >
                    <div className="text-[13.5px] font-semibold text-ios-texto">{sitio}</div>
                    <div className="text-[12px] text-ios-texto2">{datos}</div>
                    <div className="text-[10.5px] text-ios-texto3 font-mono mt-0.5">{u.ref}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
