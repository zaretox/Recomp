"use strict";
/* SCHÉMAS — un bonhomme animé par exercice : le corps, le matériel, le muscle en couleur, et une flèche pour le sens de la charge.
 * Tout est dessiné en SVG, sans image : léger, hors ligne, et aux couleurs du thème.
 *
 * Une pose donne des angles en degrés : 0 = vers le bas, 90 = vers l'avant (la droite), 180 = vers le haut.
 *   torse  : de la hanche vers l'épaule (180 = droit).
 *   bras, avbras : relatifs au torse (0 = le long du corps quand le torse est droit). [près, loin]
 *   cuisse, tibia : absolus. [près, loin]
 *   ancre  : « pieds » (chevilles fixes, au sol) ou « hanche » (assis, allongé).
 * Vue « face » : 90 = vers l'extérieur ; le côté gauche est le miroir du droit. */

const L_CORPS = { torse: 48, cou: 15, tete: 10, bras: 27, avbras: 25, cuisse: 42, tibia: 40, pied: 13 };
const rad = a => a * Math.PI / 180;
const dirA = (a, l) => [Math.sin(rad(a)) * l, Math.cos(rad(a)) * l];
const plus = (p, v) => [p[0] + v[0], p[1] + v[1]];
const paire = v => Array.isArray(v) ? v : [v, v];

/* Les positions des articulations pour une pose */
function articulations(p) {
  const cu = paire(p.cuisse ?? 0), ti = paire(p.tibia ?? 0), br = paire(p.bras ?? 0), ab = paire(p.avbras ?? 0), pi = paire(p.pied ?? 90);
  const t = p.torse ?? 180, rel = a => a + t - 180;
  if (p.vue === "face") {
    const hanche = p.hanche, cou = plus(hanche, [0, -L_CORPS.torse]);
    const cote = s => {
      const ep = plus(cou, [s * 14, 4]), hp = plus(hanche, [s * 8, 0]);
      const m = v => [s * v[0], v[1]];
      const coude = plus(ep, m(dirA(br[0], L_CORPS.bras))), main = plus(coude, m(dirA(ab[0], L_CORPS.avbras)));
      const genou = plus(hp, m(dirA(cu[0], L_CORPS.cuisse))), cheville = plus(genou, m(dirA(ti[0], L_CORPS.tibia)));
      return { ep, hp, coude, main, genou, cheville, orteil: plus(cheville, m([7, 0])) };
    };
    return { vue: "face", hanche, cou, tete: plus(cou, [0, -L_CORPS.cou]), cotes: [cote(1), cote(-1)] };
  }
  let hanche = p.hanche;
  if (p.ancre === "pieds") {
    const v1 = dirA(cu[0], L_CORPS.cuisse), v2 = dirA(ti[0], L_CORPS.tibia);
    hanche = [p.cheville[0] - v1[0] - v2[0], p.cheville[1] - v1[1] - v2[1]];
  }
  const epaule = plus(hanche, dirA(t, L_CORPS.torse)), tete = plus(epaule, dirA(t + (p.tete || 0), L_CORPS.cou));
  const cote = i => {
    const coude = plus(epaule, dirA(rel(br[i]), L_CORPS.bras)), main = plus(coude, dirA(rel(ab[i]), L_CORPS.avbras));
    const genou = plus(hanche, dirA(cu[i], L_CORPS.cuisse)), cheville = plus(genou, dirA(ti[i], L_CORPS.tibia));
    return { ep: epaule, hp: hanche, coude, main, genou, cheville, orteil: plus(cheville, dirA(pi[i], L_CORPS.pied)) };
  };
  return { vue: "profil", hanche, cou: epaule, tete, cotes: [cote(0), cote(1)] };
}

/* Mélange de deux poses, nombre par nombre */
const melange = (a, b, k) => {
  if (typeof a === "number") return a + ((b ?? a) - a) * k;
  if (Array.isArray(a)) return a.map((x, i) => melange(x, Array.isArray(b) ? b[i] : b, k));
  if (a && typeof a === "object") { const o = {}; Object.keys(a).forEach(c => { o[c] = melange(a[c], b?.[c], k); }); return o; }
  return a;
};
const poseA = (s, k) => melange({ ...s.depart, vue: s.vue }, s.arrivee, k);
const pointSuivi = (j, quoi) => quoi === "epaule" ? j.cotes[0].ep : quoi === "hanche" ? j.hanche : j.cotes[0].main;

