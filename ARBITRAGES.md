# RECOMP : arbitrages de la refonte

40 tuiles et 30 onglets deviennent 5 écrans. 12 fonctions gardées, 15 fondues, 9 retirées, 17 nouveautés.

## Gardé

| Fonction | Pour | Contre | Où |
| --- | --- | --- | --- |
| Séance à cocher et minuteur | C'est le geste principal de l'app. Chaque série est écrite aussitôt, rien ne se perd. | Aucun. | Sport, en plein écran. Le haut de l'écran devient le minuteur pendant le repos. |
| Moteur de progression | Décide charge et reps sans réglage, en tenant compte de l'historique. | Le cycle de fourchettes était opaque. | Dans la séance : une phrase du coach sur chaque exercice explique la décision. |
| Score de récupération | Votre meilleure idée : il croise montre, charge, repas et douleurs, ce qu'aucune appli du marché ne fait seule. | La saisie du matin pesait. | Jour et Corps. Quatre chiffres au pavé, et le détail de chaque facteur reste consultable. |
| Coach | Vous l'avez demandé. Il transforme les données en décisions. | Il était noyé dans le sommaire. | En tête de Jour. Il propose aussi la semaine légère, le recalage des repas, l'heure de coucher et la sauvegarde. |
| Calories et menu qui s'ajuste | Le calcul poids → masse maigre → cible → portions est juste et unique. | Réparti sur quatre onglets. | Repas, plus une feuille « Ta cible ». |
| Programmes et import de texte | Liberté totale : PPL, maison, perso, texte collé. | Aucun. | Sport → Mes programmes. |
| Natation | Séances types, records, calories ajoutées à la cible. | Saisie de la durée pénible sans « : ». | Sport → Natation. La durée se tape 3, 8, 3, 0 pour 38:30. |
| Douleurs | Protège le genou et le pied, relié à la séance et au score. | Écran isolé. | Bouton + pour noter, alerte directement sur l'exercice concerné. |
| Mensurations, composition, photos | Le seul vrai contrôle d'une recomposition. | Trois sous-onglets. | Corps, sur une seule page. |
| Finances | Revenus, dépenses, plafonds, objectif d'épargne. | Trois modes pour une seule question. | Argent, autour d'un seul chiffre. |
| Sauvegarde et calendrier | Vos données ne vivent que sur le téléphone : indispensable. | Aucun. | Réglages. Même format de fichier, le coach rappelle la sauvegarde après 7 jours. |

## Fondu

| Avant | Devient | Pourquoi |
| --- | --- | --- |
| Log + Aujourd'hui + Historique + Graphiques de séance | Une seule séance et une seule fiche d'exercice | Il existait trois façons de saisir la même chose. |
| Suivi nutrition + Repas du jour + Résumé | L'onglet Repas | La même liste de repas à cocher apparaissait à trois endroits. |
| Journal alimentaire | « Hors menu », avec récents et calories directes | Les repas du plan se cochent, seul l'imprévu se saisit. |
| Plan RM | La fiche d'exercice : max estimé, tableau des %, courbe | On le consulte au moment où on en a besoin. |
| Calculateur de disques | La fiche d'exercice, pré-rempli avec la charge du jour | Il ne sert que devant la barre. |
| Alternatives en cas de douleur | Un vrai remplacement d'exercice pour la séance | C'était du texte, c'est maintenant une action. |
| Surcharge (Science) | Automatique dans la séance | Appliquer une hausse à la main faisait doublon avec le moteur. Vos anciens réglages restent lus. |
| Bilan (Science) et bilan du dimanche | Le bilan de la semaine en plein écran | Une décision par semaine, en un seul endroit. |
| Projection | Objectif de poids dans Corps | La date d'arrivée s'affiche sans avoir à la demander. |
| Planning | La journée à cocher de l'écran Jour | Le planning est devenu la liste d'actions. |
| Phases S1-4… | Réglages, pour un exercice jamais fait | Dès qu'un historique existe, le moteur fait mieux. |
| Résumé, Aliments, Alternatives et Suivi du Budget | La liste de courses | Quatre onglets autour d'un même besoin. |
| Équivalences alimentaires | Toucher un aliment dans un repas | Utile au moment précis où il manque un ingrédient. |
| Compléments, eau, sommeil, stress | Ligne à cocher sur Jour, et saisie du matin | Plus de formulaire de fin de journée. |
| 40 tuiles et recherche | 5 onglets et le bouton + | La recherche compensait un rangement trop dense. Elle reste dans le bouton +. |

## Retiré

| Fonction | Pourquoi |
| --- | --- |
| Résumé et Conseils (6 onglets) | Texte figé, lu une fois. Vos règles genou et pied restent dans Douleurs, et les notes sur chaque exercice. |
| Lexique | Les termes sont remplacés par des mots simples : difficulté, max estimé, semaine légère. |
| Curseur de stress 1 à 10 | Il n'entrait dans aucun calcul. Il devient une case à cocher, qui compte vraiment. |
| Graphiques de compliance et de stress | Jolis mais sans décision derrière. Le mur de régularité dit la même chose d'un coup d'œil. |
| Passage maison → salle | Critère à usage unique, déjà franchi. Le programme Maison reste disponible. |
| Plan linéaire sur 16 semaines | Il calculait des charges différentes de celles du moteur : deux vérités pour une séance. |
| Listes « à privilégier » et « retirés » | Figées, et le menu les applique déjà. |
| Pile d'affiches à faire glisser | Élégante mais lente à manier : chaque action demandait d'ouvrir, de défiler, de refermer. |
| Emojis dans l'interface | Remplacés par un jeu d'icônes dessinées. |
| Prises de sang | Retirées à la demande d'Aurélien : elles n'entraient dans aucun calcul, et le labo garde déjà l'historique. La clé `bilans` reste, avec ses valeurs éventuelles, et part toujours dans la sauvegarde. |

