"use strict";
/* SCHÉMAS — le moteur : un bonhomme animé, le matériel, le muscle en couleur, une flèche pour le sens de la charge,
 * et la courbe d'effort. Les exercices eux-mêmes sont décrits dans mouvements.js.
 * Tout est dessiné en SVG, sans image : léger, hors ligne, et aux couleurs du thème.
 *
 * Une pose donne des angles en degrés : 0 = vers le bas, 90 = vers l'avant (la droite), 180 = vers le haut.
 *   torse  : de la hanche vers l'épaule (180 = debout ; 270 = allongé sur le dos, tête à gauche ; 90 = à plat ventre, tête à droite).
 *   bras, avbras : relatifs au torse (0 = le long du corps quand le torse est droit), ou absolus si brasAbs. [près, loin]
 *   cuisse, tibia : absolus. [près, loin]
 *   ancre  : ce qui reste fixe — « pieds » (cheville), « mains » (main), « genoux » (genou) ou, par défaut, la hanche.
 * Vue « face » : 90 = vers l'extérieur ; le côté gauche est le miroir du droit. */

const L_CORPS = { torse: 48, cou: 15, tete: 10, bras: 27, avbras: 25, cuisse: 42, tibia: 40, pied: 13 };
const rad = a => a * Math.PI / 180;
const dirA = (a, l) => [Math.sin(rad(a)) * l, Math.cos(rad(a)) * l];
const plus = (p, v) => [p[0] + v[0], p[1] + v[1]];
const moins = (p, v) => [p[0] - v[0], p[1] - v[1]];
const paire = v => Array.isArray(v) ? v : [v, v];

/* Les positions des articulations pour une pose */
function articulations(p) {
  const cu = paire(p.cuisse ?? 0), ti = paire(p.tibia ?? 0), br = paire(p.bras ?? 0), ab = paire(p.avbras ?? 0), pi = paire(p.pied ?? 90);
  const t = p.torse ?? 180, rel = a => p.brasAbs ? a : a + t - 180;
  if (p.vue === "face" || p.vue === "bout") {
    // vue de face, éventuellement pivotée (couché sur le côté : t = 270, tête à gauche, côté droit en haut)
    const th = rad(t - 180), rot = v => [v[0] * Math.cos(th) + v[1] * Math.sin(th), -v[0] * Math.sin(th) + v[1] * Math.cos(th)];
    const m1 = (s, v) => rot([s * v[0], v[1]]), lc = L_CORPS.cuisse * (p.lc ?? 1);
    let hanche = p.hanche;
    if (p.ancre === "pieds") hanche = moins(moins(moins(p.cheville, m1(1, dirA(ti[0], L_CORPS.tibia))), m1(1, dirA(cu[0], lc))), rot([8, 0]));
    const cou = plus(hanche, dirA(t, L_CORPS.torse));
    const cote = (s, i) => {
      const m = v => m1(s, v);
      const ep = plus(cou, rot([s * 14, 4 - (p.hausse || 0)])), hp = plus(hanche, rot([s * 8, 0]));
      const coude = plus(ep, m(dirA(br[i], L_CORPS.bras))), main = plus(coude, m(dirA(ab[i], L_CORPS.avbras)));
      const genou = plus(hp, m(dirA(cu[i], lc))), cheville = plus(genou, m(dirA(ti[i], L_CORPS.tibia)));
      return { ep, hp, coude, main, genou, cheville, orteil: plus(cheville, m([7, 0])) };
    };
    return { vue: p.vue, t, hanche, cou, tete: plus(cou, dirA(t + (p.tete || 0), L_CORPS.cou)), cotes: [cote(1, 0), cote(-1, 1)] };
  }
  let hanche = p.hanche;
  const vBras = dirA(rel(br[0]), L_CORPS.bras), vAvb = dirA(rel(ab[0]), L_CORPS.avbras), vTorse = dirA(t, L_CORPS.torse);
  if (p.ancre === "pieds") hanche = moins(moins(p.cheville, dirA(ti[0], L_CORPS.tibia)), dirA(cu[0], L_CORPS.cuisse));
  if (p.ancre === "orteils") hanche = moins(moins(moins(p.orteil, dirA(pi[0], L_CORPS.pied)), dirA(ti[0], L_CORPS.tibia)), dirA(cu[0], L_CORPS.cuisse));
  if (p.ancre === "genoux") hanche = moins(p.genou, dirA(cu[0], L_CORPS.cuisse));
  if (p.ancre === "mains") hanche = moins(moins(moins(p.main, vAvb), vBras), vTorse);
  const epaule = plus(hanche, vTorse), tete = plus(epaule, dirA(t + (p.tete || 0), L_CORPS.cou));
  const cote = i => {
    const coude = plus(epaule, dirA(rel(br[i]), L_CORPS.bras)), main = plus(coude, dirA(rel(ab[i]), L_CORPS.avbras));
    const genou = plus(hanche, dirA(cu[i], L_CORPS.cuisse)), cheville = plus(genou, dirA(ti[i], L_CORPS.tibia));
    return { ep: epaule, hp: hanche, coude, main, genou, cheville, orteil: plus(cheville, dirA(pi[i], L_CORPS.pied)) };
  };
  return { vue: "profil", t, hanche, cou: epaule, tete, cotes: [cote(0), cote(1)] };
}

