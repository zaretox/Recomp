"use strict";
/* PROGRAMME — quel programme est actif, quelle séance tombe quel jour.
 * Base : « salle » (PPL) et « maison » (circuits A-D). Perso : clé "programmes".
 * Le profil choisit : profil.programme = "auto" | "salle" | "maison" | id perso. */
const PROFIL_DEFAUT = { programme: "auto", creneau: "midi", reveil: "6h45" };
const profil = () => ({ ...PROFIL_DEFAUT, ...(DB.get("profil") || {}) });
const reglages = () => ({ ...DEFAUTS["science-config"], ...(DB.get("science-config") || {}) });
const setProfil = patch => DB.set("profil", { ...profil(), ...patch });

const _conv = new WeakMap();
/* Séances d'un programme perso → même format que les séances du PPL */
function seancesPerso(p) {
  if (!p) return [];
  if (_conv.has(p)) return _conv.get(p);
  const out = (p.seances || []).map(s => {
    const muscles = [...new Set((s.ex || []).map(e => e.muscle).filter(Boolean))];
    return {
      id: s.nom, jour: (s.days || []).map(d => JOURS[d]).join("/") || "—", focus: muscles.join(" · ") || "Séance perso", finisher: "", custom: true,
      exercices: (s.ex || []).map(e => ({ nom: e.nom, detail: e.sets + "×" + (e.lo === e.hi ? e.lo : e.lo + "-" + e.hi), charges: Array(4).fill(e.kg ? e.kg + "kg" : "—"), note: e.note || "", rest: e.rest || 90, muscle: e.muscle || "" })),
    };
  }).filter(s => s.exercices.length);
  _conv.set(p, out);
  return out;
}
/* Le programme de salle en vigueur : le perso choisi s'il a des séances, sinon le PPL */
const gymActif = memo(() => {
  const perso = DB.get("programmes").find(p => p.id === profil().programme);
  const conv = seancesPerso(perso);
  return perso && conv.length ? { id: perso.id, seances: conv } : { id: "salle", seances: PPL_SEANCES };
});
const seancesActives = () => gymActif().seances;
/* Une séance retrouvée par son nom, même dans un autre programme (historique) */
function seanceParId(id) {
  return seancesActives().find(s => s.id === id) || PPL_SEANCES.find(s => s.id === id) || DB.get("programmes").flatMap(seancesPerso).find(s => s.id === id) || null;
}
function infoProgramme(prog) {
  if (PROGRAMMES[prog]) return PROGRAMMES[prog];
  const p = DB.get("programmes").find(x => x.id === prog);
  if (!p) return PROGRAMMES.salle;
  const days = {};
  seancesPerso(p).forEach(s => (p.seances.find(x => x.nom === s.id)?.days || []).forEach(d => { days[d] = s.id; }));
  return { label: p.name, days, custom: true };
}
/* "auto" : salle dès qu'une séance salle date de moins de 21 jours, sinon maison */
function programmeEnCours() {
  const p = profil().programme;
  if (p === "auto") return DB.get("sport-logs").some(l => dansLes(l.dateISO, 21)) ? "salle" : "maison";
  if (PROGRAMMES[p] || DB.get("programmes").some(x => x.id === p && seancesPerso(x).length)) return p;
  return "salle";
}
const joursProgramme = prog => Object.keys(infoProgramme(prog).days).map(Number);
/* Séance prévue une date donnée (null = repos) */
function seanceDuJour(iso, prog) {
  const code = infoProgramme(prog).days[jourSem(iso)];
  if (!code) return null;
  if (prog === "maison") {
    const s = MAISON.find(x => x.code === code);
    return { prog, code, label: "Maison " + code, titre: s?.titre || "" };
  }
  const s = (prog === "salle" ? PPL_SEANCES : seancesPerso(DB.get("programmes").find(p => p.id === prog))).find(x => x.id === code);
  return { prog, code, label: code, titre: s?.focus || "" };
}
const seanceCreneau = () => (CRENEAUX[profil().creneau] || CRENEAUX.midi).seance;

