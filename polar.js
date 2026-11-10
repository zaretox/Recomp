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
  try { localStorage.setItem("recomp_polar_import", String(Date.now())); } catch (e) { /* facultatif */ }
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
