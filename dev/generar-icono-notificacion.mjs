/* Genera el icono de las notificaciones a partir del logo de la empresa.

   Se queda con el ISOTIPO —la RK con el arco naranja—, no con el logo entero:
   el navegador pinta este icono a unos 48 px, y a ese tamaño "PALANCA
   FONTESTAD BY REALMARK INMOBILIARIA" es una mancha gris ilegible.

   Va sobre la tinta de marca en vez de sobre blanco porque el aviso se pinta
   sobre fondos que no controlamos (claro en macOS, oscuro en Android): un
   isotipo negro sobre blanco desaparecería en la mitad de ellos.

   Uso: npm run icono
*/
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGEN = "public/logos/logo-vertical-blanco.svg";
const CAJA = { x: 218.6, y: 28.3, ancho: 159.7, alto: 126.5 }; // medido con getBBox()
const FONDO = "#1d1d1b";
const MARGEN = 0.28; // el isotipo ocupa el 72% del lado: un recorte circular no lo toca
const TAMANOS = [192, 512];

/* Los siete últimos elementos del SVG son el isotipo; el resto, el texto. Se
   comprueba en vez de suponerlo: si el logo cambia y dejan de serlo, esto falla
   en vez de generar un icono con media palabra dentro. */
const svg = readFileSync(ORIGEN, "utf8");
const isotipo = (svg.match(/<(path|polygon)\b[^>]*\/>/g) || []).slice(-7);
if (isotipo.length !== 7 || !isotipo.some((e) => e.includes("cls-2"))) {
  throw new Error("El isotipo no se ha reconocido en el logo: revisa qué elementos lo forman");
}

const LADO = 192;
const util = LADO * (1 - MARGEN);
const escala = Math.min(util / CAJA.ancho, util / CAJA.alto);
const dx = (LADO - CAJA.ancho * escala) / 2 - CAJA.x * escala;
const dy = (LADO - CAJA.alto * escala) / 2 - CAJA.y * escala;

const marca = `  <g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${escala.toFixed(4)})">
    ${isotipo.join("\n    ")}
  </g>`;

const iconoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" width="${LADO}" height="${LADO}">
  <style>.cls-1{fill:#fff}.cls-2{fill:#cf731c}</style>
  <rect width="${LADO}" height="${LADO}" rx="42" fill="${FONDO}"/>
${marca}
</svg>
`;
writeFileSync("public/icono-notificacion.svg", iconoSvg);

/* El badge es lo que Android pinta en la barra de estado, y lo convierte en
   SILUETA: solo cuenta la forma, no el color. Por eso va sin fondo. Con el
   icono a color de antes, la silueta salía un cuadrado macizo.
   Se dibuja en NEGRO porque el rasterizador lo pone sobre blanco: de ahí sale
   directamente la máscara. En blanco no se vería nada. */
const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" width="${LADO}" height="${LADO}">
  <style>.cls-1,.cls-2{fill:#000}</style>
${marca}
</svg>
`;
writeFileSync("public/icono-badge.svg", badgeSvg);

/* A PNG, porque el icono de una notificación en SVG no lo admiten todos los
   navegadores (iOS, en particular). qlmanage es el único rasterizador que hay
   en el Mac sin instalar nada, y siempre deja relleno blanco alrededor: por eso
   se recorta al contenido antes de reescalar. */
const tmp = mkdtempSync(join(tmpdir(), "icono-"));
try {
  const trabajos = [
    { svg: "public/icono-notificacion.svg", salida: "public/icono-notificacion", tamanos: TAMANOS, alfa: false },
    { svg: "public/icono-badge.svg", salida: "public/icono-badge", tamanos: [96], alfa: true, margen: 0.12 },
  ];

  for (const t of trabajos) {
    execFileSync("qlmanage", ["-t", "-s", "1024", "-o", tmp, t.svg], { stdio: "ignore" });
    const bruto = join(tmp, t.svg.split("/").pop() + ".png");
    const guion = `
from PIL import Image, ImageChops
im = Image.open(${JSON.stringify(bruto)}).convert("RGBA")
blanco = Image.new("RGBA", im.size, (255, 255, 255, 255))
caja = ImageChops.difference(im, blanco).convert("L").point(lambda v: 255 if v > 8 else 0).getbbox()
if caja is None: raise SystemExit("el render salió en blanco")
lado = max(caja[2] - caja[0], caja[3] - caja[1])
cx, cy = (caja[0] + caja[2]) // 2, (caja[1] + caja[3]) // 2
lado = int(lado * (1 + ${t.margen ?? 0} * 2))
im = im.crop((cx - lado // 2, cy - lado // 2, cx + lado // 2, cy + lado // 2))
if ${t.alfa ? "True" : "False"}:
    # El rasterizador no conserva la transparencia: la marca sale negra sobre
    # blanco. La máscara es justo eso invertido — negro = opaco.
    gris = im.convert("L")
    im = Image.merge("RGBA", (gris.point(lambda v: 255),) * 3 + (gris.point(lambda v: 255 - v),))
for n in ${JSON.stringify(t.tamanos)}:
    im.resize((n, n), Image.LANCZOS).save(f"${t.salida}-{n}.png")
print("${t.salida}: " + " ".join(str(n) for n in ${JSON.stringify(t.tamanos)}))
`;
    console.log(execFileSync("python3", ["-c", guion], { encoding: "utf8" }).trim());
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log("Escritos public/icono-notificacion.svg y los PNG");
