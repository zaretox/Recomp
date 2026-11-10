"use strict";
/* FICHES — la bibliothèque expliquée : comment faire chaque exercice, et les techniques d'intensification.
 * Données pures. Textes rédigés pour RECOMP (consignes d'exécution classiques, aucun extrait de livre).
 * Chargé juste après programmes.js : complète EXO_LIB avant que programme.js ne s'en serve. */

/* Exercices en plus de ceux de programmes.js : [nom, muscle principal] */
const EXOS_EN_PLUS = [
  ["Développé couché machine","Pecs"], ["Pompes déclinées","Pecs"], ["Dips buste penché","Pecs"], ["Pull-over haltère","Pecs"],
  ["Tirage vertical prise serrée","Dos"], ["Rowing T-bar","Dos"], ["Rowing machine","Dos"], ["Tirage bras tendus poulie","Dos"], ["Hyperextensions","Dos"], ["Rowing inversé","Dos"], ["Shrug barre","Dos"],
  ["Développé haltères assis","Épaules"], ["Élévations latérales poulie","Épaules"], ["Tirage menton","Épaules"], ["Développé épaules machine","Épaules"], ["Oiseau machine","Épaules"],
  ["Curl concentré","Biceps"], ["Curl araignée","Biceps"], ["Curl inversé","Biceps"],
  ["Extension triceps haltère","Triceps"], ["Pompes diamant","Triceps"], ["Dips entre deux bancs","Triceps"], ["Extension triceps corde","Triceps"],
  ["Sissy squat","Quadriceps"], ["Fentes marchées","Quadriceps"], ["Squat pendulaire","Quadriceps"], ["Presse unilatérale","Quadriceps"],
  ["RDL haltères","Ischios"], ["Leg curl debout","Ischios"],
  ["Fentes arrière","Fessiers"], ["Clamshell","Fessiers"], ["Abduction poulie","Fessiers"], ["Soulevé de terre sumo","Fessiers"],
  ["Mollets unilatéral haltère","Mollets"], ["Mollets donkey","Mollets"],
  ["Crunch poulie","Abdos"], ["Relevé de jambes suspendu","Abdos"], ["Gainage latéral","Abdos"], ["Dead bug","Abdos"], ["Crunch inversé","Abdos"], ["Mountain climbers","Abdos"],
];
EXOS_EN_PLUS.forEach(x => { if (!EXO_LIB.some(([n]) => n === x[0])) EXO_LIB.push(x); });

/* Une fiche : s = muscles qui aident, mat = matériel, f = comment faire (dans l'ordre), c = la clé, e = l'erreur à éviter */
const FICHES = {};
const F = (nom, s, mat, f, c, e) => { FICHES[nom] = { s, mat, f, c, e }; };

/* ── PECS ── */
F("Développé couché", "Avant d'épaule, triceps", "Barre, banc plat",
  ["Allongé, les yeux sous la barre, pieds bien à plat au sol.", "Serre les omoplates et garde-les collées au banc, avec une légère cambrure.", "Descends la barre jusqu'au bas des pecs, coudes à environ 45° du corps, puis pousse en remontant légèrement vers les épaules."],
  "Les omoplates restent serrées du début à la fin : c'est ce qui protège l'épaule.", "Coudes écartés à 90° et fesses qui décollent du banc.");
F("DC haltères", "Avant d'épaule, triceps", "Haltères, banc plat",
  ["Assis, haltères sur les cuisses : allonge-toi en les ramenant contre la poitrine.", "Omoplates serrées, pieds au sol, haltères au-dessus du torse.", "Descends jusqu'à sentir l'étirement des pecs, puis pousse en rapprochant les haltères sans les cogner."],
  "Plus d'amplitude qu'à la barre : descends bas, mais sans douleur à l'épaule.", "Laisser les coudes tomber trop bas en fin de série.");
F("DC haltères neutre", "Triceps, avant d'épaule", "Haltères, banc plat",
  ["Même placement qu'au développé haltères, paumes face à face.", "Coudes près du corps, descends les haltères le long du torse.", "Pousse jusqu'en haut sans verrouiller sèchement les coudes."],
  "La prise neutre ménage l'épaule : idéale si elle est sensible.", "Écarter les coudes, ce qui annule l'intérêt de la prise.");
F("DI haltères", "Avant d'épaule, triceps", "Haltères, banc incliné à 30°",
  ["Banc incliné à 30° environ : c'est l'angle qui fait le plus travailler le haut des pecs ; au-delà de 45°, l'épaule prend le relais.", "Omoplates serrées, haltères au niveau du haut des pecs.", "Pousse vers le haut en rapprochant les haltères, puis redescends lentement."],
  "Vise le haut des pecs : les haltères descendent vers les clavicules, pas vers le ventre.", "Banc trop incliné, qui transfère le travail sur l'épaule.");
F("Développé incliné barre", "Avant d'épaule, triceps", "Barre, banc incliné",
  ["Banc à 30°, yeux sous la barre, omoplates serrées.", "Descends la barre sous les clavicules, coudes légèrement rentrés.", "Pousse à la verticale, sans décoller les fesses."],
  "Une inclinaison légère suffit pour cibler le haut des pecs.", "Rebondir sur la poitrine pour s'aider.");
F("Développé décliné", "Triceps", "Barre, banc décliné",
  ["Jambes bloquées sous les boudins, tête plus basse que le bassin.", "Descends la barre vers le bas des pecs.", "Pousse en gardant les omoplates serrées."],
  "Amplitude plus courte : charge un peu plus lourde possible, mais garde le contrôle.", "Se faire passer la barre sans pareur : demande de l'aide pour la sortir.");
F("Développé couché machine", "Avant d'épaule, triceps", "Machine guidée",
  ["Règle le siège pour que les poignées soient au milieu des pecs.", "Dos collé au dossier, omoplates serrées.", "Pousse sans verrouiller, puis reviens lentement jusqu'à l'étirement."],
  "Parfait pour finir à l'échec en sécurité, sans pareur.", "Siège mal réglé, poignées au niveau du cou.");
F("Pompes", "Triceps, avant d'épaule, gainage", "Poids du corps",
  ["Mains un peu plus larges que les épaules, corps droit de la tête aux talons.", "Descends la poitrine près du sol, coudes à 45°.", "Pousse en gardant le ventre et les fesses serrés."],
  "Le corps reste une planche : rien ne s'affaisse.", "Bassin qui tombe ou fesses en l'air.");
F("Pompes déclinées", "Avant d'épaule, triceps", "Poids du corps, banc",
  ["Pieds posés sur un banc, mains au sol.", "Corps gainé, descends la tête vers l'avant des mains.", "Pousse fort jusqu'en haut."],
  "Plus les pieds sont hauts, plus le haut des pecs et les épaules travaillent.", "Cambrer le bas du dos.");
F("Dips buste penché", "Triceps, avant d'épaule", "Barres parallèles",
  ["En appui sur les barres, penche le buste vers l'avant, jambes un peu en arrière.", "Descends jusqu'à ce que les épaules soient au niveau des coudes, pas plus bas.", "Remonte en gardant l'inclinaison."],
  "Le buste penché met les pecs au travail ; droit, ce sont les triceps.", "Descendre trop bas : l'épaule n'aime pas ça.");
