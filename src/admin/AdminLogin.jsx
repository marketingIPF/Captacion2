import { useState } from "react";
import { Lock, Loader2, AlertCircle } from "lucide-react";
import { Logo } from "../components/Logo.jsx";
import { entrarConGoogle, authConfigurado } from "./auth.js";

/* Logotipo de Google, según sus normas de marca. */
function IconoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AdminLogin() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const entrar = async () => {
    if (cargando) return;
    setCargando(true);
    setError("");
    try {
      await entrarConGoogle();
      /* Si todo va bien el navegador se va a Google; si vuelve aquí, falló. */
    } catch (err) {
      setError(err?.message || "No se pudo iniciar sesión");
      setCargando(false);
    }
  };

  return (
    <div data-tema="panel" className="min-h-screen flex flex-col items-center justify-center px-8 bg-ios-fondo dark:bg-ios-fondo-osc">
      <Logo orientacion="vertical" alto={110} className="mb-7" />
      <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.15em] uppercase text-rk-naranja">
        <Lock size={13} strokeWidth={2.5} aria-hidden="true" /> Panel de oficina
      </p>
      <h1 className="text-[24px] font-extrabold mt-1.5 text-ios-texto dark:text-ios-texto-osc text-center">
        Captaciones
      </h1>
      <p className="text-ios-texto2 dark:text-ios-texto2-osc mt-1.5 text-[14.5px] text-center max-w-sm">
        Entra con tu cuenta de correo de la agencia.
      </p>

      {!authConfigurado ? (
        <p role="alert" className="mt-6 max-w-sm rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-[13px] font-medium text-center">
          Falta <code>VITE_NEON_AUTH_BASE_URL</code>. El panel no puede iniciar sesión.
        </p>
      ) : (
        <button
          type="button"
          onClick={entrar}
          disabled={cargando}
          className="w-full max-w-sm mt-6 flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-[15.5px] border transition active:scale-95 disabled:opacity-60 bg-white dark:bg-ios-superficie-osc text-ios-texto dark:text-ios-texto-osc border-ios-borde dark:border-ios-borde-osc shadow-sm"
        >
          {cargando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <IconoGoogle />}
          {cargando ? "Abriendo Google…" : "Entrar con Google"}
        </button>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-semibold mt-3 text-red-600 max-w-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" /> {error}
        </p>
      )}

      <p className="text-[11px] text-ios-texto3 text-center mt-8 max-w-sm leading-relaxed">
        Acceso restringido al personal de oficina. Contiene datos personales de
        los propietarios captados.
      </p>
    </div>
  );
}
