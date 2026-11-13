"use strict";
/* ARGENT — le reste à vivre du mois et la liste de courses.
 * Reste à vivre = revenus − dépenses − charges fixes pas encore payées − objectif d'épargne, d'une paye à la suivante.
 * "fin-fixes" = [{ id, label, montant, cat, jour }] ; une charge cochée crée une dépense portant fixId. */
const sommeMois = (a, ym) => arrondi(a.filter(e => moisDe(e.dateISO) === ym).reduce((s, e) => s + (+e.montant || 0), 0), 2);
const dansPeriode = (e, p) => e.dateISO >= p.debut && e.dateISO <= p.fin;
const sommePeriode = (a, p) => arrondi(a.filter(e => dansPeriode(e, p)).reduce((s, e) => s + (+e.montant || 0), 0), 2);

/* PÉRIODES DE PAYE — le budget court d'une paye à la suivante, pas du 1er au 31.
 * Une paye = un revenu marqué « paye ». Pour les revenus plus anciens, sans marque : le plus gros revenu de chaque mois.
 * Deux payes à moins de 20 jours (prime, paye en deux fois) ne font qu'une période. */
const datesPaye = memo(() => {
  const parMois = {};
  DB.get("fin-income").forEach(e => { (parMois[moisDe(e.dateISO)] = parMois[moisDe(e.dateISO)] || []).push(e); });
  // Sans marque, le plus gros revenu du mois n'est une paye que s'il vaut au moins la moitié d'une paye habituelle (pas 30 € de Vinted)
  const maxima = Object.values(parMois).map(l => Math.max(...l.filter(e => e.paye !== false).map(e => +e.montant || 0), 0)).filter(x => x > 0).sort((a, b) => a - b);
  const habituelle = maxima.length ? maxima[Math.floor(maxima.length / 2)] : 0;
  const dates = Object.values(parMois).flatMap(l => {
    const marquees = l.filter(e => e.paye === true);
    if (marquees.length) return marquees.map(e => e.dateISO);
    const sansMarque = l.filter(e => e.paye !== false).sort((a, b) => (+b.montant || 0) - (+a.montant || 0));
    return sansMarque.length && +sansMarque[0].montant >= habituelle / 2 ? [sansMarque[0].dateISO] : [];
  }).sort();
  const gardees = [];
  dates.forEach(d => { if (!gardees.length || ecart(gardees[gardees.length - 1], d) >= 20) gardees.push(d); });
  return gardees;
});
const unMoisApres = iso => { const [a, m, j] = iso.split("-").map(Number), d = new Date(a, m, Math.min(j, new Date(a, m + 1, 0).getDate())); return isoDe(d); };
// Toutes les périodes, de la plus ancienne à la courante. Sans paye connue : le mois civil, comme avant.
const periodes = memo(() => {
  const d = datesPaye(), auj = aujourdhui();
  if (!d.length || d[0] > auj) { const ym = moisDe(auj); return [{ debut: ym + "-01", fin: ym + "-" + pad2(joursDuMois(ym)), civil: true }]; }
  return d.filter(x => x <= auj).map((debut, i, l) => {
    if (l[i + 1]) return { debut, fin: decale(l[i + 1], -1) };
    const prevue = unMoisApres(debut);
    // Paye pas encore arrivée à la date prévue : la période s'étire jusqu'à aujourd'hui
    return { debut, fin: decale(prevue, -1), prevue, enRetard: auj >= prevue, ...(auj >= prevue ? { fin: auj } : {}) };
  });
});
const periodeCourante = () => { const p = periodes(); return p[p.length - 1]; };
const nomPeriode = p => p.civil ? nomMois(moisDe(p.debut)) : dateMini(p.debut) + " → " + (p.enRetard ? "aujourd'hui" : dateMini(p.fin));
// Jour où tombe une charge fixe dans la période (le « jour » du mois, au plus tôt au début de la période)
const echeanceFixe = (f, p) => {
  const j = f.jour || 1, [a, m] = p.debut.split("-").map(Number);
  const dans = (an, mo) => isoDe(new Date(an, mo - 1, Math.min(j, new Date(an, mo, 0).getDate())));
  const d = dans(a, m);
  return d >= p.debut ? d : dans(m === 12 ? a + 1 : a, m === 12 ? 1 : m + 1);
};
const bilanPeriode = memo((debut, fin) => {
  const tout = periodes(), i = tout.findIndex(x => x.debut === debut), p = tout[i] || { debut, fin }, avant = tout[i - 1];
  const inc = DB.get("fin-income"), dep = DB.get("fin-expenses"), caps = DB.get("fin-caps"), objectif = parseNb(DB.get("fin-goal")) || 0;
  const auj = aujourdhui(), cour = auj >= p.debut && auj <= p.fin;
  let rev = sommePeriode(inc, p), estimeRev = false;
  if (p.civil && rev === 0) { rev = sommeMois(inc, moisPrec(moisDe(p.debut))); estimeRev = true; }
  const depenses = sommePeriode(dep, p);
  const payees = new Set(dep.filter(e => e.fixId && dansPeriode(e, p)).map(e => e.fixId));
  const fixes = DB.get("fin-fixes").map(f => ({ ...f, echeance: echeanceFixe(f, p), paye: payees.has(f.id) })).sort((a, b) => a.echeance.localeCompare(b.echeance));
  const aVenir = fixes.filter(f => !f.paye).reduce((s, f) => s + (+f.montant || 0), 0);
  const reste = arrondi(rev - depenses - aVenir - objectif, 2);
  const restants = cour ? Math.max(1, ecart(auj, p.fin) + 1) : ecart(p.debut, p.fin) + 1;
  const parCat = {};
  dep.filter(e => dansPeriode(e, p)).forEach(e => { parCat[e.cat] = (parCat[e.cat] || 0) + (+e.montant || 0); });
  const prec = avant ? sommePeriode(dep, avant) : sommeMois(dep, moisPrec(moisDe(p.debut)));
  return {
    ...p, cour, rev, estimeRev, depenses, fixes, aVenir, objectif, reste, solde: arrondi(rev - depenses, 2), restants, parJour: restants > 0 ? Math.max(0, reste) / restants : 0, parCat, caps,
    prec, evolution: prec > 0 ? Math.round((depenses - prec) / prec * 100) : null,
    taux: rev > 0 ? Math.round((rev - depenses) / rev * 100) : null,
    depasse: CATEGORIES.filter(c => caps[c] > 0 && (parCat[c] || 0) > caps[c]),
  };
});
const bilanCourant = () => { const p = periodeCourante(); return bilanPeriode(p.debut, p.fin); };