/* Le dessin d'une pose */
function Bonhomme({ j, muscle, fantome }) {
  const m = new Set(muscle || []);
  const trait = (a, b, cle, loin) => h("line", { key: cle + (loin ? "l" : "p"), x1: a[0], y1: a[1], x2: b[0], y2: b[1], className: "sq-m" + (loin ? " loin" : "") + (m.has(cle) && !fantome ? " actif" : "") });
  const membre = (c, loin) => [
    trait(c.hp, c.genou, "cuisse", loin), trait(c.genou, c.cheville, "tibia", loin), trait(c.cheville, c.orteil, "pied", loin),
    trait(c.ep, c.coude, "bras", loin), trait(c.coude, c.main, "avbras", loin)];
  const face = j.vue === "face", [p, l] = j.cotes;
  return h("g", { className: fantome ? "sq-fantome" : "" },
    !face && membre(l, true),
    face && h("line", { x1: p.ep[0], y1: p.ep[1], x2: l.ep[0], y2: l.ep[1], className: "sq-m tronc" + (m.has("torse") && !fantome ? " actif" : "") }),
    face && h("line", { x1: p.hp[0], y1: p.hp[1], x2: l.hp[0], y2: l.hp[1], className: "sq-m" }),
    h("line", { x1: j.hanche[0], y1: j.hanche[1], x2: j.cou[0], y2: j.cou[1], className: "sq-m tronc" + (m.has("torse") && !fantome ? " actif" : "") }),
    face ? [membre(l, false), membre(p, false)] : membre(p, false),
    m.has("epaules") && !fantome && (face ? [p, l] : [p]).map((c, i) => h("circle", { key: "ep" + i, cx: c.ep[0], cy: c.ep[1], r: 7, className: "sq-epaule" })),
    h("circle", { cx: j.tete[0], cy: j.tete[1], r: L_CORPS.tete, className: "sq-tete" }));
}

/* Le matériel tenu ou porté, qui suit le corps */
function Objets({ j, objets }) {
  return (objets || []).map((o, i) => {
    const mains = j.vue === "face" ? j.cotes : [j.cotes[1], j.cotes[0]];
    if (o.t === "halteres") return h("g", { key: i }, mains.map((c, k) => h("g", { key: k, className: j.vue !== "face" && k === 0 ? "loin" : "" },
      h("circle", { cx: c.main[0], cy: c.main[1], r: 8, className: "sq-disque" }), h("circle", { cx: c.main[0], cy: c.main[1], r: 2.5, className: "sq-axe" }))));
    if (o.t === "barre") {
      const c = o.sur === "dos" ? plus(j.cotes[0].ep, o.decale || [-7, -2]) : j.cotes[0].main;
      return h("g", { key: i }, h("circle", { cx: c[0], cy: c[1], r: 15, className: "sq-disque" }), h("circle", { cx: c[0], cy: c[1], r: 3, className: "sq-axe" }));
    }
    if (o.t === "cable") {
      const c = j.cotes[0].main;
      return h("g", { key: i }, h("line", { x1: o.de[0], y1: o.de[1], x2: c[0], y2: c[1], className: "sq-cable" }), h("rect", { x: c[0] - 9, y: c[1] - 3, width: 18, height: 6, rx: 3, className: "sq-poignee" }));
    }
    return null;
  });
}

/* Le décor fixe : sol, banc, poulie, appuis */
function Decor({ decor }) {
  return (decor || []).map((d, i) => {
    if (d.t === "sol") return h("line", { key: i, x1: 10, y1: d.y || 184, x2: 190, y2: d.y || 184, className: "sq-sol" });
    if (d.t === "banc" || d.t === "appui") return h("rect", { key: i, x: d.x, y: d.y, width: d.l, height: d.h || 8, rx: 3, className: d.t === "appui" ? "sq-appui" : "sq-banc" });
    if (d.t === "pied") return h("line", { key: i, x1: d.x, y1: d.y, x2: d.x, y2: d.y2, className: "sq-banc-p" });
    if (d.t === "poulie") return h("g", { key: i }, h("line", { x1: d.x, y1: 0, x2: d.x, y2: d.y, className: "sq-banc-p" }), h("circle", { cx: d.x, cy: d.y, r: 6, className: "sq-poulie" }));
    return null;
  });
}

/* Flèche double qui suit le trajet de la charge entre le départ et l'arrivée */
function Fleche({ s, id }) {
  const f = s.fleche || {}, pts = [];
  for (let i = 0; i <= 16; i++) pts.push(plus(pointSuivi(articulations(poseA(s, i / 16)), f.suit), f.decale || [16, 0]));
  return h("path", { d: "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L"), className: "sq-fleche", markerStart: `url(#${id}d)`, markerEnd: `url(#${id}a)` });
}

