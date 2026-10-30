"use strict";
/* JOUR — « Qu'est-ce que je fais maintenant ? »
 * La semaine en bandeau, les quatre affiches, le coach, puis la journée à cocher dans l'ordre des heures. */

function BandeSemaine({ iso, setIso }) {
  const auj = aujourdhui(), lundi = lundiDe(iso), prog = programmeEnCours();
  const faitLe = d => seanceFaite(d) || DB.get("natation-logs").some(l => l.dateISO === d);
  return h("div.semaine", ORDRE_JOURS.map((_, i) => {
    const d = decale(lundi, i), prevu = seanceDuJour(d, prog) || nagePrevue(d), n = DB.get("nutri-logs").find(l => l.dateISO === d);
    const etat = faitLe(d) ? "fait" : prevu ? "prevu" : "";
    return h("button", { key: d, className: (d === iso ? "actif " : "") + (d === auj ? "auj " : ""), onClick: () => { vibre(); setIso(d); }, "aria-label": dateLongue(d) },
      h("small", JOURS_L[i]), h("b", +d.slice(8)), h("i", { "data-etat": etat, "data-repas": n?.compliance >= 80 ? "1" : "0" }));
  }));
}

/* Une affiche : un grand chiffre sur un aplat de couleur */
const Affiche = ({ ton, etiquette, grand, unite, texte, onClick, action }) => h("button.affiche", { "data-ton": ton, onClick },
  h("span.affiche-e", etiquette),
  h("div.affiche-g", h(Geant, null, grand), unite && h("em", unite)),
  texte && h("p", texte),
  action && h("span.affiche-a", action, h(Icone, { n: "fleche", t: 16 })));

function Affiches() {
  const auj = aujourdhui(), r = recuperation(auj), n = jourNutrition(auj), prog = programmeEnCours(), sess = seanceDuJour(auj, prog);
  const b = bilanMois(moisDe(auj)), faite = seanceFaite(auj);
  const nage = nagePrevue(auj), nageFaite = DB.get("natation-logs").filter(l => l.dateISO === auj);
  const se = sess && sess.prog !== "maison" ? seanceParId(sess.code) : null;
  const series = se ? se.exercices.reduce((a, e) => a + (fourchette(e.detail)?.sets || 3), 0) : 0;
  const forme = r && r.score != null
    ? h(Affiche, { ton: r.verdict.ton, etiquette: "Forme", grand: h(Compteur, { v: r.score }), unite: "/100", texte: r.verdict.t, onClick: () => Nav.sheet("forme"), action: "Le détail" })
    : h(Affiche, { ton: "papier", etiquette: "Forme du matin", grand: "À saisir", texte: "Quatre chiffres de ta montre, et je règle ta séance sur ta forme.", onClick: () => Nav.sheet("matin"), action: "Saisir" });
  const seance = sess
    ? h(Affiche, { ton: "sport", etiquette: faite ? "Séance faite" : "Séance à " + hhmm(seanceCreneau()), grand: sess.label, texte: faite ? "Bien joué. Récupère et mange ton plan." : se ? pluriel(se.exercices.length, "exercice") + ", " + series + " séries" : sess.titre, onClick: () => faite ? Nav.tab("sport") : ouvrirSeance(auj, sess), action: faite ? "Voir" : "Démarrer" })
    : h(Affiche, { ton: "sport", etiquette: "Aujourd'hui", grand: nage || nageFaite.length ? "Nage" : "Repos", texte: nageFaite.length ? entier(nageFaite[0].distance) + " m nagés" : nage ? nage.name + ", " + entier(nageDistance(nage)) + " m" : "Marche, mobilité, et coucher à l'heure.", onClick: () => Nav.tab("sport"), action: "Voir" });
  return h("div.affiches",
    forme,
    h(Affiche, { ton: "repas", etiquette: n.reste >= 0 ? "Reste à manger" : "Au-dessus de ta cible", grand: h(Compteur, { v: entier(Math.abs(n.reste)) }), unite: "kcal", texte: entier(n.mange.kcal) + " sur " + entier(n.menu.dayTgt) + " kcal · " + Math.round(n.mange.p) + " g de protéines sur " + n.menu.dayMacros.p, onClick: () => Nav.tab("repas"), action: "Mes repas" }),
    seance,
    h(Affiche, { ton: "argent", etiquette: "Reste ce mois-ci", grand: h(Compteur, { v: entier(Math.max(0, b.reste)) }), unite: "€", texte: b.rev ? "Soit " + Math.round(b.parJour) + " € par jour jusqu'à la fin de " + nomMois(b.ym) : "Ajoute tes revenus pour voir ce qu'il reste.", onClick: () => Nav.tab("argent"), action: "Mes comptes" }));
}

