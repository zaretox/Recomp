"use strict";
/* PROGRAMMES — choisir, créer, modifier, importer depuis un texte.
 * "programmes" = [{ id, name, seances: [{ nom, days: [0-6], ex: [{ nom, muscle, sets, lo, hi, kg, rest, note }] }] }] */
const copie = o => JSON.parse(JSON.stringify(o));

function FeuilleProgrammes() {
  useDB();
  const progs = DB.get("programmes"), pr = profil(), enCours = programmeEnCours();
  const ligne = (id, titre, sous) => h("button.choix-l", { key: id, className: pr.programme === id ? "actif" : "", onClick: () => setProfil({ programme: id }) },
    h("span", h("b", titre), h("small", sous)), pr.programme === id && h(Icone, { n: "check", t: 20 }));
  const dupliquer = p => { DB.set("programmes", [...progs, { ...copie(p), id: nouvelId("p"), name: p.name + " (copie)" }]); toast("Programme copié"); };
  const supprimer = async p => {
    if (await confirmer({ titre: "Supprimer « " + p.name + " » ?", message: "Tes séances déjà enregistrées restent dans l'historique.", oui: "Supprimer", danger: true })) {
      if (pr.programme === p.id) await setProfil({ programme: "auto" });
      avecAnnuler("programmes", progs.filter(x => x.id !== p.id), "Programme supprimé");
    }
  };
  return h(Feuille, { titre: "Mes programmes", ton: "sport" },
    h("div.choix-v",
      ligne("auto", "Automatique", "Salle si tu y es allé ces 21 derniers jours, sinon maison. En cours : " + infoProgramme(enCours).label),
      ligne("salle", "PPL Salle", "Lun, mar, mer, ven, sam"),
      ligne("maison", "Circuits maison", "Lun, mer, ven, sam")),
    progs.length > 0 && h(Section, { titre: "Tes programmes" }, progs.map(p => h(Fragment, { key: p.id },
      ligne(p.id, p.name, (p.seances || []).length + " séances"),
      h("div.actions-l",
        h("button.mini", { onClick: () => Nav.sheet("editeur", { id: p.id }) }, "Modifier"),
        h("button.mini", { onClick: () => dupliquer(p) }, "Copier"),
        h("button.mini", { onClick: () => supprimer(p) }, "Supprimer"))))),
    h(Section, { titre: "Ajouter" },
      h(Rangee, { titre: "Créer un programme", onClick: () => Nav.sheet("editeur", { neuf: { id: nouvelId("p"), name: "Nouveau programme", seances: [{ nom: "Séance A", days: [], ex: [] }] } }) }),
      h(Rangee, { titre: "Importer un texte", sous: "Colle un programme écrit librement", onClick: () => Nav.sheet("import") }),
      h(Rangee, { titre: "Partir du PPL", sous: "Une copie à modifier", onClick: () => Nav.sheet("editeur", { neuf: copiePPL() }) })));
}

function FeuilleImport() {
  const [txt, setTxt] = useState("");
  const r = txt.trim() ? lireProgramme(txt) : null;
  return h(Feuille, { titre: "Importer", ton: "sport" },
    h("textarea.texte", { rows: 9, value: txt, onChange: e => setTxt(e.target.value), placeholder: "Programme : Force\nLundi — Haut A\nDéveloppé couché 4x8-10 80kg 2min\nRowing barre 3 séries de 12\n\nMardi — Bas\nSquat 5x5 100kg 3min" }),
    r && h(Section, { titre: r.name }, r.seances.map((s, i) => h("div.histo", { key: i }, h("span", s.days.map(d => JOURS[d]).join(" ") || "—"), h("b", s.nom + " : " + pluriel(s.ex.length, "exercice")))),
      r.rejets.length > 0 && h("p.note", pluriel(r.rejets.length, "ligne ignorée", "lignes ignorées") + " : " + r.rejets.map(x => x.l).slice(0, 3).join(" · "))),
    h(Bouton, { cl: "plein", disabled: !r || !r.seances.length, onClick: () => { Nav.fermer(); Nav.sheet("editeur", { neuf: { id: nouvelId("p"), name: r.name, seances: r.seances } }); } }, "Vérifier et enregistrer"));
}

