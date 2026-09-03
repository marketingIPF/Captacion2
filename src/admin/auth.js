import { createAuthClient } from "better-auth/react";

/* Cliente de Neon Auth (Better Auth gestionado). La URL es pública: el
   servidor vive en el dominio de Neon, no en el nuestro. */
const baseURL = import.meta.env.VITE_NEON_AUTH_BASE_URL;

export const authConfigurado = Boolean(baseURL);

/* Sesión simulada para desarrollar el panel sin pasar por Google.
   `import.meta.env.DEV` solo es cierto con `vite dev`: en el build de
   producción esta rama es código muerto y desaparece del bundle, así que la
   variable no puede abrir un agujero en el sitio desplegado. */
export const authSimulada = import.meta.env.DEV && import.meta.env.VITE_AUTH_SIMULADA === "1";

const SESION_SIMULADA = {
  user: { name: "Julia (simulado)", email: "julia@inmobiliariapalanca.com" },
};

/* ── El verificador de sesión ────────────────────────────────────────────
   Neon Auth vive en su propio dominio, así que su cookie de sesión es de
   terceros (SameSite=None; Partitioned). Al volver de Google, la cookie queda
   escrita en la partición del dominio de Neon, no en la nuestra, y desde
   nuestra página no se ve. Para salvar ese salto, Neon devuelve un
   `neon_auth_session_verifier` en la URL de vuelta:

     /admin?neon_auth_session_verifier=…

   Hay que reenviarlo en la petición de sesión. La respuesta ya deja la cookie
   en NUESTRA partición, y a partir de ahí el flujo normal de cookies
   funciona. Sin este paso el panel pide la sesión sin credenciales, recibe
   null y devuelve al usuario a la pantalla de acceso — exactamente el bucle
   que veíamos.

   Se guarda en memoria en la primera lectura para que siga disponible
   después de limpiar la URL. */
const PARAM_VERIFICADOR = "neon_auth_session_verifier";
let verificador = null;
let verificadorLeido = false;

function verificadorDeSesion() {
  if (!verificadorLeido && typeof window !== "undefined") {
    verificador = new URLSearchParams(window.location.search).get(PARAM_VERIFICADOR);
    verificadorLeido = true;
  }
  return verificador;
}

/* Quita el verificador de la barra de direcciones: ya está canjeado y no
   tiene por qué quedar en el historial ni en una captura de pantalla. */
export function limpiarUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PARAM_VERIFICADOR)) return;
  url.searchParams.delete(PARAM_VERIFICADOR);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

const conVerificador = (entrada) => {
  const v = verificadorDeSesion();
  if (!v) return entrada;
  const url = typeof entrada === "string" ? new URL(entrada, baseURL) : entrada;
  url.searchParams.set(PARAM_VERIFICADOR, v);
  return url;
};

export const auth = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: "include",
    onRequest: (ctx) => {
      if (!verificadorDeSesion()) return;
      return { ...ctx, url: conVerificador(ctx.url) };
    },
    onSuccess: () => limpiarUrl(),
  },
});

export const useSesion = () => {
  const real = auth.useSession();
  return authSimulada ? { data: SESION_SIMULADA, isPending: false } : real;
};

export const entrarConGoogle = () =>
  auth.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}/admin`,
  });

export const salir = () => (authSimulada ? Promise.resolve() : auth.signOut());

/* El JWT que viaja a nuestra API. Better Auth lo emite en /token y lo firma
   con la clave cuyo JWKS publica; el servidor lo valida contra ese JWKS.
   Se guarda en memoria y se renueva cuando caduca. */
let cache = { token: null, expira: 0 };

export async function tokenDeSesion({ forzar = false } = {}) {
  if (authSimulada) return "simulado";
  const ahora = Date.now();
  if (!forzar && cache.token && ahora < cache.expira - 30_000) return cache.token;

  const r = await fetch(conVerificador(`${baseURL}/token`), { credentials: "include" });
  if (!r.ok) {
    cache = { token: null, expira: 0 };
    return null;
  }
  const { token } = await r.json();
  if (!token) return null;

  /* Se lee el `exp` del propio token para saber cuándo renovarlo. No se
     verifica aquí: de eso se encarga el servidor. */
  let expira = ahora + 5 * 60_000;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp) expira = payload.exp * 1000;
  } catch {
    /* si no se puede leer, se usa el margen por defecto */
  }
  cache = { token, expira };
  return token;
}

export const olvidarToken = () => {
  cache = { token: null, expira: 0 };
  /* Al cerrar sesión el verificador ya no vale: si se reutilizara, un
     "salir" seguido de un "entrar" podría revivir la sesión anterior. */
  verificador = null;
  verificadorLeido = true;
};
