"use strict";
/* RÉCUPÉRATION DU MATIN
 * "recup-logs" = [{ id, dateISO, ans (statut SNA −10…+10), rmssd (VFC, ms), fc (FC nocturne), sleep (h), tags? }]
 * Score /100 = moyenne pondérée des facteurs disponibles ; un facteur sans données est retiré et les poids recalculés.
 * Chaque ligne de détail porte son type : m = mesuré, c = calculé, e = estimé. */
const POIDS_FACTEURS = { nerv: .30, sleep: .20, charge: .15, muscle: .15, fc: .10, energy: .10 };
const ORDRE_FACTEURS = ["nerv", "sleep", "charge", "muscle", "fc", "energy"];
const NOM_FACTEUR = { nerv: "Système nerveux", sleep: "Sommeil", charge: "Charge d'entraînement", muscle: "Fatigue musculaire", fc: "FC nocturne", energy: "Énergie" };
const SOMMEIL_CIBLE = 8;
/* Ce qu'on coche le matin à propos de la veille */
const ETIQUETTES = [["alcool", "Alcool"], ["tard", "Repas tardif"], ["ecran", "Écrans tard"], ["stress", "Stress"], ["malade", "Malade"], ["voyage", "Voyage"]];

const verdict = s => s >= 80 ? { t: "Prêt pour une séance intense", court: "prêt", ton: "vert" }
  : s >= 65 ? { t: "Séance normale", court: "séance normale", ton: "vert" }
  : s >= 50 ? { t: "Séance allégée", court: "séance allégée", ton: "jaune" }
  : { t: "Repos actif", court: "repos actif", ton: "rouge" };
const tonFacteur = v => v >= 75 ? "vert" : v >= 55 ? "jaune" : "rouge";

/* Apports d'un jour vus par le score : repas cochés et aliments du journal */
function apportsPourScore(d, prog, nl, swl, sl, bt) {
  const nlog = nl.find(l => l.dateISO === d), foods = DB.get("food-log")[d] || [];
  const dayType = nlog?.dayType || (seanceDuJour(d, prog) ? "training" : "rest");
  const nage = swl.filter(l => l.dateISO === d).reduce((a, l) => a + (l.kcal || 0), 0), menu = menuDuJour(dayType, nage);
  let kc = 0, g = 0;
  menu.meals.forEach((m, i) => {
    const id = MEAL_ID[m.m], mm = menu.mealMacros[i], s = nlog?.mealScale?.[id] || 1;
    if (id && nlog?.meals?.[id]) { kc += kcalMacros(mm) * s; g += mm.g * s; }
  });
  const pl = foods.filter(f => f.plan), ex = foods.filter(f => !f.plan), pk = pl.reduce((a, f) => a + (f.kcal || 0), 0);
  if (pk > kc) { kc = pk; g = pl.reduce((a, f) => a + (f.gl || 0), 0); }
  kc += ex.reduce((a, f) => a + (f.kcal || 0), 0);
  g += ex.reduce((a, f) => a + (f.gl || 0), 0);
  if (kc <= 0) return null;
  const series = sl.filter(l => l.dateISO === d).reduce((a, l) => a + (l.exercices || []).reduce((b, x) => b + seriesDe(x), 0), 0);
  return { kc, g, tgt: menu.dayTgt, gTgt: menu.dayMacros.g, exo: nage + series * .06 * (bt.curW || 100) };
}

