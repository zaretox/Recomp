"use strict";
/* SPORT — « Qu'est-ce que je soulève ? »
 * La séance du jour en affiche, la semaine, les progrès. Programmes et natation s'ouvrent par-dessus. */
const seanceAuj = iso => {
  const lS = DB.get("sport-logs").find(l => l.dateISO === iso), lM = DB.get("maison-logs").find(l => l.dateISO === iso);
  if (lS) return { prog: "salle", code: lS.seance, label: lS.seance, log: lS };
  if (lM) return { prog: "maison", code: lM.seance, label: "Maison " + lM.seance, log: lM };
  return seanceDuJour(iso, programmeEnCours());
};

function HeroSport() {
  const auj = aujourdhui(), s = seanceAuj(auj), prog = programmeEnCours(), nage = nagePrevue(auj), nages = DB.get("natation-logs").filter(l => l.dateISO === auj);
  const fini = s?.log?.endedAt;
  if (!s) {
    let suiv = null;
    for (let d = 1; d < 8 && !suiv; d++) { const x = seanceDuJour(decale(auj, d), prog); if (x) suiv = { x, d }; }
    return h("header.hero", { "data-ton": "sport" },
      h("span.affiche-e", "Aujourd'hui"),
      h(Geant, null, nage || nages.length ? "Nage" : "Repos"),
      h("p", nage ? nage.name + ", " + entier(nageDistance(nage)) + " m." : "Pas de séance prévue." + (suiv ? " Prochaine : " + suiv.x.label + (suiv.d === 1 ? " demain." : " dans " + suiv.d + " jours.") : "")),
      h("div.hero-b",
        (nage || nages.length) ? h(Bouton, { cl: "noir", onClick: () => Nav.sheet("natation") }, "Voir la nage") : null,
        h(Bouton, { cl: "contour-n", onClick: () => Nav.sheet("choisir") }, "Faire une séance")));
  }
  const se = s.prog !== "maison" ? seanceParId(s.code) : null;
  const total = se ? se.exercices.reduce((a, e) => a + (fourchette(e.detail)?.sets || 3), 0) : 0;
  const faites = s.log && s.prog !== "maison" ? (s.log.exercices || []).reduce((a, e) => a + seriesDe(e), 0) : 0;
  return h("header.hero", { "data-ton": "sport" },
    h("span.affiche-e", fini ? "Séance faite" : faites ? "En cours" : "Séance à " + hhmm(seanceCreneau())),
    h(Geant, null, s.label),
    h("p", fini ? entier(volumeSeance(s.log)) + " kg soulevés en " + faites + " séries." : se ? se.focus + ". " + (faites ? faites + " séries sur " + total + "." : pluriel(se.exercices.length, "exercice") + ", " + total + " séries.") : s.titre),
    h("div.hero-b",
      h(Bouton, { cl: "noir", ico: fini ? null : "fleche", onClick: () => ouvrirSeance(auj, s) }, fini ? "Revoir" : faites ? "Reprendre" : "Démarrer"),
      h(Bouton, { cl: "contour-n", onClick: () => Nav.sheet("choisir") }, "Changer")));
}

function SemaineSport() {
  const auj = aujourdhui(), lundi = lundiDe(auj), prog = programmeEnCours();
  return h("div.sem-sport", ORDRE_JOURS.map((_, i) => {
    const d = decale(lundi, i), p = seanceDuJour(d, prog), n = nagePrevue(d);
    const l = DB.get("sport-logs").find(x => x.dateISO === d), m = DB.get("maison-logs").find(x => x.dateISO === d), sw = DB.get("natation-logs").find(x => x.dateISO === d);
    const po = sortiesPolar().find(x => x.dateISO === d);
    const label = l?.seance || (m ? "Maison " + m.seance : null) || p?.code || (n || sw ? "Nage" : po ? COURT_SORTIE[familleSortie(po)] : "—"), fait = !!(l || m || sw || po);
    return h("button", { key: d, className: (fait ? "fait " : "") + (d === auj ? "auj" : ""), onClick: () => l ? Nav.sheet("seanceDetail", { id: l.id }) : p ? ouvrirSeance(d, p) : n || sw ? Nav.sheet("natation") : po ? Nav.sheet("sortie", { id: po.id }) : null },
      h("small", JOURS[jourSem(d)]), h("b", label.replace("Maison ", "")));
  }));
}

