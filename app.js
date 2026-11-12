"use strict";
/* APPLICATION — cinq onglets, cinq questions, et une pile de feuilles par-dessus.
 *   Jour    Qu'est-ce que je fais maintenant ?
 *   Sport   Qu'est-ce que je soulève ?
 *   Repas   Qu'est-ce que je mange ?
 *   Argent  Combien il me reste ?
 *   Corps   Est-ce que ça marche ? */
const ONGLETS = [
  { id: "jour", nom: "Jour", ico: "jour", E: EcranJour },
  { id: "sport", nom: "Sport", ico: "sport", E: EcranSport },
  { id: "repas", nom: "Repas", ico: "repas", E: EcranRepas },
  { id: "argent", nom: "Argent", ico: "argent", E: EcranArgent },
  { id: "corps", nom: "Corps", ico: "corps", E: EcranCorps },
];
const FEUILLES = {
  matin: FeuilleMatin, pesee: FeuillePesee, forme: FeuilleForme, bilan: FeuilleBilan, seance: FeuilleSeance, exercice: FeuilleExercice,
  choisir: FeuilleChoisir, seanceDetail: FeuilleSeanceDetail, natation: FeuilleNatation, nageModele: FeuilleNageModele, douleur: FeuilleDouleur, douleurs: FeuilleDouleurs,
  programmes: FeuilleProgrammes, import: FeuilleImport, editeur: FeuilleEditeur, bibliotheque: FeuilleBibliotheque, fiche: FeuilleFiche, technique: FeuilleTechnique,
  repas: FeuilleRepas, equivalents: FeuilleEquivalents, aliment: FeuilleAliment, calories: FeuilleCalories, courses: FeuilleCourses,
  operation: FeuilleOperation, fixes: FeuilleFixes, mensurations: FeuilleMensurations, photos: FeuillePhotos,
  capture: FeuilleCapture, reglages: FeuilleReglages, sorties: FeuilleSorties, sortie: FeuilleSortie, nageProgres: FeuilleNageProgres, epargne: FeuilleEpargne, banque: FeuilleBanque,
};

/* Pastille de repos, visible partout quand la séance est réduite */
function PastilleRepos({ cache }) {
  const r = useRepos();
  if (!r || cache) return null;
  return h("button.pastille", { onClick: () => r.ctx ? Nav.sheet("seance", r.ctx) : Repos.arreter(), "aria-label": "Revenir à la séance" }, h(Icone, { n: "chrono", t: 16 }), h("b", mmss(r.reste)));
}

/* Le jour qu'il est. Si la date change (app restée ouverte en arrière-plan pendant la nuit,
 * ou minuit passé app ouverte), on renvoie la nouvelle date pour réafficher l'écran sur aujourd'hui. */
function useAujourdhui() {
  const [jour, setJour] = useState(aujourdhui());
  useEffect(() => {
    const verifie = () => { if (document.visibilityState !== "hidden") setJour(aujourdhui()); };
    const id = setInterval(verifie, 30000);
    document.addEventListener("visibilitychange", verifie);
    window.addEventListener("focus", verifie);
    window.addEventListener("pageshow", verifie);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", verifie); window.removeEventListener("focus", verifie); window.removeEventListener("pageshow", verifie); };
  }, []);
  return jour;
}

function App() {
  const nav = useNav();
  const jour = useAujourdhui();
  useDB();
  const page = useRef(null);
  useEffect(() => { page.current?.scrollTo?.(0, 0); }, [nav.tab]);
  // Le bouton retour du téléphone referme la feuille du dessus
  useEffect(() => {
    const retour = () => Nav.fermer();
    window.addEventListener("popstate", retour);
    return () => window.removeEventListener("popstate", retour);
  }, []);
  // Après une rotation, l'iPhone peut laisser la page décalée sur le côté : on la remet en place
  useEffect(() => {
    const recale = () => setTimeout(() => { window.scrollTo(0, 0); if (page.current) page.current.scrollLeft = 0; }, 300);
    window.addEventListener("orientationchange", recale);
    window.addEventListener("resize", recale);
    return () => { window.removeEventListener("orientationchange", recale); window.removeEventListener("resize", recale); };
  }, []);
  const O = ONGLETS.find(o => o.id === nav.tab);
  const enSeance = nav.pile.some(f => f.nom === "seance");
  return h("div.app", { "data-t": nav.tab },
    h("main.scene", { ref: page, key: nav.tab + jour, "aria-hidden": nav.pile.length > 0 }, h(Filet, null, h(O.E))),
    h("button.plus", { onClick: () => { vibre(); Nav.sheet("capture"); }, "aria-label": "Que veux-tu faire ?" }, h(Icone, { n: "plus", t: 30 })),
    h("nav.barre", { "aria-label": "Sections" }, ONGLETS.map(o => h("button", { key: o.id, className: nav.tab === o.id ? "actif" : "", "data-ton": o.id, "aria-current": nav.tab === o.id ? "page" : undefined, "aria-label": o.nom, onClick: () => { vibre(); Nav.tab(o.id); } },
      h(Icone, { n: o.ico, t: 22 }), h("b", o.nom)))),
    h(PastilleRepos, { cache: enSeance }),
    nav.pile.map(f => { const F = FEUILLES[f.nom]; return h(Filet, { key: f.id }, h(F, f.props)); }),
    h(HotePave), h(HoteConfirm), h(HoteToast));
}

(async () => {
  await DB.init();
  if (window.RECOMP_DEMO) await window.RECOMP_DEMO();
  codePolarDansAdresse();
  codeBanqueDansAdresse();
  const notif = new URLSearchParams(location.search).get("ouvrir");
  if (notif) history.replaceState(null, "", location.pathname);
  navigator.serviceWorker?.addEventListener("message", e => ouvrirDepuisNotif(e.data?.ouvrir));
  appliquerTheme(profil().theme || "nuit");
  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
  if (notif) setTimeout(() => ouvrirDepuisNotif(notif), 50);
})().catch(e => { console.error(e); window.recompFatal?.(String(e.message || e)); });
