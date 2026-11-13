"use strict";
/* ARGENT — « Combien il me reste ? »
 * Un seul chiffre : ce que tu peux dépenser jusqu'à ta paye. Dessous, ton épargne, où va ton argent, les charges à cocher.
 * Les graphiques et toutes les opérations sont rangés dans « Détails ». */
function EcranArgent() {
  useDB();
  useDiscret();
  // Les montants se recachent quand on quitte l'onglet
  useEffect(() => () => Discret.cacher(), []);
  // On navigue d'une paye à l'autre ; « décalage » 0 = la période en cours
  const [dec, setDec] = useState(0), liste = periodes(), k = Math.max(0, liste.length - 1 - dec), p = liste[k], b = bilanPeriode(p.debut, p.fin), cour = b.cour;
  const ops = [...DB.get("fin-income").map(e => ({ ...e, _t: "rev" })), ...DB.get("fin-expenses").map(e => ({ ...e, _t: "dep" }))].filter(e => dansPeriode(e, p)).sort((a, c) => c.dateISO.localeCompare(a.dateISO) || c.id - a.id);
  const cats = CATEGORIES.filter(c => (b.parCat[c] || 0) > 0 || b.caps[c] > 0).sort((a, c) => (b.parCat[c] || 0) - (b.parCat[a] || 0));
  // Plafond proposé : ce que tu dépenses d'habitude dans la catégorie, arrondi à la dizaine au-dessus
  const hab = habituelParCat(), propose = c => hab[c] ? Math.ceil(hab[c] / 10) * 10 : null;
  const plafond = async c => { const v = await saisir({ titre: "Plafond " + c, valeur: b.caps[c] || propose(c), mode: "ent", unite: "€", pas: [10, 50], min: 0, indice: propose(c) ? "D'habitude : " + euros(hab[c]) + " par paye. 0 pour retirer." : "0 pour retirer le plafond" }); if (v != null) DB.set("fin-caps", { ...b.caps, [c]: v }); };
  const prev = cour ? prevision(b) : null, abos = cour ? abonnementsReperes() : [], coutAbos = coutAbonnements(), dehors = repasDehors(p);
  const parMois = p.civil
    ? Array.from({ length: 6 }, (_, i) => { let m = moisDe(p.debut); for (let j = 0; j < 5 - i; j++) m = moisPrec(m); return { l: MOIS[+m.slice(5) - 1].slice(0, 3), v: Math.round(sommeMois(DB.get("fin-expenses"), m)) }; })
    : liste.slice(Math.max(0, k - 5), k + 1).map(x => ({ l: MOIS[+x.debut.slice(5, 7) - 1].slice(0, 3), v: Math.round(sommePeriode(DB.get("fin-expenses"), x)) }));
  // Banque reliée : mise à jour toute seule à l'ouverture (au plus toutes les 4 heures)
  const lien = lienBanque(), [sync, setSync] = useState(false);
  const actualiser = async silencieux => {
    if (sync) return;
    setSync(true);
    try { const r = await importerBanque(); if (r.nouvelles || !silencieux) toast(r.nouvelles ? pluriel(r.nouvelles, "opération") + " récupérée" + (r.nouvelles > 1 ? "s" : "") + " de ta banque" : "Rien de nouveau à la banque"); }
    catch (e) { if (!silencieux) toast("Banque : " + e.message, { danger: true }); }
    finally { setSync(false); }
  };
  useEffect(() => { if (importBanqueDu()) actualiser(true); }, []);
  const aClasser = cour ? ops.filter(o => o._t === "dep" && o.banque && o.cat === "Autre").length : 0;
  const [rub, setRub] = useRubrique("argent", RUBRIQUES_ARGENT), [q, setQ] = useState(""), [filtre, setFiltre] = useState("tout");
  // Filtres des opérations : toutes, à classer, revenus, puis les catégories de la période
  const filtres = [["tout", "Toutes"], ...(aClasser ? [["classer", "À classer (" + aClasser + ")"]] : []), ["revenus", "Revenus"], ...cats.map(c => [c, c])];
  const estCat = CATEGORIES.includes(filtre);
  const qs = sansAccent(q.trim());
  const opsVues = ops.filter(o => (filtre === "tout" || (filtre === "classer" ? o._t === "dep" && o.banque && o.cat === "Autre" : filtre === "revenus" ? o._t === "rev" : o._t === "dep" && o.cat === filtre))
    && (!qs || sansAccent((o.label || "") + " " + (o.source || "") + " " + (o.cat || "")).includes(qs)));
  const jours = [];
  opsVues.slice(0, 150).forEach(o => { const g = jours[jours.length - 1]; if (g && g[0] === o.dateISO) g[1].push(o); else jours.push([o.dateISO, [o]]); });
  const voirCategorie = c => { setFiltre(c); setQ(""); setRub("operations"); setTimeout(() => document.getElementById("ancre-argent")?.scrollIntoView({ block: "start", behavior: "smooth" }), 30); };
  // Le filtre choisi reste visible dans la rangée de puces
  useEffect(() => { if (rub === "operations") document.querySelector(".puces .puce.actif")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [filtre, rub]);
  const prochaine = b.enRetard ? "Ta paye était attendue le " + dateJour(b.prevue) + "." : p.civil ? "" : "Prochaine paye vers le " + dateJour(decale(b.fin, 1)) + ".";
  return h("div.page", { "data-t": "argent" },
    h("header.hero", { "data-ton": "argent" },
      h("div.mois", h("button.rond", { onClick: () => setDec(dec + 1), disabled: k === 0, "aria-label": "Période précédente" }, h(Icone, { n: "retour", t: 18 })), h("span.affiche-e", nomPeriode(b)), h("button.rond", { onClick: () => setDec(Math.max(0, dec - 1)), disabled: dec === 0, "aria-label": "Période suivante" }, h(Icone, { n: "fleche", t: 18 }))),
      h("div.affiche-g", h(Geant, null, Discret.cache() ? h(PointsG) : h(Compteur, { v: (b.reste < 0 ? "−" : "") + entier(Math.abs(b.reste)) })), h("em", "€"), h(Oeil)),
      // Une seule ligne sous le chiffre ; le détail est dans Budget
      h("p", !b.rev ? "Ajoute ta paye pour voir ce qu'il te reste." : b.reste < 0 ? "Tu dépasses de " + eurosD(-b.reste) + (p.civil ? " ce mois-ci." : " depuis ta paye.")
        : !cour ? (p.civil ? "restants à la fin du mois" : "restants avant la paye suivante")
        : b.enRetard ? "à dépenser. Ta paye était attendue le " + dateJour(b.prevue) + "."
        : "à dépenser, soit " + eurosD(Math.round(b.parJour)) + " par jour " + (p.civil ? "jusqu'à la fin du mois." : "jusqu'à ta paye du " + dateJour(decale(b.fin, 1)) + "."))),
    h("div.corps-p.avec-rubriques",
      // La banque en une ligne ; noter une dépense ou un revenu passe par le « + »
      cour && lien?.session && h("div.synchro",
        h("span", (lien.banque === "BNP Paribas" ? "BNP" : lien.banque || "Banque") + (sync ? " · mise à jour…" : lien.derniere ? " · à jour " + (lien.derniere === aujourdhui() ? "aujourd'hui" : "le " + dateMini(lien.derniere)) : ""),
          lien.solde && h(Fragment, null, " · ", h("b.mt", euros(lien.solde.montant)), " sur ton compte")),
        h("button.mini", { disabled: sync, onClick: () => actualiser(false) }, "Actualiser")),
      h("div", { id: "ancre-argent", className: "ancre-r" }),
      h(SousOnglets, { liste: RUBRIQUES_ARGENT.map(([k, l]) => [k, l, k === "operations" && aClasser ? aClasser : null]), actif: rub, onChange: setRub }),
      rub === "budget" && h(Fragment, null,
        b.rev > 0 && h(Section, { titre: p.civil ? "Ton mois, poste par poste" : "Ta paye, poste par poste" },
          h("div.decompte",
            h("div", h("span", b.estimeRev ? "Revenus estimés" : p.civil ? "Revenus" : "Ta paye et tes revenus"), h("b.mt", euros(b.rev))),
            b.objectif > 0 && h("div", h("span", "− Épargne"), h("b.mt", euros(b.objectif))),
            b.aVenir > 0 && h("div", h("span", "− Charges fixes à venir"), h("b.mt", euros(b.aVenir))),
            h("div", h("span", "− Déjà dépensé"), h("b.mt", euros(b.depenses))),
            h("div.total", h("span", b.reste < 0 ? "= Dépassement" : "= Reste à dépenser"), h("b.mt", euros(b.reste)))),
          prev && prev.apres > 0 && h("p.note", { className: prev.fin < 0 ? "mal" : "" }, "À ce rythme (" + eurosD(Math.round(prev.rythme)) + " par jour), il te restera ", h("b", Discret.cache() ? "•••" : (prev.fin < 0 ? "−" : "") + euros(Math.abs(prev.fin))), " le " + dateJour(b.fin) + "." + (prev.fin < 0 ? " Vise " + eurosD(Math.round(prev.cible)) + " par jour." : ""))),
        h(Section, { titre: "Où va ton argent", droite: h("span.compte", "touche pour le détail") },
          cats.length ? h("div.enveloppes", cats.map(c => {
            const v = Math.round(b.parCat[c] || 0), cap = b.caps[c] || 0;
            return h("button", { key: c, onClick: () => voirCategorie(c), className: cap && v > cap ? "depasse" : "" },
              h("span", h("b", c), h("em.mt", cap ? v + " / " + cap + " €" : v + " €" + (propose(c) && cour ? " · d'habitude " + Math.round(hab[c]) + " €" : ""))),
              h(Jauge, { v, max: cap || Math.max(...cats.map(x => b.parCat[x] || 0)), ton: cap && v > cap ? "rouge" : "argent" }));
          })) : h(Vide, null, p.civil ? "Aucune dépense ce mois-ci." : "Aucune dépense depuis ta paye."),
          dehors.fois > 0 && h("p.note", "Dont repas dehors et livraisons : ", h("b.mt", euros(dehors.total)), " en " + pluriel(dehors.fois, "fois") + (p.civil ? " ce mois-ci." : " depuis ta paye."))),
        h(Section, { titre: "Charges fixes", droite: h(Lien, { onClick: () => Nav.sheet("fixes") }, "Gérer") },
          b.fixes.length ? h("div.journee", b.fixes.map(f => h("div.course", { key: f.id, className: f.paye ? "fait" : "" },
            h(Coche, { fait: f.paye, onClick: () => cocherFixe(f, p), label: f.label, t: 34 }),
            h("span", h("b", f.label), h("small", (p.civil ? "le " + (f.jour || 1) : dateJour(f.echeance)) + ", " + (f.cat || "Autre").toLowerCase())),
            h("b.montant.mt", euros(f.montant, f.montant % 1 ? 2 : 0))))) : h(Vide, null, "Loyer, salle, abonnements : ajoute-les une fois, puis coche-les chaque mois."),
          lien?.session && cour && h("p.note", "Avec ta banque reliée, pas besoin de cocher : chaque prélèvement reconnu se coche tout seul."),
          coutAbos.mois > 0 && h("p.note", "Tes abonnements : " + eurosD(coutAbos.mois, 2) + " par mois, soit ", h("b.mt", euros(coutAbos.an) + " par an"), ".")),
        abos.length > 0 && h(Section, { titre: "Abonnements repérés" },
          h("p.note", "Ces dépenses reviennent chaque mois au même montant. Ajoute-les à tes charges fixes : elles seront prévues d'avance."),
          abos.map(a => h("div.abo", { key: a.cle },
            h("span", h("b", a.label), h("small.mt", euros(a.montant, a.montant % 1 ? 2 : 0) + " par mois, " + euros(a.montant * 12) + " par an")),
            h("button.mini", { onClick: async () => { await ajouterAuxFixes(a); toast(a.label + " ajouté aux charges fixes"); } }, "Ajouter"),
            h("button.mini", { onClick: () => ignorerAbonnement(a.cle) }, "Ignorer"))))),
      rub === "epargne" && h(BlocEpargne),
      rub === "operations" && h(Fragment, null,
        h("input.recherche", { value: q, onChange: e => setQ(e.target.value), placeholder: "Chercher : Carrefour, loyer…", "aria-label": "Chercher une opération", enterKeyHint: "search" }),
        h(Puces, { defile: true }, filtres.map(([k, l]) => h(Puce, { key: k, actif: filtre === k, onClick: () => setFiltre(k) }, l))),
        // Une catégorie choisie : son total et son plafond, en tête
        estCat && h("div.entete-cat",
          h("div", h("b", filtre), h("span.mt", euros(Math.round(b.parCat[filtre] || 0)) + (b.caps[filtre] ? " sur " + euros(b.caps[filtre]) : "") + (hab[filtre] ? " · d'habitude " + euros(Math.round(hab[filtre])) : ""))),
          h("button.mini", { onClick: () => plafond(filtre) }, b.caps[filtre] ? "Changer le plafond" : "Fixer un plafond")),
        filtre === "classer" && h("p.note", "Touche une opération pour choisir sa catégorie : l'app retiendra ce commerce."),
        opsVues.length ? jours.map(([d, l]) => h(Section, { key: d, titre: libelleJour(d), droite: h("span.compte.mt", (() => { const t = l.reduce((a, o) => a + (o._t === "rev" ? o.montant : -o.montant), 0); return (t > 0 ? "+" : t < 0 ? "−" : "") + euros(Math.abs(t), Math.abs(t) % 1 ? 2 : 0); })()) },
          l.map(o => h(LigneOp, { key: o._t + o.id, o, sansDate: true }))))
          : h(Vide, null, q ? "Rien pour « " + q.trim() + " »." : "Aucune opération ici."),
        cour && h(VerifComptes)),
      rub === "tendances" && h(Fragment, null,
        h(Section, { titre: p.civil ? "Dépenses des six derniers mois" : "Dépenses des six dernières payes" },
          h("div.mt", h(Barres, { pts: parMois, ton: "argent", unite: " €" })),
          h("div.tuiles",
            h(Tuile, { v: b.taux != null ? h(Mt, null, b.taux + " %") : "—", l: p.civil ? "non dépensé ce mois" : "non dépensé sur cette paye" }),
            h(Tuile, { v: b.evolution != null ? signe(b.evolution, 0) + " %" : "—", l: p.civil ? "face à " + nomMois(moisPrec(moisDe(p.debut))) : "de dépenses face à la paye d'avant" }))),
        Object.keys(hab).length > 0 && h(Section, { titre: "Tes habitudes par paye" },
          h("p.note", "Ce que tu dépenses en moyenne dans chaque catégorie, sur tes 3 dernières payes."),
          h("div.liste", Object.entries(hab).sort((x, y) => y[1] - x[1]).map(([c, v]) => h("div.ligne", { key: c }, h("span", c), h("b.mt", euros(Math.round(v))))))))));
}
const RUBRIQUES_ARGENT = [["budget", "Budget"], ["epargne", "Épargne"], ["operations", "Opérations"], ["tendances", "Tendances"]];
/* Vérifier mes comptes : ce que l'app a compris, en texte à copier ; fusion des doublons s'il y en a */
function VerifComptes() {
  const [txt, setTxt] = useState(null), n = doublonsBanque().length;
  const copier = async () => { try { await navigator.clipboard.writeText(txt); toast("Copié : colle-le dans ton message à Claude"); } catch (e) { toast("Sélectionne le texte et copie-le", { danger: true }); } };
  return h(Section, { titre: "Vérifier mes comptes" },
    h("p.note", "Si un chiffre te semble faux, lance la vérification et envoie-moi le texte : il montre ce que l'app a compris (dates, montants, d'où vient chaque revenu)."),
    n > 0 && h(Bouton, { cl: "plein", onClick: async () => { if (await confirmer({ titre: "Fusionner " + pluriel(n, "doublon") + " ?", message: "Des opérations de ta banque apparaissent deux fois (même jour, même montant, même commerce). On n'en garde qu'une.", oui: "Fusionner" })) { const k = await fusionnerDoublons(); toast(pluriel(k, "doublon") + " retiré" + (k > 1 ? "s" : "")); setTxt(null); } } }, "Fusionner " + pluriel(n, "doublon")),
    !txt ? h(Bouton, { cl: "contour", onClick: () => setTxt(diagnosticArgent()) }, "Lancer la vérification")
      : h(Fragment, null, h("pre.diag.mt", txt), h(Bouton, { cl: "plein", onClick: copier }, "Copier")));
}
const libelleJour = d => { const e = ecart(d, aujourdhui()); return e === 0 ? "Aujourd'hui" : e === 1 ? "Hier" : dateLongue(d).replace(/^./, c => c.toUpperCase()); };
const LigneOp = ({ o, sansDate }) => h("button.ligne", { onClick: () => Nav.sheet("operation", { edite: o }) },
  h("span", h("b", o._t === "rev" ? o.source : o.label || o.cat), h("small", [sansDate ? null : dateMini(o.dateISO), o._t === "rev" ? (o.paye ? "paye" : "revenu") : o.banque && o.cat === "Autre" ? "à classer" : o.cat.toLowerCase(), o.attente ? "en cours" : null].filter(Boolean).join(", "))),
  h("b", { className: (o._t === "rev" ? "plus " : "") + "mt" }, (o._t === "rev" ? "+" : "−") + euros(o.montant, o.montant % 1 ? 2 : 0)));

/* ÉPARGNE — mise en route en trois choix, puis suivi */
const SOURCES_VERSEMENT = { paye: "à la paye", reste: "reste de la paye d'avant", main: "en plus", retrait: "repris sur ton compte" };
function FeuilleEpargne() {
  useDB();
  return h(Feuille, { titre: etatEpargne().cagnottes.length ? "Ton épargne" : "Mettre de côté", ton: "argent" },
    Discret.actif() && h("div.oeil-l", h("span", Discret.cache() ? "Montants cachés" : "Montants affichés"), h(Oeil)),
    h(BlocEpargne));
}
// Le contenu de l'épargne : dans la rubrique « Épargne » de l'onglet Argent, et dans la fiche ouverte depuis le coach
function BlocEpargne() {
  useDB();
  useDiscret();
  const e = etatEpargne(), montant = montantParPaye(), pp = pointPaye();
  const [m, setM] = useState(montant || montantPropose()), [cible, setCible] = useState(cibleSecurite()), [projet, setProjet] = useState(""), [cibleP, setCibleP] = useState(null);
  if (!e.cagnottes.length) {
    const lancer = async () => {
      await DB.set("fin-goal", m);
      await DB.set("epargne", { ...EPARGNE_VIDE, cagnottes: [{ id: "securite", nom: "Épargne de sécurité", cible }, ...(projet.trim() && cibleP ? [{ id: nouvelId("c"), nom: projet.trim(), cible: cibleP }] : [])] });
      toast("C'est parti : " + euros(m) + " à chaque paye");
    };
    return h(Fragment, null,
      h("p.texte-p", "Le principe : à chaque paye, une petite somme part d'abord sur ton livret, toute seule. Ce qui reste, tu le dépenses sans te poser de questions."),
      h(Section, { titre: "1. À chaque paye" },
        h(Champ, { etiquette: "Je mets de côté", valeur: m, mode: "ent", unite: "€", pas: [10, 50], min: 10, onChange: setM }),
        h("p.note", "Je te propose " + euros(montantPropose()) + ", environ 5 % de ta paye. On commence petit : dans 3 mois, je te proposerai d'augmenter un peu.")),
      h(Section, { titre: "2. Ton épargne de sécurité" },
        h(Champ, { etiquette: "Objectif", valeur: cible, mode: "ent", unite: "€", pas: [50, 100], min: 100, onChange: setCible }),
        h("p.note", "Environ un mois de dépenses : de quoi encaisser un imprévu (une panne, une facture) sans tout remettre en cause.")),
      h(Section, { titre: "3. Un projet, si tu veux" },
        h("input.recherche", { value: projet, onChange: x => setProjet(x.target.value), placeholder: "Vacances, ordinateur… (facultatif)", "aria-label": "Nom du projet" }),
        projet.trim() && h(Champ, { etiquette: "Montant visé", valeur: cibleP, mode: "ent", unite: "€", pas: [50, 100], min: 50, onChange: setCibleP }),
        h("p.note", "Il se remplit une fois l'épargne de sécurité atteinte.")),
      h(Bouton, { cl: "plein grand", onClick: lancer }, "C'est parti"));
  }
  const cs = cagnottes(), versements = [...e.versements].sort((a, c) => c.dateISO.localeCompare(a.dateISO) || c.id - a.id);
  const enPlus = async () => { const v = await saisir({ titre: "Mis de côté en plus", mode: "dec", unite: "€", pas: [10, 50], min: 0 }); if (v > 0) { await ajouterVersement(v, "main"); toast(euros(v) + " de plus dans ta cagnotte"); } };
  const ajouterProjet = async () => {
    if (!projet.trim()) return toast("Donne un nom à ton projet");
    const v = await saisir({ titre: projet.trim() + " : montant visé", mode: "ent", unite: "€", pas: [50, 100], min: 50 });
    if (v > 0) { await majEpargne(x => ({ ...x, cagnottes: [...x.cagnottes, { id: nouvelId("c"), nom: projet.trim(), cible: v }] })); setProjet(""); }
  };
  return h(Fragment, null,
    pp?.aVerser && h(Bouton, { cl: "plein", onClick: async () => { await ajouterVersement(pp.montant, "paye"); toast(euros(pp.montant) + " de plus dans ta cagnotte"); } }, "Mes " + eurosD(pp.montant) + " de cette paye sont partis"),
    h("div.tuiles", h(Tuile, { v: h(Mt, null, euros(totalEpargne())), l: "mis de côté" }), h(Tuile, { v: h(Mt, null, euros(montant)), l: "à chaque paye" })),
    h(Section, { titre: "Tes cagnottes" },
      cs.map((c, i) => { const d = dateCagnotte(c); return h("div.cagnotte", { key: c.id },
        h("div", h("b", c.nom), h("span.mt", euros(c.verse) + " sur " + euros(c.cible))),
        h(Jauge, { v: c.verse, max: c.cible || 1, ton: "argent" }),
        h("small", c.pleine ? "Objectif atteint." : d ? "Atteint vers " + nomMois(moisDe(d)) + (i > 0 && !cs[i - 1].pleine ? ", après la précédente" : "") + "." : "Choisis un montant par paye pour estimer la date."),
        h("div.actions-l.mt-champ",
          h(Champ, { etiquette: "Objectif", valeur: c.cible, mode: "ent", unite: "€", pas: [50, 100], min: 50, onChange: v => majEpargne(x => ({ ...x, cagnottes: x.cagnottes.map(y => y.id === c.id ? { ...y, cible: v } : y) })) }),
          c.id !== "securite" && h("button.mini", { onClick: () => avecAnnuler("epargne", { ...e, cagnottes: e.cagnottes.filter(y => y.id !== c.id) }, "Projet retiré") }, "Retirer"))); }),
      h("div.ajout-l", h("input.recherche", { value: projet, onChange: x => setProjet(x.target.value), placeholder: "Nouveau projet : vacances…", "aria-label": "Nom du projet" }), h("button.mini", { onClick: ajouterProjet }, "Ajouter"))),
    h(Section, { titre: "Le virement automatique" },
      e.virement ? h("p.texte-p", h("b", "En place. "), eurosD(montant) + " partent de ton compte vers ton livret le lendemain de ta paye. Si tu changes le montant ici, change-le aussi dans ta banque.")
        : h(Fragment, null,
          h("ol.etapes",
            h("li", "Dans l'appli de ta banque, ouvre un ", h("b", "Livret A"), " (rubrique épargne) si tu n'en as pas."),
            h("li", "Dans les virements, crée un ", h("b", "virement permanent"), " : de ton compte courant vers ton Livret A, ", h("b", eurosD(montant)), ", chaque mois, le ", h("b", String(jourVirement())), " (le lendemain de ta paye)."),
            h("li", "Reviens ici et touche « C'est en place ».")),
          h("p.note", "Les noms des menus peuvent changer selon la version de l'appli."),
          h(Bouton, { cl: "plein", onClick: () => majEpargne(x => ({ ...x, virement: true })) }, "C'est en place"))),
    h(Section, { titre: "Réglage" },
      h("div.mt-champ", h(Champ, { etiquette: "À chaque paye", valeur: montant || null, mode: "ent", unite: "€", pas: [10, 50], min: 0, onChange: v => DB.set("fin-goal", v) })),
      h("p.note", "Cette somme est déjà retirée de ce que tu peux dépenser.")),
    h(Section, { titre: "Versements", droite: h(Lien, { onClick: enPlus }, "J'ai mis de côté en plus") },
      versements.length ? versements.slice(0, 30).map(v => h("div.histo", { key: v.id }, h("span", dateMini(v.dateISO) + ", " + (SOURCES_VERSEMENT[v.source] || "")), h("b.mt", euros(v.montant, v.montant % 1 ? 2 : 0)),
        h("button.mini-x", { "aria-label": "Supprimer", onClick: () => avecAnnuler("epargne", { ...e, versements: e.versements.filter(x => x.id !== v.id) }, "Versement supprimé") }, h(Icone, { n: "fermer", t: 16 }))))
        : h(Vide, null, "À ta prochaine paye, je te demanderai si ton épargne est bien partie.")));
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
    // Une opération venue de la banque garde sa référence (sinon elle reviendrait au prochain import)
    const garde = edite?.banque ? { banque: edite.banque, ...(edite.brut ? { brut: edite.brut } : {}), ...(edite.attente ? { attente: true } : {}) } : {};
    if (rev) { await DB.set("fin-income", [...i2, { ...garde, id, dateISO: iso, montant: m, source: lib.trim() || (paye ? "Paye" : "Revenu"), paye }]); if (edite) await DB.set("fin-expenses", d2); }
    else { await DB.set("fin-expenses", [...d2, { ...garde, ...(edite?.fixId ? { fixId: edite.fixId } : {}), id, dateISO: iso, montant: m, cat, label: lib.trim() }]); if (edite) await DB.set("fin-income", i2); }
    Nav.fermer();
    toast((rev ? "+" : "−") + nb(m, 2) + " € enregistrés");
    // Catégorie changée sur une opération de la banque : on propose de s'en souvenir
    if (edite?.banque && !rev && cat !== edite.cat && lib.trim() && await confirmer({ titre: "Toujours classer « " + lib.trim() + " » dans " + cat + " ?", message: "Les prochaines opérations de ce commerce seront classées toutes seules, et celles encore « à classer » aussi.", oui: "Oui, toujours" }))
      await apprendreRegle(lib.trim(), cat);
  };
  const suppr = async () => {
    const cle = edite._t === "rev" ? "fin-income" : "fin-expenses";
    Nav.fermer();
    if (edite.banque) await ignorerOperation(edite.banque);
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