/* Volume par muscle : séries de la semaine face à la zone utile */
function VolumeMuscles() {
  const v = volumeMuscles(7), lignes = MUSCLES.filter(m => v[m]);
  if (!lignes.length) return h(Vide, null, "Aucune série sur les 7 derniers jours.");
  return h("div.muscles", lignes.map(m => {
    const r = REPERES_MUSCLE[m], s = v[m], ech = Math.max(r.mav * 1.2, s), ton = s < r.mev ? "jaune" : s <= r.mav ? "vert" : "rouge";
    return h("div", { key: m },
      h("span", m), h("b", s),
      h("div.zone", { "data-ton": ton },
        h("u", { style: { left: r.mev / ech * 100 + "%", width: (r.mav - r.mev) / ech * 100 + "%" } }),
        h("i", { style: { width: Math.min(100, s / ech * 100) + "%" } })));
  }));
}

function ListeExos() {
  const logs = DB.get("sport-logs"), noms = [...new Set(seancesActives().flatMap(s => s.exercices.map(e => e.nom)))];
  const l = noms.map(n => { const r = maxActuel(logs, n); return r ? { nom: n, ...r } : null; }).filter(Boolean).sort((a, b) => b.rm - a.rm);
  if (!l.length) return h(Vide, null, "Tes max estimés apparaîtront après tes premières séances.");
  return h("div.liste", l.slice(0, 5).map(x => h("button.ligne", { key: x.nom, onClick: () => Nav.sheet("exercice", { nom: x.nom }) },
    h("span", x.nom), x.trend && h("i.tendance", { "data-t": x.trend }, x.trend === "up" ? "↗" : x.trend === "down" ? "↘" : "→"), h("b", x.rm + " kg"))));
}

