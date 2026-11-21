"use strict";
/* COACH — « Qu'est-ce que tu en penses ? »
 * Le mot du jour du coach IA, ce que le coach habituel a à te dire, puis la conversation, au clavier ou au micro.
 * Jour n'en montre qu'un aperçu. Sans coach IA, l'onglet garde les messages et les réponses toutes faites. */

// Ce qui est en cours (une réponse qui arrive, une erreur), partagé entre l'aperçu de Jour et l'onglet Coach
const EtatCoach = { occupe: null, flux: null, err: null, lecture: false, abonnes: new Set() };
const majCoach = p => { Object.assign(EtatCoach, p); EtatCoach.abonnes.forEach(f => f()); };
function useEtatCoach() {
  const [, r] = useState(0);
  useEffect(() => { const f = () => r(x => x + 1); EtatCoach.abonnes.add(f); return () => { EtatCoach.abonnes.delete(f); }; }, []);
  return EtatCoach;
}
const ecrireCoachIA = p => DB.set("coach-ia", { ...(DB.get("coach-ia") || {}), ...p });
const motDuJour = () => { const m = DB.get("coach-ia")?.matin; return m?.jour === aujourdhui() ? m : null; };
const filDuJour = () => { const f = DB.get("coach-ia")?.fil; return f?.jour === aujourdhui() ? f : null; };

/* Le mot du jour : écrit une fois par jour, tout seul, dès que la nuit est arrivée (ou à partir de 10 h) */
let essaiMatinIA = 0;
async function lancerMotDuJour() {
  if (EtatCoach.occupe) return;
  majCoach({ occupe: "matin", err: null, flux: null }); essaiMatinIA = Date.now();
  try {
    await relireMontre();
    const r = await demanderCoach({ mode: "matin", contexte: contexteCoach(), onTexte: t => majCoach({ flux: { cle: "matin", texte: t } }) });
    await ecrireCoachIA({ matin: { jour: aujourdhui(), texte: r.texte, coupe: r.coupe } });
  } catch (e) { majCoach({ err: { cle: "matin", t: e.message } }); }
  finally { majCoach({ occupe: null, flux: null }); }
}
function useMotAuto() {
  useDB();
  const actif = coachIAActif(), m = motDuJour(), nuitLa = DB.get("recup-logs").some(l => l.dateISO === aujourdhui());
  useEffect(() => { if (actif && !m && !EtatCoach.occupe && (nuitLa || new Date().getHours() >= 10) && Date.now() - essaiMatinIA > 15 * 60000) lancerMotDuJour(); }, [actif, !!m, nuitLa]);
}

/* Une question. La montre est relue d'abord (si tu viens de la synchroniser), puis le résumé de tes données est refait :
 * le coach a toujours tes derniers chiffres. Chaque question porte son heure ; le résumé, lui, ne change que si tes données
 * changent, et la suite de la conversation reste alors moins chère (cache).
 * Avec « argent », la question emporte le résumé de l'argent en pourcentages, pour cette conversation seulement. */
const QUESTION_ARGENT = "Comment je m'en sors avec mon argent sur cette paye ?";
async function envoyerCoach(q, argent) {
  q = String(q || "").trim();
  if (!q || EtatCoach.occupe) return null;
  majCoach({ occupe: "fil", err: null, flux: null, lecture: !!lienPolar()?.jeton });
  const f0 = filDuJour() || { jour: aujourdhui(), messages: [] }, heure = new Date().toTimeString().slice(0, 5);
  const m = { role: "user", content: "[" + heure + "] " + q + (argent ? "\n\nMon argent, en pourcentages et sans montants :\n" + argentEnPourcentages() : ""), affiche: q, ...(argent ? { argent: true } : {}) };
  const messages = [...f0.messages, m];
  await ecrireCoachIA({ fil: { ...f0, messages } });
  await relireMontre();
  majCoach({ lecture: false });
  const f = { ...f0, contexte: contexteCoach(false) };
  try {
    const r = await demanderCoach({ mode: "question", contexte: f.contexte, messages: messages.map(x => ({ role: x.role, content: x.content })), onTexte: t => majCoach({ flux: { cle: "fil", texte: t } }) });
    await ecrireCoachIA({ fil: { ...f, messages: [...messages, { role: "assistant", content: r.texte + (r.coupe ? "\n\n(réponse coupée en route)" : "") }] } });
    return null;
  } catch (e) { majCoach({ err: { cle: "fil", t: e.message } }); await ecrireCoachIA({ fil: f }); return q; }
  finally { majCoach({ occupe: null, flux: null, lecture: false }); }
}
// Depuis un autre écran (bouton « En parler au coach » de l'onglet Argent)
let demandeCoach = null;
const parlerArgentAuCoach = () => { demandeCoach = "argent"; Nav.tab("coach"); };

