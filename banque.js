"use strict";
/* BANQUE — tes opérations BNP arrivent toutes seules dans Argent, en lecture seule, via Enable Banking
 * et la fonction Netlify « banque » (qui garde la clé et ne stocke rien).
 * « banque-lien » = { session, comptes, compte, banque, depuis, expire, derniere, solde } : reste sur ce téléphone, jamais sauvegardé.
 * « banque-regles » = { regles: [{ motif, cat }], ignores: [ref] } : tes règles de classement et les opérations retirées.
 * Une opération importée porte le champ « banque » (sa référence) : c'est ce qui évite les doublons. */
const BANQUE_FN = "/.netlify/functions/banque";
const lienBanque = () => DB.get("banque-lien");
const reglesBanque = () => ({ regles: [], ignores: [], ...(DB.get("banque-regles") || {}) });

async function appelBanque(action, o = {}) {
  const r = await fetch(BANQUE_FN + "?action=" + action + (o.q ? "&" + new URLSearchParams(o.q) : ""), {
    method: o.corps ? "POST" : "GET", cache: "no-store",
    ...(o.corps ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(o.corps) } : {}),
  });
  const d = await r.json().catch(() => null);
  if (r.status === 401) throw new Error("accès expiré : relie à nouveau ta banque dans Réglages");
  if (!r.ok) throw new Error(d?.message || d?.detail?.message || d?.detail?.error || d?.erreur || "erreur " + r.status);
  return d;
}

/* 1. Liaison : on part chez la banque valider l'accès (dans l'appli BNP Mes Comptes) */
const banquesDispo = () => appelBanque("banques").then(d => d.banques || []);
async function relierBanque(b) {
  const etat = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem("recomp_banque_etat", etat); } catch (e) { /* le code sera à recopier */ }
  const d = await appelBanque("lier", { corps: { banque: b.nom, duree: b.duree, state: etat } });
  location.href = d.url;
}
async function finirLiaisonBanque(code) {
  const d = await appelBanque("session", { corps: { code } });
  try { localStorage.removeItem("recomp_banque_etat"); } catch (e) { /* rien */ }
  // Le compte courant d'abord (CACC), sinon le premier
  const compte = (d.comptes.find(c => c.type === "CACC") || d.comptes[0])?.uid || null;
  await DB.set("banque-lien", { session: d.session, comptes: d.comptes, compte, banque: d.banque, depuis: aujourdhui(), expire: d.expire ? d.expire.slice(0, 10) : null, derniere: null, solde: null });
  const n = await importerBanque().catch(() => null);
  toast("Banque reliée" + (n?.nouvelles ? " : " + pluriel(n.nouvelles, "opération") + " récupérée" + (n.nouvelles > 1 ? "s" : "") : ""));
}
async function collerCodeBanque() {
  const code = window.prompt("Colle le code de liaison affiché après l'accord de ta banque :");
  if (!code || !code.trim()) return;
  try { await finirLiaisonBanque(code.trim()); } catch (e) { toast("Liaison refusée : " + e.message, { danger: true }); }
}
function codeBanqueDansAdresse() {
  const p = new URLSearchParams(location.search), code = p.get("banque_code");
  if (!code) return;
  history.replaceState(null, "", location.pathname);
  finirLiaisonBanque(code).catch(e => toast("Liaison bancaire impossible : " + e.message, { danger: true }));
}
async function delierBanque() {
  const l = lienBanque();
  if (l?.session) { try { await appelBanque("delier", { corps: { session: l.session } }); } catch (e) { /* on délie quand même ce téléphone */ } }
  await DB.set("banque-lien", null);
  toast("Banque déliée. Tes opérations déjà récupérées restent.");
}

