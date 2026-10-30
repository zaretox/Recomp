"use strict";
/* NUTRITION — du poids à l'assiette :
 * poids moyen 7 j → masse maigre (méthode Navy) → cible calorique → macros → menu recalé pile sur la cible. */
const KCAL_PAR_KG = 7700;
const COUPE_REPOS = 400;   // kcal de moins les jours de repos
const RYTHME_MAX = -1.0, RYTHME_MIN = -.5, RYTHME_LENT = -.25, DELAI_AJUSTEMENT = 10;

const pesees = memo(() => DB.get("nutri-logs").filter(l => l.weight > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, date: l.date, kg: l.weight })));
const metabolisme = (kg, cm, age, sex) => (!kg || !cm || !age) ? null : Math.round(10 * kg + 6.25 * cm - 5 * age + (sex === "F" ? -161 : 5));
const macrosPour = (kcal, prot) => {
  const lipK = Math.round(kcal * .25);
  return { p: prot, l: Math.round(lipK / 9), g: Math.max(0, Math.round((kcal - prot * 4 - lipK) / 4)) };
};
const proteinesPour = (kg, maigre, mode) => mode === "lean"
  ? (maigre > 0 ? Math.round(2.2 * maigre) : Math.round(1.8 * kg))
  : Math.round((parseFloat(mode) || 1.8) * kg);
const moyenneRecente = (pts, n) => {
  const w = [...pts].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, n).map(x => x.kg);
  return w.length ? arrondi(moyenne(w)) : null;
};
/* Réglages caloriques. Très anciennes versions : déficit en %, converti en −700 kcal. */
function cfgCalories() {
  const c = DB.get("nutri-cal-cfg");
  if (!c) return null;
  return { sex: c.sex || "H", age: c.age != null ? c.age : "", activity: c.activity || 1.55, deficit: (c.deficit > 0 && c.deficit <= 40) ? 700 : (c.deficit != null ? c.deficit : 700), protMode: c.protMode || "lean", lastAdjust: c.lastAdjust || null, depense: c.depense || null };
}
function masseGrasseNavy(taille, cou, cm) {
  if (!taille || !cou || !cm || taille <= cou) return null;
  const bf = 495 / (1.0324 - .19077 * Math.log10(taille - cou) + .15456 * Math.log10(cm)) - 450;
  return arrondi(borne(bf, 2, 60));
}
const maigreEtGras = (kg, bf) => {
  if (!kg || bf == null) return null;
  const fat = arrondi(kg * bf / 100);
  return { fat, lean: arrondi(kg - fat) };
};
function poidsProche(pts, iso) {
  if (!pts.length) return null;
  const t = dateDe(iso).getTime();
  let best = null, ec = Infinity;
  pts.forEach(x => { const d = Math.abs(dateDe(x.dateISO).getTime() - t); if (d < ec) { ec = d; best = x; } });
  return best ? best.kg : null;
}
/* Calcul unique : Jour, Repas, Corps et le coach lisent tous celui-ci */
const objectifs = memo(() => {
  const nLogs = DB.get("nutri-logs"), mens = DB.get("mensurations"), cm = parseFloat(DB.get("taille-corps")) || 0, cfg = cfgCalories();
  const pts = nLogs.filter(l => l.weight > 0).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
  const curW = moyenneRecente(pts, 7), age = cfg ? parseInt(cfg.age) || 0 : 0;
  let lean = 0;
  const m = [...mens].reverse().find(x => x.vals && x.vals.taille > 0 && x.vals.cou > 0);
  if (m && cm) {
    const bf = masseGrasseNavy(m.vals.taille, m.vals.cou, cm), w = poidsProche(pts, m.dateISO) || curW, lf = w && bf != null ? maigreEtGras(w, bf) : null;
    if (lf) lean = lf.lean;
  }
  const ready = !!(curW && cm && age && cfg);
  let cal = null;
  if (ready) {
    const bmr = metabolisme(curW, cm, age, cfg.sex);
    const tdee = cfg.depense || Math.round(bmr * cfg.activity);  // dépense mesurée si tu l'as adoptée au bilan, sinon formule
    const t = tdee - (cfg.deficit || 0), target = Math.max(t, bmr);
    cal = { bmr, tdee, target, clamped: target !== t };
  }
  const prot = ready ? proteinesPour(curW, lean, cfg.protMode || "lean") : 0;
  return { curW, age, lean, ready, cal, prot, macros: cal ? macrosPour(cal.target, prot) : null };
});

/* Mise à l'échelle du menu : les aliments « fix » (1 œuf, 1 galette) ne bougent pas, les autres sont rangés
   par macro dominante et chaque groupe reçoit un facteur. Les 3 facteurs résolvent le système exact ;
   si la solution n'est pas réaliste, on retombe sur une approximation par macro dominante. */
