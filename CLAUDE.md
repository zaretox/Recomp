# RECOMP : consignes pour Claude

PWA personnelle d'Aurélien : sport, nutrition, argent, corps. React 18 sans compilation, données uniquement sur le téléphone (IndexedDB). En ligne sur https://recompaurel1.netlify.app, publiée par Netlify à chaque changement de la branche `main`.

Réponds en français. L'utilisateur n'est pas développeur : explique en mots simples, sans jargon, et dis clairement ce qui est fait, testé ou non vérifié.

## Règles absolues

1. **Tout reste à la racine du dépôt**, sauf `vendor/` et `netlify/functions/` (exception validée par Aurélien : Netlify exige ce dossier pour ses fonctions ; il n'y a que `polar.mjs` dedans). Ne crée jamais de sous-dossier : l'envoi par la page web de GitHub les aplatit, et l'app a déjà été cassée ainsi.
2. **Jamais deux fichiers du même nom.** À plat, l'un écraserait l'autre. Les écrans dont le nom existe déjà côté données ou calculs sont préfixés `ecran-` (`ecran-repas.js`, `ecran-argent.js`, `ecran-programmes.js`).
3. **Ne renomme et ne supprime jamais une clé de stockage**, et ne change jamais le format d'une donnée existante. On peut seulement ajouter des champs. La liste des clés est dans `LISEZMOI.md`. Les données réelles ne sont que sur le téléphone, sans copie ailleurs.
4. **`index.html` et `FICHIERS` dans `sw.js` listent les mêmes scripts, dans le même ordre.** Tout fichier ajouté va dans les deux.
5. **Ne touche pas** à `manifest.json`, aux icônes `icon-*.png`, à `vendor/` ni à `netlify.toml`.
6. **Pour un nombre, n'utilise jamais `<input>`** : passe par le pavé `saisir()` de `pave.js`. Le clavier numérique de l'iPhone n'a ni « − » ni « : ».
7. **Ne parle pas de niveaux, de défis ou de questionnaire de démarrage** : l'utilisateur n'en veut pas. Le coach (messages et suggestions) doit rester.

## Comment le code est organisé

Lis `LISEZMOI.md` avant de modifier quoi que ce soit : il contient la carte des fichiers et le fonctionnement de `DB`, `Nav` et `saisir`. Le résumé :

- Les scripts sont classiques, sans `import`, et chargés dans l'ordre par `index.html`. Une fonction d'un fichier est visible des fichiers suivants.
- Données pures : `programmes.js`, `repas.js`, `libelles.js`, `courses.js`.
- Calculs : `programme.js`, `entrainement.js`, `nutrition.js`, `recuperation.js`, `argent.js`, `coach.js`.
- Interface : `kit.js`, `pave.js`, `graphiques.js`, `repos.js`, puis les écrans (`jour.js`, `sport.js`, `seance.js`, `corps.js`, `reglages.js`, `ecran-*.js`) et `app.js`.
- Style : `app.css`. Les couleurs et tailles sont des variables en tête de fichier.
- Écris comme le code existant : français, `h("div.classe", …)` plutôt que `React.createElement`, commentaires courts.
- Le choix des fonctions (gardées, fondues, retirées) est expliqué dans `ARBITRAGES.md`.

## Avant d'envoyer

- Lance `node --check` sur chaque fichier `.js` modifié.
- Vérifie la règle 4 : mêmes scripts dans `index.html` et dans `sw.js`.
- Si tu peux ouvrir un navigateur, teste au format téléphone (375 × 812) : l'app démarre, aucun écran ne plante, rien ne déborde sur le côté.
- Ne change pas `VERSION` dans `sw.js` pour une mise à jour courante : la mise à jour se fait seule, et en tout ou rien.
- Si un comportement touche les calculs (score de forme, charges proposées, calories), dis à l'utilisateur ce qui change pour ses chiffres.

## Mise en ligne

Netlify publie `main`. Si tu travailles sur une autre branche, explique à l'utilisateur qu'il faut fusionner pour que ce soit en ligne, et propose de le faire. Après publication, l'iPhone affiche la nouvelle version à la deuxième ouverture de l'app.
