"use strict";
/* SAISIE RAPIDE ET RÉGLAGES */

/* Le bouton + : « Que veux-tu faire ? ». Les gestes courants d'abord, puis tout RECOMP en recherche. */
const ACTIONS = [
  { t: "Forme du matin", i: "coeur", go: () => Nav.sheet("matin"), kw: "polar montre vfc sna sommeil fc" },
  { t: "Pesée", i: "poids", go: () => Nav.sheet("pesee"), kw: "poids balance kg" },
  { t: "Aliment", i: "repas", go: () => Nav.sheet("aliment", { iso: aujourdhui() }), kw: "manger extra calories journal" },
  { t: "Dépense", i: "argent", go: () => Nav.sheet("operation"), kw: "achat payer euros" },
  { t: "Séance", i: "sport", go: () => Nav.sheet("choisir"), kw: "muscu salle entrainement" },
  { t: "Natation", i: "nage", go: () => Nav.sheet("natation"), kw: "piscine nager" },
  { t: "J'ai mal", i: "mal", go: () => Nav.sheet("douleur"), kw: "douleur genou pied epaule blessure" },
  { t: "Mensurations", i: "ruban", go: () => Nav.sheet("mensurations"), kw: "tour taille cou bras cuisse" },
];
const DESTINATIONS = [
  ["Bilan de la semaine", () => Nav.sheet("bilan"), "progres resume ou j en suis"], ["Détail de ma forme", () => Nav.sheet("forme"), "recuperation score vfc sommeil dette"],
  ["Courses", () => Nav.sheet("courses"), "liste magasin prix supermarche alternatives economies"], ["Ma cible calorique", () => Nav.sheet("calories"), "deficit objectif macros proteines metabolisme depense"],
  ["Mes programmes", () => Nav.sheet("programmes"), "ppl creer importer maison"], ["Bibliothèque d'exercices", () => Nav.sheet("bibliotheque"), "exercices fiches execution comment faire bibliotheque"],
  ["Techniques d'intensification", () => Nav.sheet("bibliotheque", { onglet: "techs" }), "superset triset degressive drop set rest pause negatives isometrie contraction tempo pyramide"], ["Revenu", () => Nav.sheet("operation", { revenu: true }), "salaire"],
  ["Charges fixes", () => Nav.sheet("fixes"), "loyer abonnement forfait"], ["Photos", () => Nav.sheet("photos"), "avant apres"],
  ["Douleurs", () => Nav.sheet("douleurs"), "suivi historique alternatives regles"], ["Réglages", () => Nav.sheet("reglages"), "profil horaires reveil creneau theme"], ["Sauvegarde", () => Nav.sheet("reglages"), "export import donnees restaurer"],
  ["Rappels au calendrier", () => Nav.sheet("reglages"), "ics planning horaires"], ["Séance d'aujourd'hui", () => Nav.tab("sport"), "minuteur repos series"], ["Repas d'aujourd'hui", () => Nav.tab("repas"), "menu plats manger"], ["Mes comptes", () => Nav.tab("argent"), "budget reste enveloppes plafond epargne"], ["Ma courbe de poids", () => Nav.tab("corps"), "tendance objectif projection"],
];
function FeuilleCapture() {
  const [q, setQ] = useState(""), ql = sansAccent(q.trim());
  const lance = go => { Nav.fermer(); go(); };
  const cherche = (t, kw) => sansAccent(t + " " + (kw || "")).includes(ql);
  const acts = ACTIONS.filter(a => !ql || cherche(a.t, a.kw)), dest = ql ? DESTINATIONS.filter(([t, , kw]) => cherche(t, kw)) : [];
  return h(Feuille, { titre: "Que veux-tu faire ?" },
    h("input.recherche", { value: q, onChange: e => setQ(e.target.value), placeholder: "Chercher : poids, courses, sommeil…", "aria-label": "Chercher dans RECOMP", enterKeyHint: "search" }),
    h("div.gestes", acts.map(a => h("button", { key: a.t, onClick: () => lance(a.go) }, h(Icone, { n: a.i, t: 26 }), h("span", a.t)))),
    dest.length > 0 && h("div.liste", dest.map(([t, go]) => h("button.ligne", { key: t, onClick: () => lance(go) }, h("span", t), h(Icone, { n: "fleche", t: 16 })))),
    ql && !acts.length && !dest.length && h(Vide, null, "Rien pour « " + q.trim() + " ». Essaie poids, séance, courses ou sommeil."));
}

