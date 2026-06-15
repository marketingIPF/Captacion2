import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Home, Building2, Store, Trees, Car, User, Users, ClipboardList, FileText,
  PlusCircle, ChevronRight, ChevronDown, X, Check, Phone, MapPin, Euro,
  Search, Send, Trash2, Save, CheckCircle2, Clock, MailCheck, Plus, Minus,
  Building, Ruler, Sparkles, Layers, TreePine, Eye, Loader2, ArrowLeft, ArrowRight
} from "lucide-react";
import emailjs from "@emailjs/browser";

/* ================================================================== */
/*  DATOS REALES — Inmobiliaria Palanca                                */
/* ================================================================== */
const AGENTES = [
  { id: "686387378", name: "Jose Miguel Palanca", role: "Codirector", email: "jose@inmobiliariapalanca.com", phone: "696460043" },
  { id: "686536261", name: "Javier Palanca", role: "Codirector", email: "javi@inmobiliariapalanca.com", phone: "649258584" },
  { id: "689033887", name: "Alejandro Garcia", role: "Agente Comercial", email: "agarcia@inmobiliariapalanca.com", phone: "674054152" },
  { id: "686536270", name: "Amparo Orts Soriano", role: "Agente Comercial", email: "aorts@inmobiliariapalanca.com", phone: "663323259" },
  { id: "686536262", name: "Asunción Marco Aparisi", role: "Agente Comercial", email: "asun@inmobiliariapalanca.com", phone: "618644856" },
  { id: "686536303", name: "Clara Ordoñez Rubiols", role: "Agente Comercial", email: "clara@inmobiliariapalanca.com", phone: "697633537" },
  { id: "689563574", name: "Claudia Stelling", role: "Agente Comercial", email: "claudia@inmobiliariapalanca.com", phone: "677909467" },
  { id: "687574956", name: "Desiree López Martinez", role: "Agente Comercial", email: "desiree@inmobiliariapalanca.com", phone: "611575351" },
  { id: "688849218", name: "Eva Vallés", role: "Agente Comercial", email: "eva@inmobiliariapalanca.com", phone: "637568603" },
  { id: "686536265", name: "Fede Carbonell", role: "Agente Comercial", email: "fede@inmobiliariapalanca.com", phone: "655299844" },
  { id: "689593800", name: "Fran Estelles", role: "Agente Comercial", email: "fran@inmobiliariapalanca.com", phone: "670996263" },
  { id: "687702039", name: "Jose Gimenez", role: "Agente Comercial", email: "josegimenez@inmobiliariapalanca.com", phone: "663716921" },
  { id: "689181578", name: "Lorena Lull", role: "Agente Comercial", email: "lorena@inmobiliariapalanca.com", phone: "644505020" },
  { id: "686536266", name: "Mª Luisa Bellver", role: "Agente Comercial", email: "mluisa@inmobiliariapalanca.com", phone: "607067815" },
  { id: "691027263", name: "Maria Jose Ordoñez", role: "Agente Comercial", email: "mariajose@inmobiliariapalanca.com", phone: "653840768" },
  { id: "692352245", name: "Mariano Del Prado", role: "Agente Comercial", email: "mariano@inmobiliariapalanca.com", phone: "675992234" },
  { id: "686536275", name: "Mavi Castillo Esteban", role: "Agente Comercial", email: "mavi@inmobiliariapalanca.com", phone: "622780656" },
  { id: "690617934", name: "Natalia Sanfelix", role: "Agente Comercial", email: "natalia@inmobiliariapalanca.com", phone: "673647013" },
  { id: "692352252", name: "Nuria Nuñez", role: "Agente Comercial", email: "nuria@inmobiliariapalanca.com", phone: "675992224" },
  { id: "686536274", name: "Rosa Domenech", role: "Agente Comercial", email: "rdomenech@inmobiliariapalanca.com", phone: "621206772" },
  { id: "686756864", name: "Sefa Gallent Bestuer", role: "Agente Comercial", email: "sefa@inmobiliariapalanca.com", phone: "697188343" },
  { id: "686536268", name: "Virginia Corral", role: "Agente Comercial", email: "vcorral@inmobiliariapalanca.com", phone: "675984757" },
  { id: "692352236", name: "Yvonne Vidal", role: "Agente Comercial", email: "yvidal@inmobiliariapalanca.com", phone: "675992778" }
];

/* ================================================================== */
/*  CONFIG                                                             */
/* ================================================================== */
const DESTINATARIO = "julia@inmobiliariapalanca.com";
const STORE_DRAFTS = "ipf_fichas_draft";
const STORE_SENT = "ipf_fichas_sent";
const STORE_AGENT = "ipf_agente_activo";