F("Écarté haltères", "Avant d'épaule", "Haltères, banc plat",
  ["Allongé, haltères au-dessus du torse, paumes face à face, coudes légèrement fléchis.", "Ouvre les bras en arc de cercle jusqu'à sentir l'étirement.", "Referme comme si tu enlaçais un tronc d'arbre."],
  "Les coudes gardent le même angle du début à la fin.", "Plier les coudes en descendant : ça devient un développé.");
F("Écarté poulie vis-à-vis", "Avant d'épaule", "Deux poulies hautes",
  ["Au centre, un pied devant, buste légèrement penché.", "Bras ouverts, coudes un peu fléchis, ramène les mains devant toi vers le bas.", "Serre les pecs 1 seconde, puis laisse revenir lentement."],
  "La poulie garde de la tension même mains jointes : profites-en pour serrer.", "Tirer avec les bras au lieu de rapprocher les coudes.");
F("Poulie basse (pecs)", "Avant d'épaule", "Deux poulies basses",
  ["Poulies en bas, un pied devant, buste droit.", "Ramène les mains vers le haut, devant le menton.", "Tiens la contraction 2 secondes, puis redescends lentement."],
  "Mouvement de bas en haut : il cible le haut des pecs.", "Lever les épaules vers les oreilles.");
F("Pec deck", "Avant d'épaule", "Machine à écarté",
  ["Siège réglé pour que les poignées soient à hauteur de poitrine.", "Dos collé, ramène les bras devant toi.", "Serre 1 seconde, reviens lentement jusqu'à l'étirement."],
  "Idéal pour sentir le muscle : charge modérée, contraction franche.", "Laisser les poids claquer au retour.");
F("Pull-over haltère", "Dos (grand dorsal), triceps", "Un haltère, banc",
  ["Allongé en travers ou dans la longueur du banc, haltère tenu à deux mains au-dessus de la poitrine.", "Coudes légèrement fléchis, descends l'haltère derrière la tête.", "Remonte au-dessus de la poitrine en gardant les bras presque tendus."],
  "Descends seulement tant que l'épaule est à l'aise.", "Plier les coudes à chaque répétition.");

/* ── DOS ── */
F("Tractions", "Biceps, arrière d'épaule", "Barre fixe",
  ["Prise un peu plus large que les épaules, paumes vers l'avant.", "Commence par abaisser les épaules, puis tire les coudes vers les hanches.", "Monte le menton au-dessus de la barre, redescends bras tendus."],
  "Pense « coudes dans les poches arrière » plutôt que « monter le menton ».", "Se balancer ou faire des demi-répétitions.");
F("Tractions assistées", "Biceps", "Machine ou élastique",
  ["Genoux sur la plateforme ou pied dans l'élastique.", "Même mouvement qu'une traction : épaules basses, coudes vers les hanches.", "Redescends jusqu'en bas, bras tendus."],
  "Baisse l'aide au fil des semaines : c'est ta progression.", "Garder trop d'aide trop longtemps.");
F("Tirage vertical", "Biceps, arrière d'épaule", "Poulie haute, barre large",
  ["Cuisses calées, prise un peu plus large que les épaules.", "Poitrine sortie, tire la barre vers le haut des pecs.", "Remonte lentement jusqu'à étirer le dos."],
  "Le mouvement part des omoplates, pas des bras.", "Se pencher très en arrière et tirer avec tout le corps.");
F("Tirage vertical prise serrée", "Biceps", "Poulie haute, poignée triangle",
  ["Poignée serrée, paumes face à face.", "Tire vers le bas du sternum en gardant la poitrine haute.", "Remonte en laissant les épaules s'étirer."],
  "Grande amplitude : cherche l'étirement en haut.", "Arrondir le dos en fin de mouvement.");
F("Tirage horizontal poulie", "Biceps, arrière d'épaule", "Poulie basse, poignée triangle",
  ["Assis, genoux légèrement fléchis, dos droit.", "Tire la poignée vers le nombril en serrant les omoplates.", "Reviens bras tendus en laissant le dos s'étirer, sans t'arrondir."],
  "Le buste bouge peu : c'est le dos qui travaille, pas les lombaires.", "Faire de grands balanciers avec le buste.");
F("Tirage bûcheron", "Biceps, arrière d'épaule", "Haltère, banc",
  ["Une main et un genou sur le banc, dos plat.", "Tire l'haltère vers la hanche, coude près du corps.", "Redescends lentement bras tendu."],
  "Tire vers la hanche, pas vers l'épaule : le grand dorsal travaille mieux.", "Tourner le buste pour monter la charge.");
F("Rowing haltère", "Biceps, arrière d'épaule", "Haltère, banc",
  ["Appui sur un banc, dos plat et parallèle au sol.", "Tire l'haltère vers la hanche.", "Contrôle la descente."],
  "Garde les épaules à la même hauteur tout au long du mouvement.", "Arrondir le dos.");
F("Rowing barre", "Biceps, lombaires", "Barre",
  ["Debout, genoux fléchis, buste penché à 45° environ, dos plat.", "Tire la barre vers le bas du ventre.", "Redescends en gardant le dos immobile."],
  "Le dos reste plat et fixe : si le buste se relève, la charge est trop lourde.", "Se redresser à chaque répétition.");
F("Rowing T-bar", "Biceps, arrière d'épaule", "Barre en T ou machine",
  ["Pieds de part et d'autre, buste penché, dos plat.", "Tire la poignée vers le ventre en serrant les omoplates.", "Redescends en gardant la position."],
  "Permet de charger lourd avec un dos stable.", "Faire de petits mouvements saccadés.");
F("Rowing machine", "Biceps", "Machine à rowing, appui poitrine",
  ["Poitrine contre l'appui, bras tendus.", "Tire les coudes vers l'arrière en serrant les omoplates.", "Reviens lentement."],
  "L'appui poitrine épargne le bas du dos : charge sans crainte.", "Décoller la poitrine de l'appui.");
F("Tirage bras tendus poulie", "Triceps (longue portion)", "Poulie haute, barre ou corde",
  ["Debout face à la poulie, buste légèrement penché, bras presque tendus.", "Ramène la barre jusqu'aux cuisses en gardant les bras tendus.", "Remonte lentement jusqu'à étirer le dos."],
  "Isole le grand dorsal : parfait en pré-fatigue avant un tirage.", "Plier les coudes, ce qui fait travailler les triceps.");
F("Rowing inversé", "Biceps, arrière d'épaule", "Barre basse ou anneaux",
  ["Allongé sous une barre, corps droit, talons au sol.", "Tire la poitrine vers la barre.", "Redescends bras tendus en gardant le corps gainé."],
  "Plus les pieds sont hauts, plus c'est dur.", "Laisser le bassin tomber.");
F("Rack pull", "Fessiers, ischios, trapèzes", "Barre, cage à squat",
  ["Barre posée sur les sécurités, au niveau des genoux.", "Dos plat, barre contre les cuisses.", "Pousse les hanches vers l'avant pour te relever, puis repose la barre en contrôle."],
  "Soulevé de terre partiel : idéal pour charger le haut du dos et la prise.", "Arrondir le dos ou finir en se cambrant.");
F("Soulevé de terre", "Fessiers, ischios, quadriceps, trapèzes", "Barre",
  ["Barre au-dessus du milieu des pieds, tibias presque contre la barre.", "Prends la barre, dos plat, poitrine sortie, épaules au-dessus de la barre.", "Pousse dans le sol pour te relever, barre collée aux jambes, puis redescends de la même façon."],
  "La barre frotte les jambes tout du long : plus elle s'éloigne, plus le dos souffre.", "Arrondir le bas du dos.");