/* Sauvegarde complète, photos comprises. Même format que les versions précédentes. */
// Les accès Polar et banque restent sur ce téléphone : ils ne partent jamais dans une sauvegarde
const HORS_SAUVEGARDE = ["last-export", "polar-lien", "banque-lien"];
const CLES_SAUVEGARDE = Object.keys(DEFAUTS).filter(k => !HORS_SAUVEGARDE.includes(k));
async function exporter() {
  let cles = [];
  try { cles = (await window.storage.list()).keys || []; } catch (e) { /* liste de secours */ }
  if (!cles.length) cles = CLES_SAUVEGARDE;
  const data = {};
  for (const k of cles) {
    if (HORS_SAUVEGARDE.includes(k)) continue;
    try { const r = await window.storage.get(k); if (r && r.value != null) data[k] = r.value; } catch (e) { /* clé ignorée */ }
  }
  const sortie = JSON.stringify({ app: "RECOMP", version: 3, exportedAt: new Date().toISOString(), data }, null, 2);
  const res = await partagerFichier("recomp-sauvegarde-" + aujourdhui() + ".json", sortie, "application/json");
  if (res === "partage" || res === "telecharge") { await DB.set("last-export", aujourdhui()); toast("Sauvegarde créée : " + Object.keys(data).length + " éléments"); }
  else if (res === "erreur") toast("Échec de la sauvegarde", { danger: true });
  return res;
}
async function restaurer(fichier) {
  if (!fichier) return;
  try {
    const p = JSON.parse(await fichier.text()), data = p && (p.data || p), cles = data && typeof data === "object" ? Object.keys(data) : [];
    if (!cles.length || (p.app && p.app !== "RECOMP")) throw new Error("format");
    const quand = p.exportedAt ? " du " + dateJour(isoDe(new Date(p.exportedAt))) : "";
    if (!(await confirmer({ titre: "Restaurer la sauvegarde" + quand + " ?", message: cles.length + " éléments vont remplacer ceux de cet appareil. Ce qui est absent de la sauvegarde n'est pas touché.", oui: "Restaurer" }))) return;
    let n = 0;
    for (const k of cles) {
      try { await window.storage.set(k, typeof data[k] === "string" ? data[k] : JSON.stringify(data[k])); n++; } catch (e) { /* clé ignorée */ }
    }
    toast(n + " éléments restaurés. Redémarrage…");
    setTimeout(() => location.reload(), 900);
  } catch (e) { toast("Fichier invalide : choisis un fichier recomp-sauvegarde-….json.", { danger: true }); }
}

/* Calendrier .ics : réveil, séances et repas aux bons jours */
function calendrierIcs() {
  const pr = profil(), prog = programmeEnCours(), tDays = joursProgramme(prog), rDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !tDays.includes(d));
  const CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const ev = [{ t: "Réveil + créatine", h: pr.reveil, days: [0, 1, 2, 3, 4, 5, 6] }, { t: "Séance RECOMP", h: CRENEAUX[pr.creneau].seance, days: tDays }];
  planDuJour("training").meals.forEach(m => ev.push({ t: m.m, h: m.h, days: tDays }));
  planDuJour("rest").meals.forEach(m => ev.push({ t: m.m, h: m.h, days: rDays }));
  const now = new Date(), loc = d => d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "T" + pad2(d.getHours()) + pad2(d.getMinutes()) + "00";
  let s = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RECOMP//FR\r\nCALSCALE:GREGORIAN\r\n";
  ev.filter(e => e.days.length).forEach((e, i) => {
    const d = new Date(now);
    for (let k = 0; k < 7 && !e.days.includes(d.getDay()); k++) d.setDate(d.getDate() + 1);
    const mn = hEnMin(e.h);
    d.setHours(Math.floor(mn / 60), mn % 60, 0, 0);
    const fin = new Date(d.getTime() + 15 * 60000), regle = e.days.length === 7 ? "FREQ=DAILY" : "FREQ=WEEKLY;BYDAY=" + e.days.map(x => CODES[x]).join(",");
    s += "BEGIN:VEVENT\r\nUID:recomp-" + i + "-" + now.getTime() + "@recomp\r\nDTSTAMP:" + loc(now) + "\r\nDTSTART:" + loc(d) + "\r\nDTEND:" + loc(fin) + "\r\nRRULE:" + regle + "\r\nSUMMARY:" + e.t + "\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:" + e.t + "\r\nTRIGGER:PT0S\r\nEND:VALARM\r\nEND:VEVENT\r\n";
  });
  return s + "END:VCALENDAR\r\n";
}

