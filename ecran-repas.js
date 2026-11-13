"use strict";
/* REPAS — « Qu'est-ce que je mange ? »
 * Ce qu'il reste, les repas à cocher, le hors-menu, la cible, les courses. */
const LigneMacro = ({ l, v, t }) => h("div.macro", h("span", l), h(Jauge, { v, max: t, ton: "noir" }), h("b", Math.round(v) + " / " + t + " g"));

function EcranRepas() {
  useDB();
  const auj = aujourdhui(), [iso] = useState(auj), n = jourNutrition(iso), bt = objectifs(), dep = depenseReelle();
  const hier = decale(iso, -1), extrasHier = (DB.get("food-log")[hier] || []).filter(f => !f.plan);
  const suppr = id => avecAnnuler("food-log", { ...DB.get("food-log"), [iso]: (DB.get("food-log")[iso] || []).filter(x => x.id !== id) }, "Aliment retiré");
  const faits = n.lignes.filter(l => l.fait).length;
  return h("div.page", { "data-t": "repas" },
    h("header.hero", { "data-ton": "repas" },
      h("span.affiche-e", n.reste >= 0 ? "Reste à manger" : "Au-dessus de ta cible"),
      h("div.affiche-g", h(Geant, null, h(Compteur, { v: entier(Math.abs(n.reste)) })), h("em", "kcal")),
      h("p", entier(n.mange.kcal) + " mangées sur " + entier(n.menu.dayTgt) + (n.menu.swimExtra ? ", natation comprise" : "")),
      h("div.macros", h(LigneMacro, { l: "Protéines", v: n.mange.p, t: n.menu.dayMacros.p }), h(LigneMacro, { l: "Glucides", v: n.mange.g, t: n.menu.dayMacros.g }), h(LigneMacro, { l: "Lipides", v: n.mange.l, t: n.menu.dayMacros.l }))),
    h("div.corps-p",
      h(Section, { titre: "Tes repas", droite: h("span.compte", faits + "/" + n.lignes.length) },
        h(Puces, null,
          h(Puce, { actif: n.dayType === "training", onClick: () => changerTypeJour(iso, "training") }, "Jour d'entraînement"),
          h(Puce, { actif: n.dayType === "rest", onClick: () => changerTypeJour(iso, "rest") }, "Jour de repos")),
        n.facteurReste !== 1 && h("p.note.fort", (n.facteurReste < 1 ? "Portions restantes réduites de " : "Portions restantes augmentées de ") + Math.round(Math.abs(1 - n.facteurReste) * 100) + " % pour tomber juste."),
        h("div.journee", n.lignes.map(l => h(LigneJour, { key: l.id, it: { cle: l.id, h: l.m.h, t: l.m.m, s: (l.m.altLabel ? l.m.altLabel + ", " : "") + (l.fait ? l.kcal : Math.round(l.kcal * n.facteurReste)) + " kcal", fait: l.fait, coche: () => cocherRepas(iso, l.id), ouvre: () => Nav.sheet("repas", { iso, id: l.id }), ton: "repas" } })))),
      h(Section, { titre: "Hors menu", droite: h("span.compte", entier(n.horsMenu.reduce((a, f) => a + (f.kcal || 0), 0)) + " kcal") },
        n.horsMenu.map(f => h("div.histo", { key: f.id }, h("span", f.nom + (f.grams ? ", " + f.grams + " g" : "")), h("b", f.kcal + " kcal"), h("button.mini-x", { "aria-label": "Retirer", onClick: () => suppr(f.id) }, h(Icone, { n: "fermer", t: 16 })))),
        h("div.deux-b",
          h(Bouton, { cl: "contour", ico: "plus", onClick: () => Nav.sheet("aliment", { iso }) }, "Ajouter un aliment"),
          extrasHier.length > 0 && h(Bouton, { cl: "contour", onClick: () => { const log = DB.get("food-log"); DB.set("food-log", { ...log, [iso]: [...(log[iso] || []), ...extrasHier.map((f, k) => ({ ...f, id: Date.now() + k }))] }); toast("Hors-menu d'hier copié"); } }, "Comme hier"))),
      h(Section, { titre: "Ta cible" },
        h(Rangee, { ico: "repas", titre: bt.cal ? entier(bt.cal.target) + " kcal par jour" : "Cible à configurer", sous: bt.cal ? "déficit de " + cfgCalories().deficit + " kcal, " + bt.prot + " g de protéines" : "Âge et taille suffisent", onClick: () => Nav.sheet("calories") }),
        dep.pret && h(Rangee, { ico: "corps", titre: "Dépense réelle : " + entier(dep.kcal) + " kcal", sous: "mesurée sur " + dep.jours + " jours", onClick: () => Nav.sheet("calories") })),
      h(Section, { titre: "Courses" }, (() => { const e = etatCourses(), l = listeCourses(e.debut, e.jours), c = Object.keys(e.coches).filter(k => e.coches[k]).length; return h(Rangee, { ico: "panier", titre: "Liste de la semaine", sous: l.lignes.length + " produits, environ " + Math.round(l.total) + " €", valeur: c ? c + "/" + l.lignes.length : null, onClick: () => Nav.sheet("courses") }); })())));
}

