/* Genera los avatares del equipo a partir de fotos-equipo/:
     1. Vision (macOS) localiza la cara.
     2. Se recorta un cuadrado centrado en ella, con aire alrededor.
     3. Se reduce a 192×192 y se guarda como WebP en public/avatars/.
   Uso:  node dev/generar-avatares.mjs                                    */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AGENTES } from "../src/data/agentes.js";

const ORIGEN = "fotos-equipo";
const DESTINO = "public/avatars";
const LADO = 192;
/* Cuánto se abre el recorte respecto al alto de la cara. 2.1 deja frente,
   pelo y algo de hombros: el encuadre típico de un avatar. */
const HOLGURA = 2.1;

/* El .txt del equipo asocia cada persona con el prefijo de su email. */
const NOMBRE_ARCHIVO = {
  "alejandro-garcia": "agarcia", "amparo-orts": "aorts", "asuncion-marco": "ASUN",
  "clara-ordonez": "CLARA", "claudia-stelling": "Claudia", "desiree-lopez": "DESIREE",
  "eva-valles": "EVA", "fede-carbonell": "fede", "fran-estelles": "FRAN",
  /* La coincidencia es por nombre EXACTO, así que "jose" no se confunde con
     "JOSEGIMENEZ". */
  "javier-palanca": "javi", "jose-miguel-palanca": "jose",
  "jose-gimenez": "JOSEGIMENEZ", "lorena-lull": "Lorena", "maria-luisa": "Mluisa",
  "maria-jose": "Mariajose", "mavi-castillo": "MAVI", "natalia-sanfelix": "Natalia",
  "nuria-nunez": "Nuria", "rosa-domenech": "rdomenech", "sefa-gallent": "SEFA",
  "virginia-corral": "vcorral", "yvonne-vidal": "yvidal",
};

/* Resuelve el archivo sin importar mayúsculas ni extensión. */
const archivos = existsSync(ORIGEN) ? readdirSync(ORIGEN) : [];
const buscar = (base) => {
  const b = base.toLowerCase();
  return archivos.find((f) => f.toLowerCase().replace(/\.(png|jpe?g|webp|heic)$/, "") === b);
};

mkdirSync(DESTINO, { recursive: true });

const trabajos = [];
for (const a of AGENTES) {
  const base = NOMBRE_ARCHIVO[a.id];
  if (!base) { console.warn(`· ${a.name}: sin entrada en el mapa de archivos`); continue; }
  const f = buscar(base);
  if (!f) { console.warn(`· ${a.name}: no encuentro ${base}.* en ${ORIGEN}/`); continue; }
  trabajos.push({ agente: a, ruta: join(ORIGEN, f) });
}

if (!trabajos.length) {
  console.error("No hay fotos que procesar.");
  process.exit(1);
}

console.log(`Detectando caras en ${trabajos.length} fotos…`);
const deteccion = JSON.parse(
  execFileSync("swift", ["dev/detectar-caras.swift", ...trabajos.map((t) => t.ruta)], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  })
);
const porRuta = Object.fromEntries(deteccion.map((d) => [d.archivo, d]));

/* Pillow hace el recorte y la codificación WebP. */
const plan = trabajos.map((t) => {
  const d = porRuta[t.ruta];
  const cara = d?.caras?.sort((a, b) => b.ancho * b.alto - a.ancho * a.alto)[0] || null;
  return {
    origen: t.ruta,
    destino: join(DESTINO, `${t.agente.id}.webp`),
    nombre: t.agente.name,
    ancho: d?.ancho, alto: d?.alto, cara,
  };
});

const py = `
import json, sys
from PIL import Image
plan = json.loads(sys.stdin.read())
LADO, HOLGURA = ${LADO}, ${HOLGURA}
for p in plan:
    im = Image.open(p["origen"]).convert("RGB")
    W, H = im.size
    c = p["cara"]
    if c:
        # Cuadrado centrado en la cara, desplazado un poco hacia abajo para
        # no dejar demasiada frente y recoger algo de hombros.
        cx = c["x"] + c["ancho"] / 2
        cy = c["y"] + c["alto"] / 2 + c["alto"] * 0.18
        lado = c["alto"] * HOLGURA
    else:
        # Sin cara detectada: cuadrado en el tercio superior, que es donde
        # suele estar en un retrato vertical.
        cx, cy, lado = W / 2, min(H, W) * 0.55, min(W, H)
    lado = min(lado, W, H)
    x0 = max(0, min(W - lado, cx - lado / 2))
    y0 = max(0, min(H - lado, cy - lado / 2))
    im = im.crop((round(x0), round(y0), round(x0 + lado), round(y0 + lado)))
    im = im.resize((LADO, LADO), Image.LANCZOS)
    im.save(p["destino"], "WEBP", quality=86, method=6)
    print(f'{p["nombre"]:<26} {"cara" if c else "SIN CARA — revisar"}')
`;

execFileSync("python3", ["-c", py], { input: JSON.stringify(plan), stdio: ["pipe", "inherit", "inherit"] });

const total = readdirSync(DESTINO).filter((f) => f.endsWith(".webp"));
console.log(`\n${total.length} avatares en ${DESTINO}/`);
