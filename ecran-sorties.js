"use strict";
/* SORTIES — les séances de la montre Polar, façon carnet de course : parcours, km, allure, FC.
 * Les données viennent de polar.js ; la carte vient d'OpenStreetMap (il faut du réseau pour le fond, le tracé s'affiche sans). */

// 1:02:03 ou 42:10
const chrono = s => { s = Math.round(s || 0); const H = Math.floor(s / 3600), M = Math.floor(s % 3600 / 60), S = s % 60; return (H ? H + ":" + pad2(M) : M) + ":" + pad2(S); };
const allureDe = (s, km) => km > 0 ? chrono(s / km) : "—";
const kmDe = m => nb(m / 1000, m >= 100000 ? 0 : m >= 10000 ? 1 : 2);
// Le chiffre de vitesse qui parle selon le sport
const vitesseSortie = s => {
  const f = familleSortie(s), km = (s.distance || 0) / 1000;
  if (!km || !s.duree) return null;
  if (f === "velo") return { v: nb(km / (s.duree / 3600)) + " km/h", l: "vitesse moyenne" };
  if (f === "nage") return { v: chrono(s.duree / (km * 10)), l: "allure aux 100 m" };
  return { v: allureDe(s.duree, km), l: "allure au km" };
};
const distanceSortie = s => familleSortie(s) === "nage" ? entier(s.distance) + " m" : kmDe(s.distance) + " km";
const resumeSortie = s => [s.distance > 0 && distanceSortie(s), chrono(s.duree), s.fcMoy && s.fcMoy + " bpm"].filter(Boolean).join(" · ");

