"use strict";
/* Menu de base, horaires et aliments. Données pures, aucune logique. */

/* Macros de secours tant que le profil n'est pas renseigné */
const MACROS_DEFAUT = {"p":250,"g":240,"l":88,"kcal":2750};

/* Repas d'un jour d'entraînement. Un item est soit un aliment (n, cru, p, g, l), soit un simple texte (t). */
const REPAS_ENTRAINEMENT = [
  {"m":"Petit-déjeuner","h":"7h00","P":32,"G":42,"L":22,"kcal":494,"items":[{"n":"Blancs d'œufs","cru":132,"p":15,"g":1,"l":0,"u":"4 blancs","fix":1},{"n":"Œufs entiers","cru":110,"p":14,"g":1,"l":12,"u":"2 œufs","fix":1},{"n":"Patate douce","cru":200,"p":3,"g":40,"l":0,"cuit":180},{"t":"Légumes verts"},{"n":"Huile olive/colza","cru":10,"p":0,"g":0,"l":10},{"t":"Collagène + vitamine C"}],"note":"Patate douce à l'air fryer (frites/cubes, 200°C 12-15 min) ou en pancakes.","alts":[{"label":"Pancakes patate douce","items":[{"n":"Blancs d'œufs","cru":100,"p":11,"g":1,"l":0,"u":"3 blancs","fix":1},{"n":"Œufs entiers","cru":55,"p":7,"g":1,"l":6,"u":"1 œuf","fix":1},{"n":"Patate douce","cru":150,"p":2,"g":30,"l":0,"cuit":135},{"n":"Avoine","cru":40,"p":5,"g":24,"l":3,"cuit":100},{"t":"Cannelle · mixé puis cuit en pancakes"}]},{"label":"Overnight oats + œufs durs","items":[{"n":"Avoine","cru":80,"p":10,"g":48,"l":6,"cuit":200},{"n":"Fromage blanc 0%","cru":200,"p":16,"g":8,"l":0},{"t":"Fruits rouges + cannelle"},{"n":"Œufs entiers","cru":110,"p":14,"g":1,"l":12,"u":"2 œufs durs","fix":1}]},{"label":"Wrap œufs brouillés","items":[{"n":"Galette wrap","cru":70,"p":8,"g":50,"l":6,"u":"1 galette","fix":1},{"n":"Œufs entiers","cru":110,"p":14,"g":1,"l":12,"u":"2 œufs","fix":1},{"n":"Blancs d'œufs","cru":66,"p":7,"g":1,"l":0,"u":"2 blancs","fix":1},{"t":"Légumes"},{"n":"Huile olive/colza","cru":8,"p":0,"g":0,"l":8}]}]},
  {"m":"Shaker whey","h":"10h00","P":24,"G":2,"L":2,"kcal":122,"items":[{"n":"Whey (1 dose)","cru":30,"p":24,"g":2,"l":2,"u":"1 dose","fix":1}],"note":null},
  {"m":"Pré-séance","h":"11h45","P":1,"G":28,"L":0,"kcal":116,"items":[{"n":"Banane","cru":120,"p":1,"g":28,"l":0,"u":"1 banane","fix":1},{"t":"5g créatine + eau"}],"note":"Banane 15-20 min avant la séance."},
  {"m":"Déjeuner","h":"13h20","P":47,"G":89,"L":9,"kcal":625,"items":[{"n":"Galette wrap","cru":70,"p":8,"g":50,"l":6,"u":"1 galette","fix":1},{"n":"Poulet/dinde","cru":150,"p":35,"g":0,"l":3,"cuit":115},{"n":"Riz","cru":50,"p":4,"g":39,"l":0,"cuit":140},{"t":"Légumes crus"},{"t":"Sauce citron + herbes"}],"note":"Post-séance — mange dans l'heure qui suit.","alts":[{"label":"Bowl mexicain","items":[{"n":"Bœuf haché 5%","cru":130,"p":27,"g":0,"l":7,"cuit":100},{"n":"Riz","cru":55,"p":4,"g":43,"l":0,"cuit":155},{"n":"Haricots rouges (conserve)","cru":80,"p":6,"g":13,"l":0},{"n":"Avocat","cru":40,"p":1,"g":4,"l":6,"u":"¼","fix":1},{"t":"Épinards + oignon"},{"t":"Épices tex-mex"}]},{"label":"Pâtes thon","items":[{"n":"Thon","cru":100,"p":26,"g":0,"l":1,"cuit":80},{"n":"Pâtes","cru":70,"p":8,"g":49,"l":1,"cuit":175},{"n":"Fromage blanc 0%","cru":60,"p":5,"g":2,"l":0,"u":"sauce"},{"t":"Tomates + basilic"},{"n":"Huile olive/colza","cru":5,"p":0,"g":0,"l":5}]},{"label":"Wrap poulet-cheddar","items":[{"n":"Galette wrap","cru":70,"p":8,"g":50,"l":6,"u":"1 galette","fix":1},{"n":"Poulet/dinde","cru":130,"p":30,"g":0,"l":3,"cuit":100},{"n":"Cheddar","cru":25,"p":6,"g":0,"l":8,"fix":1},{"n":"Fromage blanc 0%","cru":50,"p":4,"g":2,"l":0,"u":"sauce"},{"t":"Salade + tomate"}]}]},
  {"m":"Collation","h":"16h30","P":20,"G":44,"L":9,"kcal":337,"items":[{"n":"Fromage blanc 0%","cru":200,"p":16,"g":8,"l":0},{"n":"Pomme/poire","cru":150,"p":0,"g":30,"l":0,"u":"1 fruit","fix":1},{"n":"Noix de cajou","cru":20,"p":4,"g":6,"l":9}],"note":null},
  {"m":"Dîner","h":"19h30","P":49,"G":42,"L":16,"kcal":508,"items":[{"n":"Cabillaud/thon","cru":200,"p":40,"g":0,"l":2,"cuit":160},{"n":"Quinoa","cru":65,"p":9,"g":42,"l":4,"cuit":195},{"t":"Légumes rôtis"},{"n":"Huile olive/colza","cru":10,"p":0,"g":0,"l":10}],"note":null,"alts":[{"label":"Bowl bœuf chili","items":[{"n":"Bœuf haché 5%","cru":150,"p":32,"g":0,"l":8,"cuit":115},{"n":"Riz","cru":65,"p":5,"g":51,"l":0,"cuit":180},{"n":"Haricots rouges (conserve)","cru":80,"p":6,"g":13,"l":0},{"n":"Avocat","cru":40,"p":1,"g":4,"l":6,"u":"¼","fix":1},{"t":"Épinards"},{"t":"Cumin/paprika/ail"}]},{"label":"Riz cantonais poulet","items":[{"n":"Poulet/dinde","cru":130,"p":30,"g":0,"l":3,"cuit":100},{"n":"Riz","cru":70,"p":5,"g":55,"l":0,"cuit":195},{"n":"Œufs entiers","cru":55,"p":7,"g":1,"l":6,"u":"1 œuf","fix":1},{"t":"Légumes wok"},{"n":"Graines de sésame","cru":5,"p":1,"g":1,"l":3,"fix":1},{"n":"Huile olive/colza","cru":8,"p":0,"g":0,"l":8},{"t":"Soja + gingembre"}]},{"label":"Pâtes bolognaise","items":[{"n":"Pâtes","cru":80,"p":10,"g":56,"l":1,"cuit":200},{"n":"Bœuf haché 5%","cru":130,"p":27,"g":0,"l":7,"cuit":100},{"n":"Parmesan","cru":15,"p":5,"g":0,"l":4,"fix":1},{"t":"Sauce tomate + oignon/ail"},{"t":"Basilic"}]},{"label":"Saumon patate douce","items":[{"n":"Saumon","cru":150,"p":30,"g":0,"l":20,"cuit":120},{"n":"Patate douce","cru":200,"p":3,"g":40,"l":0,"cuit":180},{"t":"Brocoli/haricots verts"},{"t":"Citron + aneth"}]}]},
  {"m":"Collation soir","h":"21h30","P":16,"G":8,"L":0,"kcal":96,"items":[{"n":"Fromage blanc 0%","cru":200,"p":16,"g":8,"l":0},{"t":"Cannelle"}],"note":null}
];