/* Mélange de deux poses, nombre par nombre */
const melange = (a, b, k) => {
  if (typeof a === "number") return a + ((b ?? a) - a) * k;
  if (Array.isArray(a)) return a.map((x, i) => melange(x, Array.isArray(b) ? b[i] : b, k));
  if (a && typeof a === "object") { const o = {}; Object.keys(a).forEach(c => { o[c] = melange(a[c], b?.[c], k); }); return o; }
  return a;
};
const poseA = (s, k) => melange({ ...s.depart, vue: s.vue }, s.arrivee || {}, k);

/* Où se trouve la barre, l'haltère ou le point suivi */
function pointBarre(j, objets) {
  const o = (objets || []).find(x => x.t === "barre" || x.t === "disque") || {}, c = j.cotes[0];
  const base = o.sur === "dos" || o.sur === "ep" ? c.ep : o.sur === "hanche" ? j.hanche : o.sur === "genou" ? c.genou : c.main;
  return plus(base, o.decale || (o.sur === "dos" ? [-7, -2] : [0, 0]));
}
function pointSuivi(j, quoi, s) {
  const c = j.cotes[0];
  if (quoi === "epaule") return c.ep;
  if (quoi === "hanche") return j.hanche;
  if (quoi === "cheville") return c.cheville;
  if (quoi === "orteil") return c.orteil;
  if (quoi === "genou") return c.genou;
  if (quoi === "coude") return c.coude;
  if (quoi === "tete") return j.tete;
  if (quoi === "barre" || quoi === "dos") return pointBarre(j, s?.objets);
  return c.main;
}

