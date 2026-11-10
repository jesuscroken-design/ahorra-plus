/* Ahorra+ Service Worker — PWA con caché + notificaciones locales
   - cache-first para assets estáticos (icons, manifest)
   - network-first para app.js / styles.css / index.html (siempre la última versión,
     con fallback al caché si no hay internet) */
const VER = "ahorra-v3";
const PREFETCH = [
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-180.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VER).then((c) => c.addAll(PREFETCH).catch(()=>{})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // assets estáticos: cache-first
  const isStatic = url.pathname.includes("/icons/") || url.pathname.endsWith("manifest.webmanifest");
  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(VER).then(c => c.put(e.request, copy));
          return res;
        })
      )
    );
    return;
  }

  // app shell (HTML, JS, CSS): network-first con fallback al caché
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VER).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
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