function appliquerTheme(t) {
  try { localStorage.setItem("recomp_theme", t); } catch (e) { /* facultatif */ }
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "papier" ? "#F0F1EC" : "#0E0E0C");
}
/* Banque : liaison en lecture seule, pour que tes opérations arrivent toutes seules dans Argent */
function SectionBanque() {
  const l = lienBanque(), reste = accesBanqueExpire();
  if (!l?.session) return h(Section, { titre: "Banque" },
    h("p.texte-p", "Relie ton compte pour que tes dépenses arrivent toutes seules dans Argent, déjà classées. Lecture seule : aucun paiement possible. Tes opérations ne sont gardées que sur ce téléphone."),
    h("div.deux-b", h(Bouton, { cl: "plein", onClick: () => Nav.sheet("banque") }, "Relier ma banque"), h(Bouton, { cl: "contour", onClick: collerCodeBanque }, "J'ai un code")));
  const c = (l.comptes || []).find(x => x.uid === l.compte);
  return h(Section, { titre: "Banque" },
    h("p.texte-p", h("b", (l.banque || "Banque") + " reliée"), c ? ", " + c.nom + (c.fin ? " ••" + c.fin : "") : "", ". ",
      reste == null ? "" : reste < 0 ? h("b", "Accès expiré : relie-la à nouveau.") : "Accès valable jusqu'au " + dateJour(l.expire) + (reste <= 10 ? ", pense à le renouveler." : ".")),
    (l.comptes || []).length > 1 && h(Puces, null, l.comptes.map(x => h(Puce, { key: x.uid, actif: x.uid === l.compte, onClick: () => DB.set("banque-lien", { ...l, compte: x.uid, derniere: null }) }, x.nom + (x.fin ? " ••" + x.fin : "")))),
    h("div.deux-b",
      h(Bouton, { cl: "contour", onClick: () => Nav.sheet("banque") }, reste != null && reste <= 10 ? "Renouveler l'accès" : "Relier à nouveau"),
      h(Bouton, { cl: "danger-t", onClick: async () => { if (await confirmer({ titre: "Délier ta banque ?", message: "Les opérations déjà récupérées restent dans Argent.", oui: "Délier" })) delierBanque(); } }, "Délier")));
}
function FeuilleBanque() {
  const [liste, setListe] = useState(null), [err, setErr] = useState(null), [part, setPart] = useState(false);
  useEffect(() => { banquesDispo().then(setListe).catch(e => setErr(e.message)); }, []);
  const aller = async b => { setPart(true); try { await relierBanque(b); } catch (e) { setPart(false); toast("Liaison impossible : " + e.message, { danger: true }); } };
  return h(Feuille, { titre: "Relier ma banque", ton: "argent" },
    h("p.texte-p", "Tu vas valider l'accès dans l'appli de ta banque (pour BNP : Mes Comptes). C'est un accès en ", h("b", "lecture seule"), ", valable 6 mois, que tu peux couper à tout moment."),
    h("p.note", "Le service Enable Banking, agréé pour ça, fait le lien avec ta banque. Tes opérations passent par lui et par ta fonction Netlify, sans y être gardées : elles ne sont enregistrées que sur ce téléphone."),
    err ? h(Vide, null, "Impossible de joindre le service : " + err) : !liste ? h(Vide, null, "Recherche de ta banque…")
      : !liste.length ? h(Vide, null, "BNP Paribas n'est pas proposée pour l'instant.")
      : h("div.choix-v", liste.map(b => h("button.choix-l", { key: b.nom, disabled: part, onClick: () => aller(b) }, h("span", h("b", b.nom), h("small", "Accès en lecture seule")), h(Icone, { n: "fleche", t: 18 })))));
}
/* Notifications « séance arrivée » et « nuit arrivée » */
function InterNotifs() {
  const [charge, setCharge] = useState(false), actif = notifsActives();
  const basculer = async () => { if (charge) return; setCharge(true); try { await (actif ? couperNotifs() : activerNotifs()); } finally { setCharge(false); } };
  return h(Fragment, null,
    h(Interrupteur, { actif, titre: charge ? "Un instant…" : "Me prévenir", sous: "Quand une séance ou ta nuit arrive de ta montre", onClick: basculer }),
    !notifsPossibles() && h("p.note", "Sur iPhone, les notifications ne marchent que si RECOMP est ouverte depuis son icône sur l'écran d'accueil."));
}
/* Montre Polar : liaison par le service AccessLink, pour remplir la saisie du matin */
function SectionPolar() {
  const l = lienPolar();
  return h(Section, { titre: "Montre Polar" },
    l?.jeton ? h(Fragment, null,
      h("p.texte-p", h("b", "Montre reliée"), " depuis le " + dateJour(l.depuis) + ". Dans « Forme du matin », un bouton remplit SNA, VFC, FC et sommeil depuis ta Recharge nocturne."),
      h("p.note", "Ta montre doit d'abord avoir synchronisé la nuit avec l'app Polar Flow."),
      h(InterNotifs),
      h(Bouton, { cl: "danger-t", onClick: async () => { if (await confirmer({ titre: "Délier la montre Polar ?", message: "RECOMP ne pourra plus lire tes nuits. Tes saisies déjà faites restent.", oui: "Délier" })) delierPolar(); } }, "Délier la montre"))
    : h(Fragment, null,
      h("p.texte-p", "Relie ton compte Polar pour remplir la saisie du matin d'un geste. Polar te demandera ton accord ; tes données ne sont stockées que sur ce téléphone."),
      h("div.deux-b",
        h(Bouton, { cl: "plein", onClick: relierPolar }, "Relier ma montre"),
        h(Bouton, { cl: "contour", onClick: collerCodePolar }, "J'ai un code"))));
}