/* Un repas en détail : portions recalées et plats de remplacement */
function FeuilleRepas({ iso, id }) {
  useDB();
  const n = jourNutrition(iso), l = n.lignes.find(x => x.id === id);
  if (!l) return h(Feuille, { titre: "Repas" }, h(Vide, null, "Ce repas n'est pas prévu ce jour-là."));
  const fr = l.fait ? (n.nlog?.mealScale?.[id] || 1) : n.facteurReste;
  const base = (n.dayType === "training" ? REPAS_ENTRAINEMENT : REPAS_REPOS).find(m => m.m === l.m.m);
  const alts = DB.get("repas-alts"), cle = n.dayType + ":" + l.m.m, choix = alts[cle] || 0;
  const qte = it => { const f = n.menu.itemF(it) * (it.fix ? 1 : fr); return it.fix ? (it.u || it.cru + " g") : Math.round(it.cru * f / 5) * 5 + " g" + (it.cuit ? " (cuit " + Math.round(it.cuit * f / 5) * 5 + " g)" : "") + (it.u ? ", " + it.u : ""); };
  return h(Feuille, { titre: l.m.m, ton: "repas" },
    h("p.sous-t", hhmm(l.m.h) + ", " + Math.round(l.kcal * fr / (l.fait ? (n.nlog?.mealScale?.[id] || 1) : 1)) + " kcal, " + Math.round(l.macros.p * fr) + " g de protéines"),
    base.alts && h(Section, { titre: "Plat" }, h(Puces, { defile: true },
      h(Puce, { actif: choix === 0, onClick: () => DB.set("repas-alts", { ...alts, [cle]: 0 }) }, "Plat de base"),
      base.alts.map((a, i) => h(Puce, { key: i, actif: choix === i + 1, onClick: () => DB.set("repas-alts", { ...alts, [cle]: i + 1 }) }, a.label)))),
    h("div.liste", l.m.items.map((it, i) => it.t ? h("div.ingr", { key: i }, h("span.pale", it.t))
      : h("button.ingr", { key: i, onClick: () => Nav.sheet("equivalents", { nom: it.n, g: Math.round(it.cru * n.menu.itemF(it)) }) }, h("span", it.n), h("b", qte(it))))),
    h("p.note", "Touche un aliment pour voir par quoi le remplacer."),
    l.m.note && h("p.note", l.m.note),
    h(Bouton, { cl: l.fait ? "contour" : "plein", onClick: () => { cocherRepas(iso, id); Nav.fermer(); } }, l.fait ? "Décocher ce repas" : "Je l'ai mangé"));
}

