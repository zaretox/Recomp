"use strict";
/* LE COACH — ce qu'il a à te dire maintenant, par ordre d'importance, et le bilan de la semaine.
 * Un message = { id, t, acts: [{ l, run }] }. Il ne décide jamais seul : il propose, tu tranches. */
const ageSauvegarde = () => { const d = DB.get("last-export"); return d ? ecart(d, aujourdhui()) : null; };
const seanceFaite = iso => DB.get("sport-logs").some(l => l.dateISO === iso) || DB.get("maison-logs").some(l => l.dateISO === iso);

function messagesCoach() {
  const auj = aujourdhui(), n = jourNutrition(auj), r = recuperation(auj), pr = profil();
  const prog = programmeEnCours(), sess = seanceDuJour(auj, prog), heure = new Date().getHours(), msgs = [];
  const salut = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
  const faite = seanceFaite(auj);
  msgs.push({ id: "jour", t: salut + ". " + (sess ? (faite ? sess.label + " est faite. " : "Aujourd'hui : " + sess.label + " à " + hhmm(seanceCreneau()) + ". ") : "Pas de séance aujourd'hui. ") + entier(n.menu.dayTgt) + " kcal à manger." });

  // Sauvegarde : tout vit sur ce téléphone, on la rappelle en haut dès 7 jours
  const ageS = ageSauvegarde();
  if ((ageS == null || ageS > 7) && DB.get("sport-logs").length + DB.get("nutri-logs").length + DB.get("fin-expenses").length > 0 && pr.coachDismiss?.sauvegarde !== auj) msgs.push({
    id: "sauvegarde", t: (ageS == null ? "Aucune sauvegarde pour l'instant" : "Dernière sauvegarde il y a " + ageS + " jours") + " : tes données ne sont que sur ce téléphone. Une minute, et tu ne perds jamais rien.",
    acts: [{ l: "Sauvegarder", run: exporter }, { l: "Ce soir", run: () => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), sauvegarde: auj } }) }],
  });

  // Épargne : le point de la paye passe avant le reste (une fois par mois, quelques jours)
  const pp = pointPaye(), plusTard = id => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), [id]: auj } });
  if (pp?.aVerser && pr.coachDismiss?.epargne !== auj) msgs.push({
    id: "epargne", t: "Ta paye est arrivée. Tes " + euros(pp.montant) + " sont bien partis sur ton livret ?" + (etatEpargne().virement ? "" : " Si ton virement n'est pas encore automatique, fais-le maintenant dans l'appli de ta banque."),
    acts: [{ l: "Oui, c'est fait", run: async () => { await ajouterVersement(pp.montant, "paye"); toast(euros(pp.montant) + " de plus dans ta cagnotte"); } }, { l: "Pas encore", run: () => plusTard("epargne") }],
  });
  if (pp?.restePrec && pr.coachDismiss?.epargneReste !== auj) msgs.push({
    id: "epargneReste", t: "D'après tes dépenses notées, il te restait " + euros(pp.restePrec) + " de ta paye d'avant. Si c'est bien sur ton compte, tu les mets de côté ?",
    acts: [{ l: "Oui, je les vire", run: async () => { await ajouterVersement(pp.restePrec, "reste", pp.avant); toast("Fais le virement de " + euros(pp.restePrec) + " vers ton livret dans l'appli de ta banque"); } },
      { l: "Non, je les garde", run: () => majEpargne(e => ({ ...e, gardes: [...e.gardes, pp.avant] })) }],
  });
  if (pp?.palier && !pp.aVerser) msgs.push({
    id: "epargnePalier", t: "Ça fait 3 mois que tu mets " + euros(pp.montant) + " de côté à chaque paye. On passe à " + euros(pp.nouveau) + " ? Tu le sentiras à peine.",
    acts: [{ l: "Oui, " + euros(pp.nouveau), run: async () => { await DB.set("fin-goal", pp.nouveau); await majEpargne(e => ({ ...e, palier: auj })); toast("Pense à changer ton virement automatique : " + euros(pp.nouveau)); } },
      { l: "Pas maintenant", run: () => majEpargne(e => ({ ...e, palier: auj })) }],
  });

  const bc = bilanCourant(), pv = prevision(bc);
  if (pv && pv.fin < 0 && pv.apres >= 3 && pr.coachDismiss?.rythme !== auj) msgs.push({
    id: "rythme", t: "À ce rythme, tu finiras à −" + euros(-pv.fin) + " le jour de ta paye. Pour l'éviter, vise " + Math.round(pv.cible) + " € par jour jusqu'au " + dateJour(bc.fin) + ".",
    acts: [{ l: "Voir mon budget", run: () => Nav.tab("argent") }, { l: "Compris", run: () => plusTard("rythme") }],
  });
  const accesB = accesBanqueExpire();
  if (accesB != null && accesB <= 7 && pr.coachDismiss?.banque !== auj) msgs.push({
    id: "banque", t: accesB < 0 ? "L'accès à ta banque a expiré : tes dépenses n'arrivent plus toutes seules. Il faut le renouveler (une minute dans l'appli de ta banque)." : "L'accès à ta banque expire " + (accesB === 0 ? "aujourd'hui" : "dans " + pluriel(accesB, "jour")) + ". Renouvelle-le en une minute pour que tes dépenses continuent d'arriver.",
    acts: [{ l: "Renouveler", run: () => Nav.sheet("banque") }, { l: "Plus tard", run: () => plusTard("banque") }],
  });

  if (r && r.score != null) msgs.push({ id: "forme", t: r.conseil, acts: [{ l: "Pourquoi ce score ?", run: () => Nav.sheet("forme") }] });
  else if (!DB.get("recup-logs").some(l => l.dateISO === auj) && heure < 16) msgs.push({ id: "matin", t: "Fais ta saisie du matin : j'adapte ta séance à ta forme.", acts: [{ l: "Saisir maintenant", run: () => Nav.sheet("matin") }] });

  const mal = DB.get("douleur-logs").filter(l => l.dateISO <= auj && ecart(l.dateISO, auj) <= 2 && l.intensite >= 4).sort((a, b) => b.intensite - a.intensite)[0];
  if (mal) msgs.push({ id: "mal", t: "Ton " + mal.zone.toLowerCase() + " te gêne (" + mal.intensite + "/10). Les exercices concernés sont signalés dans ta séance, avec un remplacement possible. Si ça pique, on arrête." });

  const cfg = reglages(), dech = conseilDecharge();
  if (dech.level === "deload" && !cfg.deload && pr.coachDismiss?.deload !== auj) msgs.push({
    id: "deload", t: "Je te conseille une semaine légère : " + dech.raisons.join(", ") + ". Charges −40 %, même nombre de séries.",
    acts: [{ l: "Oui, cette semaine", run: async () => { await DB.set("science-config", { ...cfg, deload: true }); toast("Semaine légère activée : charges −40 %"); } },
      { l: "Pas maintenant", run: () => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), deload: auj } }) }],
  });

  const ry = rythme(), cal = cfgCalories();
  if (ry.nouveau != null && pr.coachDismiss?.deficit !== auj) msgs.push({
    id: "deficit", t: (ry.etat === "vite" ? "Tu perds un peu vite (" : "Ta perte est trop lente (") + nb(ry.pct) + " % par semaine). Je passe ton déficit de " + cal.deficit + " à " + ry.nouveau + " kcal ?",
    acts: [{ l: "Oui, ajuste", run: async () => { await appliquerDeficit(ry.nouveau); toast("Déficit ajusté à " + ry.nouveau + " kcal : ton menu suit"); } },
      { l: "Pas maintenant", run: () => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), deficit: auj } }) }],
  });

  if ([0, 1].includes(new Date().getDay())) msgs.push({ id: "bilan", t: "Ton bilan de la semaine est prêt.", acts: [{ l: "Voir mon bilan", run: () => Nav.sheet("bilan") }] });

  if (Math.abs(n.reste) > 80 && n.facteurReste !== 1 && heure >= 10) {
    const ecartK = Math.round(Math.abs(1 - n.facteurReste) * 100);
    msgs.push({ id: "recale", t: (n.facteurReste < 1 ? "Tu as mangé plus que prévu : je réduis tes prochains repas de " : "Il te reste de la marge : j'augmente tes prochains repas de ") + ecartK + " %. Les grammes sont à jour.", acts: [{ l: "Voir les repas", run: () => Nav.tab("repas") }] });
  }
  if (!pesees().some(p => dansLes(p.dateISO, 3))) msgs.push({ id: "pesee", t: "Pense à te peser au réveil : c'est ce qui me permet d'ajuster ton plan.", acts: [{ l: "Je me pèse", run: () => Nav.sheet("pesee") }] });

  const b = bilanCourant();
  if (b.depasse.length) msgs.push({ id: "enveloppe", t: "Enveloppe dépassée " + (b.civil ? "ce mois-ci" : "depuis ta paye") + " : " + b.depasse.join(", ") + ".", acts: [{ l: "Voir", run: () => Nav.tab("argent") }] });

  const som = sommeil();
  if (heure >= 19) msgs.push({ id: "coucher", t: "Pour tenir 8 h, couche-toi vers " + hhmm(som.coucher) + "." + (som.dette >= 2 ? " Tu as " + dureeHM(som.dette) + " de dette sur 7 nuits." : "") });

  return msgs;
}
function appliquerDeficit(nouveau) {
  return DB.set("nutri-cal-cfg", { ...(DB.get("nutri-cal-cfg") || {}), deficit: nouveau, lastAdjust: aujourdhui() });
}