/* Repas d'un jour de repos */
const REPAS_REPOS = [
  {"m":"Petit-déjeuner","h":"8h00","P":29,"G":70,"L":9,"kcal":477,"items":[{"n":"Avoine","cru":80,"p":10,"g":48,"l":6,"cuit":200},{"n":"Fromage blanc 0%","cru":200,"p":16,"g":8,"l":0},{"n":"Graines de chia","cru":10,"p":2,"g":4,"l":3},{"n":"Fruits rouges","cru":80,"p":1,"g":10,"l":0}],"note":null,"alts":[{"label":"Omelette complète","items":[{"n":"Œufs entiers","cru":165,"p":21,"g":2,"l":18,"u":"3 œufs","fix":1},{"n":"Blancs d'œufs","cru":100,"p":11,"g":1,"l":0,"u":"3 blancs","fix":1},{"n":"Pain complet","cru":60,"p":5,"g":29,"l":2},{"t":"Épinards/champignons"},{"n":"Huile olive/colza","cru":8,"p":0,"g":0,"l":8}]},{"label":"Skyr granola","items":[{"n":"Fromage blanc 0%","cru":250,"p":20,"g":10,"l":1,"u":"skyr"},{"n":"Granola","cru":45,"p":5,"g":27,"l":7},{"n":"Fruits rouges","cru":80,"p":1,"g":10,"l":0},{"n":"Amandes","cru":15,"p":3,"g":3,"l":7},{"n":"Miel","cru":10,"p":0,"g":8,"l":0,"fix":1}]}]},
  {"m":"Déjeuner","h":"12h30","P":56,"G":30,"L":15,"kcal":479,"items":[{"n":"Poulet/dinde","cru":180,"p":41,"g":0,"l":4,"cuit":135},{"n":"Lentilles","cru":60,"p":15,"g":30,"l":1,"cuit":145},{"t":"Légumes verts"},{"n":"Huile olive/colza","cru":10,"p":0,"g":0,"l":10}],"note":null,"alts":[{"label":"Bowl mexicain","items":[{"n":"Bœuf haché 5%","cru":150,"p":32,"g":0,"l":8,"cuit":115},{"n":"Riz","cru":50,"p":4,"g":39,"l":0,"cuit":140},{"n":"Haricots rouges (conserve)","cru":90,"p":7,"g":14,"l":0},{"n":"Avocat","cru":40,"p":1,"g":4,"l":6,"u":"¼","fix":1},{"t":"Épinards"}]},{"label":"Omelette patate","items":[{"n":"Œufs entiers","cru":165,"p":21,"g":2,"l":18,"u":"3 œufs","fix":1},{"n":"Blancs d'œufs","cru":100,"p":11,"g":1,"l":0,"u":"3 blancs","fix":1},{"n":"Patate douce","cru":180,"p":3,"g":36,"l":0,"cuit":160},{"t":"Épinards/champignons"},{"n":"Huile olive/colza","cru":8,"p":0,"g":0,"l":8}]}]},
  {"m":"Collation","h":"16h00","P":28,"G":36,"L":12,"kcal":364,"items":[{"n":"Whey (1 dose)","cru":30,"p":24,"g":2,"l":2,"u":"ou fromage blanc","fix":1},{"n":"Pomme/poire","cru":150,"p":0,"g":30,"l":0,"u":"1 fruit","fix":1},{"n":"Amandes","cru":20,"p":4,"g":4,"l":10}],"note":null},
  {"m":"Dîner","h":"19h30","P":47,"G":32,"L":15,"kcal":451,"items":[{"n":"Cabillaud/thon","cru":200,"p":40,"g":0,"l":2,"cuit":160,"u":"ou œufs"},{"n":"Quinoa","cru":50,"p":7,"g":32,"l":3,"cuit":150},{"t":"Légumes rôtis"},{"n":"Huile olive/colza","cru":10,"p":0,"g":0,"l":10}],"note":null,"alts":[{"label":"Bowl bœuf chili","items":[{"n":"Bœuf haché 5%","cru":170,"p":36,"g":0,"l":9,"cuit":130},{"n":"Riz","cru":50,"p":4,"g":39,"l":0,"cuit":140},{"n":"Haricots rouges (conserve)","cru":90,"p":7,"g":14,"l":0},{"n":"Avocat","cru":40,"p":1,"g":4,"l":6,"u":"¼","fix":1},{"t":"Épinards"}]},{"label":"Riz cantonais poulet","items":[{"n":"Poulet/dinde","cru":150,"p":35,"g":0,"l":3,"cuit":115},{"n":"Riz","cru":55,"p":4,"g":43,"l":0,"cuit":155},{"n":"Œufs entiers","cru":55,"p":7,"g":1,"l":6,"u":"1 œuf","fix":1},{"t":"Légumes wok"},{"n":"Graines de sésame","cru":5,"p":1,"g":1,"l":3,"fix":1},{"n":"Huile olive/colza","cru":8,"p":0,"g":0,"l":8},{"t":"Soja"}]},{"label":"Saumon quinoa","items":[{"n":"Saumon","cru":150,"p":30,"g":0,"l":20,"cuit":120},{"n":"Quinoa","cru":55,"p":8,"g":35,"l":3,"cuit":165},{"t":"Légumes rôtis"},{"t":"Citron"}]}]},
  {"m":"Collation soir","h":"21h30","P":16,"G":8,"L":0,"kcal":96,"items":[{"n":"Fromage blanc 0%","cru":200,"p":16,"g":8,"l":0}],"note":null}
];

