"use strict";
/* ENTRAÎNEMENT — progression des charges, volume, records, décharge.
 *
 * Cycle de progression, sur chaque exercice :
 *  1. Fourchette du programme (10-12) : haut atteint à difficulté ≤ 8 → la charge MONTE et la fourchette DESCEND de 2 reps (8-10).
 *  2. Fourchette basse (8-10) : haut atteint à difficulté ≤ 8 → même charge, on REMONTE à la fourchette du programme.
 * Dans une fourchette : +1 rep par séance ; difficulté ≥ 9,5 ou sous le bas de la fourchette = on consolide.
 * L'étape en cours se déduit de l'historique : rien à régler à la main. */
const BAISSE_FOURCHETTE = 2;
const fourchetteBasse = r => { const lo = Math.max(3, r.lo - BAISSE_FOURCHETTE); return { lo, hi: Math.max(lo, r.hi - BAISSE_FOURCHETTE) }; };
const fourchetteProgramme = (idSeance, nom) => {
  const p = seanceParId(idSeance)?.exercices.find(x => x.nom === nom);
  return p ? fourchette(p.detail) : null;
};
const pasDeCharge = nom => ["Quadriceps", "Ischios", "Fessiers"].includes(muscleDe(nom)) ? 5 : 2.5;
/* Max estimé (Epley) */
const maxEstime = (w, reps) => (!w || !reps || reps < 1) ? 0 : Math.round(w * (1 + reps / 30));
const seriesDe = e => e.setsDetail?.length || e.sets || 0;
const volumeExo = e => e.setsDetail?.length ? e.setsDetail.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0) : (e.weight || 0) * (e.reps || 0) * (e.sets || 0);
const volumeSeance = l => (l.exercices || []).reduce((a, e) => a + volumeExo(e), 0);
const meilleurMax = e => e.setsDetail?.length ? Math.max(...e.setsDetail.map(s => maxEstime(s.w, s.r))) : maxEstime(e.weight, e.reps);
const fmtSeries = e => e.setsDetail?.length ? e.setsDetail.map(s => nb(s.w) + "×" + s.r).join(" · ") : e.sets + "×" + e.reps;
/* Reps « limitantes » : la plus faible des séries à la charge max quand le détail existe */
const repsLimitantes = e => e.setsDetail?.length ? Math.min(...e.setsDetail.filter(s => s.w === e.weight).map(s => s.r)) : e.reps;
const difficulteMoyenne = exs => { const v = exs.filter(e => e.rpe > 0).map(e => e.rpe); return v.length ? arrondi(moyenne(v)) : null; };

