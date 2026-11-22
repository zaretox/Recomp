"use strict";
/* NUTRITION — du poids à l'assiette :
 * poids moyen 7 j → masse maigre (méthode Navy) → cible calorique → macros → menu recalé pile sur la cible. */
const KCAL_PAR_KG = 7700;
const COUPE_REPOS = 400;   // ancien calcul (jours d'avant le calcul par séance) : kcal de moins les jours de repos
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
  return { sex: c.sex || "H", age: c.age != null ? c.age : "", activity: c.activity || 1.55, deficit: (c.deficit > 0 && c.deficit <= 40) ? 700 : (c.deficit != null ? c.deficit : 700), protMode: c.protMode || "lean", lastAdjust: c.lastAdjust || null, depense: c.depense || null,
    // Calcul par séance (depuis novembre 2026) ; seancesDepense : kcal de séances par jour contenues dans la dépense mesurée adoptée
    seances: !!c.seances, seancesDepense: c.seancesDepense > 0 ? c.seancesDepense : null };
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
  const cal = ready ? calculCible(cfg, curW, cm, age) : null;
  const prot = ready ? proteinesPour(curW, lean, cfg.protMode || "lean") : 0;
  return { curW, age, lean, ready, cal, prot, macros: cal ? macrosPour(cal.target, prot) : null };
});
// La cible : dépense (mesurée si tu l'as adoptée, sinon formule) moins ton objectif, jamais sous le métabolisme de base
function calculCible(cfg, curW, cm, age) {
  const bmr = metabolisme(curW, cm, age, cfg.sex), formule = Math.round(bmr * cfg.activity);
  const tdee = cfg.depense || formule, deficit = cfg.deficit || 0;
  // Calcul par séance : on part de la dépense sans séances (la formule l'est déjà ; la mesurée contient les séances
  // de l'époque, retirées ici), puis chaque séance du jour s'ajoute. target = un jour sans séance.
  const seances = !!cfg.seances, sansSeances = seances ? (cfg.depense ? cfg.depense - (cfg.seancesDepense || 0) : formule) : tdee;
  const t = sansSeances - deficit, target = Math.max(t, bmr);
  return { bmr, tdee, formule, seances, sansSeances, deficit, target, clamped: target !== t, deficitMax: Math.max(0, sansSeances - bmr) };
}

/* HISTORIQUE DES RÉGLAGES — « nutri-cal-historique » = [{ depuis, depense, deficit, activity, devine? }].
 * Un jour passé se recalcule avec les réglages qui étaient en place ce jour-là : changer de cible aujourd'hui
 * ne réécrit pas ce que tu as mangé hier (sinon ta dépense réelle bougeait à chaque changement). */