/* Le coach : ce qu'il a à dire, puis les imprévus en deux touches */
function Coach() {
  const [tout, setTout] = useState(false);
  const [rep, setRep] = useState(null);
  const msgs = messagesCoach(), vus = tout ? msgs : msgs.slice(0, 3);
  const questions = [
    ["Je me pèse", () => Nav.sheet("pesee")], ["J'ai mangé autre chose", () => Nav.sheet("aliment", { iso: aujourdhui() })], ["J'ai dépensé", () => Nav.sheet("operation")],
    ["J'ai mal", () => Nav.sheet("douleur")], ["Où j'en suis ?", () => Nav.sheet("bilan")], ["Quoi manger ?", () => setRep(repondre("manger"))], ["Je peux charger ?", () => setRep(repondre("charger"))], ["Changer de séance", () => Nav.sheet("choisir")],
  ];
  return h("section.coach",
    h("header", h("i", "R"), h("b", "Ton coach")),
    vus.map(m => h("div.msg", { key: m.id }, h("p", m.t), m.acts && h("div.msg-a", m.acts.map((a, i) => h("button", { key: i, className: i === 0 ? "pr" : "", onClick: a.run }, a.l))))),
    !tout && msgs.length > 3 && h("button.coach-plus", { onClick: () => setTout(true) }, pluriel(msgs.length - 3, "autre message", "autres messages")),
    rep && h("div.msg.rep", h("p", rep)),
    h(Puces, { defile: true }, questions.map(([l, f]) => h(Puce, { key: l, onClick: f }, l))));
}

