"use strict";
/* SÉANCE — plein écran, une seule chose à faire : cocher.
 * Chaque série cochée est écrite tout de suite dans sport-logs (au format historique) : rien ne se perd.
 * Le haut de l'écran devient le minuteur pendant le repos. */
const DIFFICULTES = [[7, "Facile"], [8, "Bien"], [9, "Dur"], [10, "Limite"]];
const ouvrirSeance = (iso, s) => Nav.sheet("seance", { iso, prog: s.prog === "maison" ? "maison" : "salle", code: s.code });

function versLog(iso, code, cfg, log) {
  // Une séance notée après coup n'a pas d'heure de début : sa durée n'aurait pas de sens
  return log || { id: Date.now(), date: dateCourte(iso), dateISO: iso, seance: code, deload: !!cfg.deload, ...(iso === aujourdhui() ? { startedAt: Date.now() } : {}), exercices: [] };
}
function majSeance(iso, code, fn) {
  const logs = DB.get("sport-logs"), log = logs.find(l => l.dateISO === iso && l.seance === code), cfg = reglages();
  const suivant = fn(versLog(iso, code, cfg, log));
  const reste = logs.filter(l => l !== log);
  return DB.set("sport-logs", suivant ? [...reste, suivant] : reste);
}

function CarteExo({ ex, i, ouvert, setOuvert, iso, code, log, prop, avant, douleurs, record, suivant }) {
  const e = log?.exercices?.find(x => x.nom === ex.nom);
  const faites = e?.setsDetail?.length ? e.setsDetail : e?.sets ? Array.from({ length: e.sets }, () => ({ w: e.weight, r: e.reps })) : [];
  const prevues = Math.max(prop.sets || 3, faites.length);
  const [nbLignes, setNb] = useState(prevues);
  const [brouillon, setB] = useState({});
  const total = Math.max(nbLignes, faites.length);
  const ligne = k => faites[k] || brouillon[k] || (k > 0 && (brouillon[k - 1] || faites[k - 1])) || { w: prop.weight || 0, r: prop.reps || 0 };
  const der = dernierExo(avant, code, ex.nom), mal = douleurSur(ex.nom, douleurs);
  const complet = faites.length >= total;
  const ecrire = lignes => majSeance(iso, code, l => {
    const autres = (l.exercices || []).filter(x => x.nom !== ex.nom);
    if (!lignes.length && !autres.length) return null;
    const top = lignes.length ? Math.max(...lignes.map(s => s.w)) : 0;
    const rec = lignes.length ? { nom: ex.nom, weight: top, reps: Math.min(...lignes.filter(s => s.w === top).map(s => s.r)), sets: lignes.length, setsDetail: lignes, restSets: 0, restExo: 0, rpe: e?.rpe || 0 } : null;
    return { ...l, exercices: rec ? [...autres, rec] : autres };
  });
  const tick = async k => {
    if (k < faites.length) { await ecrire(faites.slice(0, k)); Repos.arreter(); return; }
    const lignes = [...faites];
    for (let j = faites.length; j <= k; j++) lignes.push({ w: ligne(j).w, r: ligne(j).r });
    if (lignes.some(s => !s.w && !s.r)) return toast("Indique la charge ou les reps de la série");
    await ecrire(lignes);
    const n = lignes.length;
    if (lignes[n - 1].w > Math.max(record, ...faites.map(s => s.w))) toast("Record : " + ex.nom + " à " + nb(lignes[n - 1].w) + " kg");
    if (iso === aujourdhui()) Repos.demarrer(parseRepos(reposDe(code, ex.orig || ex.nom)), ex.nom + ", série " + n + "/" + total, { iso, prog: "salle", code });
    if (n >= total) suivant(i);
  };
  const edite = async (k, champ) => {
    const v = ligne(k);
    const r = await saisir(champ === "w"
      ? { titre: ex.nom, valeur: v.w, mode: "dec", unite: "kg", pas: [pasDeCharge(ex.nom), pasDeCharge(ex.nom) * 2], min: 0 }
      : { titre: ex.nom, valeur: v.r, mode: "ent", unite: "reps", pas: [1], min: 0 });
    if (r == null) return;
    if (k < faites.length) return ecrire(faites.map((s, j) => j === k ? { ...s, [champ]: r } : s));
    // Une valeur changée vaut aussi pour les séries suivantes pas encore faites
    setB(b => { const n = { ...b }; for (let j = k; j < total; j++) n[j] = { ...ligne(j), [champ]: r }; return n; });
  };
  const noter = rpe => majSeance(iso, code, l => ({ ...l, exercices: l.exercices.map(x => x.nom === ex.nom ? { ...x, rpe } : x) }));

  if (!ouvert) return h("button.exo.ferme", { onClick: () => setOuvert(i), className: complet ? "fait" : "" },
    complet ? h("i.ok", h(Icone, { n: "check", t: 16 })) : h("i.num", faites.length + "/" + total),
    h("span", h("b", ex.nom), h("small", faites.length ? fmtSeries({ setsDetail: faites }) : (prop.weight ? nb(prop.weight) + " kg × " : "") + (prop.reps || ""))),
    mal.length > 0 && h("em.alerte", mal[0].zone));

  const coach = prop.src === "coach" ? prop.txt : prop.src === "science" ? "objectif réglé : " + nb(prop.weight) + " kg" : prop.src === "phase" && prop.weight ? "charge de départ : " + nb(prop.weight) + " kg" : null;
  return h("article.exo.ouvert",
    h("header",
      h("div", h("h3", ex.nom), coach && h("p.coach-l", { "data-a": prop.action }, coach)),
      h("button.rond", { onClick: () => Nav.sheet("exercice", { nom: ex.nom, orig: ex.orig, iso, code, kg: ligne(0).w }), "aria-label": "Plus sur cet exercice" }, h(Icone, { n: "points", t: 20 }))),
    der && h("p.dernier", "Dernière fois : " + fmtSeries(der) + (der.rpe ? ", " + (DIFFICULTES.find(d => d[0] >= der.rpe)?.[1] || "").toLowerCase() : "")),
    mal.length > 0 && h("button.alerte-b", { onClick: () => Nav.sheet("exercice", { nom: ex.nom, orig: ex.orig, iso, code, kg: ligne(0).w }) }, mal.map(m => m.zone + " " + m.i + "/10").join(", ") + " : baisse la charge ou remplace"),
    ex.note && h("p.dernier", ex.note),
    h("div.series", Array.from({ length: total }, (_, k) => {
      const v = ligne(k), fait = k < faites.length;
      return h("div.serie", { key: k, className: fait ? "fait" : k === faites.length ? "courante" : "" },
        h("span.serie-n", k + 1),
        h("button.val", { onClick: () => edite(k, "w") }, h("b", nb(v.w) || "—"), h("small", "kg")),
        h("span.fois", "×"),
        h("button.val", { onClick: () => edite(k, "r") }, h("b", v.r || "—"), h("small", "reps")),
        h(Coche, { fait, onClick: () => tick(k), label: "Série " + (k + 1), t: 46 }));
    })),
    h("div.exo-b",
      h("button.mini", { onClick: () => setNb(total + 1) }, "+ série"),
      total > 1 && total > faites.length && h("button.mini", { onClick: () => setNb(total - 1) }, "− série")),
    faites.length > 0 && h("div.difficulte", h("small", "Comment c'était ?"),
      h(Puces, null, DIFFICULTES.map(([v, l]) => h(Puce, { key: v, actif: e?.rpe === v, onClick: () => noter(v) }, l)))));
}