/* Les zones de muscle : un trait de couleur le long d'un segment, côté avant ou arrière */
const ZONES = {
  pecs: ["torse", 1, .55, .95], abdos: ["torse", 1, .08, .58], dos: ["torse", -1, .35, .95], lombaires: ["torse", -1, .05, .42],
  quadriceps: ["cuisse", 1, .1, .9], ischios: ["cuisse", -1, .1, .9], adducteurs: ["cuisse", 0, .1, .8],
  mollet: ["tibia", -1, .1, .6], biceps: ["bras", 1, .12, .88], triceps: ["bras", -1, .12, .88], avbras: ["avbras", 1, .1, .85],
};
function Zones({ j, muscle }) {
  const out = [], face = j.vue === "face" || j.vue === "bout";
  const ligne = (a, b, k, plein) => out.push(h("line", { key: k, x1: a[0], y1: a[1], x2: b[0], y2: b[1], className: "sq-zone" + (plein ? " plein" : "") }));
  const rond = (p, k, r) => out.push(h("circle", { key: k, cx: p[0], cy: p[1], r: r || 7, className: "sq-zone-p" }));
  const segDe = (n, c) => n === "torse" ? [j.hanche, j.cou] : n === "cuisse" ? [c.hp, c.genou] : n === "tibia" ? [c.genou, c.cheville] : n === "bras" ? [c.ep, c.coude] : [c.coude, c.main];
  (muscle || []).forEach((m, i) => {
    if (j.vue === "bout") {
      const [p, l] = j.cotes;
      if (m === "pecs") return [p, l].forEach((c, k) => ligne(plus(c.ep, [0, 5]), [j.cou[0], j.cou[1] + 5], i + "p" + k, true));
      if (m === "epaule-arriere" || m === "dos") return [p, l].forEach((c, k) => rond(c.ep, i + "e" + k, 6.5));
      if (m === "biceps" || m === "triceps") return [p, l].forEach((c, k) => ligne(c.ep, c.coude, i + "b" + k, true));
      return;
    }
    if (face) {
      const [p, l] = j.cotes, mil = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      if (m === "fessiers") return j.cotes.forEach((c, k) => rond(plus(c.hp, [0, 4]), i + "f" + k));
      if (m === "trapezes") return j.cotes.forEach((c, k) => ligne([j.cou[0], j.cou[1] - 7], c.ep, i + "t" + k, true));
      if (m === "pecs") return j.cotes.forEach((c, k) => ligne(plus(c.ep, [0, 8]), [j.cou[0], j.cou[1] + 12], i + "p" + k, true));
      if (m === "abdos") return ligne(mil(j.hanche, j.cou, .1), mil(j.hanche, j.cou, .55), i, true);
      if (m === "dos") return j.cotes.forEach((c, k) => ligne(plus(c.ep, [0, 7]), plus(c.hp, [(c.ep[0] - j.cou[0]) * .5, -8]), i + "d" + k, true));
      if (m === "adducteurs") return j.cotes.forEach((c, k) => ligne(mil(c.hp, c.genou, .15), mil(c.hp, c.genou, .8), i + "a" + k, true));
      const z = ZONES[m]; if (!z) return;
      return j.cotes.forEach((c, k) => { const [a, b] = segDe(z[0], c); ligne(mil(a, b, z[2]), mil(a, b, z[3]), i + "z" + k, true); });
    }
    const c = j.cotes[0];
    if (m === "fessiers") return rond(plus(j.hanche, dirA(j.t + 90, 6)), i, 7.5);
    if (m === "trapezes") return ligne(plus(j.cou, dirA(j.t + 90, 4)), plus(j.tete, dirA(j.t + 180, 9)), i);
    if (m === "epaule-avant" || m === "epaule-arriere") return rond(plus(c.ep, dirA(j.t - 90, m === "epaule-avant" ? 5 : -5)), i, 6.5);
    const z = ZONES[m]; if (!z) return;
    const [a, b] = segDe(z[0], c), d = moins(b, a), ang = Math.atan2(d[0], d[1]) * 180 / Math.PI;
    // l'avant d'un membre : le segment tourné de +90° (comme une cuisse ou un bras pendant) ; pour le torse, qui monte, de −90°
    const avant = dirA(z[0] === "torse" ? ang - 90 : ang + 90, (z[0] === "torse" ? 6.5 : 5) * (z[1] || 0));
    ligne(plus(plus(a, [d[0] * z[2], d[1] * z[2]]), avant), plus(plus(a, [d[0] * z[3], d[1] * z[3]]), avant), i);
  });
  return out;
}

