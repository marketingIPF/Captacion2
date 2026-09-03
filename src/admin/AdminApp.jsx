import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, LogOut, RefreshCw, Download, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { Logo } from "../components/Logo.jsx";
import { fmtFecha, fmtPrecio } from "../lib/format.js";
import { llamar, ESTADOS, estadoDe } from "./api.js";
import { useSesion, salir as cerrarSesion, olvidarToken } from "./auth.js";
import { FichaDetalle } from "./FichaDetalle.jsx";
import { AdminLogin } from "./AdminLogin.jsx";

const POR_PAGINA = 25;

export function AdminApp() {
  const { data: sesion, isPending: cargandoSesion } = useSesion();
  const [fichas, setFichas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("");
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState(null);

  const salir = useCallback(async () => {
    olvidarToken();
    setFichas([]);
    await cerrarSesion();
  }, []);

  const cargar = useCallback(async () => {
    if (!sesion) return;
    setCargando(true);
    setError("");
    try {
      const [lista, res] = await Promise.all([
        llamar("listar", {
          busqueda,
          estado: filtro || undefined,
          limite: POR_PAGINA,
          desde: (pagina - 1) * POR_PAGINA + 1,
        }),
        llamar("resumen"),
      ]);
      setFichas(lista.fichas);
      setTotal(lista.total);
      setResumen(res);
    } catch (e) {
      /* 403 = cuenta sin permiso: no es un fallo de sesión, hay que decirlo. */
      if (e.status === 401) salir();
      else setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [sesion, busqueda, filtro, pagina, salir]);

  /* Debounce de la búsqueda: no una consulta por tecla. */
  useEffect(() => {
    const t = setTimeout(cargar, busqueda ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargar, busqueda]);

  useEffect(() => setPagina(1), [busqueda, filtro]);

  const exportarCsv = async () => {
    const { fichas: todas } = await llamar("listar", { limite: 200, estado: filtro || undefined, busqueda });
    const cab = ["Recibida", "Agente", "Estado", "Operación", "Tipo", "Referencia", "Dirección", "Población", "Precio"];
    const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const filas = todas.map((f) =>
      [fmtFecha(f.recibida), f.agenteName, estadoDe(f.estado).label, f.operacion, f.tipo, f.referencia, f.direccion, f.poblacion, f.precio]
        .map(escapar).join(";")
    );
    /* BOM para que Excel en español abra los acentos bien. */
    const blob = new Blob(["﻿" + [cab.map(escapar).join(";"), ...filas].join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `captaciones-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const conteos = useMemo(() => {
    const m = Object.fromEntries((resumen?.porEstado || []).map((e) => [e.estado, e.n]));
    return m;
  }, [resumen]);

  if (cargandoSesion) {
    return (
      <div data-tema="panel" className="min-h-screen flex items-center justify-center bg-ios-fondo dark:bg-ios-fondo-osc">
        <Loader2 size={26} className="animate-spin text-rk-naranja" aria-label="Comprobando sesión" />
      </div>
    );
  }

  if (!sesion) return <AdminLogin />;

  return (
    <div data-tema="panel" className="min-h-screen bg-ios-fondo dark:bg-ios-fondo-osc">
      <header className="sticky top-0 z-30 bg-ios-superficie/85 dark:bg-ios-superficie-osc/85 backdrop-blur-xl border-b border-ios-borde dark:border-ios-borde-osc">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-4">
          <Logo orientacion="horizontal" alto={26} />
          <span className="hidden sm:block text-[12px] font-bold tracking-[0.15em] uppercase text-rk-naranja border-l border-ios-separador dark:border-ios-borde-osc pl-4">
            Panel de captaciones
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={cargar}
            aria-label="Actualizar"
            className="w-9 h-9 rounded-lg bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc flex items-center justify-center active:scale-95 transition"
          >
            <RefreshCw size={16} className={cargando ? "animate-spin" : ""} />
          </button>
          <span className="hidden md:block text-[13px] text-ios-texto2 dark:text-ios-texto2-osc max-w-[220px] truncate">
            {sesion.user?.name || sesion.user?.email}
          </span>
          <button
            type="button"
            onClick={salir}
            className="flex items-center gap-1.5 rounded-lg bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc px-3 h-9 text-[13px] font-semibold active:scale-95 transition"
          >
            <LogOut size={15} aria-hidden="true" /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {/* Cifras */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Tarjeta valor={resumen?.totales?.total ?? "—"} etiqueta="Captaciones totales" destacada />
          <Tarjeta valor={resumen?.totales?.ultimos30 ?? "—"} etiqueta="Últimos 30 días" />
          <Tarjeta valor={conteos.nueva ?? 0} etiqueta="Sin revisar" />
          <Tarjeta
            valor={resumen?.totales?.precio_medio_venta ? fmtPrecio(Number(resumen.totales.precio_medio_venta)) : "—"}
            etiqueta={`Precio medio de venta${resumen?.totales?.ventas ? ` (${resumen.totales.ventas})` : ""}`}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-texto3" aria-hidden="true" />
            <label htmlFor="buscar" className="sr-only">Buscar captación</label>
            <input
              id="buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por dirección, población, referencia o agente…"
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[14px] outline-none border transition bg-white dark:bg-ios-superficie-osc text-ios-texto dark:text-ios-texto-osc border-ios-borde dark:border-ios-borde-osc focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Chip activo={!filtro} onClick={() => setFiltro("")} color="#a95a12">Todas</Chip>
            {ESTADOS.map((e) => (
              <Chip key={e.key} activo={filtro === e.key} onClick={() => setFiltro(e.key)} color={e.fuerte}>
                {e.label} {conteos[e.key] ? `(${conteos[e.key]})` : ""}
              </Chip>
            ))}
            <button
              type="button"
              onClick={exportarCsv}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold border transition active:scale-95 bg-white dark:bg-ios-superficie-osc text-gray-700 dark:text-ios-texto-osc border-ios-borde dark:border-ios-borde-osc"
            >
              <Download size={15} aria-hidden="true" /> CSV
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4">
            <p className="text-red-700 text-[13.5px] font-semibold">{error}</p>
            {error.includes("acceso") && (
              <button type="button" onClick={salir} className="mt-1.5 text-[12.5px] font-semibold text-red-700 underline underline-offset-2">
                Salir y entrar con otra cuenta
              </button>
            )}
          </div>
        )}

        {/* Listado */}
        <div className="rounded-2xl border border-ios-borde dark:border-ios-borde-osc bg-white dark:bg-ios-superficie-osc overflow-hidden">
          {cargando && fichas.length === 0 && (
            <div className="py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-rk-naranja" aria-label="Cargando" /></div>
          )}

          {!cargando && fichas.length === 0 && (
            <div className="py-20 text-center">
              <Inbox size={30} className="mx-auto text-ios-separador dark:text-ios-borde-osc mb-2" aria-hidden="true" />
              <p className="text-ios-texto2 dark:text-ios-texto2-osc text-[14px]">
                {busqueda || filtro ? "Ninguna captación coincide con el filtro" : "Todavía no hay captaciones"}
              </p>
            </div>
          )}

          {fichas.length > 0 && (
            <table className="w-full text-left">
              <caption className="sr-only">Listado de captaciones recibidas</caption>
              <thead className="bg-ios-fondo dark:bg-ios-elevada-osc/40 text-[11px] uppercase tracking-wide text-ios-texto2 dark:text-ios-texto2-osc">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">Inmueble</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">Agente</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden sm:table-cell">Recibida</th>
                  <th scope="col" className="px-4 py-2.5 font-bold text-right">Precio</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ios-borde dark:divide-ios-borde-osc">
                {fichas.map((f) => {
                  const e = estadoDe(f.estado);
                  return (
                    <tr
                      key={f.id}
                      onClick={() => setAbierta(f.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), setAbierta(f.id))}
                      className="cursor-pointer hover:bg-ios-fondo dark:hover:bg-ios-elevada-osc/40 focus:bg-ios-fondo dark:focus:bg-ios-elevada-osc/40 outline-none transition"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ios-texto dark:text-ios-texto-osc text-[14px]">{f.direccion || "Sin dirección"}</div>
                        <div className="text-[12.5px] text-ios-texto2 dark:text-ios-texto2-osc">
                          {[f.poblacion, f.tipo, f.operacion].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ios-texto2 dark:text-ios-texto2-osc hidden md:table-cell">{f.agenteName}</td>
                      <td className="px-4 py-3 text-[13px] text-ios-texto2 dark:text-ios-texto2-osc hidden sm:table-cell whitespace-nowrap">{fmtFecha(f.recibida)}</td>
                      <td className="px-4 py-3 text-[14px] font-bold text-ios-texto dark:text-ios-texto-osc text-right whitespace-nowrap">{fmtPrecio(f.precio)}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap ring-1 ring-inset"
                          style={{
                            background: `${e.color}1f`,
                            color: `var(--estado-${e.key})`,
                            "--tw-ring-color": `${e.color}40`,
                          }}
                        >
                          {e.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {paginas > 1 && (
          <nav className="flex items-center justify-center gap-3 mt-4" aria-label="Paginación">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold border border-ios-borde dark:border-ios-borde-osc text-gray-700 dark:text-ios-texto-osc disabled:opacity-40"
            >
              <ChevronLeft size={15} aria-hidden="true" /> Anterior
            </button>
            <span className="text-[13px] text-ios-texto2 dark:text-ios-texto2-osc">Página {pagina} de {paginas}</span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
              disabled={pagina === paginas}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold border border-ios-borde dark:border-ios-borde-osc text-gray-700 dark:text-ios-texto-osc disabled:opacity-40"
            >
              Siguiente <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        )}
      </main>

      {abierta && (
        <FichaDetalle
          id={abierta}
          onCerrar={() => setAbierta(null)}
          onActualizada={(f) => setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, estado: f.estado } : x)))}
        />
      )}
    </div>
  );
}

function Tarjeta({ valor, etiqueta, destacada }) {
  return (
    <div className={`rounded-2xl p-4 border ${destacada ? "bg-rk-soft border-rk-softBorde dark:bg-rk-naranja/15 dark:border-rk-naranja/30" : "bg-white dark:bg-ios-superficie-osc border-ios-borde dark:border-ios-borde-osc"}`}>
      <div className={`text-[24px] font-extrabold leading-none ${destacada ? "text-[#a95a12] dark:text-[#f0a25a]" : "text-ios-texto dark:text-ios-texto-osc"}`}>{valor}</div>
      <div className={`text-[12px] mt-1.5 ${destacada ? "text-[#a95a12] dark:text-[#f0a25a]" : "text-ios-texto2 dark:text-ios-texto2-osc"}`}>{etiqueta}</div>
    </div>
  );
}

function Chip({ activo, onClick, color, children }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold border transition active:scale-95 whitespace-nowrap ${
        activo ? "text-white border-transparent" : "bg-white dark:bg-ios-superficie-osc text-gray-700 dark:text-ios-texto-osc border-ios-borde dark:border-ios-borde-osc"
      }`}
      style={activo ? { background: color || "#a95a12" } : undefined}
    >
      {children}
    </button>
  );
}
