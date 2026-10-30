"use strict";
/* Programmes de base et bibliothèque d'exercices. Données pures, aucune logique. */

/* PPL en 5 séances. « charges » = charge de départ par phase, utilisée seulement sans historique. */
const PPL_SEANCES = [
  {"id":"Push","jour":"Lun","focus":"Pecs · Épaules · Triceps","finisher":"Traîneau (poussée) 6×20 m · repos 60 s", "exercices": [
    {"nom":"DC haltères","detail":"4×8-10","charges":["20kg","26kg","32kg","36kg"],"note":"Par haltère. Ancien niveau retrouvé vers oct."},
    {"nom":"DI haltères","detail":"4×10-12","charges":["16kg","22kg","26kg","30kg"],"note":""},
    {"nom":"Poulie basse (pecs)","detail":"4×12-15","charges":["14kg","18kg","21kg","24kg"],"note":"Pic de contraction 2 s en haut"},
    {"nom":"Élévations lat.","detail":"4×12-15","charges":["5kg","6kg","8kg","10kg"],"note":"Deltoïde latéral (largeur)"},
    {"nom":"Triceps poulie","detail":"3×12-15","charges":["16kg","20kg","24kg","28kg"],"note":""}
  ] },
  {"id":"Pull","jour":"Mar","focus":"Dos · Trapèzes · Biceps · Arrière d'épaule","finisher":"", "exercices": [
    {"nom":"Tirage vertical","detail":"4×8-10","charges":["40kg","52kg","62kg","72kg"],"note":"Remplace les tractions tant que le poids de corps est élevé"},
    {"nom":"Tirage bûcheron","detail":"4×8-10/bras","charges":["22kg","30kg","35kg","40kg"],"note":"Buste calé, unilatéral"},
    {"nom":"Rack pull","detail":"4×6-8","charges":["90kg","115kg","140kg","160kg"],"note":"Prise + lombaires : progressif. Sangles dès S5. Objectif 200kg vers nov."},
    {"nom":"Écarté inversé poulie","detail":"3×15-20","charges":["7kg","10kg","12kg","14kg"],"note":"Arrière d'épaule (allongé au banc)"},
    {"nom":"Tirage araignée","detail":"2×15","charges":["6kg","7kg","8kg","10kg"],"note":"À plat ventre, épaules relâchées"},
    {"nom":"Curl biceps","detail":"3×10-12","charges":["7kg","9kg","11kg","13kg"],"note":""}
  ] },
  {"id":"Legs","jour":"Mer","focus":"Quadri · Ischios · Mollets","finisher":"", "exercices": [
    {"nom":"Presse à cuisses","detail":"4×10-12","charges":["145kg","185kg","225kg","255kg"],"note":"Pied droit · amplitude contrôlée"},
    {"nom":"Hack squat","detail":"4×8-10","charges":["65kg","80kg","100kg","112kg"],"note":"Genou : descente maîtrisée"},
    {"nom":"RDL","detail":"4×8-10","charges":["65kg","80kg","100kg","112kg"],"note":"Tension ischios, dos neutre"},
    {"nom":"Leg curl","detail":"3×12-15","charges":["27kg","35kg","42kg","48kg"],"note":""},
    {"nom":"Mollets debout","detail":"6×15-20","charges":["50kg","65kg","75kg","88kg"],"note":"Pied droit"}
  ] },
  {"id":"Upper","jour":"Ven","focus":"Haut du corps · Lourd (5-8)","finisher":"Farmer's walk 4×40 m + battle ropes 6×30 s (ou traîneau)", "exercices": [
    {"nom":"DC haltères neutre","detail":"4×6-8","charges":["20kg","26kg","32kg","37kg"],"note":"Par haltère · prise neutre (épaule)"},
    {"nom":"Tirage bûcheron","detail":"4×8-10","charges":["23kg","30kg","36kg","42kg"],"note":"Version lourde"},
    {"nom":"DM haltères","detail":"4×6-8","charges":["12kg","15kg","18kg","21kg"],"note":"Développé épaules"},
    {"nom":"Élévations lat.","detail":"3×15-20","charges":["5kg","6kg","8kg","10kg"],"note":""},
    {"nom":"Curl marteau","detail":"3×8-10","charges":["7kg","9kg","11kg","13kg"],"note":""},
    {"nom":"Ext. triceps","detail":"3×8-10","charges":["12kg","16kg","19kg","22kg"],"note":""}
  ] },
  {"id":"Lower","jour":"Sam","focus":"Fessiers · Quadri · Ischios · Lourd","finisher":"Traîneau arrière 5×20 m · léger (protège le genou)", "exercices": [
    {"nom":"Hip thrust","detail":"4×8-10","charges":["90kg","115kg","140kg","160kg"],"note":"Descente contrôlée"},
    {"nom":"Presse lourde","detail":"4×8-10","charges":["155kg","195kg","240kg","270kg"],"note":"Pied droit"},
    {"nom":"Leg extension","detail":"4×10-12","charges":["36kg","46kg","56kg","64kg"],"note":"Genou : sans à-coups, pas de blocage sec"},
    {"nom":"Leg curl assis","detail":"3×10-12","charges":["27kg","35kg","42kg","48kg"],"note":""},
    {"nom":"Abduction hanche","detail":"2×15-20","charges":["32kg","40kg","48kg","56kg"],"note":"Fessiers"},
    {"nom":"Mollets assis","detail":"6×12-15","charges":["27kg","35kg","42kg","48kg"],"note":""}
  ] }
];