function dernierExo(logs, idSeance, nom) {
  const l = (logs || []).filter(x => !x.deload && x.seance === idSeance && (x.exercices || []).some(e => e.nom === nom && e.weight > 0))
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
  return l ? { ...l.exercices.find(e => e.nom === nom), date: l.date, dateISO: l.dateISO } : null;
}
/* "low" si la dernière séance de cet exercice était en fourchette basse, sinon "prog" */
function etapeFourchette(logs, idSeance, nom, r) {
  const hist = (logs || []).filter(l => !l.deload && l.seance === idSeance).sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map(l => (l.exercices || []).find(e => e.nom === nom)).filter(e => e && e.weight > 0);
  let etape = "prog", prec = null;
  for (const e of hist) {
    if (prec) {
      if (e.weight > prec.weight) etape = "low";
      else if (etape === "low" && e.weight === prec.weight && repsLimitantes(prec) >= fourchetteBasse(r).hi) etape = "prog";
    }
    prec = e;
  }
  return etape;
}
/* La décision du coach pour la prochaine fois, d'après la dernière performance `e` */
function progression(idSeance, e, recup, logs) {
  const r = fourchetteProgramme(idSeance, e.nom), pas = pasDeCharge(e.nom), reps = repsLimitantes(e);
  if (!r) return { action: recup ? "hold" : "keep", weight: e.weight, reps, txt: (recup ? "mode récup : " : "") + "garde " + nb(e.weight) + " kg" };
  const basse = etapeFourchette(logs, idSeance, e.nom, r) === "low", cur = basse ? fourchetteBasse(r) : r;
  if (recup) return { action: "hold", weight: e.weight, reps, range: cur, txt: "mode récup : garde " + nb(e.weight) + " kg × " + fmtFourchette(cur) };
  if (reps >= cur.hi && (!e.rpe || e.rpe <= 8)) {
    if (basse) return { action: "range", weight: e.weight, reps: Math.min(cur.hi + 1, r.hi), range: r, txt: "garde " + nb(e.weight) + " kg, remonte à " + fmtFourchette(r) + " reps" };
    const nr = fourchetteBasse(r);
    return { action: "up", weight: e.weight + pas, reps: nr.lo, range: nr, txt: "+" + nb(pas) + " kg → " + nb(e.weight + pas) + " kg × " + fmtFourchette(nr) };
  }
  if (e.rpe >= 9.5 || reps < cur.lo) return { action: "hold", weight: e.weight, reps: Math.max(reps, cur.lo), range: cur, txt: "reste à " + nb(e.weight) + " kg × " + fmtFourchette(cur) + " (consolide)" };
  return { action: "reps", weight: e.weight, reps: reps + 1, range: cur, txt: "garde " + nb(e.weight) + " kg, vise " + (reps + 1) + " reps (" + fmtFourchette(cur) + ")" };
}
const repsImposees = (cfg, cle) => cfg?.repOverrides?.[cle] || null;
/* Fourchette en cours si elle diffère du programme */
function fourchetteEnCours(logs, cfg, idSeance, nom) {
  const ro = repsImposees(cfg, idSeance + ":" + nom), ov = cfg?.weightOverrides?.[idSeance + ":" + nom];
  const r = fourchetteProgramme(idSeance, nom), der = dernierExo(logs, idSeance, nom);
  if (ro && !(der && ov && der.weight >= ov)) return { range: ro, src: "science" };
  if (!r || !der) return null;
  const p = progression(idSeance, der, false, logs);
  return p.range && fmtFourchette(p.range) !== fmtFourchette(r) ? { range: p.range, src: "auto" } : null;
}
/* Sous 50 le matin (ou réglage manuel) : aucune hausse de charge ce jour-là */
const modeRecup = cfg => {
  if (cfg?.recovery) return true;
  const r = recuperation(aujourdhui());
  return !!(r && r.score != null && r.score < 50);
};
/* Charge proposée : objectif réglé à la main s'il n'est pas atteint, sinon décision du coach ;
   la charge de la phase sert de plancher, puis −40 % en semaine légère. */