function EcranSport() {
  useDB();
  const cfg = reglages(), logs = DB.get("sport-logs"), auj = aujourdhui();
  const vol = n => Math.round(logs.filter(l => { const e = ecart(l.dateISO, auj); return e >= n * 7 && e < (n + 1) * 7; }).reduce((a, l) => a + volumeSeance(l), 0));
  const v0 = vol(0), v1 = vol(1), rec = recordsDe(logs.filter(l => dansLes(l.dateISO, 30)));
  const barres = Array.from({ length: 8 }, (_, i) => { const n = 7 - i; return { l: n === 0 ? "Cette" : "S−" + n, v: Math.round(vol(n) / 1000 * 10) / 10 }; });
  const hist = [...logs.map(l => ({ ...l, _t: "s" })), ...DB.get("maison-logs").map(l => ({ ...l, _t: "m" })), ...DB.get("natation-logs").map(l => ({ ...l, _t: "n" })), ...sortiesPolar().filter(s => !logDeSortie(s)).map(l => ({ ...l, _t: "p" }))].sort((a, b) => b.dateISO.localeCompare(a.dateISO) || (b.id - a.id) || 0);
  return h("div.page", { "data-t": "sport" },
    h(HeroSport),
    h("div.corps-p",
      h(Section, { titre: "Ta semaine" }, h(SemaineSport)),
      h(SectionSorties),
      h(Section, { titre: "Organisation" },
        h(Rangee, { ico: "nage", titre: "Natation", sous: "Séances types, records", onClick: () => Nav.sheet("natation") }),
        h(Rangee, { ico: "bulle", titre: "Bibliothèque", sous: EXO_LIB.length + " exercices expliqués, " + TECHNIQUES.length + " techniques", onClick: () => Nav.sheet("bibliotheque") }),
        h(Rangee, { ico: "liste", titre: "Mes programmes", sous: infoProgramme(programmeEnCours()).label + " en cours", onClick: () => Nav.sheet("programmes") }),
        h(Rangee, { ico: "mal", titre: "Douleurs", sous: "Noter, suivre, remplacer", onClick: () => Nav.sheet("douleurs") })),
      h("div.tuiles",
        h(Tuile, { v: nb(v0 / 1000) + " t", l: "soulevées en 7 j" + (v1 ? " (" + signe((v0 - v1) / v1 * 100, 0) + " %)" : "") }),
        h(Tuile, { v: rec.length, l: "records en 30 j" })),
      h(Section, { titre: "Tonnage par semaine" }, h(Barres, { pts: barres, ton: "sport", unite: " t" })),
      h(Section, { titre: "Séries par muscle, 7 jours" }, h(VolumeMuscles), h("p.note", "La bande claire est ta zone utile. Dessous, le muscle ne progresse pas assez ; au-dessus, tu récupères moins bien.")),
      h(Section, { titre: "Tes max estimés" }, h(ListeExos)),
      h(Section, { titre: "Réglages de la semaine" },
        h("div.interrupteurs",
          h(Interrupteur, { actif: cfg.deload, titre: "Semaine légère", sous: "Charges −40 %, même nombre de séries", onClick: () => DB.set("science-config", { ...cfg, deload: !cfg.deload }) }),
          h(Interrupteur, { actif: cfg.recovery, titre: "Mode récup", sous: "Aucune hausse de charge. Automatique si ta forme passe sous 50", onClick: () => DB.set("science-config", { ...cfg, recovery: !cfg.recovery }) }))),
      h(Section, { titre: "Historique" }, hist.length ? hist.slice(0, 12).map(l => h("button.ligne", { key: l._t + l.id, onClick: () => l._t === "s" ? Nav.sheet("seanceDetail", { id: l.id }) : l._t === "n" ? Nav.sheet("natation") : l._t === "p" ? Nav.sheet("sortie", { id: l.id }) : ouvrirSeance(l.dateISO, { prog: "maison", code: l.seance }) },
        h("span", h("b", l._t === "s" ? l.seance : l._t === "m" ? "Maison " + l.seance : l._t === "p" ? nomSortie(l) : "Natation"), h("small", dateMini(l.dateISO))),
        h("b", l._t === "s" ? nb(volumeSeance(l) / 1000) + " t" + fcDe(sortieDeMuscu(l)) : l._t === "n" ? entier(l.distance) + " m" + fcDe(sortieDeNage(l)) : l._t === "p" ? (l.distance > 0 ? distanceSortie(l) : chrono(l.duree)) : "")
      )) : h(Vide, null, "Aucune séance pour l'instant."))));
}
const fcDe = s => s?.fcMoy ? " · " + s.fcMoy + " bpm" : "";
const Interrupteur = ({ actif, titre, sous, onClick }) => h("button.inter", { className: actif ? "actif" : "", role: "switch", "aria-checked": !!actif, onClick: () => { vibre(); onClick(); } },
  h("span", h("b", titre), sous && h("small", sous)), h("i"));

function FeuilleChoisir({ iso }) {
  useDB();
  const jour = iso || aujourdhui(), lance = s => { Nav.fermer(); ouvrirSeance(jour, s); };
  return h(Feuille, { titre: "Quelle séance ?", ton: "sport" },
    jour !== aujourdhui() && h("p.sous-t", "Pour le " + dateLongue(jour).toLowerCase()),
    h("div.choix", seancesActives().map(s => h("button", { key: s.id, onClick: () => lance({ prog: "salle", code: s.id }) }, h("b", s.id), h("small", s.focus)))),
    h(Section, { titre: "À la maison" }, h("div.choix", MAISON.map(s => h("button", { key: s.code, onClick: () => lance({ prog: "maison", code: s.code }) }, h("b", "Maison " + s.code), h("small", s.titre))))),
    h(Bouton, { cl: "contour", ico: "nage", onClick: () => { Nav.fermer(); Nav.sheet("natation", { iso: jour }); } }, "Natation"));
}