/* Ajouter un aliment : récents, recherche, ou calories directes */
function FeuilleAliment({ iso }) {
  useDB();
  const [q, setQ] = useState(""), [creer, setCreer] = useState(false);
  const jour = iso || aujourdhui(), ql = sansAccent(q.trim());
  const liste = ql ? tousAliments().filter(f => sansAccent(f.nom).includes(ql)).slice(0, 30) : [];
  const ajoute = e => { const log = DB.get("food-log"); DB.set("food-log", { ...log, [jour]: [...(log[jour] || []), { id: Date.now(), ...e }] }); };
  const avecGrammes = async f => {
    const g = await saisir({ titre: f.nom, valeur: f.grams || 100, mode: "ent", unite: "g", pas: [10, 50], min: 0, presets: [50, 100, 150, 200, 250], indice: Math.round(f.kcal) + " kcal pour 100 g" });
    if (!g) return;
    ajoute({ nom: f.nom, grams: g, p: arrondi(f.p * g / 100), gl: arrondi(f.g * g / 100), l: arrondi(f.l * g / 100), kcal: Math.round(f.kcal * g / 100) });
    toast(f.nom + " : " + Math.round(f.kcal * g / 100) + " kcal ajoutées, tes repas se recalent");
    Nav.fermer();
  };
  const direct = async () => {
    const k = await saisir({ titre: "Calories en plus", valeur: null, mode: "ent", unite: "kcal", pas: [50, 100], min: 0, indice: "Une part de pizza ≈ 285, un sandwich ≈ 450, une bière ≈ 150.", presets: [150, 285, 450] });
    if (!k) return;
    ajoute({ nom: "En plus", grams: null, p: 0, gl: 0, l: 0, kcal: Math.round(k) });
    toast("+" + Math.round(k) + " kcal notées, tes repas se recalent");
    Nav.fermer();
  };
  const nouveau = async () => {
    const nom = q.trim();
    const r = await saisir([
      { titre: "Protéines pour 100 g", court: "Prot.", mode: "dec", unite: "g", pas: [1], min: 0 },
      { titre: "Glucides pour 100 g", court: "Gluc.", mode: "dec", unite: "g", pas: [1], min: 0 },
      { titre: "Lipides pour 100 g", court: "Lip.", mode: "dec", unite: "g", pas: [1], min: 0 },
    ]);
    if (!r) return;
    const [p, g, l] = r.map(x => x || 0);
    if (p + g + l <= 0) return toast("Indique au moins une valeur");
    const f = { nom, cat: p >= g && p * 4 >= l * 9 ? "prot" : l * 9 >= g * 4 ? "lip" : "gluc", p, g, l, kcal: Math.round(p * 4 + g * 4 + l * 9) };
    await DB.set("foods-custom", [f, ...DB.get("foods-custom").filter(x => x.nom !== nom)]);
    toast(nom + " ajouté à tes aliments");
    setCreer(false);
    avecGrammes(f);
  };
  const recents = alimentsRecents();
  return h(Feuille, { titre: "Ajouter", ton: "repas" },
    jour !== aujourdhui() && h("p.sous-t", "Pour le " + dateLongue(jour).toLowerCase()),
    h("input.recherche", { value: q, onChange: e => { setQ(e.target.value); setCreer(false); }, placeholder: "Chercher un aliment", "aria-label": "Chercher un aliment" }),
    !ql && h(Bouton, { cl: "contour", ico: "plus", onClick: direct }, "Juste des calories"),
    ql ? h(Fragment, null,
      h("div.liste", liste.map(f => h("button.ligne", { key: f.nom, onClick: () => avecGrammes(f) }, h("span", f.nom), h("small", Math.round(f.kcal) + " kcal / 100 g")))),
      !tousAliments().some(f => sansAccent(f.nom) === ql) && h(Bouton, { cl: "contour", onClick: nouveau }, "Créer « " + q.trim() + " »"))
    : h(Fragment, null,
      recents.length > 0 && h(Section, { titre: "Récents" }, h("div.liste", recents.map(f => { const b = tousAliments().find(x => x.nom === f.nom); return h("button.ligne", { key: f.nom, onClick: () => { if (b) return avecGrammes({ ...b, grams: f.grams }); const { id, ...reste } = f; ajoute(reste); Nav.fermer(); } }, h("span", f.nom), h("small", f.grams + " g, " + f.kcal + " kcal")); }))),
      DB.get("foods-custom").length > 0 && h(Section, { titre: "Tes aliments" }, h("div.liste", DB.get("foods-custom").map(f => h("button.ligne", { key: f.nom, onClick: () => avecGrammes(f) }, h("span", f.nom), h("small", f.kcal + " kcal / 100 g")))))));
}

const ACTIVITES = [["Sédentaire", 1.2], ["Léger", 1.375], ["Modéré", 1.55], ["Élevé", 1.725]];
const OBJECTIFS = [["Maintien", 0], ["−300", 300], ["−500", 500], ["−700", 700], ["−1000", 1000], ["+250", -250]];
const MODES_PROT = [["1,8 g/kg", "1.8"], ["2 g/kg", "2.0"], ["2,2 g/kg", "2.2"], ["Masse maigre", "lean"]];

