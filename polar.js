"use strict";
/* POLAR — liaison avec le service AccessLink de Polar, par la fonction Netlify « polar » qui garde la clé secrète.
 * Le jeton d'accès reste sur ce téléphone (clé « polar-lien », exclue des sauvegardes) ; rien n'est stocké côté serveur. */
const POLAR_FN = "/.netlify/functions/polar";
const polarRetour = () => location.origin + "/polar-retour.html";
const lienPolar = () => DB.get("polar-lien");

/* 1. Partir chez Polar pour donner son accord */
async function relierPolar() {
  let c = null;
  try { c = await fetch(POLAR_FN + "?action=config", { cache: "no-store" }).then(r => r.json()); } catch (e) { /* hors ligne */ }
  if (!c?.client_id) return toast(c?.message || "Liaison impossible pour l'instant : vérifie ta connexion et les clés Polar dans Netlify.", { danger: true });
  const etat = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem("recomp_polar_etat", etat); } catch (e) { /* le code sera à recopier */ }
  location.href = "https://flow.polar.com/oauth2/authorization?response_type=code&client_id=" + encodeURIComponent(c.client_id) + "&redirect_uri=" + encodeURIComponent(polarRetour()) + "&state=" + etat;
}

/* 2. Échanger le code contre un jeton (fait par la fonction, qui inscrit aussi l'utilisateur) */
async function finirLiaisonPolar(code) {
  const r = await fetch(POLAR_FN + "?action=jeton", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: String(code).trim(), redirect_uri: polarRetour() }) });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.jeton) throw new Error(d?.detail?.error_description || d?.detail?.error || d?.message || d?.erreur || "erreur " + r.status);
  try { localStorage.removeItem("recomp_polar_etat"); } catch (e) { /* rien */ }
  await DB.set("polar-lien", { jeton: d.jeton, utilisateur: d.utilisateur, depuis: aujourdhui(), expire: d.expire ? isoDe(new Date(Date.now() + d.expire * 1000)) : null });
}
async function collerCodePolar() {
  const code = window.prompt("Colle le code de liaison affiché par Polar :");
  if (!code || !code.trim()) return;
  try { await finirLiaisonPolar(code); toast("Montre Polar reliée"); }
  catch (e) { toast("Liaison refusée : " + e.message + ". Le code n'est valable que 10 minutes et une seule fois.", { danger: true }); }
}
/* Au démarrage : la page de retour a renvoyé le code dans l'adresse de l'app */
function codePolarDansAdresse() {
  const p = new URLSearchParams(location.search), code = p.get("polar_code");
  if (!code) return;
  history.replaceState(null, "", location.pathname);
  finirLiaisonPolar(code).then(() => toast("Montre Polar reliée")).catch(e => toast("Liaison Polar impossible : " + e.message, { danger: true }));
}
async function delierPolar() {
  const l = lienPolar();
  if (l?.notifs) await couperNotifs(true);
  if (l?.utilisateur) { try { await polarLire("/v3/users/" + l.utilisateur, "DELETE"); } catch (e) { /* on délie quand même ce téléphone */ } }
  await DB.set("polar-lien", null);
  toast("Montre Polar déliée");
}

/* Lecture d'une donnée AccessLink */
async function polarLire(chemin, methode = "GET", params) {
  const l = lienPolar();
  if (!l?.jeton) throw new Error("montre non reliée");
  const r = await fetch(POLAR_FN + "?action=api&chemin=" + encodeURIComponent(chemin) + (params ? "&" + new URLSearchParams(params) : ""), { method: methode, cache: "no-store", headers: { Authorization: "Bearer " + l.jeton } });
  if (r.status === 401 || r.status === 403) throw new Error(r.status === 403 ? "Polar demande d'accepter ses conditions dans Polar Flow" : "liaison expirée : relie à nouveau ta montre");
  if (r.status === 204 || r.status === 404) return null;
  if (!r.ok) throw new Error("Polar a répondu " + r.status);
  return r.json().catch(() => null);
}

