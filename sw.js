/* RECOMP — service worker
 * Stratégie : l'app s'ouvre TOUJOURS depuis le cache (instantané, même sans réseau),
 * puis la nouvelle version est téléchargée en arrière-plan pour la prochaine ouverture.
 * Change VERSION pour forcer le nettoyage des anciens caches.
 */
const VERSION = "recomp-v4";
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
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
          '<body style="margin:0;background:#060806;color:#c9cec9;font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:14px;text-align:center">' +
          '<div style="font-size:40px">📡</div><div>Pas de réseau pour le premier chargement.</div>' +
          '<button onclick="location.reload()" style="padding:12px 22px;border-radius:12px;border:none;background:#34d17a;font-weight:800">Réessayer</button></body>',
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
