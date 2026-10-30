"use strict";
/* Liste de courses : produits, rayons et prix de départ. Tes prix réels (budget-logs) remplacent ces valeurs. */
const RAYONS = ["Fruits et légumes", "Viandes et poissons", "Frais", "Épicerie", "Compléments"];

/* parPiece = grammes par unité vendue. eco = version moins chère à nutrition proche. */
const PRODUITS = {
  poulet: { nom: "Poulet / dinde", rayon: 1, prixKg: 10, eco: { nom: "Cuisses sans peau", prixKg: 5.5 } },
  poisson: { nom: "Cabillaud / thon", rayon: 1, prixKg: 17, eco: { nom: "Poisson blanc surgelé", prixKg: 10 } },
  boeuf: { nom: "Bœuf haché 5 %", rayon: 1, prixKg: 14 },
  saumon: { nom: "Saumon", rayon: 1, prixKg: 22 },
  thon: { nom: "Thon au naturel", rayon: 3, prixKg: 12 },
  oeufs: { nom: "Œufs", rayon: 2, prixPiece: .3, parPiece: 55, unite: "œufs" },
  fromage_blanc: { nom: "Fromage blanc 0 %", rayon: 2, prixKg: 2 },
  cheddar: { nom: "Cheddar", rayon: 2, prixKg: 12 },
  parmesan: { nom: "Parmesan", rayon: 2, prixKg: 20 },
  legumes: { nom: "Légumes variés", rayon: 0, prixKg: 2.7 },
  patate: { nom: "Patate douce", rayon: 0, prixKg: 2.5 },
  bananes: { nom: "Bananes", rayon: 0, prixKg: 1.5, parPiece: 120, unite: "bananes" },
  pommes: { nom: "Pommes / poires", rayon: 0, prixKg: 2.5, parPiece: 150, unite: "fruits" },
  fruits_rouges: { nom: "Fruits rouges", rayon: 0, prixKg: 6, eco: { nom: "Fruits rouges surgelés", prixKg: 3 } },
  avocat: { nom: "Avocats", rayon: 0, prixPiece: 1.2, parPiece: 160, unite: "avocats" },
  avoine: { nom: "Flocons d'avoine", rayon: 3, prixKg: 2 },
  riz: { nom: "Riz", rayon: 3, prixKg: 2 },
  quinoa: { nom: "Quinoa", rayon: 3, prixKg: 7, eco: { nom: "Riz ou pommes de terre", prixKg: 2 } },
  pates: { nom: "Pâtes", rayon: 3, prixKg: 2 },
  wrap: { nom: "Galettes wrap", rayon: 3, prixPiece: .45, parPiece: 70, unite: "galettes" },
  pain: { nom: "Pain complet", rayon: 3, prixKg: 4 },
  lentilles: { nom: "Lentilles et haricots", rayon: 3, prixKg: 3.5 },
  granola: { nom: "Granola", rayon: 3, prixKg: 7 },
  huile: { nom: "Huile olive / colza", rayon: 3, prixKg: 9 },
  miel: { nom: "Miel", rayon: 3, prixKg: 9 },
  chia: { nom: "Graines de chia", rayon: 3, prixKg: 10 },
  sesame: { nom: "Graines de sésame", rayon: 3, prixKg: 9 },
  oleagineux: { nom: "Noix de cajou, amandes", rayon: 3, prixKg: 15, eco: { nom: "Cacahuètes nature", prixKg: 5 } },
  whey: { nom: "Whey", rayon: 4, prixKg: 25 },
};

/* Nom de l'ingrédient dans les menus → produit acheté */
const INGREDIENTS = {
  "Poulet/dinde": "poulet", "Cabillaud/thon": "poisson", "Bœuf haché 5%": "boeuf", "Saumon": "saumon", "Thon": "thon",
  "Blancs d'œufs": "oeufs", "Œufs entiers": "oeufs", "Fromage blanc 0%": "fromage_blanc", "Cheddar": "cheddar", "Parmesan": "parmesan",
  "Patate douce": "patate", "Banane": "bananes", "Pomme/poire": "pommes", "Fruits rouges": "fruits_rouges", "Avocat": "avocat",
  "Avoine": "avoine", "Riz": "riz", "Quinoa": "quinoa", "Pâtes": "pates", "Galette wrap": "wrap", "Pain complet": "pain",
  "Lentilles": "lentilles", "Haricots rouges (conserve)": "lentilles", "Granola": "granola", "Huile olive/colza": "huile", "Miel": "miel",
  "Graines de chia": "chia", "Graines de sésame": "sesame", "Noix de cajou": "oleagineux", "Amandes": "oleagineux", "Whey (1 dose)": "whey",
};

/* Lignes de texte des menus qui correspondent à une portion de légumes (≈ 200 g) */
const RE_LEGUMES = /l[ée]gumes|[ée]pinards|salade|brocoli|haricots verts|tomates/i;
const PORTION_LEGUMES = 200;

/* Une portion de blanc pèse 33 g : deux lignes d'œufs se comptent en œufs à acheter */
const GRAMMES_BLANC = 33;
