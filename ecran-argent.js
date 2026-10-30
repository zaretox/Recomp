"use strict";
/* ARGENT — « Combien il me reste ? »
 * Un seul chiffre : le reste à vivre. Dessous, les charges à cocher, les enveloppes et les opérations. */
function EcranArgent() {
  useDB();
  const [ym, setYm] = useState(moisDe(aujourdhui())), b = bilanMois(ym), cour = ym === moisDe(aujourdhui());
  const ops = [...DB.get("fin-income").map(e => ({ ...e, _t: "rev" })), ...DB.get("fin-expenses").map(e => ({ ...e, _t: "dep" }))].filter(e => moisDe(e.dateISO) === ym).sort((a, c) => c.dateISO.localeCompare(a.dateISO) || c.id - a.id);
  const cats = CATEGORIES.filter(c => (b.parCat[c] || 0) > 0 || b.caps[c] > 0).sort((a, c) => (b.parCat[c] || 0) - (b.parCat[a] || 0));
  const plafond = async c => { const v = await saisir({ titre: "Enveloppe " + c, valeur: b.caps[c] || null, mode: "ent", unite: "€", pas: [10, 50], min: 0, indice: "0 pour retirer l'enveloppe" }); if (v != null) DB.set("fin-caps", { ...b.caps, [c]: v }); };
  const parMois = Array.from({ length: 6 }, (_, i) => { let m = ym; for (let k = 0; k < 5 - i; k++) m = moisPrec(m); return { l: MOIS[+m.slice(5) - 1].slice(0, 3), v: Math.round(sommeMois(DB.get("fin-expenses"), m)) }; });
  return h("div.page", { "data-t": "argent" },
    h("header.hero", { "data-ton": "argent" },
      h("div.mois", h("button.rond", { onClick: () => setYm(moisPrec(ym)), "aria-label": "Mois précédent" }, h(Icone, { n: "retour", t: 18 })), h("span.affiche-e", nomMois(ym)), h("button.rond", { onClick: () => setYm(moisSuiv(ym)), disabled: cour, "aria-label": "Mois suivant" }, h(Icone, { n: "fleche", t: 18 }))),
      h("div.affiche-g", h(Geant, null, h(Compteur, { v: (b.reste < 0 ? "−" : "") + entier(Math.abs(b.reste)) })), h("em", "€")),
      h("p", !b.rev ? "Ajoute tes revenus pour voir ce qu'il te reste." : b.reste < 0 ? "Tu dépasses de " + euros(-b.reste) + " ce mois-ci." : cour ? "à dépenser, soit " + Math.round(b.parJour) + " € par jour pendant " + pluriel(b.restants, "jour") : "restants à la fin du mois"),
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
          h(Coche, { fait: f.paye, onClick: () => cocherFixe(f, ym), label: f.label, t: 34 }),
          h("span", h("b", f.label), h("small", "le " + (f.jour || 1) + ", " + (f.cat || "Autre").toLowerCase())),
          h("b.montant", euros(f.montant, f.montant % 1 ? 2 : 0))))) : h(Vide, null, "Loyer, salle, abonnements : ajoute-les une fois, puis coche-les chaque mois.")),
      h(Section, { titre: "Enveloppes", droite: h("span.compte", "touche pour fixer un plafond") },
        cats.length ? h("div.enveloppes", cats.map(c => {
          const v = Math.round(b.parCat[c] || 0), cap = b.caps[c] || 0;
          return h("button", { key: c, onClick: () => plafond(c), className: cap && v > cap ? "depasse" : "" },
            h("span", h("b", c), h("em", cap ? v + " / " + cap + " €" : v + " €")),
            h(Jauge, { v, max: cap || Math.max(...cats.map(x => b.parCat[x] || 0)), ton: cap && v > cap ? "rouge" : "argent" }));
        })) : h(Vide, null, "Aucune dépense ce mois-ci.")),
      h(Section, { titre: "Six derniers mois" },
        h(Barres, { pts: parMois, ton: "argent", unite: " €" }),
        h("div.tuiles",
          h(Tuile, { v: b.taux != null ? b.taux + " %" : "—", l: "épargné ce mois" }),
          h(Tuile, { v: b.evolution != null ? signe(b.evolution, 0) + " %" : "—", l: "face à " + nomMois(moisPrec(ym)) }))),
      h(Section, { titre: "Objectif d'épargne" }, h(Champ, { etiquette: "Par mois", valeur: b.objectif || null, mode: "ent", unite: "€", pas: [10, 50], min: 0, onChange: v => DB.set("fin-goal", v) })),
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
    if (rev) { await DB.set("fin-income", [...i2, { id, dateISO: iso, montant: m, source: lib.trim() || "Revenu" }]); if (edite) await DB.set("fin-expenses", d2); }
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