/* Le dessin d'une pose */
function Bonhomme({ j, muscle, fantome }) {
  const m = new Set(muscle || []);
  const trait = (a, b, cle, loin) => h("line", { key: cle + (loin ? "l" : "p"), x1: a[0], y1: a[1], x2: b[0], y2: b[1], className: "sq-m" + (loin ? " loin" : "") + (m.has(cle) && !fantome ? " actif" : "") });
  const membre = (c, loin) => [
    trait(c.hp, c.genou, "cuisse", loin), trait(c.genou, c.cheville, "tibia", loin), trait(c.cheville, c.orteil, "pied", loin),
    trait(c.ep, c.coude, "bras", loin), trait(c.coude, c.main, "avbras", loin)];
  const face = j.vue === "face", [p, l] = j.cotes;
  if (j.vue === "bout") return h("g", { className: fantome ? "sq-fantome" : "" },
    h("circle", { cx: j.cou[0], cy: j.cou[1] - 4, r: L_CORPS.tete, className: "sq-tete" }),
    h("line", { x1: p.ep[0], y1: p.ep[1], x2: l.ep[0], y2: l.ep[1], className: "sq-m tronc" + (m.has("torse") && !fantome ? " actif" : "") }),
    [l, p].map((c, k) => [h("line", { key: "b" + k, x1: c.ep[0], y1: c.ep[1], x2: c.coude[0], y2: c.coude[1], className: "sq-m" }), h("line", { key: "a" + k, x1: c.coude[0], y1: c.coude[1], x2: c.main[0], y2: c.main[1], className: "sq-m" })]),
    !fantome && h(Zones, { j, muscle }),
    m.has("epaules") && !fantome && [p, l].map((c, i) => h("circle", { key: "ep" + i, cx: c.ep[0], cy: c.ep[1], r: 7, className: "sq-epaule" })));
  return h("g", { className: fantome ? "sq-fantome" : "" },
    !face && membre(l, true),
    face && h("line", { x1: p.ep[0], y1: p.ep[1], x2: l.ep[0], y2: l.ep[1], className: "sq-m tronc" + (m.has("torse") && !fantome ? " actif" : "") }),
    face && h("line", { x1: p.hp[0], y1: p.hp[1], x2: l.hp[0], y2: l.hp[1], className: "sq-m" }),
    h("line", { x1: j.hanche[0], y1: j.hanche[1], x2: j.cou[0], y2: j.cou[1], className: "sq-m tronc" + (m.has("torse") && !fantome ? " actif" : "") }),
    face ? [membre(l, false), membre(p, false)] : membre(p, false),
    !fantome && h(Zones, { j, muscle }),
    m.has("epaules") && !fantome && (face ? [p, l] : [p]).map((c, i) => h("circle", { key: "ep" + i, cx: c.ep[0], cy: c.ep[1], r: 7, className: "sq-epaule" })),
    h("circle", { cx: j.tete[0], cy: j.tete[1], r: L_CORPS.tete, className: "sq-tete" }));
}

