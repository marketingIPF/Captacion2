import { memo } from "react";
import { Check } from "lucide-react";
import { limpiarNumero } from "../lib/validacion.js";

export const inputBase =
  "w-full bg-white rounded-xl px-3.5 py-3 text-[15px] text-ios-texto outline-none border transition placeholder-ios-texto3";
export const inputOk = "border-ios-borde focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20";
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

export const Campo = memo(function Campo({ def, value, error, onChange, onBlur }) {
  const id = `campo-${def.key}`;
  const errId = `${id}-error`;
  const aria = { "aria-invalid": !!error, "aria-describedby": error ? errId : undefined };

  if (def.kind === "txt" || def.kind === "num") {
    const esNum = def.kind === "num";
    return (
      <div>
        <Etiqueta id={id} requerido={def.required}>
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
        <Etiqueta id={id} requerido={def.required}>{def.label}</Etiqueta>
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
          {def.required && <span className="text-rk-naranja ml-0.5" aria-hidden="true">*</span>}
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
                className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition active:scale-95 ${
                  act ? "bg-rk-naranja text-white border-transparent shadow-sm" : "bg-white text-gray-700 border-ios-borde"
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
    const arr = value || [];
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
                onClick={() => onChange(def.key, act ? arr.filter((x) => x !== o) : [...arr, o])}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition active:scale-95 flex items-center gap-1 ${
                  act ? "bg-rk-soft text-rk-naranja border-rk-naranja" : "bg-white text-gray-700 border-ios-borde"
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