/* 2. Libellés et classement */
const majuscSansAccent = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
function libelleDe(t) {
  const nom = t.credit_debit_indicator === "DBIT" ? t.creditor?.name : t.debtor?.name;
  let l = String(nom || (t.remittance_information || []).join(" ") || t.bank_transaction_code?.description || "Opération").replace(/\s+/g, " ").trim();
  if (/^RETRAIT\s+(DAB|GAB)/i.test(l)) return "Retrait d'espèces";
  if (/CPTE A CPTE|COMPTE A COMPTE/i.test(l)) return t.credit_debit_indicator === "CRDT" ? "Virement depuis ton épargne" : "Virement vers ton épargne";
  // Virements BNP : « /DE nom », « /BEN nom », « /MOTIF texte » : on garde le nom, sinon le motif
  if (!nom && /^VIR/i.test(l)) {
    const champ = k => (l.match(new RegExp("\\/" + k + ":?\\s+([^/]+)", "i")) || [])[1]?.trim();
    const qui = t.credit_debit_indicator === "CRDT" ? champ("DE") : champ("BEN"), motif = champ("MOTIF");
    if (qui || motif) return (t.credit_debit_indicator === "CRDT" ? "" : "Virement à ") + lisible(qui || motif);
  }
  if (/COTISATION|OFFRE GROUPEE|COMMISSIONS?\b|FRAIS (BANCAIRES|DE TENUE)|AGIOS/i.test(l)) return "Frais bancaires";
  l = l.replace(/^(FACTURE|PAIEMENT|ACHAT)\s+(PAR\s+)?CARTE(\s+X?\d{4})?\s*/i, "").replace(/^PRLV\s+(SEPA\s+)?/i, "")
    .replace(/^VIR(EMENT)?\s+(SEPA\s+)?(INST(ANTANE)?\s+)?(RECU|EMIS)?\s*(\/?DE:?\s*|\/?POUR:?\s*)?/i, "")
    .replace(/\bDU\s+\d{6}\b/g, "").replace(/\bCARTE\s+[X\d*]{4,}\b/gi, "").replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, "")
    .replace(/\s\/.*$/, "").replace(/\s{2,}/g, " ").trim();
  l = sansRefSepa(l);
  if (!l) return "Opération";
  return lisible(l);
}
// Les banques écrivent en majuscules : on rend le libellé lisible
const lisible = l => l.length > 3 && l === l.toUpperCase() ? l.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).slice(0, 48) : l.slice(0, 48);
// Règles toutes prêtes ; tes propres règles passent avant
const REGLES_DEFAUT = [
  [/FRAIS BANCAIRES|COTISATION|OFFRE GROUPEE|AGIOS|COMMISSION/, "Banque"],
  [/RETRAIT D.ESPECES|RETRAIT (DAB|GAB)/, "Espèces"],
  [/IMPOT|DGFIP|TRESOR PUBLIC|FINANCES PUBLIQUES|\bTAXE|ANTAI|AMENDE/, "Impôts"],
  [/CARREFOUR|LECLERC|AUCHAN|LIDL|INTERMARCHE|MONOPRIX|FRANPRIX|ALDI|CASINO|SUPER U|HYPER U|PICARD|GRAND FRAIS|NETTO|BIOCOOP|LEADER PRICE|PROXI|SPAR/, "Courses"],
  [/MC ?DO|MCDONALD|BURGER KING|KFC|QUICK|UBER ? EATS|DELIVEROO|JUST EAT|RESTAU|BRASSERIE|PIZZ|SUSHI|KEBAB|TACOS|STARBUCKS|COLUMBUS|BAR |CAFE/, "Sorties"],
  [/LOYER|EDF|ENGIE|TOTALENERGIES ELEC|VEOLIA|SUEZ/, "Logement"],
  [/PHARMA|DOCTOLIB|MEDECIN|DOCTEUR|DENTISTE|LABO|MUTUELLE|CPAM|AMELI|\bALAN\b/, "Santé"],
  [/ASSURANCE|\bASSUR|AVANSSUR|\bAXA\b|MAAF|MACIF|MATMUT|GROUPAMA|\bMAIF\b|\bGMF\b|\bMMA\b|ALLIANZ|GENERALI|AVIVA|PACIFICA|LEOCARE|\bLUKO\b|HISCOX|\bAPRIL\b/, "Assurances"],
  [/TOTAL|ESSO|SHELL|\bBP\b|AVIA|SNCF|RATP|NAVIGO|UBER|BOLT|BLABLA|PEAGE|AUTOROUTE|VINCI|SANEF|APRR|PARKING|INDIGO|TCL|TISSEO/, "Transport"],
  [/NETFLIX|SPOTIFY|DISNEY|PRIME VIDEO|AMAZON PRIME|CANAL|DEEZER|APPLE\.COM|ICLOUD|GOOGLE ?\*|YOUTUBE|FREE MOBILE|FREE TELECOM|SFR|ORANGE|BOUYGUES|SOSH|RED BY|CHATGPT|OPENAI|CRUNCHYROLL/, "Abonnements"],
  [/DECATHLON|BASIC ?FIT|FITNESS|KEEP COOL|ON AIR|PISCINE|INTERSPORT|GO SPORT|POLAR/, "Sport"],
  [/ZARA|H ?& ?M|KIABI|CELIO|JULES|PRIMARK|UNIQLO|BERSHKA|PULL ?& ?BEAR|ZALANDO|VINTED/, "Vêtements"],
  [/SMARTBOX|WONDERBOX|INTERFLORA|CADEAU/, "Cadeaux"],
  [/AMAZON|FNAC|DARTY|BOULANGER|STEAM|PLAYSTATION|NINTENDO|XBOX|CINEMA|UGC|PATHE|GAUMONT|CULTURA|LEROY|IKEA|ACTION/, "Loisirs"],
];
// Codes de commerce (MCC) quand le libellé ne dit rien
const MCC = [[/^54(11|22|99)$/, "Courses"], [/^58(12|13|14)$/, "Sorties"], [/^(554[12]|4111|4121|4131|4784|7523)$/, "Transport"], [/^(4814|4899|5815|5817|5818)$/, "Abonnements"],
  [/^(5912|80\d\d)$/, "Santé"], [/^(5941|7997|7941)$/, "Sport"], [/^(56\d\d)$/, "Vêtements"], [/^(4900|6300)$/, "Logement"], [/^(5732|5734|5735|5942|5945|7832|7996)$/, "Loisirs"]];