/* Le matériel tenu ou porté, qui suit le corps */
const Disque = ({ p, r, loin, k }) => h("g", { key: k, className: loin ? "loin" : "" }, h("circle", { cx: p[0], cy: p[1], r, className: "sq-disque" }), h("circle", { cx: p[0], cy: p[1], r: Math.max(2.5, r / 5), className: "sq-axe" }));
function Objets({ j, objets }) {
  return (objets || []).map((o, i) => {
    const face = j.vue === "face" || j.vue === "bout", [p, l] = j.cotes;
    if (o.t === "halteres") return h("g", { key: i }, face ? [Disque({ p: p.main, r: 8, k: 0 }), Disque({ p: l.main, r: 8, k: 1 })] : [Disque({ p: l.main, r: 8, loin: true, k: 0 }), Disque({ p: p.main, r: 8, k: 1 })]);
    if (o.t === "haltere") return h("g", { key: i }, Disque({ p: plus(p.main, o.decale || [0, 0]), r: o.r || 8, k: 0 }));
    if (o.t === "barre" || o.t === "disque") return h("g", { key: i }, Disque({ p: pointBarre(j, [o]), r: o.r || (o.t === "disque" ? 12 : 15), k: 0 }));
    if (o.t === "barreface") {  // barre vue de face : une ligne entre les mains, un disque à chaque bout
      const a = p.main, b = l.main, d = moins(a, b), L = Math.hypot(...d) || 1, u = [d[0] / L, d[1] / L], ext = o.ext || 34;
      const e1 = plus(a, [u[0] * ext, u[1] * ext]), e2 = moins(b, [u[0] * ext, u[1] * ext]);
      return h("g", { key: i }, h("line", { x1: e2[0], y1: e2[1], x2: e1[0], y2: e1[1], className: "sq-barre" }),
        [e1, e2].map((e, k) => h("rect", { key: k, x: e[0] - 3.5, y: e[1] - 16, width: 7, height: 32, rx: 2, className: "sq-disque" })));
    }
    if (o.t === "roue") return h("g", { key: i }, h("circle", { cx: p.main[0], cy: p.main[1] + 4, r: 10, className: "sq-disque" }));
    if (o.t === "boudin") { const c = o.sur === "genou" ? p.genou : o.sur === "cuisse" ? plus(p.hp, [(p.genou[0] - p.hp[0]) * .75, (p.genou[1] - p.hp[1]) * .75]) : plus(p.cheville, [(p.genou[0] - p.cheville[0]) * .15, (p.genou[1] - p.cheville[1]) * .15]); const off = o.cote ? dirA(Math.atan2(p.cheville[0] - p.genou[0], p.cheville[1] - p.genou[1]) * 180 / Math.PI + 90 * o.cote, 8) : [0, 0]; return h("circle", { key: i, cx: c[0] + off[0], cy: c[1] + off[1], r: 6.5, className: "sq-appui" }); }
    if (o.t === "plateforme") { const c = plus(p.cheville, [(p.orteil[0] - p.cheville[0]) * .5, (p.orteil[1] - p.cheville[1]) * .5]), a = o.a ?? 90, d = dirA(a, 16), n = dirA(a - 90, o.cote ?? 6); const q = plus(c, n); return h("line", { key: i, x1: q[0] - d[0], y1: q[1] - d[1], x2: q[0] + d[0], y2: q[1] + d[1], className: "sq-plateau" }); }
    if (o.t === "elastique") { const a = o.sur === "chevilles" ? [p.cheville, l.cheville] : [p.genou, l.genou]; return h("line", { key: i, x1: a[0][0], y1: a[0][1], x2: a[1][0], y2: a[1][1], className: "sq-elastique" }); }
    if (o.t === "cable") {
      const c = o.vers === "cheville" ? p.cheville : o.vers === "genou" ? p.genou : p.main;
      if (o.deux) return h("g", { key: i }, [[p.main, o.de], [l.main, [200 - o.de[0], o.de[1]]]].map(([m, d], k) => h("g", { key: k }, h("line", { x1: d[0], y1: d[1], x2: m[0], y2: m[1], className: "sq-cable" }), h("circle", { cx: m[0], cy: m[1], r: 4, className: "sq-poignee" }))));
      return h("g", { key: i }, h("line", { x1: o.de[0], y1: o.de[1], x2: c[0], y2: c[1], className: "sq-cable" }), o.vers ? h("circle", { cx: c[0], cy: c[1], r: 4, className: "sq-poignee" }) : h("rect", { x: c[0] - 9, y: c[1] - 3, width: 18, height: 6, rx: 3, className: "sq-poignee" }));
    }
    if (o.t === "poignee") return h("rect", { key: i, x: p.main[0] - 7, y: p.main[1] - 3, width: 14, height: 6, rx: 3, className: "sq-poignee" });
    return null;
  });
}