/* Horaires des repas d'un jour d'entraînement, selon le créneau de séance */
const CRENEAUX = {
  "matin": {"label":"Matin","seance":"7h15","times":{"Pré-séance":"6h50","Shaker whey":"8h20","Petit-déjeuner":"9h00","Déjeuner":"12h30","Collation":"16h00","Dîner":"19h30","Collation soir":"21h30"}},
  "midi": {"label":"Midi","seance":"12h00","times":{"Petit-déjeuner":"7h00","Shaker whey":"10h00","Pré-séance":"11h45","Déjeuner":"13h20","Collation":"16h30","Dîner":"19h30","Collation soir":"21h30"}},
  "soir": {"label":"Soir","seance":"18h30","times":{"Petit-déjeuner":"7h30","Déjeuner":"12h30","Collation":"16h00","Pré-séance":"18h10","Shaker whey":"19h45","Dîner":"20h30","Collation soir":"22h30"}}
};

/* Nom du repas → identifiant dans nutri-logs.meals */
const MEAL_ID = {"Pré-séance":"pre","Shaker whey":"shaker","Petit-déjeuner":"petitdej","Déjeuner":"dejeuner","Collation":"collation","Dîner":"diner","Collation soir":"soir"};

const COMPLEMENTS = [
  {"n":"Whey","quand":"Shaker whey (voir horaires du jour)","d":"24g protéines, absorption rapide."},
  {"n":"Créatine","quand":"5g/jour tous les jours","d":"Saturation progressive, régularité prime."},
  {"n":"Alpha-Men","quand":"Avec un repas gras","d":"Vitamines liposolubles mieux absorbées avec lipides."}
];

