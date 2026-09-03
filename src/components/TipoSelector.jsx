import { memo } from "react";
import { TIPOS_INMUEBLE } from "../data/tipos.js";
import { lblBase } from "./Campo.jsx";

export const TipoSelector = memo(function TipoSelector({ value, onChange }) {
  return (
    <fieldset>
      <legend className={lblBase}>
        Tipo de inmueble<span className="text-rk-naranja ml-0.5" aria-hidden="true">*</span>
      </legend>
      <p className="text-[11px] text-ios-texto3 -mt-1 mb-2">
        Determina qué campos se piden más abajo.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TIPOS_INMUEBLE.map((t) => {
          const Icon = t.icon;
          const act = value === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={act}
              onClick={() => onChange("tipo", t.key)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition active:scale-95 ${
                act ? "bg-rk-soft text-rk-naranja border-rk-naranja shadow-sm" : "bg-white text-ios-texto2 border-ios-borde"
              }`}
            >
              <Icon size={20} strokeWidth={act ? 2.4 : 2} className={act ? "text-rk-naranja" : ""} aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-tight text-center">{t.key}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
});
