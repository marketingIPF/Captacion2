import { neon } from "@neondatabase/serverless";

/* Cliente de Neon sobre HTTP: sin pool de conexiones, que es justo lo que
   necesitan las funciones serverless (efímeras y muy numerosas). */
let cliente = null;

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada");
  }
  if (!cliente) cliente = neon(process.env.DATABASE_URL);
  return cliente;
}

export const hayBaseDeDatos = () => Boolean(process.env.DATABASE_URL);