/* Le décor fixe : sol, bancs, poulies, barres, appuis */
function Decor({ decor }) {
  return (decor || []).map((d, i) => {
    if (d.t === "sol") return h("line", { key: i, x1: 6, y1: d.y || 181, x2: 194, y2: d.y || 181, className: "sq-sol" });
    if (d.t === "banc" || d.t === "appui" || d.t === "boite") return h("rect", { key: i, x: d.x, y: d.y, width: d.l, height: d.h || 8, rx: 3, className: d.t === "appui" ? "sq-appui" : "sq-banc" });
    if (d.t === "bancr") return h("rect", { key: i, x: d.x, y: d.y, width: d.l, height: d.h || 8, rx: 3, className: d.app ? "sq-appui" : "sq-banc", transform: `rotate(${-d.a} ${d.x} ${d.y})` });
    if (d.t === "pied") return h("line", { key: i, x1: d.x, y1: d.y, x2: d.x2 ?? d.x, y2: d.y2, className: "sq-banc-p" });
    if (d.t === "poulieb") return h("g", { key: i }, h("line", { x1: d.x, y1: d.y, x2: d.x, y2: d.sol || 181, className: "sq-banc-p" }), h("circle", { cx: d.x, cy: d.y, r: 6, className: "sq-poulie" }));
    if (d.t === "poulie") return h("g", { key: i }, h("line", { x1: d.x, y1: 0, x2: d.x, y2: d.y, className: "sq-banc-p" }), h("circle", { cx: d.x, cy: d.y, r: 6, className: "sq-poulie" }));
    if (d.t === "barrefixe") return h("g", { key: i }, h("line", { x1: d.x, y1: 0, x2: d.x, y2: d.y, className: "sq-banc-p fin" }), h("circle", { cx: d.x, cy: d.y, r: 4.5, className: "sq-axe" }));
    if (d.t === "barres") return h("rect", { key: i, x: d.x - 8, y: d.y, width: 16, height: 6, rx: 3, className: "sq-appui" });
    if (d.t === "mur") return h("line", { key: i, x1: d.x, y1: d.y || 0, x2: d.x, y2: d.y2 || 181, className: "sq-banc-p" });
    return null;
  });
}

/* Flèche double qui suit le trajet de la charge entre le départ et l'arrivée */
function Fleche({ s, id }) {
  const f = s.fleche || {}, pts = [];
  if (s.statique) return null;
  for (let i = 0; i <= 16; i++) pts.push(plus(pointSuivi(articulations(poseA(s, i / 16)), f.suit, s), f.decale || [16, 0]));
  return h("path", { d: "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L"), className: "sq-fleche", markerStart: `url(#${id}d)`, markerEnd: `url(#${id}a)` });
}

/* ── LA COURBE D'EFFORT ──
 * Effort que la charge demande à une articulation = force × distance perpendiculaire entre l'articulation et la ligne de la force.
 * Haltère ou barre : la force tombe à la verticale. Poulie : elle suit le câble. Calculé sur la pose même du schéma.
 * Quand le calcul plan ne représente pas l'exercice (machine à came, poids du corps), le profil est donné : `profil`.
 * C'est la résistance extérieure seulement, pas la force que ton muscle peut produire à chaque angle. */