function FeuilleSeanceDetail({ id }) {
  useDB();
  const log = DB.get("sport-logs").find(l => l.id === id);
  if (!log) return h(Feuille, { titre: "Séance" }, h(Vide, null, "Séance supprimée."));
  const suppr = async () => { Nav.fermer(); await avecAnnuler("sport-logs", DB.get("sport-logs").filter(l => l.id !== id), "Séance supprimée"); };
  const montre = sortieDeMuscu(log);
  return h(Feuille, { titre: log.seance, ton: "sport" },
    h("p.sous-t", dateLongue(log.dateISO) + (log.deload ? ", semaine légère" : "")),
    h("div.tuiles", h(Tuile, { v: nb(volumeSeance(log) / 1000) + " t", l: "soulevées" }), h(Tuile, { v: (log.exercices || []).reduce((a, e) => a + seriesDe(e), 0), l: "séries" })),
    h("div.liste", (log.exercices || []).filter(e => e.weight > 0).map(e => h("button.ligne", { key: e.nom, onClick: () => Nav.sheet("exercice", { nom: e.nom }) }, h("span", e.nom), h("b", fmtSeries(e))))),
    montre && h(Section, { titre: "Ta montre" }, h("p.note", "Enregistrée à " + (montre.debut || "").slice(11, 16) + " sur ta Polar."), h(BlocMontre, { s: montre })),
    h("div.deux-b",
      h(Bouton, { cl: "contour", onClick: () => { Nav.fermer(); ouvrirSeance(log.dateISO, { prog: "salle", code: log.seance }); } }, "Modifier"),
      h(Bouton, { cl: "contour danger-t", onClick: suppr }, "Supprimer")));
}

/* NATATION */
function FeuilleNatation({ iso }) {
  useDB();
  // Le jour où la nage est notée : aujourd'hui, ou le jour choisi sur l'écran Jour
  const modeles = DB.get("natation-modeles"), logs = DB.get("natation-logs"), auj = aujourdhui(), jour = iso || auj, [voir, setVoir] = useState(null);
  const lundi = lundiDe(auj), sem = logs.filter(l => l.dateISO >= lundi).reduce((a, l) => a + l.distance, 0);
  const meilleur = min => { const c = logs.filter(l => l.distance >= min && l.duree); return c.length ? c.reduce((a, l) => allure(l.distance, l.duree) < allure(a.distance, a.duree) ? l : a) : null; };
  const noter = async m => {
    const r = await saisir([
      { titre: "Distance nagée", court: "Distance", valeur: m ? nageDistance(m) : 1000, mode: "ent", unite: "m", pas: [50, 100], min: 0 },
      { titre: "Durée totale", court: "Durée", valeur: m ? Math.round(nageDuree(m)) : 1800, mode: "ms", unite: "min:s", pas: [30, 60], min: 0, indice: "Tape 3, 8, 3, 0 pour 38:30" },
      { titre: "Difficulté ressentie", court: "Effort", valeur: 6, mode: "ent", unite: "/10", pas: [1], min: 1, max: 10 },
    ]);
    if (!r || !r[0] || !r[1]) return;
    const kg = moyenneRecente(pesees(), 7) || 100;
    await DB.set("natation-logs", [...logs, { id: Date.now(), dateISO: jour, date: dateCourte(jour), modele: m ? m.name : "Séance libre", distance: r[0], duree: r[1], rpe: r[2] || 6, nage: "Crawl", pool: m?.pool || 25, note: "", kcal: nageKcal(r[0], r[1], r[2] || 6, kg) }]);
    toast("Séance de " + entier(r[0]) + " m enregistrée" + (jour === auj ? ", ta cible du jour suit" : " le " + dateMini(jour)));
  };
  const faire = m => setVoir(m);
  const aAjouter = sortiesPolar().filter(s => familleSortie(s) === "nage" && !logDeSortie(s));
  return h(Feuille, { titre: "Natation", ton: "sport" },
    jour !== auj && h("p.sous-t", "Pour le " + dateLongue(jour).toLowerCase()),
    h("div.tuiles", h(Tuile, { v: entier(sem), l: "mètres cette semaine" }), h(Tuile, { v: logs.length, l: "séances en tout" })),
    voir ? h(Fragment, null,
      h("h2.t2", voir.name),
      h("p.sous-t", entier(nageDistance(voir)) + " m, environ " + Math.round(nageDuree(voir) / 60) + " min, bassin " + voir.pool + " m"),
      h("div.liste", voir.blocks.map((b, i) => h("div.bloc", { key: i }, h("b", b.t), h("span", ligneBloc(b)), h("em", entier(b.reps * b.d) + " m")))),
      h("div.deux-b", h(Bouton, { cl: "contour", onClick: () => setVoir(null) }, "Retour"), h(Bouton, { cl: "contour", onClick: () => { setVoir(null); Nav.sheet("nageModele", { id: voir.id }); } }, "Modifier")),
      h(Bouton, { cl: "plein", onClick: () => noter(voir) }, "Je l'ai nagée"))
    : h(Fragment, null,
      h(Section, { titre: "Séances types" },
        modeles.length ? modeles.map(m => h(Rangee, { key: m.id, titre: m.name, sous: entier(nageDistance(m)) + " m" + (m.days?.length ? ", " + m.days.map(d => JOURS[d]).join(" ") : ""), onClick: () => faire(m) })) : h(Vide, null, "Aucune séance type."),
        h("div.deux-b", h(Bouton, { cl: "plein", onClick: () => noter(null) }, "Noter une séance"), h(Bouton, { cl: "contour", onClick: () => Nav.sheet("nageModele", { neuf: nageExemple() }) }, "Nouvelle séance type"))),
      (logs.length > 0 || nagesToutes().length > 0) && h(Rangee, { ico: "chrono", titre: "Records et progrès", sous: "Meilleurs temps, mètres par semaine, allure", onClick: () => Nav.sheet("nageProgres") }),
      logs.length > 0 && h(Section, { titre: "Records" }, h("div.tuiles",
        h(Tuile, { v: entier(Math.max(...logs.map(l => l.distance))) + " m", l: "plus longue" }),
        [[400, "≥ 400 m"], [1000, "≥ 1 000 m"]].map(([mn, l]) => { const b = meilleur(mn); return h(Tuile, { key: mn, v: b ? mmss(Math.round(allure(b.distance, b.duree))) : "—", l: "allure " + l }); }))),
      aAjouter.length > 0 && h(Section, { titre: "Nages de ta montre" }, h("div.liste", aAjouter.slice(0, 5).map(s => h(LigneSortie, { key: s.id, s }))), h("p.note", "Touche une nage pour voir son détail et l'ajouter à ta natation.")),
      logs.length > 0 && h(Section, { titre: "Dernières séances" }, [...logs].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, 8).map(l => h("div.histo", { key: l.id }, h("button.histo-b", { onClick: () => Nav.sheet("nage", { id: l.id }), "aria-label": "Corriger cette nage" }, h("span", dateMini(l.dateISO)), h("b", entier(l.distance) + " m en " + dureeS(l.duree))), sortieDeNage(l) && h("button.mini-x", { "aria-label": "Données de la montre", onClick: () => Nav.sheet("sortie", { id: sortieDeNage(l).id }) }, h(Icone, { n: "coeur", t: 16 })), h("button.mini-x", { "aria-label": "Supprimer", onClick: () => avecAnnuler("natation-logs", DB.get("natation-logs").filter(x => x.id !== l.id), "Séance supprimée") }, h(Icone, { n: "fermer", t: 16 })))))));
}