function FeuilleEditeur({ id, neuf }) {
  const [d, setD] = useState(() => copie(neuf || DB.get("programmes").find(p => p.id === id)));
  const [s, setS] = useState(0);
  const maj = fn => setD(x => { const n = copie(x); fn(n); return n; });
  const se = d.seances[s];
  const enregistrer = async () => {
    const seances = nomsUniques(d.seances).filter(x => x.ex.length || d.seances.length === 1);
    const liste = DB.get("programmes"), p = { ...d, seances };
    await DB.set("programmes", liste.some(x => x.id === p.id) ? liste.map(x => x.id === p.id ? p : x) : [...liste, p]);
    Nav.fermer();
    toast("Programme enregistré");
  };
  const ajouteExo = (nom, muscle) => maj(n => { n.seances[s].ex.push({ nom, muscle: muscle || muscleDe(nom) || devineMuscle(nom), sets: 3, lo: 8, hi: 12, kg: 0, rest: 90, note: "" }); });
  const num = (ei, cle, titre, o) => h(Champ, { etiquette: titre, valeur: se.ex[ei][cle], mode: o?.mode || "ent", unite: o?.unite, pas: o?.pas || [1], min: 0, titre: se.ex[ei].nom + " : " + titre.toLowerCase(), onChange: v => maj(n => { n.seances[s].ex[ei][cle] = v; if (cle === "lo" && n.seances[s].ex[ei].hi < v) n.seances[s].ex[ei].hi = v; }) });
  return h(Feuille, { titre: "Programme", ton: "sport", plein: true },
    h("input.champ-t", { value: d.name, onChange: e => { const v = e.target.value; maj(n => { n.name = v; }); }, "aria-label": "Nom du programme" }),
    h(Puces, { defile: true }, d.seances.map((x, i) => h(Puce, { key: i, actif: i === s, onClick: () => setS(i) }, x.nom)),
      h(Puce, { onClick: () => { maj(n => { n.seances.push({ nom: "Séance " + "ABCDEFGHIJ"[n.seances.length % 10], days: [], ex: [] }); }); setS(d.seances.length); } }, "+ séance")),
    se && h(Fragment, null,
      h("input.champ-t.petit", { value: se.nom, onChange: e => { const v = e.target.value; maj(n => { n.seances[s].nom = v; }); }, "aria-label": "Nom de la séance" }),
      h(Puces, null, ORDRE_JOURS.map(j => h(Puce, { key: j, actif: (se.days || []).includes(j), onClick: () => maj(n => { const a = n.seances[s].days || []; n.seances[s].days = a.includes(j) ? a.filter(x => x !== j) : [...a, j]; }) }, JOURS[j]))),
      se.ex.map((e, i) => h("article.exo-ed", { key: i },
        h("header", h("b", e.nom), h("small", e.muscle), h("button.mini-x", { "aria-label": "Retirer", onClick: () => maj(n => { n.seances[s].ex.splice(i, 1); }) }, h(Icone, { n: "fermer", t: 16 }))),
        h("div.quatre", num(i, "sets", "Séries"), num(i, "lo", "Reps min"), num(i, "hi", "Reps max"), num(i, "kg", "Charge", { mode: "dec", unite: "kg", pas: [2.5, 5] }), num(i, "rest", "Repos", { unite: "s", pas: [15, 30] })))),
      h(Bouton, { cl: "contour", onClick: () => Nav.sheet("bibliotheque", { choisir: ajouteExo }) }, "Ajouter un exercice"),
      d.seances.length > 1 && h(Bouton, { cl: "contour danger-t", onClick: () => { maj(n => { n.seances.splice(s, 1); }); setS(0); } }, "Retirer cette séance")),
    h(Bouton, { cl: "plein grand", onClick: enregistrer }, "Enregistrer le programme"));
}

/* Bibliothèque : tous les exercices expliqués, et les techniques d'intensification.
 * Avec `choisir` (éditeur de programme), toucher un exercice le choisit ; sinon, ça ouvre sa fiche. */
