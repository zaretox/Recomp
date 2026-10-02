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
const C = {
    bg: "#060806", surface: "#0E120E", surfaceAlt: "#141A14",
    border: "#1E2A1E", borderSoft: "#1A201A",
    text: "#E8EDE8", textMut: "#8A9A8A", textDim: "#5A6A5A",
    amber: "#F59E0B", amberLight: "#FBBF24", amberDim: "#92610A",
    green: "#10B981", greenLight: "#34D399", greenDim: "#0A7B55",
    prot: "#818CF8", gluc: "#FBBF24", lip: "#34D399",
    danger: "#EF6B5C", blue: "#3B82F6", blueLight: "#60A5FA", pink: "#EC4899", purple: "#8B5CF6",
    budget: "#8B5CF6", budgetLight: "#A78BFA",
};
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
const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: 14, boxSizing: "border-box" };
function Pill({ children, active, onClick, color }) { return React.createElement("button", { onClick: onClick, style: { padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", background: active ? (color || C.amber) : C.surfaceAlt, color: active ? (color ? "#fff" : "#1A1505") : C.textMut } }, children); }
function Card({ children, style, border }) { return React.createElement("div", { style: { background: C.surface, border: `1px solid ${border || C.border}`, borderRadius: 14, padding: 14, marginBottom: 10, ...style } }, children); }
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
    const col = req.danger ? C.danger : C.green;
    return React.createElement("div", { onClick: () => close(false), style: { position: "fixed", inset: 0, background: "#000000B3", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))", animation: "rcFade .15s ease-out" } },
        React.createElement("div", { onClick: e => e.stopPropagation(), role: "dialog", "aria-modal": true, style: { width: "100%", maxWidth: 420, background: C.surface, border: `1px solid ${col}55`, borderRadius: 18, padding: 18, boxShadow: "0 20px 60px #000", animation: "rcUp .2s ease-out" } },
            React.createElement("div", { style: { fontSize: 16, fontWeight: 800, marginBottom: 6 } }, req.title || "Confirmer"),
            req.message && React.createElement("div", { style: { fontSize: 12.5, color: C.textMut, lineHeight: 1.5, marginBottom: 16 } }, req.message),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement("button", { onClick: () => close(false), style: { flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 14, fontWeight: 700, cursor: "pointer" } }, req.cancelLabel || "Annuler"),
                React.createElement("button", { autoFocus: true, onClick: () => close(true), style: { flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: col, color: req.danger ? "#fff" : "#04130B", fontSize: 14, fontWeight: 800, cursor: "pointer" } }, req.confirmLabel || "Confirmer"))));
}
function ToastHost() {
    const [items, setItems] = useState([]);
    useEffect(() => bus.on("toast", t => { setItems(a => [...a.slice(-2), t]); setTimeout(() => setItems(a => a.filter(x => x.id !== t.id)), t.undo ? 6000 : 3000); }), []);
    if (!items.length)
        return null;
    return React.createElement("div", { style: { position: "fixed", left: 0, right: 0, bottom: "calc(78px + env(safe-area-inset-bottom, 0px))", zIndex: 9000, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 14px", pointerEvents: "none" } }, items.map(t => React.createElement("div", { key: t.id, style: { pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12, maxWidth: 420, width: "100%", background: "#1B231B", border: `1px solid ${t.tone === "danger" ? C.danger : C.border}`, borderRadius: 12, padding: "10px 12px", boxShadow: "0 8px 30px #000a", animation: "rcUp .2s ease-out" } },
        React.createElement("span", { style: { flex: 1, fontSize: 12.5, color: C.text } }, t.msg),
        t.undo && React.createElement("button", { onClick: () => { setItems(a => a.filter(x => x.id !== t.id)); t.undo(); }, style: { border: "none", background: "transparent", color: C.amberLight, fontWeight: 800, fontSize: 13, cursor: "pointer", padding: "2px 4px" } }, "Annuler"))));
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
const phases = [{ ph: "Phase 1", sem: "S1-4", pct: "~45%", but: "Réapprentissage moteur · tendons", c: "#818CF8" }, { ph: "Phase 2", sem: "S5-8", pct: "~58%", but: "Montée progressive", c: C.blue }, { ph: "Phase 3", sem: "S9-12", pct: "~70%", but: "Charge de travail", c: C.amber }, { ph: "Phase 4", sem: "S13-16+", pct: "~80%", but: "Objectif de reprise atteint", c: C.green }];
const salleSeances = [
    { id: "Push", jour: "Lun", couleur: "#818CF8", emoji: "💪", focus: "Pecs · Épaules · Triceps", finisher: "🛷 Traîneau (poussée) 6×20 m · repos 60 s", exercices: [{ nom: "DC haltères", detail: "4×8-10", charges: ["20kg", "26kg", "32kg", "36kg"], note: "Par haltère. Ancien niveau retrouvé vers oct." }, { nom: "DI haltères", detail: "4×10-12", charges: ["16kg", "22kg", "26kg", "30kg"], note: "" }, { nom: "Poulie basse (pecs)", detail: "4×12-15", charges: ["14kg", "18kg", "21kg", "24kg"], note: "Pic de contraction 2 s en haut" }, { nom: "Élévations lat.", detail: "4×12-15", charges: ["5kg", "6kg", "8kg", "10kg"], note: "Deltoïde latéral (largeur)" }, { nom: "Triceps poulie", detail: "3×12-15", charges: ["16kg", "20kg", "24kg", "28kg"], note: "" }] },
    { id: "Pull", jour: "Mar", couleur: C.purple, emoji: "🏋️", focus: "Dos · Trapèzes · Biceps · Arrière d'épaule", finisher: "", exercices: [{ nom: "Tirage vertical", detail: "4×8-10", charges: ["40kg", "52kg", "62kg", "72kg"], note: "Remplace les tractions tant que le poids de corps est élevé" }, { nom: "Tirage bûcheron", detail: "4×8-10/bras", charges: ["22kg", "30kg", "35kg", "40kg"], note: "Buste calé, unilatéral" }, { nom: "Rack pull", detail: "4×6-8", charges: ["90kg", "115kg", "140kg", "160kg"], note: "Prise + lombaires : progressif. Sangles dès S5. Objectif 200kg vers nov." }, { nom: "Écarté inversé poulie", detail: "3×15-20", charges: ["7kg", "10kg", "12kg", "14kg"], note: "Arrière d'épaule (allongé au banc)" }, { nom: "Tirage araignée", detail: "2×15", charges: ["6kg", "7kg", "8kg", "10kg"], note: "À plat ventre, épaules relâchées" }, { nom: "Curl biceps", detail: "3×10-12", charges: ["7kg", "9kg", "11kg", "13kg"], note: "" }] },
    { id: "Legs", jour: "Mer", couleur: C.blue, emoji: "🦵", focus: "Quadri · Ischios · Mollets", finisher: "", exercices: [{ nom: "Presse à cuisses", detail: "4×10-12", charges: ["145kg", "185kg", "225kg", "255kg"], note: "Pied droit · amplitude contrôlée" }, { nom: "Hack squat", detail: "4×8-10", charges: ["65kg", "80kg", "100kg", "112kg"], note: "Genou : descente maîtrisée" }, { nom: "RDL", detail: "4×8-10", charges: ["65kg", "80kg", "100kg", "112kg"], note: "Tension ischios, dos neutre" }, { nom: "Leg curl", detail: "3×12-15", charges: ["27kg", "35kg", "42kg", "48kg"], note: "" }, { nom: "Mollets debout", detail: "6×15-20", charges: ["50kg", "65kg", "75kg", "88kg"], note: "Pied droit" }] },
    { id: "Upper", jour: "Ven", couleur: C.pink, emoji: "🔼", focus: "Haut du corps · Lourd (5-8)", finisher: "🚶 Farmer's walk 4×40 m + 🪢 battle ropes 6×30 s (ou traîneau)", exercices: [{ nom: "DC haltères neutre", detail: "4×6-8", charges: ["20kg", "26kg", "32kg", "37kg"], note: "Par haltère · prise neutre (épaule)" }, { nom: "Tirage bûcheron", detail: "4×8-10", charges: ["23kg", "30kg", "36kg", "42kg"], note: "Version lourde" }, { nom: "DM haltères", detail: "4×6-8", charges: ["12kg", "15kg", "18kg", "21kg"], note: "Développé épaules" }, { nom: "Élévations lat.", detail: "3×15-20", charges: ["5kg", "6kg", "8kg", "10kg"], note: "" }, { nom: "Curl marteau", detail: "3×8-10", charges: ["7kg", "9kg", "11kg", "13kg"], note: "" }, { nom: "Ext. triceps", detail: "3×8-10", charges: ["12kg", "16kg", "19kg", "22kg"], note: "" }] },
    { id: "Lower", jour: "Sam", couleur: C.green, emoji: "🔽", focus: "Fessiers · Quadri · Ischios · Lourd", finisher: "🛷 Traîneau arrière 5×20 m · léger (protège le genou)", exercices: [{ nom: "Hip thrust", detail: "4×8-10", charges: ["90kg", "115kg", "140kg", "160kg"], note: "Descente contrôlée" }, { nom: "Presse lourde", detail: "4×8-10", charges: ["155kg", "195kg", "240kg", "270kg"], note: "Pied droit" }, { nom: "Leg extension", detail: "4×10-12", charges: ["36kg", "46kg", "56kg", "64kg"], note: "Genou : sans à-coups, pas de blocage sec" }, { nom: "Leg curl assis", detail: "3×10-12", charges: ["27kg", "35kg", "42kg", "48kg"], note: "" }, { nom: "Abduction hanche", detail: "2×15-20", charges: ["32kg", "40kg", "48kg", "56kg"], note: "Fessiers" }, { nom: "Mollets assis", detail: "6×12-15", charges: ["27kg", "35kg", "42kg", "48kg"], note: "" }] },
];
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
/* "auto" : salle dès qu'une séance salle a été enregistrée ces 21 derniers jours, sinon maison */
function resolveProgramme(profile, sportLogs) { const p = normProfile(profile).programme; if (p !== "auto")
    return p; return (sportLogs || []).some(l => withinDays(l.dateISO, 21)) ? "salle" : "maison"; }
function programmeDays(prog) { return Object.keys(PROGRAMMES[prog].days).map(Number); }
/* Séance prévue à une date donnée (null = jour de repos) */
function sessionForDate(iso, prog) {
    const code = PROGRAMMES[prog].days[new Date(iso + "T12:00:00").getDay()];
    if (!code)
        return null;
    if (prog === "maison") {
        const s = maison.find(x => x.code === code);
        return { prog, code, emoji: "🏠", label: "Maison " + code, titre: s?.titre || "" };
    }
    const s = salleSeances.find(x => x.id === code);
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
        [0, 0.25, 0.5, 0.75, 1].map((f, i) => { const y = plotBot - f * plotH; return React.createElement("line", { key: i, x1: ml, y1: y, x2: W - mr, y2: y, stroke: "#1E2A1E", strokeWidth: 1 }); }),
        data.map((d, i) => {
            const v = +(d[dataKey] || 0);
            const bh = v / max * plotH;
            const cx = ml + slot * i + slot / 2;
            return React.createElement("g", { key: i },
                React.createElement("rect", { x: cx - bw / 2, y: plotBot - bh, width: bw, height: Math.max(bh, 0), fill: color, rx: 3, opacity: 0.9 }),
                React.createElement("text", { x: cx, y: plotBot - bh - 6, textAnchor: "middle", fontSize: 12, fill: color, fontWeight: "bold" },
                    v,
                    unit),
                (i % step === 0 || i === n - 1) && React.createElement("text", { x: cx, y: height - 8, textAnchor: "middle", fontSize: 11, fill: "#7A8A7A" }, _shortDate(d.date)));
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
        [0, 0.5, 1].map((f, i) => { const y = plotBot - f * plotH; return React.createElement("line", { key: i, x1: ml, y1: y, x2: W - mr, y2: y, stroke: "#1E2A1E", strokeWidth: 1 }); }),
        React.createElement("polygon", { points: `${ml},${plotBot} ${pts} ${toX(n - 1)},${plotBot}`, fill: color + "18" }),
        React.createElement("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        data.map((d, i) => React.createElement("circle", { key: i, cx: toX(i), cy: toY(+(d[dataKey] || 0)), r: 3.5, fill: color })),
        data.map((d, i) => (i % step === 0 || i === n - 1) ? React.createElement("text", { key: "x" + i, x: toX(i), y: height - 8, textAnchor: "middle", fontSize: 11, fill: "#7A8A7A" }, _shortDate(d.date)) : null),
        React.createElement("text", { x: ml, y: mt - 8, fontSize: 11, fill: color, fontWeight: "bold" },
            flat ? vals[0] : Math.round(max * 10) / 10,
            unit),
        !flat && React.createElement("text", { x: W - mr, y: mt - 8, textAnchor: "end", fontSize: 10, fill: "#7A8A7A" },
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
            React.createElement("input", { type: "date", value: value, max: today, onChange: e => e.target.value && onChange(e.target.value), style: { ...inputStyle, fontSize: 12, padding: "7px 9px", colorScheme: "dark", flex: 1 } }),
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
function painFor(nom, pains) { const mu = muscleMap[nom]; return Object.entries(pains).filter(([z]) => (PAIN_IMPACT[z] || []).includes(mu)).map(([z, v]) => ({ zone: z, ...v })); }
/* Valeurs proposées pour un exercice : ajustement Science > suggestion coach > cible de phase, puis −40 % en décharge */
function suggestFor(logs, seanceId, ex, phaseIdx, sci) {
    const d = parseDetail(ex.detail), ov = sci?.weightOverrides?.[seanceId + ":" + ex.nom], last = lastExerciseLog(logs, seanceId, ex.nom);
    let weight = null, reps = d ? d.reps : null, src = "phase";
    if (ov) {
        weight = ov;
        src = "science";
    }
    else if (last) {
        const p = progressFor(seanceId, last, sci?.recovery);
        weight = p.weight;
        reps = p.reps || reps;
        src = "coach";
    }
    else
        weight = parseTargetKg(ex.charges[phaseIdx]);
    if (sci?.deload && weight)
        weight = Math.round(weight * 0.6 * 2) / 2;
    return { weight, sets: d ? d.sets : null, reps, src };
}
function SuiviSport() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sel, setSel] = useState("Push");
    const [form, setForm] = useState({});
    const [chartSel, setChartSel] = useState("Push");
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
    // Proposer automatiquement la séance prévue ce jour-là (programme salle)
    useEffect(() => { const s = sessionForDate(selDate, "salle"); if (s && !logs.some(l => l.dateISO === selDate && l.seance === sel))
        setSel(s.code); }, [selDate]);
    const se = salleSeances.find(s => s.id === sel);
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
            : (() => { const cfg = { ok: { c: C.green, e: "🟢", t: "Pas de décharge nécessaire", s: "Tes indicateurs sont bons — continue la progression." }, watch: { c: C.gluc, e: "🟠", t: "Vigilance — léger signe de fatigue", s: "Pas indispensable, mais surveille les prochaines séances." }, deload: { c: "#818CF8", e: "🪶", t: "Semaine de décharge recommandée", s: "Réduis les charges ~40-50 % pendant une semaine, en gardant le volume." } }[advice.level]; return React.createElement(Card, { border: cfg.c, style: { background: `linear-gradient(135deg,${cfg.c}1A,${C.surface})` } },
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
            React.createElement("button", { onClick: toggleDeload, style: { width: "100%", padding: "9px 0", borderRadius: 10, border: `1px solid ${deloadDay ? "#818CF8" : C.border}`, background: deloadDay ? "#818CF822" : "transparent", color: deloadDay ? "#A5B4FC" : C.textMut, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: deloadDay ? 6 : 10 } },
                "🪶 Semaine de décharge ",
                deloadDay ? "✓" : ""),
            deloadDay && React.createElement("div", { style: { fontSize: 10, color: "#A5B4FC", marginBottom: 10 } }, "Charges réduites de 40 %, volume maintenu. Réglage partagé avec l'onglet Salle et Science. Les PR ne sont pas comptabilisés."),
            React.createElement(RestTimer, { color: C.amber, recovery: !!sci.recovery }),
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
                            sci.weightOverrides?.[sel + ":" + ex.nom] ? sci.weightOverrides[sel + ":" + ex.nom] + "kg 🔬" : ex.charges[selPhase]),
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
                        (openAlt[i] ?? painFor(ex.nom, pains).length > 0) &&React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 } }, substitutions[ex.nom].map((a, ai) => React.createElement("span", { key: ai, style: { fontSize: 10, background: C.danger + "12", border: `1px solid ${C.danger}33`, color: "#E0A0A0", borderRadius: 8, padding: "3px 8px" } }, a)))))),
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
                        l.deload && React.createElement("span", { style: { fontSize: 9, fontWeight: 700, color: "#A5B4FC", background: "#818CF822", borderRadius: 5, padding: "2px 6px", marginLeft: 6 } }, "🪶 Décharge"),
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
        [0, 0.5, 1].map((f, i) => { const y = plotBot - f * plotH; return React.createElement("line", { key: i, x1: ml, y1: y, x2: W - mr, y2: y, stroke: "#1E2A1E", strokeWidth: 1 }); }),
        React.createElement("polyline", { points: ptsRaw, fill: "none", stroke: C.greenLight, strokeWidth: 1.5, strokeDasharray: "4 3", opacity: 0.5 }),
        data.map((d, i) => React.createElement("circle", { key: i, cx: toX(i), cy: toY(d.kg), r: 2.5, fill: C.greenLight, opacity: 0.5 })),
        React.createElement("polyline", { points: ptsAvg, fill: "none", stroke: C.green, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        data.map((d, i) => React.createElement("circle", { key: "a" + i, cx: toX(i), cy: toY(d.avg), r: 3.5, fill: C.green })),
        data.map((d, i) => (i % step === 0 || i === n - 1) ? React.createElement("text", { key: "x" + i, x: toX(i), y: height - 8, textAnchor: "middle", fontSize: 10, fill: "#7A8A7A" }, (d.date || "").split("/").slice(0, 2).join("/")) : null),
        React.createElement("text", { x: ml, y: mt - 8, fontSize: 11, fill: C.green, fontWeight: "bold" },
            Math.round(max * 10) / 10,
            "kg"),
        React.createElement("text", { x: W - mr, y: mt - 8, textAnchor: "end", fontSize: 10, fill: "#7A8A7A" },
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
                    React.createElement("input", { type: "date", value: pDate, max: isoToday(), onChange: e => e.target.value && setPDate(e.target.value), style: { ...inputStyle, width: 150, padding: "6px 8px", fontSize: 12, colorScheme: "dark" } })),
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
                React.createElement(Card, { border: "#818CF833" },
                    React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, lineHeight: 1.6 } },
                        "⚠️ Progression volontairement ",
                        React.createElement("b", { style: { color: C.text } }, "prudente"),
                        " : ta mémoire musculaire revient vite, mais les tendons (genou/pied) suivent plus lentement. Intègre une ",
                        React.createElement("b", { style: { color: "#A5B4FC" } }, "semaine de décharge"),
                        " toutes les ~6 sem. (voir l'analyse de décharge). Si une charge sort à RPE 9-10 trop tôt, reste dessus une semaine de plus avant de monter.")))
                : React.createElement(Card, null,
                    React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 12 } }, "Enregistre au moins une séance avec cet exercice (charge + reps) pour générer un plan."))));
}
/* ═══ COACH (volume/muscle · auto-progression · gate maison→salle) ═══ */
const muscleLandmarks = { Pecs: { mev: 10, mav: 22 }, Dos: { mev: 10, mav: 22 }, "Épaules": { mev: 8, mav: 22 }, Biceps: { mev: 6, mav: 16 }, Triceps: { mev: 6, mav: 16 }, Quadriceps: { mev: 8, mav: 20 }, Ischios: { mev: 8, mav: 18 }, Fessiers: { mev: 6, mav: 18 }, Mollets: { mev: 8, mav: 16 } };
const muscleMap = { "DC haltères": "Pecs", "DC haltères neutre": "Pecs", "DI haltères": "Pecs", "Poulie basse (pecs)": "Pecs", "Tirage vertical": "Dos", "Tirage bûcheron": "Dos", "Rack pull": "Dos", "Élévations lat.": "Épaules", "Écarté inversé poulie": "Épaules", "Tirage araignée": "Épaules", "DM haltères": "Épaules", "Triceps poulie": "Triceps", "Ext. triceps": "Triceps", "Curl biceps": "Biceps", "Curl marteau": "Biceps", "Presse à cuisses": "Quadriceps", "Hack squat": "Quadriceps", "Presse lourde": "Quadriceps", "Leg extension": "Quadriceps", "RDL": "Ischios", "Leg curl": "Ischios", "Leg curl assis": "Ischios", "Hip thrust": "Fessiers", "Abduction hanche": "Fessiers", "Mollets debout": "Mollets", "Mollets assis": "Mollets" };
const muscleOrder = ["Pecs", "Dos", "Épaules", "Biceps", "Triceps", "Quadriceps", "Ischios", "Fessiers", "Mollets"];
function weeklyMuscleVolume(logs, days) { const c = new Date(); c.setDate(c.getDate() - (days || 7)); const r = (logs || []).filter(l => !l.deload && new Date(l.dateISO + "T12:00:00") >= c); const v = {}; r.forEach(l => (l.exercices || []).forEach(e => { const m = muscleMap[e.nom]; if (m && e.sets > 0 && e.weight > 0)
    v[m] = (v[m] || 0) + e.sets; })); return v; }