function echelleMenu(repas, cible) {
  const dom = it => { const pk = (it.p || 0) * 4, gk = (it.g || 0) * 4, lk = (it.l || 0) * 9, mx = Math.max(pk, gk, lk); return mx <= 0 ? null : (mx === pk ? "p" : mx === lk ? "l" : "g"); };
  const fix = { p: 0, g: 0, l: 0 }, grp = { p: { p: 0, g: 0, l: 0 }, g: { p: 0, g: 0, l: 0 }, l: { p: 0, g: 0, l: 0 } };
  repas.forEach(m => m.items.forEach(it => {
    if (it.t) return;
    const d = it.fix ? null : dom(it), T = d ? grp[d] : fix;
    T.p += it.p || 0; T.g += it.g || 0; T.l += it.l || 0;
  }));
  const total = (fix.p + grp.p.p + grp.g.p + grp.l.p) * 4 + (fix.g + grp.p.g + grp.g.g + grp.l.g) * 4 + (fix.l + grp.p.l + grp.g.l + grp.l.l) * 9;
  const plat = cible && total ? cible.kcal / total : 1;
  let f = { p: plat, g: plat, l: plat };
  if (cible) {
    const K = ["p", "g", "l"], A = K.map(m => K.map(g => grp[g][m])), b = K.map(m => cible[m] - fix[m]);
    const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A);
    const exact = Math.abs(D) > 1e-6 ? K.map((_, j) => det(A.map((row, i) => row.map((v, k) => k === j ? b[i] : v))) / D) : null;
    if (exact && exact.every(x => x >= .2 && x <= 4)) f = { p: exact[0], g: exact[1], l: exact[2] };
    else f = { p: grp.p.p ? Math.max(cible.p - fix.p, 0) / grp.p.p : plat, g: grp.g.g ? Math.max(cible.g - fix.g, 0) / grp.g.g : plat, l: grp.l.l ? Math.max(cible.l - fix.l, 0) / grp.l.l : plat };
  }
  const itemF = it => { if (it.fix) return 1; const d = dom(it); return d ? f[d] : plat; };
  return { itemF, factors: f };
}
/* Repas du jour (variante choisie) aux horaires du profil, dans l'ordre de la journée */
function planDuJour(dayType, alts) {
  const pr = profil(), cr = CRENEAUX[pr.creneau] || CRENEAUX.midi, base = dayType === "training" ? REPAS_ENTRAINEMENT : REPAS_REPOS;
  const meals = base.map(m => {
    const ai = (alts || {})[dayType + ":" + m.m] || 0;
    let out = { ...m };
    if (ai > 0 && m.alts && m.alts[ai - 1]) {
      const its = m.alts[ai - 1].items;
      const P = its.reduce((a, i) => a + (i.p || 0), 0), G = its.reduce((a, i) => a + (i.g || 0), 0), L = its.reduce((a, i) => a + (i.l || 0), 0);
      out = { ...out, items: its, P, G, L, kcal: P * 4 + G * 4 + L * 9, altLabel: m.alts[ai - 1].label };
    }
    if (dayType === "training") out.h = cr.times[m.m] || m.h;
    if (m.m === "Déjeuner" && dayType === "training") out.note = pr.creneau === "midi" ? "Post-séance : mange dans l'heure qui suit." : null;
    return out;
  }).sort((a, b) => hEnMin(a.h) - hEnMin(b.h));
  return { meals, seance: dayType === "training" ? cr.seance : null };
}
/* Menu complet d'un jour : cible (−400 kcal au repos, + natation) et portions recalées */
function menuDuJour(dayType, extra) {
  const bt = objectifs(), plan = planDuJour(dayType, DB.get("repas-alts"));
  const base = bt.cal ? bt.cal.target : MACROS_DEFAUT.kcal, nage = Math.max(0, Math.round(extra || 0));
  const dayTgt = (dayType === "rest" ? Math.max(base - COUPE_REPOS, bt.cal ? bt.cal.bmr : 0) : base) + nage;
  const dayMacros = macrosPour(dayTgt, bt.cal ? bt.prot : MACROS_DEFAUT.p);
  const { itemF } = echelleMenu(plan.meals, { ...dayMacros, kcal: dayTgt });
  const mealMacros = plan.meals.map(r => r.items.reduce((a, it) => it.t ? a : { p: a.p + it.p * itemF(it), g: a.g + it.g * itemF(it), l: a.l + it.l * itemF(it) }, { p: 0, g: 0, l: 0 }));
  return { ...plan, dayTgt, swimExtra: nage, dayMacros, itemF, mealMacros };
}
const kcalMacros = m => m.p * 4 + m.g * 4 + m.l * 9;

