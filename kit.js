"use strict";
/* KIT — les briques de tous les écrans. Le style vit dans css/app.css : ici, seulement la structure. */

/* Navigation : un onglet actif et une pile de feuilles. Nav.sheet("nom", props) ouvre une feuille par-dessus. */
const Nav = (() => {
  let etat = { tab: "jour", pile: [] }, seq = 0;
  const abonnes = new Set(), maj = e => { etat = e; abonnes.forEach(f => f()); };
  return {
    lire: () => etat,
    abonner: f => { abonnes.add(f); return () => abonnes.delete(f); },
    tab: id => { maj({ tab: id, pile: [] }); bus.emit("tab", id); },
    sheet: (nom, props) => {
      maj({ ...etat, pile: [...etat.pile, { id: ++seq, nom, props: props || {} }] });
      try { history.pushState({ feuille: seq }, ""); } catch (e) { /* aperçu */ }
    },
    fermer: () => { if (etat.pile.length) maj({ ...etat, pile: etat.pile.slice(0, -1) }); },
    toutFermer: () => maj({ ...etat, pile: [] }),
  };
})();
function useNav() { return useSyncExternalStore(Nav.abonner, Nav.lire); }

const ICONES = {
  jour: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  sport: "M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11",
  repas: "M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2 1-3 3.5-3 6.5 0 2 1 3.5 3 3.5v8",
  argent: "M18 6.5A7 7 0 1 0 18 17.5M4 10.5h9M4 13.5h9",
  corps: "M3 12h4l2.5-6 4 13 2.5-7h5",
  plus: "M12 5v14M5 12h14",
  moins: "M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  fermer: "M6 6l12 12M18 6L6 18",
  fleche: "M9 5l7 7-7 7",
  retour: "M15 5l-7 7 7 7",
  bas: "M5 9l7 7 7-7",
  reglages: "M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  chercher: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.8-4.8",
  points: "M5 12h.01M12 12h.01M19 12h.01",
  poubelle: "M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13",
  chrono: "M12 8v5l3 2M12 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 2h6",
  nage: "M3 17c2 0 2 1.5 4.5 1.5S10 17 12 17s2 1.5 4.5 1.5S19 17 21 17M7 13l4-3-2-3 4-2 4 5M16 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  poids: "M5 8h14l2 12H3L5 8zM9 8a3 3 0 1 1 6 0",
  eau: "M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z",
  mal: "M12 3v10M12 18v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  photo: "M4 8h3l2-3h6l2 3h3v11H4V8zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  ruban: "M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4",
  panier: "M3 5h3l2.5 11h10L21 8H7M10 20h.01M17 20h.01",
  trace: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7",
  oeil: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "oeil-barre": "M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2",
  sauve: "M7 18a4 4 0 0 1-.6-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18H7zM12 10v6M9.5 13.5 12 16l2.5-2.5",
  coeur: "M12 20S4 14.5 4 9a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 5.5-8 11-8 11z",
  fiole: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3",
  liste: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  calendrier: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  bulle: "M4 5h16v11H9l-5 4V5z",
};
const Icone = ({ n, t }) => h("svg.ico", { viewBox: "0 0 24 24", width: t || 24, height: t || 24, "aria-hidden": true },
  h("path", { d: ICONES[n] || "", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }));

/* Texte d'affiche : se réduit tout seul pour tenir sur la ligne */
function Geant({ children, cl, max }) {
  const r = useRef(null);
  useLayoutEffect(() => {
    const el = r.current;
    if (!el) return;
    el.style.fontSize = "";
    const p = el.parentElement, st = getComputedStyle(p);
    let l = p.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
    [...p.children].forEach(c => { if (c !== el && getComputedStyle(c).position !== "absolute" && st.display === "flex") l -= c.offsetWidth + 8; });
    const base = parseFloat(getComputedStyle(el).fontSize), w = el.getBoundingClientRect().width;
    if (l > 0 && w > l) el.style.fontSize = Math.max(28, base * l / w * .985) + "px";
  });
  return h("div.geant", { ref: r, className: cl || "", style: max ? { "--geant-max": max } : undefined }, children);
}
/* Compteur mécanique : chaque chiffre défile jusqu'à sa valeur */
function Compteur({ v }) {
  const [parti, setParti] = useState(false);
  useEffect(() => { const t = setTimeout(() => setParti(true), 60); return () => clearTimeout(t); }, []);
  let n = 0;
  return h("span.odo", { "aria-label": v }, [...String(v)].map((c, i) => /\d/.test(c)
    ? h("span.odo-col", { key: i, style: { transform: parti ? `translateY(-${+c}em)` : "none", transitionDelay: (n++) * 70 + "ms" }, "aria-hidden": true },
        Array.from({ length: 10 }, (_, d) => h("span", { key: d }, d)))
    : h("span.odo-sep", { key: i, "aria-hidden": true }, c)));
}