/* Score d'un matin (null sans saisie). Seules les données d'avant ce matin comptent. */
const recuperation = memo(iso => {
  const rl = DB.get("recup-logs"), sl = DB.get("sport-logs"), ml = DB.get("maison-logs"), swl = DB.get("natation-logs"), nl = DB.get("nutri-logs"), dl = DB.get("douleur-logs");
  const e = rl.find(l => l.dateISO === iso);
  if (!e) return null;
  const P = {}, det = { nerv: [], sleep: [], charge: [], muscle: [], fc: [], energy: [] }, info = {};
  const hier = decale(iso, -1), avant = rl.filter(l => l.dateISO < iso && ecart(l.dateISO, iso) <= 30);

  // Système nerveux : statut SNA + VFC face à ta zone normale (log de la VFC sur 30 jours, moyenne ± ½ écart-type)
  let vfcS = null;
  if (e.rmssd > 0) {
    const ph = avant.filter(l => l.rmssd > 0);
    if (ph.length >= 5) {
      const ln = ph.map(l => Math.log(l.rmssd)), m = moyenne(ln);
      const sd = Math.max(.03, Math.sqrt(ln.reduce((a, v) => a + (v - m) ** 2, 0) / (ln.length - 1)));
      const sem = rl.filter(l => l.rmssd > 0 && l.dateISO <= iso && ecart(l.dateISO, iso) <= 6);
      const roll = Math.round(Math.exp(moyenne(sem.map(l => Math.log(l.rmssd)))));
      const lo = Math.round(Math.exp(m - sd / 2)), hi = Math.round(Math.exp(m + sd / 2));
      vfcS = borne(75 + 25 * (Math.log(e.rmssd) - m) / sd);
      info.zone = { lo, hi, roll };
      det.nerv.push(["VFC " + e.rmssd + " ms, " + (e.rmssd < lo ? "sous" : e.rmssd > hi ? "au-dessus de" : "dans") + " ta zone normale (" + lo + "–" + hi + " ms). Moyenne 7 j : " + roll + " ms", "m"]);
    } else det.nerv.push(["VFC " + e.rmssd + " ms. Ta zone normale se calcule après 5 matins (" + ph.length + "/5)", "m"]);
  }
  const snaS = typeof e.ans === "number" ? borne(70 + 5 * e.ans) : null;
  if (snaS != null) det.nerv.unshift(["Statut SNA " + signe(e.ans) + " (recharge nocturne)", "m"]);
  const nv = [snaS, vfcS].filter(v => v != null);
  if (nv.length) P.nerv = moyenne(nv);

  // FC nocturne face à ta moyenne sur 30 jours
  if (e.fc > 0) {
    const pf = avant.filter(l => l.fc > 0);
    if (pf.length >= 5) {
      const fm = moyenne(pf.map(l => l.fc)), d = e.fc - fm;
      P.fc = borne(80 - 10 * d);
      det.fc.push([e.fc + " bpm, " + (Math.abs(d) < .5 ? "comme ta moyenne" : signe(d) + " bpm face à ta moyenne de " + nb(fm)), "m"]);
    } else det.fc.push([e.fc + " bpm. Ta moyenne de référence se calcule après 5 matins (" + pf.length + "/5)", "m"]);
  }

  // Sommeil (montre, sinon valeur notée autrefois dans le suivi) : 8 h = 100
  const nTo = nl.find(l => l.dateISO === iso), sh = e.sleep > 0 ? e.sleep : nTo?.sleep > 0 ? +nTo.sleep : null;
  if (sh) {
    P.sleep = borne((sh - 4) / 4 * 100);
    det.sleep.push([dureeHM(sh) + " cette nuit", "m"]);
  }

  // Charge : séries pondérées par la difficulté + circuits + natation, 7 jours face à la moyenne sur 28 jours
  const charges = [
    ...sl.map(l => [l.dateISO, (l.exercices || []).reduce((a, x) => a + seriesDe(x) * ((x.rpe || 7) / 7), 0) * (l.deload ? .6 : 1)]),
    ...ml.map(l => [l.dateISO, (l.exercices || []).reduce((a, x) => a + (x.tours || 0) * .7, 0)]),
    ...swl.map(l => [l.dateISO, (l.duree || 0) / 240 * ((l.rpe || 6) / 7)]),
  ].filter(([d]) => d < iso);
  if (charges.length) {
    const prem = charges.reduce((a, [d]) => d < a ? d : a, iso);
    const aigu = charges.filter(([d]) => ecart(d, iso) <= 7).reduce((a, [, v]) => a + v, 0);
    const chro = charges.filter(([d]) => ecart(d, iso) <= 28).reduce((a, [, v]) => a + v, 0) / 4;
    if (ecart(prem, iso) >= 14 && chro > 0) {
      const r = aigu / chro;
      P.charge = r <= .8 ? 95 : r <= 1.3 ? 90 - (r - .8) * 20 : r <= 1.5 ? 80 - (r - 1.3) * 150 : Math.max(20, 50 - (r - 1.5) * 100);
      det.charge.push(["7 derniers jours : " + nb(r, 2) + " fois ta moyenne sur 28 jours" + (r > 1.3 ? ", pic de charge" : r < .8 ? ", semaine légère" : ""), "c"]);
    } else det.charge.push(["Calcul disponible après 2 semaines d'entraînement enregistrées", "c"]);
  }
  const hierTxt = [];
  sl.filter(l => l.dateISO === hier).forEach(l => {
    const ex = l.exercices || [], n = ex.reduce((a, x) => a + seriesDe(x), 0), rp = ex.filter(x => x.rpe > 0);
    hierTxt.push(l.seance + " (" + n + " séries" + (rp.length ? ", difficulté moyenne " + nb(moyenne(rp.map(x => x.rpe))) : "") + ")");
  });
  ml.filter(l => l.dateISO === hier).forEach(l => hierTxt.push("Maison " + l.seance));
  swl.filter(l => l.dateISO === hier).forEach(l => hierTxt.push(entier(l.distance) + " m de natation"));
  if (hierTxt.length) det.charge.push(["Hier : " + hierTxt.join(", "), "c"]);

  const mediane = v => { const s = [...v].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // Fatigue par région : performance de la dernière séance face à ton niveau des 4 semaines, séance récente, douleurs.
  // Une séance en dessous du niveau habituel est un indice de fatigue, pas une mesure : on prend la médiane des exercices
  // (un seul exercice ne fait pas tout basculer), seulement ceux qui ont au moins 2 séances de référence, avec une pénalité
  // plafonnée, plus faible si la séance d'avant était normale, et qui s'efface en quelques jours.
  const baisseDe = (log, r) => {
    const ref = sl.filter(l => !l.deload && l.dateISO < log.dateISO && ecart(l.dateISO, log.dateISO) <= 28);
    const exos = (log.exercices || []).filter(x => regionDe(x.nom) === r && x.weight > 0 && x.reps > 0).map(x => {
      const seances = ref.filter(l => (l.exercices || []).some(z => z.nom === x.nom && z.weight > 0 && z.reps > 0));
      if (seances.length < 2) return null;
      const best = Math.max(...seances.flatMap(l => l.exercices.filter(z => z.nom === x.nom && z.weight > 0 && z.reps > 0).map(meilleurMax)));
      return best > 0 ? { nom: x.nom, pct: Math.max(-30, Math.min(0, (meilleurMax(x) - best) / best * 100)) } : null;
    }).filter(Boolean);
    return exos.length ? { mediane: mediane(exos.map(e => e.pct)), exos } : null;
  };
  const region = r => {
    const hist = sl.filter(l => !l.deload && l.dateISO < iso && (l.exercices || []).some(x => regionDe(x.nom) === r && seriesDe(x) > 0)).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    const der = hist[0];
    let baisse = null, exosBaisse = [], depuis = null, recent = 0, penalite = 0;
    if (der) {
      depuis = ecart(der.dateISO, iso);
      const mes = der.exercices.filter(x => regionDe(x.nom) === r);
      if (depuis <= 4) {
        const b1 = baisseDe(der, r), b2 = hist[1] ? baisseDe(hist[1], r) : null;
        if (b1) {
          baisse = b1.mediane; exosBaisse = b1.exos.filter(e => e.pct <= -3).sort((a, b) => a.pct - b.pct);
          const confirme = b2 && b2.mediane <= -3 ? 1 : .6;          // deux séances de suite en dessous : indice plus solide
          const efface = Math.max(0, 1 - (depuis - 1) * .25);        // s'efface en 4 jours
          penalite = Math.min(40, -baisse * 3) * confirme * efface;
        }
      }
      const dur = mes.reduce((a, x) => a + seriesDe(x) * ((x.rpe || 7) / 8), 0);
      recent = depuis === 1 ? Math.min(25, dur * 1.2) : depuis === 2 ? Math.min(12, dur * .6) : 0;
    }
    if (ml.some(l => l.dateISO === hier && (REGION_MAISON[l.seance] || []).includes(r))) { recent = Math.max(recent, 8); depuis = 1; }
    const mal = dl.filter(l => l.dateISO <= iso && ecart(l.dateISO, iso) <= 3 && (REGION_DOULEUR[l.zone] || []).includes(r) && l.intensite > 0);
    const pire = mal.length ? mal.reduce((a, l) => l.intensite > a.i ? { i: l.intensite, z: l.zone } : a, { i: 0, z: "" }) : null;
    return { score: borne(95 - penalite - (pire ? pire.i * 5 : 0) - recent), drop: baisse, exosBaisse, since: depuis, pain: pire, has: !!der || !!pire || recent > 0 };
  };
  const legs = region("legs"), upper = region("upper");
  const prog = programmeEnCours(), sess = seanceDuJour(iso, prog), sReg = regionSeance(sess);
  if (legs.has || upper.has) {
    P.muscle = sReg === "legs" ? legs.score : sReg === "upper" ? upper.score : (legs.score + upper.score) / 2;
    [["Jambes", legs], ["Haut du corps", upper]].forEach(([nom, st]) => {
      if (!st.has) return;
      const bouts = [];
      if (st.drop != null) bouts.push(st.drop > -3 ? "dernière séance à ton niveau habituel" : "dernière séance en dessous de ton niveau habituel (" + signe(st.drop) + " % en médiane)");
      if (st.since != null && st.since <= 2) bouts.push("séance il y a " + pluriel(st.since, "jour"));
      if (st.pain) bouts.push("douleur " + st.pain.z.toLowerCase() + " " + st.pain.i + "/10");
      det.muscle.push([nom + " " + Math.round(st.score) + "/100" + (bouts.length ? " : " + bouts.join(", ") : ""), "e"]);
      if (st.drop != null && st.drop <= -3 && st.exosBaisse.length) det.muscle.push(["En dessous : " + st.exosBaisse.slice(0, 3).map(e => e.nom + " " + signe(e.pct, 0) + " %").join(", ") + ". Une machine différente ou une série cochée sans corriger la charge suffit à fausser ce chiffre.", "e"]);
    });
  }
  Object.assign(info, { legs, upper, sess, sReg, prog });

  // Énergie : apports face au plan (3 jours), disponibilité énergétique, glycogène estimé, rythme de perte
  const bt = objectifs();
  const d3 = [1, 2, 3].map(k => apportsPourScore(decale(iso, -k), prog, nl, swl, sl, bt)), a3 = d3.filter(Boolean);
  let eaS = null, glyS = null, rateS = null;
  if (a3.length) {
    const ik = a3.reduce((a, x) => a + x.kc, 0), tk = a3.reduce((a, x) => a + x.tgt, 0), xk = a3.reduce((a, x) => a + x.exo, 0), pct = ik / tk * 100;
    eaS = pct >= 90 ? Math.min(100, 80 + (pct - 90) * 2) : pct >= 75 ? 45 + (pct - 75) * 35 / 15 : Math.max(10, 45 - (75 - pct) * 5);
    info.intake = { pct, n: a3.length, gap: Math.max(0, (tk - ik) / a3.length) };
    det.energy.push(["Apports " + (a3.length > 1 ? "des " + a3.length + " derniers jours" : "d'hier") + " : " + Math.round(pct) + " % de ton plan", "c"]);
    if (bt.lean > 0) det.energy.push(["Disponibilité énergétique ≈ " + nb((ik - xk) / a3.length / bt.lean, 0) + " kcal/kg de masse maigre (plan : " + nb((tk - xk) / a3.length / bt.lean, 0) + ")", "c"]);
  }
  const a2 = d3.slice(0, 2).filter(Boolean);
  if (a2.length) {
    const sHier = sl.filter(l => l.dateISO === hier).reduce((a, l) => a + (l.exercices || []).reduce((b, x) => b + seriesDe(x), 0), 0);
    const jHier = sl.some(l => l.dateISO === hier && (l.exercices || []).some(x => regionDe(x.nom) === "legs" && seriesDe(x) > 0));
    const ratio = a2.reduce((a, x) => a + x.g, 0) / a2.reduce((a, x) => a + x.gTgt, 0) - (sHier >= 15 ? .05 : 0) - (jHier ? .05 : 0);
    glyS = borne(ratio * 100);
    det.energy.push(["Glycogène " + (ratio >= .9 ? "probablement rempli" : ratio >= .7 ? "probablement partiellement diminué" : "probablement bas") + " (glucides des 48 h face à ton plan et à ta séance d'hier)", "e"]);
  }
  const pts = nl.filter(l => l.weight > 0 && l.dateISO <= iso).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map(l => ({ dateISO: l.dateISO, kg: l.weight }));
  if (pts.length >= 3 && ecart(pts[0].dateISO, pts[pts.length - 1].dateISO) >= 10) {
    const rt = rythmeHebdo(pts), cw = moyenneRecente(pts, 7);
    if (rt != null && cw) {
      const pc = rt / cw * 100;
      rateS = pc < -1 ? borne(90 - (-pc - 1) * 80) : pc > -.25 ? 85 : 90;
      det.energy.push(["Poids " + signe(pc) + " % par semaine" + (pc < -1 ? ", perte trop rapide" : ""), "m"]);
    }
  }
  const en = [[eaS, .5], [glyS, .25], [rateS, .25]].filter(([v]) => v != null);
  if (en.length) P.energy = en.reduce((a, [v, w]) => a + v * w, 0) / en.reduce((a, [, w]) => a + w, 0);
  info.eaS = eaS;

  const cles = Object.keys(P);
  if (!cles.length) return { iso, entry: e, score: null, parts: P, det, info };
  const somme = cles.reduce((a, k) => a + POIDS_FACTEURS[k], 0);
  const score = Math.round(cles.reduce((a, k) => a + POIDS_FACTEURS[k] * P[k], 0) / somme);
  const res = { iso, entry: e, score, parts: P, det, info, lowest: cles.slice().sort((a, b) => P[a] - P[b])[0], verdict: verdict(score) };
  res.conseil = conseilForme(res);
  return res;
});

/* Conseil pour la séance prévue */
function conseilForme(r) {
  const s = r.info.sess, { sReg: reg, prog } = r.info, sc = r.score, nage = nagePrevue(r.iso);
  let a;
  if (!s) {
    a = sc < 50 ? "Pas de muscu aujourd'hui : marche, mobilité et coucher tôt." + (nage ? " Natation en allure facile, sans série rapide." : "")
      : "Pas de muscu prévue aujourd'hui." + (nage ? (sc < 65 ? " Natation : garde une allure facile, sans série rapide." : " Natation prévue : feu vert.") : " Marche et mobilité suffisent.");
  } else {
    const st = reg === "legs" ? r.info.legs : reg === "upper" ? r.info.upper : null, leger = "une série de moins par exercice, difficulté 7 maximum";
    if (sc < 50) a = "Repos actif : 30 à 40 min de marche ou de natation souple, puis mobilité. Décale " + s.label + " si ton planning le permet.";
    else if (st && st.has && st.score < 55) {
      let alt = null;
      for (let d = 1; d <= 6 && !alt; d++) {
        const o = seanceDuJour(decale(r.iso, d), prog), oR = regionSeance(o);
        if (o && oR && oR !== reg && oR !== "both") alt = { o, d };
      }
      const zone = reg === "legs" ? "tes jambes" : "ton haut du corps", Zone = reg === "legs" ? "Tes jambes" : "Ton haut du corps";
      const cause = st.pain ? Zone + " te fait mal" : st.drop != null && st.drop <= -3 ? "Ta dernière séance pour " + zone + " était en dessous de ton niveau habituel" : Zone + " a travaillé il y a peu";
      a = cause + " (" + Math.round(st.score) + "/100). " +
        (alt ? "Si ton planning le permet, inverse : " + alt.o.label + " aujourd'hui, " + s.label + " " + (alt.d === 1 ? "demain" : dateLongue(decale(r.iso, alt.d)).split(" ")[0]) + ". Sinon, fais " : "Fais ") +
        s.label + " avec " + leger + (st.pain ? ", et surveille ton " + st.pain.z.toLowerCase() : "") + ".";
    } else if (sc < 65) a = s.label + " allégée : " + leger + ", charges du coach inchangées.";
    else if (sc < 80) a = s.label + " normale : charges du coach, difficulté 8 maximum, pas de record aujourd'hui.";
    else a = "Feu vert pour " + s.label + " : charges du coach, vise le haut de ta fourchette de reps.";
  }
  if (r.info.eaS != null && r.info.eaS < 50 && r.info.intake) a += " Mange ton plan complet aujourd'hui : il te manque environ " + Math.round(r.info.intake.gap / 10) * 10 + " kcal par jour.";
  if (sc < 50) a += " Aucune hausse de charge aujourd'hui.";
  return a;
}

/* Scores des n derniers matins, du plus ancien au plus récent */
const historiqueForme = memo(n => {
  const out = [], fin = aujourdhui();
  for (let i = n - 1; i >= 0; i--) {
    const iso = decale(fin, -i), r = recuperation(iso);
    out.push({ iso, score: r?.score ?? null, entry: r?.entry || null });
  }
  return out;
});

/* SOMMEIL — dette sur 7 nuits et heure de coucher conseillée pour demain */
const sommeil = memo(() => {
  const fin = aujourdhui(), nuits = DB.get("recup-logs").filter(l => l.sleep > 0 && ecart(l.dateISO, fin) <= 6 && ecart(l.dateISO, fin) >= 0);
  const dette = nuits.reduce((a, l) => a + (SOMMEIL_CIBLE - l.sleep), 0);
  const rattrapage = borne(Math.round(Math.max(0, dette) * 10), 0, 30);  // 30 min de plus au maximum
  const coucher = hEnMin(profil().reveil) - SOMMEIL_CIBLE * 60 - 15 - rattrapage;
  return { nuits: nuits.length, dette: Math.max(0, dette), moyenne: nuits.length ? moyenne(nuits.map(l => l.sleep)) : null, coucher: minEnH(coucher) };
});

/* CE QUI JOUE SUR TA FORME — compare les matins avec et sans une habitude (au moins 3 matins de chaque côté) */
const influences = memo(() => {
  const jours = historiqueForme(60).filter(j => j.score != null && j.entry);
  const test = (nom, cond) => {
    const oui = jours.filter(cond), non = jours.filter(j => !cond(j));
    if (oui.length < 3 || non.length < 3) return null;
    return { nom, ecart: Math.round(moyenne(oui.map(j => j.score)) - moyenne(non.map(j => j.score))), n: oui.length };
  };
  const nut = d => DB.get("nutri-logs").find(l => l.dateISO === d);
  const lourd = d => DB.get("sport-logs").some(l => l.dateISO === d && (l.exercices || []).some(x => regionDe(x.nom) === "legs" && seriesDe(x) > 0));
  const tests = [
    test("Une nuit de 7 h 30 ou plus", j => j.entry.sleep >= 7.5),
    test("Tes repas suivis la veille", j => (nut(decale(j.iso, -1))?.compliance || 0) >= 80),
    test("Une séance jambes la veille", j => lourd(decale(j.iso, -1))),
    ...ETIQUETTES.map(([k, l]) => test(l + " la veille", j => (j.entry.tags || []).includes(k))),
  ].filter(Boolean).filter(x => Math.abs(x.ecart) >= 3).sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
  return { liste: tests.slice(0, 4), matins: jours.length };
});