/* La saisie du matin : Recharge nocturne (SNA, VFC, FC de la nuit) et durée de sommeil */
async function matinPolar(jour) {
  const [rc, nuits] = await Promise.all([polarLire("/v3/users/nightly-recharge"), polarLire("/v3/users/sleep")]);
  // La nuit du jour, ou à défaut celle de la veille (selon l'heure de l'endormissement)
  const choisir = l => (l || []).filter(x => x.date && x.date <= jour && ecart(x.date, jour) <= 1).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const r = choisir(rc?.recharges), s = choisir(nuits?.nights);
  const dormi = s ? ((s.light_sleep || 0) + (s.deep_sleep || 0) + (s.rem_sleep || 0)) / 3600 : null;
  return {
    ans: r?.ans_charge != null ? arrondi(r.ans_charge, 1) : null,
    rmssd: r?.heart_rate_variability_avg ?? null,
    fc: r?.heart_rate_avg ?? null,
    sleep: dormi ? arrondi(dormi, 2) : null,
    dates: [r?.date, s?.date].filter(Boolean),
  };
}

/* SORTIES — séances enregistrées par la montre (parcours, distance, FC), copiées dans « polar-seances ».
 * Polar ne garde que 30 jours et seulement les séances synchronisées après la liaison : on importe tout ce qui est nouveau. */
