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
  const faiteNom = (DB.get("sport-logs").find(l => l.dateISO === auj)?.seance) || (DB.get("maison-logs").find(l => l.dateISO === auj) ? "Ta séance maison" : null);
  msgs.push({ id: "jour", t: salut + ". " + (sess ? (faite ? (faiteNom || sess.label) + " est faite. " : "Aujourd'hui : " + sess.label + " à " + hhmm(seanceCreneau()) + ". ") : faite ? (faiteNom || "Ta séance") + " est faite. " : "Pas de séance aujourd'hui. ") + entier(n.menu.dayTgt) + " kcal à manger." });

  // Sauvegarde : tout vit sur ce téléphone, on la rappelle en haut dès 7 jours
  const ageS = ageSauvegarde();
  if ((ageS == null || ageS > 7) && DB.get("sport-logs").length + DB.get("nutri-logs").length + DB.get("fin-expenses").length > 0 && pr.coachDismiss?.sauvegarde !== auj) msgs.push({
    id: "sauvegarde", t: (ageS == null ? "Aucune sauvegarde pour l'instant" : "Dernière sauvegarde il y a " + ageS + " jours") + " : tes données ne sont que sur ce téléphone. Une minute, et tu ne perds jamais rien.",
    acts: [{ l: "Sauvegarder", run: exporter }, { l: "Ce soir", run: () => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), sauvegarde: auj } }) }],
  });

  // Épargne : le point de la paye passe avant le reste (une fois par mois, quelques jours)
  const pp = pointPaye(), plusTard = id => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), [id]: auj } });
  if (pp?.aVerser && pr.coachDismiss?.epargne !== auj) msgs.push({
    id: "epargne", t: "Ta paye est arrivée. Tes " + eurosD(pp.montant) + " sont bien partis sur ton livret ?" + (etatEpargne().virement ? "" : " Si ton virement n'est pas encore automatique, fais-le maintenant dans l'appli de ta banque."),
    acts: [{ l: "Oui, c'est fait", run: async () => { await ajouterVersement(pp.montant, "paye"); toast(euros(pp.montant) + " de plus dans ta cagnotte"); } }, { l: "Pas encore", run: () => plusTard("epargne") }],
  });
  if (pp?.restePrec && pr.coachDismiss?.epargneReste !== auj) msgs.push({
    id: "epargneReste", t: "D'après tes dépenses notées, il te restait " + eurosD(pp.restePrec) + " de ta paye d'avant. Si c'est bien sur ton compte, tu les mets de côté ?",
    acts: [{ l: "Oui, je les vire", run: async () => { await ajouterVersement(pp.restePrec, "reste", pp.avant); toast("Fais le virement de " + euros(pp.restePrec) + " vers ton livret dans l'appli de ta banque"); } },
      { l: "Non, je les garde", run: () => majEpargne(e => ({ ...e, gardes: [...e.gardes, pp.avant] })) }],
  });
  if (pp?.palier && !pp.aVerser) msgs.push({
    id: "epargnePalier", t: "Ça fait 3 mois que tu mets " + eurosD(pp.montant) + " de côté à chaque paye. On passe à " + eurosD(pp.nouveau) + " ? Tu le sentiras à peine.",
    acts: [{ l: "Oui, " + eurosD(pp.nouveau), run: async () => { await DB.set("fin-goal", pp.nouveau); await majEpargne(e => ({ ...e, palier: auj })); toast("Pense à changer ton virement automatique : " + euros(pp.nouveau)); } },
      { l: "Pas maintenant", run: () => majEpargne(e => ({ ...e, palier: auj })) }],
  });

  const bc = bilanCourant(), pv = prevision(bc);
  if (pv && pv.fin < 0 && pv.apres >= 3 && pr.coachDismiss?.rythme !== auj) msgs.push({
    id: "rythme", t: "À ce rythme, tu finiras à −" + eurosD(-pv.fin) + " le jour de ta paye. Pour l'éviter, vise " + eurosD(Math.round(pv.cible)) + " par jour jusqu'au " + dateJour(bc.fin) + ".",
    acts: [{ l: "Voir mon budget", run: () => Nav.tab("argent") }, { l: "Compris", run: () => plusTard("rythme") }],
  });
  const accesB = accesBanqueExpire();
  if (accesB != null && accesB <= 7 && pr.coachDismiss?.banque !== auj) msgs.push({
    id: "banque", t: accesB < 0 ? "L'accès à ta banque a expiré : tes dépenses n'arrivent plus toutes seules. Il faut le renouveler (une minute dans l'appli de ta banque)." : "L'accès à ta banque expire " + (accesB === 0 ? "aujourd'hui" : "dans " + pluriel(accesB, "jour")) + ". Renouvelle-le en une minute pour que tes dépenses continuent d'arriver.",
    acts: [{ l: "Renouveler", run: () => Nav.sheet("banque") }, { l: "Plus tard", run: () => plusTard("banque") }],
  });

  if (r && r.score != null) msgs.push({ id: "forme", t: r.conseil, acts: [{ l: "Pourquoi ce score ?", run: () => Nav.sheet("forme") }] });
  else if (!DB.get("recup-logs").some(l => l.dateISO === auj) && heure < 16) msgs.push({ id: "matin", t: "Fais ta saisie du matin : j'adapte ta séance à ta forme.", acts: [{ l: "Saisir maintenant", run: () => Nav.sheet("matin") }] });

  // La montre a rempli la forme du matin : une soirée particulière à signaler ?
  const lMatin = DB.get("recup-logs").find(l => l.dateISO === auj);
  if (lMatin?.auto === "polar" && !(lMatin.tags || []).length && !lMatin.vu && heure < 14) msgs.push({
    id: "etiquettes", t: "Ta montre a rempli ta forme du matin. Hier soir, quelque chose de particulier (alcool, repas tardif, écrans, stress) ? Ça affine mes conseils.",
    acts: [{ l: "Oui, je le note", run: () => Nav.sheet("matin", { etape: 4 }) }, { l: "Rien à signaler", run: () => DB.set("recup-logs", DB.get("recup-logs").map(l => l.dateISO === auj ? { ...l, vu: true } : l)) }],
  });
  // La nuit vue par la montre : couché bien après l'heure conseillée
  const nuitP = derniereNuit(), debutN = nuitP?.date === auj ? heurePolar(nuitP.debut) : null;
  if (debutN && heure < 14 && pr.coachDismiss?.coucher !== auj) {
    const conseil = hEnMin(sommeil().coucher), couche = hEnMin(debutN), retard = ((couche - conseil + 1440 + 720) % 1440) - 720;
    if (retard >= 45) msgs.push({ id: "coucher", t: "Couché à " + debutN + ", " + (retard >= 90 ? "bien " : "") + "après l'heure conseillée (" + hhmm(sommeil().coucher) + ")" + (nuitP.interruptions >= 1200 ? ", avec " + Math.round(nuitP.interruptions / 60) + " min de réveils" : "") + ". Ce soir, vise " + hhmm(sommeil().coucher) + " : c'est le levier le plus simple pour ta forme.",
      acts: [{ l: "Voir ma nuit", run: () => allerRubrique("corps", "forme") }, { l: "Compris", run: () => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), coucher: auj } }) }] });
  }
  // La charge calculée par la montre
  const chP = derniereCharge(), stP = chP && ecart(chP.date, auj) <= 2 ? statutCharge(chP.statut) : null;
  if (stP?.t === "surcharge" && pr.coachDismiss?.surcharge !== auj) msgs.push({
    id: "surcharge", t: "Ta montre voit une surcharge : ces derniers jours, tu en fais plus que ce que ton corps encaisse d'habitude. Garde la séance du jour facile" + (reglages().deload ? "." : ", ou passe en semaine légère."),
    acts: [...(reglages().deload ? [] : [{ l: "Semaine légère", run: async () => { await DB.set("science-config", { ...reglages(), deload: true }); toast("Semaine légère activée : charges −40 %"); } }]),
      { l: "Pas maintenant", run: () => setProfil({ coachDismiss: { ...(pr.coachDismiss || {}), surcharge: auj } }) }],
  });

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