/* LA DICTÉE — la reconnaissance vocale du téléphone, en français. Sans elle, le bouton ouvre le clavier, dont le micro fait pareil. */
const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
function useDictee(setTexte, champ) {
  const [ecoute, setEcoute] = useState(false), reco = useRef(null), avant = useRef("");
  const arreter = () => { try { reco.current?.stop(); } catch (e) { /* déjà arrêtée */ } };
  const clavier = () => { champ.current?.focus(); toast("Touche le micro du clavier pour dicter"); };
  const basculer = actuel => {
    if (ecoute) return arreter();
    if (!Reconnaissance) return clavier();
    let r;
    try { r = new Reconnaissance(); } catch (e) { return clavier(); }
    r.lang = "fr-FR"; r.interimResults = true; r.continuous = true;
    avant.current = actuel?.trim() ? actuel.trim() + " " : "";
    r.onresult = e => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setTexte(avant.current + t.trim()); };
    r.onerror = e => {
      setEcoute(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { toast("Micro refusé : autorise-le pour Ensō dans les réglages de l'iPhone, ou utilise le micro du clavier", { danger: true }); champ.current?.focus(); }
      else if (e.error !== "aborted" && e.error !== "no-speech") toast("Dictée interrompue, réessaie", { danger: true });
    };
    r.onend = () => setEcoute(false);
    reco.current = r;
    try { r.start(); setEcoute(true); vibre(); } catch (e) { clavier(); }
  };
  useEffect(() => () => arreter(), []);
  return { ecoute, basculer, arreter };
}

/* Les morceaux de la conversation */
const Paragraphes = ({ t }) => h(Fragment, null, texteCoach(t).split(/\n{2,}/).filter(Boolean).map((p, i) => h("p", { key: i }, p)));
const ActionsCoach = ({ t }) => { const l = actionsDe(t); return l.length > 0 && h("div.msg-a", l.map((k, i) => h("button", { key: k, className: i === 0 ? "pr" : "", onClick: ACTIONS_COACH[k][1] }, ACTIONS_COACH[k][0]))); };
function MotCoachIA({ e, m }) {
  const enCours = e.flux?.cle === "matin" ? e.flux.texte : null, t = enCours || m?.texte, err = e.err?.cle === "matin" ? e.err.t : null;
  return h("div.msg.ia",
    h("span.ia-e", "Le mot du coach"),
    t ? h(Paragraphes, { t }) : h("p.ia-attente", err ? "Le coach n'a pas pu écrire : " + err + "." : e.occupe === "matin" ? "Le coach relit ta montre et tes données…" : "Ton mot du jour arrive dès que ta nuit est là."),
    !enCours && t && h(ActionsCoach, { t }),
    e.occupe !== "matin" && h("div.ia-pied", m?.coupe && h("small", "Réponse coupée en route."), h("button", { disabled: !!e.occupe, onClick: lancerMotDuJour }, t ? "Réécrire" : err ? "Réessayer" : "L'écrire maintenant")));
}
function FilCoachIA({ e, fil }) {
  const m = fil?.messages || [], enCours = e.flux?.cle === "fil" ? e.flux.texte : null, err = e.err?.cle === "fil" ? e.err.t : null;
  if (!m.length && e.occupe !== "fil" && !err) return null;
  return h("div.fil-ia",
    m.map((x, i) => x.role === "user"
      ? h("div.msg.rep", { key: i }, h("p", x.affiche || x.content), x.argent && h("small.cadenas", h(Icone, { n: "oeil-barre", t: 13 }), "Argent partagé en pourcentages, sans montants"))
      : h("div.msg.ia", { key: i }, h(Paragraphes, { t: x.content }), i === m.length - 1 && h(ActionsCoach, { t: x.content }))),
    e.occupe === "fil" && h("div.msg.ia", enCours ? h(Paragraphes, { t: enCours }) : h("p.ia-attente", e.lecture ? "Le coach relit ta montre…" : "Le coach réfléchit…")),
    err && h("p.note", "Pas de réponse : " + err + ". Ta question est restée dans le champ."));
}
const InviteIA = () => h("div.msg.ia",
  h("span.ia-e", "Coach IA"),
  h("p", "Active le coach IA pour lui parler librement, au clavier ou au micro : il lit tes chiffres et te répond comme un vrai coach."),
  h("div.msg-a", h("button.pr", { onClick: () => Nav.sheet("reglage", { rub: "coach" }) }, "L'activer")));

