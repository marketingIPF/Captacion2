/* Simulador de /api para desarrollo, SOLO activo con MOCK_API=1.
   Permite trabajar en el panel y en el formulario sin Neon ni `vercel dev`.
   Los datos viven en memoria y se pierden al reiniciar. */
import { randomUUID } from "node:crypto";
import { repartir } from "../api/estado.js";
import { fichaAFilaDeOficina } from "../api/_ficha.js";
import { MAX_FICHAS } from "../api/mis-fichas.js";
import { ordenPedido } from "../api/admin.js";
import { CLAVES_FASE } from "../src/lib/fases.js";

const PIN_ACCESO = "agentes-2026";

/* Lista real del equipo, para que el simulador se parezca a producción. */
/* Suscripciones push simuladas: clave endpoint|tipo, igual que en producción. */
const suscripcionesPush = new Set();

const AGENTES = [
  {
    "id": "alejandro-garcia",
    "name": "Alejandro Garcia",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/alejandro-garcia.webp"
  },
  {
    "id": "amparo-orts",
    "name": "Amparo Orts Soriano",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/amparo-orts.webp"
  },
  {
    "id": "asuncion-marco",
    "name": "Asunción Marco Aparisi",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/asuncion-marco.webp"
  },
  {
    "id": "clara-ordonez",
    "name": "Clara Ordoñez Rubiols",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/clara-ordonez.webp"
  },
  {
    "id": "claudia-stelling",
    "name": "Claudia Stelling",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/claudia-stelling.webp"
  },
  {
    "id": "desiree-lopez",
    "name": "Desiree López Martinez",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/desiree-lopez.webp"
  },
  {
    "id": "eva-valles",
    "name": "Eva Vallés",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/eva-valles.webp"
  },
  {
    "id": "fede-carbonell",
    "name": "Fede Carbonell",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/fede-carbonell.webp"
  },
  {
    "id": "fran-estelles",
    "name": "Fran Estelles",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/fran-estelles.webp"
  },
  {
    "id": "jose-gimenez",
    "name": "Jose Gimenez",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/jose-gimenez.webp"
  },
  {
    "id": "lorena-lull",
    "name": "Lorena Lull",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/lorena-lull.webp"
  },
  {
    "id": "maria-luisa",
    "name": "Mª Luisa Bellver",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/maria-luisa.webp"
  },
  {
    "id": "maria-jose",
    "name": "Maria Jose Ordoñez",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/maria-jose.webp"
  },
  {
    "id": "mavi-castillo",
    "name": "Mavi Castillo Esteban",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/mavi-castillo.webp"
  },
  {
    "id": "natalia-sanfelix",
    "name": "Natalia Sanfelix",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/natalia-sanfelix.webp"
  },
  {
    "id": "nuria-nunez",
    "name": "Nuria Nuñez",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/nuria-nunez.webp"
  },
  {
    "id": "rosa-domenech",
    "name": "Rosa Domenech",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/rosa-domenech.webp"
  },
  {
    "id": "sefa-gallent",
    "name": "Sefa Gallent Bestuer",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/sefa-gallent.webp"
  },
  {
    "id": "virginia-corral",
    "name": "Virginia Corral",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/virginia-corral.webp"
  },
  {
    "id": "yvonne-vidal",
    "name": "Yvonne Vidal",
    "role": "Agente Comercial",
    "email": "",
    "phone": "",
    "avatar": "/avatars/yvonne-vidal.webp"
  }
];

const POBLACIONES = ["Valencia", "Alboraya", "Meliana", "Foios", "Almàssera", "Tavernes Blanques"];
const CALLES = ["Avenida del Puerto", "Calle Colón", "Camí del Mar", "Plaza del Ayuntamiento", "Calle Sagunto", "Avenida Blasco Ibáñez"];
const TIPOS = ["Piso", "Ático", "Casa / Chalet", "Local", "Garaje", "Terreno"];
/* De la definición única, no copiadas: cuando se añadieron Reservado, Vendido
   y Alquilado, esta lista se quedó con las cinco de antes y el simulador
   generaba fichas que no cubrían las fases nuevas. */
const ESTADOS = CLAVES_FASE;

const fichas = new Map();

