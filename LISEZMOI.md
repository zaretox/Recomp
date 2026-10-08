# RECOMP

| Fichier | Rôle |
| --- | --- |
| `index.html` | Coquille : icône, écran de chargement, charge les scripts. Rarement modifié. |
| `app.js` | **Toute l'application** (écrans, calculs, données). C'est ici que tu modifies. |
| `vendor/` | React 18 (ne pas toucher). |
| `sw.js` | Service worker : l'app s'ouvre depuis le cache, même sans réseau. |
| `netlify.toml` | Empêche Netlify de garder une vieille version de `sw.js`. |
| `manifest.json` | (ton fichier existant, à garder) |

## Après une modification

L'app installée sur le téléphone affiche l'ancienne version une fois, puis la nouvelle à l'ouverture suivante.
Pour forcer la mise à jour, incrémente `VERSION` dans `sw.js` (`recomp-v12` → `recomp-v13`).

## Parcours (3 écrans)

- **Aujourd'hui** (`FilScreen`) : la journée heure par heure, construite à partir du profil (réveil, créneau), du menu du jour (`dayMenu`), de la séance (`sessionForDate`), de la natation et du jour des courses. Le coach (messages + suggestions « Je me pèse », « J'ai mal »…) est en tête ; `QuickSheet` gère les imprévus.
- **Progrès** (`ProgresScreen`) : poids en grand, verdict en une phrase, puis corps, force, forme, assiette, argent, natation.
- **Plan** (`PlanScreen`) : les 4 affiches de couleur (tous les écrans détaillés) puis les réglages (horaires, niveaux, lexique, données, refaire le démarrage).
- **Niveaux** : `LEVEL` (1 à 4, ou tout débloqué) filtre les cartes, les blocs et les onglets (`TAB_LEVEL`, `tabOk`). Une journée est validée avec la séance ou le repos prévu, 3 repas cochés et la pesée (`dayValidated`) ; 7 journées font passer au niveau suivant.
- **Lexique** : `lx(simple, expert)` et `seanceLabel()` donnent les mots simples jusqu'au niveau 3, les termes exacts au niveau expert.
- **Démarrage** (`Demarrage`, `applyOnboarding`) : 6 questions pour un nouvel utilisateur sans données ; génère le programme (`buildProgram`), la cible calorique, la natation et le niveau. Un appareil qui a déjà des données démarre directement en « tout débloqué ».

## Repères dans app.js

- `STOCKAGE PERSISTANT` : IndexedDB + cache mémoire (`load` / `save`). Chaque `save` prévient
  les écrans abonnés via `useStored(clé)`, qui se mettent à jour tout seuls.
- `askConfirm()` / `toast()` / `commitWithUndo()` : confirmations et « Annuler ».
- `PROFIL & PLANNING` : `dayPlan()` est la source unique des horaires (menu, checklist,
  accueil, calendrier .ics). Les créneaux de séance sont dans `CRENEAUX`.
- `bodyTargets()` : poids moyen → masse maigre → cible calorique → macros.
- `dayMenu()` / `mealScaling()` : menu du jour recalé pile sur la cible.
- `progressFor()` : moteur de progression unique (Coach, ✨ Pré-remplir, Science). Cycle : charge + et fourchette −2 reps (`RANGE_DROP`), puis retour à la fourchette du programme à charge égale ; étape déduite de l'historique (`rangeState`).
- `REGISTRE DES PROGRAMMES` : `syncPrograms()` remplace `salleSeances` par les séances du programme perso actif (clé `programmes`) ; `progInfo()`, `sessionForDate()` et `seanceById()` savent lire les programmes de base comme les programmes perso.
- `parseProgramText()` : import d'un programme collé (jours, séances, « 4x8-10 80kg 2min »). `ProgrammesManager` / `ProgramEditor` / `ExoLibrary` : onglet Sport → 📋 Programmes.
- `NatationSection` : onglet Sport → 🏊 Natation (affiche du jour, séances types, historique, records). `swimKcal()` estime la dépense, ajoutée à la cible du jour par `dayMenu(…, extra)`.
- `RÉCUPÉRATION DU MATIN` : `recoveryFor(jour, données)` calcule le score /100 (système nerveux 30 %, sommeil 20 %, charge 15 %, fatigue musculaire 15 %, FC nocturne 10 %, énergie 10 % ; un facteur sans données est retiré). `recupMode(sci)` = mode récup manuel ou score du jour sous 50 : le coach ne propose alors aucune hausse. Écrans : `RecupForm` (saisie Polar), `RecupHead`, `RecupDetail`, `RecupCharts`, `BilansPonctuels`, `RecupTab` (Science → 🫀 Récup).
- `RestTimer` : minuteur basé sur l'heure de fin ; démarrable via `bus.emit("rest:start", { sec })`.

## Clés de stockage

`sport-logs`, `maison-logs`, `nutri-logs`, `food-log`, `foods-custom`, `mensurations`,
`photos-index` + `photo:<id>`, `douleur-logs`, `budget-logs`, `fin-*`, `nutri-cal-cfg`,
`science-config` (décharge, récup, charges + fourchettes de reps ajustées), `sport-phase`, `profil`, `repas-alts`,
`taille-corps`, `last-export`, `programmes` (programmes perso), `exos-perso` (exercices ajoutés à la bibliothèque), `natation-modeles` (séances types), `natation-logs` (séances nagées), `recup-logs` (saisie Polar du matin), `bilans` (prises de sang). Le `profil` contient aussi : `niveau`, `unlockAll`, `levelSince`, `onboarded`, `owner`, `montre`, `budgetSemaine`, `coursesJour`, `objectif`, `coachDismiss`.

## Design « Affiche »

- Couleurs : objet `C` en haut de `app.js` (papier, encre, une couleur par section) + variables CSS dans `index.html`.
- Structure : `App` = 3 écrans + barre de 3 boutons (`BottomNav`), et les 4 affiches `POSTERS` (Sport, Nutrition, Budget, Science) cachées sous l'écran. Une affiche ouverte monte en plein écran ; `goTo(section, onglet)` ouvre une section sur un onglet précis.
- Polices : Anton (grands chiffres, titres) et Bricolage Grotesque (texte), mises en cache par `sw.js` pour le hors ligne.
- Les grands chiffres des écrans (≥ 20 px, gras) passent automatiquement en Anton (règle CSS dans `index.html`).
- Affiches « aujourd'hui » : `TodaySport`, `TodayNutrition`, `TodayBudget`, `TodayScience` (en tête de chaque affiche ouverte). Les ronds de séries et les repas barrés écrivent dans `sport-logs` / `maison-logs` / `nutri-logs`, les mêmes données que les onglets Suivi (synchro dans les deux sens).
