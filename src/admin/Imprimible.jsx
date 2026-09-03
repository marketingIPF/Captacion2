import { createPortal } from "react-dom";
import { bloquesFicha, direccionCompleta, cifrasClave, tituloFicha } from "../lib/resumen.js";
import { fmtFecha, fmtPrecio } from "../lib/format.js";
import { estadoDe } from "./api.js";

const hoy = () =>
  new Date().toLocaleDateString("es-ES", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/* Cabecera común de los dos documentos. El logo va en tinta a propósito: en
   papel el blanco no existe. */
function Cabecera({ titulo, subtitulo }) {
  return (
    <header style={{ borderBottom: "1.5pt solid #1d1d1b", paddingBottom: "3mm", marginBottom: "5mm" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "8mm" }}>
        <div>
          <img
            src="/logos/logo-horizontal-tinta.svg"
            alt="RK Palanca Fontestad"
            style={{ height: "9mm", display: "block", marginBottom: "2mm" }}
          />
          <div style={{ fontSize: "13pt", fontWeight: 800, letterSpacing: "-0.2pt" }}>{titulo}</div>
          {subtitulo && <div style={{ fontSize: "9pt", color: "#444" }}>{subtitulo}</div>}
        </div>
        <div style={{ fontSize: "8pt", color: "#555", textAlign: "right", whiteSpace: "nowrap" }}>
          Impreso el {hoy()}
        </div>
      </div>
    </header>
  );
}

function Pie({ children }) {
  return (
    <footer style={{ marginTop: "6mm", paddingTop: "2mm", borderTop: "0.5pt solid #bbb", fontSize: "7.5pt", color: "#555" }}>
      {children}
    </footer>
  );
}

/* ── Listado ──────────────────────────────────────────────────────────── */

export function ListadoImprimible({ fichas, descripcionFiltro, total }) {
  /* Fuera del árbol de la aplicación: en pantalla está oculto por CSS y al
     imprimir es lo único que queda en pie. */
  const celda = { padding: "1.6mm 2mm", borderBottom: "0.4pt solid #ddd", verticalAlign: "top" };
  const cabeceraCelda = {
    ...celda,
    borderBottom: "1pt solid #1d1d1b",
    fontSize: "7.5pt",
    textTransform: "uppercase",
    letterSpacing: "0.5pt",
    fontWeight: 700,
    textAlign: "left",
  };

  return createPortal(
    <div className="solo-impresion apaisado">
      <Cabecera
        titulo="Listado de captaciones"
        subtitulo={`${fichas.length} de ${total} captaciones · ${descripcionFiltro}`}
      />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
        <thead>
          <tr>
            <th style={{ ...cabeceraCelda, width: "20mm" }}>Ref.</th>
            <th style={cabeceraCelda}>Inmueble</th>
            <th style={{ ...cabeceraCelda, width: "30mm" }}>Población</th>
            <th style={{ ...cabeceraCelda, width: "26mm" }}>Tipo</th>
            <th style={{ ...cabeceraCelda, width: "18mm" }}>Operación</th>
            <th style={{ ...cabeceraCelda, width: "38mm" }}>Agente</th>
            <th style={{ ...cabeceraCelda, width: "22mm" }}>Entrada</th>
            <th style={{ ...cabeceraCelda, width: "26mm", textAlign: "right" }}>Precio</th>
            <th style={{ ...cabeceraCelda, width: "31mm" }}>Fase</th>
          </tr>
        </thead>
        <tbody>
          {fichas.map((f) => (
            <tr key={f.id}>
              <td style={{ ...celda, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {f.referencia || "—"}
              </td>
              <td style={{ ...celda, fontWeight: 600 }}>{f.direccion || "Sin dirección"}</td>
              <td style={celda}>{f.poblacion || "—"}</td>
              <td style={celda}>{f.tipo || "—"}</td>
              <td style={celda}>{f.operacion || "—"}</td>
              <td style={celda}>{f.agenteName}</td>
              <td style={{ ...celda, whiteSpace: "nowrap" }}>
                {new Date(f.corregida || f.recibida).toLocaleDateString("es-ES")}
                {f.corregida && <div style={{ fontSize: "7pt", color: "#555" }}>corregida</div>}
              </td>
              <td style={{ ...celda, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>
                {fmtPrecio(f.precio)}
              </td>
              <td style={celda}>{estadoDe(f.estado).label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pie>
        Documento interno de RK Palanca Fontestad. Contiene datos de captaciones
        en curso; no difundir fuera de la agencia.
      </Pie>
    </div>,
    document.body
  );
}

/* ── Una ficha completa ───────────────────────────────────────────────── */

export function FichaImprimible({ ficha }) {
  const cifras = cifrasClave(ficha);
  const bloques = bloquesFicha(ficha).filter((b) => b.titulo !== "Propietarios");
  const propietarios = (ficha.propietarios || []).filter((p) => p?.nombre || p?.telefono);
  const d = ficha.data || {};

  /* Las observaciones se sacan de los bloques: ocupan párrafos, no una fila
     de tabla de dos columnas. */
  const sinObservaciones = bloques.filter((b) => b.titulo !== "Observaciones del agente");

  return createPortal(
    <div className="solo-impresion">
      <Cabecera
        titulo={tituloFicha(ficha)}
        subtitulo={`${d.referencia ? `Ref. ${d.referencia} · ` : ""}Captada por ${ficha.agenteName} · ${fmtFecha(ficha.recibida)}`}
      />

      {/* Cabecera de datos: lo que se mira primero */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8mm", marginBottom: "5mm" }}>
        <div>
          <div style={{ fontSize: "11pt", fontWeight: 700 }}>{direccionCompleta(ficha)}</div>
          <div style={{ fontSize: "9pt", color: "#444", marginTop: "1mm" }}>
            {[d.operacion, d.tipo, estadoDe(ficha.estado).label].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ fontSize: "16pt", fontWeight: 800, whiteSpace: "nowrap" }}>
          {fmtPrecio(d.precio)}
        </div>
      </div>

      {cifras.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5mm" }}>
          <tbody>
            <tr>
              {cifras.map((c) => (
                <td
                  key={c.etiqueta}
                  style={{ border: "0.5pt solid #bbb", padding: "2mm", textAlign: "center", width: `${100 / cifras.length}%` }}
                >
                  <div style={{ fontSize: "12pt", fontWeight: 700 }}>
                    {c.valor}
                    {c.unidad ? ` ${c.unidad}` : ""}
                  </div>
                  <div style={{ fontSize: "7pt", color: "#555", textTransform: "uppercase", letterSpacing: "0.3pt" }}>
                    {c.etiqueta}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}

      {propietarios.length > 0 && (
        <section className="bloque-ficha" style={{ marginBottom: "5mm" }}>
          <Titulo>Propietarios</Titulo>
          {propietarios.map((p, i) => (
            <div key={i} style={{ fontSize: "9.5pt", marginBottom: "1mm" }}>
              <strong>{p.nombre || "—"}</strong>
              {p.telefono ? ` · Tel. ${p.telefono}` : ""}
              {p.dni ? ` · DNI ${p.dni}` : ""}
              {p.email ? ` · ${p.email}` : ""}
            </div>
          ))}
        </section>
      )}

      {sinObservaciones.map((b) => (
        <section key={b.titulo} className="bloque-ficha" style={{ marginBottom: "4mm" }}>
          <Titulo>{b.titulo}</Titulo>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
            <tbody>
              {b.filas.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ width: "45%", padding: "1.1mm 0", color: "#555", borderBottom: "0.3pt solid #eee", verticalAlign: "top" }}>
                    {k}
                  </td>
                  <td style={{ padding: "1.1mm 0", fontWeight: 600, borderBottom: "0.3pt solid #eee" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {d.descripcionPublica && (
        <section className="bloque-ficha" style={{ marginBottom: "4mm" }}>
          <Titulo>Descripción para portales</Titulo>
          <p style={{ fontSize: "9.5pt", margin: 0, whiteSpace: "pre-wrap" }}>{d.descripcionPublica}</p>
        </section>
      )}

      {d.notasInternas && (
        <section className="bloque-ficha" style={{ marginBottom: "4mm" }}>
          <Titulo>Notas internas del agente</Titulo>
          <p style={{ fontSize: "9.5pt", margin: 0, whiteSpace: "pre-wrap" }}>{d.notasInternas}</p>
        </section>
      )}

      {ficha.notaOficina && (
        <section className="bloque-ficha" style={{ marginBottom: "4mm" }}>
          <Titulo>Nota de oficina</Titulo>
          <p style={{ fontSize: "9.5pt", margin: 0, whiteSpace: "pre-wrap" }}>{ficha.notaOficina}</p>
        </section>
      )}

      <Pie>
        Documento interno de RK Palanca Fontestad. Contiene datos personales de
        los propietarios (nombre, teléfono y DNI): trátese conforme a la política
        de protección de datos de la agencia y destrúyase cuando deje de hacer
        falta.
        {ficha.corregida ? ` · Corregida por el agente el ${fmtFecha(ficha.corregida)}.` : ""}
      </Pie>
    </div>,
    document.body
  );
}

function Titulo({ children }) {
  return (
    <h2
      style={{
        fontSize: "8pt",
        textTransform: "uppercase",
        letterSpacing: "0.6pt",
        fontWeight: 700,
        borderBottom: "0.5pt solid #1d1d1b",
        paddingBottom: "0.8mm",
        marginBottom: "1.5mm",
      }}
    >
      {children}
    </h2>
  );
}
