/* RECOMP — service worker
 * L'app s'ouvre toujours depuis le cache : instantané, même sans réseau.
 * À chaque ouverture, tous les fichiers sont retéléchargés en arrière-plan. Ils ne remplacent les anciens
 * que s'ils sont TOUS arrivés : on ne se retrouve jamais avec un mélange d'ancienne et de nouvelle version. */
const VERSION = "recomp-v15";
const POLICES = "recomp-fonts"; // polices Google, gardées d'une version à l'autre
const FICHIERS = [
  "./", "./index.html", "./css/app.css",
  "./vendor/react.production.min.js", "./vendor/react-dom.production.min.js",
  "./js/core/stockage.js", "./js/core/base.js",
  "./js/data/programmes.js", "./js/data/repas.js", "./js/data/libelles.js", "./js/data/courses.js",
  "./js/engine/programme.js", "./js/engine/entrainement.js", "./js/engine/nutrition.js", "./js/engine/recuperation.js", "./js/engine/argent.js", "./js/engine/coach.js",
  "./js/ui/kit.js", "./js/ui/pave.js", "./js/ui/graphiques.js", "./js/ui/repos.js",
  "./js/screens/jour.js", "./js/screens/seance.js", "./js/screens/sport.js", "./js/screens/programmes.js", "./js/screens/repas.js", "./js/screens/argent.js", "./js/screens/corps.js", "./js/screens/reglages.js",
  "./js/app.js",
];
const FACULTATIFS = ["./manifest.json"]; // ton fichier : son absence ne bloque rien

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all([...FICHIERS, ...FACULTATIFS].map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== VERSION && x !== POLICES).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

/* Remplacement d'un seul bloc : si un fichier manque, on garde la version en place */
let enCours = null;
function rafraichir() {
  if (enCours) return enCours;
  enCours = (async () => {
    const recus = await Promise.all(FICHIERS.map(async u => {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) throw new Error(u);
      return [u, r];
    }));
    const c = await caches.open(VERSION);
    await Promise.all(recus.map(([u, r]) => c.put(u, r)));
    await Promise.all(FACULTATIFS.map(u => fetch(u, { cache: "no-store" }).then(r => r.ok ? c.put(u, r) : null).catch(() => {})));
  })().catch(() => {}).finally(() => { enCours = null; });
  return enCours;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const c = await caches.open(POLICES), hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      } catch (err) { return new Response("", { status: 504 }); }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = (await caches.match("./index.html")) || (await caches.match("./"));
      if (cache) { e.waitUntil(rafraichir()); return cache; }
      try { return await fetch(req); }
      catch (err) {
        return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#FF5A2B;color:#0E0E0C;font-family:system-ui;display:flex;flex-direction:column;justify-content:flex-end;height:100vh;gap:12px;padding:24px 20px 48px;box-sizing:border-box"><div style="font:900 56px/.9 Impact,sans-serif">PAS DE RÉSEAU</div><div style="font-weight:700">Le tout premier chargement a besoin d\'internet.</div><button onclick="location.reload()" style="padding:13px 22px;border:0;border-radius:6px;background:#0E0E0C;color:#fff;font-weight:800">Réessayer</button></body>', { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.match(req);
    if (cache) return cache;
    try {
      const res = await fetch(req);
      if (res && res.ok) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch (err) { return new Response("", { status: 504 }); }
  })());
});