/* Rond à cocher : le geste de base de l'app */
const Coche = ({ fait, onClick, label, t }) => h("button.coche", {
  className: fait ? "fait" : "", onClick: e => { e.stopPropagation(); vibre(); onClick(e); }, "aria-pressed": !!fait, "aria-label": label, style: t ? { "--t": t + "px" } : undefined,
}, h("svg", { viewBox: "0 0 24 24", "aria-hidden": true }, h("path", { d: ICONES.check, fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", pathLength: 1 })));

const Puce = ({ actif, onClick, children, cl }) => h("button.puce", { className: (actif ? "actif " : "") + (cl || ""), "aria-pressed": !!actif, onClick: () => { vibre(); onClick(); } }, children);
const Puces = ({ children, defile }) => h("div.puces", { className: defile ? "defile" : "" }, children);
const Bouton = ({ children, onClick, cl, disabled, ico }) => h("button.bouton", { className: cl || "", onClick, disabled }, ico && h(Icone, { n: ico, t: 20 }), children);
const Section = ({ titre, droite, children, cl }) => h("section.section", { className: cl || "" },
  (titre || droite) && h("header.section-t", h("h2", titre), droite),
  children);
const Lien = ({ children, onClick }) => h("button.lien", { onClick }, children, h(Icone, { n: "fleche", t: 14 }));
/* Rangée qui ouvre un écran */
const Rangee = ({ ico, titre, sous, valeur, onClick, cl }) => h("button.rangee", { onClick, className: cl || "" },
  ico && h("span.rangee-i", h(Icone, { n: ico, t: 22 })),
  h("span.rangee-t", h("b", titre), sous && h("small", sous)),
  valeur != null && h("span.rangee-v", valeur),
  h(Icone, { n: "fleche", t: 16 }));
const Tuile = ({ v, l, onClick, ton }) => h(onClick ? "button.tuile" : "div.tuile", { onClick, "data-ton": ton }, h("b", v), h("span", l));
const Vide = ({ children }) => h("p.vide", children);

/* Barre de progression, avec repère éventuel */
const Jauge = ({ v, max, ton, repere }) => {
  const p = max > 0 ? borne(v / max * 100) : 0;
  return h("div.jauge", { "data-ton": ton }, h("i", { style: { width: p + "%" } }), repere != null && h("u", { style: { left: borne(repere / max * 100) + "%" } }));
};

/* FEUILLES — panneau qui monte du bas, à refermer en glissant vers le bas */
function Feuille({ titre, children, plein, ton, sansTete, onFermer }) {
  const fermer = onFermer || Nav.fermer;
  const p = useRef(null), d = useRef(null);
  const debut = e => { d.current = { y: e.touches ? e.touches[0].clientY : e.clientY, dy: 0 }; if (p.current) p.current.style.transition = "none"; };
  const bouge = e => {
    if (!d.current) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    d.current.dy = Math.max(0, y - d.current.y);
    if (p.current) p.current.style.transform = `translateY(${d.current.dy}px)`;
  };
  const fin = () => {
    if (!d.current) return;
    const dy = d.current.dy;
    d.current = null;
    if (!p.current) return;
    p.current.style.transition = "";
    if (dy > 90) fermer(); else p.current.style.transform = "";
  };
  return h(Fragment, null,
    !plein && h("div.voile", { onClick: fermer }),
    h("div.feuille", { ref: p, role: "dialog", "aria-modal": true, "aria-label": typeof titre === "string" ? titre : undefined, className: plein ? "plein" : "", "data-t": ton },
      !sansTete && h("header.feuille-t", { onTouchStart: debut, onTouchMove: bouge, onTouchEnd: fin, onPointerDown: e => { if (e.pointerType === "mouse") debut(e); }, onPointerMove: e => { if (e.pointerType === "mouse") bouge(e); }, onPointerUp: e => { if (e.pointerType === "mouse") fin(); } },
        h("i.poignee", { "aria-hidden": true }),
        h("h1", titre),
        h("button.rond", { onClick: fermer, "aria-label": "Fermer" }, h(Icone, { n: "fermer", t: 20 }))),
      h("div.feuille-c", children)));
}

/* Confirmations et messages */
function HoteConfirm() {
  const [q, setQ] = useState(null);
  useEffect(() => bus.on("confirm", setQ), []);
  if (!q) return null;
  const clore = v => { q.res(v); setQ(null); };
  return h("div.confirm-fond", { onClick: () => clore(false) },
    h("div.confirm", { role: "alertdialog", "aria-modal": true, onClick: e => e.stopPropagation() },
      h("h2", q.titre || "Confirmer"),
      q.message && h("p", q.message),
      h("div.confirm-b",
        h(Bouton, { cl: "contour", onClick: () => clore(false) }, q.non || "Annuler"),
        h(Bouton, { cl: q.danger ? "danger" : "plein", onClick: () => clore(true) }, q.oui || "Confirmer"))));
}
function HoteToast() {
  const [l, setL] = useState([]);
  useEffect(() => bus.on("toast", t => {
    setL(a => [...a.slice(-1), t]);
    setTimeout(() => setL(a => a.filter(x => x.id !== t.id)), t.annuler ? 6000 : 3000);
  }), []);
  return h("div.toasts", { role: "status" }, l.map(t => h("div.toast", { key: t.id, className: t.danger ? "danger" : "" },
    h("span", t.msg),
    t.annuler && h("button", { onClick: () => { setL(a => a.filter(x => x.id !== t.id)); t.annuler(); } }, "Annuler"))));
}

/* Filet de sécurité : une erreur d'affichage ne vide pas tout l'écran */
class Filet extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("RECOMP", err, info); }
  render() {
    if (!this.state.err) return this.props.children;
    return h("div.filet",
      h("h2", "Un écran a planté"),
      h("p", "Tes données sont intactes."),
      h("small", String(this.state.err?.message || this.state.err)),
      h(Bouton, { cl: "plein", onClick: () => this.setState({ err: null }) }, "Réessayer"));
  }
}

/* MODE DISCRET — les montants sont cachés par défaut (flou, ou points pour les grands chiffres).
 * L'œil de l'onglet Argent les affiche, avec Face ID si tu l'as activé. Ils se recachent en quittant l'onglet ou l'app ;
 * pendant 5 minutes après un Face ID réussi, l'œil les affiche sans le redemander.
 * Ce n'est qu'un écran de confidentialité : les données restent sur ce téléphone comme le reste. */
const Discret = (() => {
  let visible = false, deverrouille = 0;
  const ab = new Set();
  const actif = () => profil().discret !== false;
  const appliquer = () => { document.documentElement.dataset.discret = actif() && !visible ? "1" : "0"; ab.forEach(f => f()); };
  return {
    actif, appliquer,
    cache: () => actif() && !visible,
    montrer: () => { visible = true; appliquer(); },
    cacher: () => { if (visible) { visible = false; appliquer(); } },
    noterDeverrouillage: () => { deverrouille = Date.now(); },
    recent: () => Date.now() - deverrouille < 5 * 60000,
    abonner: f => { ab.add(f); return () => ab.delete(f); },
    lire: () => visible + "|" + actif(),
  };
})();
const useDiscret = () => useSyncExternalStore(Discret.abonner, Discret.lire);
// Un montant dans une phrase : « ••• € » tant que c'est caché
const eurosD = (v, d) => Discret.cache() ? "••• €" : euros(v, d);
// Un montant à flouter (le flou ne demande pas de redessiner : il suit l'attribut posé sur la page)
const Mt = ({ children }) => h("span.mt", children);
// Un grand chiffre caché : des points à taille raisonnable (agrandis, leur boîte débordait sur les boutons du bandeau)
const PointsG = () => h("span.points-g", { role: "img", "aria-label": "Montant caché" }, "•••");

/* Face ID : une clé d'accès « RECOMP » créée sur ce téléphone (trousseau iCloud), puis demandée pour afficher.
 * Aucun serveur : on vérifie seulement que l'iPhone a bien confirmé que c'est toi. */
const faceIdPossible = async () => { try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; } };
async function configurerFaceId() {
  if (!(await faceIdPossible())) throw new Error("Face ID n'est pas disponible dans cette app sur ce téléphone");
  const c = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "RECOMP" },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "RECOMP", displayName: "RECOMP (montants)" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
    attestation: "none", timeout: 60000,
  } });
  await setProfil({ faceId: texteB64u(c.rawId), faceIdActif: true });
}
async function verifierFaceId() {
  const a = await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), userVerification: "required", timeout: 60000,
    allowCredentials: [{ type: "public-key", id: octetsB64u(profil().faceId), transports: ["internal"] }],
  } });
  // Octet 32 des données de l'authentificateur : le bit 4 dit que l'iPhone a vérifié l'utilisateur (Face ID ou code)
  return !!a && (new Uint8Array(a.response.authenticatorData)[32] & 0x04) !== 0;
}
/* L'œil : toucher pour afficher ou cacher ; appui long pour un coup d'œil (avec Face ID : s'il a été validé il y a moins de 5 minutes) */
function Oeil() {
  useDiscret();
  const pr = profil(), cache = Discret.cache(), avecFaceId = !!(pr.faceIdActif && pr.faceId);
  const appui = useRef({ minuteur: null, coupDoeil: false, montre: false, ignorerJusqua: 0 });
  if (!Discret.actif()) return null;
  const basculer = async () => {
    if (!cache) return Discret.cacher();
    if (!avecFaceId || Discret.recent()) return Discret.montrer();
    try {
      if (await verifierFaceId()) { Discret.noterDeverrouillage(); Discret.montrer(); }
      else toast("Face ID n'a pas confirmé : montants toujours cachés", { danger: true });
    } catch (e) {
      if (e?.name === "NotAllowedError" || e?.name === "AbortError") toast("Montants toujours cachés. Si Face ID ne se lance plus, désactive-le dans Réglages.", { danger: true });
      else { toast("Face ID indisponible : montants affichés sans", { danger: true }); Discret.montrer(); }
    }
  };
  // Appui long : visible tant que le doigt reste posé. Le doigt est « capturé » par l'œil : même si l'écran bouge, il ne le perd pas.
  const debut = e => {
    if (!cache) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* facultatif */ }
    const permis = !avecFaceId || Discret.recent();
    appui.current.minuteur = setTimeout(() => {
      appui.current.coupDoeil = true;
      if (!permis) return toast("Avec Face ID : touche l'œil une fois, puis l'appui long marche pendant 5 minutes");
      vibre(); appui.current.montre = true; Discret.montrer();
    }, 350);
  };
  const fin = () => {
    clearTimeout(appui.current.minuteur);
    if (!appui.current.coupDoeil) return;
    // Le « clic » que l'écran tactile envoie juste après le relâchement ne compte pas
    appui.current.coupDoeil = false; appui.current.ignorerJusqua = Date.now() + 600;
    if (appui.current.montre) { appui.current.montre = false; Discret.cacher(); }
  };
  return h("button.oeil", { onPointerDown: debut, onPointerUp: fin, onPointerCancel: fin, onContextMenu: e => e.preventDefault(),
    onClick: () => { if (appui.current.coupDoeil || Date.now() < appui.current.ignorerJusqua) return; vibre(); basculer(); },
    "aria-label": cache ? "Afficher les montants" : "Cacher les montants", "aria-pressed": !cache },
    h(Icone, { n: cache ? "oeil-barre" : "oeil", t: 22 }));
}