/* Semilla determinista para que el panel se vea poblado. */
for (let i = 0; i < Number(process.env.MOCK_FICHAS || 47); i++) {
  const id = randomUUID();
  const agente = AGENTES[i % AGENTES.length];
  const dias = i * 1.7;
  fichas.set(id, {
    id,
    recibida_en: new Date(Date.now() - dias * 86400000).toISOString(),
    creada_en: new Date(Date.now() - dias * 86400000).toISOString(),
    actualizada_en: new Date().toISOString(),
    agente_id: agente.id,
    agente_nombre: agente.name,
    estado: ESTADOS[i % ESTADOS.length],
    nota_oficina: i % 5 === 0 ? "Pendiente de llamar al propietario." : null,
    operacion: i % 4 === 0 ? "Alquiler" : "Venta",
    tipo: TIPOS[i % TIPOS.length],
    referencia: `REF-${1000 + i}`,
    direccion: CALLES[i % CALLES.length],
    numero: String(3 + (i % 90)),
    poblacion: POBLACIONES[i % POBLACIONES.length],
    provincia: "Valencia",
    cp: `460${String(10 + (i % 40)).padStart(2, "0")}`,
    precio: 95000 + i * 11500,
    propietarios: [
      { nombre: `Propietario ${i + 1}`, telefono: `6${String(10000000 + i * 137).slice(0, 8)}`, dni: "12345678Z", email: "" },
    ],
    datos: {
      operacion: i % 4 === 0 ? "Alquiler" : "Venta",
      tipo: TIPOS[i % TIPOS.length],
      referencia: `REF-${1000 + i}`,
      direccion: CALLES[i % CALLES.length],
      numero: String(3 + (i % 90)),
      poblacion: POBLACIONES[i % POBLACIONES.length],
      provincia: "Valencia",
      cp: `460${String(10 + (i % 40)).padStart(2, "0")}`,
      precio: String(95000 + i * 11500),
      dormitorios: String(2 + (i % 4)),
      banos: String(1 + (i % 3)),
      mConstruidos: String(60 + i * 3),
      estado: "Buen estado",
      ascensor: i % 2 ? "Sí" : "No",
      notasInternas: "Ficha de ejemplo generada por el simulador de desarrollo.",
      descripcionPublica:
        "Vivienda luminosa y bien comunicada, reformada recientemente, con amplio salón " +
        "y cocina independiente. Finca con ascensor a cota cero. A cinco minutos de metro, " +
        "colegios y supermercados. Disponible para visitas.",
    },
  });
}

const leerJson = (req) =>
  new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); }
    });
  });

const responder = (res, code, cuerpo) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(cuerpo));
};

const resumenDe = (f) => ({
  id: f.id,
  recibida: f.recibida_en,
  corregida: f.corregida_en || null,
  envios: f.envios ?? 1,
  tieneNota: Boolean(f.nota_oficina && String(f.nota_oficina).trim()),
  agenteId: f.agente_id,
  agenteName: f.agente_nombre,
  estado: f.estado,
  origen: f.origen || "agente",
  creada: f.creada_en,
  creadaPor: f.creada_por || null,
  creadaPorNombre: f.creada_por_nombre || null,
  operacion: f.operacion,
  tipo: f.tipo,
  referencia: f.referencia,
  direccion: [f.direccion, f.numero].filter(Boolean).join(" "),
  poblacion: f.poblacion,
  precio: f.precio,
});