/* COACH IA — Claude, appelé par la fonction Netlify « coach » qui garde la clé.
 * « coach-lien » = { code, actif } : le code d'accès (jamais dans la sauvegarde) et le coach activé. Le budget n'est jamais envoyé.
 * « coach-ia » = { matin: { jour, texte }, bilan: { semaine, texte }, fil: { jour, contexte, messages: [{ role, content }] } }.
 * Il propose seulement : ses actions deviennent des boutons, rien ne change sans toi. */
const COACH_FN = "/.netlify/functions/coach";
const lienCoach = () => DB.get("coach-lien");
const coachIAActif = () => { const l = lienCoach(); return !!(l?.actif && l.code); };
const nouveauCodeCoach = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(24)); return [...b].map(x => a[x % a.length]).join("").replace(/(.{6})(?=.)/g, "$1-"); };

const MESSAGES_ARGENT = ["epargne", "epargneReste", "epargnePalier", "rythme", "banque", "enveloppe"];
/* Le résumé envoyé à chaque demande : forme, nuits, séances, repas, poids, pas. Jamais rien du budget. */
function contexteCoach() {
  const auj = aujourdhui(), L = [], pr = profil();
  const part = (titre, f) => { try { const t = [].concat(f()).filter(Boolean); if (t.length) L.push("## " + titre + "\n" + t.join("\n")); } catch (e) { /* une partie illisible n'empêche pas le reste */ } };
  const jourDe = d => JOURS[jourSem(d)] + " " + dateMini(d);
  part("Aujourd'hui", () => {
    const sess = seanceDuJour(auj, programmeEnCours()), faite = seanceFaite(auj), cfg = reglages(), nage = nagePrevue(auj);
    return [dateLongue(auj) + ", " + new Date().toTimeString().slice(0, 5) + ".",
      "Programme : " + infoProgramme(programmeEnCours()).label + ", séances vers " + hhmm(seanceCreneau()) + ", réveil " + hhmm(pr.reveil) + ".",
      sess ? "Séance prévue : " + sess.label + (faite ? " (faite)" : "") + "." : faite ? "Une séance a été faite aujourd'hui." : "Pas de muscu prévue aujourd'hui.",
      nage ? "Natation prévue : " + nage.name + ", " + entier(nageDistance(nage)) + " m." : null,
      cfg.deload ? "Semaine légère active (charges −40 %)." : null, cfg.recovery ? "Mode récup actif." : null];
  });
  part("Profil", () => { const c = cfgCalories() || {}, cm = parseFloat(DB.get("taille-corps")) || null;
    return [(c.sex === "F" ? "Femme" : "Homme") + (c.age ? ", " + c.age + " ans" : "") + (cm ? ", " + cm + " cm" : "") + ".", pr.objectifKg ? "Poids visé : " + nb1(pr.objectifKg) + " kg." : null]; });
  part("Forme du matin", () => {
    const r = recuperation(auj), e = DB.get("recup-logs").find(l => l.dateISO === auj), s = sommeil();
    const h14 = historiqueForme(14).filter(j => j.score != null).map(j => jourDe(j.iso) + " " + j.score).join(", ");
    return [r?.score != null ? "Score : " + r.score + "/100 (" + r.verdict.t + "). Conseil affiché : " + r.conseil : "Pas encore de score aujourd'hui.",
      r?.parts ? "Détail : " + ORDRE_FACTEURS.filter(k => r.parts[k] != null).map(k => NOM_FACTEUR[k] + " " + Math.round(r.parts[k])).join(", ") + "." : null,
      e ? "Saisie" + (e.auto ? " (remplie par la montre)" : "") + " : SNA " + (e.ans ?? "—") + ", VFC " + (e.rmssd ?? "—") + " ms, FC nocturne " + (e.fc ?? "—") + ", sommeil " + (e.sleep ? dureeHM(e.sleep) : "—") + (e.tags?.length ? ", hier soir : " + e.tags.map(t => (ETIQUETTES.find(x => x[0] === t) || [t, t])[1].toLowerCase()).join(", ") : "") + "." : null,
      h14 ? "Scores des 14 derniers jours : " + h14 + "." : null,
      "Sommeil sur 7 nuits : moyenne " + (s.moyenne ? dureeHM(s.moyenne) : "—") + ", dette " + dureeHM(s.dette) + ", coucher conseillé " + hhmm(s.coucher) + "."];
  });
  part("Dernière nuit (montre)", () => { const n = derniereNuit(); if (!n || ecart(n.date, auj) > 2) return null;
    const hm = x => x != null ? dureeHM(x / 3600) : "—";
    return "Nuit du " + jourDe(n.date) + " : endormi " + (heurePolar(n.debut) || "—") + ", réveillé " + (heurePolar(n.fin) || "—") + ", score Polar " + (n.score ?? "—") + ", profond " + hm(n.profond) + ", paradoxal " + hm(n.paradoxal) + ", léger " + hm(n.leger) + ", réveils " + (n.interruptions != null ? Math.round(n.interruptions / 60) + " min" : "—") + (n.recharge ? ", Recharge nocturne " + STATUTS_RECHARGE[n.recharge] : "") + (n.respiration ? ", respiration " + nb(n.respiration) + "/min" : "") + "."; });
  part("Charge d'entraînement (montre)", () => { const c = derniereCharge(); if (!c || ecart(c.date, auj) > 3) return null; const st = statutCharge(c.statut), d = DB.get("polar-charge") || {};
    const j = Array.from({ length: 14 }, (_, i) => decale(auj, i - 13)).filter(x => d[x]?.charge > 0).map(x => jourDe(x) + " " + Math.round(d[x].charge));
    return ["État : " + (st ? st.t : "inconnu") + ", effort 7 jours " + (c.effort != null ? Math.round(c.effort) : "—") + ", tolérance habituelle " + (c.tolerance != null ? Math.round(c.tolerance) : "—") + ".", j.length ? "Charge par jour : " + j.join(", ") + "." : null]; });
  part("Poids", () => { const t = tendancePoids(), der = t[t.length - 1], ry = rythme(), cp = composition(), cl = cp[cp.length - 1];
    if (!der) return null;
    return ["Tendance " + nb1(der.t) + " kg" + (ry.kg != null ? ", rythme " + signe(ry.kg, 2) + " kg par semaine" : "") + ".",
      "Pesées récentes : " + pesees().slice(-10).map(p => jourDe(p.dateISO) + " " + nb1(p.kg)).join(", ") + ".", cl?.bf != null ? "Masse grasse estimée : " + nb(cl.bf) + " % (" + dateMini(cl.dateISO) + ")." : null]; });
  part("Repas aujourd'hui", () => { const n = jourNutrition(auj), m = n.menu.dayMacros;
    return ["Cible " + entier(n.menu.dayTgt) + " kcal (jour " + (n.dayType === "training" ? "d'entraînement" : "de repos") + "), mangé " + entier(n.mange.kcal) + " kcal, reste " + entier(n.reste) + ".",
      "Macros mangées / visées : protéines " + Math.round(n.mange.p) + "/" + m.p + " g, glucides " + Math.round(n.mange.g) + "/" + m.g + " g, lipides " + Math.round(n.mange.l) + "/" + m.l + " g.",
      "Repas : " + n.lignes.map(l => l.m.h + " " + l.m.m + (l.fait ? " (coché)" : "")).join(", ") + ".",
      n.horsMenu.length ? "Hors menu : " + n.horsMenu.map(f => f.nom + " " + (f.kcal || 0) + " kcal").join(", ") + "." : null]; });
  part("Repas des 7 derniers jours", () => { const j = Array.from({ length: 7 }, (_, i) => decale(auj, i - 7)).map(d => ({ d, kc: apportsDu(d), c: jourNutrition(d).menu.dayTgt })).filter(x => x.kc);
    return j.length ? j.map(x => jourDe(x.d) + " " + entier(x.kc) + "/" + entier(x.c)).join(", ") + " (mangé/cible)." : "Aucun repas coché ces 7 jours."; });
  // Comment l'app calcule la cible : sans ça, le coach ne peut pas expliquer l'écart entre la formule et la réalité
  part("Calories (calculs de l'application)", () => {
    const c = cfgCalories(), bt = objectifs(), dep = depenseReelle(), ry = rythme();
    if (!bt.cal || !c) return "Cible pas encore calculée (âge, taille ou pesée manquants).";
    const act = (ACTIVITES.find(a => a[1] === c.activity) || ["?"])[0];
    return [
      c.depense ? "Dépense de référence : " + entier(c.depense) + " kcal par jour (la dépense réelle mesurée a été adoptée à la place de la formule)."
        : "Dépense estimée par formule : métabolisme de base " + entier(bt.cal.bmr) + " kcal (Mifflin-St Jeor : poids, taille, âge) × activité hors séances « " + act + " » (" + nb(c.activity, 3) + ") = " + entier(bt.cal.tdee) + " kcal par jour. C'est une estimation de départ, souvent trop haute ou trop basse de plusieurs centaines de kcal.",
      "Objectif choisi par l'utilisateur : " + (c.deficit >= 0 ? "−" + c.deficit : "+" + -c.deficit) + " kcal par jour sur cette dépense, d'où une cible de base de " + entier(bt.cal.target) + " kcal (adaptée selon les jours d'entraînement, de repos et de natation).",
      dep.pret ? "Dépense réelle mesurée par l'application : " + entier(dep.kcal) + " kcal par jour (sur " + dep.notes + " jours complets, repas cochés en moyenne " + entier(dep.apports) + " kcal, tendance " + signe(dep.pente, 2) + " kg par semaine)." + (c.depense ? "" : " Écart avec la formule : " + signe(dep.kcal - bt.cal.tdee, 0) + " kcal. Elle peut être adoptée dans Repas → Ma cible.")
        : "Dépense réelle : pas encore assez de jours complets pour la mesurer.",
      ry.kg != null ? "Rythme de la tendance : " + signe(ry.kg, 2) + " kg par semaine (" + signe(ry.pct, 2) + " % du poids), soit un déficit réel d'environ " + entier(Math.max(0, -ry.kg) * KCAL_PAR_KG / 7) + " kcal par jour d'après la balance." : null];
  });
  part("Musculation des 14 derniers jours", () => {
    const l = [...DB.get("sport-logs").map(x => ({ ...x, m: false })), ...DB.get("maison-logs").map(x => ({ ...x, m: true }))].filter(x => ecart(x.dateISO, auj) <= 13 && x.dateISO <= auj).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    if (!l.length) return "Aucune séance.";
    const v = volumeMuscles(7), maux = douleursRecentes(10), rec = recordsDe(DB.get("sport-logs").filter(x => dansLes(x.dateISO, 30)));
    return [...l.map((x, i) => jourDe(x.dateISO) + " : " + (x.m ? "Maison " : "") + x.seance + (x.m ? "" : ", " + nb(volumeSeance(x) / 1000) + " t") + (i >= l.length - 2 && x.exercices ? " (" + x.exercices.filter(e => e.weight || e.reps).map(e => e.nom + " " + (e.sets || "") + "×" + (e.reps || "") + (e.weight ? " à " + nb(e.weight) + " kg" : "")).join(", ") + ")" : "")),
      Object.keys(v).length ? "Séries par muscle sur 7 jours : " + Object.entries(v).filter(([, n]) => n > 0).map(([k, n]) => k + " " + n).join(", ") + "." : null,
      rec.length ? "Records du mois : " + [...new Set(rec.map(r => r.nom + " " + nb(r.kg) + " kg"))].slice(0, 6).join(", ") + "." : null,
      Object.keys(maux).length ? "Douleurs récentes : " + Object.entries(maux).map(([z, x]) => z + " " + x.i + "/10").join(", ") + "." : null];
  });
  part("Natation", () => { const l = [...DB.get("natation-logs")].sort((a, b) => a.dateISO.localeCompare(b.dateISO)).slice(-6);
    return l.length ? l.map(x => jourDe(x.dateISO) + " : " + entier(x.distance) + " m en " + dureeS(x.duree) + (allure(x.distance, x.duree) ? ", " + mmss(Math.round(allure(x.distance, x.duree))) + " aux 100 m" : "") + (x.rpe ? ", effort " + x.rpe + "/10" : "")) : "Aucune nage notée."; });
  part("Cardio de la montre (10 jours)", () => sortiesPolar().filter(x => ecart(x.dateISO, auj) <= 9 && !logDeSortie(x)).map(x => jourDe(x.dateISO) + " : " + nomSortie(x) + ", " + chrono(x.duree) + (x.distance > 0 ? ", " + kmDe(x.distance) + " km" : "") + (x.fcMoy ? ", FC moy. " + x.fcMoy : "")));
  part("Pas", () => { const m = moyennePas(7, decale(auj, -1)), p = pasDu(auj); return p == null && !m ? null : "Aujourd'hui " + (p != null ? entier(p) : "—") + " pas, moyenne 7 jours " + (m ? entier(m.moy) : "—") + ", objectif " + entier(objectifPas()) + "."; });
  // Le budget reste sur le téléphone : aucun montant, aucune dépense, aucune épargne ne part chez le coach IA
  part("Budget", () => "Non transmis : l'utilisateur garde son budget sur son téléphone. Il peut le partager dans la conversation, en pourcentages seulement. Sinon, n'en parle pas de toi-même et n'invente aucun chiffre.");
  // Les messages d'argent du coach habituel restent eux aussi sur le téléphone (et, par sécurité, tout texte avec un montant en euros)
  part("Ce que l'application affiche déjà", () => messagesCoach().filter(m => m.id !== "jour" && !MESSAGES_ARGENT.includes(m.id) && !/€|\bpaye\b|épargne|livret|banque|budget/i.test(m.t)).map(m => "- " + m.t));
  return L.join("\n\n");
}