/* PRÉVISION — où tu en seras le jour de ta paye, au rythme de tes dépenses du quotidien (charges fixes à part).
 * Les premiers jours, le rythme se mélange avec celui des 3 dernières payes, pour ne pas s'affoler sur un gros plein de courses. */
const depensesCourantes = p => DB.get("fin-expenses").filter(e => dansPeriode(e, p) && !e.fixId).reduce((a, e) => a + (+e.montant || 0), 0);
const periodesFinies = () => { const t = periodes(); return t.filter(p => !p.civil && p.fin < t[t.length - 1].debut).slice(-3); };
function prevision(b) {
  if (!b?.cour || !b.rev || b.enRetard) return null;
  const auj = aujourdhui(), ecoules = ecart(b.debut, auj) + 1, apres = Math.max(0, ecart(auj, b.fin));
  const actuel = depensesCourantes(b) / ecoules, finies = periodesFinies();
  const habituel = finies.length ? moyenne(finies.map(p => depensesCourantes(p) / (ecart(p.debut, p.fin) + 1))) : null;
  const poids = Math.min(1, ecoules / 7);
  const rythme = habituel != null ? actuel * poids + habituel * (1 - poids) : ecoules >= 3 ? actuel : null;
  if (rythme == null) return null;
  return { rythme, fin: Math.round(b.reste - rythme * apres), apres, cible: b.parJour };
}
/* Plafonds : ce que tu dépenses d'habitude dans chaque catégorie (moyenne des 3 dernières payes) */
function habituelParCat() {
  const f = periodesFinies(), dep = DB.get("fin-expenses"), o = {};
  if (!f.length) return o;
  f.forEach(p => dep.filter(e => dansPeriode(e, p)).forEach(e => { o[e.cat] = (o[e.cat] || 0) + (+e.montant || 0) / f.length; }));
  return o;
}
/* Abonnements repérés : même commerce, montant quasi identique (5 %), tous les 25 à 35 jours, pas encore dans tes charges fixes */
// Prélèvements SEPA : « AVANSSUR ECH/111126 ID EMETTEUR/FR64ZZZ… MDT/… » ne garde que « AVANSSUR »
const sansRefSepa = l => String(l || "").replace(/\s+(ECH|ID\s*EMETTEUR|MDTS?|MD|RUM|REF|NUM|LIB|DATE)\s*[\/:].*$/i, "").trim();
const cleCommerce = l => sansAccent(sansRefSepa(l)).replace(/[^a-z ]/g, " ").trim().split(/\s+/).slice(0, 2).join(" ");
function abonnementsReperes() {
  const auj = aujourdhui(), ignores = reglesBanque().recurrentsIgnores || [], fixes = DB.get("fin-fixes"), groupes = {};
  DB.get("fin-expenses").filter(e => !e.fixId && e.label && ecart(e.dateISO, auj) <= 130).forEach(e => { const k = cleCommerce(e.label); if (k) (groupes[k] = groupes[k] || []).push(e); });
  return Object.entries(groupes).map(([k, l]) => {
    const s = [...l].sort((a, b) => a.dateISO.localeCompare(b.dateISO)).slice(-3), der = s[s.length - 1];
    if (s.length < 2 || ignores.includes(k) || ecart(der.dateISO, auj) > 40) return null;
    const regulier = s.slice(1).every((e, i) => { const j = ecart(s[i].dateISO, e.dateISO); return j >= 25 && j <= 35 && Math.abs(e.montant - s[i].montant) <= Math.max(.5, s[i].montant * .05); });
    if (!regulier) return null;
    if (fixes.some(f => cleCommerce(f.label) === k || (Math.abs(f.montant - der.montant) < .01 && f.cat === der.cat))) return null;
    return { cle: k, label: der.label, montant: +der.montant, jour: +der.dateISO.slice(8), cat: der.cat === "Autre" ? "Abonnements" : der.cat, fois: l.length };
  }).filter(Boolean).sort((a, b) => b.montant - a.montant);
}
const coutAbonnements = () => {
  const m = DB.get("fin-fixes").filter(f => f.cat === "Abonnements").reduce((a, f) => a + (+f.montant || 0), 0) + abonnementsReperes().reduce((a, x) => a + x.montant, 0);
  return { mois: arrondi(m, 2), an: Math.round(m * 12) };
};
async function ajouterAuxFixes(a) {
  await DB.set("fin-fixes", [...DB.get("fin-fixes"), { id: nouvelId("f"), label: a.label, montant: a.montant, cat: a.cat, jour: a.jour }]);
  // Les dernières fois comptent comme cette charge (déjà payée)
  const dep = DB.get("fin-expenses"), f = DB.get("fin-fixes").slice(-1)[0];
  await DB.set("fin-expenses", dep.map(e => !e.fixId && cleCommerce(e.label) === a.cle && Math.abs(e.montant - a.montant) <= Math.max(.5, a.montant * .05) ? { ...e, fixId: f.id, cat: a.cat } : e));
}
const ignorerAbonnement = cle => { const r = reglesBanque(); return DB.set("banque-regles", { ...r, recurrentsIgnores: [...(r.recurrentsIgnores || []), cle] }); };
/* Repas dehors et livraisons : ce que coûtent les écarts au plan */
const RE_REPAS_DEHORS = /mc ?do|mcdonald|burger|kfc|quick|uber ?eats|deliveroo|just ?eat|restau|brasserie|pizz|sushi|kebab|tacos|starbucks|columbus|five guys|subway|bistro|traiteur|snack/;
const repasDehors = p => { const l = DB.get("fin-expenses").filter(e => dansPeriode(e, p) && RE_REPAS_DEHORS.test(sansAccent(e.label || ""))); return { total: Math.round(l.reduce((a, e) => a + (+e.montant || 0), 0)), fois: l.length }; };
/* ÉPARGNE — on met de côté en premier, à chaque paye ; le reste se dépense sans culpabiliser.
 * "fin-goal" = la somme mise de côté à chaque paye (déjà retirée du reste à dépenser).
 * "epargne" = { cagnottes: [{ id, nom, cible }], versements: [{ id, dateISO, montant, source, ref? }], virement, palier, gardes: [début de période] }
 * Les cagnottes se remplissent dans l'ordre : la sécurité d'abord, puis le projet. */