/* Réponses du coach aux questions rapides */
function repondre(question) {
  const auj = aujourdhui(), n = jourNutrition(auj);
  if (question === "manger") {
    const suiv = n.lignes.find(l => !l.fait), prot = Math.max(0, Math.round(n.menu.dayMacros.p - n.mange.p));
    if (n.reste <= 0) return "Ton compte est plein pour aujourd'hui. S'il faut grignoter : fromage blanc 0 % ou légumes.";
    return "Il te reste " + entier(n.reste) + " kcal et " + prot + " g de protéines." + (suiv ? " Prochain repas : " + suiv.m.m + (suiv.m.altLabel ? " (" + suiv.m.altLabel + ")" : "") + " à " + hhmm(suiv.m.h) + "." : "");
  }
  if (question === "charger") {
    const r = recuperation(auj), s = seanceDuJour(auj, programmeEnCours());
    if (!s || s.prog === "maison") return r?.conseil || "Pas de séance de salle prévue aujourd'hui.";
    const se = seanceParId(s.code), logs = DB.get("sport-logs").filter(l => l.dateISO < auj), cfg = reglages();
    const props = se ? se.exercices.map(ex => ({ ex, p: proposition(logs, s.code, ex, +DB.get("sport-phase") || 0, cfg) })) : [];
    const hausses = props.filter(x => x.p.action === "up");
    if (modeRecup(cfg)) return "Pas de hausse aujourd'hui : ta forme ne le permet pas. Garde tes charges et finis tes séries proprement.";
    return hausses.length ? "Oui, sur " + pluriel(hausses.length, "exercice") + " : " + hausses.map(x => x.ex.nom + " " + nb(x.p.weight) + " kg").join(", ") + "." : "Pas de hausse aujourd'hui : on gagne des reps à charge égale, c'est ce qui prépare la prochaine.";
  }
  return "";
}