/* CORRIGER UNE NAGE — distance, durée, effort, date ; les calories suivent */
function FeuilleNage({ id }) {
  useDB();
  const l0 = DB.get("natation-logs").find(x => x.id === id);
  const [l, setL] = useState(l0 ? { ...l0 } : null);
  if (!l) return h(Feuille, { titre: "Nage" }, h(Vide, null, "Nage supprimée."));
  const maj = o => setL(x => ({ ...x, ...o }));
  const enregistrer = async () => {
    const kg = moyenneRecente(pesees(), 7) || 100;
    const n = { ...l, date: dateCourte(l.dateISO), kcal: nageKcal(l.distance, l.duree, l.rpe || 6, kg) };
    await DB.set("natation-logs", DB.get("natation-logs").map(x => x.id === id ? n : x));
    Nav.fermer();
    toast("Nage corrigée");
  };
  const suppr = () => { Nav.fermer(); avecAnnuler("natation-logs", DB.get("natation-logs").filter(x => x.id !== id), "Nage supprimée"); };
  return h(Feuille, { titre: "Corriger la nage", ton: "sport" },
    h("div.date-op",
      h("button.mini", { onClick: () => maj({ dateISO: decale(l.dateISO, -1) }) }, "Veille"),
      h("span", l.dateISO === aujourdhui() ? "Aujourd'hui" : dateLongue(l.dateISO)),
      l.dateISO < aujourdhui() && h("button.mini", { onClick: () => maj({ dateISO: decale(l.dateISO, 1) }) }, "Lendemain")),
    h("div.deux",
      h(Champ, { etiquette: "Distance", valeur: l.distance, mode: "ent", unite: "m", pas: [50, 100], min: 0, onChange: v => maj({ distance: v }) }),
      h(Champ, { etiquette: "Durée", valeur: l.duree, texte: dureeS(l.duree), mode: "ms", unite: "min:s", pas: [30, 60], min: 0, onChange: v => maj({ duree: v }) })),
    h(Champ, { etiquette: "Difficulté ressentie", valeur: l.rpe || 6, mode: "ent", unite: "/10", pas: [1], min: 1, max: 10, onChange: v => maj({ rpe: v }) }),
    l.distance > 0 && l.duree > 0 && h("p.note", "Allure : " + mmss(Math.round(allure(l.distance, l.duree))) + " aux 100 m. Les calories de la nage sont recalculées."),
    h(Bouton, { cl: "plein grand", onClick: enregistrer }, "Enregistrer"),
    h(Bouton, { cl: "contour danger-t", onClick: suppr }, "Supprimer"));
}