/* SOUS-ONGLETS — une rangée de rubriques sous le bandeau ; chaque écran se souvient de la dernière ouverte.
 * `liste` = [[clé, nom], …] ; la première est celle du quotidien. */
function useRubrique(cle, liste) {
  const valide = v => liste.some(x => x[0] === v);
  const [r, setR] = useState(() => { try { const v = localStorage.getItem("recomp_rubrique_" + cle); return valide(v) ? v : liste[0][0]; } catch (e) { return liste[0][0]; } });
  const choisir = v => { setR(v); try { localStorage.setItem("recomp_rubrique_" + cle, v); } catch (e) { /* facultatif */ } };
  return [valide(r) ? r : liste[0][0], choisir];
}
/* MISE À JOUR — le service worker retélécharge l'app en arrière-plan. Dès qu'une nouvelle version est prête,
 * un bandeau propose de l'afficher (sinon elle n'apparaîtrait qu'après avoir vraiment fermé l'app). */
const MiseAJour = { prete: false, demande: null };
navigator.serviceWorker?.addEventListener("message", e => {
  const t = e.data?.type;
  if (t === "nouvelle-version") { MiseAJour.prete = true; bus.emit("maj"); }
  if (MiseAJour.demande && (t === "nouvelle-version" || t === "a-jour" || t === "maj-impossible")) { const f = MiseAJour.demande; MiseAJour.demande = null; f(t); }
});
let derniereVerif = 0;
function verifierMaj(demande) {
  const sw = navigator.serviceWorker;
  if (!sw?.controller) return Promise.resolve("sans");
  if (!demande && Date.now() - derniereVerif < 10 * 60000) return Promise.resolve("recent");
  derniereVerif = Date.now();
  sw.getRegistration?.().then(r => r?.update()).catch(() => {});
  sw.controller.postMessage({ type: "rafraichir", demande: !!demande });
  if (!demande) return Promise.resolve("lance");
  return new Promise(res => { MiseAJour.demande = res; setTimeout(() => { if (MiseAJour.demande === res) { MiseAJour.demande = null; res("delai"); } }, 30000); });
}
function PastilleMaj() {
  const [prete, setPrete] = useState(MiseAJour.prete);
  useEffect(() => bus.on("maj", () => setPrete(true)), []);
  if (!prete) return null;
  return h("div.maj-p", { role: "status" }, h("span", "Nouvelle version de RECOMP prête"), h("button", { onClick: () => location.reload() }, "Afficher"));
}