function FeuilleCalories() {
  useDB();
  const brut = DB.get("nutri-cal-cfg") || {}, c = cfgCalories() || { sex: "H", age: "", activity: 1.55, deficit: 700, protMode: "lean" };
  const bt = objectifs(), dep = depenseReelle(), cm = parseFloat(DB.get("taille-corps")) || 0;
  const maj = p => DB.set("nutri-cal-cfg", { ...brut, sex: c.sex, age: c.age || null, activity: c.activity, deficit: c.deficit, protMode: c.protMode, ...p });
  return h(Feuille, { titre: "Ta cible", ton: "repas" },
    bt.cal ? h("div.tuiles",
      h(Tuile, { v: entier(bt.cal.target), l: "kcal par jour" }),
      h(Tuile, { v: bt.macros.p + " g", l: "protéines" }),
      h(Tuile, { v: entier(bt.cal.tdee), l: c.depense ? "dépense mesurée" : "dépense estimée" }))
      : h(Vide, null, "Il manque ton âge, ta taille ou une pesée pour calculer ta cible."),
    h(Section, { titre: "Dépense réelle" }, dep.pret
      ? h(Fragment, null,
        h("p.texte-p", "Sur " + dep.jours + " jours, tu as mangé " + entier(dep.apports) + " kcal par jour en moyenne et ta tendance de poids a bougé en conséquence : ton corps dépense environ ", h("b", entier(dep.kcal) + " kcal"), ", contre " + entier(dep.formule) + " d'après la formule."),
        h(Bouton, { cl: c.depense === dep.kcal ? "contour" : "plein", onClick: () => { maj({ depense: dep.kcal, lastAdjust: aujourdhui() }); toast("Cible recalculée sur ta dépense réelle"); } }, c.depense === dep.kcal ? "Dépense réelle adoptée" : "Adopter " + entier(dep.kcal) + " kcal"),
        c.depense && h(Bouton, { cl: "contour", onClick: () => maj({ depense: null }) }, "Revenir à la formule"))
      : h(Vide, null, "Je mesure ta vraie dépense à partir de ce que tu manges et de ton poids. Il me faut 14 jours avec des pesées régulières et des repas cochés.")),
    h(Section, { titre: "Objectif (kcal par jour)" }, h(Puces, null, OBJECTIFS.map(([l, v]) => h(Puce, { key: v, actif: c.deficit === v, onClick: () => maj({ deficit: v }) }, l)))),
    h(Section, { titre: "Toi" },
      h("div.quatre",
        h(Champ, { etiquette: "Âge", valeur: c.age, mode: "ent", unite: "ans", pas: [1], onChange: v => maj({ age: v }) }),
        h(Champ, { etiquette: "Taille", valeur: cm || null, mode: "ent", unite: "cm", pas: [1], onChange: v => DB.set("taille-corps", v) })),
      h(Puces, null, [["Homme", "H"], ["Femme", "F"]].map(([l, v]) => h(Puce, { key: v, actif: c.sex === v, onClick: () => maj({ sex: v }) }, l)))),
    h(Section, { titre: "Activité hors séances" }, h(Puces, null, ACTIVITES.map(([l, v]) => h(Puce, { key: v, actif: c.activity === v, onClick: () => maj({ activity: v }) }, l)))),
    h(Section, { titre: "Protéines" }, h(Puces, null, MODES_PROT.map(([l, v]) => h(Puce, { key: v, actif: c.protMode === v, onClick: () => maj({ protMode: v }) }, l)))));
}

