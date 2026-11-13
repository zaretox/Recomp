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

Le bouton + (« Que veux-tu faire ? ») et les réglages sont dans `reglages.js`.

Sous le bandeau, Sport, Repas, Argent et Corps sont découpés en rubriques (barre `SousOnglets` de `kit.js`, qui reste collée en haut). La première est celle du quotidien ; la dernière ouverte est retenue dans `localStorage` (`recomp_rubrique_<onglet>`, simple confort d'affichage, hors sauvegarde).

| Onglet | Rubriques |
| --- | --- |
| Sport | Semaine (jours, séances, séries par muscle, semaine légère et mode récup) · Progrès (tonnage, records, max estimés, natation) · Historique (par semaine, filtre Muscu / Natation / Cardio) · Programmes (programme suivi, natation, bibliothèque, douleurs) |
| Repas | Aujourd'hui (repas à cocher, hors menu) · Ma cible (cible, 7 derniers jours, dépense réelle, réglages) · Courses |
| Argent | Budget · Épargne · Opérations · Tendances |
| Corps | Poids (courbe, objectif, dernières pesées) · Forme (score, facteurs, sommeil) · Mesures (composition, mensurations, photos) |

Les feuilles « Ta forme », « Ta cible », « Courses » et « Mes programmes » existent toujours (coach, recherche, Réglages) et affichent le même contenu que la rubrique : `ContenuForme`, `ContenuCalories`, `ContenuCourses`, `ContenuProgrammes`.

## Carte des fichiers

Tout est à la racine, sauf `vendor/` et `netlify/functions/`. Pas d'autre sous-dossier : l'envoi par la page web de GitHub les perd. Les fichiers sont nommés par rôle :

| Fichiers | Rôle |
| --- | --- |
| `stockage.js`, `base.js` | IndexedDB ; `h()`, le magasin `DB`, les dates et les formats. |
| `programmes.js`, `fiches.js`, `repas.js`, `libelles.js`, `courses.js` | Données pures : programmes, fiches d'exercices et techniques, menus, listes, prix. Aucune logique. |
| `programme.js`, `entrainement.js`, `nutrition.js`, `recuperation.js`, `argent.js`, `coach.js` | Tous les calculs, sans interface. |
| `kit.js`, `pave.js`, `graphiques.js`, `schemas.js`, `mouvements.js`, `repos.js` | Briques d'écran : pavé numérique, courbes, schémas animés d'exercices (moteur dans `schemas.js`, un schéma par exercice dans `mouvements.js`), minuteur. |
| `jour.js`, `seance.js`, `sport.js`, `corps.js`, `reglages.js`, `ecran-*.js` | Les écrans. |
| `app.js` | Onglets, pile de feuilles, démarrage. |
| `app.css` | Tout le style, avec un sommaire en tête. |
| `sw.js` | Hors ligne et mises à jour. |
| `vendor/` | React 18 (ne pas toucher). |
| `polar.js`, `polar-retour.html`, `netlify/functions/polar.mjs` | Liaison avec la montre Polar (service AccessLink). La fonction Netlify garde la clé secrète, lue dans les variables `POLAR_CLIENT_ID` et `POLAR_CLIENT_SECRET`, et ne stocke rien. Elle envoie aussi les notifications « séance arrivée » et « nuit arrivée » : Polar l'appelle (webhook) et l'adresse de notification de l'iPhone voyage dans l'adresse de ce webhook ; les clés de notification sont tirées de `POLAR_CLIENT_SECRET`. `sw.js` affiche la notification et ouvre le bon écran. `polar-retour.html` est la page où Polar renvoie après l'accord. `ecran-sorties.js` affiche les séances de la montre (carte OpenStreetMap, FC, allure, tours au km). |
| `banque.js`, `banque-retour.html`, `cle-banque.html`, `netlify/functions/banque.mjs` | Liaison bancaire en lecture seule (Enable Banking). La fonction garde la clé privée (variables `EB_APP_ID` et `EB_PRIVATE_KEY`), ne relaie que des lectures et ne stocke rien. `cle-banque.html` lit le fichier .pem sur le téléphone (sans réseau) et prépare les deux valeurs à coller dans Netlify. Les opérations importées portent le champ `banque` (référence) pour éviter les doublons ; une dépense notée à la main au même montant, à 3 jours près, est fusionnée ; une paye notée à la main (5 jours, 5 %) et une charge fixe cochée à la main (même période) laissent la place à l'opération de la banque. Les paiements en cours (`attente`) sont comptés et relus à chaque import ; `brut` garde le libellé d'origine. « Vérifier mes comptes » (Argent → Détails) donne un diagnostic à copier. |
| `manifest.json` | Ton fichier, à garder dans le dépôt. |

Deux noms ne doivent jamais se répéter : un fichier à la racine en écrase un autre du même nom.

Les scripts sont chargés dans l'ordre par `index.html` et partagent la même portée : une fonction d'un fichier est visible des suivants. Si tu ajoutes un fichier, ajoute-le aussi à `index.html` et à `FICHIERS` dans `sw.js`.

## Les moteurs

- `programme.js` : programme actif, séance d'un jour, import de texte (`lireProgramme`).
- `entrainement.js` : `progression()` décide de la prochaine charge, `proposition()` ajoute les réglages et la semaine légère. Natation à la fin du fichier.
- `nutrition.js` : `objectifs()` (poids → masse maigre → cible → macros), `menuDuJour()`, `jourNutrition()`, `tendancePoids()`, `depenseReelle()`.
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

Nouvelles clés : `fin-fixes` (charges fixes), `courses-etat` (liste de courses en cours) `polar-lien` (jeton de la montre Polar : `{ jeton, utilisateur, depuis, expire, notifs }`, jamais mis dans la sauvegarde) `banque-lien` (accès bancaire : `{ session, comptes, compte, banque, depuis, expire, derniere, solde }`, jamais mis dans la sauvegarde), `banque-regles` (`{ regles: [{ motif, cat }], ignores: [ref], recurrentsIgnores: [commerce] }`), `notes-exos` (une note par exercice : `{ nom: texte }`), `epargne` (cagnottes `{ id, nom, cible }`, versements `{ id, dateISO, montant, source, ref? }`, `virement`, `palier`, `gardes` ; le montant par paye reste dans `fin-goal`) et `polar-seances` (séances importées de la montre : résumé, parcours allégé `trace`, courbes `fc`/`vit`/`alt` en `{ pas, v }`, `tours` au km ou aux 100 m en natation (`{ n, d, s, fc }`), `zones` de FC ; en natation, `fit` (fichier détaillé lu ou non), `bassin` (m) et `longueurs` : `[début (s), durée (s), coups de bras, nage, active]` ; une séance retirée devient `{ id, supprime: true }` pour ne pas revenir).

Champs ajoutés, que l'ancienne version ignore : `startedAt`, `endedAt`, `swaps`, `finisher`, `ajouts` (exercices ajoutés en cours de séance), `retires` (exercices retirés pour la séance) dans `sport-logs`, et `aide` (contrepoids) et `pc` (poids du corps) dans les séries des exercices assistés, dont `w` est alors la charge soulevée ; `tags` dans `recup-logs` ; `mealScale` dans `nutri-logs` ; `fixId` dans `fin-expenses` ; `paye` dans `fin-income` (ce revenu ouvre une période de budget) ; `banque` dans `fin-expenses` et `fin-income` (référence de l'opération bancaire) ; `polarId` dans `natation-logs` (nage ajoutée depuis la montre) ; `depense` dans `nutri-cal-cfg` ; `objectifKg`, `theme`, `discret`, `faceId` (identifiant de la clé d'accès Face ID) et `faceIdActif` dans `profil`.

La sauvegarde garde le même format de fichier : une sauvegarde de l'ancienne version se restaure ici, et inversement.

## Design

L'affiche de nuit : fond noir teinté par la section, aplats de couleur pleine, grands chiffres. Couleurs et tailles sont des variables en haut de `app.css`. Polices : Anton pour les chiffres et les titres, Archivo pour le texte.

Le détail des choix (gardé, fondu, retiré, nouveau) est dans `ARBITRAGES.md`.
