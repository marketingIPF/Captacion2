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

export const auth = createAuthClient({
  baseURL,
  fetchOptions: { credentials: "include" },
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

  const r = await fetch(`${baseURL}/token`, { credentials: "include" });
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

export const olvidarToken = () => { cache = { token: null, expira: 0 }; };
