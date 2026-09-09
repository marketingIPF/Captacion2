import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PinGate } from "./screens/PinGate.jsx";
import { AgentPicker } from "./screens/AgentPicker.jsx";
import { Formulario } from "./screens/Formulario.jsx";
import { Historial } from "./screens/Historial.jsx";
import { Perfil } from "./screens/Perfil.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { useToast } from "./hooks/useToast.jsx";
import { useAutosave } from "./hooks/useAutosave.js";
import { fichaVacia } from "./lib/ficha.js";
import { enviarAlServidor, encolar, desencolar, pendientes, procesarCola } from "./lib/cola.js";
import { consultarEstados } from "./lib/estados.js";
import { pedirMisFichas, unirHistorial } from "./lib/recuperar.js";
import { K, load, save, remove, loadCacheAgentes, saveCacheAgentes, podar } from "./lib/storage.js";

export default function App() {
  const [agentesData, setAgentesData] = useState(loadCacheAgentes);
  const [pin, setPin] = useState(() => load(K.PIN, ""));
  const [autoChecking, setAutoChecking] = useState(
    () => !!new URLSearchParams(window.location.search).get("pin") && !loadCacheAgentes()
  );
  const [avisoPin, setAvisoPin] = useState("");
  const [agente, setAgente] = useState(null);
  const [drafts, setDrafts] = useState(() => load(K.DRAFTS, []));
  const [sent, setSent] = useState(() => load(K.SENT, []));
  const [enCola, setEnCola] = useState(pendientes);
  const [tab, setTab] = useState("ficha");
  const [ficha, setFicha] = useState(() => load(K.BORRADOR_ACTIVO, null) || fichaVacia(null));
  const toast = useToast();
  const procesando = useRef(false);
  const consultando = useRef(false);
  const avisadas = useRef(new Set());

  const ultimoAgente = useMemo(() => load(K.AGENT, null), []);

  /* ¿La ficha en pantalla ya está en la oficina? Cambia los textos del
     formulario y del envío: reenviarla la actualiza, no crea otra. */
  const corrigiendo = useMemo(() => sent.some((x) => x.id === ficha.id), [sent, ficha.id]);

  useEffect(() => { save(K.DRAFTS, drafts); }, [drafts]);
  useEffect(() => { save(K.SENT, sent); }, [sent]);

  /* La lista vigente, para poder consultarla desde una función asíncrona sin
     depender de cuándo se ejecute el actualizador de estado. */
  const sentRef = useRef(sent);
  useEffect(() => { sentRef.current = sent; }, [sent]);

  /* El seguro contra perder una ficha a medio rellenar. */
  useAutosave(K.BORRADOR_ACTIVO, ficha, { activo: !!agente });

  const unlock = useCallback((data, pinUsado) => {
    saveCacheAgentes(data);
    setAgentesData(data);
    if (pinUsado) {
      save(K.PIN, pinUsado);
      setPin(pinUsado);
    }
  }, []);

  /* ---------------- Cola de envío ---------------- */
  const vaciarCola = useCallback(
    async (silencioso = false) => {
      if (procesando.current || !pin || !pendientes()) return;
      procesando.current = true;
      const r = await procesarCola(pin);
      procesando.current = false;
      setEnCola(pendientes());

      if (r.enviadas) {
        setSent((p) => p.map((f) => (f.envio?.estado === "pendiente" ? { ...f, envio: { estado: "enviada" } } : f)));
        toast(`${r.enviadas} ficha${r.enviadas === 1 ? "" : "s"} enviada${r.enviadas === 1 ? "" : "s"} a la oficina`);
      }
      if (r.rechazadas) toast(`${r.rechazadas} ficha${r.rechazadas === 1 ? "" : "s"} no se pudo enviar. Revísala en el historial.`, "error", 6000);
      if (!r.enviadas && !r.rechazadas && !silencioso) {
        toast(
          r.motivo === "servidor"
            ? "La oficina no responde. Se reintentará solo."
            : "Todavía sin conexión. Se reintentará solo.",
          "info"
        );
      }
    },
    [pin, toast]
  );

  /* ---------------- Fases: qué ha hecho la oficina ----------------
     El historial mostraría "recibida en la oficina" para siempre si no se
     preguntara. Se consulta al abrir el historial, al arrancar y al volver a
     la app; no hace falta más para algo que cambia unas pocas veces al día. */
  const sincronizarFases = useCallback(async () => {
    /* Solo las fichas de quien está usando el móvil ahora mismo. Un agente no
       tiene por qué enterarse de lo que la oficina hace con las captaciones de
       otro, aunque hayan pasado por este mismo teléfono. */
    const mias = sent.filter((f) => f.envio?.estado === "enviada" && f.agenteId === agente?.id);
    const ids = mias.map((f) => f.id);
    if (!pin || !agente?.id || !ids.length) return;

    /* Dos vueltas seguidas a la app pueden preguntar con la misma lista, antes
       de que se haya rehecho el historial. Sin este cerrojo el aviso salía otra
       vez por una ficha que ya se había quitado. */
    if (consultando.current) return;
    consultando.current = true;
    const r = await consultarEstados(pin, ids, agente.id).finally(() => {
      consultando.current = false;
    });
    if (!r.ok) return;

    if (r.eliminadas.length) {
      setSent((p) => p.filter((f) => !r.eliminadas.includes(f.id)));

      /* Se avisa de cada ficha una sola vez. El servidor seguirá diciendo que
         no la tiene cada vez que se le pregunte, y eso no es una novedad. */
      const nuevas = r.eliminadas.filter((id) => !avisadas.current.has(id));
      nuevas.forEach((id) => avisadas.current.add(id));
      if (nuevas.length) {
        toast(
          nuevas.length === 1
            ? "La oficina ha eliminado una ficha de tu historial"
            : `La oficina ha eliminado ${nuevas.length} fichas de tu historial`,
          "info",
          6000
        );
      }
    }

    setSent((p) =>
      p.map((f) => (r.estados[f.id] && r.estados[f.id] !== f.fase ? { ...f, fase: r.estados[f.id] } : f))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, sent, agente?.id, toast]);

  /* ---------------- Recuperar el historial de la oficina ----------------
     El historial es de este móvil, y eso falla más de lo que parece: un
     teléfono nuevo, o el navegador limpiando su almacenamiento, dejaban al
     agente sin ver captaciones que la oficina sí tiene. Se pide al elegir
     agente y con el botón del historial. */
  const recuperarHistorial = useCallback(
    async (silencioso = true) => {
      if (!pin || !agente?.id) return { ok: false };
      const r = await pedirMisFichas(pin, agente.id);
      if (!r.ok) {
        if (!silencioso) toast("No se pudo consultar la oficina. Inténtalo luego.", "error");
        return r;
      }

      /* La cuenta se hace ANTES de tocar el estado. Hacerla dentro del
         actualizador de setSent no vale: se ejecuta más tarde, así que el
         aviso leía siempre cero y el agente no se enteraba de que se le había
         recuperado el historial. `sentRef` guarda la lista vigente. */
      const previas = sentRef.current;
      const conocidas = new Set(previas.map((f) => f.id));
      const recuperadas = r.fichas.filter((f) => !conocidas.has(f.id)).length;
      setSent(podar(unirHistorial(previas, r.fichas)));

      /* Solo se dice algo cuando aparece algo: si el móvil ya las tenía todas,
         un aviso de "0 recuperadas" sería ruido. */
      if (recuperadas) {
        toast(
          recuperadas === 1
            ? "Se ha recuperado 1 ficha de la oficina"
            : `Se han recuperado ${recuperadas} fichas de la oficina`,
          "info",
          5000
        );
      } else if (!silencioso) {
        toast("Tu historial ya está al día");
      }
      return { ok: true, recuperadas };
    },
    [pin, agente?.id, toast]
  );

  /* Al elegir agente, una vez. No en cada vuelta a la app: trae las fichas
     completas y no hace falta tan a menudo. */
  const recuperadoPara = useRef(null);
  useEffect(() => {
    if (!pin || !agente?.id || recuperadoPara.current === agente.id) return;
    recuperadoPara.current = agente.id;
    recuperarHistorial(true);
  }, [pin, agente?.id, recuperarHistorial]);

  /* El listener de abajo se registra una sola vez, así que sin esto se quedaría
     llamando a la primera versión de sincronizarFases, con la lista de fichas
     del arranque: cada vez que se volvía a la app repetía el aviso de una ficha
     que ya se había quitado del historial. */
  const sincronizarRef = useRef(sincronizarFases);
  useEffect(() => { sincronizarRef.current = sincronizarFases; }, [sincronizarFases]);

  useEffect(() => {
    if (tab !== "historial") return;
    sincronizarRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, pin, agente?.id]);

  useEffect(() => {
    const alVolver = () => document.visibilityState === "visible" && sincronizarRef.current();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  /* Al arrancar y cada vez que vuelve la red. */
  useEffect(() => {
    vaciarCola(true);
    const alVolver = () => vaciarCola(true);
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, [vaciarCola]);

  /* Link con ?pin=… : se valida solo y se limpia la URL de inmediato. */
  useEffect(() => {
    const pinUrl = new URLSearchParams(window.location.search).get("pin");
    if (!pinUrl) return;

    const limpiarUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("pin");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    };

    if (agentesData) {
      limpiarUrl();
      return;
    }

    (async () => {
      try {
        const r = await fetch("/api/agentes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinUrl }),
        });
        if (r.ok) unlock(await r.json(), pinUrl);
        else if (r.status === 401) setAvisoPin("El enlace tiene un PIN caducado. Pide el nuevo a la oficina.");
        else if (r.status === 429) setAvisoPin("Demasiados intentos. Espera unos minutos.");
        else setAvisoPin("No se pudo validar el enlace. Introduce el PIN a mano.");
      } catch {
        setAvisoPin("Sin conexión. Introduce el PIN cuando vuelvas a tener red.");
      }
      limpiarUrl();
      setAutoChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Agente ---------------- */
  const selectAgent = (a) => {
    setAgente(a);
    save(K.AGENT, a);
    setFicha((f) => (Object.keys(f.data).length ? { ...f, agenteId: a.id, agenteName: a.name } : fichaVacia(a)));
    setTab("ficha");
  };

  const changeAgent = () => {
    setAgente(null);
    remove(K.AGENT);
  };

  const setAgenteActivo = (id) => {
    const a = agentesData.agentes.find((x) => x.id === id);
    if (!a) return;
    setAgente(a);
    save(K.AGENT, a);
    setFicha((f) => ({ ...f, agenteId: a.id, agenteName: a.name }));
  };

  const refreshAgentes = () => {
    remove(K.CACHE);
    setAgentesData(null);
    toast("Vuelve a introducir el PIN para descargar la lista", "info");
  };

  const cerrarSesion = () => {
    if (pendientes()) {
      toast("Quedan fichas por enviar. Espera a tener conexión antes de salir.", "error", 5000);
      return;
    }
    remove(K.CACHE);
    remove(K.AGENT);
    remove(K.PIN);
    setPin("");
    setAgentesData(null);
    setAgente(null);
  };

  /* ---------------- Fichas ---------------- */
  const saveDraft = useCallback(() => {
    setDrafts((p) => {
      const existe = p.some((d) => d.id === ficha.id);
      return podar(existe ? p.map((d) => (d.id === ficha.id ? ficha : d)) : [...p, ficha]);
    });
  }, [ficha]);

  const onEnviada = useCallback(
    (f, envio) => {
      setSent((p) => podar([...p.filter((x) => x.id !== f.id), { ...f, fecha: new Date().toISOString(), envio }]));
      setDrafts((p) => p.filter((d) => d.id !== f.id));
      setEnCola(pendientes());
      setTimeout(() => {
        setFicha(fichaVacia(agente));
        remove(K.BORRADOR_ACTIVO);
        setTab("historial");
      }, 700);
    },
    [agente]
  );

  /* Sirve para borradores y para corregir una ya enviada: en el segundo caso
     la ficha conserva su id, así que al reenviarla el servidor actualiza la
     que existe en vez de crear otra. */
  const openDraft = (f) => {
    const yaEnviada = sent.some((x) => x.id === f.id);
    setFicha(f);
    setTab("ficha");
    toast(yaEnviada ? "Corrige lo que haga falta y reenvía" : "Borrador abierto", "info");
  };

  /* Reintento manual desde el historial. */
  const reintentar = async (f) => {
    const res = await enviarAlServidor(f, pin);
    if (res.ok) {
      desencolar(f.id);
      setSent((p) => p.map((x) => (x.id === f.id ? { ...x, envio: { estado: "enviada", envios: res.envios } } : x)));
      setEnCola(pendientes());
      toast("Ficha enviada a la oficina");
    } else if (res.tipo === "rechazada") {
      desencolar(f.id);
      setSent((p) => p.map((x) => (x.id === f.id ? { ...x, envio: { estado: "rechazada", error: res.error } } : x)));
      setEnCola(pendientes());
      toast(res.error, "error", 6000);
    } else {
      encolar(f);
      setEnCola(pendientes());
      toast(
        res.tipo === "servidor"
          ? `La oficina no pudo guardarla: ${res.error}. Se reintentará solo.`
          : "Sigue sin haber conexión. Se reintentará solo.",
        "info",
        6000
      );
    }
    return res;
  };

  const del = (which, id) => {
    if (which === "drafts") setDrafts((p) => p.filter((d) => d.id !== id));
    else setSent((p) => p.filter((d) => d.id !== id));
    desencolar(id);
    setEnCola(pendientes());
    toast("Ficha eliminada", "info");
  };

  const borrarTodo = () => {
    setDrafts([]);
    setSent([]);
    remove(K.BORRADOR_ACTIVO);
    remove(K.COLA);
    setEnCola(0);
    setFicha(fichaVacia(agente));
    toast("Datos borrados de este dispositivo");
  };

  /* ---------------- Render ---------------- */
  if (autoChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-fondo">
        <Loader2 size={28} className="animate-spin text-rk-naranja" aria-label="Validando acceso" />
      </div>
    );
  }

  if (!agentesData) return <PinGate onUnlock={unlock} avisoInicial={avisoPin} />;

  if (!agente) {
    return <AgentPicker agentes={agentesData.agentes} onSelect={selectAgent} ultimo={ultimoAgente} />;
  }

  return (
    <>
      {tab === "ficha" && (
        <Formulario
          agente={agente}
          agentes={agentesData.agentes}
          pin={pin}
          ficha={ficha}
          setFicha={setFicha}
          onSaveDraft={saveDraft}
          onEnviada={onEnviada}
          onChangeAgent={setAgenteActivo}
          esCorreccion={corrigiendo}
        />
      )}
      {tab === "historial" && (
        <Historial
          drafts={drafts}
          sent={sent}
          enCola={enCola}
          onSincronizarFases={async () => {
            /* Un solo botón para el agente: pone al día las fases y, además,
               trae lo que la oficina tenga y a este móvil le falte. */
            await recuperarHistorial(false);
            await sincronizarFases();
          }}
          onOpenDraft={openDraft}
          onReintentar={reintentar}
          onSincronizar={() => vaciarCola(false)}
          onDelete={del}
        />
      )}
      {tab === "perfil" && (
        <Perfil
          agente={agente}
          sent={sent}
          drafts={drafts}
          enCola={enCola}
          pin={pin}
          onChangeAgent={changeAgent}
          onRefreshAgentes={refreshAgentes}
          onCerrarSesion={cerrarSesion}
          onBorrarTodo={borrarTodo}
        />
      )}
      <BottomNav tab={tab} setTab={setTab} badge={drafts.length + enCola} />
    </>
  );
}