F("Pull-over poulie", "Triceps (longue portion)", "Poulie haute, corde ou barre",
  ["Debout face à la poulie, bras presque tendus.", "Ramène la corde vers les cuisses en arc de cercle.", "Remonte lentement."],
  "Même principe que le tirage bras tendus : le grand dorsal fait l'essentiel, aidé par la longue portion du triceps.", "Plier les bras.");
F("Shrug haltères", "Trapèzes", "Haltères",
  ["Debout, haltères le long du corps.", "Monte les épaules droit vers les oreilles.", "Tiens 1 seconde en haut, redescends lentement."],
  "Monte droit, sans rouler les épaules.", "Plier les coudes pour tirer.");
F("Shrug barre", "Trapèzes", "Barre",
  ["Debout, barre devant les cuisses, prise largeur d'épaules.", "Hausse les épaules le plus haut possible.", "Pause en haut, puis redescente lente."],
  "Prends des sangles si la prise lâche avant les trapèzes.", "Faire des à-coups avec les jambes.");
F("Hyperextensions", "Fessiers, ischios", "Banc à lombaires",
  ["Hanches calées sur l'appui, pieds bloqués.", "Descends le buste en gardant le dos plat.", "Remonte jusqu'à l'alignement du corps, pas au-delà."],
  "Arrête-toi quand le corps est aligné : pas besoin de se cambrer.", "Remonter trop haut en hyper-cambrant.");

/* ── ÉPAULES ── */
F("Développé militaire barre", "Triceps, trapèzes", "Barre",
  ["Debout, barre sur le haut des pecs, prise un peu plus large que les épaules.", "Serre les fesses et le ventre.", "Pousse la barre au-dessus de la tête en reculant légèrement la tête, puis redescends."],
  "Fesses et abdos serrés : ça évite de se cambrer.", "Se pencher en arrière pour finir la répétition.");
F("DM haltères", "Triceps", "Haltères, banc à dossier droit",
  ["Assis, dos contre le dossier, haltères au niveau des oreilles.", "Pousse vers le haut en rapprochant légèrement les haltères.", "Redescends jusqu'au niveau des oreilles."],
  "Dos collé au dossier tout le long.", "Descendre trop bas ou se cambrer.");
F("Développé haltères assis", "Triceps", "Haltères, banc à dossier droit",
  ["Assis, dos contre le dossier, haltères au niveau des épaules.", "Pousse au-dessus de la tête.", "Redescends en contrôle."],
  "Garde les coudes légèrement devant le corps : l'épaule est plus à l'aise.", "Coudes complètement en arrière.");
F("Développé épaules machine", "Triceps", "Machine guidée",
  ["Siège réglé pour que les poignées soient à hauteur d'épaules.", "Pousse sans verrouiller les coudes.", "Reviens lentement."],
  "Bon choix pour finir à l'échec en sécurité.", "Siège trop bas.");
F("Développé Arnold", "Triceps", "Haltères",
  ["Assis, haltères devant le visage, paumes vers toi.", "En poussant, tourne les poignets pour finir paumes vers l'avant.", "Fais le chemin inverse en redescendant."],
  "La rotation se fait pendant la montée, pas après.", "Charger trop lourd : le geste devient brouillon.");
F("Élévations lat.", "Trapèzes", "Haltères",
  ["Debout, buste légèrement penché, coudes un peu fléchis.", "Monte les bras sur les côtés jusqu'à l'horizontale, coudes en premier.", "Redescends lentement."],
  "Monte en menant avec les coudes, sans hausser les épaules vers les oreilles.", "Balancer le corps pour lancer les haltères.");
F("Élévations latérales poulie", "Trapèzes", "Poulie basse, poignée",
  ["De côté par rapport à la poulie, câble passant devant toi.", "Monte le bras sur le côté jusqu'à l'horizontale.", "Redescends lentement."],
  "La poulie garde la tension tout en bas, là où l'haltère n'en a pas.", "Hausser l'épaule pendant la montée.");
F("Élévations frontales", "Haut des pecs", "Haltères, disque ou poulie",
  ["Debout, bras devant les cuisses.", "Monte les bras devant toi jusqu'à hauteur des yeux.", "Redescends lentement."],
  "L'avant d'épaule travaille déjà dans tous les développés : volume modéré.", "Se balancer d'avant en arrière.");
F("Oiseau haltères", "Trapèzes, rhomboïdes", "Haltères",
  ["Buste penché presque à l'horizontale, dos plat.", "Ouvre les bras sur les côtés, coudes légèrement fléchis.", "Redescends lentement."],
  "Charge légère : l'arrière d'épaule est un petit muscle.", "Serrer les omoplates : ça fait travailler le milieu du dos.");
F("Oiseau machine", "Trapèzes", "Pec deck réglé à l'envers",
  ["Face à la machine, poitrine contre le dossier.", "Ouvre les bras vers l'arrière, coudes légèrement fléchis.", "Reviens lentement."],
  "Pense « écarter les mains » plutôt que « reculer les coudes ».", "Charge trop lourde, qui fait tirer le dos.");
F("Écarté inversé poulie", "Trapèzes", "Poulies ou poulie basse",
  ["Allongé au banc ou debout, câbles croisés devant toi.", "Ouvre les bras vers l'arrière.", "Reviens lentement."],
  "Mouvement lent, sans élan.", "Plier les coudes pour tirer.");
F("Face pull", "Trapèzes, rotateurs de l'épaule", "Poulie haute, corde",
  ["Corde à hauteur du visage, bras tendus.", "Tire la corde vers le front en écartant les mains.", "Finis coudes hauts, mains au niveau des oreilles."],
  "Excellent pour la santé des épaules : fais-le souvent, léger.", "Tirer vers le cou, coudes bas.");
F("Tirage araignée", "Trapèzes", "Haltères, banc incliné",
  ["À plat ventre sur un banc incliné.", "Ouvre les bras sur les côtés, coudes légèrement fléchis.", "Redescends lentement, épaules relâchées."],
  "Le banc empêche de tricher : petit poids, mouvement propre.", "Lever la tête et se cambrer.");
F("Tirage menton", "Trapèzes", "Barre, poulie ou haltères",
  ["Prise largeur d'épaules ou un peu plus.", "Monte la barre le long du corps jusqu'au bas de la poitrine, coudes en premier.", "Redescends lentement."],
  "Prise large et montée jusqu'au bas des pecs : c'est plus doux pour l'épaule.", "Prise trop serrée et barre jusqu'au menton.");

/* ── BICEPS ── */
F("Curl biceps", "Avant-bras", "Haltères",
  ["Debout, haltères le long du corps, paumes vers l'avant.", "Plie les coudes sans les avancer.", "Serre en haut, redescends lentement jusqu'à tendre les bras."],
  "Les coudes restent collés aux côtes.", "Balancer le dos pour monter.");
F("Curl barre", "Avant-bras", "Barre droite ou EZ",
  ["Debout, prise largeur d'épaules.", "Monte la barre en gardant les coudes fixes.", "Redescends jusqu'à bras tendus."],
  "La barre EZ ménage les poignets.", "Se pencher en arrière.");
F("Curl marteau", "Brachial, avant-bras", "Haltères",
  ["Paumes face à face, haltères le long du corps.", "Monte en gardant cette prise.", "Redescends lentement."],
  "Épaissit le bras par le muscle sous le biceps.", "Avancer les coudes.");
