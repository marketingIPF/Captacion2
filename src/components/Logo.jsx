/* Logotipo oficial. Dos variantes por orientación: tinta para fondos claros y
   blanco para fondos oscuros. `tema` fuerza una; por defecto sigue el modo
   claro/oscuro del sistema con <picture>, sin JavaScript. */
const RUTA = {
  vertical: { tinta: "/logos/logo-vertical-tinta.svg", blanco: "/logos/logo-vertical-blanco.svg" },
  horizontal: { tinta: "/logos/logo-horizontal-tinta.svg", blanco: "/logos/logo-horizontal-blanco.svg" },
};

const PROPORCION = { vertical: 566.93 / 368.5, horizontal: 1034.69 / 206.5 };

export function Logo({ orientacion = "horizontal", tema = "auto", alto = 40, className = "" }) {
  const src = RUTA[orientacion];
  const alt = "RK Palanca Fontestad";
  const estilo = { height: alto, width: alto * PROPORCION[orientacion] };

  if (tema === "tinta" || tema === "blanco") {
    return <img src={src[tema]} alt={alt} style={estilo} className={className} />;
  }

  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={src.blanco} />
      <img src={src.tinta} alt={alt} style={estilo} className={className} />
    </picture>
  );
}