/* Tout ce qui décrit un jour côté assiette */
const jourNutrition = memo(iso => {
  const nlog = DB.get("nutri-logs").find(l => l.dateISO === iso) || null;
  const prevu = seanceDuJour(iso, programmeEnCours()) ? "training" : "rest", dayType = nlog?.dayType || prevu;
  const menu = menuDuJour(dayType, nageKcalDu(iso));
  const coches = nlog?.meals || {}, echelles = nlog?.mealScale || {};
  const lignes = menu.meals.map((m, i) => {
    const id = MEAL_ID[m.m], mm = menu.mealMacros[i], s = echelles[id] || 1;
    return { id, m, i, kcal: Math.round(kcalMacros(mm) * s), macros: { p: mm.p * s, g: mm.g * s, l: mm.l * s }, fait: !!coches[id] };
  }).filter(r => r.id);
  const plats = (DB.get("food-log")[iso] || []);
  const horsMenu = plats.filter(f => !f.plan), planifies = plats.filter(f => f.plan);
  const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);
  const faits = lignes.filter(r => r.fait);
  const cochesKcal = sum(faits, "kcal"), horsKcal = sum(horsMenu, "kcal");
  const mange = {
    kcal: cochesKcal + horsKcal,
    p: faits.reduce((a, r) => a + r.macros.p, 0) + sum(horsMenu, "p"),
    g: faits.reduce((a, r) => a + r.macros.g, 0) + sum(horsMenu, "gl"),
    l: faits.reduce((a, r) => a + r.macros.l, 0) + sum(horsMenu, "l"),
  };
  // Le reste du jour est recalé : ce qui a été mangé en plus se retire des repas à venir (et inversement)
  const restants = lignes.filter(r => !r.fait), prevuRestant = sum(restants, "kcal");
  const reste = menu.dayTgt - mange.kcal;
  const facteurReste = prevuRestant > 0 ? borne(reste / prevuRestant, .6, 1.2) : 1;
  return { iso, nlog, dayType, prevu, menu, lignes, horsMenu, planifies, mange, reste, facteurReste: Math.abs(facteurReste - 1) < .04 ? 1 : facteurReste };
});
/* Calories réellement consommées un jour (null si rien de noté) */
const apportsDu = memo(iso => {
  const n = jourNutrition(iso), plan = n.planifies.reduce((a, f) => a + (f.kcal || 0), 0);
  const faites = n.mange.kcal - n.horsMenu.reduce((a, f) => a + (f.kcal || 0), 0);
  const kc = Math.max(faites, plan) + n.horsMenu.reduce((a, f) => a + (f.kcal || 0), 0);
  return kc > 0 ? kc : null;
});
/* Coche ou décoche un repas, au format de l'onglet Suivi historique */
function ecrireJour(iso, patch) {
  const logs = DB.get("nutri-logs"), ex = logs.find(l => l.dateISO === iso);
  const base = ex || { id: Date.now(), date: dateCourte(iso), dateISO: iso, weight: null, supps: {}, water: 0, sleep: null, stress: 5, meals: {}, mealsOk: 0, mealsTotal: 0, compliance: 0 };
  return DB.set("nutri-logs", [...logs.filter(l => l.dateISO !== iso), { ...base, ...patch }]);
}
function cocherRepas(iso, id) {
  const n = jourNutrition(iso), ids = n.lignes.map(r => r.id), meals = Object.fromEntries(ids.map(x => [x, !!n.nlog?.meals?.[x]]));
  meals[id] = !meals[id];
  const scale = { ...(n.nlog?.mealScale || {}) };
  if (meals[id] && n.facteurReste !== 1) scale[id] = arrondi(n.facteurReste, 2); else delete scale[id];
  const ok = ids.filter(x => meals[x]).length;
  return ecrireJour(iso, { dayType: n.dayType, meals, mealScale: scale, mealsOk: ok, mealsTotal: ids.length, compliance: Math.round(ok / ids.length * 100) });
}
function changerTypeJour(iso, dayType) {
  const n = jourNutrition(iso), meals = { ...(n.nlog?.meals || {}) };
  const ids = menuDuJour(dayType, 0).meals.map(m => MEAL_ID[m.m]).filter(Boolean), ok = ids.filter(x => meals[x]).length;
  return ecrireJour(iso, { dayType, meals, mealsOk: ok, mealsTotal: ids.length, compliance: Math.round(ok / ids.length * 100) });
}