/* Aliments courants : macros pour 100 g */
const ALIMENTS = [
  {"nom":"Blancs d'œufs","cat":"prot","p":11,"g":0.7,"l":0.2,"kcal":52},
  {"nom":"Poulet/dinde","cat":"prot","p":31,"g":0,"l":3.6,"kcal":165},
  {"nom":"Cabillaud/thon","cat":"prot","p":24,"g":0,"l":1,"kcal":110},
  {"nom":"Fromage blanc 0%","cat":"prot","p":8,"g":4,"l":0.2,"kcal":50},
  {"nom":"Whey (poudre)","cat":"prot","p":80,"g":8,"l":6,"kcal":390},
  {"nom":"Lentilles cuites","cat":"prot","p":9,"g":20,"l":0.4,"kcal":116},
  {"nom":"Avoine","cat":"gluc","p":13,"g":60,"l":7,"kcal":370},
  {"nom":"Patate douce","cat":"gluc","p":1.6,"g":20,"l":0.1,"kcal":86},
  {"nom":"Quinoa cuit","cat":"gluc","p":4.4,"g":21,"l":1.9,"kcal":120},
  {"nom":"Riz cuit","cat":"gluc","p":2.7,"g":28,"l":0.3,"kcal":130},
  {"nom":"Haricots rouges cuits","cat":"gluc","p":9,"g":22,"l":0.5,"kcal":127},
  {"nom":"Banane","cat":"gluc","p":1.1,"g":23,"l":0.3,"kcal":89},
  {"nom":"Huile d'olive","cat":"lip","p":0,"g":0,"l":100,"kcal":884},
  {"nom":"Huile de colza","cat":"lip","p":0,"g":0,"l":100,"kcal":884},
  {"nom":"Graines de chia","cat":"lip","p":17,"g":42,"l":31,"kcal":486},
  {"nom":"Noix de cajou","cat":"lip","p":18,"g":30,"l":44,"kcal":553},
  {"nom":"Amandes","cat":"lip","p":21,"g":22,"l":49,"kcal":579},
  {"nom":"Jaunes d'œufs","cat":"lip","p":16,"g":3.6,"l":27,"kcal":322},
  {"nom":"Œufs entiers","cat":"prot","p":13,"g":1.1,"l":11,"kcal":155},
  {"nom":"Saumon","cat":"prot","p":20,"g":0,"l":13,"kcal":208},
  {"nom":"Bœuf haché 5%","cat":"prot","p":21,"g":0,"l":5,"kcal":137},
  {"nom":"Skyr nature","cat":"prot","p":11,"g":4,"l":0.2,"kcal":63},
  {"nom":"Thon en boîte (naturel)","cat":"prot","p":26,"g":0,"l":1,"kcal":116},
  {"nom":"Jambon blanc","cat":"prot","p":21,"g":1,"l":3,"kcal":115},
  {"nom":"Pâtes cuites","cat":"gluc","p":5.8,"g":30,"l":0.9,"kcal":158},
  {"nom":"Pain complet","cat":"gluc","p":9,"g":41,"l":3.4,"kcal":247},
  {"nom":"Galette wrap","cat":"gluc","p":8.5,"g":50,"l":7,"kcal":310},
  {"nom":"Pomme de terre cuite","cat":"gluc","p":2,"g":17,"l":0.1,"kcal":77},
  {"nom":"Pomme","cat":"gluc","p":0.3,"g":14,"l":0.2,"kcal":52},
  {"nom":"Fruits rouges","cat":"gluc","p":1,"g":10,"l":0.3,"kcal":50},
  {"nom":"Lait demi-écrémé","cat":"gluc","p":3.3,"g":4.8,"l":1.6,"kcal":46},
  {"nom":"Avocat","cat":"lip","p":2,"g":9,"l":15,"kcal":160},
  {"nom":"Cheddar","cat":"lip","p":25,"g":1.3,"l":33,"kcal":403},
  {"nom":"Beurre de cacahuète","cat":"lip","p":25,"g":20,"l":50,"kcal":588}
];