/* Circuits maison : « exo — cible » */
const MAISON = [
  {"code":"A","jour":"Lundi","titre":"Bas du corps + cardio","format":"3 circuits · repos 60-90 s entre tours","ex":["Squat sur chaise — 12","Pont fessier — 15 (2s tenue)","Step-up lent — 8/jambe","Marche rapide — 60s","Wall sit — 20-30s","Shadow boxing — 60s"]},
  {"code":"B","jour":"Mercredi","titre":"Haut du corps + gainage","format":"3 circuits · repos 60-90 s entre tours","ex":["Pompes inclinées — 8-12","Rowing serviette — 12","Pompes diamant — 6-8","Planche genoux — 20-30s","Dead bug — 8/côté","Bird dog — 8/côté"]},
  {"code":"C","jour":"Vendredi","titre":"Cardio full body","format":"4 circuits · 45 s effort / 30 s repos par exercice","ex":["Marche genoux hauts — continu · RPE 5-7","Pompes inclinées — 12-20 · RPE 8","Squat chaise — 15-25 · RPE 7-8","Shadow boxing — continu · RPE 6-7","Gainage genoux — tenir 45s (iso)","Step-touch — continu · RPE 5-6"],"note":"FC: parler oui, chanter non. Circuit chronométré : vise le tempo/RPE, pas un chiffre exact de reps."},
  {"code":"D","jour":"Samedi","titre":"Full body force","format":"4 circuits · repos 75 s entre tours","ex":["Squat bulgare — 6/j","Pompes — 10-12","Hip thrust — 12","Planche — 30-40s","Superman — 10","Dips chaise — 8-10"]}
];

const PROGRAMMES = {
  maison: { label: "Maison", days: { 1: "A", 3: "B", 5: "C", 6: "D" } },
  salle: { label: "Salle", days: { 1: "Push", 2: "Pull", 3: "Legs", 5: "Upper", 6: "Lower" } },
};

const PHASES = [
  {"ph":"Phase 1","sem":"S1-4","pct":"~45%","but":"Réapprentissage moteur · tendons"},
  {"ph":"Phase 2","sem":"S5-8","pct":"~58%","but":"Montée progressive"},
  {"ph":"Phase 3","sem":"S9-12","pct":"~70%","but":"Charge de travail"},
  {"ph":"Phase 4","sem":"S13-16+","pct":"~80%","but":"Objectif de reprise atteint"}
];