const EPARGNE_VIDE = { cagnottes: [], versements: [], virement: false, palier: null, gardes: [] };
const etatEpargne = () => ({ ...EPARGNE_VIDE, ...(DB.get("epargne") || {}) });
const majEpargne = f => DB.set("epargne", f(etatEpargne()));
const totalEpargne = () => arrondi(etatEpargne().versements.reduce((a, v) => a + (+v.montant || 0), 0), 2);
const montantParPaye = () => parseNb(DB.get("fin-goal")) || 0;
function cagnottes() {
  let reste = totalEpargne();
  return etatEpargne().cagnottes.map(c => { const v = Math.min(reste, c.cible || 0); reste -= v; return { ...c, verse: arrondi(v, 2), pleine: c.cible > 0 && v >= c.cible }; });
}
// Paye et dépenses habituelles : moyenne des 3 dernières périodes (les dépenses, sur les périodes terminées)
function payeHabituelle() {
  const l = periodes().filter(p => !p.civil).slice(-3).map(p => sommePeriode(DB.get("fin-income"), p)).filter(x => x > 0);
  return l.length ? Math.round(moyenne(l)) : null;
}
function depensesHabituelles() {
  const l = periodes().filter(p => !p.civil).slice(0, -1).slice(-3);
  return l.length ? Math.round(moyenne(l.map(p => sommePeriode(DB.get("fin-expenses"), p)))) : null;
}
// On commence petit : 5 % de la paye, arrondi à 10 €, sans dépasser la moitié de ce qui reste d'habitude
function montantPropose() {
  const rev = payeHabituelle(), dep = depensesHabituelles();
  if (!rev) return 50;
  let m = Math.max(20, Math.round(rev * .05 / 10) * 10);
  if (dep != null && dep > rev * .4 && rev - dep > 0) m = Math.min(m, Math.max(20, Math.round((rev - dep) / 2 / 10) * 10));
  return m;
}
// Épargne de sécurité : un mois de dépenses (charges fixes comprises), arrondi à 50 €
function cibleSecurite() {
  const dep = depensesHabituelles(), fixes = DB.get("fin-fixes").reduce((a, f) => a + (+f.montant || 0), 0), rev = payeHabituelle();
  const base = dep && dep > fixes ? dep : fixes ? fixes * 1.6 : rev ? rev * .8 : 1000;
  return Math.max(300, Math.round(base / 50) * 50);
}
// Jour conseillé pour le virement automatique : le lendemain de la paye la plus tardive des derniers mois
const jourVirement = () => { const d = datesPaye().slice(-3).map(x => +x.slice(8)); return d.length ? Math.min(28, Math.max(...d) + 1) : 12; };
// Mois où une cagnotte sera pleine, à raison du montant par paye (après les cagnottes d'avant)
function dateCagnotte(c) {
  const m = montantParPaye(), cs = cagnottes(), i = cs.findIndex(x => x.id === c.id);
  const manque = cs.slice(0, i + 1).reduce((a, x) => a + Math.max(0, (x.cible || 0) - x.verse), 0);
  if (c.pleine || !m || manque <= 0) return null;
  let d = periodeCourante().debut;
  for (let i = 0; i < Math.ceil(manque / m); i++) d = unMoisApres(d);
  return d;
}
const ajouterVersement = (montant, source, ref) => majEpargne(e => ({ ...e, versements: [...e.versements, { id: Date.now(), dateISO: aujourdhui(), montant: arrondi(montant, 2), source, ...(ref ? { ref } : {}) }] }));
/* Le point de la paye : le versement prévu, le reste de la paye d'avant, et une petite hausse tous les 3 mois */
function pointPaye() {
  const e = etatEpargne(), tout = periodes(), p = tout[tout.length - 1], auj = aujourdhui(), montant = montantParPaye();
  if (!p || p.civil || !e.cagnottes.length) return null;
  const recent = ecart(p.debut, auj) <= 10, avant = tout[tout.length - 2];
  const aVerser = recent && montant > 0 && !e.versements.some(v => v.source === "paye" && v.dateISO >= p.debut);
  // Le reste de la paye d'avant n'est proposé que si les dépenses semblent notées (sinon le chiffre serait trompeur)
  let restePrec = 0;
  if (recent && avant && !e.gardes.includes(avant.debut) && !e.versements.some(v => v.source === "reste" && v.ref === avant.debut)) {
    const b = bilanPeriode(avant.debut, avant.fin);
    if (b.rev > 0 && b.depenses >= b.rev * .4) restePrec = Math.floor(Math.max(0, b.reste) / 10) * 10;
  }
  const premier = e.versements.map(v => v.dateISO).sort()[0];
  const palier = montant > 0 && premier && ecart(e.palier && e.palier > premier ? e.palier : premier, auj) >= 90;
  return { montant, aVerser, restePrec: restePrec >= 10 ? restePrec : 0, avant: avant?.debut, palier, nouveau: montant + 10 };
}
const depenses7j = memo(() => Math.round(DB.get("fin-expenses").filter(e => dansLes(e.dateISO, 7)).reduce((a, e) => a + (+e.montant || 0), 0)));
function cocherFixe(f, p) {
  const dep = DB.get("fin-expenses"), ex = dep.find(e => e.fixId === f.id && dansPeriode(e, p));
  if (ex) return DB.set("fin-expenses", dep.filter(e => e !== ex));
  const auj = aujourdhui(), iso = auj >= p.debut && auj <= p.fin ? auj : echeanceFixe(f, p);
  return DB.set("fin-expenses", [...dep, { id: Date.now(), dateISO: iso, montant: +f.montant, cat: f.cat || "Autre", label: f.label, fixId: f.id }]);
}