const sortiesPolar = () => DB.get("polar-seances").filter(s => !s.supprime);
const dureeIso = d => { const m = /^PT(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/.exec(d || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

const NOMS_SPORT = {
  RUNNING: "Course", ROAD_RUNNING: "Course sur route", TRAIL_RUNNING: "Trail", TREADMILL_RUNNING: "Course sur tapis", TRACK_AND_FIELD_RUNNING: "Course sur piste",
  WALKING: "Marche", NORDIC_WALKING: "Marche nordique", HIKING: "Randonnée", CYCLING: "Vélo", ROAD_BIKING: "Vélo de route", MOUNTAIN_BIKING: "VTT",
  INDOOR_CYCLING: "Vélo d'intérieur", SWIMMING: "Natation", POOL_SWIMMING: "Natation en piscine", OPEN_WATER_SWIMMING: "Nage en eau libre",
  STRENGTH_TRAINING: "Musculation", CIRCUIT_TRAINING: "Circuit training", CORE: "Gainage", YOGA: "Yoga", ROWING: "Aviron", INDOOR_ROWING: "Rameur",
  FUNCTIONAL_TRAINING: "Entraînement fonctionnel", OTHER_INDOOR: "Activité en salle", OTHER_OUTDOOR: "Activité en extérieur", OTHER: "Autre activité",
};
const nomSortie = s => NOMS_SPORT[s.detail] || NOMS_SPORT[s.sport] || (x => x.charAt(0) + x.slice(1).toLowerCase())(String(s.detail || s.sport || "Activité").replace(/_/g, " "));
// Famille : décide de l'affichage (allure au km, vitesse, allure aux 100 m)
const familleSortie = s => {
  const t = (s.sport || "") + " " + (s.detail || "");
  return /SWIM/.test(t) ? "nage" : /RUN/.test(t) ? "course" : /WALK|HIK/.test(t) ? "marche" : /CYCL|BIK/.test(t) ? "velo" : /STRENGTH|CIRCUIT|FUNCTIONAL|CORE|CROSSFIT|BODY|GYM/.test(t) ? "muscu" : "autre";
};
const COURT_SORTIE = { course: "Course", marche: "Marche", velo: "Vélo", nage: "Nage", muscu: "Muscu", autre: "Polar" };

/* Échantillons : « 0,100,102,… » enregistrés toutes les r secondes */
const lireEchantillons = l => {
  const o = {};
  (l || []).forEach(x => { o[+x["sample-type"]] = { r: +x["recording-rate"] || 1, v: String(x.data || "").split(",").map(y => y === "" || y === "NULL" ? null : +y) }; });
  return o;
};
// Moyennes par paquets : au plus `max` points, assez pour une courbe sur téléphone
function reduire(e, max = 300) {
  const k = Math.max(1, Math.ceil(e.v.length / max)), v = [];
  for (let i = 0; i < e.v.length; i += k) {
    const p = e.v.slice(i, i + k).filter(x => x != null && isFinite(x));
    v.push(p.length ? arrondi(p.reduce((a, x) => a + x, 0) / p.length, 1) : null);
  }
  return { pas: e.r * k, v };
}
// Dénivelé positif, avec un seuil de 4 m pour ne pas compter le bruit de l'altitude GPS
function denivele(v) {
  let total = 0, ref = null;
  for (const a of v) {
    if (a == null) continue;
    if (ref == null || a < ref) ref = a;
    else if (a - ref >= 4) { total += a - ref; ref = a; }
  }
  return Math.round(total);
}
// Tours : temps et FC moyenne de chaque km (de chaque 100 m en natation), d'après la distance cumulée.
// Un tour = { n: distance à la fin (m), d: longueur du tour (m), s: secondes, fc }
function toursAuKm(dist, fc, pas = 1000) {
  const tps = [], tours = [], d = dist.v;
  const temps = m => {
    for (let i = 1; i < d.length; i++) if (d[i] != null && d[i] >= m) {
      const a = d[i - 1] ?? d[i], f = d[i] > a ? (m - a) / (d[i] - a) : 1;
      return (i - 1 + f) * dist.r;
    }
    return null;
  };
  const fin = d.filter(x => x != null).pop() || 0;
  for (let k = 1; k * pas <= fin; k++) tps.push(temps(k * pas));
  const fcEntre = (a, b) => { if (!fc) return null; const p = fc.v.slice(Math.floor(a / fc.r), Math.ceil(b / fc.r)).filter(x => x > 0); return p.length ? Math.round(p.reduce((s, x) => s + x, 0) / p.length) : null; };
  let avant = 0;
  tps.forEach((t, i) => { if (t == null) return; tours.push({ n: (i + 1) * pas, d: pas, s: Math.round(t - avant), fc: fcEntre(avant, t) }); avant = t; });
  const reste = fin - tps.length * pas, total = (d.length - 1) * dist.r;
  if (reste >= pas / 10 && total > avant) tours.push({ n: Math.round(fin), d: Math.round(reste), s: Math.round(total - avant), fc: fcEntre(avant, total) });
  return tours;
}
// Parcours allégé (Douglas-Peucker, environ 4 m de précision) : [[lat, lon], …]
function alleger(route) {
  const p = (route || []).filter(x => x.latitude != null && x.longitude != null && (x.latitude || x.longitude));
  if (p.length < 3) return p.map(x => [arrondi(x.latitude, 5), arrondi(x.longitude, 5)]);
  const c = Math.cos(p[0].latitude * Math.PI / 180), X = x => x.longitude * 111320 * c, Y = x => x.latitude * 110540;
  const garde = new Uint8Array(p.length); garde[0] = garde[p.length - 1] = 1;
  const pile = [[0, p.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop(), ax = X(p[a]), ay = Y(p[a]), dx = X(p[b]) - ax, dy = Y(p[b]) - ay, l = Math.hypot(dx, dy) || 1;
    let m = -1, dm = 4;
    for (let i = a + 1; i < b; i++) { const e = Math.abs(dy * (X(p[i]) - ax) - dx * (Y(p[i]) - ay)) / l; if (e > dm) { dm = e; m = i; } }
    if (m > 0) { garde[m] = 1; pile.push([a, m], [m, b]); }
  }
  return p.filter((_, i) => garde[i]).map(x => [arrondi(x.latitude, 5), arrondi(x.longitude, 5)]);
}

function sortieDepuisPolar(d) {
  const e = lireEchantillons(d.samples), fc = e[0], vit = e[1], alt = e[3], dist = e[10];
  const distFin = dist ? dist.v.filter(x => x != null).pop() : null;
  return {
    id: d.id, debut: d.start_time || null, dateISO: (d.start_time || aujourdhui()).slice(0, 10), sport: d.sport || "OTHER", detail: d.detailed_sport_info || null,
    duree: Math.round(dureeIso(d.duration)), distance: d.distance ?? distFin ?? null, kcal: d.calories ?? null,
    fcMoy: d.heart_rate?.average ?? null, fcMax: d.heart_rate?.maximum ?? null, charge: d.training_load != null ? Math.round(d.training_load) : null,
    appareil: d.device || null, deniv: alt ? denivele(alt.v) : null, trace: alleger(d.route),
    fc: fc ? reduire(fc) : null, vit: vit ? reduire(vit) : null, alt: alt ? reduire(alt) : null, tours: dist ? toursAuKm(dist, fc, /SWIM/.test((d.sport || "") + (d.detailed_sport_info || "")) ? 100 : 1000) : [],
    zones: (d.heart_rate_zones || []).map(z => ({ i: z.index, bas: z["lower-limit"], haut: z["upper-limit"], s: Math.round(dureeIso(z["in-zone"])) })),
    importe: aujourdhui(),
  };
}

/* Importe les séances nouvelles. Renvoie leur nombre. Un seul import à la fois (bouton, ouverture de Sport, notification). */
let importPolarEnCours = null;
const importerSortiesPolar = () => importPolarEnCours || (importPolarEnCours = importerSortiesPolar1().finally(() => { importPolarEnCours = null; }));
async function importerSortiesPolar1() {
  const l = await polarLire("/v3/exercises"), liste = Array.isArray(l) ? l : l?.exercises || [];
  const deja = new Set(DB.get("polar-seances").map(s => s.id)), neuves = [];
  for (const x of liste) {
    if (!x?.id || deja.has(x.id)) continue;
    const d = await polarLire("/v3/exercises/" + x.id, "GET", { samples: true, zones: true, route: true });
    if (d) neuves.push(sortieDepuisPolar({ ...x, ...d }));
  }
  // Natation : le détail des longueurs vient du fichier complet de la séance
  for (const s of neuves) if (familleSortie(s) === "nage") {
    let res = null;
    try { const b = await polarFit(s.id); res = b ? longueursDeFit(b) : null; } catch (e) { res = null; }
    Object.assign(s, { fit: !!res, bassin: res?.bassin ?? null, longueurs: res?.longueurs || [] });
  }
  try { localStorage.setItem("recomp_polar_import", String(Date.now())); } catch (e) { /* facultatif */ }
  await completerNages().catch(() => {});
  const dedans = new Set(DB.get("polar-seances").map(s => s.id)), vraies = neuves.filter(s => !dedans.has(s.id));
  if (vraies.length) await DB.set("polar-seances", [...DB.get("polar-seances"), ...vraies].sort((a, b) => (b.debut || "").localeCompare(a.debut || "")));
  return vraies.length;
}
// Retirer de RECOMP : on garde l'identifiant pour ne pas la réimporter
const retirerSortie = id => avecAnnuler("polar-seances", DB.get("polar-seances").map(s => s.id === id ? { id, supprime: true } : s), "Séance retirée");

/* Lien avec les séances notées dans RECOMP (muscu de la salle, natation) : même jour, même famille.
 * En muscu, on prend la séance de la montre qui a commencé le plus près du début noté dans RECOMP. */
const debutMs = s => s.debut ? new Date(s.debut).getTime() : 0;
function sortieDeMuscu(log) {
  const c = sortiesPolar().filter(s => s.dateISO === log.dateISO && familleSortie(s) === "muscu");
  if (c.length < 2 || !log.startedAt) return c[0] || null;
  return c.reduce((a, s) => Math.abs(debutMs(s) - log.startedAt) < Math.abs(debutMs(a) - log.startedAt) ? s : a);
}
function sortieDeNage(log) {
  const c = sortiesPolar().filter(s => familleSortie(s) === "nage");
  return (log.polarId && c.find(s => s.id === log.polarId)) || c.find(s => s.dateISO === log.dateISO && !DB.get("natation-logs").some(l => l.polarId === s.id && l.id !== log.id)) || null;
}
// La séance RECOMP qui correspond à une séance de la montre, s'il y en a une
function logDeSortie(s) {
  const f = familleSortie(s);
  if (f === "muscu") { const l = DB.get("sport-logs").find(x => x.dateISO === s.dateISO && sortieDeMuscu(x)?.id === s.id); return l ? { t: "s", log: l } : null; }
  if (f === "nage") { const l = DB.get("natation-logs").find(x => sortieDeNage(x)?.id === s.id); return l ? { t: "n", log: l } : null; }
  return null;
}

/* NOTIFICATIONS — l'iPhone s'abonne, la fonction Netlify range l'abonnement dans le webhook Polar.
 * Sur iPhone, il faut que RECOMP soit ouverte depuis l'icône de l'écran d'accueil. */
const notifsPossibles = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const notifsActives = () => !!lienPolar()?.notifs && notifsPossibles() && Notification.permission === "granted";
const octetsB64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const texteB64u = b => b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";
async function activerNotifs() {
  const l = lienPolar();
  if (!l?.jeton) return toast("Relie d'abord ta montre", { danger: true });
  if (!notifsPossibles()) return toast("Ajoute d'abord RECOMP à ton écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis l'icône.", { danger: true });
  // La demande d'autorisation doit partir tout de suite après le toucher
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return toast("Notifications refusées. Tu peux les autoriser dans Réglages de l'iPhone → Notifications → RECOMP.", { danger: true });
  try {
    const { cle } = await fetch(POLAR_FN + "?action=cle-push", { cache: "no-store" }).then(r => r.json());
    if (!cle) throw new Error("clé absente");
    const reg = await navigator.serviceWorker.ready;
    let ab = await reg.pushManager.getSubscription();
    if (ab && texteB64u(ab.options?.applicationServerKey) !== cle) { await ab.unsubscribe(); ab = null; }
    if (!ab) ab = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octetsB64u(cle) });
    const r = await fetch(POLAR_FN + "?action=abonner", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + l.jeton }, body: JSON.stringify({ abonnement: ab.toJSON(), utilisateur: l.utilisateur }) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.erreur || "erreur " + r.status);
    await DB.set("polar-lien", { ...lienPolar(), notifs: true });
    toast("Notifications activées. Une notification d'essai arrive.");
  } catch (e) { toast("Notifications impossibles : " + e.message, { danger: true }); }
}
async function couperNotifs(silencieux) {
  const l = lienPolar();
  try { const reg = await navigator.serviceWorker?.ready; const ab = await reg?.pushManager?.getSubscription(); if (ab) await ab.unsubscribe(); } catch (e) { /* déjà coupé */ }
  if (l?.jeton) { try { await fetch(POLAR_FN + "?action=desabonner", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + l.jeton }, body: JSON.stringify({ utilisateur: l.utilisateur }) }); } catch (e) { /* hors ligne */ } }
  if (l) await DB.set("polar-lien", { ...l, notifs: false });
  if (!silencieux) toast("Notifications coupées");
}
// Toucher une notification : l'écran qui va avec
function ouvrirDepuisNotif(o) {
  if (!o) return;
  if (o === "matin") return Nav.sheet("matin", { auto: true });
  if (o.startsWith("sortie:")) {
    const id = o.slice(7);
    Nav.tab("sport");
    importerSortiesPolar().catch(() => 0).then(() => sortiesPolar().some(s => s.id === id) ? Nav.sheet("sortie", { id }) : toast("La séance n'est pas encore disponible chez Polar : réessaie dans une minute."));
  }
}