function categorieDe(libelle, mcc) {
  const L = majuscSansAccent(libelle);
  const perso = reglesBanque().regles.find(r => r.motif && L.includes(majuscSansAccent(r.motif)));
  if (perso) return perso.cat;
  const d = REGLES_DEFAUT.find(([re]) => re.test(L));
  if (d) return d[1];
  const m = mcc && MCC.find(([re]) => re.test(String(mcc)));
  return m ? m[1] : "Autre";
}
// Apprendre : « toujours classer ce commerce dans cette catégorie »
async function apprendreRegle(libelle, cat) {
  const motif = String(libelle || "").trim().split(/\s+/).slice(0, 2).join(" ");
  if (!motif) return;
  const r = reglesBanque(), M = majuscSansAccent(motif);
  await DB.set("banque-regles", { ...r, regles: [{ motif, cat }, ...r.regles.filter(x => majuscSansAccent(x.motif) !== M)] });
  // Les opérations de ce commerce encore « à classer » suivent tout de suite
  const dep = DB.get("fin-expenses");
  if (dep.some(e => e.banque && e.cat === "Autre" && majuscSansAccent(e.label).includes(M))) await DB.set("fin-expenses", dep.map(e => e.banque && e.cat === "Autre" && majuscSansAccent(e.label).includes(M) ? { ...e, cat } : e));
}
const RE_PAYE = /SALAIRE|\bPAIE\b|\bPAYE\b|REMUNERATION|TRAITEMENT/;
const RE_EPARGNE = /LIVRET|\bLDDS?\b|\bLEP\b|EPARGNE/;
// Virement entre tes propres comptes (chez BNP : « VIR CPTE A CPTE ») ou vers un livret : de l'épargne, pas une dépense ni un revenu
const RE_INTERNE = /CPTE A CPTE|COMPTE A COMPTE/;
const estEpargne = (L, montant) => RE_INTERNE.test(L) || (RE_EPARGNE.test(L) && /VIR|VERSEMENT/.test(L))
  || (/VIR(EMENT)? PERMANENT/.test(L) && montantParPaye() > 0 && Math.abs(montant - montantParPaye()) <= 1);