const historiqueCibles = () => [...(DB.get("nutri-cal-historique") || [])].sort((a, b) => a.depuis.localeCompare(b.depuis));
const configAu = iso => { const l = historiqueCibles().filter(x => x.depuis <= iso); return l[l.length - 1] || null; };
const objectifsAu = memo(iso => {
  const bt = objectifs(), h = configAu(iso), cfg = cfgCalories();
  if (!h || !bt.ready || !cfg) return bt;
  const c = { ...cfg, depense: h.depense || null, deficit: h.deficit ?? cfg.deficit, activity: h.activity || cfg.activity, seances: !!h.seances, seancesDepense: h.seancesDepense || null };
  if (!h.cible && (c.depense || null) === (cfg.depense || null) && c.deficit === cfg.deficit && c.activity === cfg.activity && c.seances === cfg.seances && c.seancesDepense === cfg.seancesDepense) return bt;
  let cal = calculCible(c, bt.curW, parseFloat(DB.get("taille-corps")) || 0, bt.age);
  // Une cible donnée telle quelle (« Autre chiffre » dans Ma cible) remplace le calcul pour ces jours-là
  if (h.cible > 0) cal = { ...cal, target: Math.max(h.cible, cal.bmr), clamped: false };
  return { ...bt, cal, macros: macrosPour(cal.target, bt.prot) };
});
// Seule façon de changer les réglages de la cible : l'historique suit
async function majCalories(p) {
  // Une première configuration part directement sur le calcul par séance
  const brut = DB.get("nutri-cal-cfg") || { seances: true }, avant = cfgCalories(), neuf = { ...brut, ...p };
  await DB.set("nutri-cal-cfg", neuf);
  const apres = cfgCalories();
  if (!apres || (avant && (avant.depense || null) === (apres.depense || null) && avant.deficit === apres.deficit && avant.activity === apres.activity
    && avant.seances === apres.seances && avant.seancesDepense === apres.seancesDepense)) return;
  const auj = aujourdhui(), l = historiqueCibles().filter(x => x.depuis !== auj);
  await DB.set("nutri-cal-historique", [...l, { depuis: auj, depense: apres.depense || null, deficit: apres.deficit, activity: apres.activity,
    ...(apres.seances ? { seances: true, seancesDepense: apres.seancesDepense } : {}) }]);
}
// Première fois : l'historique part des réglages actuels. Une dépense adoptée dans les 4 dernières semaines n'existait pas avant ;
// l'objectif d'avant est deviné (le même qu'aujourd'hui) et Ma cible propose de le corriger une fois.
async function assurerHistoriqueCibles() {
  const cfg = cfgCalories();
  if (!cfg) return;
  if (!historiqueCibles().length) {
    const recente = cfg.depense && cfg.lastAdjust && ecart(cfg.lastAdjust, aujourdhui()) <= 28;
    const l = [{ depuis: "2000-01-01", depense: recente ? null : cfg.depense || null, deficit: cfg.deficit, activity: cfg.activity, devine: true }];
    if (recente) l.push({ depuis: cfg.lastAdjust, depense: cfg.depense, deficit: cfg.deficit, activity: cfg.activity });
    await DB.set("nutri-cal-historique", l);
  }
  // Passage au calcul par séance, une seule fois, à partir d'aujourd'hui (les jours d'avant gardent l'ancien).
  // Une dépense mesurée déjà adoptée contient les séances des 4 semaines où elle a été mesurée : on les compte.
  if (!cfg.seances) {
    const h = [...historiqueCibles()].reverse().find(x => cfg.depense && x.depense === cfg.depense && x.depuis > "2000-01-01");
    const fin = h?.depuis || cfg.lastAdjust || aujourdhui();
    await majCalories({ seances: true, seancesDepense: cfg.depense ? seancesMoyennes(decale(fin, -28), fin) || null : null });
  }
}

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
/* SÉANCES — chaque séance ajoute ce qu'elle brûle, la muscu comme la nage : les calories de ta montre, sinon une estimation.
 * Muscu (salle, maison, ou séance de force de la montre), nage, course et vélo. La marche n'y est pas : elle est dans tes pas. */
