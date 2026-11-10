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
      faisceaux: "Surtout le faisceau moyen. À l'haltère, la charge pèse le plus en haut ; à la poulie réglée à hauteur de la main, elle pèse davantage bras le long du corps, quand le muscle est étiré. Malgré cette différence, les deux font grossir l'épaule autant : choisis celle que tu sens le mieux.",
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
    analyse: { pourquoi: "Le pull-over fait travailler le grand pectoral et le grand dorsal ensemble : les deux ramènent le bras depuis derrière la tête.", faisceaux: "La charge pèse le plus bras derrière la tête, quand pecs et grand dorsal sont étirés, et presque plus au-dessus de la poitrine. Descends seulement tant que l'épaule est à l'aise." },
  },
});
