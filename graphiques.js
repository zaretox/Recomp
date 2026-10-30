"use strict";
/* GRAPHIQUES — SVG natifs, sans bibliothèque. Toucher et glisser sur une courbe affiche la valeur du jour. */
const LARG = 340;

/* Courbe : `pts` = [{ x (iso), y, brut? }]. Trait épais = la tendance, points pâles = les pesées brutes. */
function Courbe({ pts, unite, haut, ton, format, repere }) {
  const H = haut || 170, mh = 12, mb = 22, ml = 4, mr = 34;
  const [survol, setSurvol] = useState(null);
  const svg = useRef(null);
  const v = pts.filter(p => p.y != null);
  if (v.length < 2) return h(Vide, null, "Il faut au moins deux points pour tracer une courbe.");
  const toutes = [...v.map(p => p.y), ...v.filter(p => p.brut != null).map(p => p.brut), ...(repere != null ? [repere] : [])];
  let max = Math.max(...toutes), min = Math.min(...toutes);
  if (max === min) { max += 1; min -= 1; }
  const marge = (max - min) * .08; max += marge; min -= marge;
  const n = v.length, X = i => ml + i * (LARG - ml - mr) / (n - 1), Y = y => mh + (max - y) / (max - min) * (H - mh - mb);
  const ligne = v.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ");
  const aire = ligne + ` L${X(n - 1).toFixed(1)} ${H - mb} L${X(0).toFixed(1)} ${H - mb} Z`;
  const fmt = format || (x => nb(x));
  const id = "g" + (ton || "x") + H;
  const lire = e => {
    const b = svg.current.getBoundingClientRect(), x = (e.touches ? e.touches[0].clientX : e.clientX) - b.left;
    setSurvol(borne(Math.round((x / b.width * LARG - ml) / (LARG - ml - mr) * (n - 1)), 0, n - 1));
  };
  const d = survol != null ? v[survol] : null, fin = v[n - 1];
  const graduations = [min + marge, (min + max) / 2, max - marge];
  return h("div.courbe", { "data-ton": ton },
    h("svg", {
      ref: svg, viewBox: `0 0 ${LARG} ${H}`, role: "img", "aria-label": "Courbe, dernière valeur " + fmt(fin.y) + (unite || ""),
      onTouchStart: lire, onTouchMove: lire, onTouchEnd: () => setSurvol(null), onPointerMove: e => { if (e.pointerType === "mouse") lire(e); }, onPointerLeave: () => setSurvol(null),
    },
      h("defs", h("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, h("stop", { offset: 0, stopColor: "currentColor", stopOpacity: .22 }), h("stop", { offset: 1, stopColor: "currentColor", stopOpacity: 0 }))),
      graduations.map((g, i) => h(Fragment, { key: i },
        h("line.gr", { x1: ml, x2: LARG - mr, y1: Y(g), y2: Y(g) }),
        h("text.ax", { x: LARG - mr + 5, y: Y(g) + 4 }, fmt(g)))),
      repere != null && h("line.rep", { x1: ml, x2: LARG - mr, y1: Y(repere), y2: Y(repere) }),
      h("path", { d: aire, fill: `url(#${id})`, stroke: "none" }),
      v.map((p, i) => p.brut != null && h("circle.brut", { key: i, cx: X(i), cy: Y(p.brut), r: 2 })),
      h("path.tr", { d: ligne, fill: "none" }),
      h("circle.fin", { cx: X(n - 1), cy: Y(fin.y), r: 4.5 }),
      [0, n - 1].map(i => h("text.ax", { key: i, x: i ? LARG - mr : ml, y: H - 6, textAnchor: i ? "end" : "start" }, dateMini(v[i].x))),
      d && h("line.cur", { x1: X(survol), x2: X(survol), y1: mh, y2: H - mb }),
      d && h("circle.fin", { cx: X(survol), cy: Y(d.y), r: 5 })),
    d && h("div.bulle-gr", { style: { left: borne(X(survol) / LARG * 100, 14, 78) + "%" } }, h("b", fmt(d.y) + (unite ? " " + unite : "")), h("span", dateMini(d.x))));
}

/* Barres : `pts` = [{ l, v, iso? }]. Toucher une barre donne sa valeur. */
function Barres({ pts, haut, ton, unite, cible }) {
  const H = haut || 130, mb = 20, mh = 18;
  const [sel, setSel] = useState(null);
  if (!pts.length) return null;
  const max = Math.max(...pts.map(p => p.v || 0), cible || 0, 1) * 1.05;
  const n = pts.length, slot = LARG / n, l = Math.min(slot - 3, 26);
  return h("div.courbe", { "data-ton": ton },
    h("svg", { viewBox: `0 0 ${LARG} ${H}`, role: "img", "aria-label": "Histogramme" },
      cible != null && h("line.rep", { x1: 0, x2: LARG, y1: mh + (1 - cible / max) * (H - mb - mh), y2: mh + (1 - cible / max) * (H - mb - mh) }),
      pts.map((p, i) => {
        const hb = Math.max(p.v ? 3 : 0, (p.v || 0) / max * (H - mb - mh)), x = i * slot + (slot - l) / 2;
        return h("g", { key: i, onClick: () => setSel(sel === i ? null : i) },
          h("rect", { x: i * slot, y: 0, width: slot, height: H, fill: "transparent" }),
          h("rect.barre", { x, y: H - mb - hb, width: l, height: hb, rx: 3, style: { opacity: sel == null || sel === i ? 1 : .45 } }),
          (i % Math.ceil(n / 8) === 0 || i === n - 1) && h("text.ax", { x: x + l / 2, y: H - 6, textAnchor: "middle" }, p.l),
          sel === i && h("text.val", { x: borne(x + l / 2, 22, LARG - 22), y: Math.max(12, H - mb - hb - 5), textAnchor: "middle" }, nb(p.v) + (unite || "")));
      })));
}

/* Mur de régularité : une case par jour, plus c'est plein mieux la journée a été suivie */
function Mur({ jours }) {
  const colonnes = [];
  for (let i = 0; i < jours.length; i += 7) colonnes.push(jours.slice(i, i + 7));
  return h("div.mur", { role: "img", "aria-label": "Régularité des dernières semaines" }, colonnes.map((c, i) => h("div", { key: i }, c.map(j => h("i", { key: j.iso, "data-n": j.n, title: dateMini(j.iso) })))));
}