/* Carte : tuiles OpenStreetMap à l'échelle qui fait tenir tout le parcours, tracé par-dessus */
const TUILE_OSM = 256;
const projeter = (lat, lon, z) => { const n = TUILE_OSM * 2 ** z, s = Math.sin(lat * Math.PI / 180); return [(lon + 180) / 360 * n, (.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
function CarteTrace({ trace }) {
  const W = 340, H = 230, marge = 20;
  const lats = trace.map(p => p[0]), lons = trace.map(p => p[1]);
  const coins = z => [projeter(Math.max(...lats), Math.min(...lons), z), projeter(Math.min(...lats), Math.max(...lons), z)];
  let z = 17;
  while (z > 3) { const [a, b] = coins(z); if (b[0] - a[0] <= W - 2 * marge && b[1] - a[1] <= H - 2 * marge) break; z--; }
  const [a, b] = coins(z), x0 = (a[0] + b[0]) / 2 - W / 2, y0 = (a[1] + b[1]) / 2 - H / 2, n = 2 ** z;
  const tuiles = [];
  for (let tx = Math.floor(x0 / TUILE_OSM); tx <= Math.floor((x0 + W) / TUILE_OSM); tx++)
    for (let ty = Math.max(0, Math.floor(y0 / TUILE_OSM)); ty <= Math.min(n - 1, Math.floor((y0 + H) / TUILE_OSM)); ty++) tuiles.push([tx, ty]);
  const pts = trace.map(p => { const q = projeter(p[0], p[1], z); return [q[0] - x0, q[1] - y0]; });
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" "), dep = pts[0], arr = pts[pts.length - 1];
  return h("div.carte", { style: { paddingBottom: H / W * 100 + "%" } },
    tuiles.map(([tx, ty]) => h("img", {
      key: tx + "/" + ty, alt: "", draggable: false, src: "https://tile.openstreetmap.org/" + z + "/" + ((tx % n) + n) % n + "/" + ty + ".png",
      style: { left: (tx * TUILE_OSM - x0) / W * 100 + "%", top: (ty * TUILE_OSM - y0) / H * 100 + "%", width: TUILE_OSM / W * 100 + .3 + "%", height: TUILE_OSM / H * 100 + .3 + "%" },
      onError: e => { e.target.style.visibility = "hidden"; },
    })),
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Parcours" },
      h("path.trace-fond", { d }), h("path.trace", { d }),
      h("circle.arrivee", { cx: arr[0], cy: arr[1], r: 5.5 }), h("circle.depart", { cx: dep[0], cy: dep[1], r: 5.5 })),
    h("a.osm", { href: "https://www.openstreetmap.org/copyright", target: "_blank", rel: "noopener" }, "© OpenStreetMap"));
}

/* Courbe dans le temps : `serie` = { pas (s), v: [...] }. Toucher affiche la valeur à ce moment. */
function CourbeTemps({ serie, ton, format, unite, inverse, haut }) {
  const H = haut || 140, mh = 10, mb = 22, ml = 4, mr = 40;
  const [sel, setSel] = useState(null), svg = useRef(null);
  const pts = serie.v.map((y, i) => ({ t: i * serie.pas, y })).filter(p => p.y != null && isFinite(p.y));
  if (pts.length < 2) return null;
  const ys = pts.map(p => p.y);
  let max = Math.max(...ys), min = Math.min(...ys);
  if (max === min) { max += 1; min -= 1; }
  const T = pts[pts.length - 1].t || 1, fmt = format || (x => entier(x));
  const X = t => ml + t / T * (LARG - ml - mr), Y = y => mh + (inverse ? y - min : max - y) / (max - min) * (H - mh - mb);
  const ligne = pts.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ");
  const bas = inverse ? mh : H - mb, aire = ligne + ` L${X(T).toFixed(1)} ${bas} L${X(0).toFixed(1)} ${bas} Z`;
  const lire = e => {
    const b = svg.current.getBoundingClientRect(), x = ((e.touches ? e.touches[0].clientX : e.clientX) - b.left) / b.width * LARG;
    const t = borne((x - ml) / (LARG - ml - mr), 0, 1) * T;
    let k = 0; pts.forEach((p, i) => { if (Math.abs(p.t - t) < Math.abs(pts[k].t - t)) k = i; });
    setSel(k);
  };
  const p = sel != null ? pts[sel] : null, id = "gt" + (ton || "x") + H;
  return h("div.courbe", { "data-ton": ton },
    h("svg", { ref: svg, viewBox: `0 0 ${LARG} ${H}`, role: "img", "aria-label": "Courbe", onTouchStart: lire, onTouchMove: lire, onTouchEnd: () => setSel(null), onPointerMove: e => { if (e.pointerType === "mouse") lire(e); }, onPointerLeave: () => setSel(null) },
      h("defs", h("linearGradient", { id, x1: 0, y1: inverse ? 1 : 0, x2: 0, y2: inverse ? 0 : 1 }, h("stop", { offset: 0, stopColor: "currentColor", stopOpacity: .22 }), h("stop", { offset: 1, stopColor: "currentColor", stopOpacity: 0 }))),
      [min, (min + max) / 2, max].map((g, i) => h(Fragment, { key: i }, h("line.gr", { x1: ml, x2: LARG - mr, y1: Y(g), y2: Y(g) }), h("text.ax", { x: LARG - mr + 5, y: Y(g) + 4 }, fmt(g)))),
      h("path", { d: aire, fill: `url(#${id})`, stroke: "none" }),
      h("path.tr", { d: ligne, fill: "none" }),
      [0, T / 2, T].map((t, i) => h("text.ax", { key: i, x: X(t), y: H - 6, textAnchor: i === 0 ? "start" : i === 2 ? "end" : "middle" }, chrono(t))),
      p && h("line.cur", { x1: X(p.t), x2: X(p.t), y1: mh, y2: H - mb }),
      p && h("circle.fin", { cx: X(p.t), cy: Y(p.y), r: 5 })),
    p && h("div.bulle-gr", { style: { left: borne(X(p.t) / LARG * 100, 14, 78) + "%" } }, h("b", fmt(p.y) + (unite ? " " + unite : "")), h("span", chrono(p.t))));
}

/* Zones de FC : temps passé dans chacune, de la plus facile (1) à la plus dure (5) */
function ZonesFC({ zones }) {
  const z = [...zones].filter(x => x.s >= 0).sort((a, b) => b.i - a.i), tot = z.reduce((a, x) => a + x.s, 0) || 1;
  return h("div.zones-fc", z.map(x => h("div", { key: x.i, "data-z": x.i },
    h("span", "Zone " + x.i, h("small", x.bas + "–" + x.haut)),
    h("div.zone-b", h("i", { style: { width: x.s / tot * 100 + "%" } })),
    h("b", chrono(x.s)))));
}

/* Tours au km (aux 100 m en natation) : la barre est d'autant plus longue que le tour est rapide */
function ToursKm({ tours, famille }) {
  const nage = famille === "nage", u = nage ? 100 : 1000, vit = t => t.d / t.s, vmax = Math.max(...tours.map(vit));
  return h("div.tours", h("div.tours-t", h("span", nage ? "M" : "Km"), h("span", famille === "velo" ? "Vitesse" : "Allure"), h("span"), h("span", "FC")),
    tours.map(t => h("div", { key: t.n },
      h("span", nage ? entier(t.n) : t.n % 1000 ? nb(t.n / 1000, 2) : t.n / 1000),
      h("b", famille === "velo" ? nb(vit(t) * 3.6) : chrono(t.s / (t.d / u))),
      h("div.zone-b", h("i", { style: { width: vit(t) / vmax * 100 + "%" } })),
      h("span", t.fc || "—"))));
}

/* Bouton d'import, avec un import silencieux au plus toutes les 30 minutes */
function useImportPolar() {
  const [charge, setCharge] = useState(false), relie = !!lienPolar()?.jeton;
  const lancer = async silencieux => {
    if (!relie || charge) return;
    setCharge(true);
    try {
      const n = await importerSortiesPolar();
      if (n || !silencieux) toast(n ? pluriel(n, "séance") + " récupérée" + (n > 1 ? "s" : "") + " depuis ta montre" : "Rien de nouveau. Synchronise ta montre avec Polar Flow, puis réessaie.");
    } catch (e) { if (!silencieux) toast("Polar : " + e.message, { danger: true }); }
    finally { setCharge(false); }
  };
  useEffect(() => {
    let der = 0;
    try { der = +localStorage.getItem("recomp_polar_import") || 0; } catch (e) { /* facultatif */ }
    if (relie && Date.now() - der > 30 * 60000) lancer(true);
  }, [relie]);
  return { relie, charge, lancer };
}

const LigneSortie = ({ s }) => h("button.ligne", { onClick: () => Nav.sheet("sortie", { id: s.id }) },
  h("span", h("b", nomSortie(s)), h("small", dateMini(s.dateISO) + (s.debut ? " à " + s.debut.slice(11, 16) : ""))),
  h("b", resumeSortie(s)));

/* Bloc de l'onglet Sport */
function SectionSorties() {
  useDB();
  const imp = useImportPolar(), l = sortiesPolar();
  if (!imp.relie && !l.length) return null;
  return h(Section, { titre: "Sorties de ta montre", droite: l.length > 3 ? h(Lien, { onClick: () => Nav.sheet("sorties") }, "Tout voir") : null },
    l.length ? h("div.liste", l.slice(0, 3).map(s => h(LigneSortie, { key: s.id, s })))
      : h(Vide, null, "Tes séances Polar apparaîtront ici : parcours, kilomètres, fréquence cardiaque. Seules celles synchronisées après la liaison sont disponibles."),
    imp.relie && h(Bouton, { cl: "contour" + (imp.charge ? " occupe" : ""), ico: "trace", disabled: imp.charge, onClick: () => imp.lancer(false) }, imp.charge ? "Lecture de ta montre…" : "Récupérer mes séances Polar"));
}

function FeuilleSorties() {
  useDB();
  const imp = useImportPolar(), l = sortiesPolar();
  const km = l.filter(s => ecart(s.dateISO, aujourdhui()) < 7).reduce((a, s) => a + (s.distance || 0), 0) / 1000;
  return h(Feuille, { titre: "Sorties", ton: "sport" },
    h("div.tuiles", h(Tuile, { v: nb(km), l: "km sur 7 jours" }), h(Tuile, { v: l.length, l: "séances importées" })),
    l.length ? h("div.liste", l.map(s => h(LigneSortie, { key: s.id, s }))) : h(Vide, null, "Aucune séance pour l'instant."),
    imp.relie && h(Bouton, { cl: "contour" + (imp.charge ? " occupe" : ""), ico: "trace", disabled: imp.charge, onClick: () => imp.lancer(false) }, imp.charge ? "Lecture de ta montre…" : "Récupérer mes séances Polar"));
}

/* Tout ce que la montre a mesuré : chiffres clés, courbes, zones, tours. Sert aussi dans le détail d'une séance de muscu ou de natation. */
function BlocMontre({ s }) {
  const f = familleSortie(s), v = vitesseSortie(s), allure = f === "course" || f === "marche";
  // Allure en min/km : on ignore les arrêts et on plafonne pour garder une courbe lisible.
  // En natation, pas de courbe : les pauses au mur la hachent ; le tableau aux 100 m est plus clair.
  const serieAllure = s.vit && allure ? { pas: s.vit.pas, v: s.vit.v.map(x => x > 3 ? Math.min(60 / x, f === "marche" ? 20 : 12) : null) } : null;
  return h(Fragment, null,
    s.trace?.length > 1 && h(CarteTrace, { trace: s.trace }),
    h("div.tuiles",
      s.distance > 0 && (f === "nage" ? h(Tuile, { v: entier(s.distance), l: "mètres" }) : h(Tuile, { v: kmDe(s.distance), l: "km" })),
      h(Tuile, { v: chrono(s.duree), l: "durée" }),
      v && h(Tuile, { v: v.v, l: v.l }),
      s.fcMoy && h(Tuile, { v: s.fcMoy, l: "FC moyenne" }),
      s.fcMax && h(Tuile, { v: s.fcMax, l: "FC max" }),
      s.deniv > 0 && f !== "nage" && h(Tuile, { v: s.deniv + " m", l: "dénivelé +" }),
      s.kcal && h(Tuile, { v: entier(s.kcal), l: "kcal (montre)" }),
      s.charge != null && h(Tuile, { v: s.charge, l: "charge Polar" })),
    s.fc && h(Section, { titre: "Fréquence cardiaque" }, h(CourbeTemps, { serie: s.fc, ton: "sport", unite: "bpm" })),
    s.zones?.some(z => z.s > 0) && h(Section, { titre: "Temps par zone de FC" }, h(ZonesFC, { zones: s.zones })),
    serieAllure && h(Section, { titre: "Allure" }, h(CourbeTemps, { serie: serieAllure, ton: "sport", unite: "/km", inverse: true, format: x => chrono(x * 60) })),
    s.vit && f === "velo" && h(Section, { titre: "Vitesse" }, h(CourbeTemps, { serie: s.vit, ton: "sport", unite: "km/h", format: x => nb(x, 0) })),
    s.alt && s.deniv > 0 && f !== "nage" && h(Section, { titre: "Altitude" }, h(CourbeTemps, { serie: s.alt, ton: "sport", unite: "m", haut: 110 })),
    s.tours?.length > 1 && h(Section, { titre: f === "nage" ? "Temps aux 100 m" : "Tours au km" }, h(ToursKm, { tours: s.tours, famille: f })));
}

/* Une nage de la montre devient une séance de natation RECOMP (records, calories du jour) */
async function ajouterANatation(s) {
  const rpe = await saisir({ titre: "Difficulté ressentie", court: "Effort", valeur: 6, mode: "ent", unite: "/10", pas: [1], min: 1, max: 10 });
  if (rpe == null) return;
  const kg = moyenneRecente(pesees(), 7) || 100, dist = Math.round(s.distance || 0);
  await DB.set("natation-logs", [...DB.get("natation-logs"), { id: Date.now(), dateISO: s.dateISO, date: dateCourte(s.dateISO), modele: "Nage de la montre", distance: dist, duree: s.duree, rpe: rpe || 6, nage: "Crawl", pool: 25, note: "", kcal: nageKcal(dist, s.duree, rpe || 6, kg), polarId: s.id }]);
  toast(entier(dist) + " m ajoutés à ta natation");
}

function FeuilleSortie({ id }) {
  useDB();
  const s = sortiesPolar().find(x => x.id === id);
  if (!s) return h(Feuille, { titre: "Sortie" }, h(Vide, null, "Séance retirée."));
  const f = familleSortie(s), lie = logDeSortie(s);
  return h(Feuille, { titre: nomSortie(s), ton: "sport" },
    h("p.sous-t", dateLongue(s.dateISO) + (s.debut ? " à " + s.debut.slice(11, 16) : "") + (s.appareil ? " · " + s.appareil : "")),
    lie?.t === "s" && h(Rangee, { ico: "sport", titre: "Ta séance " + lie.log.seance, sous: "Charges et séries notées dans RECOMP", onClick: () => Nav.sheet("seanceDetail", { id: lie.log.id }) }),
    lie?.t === "n" && h(Rangee, { ico: "nage", titre: "Dans ta natation", sous: entier(lie.log.distance) + " m notés le " + dateMini(lie.log.dateISO), onClick: () => Nav.sheet("natation") }),
    h(BlocMontre, { s }),
    f === "nage" && !lie && s.distance > 0 && h(Bouton, { cl: "plein", ico: "nage", onClick: () => ajouterANatation(s) }, "Ajouter à ma natation"),
    h("p.note", "Les calories et la charge sont celles calculées par ta montre. Ces séances ne changent pas ton score de forme."),
    h(Bouton, { cl: "contour danger-t", onClick: () => { Nav.fermer(); retirerSortie(s.id); } }, "Retirer de RECOMP"));
}
