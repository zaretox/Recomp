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
