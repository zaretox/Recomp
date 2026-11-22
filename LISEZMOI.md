# RECOMP

PWA personnelle : sport, nutrition, argent, corps. React 18 sans étape de compilation, données sur le téléphone uniquement.

Cinq onglets, cinq questions :

| Onglet | Question | Fichier |
| --- | --- | --- |
| Jour | Qu'est-ce que je fais maintenant ? | `jour.js` |
| Sport | Qu'est-ce que je soulève ? | `sport.js`, `seance.js`, `ecran-programmes.js` |
| Repas | Qu'est-ce que je mange ? | `ecran-repas.js` |
| Argent | Combien il me reste ? | `ecran-argent.js` |
| Corps | Est-ce que ça marche ? | `corps.js` |
| Coach | Qu'est-ce que tu en penses ? | `ecran-coach.js` (le coach habituel est calculé dans `coach.js`) |

Le bouton + (« Que veux-tu faire ? ») et les réglages sont dans `reglages.js`. Il est masqué sur l'onglet Coach, où le bas de l'écran sert à écrire. Jour ne montre du coach qu'un aperçu (`ApercuCoach`) qui ouvre l'onglet Coach.

Sous le bandeau, Sport, Repas, Argent et Corps sont découpés en rubriques (barre `SousOnglets` de `kit.js`, qui reste collée en haut). La première est celle du quotidien ; la dernière ouverte est retenue dans `localStorage` (`recomp_rubrique_<onglet>`, simple confort d'affichage, hors sauvegarde).

| Onglet | Rubriques |
| --- | --- |
| Sport | Semaine (jours, séances, séries par muscle, semaine légère et mode récup) · Progrès (tonnage, records, max estimés, natation) · Historique (par semaine, filtre Muscu / Natation / Cardio) · Programmes (programme suivi, natation, bibliothèque, douleurs) |
| Repas | Aujourd'hui (repas à cocher, hors menu) · Ma cible (cible, 7 derniers jours, dépense réelle, réglages) · Courses |
| Argent | Budget · Épargne · Opérations · Tendances |
| Corps | Poids (courbe, objectif, dernières pesées) · Forme (score, facteurs, sommeil) · Mesures (composition, mensurations, photos) |

Polar à l'ouverture de Jour et au retour dans l'app (au plus toutes les 5 min, `synchroPolarJour`), et juste avant chaque réponse du coach IA si la dernière lecture a plus d'une minute (`relireMontre`, 8 s d'attente au plus) : pas, nuits, Recharge nocturne et charge cardio, et les séances de la montre (au plus toutes les 30 min). Une nage de la montre d'aujourd'hui ou d'hier rejoint seule `natation-logs` (`ajouterNagesAuto`, champ `auto: true`, calories de la montre) sauf si une nage est déjà notée ce jour-là ; la séance de la montre porte alors `natAuto: true` pour ne pas être rajoutée. Noter une nage à la main le même jour corrige celle de la montre au lieu d'en ajouter une deuxième. Corrigée dans « Corriger la nage », elle garde les calories de la montre tant que la distance et la durée ne changent pas, et perd `auto` (c'est devenu ta nage). Sur Jour, une nage de la montre se place à l'heure où elle a été faite. Une séance de muscu ou un circuit de la montre est relié à la séance notée le même jour, à la salle (`sport-logs`) ou à la maison (`maison-logs`), par `logDeSortie` : il n'apparaît qu'une fois dans l'Historique et ne compte qu'une fois. Si la nuit du jour est là, la forme du matin se remplit seule (`matinAuto`, champ `auto: "polar"` dans `recup-logs`) ; une saisie faite à la main n'est jamais touchée. Réglages → Montre Polar montre « Ce que ta montre donne » (état dans `localStorage`, `recomp_polar_etat`).

Mise à jour : à chaque ouverture et à chaque retour au premier plan (au plus toutes les 10 min), le service worker retélécharge tous les fichiers, tout ou rien. S'il a trouvé du nouveau, il prévient la page, qui affiche le bandeau « Nouvelle version de RECOMP prête · Afficher » (`PastilleMaj`, `verifierMaj` dans `kit.js`). Réglages → « Mettre à jour » force la vérification puis recharge.

Les catégories de dépenses sont une seule liste, `CATEGORIES` dans `libelles.js`, utilisée partout (classement, filtres, budget, plafonds). On peut en ajouter, jamais en renommer : les opérations gardent le nom de leur catégorie. Les règles de classement automatique sont `REGLES_DEFAUT` dans `banque.js`.

Les feuilles « Ta forme », « Ta cible », « Courses » et « Mes programmes » existent toujours (coach, recherche, Réglages) et affichent le même contenu que la rubrique : `ContenuForme`, `ContenuCalories`, `ContenuCourses`, `ContenuProgrammes`.

## Carte des fichiers

Tout est à la racine, sauf `vendor/` et `netlify/functions/`. Pas d'autre sous-dossier : l'envoi par la page web de GitHub les perd. Les fichiers sont nommés par rôle :

| Fichiers | Rôle |
| --- | --- |
| `stockage.js`, `base.js` | IndexedDB ; `h()`, le magasin `DB`, les dates et les formats. Si iOS a coupé la connexion à la base (app restée en arrière-plan), elle est rouverte et l'écriture retentée une fois. Si la base ne répond toujours pas, la valeur attend dans `localStorage` (`recomp_attente:<clé>`) et rejoint la base au démarrage suivant. Chaque incident est noté dans `recomp_journal_stockage`, visible dans Réglages → Sauvegarde et données avec l'espace utilisé. |
| `programmes.js`, `fiches.js`, `repas.js`, `libelles.js`, `courses.js` | Données pures : programmes, fiches d'exercices et techniques, menus, listes, prix. Aucune logique. |
| `programme.js`, `entrainement.js`, `nutrition.js`, `recuperation.js`, `argent.js`, `coach.js` | Tous les calculs, sans interface. |
| `kit.js`, `pave.js`, `graphiques.js`, `schemas.js`, `mouvements.js`, `repos.js` | Briques d'écran : pavé numérique, courbes, schémas animés d'exercices (moteur dans `schemas.js`, un schéma par exercice dans `mouvements.js`), minuteur. |
| `jour.js`, `seance.js`, `sport.js`, `corps.js`, `reglages.js`, `ecran-*.js` | Les écrans. |
| `verifier.cjs` | Pas dans l'app : la vérification avant publication (`node verifier.cjs`, voir `CLAUDE.md`). Il vérifie les règles du dépôt, la syntaxe et les noms en double. Il dit où se voit ce qui a changé depuis la version en ligne. Il ouvre chaque écran au format iPhone, app vide puis remplie, avec la montre et le coach imités. Options : `--depuis <commit>`, `--sans-navigateur`, `--captures <dossier>`, `--tout` (tout revérifier : code en double ou mort, carte des données, mêmes chiffres partout, trois heures de la journée), `--textes <fichier>`. |
| `app.js` | Onglets, pile de feuilles, démarrage. |
| `app.css` | Tout le style, avec un sommaire en tête. |
| `sw.js` | Hors ligne et mises à jour. |
| `vendor/` | React 18 (ne pas toucher). |
| `polar.js`, `polar-retour.html`, `netlify/functions/polar.mjs` | Liaison avec la montre Polar (service AccessLink). La fonction Netlify garde la clé secrète, lue dans les variables `POLAR_CLIENT_ID` et `POLAR_CLIENT_SECRET`, et ne stocke rien. Elle envoie aussi les notifications « séance arrivée » et « nuit arrivée » : Polar l'appelle (webhook) et l'adresse de notification de l'iPhone voyage dans l'adresse de ce webhook ; les clés de notification sont tirées de `POLAR_CLIENT_SECRET`. `sw.js` affiche la notification et ouvre le bon écran. `polar-retour.html` est la page où Polar renvoie après l'accord. `ecran-sorties.js` affiche les séances de la montre (carte OpenStreetMap, FC, allure, tours au km). |
| `coach.js` (fin du fichier), `netlify/functions/coach.mjs` | Coach IA : Claude (modèle `claude-opus-5-5`) appelé par la fonction Netlify, qui garde la clé (`ANTHROPIC_API_KEY`) et vérifie le code d'accès créé dans l'app (`COACH_CODE`, en-tête `x-coach-code`) ; `ANTHROPIC_WORKSPACE_ID` facultatif pour une clé non liée à un espace. La fonction ne garde rien et relaie la réponse au fil de l'eau. `contexteCoach()` prépare le résumé envoyé (forme, nuits, charge, poids, repas, séances, natation, pas ; jamais rien du budget, ni les messages d'argent du coach habituel). Le coach propose des actions sous la forme `[[action:nom]]` (`ACTIONS_COACH`), affichées en boutons. Mot du matin automatique une fois par jour, conversation dans l'onglet Coach (`ecran-coach.js` : état partagé `EtatCoach`, dictée par la reconnaissance vocale du téléphone, `useDictee`, sinon le micro du clavier), mot de la semaine dans le bilan. L'argent ne part que sur demande (« Parler de mon argent », ou « En parler au coach » dans Argent → Budget), en pourcentages seulement (`argentEnPourcentages`), pour la conversation du jour ; le message porte `argent: true`. Chaque question est envoyée avec son heure en tête (`content` : « [HH:MM] question », `affiche` : la question seule). Le résumé est refait à chaque question, sans l'heure (`contexteCoach(false)`) : il ne change que si les données changent, ce qui garde le cache de la conversation. La partie charge dit de quel jour sont les chiffres (fatigue et tolérance, les mots de la montre). Pas de paquet npm : appel HTTP direct. Mise en place : Réglages → Coach IA. |
| `banque.js`, `banque-retour.html`, `cle-banque.html`, `netlify/functions/banque.mjs` | Liaison bancaire en lecture seule (Enable Banking). La fonction garde la clé privée (variables `EB_APP_ID` et `EB_PRIVATE_KEY`), ne relaie que des lectures et ne stocke rien. `cle-banque.html` lit le fichier .pem sur le téléphone (sans réseau) et prépare les deux valeurs à coller dans Netlify. Les opérations importées portent le champ `banque` (référence) pour éviter les doublons ; une dépense notée à la main au même montant, à 3 jours près, est fusionnée ; une paye notée à la main (5 jours, 5 %) et une charge fixe cochée à la main (même période) laissent la place à l'opération de la banque. Les paiements en cours (`attente`) sont comptés et relus à chaque import ; `brut` garde le libellé d'origine. « Vérifier mes comptes » (Argent → Détails) donne un diagnostic à copier. |
| `manifest.json` | Ton fichier, à garder dans le dépôt. |

