"use strict";
/* ARGENT — « Combien il me reste ? »
 * Un seul chiffre : le reste à vivre. Dessous, les charges à cocher, les enveloppes et les opérations. */
function EcranArgent() {
  useDB();
  // On navigue d'une paye à l'autre ; « décalage » 0 = la période en cours
  const [dec, setDec] = useState(0), liste = periodes(), k = Math.max(0, liste.length - 1 - dec), p = liste[k], b = bilanPeriode(p.debut, p.fin), cour = b.cour;
  const ops = [...DB.get("fin-income").map(e => ({ ...e, _t: "rev" })), ...DB.get("fin-expenses").map(e => ({ ...e, _t: "dep" }))].filter(e => dansPeriode(e, p)).sort((a, c) => c.dateISO.localeCompare(a.dateISO) || c.id - a.id);
  const cats = CATEGORIES.filter(c => (b.parCat[c] || 0) > 0 || b.caps[c] > 0).sort((a, c) => (b.parCat[c] || 0) - (b.parCat[a] || 0));
  const plafond = async c => { const v = await saisir({ titre: "Enveloppe " + c, valeur: b.caps[c] || null, mode: "ent", unite: "€", pas: [10, 50], min: 0, indice: "0 pour retirer l'enveloppe" }); if (v != null) DB.set("fin-caps", { ...b.caps, [c]: v }); };
  const parMois = p.civil
    ? Array.from({ length: 6 }, (_, i) => { let m = moisDe(p.debut); for (let j = 0; j < 5 - i; j++) m = moisPrec(m); return { l: MOIS[+m.slice(5) - 1].slice(0, 3), v: Math.round(sommeMois(DB.get("fin-expenses"), m)) }; })
    : liste.slice(Math.max(0, k - 5), k + 1).map(x => ({ l: MOIS[+x.debut.slice(5, 7) - 1].slice(0, 3), v: Math.round(sommePeriode(DB.get("fin-expenses"), x)) }));
  const prochaine = b.enRetard ? "Ta paye était attendue le " + dateJour(b.prevue) + "." : p.civil ? "" : "Prochaine paye vers le " + dateJour(decale(b.fin, 1)) + ".";
  return h("div.page", { "data-t": "argent" },
    h("header.hero", { "data-ton": "argent" },
      h("div.mois", h("button.rond", { onClick: () => setDec(dec + 1), disabled: k === 0, "aria-label": "Période précédente" }, h(Icone, { n: "retour", t: 18 })), h("span.affiche-e", nomPeriode(b)), h("button.rond", { onClick: () => setDec(Math.max(0, dec - 1)), disabled: dec === 0, "aria-label": "Période suivante" }, h(Icone, { n: "fleche", t: 18 }))),
      h("div.affiche-g", h(Geant, null, h(Compteur, { v: (b.reste < 0 ? "−" : "") + entier(Math.abs(b.reste)) })), h("em", "€")),
      h("p", !b.rev ? "Ajoute ta paye pour voir ce qu'il te reste." : b.reste < 0 ? "Tu dépasses de " + euros(-b.reste) + (p.civil ? " ce mois-ci." : " depuis ta paye.") + (cour && prochaine ? " " + prochaine : "")
        : cour ? (b.enRetard ? "à dépenser. " + prochaine : "à dépenser, soit " + Math.round(b.parJour) + " € par jour pendant " + pluriel(b.restants, "jour") + "." + (prochaine ? " " + prochaine : "")) : p.civil ? "restants à la fin du mois" : "restants avant la paye suivante"),
      h("div.hero-l",
        h("span", h("b", euros(b.rev)), b.estimeRev && b.rev ? "revenus estimés" : "revenus"),
        h("span", h("b", euros(b.depenses)), "dépensés"),
        h("span", h("b", euros(b.aVenir)), "à venir"),
        b.objectif > 0 && h("span", h("b", euros(b.objectif)), "à épargner"))),
    h("div.corps-p",
      h("div.deux-b",
        h(Bouton, { cl: "plein", ico: "moins", onClick: () => Nav.sheet("operation") }, "Dépense"),
        h(Bouton, { cl: "contour", ico: "plus", onClick: () => Nav.sheet("operation", { revenu: true }) }, "Revenu")),
      h(Section, { titre: "Charges fixes", droite: h(Lien, { onClick: () => Nav.sheet("fixes") }, "Gérer") },
        b.fixes.length ? h("div.journee", b.fixes.map(f => h("div.course", { key: f.id, className: f.paye ? "fait" : "" },
          h(Coche, { fait: f.paye, onClick: () => cocherFixe(f, p), label: f.label, t: 34 }),
          h("span", h("b", f.label), h("small", (p.civil ? "le " + (f.jour || 1) : dateJour(f.echeance)) + ", " + (f.cat || "Autre").toLowerCase())),
          h("b.montant", euros(f.montant, f.montant % 1 ? 2 : 0))))) : h(Vide, null, "Loyer, salle, abonnements : ajoute-les une fois, puis coche-les chaque mois.")),
      h(Section, { titre: "Enveloppes", droite: h("span.compte", "touche pour fixer un plafond") },
        cats.length ? h("div.enveloppes", cats.map(c => {
          const v = Math.round(b.parCat[c] || 0), cap = b.caps[c] || 0;
          return h("button", { key: c, onClick: () => plafond(c), className: cap && v > cap ? "depasse" : "" },
            h("span", h("b", c), h("em", cap ? v + " / " + cap + " €" : v + " €")),
            h(Jauge, { v, max: cap || Math.max(...cats.map(x => b.parCat[x] || 0)), ton: cap && v > cap ? "rouge" : "argent" }));
        })) : h(Vide, null, p.civil ? "Aucune dépense ce mois-ci." : "Aucune dépense depuis ta paye.")),
      h(Section, { titre: p.civil ? "Six derniers mois" : "Six dernières payes" },
        h(Barres, { pts: parMois, ton: "argent", unite: " €" }),
        h("div.tuiles",
          h(Tuile, { v: b.taux != null ? b.taux + " %" : "—", l: p.civil ? "épargné ce mois" : "épargné sur cette paye" }),
          h(Tuile, { v: b.evolution != null ? signe(b.evolution, 0) + " %" : "—", l: p.civil ? "face à " + nomMois(moisPrec(moisDe(p.debut))) : "face à la paye d'avant" }))),
      h(Section, { titre: "Objectif d'épargne" }, h(Champ, { etiquette: p.civil ? "Par mois" : "Par paye", valeur: b.objectif || null, mode: "ent", unite: "€", pas: [10, 50], min: 0, onChange: v => DB.set("fin-goal", v) })),
      h(Section, { titre: "Opérations", droite: h("span.compte", ops.length) },
        ops.length ? ops.slice(0, 40).map(o => h("button.ligne", { key: o._t + o.id, onClick: () => Nav.sheet("operation", { edite: o }) },
          h("span", h("b", o._t === "rev" ? o.source : o.label || o.cat), h("small", dateMini(o.dateISO) + (o._t === "dep" && o.label ? ", " + o.cat.toLowerCase() : ""))),
          h("b", { className: o._t === "rev" ? "plus" : "" }, (o._t === "rev" ? "+" : "−") + euros(o.montant, o.montant % 1 ? 2 : 0)))) : h(Vide, null, "Aucune opération."))));
}

