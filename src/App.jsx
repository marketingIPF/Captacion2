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

  const ultimoAgente = useMemo(() => load(K.AGENT, null), []);

  useEffect(() => { save(K.DRAFTS, drafts); }, [drafts]);
  useEffect(() => { save(K.SENT, sent); }, [sent]);

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

  const openDraft = (f) => {
    setFicha(f);
    setTab("ficha");
    toast("Borrador abierto", "info");
  };

  /* Reintento manual desde el historial. */
  const reintentar = async (f) => {
    const res = await enviarAlServidor(f, pin);
    if (res.ok) {
      desencolar(f.id);
      setSent((p) => p.map((x) => (x.id === f.id ? { ...x, envio: { estado: "enviada" } } : x)));
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
        />
      )}
      {tab === "historial" && (
        <Historial
          drafts={drafts}
          sent={sent}
          enCola={enCola}
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
