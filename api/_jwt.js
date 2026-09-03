import { createRemoteJWKSet, jwtVerify } from "jose";

/* Verificación del token de Neon Auth (Better Auth).
   El panel obtiene un JWT del servidor de auth y lo manda en Authorization.
   Aquí se comprueba la firma contra el JWKS público y, después, que el email
   esté autorizado: sin ese segundo paso cualquier cuenta de Google del mundo
   entraría, porque el proveedor OAuth es compartido. */

let jwks = null;
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
      issuer: process.env.NEON_AUTH_BASE_URL || undefined,
      clockTolerance: 30,
    }));
  } catch (err) {
    const expirado = err?.code === "ERR_JWT_EXPIRED";
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