/* Configuración de EmailJS — envío directo sin cliente de correo */
const EMAILJS = {
  serviceId: "service_w45gzrf",
  templateId: "template_xk0nwkd",
  publicKey: "6le-qfYPBCb4c_POT",
};

const C = { naranja: "#cf731b", naranjaSoft: "#fbeede", tinta: "#111111", gris: "#6b7280" };

const TIPOS_INMUEBLE = [
  { key: "Piso", icon: Building2 },
  { key: "Ático", icon: Building },
  { key: "Casa / Chalet", icon: Home },
  { key: "Local", icon: Store },
  { key: "Terreno", icon: Trees },
  { key: "Garaje", icon: Car },
];

/* ----------------------- helpers de campos ----------------------- */
const seg = (label, options) => ({ kind: "seg", label, options });
const txt = (label, ph, type) => ({ kind: "txt", label, ph, type });
const chips = (label, options) => ({ kind: "chips", label, options });

/* Esquema completo de la ficha (7 bloques) */
const SECCIONES = [
  {
    id: "ident", n: 1, title: "Agente e identificación", icon: User,
    fields: {
      prospecto: txt("Prospecto", "Nombre del prospecto"),
      referencia: txt("Referencia", "REF-0000"),
      operacion: seg("Operación", ["Venta", "Alquiler"]),
      tipo: { kind: "tipo", label: "Tipo de inmueble" },
    },
  },
  {
    id: "ubic", n: 2, title: "Ubicación y datos legales", icon: MapPin,
    fields: {
      direccion: txt("Dirección (calle)", "Calle / Avenida"),
      numero: txt("Número", "Nº"),
      planta: txt("Planta", "Planta"),
      puerta: txt("Puerta", "Puerta"),
      poblacion: txt("Población", "Valencia"),
      cp: txt("Código postal", "46000", "numeric"),
      provincia: txt("Provincia", "Valencia"),
      suelo: seg("Clasificación del suelo", ["Urbano", "Rústico"]),
      cee: seg("Certificado energético", ["Hecho", "Pendiente"]),
      autorizacion: seg("Autorización de venta firmada", ["Sí", "No"]),
      docs: chips("Documentación aportada", ["DNI", "IBI", "CEE", "Escritura", "Nota simple"]),
    },
  },
  {
    id: "econ", n: 3, title: "Datos económicos", icon: Euro,
    fields: {
      precio: txt("Precio solicitado", "€", "numeric"),
      precioMin: txt("Precio mínimo aceptable", "€", "numeric"),
      comunidad: txt("Gastos de comunidad", "€/mes", "numeric"),
      ibi: txt("IBI", "€/año", "numeric"),
      derrama: seg("Derrama aprobada", ["Sí", "No"]),
      derramaImporte: txt("Importe derrama", "€", "numeric"),
      vpo: seg("VPO", ["Sí", "No"]),
      vpoExp: txt("Nº de expediente VPO", "Expediente"),
    },
  },
  {
    id: "dist", n: 4, title: "Distribución y superficies", icon: Ruler,
    fields: {
      mConstruidos: txt("M² construidos", "m²", "numeric"),
      mUtiles: txt("M² útiles", "m²", "numeric"),
      mParcela: txt("M² parcela", "m²", "numeric"),
      mTerraza: txt("M² terraza", "m²", "numeric"),
      anio: txt("Año de construcción", "Año", "numeric"),
      alturas: txt("Alturas del edificio", "Plantas", "numeric"),
      dormitorios: txt("Dormitorios", "Nº", "numeric"),
      banos: txt("Baños", "Nº", "numeric"),
      aseos: txt("Aseos", "Nº", "numeric"),
      salon: txt("Salón (m²)", "m²", "numeric"),
      cocinaM: txt("Cocina (m²)", "m²", "numeric"),
      equipamiento: chips("Equipamiento adicional", ["Armarios empotrados", "Garaje", "Trastero", "Terraza", "Balcón", "Piscina", "Jardín"]),
    },
  },
  {
    id: "cal", n: 5, title: "Calidades y equipamiento", icon: Sparkles,
    fields: {
      ventanaMat: seg("Ventanas — material", ["Aluminio", "PVC", "Madera", "Climalit"]),
      ventanaApertura: seg("Tipo de apertura", ["Correderas", "Abatibles", "Oscilobatientes"]),
      puertas: seg("Puertas interiores", ["Macizas", "Huecas", "Lacadas", "Roble/Haya"]),
      suelos: seg("Suelos", ["Tarima", "Gres", "Terrazo", "Mármol", "Porcelánico"]),
      cocinaTipo: seg("Cocina", ["Independiente", "Abierta", "Americana"]),
      fuegos: seg("Fuegos", ["Vitrocerámica", "Inducción", "Gas"]),
      acs: seg("Agua caliente", ["Termo eléctrico", "Gas natural", "Butano", "Solar"]),
      clima: seg("Climatización", ["A/A Splits", "Conductos", "No tiene"]),
      calefaccion: seg("Calefacción", ["Gas", "Eléctrica", "Suelo radiante", "No tiene"]),
      paredes: seg("Paredes", ["Lisas", "Gotelé", "Papel pintado"]),
    },
  },
  {
    id: "edif", n: 6, title: "Edificio, entorno y estado", icon: Layers,
    fields: {
      ascensor: seg("Ascensor", ["Sí", "No"]),
      cotaCero: seg("A cota cero", ["Sí", "No"]),
      zonasComunes: chips("Zonas comunes", ["Piscina", "Jardines", "Club social", "Pádel/Tenis", "Zona infantil"]),
      conserjeria: seg("Conserjería / vigilancia", ["Sí", "No"]),
      fachada: seg("Fachada", ["Ladrillo caravista", "Monocapa", "Pintada", "Piedra"]),
      estado: seg("Estado de conservación", ["Para entrar", "Buen estado", "A reformar", "A estrenar"]),
      orientacion: seg("Orientación", ["Norte", "Sur", "Este", "Oeste"]),
      vistas: chips("Vistas", ["Al mar", "A la montaña", "Despejadas"]),
      servicios: chips("Servicios a 5 min", ["Metro/Bus", "Supermercado", "Colegios", "Centro médico", "Parques"]),
    },
  },
  {
    id: "obs", n: 7, title: "Observaciones del agente", icon: FileText,
    fields: {
      notasInternas: { kind: "area", label: "Notas internas (no publicables)", ph: "Anotaciones privadas para la oficina…" },
      descripcionPublica: { kind: "area", label: "Descripción pública (para portales)", ph: "Texto comercial para publicar…" },
    },
  },
];