const variante = (s, v) => ({ ...s, ...((s.variantes || [])[v] || {}) });
function couple(j, e, s) {
  const c = j.cotes[0], art = e.art;
  const J = art === "coude" ? c.coude : art === "epaule" ? c.ep : art === "hanche" ? j.hanche : art === "cheville" ? c.cheville : c.genou;
  const P = pointSuivi(j, e.point || s.point || "main", s), charge = e.charge || s.charge;
  let F = [0, 1];
  if (charge?.t === "cable") { const d = moins(charge.de, P), n = Math.hypot(...d) || 1; F = [d[0] / n, d[1] / n]; }
  if (charge?.t === "haut") F = [0, -1];
  return (P[0] - J[0]) * F[1] - (P[1] - J[1]) * F[0];  // signé : le sens compte
}
const N_COURBE = 40;
function courbes(sv) {
  return (sv.effort || []).map(e => {
    if (e.profil) {  // profil donné : points régulièrement espacés, interpolés
      const p = e.profil, n = p.length - 1;
      const v = Array.from({ length: N_COURBE + 1 }, (_, i) => { const x = i / N_COURBE * n, a = Math.floor(x), b = Math.min(n, a + 1); return p[a] + (p[b] - p[a]) * (x - a); });
      const max = Math.max(...v) || 1;
      return { ...e, v: v.map(x => x / max) };
    }
    const base = e.plan ? { ...e.plan, objets: [] } : sv;
    const v = Array.from({ length: N_COURBE + 1 }, (_, i) => couple(articulations(poseA(base, i / N_COURBE)), e, sv));
    // Quand la charge pousse dans le sens du mouvement, elle ne résiste plus : on compte zéro
    const fort = v.reduce((a, x) => Math.abs(x) > Math.abs(a) ? x : a, 0), sens = Math.sign(fort) || 1;
    const r = v.map(x => Math.max(0, x * sens)), max = Math.max(...r) || 1;
    return { ...e, v: r.map(x => x / max) };
  });
}
const longueurA = (sv, k) => sv.etire === 1 ? k : 1 - k;  // 1 = muscle étiré, 0 = contracté
const ouDans = p => p < 1 / 3 ? "au départ" : p > 2 / 3 ? "à l'arrivée" : "au milieu";
const etatMuscle = l => l > 2 / 3 ? "étiré" : l < 1 / 3 ? "contracté" : "à mi-longueur";
function phraseCourbe(sv, c) {
  const v = c.v, max = Math.max(...v), min = Math.min(...v);
  if (max - min < .12) return "La charge pèse à peu près autant tout au long du mouvement." + (c.note ? " " + c.note : "");
  const iMax = v.indexOf(max), iMin = v.indexOf(min), pM = iMax / N_COURBE, pm = iMin / N_COURBE;
  return "La charge pèse le plus " + ouDans(pM) + " du mouvement, quand le muscle est " + etatMuscle(longueurA(sv, pM)) + ". Elle est la plus légère " + ouDans(pm) + ", muscle " + etatMuscle(longueurA(sv, pm)) + "." + (c.note ? " " + c.note : "");
}

/* Le graphique sous le schéma, avec un curseur qui suit le bonhomme */
function Courbes({ sv, k }) {
  if (sv.statique) return h("div.courbe-effort", h("div.ce-tete", h("b", "Courbe d'effort")), h("p.ce-phrase", sv.statique === true ? "Exercice de maintien : le muscle travaille sans bouger. L'effort reste le même, il s'accumule avec la durée." : sv.statique));
  if (sv.texteEffort) return h("div.courbe-effort", h("div.ce-tete", h("b", "Effort")), h("p.ce-phrase", sv.texteEffort));
  const cs = courbes(sv);
  if (!cs.length) return null;
  const X = p => 12 + p * 276, Y = v => 92 - v * 74;
  const chemin = v => v.map((y, i) => (i ? "L" : "M") + X(i / N_COURBE).toFixed(1) + " " + Y(y).toFixed(1)).join(" ");
  const iK = Math.round(k * N_COURBE), c0 = cs[0], iMax = c0.v.indexOf(Math.max(...c0.v));
  return h("div.courbe-effort",
    h("div.ce-tete", h("b", "Courbe d'effort"), h("span", cs.map((c, i) => h("em", { key: i, className: i ? "second" : "" }, c.nom)))),
    h("svg", { viewBox: "0 0 300 104", role: "img", "aria-label": "Courbe d'effort : " + phraseCourbe(sv, c0) },
      h("line", { x1: 12, y1: 92, x2: 288, y2: 92, className: "ce-axe" }),
      h("path", { d: chemin(c0.v) + ` L${X(1)} 92 L${X(0)} 92 Z`, className: "ce-aire" }),
      cs.map((c, i) => h("path", { key: i, d: chemin(c.v), className: "ce-ligne" + (i ? " second" : "") })),
      h("text", { x: Math.min(Math.max(X(iMax / N_COURBE), 40), 260), y: Y(c0.v[iMax]) - 6, className: "ce-txt", textAnchor: "middle" }, "le plus dur"),
      h("line", { x1: X(k), y1: 10, x2: X(k), y2: 92, className: "ce-curseur" }),
      cs.map((c, i) => h("circle", { key: i, cx: X(k), cy: Y(c.v[iK]), r: 5, className: "ce-point" + (i ? " second" : "") }))),
    h("div.ce-muscle", { "aria-hidden": true },
      h("span", sv.etire === 1 ? "contracté" : "étiré"),
      h("div.ce-barre", h("i", { style: { left: (k * 100) + "%" } })),
      h("span", sv.etire === 1 ? "étiré" : "contracté")),
    h("p.ce-phrase", phraseCourbe(sv, c0)));
}