F("Curl incliné", "Avant-bras", "Haltères, banc incliné",
  ["Assis sur un banc incliné à 45-60°, bras pendants derrière le corps.", "Monte sans avancer les coudes.", "Redescends jusqu'à l'étirement complet."],
  "Le bras en arrière étire davantage le biceps, mais ne le fait pas grossir plus qu'un curl classique : c'est une variante, pas un raccourci.", "Décoller les épaules du dossier.");
F("Curl pupitre", "Brachial", "Pupitre, barre EZ ou haltère",
  ["Bras posés sur le pupitre, aisselles calées.", "Monte la charge.", "Redescends lentement sans verrouiller brutalement en bas."],
  "Le pupitre interdit toute triche.", "Lâcher la descente : risque pour le tendon.");
F("Curl poulie", "Avant-bras", "Poulie basse, barre ou poignée",
  ["Face à la poulie, coudes le long du corps.", "Monte sans avancer les coudes.", "Redescends lentement."],
  "Tension constante : bon pour finir la séance.", "Reculer le corps à chaque répétition.");
F("Curl concentré", "Brachial", "Haltère, banc",
  ["Assis, coude calé contre l'intérieur de la cuisse.", "Monte l'haltère vers l'épaule.", "Serre en haut, redescends lentement."],
  "Mouvement d'isolation : vise la sensation plus que la charge.", "Bouger le buste.");
F("Curl araignée", "Brachial", "Haltères ou barre, banc incliné",
  ["À plat ventre sur un banc incliné, bras pendants vers le sol.", "Monte la charge en gardant les coudes immobiles.", "Redescends lentement."],
  "Très forte contraction en haut : tiens-la 1 seconde.", "Lever les coudes.");
F("Curl inversé", "Avant-bras, brachial", "Barre EZ ou haltères",
  ["Prise paumes vers le bas.", "Monte la barre en gardant les poignets droits.", "Redescends lentement."],
  "Charge légère : c'est l'avant-bras qui limite.", "Plier les poignets.");

/* ── TRICEPS ── */
F("Triceps poulie", "—", "Poulie haute, barre ou corde",
  ["Face à la poulie, coudes collés au corps.", "Pousse vers le bas jusqu'à tendre les bras.", "Remonte jusqu'à angle droit, sans décoller les coudes."],
  "Seuls les avant-bras bougent.", "Se pencher sur la charge pour pousser avec le corps.");
F("Extension triceps corde", "—", "Poulie haute, corde",
  ["Coudes collés au corps, corde en main.", "Pousse vers le bas et écarte les mains en fin de mouvement.", "Remonte lentement."],
  "Écarter la corde en bas renforce la contraction.", "Décoller les coudes.");
F("Ext. triceps", "—", "Haltère ou poulie",
  ["Bras au-dessus de la tête, coudes vers le plafond.", "Descends la charge derrière la tête.", "Tends les bras sans écarter les coudes."],
  "Bras au-dessus de la tête, la longue portion s'étire : elle grossit nettement plus qu'avec les bras le long du corps. C'est la meilleure extension pour le volume du bras.", "Écarter les coudes vers l'extérieur.");
F("Extension triceps haltère", "—", "Un haltère",
  ["Assis ou debout, haltère tenu à deux mains au-dessus de la tête.", "Descends derrière la tête en gardant les coudes serrés.", "Remonte jusqu'à bras tendus."],
  "Garde les coudes pointés vers le haut.", "Se cambrer pour aider.");
F("Extension triceps poulie haute", "—", "Poulie haute, corde",
  ["Dos à la poulie, corde derrière la tête, buste penché.", "Tends les bras vers l'avant.", "Reviens lentement jusqu'à l'étirement."],
  "Version poulie de l'extension au-dessus de la tête : tension constante.", "Bouger les coudes.");
F("Barre au front", "—", "Barre EZ, banc plat",
  ["Allongé, barre au-dessus du front, bras verticaux.", "Plie les coudes pour descendre la barre vers le front ou juste derrière la tête.", "Tends les bras sans écarter les coudes."],
  "Descendre la barre derrière la tête étire mieux le triceps et soulage le coude.", "Coudes qui partent sur les côtés.");
F("Kickback haltère", "—", "Haltère, banc",
  ["Buste penché, bras collé au corps, coude à 90°.", "Tends le bras vers l'arrière.", "Tiens 1 seconde, reviens lentement."],
  "Le bras reste immobile, seul l'avant-bras bouge.", "Balancer l'haltère.");
F("Développé couché prise serrée", "Pecs, avant d'épaule", "Barre, banc plat",
  ["Prise largeur d'épaules, pas plus serrée.", "Descends la barre vers le bas des pecs, coudes près du corps.", "Pousse en gardant les coudes serrés."],
  "Largeur d'épaules suffit : plus serré, les poignets souffrent.", "Mains collées l'une à l'autre.");
F("Dips", "Pecs, avant d'épaule", "Barres parallèles",
  ["En appui, buste droit, coudes vers l'arrière.", "Descends jusqu'à ce que les bras soient à angle droit.", "Pousse jusqu'à tendre les bras."],
  "Buste droit = triceps ; penché en avant = pecs.", "Descendre trop bas en forçant sur l'épaule.");
F("Dips entre deux bancs", "Pecs, avant d'épaule", "Deux bancs ou un banc",
  ["Mains sur le bord d'un banc, derrière toi, jambes tendues devant.", "Descends en pliant les coudes vers l'arrière.", "Remonte jusqu'à tendre les bras."],
  "Reste près du banc et ne descends pas trop bas.", "Coudes qui s'écartent.");
F("Pompes diamant", "Pecs", "Poids du corps",
  ["Mains rapprochées sous la poitrine, index et pouces qui se touchent.", "Descends en gardant les coudes près du corps.", "Pousse jusqu'en haut."],
  "Trop dur ? Fais-les sur les genoux.", "Bassin qui s'affaisse.");

/* ── QUADRICEPS ── */
F("Squat", "Fessiers, ischios, lombaires", "Barre, cage à squat",
  ["Barre sur le haut du dos, pieds largeur d'épaules, pointes légèrement ouvertes.", "Inspire, gaine-toi, descends en poussant les genoux dans l'axe des pieds.", "Descends au moins jusqu'à cuisses parallèles, puis remonte en poussant dans tout le pied."],
  "Les genoux suivent la direction des pieds, sans rentrer vers l'intérieur.", "Talons qui décollent ou dos qui s'arrondit en bas.");
F("Front squat", "Fessiers, abdos", "Barre, cage",
  ["Barre posée sur l'avant des épaules, coudes hauts.", "Descends en gardant le buste droit.", "Remonte en poussant les coudes vers le haut."],
  "Buste plus droit qu'au squat classique : moins de contrainte pour le dos.", "Coudes qui tombent, la barre glisse.");
F("Goblet squat", "Fessiers", "Haltère ou kettlebell",
  ["Haltère tenu contre la poitrine.", "Descends entre tes jambes, buste droit.", "Remonte en poussant dans les talons."],
  "Parfait pour apprendre le squat ou ménager le dos.", "Pencher le buste vers l'avant.");
F("Presse à cuisses", "Fessiers, ischios", "Presse inclinée",
  ["Dos et bassin collés au dossier, pieds largeur d'épaules au milieu de la plateforme.", "Descends jusqu'à ce que les genoux approchent de la poitrine, sans que le bassin décolle.", "Pousse sans verrouiller les genoux."],
  "Le bassin reste collé : s'il se décolle, tu descends trop bas.", "Verrouiller les genoux en haut.");