## Nouveau

| Fonction | Vu chez | Ce que ça change |
| --- | --- | --- |
| Pavé numérique maison | Strong | Touche +/− pour le signe. Les durées se tapent comme sur un micro-ondes : 7, 4, 5 donne 7 h 45. Le clavier du téléphone ne s'ouvre plus pour aucun chiffre. |
| Pesée à la règle | Applis de santé | On fait glisser, sans taper, avec ±0,1 kg en deux touches. |
| Tendance de poids | MacroFactor | Le chiffre affiché ignore les variations d'eau. Les pesées brutes restent visibles en points. |
| Dépense réelle | MacroFactor | Calculée depuis ce que vous mangez et l'évolution de la tendance, puis adoptable en un geste. Elle remplace la formule théorique. |
| Repas restants recalés | MacroFactor | Un extra de 500 kcal réduit les prochains repas, grammes à l'appui. |
| Bilan de la semaine | Whoop, MacroFactor | Six écrans à toucher, et une seule décision à la fin. |
| Ce qui joue sur votre forme | Whoop Journal | Cases Alcool, Stress, Repas tardif… L'app compare ensuite vos matins : par exemple +13 points après une bonne nuit. |
| Dette de sommeil et coucher conseillé | Oura, Whoop | Le soir, le coach donne l'heure de coucher pour tenir 8 h. |
| Reste à vivre | YNAB | Un seul chiffre : ce que vous pouvez dépenser, par jour, jusqu'à la fin du mois. |
| Charges fixes à cocher | YNAB | Loyer, salle, abonnements : saisis une fois, cochés chaque mois. |
| Courses calculées | Propre à RECOMP | Les quantités viennent de vos vrais menus. On coche en magasin, on note le ticket, il part dans Argent. |
| Fiche d'exercice | Hevy, Strong | Courbe du max, records, dernières séances, tableau des %. |
| Échauffement calculé | Strong | Trois séries de montée d'après la charge du jour, pour ménager les tendons. |
| Bilan de fin de séance | Hevy | Tonnage, durée, comparaison avec la dernière fois, records. |
| Comparateur de photos | Applis de suivi | Un trait à faire glisser entre deux dates. |
| Écran toujours allumé | Strong | Pendant la séance, le téléphone ne se verrouille plus. Non vérifié sur iPhone. |
| Thèmes Nuit et Papier | — | Nuit par défaut, Papier pour retrouver le clair. |
| Sorties de la montre | Strava, Polar Flow | Parcours sur carte, km, allure, FC, zones, tours au km. Import à la demande ou tout seul en ouvrant Sport (au plus toutes les 30 min). Même détail dans une séance de muscu de la salle (séance de la montre du même jour, la plus proche de l'heure de début) et en natation, où une nage de la montre peut être ajoutée à tes séances. N'entre pas dans le score de forme. Le fond de carte (OpenStreetMap) demande du réseau ; le tracé s'affiche sans. |
| Longueurs de natation | Polar Flow, Garmin | Longueurs, SWOLF, coups de bras, séries et repos lus dans le fichier FIT de la séance, et comparaison « prévu / fait » avec une séance type. Vérifié sur un fichier fabriqué avec l'outil officiel de Garmin, pas encore sur une vraie nage de la Vantage M. |
| Progrès en natation | Applis de course | Meilleurs temps sur 100 m à 1 500 m, mètres par semaine, allure aux 100 m au fil des semaines. Mêle les nages notées à la main et celles de la montre. |
| Saisie du matin depuis Polar | Polar Flow | Un bouton lit la Recharge nocturne (SNA, VFC, FC) et le sommeil. Validé par Aurélien : les données passent par une fonction Netlify à lui, qui ne garde rien ; le jeton reste sur le téléphone. |

## Écarté

| Idée | Pourquoi |
| --- | --- |
| Scan de code-barres | Il faut une bibliothèque de lecture et des essais sur un vrai iPhone. Je préfère ne pas livrer ce que je ne peux pas tester. |
| Lecture automatique de la banque | Il faudrait un serveur : vos données quitteraient le téléphone. |
| Rappels à heure fixe (repas, coucher) | Il faudrait un serveur qui connaisse tes horaires. Le calendrier .ics reste la solution fiable. Seules les notifications « séance arrivée » et « nuit arrivée » de la montre Polar existent, validées par Aurélien. |
| Réseau social, défis, niveaux | Vous ne vouliez ni niveaux ni démarrage en questions, et rien de tel n'a été ajouté. |

## Pas vérifié

- Rien n'a tourné sur un vrai iPhone. Le test s'est fait au format téléphone dans le navigateur intégré. Restent à essayer en vrai : le retour haptique, le son du minuteur et l'écran allumé.
- Je n'ai pas eu accès à vos vraies données, qui sont sur votre téléphone. Les tests ont utilisé 11 semaines de données fictives au format exact de l'ancienne app.
- Votre manifest.json n'était pas dans le dossier : il faudra le garder en place dans le dépôt. L'icône reste celle de l'ancienne version.