const FAMILLES_SEANCE = ["muscu", "nage", "course", "velo"];
const kcalMontreMuscu = l => { const s = sortieDeMuscu(l); return s && s.kcal > 0 && logDeSortie(s)?.log.id === l.id ? Math.round(s.kcal) : null; };
// Une séance de muscu sans montre : la moyenne de tes 10 dernières vues par la montre, sinon 3 kcal par kilo
const kcalMuscuEstimee = memo(() => {
  const v = [...DB.get("sport-logs"), ...DB.get("maison-logs")].sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(kcalMontreMuscu).filter(x => x > 0).slice(-10);
  return v.length ? Math.round(moyenne(v)) : Math.round(3 * (objectifs().curW || 90));
});
// Une nage prévue : sa distance à ton allure habituelle (2:30 aux 100 m sans historique)
const kcalNageEstimee = m => {
  const d = nageDistance(m), l = DB.get("natation-logs").filter(x => x.distance > 0 && x.duree > 0).slice(-10), al = l.length ? moyenne(l.map(x => allure(x.distance, x.duree))) : 150;
  return d > 0 ? Math.round(nageKcal(d, d / 100 * al, 6, objectifs().curW || 90)) : 0;
};
// Les séances d'un jour. prevues : la muscu (jour d'entraînement) et la nage prévues, pas encore faites, comptent estimées
function seancesDu(iso, dayType, prevues) {
  const l = [], muscu = [...DB.get("sport-logs").map(x => ({ ...x, maison: false })), ...DB.get("maison-logs").map(x => ({ ...x, maison: true }))].filter(x => x.dateISO === iso);
  muscu.forEach(x => { const k = kcalMontreMuscu(x); l.push({ t: "muscu", nom: "muscu", kcal: k || kcalMuscuEstimee(), estime: !k }); });
  const nages = DB.get("natation-logs").filter(x => x.dateISO === iso);
  nages.forEach(x => l.push({ t: "nage", nom: "nage", kcal: Math.round(x.kcal || 0) }));
  // Les séances de la montre qui ne sont reliées à rien de noté
  sortiesPolar().filter(s => s.dateISO === iso && s.kcal > 0 && FAMILLES_SEANCE.includes(familleSortie(s)) && !logDeSortie(s))
    .forEach(s => l.push({ t: familleSortie(s), nom: COURT_SORTIE[familleSortie(s)].toLowerCase(), kcal: Math.round(s.kcal) }));
  if (prevues && dayType === "training" && !l.some(x => x.t === "muscu")) l.push({ t: "muscu", nom: "muscu", kcal: kcalMuscuEstimee(), estime: true, prevue: true });
  const np = prevues && !l.some(x => x.t === "nage") ? nagePrevue(iso) : null, kn = np ? kcalNageEstimee(np) : 0;
  if (kn > 0) l.push({ t: "nage", nom: "nage", kcal: kn, estime: true, prevue: true });
  return l.filter(x => x.kcal > 0);
}
// Moyenne par jour des séances faites entre debut (compris) et fin (exclue)
const seancesMoyennes = (debut, fin) => {
  const n = ecart(debut, fin);
  if (n <= 0) return 0;
  let t = 0;
  for (let i = 0; i < n; i++) t += seancesDu(decale(debut, i), null, false).reduce((a, x) => a + x.kcal, 0);
  return Math.round(t / n);
};

/* Menu complet d'un jour : la cible et les portions recalées.
 * Calcul par séance : dépense sans séances + séances du jour (extra) − objectif, jamais sous le métabolisme de base.
 * Ancien calcul (jours d'avant) : −400 kcal au repos, et la nage (extra) ajoutée. */
function menuDuJour(dayType, extra, cibleDuJour) {
  const bt = cibleDuJour || objectifs(), plan = planDuJour(dayType, DB.get("repas-alts")), c = bt.cal;
  const plus = Math.max(0, Math.round(extra || 0));
  const dayTgt = !c ? MACROS_DEFAUT.kcal + plus : c.seances ? Math.max(c.sansSeances - c.deficit + plus, c.bmr)
    : (dayType === "rest" ? Math.max(c.target - COUPE_REPOS, c.bmr) : c.target) + plus;
  const dayMacros = macrosPour(dayTgt, bt.cal ? bt.prot : MACROS_DEFAUT.p);
  const { itemF } = echelleMenu(plan.meals, { ...dayMacros, kcal: dayTgt });
  const mealMacros = plan.meals.map(r => r.items.reduce((a, it) => it.t ? a : { p: a.p + it.p * itemF(it), g: a.g + it.g * itemF(it), l: a.l + it.l * itemF(it) }, { p: 0, g: 0, l: 0 }));
  return { ...plan, dayTgt, swimExtra: c?.seances ? 0 : plus, seancesKcal: c?.seances ? plus : 0, dayMacros, itemF, mealMacros };
}
const kcalMacros = m => m.p * 4 + m.g * 4 + m.l * 9;

