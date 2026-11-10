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

## Carte des fichiers

Tout est à la racine, sauf `vendor/`. Pas de sous-dossier : l'envoi par la page web de GitHub les perd. Les fichiers sont nommés par rôle :

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
| `manifest.json` | Ton fichier, à garder dans le dépôt. |

Deux noms ne doivent jamais se répéter : un fichier à la racine en écrase un autre du même nom.

Les scripts sont chargés dans l'ordre par `index.html` et partagent la même portée : une fonction d'un fichier est visible des suivants. Si tu ajoutes un fichier, ajoute-le aussi à `index.html` et à `FICHIERS` dans `sw.js`.

## Les moteurs

- `programme.js` : programme actif, séance d'un jour, import de texte (`lireProgramme`).
- `entrainement.js` : `progression()` décide de la prochaine charge, `proposition()` ajoute les réglages et la semaine légère. Natation à la fin du fichier.
- `nutrition.js` : `objectifs()` (poids → masse maigre → cible → macros), `menuDuJour()`, `jourNutrition()`, `tendancePoids()`, `depenseReelle()`.
- `recuperation.js` : `recuperation(iso)` calcule le score, `sommeil()` la dette, `influences()` ce qui joue sur la forme.
- `argent.js` : `bilanMois()` (reste à vivre), `listeCourses()`.
- `coach.js` : `messagesCoach()`, `repondre()`, `bilanSemaine()`, `regularite()`.

## Comment ça marche

- `DB.get(clé)` lit en mémoire, tout de suite. `DB.set(clé, valeur)` écrit sur le disque et redessine les écrans.
- Un écran appelle `useDB()` pour se mettre à jour tout seul.
- Ouvrir un écran par-dessus : `Nav.sheet("nom", props)`. Les noms sont dans `FEUILLES`, dans `app.js`.
- Demander un chiffre : `await saisir({ titre, valeur, mode, unite, pas })`. Les modes sont `ent`, `dec`, `signe`, `hm` et `ms`. Jamais de champ `<input>` pour un nombre.

## Mise en ligne

Pousse les fichiers sur GitHub, Netlify publie. À l'ouverture suivante, l'app télécharge tous les fichiers en arrière-plan. Ils remplacent les anciens d'un seul bloc, uniquement s'ils sont tous arrivés. La nouvelle version apparaît donc à l'ouverture d'après, et incrémenter `VERSION` dans `sw.js` n'est plus nécessaire pour une mise à jour courante. Si un fichier manque en ligne, la mise à jour s'arrête et la version en place continue de marcher.

## Clés de stockage

Inchangées : `sport-logs`, `maison-logs`, `nutri-logs`, `food-log`, `foods-custom`, `mensurations`, `photos-index` + `photo:<id>`, `douleur-logs`, `budget-logs`, `fin-income`, `fin-expenses`, `fin-caps`, `fin-goal`, `nutri-cal-cfg`, `science-config`, `sport-phase`, `profil`, `repas-alts`, `taille-corps`, `last-export`, `programmes`, `exos-perso`, `natation-modeles`, `natation-logs`, `recup-logs`, `bilans`.

Deux nouvelles clés : `fin-fixes` (charges fixes) et `courses-etat` (liste de courses en cours).

Champs ajoutés, que l'ancienne version ignore : `startedAt`, `endedAt`, `swaps`, `finisher`, `ajouts` (exercices ajoutés en cours de séance), `retires` (exercices retirés pour la séance) dans `sport-logs`, et `aide` (contrepoids) et `pc` (poids du corps) dans les séries des exercices assistés, dont `w` est alors la charge soulevée ; `tags` dans `recup-logs` ; `mealScale` dans `nutri-logs` ; `fixId` dans `fin-expenses` ; `depense` dans `nutri-cal-cfg` ; `objectifKg` et `theme` dans `profil`.

La sauvegarde garde le même format de fichier : une sauvegarde de l'ancienne version se restaure ici, et inversement.

## Design

L'affiche de nuit : fond noir teinté par la section, aplats de couleur pleine, grands chiffres. Couleurs et tailles sont des variables en haut de `app.css`. Polices : Anton pour les chiffres et les titres, Archivo pour le texte.

Le détail des choix (gardé, fondu, retiré, nouveau) est dans `ARBITRAGES.md`.