export function mockApi() {
  return {
    name: "mock-api-desarrollo",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith("/api/")) return next();
        if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido" });

        const body = await leerJson(req);
        const ruta = req.url.split("?")[0];

        if (ruta === "/api/agentes") {
          if (body.pin !== PIN_ACCESO) return responder(res, 401, { error: "PIN incorrecto" });
          return responder(res, 200, { agentes: AGENTES, destinatario: "oficina@rk.test" });
        }

        if (ruta === "/api/push") {
          /* Probar la ENTREGA requiere un servicio de push de verdad y solo
             tiene sentido contra producción. Lo que sí se simula es el registro
             por papel, que es de donde salió el fallo del botón: el navegador
             tiene una sola suscripción y el estado lo decide el servidor. */
          const tipo = body.pin ? "agente" : "oficina";
          const clave = `${body.endpoint || body.suscripcion?.endpoint}|${tipo}`;

          if (body.accion === "estado") {
            return responder(res, 200, { activa: suscripcionesPush.has(clave) });
          }
          if (body.accion === "baja") {
            suscripcionesPush.delete(clave);
            return responder(res, 200, { ok: true });
          }
          if (body.accion !== "alta") {
            return responder(res, 400, { error: "Acción desconocida" });
          }
          if (!body.suscripcion?.endpoint) {
            return responder(res, 400, { error: "Suscripción incompleta" });
          }
          suscripcionesPush.add(clave);
          return responder(res, 200, { ok: true, simulado: true });
        }

        if (ruta === "/api/mis-fichas") {
          if (body.pin !== PIN_ACCESO) return responder(res, 401, { error: "PIN incorrecto" });
          if (!body.agenteId) return responder(res, 400, { error: "Falta el agente" });
          /* El mismo tope que el endpoint real, importado de él: si el
             simulador devolviera más, probar el recorte aquí no valdría. */
          const suyas = [...fichas.values()]
            .filter((f) => f.agente_id === body.agenteId && !f.eliminada_en)
            .sort((a, b) => String(a.recibida_en).localeCompare(String(b.recibida_en)))
            .slice(-MAX_FICHAS);
          /* Mismos campos que el endpoint real: sin la nota interna ni el
             rastro de quién editó desde el panel. */
          return responder(res, 200, {
            fichas: suyas.map((f) => ({
              id: f.id,
              agenteId: f.agente_id,
              agenteName: f.agente_nombre,
              creada: f.creada_en,
              fecha: f.recibida_en,
              data: f.datos || {},
              propietarios: f.propietarios || [],
              fase: f.estado,
              envio: { estado: "enviada", envios: f.envios ?? 1 },
            })),
          });
        }

        if (ruta === "/api/estado") {
          if (body.pin !== PIN_ACCESO) return responder(res, 401, { error: "PIN incorrecto" });
          /* Se reutiliza la función del endpoint real: si el simulador
             decidiera esto por su cuenta, probaríamos algo que no existe. */
          const ids = Array.isArray(body.ids) ? body.ids : [];
          const filas = ids.map((id) => fichas.get(id)).filter(Boolean);
          return responder(res, 200, repartir(ids, filas, body.agenteId || ""));
        }

        if (ruta === "/api/fichas") {
          if (body.pin !== PIN_ACCESO) return responder(res, 401, { error: "PIN incorrecto" });
          const f = body.ficha;
          if (!f?.id) return responder(res, 400, { error: "Ficha no válida" });
          const ahora = new Date().toISOString();
          const previa = fichas.get(f.id);
          fichas.set(f.id, {
            ...(previa || { estado: "nueva", nota_oficina: null, recibida_en: ahora }),
            /* Un reenvío es una corrección: se marca, igual que en producción. */
            corregida_en: previa ? ahora : null,
            envios: (previa?.envios ?? 0) + 1,
            id: f.id,
            creada_en: f.creada || ahora,
            actualizada_en: ahora,
            agente_id: f.agenteId,
            agente_nombre: f.agenteName,
            operacion: f.data.operacion || null,
            tipo: f.data.tipo || null,
            referencia: f.data.referencia || null,
            direccion: f.data.direccion || null,
            numero: f.data.numero || null,
            poblacion: f.data.poblacion || null,
            provincia: f.data.provincia || null,
            cp: f.data.cp || null,
            precio: Number(String(f.data.precio || "").replace(/\./g, "").replace(",", ".")) || null,
            datos: f.data,
            propietarios: f.propietarios || [],
          });
          const guardada = fichas.get(f.id);
          return responder(res, 200, {
            ok: true, id: f.id, recibida: guardada.recibida_en,
            corregida: guardada.corregida_en, envios: guardada.envios,
          });
        }

        if (ruta === "/api/admin") {
          /* En desarrollo basta con cualquier Bearer: el flujo real de Google
             se prueba contra Neon, no aquí. Sin cabecera → 401, para poder
             ejercitar la pantalla de acceso. */
          const cabecera = req.headers.authorization || "";
          if (!cabecera.toLowerCase().startsWith("bearer ")) {
            return responder(res, 401, { error: "Falta el token de sesión" });
          }
          const movimiento = (f) => f.corregida_en || f.recibida_en;
          const todas = [...fichas.values()]
            .filter((f) => !f.eliminada_en)
            .sort((a, b) => movimiento(b).localeCompare(movimiento(a)));

          if (body.accion === "resumen") {
            const porEstado = ESTADOS.map((e) => ({ estado: e, n: todas.filter((f) => f.estado === e).length })).filter((x) => x.n);
            const ventas = todas.filter((f) => f.operacion === "Venta");
            const precios = ventas.map((f) => f.precio).filter(Boolean);
            return responder(res, 200, {
              usuario: { email: "julia@inmobiliariapalanca.com", nombre: "Julia (simulado)" },
              porEstado,
              porAgente: AGENTES.map((a) => ({ agente_id: a.id, agente_nombre: a.name, n: todas.filter((f) => f.agente_id === a.id).length })),
              totales: {
                total: todas.length,
                ultimos30: todas.filter((f) => Date.now() - Date.parse(f.recibida_en) < 30 * 86400000).length,
                ventas: ventas.length,
                precio_medio_venta: precios.length ? (precios.reduce((s, n) => s + n, 0) / precios.length).toFixed(2) : null,
              },
            });
          }

          if (body.accion === "detalle") {
            const f = fichas.get(body.id);
            if (!f) return responder(res, 404, { error: "Ficha no encontrada" });
            return responder(res, 200, {
              ficha: {
                id: f.id, creada: f.creada_en, recibida: f.recibida_en, actualizada: f.actualizada_en,
                agenteId: f.agente_id, agenteName: f.agente_nombre, estado: f.estado,
                origen: f.origen || "agente",
                creadaPor: f.creada_por || null,
                creadaPorNombre: f.creada_por_nombre || null,
                notaOficina: f.nota_oficina, actualizadaPor: f.actualizada_por,
                data: f.datos, propietarios: f.propietarios,
              },
            });
          }

          if (body.accion === "actualizar") {
            const f = fichas.get(body.id);
            if (!f) return responder(res, 404, { error: "Ficha no encontrada" });
            if (body.estado) f.estado = body.estado;
            if (body.nota !== undefined && body.nota !== null) f.nota_oficina = body.nota;
            f.actualizada_en = new Date().toISOString();
            return responder(res, 200, { ok: true, ficha: { id: f.id, estado: f.estado, nota_oficina: f.nota_oficina, actualizada_en: f.actualizada_en } });
          }

          if (body.accion === "eliminar") {
            const f = fichas.get(body.id);
            if (!f || f.eliminada_en) return responder(res, 404, { error: "Ficha no encontrada o ya eliminada" });
            f.eliminada_en = new Date().toISOString();
            f.eliminada_por = "julia@inmobiliariapalanca.com";
            return responder(res, 200, { ok: true, id: f.id });
          }

          if (body.accion === "editar") {
            const f = fichas.get(body.id);
            if (!f) return responder(res, 404, { error: "Ficha no encontrada" });
            if (!body.data?.direccion) return responder(res, 400, { error: "Falta la dirección" });
            if (!body.data?.tipo) return responder(res, 400, { error: "Falta el tipo de inmueble" });
            Object.assign(f, {
              datos: body.data,
              propietarios: body.propietarios || f.propietarios,
              operacion: body.data.operacion || null,
              tipo: body.data.tipo || null,
              referencia: body.data.referencia || null,
              direccion: body.data.direccion || null,
              numero: body.data.numero || null,
              poblacion: body.data.poblacion || null,
              provincia: body.data.provincia || null,
              cp: body.data.cp || null,
              precio: Number(String(body.data.precio || "").replace(/\./g, "").replace(",", ".")) || null,
              actualizada_en: new Date().toISOString(),
              actualizada_por: "julia@inmobiliariapalanca.com",
            });
            return responder(res, 200, {
              ok: true,
              ficha: {
                id: f.id, creada: f.creada_en, recibida: f.recibida_en, actualizada: f.actualizada_en,
                agenteId: f.agente_id, agenteName: f.agente_nombre, estado: f.estado,
                origen: f.origen || "agente",
                creadaPor: f.creada_por || null,
                creadaPorNombre: f.creada_por_nombre || null,
                notaOficina: f.nota_oficina, actualizadaPor: f.actualizada_por,
                data: f.datos, propietarios: f.propietarios,
              },
            });
          }

          if (body.accion === "agentes") {
            return responder(res, 200, { agentes: AGENTES.map((a) => ({ id: a.id, name: a.name })) });
          }

          if (body.accion === "crear") {
            /* Se reutiliza la traducción del endpoint real, incluido que no
               exija nada: si el simulador validara por su cuenta, probar aquí
               "sin campos obligatorios" no demostraría nada. */
            const { ok, fila, error } = fichaAFilaDeOficina(body.ficha);
            if (!ok) return responder(res, 400, { error });
            const recibida = body.recibida
              ? new Date(body.recibida.length === 10 ? `${body.recibida}T12:00:00Z` : body.recibida).toISOString()
              : new Date().toISOString();
            const f = {
              ...fila,
              /* Como en producción: `creada_en` es cuándo se teclea (ahora) y
                 `recibida_en` cuándo ocurrió la captación (lo que se elige). */
              creada_en: new Date().toISOString(),
              recibida_en: recibida,
              actualizada_en: new Date().toISOString(),
              actualizada_por: "julia@inmobiliariapalanca.com",
              estado: ESTADOS.includes(body.estado) ? body.estado : "nueva",
              origen: "oficina",
              creada_por: "julia@inmobiliariapalanca.com",
              creada_por_nombre: "Julia Ferrando",
              envios: 0,
              nota_oficina: null,
              eliminada_en: null,
            };
            fichas.set(f.id, f);
            return responder(res, 200, {
              ok: true,
              ficha: {
                id: f.id, creada: f.creada_en, recibida: f.recibida_en, actualizada: f.actualizada_en,
                agenteId: f.agente_id, agenteName: f.agente_nombre, estado: f.estado, origen: f.origen,
                creadaPor: f.creada_por || null, creadaPorNombre: f.creada_por_nombre || null,
                notaOficina: f.nota_oficina, actualizadaPor: f.actualizada_por,
                data: f.datos, propietarios: f.propietarios,
              },
            });
          }

          /* Sin esto, una acción que el simulador no conozca caía en el
             listado y devolvía algo sin la forma esperada: un fallo real
             pasaba por respuesta válida. */
          const CONOCIDAS = ["listar", "detalle", "actualizar", "editar", "eliminar", "resumen", "crear", "agentes", undefined];
          if (!CONOCIDAS.includes(body.accion)) {
            return responder(res, 400, { error: `Acción desconocida: ${body.accion}` });
          }

          const t = (body.busqueda || "").trim().toLowerCase();
          let filtradas = todas;
          if (body.estado) filtradas = filtradas.filter((f) => f.estado === body.estado);
          if (t) {
            filtradas = filtradas.filter((f) =>
              [f.direccion, f.poblacion, f.referencia, f.agente_nombre].filter(Boolean).some((v) => v.toLowerCase().includes(t))
            );
          }
          /* Se ordena como el endpoint real —mismas claves, mismo criterio para
             las que no tienen referencia y mismo desempate— porque si aquí
             saliera otro orden, probarlo en local no diría nada. */
          const { campo, sentido } = ordenPedido(body);
          const numRef = (f) => {
            const n = String(f.referencia || "").replace(/[^0-9]/g, "");
            return n === "" ? null : Number(n);
          };
          const clave = {
            referencia: numRef,
            precio: (f) => (f.precio == null ? null : Number(f.precio)),
            fecha: (f) => Date.parse(f.corregida_en || f.recibida_en),
            agente: (f) => f.agente_nombre || null,
          }[campo];
          filtradas = filtradas.slice().sort((a, b) => {
            const x = clave(a), y = clave(b);
            if (x === y) return String(b.id).localeCompare(String(a.id));
            if (x === null || x === undefined) return 1;   // sin dato, al final
            if (y === null || y === undefined) return -1;
            const cmp = typeof x === "string" ? x.localeCompare(y) : x - y;
            return sentido === "asc" ? cmp : -cmp;
          });

          const desde = (body.desde || 1) - 1;
          const limite = body.limite || 50;
          return responder(res, 200, {
            fichas: filtradas.slice(desde, desde + limite).map(resumenDe),
            total: filtradas.length,
          });
        }

        return responder(res, 404, { error: "Endpoint desconocido" });
      });
    },
  };
}