/* Muscles */
const _muscleLib = Object.fromEntries(EXO_LIB);
const musclesPerso = memo(() => {
  const m = {};
  DB.get("programmes").forEach(p => (p.seances || []).forEach(s => (s.ex || []).forEach(e => { if (e.muscle) m[e.nom] = e.muscle; })));
  return m;
});
const muscleDe = nom => MUSCLE_DE[nom] || musclesPerso()[nom] || _muscleLib[nom] || null;
const JAMBES = ["Quadriceps", "Ischios", "Fessiers", "Mollets"], HAUT = ["Pecs", "Dos", "Épaules", "Biceps", "Triceps"];
const regionDe = nom => { const m = muscleDe(nom); return JAMBES.includes(m) ? "legs" : HAUT.includes(m) ? "upper" : null; };
const REGION_FR = { legs: "jambes", upper: "haut du corps", both: "corps entier" };
/* Jambes, haut du corps ou les deux : d'après la répartition des séries prévues */
function regionSeance(s) {
  if (!s) return null;
  if (s.prog === "maison") {
    const r = REGION_MAISON[s.code] || ["legs", "upper"];
    return r.length > 1 ? "both" : r[0];
  }
  const se = seanceParId(s.code);
  if (!se) return "both";
  let J = 0, H = 0;
  se.exercices.forEach(e => {
    const r = regionDe(e.nom), n = fourchette(e.detail)?.sets || 3;
    if (r === "legs") J += n; else if (r === "upper") H += n;
  });
  return J + H === 0 ? "both" : J >= .7 * (J + H) ? "legs" : H >= .7 * (J + H) ? "upper" : "both";
}

/* « 4×8-10 » → { sets: 4, lo: 8, hi: 10 }. Les durées (« 3×45s ») renvoient null. */
function fourchette(detail) {
  const d = String(detail || "");
  if (/\ds\s*$/.test(d.trim()) || /\d\s*s\b/.test(d)) return null;
  const m = d.match(/(\d+)\s*[×xX]\s*(\d+)(?:\s*[-–]\s*(\d+))?/);
  return m ? { sets: +m[1], lo: +m[2], hi: m[3] ? +m[3] : +m[2] } : null;
}
const detailSeries = d => { const m = String(d || "").match(/(\d+)\s*[×xX]\s*(\d+)/); return m ? { sets: +m[1], reps: +m[2] } : null; };
const fmtFourchette = r => r ? (r.lo === r.hi ? String(r.lo) : r.lo + "-" + r.hi) : "";
const parseCharge = s => { const m = String(s ?? "").match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(",", ".")) : null; };
/* « 2 min » → 120, « 2-3 min » → 150, « 45-60 s » → 53 */
function parseRepos(txt) {
  const n = (String(txt || "").match(/\d+/g) || ["90"]).map(Number), v = n.length > 1 ? (n[0] + n[1]) / 2 : n[0];
  return Math.round(/min/.test(txt) ? v * 60 : v);
}
function reposDe(idSeance, nom) {
  const r = seanceParId(idSeance)?.exercices.find(e => e.nom === nom)?.rest;
  if (r) return r >= 60 && r % 60 === 0 ? r / 60 + " min" : r + " s";
  return REPOS[idSeance + ":" + nom] || "90 s";
}

