"use strict";
/* ARGENT — le reste à vivre du mois et la liste de courses.
 * Reste à vivre = revenus − dépenses − charges fixes pas encore payées − objectif d'épargne.
 * "fin-fixes" = [{ id, label, montant, cat, jour }] ; une charge cochée crée une dépense portant fixId. */
const sommeMois = (a, ym) => arrondi(a.filter(e => moisDe(e.dateISO) === ym).reduce((s, e) => s + (+e.montant || 0), 0), 2);
const ventilation = ym => {
  const m = {};
  DB.get("fin-expenses").filter(e => moisDe(e.dateISO) === ym).forEach(e => { m[e.cat] = (m[e.cat] || 0) + (+e.montant || 0); });
  return m;
};
const bilanMois = memo(ym => {
  const inc = DB.get("fin-income"), dep = DB.get("fin-expenses"), caps = DB.get("fin-caps"), objectif = parseNb(DB.get("fin-goal")) || 0;
  const estimeRev = sommeMois(inc, ym) === 0;
  const rev = estimeRev ? sommeMois(inc, moisPrec(ym)) : sommeMois(inc, ym), depenses = sommeMois(dep, ym);
  const payees = new Set(dep.filter(e => e.fixId && moisDe(e.dateISO) === ym).map(e => e.fixId));
  const fixes = DB.get("fin-fixes").map(f => ({ ...f, paye: payees.has(f.id) })).sort((a, b) => (a.jour || 1) - (b.jour || 1));
  const aVenir = fixes.filter(f => !f.paye).reduce((s, f) => s + (+f.montant || 0), 0);
  const reste = arrondi(rev - depenses - aVenir - objectif, 2);
  const cour = moisDe(aujourdhui()) === ym, restants = cour ? joursDuMois(ym) - new Date().getDate() + 1 : joursDuMois(ym);
  const parCat = ventilation(ym), prec = sommeMois(dep, moisPrec(ym));
  const solde = arrondi(rev - depenses, 2);
  return {
    ym, rev, estimeRev, depenses, fixes, aVenir, objectif, reste, solde, restants, parJour: restants > 0 ? Math.max(0, reste) / restants : 0, parCat, caps,
    prec, evolution: prec > 0 ? Math.round((depenses - prec) / prec * 100) : null,
    taux: rev > 0 ? Math.round((rev - depenses) / rev * 100) : null,
    depasse: CATEGORIES.filter(c => caps[c] > 0 && (parCat[c] || 0) > caps[c]),
  };
});
const depenses7j = memo(() => Math.round(DB.get("fin-expenses").filter(e => dansLes(e.dateISO, 7)).reduce((a, e) => a + (+e.montant || 0), 0)));
function cocherFixe(f, ym) {
  const dep = DB.get("fin-expenses"), ex = dep.find(e => e.fixId === f.id && moisDe(e.dateISO) === ym);
  if (ex) return DB.set("fin-expenses", dep.filter(e => e !== ex));
  const jour = Math.min(f.jour || 1, joursDuMois(ym));
  const iso = moisDe(aujourdhui()) === ym ? aujourdhui() : ym + "-" + pad2(jour);
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
