import { memo } from "react";
import { Check } from "lucide-react";
import { limpiarNumero } from "../lib/validacion.js";

/* Hundido: un campo donde se escribe se lee como un hueco, no como un relieve.
   El borde se mantiene transparente en reposo pero SE PINTA al enfocar y al
   fallar: el neumorfismo suelto deja los límites difusos, y aquí hay que ver
   dónde se está escribiendo. */
export const inputBase =
  "neu-hundido w-full rounded-xl px-3.5 py-3 text-[15px] text-ios-texto outline-none border transition placeholder-ios-texto3";
export const inputOk = "border-transparent focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20";
export const inputErr = "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
export const lblBase = "text-[12px] font-semibold text-ios-texto2 mb-1.5 block";

function Etiqueta({ id, children, requerido }) {
  return (
    <label htmlFor={id} className={lblBase}>
      {children}
      {requerido && <span className="text-rk-naranja ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}

function Error({ id, msg }) {
  if (!msg) return null;
  return (
    <p id={id} className="text-[12px] font-medium text-red-600 mt-1">
      {msg}
    </p>
  );
}

/* `sinObligatorios` quita los asteriscos. Lo usa la oficina al teclear una
   captación antigua: ahí no hay campos obligatorios de verdad, y marcar unos
   cuantos con asterisco mientras la cabecera dice lo contrario solo confunde. */
export const Campo = memo(function Campo({ def, value, error, onChange, onBlur, sinObligatorios = false }) {
  const id = `campo-${def.key}`;
  const errId = `${id}-error`;
  const requerido = def.required && !sinObligatorios;
  const aria = { "aria-invalid": !!error, "aria-describedby": error ? errId : undefined };

  if (def.kind === "txt" || def.kind === "num") {
    const esNum = def.kind === "num";
    return (
      <div>
        <Etiqueta id={id} requerido={requerido}>
          {def.label}
          {esNum && def.unidad ? <span className="text-ios-texto3 font-normal"> · {def.unidad}</span> : null}
        </Etiqueta>
        <input
          id={id}
          value={value ?? ""}
          placeholder={def.ph || (esNum ? def.unidad : "")}
          inputMode={esNum ? "decimal" : def.inputMode || "text"}
          enterKeyHint="next"
          autoComplete="off"
          onChange={(e) => onChange(def.key, esNum ? limpiarNumero(e.target.value) : e.target.value)}
          onBlur={() => onBlur?.(def.key)}
          className={`${inputBase} ${error ? inputErr : inputOk}`}
          {...aria}
        />
        <Error id={errId} msg={error} />
      </div>
    );
  }

  if (def.kind === "area") {
    return (
      <div>
        <Etiqueta id={id} requerido={requerido}>{def.label}</Etiqueta>
        <textarea
          id={id}
          value={value ?? ""}
          placeholder={def.ph}
          rows={def.rows || 3}
          onChange={(e) => onChange(def.key, e.target.value)}
          onBlur={() => onBlur?.(def.key)}
          className={`${inputBase} ${error ? inputErr : inputOk} resize-y min-h-[84px]`}
          {...aria}
        />
        <Error id={errId} msg={error} />
      </div>
    );
  }

  if (def.kind === "seg") {
    return (
      <fieldset>
        <legend className={lblBase}>
          {def.label}
          {requerido && <span className="text-rk-naranja ml-0.5" aria-hidden="true">*</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const act = value === o;
            return (
              <button
                key={o}
                type="button"
                aria-pressed={act}
                onClick={() => onChange(def.key, act ? "" : o)}
                /* La opción elegida se queda en naranja macizo, no hundida:
                   es un dato de la ficha y tiene que cantar. El relieve se
                   reserva para las que no están elegidas. */
                className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition active:scale-95 ${
                  act ? "bg-rk-naranja text-white border-transparent shadow-sm" : "neu-suave text-gray-700 border-transparent"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
        <Error id={errId} msg={error} />
      </fieldset>
    );
  }

  if (def.kind === "chips") {
    /* Las fichas guardadas antes de que un campo admitiera varias opciones
       tienen ahí un texto, no una lista. Sin esto, abrir una de esas para
       corregirla reventaba al pulsar: los textos no tienen .filter(). */
    const arr = Array.isArray(value) ? value : value ? [value] : [];

    /* Opciones que no admiten compañía: marcar "No tiene" y además "Gas" sería
       una ficha que se contradice a sí misma. */
    const exclusivas = def.exclusivas || [];
    const alPulsar = (o, act) => {
      if (act) return onChange(def.key, arr.filter((x) => x !== o));
      if (exclusivas.includes(o)) return onChange(def.key, [o]);
      return onChange(def.key, [...arr.filter((x) => !exclusivas.includes(x)), o]);
    };

    return (
      <fieldset>
        <legend className={lblBase}>{def.label}</legend>
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const act = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={act}
                onClick={() => alPulsar(o, act)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition active:scale-95 flex items-center gap-1 ${
                  act
                    ? "neu-hundido bg-rk-soft text-rk-naranja border-rk-naranja"
                    : "neu-suave text-gray-700 border-transparent"
                }`}
              >
                {act && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                {o}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return null;
});