/* PROGRÈS EN NATATION : meilleurs temps, volume, allure au fil des semaines */
function FeuilleNageProgres() {
  useDB();
  const n = nagesToutes(), auj = aujourdhui(), lundi = lundiDe(auj), mois = auj.slice(0, 7), moisAvant = isoDe(new Date(+auj.slice(0, 4), +auj.slice(5, 7) - 2, 1)).slice(0, 7);
  const somme = l => l.reduce((a, x) => a + x.distance, 0);
  const semaines = Array.from({ length: 12 }, (_, i) => { const k = 11 - i, d = decale(lundi, -7 * k), f = decale(d, 7); return { l: k === 0 ? "Cette" : "S−" + k, v: somme(n.filter(x => x.dateISO >= d && x.dateISO < f)) }; });
  const pts = n.filter(x => x.distance >= 200 && x.duree > 0).slice(-24).map(x => ({ x: x.dateISO, y: Math.round(allure(x.distance, x.duree)) }));
  const t = tendanceNage(28, n), rec = recordsNage(n), longue = n.reduce((a, x) => x.distance > (a?.distance || 0) ? x : a, null);
  const ouvrir = r => r.sortie ? Nav.sheet("sortie", { id: r.sortie }) : null;
  return h(Feuille, { titre: "Progrès en natation", ton: "sport" },
    h("div.tuiles",
      h(Tuile, { v: entier(somme(n.filter(x => x.dateISO >= lundi))), l: "mètres cette semaine" }),
      h(Tuile, { v: entier(somme(n.filter(x => x.dateISO.startsWith(mois)))), l: "mètres ce mois-ci" }),
      h(Tuile, { v: entier(somme(n.filter(x => x.dateISO.startsWith(moisAvant)))), l: "le mois dernier" })),
    h(Section, { titre: "Mètres par semaine" }, h(Barres, { pts: semaines, ton: "sport", unite: " m" })),
    h(Section, { titre: "Allure aux 100 m" },
      pts.length >= 2 ? h(Courbe, { pts, ton: "sport", inverse: true, unite: "/100 m", format: v => mmss(Math.round(v)) }) : h(Vide, null, "Il faut au moins deux nages de 200 m ou plus pour tracer ta courbe."),
      t.allure && h("p.note", "Ces 4 dernières semaines : " + mmss(Math.round(t.allure)) + " aux 100 m en moyenne" + (t.ecart == null ? "." : t.ecart < 0 ? ", " + Math.abs(t.ecart) + "\u00a0s plus vite que les 4 semaines d'avant." : t.ecart > 0 ? ", " + t.ecart + "\u00a0s plus lent que les 4 semaines d'avant." : ", comme les 4 semaines d'avant."))),
    h(Section, { titre: "Meilleurs temps" },
      h("div.liste", rec.map(r => h(r.sortie ? "button.ligne" : "div.ligne", { key: r.d, onClick: () => ouvrir(r) },
        h("span", h("b", entier(r.d) + " m"), h("small", r.s ? dateMini(r.dateISO) + (r.sortie ? " · montre" : "") : "pas encore")),
        h("b", r.s ? chrono(r.s) + "  ·  " + mmss(Math.round(r.s / r.d * 100)) + "/100 m" : "—")))),
      h("p.note", "Avec la montre, je prends ton meilleur passage sur chaque distance pendant une nage, repos compris. Une nage notée à la main compte si sa distance est exactement celle-là.")),
    longue && h(Section, { titre: "Plus longue nage" }, h(Rangee, { ico: "nage", titre: entier(longue.distance) + " m", sous: dateLongue(longue.dateISO) + (longue.duree ? ", en " + chrono(longue.duree) : ""), onClick: () => longue.sortie ? Nav.sheet("sortie", { id: longue.sortie.id }) : null })));
}