/* ================================================================== */
/*  PERSISTENCIA                                                       */
/* ================================================================== */
const load = (k, def) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : def; } catch { return def; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const fmtFecha = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtPrecio = (n) => n ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "—";

const emptyFicha = (agente) => ({
  id: "F" + Date.now(),
  agenteId: agente?.id || "",
  agenteName: agente?.name || "",
  fecha: new Date().toISOString(),
  propietarios: [{ nombre: "", telefono: "", dni: "" }],
  data: {},
});

/* ================================================================== */
/*  CONSTRUCCIÓN DEL CORREO                                            */
/* ================================================================== */
function construirCorreo(ficha) {
  const d = ficha.data;
  const L = [];
  L.push("FICHA DE CAPTACIÓN · RK PALANCA FONTESTAD");
  L.push("=========================================");
  L.push(`Agente captador: ${ficha.agenteName}`);
  L.push(`Fecha: ${fmtFecha(ficha.fecha)}`);
  L.push("");
  // Propietarios
  L.push("— PROPIETARIOS —");
  ficha.propietarios.forEach((p, i) => {
    if (p.nombre || p.telefono) L.push(`  ${i + 1}. ${p.nombre || "—"} · Tel: ${p.telefono || "—"}${p.dni ? " · DNI: " + p.dni : ""}`);
  });
  L.push("");
  // Secciones
  SECCIONES.forEach((sec) => {
    const lines = [];
    Object.entries(sec.fields).forEach(([key, f]) => {
      if (f.kind === "tipo") { if (d.tipo) lines.push(`  ${f.label}: ${d.tipo}`); return; }
      const v = d[key];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return;
      lines.push(`  ${f.label}: ${Array.isArray(v) ? v.join(", ") : v}`);
    });
    if (lines.length) { L.push(`— ${sec.title.toUpperCase()} —`); L.push(...lines); L.push(""); }
  });
  const asunto = `Ficha Captación · ${d.tipo || "Inmueble"} · ${d.direccion || "s/dirección"}${d.numero ? " " + d.numero : ""} · ${ficha.agenteName}`;
  return { asunto, cuerpo: L.join("\n") };
}
const esEscritorio = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const movil = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
  return !movil;
};

