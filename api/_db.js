import { neon } from "@neondatabase/serverless";

/* Cliente de Neon sobre HTTP: sin pool de conexiones, que es justo lo que
   necesitan las funciones serverless (efímeras y muy numerosas). */
let cliente = null;

/* Error con marca propia: una variable de entorno que falta no se arregla
   reintentando, y al agente hay que decirle algo distinto que cuando la base
   de datos simplemente no responde. */
export class ErrorDeConfiguracion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "ErrorDeConfiguracion";
    this.esConfiguracion = true;
  }
}

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new ErrorDeConfiguracion("DATABASE_URL no está configurada en este entorno de Vercel");
  }
  if (!cliente) cliente = neon(process.env.DATABASE_URL);
  return cliente;
}

export const hayBaseDeDatos = () => Boolean(process.env.DATABASE_URL);