/* Import d'un programme écrit librement : « Lundi — Haut A », « Nom 4x8-10 80kg 2min », « Nom 3 séries de 12 » */
const JOURS_FR = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 };
const DEVINE_MUSCLE = [[/leg curl|ischio|rdl|good morning|nordic|jambes tendues/i, "Ischios"], [/mollet|calf/i, "Mollets"], [/hip thrust|fessier|glute|pont |abduction/i, "Fessiers"], [/squat|presse|fente|leg ext|quadri|step|hack/i, "Quadriceps"], [/curl/i, "Biceps"], [/triceps|dips|barre au front|kickback|extension/i, "Triceps"], [/militaire|épaule|epaule|élévation|elevation|arnold|face pull|oiseau|shoulder/i, "Épaules"], [/tirage|rowing|row|traction|pull|soulevé de terre|deadlift|shrug/i, "Dos"], [/couch|inclin|décliné|pec|pompe|écarté|bench/i, "Pecs"], [/gainage|abdo|crunch|planche|core|relevé|twist/i, "Abdos"]];
const devineMuscle = nom => { const g = DEVINE_MUSCLE.find(([re]) => re.test(nom + " ")); return g ? g[1] : ""; };
function nomsUniques(seances) {
  const vus = {};
  return seances.map(s => {
    const base = (s.nom || "").trim() || "Séance";
    let k = base, i = 2;
    while (vus[k.toLowerCase()]) k = base + " " + i++;
    vus[k.toLowerCase()] = 1;
    return { ...s, nom: k };
  });
}
function lireProgramme(texte) {
  const lignes = String(texte || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const reSerie = /(\d+)\s*(?:[x×*]|s[ée]ries?\s*(?:de|x)?)\s*(\d+)(?:\s*(?:[-–à\/]|to)\s*(\d+))?/i;
  const seances = [], rejets = [];
  let name = "", cur = null;
  lignes.forEach((brut, i) => {
    const l = brut.replace(/^(?:[-•*·▪➤>]|\d+[.)])\s+/, "");
    const titre = l.match(/^programme\s*[:\-–—]\s*(.+)$/i);
    if (titre) { name = titre[1].trim(); return; }
    const m = l.match(reSerie);
    if (m && m.index > 0) {
      const nom = l.slice(0, m.index).replace(/[:\-–—,(@]+\s*$/, "").trim();
      const apres = l.slice(m.index + m[0].length);
      const kg = apres.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
      const rp = apres.replace(/\d+(?:[.,]\d+)?\s*kg/ig, "").match(/(\d+(?:[.,]\d+)?)\s*(min|mn|'|’|sec|s)(?![a-zà-ÿ])/i);
      const rest = rp ? Math.round(parseNb(rp[1]) * (/^m|'|’/i.test(rp[2]) ? 60 : 1)) : 90;
      if (!cur) { cur = { nom: "Séance A", days: [], ex: [] }; seances.push(cur); }
      cur.ex.push({ nom, muscle: muscleDe(nom) || devineMuscle(nom), sets: +m[1], lo: +m[2], hi: m[3] ? Math.max(+m[2], +m[3]) : +m[2], kg: kg ? parseNb(kg[1]) : 0, rest, note: "" });
      return;
    }
    const bas = l.toLowerCase(), jour = Object.keys(JOURS_FR).find(j => bas.startsWith(j));
    if (jour || /:$/.test(l) || /^(jour|s[ée]ance|day|j)\s*\d+/i.test(l) || (l.length <= 32 && !/\d/.test(l))) {
      let nom = l.replace(/:$/, "");
      if (jour) nom = nom.slice(jour.length).replace(/^\s*[—–\-:,]*\s*/, "");
      nom = nom.trim();
      if (cur && !cur.ex.length) { // deux titres de suite (« Lundi » puis « Haut A ») = une seule séance
        if (nom) cur.nom = nom;
        if (jour && !cur.days.includes(JOURS_FR[jour])) cur.days.push(JOURS_FR[jour]);
      } else {
        cur = { nom: nom || ("Séance " + "ABCDEFGH"[seances.length % 8]), days: jour ? [JOURS_FR[jour]] : [], ex: [] };
        seances.push(cur);
      }
      return;
    }
    rejets.push({ i: i + 1, l });
  });
  return { name: name || "Programme importé", seances: nomsUniques(seances.filter(s => s.ex.length)), rejets };
}
/* Copie modifiable du PPL : charges de la phase choisie, repos et jours */
function copiePPL() {
  const phase = +DB.get("sport-phase") || 0, days = PROGRAMMES.salle.days;
  return {
    id: nouvelId("p"), name: "PPL Salle (copie)",
    seances: PPL_SEANCES.map(s => ({
      nom: s.id, days: Object.keys(days).filter(d => days[d] === s.id).map(Number),
      ex: s.exercices.map(e => {
        const r = fourchette(e.detail) || { sets: 3, lo: 10, hi: 10 };
        return { nom: e.nom, muscle: muscleDe(e.nom) || "", sets: r.sets, lo: r.lo, hi: r.hi, kg: parseCharge(e.charges[phase]) || 0, rest: parseRepos(reposDe(s.id, e.nom)), note: e.note || "" };
      }),
    })),
  };
}