const ease = x => .5 - Math.cos(Math.PI * x) / 2;
/* Le schéma complet, animé en boucle : départ → arrivée → départ */
function Schema({ s, fixe, sansCourbe }) {
  const id = "sq" + React.useId().replace(/:/g, "");
  const calme = useMemo(() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }, []);
  const [pause, setPause] = useState(calme), [kAnim, setK] = useState(calme ? 1 : 0), [v, setV] = useState(0);
  const k = fixe ?? kAnim;  // fixe : une image arrêtée (0 = départ, 1 = arrivée)
  useEffect(() => {
    if (pause || fixe != null || s.statique) return;
    let raf, debut = performance.now() - k * 1500;
    const boucle = now => {
      const t = ((now - debut) / 1000) % 3.8;  // 1,5 s aller, 0,4 s arrêt, 1,5 s retour, 0,4 s arrêt
      setK(t < 1.5 ? ease(t / 1.5) : t < 1.9 ? 1 : t < 3.4 ? 1 - ease((t - 1.9) / 1.5) : 0);
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [pause, s]);
  const sv = variante(s, v), j = articulations(poseA(sv, k));
  return h("figure.schema", null,
    s.variantes && fixe == null && h("div.onglets-b.sq-var", { role: "tablist" }, s.variantes.map((x, i) => h("button", { key: i, role: "tab", "aria-selected": v === i, className: v === i ? "actif" : "", onClick: () => { vibre(); setV(i); } }, x.nom))),
    h("svg", { viewBox: "0 0 200 200", role: "img", "aria-label": sv.legende || "Schéma du mouvement" },
      h("defs", null,
        h("marker", { id: id + "a", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 4, markerHeight: 4, orient: "auto" }, h("path", { d: "M0 0 L10 5 L0 10 z", className: "sq-pointe" })),
        h("marker", { id: id + "d", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 4, markerHeight: 4, orient: "auto-start-reverse" }, h("path", { d: "M0 0 L10 5 L0 10 z", className: "sq-pointe" }))),
      h(Decor, { decor: [...(sv.decor || []), ...(sv.decorEnPlus || [])] }),
      pause && !sv.statique && h(Bonhomme, { j: articulations(poseA(sv, k > .5 ? 0 : 1)), fantome: true }),
      h(Fleche, { s: sv, id }),
      h(Objets, { j, objets: (sv.objets || []).filter(o => !o.devant) }),
      h(Bonhomme, { j, muscle: sv.muscle }),
      h(Objets, { j, objets: (sv.objets || []).filter(o => o.devant) })),
    fixe == null && !sv.statique && h("figcaption",
      h("span", { className: k < .5 ? "actif" : "" }, "Départ"), h("i", { "aria-hidden": true }), h("span", { className: k >= .5 ? "actif" : "" }, "Arrivée"),
      h("button.rond.petit", { onClick: () => { vibre(); setPause(!pause); }, "aria-label": pause ? "Lancer l'animation" : "Mettre en pause" }, h(Icone, { n: pause ? "fleche" : "chrono", t: 16 }))),
    !sansCourbe && h(Courbes, { sv, k }));
}

/* SCHEMAS est rempli par mouvements.js */
const SCHEMAS = {};
const schemaDe = nom => SCHEMAS[nom] || SCHEMAS[nomDeFiche(nom)] || null;
