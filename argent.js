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