function TeteSeance({ titre, faites, total, repos, fermer, terminer }) {
  if (repos) {
    const p = repos.total ? borne(repos.reste / repos.total * 100) : 0;
    return h("header.tete-s.repos", { style: { "--p": p + "%" } },
      h("div.tete-l", h("span", "Repos"), h("small", repos.label)),
      h("div.chrono", mmss(repos.reste)),
      h("div.tete-b",
        h("button", { onClick: () => Repos.ajoute(-15) }, "−15 s"),
        h("button", { onClick: () => Repos.ajoute(15) }, "+15 s"),
        h("button", { onClick: () => Repos.arreter() }, "Passer")));
  }
  return h("header.tete-s",
    h("div.tete-h",
      h("button.rond", { onClick: fermer, "aria-label": "Réduire la séance" }, h(Icone, { n: "bas", t: 20 })),
      h("button.tete-fin", { onClick: terminer }, "Terminer")),
    h(Geant, null, titre),
    h("div.tete-p", h("div.jauge", h("i", { style: { width: (total ? faites / total * 100 : 0) + "%" } })), h("b", faites + "/" + total)));
}

function BilanSeance({ log, se, fermer }) {
  const vol = Math.round(volumeSeance(log)), series = (log.exercices || []).reduce((a, e) => a + seriesDe(e), 0);
  const prec = DB.get("sport-logs").filter(l => l.seance === log.seance && l.dateISO < log.dateISO && !l.deload).sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
  const volP = prec ? Math.round(volumeSeance(prec)) : null, recs = recordsDe([log]);
  const duree = log.startedAt && log.endedAt ? Math.round((log.endedAt - log.startedAt) / 60000) : null;
  return h("div.fin-seance",
    h("span.affiche-e", "Séance terminée"),
    h(Geant, null, log.seance),
    recs.length > 0 && h("div.records", h("span.affiche-e", recs.length > 1 ? recs.length + " records" : "Record"), recs.map((r, i) => h("div", { key: i }, h("b", nb(r.kg) + " kg"), h("span", r.nom)))),
    h("div.tuiles",
      h(Tuile, { v: entier(vol), l: "kg soulevés" + (volP ? " (" + signe((vol - volP) / volP * 100, 0) + " %)" : "") }),
      h(Tuile, { v: series, l: "séries" }),
      duree != null && h(Tuile, { v: duree >= 60 ? Math.floor(duree / 60) + " h " + pad2(duree % 60) : duree + " min", l: "durée" })),
    h(Bouton, { cl: "plein", onClick: fermer }, "Fermer"));
}