/* Respaldo: abre el cliente de correo y copia el texto (si es PC). */
async function respaldoMailto(ficha) {
  const { asunto, cuerpo } = construirCorreo(ficha);
  if (esEscritorio()) {
    try { await navigator.clipboard.writeText(`Para: ${DESTINATARIO}\nAsunto: ${asunto}\n\n${cuerpo}`); } catch {}
  }
  window.location.href = `mailto:${DESTINATARIO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

/* Envío directo con EmailJS. Devuelve { ok, modo }:
   - ok:true, modo:"directo"  → enviado sin abrir nada
   - ok:false, modo:"respaldo" → falló EmailJS, se usó mailto + copia */
async function enviarFicha(ficha) {
  const { asunto, cuerpo } = construirCorreo(ficha);
  try {
    await emailjs.send(
      EMAILJS.serviceId,
      EMAILJS.templateId,
      { asunto, cuerpo, to_email: DESTINATARIO, agente: ficha.agenteName },
      { publicKey: EMAILJS.publicKey }
    );
    return { ok: true, modo: "directo" };
  } catch (err) {
    console.error("EmailJS falló, usando respaldo mailto:", err);
    await respaldoMailto(ficha);
    return { ok: false, modo: "respaldo" };
  }
}

/* ================================================================== */
/*  COMPONENTES DE CAMPO                                               */
/* ================================================================== */
const inputBase = "w-full bg-white rounded-xl px-3.5 py-3 text-[15px] outline-none border border-gray-200 focus:border-[#cf731b] focus:ring-2 focus:ring-[#cf731b]/15 transition";
const lblBase = "text-[12px] font-semibold text-gray-500 mb-1.5 block";

const Field = React.memo(function Field({ name, def, value, onChange }) {
  if (def.kind === "txt")
    return (
      <div>
        <label className={lblBase}>{def.label}</label>
        <input value={value ?? ""} placeholder={def.ph}
          inputMode={def.type === "numeric" ? "numeric" : "text"}
          onChange={(e) => onChange(name, def.type === "numeric" ? e.target.value.replace(/[^\d]/g, "") : e.target.value)}
          className={inputBase} />
      </div>
    );
  if (def.kind === "area")
    return (
      <div>
        <label className={lblBase}>{def.label}</label>
        <textarea value={value ?? ""} placeholder={def.ph} rows={3}
          onChange={(e) => onChange(name, e.target.value)} className={inputBase + " resize-none"} />
      </div>
    );
  if (def.kind === "seg")
    return (
      <div>
        <label className={lblBase}>{def.label}</label>
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const act = value === o;
            return (
              <button key={o} onClick={() => onChange(name, act ? "" : o)}
                className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition active:scale-95 ${act ? "text-white border-transparent shadow-sm" : "bg-white text-gray-600 border-gray-200"}`}
                style={act ? { background: C.naranja } : {}}>{o}</button>
            );
          })}
        </div>
      </div>
    );
  if (def.kind === "chips")
    return (
      <div>
        <label className={lblBase}>{def.label}</label>
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const arr = value || [];
            const act = arr.includes(o);
            return (
              <button key={o} onClick={() => onChange(name, act ? arr.filter((x) => x !== o) : [...arr, o])}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition active:scale-95 flex items-center gap-1 ${act ? "border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
                style={act ? { background: C.naranjaSoft, color: C.naranja, borderColor: C.naranja } : {}}>
                {act && <Check size={13} strokeWidth={3} />}{o}
              </button>
            );
          })}
        </div>
      </div>
    );
  return null;
});