/* Temps de repos du PPL, par "Séance:Exercice" */
const REPOS = {
  "Push:DC haltères": "2 min",
  "Push:DI haltères": "90 s",
  "Push:Poulie basse (pecs)": "60 s",
  "Push:Élévations lat.": "60 s",
  "Push:Triceps poulie": "60 s",
  "Pull:Tirage vertical": "2 min",
  "Pull:Tirage bûcheron": "90 s",
  "Pull:Rack pull": "3 min",
  "Pull:Écarté inversé poulie": "60 s",
  "Pull:Tirage araignée": "60 s",
  "Pull:Curl biceps": "75 s",
  "Legs:Presse à cuisses": "2 min",
  "Legs:Hack squat": "2-3 min",
  "Legs:RDL": "2 min",
  "Legs:Leg curl": "75 s",
  "Legs:Mollets debout": "45-60 s",
  "Upper:DC haltères neutre": "2-3 min",
  "Upper:Tirage bûcheron": "2 min",
  "Upper:DM haltères": "2-3 min",
  "Upper:Élévations lat.": "60 s",
  "Upper:Curl marteau": "75 s",
  "Upper:Ext. triceps": "75 s",
  "Lower:Hip thrust": "2-3 min",
  "Lower:Presse lourde": "3 min",
  "Lower:Leg extension": "90 s",
  "Lower:Leg curl assis": "75 s",
  "Lower:Abduction hanche": "45 s",
  "Lower:Mollets assis": "45-60 s"
};

const MUSCLES = ["Pecs","Dos","Épaules","Biceps","Triceps","Quadriceps","Ischios","Fessiers","Mollets","Abdos"];

/* Séries par semaine : minimum efficace (mev) et maximum utile (mav) */
const REPERES_MUSCLE = {
  "Pecs": {"mev":10,"mav":22},
  "Dos": {"mev":10,"mav":22},
  "Épaules": {"mev":8,"mav":22},
  "Biceps": {"mev":6,"mav":16},
  "Triceps": {"mev":6,"mav":16},
  "Quadriceps": {"mev":8,"mav":20},
  "Ischios": {"mev":8,"mav":18},
  "Fessiers": {"mev":6,"mav":18},
  "Mollets": {"mev":8,"mav":16},
  "Abdos": {"mev":4,"mav":16}
};

const MUSCLE_DE = {
  "DC haltères": "Pecs",
  "DC haltères neutre": "Pecs",
  "DI haltères": "Pecs",
  "Poulie basse (pecs)": "Pecs",
  "Tirage vertical": "Dos",
  "Tirage bûcheron": "Dos",
  "Rack pull": "Dos",
  "Élévations lat.": "Épaules",
  "Écarté inversé poulie": "Épaules",
  "Tirage araignée": "Épaules",
  "DM haltères": "Épaules",
  "Triceps poulie": "Triceps",
  "Ext. triceps": "Triceps",
  "Curl biceps": "Biceps",
  "Curl marteau": "Biceps",
  "Presse à cuisses": "Quadriceps",
  "Hack squat": "Quadriceps",
  "Presse lourde": "Quadriceps",
  "Leg extension": "Quadriceps",
  "RDL": "Ischios",
  "Leg curl": "Ischios",
  "Leg curl assis": "Ischios",
  "Hip thrust": "Fessiers",
  "Abduction hanche": "Fessiers",
  "Mollets debout": "Mollets",
  "Mollets assis": "Mollets"
};