function FeuilleSeance({ iso, prog, code }) {
  useDB();
  useEcranAllume(true);
  const repos = useRepos();
  const [ouvert, setOuvert] = useState(null), [fini, setFini] = useState(false);
  if (prog === "maison") return h(FeuilleCircuit, { iso, code });
  const se = seanceParId(code);
  if (!se) return h(Feuille, { titre: "Séance introuvable" }, h(Vide, null, "Cette séance n'existe plus dans ton programme."));
  const logs = DB.get("sport-logs"), log = logs.find(l => l.dateISO === iso && l.seance === code), avant = logs.filter(l => l.dateISO < iso);
  const cfg = reglages(), phase = +DB.get("sport-phase") || 0, douleurs = douleursRecentes(10);
  const swaps = log?.swaps || {};
  const exos = se.exercices.map(ex => swaps[ex.nom] ? { ...ex, nom: swaps[ex.nom], orig: ex.nom, charges: [], note: "" } : ex);
  const props = exos.map(ex => proposition(avant, code, ex, phase, cfg));
  const fait = ex => { const e = log?.exercices?.find(x => x.nom === ex.nom); return e ? seriesDe(e) : 0; };
  const total = props.reduce((a, p) => a + (p.sets || 3), 0), faites = exos.reduce((a, ex, i) => a + Math.min(fait(ex), props[i].sets || 3), 0);
  const courant = ouvert ?? exos.findIndex((ex, i) => fait(ex) < (props[i].sets || 3));
  const r = recuperation(aujourdhui());
  const terminer = async () => {
    if (!faites) return Nav.fermer();
    Repos.arreter();
    await majSeance(iso, code, l => ({ ...l, endedAt: l.endedAt || Date.now() }));
    setFini(true);
  };
  if (fini && log) return h(Feuille, { plein: true, sansTete: true, ton: "sport" }, h(BilanSeance, { log, se, fermer: Nav.fermer }));
  return h(Feuille, { plein: true, sansTete: true, ton: "sport" },
    h(TeteSeance, { titre: code, faites, total, repos, fermer: Nav.fermer, terminer }),
    h("div.seance-c",
      iso !== aujourdhui() && h("p.bandeau", h("b", "Séance du " + dateLongue(iso).toLowerCase() + ". "), "Coche ce que tu as fait ce jour-là."),
      cfg.deload && h("p.bandeau", "Semaine légère : charges −40 %, les records ne comptent pas."),
      r?.score != null && iso === aujourdhui() && h("button.bandeau", { onClick: () => Nav.sheet("forme") }, h("b", "Forme " + r.score + ". "), r.conseil),
      exos.map((ex, i) => h(CarteExo, { key: ex.nom + i, ex, i, ouvert: courant === i, setOuvert, iso, code, log, prop: props[i], avant, douleurs, record: cfg.deload ? Infinity : meilleureCharge(avant, ex.nom) || Infinity, suivant: k => setOuvert(k + 1 < exos.length ? k + 1 : null) })),
      se.finisher && h("button.finisher", { className: log?.finisher ? "fait" : "", onClick: () => majSeance(iso, code, l => ({ ...l, finisher: !l.finisher })) }, h("i", h(Icone, { n: "check", t: 16 })), h("span", h("small", "Pour finir"), h("b", se.finisher))),
      h(Bouton, { cl: "plein grand", onClick: terminer }, faites >= total ? "Terminer la séance" : "Terminer maintenant")));
}

