import { memo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { inputBase, inputOk, inputErr } from "./Campo.jsx";
import { validarDni, validarTelefono, validarEmail } from "../lib/validacion.js";

const VACIO = { nombre: "", telefono: "", dni: "", email: "" };

export const Propietarios = memo(function Propietarios({ list, onChange }) {
  const [tocados, setTocados] = useState({});
  const upd = (i, k, v) => onChange(list.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  const marcar = (i, k) => setTocados((t) => ({ ...t, [`${i}-${k}`]: true }));

  const errorDe = (i, k, valor) => {
    if (!tocados[`${i}-${k}`]) return "";
    if (k === "telefono") return validarTelefono(valor);
    if (k === "dni") return validarDni(valor);
    if (k === "email") return validarEmail(valor);
    return "";
  };

  const cls = (err) => `${inputBase} ${err ? inputErr : inputOk}`;

  return (
    <div className="space-y-3">
      {list.map((p, i) => {
        const eTel = errorDe(i, "telefono", p.telefono);
        const eDni = errorDe(i, "dni", p.dni);
        const eMail = errorDe(i, "email", p.email);
        return (
          <div key={i} className="bg-ios-fondo rounded-2xl p-3.5 border border-ios-borde space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wide text-rk-naranja">
                Propietario {i + 1}
              </span>
              {list.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(list.filter((_, idx) => idx !== i))}
                  aria-label={`Eliminar propietario ${i + 1}`}
                  className="text-ios-texto3 hover:text-red-500 active:scale-90 transition p-1"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>

            <input
              value={p.nombre}
              onChange={(e) => upd(i, "nombre", e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="off"
              aria-label={`Nombre del propietario ${i + 1}`}
              className={cls("")}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  value={p.telefono}
                  onChange={(e) => upd(i, "telefono", e.target.value)}
                  onBlur={() => marcar(i, "telefono")}
                  inputMode="tel"
                  placeholder="Teléfono"
                  aria-label={`Teléfono del propietario ${i + 1}`}
                  aria-invalid={!!eTel}
                  className={cls(eTel)}
                />
                {eTel && <p className="text-[11px] text-red-600 mt-1">{eTel}</p>}
              </div>
              <div>
                <input
                  value={p.dni}
                  onChange={(e) => upd(i, "dni", e.target.value.toUpperCase())}
                  onBlur={() => marcar(i, "dni")}
                  placeholder="DNI / NIE"
                  aria-label={`DNI del propietario ${i + 1}`}
                  aria-invalid={!!eDni}
                  className={cls(eDni)}
                />
                {eDni && <p className="text-[11px] text-red-600 mt-1">{eDni}</p>}
              </div>
            </div>

            <div>
              <input
                value={p.email}
                onChange={(e) => upd(i, "email", e.target.value)}
                onBlur={() => marcar(i, "email")}
                inputMode="email"
                placeholder="Email (opcional)"
                aria-label={`Email del propietario ${i + 1}`}
                aria-invalid={!!eMail}
                className={cls(eMail)}
              />
              {eMail && <p className="text-[11px] text-red-600 mt-1">{eMail}</p>}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...list, { ...VACIO }])}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-ios-texto2 font-semibold text-[14px] active:scale-95 transition"
      >
        <Plus size={16} aria-hidden="true" /> Añadir propietario
      </button>
    </div>
  );
});