F("Presse lourde", "Fessiers, ischios", "Presse inclinée",
  ["Même placement qu'à la presse classique.", "Charge lourde, amplitude complète maîtrisée.", "Pousse fort, sans verrouiller."],
  "Lourd ne veut pas dire raccourci : garde l'amplitude.", "Demi-répétitions avec trop de charge.");
F("Presse unilatérale", "Fessiers", "Presse inclinée",
  ["Un seul pied au milieu de la plateforme.", "Descends lentement en contrôlant le genou.", "Pousse sans verrouiller."],
  "Corrige les écarts entre les deux jambes.", "Bassin qui tourne.");
F("Hack squat", "Fessiers", "Machine hack squat",
  ["Dos collé au dossier, pieds largeur d'épaules.", "Descends lentement, genoux dans l'axe des pieds.", "Remonte en poussant dans tout le pied."],
  "Pieds plus bas sur la plateforme = plus de quadriceps.", "Descente trop rapide qui écrase les genoux.");
F("Squat pendulaire", "Fessiers", "Machine pendulaire",
  ["Dos contre le dossier, épaules sous les appuis.", "Descends profondément en contrôle.", "Remonte sans verrouiller."],
  "Très grande amplitude pour les quadriceps, sans charge sur le dos.", "Rebondir en bas.");
F("Leg extension", "—", "Machine",
  ["Dossier réglé pour que le genou soit dans l'axe de la machine.", "Tends les jambes.", "Tiens 1 seconde en haut, redescends lentement."],
  "Isole le quadriceps : va doucement si le genou est sensible.", "Donner un coup de reins pour lancer la charge.");
F("Squat bulgare", "Fessiers, ischios", "Haltères, banc",
  ["Pied arrière posé sur un banc, pied avant assez loin.", "Descends verticalement jusqu'à ce que le genou arrière frôle le sol.", "Remonte en poussant dans le pied avant."],
  "Buste droit = quadriceps ; penché en avant = fessiers.", "Pied avant trop près du banc.");
F("Fentes", "Fessiers", "Haltères ou poids du corps",
  ["Debout, fais un grand pas en avant.", "Descends jusqu'à ce que le genou arrière frôle le sol.", "Remonte en poussant dans le talon avant, reviens et change de jambe."],
  "Le genou avant reste au-dessus du pied, sans rentrer.", "Pas trop court, genou qui dépasse beaucoup.");
F("Fentes marchées", "Fessiers", "Haltères",
  ["Fais une fente, puis enchaîne en avançant l'autre jambe.", "Garde le buste droit.", "Avance sur 10 à 20 m."],
  "Grandes enjambées : plus de fessiers.", "Petits pas pressés.");
F("Step-up", "Fessiers", "Banc ou caisse, haltères",
  ["Pied entier posé sur le banc.", "Monte en poussant dans ce pied, sans t'aider de l'autre jambe.", "Redescends lentement."],
  "C'est la jambe du haut qui fait tout le travail.", "Pousser avec la jambe du sol.");
F("Sissy squat", "—", "Poids du corps, appui",
  ["Debout, tiens-toi à un appui, monte sur la pointe des pieds.", "Penche-toi en arrière en avançant les genoux, corps droit des genoux aux épaules.", "Remonte en contractant les quadriceps."],
  "Exercice avancé : à éviter si le genou est douloureux.", "Plier les hanches.");

/* ── ISCHIOS ── */
F("RDL", "Fessiers, lombaires", "Barre",
  ["Debout, barre devant les cuisses, genoux légèrement fléchis.", "Pousse les fesses vers l'arrière en faisant glisser la barre le long des jambes, dos plat.", "Descends jusqu'à sentir l'étirement des ischios, puis remonte en poussant les hanches vers l'avant."],
  "C'est un mouvement de hanches, pas de dos : les fesses reculent.", "Arrondir le dos pour descendre plus bas.");
F("RDL haltères", "Fessiers", "Haltères",
  ["Haltères devant les cuisses, genoux légèrement fléchis.", "Fesses vers l'arrière, haltères le long des jambes, dos plat.", "Remonte en serrant les fesses."],
  "Version plus douce que la barre, utile pour apprendre le geste.", "Plier les genoux comme un squat.");
F("Soulevé de terre jambes tendues", "Fessiers, lombaires", "Barre",
  ["Jambes presque tendues, barre devant les cuisses.", "Descends en gardant le dos plat jusqu'à l'étirement.", "Remonte en poussant les hanches."],
  "Très étirant : n'ajoute de la charge que si le dos reste plat.", "Arrondir le dos.");
F("Good morning", "Fessiers, lombaires", "Barre",
  ["Barre sur le haut du dos, genoux légèrement fléchis.", "Penche le buste en avant en reculant les fesses, dos plat.", "Remonte en poussant les hanches."],
  "Charge légère : c'est un exercice d'étirement sous tension.", "Charger lourd trop vite.");
F("Leg curl", "Mollets", "Machine",
  ["Genou dans l'axe de la machine, boudin au-dessus des talons.", "Ramène les talons vers les fesses.", "Tiens 1 seconde, redescends lentement."],
  "Pointe de pied vers toi : plus de force.", "Décoller les hanches.");
F("Leg curl assis", "Mollets", "Machine assise",
  ["Cuisses bloquées, genou dans l'axe.", "Ramène les talons sous le siège.", "Remonte lentement."],
  "Assis, les ischios sont étirés à la hanche : cette version les fait grossir davantage que le leg curl allongé.", "Lâcher la remontée.");
F("Leg curl allongé", "Mollets", "Machine allongée",
  ["À plat ventre, boudin au-dessus des talons.", "Ramène les talons vers les fesses sans décoller le bassin.", "Redescends lentement."],
  "Bassin collé au banc tout du long.", "Bassin qui se soulève.");
F("Leg curl debout", "—", "Machine debout ou poulie",
  ["Une jambe à la fois, buste calé.", "Ramène le talon vers la fesse.", "Redescends lentement."],
  "Travail une jambe à la fois : utile pour corriger un déséquilibre.", "Balancer la jambe.");
F("Nordic curl", "Mollets", "Pieds calés au sol",
  ["À genoux, chevilles bloquées.", "Descends le corps vers l'avant le plus lentement possible, corps droit.", "Rattrape-toi avec les mains, puis remonte en t'aidant un peu."],
  "La descente est l'exercice : fais-la le plus lentement possible.", "Plier les hanches pour se faciliter la tâche.");

/* ── FESSIERS ── */
F("Hip thrust", "Ischios", "Barre, banc",
  ["Haut du dos contre un banc, barre sur les hanches avec une protection.", "Pieds à plat, tibias verticaux en haut du mouvement.", "Pousse les hanches vers le haut, serre les fesses 1 seconde, redescends."],
  "Menton rentré et regard vers l'avant : ça évite de se cambrer.", "Finir en hyper-cambrant le bas du dos.");
F("Pont fessier", "Ischios", "Sol, poids du corps ou charge",
  ["Allongé sur le dos, genoux pliés, pieds à plat.", "Monte les hanches en serrant les fesses.", "Tiens 2 secondes, redescends."],
  "Version simple du hip thrust : parfaite à la maison.", "Pousser avec le dos.");
