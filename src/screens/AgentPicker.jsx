import { useMemo, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { Logo } from "../components/Logo.jsx";
import { Avatar } from "../components/Avatar.jsx";

export function AgentPicker({ agentes, onSelect, ultimo }) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return agentes;
    return agentes.filter(
      (a) => a.name.toLowerCase().includes(t) || (a.role || "").toLowerCase().includes(t)
    );
  }, [q, agentes]);

  const ultimoValido = useMemo(
    () => (ultimo ? agentes.find((a) => a.id === ultimo.id) : null),
    [ultimo, agentes]
  );

  return (
    <div className="min-h-screen flex flex-col bg-ios-fondo">
      <header className="px-6 pt-16 pb-4">
        <Logo orientacion="horizontal" tema="tinta" alto={30} />
        <h1 className="text-[28px] font-extrabold leading-tight mt-4 text-ios-texto">Ficha de Captación</h1>
        <p className="text-ios-texto2 mt-1 text-[15px]">Selecciona tu nombre para comenzar</p>
        <div className="relative mt-5">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-texto3" aria-hidden="true" />
          <label htmlFor="buscar-agente" className="sr-only">Buscar agente</label>
          <input
            id="buscar-agente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar agente…"
            className="w-full bg-white text-ios-texto placeholder-ios-texto3 rounded-2xl pl-11 pr-4 py-3.5 text-[16px] outline-none border border-ios-borde focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20 transition"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {ultimoValido && !q && (
          <button
            type="button"
            onClick={() => onSelect(ultimoValido)}
            className="w-full flex items-center gap-3 bg-white rounded-2xl border-2 border-rk-naranja px-4 py-3.5 mb-3 active:scale-[0.99] transition text-left"
          >
            <Avatar agente={ultimoValido} tam={44} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wide text-rk-naranja">Continuar como</div>
              <div className="font-semibold text-ios-texto truncate text-[15px]">{ultimoValido.name}</div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-rk-naranja" aria-hidden="true" />
          </button>
        )}

        <ul className="bg-white rounded-2xl border border-ios-borde overflow-hidden divide-y divide-ios-borde">
          {list.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-ios-fondo transition text-left"
              >
                <Avatar agente={a} tam={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ios-texto truncate text-[15px]">{a.name}</div>
                  <div className="text-[13px] text-ios-texto2 truncate">{a.role}</div>
                </div>
                <ChevronRight size={18} className="text-ios-separador shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {list.length === 0 && (
          <p className="text-center text-ios-texto2 py-12 text-[14px]">Sin resultados para «{q}»</p>
        )}
      </div>
    </div>
  );
}
