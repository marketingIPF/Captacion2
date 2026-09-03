import { createRemoteJWKSet, jwtVerify } from "jose";

/* Verificación del token de Neon Auth (Better Auth).
   El panel obtiene un JWT del servidor de auth y lo manda en Authorization.
   Aquí se comprueba la firma contra el JWKS público y, después, que el email
   esté autorizado: sin ese segundo paso cualquier cuenta de Google del mundo
   entraría, porque el proveedor OAuth es compartido. */

let jwks = null;

/* Emisores aceptados.
   Better Auth firma con `iss` = su baseURL configurada, que en la práctica es
   el origen del servidor de auth. Se construye la lista a partir de las DOS
   variables disponibles y se descarta lo que no sea una URL http(s) válida:
   una errata al pegar el valor en Vercel (nos pasó: "ttps://…" sin la h)
   dejaba la lista inservible y producía un 401 sin explicación. Derivarlo
   también del JWKS —que es el que usa la verificación de firma— hace que el
   panel siga funcionando y que el log señale la variable rota. */
function urlValida(v) {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export function emisoresValidos() {
  const formas = new Set();
  const base = process.env.NEON_AUTH_BASE_URL;
  const jwks = process.env.NEON_AUTH_JWKS_URL;

  const uBase = urlValida(base);
  if (uBase) {
    formas.add(base.replace(/\/+$/, ""));
    formas.add(uBase.origin);
  } else if (base) {
    console.warn(`NEON_AUTH_BASE_URL no es una URL válida (${JSON.stringify(base.slice(0, 12))}…). Revisa la variable en Vercel.`);
  }

  /* El JWKS cuelga de la misma base: .../auth/.well-known/jwks.json */
  const uJwks = urlValida(jwks);
  if (uJwks) {
    formas.add(uJwks.origin);
    const baseDesdeJwks = jwks.replace(/\/\.well-known\/jwks\.json\/?$/, "");
    if (baseDesdeJwks !== jwks) formas.add(baseDesdeJwks);
  }

  return formas.size ? [...formas] : undefined;
}

/* Claims del token SIN verificar, solo para diagnosticar un rechazo.
   No se registra el email ni el resto del contenido: son datos personales. */
function pistasDelToken(token) {
  try {
    const [cabecera, cuerpo] = token.split(".");
    const h = JSON.parse(Buffer.from(cabecera, "base64url").toString());
    const p = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    return `alg=${h.alg} kid=${h.kid} iss=${p.iss} aud=${p.aud} exp=${p.exp} claims=[${Object.keys(p).join(",")}]`;
  } catch {
    return "no se pudo leer el token";
  }
}
const conjuntoClaves = () => {
  if (!jwks) {
    const url = process.env.NEON_AUTH_JWKS_URL;
    if (!url) throw new Error("NEON_AUTH_JWKS_URL no está configurada");
    jwks = createRemoteJWKSet(new URL(url));
  }
  return jwks;
};

export function tokenDe(req) {
  const cabecera = req.headers?.authorization || req.headers?.Authorization || "";
  if (!cabecera.toLowerCase().startsWith("bearer ")) return null;
  const t = cabecera.slice(7).trim();
  return t || null;
}

/* "ana@empresa.com, @otra.com" → autoriza ese email y todo el dominio otra.com */
export function emailAutorizado(email, lista = process.env.ADMIN_EMAILS) {
  if (!email || !lista) return false;
  const e = String(email).trim().toLowerCase();
  return lista
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((permitido) =>
      permitido.startsWith("@") ? e.endsWith(permitido) : e === permitido
    );
}

/* Devuelve { ok, usuario } o { ok:false, code, error }. */
export async function verificarToken(token) {
  if (!token) return { ok: false, code: 401, error: "Falta el token de sesión" };

  let payload;
  try {
    ({ payload } = await jwtVerify(token, conjuntoClaves(), {
      issuer: emisoresValidos(),
      clockTolerance: 30,
    }));
  } catch (err) {
    const expirado = err?.code === "ERR_JWT_EXPIRED";
    if (!expirado) {
      /* Sin esto, un rechazo del token es una caja negra: 401 y nada más. */
      console.error(
        `Token rechazado (${err?.code || err?.name}): ${err?.message} · ${pistasDelToken(token)} · esperados=${JSON.stringify(emisoresValidos())}`
      );
    }
    return {
      ok: false,
      code: 401,
      error: expirado ? "La sesión ha caducado" : "Sesión no válida",
    };
  }

  const email = payload.email || payload.user?.email || null;

  if (!email) {
    /* El token es válido pero no trae email: sin él no se puede aplicar la
       lista de acceso. Se registran las claves (no los valores) para poder
       diagnosticarlo sin volcar datos personales en los logs. */
    console.error("Token sin email. Claims presentes:", Object.keys(payload).join(", "));
    return { ok: false, code: 403, error: "La sesión no incluye un email verificable" };
  }

  if (!process.env.ADMIN_EMAILS) {
    console.error("ADMIN_EMAILS no está configurada: se deniega el acceso a todo el mundo.");
    return { ok: false, code: 403, error: "El panel no tiene lista de acceso configurada" };
  }

  if (!emailAutorizado(email)) {
    console.warn(`Acceso al panel denegado a ${email}`);
    return { ok: false, code: 403, error: "Esta cuenta no tiene acceso al panel" };
  }

  return {
    ok: true,
    usuario: {
      id: payload.sub || payload.id || null,
      email,
      nombre: payload.name || payload.user?.name || email,
    },
  };
}
