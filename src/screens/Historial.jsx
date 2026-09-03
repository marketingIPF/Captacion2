import { useMemo, useState } from "react";
import { Home, Trash2, Send, Pencil, Loader2, AlertCircle, Search, CloudOff, RefreshCw, CheckCircle2, PencilLine } from "lucide-react";
import { TIPOS_INMUEBLE } from "../data/tipos.js";
import { fmtFecha, fmtPrecio } from "../lib/format.js";
import { resumenFicha } from "../lib/ficha.js";

export function Historial({ drafts, sent, enCola = 0, onOpenDraft, onReintentar, onSincronizar, onDelete }) {
  const [tab, setTab] = useState("sent");
  const [q, setQ] = useState("");
  const [reintentando, setReintentando] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);

  const base = tab === "sent" ? sent : drafts;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const orden = base.slice().reverse();
    if (!t) return orden;
    return orden.filter((f) =>
      [resumenFicha(f), f.agenteName, f.data.poblacion, f.data.tipo, f.data.referencia]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(t))
    );
  }, [base, q]);

  const reintentar = async (f) => {
    setReintentando(f.id);
    await onReintentar(f);
    setReintentando(null);
  };

  const sincronizar = async () => {
    setSincronizando(true);
    await onSincronizar();
    setSincronizando(false);
  };

  return (
    <div className="min-h-screen bg-ios-fondo pb-[calc(env(safe-area-inset-bottom)+96px)]">
      <header className="px-6 pt-14 pb-2">
        <h1 className="text-[30px] font-extrabold text-ios-texto">Historial</h1>
        <p className="text-ios-texto2 text-[15px]">Fichas guardadas en este dispositivo</p>
      </header>

      {enCola > 0 && (
        <div className="mx-5 mt-3 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-center gap-3">
          <CloudOff size={19} className="text-amber-600 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-[12.5px] text-amber-900 leading-snug">
            <strong>{enCola} ficha{enCola === 1 ? "" : "s"} sin enviar.</strong> Saldrá
            {enCola === 1 ? "" : "n"} sola{enCola === 1 ? "" : "s"} al recuperar la conexión.
          </p>
          <button
            type="button"
            onClick={sincronizar}
            disabled={sincronizando}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-3 py-2 text-[12.5px] font-bold active:scale-95 transition disabled:opacity-60"
          >
            {sincronizando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
            Reintentar
          </button>
        </div>
      )}

      <div className="px-5 mt-3">
        <div className="flex gap-2 bg-ios-fondo p-1 rounded-2xl" role="tablist">
          {[["sent", `Enviadas ${sent.length}`], ["drafts", `Borradores ${drafts.length}`]].map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-xl text-[14px] font-semibold transition ${
                tab === k ? "bg-white shadow-sm text-rk-naranja" : "text-ios-texto2"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {base.length > 3 && (
          <div className="relative mt-3">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-texto3" aria-hidden="true" />
            <label htmlFor="buscar-ficha" className="sr-only">Buscar ficha</label>
            <input
              id="buscar-ficha"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por dirección, población, referencia…"
              className="w-full bg-white rounded-2xl pl-10 pr-4 py-3 text-[14px] outline-none border border-ios-borde focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20 transition"
            />
          </div>
        )}
      </div>

      <ul className="px-5 mt-4 space-y-2.5">
        {list.length === 0 && (
          <li className="text-center text-ios-texto2 py-16 text-[14px]">
            {q ? `Sin resultados para «${q}»` : "No hay fichas en esta categoría"}
          </li>
        )}

        {list.map((f) => {
          const tipo = TIPOS_INMUEBLE.find((t) => t.key === f.data.tipo);
          const Icon = tipo?.icon || Home;
          const esBorrador = tab === "drafts";
          const enCurso = reintentando === f.id;
          const estadoEnvio = f.envio?.estado || "enviada";

          return (
            <li key={f.id} className="bg-white rounded-2xl shadow-sm border border-ios-borde overflow-hidden">
              <div className="flex items-center gap-3 p-3.5">
                <div className="w-11 h-11 rounded-xl bg-rk-soft flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-rk-naranja" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ios-texto truncate">{resumenFicha(f)}</div>
                  <div className="text-[13px] text-ios-texto2 truncate">
                    {f.agenteName} · {fmtFecha(f.fecha)}
                  </div>
                  {!esBorrador && estadoEnvio === "pendiente" && (
                    <div className="text-[11.5px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                      <CloudOff size={12} aria-hidden="true" />
                      {f.envio?.tipo === "servidor"
                        ? "Sin enviar — la oficina no responde"
                        : "Sin enviar — a la espera de conexión"}
                    </div>
                  )}
                  {!esBorrador && estadoEnvio === "rechazada" && (
                    <div className="text-[11.5px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
                      <AlertCircle size={12} aria-hidden="true" /> {f.envio?.error || "La oficina la rechazó"}
                    </div>
                  )}
                  {!esBorrador && estadoEnvio === "enviada" && (
                    <div className="text-[11.5px] text-green-700 font-semibold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      {f.envio?.envios > 1
                        ? `Corregida y reenviada · ${f.envio.envios} envíos`
                        : "Recibida en la oficina"}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-ios-texto text-[14px]">{fmtPrecio(f.data.precio)}</div>
                  <div className="text-[11px] text-rk-naranja">{f.data.tipo || "—"}</div>
                </div>
              </div>

              <div className="flex border-t border-ios-borde divide-x divide-ios-borde">
                {esBorrador ? (
                  <button
                    type="button"
                    onClick={() => onOpenDraft(f)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-gray-700 active:bg-ios-fondo transition"
                  >
                    <Pencil size={15} aria-hidden="true" /> Continuar
                  </button>
                ) : estadoEnvio !== "enviada" ? (
                  <button
                    type="button"
                    onClick={() => reintentar(f)}
                    disabled={enCurso}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-rk-naranja active:bg-ios-fondo transition disabled:opacity-50"
                  >
                    {enCurso ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
                    {enCurso ? "Enviando…" : "Reintentar envío"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenDraft(f)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-gray-700 active:bg-ios-fondo transition"
                  >
                    <PencilLine size={15} aria-hidden="true" /> Corregir y reenviar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmar(f.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-ios-texto2 active:bg-ios-fondo transition"
                >
                  <Trash2 size={15} aria-hidden="true" /> Eliminar
                </button>
              </div>

              {confirmar === f.id && (
                <div className="px-3.5 pb-3.5 pt-1 bg-red-50 border-t border-red-100">
                  <p className="text-[12.5px] text-red-800 mb-2 pt-2">
                    ¿Eliminar esta ficha? No se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { onDelete(tab, f.id); setConfirmar(null); }}
                      className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[13px] font-bold active:scale-95 transition"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmar(null)}
                      className="flex-1 py-2 rounded-xl bg-white border border-ios-borde text-[13px] font-semibold text-gray-700 active:scale-95 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