/* Tout ce qu'il y a à faire un jour donné, dans l'ordre des heures */
function itemsDuJour(iso) {
  const n = jourNutrition(iso), r = recuperation(iso), e = DB.get("recup-logs").find(l => l.dateISO === iso), pr = profil();
  const prog = programmeEnCours(), sess = seanceDuJour(iso, prog), nage = nagePrevue(iso), nages = DB.get("natation-logs").filter(l => l.dateISO === iso);
  const items = [
    { cle: "matin", h: pr.reveil, t: "Forme du matin", s: r?.score != null ? r.score + "/100, " + r.verdict.court : e ? "fait" : "4 chiffres de ta montre", fait: !!e, ouvre: () => Nav.sheet("matin", { iso }), ton: "corps" },
    { cle: "pesee", h: pr.reveil, t: "Pesée", s: n.nlog?.weight ? nb1(n.nlog.weight) + " kg" : "au réveil, à jeun", fait: !!n.nlog?.weight, ouvre: () => Nav.sheet("pesee", { iso }), ton: "corps" },
    ...n.lignes.map(l => ({ cle: l.id, h: l.m.h, t: l.m.m, s: (l.m.altLabel ? l.m.altLabel + ", " : "") + (l.fait ? l.kcal : Math.round(l.kcal * n.facteurReste)) + " kcal", fait: l.fait, coche: () => cocherRepas(iso, l.id), ouvre: () => Nav.sheet("repas", { iso, id: l.id }), ton: "repas" })),
  ];
  if (sess) {
    const faite = DB.get(sess.prog === "maison" ? "maison-logs" : "sport-logs").some(l => l.dateISO === iso && l.seance === sess.code);
    items.push({ cle: "seance", h: seanceCreneau(), t: sess.label, s: faite ? "faite" : sess.titre, fait: faite, ouvre: () => ouvrirSeance(iso, sess), ton: "sport", fort: !faite });
  }
  if (nage || nages.length) items.push({ cle: "nage", h: "17h30", t: "Natation", s: nages.length ? entier(nages.reduce((a, l) => a + l.distance, 0)) + " m" : entier(nageDistance(nage)) + " m prévus", fait: nages.length > 0, ouvre: () => Nav.sheet("natation"), ton: "sport" });
  return items.sort((a, b) => hEnMin(a.h) - hEnMin(b.h));
}
function LigneJour({ it, futur }) {
  return h("div.ligne-j", { className: (it.fait ? "fait " : "") + (it.fort ? "fort" : ""), "data-ton": it.ton },
    it.coche && !futur ? h(Coche, { fait: it.fait, onClick: it.coche, label: it.t }) : h("button.coche-faux", { className: it.fait ? "fait" : "", onClick: it.ouvre, "aria-label": it.t }, h(Icone, { n: it.fait ? "check" : "fleche", t: 18 })),
    h("button.ligne-c", { onClick: it.ouvre },
      h("time", hhmm(it.h)),
      h("span", h("b", it.t), h("small", it.s)),
      h("i.barre-t", { "aria-hidden": true })));
}
function Journee({ iso }) {
  const auj = aujourdhui(), items = itemsDuJour(iso), futur = iso > auj;
  const min = new Date().getHours() * 60 + new Date().getMinutes();
  let place = false;
  const lignes = [];
  items.forEach(it => {
    if (iso === auj && !place && hEnMin(it.h) > min) { place = true; lignes.push(h("div.maintenant", { key: "now" }, h("span", "Maintenant " + pad2(new Date().getHours()) + ":" + pad2(new Date().getMinutes())))); }
    lignes.push(h(LigneJour, { key: it.cle, it, futur }));
  });
  const faits = items.filter(x => x.fait).length;
  return h(Section, { titre: iso === auj ? "Ta journée" : dateLongue(iso), droite: h("span.compte", faits + "/" + items.length) }, h("div.journee", lignes));
}
/* Compléments et eau : deux lignes à cocher */
function Petits({ iso }) {
  const n = jourNutrition(iso), supps = n.nlog?.supps || {}, eau = n.nlog?.water || 0;
  const serieCrea = serie(DB.get("nutri-logs").filter(l => l.supps?.["Créatine"]).map(l => l.dateISO)).current;
  return h(Section, { titre: "Compléments et eau", droite: serieCrea > 1 ? h("span.compte", "créatine : " + serieCrea + " j de suite") : null },
    h(Puces, null, COMPLEMENTS.map(c => h(Puce, { key: c.n, actif: !!supps[c.n], onClick: () => ecrireJour(iso, { supps: { ...supps, [c.n]: !supps[c.n] } }) }, c.n))),
    h("div.eau", { role: "group", "aria-label": "Verres d'eau" },
      Array.from({ length: 10 }, (_, i) => h("button", { key: i, className: i < eau ? "plein" : "", "aria-label": (i + 1) + " verres", onClick: () => { vibre(); ecrireJour(iso, { water: i + 1 === eau ? i : i + 1 }); } }, h(Icone, { n: "eau", t: 20 }))),
      h("span", eau + "/10")));
}

function EcranJour() {
  useDB();
  const auj = aujourdhui(), [iso, setIso] = useState(auj), r = iso === auj;
  return h("div.page", { "data-t": "jour" },
    h("header.entete",
      h("div", h("small", dateLongue(iso)), h("h1.logo", "RECOMP")),
      h("button.rond", { onClick: () => Nav.sheet("reglages"), "aria-label": "Réglages" }, h(Icone, { n: "reglages", t: 22 }))),
    h(BandeSemaine, { iso, setIso }),
    r && h(Affiches),
    r && h(Coach),
    !r && h("div.retour-jour", h(Bouton, { cl: "contour", onClick: () => setIso(auj) }, "Revenir à aujourd'hui")),
    h(Journee, { iso }),
    iso <= auj && h(Petits, { iso }),
    h(Section, { titre: "Ta régularité", droite: h("span.compte", "12 semaines") }, h(Mur, { jours: regularite(12) }), h("p.note", "Plus une case est pleine, plus la journée est complète : séance, repas suivis, saisie du matin.")));
}