/* 3. Import : les opérations comptabilisées, sans doublons, fusionnées avec ce que tu avais noté à la main */
async function lireOperations(l, du) {
  const toutes = [];
  let suite = null;
  for (let i = 0; i < 15; i++) {
    const d = await appelBanque("lire", { q: { session: l.session, compte: l.compte, quoi: "operations", du, ...(suite ? { suite } : {}) } });
    toutes.push(...(d?.transactions || []));
    suite = d?.continuation_key;
    if (!suite) break;
  }
  return toutes;
}
// Le solde affiché : « à venir » (paiements en cours déduits), comme dans l'appli de ta banque
const ORDRE_SOLDES = ["XPCD", "ITBD", "CLBD", "ITAV", "CLAV", "OTHR"];
// Empreinte d'une opération : même jour, même sens, même montant, même commerce (sert à repérer une opération déjà là sous une autre référence)
const empreinte = (dateISO, sens, montant, libelle) => dateISO + "|" + sens + "|" + (+montant).toFixed(2) + "|" + cleCommerce(libelle || "");
const empreinteDe = (x, sens) => empreinte(x.dateISO, sens, x.montant, x.brut || x.label || x.source);
const periodeDe = iso => periodes().find(p => iso >= p.debut && iso <= p.fin) || null;
let importBanqueEnCours = null;
const importerBanque = () => importBanqueEnCours || (importBanqueEnCours = importerBanque1().finally(() => { importBanqueEnCours = null; }));
async function importerBanque1() {
  const l = lienBanque();
  if (!l?.session || !l.compte) throw new Error("banque non reliée");
  const auj = aujourdhui(), du = l.derniere ? decale(l.derniere, -10) : decale(auj, -62);
  const [ops, soldes] = await Promise.all([lireOperations(l, du), appelBanque("lire", { q: { session: l.session, compte: l.compte, quoi: "soldes" } }).catch(() => null)]);

  // Copies : rien n'est modifié tant que tout n'est pas prêt. Les opérations « en cours » relues sont retirées : la banque les renvoie si elles le sont encore.
  const garder = x => !(x.attente && x.dateISO >= du);
  const dejaEnCours = new Set([...DB.get("fin-expenses"), ...DB.get("fin-income")].filter(x => !garder(x)).map(x => x.banque));
  const dep = DB.get("fin-expenses").filter(garder).map(x => ({ ...x })), inc = DB.get("fin-income").filter(garder).map(x => ({ ...x }));
  const ep0 = etatEpargne(), ep = { ...ep0, versements: ep0.versements.map(x => ({ ...x })) };
  let epChange = false;
  const { ignores } = reglesBanque(), fixes = DB.get("fin-fixes"), p = periodeCourante();
  const connues = new Set([...dep, ...inc, ...ep.versements].map(x => x.banque).filter(Boolean).concat(ignores));
  const proche = (a, c, j = 3) => Math.abs(ecart(a, c)) <= j;
  // Empreintes déjà présentes (opérations de la banque), pour ne pas doubler après une nouvelle liaison
  const deja = {};
  [...dep.filter(x => x.banque).map(x => empreinteDe(x, "D")), ...inc.filter(x => x.banque).map(x => empreinteDe(x, "C"))].forEach(k => { deja[k] = (deja[k] || 0) + 1; });
  const prep = ops.map(t => {
    const montant = Math.abs(+t.transaction_amount?.amount || 0), dateISO = (t.transaction_date || t.booking_date || t.value_date || auj).slice(0, 10);
    const libelle = libelleDe(t), L = majuscSansAccent(libelle + " " + (t.remittance_information || []).join(" ")), sens = t.credit_debit_indicator === "CRDT" ? "C" : "D";
    const ref = t.entry_reference || t.transaction_id || [dateISO, sens, montant, L.slice(0, 30)].join("|");
    return { t, montant, dateISO, libelle, L, sens, ref, k: empreinte(dateISO, sens, montant, libelle), attente: !!t.status && t.status !== "BOOK" };
  }).filter(o => o.montant);
  prep.forEach(o => { if (connues.has(o.ref)) { o.connue = true; if (deja[o.k]) deja[o.k]--; } });
  let n = 0, enCours = { n: 0, debits: 0, credits: 0 }, id = Date.now();
  for (const o of prep) {
    if (o.attente) { enCours.n++; o.sens === "D" ? enCours.debits += o.montant : enCours.credits += o.montant; }
    if (o.connue) continue;
    if (deja[o.k] > 0) { deja[o.k]--; continue; } // même opération, déjà là sous une autre référence
    const { t, montant, dateISO, libelle, L, ref } = o, en = o.attente ? { attente: true } : {};
    connues.add(ref); if (!dejaEnCours.has(ref)) n++;
    // Argent repris de ton épargne : la cagnotte baisse, ce n'est pas un revenu
    if (o.sens === "C" && estEpargne(L, montant)) {
      if (o.attente) continue;
      ep.versements.push({ id: id++, dateISO, montant: -montant, source: "retrait", banque: ref });
      epChange = true;
      continue;
    }
    if (o.sens === "C") {
      const main = inc.find(x => !x.banque && Math.abs(x.montant - montant) < .01 && proche(x.dateISO, dateISO));
      if (main) Object.assign(main, { banque: ref, brut: libelle, ...en });
      else inc.push({ id: id++, dateISO, montant, source: libelle, brut: libelle, banque: ref, ...en, ...(RE_PAYE.test(L) ? { paye: true } : {}) });
      continue;
    }
    // Virement vers ton livret : c'est de l'épargne, pas une dépense (une fois passé)
    if (estEpargne(L, montant)) {
      if (o.attente) continue;
      const v = ep.versements.find(x => !x.banque && Math.abs(x.montant - montant) < .01 && proche(x.dateISO, dateISO, 10));
      if (v) v.banque = ref;
      else ep.versements.push({ id: id++, dateISO, montant, source: dateISO >= p.debut && !ep.versements.some(x => x.source === "paye" && x.dateISO >= p.debut) ? "paye" : "main", banque: ref });
      epChange = true;
      continue;
    }
    const main = dep.find(x => !x.banque && !x.fixId && Math.abs(x.montant - montant) < .01 && proche(x.dateISO, dateISO));
    if (main) { Object.assign(main, { banque: ref, brut: libelle, ...en }); continue; }
    // Charge fixe reconnue (même montant à 3 % près, ou son nom dans le libellé), si la banque ne l'a pas déjà prélevée ces 20 jours
    const f = fixes.find(x => (Math.abs(x.montant - montant) <= Math.max(1, x.montant * .03) || L.includes(majuscSansAccent(x.label))) && Math.abs(x.montant - montant) <= x.montant * .2
      && !dep.some(e => e.banque && e.fixId === x.id && proche(e.dateISO, dateISO, 20)));
    dep.push({ id: id++, dateISO, montant, cat: f?.cat || categorieDe(libelle, t.merchant_category_code), label: f ? f.label : libelle, brut: libelle, banque: ref, ...en, ...(f ? { fixId: f.id } : {}) });
  }
  // Opérations déjà là : libellé de prélèvement nettoyé, et celles « à classer » que les règles reconnaissent maintenant
  let retouches = 0;
  dep.forEach(x => {
    if (!x.banque) return;
    const c = x.label && sansRefSepa(x.label);
    if (c && c !== x.label) { x.label = c; retouches++; }
    if (x.cat === "Autre") { const k = categorieDe(x.label || ""); if (k !== "Autre") { x.cat = k; retouches++; } }
  });
  inc.forEach(x => { const c = x.banque && x.source && sansRefSepa(x.source); if (c && c !== x.source) { x.source = c; retouches++; } });
  const fusion = fusionnerManuels(dep, inc);
  // Solde « à venir » : celui donné par la banque, sinon le solde comptable moins les paiements en cours
  const rang = x => { const i = ORDRE_SOLDES.indexOf(x.balance_type); return i < 0 ? 99 : i; };
  const liste = [...(soldes?.balances || [])].sort((x, y) => rang(x) - rang(y)), b = liste[0];
  let solde = l.solde;
  if (b) {
    const brut = +b.balance_amount?.amount || 0;
    solde = { montant: b.balance_type === "XPCD" ? brut : arrondi(brut - enCours.debits + enCours.credits, 2), date: auj };
  }
  const changes = n || fusion || retouches || DB.get("fin-expenses").length !== dep.length || DB.get("fin-income").length !== inc.length;
  if (changes) { await DB.set("fin-expenses", dep); await DB.set("fin-income", inc); }
  if (epChange) await DB.set("epargne", ep);
  await DB.set("banque-lien", { ...lienBanque(), derniere: auj, solde, soldes: liste.map(x => ({ type: x.balance_type, montant: +x.balance_amount?.amount || 0 })), enCours });
  try { localStorage.setItem("recomp_banque_import", String(Date.now())); } catch (e) { /* facultatif */ }
  return { nouvelles: n, solde };
}
/* Ce que tu avais noté à la main et que la banque a maintenant : on garde la version de la banque (montant exact),
 * avec ton libellé et ta catégorie. Une charge fixe cochée à la main laisse la place au prélèvement de la même période. */