F("Soulevé de terre sumo", "Quadriceps, adducteurs, dos", "Barre",
  ["Pieds très écartés, pointes ouvertes, mains entre les jambes.", "Dos plat, pousse les genoux vers l'extérieur.", "Relève-toi en poussant dans le sol."],
  "Buste plus droit que le soulevé classique : moins de stress sur le dos.", "Genoux qui rentrent.");
F("Fentes arrière", "Quadriceps", "Haltères ou poids du corps",
  ["Debout, fais un pas en arrière.", "Descends jusqu'à ce que le genou arrière frôle le sol.", "Reviens en poussant dans le talon avant."],
  "Plus doux pour le genou que la fente avant.", "Buste qui s'effondre vers l'avant.");
F("Kickback poulie", "Ischios", "Poulie basse, sangle de cheville",
  ["Sangle à la cheville, buste légèrement penché, mains sur la machine.", "Pousse la jambe vers l'arrière et vers le haut.", "Serre la fesse en haut, reviens lentement."],
  "Petite amplitude bien contractée vaut mieux qu'un grand balancier.", "Se cambrer pour monter la jambe.");
F("Abduction hanche", "—", "Machine",
  ["Assis, dos collé, genoux contre les appuis.", "Écarte les jambes.", "Tiens 1 seconde, reviens lentement."],
  "Buste penché en avant : plus de fessiers.", "Laisser claquer les poids.");
F("Abduction élastique", "—", "Élastique",
  ["Élastique au-dessus des genoux, en demi-squat ou couché sur le côté.", "Écarte les genoux contre l'élastique.", "Reviens lentement."],
  "Bon échauffement des fessiers avant le bas du corps.", "Mouvement trop rapide.");
F("Abduction poulie", "—", "Poulie basse, sangle de cheville",
  ["Debout de côté, sangle à la cheville la plus éloignée.", "Écarte la jambe sur le côté.", "Reviens lentement."],
  "Garde le buste droit, sans pencher.", "Se pencher pour monter la jambe plus haut.");
F("Clamshell", "—", "Élastique, sol",
  ["Couché sur le côté, genoux pliés, élastique au-dessus des genoux.", "Ouvre le genou du dessus, pieds collés.", "Reviens lentement."],
  "Exercice doux, utile en échauffement ou si la hanche est sensible.", "Tourner le bassin vers l'arrière.");

/* ── MOLLETS ── */
F("Mollets debout", "—", "Machine ou marche",
  ["Avant du pied sur le bord d'une marche, jambes tendues.", "Descends les talons au maximum.", "Monte le plus haut possible, tiens 1 seconde."],
  "Pause en bas pour supprimer l'effet ressort du tendon. Jambes tendues, le mollet est étiré : c'est la version qui le fait le plus grossir.", "Rebondir en bas.");
F("Mollets assis", "—", "Machine assise",
  ["Genoux sous les appuis, avant du pied sur la marche.", "Descends les talons au maximum.", "Monte, tiens 1 seconde."],
  "Genoux pliés, le gros muscle du mollet travaille peu et grossit à peine. Le soléaire, dessous, grossit autant qu'au mollet debout : garde le mollet debout comme exercice principal.", "Petites répétitions sans amplitude.");
F("Mollets presse", "—", "Presse à cuisses",
  ["Avant du pied sur le bas de la plateforme, jambes tendues.", "Pousse avec les pointes de pied.", "Reviens lentement jusqu'à l'étirement."],
  "Garde les genoux tendus mais pas verrouillés.", "Plier les genoux pour aider.");
F("Mollets unilatéral haltère", "—", "Haltère, marche",
  ["Un pied sur le bord d'une marche, haltère du même côté.", "Descends le talon au maximum.", "Monte le plus haut possible."],
  "Une jambe à la fois : corrige un mollet plus faible.", "Se tenir trop fort à l'appui.");
F("Mollets donkey", "—", "Machine donkey ou partenaire",
  ["Buste penché à 90°, avant du pied sur la marche.", "Descends les talons.", "Monte au maximum."],
  "Jambes tendues comme au mollet debout, mais sans charge sur le dos.", "Bouger les hanches.");

/* ── ABDOS ── */
F("Gainage", "Fessiers, épaules", "Sol",
  ["Sur les avant-bras et les pointes de pied, coudes sous les épaules.", "Corps droit, fesses et ventre serrés.", "Tiens la position en respirant normalement."],
  "Mieux vaut 30 secondes parfaites qu'une minute affaissée.", "Bassin qui tombe ou fesses trop hautes.");
F("Gainage latéral", "Fessiers moyens", "Sol",
  ["Sur un avant-bras, coude sous l'épaule, pieds empilés.", "Monte le bassin pour aligner le corps.", "Tiens la position, puis change de côté."],
  "Le bassin reste haut et aligné.", "Bassin qui s'affaisse.");
F("Crunch", "—", "Sol",
  ["Allongé, genoux pliés, mains près des tempes.", "Enroule le haut du dos en rapprochant les côtes du bassin.", "Redescends lentement."],
  "Pense « enrouler », pas « se relever ».", "Tirer sur la nuque avec les mains.");
F("Crunch poulie", "—", "Poulie haute, corde",
  ["À genoux face à la poulie, corde de chaque côté de la tête.", "Enroule le buste vers le sol en rapprochant les coudes des genoux.", "Remonte lentement."],
  "Les hanches ne bougent pas : seul le dos s'enroule.", "S'asseoir sur les talons pour tirer.");
F("Crunch inversé", "—", "Sol ou banc",
  ["Allongé, jambes pliées en l'air.", "Enroule le bassin pour ramener les genoux vers la poitrine.", "Redescends lentement."],
  "C'est le bassin qui décolle, pas un balancier des jambes.", "Prendre de l'élan.");
F("Relevé de jambes", "Fléchisseurs de hanche", "Banc ou sol",
  ["Allongé, mains sous les fesses ou sur le banc.", "Monte les jambes, puis enroule le bassin en fin de mouvement.", "Redescends lentement sans toucher le sol."],
  "Enrouler le bassin en haut fait vraiment travailler les abdos.", "Cambrer le bas du dos.");
F("Relevé de jambes suspendu", "Fléchisseurs de hanche, avant-bras", "Barre fixe",
  ["Suspendu à la barre, corps immobile.", "Monte les genoux ou les jambes en enroulant le bassin.", "Redescends lentement sans te balancer."],
  "Commence genoux pliés, passe aux jambes tendues quand c'est facile.", "Se balancer.");
F("Roue abdominale", "Dos, épaules", "Roue",
  ["À genoux, mains sur la roue.", "Roule vers l'avant en gardant le dos plat.", "Reviens en contractant les abdos."],
  "Ne va pas plus loin que ce que tu contrôles sans te cambrer.", "Bas du dos qui se creuse.");
F("Pallof press", "Obliques", "Poulie ou élastique",
  ["De côté par rapport à la poulie, poignée contre la poitrine.", "Pousse les mains devant toi sans laisser le buste tourner.", "Reviens, puis change de côté."],
  "Le but est de résister à la rotation : rien ne bouge sauf les bras.", "Laisser le corps pivoter.");
F("Russian twist", "Obliques", "Sol, poids léger",
  ["Assis, buste incliné en arrière, pieds au sol ou décollés.", "Tourne le buste d'un côté puis de l'autre.", "Garde le dos droit."],
  "Tourne les épaules, pas seulement les bras.", "Arrondir le dos.");
