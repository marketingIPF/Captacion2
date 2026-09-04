/* Manejadores de notificaciones push.
   Va aparte del service worker generado por vite-plugin-pwa y se importa desde
   él (workbox.importScripts). Así la caché de la app se sigue generando sola y
   estos dos manejadores no se pierden en cada compilación. */

self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { titulo: "RK Palanca", cuerpo: evento.data ? evento.data.text() : "" };
  }

  const titulo = datos.titulo || "RK Palanca Fontestad";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      /* El isotipo de la empresa sobre la tinta de marca. El badge es lo que
         Android pinta en la barra de estado y lo convierte en silueta, así que
         va aparte: con el icono a color salía un cuadrado blanco macizo. */
      icon: "/icon-192.png",
      badge: "/icono-badge-96.png",
      /* La etiqueta agrupa: dos avisos de la misma ficha se sustituyen en vez
         de apilarse en la pantalla de bloqueo. */
      tag: datos.etiqueta || "rk-captacion",
      renotify: true,
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || "/", self.location.origin).href;

  evento.waitUntil(
    /* Si la app ya está abierta se reutiliza esa pestaña en vez de abrir otra:
       con un par de avisos al día, el navegador acabaría lleno de pestañas. */
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      for (const c of clientes) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(destino);
          return c.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