function FeuilleReglages() {
  useDB();
  const pr = profil(), der = DB.get("last-export"), age = der ? ecart(der, aujourdhui()) : null;
  const [espace, setEspace] = useState(null);
  useEffect(() => { navigator.storage?.estimate?.().then(setEspace).catch(() => {}); }, []);
  const theme = pr.theme || "nuit";
  return h(Feuille, { titre: "Réglages" },
    h(Section, { titre: "Tes horaires" },
      h(Puces, null, Object.entries(CRENEAUX).map(([k, c]) => h(Puce, { key: k, actif: pr.creneau === k, onClick: () => setProfil({ creneau: k }) }, c.label + " " + hhmm(c.seance)))),
      h("p.note", "Les repas des jours d'entraînement suivent ce créneau."),
      h("div.deux", h(Champ, { etiquette: "Réveil", valeur: hEnMin(pr.reveil) / 60, texte: hhmm(pr.reveil), mode: "hm", pas: [.25], min: 0, max: 23.9, onChange: v => setProfil({ reveil: minEnH(Math.round(v * 60)) }) }))),
    h(Section, { titre: "Programme" },
      h(Rangee, { ico: "liste", titre: infoProgramme(programmeEnCours()).label, sous: "Changer ou modifier", onClick: () => Nav.sheet("programmes") }),
      h(Rangee, { ico: "repas", titre: "Ma cible calorique", sous: "Âge, taille, activité", onClick: () => Nav.sheet("calories") }),
      h("p.sous-t", "Charges de départ, pour un exercice jamais fait"),
      h(Puces, null, PHASES.map((p, i) => h(Puce, { key: i, actif: (+DB.get("sport-phase") || 0) === i, onClick: () => DB.set("sport-phase", i) }, p.ph + " · " + p.sem)))),
    h(Section, { titre: "Apparence" }, h(Puces, null, [["auto", "Comme le téléphone"], ["nuit", "Nuit"], ["papier", "Papier"]].map(([k, l]) => h(Puce, { key: k, actif: theme === k, onClick: () => { setProfil({ theme: k }); appliquerTheme(k); } }, l)))),
    h(SectionPolar),
    h(SectionBanque),
    h(Section, { titre: "Rappels" },
      h(Rangee, { ico: "calendrier", titre: "Ajouter au calendrier", sous: "Réveil, repas et séances aux bonnes heures", onClick: async () => { const r = await partagerFichier("recomp-routine.ics", calendrierIcs(), "text/calendar"); if (r === "partage" || r === "telecharge") toast("Ouvre le fichier pour l'ajouter à ton calendrier"); } })),
    h(Section, { titre: "Tes données" },
      h("p.texte-p", "Elles vivent uniquement sur ce téléphone. ", h("b", age == null ? "Aucune sauvegarde pour l'instant." : age === 0 ? "Sauvegarde faite aujourd'hui." : "Dernière sauvegarde il y a " + pluriel(age, "jour") + "."), espace?.usage ? " Espace utilisé : " + nb(espace.usage / 1048576) + " Mo." : ""),
      h("div.deux-b",
        h(Bouton, { cl: "plein", onClick: exporter }, "Sauvegarder"),
        h("label.bouton.contour", "Restaurer", h("input", { type: "file", accept: "application/json,.json", style: { display: "none" }, onChange: e => { restaurer(e.target.files?.[0]); e.target.value = ""; } })))));
}