/* DOULEURS */
function FeuilleDouleur({ iso }) {
  const [zone, setZone] = useState(ZONES_DOULEUR[0]), [note, setNote] = useState(""), auj = iso || aujourdhui();
  const noter = async n => {
    await DB.set("douleur-logs", [...DB.get("douleur-logs"), { id: Date.now(), dateISO: auj, date: dateCourte(auj), zone, intensite: n, note: note.trim() }]);
    Nav.fermer();
    toast(n >= 4 ? "Noté : les exercices concernés sont signalés dans ta séance" : "Noté. Surveille cette zone");
  };
  return h(Feuille, { titre: "J'ai mal", ton: "sport" },
    auj !== aujourdhui() && h("p.sous-t", "Pour le " + dateLongue(auj).toLowerCase()),
    h(Section, { titre: "Où ?" }, h(Puces, null, ZONES_DOULEUR.map(z => h(Puce, { key: z, actif: zone === z, onClick: () => setZone(z) }, z)))),
    h("input.recherche", { value: note, onChange: e => setNote(e.target.value), placeholder: "Note facultative : pic en bas du squat…", "aria-label": "Note" }),
    h(Section, { titre: "À quel point ?" }, h("div.choix", [[2, "Gêne"], [4, "Douleur"], [6, "Forte"], [8, "Très forte"]].map(([n, l]) => h("button", { key: n, onClick: () => noter(n) }, h("b", l), h("small", n + "/10"))))));
}
function FeuilleDouleurs() {
  useDB();
  const logs = [...DB.get("douleur-logs")].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const zones = [...new Set(logs.map(l => l.zone))];
  return h(Feuille, { titre: "Douleurs", ton: "sport" },
    h(Bouton, { cl: "plein", onClick: () => Nav.sheet("douleur") }, "Noter une douleur"),
    zones.map(z => { const pts = logs.filter(l => l.zone === z).reverse().map(l => ({ x: l.dateISO, y: l.intensite })); return pts.length >= 2 && h(Section, { key: z, titre: z }, h(Courbe, { pts, unite: "/10", ton: "sport", haut: 110 })); }),
    h(Section, { titre: "Historique" }, logs.length ? logs.slice(0, 20).map(l => h("div.histo", { key: l.id }, h("span", dateMini(l.dateISO)), h("b", l.zone + " " + l.intensite + "/10"), h("button.mini-x", { "aria-label": "Supprimer", onClick: () => avecAnnuler("douleur-logs", DB.get("douleur-logs").filter(x => x.id !== l.id), "Entrée supprimée") }, h(Icone, { n: "fermer", t: 16 })))) : h(Vide, null, "Aucune douleur notée.")),
    h(Section, { titre: "Tes règles" }, REGLES.map(r => h("p.ligne-simple", { key: r }, r))));
}

/* Séance type de natation : préparée à l'avance, enregistrée en sortant de l'eau */
const nageExemple = () => ({ id: nouvelId("n"), name: "Nouvelle séance", pool: 25, pace: 150, days: [], blocks: [
  { t: "Échauffement", reps: 1, d: 200, nage: "Crawl", mat: "—", mode: "rest", dep: 0, rest: 0, note: "" },
  { t: "Série principale", reps: 8, d: 50, nage: "Crawl", mat: "—", mode: "rest", dep: 0, rest: 20, note: "" },
  { t: "Retour au calme", reps: 1, d: 200, nage: "Dos", mat: "—", mode: "rest", dep: 0, rest: 0, note: "" }] });