/* LONGUEURS DE NATATION — lues dans le fichier complet de la séance (format FIT de Garmin, utilisé par Polar).
 * On n'en garde que l'essentiel : la longueur du bassin et, pour chaque longueur, [début (s), durée (s), coups de bras, nage, active]. */
const NAGES_FIT = { 0: "Crawl", 1: "Dos", 2: "Brasse", 3: "Papillon", 4: "Éducatif", 5: "Mixte", 6: "4 nages" };
function lireFit(buf) {
  const v = new DataView(buf), n = v.byteLength;
  if (n < 14 || String.fromCharCode(v.getUint8(8), v.getUint8(9), v.getUint8(10), v.getUint8(11)) !== ".FIT") return null;
  const tete = v.getUint8(0), fin = Math.min(n, tete + v.getUint32(4, true)), defs = {}, msgs = [];
  // Lecture d'un champ selon son type de base ; les valeurs « invalides » du format deviennent null
  const lire = (o, type, taille, le) => {
    const t = type & 0x1F;
    const T = { 0: [1, "Uint8", 0xFF], 1: [1, "Int8", 0x7F], 2: [1, "Uint8", 0xFF], 3: [2, "Int16", 0x7FFF], 4: [2, "Uint16", 0xFFFF], 5: [4, "Int32", 0x7FFFFFFF], 6: [4, "Uint32", 0xFFFFFFFF], 8: [4, "Float32", null], 9: [8, "Float64", null], 10: [1, "Uint8", 0], 11: [2, "Uint16", 0], 12: [4, "Uint32", 0], 13: [1, "Uint8", 0xFF] }[t];
    if (!T || taille !== T[0]) return null;
    const x = v["get" + T[1]](o, le);
    return x === T[2] ? null : x;
  };
  let o = tete;
  while (o < fin) {
    const h = v.getUint8(o++);
    if (!(h & 0x80) && (h & 0x40)) { // définition
      const loc = h & 0x0F, le = v.getUint8(o + 1) === 0, glob = v.getUint16(o + 2, le), nf = v.getUint8(o + 4);
      o += 5;
      const champs = [];
      for (let i = 0; i < nf; i++, o += 3) champs.push([v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2)]);
      let dev = 0;
      if (h & 0x20) { const nd = v.getUint8(o++); for (let i = 0; i < nd; i++, o += 3) dev += v.getUint8(o + 1); }
      defs[loc] = { glob, le, champs, dev };
    } else { // données (en-tête normal ou horodatage compressé)
      const d = defs[h & 0x80 ? (h >> 5) & 0x03 : h & 0x0F];
      if (!d) return msgs.length ? msgs : null;
      const m = { _: d.glob };
      for (const [num, taille, type] of d.champs) { if (o + taille > n) return msgs; m[num] = lire(o, type, taille, d.le); o += taille; }
      o += d.dev;
      if (d.glob === 18 || d.glob === 101) msgs.push(m);
    }
  }
  return msgs;
}
// Message 18 = séance (champ 44 : bassin en cm), 101 = longueur (2 début, 3 durée en ms, 5 coups, 7 nage, 12 type : 1 = active)
function longueursDeFit(buf) {
  const msgs = lireFit(buf);
  if (!msgs) return null;
  const se = msgs.find(m => m._ === 18), lg = msgs.filter(m => m._ === 101 && m[3] != null);
  if (!lg.length) return { bassin: se?.[44] ? se[44] / 100 : null, longueurs: [] };
  const t0 = lg[0][2] ?? 0;
  return {
    bassin: se?.[44] ? arrondi(se[44] / 100, 1) : null,
    longueurs: lg.map(m => [m[2] != null ? m[2] - t0 : null, arrondi(m[3] / 1000, 1), m[5], m[7], m[12] === 0 ? 0 : 1]),
  };
}
async function polarFit(id) {
  const l = lienPolar();
  const r = await fetch(POLAR_FN + "?action=api&chemin=" + encodeURIComponent("/v3/exercises/" + id + "/fit"), { cache: "no-store", headers: { Authorization: "Bearer " + l.jeton } });
  return r.ok ? r.arrayBuffer() : null;
}
// Complète les nages déjà importées (une seule tentative par nage)
async function completerNages() {
  const a = DB.get("polar-seances").filter(s => !s.supprime && familleSortie(s) === "nage" && s.fit === undefined);
  for (const s of a) {
    let res = null;
    try { const b = await polarFit(s.id); res = b ? longueursDeFit(b) : null; } catch (e) { res = null; }
    await DB.set("polar-seances", DB.get("polar-seances").map(x => x.id === s.id ? { ...x, fit: !!res, bassin: res?.bassin ?? null, longueurs: res?.longueurs || [] } : x));
  }
}

