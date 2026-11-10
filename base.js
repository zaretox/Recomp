"use strict";
/* BASE — tout ce dont le reste du code a besoin : h(), le magasin DB, les dates et les formats. */
const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, useSyncExternalStore, Fragment } = React;

/* h("div.carte.active", { onClick }, enfants…) = React.createElement avec classes intégrées et props facultatives */
const _tags = new Map();
function h(tag, props, ...kids) {
  let p = props;
  const sansProps = p == null || typeof p !== "object" || Array.isArray(p) || React.isValidElement(p);
  if (sansProps) { if (p != null) kids.unshift(p); p = {}; }
  if (typeof tag === "string" && tag.includes(".")) {
    let t = _tags.get(tag);
    if (!t) { const [nom, ...cl] = tag.split("."); t = { nom: nom || "div", cl: cl.join(" ") }; _tags.set(tag, t); }
    tag = t.nom;
    p = { ...p, className: p.className ? t.cl + " " + p.className : t.cl };
  }
  return React.createElement(tag, p, ...kids);
}

/* BUS — relie les composants sans passer par les props */
const bus = (() => {
  const m = {};
  return {
    on: (e, f) => { (m[e] = m[e] || []).push(f); return () => { m[e] = m[e].filter(x => x !== f); }; },
    emit: (e, d) => (m[e] || []).forEach(f => f(d)),
  };
})();

/* DB — les données en mémoire (photos exceptées), chargées d'un coup au démarrage.
 * DB.get(clé) est immédiat ; DB.set(clé, valeur) écrit sur le disque et met tous les écrans à jour. */
const DEFAUTS = {
  "sport-logs": [], "maison-logs": [], "nutri-logs": [], "food-log": {}, "foods-custom": [], "mensurations": [],
  "photos-index": [], "douleur-logs": [], "budget-logs": [], "fin-income": [], "fin-expenses": [], "fin-caps": {},
  "fin-goal": 0, "fin-fixes": [], "nutri-cal-cfg": null, "science-config": { weightOverrides: {}, caloricAdjust: 0, deload: false, recovery: false },
  "sport-phase": 0, "profil": null, "repas-alts": {}, "taille-corps": "", "last-export": null, "programmes": [],
  "exos-perso": [], "natation-modeles": [], "natation-logs": [], "recup-logs": [], "bilans": [], "courses-etat": null,
  "polar-lien": null,
};
const DB = (() => {
  const data = new Map(), abonnes = new Set();
  let version = 0;
  const notifier = () => { version++; abonnes.forEach(f => f()); };
  return {
    version: () => version,
    abonner: f => { abonnes.add(f); return () => abonnes.delete(f); },
    async init() {
      const { keys } = await window.storage.list();
      for (const k of keys) {
        if (k.startsWith("photo:")) continue;
        try { const r = await window.storage.get(k); if (r) data.set(k, JSON.parse(r.value)); }
        catch (e) { console.warn("Clé illisible ignorée : " + k, e); }
      }
      notifier();
    },
    get: k => { const v = data.get(k); return v === undefined || v === null ? DEFAUTS[k] : v; },
    /* Renvoie true si l'écriture a réussi. En cas d'échec, l'ancienne valeur est remise en place. */
    async set(k, v) {
      const avant = data.get(k);
      data.set(k, v);
      notifier();
      try { await window.storage.set(k, JSON.stringify(v)); return true; }
      catch (e) {
        console.error("Échec d'enregistrement : " + k, e);
        if (avant === undefined) data.delete(k); else data.set(k, avant);
        notifier();
        toast("Enregistrement impossible : le stockage du téléphone est plein ou refusé.", { danger: true });
        return false;
      }
    },
    /* Écriture brute d'une grosse valeur hors mémoire (photos) */
    async brut(k, v) {
      try { await window.storage.set(k, JSON.stringify(v)); return true; }
      catch (e) { console.error(e); return false; }
    },
    async lireBrut(k) {
      try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
      catch (e) { return null; }
    },
    supprimerBrut: k => window.storage.delete(k).catch(() => {}),
  };
})();

/* Un écran qui appelle useDB() se redessine dès qu'une donnée change */
function useDB() { return useSyncExternalStore(DB.abonner, DB.version); }

/* Résultat gardé en mémoire tant qu'aucune donnée ne change */
function memo(fn) {
  let v = -1, m = new Map();
  return (...a) => {
    if (v !== DB.version()) { m = new Map(); v = DB.version(); }
    const k = a.join("|");
    if (!m.has(k)) m.set(k, fn(...a));
    return m.get(k);
  };
}