function EcranCoach() {
  useDB(); useDiscret(); useMotAuto();
  const e = useEtatCoach(), actif = coachIAActif(), m = motDuJour(), fil = filDuJour();
  const [q, setQ] = useState(""), [rep, setRep] = useState(null), champ = useRef(null), bas = useRef(null);
  const dictee = useDictee(setQ, champ);
  // Avec le coach IA, son mot du jour remplace la phrase d'accueil
  const msgs = messagesCoach().filter(x => !(actif && x.id === "jour"));
  const envoyer = async (t, argent) => { dictee.arreter(); setQ(""); const reste = await envoyerCoach(t, argent); if (reste) setQ(reste); };
  useEffect(() => { if (demandeCoach === "argent" && actif) { demandeCoach = null; envoyer(QUESTION_ARGENT, true); } }, []);
  // La conversation descend toute seule quand une question part ou qu'une réponse arrive
  const n = (fil?.messages?.length || 0) * 1000 + (e.flux?.cle === "fil" ? Math.floor(e.flux.texte.length / 60) : 0);
  useEffect(() => { if (n) bas.current?.scrollIntoView({ block: "end" }); }, [n]);
  const questions = actif ? [
    ["Quoi manger ?", () => envoyer("Qu'est-ce que je mange maintenant, avec ce qu'il me reste aujourd'hui ?")],
    ["Ma séance ?", () => envoyer("Je fais ma séance prévue aujourd'hui, ou je lève le pied ?")],
    ["Je peux charger ?", () => envoyer("Je peux charger plus lourd à ma prochaine séance ?")],
    ["Parler de mon argent", () => envoyer(QUESTION_ARGENT, true)],
    ["Ma semaine", () => Nav.sheet("bilan")],
  ] : [["Quoi manger ?", () => setRep(repondre("manger"))], ["Je peux charger ?", () => setRep(repondre("charger"))], ["Ma semaine", () => Nav.sheet("bilan")]];
  return h("div.page.page-coach", { "data-t": "coach" },
    h("header.entete", h("div", h("small", dateLongue(aujourdhui())), h("h1.logo", "Coach")), actif && h("span.ia-b", "IA")),
    h("div.coach.coach-plein",
      actif ? h(MotCoachIA, { e, m }) : h(InviteIA),
      msgs.map(x => h("div.msg", { key: x.id }, h("p", x.t), x.acts && h("div.msg-a", x.acts.map((a, i) => h("button", { key: i, className: i === 0 ? "pr" : "", onClick: a.run }, a.l))))),
      rep && h("div.msg.rep", h("p", rep)),
      actif && h(FilCoachIA, { e, fil }),
      h("div", { ref: bas, className: "coach-bas" })),
    h("div.compose",
      h(Puces, { defile: true }, questions.map(([l, f]) => h(Puce, { key: l, onClick: f }, l))),
      actif && h("form.coach-q", { onSubmit: ev => { ev.preventDefault(); envoyer(q); } },
        h("button.micro", { type: "button", className: dictee.ecoute ? "actif" : "", onClick: () => dictee.basculer(q), "aria-label": dictee.ecoute ? "Arrêter la dictée" : "Dicter ta question", "aria-pressed": dictee.ecoute }, h(Icone, { n: dictee.ecoute ? "stop" : "micro", t: 20 })),
        h("input", { ref: champ, value: q, onChange: ev => setQ(ev.target.value), placeholder: dictee.ecoute ? "Je t'écoute…" : "Écris ou dicte ta question…", enterKeyHint: "send", "aria-label": "Question au coach", maxLength: 1500 }),
        h("button.envoi", { type: "submit", disabled: !!e.occupe || !q.trim(), "aria-label": "Envoyer" }, h(Icone, { n: "envoyer", t: 18 })))));
}

/* L'aperçu sur Jour : le début du mot du coach et le nombre de messages, l'onglet Coach pour le reste */
function ApercuCoach() {
  useMotAuto(); useDiscret();
  const e = useEtatCoach(), actif = coachIAActif(), m = motDuJour(), msgs = messagesCoach();
  const n = msgs.filter(x => x.acts && !["jour", "forme", "bilan"].includes(x.id)).length;
  const t = actif && e.flux?.cle === "matin" ? texteCoach(e.flux.texte) : actif && m ? texteCoach(m.texte) : (msgs.find(x => x.id === "jour") || msgs[0])?.t || "";
  return h("button.apercu-coach", { onClick: () => Nav.tab("coach") },
    h("header", h("i", "E"), h("b", "Ton coach"), actif && h("small.ia-b", "IA"), n > 0 && h("em", pluriel(n, "chose à voir", "choses à voir"))),
    h("p", t.split(/\n/)[0] || (actif ? "Ton mot du jour arrive dès que ta nuit est là." : "")),
    h("span.affiche-a", actif ? "Lui parler" : "Voir", h(Icone, { n: "fleche", t: 16 })));
}
