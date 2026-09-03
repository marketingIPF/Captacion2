import { Check, Copy } from "lucide-react";

/* Fila etiqueta/valor que se copia entera al pulsarla.
   Es un botón, no un div con onClick: así funciona con teclado y los lectores
   de pantalla anuncian qué hace. El icono solo aparece al pasar por encima,
   para no llenar la ficha de iconos y perder lo de "más visual". */
export function FilaCopiable({ etiqueta, valor, clave, copiar, copiado }) {
  const esta = copiado === clave;
  return (
    <button
      type="button"
      onClick={() => copiar(valor, clave)}
      aria-label={`Copiar ${etiqueta}: ${valor}`}
      className="group w-full flex gap-4 py-2 text-left rounded-lg px-2 -mx-2 transition hover:bg-ios-fondo dark:hover:bg-ios-elevada-osc/60"
    >
      <span className="w-2/5 shrink-0 text-[13px] text-ios-texto2 dark:text-ios-texto2-osc">
        {etiqueta}
      </span>
      <span className="flex-1 text-[13.5px] font-medium text-ios-texto dark:text-ios-texto-osc">
        {valor}
      </span>
      <span className="shrink-0 w-4 flex items-start justify-center pt-0.5" aria-hidden="true">
        {esta ? (
          <Check size={14} strokeWidth={3} className="text-green-600" />
        ) : (
          <Copy size={13} className="text-ios-texto3 opacity-0 group-hover:opacity-100 transition" />
        )}
      </span>
    </button>
  );
}

/* Botón de copiar para una sección entera o un texto largo. */
export function BotonCopiar({ texto, clave, copiar, copiado, etiqueta = "Copiar", className = "" }) {
  const esta = copiado === clave;
  return (
    <button
      type="button"
      onClick={() => copiar(texto, clave)}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
        esta
          ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400"
          : "bg-ios-fondo dark:bg-ios-elevada-osc text-ios-texto2 dark:text-ios-texto2-osc"
      } ${className}`}
    >
      {esta ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {esta ? "Copiado" : etiqueta}
    </button>
  );
}

/* Un valor suelto que se copia al pulsarlo, para la cabecera y las fichas de
   propietario. Sin icono fijo: el subrayado punteado ya insinúa que se puede
   pulsar, y el acuse sustituye el texto un instante. */
export function ValorCopiable({ valor, clave, copiar, copiado, etiqueta, className = "", children }) {
  const esta = copiado === clave;
  return (
    <button
      type="button"
      onClick={() => copiar(valor, clave)}
      aria-label={`Copiar ${etiqueta}: ${valor}`}
      title={`Copiar ${etiqueta}`}
      className={`text-left rounded transition decoration-dotted underline-offset-4 hover:underline active:scale-95 ${
        esta ? "text-green-700 dark:text-green-400" : ""
      } ${className}`}
    >
      {esta ? "¡Copiado!" : children ?? valor}
    </button>
  );
}