F("Dead bug", "—", "Sol",
  ["Allongé, bras vers le plafond, genoux pliés à 90° au-dessus des hanches.", "Tends un bras et la jambe opposée sans que le bas du dos décolle.", "Reviens, puis change de côté."],
  "Bas du dos plaqué au sol en permanence.", "Aller trop vite.");
F("Mountain climbers", "Épaules, cardio", "Sol",
  ["En position de pompe, bras tendus.", "Ramène un genou vers la poitrine, puis l'autre, en alternant vite.", "Garde les hanches basses."],
  "Bassin stable : c'est du gainage dynamique.", "Fesses trop hautes.");

/* Trouver la fiche d'un nom, même avec une précision entre parenthèses ou « léger », « lourd » */
const FICHES_ALIAS = { "Goblet squat sur box": "Goblet squat", "Tirage menton poulie": "Tirage menton", "Presse": "Presse à cuisses", "Mollets à la presse": "Mollets presse" };
const nomDeFiche = nom => {
  if (!nom) return null;
  if (FICHES[nom]) return nom;
  const court = nom.replace(/\s*\(.*\)\s*$/, "").replace(/\s+(légère|léger|lourde|lourd|lent)$/i, "").trim();
  return FICHES[court] ? court : FICHES[FICHES_ALIAS[court]] ? FICHES_ALIAS[court] : null;
};
const ficheDe = nom => FICHES[nomDeFiche(nom)] || null;

