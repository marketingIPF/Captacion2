import { useState } from "react";
import { iniciales } from "../lib/format.js";

/* Foto del agente, con las iniciales como respaldo: si el archivo no existe
   (alta reciente, avatar sin generar) el círculo sigue siendo legible. */
export function Avatar({ agente, tam = 40, className = "" }) {
  const [falla, setFalla] = useState(false);
  const estilo = { width: tam, height: tam };
  const base = `rounded-full shrink-0 overflow-hidden ${className}`;

  if (agente?.avatar && !falla) {
    return (
      <img
        src={agente.avatar}
        alt=""
        width={tam}
        height={tam}
        loading="lazy"
        decoding="async"
        onError={() => setFalla(true)}
        style={estilo}
        className={`${base} object-cover bg-rk-soft`}
      />
    );
  }

  return (
    <div
      style={{ ...estilo, fontSize: Math.round(tam * 0.36) }}
      aria-hidden="true"
      className={`${base} bg-rk-soft ring-1 ring-rk-softBorde text-rk-naranja flex items-center justify-center font-bold`}
    >
      {iniciales(agente?.name)}
    </div>
  );
}