function parseRepRange(detail) { const d = String(detail || ""); if (/\ds\s*$/.test(d.trim()) || /\d\s*s\b/.test(d))
    return null; const m = d.match(/(\d+)\s*[×xX]\s*(\d+)(?:\s*[-–]\s*(\d+))?/); if (!m)
    return null; return { sets: +m[1], lo: +m[2], hi: m[3] ? +m[3] : +m[2] }; }
/* ═══ MOTEUR DE PROGRESSION UNIQUE (Coach, Log « ✨ Pré-remplir », Science « Surcharge ») ═══
 * Double progression : tu montes la charge quand TOUTES les séries atteignent le haut de la
 * fourchette à RPE ≤ 8 ; sinon +1 rep ; RPE ≥ 9,5 ou sous le bas de fourchette = consolider. */
const loadIncrement = nom => ["Quadriceps", "Ischios", "Fessiers"].includes(muscleMap[nom]) ? 5 : 2.5;
/* Reps « limitantes » : la plus faible des séries à la charge max quand le détail existe */
const effReps = e => e.setsDetail?.length ? Math.min(...e.setsDetail.filter(s => s.w === e.weight).map(s => s.r)) : e.reps;
function lastExerciseLog(logs, seanceId, nom) {
    const l = (logs || []).filter(x => !x.deload && x.seance === seanceId && (x.exercices || []).some(e => e.nom === nom && e.weight > 0)).sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
    return l ? { ...l.exercices.find(e => e.nom === nom), date: l.date, dateISO: l.dateISO } : null;
}
function progressFor(seanceId, e, recovery) {
    const prog = salleSeances.find(s => s.id === seanceId)?.exercices.find(x => x.nom === e.nom);
    const rr = prog ? parseRepRange(prog.detail) : null, inc = loadIncrement(e.nom), reps = effReps(e);
    if (recovery)
        return { action: "hold", weight: e.weight, reps, txt: "mode récup : garde " + e.weight + " kg" };
    if (!rr)
        return { action: "keep", weight: e.weight, reps, txt: "garde " + e.weight + " kg" };
    if (reps >= rr.hi && (!e.rpe || e.rpe <= 8))
        return { action: "up", weight: e.weight + inc, reps: rr.lo, txt: "+" + inc + " kg → " + (e.weight + inc) + " kg × " + rr.lo };
    if (e.rpe >= 9.5 || reps < rr.lo)
        return { action: "hold", weight: e.weight, reps: Math.max(reps, rr.lo), txt: "reste à " + e.weight + " kg (consolide)" };
    return { action: "reps", weight: e.weight, reps: reps + 1, txt: "garde " + e.weight + " kg, vise " + (reps + 1) + " reps" };
}
/* Suggestions pour la PROCHAINE séance salle prévue (ou la dernière faite à défaut) */
function nextSuggestions(logs, recovery) {
    const nonD = (logs || []).filter(l => !l.deload);
    if (!nonD.length)
        return null;
    let seanceId = null, when = null;
    for (let d = 0; d < 7 && !seanceId; d++) {
        const iso = shiftISO(isoToday(), d), s = sessionForDate(iso, "salle");
        if (s && nonD.some(l => l.seance === s.code) && !(d === 0 && nonD.some(l => l.dateISO === iso && l.seance === s.code))) {
            seanceId = s.code;
            when = d === 0 ? "aujourd'hui" : d === 1 ? "demain" : fmtDateLong(iso);
        }
    }
    if (!seanceId)
        seanceId = [...nonD].sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0].seance;
    const seance = salleSeances.find(s => s.id === seanceId);
    if (!seance)
        return null;
    const sugg = seance.exercices.map(ex => { const e = lastExerciseLog(logs, seanceId, ex.nom); if (!e)
        return null; const p = progressFor(seanceId, e, recovery); return { nom: e.nom, action: p.action, txt: p.txt, last: (e.setsDetail?.length ? fmtSets(e) : e.reps + "×" + e.weight + "kg") + (e.rpe ? " @RPE" + e.rpe : "") + " · " + e.date }; }).filter(Boolean);
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
    const sugg = nextSuggestions(sLogs, !!sci.recovery);
    const gate = maisonGate(mLogs, dLogs);
    const prog = resolveProgramme(profile, sLogs);
    if (loading)
        return React.createElement("div", { style: { color: C.textMut, padding: 20 } }, "Chargement…");
    const actionCfg = { up: { c: C.green, e: "⬆️" }, reps: { c: A, e: "🔁" }, hold: { c: C.gluc, e: "⏸️" }, keep: { c: C.textMut, e: "✓" } };
    return React.createElement("div", null,
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
        React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, padding: "2px 4px 0", lineHeight: 1.5 } }, "Double progression : tu montes la charge quand tu atteins le haut de la fourchette à RPE ≤ 8. Sinon tu consolides."));
}
const reposMap = { "Push:DC haltères": "2 min", "Push:DI haltères": "90 s", "Push:Poulie basse (pecs)": "60 s", "Push:Élévations lat.": "60 s", "Push:Triceps poulie": "60 s", "Pull:Tirage vertical": "2 min", "Pull:Tirage bûcheron": "90 s", "Pull:Rack pull": "3 min", "Pull:Écarté inversé poulie": "60 s", "Pull:Tirage araignée": "60 s", "Pull:Curl biceps": "75 s", "Legs:Presse à cuisses": "2 min", "Legs:Hack squat": "2-3 min", "Legs:RDL": "2 min", "Legs:Leg curl": "75 s", "Legs:Mollets debout": "45-60 s", "Upper:DC haltères neutre": "2-3 min", "Upper:Tirage bûcheron": "2 min", "Upper:DM haltères": "2-3 min", "Upper:Élévations lat.": "60 s", "Upper:Curl marteau": "75 s", "Upper:Ext. triceps": "75 s", "Lower:Hip thrust": "2-3 min", "Lower:Presse lourde": "3 min", "Lower:Leg extension": "90 s", "Lower:Leg curl assis": "75 s", "Lower:Abduction hanche": "45 s", "Lower:Mollets assis": "45-60 s" };
function reposFor(sid, nom) { return reposMap[sid + ":" + nom] || "90 s"; }
function SportSection() {
    const [tab, setTab] = useState("resume");
    const [openS, setOpenS] = useState("A");
    const [actS, setActS] = useState("Push");
    const [actP, setActP] = useStored("sport-phase", 0);
    const [sciCfg, setSciCfg] = useStored("science-config", SCI_DEFAULT);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [sLogs] = useStored("sport-logs", []);
    const [mLogs] = useStored("maison-logs", []);
    const [nLogs] = useStored("nutri-logs", []);
    const prog = resolveProgramme(profile, sLogs);
    const [suiviProg, setSuiviProg] = useState(prog);
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
        { l: "Fréquence", v: programmeDays(prog).length + "j/sem", s: PROGRAMMES[prog].label.toLowerCase() + " · lever " + pr.reveil },
        profil[3],
    ];
    const phaseHint = suggestedP != null && suggestedP !== actP && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: C.textMut, background: C.surfaceAlt, borderRadius: 10, padding: "7px 10px", marginBottom: 10 } },
        React.createElement("span", { style: { flex: 1 } }, "📆 Semaine " + weekN + " du programme → ", React.createElement("b", { style: { color: phases[suggestedP].c } }, phases[suggestedP].ph), " conseillée."),
        React.createElement("button", { onClick: () => { setActP(suggestedP); toast("🎯 " + phases[suggestedP].ph + " appliquée"); }, style: { padding: "4px 10px", borderRadius: 8, border: `1px solid ${phases[suggestedP].c}`, background: "transparent", color: phases[suggestedP].c, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, "Appliquer"));
    const se = salleSeances.find(s => s.id === actS);
    const tabs = [["resume", "Résumé"], ["maison", "Maison"], ["salle", "Salle"], ["progression", "Progression"], ["suivi", "📊 Suivi"], ["rm", "💪 Plan RM"], ["coach", "🧠 Coach"], ["douleur", "🩹 Douleur"], ["conseils", "Conseils"]];
    return React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 } }, tabs.map(([k, l]) => React.createElement(Pill, { key: k, active: tab === k, onClick: () => setTab(k), color: C.amber }, l))),
        tab === "resume" && React.createElement("div", null,
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } }, profilCards.map(p => React.createElement(Card, { key: p.l },
                React.createElement("div", { style: { fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: .5 } }, p.l),
                React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: C.amberLight, margin: "3px 0 1px" } }, p.v),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut } }, p.s)))),
            React.createElement(Card, { border: C.danger + "33" },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 8 } }, "⚠️ Règles de sécurité"),
                regles.map((r, i) => React.createElement("div", { key: i, style: { fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: 6, paddingLeft: 12, position: "relative" } },
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
        tab === "salle" && React.createElement("div", null,
            phaseHint,
            React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" } }, phases.map((p, i) => React.createElement("button", { key: i, onClick: () => setActP(i), style: { padding: "5px 10px", borderRadius: 999, border: `2px solid ${actP === i ? p.c : "transparent"}`, cursor: "pointer", fontSize: 10, fontWeight: 700, background: actP === i ? p.c + "22" : C.surfaceAlt, color: actP === i ? p.c : C.textDim } }, p.sem))),
            React.createElement("div", { style: { background: C.surfaceAlt, border: `1px solid ${phases[actP].c}44`, borderRadius: 10, padding: "6px 12px", marginBottom: 12, fontSize: 11, color: phases[actP].c, fontWeight: 700 } },
                phases[actP].ph,
                " — ",
                phases[actP].pct,
                " — ",
                phases[actP].but),
            React.createElement("button", { onClick: () => saveSci({ deload: !sciCfg.deload }), style: { width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${(sciCfg?.deload) ? "#818CF8" : C.border}`, background: (sciCfg?.deload) ? "#818CF822" : "transparent", color: (sciCfg?.deload) ? "#A5B4FC" : C.textMut, fontSize: 12, fontWeight: 800, cursor: "pointer", marginBottom: (sciCfg?.deload) ? 6 : 12 } },
                "🪶 Semaine de décharge (−40%) ",
                (sciCfg?.deload) ? "· ACTIVE ✓" : ""),
            (sciCfg?.deload) && React.createElement("div", { style: { fontSize: 10.5, color: "#A5B4FC", background: "#818CF815", border: "1px solid #818CF833", borderRadius: 8, padding: "8px 11px", marginBottom: 12, lineHeight: 1.5 } },
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
                " = secondes. Le poids affiché = charge cible pour la phase choisie ci-dessus. Repos indiqué ",
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
                se.exercices.map((ex, i) => { const sciKey = se.id + ":" + ex.nom; const sciW = sciCfg?.weightOverrides?.[sciKey]; return React.createElement("div", { key: i, style: { padding: "10px 0", borderTop: i ? `1px solid ${C.borderSoft}` : "none" } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 3 } },
                        React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "baseline" } },
                            React.createElement("span", { style: { color: se.couleur, fontWeight: 800, fontSize: 11 } }, String(i + 1).padStart(2, "0")),
                            React.createElement("span", { style: { fontSize: 13, fontWeight: 700 } }, ex.nom)),
                        React.createElement("span", { style: { fontSize: 11, color: C.amberLight, fontWeight: 700 } }, ex.detail)),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginLeft: 19, marginTop: 3, flexWrap: "wrap" } },
                        React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: phases[actP].c, background: phases[actP].c + "18", padding: "2px 7px", borderRadius: 5 } }, phases[actP].sem),
                        React.createElement("span", { style: { fontSize: 12, fontWeight: 700 } }, (() => { const _b = parseFloat(ex.charges[actP]); return (sciCfg?.deload) ? (isNaN(_b) ? ex.charges[actP] : Math.round(_b * 0.6 * 2) / 2 + "kg") : ex.charges[actP]; })()),
                        sciW && !(sciCfg?.deload) && React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: C.blue, background: C.blue + "18", padding: "2px 8px", borderRadius: 5 } },
                            "🔬 ",
                            sciW,
                            "kg"),
                        (sciCfg?.deload) && React.createElement("span", { style: { fontSize: 10, color: "#818CF8", background: "#818CF815", padding: "2px 7px", borderRadius: 5 } }, "🔄 −40%"),
                        React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: C.textMut, background: C.surfaceAlt, padding: "2px 7px", borderRadius: 5 } },
                            "⏱ ",
                            reposFor(se.id, ex.nom))),
                    React.createElement("div", { style: { display: "flex", gap: 10, marginLeft: 19, marginTop: 4, flexWrap: "wrap" } }, ex.charges.map((ch, pi) => pi !== actP && React.createElement("span", { key: pi, style: { fontSize: 10, color: C.textDim } },
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
            React.createElement(Card, { border: C.green + "33", style: { background: "#0A1A0A" } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 4 } }, "🗓️ Timeline"),
                React.createElement("div", { style: { fontSize: 12, color: "#80C0A0", lineHeight: 1.7 } }, "Haut : 75-80% S8-10 · Bas : 80% S12-16 · Fin S12 : force/hypertrophie"))),
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
function dayMenu(dayType, profile, mealAlt, bt) {
    const plan = dayPlan(dayType, profile, mealAlt);
    const base = bt?.cal ? bt.cal.target : macrosTarget.kcal;
    const dayTgt = dayType === "rest" ? Math.max(base - REST_CUT, bt?.cal ? bt.cal.bmr : 0) : base;
    const dayMacros = macrosFor(dayTgt, bt?.cal ? bt.prot : macrosTarget.p);
    const { itemF } = mealScaling(plan.meals, { ...dayMacros, kcal: dayTgt });
    const mealMacros = plan.meals.map(r => r.items.reduce((a, it) => it.t ? a : { p: a.p + it.p * itemF(it), g: a.g + it.g * itemF(it), l: a.l + it.l * itemF(it) }, { p: 0, g: 0, l: 0 }));
    const menuTot = mealMacros.reduce((a, m) => ({ p: a.p + m.p, g: a.g + m.g, l: a.l + m.l }), { p: 0, g: 0, l: 0 });
    const menuKcal = Math.round(menuTot.p * 4 + menuTot.g * 4 + menuTot.l * 9);
    return { ...plan, dayTgt, dayMacros, itemF, mealMacros, menuTot, menuKcal };
}
const activityOpts = [{ l: "Sédentaire", v: 1.2 }, { l: "Léger", v: 1.375 }, { l: "Modéré", v: 1.55 }, { l: "Élevé", v: 1.725 }];
const objectifOpts = [{ l: "−500 kcal", v: 500 }, { l: "−550 kcal", v: 550 }, { l: "−700 kcal", v: 700 }, { l: "−1000 kcal", v: 1000 }, { l: "Maintien", v: 0 }];
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
    const G = C.green;
    useEffect(() => { Promise.all([load("food-log", {}), load("nutri-logs", []), load("nutri-cal-cfg", null), load("taille-corps", ""), load("mensurations", []), load("repas-alts", {})]).then(([lg, n, c, h, m, a]) => { setLog(lg || {}); setNLogs(n || []); setCfg(normCalCfg(c)); setCm(parseFloat(h) || 0); setMens(m || []); setAlts(a || {}); setLoading(false); }); }, []);
    const dayType = sessionForDate(selDate, resolveProgramme(profile, sLogs)) ? "training" : "rest";
    const bt = bodyTargets(nLogs, mens, cm, cfg);
    const menu = dayMenu(dayType, profile, alts, bt);
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
            React.createElement("div", { style: { fontSize: 10.5, color: left >= 0 ? C.textMut : C.danger, marginBottom: 10 } }, left >= 0 ? "Reste " + left + " kcal" : "Dépassement de " + (-left) + " kcal", bt.cal ? "" : " · cible de base (renseigne 🔥 Calories)"),
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
function NutritionSection() {
    const [tab, setTab] = useState("resume");
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
    const menu = dayMenu(day, profile, mealAlt, bt);
    const { meals: repasEff, dayTgt, dayMacros, itemF, mealMacros, menuTot, menuKcal } = menu;
    const planning = menu.timeline.map(x => [x.h, x.t]);
    const tabs = [["resume", "Résumé"], ["cal", "🔥 Calories"], ["repas", "Repas"], ["journal", "📓 Journal"], ["aliments", "Aliments"], ["complements", "Compléments"], ["suivi", "📊 Suivi"], ["corps", "📐 Corps"], ["conseils", "Conseils"]];
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
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, retires.map(a => React.createElement("span", { key: a, style: { fontSize: 11, color: "#C99", background: "#1A0E0E", borderRadius: 999, padding: "4px 10px", textDecoration: "line-through" } }, a))))),
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
        window.scrollTo({ top: 0, behavior: "smooth" });
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
    const tabs = [["resume", "📊 Résumé"], ["finances", "💰 Finances"], ["aliments", "🛒 Aliments"], ["alternatives", "💸 Alternatives"], ["suivi", "📊 Suivi"], ["conseils", "💡 Conseils"]];
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
/* ═══ REVIEW DATA ═══ */
/* ═══ AJUSTEMENTS SCIENTIFIQUES ═══ */
/* ═══ AJUSTEMENTS SCIENTIFIQUES ═══
 * Rythme de perte jugé en % du poids de corps (−0,5 à −1 %/sem), mesuré par régression sur
 * les dernières pesées ; le bouton « Appliquer » modifie VRAIMENT le déficit de l'onglet Calories.
 * La surcharge utilise le même moteur que le Coach et le pré-remplissage du log. */
const PACE_MIN = -1.0, PACE_MAX = -0.5, PACE_SLOW = -0.25, ADJUST_COOLDOWN = 10;
function ScienceSection() {
    const [sportLogs, setSportLogs] = useState([]);
    const [maisonLogs, setMaisonLogs] = useState([]);
    const [nutriLogs, setNutriLogs] = useState([]);
    const [calRaw, setCalRaw] = useState(null);
    const [cfg, setCfg] = useStored("science-config", SCI_DEFAULT);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("bilan");
    useEffect(() => { Promise.all([load("sport-logs", []), load("maison-logs", []), load("nutri-logs", []), load("nutri-cal-cfg", null)]).then(([s, m, n, c]) => { setSportLogs(s || []); setMaisonLogs(m || []); setNutriLogs(n || []); setCalRaw(c); setLoading(false); }); }, []);
    const overrides = cfg.weightOverrides || {};
    const setOverride = (key, v) => { const ov = { ...overrides }; if (v == null)
        delete ov[key];
    else
        ov[key] = v; setCfg({ ...cfg, weightOverrides: ov }); };
    /* ── Surcharge : moteur de progression partagé ── */
    const recs = salleSeances.flatMap(seance => seance.exercices.map(ex => { const e = lastExerciseLog(sportLogs, seance.id, ex.nom); if (!e)
        return null; const p = progressFor(seance.id, e, cfg.recovery); const key = seance.id + ":" + ex.nom; return { key, seance: seance.id, emoji: seance.emoji, exo: ex.nom, last: e, p, applied: overrides[key] === p.weight }; }).filter(Boolean));
    const ups = recs.filter(r => r.p.action === "up");
    /* ── Rythme de perte ── */
    const weighIns = nutriLogs.filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    const curW = avgRecent(weighIns, 7);
    const span = weighIns.length >= 2 ? daysBetween(weighIns[Math.max(0, weighIns.length - 8)].dateISO, weighIns[weighIns.length - 1].dateISO) : 0;
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
    const nDays = programmeDays(prog).length;
    const train7 = new Set([...sportLogs, ...maisonLogs].filter(l => withinDays(l.dateISO, 7)).map(l => l.dateISO)).size;
    const wNutri = nutriLogs.filter(l => withinDays(l.dateISO, 7));
    const avgComp = wNutri.length ? Math.round(wNutri.reduce((a, l) => a + l.compliance, 0) / wNutri.length) : null;
    const activeCount = Object.keys(overrides).length + (cfg.deload ? 1 : 0) + (cfg.recovery ? 1 : 0);
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
        React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 12, overflowX: "auto" } }, [["bilan", "📊 Bilan"], ["surcharge", "🏋️ Surcharge" + (ups.filter(r => !r.applied).length ? " · " + ups.filter(r => !r.applied).length : "")], ["config", "🔧 Config"]].map(([k, l]) => React.createElement(Pill, { key: k, active: tab === k, onClick: () => setTab(k), color: C.blue }, l))),
        tab === "bilan" && React.createElement("div", null,
            activeCount > 0 && React.createElement(Card, { border: C.blue + "44", style: { background: "#080E18" } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.blueLight, marginBottom: 8 } }, "🔬 Ajustements actifs (" + activeCount + ")"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                    Object.entries(overrides).map(([k, v]) => React.createElement("span", { key: k, style: { fontSize: 10, background: C.blue + "15", border: `1px solid ${C.blue}33`, borderRadius: 8, padding: "3px 8px", color: C.blueLight } }, k.split(":")[1] + " → ", React.createElement("b", null, v + "kg"))),
                    cfg.deload && React.createElement("span", { style: { fontSize: 10, background: "#818CF815", border: "1px solid #818CF833", borderRadius: 8, padding: "3px 8px", color: "#818CF8" } }, "🪶 Décharge active"),
                    cfg.recovery && React.createElement("span", { style: { fontSize: 10, background: "#F59E0B15", border: "1px solid #F59E0B33", borderRadius: 8, padding: "3px 8px", color: "#FBBF24" } }, "🛌 Mode récupération"))),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } },
                stat("Séances / 7j", React.createElement(Fragment, null, train7, React.createElement("span", { style: { fontSize: 12, color: C.textMut, fontWeight: 400 } }, "/" + nDays)), train7 >= nDays ? C.green : train7 >= Math.ceil(nDays / 2) ? C.gluc : C.danger, PROGRAMMES[prog].label + " · " + (train7 >= nDays ? "✅ objectif atteint" : "objectif " + nDays)),
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
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.greenLight, marginBottom: 4 } }, "⬆️ " + ups.filter(r => !r.applied).length + " exercice(s) prêt(s) à monter en charge"),
                React.createElement("button", { onClick: () => setTab("surcharge"), style: { border: "none", background: "transparent", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 } }, "Voir dans l'onglet Surcharge →"))),
        tab === "surcharge" && React.createElement("div", null, recs.length === 0 ? React.createElement(Card, null,
            React.createElement("div", { style: { textAlign: "center", color: C.textMut, padding: 14, fontSize: 12 } }, "Enregistre des séances salle (charge + reps) pour obtenir des recommandations."))
            : React.createElement(Fragment, null,
                React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, marginBottom: 10, lineHeight: 1.5 } }, "💡 Double progression : haut de la fourchette atteint à RPE ≤ 8 → on monte (+5 kg jambes, +2,5 kg ailleurs). « Appliquer » fixe la nouvelle cible dans le log (✨ Pré-remplir) et l'onglet Salle." + (cfg.recovery ? " Mode récupération actif : aucune hausse proposée." : "")),
                ups.map(r => React.createElement(Card, { key: r.key, border: r.applied ? C.green + "44" : C.amber + "44" },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } },
                        React.createElement("div", null,
                            React.createElement("span", { style: { fontSize: 13, fontWeight: 800 } }, r.emoji + " " + r.seance),
                            React.createElement("span", { style: { fontSize: 11, color: C.textMut, marginLeft: 6 } }, r.exo)),
                        r.applied && React.createElement("span", { style: { fontSize: 9, fontWeight: 700, color: C.green, background: C.green + "15", padding: "2px 7px", borderRadius: 99 } }, "✅ Appliqué")),
                    React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10 } },
                        React.createElement("div", { style: { textAlign: "center" } },
                            React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, "Dernière"),
                            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.textMut } }, r.last.weight, React.createElement("span", { style: { fontSize: 11 } }, "kg"))),
                        React.createElement("div", { style: { fontSize: 16, color: C.blue } }, "→"),
                        React.createElement("div", { style: { textAlign: "center" } },
                            React.createElement("div", { style: { fontSize: 10, color: C.blue } }, "Prochaine"),
                            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.blue } }, r.p.weight, React.createElement("span", { style: { fontSize: 11 } }, "kg × " + r.p.reps))),
                        React.createElement("div", { style: { flex: 1 } }),
                        React.createElement("div", { style: { fontSize: 10, color: C.textDim, textAlign: "right" } }, (r.last.setsDetail?.length ? fmtSets(r.last) : r.last.sets + "×" + r.last.reps), React.createElement("br"), r.last.rpe ? "RPE " + r.last.rpe : r.last.date)),
                    !r.applied ? React.createElement("button", { onClick: () => { setOverride(r.key, r.p.weight); toast("🔬 " + r.exo + " → " + r.p.weight + " kg"); }, style: { width: "100%", padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer", background: C.blue, color: "#fff", fontSize: 12, fontWeight: 700 } }, "Appliquer " + r.p.weight + " kg")
                        : React.createElement("button", { onClick: () => setOverride(r.key, null), style: { width: "100%", padding: "9px 0", borderRadius: 10, border: `1px solid ${C.textDim}44`, background: "transparent", color: C.textDim, fontSize: 11, cursor: "pointer" } }, "Annuler l'ajustement"))),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, margin: "6px 0 8px" } }, "Les autres exercices"),
                recs.filter(r => r.p.action !== "up").map(r => React.createElement("div", { key: r.key, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "8px 12px", marginBottom: 6 } },
                    React.createElement("span", { style: { fontSize: 11.5 } }, r.emoji + " " + r.exo),
                    React.createElement("span", { style: { fontSize: 10.5, color: r.p.action === "hold" ? C.gluc : C.textMut, fontWeight: 700, textAlign: "right" } }, r.p.txt))))),
        tab === "config" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, color: C.textMut, marginBottom: 12 } }, "Protocoles partagés avec le log et l'onglet Salle."),
            toggleCard("deload", "🪶", "Semaine de décharge", "Charges −40 % dans le programme salle et le pré-remplissage du log. PR non comptés. À faire toutes les 4-6 semaines.", "#818CF8"),
            toggleCard("recovery", "🛌", "Mode récupération", "Fatigue accumulée : plus aucune hausse de charge proposée, repos ≥ 3 min mis en avant sur le minuteur.", "#F59E0B"),
            Object.keys(overrides).length > 0 && React.createElement(Card, { border: C.blue + "33" },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
                    React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: C.blueLight } }, "Charges ajustées (" + Object.keys(overrides).length + ")"),
                    React.createElement("button", { onClick: async () => { if (await askConfirm({ title: "Retirer tous les ajustements ?", message: "Les cibles reviendront aux suggestions du coach et aux charges de phase.", confirmLabel: "Tout retirer", danger: true })) {
                            const prev = cfg;
                            setCfg({ ...cfg, weightOverrides: {} });
                            toast("Ajustements retirés", { undo: () => setCfg(prev) });
                        } }, style: { border: "none", background: "transparent", color: C.danger, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, "Tout retirer")),
                Object.entries(overrides).map(([k, v]) => React.createElement("div", { key: k, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: `1px solid ${C.borderSoft}` } },
                    React.createElement("span", { style: { fontSize: 11 } }, k.replace(":", " · ")),
                    React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                        React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: C.blue } }, v + "kg"),
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
const STORAGE_KEYS = ["sport-logs", "sport-phase", "nutri-logs", "budget-logs", "mensurations", "photos-index", "douleur-logs", "science-config", "maison-logs", "fin-income", "fin-expenses", "fin-caps", "fin-goal", "taille-corps", "nutri-cal-cfg", "repas-alts", "food-log", "foods-custom", "profil"];
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
    return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, background: C.amber + "14", border: `1px solid ${C.amber}55`, borderRadius: 14, padding: "10px 12px", marginBottom: 14 } },
        React.createElement("span", { style: { fontSize: 20 } }, "💾"),
        React.createElement("div", { style: { flex: 1, fontSize: 11, color: C.text, lineHeight: 1.4 } },
            React.createElement("b", null, age == null ? "Aucune sauvegarde" : "Dernière sauvegarde il y a " + age + " j"),
            React.createElement("br"),
            React.createElement("span", { style: { color: C.textMut } }, "Tes données ne sont que sur ce téléphone.")),
        React.createElement("button", { disabled: busy, onClick: async () => { setBusy(true); const r = await exportAll(); setBusy(false); if (r.res === "shared" || r.res === "downloaded")
                toast("✅ Sauvegarde créée"); }, style: { padding: "8px 12px", borderRadius: 10, border: "none", background: C.amber, color: "#1A1505", fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: busy ? .6 : 1 } }, "Exporter"),
        React.createElement("button", { onClick: () => setHidden(true), "aria-label": "Masquer", style: { border: "none", background: "transparent", color: C.textDim, fontSize: 14, cursor: "pointer", padding: 2 } }, "✕"));
}
function HomeScreen({ goTo }) {
    const [sLogs, setSLogs] = useState([]);
    const [nLogs, setNLogs] = useState([]);
    const [bLogs, setBLogs] = useState([]);
    const [mLogs, setMLogs] = useState([]);
    const [fExp, setFExp] = useState([]);
    const [ok, setOk] = useState(false);
    const [hCalCfg, setHCalCfg] = useState(null);
    const [hCm, setHCm] = useState(0);
    const [hMens, setHMens] = useState([]);
    useEffect(() => { Promise.all([load("sport-logs", []), load("nutri-logs", []), load("budget-logs", []), load("maison-logs", []), load("fin-expenses", []), load("nutri-cal-cfg", null), load("taille-corps", ""), load("mensurations", [])]).then(([s, n, b, m, f, cc, h, me]) => { setSLogs(s); setNLogs(n); setBLogs(b); setMLogs(m); setFExp(f || []); setHCalCfg(normCalCfg(cc)); setHCm(parseFloat(h) || 0); setHMens(me || []); setOk(true); }); }, []);
    const trainDates = [...new Set([...sLogs.map(l => l.dateISO), ...mLogs.map(l => l.dateISO)])];
    const train7 = trainDates.filter(d => withinDays(d, 7)).length;
    const nutriStreak = streakFromDates(nLogs.filter(l => l.compliance >= 80).map(l => l.dateISO));
    const creaStreak = streakFromDates(nLogs.filter(l => l.supps && l.supps["Créatine"]).map(l => l.dateISO));
    const weighIns = nLogs.filter(l => l.weight).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
    const { cal: hCalRes, macros: hMacros } = bodyTargets(nLogs, hMens, hCm, hCalCfg);
    const [profile] = useStored("profil", PROFILE_DEFAULT);
    const prog = resolveProgramme(profile, sLogs);
    const nDays = programmeDays(prog).length;
    const todayISO = isoToday();
    const seanceToday = sessionForDate(todayISO, prog);
    const todaySeance = seanceToday ? seanceToday.label : null;
    const isRest = !seanceToday;
    const plan = dayPlan(isRest ? "rest" : "training", profile);
    const didTrain = sLogs.some(l => l.dateISO === todayISO) || mLogs.some(l => l.dateISO === todayISO);
    const todayN = nLogs.find(l => l.dateISO === todayISO);
    const didNutri = !!todayN;
    const didWeigh = !!(todayN && todayN.weight);
    const doneCount = ((isRest || didTrain) ? 1 : 0) + (didNutri ? 1 : 0) + (didWeigh ? 1 : 0);
    const todayTgt = hCalRes ? (isRest ? Math.max(hCalRes.target - 400, hCalRes.bmr) : hCalRes.target) : null;
    const lastW = [...sLogs.map(l => ({ ...l, emoji: salleSeances.find(s => s.id === l.seance)?.emoji || "🏋️", nom: l.seance })), ...mLogs.map(l => ({ ...l, emoji: "🏠", nom: "Maison " + l.seance }))].sort((a, b) => a.dateISO.localeCompare(b.dateISO)).pop() || null;
    const totalS = sLogs.length + mLogs.length;
    const wE = nLogs.filter(l => l.weight).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const latW = wE.length ? wE[wE.length - 1].weight : null;
    const fstW = wE.length ? wE[0].weight : null;
    const diffW = latW && fstW ? (latW - fstW).toFixed(1) : null;
    const l7 = nLogs.filter(l => withinDays(l.dateISO, 7));
    const avgC = l7.length ? Math.round(l7.reduce((a, l) => a + l.compliance, 0) / l7.length) : null;
    const w7 = weighIns.filter(x => withinDays(x.dateISO, 8));
    const dW7 = w7.length >= 2 ? Math.round((w7[w7.length - 1].kg - w7[0].kg) * 10) / 10 : null;
    const dep7 = Math.round(fExp.filter(e => withinDays(e.dateISO, 7)).reduce((s, e) => s + (+e.montant || 0), 0) * 100) / 100;
    return React.createElement("div", null,
        React.createElement("div", { style: { textAlign: "center", padding: "28px 20px 24px", background: `radial-gradient(ellipse at 50% 0%, ${C.amber}12 0%, transparent 70%)`, borderRadius: 20, marginBottom: 20 } },
            React.createElement("div", { style: { width: 72, height: 72, borderRadius: 20, margin: "0 auto 14px", background: `linear-gradient(135deg, ${C.amber}33, ${C.green}33)`, border: `2px solid ${C.amber}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 } }, "💪"),
            React.createElement("div", { style: { fontSize: 32, fontWeight: 900, letterSpacing: -1, marginBottom: 4 } }, "RECOMP"),
            React.createElement("div", { style: { fontSize: 12, color: C.textMut, letterSpacing: 3, textTransform: "uppercase" } }, "Programme personnel"),
            React.createElement("div", { style: { display: "inline-flex", gap: 8, marginTop: 14, padding: "6px 16px", background: C.surface, borderRadius: 999, border: `1px solid ${C.border}` } },
                React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, latW ? latW + " kg" : (fstW || 130) + " kg"),
                React.createElement("span", { style: { fontSize: 11, color: C.borderSoft } }, "·"),
                React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, PROGRAMMES[prog].label),
                React.createElement("span", { style: { fontSize: 11, color: C.borderSoft } }, "·"),
                React.createElement("span", { style: { fontSize: 11, color: C.textMut } }, nDays + "j/sem"))),
        React.createElement(BackupReminder, { hasData: ok && (sLogs.length + nLogs.length + mLogs.length) > 0 }),
        ok && (totalS > 0 || nLogs.length > 0) && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 } },
            React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "10px 6px" } },
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.amberLight } }, totalS),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Séances")),
            React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "10px 6px" } },
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.prot } }, latW || "—"),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Poids")),
            React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "10px 6px" } },
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: diffW && parseFloat(diffW) < 0 ? C.green : diffW ? C.gluc : C.textDim } }, diffW ? (parseFloat(diffW) > 0 ? "+" : "") + diffW : "—"),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Évol.")),
            React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "10px 6px" } },
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: avgC !== null ? (avgC >= 80 ? C.green : avgC >= 50 ? C.gluc : C.danger) : C.textDim } }, avgC !== null ? avgC + "%" : "—"),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Nutri 7j"))),
        ok && (nLogs.length > 0 || trainDates.length > 0) && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 } },
            React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "12px 6px" } },
                React.createElement("div", { style: { fontSize: 20 } }, "🔥"),
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.green } },
                    nutriStreak.current,
                    React.createElement("span", { style: { fontSize: 10, color: C.textDim, fontWeight: 400 } }, "j")),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Série nutrition"),
                nutriStreak.best > 1 && React.createElement("div", { style: { fontSize: 8, color: C.textDim } },
                    "record ",
                    nutriStreak.best,
                    "j")),
            React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "12px 6px" } },
                React.createElement("div", { style: { fontSize: 20 } }, "⚡"),
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.amberLight } },
                    creaStreak.current,
                    React.createElement("span", { style: { fontSize: 10, color: C.textDim, fontWeight: 400 } }, "j")),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Série créatine"),
                creaStreak.best > 1 && React.createElement("div", { style: { fontSize: 8, color: C.textDim } },
                    "record ",
                    creaStreak.best,
                    "j")),
            React.createElement(Card, { style: { marginBottom: 0, textAlign: "center", padding: "12px 6px" } },
                React.createElement("div", { style: { fontSize: 20 } }, "💪"),
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: train7 >= nDays ? C.green : C.amberLight } },
                    train7,
                    React.createElement("span", { style: { fontSize: 10, color: C.textDim, fontWeight: 400 } }, "/" + nDays)),
                React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "Séances 7j"))),
        ok && React.createElement("div", { style: { background: `linear-gradient(135deg,${C.surface},#12100A)`, border: `1px solid ${C.amber}44`, borderRadius: 18, padding: 16, marginBottom: 12 } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 800 } }, "📅 Aujourd'hui"),
                    React.createElement("div", { style: { fontSize: 10, color: C.textDim, textTransform: "capitalize" } }, new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))),
                React.createElement("div", { style: { textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: doneCount >= 3 ? C.green : C.amberLight } },
                        doneCount,
                        React.createElement("span", { style: { fontSize: 11, color: C.textDim, fontWeight: 400 } }, "/3")),
                    React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "objectifs"))),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } }, [
                { e: isRest ? "🛌" : (seanceToday ? seanceToday.emoji : "🏋️"), lab: isRest ? "Repos" : (todaySeance || "Séance"), done: isRest || didTrain, sub: isRest ? "jour off" : (didTrain ? "fait" : "à faire") },
                { e: "🥗", lab: "Nutrition", done: didNutri, sub: didNutri ? "suivie" : "à suivre" },
                { e: "⚖️", lab: "Pesée", done: didWeigh, sub: didWeigh ? "faite" : "à faire" }
            ].map((t, i) => React.createElement("div", { key: i, style: { background: t.done ? C.green + "14" : C.surfaceAlt, border: `1px solid ${t.done ? C.green + "44" : C.borderSoft}`, borderRadius: 12, padding: "10px 6px", textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 18 } }, t.e),
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, marginTop: 2 } }, t.lab),
                React.createElement("div", { style: { fontSize: 9, color: t.done ? C.green : C.textDim, fontWeight: t.done ? 700 : 400 } },
                    t.done ? "✓ " : "",
                    t.sub)))),
            todayTgt && React.createElement("div", { style: { fontSize: 10.5, color: C.textMut, marginTop: 11, textAlign: "center" } },
                "🔥 Cible du jour : ",
                React.createElement("b", { style: { color: C.greenLight } },
                    todayTgt,
                    " kcal"),
                isRest ? " (repos, glucides réduits)" : "")),
        ok && (train7 > 0 || l7.length > 0 || dep7 > 0) && React.createElement("div", { style: { background: `linear-gradient(135deg,${C.surface},#0C140C)`, border: `1px solid ${C.green}33`, borderRadius: 18, padding: 16, marginBottom: 12 } },
            React.createElement("div", { style: { fontSize: 14, fontWeight: 800, marginBottom: 1 } }, "📅 Bilan de la semaine"),
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 12 } }, "7 derniers jours"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, background: C.surfaceAlt, borderRadius: 11, padding: "9px 11px" } },
                    React.createElement("span", { style: { fontSize: 18 } }, "🏋️"),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: train7 >= nDays ? C.green : C.amberLight } },
                            train7,
                            React.createElement("span", { style: { fontSize: 10, color: C.textDim, fontWeight: 400 } }, "/" + nDays)),
                        React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "séances"))),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, background: C.surfaceAlt, borderRadius: 11, padding: "9px 11px" } },
                    React.createElement("span", { style: { fontSize: 18 } }, "⚖️"),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: dW7 == null ? C.textDim : dW7 < 0 ? C.green : dW7 > 0 ? C.gluc : C.textMut } }, dW7 == null ? "—" : (dW7 > 0 ? "+" : "") + dW7 + " kg"),
                        React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "poids"))),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, background: C.surfaceAlt, borderRadius: 11, padding: "9px 11px" } },
                    React.createElement("span", { style: { fontSize: 18 } }, "🥗"),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: avgC == null ? C.textDim : avgC >= 80 ? C.green : avgC >= 50 ? C.gluc : C.danger } }, avgC == null ? "—" : avgC + "%"),
                        React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "nutrition"))),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, background: C.surfaceAlt, borderRadius: 11, padding: "9px 11px" } },
                    React.createElement("span", { style: { fontSize: 18 } }, "💸"),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.budgetLight } }, dep7 > 0 ? dep7 + " €" : "—"),
                        React.createElement("div", { style: { fontSize: 9, color: C.textDim } }, "dépenses"))))),
        React.createElement("div", { onClick: () => goTo("sport"), style: { background: `linear-gradient(135deg, ${C.surface} 0%, #1A1608 100%)`, border: `1px solid ${C.amber}33`, borderRadius: 20, padding: 18, marginBottom: 12, cursor: "pointer", position: "relative", overflow: "hidden" } },
            React.createElement("div", { style: { position: "absolute", top: -20, right: -20, fontSize: 80, opacity: .06 } }, "🏋️"),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
                React.createElement("div", { style: { width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.amber}22, ${C.amber}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, "🏋️"),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800 } }, "Programme Sport"),
                    React.createElement("div", { style: { fontSize: 10, color: C.textMut } }, PROGRAMMES[prog].label + " · " + (seanceToday ? "aujourd'hui : " + seanceToday.emoji + " " + seanceToday.label : "repos aujourd'hui")))),
            lastW && React.createElement("div", { style: { fontSize: 10, color: C.textMut } },
                "Dernière séance : ",
                React.createElement("span", { style: { color: C.amberLight, fontWeight: 700 } }, lastW.emoji, " ", lastW.nom),
                " — ",
                lastW.date),
            React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 10, fontSize: 12, fontWeight: 700, color: C.amber } }, "Accéder →")),
        React.createElement("div", { onClick: () => goTo("nutrition"), style: { background: `linear-gradient(135deg, ${C.surface} 0%, #08160E 100%)`, border: `1px solid ${C.green}33`, borderRadius: 20, padding: 18, marginBottom: 12, cursor: "pointer", position: "relative", overflow: "hidden" } },
            React.createElement("div", { style: { position: "absolute", top: -20, right: -20, fontSize: 80, opacity: .06 } }, "🥗"),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
                React.createElement("div", { style: { width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.green}22, ${C.green}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, "🥗"),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800 } }, "Programme Nutrition"),
                    React.createElement("div", { style: { fontSize: 10, color: C.textMut } }, hMacros ? hCalRes.target + " kcal · " + hMacros.p + "P / " + hMacros.g + "G / " + hMacros.l + "L" : "Cible adaptative · configure 🔥 Calories"))),
            avgC !== null && React.createElement("div", { style: { fontSize: 10, color: C.textMut } },
                "Compliance 7j : ",
                React.createElement("span", { style: { color: C.greenLight, fontWeight: 700 } },
                    avgC,
                    "%"),
                latW && React.createElement("span", { style: { marginLeft: 10 } },
                    "Poids : ",
                    React.createElement("span", { style: { color: C.prot, fontWeight: 700 } },
                        latW,
                        " kg"))),
            React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 10, fontSize: 12, fontWeight: 700, color: C.green } }, "Accéder →")),
        React.createElement("div", { onClick: () => goTo("budget"), style: { background: `linear-gradient(135deg, ${C.surface} 0%, #120E1A 100%)`, border: `1px solid ${C.budget}33`, borderRadius: 20, padding: 18, marginBottom: 12, cursor: "pointer", position: "relative", overflow: "hidden" } },
            React.createElement("div", { style: { position: "absolute", top: -20, right: -20, fontSize: 80, opacity: .06 } }, "💰"),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
                React.createElement("div", { style: { width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.budget}22, ${C.budget}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, "💰"),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800 } }, "Budget Courses"),
                    React.createElement("div", { style: { fontSize: 10, color: C.textMut } },
                        "~",
                        TOTAL_SEM,
                        " €/sem · alternatives à ",
                        TOTAL_SEM_B,
                        " €"))),
            bLogs.length > 0 && React.createElement("div", { style: { fontSize: 10, color: C.textMut } },
                bLogs.length,
                " achats enregistrés"),
            React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 10, fontSize: 12, fontWeight: 700, color: C.budget } }, "Accéder →")),
        React.createElement("div", { onClick: () => goTo("review"), style: { background: `linear-gradient(135deg, ${C.surface} 0%, #090E18 100%)`, border: `1px solid ${C.blue}33`, borderRadius: 20, padding: 18, marginBottom: 12, cursor: "pointer", position: "relative", overflow: "hidden" } },
            React.createElement("div", { style: { position: "absolute", top: -20, right: -20, fontSize: 80, opacity: .06 } }, "🔬"),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
                React.createElement("div", { style: { width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.blue}22, ${C.blue}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, "🔬"),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800 } }, "Ajustements Scientifiques"),
                    React.createElement("div", { style: { fontSize: 10, color: C.textMut } }, "Surcharge progressive · Calories · Protocoles"))),
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" } }, [["🏋️", "Surcharge", "#818CF8"], ["🥗", "Calories", C.green], ["🔧", "Config", C.amber]].map(([ic, lb, c]) => React.createElement("span", { key: lb, style: { fontSize: 10, color: c, background: c + "15", padding: "2px 8px", borderRadius: 999 } },
                ic,
                " ",
                lb))),
            React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 12, fontWeight: 700, color: C.blue } }, "Accéder →")),
        React.createElement(Card, { style: { marginTop: 6 } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.textMut } }, "⏰ Planning du jour"),
                React.createElement("div", { style: { fontSize: 10, color: C.textDim } }, isRest ? "🛌 repos" : seanceToday.emoji + " " + seanceToday.label + " · créneau " + CRENEAUX[normProfile(profile).creneau].label.toLowerCase())),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 } }, plan.timeline.map((x, i) => React.createElement(Fragment, { key: i },
                React.createElement("span", { style: { color: /Séance/.test(x.t) ? C.amber : C.amberLight, fontWeight: 700 } }, x.h),
                React.createElement("span", { style: { color: /Séance/.test(x.t) ? C.text : C.textDim, fontWeight: /Séance/.test(x.t) ? 700 : 400 } }, x.t)))),
            React.createElement("button", { onClick: async () => { const r = await shareOrDownload("recomp-routine.ics", buildProfileICS(profile, prog), "text/calendar"); if (r === "shared" || r === "downloaded")
                    toast("📅 Ouvre le fichier pour l'ajouter à ton calendrier"); }, style: { width: "100%", marginTop: 12, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.amber}55`, background: C.amber + "15", color: C.amber, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "📅 Ajouter les rappels au calendrier"),
            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginTop: 6 } }, "Réveil, séances (" + PROGRAMMES[prog].label.toLowerCase() + ", " + nDays + " j/sem) et repas, aux horaires de ton profil — jours d'entraînement et de repos distincts.")),
        React.createElement(ProfileCard, { prog }),
        React.createElement(ProjectionCard, { weighIns: weighIns }),
        React.createElement(DataCard, null));
}
/* ═══ PROFIL — programme, créneau de séance, réveil ═══ */
function ProfileCard({ prog }) {
    const [profile, setProfile] = useStored("profil", PROFILE_DEFAULT);
    const [open, setOpen] = useState(false);
    const pr = normProfile(profile);
    const upd = patch => setProfile({ ...pr, ...patch });
    const chip = (active, onClick, label) => React.createElement("button", { onClick, style: { flex: 1, padding: "8px 4px", borderRadius: 9, border: `2px solid ${active ? C.amber : "transparent"}`, background: active ? C.amber + "22" : C.surfaceAlt, color: active ? C.amber : C.textMut, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, label);
    const hhmm = h => { const n = hToMin(h); return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0"); };
    return React.createElement(Card, null,
        React.createElement("button", { onClick: () => setOpen(o => !o), style: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", color: C.text } },
            React.createElement("span", { style: { fontSize: 13, fontWeight: 800 } }, "⚙️ Mon profil"),
            React.createElement("span", { style: { fontSize: 10.5, color: C.textMut } }, PROGRAMMES[prog].label + (pr.programme === "auto" ? " (auto)" : "") + " · séance " + CRENEAUX[pr.creneau].seance + " · réveil " + pr.reveil + "  " + (open ? "▲" : "▼"))),
        open && React.createElement("div", { style: { marginTop: 12 } },
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 4 } }, "Programme suivi"),
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 4 } }, chip(pr.programme === "auto", () => upd({ programme: "auto" }), "🤖 Auto"), chip(pr.programme === "maison", () => upd({ programme: "maison" }), "🏠 Maison"), chip(pr.programme === "salle", () => upd({ programme: "salle" }), "🏋️ Salle")),
            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginBottom: 12 } }, "Auto = salle dès que tu enregistres des séances salle (21 derniers jours), sinon maison. Maison : lun/mer/ven/sam · Salle : lun/mar/mer/ven/sam."),
            React.createElement("div", { style: { fontSize: 10, color: C.textDim, marginBottom: 4 } }, "Créneau de séance"),
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 4 } }, Object.entries(CRENEAUX).map(([k, c]) => React.createElement(Fragment, { key: k }, chip(pr.creneau === k, () => upd({ creneau: k }), c.label + " · " + c.seance)))),
            React.createElement("div", { style: { fontSize: 9.5, color: C.textDim, marginBottom: 12 } }, "Les horaires des repas des jours d'entraînement (pré-séance, shaker…) suivent ce créneau partout dans l'app."),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                React.createElement("div", { style: { flex: 1, fontSize: 12, fontWeight: 600 } }, "⏰ Réveil"),
                React.createElement("input", { type: "time", value: hhmm(pr.reveil), onChange: e => { if (e.target.value)
                        upd({ reveil: minToH(hToMin(e.target.value)) }); }, style: { ...inputStyle, width: 110, colorScheme: "dark" } }))));
}
/* ═══ APP ═══ */
function App() {
    const [section, setSection] = useState("home");
    useEffect(() => { try {
        window.scrollTo(0, 0);
    }
    catch (e) { } }, [section]);
    const hdr = { home: { c: C.amber, i: "💪", l: "ACCUEIL" }, sport: { c: C.amber, i: "🏋️", l: "PROGRAMME SPORT" }, nutrition: { c: C.green, i: "🥗", l: "PROGRAMME NUTRITION" }, budget: { c: C.budget, i: "💰", l: "BUDGET COURSES" }, review: { c: C.blue, i: "🔬", l: "AJUSTEMENTS SCIENTIFIQUES" } };
    return React.createElement("div", { style: { background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)" } },
        section !== "home" && React.createElement("div", { style: { padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 12 } },
            React.createElement("div", { style: { width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${hdr[section].c}22, ${hdr[section].c}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, hdr[section].i),
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 20, fontWeight: 800, letterSpacing: -.5 } }, "RECOMP"),
                React.createElement("div", { style: { fontSize: 11, color: C.textMut, letterSpacing: 1 } }, hdr[section].l))),
        React.createElement("div", { style: { flex: 1, padding: "14px 14px 90px", overflowY: "auto" } },
            section === "home" && React.createElement(HomeScreen, { goTo: setSection }),
            section === "sport" && React.createElement(SportSection, null),
            section === "nutrition" && React.createElement(NutritionSection, null),
            section === "budget" && React.createElement(BudgetSection, null),
            section === "review" && React.createElement(ScienceSection, null)),
        React.createElement(ConfirmHost, null),
        React.createElement(ToastHost, null),
        React.createElement("div", { style: { position: "fixed", bottom: 0, left: 0, right: 0, background: `${C.bg}F2`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom, 8px)" } }, [["home", "🏠", "Accueil", C.text], ["sport", "🏋️", "Sport", C.amber], ["nutrition", "🥗", "Nutri", C.green], ["budget", "💰", "Budget", C.budget], ["review", "🔬", "Science", C.blue]].map(([id, icon, label, color]) => React.createElement("button", { key: id, onClick: () => setSection(id), style: { flex: 1, maxWidth: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 0 8px", border: "none", cursor: "pointer", background: "transparent", position: "relative" } },
            section === id && React.createElement("div", { style: { position: "absolute", top: -1, width: 40, height: 3, borderRadius: "0 0 4px 4px", background: color, boxShadow: `0 0 12px ${color}88` } }),
            React.createElement("span", { style: { fontSize: 20, filter: section === id ? "none" : "grayscale(1) opacity(0.4)" } }, icon),
            React.createElement("span", { style: { fontSize: 9, fontWeight: 700, letterSpacing: .5, color: section === id ? color : C.textDim } }, label)))));
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
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(ErrorBoundary, null, React.createElement(App)));