const ease = x => .5 - Math.cos(Math.PI * x) / 2;
/* Le schéma complet, animé en boucle : départ → arrivée → départ */
function Schema({ s, fixe }) {
  const id = "sq" + React.useId().replace(/:/g, "");
  const calme = useMemo(() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }, []);
  const [pause, setPause] = useState(calme), [kAnim, setK] = useState(calme ? 1 : 0);
  const k = fixe ?? kAnim;  // fixe : une image arrêtée (0 = départ, 1 = arrivée)
  useEffect(() => {
    if (pause || fixe != null) return;
    let raf, debut = performance.now() - k * 1500;
    const boucle = now => {
      const t = ((now - debut) / 1000) % 3.8;  // 1,5 s aller, 0,4 s arrêt, 1,5 s retour, 0,4 s arrêt
      setK(t < 1.5 ? ease(t / 1.5) : t < 1.9 ? 1 : t < 3.4 ? 1 - ease((t - 1.9) / 1.5) : 0);
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [pause]);
  const j = articulations(poseA(s, k));
  return h("figure.schema", null,
    h("svg", { viewBox: "0 0 200 200", role: "img", "aria-label": s.legende || "Schéma du mouvement" },
      h("defs", null,
        h("marker", { id: id + "a", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 4, markerHeight: 4, orient: "auto" }, h("path", { d: "M0 0 L10 5 L0 10 z", className: "sq-pointe" })),
        h("marker", { id: id + "d", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 4, markerHeight: 4, orient: "auto-start-reverse" }, h("path", { d: "M0 0 L10 5 L0 10 z", className: "sq-pointe" }))),
      h(Decor, { decor: s.decor }),
      pause && h(Bonhomme, { j: articulations(poseA(s, k > .5 ? 0 : 1)), fantome: true }),
      h(Fleche, { s, id }),
      h(Objets, { j, objets: s.objets }),
      h(Bonhomme, { j, muscle: s.muscle }),
      s.objetsDevant && h(Objets, { j, objets: s.objetsDevant })),
    fixe == null && h("figcaption",
      h("span", { className: k < .5 ? "actif" : "" }, "Départ"), h("i", { "aria-hidden": true }), h("span", { className: k >= .5 ? "actif" : "" }, "Arrivée"),
      h("button.rond.petit", { onClick: () => { vibre(); setPause(!pause); }, "aria-label": pause ? "Lancer l'animation" : "Mettre en pause" }, h(Icone, { n: pause ? "fleche" : "chrono", t: 16 }))));
}

/* ── Les schémas. Prototype : 4 exercices ── */
const SCHEMAS = {
  "Squat": {
    legende: "Squat vu de profil : la barre sur le haut du dos, on descend cuisses parallèles puis on remonte.",
    depart: { ancre: "pieds", cheville: [96, 178], cuisse: 0, tibia: 0, torse: 180, bras: -16, avbras: 172 },
    arrivee: { cuisse: 82, tibia: -32, torse: 145 },
    objets: [{ t: "barre", sur: "dos" }], muscle: ["cuisse"], fleche: { suit: "epaule", decale: [-34, 0] },
    decor: [{ t: "sol", y: 181 }],
  },
  "Curl biceps": {
    legende: "Curl haltère vu de profil : le coude reste collé au corps, seul l'avant-bras monte.",
    depart: { ancre: "pieds", cheville: [94, 178], torse: 180, bras: [4, -4], avbras: [6, 2] },
    arrivee: { avbras: [148, 140] },
    objets: [{ t: "halteres" }], muscle: ["bras"], fleche: { suit: "main", decale: [18, 0] },
    decor: [{ t: "sol", y: 181 }],
  },
  "Élévations lat.": {
    vue: "face",
    legende: "Élévations latérales vues de face : bras sur les côtés jusqu'à l'horizontale, coudes légèrement fléchis.",
    depart: { hanche: [100, 100], bras: 12, avbras: 8, cuisse: 4, tibia: 2 },
    arrivee: { bras: 86, avbras: 80 },
    objets: [{ t: "halteres" }], muscle: ["epaules"], fleche: { suit: "main", decale: [10, 16] },
    decor: [{ t: "sol", y: 181 }],
  },
  "Tirage vertical": {
    legende: "Tirage vertical vu de profil : assis, cuisses calées, on tire la barre vers le haut de la poitrine.",
    depart: { hanche: [92, 128], torse: 195, tete: -10, cuisse: 92, tibia: 4, pied: 90, bras: 163, avbras: 163 },
    arrivee: { bras: -25, avbras: 138 },
    objets: [{ t: "cable", de: [84, 6] }], muscle: ["torse"], fleche: { suit: "main", decale: [22, 0] },
    decor: [{ t: "banc", x: 70, y: 134, l: 46 }, { t: "pied", x: 93, y: 142, y2: 181 }, { t: "appui", x: 118, y: 116, l: 26, h: 8 }, { t: "poulie", x: 84, y: 6 }, { t: "sol", y: 181 }],
  },
};
const schemaDe = nom => SCHEMAS[nom] || SCHEMAS[nomDeFiche(nom)] || null;