/* TENDANCE DE POIDS — moyenne lissée : le chiffre qui compte, débarrassé des variations d'eau */
const tendancePoids = memo(() => {
  const pts = pesees();
  if (!pts.length) return [];
  const out = [{ ...pts[0], t: pts[0].kg }];
  for (let i = 1; i < pts.length; i++) {
    const a = 1 - Math.pow(.9, Math.max(1, ecart(pts[i - 1].dateISO, pts[i].dateISO)));
    out.push({ ...pts[i], t: out[i - 1].t + a * (pts[i].kg - out[i - 1].t) });
  }
  return out;
});
/* kg par semaine, régression sur les 8 dernières pesées */
function rythmeHebdo(pts) {
  const p = pts.slice(-8);
  if (p.length < 2) return null;
  const xs = p.map(x => ecart(p[0].dateISO, x.dateISO)), ys = p.map(x => x.kg), n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0), sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const den = n * sxx - sx * sx;
  return den === 0 ? null : arrondi((n * sxy - sx * sy) / den * 7, 2);
}
function dateObjectif(actuel, rythme, cible) {
  if (rythme == null || rythme === 0) return null;
  const sem = (cible - actuel) / rythme;
  return sem < 0 ? { atteignable: false } : { atteignable: true, semaines: arrondi(sem), date: decale(aujourdhui(), Math.round(sem * 7)) };
}
/* Rythme de perte face à la zone −0,5 à −1 %/semaine, et ajustement éventuel du déficit */
const rythme = memo(() => {
  const pts = pesees(), curW = moyenneRecente(pts, 7), cal = cfgCalories();
  const jours = pts.length >= 2 ? ecart(pts[0].dateISO, pts[pts.length - 1].dateISO) : 0;
  const kg = pts.length >= 3 && jours >= 10 ? rythmeHebdo(pts) : null;
  if (kg == null || !curW) return { kg, pct: null, curW };
  const pct = kg / curW * 100;
  const refroidi = cal?.lastAdjust && ecart(cal.lastAdjust, aujourdhui()) < DELAI_AJUSTEMENT;
  const nouveau = !cal ? null : pct < RYTHME_MAX ? Math.max(0, cal.deficit - 150) : pct > RYTHME_LENT ? Math.min(1000, cal.deficit + 150) : null;
  return { kg, pct, curW, nouveau: refroidi ? null : nouveau, refroidi, etat: pct < RYTHME_MAX ? "vite" : pct > RYTHME_LENT ? "lent" : pct > RYTHME_MIN ? "doux" : "ideal" };
});
/* DÉPENSE RÉELLE — ce que ton corps brûle vraiment, déduit de ce que tu manges et de l'évolution de ta tendance.
 * Dépense = apports moyens − (variation de tendance × 7 700 / jours). Indépendant de ton respect du plan. */
const depenseReelle = memo(() => {
  const t = tendancePoids(), fin = aujourdhui(), cal = objectifs().cal;
  const fenetre = t.filter(x => ecart(x.dateISO, fin) <= 28);
  if (fenetre.length < 4) return { pret: false, jours: fenetre.length };
  const debut = fenetre[0], der = fenetre[fenetre.length - 1], jours = ecart(debut.dateISO, der.dateISO);
  if (jours < 14) return { pret: false, jours };
  const notes = [];
  for (let i = 0; i <= jours; i++) { const a = apportsDu(decale(debut.dateISO, i)); if (a) notes.push(a); }
  if (notes.length < jours * .6) return { pret: false, jours: notes.length, manque: "repas" };
  const apports = moyenne(notes), kcal = Math.round(apports - (der.t - debut.t) * KCAL_PAR_KG / jours);
  return { pret: true, kcal: Math.round(kcal / 10) * 10, apports: Math.round(apports), jours, formule: cal?.tdee || null, ecart: cal ? Math.round(kcal - cal.tdee) : null };
});
/* Composition d'après les mensurations */
const composition = memo(() => {
  const cm = parseFloat(DB.get("taille-corps")) || 0, pts = pesees();
  return DB.get("mensurations").filter(m => m.vals.taille > 0 && m.vals.cou > 0).map(m => {
    const bf = masseGrasseNavy(m.vals.taille, m.vals.cou, cm), w = poidsProche(pts, m.dateISO), lf = w && bf != null ? maigreEtGras(w, bf) : null;
    return { date: m.date, dateISO: m.dateISO, bf, weight: w, lean: lf ? lf.lean : null, fat: lf ? lf.fat : null };
  });
});
/* Aliments : base + perso, recherche sans accents */
const tousAliments = memo(() => [...DB.get("foods-custom").map(f => ({ ...f, perso: true })), ...ALIMENTS]);
const alimentsRecents = memo(() => {
  const log = DB.get("food-log"), vus = new Map();
  Object.keys(log).sort().reverse().forEach(d => (log[d] || []).forEach(f => {
    if (!f.plan && f.grams && !vus.has(f.nom)) vus.set(f.nom, f);
  }));
  return [...vus.values()].slice(0, 8);
});