/* L'argent pour le coach IA, seulement quand tu le demandes : en pourcentages, sans aucun montant ni nom de commerce */
function argentEnPourcentages() {
  const b = bilanCourant(), auj = aujourdhui(), pct = (a, t) => t > 0 ? Math.round(a / t * 100) : 0, L = [];
  if (!b.rev) return "Pas encore de paye notée pour cette période.";
  const total = ecart(b.debut, b.fin) + 1, jour = Math.max(1, Math.min(total, ecart(b.debut, auj) + 1)), dispo = b.rev - b.objectif;
  L.push("Période de paye : jour " + jour + " sur " + total + " (" + pct(jour, total) + " % du temps écoulé).");
  if (dispo > 0) {
    L.push("Engagé : " + pct(b.depenses + b.aVenir, dispo) + " % de ce qui est disponible après l'épargne (dépenses faites et charges fixes à venir).");
    const pv = prevision(b);
    if (pv) L.push(pv.fin >= 0 ? "À ce rythme, il resterait environ " + pct(pv.fin, dispo) + " % du disponible le jour de la paye." : "À ce rythme, il manquerait environ " + pct(-pv.fin, dispo) + " % du disponible avant la paye.");
  }
  const fixes = DB.get("fin-fixes").reduce((a, f) => a + (+f.montant || 0), 0);
  if (fixes > 0) L.push("Charges fixes : " + pct(fixes, b.rev) + " % de la paye.");
  if (b.objectif > 0) {
    const verse = etatEpargne().versements.filter(v => v.dateISO >= b.debut && v.dateISO <= b.fin).reduce((a, v) => a + (+v.montant || 0), 0);
    L.push("Épargne prévue : " + pct(b.objectif, b.rev) + " % de la paye ; versée sur cette période : " + (verse >= b.objectif - 1 ? "en totalité" : verse > 0 ? "en partie (" + pct(verse, b.objectif) + " %)" : "pas encore") + ".");
  }
  const cats = Object.entries(b.parCat).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]), tot = cats.reduce((a, [, v]) => a + v, 0);
  if (cats.length) L.push("Répartition des dépenses : " + cats.slice(0, 6).map(([c, v]) => c + " " + pct(v, tot) + " %" + (b.caps?.[c] > 0 ? " (" + pct(v, b.caps[c]) + " % de son plafond)" : "")).join(", ") + ".");
  // Comparé au même moment de la paye d'avant
  const ps = periodes(), avant = ps[ps.length - 2];
  if (avant) {
    const jusqua = decale(avant.debut, jour - 1), prec = DB.get("fin-expenses").filter(e => e.dateISO >= avant.debut && e.dateISO <= jusqua && e.dateISO <= avant.fin).reduce((a, e) => a + (+e.montant || 0), 0);
    if (prec > 0) L.push("Par rapport au même moment de la paye d'avant : " + signe(pct(b.depenses - prec, prec), 0) + " % de dépenses.");
  }
  const ab = abonnementsReperes().length, rd = repasDehors(b);
  if (ab) L.push(pluriel(ab, "abonnement repéré", "abonnements repérés") + ".");
  if (rd.fois) L.push("Repas commandés ou au restaurant : " + rd.fois + " fois sur cette période.");
  return L.join("\n");
}