function FeuilleNageModele({ id, neuf }) {
  const [m, setM] = useState(() => copie(neuf || DB.get("natation-modeles").find(x => x.id === id)));
  const maj = fn => setM(x => { const n = copie(x); fn(n); return n; });
  const liste = DB.get("natation-modeles");
  const enregistrer = async () => { await DB.set("natation-modeles", liste.some(x => x.id === m.id) ? liste.map(x => x.id === m.id ? m : x) : [...liste, m]); Nav.fermer(); toast("Séance type enregistrée"); };
  const champ = (i, cle, etiquette, o) => h(Champ, { etiquette, valeur: m.blocks[i][cle], mode: o?.mode || "ent", unite: o?.unite, pas: o?.pas || [1], min: 0, onChange: v => maj(n => { n.blocks[i][cle] = v; }) });
  return h(Feuille, { titre: "Séance type", ton: "sport", plein: true },
    h("input.champ-t", { value: m.name, onChange: e => { const v = e.target.value; maj(n => { n.name = v; }); }, "aria-label": "Nom de la séance" }),
    h("p.sous-t", entier(nageDistance(m)) + " m, environ " + Math.round(nageDuree(m) / 60) + " min"),
    h("div.quatre",
      h(Champ, { etiquette: "Allure /100 m", valeur: m.pace, texte: mmss(m.pace || 150), mode: "ms", pas: [5], min: 30, onChange: v => maj(n => { n.pace = v; }) }),
      h(Champ, { etiquette: "Bassin", valeur: m.pool, mode: "ent", unite: "m", pas: [25], min: 25, max: 50, onChange: v => maj(n => { n.pool = v; }) })),
    h(Puces, null, ORDRE_JOURS.map(j => h(Puce, { key: j, actif: (m.days || []).includes(j), onClick: () => maj(n => { const a = n.days || []; n.days = a.includes(j) ? a.filter(x => x !== j) : [...a, j]; }) }, JOURS[j]))),
    m.blocks.map((b, i) => h("article.exo-ed", { key: i },
      h("header", h("b", b.t), h("button.mini-x", { "aria-label": "Retirer", onClick: () => maj(n => { n.blocks.splice(i, 1); }) }, h(Icone, { n: "fermer", t: 16 }))),
      h(Puces, { defile: true }, NAGE_BLOCS.map(t => h(Puce, { key: t, actif: b.t === t, onClick: () => maj(n => { n.blocks[i].t = t; }) }, t))),
      h("div.quatre", champ(i, "reps", "Fois"), champ(i, "d", "Mètres", { pas: [25, 50] }), b.mode === "dep" ? champ(i, "dep", "Départ", { mode: "ms", pas: [5] }) : champ(i, "rest", "Repos", { unite: "s", pas: [5, 15] })),
      h(Puces, { defile: true }, NAGES.map(t => h(Puce, { key: t, actif: b.nage === t, onClick: () => maj(n => { n.blocks[i].nage = t; }) }, t))),
      h(Puces, { defile: true }, NAGE_MATERIEL.map(t => h(Puce, { key: t, actif: b.mat === t, onClick: () => maj(n => { n.blocks[i].mat = t; }) }, t === "—" ? "Sans matériel" : t)),
        h(Puce, { actif: b.mode === "dep", onClick: () => maj(n => { n.blocks[i].mode = b.mode === "dep" ? "rest" : "dep"; }) }, "Départ fixe")))),
    h(Bouton, { cl: "contour", onClick: () => maj(n => { n.blocks.push({ t: "Série", reps: 4, d: 100, nage: "Crawl", mat: "—", mode: "rest", dep: 0, rest: 20, note: "" }); }) }, "Ajouter un bloc"),
    liste.some(x => x.id === m.id) && h(Bouton, { cl: "contour danger-t", onClick: async () => { Nav.fermer(); avecAnnuler("natation-modeles", liste.filter(x => x.id !== m.id), "Séance type supprimée"); } }, "Supprimer cette séance type"),
    h(Bouton, { cl: "plein grand", onClick: enregistrer }, "Enregistrer"));
}
