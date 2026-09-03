import { useCallback, useRef, useState } from "react";

/* Copiar al portapapeles con acuse de recibo por elemento.
   `copiado` guarda la clave de lo último copiado para poder marcar solo esa
   fila, no todas. Se limpia solo a los dos segundos. */
export function useCopiar() {
  const [copiado, setCopiado] = useState(null);
  const [error, setError] = useState("");
  const temporizador = useRef(null);

  const copiar = useCallback(async (texto, clave) => {
    if (!texto) return false;
    try {
      await navigator.clipboard.writeText(texto);
      setError("");
      setCopiado(clave);
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(null), 2000);
      return true;
    } catch {
      /* Algunos navegadores lo bloquean si no hay un gesto directo. */
      setError("El navegador no permitió copiar. Selecciona el texto a mano.");
      return false;
    }
  }, []);

  return { copiar, copiado, error };
}
