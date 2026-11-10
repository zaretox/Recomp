"use strict";
/* MOUVEMENTS — les schémas de chaque exercice, pour le moteur de schemas.js. Données, plus quelques gabarits.
 * Chaque schéma : depart / arrivee (poses), objets (matériel tenu), decor (fixe), muscle (zones colorées),
 * fleche (point suivi), effort (courbes : art = articulation, point = où agit la charge, charge = poids / poulie / profil),
 * etire (0 si le muscle est étiré au départ, 1 à l'arrivée), variantes (autre matériel), analyse (pourquoi, quelles parties).
 * Les connaissances viennent d'études vérifiées : voir SOURCES.md. */

Object.assign(SCHEMAS, {
  "Squat": {
    legende: "Squat vu de profil : la barre sur le haut du dos, on descend cuisses parallèles puis on remonte.",
    depart: { ancre: "pieds", cheville: [90, 178], cuisse: 0, tibia: 0, torse: 176, bras: -16, avbras: 172 },
    arrivee: { cuisse: 82, tibia: -32, torse: 145 },
    objets: [{ t: "barre", sur: "dos", decale: [-3, -3] }], muscle: ["quadriceps", "fessiers"], fleche: { suit: "epaule", decale: [-34, 0] },
    decor: [{ t: "sol", y: 181 }],
    effort: [{ art: "genou", nom: "Genou · quadriceps" }, { art: "hanche", nom: "Hanche · fessiers" }], point: "dos", charge: { t: "poids" }, etire: 1,
    analyse: {
      pourquoi: "Le squat tend le genou et la hanche en même temps : les quadriceps redressent le genou, les fessiers redressent la hanche. C'est l'exercice de base du bas du corps.",
      faisceaux: "Les trois vastes du quadriceps font l'essentiel. Le droit fémoral, qui passe aussi par la hanche, grossit peu avec le squat. Plus tu descends, plus les fessiers et les adducteurs travaillent.",
    },
  },
  "Curl biceps": {
    legende: "Curl haltère vu de profil : le coude reste collé au corps, seul l'avant-bras monte.",
    depart: { ancre: "pieds", cheville: [94, 178], torse: 180, bras: [4, -4], avbras: [6, 2] },
    arrivee: { avbras: [148, 140] },
    objets: [{ t: "halteres" }], muscle: ["biceps"], fleche: { suit: "main", decale: [18, 0] },
    decor: [{ t: "sol", y: 181 }],
    effort: [{ art: "coude", nom: "Coude · biceps" }], etire: 0,
    variantes: [
      { nom: "Haltère", objets: [{ t: "halteres" }], charge: { t: "poids" } },
      { nom: "Poulie devant", objets: [{ t: "cable", de: [128, 174] }], charge: { t: "cable", de: [128, 174] }, decorEnPlus: [{ t: "poulieb", x: 128, y: 174 }] },
      { nom: "Poulie derrière", objets: [{ t: "cable", de: [44, 150] }], charge: { t: "cable", de: [44, 150] }, decorEnPlus: [{ t: "poulieb", x: 44, y: 150 }],
        depart: { ancre: "pieds", cheville: [94, 178], torse: 180, bras: [-14, -18], avbras: [-10, -14] }, arrivee: { avbras: [130, 124] } },
    ],
    analyse: {
      pourquoi: "Le biceps plie le coude et tourne la main paume vers le haut. Le curl isole ce travail, sans que le dos ou les épaules aident.",
      faisceaux: "Les deux portions du biceps et le brachial, situé dessous, travaillent ensemble. Bras derrière le corps (poulie derrière, curl incliné), la longue portion est plus étirée et la charge pèse plus tôt dans le mouvement. Placer le bras ainsi ne fait pourtant pas grossir le biceps davantage : choisis la version que tu préfères.",
    },
  },
  "Élévations lat.": {
    vue: "face",
    legende: "Élévations latérales vues de face : bras sur les côtés jusqu'à l'horizontale, coudes légèrement fléchis.",
    depart: { hanche: [100, 100], bras: 12, avbras: 8, cuisse: 4, tibia: 2 },
    arrivee: { bras: 86, avbras: 80 },
    objets: [{ t: "halteres" }], muscle: ["epaules"], fleche: { suit: "main", decale: [10, 16] },
    decor: [{ t: "sol", y: 181 }],
    effort: [{ art: "epaule", nom: "Épaule · deltoïde moyen" }], etire: 0,
    variantes: [
      { nom: "Haltère", objets: [{ t: "halteres" }], charge: { t: "poids" } },
      { nom: "Poulie", objets: [{ t: "cable", de: [44, 152] }], charge: { t: "cable", de: [44, 152] }, decorEnPlus: [{ t: "poulieb", x: 44, y: 152 }] },
    ],
    analyse: {
      pourquoi: "Le faisceau moyen du deltoïde écarte le bras du corps : c'est lui qui donne la largeur des épaules. Aucun exercice de développé ne le cible aussi bien.",
      faisceaux: "Surtout le faisceau moyen, qui travaille le plus bras en position neutre, pouces vers l'avant ; « petit doigt plus haut », c'est l'arrière de l'épaule et le trapèze qui prennent le relais. À l'haltère, la charge pèse le plus en haut ; à la poulie réglée à hauteur de la main, elle pèse davantage bras le long du corps, quand le muscle est étiré. Malgré cette différence, les deux font grossir l'épaule autant : choisis celle que tu sens le mieux.",
    },
  },
  "Tirage vertical": {
    legende: "Tirage vertical vu de profil : assis, cuisses calées, on tire la barre vers le haut de la poitrine.",
    depart: { hanche: [92, 128], torse: 195, tete: -10, cuisse: 92, tibia: 4, pied: 90, bras: 163, avbras: 163 },
    arrivee: { bras: -25, avbras: 138 },
    objets: [{ t: "cable", de: [84, 6] }], muscle: ["dos"], fleche: { suit: "main", decale: [22, 0] },
    decor: [{ t: "banc", x: 70, y: 134, l: 46 }, { t: "pied", x: 93, y: 142, y2: 181 }, { t: "appui", x: 118, y: 116, l: 26, h: 8 }, { t: "poulie", x: 84, y: 6 }, { t: "sol", y: 181 }],
    // L'effort de l'épaule se lit de face : avec une prise large, c'est l'écart latéral entre la main et l'épaule qui compte.
    effort: [{ art: "epaule", nom: "Épaule · grand dorsal", plan: { vue: "face", depart: { hanche: [100, 100], bras: 160, avbras: 165 }, arrivee: { bras: 35, avbras: 170 } } }],
    charge: { t: "haut" }, etire: 0,
    analyse: {
      pourquoi: "Le grand dorsal ramène le bras le long du corps. Le tirage le fait travailler de l'étirement complet, bras en haut, jusqu'à la contraction, barre à la poitrine.",
      faisceaux: "Grand dorsal et grand rond surtout, avec le bas des trapèzes et les rhomboïdes ; le biceps aide. La largeur et le type de prise changent peu l'activité du grand dorsal : prends la prise où tu sens le mieux ton dos.",
    },
  },
});

/* ── Gabarits communs ── */
const SOL = { t: "sol" };
// Allongé sur un banc plat, tête à gauche, pieds au sol
const BANC_PLAT = [{ t: "banc", x: 40, y: 129, l: 100 }, { t: "pied", x: 58, y: 137, y2: 181 }, { t: "pied", x: 122, y: 137, y2: 181 }, SOL];
const ALLONGE = { hanche: [118, 122], torse: 270, cuisse: [68, 62], tibia: [2, -4], pied: 90, brasAbs: true };
// Banc incliné à 30° (dossier vers la gauche)
const BANC_INCL = [{ t: "bancr", x: 54, y: 98, l: 68, a: -30 }, { t: "banc", x: 108, y: 134, l: 36 }, { t: "pied", x: 122, y: 142, y2: 181 }, SOL];
const INCLINE = { hanche: [120, 128], torse: 240, tete: -10, cuisse: [80, 74], tibia: [0, -4], pied: 90, brasAbs: true };
// Banc vu de bout (allongé, vu depuis les pieds)
const BANC_BOUT = [{ t: "banc", x: 82, y: 128, l: 36 }, { t: "pied", x: 100, y: 136, y2: 181 }, SOL];
const BOUT = { hanche: [100, 166], torse: 180 };
// Le développé couché sert de référence pour les poussées équivalentes (pompes, machine) : même géométrie par rapport à la force
const PLAN_DEVELOPPE = { depart: { ...ALLONGE, bras: 180, avbras: 180 }, arrivee: { bras: 58, avbras: 176 } };
const PLAN_DEVELOPPE_INV = { depart: PLAN_DEVELOPPE.arrivee && { ...ALLONGE, bras: 58, avbras: 176 }, arrivee: { bras: 180, avbras: 180 } };