/* Bilan des 7 derniers jours comparés aux 7 précédents */
const bilanSemaine = memo(() => {
  const fin = aujourdhui(), dans = (iso, a, b) => { const e = ecart(iso, fin); return e >= a && e < b; };
  const sl = DB.get("sport-logs"), ml = DB.get("maison-logs"), sw = DB.get("natation-logs"), nl = DB.get("nutri-logs");
  const sem = sl.filter(l => dans(l.dateISO, 0, 7)), prec = sl.filter(l => dans(l.dateISO, 7, 14));
  const vol = a => Math.round(a.reduce((s, l) => s + volumeSeance(l), 0));
  const seances = new Set([...sem, ...ml.filter(l => dans(l.dateISO, 0, 7))].map(l => l.dateISO)).size + sw.filter(l => dans(l.dateISO, 0, 7)).length;
  const prevues = joursProgramme(programmeEnCours()).length + nageJours();
  const records = recordsDe(sem);
  const t = tendancePoids(), tFin = t.length ? t[t.length - 1] : null, tAvant = [...t].filter(x => ecart(x.dateISO, fin) >= 7).pop();
  const repas = nl.filter(l => dans(l.dateISO, 0, 7) && l.mealsTotal > 0);
  const apports = []; for (let i = 0; i < 7; i++) { const a = apportsDu(decale(fin, -i)); if (a) apports.push(a); }
  const forme = historiqueForme(7).filter(j => j.score != null), formeP = historiqueForme(14).slice(0, 7).filter(j => j.score != null);
  const nuits = DB.get("recup-logs").filter(l => l.sleep > 0 && dans(l.dateISO, 0, 7));
  return {
    seances, prevues, volume: vol(sem), volumePrec: vol(prec), records, poids: tFin ? arrondi(tFin.t) : null, deltaPoids: tFin && tAvant ? arrondi(tFin.t - tAvant.t) : null,
    suivi: repas.length ? Math.round(moyenne(repas.map(l => l.compliance))) : null, kcal: apports.length ? Math.round(moyenne(apports)) : null,
    forme: forme.length ? Math.round(moyenne(forme.map(j => j.score))) : null, formePrec: formeP.length ? Math.round(moyenne(formeP.map(j => j.score))) : null,
    sommeil: nuits.length ? moyenne(nuits.map(l => l.sleep)) : null, depense: depenses7j(), rythme: rythme(), depenseReelle: depenseReelle(),
  };
});
/* Records de charge dans une liste de séances */
function recordsDe(seances) {
  const tout = DB.get("sport-logs"), out = [];
  seances.forEach(l => (l.exercices || []).forEach(e => {
    if (!e.weight || l.deload) return;
    const avant = tout.filter(x => x.dateISO < l.dateISO).flatMap(x => x.exercices || []).filter(x => x.nom === e.nom && x.weight > 0);
    if (avant.length && e.weight > Math.max(...avant.map(x => x.weight))) out.push({ nom: e.nom, kg: e.weight, dateISO: l.dateISO });
  }));
  return out;
}
/* Mur de régularité : pour chaque jour, séance + repas suivis + saisie du matin */
const regularite = memo(semaines => {
  const fin = aujourdhui(), debut = decale(lundiDe(fin), -7 * (semaines - 1)), jours = [];
  const sp = new Set([...DB.get("sport-logs"), ...DB.get("maison-logs"), ...DB.get("natation-logs")].map(l => l.dateISO));
  const nu = new Set(DB.get("nutri-logs").filter(l => l.compliance >= 80).map(l => l.dateISO)), fo = new Set(DB.get("recup-logs").map(l => l.dateISO));
  for (let i = 0; decale(debut, i) <= fin; i++) {
    const iso = decale(debut, i);
    jours.push({ iso, n: (sp.has(iso) ? 1 : 0) + (nu.has(iso) ? 1 : 0) + (fo.has(iso) ? 1 : 0) });
  }
  return jours;
});