/* Séries d'une nage : les longueurs actives qui se suivent, coupées par un repos (longueur de repos ou pause de plus de 5 s) */
function seriesNage(s) {
  const L = s.longueurs || [], b = s.bassin || 25, out = [];
  let cur = null;
  // Un repos ferme la série en cours, ou s'ajoute au repos de la précédente (plusieurs longueurs de repos de suite)
  const fermer = repos => { if (cur) { cur.repos = repos; out.push(cur); cur = null; } else if (out.length) out[out.length - 1].repos += repos; };
  L.forEach((x, i) => {
    const [debut, duree, coups, nage, actif] = x;
    if (!actif) { fermer(duree); return; }
    const prec = L[i - 1], pause = prec && prec[4] && debut != null && prec[0] != null ? debut - prec[0] - prec[1] : 0;
    if (pause > 5) fermer(pause);
    if (!cur) cur = { n: 0, distance: 0, s: 0, coups: 0, avecCoups: 0, nages: {}, repos: 0 };
    cur.n++; cur.distance += b; cur.s += duree;
    if (coups > 0) { cur.coups += coups; cur.avecCoups++; }
    if (nage != null) cur.nages[nage] = (cur.nages[nage] || 0) + 1;
  });
  fermer(0);
  return out.map(x => {
    const nage = Object.entries(x.nages).sort((a, c) => c[1] - a[1])[0]?.[0];
    return { n: x.n, distance: x.distance, s: arrondi(x.s, 1), repos: Math.round(x.repos), nage: nage != null ? NAGES_FIT[nage] || null : null,
      coups: x.avecCoups ? arrondi(x.coups / x.avecCoups, 1) : null, swolf: x.avecCoups ? Math.round((x.s + x.coups) / x.avecCoups) : null };
  });
}
// Le résumé : longueurs, SWOLF moyen (temps + coups de bras par longueur, plus bas = plus efficace), temps nagé et temps de repos
function resumeLongueurs(s) {
  const L = s.longueurs || [], act = L.filter(x => x[4]), avec = act.filter(x => x[2] > 0);
  if (!act.length) return null;
  const nage = act.reduce((a, x) => a + x[1], 0), total = s.duree || 0;
  return { longueurs: act.length, swolf: avec.length ? Math.round(avec.reduce((a, x) => a + x[1] + x[2], 0) / avec.length) : null,
    coups: avec.length ? arrondi(avec.reduce((a, x) => a + x[2], 0) / avec.length, 1) : null, nage: Math.round(nage), repos: total > nage ? Math.round(total - nage) : null };
}
/* Prévu / fait : chaque répétition de la séance type face aux séries nagées, dans l'ordre.
 * Si une série nagée est plus longue que prévu (repos non détecté), elle couvre plusieurs répétitions. */
function comparerNage(modele, series) {
  const prevu = [];
  (modele?.blocks || []).forEach(b => { for (let i = 0; i < (parseInt(b.reps) || 0); i++) prevu.push({ t: b.t, d: parseInt(b.d) || 0, nage: b.nage, repos: b.mode === "dep" ? null : parseInt(b.rest) || 0, dep: b.mode === "dep" ? b.dep : null }); });
  const lignes = [], reste = series.map(x => ({ ...x }));
  for (const p of prevu) {
    let d = 0, s = 0, repos = null;
    while (reste.length && d < p.d - 1) {
      const x = reste[0], besoin = p.d - d;
      if (x.distance <= besoin + 1) { d += x.distance; s += x.s; repos = x.repos; reste.shift(); }
      else { const part = besoin / x.distance; d += besoin; s += x.s * part; x.distance -= besoin; x.s -= x.s * part; repos = 0; }
    }
    lignes.push({ ...p, fait: d ? { d: Math.round(d), s: Math.round(s), repos } : null });
  }
  return { lignes, enPlus: reste };
}
