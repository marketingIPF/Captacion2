/* Genera todos los iconos de la app a partir del logo de la empresa.

   Se usa el ISOTIPO —la RK con el arco naranja—, nunca el logo entero: estos
   iconos se pintan entre 16 y 64 px, y a ese tamaño "PALANCA FONTESTAD BY
   REALMARK INMOBILIARIA" es una mancha gris.

   Va sobre la tinta de marca y no sobre blanco porque se dibujan sobre fondos
   que no controlamos —pestañas claras, barras oscuras, avisos de macOS y de
   Android—, y la RK del logo es casi negra: sobre blanco desaparecería en la
   mitad de los sitios.

   Cada destino tiene sus reglas, y por eso no vale un único archivo:

   - Los iconos normales llevan esquinas redondeadas, que es como los pinta el
     navegador tal cual.
   - El "maskable" de Android va a SANGRE y con la marca más pequeña: el
     sistema recorta un círculo del 80% y le da la forma que quiera. Con
     esquinas redondeadas se vería un recuadro flotando dentro del círculo.
   - El de iOS también va a sangre: iOS aplica su propia máscara, y sobre unas
     esquinas ya redondeadas saldrían cuatro sombras oscuras.
   - El badge es lo que Android pinta en la barra de estado y lo convierte en
     SILUETA: solo cuenta la forma. Va sin fondo, y por eso se dibuja en negro
     (el rasterizador lo pone sobre blanco y de ahí sale la máscara).

   Uso: npm run iconos
*/
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGEN = "public/logos/logo-vertical-blanco.svg";
const CAJA = { x: 218.6, y: 28.3, ancho: 159.7, alto: 126.5 }; // medido con getBBox()
const TINTA = "#1d1d1b";
const L = 192; // lado del lienzo del SVG; el tamaño final lo da el rasterizado

/* Los siete últimos elementos del SVG son el isotipo; el resto, el texto. Se
   comprueba en vez de suponerlo: si el logo cambia y dejan de serlo, esto falla
   en lugar de generar un icono con media palabra dentro. */
const isotipo = (readFileSync(ORIGEN, "utf8").match(/<(path|polygon)\b[^>]*\/>/g) || []).slice(-7);
if (isotipo.length !== 7 || !isotipo.some((e) => e.includes("cls-2"))) {
  throw new Error("El isotipo no se ha reconocido en el logo: revisa qué elementos lo forman");
}

/* `ancho` es la fracción del lado que ocupa la marca. En el maskable baja al
   60% para que quepa entera en el círculo del 80% que recorta Android: con la
   marca apaisada, su diagonal a ese tamaño mide 0,77 del lado. */
const VARIANTES = [
  { archivo: "icon-192", tamanos: [192], ancho: 0.72, radio: 42 },
  { archivo: "icon-512", tamanos: [512], ancho: 0.72, radio: 42 },
  { archivo: "icon-maskable-512", tamanos: [512], ancho: 0.60, radio: 0 },
  { archivo: "apple-touch-icon", tamanos: [180], ancho: 0.64, radio: 0 },
  { archivo: "icono-badge", tamanos: [96], ancho: 0.78, radio: 0, silueta: true },
];

const dibujar = ({ ancho, radio, silueta }) => {
  const escala = Math.min((L * ancho) / CAJA.ancho, (L * ancho) / CAJA.alto);
  const dx = (L - CAJA.ancho * escala) / 2 - CAJA.x * escala;
  const dy = (L - CAJA.alto * escala) / 2 - CAJA.y * escala;
  const estilo = silueta ? ".cls-1,.cls-2{fill:#000}" : ".cls-1{fill:#fff}.cls-2{fill:#cf731c}";
  const fondo = silueta ? "" : `<rect width="${L}" height="${L}" rx="${radio}" fill="${TINTA}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${L}" width="${L}" height="${L}">
  <style>${estilo}</style>
  ${fondo}
  <g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${escala.toFixed(4)})">
    ${isotipo.join("\n    ")}
  </g>
</svg>
`;
};

/* El isotipo suelto, en vector, para el favicon: a 16 px un PNG se emborrona. */
writeFileSync("public/isotipo.svg", dibujar({ ancho: 0.72, radio: 42 }));

const tmp = mkdtempSync(join(tmpdir(), "iconos-"));
try {
  for (const v of VARIANTES) {
    const svg = join(tmp, `${v.archivo}.svg`);
    writeFileSync(svg, dibujar(v));

    /* qlmanage es el único rasterizador que hay en el Mac sin instalar nada, y
       siempre deja relleno blanco alrededor: por eso se recorta al contenido
       antes de reescalar. Del recorte se toma un CUADRADO centrado, para que
       la marca no se deforme. */
    execFileSync("qlmanage", ["-t", "-s", "1024", "-o", tmp, svg], { stdio: "ignore" });
    const bruto = join(tmp, `${v.archivo}.svg.png`);
    const guion = `
from PIL import Image, ImageChops
im = Image.open(${JSON.stringify(bruto)}).convert("RGBA")
blanco = Image.new("RGBA", im.size, (255, 255, 255, 255))
caja = ImageChops.difference(im, blanco).convert("L").point(lambda v: 255 if v > 8 else 0).getbbox()
if caja is None: raise SystemExit("el render salió en blanco")
lado = max(caja[2] - caja[0], caja[3] - caja[1])
cx, cy = (caja[0] + caja[2]) // 2, (caja[1] + caja[3]) // 2
im = im.crop((cx - lado // 2, cy - lado // 2, cx + lado // 2, cy + lado // 2))
if ${v.silueta ? "True" : "False"}:
    # El rasterizador no conserva la transparencia: la marca sale negra sobre
    # blanco. La máscara es eso invertido — lo negro es lo opaco.
    g = im.convert("L")
    im = Image.merge("RGBA", (g.point(lambda v: 255),) * 3 + (g.point(lambda v: 255 - v),))
for n in ${JSON.stringify(v.tamanos)}:
    nombre = "public/${v.archivo}.png" if len(${JSON.stringify(v.tamanos)}) == 1 and not "${v.archivo}".endswith("badge") else f"public/${v.archivo}-{n}.png"
    im.resize((n, n), Image.LANCZOS).save(nombre)
    print("  " + nombre)
`;
    process.stdout.write(execFileSync("python3", ["-c", guion], { encoding: "utf8" }));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log("  public/isotipo.svg");