/* Circuits maison : un rond par tour */
function FeuilleCircuit({ iso, code }) {
  useDB();
  const m = MAISON.find(x => x.code === code), tours = parseInt(m.format) || 3, logs = DB.get("maison-logs"), log = logs.find(l => l.dateISO === iso && l.seance === code);
  const parse = x => x.split("—").map(s => s.trim());
  const faits = nom => log?.exercices?.find(e => e.nom === nom)?.tours || 0;
  const tick = (i, n) => {
    const exs = m.ex.map(x => { const [nom, c] = parse(x); return log?.exercices?.find(e => e.nom === nom) || { nom, reps: parseInt(c) || 0, tours: 0 }; });
    exs[i] = { ...exs[i], tours: n };
    const e = { ...(log || { id: Date.now(), date: dateCourte(iso), dateISO: iso, seance: code }), exercices: exs };
    const reste = logs.filter(l => l !== log);
    DB.set("maison-logs", exs.some(x => x.tours > 0) ? [...reste, e] : reste);
  };
  const total = tours * m.ex.length, fait = m.ex.reduce((a, x) => a + faits(parse(x)[0]), 0);
  return h(Feuille, { plein: true, sansTete: true, ton: "sport" },
    h(TeteSeance, { titre: "Maison " + code, faites: fait, total, fermer: Nav.fermer, terminer: Nav.fermer }),
    h("div.seance-c",
      h("p.bandeau", h("b", m.titre + ". "), m.format),
      m.ex.map((x, i) => {
        const [nom, c] = parse(x), n = faits(nom);
        return h("article.exo.ouvert", { key: i },
          h("header", h("div", h("h3", nom), h("p.coach-l", c))),
          h("div.ronds", Array.from({ length: tours }, (_, j) => h("button", { key: j, className: j < n ? "fait" : "", "aria-label": "Tour " + (j + 1), onClick: () => { vibre(); tick(i, j < n ? j : j + 1); } }, j + 1))));
      }),
      m.note && h("p.note", m.note)));
}