function proposition(logs, idSeance, ex, phase, cfg) {
  const d = detailSeries(ex.detail), ov = cfg?.weightOverrides?.[idSeance + ":" + ex.nom], der = dernierExo(logs, idSeance, ex.nom);
  const ro = repsImposees(cfg, idSeance + ":" + ex.nom);
  let weight = null, reps = d ? d.reps : null, src = "phase", action = null, txt = null;
  if (ov && !(der && der.weight >= ov)) {
    weight = ov;
    if (ro) reps = ro.lo;
    src = "science";
  } else if (der) {
    const p = progression(idSeance, der, modeRecup(cfg), logs);
    weight = p.weight; reps = p.reps || reps; src = "coach"; action = p.action; txt = p.txt;
  }
  const plancher = parseCharge(ex.charges[phase]);
  if (plancher && (!weight || plancher > weight)) { weight = plancher; reps = d ? d.reps : reps; src = "phase"; action = null; txt = null; }
  if (cfg?.deload && weight) weight = Math.round(weight * .6 * 2) / 2;
  return { weight, sets: d ? d.sets : null, reps, src, action, txt };
}
const meilleureCharge = (logs, nom, sauf) => {
  let best = 0;
  logs.forEach(l => { if (l.id !== sauf) l.exercices.forEach(e => { if (e.nom === nom && e.weight > best) best = e.weight; }); });
  return best;
};
/* Max estimé actuel : meilleur des 3 dernières séances, avec la tendance */
function maxActuel(logs, nom) {
  const s = (logs || []).filter(l => !l.deload && (l.exercices || []).some(e => e.nom === nom)).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const v = s.map(l => { const e = l.exercices.find(x => x.nom === nom); return e ? maxEstime(e.weight, e.reps) : 0; }).filter(x => x > 0);
  if (!v.length) return null;
  const cur = Math.max(...v.slice(-3)), avant = v.length > 3 ? Math.max(...v.slice(0, -3)) : null;
  return { rm: cur, trend: avant != null ? (cur > avant ? "up" : cur < avant ? "down" : "flat") : null, n: v.length };
}
/* Échauffement progressif avant une charge lourde : ménage tendons et genou */
function echauffement(charge) {
  if (!charge || charge < 30) return [];
  const a25 = x => Math.max(2.5, Math.round(x / 2.5) * 2.5);
  return [[.5, 8], [.7, 4], [.85, 2]].map(([p, r]) => ({ w: a25(charge * p), r }));
}
/* Disques par côté */
const DISQUES = [25, 20, 15, 10, 5, 2.5, 1.25];
function disquesPour(cible, barre) {
  if (cible == null || isNaN(cible) || cible < barre) return null;
  const par = (cible - barre) / 2;
  let reste = par;
  const res = [];
  for (const p of DISQUES) { let c = 0; while (reste >= p - 1e-9) { reste -= p; c++; } if (c) res.push({ p, c }); }
  return { res, total: arrondi(barre + 2 * (par - reste), 2), manque: arrondi(reste * 2, 2) };
}
/* Séries par muscle sur n jours */
function volumeMuscles(jours) {
  const lim = new Date(); lim.setDate(lim.getDate() - (jours || 7));
  const v = {};
  DB.get("sport-logs").filter(l => !l.deload && dateDe(l.dateISO) >= lim).forEach(l => (l.exercices || []).forEach(e => {
    const m = muscleDe(e.nom);
    if (m && e.sets > 0 && e.weight > 0) v[m] = (v[m] || 0) + e.sets;
  }));
  return v;
}
/* Douleurs ≥ 4/10 sur n jours : intensité max par zone */
function douleursRecentes(jours) {
  const m = {};
  DB.get("douleur-logs").filter(l => dansLes(l.dateISO, jours || 10) && (l.intensite || 0) >= 4).forEach(l => {
    const c = m[l.zone];
    if (!c || l.intensite > c.i || (l.intensite === c.i && l.dateISO > c.d)) m[l.zone] = { i: l.intensite, d: l.dateISO };
  });
  return m;
}
const douleurSur = (nom, douleurs) => {
  const mu = muscleDe(nom);
  return Object.entries(douleurs).filter(([z]) => (IMPACT_DOULEUR[z] || []).includes(mu)).map(([z, v]) => ({ zone: z, ...v }));
};
/* Faut-il une semaine légère ? */
function conseilDecharge() {
  const logs = DB.get("sport-logs");
  if (!logs.length) return { level: "none", raisons: [] };
  const asc = [...logs].sort((a, b) => a.dateISO.localeCompare(b.dateISO)), normales = asc.filter(l => !l.deload);
  if (normales.length < 4) return { level: "none", raisons: [] };
  const raisons = [], dernier = [...asc].reverse().find(l => l.deload);
  const ref = dateDe((dernier || asc[0]).dateISO);
  const semaines = arrondi((new Date() - ref) / (7 * 86400000));
  if (semaines >= 6) raisons.push(Math.round(semaines) + " semaines sans semaine légère");
  const rpes = normales.slice(-3).map(l => difficulteMoyenne(l.exercices || [])).filter(x => x != null);
  const rpe = rpes.length ? arrondi(moyenne(rpes)) : null;
  if (rpe != null && rpe >= 9) raisons.push("difficulté moyenne " + nb(rpe) + "/10");
  const parSeance = {};
  normales.forEach(l => (parSeance[l.seance] = parSeance[l.seance] || []).push(l));
  let recul = 0, jugees = 0;
  Object.values(parSeance).forEach(a => {
    if (a.length < 2) return;
    jugees++;
    const d = volumeSeance(a[a.length - 1]), p = volumeSeance(a[a.length - 2]);
    if (d > 0 && p > 0 && d < p * .97) recul++;
  });
  if (jugees >= 2 && recul >= 2) raisons.push("volume en baisse sur " + recul + " séances");
  let level = raisons.length >= 2 ? "deload" : raisons.length === 1 ? "watch" : "ok";
  if (semaines >= 8) level = "deload";
  return { level, raisons, semaines };
}
/* Série en cours : nombre de jours consécutifs (hier compte si aujourd'hui est vide) */
function serie(dates) {
  const set = new Set(dates);
  if (!set.size) return { current: 0, best: 0 };
  const tri = [...set].sort();
  let best = 1, run = 1;
  for (let i = 1; i < tri.length; i++) { run = ecart(tri[i - 1], tri[i]) === 1 ? run + 1 : 1; if (run > best) best = run; }
  let c = aujourdhui();
  if (!set.has(c)) { c = decale(c, -1); if (!set.has(c)) return { current: 0, best }; }
  let cur = 0;
  while (set.has(c)) { cur++; c = decale(c, -1); }
  return { current: cur, best };
}

