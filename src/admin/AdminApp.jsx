import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, LogOut, RefreshCw, Download, Inbox, ChevronLeft, ChevronRight, Printer, StickyNote, Bell, BellOff, Plus } from "lucide-react";
import { Logo } from "../components/Logo.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { fmtFecha, fmtPrecio, nombreCorto } from "../lib/format.js";
import { nombreDeFicha, subtituloDeFicha } from "../lib/resumen.js";
import { llamar, ESTADOS, estadoDe } from "./api.js";
import { useSesion, salir as cerrarSesion, olvidarToken, limpiarUrl, tokenDeSesion } from "./auth.js";
import { pushSoportado, permisoActual, suscripcionActual, activarPush, desactivarPush } from "../lib/push.js";
import { FichaDetalle } from "./FichaDetalle.jsx";
import { NuevaCaptacion } from "./NuevaCaptacion.jsx";
import { ListadoImprimible } from "./Imprimible.jsx";
import { AdminLogin } from "./AdminLogin.jsx";

/* "Todas" no es una fase, así que no sale de FASES. Antes llevaba a mano el
   tono de "Nueva", y cuando ese cambió se quedó con el viejo sin que se notara.
   Es la tinta de marca y no depende de ninguna fase. */
const TINTA_MARCA = "#9c5310";

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
  const [creando, setCreando] = useState(false);
  /* Al abrir desde el botón de anotaciones, la ficha va directa a la nota en
     vez de obligar a buscarla entre ocho secciones. */
  const [enfocar, setEnfocar] = useState(null);

  const abrirFicha = (id, foco = null) => {
    setAbierta(id);
    setEnfocar(foco);
  };
  const [paraImprimir, setParaImprimir] = useState(null);
  const [preparandoImpresion, setPreparandoImpresion] = useState(false);
  const [avisosActivos, setAvisosActivos] = useState(false);
  const [cambiandoAvisos, setCambiandoAvisos] = useState(false);

  /* El estado real lo tiene el navegador, no la app: se consulta en vez de
     recordarlo, porque se puede cambiar desde los ajustes sin pasar por aquí. */
  useEffect(() => {
    if (!sesion) return;
    suscripcionActual().then((s) => setAvisosActivos(Boolean(s) && permisoActual() === "granted"));
  }, [sesion]);

  const alternarAvisos = async () => {
    setCambiandoAvisos(true);
    const token = await tokenDeSesion();
    const r = avisosActivos ? await desactivarPush({ token }) : await activarPush({ token });
    if (r.ok) setAvisosActivos(!avisosActivos);
    else setError(r.error);
    setCambiandoAvisos(false);
  };

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
      /* Antes, cualquier 401 cerraba la sesión de Google y devolvía al login,
         así que un fallo del servidor parecía un problema de credenciales y
         además borraba la sesión buena. Ahora se muestra el error y se deja
         reintentar: solo `useSession` decide si hay sesión o no. */
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [sesion, busqueda, filtro, pagina]);

  /* Con la sesión ya establecida, el verificador de la URL sobra. Se limpia
     aquí y no solo en el callback de éxito del cliente, para que no quede en
     la barra de direcciones si la respuesta llega por otro camino. */
  useEffect(() => {
    if (sesion) limpiarUrl();
  }, [sesion]);

  /* Debounce de la búsqueda: no una consulta por tecla. */
  useEffect(() => {
    const t = setTimeout(cargar, busqueda ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargar, busqueda]);

  useEffect(() => setPagina(1), [busqueda, filtro]);

  /* Trae el conjunto filtrado COMPLETO, por páginas.

     Antes pedía `limite: 200` de una vez, y el servidor tampoco sirve más de
     200 por consulta: pasadas las 200 captaciones, el CSV y el listado
     impreso se habrían cortado en silencio. Un export incompleto que no avisa
     es peor que uno que falla. */
  const traerTodas = useCallback(async () => {
    const POR_TANDA = 200;
    const acumuladas = [];
    for (let desde = 1; ; desde += POR_TANDA) {
      const r = await llamar("listar", {
        limite: POR_TANDA,
        desde,
        estado: filtro || undefined,
        busqueda,
      });
      acumuladas.push(...r.fichas);
      /* Se para cuando ya están todas, o cuando el servidor deja de devolver:
         la segunda condición evita un bucle infinito si `total` no cuadrara
         con lo que se sirve. */
      if (acumuladas.length >= r.total || r.fichas.length < POR_TANDA) return acumuladas;
    }
  }, [filtro, busqueda]);

  const exportarCsv = async () => {
    const todas = await traerTodas();
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

  const descripcionFiltro = useMemo(() => {
    const partes = [filtro ? `fase: ${estadoDe(filtro).label}` : "todas las fases"];
    if (busqueda.trim()) partes.push(`búsqueda: «${busqueda.trim()}»`);
    return partes.join(" · ");
  }, [filtro, busqueda]);

  /* Se imprime el conjunto filtrado completo, no la página que se ve: quien
     pide "imprimir el listado" quiere el listado, no un trozo de él. */
  const imprimirListado = async () => {
    if (preparandoImpresion) return;
    setPreparandoImpresion(true);
    try {
      const todas = await traerTodas();
      setParaImprimir(todas);
      /* Dos frames: con uno, el diálogo del sistema puede abrirse antes de
         que el documento esté pintado y saldría en blanco. */
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      window.print();
    } catch (e) {
      setError(e.message);
    } finally {
      setParaImprimir(null);
      setPreparandoImpresion(false);
    }
  };
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
    <div data-tema="panel" className="min-h-screen bg-ios-fondo dark:bg-ios-fondo-osc no-imprimir">
      <header className="sticky top-0 z-30 bg-ios-superficie/85 dark:bg-ios-superficie-osc/85 backdrop-blur-xl border-b border-ios-borde dark:border-ios-borde-osc">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-4">
          <Logo orientacion="horizontal" alto={26} />
          <span className="hidden sm:block text-[12px] font-bold tracking-[0.15em] uppercase text-rk-naranja border-l border-ios-separador dark:border-ios-borde-osc pl-4">
            Panel de captaciones
          </span>
          <div className="flex-1" />
          {pushSoportado() && (
            <button
              type="button"
              onClick={alternarAvisos}
              disabled={cambiandoAvisos}
              aria-pressed={avisosActivos}
              aria-label={avisosActivos ? "Desactivar los avisos de captación nueva" : "Activar los avisos de captación nueva"}
              title={avisosActivos ? "Avisos activados en este navegador" : "Avisarme de cada captación nueva"}
              className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-95 transition disabled:opacity-60 ${
                avisosActivos
                  ? "bg-rk-soft text-rk-naranja"
                  : "bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc"
              }`}
            >
              {cambiandoAvisos ? (
                <Loader2 size={16} className="animate-spin" />
              ) : avisosActivos ? (
                <Bell size={16} />
              ) : (
                <BellOff size={16} />
              )}
            </button>
          )}
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

        {/* Buscador y acciones arriba, las fases debajo: en una sola fila,
            con seis fases (una de ellas "Agendada para fotos") y dos botones,
            todo quedaba apretado y las etiquetas se partían. */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
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
            <div className="flex gap-2 shrink-0">
              {/* Delante de CSV e Imprimir porque es la única de las tres que
                  añade algo; las otras dos se llevan lo que ya hay. */}
              <button
                type="button"
                onClick={() => setCreando(true)}
                className="flex items-center gap-1.5 rounded-xl bg-rk-naranja px-3.5 py-2.5 text-[13px] font-bold text-white transition active:scale-95"
              >
                <Plus size={15} aria-hidden="true" /> Añadir
              </button>
              <button
                type="button"
                onClick={exportarCsv}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold border transition active:scale-95 bg-white dark:bg-ios-superficie-osc text-ios-texto2 dark:text-ios-texto2-osc border-ios-borde dark:border-ios-borde-osc"
              >
                <Download size={15} aria-hidden="true" /> CSV
              </button>
              <button
                type="button"
                onClick={imprimirListado}
                disabled={preparandoImpresion}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold border transition active:scale-95 disabled:opacity-60 bg-white dark:bg-ios-superficie-osc text-ios-texto2 dark:text-ios-texto2-osc border-ios-borde dark:border-ios-borde-osc"
              >
                {preparandoImpresion ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Printer size={15} aria-hidden="true" />
                )}
                Imprimir
              </button>
            </div>
          </div>

          {/* Todas las fases a la vista, en las filas que hagan falta. Probé una
              tira que se desplazaba en horizontal para ahorrar alto, pero
              esconde filtros: con ocho fases hay que poder verlas de un
              vistazo. En móvil los chips van más compactos para que ocupen
              menos filas. */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="group" aria-label="Filtrar por fase">
            <Chip activo={!filtro} onClick={() => setFiltro("")} color={TINTA_MARCA}>
              Todas
            </Chip>
            {ESTADOS.map((e) => (
              <Chip key={e.key} activo={filtro === e.key} onClick={() => setFiltro(e.key)} color={e.fuerte}>
                {e.label}
                {conteos[e.key] ? (
                  <span className={activoTenue(filtro === e.key)}>{conteos[e.key]}</span>
                ) : null}
              </Chip>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4">
            <p className="text-red-700 text-[13.5px] font-semibold">{error}</p>
            <div className="flex gap-3 mt-1.5">
              <button
                type="button"
                onClick={cargar}
                className="text-[12.5px] font-semibold text-red-700 underline underline-offset-2"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={salir}
                className="text-[12.5px] font-semibold text-red-700 underline underline-offset-2"
              >
                Salir y entrar con otra cuenta
              </button>
            </div>
          </div>
        )}

        {/* Listado */}
        {/* overflow-x-auto y no -hidden: en pantallas estrechas la etiqueta de
            fase más larga se recortaba a media palabra. Ahora la tabla se
            desplaza dentro de su caja en vez de perder texto, y la página
            nunca se desplaza en horizontal. */}
        {/* relative, y no por estética: las cabeceras de columna para lectores
            de pantalla van en position:absolute, y sin un ancestro posicionado
            su bloque contenedor era la página. Al desplazarse la tabla
            quedaban en x≈540 y hacían que TODA la página del panel se
            desplazara en horizontal en un móvil. Con esto las recorta la
            propia caja. */}
        <div className="relative rounded-2xl border border-ios-borde dark:border-ios-borde-osc bg-white dark:bg-ios-superficie-osc overflow-x-auto">
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
            <table className="w-full min-w-[560px] text-left">
              <caption className="sr-only">Listado de captaciones recibidas</caption>
              <thead className="bg-ios-fondo dark:bg-ios-elevada-osc/40 text-[11px] uppercase tracking-wide text-ios-texto2 dark:text-ios-texto2-osc">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">Inmueble</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">Agente</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden sm:table-cell">Última entrada</th>
                  <th scope="col" className="px-4 py-2.5 font-bold text-right">Precio</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">Estado</th>
                  <th scope="col" className="px-2 py-2.5 font-bold w-10">
                    <span className="sr-only">Anotaciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ios-borde dark:divide-ios-borde-osc">
                {fichas.map((f) => {
                  const e = estadoDe(f.estado);
                  return (
                    <tr
                      key={f.id}
                      onClick={() => abrirFicha(f.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), abrirFicha(f.id))}
                      className="cursor-pointer hover:bg-ios-fondo dark:hover:bg-ios-elevada-osc/40 focus:bg-ios-fondo dark:focus:bg-ios-elevada-osc/40 outline-none transition"
                    >
                      <td className="px-4 py-3">
                        {/* La agencia identifica cada inmueble por su
                            referencia; la dirección pasa a la segunda línea. */}
                        <div className="font-semibold text-ios-texto dark:text-ios-texto-osc text-[14px] tabular-nums">
                          {nombreDeFicha(f)}
                        </div>
                        <div className="text-[12.5px] text-ios-texto2 dark:text-ios-texto2-osc">
                          {[subtituloDeFicha(f), f.poblacion, f.tipo, f.operacion].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="flex items-center gap-2 min-w-0">
                          <Avatar agente={{ id: f.agenteId, name: f.agenteName }} tam={28} />
                          <span className="text-[13px] text-ios-texto2 dark:text-ios-texto2-osc truncate">
                            {f.agenteName}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                        {/* Una corrección aparece en su fila de siempre: la
                            ficha no se duplica nunca. Solo cambia lo que se
                            dice de ella, para que se distinga de una entrada
                            nueva sin añadir una segunda línea de fecha. */}
                        {f.corregida ? (
                          <div className="text-[13px] font-semibold text-rk-naranja">
                            Corregida por el agente
                          </div>
                        ) : (
                          <div className="text-[13px] text-ios-texto2 dark:text-ios-texto2-osc">
                            {fmtFecha(f.recibida)}
                          </div>
                        )}
                        {/* Que la teclearon aquí explica que le falten datos.
                            Sin esta marca, una ficha antigua a medias parece un
                            fallo de la app o un agente que no la rellenó. Y se
                            dice QUIÉN: en el panel entra más de una persona.
                            El nombre completo va en el title, porque en esta
                            columna solo cabe el de pila. */}
                        {f.origen === "oficina" && (
                          <div
                            className="text-[11px] text-ios-texto3 mt-0.5"
                            title={f.creadaPorNombre || f.creadaPor || undefined}
                          >
                            {nombreCorto(f.creadaPorNombre || f.creadaPor)
                              ? `Añadida manualmente por ${nombreCorto(f.creadaPorNombre || f.creadaPor)}`
                              : "Añadida manualmente"}
                          </div>
                        )}
                      </td>
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
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={(ev) => { ev.stopPropagation(); abrirFicha(f.id, "nota"); }}
                          aria-label={f.tieneNota ? `Ver la anotación de ${nombreDeFicha(f)}` : `Añadir una anotación a ${nombreDeFicha(f)}`}
                          title={f.tieneNota ? "Ver la anotación" : "Añadir una anotación"}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-90 ${
                            f.tieneNota
                              ? "bg-rk-soft text-rk-naranja"
                              : "text-ios-texto3 hover:bg-ios-fondo dark:hover:bg-ios-elevada-osc"
                          }`}
                        >
                          <StickyNote size={15} />
                        </button>
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

      {paraImprimir && (
        <ListadoImprimible fichas={paraImprimir} total={total} descripcionFiltro={descripcionFiltro} />
      )}

      {creando && (
        <NuevaCaptacion
          onCerrar={() => setCreando(false)}
          onCreada={(f) => {
            setCreando(false);
            /* Se recarga en vez de insertarla en la lista: puede que con su
               fecha no caiga en la primera página, y verla aparecer arriba
               cuando no está ahí sería mentir. */
            cargar();
            setAbierta(f.id);
          }}
        />
      )}

      {abierta && (
        <FichaDetalle
          id={abierta}
          enfocar={enfocar}
          onCerrar={() => { setAbierta(null); setEnfocar(null); }}
          onEliminada={() => cargar()}
          onActualizada={(f) => {
            if (f.recargar) cargar();
            else setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, estado: f.estado } : x)));
          }}
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

/* El contador se atenúa para que la etiqueta siga siendo lo que se lee. */
const activoTenue = (activo) =>
  `ml-1.5 tabular-nums ${activo ? "text-white/70" : "text-ios-texto3"}`;

function Chip({ activo, onClick, color, children }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      /* La letra baja un punto en móvil y el hueco se aprieta, que es lo que
         ahorra una fila; el alto se mantiene en 40 px porque por debajo de eso
         un chip se vuelve difícil de acertar con el dedo. */
      className={`shrink-0 rounded-xl px-2.5 py-2.5 text-[12px] sm:px-3 sm:text-[13px] font-semibold border transition active:scale-95 whitespace-nowrap ${
        activo ? "text-white border-transparent" : "bg-white dark:bg-ios-superficie-osc text-gray-700 dark:text-ios-texto-osc border-ios-borde dark:border-ios-borde-osc"
      }`}
      style={activo ? { background: color || TINTA_MARCA } : undefined}
    >
      {children}
    </button>
  );
}