/* Tout sur un exercice : courbe du max, % de max, disques, échauffement, remplacement */
function FeuilleExercice({ nom, orig, iso, code, kg }) {
  useDB();
  const logs = DB.get("sport-logs"), [barre, setBarre] = useState(20), [cible, setCible] = useState(kg || 0);
  const mx = maxActuel(logs, nom);
  const pts = logs.filter(l => !l.deload && (l.exercices || []).some(e => e.nom === nom && e.weight > 0)).sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map(l => { const e = l.exercices.find(x => x.nom === nom); return { x: l.dateISO, y: maxEstime(e.weight, e.reps), e }; }).filter(p => p.y > 0);
  const dansSeance = code ? (seanceParId(code)?.exercices || []).map(e => e.nom) : [];
  const dis = disquesPour(cible, barre), ech = echauffement(kg), subs = (SUBSTITUTIONS[orig || nom] || []).filter(a => !dansSeance.includes(a));
  const remplacer = async a => {
    await majSeance(iso, code, l => ({ ...l, swaps: { ...(l.swaps || {}), [orig || nom]: a } }));
    Nav.fermer();
    toast("Remplacé pour aujourd'hui : " + a);
  };
  return h(Feuille, { titre: nom, ton: "sport" },
    h("div.tuiles",
      h(Tuile, { v: mx ? mx.rm + " kg" : "—", l: "max estimé" }),
      h(Tuile, { v: pts.length, l: "séances" }),
      h(Tuile, { v: pts.length ? nb(Math.max(...pts.map(p => p.e.weight))) + " kg" : "—", l: "charge record" })),
    pts.length >= 2 && h(Section, { titre: "Max estimé" }, h(Courbe, { pts, unite: "kg", ton: "sport" })),
    ech.length > 0 && code && h(Section, { titre: "Échauffement avant " + nb(kg) + " kg" }, h("p.ligne-simple", ech.map(s => nb(s.w) + " kg × " + s.r).join("  ·  "))),
    (subs.length > 0 && iso) && h(Section, { titre: "Remplacer pour aujourd'hui" }, h(Puces, null, subs.map(a => h(Puce, { key: a, onClick: () => remplacer(a) }, a)))),
    orig && iso && h(Bouton, { cl: "contour", onClick: async () => { await majSeance(iso, code, l => { const s = { ...(l.swaps || {}) }; delete s[orig]; return { ...l, swaps: s }; }); Nav.fermer(); } }, "Revenir à " + orig),
    h(Section, { titre: "Disques par côté" },
      h("div.deux", h(Champ, { etiquette: "Charge", valeur: cible, unite: "kg", mode: "dec", pas: [2.5, 5], min: 0, onChange: setCible }),
        h(Puces, null, [20, 15, 10].map(b => h(Puce, { key: b, actif: barre === b, onClick: () => setBarre(b) }, "Barre " + b)))),
      dis ? h("p.ligne-simple", dis.res.length ? dis.res.map(d => d.c + " × " + nb(d.p)).join("  ·  ") : "Barre à vide", dis.manque > 0 ? "  (il manque " + nb(dis.manque) + " kg)" : "") : h(Vide, null, "Charge inférieure à la barre.")),
    mx && h(Section, { titre: "Pourcentages de ton max" }, h("div.table-pc", [95, 90, 85, 80, 75, 70, 65].map(p => h("div", { key: p }, h("span", p + " %"), h("b", nb(Math.round(mx.rm * p / 100 / 2.5) * 2.5) + " kg"), h("small", "≈ " + Math.max(1, Math.round((100 / p - 1) * 30)) + " reps"))))),
    pts.length > 0 && h(Section, { titre: "Dernières séances" }, [...pts].reverse().slice(0, 6).map((p, i) => h("div.histo", { key: i }, h("span", dateMini(p.x)), h("b", fmtSeries(p.e))))));
}
