/* Ahorra+ Service Worker — soporte PWA + notificaciones locales */
self.addEventListener("install", (e) => { self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

// Permite a la página pedir que el SW muestre una notificación
// (en iOS, las notificaciones de PWA requieren el SW registrado)
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "show-notification") {
    self.registration.showNotification(data.title || "Ahorra+", {
      body: data.body || "",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: data.tag || "ahorra-plus",
      vibrate: [80, 40, 80],
      data: { url: "./index.html" },
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow("./index.html");
    })
  );
});
