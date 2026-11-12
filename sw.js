/* RECOMP — service worker
 * L'app s'ouvre toujours depuis le cache : instantané, même sans réseau.
 * À chaque ouverture, tous les fichiers sont retéléchargés en arrière-plan. Ils ne remplacent les anciens
 * que s'ils sont TOUS arrivés : on ne se retrouve jamais avec un mélange d'ancienne et de nouvelle version. */
const VERSION = "recomp-v16";
const POLICES = "recomp-fonts"; // polices Google, gardées d'une version à l'autre
const FICHIERS = [
  "./", "./index.html", "./app.css",
  "./vendor/react.production.min.js",
  "./vendor/react-dom.production.min.js",
  "./stockage.js",
  "./base.js",
  "./programmes.js",
  "./fiches.js",
  "./repas.js",
  "./libelles.js",
  "./courses.js",
  "./programme.js",
  "./entrainement.js",
  "./nutrition.js",
  "./recuperation.js",
  "./argent.js",
  "./coach.js",
  "./polar.js",
  "./banque.js",
  "./kit.js",
  "./pave.js",
  "./graphiques.js",
  "./schemas.js",
  "./mouvements.js",
  "./repos.js",
  "./jour.js",
  "./seance.js",
  "./sport.js",
  "./ecran-programmes.js",
  "./ecran-repas.js",
  "./ecran-argent.js",
  "./ecran-sorties.js",
  "./corps.js",
  "./reglages.js",
  "./app.js",
];
const FACULTATIFS = ["./manifest.json"]; // ton fichier : son absence ne bloque rien

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // Tout ou rien : si un fichier manque en ligne, la mise à jour s'arrête et la version en place continue de marcher
    await Promise.all(FICHIERS.map(u => c.add(new Request(u, { cache: "reload" }))));
    await Promise.all(FACULTATIFS.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
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
  // Les fonctions Netlify (liaison Polar) ne passent jamais par le cache
  if (url.pathname.startsWith("/.netlify/")) return;
  // Seule la page de l'app passe par le cache ; les autres pages du site (page de test…) vont au réseau
  const page = url.pathname.split("/").pop();
  if (req.mode === "navigate" && page !== "" && page !== "index.html") return;
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

/* NOTIFICATIONS — envoyées par la fonction Netlify quand la montre Polar a synchronisé une séance ou une nuit.
 * Pour une séance, on lit son résumé chez Polar (jeton pris dans les données de l'app) pour un message parlant. */
const lireCle = cle => new Promise(ok => {
  try {
    const r = indexedDB.open("recomp", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      try { const g = r.result.transaction("kv", "readonly").objectStore("kv").get(cle); g.onsuccess = () => { try { ok(g.result ? JSON.parse(g.result) : null); } catch (e) { ok(null); } }; g.onerror = () => ok(null); }
      catch (e) { ok(null); }
    };
  } catch (e) { ok(null); }
});
const SPORTS_NOTIF = [[/SWIM/, "Natation"], [/RUN/, "Course"], [/STRENGTH|CIRCUIT|FUNCTIONAL|CORE/, "Musculation"], [/CYCL|BIK/, "Vélo"], [/WALK/, "Marche"], [/HIK/, "Randonnée"]];
async function resumeSeance(id) {
  const lien = await lireCle("polar-lien");
  if (!lien?.jeton) return null;
  const arret = new AbortController(), minuteur = setTimeout(() => arret.abort(), 6000);
  try {
    const r = await fetch("/.netlify/functions/polar?action=api&chemin=" + encodeURIComponent("/v3/exercises/" + id), { headers: { Authorization: "Bearer " + lien.jeton }, signal: arret.signal, cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json(), t = (d.sport || "") + " " + (d.detailed_sport_info || ""), nage = /SWIM/.test(t);
    const m = /^PT(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/.exec(d.duration || ""), s = m ? Math.round((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) : 0;
    const duree = s >= 3600 ? Math.floor(s / 3600) + " h " + String(Math.floor(s % 3600 / 60)).padStart(2, "0") : Math.floor(s / 60) + " min";
    const dist = d.distance > 0 ? (nage ? Math.round(d.distance).toLocaleString("fr-FR") + " m" : (d.distance / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " km") : null;
    return {
      titre: ((SPORTS_NOTIF.find(([x]) => x.test(t)) || [0, "Séance"])[1]) + " enregistrée",
      corps: [dist, duree, d.heart_rate?.average ? d.heart_rate.average + " bpm en moyenne" : null].filter(Boolean).join(" · ") + ". Touche pour voir le détail.",
    };
  } catch (e) { return null; }
  finally { clearTimeout(minuteur); }
}
self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { /* message illisible : notification générique */ }
  e.waitUntil((async () => {
    if (m.seance) { const r = await resumeSeance(m.seance); if (r) Object.assign(m, r); }
    await self.registration.showNotification(m.titre || "RECOMP", { body: m.corps || "", tag: m.tag || undefined, icon: "./icon-192.png", data: { ouvrir: m.ouvrir || "" } });
  })());
});
// Toucher la notification : ouvre l'app (ou la ramène devant) sur le bon écran
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const ouvrir = e.notification.data?.ouvrir || "";
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (fenetres.length) {
      const f = fenetres[0];
      if (ouvrir) f.postMessage({ ouvrir });
      return f.focus();
    }
    return self.clients.openWindow("./" + (ouvrir ? "?ouvrir=" + encodeURIComponent(ouvrir) : ""));
  })());
});
