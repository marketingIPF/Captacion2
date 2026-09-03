/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        /* Naranja e imagotipo de marca. "tinta" es el negro del logo, que se
           reserva para tipografía, no para bloques grandes. */
        rk: {
          naranja: "#cf731c",
          naranjaHover: "#b8641456",
          soft: "#fbeede",
          softBorde: "#f0d9bd",
          tinta: "#1d1d1b",
        },
        /* Escala de grises al estilo de los System Colors de Apple: en claro
           los fondos son grises muy suaves, y en oscuro nunca negro puro. */
        ios: {
          fondo: "#f2f2f7",
          superficie: "#ffffff",
          elevada: "#ffffff",
          borde: "#e5e5ea",
          separador: "#d1d1d6",
          texto: "#1c1c1e",
          texto2: "#6c6c70",
          texto3: "#8e8e93",
          "fondo-osc": "#1c1c1e",
          "superficie-osc": "#2c2c2e",
          "elevada-osc": "#3a3a3c",
          "borde-osc": "#3a3a3c",
          "separador-osc": "#48484a",
          "texto-osc": "#f5f5f7",
          "texto2-osc": "#98989d",
        },
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      spacing: {
        safe: "env(safe-area-inset-bottom)",
      },
    },
  },
  plugins: [],
};