Deux noms ne doivent jamais se répéter : un fichier à la racine en écrase un autre du même nom.

Les scripts sont chargés dans l'ordre par `index.html` et partagent la même portée : une fonction d'un fichier est visible des suivants. Si tu ajoutes un fichier, ajoute-le aussi à `index.html` et à `FICHIERS` dans `sw.js`.

## Les moteurs

- `programme.js` : programme actif, séance d'un jour, import de texte (`lireProgramme`).
- `entrainement.js` : `progression()` décide de la prochaine charge, `proposition()` ajoute les réglages et la semaine légère. Natation à la fin du fichier.
- `nutrition.js` : `objectifs()` (poids → masse maigre → cible → macros), `menuDuJour()`, `jourNutrition()`, `tendancePoids()`, `depenseReelle()`.
  **Calcul par séance** (depuis le 22 novembre 2026, champ `seances: true` dans `nutri-cal-cfg` et dans l'historique `nutri-cal-historique`) :
  cible du jour = dépense sans séances + calories des séances du jour − objectif, jamais sous le métabolisme de base. La dépense sans séances
  est la formule (activité hors séances), ou la dépense mesurée adoptée moins `seancesDepense` (kcal de séances par jour contenues dedans,
  `seancesMoyennes`). `seancesDu(iso)` liste les séances du jour : muscu (salle, maison, ou séance de force de la montre ; kcal de la montre
  reliée, sinon `kcalMuscuEstimee`), nage (`natation-logs`), course et vélo de la montre ; la marche non (elle est dans les pas). Une muscu
  prévue (jour d'entraînement) ou une nage prévue comptent dès le matin, estimées, jusqu'à ce que la vraie séance arrive. Les jours d'avant
  le passage gardent l'ancien calcul (−400 kcal au repos, nage ajoutée) : ce qui a été mangé ne se réécrit pas.
- `recuperation.js` : `recuperation(iso)` calcule le score, `sommeil()` la dette, `influences()` ce qui joue sur la forme.
- `argent.js` : `periodes()` (d'une paye à la suivante), `bilanPeriode()` et `bilanCourant()` (reste à vivre), `listeCourses()`.
- `coach.js` : `messagesCoach()`, `repondre()`, `bilanSemaine()`, `regularite()`.

## Comment ça marche

- `DB.get(clé)` lit en mémoire, tout de suite. `DB.set(clé, valeur)` écrit sur le disque et redessine les écrans.
- Un écran appelle `useDB()` pour se mettre à jour tout seul.
- Ouvrir un écran par-dessus : `Nav.sheet("nom", props)`. Les noms sont dans `FEUILLES`, dans `app.js`.
- Demander un chiffre : `await saisir({ titre, valeur, mode, unite, pas })`. Les modes sont `ent`, `dec`, `signe`, `hm` et `ms`. Jamais de champ `<input>` pour un nombre.

## Mise en ligne

Pousse les fichiers sur GitHub, Netlify publie. À l'ouverture suivante, l'app télécharge tous les fichiers en arrière-plan. Ils remplacent les anciens d'un seul bloc, uniquement s'ils sont tous arrivés. La nouvelle version apparaît donc à l'ouverture d'après, et incrémenter `VERSION` dans `sw.js` n'est plus nécessaire pour une mise à jour courante. Si un fichier manque en ligne, la mise à jour s'arrête et la version en place continue de marcher.

## Clés de stockage

Inchangées : `sport-logs`, `maison-logs`, `nutri-logs`, `food-log`, `foods-custom`, `mensurations`, `photos-index` + `photo:<id>`, `douleur-logs`, `budget-logs`, `fin-income`, `fin-expenses`, `fin-caps`, `fin-goal`, `nutri-cal-cfg`, `science-config`, `sport-phase`, `profil`, `repas-alts`, `taille-corps`, `last-export`, `programmes`, `exos-perso`, `natation-modeles`, `natation-logs`, `recup-logs`, `bilans` (plus affichée dans l'app, gardée telle quelle).

Nouvelles clés : `fin-fixes` (charges fixes), `courses-etat` (liste de courses en cours) `polar-lien` (jeton de la montre Polar : `{ jeton, utilisateur, depuis, expire, notifs }`, jamais mis dans la sauvegarde) `banque-lien` (accès bancaire : `{ session, comptes, compte, banque, depuis, expire, derniere, solde }`, jamais mis dans la sauvegarde), `banque-regles` (`{ regles: [{ motif, cat }], ignores: [ref], recurrentsIgnores: [commerce] }`), `notes-exos` (une note par exercice : `{ nom: texte }`), `epargne` (cagnottes `{ id, nom, cible }`, versements `{ id, dateISO, montant, source, ref? }`, `virement`, `palier`, `gardes` ; le montant par paye reste dans `fin-goal`) `nutri-cal-historique` (réglages de la cible au fil du temps : `[{ depuis, depense, deficit, activity, cible?, devine? }]` ; un jour passé se recalcule avec les réglages de ce jour-là, via `objectifsAu(iso)` ; seule `majCalories()` modifie `nutri-cal-cfg`), le champ `kcalRepas` ajouté dans `nutri-logs` (calories de chaque repas coché, figées au moment où il est coché), `polar-nuits` (nuits lues chez Polar, par jour du réveil : `{ debut, fin, leger, profond, paradoxal, interruptions, score, chargeSommeil, cycles, continuite, ans, recharge, vfc, fc, respiration, lu }`), `polar-charge` (charge cardio Polar par jour : `{ charge, statut, ratio, effort, tolerance, lu }`), `coach-lien` (coach IA : `{ code, actif }`, jamais mis dans la sauvegarde ; un ancien champ `budget` n'est plus lu), `coach-ia` (textes du coach IA : `{ matin: { jour, texte }, bilan: { semaine, texte }, fil: { jour, contexte, messages } }`), `polar-pas` (pas de chaque jour lus chez Polar : `{ "AAAA-MM-JJ": { pas, kcal, actives, actif (s), km, lu } }`, relus au plus tous les quarts d'heure en ouvrant Jour, Sport ou l'app ; l'objectif est `objectifPas` dans `profil`, 8 000 par défaut) et `polar-seances` (séances importées de la montre : résumé, parcours allégé `trace`, courbes `fc`/`vit`/`alt` en `{ pas, v }`, `tours` au km ou aux 100 m en natation (`{ n, d, s, fc }`), `zones` de FC ; en natation, `fit` (fichier détaillé lu ou non), `bassin` (m) et `longueurs` : `[début (s), durée (s), coups de bras, nage, active]` ; une séance retirée devient `{ id, supprime: true }` pour ne pas revenir).

Champs ajoutés, que l'ancienne version ignore : `startedAt`, `endedAt`, `swaps`, `finisher`, `ajouts` (exercices ajoutés en cours de séance), `retires` (exercices retirés pour la séance) dans `sport-logs`, et `aide` (contrepoids) et `pc` (poids du corps) dans les séries des exercices assistés, dont `w` est alors la charge soulevée ; `tags` dans `recup-logs` ; `mealScale` dans `nutri-logs` ; `fixId` dans `fin-expenses` ; `paye` dans `fin-income` (ce revenu ouvre une période de budget) ; `banque` dans `fin-expenses` et `fin-income` (référence de l'opération bancaire) ; `polarId` dans `natation-logs` (nage ajoutée depuis la montre) ; `depense` dans `nutri-cal-cfg` ; `objectifKg`, `theme`, `discret`, `faceId` (identifiant de la clé d'accès Face ID) et `faceIdActif` dans `profil`.

La sauvegarde garde le même format de fichier : une sauvegarde de l'ancienne version se restaure ici, et inversement.

## Design

L'affiche de nuit : fond noir teinté par la section, aplats de couleur pleine, grands chiffres. Couleurs et tailles sont des variables en haut de `app.css`. Polices : Anton pour les chiffres et les titres, Archivo pour le texte.

Le détail des choix (gardé, fondu, retiré, nouveau) est dans `ARBITRAGES.md`.
