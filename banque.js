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
  l = l.replace(/^(FACTURE|PAIEMENT|ACHAT)\s+(PAR\s+)?CARTE(\s+X?\d{4})?\s*/i, "").replace(/^PRLV\s+(SEPA\s+)?/i, "")
    .replace(/^VIR(EMENT)?\s+(SEPA\s+)?(INST(ANTANE)?\s+)?(RECU|EMIS)?\s*(\/?DE:?\s*|\/?POUR:?\s*)?/i, "")
    .replace(/\bDU\s+\d{6}\b/g, "").replace(/\bCARTE\s+[X\d*]{4,}\b/gi, "").replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, "")
    .replace(/\s\/.*$/, "").replace(/\s{2,}/g, " ").trim();
  if (!l) return "Opération";
  // Les banques écrivent en majuscules : on rend le libellé lisible
  return l.length > 3 && l === l.toUpperCase() ? l.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).slice(0, 48) : l.slice(0, 48);
}
// Règles toutes prêtes ; tes propres règles passent avant
const REGLES_DEFAUT = [
  [/CARREFOUR|LECLERC|AUCHAN|LIDL|INTERMARCHE|MONOPRIX|FRANPRIX|ALDI|CASINO|SUPER U|HYPER U|PICARD|GRAND FRAIS|NETTO|BIOCOOP|LEADER PRICE|PROXI|SPAR/, "Courses"],
  [/MC ?DO|MCDONALD|BURGER KING|KFC|QUICK|UBER ? EATS|DELIVEROO|JUST EAT|RESTAU|BRASSERIE|PIZZ|SUSHI|KEBAB|TACOS|STARBUCKS|COLUMBUS|BAR |CAFE/, "Sorties"],
  [/TOTAL|ESSO|SHELL|\bBP\b|AVIA|SNCF|RATP|NAVIGO|UBER|BOLT|BLABLA|PEAGE|AUTOROUTE|VINCI|SANEF|APRR|PARKING|INDIGO|TCL|TISSEO/, "Transport"],
  [/NETFLIX|SPOTIFY|DISNEY|PRIME VIDEO|AMAZON PRIME|CANAL|DEEZER|APPLE\.COM|ICLOUD|GOOGLE ?\*|YOUTUBE|FREE MOBILE|FREE TELECOM|SFR|ORANGE|BOUYGUES|SOSH|RED BY|CHATGPT|OPENAI/, "Abonnements"],
  [/PHARMA|DOCTOLIB|MEDECIN|DOCTEUR|DENTISTE|LABO|MUTUELLE|CPAM|AMELI/, "Santé"],
  [/DECATHLON|BASIC ?FIT|FITNESS|KEEP COOL|ON AIR|PISCINE|INTERSPORT|GO SPORT|POLAR/, "Sport"],
  [/ZARA|H ?& ?M|KIABI|CELIO|JULES|PRIMARK|UNIQLO|BERSHKA|PULL ?& ?BEAR|ZALANDO|VINTED/, "Vêtements"],
  [/LOYER|EDF|ENGIE|TOTALENERGIES ELEC|VEOLIA|SUEZ|ASSURANCE|AXA|MAAF|MACIF|MATMUT|GROUPAMA|TAXE|IMPOTS|DGFIP/, "Logement"],
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
const ORDRE_SOLDES = ["CLBD", "ITBD", "XPCD", "ITAV", "CLAV", "OTHR"];
let importBanqueEnCours = null;
const importerBanque = () => importBanqueEnCours || (importBanqueEnCours = importerBanque1().finally(() => { importBanqueEnCours = null; }));
async function importerBanque1() {
  const l = lienBanque();
  if (!l?.session || !l.compte) throw new Error("banque non reliée");
  const auj = aujourdhui(), du = l.derniere ? decale(l.derniere, -7) : decale(auj, -62);
  const [ops, soldes] = await Promise.all([lireOperations(l, du), appelBanque("lire", { q: { session: l.session, compte: l.compte, quoi: "soldes" } }).catch(() => null)]);
  const rang = x => { const i = ORDRE_SOLDES.indexOf(x.balance_type); return i < 0 ? 99 : i; };
  const b = [...(soldes?.balances || [])].sort((x, y) => rang(x) - rang(y))[0];
  const solde = b ? { montant: +b.balance_amount?.amount || 0, date: auj } : l.solde;

  // Copies : rien n'est modifié tant que tout n'est pas prêt
  const dep = DB.get("fin-expenses").map(x => ({ ...x })), inc = DB.get("fin-income").map(x => ({ ...x }));
  const ep0 = etatEpargne(), ep = { ...ep0, versements: ep0.versements.map(x => ({ ...x })) };
  let epChange = false;
  const { ignores } = reglesBanque(), fixes = DB.get("fin-fixes"), p = periodeCourante();
  const connues = new Set([...dep, ...inc, ...ep.versements].map(x => x.banque).filter(Boolean).concat(ignores));
  const proche = (a, c, j = 3) => Math.abs(ecart(a, c)) <= j;
  let n = 0, id = Date.now();
  for (const t of ops) {
    if (t.status && t.status !== "BOOK") continue; // en attente : on la prendra une fois comptabilisée
    const montant = Math.abs(+t.transaction_amount?.amount || 0), dateISO = (t.transaction_date || t.booking_date || t.value_date || auj).slice(0, 10);
    if (!montant) continue;
    const libelle = libelleDe(t), L = majuscSansAccent(libelle + " " + (t.remittance_information || []).join(" "));
    const ref = t.entry_reference || t.transaction_id || [dateISO, t.credit_debit_indicator, montant, L.slice(0, 30)].join("|");
    if (connues.has(ref)) continue;
    connues.add(ref); n++;
    if (t.credit_debit_indicator === "CRDT") {
      const main = inc.find(x => !x.banque && Math.abs(x.montant - montant) < .01 && proche(x.dateISO, dateISO));
      if (main) main.banque = ref;
      else inc.push({ id: id++, dateISO, montant, source: libelle, banque: ref, ...(RE_PAYE.test(L) ? { paye: true } : {}) });
      continue;
    }
    // Virement vers ton livret : c'est de l'épargne, pas une dépense
    if (RE_EPARGNE.test(L) && /VIR|VERSEMENT/.test(L)) {
      const deja = ep.versements.find(v => !v.banque && Math.abs(v.montant - montant) < .01 && proche(v.dateISO, dateISO, 10));
      if (deja) deja.banque = ref;
      else ep.versements.push({ id: id++, dateISO, montant, source: dateISO >= p.debut && !ep.versements.some(v => v.source === "paye" && v.dateISO >= p.debut) ? "paye" : "main", banque: ref });
      epChange = true;
      continue;
    }
    const main = dep.find(x => !x.banque && Math.abs(x.montant - montant) < .01 && proche(x.dateISO, dateISO));
    if (main) { main.banque = ref; continue; }
    // Charge fixe reconnue (même montant à 3 % près, ou son nom dans le libellé) : cochée toute seule
    const f = fixes.find(x => (Math.abs(x.montant - montant) <= Math.max(1, x.montant * .03) || L.includes(majuscSansAccent(x.label))) && Math.abs(x.montant - montant) <= x.montant * .2
      && !dep.some(e => e.fixId === x.id && proche(e.dateISO, dateISO, 20)));
    dep.push({ id: id++, dateISO, montant, cat: f?.cat || categorieDe(libelle, t.merchant_category_code), label: f ? f.label : libelle, banque: ref, ...(f ? { fixId: f.id } : {}) });
  }
  if (n) { await DB.set("fin-expenses", dep); await DB.set("fin-income", inc); if (epChange) await DB.set("epargne", ep); }
  await DB.set("banque-lien", { ...lienBanque(), derniere: auj, solde });
  try { localStorage.setItem("recomp_banque_import", String(Date.now())); } catch (e) { /* facultatif */ }
  return { nouvelles: n, solde };
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