/* Retours à l'écran */
const toast = (msg, o) => bus.emit("toast", { id: Date.now() + Math.random(), msg, ...(o || {}) });
const confirmer = o => new Promise(res => bus.emit("confirm", { ...o, res }));
/* Enregistre `suivant` et propose « Annuler » quelques secondes */
async function avecAnnuler(cle, suivant, libelle) {
  const avant = DB.get(cle);
  if (!(await DB.set(cle, suivant))) return false;
  toast(libelle, { annuler: async () => { await DB.set(cle, avant); toast("Restauré"); } });
  return true;
}

/* Dates en heure LOCALE : toISOString tomberait sur la veille entre minuit et 2 h */
const pad2 = n => String(n).padStart(2, "0");
const isoDe = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const aujourdhui = () => isoDe(new Date());
const dateDe = iso => new Date(iso + "T12:00:00");
const decale = (iso, n) => { const d = dateDe(iso); d.setDate(d.getDate() + n); return isoDe(d); };
const ecart = (a, b) => Math.round((dateDe(b) - dateDe(a)) / 86400000);
const jourSem = iso => dateDe(iso).getDay();
const lundiDe = iso => decale(iso, -((jourSem(iso) + 6) % 7));
const dansLes = (iso, n) => { const a = new Date(); a.setDate(a.getDate() - n); return dateDe(iso) >= a; };
const dateCourte = iso => dateDe(iso).toLocaleDateString("fr-FR");
const dateLongue = iso => dateDe(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const dateJour = iso => dateDe(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const dateMini = iso => dateDe(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "");
const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const JOURS_L = ["L", "M", "M", "J", "V", "S", "D"];
const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisDe = iso => String(iso || "").slice(0, 7);
const moisPrec = ym => { const [a, m] = ym.split("-").map(Number); const d = new Date(a, m - 2, 1); return d.getFullYear() + "-" + pad2(d.getMonth() + 1); };
const moisSuiv = ym => { const [a, m] = ym.split("-").map(Number); const d = new Date(a, m, 1); return d.getFullYear() + "-" + pad2(d.getMonth() + 1); };
const nomMois = ym => { const [a, m] = ym.split("-").map(Number); return MOIS[m - 1] + (a === new Date().getFullYear() ? "" : " " + a); };
const joursDuMois = ym => { const [a, m] = ym.split("-").map(Number); return new Date(a, m, 0).getDate(); };

/* Heures au format de l'app : « 6h45 » */
const hEnMin = s => { const m = String(s || "").match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/); return m ? +m[1] * 60 + (+m[2] || 0) : 0; };
const minEnH = n => { n = ((n % 1440) + 1440) % 1440; return Math.floor(n / 60) + "h" + pad2(n % 60); };
const hhmm = s => { const n = ((hEnMin(s) % 1440) + 1440) % 1440; return pad2(Math.floor(n / 60)) + ":" + pad2(n % 60); };

/* Nombres à la française */
const nb = (v, d = 1) => Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d });
const nb1 = v => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const entier = v => Math.round(v).toLocaleString("fr-FR");
const signe = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + nb(Math.abs(v), d);
const euros = (v, d = 0) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €";
const dureeHM = h => { let H = Math.floor(h), M = Math.round((h - H) * 60); if (M === 60) { H++; M = 0; } return H + " h " + pad2(M); };
const mmss = s => Math.floor(s / 60) + ":" + pad2(s % 60);
const dureeS = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return h ? h + " h " + pad2(m) : m + ":" + pad2(r); };
const pluriel = (n, mot, motS) => n + " " + (n > 1 ? (motS || mot + "s") : mot);
const borne = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const moyenne = a => a.reduce((s, v) => s + v, 0) / a.length;
const arrondi = (v, d = 1) => { const f = 10 ** d; return Math.round(v * f) / f; };
const sansAccent = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nouvelId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const parseNb = v => parseFloat(String(v ?? "").replace(",", "."));

/* Enregistre ou partage un fichier. Sur iPhone, la feuille de partage remplace le téléchargement. */
async function partagerFichier(nom, texte, mime) {
  const type = mime || "text/plain";
  try {
    const f = new File([texte], nom, { type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      await navigator.share({ files: [f], title: nom });
      return "partage";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "annule";
  }
  try {
    const url = URL.createObjectURL(new Blob([texte], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return "telecharge";
  } catch (e) { console.error(e); return "erreur"; }
}

/* Petite vibration. Android : navigator.vibrate. iPhone : basculer un interrupteur natif déclenche un retour haptique. */
const vibre = (() => {
  let lab = null;
  return () => {
    try {
      if (navigator.vibrate) { navigator.vibrate(8); return; }
      if (!lab) {
        lab = document.createElement("label");
        lab.style.cssText = "position:fixed;left:-99px;opacity:0";
        lab.innerHTML = '<input type="checkbox" switch>';
        document.body.appendChild(lab);
      }
      lab.click();
    } catch (e) { /* facultatif */ }
  };
})();