const TipoSelector = React.memo(function TipoSelector({ value, onChange }) {
  return (
    <div>
      <label className={lblBase}>Tipo de inmueble</label>
      <div className="grid grid-cols-3 gap-2">
        {TIPOS_INMUEBLE.map((t) => {
          const Icon = t.icon; const act = value === t.key;
          return (
            <button key={t.key} onClick={() => onChange("tipo", t.key)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition active:scale-95 ${act ? "text-white border-transparent shadow-md" : "bg-white text-gray-500 border-gray-200"}`}
              style={act ? { background: C.tinta } : {}}>
              <Icon size={20} strokeWidth={2} style={act ? { color: C.naranja } : {}} />
              <span className="text-[11px] font-semibold">{t.key}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* ----------------------- Propietarios (array) -------------------- */
const Propietarios = React.memo(function Propietarios({ list, onChange }) {
  const upd = (i, k, v) => onChange(list.map((p, idx) => idx === i ? { ...p, [k]: v } : p));
  return (
    <div className="space-y-3">
      {list.map((p, i) => (
        <div key={i} className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.naranja }}>Propietario {i + 1}</span>
            {list.length > 1 && (
              <button onClick={() => onChange(list.filter((_, idx) => idx !== i))} className="text-gray-400 active:scale-90 transition"><Minus size={18} /></button>
            )}
          </div>
          <input value={p.nombre} onChange={(e) => upd(i, "nombre", e.target.value)} placeholder="Nombre y apellidos" className={inputBase} />
          <div className="grid grid-cols-2 gap-2">
            <input value={p.telefono} onChange={(e) => upd(i, "telefono", e.target.value)} inputMode="tel" placeholder="Teléfono" className={inputBase} />
            <input value={p.dni} onChange={(e) => upd(i, "dni", e.target.value)} placeholder="DNI" className={inputBase} />
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...list, { nombre: "", telefono: "", dni: "" }])}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 font-semibold text-[14px] active:scale-95 transition">
        <Plus size={16} /> Añadir propietario
      </button>
    </div>
  );
});

/* ================================================================== */
/*  PANTALLA: Selector de Agente                                       */
/* ================================================================== */
function AgentPicker({ onSelect, ultimo }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => AGENTES.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.role.toLowerCase().includes(q.toLowerCase())), [q]);
  const ultimoValido = useMemo(() => ultimo && AGENTES.find((a) => a.id === ultimo.id), [ultimo]);
  return (
    <div className="min-h-full flex flex-col bg-[#F9FAFB]">
      <div className="px-6 pt-16 pb-4">
        <div className="text-[12px] font-bold tracking-[0.2em] uppercase" style={{ color: C.naranja }}>RK Palanca Fontestad</div>
        <h1 className="text-[28px] font-extrabold leading-tight mt-2 text-gray-900">Ficha de Captación</h1>
        <p className="text-gray-500 mt-1 text-[15px]">Selecciona tu nombre para comenzar</p>
        <div className="relative mt-5">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar agente…"
            className="w-full bg-white text-gray-900 placeholder-gray-400 rounded-2xl pl-11 pr-4 py-3.5 text-[16px] outline-none border border-gray-200 focus:border-[#cf731b] focus:ring-2 focus:ring-[#cf731b]/15 transition" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {ultimoValido && !q && (
          <button onClick={() => onSelect(ultimoValido)}
            className="w-full flex items-center gap-3 bg-white rounded-2xl border-2 px-4 py-3.5 mb-3 active:scale-[0.99] transition text-left"
            style={{ borderColor: C.naranja }}>
            <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-[14px] shrink-0" style={{ background: C.tinta }}>
              <span style={{ color: C.naranja }}>{ultimoValido.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.naranja }}>Continuar como</div>
              <div className="font-semibold text-gray-900 truncate text-[15px]">{ultimoValido.name}</div>
            </div>
            <ChevronRight size={18} className="shrink-0" style={{ color: C.naranja }} />
          </button>
        )}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {list.map((a) => (
            <button key={a.id} onClick={() => onSelect(a)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition text-left">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate text-[15px]">{a.name}</div>
                <div className="text-[13px] text-gray-400 truncate">{a.role}</div>
              </div>
              <ChevronRight size={18} className="text-gray-300 shrink-0" />
            </button>
          ))}
          {list.length === 0 && <div className="text-center text-gray-400 py-12 text-[14px]">Sin resultados</div>}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PANTALLA: Formulario (acordeón de secciones)                       */
/* ================================================================== */
function Formulario({ agente, ficha, setFicha, onSaveDraft, onSend, onChangeAgent }) {
  const [open, setOpen] = useState("ident");
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [aviso, setAviso] = useState("");

  const setData = useCallback((k, v) => setFicha((f) => ({ ...f, data: { ...f.data, [k]: v } })), [setFicha]);
  const setProps = useCallback((list) => setFicha((f) => ({ ...f, propietarios: list })), [setFicha]);

  const progreso = useMemo(() => {
    const total = SECCIONES.reduce((n, s) => n + Object.keys(s.fields).length, 0);
    const done = SECCIONES.reduce((n, s) => n + Object.entries(s.fields).filter(([k, f]) => {
      if (f.kind === "tipo") return !!ficha.data.tipo;
      const v = ficha.data[k]; return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    }).length, 0);
    return Math.round((done / total) * 100);
  }, [ficha.data]);

  const faltan = useMemo(() => {
    const arr = [];
    if (!ficha.data.tipo) arr.push({ campo: "el tipo de inmueble", sec: "ident" });
    if (!ficha.data.direccion || !ficha.data.direccion.trim()) arr.push({ campo: "la dirección", sec: "ubic" });
    if (!ficha.propietarios.some((p) => p.nombre && p.nombre.trim())) arr.push({ campo: "el nombre de un propietario", sec: "ident" });
    return arr;
  }, [ficha.data.tipo, ficha.data.direccion, ficha.propietarios]);
  const puedeEnviar = faltan.length === 0;

  const handleSend = () => {
    if (sending) return Promise.resolve(null);
    if (!puedeEnviar) {
      setOpen(faltan[0].sec);
      setAviso("Falta " + faltan.map((f) => f.campo).join(", "));
      setTimeout(() => setAviso(""), 3500);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return Promise.resolve(null);
    }
    setSending(true);
    return new Promise((resolve) => {
      setTimeout(async () => {
        const res = await enviarFicha(ficha);
        onSend(ficha);
        setSending(false);
        resolve(res);
      }, 300);
    });
  };

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-24">
      {/* Header con progreso */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-5 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: C.naranja }}>Nueva ficha</div>
            <div className="text-[15px] font-semibold text-gray-900">{agente.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[20px] font-extrabold" style={{ color: C.tinta }}>{progreso}%</div>
              <div className="text-[10px] text-gray-400 -mt-1">completado</div>
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progreso}%`, background: C.naranja }} />
        </div>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {SECCIONES.map((sec) => {
          const Icon = sec.icon; const isOpen = open === sec.id;
          return (
            <div key={sec.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button onClick={() => setOpen(isOpen ? "" : sec.id)} className="w-full flex items-center gap-3 p-4 active:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300" style={{ background: isOpen ? C.tinta : C.naranjaSoft }}>
                  <Icon size={18} style={{ color: C.naranja }} />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[10px] font-bold text-gray-400">SECCIÓN {sec.n}</div>
                  <div className="font-semibold text-gray-900 text-[15px]">{sec.title}</div>
                </div>
                <ChevronDown size={20} className="text-gray-400 transition-transform duration-300" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <div className={`px-4 pb-5 pt-1 space-y-4 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
                    {sec.id === "ident" && (
                      <div>
                        <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block">Agente captador</label>
                        <div className="relative">
                          <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.naranja }} />
                          <select value={agente.id} onChange={(e) => onChangeAgent(e.target.value)}
                            className="w-full appearance-none bg-white rounded-xl pl-10 pr-9 py-3 text-[15px] font-medium text-gray-900 outline-none border border-gray-200 focus:border-[#cf731b] focus:ring-2 focus:ring-[#cf731b]/15 transition">
                            {AGENTES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                    {Object.entries(sec.fields).map(([key, def]) =>
                      def.kind === "tipo"
                        ? <TipoSelector key={key} value={ficha.data.tipo} onChange={setData} />
                        : <Field key={key} name={key} def={def} value={ficha.data[key]} onChange={setData} />
                    )}
                    {sec.id === "ident" && (
                      <div>
                        <div className="text-[12px] font-semibold text-gray-500 mb-2 mt-1">Propietarios</div>
                        <Propietarios list={ficha.propietarios} onChange={setProps} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Acciones */}
      <div className="px-4 mt-5 space-y-2.5">
        <button onClick={() => { if (puedeEnviar) { setPreview(true); } else { handleSend(); } }} disabled={sending}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[17px] text-white shadow-lg active:scale-95 transition"
          style={{ background: C.naranja, boxShadow: "0 8px 24px rgba(207,115,27,.35)" }}>
          {sending ? <><Loader2 size={20} className="animate-spin" /> Preparando…</> : <><Send size={19} /> Enviar correo</>}
        </button>
        {aviso
          ? <div className="text-center text-[12px] font-semibold" style={{ color: "#dc2626" }}>{aviso}</div>
          : !puedeEnviar && <div className="text-center text-[12px] text-gray-400">Completa tipo, dirección y un propietario para enviar</div>}
        <button onClick={onSaveDraft}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 font-semibold text-gray-700 active:scale-95 transition">
          <Save size={18} /> Guardar borrador
        </button>
      </div>

      {preview && <PreviewModal ficha={ficha} onClose={() => setPreview(false)} onSend={handleSend} />}
      <style>{`@keyframes fade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ----------------------- Modal de previsualización --------------- */
function PreviewModal({ ficha, onClose, onSend }) {
  const { asunto, cuerpo } = construirCorreo(ficha);
  const [estado, setEstado] = useState("idle"); // idle | enviando | ok | respaldo

  const handleClick = async () => {
    if (estado === "enviando") return;
    setEstado("enviando");
    const res = await onSend();
    if (!res) { setEstado("idle"); return; }
    if (res.ok) {
      setEstado("ok");
      setTimeout(() => onClose(), 1800);
    } else {
      setEstado("respaldo");
    }
  };

  const btnBg = estado === "ok" ? "#16a34a" : estado === "respaldo" ? "#d97706" : C.naranja;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={estado === "enviando" ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md mx-auto bg-white rounded-t-[28px] max-h-[85vh] flex flex-col animate-[slideup_.3s_cubic-bezier(.16,1,.3,1)]">
        <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" />
        <div className="flex items-center justify-between px-6 pt-3 pb-2">
          <h3 className="text-[18px] font-bold text-gray-900">Enviar a Julia</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><X size={18} /></button>
        </div>
        <div className="px-6 overflow-y-auto pb-4 flex-1">
          <div className="text-[12px] text-gray-400 font-semibold">PARA</div>
          <div className="text-[14px] text-gray-900 mb-3">{DESTINATARIO}</div>
          <div className="text-[12px] text-gray-400 font-semibold">ASUNTO</div>
          <div className="text-[14px] text-gray-900 mb-3 font-medium">{asunto}</div>
          <div className="text-[12px] text-gray-400 font-semibold">CUERPO</div>
          <pre className="text-[12px] text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-3 mt-1 leading-relaxed">{cuerpo}</pre>
        </div>
        <div className="p-4 border-t border-gray-100">
          <button onClick={handleClick} disabled={estado === "enviando" || estado === "ok"}
            className="w-full py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition" style={{ background: btnBg }}>
            {estado === "enviando" ? <><Loader2 size={19} className="animate-spin" /> Enviando…</>
              : estado === "ok" ? <><Check size={19} strokeWidth={3} /> ¡Enviado a Julia!</>
              : estado === "respaldo" ? <><MailCheck size={18} /> Abierto en tu correo</>
              : <><Send size={18} /> Enviar ahora</>}
          </button>
          {estado === "respaldo" && (
            <p className="text-center text-[12px] mt-2" style={{ color: "#d97706" }}>
              No se pudo enviar automáticamente. Abrimos tu correo{esEscritorio() ? " y copiamos el texto al portapapeles" : ""} como respaldo.
            </p>
          )}
          {estado === "idle" && (
            <p className="text-center text-[12px] text-gray-400 mt-2">Se enviará directamente a Julia, sin abrir ningún programa.</p>
          )}
        </div>
      </div>
      <style>{`@keyframes slideup{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ================================================================== */
/*  PANTALLA: Historial                                                */
/* ================================================================== */
function Historial({ drafts, sent, onOpenDraft, onResend, onDelete }) {
  const [tab, setTab] = useState("sent");
  const list = tab === "sent" ? sent : drafts;
  return (
    <div className="min-h-full bg-[#F9FAFB] pb-28">
      <div className="px-6 pt-14 pb-2">
        <h1 className="text-[30px] font-extrabold text-gray-900">Historial</h1>
        <p className="text-gray-500 text-[15px]">Fichas guardadas en este dispositivo</p>
      </div>
      <div className="px-5 mt-3">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl">
          {[["sent", `Enviadas ${sent.length}`], ["drafts", `Borradores ${drafts.length}`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-xl text-[14px] font-semibold transition ${tab === k ? "bg-white shadow-sm" : "text-gray-500"}`}
              style={tab === k ? { color: C.naranja } : {}}>{l}</button>
          ))}
        </div>
      </div>
      <div className="px-5 mt-4 space-y-2.5">
        {list.length === 0 && <div className="text-center text-gray-400 py-16">No hay fichas en esta categoría</div>}
        {list.slice().reverse().map((f) => {
          const tipo = TIPOS_INMUEBLE.find((t) => t.key === f.data.tipo);
          const Icon = tipo?.icon || Home;
          return (
            <div key={f.id} className="w-full flex items-center gap-3 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100">
              <button onClick={() => tab === "drafts" ? onOpenDraft(f) : onResend(f)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70 transition">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.naranjaSoft }}>
                  <Icon size={20} style={{ color: C.naranja }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{f.data.direccion || "Sin dirección"} {f.data.numero}</div>
                  <div className="text-[13px] text-gray-500 truncate">{f.agenteName} · {fmtFecha(f.fecha)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-gray-900 text-[14px]">{fmtPrecio(Number(f.data.precio))}</div>
                  <div className="text-[11px]" style={{ color: C.naranja }}>{f.data.tipo || "—"}</div>
                </div>
              </button>
              <button onClick={() => onDelete(tab, f.id)} className="text-gray-300 active:scale-90 transition pl-1"><Trash2 size={17} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PANTALLA: Perfil                                                   */
/* ================================================================== */
function Perfil({ agente, sent, onChange }) {
  const mias = sent.filter((f) => f.agenteId === agente.id);
  return (
    <div className="min-h-full bg-[#F9FAFB] pb-28">
      <div className="px-6 pt-14"><h1 className="text-[30px] font-extrabold text-gray-900">Perfil</h1></div>
      <div className="px-5 mt-4">
        <div className="rounded-3xl p-6 flex flex-col items-center text-center text-white" style={{ background: C.tinta }}>
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center font-extrabold text-2xl" style={{ color: C.naranja }}>
            {agente.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div className="text-[20px] font-bold mt-3">{agente.name}</div>
          <div className="text-white/60 text-[14px]">{agente.role}</div>
          <div className="text-[13px] mt-1" style={{ color: C.naranja }}>{agente.email}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center mt-4">
          <div className="text-[32px] font-extrabold" style={{ color: C.naranja }}>{mias.length}</div>
          <div className="text-[13px] text-gray-500">Fichas enviadas por ti</div>
        </div>
        <button onClick={onChange} className="w-full mt-4 py-4 rounded-2xl bg-white border border-gray-100 shadow-sm font-semibold text-red-500 active:scale-95 transition">
          Cambiar de agente
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-4 px-6">Las fichas se guardan en este dispositivo. Se conservan hasta que las elimines o se borre la caché del navegador.</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  NAV INFERIOR                                                       */
/* ================================================================== */
function BottomNav({ tab, setTab }) {
  const items = [
    { k: "ficha", l: "Ficha", icon: ClipboardList },
    { k: "historial", l: "Historial", icon: FileText },
    { k: "perfil", l: "Perfil", icon: User },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-xl border-t border-gray-100 flex justify-around pt-2 pb-6 px-4 z-40">
      {items.map((it) => {
        const Icon = it.icon; const act = tab === it.k;
        return (
          <button key={it.k} onClick={() => setTab(it.k)} className="flex flex-col items-center gap-0.5 flex-1 active:scale-90 transition" style={{ color: act ? C.naranja : "#9CA3AF" }}>
            <Icon size={24} strokeWidth={act ? 2.5 : 2} />
            <span className="text-[11px] font-semibold">{it.l}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  APP                                                                */
/* ================================================================== */
export default function App() {
  const [agente, setAgente] = useState(null);
  const ultimoAgente = useMemo(() => load(STORE_AGENT, null), []);
  const [drafts, setDrafts] = useState(() => load(STORE_DRAFTS, []));
  const [sent, setSent] = useState(() => load(STORE_SENT, []));
  const [tab, setTab] = useState("ficha");
  const [ficha, setFicha] = useState(() => emptyFicha(null));

  useEffect(() => save(STORE_DRAFTS, drafts), [drafts]);
  useEffect(() => save(STORE_SENT, sent), [sent]);
  useEffect(() => { try { emailjs.init({ publicKey: EMAILJS.publicKey }); } catch {} }, []);

  const selectAgent = (a) => { setAgente(a); save(STORE_AGENT, a); setFicha(emptyFicha(a)); setTab("ficha"); };
  const changeAgent = () => { setAgente(null); try { localStorage.removeItem(STORE_AGENT); } catch {} };
  const setAgenteActivo = (id) => {
    const a = AGENTES.find((x) => x.id === id);
    if (!a) return;
    setAgente(a); save(STORE_AGENT, a);
    setFicha((f) => ({ ...f, agenteId: a.id, agenteName: a.name }));
  };

  const saveDraft = () => {
    setDrafts((p) => { const ex = p.find((d) => d.id === ficha.id); return ex ? p.map((d) => d.id === ficha.id ? ficha : d) : [...p, ficha]; });
    alert("Borrador guardado");
  };
  const sendFicha = (f) => {
    setSent((p) => [...p, { ...f, fecha: new Date().toISOString() }]);
    setDrafts((p) => p.filter((d) => d.id !== f.id));
    setTimeout(() => { setFicha(emptyFicha(agente)); setTab("historial"); }, 600);
  };
  const openDraft = (f) => { setFicha(f); setTab("ficha"); };
  const resend = (f) => { enviarFicha(f); };
  const del = (which, id) => {
    if (which === "drafts") setDrafts((p) => p.filter((d) => d.id !== id));
    else setSent((p) => p.filter((d) => d.id !== id));
  };

  return (
    <div className="max-w-md mx-auto min-h-screen relative" style={{ fontFamily: "'Montserrat','-apple-system',BlinkMacSystemFont,'Segoe UI',sans-serif", background: "#F9FAFB" }}>
      {!agente ? (
        <AgentPicker onSelect={selectAgent} ultimo={ultimoAgente} />
      ) : (
        <>
          {tab === "ficha" && <Formulario agente={agente} ficha={ficha} setFicha={setFicha} onSaveDraft={saveDraft} onSend={sendFicha} onChangeAgent={setAgenteActivo} />}
          {tab === "historial" && <Historial drafts={drafts} sent={sent} onOpenDraft={openDraft} onResend={resend} onDelete={del} />}
          {tab === "perfil" && <Perfil agente={agente} sent={sent} onChange={changeAgent} />}
          <BottomNav tab={tab} setTab={setTab} />
        </>
      )}
    </div>
  );
}