/* ── PECTORAUX ── */
const POURQUOI_PECS = "Le grand pectoral rapproche le bras du corps et le ramène devant la poitrine. Les développés le font travailler avec le triceps et l'avant de l'épaule ; les écartés l'isolent.";
Object.assign(SCHEMAS, {
  "Développé couché": {
    legende: "Développé couché vu de profil : la barre descend du dessus des épaules jusqu'au bas des pecs, puis remonte.",
    depart: { ...ALLONGE, bras: 180, avbras: 180 }, arrivee: { bras: 58, avbras: 176 },
    objets: [{ t: "barre" }], decor: BANC_PLAT, muscle: ["pecs", "triceps"], fleche: { suit: "main", decale: [26, -4] },
    effort: [{ art: "epaule", nom: "Épaule · pecs" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Banc plat : c'est la version qui fait le plus travailler le milieu et le bas des pecs. Le passage le plus dur se situe juste au-dessus de la poitrine, là où les pecs sont étirés et le bras de levier le plus long." },
  },
  "DC haltères": {
    legende: "Développé haltères vu de profil : les haltères descendent plus bas qu'une barre, au niveau de la poitrine.",
    depart: { ...ALLONGE, bras: 180, avbras: 180 }, arrivee: { bras: 46, avbras: 178 },
    objets: [{ t: "halteres" }], decor: BANC_PLAT, muscle: ["pecs", "triceps"], fleche: { suit: "main", decale: [26, -4] },
    effort: [{ art: "epaule", nom: "Épaule · pecs" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Les haltères permettent de descendre plus bas et de rapprocher les mains en haut. On y soulève environ 15 % de moins qu'à la barre : c'est normal, chaque bras doit aussi se stabiliser." },
  },
  "DC haltères neutre": {
    legende: "Développé haltères en prise neutre vu de profil : coudes près du corps, paumes face à face.",
    depart: { ...ALLONGE, bras: 180, avbras: 180 }, arrivee: { bras: 30, avbras: 180 },
    objets: [{ t: "halteres" }], decor: BANC_PLAT, muscle: ["pecs", "triceps"], fleche: { suit: "main", decale: [26, -4] },
    effort: [{ art: "epaule", nom: "Épaule · pecs" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Coudes près du corps, l'avant de l'épaule et le triceps prennent un peu plus de part, et l'épaule est moins sollicitée en rotation : c'est la version la plus douce quand elle est sensible." },
  },
  "DI haltères": {
    legende: "Développé incliné haltères vu de profil : banc à 30°, les haltères descendent vers le haut des pecs.",
    depart: { ...INCLINE, bras: 180, avbras: 180 }, arrivee: { bras: 62, avbras: 172 },
    objets: [{ t: "halteres" }], decor: BANC_INCL, muscle: ["pecs", "epaule-avant"], fleche: { suit: "main", decale: [26, -4] },
    effort: [{ art: "epaule", nom: "Épaule · haut des pecs" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Une inclinaison d'environ 30° est celle qui fait le plus travailler le faisceau du haut des pecs. Au-delà de 45°, c'est surtout l'avant de l'épaule qui travaille." },
  },
  "Développé incliné barre": {
    legende: "Développé incliné à la barre vu de profil : banc à 30°, la barre descend sous les clavicules.",
    depart: { ...INCLINE, bras: 180, avbras: 180 }, arrivee: { bras: 70, avbras: 170 },
    objets: [{ t: "barre" }], decor: BANC_INCL, muscle: ["pecs", "epaule-avant"], fleche: { suit: "main", decale: [26, -4] },
    effort: [{ art: "epaule", nom: "Épaule · haut des pecs" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Comme aux haltères : 30° cible le haut des pecs, au-delà de 45° l'épaule domine. La barre permet de charger plus lourd, avec une amplitude un peu plus courte." },
  },
  "Développé décliné": {
    legende: "Développé décliné vu de profil : tête plus basse que le bassin, la barre descend vers le bas des pecs.",
    depart: { hanche: [118, 112], torse: 285, cuisse: [124, 118], tibia: [26, 30], pied: 100, brasAbs: true, bras: 180, avbras: 180 }, arrivee: { bras: 68, avbras: 176 },
    objets: [{ t: "barre" }], decor: [{ t: "bancr", x: 54, y: 141, l: 78, a: 15 }, { t: "appui", x: 152, y: 136, l: 18, h: 9 }, { t: "pied", x: 90, y: 136, y2: 181 }, { t: "pied", x: 160, y: 145, y2: 181 }, SOL],
    muscle: ["pecs", "triceps"], fleche: { suit: "main", decale: [26, -4] },
    effort: [{ art: "epaule", nom: "Épaule · bas des pecs" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "L'inclinaison vers le bas oriente le travail vers le faisceau inférieur des pecs et raccourcit l'amplitude. Le banc plat fait déjà bien travailler cette zone : le décliné est une variante, pas un indispensable." },
  },
  "Développé couché machine": {
    legende: "Développé à la machine vu de profil : assis, on pousse les poignées droit devant, à hauteur de poitrine.",
    depart: { hanche: [78, 130], torse: 180, cuisse: [88, 84], tibia: [4, 0], pied: 90, bras: -72, avbras: 92 }, arrivee: { bras: 84, avbras: 90 },
    objets: [{ t: "poignee" }], decor: [{ t: "bancr", x: 64, y: 134, l: 66, a: 90, h: 8 }, { t: "banc", x: 60, y: 136, l: 40 }, { t: "pied", x: 80, y: 144, y2: 181 }, SOL],
    muscle: ["pecs", "triceps"], fleche: { suit: "main", decale: [0, -16] },
    effort: [{ art: "epaule", nom: "Épaule · pecs", plan: PLAN_DEVELOPPE_INV, note: "Si la machine résiste toujours dans l'axe de la poussée ; certains modèles allègent le début du mouvement." }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Même travail qu'un développé couché, mais la machine guide la trajectoire : pas besoin de stabiliser, on peut aller près de l'échec sans pareur. Idéal en fin de séance." },
  },
  "Pompes": {
    legende: "Pompes vues de profil : mains au sol, corps gainé, la poitrine descend près du sol.",
    depart: { ancre: "mains", main: [134, 177], torse: 114, cuisse: [294, 294], tibia: [294, 294], pied: [10, 10], brasAbs: true, bras: 0, avbras: 0 },
    arrivee: { torse: 103, cuisse: [283, 283], tibia: [283, 283], bras: -72, avbras: 12 },
    objets: [], decor: [SOL], muscle: ["pecs", "triceps"], fleche: { suit: "epaule", decale: [16, -20] },
    effort: [{ art: "epaule", nom: "Épaule · pecs", plan: PLAN_DEVELOPPE }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Mécaniquement, une pompe ressemble à un développé couché : à charge comparable, elle fait autant grossir les pecs et les triceps. Pour progresser, surélève les pieds, ajoute un élastique ou un poids sur le dos." },
  },
  "Pompes déclinées": {
    legende: "Pompes déclinées vues de profil : pieds sur un banc, la tête descend vers l'avant des mains.",
    depart: { ancre: "mains", main: [140, 177], torse: 100, cuisse: [280, 280], tibia: [280, 280], pied: [0, 0], brasAbs: true, bras: 6, avbras: 2 },
    arrivee: { torse: 90, cuisse: [270, 270], tibia: [270, 270], bras: -66, avbras: 14 },
    objets: [], decor: [{ t: "boite", x: 4, y: 128, l: 36, h: 53 }, SOL], muscle: ["pecs", "epaule-avant"], fleche: { suit: "epaule", decale: [16, -20] },
    effort: [{ art: "epaule", nom: "Épaule · haut des pecs", plan: PLAN_DEVELOPPE }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Pieds surélevés, une plus grande part du poids du corps passe dans les bras, et l'angle de poussée se rapproche d'un développé incliné : plus de haut des pecs et d'épaules." },
  },
  "Dips buste penché": {
    legende: "Dips buste penché vus de profil : en appui sur les barres, buste incliné vers l'avant, on descend jusqu'à épaules au niveau des coudes.",
    depart: { ancre: "mains", main: [100, 80], torse: 152, cuisse: [30, 24], tibia: [-80, -84], pied: 20, brasAbs: true, bras: 0, avbras: 0 },
    arrivee: { torse: 140, bras: -84, avbras: 8 },
    objets: [], decor: [{ t: "barres", x: 100, y: 82 }, SOL], muscle: ["pecs", "triceps"], fleche: { suit: "epaule", decale: [22, 0] },
    effort: [{ art: "epaule", nom: "Épaule · pecs", point: "main" }], charge: { t: "haut" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Les dips font travailler fortement le grand pectoral et le triceps. Buste penché, la part des pecs augmente. C'est en bas, épaules au niveau des coudes, que l'effort est le plus grand : ne descends pas plus bas si l'épaule tire." },
  },
  "Écarté haltères": {
    vue: "bout",
    legende: "Écarté haltères vu depuis les pieds : allongé, bras ouverts en arc de cercle jusqu'à l'étirement, puis refermés au-dessus de la poitrine.",
    depart: { ...BOUT, bras: 186, avbras: 178 }, arrivee: { bras: 84, avbras: 96 },
    objets: [{ t: "halteres" }], decor: BANC_BOUT, muscle: ["pecs"], fleche: { suit: "main", decale: [10, -14] },
    effort: [{ art: "epaule", nom: "Épaule · pecs" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "L'écarté isole le pectoral : le triceps ne participe presque pas. Aux haltères, la charge pèse surtout bras ouverts, quand le muscle est étiré, et presque plus en haut : inutile de cogner les haltères." },
  },
  "Écarté poulie vis-à-vis": {
    vue: "face",
    legende: "Écarté à la poulie vu de face : poulies hautes, on ramène les mains devant soi vers le bas.",
    depart: { hanche: [100, 104], bras: 112, avbras: 104, cuisse: 6, tibia: 2 }, arrivee: { bras: 18, avbras: -14 },
    objets: [{ t: "cable", de: [192, 28], deux: true }], decor: [{ t: "poulie", x: 192, y: 28 }, { t: "poulie", x: 8, y: 28 }, SOL], muscle: ["pecs"], fleche: { suit: "main", decale: [14, 0] },
    effort: [{ art: "epaule", nom: "Épaule · pecs" }], charge: { t: "cable", de: [192, 28] }, etire: 0,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Poulies hautes, le travail porte surtout sur le milieu et le bas des pecs. Contrairement aux haltères, la poulie garde de la tension jusqu'au bout, mains jointes." },
  },
  "Poulie basse (pecs)": {
    legende: "Écarté poulie basse vu de profil : poulies en bas, on remonte les mains devant soi jusqu'à hauteur du menton.",
    depart: { ancre: "pieds", cheville: [92, 178], torse: 178, bras: [8, 4], avbras: [12, 8] }, arrivee: { bras: [118, 112], avbras: [104, 100] },
    objets: [{ t: "cable", de: [86, 174] }], decor: [{ t: "poulieb", x: 86, y: 174 }, SOL], muscle: ["pecs", "epaule-avant"], fleche: { suit: "main", decale: [16, 0] },
    effort: [{ art: "epaule", nom: "Épaule · haut des pecs" }], charge: { t: "cable", de: [86, 174] }, etire: 0,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Mouvement de bas en haut : il suit les fibres du haut des pecs, attachées à la clavicule. Tiens 2 secondes mains jointes : la poulie garde la tension là où l'haltère n'en a plus." },
  },
  "Pec deck": {
    vue: "bout",
    legende: "Pec deck vu du dessus : assis, on ramène les bras devant soi, puis on revient jusqu'à l'étirement.",
    depart: { ...BOUT, bras: 92, avbras: 96 }, arrivee: { bras: 182, avbras: 176 },
    objets: [{ t: "poignee" }], decor: [], muscle: ["pecs"], fleche: { suit: "main", decale: [12, -14] },
    effort: [{ art: "epaule", nom: "Épaule · pecs", profil: [1, 1, 1, 1, 1], note: "La machine tourne autour de l'épaule avec un bras de levier fixe : la résistance reste la même d'un bout à l'autre." }], etire: 0,
    analyse: { pourquoi: POURQUOI_PECS, faisceaux: "Même travail qu'un écarté, mais avec une résistance régulière sur tout le trajet : le muscle travaille autant étiré que contracté. Facile à pousser près de l'échec en sécurité." },
  },
  "Pull-over haltère": {
    legende: "Pull-over vu de profil : allongé, haltère au-dessus de la poitrine, on l'emmène derrière la tête bras presque tendus.",
    depart: { ...ALLONGE, bras: 180, avbras: 176 }, arrivee: { bras: 284, avbras: 280 },
    objets: [{ t: "haltere" }], decor: BANC_PLAT, muscle: ["pecs", "dos"], fleche: { suit: "main", decale: [0, -14] },
    effort: [{ art: "epaule", nom: "Épaule · pecs et grand dorsal" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: "Le pull-over ramène le bras depuis derrière la tête : le grand pectoral et le grand dorsal peuvent tous deux le faire. Allongé avec un haltère, ce sont surtout les pecs qui travaillent.", faisceaux: "La charge pèse le plus bras derrière la tête, quand les muscles sont étirés, et presque plus au-dessus de la poitrine. Pour cibler le dos, préfère le tirage bras tendus à la poulie. Descends seulement tant que l'épaule est à l'aise." },
  },
});

/* ── DOS ── */
const POURQUOI_DOS = "Le grand dorsal ramène le bras vers le bas et vers l'arrière ; le milieu du dos (trapèzes, rhomboïdes) rapproche les omoplates. Les tirages verticaux ciblent surtout le grand dorsal, les rowings tout le dos.";
// Tractions et tirage vertical : l'effort de l'épaule se lit de face, comme pour le tirage vertical
const PLAN_TIRAGE = { vue: "face", depart: { hanche: [100, 100], bras: 160, avbras: 165 }, arrivee: { bras: 35, avbras: 170 } };
const BARRE_FIXE = [{ t: "barrefixe", x: 100, y: 34 }, SOL];
// Penché en avant, appui sur un banc (rowing un bras)
const BANC_ROWING = [{ t: "banc", x: 20, y: 146, l: 116 }, { t: "pied", x: 34, y: 154, y2: 181 }, { t: "pied", x: 122, y: 154, y2: 181 }, SOL];
const PENCHE_BANC = { hanche: [66, 98], torse: 92, tete: -14, cuisse: [2, 0], tibia: [0, 270], pied: [90, 180], brasAbs: true };
// Debout penché à 45° (rowing barre)
const PENCHE = { ancre: "pieds", cheville: [96, 178], torse: 128, tete: -18, cuisse: 22, tibia: -14, brasAbs: true };
Object.assign(SCHEMAS, {
  "Tractions": {
    legende: "Tractions vues de profil : suspendu à la barre, on tire les coudes vers les hanches jusqu'à passer le menton au-dessus.",
    depart: { ancre: "mains", main: [100, 34], torse: 184, cuisse: 8, tibia: -24, pied: 70, brasAbs: true, bras: 182, avbras: 180 }, arrivee: { torse: 192, bras: -14, avbras: 178 },
    objets: [], decor: BARRE_FIXE, muscle: ["dos", "biceps"], fleche: { suit: "epaule", decale: [-22, 0] },
    effort: [{ art: "epaule", nom: "Épaule · grand dorsal", plan: PLAN_TIRAGE }], charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Toutes les prises font travailler le grand dorsal à peu près autant. Paumes vers toi (supination), le biceps aide davantage. Choisis la prise où tes épaules et tes coudes sont à l'aise." },
  },
  "Tractions assistées": {
    legende: "Tractions assistées vues de profil : genoux sur la plateforme, même mouvement qu'une traction.",
    depart: { ancre: "mains", main: [100, 34], torse: 184, cuisse: 84, tibia: 0, pied: 90, brasAbs: true, bras: 182, avbras: 180 }, arrivee: { torse: 192, bras: -14, avbras: 178 },
    objets: [{ t: "boudin", sur: "genou" }], decor: BARRE_FIXE, muscle: ["dos", "biceps"], fleche: { suit: "epaule", decale: [-22, 0] },
    effort: [{ art: "epaule", nom: "Épaule · grand dorsal", plan: PLAN_TIRAGE, note: "L'aide allège toute la courbe sans en changer la forme." }], charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Même travail qu'une traction, avec une partie du poids du corps retirée. Diminue l'aide au fil des semaines : c'est ta progression vers les tractions complètes." },
  },
  "Tirage vertical prise serrée": {
    legende: "Tirage vertical prise serrée vu de profil : poignée triangle, on tire vers le bas du sternum.",
    depart: { hanche: [92, 128], torse: 192, tete: -10, cuisse: 92, tibia: 4, pied: 90, bras: 166, avbras: 166 }, arrivee: { bras: -20, avbras: 142 },
    objets: [{ t: "cable", de: [84, 6] }], muscle: ["dos"], fleche: { suit: "main", decale: [22, 0] },
    decor: [{ t: "banc", x: 70, y: 134, l: 46 }, { t: "pied", x: 93, y: 142, y2: 181 }, { t: "appui", x: 118, y: 116, l: 26, h: 8 }, { t: "poulie", x: 84, y: 6 }, SOL],
    effort: [{ art: "epaule", nom: "Épaule · grand dorsal", plan: { vue: "face", depart: { hanche: [100, 100], bras: 172, avbras: 188 }, arrivee: { bras: 20, avbras: 196 } } }], charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Prise serrée ou large, le grand dorsal travaille à peu près autant. La prise serrée permet une plus grande amplitude : cherche l'étirement complet en haut." },
  },
  "Tirage horizontal poulie": {
    legende: "Tirage horizontal vu de profil : assis, on tire la poignée vers le nombril en serrant les omoplates.",
    depart: { hanche: [70, 134], torse: 166, tete: -6, cuisse: [88, 84], tibia: [52, 48], pied: 90, bras: 76, avbras: 76 }, arrivee: { torse: 186, bras: -46, avbras: 86 },
    objets: [{ t: "cable", de: [192, 128] }], decor: [{ t: "banc", x: 40, y: 140, l: 70 }, { t: "pied", x: 70, y: 148, y2: 181 }, { t: "poulieb", x: 192, y: 128 }, SOL],
    muscle: ["dos"], fleche: { suit: "main", decale: [0, -16] },
    effort: [{ art: "epaule", nom: "Épaule · dos" }], charge: { t: "cable", de: [192, 128] }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Prise serrée, coudes près du corps : le grand dorsal travaille davantage. Coudes écartés : le haut du dos et l'arrière des épaules prennent plus de part. La poulie garde de la tension sur tout le trajet, avec un pic au milieu du mouvement." },
  },
  "Tirage bûcheron": {
    legende: "Rowing un bras vu de profil : genou et main sur le banc, dos plat, on tire l'haltère vers la hanche.",
    depart: { ...PENCHE_BANC, bras: [0, 0], avbras: [0, 0] }, arrivee: { bras: [-118, 0], avbras: [4, 0] },
    objets: [{ t: "haltere" }], decor: BANC_ROWING, muscle: ["dos"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "epaule", nom: "Épaule · grand dorsal" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Tirer vers la hanche, coude près du corps, fait travailler surtout le grand dorsal. À l'haltère, la charge pèse le plus en haut, coude en arrière : c'est là qu'il faut serrer, sans tourner le buste." },
  },
  "Rowing haltère": {
    legende: "Rowing haltère vu de profil : appui sur le banc, dos plat, on tire l'haltère vers la hanche.",
    depart: { ...PENCHE_BANC, bras: [0, 0], avbras: [0, 0] }, arrivee: { bras: [-116, 0], avbras: [2, 0] },
    objets: [{ t: "haltere" }], decor: BANC_ROWING, muscle: ["dos"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "epaule", nom: "Épaule · dos" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Même mouvement que le bûcheron. Coude près du corps : plus de grand dorsal ; coude écarté : plus de haut du dos. La charge pèse le plus en haut du mouvement." },
  },
  "Rowing barre": {
    legende: "Rowing barre vu de profil : debout, penché à 45°, dos plat, on tire la barre vers le bas du ventre.",
    depart: { ...PENCHE, bras: 0, avbras: 0 }, arrivee: { bras: -100, avbras: 2 },
    objets: [{ t: "barre" }], decor: [SOL], muscle: ["dos", "lombaires"], fleche: { suit: "main", decale: [22, 0] },
    effort: [{ art: "epaule", nom: "Épaule · dos" }, { art: "hanche", nom: "Hanche · lombaires" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Tout le dos travaille : grand dorsal, trapèzes, rhomboïdes, arrière des épaules. Les lombaires et les fessiers tiennent la position penchée pendant toute la série : leur effort reste élevé du début à la fin." },
  },
  "Rowing T-bar": {
    legende: "Rowing T-bar vu de profil : penché, dos plat, on tire la poignée vers le ventre.",
    depart: { ...PENCHE, torse: 136, bras: 0, avbras: 0 }, arrivee: { bras: -104, avbras: 0 },
    objets: [{ t: "barre", r: 13 }, { t: "poignee" }], decor: [SOL], muscle: ["dos", "lombaires"], fleche: { suit: "main", decale: [22, 0] },
    effort: [{ art: "epaule", nom: "Épaule · dos" }, { art: "hanche", nom: "Hanche · lombaires" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Même travail qu'un rowing barre, avec une trajectoire plus stable. La prise serrée en poignée neutre garde les coudes près du corps : plus de grand dorsal." },
  },
  "Rowing machine": {
    legende: "Rowing machine vu de profil : poitrine contre l'appui, on tire les coudes vers l'arrière.",
    depart: { hanche: [70, 132], torse: 172, cuisse: [86, 82], tibia: [8, 4], pied: 90, bras: 82, avbras: 82 }, arrivee: { bras: -44, avbras: 84 },
    objets: [{ t: "cable", de: [196, 96] }], decor: [{ t: "banc", x: 44, y: 138, l: 56 }, { t: "pied", x: 70, y: 146, y2: 181 }, { t: "bancr", x: 84, y: 60, l: 46, a: -80, app: true }, SOL],
    muscle: ["dos"], fleche: { suit: "main", decale: [0, -16] },
    effort: [{ art: "epaule", nom: "Épaule · dos", note: "Sur machine, la forme exacte dépend du modèle." }], charge: { t: "cable", de: [196, 96] }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "L'appui poitrine supprime le travail des lombaires : tout l'effort va au dos. Coudes serrés pour le grand dorsal, coudes écartés pour le haut du dos." },
  },
  "Tirage bras tendus poulie": {
    legende: "Tirage bras tendus vu de profil : bras presque tendus, on ramène la barre de la hauteur des yeux jusqu'aux cuisses.",
    depart: { ancre: "pieds", cheville: [86, 178], torse: 166, cuisse: 8, tibia: -6, bras: 128, avbras: 132 }, arrivee: { bras: 8, avbras: 12 },
    objets: [{ t: "cable", de: [176, 22] }], decor: [{ t: "poulie", x: 176, y: 22 }, SOL], muscle: ["dos", "triceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "epaule", nom: "Épaule · grand dorsal" }], charge: { t: "cable", de: [176, 22] }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Bras tendus, le biceps ne peut pas aider : le grand dorsal fait l'essentiel, avec la longue portion du triceps. Bon exercice de pré-fatigue avant un tirage." },
  },
  "Pull-over poulie": {
    legende: "Pull-over à la poulie vu de profil : buste penché, bras presque tendus, on ramène la corde de la tête jusqu'aux cuisses.",
    depart: { ancre: "pieds", cheville: [80, 178], torse: 150, cuisse: 14, tibia: -10, bras: 140, avbras: 144 }, arrivee: { bras: 6, avbras: 10 },
    objets: [{ t: "cable", de: [182, 26] }], decor: [{ t: "poulie", x: 182, y: 26 }, SOL], muscle: ["dos", "triceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "epaule", nom: "Épaule · grand dorsal" }], charge: { t: "cable", de: [182, 26] }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Buste penché, la poulie tire depuis l'avant : le grand dorsal est chargé dès l'étirement, bras en haut. Contrairement au pull-over allongé, c'est bien le dos qui fait le travail." },
  },
  "Rowing inversé": {
    legende: "Rowing inversé vu de profil : sous une barre, talons au sol, corps gainé, on tire la poitrine vers la barre.",
    depart: { ancre: "mains", main: [62, 96], torse: 252, tete: -6, cuisse: [72, 72], tibia: [72, 72], pied: [160, 160], brasAbs: true, bras: 176, avbras: 178 },
    arrivee: { torse: 238, cuisse: [58, 58], tibia: [58, 58], pied: [150, 150], bras: 26, avbras: 168 },
    objets: [], decor: [{ t: "barrefixe", x: 62, y: 96 }, SOL], muscle: ["dos", "biceps"], fleche: { suit: "epaule", decale: [0, 18] },
    effort: [{ art: "epaule", nom: "Épaule · dos", point: "main" }], charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_DOS, faisceaux: "Un rowing au poids du corps : tout le dos travaille, avec les biceps. Le plus dur est dans la seconde moitié de la montée, en approchant de la barre. Plus les pieds sont hauts, plus c'est difficile." },
  },
  "Rack pull": {
    legende: "Rack pull vu de profil : barre posée à hauteur des genoux, on se redresse en poussant les hanches vers l'avant.",
    depart: { ancre: "pieds", cheville: [96, 178], torse: 140, tete: -10, cuisse: 24, tibia: -6, brasAbs: true, bras: 0, avbras: 0 }, arrivee: { torse: 180, tete: 0, cuisse: 0, tibia: 0 },
    objets: [{ t: "barre" }], decor: [{ t: "appui", x: 94, y: 130, l: 26, h: 6 }, SOL], muscle: ["dos", "trapezes", "fessiers"], fleche: { suit: "main", decale: [28, 0] },
    effort: [{ art: "hanche", nom: "Hanche · fessiers et dos" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: "Un soulevé de terre partiel : il charge lourd le haut du dos, les trapèzes, les fessiers et la prise, en épargnant le bas du mouvement.", faisceaux: "L'effort de la hanche est maximal au départ, buste penché, et diminue à mesure qu'on se redresse. En haut, les trapèzes et les avant-bras tiennent la barre : c'est là que la prise lâche en premier." },
  },
  "Soulevé de terre": {
    legende: "Soulevé de terre vu de profil : barre au sol au-dessus du milieu du pied, on se relève barre collée aux jambes.",
    depart: { ancre: "pieds", cheville: [92, 178], torse: 126, tete: -16, cuisse: 62, tibia: -24, brasAbs: true, bras: 0, avbras: 0 }, arrivee: { torse: 180, tete: 0, cuisse: 0, tibia: 0 },
    objets: [{ t: "barre" }], decor: [SOL], muscle: ["fessiers", "ischios", "lombaires"], fleche: { suit: "main", decale: [30, 0] },
    effort: [{ art: "hanche", nom: "Hanche · fessiers et ischios" }, { art: "genou", nom: "Genou · quadriceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: "Le soulevé de terre fait travailler presque tout le corps : fessiers, ischios et lombaires pour redresser la hanche, quadriceps pour tendre les genoux, dos et avant-bras pour tenir la barre.", faisceaux: "Au départ, les quadriceps et les hanches poussent ensemble ; une fois la barre passée aux genoux, ce sont surtout les fessiers et les ischios qui finissent le mouvement." },
  },
  "Shrug haltères": {
    vue: "face",
    legende: "Shrug haltères vu de face : bras le long du corps, on monte les épaules droit vers les oreilles.",
    depart: { hanche: [100, 104], bras: 6, avbras: 2, cuisse: 4, tibia: 2, hausse: 0 }, arrivee: { hausse: 9 },
    objets: [{ t: "halteres" }], decor: [SOL], muscle: ["trapezes"], fleche: { suit: "main", decale: [14, 0] },
    effort: [{ art: "epaule", nom: "Épaules · trapèzes", profil: [1, 1, 1, 1, 1], note: "On monte la charge droit vers le haut : son poids ne change pas de levier." }], etire: 0,
    analyse: { pourquoi: "Le haut des trapèzes monte les épaules et les omoplates. Le shrug isole ce mouvement.", faisceaux: "Surtout le faisceau supérieur des trapèzes. Monte droit, sans rouler les épaules : rouler n'ajoute rien et fatigue l'articulation." },
  },
  "Shrug barre": {
    vue: "face",
    legende: "Shrug barre vu de face : barre devant les cuisses, on hausse les épaules le plus haut possible.",
    depart: { hanche: [100, 104], bras: 4, avbras: 0, cuisse: 4, tibia: 2, hausse: 0 }, arrivee: { hausse: 9 },
    objets: [{ t: "barreface" }], decor: [SOL], muscle: ["trapezes"], fleche: { suit: "main", decale: [48, 0] },
    effort: [{ art: "epaule", nom: "Épaules · trapèzes", profil: [1, 1, 1, 1, 1], note: "On monte la charge droit vers le haut : son poids ne change pas de levier." }], etire: 0,
    analyse: { pourquoi: "Le haut des trapèzes monte les épaules et les omoplates. La barre permet de charger plus lourd qu'aux haltères.", faisceaux: "Surtout le faisceau supérieur des trapèzes. Des sangles aident si la prise lâche avant les trapèzes." },
  },
  "Hyperextensions": {
    legende: "Hyperextension vue de profil : hanches sur l'appui, on remonte le buste jusqu'à l'alignement avec les jambes.",
    depart: { hanche: [104, 100], torse: 26, tete: 14, cuisse: [300, 300], tibia: [300, 300], pied: [210, 210], bras: 30, avbras: 150 }, arrivee: { torse: 120, tete: 0 },
    objets: [], decor: [{ t: "bancr", x: 74, y: 120, l: 40, a: -30, app: true }, { t: "appui", x: 18, y: 148, l: 14, h: 8 }, { t: "pied", x: 60, y: 140, x2: 40, y2: 181 }, SOL],
    muscle: ["lombaires", "fessiers", "ischios"], fleche: { suit: "tete", decale: [16, 0] },
    effort: [{ art: "hanche", nom: "Hanche · fessiers et lombaires", point: "epaule" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: "L'hyperextension redresse le buste depuis la hanche : fessiers, ischios et muscles du bas du dos travaillent ensemble.", faisceaux: "Les fessiers et les ischios y sont très actifs. L'effort est le plus grand en haut, buste aligné avec les jambes : inutile d'aller au-delà en se cambrant." },
  },
});

/* ── ÉPAULES ── */
const POURQUOI_EPAULES = "Le deltoïde a trois faisceaux : l'avant lève le bras devant soi, le milieu l'écarte sur le côté, l'arrière le tire en arrière. Les développés travaillent surtout l'avant ; le milieu et l'arrière ont besoin d'exercices à eux.";
// Développés au-dessus de la tête : l'effort de l'épaule se lit de face, coudes sur les côtés
const PLAN_DEV_EPAULES = { vue: "face", depart: { hanche: [100, 100], bras: 82, avbras: 172 }, arrivee: { bras: 166, avbras: 176 } };
const ASSIS_DOSSIER = [{ t: "bancr", x: 64, y: 134, l: 66, a: 90, h: 8 }, { t: "banc", x: 60, y: 136, l: 40 }, { t: "pied", x: 80, y: 144, y2: 181 }, SOL];
const ASSIS = { hanche: [78, 130], torse: 180, cuisse: [86, 82], tibia: [2, -2], pied: 90 };
Object.assign(SCHEMAS, {
  "Développé militaire barre": {
    legende: "Développé militaire vu de profil : debout, la barre part du haut de la poitrine et monte au-dessus de la tête.",
    depart: { ancre: "pieds", cheville: [96, 178], torse: 180, tete: 6, bras: 40, avbras: 176 }, arrivee: { tete: 0, bras: 178, avbras: 180 },
    objets: [{ t: "barre" }], decor: [SOL], muscle: ["epaule-avant", "triceps"], fleche: { suit: "main", decale: [26, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde avant" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Surtout l'avant de l'épaule et le triceps. L'effort est le plus grand dans la première moitié, quand la barre passe devant le visage, puis diminue une fois la barre au-dessus de la tête." },
  },
  "DM haltères": {
    legende: "Développé haltères assis vu de profil : dos contre le dossier, les haltères montent des oreilles au-dessus de la tête.",
    depart: { ...ASSIS, bras: 30, avbras: 178 }, arrivee: { bras: 178, avbras: 180 },
    objets: [{ t: "halteres" }], decor: ASSIS_DOSSIER, muscle: ["epaules", "triceps"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde", plan: PLAN_DEV_EPAULES }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Les haltères demandent plus de stabilité qu'une barre : le deltoïde est plus actif, mais on soulève un peu moins. Assis, on soulève environ 10 % de plus que debout." },
  },
  "Développé haltères assis": {
    legende: "Développé haltères assis vu de profil : dos calé, coudes légèrement devant le corps, on pousse au-dessus de la tête.",
    depart: { ...ASSIS, bras: 36, avbras: 176 }, arrivee: { bras: 176, avbras: 180 },
    objets: [{ t: "halteres" }], decor: ASSIS_DOSSIER, muscle: ["epaules", "triceps"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde", plan: PLAN_DEV_EPAULES }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Coudes un peu devant le corps, l'épaule est plus à l'aise qu'avec les coudes complètement sur les côtés. L'effort est le plus grand en bas, haltères au niveau des oreilles." },
  },
  "Développé épaules machine": {
    legende: "Développé épaules à la machine vu de profil : assis, on pousse les poignées au-dessus de la tête.",
    depart: { ...ASSIS, bras: 34, avbras: 176 }, arrivee: { bras: 176, avbras: 180 },
    objets: [{ t: "poignee" }], decor: ASSIS_DOSSIER, muscle: ["epaules", "triceps"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde", plan: PLAN_DEV_EPAULES, note: "Si la machine résiste à la verticale ; certains modèles allègent le bas du mouvement." }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Même travail qu'aux haltères, sans avoir à stabiliser : on peut aller près de l'échec en sécurité. Le deltoïde y est un peu moins actif qu'aux haltères debout." },
  },
  "Développé Arnold": {
    legende: "Développé Arnold vu de profil : haltères devant le visage paumes vers soi, on les tourne en poussant pour finir paumes vers l'avant.",
    depart: { ...ASSIS, bras: 48, avbras: 168 }, arrivee: { bras: 178, avbras: 180 },
    objets: [{ t: "halteres" }], decor: ASSIS_DOSSIER, muscle: ["epaule-avant", "epaules"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde", plan: { vue: "face", depart: { hanche: [100, 100], bras: 30, avbras: 176 }, arrivee: { bras: 166, avbras: 176 } } }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "La rotation fait passer le travail de l'avant de l'épaule (haltères devant le visage) au faisceau moyen (coudes sur les côtés). La rotation se fait pendant la montée, pas après." },
  },
  "Élévations latérales poulie": {
    vue: "face",
    legende: "Élévation latérale à la poulie vue de face : le câble passe devant le corps, on monte le bras sur le côté jusqu'à l'horizontale.",
    depart: { hanche: [100, 100], bras: [12, 6], avbras: [8, 4], cuisse: 4, tibia: 2 }, arrivee: { bras: [86, 6], avbras: [80, 4] },
    objets: [{ t: "cable", de: [44, 152] }], decor: [{ t: "poulieb", x: 44, y: 152 }, SOL], muscle: ["epaules"], fleche: { suit: "main", decale: [10, 16] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde moyen" }], charge: { t: "cable", de: [44, 152] }, etire: 0,
    analyse: { pourquoi: "Le faisceau moyen du deltoïde écarte le bras du corps : c'est lui qui donne la largeur des épaules.", faisceaux: "Poulie réglée à hauteur de la main, la charge pèse dès le départ, bras le long du corps, là où l'haltère ne pèse presque rien. Les deux versions font grossir l'épaule autant : alterne-les ou garde celle que tu sens le mieux." },
  },
  "Élévations frontales": {
    legende: "Élévation frontale vue de profil : bras devant les cuisses, on les monte devant soi jusqu'à hauteur des yeux.",
    depart: { ancre: "pieds", cheville: [92, 178], torse: 180, bras: [8, 4], avbras: [6, 2] }, arrivee: { bras: [100, 96], avbras: [98, 94] },
    objets: [{ t: "halteres" }], decor: [SOL], muscle: ["epaule-avant", "pecs"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde avant" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Surtout l'avant de l'épaule, avec le haut des pecs. Comme l'avant de l'épaule travaille déjà beaucoup dans tous les développés, un petit volume suffit." },
  },
  "Oiseau haltères": {
    vue: "bout",
    legende: "Oiseau vu de face : buste penché presque à l'horizontale, bras pendants, on les ouvre sur les côtés.",
    depart: { ...BOUT, bras: 8, avbras: 4 }, arrivee: { bras: 86, avbras: 90 },
    objets: [{ t: "halteres" }], decor: [], muscle: ["epaule-arriere"], fleche: { suit: "main", decale: [10, 14] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde arrière" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Surtout l'arrière de l'épaule. La charge pèse le plus bras écartés, en haut. Garde les omoplates relâchées : si tu les serres, c'est le milieu du dos qui travaille." },
  },
  "Oiseau machine": {
    vue: "bout",
    legende: "Oiseau à la machine vu du dessus : face à la machine, on ouvre les bras vers l'arrière.",
    depart: { ...BOUT, bras: 182, avbras: 178 }, arrivee: { bras: 92, avbras: 90 },
    objets: [{ t: "poignee" }], decor: [], muscle: ["epaule-arriere"], fleche: { suit: "main", decale: [12, -14] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde arrière", profil: [1, 1, 1, 1, 1], note: "La machine tourne autour de l'épaule avec un bras de levier fixe : la résistance reste la même d'un bout à l'autre." }], etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "La machine garde la même résistance sur tout le trajet, et le buste calé empêche de tricher. Pense « écarter les mains » plutôt que « reculer les coudes »." },
  },
  "Écarté inversé poulie": {
    vue: "bout",
    legende: "Écarté inversé à la poulie vu du dessus : câbles croisés devant soi, on ouvre les bras vers l'arrière.",
    depart: { ...BOUT, bras: 194, avbras: 186 }, arrivee: { bras: 94, avbras: 92 },
    objets: [{ t: "cable", de: [40, 8], deux: true }], decor: [], muscle: ["epaule-arriere"], fleche: { suit: "main", decale: [12, -14] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde arrière" }], charge: { t: "cable", de: [40, 8] }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Les câbles croisés tirent depuis le côté opposé : la tension commence dès les bras croisés, quand l'arrière de l'épaule est étiré." },
  },
  "Face pull": {
    vue: "bout",
    legende: "Face pull vu du dessus : corde à hauteur du visage, on tire en écartant les mains jusqu'à côté des oreilles.",
    depart: { ...BOUT, bras: 182, avbras: 178 }, arrivee: { bras: 96, avbras: 178 },
    objets: [{ t: "cable", de: [100, 6], deux: true }], decor: [{ t: "poulie", x: 100, y: 6 }], muscle: ["epaule-arriere"], fleche: { suit: "main", decale: [14, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde arrière" }], charge: { t: "cable", de: [100, 6] }, etire: 0,
    analyse: { pourquoi: "Le face pull combine deux gestes : tirer les coudes en arrière (arrière de l'épaule, milieu du dos) et tourner les bras vers l'extérieur (muscles de la coiffe).", faisceaux: "Arrière de l'épaule, trapèzes et coiffe des rotateurs. Léger et souvent : c'est un exercice d'équilibre pour des épaules qui font beaucoup de développés." },
  },
  "Tirage araignée": {
    vue: "bout",
    legende: "Tirage araignée vu de face : à plat ventre sur un banc incliné, bras pendants, on les ouvre sur les côtés.",
    depart: { ...BOUT, bras: 6, avbras: 4 }, arrivee: { bras: 84, avbras: 90 },
    objets: [{ t: "halteres" }], decor: [{ t: "banc", x: 86, y: 128, l: 28, h: 10 }, { t: "pied", x: 100, y: 138, y2: 181 }, SOL], muscle: ["epaule-arriere"], fleche: { suit: "main", decale: [10, 14] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde arrière" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Le banc empêche le buste de bouger : tout le travail va à l'arrière des épaules. Petits poids, mouvement lent, épaules relâchées." },
  },
  "Tirage menton": {
    vue: "face",
    legende: "Tirage menton vu de face : barre devant les cuisses, on monte les coudes sur les côtés jusqu'à amener la barre au bas de la poitrine.",
    depart: { hanche: [100, 104], bras: 8, avbras: -6, cuisse: 4, tibia: 2 }, arrivee: { bras: 92, avbras: -36 },
    objets: [{ t: "barreface", ext: 28 }], decor: [SOL], muscle: ["epaules", "trapezes"], fleche: { suit: "coude", decale: [14, 0] },
    effort: [{ art: "epaule", nom: "Épaule · deltoïde moyen", point: "coude" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_EPAULES, faisceaux: "Plus la prise est large, plus le deltoïde et les trapèzes travaillent, et moins le biceps aide. Monte jusqu'au bas de la poitrine, coudes en premier : inutile d'aller jusqu'au menton." },
  },
});

/* ── BICEPS ── */
const POURQUOI_BICEPS = "Le biceps plie le coude et tourne la main paume vers le haut ; le brachial, dessous, plie le coude quelle que soit la main ; le brachio-radial, sur l'avant-bras, aide surtout main de côté ou paume vers le bas.";
const DEBOUT = { ancre: "pieds", cheville: [94, 178], torse: 180 };
const CURL = { depart: { ...DEBOUT, bras: [4, -4], avbras: [6, 2] }, arrivee: { avbras: [148, 140] } };
Object.assign(SCHEMAS, {
  "Curl barre": {
    legende: "Curl barre vu de profil : coudes collés au corps, la barre monte des cuisses jusqu'aux épaules.",
    ...CURL, objets: [{ t: "barre", r: 12 }], decor: [SOL], muscle: ["biceps"], fleche: { suit: "main", decale: [22, 0] },
    effort: [{ art: "coude", nom: "Coude · biceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "Paumes vers le haut, c'est la prise où le biceps travaille le plus. La charge pèse le plus avant-bras à l'horizontale, au milieu du mouvement. La barre EZ, un peu coudée, ménage les poignets." },
  },
  "Curl marteau": {
    legende: "Curl marteau vu de profil : paumes face à face, coudes fixes, on monte les haltères vers les épaules.",
    ...CURL, objets: [{ t: "halteres" }], decor: [SOL], muscle: ["biceps", "avbras"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "coude", nom: "Coude · brachial" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "Main de côté, le biceps travaille un peu moins et le brachial et le brachio-radial davantage : le bras s'épaissit, l'avant-bras aussi. Bon complément du curl classique." },
  },
  "Curl incliné": {
    legende: "Curl incliné vu de profil : assis sur un banc incliné, bras pendants derrière le corps, on plie les coudes sans les avancer.",
    depart: { hanche: [104, 130], torse: 222, tete: -16, cuisse: [84, 80], tibia: [0, -4], pied: 90, brasAbs: true, bras: [0, -4], avbras: [2, -2] }, arrivee: { avbras: [150, 144] },
    objets: [{ t: "halteres" }], decor: [{ t: "bancr", x: 58, y: 90, l: 62, a: -48 }, { t: "banc", x: 96, y: 136, l: 38 }, { t: "pied", x: 112, y: 144, y2: 181 }, SOL],
    muscle: ["biceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "coude", nom: "Coude · biceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "Le bras derrière le corps étire la longue portion du biceps. Cette position ne le fait pourtant pas grossir plus qu'un curl classique : c'est une variante pour changer, pas un raccourci." },
  },
  "Curl pupitre": {
    legende: "Curl au pupitre vu de profil : bras posés sur le pupitre, on monte la charge sans décoller les coudes.",
    depart: { hanche: [70, 132], torse: 180, cuisse: [88, 84], tibia: [2, -2], pied: 90, brasAbs: true, bras: [46, 42], avbras: [42, 38] }, arrivee: { avbras: [172, 166] },
    objets: [{ t: "barre", r: 11 }], decor: [{ t: "bancr", x: 66, y: 92, l: 40, a: -46, app: true }, { t: "pied", x: 98, y: 124, y2: 181 }, { t: "banc", x: 46, y: 138, l: 46 }, { t: "pied", x: 68, y: 146, y2: 181 }, SOL],
    muscle: ["biceps"], fleche: { suit: "main", decale: [18, -4] },
    effort: [{ art: "coude", nom: "Coude · biceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "Au pupitre, la charge pèse le plus dans la première moitié, bras presque tendu, et plus du tout en haut. Insister sur cette première moitié fait un peu plus grossir le bas du biceps." },
  },
  "Curl poulie": {
    legende: "Curl à la poulie vu de profil : face à la poulie basse, coudes le long du corps, on monte la barre vers les épaules.",
    ...CURL, objets: [{ t: "cable", de: [128, 174] }], decor: [{ t: "poulieb", x: 128, y: 174 }, SOL], muscle: ["biceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "coude", nom: "Coude · biceps" }], charge: { t: "cable", de: [128, 174] }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "La poulie garde de la tension plus haut dans le mouvement qu'un haltère. Reculer d'un pas déplace le moment le plus dur : plus loin de la poulie, plus de tension en haut." },
  },
  "Curl concentré": {
    legende: "Curl concentré vu de profil : assis, coude calé contre l'intérieur de la cuisse, on monte l'haltère vers l'épaule.",
    depart: { hanche: [64, 132], torse: 146, tete: 10, cuisse: [86, 80], tibia: [4, 0], pied: 90, brasAbs: true, bras: [4, 0], avbras: [8, 2] }, arrivee: { avbras: [158, 2] },
    objets: [{ t: "haltere" }], decor: [{ t: "banc", x: 30, y: 138, l: 60 }, { t: "pied", x: 60, y: 146, y2: 181 }, SOL], muscle: ["biceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "coude", nom: "Coude · biceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "Le coude calé empêche toute triche : seul le bras travaille. La charge pèse le plus avant-bras à l'horizontale. Vise la sensation plutôt que la charge." },
  },
  "Curl araignée": {
    legende: "Curl araignée vu de profil : à plat ventre sur un banc incliné, bras pendants, on monte la charge sans bouger les coudes.",
    depart: { hanche: [70, 124], torse: 132, tete: 10, cuisse: [338, 342], tibia: [4, 0], pied: 90, brasAbs: true, bras: [2, -2], avbras: [4, 0] }, arrivee: { avbras: [156, 150] },
    objets: [{ t: "barre", r: 11 }], decor: [{ t: "bancr", x: 78, y: 132, l: 50, a: 48 }, { t: "pied", x: 84, y: 132, y2: 181 }, SOL],
    muscle: ["biceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "coude", nom: "Coude · biceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "Bras vertical devant le corps, le biceps est déjà raccourci : la contraction en haut est très forte. Tiens 1 seconde en haut, avec une charge légère." },
  },
  "Curl inversé": {
    legende: "Curl inversé vu de profil : paumes vers le bas, poignets droits, coudes fixes, on monte la barre.",
    ...CURL, objets: [{ t: "barre", r: 10 }], decor: [SOL], muscle: ["avbras", "biceps"], fleche: { suit: "main", decale: [20, 0] },
    effort: [{ art: "coude", nom: "Coude · brachio-radial" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_BICEPS, faisceaux: "Paumes vers le bas, le biceps travaille moins et c'est le brachio-radial, sur le dessus de l'avant-bras, qui prend le relais. La charge est bien plus légère qu'en curl classique : c'est normal." },
  },
});

/* ── TRICEPS ── */
const POURQUOI_TRICEPS = "Le triceps tend le coude. Sa longue portion passe aussi par l'épaule : elle n'est vraiment étirée que bras au-dessus de la tête, et c'est dans cette position qu'elle grossit le plus.";
const PLAN_DEV_SERRE = { depart: { ...ALLONGE, bras: 180, avbras: 180 }, arrivee: { bras: 30, avbras: 178 } };
Object.assign(SCHEMAS, {
  "Triceps poulie": {
    legende: "Extension à la poulie haute vue de profil : coudes collés au corps, on pousse la barre vers le bas jusqu'à tendre les bras.",
    depart: { ...DEBOUT, torse: 174, bras: [2, -2], avbras: [104, 98] }, arrivee: { avbras: [6, 2] },
    objets: [{ t: "cable", de: [118, 8] }], decor: [{ t: "poulie", x: 118, y: 8 }, SOL], muscle: ["triceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "coude", nom: "Coude · triceps" }], charge: { t: "cable", de: [118, 8] }, etire: 0,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Bras le long du corps, ce sont surtout les portions latérale et médiale qui travaillent. La charge pèse le plus au début, coude plié, quand le triceps est étiré. Pour la longue portion, ajoute une extension bras au-dessus de la tête." },
  },
  "Extension triceps corde": {
    legende: "Extension à la corde vue de profil : coudes fixes, on pousse vers le bas et on écarte la corde en fin de mouvement.",
    depart: { ...DEBOUT, torse: 172, bras: [2, -2], avbras: [110, 104] }, arrivee: { avbras: [2, -2] },
    objets: [{ t: "cable", de: [118, 8] }], decor: [{ t: "poulie", x: 118, y: 8 }, SOL], muscle: ["triceps"], fleche: { suit: "main", decale: [18, 0] },
    effort: [{ art: "coude", nom: "Coude · triceps" }], charge: { t: "cable", de: [118, 8] }, etire: 0,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Même travail qu'à la barre, avec un peu plus d'amplitude en bas grâce à la corde. Écarter les mains en bas renforce la contraction." },
  },
  "Ext. triceps": {
    legende: "Extension au-dessus de la tête vue de profil : bras vers le plafond, on descend la charge derrière la tête puis on tend les bras.",
    depart: { ...DEBOUT, brasAbs: true, bras: [172, 168], avbras: [330, 326] }, arrivee: { avbras: [178, 174] },
    objets: [{ t: "haltere" }], decor: [SOL], muscle: ["triceps"], fleche: { suit: "main", decale: [-16, 0] },
    effort: [{ art: "coude", nom: "Coude · triceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Bras au-dessus de la tête, la longue portion est étirée : c'est la position qui la fait le plus grossir, nettement plus que bras le long du corps, même avec une charge plus légère. La charge pèse le plus avant-bras à l'horizontale, derrière la tête." },
  },
  "Extension triceps haltère": {
    legende: "Extension haltère vue de profil : haltère tenu à deux mains au-dessus de la tête, on le descend derrière la nuque.",
    depart: { ...DEBOUT, brasAbs: true, bras: [174, 170], avbras: [326, 322] }, arrivee: { avbras: [178, 174] },
    objets: [{ t: "haltere", r: 9 }], decor: [SOL], muscle: ["triceps"], fleche: { suit: "main", decale: [-16, 0] },
    effort: [{ art: "coude", nom: "Coude · triceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Même avantage que toute extension au-dessus de la tête : la longue portion travaille étirée. Garde les coudes pointés vers le haut." },
  },
  "Extension triceps poulie haute": {
    legende: "Extension à la poulie, dos à la machine, vue de profil : buste penché, on tend les bras vers l'avant.",
    depart: { ancre: "pieds", cheville: [104, 178], torse: 150, cuisse: [10, -10], tibia: [-6, -14], brasAbs: true, bras: [132, 128], avbras: [304, 300] }, arrivee: { avbras: [134, 130] },
    objets: [{ t: "cable", de: [22, 70] }], decor: [{ t: "poulieb", x: 22, y: 70 }, SOL], muscle: ["triceps"], fleche: { suit: "main", decale: [0, -16] },
    effort: [{ art: "coude", nom: "Coude · triceps" }], charge: { t: "cable", de: [22, 70] }, etire: 0,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Bras levés devant soi, la longue portion est étirée comme pour une extension au-dessus de la tête, avec une poulie qui garde la tension sur tout le trajet." },
  },
  "Barre au front": {
    legende: "Barre au front vue de profil : allongé, bras verticaux, on plie les coudes pour descendre la barre derrière la tête.",
    depart: { ...ALLONGE, bras: 196, avbras: 196 }, arrivee: { avbras: 296 },
    objets: [{ t: "barre", r: 11 }], decor: BANC_PLAT, muscle: ["triceps"], fleche: { suit: "main", decale: [0, -16] },
    effort: [{ art: "coude", nom: "Coude · triceps" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Bras inclinés vers la tête, la longue portion est plus étirée que bras le long du corps. Descendre la barre derrière la tête plutôt que vers le front charge le triceps étiré et soulage le coude." },
  },
  "Kickback haltère": {
    legende: "Kickback vu de profil : buste penché, bras collé au corps, on tend l'avant-bras vers l'arrière.",
    depart: { ...PENCHE_BANC, bras: [-96, 0], avbras: [-2, 0] }, arrivee: { avbras: [-94, 0] },
    objets: [{ t: "haltere" }], decor: BANC_ROWING, muscle: ["triceps"], fleche: { suit: "main", decale: [0, 16] },
    effort: [{ art: "coude", nom: "Coude · triceps" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "L'haltère ne pèse presque rien au départ, avant-bras vertical, et le plus à la fin, bras tendu : c'est là qu'il faut tenir 1 seconde. Une version poulie charge davantage le début." },
  },
  "Développé couché prise serrée": {
    legende: "Développé prise serrée vu de profil : mains à largeur d'épaules, coudes près du corps, la barre descend vers le bas des pecs.",
    depart: { ...ALLONGE, bras: 180, avbras: 180 }, arrivee: { bras: 30, avbras: 178 },
    objets: [{ t: "barre" }], decor: BANC_PLAT, muscle: ["triceps", "pecs"], fleche: { suit: "main", decale: [26, -4] },
    effort: [{ art: "epaule", nom: "Épaule · pecs et triceps", plan: PLAN_DEV_SERRE }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Mains plus serrées et coudes près du corps : le triceps prend une plus grande part du travail que dans un développé classique, qui fait déjà bien travailler le triceps. Largeur d'épaules suffit : plus serré, les poignets souffrent." },
  },
  "Dips": {
    legende: "Dips buste droit vus de profil : en appui sur les barres, on descend jusqu'à bras à angle droit puis on pousse.",
    depart: { ancre: "mains", main: [100, 80], torse: 176, cuisse: [10, 4], tibia: [-70, -74], pied: 20, brasAbs: true, bras: 0, avbras: 0 }, arrivee: { torse: 168, bras: -78, avbras: 6 },
    objets: [], decor: [{ t: "barres", x: 100, y: 82 }, SOL], muscle: ["triceps", "pecs"], fleche: { suit: "epaule", decale: [22, 0] },
    effort: [{ art: "epaule", nom: "Épaule · pecs et triceps", point: "main" }], charge: { t: "haut" }, etire: 1,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Les dips font travailler fortement le triceps et les pecs. Buste droit, la part du triceps augmente. Le plus dur est en bas : arrête-toi bras à angle droit." },
  },
  "Dips assistés": {
    legende: "Dips assistés vus de profil : genoux sur la plateforme à contrepoids, on descend jusqu'à bras à angle droit puis on pousse.",
    depart: { ancre: "mains", main: [100, 80], torse: 176, cuisse: [26, 22], tibia: [-84, -88], pied: 10, brasAbs: true, bras: 0, avbras: 0 }, arrivee: { torse: 168, bras: -78, avbras: 6 },
    objets: [{ t: "boudin", sur: "genou" }], decor: [{ t: "barres", x: 100, y: 82 }, SOL], muscle: ["triceps", "pecs"], fleche: { suit: "epaule", decale: [22, 0] },
    effort: [{ art: "epaule", nom: "Épaule · pecs et triceps", point: "main", note: "Le contrepoids allège toute la courbe sans en changer la forme." }], charge: { t: "haut" }, etire: 1,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Même travail que des dips, avec une partie du poids du corps retirée par le contrepoids. La charge réellement soulevée est ton poids moins le contrepoids : c'est elle que l'app suit pour tes progrès." },
  },
  "Dips entre deux bancs": {
    legende: "Dips au banc vus de profil : mains sur le bord du banc derrière soi, jambes tendues devant, on descend en pliant les coudes.",
    depart: { ancre: "mains", main: [70, 120], torse: 180, cuisse: [90, 86], tibia: [76, 72], pied: 160, brasAbs: true, bras: 0, avbras: 0 }, arrivee: { bras: -64, avbras: 4, cuisse: [80, 76], tibia: [84, 80] },
    objets: [], decor: [{ t: "banc", x: 30, y: 122, l: 50 }, { t: "pied", x: 50, y: 130, y2: 181 }, SOL], muscle: ["triceps"], fleche: { suit: "epaule", decale: [-20, 0] },
    effort: [{ art: "epaule", nom: "Épaule · triceps", point: "main" }], charge: { t: "haut" }, etire: 1,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Une version plus facile des dips, dont on règle la difficulté avec les jambes : pieds au sol genoux pliés pour débuter, pieds surélevés pour corser. Ne descends pas trop bas : l'épaule part vers l'avant." },
  },
  "Pompes diamant": {
    legende: "Pompes diamant vues de profil : mains rapprochées sous la poitrine, coudes près du corps.",
    depart: { ancre: "mains", main: [128, 177], torse: 114, cuisse: [294, 294], tibia: [294, 294], pied: [10, 10], brasAbs: true, bras: 4, avbras: 0 },
    arrivee: { torse: 103, cuisse: [283, 283], tibia: [283, 283], bras: -82, avbras: 8 },
    objets: [], decor: [SOL], muscle: ["triceps", "pecs"], fleche: { suit: "epaule", decale: [16, -20] },
    effort: [{ art: "epaule", nom: "Épaule · pecs et triceps", plan: PLAN_DEV_SERRE }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_TRICEPS, faisceaux: "Mains rapprochées, le triceps fait une plus grande part du travail qu'en pompe classique. Trop dur ? Fais-les sur les genoux." },
  },
});

/* ── QUADRICEPS ── */
const POURQUOI_QUADS = "Le quadriceps tend le genou. Trois de ses chefs (les vastes) ne passent que par le genou ; le quatrième, le droit fémoral, passe aussi par la hanche et grossit surtout avec les exercices où la hanche reste ouverte, comme le leg extension.";
// Presse inclinée à 45° : la plateforme recule vers la hanche le long du rail
const PRESSE = { hanche: [62, 146], torse: 230, tete: -20, brasAbs: true, bras: 20, avbras: 80, pied: [225, 225] };
const RAIL_PRESSE = { t: "cable", de: [-300, 510] };  // direction du rail : vers le bas et la gauche, à 45°
const DECOR_PRESSE = [{ t: "bancr", x: 18, y: 112, l: 54, a: -40 }, { t: "banc", x: 54, y: 152, l: 30 }, { t: "pied", x: 70, y: 160, y2: 181 }, SOL];
const MACHINE_RONDE = "Avec une came ronde, le bras de levier de la machine reste le même : la résistance est constante. Avec une came ovale, elle varie selon le modèle.";
Object.assign(SCHEMAS, {
  "Front squat": {
    legende: "Front squat vu de profil : barre sur l'avant des épaules, coudes hauts, on descend buste droit.",
    depart: { ancre: "pieds", cheville: [92, 178], cuisse: 0, tibia: 0, torse: 178, bras: 50, avbras: 150 }, arrivee: { cuisse: 86, tibia: -36, torse: 160 },
    objets: [{ t: "barre", sur: "ep", decale: [8, -4] }], decor: [SOL], muscle: ["quadriceps"], fleche: { suit: "epaule", decale: [34, 0] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "hanche" }, { art: "hanche", nom: "Hanche · fessiers", point: "barre" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Barre devant, le buste reste plus droit qu'au squat classique : le genou travaille davantage, la hanche et le dos un peu moins. Comme pour tout squat, plus tu descends, plus l'effort augmente." },
  },
  "Goblet squat": {
    legende: "Goblet squat vu de profil : haltère contre la poitrine, on descend entre les jambes buste droit.",
    depart: { ancre: "pieds", cheville: [92, 178], cuisse: 0, tibia: 0, torse: 178, bras: 26, avbras: 164 }, arrivee: { cuisse: 88, tibia: -34, torse: 158 },
    objets: [{ t: "haltere", r: 9 }], decor: [SOL], muscle: ["quadriceps", "fessiers"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "hanche" }, { art: "hanche", nom: "Hanche · fessiers" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "L'haltère devant soi aide à garder le buste droit et à descendre bas : parfait pour apprendre le squat. L'effort augmente avec la profondeur." },
  },
  "Presse à cuisses": {
    legende: "Presse à 45° vue de profil : dos calé, on descend la plateforme vers la poitrine puis on la repousse.",
    depart: { ...PRESSE, cuisse: [134, 128], tibia: [136, 130] }, arrivee: { cuisse: [194, 188], tibia: [76, 70] },
    objets: [{ t: "plateforme", a: 45, cote: -7 }], decor: DECOR_PRESSE, muscle: ["quadriceps", "fessiers"], fleche: { suit: "cheville", decale: [14, 14] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "cheville" }, { art: "hanche", nom: "Hanche · fessiers", point: "cheville" }], charge: RAIL_PRESSE, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Les quadriceps font l'essentiel, aidés par les fessiers et les adducteurs, sans charge sur le dos. L'effort est le plus grand genoux pliés : descends tant que le bassin reste collé au dossier." },
  },
  "Presse lourde": {
    legende: "Presse lourde vue de profil : même mouvement qu'à la presse, charge lourde et amplitude complète.",
    depart: { ...PRESSE, cuisse: [134, 128], tibia: [136, 130] }, arrivee: { cuisse: [190, 184], tibia: [80, 74] },
    objets: [{ t: "plateforme", a: 45, cote: -7 }], decor: DECOR_PRESSE, muscle: ["quadriceps", "fessiers"], fleche: { suit: "cheville", decale: [14, 14] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "cheville" }, { art: "hanche", nom: "Hanche · fessiers", point: "cheville" }], charge: RAIL_PRESSE, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Lourd ne veut pas dire raccourci : c'est en bas, genoux pliés, que le quadriceps est le plus sollicité. Des demi-répétitions très chargées perdent justement cette partie." },
  },
  "Presse unilatérale": {
    legende: "Presse à une jambe vue de profil : un seul pied sur la plateforme, on descend lentement en contrôlant le genou.",
    depart: { ...PRESSE, cuisse: [134, 196], tibia: [136, 100] }, arrivee: { cuisse: [194, 196], tibia: [76, 100] },
    objets: [{ t: "plateforme", a: 45, cote: -7 }], decor: DECOR_PRESSE, muscle: ["quadriceps", "fessiers"], fleche: { suit: "cheville", decale: [14, 14] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "cheville" }], charge: RAIL_PRESSE, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Une jambe à la fois : chaque côté fait sa part, ce qui corrige un écart de force entre les deux jambes. Charge réduite de plus de moitié par rapport à la presse à deux jambes." },
  },
  "Hack squat": {
    legende: "Hack squat vu de profil : dos contre le dossier incliné, on descend en gardant les genoux dans l'axe des pieds.",
    depart: { ancre: "pieds", cheville: [118, 176], cuisse: 16, tibia: 16, torse: 206, tete: -8, bras: 20, avbras: 150, pied: 96 }, arrivee: { cuisse: 96, tibia: -26, torse: 206 },
    objets: [], decor: [{ t: "bancr", x: 60, y: 38, l: 118, a: -72, h: 6 }, { t: "bancr", x: 104, y: 180, l: 34, a: 0, h: 5 }, SOL], muscle: ["quadriceps"], fleche: { suit: "epaule", decale: [-20, 0] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "epaule" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Le dossier tient le buste : tout le travail va aux jambes, surtout aux quadriceps. Pieds plus bas sur la plateforme, les genoux avancent davantage et le quadriceps travaille encore plus." },
  },
  "Squat pendulaire": {
    legende: "Squat pendulaire vu de profil : épaules sous les appuis, on descend profondément en suivant l'arc de la machine.",
    depart: { ancre: "pieds", cheville: [114, 176], cuisse: 10, tibia: 8, torse: 192, tete: -6, bras: 30, avbras: 160, pied: 92 }, arrivee: { cuisse: 104, tibia: -34, torse: 200 },
    objets: [], decor: [{ t: "bancr", x: 100, y: 180, l: 34, a: 0, h: 5 }, SOL], muscle: ["quadriceps"], fleche: { suit: "epaule", decale: [-20, 0] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "epaule" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Très grande amplitude pour les quadriceps sans charger le dos. C'est en bas, genoux très pliés, que l'effort est le plus grand." },
  },
  "Leg extension": {
    legende: "Leg extension vu de profil : assis, on tend les jambes, puis on redescend lentement.",
    depart: { hanche: [72, 120], torse: 176, cuisse: [88, 84], tibia: [2, -2], pied: 90, bras: 10, avbras: 30 }, arrivee: { tibia: [86, 82] },
    objets: [{ t: "boudin", cote: 1 }], decor: [{ t: "bancr", x: 54, y: 126, l: 60, a: 90, h: 8 }, { t: "banc", x: 52, y: 126, l: 62 }, { t: "pied", x: 80, y: 134, y2: 181 }, SOL],
    muscle: ["quadriceps"], fleche: { suit: "cheville", decale: [14, 0] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }], etire: 0,
    variantes: [
      { nom: "Machine", effort: [{ art: "genou", nom: "Genou · quadriceps", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }] },
      { nom: "Lest à la cheville", effort: [{ art: "genou", nom: "Genou · quadriceps", point: "cheville" }], charge: { t: "poids" } },
    ],
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Hanche ouverte, le droit fémoral travaille bien, contrairement au squat. Insister sur la partie genou plié, quadriceps étiré, le fait davantage grossir que la partie jambe presque tendue : ne coupe pas le bas du mouvement." },
  },
  "Squat bulgare": {
    legende: "Squat bulgare vu de profil : pied arrière sur un banc, on descend à la verticale jusqu'à ce que le genou arrière frôle le sol.",
    depart: { ancre: "pieds", cheville: [118, 178], torse: 178, cuisse: [6, 314], tibia: [0, 260], pied: [90, 250], bras: 4, avbras: 2 }, arrivee: { cuisse: [72, 304], tibia: [-28, 207] },
    objets: [{ t: "halteres" }], decor: [{ t: "banc", x: 14, y: 122, l: 40 }, { t: "pied", x: 34, y: 130, y2: 181 }, SOL], muscle: ["quadriceps", "fessiers"], fleche: { suit: "hanche", decale: [22, 0] },
    effort: [{ art: "genou", nom: "Genou avant · quadriceps", point: "hanche" }, { art: "hanche", nom: "Hanche · fessiers", point: "epaule" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Toute la charge passe par la jambe avant : quadriceps et fessiers travaillent dur, une jambe à la fois. Buste droit, plus de quadriceps ; buste penché, plus de fessiers." },
  },
  "Fentes": {
    legende: "Fente vue de profil : un grand pas en avant, on descend jusqu'à ce que le genou arrière frôle le sol.",
    depart: { ancre: "pieds", cheville: [126, 178], torse: 178, cuisse: [20, 340], tibia: [4, 340], pied: [90, 140], bras: 4, avbras: 2 }, arrivee: { cuisse: [80, 2], tibia: [-6, 280] },
    objets: [{ t: "halteres" }], decor: [SOL], muscle: ["quadriceps", "fessiers"], fleche: { suit: "hanche", decale: [-18, 0] },
    effort: [{ art: "genou", nom: "Genou avant · quadriceps", point: "hanche" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "La jambe avant fait l'essentiel. Un grand pas fait davantage travailler les fessiers, un pas court davantage les quadriceps." },
  },
  "Fentes marchées": {
    legende: "Fentes marchées vues de profil : on enchaîne les fentes en avançant, buste droit.",
    depart: { ancre: "pieds", cheville: [126, 178], torse: 178, cuisse: [20, 340], tibia: [4, 340], pied: [90, 140], bras: 4, avbras: 2 }, arrivee: { cuisse: [80, 2], tibia: [-6, 280] },
    objets: [{ t: "halteres" }], decor: [SOL], muscle: ["quadriceps", "fessiers"], fleche: { suit: "hanche", decale: [-18, 0] },
    effort: [{ art: "genou", nom: "Genou avant · quadriceps", point: "hanche" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Même travail que la fente, avec l'équilibre en plus. De grandes enjambées font davantage travailler les fessiers." },
  },
  "Step-up": {
    legende: "Step-up vu de profil : pied entier sur la caisse, on monte en poussant dans ce pied, sans s'aider de l'autre jambe.",
    depart: { ancre: "pieds", cheville: [112, 134], torse: 170, cuisse: [96, 340], tibia: [-24, 4], pied: [90, 90], bras: 4, avbras: 2 }, arrivee: { torse: 180, cuisse: [2, 30], tibia: [0, -40] },
    objets: [{ t: "halteres" }], decor: [{ t: "boite", x: 96, y: 137, l: 56, h: 44 }, SOL], muscle: ["quadriceps", "fessiers"], fleche: { suit: "hanche", decale: [-18, 0] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "hanche" }, { art: "hanche", nom: "Hanche · fessiers", point: "epaule" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "La jambe du haut fait tout le travail : quadriceps et fessiers. L'effort est le plus grand au départ, genou plié. Plus la caisse est haute, plus les fessiers travaillent." },
  },
  "Sissy squat": {
    legende: "Sissy squat vu de profil : sur la pointe des pieds, on avance les genoux et on penche le corps en arrière, d'un seul bloc des genoux aux épaules.",
    depart: { ancre: "orteils", orteil: [104, 180], torse: 180, cuisse: 0, tibia: 0, pied: 70, bras: 90, avbras: 90 }, arrivee: { torse: 206, cuisse: 26, tibia: -58, pied: 40 },
    objets: [], decor: [{ t: "pied", x: 170, y: 70, y2: 181 }, SOL], muscle: ["quadriceps"], fleche: { suit: "genou", decale: [16, 0] },
    effort: [{ art: "genou", nom: "Genou · quadriceps", point: "epaule" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_QUADS, faisceaux: "Hanche ouverte et genoux très pliés : le quadriceps, droit fémoral compris, travaille étiré. Exercice avancé, à éviter si le genou est douloureux." },
  },
});

/* ── ISCHIOS ── */
const POURQUOI_ISCHIOS = "Les ischios plient le genou et, pour la plupart, redressent aussi la hanche. Les exercices de hanche (soulevé de terre jambes tendues, good morning) les étirent depuis le bassin ; les leg curls les font travailler depuis le genou. Les deux se complètent.";
const LEG_CURL_VARIANTES = (effortLest) => [
  { nom: "Machine", effort: [{ art: "genou", nom: "Genou · ischios", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }] },
  { nom: "Lest à la cheville", effort: [{ art: "genou", nom: "Genou · ischios", point: "cheville" }], charge: { t: "poids" } },
];
const ALLONGE_VENTRE = { hanche: [92, 118], torse: 90, tete: -6, brasAbs: true, bras: 40, avbras: 90, pied: [180, 180] };
const BANC_VENTRE = [{ t: "banc", x: 28, y: 125, l: 136 }, { t: "pied", x: 50, y: 133, y2: 181 }, { t: "pied", x: 142, y: 133, y2: 181 }, SOL];
const HINGE = { ancre: "pieds", cheville: [96, 178], torse: 180, brasAbs: true, bras: 0, avbras: 0 };
Object.assign(SCHEMAS, {
  "RDL": {
    legende: "Soulevé de terre roumain vu de profil : genoux légèrement fléchis, on recule les fesses en faisant glisser la barre le long des jambes, dos plat.",
    depart: { ...HINGE, cuisse: 4, tibia: -4 }, arrivee: { torse: 100, cuisse: 24, tibia: -6 },
    objets: [{ t: "barre" }], decor: [SOL], muscle: ["ischios", "fessiers"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "hanche", nom: "Hanche · ischios et fessiers" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "C'est un mouvement de hanche : les ischios travaillent étirés depuis le bassin, avec les fessiers. La charge pèse le plus en bas, buste penché, barre loin des hanches." },
  },
  "RDL haltères": {
    legende: "Soulevé de terre roumain aux haltères vu de profil : fesses vers l'arrière, haltères le long des jambes, dos plat.",
    depart: { ...HINGE, cuisse: 4, tibia: -4 }, arrivee: { torse: 102, cuisse: 24, tibia: -6 },
    objets: [{ t: "halteres" }], decor: [SOL], muscle: ["ischios", "fessiers"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "hanche", nom: "Hanche · ischios et fessiers" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "Même travail qu'à la barre, plus facile à apprendre. La charge pèse le plus en bas, quand les ischios sont étirés." },
  },
  "Soulevé de terre jambes tendues": {
    legende: "Soulevé de terre jambes tendues vu de profil : jambes presque tendues, on descend le buste dos plat jusqu'à l'étirement.",
    depart: { ...HINGE, cuisse: 2, tibia: 0 }, arrivee: { torse: 94, cuisse: 12, tibia: -2 },
    objets: [{ t: "barre" }], decor: [SOL], muscle: ["ischios", "lombaires"], fleche: { suit: "main", decale: [24, 0] },
    effort: [{ art: "hanche", nom: "Hanche · ischios" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "Jambes tendues, les ischios s'étirent davantage qu'au roumain. N'ajoute de la charge que si le dos reste plat jusqu'en bas." },
  },
  "Good morning": {
    legende: "Good morning vu de profil : barre sur le haut du dos, genoux légèrement fléchis, on penche le buste en reculant les fesses.",
    depart: { ancre: "pieds", cheville: [96, 178], torse: 180, cuisse: 4, tibia: -4, bras: -16, avbras: 172 }, arrivee: { torse: 98, cuisse: 22, tibia: -6 },
    objets: [{ t: "barre", sur: "dos" }], decor: [SOL], muscle: ["ischios", "lombaires"], fleche: { suit: "dos", decale: [-20, -10] },
    effort: [{ art: "hanche", nom: "Hanche · ischios", point: "dos" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "La barre sur le dos, loin des hanches, fait un long levier : charge légère, et l'effort est le plus grand buste penché. Ischios et muscles du bas du dos travaillent ensemble." },
  },
  "Leg curl": {
    legende: "Leg curl allongé vu de profil : à plat ventre, on ramène les talons vers les fesses sans décoller les hanches.",
    depart: { ...ALLONGE_VENTRE, cuisse: [270, 272], tibia: [268, 270] }, arrivee: { tibia: [158, 162] },
    objets: [{ t: "boudin", cote: -1 }], decor: BANC_VENTRE, muscle: ["ischios"], fleche: { suit: "cheville", decale: [0, -16] },
    variantes: LEG_CURL_VARIANTES(), effort: [{ art: "genou", nom: "Genou · ischios", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }], etire: 0,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "Allongé, la hanche est tendue : les ischios travaillent plus raccourcis qu'assis. Le leg curl assis les fait davantage grossir ; garde l'allongé pour varier." },
  },
  "Leg curl allongé": {
    legende: "Leg curl allongé vu de profil : bassin collé au banc, on ramène les talons vers les fesses.",
    depart: { ...ALLONGE_VENTRE, cuisse: [270, 272], tibia: [268, 270] }, arrivee: { tibia: [158, 162] },
    objets: [{ t: "boudin", cote: -1 }], decor: BANC_VENTRE, muscle: ["ischios"], fleche: { suit: "cheville", decale: [0, -16] },
    variantes: LEG_CURL_VARIANTES(), effort: [{ art: "genou", nom: "Genou · ischios", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }], etire: 0,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "Allongé, la hanche est tendue : les ischios travaillent plus raccourcis qu'assis. Avec un lest à la cheville, l'effort est le plus grand jambe tendue et disparaît talons aux fesses." },
  },
  "Leg curl assis": {
    legende: "Leg curl assis vu de profil : cuisses bloquées, on ramène les talons sous le siège.",
    depart: { hanche: [70, 124], torse: 166, tete: 6, cuisse: [88, 86], tibia: [86, 84], pied: [10, 10], bras: 30, avbras: 60 }, arrivee: { tibia: [-26, -28] },
    objets: [{ t: "boudin", cote: -1 }], decor: [{ t: "banc", x: 40, y: 130, l: 70 }, { t: "pied", x: 70, y: 138, y2: 181 }, { t: "appui", x: 84, y: 108, l: 28, h: 7 }, SOL],
    muscle: ["ischios"], fleche: { suit: "cheville", decale: [16, 0] },
    variantes: LEG_CURL_VARIANTES(), effort: [{ art: "genou", nom: "Genou · ischios", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }], etire: 0,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "Assis, la hanche est pliée : les ischios sont étirés depuis le bassin. C'est la version qui les fait le plus grossir, nettement plus que le leg curl allongé. Penche un peu le buste en avant pour accentuer l'étirement." },
  },
  "Leg curl debout": {
    legende: "Leg curl debout vu de profil : une jambe à la fois, buste calé, on ramène le talon vers la fesse.",
    depart: { hanche: [96, 96], torse: 172, cuisse: [8, 2], tibia: [6, 0], pied: [90, 90], bras: 50, avbras: 80 }, arrivee: { tibia: [-138, 0] },
    objets: [{ t: "boudin", cote: -1 }], decor: [{ t: "appui", x: 108, y: 70, l: 10, h: 40 }, SOL], muscle: ["ischios"], fleche: { suit: "cheville", decale: [-16, 0] },
    variantes: LEG_CURL_VARIANTES(), effort: [{ art: "genou", nom: "Genou · ischios", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }], etire: 0,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "Une jambe à la fois : utile pour corriger un écart entre les deux côtés. Hanche tendue, les ischios travaillent comme au leg curl allongé." },
  },
  "Nordic curl": {
    legende: "Nordic curl vu de profil : à genoux, chevilles bloquées, on descend le corps vers l'avant le plus lentement possible, d'un seul bloc.",
    depart: { ancre: "genoux", genou: [108, 170], cuisse: [0, 0], tibia: [270, 270], pied: [180, 180], torse: 180, bras: 50, avbras: 80 }, arrivee: { cuisse: [-62, -62], torse: 118 },
    objets: [], decor: [{ t: "appui", x: 58, y: 162, l: 12, h: 9 }, SOL], muscle: ["ischios"], fleche: { suit: "epaule", decale: [0, -18] },
    effort: [{ art: "genou", nom: "Genou · ischios", point: "epaule" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_ISCHIOS, faisceaux: "La descente est l'exercice : plus le corps s'approche du sol, plus le levier est long. Le nordic fait surtout grossir les ischios qui ne passent que par le genou ; pour ceux qui redressent aussi la hanche, le leg curl assis fait mieux. Garde les deux." },
  },
});

/* ── FESSIERS ── */
const POURQUOI_FESSIERS = "Le grand fessier redresse la hanche et l'ouvre vers l'arrière ; le moyen fessier, sur le côté, écarte la jambe et stabilise le bassin à chaque pas.";
const ELASTIQUE = "Un élastique résiste de plus en plus à mesure qu'il s'étire : l'effort est le plus grand jambes écartées.";
Object.assign(SCHEMAS, {
  "Hip thrust": {
    legende: "Hip thrust vu de profil : haut du dos contre un banc, barre sur les hanches, on monte le bassin jusqu'à l'alignement.",
    depart: { ancre: "pieds", cheville: [132, 178], cuisse: [122, 118], tibia: [0, -4], pied: 90, torse: 250, brasAbs: true, bras: 92, avbras: 86 }, arrivee: { cuisse: [90, 86], torse: 268 },
    objets: [{ t: "barre", sur: "hanche", decale: [0, -12] }], decor: [{ t: "banc", x: 4, y: 146, l: 46 }, { t: "pied", x: 26, y: 154, y2: 181 }, SOL], muscle: ["fessiers"], fleche: { suit: "hanche", decale: [0, -26] },
    effort: [{ art: "hanche", nom: "Hanche · fessiers", point: "cheville" }], charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "Le hip thrust active fortement les fessiers. Sur plusieurs semaines, il les fait pourtant grossir autant qu'un squat, qui fait en plus travailler quadriceps et adducteurs : choisis selon ton programme et tes sensations." },
  },
  "Pont fessier": {
    legende: "Pont fessier vu de profil : allongé, genoux pliés, on monte les hanches en serrant les fesses.",
    depart: { ancre: "pieds", cheville: [120, 178], cuisse: [130, 126], tibia: [10, 6], pied: 90, torse: 270, brasAbs: true, bras: 90, avbras: 90 }, arrivee: { cuisse: [100, 96], torse: 297 },
    objets: [], decor: [SOL], muscle: ["fessiers"], fleche: { suit: "hanche", decale: [0, -22] },
    effort: [{ art: "hanche", nom: "Hanche · fessiers", point: "cheville" }], charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "Une version simple du hip thrust, sans matériel. Tiens 2 secondes en haut ; une charge sur les hanches ou une jambe à la fois la rendent plus difficile." },
  },
  "Soulevé de terre sumo": {
    vue: "face",
    legende: "Soulevé de terre sumo vu de face : pieds très écartés, genoux vers l'extérieur, mains entre les jambes, on se relève en poussant dans le sol.",
    depart: { ancre: "pieds", cheville: [150, 176], cuisse: [50, 50], tibia: [16, 16], torse: 180, bras: -6, avbras: 0 }, arrivee: { cuisse: [18, 18], tibia: [12, 12] },
    objets: [{ t: "barreface", ext: 40 }], decor: [SOL], muscle: ["fessiers", "adducteurs", "quadriceps"], fleche: { suit: "main", decale: [16, 0] },
    effort: [{ art: "hanche", nom: "Hanche · fessiers et adducteurs", plan: { depart: { ancre: "pieds", cheville: [92, 178], torse: 146, cuisse: 46, tibia: -12, brasAbs: true, bras: 0, avbras: 0 }, arrivee: { torse: 180, cuisse: 0, tibia: 0 } } }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "Pieds écartés, le buste reste plus droit qu'au soulevé classique : les fessiers, les adducteurs et les quadriceps font davantage le travail, le bas du dos un peu moins." },
  },
  "Fentes arrière": {
    legende: "Fente arrière vue de profil : on recule une jambe et on descend jusqu'à ce que le genou arrière frôle le sol.",
    depart: { ancre: "pieds", cheville: [126, 178], torse: 178, cuisse: [20, 340], tibia: [4, 340], pied: [90, 140], bras: 4, avbras: 2 }, arrivee: { torse: 168, cuisse: [80, 2], tibia: [-6, 280] },
    objets: [{ t: "halteres" }], decor: [SOL], muscle: ["fessiers", "quadriceps"], fleche: { suit: "hanche", decale: [-18, 0] },
    effort: [{ art: "genou", nom: "Genou avant · quadriceps", point: "hanche" }, { art: "hanche", nom: "Hanche · fessiers", point: "epaule" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "En reculant, le poids reste sur le talon avant et le buste se penche un peu : les fessiers travaillent davantage, et le genou est moins sollicité qu'en fente avant." },
  },
  "Kickback poulie": {
    legende: "Kickback à la poulie vu de profil : sangle à la cheville, buste penché, on pousse la jambe vers l'arrière et vers le haut.",
    depart: { hanche: [92, 98], torse: 156, tete: -10, cuisse: [16, 4], tibia: [8, 0], pied: [90, 90], bras: 66, avbras: 80 }, arrivee: { cuisse: [-62, 4], tibia: [-52, 0] },
    objets: [{ t: "cable", de: [156, 174], vers: "cheville" }], decor: [{ t: "poulieb", x: 156, y: 174 }, { t: "appui", x: 132, y: 70, l: 10, h: 40 }, SOL], muscle: ["fessiers"], fleche: { suit: "cheville", decale: [-16, 0] },
    effort: [{ art: "hanche", nom: "Hanche · fessiers", point: "cheville" }], charge: { t: "cable", de: [156, 174] }, etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "La poulie, devant toi, garde la tension dès le départ, jambe sous la hanche, quand le fessier est étiré. Une petite amplitude bien contractée vaut mieux qu'un grand balancier qui cambre le dos." },
  },
  "Abduction hanche": {
    vue: "face",
    legende: "Abduction à la machine vue de face : assis, genoux contre les appuis, on écarte les jambes.",
    depart: { hanche: [100, 124], lc: .38, cuisse: [14, 14], tibia: [0, 0], bras: 12, avbras: 4 }, arrivee: { cuisse: [62, 62] },
    objets: [], decor: [{ t: "banc", x: 72, y: 128, l: 56 }, SOL], muscle: ["fessiers"], fleche: { suit: "genou", decale: [12, -10] },
    effort: [{ art: "hanche", nom: "Hanche · moyen fessier", profil: [1, 1, 1, 1, 1], note: MACHINE_RONDE }], etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "Surtout le moyen fessier, sur le côté de la hanche. Buste penché en avant, le grand fessier participe davantage." },
  },
  "Abduction élastique": {
    vue: "face",
    legende: "Abduction à l'élastique vue de face : élastique au-dessus des genoux, en demi-squat, on écarte les genoux.",
    depart: { hanche: [100, 108], cuisse: [8, 8], tibia: [-2, -2], bras: 20, avbras: 60 }, arrivee: { cuisse: [24, 24], tibia: [-16, -16] },
    objets: [{ t: "elastique" }], decor: [SOL], muscle: ["fessiers"], fleche: { suit: "genou", decale: [12, 0] },
    effort: [{ art: "hanche", nom: "Hanche · moyen fessier", profil: [.4, .55, .7, .85, 1], note: ELASTIQUE }], etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "Surtout le moyen fessier. Charge légère : c'est un bon échauffement des fessiers avant le bas du corps." },
  },
  "Abduction poulie": {
    vue: "face",
    legende: "Abduction à la poulie vue de face : sangle à la cheville, on écarte la jambe sur le côté, buste droit.",
    depart: { hanche: [100, 100], cuisse: [4, 4], tibia: [2, 2], bras: 30, avbras: 20 }, arrivee: { cuisse: [40, 4], tibia: [40, 2] },
    objets: [{ t: "cable", de: [34, 176], vers: "cheville" }], decor: [{ t: "poulieb", x: 34, y: 176 }, SOL], muscle: ["fessiers"], fleche: { suit: "cheville", decale: [14, 0] },
    effort: [{ art: "hanche", nom: "Hanche · moyen fessier", point: "cheville" }], charge: { t: "cable", de: [34, 176] }, etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "Surtout le moyen fessier. Le câble qui passe devant la jambe d'appui garde la tension dès le départ. Garde le buste droit : se pencher fait monter la jambe sans travailler davantage." },
  },
  "Clamshell": {
    vue: "face",
    legende: "Clamshell vu de face : couché sur le côté, élastique au-dessus des genoux, on ouvre le genou du dessus.",
    depart: { hanche: [116, 150], torse: 270, tete: 0, cuisse: [6, 6], tibia: [4, 4], bras: [160, 20], avbras: [170, 100] }, arrivee: { cuisse: [44, 6], tibia: [30, 4] },
    objets: [{ t: "elastique" }], decor: [SOL], muscle: ["fessiers"], fleche: { suit: "genou", decale: [0, -14] },
    effort: [{ art: "hanche", nom: "Hanche · moyen fessier", profil: [.4, .55, .7, .85, 1], note: ELASTIQUE }], etire: 0,
    analyse: { pourquoi: POURQUOI_FESSIERS, faisceaux: "Un exercice doux pour le moyen fessier, utile en échauffement ou si la hanche est sensible. Garde le bassin immobile : s'il bascule en arrière, ce sont d'autres muscles qui ouvrent la jambe." },
  },
});

/* ── MOLLETS ── */
const POURQUOI_MOLLETS = "Le mollet monte le talon. Le gros muscle visible (gastrocnémien) passe aussi par le genou : il travaille bien jambe tendue, presque plus genou plié. Le soléaire, dessous, travaille dans les deux cas.";
const MARCHE = [{ t: "boite", x: 96, y: 171, l: 60, h: 10 }, SOL];
const EFFORT_MOLLET = [{ art: "cheville", nom: "Cheville · mollet", point: "orteil" }];
Object.assign(SCHEMAS, {
  "Mollets debout": {
    legende: "Mollets debout vus de profil : avant du pied sur une marche, on descend le talon au maximum puis on monte le plus haut possible.",
    depart: { ancre: "orteils", orteil: [108, 170], torse: 180, cuisse: 0, tibia: 0, pied: 122, bras: 6, avbras: 2 }, arrivee: { pied: 52 },
    objets: [{ t: "halteres" }], decor: MARCHE, muscle: ["mollet"], fleche: { suit: "cheville", decale: [-16, 0] },
    effort: EFFORT_MOLLET, charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_MOLLETS, faisceaux: "Jambes tendues, le gastrocnémien est étiré : c'est la version qui fait le plus grossir le mollet. Marque une pause talon en bas pour supprimer l'effet ressort du tendon." },
  },
  "Mollets assis": {
    legende: "Mollets assis vus de profil : genoux sous les appuis, on descend les talons puis on monte.",
    depart: { ancre: "orteils", orteil: [126, 170], torse: 180, cuisse: [90, 86], tibia: [0, 0], pied: 122, bras: 20, avbras: 60 }, arrivee: { pied: 52 },
    objets: [{ t: "boudin", sur: "genou" }], decor: [{ t: "banc", x: 52, y: 128, l: 46 }, { t: "pied", x: 74, y: 136, y2: 181 }, ...MARCHE], muscle: ["mollet"], fleche: { suit: "cheville", decale: [-16, 0] },
    effort: EFFORT_MOLLET, charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_MOLLETS, faisceaux: "Genoux pliés, le gastrocnémien est relâché et grossit à peine ; le soléaire, lui, grossit autant qu'au mollet debout. Garde le mollet debout comme exercice principal." },
  },
  "Mollets presse": {
    legende: "Mollets à la presse vus de profil : jambes tendues, avant du pied sur le bas de la plateforme, on pousse avec la pointe des pieds.",
    depart: { ...PRESSE, cuisse: [134, 130], tibia: [134, 130], pied: [256, 252] }, arrivee: { pied: [184, 180] },
    objets: [], decor: DECOR_PRESSE, muscle: ["mollet"], fleche: { suit: "orteil", decale: [12, 12] },
    effort: [{ art: "cheville", nom: "Cheville · mollet", point: "orteil" }], charge: RAIL_PRESSE, etire: 0,
    analyse: { pourquoi: POURQUOI_MOLLETS, faisceaux: "Jambes tendues comme au mollet debout, sans charge sur les épaules ni sur le dos. Garde les genoux tendus mais pas verrouillés." },
  },
  "Mollets unilatéral haltère": {
    legende: "Mollet à une jambe vu de profil : un pied sur la marche, haltère du même côté, on monte le plus haut possible.",
    depart: { ancre: "orteils", orteil: [108, 170], torse: 180, cuisse: [0, 16], tibia: [0, -60], pied: [122, 70], bras: [6, 30], avbras: [2, 70] }, arrivee: { pied: [52, 70] },
    objets: [{ t: "haltere" }], decor: MARCHE, muscle: ["mollet"], fleche: { suit: "cheville", decale: [-16, 0] },
    effort: EFFORT_MOLLET, charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_MOLLETS, faisceaux: "Une jambe à la fois : tout le poids du corps passe par un seul mollet, sans machine. Utile pour corriger un mollet plus faible." },
  },
  "Mollets donkey": {
    legende: "Mollets donkey vus de profil : buste penché à angle droit, jambes tendues, on monte sur la pointe des pieds.",
    depart: { ancre: "orteils", orteil: [80, 170], torse: 94, tete: -20, cuisse: 0, tibia: 0, pied: 122, bras: 92, avbras: 92 }, arrivee: { pied: 52 },
    objets: [], decor: [{ t: "appui", x: 128, y: 92, l: 14, h: 89 }, { t: "boite", x: 68, y: 171, l: 60, h: 10 }, SOL], muscle: ["mollet"], fleche: { suit: "cheville", decale: [-16, 0] },
    effort: EFFORT_MOLLET, charge: { t: "haut" }, etire: 0,
    analyse: { pourquoi: POURQUOI_MOLLETS, faisceaux: "Jambes tendues comme au mollet debout, mais sans charge sur le dos. Le gastrocnémien travaille bien, comme dans toutes les versions jambes tendues." },
  },
});

/* ── ABDOS ── */
const POURQUOI_ABDOS = "Le grand droit enroule le buste vers le bassin, ou le bassin vers le buste ; les obliques font tourner et pencher le tronc. Tous ensemble, ils gainent : ils empêchent le dos de se creuser ou de tourner.";
const AU_SOL = { hanche: [112, 168], torse: 270, brasAbs: true };
Object.assign(SCHEMAS, {
  "Gainage": {
    statique: true,
    legende: "Gainage vu de profil : sur les avant-bras et la pointe des pieds, le corps reste droit de la tête aux talons.",
    depart: { hanche: [92, 154], torse: 98, tete: -6, cuisse: [280, 280], tibia: [280, 280], pied: [10, 10], brasAbs: true, bras: 0, avbras: 90 },
    objets: [], decor: [SOL], muscle: ["abdos"], fleche: {},
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Les abdos travaillent sans bouger : ils empêchent le bassin de tomber. Mieux vaut 30 secondes parfaites qu'une minute avec le dos creusé. Pour progresser, allonge la durée ou écarte les coudes vers l'avant." },
  },
  "Gainage latéral": {
    vue: "face", statique: true,
    legende: "Gainage latéral vu de face : sur un avant-bras, pieds empilés, le bassin reste haut et aligné.",
    depart: { hanche: [108, 146], torse: 258, tete: 0, cuisse: [4, 4], tibia: [2, 2], bras: [20, 92], avbras: [150, 178] },
    objets: [], decor: [SOL], muscle: ["abdos"], fleche: {},
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Surtout les obliques et le carré des lombes, avec le moyen fessier : ils empêchent le bassin de tomber vers le sol. Commence genoux pliés si c'est trop dur." },
  },
  "Crunch": {
    legende: "Crunch vu de profil : allongé, genoux pliés, on enroule le haut du dos en rapprochant les côtes du bassin.",
    depart: { ...AU_SOL, cuisse: [130, 126], tibia: [8, 4], pied: 90, tete: 0, bras: [200, 200], avbras: [300, 300] }, arrivee: { torse: 244, tete: -16 },
    objets: [], decor: [SOL], muscle: ["abdos"], fleche: { suit: "epaule", decale: [0, -16] },
    effort: [{ art: "hanche", nom: "Tronc · grand droit", point: "epaule" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Surtout le grand droit. L'effort reste à peu près le même sur ce petit enroulement : inutile de monter jusqu'en position assise, ce sont alors les muscles de la hanche qui prennent le relais." },
  },
  "Crunch poulie": {
    legende: "Crunch à la poulie vu de profil : à genoux, corde de chaque côté de la tête, on enroule le buste vers le sol.",
    depart: { ancre: "genoux", genou: [104, 172], cuisse: [4, 4], tibia: [270, 270], pied: [180, 180], torse: 166, tete: 10, bras: 170, avbras: 40 }, arrivee: { cuisse: [-14, -14], torse: 98, tete: 30 },
    objets: [{ t: "cable", de: [170, 10] }], decor: [{ t: "poulie", x: 170, y: 10 }, SOL], muscle: ["abdos"], fleche: { suit: "main", decale: [16, 0] },
    effort: [{ art: "hanche", nom: "Tronc · grand droit", point: "main" }], charge: { t: "cable", de: [170, 10] }, etire: 0,
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "La poulie permet de charger les abdos comme n'importe quel muscle, et de progresser en charge. Les hanches restent fixes : seul le dos s'enroule." },
  },
  "Crunch inversé": {
    legende: "Crunch inversé vu de profil : allongé, jambes pliées en l'air, on enroule le bassin pour ramener les genoux vers la poitrine.",
    depart: { ...AU_SOL, cuisse: [146, 142], tibia: [62, 58], pied: 150, bras: [90, 90], avbras: [90, 90] }, arrivee: { cuisse: [200, 196], tibia: [110, 106] },
    objets: [], decor: [SOL], muscle: ["abdos"], fleche: { suit: "genou", decale: [0, -16] },
    effort: [{ art: "hanche", nom: "Bassin · grand droit", point: "genou" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Le bas du grand droit enroule le bassin. Le plus dur est le début, jambes encore loin ; une fois les genoux au-dessus des hanches, leur poids n'aide plus à travailler." },
  },
  "Relevé de jambes": {
    legende: "Relevé de jambes vu de profil : allongé, jambes tendues, on les monte à la verticale sans cambrer le bas du dos.",
    depart: { ...AU_SOL, cuisse: [86, 84], tibia: [86, 84], pied: 170, bras: [90, 90], avbras: [90, 90] }, arrivee: { cuisse: [180, 176], tibia: [180, 176] },
    objets: [], decor: [SOL], muscle: ["abdos"], fleche: { suit: "cheville", decale: [0, -16] },
    effort: [{ art: "hanche", nom: "Hanche · abdos et psoas", point: "cheville" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Ce sont les muscles de la hanche qui montent les jambes ; les abdos, eux, empêchent le bas du dos de se creuser. Le plus dur est jambes près du sol : arrête-toi avant si le dos décolle." },
  },
  "Relevé de jambes suspendu": {
    legende: "Relevé de jambes suspendu vu de profil : suspendu à la barre, on monte les jambes devant soi sans se balancer.",
    depart: { ancre: "mains", main: [100, 34], torse: 180, cuisse: [2, 0], tibia: [2, 0], pied: 90, brasAbs: true, bras: 180, avbras: 180 }, arrivee: { torse: 186, cuisse: [96, 92], tibia: [96, 92] },
    objets: [], decor: BARRE_FIXE, muscle: ["abdos"], fleche: { suit: "cheville", decale: [14, 0] },
    effort: [{ art: "hanche", nom: "Hanche · abdos et psoas", point: "cheville" }], charge: { t: "poids" }, etire: 0,
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Plus les jambes montent, plus leur poids s'éloigne de la hanche : le plus dur est à l'horizontale. Pour faire vraiment travailler les abdos, enroule le bassin en fin de mouvement. Commence genoux pliés." },
  },
  "Roue abdominale": {
    legende: "Roue abdominale vue de profil : à genoux, on roule vers l'avant dos plat, puis on revient en contractant les abdos.",
    depart: { ancre: "genoux", genou: [60, 172], cuisse: [8, 8], tibia: [270, 270], pied: [180, 180], torse: 108, tete: 6, brasAbs: true, bras: 0, avbras: 0 }, arrivee: { cuisse: [-55, -55], torse: 98, bras: 59, avbras: 59 },
    objets: [{ t: "roue" }], decor: [SOL], muscle: ["abdos"], fleche: { suit: "main", decale: [0, -18] },
    effort: [{ art: "genou", nom: "Tronc · abdos", point: "epaule" }], charge: { t: "poids" }, etire: 1,
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Plus on roule loin, plus le corps fait levier : le plus dur est bras tendus, abdos étirés. Ne va pas plus loin que ce que tu contrôles sans creuser le dos." },
  },
  "Pallof press": {
    vue: "bout",
    legende: "Pallof press vu du dessus : de côté par rapport à la poulie, on pousse la poignée devant soi sans laisser le buste tourner.",
    depart: { ...BOUT, bras: [24, 24], avbras: [204, 204] }, arrivee: { bras: [186, 174], avbras: [186, 174] },
    objets: [{ t: "cable", de: [196, 60] }], decor: [{ t: "poulie", x: 196, y: 60 }], muscle: ["torse"], fleche: { suit: "main", decale: [12, 0] },
    texteEffort: "La poulie tire sur le côté : plus les bras s'éloignent du buste, plus elle cherche à te faire tourner. L'effort des abdos est le plus grand bras tendus ; tiens 2 secondes.",
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Un exercice d'anti-rotation : les obliques et le grand droit travaillent pour que rien ne bouge. Utile pour un tronc solide sous les charges lourdes." },
  },
  "Russian twist": {
    vue: "face",
    legende: "Russian twist vu de face : assis, buste incliné en arrière, on tourne la charge d'un côté puis de l'autre.",
    depart: { hanche: [100, 132], lc: .38, cuisse: [20, 20], tibia: [10, 10], bras: [52, -40], avbras: [40, -60] }, arrivee: { bras: [-40, 52], avbras: [-60, 40] },
    objets: [{ t: "disque", r: 10 }], decor: [SOL], muscle: ["abdos"], fleche: { suit: "main", decale: [0, -16] },
    texteEffort: "La charge tenue à bout de bras pèse le plus sur les côtés : c'est là que les obliques travaillent le plus. Au centre, l'effort est presque nul.",
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Surtout les obliques. Tourne les épaules, pas seulement les bras, et garde le dos droit : un dos arrondi reporte l'effort sur la colonne." },
  },
  "Dead bug": {
    legende: "Dead bug vu de profil : allongé, bras vers le plafond et jambes pliées en l'air, on tend un bras et la jambe opposée sans décoller le bas du dos.",
    depart: { ...AU_SOL, cuisse: [180, 180], tibia: [90, 90], pied: 180, bras: [180, 180], avbras: [180, 180] }, arrivee: { cuisse: [180, 96], tibia: [90, 96], bras: [262, 180], avbras: [262, 180] },
    objets: [], decor: [SOL], muscle: ["abdos"], fleche: { suit: "main", decale: [0, -14] },
    texteEffort: "L'effort est le plus grand bras et jambe tendus : plus ils s'éloignent du tronc, plus les abdos doivent empêcher le bas du dos de se creuser.",
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Le grand droit et les muscles profonds du ventre plaquent le bas du dos au sol pendant que les membres bougent. Lent et contrôlé : la vitesse n'apporte rien ici." },
  },
  "Mountain climbers": {
    legende: "Mountain climbers vus de profil : en position de pompe, on ramène les genoux vers la poitrine en alternant vite.",
    depart: { ancre: "mains", main: [142, 177], torse: 104, brasAbs: true, bras: 0, avbras: 0, cuisse: [284, 284], tibia: [284, 284], pied: [10, 10] }, arrivee: { cuisse: [392, 284], tibia: [336, 284] },
    objets: [], decor: [SOL], muscle: ["abdos"], fleche: { suit: "genou", decale: [0, 14] },
    texteEffort: "Du gainage en mouvement : les abdos tiennent le bassin pendant que les jambes alternent. L'effort reste à peu près le même ; il s'accumule avec la vitesse et la durée.",
    analyse: { pourquoi: POURQUOI_ABDOS, faisceaux: "Les abdos stabilisent, les épaules portent le haut du corps, et le cœur monte vite : c'est autant du cardio que du gainage. Garde les hanches basses." },
  },
});