function fusionnerManuels(dep, inc) {
  const proche = (a, c, j) => Math.abs(ecart(a, c)) <= j, pris = new Set();
  let n = 0;
  const incB = inc.filter(x => x.banque);
  for (let i = inc.length - 1; i >= 0; i--) {
    const m = inc[i];
    if (m.banque) continue;
    const b = incB.find(x => !pris.has(x) && proche(x.dateISO, m.dateISO, 5) && (Math.abs(x.montant - m.montant) <= x.montant * .05 || (m.paye && (x.paye || x.montant >= m.montant * .5))));
    if (!b) continue;
    pris.add(b); if (m.paye) b.paye = true; inc.splice(i, 1); n++;
  }
  const depB = dep.filter(x => x.banque);
  for (let i = dep.length - 1; i >= 0; i--) {
    const m = dep[i];
    if (m.banque) continue;
    let b = null;
    if (m.fixId) { const per = periodeDe(m.dateISO); b = per && depB.find(x => !pris.has(x) && x.fixId === m.fixId && x.dateISO >= per.debut && x.dateISO <= per.fin); }
    else b = depB.find(x => !pris.has(x) && !x.fixId && proche(x.dateISO, m.dateISO, 2) && Math.abs(x.montant - m.montant) <= Math.max(.5, x.montant * .01));
    if (!b) continue;
    pris.add(b);
    if (!m.fixId) { if (m.label) b.label = m.label; if (m.cat && m.cat !== "Autre") b.cat = m.cat; }
    dep.splice(i, 1); n++;
  }
  return n;
}
/* Doublons de la banque : même jour, même montant, même commerce, deux références (par exemple après une nouvelle liaison) */
function doublonsBanque() {
  const groupes = {};
  DB.get("fin-expenses").filter(x => x.banque).forEach(x => { const k = empreinteDe(x, "D"); (groupes[k] = groupes[k] || []).push(["fin-expenses", x]); });
  DB.get("fin-income").filter(x => x.banque).forEach(x => { const k = empreinteDe(x, "C"); (groupes[k] = groupes[k] || []).push(["fin-income", x]); });
  return Object.values(groupes).filter(g => g.length > 1);
}
async function fusionnerDoublons() {
  const enTrop = { "fin-expenses": new Set(), "fin-income": new Set() };
  doublonsBanque().forEach(g => g.slice(1).forEach(([cle, x]) => enTrop[cle].add(x.id)));
  for (const cle of Object.keys(enTrop)) if (enTrop[cle].size) await DB.set(cle, DB.get(cle).filter(x => !enTrop[cle].has(x.id)));
  return enTrop["fin-expenses"].size + enTrop["fin-income"].size;
}
/* DIAGNOSTIC ARGENT — ce que l'app a compris de tes comptes, en texte à copier (dates, montants, origine, début des libellés) */
function diagnosticArgent() {
  const b = bilanCourant(), l = lienBanque(), d = x => x.dateISO.slice(8) + "/" + x.dateISO.slice(5, 7), e = v => nb(v, 2) + " €";
  const origine = x => (x.banque ? "banque" : "à la main") + (x.attente ? ", en cours" : "");
  const lignes = ["Diagnostic Argent RECOMP", "Période : " + nomPeriode(b) + (b.civil ? " (mois civil, aucune paye reconnue)" : "")];
  const incs = DB.get("fin-income").filter(x => dansPeriode(x, b));
  lignes.push("Revenus de la période (" + e(b.rev) + ") :");
  incs.forEach(x => lignes.push("  " + d(x) + "  " + e(x.montant) + "  " + origine(x) + (x.paye ? ", paye" : "") + "  « " + String(x.source || "").slice(0, 14) + " »"));
  const deps = DB.get("fin-expenses").filter(x => dansPeriode(x, b));
  lignes.push("Dépenses de la période : " + deps.length + " pour " + e(b.depenses) + " (banque " + deps.filter(x => x.banque).length + ", à la main " + deps.filter(x => !x.banque).length + ", en cours " + deps.filter(x => x.attente).length + ")");
  lignes.push("Charges fixes :");
  b.fixes.forEach(f => { const x = deps.find(y => y.fixId === f.id); lignes.push("  " + f.label + " (" + e(f.montant) + ", le " + (f.jour || 1) + ") : " + (x ? "payée le " + d(x) + ", " + origine(x) : "à venir")); });
  lignes.push("Épargne prévue par paye : " + e(montantParPaye()) + " · versements notés : " + etatEpargne().versements.length);
  lignes.push("Doublons possibles (banque) : " + doublonsBanque().length);
  if (l?.session) {
    lignes.push("Soldes donnés par la banque : " + ((l.soldes || []).map(s => s.type + " " + e(s.montant)).join(", ") || "aucun"));
    lignes.push("Opérations en cours à la banque : " + (l.enCours ? l.enCours.n + " (débits " + e(l.enCours.debits) + ", crédits " + e(l.enCours.credits) + ")" : "inconnu"));
    lignes.push("Solde affiché : " + (l.solde ? e(l.solde.montant) : "—") + " · dernier import : " + (l.derniere || "—"));
  } else lignes.push("Banque : non reliée");
  return lignes.join("\n");
}
// Retirer une opération importée : on garde sa référence pour qu'elle ne revienne pas
async function ignorerOperation(ref) {
  const r = reglesBanque();
  await DB.set("banque-regles", { ...r, ignores: [...r.ignores, ref] });
}
// Les banques limitent les lectures sans toi devant l'écran : au plus une mise à jour automatique toutes les 4 heures
function importBanqueDu() {
  if (!lienBanque()?.session) return false;
  let der = 0;
  try { der = +localStorage.getItem("recomp_banque_import") || 0; } catch (e) { /* facultatif */ }
  return Date.now() - der > 4 * 3600000;
}
const accesBanqueExpire = () => { const l = lienBanque(); return l?.expire ? ecart(aujourdhui(), l.expire) : null; };