/* Les actions que le coach peut proposer : un bouton, et c'est toi qui touches */
const ACTIONS_COACH = {
  semaine_legere: ["Semaine légère", async () => { await DB.set("science-config", { ...reglages(), deload: true }); toast("Semaine légère activée : charges −40 %"); }],
  mode_recup: ["Mode récup", async () => { await DB.set("science-config", { ...reglages(), recovery: true }); toast("Mode récup activé : aucune hausse de charge"); }],
  saisie_matin: ["Ma forme du matin", () => Nav.sheet("matin")],
  pesee: ["Me peser", () => Nav.sheet("pesee")],
  ajouter_aliment: ["Noter un aliment", () => Nav.sheet("aliment", { iso: aujourdhui() })],
  choisir_seance: ["Changer de séance", () => Nav.sheet("choisir")],
  voir_forme: ["Voir ma forme", () => allerRubrique("corps", "forme")],
  voir_semaine: ["Ma semaine de sport", () => allerRubrique("sport", "semaine")],
  voir_repas: ["Mes repas", () => allerRubrique("repas", "jour")],
  voir_budget: ["Mon budget", () => allerRubrique("argent", "budget")],
};
const RE_ACTION = /\[\[action:([a-z_]+)\]\]/g;
const actionsDe = t => [...new Set([...String(t || "").matchAll(RE_ACTION)].map(m => m[1]))].filter(k => ACTIONS_COACH[k]).slice(0, 2);
// Le texte affiché : sans les marques d'action (ni un début de marque pendant qu'elle arrive)
const texteCoach = t => String(t || "").replace(RE_ACTION, "").replace(/\[\[[^\]]*$/, "").trim();

const erreurCoach = (statut, d) => {
  if (d?.message && (d.erreur === "config" || d.erreur === "code")) return d.message;
  if (statut === 404) return "le coach n'est pas encore en ligne : attends la fin de la mise en ligne sur Netlify";
  if (d?.erreur === "anthropic") {
    const m = String(d.detail?.error?.message || "");
    if (d.statut === 401 || d.statut === 403) return "clé Anthropic refusée : vérifie ANTHROPIC_API_KEY dans Netlify";
    if (/credit|billing|balance/i.test(m)) return "plus de crédit sur ton compte Anthropic (ou plafond atteint)";
    if (/workspace/i.test(m)) return "ta clé n'est liée à aucun espace de travail : recrée-la dans « Default »";
    if (d.statut === 429) return "trop de demandes d'un coup : réessaie dans une minute";
    if (d.statut >= 500) return "Claude est très demandé en ce moment : réessaie dans un instant";
    return "Claude a répondu " + d.statut + (m ? " (" + m.slice(0, 120) + ")" : "");
  }
  return "le coach a répondu " + statut;
};

/* Une demande au coach. La réponse arrive par morceaux (onTexte reçoit le texte déjà arrivé). */
async function demanderCoach({ mode, contexte, messages, onTexte }) {
  const l = lienCoach();
  if (!l?.code) throw new Error("coach IA pas encore configuré");
  let r;
  try { r = await fetch(COACH_FN, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "x-coach-code": l.code }, body: JSON.stringify({ mode, contexte, messages }) }); }
  catch (e) { throw new Error("pas de réseau"); }
  if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(erreurCoach(r.status, d)); }
  if (mode === "test") return r.json();
  const lecteur = r.body.getReader(), dec = new TextDecoder();
  let tampon = "", texte = "", fin = null;
  const traiter = bloc => {
    const ligne = bloc.split("\n").find(x => x.startsWith("data:"));
    if (!ligne) return;
    let ev; try { ev = JSON.parse(ligne.slice(5)); } catch (e) { return; }
    if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { texte += ev.delta.text; onTexte?.(texte); }
    else if (ev.type === "message_delta" && ev.delta?.stop_reason) fin = ev.delta.stop_reason;
    else if (ev.type === "error") throw new Error(/overload/i.test(ev.error?.type || "") ? "Claude est très demandé en ce moment : réessaie dans un instant" : "le coach s'est interrompu");
  };
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) break;
    tampon += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let i;
    while ((i = tampon.indexOf("\n\n")) >= 0) { traiter(tampon.slice(0, i)); tampon = tampon.slice(i + 2); }
  }
  if (tampon.trim()) traiter(tampon);
  if (!texte.trim()) throw new Error(fin === "refusal" ? "le coach n'a pas pu répondre à cette demande" : "réponse vide, réessaie");
  // Sans fin annoncée, la réponse a été coupée en route (délai de Netlify, réseau)
  return { texte: texte.trim(), coupe: !fin || fin === "max_tokens" };
}
