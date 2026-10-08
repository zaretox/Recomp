"use strict";
const { useState, useEffect, useCallback, useRef, useMemo, Fragment } = React;
/* ═══ STOCKAGE PERSISTANT ═══
 * IndexedDB (plusieurs centaines de Mo, idéal pour les photos), repli sur localStorage
 * puis sur la mémoire si le navigateur refuse. Les anciennes données localStorage
 * (clés "recomp:*") sont copiées une seule fois dans IndexedDB au premier lancement.
 * Interface : window.storage.get / set / delete / list — set() rejette en cas d'échec.
 * Chaque valeur lue reste en cache mémoire : changer d'onglet ne relit pas le disque. */
(function () {
    if (window.storage)
        return; // environnement qui fournit déjà son propre stockage (aperçu)
    const PFX = "recomp:", MIGRATED = "recomp_idb_migrated";
    const cache = new Map();
    let LS = null;
    try {
        localStorage.setItem("__recomp_t", "1");
        localStorage.removeItem("__recomp_t");
        LS = localStorage;
    }
    catch (e) { }
    const lsKeys = () => { const a = []; if (!LS)
        return a; for (let i = 0; i < LS.length; i++) {
        const k = LS.key(i);
        if (k && k.indexOf(PFX) === 0)
            a.push(k.slice(PFX.length));
    } return a; };
    const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const txDone = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error("transaction annulée (espace plein ?)")); });
    const openDB = () => new Promise((res, rej) => {
        if (!window.indexedDB)
            return rej(new Error("IndexedDB absent"));
        const r = indexedDB.open("recomp", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error("IndexedDB bloqué"));
    });
    const backend = (async () => {
        try {
            const db = await openDB();
            const store = mode => db.transaction("kv", mode).objectStore("kv");
            if (LS && !LS.getItem(MIGRATED)) {
                const old = lsKeys();
                if (old.length) {
                    const tx = db.transaction("kv", "readwrite");
                    old.forEach(k => tx.objectStore("kv").put(LS.getItem(PFX + k), k));
                    await txDone(tx);
                    console.info("RECOMP : " + old.length + " éléments migrés vers IndexedDB");
                }
                LS.setItem(MIGRATED, "1");
            }
            try {
                navigator.storage?.persist?.();
            }
            catch (e) { }
            return {
                get: k => req(store("readonly").get(k)),
                set: (k, v) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); return txDone(tx); },
                del: k => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").delete(k); return txDone(tx); },
                keys: () => req(store("readonly").getAllKeys()),
            };
        }
        catch (e) {
            console.warn("IndexedDB indisponible, repli", e);
            if (LS)
                return { get: async (k) => LS.getItem(PFX + k), set: async (k, v) => LS.setItem(PFX + k, v), del: async (k) => LS.removeItem(PFX + k), keys: async () => lsKeys() };
            const mem = {};
            return { get: async (k) => mem[k], set: async (k, v) => { mem[k] = v; }, del: async (k) => { delete mem[k]; }, keys: async () => Object.keys(mem) };
        }
    })();
    window.storage = {
        get: async (k) => {
            if (!cache.has(k)) {
                const v = await (await backend).get(k);
                cache.set(k, v == null ? null : v);
            }
            const v = cache.get(k);
            return v == null ? null : { key: k, value: v };
        },
        set: async (k, v) => { await (await backend).set(k, v); cache.set(k, v); return { key: k, value: v }; },
        delete: async (k) => { await (await backend).del(k); cache.delete(k); return { key: k, deleted: true }; },
        list: async (prefix) => { const all = (await (await backend).keys()).map(String); return { keys: prefix ? all.filter(k => k.indexOf(prefix) === 0) : all }; },
    };
})();
/* ═══ PALETTE « AFFICHE » ═══
 * Papier clair, encre noire, et une couleur pleine par section :
 * Sport = rouge affiche (amber*), Nutrition = vert (green*), Budget = cobalt (budget*), Science = jaune (sci / blue* pour le texte). */
const C = {
    bg: "#F1F2EE", surface: "#FFFFFF", surfaceAlt: "#E8E9E3", ink: "#121212",
    border: "#121212", borderSoft: "#DCDDD6",
    text: "#121212", textMut: "#52524C", textDim: "#77776F",
    amber: "#FF4F2B", amberLight: "#D2381A", amberDim: "#A82E14",
    green: "#16A863", greenLight: "#0C8148", greenDim: "#0A6438",
    prot: "#5B4FE0", gluc: "#C98A00", lip: "#0E9494",
    danger: "#D7263D", blue: "#8A6900", blueLight: "#735700", pink: "#D63C82", purple: "#6F45E6",
    budget: "#2448FF", budgetLight: "#1B38D6",
    sci: "#FFD43B", deload: "#5B4FE0",
    swim: "#0571B0",
};
/* Police des grands chiffres et titres d'affiche */
const AN = "'Anton', Impact, 'Arial Narrow', sans-serif";
async function load(k, fb) { try {
    const r = await window.storage.get(k);
    return r ? JSON.parse(r.value) : fb;
}
catch {
    return fb;
} }
/* Renvoie true si l'écriture a réussi, false sinon (espace plein, stockage refusé…). */
async function save(k, v) { try {
    await window.storage.set(k, JSON.stringify(v));
    bus.emit("stored:" + k, v); // les écrans abonnés via useStored se mettent à jour
    return true;
}
catch (e) {
    console.error("Échec d'enregistrement : " + k, e);
    return false;
} }
/* 16 px minimum : en dessous, iOS zoome automatiquement sur le champ touché */
const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 6, border: `1.5px solid ${C.ink}`, background: C.surface, color: C.text, fontSize: 16, boxSizing: "border-box", fontFamily: "inherit" };
function Pill({ children, active, onClick, color }) { const c = color || C.ink; return React.createElement("button", { onClick: onClick, style: { padding: "7px 13px", borderRadius: 999, border: `1.5px solid ${active ? c : C.ink}`, cursor: "pointer", fontSize: 12, fontWeight: 800, letterSpacing: ".02em", whiteSpace: "nowrap", background: active ? c : "transparent", color: active ? (c === C.sci ? C.ink : "#fff") : C.ink, transition: "background .2s, color .2s" } }, children); }
function Card({ children, style, border }) { return React.createElement("div", { style: { background: C.surface, border: `1.5px solid ${border || C.ink}`, borderRadius: 6, padding: 14, marginBottom: 10, ...style } }, children); }
/* ═══ BUS D'ÉVÉNEMENTS — relie les composants sans passer par les props ═══ */
const bus = (() => { const m = {}; return { on: (e, f) => { (m[e] = m[e] || []).push(f); return () => { m[e] = m[e].filter(x => x !== f); }; }, emit: (e, d) => (m[e] || []).forEach(f => f(d)) }; })();
/* Valeur persistée + setter qui enregistre. Le cache du stockage rend la lecture instantanée. */
function useStored(key, fallback) {
    const [v, setV] = useState(fallback);
    const [ready, setReady] = useState(false);
    useEffect(() => { let alive = true; load(key, fallback).then(d => { if (alive) {
        setV(d ?? fallback);
        setReady(true);
    } }); const off = bus.on("stored:" + key, d => setV(d)); return () => { alive = false; off(); }; }, [key]);
    const set = useCallback(async (next) => { setV(next); await save(key, next); }, [key]);
    return [v, set, ready];
}
/* ═══ CONFIRMATIONS & NOTIFICATIONS ═══ */
function askConfirm(opts) { return new Promise(res => bus.emit("confirm", { ...opts, res })); }
function toast(msg, opts) { bus.emit("toast", { id: Date.now() + Math.random(), msg, ...(opts || {}) }); }
/* Enregistre `next`, met l'écran à jour et propose « Annuler » pendant quelques secondes. */
async function commitWithUndo(key, prev, next, setter, label) {
    if (!(await save(key, next))) {
        toast("❌ Échec de l'enregistrement (stockage plein ?)", { tone: "danger" });
        return false;
    }
    setter(next);
    toast(label, { undo: async () => { await save(key, prev); setter(prev); toast("↩️ Restauré"); } });
    return true;
}
/* Effacement complet d'une liste : confirmation explicite + possibilité d'annuler. */
async function resetWithConfirm(key, prev, setter, what) {
    if (!prev || !prev.length)
        return;
    const ok = await askConfirm({ title: "Tout effacer ?", message: prev.length + " entrée" + (prev.length > 1 ? "s" : "") + " — " + what + " — vont être supprimées. Pense à exporter une sauvegarde avant.", confirmLabel: "Tout effacer", danger: true });
    if (ok)
        await commitWithUndo(key, prev, [], setter, "🗑️ " + what + " : tout effacé");
}
function ConfirmHost() {
    const [req, setReq] = useState(null);
    useEffect(() => bus.on("confirm", setReq), []);
    if (!req)
        return null;
    const close = v => { req.res(v); setReq(null); };
    const col = req.danger ? C.danger : C.ink;
    return React.createElement("div", { onClick: () => close(false), style: { position: "fixed", inset: 0, background: "#121212B3", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))", animation: "rcFade .15s ease-out" } },
        React.createElement("div", { onClick: e => e.stopPropagation(), role: "dialog", "aria-modal": true, style: { width: "100%", maxWidth: 420, background: C.bg, border: `2px solid ${C.ink}`, borderTop: `10px solid ${req.danger ? C.danger : C.ink}`, borderRadius: 6, padding: 18, animation: "rcUp .25s cubic-bezier(.2,.9,.1,1)" } },
            React.createElement("div", { style: { fontFamily: AN, fontSize: 30, lineHeight: 1, textTransform: "uppercase", marginBottom: 10 } }, req.title || "Confirmer"),
            req.message && React.createElement("div", { style: { fontSize: 14, color: C.textMut, lineHeight: 1.45, marginBottom: 18 } }, req.message),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement("button", { onClick: () => close(false), style: { flex: 1, padding: "13px 0", borderRadius: 4, border: `2px solid ${C.ink}`, background: "transparent", color: C.ink, fontSize: 14, fontWeight: 800, cursor: "pointer" } }, req.cancelLabel || "Annuler"),
                React.createElement("button", { autoFocus: true, onClick: () => close(true), style: { flex: 1, padding: "13px 0", borderRadius: 4, border: `2px solid ${col}`, background: col, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" } }, req.confirmLabel || "Confirmer"))));
}
function ToastHost() {
    const [items, setItems] = useState([]);
    useEffect(() => bus.on("toast", t => { setItems(a => [...a.slice(-2), t]); setTimeout(() => setItems(a => a.filter(x => x.id !== t.id)), t.undo ? 6000 : 3000); }), []);
    if (!items.length)
        return null;
    // En haut de l'écran : le bas est occupé par la pile d'affiches
    return React.createElement("div", { style: { position: "fixed", left: 0, right: 0, top: "calc(12px + env(safe-area-inset-top, 0px))", zIndex: 9000, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 14px", pointerEvents: "none" } }, items.map(t => React.createElement("div", { key: t.id, style: { pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12, maxWidth: 420, width: "100%", background: t.tone === "danger" ? C.danger : C.ink, borderRadius: 4, padding: "11px 13px", boxShadow: "0 10px 30px #12121244", animation: "rcDrop .3s cubic-bezier(.2,.9,.1,1)" } },
        React.createElement("span", { style: { flex: 1, fontSize: 13.5, fontWeight: 600, color: "#fff" } }, t.msg),
        t.undo && React.createElement("button", { onClick: () => { setItems(a => a.filter(x => x.id !== t.id)); t.undo(); }, style: { border: "none", background: C.sci, color: C.ink, borderRadius: 3, fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: "6px 9px" } }, "Annuler"))));
}
/* ═══ SPORT DATA ═══ */
const profil = [{ l: "Poids", v: "130 kg", s: "départ" }, { l: "Objectif", v: "Recompo", s: "gras ↓ muscle ↑" }, { l: "Fréquence", v: "5j/sem", s: "lever 6h45" }, { l: "Anciens max", v: "140/100", s: "squat·bench" }];
const regles = ["Genou droit : ne jamais dépasser la pointe du pied.", "Zéro saut les 4 premières semaines.", "Douleur piquante = arrêt immédiat.", "Bas du corps : progression plus lente (genou + pied droit).", "Hydratation +++ et 7-8 h de sommeil."];
const echauffement = ["Marche sur place — 2 min", "Rotations épaules — 20/sens", "Rotations bassin — 15/sens", "Cat-cow — 10 reps", "Cercles chevilles — 15/pied"];
const maison = [
    { code: "A", jour: "Lundi", titre: "Bas du corps + cardio", format: "3 circuits · repos 60-90 s entre tours", ex: ["Squat sur chaise — 12", "Pont fessier — 15 (2s tenue)", "Step-up lent — 8/jambe", "Marche rapide — 60s", "Wall sit — 20-30s", "Shadow boxing — 60s"] },
    { code: "B", jour: "Mercredi", titre: "Haut du corps + gainage", format: "3 circuits · repos 60-90 s entre tours", ex: ["Pompes inclinées — 8-12", "Rowing serviette — 12", "Pompes diamant — 6-8", "Planche genoux — 20-30s", "Dead bug — 8/côté", "Bird dog — 8/côté"] },
    { code: "C", jour: "Vendredi", titre: "Cardio full body", format: "4 circuits · 45 s effort / 30 s repos par exercice", ex: ["Marche genoux hauts — continu · RPE 5-7", "Pompes inclinées — 12-20 · RPE 8", "Squat chaise — 15-25 · RPE 7-8", "Shadow boxing — continu · RPE 6-7", "Gainage genoux — tenir 45s (iso)", "Step-touch — continu · RPE 5-6"], note: "FC: parler oui, chanter non. Circuit chronométré : vise le tempo/RPE, pas un chiffre exact de reps." },
    { code: "D", jour: "Samedi", titre: "Full body force", format: "4 circuits · repos 75 s entre tours", ex: ["Squat bulgare — 6/j", "Pompes — 10-12", "Hip thrust — 12", "Planche — 30-40s", "Superman — 10", "Dips chaise — 8-10"] },
];
const etirements = ["Ischios assis", "Quadriceps debout", "Fente basse", "Mollet mur (priorité droite)", "Posture enfant", "Torsion allongée", "Cercles chevilles (pied droit)"];
const phases = [{ ph: "Phase 1", sem: "S1-4", pct: "~45%", but: "Réapprentissage moteur · tendons", c: "#5B4FE0" }, { ph: "Phase 2", sem: "S5-8", pct: "~58%", but: "Montée progressive", c: C.blue }, { ph: "Phase 3", sem: "S9-12", pct: "~70%", but: "Charge de travail", c: C.amber }, { ph: "Phase 4", sem: "S13-16+", pct: "~80%", but: "Objectif de reprise atteint", c: C.green }];
/* Programme PPL de base (5 séances). Les séances du programme ACTIF sont dans `salleSeances` (voir PROGRAMMES). */
const PPL_SEANCES = [
    { id: "Push", jour: "Lun", couleur: "#5B4FE0", emoji: "💪", focus: "Pecs · Épaules · Triceps", finisher: "🛷 Traîneau (poussée) 6×20 m · repos 60 s", exercices: [{ nom: "DC haltères", detail: "4×8-10", charges: ["20kg", "26kg", "32kg", "36kg"], note: "Par haltère. Ancien niveau retrouvé vers oct." }, { nom: "DI haltères", detail: "4×10-12", charges: ["16kg", "22kg", "26kg", "30kg"], note: "" }, { nom: "Poulie basse (pecs)", detail: "4×12-15", charges: ["14kg", "18kg", "21kg", "24kg"], note: "Pic de contraction 2 s en haut" }, { nom: "Élévations lat.", detail: "4×12-15", charges: ["5kg", "6kg", "8kg", "10kg"], note: "Deltoïde latéral (largeur)" }, { nom: "Triceps poulie", detail: "3×12-15", charges: ["16kg", "20kg", "24kg", "28kg"], note: "" }] },
    { id: "Pull", jour: "Mar", couleur: C.purple, emoji: "🏋️", focus: "Dos · Trapèzes · Biceps · Arrière d'épaule", finisher: "", exercices: [{ nom: "Tirage vertical", detail: "4×8-10", charges: ["40kg", "52kg", "62kg", "72kg"], note: "Remplace les tractions tant que le poids de corps est élevé" }, { nom: "Tirage bûcheron", detail: "4×8-10/bras", charges: ["22kg", "30kg", "35kg", "40kg"], note: "Buste calé, unilatéral" }, { nom: "Rack pull", detail: "4×6-8", charges: ["90kg", "115kg", "140kg", "160kg"], note: "Prise + lombaires : progressif. Sangles dès S5. Objectif 200kg vers nov." }, { nom: "Écarté inversé poulie", detail: "3×15-20", charges: ["7kg", "10kg", "12kg", "14kg"], note: "Arrière d'épaule (allongé au banc)" }, { nom: "Tirage araignée", detail: "2×15", charges: ["6kg", "7kg", "8kg", "10kg"], note: "À plat ventre, épaules relâchées" }, { nom: "Curl biceps", detail: "3×10-12", charges: ["7kg", "9kg", "11kg", "13kg"], note: "" }] },
    { id: "Legs", jour: "Mer", couleur: C.blue, emoji: "🦵", focus: "Quadri · Ischios · Mollets", finisher: "", exercices: [{ nom: "Presse à cuisses", detail: "4×10-12", charges: ["145kg", "185kg", "225kg", "255kg"], note: "Pied droit · amplitude contrôlée" }, { nom: "Hack squat", detail: "4×8-10", charges: ["65kg", "80kg", "100kg", "112kg"], note: "Genou : descente maîtrisée" }, { nom: "RDL", detail: "4×8-10", charges: ["65kg", "80kg", "100kg", "112kg"], note: "Tension ischios, dos neutre" }, { nom: "Leg curl", detail: "3×12-15", charges: ["27kg", "35kg", "42kg", "48kg"], note: "" }, { nom: "Mollets debout", detail: "6×15-20", charges: ["50kg", "65kg", "75kg", "88kg"], note: "Pied droit" }] },
    { id: "Upper", jour: "Ven", couleur: C.pink, emoji: "🔼", focus: "Haut du corps · Lourd (5-8)", finisher: "🚶 Farmer's walk 4×40 m + 🪢 battle ropes 6×30 s (ou traîneau)", exercices: [{ nom: "DC haltères neutre", detail: "4×6-8", charges: ["20kg", "26kg", "32kg", "37kg"], note: "Par haltère · prise neutre (épaule)" }, { nom: "Tirage bûcheron", detail: "4×8-10", charges: ["23kg", "30kg", "36kg", "42kg"], note: "Version lourde" }, { nom: "DM haltères", detail: "4×6-8", charges: ["12kg", "15kg", "18kg", "21kg"], note: "Développé épaules" }, { nom: "Élévations lat.", detail: "3×15-20", charges: ["5kg", "6kg", "8kg", "10kg"], note: "" }, { nom: "Curl marteau", detail: "3×8-10", charges: ["7kg", "9kg", "11kg", "13kg"], note: "" }, { nom: "Ext. triceps", detail: "3×8-10", charges: ["12kg", "16kg", "19kg", "22kg"], note: "" }] },
    { id: "Lower", jour: "Sam", couleur: C.green, emoji: "🔽", focus: "Fessiers · Quadri · Ischios · Lourd", finisher: "🛷 Traîneau arrière 5×20 m · léger (protège le genou)", exercices: [{ nom: "Hip thrust", detail: "4×8-10", charges: ["90kg", "115kg", "140kg", "160kg"], note: "Descente contrôlée" }, { nom: "Presse lourde", detail: "4×8-10", charges: ["155kg", "195kg", "240kg", "270kg"], note: "Pied droit" }, { nom: "Leg extension", detail: "4×10-12", charges: ["36kg", "46kg", "56kg", "64kg"], note: "Genou : sans à-coups, pas de blocage sec" }, { nom: "Leg curl assis", detail: "3×10-12", charges: ["27kg", "35kg", "42kg", "48kg"], note: "" }, { nom: "Abduction hanche", detail: "2×15-20", charges: ["32kg", "40kg", "48kg", "56kg"], note: "Fessiers" }, { nom: "Mollets assis", detail: "6×12-15", charges: ["27kg", "35kg", "42kg", "48kg"], note: "" }] },
];
let salleSeances = PPL_SEANCES; // remplacé par les séances de ton programme perso quand il est actif
const sportConseils = [{ t: "Articulations = rythme", d: "Tendons 3× plus lents que muscles. Genou/pied droit = facteurs limitants." }, { t: "Mémoire musculaire", d: "Anciens niveaux reviennent vite mais les premières semaines réveillent les tendons." }, { t: "Maison → salle", d: "S6-8 si genou et pied tiennent sans douleur piquante." }, { t: "Balance ≠ vérité", d: "Miroir et mensurations comptent plus." }];
/* ═══ NUTRITION DATA ═══ */
const macrosTarget = { p: 250, g: 240, l: 88, kcal: 2750 };
const mealIds = ["pre", "shaker", "petitdej", "dejeuner", "collation", "diner", "soir"];
const mealIcons = { pre: "🍌", shaker: "🥛", petitdej: "🍳", dejeuner: "🥗", collation: "🍎", diner: "🍽️", soir: "🌙" };
const repasTraining = [
    { "m": "Petit-déjeuner", "h": "7h00", "P": 32, "G": 42, "L": 22, "kcal": 494, "items": [{ "n": "Blancs d'œufs", "cru": 132, "p": 15, "g": 1, "l": 0, "u": "4 blancs", "fix": 1 }, { "n": "Œufs entiers", "cru": 110, "p": 14, "g": 1, "l": 12, "u": "2 œufs", "fix": 1 }, { "n": "Patate douce", "cru": 200, "p": 3, "g": 40, "l": 0, "cuit": 180 }, { "t": "Légumes verts" }, { "n": "Huile olive/colza", "cru": 10, "p": 0, "g": 0, "l": 10 }, { "t": "Collagène + vitamine C" }], "note": "Patate douce à l'air fryer (frites/cubes, 200°C 12-15 min) ou en pancakes.", "alts": [{ "label": "Pancakes patate douce", "items": [{ "n": "Blancs d'œufs", "cru": 100, "p": 11, "g": 1, "l": 0, "u": "3 blancs", "fix": 1 }, { "n": "Œufs entiers", "cru": 55, "p": 7, "g": 1, "l": 6, "u": "1 œuf", "fix": 1 }, { "n": "Patate douce", "cru": 150, "p": 2, "g": 30, "l": 0, "cuit": 135 }, { "n": "Avoine", "cru": 40, "p": 5, "g": 24, "l": 3, "cuit": 100 }, { "t": "Cannelle · mixé puis cuit en pancakes" }] }, { "label": "Overnight oats + œufs durs", "items": [{ "n": "Avoine", "cru": 80, "p": 10, "g": 48, "l": 6, "cuit": 200 }, { "n": "Fromage blanc 0%", "cru": 200, "p": 16, "g": 8, "l": 0 }, { "t": "Fruits rouges + cannelle" }, { "n": "Œufs entiers", "cru": 110, "p": 14, "g": 1, "l": 12, "u": "2 œufs durs", "fix": 1 }] }, { "label": "Wrap œufs brouillés", "items": [{ "n": "Galette wrap", "cru": 70, "p": 8, "g": 50, "l": 6, "u": "1 galette", "fix": 1 }, { "n": "Œufs entiers", "cru": 110, "p": 14, "g": 1, "l": 12, "u": "2 œufs", "fix": 1 }, { "n": "Blancs d'œufs", "cru": 66, "p": 7, "g": 1, "l": 0, "u": "2 blancs", "fix": 1 }, { "t": "Légumes" }, { "n": "Huile olive/colza", "cru": 8, "p": 0, "g": 0, "l": 8 }] }] },
    { "m": "Shaker whey", "h": "10h00", "P": 24, "G": 2, "L": 2, "kcal": 122, "items": [{ "n": "Whey (1 dose)", "cru": 30, "p": 24, "g": 2, "l": 2, "u": "1 dose", "fix": 1 }], "note": null },
    { "m": "Pré-séance", "h": "11h45", "P": 1, "G": 28, "L": 0, "kcal": 116, "items": [{ "n": "Banane", "cru": 120, "p": 1, "g": 28, "l": 0, "u": "1 banane", "fix": 1 }, { "t": "5g créatine + eau" }], "note": "Banane 15-20 min avant la séance." },
    { "m": "Déjeuner", "h": "13h20", "P": 47, "G": 89, "L": 9, "kcal": 625, "items": [{ "n": "Galette wrap", "cru": 70, "p": 8, "g": 50, "l": 6, "u": "1 galette", "fix": 1 }, { "n": "Poulet/dinde", "cru": 150, "p": 35, "g": 0, "l": 3, "cuit": 115 }, { "n": "Riz", "cru": 50, "p": 4, "g": 39, "l": 0, "cuit": 140 }, { "t": "Légumes crus" }, { "t": "Sauce citron + herbes" }], "note": "Post-séance — mange dans l'heure qui suit.", "alts": [{ "label": "Bowl mexicain", "items": [{ "n": "Bœuf haché 5%", "cru": 130, "p": 27, "g": 0, "l": 7, "cuit": 100 }, { "n": "Riz", "cru": 55, "p": 4, "g": 43, "l": 0, "cuit": 155 }, { "n": "Haricots rouges (conserve)", "cru": 80, "p": 6, "g": 13, "l": 0 }, { "n": "Avocat", "cru": 40, "p": 1, "g": 4, "l": 6, "u": "¼", "fix": 1 }, { "t": "Épinards + oignon" }, { "t": "Épices tex-mex" }] }, { "label": "Pâtes thon", "items": [{ "n": "Thon", "cru": 100, "p": 26, "g": 0, "l": 1, "cuit": 80 }, { "n": "Pâtes", "cru": 70, "p": 8, "g": 49, "l": 1, "cuit": 175 }, { "n": "Fromage blanc 0%", "cru": 60, "p": 5, "g": 2, "l": 0, "u": "sauce" }, { "t": "Tomates + basilic" }, { "n": "Huile olive/colza", "cru": 5, "p": 0, "g": 0, "l": 5 }] }, { "label": "Wrap poulet-cheddar", "items": [{ "n": "Galette wrap", "cru": 70, "p": 8, "g": 50, "l": 6, "u": "1 galette", "fix": 1 }, { "n": "Poulet/dinde", "cru": 130, "p": 30, "g": 0, "l": 3, "cuit": 100 }, { "n": "Cheddar", "cru": 25, "p": 6, "g": 0, "l": 8, "fix": 1 }, { "n": "Fromage blanc 0%", "cru": 50, "p": 4, "g": 2, "l": 0, "u": "sauce" }, { "t": "Salade + tomate" }] }] },
    { "m": "Collation", "h": "16h30", "P": 20, "G": 44, "L": 9, "kcal": 337, "items": [{ "n": "Fromage blanc 0%", "cru": 200, "p": 16, "g": 8, "l": 0 }, { "n": "Pomme/poire", "cru": 150, "p": 0, "g": 30, "l": 0, "u": "1 fruit", "fix": 1 }, { "n": "Noix de cajou", "cru": 20, "p": 4, "g": 6, "l": 9 }], "note": null },
    { "m": "Dîner", "h": "19h30", "P": 49, "G": 42, "L": 16, "kcal": 508, "items": [{ "n": "Cabillaud/thon", "cru": 200, "p": 40, "g": 0, "l": 2, "cuit": 160 }, { "n": "Quinoa", "cru": 65, "p": 9, "g": 42, "l": 4, "cuit": 195 }, { "t": "Légumes rôtis" }, { "n": "Huile olive/colza", "cru": 10, "p": 0, "g": 0, "l": 10 }], "note": null, "alts": [{ "label": "Bowl bœuf chili", "items": [{ "n": "Bœuf haché 5%", "cru": 150, "p": 32, "g": 0, "l": 8, "cuit": 115 }, { "n": "Riz", "cru": 65, "p": 5, "g": 51, "l": 0, "cuit": 180 }, { "n": "Haricots rouges (conserve)", "cru": 80, "p": 6, "g": 13, "l": 0 }, { "n": "Avocat", "cru": 40, "p": 1, "g": 4, "l": 6, "u": "¼", "fix": 1 }, { "t": "Épinards" }, { "t": "Cumin/paprika/ail" }] }, { "label": "Riz cantonais poulet", "items": [{ "n": "Poulet/dinde", "cru": 130, "p": 30, "g": 0, "l": 3, "cuit": 100 }, { "n": "Riz", "cru": 70, "p": 5, "g": 55, "l": 0, "cuit": 195 }, { "n": "Œufs entiers", "cru": 55, "p": 7, "g": 1, "l": 6, "u": "1 œuf", "fix": 1 }, { "t": "Légumes wok" }, { "n": "Graines de sésame", "cru": 5, "p": 1, "g": 1, "l": 3, "fix": 1 }, { "n": "Huile olive/colza", "cru": 8, "p": 0, "g": 0, "l": 8 }, { "t": "Soja + gingembre" }] }, { "label": "Pâtes bolognaise", "items": [{ "n": "Pâtes", "cru": 80, "p": 10, "g": 56, "l": 1, "cuit": 200 }, { "n": "Bœuf haché 5%", "cru": 130, "p": 27, "g": 0, "l": 7, "cuit": 100 }, { "n": "Parmesan", "cru": 15, "p": 5, "g": 0, "l": 4, "fix": 1 }, { "t": "Sauce tomate + oignon/ail" }, { "t": "Basilic" }] }, { "label": "Saumon patate douce", "items": [{ "n": "Saumon", "cru": 150, "p": 30, "g": 0, "l": 20, "cuit": 120 }, { "n": "Patate douce", "cru": 200, "p": 3, "g": 40, "l": 0, "cuit": 180 }, { "t": "Brocoli/haricots verts" }, { "t": "Citron + aneth" }] }] },
    { "m": "Collation soir", "h": "21h30", "P": 16, "G": 8, "L": 0, "kcal": 96, "items": [{ "n": "Fromage blanc 0%", "cru": 200, "p": 16, "g": 8, "l": 0 }, { "t": "Cannelle" }], "note": null }
];
const repasRest = [
    { "m": "Petit-déjeuner", "h": "8h00", "P": 29, "G": 70, "L": 9, "kcal": 477, "items": [{ "n": "Avoine", "cru": 80, "p": 10, "g": 48, "l": 6, "cuit": 200 }, { "n": "Fromage blanc 0%", "cru": 200, "p": 16, "g": 8, "l": 0 }, { "n": "Graines de chia", "cru": 10, "p": 2, "g": 4, "l": 3 }, { "n": "Fruits rouges", "cru": 80, "p": 1, "g": 10, "l": 0 }], "note": null, "alts": [{ "label": "Omelette complète", "items": [{ "n": "Œufs entiers", "cru": 165, "p": 21, "g": 2, "l": 18, "u": "3 œufs", "fix": 1 }, { "n": "Blancs d'œufs", "cru": 100, "p": 11, "g": 1, "l": 0, "u": "3 blancs", "fix": 1 }, { "n": "Pain complet", "cru": 60, "p": 5, "g": 29, "l": 2 }, { "t": "Épinards/champignons" }, { "n": "Huile olive/colza", "cru": 8, "p": 0, "g": 0, "l": 8 }] }, { "label": "Skyr granola", "items": [{ "n": "Fromage blanc 0%", "cru": 250, "p": 20, "g": 10, "l": 1, "u": "skyr" }, { "n": "Granola", "cru": 45, "p": 5, "g": 27, "l": 7 }, { "n": "Fruits rouges", "cru": 80, "p": 1, "g": 10, "l": 0 }, { "n": "Amandes", "cru": 15, "p": 3, "g": 3, "l": 7 }, { "n": "Miel", "cru": 10, "p": 0, "g": 8, "l": 0, "fix": 1 }] }] },
    { "m": "Déjeuner", "h": "12h30", "P": 56, "G": 30, "L": 15, "kcal": 479, "items": [{ "n": "Poulet/dinde", "cru": 180, "p": 41, "g": 0, "l": 4, "cuit": 135 }, { "n": "Lentilles", "cru": 60, "p": 15, "g": 30, "l": 1, "cuit": 145 }, { "t": "Légumes verts" }, { "n": "Huile olive/colza", "cru": 10, "p": 0, "g": 0, "l": 10 }], "note": null, "alts": [{ "label": "Bowl mexicain", "items": [{ "n": "Bœuf haché 5%", "cru": 150, "p": 32, "g": 0, "l": 8, "cuit": 115 }, { "n": "Riz", "cru": 50, "p": 4, "g": 39, "l": 0, "cuit": 140 }, { "n": "Haricots rouges (conserve)", "cru": 90, "p": 7, "g": 14, "l": 0 }, { "n": "Avocat", "cru": 40, "p": 1, "g": 4, "l": 6, "u": "¼", "fix": 1 }, { "t": "Épinards" }] }, { "label": "Omelette patate", "items": [{ "n": "Œufs entiers", "cru": 165, "p": 21, "g": 2, "l": 18, "u": "3 œufs", "fix": 1 }, { "n": "Blancs d'œufs", "cru": 100, "p": 11, "g": 1, "l": 0, "u": "3 blancs", "fix": 1 }, { "n": "Patate douce", "cru": 180, "p": 3, "g": 36, "l": 0, "cuit": 160 }, { "t": "Épinards/champignons" }, { "n": "Huile olive/colza", "cru": 8, "p": 0, "g": 0, "l": 8 }] }] },
    { "m": "Collation", "h": "16h00", "P": 28, "G": 36, "L": 12, "kcal": 364, "items": [{ "n": "Whey (1 dose)", "cru": 30, "p": 24, "g": 2, "l": 2, "u": "ou fromage blanc", "fix": 1 }, { "n": "Pomme/poire", "cru": 150, "p": 0, "g": 30, "l": 0, "u": "1 fruit", "fix": 1 }, { "n": "Amandes", "cru": 20, "p": 4, "g": 4, "l": 10 }], "note": null },
    { "m": "Dîner", "h": "19h30", "P": 47, "G": 32, "L": 15, "kcal": 451, "items": [{ "n": "Cabillaud/thon", "cru": 200, "p": 40, "g": 0, "l": 2, "cuit": 160, "u": "ou œufs" }, { "n": "Quinoa", "cru": 50, "p": 7, "g": 32, "l": 3, "cuit": 150 }, { "t": "Légumes rôtis" }, { "n": "Huile olive/colza", "cru": 10, "p": 0, "g": 0, "l": 10 }], "note": null, "alts": [{ "label": "Bowl bœuf chili", "items": [{ "n": "Bœuf haché 5%", "cru": 170, "p": 36, "g": 0, "l": 9, "cuit": 130 }, { "n": "Riz", "cru": 50, "p": 4, "g": 39, "l": 0, "cuit": 140 }, { "n": "Haricots rouges (conserve)", "cru": 90, "p": 7, "g": 14, "l": 0 }, { "n": "Avocat", "cru": 40, "p": 1, "g": 4, "l": 6, "u": "¼", "fix": 1 }, { "t": "Épinards" }] }, { "label": "Riz cantonais poulet", "items": [{ "n": "Poulet/dinde", "cru": 150, "p": 35, "g": 0, "l": 3, "cuit": 115 }, { "n": "Riz", "cru": 55, "p": 4, "g": 43, "l": 0, "cuit": 155 }, { "n": "Œufs entiers", "cru": 55, "p": 7, "g": 1, "l": 6, "u": "1 œuf", "fix": 1 }, { "t": "Légumes wok" }, { "n": "Graines de sésame", "cru": 5, "p": 1, "g": 1, "l": 3, "fix": 1 }, { "n": "Huile olive/colza", "cru": 8, "p": 0, "g": 0, "l": 8 }, { "t": "Soja" }] }, { "label": "Saumon quinoa", "items": [{ "n": "Saumon", "cru": 150, "p": 30, "g": 0, "l": 20, "cuit": 120 }, { "n": "Quinoa", "cru": 55, "p": 8, "g": 35, "l": 3, "cuit": 165 }, { "t": "Légumes rôtis" }, { "t": "Citron" }] }] },
    { "m": "Collation soir", "h": "21h30", "P": 16, "G": 8, "L": 0, "kcal": 96, "items": [{ "n": "Fromage blanc 0%", "cru": 200, "p": 16, "g": 8, "l": 0 }], "note": null }
];
const alimentsCats = { Protéines: ["Blancs d'œufs", "Poulet/dinde", "Cabillaud/thon", "Fromage blanc 0%", "Whey", "Lentilles"], Glucides: ["Avoine", "Patate douce", "Quinoa", "Riz", "Haricots rouges", "Fruits"], Lipides: ["Huile olive", "Huile colza", "Chia", "Noix de cajou", "Amandes", "Jaunes d'œufs"] };
const retires = ["Granola", "Lait écrémé", "Fromage gras", "Beurre cacahuète indus.", "Pain industriel", "Sauces indus."];
const complements = [{ n: "Whey", emoji: "🥛", quand: "Shaker whey (voir horaires du jour)", d: "24g protéines, absorption rapide." }, { n: "Créatine", emoji: "⚡", quand: "5g/jour tous les jours", d: "Saturation progressive, régularité prime." }, { n: "Alpha-Men", emoji: "💊", quand: "Avec un repas gras", d: "Vitamines liposolubles mieux absorbées avec lipides." }];
const nutritionConseils = [{ t: "Prépare la veille", d: "Patate douce, œufs, quinoa cuits la veille." }, { t: "250g protéines", d: "Whey + blancs + poulet + poisson + fromage blanc." }, { t: "Hydratation", d: "500ml au réveil + 500ml-1L pendant la séance." }, { t: "Poids ≠ vérité", d: "Mensurations et miroir comptent plus." }];
/* ═══ PROFIL & PLANNING — source unique de tous les horaires de l'app ═══
 * Le profil (clé "profil") décide : programme suivi, créneau de séance, heure de réveil.
 * Menu, checklist nutrition, accueil et calendrier .ics lisent tous dayPlan(). */
const PROFILE_DEFAULT = { programme: "auto", creneau: "midi", reveil: "6h45" };
const PROGRAMMES = {
    maison: { label: "Maison", days: { 1: "A", 3: "B", 5: "C", 6: "D" } },
    aucun: { label: "Natation seule", days: {} },
    salle: { label: "Salle", days: { 1: "Push", 2: "Pull", 3: "Legs", 5: "Upper", 6: "Lower" } },
};
const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
/* Horaires des repas d'un jour d'entraînement selon le créneau de séance */
const CRENEAUX = {
    matin: { label: "Matin", seance: "7h15", times: { "Pré-séance": "6h50", "Shaker whey": "8h20", "Petit-déjeuner": "9h00", "Déjeuner": "12h30", "Collation": "16h00", "Dîner": "19h30", "Collation soir": "21h30" } },
    midi: { label: "Midi", seance: "12h00", times: { "Petit-déjeuner": "7h00", "Shaker whey": "10h00", "Pré-séance": "11h45", "Déjeuner": "13h20", "Collation": "16h30", "Dîner": "19h30", "Collation soir": "21h30" } },
    soir: { label: "Soir", seance: "18h30", times: { "Petit-déjeuner": "7h30", "Déjeuner": "12h30", "Collation": "16h00", "Pré-séance": "18h10", "Shaker whey": "19h45", "Dîner": "20h30", "Collation soir": "22h30" } },
};
/* Nom de repas du menu → identifiant de la checklist nutrition (compatible anciennes saisies) */
const MEAL_ID = { "Pré-séance": "pre", "Shaker whey": "shaker", "Petit-déjeuner": "petitdej", "Déjeuner": "dejeuner", "Collation": "collation", "Dîner": "diner", "Collation soir": "soir" };
const hToMin = h => { const m = String(h || "").match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/); return m ? +m[1] * 60 + (+m[2] || 0) : 0; };
const minToH = n => Math.floor(n / 60) + "h" + String(n % 60).padStart(2, "0");
function normProfile(p) { return { ...PROFILE_DEFAULT, ...(p || {}) }; }
/* ═══ REGISTRE DES PROGRAMMES ═══
 * 2 programmes de base (« salle » = PPL, « maison » = circuits A-D) + tes programmes perso (clé "programmes").
 * Le programme actif se choisit dans le profil (profil.programme = "auto" | "salle" | "maison" | id perso).
 * syncPrograms() met à jour `salleSeances` : log, coach, Science, plan RM, onglet Salle et affiche du jour
 * lisent ainsi automatiquement les séances de ton programme perso quand il est actif. */
let CUSTOM_PROGS = [];
let ACTIVE_GYM = "salle"; // "salle" (PPL) ou id du programme perso actif
let CUSTOM_MUSCLE = {};
const SEANCE_COLORS = ["#5B4FE0", "#6F45E6", "#8A6900", "#D63C82", "#16A863", "#FF4F2B", "#0E9494"];
const DOW_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // L M M J V S D
const MUSCLE_EMOJI = { Pecs: "💪", Dos: "🏋️", "Épaules": "🔼", Biceps: "💪", Triceps: "💪", Quadriceps: "🦵", Ischios: "🦵", Fessiers: "🍑", Mollets: "🦶", Abdos: "🧱" };
const _convCache = new WeakMap();
/* Séances d'un programme perso → même format que les séances PPL (detail "4×8-10", charges, repos…) */
function customToSeances(p) {
    if (!p)
        return [];
    if (_convCache.has(p))
        return _convCache.get(p);
    const out = (p.seances || []).map((s, i) => {
        const mus = [...new Set((s.ex || []).map(e => e.muscle).filter(Boolean))];
        return { id: s.nom, jour: (s.days || []).map(d => DOW_SHORT[d]).join("/") || "—", couleur: SEANCE_COLORS[i % SEANCE_COLORS.length], emoji: MUSCLE_EMOJI[mus[0]] || "🏋️", focus: mus.join(" · ") || "Séance perso", finisher: "", custom: true,
            exercices: (s.ex || []).map(e => ({ nom: e.nom, detail: e.sets + "×" + (e.lo === e.hi ? e.lo : e.lo + "-" + e.hi), charges: Array(4).fill(e.kg ? e.kg + "kg" : "—"), note: e.note || "", rest: e.rest || 90, muscle: e.muscle || "" })) };
    }).filter(s => s.exercices.length); // une séance vide n'est ni proposée ni planifiée
    _convCache.set(p, out);
    return out;
}
function syncPrograms(progs, profile) {
    CUSTOM_PROGS = Array.isArray(progs) ? progs : [];
    CUSTOM_MUSCLE = {};
    CUSTOM_PROGS.forEach(p => (p.seances || []).forEach(s => (s.ex || []).forEach(e => { if (e.muscle)
        CUSTOM_MUSCLE[e.nom] = e.muscle; })));
    const cp = CUSTOM_PROGS.find(p => p.id === normProfile(profile).programme);
    const conv = customToSeances(cp);
    ACTIVE_GYM = cp && conv.length ? cp.id : "salle";
    salleSeances = cp && conv.length ? conv : PPL_SEANCES;
}
/* Une séance retrouvée par son nom, même si elle vient d'un autre programme (historique) */
function seanceById(id) { return salleSeances.find(s => s.id === id) || PPL_SEANCES.find(s => s.id === id) || CUSTOM_PROGS.flatMap(customToSeances).find(s => s.id === id) || null; }
function progInfo(prog) {
    if (PROGRAMMES[prog])
        return PROGRAMMES[prog];
    const p = CUSTOM_PROGS.find(x => x.id === prog);
    if (!p)
        return PROGRAMMES.salle;
    const days = {};
    customToSeances(p).forEach(s => (p.seances.find(x => x.nom === s.id)?.days || []).forEach(d => { days[d] = s.id; }));
    return { label: p.name, days, custom: true };
}
/* "auto" : salle dès qu'une séance salle a été enregistrée ces 21 derniers jours, sinon maison */
function resolveProgramme(profile, sportLogs) { const p = normProfile(profile).programme; if (p === "auto")
    return (sportLogs || []).some(l => withinDays(l.dateISO, 21)) ? "salle" : "maison"; if (PROGRAMMES[p] || CUSTOM_PROGS.some(x => x.id === p && customToSeances(x).length))
    return p; return "salle"; }
function programmeDays(prog) { return Object.keys(progInfo(prog).days).map(Number); }
/* Séance prévue à une date donnée (null = jour de repos) */
function sessionForDate(iso, prog) {
    const code = progInfo(prog).days[new Date(iso + "T12:00:00").getDay()];
    if (!code)
        return null;
    if (prog === "maison") {
        const s = maison.find(x => x.code === code);
        return { prog, code, emoji: "🏠", label: "Maison " + code, titre: s?.titre || "" };
    }
    const s = (prog === "salle" ? PPL_SEANCES : customToSeances(CUSTOM_PROGS.find(p => p.id === prog))).find(x => x.id === code);
    return { prog, code, emoji: s?.emoji || "🏋️", label: code, titre: s?.focus || "" };
}
/* Repas du jour (avec variante choisie) + horaires du profil, triés dans l'ordre de la journée */
function dayPlan(dayType, profile, mealAlt) {
    const pr = normProfile(profile), cr = CRENEAUX[pr.creneau] || CRENEAUX.midi;
    const base = dayType === "training" ? repasTraining : repasRest;
    const meals = base.map(m => {
        const ai = (mealAlt || {})[dayType + ":" + m.m] || 0;
        let out = { ...m };
        if (ai > 0 && m.alts && m.alts[ai - 1]) {
            const its = m.alts[ai - 1].items;
            const P = its.reduce((a, i) => a + (i.p || 0), 0), G = its.reduce((a, i) => a + (i.g || 0), 0), L = its.reduce((a, i) => a + (i.l || 0), 0);
            out = { ...out, items: its, P, G, L, kcal: P * 4 + G * 4 + L * 9, altLabel: m.alts[ai - 1].label };
        }
        if (dayType === "training")
            out.h = cr.times[m.m] || m.h;
        if (m.m === "Déjeuner" && dayType === "training")
            out.note = pr.creneau === "midi" ? "Post-séance — mange dans l'heure qui suit." : null;
        return out;
    }).sort((a, b) => hToMin(a.h) - hToMin(b.h));
    const timeline = [{ h: pr.reveil, t: "⏰ Réveil + créatine" }, ...meals.map(m => ({ h: m.h, t: m.m }))];
    if (dayType === "training")
        timeline.push({ h: cr.seance, t: "🏋️ Séance (~1h15)" });
    timeline.sort((a, b) => hToMin(a.h) - hToMin(b.h));
    return { meals, timeline, seance: dayType === "training" ? cr.seance : null };
}
/* Calendrier .ics : réveil, séances et repas, chacun aux bons jours et aux bonnes heures */
function buildProfileICS(profile, prog) {
    const pr = normProfile(profile), tDays = programmeDays(prog), rDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !tDays.includes(d));
    const ev = [{ title: "Réveil + créatine", h: pr.reveil, days: [0, 1, 2, 3, 4, 5, 6] }, { title: "Séance RECOMP", h: CRENEAUX[pr.creneau].seance, days: tDays }];
    dayPlan("training", pr).meals.forEach(m => ev.push({ title: m.m, h: m.h, days: tDays }));
    dayPlan("rest", pr).meals.forEach(m => ev.push({ title: m.m, h: m.h, days: rDays }));
    const now = new Date();
    let s = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RECOMP//FR\r\nCALSCALE:GREGORIAN\r\n";
    ev.filter(e => e.days.length).forEach((e, i) => {
        // 1re occurrence = prochain jour concerné (sinon iOS ajoute un événement parasite)
        const st = new Date(now);
        for (let k = 0; k < 7 && !e.days.includes(st.getDay()); k++)
            st.setDate(st.getDate() + 1);
        const mins = hToMin(e.h);
        st.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        const en = new Date(st.getTime() + 15 * 60000);
        const rule = e.days.length === 7 ? "FREQ=DAILY" : "FREQ=WEEKLY;BYDAY=" + e.days.map(d => ICS_DAYS[d]).join(",");
        s += "BEGIN:VEVENT\r\nUID:recomp-" + i + "-" + now.getTime() + "@recomp\r\nDTSTAMP:" + icsLocal(now) + "\r\nDTSTART:" + icsLocal(st) + "\r\nDTEND:" + icsLocal(en) + "\r\nRRULE:" + rule + "\r\nSUMMARY:" + e.title + "\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:" + e.title + "\r\nTRIGGER:PT0S\r\nEND:VALARM\r\nEND:VEVENT\r\n";
    });
    return s + "END:VCALENDAR\r\n";
}
/* ═══ BUDGET DATA ═══ */
const budgetAliments = [
    { id: "poulet", nom: "Poulet / dinde", emoji: "🍗", cat: "Protéines", q: "~1,1 kg/sem", prixKg: 10, sem: 11, budget: { nom: "Cuisses sans peau", prixKg: 5.5, sem: 6 } },
    { id: "poisson", nom: "Cabillaud / thon", emoji: "🐟", cat: "Protéines", q: "~1 kg/sem", prixKg: 17, sem: 17, budget: { nom: "Poisson blanc surgelé", prixKg: 10, sem: 10 } },
    { id: "oeufs", nom: "Œufs", emoji: "🥚", cat: "Protéines", q: "~24 + blancs", prixKg: null, sem: 8, budget: null },
    { id: "fromage_blanc", nom: "Fromage blanc 0%", emoji: "🥛", cat: "Protéines", q: "~2,4 kg/sem", prixKg: 2, sem: 5, budget: null },
    { id: "lentilles", nom: "Lentilles + haricots", emoji: "🫘", cat: "Protéines", q: "~120g + 1 boîte", prixKg: null, sem: 1.5, budget: null },
    { id: "avoine", nom: "Flocons d'avoine", emoji: "🌾", cat: "Glucides", q: "~700g/sem", prixKg: 2, sem: 1.5, budget: null },
    { id: "riz", nom: "Riz blanc", emoji: "🍚", cat: "Glucides", q: "~100g secs", prixKg: 2, sem: 0.5, budget: null },
    { id: "quinoa", nom: "Quinoa", emoji: "🌿", cat: "Glucides", q: "~360g secs", prixKg: 7, sem: 3, budget: { nom: "Riz / pommes de terre", prixKg: 2, sem: 1 } },
    { id: "patate", nom: "Patate douce", emoji: "🍠", cat: "Glucides", q: "~1 kg/sem", prixKg: 2.5, sem: 2.5, budget: null },
    { id: "bananes", nom: "Bananes", emoji: "🍌", cat: "Fruits", q: "~10/sem", prixKg: 1.5, sem: 2, budget: null },
    { id: "pommes", nom: "Pommes / poires", emoji: "🍎", cat: "Fruits", q: "~7/sem", prixKg: 2.5, sem: 2.5, budget: null },
    { id: "fruits_rouges", nom: "Fruits rouges", emoji: "🫐", cat: "Fruits", q: "~400g/sem", prixKg: 6, sem: 3, budget: { nom: "Surgelés", prixKg: 3, sem: 1.5 } },
    { id: "legumes", nom: "Légumes variés", emoji: "🥦", cat: "Légumes", q: "~3 kg/sem", prixKg: 2.5, sem: 8, budget: null },
    { id: "huile", nom: "Huile olive + colza", emoji: "🫒", cat: "Lipides", q: "~150 ml/sem", prixKg: null, sem: 2, budget: null },
    { id: "chia", nom: "Graines de chia", emoji: "🌱", cat: "Lipides", q: "~70g/sem", prixKg: 10, sem: 1, budget: null },
    { id: "oleagineux", nom: "Noix cajou + amandes", emoji: "🥜", cat: "Lipides", q: "~190g/sem", prixKg: 15, sem: 3, budget: { nom: "Cacahuètes nature", prixKg: 5, sem: 1 } },
    { id: "whey", nom: "Whey protéine", emoji: "💪", cat: "Compléments", q: "~150g/sem", prixKg: 25, sem: 4, budget: null },
    { id: "creatine", nom: "Créatine", emoji: "⚡", cat: "Compléments", q: "~35g/sem", prixKg: null, sem: 1, budget: null },
    { id: "alpham", nom: "Alpha-Men", emoji: "💊", cat: "Compléments", q: "7 gélules", prixKg: null, sem: 1.5, budget: null },
    { id: "epices", nom: "Épices / condiments", emoji: "🧂", cat: "Divers", q: "amorti", prixKg: null, sem: 1, budget: null },
];
const postes = [{ nom: "Protéines", val: 42.5, color: C.prot }, { nom: "Légumes", val: 8, color: C.green }, { nom: "Glucides", val: 7.5, color: C.gluc }, { nom: "Fruits", val: 7.5, color: C.pink }, { nom: "Compléments", val: 6.5, color: C.blue }, { nom: "Lipides/épices", val: 4, color: C.lip }];
const swaps = [
    { de: "Cabillaud frais", a: "Poisson blanc surgelé", saveSem: 7, detail: "~17 €/kg → ~10 €/kg, même profil nutritionnel" },
    { de: "Blanc de poulet", a: "Cuisses sans peau", saveSem: 5, detail: "~10 €/kg → ~5,5 €/kg, un peu plus de lipides mais plus de goût" },
    { de: "Quinoa", a: "Riz / pommes de terre", saveSem: 2, detail: "~7 €/kg → ~2 €/kg, compenser protéines avec poulet/œufs" },
    { de: "Fruits rouges frais", a: "Fruits rouges surgelés", saveSem: 1.5, detail: "3× moins cher, zéro gaspillage" },
    { de: "Noix de cajou", a: "Cacahuètes nature", saveSem: 2, detail: "~15 €/kg → ~5 €/kg, profil lipidique proche" },
];
const budgetConseils = [{ t: "Enseigne = 1er levier", d: "Lidl/Aldi sont 15-20% moins chers que Carrefour City / Monoprix." }, { t: "Les 3 swaps qui comptent", d: "Poisson surgelé + cuisses poulet + riz à la place du quinoa = 75€ → 58€/sem." }, { t: "Surgelé ≠ moins bon", d: "Le poisson blanc et les fruits rouges surgelés ont le même profil nutritionnel que le frais." }, { t: "Batch cooking", d: "Cuisine en gros le dimanche : quinoa, patate douce, poulet. Tu gagnes du temps ET de l'argent." }];
const TOTAL_SEM = 75, TOTAL_MOIS = 310, TOTAL_SEM_B = 58, TOTAL_MOIS_B = 250;
/* ═══ SVG CHARTS NATIFS (échelle uniforme) ═══ */
const _shortDate = s => (s || "").split("/").slice(0, 2).join("/");
function ChartBar({ data, dataKey, color, unit = "", height = 160 }) {
    if (!data || !data.length)
        return null;
    const W = 320, ml = 12, mr = 14, mt = 24, mb = 26, plotW = W - ml - mr, plotBot = height - mb, plotH = plotBot - mt;
    const vals = data.map(d => +(d[dataKey] || 0));
    const max = Math.max(...vals, 1) * 1.15;
    const n = data.length, slot = plotW / n, bw = Math.min(slot * 0.6, 70);
    const step = Math.ceil(n / 8);
    return React.createElement("svg", { viewBox: `0 0 ${W} ${height}`, style: { width: "100%", height: "auto", display: "block" } },
        [0, 0.25, 0.5, 0.75, 1].map((f, i) => { const y = plotBot - f * plotH; return React.createElement("line", { key: i, x1: ml, y1: y, x2: W - mr, y2: y, stroke: C.borderSoft, strokeWidth: 1 }); }),
        data.map((d, i) => {
            const v = +(d[dataKey] || 0);
            const bh = v / max * plotH;
            const cx = ml + slot * i + slot / 2;
            return React.createElement("g", { key: i },
                React.createElement("rect", { x: cx - bw / 2, y: plotBot - bh, width: bw, height: Math.max(bh, 0), fill: color, rx: 3, opacity: 0.9 }),
                React.createElement("text", { x: cx, y: plotBot - bh - 6, textAnchor: "middle", fontSize: 12, fill: color, fontWeight: "bold" },
                    v,
                    unit),
                (i % step === 0 || i === n - 1) && React.createElement("text", { x: cx, y: height - 8, textAnchor: "middle", fontSize: 11, fill: C.textDim }, _shortDate(d.date)));
        }));
}
function ChartLine({ data, dataKey, color, unit = "", height = 150 }) {
    if (!data || data.length < 2)
        return null;
    const W = 320, ml = 14, mr = 16, mt = 24, mb = 26, plotW = W - ml - mr, plotBot = height - mb, plotH = plotBot - mt;
    const vals = data.map(d => +(d[dataKey] || 0));
    let max = Math.max(...vals), min = Math.min(...vals);
    const flat = max === min;
    if (flat) {
        max += 1;
        min -= 1;
    }
    const range = max - min;
    const n = data.length, toX = i => ml + i * plotW / (n - 1), toY = v => plotBot - (v - min) / range * plotH;
    const pts = data.map((d, i) => `${toX(i)},${toY(+(d[dataKey] || 0))}`).join(" ");
    const step = Math.ceil(n / 8);
    return React.createElement("svg", { viewBox: `0 0 ${W} ${height}`, style: { width: "100%", height: "auto", display: "block" } },
        [0, 0.5, 1].map((f, i) => { const y = plotBot - f * plotH; return React.createElement("line", { key: i, x1: ml, y1: y, x2: W - mr, y2: y, stroke: C.borderSoft, strokeWidth: 1 }); }),
        React.createElement("polygon", { points: `${ml},${plotBot} ${pts} ${toX(n - 1)},${plotBot}`, fill: color + "18" }),
        React.createElement("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        data.map((d, i) => React.createElement("circle", { key: i, cx: toX(i), cy: toY(+(d[dataKey] || 0)), r: 3.5, fill: color })),
        data.map((d, i) => (i % step === 0 || i === n - 1) ? React.createElement("text", { key: "x" + i, x: toX(i), y: height - 8, textAnchor: "middle", fontSize: 11, fill: C.textDim }, _shortDate(d.date)) : null),
        React.createElement("text", { x: ml, y: mt - 8, fontSize: 11, fill: color, fontWeight: "bold" },
            flat ? vals[0] : Math.round(max * 10) / 10,
            unit),
        !flat && React.createElement("text", { x: W - mr, y: mt - 8, textAnchor: "end", fontSize: 10, fill: C.textDim },
            "min ",
            Math.round(min * 10) / 10,
            unit));
}
/* ═══ DATE HELPERS ═══ */
/* Dates en heure LOCALE (toISOString renverrait l'heure UTC : entre minuit et 2 h
   en France, une saisie tombait sur la veille). */
function _isoD(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const isoToday = () => _isoD(new Date());
const shiftISO = (iso, d) => { const x = new Date(iso + "T12:00:00"); x.setDate(x.getDate() + d); return _isoD(x); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const fmtDateLong = iso => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtDateShort = iso => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR");
/* true si la date ISO tombe dans les `days` derniers jours */
const withinDays = (iso, days) => { const a = new Date(); a.setDate(a.getDate() - days); return new Date(iso + "T12:00:00") >= a; };
function DateNav({ value, onChange, color }) {
    const today = isoToday();
    const isToday = value === today;
    const future = value >= today;
    const navBtn = { width: 38, height: 38, borderRadius: 10, border: `1px solid ${color}44`, background: color + "15", color: color, fontSize: 15, fontWeight: 800, cursor: "pointer", flexShrink: 0 };
    return React.createElement(Card, { style: { marginBottom: 10, padding: "10px 12px" }, border: color + "33" },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            React.createElement("button", { onClick: () => onChange(shiftISO(value, -1)), style: navBtn }, "◀"),
            React.createElement("div", { style: { flex: 1, textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, textTransform: "capitalize" } }, fmtDateLong(value)),
                React.createElement("div", { style: { fontSize: 10, color: isToday ? color : C.textDim, fontWeight: isToday ? 700 : 400 } }, isToday ? "Aujourd'hui" : new Date(value + "T12:00:00").toLocaleDateString("fr-FR", { year: "numeric" }))),
            React.createElement("button", { onClick: () => !future && onChange(shiftISO(value, 1)), disabled: future, style: { ...navBtn, opacity: future ? .3 : 1, cursor: future ? "default" : "pointer" } }, "▶")),
        React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8, alignItems: "center" } },
            React.createElement("input", { type: "date", value: value, max: today, onChange: e => e.target.value && onChange(e.target.value), style: { ...inputStyle, fontSize: 12, padding: "7px 9px", colorScheme: "light", flex: 1 } }),
            !isToday && React.createElement("button", { onClick: () => onChange(today), style: { padding: "7px 13px", borderRadius: 8, border: `1px solid ${color}44`, background: color + "15", color: color, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" } }, "Aujourd'hui")));
}
/* ═══ SUIVI SPORT ═══ */
/* ═══ SUIVI MAISON ═══ */
function SuiviMaison() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sel, setSel] = useState("A");
    const [form, setForm] = useState({});
    const [mode, setMode] = useState("log");
    const [saving, setSaving] = useState(false);
    const [selDate, setSelDate] = useState(isoToday());
    const [chartSel, setChartSel] = useState("A");
    useEffect(() => { load("maison-logs", []).then(d => { setLogs(d); setLoading(false); }); }, []);
    useEffect(() => bus.on("stored:maison-logs", d => setLogs(d || [])), []); // synchro avec l'affiche « aujourd'hui »
    const sm = maison.find(s => s.code === sel);
    const initF = useCallback(() => {
        const existing = logs.find(l => l.dateISO === selDate && l.seance === sel);
        const fd = {};
        if (sm)
            sm.ex.forEach((_, i) => { const ex = existing?.exercices?.[i]; fd[i] = ex ? { reps: String(ex.reps || ""), tours: String(ex.tours || "") } : { reps: "", tours: "" }; });
        setForm(fd);
    }, [sm, logs, selDate, sel]);
    useEffect(() => { initF(); }, [initF]);
    if (loading)
        return React.createElement(Card, null,
            React.createElement("div", { style: { color: C.textMut, textAlign: "center", padding: 10 } }, "Chargement…"));
    const doSave = async () => { setSaving(true); const e = { id: Date.now(), date: fmtDateShort(selDate), dateISO: selDate, seance: sel, exercices: sm.ex.map((ex, i) => { return ({ nom: ex.split("—")[0].trim(), reps: parseInt(form[i]?.reps) || 0, tours: parseInt(form[i]?.tours) || 0 }); }) }; const u = [...logs.filter(l => !(l.dateISO === selDate && l.seance === sel)), e]; await save("maison-logs", u); setLogs(u); setSaving(false); setMode("history"); };
    const doDel = id => commitWithUndo("maison-logs", logs, logs.filter(l => l.id !== id), setLogs, "🗑️ Séance maison supprimée");
    const chartData = logs.filter(l => l.seance === chartSel).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ date: l.date, reps: l.exercices.reduce((a, e) => a + (e.reps || 0), 0), tours: Math.round(l.exercices.reduce((a, e) => a + (e.tours || 0), 0) / Math.max(l.exercices.length, 1)) }));
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 8 } }, [["log", "📝 Saisie"], ["history", "📋 Historique"], ["charts", "📈 Graphiques"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mode === k, onClick: () => setMode(k), color: C.amber }, l))),
        mode === "log" && React.createElement("div", null,
            React.createElement(DateNav, { value: selDate, onChange: setSelDate, color: C.amber }),
            logs.some(l => l.dateISO === selDate && l.seance === sel) && React.createElement("div", { style: { fontSize: 10, color: C.amberLight, marginBottom: 8, marginTop: -2 } },
                "✎ Séance ",
                sel,
                " déjà enregistrée ce jour — mise à jour."),
            React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 12, overflowX: "auto" } }, maison.map(s => React.createElement("button", { key: s.code, onClick: () => setSel(s.code), style: { padding: "6px 11px", borderRadius: 999, border: `2px solid ${sel === s.code ? C.amber : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: sel === s.code ? C.amber + "22" : C.surfaceAlt, color: sel === s.code ? C.amber : C.textMut } },
                "🏠 ",
                s.code,
                " · ",
                s.jour.slice(0, 3)))),
            sm && React.createElement(Card, { border: C.amber + "33" },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 2 } }, sm.titre),
                React.createElement("div", { style: { fontSize: 11, color: C.amber, marginBottom: 12 } }, sm.format),
                sm.ex.map((ex, i) => {
                    const [nom, cible] = ex.split("—").map(s => s.trim());
                    return React.createElement("div", { key: i, style: { borderTop: i ? `1px solid ${C.borderSoft}` : "none", paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0 } },
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 6, color: C.text } },
                            nom,
                            " ",
                            React.createElement("span", { style: { color: C.textMut, fontWeight: 400 } },
                                "· cible : ",
                                cible || "—")),
                        React.createElement("div", { style: { display: "flex", gap: 8 } },
                            React.createElement("div", { style: { flex: 1 } },
                                React.createElement("div", { style: { fontSize: 10, color: C.textMut, marginBottom: 4 } }, "Reps réalisés"),
                                React.createElement("input", { type: "number", inputMode: "numeric", placeholder: "0", value: (form[i]?.reps) || "", onChange: e => setForm(p => ({ ...p, [i]: { ...p[i], reps: e.target.value } })), style: { ...inputStyle, width: "100%" } })),
                            React.createElement("div", { style: { flex: 1 } },
                                React.createElement("div", { style: { fontSize: 10, color: C.textMut, marginBottom: 4 } }, "Tours complétés"),
                                React.createElement("input", { type: "number", inputMode: "numeric", placeholder: "0", value: (form[i]?.tours) || "", onChange: e => setForm(p => ({ ...p, [i]: { ...p[i], tours: e.target.value } })), style: { ...inputStyle, width: "100%" } }))));
                }),
                React.createElement("button", { onClick: doSave, disabled: saving, style: { width: "100%", padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.amber, color: "#0A0700", fontSize: 13, fontWeight: 800, marginTop: 14, opacity: saving ? .6 : 1 } }, saving ? "Enregistrement…" : (logs.some(l => l.dateISO === selDate && l.seance === sel) ? "Mettre à jour la séance" : "Enregistrer la séance")))),
        mode === "history" && React.createElement("div", null, !logs.length ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucune séance.")) : React.createElement(React.Fragment, null, [...logs].reverse().slice(0, 30).map(l => React.createElement(Card, { key: l.id },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                React.createElement("div", null,
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 800 } },
                        "🏠 Séance ",
                        l.seance),
                    React.createElement("span", { style: { fontSize: 11, color: C.textMut, marginLeft: 8 } }, l.date)),
                React.createElement("button", { onClick: () => doDel(l.id), style: { background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 } }, "✕")),
            React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, l.exercices.filter(e => e.reps > 0).map((e, i) => React.createElement("span", { key: i, style: { fontSize: 10, background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "3px 7px", color: C.text } },
                e.nom.split(" ").slice(0, 2).join(" "),
                " ",
                React.createElement("b", { style: { color: C.amberLight } },
                    e.reps,
                    "reps"),
                e.tours > 0 && React.createElement("span", { style: { color: C.textDim } },
                    " ×",
                    e.tours,
                    "tours")))))))),
        mode === "charts" && React.createElement("div", null,
            React.createElement(Card, { style: { marginBottom: 8 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 8 } }, "Séance à analyser"),
                React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap" } }, maison.map(s => React.createElement("button", { key: s.code, onClick: () => setChartSel(s.code), style: { padding: "6px 12px", borderRadius: 999, border: `2px solid ${chartSel === s.code ? C.amber : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, background: chartSel === s.code ? C.amber + "22" : C.surfaceAlt, color: chartSel === s.code ? C.amber : C.textMut } },
                    "🏠 ",
                    s.code,
                    " · ",
                    s.jour.slice(0, 3))))),
            chartData.length < 2 ? React.createElement(Card, null,
                React.createElement("div", { style: { color: C.textMut, textAlign: "center", padding: 10, fontSize: 12 } },
                    "Enregistre au moins 2 séances ",
                    chartSel,
                    " pour voir la progression.")) : React.createElement(React.Fragment, null,
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.amber } },
                        "📈 Reps totaux — Séance ",
                        chartSel),
                    React.createElement(ChartBar, { data: chartData, dataKey: "reps", color: C.amber, unit: " reps", height: 160 })),
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.amberLight } },
                        "🔄 Tours moyens — Séance ",
                        chartSel),
                    React.createElement(ChartLine, { data: chartData, dataKey: "tours", color: C.amberLight, unit: " tours", height: 130 })))));
}
/* ═══ HELPERS LOT 1 (suivi salle) ═══ */
const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
function parseTargetKg(s) { if (s == null)
    return null; const m = String(s).match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(",", ".")) : null; }
function parseDetail(d) { const m = String(d || "").match(/(\d+)\s*[×xX]\s*(\d+)/); return m ? { sets: +m[1], reps: +m[2] } : null; }
function computePlates(target, bar, plates) { plates = plates || DEFAULT_PLATES; if (target == null || isNaN(target))
    return null; if (target < bar)
    return { error: true, loadedTotal: bar, perSide: [], remainder: +(target - bar).toFixed(2) }; let per = (target - bar) / 2, rem = per; const res = []; for (const p of plates) {
    let c = 0;
    while (rem >= p - 1e-9) {
        rem -= p;
        c++;
    }
    if (c)
        res.push({ plate: p, count: c });
} const loaded = bar + 2 * (per - rem); return { perSide: res, perSideKg: +(per - rem).toFixed(3), loadedTotal: +loaded.toFixed(2), remainder: +(rem * 2).toFixed(3) }; }
function prevSessionFor(logs, seance, beforeISO) { return logs.filter(l => l.seance === seance && l.dateISO < beforeISO).sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0] || null; }
function bestWeightFor(logs, nom, excludeId) { let best = 0; logs.forEach(l => { if (l.id === excludeId)
    return; l.exercices.forEach(e => { if (e.nom === nom && e.weight > best)
    best = e.weight; }); }); return best; }
function fmtMMSS(s) { const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); }
/* ═══ MINUTEUR DE REPOS ═══ */
/* "2 min" → 120, "2-3 min" → 150, "45-60 s" → 53, "90 s" → 90 */
function parseRestSec(txt) { const n = (String(txt || "").match(/\d+/g) || ["90"]).map(Number); const v = n.length > 1 ? (n[0] + n[1]) / 2 : n[0]; return Math.round(/min/.test(txt) ? v * 60 : v); }
/* Minuteur basé sur l'heure de fin (et non sur un compteur) : il reste juste quand l'écran
   se verrouille ou que l'app passe en arrière-plan, et survit à un rechargement.
   Démarrable depuis n'importe où : bus.emit("rest:start", { sec, label }). */
const TIMER_KEY = "recomp_timer";
function RestTimer({ color, recovery }) {
    const read = () => { try {
        return JSON.parse(localStorage.getItem(TIMER_KEY) || "null");
    }
    catch (e) {
        return null;
    } };
    const [t, setT] = useState(() => { const s = read(); return s && (s.pausedLeft != null || s.endAt > Date.now() - 120000) ? s : null; });
    const [now, setNow] = useState(Date.now());
    const ac = useRef(null);
    const persist = v => { setT(v); try {
        v ? localStorage.setItem(TIMER_KEY, JSON.stringify(v)) : localStorage.removeItem(TIMER_KEY);
    }
    catch (e) { } };
    const left = t ? (t.pausedLeft != null ? t.pausedLeft : Math.max(0, t.endAt - now)) : 0;
    const running = !!t && t.pausedLeft == null && left > 0;
    const done = !!t && t.pausedLeft == null && left <= 0;
    const beep = () => { try {
        const A = ac.current;
        if (A) {
            [0, 0.35].forEach(d => { const o = A.createOscillator(), g = A.createGain(); o.connect(g); g.connect(A.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.001, A.currentTime + d); g.gain.exponentialRampToValueAtTime(0.3, A.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.001, A.currentTime + d + 0.3); o.start(A.currentTime + d); o.stop(A.currentTime + d + 0.3); });
        }
    }
    catch (e) { } try {
        navigator.vibrate?.([220, 90, 220]);
    }
    catch (e) { } };
    useEffect(() => { if (!running)
        return; const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, [running]);
    useEffect(() => { const f = () => setNow(Date.now()); document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, []);
    // Sonnerie une seule fois, au passage à zéro
    useEffect(() => { if (done && t && !t.rang) {
        if (Date.now() - t.endAt < 5000)
            beep();
        persist({ ...t, rang: true });
    } }, [done]);
    const start = (sec, label) => { try {
        if (!ac.current && (window.AudioContext || window.webkitAudioContext))
            ac.current = new (window.AudioContext || window.webkitAudioContext)();
        ac.current?.resume?.();
    }
    catch (e) { } setNow(Date.now()); persist({ endAt: Date.now() + sec * 1000, total: sec, label: label || "", pausedLeft: null }); };
    useEffect(() => bus.on("rest:start", ({ sec, label }) => start(sec, label)), []);
    useEffect(() => bus.on("rest:stop", () => persist(null)), []);
    useEffect(() => { window.__restTimers = (window.__restTimers || 0) + 1; return () => { window.__restTimers--; }; }, []);
    const pause = () => persist({ ...t, pausedLeft: left });
    const resume = () => { if (left > 0)
        persist({ ...t, endAt: Date.now() + left, pausedLeft: null }); };
    const add = s => t && persist(t.pausedLeft != null ? { ...t, pausedLeft: t.pausedLeft + s * 1000, total: t.total + s } : { ...t, endAt: Math.max(t.endAt, Date.now()) + s * 1000, total: t.total + s, rang: false });
    const reset = () => persist(null);
    const secLeft = Math.ceil(left / 1000);
    const pct = t && t.total ? Math.min(100, (1 - left / (t.total * 1000)) * 100) : 0;
    const btn = { padding: "6px 9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800 };
    return React.createElement(Card, { border: done ? color : color + "33", style: { padding: "10px 12px", ...(done ? { boxShadow: `0 0 0 2px ${color}`, animation: "rcPulse 1s ease-in-out 3" } : {}) } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
            React.createElement("div", { style: { fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: done || running ? color : C.text, minWidth: 70 } }, "⏱ " + fmtMMSS(secLeft)),
            React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", flex: 1 } }, [60, 90, 120, 180].map(s => React.createElement("button", { key: s, onClick: () => start(s), style: { ...btn, background: recovery && s === 180 ? color + "33" : C.surfaceAlt, color: color } }, s + "s"))),
            running && React.createElement("button", { onClick: () => add(15), style: { ...btn, background: C.surfaceAlt, color: C.textMut } }, "+15"),
            running && React.createElement("button", { onClick: pause, style: { ...btn, background: color, color: "#1A1505" } }, "⏸"),
            !running && left > 0 && React.createElement("button", { onClick: resume, style: { ...btn, background: color, color: "#1A1505" } }, "▶"),
            t && React.createElement("button", { onClick: reset, style: { ...btn, background: "transparent", color: C.textMut, border: `1px solid ${C.border}` } }, "✕")),
        t && !done && React.createElement("div", { style: { height: 4, borderRadius: 2, background: C.surfaceAlt, marginTop: 8, overflow: "hidden" } },
            React.createElement("div", { style: { height: "100%", width: pct + "%", background: color, transition: "width .25s linear" } })),
        t && t.label && !done && React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginTop: 5 } }, "Repos après " + t.label),
        recovery && !t && React.createElement("div", { style: { fontSize: 10, color: C.gluc, marginTop: 6 } }, "🛌 Mode récupération : vise au moins 3 min entre les séries lourdes."),
        done && React.createElement("div", { style: { fontSize: 11, color: color, fontWeight: 700, marginTop: 6 } }, "Repos terminé — au boulot 💪"));
}
/* ═══ CALCULATEUR DE DISQUES ═══ */
function PlateCalc({ color }) {
    const [t, setT] = useState("");
    const [bar, setBar] = useState(20);
    const target = parseFloat(t);
    const r = isNaN(target) ? null : computePlates(target, bar);
    return React.createElement(Card, { border: color + "33" },
        React.createElement("div", { style: { fontSize: 12, fontWeight: 800, marginBottom: 8, color } }, "🔩 Calculateur de disques"),
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" } },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { fontSize: 9, color: C.textDim, marginBottom: 2 } }, "Charge visée (kg)"),
                React.createElement("input", { type: "number", inputMode: "decimal", value: t, onChange: e => setT(e.target.value), style: inputStyle, placeholder: "ex : 80" })),
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 9, color: C.textDim, marginBottom: 2 } }, "Barre"),
                React.createElement("div", { style: { display: "flex", gap: 4 } }, [20, 15, 10].map(b => React.createElement("button", { key: b, onClick: () => setBar(b), style: { padding: "9px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: bar === b ? color : C.surfaceAlt, color: bar === b ? "#1A1505" : C.textMut } }, b))))),
        r && (r.error ? React.createElement("div", { style: { fontSize: 11, color: C.danger } },
            "Charge inférieure au poids de la barre (",
            bar,
            " kg).") :
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 6 } },
                    "Par côté (",
                    r.perSideKg,
                    " kg) :"),
                React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, r.perSide.length ? r.perSide.map((p, i) => React.createElement("span", { key: i, style: { fontSize: 13, fontWeight: 800, background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 8, padding: "5px 10px" } },
                    p.count,
                    " × ",
                    p.plate)) : React.createElement("span", { style: { fontSize: 12, color: C.textDim } }, "Barre à vide")),
                React.createElement("div", { style: { fontSize: 11, marginTop: 8, color: C.text } },
                    "Total chargé : ",
                    React.createElement("b", { style: { color } },
                        r.loadedTotal,
                        " kg"),
                    r.remainder > 0 && React.createElement("span", { style: { color: C.danger, marginLeft: 6 } },
                        "(+",
                        r.remainder,
                        " kg non atteignables avec ces disques)")))));
}
/* ═══ HELPERS LOT 3 (blessures) ═══ */
function avgRPE(exs) { const v = exs.filter(e => e.rpe > 0).map(e => e.rpe); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; }
const painZones = ["Genou droit", "Pied droit", "Épaule", "Bas du dos", "Poignet", "Coude", "Hanche", "Autre"];
const substitutions = { "Hack squat": ["Presse à cuisses (amplitude contrôlée)", "Leg extension", "Goblet squat sur box"], "Presse à cuisses": ["Hack squat", "Leg extension", "Presse unilatérale légère"], "Presse lourde": ["Hack squat", "Leg extension", "Presse unilatérale"], "Rack pull": ["Tirage bûcheron lourd", "Shrug haltères", "Tirage menton poulie (léger)"], "RDL": ["Leg curl", "Hip thrust", "Good morning léger"], "Leg extension": ["Presse (amplitude haute)", "Hack squat léger"], "Mollets debout": ["Mollets assis", "Mollets à la presse (léger)"], "Mollets assis": ["Mollets debout (léger)"], "Abduction hanche": ["Abduction élastique", "Clamshell", "Pont fessier"], "Hip thrust": ["Pont fessier", "Abduction hanche", "RDL léger"] };
function deloadAdvice(logs) {
    if (!logs || !logs.length)
        return { level: "none", canAssess: false, reasons: [], info: "Pas encore de séances enregistrées." };
    const asc = [...logs].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const nonD = asc.filter(l => !l.deload);
    if (nonD.length < 4)
        return { level: "none", canAssess: false, reasons: [], info: "Enregistre au moins 4 séances (hors décharge) pour activer l'analyse." };
    const flags = [];
    const today = new Date();
    const lastDeload = [...asc].reverse().find(l => l.deload);
    const refDate = lastDeload ? new Date(lastDeload.dateISO + "T12:00:00") : new Date(asc[0].dateISO + "T12:00:00");
    const weeksSince = Math.round((today - refDate) / (7 * 86400000) * 10) / 10;
    if (weeksSince >= 6)
        flags.push("≈ " + Math.round(weeksSince) + " sem. sans décharge");
    const recent = nonD.slice(-3);
    const sessRPE = recent.map(l => { const v = (l.exercices || []).filter(e => e.rpe > 0).map(e => e.rpe); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }).filter(x => x != null);
    const recentRPE = sessRPE.length ? Math.round(sessRPE.reduce((a, b) => a + b, 0) / sessRPE.length * 10) / 10 : null;
    if (recentRPE != null && recentRPE >= 9)
        flags.push("RPE moyen " + recentRPE + "/10 (très élevé)");
    const vol = l => (l.exercices || []).reduce((a, e) => a + exVolume(e), 0);
    const bySeance = {};
    nonD.forEach(l => { (bySeance[l.seance] = bySeance[l.seance] || []).push(l); });
    let regress = 0, assessed = 0;
    Object.values(bySeance).forEach(arr => { if (arr.length >= 2) {
        assessed++;
        const last = vol(arr[arr.length - 1]), prev = vol(arr[arr.length - 2]);
        if (last > 0 && prev > 0 && last < prev * 0.97)
            regress++;
    } });
    if (assessed >= 2 && regress >= 2)
        flags.push("volume en baisse sur " + regress + " types de séance");
    let level = flags.length >= 2 ? "deload" : flags.length === 1 ? "watch" : "ok";
    if (weeksSince >= 8)
        level = "deload";
    return { level, canAssess: true, reasons: flags, weeksSince, recentRPE };
}
/* ═══ OUTILS SÉANCE — volume réel, séries détaillées, douleurs, suggestions ═══ */
const SCI_DEFAULT = { weightOverrides: {}, caloricAdjust: 0, deload: false, recovery: false };
const exVolume = e => e.setsDetail?.length ? e.setsDetail.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0) : (e.weight || 0) * (e.reps || 0) * (e.sets || 0);
const exBest1RM = e => e.setsDetail?.length ? Math.max(...e.setsDetail.map(s => epley1RM(s.w, s.r))) : epley1RM(e.weight, e.reps);
const fmtSets = e => e.setsDetail?.length ? e.setsDetail.map(s => s.w + "×" + s.r).join(" · ") : e.sets + "×" + e.reps;
/* Zone douloureuse → groupes musculaires à ménager */
const PAIN_IMPACT = { "Genou droit": ["Quadriceps", "Ischios", "Fessiers"], "Pied droit": ["Mollets", "Quadriceps"], "Hanche": ["Fessiers", "Quadriceps", "Ischios"], "Épaule": ["Pecs", "Épaules", "Triceps"], "Bas du dos": ["Dos", "Ischios"], "Poignet": ["Biceps", "Triceps", "Pecs"], "Coude": ["Biceps", "Triceps"] };
/* Douleurs ≥ 4/10 des `days` derniers jours : intensité max par zone */
function recentPains(dLogs, days) { const m = {}; (dLogs || []).filter(l => withinDays(l.dateISO, days || 10) && (l.intensite || 0) >= 4).forEach(l => { const c = m[l.zone]; if (!c || l.intensite > c.i || (l.intensite === c.i && l.dateISO > c.d))
    m[l.zone] = { i: l.intensite, d: l.dateISO }; }); return m; }
function painFor(nom, pains) { const mu = muscleOf(nom); return Object.entries(pains).filter(([z]) => (PAIN_IMPACT[z] || []).includes(mu)).map(([z, v]) => ({ zone: z, ...v })); }
/* Valeurs proposées pour un exercice : ajustement Science > suggestion coach, avec la charge de la PHASE
   choisie (S1-4, S5-8…) comme plancher : changer de phase met à jour les charges partout. Puis −40 % en décharge. */
function suggestFor(logs, seanceId, ex, phaseIdx, sci) {
    const d = parseDetail(ex.detail), ov = sci?.weightOverrides?.[seanceId + ":" + ex.nom], last = lastExerciseLog(logs, seanceId, ex.nom);
    let weight = null, reps = d ? d.reps : null, src = "phase";
    const ro = repOverrideFor(sci, seanceId + ":" + ex.nom);
    // Charge Science pas encore atteinte : on démarre en bas de la fourchette fixée par Science.
    // Déjà soulevée : le coach reprend la main (+1 rep, puis nouvelle hausse).
    if (ov && !(last && last.weight >= ov)) {
        weight = ov;
        if (ro)
            reps = ro.lo;
        src = "science";
    }
    else if (last) {
        const p = progressFor(seanceId, last, recupMode(sci), logs);
        weight = p.weight;
        reps = p.reps || reps;
        src = "coach";
    }
    // Charge de la phase choisie : jamais proposer moins. Si elle l'emporte, on repart en bas de la fourchette du programme.
    const phaseW = parseTargetKg(ex.charges[phaseIdx]);
    if (phaseW && (!weight || phaseW > weight)) {
        weight = phaseW;
        reps = d ? d.reps : reps;
        src = "phase";
    }
    if (sci?.deload && weight)
        weight = Math.round(weight * 0.6 * 2) / 2;
    return { weight, sets: d ? d.sets : null, reps, src };
}
function SuiviSport() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sel, setSel] = useState(salleSeances[0].id);
    const [form, setForm] = useState({});
    const [chartSel, setChartSel] = useState(salleSeances[0].id);
    const [mode, setMode] = useState("log");
    const [saving, setSaving] = useState(false);
    const [selDate, setSelDate] = useState(isoToday());
    const [histF, setHistF] = useState("all");
    const [selPhase, setPhase] = useStored("sport-phase", 0);
    const [sci, setSci] = useStored("science-config", SCI_DEFAULT);
    const [dLogs] = useStored("douleur-logs", []);
    const [pr, setPr] = useState([]);
    const [showCalc, setShowCalc] = useState(false);
    const [chartExo, setChartExo] = useState("");
    const [deloadDay, setDeloadDay] = useState(false);
    const [openAlt, setOpenAlt] = useState({});
    const [openDet, setOpenDet] = useState({});
    useEffect(() => { load("sport-logs", []).then(d => { setLogs(d); setLoading(false); }); }, []);
    useEffect(() => bus.on("stored:sport-logs", d => setLogs(d || [])), []); // synchro avec l'affiche « aujourd'hui »
    // Proposer automatiquement la séance prévue ce jour-là (programme salle)
    useEffect(() => { const s = sessionForDate(selDate, ACTIVE_GYM); if (s && !logs.some(l => l.dateISO === selDate && l.seance === sel))
        setSel(s.code); }, [selDate]);
    const se = salleSeances.find(s => s.id === sel) || seanceById(sel) || salleSeances[0];
    // Programme changé : la séance affichée doit exister dans le programme actif
    useEffect(() => { if (!salleSeances.some(s => s.id === sel) && !logs.some(l => l.dateISO === selDate && l.seance === sel))
        setSel(salleSeances[0].id); if (!salleSeances.some(s => s.id === chartSel))
        setChartSel(salleSeances[0].id); }, [salleSeances]);
    const blank = { weight: "", reps: "", sets: "", restSets: "", restExo: "", rpe: "", detail: null };
    const initF = useCallback(() => { const existing = logs.find(l => l.dateISO === selDate && l.seance === sel); const fd = {}; if (se)
        se.exercices.forEach((_, i) => { const ex = existing?.exercices?.[i]; fd[i] = ex ? { weight: ex.weight ? String(ex.weight) : "", reps: ex.reps ? String(ex.reps) : "", sets: ex.sets ? String(ex.sets) : "", restSets: ex.restSets ? String(ex.restSets) : "", restExo: ex.restExo ? String(ex.restExo) : "", rpe: ex.rpe ? String(ex.rpe) : "", detail: ex.setsDetail?.length ? ex.setsDetail.map(s => ({ w: String(s.w), r: String(s.r), done: true })) : null } : { ...blank }; }); setForm(fd); setOpenDet(Object.fromEntries(Object.entries(fd).filter(([, v]) => v.detail).map(([k]) => [k, true]))); setDeloadDay(existing ? !!existing.deload : !!sci.deload); }, [se, logs, selDate, sel]);
    useEffect(() => { initF(); }, [initF]);
    useEffect(() => { if (!logs.some(l => l.dateISO === selDate && l.seance === sel))
        setDeloadDay(!!sci.deload); }, [sci.deload]);
    const setF = (i, patch) => setForm(p => ({ ...p, [i]: { ...p[i], ...patch } }));
    /* Séries détaillées : chaque ligne = charge × reps, ✓ lance le minuteur de repos */
    const openDetail = (i, ex) => { const f = form[i] || {}; if (!f.detail) {
        const n = parseInt(f.sets) || parseDetail(ex.detail)?.sets || 3;
        setF(i, { detail: Array.from({ length: n }, () => ({ w: f.weight || "", r: f.reps || "", done: false })) });
    } setOpenDet(o => ({ ...o, [i]: !o[i] })); };
    const setRow = (i, k, patch) => setForm(p => { const det = [...(p[i].detail || [])]; det[k] = { ...det[k], ...patch }; return { ...p, [i]: { ...p[i], detail: det } }; });
    const doSave = async () => {
        setSaving(true);
        const exs = se.exercices.map((ex, i) => {
            const f = form[i] || {};
            const det = (f.detail || []).map(s => ({ w: parseFloat(s.w) || 0, r: parseInt(s.r) || 0 })).filter(s => s.w > 0 && s.r > 0);
            const base = { nom: ex.nom, restSets: parseInt(f.restSets) || 0, restExo: parseInt(f.restExo) || 0, rpe: parseFloat(f.rpe) || 0 };
            if (det.length) {
                const top = Math.max(...det.map(s => s.w));
                return { ...base, weight: top, reps: Math.min(...det.filter(s => s.w === top).map(s => s.r)), sets: det.length, setsDetail: det };
            }
            return { ...base, weight: parseFloat(f.weight) || 0, reps: parseInt(f.reps) || 0, sets: parseInt(f.sets) || 0 };
        });
        const replacedId = logs.find(l => l.dateISO === selDate && l.seance === sel)?.id;
        const newPRs = deloadDay ? [] : exs.filter(x => x.weight > 0 && x.weight > bestWeightFor(logs, x.nom, replacedId)).map(x => ({ nom: x.nom, weight: x.weight }));
        const e = { id: Date.now(), date: fmtDateShort(selDate), dateISO: selDate, seance: sel, deload: deloadDay, exercices: exs };
        const u = [...logs.filter(l => !(l.dateISO === selDate && l.seance === sel)), e];
        const ok = await save("sport-logs", u);
        setSaving(false);
        if (!ok)
            return toast("❌ Séance non enregistrée (stockage plein ?)", { tone: "danger" });
        setLogs(u);
        setPr(newPRs);
        toast(newPRs.length ? "🏆 Séance enregistrée — " + newPRs.length + " record" + (newPRs.length > 1 ? "s" : "") + " !" : "✅ Séance " + sel + " enregistrée");
        setMode("history");
    };
    const doDel = id => commitWithUndo("sport-logs", logs, logs.filter(l => l.id !== id), setLogs, "🗑️ Séance supprimée");
    const doReset = () => resetWithConfirm("sport-logs", logs, setLogs, "séances salle");
    const toggleDeload = () => { const v = !deloadDay; setDeloadDay(v); setSci({ ...sci, deload: v }); toast(v ? "🪶 Décharge activée partout (−40 %)" : "Décharge désactivée"); };
    const seanceInfo = salleSeances.find(s => s.id === chartSel) || salleSeances[0];
    const chartData = logs.filter(l => l.seance === chartSel).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ date: l.date, vol: Math.round(l.exercices.reduce((a, e) => a + exVolume(e), 0)), charge: Math.max(...l.exercices.map(e => e.weight || 0)) }));
    const prevLog = useMemo(() => prevSessionFor(logs, sel, selDate), [logs, sel, selDate]);
    const advice = useMemo(() => deloadAdvice(logs), [logs]);
    const pains = useMemo(() => recentPains(dLogs, 10), [dLogs]);
    const effExo = seanceInfo.exercices.find(e => e.nom === chartExo) ? chartExo : ((seanceInfo.exercices[0]?.nom) || "");
    const rmData = logs.filter(l => l.seance === chartSel).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => { const ex = l.exercices.find(e => e.nom === effExo); return { date: l.date, rm: ex ? exBest1RM(ex) : 0 }; }).filter(d => d.rm > 0);
    /* Pré-remplissage intelligent des champs vides */
    const prefillTargets = () => { let n = 0; setForm(p => { const nf = { ...p }; se.exercices.forEach((ex, i) => { const cur = nf[i] || {}; const s = suggestFor(logs, sel, ex, selPhase, { ...sci, deload: deloadDay }); const upd = { ...cur, weight: cur.weight || (s.weight != null ? String(s.weight) : ""), sets: cur.sets || (s.sets != null ? String(s.sets) : ""), reps: cur.reps || (s.reps != null ? String(s.reps) : "") }; if (upd.weight !== cur.weight || upd.sets !== cur.sets || upd.reps !== cur.reps)
        n++; nf[i] = upd; }); return nf; }); toast("✨ Champs pré-remplis (coach, ajustements Science" + (deloadDay ? ", décharge −40 %" : "") + ")"); };
    const copyLast = () => { if (!prevLog)
        return toast("Aucune séance " + sel + " précédente"); setForm(p => { const nf = { ...p }; se.exercices.forEach((ex, i) => { const e = prevLog.exercices.find(x => x.nom === ex.nom); if (!e)
        return; nf[i] = { weight: e.weight ? String(e.weight) : "", reps: e.reps ? String(e.reps) : "", sets: e.sets ? String(e.sets) : "", restSets: e.restSets ? String(e.restSets) : "", restExo: e.restExo ? String(e.restExo) : "", rpe: "", detail: e.setsDetail?.length ? e.setsDetail.map(s => ({ w: String(s.w), r: String(s.r), done: false })) : null }; }); return nf; }); toast("⟲ Valeurs du " + prevLog.date + " reprises"); };
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    return React.createElement("div", null,
        advice.level === "none"
            ? React.createElement(Card, { border: C.border },
                React.createElement("div", { style: { fontSize: 11, color: C.textMut } },
                    "⚪ ",
                    React.createElement("b", { style: { color: C.text } }, "Analyse de décharge"),
                    " — ",
                    advice.info))
            : (() => { const cfg = { ok: { c: C.green, e: "🟢", t: "Pas de décharge nécessaire", s: "Tes indicateurs sont bons — continue la progression." }, watch: { c: C.gluc, e: "🟠", t: "Vigilance — léger signe de fatigue", s: "Pas indispensable, mais surveille les prochaines séances." }, deload: { c: "#5B4FE0", e: "🪶", t: "Semaine de décharge recommandée", s: "Réduis les charges ~40-50 % pendant une semaine, en gardant le volume." } }[advice.level]; return React.createElement(Card, { border: cfg.c, style: { background: `linear-gradient(135deg,${cfg.c}1A,${C.surface})` } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: cfg.c } },
                    cfg.e,
                    " ",
                    cfg.t),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginTop: 3 } }, cfg.s),
                advice.reasons.length > 0 && React.createElement("div", { style: { marginTop: 7, display: "flex", flexWrap: "wrap", gap: 5 } }, advice.reasons.map((r, i) => React.createElement("span", { key: i, style: { fontSize: 10, fontWeight: 700, background: cfg.c + "22", color: cfg.c, borderRadius: 6, padding: "3px 8px" } }, r))),
                advice.level === "deload" && React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginTop: 7 } }, "👉 Active le 🪶 « Semaine de décharge » dans le Log. Une gêne au genou/pied est aussi une raison valable de décharger.")); })(),
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } }, [["log", "📝 Log"], ["history", "📋 Historique"], ["charts", "📈 Graphiques"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mode === k, onClick: () => setMode(k), color: C.amber }, l))),
        pr.length > 0 && React.createElement(Card, { border: C.amber, style: { background: `linear-gradient(135deg,${C.amber}22,${C.surface})`, boxShadow: `0 0 0 1px ${C.amber}55` } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: C.amberLight } },
                        "🏆 Nouveau",
                        pr.length > 1 ? "x" : "",
                        " record",
                        pr.length > 1 ? "s" : "",
                        " !"),
                    React.createElement("div", { style: { fontSize: 11, color: C.text, marginTop: 3 } }, pr.map(p => p.nom + " — " + p.weight + "kg").join(" · "))),
                React.createElement("button", { onClick: () => setPr([]), style: { background: "none", border: "none", color: C.textMut, cursor: "pointer", fontSize: 15, lineHeight: 1 } }, "✕"))),
        mode === "log" && React.createElement("div", null,
            React.createElement(DateNav, { value: selDate, onChange: setSelDate, color: C.amber }),
            logs.some(l => l.dateISO === selDate && l.seance === sel) && React.createElement("div", { style: { fontSize: 10, color: C.amberLight, marginBottom: 8, marginTop: -2 } },
                "✎ Séance ",
                sel,
                " déjà enregistrée ce jour — l'enregistrement la mettra à jour."),
            React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 12, overflowX: "auto" } }, salleSeances.map(s => React.createElement("button", { key: s.id, onClick: () => setSel(s.id), style: { padding: "6px 11px", borderRadius: 999, border: `2px solid ${sel === s.id ? s.couleur : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: sel === s.id ? s.couleur + "22" : C.surfaceAlt, color: sel === s.id ? s.couleur : C.textMut } },
                s.emoji,
                " ",
                s.id))),
            React.createElement(Card, { border: C.amber + "33", style: { padding: "10px 12px" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
                    React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.textMut } }, "🎯 Phase du programme"),
                    React.createElement("div", { style: { display: "flex", gap: 6 } },
                        prevLog && React.createElement("button", { onClick: copyLast, style: { padding: "5px 9px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMut, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, "⟲ Reprendre"),
                        React.createElement("button", { onClick: prefillTargets, style: { padding: "5px 11px", borderRadius: 8, border: `1px solid ${C.amber}55`, background: C.amber + "15", color: C.amber, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, "✨ Pré-remplir"))),
                React.createElement("div", { style: { display: "flex", gap: 5 } }, phases.map((p, i) => React.createElement("button", { key: i, onClick: () => setPhase(i), style: { flex: 1, padding: "6px 3px", borderRadius: 8, border: `2px solid ${selPhase === i ? p.c : "transparent"}`, cursor: "pointer", fontWeight: 700, background: selPhase === i ? p.c + "22" : C.surfaceAlt, color: selPhase === i ? p.c : C.textMut } },
                    React.createElement("div", { style: { fontSize: 11 } }, p.ph.replace("Phase ", "P")),
                    React.createElement("div", { style: { fontSize: 8, fontWeight: 400, color: C.textDim } }, p.sem))))),
            React.createElement("button", { onClick: toggleDeload, style: { width: "100%", padding: "9px 0", borderRadius: 10, border: `1px solid ${deloadDay ? "#5B4FE0" : C.border}`, background: deloadDay ? "#5B4FE022" : "transparent", color: deloadDay ? "#4A3FCB" : C.textMut, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: deloadDay ? 6 : 10 } },
                "🪶 Semaine de décharge ",
                deloadDay ? "✓" : ""),
            deloadDay && React.createElement("div", { style: { fontSize: 10, color: "#4A3FCB", marginBottom: 10 } }, "Charges réduites de 40 %, volume maintenu. Réglage partagé avec l'onglet Salle et Science. Les PR ne sont pas comptabilisés."),
            React.createElement(RestTimer, { color: C.amber, recovery: recupMode(sci) }),
            (() => { const hit = se.exercices.map(ex => ({ ex, p: painFor(ex.nom, pains) })).filter(x => x.p.length); if (!hit.length)
                return null; const zones = [...new Set(hit.flatMap(x => x.p.map(p => p.zone + " " + p.i + "/10")))]; return React.createElement(Card, { border: C.danger + "66", style: { background: `linear-gradient(135deg,${C.danger}18,${C.surface})` } },
                React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: C.danger, marginBottom: 4 } }, "🩹 Douleur récente : " + zones.join(" · ")),
                React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, lineHeight: 1.5 } }, hit.length + " exercice" + (hit.length > 1 ? "s" : "") + " de cette séance sollicite" + (hit.length > 1 ? "nt" : "") + " la zone : " + hit.map(x => x.ex.nom).join(", ") + ". Baisse la charge, garde une amplitude indolore ou prends une alternative (ouvertes ci-dessous)."),
                React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 4 } }, "Douleur piquante = arrêt de l'exercice. Données de l'onglet 🩹 Douleur (10 derniers jours, ≥ 4/10).")); })(),
            React.createElement("button", { onClick: () => setShowCalc(v => !v), style: { width: "100%", padding: "9px 0", borderRadius: 10, border: `1px solid ${C.amber}33`, background: showCalc ? C.amber + "15" : "transparent", color: C.amber, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 10 } },
                "🔩 Calculateur de disques ",
                showCalc ? "▲" : "▼"),
            showCalc && React.createElement(PlateCalc, { color: C.amber }),
            React.createElement(Card, { border: se.couleur + "44" },
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, marginBottom: 2 } },
                    se.emoji,
                    " ",
                    se.id),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 14 } }, se.focus),
                se.exercices.map((ex, i) => React.createElement("div", { key: i, style: { padding: "10px 0", borderTop: i ? `1px solid ${C.borderSoft}` : "none" } },
                    React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700, marginBottom: 4 } },
                        ex.nom,
                        " ",
                        React.createElement("span", { style: { color: C.textDim, fontWeight: 400 } },
                            "(",
                            ex.detail,
                            ")")),
                    (() => { const last = (prevLog?.exercices?.[i]?.weight) || 0; const cur = parseFloat(form[i]?.weight) || 0; const ar = last > 0 && cur > 0 ? (cur > last ? { t: "↑", c: C.green } : cur < last ? { t: "↓", c: C.danger } : { t: "=", c: C.textMut }) : null; return React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6, fontSize: 10 } },
                        React.createElement("span", { style: { color: C.amberLight } },
                            "🎯 ",
                            sci.weightOverrides?.[sel + ":" + ex.nom] ? sci.weightOverrides[sel + ":" + ex.nom] + "kg" + (repOverrideFor(sci, sel + ":" + ex.nom) ? " × " + fmtRange(repOverrideFor(sci, sel + ":" + ex.nom)) : "") + " 🔬" : ex.charges[selPhase]),
                        (() => { const cr = currentRangeFor(logs, sci, sel, ex.nom); return cr && cr.src === "auto" ? React.createElement("span", { style: { color: C.green, fontWeight: 700 } }, "🔁 fourchette " + fmtRange(cr.range) + " reps") : null; })(),
                        painFor(ex.nom, pains).map(pp => React.createElement("span", { key: pp.zone, style: { color: C.danger, fontWeight: 700 } }, "🩹 " + pp.zone + " " + pp.i + "/10")),
                        last > 0 && React.createElement("span", { style: { color: C.textMut } },
                            "⟲ Dernière : ",
                            last,
                            "kg",
                            ar && React.createElement("b", { style: { color: ar.c, marginLeft: 4 } }, ar.t))); })(),
                    !(openDet[i] && form[i]?.detail) && React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 6 } }, [["weight", "Charge (kg)"], ["sets", "Séries"], ["reps", "Reps"]].map(([k, lb]) => { return React.createElement("div", { key: k, style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 9, color: C.textDim, marginBottom: 2 } }, lb),
                        React.createElement("input", { type: "number", inputMode: "decimal", value: (form[i]?.[k]) || "", onChange: e => setForm(p => ({ ...p, [i]: { ...p[i], [k]: e.target.value } })), style: inputStyle, placeholder: "—" })); })),
                    React.createElement("div", { style: { display: "flex", gap: 6 } }, [["restSets", "⏱ Repos séries (s)", "90"], ["restExo", "⏱ Repos → exo (s)", "90"], ["rpe", "🔥 RPE /10", "8"]].map(([k, lb, ph]) => { return React.createElement("div", { key: k, style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 9, color: C.amber, marginBottom: 2 } }, lb),
                        React.createElement("input", { type: "number", inputMode: "decimal", value: (form[i]?.[k]) || "", onChange: e => setForm(p => ({ ...p, [i]: { ...p[i], [k]: e.target.value } })), style: { ...inputStyle, border: `1px solid ${C.amber}33`, color: C.amberLight }, placeholder: ph })); })),
                    React.createElement("button", { onClick: () => openDetail(i, ex), style: { background: "none", border: "none", color: C.amber, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" } }, (openDet[i] ? "▲ " : "▼ ") + "Détail par série" + (form[i]?.detail?.length ? " (" + form[i].detail.filter(r => r.done).length + "/" + form[i].detail.length + " ✓)" : "")),
                    openDet[i] && form[i]?.detail && React.createElement("div", { style: { marginTop: 6, background: C.surfaceAlt, borderRadius: 10, padding: "8px 8px 4px" } },
                        form[i].detail.map((row, k) => React.createElement("div", { key: k, style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 } },
                            React.createElement("span", { style: { width: 22, fontSize: 10, color: C.textDim, fontWeight: 700 } }, "S" + (k + 1)),
                            React.createElement("input", { type: "number", inputMode: "decimal", value: row.w, placeholder: "kg", onChange: e => setRow(i, k, { w: e.target.value }), style: { ...inputStyle, padding: "7px 8px", flex: 1 } }),
                            React.createElement("span", { style: { fontSize: 11, color: C.textDim } }, "×"),
                            React.createElement("input", { type: "number", inputMode: "decimal", value: row.r, placeholder: "reps", onChange: e => setRow(i, k, { r: e.target.value }), style: { ...inputStyle, padding: "7px 8px", flex: 1 } }),
                            React.createElement("button", { onClick: () => { const done = !row.done; setRow(i, k, { done }); if (done)
                                    bus.emit("rest:start", { sec: parseInt(form[i]?.restSets) || parseRestSec(reposFor(sel, ex.nom)), label: ex.nom + " · série " + (k + 1) }); }, "aria-label": "Série faite", style: { width: 38, height: 34, borderRadius: 9, border: `1.5px solid ${row.done ? C.green : C.border}`, background: row.done ? C.green + "28" : "transparent", color: row.done ? C.green : C.textDim, fontSize: 15, fontWeight: 800, cursor: "pointer" } }, "✓"))),
                        React.createElement("div", { style: { display: "flex", gap: 6, justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("span", { style: { fontSize: 9.5, color: C.textDim } }, "✓ = série faite → lance le repos (" + reposFor(sel, ex.nom) + ")"),
                            React.createElement("div", { style: { display: "flex", gap: 4 } },
                                form[i].detail.length > 1 && React.createElement("button", { onClick: () => setF(i, { detail: form[i].detail.slice(0, -1) }), style: { padding: "3px 9px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.textMut, fontSize: 12, cursor: "pointer" } }, "−"),
                                React.createElement("button", { onClick: () => { const lastRow = form[i].detail[form[i].detail.length - 1] || {}; setF(i, { detail: [...form[i].detail, { w: lastRow.w || "", r: lastRow.r || "", done: false }] }); }, style: { padding: "3px 9px", borderRadius: 7, border: `1px solid ${C.amber}55`, background: "transparent", color: C.amber, fontSize: 12, cursor: "pointer" } }, "+ série")))),
                    substitutions[ex.nom] && React.createElement("div", { style: { marginTop: 6 } },
                        React.createElement("button", { onClick: () => setOpenAlt(o => ({ ...o, [i]: !(o[i] ?? painFor(ex.nom, pains).length > 0) })), style: { background: "none", border: "none", color: C.danger, fontSize: 10, fontWeight: 700, cursor: "pointer", padding: 0 } },
                            "🔁 Alternatives si douleur ",
                            (openAlt[i] ?? painFor(ex.nom, pains).length > 0) ? "▲" : "▼"),
                        (openAlt[i] ?? painFor(ex.nom, pains).length > 0) &&React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 } }, substitutions[ex.nom].map((a, ai) => React.createElement("span", { key: ai, style: { fontSize: 10, background: C.danger + "12", border: `1px solid ${C.danger}33`, color: "#D7263D", borderRadius: 8, padding: "3px 8px" } }, a)))))),
                React.createElement("button", { onClick: doSave, disabled: saving, style: { width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.amber, color: "#1A1505", fontSize: 13, fontWeight: 800, opacity: saving ? .6 : 1 } }, saving ? "Enregistrement…" : (logs.some(l => l.dateISO === selDate && l.seance === sel) ? "Mettre à jour la séance" : "Enregistrer la séance")))),
        mode === "history" && React.createElement("div", null, !logs.length ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucune séance.")) : React.createElement(React.Fragment, null,
            React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 } }, [["all", "Toutes"], ...salleSeances.map(s => [s.id, s.emoji + " " + s.id])].map(([k, l]) => React.createElement("button", { key: k, onClick: () => setHistF(k), style: { padding: "4px 10px", borderRadius: 999, border: `1px solid ${histF === k ? C.amber : C.borderSoft}`, cursor: "pointer", fontSize: 10.5, fontWeight: 700, background: histF === k ? C.amber + "22" : C.surfaceAlt, color: histF === k ? C.amber : C.textMut } }, l))),
            (() => { const fl = [...logs].filter(l => histF === "all" || l.seance === histF).reverse().slice(0, 30); return fl.length ? fl.map(l => { return React.createElement(Card, { key: l.id },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                    React.createElement("div", null,
                        React.createElement("span", { style: { fontSize: 13, fontWeight: 800 } }, salleSeances.find(s => s.id === l.seance)?.emoji,
                            " ",
                            l.seance),
                        React.createElement("span", { style: { fontSize: 11, color: C.textMut, marginLeft: 8 } }, l.date),
                        l.deload && React.createElement("span", { style: { fontSize: 9, fontWeight: 700, color: "#4A3FCB", background: "#5B4FE022", borderRadius: 5, padding: "2px 6px", marginLeft: 6 } }, "🪶 Décharge"),
                        avgRPE(l.exercices) != null && React.createElement("span", { style: { fontSize: 9, fontWeight: 700, color: C.amber, background: C.amber + "18", borderRadius: 5, padding: "2px 6px", marginLeft: 6 } },
                            "RPE ",
                            avgRPE(l.exercices))),
                    React.createElement("button", { onClick: () => doDel(l.id), style: { background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 } }, "✕")),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, l.exercices.filter(e => e.weight > 0).map((e, i) => React.createElement("span", { key: i, style: { fontSize: 10, background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "3px 7px", color: C.text } },
                    e.nom.split(" ").slice(0, 2).join(" "),
                    " ",
                    React.createElement("b", { style: { color: C.amberLight } },
                        e.weight,
                        "kg"),
                    " ",
                    React.createElement("span", { style: { color: C.textDim } }, e.setsDetail?.length ? "(" + fmtSets(e) + ")" : e.sets + "×" + e.reps),
                    e.restSets > 0 && React.createElement("span", { style: { color: C.amber, marginLeft: 3 } },
                        "⏱",
                        e.restSets,
                        "s"),
                    e.restExo > 0 && React.createElement("span", { style: { color: C.textDim, marginLeft: 2 } },
                        "→",
                        e.restExo,
                        "s"))))); }) : React.createElement(Card, null,
                React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucune séance pour ce filtre.")); })(),
            React.createElement("button", { onClick: doReset, style: { padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.danger}44`, background: "transparent", color: C.danger, fontSize: 11, cursor: "pointer" } }, "Réinitialiser"))),
        mode === "charts" && React.createElement("div", null,
            React.createElement(Card, { style: { marginBottom: 8 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 8 } }, "Séance à analyser"),
                React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap" } }, salleSeances.map(s => React.createElement("button", { key: s.id, onClick: () => setChartSel(s.id), style: { padding: "6px 11px", borderRadius: 999, border: `2px solid ${chartSel === s.id ? s.couleur : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: chartSel === s.id ? s.couleur + "22" : C.surfaceAlt, color: chartSel === s.id ? s.couleur : C.textMut } },
                    s.emoji,
                    " ",
                    s.id)))),
            chartData.length < 2 ? React.createElement(Card, null,
                React.createElement("div", { style: { color: C.textMut, textAlign: "center", padding: 10, fontSize: 12 } },
                    "Enregistre au moins 2 séances ",
                    chartSel,
                    " pour voir la progression.")) : React.createElement(React.Fragment, null,
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: seanceInfo.couleur } },
                        "📊 Volume total — ",
                        seanceInfo.emoji,
                        " ",
                        chartSel),
                    React.createElement(ChartBar, { data: chartData, dataKey: "vol", color: seanceInfo.couleur, unit: "", height: 170 })),
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.amberLight } },
                        "🏋️ Charge max — ",
                        seanceInfo.emoji,
                        " ",
                        chartSel),
                    React.createElement(ChartLine, { data: chartData, dataKey: "charge", color: C.amberLight, unit: "kg", height: 140 }))),
            React.createElement(Card, { style: { marginTop: 8 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.amberLight } },
                    "💪 1RM estimé — ",
                    effExo || "—"),
                React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 } }, seanceInfo.exercices.map(e => React.createElement("button", { key: e.nom, onClick: () => setChartExo(e.nom), style: { padding: "5px 9px", borderRadius: 999, border: `2px solid ${effExo === e.nom ? C.amber : "transparent"}`, cursor: "pointer", fontSize: 10, fontWeight: 700, background: effExo === e.nom ? C.amber + "22" : C.surfaceAlt, color: effExo === e.nom ? C.amber : C.textMut } }, e.nom.split(" ").slice(0, 2).join(" ")))),
                rmData.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 12, textAlign: "center" } }, "2 séances avec charge + reps sur cet exercice pour estimer le 1RM (formule Epley).") : React.createElement(ChartLine, { data: rmData, dataKey: "rm", color: C.amber, unit: "kg", height: 150 }))));
}
/* ═══ HELPERS LOT 2 (recomposition) ═══ */
function movingAvg7(data) { return data.map(pt => { const end = new Date(pt.dateISO + "T12:00:00"); const start = new Date(end); start.setDate(start.getDate() - 6); const win = data.filter(p => { const d = new Date(p.dateISO + "T12:00:00"); return d >= start && d <= end; }); return Math.round(win.reduce((a, p) => a + p.kg, 0) / win.length * 10) / 10; }); }
function epley1RM(w, reps) { if (!w || !reps || reps < 1)
    return 0; return Math.round(w * (1 + reps / 30)); }
function upsertByDate(arr, entry) { return [...arr.filter(x => x.dateISO !== entry.dateISO), entry].sort((a, b) => a.dateISO.localeCompare(b.dateISO)); }
function groupPhotosByDate(idx) { const m = {}; idx.forEach(p => { (m[p.dateISO] = m[p.dateISO] || []).push(p); }); return Object.keys(m).sort((a, b) => b.localeCompare(a)).map(d => ({ dateISO: d, date: m[d][0].date, photos: m[d] })); }
const mensuresCfg = [{ k: "taille", l: "Tour de taille", emoji: "📏" }, { k: "cou", l: "Tour de cou", emoji: "🧣" }, { k: "poitrine", l: "Poitrine", emoji: "🫁" }, { k: "bras", l: "Bras", emoji: "💪" }, { k: "cuisse", l: "Cuisse", emoji: "🦵" }, { k: "hanches", l: "Hanches", emoji: "🍑" }];
const photoTypeLabel = { face: "Face", profil: "Profil", dos: "Dos" };
function compressImage(file, max, q) { max = max || 720; q = q || 0.6; return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { let w = img.width, h = img.height; if (w > h && w > max) {
    h = Math.round(h * max / w);
    w = max;
}
else if (h >= w && h > max) {
    w = Math.round(w * max / h);
    h = max;
} const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h); res(cv.toDataURL("image/jpeg", q)); }; img.onerror = rej; img.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); }); }
/* ═══ COURBE POIDS + MOYENNE 7J ═══ */
function WeightTrendChart({ data, height }) {
    height = height || 190;
    if (!data || data.length < 2)
        return null;
    const W = 320, ml = 14, mr = 16, mt = 24, mb = 26, plotW = W - ml - mr, plotBot = height - mb, plotH = plotBot - mt;
    const all = data.flatMap(d => [d.kg, d.avg]);
    let max = Math.max(...all), min = Math.min(...all);
    if (max === min) {
        max += 1;
        min -= 1;
    }
    const range = max - min;
    const n = data.length, toX = i => ml + i * plotW / (n - 1), toY = v => plotBot - (v - min) / range * plotH;
    const step = Math.ceil(n / 8);
    const ptsRaw = data.map((d, i) => `${toX(i)},${toY(d.kg)}`).join(" ");
    const ptsAvg = data.map((d, i) => `${toX(i)},${toY(d.avg)}`).join(" ");
    return React.createElement("svg", { viewBox: `0 0 ${W} ${height}`, style: { width: "100%", height: "auto", display: "block" } },
        [0, 0.5, 1].map((f, i) => { const y = plotBot - f * plotH; return React.createElement("line", { key: i, x1: ml, y1: y, x2: W - mr, y2: y, stroke: C.borderSoft, strokeWidth: 1 }); }),
        React.createElement("polyline", { points: ptsRaw, fill: "none", stroke: C.greenLight, strokeWidth: 1.5, strokeDasharray: "4 3", opacity: 0.5 }),
        data.map((d, i) => React.createElement("circle", { key: i, cx: toX(i), cy: toY(d.kg), r: 2.5, fill: C.greenLight, opacity: 0.5 })),
        React.createElement("polyline", { points: ptsAvg, fill: "none", stroke: C.green, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        data.map((d, i) => React.createElement("circle", { key: "a" + i, cx: toX(i), cy: toY(d.avg), r: 3.5, fill: C.green })),
        data.map((d, i) => (i % step === 0 || i === n - 1) ? React.createElement("text", { key: "x" + i, x: toX(i), y: height - 8, textAnchor: "middle", fontSize: 10, fill: C.textDim }, (d.date || "").split("/").slice(0, 2).join("/")) : null),
        React.createElement("text", { x: ml, y: mt - 8, fontSize: 11, fill: C.green, fontWeight: "bold" },
            Math.round(max * 10) / 10,
            "kg"),
        React.createElement("text", { x: W - mr, y: mt - 8, textAnchor: "end", fontSize: 10, fill: C.textDim },
            "min ",
            Math.round(min * 10) / 10,
            "kg"));
}
/* ═══ SUIVI CORPS (mensurations + photos) ═══ */
function navyBF(waist, neck, height) { if (!waist || !neck || !height || waist <= neck)
    return null; const bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450; return Math.round(Math.max(2, Math.min(60, bf)) * 10) / 10; }
function leanFat(weight, bf) { if (!weight || bf == null)
    return null; const fat = Math.round(weight * bf / 100 * 10) / 10; return { fat, lean: Math.round((weight - fat) * 10) / 10 }; }
function closestWeight(weighIns, dateISO) { if (!weighIns || !weighIns.length)
    return null; const t = new Date(dateISO + "T12:00:00").getTime(); let best = null, bd = Infinity; weighIns.forEach(x => { const d = Math.abs(new Date(x.dateISO + "T12:00:00").getTime() - t); if (d < bd) {
    bd = d;
    best = x;
} }); return best ? best.kg : null; }
function SuiviCorps() {
    const [sub, setSub] = useState("mens");
    const [mens, setMens] = useState([]);
    const [mLoad, setMLoad] = useState(true);
    const [selDate, setSelDate] = useState(isoToday());
    const [vals, setVals] = useState({});
    const [mSaving, setMSaving] = useState(false);
    const [mMode, setMMode] = useState("log");
    const [chartK, setChartK] = useState("taille");
    const [idx, setIdx] = useState([]);
    const [pLoad, setPLoad] = useState(true);
    const [blobs, setBlobs] = useState({});
    const [ptype, setPtype] = useState("face");
    const [pBusy, setPBusy] = useState(false);
    const [height, setHeight] = useState("");
    const [nLogs, setNLogs] = useState([]);
    const [cmpA, setCmpA] = useState("");
    const [cmpB, setCmpB] = useState("");
    useEffect(() => { Promise.all([load("taille-corps", ""), load("nutri-logs", [])]).then(([h, n]) => { setHeight((h || h === 0) && h !== "" ? String(h) : ""); setNLogs(n || []); }); }, []);
    useEffect(() => { load("mensurations", []).then(d => { setMens(d); setMLoad(false); }); }, []);
    const [pErr, setPErr] = useState("");
    const [pDate, setPDate] = useState(isoToday());
    useEffect(() => { load("photos-index", []).then(d => { setIdx(d); setPLoad(false); }); }, []);
    // Les images (lourdes) ne sont lues que quand on ouvre l'onglet Photos, une par une
    const photosRequested = useRef(false);
    useEffect(() => { if (sub !== "photos" || pLoad || photosRequested.current)
        return; photosRequested.current = true; (async () => { for (const p of idx) {
        try {
            const r = await window.storage.get("photo:" + p.id);
            if (r) {
                const data = JSON.parse(r.value);
                setBlobs(b => ({ ...b, [p.id]: data }));
            }
        }
        catch (e) { }
    } })(); }, [sub, pLoad, idx]);
    useEffect(() => { const ex = mens.find(x => x.dateISO === selDate); setVals(ex ? { ...ex.vals } : {}); }, [selDate, mens]);
    const saveMens = async () => { setMSaving(true); const clean = {}; mensuresCfg.forEach(c => { const v = parseFloat(vals[c.k]); if (!isNaN(v))
        clean[c.k] = v; }); const e = { id: Date.now(), dateISO: selDate, date: fmtDateShort(selDate), vals: clean }; const u = upsertByDate(mens, e); await save("mensurations", u); setMens(u); setMSaving(false); setMMode("history"); };
    const delMens = id => commitWithUndo("mensurations", mens, mens.filter(x => x.id !== id), setMens, "🗑️ Mesure supprimée");
    const addPhoto = async (file) => { if (!file)
        return; setPBusy(true); setPErr(""); try {
        const data = await compressImage(file);
        const id = Date.now();
        const ne = { id, dateISO: pDate, date: fmtDateShort(pDate), type: ptype };
        const ni = [...idx, ne];
        // On n'affiche la photo que si l'image ET l'index ont bien été enregistrés
        if (!(await save("photo:" + id, data)) || !(await save("photos-index", ni))) {
            try {
                await window.storage.delete("photo:" + id);
            }
            catch (e) { }
            setPErr("❌ Photo non enregistrée : espace de stockage plein ou refusé. Exporte tes données puis supprime d'anciennes photos.");
        }
        else {
            setIdx(ni);
            setBlobs(b => ({ ...b, [id]: data }));
        }
    }
    catch (e) {
        console.error(e);
        setPErr("❌ Impossible de lire cette image.");
    } setPBusy(false); };
    /* Suppression avec « Annuler » : l'image reste en mémoire quelques secondes pour être restaurée */
    const delPhoto = async (id) => { const data = blobs[id], prevIdx = idx; try {
        await window.storage.delete("photo:" + id);
    }
    catch (e) { } const ni = idx.filter(p => p.id !== id); await save("photos-index", ni); setIdx(ni); setBlobs(b => { const n = { ...b }; delete n[id]; return n; }); toast("🗑️ Photo supprimée", { undo: data ? async () => { if (await save("photo:" + id, data) && await save("photos-index", prevIdx)) {
            setIdx(prevIdx);
            setBlobs(b => ({ ...b, [id]: data }));
            toast("↩️ Photo restaurée");
        } } : null }); };
    const chartData = mens.filter(m => m.vals[chartK] != null).map(m => ({ date: m.date, v: m.vals[chartK] }));
    const saveHeight = async (v) => { setHeight(v); await save("taille-corps", parseFloat(v) || 0); };
    const heightN = parseFloat(height) || 0;
    const weighIns = nLogs.filter(l => l.weight > 0).map(l => ({ dateISO: l.dateISO, kg: l.weight })).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const compoPoints = mens.filter(m => m.vals.taille > 0 && m.vals.cou > 0).map(m => { const bf = navyBF(m.vals.taille, m.vals.cou, heightN); const w = closestWeight(weighIns, m.dateISO); const lf = (w && bf != null) ? leanFat(w, bf) : null; return { date: m.date, dateISO: m.dateISO, bf, weight: w, lean: lf ? lf.lean : null, fat: lf ? lf.fat : null }; });
    const lastCompo = compoPoints.length ? compoPoints[compoPoints.length - 1] : null;
    const leanChart = compoPoints.filter(p => p.lean != null).map(p => ({ date: p.date, v: p.lean }));
    const bfChart = compoPoints.filter(p => p.bf != null).map(p => ({ date: p.date, v: p.bf }));
    const grouped = groupPhotosByDate(idx);
    if (mLoad || pLoad)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } },
            React.createElement(Pill, { active: sub === "mens", onClick: () => setSub("mens"), color: C.green }, "📐 Mensurations"),
            React.createElement(Pill, { active: sub === "compo", onClick: () => setSub("compo"), color: C.green }, "🔬 Composition"),
            React.createElement(Pill, { active: sub === "photos", onClick: () => setSub("photos"), color: C.green }, "📸 Photos")),
        sub === "mens" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" } }, [["log", "📝 Saisie"], ["history", "📋 Historique"], ["charts", "📈 Courbes"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mMode === k, onClick: () => setMMode(k), color: C.green }, l))),
            mMode === "log" && React.createElement("div", null,
                React.createElement(DateNav, { value: selDate, onChange: setSelDate, color: C.green }),
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 2 } }, "📐 Mensurations (cm)"),
                    React.createElement("div", { style: { fontSize: 10, color: C.textMut, marginBottom: 6 } }, "Toutes les 2-4 semaines, à jeun, au même moment."),
                    mensuresCfg.map(c => { return React.createElement("div", { key: c.k, style: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.borderSoft}` } },
                        React.createElement("span", { style: { fontSize: 15, width: 22 } }, c.emoji),
                        React.createElement("div", { style: { flex: 1, fontSize: 12.5 } }, c.l),
                        React.createElement("input", { type: "number", inputMode: "decimal", step: "0.1", value: vals[c.k] ?? "", onChange: e => setVals(p => ({ ...p, [c.k]: e.target.value })), placeholder: "—", style: { ...inputStyle, width: 90, textAlign: "right" } }),
                        React.createElement("span", { style: { fontSize: 11, color: C.textMut, width: 16 } }, "cm")); })),
                React.createElement("button", { onClick: saveMens, disabled: mSaving, style: { width: "100%", padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.green, color: "#04130B", fontSize: 13, fontWeight: 800, opacity: mSaving ? .6 : 1 } }, mSaving ? "Enregistrement…" : (mens.some(x => x.dateISO === selDate) ? "Mettre à jour" : "Enregistrer"))),
            mMode === "history" && React.createElement("div", null, !mens.length ? React.createElement(Card, null,
                React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucune mesure.")) : [...mens].reverse().map(m => React.createElement(Card, { key: m.id },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 700 } }, m.date),
                    React.createElement("button", { onClick: () => delMens(m.id), style: { background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 } }, "✕")),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, mensuresCfg.filter(c => m.vals[c.k] != null).map(c => React.createElement("span", { key: c.k, style: { fontSize: 10, background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "3px 7px" } },
                    c.emoji,
                    " ",
                    React.createElement("b", { style: { color: C.greenLight } },
                        m.vals[c.k],
                        "cm"))))))),
            mMode === "charts" && React.createElement("div", null,
                React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 } }, mensuresCfg.map(c => React.createElement("button", { key: c.k, onClick: () => setChartK(c.k), style: { padding: "6px 11px", borderRadius: 999, border: `2px solid ${chartK === c.k ? C.green : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, background: chartK === c.k ? C.green + "22" : C.surfaceAlt, color: chartK === c.k ? C.green : C.textMut } },
                    c.emoji,
                    " ",
                    c.l))),
                React.createElement(Card, null, chartData.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } }, "2 mesures minimum pour cette zone.") : React.createElement(ChartLine, { data: chartData, dataKey: "v", color: C.greenLight, unit: "cm", height: 170 })))),
        sub === "compo" && React.createElement("div", null,
            React.createElement(Card, null,
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700 } }, "📐 Ta taille"),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, "Nécessaire pour l'estimation (à saisir une fois).")),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                        React.createElement("input", { type: "number", inputMode: "decimal", value: height, onChange: e => saveHeight(e.target.value), placeholder: "178", style: { ...inputStyle, width: 80, textAlign: "right" } }),
                        React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, "cm")))),
            !heightN ? React.createElement(Card, null,
                React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12, fontSize: 12 } }, "Renseigne ta taille ci-dessus pour activer l'estimation."))
                : !lastCompo ? React.createElement(Card, null,
                    React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12, fontSize: 12 } },
                        "Ajoute une mesure avec ",
                        React.createElement("b", { style: { color: C.text } }, "tour de taille"),
                        " + ",
                        React.createElement("b", { style: { color: C.text } }, "tour de cou"),
                        " (onglet 📐 Mensurations) pour estimer ta composition."))
                    : React.createElement("div", null,
                        React.createElement(Card, { border: C.green + "44" },
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.greenLight, marginBottom: 2 } }, "🔬 Estimation actuelle"),
                            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginBottom: 10 } },
                                "Méthode Navy · ",
                                lastCompo.date,
                                lastCompo.weight ? " · " + lastCompo.weight + " kg" : ""),
                            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } },
                                React.createElement("div", { style: { textAlign: "center" } },
                                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.green } },
                                        lastCompo.bf,
                                        "%"),
                                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "% masse grasse")),
                                React.createElement("div", { style: { textAlign: "center" } },
                                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.greenLight } }, lastCompo.lean != null ? lastCompo.lean : "—"),
                                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Masse maigre (kg)")),
                                React.createElement("div", { style: { textAlign: "center" } },
                                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.gluc } }, lastCompo.fat != null ? lastCompo.fat : "—"),
                                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Masse grasse (kg)"))),
                            lastCompo.weight == null && React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginTop: 8 } }, "Ajoute une pesée dans Nutrition pour obtenir les masses en kg.")),
                        leanChart.length >= 2 && React.createElement(Card, null,
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.greenLight, marginBottom: 8 } }, "📈 Masse maigre (kg) — le vrai signal recomp"),
                            React.createElement(ChartLine, { data: leanChart, dataKey: "v", color: C.greenLight, unit: "kg", height: 160 })),
                        bfChart.length >= 2 && React.createElement(Card, null,
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 } }, "📉 % masse grasse"),
                            React.createElement(ChartLine, { data: bfChart, dataKey: "v", color: C.green, unit: "%", height: 150 })),
                        React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, padding: "4px 4px 0", lineHeight: 1.5 } },
                            "Estimation indicative (±3-4 %). L'important n'est pas la valeur absolue mais la ",
                            React.createElement("b", { style: { color: C.textMut } }, "tendance"),
                            " : masse maigre qui monte / masse grasse qui descend = recomp réussie."))),
        sub === "photos" && React.createElement("div", null,
            idx.length >= 2 && React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 8 } }, "🆚 Comparer avant / après"),
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
                    React.createElement("select", { value: cmpA, onChange: e => setCmpA(e.target.value), style: { ...inputStyle, flex: 1, fontSize: 11 } },
                        React.createElement("option", { value: "" }, "Photo A…"),
                        idx.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(p => React.createElement("option", { key: p.id, value: p.id },
                            p.date,
                            " · ",
                            photoTypeLabel[p.type] || p.type))),
                    React.createElement("select", { value: cmpB, onChange: e => setCmpB(e.target.value), style: { ...inputStyle, flex: 1, fontSize: 11 } },
                        React.createElement("option", { value: "" }, "Photo B…"),
                        idx.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(p => React.createElement("option", { key: p.id, value: p.id },
                            p.date,
                            " · ",
                            photoTypeLabel[p.type] || p.type)))),
                (cmpA || cmpB) && React.createElement("div", { style: { display: "flex", gap: 8 } }, [cmpA, cmpB].map((cid, i) => { const p = idx.find(x => String(x.id) === String(cid)); return React.createElement("div", { key: i, style: { flex: 1 } },
                    p && blobs[p.id] ? React.createElement("img", { src: blobs[p.id], alt: "", style: { width: "100%", borderRadius: 10, border: `1px solid ${C.border}` } }) : React.createElement("div", { style: { width: "100%", height: 160, borderRadius: 10, background: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.textDim } }, i === 0 ? "Photo A" : "Photo B"),
                    p && React.createElement("div", { style: { fontSize: 10, color: C.textMut, textAlign: "center", marginTop: 4 } },
                        p.date,
                        " · ",
                        photoTypeLabel[p.type] || p.type)); }))),
            React.createElement(Card, null,
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 } },
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 800 } }, "📸 Nouvelle photo"),
                    React.createElement("input", { type: "date", value: pDate, max: isoToday(), onChange: e => e.target.value && setPDate(e.target.value), style: { ...inputStyle, width: 150, padding: "6px 8px", fontSize: 12, colorScheme: "light" } })),
                React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10 } }, [["face", "Face"], ["profil", "Profil"], ["dos", "Dos"]].map(([k, l]) => React.createElement("button", { key: k, onClick: () => setPtype(k), style: { flex: 1, padding: "7px 0", borderRadius: 9, border: `2px solid ${ptype === k ? C.green : "transparent"}`, cursor: "pointer", fontSize: 12, fontWeight: 700, background: ptype === k ? C.green + "22" : C.surfaceAlt, color: ptype === k ? C.green : C.textMut } }, l))),
                React.createElement("label", { style: { display: "block", width: "100%", padding: "11px 0", borderRadius: 12, background: C.green, color: "#04130B", fontSize: 13, fontWeight: 800, textAlign: "center", cursor: "pointer", opacity: pBusy ? .6 : 1 } },
                    pBusy ? "Compression…" : "📷 Ajouter (" + photoTypeLabel[ptype] + ")",
                    React.createElement("input", { type: "file", accept: "image/*", capture: "environment", style: { display: "none" }, onChange: e => { addPhoto(e.target.files && e.target.files[0]); e.target.value = ""; } })),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginTop: 8 } }, "Compressées et stockées sur ton appareil. Garde le même cadrage et la même lumière."),
                pErr && React.createElement("div", { style: { fontSize: 11, color: C.danger, marginTop: 8, fontWeight: 700 } }, pErr)),
            !grouped.length ? React.createElement(Card, null,
                React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucune photo.")) : grouped.map(g => React.createElement(Card, { key: g.dateISO },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.greenLight, marginBottom: 8 } }, g.date),
                React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, g.photos.map(p => React.createElement("div", { key: p.id, style: { position: "relative" } },
                    blobs[p.id] ? React.createElement("img", { src: blobs[p.id], alt: p.type, style: { width: 90, height: 120, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` } }) : React.createElement("div", { style: { width: 90, height: 120, borderRadius: 10, background: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.textDim } }, "…"),
                    React.createElement("div", { style: { position: "absolute", bottom: 4, left: 4, fontSize: 9, fontWeight: 700, color: "#fff", background: "#000000AA", borderRadius: 5, padding: "1px 5px" } }, photoTypeLabel[p.type] || p.type),
                    React.createElement("button", { onClick: () => delPhoto(p.id), style: { position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, border: "none", background: "#000000AA", color: C.danger, cursor: "pointer", fontSize: 12, lineHeight: 1 } }, "✕"))))))));
}
/* ═══ HELPERS LOT 4 (nutrition) ═══ */
const foodDB = [
    { nom: "Blancs d'œufs", cat: "prot", p: 11, g: 0.7, l: 0.2, kcal: 52 }, { nom: "Poulet/dinde", cat: "prot", p: 31, g: 0, l: 3.6, kcal: 165 }, { nom: "Cabillaud/thon", cat: "prot", p: 24, g: 0, l: 1, kcal: 110 }, { nom: "Fromage blanc 0%", cat: "prot", p: 8, g: 4, l: 0.2, kcal: 50 }, { nom: "Whey (poudre)", cat: "prot", p: 80, g: 8, l: 6, kcal: 390 }, { nom: "Lentilles cuites", cat: "prot", p: 9, g: 20, l: 0.4, kcal: 116 },
    { nom: "Avoine", cat: "gluc", p: 13, g: 60, l: 7, kcal: 370 }, { nom: "Patate douce", cat: "gluc", p: 1.6, g: 20, l: 0.1, kcal: 86 }, { nom: "Quinoa cuit", cat: "gluc", p: 4.4, g: 21, l: 1.9, kcal: 120 }, { nom: "Riz cuit", cat: "gluc", p: 2.7, g: 28, l: 0.3, kcal: 130 }, { nom: "Haricots rouges cuits", cat: "gluc", p: 9, g: 22, l: 0.5, kcal: 127 }, { nom: "Banane", cat: "gluc", p: 1.1, g: 23, l: 0.3, kcal: 89 },
    { nom: "Huile d'olive", cat: "lip", p: 0, g: 0, l: 100, kcal: 884 }, { nom: "Huile de colza", cat: "lip", p: 0, g: 0, l: 100, kcal: 884 }, { nom: "Graines de chia", cat: "lip", p: 17, g: 42, l: 31, kcal: 486 }, { nom: "Noix de cajou", cat: "lip", p: 18, g: 30, l: 44, kcal: 553 }, { nom: "Amandes", cat: "lip", p: 21, g: 22, l: 49, kcal: 579 }, { nom: "Jaunes d'œufs", cat: "lip", p: 16, g: 3.6, l: 27, kcal: 322 },
    { nom: "Œufs entiers", cat: "prot", p: 13, g: 1.1, l: 11, kcal: 155 }, { nom: "Saumon", cat: "prot", p: 20, g: 0, l: 13, kcal: 208 }, { nom: "Bœuf haché 5%", cat: "prot", p: 21, g: 0, l: 5, kcal: 137 }, { nom: "Skyr nature", cat: "prot", p: 11, g: 4, l: 0.2, kcal: 63 }, { nom: "Thon en boîte (naturel)", cat: "prot", p: 26, g: 0, l: 1, kcal: 116 }, { nom: "Jambon blanc", cat: "prot", p: 21, g: 1, l: 3, kcal: 115 },
    { nom: "Pâtes cuites", cat: "gluc", p: 5.8, g: 30, l: 0.9, kcal: 158 }, { nom: "Pain complet", cat: "gluc", p: 9, g: 41, l: 3.4, kcal: 247 }, { nom: "Galette wrap", cat: "gluc", p: 8.5, g: 50, l: 7, kcal: 310 }, { nom: "Pomme de terre cuite", cat: "gluc", p: 2, g: 17, l: 0.1, kcal: 77 }, { nom: "Pomme", cat: "gluc", p: 0.3, g: 14, l: 0.2, kcal: 52 }, { nom: "Fruits rouges", cat: "gluc", p: 1, g: 10, l: 0.3, kcal: 50 }, { nom: "Lait demi-écrémé", cat: "gluc", p: 3.3, g: 4.8, l: 1.6, kcal: 46 },
    { nom: "Avocat", cat: "lip", p: 2, g: 9, l: 15, kcal: 160 }, { nom: "Cheddar", cat: "lip", p: 25, g: 1.3, l: 33, kcal: 403 }, { nom: "Beurre de cacahuète", cat: "lip", p: 25, g: 20, l: 50, kcal: 588 },
];
const catMacro = { prot: "p", gluc: "g", lip: "l" };
const catLabel = { prot: "Protéines", gluc: "Glucides", lip: "Lipides" };
function swapEquivalents(db, foodNom, grams) { const src = db.find(f => f.nom === foodNom); if (!src || !grams || isNaN(grams))
    return null; const mk = catMacro[src.cat]; const target = src[mk] * grams / 100; const list = db.filter(f => f.cat === src.cat && f.nom !== foodNom && f[mk] > 0).map(f => { const g = target / f[mk] * 100; return { nom: f.nom, grams: Math.round(g), p: Math.round(f.p * g / 100), gl: Math.round(f.g * g / 100), l: Math.round(f.l * g / 100), kcal: Math.round(f.kcal * g / 100) }; }); return { src, mk, target: Math.round(target * 10) / 10, list }; }
/* ═══ ÉQUIVALENCES ALIMENTAIRES ═══ */
function FoodSwap() {
    const [open, setOpen] = useState(false);
    const [food, setFood] = useState(foodDB[0].nom);
    const [grams, setGrams] = useState("100");
    const gNum = parseFloat(grams);
    const r = swapEquivalents(foodDB, food, gNum);
    return React.createElement(Card, { border: C.green + "33" },
        React.createElement("button", { onClick: () => setOpen(v => !v), style: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: C.green, fontSize: 13, fontWeight: 800, padding: 0 } },
            React.createElement("span", null, "🔄 Équivalences (mêmes macros)"),
            React.createElement("span", null, open ? "▲" : "▼")),
        open && React.createElement("div", { style: { marginTop: 10 } },
            React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
                React.createElement("div", { style: { flex: 2 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Aliment"),
                    React.createElement("select", { value: food, onChange: e => setFood(e.target.value), style: { ...inputStyle, fontSize: 13 } }, ["prot", "gluc", "lip"].map(cat => React.createElement("optgroup", { key: cat, label: catLabel[cat] }, foodDB.filter(f => f.cat === cat).map(f => React.createElement("option", { key: f.nom, value: f.nom }, f.nom)))))),
                React.createElement("div", { style: { width: 90 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Quantité (g)"),
                    React.createElement("input", { type: "number", inputMode: "numeric", value: grams, onChange: e => setGrams(e.target.value), style: inputStyle, placeholder: "100" }))),
            r ? React.createElement(React.Fragment, null,
                React.createElement("div", { style: { fontSize: 10, color: C.textMut, marginBottom: 8 } },
                    gNum,
                    "g de ",
                    r.src.nom,
                    " ≈ ",
                    React.createElement("b", { style: { color: C.greenLight } },
                        r.target,
                        "g de ",
                        catLabel[r.src.cat].toLowerCase()),
                    " · ",
                    Math.round(r.src.p * gNum / 100),
                    "P/",
                    Math.round(r.src.g * gNum / 100),
                    "G/",
                    Math.round(r.src.l * gNum / 100),
                    "L"),
                r.list.map((x, i) => React.createElement("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700 } }, x.nom),
                        React.createElement("div", { style: { fontSize: 9.5, color: C.textDim } },
                            x.p,
                            "P · ",
                            x.gl,
                            "G · ",
                            x.l,
                            "L · ",
                            x.kcal,
                            "kcal")),
                    React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.greenLight } },
                        x.grams,
                        React.createElement("span", { style: { fontSize: 10, color: C.textMut } }, "g")))),
                React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 8, fontStyle: "italic" } }, "Valeurs ~/100g approximatives, équivalence sur le macro dominant.")) : React.createElement("div", { style: { fontSize: 11, color: C.textDim } }, "Entre une quantité.")));
}
/* ═══ SUIVI NUTRITION ═══ */
function SuiviNutrition() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState("log");
    const [meals, setMeals] = useState({});
    const [weight, setWeight] = useState("");
    const [saving, setSaving] = useState(false);
    const [selDate, setSelDate] = useState(isoToday());
    const [supps, setSupps] = useState({});
    const [water, setWater] = useState(0);
    const [sleep, setSleep] = useState("");
    const [stress, setStress] = useState(5);
    useEffect(() => { load("nutri-logs", []).then(d => { setLogs(d); setLoading(false); }); }, []);
    useEffect(() => bus.on("stored:nutri-logs", d => setLogs(d || [])), []); // synchro avec l'affiche « aujourd'hui »
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [sLogsN] = useStored("sport-logs", []);
    const [dayType, setDayType] = useState("training");
    const plannedType = d => sessionForDate(d, resolveProgramme(profile, sLogsN)) ? "training" : "rest";
    useEffect(() => { const ex = logs.find(l => l.dateISO === selDate); setMeals(ex ? { ...ex.meals } : {}); setWeight(ex && ex.weight != null ? String(ex.weight) : ""); setSupps(ex ? { ...(ex.supps || {}) } : {}); setWater((ex?.water) || 0); setSleep(ex && ex.sleep != null ? String(ex.sleep) : ""); setStress(ex && ex.stress != null ? ex.stress : 5); setDayType(ex?.dayType || plannedType(selDate)); }, [selDate, logs, profile, sLogsN]);
    const selLabel = fmtDateShort(selDate);
    const toggle = id => setMeals(p => ({ ...p, [id]: !p[id] }));
    /* Checklist = repas réellement prévus ce jour-là (7 en entraînement, 5 en repos), aux heures du profil */
    const dayMeals = dayPlan(dayType, profile).meals.map(m => ({ id: MEAL_ID[m.m], label: m.m + (m.altLabel ? " · " + m.altLabel : ""), h: m.h, icon: mealIcons[MEAL_ID[m.m]] })).filter(m => m.id);
    const dayIds = dayMeals.map(m => m.id);
    const logIds = l => l.dayType ? dayPlan(l.dayType, profile).meals.map(m => MEAL_ID[m.m]).filter(Boolean) : mealIds;
    const doSave = async () => { setSaving(true); const clean = Object.fromEntries(dayIds.map(id => [id, !!meals[id]])); const ok = dayIds.filter(id => meals[id]).length; const e = { id: Date.now(), date: selLabel, dateISO: selDate, dayType, meals: clean, mealsOk: ok, mealsTotal: dayIds.length, compliance: Math.round(ok / dayIds.length * 100), weight: parseFloat(String(weight).replace(",", ".")) || null, supps: { ...supps }, water, sleep: parseFloat(String(sleep).replace(",", ".")) || null, stress }; const u = [...logs.filter(l => l.dateISO !== selDate), e]; const okSave = await save("nutri-logs", u); setSaving(false); if (!okSave)
        return toast("❌ Journée non enregistrée", { tone: "danger" }); setLogs(u); toast("✅ Journée du " + selLabel + " enregistrée · " + e.compliance + " %"); setMode("history"); };
    const doDel = id => commitWithUndo("nutri-logs", logs, logs.filter(l => l.id !== id), setLogs, "🗑️ Journée supprimée");
    const doReset = () => resetWithConfirm("nutri-logs", logs, setLogs, "journées de suivi nutrition");
    const weightData = logs.filter(l => l.weight).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ date: l.date, dateISO: l.dateISO, kg: l.weight }));
    const wAvg = movingAvg7(weightData);
    const weightTrend = weightData.map((d, i) => ({ ...d, avg: wAvg[i] }));
    const compData = [...logs].sort((a, b) => a.dateISO.localeCompare(b.dateISO)).slice(-30).map(l => ({ date: l.date, pct: l.compliance }));
    const sleepData = logs.filter(l => l.sleep != null).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ date: l.date, h: l.sleep }));
    const stressData = logs.filter(l => l.stress != null).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ date: l.date, s: l.stress }));
    const last7 = logs.filter(l => withinDays(l.dateISO, 7));
    const avgC = last7.length ? Math.round(last7.reduce((a, l) => a + l.compliance, 0) / last7.length) : 0;
    const latW = weightData.length ? weightData[weightData.length - 1].kg : null;
    const fstW = weightData.length ? weightData[0].kg : null;
    const diffW = latW && fstW ? (latW - fstW).toFixed(1) : null;
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } }, [["log", "📝 Saisie"], ["history", "📋 Historique"], ["charts", "📈 Graphiques"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mode === k, onClick: () => setMode(k), color: C.green }, l))),
        mode === "log" && React.createElement("div", null,
            React.createElement(DateNav, { value: selDate, onChange: setSelDate, color: C.green }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, marginBottom: 2 } }, "📋 Repas du jour"),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, margin: "4px 0 12px" } },
                    [["training", "🏋️ Entraînement"], ["rest", "🛌 Repos"]].map(([k, lb]) => React.createElement("button", { key: k, onClick: () => setDayType(k), style: { flex: 1, padding: "7px 0", borderRadius: 9, border: `2px solid ${dayType === k ? C.green : "transparent"}`, background: dayType === k ? C.green + "22" : C.surfaceAlt, color: dayType === k ? C.green : C.textMut, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, lb, plannedType(selDate) === k ? " · prévu" : ""))),
                dayMeals.map(({ id, label, h, icon }) => React.createElement("div", { key: id, onClick: () => toggle(id), style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("div", { style: { width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${meals[id] ? C.green : C.borderSoft}`, background: meals[id] ? C.green + "22" : "transparent", fontSize: 13 } }, meals[id] ? "✓" : ""),
                    React.createElement("span", { style: { fontSize: 15 } }, mealIcons[id]),
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 12.5, fontWeight: meals[id] ? 700 : 400, color: meals[id] ? C.text : C.textMut } }, label),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, h)))),
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 } },
                    React.createElement("span", { style: { fontSize: 11, color: C.greenLight, fontWeight: 700 } }, dayIds.filter(id => meals[id]).length + "/" + dayIds.length),
                    React.createElement("button", { onClick: () => setMeals(Object.fromEntries(dayIds.map(id => [id, true]))), style: { border: "none", background: "transparent", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer" } }, "✓ Tout cocher"))),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, marginBottom: 2 } }, "⚖️ Pesée"),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
                    React.createElement("input", { type: "number", inputMode: "decimal", step: "0.1", value: weight, onChange: e => setWeight(e.target.value), placeholder: "129.5", style: { ...inputStyle, width: 130, fontSize: 16, fontWeight: 700 } }),
                    React.createElement("span", { style: { color: C.textMut } }, "kg"))),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, marginBottom: 2 } }, "💊 Compléments"),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 4 } }, "Pris aujourd'hui"),
                complements.map(c => { const on = !!supps[c.n]; return React.createElement("div", { key: c.n, onClick: () => setSupps(p => ({ ...p, [c.n]: !p[c.n] })), style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("div", { style: { width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${on ? C.green : C.borderSoft}`, background: on ? C.green + "22" : "transparent", fontSize: 12 } }, on ? "✓" : ""),
                    React.createElement("span", { style: { fontSize: 15 } }, c.emoji),
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 12.5, fontWeight: on ? 700 : 400, color: on ? C.text : C.textMut } }, c.n),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, c.quand))); })),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, marginBottom: 12 } }, "🌿 Bien-être"),
                React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700 } }, "💧 Hydratation"),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, "verres ~250ml (objectif ~10)")),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                        React.createElement("button", { onClick: () => setWater(w => Math.max(0, w - 1)), style: { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 16, cursor: "pointer" } }, "−"),
                        React.createElement("span", { style: { fontSize: 18, fontWeight: 800, color: C.blue, minWidth: 24, textAlign: "center" } }, water),
                        React.createElement("button", { onClick: () => setWater(w => w + 1), style: { width: 30, height: 30, borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontSize: 16, cursor: "pointer" } }, "+"))),
                React.createElement("div", { style: { borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12, marginBottom: 14 } },
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                        React.createElement("div", { style: { flex: 1, fontSize: 12.5, fontWeight: 700 } }, "😴 Sommeil"),
                        React.createElement("input", { type: "number", inputMode: "decimal", step: "0.5", value: sleep, onChange: e => setSleep(e.target.value), placeholder: "7.5", style: { ...inputStyle, width: 90, textAlign: "right" } }),
                        React.createElement("span", { style: { fontSize: 11, color: C.textMut, width: 16 } }, "h"))),
                React.createElement("div", { style: { borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12 } },
                    React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700, marginBottom: 6 } },
                        "😰 Stress : ",
                        React.createElement("b", { style: { color: stress <= 3 ? C.green : stress <= 6 ? C.gluc : C.danger } },
                            stress,
                            "/10")),
                    React.createElement("input", { type: "range", min: 1, max: 10, value: stress, onChange: e => setStress(parseInt(e.target.value)), style: { width: "100%", accentColor: stress <= 3 ? C.green : stress <= 6 ? C.gluc : C.danger } }))),
            React.createElement("button", { onClick: doSave, disabled: saving, style: { width: "100%", padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.green, color: "#04130B", fontSize: 13, fontWeight: 800, opacity: saving ? .6 : 1 } }, saving ? "Enregistrement…" : (logs.some(l => l.dateISO === selDate) ? "Mettre à jour la journée" : "Enregistrer la journée"))),
        mode === "history" && React.createElement("div", null, !logs.length ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucune journée.")) : React.createElement(React.Fragment, null,
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 } },
                React.createElement(Card, { style: { marginBottom: 0 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.greenLight } },
                        avgC,
                        "%"),
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Compliance 7j")),
                React.createElement(Card, { style: { marginBottom: 0 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.prot } }, latW || "—"),
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Dernier poids")),
                React.createElement(Card, { style: { marginBottom: 0 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: diffW && parseFloat(diffW) < 0 ? C.green : diffW ? C.gluc : C.textDim } }, diffW ? (parseFloat(diffW) > 0 ? "+" : "") + diffW : "—"),
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Évolution"))),
            [...logs].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, 30).map(l => React.createElement(Card, { key: l.id },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                    React.createElement("div", null,
                        React.createElement("span", { style: { fontSize: 13, fontWeight: 700 } }, l.date),
                        React.createElement("span", { style: { fontSize: 11, color: l.compliance >= 80 ? C.green : l.compliance >= 50 ? C.gluc : C.danger, marginLeft: 8, fontWeight: 700 } },
                            l.compliance,
                            "%"),
                        l.weight && React.createElement("span", { style: { fontSize: 11, color: C.prot, marginLeft: 8 } },
                            l.weight,
                            "kg")),
                    React.createElement("button", { onClick: () => doDel(l.id), style: { background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 } }, "✕")),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 } }, l.dayType && React.createElement("span", { style: { fontSize: 10, padding: "3px 6px", color: C.textDim } }, l.dayType === "rest" ? "🛌" : "🏋️"), logIds(l).map(id => React.createElement("span", { key: id, style: { fontSize: 10, borderRadius: 6, padding: "3px 6px", background: l.meals[id] ? C.green + "22" : C.surfaceAlt, color: l.meals[id] ? C.green : C.textDim, border: `1px solid ${l.meals[id] ? C.green + "44" : C.borderSoft}` } },
                    mealIcons[id],
                    l.meals[id] ? "✓" : "✗"))),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, fontSize: 10, color: C.textMut } },
                    l.supps && Object.keys(l.supps).length > 0 && React.createElement("span", null,
                        "💊 ",
                        complements.filter(c => l.supps[c.n]).length,
                        "/",
                        complements.length),
                    l.water > 0 && React.createElement("span", null,
                        "💧 ",
                        l.water),
                    l.sleep != null && React.createElement("span", null,
                        "😴 ",
                        l.sleep,
                        "h"),
                    l.stress != null && React.createElement("span", null,
                        "😰 ",
                        l.stress,
                        "/10")))),
            React.createElement("button", { onClick: doReset, style: { padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.danger}44`, background: "transparent", color: C.danger, fontSize: 11, cursor: "pointer" } }, "Réinitialiser"))),
        mode === "charts" && React.createElement("div", null,
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 4 } }, "⚖️ Courbe de poids"),
                React.createElement("div", { style: { display: "flex", gap: 12, fontSize: 9.5, marginBottom: 8 } },
                    React.createElement("span", { style: { color: C.greenLight } }, "┄ pesées"),
                    React.createElement("span", { style: { color: C.green, fontWeight: 700 } }, "━ moyenne 7j")),
                weightData.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } }, "2 pesées min.") : React.createElement(WeightTrendChart, { data: weightTrend, height: 180 })),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 10 } }, "📊 Compliance 30j"),
                compData.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } }, "2 jours min.") : React.createElement(ChartBar, { data: compData, dataKey: "pct", color: C.green, unit: "%", height: 180 })),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 10 } }, "😴 Sommeil (h)"),
                sleepData.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } }, "2 nuits min.") : React.createElement(ChartLine, { data: sleepData, dataKey: "h", color: C.blue, unit: "h", height: 150 })),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 10 } }, "😰 Stress (/10)"),
                stressData.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } }, "2 jours min.") : React.createElement(ChartLine, { data: stressData, dataKey: "s", color: C.gluc, unit: "", height: 150 }))));
}
/* ═══ SUIVI BUDGET ═══ */
function SuiviBudget() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState("log");
    const [selProd, setSelProd] = useState(budgetAliments[0].id);
    const [prix, setPrix] = useState("");
    const [poids, setPoids] = useState("");
    const [saving, setSaving] = useState(false);
    const [chartProd, setChartProd] = useState("");
    const [selDate, setSelDate] = useState(isoToday());
    useEffect(() => { load("budget-logs", []).then(d => { setLogs(d); setLoading(false); }); }, []);
    const doSave = async () => { setSaving(true); const e = { id: Date.now(), date: fmtDateShort(selDate), dateISO: selDate, prodId: selProd, prodNom: budgetAliments.find(a => a.id === selProd)?.nom, prix: parseFloat(prix) || 0, poids: parseFloat(poids) || 0, prixKg: poids && prix ? Math.round(parseFloat(prix) / parseFloat(poids) * 1000 * 100) / 100 : 0 }; const u = [...logs, e]; await save("budget-logs", u); setLogs(u); setPrix(""); setPoids(""); setSaving(false); setMode("history"); };
    const doDel = id => commitWithUndo("budget-logs", logs, logs.filter(l => l.id !== id), setLogs, "🗑️ Achat supprimé");
    const doReset = () => resetWithConfirm("budget-logs", logs, setLogs, "achats enregistrés");
    // Prix moyen par produit
    const avgPrices = {};
    budgetAliments.forEach(a => { const entries = logs.filter(l => l.prodId === a.id && l.prixKg > 0); if (entries.length)
        avgPrices[a.id] = Math.round(entries.reduce((s, e) => s + e.prixKg, 0) / entries.length * 100) / 100; });
    // Recalcul total semaine avec prix réels
    const realTotal = budgetAliments.reduce((s, a) => { if (avgPrices[a.id] && a.prixKg) {
        const ratio = avgPrices[a.id] / a.prixKg;
        return s + a.sem * ratio;
    } return s + a.sem; }, 0);
    // Chart data par produit
    const prodsWithData = [...new Set(logs.filter(l => l.prixKg > 0).map(l => l.prodId))];
    const chartD = logs.filter(l => l.prodId === chartProd && l.prixKg > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ date: l.date, eur: l.prixKg }));
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } }, [["log", "📝 Saisie"], ["history", "📋 Historique"], ["charts", "📈 Tendances"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mode === k, onClick: () => setMode(k), color: C.budget }, l))),
        mode === "log" && React.createElement("div", null,
            React.createElement(DateNav, { value: selDate, onChange: setSelDate, color: C.budget }),
            Object.keys(avgPrices).length > 0 && React.createElement(Card, { border: C.budget + "44" },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                    React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: C.budget } }, "💰 Total semaine recalculé"),
                    React.createElement("span", { style: { fontSize: 18, fontWeight: 800, color: C.budgetLight } },
                        "~",
                        Math.round(realTotal),
                        " €")),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginTop: 4 } },
                    "Basé sur tes prix réels vs estimation ",
                    TOTAL_SEM,
                    " €")),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, marginBottom: 10 } }, "🛒 Enregistrer un achat"),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Produit"),
                React.createElement("select", { value: selProd, onChange: e => setSelProd(e.target.value), style: { ...inputStyle, fontSize: 13, marginBottom: 10 } }, budgetAliments.map(a => React.createElement("option", { key: a.id, value: a.id },
                    a.emoji,
                    " ",
                    a.nom))),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Prix payé (€)"),
                        React.createElement("input", { type: "number", inputMode: "decimal", step: "0.01", value: prix, onChange: e => setPrix(e.target.value), style: inputStyle, placeholder: "4.50" })),
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Poids (g)"),
                        React.createElement("input", { type: "number", inputMode: "decimal", value: poids, onChange: e => setPoids(e.target.value), style: inputStyle, placeholder: "500" }))),
                prix && poids && parseFloat(poids) > 0 && React.createElement("div", { style: { marginTop: 8, fontSize: 12, color: C.budgetLight, fontWeight: 700 } },
                    "= ",
                    (parseFloat(prix) / parseFloat(poids) * 1000).toFixed(2),
                    " €/kg"),
                React.createElement("button", { onClick: doSave, disabled: saving || !prix || !poids, style: { width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.budget, color: "#fff", fontSize: 13, fontWeight: 800, opacity: saving || !prix || !poids ? .5 : 1 } }, "Enregistrer"))),
        mode === "history" && React.createElement("div", null, !logs.length ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucun achat.")) : React.createElement(React.Fragment, null,
            Object.keys(avgPrices).length > 0 && React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.budget, marginBottom: 8 } }, "📊 Prix moyens observés"),
                budgetAliments.filter(a => avgPrices[a.id]).map(a => React.createElement("div", { key: a.id, style: { display: "flex", justifyContent: "space-between", fontSize: 12, lineHeight: 2 } },
                    React.createElement("span", { style: { color: C.textMut } },
                        a.emoji,
                        " ",
                        a.nom),
                    React.createElement("span", null,
                        React.createElement("span", { style: { color: C.budgetLight, fontWeight: 700 } },
                            avgPrices[a.id],
                            " €/kg"),
                        a.prixKg && React.createElement("span", { style: { color: C.textDim, marginLeft: 6 } },
                            "vs ",
                            a.prixKg,
                            " € est."))))),
            [...logs].reverse().slice(0, 30).map(l => React.createElement(Card, { key: l.id },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("div", null,
                        React.createElement("span", { style: { fontSize: 12, fontWeight: 700 } }, l.prodNom),
                        React.createElement("span", { style: { fontSize: 11, color: C.textMut, marginLeft: 8 } }, l.date)),
                    React.createElement("button", { onClick: () => doDel(l.id), style: { background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 } }, "✕")),
                React.createElement("div", { style: { fontSize: 11, color: C.textDim, marginTop: 2 } },
                    l.prix,
                    "€ pour ",
                    l.poids,
                    "g → ",
                    React.createElement("span", { style: { color: C.budgetLight, fontWeight: 700 } },
                        l.prixKg,
                        " €/kg")))),
            React.createElement("button", { onClick: doReset, style: { padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.danger}44`, background: "transparent", color: C.danger, fontSize: 11, cursor: "pointer" } }, "Réinitialiser"))),
        mode === "charts" && React.createElement("div", null,
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 10 } }, "📈 Évolution prix par produit"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 } }, prodsWithData.map(id => { const a = budgetAliments.find(x => x.id === id); return React.createElement("button", { key: id, onClick: () => setChartProd(id), style: { padding: "4px 8px", borderRadius: 8, border: `1px solid ${chartProd === id ? C.budget : C.borderSoft}`, background: chartProd === id ? C.budget + "22" : C.surfaceAlt, color: chartProd === id ? C.budget : C.textDim, fontSize: 10, cursor: "pointer", fontWeight: 600 } }, a?.emoji,
                    " ", a?.nom.split(" ")[0]); })),
                !chartProd ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } }, "Sélectionne un produit.") : chartD.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } }, "2 achats min.") :
                    React.createElement(ChartLine, { data: chartD, dataKey: "eur", color: C.budgetLight, unit: "€/kg", height: 180 }))));
}
/* ═══ SUIVI DOULEUR (blessures) ═══ */
function SuiviDouleur() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState("log");
    const [selDate, setSelDate] = useState(isoToday());
    const [zone, setZone] = useState(painZones[0]);
    const [intens, setIntens] = useState(3);
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [chartZone, setChartZone] = useState(painZones[0]);
    useEffect(() => { load("douleur-logs", []).then(d => { setLogs(d); setLoading(false); }); }, []);
    const doSave = async () => { setSaving(true); const e = { id: Date.now(), dateISO: selDate, date: fmtDateShort(selDate), zone, intensite: intens, note: note.trim() }; const u = [...logs, e]; await save("douleur-logs", u); setLogs(u); setNote(""); setSaving(false); setMode("history"); };
    const doDel = id => commitWithUndo("douleur-logs", logs, logs.filter(l => l.id !== id), setLogs, "🗑️ Entrée supprimée");
    const chartData = logs.filter(l => l.zone === chartZone).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ date: l.date, v: l.intensite }));
    const intColor = v => v <= 3 ? C.green : v <= 6 ? C.gluc : C.danger;
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } }, [["log", "📝 Saisie"], ["history", "📋 Historique"], ["charts", "📈 Suivi"], ["subs", "🔁 Alternatives"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mode === k, onClick: () => setMode(k), color: C.amber }, l))),
        mode === "log" && React.createElement("div", null,
            React.createElement(DateNav, { value: selDate, onChange: setSelDate, color: C.amber }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 10 } }, "🩹 Signaler une douleur / sensation"),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Zone"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 } }, painZones.map(z => React.createElement("button", { key: z, onClick: () => setZone(z), style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${zone === z ? C.amber : "transparent"}`, cursor: "pointer", fontSize: 10.5, fontWeight: 700, background: zone === z ? C.amber + "22" : C.surfaceAlt, color: zone === z ? C.amber : C.textMut } }, z))),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 4 } },
                    "Intensité : ",
                    React.createElement("b", { style: { color: intColor(intens) } },
                        intens,
                        "/10")),
                React.createElement("input", { type: "range", min: 0, max: 10, value: intens, onChange: e => setIntens(parseInt(e.target.value)), style: { width: "100%", accentColor: intColor(intens), marginBottom: 12 } }),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Note (mouvement, exercice…)"),
                React.createElement("textarea", { value: note, onChange: e => setNote(e.target.value), placeholder: "ex : pic au genou en bas du squat", rows: 2, style: { ...inputStyle, width: "100%", resize: "vertical", fontFamily: "inherit" } })),
            React.createElement("button", { onClick: doSave, disabled: saving, style: { width: "100%", padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.amber, color: "#1A1505", fontSize: 13, fontWeight: 800, opacity: saving ? .6 : 1 } }, saving ? "Enregistrement…" : "Enregistrer")),
        mode === "history" && React.createElement("div", null, !logs.length ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, "Aucune douleur enregistrée. 💪")) : [...logs].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).map(l => React.createElement(Card, { key: l.id },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 700 } }, l.zone),
                    React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: intColor(l.intensite), background: intColor(l.intensite) + "18", borderRadius: 6, padding: "2px 7px" } },
                        l.intensite,
                        "/10"),
                    React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, l.date)),
                React.createElement("button", { onClick: () => doDel(l.id), style: { background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 } }, "✕")),
            l.note && React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginTop: 6, fontStyle: "italic" } }, l.note)))),
        mode === "charts" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 } }, painZones.map(z => React.createElement("button", { key: z, onClick: () => setChartZone(z), style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${chartZone === z ? C.amber : "transparent"}`, cursor: "pointer", fontSize: 10.5, fontWeight: 700, background: chartZone === z ? C.amber + "22" : C.surfaceAlt, color: chartZone === z ? C.amber : C.textMut } }, z))),
            React.createElement(Card, null, chartData.length < 2 ? React.createElement("div", { style: { color: C.textDim, fontSize: 12, padding: 16, textAlign: "center" } },
                "2 entrées minimum pour ",
                chartZone,
                ".") : React.createElement(ChartLine, { data: chartData, dataKey: "v", color: C.amber, unit: "/10", height: 160 }))),
        mode === "subs" && React.createElement("div", null,
            React.createElement(Card, { border: C.danger + "33" },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 6 } }, "🔁 Alternatives genou / pied"),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, lineHeight: 1.5 } }, "En cas de douleur articulaire : remplace temporairement par une variante moins contraignante, garde une amplitude indolore, et baisse la charge avant d'arrêter.")),
            Object.entries(substitutions).map(([nom, alts]) => React.createElement(Card, { key: nom },
                React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700, marginBottom: 6 } }, nom),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, alts.map((a, i) => React.createElement("span", { key: i, style: { fontSize: 10.5, background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "3px 8px", color: C.text } }, a)))))));
}
/* ═══ SPORT SECTION ═══ */
/* ═══ PLAN RM (1RM + progression) ═══ */
function round25(x) { return Math.round(x / 2.5) * 2.5; }
function weightForReps(oneRM, reps) { return round25(oneRM / (1 + reps / 30)); }
function repsAtPct(pct) { return Math.max(1, Math.round((100 / pct - 1) * 30)); }
function pctWeight(oneRM, pct) { return round25(oneRM * pct / 100); }
function progressionPlan(current, goal, weeks, reps) { if (!current || !weeks || weeks < 1)
    return []; const p = []; for (let w = 1; w <= weeks; w++) {
    const proj = current + (goal - current) * w / weeks;
    p.push({ week: w, proj: Math.round(proj), weight: weightForReps(proj, reps) });
} return p; }
function currentRMFor(logs, nom) { const s = (logs || []).filter(l => !l.deload && (l.exercices || []).some(e => e.nom === nom)).sort((a, b) => a.dateISO.localeCompare(b.dateISO)); const rms = s.map(l => { const e = l.exercices.find(x => x.nom === nom); return e ? epley1RM(e.weight, e.reps) : 0; }).filter(x => x > 0); if (!rms.length)
    return null; const current = Math.max(...rms.slice(-3)); const earlier = rms.length > 3 ? Math.max(...rms.slice(0, -3)) : null; const trend = earlier != null ? (current > earlier ? "up" : current < earlier ? "down" : "flat") : null; return { rm: current, trend, n: rms.length }; }
function PlanRM() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState("rm");
    const [sel, setSel] = useState("");
    const [manual, setManual] = useState("");
    const [goal, setGoal] = useState("");
    const [weeks, setWeeks] = useState("8");
    const [reps, setReps] = useState("8");
    useEffect(() => { load("sport-logs", []).then(d => { setLogs(d || []); setLoading(false); }); }, []);
    const A = C.amber;
    const allExos = [...new Set(salleSeances.flatMap(s => s.exercices.map(e => e.nom)))];
    const rmList = allExos.map(nom => { const r = currentRMFor(logs, nom); return r ? { nom, ...r } : null; }).filter(Boolean).sort((a, b) => b.rm - a.rm);
    const effSel = sel || (rmList[0] && rmList[0].nom) || allExos[0];
    const selRM = currentRMFor(logs, effSel);
    const tableRM = parseFloat(manual) || (selRM ? selRM.rm : 0);
    const pcts = [100, 95, 90, 85, 80, 75, 70, 65, 60];
    const current = selRM ? selRM.rm : 0;
    const suggested = current ? round25(current * 1.05) : 0;
    const goalN = parseFloat(goal) || suggested;
    const wk = Math.max(1, Math.min(16, parseInt(weeks) || 8));
    const rp = Math.max(1, Math.min(15, parseInt(reps) || 8));
    const plan = current ? progressionPlan(current, goalN, wk, rp) : [];
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } }, [["rm", "💪 Mes 1RM"], ["table", "📊 % de 1RM"], ["plan", "📈 Plan"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mode === k, onClick: () => setMode(k), color: A }, l))),
        mode === "rm" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 10 } }, "1RM estimé (formule Epley) d'après tes meilleures séries récentes. Plus tu enregistres de séances (charge + reps), plus c'est précis."),
            !rmList.length ? React.createElement(Card, null,
                React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12 } }, "Aucune donnée. Enregistre des séances dans Suivi → 🏋️ Salle (charge + reps).")) : rmList.map(x => React.createElement(Card, { key: x.nom, style: { padding: "12px 14px" } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700 } }, x.nom),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } },
                            x.n,
                            " séance",
                            x.n > 1 ? "s" : "",
                            " enregistrée",
                            x.n > 1 ? "s" : "")),
                    React.createElement("div", { style: { textAlign: "right" } },
                        React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: A } },
                            x.rm,
                            " ",
                            React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, "kg")),
                        x.trend && React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: x.trend === "up" ? C.green : x.trend === "down" ? C.danger : C.textMut } }, x.trend === "up" ? "↑ en progrès" : x.trend === "down" ? "↓ en baisse" : "= stable")))))),
        mode === "table" && React.createElement("div", null,
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 5 } }, "Exercice"),
                React.createElement("select", { value: effSel, onChange: e => { setSel(e.target.value); setManual(""); }, style: { ...inputStyle, fontSize: 13, marginBottom: 10 } }, allExos.map(n => React.createElement("option", { key: n, value: n }, n))),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("div", { style: { flex: 1, fontSize: 11, color: C.textMut } }, "1RM de référence"),
                    React.createElement("input", { type: "number", inputMode: "decimal", value: manual, onChange: e => setManual(e.target.value), placeholder: selRM ? String(selRM.rm) : "—", style: { ...inputStyle, width: 90, textAlign: "right" } }),
                    React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, "kg")),
                React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 4 } }, selRM ? "Estimé depuis tes séances : " + selRM.rm + " kg. Modifie si tu connais ton vrai 1RM." : "Pas de données pour cet exercice — entre ton 1RM à la main.")),
            tableRM > 0 && React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: A, marginBottom: 8 } },
                    "Charges selon % du 1RM (",
                    tableRM,
                    " kg)"),
                React.createElement("div", { style: { display: "flex", fontSize: 9, color: C.textDim, fontWeight: 700, paddingBottom: 6 } },
                    React.createElement("span", { style: { width: 54 } }, "%1RM"),
                    React.createElement("span", { style: { flex: 1 } }, "Charge"),
                    React.createElement("span", { style: { width: 90, textAlign: "right" } }, "≈ reps max")),
                pcts.map(p => React.createElement("div", { key: p, style: { display: "flex", alignItems: "center", fontSize: 12, padding: "6px 0", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("span", { style: { width: 54, fontWeight: 700, color: p >= 85 ? C.danger : p >= 70 ? A : C.green } },
                        p,
                        "%"),
                    React.createElement("span", { style: { flex: 1, fontWeight: 700 } },
                        pctWeight(tableRM, p),
                        " kg"),
                    React.createElement("span", { style: { width: 90, textAlign: "right", color: C.textMut } }, p >= 100 ? "1" : "~" + repsAtPct(p)))),
                React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 8 } }, "Hypertrophie : 65-80 % (8-15 reps) · Force : 80-90 % (3-6 reps)."))),
        mode === "plan" && React.createElement("div", null,
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 5 } }, "Exercice"),
                React.createElement("select", { value: effSel, onChange: e => setSel(e.target.value), style: { ...inputStyle, fontSize: 13 } }, allExos.map(n => React.createElement("option", { key: n, value: n }, n))),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginTop: 8 } },
                    "1RM actuel estimé : ",
                    React.createElement("b", { style: { color: A } }, current ? current + " kg" : "— (enregistre des séances)"))),
            current > 0 ? React.createElement("div", null,
                React.createElement(Card, null,
                    React.createElement("div", { style: { display: "flex", gap: 8 } },
                        React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Objectif 1RM"),
                            React.createElement("input", { type: "number", inputMode: "decimal", value: goal, onChange: e => setGoal(e.target.value), placeholder: String(suggested), style: inputStyle })),
                        React.createElement("div", { style: { width: 78 } },
                            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Semaines"),
                            React.createElement("input", { type: "number", inputMode: "decimal", value: weeks, onChange: e => setWeeks(e.target.value), style: inputStyle })),
                        React.createElement("div", { style: { width: 64 } },
                            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Reps"),
                            React.createElement("input", { type: "number", inputMode: "decimal", value: reps, onChange: e => setReps(e.target.value), style: inputStyle }))),
                    React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 6 } },
                        "Suggéré : ",
                        suggested,
                        " kg (+5 % sur le bloc). +",
                        Math.round(goalN - current),
                        " kg en ",
                        wk,
                        " sem (≈ ",
                        current > 0 ? Math.round((goalN - current) / current * 1000) / 10 : 0,
                        " %).")),
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: A, marginBottom: 8 } },
                        "Plan — série de ",
                        rp,
                        " reps"),
                    React.createElement("div", { style: { display: "flex", fontSize: 9, color: C.textDim, fontWeight: 700, paddingBottom: 6 } },
                        React.createElement("span", { style: { width: 60 } }, "Semaine"),
                        React.createElement("span", { style: { flex: 1 } }, "Charge de travail"),
                        React.createElement("span", { style: { width: 84, textAlign: "right" } }, "1RM projeté")),
                    plan.map(p => React.createElement("div", { key: p.week, style: { display: "flex", alignItems: "center", fontSize: 12, padding: "7px 0", borderTop: `1px solid ${C.borderSoft}` } },
                        React.createElement("span", { style: { width: 60, fontWeight: 700 } },
                            "S",
                            p.week),
                        React.createElement("span", { style: { flex: 1, fontWeight: 800, color: A } },
                            rp,
                            " × ",
                            p.weight,
                            " kg"),
                        React.createElement("span", { style: { width: 84, textAlign: "right", color: C.textMut } },
                            p.proj,
                            " kg")))),
                React.createElement(Card, { border: "#5B4FE033" },
                    React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, lineHeight: 1.6 } },
                        "⚠️ Progression volontairement ",
                        React.createElement("b", { style: { color: C.text } }, "prudente"),
                        " : ta mémoire musculaire revient vite, mais les tendons (genou/pied) suivent plus lentement. Intègre une ",
                        React.createElement("b", { style: { color: "#4A3FCB" } }, "semaine de décharge"),
                        " toutes les ~6 sem. (voir l'analyse de décharge). Si une charge sort à RPE 9-10 trop tôt, reste dessus une semaine de plus avant de monter.")))
                : React.createElement(Card, null,
                    React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12 } }, "Enregistre au moins une séance avec cet exercice (charge + reps) pour générer un plan."))));
}
/* ═══ COACH (volume/muscle · auto-progression · gate maison→salle) ═══ */
const muscleLandmarks = { Pecs: { mev: 10, mav: 22 }, Dos: { mev: 10, mav: 22 }, "Épaules": { mev: 8, mav: 22 }, Biceps: { mev: 6, mav: 16 }, Triceps: { mev: 6, mav: 16 }, Quadriceps: { mev: 8, mav: 20 }, Ischios: { mev: 8, mav: 18 }, Fessiers: { mev: 6, mav: 18 }, Mollets: { mev: 8, mav: 16 } };
const muscleMap = { "DC haltères": "Pecs", "DC haltères neutre": "Pecs", "DI haltères": "Pecs", "Poulie basse (pecs)": "Pecs", "Tirage vertical": "Dos", "Tirage bûcheron": "Dos", "Rack pull": "Dos", "Élévations lat.": "Épaules", "Écarté inversé poulie": "Épaules", "Tirage araignée": "Épaules", "DM haltères": "Épaules", "Triceps poulie": "Triceps", "Ext. triceps": "Triceps", "Curl biceps": "Biceps", "Curl marteau": "Biceps", "Presse à cuisses": "Quadriceps", "Hack squat": "Quadriceps", "Presse lourde": "Quadriceps", "Leg extension": "Quadriceps", "RDL": "Ischios", "Leg curl": "Ischios", "Leg curl assis": "Ischios", "Hip thrust": "Fessiers", "Abduction hanche": "Fessiers", "Mollets debout": "Mollets", "Mollets assis": "Mollets" };
const muscleOrder = ["Pecs", "Dos", "Épaules", "Biceps", "Triceps", "Quadriceps", "Ischios", "Fessiers", "Mollets", "Abdos"];
muscleLandmarks.Abdos = { mev: 4, mav: 16 };
/* ═══ BIBLIOTHÈQUE D'EXERCICES ═══ exercices du programme de base + classiques, rangés par muscle.
   Tes exercices perso (clé "exos-perso") s'y ajoutent. */
const MUSCLE_GROUPS = ["Pecs", "Dos", "Épaules", "Biceps", "Triceps", "Quadriceps", "Ischios", "Fessiers", "Mollets", "Abdos"];
const EXO_LIB = [...Object.entries(muscleMap), ["Développé couché", "Pecs"], ["Développé incliné barre", "Pecs"], ["Développé décliné", "Pecs"], ["Pompes", "Pecs"], ["Écarté haltères", "Pecs"], ["Écarté poulie vis-à-vis", "Pecs"], ["Pec deck", "Pecs"],
    ["Tractions", "Dos"], ["Tractions assistées", "Dos"], ["Rowing barre", "Dos"], ["Rowing haltère", "Dos"], ["Tirage horizontal poulie", "Dos"], ["Soulevé de terre", "Dos"], ["Pull-over poulie", "Dos"], ["Shrug haltères", "Dos"],
    ["Développé militaire barre", "Épaules"], ["Élévations frontales", "Épaules"], ["Face pull", "Épaules"], ["Oiseau haltères", "Épaules"], ["Développé Arnold", "Épaules"],
    ["Curl barre", "Biceps"], ["Curl incliné", "Biceps"], ["Curl pupitre", "Biceps"], ["Curl poulie", "Biceps"],
    ["Dips", "Triceps"], ["Barre au front", "Triceps"], ["Extension triceps poulie haute", "Triceps"], ["Kickback haltère", "Triceps"], ["Développé couché prise serrée", "Triceps"],
    ["Squat", "Quadriceps"], ["Squat bulgare", "Quadriceps"], ["Fentes", "Quadriceps"], ["Goblet squat", "Quadriceps"], ["Front squat", "Quadriceps"], ["Step-up", "Quadriceps"],
    ["Soulevé de terre jambes tendues", "Ischios"], ["Good morning", "Ischios"], ["Leg curl allongé", "Ischios"], ["Nordic curl", "Ischios"],
    ["Pont fessier", "Fessiers"], ["Kickback poulie", "Fessiers"], ["Abduction élastique", "Fessiers"],
    ["Mollets presse", "Mollets"],
    ["Gainage", "Abdos"], ["Crunch", "Abdos"], ["Relevé de jambes", "Abdos"], ["Roue abdominale", "Abdos"], ["Pallof press", "Abdos"], ["Russian twist", "Abdos"]];
const EXO_LIB_MUSCLE = Object.fromEntries(EXO_LIB);
function muscleOf(nom) { return muscleMap[nom] || CUSTOM_MUSCLE[nom] || EXO_LIB_MUSCLE[nom] || null; }
function weeklyMuscleVolume(logs, days) { const c = new Date(); c.setDate(c.getDate() - (days || 7)); const r = (logs || []).filter(l => !l.deload && new Date(l.dateISO + "T12:00:00") >= c); const v = {}; r.forEach(l => (l.exercices || []).forEach(e => { const m = muscleOf(e.nom); if (m && e.sets > 0 && e.weight > 0)
    v[m] = (v[m] || 0) + e.sets; })); return v; }
function parseRepRange(detail) { const d = String(detail || ""); if (/\ds\s*$/.test(d.trim()) || /\d\s*s\b/.test(d))
    return null; const m = d.match(/(\d+)\s*[×xX]\s*(\d+)(?:\s*[-–]\s*(\d+))?/); if (!m)
    return null; return { sets: +m[1], lo: +m[2], hi: m[3] ? +m[3] : +m[2] }; }
/* ═══ MOTEUR DE PROGRESSION UNIQUE (Coach, Log « ✨ Pré-remplir », Science « Surcharge ») ═══
 * Cycle en 2 temps sur chaque exercice :
 *  1. Fourchette du programme (ex. 10-12) : haut atteint à RPE ≤ 8 → la charge MONTE et la
 *     fourchette DESCEND de 2 reps (8-10), car on fait moins de reps avec plus lourd.
 *  2. Fourchette basse (8-10) : haut atteint à RPE ≤ 8 → même charge, on REMONTE à la
 *     fourchette du programme (10-12) pour reconstruire le volume. Puis retour à l'étape 1.
 * Dans chaque fourchette : +1 rep par séance ; RPE ≥ 9,5 ou sous le bas = consolider.
 * L'étape en cours est déduite de l'historique : rien à régler à la main. */
const RANGE_DROP = 2;
const lowerRange = rr => { const lo = Math.max(3, rr.lo - RANGE_DROP); return { lo, hi: Math.max(lo, rr.hi - RANGE_DROP) }; };
const progRangeFor = (seanceId, nom) => { const p = seanceById(seanceId)?.exercices.find(x => x.nom === nom); return p ? parseRepRange(p.detail) : null; };
/* "low" si la dernière séance de cet exercice était en fourchette basse, sinon "prog" */
function rangeState(logs, seanceId, nom, rr) {
    const hist = (logs || []).filter(l => !l.deload && l.seance === seanceId).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => (l.exercices || []).find(e => e.nom === nom)).filter(e => e && e.weight > 0);
    let st = "prog", prev = null;
    for (const e of hist) {
        if (prev) {
            if (e.weight > prev.weight)
                st = "low";
            else if (st === "low" && e.weight === prev.weight && effReps(prev) >= lowerRange(rr).hi)
                st = "prog";
        }
        prev = e;
    }
    return st;
}
/* Fourchette en cours (pour l'affichage Salle / log) : celle de Science si appliquée, sinon celle déduite de l'historique */
function currentRangeFor(logs, sci, seanceId, nom) {
    const ro = repOverrideFor(sci, seanceId + ":" + nom), ov = sci?.weightOverrides?.[seanceId + ":" + nom];
    const rr = progRangeFor(seanceId, nom), last = lastExerciseLog(logs, seanceId, nom);
    // L'ajustement Science vaut tant que sa charge n'a pas été soulevée ; ensuite le cycle reprend la main
    if (ro && !(last && ov && last.weight >= ov))
        return { range: ro, src: "science" };
    if (!rr || !last)
        return null;
    // Fourchette de la PROCHAINE séance d'après l'historique ; affichée seulement si elle diffère du programme
    const p = progressFor(seanceId, last, false, logs);
    return p.range && fmtRange(p.range) !== fmtRange(rr) ? { range: p.range, src: "auto" } : null;
}
/* Fourchette de reps fixée par Science (clé "Séance:Exercice"), affichée dans Salle et le log */
const repOverrideFor = (sci, key) => sci?.repOverrides?.[key] || null;
const fmtRange = r => r ? (r.lo === r.hi ? String(r.lo) : r.lo + "-" + r.hi) : "";
/* "4×8-10" + fourchette Science {lo:10, hi:12} → "4×10-12" */
function detailWithRange(detail, r) { if (!r)
    return detail; const d = parseRepRange(detail); return d ? d.sets + "×" + fmtRange(r) : detail; }
const loadIncrement = nom => ["Quadriceps", "Ischios", "Fessiers"].includes(muscleOf(nom)) ? 5 : 2.5;
/* Reps « limitantes » : la plus faible des séries à la charge max quand le détail existe */
const effReps = e => e.setsDetail?.length ? Math.min(...e.setsDetail.filter(s => s.w === e.weight).map(s => s.r)) : e.reps;
function lastExerciseLog(logs, seanceId, nom) {
    const l = (logs || []).filter(x => !x.deload && x.seance === seanceId && (x.exercices || []).some(e => e.nom === nom && e.weight > 0)).sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
    return l ? { ...l.exercices.find(e => e.nom === nom), date: l.date, dateISO: l.dateISO } : null;
}
/* `logs` (historique de séances) permet de savoir dans quelle fourchette on se trouve */
function progressFor(seanceId, e, recovery, logs) {
    const rr = progRangeFor(seanceId, e.nom), inc = loadIncrement(e.nom), reps = effReps(e);
    if (!rr)
        return { action: recovery ? "hold" : "keep", weight: e.weight, reps, txt: (recovery ? "mode récup : " : "") + "garde " + e.weight + " kg" };
    const low = rangeState(logs, seanceId, e.nom, rr) === "low";
    const cur = low ? lowerRange(rr) : rr;
    if (recovery)
        return { action: "hold", weight: e.weight, reps, range: cur, txt: "mode récup : garde " + e.weight + " kg × " + fmtRange(cur) };
    if (reps >= cur.hi && (!e.rpe || e.rpe <= 8)) {
        if (low)
            return { action: "range", weight: e.weight, reps: Math.min(cur.hi + 1, rr.hi), range: rr, txt: "garde " + e.weight + " kg, remonte à " + fmtRange(rr) + " reps" };
        const nr = lowerRange(rr);
        return { action: "up", weight: e.weight + inc, reps: nr.lo, range: nr, txt: "+" + inc + " kg → " + (e.weight + inc) + " kg × " + fmtRange(nr) };
    }
    if (e.rpe >= 9.5 || reps < cur.lo)
        return { action: "hold", weight: e.weight, reps: Math.max(reps, cur.lo), range: cur, txt: "reste à " + e.weight + " kg × " + fmtRange(cur) + " (consolide)" };
    return { action: "reps", weight: e.weight, reps: reps + 1, range: cur, txt: "garde " + e.weight + " kg, vise " + (reps + 1) + " reps (" + fmtRange(cur) + ")" };
}
/* Suggestions pour la PROCHAINE séance salle prévue (ou la dernière faite à défaut) */
function nextSuggestions(logs, recovery) {
    const nonD = (logs || []).filter(l => !l.deload);
    if (!nonD.length)
        return null;
    let seanceId = null, when = null;
    for (let d = 0; d < 7 && !seanceId; d++) {
        const iso = shiftISO(isoToday(), d), s = sessionForDate(iso, ACTIVE_GYM);
        if (s && nonD.some(l => l.seance === s.code) && !(d === 0 && nonD.some(l => l.dateISO === iso && l.seance === s.code))) {
            seanceId = s.code;
            when = d === 0 ? "aujourd'hui" : d === 1 ? "demain" : fmtDateLong(iso);
        }
    }
    if (!seanceId)
        seanceId = [...nonD].sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0].seance;
    const seance = seanceById(seanceId);
    if (!seance)
        return null;
    const sugg = seance.exercices.map(ex => { const e = lastExerciseLog(logs, seanceId, ex.nom); if (!e)
        return null; const p = progressFor(seanceId, e, recovery, logs); return { nom: e.nom, action: p.action, txt: p.txt, last: (e.setsDetail?.length ? fmtSets(e) : e.reps + "×" + e.weight + "kg") + (e.rpe ? " @RPE" + e.rpe : "") + " · " + e.date }; }).filter(Boolean);
    return { seance: seanceId, emoji: seance.emoji, date: when || "dernière séance", sugg };
}
function maisonGate(maisonLogs, douleurLogs) { const sessions = (maisonLogs || []).length; let weeks = 0; if (sessions) {
    const ds = maisonLogs.map(l => new Date(l.dateISO + "T12:00:00").getTime());
    weeks = Math.round((Math.max(...ds) - Math.min(...ds)) / (7 * 86400000) * 10) / 10;
} const c = new Date(); c.setDate(c.getDate() - 21); const rp = (douleurLogs || []).filter(l => new Date(l.dateISO + "T12:00:00") >= c && (l.zone === "Genou droit" || l.zone === "Pied droit")); const maxPain = rp.length ? Math.max(...rp.map(l => l.intensite || 0)) : 0; const sharp = rp.some(l => /piqu|pic|aigu|élanc/i.test(l.note || "")); const checks = [{ ok: weeks >= 6 || sessions >= 18, label: "≥ 6 semaines de renfort à la maison", val: sessions ? (weeks >= 1 ? weeks + " sem · " + sessions + " séances" : sessions + " séances") : "aucune séance maison enregistrée" }, { ok: maxPain <= 3 && !sharp, label: "Genou + pied calmes (≤ 3/10, sans douleur piquante)", val: rp.length ? ("max " + maxPain + "/10" + (sharp ? " · piquante ⚠️" : "")) : "aucune douleur enregistrée (21 j)" }]; return { ready: checks.every(x => x.ok), checks, hasPainData: rp.length > 0 }; }
function CoachSport() {
    const [sLogs, setSLogs] = useState([]);
    const [mLogs, setMLogs] = useState([]);
    const [dLogs, setDLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { Promise.all([load("sport-logs", []), load("maison-logs", []), load("douleur-logs", [])]).then(([s, m, d]) => { setSLogs(s || []); setMLogs(m || []); setDLogs(d || []); setLoading(false); }); }, []);
    const [sci] = useStored("science-config", SCI_DEFAULT);
    const [profile, setProfile] = useStored("profil", PROFILE_DEFAULT);
    const A = C.amber;
    const vol = weeklyMuscleVolume(sLogs, 7);
    const sugg = nextSuggestions(sLogs, recupMode(sci));
    const gate = maisonGate(mLogs, dLogs);
    const prog = resolveProgramme(profile, sLogs);
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    const actionCfg = { up: { c: C.green, e: "⬆️" }, range: { c: C.blue, e: "↕️" }, reps: { c: A, e: "🔁" }, hold: { c: C.gluc, e: "⏸️" }, keep: { c: C.textMut, e: "✓" } };
    return React.createElement("div", null,
        RECUP_TODAY != null && RECUP_TODAY < 50 && !sci.recovery && React.createElement(Card, { border: C.danger + "66" },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 2 } }, "🫀 Récupération du matin : " + RECUP_TODAY + "/100"),
            React.createElement("div", { style: { fontSize: 11.5, color: C.textMut, lineHeight: 1.45 } }, "Mode récup automatique aujourd'hui : aucune hausse de charge proposée, charges et reps de la dernière séance gardées. Il repart demain avec ta prochaine saisie.")),
        React.createElement(Card, { border: gate.ready ? C.green + "55" : C.border },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 2 } },
                gate.ready ? "✅" : "🏠",
                " Passage maison → salle"),
            React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, marginBottom: 10 } }, gate.ready ? "Tu coches les critères pour basculer en salle." : "Continue à la maison — pas encore tous les feux au vert."),
            gate.checks.map((c, i) => React.createElement("div", { key: i, style: { display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderTop: i > 0 ? `1px solid ${C.borderSoft}` : "none" } },
                React.createElement("span", { style: { fontSize: 14 } }, c.ok ? "✅" : "⬜"),
                React.createElement("div", { style: { flex: 1 } },
                    React.createElement("div", { style: { fontSize: 11.5, fontWeight: 600, color: c.ok ? C.text : C.textMut } }, c.label),
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, c.val)))),
            !gate.hasPainData && React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 8 } }, "💡 Note tes douleurs genou/pied (onglet 🩹 Douleur) pour fiabiliser ce critère."),
            gate.ready && prog === "maison" && React.createElement("button", { onClick: async () => { if (await askConfirm({ title: "Passer en programme salle ?", message: "L'accueil, le calendrier et la checklist suivront le planning salle (lun/mar/mer/ven/sam). Modifiable à tout moment dans Accueil → ⚙️ Mon profil.", confirmLabel: "Passer en salle" })) {
                    await setProfile({ ...normProfile(profile), programme: "salle" });
                    toast("🏋️ Programme salle activé");
                } }, style: { width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, border: "none", background: C.green, color: "#04130B", fontSize: 12.5, fontWeight: 800, cursor: "pointer" } }, "🏋️ Passer en programme salle")),
        React.createElement("div", { style: { fontSize: 12, fontWeight: 800, margin: "18px 0 8px" } },
            "💪 Volume par muscle ",
            React.createElement("span", { style: { fontSize: 10, color: C.textDim, fontWeight: 400 } }, "· 7 j (séries travaillées)")),
        Object.keys(vol).length === 0 ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12, fontSize: 12 } }, "Aucune série salle sur 7 jours."))
            : muscleOrder.map(m => { const sets = vol[m] || 0; if (sets === 0)
                return null; const lm = muscleLandmarks[m]; const st = sets < lm.mev ? { c: C.gluc, t: "sous le min." } : sets <= lm.mav ? { c: C.green, t: "zone optimale" } : { c: C.danger, t: "au-dessus du max" }; const scale = Math.max(lm.mav * 1.2, sets); const mevP = lm.mev / scale * 100, mavP = lm.mav / scale * 100, setP = sets / scale * 100; return React.createElement(Card, { key: m, style: { padding: "10px 12px" } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", marginBottom: 6 } },
                    React.createElement("span", { style: { flex: 1, fontSize: 12, fontWeight: 700 } }, m),
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: st.c } },
                        sets,
                        " ",
                        React.createElement("span", { style: { fontSize: 9, color: C.textDim, fontWeight: 400 } }, "séries"))),
                React.createElement("div", { style: { position: "relative", height: 8, borderRadius: 4, background: C.surfaceAlt } },
                    React.createElement("div", { style: { position: "absolute", left: mevP + "%", top: -2, bottom: -2, width: 1.5, background: C.textMut } }),
                    React.createElement("div", { style: { position: "absolute", left: mavP + "%", top: -2, bottom: -2, width: 1.5, background: C.danger } }),
                    React.createElement("div", { style: { height: "100%", width: Math.min(100, setP) + "%", background: st.c, borderRadius: 4 } })),
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: C.textDim } },
                    React.createElement("span", { style: { color: st.c, fontWeight: 700 } }, st.t),
                    React.createElement("span", null,
                        "zone ",
                        lm.mev,
                        "–",
                        lm.mav))); }),
        React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, padding: "2px 4px 0", lineHeight: 1.5 } }, "MEV (min. efficace, trait gris) → MAV (max. utile, trait rouge) par semaine. Vise la zone."),
        React.createElement("div", { style: { fontSize: 12, fontWeight: 800, margin: "18px 0 8px" } },
            "🎯 Prochaine séance ",
            React.createElement("span", { style: { fontSize: 10, color: C.textDim, fontWeight: 400 } }, sugg ? "· " + sugg.emoji + " " + sugg.seance + " (" + sugg.date + ")" : "")),
        !sugg ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12, fontSize: 12 } }, "Enregistre une séance salle pour des suggestions de progression."))
            : React.createElement(Card, null, sugg.sugg.map((s, i) => { const cf = actionCfg[s.action]; return React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.borderSoft}` : "none" } },
                React.createElement("span", { style: { fontSize: 15 } }, cf.e),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700 } }, s.nom),
                    React.createElement("div", { style: { fontSize: 9.5, color: C.textDim } },
                        "dernier : ",
                        s.last)),
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: cf.c, textAlign: "right" } }, s.txt)); })),
        React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, padding: "2px 4px 0", lineHeight: 1.5 } }, "Cycle de progression : ⬆️ haut de la fourchette atteint à RPE ≤ 8 → charge +, fourchette −" + RANGE_DROP + " reps · ↕️ haut de la fourchette basse atteint → même charge, retour à la fourchette du programme · 🔁 +1 rep sinon · ⏸️ consolider si RPE ≥ 9,5."));
}
const reposMap = { "Push:DC haltères": "2 min", "Push:DI haltères": "90 s", "Push:Poulie basse (pecs)": "60 s", "Push:Élévations lat.": "60 s", "Push:Triceps poulie": "60 s", "Pull:Tirage vertical": "2 min", "Pull:Tirage bûcheron": "90 s", "Pull:Rack pull": "3 min", "Pull:Écarté inversé poulie": "60 s", "Pull:Tirage araignée": "60 s", "Pull:Curl biceps": "75 s", "Legs:Presse à cuisses": "2 min", "Legs:Hack squat": "2-3 min", "Legs:RDL": "2 min", "Legs:Leg curl": "75 s", "Legs:Mollets debout": "45-60 s", "Upper:DC haltères neutre": "2-3 min", "Upper:Tirage bûcheron": "2 min", "Upper:DM haltères": "2-3 min", "Upper:Élévations lat.": "60 s", "Upper:Curl marteau": "75 s", "Upper:Ext. triceps": "75 s", "Lower:Hip thrust": "2-3 min", "Lower:Presse lourde": "3 min", "Lower:Leg extension": "90 s", "Lower:Leg curl assis": "75 s", "Lower:Abduction hanche": "45 s", "Lower:Mollets assis": "45-60 s" };
function reposFor(sid, nom) { const r = seanceById(sid)?.exercices.find(e => e.nom === nom)?.rest; if (r)
    return r >= 60 && r % 60 === 0 ? r / 60 + " min" : r + " s"; return reposMap[sid + ":" + nom] || "90 s"; }
/* ═══ MES PROGRAMMES — créer, modifier, dupliquer, importer depuis un texte ═══
 * Stockage : "programmes" = [{ id, name, seances: [{ nom, days: [jours JS 0-6], ex: [{ nom, muscle, sets, lo, hi, kg, rest, note }] }] }]
 *            "exos-perso" = [{ nom, muscle }] (exercices créés à la main, ajoutés à la bibliothèque) */
const hx = React.createElement;
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const numFr = v => parseFloat(String(v ?? "").replace(",", "."));
const JOURS_FR = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 };
const MUSCLE_GUESS = [[/leg curl|ischio|rdl|good morning|nordic|jambes tendues/i, "Ischios"], [/mollet|calf/i, "Mollets"], [/hip thrust|fessier|glute|pont |abduction/i, "Fessiers"], [/squat|presse|fente|leg ext|quadri|step|hack/i, "Quadriceps"], [/curl/i, "Biceps"], [/triceps|dips|barre au front|kickback|extension/i, "Triceps"], [/militaire|épaule|epaule|élévation|elevation|arnold|face pull|oiseau|shoulder/i, "Épaules"], [/tirage|rowing|row|traction|pull|soulevé de terre|deadlift|shrug/i, "Dos"], [/couch|inclin|décliné|pec|pompe|écarté|bench/i, "Pecs"], [/gainage|abdo|crunch|planche|core|relevé|twist/i, "Abdos"]];
function guessMuscle(nom) { const g = MUSCLE_GUESS.find(([re]) => re.test(nom + " ")); return g ? g[1] : ""; }
function uniqueSeanceNames(seances) { const seen = {}; return seances.map(s => { const base = (s.nom || "").trim() || "Séance"; let k = base, i = 2; while (seen[k.toLowerCase()])
    k = base + " " + i++; seen[k.toLowerCase()] = 1; return { ...s, nom: k }; }); }
/* Programme écrit librement (notes, message, PDF copié) → programme structuré
   Reconnaît : « Programme : nom », les jours (« Lundi — Haut A »), les titres de séance (« Séance A : »),
   et les exercices « Nom 4x8-10 80kg 2min » / « Nom 3 séries de 12 » / « 1. Nom 4×6 @ 100 kg 90s ». */
function parseProgramText(text) {
    const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let name = "";
    const seances = [], bad = [];
    let cur = null;
    const setRe = /(\d+)\s*(?:[x×*]|s[ée]ries?\s*(?:de|x)?)\s*(\d+)(?:\s*(?:[-–à\/]|to)\s*(\d+))?/i;
    lines.forEach((raw, i) => {
        const l = raw.replace(/^(?:[-•*·▪➤>]|\d+[.)])\s+/, "");
        const pm = l.match(/^programme\s*[:\-–—]\s*(.+)$/i);
        if (pm) {
            name = pm[1].trim();
            return;
        }
        const m = l.match(setRe);
        if (m && m.index > 0) {
            const nom = l.slice(0, m.index).replace(/[:\-–—,(@]+\s*$/, "").trim();
            const after = l.slice(m.index + m[0].length);
            const kgM = after.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
            const rM = after.replace(/\d+(?:[.,]\d+)?\s*kg/ig, "").match(/(\d+(?:[.,]\d+)?)\s*(min|mn|'|’|sec|s)(?![a-zà-ÿ])/i);
            const rest = rM ? Math.round(numFr(rM[1]) * (/^m|'|’/i.test(rM[2]) ? 60 : 1)) : 90;
            if (!cur) {
                cur = { nom: "Séance A", days: [], ex: [] };
                seances.push(cur);
            }
            cur.ex.push({ nom, muscle: muscleOf(nom) || guessMuscle(nom), sets: +m[1], lo: +m[2], hi: m[3] ? Math.max(+m[2], +m[3]) : +m[2], kg: kgM ? numFr(kgM[1]) : 0, rest, note: "" });
            return;
        }
        const low = l.toLowerCase();
        const day = Object.keys(JOURS_FR).find(j => low.startsWith(j));
        if (day || /:$/.test(l) || /^(jour|s[ée]ance|day|j)\s*\d+/i.test(l) || (l.length <= 32 && !/\d/.test(l))) {
            let nom = l.replace(/:$/, "");
            if (day)
                nom = nom.slice(day.length).replace(/^\s*[—–\-:,]*\s*/, "");
            nom = nom.trim();
            if (cur && !cur.ex.length) { // deux titres de suite (« Lundi » puis « Haut A ») = une seule séance
                if (nom)
                    cur.nom = nom;
                if (day && !cur.days.includes(JOURS_FR[day]))
                    cur.days.push(JOURS_FR[day]);
            }
            else {
                cur = { nom: nom || ("Séance " + "ABCDEFGH"[seances.length % 8]), days: day ? [JOURS_FR[day]] : [], ex: [] };
                seances.push(cur);
            }
            return;
        }
        bad.push({ i: i + 1, l });
    });
    return { name: name || "Programme importé", seances: uniqueSeanceNames(seances.filter(s => s.ex.length)), bad };
}
/* Copie modifiable du PPL de base (charges de la phase actuelle, repos, jours) */
function pplToCustom(phase) {
    const days = PROGRAMMES.salle.days;
    return { id: newId("p"), name: "PPL Salle (copie)", seances: PPL_SEANCES.map(s => ({ nom: s.id, days: Object.keys(days).filter(d => days[d] === s.id).map(Number), ex: s.exercices.map(e => { const r = parseRepRange(e.detail) || { sets: 3, lo: 10, hi: 10 }; return { nom: e.nom, muscle: muscleOf(e.nom) || "", sets: r.sets, lo: r.lo, hi: r.hi, kg: parseTargetKg(e.charges[phase]) || 0, rest: parseRestSec(reposFor(s.id, e.nom)), note: e.note || "" }; }) })) };
}
const PM = {
    h1: { fontFamily: AN, fontSize: 40, lineHeight: .95, textTransform: "uppercase", margin: "2px 0 6px" },
    lead: { fontSize: 13.5, color: C.textMut, lineHeight: 1.45, margin: "0 0 14px" },
    lbl: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: C.textMut, margin: "16px 0 6px" },
    btn: { display: "block", width: "100%", padding: "13px 0", borderRadius: 4, border: `2px solid ${C.ink}`, background: C.ink, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", textAlign: "center" },
    out: { display: "block", width: "100%", padding: "12px 0", borderRadius: 4, border: `2px solid ${C.ink}`, background: "transparent", color: C.ink, fontWeight: 800, fontSize: 14, cursor: "pointer", textAlign: "center" },
    mini: on => ({ border: `1.5px solid ${C.ink}`, background: on ? C.ink : "transparent", color: on ? "#fff" : C.ink, borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }),
    sq: { width: 28, height: 28, borderRadius: 4, border: `1.5px solid ${C.ink}44`, background: "transparent", fontWeight: 800, fontSize: 12, color: C.ink, cursor: "pointer", flex: "none" },
    num: { ...inputStyle, padding: "7px 6px", textAlign: "center", fontWeight: 700 },
};
function Sheet({ title, onClose, children }) {
    return hx(Fragment, null,
        hx("div", { onClick: onClose, style: { position: "fixed", inset: 0, background: "#12121266", zIndex: 70 } }),
        hx("div", { role: "dialog", "aria-modal": true, style: { position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: "82%", zIndex: 71, background: C.bg, borderTop: `3px solid ${C.ink}`, borderRadius: "14px 14px 0 0", display: "flex", flexDirection: "column", animation: "rcUp .3s cubic-bezier(.2,.9,.1,1)" } },
            hx("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "12px 14px 8px" } },
                hx("b", { style: { flex: 1, fontFamily: AN, fontWeight: 400, fontSize: 26, textTransform: "uppercase" } }, title),
                hx("button", { onClick: onClose, style: PM.mini(false) }, "Fermer")),
            hx("div", { style: { overflowY: "auto", padding: "0 14px calc(24px + env(safe-area-inset-bottom, 0px))" } }, children)));
}
/* Bibliothèque : recherche, filtre par muscle, création d'un exercice perso */
function ExoLibrary({ onPick, onClose }) {
    const [perso, setPerso] = useStored("exos-perso", []);
    const [q, setQ] = useState("");
    const [mu, setMu] = useState("Tous");
    const [creating, setCreating] = useState(null);
    const all = [...perso.map(x => [x.nom, x.muscle, true]), ...EXO_LIB.filter(([n]) => !perso.some(x => x.nom === n))].sort((a, b) => a[0].localeCompare(b[0], "fr"));
    const ql = q.trim().toLowerCase();
    const list = all.filter(([n, m]) => (mu === "Tous" || m === mu) && (!ql || n.toLowerCase().includes(ql)));
    const exact = all.some(([n]) => n.toLowerCase() === ql);
    return hx(Sheet, { title: creating ? "Muscle principal" : "Bibliothèque", onClose },
        creating ? hx("div", null,
            hx("p", { style: PM.lead }, "« " + creating + " » travaille surtout :"),
            hx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, MUSCLE_GROUPS.map(m => hx("button", { key: m, style: PM.mini(false), onClick: async () => { await setPerso([...perso.filter(x => x.nom !== creating), { nom: creating, muscle: m }]); onPick(creating, m); } }, m))))
            : hx("div", null,
                hx("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "Chercher ou créer un exercice", style: inputStyle, autoFocus: true }),
                hx("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", margin: "8px 0" } }, ["Tous", ...MUSCLE_GROUPS].map(m => hx("button", { key: m, style: PM.mini(mu === m), onClick: () => setMu(m) }, m))),
                ql && !exact && hx("button", { onClick: () => setCreating(q.trim().charAt(0).toUpperCase() + q.trim().slice(1)), style: { width: "100%", textAlign: "left", padding: "12px 0", border: 0, borderBottom: `1.5px solid ${C.ink}22`, background: "none", color: C.amberLight, fontWeight: 800, fontSize: 15, cursor: "pointer" } }, "+ Créer « " + q.trim() + " »"),
                list.map(([n, m, mine]) => hx("button", { key: n, onClick: () => onPick(n, m), style: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", border: 0, borderBottom: `1.5px solid ${C.ink}1A`, background: "none", textAlign: "left", fontSize: 15, fontWeight: 700, color: C.ink, cursor: "pointer" } }, n, hx("small", { style: { fontSize: 11, fontWeight: 700, color: C.textMut } }, (mine ? "⭐ " : "") + m + " +"))),
                !list.length && hx("p", { style: PM.lead }, ql ? "Pas encore dans la bibliothèque : crée-le ci-dessus." : "Aucun exercice dans ce groupe.")));
}
/* Éditeur d'un programme (brouillon : rien n'est enregistré avant « Enregistrer ») */
function ProgramEditor({ draft, setDraft, onSave, onCancel }) {
    const [libFor, setLibFor] = useState(null);
    const upd = fn => setDraft(d => { const n = JSON.parse(JSON.stringify(d)); fn(n); return n; });
    const cycleDay = dow => upd(d => { const cur = d.seances.findIndex(s => (s.days || []).includes(dow)); if (cur >= 0)
        d.seances[cur].days = d.seances[cur].days.filter(x => x !== dow); const nx = cur + 1; if (nx < d.seances.length)
        d.seances[nx].days = [...(d.seances[nx].days || []), dow]; });
    const field = (si, ei, k, label, w) => hx("label", { style: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: w || 1 } },
        hx("span", { style: { fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.textMut } }, label),
        hx("input", { type: "text", inputMode: "decimal", value: draft.seances[si].ex[ei][k] ?? "", onChange: e => { const v = e.target.value; upd(d => { d.seances[si].ex[ei][k] = v; }); }, style: PM.num }));
    return hx("div", null,
        hx("button", { onClick: onCancel, style: PM.mini(false) }, "← Mes programmes"),
        hx("div", { style: { ...PM.h1, marginTop: 12 } }, "Mon programme"),
        hx("div", { style: PM.lbl }, "Nom"),
        hx("input", { value: draft.name, onChange: e => { const v = e.target.value; upd(d => { d.name = v; }); }, style: inputStyle, placeholder: "Ex : Force 4 jours" }),
        hx("div", { style: PM.lbl }, "Jours d'entraînement"),
        hx("div", { style: { display: "flex", gap: 5 } }, DOW_ORDER.map(dow => { const s = draft.seances.find(x => (x.days || []).includes(dow)); return hx("button", { key: dow, onClick: () => cycleDay(dow), style: { flex: 1, minWidth: 0, padding: "7px 0 5px", borderRadius: 4, border: `2px solid ${C.ink}`, background: s ? C.amber : C.surface, color: C.ink, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
            hx("b", { style: { fontSize: 13 } }, DOW_SHORT[dow][0]),
            hx("small", { style: { fontSize: 9, fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 2px" } }, s ? s.nom : "repos")); })),
        hx("p", { style: { ...PM.lead, fontSize: 12, marginTop: 6 } }, "Touche un jour pour lui donner la séance suivante, ou repos."),
        draft.seances.map((s, si) => hx("div", { key: si, style: { border: `2px solid ${C.ink}`, borderRadius: 6, background: C.surface, marginTop: 12, overflow: "hidden" } },
            hx("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: C.ink, color: "#fff" } },
                hx("input", { value: s.nom, "aria-label": "Nom de la séance", onChange: e => { const v = e.target.value; upd(d => { d.seances[si].nom = v; }); }, style: { flex: 1, minWidth: 0, background: "transparent", border: 0, color: "#fff", fontFamily: AN, fontSize: 24, textTransform: "uppercase", padding: 0, outline: "none" } }),
                hx("small", { style: { fontSize: 11, fontWeight: 700, opacity: .85, whiteSpace: "nowrap" } }, ((s.days || []).map(d => DOW_SHORT[d]).join(" ") || "aucun jour") + " · " + s.ex.length + " exos"),
                hx("button", { "aria-label": "Supprimer la séance", onClick: async () => { if (!s.ex.length || await askConfirm({ title: "Supprimer « " + s.nom + " » ?", message: s.ex.length + " exercice(s) seront retirés du programme.", confirmLabel: "Supprimer", danger: true }))
                        upd(d => { d.seances.splice(si, 1); }); }, style: { ...PM.sq, border: "1.5px solid #ffffff66", color: "#fff" } }, "✕")),
            s.ex.map((e, ei) => hx("div", { key: ei, style: { padding: "10px 12px", borderTop: ei ? `1.5px solid ${C.ink}1A` : "none" } },
                hx("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                    hx("b", { style: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: 750, lineHeight: 1.2 } }, e.nom),
                    hx("em", { style: { fontStyle: "normal", fontSize: 10.5, fontWeight: 700, color: C.textMut } }, e.muscle || "—"),
                    hx("button", { "aria-label": "Monter", style: PM.sq, onClick: () => upd(d => { const a = d.seances[si].ex; if (ei > 0)
                            [a[ei - 1], a[ei]] = [a[ei], a[ei - 1]]; }) }, "↑"),
                    hx("button", { "aria-label": "Descendre", style: PM.sq, onClick: () => upd(d => { const a = d.seances[si].ex; if (ei < a.length - 1)
                            [a[ei + 1], a[ei]] = [a[ei], a[ei + 1]]; }) }, "↓"),
                    hx("button", { "aria-label": "Retirer", style: { ...PM.sq, color: C.danger }, onClick: () => upd(d => { d.seances[si].ex.splice(ei, 1); }) }, "✕")),
                hx("div", { style: { display: "flex", gap: 6, marginTop: 8, alignItems: "flex-end" } },
                    field(si, ei, "sets", "Séries"), field(si, ei, "lo", "Reps min"), field(si, ei, "hi", "Reps max"), field(si, ei, "kg", "Charge kg", 1.2), field(si, ei, "rest", "Repos s")))),
            hx("button", { onClick: () => setLibFor(si), style: { display: "block", width: "100%", padding: "11px 12px", border: 0, borderTop: `1.5px dashed ${C.ink}44`, background: "transparent", textAlign: "left", fontWeight: 800, fontSize: 13.5, color: C.amberLight, cursor: "pointer" } }, "+ Ajouter un exercice"))),
        hx("button", { onClick: () => upd(d => { d.seances.push({ nom: "Séance " + "ABCDEFGH"[d.seances.length % 8], days: [], ex: [] }); }), style: { ...PM.out, marginTop: 12 } }, "+ Ajouter une séance"),
        hx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 } },
            hx("button", { onClick: () => onSave(false), style: PM.out }, "Enregistrer"),
            hx("button", { onClick: () => onSave(true), style: PM.btn }, "Enregistrer et activer")),
        libFor != null && hx(ExoLibrary, { onClose: () => setLibFor(null), onPick: (nom, muscle) => { upd(d => { d.seances[libFor].ex.push({ nom, muscle: muscle || muscleOf(nom) || "", sets: 3, lo: 8, hi: 12, kg: 0, rest: 90, note: "" }); }); setLibFor(null); toast("+ " + nom); } }));
}
function ProgrammesManager() {
    const [progs, setProgs] = useStored("programmes", []);
    const [profile, setProfile] = useStored("profil", PROFILE_DEFAULT);
    const [sLogs] = useStored("sport-logs", []);
    const [phase] = useStored("sport-phase", 0);
    const [mode, setMode] = useState("list");
    const [draft, setDraft] = useState(null);
    const [txt, setTxt] = useState("");
    const pr = normProfile(profile), resolved = resolveProgramme(profile, sLogs);
    const activate = (key, label) => { setProfile({ ...pr, programme: key }); toast("✓ Programme actif : " + label); };
    const open = p => { setDraft(JSON.parse(JSON.stringify(p))); setMode("edit"); };
    const remove = async p => { if (!(await askConfirm({ title: "Supprimer « " + p.name + " » ?", message: "Tes séances déjà enregistrées restent dans l'historique.", confirmLabel: "Supprimer", danger: true })))
        return; if (pr.programme === p.id)
        setProfile({ ...pr, programme: "auto" }); commitWithUndo("programmes", progs, progs.filter(x => x.id !== p.id), setProgs, "🗑️ Programme supprimé"); };
    const saveDraft = async (andActivate) => {
        const clean = { ...draft, name: (draft.name || "").trim() || "Mon programme", seances: uniqueSeanceNames(draft.seances).map(s => ({ ...s, days: s.days || [], ex: s.ex.filter(e => e.nom).map(e => { const lo = Math.max(1, parseInt(e.lo) || 8); return { ...e, sets: Math.min(12, Math.max(1, parseInt(e.sets) || 3)), lo, hi: Math.max(lo, parseInt(e.hi) || lo), kg: Math.max(0, numFr(e.kg) || 0), rest: Math.max(0, parseInt(e.rest) || 90) }; }) })) };
        if (!clean.seances.length)
            return toast("Ajoute au moins une séance", { tone: "danger" });
        const next = progs.some(x => x.id === clean.id) ? progs.map(x => x.id === clean.id ? clean : x) : [...progs, clean];
        await setProgs(next);
        if (andActivate) {
            if (!clean.seances.some(s => s.ex.length))
                toast("Enregistré. Ajoute des exercices pour pouvoir l'activer", { tone: "danger" });
            else {
                setProfile({ ...pr, programme: clean.id });
                toast("✓ « " + clean.name + " » est ton programme actif");
            }
        }
        else
            toast("✓ Programme enregistré");
        setDraft(null);
        setMode("list");
    };
    if (mode === "edit" && draft)
        return hx(ProgramEditor, { draft, setDraft, onSave: saveDraft, onCancel: async () => { if (await askConfirm({ title: "Quitter sans enregistrer ?", message: "Les modifications de ce programme seront perdues.", confirmLabel: "Quitter", danger: true })) {
                setDraft(null);
                setMode("list");
            } } });
    if (mode === "import") {
        const r = parseProgramText(txt), n = r.seances.reduce((a, s) => a + s.ex.length, 0);
        return hx("div", null,
            hx("button", { onClick: () => setMode("list"), style: PM.mini(false) }, "← Mes programmes"),
            hx("div", { style: { ...PM.h1, marginTop: 12 } }, "Importer"),
            hx("p", { style: PM.lead }, "Colle un programme copié depuis tes notes, un message ou un PDF. Les jours, les séances, « 4x8-10 », les kg et les temps de repos sont reconnus. Tu vérifies avant d'enregistrer."),
            hx("textarea", { value: txt, onChange: e => setTxt(e.target.value), rows: 11, spellCheck: false, placeholder: "Programme : Haut / Bas 4 jours\n\nLundi — Haut A\nDéveloppé couché 4x5 85kg 3min\nRowing barre 4x6-8 70kg 2min\nCurl biceps 3x10-12 14kg 60s\n\nMardi — Bas A\nSquat 4x5 110kg 3min\nRDL 3x8 100kg 2min", style: { ...inputStyle, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14, lineHeight: 1.45, resize: "vertical" } }),
            txt.trim() && hx("div", { style: { marginTop: 12, border: `2px solid ${C.ink}`, borderRadius: 6, background: C.surface, overflow: "hidden" } },
                hx("div", { style: { padding: "9px 12px", background: n ? C.green : C.gluc, color: "#fff", fontWeight: 800, fontSize: 13 } }, (n ? "✓ « " + r.name + " » : " + r.seances.length + " séance(s), " + n + " exercice(s)" : "Rien de reconnu pour l'instant") + (r.bad.length ? " · " + r.bad.length + " ligne(s) ignorée(s)" : "")),
                r.seances.map((s, si) => hx(Fragment, { key: si },
                    hx("div", { style: { display: "flex", justifyContent: "space-between", padding: "7px 12px", background: C.ink + "10", fontFamily: AN, fontSize: 17, textTransform: "uppercase" } }, hx("span", null, s.nom), hx("span", { style: { fontSize: 13 } }, s.days.map(d => DOW_SHORT[d]).join(" ") || "jour à choisir")),
                    s.ex.map((e, ei) => hx("div", { key: ei, style: { display: "flex", gap: 8, padding: "6px 12px", borderTop: `1px solid ${C.ink}14`, fontSize: 13 } }, hx("b", { style: { flex: 1, fontWeight: 750 } }, e.nom), hx("span", { style: { color: C.textMut, fontWeight: 700, whiteSpace: "nowrap" } }, e.sets + " × " + (e.lo === e.hi ? e.lo : e.lo + "-" + e.hi) + (e.kg ? " · " + String(e.kg).replace(".", ",") + " kg" : "") + " · " + e.rest + " s"))))),
                r.bad.map(b => hx("div", { key: b.i, style: { padding: "6px 12px", borderTop: `1px solid ${C.ink}14`, fontSize: 12.5, color: C.danger, fontWeight: 700 } }, "Ligne " + b.i + " ignorée : " + b.l.slice(0, 40)))),
            hx("button", { disabled: !n, onClick: () => { setDraft({ id: newId("p"), name: r.name, seances: r.seances }); setMode("edit"); setTxt(""); toast("Vérifie les séances, puis enregistre"); }, style: { ...PM.btn, marginTop: 12, opacity: n ? 1 : .4 } }, "Créer ce programme"));
    }
    const builtins = [
        { key: "auto", name: "Auto : maison puis salle", sub: "Maison tant qu'aucune séance salle n'est enregistrée sur 21 jours" },
        { key: "salle", name: "PPL Salle", sub: "5 séances · lun, mar, mer, ven, sam · programme de base", dup: true },
        { key: "maison", name: "Maison A-D", sub: "4 circuits · lun, mer, ven, sam · programme de base" },
    ];
    const row = (key, name, sub, actions) => { const on = pr.programme === key; return hx("div", { key, style: { display: "flex", alignItems: "center", gap: 8, padding: "12px 0", borderBottom: `2px solid ${C.ink}` } },
        hx("div", { style: { flex: 1, minWidth: 0 } },
            hx("b", { style: { display: "block", fontSize: 17, fontWeight: 750, lineHeight: 1.2 } }, name),
            hx("small", { style: { display: "block", fontSize: 12, color: C.textMut, marginTop: 3, fontWeight: 600 } }, sub + (on && key === "auto" ? " · en ce moment : " + progInfo(resolved).label.toLowerCase() : ""))),
        hx("div", { style: { display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" } },
            on ? hx("span", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", padding: "4px 8px", borderRadius: 3, background: C.ink, color: "#fff" } }, "ACTIF") : hx("button", { onClick: () => activate(key, name), style: PM.mini(false) }, "Activer"),
            actions && hx("div", { style: { display: "flex", gap: 4 } }, actions))); };
    return hx("div", null,
        hx("div", { style: PM.h1 }, "Mes programmes"),
        hx("p", { style: PM.lead }, "Le programme actif pilote l'affiche du jour, l'accueil, le calendrier, le log, le coach et Science. Ton historique est conservé quand tu changes de programme."),
        hx("div", { style: { borderTop: `2px solid ${C.ink}` } },
            builtins.map(b => row(b.key, b.name, b.sub, b.dup ? [hx("button", { key: "d", onClick: () => { setDraft(pplToCustom(+phase || 0)); setMode("edit"); }, style: PM.mini(false) }, "Dupliquer")] : null)),
            progs.map(p => { const nEx = p.seances.reduce((a, s) => a + s.ex.length, 0), days = DOW_ORDER.filter(d => p.seances.some(s => (s.days || []).includes(d))); return row(p.id, p.name, p.seances.length + " séance(s) · " + (days.map(d => DOW_SHORT[d].toLowerCase()).join(", ") || "aucun jour") + " · " + nEx + " exercice(s)", [
                    hx("button", { key: "e", onClick: () => open(p), style: PM.mini(false) }, "Modifier"),
                    hx("button", { key: "c", onClick: () => { setDraft({ ...JSON.parse(JSON.stringify(p)), id: newId("p"), name: p.name + " (copie)" }); setMode("edit"); }, style: PM.mini(false) }, "Copier"),
                    hx("button", { key: "x", "aria-label": "Supprimer", onClick: () => remove(p), style: { ...PM.mini(false), color: C.danger, borderColor: C.danger } }, "✕")
                ]); })),
        hx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 } },
            hx("button", { onClick: () => { setDraft({ id: newId("p"), name: "", seances: [{ nom: "Séance A", days: [1], ex: [] }] }); setMode("edit"); }, style: PM.btn }, "+ Nouveau"),
            hx("button", { onClick: () => setMode("import"), style: PM.out }, "📥 Importer un texte")));
}

/* ═══ NATATION ═══
 * "natation-modeles" = séances types [{ id, name, pool, pace (s/100 m), days, blocks: [{ t, reps, d, nage, mat, mode: "rest"|"dep", dep, rest, note }] }]
 * "natation-logs"    = séances faites [{ id, dateISO, date, modele, distance, duree (s), rpe, nage, pool, note, kcal }]
 * Pas de saisie au bord de l'eau : on prépare la séance, puis on l'enregistre une fois sorti. */
const SWIM_TYPES = ["Échauffement", "Éducatifs", "Technique", "Série principale", "Série", "Jambes", "Bras", "Retour au calme"];
const SWIM_STROKES = ["Crawl", "Dos", "Brasse", "Papillon", "4 nages", "Au choix"];
const SWIM_GEAR = ["—", "Pull-buoy", "Plaquettes", "Palmes", "Planche", "Tuba"];
const swimSample = () => ({ id: newId("n"), name: "Endurance 1 400 m", pool: 25, pace: 150, days: [], blocks: [
        { t: "Échauffement", reps: 1, d: 200, nage: "Crawl", mat: "—", mode: "rest", dep: 0, rest: 0, note: "souple" },
        { t: "Éducatifs", reps: 4, d: 50, nage: "Crawl", mat: "Planche", mode: "rest", dep: 0, rest: 20, note: "" },
        { t: "Série principale", reps: 8, d: 50, nage: "Crawl", mat: "—", mode: "dep", dep: 75, rest: 0, note: "" },
        { t: "Série", reps: 4, d: 100, nage: "Crawl", mat: "Pull-buoy", mode: "rest", dep: 0, rest: 20, note: "" },
        { t: "Retour au calme", reps: 1, d: 200, nage: "Dos", mat: "—", mode: "rest", dep: 0, rest: 0, note: "" }] });
const swimDist = m => (m?.blocks || []).reduce((a, b) => a + (parseInt(b.reps) || 0) * (parseInt(b.d) || 0), 0);
const swimDur = m => (m?.blocks || []).reduce((a, b) => { const r = parseInt(b.reps) || 0, d = parseInt(b.d) || 0; return a + (b.mode === "dep" && b.dep ? r * b.dep : r * (d / 100 * (m.pace || 150) + (parseInt(b.rest) || 0))); }, 0);
const fmtDur = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return h ? h + "h" + String(m).padStart(2, "0") : m + ":" + String(r).padStart(2, "0"); };
/* « 38:30 », « 38 », « 1:05:00 », « 45 min » → secondes */
function parseDur(str) { const t = String(str || "").trim().toLowerCase(); if (!t)
    return 0; const hm = t.match(/^(\d+)\s*h\s*(\d{0,2})$/); if (hm)
    return +hm[1] * 3600 + (+hm[2] || 0) * 60; const p = t.replace(/min|mn|'/g, "").split(/[:.,]/).map(x => parseInt(x) || 0); if (p.length === 3)
    return p[0] * 3600 + p[1] * 60 + p[2]; if (p.length === 2)
    return p[0] * 60 + p[1]; return p[0] * 60; }
const swimPace = (dist, sec) => dist > 0 && sec > 0 ? sec / dist * 100 : null;
/* Dépense : MET selon l'allure (ou le ressenti), × poids × durée */
function swimKcal(dist, sec, rpe, kg) { const p = swimPace(dist, sec); const met = p ? (p < 110 ? 10 : p < 140 ? 8.3 : p < 180 ? 7 : 5.8) : (rpe >= 8 ? 9.5 : rpe >= 6 ? 8 : 6); return Math.round(met * (kg || 100) * sec / 3600); }
const swimKcalOn = (logs, iso) => (logs || []).filter(l => l.dateISO === iso).reduce((a, l) => a + (l.kcal || 0), 0);
const swimPlannedFor = (models, iso) => { const d = new Date(iso + "T12:00:00").getDay(); return (models || []).find(m => (m.days || []).includes(d)) || null; };
const swimDaysCount = models => new Set((models || []).flatMap(m => m.days || [])).size;
const swimBlockLine = b => (b.reps > 1 ? b.reps + " × " : "") + b.d + " m " + String(b.nage).toLowerCase() + (b.mat && b.mat !== "—" ? " · " + b.mat.toLowerCase() : "") + (b.mode === "dep" && b.dep ? " · départ toutes les " + fmtMMSS(b.dep) : b.rest ? " · " + b.rest + " s de repos" : "") + (b.note ? " · " + b.note : "");
const mondayOf = iso => { const d = new Date(iso + "T12:00:00"), k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return _isoD(d); };
function SwimEditor({ model, onSave, onCancel }) {
    const [m, setM] = useState(() => JSON.parse(JSON.stringify(model)));
    const upd = fn => setM(x => { const n = JSON.parse(JSON.stringify(x)); fn(n); return n; });
    const sel = (val, opts, onCh, label) => hx("select", { value: val, "aria-label": label, onChange: e => onCh(e.target.value), style: { ...inputStyle, padding: "7px 6px", fontSize: 14 } }, opts.map(o => hx("option", { key: o }, o)));
    const num = (bi, k, label) => hx("label", { style: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 } }, hx("span", { style: { fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.textMut } }, label), hx("input", { type: "text", inputMode: "numeric", value: m.blocks[bi][k] ?? "", onChange: e => { const v = e.target.value; upd(x => { x.blocks[bi][k] = v; }); }, style: PM.num }));
    const clean = { ...m, blocks: m.blocks.map(b => ({ ...b, reps: parseInt(b.reps) || 1, d: parseInt(b.d) || m.pool, dep: parseInt(b.dep) || 0, rest: parseInt(b.rest) || 0 })) };
    const dist = swimDist(clean);
    return hx("div", null,
        hx("button", { onClick: onCancel, style: PM.mini(false) }, "← Mes séances"),
        hx("div", { style: { ...PM.h1, marginTop: 12 } }, "Séance de natation"),
        hx("div", { style: PM.lbl }, "Nom"),
        hx("input", { value: m.name, onChange: e => { const v = e.target.value; upd(x => { x.name = v; }); }, style: inputStyle, placeholder: "Ex : Endurance 1 500 m" }),
        hx("div", { style: PM.lbl }, "Jours prévus"),
        hx("div", { style: { display: "flex", gap: 5 } }, DOW_ORDER.map(d => { const on = (m.days || []).includes(d); return hx("button", { key: d, onClick: () => upd(x => { x.days = on ? x.days.filter(y => y !== d) : [...(x.days || []), d]; }), style: { flex: 1, padding: "9px 0", borderRadius: 4, border: `2px solid ${C.ink}`, background: on ? C.swim : C.surface, color: on ? "#fff" : C.ink, fontWeight: 800, cursor: "pointer" } }, DOW_SHORT[d][0]); })),
        hx("div", { style: PM.lbl }, "Bassin et allure visée"),
        hx("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" } },
            [25, 50].map(p => hx("button", { key: p, onClick: () => upd(x => { x.pool = p; }), style: PM.mini(m.pool === p) }, p + " m")),
            hx("button", { onClick: () => upd(x => { x.pace = Math.max(60, (x.pace || 150) - 5); }), style: PM.mini(false), "aria-label": "Allure plus rapide" }, "−"),
            hx("b", { style: { fontFamily: AN, fontWeight: 400, fontSize: 20 } }, fmtMMSS(m.pace || 150) + " /100 m"),
            hx("button", { onClick: () => upd(x => { x.pace = (x.pace || 150) + 5; }), style: PM.mini(false), "aria-label": "Allure plus lente" }, "+")),
        m.blocks.map((b, bi) => hx("div", { key: bi, style: { border: `2px solid ${C.ink}`, borderRadius: 6, background: C.surface, marginTop: 10, padding: "10px 12px" } },
            hx("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                hx("div", { style: { flex: 1, minWidth: 0 } }, sel(b.t, SWIM_TYPES, v => upd(x => { x.blocks[bi].t = v; }), "Type de bloc")),
                hx("b", { style: { fontFamily: AN, fontWeight: 400, fontSize: 19, color: C.swim, whiteSpace: "nowrap" } }, ((parseInt(b.reps) || 0) * (parseInt(b.d) || 0)) + " m"),
                hx("button", { "aria-label": "Monter", style: PM.sq, onClick: () => upd(x => { if (bi > 0)
                        [x.blocks[bi - 1], x.blocks[bi]] = [x.blocks[bi], x.blocks[bi - 1]]; }) }, "↑"),
                hx("button", { "aria-label": "Supprimer le bloc", style: { ...PM.sq, color: C.danger }, onClick: () => upd(x => { x.blocks.splice(bi, 1); }) }, "✕")),
            hx("div", { style: { display: "flex", gap: 6, marginTop: 8 } }, num(bi, "reps", "Répét."), num(bi, "d", "Distance m"), b.mode === "dep" ? num(bi, "dep", "Départ (s)") : num(bi, "rest", "Repos (s)")),
            hx("div", { style: { display: "flex", gap: 6, marginTop: 6 } },
                hx("div", { style: { flex: 1 } }, sel(b.nage, SWIM_STROKES, v => upd(x => { x.blocks[bi].nage = v; }), "Nage")),
                hx("div", { style: { flex: 1 } }, sel(b.mat, SWIM_GEAR, v => upd(x => { x.blocks[bi].mat = v; }), "Matériel")),
                hx("button", { onClick: () => upd(x => { const y = x.blocks[bi]; if (y.mode === "dep") {
                        y.mode = "rest";
                        y.rest = 20;
                    }
                    else {
                        y.mode = "dep";
                        y.dep = Math.round(((parseInt(y.d) || 50) / 100 * (x.pace || 150) + 15) / 5) * 5;
                    } }), style: { ...PM.mini(false), alignSelf: "stretch" } }, b.mode === "dep" ? "→ repos" : "→ départ")),
            hx("input", { value: b.note || "", placeholder: "Consigne (optionnel)", onChange: e => { const v = e.target.value; upd(x => { x.blocks[bi].note = v; }); }, style: { ...inputStyle, marginTop: 6, fontSize: 14, padding: "7px 9px" } }))),
        hx("button", { onClick: () => upd(x => { x.blocks.push({ t: "Série", reps: 4, d: 100, nage: "Crawl", mat: "—", mode: "rest", dep: 0, rest: 20, note: "" }); }), style: { ...PM.out, marginTop: 10 } }, "+ Ajouter un bloc"),
        hx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: `2px solid ${C.ink}`, marginTop: 14 } }, [[dist.toLocaleString("fr-FR") + " m", "distance"], ["~" + Math.round(swimDur(clean) / 60) + " min", "durée"], [Math.round(dist / (m.pool || 25)), "longueurs"]].map(([v, l], i) => hx("div", { key: l, style: { padding: "10px 0 10px " + (i ? "10px" : 0), borderBottom: `2px solid ${C.ink}`, borderLeft: i ? `2px solid ${C.ink}` : "none" } }, hx("b", { style: { display: "block", fontFamily: AN, fontWeight: 400, fontSize: 28, lineHeight: 1 } }, v), hx("span", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.textMut } }, l)))),
        hx("button", { onClick: () => { if (!clean.blocks.length)
                return toast("Ajoute au moins un bloc", { tone: "danger" }); onSave({ ...clean, name: (clean.name || "").trim() || "Séance " + dist + " m" }); }, style: { ...PM.btn, marginTop: 14, background: C.swim, borderColor: C.swim } }, "Enregistrer la séance type"));
}
function NatationSection() {
    const [models, setModels] = useStored("natation-modeles", []);
    const [logs, setLogs] = useStored("natation-logs", []);
    const [nLogs] = useStored("nutri-logs", []);
    const [sub, setSub] = useState("today");
    const [editing, setEditing] = useState(null);
    const [pick, setPick] = useState(null);
    const today = isoToday();
    const planned = swimPlannedFor(models, today);
    const model = pick === "libre" ? null : (models.find(m => m.id === pick) || planned || models[0] || null);
    const weigh = nLogs.filter(l => l.weight > 0).map(l => ({ dateISO: l.dateISO, kg: l.weight })), kg = avgRecent(weigh, 7) || 100;
    const [f, setF] = useState({ date: today, dist: "", dur: "", rpe: 6, nage: "Crawl", note: "" });
    useEffect(() => { setF(x => ({ ...x, dist: model ? String(swimDist(model)) : "", dur: model ? fmtDur(swimDur(model)) : "", nage: model?.blocks?.[0]?.nage || "Crawl" })); }, [model?.id]);
    const dist = parseInt(f.dist) || 0, dur = parseDur(f.dur), pace = swimPace(dist, dur), kcal = dist && dur ? swimKcal(dist, dur, f.rpe, kg) : 0;
    const saveLog = async () => {
        if (!dist || !dur)
            return toast("Indique la distance et la durée", { tone: "danger" });
        const e = { id: Date.now(), dateISO: f.date, date: fmtDateShort(f.date), modele: model ? model.name : "Séance libre", distance: dist, duree: dur, rpe: f.rpe, nage: f.nage, pool: model?.pool || 25, note: f.note.trim(), kcal };
        await setLogs([...logs, e]);
        toast("🏊 " + dist.toLocaleString("fr-FR") + " m enregistrés · " + fmtMMSS(Math.round(pace)) + " /100 m · +" + kcal + " kcal");
        setF(x => ({ ...x, note: "" }));
    };
    const tabs = hx("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } }, [["today", "Aujourd'hui"], ["models", "Mes séances"], ["hist", "Historique"]].map(([k, l]) => hx(Pill, { key: k, active: sub === k, onClick: () => { setSub(k); setEditing(null); }, color: C.swim }, l)));
    if (editing)
        return hx(SwimEditor, { model: editing, onCancel: () => setEditing(null), onSave: async m => { await setModels(models.some(x => x.id === m.id) ? models.map(x => x.id === m.id ? m : x) : [...models, m]); setEditing(null); setPick(m.id); toast("✓ « " + m.name + " » enregistrée"); } });
    if (sub === "models")
        return hx("div", null, tabs,
            hx("div", { style: PM.h1 }, "Mes séances"),
            hx("p", { style: PM.lead }, "Tes séances types : blocs, nages, matériel, départs ou repos. Donne-leur des jours pour qu'elles apparaissent dans l'affiche du jour."),
            hx("div", { style: { borderTop: `2px solid ${C.ink}` } }, models.map(m => hx("div", { key: m.id, style: { display: "flex", alignItems: "center", gap: 8, padding: "12px 0", borderBottom: `2px solid ${C.ink}` } },
                hx("div", { style: { flex: 1, minWidth: 0 } }, hx("b", { style: { display: "block", fontSize: 17, fontWeight: 750 } }, m.name), hx("small", { style: { fontSize: 12, color: C.textMut, fontWeight: 600 } }, swimDist(m).toLocaleString("fr-FR") + " m · ~" + Math.round(swimDur(m) / 60) + " min · bassin " + m.pool + " m · " + (DOW_ORDER.filter(d => (m.days || []).includes(d)).map(d => DOW_SHORT[d].toLowerCase()).join(", ") || "aucun jour"))),
                hx("button", { onClick: () => setEditing(m), style: PM.mini(false) }, "Modifier"),
                hx("button", { onClick: () => setEditing({ ...JSON.parse(JSON.stringify(m)), id: newId("n"), name: m.name + " (copie)", days: [] }), style: PM.mini(false) }, "Copier"),
                hx("button", { "aria-label": "Supprimer", onClick: async () => { if (await askConfirm({ title: "Supprimer « " + m.name + " » ?", message: "Les séances déjà enregistrées restent dans l'historique.", confirmLabel: "Supprimer", danger: true }))
                        commitWithUndo("natation-modeles", models, models.filter(x => x.id !== m.id), setModels, "🗑️ Séance type supprimée"); }, style: { ...PM.mini(false), color: C.danger, borderColor: C.danger } }, "✕"))),
                !models.length && hx("p", { style: { ...PM.lead, padding: "12px 0" } }, "Aucune séance type pour l'instant.")),
            hx("button", { onClick: () => setEditing(models.length ? { ...swimSample(), name: "", blocks: [{ t: "Échauffement", reps: 1, d: 200, nage: "Crawl", mat: "—", mode: "rest", dep: 0, rest: 0, note: "" }] } : swimSample()), style: { ...PM.btn, marginTop: 14, background: C.swim, borderColor: C.swim } }, models.length ? "+ Nouvelle séance" : "+ Créer ma première séance (exemple prérempli)"));
    if (sub === "hist") {
        const W = 320, H = 120, weeks = Array.from({ length: 8 }, (_, i) => mondayOf(shiftISO(today, -7 * (7 - i))));
        const byW = weeks.map(w => logs.filter(l => mondayOf(l.dateISO) === w).reduce((a, l) => a + l.distance, 0));
        const mx = Math.max(...byW, 1), bw = (W - 10) / 8;
        const best = min => { const c = logs.filter(l => l.distance >= min && l.duree); return c.length ? c.reduce((a, l) => swimPace(l.distance, l.duree) < swimPace(a.distance, a.duree) ? l : a) : null; };
        const recs = [["Plus longue séance", logs.length ? Math.max(...logs.map(l => l.distance)).toLocaleString("fr-FR") + " m" : "—"], ...[[400, "≥ 400 m"], [1000, "≥ 1 000 m"], [2000, "≥ 2 000 m"]].map(([mn, l]) => { const b = best(mn); return ["Meilleure allure " + l, b ? fmtMMSS(Math.round(swimPace(b.distance, b.duree))) + " /100 m" : "—"]; }), ["Plus grosse semaine", Math.max(0, ...byW).toLocaleString("fr-FR") + " m"]];
        return hx("div", null, tabs,
            hx("div", { style: { ...PM.h1, fontSize: 64 } }, byW[7].toLocaleString("fr-FR") + " m"),
            hx("p", { style: PM.lead }, "nagés cette semaine · " + logs.filter(l => withinDays(l.dateISO, 30)).length + " séance(s) sur 30 jours · " + logs.filter(l => withinDays(l.dateISO, 30)).reduce((a, l) => a + (l.kcal || 0), 0).toLocaleString("fr-FR") + " kcal"),
            hx("svg", { viewBox: `0 0 ${W} ${H + 22}`, style: { width: "100%", height: "auto", display: "block" } }, byW.map((v, i) => hx("g", { key: i },
                hx("rect", { x: 5 + i * bw + 5, y: H - v / mx * (H - 18), width: bw - 10, height: Math.max(v / mx * (H - 18), 1), fill: i === 7 ? C.swim : C.ink }),
                v > 0 && hx("text", { x: 5 + i * bw + bw / 2, y: H - v / mx * (H - 18) - 5, textAnchor: "middle", fontFamily: "Anton, Impact, sans-serif", fontSize: 12, fill: C.ink }, v >= 1000 ? (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "k" : v),
                hx("text", { x: 5 + i * bw + bw / 2, y: H + 16, textAnchor: "middle", fontSize: 10, fontWeight: 700, fill: C.textMut }, weeks[i].slice(8, 10) + "/" + weeks[i].slice(5, 7))))),
            hx("div", { style: PM.lbl }, "Records"),
            hx("div", { style: { borderTop: `2px solid ${C.ink}` } }, recs.map(([a, b]) => hx("div", { key: a, style: { display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 0", borderBottom: `2px solid ${C.ink}`, fontSize: 14.5, fontWeight: 700 } }, hx("span", null, a), hx("em", { style: { fontStyle: "normal", fontFamily: AN, fontSize: 20, whiteSpace: "nowrap" } }, b)))),
            hx("div", { style: PM.lbl }, "Séances"),
            !logs.length ? hx("p", { style: PM.lead }, "Aucune séance enregistrée.") : [...logs].sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.id - a.id).slice(0, 40).map(l => hx(Card, { key: l.id, style: { padding: "10px 12px" } },
                hx("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    hx("div", { style: { flex: 1, minWidth: 0 } },
                        hx("b", { style: { fontSize: 14.5, fontWeight: 750 } }, l.distance.toLocaleString("fr-FR") + " m · " + fmtDur(l.duree)),
                        hx("div", { style: { fontSize: 12, color: C.textMut, marginTop: 2 } }, l.date + " · " + l.modele + " · " + l.nage + " · RPE " + l.rpe + " · " + (l.kcal || 0) + " kcal" + (l.note ? " · " + l.note : ""))),
                    hx("b", { style: { fontFamily: AN, fontWeight: 400, fontSize: 20, color: C.swim, whiteSpace: "nowrap" } }, fmtMMSS(Math.round(swimPace(l.distance, l.duree) || 0))),
                    hx("button", { "aria-label": "Supprimer", onClick: () => commitWithUndo("natation-logs", logs, logs.filter(x => x.id !== l.id), setLogs, "🗑️ Séance supprimée"), style: { border: 0, background: "none", color: C.textMut, fontSize: 15, cursor: "pointer" } }, "✕")))));
    }
    // Aujourd'hui : l'affiche bleue de la séance prévue, puis l'enregistrement une fois sorti de l'eau
    const todayLogs = logs.filter(l => l.dateISO === today);
    return hx("div", null, tabs,
        models.length > 1 && hx("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 } }, [...models.map(m => [m.id, m.name]), ["libre", "Séance libre"]].map(([k, l]) => hx("button", { key: k, onClick: () => setPick(k), style: PM.mini((pick || (planned ? planned.id : models[0].id)) === k) }, l))),
        model ? hx("div", { style: { background: C.swim, color: "#fff", margin: "0 -14px 14px", padding: "14px 16px 18px" } },
            hx("div", { style: { fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: .9 } }, (planned && planned.id === model.id ? "Prévue aujourd'hui · " : "") + model.name),
            hx("div", { style: { fontFamily: AN, fontSize: "clamp(80px, 26vw, 116px)", lineHeight: .86, margin: "6px -2px 8px", textTransform: "uppercase" } }, swimDist(model).toLocaleString("fr-FR") + " m"),
            hx("p", { style: { fontSize: 14.5, fontWeight: 700, lineHeight: 1.35, margin: "0 0 12px" } }, "~" + Math.round(swimDur(model) / 60) + " min · bassin " + model.pool + " m · " + Math.round(swimDist(model) / model.pool) + " longueurs · allure visée " + fmtMMSS(model.pace) + " /100 m"),
            hx("div", { style: { borderTop: "2px solid #fff" } }, model.blocks.map((b, i) => hx("div", { key: i, style: { padding: "10px 0", borderBottom: "2px solid #fff" } },
                hx("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" } }, hx("b", { style: { fontSize: 18, fontWeight: 750 } }, b.t), hx("span", { style: { fontFamily: AN, fontSize: 20, whiteSpace: "nowrap" } }, (b.reps * b.d).toLocaleString("fr-FR") + " m")),
                hx("div", { style: { fontSize: 13, fontWeight: 600, opacity: .92, marginTop: 2 } }, swimBlockLine(b))))))
            : hx(Card, null, hx("div", { style: { fontSize: 14, lineHeight: 1.45 } }, models.length ? "Séance libre : enregistre simplement ta distance et ta durée." : "Aucune séance type. Crée-en une dans « Mes séances », ou enregistre une séance libre ci-dessous."), !models.length && hx("button", { onClick: () => setEditing(swimSample()), style: { ...PM.btn, marginTop: 10, background: C.swim, borderColor: C.swim } }, "Créer ma première séance")),
        todayLogs.length > 0 && hx("div", { style: { background: C.green, color: "#fff", borderRadius: 6, padding: "10px 12px", marginBottom: 12, fontWeight: 700, fontSize: 14 } }, "✓ Aujourd'hui : " + todayLogs.map(l => l.distance.toLocaleString("fr-FR") + " m en " + fmtDur(l.duree)).join(" + ") + " · +" + swimKcalOn(logs, today) + " kcal ajoutées à ta cible"),
        hx("div", { style: { fontFamily: AN, fontSize: 30, textTransform: "uppercase", margin: "6px 0 4px" } }, "J'ai nagé"),
        hx("p", { style: PM.lead }, "Remplis en sortant de l'eau : distance, durée et ressenti."),
        hx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
            hx("label", null, hx("div", { style: { ...PM.lbl, margin: "0 0 4px" } }, "Distance (m)"), hx("input", { type: "text", inputMode: "numeric", value: f.dist, onChange: e => setF({ ...f, dist: e.target.value }), style: inputStyle })),
            hx("label", null, hx("div", { style: { ...PM.lbl, margin: "0 0 4px" } }, "Durée (min:s)"), hx("input", { type: "text", inputMode: "decimal", value: f.dur, placeholder: "38:30", onChange: e => setF({ ...f, dur: e.target.value }), style: inputStyle }))),
        hx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 } },
            hx("label", null, hx("div", { style: { ...PM.lbl, margin: "0 0 4px" } }, "Date"), hx("input", { type: "date", value: f.date, max: today, onChange: e => e.target.value && setF({ ...f, date: e.target.value }), style: { ...inputStyle, colorScheme: "light" } })),
            hx("label", null, hx("div", { style: { ...PM.lbl, margin: "0 0 4px" } }, "Nage principale"), hx("select", { value: f.nage, onChange: e => setF({ ...f, nage: e.target.value }), style: inputStyle }, SWIM_STROKES.map(s => hx("option", { key: s }, s))))),
        hx("div", { style: PM.lbl }, "Ressenti (RPE " + f.rpe + "/10)"),
        hx("div", { style: { display: "flex", gap: 4 } }, [3, 4, 5, 6, 7, 8, 9, 10].map(v => hx("button", { key: v, onClick: () => setF({ ...f, rpe: v }), style: { flex: 1, padding: "9px 0", borderRadius: 4, border: `2px solid ${C.ink}`, background: f.rpe === v ? C.ink : C.surface, color: f.rpe === v ? "#fff" : C.ink, fontWeight: 800, cursor: "pointer" } }, v))),
        hx("input", { value: f.note, onChange: e => setF({ ...f, note: e.target.value }), placeholder: "Note (optionnel) : sensations, plaquettes…", style: { ...inputStyle, marginTop: 8 } }),
        dist > 0 && dur > 0 && hx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `2px solid ${C.ink}`, marginTop: 12 } }, [[fmtMMSS(Math.round(pace)), "allure /100 m"], ["+" + kcal, "kcal dépensées"]].map(([v, l], i) => hx("div", { key: l, style: { padding: "10px 0 10px " + (i ? "12px" : 0), borderBottom: `2px solid ${C.ink}`, borderLeft: i ? `2px solid ${C.ink}` : "none" } }, hx("b", { style: { display: "block", fontFamily: AN, fontWeight: 400, fontSize: 32, lineHeight: 1 } }, v), hx("span", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.textMut } }, l)))),
        hx("button", { onClick: saveLog, style: { ...PM.btn, marginTop: 12, background: C.swim, borderColor: C.swim } }, "Enregistrer ma séance"));
}
function SportSection({ initialTab } = {}) {
    const [tab, setTab] = useState(initialTab || "resume");
    const [openS, setOpenS] = useState("A");
    const [actS, setActS] = useState(salleSeances[0].id);
    const [actP, setActP] = useStored("sport-phase", 0);
    const [sciCfg, setSciCfg] = useStored("science-config", SCI_DEFAULT);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [sLogs] = useStored("sport-logs", []);
    const [mLogs] = useStored("maison-logs", []);
    const [nLogs] = useStored("nutri-logs", []);
    const prog = resolveProgramme(profile, sLogs);
    const [suiviPick, setSuiviProg] = useState(null);
    const suiviProg = suiviPick || (prog === "maison" ? "maison" : "salle"); // suit le programme une fois les séances chargées
    const saveSci = (patch) => setSciCfg({ ...sciCfg, ...patch });
    // Semaine du programme depuis la toute première séance (maison ou salle) → phase conseillée
    const firstISO = [...sLogs, ...mLogs].map(l => l.dateISO).sort()[0];
    const weekN = firstISO ? Math.floor(daysBetween(firstISO, isoToday()) / 7) + 1 : null;
    const suggestedP = weekN == null ? null : weekN <= 4 ? 0 : weekN <= 8 ? 1 : weekN <= 12 ? 2 : 3;
    const weighs = nLogs.filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const startW = weighs.length ? weighs[0].weight : 130, curW = weighs.length ? weighs[weighs.length - 1].weight : null;
    const pr = normProfile(profile);
    const profilCards = [
        { l: "Poids", v: (curW || startW) + " kg", s: curW && curW !== startW ? "départ " + startW + " kg (" + (curW - startW > 0 ? "+" : "") + Math.round((curW - startW) * 10) / 10 + ")" : "départ" },
        { l: "Semaine", v: weekN ? "S" + weekN : "—", s: suggestedP != null ? phases[suggestedP].ph + " conseillée" : "aucune séance" },
        { l: "Fréquence", v: programmeDays(prog).length + "j/sem", s: progInfo(prog).label.toLowerCase() + " · lever " + pr.reveil },
        pr.owner ? profil[3] : { l: "Niveau", v: LEVELS[LEVEL - 1].name, s: "niveau " + LEVEL + " sur 4" },
    ];
    const phaseHint = suggestedP != null && suggestedP !== actP && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: C.textMut, background: C.surfaceAlt, borderRadius: 10, padding: "7px 10px", marginBottom: 10 } },
        React.createElement("span", { style: { flex: 1 } }, "📆 Semaine " + weekN + " du programme → ", React.createElement("b", { style: { color: phases[suggestedP].c } }, phases[suggestedP].ph), " conseillée."),
        React.createElement("button", { onClick: () => { setActP(suggestedP); toast("🎯 " + phases[suggestedP].ph + " appliquée"); }, style: { padding: "4px 10px", borderRadius: 8, border: `1px solid ${phases[suggestedP].c}`, background: "transparent", color: phases[suggestedP].c, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, "Appliquer"));
    const se = salleSeances.find(s => s.id === actS) || salleSeances[0];
    const custom = ACTIVE_GYM !== "salle";
    const tabs = [["resume", "Résumé"], ["maison", "Maison"], ["salle", custom ? "🏋️ " + progInfo(ACTIVE_GYM).label : "Salle"], ["natation", "🏊 Natation"], ["programmes", "📋 Programmes"], ["progression", "Progression"], ["suivi", "📊 Suivi"], ["rm", lx("💪 Max estimés", "💪 Plan RM")], ["coach", "🧠 Coach"], ["douleur", "🩹 Douleur"], ["conseils", "Conseils"]].filter(([k]) => tabOk("sport", k) && (k !== "maison" || LEVEL >= 4 || prog === "maison") && (k !== "salle" || LEVEL >= 4 || prog !== "maison"));
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 } }, tabs.map(([k, l]) => React.createElement(Pill, { key: k, active: tab === k, onClick: () => setTab(k), color: C.amber }, l))),
        tab === "resume" && React.createElement("div", null,
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } }, profilCards.map(p => React.createElement(Card, { key: p.l },
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: .5 } }, p.l),
                React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: C.amberLight, margin: "3px 0 1px" } }, p.v),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut } }, p.s)))),
            React.createElement(Card, { border: C.danger + "33" },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 8 } }, "⚠️ Règles de sécurité"),
                (pr.owner ? regles : REGLES_GEN).map((r, i) => React.createElement("div", { key: i, style: { fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: 6, paddingLeft: 12, position: "relative" } },
                    React.createElement("span", { style: { position: "absolute", left: 0, color: C.danger } }, "•"),
                    r))),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 8 } }, "🔥 Échauffement"),
                echauffement.map((e, i) => React.createElement("div", { key: i, style: { fontSize: 12, color: C.textMut, lineHeight: 1.7 } }, e)))),
        tab === "maison" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12 } }, maison.map(s => React.createElement(Pill, { key: s.code, active: openS === s.code, onClick: () => setOpenS(s.code), color: C.amber },
                s.code,
                "·",
                s.jour.slice(0, 3)))),
            maison.filter(s => s.code === openS).map(s => React.createElement(Card, { key: s.code },
                React.createElement("div", { style: { fontSize: 15, fontWeight: 800 } },
                    "Séance ",
                    s.code,
                    " — ",
                    s.titre),
                React.createElement("div", { style: { fontSize: 11, color: C.amber, margin: "3px 0 12px" } }, s.format),
                s.ex.map((e, i) => React.createElement("div", { key: i, style: { display: "flex", gap: 8, alignItems: "baseline", padding: "6px 0", borderTop: i ? `1px solid ${C.borderSoft}` : "none" } },
                    React.createElement("span", { style: { color: C.amberLight, fontWeight: 700, fontSize: 11 } }, String(i + 1).padStart(2, "0")),
                    React.createElement("span", { style: { fontSize: 12.5 } }, e))),
                s.note && React.createElement("div", { style: { marginTop: 10, fontSize: 11, color: C.textMut, fontStyle: "italic", borderLeft: `2px solid ${C.amber}`, paddingLeft: 8 } }, s.note))),
            React.createElement(Card, { border: C.borderSoft },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 } }, "🧘 Étirements"),
                etirements.map((e, i) => React.createElement("div", { key: i, style: { fontSize: 11.5, color: C.textMut, lineHeight: 1.7 } }, e)))),
        tab === "natation" && React.createElement(NatationSection, null),
        tab === "programmes" && React.createElement(ProgrammesManager, null),
        tab === "salle" && React.createElement("div", null,
            custom && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, border: `2px solid ${C.ink}`, borderRadius: 6, padding: "9px 12px", marginBottom: 12, fontSize: 13, fontWeight: 700 } },
                React.createElement("span", { style: { flex: 1 } }, "Programme perso actif : « " + progInfo(ACTIVE_GYM).label + " ». Charges, fourchettes et repos viennent de ton programme, puis le coach les fait progresser."),
                React.createElement("button", { onClick: () => setTab("programmes"), style: { padding: "6px 10px", borderRadius: 999, border: `1.5px solid ${C.ink}`, background: "transparent", fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" } }, "Modifier")),
            !custom && phaseHint,
            !custom && React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" } }, phases.map((p, i) => React.createElement("button", { key: i, onClick: () => setActP(i), style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${actP === i ? p.c : "transparent"}`, cursor: "pointer", fontSize: 10, fontWeight: 700, background: actP === i ? p.c + "22" : C.surfaceAlt, color: actP === i ? p.c : C.textDim } }, p.sem))),
            !custom && React.createElement("div", { style: { background: C.surfaceAlt, border: `1px solid ${phases[actP].c}44`, borderRadius: 10, padding: "6px 12px", marginBottom: 12, fontSize: 11, color: phases[actP].c, fontWeight: 700 } },
                phases[actP].ph,
                " — ",
                phases[actP].pct,
                " — ",
                phases[actP].but),
            React.createElement("button", { onClick: () => saveSci({ deload: !sciCfg.deload }), style: { width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${(sciCfg?.deload) ? "#5B4FE0" : C.border}`, background: (sciCfg?.deload) ? "#5B4FE022" : "transparent", color: (sciCfg?.deload) ? "#4A3FCB" : C.textMut, fontSize: 12, fontWeight: 800, cursor: "pointer", marginBottom: (sciCfg?.deload) ? 6 : 12 } },
                "🪶 Semaine de décharge (−40%) ",
                (sciCfg?.deload) ? "· ACTIVE ✓" : ""),
            (sciCfg?.deload) && React.createElement("div", { style: { fontSize: 10.5, color: "#4A3FCB", background: "#5B4FE015", border: "1px solid #5B4FE033", borderRadius: 8, padding: "8px 11px", marginBottom: 12, lineHeight: 1.5 } },
                "Toutes les charges ci-dessous sont déjà à ",
                React.createElement("b", null, "−40 %"),
                ". Garde le même nombre de séries et de reps, juste plus léger — c'est fait pour récupérer. Pense à le désactiver la semaine prochaine."),
            React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 14, overflowX: "auto" } }, salleSeances.map(s => React.createElement("button", { key: s.id, onClick: () => setActS(s.id), style: { padding: "7px 12px", borderRadius: 999, border: `2px solid ${actS === s.id ? s.couleur : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: actS === s.id ? s.couleur + "22" : C.surfaceAlt, color: actS === s.id ? s.couleur : C.textMut } },
                s.emoji,
                " ",
                s.id))),
            React.createElement("div", { style: { background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 10.5, color: C.textMut, lineHeight: 1.5 } },
                "📖 ",
                React.createElement("b", { style: { color: C.amberLight } }, "4×8-10"),
                " = 4 séries de 8 à 10 répétitions · ",
                React.createElement("b", { style: { color: C.text } }, "/j"),
                " = par jambe · ",
                React.createElement("b", { style: { color: C.text } }, "/côté"),
                " = par côté · ",
                React.createElement("b", { style: { color: C.text } }, "s"),
                " = secondes. " + (custom ? "Le poids affiché = charge de ton programme. " : "Le poids affiché = charge cible pour la phase choisie ci-dessus. ") + "Repos indiqué ",
                React.createElement("b", { style: { color: C.text } }, "⏱ par exercice"),
                " (2-3 min sur les gros mouvements lourds, 45-90 s sur l'isolation).",
                React.createElement("div", { style: { marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("b", { style: { color: C.amberLight } }, "Abréviations"),
                    " — DC : développé couché · DI : développé incliné · DM : développé militaire · RDL : soulevé de terre roumain (ischios/fessiers).")),
            React.createElement(Card, { border: se.couleur + "33" },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 2 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800 } },
                        se.emoji,
                        " ",
                        se.id),
                    React.createElement("div", { style: { fontSize: 11, color: se.couleur, fontWeight: 700 } }, se.jour)),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 14 } }, se.focus),
                se.exercices.map((ex, i) => { const sciKey = se.id + ":" + ex.nom; const sciW = sciCfg?.weightOverrides?.[sciKey]; const sciR = sciW ? repOverrideFor(sciCfg, sciKey) : null; const cr = currentRangeFor(sLogs, sciCfg, se.id, ex.nom); const crCol = cr?.src === "science" ? C.blue : C.green; return React.createElement("div", { key: i, style: { padding: "10px 0", borderTop: i ? `1px solid ${C.borderSoft}` : "none" } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 3 } },
                        React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "baseline" } },
                            React.createElement("span", { style: { color: se.couleur, fontWeight: 800, fontSize: 11 } }, String(i + 1).padStart(2, "0")),
                            React.createElement("span", { style: { fontSize: 13, fontWeight: 700 } }, ex.nom)),
                        // Fourchette en cours (Science 🔬 ou cycle de progression 🔁) : remplace celle du programme
                        cr ? React.createElement("span", { style: { fontSize: 11, color: crCol, fontWeight: 800 } }, detailWithRange(ex.detail, cr.range) + (cr.src === "science" ? " 🔬" : " 🔁"), detailWithRange(ex.detail, cr.range) !== ex.detail && React.createElement("span", { style: { color: C.textDim, fontWeight: 400, textDecoration: "line-through", marginLeft: 5 } }, ex.detail))
                            : React.createElement("span", { style: { fontSize: 11, color: C.amberLight, fontWeight: 700 } }, ex.detail)),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginLeft: 19, marginTop: 3, flexWrap: "wrap" } },
                        React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: se.custom ? C.textMut : phases[actP].c, background: se.custom ? C.surfaceAlt : phases[actP].c + "18", padding: "2px 7px", borderRadius: 5 } }, se.custom ? "Charge" : phases[actP].sem),
                        React.createElement("span", { style: { fontSize: 12, fontWeight: 700 } }, (() => { const _b = parseFloat(ex.charges[actP]); return (sciCfg?.deload) ? (isNaN(_b) ? ex.charges[actP] : Math.round(_b * 0.6 * 2) / 2 + "kg") : ex.charges[actP]; })()),
                        sciW && !(sciCfg?.deload) && React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: C.blue, background: C.blue + "18", padding: "2px 8px", borderRadius: 5 } },
                            "🔬 ",
                            sciW,
                            "kg",
                            sciR && cr?.src === "science" ? " × " + fmtRange(sciR) + " reps" : ""),
                        (sciCfg?.deload) && React.createElement("span", { style: { fontSize: 10, color: "#5B4FE0", background: "#5B4FE015", padding: "2px 7px", borderRadius: 5 } }, "🔄 −40%"),
                        React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: C.textMut, background: C.surfaceAlt, padding: "2px 7px", borderRadius: 5 } },
                            "⏱ ",
                            reposFor(se.id, ex.nom))),
                    !se.custom && React.createElement("div", { style: { display: "flex", gap: 10, marginLeft: 19, marginTop: 4, flexWrap: "wrap" } }, ex.charges.map((ch, pi) => pi !== actP && React.createElement("span", { key: pi, style: { fontSize: 10, color: C.textDim } },
                        phases[pi].sem,
                        ": ",
                        ch))),
                    ex.note && React.createElement("div", { style: { marginLeft: 19, marginTop: 4, fontSize: 10.5, color: C.textMut, fontStyle: "italic" } },
                        "⚠ ",
                        ex.note)); }),
                se.finisher && React.createElement("div", { style: { marginTop: 12, paddingTop: 10, borderTop: `1px solid ${se.couleur}33` } },
                    React.createElement("div", { style: { fontSize: 11.5, fontWeight: 800, color: se.couleur } }, "🔥 Finisher cardio-muscu"),
                    React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginTop: 3 } }, se.finisher)))),
        tab === "progression" && React.createElement("div", null,
            phases.map(p => React.createElement(Card, { key: p.ph, border: p.c + "40" },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: p.c } }, p.ph),
                    React.createElement("span", { style: { fontSize: 11, color: C.textDim } }, p.sem)),
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, margin: "3px 0 1px" } }, p.pct),
                React.createElement("div", { style: { fontSize: 11.5, color: C.textMut } }, p.but))),
            React.createElement(Card, { border: C.green + "33", style: { background: "#FFFFFF" } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 4 } }, "🗓️ Timeline"),
                React.createElement("div", { style: { fontSize: 12, color: "#0C8148", lineHeight: 1.7 } }, "Haut : 75-80% S8-10 · Bas : 80% S12-16 · Fin S12 : force/hypertrophie"))),
        tab === "suivi" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12, background: C.surfaceAlt, borderRadius: 12, padding: 4 } }, [["maison", "🏠 Maison"], ["salle", "🏋️ Salle"]].map(([k, l]) => React.createElement("button", { key: k, onClick: () => setSuiviProg(k), style: { flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: suiviProg === k ? C.amber + "22" : "transparent", color: suiviProg === k ? C.amber : C.textMut, borderBottom: suiviProg === k ? `2px solid ${C.amber}` : "2px solid transparent" } }, l))),
            suiviProg === "maison" && React.createElement(SuiviMaison, null),
            suiviProg === "salle" && React.createElement(SuiviSport, null)),
        tab === "coach" && React.createElement(CoachSport, null),
        tab === "rm" && React.createElement(PlanRM, null),
        tab === "douleur" && React.createElement(SuiviDouleur, null),
        tab === "conseils" && React.createElement("div", null, sportConseils.map(c => React.createElement(Card, { key: c.t, style: { borderLeft: `3px solid ${C.amber}`, borderRadius: "0 14px 14px 0" } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.amberLight, marginBottom: 4 } },
                "💡 ",
                c.t),
            React.createElement("div", { style: { fontSize: 12, color: C.textMut, lineHeight: 1.5 } }, c.d)))));
}
/* ═══ NUTRITION SECTION ═══ */
/* ═══ CALORIES ADAPTATIVES (selon le poids) ═══ */
function bmrMifflin(kg, cm, age, sex) { if (!kg || !cm || !age)
    return null; return Math.round(10 * kg + 6.25 * cm - 5 * age + (sex === "F" ? -161 : 5)); }
function calorieTarget(kg, cm, age, sex, activity, deficitKcal) { const bmr = bmrMifflin(kg, cm, age, sex); if (bmr == null)
    return null; const tdee = Math.round(bmr * activity); const t = tdee - (deficitKcal || 0); const target = Math.max(t, bmr); return { bmr, tdee, target, clamped: target !== t }; }
function macrosFor(targetKcal, proteinG) { const pKcal = proteinG * 4; const fatKcal = Math.round(targetKcal * 0.25); const fatG = Math.round(fatKcal / 9); const carbG = Math.max(0, Math.round((targetKcal - pKcal - fatKcal) / 4)); return { p: proteinG, l: fatG, g: carbG }; }
function proteinFor(kg, lean, mode) { if (mode === "lean")
    return lean > 0 ? Math.round(2.2 * lean) : Math.round(1.8 * kg); const gk = parseFloat(mode); return Math.round((gk || 1.8) * kg); }
const protOpts = [{ l: "1,8 g/kg", v: "1.8" }, { l: "2,0 g/kg", v: "2.0" }, { l: "2,2 g/kg", v: "2.2" }, { l: "Masse maigre", v: "lean" }];
function avgRecent(weighIns, n) { const w = [...weighIns].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, n).map(x => x.kg); return w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length * 10) / 10 : null; }
/* Config "nutri-cal-cfg" telle que stockée → valeurs prêtes à l'emploi.
   Les très anciennes versions stockaient le déficit en % (≤ 40) : converti en −700 kcal. */
function normCalCfg(c) { if (!c)
    return null; return { sex: c.sex || "H", age: c.age != null ? c.age : "", activity: c.activity || 1.55, deficit: (c.deficit > 0 && c.deficit <= 40) ? 700 : (c.deficit != null ? c.deficit : 700), protMode: c.protMode || "lean" }; }
/* Calcul unique partagé par Accueil, Nutrition, Calories et Journal :
   poids moyen 7 j → masse maigre (méthode Navy) → cible calorique → macros. */
function bodyTargets(nLogs, mens, cm, cfg) {
    const weighIns = (nLogs || []).filter(l => l.weight > 0).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    const curW = avgRecent(weighIns, 7);
    const age = cfg ? parseInt(cfg.age) || 0 : 0;
    let lean = 0;
    const lm = [...(mens || [])].reverse().find(m => m.vals && m.vals.taille > 0 && m.vals.cou > 0);
    if (lm && cm) {
        const bf = navyBF(lm.vals.taille, lm.vals.cou, cm);
        const w = closestWeight(weighIns, lm.dateISO) || curW;
        const lf = (w && bf != null) ? leanFat(w, bf) : null;
        if (lf)
            lean = lf.lean;
    }
    const ready = !!(curW && cm && age && cfg);
    const cal = ready ? calorieTarget(curW, cm, age, cfg.sex, cfg.activity, cfg.deficit) : null;
    const prot = ready ? proteinFor(curW, lean, cfg.protMode || "lean") : 0;
    const macros = cal ? macrosFor(cal.target, prot) : null;
    return { weighIns, curW, age, lean, ready, cal, prot, macros };
}
/* Mise à l'échelle du menu pour tomber pile sur les macros du jour.
   Les aliments "fix" (1 œuf, 1 galette…) ne bougent pas ; les autres sont rangés selon
   leur macro dominante (P, G ou L) et chaque groupe reçoit un facteur. Les 3 facteurs
   sont la solution exacte du système : fixes + Σ facteur × groupe = cible, pour P, G et L.
   Si la solution exacte n'est pas réaliste (facteur négatif ou extrême), on retombe
   sur une approximation par macro dominante. */
function mealScaling(meals, target) {
    const dom = it => { const pk = (it.p || 0) * 4, gk = (it.g || 0) * 4, lk = (it.l || 0) * 9, mx = Math.max(pk, gk, lk); return mx <= 0 ? null : (mx === pk ? "p" : mx === lk ? "l" : "g"); };
    const fix = { p: 0, g: 0, l: 0 }, grp = { p: { p: 0, g: 0, l: 0 }, g: { p: 0, g: 0, l: 0 }, l: { p: 0, g: 0, l: 0 } };
    meals.forEach(m => m.items.forEach(it => { if (it.t)
        return; const d = it.fix ? null : dom(it); const T = d ? grp[d] : fix; T.p += it.p || 0; T.g += it.g || 0; T.l += it.l || 0; }));
    const totalKcal = (fix.p + grp.p.p + grp.g.p + grp.l.p) * 4 + (fix.g + grp.p.g + grp.g.g + grp.l.g) * 4 + (fix.l + grp.p.l + grp.g.l + grp.l.l) * 9;
    const flat = target && totalKcal ? target.kcal / totalKcal : 1;
    let f = { p: flat, g: flat, l: flat };
    if (target) {
        // Système 3×3 : lignes = macro cible (p, g, l), colonnes = groupe (p, g, l)
        const K = ["p", "g", "l"], A = K.map(m => K.map(gk => grp[gk][m])), b = K.map(m => target[m] - fix[m]);
        const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
        const D = det(A);
        const exact = Math.abs(D) > 1e-6 ? K.map((_, j) => det(A.map((row, i) => row.map((v, k) => k === j ? b[i] : v))) / D) : null;
        if (exact && exact.every(x => x >= 0.2 && x <= 4))
            f = { p: exact[0], g: exact[1], l: exact[2] };
        else
            f = { p: grp.p.p ? Math.max(target.p - fix.p, 0) / grp.p.p : flat, g: grp.g.g ? Math.max(target.g - fix.g, 0) / grp.g.g : flat, l: grp.l.l ? Math.max(target.l - fix.l, 0) / grp.l.l : flat };
    }
    const itemF = it => { if (it.fix)
        return 1; const d = dom(it); return d ? f[d] : flat; };
    return { itemF, factors: f };
}
/* Menu complet d'un jour : repas + horaires du profil, cible du jour (−400 kcal les jours de repos)
   et portions recalées pour que la somme des repas = cible. Partagé par Repas et Journal. */
const REST_CUT = 400;
/* `extra` = kcal dépensées en plus ce jour-là (natation enregistrée) : ajoutées à la cible, les portions suivent */
function dayMenu(dayType, profile, mealAlt, bt, extra) {
    const plan = dayPlan(dayType, profile, mealAlt);
    const base = bt?.cal ? bt.cal.target : macrosTarget.kcal;
    const swimExtra = Math.max(0, Math.round(extra || 0));
    const dayTgt = (dayType === "rest" ? Math.max(base - REST_CUT, bt?.cal ? bt.cal.bmr : 0) : base) + swimExtra;
    const dayMacros = macrosFor(dayTgt, bt?.cal ? bt.prot : macrosTarget.p);
    const { itemF } = mealScaling(plan.meals, { ...dayMacros, kcal: dayTgt });
    const mealMacros = plan.meals.map(r => r.items.reduce((a, it) => it.t ? a : { p: a.p + it.p * itemF(it), g: a.g + it.g * itemF(it), l: a.l + it.l * itemF(it) }, { p: 0, g: 0, l: 0 }));
    const menuTot = mealMacros.reduce((a, m) => ({ p: a.p + m.p, g: a.g + m.g, l: a.l + m.l }), { p: 0, g: 0, l: 0 });
    const menuKcal = Math.round(menuTot.p * 4 + menuTot.g * 4 + menuTot.l * 9);
    return { ...plan, dayTgt, swimExtra, dayMacros, itemF, mealMacros, menuTot, menuKcal };
}
const activityOpts = [{ l: "Sédentaire", v: 1.2 }, { l: "Léger", v: 1.375 }, { l: "Modéré", v: 1.55 }, { l: "Élevé", v: 1.725 }];
const objectifOpts = [{ l: "+250 kcal", v: -250 }, { l: "−300 kcal", v: 300 }, { l: "−500 kcal", v: 500 }, { l: "−550 kcal", v: 550 }, { l: "−700 kcal", v: 700 }, { l: "−1000 kcal", v: 1000 }, { l: "Maintien", v: 0 }];
function NutritionCalories() {
    const [nLogs, setNLogs] = useState([]);
    const [mens, setMens] = useState([]);
    const [height, setHeight] = useState("");
    const [cfg, setCfg] = useState({ sex: "H", age: "", activity: 1.55, deficit: 700, protMode: "lean" });
    const [loading, setLoading] = useState(true);
    useEffect(() => { Promise.all([load("nutri-logs", []), load("mensurations", []), load("taille-corps", ""), load("nutri-cal-cfg", null)]).then(([n, m, h, c]) => { setNLogs(n || []); setMens(m || []); setHeight((h || h === 0) && h !== "" ? String(h) : ""); if (c)
        setCfg({ ...normCalCfg(c), age: c.age != null ? String(c.age) : "" }); setLoading(false); }); }, []);
    const saveCfg = async (patch) => { const nc = { ...cfg, ...patch }; setCfg(nc); const raw = await load("nutri-cal-cfg", {}); await save("nutri-cal-cfg", { ...(raw || {}), sex: nc.sex, age: parseInt(nc.age) || null, activity: nc.activity, deficit: nc.deficit, protMode: nc.protMode || "lean" }); };
    const saveHeight = async (v) => { setHeight(v); await save("taille-corps", parseFloat(v) || 0); };
    const G = C.green;
    const cm = parseFloat(height) || 0;
    const { weighIns, curW, age, lean, ready, cal: res, macros } = bodyTargets(nLogs, mens, cm, cfg);
    const bfPct = (curW && lean) ? Math.round((curW - lean) / curW * 100) : null;
    const brackets = ready ? [130, 125, 115, 105, 95].map(w => ({ w, t: calorieTarget(w, cm, age, cfg.sex, cfg.activity, cfg.deficit).target })) : [];
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    const miss = [];
    if (!curW)
        miss.push("une pesée (onglet 📊 Suivi)");
    if (!cm)
        miss.push("ta taille");
    if (!age)
        miss.push("ton âge");
    return React.createElement("div", null,
        React.createElement(Card, null,
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 10 } }, "⚙️ Tes paramètres"),
            React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
                React.createElement("div", { style: { flex: 1 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Sexe"),
                    React.createElement("div", { style: { display: "flex", gap: 5 } }, ["H", "F"].map(s => React.createElement("button", { key: s, onClick: () => saveCfg({ sex: s }), style: { flex: 1, padding: "7px 0", borderRadius: 8, border: `2px solid ${cfg.sex === s ? G : "transparent"}`, background: cfg.sex === s ? G + "22" : C.surfaceAlt, color: cfg.sex === s ? G : C.textMut, fontWeight: 700, fontSize: 12, cursor: "pointer" } }, s === "H" ? "Homme" : "Femme")))),
                React.createElement("div", { style: { width: 70 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Âge"),
                    React.createElement("input", { type: "number", inputMode: "decimal", value: cfg.age, onChange: e => saveCfg({ age: e.target.value }), placeholder: "30", style: inputStyle })),
                React.createElement("div", { style: { width: 80 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Taille"),
                    React.createElement("input", { type: "number", inputMode: "decimal", value: height, onChange: e => saveHeight(e.target.value), placeholder: "178", style: inputStyle }))),
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Niveau d'activité"),
            React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 } }, activityOpts.map(o => React.createElement("button", { key: o.v, onClick: () => saveCfg({ activity: o.v }), style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${cfg.activity === o.v ? G : "transparent"}`, background: cfg.activity === o.v ? G + "22" : C.surfaceAlt, color: cfg.activity === o.v ? G : C.textMut, fontWeight: 700, fontSize: 10.5, cursor: "pointer" } }, o.l))),
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Objectif"),
            React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, objectifOpts.map(o => React.createElement("button", { key: o.l, onClick: () => saveCfg({ deficit: o.v }), style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${cfg.deficit === o.v ? G : "transparent"}`, background: cfg.deficit === o.v ? G + "22" : C.surfaceAlt, color: cfg.deficit === o.v ? G : C.textMut, fontWeight: 700, fontSize: 10.5, cursor: "pointer" } }, o.l)), !objectifOpts.some(o => o.v === cfg.deficit) && React.createElement("span", { style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${G}`, background: G + "22", color: G, fontWeight: 700, fontSize: 10.5 } }, "−" + cfg.deficit + " kcal · ajusté 🔬")),
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, margin: "10px 0 3px" } },
                "Protéines ",
                React.createElement("span", { style: { color: C.textDim } }, "(base de calcul)")),
            React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, protOpts.map(o => React.createElement("button", { key: o.v, onClick: () => saveCfg({ protMode: o.v }), style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${cfg.protMode === o.v ? G : "transparent"}`, background: cfg.protMode === o.v ? G + "22" : C.surfaceAlt, color: cfg.protMode === o.v ? G : C.textMut, fontWeight: 700, fontSize: 10.5, cursor: "pointer" } }, o.l)))),
        !ready ? React.createElement(Card, { border: C.gluc + "44" },
            React.createElement("div", { style: { fontSize: 12, color: C.textMut, padding: 4 } },
                "Pour calculer ta cible, il manque : ",
                React.createElement("b", { style: { color: C.text } }, miss.join(", ")),
                "."))
            : React.createElement("div", null,
                React.createElement(Card, { border: G + "55" },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 } },
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.greenLight } }, "🔥 Ta cible du moment"),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } },
                            "poids : ",
                            curW,
                            " kg",
                            weighIns.length > 1 ? " (moy. 7j)" : "")),
                    React.createElement("div", { style: { fontSize: 34, fontWeight: 800, color: G, lineHeight: 1.1, margin: "4px 0" } },
                        res.target,
                        " ",
                        React.createElement("span", { style: { fontSize: 14, color: C.textMut } }, "kcal/j")),
                    React.createElement("div", { style: { fontSize: 10.5, color: C.textDim, marginBottom: 12 } },
                        "Métabolisme (BMR) ",
                        res.bmr,
                        " · dépense estimée (TDEE) ",
                        res.tdee,
                        " · déficit −",
                        res.tdee - res.target,
                        " kcal/j",
                        res.clamped ? " · plancher BMR atteint" : ""),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } },
                        React.createElement("div", { style: { textAlign: "center", background: C.surfaceAlt, borderRadius: 10, padding: "9px 4px" } },
                            React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: C.green } },
                                macros.p,
                                React.createElement("span", { style: { fontSize: 10, color: C.textDim } }, "g")),
                            React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Protéines")),
                        React.createElement("div", { style: { textAlign: "center", background: C.surfaceAlt, borderRadius: 10, padding: "9px 4px" } },
                            React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: C.gluc } },
                                macros.g,
                                React.createElement("span", { style: { fontSize: 10, color: C.textDim } }, "g")),
                            React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Glucides")),
                        React.createElement("div", { style: { textAlign: "center", background: C.surfaceAlt, borderRadius: 10, padding: "9px 4px" } },
                            React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: C.amberLight } },
                                macros.l,
                                React.createElement("span", { style: { fontSize: 10, color: C.textDim } }, "g")),
                            React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Lipides"))),
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim, marginTop: 8 } },
                        "Protéines ",
                        cfg.protMode === "lean" ? (lean > 0 ? "= 2,2 g/kg de masse maigre (" + lean + " kg)" : "= 1,8 g/kg (ajoute taille+cou dans 📐 Corps pour la masse maigre)") : "= " + cfg.protMode.replace(".", ",") + " g/kg de poids de corps",
                        " · lipides 25 % · glucides = le reste."),
                    ready && bfPct != null && bfPct < 22 && cfg.protMode === "lean" && React.createElement("div", { style: { fontSize: 10, color: C.blue, background: C.blue + "14", border: `1px solid ${C.blue}44`, borderRadius: 8, padding: "6px 10px", marginTop: 8 } },
                        "🎯 Masse grasse estimée ~",
                        bfPct,
                        "% (sous 22 %) : masse maigre et poids de corps se rejoignent — tu peux basculer sur ",
                        React.createElement("b", { style: { color: C.text } }, "2 g/kg de poids de corps"),
                        " si tu préfères ce repère.")),
                cfg.deficit >= 900 && React.createElement(Card, { border: C.danger + "55" },
                    React.createElement("div", { style: { fontSize: 11, fontWeight: 800, color: C.danger, marginBottom: 3 } }, "⚠️ Déficit agressif"),
                    React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, lineHeight: 1.5 } },
                        "−",
                        cfg.deficit,
                        " kcal = perte rapide, mais risque de ",
                        React.createElement("b", { style: { color: C.text } }, "fonte musculaire"),
                        " et de fatigue avec ton volume d'entraînement. À réserver aux premières semaines (quand tu pars de haut). Repasse à −700 dès que ta force baisse ou que la faim devient ingérable.")),
                brackets.length > 1 && React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.greenLight, marginBottom: 2 } }, "📉 Ta cible en descendant"),
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 8 } },
                        "Déficit fixe de ",
                        cfg.deficit > 0 ? "−" + cfg.deficit + " kcal" : "maintien",
                        " à chaque palier. Se recalcule seule à chaque pesée :"),
                    brackets.map(b => { const cur = Math.abs(b.w - curW) < 2.5; return React.createElement("div", { key: b.w, style: { display: "flex", alignItems: "center", padding: "6px 0", borderTop: `1px solid ${C.borderSoft}` } },
                        React.createElement("span", { style: { width: 70, fontSize: 12, fontWeight: cur ? 800 : 600, color: cur ? G : C.text } },
                            b.w,
                            " kg",
                            cur ? " ←" : ""),
                        React.createElement("div", { style: { flex: 1, height: 6, background: C.surfaceAlt, borderRadius: 3, overflow: "hidden", margin: "0 10px" } },
                            React.createElement("div", { style: { height: "100%", width: Math.round(b.t / brackets[0].t * 100) + "%", background: cur ? G : C.borderSoft } })),
                        React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: cur ? G : C.textMut } },
                            b.t,
                            " kcal")); })),
                React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, padding: "2px 4px 0", lineHeight: 1.5 } }, "Estimation par formule (Mifflin-St Jeor). Ajuste l'objectif si tu perds trop vite (>1 % du poids/sem) ou si tu stagnes >2-3 semaines. Cette cible pilote aussi le Résumé et le menu Repas, mis à l'échelle automatiquement.")));
}
/* ═══ JOURNAL ALIMENTAIRE — ce que tu manges réellement, comparé à la cible du jour ═══ */
function NutritionJournal() {
    const [log, setLog] = useState({});
    const [nLogs, setNLogs] = useState([]);
    const [cfg, setCfg] = useState(null);
    const [cm, setCm] = useState(0);
    const [mens, setMens] = useState([]);
    const [alts, setAlts] = useState({});
    const [loading, setLoading] = useState(true);
    const [grams, setGrams] = useState("100");
    const [q, setQ] = useState("");
    const [selDate, setSelDate] = useState(isoToday());
    const [showNew, setShowNew] = useState(false);
    const [nf, setNf] = useState({ nom: "", p: "", g: "", l: "" });
    const [custom, setCustom] = useStored("foods-custom", []);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [sLogs] = useStored("sport-logs", []);
    const [swLogs] = useStored("natation-logs", []);
    const G = C.green;
    useEffect(() => { Promise.all([load("food-log", {}), load("nutri-logs", []), load("nutri-cal-cfg", null), load("taille-corps", ""), load("mensurations", []), load("repas-alts", {})]).then(([lg, n, c, h, m, a]) => { setLog(lg || {}); setNLogs(n || []); setCfg(normCalCfg(c)); setCm(parseFloat(h) || 0); setMens(m || []); setAlts(a || {}); setLoading(false); }); }, []);
    const dayType = sessionForDate(selDate, resolveProgramme(profile, sLogs)) ? "training" : "rest";
    const bt = bodyTargets(nLogs, mens, cm, cfg);
    const menu = dayMenu(dayType, profile, alts, bt, swimKcalOn(swLogs, selDate));
    const target = { ...menu.dayMacros, kcal: menu.dayTgt };
    const foods = log[selDate] || [];
    const tot = foods.reduce((a, f) => ({ p: a.p + f.p, gl: a.gl + f.gl, l: a.l + f.l, kcal: a.kcal + f.kcal }), { p: 0, gl: 0, l: 0, kcal: 0 });
    const r1 = x => Math.round(x * 10) / 10;
    const db = [...custom.map(f => ({ ...f, custom: true })), ...foodDB];
    const results = db.filter(f => !q || f.nom.toLowerCase().includes(q.toLowerCase()));
    const commit = async (u) => { setLog(u); if (!(await save("food-log", u)))
        toast("❌ Journal non enregistré", { tone: "danger" }); };
    const add = (food) => { const g = parseFloat(String(grams).replace(",", ".")); if (!g || g <= 0)
        return toast("Indique une quantité en grammes"); const e = { id: Date.now(), nom: food.nom, grams: g, p: r1(food.p * g / 100), gl: r1(food.g * g / 100), l: r1(food.l * g / 100), kcal: Math.round(food.kcal * g / 100) }; commit({ ...log, [selDate]: [...foods, e] }); toast("+ " + food.nom + " " + g + " g · " + e.kcal + " kcal"); };
    const addMeal = (m, i) => { const mt = menu.mealMacros[i]; const e = { id: Date.now(), nom: "🍽️ " + m.m + (m.altLabel ? " · " + m.altLabel : ""), plan: m.m, grams: null, p: r1(mt.p), gl: r1(mt.g), l: r1(mt.l), kcal: Math.round(mt.p * 4 + mt.g * 4 + mt.l * 9) }; commit({ ...log, [selDate]: [...foods, e] }); toast("+ " + m.m + " du menu · " + e.kcal + " kcal"); };
    const del = id => commitWithUndo("food-log", log, { ...log, [selDate]: foods.filter(x => x.id !== id) }, setLog, "🗑️ Aliment retiré");
    const prevDay = shiftISO(selDate, -1);
    const copyPrev = () => { const pf = log[prevDay] || []; if (!pf.length)
        return toast("Rien à copier la veille"); commit({ ...log, [selDate]: [...foods, ...pf.map((f, k) => ({ ...f, id: Date.now() + k }))] }); toast("⟲ " + pf.length + " élément(s) de la veille copiés"); };
    const createFood = async () => { const p = parseFloat(nf.p) || 0, g = parseFloat(nf.g) || 0, l = parseFloat(nf.l) || 0; if (!nf.nom.trim() || (p + g + l) <= 0)
        return toast("Nom et macros pour 100 g requis"); const f = { nom: nf.nom.trim(), cat: p * 4 >= g * 4 && p * 4 >= l * 9 ? "prot" : l * 9 >= g * 4 ? "lip" : "gluc", p, g, l, kcal: Math.round(p * 4 + g * 4 + l * 9) }; await setCustom([f, ...custom.filter(x => x.nom !== f.nom)]); setNf({ nom: "", p: "", g: "", l: "" }); setShowNew(false); setQ(f.nom); toast("⭐ " + f.nom + " ajouté à tes aliments"); };
    const delCustom = nom => commitWithUndo("foods-custom", custom, custom.filter(x => x.nom !== nom), setCustom, "🗑️ Aliment perso supprimé");
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    const bar = (lab, v, t, c) => { const pct = t > 0 ? Math.min(100, v / t * 100) : 0; const over = t > 0 && v > t * 1.05; return React.createElement("div", { style: { marginBottom: 9 } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 } },
            React.createElement("span", { style: { color: c, fontWeight: 700 } }, lab + " " + Math.round(v) + " / " + t + " g"),
            React.createElement("span", { style: { color: over ? C.danger : C.textDim } }, Math.round(pct) + "%")),
        React.createElement("div", { style: { height: 7, borderRadius: 4, background: C.surfaceAlt, overflow: "hidden" } },
            React.createElement("div", { style: { height: "100%", width: pct + "%", background: over ? C.danger : c, transition: "width .3s" } }))); };
    const left = target.kcal - tot.kcal;
    const chip = (v) => React.createElement("button", { key: v, onClick: () => setGrams(String(v)), style: { padding: "4px 8px", borderRadius: 7, border: `1px solid ${String(grams) === String(v) ? G : C.borderSoft}`, background: String(grams) === String(v) ? G + "22" : "transparent", color: String(grams) === String(v) ? G : C.textMut, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, v + "g");
    const added = new Set(foods.filter(f => f.plan).map(f => f.plan));
    return React.createElement("div", null,
        React.createElement(DateNav, { value: selDate, onChange: setSelDate, color: G }),
        React.createElement(Card, { border: G + "44" },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: C.greenLight } }, "📓 " + (dayType === "rest" ? "Jour de repos" : "Jour d'entraînement")),
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: G } }, tot.kcal, React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, " / " + target.kcal + " kcal"))),
            React.createElement("div", { style: { fontSize: 10.5, color: left >= 0 ? C.textMut : C.danger, marginBottom: 10 } }, left >= 0 ? "Reste " + left + " kcal" : "Dépassement de " + (-left) + " kcal", menu.swimExtra ? " · dont +" + menu.swimExtra + " kcal natation" : "", bt.cal ? "" : " · cible de base (renseigne 🔥 Calories)"),
            bar("Protéines", tot.p, target.p, C.prot),
            bar("Glucides", tot.gl, target.g, C.gluc),
            bar("Lipides", tot.l, target.l, C.lip)),
        React.createElement(Card, null,
            React.createElement("div", { style: { fontSize: 12, fontWeight: 800, marginBottom: 8 } }, "🍽️ Ajouter un repas du menu"),
            menu.meals.map((m, i) => { const kc = Math.round(menu.mealMacros[i].p * 4 + menu.mealMacros[i].g * 4 + menu.mealMacros[i].l * 9); const done = added.has(m.m); return React.createElement("div", { key: m.m, style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: i ? `1px solid ${C.borderSoft}` : "none" } },
                React.createElement("span", { style: { fontSize: 10.5, color: C.greenLight, fontWeight: 700, width: 40 } }, m.h),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, m.m, m.altLabel ? React.createElement("span", { style: { color: C.textDim, fontWeight: 400 } }, " · " + m.altLabel) : null),
                    React.createElement("div", { style: { fontSize: 9.5, color: C.textDim } }, kc + " kcal · " + Math.round(menu.mealMacros[i].p) + "P/" + Math.round(menu.mealMacros[i].g) + "G/" + Math.round(menu.mealMacros[i].l) + "L")),
                React.createElement("button", { onClick: () => addMeal(m, i), style: { padding: "5px 10px", borderRadius: 8, border: `1px solid ${done ? G : G + "55"}`, background: done ? G + "22" : "transparent", color: G, fontSize: 11, fontWeight: 800, cursor: "pointer" } }, done ? "✓ +" : "+")); })),
        React.createElement(Card, null,
            React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 6 } },
                React.createElement("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "🔍 Chercher un aliment", style: { ...inputStyle, flex: 1 } }),
                React.createElement("input", { type: "number", inputMode: "decimal", value: grams, onChange: e => setGrams(e.target.value), style: { ...inputStyle, width: 74, textAlign: "right" } })),
            React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" } }, [30, 50, 100, 150, 200, 250].map(chip)),
            React.createElement("div", { style: { maxHeight: 230, overflowY: "auto" } },
                results.map(f => React.createElement("div", { key: (f.custom ? "c:" : "") + f.nom, style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 4px", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("div", { onClick: () => add(f), style: { flex: 1, minWidth: 0, cursor: "pointer" } },
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, (f.custom ? "⭐ " : "") + f.nom),
                        React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, f.p + "P/" + f.g + "G/" + f.l + "L · " + f.kcal + " kcal /100 g")),
                    f.custom && React.createElement("button", { onClick: () => delCustom(f.nom), "aria-label": "Supprimer", style: { border: "none", background: "transparent", color: C.textDim, fontSize: 12, cursor: "pointer" } }, "✕"),
                    React.createElement("button", { onClick: () => add(f), style: { border: "none", background: "transparent", fontSize: 20, color: G, fontWeight: 800, lineHeight: 1, cursor: "pointer" } }, "+"))),
                results.length === 0 && React.createElement("div", { style: { fontSize: 11, color: C.textDim, textAlign: "center", padding: 10 } }, "Aucun aliment trouvé — crée-le ci-dessous.")),
            React.createElement("button", { onClick: () => setShowNew(v => !v), style: { width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 9, border: `1px dashed ${C.border}`, background: "transparent", color: C.textMut, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, showNew ? "Annuler" : "⭐ Créer un aliment"),
            showNew && React.createElement("div", { style: { marginTop: 8 } },
                React.createElement("input", { value: nf.nom, onChange: e => setNf({ ...nf, nom: e.target.value }), placeholder: "Nom (ex : Skyr vanille)", style: { ...inputStyle, marginBottom: 6 } }),
                React.createElement("div", { style: { display: "flex", gap: 6 } }, [["p", "Prot."], ["g", "Gluc."], ["l", "Lip."]].map(([k, lb]) => React.createElement("div", { key: k, style: { flex: 1 } },
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim, marginBottom: 2 } }, lb + " /100 g"),
                    React.createElement("input", { type: "number", inputMode: "decimal", value: nf[k], onChange: e => setNf({ ...nf, [k]: e.target.value }), style: inputStyle })))),
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 } },
                    React.createElement("span", { style: { fontSize: 10.5, color: C.textMut } }, "≈ " + Math.round((parseFloat(nf.p) || 0) * 4 + (parseFloat(nf.g) || 0) * 4 + (parseFloat(nf.l) || 0) * 9) + " kcal /100 g"),
                    React.createElement("button", { onClick: createFood, style: { padding: "8px 14px", borderRadius: 9, border: "none", background: G, color: "#04130B", fontSize: 12, fontWeight: 800, cursor: "pointer" } }, "Créer")))),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 8px" } },
            React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: C.textMut } }, "Mangé " + (selDate === isoToday() ? "aujourd'hui" : "le " + fmtDateShort(selDate))),
            (log[prevDay] || []).length > 0 && React.createElement("button", { onClick: copyPrev, style: { border: "none", background: "transparent", color: G, fontSize: 11, fontWeight: 700, cursor: "pointer" } }, "⟲ Copier la veille")),
        !foods.length ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10, fontSize: 12 } }, "Rien encore. Ajoute un repas du menu en un tap, ou cherche un aliment."))
            : foods.slice().reverse().map(f => React.createElement(Card, { key: f.id, style: { padding: "9px 12px" } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700 } }, f.nom, f.grams ? React.createElement("span", { style: { fontSize: 10, color: C.textDim } }, " " + f.grams + "g") : null),
                        React.createElement("div", { style: { fontSize: 9.5, color: C.textDim } }, f.p + "P/" + f.gl + "G/" + f.l + "L")),
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: C.greenLight } }, f.kcal),
                    React.createElement("button", { onClick: () => del(f.id), style: { background: "none", border: "none", color: C.textMut, cursor: "pointer", fontSize: 14, marginLeft: 2 } }, "✕")))));
}
function NutritionSection({ initialTab } = {}) {
    const [tab, setTab] = useState(initialTab || "resume");
    const [day, setDay] = useState("training");
    const [sLogsNS] = useStored("sport-logs", []);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [nLogsN, setNLogsN] = useState([]);
    const [calCfg, setCalCfg] = useState(null);
    const [hCm, setHCm] = useState(0);
    const [mensC, setMensC] = useState([]);
    const [mealAlt, setMealAlt] = useState({});
    // Onglet Repas : type de jour prévu aujourd'hui par défaut
    useEffect(() => { setDay(sessionForDate(isoToday(), resolveProgramme(profile, sLogsNS)) ? "training" : "rest"); }, [profile, sLogsNS.length]);
    useEffect(() => { Promise.all([load("nutri-logs", []), load("nutri-cal-cfg", null), load("taille-corps", ""), load("mensurations", []), load("repas-alts", {})]).then(([n, c, h, m, ma]) => { setNLogsN(n || []); setCalCfg(normCalCfg(c)); setHCm(parseFloat(h) || 0); setMensC(m || []); setMealAlt(ma || {}); }); }, [tab]);
    const setAlt = async (key, idx) => { const na = { ...mealAlt, [key]: idx }; setMealAlt(na); await save("repas-alts", na); };
    const bt = bodyTargets(nLogsN, mensC, hCm, calCfg);
    const { cal: calRes, macros: calMacros } = bt;
    const calTgt = calRes ? calRes.target : null;
    const kcalCible = macrosTarget.kcal;
    const [swLogsN] = useStored("natation-logs", []);
    const menu = dayMenu(day, profile, mealAlt, bt, swimKcalOn(swLogsN, isoToday()));
    const { meals: repasEff, dayTgt, dayMacros, itemF, mealMacros, menuTot, menuKcal } = menu;
    const planning = menu.timeline.map(x => [x.h, x.t]);
    const tabs = [["resume", "Résumé"], ["cal", lx("🎯 Mon objectif", "🔥 Calories")], ["repas", "Repas"], ["journal", "📓 Journal"], ["aliments", "Aliments"], ["complements", "Compléments"], ["suivi", "📊 Suivi"], ["corps", "📐 Corps"], ["conseils", "Conseils"]].filter(([k]) => tabOk("nutrition", k));
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 } }, tabs.map(([k, l]) => React.createElement(Pill, { key: k, active: tab === k, onClick: () => setTab(k), color: C.green }, l))),
        tab === "resume" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
                React.createElement(Pill, { active: day === "training", onClick: () => setDay("training"), color: C.green }, "🏋️ Entraînement"),
                React.createElement(Pill, { active: day === "rest", onClick: () => setDay("rest"), color: C.green }, "🛌 Repos")),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 8 } }, "⏰ Journée type · " + (day === "rest" ? "repos" : "entraînement (" + CRENEAUX[normProfile(profile).creneau].label.toLowerCase() + ")")),
                planning.map(([h, t], i) => React.createElement("div", { key: i, style: { display: "flex", gap: 10, fontSize: 12, lineHeight: 1.8 } },
                    React.createElement("span", { style: { color: /Séance/.test(t) ? C.amber : C.greenLight, fontWeight: 700, minWidth: 58 } }, h),
                    React.createElement("span", { style: { color: /Séance/.test(t) ? C.text : C.textMut, fontWeight: /Séance/.test(t) ? 700 : 400 } }, t))),
                React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 6 } }, "Horaires réglables dans Accueil → ⚙️ Mon profil (créneau de séance, réveil).")),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 } }, [{ l: "Métabo", v: calRes ? calRes.bmr : "—", c: C.prot }, { l: "Dépense", v: calRes ? calRes.tdee : "—", c: C.blue }, { l: day === "rest" ? "Objectif repos" : "Objectif", v: dayTgt, c: C.green }].map(s => React.createElement(Card, { key: s.l, style: { marginBottom: 0 } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: s.c } }, s.v),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "kcal"),
                React.createElement("div", { style: { fontSize: 10, color: C.textMut, marginTop: 2 } }, s.l)))),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 10 } }, "🎯 Macros du jour"),
                [["Protéines", dayMacros.p, C.prot], ["Glucides", dayMacros.g, C.gluc], ["Lipides", dayMacros.l, C.lip]].map(([n, v, c]) => React.createElement("div", { key: n, style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 } },
                    React.createElement("span", { style: { color: c, fontWeight: 700 } }, n),
                    React.createElement("span", { style: { fontWeight: 800 } },
                        v,
                        "g"))),
                !calRes && React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 2 } }, "Renseigne l'onglet 🔥 Calories pour tes valeurs personnalisées."))),
        tab === "repas" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
                React.createElement(Pill, { active: day === "training", onClick: () => setDay("training"), color: C.green }, "🏋️ Entraînement"),
                React.createElement(Pill, { active: day === "rest", onClick: () => setDay("rest"), color: C.green }, "🛌 Repos")),
            calTgt ? React.createElement("div", { style: { background: C.green + "14", border: `1px solid ${C.green}44`, borderRadius: 12, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: C.textMut } },
                "Menu ",
                React.createElement("b", { style: { color: C.greenLight } }, "ajusté à ta cible"),
                " : ",
                dayTgt,
                " kcal",
                day === "rest" ? React.createElement("span", null,
                    " · ",
                    React.createElement("b", { style: { color: C.text } }, "jour de repos"),
                    " (−",
                    REST_CUT,
                    " kcal sur les glucides)") : "",
                menu.swimExtra ? React.createElement("span", null, " · ", React.createElement("b", { style: { color: C.swim } }, "+" + menu.swimExtra + " kcal natation"), " aujourd'hui") : "",
                ". Portions et macros de chaque repas recalculées pour tomber sur ce total.")
                : React.createElement("div", { style: { background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: C.textMut } },
                    "Menu calé sur l'objectif de base (",
                    dayTgt,
                    " kcal). 💡 Renseigne l'onglet ",
                    React.createElement("b", { style: { color: C.greenLight } }, "🔥 Calories"),
                    " (poids, taille, âge) pour l'ajuster à ta cible personnelle."),
            React.createElement("div", { style: { background: C.surfaceAlt, borderRadius: 12, padding: "10px 6px", marginBottom: 12 } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-around" } }, [["P", Math.round(menuTot.p), dayMacros.p, C.prot], ["G", Math.round(menuTot.g), dayMacros.g, C.gluc], ["L", Math.round(menuTot.l), dayMacros.l, C.lip], ["kcal", menuKcal, dayTgt, C.greenLight]].map(([n, v, t, c]) => React.createElement("div", { key: n, style: { textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: c } }, v),
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, n, " · cible ", t)))),
                React.createElement("div", { style: { fontSize: 10, textAlign: "center", marginTop: 6, color: Math.abs(menuKcal - dayTgt) <= 25 ? C.greenLight : C.gluc } }, Math.abs(menuKcal - dayTgt) <= 25
                    ? "✓ Total des repas sélectionnés = cible du jour"
                    : "Écart de " + (menuKcal - dayTgt) + " kcal : les aliments à quantité fixe (œufs, galette…) dépassent la cible")),
            repasEff.map((r, ri) => { const mt = mealMacros[ri]; const mk = Math.round(mt.p * 4 + mt.g * 4 + mt.l * 9); return React.createElement(Card, { key: r.m },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 800 } }, r.m),
                    React.createElement("div", { style: { fontSize: 11, color: C.greenLight, fontWeight: 700 } }, r.h)),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, margin: "1px 0 8px" } },
                    Math.round(mt.p),
                    "P/",
                    Math.round(mt.g),
                    "G/",
                    Math.round(mt.l),
                    "L · ",
                    mk,
                    " kcal"),
                r.alts && (() => { const key = day + ":" + r.m; const cur = mealAlt[key] || 0; return React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 } }, [{ label: "Classique" }, ...r.alts].map((a, ai) => React.createElement("button", { key: ai, onClick: () => setAlt(key, ai), style: { padding: "4px 9px", borderRadius: 999, border: `1.5px solid ${cur === ai ? C.green : "transparent"}`, background: cur === ai ? C.green + "22" : C.surfaceAlt, color: cur === ai ? C.greenLight : C.textMut, fontSize: 10, fontWeight: 700, cursor: "pointer" } },
                    ai === 0 ? "🍽️ " : "🔄 ",
                    a.label))); })(),
                r.items.map((it, i) => { if (it.t)
                    return React.createElement("div", { key: i, style: { fontSize: 11.5, color: C.textMut, lineHeight: 1.7 } },
                        "· ",
                        it.t); const f = itemF(it); const cru = Math.round(it.cru * f); const cuit = it.cuit ? Math.round(it.cuit * f / 5) * 5 : 0; return React.createElement("div", { key: i, style: { padding: "5px 0", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                        React.createElement("span", { style: { fontSize: 12, fontWeight: 600 } }, it.n),
                        React.createElement("span", { style: { fontSize: 10, color: C.textDim } },
                            Math.round(it.p * f),
                            "P/",
                            Math.round(it.g * f),
                            "G/",
                            Math.round(it.l * f),
                            "L")),
                    React.createElement("div", { style: { fontSize: 10.5, color: C.greenLight, marginTop: 1 } }, cuit ? cru + " g cru → " + cuit + " g cuit" : (it.u ? it.u + " · " + cru + " g" : cru + " g"))); }),
                r.note && React.createElement("div", { style: { marginTop: 8, fontSize: 11, color: C.textMut, fontStyle: "italic", borderLeft: `2px solid ${C.green}`, paddingLeft: 8 } }, r.note)); }),
            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, padding: "2px 4px 0", lineHeight: 1.5 } },
                "Grammages ",
                React.createElement("b", { style: { color: C.textMut } }, "crus"),
                " (à peser/acheter) et ",
                React.createElement("b", { style: { color: C.textMut } }, "cuits"),
                " (dans l'assiette). Protéines stables, glucides ajustés à ta cible ; petites quantités (huile, épices) au feeling.")),
        tab === "aliments" && React.createElement("div", null,
            React.createElement(FoodSwap, null),
            Object.entries(alimentsCats).map(([cat, list]) => { const c = cat === "Protéines" ? C.prot : cat === "Glucides" ? C.gluc : C.lip; return React.createElement(Card, { key: cat },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: c, marginBottom: 8 } }, cat),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, list.map(a => React.createElement("span", { key: a, style: { fontSize: 11, color: C.text, background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 999, padding: "4px 10px" } }, a)))); }),
            React.createElement(Card, { border: C.danger + "33" },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 8 } }, "🚫 Retirés"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, retires.map(a => React.createElement("span", { key: a, style: { fontSize: 11, color: "#D7263D", background: "#D7263D14", borderRadius: 999, padding: "4px 10px", textDecoration: "line-through" } }, a))))),
        tab === "complements" && React.createElement("div", null, complements.map(c => React.createElement(Card, { key: c.n },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 2 } },
                React.createElement("span", { style: { fontSize: 18 } }, c.emoji),
                React.createElement("span", { style: { fontSize: 14, fontWeight: 800 } }, c.n)),
            React.createElement("div", { style: { fontSize: 11, color: C.greenLight, fontWeight: 700, marginBottom: 6 } }, c.quand),
            React.createElement("div", { style: { fontSize: 12, color: C.textMut, lineHeight: 1.5 } }, c.d)))),
        tab === "suivi" && React.createElement(SuiviNutrition, null),
        tab === "journal" && React.createElement(NutritionJournal, null),
        tab === "cal" && React.createElement(NutritionCalories, null),
        tab === "corps" && React.createElement(SuiviCorps, null),
        tab === "conseils" && React.createElement("div", null, nutritionConseils.map(c => React.createElement(Card, { key: c.t, style: { borderLeft: `3px solid ${C.green}`, borderRadius: "0 14px 14px 0" } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.greenLight, marginBottom: 4 } },
                "💡 ",
                c.t),
            React.createElement("div", { style: { fontSize: 12, color: C.textMut, lineHeight: 1.5 } }, c.d)))));
}
/* ═══ BUDGET SECTION ═══ */
/* ═══ FINANCES PERSO ═══ */
const finCats = [{ k: "Logement", e: "🏠" }, { k: "Courses", e: "🛒" }, { k: "Transport", e: "🚗" }, { k: "Sorties", e: "🍽️" }, { k: "Loisirs", e: "🎮" }, { k: "Santé", e: "💊" }, { k: "Abonnements", e: "📺" }, { k: "Sport", e: "🏋️" }, { k: "Vêtements", e: "👕" }, { k: "Autre", e: "📦" }];
const finColors = ["#8B5CF6", "#A78BFA", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6", "#F97316", "#9CA3AF"];
function ymOf(iso) { return String(iso || "").slice(0, 7); }
function prevYm(ym) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1, 1); d.setMonth(d.getMonth() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function nextYm(ym) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1, 1); d.setMonth(d.getMonth() + 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function ymLabel(ym) { const [y, m] = ym.split("-"); return ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][+m - 1] + " " + y; }
function sumMonth(entries, ym) { return Math.round(entries.filter(e => ymOf(e.dateISO) === ym).reduce((a, e) => a + (+e.montant || 0), 0) * 100) / 100; }
function catBreakdown(expenses, ym) { const m = {}; expenses.filter(e => ymOf(e.dateISO) === ym).forEach(e => { m[e.cat] = (m[e.cat] || 0) + (+e.montant || 0); }); return m; }
function savingsRate(income, exp) { if (income <= 0)
    return null; return Math.round((income - exp) / income * 1000) / 10; }
function pctChange(cur, prev) { if (prev <= 0)
    return null; return Math.round((cur - prev) / prev * 1000) / 10; }
function topCat(bd) { let k = null, v = -1; for (const c in bd) {
    if (bd[c] > v) {
        v = bd[c];
        k = c;
    }
} return k ? { cat: k, montant: Math.round(v * 100) / 100 } : null; }
function FinancePerso() {
    const [inc, setInc] = useState([]);
    const [exp, setExp] = useState([]);
    const [caps, setCaps] = useState({});
    const [goal, setGoal] = useState("");
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const [editType, setEditType] = useState(null);
    const [fType, setFType] = useState("all");
    const [fCat, setFCat] = useState("all");
    const [mode, setMode] = useState("saisie");
    const [ym, setYm] = useState(isoToday().slice(0, 7));
    const [type, setType] = useState("dep");
    const [montant, setMontant] = useState("");
    const [cat, setCat] = useState("Courses");
    const [label, setLabel] = useState("");
    const [dateISO, setDateISO] = useState(isoToday());
    const [saving, setSaving] = useState(false);
    useEffect(() => { Promise.all([load("fin-income", []), load("fin-expenses", []), load("fin-caps", {}), load("fin-goal", "")]).then(([i, e, c, g]) => { setInc(i || []); setExp(e || []); setCaps(c || {}); setGoal((g || g === 0) ? String(g) : ""); setLoading(false); }); }, []);
    const saveEntry = async () => { const m = parseFloat(montant); if (!m || m <= 0)
        return; setSaving(true); let ni = [...inc], ne = [...exp]; if (editId != null) {
        ni = ni.filter(x => x.id !== editId);
        ne = ne.filter(x => x.id !== editId);
    } const id = editId != null ? editId : Date.now(); if (type === "rev") {
        ni.push({ id, dateISO, montant: m, source: label.trim() || "Revenu" });
    }
    else {
        ne.push({ id, dateISO, montant: m, cat, label: label.trim() });
    } await save("fin-income", ni); await save("fin-expenses", ne); setInc(ni); setExp(ne); setMontant(""); setLabel(""); setEditId(null); setEditType(null); setSaving(false); };
    const startEdit = e => { setType(e._t); setMontant(String(e.montant)); if (e._t === "dep") {
        setCat(e.cat || "Courses");
        setLabel(e.label || "");
    }
    else {
        setLabel(e.source || "");
    } setDateISO(e.dateISO); setEditId(e.id); setEditType(e._t); try {
        document.querySelector(".pst.open .pst-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    }
    catch (err) { } };
    const cancelEdit = () => { setEditId(null); setEditType(null); setMontant(""); setLabel(""); };
    const delInc = id => commitWithUndo("fin-income", inc, inc.filter(x => x.id !== id), setInc, "🗑️ Revenu supprimé");
    const delExp = id => commitWithUndo("fin-expenses", exp, exp.filter(x => x.id !== id), setExp, "🗑️ Dépense supprimée");
    const setCap = async (c, v) => { const u = { ...caps, [c]: v }; setCaps(u); await save("fin-caps", u); };
    const saveGoal = async (v) => { setGoal(v); await save("fin-goal", parseFloat(v) || 0); };
    const rev = sumMonth(inc, ym), dep = sumMonth(exp, ym), solde = Math.round((rev - dep) * 100) / 100;
    const bd = catBreakdown(exp, ym), rate = savingsRate(rev, dep), goalN = parseFloat(goal) || 0, prevDep = sumMonth(exp, prevYm(ym)), change = pctChange(dep, prevDep), top = topCat(bd);
    const overCaps = finCats.filter(c => caps[c.k] > 0 && (bd[c.k] || 0) > caps[c.k]);
    const allEntries = [...inc.map(e => ({ ...e, _t: "rev" })), ...exp.map(e => ({ ...e, _t: "dep" }))].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    const recent = allEntries.filter(e => (fType === "all" || e._t === fType) && (fCat === "all" || (e._t === "dep" && e.cat === fCat))).slice(0, 40);
    const B = C.budget, navBtn = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: 18, cursor: "pointer" };
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" } }, [["saisie", "✍️ Saisie"], ["mois", "📅 Mois"], ["analyse", "📈 Analyse"]].map(([k, l]) => React.createElement(Pill, { key: k, active: mode === k, onClick: () => setMode(k), color: B }, l))),
        mode === "saisie" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
                React.createElement("button", { onClick: () => setType("dep"), style: { flex: 1, padding: "9px 0", borderRadius: 10, border: `2px solid ${type === "dep" ? C.danger : "transparent"}`, background: type === "dep" ? C.danger + "18" : C.surfaceAlt, color: type === "dep" ? C.danger : C.textMut, fontWeight: 800, fontSize: 13, cursor: "pointer" } }, "− Dépense"),
                React.createElement("button", { onClick: () => setType("rev"), style: { flex: 1, padding: "9px 0", borderRadius: 10, border: `2px solid ${type === "rev" ? C.green : "transparent"}`, background: type === "rev" ? C.green + "18" : C.surfaceAlt, color: type === "rev" ? C.green : C.textMut, fontWeight: 800, fontSize: 13, cursor: "pointer" } }, "+ Revenu")),
            React.createElement(Card, null,
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Montant (€)"),
                        React.createElement("input", { type: "number", inputMode: "decimal", step: "0.01", value: montant, onChange: e => setMontant(e.target.value), placeholder: "0", style: { ...inputStyle, fontSize: 18, fontWeight: 700 } })),
                    React.createElement("div", { style: { width: 140 } },
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Date"),
                        React.createElement("input", { type: "date", value: dateISO, onChange: e => setDateISO(e.target.value), style: inputStyle }))),
                type === "dep" && React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 5 } }, "Catégorie"),
                    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 } }, finCats.map(c => React.createElement("button", { key: c.k, onClick: () => setCat(c.k), style: { padding: "5px 9px", borderRadius: 999, border: `2px solid ${cat === c.k ? B : "transparent"}`, cursor: "pointer", fontSize: 10.5, fontWeight: 700, background: cat === c.k ? B + "22" : C.surfaceAlt, color: cat === c.k ? B : C.textMut } },
                        c.e,
                        " ",
                        c.k)))),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, type === "dep" ? "Libellé (optionnel)" : "Source"),
                React.createElement("input", { value: label, onChange: e => setLabel(e.target.value), placeholder: type === "dep" ? "ex : resto midi" : "ex : salaire", style: { ...inputStyle, width: "100%" } })),
            editId != null && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, background: C.budget + "18", border: `1px solid ${C.budget}44`, borderRadius: 10, padding: "7px 11px", marginBottom: 8 } },
                React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: C.budgetLight, flex: 1 } }, "✏️ Modification en cours"),
                React.createElement("button", { onClick: cancelEdit, style: { background: "none", border: "none", color: C.textMut, cursor: "pointer", fontSize: 11, fontWeight: 700 } }, "Annuler")),
            React.createElement("button", { onClick: saveEntry, disabled: saving || !(parseFloat(montant) > 0), style: { width: "100%", padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: type === "dep" ? C.danger : C.green, color: "#fff", fontSize: 13, fontWeight: 800, opacity: (saving || !(parseFloat(montant) > 0)) ? .5 : 1 } }, editId != null ? "Enregistrer les modifications" : (type === "dep" ? "Ajouter la dépense" : "Ajouter le revenu")),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, margin: "16px 0 8px", flexWrap: "wrap" } },
                React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: C.textMut } }, "Entrées"),
                React.createElement("div", { style: { display: "flex", gap: 5 } }, [["all", "Tout"], ["dep", "Dépenses"], ["rev", "Revenus"]].map(([k, l]) => React.createElement("button", { key: k, onClick: () => { setFType(k); if (k === "rev")
                        setFCat("all"); }, style: { padding: "3px 9px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, background: fType === k ? C.budget + "33" : C.surfaceAlt, color: fType === k ? C.budgetLight : C.textMut } }, l))),
                fType !== "rev" && React.createElement("select", { value: fCat, onChange: e => setFCat(e.target.value), style: { ...inputStyle, fontSize: 10, padding: "3px 6px", width: "auto" } },
                    React.createElement("option", { value: "all" }, "Toutes catég."),
                    finCats.map(c => React.createElement("option", { key: c.k, value: c.k },
                        c.e,
                        " ",
                        c.k)))),
            !recent.length ? React.createElement(Card, null,
                React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 10 } }, allEntries.length ? "Aucune entrée pour ce filtre." : "Aucune entrée. Commence par ajouter un revenu ou une dépense.")) : recent.map(e => { return React.createElement(Card, { key: e._t + e.id, style: { padding: "10px 12px" } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                    React.createElement("span", { style: { fontSize: 16 } }, e._t === "rev" ? "💰" : ((finCats.find(c => c.k === e.cat)?.e) || "📦")),
                    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e._t === "rev" ? e.source : (e.label || e.cat)),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } },
                            e._t === "rev" ? "Revenu" : e.cat,
                            " · ",
                            fmtDateShort(e.dateISO))),
                    React.createElement("span", { style: { fontSize: 14, fontWeight: 800, color: e._t === "rev" ? C.green : C.danger, whiteSpace: "nowrap" } },
                        e._t === "rev" ? "+" : "−",
                        e.montant,
                        " €"),
                    React.createElement("button", { onClick: () => startEdit(e), style: { background: "none", border: "none", color: C.textMut, cursor: "pointer", fontSize: 13, marginLeft: 2 } }, "✏️"),
                    React.createElement("button", { onClick: () => e._t === "rev" ? delInc(e.id) : delExp(e.id), style: { background: "none", border: "none", color: C.textMut, cursor: "pointer", fontSize: 14 } }, "✕"))); })),
        mode === "mois" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
                React.createElement("button", { onClick: () => setYm(prevYm(ym)), style: navBtn }, "‹"),
                React.createElement("span", { style: { fontSize: 14, fontWeight: 800 } }, ymLabel(ym)),
                React.createElement("button", { onClick: () => setYm(nextYm(ym)), style: navBtn }, "›")),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 } },
                React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "12px 4px" } },
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Revenus"),
                    React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.green } },
                        rev,
                        " €")),
                React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "12px 4px" } },
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Dépenses"),
                    React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.danger } },
                        dep,
                        " €")),
                React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "12px 4px" } },
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Épargne"),
                    React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: solde >= 0 ? B : C.danger } },
                        solde,
                        " €"))),
            React.createElement(Card, null,
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: goalN > 0 ? 8 : 0 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700 } }, "🎯 Objectif d'épargne / mois"),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                        React.createElement("input", { type: "number", inputMode: "decimal", value: goal, onChange: e => saveGoal(e.target.value), placeholder: "0", style: { ...inputStyle, width: 80, textAlign: "right" } }),
                        React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, "€"))),
                goalN > 0 && React.createElement("div", null,
                    React.createElement("div", { style: { height: 8, borderRadius: 4, background: C.surfaceAlt, overflow: "hidden", marginBottom: 4 } },
                        React.createElement("div", { style: { height: "100%", width: `${Math.max(0, Math.min(100, solde / goalN * 100))}%`, background: solde >= goalN ? C.green : B } })),
                    React.createElement("div", { style: { fontSize: 10, color: C.textMut } }, solde >= goalN ? "✅ Objectif atteint (" + solde + " €)" : Math.max(0, Math.round(goalN - solde)) + " € manquants pour " + goalN + " €"))),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: B, marginBottom: 4 } }, "📊 Budgets par catégorie"),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 6 } }, "Fixe un plafond mensuel pour dépenser moins. Vide = pas de plafond."),
                finCats.map(c => { const spent = Math.round((bd[c.k] || 0) * 100) / 100; const cap = caps[c.k] || 0; const over = cap > 0 && spent > cap; const pct = cap > 0 ? Math.min(100, spent / cap * 100) : 0; return (spent > 0 || cap > 0) ? React.createElement("div", { key: c.k, style: { padding: "8px 0", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 } },
                        React.createElement("span", { style: { fontSize: 14 } }, c.e),
                        React.createElement("span", { style: { flex: 1, fontSize: 12, fontWeight: 700 } }, c.k),
                        React.createElement("span", { style: { fontSize: 12, fontWeight: 800, color: over ? C.danger : C.text } },
                            spent,
                            " €"),
                        React.createElement("span", { style: { fontSize: 10, color: C.textDim } }, "/"),
                        React.createElement("input", { type: "number", inputMode: "decimal", value: caps[c.k] || "", onChange: e => setCap(c.k, parseFloat(e.target.value) || 0), placeholder: "—", style: { ...inputStyle, width: 62, textAlign: "right", padding: "4px 6px", fontSize: 11 } })),
                    cap > 0 && React.createElement("div", { style: { height: 6, borderRadius: 3, background: C.surfaceAlt, overflow: "hidden" } },
                        React.createElement("div", { style: { height: "100%", width: pct + "%", background: over ? C.danger : C.green } })),
                    over && React.createElement("div", { style: { fontSize: 9.5, color: C.danger, marginTop: 3 } },
                        "Dépassement de ",
                        Math.round((spent - cap) * 100) / 100,
                        " €")) : null; }),
                Object.keys(bd).length === 0 && React.createElement("div", { style: { fontSize: 11, color: C.textDim, textAlign: "center", padding: 8 } }, "Aucune dépense ce mois."))),
        mode === "analyse" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
                React.createElement("button", { onClick: () => setYm(prevYm(ym)), style: navBtn }, "‹"),
                React.createElement("span", { style: { fontSize: 14, fontWeight: 800 } }, ymLabel(ym)),
                React.createElement("button", { onClick: () => setYm(nextYm(ym)), style: navBtn }, "›")),
            rev === 0 && dep === 0 ? React.createElement(Card, null,
                React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12 } }, "Aucune donnée ce mois. Saisis des revenus et dépenses pour voir l'analyse.")) : React.createElement("div", null,
                React.createElement(Card, { border: (rate == null ? C.border : (rate >= 20 ? C.green : rate >= 10 ? C.gluc : C.danger)) + "66" },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 6 } }, "💰 Taux d'épargne"),
                    rate == null ? React.createElement("div", { style: { fontSize: 11, color: C.textMut } }, "Ajoute tes revenus du mois pour le calculer.") : React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 26, fontWeight: 800, color: rate >= 20 ? C.green : rate >= 10 ? C.gluc : C.danger } },
                            rate,
                            " %"),
                        React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginTop: 2 } }, rate < 0 ? "Tu dépenses plus que tes revenus ce mois." : rate >= 20 ? "Excellent — tu épargnes une belle part de tes revenus." : rate >= 10 ? "Correct. Vise 20 % pour accélérer." : "Faible. Cible d'abord ton plus gros poste."))),
                top && React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 6 } }, "🔍 Plus gros poste"),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                        React.createElement("span", { style: { fontSize: 20 } }, finCats.find(c => c.k === top.cat)?.e),
                        React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 800 } }, top.cat),
                            React.createElement("div", { style: { fontSize: 11, color: C.textMut } },
                                top.montant,
                                " € · ",
                                dep > 0 ? Math.round(top.montant / dep * 100) : 0,
                                " % des dépenses"))),
                    React.createElement("div", { style: { fontSize: 10.5, color: C.textDim, marginTop: 8 } },
                        "💡 −10 % sur ce poste = ",
                        React.createElement("b", { style: { color: C.green } },
                            Math.round(top.montant * 0.1 * 100) / 100,
                            " €/mois"),
                        " (~",
                        Math.round(top.montant * 0.1 * 12),
                        " €/an).")),
                change != null && React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 6 } }, "📊 Vs mois précédent"),
                    React.createElement("div", { style: { fontSize: 11, color: C.textMut } },
                        "Dépenses ",
                        change <= 0 ? "en baisse de " : "en hausse de ",
                        React.createElement("b", { style: { color: change <= 0 ? C.green : C.danger } },
                            Math.abs(change),
                            " %"),
                        " (",
                        prevDep,
                        " € → ",
                        dep,
                        " €).")),
                overCaps.length > 0 && React.createElement(Card, { border: C.danger + "44" },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 6 } }, "⚠️ Budgets dépassés"),
                    overCaps.map(c => React.createElement("div", { key: c.k, style: { fontSize: 11, color: C.textMut, lineHeight: 1.6 } },
                        c.e,
                        " ",
                        c.k,
                        " : ",
                        Math.round((bd[c.k] || 0) * 100) / 100,
                        " € (plafond ",
                        caps[c.k],
                        " €)"))),
                Object.keys(bd).length > 0 && React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: B, marginBottom: 10 } }, "Répartition des dépenses"),
                    React.createElement("div", { style: { display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 } }, Object.entries(bd).sort((a, b) => b[1] - a[1]).map(([k, v], i) => React.createElement("div", { key: k, style: { width: (v / dep * 100) + "%", background: finColors[i % finColors.length] } }))),
                    Object.entries(bd).sort((a, b) => b[1] - a[1]).map(([k, v], i) => { return React.createElement("div", { key: k, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, lineHeight: 1.9 } },
                        React.createElement("span", { style: { width: 9, height: 9, borderRadius: 2, background: finColors[i % finColors.length], flexShrink: 0 } }),
                        React.createElement("span", { style: { flex: 1, color: C.textMut } }, finCats.find(c => c.k === k)?.e,
                            " ",
                            k),
                        React.createElement("span", { style: { fontWeight: 700 } },
                            Math.round(v * 100) / 100,
                            " €"),
                        React.createElement("span", { style: { color: C.textDim, minWidth: 34, textAlign: "right" } },
                            Math.round(v / dep * 100),
                            "%")); })))));
}
function BudgetSection() {
    const [tab, setTab] = useState("resume");
    const [cat, setCat] = useState("Tous");
    const cats = ["Tous", ...new Set(budgetAliments.map(a => a.cat))];
    const filtered = cat === "Tous" ? budgetAliments : budgetAliments.filter(a => a.cat === cat);
    const totalF = filtered.reduce((a, x) => a + x.sem, 0);
    const totalPostes = postes.reduce((a, p) => a + p.val, 0);
    const tabs = [["resume", "📊 Résumé"], ["finances", "💰 Finances"], ["aliments", "🛒 Aliments"], ["alternatives", "💸 Alternatives"], ["suivi", "📊 Suivi"], ["conseils", "💡 Conseils"]].filter(([k]) => tabOk("budget", k));
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 } }, tabs.map(([k, l]) => React.createElement(Pill, { key: k, active: tab === k, onClick: () => setTab(k), color: C.budget }, l))),
        tab === "finances" && React.createElement(FinancePerso, null),
        tab === "resume" && React.createElement("div", null,
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 } }, [{ l: "Par semaine", v: "~" + TOTAL_SEM + " €", c: C.budget }, { l: "Par mois", v: "~" + TOTAL_MOIS + " €", c: C.budgetLight }, { l: "Version budget", v: "~" + TOTAL_SEM_B + " €", c: C.amber }, { l: "Économie / mois", v: "~60 €", c: C.green }].map(s => React.createElement(Card, { key: s.l, style: { borderTop: `3px solid ${s.c}`, marginBottom: 0 } },
                React.createElement("div", { style: { fontSize: 10, color: C.textMut } }, s.l),
                React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: s.c } }, s.v)))),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.budget, marginBottom: 10 } }, "📊 Répartition (€/sem)"),
                React.createElement("div", { style: { display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12 } }, postes.map(p => React.createElement("div", { key: p.nom, style: { width: `${p.val / totalPostes * 100}%`, background: p.color } }))),
                postes.map(p => React.createElement("div", { key: p.nom, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, lineHeight: 2 } },
                    React.createElement("span", { style: { width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 } }),
                    React.createElement("span", { style: { color: C.textMut, flex: 1 } }, p.nom),
                    React.createElement("span", { style: { fontWeight: 600 } },
                        p.val,
                        " €"),
                    React.createElement("span", { style: { color: C.textDim, minWidth: 36, textAlign: "right" } },
                        Math.round(p.val / totalPostes * 100),
                        "%"))))),
        tab === "aliments" && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", gap: 5, overflowX: "auto", marginBottom: 12 } }, cats.map(c => React.createElement(Pill, { key: c, active: cat === c, onClick: () => setCat(c), color: C.budget }, c))),
            React.createElement(Card, null,
                [...filtered].sort((a, b) => b.sem - a.sem).map((a, i) => React.createElement("div", { key: a.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? `1px solid ${C.borderSoft}` : "none" } },
                    React.createElement("span", { style: { fontSize: 16 } }, a.emoji),
                    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 600 } }, a.nom),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim } },
                            a.q,
                            a.prixKg && ` · ~${a.prixKg} €/kg`)),
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.budgetLight } },
                        a.sem,
                        " €"))),
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` } },
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: C.textMut } },
                        "Total ",
                        cat === "Tous" ? "semaine" : cat),
                    React.createElement("span", { style: { fontSize: 16, fontWeight: 800, color: C.budget } },
                        "~",
                        Math.round(totalF),
                        " €")))),
        tab === "alternatives" && React.createElement("div", null,
            swaps.map(s => React.createElement(Card, { key: s.de, border: C.amber + "33" },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 } },
                    React.createElement("span", { style: { fontSize: 12, color: C.danger, textDecoration: "line-through" } }, s.de),
                    React.createElement("span", { style: { color: C.textDim } }, "→"),
                    React.createElement("span", { style: { fontSize: 12, color: C.green, fontWeight: 700 } }, s.a)),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut } }, s.detail),
                React.createElement("div", { style: { fontSize: 12, color: C.amber, fontWeight: 700, marginTop: 4 } },
                    "💰 -",
                    s.saveSem,
                    " €/sem"))),
            React.createElement(Card, { border: C.green + "44" },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: C.green } }, "Total avec swaps"),
                    React.createElement("div", null,
                        React.createElement("span", { style: { fontSize: 12, color: C.danger, textDecoration: "line-through", marginRight: 8 } },
                            "~",
                            TOTAL_SEM,
                            " €"),
                        React.createElement("span", { style: { fontSize: 18, fontWeight: 800, color: C.green } },
                            "~",
                            TOTAL_SEM_B,
                            " €/sem"))))),
        tab === "suivi" && React.createElement(SuiviBudget, null),
        tab === "conseils" && React.createElement("div", null, budgetConseils.map(c => React.createElement(Card, { key: c.t, style: { borderLeft: `3px solid ${C.budget}`, borderRadius: "0 14px 14px 0" } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.budgetLight, marginBottom: 4 } },
                "💡 ",
                c.t),
            React.createElement("div", { style: { fontSize: 12, color: C.textMut, lineHeight: 1.5 } }, c.d)))));
}
/* ═══ RÉCUPÉRATION DU MATIN ═══
 * "recup-logs" = [{ id, dateISO, ans (statut SNA −10…+10), rmssd (VFC, ms), fc (FC nocturne, bpm), sleep (h) }] : saisie Polar du matin.
 * "bilans"     = [{ id, dateISO, nom, valeur, unite, lo, hi }] : prises de sang, jamais dans le score.
 * Score /100 = moyenne pondérée des facteurs disponibles (un facteur sans données est retiré et les poids sont recalculés).
 * Chaque ligne de détail porte son type : m = mesuré (montre, balance), c = calculé (formule sur tes logs), e = estimé (tendance probable). */
let RECUP_TODAY = null, RECUP_RES = null; // calculés par App à chaque rendu
/* Sous 50 le matin, le coach passe tout seul en mode récup (aucune hausse de charge ce jour-là) */
const recupMode = sci => !!(sci?.recovery || (RECUP_TODAY != null && RECUP_TODAY < 50));
const RECUP_W = { nerv: .30, sleep: .20, charge: .15, muscle: .15, fc: .10, energy: .10 };
const RECUP_ORDER = ["nerv", "sleep", "charge", "muscle", "fc", "energy"];
const RECUP_NAMES = { nerv: "Système nerveux", sleep: "Sommeil", charge: "Charge d'entraînement", muscle: "Fatigue musculaire", fc: "FC nocturne", energy: "Énergie" };
const LEG_MUSCLES = ["Quadriceps", "Ischios", "Fessiers", "Mollets"], UPPER_MUSCLES = ["Pecs", "Dos", "Épaules", "Biceps", "Triceps"];
const regionOf = nom => { const m = muscleOf(nom); return LEG_MUSCLES.includes(m) ? "legs" : UPPER_MUSCLES.includes(m) ? "upper" : null; };
const PAIN_REGION = { "Genou droit": ["legs"], "Pied droit": ["legs"], "Hanche": ["legs"], "Épaule": ["upper"], "Poignet": ["upper"], "Coude": ["upper"], "Bas du dos": ["legs", "upper"] };
const MAISON_REGION = { A: ["legs"], B: ["upper"], C: ["legs", "upper"], D: ["legs", "upper"] };
const REGION_FR = { legs: "jambes", upper: "haut du corps", both: "corps entier" };
const exSets = e => e.setsDetail?.length || e.sets || 0;
const rClamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const avgOf = a => a.reduce((s, v) => s + v, 0) / a.length;
const frN = (v, d = 1) => Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d });
const sgn = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + frN(Math.abs(v), d);
const fmtHM = h => { let H = Math.floor(h), M = Math.round((h - H) * 60); if (M === 60) {
    H++;
    M = 0;
} return H + " h " + String(M).padStart(2, "0"); };
/* « 7:45 », « 7h45 », « 7,5 » → heures */
function parseSleepH(s) { const t = String(s ?? "").trim().replace(",", "."); if (!t)
    return null; const m = t.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?$/i); if (m)
    return +m[1] + (+m[2] || 0) / 60; const v = parseFloat(t); return isFinite(v) ? v : null; }
function recupVerdict(s) { return s >= 80 ? { t: "Prêt pour une séance intense", short: "prêt", c: C.green } : s >= 65 ? { t: "Séance normale", short: "séance normale", c: C.green } : s >= 50 ? { t: "Séance allégée", short: "séance allégée", c: C.gluc } : { t: "Repos actif", short: "repos actif", c: C.danger }; }
const recupTone = v => v >= 75 ? { c: C.green, tc: C.greenLight, t: "bon" } : v >= 55 ? { c: C.gluc, tc: C.blueLight, t: "moyen" } : { c: C.danger, tc: C.danger, t: "bas" };
/* Muscles travaillés par une séance prévue : jambes, haut du corps ou les deux */
function sessionRegion(s) {
    if (!s)
        return null;
    if (s.prog === "maison") {
        const r = MAISON_REGION[s.code] || ["legs", "upper"];
        return r.length > 1 ? "both" : r[0];
    }
    const se = seanceById(s.code);
    if (!se)
        return "both";
    let L = 0, U = 0;
    se.exercices.forEach(e => { const r = regionOf(e.nom), n = parseRepRange(e.detail)?.sets || 3; if (r === "legs")
        L += n;
    else if (r === "upper")
        U += n; });
    return L + U === 0 ? "both" : L >= .7 * (L + U) ? "legs" : U >= .7 * (L + U) ? "upper" : "both";
}
/* Toutes les données utiles au score, abonnées en direct */
function useRecoveryData() {
    const [rl] = useStored("recup-logs", []);
    const [sl] = useStored("sport-logs", []);
    const [ml] = useStored("maison-logs", []);
    const [swl] = useStored("natation-logs", []);
    const [models] = useStored("natation-modeles", []);
    const [nl] = useStored("nutri-logs", []);
    const [food] = useStored("food-log", {});
    const [dl] = useStored("douleur-logs", []);
    const [mens] = useStored("mensurations", []);
    const [h] = useStored("taille-corps", "");
    const [cfg] = useStored("nutri-cal-cfg", null);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [alts] = useStored("repas-alts", {});
    return { rl: rl || [], sl: sl || [], ml: ml || [], swl: swl || [], models: models || [], nl: nl || [], food: food || {}, dl: dl || [], mens: mens || [], cm: parseFloat(h) || 0, cfg: normCalCfg(cfg), profile, alts: alts || {} };
}
/* Score de récupération d'un matin (null sans saisie ce jour-là). Seules les données d'avant ce matin comptent. */
function recoveryFor(iso, D) {
    const { rl, sl, ml, swl, nl } = D;
    const e = rl.find(l => l.dateISO === iso);
    if (!e)
        return null;
    const P = {}, det = { nerv: [], sleep: [], charge: [], muscle: [], fc: [], energy: [] }, info = {};
    const y = shiftISO(iso, -1);
    const prior = rl.filter(l => l.dateISO < iso && daysBetween(l.dateISO, iso) <= 30);
    // Système nerveux : statut SNA + VFC face à ta zone normale (log de la VFC sur 30 jours, moyenne ± ½ écart-type)
    let hrvS = null;
    if (e.rmssd > 0) {
        const ph = prior.filter(l => l.rmssd > 0);
        if (ph.length >= 5) {
            const ln = ph.map(l => Math.log(l.rmssd)), m = avgOf(ln);
            const sd = Math.max(.03, Math.sqrt(ln.reduce((a, v) => a + (v - m) ** 2, 0) / (ln.length - 1)));
            const win = rl.filter(l => l.rmssd > 0 && l.dateISO <= iso && daysBetween(l.dateISO, iso) <= 6);
            const roll = Math.round(Math.exp(avgOf(win.map(l => Math.log(l.rmssd)))));
            const lo = Math.round(Math.exp(m - sd / 2)), hi = Math.round(Math.exp(m + sd / 2));
            hrvS = rClamp(75 + 25 * (Math.log(e.rmssd) - m) / sd);
            info.zone = { lo, hi, roll };
            det.nerv.push(["VFC " + e.rmssd + " ms, " + (e.rmssd < lo ? "sous" : e.rmssd > hi ? "au-dessus de" : "dans") + " ta zone normale (" + lo + "–" + hi + " ms) · moyenne 7 j : " + roll + " ms", "m"]);
        }
        else
            det.nerv.push(["VFC " + e.rmssd + " ms · ta zone normale se calcule après 5 matins (" + ph.length + "/5)", "m"]);
    }
    const ansS = typeof e.ans === "number" ? rClamp(70 + 5 * e.ans) : null;
    if (ansS != null)
        det.nerv.unshift(["Statut SNA " + sgn(e.ans) + " (recharge nocturne)", "m"]);
    const nv = [ansS, hrvS].filter(v => v != null);
    if (nv.length)
        P.nerv = avgOf(nv);
    // Sans montre : une seule question au réveil (0 mal dormi, 1 correct, 2 très bien)
    if (P.nerv == null && typeof e.feel === "number") {
        P.nerv = [45, 70, 88][e.feel] ?? 70;
        det.nerv.push(["Ton ressenti au réveil : " + ["mal dormi", "nuit correcte", "très bien dormi"][e.feel], "m"]);
    }
    // FC nocturne face à ta moyenne sur 30 jours
    if (e.fc > 0) {
        const pf = prior.filter(l => l.fc > 0);
        if (pf.length >= 5) {
            const fm = avgOf(pf.map(l => l.fc)), d = e.fc - fm;
            P.fc = rClamp(80 - 10 * d);
            det.fc.push([e.fc + " bpm, " + (Math.abs(d) < .5 ? "comme ta moyenne" : sgn(d) + " bpm face à ta moyenne de " + frN(fm)), "m"]);
        }
        else
            det.fc.push([e.fc + " bpm · ta moyenne de référence se calcule après 5 matins (" + pf.length + "/5)", "m"]);
    }
    // Sommeil (montre, sinon la valeur notée dans Suivi nutrition) : 8 h = 100
    const nTo = nl.find(l => l.dateISO === iso);
    const sh = e.sleep > 0 ? e.sleep : nTo?.sleep > 0 ? +nTo.sleep : null;
    if (sh) {
        P.sleep = rClamp((sh - 4) / 4 * 100);
        det.sleep.push([fmtHM(sh) + " cette nuit" + (e.sleep > 0 ? "" : " (noté dans Suivi nutrition)"), "m"]);
    }
    // Charge : séries pondérées par le RPE + circuits maison + natation, 7 jours face à la moyenne sur 28 jours
    const loads = [...sl.map(l => [l.dateISO, (l.exercices || []).reduce((a, x) => a + exSets(x) * ((x.rpe || 7) / 7), 0) * (l.deload ? .6 : 1)]),
        ...ml.map(l => [l.dateISO, (l.exercices || []).reduce((a, x) => a + (x.tours || 0) * .7, 0)]),
        ...swl.map(l => [l.dateISO, (l.duree || 0) / 240 * ((l.rpe || 6) / 7)])].filter(([d]) => d < iso);
    if (loads.length) {
        const first = loads.reduce((a, [d]) => d < a ? d : a, iso);
        const acute = loads.filter(([d]) => daysBetween(d, iso) <= 7).reduce((a, [, v]) => a + v, 0);
        const chronic = loads.filter(([d]) => daysBetween(d, iso) <= 28).reduce((a, [, v]) => a + v, 0) / 4;
        if (daysBetween(first, iso) >= 14 && chronic > 0) {
            const r = acute / chronic;
            P.charge = r <= .8 ? 95 : r <= 1.3 ? 90 - (r - .8) * 20 : r <= 1.5 ? 80 - (r - 1.3) * 150 : Math.max(20, 50 - (r - 1.5) * 100);
            det.charge.push(["7 derniers jours : " + frN(r, 2) + " fois ta moyenne sur 28 jours" + (r > 1.3 ? ", pic de charge" : r < .8 ? ", semaine légère" : ""), "c"]);
        }
        else
            det.charge.push(["Calcul disponible après 2 semaines d'entraînement enregistrées", "c"]);
    }
    const yTxt = [];
    sl.filter(l => l.dateISO === y).forEach(l => { const ex = l.exercices || [], n = ex.reduce((a, x) => a + exSets(x), 0), rp = ex.filter(x => x.rpe > 0); yTxt.push(l.seance + " (" + n + " séries" + (rp.length ? ", RPE moyen " + frN(avgOf(rp.map(x => x.rpe))) : "") + ")"); });
    ml.filter(l => l.dateISO === y).forEach(l => yTxt.push("Maison " + l.seance));
    swl.filter(l => l.dateISO === y).forEach(l => yTxt.push(l.distance.toLocaleString("fr-FR") + " m de natation"));
    if (yTxt.length)
        det.charge.push(["Hier : " + yTxt.join(", "), "c"]);
    // Fatigue musculaire par région : baisse de force estimée (1RM Epley) face au meilleur des 4 semaines, séance récente, douleurs
    const region = r => {
        const hist = sl.filter(l => !l.deload && l.dateISO < iso && (l.exercices || []).some(x => regionOf(x.nom) === r && exSets(x) > 0)).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
        const last = hist[0];
        let drop = null, since = null, recent = 0;
        if (last) {
            since = daysBetween(last.dateISO, iso);
            const mine = last.exercices.filter(x => regionOf(x.nom) === r);
            if (since <= 7) {
                const ref = sl.filter(l => !l.deload && l.dateISO < last.dateISO && daysBetween(l.dateISO, last.dateISO) <= 28);
                const drops = mine.filter(x => x.weight > 0 && x.reps > 0).map(x => { const b = ref.flatMap(l => (l.exercices || []).filter(z => z.nom === x.nom && z.weight > 0 && z.reps > 0).map(exBest1RM)); const best = b.length ? Math.max(...b) : 0; return best > 0 ? Math.min(0, (exBest1RM(x) - best) / best * 100) : null; }).filter(v => v != null);
                if (drops.length)
                    drop = avgOf(drops);
            }
            const hard = mine.reduce((a, x) => a + exSets(x) * ((x.rpe || 7) / 8), 0);
            recent = since === 1 ? Math.min(25, hard * 1.2) : since === 2 ? Math.min(12, hard * .6) : 0;
        }
        if (ml.some(l => l.dateISO === y && (MAISON_REGION[l.seance] || []).includes(r))) {
            recent = Math.max(recent, 8);
            since = 1;
        }
        const pains = D.dl.filter(l => l.dateISO <= iso && daysBetween(l.dateISO, iso) <= 3 && (PAIN_REGION[l.zone] || []).includes(r) && l.intensite > 0);
        const pain = pains.length ? pains.reduce((a, l) => l.intensite > a.i ? { i: l.intensite, z: l.zone } : a, { i: 0, z: "" }) : null;
        return { score: rClamp(95 + (drop || 0) * 6 - (pain ? pain.i * 5 : 0) - recent), drop, since, pain, has: !!last || !!pain || recent > 0 };
    };
    const legs = region("legs"), upper = region("upper");
    const prog = resolveProgramme(D.profile, sl), sess = sessionForDate(iso, prog), sReg = sessionRegion(sess);
    if (legs.has || upper.has) {
        P.muscle = sReg === "legs" ? legs.score : sReg === "upper" ? upper.score : (legs.score + upper.score) / 2;
        [["Jambes", legs], ["Haut du corps", upper]].forEach(([lab, st]) => { if (!st.has)
            return; const bits = []; if (st.drop != null)
            bits.push(st.drop > -.5 ? "force stable face à ton meilleur des 4 semaines" : "force estimée " + sgn(st.drop) + " % face à ton meilleur des 4 semaines"); if (st.since != null && st.since <= 2)
            bits.push("séance il y a " + (st.since === 1 ? "1 jour" : st.since + " jours")); if (st.pain)
            bits.push("douleur " + st.pain.z.toLowerCase() + " " + st.pain.i + "/10"); det.muscle.push([lab + " " + Math.round(st.score) + "/100" + (bits.length ? " : " + bits.join(", ") : ""), "e"]); });
    }
    Object.assign(info, { legs, upper, sess, sReg, prog });
    // Énergie : apports face à ton plan (3 jours), disponibilité énergétique, glycogène estimé, rythme de perte
    const bt = bodyTargets(nl, D.mens, D.cm, D.cfg);
    const dayData = d => {
        const nlog = nl.find(l => l.dateISO === d), foods = D.food[d] || [];
        const dayType = nlog?.dayType || (sessionForDate(d, prog) ? "training" : "rest");
        const sw = swimKcalOn(swl, d), menu = dayMenu(dayType, D.profile, D.alts, bt, sw);
        let kc = 0, g = 0;
        menu.meals.forEach((m, i) => { const id = MEAL_ID[m.m], mm = menu.mealMacros[i]; if (id && nlog?.meals?.[id]) {
            kc += mm.p * 4 + mm.g * 4 + mm.l * 9;
            g += mm.g;
        } });
        const pl = foods.filter(f => f.plan), ex = foods.filter(f => !f.plan), pk = pl.reduce((a, f) => a + (f.kcal || 0), 0);
        if (pk > kc) {
            kc = pk;
            g = pl.reduce((a, f) => a + (f.gl || 0), 0);
        }
        kc += ex.reduce((a, f) => a + (f.kcal || 0), 0);
        g += ex.reduce((a, f) => a + (f.gl || 0), 0);
        if (kc <= 0)
            return null;
        const sets = sl.filter(l => l.dateISO === d).reduce((a, l) => a + (l.exercices || []).reduce((b, x) => b + exSets(x), 0), 0);
        return { kc, g, tgt: menu.dayTgt, gTgt: menu.dayMacros.g, exo: sw + sets * .06 * (bt.curW || 100) };
    };
    const d3 = [1, 2, 3].map(k => dayData(shiftISO(iso, -k))), has3 = d3.filter(Boolean);
    let eaS = null, glyS = null, rateS = null;
    if (has3.length) {
        const ik = has3.reduce((a, x) => a + x.kc, 0), tk = has3.reduce((a, x) => a + x.tgt, 0), xk = has3.reduce((a, x) => a + x.exo, 0), pct = ik / tk * 100;
        eaS = pct >= 90 ? Math.min(100, 80 + (pct - 90) * 2) : pct >= 75 ? 45 + (pct - 75) * 35 / 15 : Math.max(10, 45 - (75 - pct) * 5);
        info.intake = { pct, n: has3.length, gap: Math.max(0, (tk - ik) / has3.length) };
        det.energy.push(["Apports " + (has3.length > 1 ? "des " + has3.length + " derniers jours" : "d'hier") + " : " + Math.round(pct) + " % de ton plan", "c"]);
        if (bt.lean > 0)
            det.energy.push(["Disponibilité énergétique ≈ " + frN((ik - xk) / has3.length / bt.lean, 0) + " kcal/kg de masse maigre (plan : " + frN((tk - xk) / has3.length / bt.lean, 0) + ")", "c"]);
    }
    const d2 = d3.slice(0, 2).filter(Boolean);
    if (d2.length) {
        const ySets = sl.filter(l => l.dateISO === y).reduce((a, l) => a + (l.exercices || []).reduce((b, x) => b + exSets(x), 0), 0);
        const yLegs = sl.some(l => l.dateISO === y && (l.exercices || []).some(x => regionOf(x.nom) === "legs" && exSets(x) > 0));
        const ratio = d2.reduce((a, x) => a + x.g, 0) / d2.reduce((a, x) => a + x.gTgt, 0) - (ySets >= 15 ? .05 : 0) - (yLegs ? .05 : 0);
        glyS = rClamp(ratio * 100);
        det.energy.push(["Glycogène " + (ratio >= .9 ? "probablement rempli" : ratio >= .7 ? "probablement partiellement diminué" : "probablement bas") + " (glucides des 48 h face à ton plan et à ta séance d'hier)", "e"]);
    }
    const weigh = nl.filter(l => l.weight > 0 && l.dateISO <= iso).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    if (weigh.length >= 3 && daysBetween(weigh[0].dateISO, weigh[weigh.length - 1].dateISO) >= 10) {
        const rt = weeklyRate(weigh), cw = avgRecent(weigh, 7);
        if (rt != null && cw) {
            const pc = rt / cw * 100;
            rateS = pc < -1 ? rClamp(90 - (-pc - 1) * 80) : pc > -.25 ? 85 : 90;
            det.energy.push(["Poids " + sgn(pc) + " % par semaine" + (pc < -1 ? ", perte trop rapide" : ""), "m"]);
        }
    }
    const en = [[eaS, .5], [glyS, .25], [rateS, .25]].filter(([v]) => v != null);
    if (en.length)
        P.energy = en.reduce((a, [v, w]) => a + v * w, 0) / en.reduce((a, [, w]) => a + w, 0);
    info.eaS = eaS;
    const keys = Object.keys(P);
    if (!keys.length)
        return { iso, entry: e, score: null, parts: P, det, info };
    const ws = keys.reduce((a, k) => a + RECUP_W[k], 0);
    const score = Math.round(keys.reduce((a, k) => a + RECUP_W[k] * P[k], 0) / ws);
    const res = { iso, entry: e, score, parts: P, det, info, lowest: keys.slice().sort((a, b) => P[a] - P[b])[0], verdict: recupVerdict(score) };
    res.advice = recupAdvice(res, D);
    return res;
}
/* Conseil pour la séance prévue (programme actif) */
function recupAdvice(r, D) {
    let s = r.info.sess;
    const { sReg: reg, prog } = r.info, sc = r.score, swimP = swimPlannedFor(D.models, r.iso);
    let a;
    if (!s)
        a = sc < 50 ? "Pas de muscu aujourd'hui : marche, mobilité et coucher tôt." + (swimP ? " Natation en allure facile, sans série rapide." : "") : "Pas de muscu prévue aujourd'hui." + (swimP ? (sc < 65 ? " Natation : garde une allure facile, sans série rapide." : " Natation prévue : feu vert.") : " Marche et mobilité suffisent.");
    else {
        const st = reg === "legs" ? r.info.legs : reg === "upper" ? r.info.upper : null;
        const light = "une série de moins par exercice, " + lx("difficulté 7 sur 10 maximum", "RPE 7 maximum");
        const nm = o => o.prog === "maison" ? o.label : seanceLabel(o.code); // lexique : « Jambes » plutôt que « Legs » avant le niveau expert
        s = { ...s, label: nm(s) };
        if (sc < 50)
            a = "Repos actif : 30 à 40 min de marche ou de natation souple, puis mobilité. Décale " + s.label + " si ton planning le permet.";
        else if (st && st.has && st.score < 55) {
            let alt = null;
            for (let d = 1; d <= 6 && !alt; d++) {
                const o = sessionForDate(shiftISO(r.iso, d), prog), oR = sessionRegion(o);
                if (o && oR && oR !== reg && oR !== "both")
                    alt = { o, d };
            }
            a = (reg === "legs" ? "Tes jambes sont encore fatiguées" : "Ton haut du corps est encore fatigué") + " (" + Math.round(st.score) + "/100). " +
                (alt ? "Si ton planning le permet, inverse : " + nm(alt.o) + " aujourd'hui, " + s.label + " " + (alt.d === 1 ? "demain" : fmtDateLong(shiftISO(r.iso, alt.d)).split(" ")[0]) + ". Sinon, fais " : "Fais ") +
                s.label + " avec " + light + (st.pain ? ", et surveille ton " + st.pain.z.toLowerCase() : "") + ".";
        }
        else if (sc < 65)
            a = s.label + " allégée : " + light + ", charges du coach inchangées.";
        else if (sc < 80)
            a = s.label + " normale : charges du coach, " + lx("difficulté 8 sur 10 maximum", "RPE 8 maximum") + ", pas de record aujourd'hui.";
        else
            a = "Feu vert pour " + s.label + " : charges du coach, vise le haut de ta fourchette de reps.";
    }
    if (r.info.eaS != null && r.info.eaS < 50 && r.info.intake)
        a += " Mange ton plan complet aujourd'hui : il te manque environ " + Math.round(r.info.intake.gap / 10) * 10 + " kcal par jour.";
    if (sc < 50)
        a += " Le coach ne propose aucune hausse de charge aujourd'hui.";
    return a;
}
/* Saisie du matin : 4 champs lus dans Polar Flow (Recharge nocturne + Sommeil) */
function RecupForm({ fg, bg, onDone, onCancel }) {
    const [rl, setRl] = useStored("recup-logs", []);
    const today = isoToday(), ex = rl.find(l => l.dateISO === today);
    const fromEntry = x => ({ ans: x?.ans != null ? String(x.ans).replace(".", ",") : "", rmssd: x?.rmssd ? String(x.rmssd) : "", fc: x?.fc ? String(x.fc) : "", sleep: x?.sleep ? fmtHM(x.sleep).replace(" h ", ":") : "" });
    const [f, setF] = useState(() => fromEntry(ex));
    useEffect(() => { if (ex)
        setF(fromEntry(ex)); }, [ex?.id]);
    const num = (v, lo, hi) => { const x = parseFloat(String(v).replace(",", ".").replace(/[−–]/, "-")); return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : null; };
    const submit = async () => {
        const sl = parseSleepH(f.sleep), ans = num(f.ans, -10, 10), rm = num(f.rmssd, 5, 300), fc = num(f.fc, 25, 130);
        const entry = { id: ex?.id || Date.now(), dateISO: today, ans: ans == null ? null : Math.round(ans * 10) / 10, rmssd: rm == null ? null : Math.round(rm), fc: fc == null ? null : Math.round(fc), sleep: sl && sl > 0 && sl < 16 ? Math.round(sl * 100) / 100 : null };
        if (entry.ans == null && entry.rmssd == null && entry.fc == null && entry.sleep == null)
            return toast("Remplis au moins un champ", { tone: "danger" });
        await setRl([...rl.filter(l => l.dateISO !== today), entry].sort((a, b) => a.dateISO.localeCompare(b.dateISO)));
        toast("🫀 Saisie du matin enregistrée");
        onDone && onDone();
    };
    const field = (k, label, hint, mode, ph) => hx("label", { style: { display: "grid", gap: 3, minWidth: 0 } },
        hx("span", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" } }, label),
        hx("input", { value: f[k], inputMode: mode, placeholder: ph, onChange: e => { const v = e.target.value; setF(x => ({ ...x, [k]: v })); }, style: { ...inputStyle, borderColor: fg, fontWeight: 700, fontSize: 18 } }),
        hx("small", { style: { fontSize: 11.5, fontWeight: 600, opacity: .8 } }, hint));
    return hx("div", { style: { display: "grid", gap: 10 } },
        hx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
            field("ans", "Statut SNA", "de −10 à +10", "decimal", "+1,5"),
            field("rmssd", "VFC (ms)", "moyenne de la nuit", "numeric", "45"),
            field("fc", "FC nocturne", "bpm, moyenne de la nuit", "numeric", "57"),
            field("sleep", "Sommeil", "ex. 7:45", "decimal", "7:45")),
        hx("p", { style: { fontSize: 12.5, fontWeight: 600, opacity: .85, margin: 0, lineHeight: 1.4 } }, "Dans Polar Flow : Recharge nocturne pour les trois premiers chiffres, Sommeil pour la durée. Un champ vide est simplement ignoré."),
        hx("div", { style: { display: "flex", gap: 8 } },
            onCancel && hx("button", { onClick: onCancel, style: { flex: 1, padding: "12px 0", borderRadius: 4, border: `2px solid ${fg}`, background: "transparent", color: fg, fontWeight: 800, fontSize: 14, cursor: "pointer" } }, "Annuler"),
            hx("button", { onClick: submit, style: { flex: 2, padding: "12px 0", borderRadius: 4, border: `2px solid ${fg}`, background: fg, color: bg, fontWeight: 800, fontSize: 14, cursor: "pointer" } }, ex ? "Mettre à jour" : "Enregistrer")));
}
/* En-tête : score, verdict, facteur qui pèse le plus, conseil pour la séance prévue */
function RecupHead({ r, fg, bg, giant }) {
    if (r.score == null)
        return hx("p", { style: { fontSize: 15, fontWeight: 700, lineHeight: 1.4, margin: "0 0 12px" } }, "Saisie enregistrée. Le score s'affiche dès que le statut SNA ou le sommeil est renseigné, ou après 5 matins de VFC.");
    const v = r.verdict, low = r.lowest, lv = r.parts[low];
    // Facteur le plus bas, avec sa raison (pour les muscles : la région de la séance prévue)
    let lowName = low === "fc" ? RECUP_NAMES.fc : RECUP_NAMES[low].toLowerCase(), lowDet = r.det[low][0] ? r.det[low][0][0] : "";
    if (low === "muscle") {
        const reg = r.info.sReg === "upper" ? "upper" : "legs", line = r.det.muscle.find(([t]) => t.startsWith(reg === "upper" ? "Haut du corps" : "Jambes")) || r.det.muscle[0];
        lowName = "fatigue musculaire (" + (r.info.sReg === "both" ? "corps entier" : REGION_FR[reg]) + ")";
        lowDet = line && line[0].includes(" : ") ? line[0].split(" : ").slice(1).join(" : ") : "";
        lowDet = lowDet ? lowDet[0].toUpperCase() + lowDet.slice(1) : "";
    }
    return hx(Fragment, null,
        hx("div", { style: { display: "flex", alignItems: "flex-end", gap: 8 } }, hx("div", { style: giant }, r.score), hx("span", { style: { fontFamily: AN, fontSize: 30, lineHeight: 1, paddingBottom: 12 } }, "/100")),
        hx("div", { style: { display: "inline-flex", alignItems: "center", gap: 8, background: fg, color: bg, fontWeight: 800, fontSize: 15, padding: "7px 12px", borderRadius: 3, marginBottom: 10 } }, hx("i", { style: { width: 11, height: 11, borderRadius: "50%", background: v.c, display: "inline-block" } }), v.t),
        hx("p", { style: { fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, margin: "0 0 12px" } }, lv < 75 ? "Ce qui pèse le plus : " + lowName + ", " + Math.round(lv) + "/100." + (lowDet ? " " + lowDet + "." : "") : "Tous les facteurs sont bons ce matin."),
        hx("div", { style: { borderTop: `2.5px solid ${fg}`, paddingTop: 10, marginBottom: 14 } },
            hx("small", { style: { display: "block", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 } }, r.info.sess ? "Séance prévue : " + (r.info.sess.prog === "maison" ? r.info.sess.label : seanceLabel(r.info.sess.code)) + (r.info.sReg ? " · " + REGION_FR[r.info.sReg] : "") : "Aujourd'hui"),
            hx("p", { style: { fontSize: 16, fontWeight: 750, lineHeight: 1.3, margin: 0 } }, r.advice)));
}
/* Détail par facteur, avec le type de chaque donnée */
const RECUP_TAG = { m: ["Mesuré", { background: C.ink, color: "#fff", border: `1.5px solid ${C.ink}` }], c: ["Calculé", { border: `1.5px solid ${C.ink}` }], e: ["Estimé", { border: `1.5px dashed ${C.ink}` }] };
function RecupDetail({ r }) {
    const tag = k => hx("em", { style: { fontStyle: "normal", fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 6px", borderRadius: 3, whiteSpace: "nowrap", ...RECUP_TAG[k][1] } }, RECUP_TAG[k][0]);
    return hx("div", null,
        hx("div", { style: { display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12.5, color: C.textMut, margin: "0 0 10px" } }, [["m", "par ta montre ou ta balance"], ["c", "formule sur tes logs"], ["e", "tendance probable"]].map(([k, t]) => hx("span", { key: k, style: { display: "inline-flex", gap: 6, alignItems: "center" } }, tag(k), t))),
        hx("div", { style: { borderTop: `2.5px solid ${C.ink}` } }, RECUP_ORDER.filter(k => r.parts[k] != null || r.det[k].length).map(k => {
            const v = r.parts[k], t = v != null ? recupTone(v) : null;
            return hx("div", { key: k, style: { borderBottom: `2px solid ${C.ink}`, padding: "11px 0", display: "grid", gap: 6 } },
                hx("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 } },
                    hx("span", { style: { fontSize: 17, fontWeight: 750, lineHeight: 1.2 } }, RECUP_NAMES[k], t ? hx("span", { style: { color: t.tc, fontWeight: 800 } }, " · " + t.t) : hx("span", { style: { color: C.textMut, fontWeight: 700, fontSize: 13 } }, " · pas encore de calcul"), hx("small", { style: { color: C.textMut, fontWeight: 600, fontSize: 11.5 } }, "  " + Math.round(RECUP_W[k] * 100) + " % du score")),
                    v != null && hx("span", { style: { fontFamily: AN, fontSize: 24, lineHeight: 1 } }, Math.round(v))),
                v != null && hx("div", { style: { height: 10, border: `2px solid ${C.ink}`, position: "relative" } }, hx("i", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: v + "%", background: t.c, transition: "width .5s cubic-bezier(.7,0,.2,1)" } })),
                r.det[k].map(([txt, kind], i) => hx("div", { key: i, style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.35 } }, hx("span", { style: { minWidth: 0 } }, txt), tag(kind))));
        })));
}
/* 14 jours : score du matin, puis VFC face à ta zone normale */
function RecupCharts({ D }) {
    const today = isoToday(), days = Array.from({ length: 14 }, (_, i) => shiftISO(today, i - 13));
    const res = days.map(d => recoveryFor(d, D));
    const W = 340, H = 140, L = 30, R = 10, T = 14, B = 22, iw = W - L - R, ih = H - T - B, x = i => L + i * iw / 13;
    const xLabels = days.map((d, i) => (i % 2 === 1 || i === 13) ? hx("text", { key: "x" + i, x: x(i), y: H - 5, textAnchor: "middle", fontSize: 10, fontWeight: 700, fill: C.textMut }, +d.slice(8, 10)) : null);
    const cap = txt => hx("div", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: C.textMut, margin: "16px 0 4px" } }, txt);
    const empty = txt => hx("p", { style: { fontSize: 13, color: C.textMut, margin: "4px 0 0" } }, txt);
    const sw = style => hx("i", { style: { width: 16, height: 10, display: "inline-block", ...style } });
    const item = (s, t) => hx("span", { style: { display: "inline-flex", gap: 6, alignItems: "center" } }, s, t);
    const legend = (...items) => hx("div", { style: { display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: C.textMut, marginTop: 4 } }, ...items);
    // Score
    const y = v => T + ih - v / 100 * ih;
    const pts = res.map((r, i) => r && r.score != null ? { i, v: r.score } : null).filter(Boolean);
    const lastS = pts[pts.length - 1];
    const scoreSvg = pts.length < 2 ? empty("Le graphique apparaît après 2 matins saisis.") : hx("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", height: "auto", display: "block" }, role: "img", "aria-label": "Score de récupération des 14 derniers jours" },
        hx("rect", { x: L, y: y(100), width: iw, height: y(80) - y(100), fill: C.sci }),
        [0, 50, 80, 100].map(v => hx(Fragment, { key: v }, hx("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: C.ink + "22" }), hx("text", { x: L - 6, y: y(v) + 3.5, textAnchor: "end", fontSize: 10, fill: C.textMut }, v))),
        hx("polyline", { fill: "none", stroke: C.ink, strokeWidth: 2.5, strokeLinejoin: "round", points: pts.map(p => x(p.i) + "," + y(p.v)).join(" ") }),
        pts.map(p => hx("circle", { key: p.i, cx: x(p.i), cy: y(p.v), r: p === lastS ? 5.5 : 3, fill: p === lastS ? C.sci : C.ink, stroke: C.ink, strokeWidth: p === lastS ? 2.5 : 0 })),
        hx("text", { x: x(lastS.i), y: y(lastS.v) - 10, textAnchor: "end", fontFamily: "Anton, Impact, sans-serif", fontSize: 15, fill: C.ink }, lastS.v),
        xLabels);
    // VFC + zone normale (celle du dernier matin calculé) + moyenne sur 7 jours
    const hv = days.map(d => D.rl.find(l => l.dateISO === d && l.rmssd > 0)?.rmssd || null);
    const zone = [...res].reverse().find(r => r?.info?.zone)?.info.zone || null;
    const vals = hv.filter(Boolean);
    let hrvSvg;
    if (vals.length < 2)
        hrvSvg = empty("La VFC s'affiche après 2 matins saisis. Ta zone normale apparaît après 5.");
    else {
        const roll = days.map((d, i) => { if (!hv[i])
            return null; const win = D.rl.filter(l => l.rmssd > 0 && l.dateISO <= d && daysBetween(l.dateISO, d) <= 6); return Math.exp(avgOf(win.map(l => Math.log(l.rmssd)))); });
        const all = [...vals, ...(zone ? [zone.lo, zone.hi] : [])];
        const lo = Math.floor(Math.min(...all) / 5) * 5 - 5, hi = Math.ceil(Math.max(...all) / 5) * 5 + 5;
        const y2 = v => T + ih - (v - lo) / (hi - lo) * ih;
        const rp = roll.map((v, i) => v ? x(i) + "," + y2(v) : null).filter(Boolean);
        const lastI = hv.map((v, i) => v ? i : -1).filter(i => i >= 0).pop();
        hrvSvg = hx("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", height: "auto", display: "block" }, role: "img", "aria-label": "VFC des 14 derniers jours face à ta zone normale" },
            zone && hx("rect", { x: L, y: y2(zone.hi), width: iw, height: y2(zone.lo) - y2(zone.hi), fill: C.green + "33", stroke: C.green, strokeWidth: 1 }),
            [...new Set([lo, hi, ...(zone ? [zone.lo, zone.hi] : [])])].map(v => hx("text", { key: v, x: L - 6, y: y2(v) + 3.5, textAnchor: "end", fontSize: 10, fill: C.textMut }, v)),
            hx("line", { x1: L, x2: W - R, y1: y2(lo), y2: y2(lo), stroke: C.ink + "22" }),
            hv.map((v, i) => v ? hx("circle", { key: i, cx: x(i), cy: y2(v), r: i === lastI ? 4.5 : 3, fill: i === lastI ? C.ink : C.textMut }) : null),
            rp.length > 1 && hx("polyline", { fill: "none", stroke: C.ink, strokeWidth: 2.5, strokeLinejoin: "round", points: rp.join(" ") }),
            hx("text", { x: x(lastI), y: y2(hv[lastI]) + (roll[lastI] && hv[lastI] < roll[lastI] ? 18 : -9), textAnchor: "end", fontFamily: "Anton, Impact, sans-serif", fontSize: 14, fill: C.ink }, hv[lastI] + " ms"),
            xLabels);
    }
    return hx("div", null,
        cap("Score du matin · 14 jours"), scoreSvg,
        pts.length >= 2 && legend(item(sw({ background: C.ink }), "score"), item(sw({ background: C.sci, border: `1.5px solid ${C.ink}` }), "zone « prêt » (80 et plus)")),
        cap("VFC face à ta zone normale · 14 jours"), hrvSvg,
        vals.length >= 2 && legend(zone && item(sw({ background: C.green + "33", border: `1.5px solid ${C.green}` }), "zone normale (30 jours)"), item(sw({ background: C.ink }), "moyenne 7 jours"), item(sw({ background: C.textMut, width: 7, height: 7, borderRadius: "50%" }), "valeur de la nuit")));
}
/* Prises de sang : notées à part, jamais dans le score du jour */
const BILAN_PRESETS = [["Testostérone totale", "ng/mL"], ["Cortisol (8 h, à jeun)", "µg/dL"], ["CRP ultrasensible", "mg/L"], ["CK", "UI/L"], ["Ferritine", "ng/mL"], ["Vitamine D", "ng/mL"], ["Autre", ""]];
function BilansPonctuels() {
    const [bl, setBl] = useStored("bilans", []);
    const [sl] = useStored("sport-logs", []);
    const [open, setOpen] = useState(false);
    const [f, setF] = useState({ preset: 0, nom: "", valeur: "", unite: BILAN_PRESETS[0][1], lo: "", hi: "", date: isoToday() });
    const n = v => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : null; };
    const fmt = v => String(v).replace(".", ",");
    const add = async () => {
        const nom = f.preset === BILAN_PRESETS.length - 1 ? f.nom.trim() : BILAN_PRESETS[f.preset][0], val = n(f.valeur);
        if (!nom || val == null)
            return toast("Indique le nom et la valeur", { tone: "danger" });
        await setBl([...bl, { id: Date.now(), dateISO: f.date, nom, valeur: val, unite: f.unite.trim(), lo: n(f.lo), hi: n(f.hi) }]);
        toast("🩸 " + nom + " enregistré");
        setF(x => ({ ...x, valeur: "", lo: "", hi: "" }));
        setOpen(false);
    };
    const lab = (k, label, mode, ph, flex) => hx("label", { style: { display: "grid", gap: 3, minWidth: 0, flex: flex || 1 } }, hx("span", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: C.textMut } }, label), hx("input", { value: f[k], inputMode: mode, placeholder: ph, onChange: e => { const v = e.target.value; setF(x => ({ ...x, [k]: v })); }, style: inputStyle }));
    return hx("div", null,
        hx("div", { style: { fontFamily: AN, fontSize: 30, textTransform: "uppercase", margin: "24px 0 4px" } }, "Bilans ponctuels"),
        hx("p", { style: { fontSize: 13.5, color: C.textMut, lineHeight: 1.45, margin: "0 0 10px" } }, "Prises de sang, notées quand tu en fais une. Elles n'entrent jamais dans le score du jour. Recopie la plage de référence de ton compte rendu : elle change d'un laboratoire à l'autre."),
        !bl.length && hx("p", { style: { fontSize: 13.5, color: C.textMut, margin: "0 0 10px" } }, "Aucun bilan noté pour l'instant."),
        bl.length > 0 && hx("div", { style: { borderTop: `2px solid ${C.ink}` } }, [...bl].sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.id - a.id).map(b => {
            const out = b.lo != null && b.valeur < b.lo ? "en dessous" : b.hi != null && b.valeur > b.hi ? "au-dessus" : null;
            const range = b.lo != null && b.hi != null ? fmt(b.lo) + "–" + fmt(b.hi) : b.hi != null ? "< " + fmt(b.hi) : b.lo != null ? "> " + fmt(b.lo) : null;
            const heavy = /^CK\b/i.test(b.nom) && sl.some(l => !l.deload && l.dateISO <= b.dateISO && daysBetween(l.dateISO, b.dateISO) <= 2 && (l.exercices || []).reduce((a, x) => a + exSets(x), 0) >= 10);
            return hx("div", { key: b.id, style: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: "2px 10px", alignItems: "baseline", padding: "10px 0", borderBottom: `1.5px solid ${C.ink}22` } },
                hx("b", { style: { fontWeight: 750, fontSize: 15 } }, b.nom),
                hx("em", { style: { fontStyle: "normal", fontFamily: AN, fontSize: 20, whiteSpace: "nowrap", color: out ? C.danger : C.ink } }, fmt(b.valeur) + (b.unite ? " " + b.unite : "")),
                hx("button", { "aria-label": "Supprimer", onClick: () => commitWithUndo("bilans", bl, bl.filter(x => x.id !== b.id), setBl, "🗑️ Bilan supprimé"), style: { border: 0, background: "none", color: C.textMut, fontSize: 15, cursor: "pointer" } }, "✕"),
                hx("small", { style: { gridColumn: "1 / -1", fontSize: 12.5, color: C.textMut, lineHeight: 1.4 } }, (range ? "labo " + range + " · " : "") + fmtDateShort(b.dateISO), out && hx("span", { style: { color: C.danger, fontWeight: 800 } }, " · " + out + " de la plage du labo"), heavy && hx("span", { style: { color: C.danger, fontWeight: 700 } }, " · séance lourde dans les 48 h avant : CK probablement gonflée")));
        })),
        !open ? hx("button", { onClick: () => setOpen(true), style: { ...PM.out, marginTop: 12 } }, "+ Noter un bilan")
            : hx("div", { style: { border: `2px solid ${C.ink}`, borderRadius: 6, background: C.surface, padding: 12, marginTop: 12, display: "grid", gap: 10 } },
                hx("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, BILAN_PRESETS.map(([nm, u], i) => hx("button", { key: nm, onClick: () => setF(x => ({ ...x, preset: i, unite: u || x.unite })), style: PM.mini(f.preset === i) }, nm))),
                f.preset === BILAN_PRESETS.length - 1 && lab("nom", "Nom du dosage", "text", "Ex : TSH"),
                hx("div", { style: { display: "flex", gap: 8 } }, lab("valeur", "Valeur", "decimal", "5,1", 1.2), lab("unite", "Unité", "text", "ng/mL")),
                hx("div", { style: { display: "flex", gap: 8 } }, lab("lo", "Labo min", "decimal", "2,5"), lab("hi", "Labo max", "decimal", "8,4")),
                hx("label", { style: { display: "grid", gap: 3 } }, hx("span", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: C.textMut } }, "Date de la prise de sang"), hx("input", { type: "date", value: f.date, max: isoToday(), onChange: e => e.target.value && setF(x => ({ ...x, date: e.target.value })), style: { ...inputStyle, colorScheme: "light" } })),
                f.preset === 3 && hx("p", { style: { fontSize: 12.5, color: C.textMut, margin: 0 } }, "La CK monte pendant 24 à 72 h après une séance lourde : pour un chiffre utile, fais la prise de sang après 48 h sans séance lourde."),
                hx("div", { style: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 } }, hx("button", { onClick: () => setOpen(false), style: PM.out }, "Annuler"), hx("button", { onClick: add, style: PM.btn }, "Enregistrer"))));
}
/* Onglet Science → 🫀 Récup */
function RecupTab() {
    const D = useRecoveryData();
    const [edit, setEdit] = useState(false);
    const r = recoveryFor(isoToday(), D);
    return hx("div", null,
        hx("div", { style: { fontFamily: AN, fontSize: 40, lineHeight: .95, textTransform: "uppercase", margin: "2px 0 8px" } }, "Récupération"),
        r && !edit ? hx(Fragment, null,
            hx(RecupHead, { r, fg: C.ink, bg: C.sci, giant: { fontFamily: AN, fontSize: 104, lineHeight: .82 } }),
            hx("button", { onClick: () => setEdit(true), style: { ...PM.mini(false), marginBottom: 16 } }, "Modifier ma saisie du matin"))
            : hx("div", { style: { marginBottom: 18 } },
                hx("p", { style: { fontSize: 13.5, color: C.textMut, lineHeight: 1.45, margin: "0 0 10px" } }, "Saisie du matin : 20 secondes depuis ta montre Polar. Le score se calcule avec ces chiffres et ce que RECOMP enregistre déjà (charges, RPE, douleurs, repas, poids, natation)."),
                hx(RecupForm, { fg: C.ink, bg: "#fff", onDone: () => setEdit(false), onCancel: r ? () => setEdit(false) : null })),
        r && r.score != null && hx(RecupDetail, { r }),
        hx(RecupCharts, { D }),
        hx("details", { style: { marginTop: 16, fontSize: 13, color: C.textMut, lineHeight: 1.5 } },
            hx("summary", { style: { cursor: "pointer", fontWeight: 800, color: C.ink } }, "Comment le score est calculé"),
            hx("p", { style: { margin: "8px 0 0" } }, "Système nerveux 30 % (statut SNA + VFC comparée à ta zone normale : moyenne du logarithme de ta VFC sur 30 jours ± un demi écart-type), sommeil 20 % (8 h = 100), charge d'entraînement 15 % (séries × RPE, circuits et natation sur 7 jours face à ta moyenne sur 28 jours), fatigue musculaire 15 % (muscles de la séance prévue : baisse de force estimée, séance récente, douleurs), FC nocturne 10 % (écart avec ta moyenne sur 30 jours), énergie 10 % (apports face à ton plan, glycogène estimé, rythme de perte). Un facteur sans données est retiré et les autres comptent davantage. La disponibilité énergétique est jugée par rapport à ton plan de déficit, pas au seuil de 30 kcal/kg de masse maigre, qui te mettrait en alerte tous les jours. Sous 50, le coach ne propose aucune hausse de charge ce jour-là.")),
        hx(BilansPonctuels, null));
}
/* ═══ AJUSTEMENTS SCIENTIFIQUES ═══
 * Rythme de perte jugé en % du poids de corps (−0,5 à −1 %/sem), mesuré par régression sur
 * les dernières pesées ; le bouton « Appliquer » modifie VRAIMENT le déficit de l'onglet Calories.
 * La surcharge utilise le même moteur que le Coach et le pré-remplissage du log. */
const PACE_MIN = -1.0, PACE_MAX = -0.5, PACE_SLOW = -0.25, ADJUST_COOLDOWN = 10;
function ScienceSection({ initialTab } = {}) {
    const [sportLogs, setSportLogs] = useState([]);
    const [maisonLogs, setMaisonLogs] = useState([]);
    const [nutriLogs, setNutriLogs] = useState([]);
    const [calRaw, setCalRaw] = useState(null);
    const [cfg, setCfg] = useStored("science-config", SCI_DEFAULT);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [swLogsS] = useStored("natation-logs", []);
    const [swModelsS] = useStored("natation-modeles", []);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(initialTab || "recup");
    useEffect(() => { Promise.all([load("sport-logs", []), load("maison-logs", []), load("nutri-logs", []), load("nutri-cal-cfg", null)]).then(([s, m, n, c]) => { setSportLogs(s || []); setMaisonLogs(m || []); setNutriLogs(n || []); setCalRaw(c); setLoading(false); }); }, []);
    const overrides = cfg.weightOverrides || {};
    const repOv = cfg.repOverrides || {};
    /* Enregistre la charge ET la fourchette de reps : l'onglet Salle et le log les affichent */
    const setOverride = (key, v, range) => { const ov = { ...overrides }, ro = { ...repOv }; if (v == null) {
        delete ov[key];
        delete ro[key];
    }
    else {
        ov[key] = v;
        if (range)
            ro[key] = range;
        else
            delete ro[key];
    } setCfg({ ...cfg, weightOverrides: ov, repOverrides: ro }); };
    const ovLabel = k => overrides[k] + "kg" + (repOv[k] ? " × " + fmtRange(repOv[k]) : "");
    /* ── Surcharge : moteur de progression partagé ── */
    const recs = salleSeances.flatMap(seance => seance.exercices.map(ex => { const e = lastExerciseLog(sportLogs, seance.id, ex.nom); if (!e)
        return null; const p = progressFor(seance.id, e, recupMode(cfg), sportLogs); const key = seance.id + ":" + ex.nom; return { key, seance: seance.id, emoji: seance.emoji, exo: ex.nom, last: e, p, applied: overrides[key] === p.weight && (!p.range || fmtRange(repOv[key]) === fmtRange(p.range)) }; }).filter(Boolean));
    // Actions à appliquer : hausse de charge (fourchette abaissée) ou remontée de fourchette (même charge)
    const ups = recs.filter(r => r.p.action === "up" || r.p.action === "range");
    /* ── Rythme de perte ── */
    const weighIns = nutriLogs.filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    const curW = avgRecent(weighIns, 7);
    const span = weighIns.length >= 2 ? daysBetween(weighIns[0].dateISO, weighIns[weighIns.length - 1].dateISO) : 0;
    const rate = weighIns.length >= 3 && span >= 10 ? weeklyRate(weighIns) : null;
    const pct = rate != null && curW ? Math.round(rate / curW * 1000) / 10 : null;
    const band = curW ? [Math.round(curW * PACE_MIN / 100 * 10) / 10, Math.round(curW * PACE_MAX / 100 * 10) / 10] : null;
    const cal = normCalCfg(calRaw);
    const sinceAdjust = calRaw?.lastAdjust ? daysBetween(calRaw.lastAdjust, isoToday()) : null;
    const cooling = sinceAdjust != null && sinceAdjust < ADJUST_COOLDOWN;
    let pace = null;
    if (pct != null) {
        if (pct < PACE_MIN)
            pace = { tone: C.gluc, title: "Perte trop rapide (" + pct + " %/sem)", why: "Au-delà de 1 %/semaine, le risque de perdre du muscle et de la force augmente.", newDef: cal ? Math.max(0, cal.deficit - 150) : null };
        else if (pct > PACE_SLOW)
            pace = { tone: C.danger, title: pct > 0 ? "Prise de poids (+" + pct + " %/sem)" : "Perte trop lente (" + pct + " %/sem)", why: "Sous 0,25 %/semaine sur 10 jours et plus, le déficit réel est trop faible.", newDef: cal ? Math.min(1000, cal.deficit + 150) : null };
        else if (pct > PACE_MAX)
            pace = { tone: C.gluc, title: "Rythme un peu lent (" + pct + " %/sem)", why: "Acceptable en recomposition (la masse musculaire compense), surveille 1-2 semaines de plus.", newDef: null };
        else
            pace = { tone: C.green, title: "Rythme idéal (" + pct + " %/sem)", why: "Tu es dans la zone −0,5 à −1 %/sem : garde ce déficit.", newDef: null };
    }
    const applyDeficit = async (newDef) => { if (!calRaw)
        return; const ok = await askConfirm({ title: "Ajuster le déficit ?", message: "Déficit −" + cal.deficit + " → −" + newDef + " kcal/jour. Ta cible calorique, le menu Repas et le journal se recalculent. Prochain ajustement conseillé dans " + ADJUST_COOLDOWN + " jours, le temps que le poids se stabilise.", confirmLabel: "Appliquer" }); if (!ok)
        return; const nc = { ...calRaw, deficit: newDef, lastAdjust: isoToday() }; if (await save("nutri-cal-cfg", nc)) {
        setCalRaw(nc);
        toast("🔬 Déficit ajusté à −" + newDef + " kcal");
    } };
    /* ── Semaine ── */
    const prog = resolveProgramme(profile, sportLogs);
    const nDays = programmeDays(prog).length + swimDaysCount(swModelsS);
    const swim7 = swLogsS.filter(l => withinDays(l.dateISO, 7)).length;
    const train7 = new Set([...sportLogs, ...maisonLogs].filter(l => withinDays(l.dateISO, 7)).map(l => l.dateISO)).size + swim7;
    const wNutri = nutriLogs.filter(l => withinDays(l.dateISO, 7));
    const avgComp = wNutri.length ? Math.round(wNutri.reduce((a, l) => a + l.compliance, 0) / wNutri.length) : null;
    const autoRecup = !cfg.recovery && recupMode(cfg);
    const activeCount = Object.keys(overrides).length + (cfg.deload ? 1 : 0) + (cfg.recovery || autoRecup ? 1 : 0);
    if (loading)
        return React.createElement(Card, null, React.createElement("div", { style: { color: C.textMut, textAlign: "center", padding: 20 } }, "Chargement des données…"));
    const stat = (label, value, color, sub) => React.createElement(Card, null,
        React.createElement("div", { style: { fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: .5 } }, label),
        React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color, margin: "4px 0 1px" } }, value),
        React.createElement("div", { style: { fontSize: 10, color: C.textMut } }, sub));
    const toggleCard = (k, icon, title, desc, color) => React.createElement(Card, { key: k, border: cfg[k] ? color + "44" : C.borderSoft },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
            React.createElement("span", { style: { fontSize: 20 } }, icon),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700 } }, title),
                React.createElement("div", { style: { fontSize: 10, color: C.textMut, marginTop: 1, lineHeight: 1.4 } }, desc)),
            React.createElement("button", { onClick: () => { setCfg({ ...cfg, [k]: !cfg[k] }); toast(title + (cfg[k] ? " désactivé" : " activé")); }, style: { padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${cfg[k] ? color : C.borderSoft}`, background: cfg[k] ? color + "22" : "transparent", color: cfg[k] ? color : C.textMut, fontSize: 11, fontWeight: 700, cursor: "pointer" } }, cfg[k] ? "Actif" : "Inactif")));
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 12, overflowX: "auto" } }, [["recup", lx("🫀 Forme", "🫀 Récup")], ["bilan", "📊 Bilan"], ["surcharge", lx("🏋️ Charges à monter", "🏋️ Surcharge") + (ups.filter(r => !r.applied).length ? " · " + ups.filter(r => !r.applied).length : "")], ["config", "🔧 Config"]].filter(([k]) => tabOk("review", k)).map(([k, l]) => React.createElement(Pill, { key: k, active: tab === k, onClick: () => setTab(k), color: C.blue }, l))),
        tab === "recup" && React.createElement(RecupTab, null),
        tab === "bilan" && React.createElement("div", null,
            activeCount > 0 && React.createElement(Card, { border: C.blue + "44", style: { background: "#FFFFFF" } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.blueLight, marginBottom: 8 } }, "🔬 Ajustements actifs (" + activeCount + ")"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                    Object.entries(overrides).map(([k, v]) => React.createElement("span", { key: k, style: { fontSize: 10, background: C.blue + "15", border: `1px solid ${C.blue}33`, borderRadius: 8, padding: "3px 8px", color: C.blueLight } }, k.split(":")[1] + " → ", React.createElement("b", null, ovLabel(k)))),
                    cfg.deload && React.createElement("span", { style: { fontSize: 10, background: "#5B4FE015", border: "1px solid #5B4FE033", borderRadius: 8, padding: "3px 8px", color: "#5B4FE0" } }, "🪶 Décharge active"),
                    (cfg.recovery || autoRecup) && React.createElement("span", { style: { fontSize: 10, background: "#C98A0018", border: "1px solid #C98A0044", borderRadius: 8, padding: "3px 8px", color: "#8A6900" } }, autoRecup ? "🫀 Mode récup automatique (score " + RECUP_TODAY + "/100)" : "🛌 Mode récupération"))),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } },
                stat("Séances / 7j", React.createElement(Fragment, null, train7, React.createElement("span", { style: { fontSize: 12, color: C.textMut, fontWeight: 400 } }, "/" + nDays)), train7 >= nDays ? C.green : train7 >= Math.ceil(nDays / 2) ? C.gluc : C.danger, progInfo(prog).label + (swim7 || swimDaysCount(swModelsS) ? " + natation (" + swim7 + ")" : "") + " · " + (train7 >= nDays ? "✅ objectif atteint" : "objectif " + nDays)),
                stat("Compliance nutri", avgComp != null ? avgComp + "%" : "—", avgComp == null ? C.textMut : avgComp >= 85 ? C.green : avgComp >= 65 ? C.gluc : C.danger, avgComp == null ? "Pas de données" : avgComp >= 85 ? "✅ Excellente" : avgComp >= 65 ? "🟡 Correcte" : "🔴 Faible"),
                stat("Poids (moy. 7j)", curW ? curW + "kg" : "—", C.amberLight, weighIns.length ? "Départ : " + weighIns[0].kg + " kg" : "Pas de pesée"),
                stat("Tendance / sem", rate != null ? (rate > 0 ? "+" : "") + rate + " kg" : "—", pct == null ? C.textMut : pct >= PACE_MIN && pct <= PACE_MAX ? C.green : pct > PACE_SLOW ? C.danger : C.gluc, band ? "Cible : " + band[0] + " à " + band[1] + " kg/sem" : "En attente de pesées")),
            React.createElement(Card, { border: (pace ? pace.tone : C.border) + "55" },
                React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: pace ? pace.tone : C.textMut, marginBottom: 4 } }, "⚡ " + (pace ? pace.title : "Rythme de perte")),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, lineHeight: 1.5 } }, pace ? pace.why : "Il faut au moins 3 pesées sur 10 jours pour mesurer une tendance fiable (régression sur tes 8 dernières pesées)."),
                pace && pace.newDef != null && (cooling
                    ? React.createElement("div", { style: { fontSize: 10.5, color: C.textDim, marginTop: 8 } }, "⏳ Déficit ajusté il y a " + sinceAdjust + " j : attends encore " + (ADJUST_COOLDOWN - sinceAdjust) + " j que le poids se stabilise avant de réajuster.")
                    : React.createElement("button", { onClick: () => applyDeficit(pace.newDef), style: { width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, border: "none", background: pace.tone, color: "#0B0B0B", fontSize: 12.5, fontWeight: 800, cursor: "pointer" } }, "Appliquer : déficit −" + cal.deficit + " → −" + pace.newDef + " kcal")),
                !cal && React.createElement("div", { style: { fontSize: 10.5, color: C.textDim, marginTop: 8 } }, "💡 Configure Nutrition → 🔥 Calories pour que l'ajustement s'applique à ta cible.")),
            ups.filter(r => !r.applied).length > 0 && React.createElement(Card, { border: C.green + "44" },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.greenLight, marginBottom: 4 } }, "⬆️ " + ups.filter(r => !r.applied).length + " exercice(s) prêt(s) à progresser (charge ou fourchette)"),
                React.createElement("button", { onClick: () => setTab("surcharge"), style: { border: "none", background: "transparent", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 } }, "Voir dans l'onglet Surcharge →"))),
        tab === "surcharge" && React.createElement("div", null, recs.length === 0 ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 14, fontSize: 12 } }, "Enregistre des séances salle (charge + reps) pour obtenir des recommandations."))
            : React.createElement(Fragment, null,
                React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, marginBottom: 10, lineHeight: 1.5 } }, "💡 Cycle en 2 temps. ⬆️ Haut de la fourchette atteint à RPE ≤ 8 → la charge monte (+5 kg jambes, +2,5 kg ailleurs) et la fourchette descend de " + RANGE_DROP + " reps. ↕️ Haut de cette fourchette basse atteint → même charge, retour à la fourchette du programme. « Appliquer » écrit la charge et la fourchette dans l'onglet Salle et le log (✨ Pré-remplir)." + (cfg.recovery ? " Mode récupération actif : aucune hausse proposée." : autoRecup ? " Récupération du matin sous 50 : aucune hausse proposée aujourd'hui." : "")),
                ups.map(r => React.createElement(Card, { key: r.key, border: r.applied ? C.green + "44" : C.amber + "44" },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } },
                        React.createElement("div", null,
                            React.createElement("span", { style: { fontSize: 13, fontWeight: 800 } }, r.emoji + " " + r.seance),
                            React.createElement("span", { style: { fontSize: 11, color: C.textMut, marginLeft: 6 } }, r.exo),
                            React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: r.p.action === "up" ? C.green : C.blue, marginTop: 2 } }, r.p.action === "up" ? "⬆️ Hausse de charge · fourchette abaissée" : "↕️ Même charge · retour à la fourchette du programme")),
                        r.applied &&React.createElement("span", { style: { fontSize: 9, fontWeight: 700, color: C.green, background: C.green + "15", padding: "2px 7px", borderRadius: 99 } }, "✅ Appliqué")),
                    React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10 } },
                        React.createElement("div", { style: { textAlign: "center" } },
                            React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, "Dernière"),
                            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.textMut } }, r.last.weight, React.createElement("span", { style: { fontSize: 11 } }, "kg"))),
                        React.createElement("div", { style: { fontSize: 16, color: C.blue } }, "→"),
                        React.createElement("div", { style: { textAlign: "center" } },
                            React.createElement("div", { style: { fontSize: 10, color: C.blue } }, "Prochaine"),
                            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.blue } }, r.p.weight, React.createElement("span", { style: { fontSize: 11 } }, "kg × " + (r.p.range ? fmtRange(r.p.range) : r.p.reps))),
                            r.p.range && React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "commence à " + r.p.range.lo + ", monte à " + r.p.range.hi)),
                        React.createElement("div", { style: { flex: 1 } }),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim, textAlign: "right" } }, (r.last.setsDetail?.length ? fmtSets(r.last) : r.last.sets + "×" + r.last.reps), React.createElement("br"), r.last.rpe ? "RPE " + r.last.rpe : r.last.date)),
                    !r.applied ? React.createElement("button", { onClick: () => { setOverride(r.key, r.p.weight, r.p.range); toast("🔬 " + r.seance + " · " + r.exo + " → " + r.p.weight + " kg" + (r.p.range ? " × " + fmtRange(r.p.range) : "") + " (onglet Salle mis à jour)"); }, style: { width: "100%", padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer", background: C.blue, color: "#fff", fontSize: 12, fontWeight: 700 } }, "Appliquer " + r.p.weight + " kg" + (r.p.range ? " × " + fmtRange(r.p.range) + " reps" : ""))
                        : React.createElement("button", { onClick: () => setOverride(r.key, null), style: { width: "100%", padding: "9px 0", borderRadius: 10, border: `1px solid ${C.textDim}44`, background: "transparent", color: C.textDim, fontSize: 11, cursor: "pointer" } }, "Annuler l'ajustement"))),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, margin: "6px 0 8px" } }, "Les autres exercices"),
                recs.filter(r => r.p.action !== "up" && r.p.action !== "range").map(r => React.createElement("div", { key: r.key, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "8px 12px", marginBottom: 6 } },
                    React.createElement("span", { style: { fontSize: 11.5 } }, r.emoji + " " + r.exo),
                    React.createElement("span", { style: { fontSize: 10.5, color: r.p.action === "hold" ? C.gluc : C.textMut, fontWeight: 700, textAlign: "right" } }, r.p.txt))))),
        tab === "config" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 12 } }, "Protocoles partagés avec le log et l'onglet Salle."),
            toggleCard("deload", "🪶", "Semaine de décharge", "Charges −40 % dans le programme salle et le pré-remplissage du log. PR non comptés. À faire toutes les 4-6 semaines.", "#5B4FE0"),
            toggleCard("recovery", "🛌", "Mode récupération", "Fatigue accumulée : plus aucune hausse de charge proposée, repos ≥ 3 min mis en avant sur le minuteur.", "#C98A00"),
            Object.keys(overrides).length > 0 && React.createElement(Card, { border: C.blue + "33" },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
                    React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: C.blueLight } }, "Charges ajustées (" + Object.keys(overrides).length + ")"),
                    React.createElement("button", { onClick: async () => { if (await askConfirm({ title: "Retirer tous les ajustements ?", message: "Les cibles reviendront aux suggestions du coach et aux charges de phase.", confirmLabel: "Tout retirer", danger: true })) {
                            const prev = cfg;
                            setCfg({ ...cfg, weightOverrides: {}, repOverrides: {} });
                            toast("Ajustements retirés", { undo: () => setCfg(prev) });
                        } }, style: { border: "none", background: "transparent", color: C.danger, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, "Tout retirer")),
                Object.entries(overrides).map(([k, v]) => React.createElement("div", { key: k, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("span", { style: { fontSize: 11 } }, k.replace(":", " · ")),
                    React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                        React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: C.blue } }, ovLabel(k)),
                        React.createElement("button", { onClick: () => setOverride(k, null), style: { padding: "2px 7px", borderRadius: 6, border: `1px solid ${C.danger}44`, background: "transparent", color: C.danger, fontSize: 10, cursor: "pointer" } }, "✕")))))));
}
/* ═══ HOME SCREEN ═══ */
/* ═══ HELPERS LOT 5 (habitudes & technique) ═══ */
function streakFromDates(isoDates) { const set = new Set(isoDates); if (!set.size)
    return { current: 0, best: 0 }; const sorted = [...set].sort(); const D = s => new Date(s + "T12:00:00"); let best = 1, run = 1; for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((D(sorted[i]) - D(sorted[i - 1])) / 86400000);
    run = diff === 1 ? run + 1 : 1;
    if (run > best)
        best = run;
} const today = new Date(); today.setHours(12, 0, 0, 0); let cursor = new Date(today); if (!set.has(_isoD(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(_isoD(cursor)))
        return { current: 0, best };
} let cur = 0; while (set.has(_isoD(cursor))) {
    cur++;
    cursor.setDate(cursor.getDate() - 1);
} return { current: cur, best }; }
function weeklyRate(weighIns) { const pts = weighIns.slice(-8); if (pts.length < 2)
    return null; const t0 = new Date(pts[0].dateISO + "T12:00:00").getTime(); const xs = pts.map(p => (new Date(p.dateISO + "T12:00:00").getTime() - t0) / 86400000); const ys = pts.map(p => p.kg); const n = xs.length, sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0), sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * ys[i], 0); const denom = n * sxx - sx * sx; if (denom === 0)
    return null; return Math.round((n * sxy - sx * sy) / denom * 7 * 100) / 100; }
function projectETA(current, ratePerWeek, target) { if (ratePerWeek == null || ratePerWeek === 0)
    return null; const weeks = (target - current) / ratePerWeek; if (weeks < 0)
    return { reachable: false }; const eta = new Date(); eta.setDate(eta.getDate() + Math.round(weeks * 7)); return { reachable: true, weeks: Math.round(weeks * 10) / 10, eta: _isoD(eta) }; }
function fmtDateFR(iso) { try {
    return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
catch (e) {
    return iso;
} }
const _ip = n => String(n).padStart(2, "0");
function icsLocal(d) { return d.getFullYear() + _ip(d.getMonth() + 1) + _ip(d.getDate()) + "T" + _ip(d.getHours()) + _ip(d.getMinutes()) + "00"; }
const STORAGE_KEYS = ["sport-logs", "sport-phase", "nutri-logs", "budget-logs", "mensurations", "photos-index", "douleur-logs", "science-config", "maison-logs", "fin-income", "fin-expenses", "fin-caps", "fin-goal", "taille-corps", "nutri-cal-cfg", "repas-alts", "food-log", "foods-custom", "profil", "programmes", "exos-perso", "natation-modeles", "natation-logs", "recup-logs", "bilans"];
/* Sur iPhone (app installée), un lien de téléchargement est souvent ignoré :
   on passe par la feuille de partage (Enregistrer dans Fichiers, AirDrop, mail…),
   et on retombe sur le téléchargement classique ailleurs. */
async function shareOrDownload(filename, text, mime) {
    const type = mime || "text/plain";
    try {
        const file = new File([text], filename, { type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            return "shared";
        }
    }
    catch (e) {
        if (e && e.name === "AbortError")
            return "cancelled";
    }
    try {
        const url = URL.createObjectURL(new Blob([text], { type }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return "downloaded";
    }
    catch (e) {
        console.error(e);
        return "error";
    }
}
/* Sauvegarde complète (photos comprises) + mémorise la date pour le rappel de l'accueil */
async function exportAll() {
    let keys = [];
    try {
        keys = (await window.storage.list()).keys || [];
    }
    catch (e) { }
    if (!keys.length)
        keys = STORAGE_KEYS;
    const data = {};
    for (const k of keys) {
        if (k === "last-export")
            continue;
        try {
            const r = await window.storage.get(k);
            if (r && r.value != null)
                data[k] = r.value;
        }
        catch (e) { }
    }
    const out = JSON.stringify({ app: "RECOMP", version: 3, exportedAt: new Date().toISOString(), data }, null, 2);
    const res = await shareOrDownload("recomp-sauvegarde-" + isoToday() + ".json", out, "application/json");
    if (res === "shared" || res === "downloaded") {
        await save("last-export", isoToday());
    }
    return { res, count: Object.keys(data).length };
}
/* ═══ PROJECTION ═══ */
function ProjectionCard({ weighIns }) {
    const [target, setTarget] = useState("");
    const current = weighIns.length ? weighIns[weighIns.length - 1].kg : null;
    const rate = weeklyRate(weighIns);
    const tg = parseFloat(target);
    const eta = (current != null && rate != null && !isNaN(tg)) ? projectETA(current, rate, tg) : null;
    return React.createElement(Card, { border: C.blue + "33" },
        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 8 } }, "🔮 Projection « et si »"),
        weighIns.length < 2 ? React.createElement("div", { style: { fontSize: 11, color: C.textDim } }, "Enregistre au moins 2 pesées (Nutrition → Suivi) pour estimer ta tendance.") : React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 10 } },
                "Tendance : ",
                React.createElement("b", { style: { color: rate < 0 ? C.green : rate > 0 ? C.gluc : C.textMut } },
                    rate > 0 ? "+" : "",
                    rate,
                    " kg/sem"),
                " · poids actuel ",
                current,
                " kg"),
            React.createElement("div", { style: { marginBottom: 10 } },
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 3 } }, "Poids cible (kg)"),
                React.createElement("input", { type: "number", step: "0.5", inputMode: "decimal", value: target, onChange: e => setTarget(e.target.value), style: inputStyle, placeholder: "123" })),
            eta && (eta.reachable ? React.createElement("div", { style: { fontSize: 12, color: C.text, background: C.blue + "12", border: `1px solid ${C.blue}33`, borderRadius: 10, padding: "10px 12px" } },
                "À ce rythme : ",
                React.createElement("b", { style: { color: C.blueLight } },
                    tg,
                    " kg"),
                " vers le ",
                React.createElement("b", { style: { color: C.blueLight } }, fmtDateFR(eta.eta)),
                " ",
                React.createElement("span", { style: { color: C.textMut } },
                    "(~",
                    eta.weeks,
                    " sem.)")) : React.createElement("div", { style: { fontSize: 11, color: C.gluc, background: C.gluc + "12", borderRadius: 10, padding: "10px 12px" } }, "Ta tendance ne va pas vers cette cible — ajuste le déficit ou le surplus.")),
            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 8, fontStyle: "italic" } }, "Estimation linéaire sur tes dernières pesées : un cap, pas une promesse.")));
}
/* ═══ SAUVEGARDE DONNÉES ═══ */
function DataCard() {
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [last] = useStored("last-export", null);
    const [usage, setUsage] = useState(null);
    useEffect(() => { try {
        navigator.storage?.estimate?.().then(e => setUsage(e));
    }
    catch (e) { } }, [msg]);
    const doExport = async () => { setBusy(true); setMsg(""); try {
        const r = await exportAll();
        setMsg(r.res === "cancelled" ? "Export annulé." : r.res === "error" ? "❌ Échec de l'export." : "✅ Sauvegarde créée (" + r.count + " éléments). Range-la dans Fichiers / iCloud.");
    }
    catch (e) {
        setMsg("❌ Échec de l'export.");
    } setBusy(false); };
    const doImport = async (file) => { if (!file)
        return; setBusy(true); setMsg(""); try {
        const parsed = JSON.parse(await file.text());
        const data = parsed && (parsed.data || parsed);
        const keys = data && typeof data === "object" ? Object.keys(data) : [];
        if (!keys.length || (parsed.app && parsed.app !== "RECOMP"))
            throw new Error("format");
        const when = parsed.exportedAt ? " du " + fmtDateFR(_isoD(new Date(parsed.exportedAt))) : "";
        const ok = await askConfirm({ title: "Restaurer la sauvegarde" + when + " ?", message: keys.length + " éléments vont remplacer les données actuelles de cet appareil. Les éléments absents de la sauvegarde ne sont pas touchés.", confirmLabel: "Restaurer" });
        if (!ok) {
            setBusy(false);
            return;
        }
        let n = 0;
        for (const k of keys) {
            try {
                await window.storage.set(k, typeof data[k] === "string" ? data[k] : JSON.stringify(data[k]));
                n++;
            }
            catch (e) { }
        }
        setMsg("✅ " + n + " éléments restaurés. Redémarrage…");
        setTimeout(() => location.reload(), 900);
    }
    catch (e) {
        setMsg("❌ Fichier invalide : choisis un fichier recomp-sauvegarde-….json.");
    } setBusy(false); };
    const age = last ? daysBetween(last, isoToday()) : null;
    const mb = v => (v / 1048576).toFixed(1).replace(".", ",") + " Mo";
    return React.createElement(Card, { border: age == null || age > 7 ? C.amber + "55" : C.border },
        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, marginBottom: 4 } }, "💾 Sauvegarde des données"),
        React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, marginBottom: 10, lineHeight: 1.5 } },
            "Tes données vivent uniquement sur cet appareil. ",
            React.createElement("b", { style: { color: age == null || age > 7 ? C.amberLight : C.greenLight } }, age == null ? "Aucune sauvegarde pour l'instant." : age === 0 ? "Dernière sauvegarde : aujourd'hui." : "Dernière sauvegarde : il y a " + age + " jour" + (age > 1 ? "s" : "") + "."),
            usage && usage.usage ? " Stockage utilisé : " + mb(usage.usage) + "." : ""),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("button", { onClick: doExport, disabled: busy, style: { flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.amber}55`, background: C.amber + "15", color: C.amber, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: busy ? .6 : 1 } }, "⬇️ Exporter"),
            React.createElement("label", { style: { flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center" } },
                "⬆️ Importer",
                React.createElement("input", { type: "file", accept: "application/json,.json", style: { display: "none" }, onChange: e => { doImport(e.target.files && e.target.files[0]); e.target.value = ""; } }))),
        msg && React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, marginTop: 8 } }, msg));
}
/* Bandeau en haut de l'accueil quand la dernière sauvegarde date de plus de 7 jours */
function BackupReminder({ hasData }) {
    const [last, , ready] = useStored("last-export", null);
    const [busy, setBusy] = useState(false);
    const [hidden, setHidden] = useState(false);
    if (!ready || !hasData || hidden)
        return null;
    const age = last ? daysBetween(last, isoToday()) : null;
    if (age != null && age <= 7)
        return null;
    return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, background: C.sci, border: `2px solid ${C.ink}`, borderRadius: 4, padding: "10px 12px", marginTop: 14 } },
        React.createElement("div", { style: { flex: 1, fontSize: 12.5, color: C.ink, lineHeight: 1.35 } },
            React.createElement("b", { style: { fontWeight: 800 } }, "💾 " + (age == null ? "Aucune sauvegarde" : "Dernière sauvegarde il y a " + age + " j")),
            React.createElement("br"),
            "Tes données ne sont que sur ce téléphone."),
        React.createElement("button", { disabled: busy, onClick: async () => { setBusy(true); const r = await exportAll(); setBusy(false); if (r.res === "shared" || r.res === "downloaded")
                toast("✅ Sauvegarde créée"); }, style: { padding: "9px 12px", borderRadius: 3, border: "none", background: C.ink, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", opacity: busy ? .6 : 1 } }, "Exporter"),
        React.createElement("button", { onClick: () => setHidden(true), "aria-label": "Masquer", style: { border: "none", background: "transparent", color: C.ink, fontSize: 15, fontWeight: 800, cursor: "pointer", padding: 2 } }, "✕"));
}
/* Compteur mécanique : chaque chiffre défile jusqu'à sa valeur (arrivée sur l'accueil) */
function Odometer({ value }) {
    const [go, setGo] = useState(false);
    useEffect(() => { setGo(false); const t = setTimeout(() => setGo(true), 80); return () => clearTimeout(t); }, [value]);
    let n = 0;
    return React.createElement("div", { className: "odo", "aria-label": value }, [...value].map((ch, i) => /\d/.test(ch)
        ? React.createElement("span", { key: i, className: "odo-col", style: { transform: go ? `translateY(-${+ch * 0.9}em)` : "none", transitionDelay: 250 + (n++) * 110 + "ms" } }, Array.from({ length: 10 }, (_, d) => React.createElement("span", { key: d }, d)))
        : React.createElement("span", { key: i, className: "odo-sep" }, ch)));
}
/* ═══ PROFIL — programme, créneau de séance, réveil ═══ */
function ProfileCard({ prog, defaultOpen }) {
    const [profile, setProfile] = useStored("profil", PROFILE_DEFAULT);
    const [progs] = useStored("programmes", []);
    const [open, setOpen] = useState(!!defaultOpen);
    const pr = normProfile(profile);
    const upd = patch => setProfile({ ...pr, ...patch });
    const chip = (active, onClick, label) => React.createElement("button", { onClick, style: { flex: 1, padding: "8px 4px", borderRadius: 9, border: `2px solid ${active ? C.amber : "transparent"}`, background: active ? C.amber + "22" : C.surfaceAlt, color: active ? C.amber : C.textMut, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, label);
    const hhmm = h => { const n = hToMin(h); return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0"); };
    return React.createElement(Card, null,
        React.createElement("button", { onClick: () => setOpen(o => !o), style: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", color: C.text } },
            React.createElement("span", { style: { fontSize: 13, fontWeight: 800 } }, "⚙️ Mon profil"),
            React.createElement("span", { style: { fontSize: 10.5, color: C.textMut } }, progInfo(prog).label + (pr.programme === "auto" ? " (auto)" : "") + " · séance " + CRENEAUX[pr.creneau].seance + " · réveil " + pr.reveil + "  " + (open ? "▲" : "▼"))),
        open && React.createElement("div", { style: { marginTop: 12 } },
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 4 } }, "Programme suivi"),
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 4 } }, chip(pr.programme === "auto", () => upd({ programme: "auto" }), "🤖 Auto"), chip(pr.programme === "maison", () => upd({ programme: "maison" }), "🏠 Maison"), chip(pr.programme === "salle", () => upd({ programme: "salle" }), "🏋️ Salle")),
            progs.filter(p => customToSeances(p).length).length > 0 && React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" } }, progs.filter(p => customToSeances(p).length).map(p => React.createElement(Fragment, { key: p.id }, chip(pr.programme === p.id, () => upd({ programme: p.id }), "📋 " + p.name)))),
            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginBottom: 12 } }, "Auto = salle dès que tu enregistres des séances salle (21 derniers jours), sinon maison. Maison : lun/mer/ven/sam · Salle : lun/mar/mer/ven/sam. Tes programmes perso se créent dans Sport → 📋 Programmes."),
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 4 } }, "Créneau de séance"),
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 4 } }, Object.entries(CRENEAUX).map(([k, c]) => React.createElement(Fragment, { key: k }, chip(pr.creneau === k, () => upd({ creneau: k }), c.label + " · " + c.seance)))),
            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginBottom: 12 } }, "Les horaires des repas des jours d'entraînement (pré-séance, shaker…) suivent ce créneau partout dans l'app."),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                React.createElement("div", { style: { flex: 1, fontSize: 12, fontWeight: 600 } }, "⏰ Réveil"),
                React.createElement("input", { type: "time", value: hhmm(pr.reveil), onChange: e => { if (e.target.value)
                        upd({ reveil: minToH(hToMin(e.target.value)) }); }, style: { ...inputStyle, width: 110, colorScheme: "light" } }))));
}
/* ═══ « AUJOURD'HUI » EN TÊTE D'AFFICHE ═══
 * Ce qu'on coche ici écrit dans les MÊMES données que les onglets Suivi (sport-logs, maison-logs,
 * nutri-logs) : une série cochée apparaît dans le log de séance, un repas barré dans la checklist,
 * et inversement. */
const kgFr = v => (Math.round(v * 10) / 10).toLocaleString("fr-FR");
const TD = {
    wrap: { padding: "2px 18px 26px" },
    giant: { fontFamily: AN, fontSize: "clamp(96px, 31vw, 136px)", lineHeight: .84, margin: "4px -3px 10px", letterSpacing: "-.01em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" },
    lead: { fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, margin: "0 0 14px", maxWidth: "32ch" },
    rule: c => ({ borderTop: `2px solid ${c}` }),
    chip: c => ({ border: `2px solid ${c}`, background: "transparent", color: "inherit", borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer" }),
};
/* Minuteur de repos plein écran : l'affiche devient un sablier de couleur */
function PosterRest({ color }) {
    const [t, setT] = useState(null);
    const [now, setNow] = useState(Date.now());
    const ac = useRef(null);
    useEffect(() => bus.on("rest:start", ({ sec, label }) => { try {
        if (!ac.current && (window.AudioContext || window.webkitAudioContext))
            ac.current = new (window.AudioContext || window.webkitAudioContext)();
        ac.current?.resume?.();
    }
    catch (e) { } setNow(Date.now()); setT({ endAt: Date.now() + sec * 1000, total: sec, label }); }), []);
    useEffect(() => bus.on("rest:stop", () => setT(null)), []);
    useEffect(() => { if (!t)
        return; const id = setInterval(() => setNow(Date.now()), 250); const vis = () => setNow(Date.now()); document.addEventListener("visibilitychange", vis); return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); }; }, [t]);
    const left = t ? Math.max(0, Math.ceil((t.endAt - now) / 1000)) : 0;
    useEffect(() => { if (!t || left > 0)
        return; // fin du repos : une sonnerie (si le minuteur du log n'est pas déjà affiché), puis on referme
        if (!window.__restTimers && Date.now() - t.endAt < 4000) {
            try {
                const A = ac.current;
                if (A)
                    [0, .35].forEach(d => { const o = A.createOscillator(), g = A.createGain(); o.connect(g); g.connect(A.destination); o.frequency.value = 880; g.gain.setValueAtTime(.001, A.currentTime + d); g.gain.exponentialRampToValueAtTime(.3, A.currentTime + d + .02); g.gain.exponentialRampToValueAtTime(.001, A.currentTime + d + .3); o.start(A.currentTime + d); o.stop(A.currentTime + d + .3); });
            }
            catch (e) { }
            try {
                navigator.vibrate?.([220, 90, 220]);
            }
            catch (e) { }
        } const id = setTimeout(() => setT(null), 900); return () => clearTimeout(id); }, [left, t]);
    if (!t)
        return null;
    const frac = t.total ? Math.max(0, (t.endAt - now) / (t.total * 1000)) : 0;
    return React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 90, background: C.ink, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 20px calc(44px + env(safe-area-inset-bottom, 0px))", overflow: "hidden", animation: "rcFade .2s ease-out" } },
        React.createElement("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: frac * 100 + "%", background: color, transition: "height .25s linear" } }),
        React.createElement("button", { onClick: () => { setT(null); bus.emit("rest:stop"); }, style: { position: "absolute", top: "calc(18px + env(safe-area-inset-top, 0px))", right: 18, border: "2px solid #fff", background: "none", color: "#fff", borderRadius: 30, padding: "9px 14px", fontWeight: 800, fontSize: 13, mixBlendMode: "difference", cursor: "pointer" } }, "Reprendre"),
        React.createElement("div", { style: { position: "relative", mixBlendMode: "difference", fontSize: 15, fontWeight: 700, marginBottom: 10 } }, left > 0 ? "Repos · " + t.label : "Repos terminé — au boulot"),
        React.createElement("div", { style: { position: "relative", mixBlendMode: "difference", fontFamily: AN, fontSize: "clamp(120px, 42vw, 170px)", lineHeight: .84, fontVariantNumeric: "tabular-nums" } }, fmtMMSS(left)),
        React.createElement("div", { style: { position: "relative", display: "flex", gap: 8, marginTop: 16, mixBlendMode: "difference" } }, [["+15 s", 15], ["+30 s", 30]].map(([l, s]) => React.createElement("button", { key: l, onClick: () => setT(x => ({ ...x, endAt: Math.max(x.endAt, Date.now()) + s * 1000, total: x.total + s })), style: { border: "2px solid #fff", background: "none", color: "#fff", borderRadius: 30, padding: "8px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" } }, l))));
}
/* Ligne d'exercice : nom, cible, et un rond numéroté par série (toucher = série faite / défaite) */
function SetCircles({ count, done, onTick, fg, bg }) {
    return React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" } }, Array.from({ length: count }, (_, j) => React.createElement("button", { key: j, "aria-label": "Série " + (j + 1) + (j < done ? " faite" : ""), onClick: () => onTick(j < done ? j : j + 1), style: { width: 52, height: 52, borderRadius: "50%", border: `2.5px solid ${fg}`, background: j < done ? fg : "transparent", color: j < done ? bg : fg, fontFamily: AN, fontSize: 24, cursor: "pointer", transition: "background .2s, color .2s, transform .15s" } }, j + 1)));
}
function TodaySport({ fg, bg, goTab }) {
    const [sLogs, setSLogs] = useStored("sport-logs", []);
    const [mLogs, setMLogs] = useStored("maison-logs", []);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [sci] = useStored("science-config", SCI_DEFAULT);
    const [phase] = useStored("sport-phase", 0);
    const [pick, setPick] = useState(null);
    const [showPick, setShowPick] = useState(false);
    const today = isoToday();
    const prog = resolveProgramme(profile, sLogs);
    const planned = sessionForDate(today, prog);
    const startedS = sLogs.find(l => l.dateISO === today), startedM = mLogs.find(l => l.dateISO === today);
    // Séance affichée : choisie à la main > déjà commencée aujourd'hui > prévue au programme
    const cur = pick || (startedS ? { prog: "salle", code: startedS.seance } : startedM ? { prog: "maison", code: startedM.seance } : planned ? { prog: planned.prog, code: planned.code } : null);
    const before = sLogs.filter(l => l.dateISO < today);
    const rule = TD.rule(fg);
    // Natation du jour (prévue dans une séance type, ou déjà enregistrée)
    const [swModels] = useStored("natation-modeles", []);
    const [swLogs] = useStored("natation-logs", []);
    const swPlan = swimPlannedFor(swModels, today), swDone = swLogs.filter(l => l.dateISO === today);
    const swimStrip = (swPlan || swDone.length > 0) && React.createElement("button", { onClick: () => goTab("natation"), style: { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: `2.5px solid ${fg}`, background: swDone.length ? fg : "transparent", color: swDone.length ? bg : fg, borderRadius: 4, padding: "10px 12px", margin: "0 0 14px", cursor: "pointer" } },
        React.createElement("span", { style: { fontSize: 22 } }, "🏊"),
        React.createElement("span", { style: { flex: 1, fontSize: 15, fontWeight: 750, lineHeight: 1.25 } }, swDone.length ? "Natation faite : " + swDone.map(l => l.distance.toLocaleString("fr-FR") + " m en " + fmtDur(l.duree)).join(" + ") : "Natation aujourd'hui : " + swPlan.name + " · " + swimDist(swPlan).toLocaleString("fr-FR") + " m"),
        React.createElement("b", { style: { fontSize: 13, whiteSpace: "nowrap" } }, swDone.length ? "Voir →" : "Le détail →"));
    // Récupération du matin : rappel du conseil au moment de lancer la séance
    const recupStrip = RECUP_RES && RECUP_RES.score != null && React.createElement("div", { style: { border: `2.5px solid ${fg}`, borderRadius: 4, padding: "9px 12px", margin: "0 0 14px", fontSize: 14, fontWeight: 600, lineHeight: 1.35 } },
        React.createElement("b", { style: { fontWeight: 800 } }, "🫀 Récupération " + RECUP_RES.score + "/100 · " + RECUP_RES.verdict.short + ". "), RECUP_RES.advice);
    const pickers = React.createElement("div", { style: { margin: "4px 0 14px" } },
        React.createElement("button", { onClick: () => setShowPick(v => !v), style: { ...TD.chip(fg) } }, showPick ? "Fermer" : (cur ? "Changer de séance" : "Faire une séance quand même")),
        showPick && React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 } },
            salleSeances.map(s => React.createElement("button", { key: s.id, onClick: () => { setPick({ prog: "salle", code: s.id }); setShowPick(false); }, style: { ...TD.chip(fg), background: cur?.code === s.id ? fg : "transparent", color: cur?.code === s.id ? bg : fg } }, seanceLabel(s.id))),
            maison.map(s => React.createElement("button", { key: s.code, onClick: () => { setPick({ prog: "maison", code: s.code }); setShowPick(false); }, style: { ...TD.chip(fg), background: cur?.code === s.code ? fg : "transparent", color: cur?.code === s.code ? bg : fg } }, "Maison " + s.code))));
    if (!cur) {
        let next = null;
        for (let d = 1; d < 8 && !next; d++) {
            const s = sessionForDate(shiftISO(today, d), prog);
            if (s)
                next = { s, d };
        }
        // Jour sans muscu mais avec natation : l'affiche devient celle de la piscine (lecture seule, rien à cocher)
        if (swPlan || swDone.length)
            return React.createElement("div", { style: TD.wrap },
                React.createElement("div", { style: TD.giant }, "Nage"),
                React.createElement("p", { style: TD.lead }, swDone.length ? "Séance enregistrée : " + swDone.map(l => l.distance.toLocaleString("fr-FR") + " m en " + fmtDur(l.duree) + " (" + fmtMMSS(Math.round(swimPace(l.distance, l.duree) || 0)) + " /100 m)").join(" + ") + ". +" + swimKcalOn(swLogs, today) + " kcal ajoutées à ta cible du jour." : swPlan.name + " : " + swimDist(swPlan).toLocaleString("fr-FR") + " m, ~" + Math.round(swimDur(swPlan) / 60) + " min, bassin " + swPlan.pool + " m. Lis-la avant d'y aller, enregistre-la en sortant."),
                swimStrip,
                swPlan && !swDone.length && React.createElement("div", { style: { ...rule, marginBottom: 14 } }, swPlan.blocks.map((b, i) => React.createElement("div", { key: i, style: { padding: "10px 0", borderBottom: `2px solid ${fg}` } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" } }, React.createElement("b", { style: { fontSize: 19, fontWeight: 750 } }, b.t), React.createElement("em", { style: { fontStyle: "normal", fontFamily: AN, fontSize: 21 } }, (b.reps * b.d).toLocaleString("fr-FR") + " m")),
                    React.createElement("div", { style: { fontSize: 13.5, fontWeight: 600, marginTop: 2 } }, swimBlockLine(b))))),
                pickers);
        return React.createElement("div", { style: TD.wrap },
            React.createElement("div", { style: TD.giant }, "Repos"),
            React.createElement("p", { style: TD.lead }, "Pas de séance prévue aujourd'hui. Récupère, marche, étire-toi." + (next ? " Prochaine : " + next.s.label + (next.d === 1 ? " demain." : " dans " + next.d + " jours.") : "")),
            pickers,
            React.createElement("div", { style: rule }, etirements.slice(0, 5).map(e => React.createElement("div", { key: e, style: { padding: "9px 0", borderBottom: `2px solid ${fg}`, fontSize: 16, fontWeight: 700 } }, e))));
    }
    if (cur.prog === "maison") {
        const m = maison.find(x => x.code === cur.code), tours = parseInt(m.format) || 3, log = mLogs.find(l => l.dateISO === today && l.seance === cur.code);
        const doneOf = nom => log?.exercices?.find(e => e.nom === nom)?.tours || 0;
        const tick = (i, n) => {
            const [nom, cible] = m.ex[i].split("—").map(s => s.trim());
            const exs = m.ex.map(x => { const nm = x.split("—")[0].trim(); return log?.exercices?.find(e => e.nom === nm) || { nom: nm, reps: parseInt(x.split("—")[1]) || 0, tours: 0 }; });
            exs[i] = { ...exs[i], tours: n, reps: exs[i].reps || parseInt(cible) || 0 };
            const entry = { ...(log || { id: Date.now(), date: fmtDateShort(today), dateISO: today, seance: cur.code }), exercices: exs };
            const rest = mLogs.filter(l => !(l.dateISO === today && l.seance === cur.code));
            setMLogs(exs.some(e => e.tours > 0) ? [...rest, entry] : rest);
        };
        return React.createElement("div", { style: TD.wrap },
            React.createElement("div", { style: TD.giant }, "Maison " + m.code),
            React.createElement("p", { style: TD.lead }, m.titre + ". " + m.format + ". Touche un numéro quand le tour est fait."),
            recupStrip,
            swimStrip,
            pickers,
            React.createElement("div", { style: rule }, m.ex.map((x, i) => { const [nom, cible] = x.split("—").map(s => s.trim()); return React.createElement("div", { key: i, style: { padding: "12px 0 14px", borderBottom: `2px solid ${fg}` } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" } },
                    React.createElement("b", { style: { fontSize: 21, lineHeight: 1.1, fontWeight: 750 } }, nom),
                    React.createElement("small", { style: { fontSize: 12, fontWeight: 700, opacity: .8, whiteSpace: "nowrap" } }, cible)),
                React.createElement(SetCircles, { count: tours, done: doneOf(nom), onTick: n => tick(i, n), fg, bg })); })),
            m.note && React.createElement("p", { style: { ...TD.lead, fontSize: 13, marginTop: 12 } }, m.note));
    }
    const se = seanceById(cur.code) || salleSeances[0], log = sLogs.find(l => l.dateISO === today && l.seance === cur.code);
    const sugg = se.exercices.map(ex => suggestFor(before, cur.code, ex, +phase || 0, sci));
    const rng = ex => currentRangeFor(before, sci, cur.code, ex.nom)?.range || progRangeFor(cur.code, ex.nom);
    const doneOf = ex => { const e = log?.exercices?.find(x => x.nom === ex.nom); return e ? (e.setsDetail?.length || e.sets || 0) : 0; };
    const tick = (i, n) => {
        const ex = se.exercices[i], s = sugg[i];
        const blank = x => ({ nom: x.nom, weight: 0, reps: 0, sets: 0, restSets: 0, restExo: 0, rpe: 0 });
        const exs = se.exercices.map(x => log?.exercices?.find(e => e.nom === x.nom) || blank(x));
        const e = exs[i];
        let det = e.setsDetail?.length ? [...e.setsDetail] : Array.from({ length: e.sets || 0 }, () => ({ w: e.weight || s.weight || 0, r: e.reps || s.reps || 0 }));
        if (n < det.length)
            det = det.slice(0, n);
        else
            while (det.length < n)
                det.push({ w: s.weight || 0, r: s.reps || 0 });
        const full = det.filter(x => x.w > 0 && x.r > 0);
        if (full.length === det.length && full.length) {
            const top = Math.max(...full.map(x => x.w));
            exs[i] = { ...e, setsDetail: full, sets: full.length, weight: top, reps: Math.min(...full.filter(x => x.w === top).map(x => x.r)) };
        }
        else {
            const { setsDetail, ...plain } = e;
            exs[i] = { ...plain, sets: n, weight: n ? (e.weight || s.weight || 0) : 0, reps: n ? (e.reps || s.reps || 0) : 0 };
        }
        const entry = { ...(log || { id: Date.now(), date: fmtDateShort(today), dateISO: today, seance: cur.code, deload: !!sci.deload }), exercices: exs };
        const rest = sLogs.filter(l => !(l.dateISO === today && l.seance === cur.code));
        setSLogs(exs.some(x => x.sets > 0) ? [...rest, entry] : rest);
        if (n > doneOf(ex))
            bus.emit("rest:start", { sec: parseRestSec(reposFor(cur.code, ex.nom)), label: ex.nom + ", série " + n + "/" + (parseDetail(ex.detail)?.sets || n) });
    };
    const total = se.exercices.reduce((a, ex) => a + (parseDetail(ex.detail)?.sets || 3), 0), doneAll = se.exercices.reduce((a, ex) => a + Math.min(doneOf(ex), parseDetail(ex.detail)?.sets || 3), 0);
    return React.createElement("div", { style: TD.wrap },
        React.createElement("div", { style: seanceLabel(se.id).length > 7 ? { ...TD.giant, fontSize: "clamp(64px, 19vw, 92px)", whiteSpace: "normal" } : TD.giant }, seanceLabel(se.id)),
        React.createElement("p", { style: TD.lead }, se.focus + ". " + (se.custom ? "Programme « " + progInfo(ACTIVE_GYM).label + " »" : (phases[+phase || 0]?.ph || "") + " (" + (phases[+phase || 0]?.sem || "") + ")") + ". Touche un numéro de série quand elle est faite." + (sci.deload ? " Semaine de décharge : charges −40 %." : "")),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 } },
            React.createElement("div", { style: { flex: 1, height: 14, border: `2.5px solid ${fg}`, position: "relative" } }, React.createElement("i", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: (total ? doneAll / total * 100 : 0) + "%", background: fg, transition: "width .5s cubic-bezier(.7,0,.2,1)" } })),
            React.createElement("b", { style: { fontFamily: AN, fontSize: 22, fontWeight: 400 } }, doneAll + "/" + total)),
        recupStrip,
        swimStrip,
        pickers,
        React.createElement("div", { style: rule }, se.exercices.map((ex, i) => { const s = sugg[i], r = s.src === "phase" ? progRangeFor(cur.code, ex.nom) : rng(ex), sets = parseDetail(ex.detail)?.sets || 3; return React.createElement("div", { key: ex.nom, style: { padding: "12px 0 14px", borderBottom: `2px solid ${fg}` } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" } },
                React.createElement("b", { style: { fontSize: 21, lineHeight: 1.1, fontWeight: 750 } }, ex.nom),
                React.createElement("small", { style: { fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" } }, (s.weight ? kgFr(s.weight) + " kg × " : "") + (r ? fmtRange(r) : ex.detail))),
            React.createElement(SetCircles, { count: Math.max(sets, doneOf(ex)), done: doneOf(ex), onTick: n => tick(i, n), fg, bg })); })),
        tabOk("sport", "suivi") && React.createElement("button", { onClick: () => goTab("suivi"), style: { ...TD.chip(fg), marginTop: 14 } }, lx("Charges, reps et difficulté détaillées → Suivi", "Charges, reps et RPE détaillés → Suivi")));
}
function TodayNutrition({ fg, bg, goTab }) {
    const [nLogs, setNLogs] = useStored("nutri-logs", []);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [sLogs] = useStored("sport-logs", []);
    const [alts] = useStored("repas-alts", {});
    const [mens] = useStored("mensurations", []);
    const [h] = useStored("taille-corps", "");
    const [cfg] = useStored("nutri-cal-cfg", null);
    const [food] = useStored("food-log", {});
    const [swLogs] = useStored("natation-logs", []);
    const today = isoToday(), tl = nLogs.find(l => l.dateISO === today);
    const planned = sessionForDate(today, resolveProgramme(profile, sLogs)) ? "training" : "rest";
    const dayType = tl?.dayType || planned;
    const menu = dayMenu(dayType, profile, alts, bodyTargets(nLogs, mens, parseFloat(h) || 0, normCalCfg(cfg)), swimKcalOn(swLogs, today));
    const rows = menu.meals.map((m, i) => { const mm = menu.mealMacros[i]; return { id: MEAL_ID[m.m], m, kcal: Math.round(mm.p * 4 + mm.g * 4 + mm.l * 9) }; }).filter(r => r.id);
    const meals = tl?.meals || {};
    const eaten = rows.filter(r => meals[r.id]).reduce((a, r) => a + r.kcal, 0);
    const extras = (food[today] || []).filter(f => !f.plan).reduce((a, f) => a + (f.kcal || 0), 0);
    const tot = eaten + extras;
    // Même format que l'onglet Suivi : la checklist du jour et le % de suivi restent cohérents
    const write = (nm, dt) => { const ids = rows.map(r => r.id); const ok = ids.filter(x => nm[x]).length; const base = tl || { id: Date.now(), date: fmtDateShort(today), dateISO: today, weight: null, supps: {}, water: 0, sleep: null, stress: 5 }; setNLogs([...nLogs.filter(l => l.dateISO !== today), { ...base, dayType: dt, meals: nm, mealsOk: ok, mealsTotal: ids.length, compliance: Math.round(ok / ids.length * 100) }]); };
    const toggle = id => write({ ...Object.fromEntries(rows.map(r => [r.id, !!meals[r.id]])), [id]: !meals[id] }, dayType);
    const pct = Math.min(100, tot / menu.dayTgt * 100);
    return React.createElement("div", { style: TD.wrap },
        React.createElement("div", { style: { ...TD.giant, fontVariantNumeric: "tabular-nums" } }, tot.toLocaleString("fr-FR")),
        React.createElement("p", { style: TD.lead }, "sur " + menu.dayTgt.toLocaleString("fr-FR") + " kcal aujourd'hui" + (menu.swimExtra ? " (+" + menu.swimExtra + " kcal de natation)" : "") + ". Barre un repas quand il est mangé." + (extras ? " Dont " + extras + " kcal hors menu (journal)." : "")),
        React.createElement("div", { style: { height: 16, border: `2.5px solid ${fg}`, position: "relative", margin: "0 0 12px" } }, React.createElement("i", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", background: fg, transition: "width .6s cubic-bezier(.7,0,.2,1)" } })),
        React.createElement("div", { style: { marginBottom: 14 } }, React.createElement("button", { onClick: () => write({ ...meals }, dayType === "training" ? "rest" : "training"), style: TD.chip(fg) }, (dayType === "training" ? "🏋️ Jour d'entraînement" : "🛌 Jour de repos") + (dayType === planned ? "" : " (modifié)") + " · changer")),
        React.createElement("div", { style: TD.rule(fg) }, rows.map(r => { const on = !!meals[r.id]; return React.createElement("button", { key: r.id, onClick: () => toggle(r.id), "aria-pressed": on, style: { position: "relative", width: "100%", display: "grid", gridTemplateColumns: "54px 1fr auto", gap: 8, alignItems: "baseline", padding: "12px 0", border: 0, borderBottom: `2px solid ${fg}`, background: "none", color: fg, textAlign: "left", cursor: "pointer" } },
            React.createElement("time", { style: { fontSize: 12.5, fontWeight: 800 } }, r.m.h),
            React.createElement("span", { style: { fontSize: 19, fontWeight: 700, opacity: on ? .7 : 1 } }, r.m.m),
            React.createElement("em", { style: { fontStyle: "normal", fontFamily: AN, fontSize: 22 } }, r.kcal),
            React.createElement("i", { "aria-hidden": true, style: { position: "absolute", left: 54, right: 0, top: "50%", height: 3.5, background: C.ink, transform: `scaleX(${on ? 1 : 0})`, transformOrigin: "left", transition: "transform .4s cubic-bezier(.7,0,.2,1)" } })); })),
        React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 } },
            React.createElement("button", { onClick: () => goTab("journal"), style: TD.chip(fg) }, "📓 Ajouter un aliment"),
            React.createElement("button", { onClick: () => goTab("suivi"), style: TD.chip(fg) }, "⚖️ Pesée, eau, sommeil → Suivi")));
}
function TodayBudget({ fg }) {
    const [fin] = useStored("fin-expenses", []);
    const week = fin.filter(e => withinDays(e.dateISO, 7)), dep = Math.round(week.reduce((a, e) => a + (+e.montant || 0), 0));
    const byCat = Object.entries(week.reduce((m, e) => ({ ...m, [e.cat]: (m[e.cat] || 0) + (+e.montant || 0) }), {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return React.createElement("div", { style: TD.wrap },
        React.createElement("div", { style: TD.giant }, dep + " €"),
        React.createElement("p", { style: TD.lead }, "dépensés ces 7 derniers jours. Courses visées : ~" + TOTAL_SEM + " €/sem, ~" + TOTAL_SEM_B + " € avec les alternatives."),
        byCat.length > 0 && React.createElement("div", { style: TD.rule(fg) }, byCat.map(([k, v]) => React.createElement("div", { key: k, style: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `2px solid ${fg}`, fontSize: 16, fontWeight: 700 } }, React.createElement("span", null, (finCats.find(c => c.k === k)?.e || "") + " " + k), React.createElement("em", { style: { fontStyle: "normal", fontFamily: AN, fontSize: 21 } }, Math.round(v) + " €")))));
}
function TodayScience({ fg, bg, goTab }) {
    const [nLogs] = useStored("nutri-logs", []);
    const D = useRecoveryData();
    const [edit, setEdit] = useState(false);
    const r = recoveryFor(isoToday(), D);
    const weigh = nLogs.filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    const cw = avgRecent(weigh, 7), rate = weigh.length >= 3 ? weeklyRate(weigh) : null, pct = rate != null && cw ? Math.round(rate / cw * 1000) / 10 : null;
    const verdict = pct == null ? "Il faut au moins 3 pesées pour mesurer ta tendance." : pct < PACE_MIN ? "Perte un peu rapide : regarde le Bilan ci-dessous pour ajuster le déficit." : pct > PACE_SLOW ? "Perte trop lente : le Bilan propose d'ajuster le déficit." : pct > PACE_MAX ? "Rythme un peu lent mais acceptable en recomposition." : "Pile dans la zone −0,5 à −1 %. On garde le déficit.";
    // Récupération du matin en tête ; sans saisie aujourd'hui, le formulaire est directement sur l'affiche
    const recup = !r || edit
        ? React.createElement(Fragment, null,
            React.createElement("div", { style: TD.giant }, "Matin"),
            React.createElement("p", { style: TD.lead }, r ? "Corrige ta saisie du matin." : "Ta saisie Polar du matin, en 20 secondes : le score de récupération s'affiche ici."),
            React.createElement(RecupForm, { fg, bg, onDone: () => setEdit(false), onCancel: r ? () => setEdit(false) : null }),
            React.createElement("div", { style: { height: 22 } }))
        : React.createElement(Fragment, null,
            React.createElement(RecupHead, { r, fg, bg, giant: { ...TD.giant, margin: "4px -3px 4px" } }),
            React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 } },
                React.createElement("button", { onClick: () => goTab("recup"), style: TD.chip(fg) }, "Détail et graphiques →"),
                React.createElement("button", { onClick: () => setEdit(true), style: TD.chip(fg) }, "Modifier ma saisie")));
    return React.createElement("div", { style: TD.wrap },
        recup,
        React.createElement("div", { style: { fontFamily: AN, fontSize: 30, lineHeight: 1, textTransform: "uppercase", margin: "0 0 6px" } }, "Poids " + (pct == null ? "" : (pct > 0 ? "+" : "") + pct.toLocaleString("fr-FR") + " %/sem")),
        React.createElement("p", { style: { ...TD.lead, fontSize: 14 } }, verdict),
        cw && React.createElement("div", { style: TD.rule(fg) },
            [["Poids moyen 7 j", kgFr(cw) + " kg"], ["Tendance", rate != null ? (rate > 0 ? "+" : "") + kgFr(rate) + " kg/sem" : "—"], ["Départ", weigh.length ? kgFr(weigh[0].kg) + " kg" : "—"]].map(([a, b]) => React.createElement("div", { key: a, style: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `2px solid ${fg}`, fontSize: 16, fontWeight: 700 } }, React.createElement("span", null, a), React.createElement("em", { style: { fontStyle: "normal", fontFamily: AN, fontSize: 21 } }, b)))));
}
/* ═══ PARCOURS — trois écrans (Aujourd'hui, Progrès, Plan), niveaux, coach, démarrage en 6 questions ═══
 * L'accueil devient « le Fil » : ta journée heure par heure. Chaque carte écrit dans les mêmes données que les affiches.
 * Les 4 affiches de couleur restent : elles s'ouvrent depuis Plan ou depuis une carte du Fil, avec tous leurs onglets.
 * Profil ("profil") : niveau 1-4, unlockAll, levelSince, onboarded, owner, montre, budgetSemaine, coursesJour, coachDismiss.
 * Les jours validés se déduisent des logs existants : les niveaux ne créent aucune donnée nouvelle. */
let LEVEL = 4; // niveau visible : filtre les cartes du Fil, les blocs de Progrès, les lignes de Plan et les onglets des affiches
const LEVELS = [
    { n: 1, name: "Les bases", items: ["Ta journée heure par heure", "Séance guidée, séries à cocher", "Repas à cocher", "Pesée et courbe de poids"] },
    { n: 2, name: "Le rythme", items: ["Forme du matin", "Plats de remplacement", "Natation", "Courses et budget"], unlock: ["Ta journée s'enrichit", "Ta forme du matin, la natation et les courses arrivent dans ta journée. Tu peux aussi changer de plat : les portions restent calculées pour toi."] },
    { n: 3, name: "La progression", items: ["Coach des charges", "Créer ou importer un programme", "Journal alimentaire", "Mensurations et photos"], unlock: ["Ton coach monte les charges", "Quand une série devient facile, il ajoute un peu de poids la fois suivante. Tu peux aussi créer ton programme et noter tout ce que tu manges."] },
    { n: 4, name: "Expert", items: ["Récupération avec montre", "Max estimés, volume par muscle", "Bilans sanguins", "Réglages science et termes exacts"], unlock: ["Mode expert", "Tous les outils détaillés sont ouverts : récupération avec ta montre, max estimés, bilans sanguins, réglages science. Les termes techniques reviennent."] },
];
/* Lexique : mot simple jusqu'au niveau 3, terme exact au niveau expert */
const lx = (plain, expert) => LEVEL >= 4 ? expert : plain;
/* Niveau à partir duquel chaque onglet des affiches est visible (1 par défaut) */
const TAB_LEVEL = {
    sport: { natation: 2, programmes: 3, suivi: 3, coach: 3, progression: 4, rm: 4 },
    nutrition: { aliments: 2, complements: 2, journal: 3, corps: 3 },
    budget: { resume: 2, finances: 2, aliments: 2, suivi: 2, conseils: 2, alternatives: 3 },
    review: { recup: 2, bilan: 2, surcharge: 3, config: 4 },
};
const tabOk = (sec, k) => ((TAB_LEVEL[sec] || {})[k] || 1) <= LEVEL;
const POSTER_LEVEL = { sport: 1, nutrition: 1, budget: 2, review: 2 };
const SEANCE_FR = { Push: "Poussée", Pull: "Tirage", Legs: "Jambes", Upper: "Haut du corps", Lower: "Bas du corps" };
const seanceLabel = code => LEVEL >= 4 ? code : (SEANCE_FR[code] || code);
const LEXIQUE = [["RPE 8", "Difficulté 8 sur 10 : il te restait 2 répétitions"], ["1RM", "Ton max estimé"], ["4×8-10", "4 séries de 8 à 10 répétitions"], ["Surcharge progressive", "Le coach ajoute du poids quand c'est facile"], ["Décharge", "Semaine plus légère pour récupérer"], ["Phase S1-4", "Mois 1 : reprise en douceur"], ["Push / Pull / Legs", "Poussée / Tirage / Jambes"], ["Upper / Lower", "Haut du corps / Bas du corps"], ["DC, DI, DM", "Développé couché, incliné, militaire (épaules)"], ["RDL", "Soulevé de terre jambes tendues"], ["Déficit −500 kcal", "Tu manges 500 kcal de moins que ce que tu dépenses"], ["TDEE", "Ce que ton corps dépense dans la journée"], ["Métabolisme de base", "Ce que ton corps dépense au repos"], ["Masse maigre", "Ton poids sans la graisse"], ["Macros", "Protéines, glucides, lipides"], ["Compliance 80 %", "8 repas sur 10 suivis"], ["VFC, statut SNA", "Ta recharge de la nuit (montre)"], ["Glycogène", "Ton stock d'énergie dans les muscles"], ["MEV / MAV", "Assez ou trop de séries pour ce muscle"], ["Charge aiguë / chronique", "Ta semaine comparée à ton mois"]];
const REGLES_GEN = ["Échauffe-toi 5 minutes avant chaque séance.", "Une douleur qui pique : arrête l'exercice tout de suite.", "Le premier mois, garde 2 répétitions en réserve à chaque série.", "Bois 500 ml d'eau pendant la séance.", "Dors 7 à 8 h : c'est la nuit que le muscle se construit."];
const hhmm = h => { const n = ((hToMin(h) % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0"); };
/* Journée validée : bouger (ou repos prévu), au moins 3 repas cochés, pesée */
function dayValidated(iso, d) {
    const s = sessionForDate(iso, d.prog);
    const moved = !s || d.sl.some(l => l.dateISO === iso) || d.ml.some(l => l.dateISO === iso) || d.swl.some(l => l.dateISO === iso);
    const n = d.nl.find(l => l.dateISO === iso);
    return !!(moved && n && n.weight > 0 && (n.mealsOk || 0) >= Math.min(3, n.mealsTotal || 3));
}
function levelProgress(pr, d) {
    const since = pr.levelSince || isoToday();
    let n = 0;
    for (let i = 0; i <= 90; i++) {
        const iso = shiftISO(isoToday(), -i);
        if (iso < since)
            break;
        if (dayValidated(iso, d))
            n++;
    }
    return Math.min(7, n);
}
/* Mise à jour d'une entrée du suivi nutrition (créée si besoin) */
function nutriPatch(nLogs, iso, patch) {
    const ex = nLogs.find(l => l.dateISO === iso);
    const base = ex || { id: Date.now(), date: fmtDateShort(iso), dateISO: iso, weight: null, supps: {}, water: 0, sleep: null, stress: 5, meals: {}, mealsOk: 0, mealsTotal: 0, compliance: 0 };
    return [...nLogs.filter(l => l.dateISO !== iso), { ...base, ...patch }];
}
/* ── Programmes générés au démarrage (charges à 0 : elles s'apprennent avec les premières séances) ── */
const T_ = (nom, muscle, sets, lo, hi, rest) => ({ nom, muscle, sets, lo, hi, kg: 0, rest: rest || 90, note: "" });
const TPL = {
    fullA: ["Corps entier A", [T_("Presse à cuisses", "Quadriceps", 3, 10, 12, 120), T_("Développé couché haltères", "Pecs", 3, 8, 10, 120), T_("Tirage vertical", "Dos", 3, 10, 12), T_("Élévations latérales", "Épaules", 3, 12, 15, 60), T_("Leg curl", "Ischios", 3, 12, 15, 60), T_("Crunch", "Abdos", 3, 12, 15, 45)]],
    fullB: ["Corps entier B", [T_("Goblet squat", "Quadriceps", 3, 10, 12, 120), T_("Tirage horizontal poulie", "Dos", 3, 10, 12), T_("Développé épaules haltères", "Épaules", 3, 10, 12), T_("Hip thrust", "Fessiers", 3, 10, 12), T_("Curl biceps", "Biceps", 2, 12, 15, 60), T_("Triceps poulie", "Triceps", 2, 12, 15, 60)]],
    fullC: ["Corps entier C", [T_("Fentes", "Quadriceps", 3, 10, 12), T_("Développé incliné haltères", "Pecs", 3, 10, 12), T_("Rowing haltère", "Dos", 3, 10, 12), T_("Soulevé de terre jambes tendues", "Ischios", 3, 10, 12, 120), T_("Face pull", "Épaules", 3, 12, 15, 60), T_("Mollets debout", "Mollets", 3, 15, 20, 60)]],
    hautA: ["Haut A", [T_("Développé couché haltères", "Pecs", 4, 8, 10, 120), T_("Tirage vertical", "Dos", 4, 8, 10, 120), T_("Développé épaules haltères", "Épaules", 3, 10, 12), T_("Rowing haltère", "Dos", 3, 10, 12), T_("Curl biceps", "Biceps", 3, 10, 12, 60), T_("Triceps poulie", "Triceps", 3, 10, 12, 60)]],
    basA: ["Bas A", [T_("Presse à cuisses", "Quadriceps", 4, 10, 12, 120), T_("Soulevé de terre jambes tendues", "Ischios", 3, 8, 10, 120), T_("Leg extension", "Quadriceps", 3, 12, 15, 60), T_("Leg curl", "Ischios", 3, 12, 15, 60), T_("Mollets debout", "Mollets", 4, 15, 20, 60)]],
    hautB: ["Haut B", [T_("Développé incliné haltères", "Pecs", 4, 8, 10, 120), T_("Tirage horizontal poulie", "Dos", 4, 10, 12), T_("Élévations latérales", "Épaules", 3, 12, 15, 60), T_("Face pull", "Épaules", 3, 12, 15, 60), T_("Curl marteau", "Biceps", 3, 10, 12, 60), T_("Extension triceps", "Triceps", 3, 10, 12, 60)]],
    basB: ["Bas B", [T_("Goblet squat", "Quadriceps", 4, 8, 10, 120), T_("Hip thrust", "Fessiers", 4, 8, 10, 120), T_("Fentes", "Quadriceps", 3, 10, 12), T_("Leg curl assis", "Ischios", 3, 12, 15, 60), T_("Mollets assis", "Mollets", 4, 12, 15, 60)]],
    pousse: ["Poussée", [T_("Développé couché haltères", "Pecs", 4, 8, 10, 120), T_("Développé incliné haltères", "Pecs", 3, 10, 12), T_("Développé épaules haltères", "Épaules", 3, 10, 12), T_("Élévations latérales", "Épaules", 3, 12, 15, 60), T_("Triceps poulie", "Triceps", 3, 12, 15, 60)]],
    tirage: ["Tirage", [T_("Tirage vertical", "Dos", 4, 8, 10, 120), T_("Rowing haltère", "Dos", 3, 10, 12), T_("Tirage horizontal poulie", "Dos", 3, 10, 12), T_("Face pull", "Épaules", 3, 12, 15, 60), T_("Curl biceps", "Biceps", 3, 10, 12, 60)]],
    jambes: ["Jambes", [T_("Presse à cuisses", "Quadriceps", 4, 10, 12, 120), T_("Soulevé de terre jambes tendues", "Ischios", 3, 8, 10, 120), T_("Leg extension", "Quadriceps", 3, 12, 15, 60), T_("Leg curl", "Ischios", 3, 12, 15, 60), T_("Mollets debout", "Mollets", 4, 15, 20, 60)]],
};
const PLAN_JOURS = { 2: [["fullA", 1], ["fullB", 4]], 3: [["fullA", 1], ["fullB", 3], ["fullC", 5]], 4: [["hautA", 1], ["basA", 2], ["hautB", 4], ["basB", 5]], 5: [["pousse", 1], ["tirage", 2], ["jambes", 3], ["hautA", 5], ["basB", 6]] };
function buildProgram(jours, debutant) {
    const plan = PLAN_JOURS[jours] || PLAN_JOURS[3];
    return { id: newId("p"), name: plan.length <= 3 ? "Corps entier " + plan.length + " jours" : plan.length === 4 ? "Haut / Bas 4 jours" : "Poussée / Tirage / Jambes", auto: true,
        seances: plan.map(([k, d]) => ({ nom: TPL[k][0], days: [d], ex: TPL[k][1].map(e => ({ ...e, sets: debutant ? Math.max(2, e.sets - 1) : e.sets })) })) };
}
/* Le démarrage écrit le profil, les calories, le poids du jour, le programme et la natation */
async function applyOnboarding(a, unlockAll) {
    const lieux = a.lieux.length ? a.lieux : ["salle"];
    const debutant = a.niv === 0;
    let programme = "maison", progs = await load("programmes", []);
    if (lieux.includes("salle")) {
        const p = buildProgram(a.jours, debutant);
        progs = [...progs.filter(x => !x.auto), p];
        programme = p.id;
    }
    else if (!lieux.includes("maison"))
        programme = "aucun";
    await save("programmes", progs);
    if (lieux.includes("piscine")) {
        const used = (PLAN_JOURS[a.jours] || []).map(x => x[1]);
        const day = [6, 3, 0, 4].find(d => !used.includes(d));
        const models = await load("natation-modeles", []);
        if (!models.length)
            await save("natation-modeles", [{ ...swimSample(), name: debutant ? "Découverte 1 000 m" : "Endurance 1 400 m", days: day != null ? [day] : [], blocks: debutant ? swimSample().blocks.filter(b => b.t !== "Série") : swimSample().blocks }]);
    }
    await save("nutri-cal-cfg", { ...(await load("nutri-cal-cfg", {}) || {}), sex: a.sexe === "Femme" ? "F" : "H", age: a.age, activity: a.jours >= 4 ? 1.55 : 1.375, deficit: [500, -250, 300, 0][a.obj], protMode: "lean" });
    await save("taille-corps", a.taille);
    await save("nutri-logs", nutriPatch(await load("nutri-logs", []), isoToday(), { weight: a.poids }));
    const pr = normProfile(await load("profil", PROFILE_DEFAULT));
    await save("profil", { ...pr, programme, onboarded: true, owner: false, niveau: unlockAll ? 4 : [1, 2, 3][a.niv], unlockAll: !!unlockAll, levelSince: isoToday(), objectif: a.obj, budgetSemaine: [40, 60, 80, 100][a.budget], coursesJour: pr.coursesJour ?? 6 });
}
/* ── Petits graphiques ── */
function Spark({ vals, color, h }) {
    if (!vals || vals.length < 2)
        return null;
    const H = h || 64, w = 300, lo = Math.min(...vals), hi = Math.max(...vals), pad = 6;
    const x = i => pad + i * (w - 2 * pad) / (vals.length - 1), y = v => pad + (H - 2 * pad) * (1 - (v - lo) / ((hi - lo) || 1));
    const pts = vals.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" "), L = vals.length - 1;
    return hx("svg", { viewBox: "0 0 " + w + " " + H, style: { width: "100%", height: "auto", display: "block", marginTop: 6 }, "aria-hidden": true },
        hx("polygon", { points: x(0) + "," + H + " " + pts + " " + x(L) + "," + H, fill: color, fillOpacity: .14 }),
        hx("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        hx("circle", { cx: x(L), cy: y(vals[L]), r: 5, fill: color, stroke: C.ink, strokeWidth: 2 }));
}
function Bars({ vals, labels, color }) {
    const w = 300, h = 74, bw = w / vals.length;
    return hx("svg", { viewBox: "0 0 " + w + " " + h, style: { width: "100%", height: "auto", display: "block", marginTop: 6 }, "aria-hidden": true }, vals.map((v, i) => hx(Fragment, { key: i },
        hx("rect", { x: i * bw + 5, y: 58 - Math.min(100, v) / 100 * 50, width: bw - 10, height: Math.max(1, Math.min(100, v) / 100 * 50), fill: i === vals.length - 1 ? color : C.ink }),
        hx("text", { x: i * bw + bw / 2, y: 71, textAnchor: "middle", fontSize: 10, fontWeight: 700, fill: C.textMut }, labels[i]))));
}
const scrH = { fontFamily: AN, fontSize: 56, lineHeight: .88, textTransform: "uppercase", margin: "6px 0 8px" };
const capS = { fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: C.textMut };
/* Carte des niveaux (Fil et Plan) */
function LevelMap({ pr, setProfile, progress }) {
    const lvl = pr.unlockAll ? 4 : (pr.niveau || 4);
    const setLvl = n => { setProfile({ ...pr, niveau: n, unlockAll: n === 4, levelSince: isoToday() }); toast(n === 4 ? "Tout est débloqué" : "Tu es au niveau " + n + " : " + LEVELS[n - 1].name); };
    return hx("div", null,
        hx("p", { style: { fontSize: 14, color: C.textMut, lineHeight: 1.45, margin: "0 0 12px" } }, lvl >= 4 ? "Tout est débloqué. Tu peux choisir un niveau plus simple pour découvrir l'app pas à pas." : "Valide 7 journées pour passer au niveau suivant : ta séance (ou ton repos prévu), au moins 3 repas cochés et ta pesée."),
        LEVELS.map((l, i) => {
            const locked = l.n > lvl, cur = l.n === lvl;
            return hx("div", { key: l.n, style: { display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, opacity: locked ? .45 : 1 } },
                hx("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
                    hx("b", { style: { width: 40, height: 40, flex: "none", borderRadius: "50%", border: `2.5px solid ${C.ink}`, display: "grid", placeItems: "center", fontFamily: AN, fontWeight: 400, fontSize: 20, background: cur ? C.ink : C.surface, color: cur ? C.sci : C.ink } }, locked ? "?" : l.n),
                    i < 3 && hx("i", { style: { width: 3, flex: 1, minHeight: 16, background: C.ink } })),
                hx("div", { style: { paddingBottom: 14 } },
                    hx("div", { style: { fontFamily: AN, fontSize: 22, textTransform: "uppercase", lineHeight: 1.05 } }, l.name + (locked ? " · verrouillé" : cur && l.n < 4 ? " · " + progress + "/7 jours" : "")),
                    hx("ul", { style: { margin: "4px 0 0", paddingLeft: 16, fontSize: 13.5, lineHeight: 1.45 } }, l.items.map(x => hx("li", { key: x }, x)))));
        }),
        hx("div", { style: { ...capS, margin: "4px 0 8px" } }, "Me placer au niveau"),
        hx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, [1, 2, 3, 4].map(n => hx("button", { key: n, onClick: () => setLvl(n), style: PM.mini(lvl === n) }, n === 4 ? "Tout débloquer" : "Niveau " + n))));
}
/* Le bouton + : les imprévus de la journée, en deux touches */
function QuickSheet({ onClose, goTo, setScreen, initial }) {
    const [view, setView] = useState(initial || null);
    const [nLogs, setNLogs] = useStored("nutri-logs", []);
    const [fin, setFin] = useStored("fin-expenses", []);
    const [dl, setDl] = useStored("douleur-logs", []);
    const [food, setFood] = useStored("food-log", {});
    const [v, setV] = useState("");
    const [cat, setCat] = useState("Courses");
    const [zone, setZone] = useState(painZones[0]);
    const today = isoToday();
    const num = x => { const n = parseFloat(String(x).replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
    const finish = msg => { toast(msg); onClose(); };
    const field = (ph, mode) => hx("input", { value: v, inputMode: mode || "decimal", placeholder: ph, autoFocus: true, onChange: e => setV(e.target.value), style: { ...inputStyle, fontSize: 20, fontWeight: 700 } });
    const ok = (label, run) => hx("button", { onClick: run, style: { ...PM.btn, marginTop: 10 } }, label);
    const back = hx("button", { onClick: () => { setView(null); setV(""); }, style: { ...PM.mini(false), marginBottom: 10 } }, "‹ Retour");
    const items = [["poids", "Je me pèse", "Ton poids du matin"], ["extra", "J'ai mangé autre chose", LEVEL >= 3 ? "Dans le journal alimentaire" : "Ajoute les calories en plus"], LEVEL >= 2 && ["depense", "J'ai dépensé de l'argent", "Montant et catégorie"], ["mal", "J'ai mal quelque part", "Les exercices concernés seront signalés"], ["progres", "Où j'en suis ?", "Ta progression en un coup d'œil"], ["seance", "Changer de séance", "Faire une autre séance aujourd'hui"]].filter(Boolean);
    const go = k => { if (k === "progres") {
        setScreen("progres");
        onClose();
    }
    else if (k === "seance") {
        goTo("sport");
        onClose();
    }
    else if (k === "extra" && LEVEL >= 3) {
        goTo("nutrition", "journal");
        onClose();
    }
    else {
        setView(k);
        setV("");
    } };
    let body;
    if (view === "poids")
        body = hx("div", null, back, hx("div", { style: capS }, "Poids ce matin (kg)"), field("84,2"), ok("Enregistrer", async () => { const w = num(v); if (!w || w < 25 || w > 350)
            return toast("Indique ton poids en kg", { tone: "danger" }); await setNLogs(nutriPatch(nLogs, today, { weight: Math.round(w * 10) / 10 })); finish("⚖️ " + String(w).replace(".", ",") + " kg enregistrés"); }));
    else if (view === "extra")
        body = hx("div", null, back, hx("div", { style: capS }, "Calories en plus (kcal)"), field("300", "numeric"), hx("p", { style: { fontSize: 12.5, color: C.textMut, margin: "6px 0 0" } }, "Une part de pizza ≈ 285 kcal, un sandwich ≈ 450 kcal, une bière ≈ 150 kcal."), ok("Ajouter", async () => { const k = num(v); if (!k)
            return toast("Indique un nombre de calories", { tone: "danger" }); await setFood({ ...food, [today]: [...(food[today] || []), { id: Date.now(), nom: "En plus", grams: null, p: 0, gl: 0, l: 0, kcal: Math.round(k) }] }); finish("+" + Math.round(k) + " kcal notées"); }));
    else if (view === "depense")
        body = hx("div", null, back, hx("div", { style: capS }, "Montant (€)"), field("12,50"), hx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 } }, ["Courses", "Sorties", "Sport", "Transport", "Loisirs", "Autre"].map(c => hx("button", { key: c, onClick: () => setCat(c), style: PM.mini(cat === c) }, c))), ok("Enregistrer", async () => { const m = num(v); if (!m)
            return toast("Indique un montant", { tone: "danger" }); await setFin([...fin, { id: Date.now(), dateISO: today, montant: m, cat, label: "" }]); finish("💸 " + String(m).replace(".", ",") + " € en " + cat.toLowerCase()); }));
    else if (view === "mal")
        body = hx("div", null, back, hx("div", { style: capS }, "Où ?"), hx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 12px" } }, painZones.map(z => hx("button", { key: z, onClick: () => setZone(z), style: PM.mini(zone === z) }, z))), hx("div", { style: capS }, "À quel point ?"), hx("div", { style: { display: "flex", gap: 6, marginTop: 6 } }, [[2, "Gêne"], [4, "Douleur"], [6, "Forte"], [8, "Très forte"]].map(([n, l]) => hx("button", { key: n, onClick: async () => { await setDl([...dl, { id: Date.now(), dateISO: today, date: fmtDateShort(today), zone, intensite: n, note: "" }]); finish(n >= 4 ? "Noté : les exercices qui sollicitent cette zone sont signalés dans ta séance." : "Noté. Surveille cette zone pendant la séance."); }, style: { ...PM.mini(false), flex: 1, padding: "10px 4px" } }, l))));
    else
        body = hx("div", null, items.map(([k, t, d]) => hx("button", { key: k, className: "plan-row", onClick: () => go(k) }, hx("div", null, hx("b", null, t), hx("span", null, d)), hx("em", { style: { fontStyle: "normal", fontWeight: 800 } }, "›"))));
    return hx(Sheet, { title: view ? items.find(x => x[0] === view)?.[1] || "Imprévu" : "Un imprévu ?", onClose }, body);
}
/* ═══ AUJOURD'HUI : le Fil ═══ */
function FilScreen({ goTo, setScreen }) {
    const D = useRecoveryData();
    const [nLogs, setNLogs] = useStored("nutri-logs", []);
    const [rl, setRl] = useStored("recup-logs", []);
    const [alts, setAlts] = useStored("repas-alts", {});
    const [profile, setProfile] = useStored("profil", PROFILE_DEFAULT);
    const [calRaw] = useStored("nutri-cal-cfg", null);
    const [food] = useStored("food-log", {});
    const [day, setDay] = useState(0);
    const [open, setOpen] = useState(null);
    const [sheet, setSheet] = useState(null);
    const [wIn, setWIn] = useState("");
    const [cheap, setCheap] = useState(false);
    const pr = normProfile(profile), today = isoToday(), iso = shiftISO(today, day), isToday = day === 0, editable = day <= 0 && day >= -2;
    const prog = resolveProgramme(profile, D.sl), sess = sessionForDate(iso, prog);
    const nlog = nLogs.find(l => l.dateISO === iso);
    const dayType = nlog?.dayType || (sess ? "training" : "rest");
    const bt = bodyTargets(nLogs, D.mens, D.cm, D.cfg);
    const menu = dayMenu(dayType, profile, alts, bt, swimKcalOn(D.swl, iso));
    const rows = menu.meals.map((m, i) => { const mm = menu.mealMacros[i]; return { id: MEAL_ID[m.m], m, i, kcal: Math.round(mm.p * 4 + mm.g * 4 + mm.l * 9) }; }).filter(r => r.id);
    const meals = nlog?.meals || {};
    const extras = (food[iso] || []).filter(f => !f.plan).reduce((a, f) => a + (f.kcal || 0), 0);
    const eaten = rows.filter(r => meals[r.id]).reduce((a, r) => a + r.kcal, 0) + extras;
    const toggleMeal = id => { const nm = { ...Object.fromEntries(rows.map(r => [r.id, !!meals[r.id]])), [id]: !meals[id] }; const ok = rows.filter(r => nm[r.id]).length; setNLogs(nutriPatch(nLogs, iso, { dayType, meals: nm, mealsOk: ok, mealsTotal: rows.length, compliance: Math.round(ok / rows.length * 100) })); };
    const weighs = nLogs.filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const lastW = [...weighs].filter(l => l.dateISO <= iso).pop()?.weight || bt.curW || null;
    const weekAgo = [...weighs].filter(l => l.dateISO <= shiftISO(iso, -6)).pop()?.weight;
    const reveil = hToMin(pr.reveil), creneau = CRENEAUX[pr.creneau] || CRENEAUX.midi;
    const lvlData = { prog, sl: D.sl, ml: D.ml, swl: D.swl, nl: nLogs };
    const progress = levelProgress(pr, lvlData);
    const items = [];
    const card = (k, t, node, done, extra) => items.push({ k, t, node, done, ...(extra || {}) });
    // Forme du matin (niveau 2) : une question, ou les 4 chiffres de la montre
    if (LEVEL >= 2) {
        const e = rl.find(l => l.dateISO === iso), r = e ? (isToday ? RECUP_RES : recoveryFor(iso, D)) : null;
        const useWatch = pr.montre || LEVEL >= 4;
        const node = e ? hx("div", { className: "fil-card done", onClick: () => goTo("review", "recup") }, hx("b", null, r && r.score != null ? "Ta forme : " + r.score + "/100" : "Forme du matin notée"), hx("span", { className: "sub" }, r && r.score != null ? r.verdict.t + " · détail →" : "Le score arrive avec quelques matins de plus"))
            : !isToday ? hx("div", { className: "fil-card" }, hx("b", null, "Forme du matin"), hx("span", { className: "sub" }, day > 0 ? "Demain matin, une question sur ta nuit" : "Pas de réponse ce jour-là"))
                : hx("div", { className: "fil-card", style: { background: C.sci } },
                    hx("div", { onClick: () => setOpen(open === "forme" ? null : "forme"), style: { display: "grid", gap: 2 } }, hx("b", null, "Comment tu as dormi ?"), hx("span", { className: "sub", style: { color: C.ink } }, useWatch ? "Les 4 chiffres de ta montre, en 20 secondes" : "Une touche suffit")),
                    open === "forme" && (useWatch ? hx("div", { style: { marginTop: 8 } }, hx(RecupForm, { fg: C.ink, bg: C.sci, onDone: () => setOpen(null) }), LEVEL < 4 && hx("button", { className: "p-link", onClick: () => setProfile({ ...pr, montre: false }), style: { border: 0, background: "none", fontWeight: 800, textDecoration: "underline", marginTop: 6, padding: 0, cursor: "pointer" } }, "Je n'ai pas de montre"))
                        : hx("div", { style: { display: "grid", gap: 8, marginTop: 6 } },
                            hx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, [["Mal", 0], ["Correct", 1], ["Très bien", 2]].map(([l, f]) => hx("button", { key: f, onClick: async () => { await setRl([...rl.filter(x => x.dateISO !== today), { id: Date.now(), dateISO: today, feel: f }]); setOpen(null); toast("Forme notée"); }, style: { ...PM.mini(false), background: C.surface, padding: "8px 14px" } }, l))),
                            hx("button", { onClick: () => setProfile({ ...pr, montre: true }), style: { border: 0, background: "none", fontWeight: 800, textDecoration: "underline", padding: 0, cursor: "pointer", textAlign: "left", fontSize: 13 } }, "J'ai une montre Polar"))));
        card("forme", reveil, node, !!e);
    }
    // Pesée
    {
        const w = nlog?.weight;
        const diff = w && weekAgo ? Math.round((w - weekAgo) * 10) / 10 : null;
        const node = w ? hx("div", { className: "fil-card done" }, hx("b", null, "Pesée : " + String(w).replace(".", ",") + " kg"), hx("span", { className: "sub" }, diff == null ? "Au réveil, à jeun" : sgn(diff) + " kg en 7 jours"))
            : !editable ? hx("div", { className: "fil-card" }, hx("b", null, "Pesée"), hx("span", { className: "sub" }, "Au réveil, à jeun"))
                : hx("div", { className: "fil-card" }, hx("div", { onClick: () => { setOpen(open === "pesee" ? null : "pesee"); setWIn(lastW ? String(lastW).replace(".", ",") : ""); }, style: { display: "grid", gap: 2 } }, hx("b", null, "Pesée"), hx("span", { className: "sub" }, "Au réveil, à jeun, après les toilettes")),
                    open === "pesee" && hx("div", { style: { display: "flex", gap: 8, marginTop: 8 } }, hx("input", { value: wIn, inputMode: "decimal", autoFocus: true, "aria-label": "Poids en kg", onChange: e => setWIn(e.target.value), style: { ...inputStyle, fontSize: 20, fontWeight: 700, flex: 1 } }), hx("button", { onClick: async () => { const v = parseFloat(String(wIn).replace(",", ".")); if (!(v > 25 && v < 350))
                            return toast("Indique ton poids en kg", { tone: "danger" }); await setNLogs(nutriPatch(nLogs, iso, { weight: Math.round(v * 10) / 10 })); setOpen(null); }, style: PM.btn }, "Valider")));
        card("pesee", reveil + 10, node, !!w);
    }
    // Repas
    rows.forEach(r => {
        const on = !!meals[r.id], op = open === "m" + r.id, akey = dayType + ":" + r.m.m, cur = alts[akey] || 0, nAlt = (r.m.alts || []).length;
        const its = r.m.items.map(it => it.t ? it.t : it.n + (it.fix ? (it.u ? " · " + it.u : "") : " · " + Math.round(it.cru * menu.itemF(it) / 5) * 5 + " g"));
        const node = hx("div", { className: "fil-card" + (on ? " done" : ""), style: { gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center" } },
            hx("div", { onClick: () => setOpen(op ? null : "m" + r.id), style: { minWidth: 0 } }, hx("b", { style: on ? { textDecoration: "line-through", textDecorationThickness: 2 } : null }, r.m.m), hx("span", { className: "sub", style: { display: "block" } }, (r.m.altLabel ? r.m.altLabel + " · " : "") + r.kcal + " kcal")),
            editable ? hx("button", { className: "fil-check" + (on ? " on" : ""), "aria-label": r.m.m + (on ? " mangé" : " à cocher"), onClick: () => toggleMeal(r.id) }) : null,
            op && hx("div", { style: { gridColumn: "1 / -1" } }, hx("ul", { style: { margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5 } }, its.map((x, j) => hx("li", { key: j }, x))),
                LEVEL >= 2 && nAlt > 0 && hx("button", { onClick: () => setAlts({ ...alts, [akey]: (cur + 1) % (nAlt + 1) }), style: { border: 0, background: "none", fontWeight: 800, textDecoration: "underline", padding: "6px 0 0", cursor: "pointer" } }, cur < nAlt ? "Changer de plat" : "Revenir au plat prévu")));
        card("m" + r.id, hToMin(r.m.h), node, on);
    });
    // Séance (ou repos)
    {
        const t = hToMin(creneau.seance);
        if (sess) {
            const isM = sess.prog === "maison", se = isM ? null : seanceById(sess.code);
            const done = isM ? D.ml.some(l => l.dateISO === iso && l.seance === sess.code) : D.sl.some(l => l.dateISO === iso && l.seance === sess.code);
            const nEx = isM ? (maison.find(x => x.code === sess.code)?.ex.length || 6) : (se?.exercices.length || 0);
            const nSets = isM ? 0 : (se?.exercices || []).reduce((a, e) => a + (parseDetail(e.detail)?.sets || 3), 0);
            const label = isM ? "Maison " + sess.code : seanceLabel(sess.code);
            const logged = D.sl.filter(l => l.dateISO === iso).reduce((a, l) => a + (l.exercices || []).reduce((b, x) => b + exSets(x), 0), 0);
            const node = hx("div", { className: "fil-card" + (done ? " done" : ""), style: done ? null : { background: C.amber } },
                hx("b", { style: done ? { textDecoration: "line-through", textDecorationThickness: 2 } : null }, "Séance " + label),
                hx("span", { className: "sub", style: done ? null : { color: C.ink } }, done ? "Faite" + (logged ? " : " + logged + " séries" : "") : (isM ? sess.titre : nEx + " exercices · ~" + Math.max(30, Math.round(nSets * 2.5 / 5) * 5) + " min") + (RECUP_RES && RECUP_RES.score != null && isToday ? " · forme " + RECUP_RES.score + "/100" : "")),
                isToday && !done && hx("div", null, hx("button", { onClick: () => goTo("sport"), style: { ...PM.btn, display: "inline-block", width: "auto", padding: "9px 18px", marginTop: 4 } }, "Commencer")));
            card("seance", t, node, done);
        }
        else
            card("repos", t, hx("div", { className: "fil-card" }, hx("b", null, "Jour de repos"), hx("span", { className: "sub" }, "30 minutes de marche et quelques étirements : ça aide à récupérer.")), false, { passive: true });
    }
    // Natation (niveau 2)
    if (LEVEL >= 2) {
        const m = swimPlannedFor(D.models, iso), logs = D.swl.filter(l => l.dateISO === iso);
        if (m || logs.length) {
            const node = hx("div", { className: "fil-card" + (logs.length ? " done" : ""), onClick: () => goTo("sport", "natation"), style: logs.length ? null : { background: C.swim, color: "#fff", borderColor: C.swim } },
                hx("b", null, logs.length ? "Nagé : " + logs.map(l => l.distance.toLocaleString("fr-FR") + " m").join(" + ") : "Natation " + swimDist(m).toLocaleString("fr-FR") + " m"),
                hx("span", { className: "sub", style: logs.length ? null : { color: "#fff" } }, logs.length ? logs.map(l => fmtDur(l.duree)).join(" + ") + " · +" + swimKcalOn(D.swl, iso) + " kcal" : m.name + " · ~" + Math.round(swimDur(m) / 60) + " min · le détail →"));
            card("nage", sess ? hToMin("18h30") : hToMin(creneau.seance), node, logs.length > 0);
        }
    }
    // Courses (niveau 2), le jour choisi
    if (LEVEL >= 2 && new Date(iso + "T12:00:00").getDay() === (pr.coursesJour ?? 6)) {
        const scale = menu.dayTgt / macrosTarget.kcal, cats = {};
        budgetAliments.forEach(a => { const v = cheap && a.budget ? a.budget.sem : a.sem; cats[a.cat] = (cats[a.cat] || 0) + v * scale; });
        const total = Math.round(Object.values(cats).reduce((a, b) => a + b, 0));
        const budget = pr.budgetSemaine;
        const node = hx("div", { className: "fil-card", style: { background: C.budget, color: "#fff", borderColor: C.budget } },
            hx("div", { onClick: () => setOpen(open === "courses" ? null : "courses") }, hx("b", null, "Courses de la semaine"), hx("span", { className: "sub", style: { color: "#fff", display: "block" } }, "≈ " + total + " €" + (cheap ? " · version moins chère" : "") + (budget ? " · budget " + budget + " €" : "") + " · " + budgetAliments.length + " articles")),
            open === "courses" && hx("div", { style: { marginTop: 6, fontSize: 13.5, lineHeight: 1.5 } }, Object.entries(cats).map(([c, v]) => hx("div", { key: c, style: { display: "flex", justifyContent: "space-between", borderTop: "1px solid #ffffff55", padding: "4px 0" } }, hx("span", null, c), hx("b", null, Math.round(v) + " €"))),
                hx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 } }, hx("button", { onClick: () => setCheap(!cheap), style: { ...PM.mini(false), borderColor: "#fff", color: "#fff" } }, cheap ? "Liste normale" : "Version moins chère"), hx("button", { onClick: () => goTo("budget", "aliments"), style: { ...PM.mini(false), borderColor: "#fff", color: "#fff" } }, "Liste détaillée →"))));
        card("courses", hToMin("10h30"), node, false, { passive: true });
    }
    // Coucher
    card("lit", reveil - 510, hx("div", { className: "fil-card" }, hx("b", null, "Au lit"), hx("span", { className: "sub" }, "Vise 7 h 30 de sommeil pour un réveil à " + hhmm(pr.reveil))), false, { passive: true, late: true });
    items.forEach(it => { it.sort = it.late ? it.t + 1440 : it.t; });
    items.sort((a, b) => a.sort - b.sort);
    const nowK = isToday ? (items.find(it => !it.done && !it.passive) || {}).k : null;
    const todo = items.filter(it => !it.passive), doneN = todo.filter(it => it.done).length;
    // Le coach : 1 à 3 messages selon la journée
    const msgs = [];
    if (isToday) {
        const hr = new Date().getHours(), hello = hr < 12 ? "Bonjour" : hr < 18 ? "Bon après-midi" : "Bonsoir";
        msgs.push({ t: hello + " ! " + (sess ? "Aujourd'hui : séance " + (sess.prog === "maison" ? "Maison " + sess.code : seanceLabel(sess.code)) + " à " + hhmm(creneau.seance) + ", " : "Pas de séance aujourd'hui, ") + menu.dayTgt.toLocaleString("fr-FR") + " kcal à manger." });
        if (RECUP_RES && RECUP_RES.score != null)
            msgs.push({ t: RECUP_RES.advice });
        else if (LEVEL >= 2 && !rl.some(l => l.dateISO === today))
            msgs.push({ t: "Dis-moi d'abord comment tu as dormi : j'adapte ta séance à ta forme." });
        const pain = D.dl.filter(l => l.dateISO <= today && daysBetween(l.dateISO, today) <= 2 && l.intensite >= 4).sort((a, b) => b.intensite - a.intensite)[0];
        if (pain)
            msgs.push({ t: "Ton " + pain.zone.toLowerCase() + " te gêne (" + pain.intensite + "/10) : les exercices concernés sont signalés dans ta séance. Si ça pique, on arrête." });
        // Rythme de perte (niveau 3) : proposition d'ajuster le déficit
        const wi = weighs.map(l => ({ dateISO: l.dateISO, kg: l.weight })), cw = avgRecent(wi, 7);
        const span = wi.length >= 2 ? daysBetween(wi[0].dateISO, wi[wi.length - 1].dateISO) : 0;
        const rate = wi.length >= 3 && span >= 10 ? weeklyRate(wi) : null, pct = rate != null && cw ? rate / cw * 100 : null;
        const cal = normCalCfg(calRaw), cooling = calRaw?.lastAdjust && daysBetween(calRaw.lastAdjust, today) < ADJUST_COOLDOWN;
        const newDef = pct == null || !cal ? null : pct < PACE_MIN ? Math.max(0, cal.deficit - 150) : pct > PACE_SLOW ? Math.min(1000, cal.deficit + 150) : null;
        if (LEVEL >= 3 && newDef != null && !cooling && (pr.coachDismiss || {}).deficit !== today && pr.objectif !== 1)
            msgs.push({ t: (pct < PACE_MIN ? "Tu perds un peu vite (" : "Ta perte est trop lente (") + frN(pct) + " % par semaine). Je passe ton déficit de " + cal.deficit + " à " + newDef + " kcal ?", acts: [["Oui, ajuste", async () => { await save("nutri-cal-cfg", { ...calRaw, deficit: newDef, lastAdjust: today }); toast("Déficit ajusté à " + newDef + " kcal : ton menu suit"); }], ["Pas maintenant", () => setProfile({ ...pr, coachDismiss: { ...(pr.coachDismiss || {}), deficit: today } })]] });
        if (new Date().getDay() === 0) {
            const tr = new Set([...D.sl, ...D.ml].filter(l => withinDays(l.dateISO, 7)).map(l => l.dateISO)).size + D.swl.filter(l => withinDays(l.dateISO, 7)).length;
            const w7 = nLogs.filter(l => withinDays(l.dateISO, 7) && l.mealsTotal > 0), comp = w7.length ? Math.round(w7.reduce((a, l) => a + l.compliance, 0) / w7.length) : null;
            msgs.push({ t: "Ta semaine : " + tr + " séance" + (tr > 1 ? "s" : "") + (comp != null ? ", " + comp + " % des repas suivis" : "") + (weekAgo && lastW ? ", " + sgn(Math.round((lastW - weekAgo) * 10) / 10) + " kg" : "") + ". Bonne nouvelle semaine !" });
        }
        if (!weighs.some(l => withinDays(l.dateISO, 3)))
            msgs.push({ t: "Pense à te peser au réveil : c'est ce qui me permet d'ajuster ton plan." });
    }
    const title = day === 0 ? "Aujourd'hui" : day === -1 ? "Hier" : day === 1 ? "Demain" : fmtDateLong(iso).split(" ")[0];
    const showLvl = LEVEL < 4 && !pr.unlockAll;
    return hx("div", null,
        hx("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
            hx("button", { onClick: () => { setDay(Math.max(-6, day - 1)); setOpen(null); }, disabled: day <= -6, "aria-label": "Jour précédent", className: "fil-nav" }, "‹"),
            hx("div", { style: { textAlign: "center", minWidth: 0 } }, hx("div", { style: { fontFamily: AN, fontSize: 40, lineHeight: .95, textTransform: "uppercase" } }, title), hx("div", { style: { fontSize: 12.5, fontWeight: 800, color: C.textMut } }, fmtDateLong(iso) + (isToday ? " · " + doneN + " sur " + todo.length + " faits" : ""))),
            hx("button", { onClick: () => { setDay(Math.min(6, day + 1)); setOpen(null); }, disabled: day >= 6, "aria-label": "Jour suivant", className: "fil-nav" }, "›")),
        showLvl && hx("button", { onClick: () => setSheet("niveau"), style: { display: "grid", gap: 4, width: "100%", textAlign: "left", border: `2px solid ${C.ink}`, borderRadius: 6, background: C.surface, padding: "8px 12px", marginTop: 12, cursor: "pointer", color: C.ink } },
            hx("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 } }, hx("span", null, "Niveau " + LEVEL + " · " + LEVELS[LEVEL - 1].name), hx("span", null, progress + "/7 jours validés")),
            hx("div", { style: { height: 8, border: `2px solid ${C.ink}`, position: "relative" } }, hx("i", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: progress / 7 * 100 + "%", background: C.sci } }))),
        isToday && hx(BackupReminder, { hasData: D.sl.length + nLogs.length > 0 }),
        msgs.length > 0 && hx("div", { className: "coach" },
            hx("div", { className: "coach-h" }, hx("div", { className: "coach-ava", "aria-hidden": true }, "R"), hx("b", null, "Ton coach")),
            msgs.slice(0, 3).map((m, i) => hx("div", { key: i, className: "coach-msg" }, m.t, m.acts && hx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 } }, m.acts.map(([l, run], j) => hx("button", { key: j, onClick: run, style: PM.mini(j === 0) }, l))))),
            // Les imprévus, en suggestions de réponse
            hx("div", { className: "coach-sugg" }, [["poids", "Je me pèse"], ["extra", "J'ai mangé autre chose"], LEVEL >= 2 && ["depense", "J'ai dépensé"], ["mal", "J'ai mal"], ["progres", "Où j'en suis ?"], ["seance", "Changer de séance"]].filter(Boolean).map(([k, l]) => hx("button", { key: k, onClick: () => { if (k === "progres")
                    setScreen("progres");
                else if (k === "seance")
                    goTo("sport");
                else if (k === "extra" && LEVEL >= 3)
                    goTo("nutrition", "journal");
                else
                    setSheet("q:" + k); } }, l)))),
        day <= 0 ? hx("div", { style: { margin: "14px 0 6px" } },
            hx("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 } }, hx("span", null, eaten.toLocaleString("fr-FR") + " kcal mangées"), hx("span", null, "sur " + menu.dayTgt.toLocaleString("fr-FR") + (menu.swimExtra ? " (natation incluse)" : ""))),
            hx("div", { style: { height: 12, border: `2px solid ${C.ink}`, position: "relative", marginTop: 4 } }, hx("i", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: Math.min(100, eaten / menu.dayTgt * 100) + "%", background: C.green, transition: "width .4s" } })),
            hx("div", { style: { display: "flex", gap: 14, marginTop: 6, fontSize: 12, color: C.textMut } }, [[lx("Protéines", "Prot."), menu.dayMacros.p, C.prot], [lx("Glucides", "Gluc."), menu.dayMacros.g, C.gluc], [lx("Lipides", "Lip."), menu.dayMacros.l, C.lip]].map(([l, v, c]) => hx("span", { key: l, style: { display: "inline-flex", gap: 5, alignItems: "center" } }, hx("i", { style: { width: 9, height: 9, borderRadius: 2, background: c } }), hx("b", { style: { color: C.ink } }, v + " g"), l))))
            : hx("p", { style: { fontSize: 13, color: C.textMut, margin: "14px 0 6px", fontWeight: 600 } }, "Prévu : " + menu.dayTgt.toLocaleString("fr-FR") + " kcal" + (sess ? ", séance " + (sess.prog === "maison" ? "Maison " + sess.code : seanceLabel(sess.code)) : ", jour de repos") + "."),
        hx("div", { style: { marginTop: 8 } }, items.map(it => hx("div", { key: it.k, className: "fil-row" + (it.done ? " done" : it.k === nowK ? " now" : "") }, hx("time", null, String(Math.floor(((it.t % 1440) + 1440) % 1440 / 60)).padStart(2, "0") + ":" + String((((it.t % 1440) + 1440) % 1440) % 60).padStart(2, "0")), hx("div", { className: "fil-rail" }), hx("div", { style: { minWidth: 0 } }, it.node)))),
        typeof sheet === "string" && sheet.startsWith("q:") && hx(QuickSheet, { onClose: () => setSheet(null), goTo, setScreen, initial: sheet.slice(2) }),
        sheet === "niveau" && hx(Sheet, { title: "Mes niveaux", onClose: () => setSheet(null) }, hx(LevelMap, { pr, setProfile, progress })));
}
/* ═══ PROGRÈS : est-ce que ça marche ? ═══ */
function ProgresScreen({ goTo }) {
    const D = useRecoveryData();
    const [fin] = useStored("fin-expenses", []);
    const pr = normProfile(D.profile);
    const wi = D.nl.filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    const latW = wi.length ? wi[wi.length - 1].kg : null, fstW = wi.length ? wi[0].kg : null;
    const w28 = wi.filter(x => withinDays(x.dateISO, 28)), d28 = w28.length >= 2 ? Math.round((w28[w28.length - 1].kg - w28[0].kg) * 10) / 10 : null;
    const cw = avgRecent(wi, 7), span = wi.length >= 2 ? daysBetween(wi[0].dateISO, wi[wi.length - 1].dateISO) : 0;
    const rate = wi.length >= 3 && span >= 10 ? weeklyRate(wi) : null, pct = rate != null && cw ? rate / cw * 100 : null;
    const prog = resolveProgramme(D.profile, D.sl), nDays = programmeDays(prog).length + swimDaysCount(D.models);
    const train7 = new Set([...D.sl, ...D.ml].filter(l => withinDays(l.dateISO, 7)).map(l => l.dateISO)).size + D.swl.filter(l => withinDays(l.dateISO, 7)).length;
    const days7 = Array.from({ length: 7 }, (_, i) => shiftISO(isoToday(), i - 6));
    const comp = days7.map(d => { const n = D.nl.find(l => l.dateISO === d && l.mealsTotal > 0); return n ? n.compliance : 0; });
    const compAvg = Math.round(avgOf(comp));
    const nutriStreak = streakFromDates(D.nl.filter(l => l.compliance >= 80).map(l => l.dateISO));
    const lvlStreak = streakFromDates(days7.concat(Array.from({ length: 53 }, (_, i) => shiftISO(isoToday(), -7 - i))).filter(d => dayValidated(d, { prog, sl: D.sl, ml: D.ml, swl: D.swl, nl: D.nl })));
    // Force : max estimé de chaque exercice, en % de sa première valeur, moyenne par semaine
    const first = {}, weeks = {};
    D.sl.filter(l => !l.deload).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).forEach(l => (l.exercices || []).forEach(e => { if (!(e.weight > 0 && e.reps > 0))
        return; const v = exBest1RM(e); if (!first[e.nom])
        first[e.nom] = v; const wk = mondayOf(l.dateISO); weeks[wk] = weeks[wk] || {}; weeks[wk][e.nom] = Math.max(weeks[wk][e.nom] || 0, v / first[e.nom] * 100); }));
    const force = Object.keys(weeks).sort().slice(-8).map(k => avgOf(Object.values(weeks[k])));
    const forme = Array.from({ length: 14 }, (_, i) => shiftISO(isoToday(), i - 13)).map(d => recoveryFor(d, D)).filter(r => r && r.score != null).map(r => r.score);
    const monday = mondayOf(isoToday());
    const spent = fin.filter(e => e.dateISO >= monday).reduce((a, e) => a + (+e.montant || 0), 0), courses = fin.filter(e => e.dateISO >= monday && e.cat === "Courses").reduce((a, e) => a + (+e.montant || 0), 0);
    const swimW = D.swl.filter(l => l.dateISO >= monday).reduce((a, l) => a + l.distance, 0);
    const verdict = wi.length < 2 ? "Pèse-toi quelques matins : ta courbe et ton rythme s'afficheront ici." : (d28 != null && (pr.objectif === 1 ? d28 >= 0 : d28 <= 0) ? "Ça marche. " : "") + (d28 != null ? sgn(d28) + " kg en 4 semaines" : "") + (pct != null ? (pct < PACE_MIN ? ", un peu rapide" : pct > PACE_SLOW ? ", plutôt lent" : ", pile dans le bon rythme") : "") + ". " + train7 + " séance" + (train7 > 1 ? "s" : "") + " sur " + nDays + " cette semaine.";
    const block = (lab, big, txt, chart, go, key) => hx("div", { key: key || lab, style: { borderTop: `2.5px solid ${C.ink}`, padding: "10px 0 12px", display: "grid", gap: 2 } },
        hx("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } }, hx("span", { style: capS }, lab), go && hx("button", { onClick: go, style: { border: 0, background: "none", fontWeight: 800, fontSize: 12.5, cursor: "pointer", color: C.ink, padding: 0 } }, "Détails →")),
        hx("div", { style: { fontFamily: AN, fontSize: 34, lineHeight: 1 } }, big), hx("span", { style: { fontSize: 13.5, fontWeight: 600 } }, txt), chart);
    return hx("div", null,
        hx("div", { style: scrH }, "Progrès"),
        hx("div", { className: "home-wrow", style: { marginTop: 0 } }, latW ? hx(Odometer, { value: latW.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) : hx("div", { className: "odo" }, "—"),
            hx("div", { className: "home-unit" }, hx("b", null, "KG"), latW && fstW && latW !== fstW && hx("em", { style: { background: (pr.objectif === 1 ? latW >= fstW : latW <= fstW) ? C.green : C.amber } }, sgn(Math.round((latW - fstW) * 10) / 10) + " kg depuis le début"))),
        hx("p", { style: { fontSize: 16.5, fontWeight: 700, lineHeight: 1.35, margin: "12px 0 14px" } }, verdict),
        hx("div", { className: "home-week" }, [[train7 + "/" + nDays, "séances"], [d28 == null ? "—" : sgn(d28), "kg en 4 sem."], [wi.length ? compAvg + " %" : "—", "repas suivis"], [lvlStreak.current + " j", "jours validés de suite"]].map(([v, l]) => hx("div", { key: l }, hx("b", null, v), hx("span", null, l)))),
        hx("div", { style: { marginTop: 14 } },
            block("Corps", latW ? String(latW).replace(".", ",") + " kg" : "—", pct != null ? sgn(pct) + " % par semaine" + (cw ? " · moyenne 7 j " + String(cw).replace(".", ",") + " kg" : "") : "Il faut 3 pesées sur 10 jours pour mesurer ton rythme.", hx(Spark, { vals: wi.slice(-30).map(x => x.kg), color: C.green }), () => goTo("nutrition", "suivi")),
            force.length >= 2 && block("Force", sgn(Math.round(force[force.length - 1] - 100)) + " %", "Tes " + lx("max estimés", "1RM estimés") + " depuis tes premières séances.", hx(Spark, { vals: force, color: C.amber }), () => goTo("sport", tabOk("sport", "rm") ? "rm" : tabOk("sport", "suivi") ? "suivi" : null)),
            LEVEL >= 2 && forme.length >= 2 && block("Forme", forme[forme.length - 1] + "/100", "Ta forme du matin sur 14 jours.", hx(Spark, { vals: forme, color: C.ink }), () => goTo("review", "recup")),
            block("Assiette", compAvg + " %", "des repas suivis ces 7 derniers jours · série : " + nutriStreak.current + " j", hx(Bars, { vals: comp, labels: days7.map(d => DOW_SHORT[new Date(d + "T12:00:00").getDay()][0]), color: C.green }), () => goTo("nutrition", "suivi")),
            LEVEL >= 2 && block("Argent", Math.round(spent) + " €", "dépensés cette semaine" + (courses ? ", dont " + Math.round(courses) + " € de courses" : "") + (pr.budgetSemaine ? " · budget courses " + pr.budgetSemaine + " €" : ""), pr.budgetSemaine ? hx("div", { style: { height: 12, border: `2px solid ${C.ink}`, position: "relative", marginTop: 6 } }, hx("i", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: Math.min(100, courses / pr.budgetSemaine * 100) + "%", background: courses > pr.budgetSemaine ? C.danger : C.budget } })) : null, () => goTo("budget", "suivi")),
            LEVEL >= 2 && D.swl.length > 0 && block("Natation", swimW.toLocaleString("fr-FR") + " m", "nagés cette semaine · " + D.swl.length + " séance" + (D.swl.length > 1 ? "s" : "") + " au total", null, () => goTo("sport", "natation")),
            LEVEL >= 3 && hx("div", { style: { marginTop: 8 } }, hx(ProjectionCard, { weighIns: wi }))));
}
/* ═══ PLAN : les 4 affiches et les réglages ═══ */
function PlanScreen({ goTo, info, setGate }) {
    const [profile, setProfile] = useStored("profil", PROFILE_DEFAULT);
    const [sLogs] = useStored("sport-logs", []);
    const [mLogs] = useStored("maison-logs", []);
    const [swl] = useStored("natation-logs", []);
    const [nl] = useStored("nutri-logs", []);
    const [sheet, setSheet] = useState(null);
    const pr = normProfile(profile), prog = resolveProgramme(profile, sLogs);
    const progress = levelProgress(pr, { prog, sl: sLogs, ml: mLogs, swl, nl });
    const rows = [
        ["Mon entraînement", progInfo(prog).label + " · " + programmeDays(prog).length + " jours par semaine", () => goTo("sport", LEVEL >= 3 ? "programmes" : prog === "maison" ? "maison" : "salle"), 1],
        ["Ma natation", "Séances types, historique, records", () => goTo("sport", "natation"), 2],
        ["Mes repas", "Menu du jour, plats de remplacement", () => goTo("nutrition", "repas"), 1],
        ["Mon objectif", "Calories, protéines, rythme visé", () => goTo("nutrition", "cal"), 1],
        ["Mes courses et mon budget", pr.budgetSemaine ? "Budget courses " + pr.budgetSemaine + " € par semaine" : "Liste de courses, dépenses", () => goTo("budget"), 2],
        ["Mes horaires et rappels", "Réveil " + hhmm(pr.reveil) + " · séance " + hhmm(CRENEAUX[pr.creneau].seance), () => setSheet("horaires"), 1],
        ["Mes niveaux", pr.unlockAll || LEVEL >= 4 ? "Tout est débloqué" : "Niveau " + LEVEL + " · " + progress + "/7 jours", () => setSheet("niveau"), 1],
        ["Lexique", "Les mots techniques en mots simples", () => setSheet("lexique"), 1],
        ["Mes données", "Sauvegarde et restauration", () => setSheet("donnees"), 1],
        ["Refaire le démarrage", "Les 6 questions : nouveau programme et nouvelles cibles", async () => { if (await askConfirm({ title: "Refaire le démarrage ?", message: "Ton programme généré, ta cible calorique et ton niveau seront recalculés. Ton historique est conservé.", confirmLabel: "Recommencer" }))
                setGate("onboard"); }, 1],
    ].filter(r => r[3] <= LEVEL);
    return hx("div", null,
        hx("div", { style: scrH }, "Plan"),
        hx("p", { style: { fontSize: 14, color: C.textMut, margin: "0 0 10px", lineHeight: 1.45 } }, "Les 4 affiches ouvrent tous les écrans détaillés. Les réglages sont en dessous."),
        POSTERS.map(p => { const lock = POSTER_LEVEL[p.id] > LEVEL; return hx("button", { key: p.id, className: "big-band", disabled: lock, onClick: () => goTo(p.id), style: { background: p.c, color: p.fg, opacity: lock ? .45 : 1 } }, hx("b", null, p.name), hx("span", null, lock ? "Niveau " + POSTER_LEVEL[p.id] : info[p.id])); }),
        hx("div", { style: { borderTop: `2.5px solid ${C.ink}`, marginTop: 14 } }, rows.map(([t, d, run]) => hx("button", { key: t, className: "plan-row", onClick: run }, hx("div", null, hx("b", null, t), hx("span", null, d)), hx("em", { style: { fontStyle: "normal", fontWeight: 800 } }, "›")))),
        sheet === "horaires" && hx(Sheet, { title: "Mes horaires", onClose: () => setSheet(null) },
            hx(ProfileCard, { prog, defaultOpen: true }),
            LEVEL >= 2 && hx("div", { style: { margin: "6px 0 12px" } }, hx("div", { style: capS }, "Jour des courses"), hx("div", { style: { display: "flex", gap: 5, marginTop: 6 } }, DOW_ORDER.map(d => hx("button", { key: d, onClick: () => setProfile({ ...pr, coursesJour: d }), style: { ...PM.mini((pr.coursesJour ?? 6) === d), flex: 1, padding: "7px 0" } }, DOW_SHORT[d][0])))),
            hx("button", { onClick: async () => { const r = await shareOrDownload("recomp-routine.ics", buildProfileICS(profile, prog), "text/calendar"); if (r === "shared" || r === "downloaded")
                    toast("📅 Ouvre le fichier pour l'ajouter à ton calendrier"); }, style: PM.btn }, "📅 Ajouter les rappels au calendrier")),
        sheet === "niveau" && hx(Sheet, { title: "Mes niveaux", onClose: () => setSheet(null) }, hx(LevelMap, { pr, setProfile, progress })),
        sheet === "lexique" && hx(Sheet, { title: "Lexique", onClose: () => setSheet(null) }, LEXIQUE.map(([a, b]) => hx("div", { key: a, style: { display: "grid", gridTemplateColumns: "38% 1fr", gap: 10, padding: "9px 0", borderBottom: `1.5px solid ${C.ink}22`, fontSize: 14 } }, hx("span", { style: { fontWeight: 800, color: C.textMut } }, a), hx("b", { style: { fontWeight: 700 } }, b)))),
        sheet === "donnees" && hx(Sheet, { title: "Mes données", onClose: () => setSheet(null) }, hx(DataCard, null)));
}
/* ═══ DÉMARRAGE EN 6 QUESTIONS ═══ */
const ONB_Q = [
    { id: "obj", t: "Ton objectif ?", o: ["Perdre du poids", "Prendre du muscle", "Les deux à la fois", "Être en forme"] },
    { id: "lieux", t: "Où tu t'entraînes ?", multi: true, o: [["salle", "À la salle"], ["maison", "À la maison"], ["piscine", "À la piscine"]] },
    { id: "jours", t: "Combien de jours par semaine ?", o: ["2 jours", "3 jours", "4 jours", "5 jours"] },
    { id: "niv", t: "Ton expérience ?", o: ["Je débute", "J'ai déjà pratiqué", "Je m'entraîne déjà"] },
    { id: "moi", t: "Parle-moi de toi", form: true },
    { id: "budget", t: "Ton budget courses par semaine ?", o: ["40 €", "60 €", "80 €", "100 €"] },
];
function Demarrage({ onDone }) {
    const [q, setQ] = useState(-1);
    const [a, setA] = useState({ obj: null, lieux: [], jours: 3, niv: null, sexe: "Homme", taille: 175, poids: 80, age: 35, budget: null });
    const [busy, setBusy] = useState(false);
    const [restore, setRestore] = useState(false);
    const st = (k, lab, unit, step) => hx("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", borderTop: `2px solid ${C.ink}`, padding: "8px 0", fontWeight: 700 } }, hx("span", null, lab),
        hx("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, hx("button", { onClick: () => setA(x => ({ ...x, [k]: Math.max(1, Math.round((x[k] - step) * 10) / 10) })), "aria-label": "Moins", className: "onb-step" }, "−"), hx("b", { style: { fontFamily: AN, fontWeight: 400, fontSize: 26, minWidth: 92, textAlign: "center" } }, String(a[k]).replace(".", ",") + unit), hx("button", { onClick: () => setA(x => ({ ...x, [k]: Math.round((x[k] + step) * 10) / 10 })), "aria-label": "Plus", className: "onb-step" }, "+")));
    const opt = (label, on, run) => hx("button", { key: label, onClick: run, "aria-pressed": on, className: "onb-opt" }, label);
    const finish = async unlockAll => { setBusy(true); try {
        await applyOnboarding(a, unlockAll);
        toast("Ton plan est prêt");
        onDone();
    }
    catch (e) {
        console.error(e);
        toast("❌ Impossible d'enregistrer, réessaie", { tone: "danger" });
        setBusy(false);
    } };
    let body;
    if (q === -1)
        body = hx(Fragment, null,
            hx("div", { style: { fontFamily: AN, fontSize: "clamp(84px, 27vw, 120px)", lineHeight: .84, margin: "auto 0 10px" } }, "RECOMP"),
            hx("p", { style: { fontSize: 19, fontWeight: 750, lineHeight: 1.3, margin: "0 0 18px" } }, "Ton sport, tes repas et ton budget, organisés heure par heure. Six questions et ton plan est prêt."),
            hx("button", { onClick: () => setQ(0), className: "onb-cta" }, "Commencer"),
            hx("button", { onClick: () => setRestore(!restore), style: { border: 0, background: "none", fontWeight: 800, textDecoration: "underline", marginTop: 14, cursor: "pointer", color: C.ink } }, "J'ai déjà une sauvegarde"),
            restore && hx("div", { style: { marginTop: 10 } }, hx(DataCard, null)));
    else if (q >= ONB_Q.length) {
        const kcalBmr = bmrMifflin(a.poids, a.taille, a.age, a.sexe === "Femme" ? "F" : "H"), act = a.jours >= 4 ? 1.55 : 1.375;
        const kcal = Math.max(kcalBmr, Math.round((kcalBmr * act - [500, -250, 300, 0][a.obj]) / 50) * 50);
        const lieux = a.lieux.length ? a.lieux : ["salle"];
        const progName = lieux.includes("salle") ? buildProgram(a.jours, a.niv === 0).name + " à la salle" : lieux.includes("maison") ? "Circuits à la maison, 4 jours" : "Natation";
        const lines = [["Ton programme", progName + (lieux.includes("piscine") && lieux.length > 1 ? " + 1 séance de natation" : "") + (a.niv === 0 ? ". Premier mois en douceur." : ".")], ["Ta cible", kcal.toLocaleString("fr-FR") + " kcal les jours d'entraînement, un peu moins les jours de repos"], ["Tes courses", "Environ " + Math.min([40, 60, 80, 100][a.budget], Math.round(kcal / 36)) + " € par semaine"], ["Ta journée", "Heure par heure, à partir de demain matin"], ["Ton niveau", "Niveau " + [1, 2, 3][a.niv] + " : " + LEVELS[[1, 2, 3][a.niv] - 1].name + ". Les outils se débloquent au fil des jours."]];
        body = hx(Fragment, null,
            hx("div", { style: capS }, "Ton plan est prêt"),
            hx("div", { style: { fontFamily: AN, fontSize: 64, lineHeight: .88, textTransform: "uppercase", margin: "6px 0 12px" } }, "C'est parti"),
            lines.map(([k, v]) => hx("div", { key: k, style: { borderTop: `2px solid ${C.ink}`, padding: "9px 0" } }, hx("div", { style: capS }, k), hx("b", { style: { fontSize: 16 } }, v))),
            hx("button", { disabled: busy, onClick: () => finish(false), className: "onb-cta", style: { marginTop: 16 } }, busy ? "Préparation…" : "Voir ma journée"),
            hx("button", { disabled: busy, onClick: () => finish(true), style: { border: 0, background: "none", fontWeight: 800, textDecoration: "underline", marginTop: 14, cursor: "pointer", color: C.ink } }, "Je connais déjà tout ça : tout débloquer"),
            hx("button", { onClick: () => setQ(ONB_Q.length - 1), style: { border: 0, background: "none", fontWeight: 700, marginTop: 10, cursor: "pointer", color: C.textMut } }, "‹ Modifier mes réponses"));
    }
    else {
        const Q = ONB_Q[q];
        let inner;
        if (Q.form)
            inner = hx(Fragment, null, hx("div", { style: { display: "flex", gap: 6, marginBottom: 10 } }, ["Homme", "Femme"].map(x => hx("button", { key: x, onClick: () => setA(y => ({ ...y, sexe: x })), style: { ...PM.mini(a.sexe === x), padding: "8px 16px" } }, x))), st("taille", "Taille", " cm", 1), st("poids", "Poids", " kg", .5), st("age", "Âge", " ans", 1), hx("button", { onClick: () => setQ(q + 1), className: "onb-cta", style: { marginTop: 14 } }, "Continuer"));
        else if (Q.multi)
            inner = hx(Fragment, null, Q.o.map(([k, l]) => opt(l, a.lieux.includes(k), () => setA(y => ({ ...y, lieux: y.lieux.includes(k) ? y.lieux.filter(x => x !== k) : [...y.lieux, k] })))), hx("button", { disabled: !a.lieux.length, onClick: () => setQ(q + 1), className: "onb-cta", style: { marginTop: 10, opacity: a.lieux.length ? 1 : .4 } }, "Continuer"));
        else
            inner = Q.o.map((l, i) => opt(l, Q.id === "jours" ? a.jours === i + 2 : a[Q.id] === i, () => { setA(y => ({ ...y, [Q.id]: Q.id === "jours" ? i + 2 : i })); setQ(q + 1); }));
        body = hx(Fragment, null,
            hx("div", { style: { display: "flex", gap: 5 } }, ONB_Q.map((_, i) => hx("i", { key: i, style: { flex: 1, height: 5, borderRadius: 3, background: C.ink, opacity: i <= q ? 1 : .18 } }))),
            hx("div", { style: { ...capS, marginTop: 12 } }, "Question " + (q + 1) + " sur 6" + (Q.multi ? " · plusieurs réponses possibles" : "")),
            hx("div", { style: { fontFamily: AN, fontSize: 46, lineHeight: .92, textTransform: "uppercase", margin: "8px 0 14px" } }, Q.t),
            inner,
            hx("button", { onClick: () => setQ(q - 1), style: { border: 0, background: "none", fontWeight: 700, marginTop: 14, cursor: "pointer", color: C.textMut } }, "‹ Retour"));
    }
    return hx("div", { className: "onb", role: "dialog", "aria-modal": true, "aria-label": "Démarrage" }, hx("div", { className: "onb-in" }, body));
}
/* ═══ BARRE DES 3 BOUTONS ═══ */
const NAV_ICONS = {
    today: () => hx("svg", { viewBox: "0 0 24 24", "aria-hidden": true }, hx("rect", { x: 3, y: 5, width: 18, height: 16, rx: 2, fill: "none", stroke: "currentColor", strokeWidth: 2.4 }), hx("path", { d: "M3 10h18M8 3v4M16 3v4", stroke: "currentColor", strokeWidth: 2.4 })),
    progres: () => hx("svg", { viewBox: "0 0 24 24", "aria-hidden": true }, hx("path", { d: "M3 20l5-7 4 4 8-11", fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" })),
    plan: () => hx("svg", { viewBox: "0 0 24 24", "aria-hidden": true }, hx("path", { d: "M4 7h16M4 12h16M4 17h10", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round" })),
};
function BottomNav({ screen, setScreen }) {
    return hx("nav", { className: "bnav", "aria-label": "Navigation" }, [["today", "Aujourd'hui"], ["progres", "Progrès"], ["plan", "Plan"]].map(([k, l]) => hx("button", { key: k, onClick: () => { setScreen(k); const s = document.querySelector(".shell"); if (s)
            s.scrollTop = 0; }, "aria-current": screen === k }, NAV_ICONS[k](), l)));
}
/* ═══ APP — l'accueil est une affiche, chaque section une affiche de couleur empilée en bas ═══
 * Pile repliée : 4 bandeaux superposés en bas de l'écran (ou une rangée de 4 quand on fait défiler l'accueil).
 * Toucher un bandeau : l'affiche monte et remplit l'écran. Glisser vers le bas / ↓ / retour du téléphone : elle redescend. */
const POSTERS = [
    { id: "sport", name: "Sport", c: C.amber, fg: C.ink, comp: () => SportSection, today: () => TodaySport },
    { id: "nutrition", name: "Nutrition", c: C.green, fg: "#fff", comp: () => NutritionSection, today: () => TodayNutrition },
    { id: "budget", name: "Budget", c: C.budget, fg: "#fff", comp: () => BudgetSection, today: () => TodayBudget },
    { id: "review", name: "Science", c: C.sci, fg: C.ink, comp: () => ScienceSection, today: () => TodayScience },
];
const TAB = 52;
/* Sous-titres des bandeaux, calculés en direct depuis les données */
function usePosterInfo() {
    const [sLogs] = useStored("sport-logs", []);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [nLogs] = useStored("nutri-logs", []);
    const [mens] = useStored("mensurations", []);
    const [h] = useStored("taille-corps", "");
    const [cfg] = useStored("nutri-cal-cfg", null);
    const [fin] = useStored("fin-expenses", []);
    const [swModels] = useStored("natation-modeles", []);
    const [swLogs] = useStored("natation-logs", []);
    const iso = isoToday(), prog = resolveProgramme(profile, sLogs), today = sessionForDate(iso, prog);
    const bt = bodyTargets(nLogs, mens, parseFloat(h) || 0, normCalCfg(cfg));
    const tgt = dayMenu(today ? "training" : "rest", profile, {}, bt, swimKcalOn(swLogs, iso)).dayTgt;
    const swim = swLogs.some(l => l.dateISO === iso) || !!swimPlannedFor(swModels, iso);
    const weigh = nLogs.filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    const rate = weigh.length >= 2 ? weeklyRate(weigh) : null;
    const dep7 = Math.round(fin.filter(e => withinDays(e.dateISO, 7)).reduce((a, e) => a + (+e.montant || 0), 0));
    return {
        sport: today ? today.emoji + " " + today.label + " · " + CRENEAUX[normProfile(profile).creneau].seance + (swim ? " · 🏊" : "") : swim ? "🏊 Natation aujourd'hui" : "Repos aujourd'hui",
        nutrition: tgt.toLocaleString("fr-FR") + " kcal" + (today ? "" : " · repos"),
        budget: dep7 + " € · 7 jours",
        review: RECUP_RES && RECUP_RES.score != null ? "Récup " + RECUP_RES.score + "/100 · " + RECUP_RES.verdict.short : !RECUP_RES ? "Saisie du matin à faire" : rate == null ? "Tendance du poids" : (rate > 0 ? "+" : "") + rate.toLocaleString("fr-FR") + " kg/sem",
    };
}
function App() {
    const [open, setOpen] = useState(null);
    const [shown, setShown] = useState(null);
    const [tabHint, setTabHint] = useState(null);
    const [screen, setScreen] = useState("today");
    const [gate, setGate] = useState("check"); // check → onboard (démarrage) ou ok
    const openRef = useRef(null);
    // Programme actif : appliqué avant tout le reste du rendu (les séances perso remplacent le PPL partout)
    const [progs, , progsReady] = useStored("programmes", []);
    const [profileA, setProfileA, profileReady] = useStored("profil", PROFILE_DEFAULT);
    if (progsReady && profileReady)
        syncPrograms(progs, profileA);
    const prA = normProfile(profileA);
    LEVEL = prA.unlockAll ? 4 : Math.min(4, Math.max(1, prA.niveau || 4));
    // Récupération du matin : lue par le Fil, le bandeau Science et le coach (mode récup automatique sous 50)
    const recupData = useRecoveryData();
    RECUP_RES = recoveryFor(isoToday(), recupData);
    RECUP_TODAY = RECUP_RES ? RECUP_RES.score : null;
    const info = usePosterInfo();
    // Premier lancement : démarrage en 6 questions, sauf si des données existent déjà (utilisateur d'origine : tout débloqué)
    useEffect(() => { Promise.all([load("profil", null), load("sport-logs", []), load("nutri-logs", []), load("maison-logs", [])]).then(async ([p, s, n, m]) => { const pr = normProfile(p); if (pr.onboarded)
        return setGate("ok"); if ((s || []).length + (n || []).length + (m || []).length > 0) {
        await save("profil", { ...pr, onboarded: true, owner: true, niveau: 4, unlockAll: true, levelSince: isoToday() });
        return setGate("ok");
    } setGate("onboard"); }); }, []);
    // Passage de niveau : 7 journées validées depuis le début du niveau en cours
    const lvlUp = gate === "ok" && !prA.unlockAll && LEVEL < 4 && levelProgress(prA, { prog: resolveProgramme(profileA, recupData.sl), sl: recupData.sl, ml: recupData.ml, swl: recupData.swl, nl: recupData.nl }) >= 7 ? LEVELS[LEVEL] : null;
    // Le bouton « retour » du téléphone referme l'affiche ouverte
    useEffect(() => { const onPop = () => { if (openRef.current)
        shut(); }; window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
    const shut = () => { const closing = openRef.current; openRef.current = null; setOpen(null); setTimeout(() => { if (openRef.current !== closing)
        setShown(s => s === closing ? null : s); }, 650); };
    const [nonce, setNonce] = useState(0);
    const goTo = (id, tab) => { setTabHint(tab || null); setNonce(x => x + 1); setShown(id); setOpen(id); openRef.current = id; if (tab)
        setTimeout(() => { const sc = document.querySelector(".pst.open .pst-scroll"), sh = sc?.querySelector(".pst-body"); if (sc && sh)
            sc.scrollTo({ top: sh.offsetTop - 8, behavior: "smooth" }); }, 750); try {
        history.pushState({ poster: id }, "");
    }
    catch (e) { } };
    const close = () => { try {
        if (history.state && history.state.poster) {
            history.back();
            return;
        }
    }
    catch (e) { } shut(); };
    // Glisser vers le bas sur l'en-tête d'une affiche ouverte = la replier
    const drag = useRef(null);
    return React.createElement("div", { className: "app" + (open ? " has-open" : "") },
        React.createElement("div", { className: "shell", "aria-hidden": !!open },
            React.createElement("div", { className: "shell-in" }, gate === "ok" && React.createElement(ErrorBoundary, null, screen === "today" ? React.createElement(FilScreen, { goTo, setScreen }) : screen === "progres" ? React.createElement(ProgresScreen, { goTo }) : React.createElement(PlanScreen, { goTo, info, setGate })))),
        gate === "ok" && React.createElement(BottomNav, { screen, setScreen }),
        // Les 4 affiches de couleur : cachées sous l'écran, elles montent quand on les ouvre (Plan, cartes du Fil)
        POSTERS.map((p, i) => React.createElement("section", { key: p.id, className: "pst" + (open === p.id ? " open" : ""), "aria-hidden": open !== p.id, style: { background: p.c, color: p.fg, zIndex: open === p.id ? 60 : 20 + i, left: 0, width: "100%", transform: open === p.id ? "translateY(0)" : "translateY(110%)" } },
            React.createElement("button", { className: "pst-tab", "aria-expanded": open === p.id, onClick: () => open === p.id ? close() : goTo(p.id),
                onPointerDown: e => { drag.current = open === p.id ? e.clientY : null; },
                onPointerUp: e => { if (drag.current != null && e.clientY - drag.current > 50)
                    close(); drag.current = null; } },
                React.createElement("b", { className: "pst-name" }, p.name),
                React.createElement("span", { className: "pst-sub" }, info[p.id]),
                open === p.id && React.createElement("span", { className: "pst-close", "aria-hidden": true }, "↓")),
            // Ouverte : l'affiche du jour (cases à cocher), puis la feuille avec tous les onglets du niveau
            shown === p.id && React.createElement("div", { className: "pst-scroll" },
                React.createElement(ErrorBoundary, null, React.createElement(p.today(), { fg: p.fg, bg: p.c, goTab: t => { setTabHint(t); setNonce(x => x + 1); setTimeout(() => { const sc = document.querySelector(".pst.open .pst-scroll"), sh = sc?.querySelector(".pst-body"); if (sc && sh)
                            sc.scrollTo({ top: sh.offsetTop - 8, behavior: "smooth" }); }, 60); } })),
                React.createElement("div", { className: "pst-body" }, React.createElement(ErrorBoundary, null, React.createElement(p.comp(), { key: nonce, initialTab: tabHint })))),
            open === p.id && p.id === "sport" && React.createElement(PosterRest, { color: p.c }))),
        lvlUp && React.createElement("div", { className: "lvlup", role: "dialog", "aria-modal": true, "aria-label": "Nouveau niveau" },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" } }, "Niveau " + lvlUp.n + " débloqué · " + lvlUp.name),
            React.createElement("div", { style: { fontFamily: AN, fontSize: "clamp(52px, 16vw, 76px)", lineHeight: .9, textTransform: "uppercase" } }, lvlUp.unlock[0]),
            React.createElement("p", { style: { fontSize: 17, fontWeight: 700, lineHeight: 1.4, margin: 0 } }, lvlUp.unlock[1]),
            React.createElement("ul", { style: { margin: 0, paddingLeft: 20, fontSize: 15, fontWeight: 600, lineHeight: 1.6 } }, lvlUp.items.map(x => React.createElement("li", { key: x }, x))),
            React.createElement("button", { onClick: () => setProfileA({ ...prA, niveau: lvlUp.n, levelSince: isoToday() }), className: "onb-cta" }, "Compris")),
        gate === "onboard" && React.createElement(Demarrage, { onDone: () => { setGate("ok"); setScreen("today"); } }),
        React.createElement(ConfirmHost, null),
        React.createElement(ToastHost, null));
}
/* ═══ FILET DE SÉCURITÉ — une erreur d'affichage ne vide plus tout l'écran ═══ */
class ErrorBoundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err, info) { console.error("RECOMP crash", err, info); }
    render() {
        if (!this.state.err)
            return this.props.children;
        return React.createElement("div", { style: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", background: C.bg, color: C.text } },
            React.createElement("div", { style: { fontSize: 40 } }, "⚠️"),
            React.createElement("div", null, "Un problème d'affichage est survenu.", React.createElement("br"), "Tes données sont intactes."),
            React.createElement("div", { style: { fontSize: 11, color: C.textDim } }, String(this.state.err && this.state.err.message || this.state.err)),
            React.createElement("button", { onClick: () => this.setState({ err: null }), style: { padding: "12px 22px", borderRadius: 12, border: "none", background: C.green, color: "#04140a", fontWeight: 800, fontSize: 15 } }, "Réessayer"));
    }
}
// Le programme actif est chargé avant le premier affichage : pas de passage furtif par le PPL
Promise.all([load("programmes", []), load("profil", PROFILE_DEFAULT)]).then(([p, pr]) => syncPrograms(p, pr)).catch(() => { }).finally(() => ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(ErrorBoundary, null, React.createElement(App))));