/* COURSES — calculées depuis tes menus. On coche en magasin, on note le ticket à la fin. */
function FeuilleCourses() {
  useDB();
  const e = etatCourses(), { lignes, total } = listeCourses(e.debut, e.jours);
  const maj = p => DB.set("courses-etat", { ...e, ...p });
  const coche = id => maj({ coches: { ...e.coches, [id]: !e.coches[id] } });
  const prix = async l => {
    const r = await saisir([
      { titre: "Prix payé", court: "Prix", valeur: null, mode: "dec", unite: "€", min: 0 },
      { titre: "Poids acheté", court: "Poids", valeur: Math.round(l.grammes), mode: "ent", unite: "g", pas: [100, 500], min: 0 },
    ]);
    if (!r || !r[0] || !r[1]) return;
    const auj = aujourdhui();
    await DB.set("budget-logs", [...DB.get("budget-logs"), { id: Date.now(), date: dateCourte(auj), dateISO: auj, prodId: l.id, prodNom: l.nom, prix: r[0], poids: r[1], prixKg: arrondi(r[0] / r[1] * 1000, 2) }]);
    toast("Prix noté : " + nb(arrondi(r[0] / r[1] * 1000, 2), 2) + " €/kg");
  };
  const terminer = async () => {
    const m = await saisir({ titre: "Total du ticket", valeur: Math.round(total), mode: "dec", unite: "€", min: 0 });
    if (m == null) return;
    const auj = aujourdhui();
    if (m > 0) await DB.set("fin-expenses", [...DB.get("fin-expenses"), { id: Date.now(), dateISO: auj, montant: m, cat: "Courses", label: "Courses de la semaine" }]);
    await DB.set("courses-etat", { debut: auj, jours: e.jours, coches: {}, ajouts: [], eco: e.eco });
    Nav.fermer();
    toast("Courses enregistrées : " + nb(m, 2) + " €");
  };
  const faits = lignes.filter(l => e.coches[l.id]).length, gain = lignes.reduce((a, l) => a + (l.gainEco || 0), 0);
  const ajout = useRef(null);
  return h(Feuille, { titre: "Courses", ton: "repas" },
    h("div.tuiles", h(Tuile, { v: "~" + Math.round(total) + " €", l: "pour " + e.jours + " jours" }), h(Tuile, { v: faits + "/" + lignes.length, l: "dans le panier" })),
    h(Puces, null, [3, 5, 7].map(j => h(Puce, { key: j, actif: e.jours === j, onClick: () => maj({ jours: j }) }, j + " jours"))),
    gain > 0 && h("p.note", "Moins cher possible : jusqu'à " + gain + " € d'économie en touchant les produits marqués."),
    RAYONS.map((r, i) => {
      const l = lignes.filter(x => x.rayon === i);
      return l.length > 0 && h(Section, { key: r, titre: r }, l.map(x => h("div.course", { key: x.id, className: e.coches[x.id] ? "fait" : "" },
        h(Coche, { fait: !!e.coches[x.id], onClick: () => coche(x.id), label: x.nom, t: 34 }),
        h("span", h("b", x.nom), h("small", x.quantite + (x.ecoNom && !e.eco[x.id] ? ", ou " + x.ecoNom.toLowerCase() : ""))),
        x.gainEco > 0 && h("button.eco", { onClick: () => maj({ eco: { ...e.eco, [x.id]: true } }) }, "−" + x.gainEco + " €"),
        e.eco[x.id] && h("button.eco.actif", { onClick: () => maj({ eco: { ...e.eco, [x.id]: false } }) }, "Éco"),
        h("button.prix", { onClick: () => prix(x), "aria-label": "Noter le prix de " + x.nom }, Math.round(x.cout) + " €"))));
    }),
    h(Section, { titre: "En plus" },
      e.ajouts.map(a => h("div.course", { key: a.id, className: e.coches[a.id] ? "fait" : "" }, h(Coche, { fait: !!e.coches[a.id], onClick: () => coche(a.id), label: a.nom, t: 34 }), h("span", h("b", a.nom)), h("button.mini-x", { "aria-label": "Retirer", onClick: () => maj({ ajouts: e.ajouts.filter(x => x.id !== a.id) }) }, h(Icone, { n: "fermer", t: 16 })))),
      h("form.ajout", { onSubmit: ev => { ev.preventDefault(); const v = ajout.current.value.trim(); if (v) { maj({ ajouts: [...e.ajouts, { id: nouvelId("a"), nom: v }] }); ajout.current.value = ""; } } }, h("input.recherche", { ref: ajout, placeholder: "Ajouter un produit", "aria-label": "Ajouter un produit" }))),
    h(Bouton, { cl: "plein grand", onClick: terminer }, "Terminer et noter le ticket"));
}

/* Par quoi remplacer un aliment : même quantité de la macro dominante */
const MACRO_CAT = { prot: "p", gluc: "g", lip: "l" }, NOM_CAT = { prot: "protéines", gluc: "glucides", lip: "lipides" };
function FeuilleEquivalents({ nom, g }) {
  const base = tousAliments(), cle = sansAccent(nom).split(/[ /(]/)[0];
  const src = base.find(f => f.nom === nom) || base.find(f => sansAccent(f.nom).startsWith(cle));
  if (!src) return h(Feuille, { titre: nom, ton: "repas" }, h(Vide, null, "Pas d'équivalence connue pour cet aliment."));
  const mk = MACRO_CAT[src.cat], cible = src[mk] * g / 100;
  const liste = base.filter(f => f.cat === src.cat && f.nom !== src.nom && f[mk] > 0).map(f => { const q = cible / f[mk] * 100; return { nom: f.nom, g: Math.round(q / 5) * 5, kcal: Math.round(f.kcal * q / 100) }; }).sort((a, b) => a.kcal - b.kcal);
  return h(Feuille, { titre: "Remplacer", ton: "repas" },
    h("p.sous-t", g + " g de " + src.nom + " = " + Math.round(cible) + " g de " + NOM_CAT[src.cat] + ", " + Math.round(src.kcal * g / 100) + " kcal"),
    h("div.liste", liste.map(x => h("div.ingr", { key: x.nom }, h("span", x.nom), h("b", x.g + " g, " + x.kcal + " kcal")))));
}