/* Bibliothèque : [nom, muscle] */
const EXO_LIB = [
  ["DC haltères","Pecs"],
  ["DC haltères neutre","Pecs"],
  ["DI haltères","Pecs"],
  ["Poulie basse (pecs)","Pecs"],
  ["Tirage vertical","Dos"],
  ["Tirage bûcheron","Dos"],
  ["Rack pull","Dos"],
  ["Élévations lat.","Épaules"],
  ["Écarté inversé poulie","Épaules"],
  ["Tirage araignée","Épaules"],
  ["DM haltères","Épaules"],
  ["Triceps poulie","Triceps"],
  ["Ext. triceps","Triceps"],
  ["Curl biceps","Biceps"],
  ["Curl marteau","Biceps"],
  ["Presse à cuisses","Quadriceps"],
  ["Hack squat","Quadriceps"],
  ["Presse lourde","Quadriceps"],
  ["Leg extension","Quadriceps"],
  ["RDL","Ischios"],
  ["Leg curl","Ischios"],
  ["Leg curl assis","Ischios"],
  ["Hip thrust","Fessiers"],
  ["Abduction hanche","Fessiers"],
  ["Mollets debout","Mollets"],
  ["Mollets assis","Mollets"],
  ["Développé couché","Pecs"],
  ["Développé incliné barre","Pecs"],
  ["Développé décliné","Pecs"],
  ["Pompes","Pecs"],
  ["Écarté haltères","Pecs"],
  ["Écarté poulie vis-à-vis","Pecs"],
  ["Pec deck","Pecs"],
  ["Tractions","Dos"],
  ["Tractions assistées","Dos"],
  ["Rowing barre","Dos"],
  ["Rowing haltère","Dos"],
  ["Tirage horizontal poulie","Dos"],
  ["Soulevé de terre","Dos"],
  ["Pull-over poulie","Dos"],
  ["Shrug haltères","Dos"],
  ["Développé militaire barre","Épaules"],
  ["Élévations frontales","Épaules"],
  ["Face pull","Épaules"],
  ["Oiseau haltères","Épaules"],
  ["Développé Arnold","Épaules"],
  ["Curl barre","Biceps"],
  ["Curl incliné","Biceps"],
  ["Curl pupitre","Biceps"],
  ["Curl poulie","Biceps"],
  ["Dips","Triceps"],
  ["Barre au front","Triceps"],
  ["Extension triceps poulie haute","Triceps"],
  ["Kickback haltère","Triceps"],
  ["Développé couché prise serrée","Triceps"],
  ["Squat","Quadriceps"],
  ["Squat bulgare","Quadriceps"],
  ["Fentes","Quadriceps"],
  ["Goblet squat","Quadriceps"],
  ["Front squat","Quadriceps"],
  ["Step-up","Quadriceps"],
  ["Soulevé de terre jambes tendues","Ischios"],
  ["Good morning","Ischios"],
  ["Leg curl allongé","Ischios"],
  ["Nordic curl","Ischios"],
  ["Pont fessier","Fessiers"],
  ["Kickback poulie","Fessiers"],
  ["Abduction élastique","Fessiers"],
  ["Mollets presse","Mollets"],
  ["Gainage","Abdos"],
  ["Crunch","Abdos"],
  ["Relevé de jambes","Abdos"],
  ["Roue abdominale","Abdos"],
  ["Pallof press","Abdos"],
  ["Russian twist","Abdos"]
];

/* Alternatives quand une zone fait mal */
const SUBSTITUTIONS = {
  "Hack squat": ["Presse à cuisses (amplitude contrôlée)","Leg extension","Goblet squat sur box"],
  "Presse à cuisses": ["Hack squat","Leg extension","Presse unilatérale légère"],
  "Presse lourde": ["Hack squat","Leg extension","Presse unilatérale"],
  "Rack pull": ["Tirage bûcheron lourd","Shrug haltères","Tirage menton poulie (léger)"],
  "RDL": ["Leg curl","Hip thrust","Good morning léger"],
  "Leg extension": ["Presse (amplitude haute)","Hack squat léger"],
  "Mollets debout": ["Mollets assis","Mollets à la presse (léger)"],
  "Mollets assis": ["Mollets debout (léger)"],
  "Abduction hanche": ["Abduction élastique","Clamshell","Pont fessier"],
  "Hip thrust": ["Pont fessier","Abduction hanche","RDL léger"]
};

const ETIREMENTS = ["Ischios assis","Quadriceps debout","Fente basse","Mollet mur (priorité droite)","Posture enfant","Torsion allongée","Cercles chevilles (pied droit)"];
const REGLES = ["Genou droit : ne jamais dépasser la pointe du pied.","Zéro saut les 4 premières semaines.","Douleur piquante = arrêt immédiat.","Bas du corps : progression plus lente (genou + pied droit).","Hydratation +++ et 7-8 h de sommeil."];