/* Ce qui s'ajoute à la cible d'un jour : toutes ses séances (calcul par séance), ou seulement la nage (ancien calcul) */
const seancesPourCible = (iso, dayType, bt) => (bt || objectifs()).cal?.seances ? seancesDu(iso, dayType, iso >= aujourdhui()) : [];
const extraDuJour = (iso, dayType, bt, seances) => (bt || objectifs()).cal?.seances ? (seances || seancesPourCible(iso, dayType, bt)).reduce((a, x) => a + x.kcal, 0) : nageKcalDu(iso);

/* Tout ce qui décrit un jour côté assiette */
const jourNutrition = memo(iso => {
  const nlog = DB.get("nutri-logs").find(l => l.dateISO === iso) || null;
  const prevu = seanceDuJour(iso, programmeEnCours()) ? "training" : "rest", dayType = nlog?.dayType || prevu;
  const bt = iso < aujourdhui() ? objectifsAu(iso) : null, seances = seancesPourCible(iso, dayType, bt);
  const menu = menuDuJour(dayType, extraDuJour(iso, dayType, bt, seances), bt);
  const coches = nlog?.meals || {}, echelles = nlog?.mealScale || {}, figes = nlog?.kcalRepas || {};
  const lignes = menu.meals.map((m, i) => {
    const id = MEAL_ID[m.m], mm = menu.mealMacros[i], s = echelles[id] || 1, k = kcalMacros(mm) * s;
    // Un repas coché garde les calories qu'il avait quand tu l'as coché
    const f = coches[id] && figes[id] > 0 && k > 0 ? figes[id] / k : 1;
    return { id, m, i, kcal: Math.round(k * f), macros: { p: mm.p * s * f, g: mm.g * s * f, l: mm.l * s * f }, facteur: s * f, fait: !!coches[id] };
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
  return { iso, nlog, dayType, prevu, menu, seances, lignes, horsMenu, planifies, mange, reste, facteurReste: Math.abs(facteurReste - 1) < .04 ? 1 : facteurReste };
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
  // Les calories du repas coché sont gardées telles qu'affichées : un changement de cible plus tard ne les réécrit pas
  const figes = { ...(n.nlog?.kcalRepas || {}) }, l = n.lignes.find(r => r.id === id);
  if (meals[id] && l) figes[id] = Math.round(l.kcal / (n.nlog?.mealScale?.[id] || 1) * (scale[id] || 1)); else delete figes[id];
  return ecrireJour(iso, { dayType: n.dayType, meals, mealScale: scale, kcalRepas: figes, mealsOk: ok, mealsTotal: ids.length, compliance: Math.round(ok / ids.length * 100) });
}
function changerTypeJour(iso, dayType) {
  const n = jourNutrition(iso), meals = { ...(n.nlog?.meals || {}) };
  const ids = menuDuJour(dayType, 0).meals.map(m => MEAL_ID[m.m]).filter(Boolean), ok = ids.filter(x => meals[x]).length;
  return ecrireJour(iso, { dayType, meals, mealsOk: ok, mealsTotal: ids.length, compliance: Math.round(ok / ids.length * 100) });
}

/* TENDANCE DE POIDS — moyenne lissée : le chiffre qui compte, débarrassé des variations d'eau */
function lisser(pts) {
  if (!pts.length) return [];
  const out = [{ ...pts[0], t: pts[0].kg }];
  for (let i = 1; i < pts.length; i++) {
    const a = 1 - Math.pow(.9, Math.max(1, ecart(pts[i - 1].dateISO, pts[i].dateISO)));
    out.push({ ...pts[i], t: out[i - 1].t + a * (pts[i].kg - out[i - 1].t) });
  }
  return out;
}
const tendancePoids = memo(() => lisser(pesees()));
/* kg par semaine : pente de la tendance sur les 3 dernières semaines.
 * La tendance gomme l'eau ; les pesées brutes seules donnaient des rythmes faux (+0,01 kg alors que la courbe descend). */
// Pente de la tendance (kg par jour) : la droite qui passe au plus près de tous les points, pas seulement du premier et du dernier
function penteTendance(p) {
  if (p.length < 2) return null;
  const xs = p.map(x => ecart(p[0].dateISO, x.dateISO)), ys = p.map(x => x.t), n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0), sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const den = n * sxx - sx * sx;
  return den === 0 ? null : (n * sxy - sx * sy) / den;
}
function rythmeHebdo(pts) {
  const t = lisser(pts), fin = t[t.length - 1];
  let p = fin ? t.filter(x => ecart(x.dateISO, fin.dateISO) <= 21) : [];
  if (p.length < 3 || ecart(p[0].dateISO, fin.dateISO) < 7) p = t.slice(-8);
  const k = penteTendance(p);
  return k == null ? null : arrondi(k * 7, 2);
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
  // Au-delà de ce déficit, le plancher bloque tout ; en calcul par séance, il compte encore les jours de muscu
  const c0 = objectifs().cal, max = c0 ? c0.deficitMax + (c0.seances ? kcalMuscuEstimee() : 0) : 1000;
  // Trop lent : on n'augmente que si c'est possible (jamais une « hausse » qui baisserait ton objectif)
  const plus = cal ? Math.min(1000, cal.deficit + 150, max) : null;
  let nouveau = !cal ? null : pct < RYTHME_MAX ? Math.max(0, cal.deficit - 150) : pct > RYTHME_LENT ? (plus > cal.deficit ? plus : null) : null;
  if (nouveau != null && nouveau === cal.deficit) nouveau = null;
  return { kg, pct, curW, nouveau: refroidi ? null : nouveau, refroidi, etat: pct < RYTHME_MAX ? "vite" : pct > RYTHME_LENT ? "lent" : pct > RYTHME_MIN ? "doux" : "ideal" };
});
/* DÉPENSE RÉELLE — ce que ton corps brûle vraiment, déduit de ce que tu manges et de la pente de ta tendance.
 * Dépense = apports moyens − pente de la tendance (kg par jour) × 7 700. Indépendant de ton respect du plan.
 * Seuls les jours finis et complets comptent : ni aujourd'hui, ni un jour où des repas n'ont pas été cochés
 * (ils feraient croire que tu manges moins, donc que tu dépenses moins). */
const depenseReelle = memo(() => {
  const t = tendancePoids(), auj = aujourdhui(), cal = objectifs().cal;
  const fenetre = t.filter(x => ecart(x.dateISO, auj) <= 28);
  if (fenetre.length < 4) return { pret: false, jours: fenetre.length };
  const debut = fenetre[0], der = fenetre[fenetre.length - 1], jours = ecart(debut.dateISO, der.dateISO);
  if (jours < 14) return { pret: false, jours };
  const notes = [];
  for (let i = 0; i <= jours; i++) {
    const d = decale(debut.dateISO, i);
    if (d >= auj) continue;
    const a = apportsDu(d), n = jourNutrition(d), complet = n.lignes.length > 0 && n.lignes.every(l => l.fait);
    if (a && (complet || a >= n.menu.dayTgt * .85)) notes.push(a);
  }
  if (notes.length < jours * .5) return { pret: false, jours: notes.length, manque: "repas" };
  const pente = penteTendance(fenetre);
  if (pente == null) return { pret: false, jours };
  const apports = moyenne(notes), kcal = Math.round(apports - pente * KCAL_PAR_KG);
  // Ce que tes séances ont brûlé, en moyenne par jour, pendant ces semaines : la cible les ajoute à part, jour par jour
  const seances = seancesMoyennes(debut.dateISO, der.dateISO);
  return { pret: true, kcal: Math.round(kcal / 10) * 10, apports: Math.round(apports), jours, notes: notes.length, pente: arrondi(pente * 7, 2), formule: cal?.tdee || null, ecart: cal ? Math.round(kcal - cal.tdee) : null,
    seances, sansSeances: Math.round((kcal - seances) / 10) * 10 };
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