/* TECHNIQUES D'INTENSIFICATION — à utiliser avec parcimonie : sur 1 ou 2 exercices, en fin de séance. */
const TECHNIQUES = [
  { cat: "Enchaîner des exercices", nom: "Superset", bref: "Deux exercices pour le même muscle, sans repos entre les deux.",
    comment: ["Fais ta série du premier exercice.", "Enchaîne tout de suite la série du deuxième.", "Repos normal, puis recommence."],
    exemple: "Développé haltères puis écarté poulie.", quand: "Pour gagner du temps et finir un muscle.", attention: "Le deuxième exercice se fait avec moins de charge que d'habitude : c'est normal." },
  { cat: "Enchaîner des exercices", nom: "Superset antagoniste", bref: "Deux exercices pour des muscles opposés, sans repos entre les deux.",
    comment: ["Choisis deux muscles opposés : pecs et dos, biceps et triceps, quadriceps et ischios.", "Enchaîne les deux séries.", "Repos, puis recommence."],
    exemple: "Curl barre puis triceps poulie.", quand: "Pour raccourcir la séance sans perdre de force : un muscle récupère pendant que l'autre travaille.", attention: "Le plus doux des supersets : bien pour débuter." },
  { cat: "Enchaîner des exercices", nom: "Triset", bref: "Trois exercices pour le même muscle, à la suite.",
    comment: ["Prépare les trois postes avant de commencer.", "Enchaîne les trois séries sans repos.", "Repos de 2 à 3 minutes, puis recommence."],
    exemple: "Élévations latérales, oiseau, face pull.", quand: "Pour un muscle en retard, ou les épaules qui ont plusieurs faisceaux.", attention: "Très fatigant : 2 ou 3 tours suffisent." },
  { cat: "Enchaîner des exercices", nom: "Série géante", bref: "Quatre exercices ou plus pour le même muscle, à la suite.",
    comment: ["Choisis 4 à 6 exercices pour un même muscle.", "Enchaîne-les sans repos.", "Repos long, puis 1 ou 2 tours de plus."],
    exemple: "Abdos : crunch, relevé de jambes, gainage, russian twist.", quand: "Pour les abdos, les mollets ou une fin de séance.", attention: "Charges légères : la technique se dégrade vite." },
  { cat: "Enchaîner des exercices", nom: "Pré-fatigue", bref: "Un exercice d'isolation juste avant un exercice de base pour le même muscle.",
    comment: ["Fais d'abord l'exercice qui isole le muscle.", "Enchaîne sans repos l'exercice de base.", "Le muscle visé lâche avant les muscles qui aident."],
    exemple: "Leg extension puis presse à cuisses.", quand: "Quand un muscle ne travaille pas assez sur les gros exercices.", attention: "Tu seras moins fort sur l'exercice de base : baisse la charge." },
  { cat: "Enchaîner des exercices", nom: "Post-fatigue", bref: "L'inverse : l'exercice de base d'abord, l'isolation juste après.",
    comment: ["Fais ta série lourde sur l'exercice de base.", "Enchaîne un exercice d'isolation pour le même muscle.", "Repos, puis recommence."],
    exemple: "Développé couché puis pec deck.", quand: "Pour garder ta force sur le gros exercice et finir le muscle ensuite.", attention: "Garde la charge lourde sur le premier exercice." },

  { cat: "Prolonger une série", nom: "Dégressive", bref: "Arrivé à l'échec, tu baisses la charge et tu continues tout de suite.",
    comment: ["Fais ta série jusqu'à l'échec, ou presque.", "Baisse la charge de 20 à 30 %, sans repos.", "Continue jusqu'à l'échec, une ou deux fois."],
    exemple: "Triceps poulie 30 kg × 10, puis 22 kg × 8, puis 15 kg × 8.", quand: "Sur la dernière série d'un exercice à la machine ou à la poulie.", attention: "Évite-la sur squat et soulevé de terre : trop risqué quand la fatigue arrive." },
  { cat: "Prolonger une série", nom: "Rest-pause", bref: "Une série à l'échec, 15 secondes de pause, puis quelques répétitions de plus.",
    comment: ["Fais ta série jusqu'à l'échec.", "Pose la charge 10 à 20 secondes, respire.", "Reprends pour 2 à 4 répétitions, une ou deux fois."],
    exemple: "Développé machine 8 reps, 15 s, 3 reps, 15 s, 2 reps.", quand: "Pour faire plus de travail avec la même charge, en peu de temps.", attention: "Pause courte : c'est elle qui fait l'effet." },
  { cat: "Prolonger une série", nom: "Myo-reps", bref: "Une série d'activation, puis des mini-séries de 3 à 5 répétitions avec 5 respirations de pause.",
    comment: ["Fais une série de 12 à 15 répétitions, proche de l'échec.", "Prends 3 à 5 grandes respirations.", "Fais 3 à 5 répétitions, et répète tant que tu tiens ce nombre."],
    exemple: "Élévations latérales : 15, puis 4, 4, 4, 3.", quand: "Sur les petits muscles et les exercices d'isolation.", attention: "Arrête-toi dès que tu ne fais plus le nombre prévu." },
  { cat: "Prolonger une série", nom: "Répétitions forcées", bref: "Un partenaire t'aide juste assez pour faire 1 à 3 répétitions après l'échec.",
    comment: ["Va jusqu'à l'échec seul.", "Le partenaire aide légèrement pour la montée.", "Toi, tu contrôles la descente."],
    exemple: "Développé couché : 8 seul, puis 2 avec aide.", quand: "En fin de série, sur un exercice où l'aide est facile.", attention: "Demande beaucoup de récupération : pas à chaque séance." },
  { cat: "Prolonger une série", nom: "Négatives accentuées", bref: "Descente très lente, en 3 à 5 secondes.",
    comment: ["Monte la charge normalement.", "Freine la descente en comptant 3 à 5 secondes.", "Garde la tension jusqu'en bas."],
    exemple: "Tractions : monte, puis descends en 5 secondes.", quand: "Pour progresser sur un mouvement trop dur, comme les tractions, ou pour plus de stimulation.", attention: "Fait souvent plus de courbatures : commence par une seule série." },
  { cat: "Prolonger une série", nom: "Répétitions partielles", bref: "Arrivé à l'échec, tu continues sur la moitié du mouvement.",
    comment: ["Fais ta série complète jusqu'à l'échec.", "Continue avec 3 à 6 répétitions sur la partie la plus étirée du mouvement.", "Arrête quand ça ne bouge plus."],
    exemple: "Curl incliné : 10 complètes, puis 5 demi-répétitions en bas.", quand: "En fin de série, sur des exercices d'isolation.", attention: "Fais-les en position étirée. Faites seules, ces partielles donnent des résultats comparables à l'amplitude complète, pas meilleurs." },
  { cat: "Prolonger une série", nom: "Méthode 21", bref: "7 répétitions en bas, 7 en haut, 7 complètes, sans pause.",
    comment: ["7 demi-répétitions sur la moitié basse.", "7 demi-répétitions sur la moitié haute.", "7 répétitions complètes."],
    exemple: "Curl barre en 21.", quand: "Surtout pour les biceps, en fin de séance.", attention: "Prends une charge bien plus légère que d'habitude." },
  { cat: "Prolonger une série", nom: "Dégressive mécanique", bref: "Arrivé à l'échec, tu passes à une version plus facile du même mouvement.",
    comment: ["Commence par la version la plus dure.", "À l'échec, change de prise ou d'angle pour une version plus facile.", "Continue jusqu'à l'échec."],
    exemple: "Pompes déclinées, puis pompes classiques, puis pompes sur les genoux.", quand: "À la maison ou sans changer de charge.", attention: "Garde la même qualité de mouvement à chaque étape." },

  { cat: "Tempo et contraction", nom: "Pause en haut", bref: "Tenir 2 à 5 secondes à la position de contraction maximale.",
    comment: ["Monte la charge normalement.", "Bloque 2 à 5 secondes en serrant le muscle au maximum.", "Redescends en contrôle."],
    exemple: "Leg curl : tiens 3 secondes talons aux fesses.", quand: "Sur les exercices où la charge reste lourde en haut : leg curl, leg extension, élévations, rowing, mollets.", attention: "Baisse la charge de 10 à 20 %." },
  { cat: "Tempo et contraction", nom: "Contraction de 2 secondes", bref: "Serrer volontairement le muscle 2 secondes à chaque répétition.",
    comment: ["Arrivé en fin de mouvement, contracte le muscle le plus fort possible.", "Compte 2 secondes.", "Repars en contrôle."],
    exemple: "Poulie basse pecs : 2 s mains jointes en haut.", quand: "Pour mieux sentir un muscle qui « ne travaille pas ».", attention: "Ça marche surtout aux poulies et aux machines, qui gardent la tension." },
  { cat: "Tempo et contraction", nom: "Isométrie", bref: "Tenir une position fixe sous charge, sans bouger.",
    comment: ["Choisis un angle : en haut, au milieu ou en bas du mouvement.", "Tiens la position 10 à 30 secondes.", "Fais-le en fin de série ou seul."],
    exemple: "Chaise contre le mur, ou leg extension bloqué jambes tendues.", quand: "Pour finir un muscle, ou quand une articulation n'aime pas le mouvement complet.", attention: "Respire normalement : ne bloque pas ta respiration." },
  { cat: "Tempo et contraction", nom: "Pause en bas", bref: "Marquer 1 à 2 secondes d'arrêt en position étirée.",
    comment: ["Descends jusqu'en bas.", "Arrête-toi 1 à 2 secondes, sans relâcher.", "Repars sans élan."],
    exemple: "Squat avec 2 secondes en bas, mollets avec 2 secondes talons en bas.", quand: "Pour supprimer le rebond et travailler la force au départ.", attention: "Garde la tension pendant la pause : ne te repose pas." },
  { cat: "Tempo et contraction", nom: "Excentrique lent", bref: "Descendre en 3 ou 4 secondes à chaque répétition.",
    comment: ["Monte en 1 seconde.", "Descends en comptant 3 ou 4.", "Repars directement."],
    exemple: "Développé haltères : 3 secondes de descente.", quand: "Pour plus de contrôle et de stimulation avec moins de charge.", attention: "Compte vraiment : on accélère vite sans s'en rendre compte." },
  { cat: "Tempo et contraction", nom: "Répétition 1 et 1/4", bref: "Descendre en bas, remonter d'un quart, redescendre, puis remonter complètement.",
    comment: ["Descends jusqu'en bas.", "Remonte d'un quart, redescends.", "Remonte complètement : c'est une répétition."],
    exemple: "Squat ou hack squat en 1 et 1/4.", quand: "Pour insister sur la partie la plus difficile, en position étirée.", attention: "Baisse la charge : une série dure bien plus longtemps." },
  { cat: "Tempo et contraction", nom: "Tension continue", bref: "Ne jamais verrouiller ni se reposer en haut ou en bas.",
    comment: ["Arrête-toi juste avant le verrouillage en haut.", "Repars juste avant le repos en bas.", "Garde un rythme régulier."],
    exemple: "Presse à cuisses sans verrouiller les genoux.", quand: "Pour augmenter la brûlure et l'effet sur le muscle.", attention: "Charge un peu plus légère que d'habitude." },

  { cat: "Organiser les séries", nom: "Pyramide", bref: "La charge monte et les répétitions baissent à chaque série.",
    comment: ["Commence léger avec beaucoup de répétitions.", "Monte la charge à chaque série.", "Finis lourd avec peu de répétitions."],
    exemple: "12 × 60 kg, 10 × 70 kg, 8 × 80 kg, 6 × 85 kg.", quand: "Sur un exercice de base, pour s'échauffer progressivement.", attention: "Les premières séries ne doivent pas te fatiguer." },
  { cat: "Organiser les séries", nom: "Pyramide inversée", bref: "La série la plus lourde d'abord, puis la charge baisse.",
    comment: ["Échauffe-toi bien.", "Fais ta série la plus lourde quand tu es frais.", "Baisse la charge et fais plus de répétitions ensuite."],
    exemple: "6 × 85 kg, 8 × 77 kg, 10 × 70 kg.", quand: "Pour être au maximum de ta force sur la série qui compte.", attention: "Échauffement indispensable avant la première série." },
  { cat: "Organiser les séries", nom: "Série lourde puis allégée", bref: "Une série lourde, puis 1 ou 2 séries plus légères de 10 à 15 %.",
    comment: ["Fais ta série la plus lourde.", "Baisse la charge de 10 à 15 %.", "Fais 1 ou 2 séries avec plus de répétitions."],
    exemple: "Squat : 1 × 5 à 100 kg, puis 2 × 8 à 87,5 kg.", quand: "Pour combiner force et volume sur un exercice de base.", attention: "La série lourde reste propre." },
  { cat: "Organiser les séries", nom: "Cluster", bref: "Une série coupée en petits blocs, avec 15 à 30 secondes de pause.",
    comment: ["Choisis une charge lourde.", "Fais 2 ou 3 répétitions, pause de 15 à 30 secondes.", "Répète 4 ou 5 fois."],
    exemple: "Développé couché : 5 blocs de 2 répétitions.", quand: "Pour soulever lourd plus longtemps, avec une technique propre.", attention: "Repose la charge pendant les pauses." },
];
const CATEGORIES_TECH = [...new Set(TECHNIQUES.map(t => t.cat))];