/* NATATION
 * "natation-modeles" = séances types, "natation-logs" = séances faites, enregistrées en sortant de l'eau. */
const nageDistance = m => (m?.blocks || []).reduce((a, b) => a + (parseInt(b.reps) || 0) * (parseInt(b.d) || 0), 0);
const nageDuree = m => (m?.blocks || []).reduce((a, b) => {
  const r = parseInt(b.reps) || 0, d = parseInt(b.d) || 0;
  return a + (b.mode === "dep" && b.dep ? r * b.dep : r * (d / 100 * (m.pace || 150) + (parseInt(b.rest) || 0)));
}, 0);
const allure = (dist, sec) => dist > 0 && sec > 0 ? sec / dist * 100 : null;
/* Dépense : MET selon l'allure (ou le ressenti) × poids × durée */
function nageKcal(dist, sec, rpe, kg) {
  const p = allure(dist, sec);
  const met = p ? (p < 110 ? 10 : p < 140 ? 8.3 : p < 180 ? 7 : 5.8) : (rpe >= 8 ? 9.5 : rpe >= 6 ? 8 : 6);
  return Math.round(met * (kg || 100) * sec / 3600);
}
const nageKcalDu = iso => DB.get("natation-logs").filter(l => l.dateISO === iso).reduce((a, l) => a + (l.kcal || 0), 0);
const nagePrevue = iso => { const d = jourSem(iso); return DB.get("natation-modeles").find(m => (m.days || []).includes(d)) || null; };
const nageJours = () => new Set(DB.get("natation-modeles").flatMap(m => m.days || [])).size;
/* Toutes les nages : notées dans RECOMP (reliées ou non à la montre) et celles restées seulement sur la montre */
function nagesToutes() {
  const logs = DB.get("natation-logs").map(l => ({ dateISO: l.dateISO, distance: +l.distance || 0, duree: +l.duree || 0, sortie: sortieDeNage(l), log: l }));
  const prises = new Set(logs.map(x => x.sortie?.id).filter(Boolean));
  const seules = sortiesPolar().filter(s => familleSortie(s) === "nage" && !prises.has(s.id)).map(s => ({ dateISO: s.dateISO, distance: s.distance || 0, duree: s.duree || 0, sortie: s }));
  return [...logs, ...seules].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}
/* Meilleurs temps : la meilleure suite de 100 m consécutifs d'une nage de la montre (repos compris),
 * ou une nage notée à la main dont la distance est exactement celle-là */
const DISTANCES_NAGE = [100, 200, 400, 800, 1000, 1500];
function recordsNage(nages = nagesToutes()) {
  return DISTANCES_NAGE.map(D => {
    let best = null;
    const garder = (s, x) => { if (s > 0 && (!best || s < best.s)) best = { s, dateISO: x.dateISO, sortie: x.sortie?.id || null }; };
    for (const x of nages) {
      if (x.distance === D && x.duree) garder(x.duree, x);
      const t = x.sortie?.tours || [], k = D / 100;
      for (let i = 0; i + k <= t.length; i++) {
        const bout = t.slice(i, i + k);
        if (bout.every(y => y.d === 100)) garder(bout.reduce((a, y) => a + y.s, 0), x);
      }
    }
    return { d: D, ...(best || {}) };
  });
}
// Allure moyenne aux 100 m sur une période, et l'écart avec la période d'avant (en secondes, négatif = plus rapide)
function tendanceNage(jours = 28, nages = nagesToutes()) {
  const auj = aujourdhui(), moy = l => { const d = l.reduce((a, x) => a + x.distance, 0); return d ? l.reduce((a, x) => a + x.duree, 0) / d * 100 : null; };
  const ok = nages.filter(x => x.distance >= 200 && x.duree > 0);
  const recent = ok.filter(x => ecart(x.dateISO, auj) < jours), avant = ok.filter(x => { const e = ecart(x.dateISO, auj); return e >= jours && e < 2 * jours; });
  const a = moy(recent), b = moy(avant);
  return { allure: a, avant: b, ecart: a && b ? Math.round(a - b) : null };
}
const ligneBloc = b => (b.reps > 1 ? b.reps + " × " : "") + b.d + " m " + String(b.nage).toLowerCase() + (b.mat && b.mat !== "—" ? ", " + b.mat.toLowerCase() : "") + (b.mode === "dep" && b.dep ? ", départ toutes les " + mmss(b.dep) : b.rest ? ", " + b.rest + " s de repos" : "") + (b.note ? ", " + b.note : "");