/* Ajouter ou modifier une dépense ou un revenu. Le clavier est ouvert d'emblée : montant, catégorie, c'est fait. */
function FeuilleOperation({ revenu, edite }) {
  const estRev = edite ? edite._t === "rev" : !!revenu;
  const [rev, setRev] = useState(estRev), [txt, setTxt] = useState(edite ? String(edite.montant).replace(".", ",") : ""), [neuf, setNeuf] = useState(true);
  const [cat, setCat] = useState(edite?.cat || "Courses"), [lib, setLib] = useState(edite ? (edite.label || edite.source || "") : ""), [iso, setIso] = useState(edite?.dateISO || aujourdhui());
  // Une paye ouvre une nouvelle période de budget. Par défaut : oui, si aucune paye n'est arrivée depuis 20 jours.
  const [paye, setPaye] = useState(() => edite?._t === "rev" ? (edite.paye ?? datesPaye().includes(edite.dateISO)) : !datesPaye().some(d => ecart(d, aujourdhui()) < 20));
  const recents = useMemo(() => {
    const vus = new Map();
    [...DB.get("fin-expenses")].reverse().forEach(e => { if (e.label && !e.fixId && !vus.has(e.label)) vus.set(e.label, e); });
    return [...vus.values()].slice(0, 6);
  }, []);
  const valider = async () => {
    const m = parseNb(txt);
    if (!m || m <= 0) return toast("Indique un montant");
    const inc = DB.get("fin-income"), dep = DB.get("fin-expenses"), id = edite?.id ?? Date.now();
    const i2 = inc.filter(x => !edite || x.id !== edite.id), d2 = dep.filter(x => !edite || x.id !== edite.id);
    if (rev) { await DB.set("fin-income", [...i2, { id, dateISO: iso, montant: m, source: lib.trim() || (paye ? "Paye" : "Revenu"), paye }]); if (edite) await DB.set("fin-expenses", d2); }
    else { await DB.set("fin-expenses", [...d2, { ...(edite?.fixId ? { fixId: edite.fixId } : {}), id, dateISO: iso, montant: m, cat, label: lib.trim() }]); if (edite) await DB.set("fin-income", i2); }
    Nav.fermer();
    toast((rev ? "+" : "−") + nb(m, 2) + " € enregistrés");
  };
  const suppr = async () => {
    const cle = edite._t === "rev" ? "fin-income" : "fin-expenses";
    Nav.fermer();
    avecAnnuler(cle, DB.get(cle).filter(x => x.id !== edite.id), "Opération supprimée");
  };
  return h(Feuille, { titre: edite ? "Modifier" : rev ? "Revenu" : "Dépense", ton: "argent" },
    !edite && h(Puces, null, h(Puce, { actif: !rev, onClick: () => setRev(false) }, "Dépense"), h(Puce, { actif: rev, onClick: () => setRev(true) }, "Revenu")),
    h("div.montant-g", { className: neuf ? "neuf" : "" }, h("b", affichage(txt, "dec")), h("em", "€")),
    !rev && recents.length > 0 && !edite && h(Puces, { defile: true }, recents.map(r => h(Puce, { key: r.label, onClick: () => { setTxt(String(r.montant).replace(".", ",")); setCat(r.cat); setLib(r.label); setNeuf(true); } }, r.label))),
    !rev && h(Puces, { defile: true }, CATEGORIES.map(c => h(Puce, { key: c, actif: cat === c, onClick: () => setCat(c) }, c))),
    rev && h(Puces, null, h(Puce, { actif: paye, onClick: () => setPaye(true) }, "C'est ma paye"), h(Puce, { actif: !paye, onClick: () => setPaye(false) }, "Autre revenu")),
    h("input.recherche", { value: lib, onChange: e => setLib(e.target.value), placeholder: rev ? "Source (facultatif)" : "Libellé (facultatif)", "aria-label": "Libellé" }),
    h(Clavier, { mode: "dec", txt, setTxt, neuf, setNeuf, valeurNum: () => parseNb(txt) || 0, onOk: valider, ok: "OK" }),
    h("div.date-op",
      h("button.mini", { onClick: () => setIso(decale(iso, -1)) }, "Veille"),
      h("span", iso === aujourdhui() ? "Aujourd'hui" : dateJour(iso)),
      iso < aujourdhui() && h("button.mini", { onClick: () => setIso(decale(iso, 1)) }, "Lendemain")),
    edite && h(Bouton, { cl: "contour danger-t", onClick: suppr }, "Supprimer"));
}