/* COURSES — quantités calculées depuis les vrais menus (portions recalées, variantes choisies) pour n jours */
const prixDe = id => {
  const paye = DB.get("budget-logs").filter(l => l.prodId === id && l.prixKg > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).pop();
  return paye ? paye.prixKg : null;
};
function quantiteTxt(p, g) {
  if (p.parPiece) { const n = Math.ceil(g / p.parPiece); return n + " " + (p.unite || "pièces"); }
  if (g >= 1000) return nb(arrondi(g / 1000, 1)) + " kg";
  return Math.max(10, Math.round(g / 10) * 10) + " g";
}
const listeCourses = memo((debut, jours) => {
  const parType = {}, grammes = {};
  const ajoute = (id, g) => { grammes[id] = (grammes[id] || 0) + g; };
  for (let i = 0; i < jours; i++) {
    const iso = decale(debut, i), type = seanceDuJour(iso, programmeEnCours()) ? "training" : "rest";
    const menu = parType[type] || (parType[type] = menuDuJour(type, 0));
    menu.meals.forEach(m => m.items.forEach(it => {
      if (it.t) { if (RE_LEGUMES.test(it.t)) ajoute("legumes", PORTION_LEGUMES); return; }
      const id = INGREDIENTS[it.n];
      if (!id) return;
      const g = it.cru * menu.itemF(it);
      ajoute(id, it.n === "Blancs d'œufs" ? g / GRAMMES_BLANC * PRODUITS.oeufs.parPiece : g);
    }));
  }
  const eco = DB.get("courses-etat")?.eco || {};
  const lignes = Object.entries(grammes).map(([id, g]) => {
    const p = PRODUITS[id], version = eco[id] && p.eco ? p.eco : null;
    const prixKg = prixDe(id) ?? version?.prixKg ?? p.prixKg;
    const cout = p.prixPiece ? Math.ceil(g / p.parPiece) * p.prixPiece : g / 1000 * prixKg;
    const coutEco = p.eco ? g / 1000 * p.eco.prixKg : null;
    return { id, nom: version ? version.nom : p.nom, rayon: p.rayon, grammes: g, quantite: quantiteTxt(p, g), cout, gainEco: p.eco && !version ? Math.round(cout - coutEco) : 0, ecoNom: p.eco?.nom || null, prixKg, paye: prixDe(id) != null };
  }).sort((a, b) => a.rayon - b.rayon || b.cout - a.cout);
  return { lignes, total: lignes.reduce((a, l) => a + l.cout, 0) };
});
function etatCourses() {
  const e = DB.get("courses-etat"), auj = aujourdhui();
  // Une liste se périme au bout de 7 jours : on repart du jour même
  if (e && ecart(e.debut, auj) < (e.jours || 7)) return { jours: 7, coches: {}, ajouts: [], eco: {}, ...e };
  return { debut: auj, jours: 7, coches: {}, ajouts: [], eco: e?.eco || {} };
}
