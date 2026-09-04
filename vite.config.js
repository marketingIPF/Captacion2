import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { mockApi } from "./dev/mock-api.js";

export default defineConfig({
  plugins: [
    react(),
    /* Simulador de /api solo en desarrollo y solo si se pide explícitamente.
       `npm run dev:mock` lo activa; `npm run dev` y el build nunca. */
    ...(process.env.MOCK_API === "1" ? [mockApi()] : []),
    VitePWA({
      /* "autoUpdate": el service worker nuevo toma el control en cuanto se
         instala (skipWaiting + clientsClaim) y la app se recarga sola.
         Empecé con "prompt" para no perder una ficha a medio rellenar, pero
         eso dejaba a los agentes con la versión antigua atrapados: el aviso
         para confirmar la actualización vive en la app nueva, que el service
         worker viejo no les llegaba a servir. Y el autoguardado ya cubre el
         riesgo original: la recarga dispara `pagehide`, que vuelca la ficha. */
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Ficha de Captación · RK Palanca",
        short_name: "Captación",
        description: "App de captación inmobiliaria para el equipo de RK Palanca Fontestad.",
        lang: "es",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#cf731b",
        background_color: "#F9FAFB",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webp,woff2}"],
        /* Los manejadores de push viven en su propio archivo y se importan
           aquí: el service worker lo regenera Workbox en cada compilación y
           cualquier código escrito dentro se perdería. */
        importScripts: ["/push-sw.js"],
        /* La respuesta de /api/agentes lleva datos personales: nunca se cachea. */
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        runtimeCaching: []
      }
    })
  ]
});