function FeuilleBibliotheque({ choisir, onglet }) {
  useDB();
  const [vue, setVue] = useState(onglet || "exos");
  const [q, setQ] = useState(""), [mu, setMu] = useState("Tous"), [creer, setCreer] = useState(null);
  const perso = DB.get("exos-perso");
  const tous = [...perso.map(x => [x.nom, x.muscle]), ...EXO_LIB.filter(([n]) => !perso.some(x => x.nom === n))].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const ql = sansAccent(q.trim()), liste = tous.filter(([n, m]) => (mu === "Tous" || m === mu) && (!ql || sansAccent(n).includes(ql)));
  const pris = (n, m) => { choisir(n, m); Nav.fermer(); };
  if (creer) return h(Feuille, { titre: "Muscle principal", ton: "sport" },
    h(Puces, null, MUSCLES.map(m => h(Puce, { key: m, onClick: async () => { await DB.set("exos-perso", [{ nom: creer, muscle: m }, ...perso]); pris(creer, m); } }, m))));
  const exos = h(Fragment, null,
    h("input.recherche", { value: q, onChange: e => setQ(e.target.value), placeholder: choisir ? "Chercher ou créer un exercice" : "Chercher un exercice", "aria-label": "Chercher un exercice" }),
    h(Puces, { defile: true }, ["Tous", ...MUSCLES].map(m => h(Puce, { key: m, actif: mu === m, onClick: () => setMu(m) }, m))),
    choisir && q.trim() && !tous.some(([n]) => sansAccent(n) === ql) && h(Bouton, { cl: "contour", onClick: () => setCreer(q.trim()) }, "Créer « " + q.trim() + " »"),
    h("p.note", pluriel(liste.length, "exercice")),
    h("div.liste", liste.map(([n, m]) => {
      const fiche = ficheDe(n);
      return h("div.ligne-biblio", { key: n },
        h("button.ligne", { onClick: () => choisir ? pris(n, m) : fiche ? Nav.sheet("fiche", { nom: n }) : null },
          h("span", n, h("small", m + (fiche?.mat ? " · " + fiche.mat : ""))), !choisir && fiche && h(Icone, { n: "fleche", t: 16 })),
        choisir && fiche && h("button.rond.petit", { onClick: () => Nav.sheet("fiche", { nom: n }), "aria-label": "Comment faire " + n }, h(Icone, { n: "liste", t: 16 })));
    })));
  const techs = h(Fragment, null,
    h("p.texte-p", "Des façons de rendre une série plus difficile sans forcément ajouter de charge. ", h("b", "Une ou deux par séance suffisent"), ", sur les derniers exercices."),
    CATEGORIES_TECH.map(c => h(Section, { key: c, titre: c },
      h("div.liste", TECHNIQUES.filter(t => t.cat === c).map(t => h("button.ligne", { key: t.nom, onClick: () => Nav.sheet("technique", { nom: t.nom }) },
        h("span", t.nom, h("small", t.bref)), h(Icone, { n: "fleche", t: 16 })))))));
  return h(Feuille, { titre: "Bibliothèque", ton: "sport" },
    !choisir && h("div.onglets-b", { role: "tablist" },
      [["exos", "Exercices"], ["techs", "Techniques"]].map(([k, l]) => h("button", { key: k, role: "tab", "aria-selected": vue === k, className: vue === k ? "actif" : "", onClick: () => { vibre(); setVue(k); } }, l))),
    vue === "techs" && !choisir ? techs : exos);
}

/* La fiche d'un exercice : comment le faire, la clé, l'erreur à éviter */
function FeuilleFiche({ nom }) {
  useDB();
  const vrai = nomDeFiche(nom) || nom, f = ficheDe(nom), muscle = muscleDe(nom) || muscleDe(vrai);
  const fait = DB.get("sport-logs").some(l => (l.exercices || []).some(e => e.nom === nom));
  if (!f) return h(Feuille, { titre: nom, ton: "sport" }, h(Vide, null, "Pas encore de fiche pour cet exercice."));
  return h(Feuille, { titre: nom, ton: "sport" },
    vrai !== nom && h("p.sous-t", "Fiche de : " + vrai),
    schemaDe(nom) && h(Schema, { s: schemaDe(nom) }),
    h("div.fiche-tags", muscle && h("span.fiche-tag.fort", muscle), f.s && f.s !== "—" && h("span.fiche-tag", "Aide : " + f.s), f.mat && h("span.fiche-tag", f.mat)),
    h(Section, { titre: "Comment faire" }, h("ol.etapes", f.f.map((t, i) => h("li", { key: i }, t)))),
    h("div.fiche-cle", h("b", "La clé"), h("p", f.c)),
    h("div.fiche-cle.evite", h("b", "À éviter"), h("p", f.e)),
    (SUBSTITUTIONS[nom] || []).length > 0 && h(Section, { titre: "Si ça fait mal, remplace par" }, h(Puces, null, SUBSTITUTIONS[nom].map(a => h(Puce, { key: a, onClick: () => ficheDe(a) && Nav.sheet("fiche", { nom: a }) }, a)))),
    fait && h(Bouton, { cl: "contour", ico: "chrono", onClick: () => Nav.sheet("exercice", { nom }) }, "Ma progression"));
}

/* Une technique d'intensification */
function FeuilleTechnique({ nom }) {
  const t = TECHNIQUES.find(x => x.nom === nom);
  if (!t) return h(Feuille, { titre: nom, ton: "sport" }, h(Vide, null, "Technique introuvable."));
  return h(Feuille, { titre: t.nom, ton: "sport" },
    h("p.sous-t", t.cat),
    h("p.texte-p", h("b", t.bref)),
    h(Section, { titre: "Comment faire" }, h("ol.etapes", t.comment.map((x, i) => h("li", { key: i }, x)))),
    h("div.fiche-cle", h("b", "Exemple"), h("p", t.exemple)),
    h("div.fiche-cle", h("b", "Quand l'utiliser"), h("p", t.quand)),
    h("div.fiche-cle.evite", h("b", "Attention"), h("p", t.attention)));
}