function FeuilleFixes() {
  useDB();
  const fixes = DB.get("fin-fixes"), [lib, setLib] = useState("");
  const ajoute = async () => {
    if (!lib.trim()) return toast("Donne un nom à cette charge");
    const r = await saisir([{ titre: lib.trim() + " : montant", court: "Montant", mode: "dec", unite: "€", min: 0 }, { titre: "Jour du mois", court: "Jour", valeur: 1, mode: "ent", min: 1, max: 31, pas: [1] }]);
    if (!r || !r[0]) return;
    await DB.set("fin-fixes", [...fixes, { id: nouvelId("f"), label: lib.trim(), montant: r[0], cat: /loyer|edf|elec|gaz|assur/i.test(lib) ? "Logement" : /salle|sport/i.test(lib) ? "Sport" : "Abonnements", jour: r[1] || 1 }]);
    setLib("");
  };
  return h(Feuille, { titre: "Charges fixes", ton: "argent" },
    fixes.map(f => h("div.histo", { key: f.id }, h("span", f.label + ", le " + (f.jour || 1)), h("b", euros(f.montant, f.montant % 1 ? 2 : 0)), h("button.mini-x", { "aria-label": "Retirer", onClick: () => avecAnnuler("fin-fixes", fixes.filter(x => x.id !== f.id), "Charge retirée") }, h(Icone, { n: "fermer", t: 16 })))),
    h("input.recherche", { value: lib, onChange: e => setLib(e.target.value), placeholder: "Loyer, salle, forfait…", "aria-label": "Nom de la charge" }),
    h(Bouton, { cl: "plein", onClick: ajoute }, "Ajouter"));
}
