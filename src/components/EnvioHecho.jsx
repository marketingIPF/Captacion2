import { Send } from "lucide-react";

/* El acuse de recibo de una captación que ya está en la oficina.

   Es lo único que el agente se lleva después de un rato rellenando la ficha
   en el portal de un edificio, así que se le dedica un segundo largo: el
   avión sale volando, el círculo entra, el visto se dibuja y debajo aparece
   la referencia. Mientras tanto la app archiva la ficha y prepara el
   historial, así que el tiempo no se regala: se aprovecha.

   Con "reducir movimiento" activado, la regla global de index.css deja las
   animaciones en 0,01 ms. Los retardos se mantienen, así que esto sigue
   contándose en el mismo orden pero sin movimiento, y cada pieza aparece ya
   en su sitio: el estado final de todas ellas es el visible.               */
export function EnvioHecho({ referencia, esCorreccion = false }) {
  return (
    <div className="px-6 py-10 flex flex-col items-center text-center">
      <div className="relative w-[104px] h-[104px] flex items-center justify-center">
        <span className="envio-onda" aria-hidden="true" />
        <span className="envio-onda envio-onda-2" aria-hidden="true" />

        {/* El avión es el mismo icono del botón de enviar: sale de donde
            estaba el dedo y se va. */}
        <Send size={26} className="absolute text-rk-naranja envio-avion" aria-hidden="true" />

        <div className="envio-circulo w-[76px] h-[76px] rounded-full bg-[#16a34a] flex items-center justify-center">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
            <path
              className="envio-visto"
              d="M8 17.5 L14.5 24 L26 11"
              fill="none"
              stroke="#fff"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <p className="envio-texto text-[19px] font-extrabold text-ios-texto mt-5">
        {esCorreccion ? "Corrección enviada" : "Captación enviada"}
      </p>
      <p className="envio-texto envio-texto-2 text-[13.5px] text-ios-texto2 mt-1">
        {referencia && <span className="font-semibold tabular-nums text-ios-texto">{referencia} · </span>}
        La oficina ya la tiene.
      </p>
    </div>
  );
}
