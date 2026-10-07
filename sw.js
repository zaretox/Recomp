/* RECOMP — service worker
 * Stratégie : l'app s'ouvre TOUJOURS depuis le cache (instantané, même sans réseau),
 * puis la nouvelle version est téléchargée en arrière-plan pour la prochaine ouverture.
 * Change VERSION pour forcer le nettoyage des anciens caches.
 */
const VERSION = "recomp-v10";
const FONT_CACHE = "recomp-fonts"; // polices Google, gardées d'une version à l'autre
const SHELL = ["./", "./index.html", "./app.js", "./vendor/react.production.min.js", "./vendor/react-dom.production.min.js", "./manifest.json"];
const NET_TIMEOUT = 3500; // ms max d'attente réseau quand rien n'est en cache

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(p, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout")), ms);
    p.then((r) => { clearTimeout(t); res(r); }, (err) => { clearTimeout(t); rej(err); });
  });
}

async function refresh(req, key) {
  const res = await fetch(req, { cache: "no-store" });
  if (res && res.ok) {
    const c = await caches.open(VERSION);
    await c.put(key, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Polices (Google Fonts) : mises en cache au premier chargement, puis servies hors ligne
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const c = await caches.open(FONT_CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      } catch (err) {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages : cache d'abord, mise à jour en arrière-plan
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = (await caches.match("./index.html")) || (await caches.match("./"));
      const update = refresh(req, "./index.html");
      if (cached) {
        e.waitUntil(update.catch(() => {}));
        return cached;
      }
      try {
        return await withTimeout(update, NET_TIMEOUT * 4);
      } catch (err) {
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<body style="margin:0;background:#FF4F2B;color:#121212;font-family:system-ui;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;height:100vh;gap:12px;padding:24px 20px 48px;box-sizing:border-box">' +
          '<div style="font:900 56px/0.9 Impact,sans-serif">PAS DE RÉSEAU</div><div style="font-weight:700">Le tout premier chargement a besoin d\'internet.</div>' +
          '<button onclick="location.reload()" style="padding:13px 22px;border-radius:4px;border:2px solid #121212;background:#121212;color:#fff;font-weight:800">Réessayer</button></body>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  // Autres fichiers (manifest, icônes…) : cache d'abord, réseau sinon
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      e.waitUntil(refresh(req, req).catch(() => {}));
      return cached;
    }
    try {
      return await withTimeout(refresh(req, req), NET_TIMEOUT);
    } catch (err) {
      return new Response("", { status: 504 });
    }
  })());
});