/* Ouvre un onglet directement sur une de ses rubriques */
const allerRubrique = (tab, rub) => { try { localStorage.setItem("recomp_rubrique_" + tab, rub); } catch (e) { /* on ouvre l'onglet quand même */ } Nav.tab(tab); };
/* Fait défiler pour que la barre des rubriques soit pile en haut, au début de la rubrique */
function remonterRubrique(ancre, doux) {
  const barre = ancre?.nextElementSibling, scene = ancre?.closest(".scene");
  if (!barre || !scene) return;
  const cs = getComputedStyle(barre), ecart = (parseFloat(getComputedStyle(ancre.parentNode).rowGap) || 0) + (parseFloat(cs.marginTop) || 0);
  const top = scene.scrollTop + ancre.getBoundingClientRect().top - scene.getBoundingClientRect().top + ecart - (parseFloat(cs.top) || 0);
  scene.scrollTo({ top: Math.max(0, top), behavior: doux ? "smooth" : "instant" });
}
function SousOnglets({ liste, actif, onChange }) {
  const barre = useRef(null);
  // « collée » : la barre est arrivée en haut de l'écran. Alors seulement, elle peint la zone de l'heure et de la batterie
  // au-dessus d'elle ; sinon elle cacherait ce qui la précède (la ligne de la banque, par exemple).
  useEffect(() => {
    const b = barre.current, scene = b?.closest(".scene");
    if (!b || !scene) return;
    const maj = () => b.classList.toggle("collee", b.getBoundingClientRect().top - scene.getBoundingClientRect().top - (parseFloat(getComputedStyle(b).top) || 0) < 1);
    maj();
    scene.addEventListener("scroll", maj, { passive: true });
    return () => scene.removeEventListener("scroll", maj);
  }, []);
  return h("nav.sous-onglets", { ref: barre, role: "tablist" },
    liste.map(([k, l, n]) => h("button", { key: k, role: "tab", "aria-selected": actif === k, "aria-label": n ? l + ", " + n + " à voir" : l, className: actif === k ? "actif" : "", onClick: () => {
      if (actif === k) return;
      vibre();
      // Si la barre est collée en haut, la nouvelle rubrique s'affiche depuis son début
      const ancre = barre.current?.previousElementSibling, colle = barre.current?.classList.contains("collee") && ancre?.classList.contains("ancre-r");
      onChange(k);
      if (colle) requestAnimationFrame(() => remonterRubrique(ancre));
    } }, l, n ? h("span.point-r", { "aria-hidden": true }) : null)));
}
