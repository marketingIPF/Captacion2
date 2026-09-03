import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Logo } from "../components/Logo.jsx";

export function PinGate({ onUnlock, avisoInicial = "" }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(avisoInicial);

  const submit = async (e) => {
    e?.preventDefault();
    if (!pin.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/agentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (!r.ok) {
        const msg =
          r.status === 401 ? "PIN incorrecto"
          : r.status === 429 ? "Demasiados intentos. Espera unos minutos."
          : "Error de conexión, inténtalo de nuevo";
        setError(msg);
        setLoading(false);
        return;
      }
      onUnlock(await r.json(), pin.trim());
    } catch {
      setError("Sin conexión. Comprueba tu red e inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="min-h-screen flex flex-col items-center justify-center bg-ios-fondo px-8">
      <Logo orientacion="vertical" tema="tinta" alto={118} className="mb-6" />
      <div className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.15em] uppercase text-rk-naranja">
        <Lock size={13} strokeWidth={2.5} aria-hidden="true" /> Acceso privado
      </div>
      <h1 className="text-[24px] font-extrabold leading-tight mt-1.5 text-ios-texto text-center">Ficha de Captación</h1>
      <p className="text-ios-texto2 mt-1 text-[15px] text-center">Introduce el PIN del equipo para continuar</p>

      <label htmlFor="pin" className="sr-only">PIN de acceso</label>
      <input
        id="pin"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        type="password"
        autoComplete="one-time-code"
        placeholder="PIN"
        aria-invalid={!!error}
        aria-describedby={error ? "pin-error" : undefined}
        className="w-full mt-6 bg-white text-ios-texto placeholder-ios-texto3 rounded-2xl px-4 py-3.5 text-center text-[18px] tracking-widest outline-none border border-ios-borde focus:border-rk-naranja focus:ring-2 focus:ring-rk-naranja/20 transition"
      />
      {error && (
        <p id="pin-error" role="alert" className="text-center text-[13px] font-semibold mt-2 text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !pin.trim()}
        className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[16px] text-white bg-rk-naranja shadow-lg active:scale-95 transition disabled:opacity-50"
      >
        {loading ? (<><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Comprobando…</>) : "Entrar"}
      </button>

      <p className="text-[11px] text-ios-texto3 text-center mt-6 leading-relaxed">
        Esta app contiene datos personales del equipo y de los propietarios.
        No compartas el PIN fuera de la agencia.
      </p>
    </form>
  );
}
