"use strict";
/* Listes et libellés partagés. Données pures, aucune logique. */

const ZONES_DOULEUR = ["Genou droit","Pied droit","Épaule","Bas du dos","Poignet","Coude","Hanche","Autre"];

/* Zone douloureuse → muscles à ménager */
const IMPACT_DOULEUR = {
  "Genou droit": ["Quadriceps","Ischios","Fessiers"],
  "Pied droit": ["Mollets","Quadriceps"],
  "Hanche": ["Fessiers","Quadriceps","Ischios"],
  "Épaule": ["Pecs","Épaules","Triceps"],
  "Bas du dos": ["Dos","Ischios"],
  "Poignet": ["Biceps","Triceps","Pecs"],
  "Coude": ["Biceps","Triceps"]
};

/* Zone douloureuse → région du corps */
const REGION_DOULEUR = {
  "Genou droit": ["legs"],
  "Pied droit": ["legs"],
  "Hanche": ["legs"],
  "Épaule": ["upper"],
  "Poignet": ["upper"],
  "Coude": ["upper"],
  "Bas du dos": ["legs","upper"]
};

/* Circuit maison → régions travaillées */
const REGION_MAISON = {"A":["legs"],"B":["upper"],"C":["legs","upper"],"D":["legs","upper"]};

const MENSURATIONS = [{"k":"taille","l":"Tour de taille"},{"k":"cou","l":"Tour de cou"},{"k":"poitrine","l":"Poitrine"},{"k":"bras","l":"Bras"},{"k":"cuisse","l":"Cuisse"},{"k":"hanches","l":"Hanches"}];

const CATEGORIES = ["Logement","Courses","Transport","Sorties","Loisirs","Santé","Abonnements","Sport","Vêtements","Autre"];

const PRESETS_BILAN = [["Testostérone totale","ng/mL"],["Cortisol (8 h, à jeun)","µg/dL"],["CRP ultrasensible","mg/L"],["CK","UI/L"],["Ferritine","ng/mL"],["Vitamine D","ng/mL"],["Autre",""]];

const NAGE_BLOCS = ["Échauffement","Éducatifs","Technique","Série principale","Série","Jambes","Bras","Retour au calme"];
const NAGES = ["Crawl","Dos","Brasse","Papillon","4 nages","Au choix"];
const NAGE_MATERIEL = ["—","Pull-buoy","Plaquettes","Palmes","Planche","Tuba"];
