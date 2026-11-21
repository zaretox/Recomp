#!/usr/bin/env node
"use strict";
/* VÉRIFICATION AVANT PUBLICATION — à lancer avant chaque mise en ligne :  node verifier.cjs
 *   --depuis <commit>   comparer à ce commit plutôt qu'à la version en ligne (origin/main)
 *   --sans-navigateur   seulement les vérifications du code
 *   --captures <dossier>  une capture de chaque écran (app remplie)
 * Ce fichier ne fait pas partie de l'app (ni dans index.html ni dans sw.js) et ne modifie rien :
 * il lit le code, puis ouvre l'app dans un navigateur de test, au format iPhone, avec des données inventées.
 * ✗ = bloquant (ne pas publier), ⚠ = à regarder et à expliquer. Code de sortie 1 s'il y a un ✗. */
const fs = require("fs"), path = require("path"), http = require("http"), { execFileSync, spawnSync } = require("child_process");

const RACINE = __dirname;
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1] || true; };
const SANS_NAV = process.argv.includes("--sans-navigateur"), CAPTURES = arg("--captures");
const git = (...a) => { try { return execFileSync("git", a, { cwd: RACINE, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) { return null; } };
const lire = f => fs.readFileSync(path.join(RACINE, f), "utf8");

const rapport = [], bloquants = [], aRegarder = [];
const titre = t => rapport.push("", t);
const ok = t => rapport.push("  ✓ " + t);
const ko = t => { rapport.push("  ✗ " + t); bloquants.push(t); };
const avert = t => { rapport.push("  ⚠ " + t); aRegarder.push(t); };
const info = t => rapport.push("    " + t);

/* ---------- La version de comparaison ---------- */
let BASE = arg("--depuis");
if (!BASE) { git("fetch", "-q", "origin", "main"); BASE = "origin/main"; }
const baseOk = git("rev-parse", "--verify", "-q", BASE + "^{commit}");
const lireBase = f => baseOk ? git("show", BASE + ":" + f) : null;

/* ---------- Les scripts de l'app ---------- */
const SCRIPTS = [...lire("index.html").matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(m => m[1].replace(/^\.\//, ""));
const SCRIPTS_APP = SCRIPTS.filter(f => !f.startsWith("vendor/"));
const ONGLET_DE = {
  "jour.js": "Jour", "sport.js": "Sport", "seance.js": "Sport", "ecran-programmes.js": "Sport", "ecran-sorties.js": "Sport",
  "ecran-repas.js": "Repas", "ecran-argent.js": "Argent", "corps.js": "Corps", "ecran-coach.js": "Coach", "reglages.js": "Réglages", "app.js": "Toute l'app",
};
// Deux fonctions de calcul qui sont, en fait, des écrans à part entière
const SPECIAUX = { contexteCoach: "Coach IA (résumé de tes données)", messagesCoach: "Coach (messages, aussi sur Jour)", ACTIONS_COACH: "Coach IA (boutons d'action)" };
const ORDRE_ONGLETS = ["Jour", "Sport", "Repas", "Argent", "Corps", "Coach", "Coach IA (résumé de tes données)", "Réglages", "Toute l'app"];

// Déclarations du niveau le plus haut d'un script (une fonction ou une constante visible des autres fichiers)
const DECL = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+\{([^}]*)\}\s*=|^(?:const|let|var)\s+\[([^\]]*)\]\s*=/;
function declarations(src, fichier) {
  if (!src) return [];
  const lignes = src.split("\n"), d = [];
  lignes.forEach((l, i) => {
    const m = l.match(DECL);
    if (!m) return;
    const noms = m[1] || m[2] ? [m[1] || m[2]] : (m[3] || m[4]).split(",").map(x => x.split(":").pop().split("=")[0].replace(/\.\.\./, "").trim()).filter(Boolean);
    noms.forEach(nom => d.push({ nom, fichier, debut: i + 1 }));
  });
  // Le commentaire juste au-dessus d'une déclaration lui appartient (et pas à celle d'avant)
  const commentaire = l => /^\s*(\/\/|\/\*|\*)/.test(l);
  d.forEach(x => { let h = x.debut; while (h > 1 && commentaire(lignes[h - 2])) h--; x.haut = h; });
  d.forEach(x => { const s = d.find(y => y.debut > x.debut); x.fin = s ? s.haut - 1 : lignes.length; x.corps = lignes.slice(x.debut - 1, x.fin).join("\n"); });
  return d;
}
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map(l => l.replace(/(^|[^:"'\\])\/\/.*$/, "$1")).join("\n");
const identifiants = s => new Set([...sansCommentaires(s).matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)/g)].map(m => m[1]));

const SOURCES = Object.fromEntries(SCRIPTS_APP.filter(f => fs.existsSync(path.join(RACINE, f))).map(f => [f, lire(f)]));
const DECLS = Object.entries(SOURCES).flatMap(([f, s]) => declarations(s, f));
const NOMS = new Set(DECLS.map(d => d.nom));
DECLS.forEach(d => { d.refs = [...identifiants(d.corps)].filter(n => n !== d.nom && NOMS.has(n)); });
const UTILISATEURS = new Map();
DECLS.forEach(d => d.refs.forEach(n => { if (!UTILISATEURS.has(n)) UTILISATEURS.set(n, []); UTILISATEURS.get(n).push(d); }));

// Où se voit une fonction : on remonte de ceux qui l'utilisent jusqu'aux écrans
function ouSeVoit(depart) {
  const ecrans = new Map(), vus = new Set(), file = [...depart];
  const noter = (lieu, qui) => { if (!ecrans.has(lieu)) ecrans.set(lieu, new Set()); ecrans.get(lieu).add(qui); };
  while (file.length) {
    const d = file.shift(), cle = d.fichier + ":" + d.nom;
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (SPECIAUX[d.nom]) noter(SPECIAUX[d.nom], d.nom);
    if (ONGLET_DE[d.fichier]) { noter(ONGLET_DE[d.fichier], d.nom); continue; }
    (UTILISATEURS.get(d.nom) || []).forEach(u => file.push(u));
  }
  return ecrans;
}
const decrireLieux = ecrans => [...ecrans].sort((a, b) => ORDRE_ONGLETS.indexOf(a[0]) - ORDRE_ONGLETS.indexOf(b[0]))
  .map(([lieu, q]) => lieu + " (" + [...q].slice(0, 4).join(", ") + (q.size > 4 ? "…" : "") + ")").join(" · ");

/* ---------- 1. Les règles du dépôt ---------- */
titre("1. Règles du dépôt (CLAUDE.md)");
{
  const fichiers = [...new Set([...(git("ls-files") || "").split("\n"), ...(git("ls-files", "--others", "--exclude-standard") || "").split("\n")].filter(Boolean))];
  const permis = /^vendor\/|^netlify\/functions\/(polar|banque|coach)\.mjs$/;
  const dossiers = fichiers.filter(f => f.includes("/") && !permis.test(f));
  dossiers.length ? ko("Fichiers rangés dans un sous-dossier (règle 1) : " + dossiers.join(", ")) : ok("Tout est à la racine (sauf vendor/ et les 3 fonctions Netlify)");
  const parNom = {};
  fichiers.forEach(f => { const b = path.basename(f); (parNom[b] = parNom[b] || []).push(f); });
  const doubles = Object.values(parNom).filter(l => l.length > 1);
  doubles.length ? ko("Deux fichiers du même nom (règle 2) : " + doubles.map(l => l.join(" et ")).join(" ; ")) : ok("Aucun nom de fichier en double");

  const sw = lire("sw.js"), bloc = (sw.match(/const FICHIERS = \[([\s\S]*?)\];/) || [, ""])[1];
  const scriptsSw = [...bloc.matchAll(/"\.\/([^"]+\.js)"/g)].map(m => m[1]);
  const manquants = [...SCRIPTS, ...[...bloc.matchAll(/"\.\/([^"]+)"/g)].map(m => m[1])].filter(f => f && !fs.existsSync(path.join(RACINE, f)));
  if (JSON.stringify(scriptsSw) !== JSON.stringify(SCRIPTS)) {
    const k = SCRIPTS.findIndex((f, i) => scriptsSw[i] !== f);
    ko("index.html et sw.js ne listent pas les mêmes scripts dans le même ordre (règle 4) : premier écart au n° " + (k + 1) + " (" + (SCRIPTS[k] || "rien") + " / " + (scriptsSw[k] || "rien") + ")");
  } else ok("index.html et sw.js : les mêmes " + SCRIPTS.length + " scripts, dans le même ordre");
  if (manquants.length) ko("Fichiers listés mais absents : " + manquants.join(", "));

  if (baseOk) {
    const touches = (git("diff", "--name-only", BASE, "--", "manifest.json", "netlify.toml", "vendor", ":(glob)icon-*.png") || "").split("\n").filter(Boolean);
    const nouveauxVendor = (git("ls-files", "--others", "--exclude-standard", "vendor") || "").split("\n").filter(Boolean);
    touches.length || nouveauxVendor.length ? ko("Fichiers à ne pas toucher modifiés (règle 5) : " + [...touches, ...nouveauxVendor].join(", ")) : ok("manifest.json, icônes, vendor/ et netlify.toml intacts");
    const v = s => (s.match(/const VERSION = "([^"]+)"/) || [])[1];
    if (v(lireBase("sw.js") || "") !== v(sw)) avert("VERSION de sw.js changée (" + v(lireBase("sw.js") || "") + " → " + v(sw) + ") : à ne faire que pour une raison précise");
  }

  // Les clés de stockage : aucune ne disparaît (règle 3), chacune est décrite dans LISEZMOI.md
  const clesDe = s => { const b = (String(s || "").match(/const DEFAUTS = \{([\s\S]*?)\n\};/) || [, ""])[1]; return [...b.matchAll(/"([\w-]+)"\s*:/g)].map(m => m[1]); };
  const cles = clesDe(SOURCES["base.js"]), clesBase = clesDe(lireBase("base.js"));
  const perdues = clesBase.filter(k => !cles.includes(k)), nouvelles = cles.filter(k => !clesBase.includes(k));
  perdues.length ? ko("Clés de stockage disparues ou renommées (règle 3) : " + perdues.join(", ")) : ok("Aucune clé de stockage perdue (" + cles.length + " clés)");
  const hors = (SOURCES["reglages.js"]?.match(/HORS_SAUVEGARDE = \[([^\]]*)\]/) || [, ""])[1];
  if (nouvelles.length) info("Nouvelles clés : " + nouvelles.map(k => k + (hors.includes('"' + k + '"') ? " (hors sauvegarde)" : " (dans la sauvegarde)")).join(", "));
  const lisez = lire("LISEZMOI.md"), absentes = cles.filter(k => !lisez.includes("`" + k + "`"));
  if (absentes.length) avert("Clés pas décrites dans LISEZMOI.md : " + absentes.join(", "));
  const utilisees = new Set(Object.values(SOURCES).flatMap(s => [...s.matchAll(/DB\.(?:get|set)\("([\w-]+)"/g)].map(m => m[1])));
  const inconnues = [...utilisees].filter(k => !cles.includes(k));
  if (inconnues.length) ko("Clés utilisées mais absentes de DEFAUTS (base.js) : " + inconnues.join(", "));

  // Règle 6 : jamais de champ texte pour un nombre
  const champs = Object.entries(SOURCES).flatMap(([f, s]) => s.split("\n").map((l, i) => /type:\s*"(number|tel)"|inputMode:\s*"(numeric|decimal|tel)"|<input[^>]+type="number"/.test(l) ? f + ":" + (i + 1) : null)).filter(Boolean);
  champs.length ? ko("Champ de saisie pour un nombre, au lieu du pavé saisir() (règle 6) : " + champs.join(", ")) : ok("Les nombres passent par le pavé saisir()");
}

/* ---------- 2. Le code ---------- */
titre("2. Code");
{
  const aVerifier = [...SCRIPTS_APP, "sw.js", "verifier.cjs", ...fs.readdirSync(path.join(RACINE, "netlify/functions")).filter(f => /\.m?js$/.test(f)).map(f => "netlify/functions/" + f)];
  const erreurs = aVerifier.map(f => { const r = spawnSync(process.execPath, ["--check", path.join(RACINE, f)], { encoding: "utf8" }); return r.status ? f + " : " + (r.stderr.split("\n").find(l => /Error/.test(l)) || "erreur") : null; }).filter(Boolean);
  erreurs.length ? erreurs.forEach(e => ko("Erreur de syntaxe — " + e)) : ok("Syntaxe correcte (" + aVerifier.length + " fichiers)");

  const parNom = {};
  DECLS.forEach(d => (parNom[d.nom] = parNom[d.nom] || []).push(d.fichier + ":" + d.debut));
  const doublons = Object.entries(parNom).filter(([, l]) => l.length > 1);
  doublons.length ? doublons.forEach(([n, l]) => ko("Nom « " + n + " » déclaré deux fois (le second écrase le premier, ou l'app ne démarre plus) : " + l.join(" et "))) : ok("Aucun nom de fonction ou de constante en double (" + DECLS.length + " noms)");
}

/* ---------- 3. Ce qui a changé, et où ça se voit ---------- */
titre("3. Ce qui a changé depuis " + (baseOk ? BASE + " (" + git("log", "-1", "--format=%h %s", BASE).trim() + ")" : "?") + ", et où ça se voit");
const changements = { decls: [], cles: [] };
if (!baseOk) avert("Version de comparaison introuvable : partie 3 non faite");
else {
  const fichiersChanges = (git("diff", "--name-only", BASE) || "").split("\n").concat((git("ls-files", "--others", "--exclude-standard") || "").split("\n")).filter(Boolean);
  if (!fichiersChanges.length) ok("Rien de changé : identique à la version comparée");
  else info("Fichiers changés : " + [...new Set(fichiersChanges)].join(", "));
  const clesConnues = new Set([...(SOURCES["base.js"].match(/const DEFAUTS = \{([\s\S]*?)\n\};/) || [, ""])[1].matchAll(/"([\w-]+)"\s*:/g)].map(m => m[1]));
  const clesTouchees = new Set(), lignesAjoutees = [];
  for (const f of SCRIPTS_APP) {
    const avant = lireBase(f), declsAvant = new Set(declarations(avant, f).map(d => d.nom)), maintenant = DECLS.filter(d => d.fichier === f);
    if (avant == null) { maintenant.forEach(d => changements.decls.push({ d, etat: "nouveau" })); continue; }
    const diff = git("diff", "-U0", BASE, "--", f) || "";
    const plages = [...diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].map(m => [+m[1], +m[1] + Math.max(+(m[2] ?? 1), 1) - 1]);
    maintenant.filter(d => plages.some(([a, b]) => a <= d.fin && b >= d.haut)).forEach(d => changements.decls.push({ d, etat: declsAvant.has(d.nom) ? "modifié" : "nouveau" }));
    declarations(avant, f).filter(d => !NOMS.has(d.nom)).forEach(d => {
      const encore = DECLS.filter(x => x.refs.includes(d.nom));
      encore.length ? ko("« " + d.nom + " » a été retiré de " + f + " mais sert encore à : " + encore.map(x => x.nom).join(", ")) : info("Retiré : " + d.nom + " (" + f + "), plus utilisé nulle part");
    });
    diff.split("\n").filter(l => /^[+-][^+-]/.test(l)).forEach(l => {
      [...l.matchAll(/"([\w-]+)"/g)].forEach(m => { if (clesConnues.has(m[1])) clesTouchees.add(m[1]); });
      if (l[0] === "+") lignesAjoutees.push(f + " : " + l.slice(1).trim());
    });
  }
  changements.cles = [...clesTouchees];
  const touchesParOnglet = new Map();
  const marquer = ecrans => ecrans.forEach((_, lieu) => touchesParOnglet.set(lieu, true));
  changements.decls.forEach(({ d, etat }) => {
    const e = ouSeVoit([d]);
    marquer(e);
    const lieux = decrireLieux(e);
    if (!lieux && !(UTILISATEURS.get(d.nom) || []).length && etat === "nouveau") avert("« " + d.nom + " » (" + d.fichier + ") est nouveau mais n'est utilisé nulle part");
    info((etat === "nouveau" ? "Nouveau " : "Modifié ") + d.nom + " (" + d.fichier + ")" + (lieux ? " → " + lieux : ""));
  });
  changements.cles.forEach(k => {
    const lecteurs = DECLS.filter(d => d.nom !== "DEFAUTS" && d.corps.includes('"' + k + '"')), e = ouSeVoit(lecteurs);
    marquer(e);
    info("Donnée « " + k + " » → " + (decrireLieux(e) || "aucun écran"));
  });
  if (changements.decls.length || changements.cles.length) {
    info("");
    info("Onglets concernés : " + ORDRE_ONGLETS.filter(o => o !== "Toute l'app").map(o => (touchesParOnglet.has(o) ? "✓ " : "— ") + o).join("   "));
    info("→ Pour chaque « — » : la nouveauté devrait-elle y apparaître ? Pour chaque « ✓ » : apparaît-elle deux fois, ou en double d'une fonction qui existait déjà ?");
  }
  // Mots que l'utilisateur ne veut pas voir (règle 7)
  const interdits = lignesAjoutees.filter(l => /\bd[ée]fis?\b|\bbadges?\b|questionnaire|\bniveaux?\b|\bXP\b|\bpoints? d'exp/i.test(l) && !/Ne parle jamais de niveaux/.test(l));
  interdits.forEach(l => avert("Mot à relire (niveaux, défis, questionnaire : règle 7) : " + l.slice(0, 160)));
}

/* ---------- 4. À l'écran : chaque onglet, rubrique, réglage et feuille, au format iPhone ---------- */
async function navigateur() {
  titre("4. À l'écran, au format iPhone (375 × 812)");
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { avert("Navigateur de test absent (playwright) : écrans non vérifiés. À faire à la main avant de publier."); return; }

  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".cjs": "text/plain", ".mjs": "text/plain", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8" };
  const serveur = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(RACINE, path.normalize(p));
    if (!f.startsWith(RACINE)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(d); });
  });
  await new Promise(r => serveur.listen(0, "127.0.0.1", r));
  const URL_APP = "http://127.0.0.1:" + serveur.address().port + "/";
  const b = await chromium.launch();
  if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });

  // La montre et le coach, imités : une nage aujourd'hui, une course hier, des nuits, la charge, les pas
  const jourIso = d => { const x = new Date(); x.setDate(x.getDate() - d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const SORTIES = [
    { id: "N1", start_time: jourIso(0) + "T07:10:00", duration: "PT43M10S", distance: 1300, calories: 520, sport: "SWIMMING", detailed_sport_info: "POOL_SWIMMING", heart_rate: { average: 128, maximum: 151 } },
    { id: "R1", start_time: jourIso(1) + "T18:00:00", duration: "PT32M", distance: 5200, calories: 410, sport: "RUNNING", detailed_sport_info: "RUNNING", heart_rate: { average: 149, maximum: 168 } },
  ];
  async function imiter(p) {
    await p.route("**/.netlify/functions/polar**", r => {
      const c = new URL(r.request().url()).searchParams.get("chemin") || "", J = o => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
      if (c === "/v3/users/sleep") return J({ nights: [0, 1, 2, 3, 4].map(d => ({ date: jourIso(d), sleep_start_time: jourIso(d + 1) + "T23:4" + d + ":00", sleep_end_time: jourIso(d) + "T06:50:00", light_sleep: 14400, deep_sleep: 4800, rem_sleep: 5700, total_interruption_duration: 1500, sleep_score: 78 - d })) });
      if (c === "/v3/users/nightly-recharge") return J({ recharges: [0, 1, 2, 3, 4].map(d => ({ date: jourIso(d), heart_rate_avg: 54, heart_rate_variability_avg: 60 - d, breathing_rate_avg: 14.2, nightly_recharge_status: 5, ans_charge: 2.1 })) });
      if (c === "/v3/users/cardio-load") return J(Array.from({ length: 14 }, (_, d) => ({ date: jourIso(d), cardio_load: d % 3 ? 0 : 90, cardio_load_status: "LOAD_STATUS_PRODUCTIVE", cardio_load_ratio: 1.1, strain: 34, tolerance: 29 })));
      if (c === "/v3/users/activities") return J(Array.from({ length: 14 }, (_, d) => ({ date: jourIso(d), steps: 6000 + d * 300, calories: 2900, active_calories: 700, active_duration: "PT1H30M", distance_from_steps: 4800 })));
      if (c === "/v3/exercises") return J(SORTIES.map(s => ({ id: s.id, start_time: s.start_time })));
      const s = SORTIES.find(x => c === "/v3/exercises/" + x.id);
      if (s) return J(s);
      return r.fulfill({ status: 404, body: "" });
    });
    await p.route("**/.netlify/functions/coach", r => {
      const ev = [{ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Réponse de test du coach." } }, { type: "message_delta", delta: { stop_reason: "end_turn" } }];
      r.fulfill({ status: 200, contentType: "text/event-stream", body: ev.map(e => "data: " + JSON.stringify(e) + "\n\n").join("") });
    });
    await p.route("**/.netlify/functions/banque**", r => r.fulfill({ status: 404, body: "{}" }));
  }

  // Des données inventées, dans les formats de l'app (exécuté dans la page)
  async function remplir() {
    const auj = aujourdhui(), d = n => decale(auj, -n);
    await DB.set("profil", { ...(DB.get("profil") || {}), discret: false });
    await DB.set("taille-corps", "185");
    await majCalories({ sex: "M", age: 31, activity: 1.375, deficit: 500 });
    await DB.set("nutri-logs", Array.from({ length: 30 }, (_, i) => ({ id: 1000 + i, dateISO: d(29 - i), date: dateCourte(d(29 - i)), weight: arrondi(121 - i * .08, 1) })));
    for (let i = 1; i <= 12; i++) for (const l of jourNutrition(d(i)).lignes) await cocherRepas(d(i), l.id);
    await DB.set("recup-logs", Array.from({ length: 14 }, (_, i) => ({ id: 2000 + i, dateISO: d(14 - i), ans: 1.5, rmssd: 58, fc: 55, sleep: 7.1, tags: i % 5 ? [] : ["ecran"] })));
    const logs = [];
    for (let i = 1; i <= 21; i++) {
      const iso = d(i), s = seanceDuJour(iso, "salle"), def = s && PPL_SEANCES.find(x => x.id === s.code);
      if (!def) continue;
      logs.push({ id: 3000 + i, date: dateCourte(iso), dateISO: iso, seance: s.code, startedAt: new Date(iso + "T12:00:00").getTime(), endedAt: new Date(iso + "T13:05:00").getTime(),
        exercices: def.exercices.slice(0, 4).map(e => ({ nom: e.nom, weight: 20 + i, reps: 10, sets: 3, setsDetail: [{ w: 20 + i, r: 10 }, { w: 20 + i, r: 9 }, { w: 20 + i, r: 8 }], rpe: 8 })) });
    }
    await DB.set("sport-logs", logs);
    await DB.set("natation-logs", [{ id: 4001, dateISO: d(3), date: dateCourte(d(3)), modele: "Technique", distance: 1500, duree: 2700, rpe: 6, nage: "Crawl", pool: 25, note: "", kcal: 480 }]);
    await DB.set("mensurations", [{ id: 5001, dateISO: d(20), date: dateCourte(d(20)), vals: { taille: 112 } }, { id: 5002, dateISO: d(2), date: dateCourte(d(2)), vals: { taille: 110 } }]);
    await DB.set("douleur-logs", [{ id: 6001, dateISO: d(1), date: dateCourte(d(1)), zone: "Genou gauche", intensite: 3, note: "en bas du squat" }]);
    await DB.set("bilans", [{ id: 7001, dateISO: d(40), nom: "Ferritine", valeur: 80, unite: "ng/mL" }]);
    await DB.set("fin-income", [{ id: 8001, dateISO: d(10), montant: 2156, source: "Paye", paye: true }]);
    await DB.set("fin-expenses", [{ id: 8101, dateISO: d(9), montant: 412, cat: "Logement", label: "Loyer" }, { id: 8102, dateISO: d(5), montant: 80, cat: "Courses", label: "Supermarché" }, { id: 8103, dateISO: d(2), montant: 25, cat: "Sorties", label: "Cinéma" }]);
    await DB.set("epargne", { ...EPARGNE_VIDE, cagnottes: [{ id: "securite", nom: "Épargne de sécurité", cible: 2000 }], versements: [{ id: 8201, dateISO: d(9), montant: 300, source: "paye" }] });
    await DB.set("polar-lien", { jeton: "TEST", utilisateur: 1, depuis: d(30) });
    await DB.set("coach-lien", { code: "test", actif: true });
    try { Object.keys(localStorage).filter(k => k.startsWith("recomp_polar")).forEach(k => localStorage.removeItem(k)); } catch (e) { /* rien */ }
  }

  // Ce qu'on regarde sur chaque écran (exécuté dans la page)
  function examiner() {
    const W = innerWidth, piles = document.querySelectorAll(".pile-f"), zone = piles.length ? piles[piles.length - 1] : document.querySelector("main.scene") || document.body;
    const r = { plante: !!document.querySelector(".filet") || /un écran a planté/i.test(document.body.innerText), debord: document.documentElement.scrollWidth > W + 1, depasse: [], coupes: [], titres: [], textes: [],
      rubrique: piles.length ? null : (document.querySelector("main.scene .sous-onglets .actif")?.innerText || "").trim() || null };
    const nom = el => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "") + " « " + (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40) + " »";
    // Qui retient ce qui sort de l'écran : une bande qu'on fait glisser (voulu), un cadre qui le coupe (texte rogné), ou rien (la page déborde)
    const retenu = el => { let cadre = null; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return "glisse"; if (o !== "visible" && !cadre) cadre = p; } return cadre ? "coupe" : null; };
    const signales = [];
    for (const el of zone.querySelectorAll("*")) {
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") continue;
      const x = el.getBoundingClientRect();
      if (!x.width || !x.height) continue;
      if ((x.right > W + 1 || x.left < -1) && !signales.some(s => s.contains(el))) {
        const t = retenu(el);
        // Un élément entièrement hors de l'écran dans un cadre (diapositive suivante, panneau replié) est voulu
        if (t === "glisse" || (t === "coupe" && (x.left >= W - 1 || x.right <= 1))) continue;
        signales.push(el); (t === "coupe" ? r.coupes : r.depasse).push(nom(el));
      }
      if (el.children.length === 0 && (el.innerText || "").trim() && el.scrollWidth > el.clientWidth + 2 && st.overflowX !== "visible" && st.textOverflow !== "ellipsis") r.coupes.push(nom(el));
    }
    const compter = (sel, min) => { const n = {}; zone.querySelectorAll(sel).forEach(el => { if (el.closest("[aria-hidden=true]")) return; const t = (el.innerText || "").trim().replace(/\s+/g, " "); if (t.length >= min) n[t] = (n[t] || 0) + 1; }); return Object.entries(n).filter(([, k]) => k > 1).map(([t, k]) => k + " × « " + t.slice(0, 70) + " »"); };
    r.titres = compter(".section-t h2", 2);
    r.textes = compter("p, li, h3", 30);
    return r;
  }

  const vues = [], erreursPage = [];
  async function passage(nomPassage, rempli) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, serviceWorkers: "block" });
    const p = await ctx.newPage();
    p.on("pageerror", e => erreursPage.push(nomPassage + " : " + e.message));
    p.on("console", m => { if (m.type() === "error" && /^RECOMP/.test(m.text())) erreursPage.push(nomPassage + " : écran planté (" + m.text().replace(/^RECOMP\s*/, "").split("\n")[0].slice(0, 120) + ")"); });
    await imiter(p);
    await p.goto(URL_APP); await p.waitForTimeout(800);
    const demarre = () => p.evaluate(() => typeof ONGLETS !== "undefined" && !!document.querySelector("main.scene")).catch(() => false);
    if (!(await demarre())) { ko(nomPassage + " : l'app ne démarre pas — " + (erreursPage.find(e => e.startsWith(nomPassage)) || "écran blanc")); erreursPage.length = 0; await ctx.close(); return; }
    if (rempli) { await p.evaluate(remplir); await p.reload(); await p.waitForTimeout(2500); }
    const voir = async (lieu, ouvrir, rubrique) => {
      const avant = erreursPage.length;
      try { await p.evaluate(ouvrir.f, ouvrir.a); } catch (e) { erreursPage.push(nomPassage + " / " + lieu + " : " + e.message.split("\n")[0]); }
      await p.waitForTimeout(300);
      const r = await p.evaluate(examiner).catch(e => ({ plante: true, err: e.message }));
      vues.push({ passage: nomPassage, lieu, ...r, rate: rubrique && !r.plante && r.rubrique !== rubrique, erreurs: erreursPage.slice(avant) });
      if (CAPTURES && rempli) await p.screenshot({ path: path.join(CAPTURES, lieu.replace(/[^\wÀ-ÿ-]+/g, "_") + ".png") }).catch(() => {});
    };
    // Les onglets et leurs rubriques
    const onglets = await p.evaluate(() => ONGLETS.map(o => [o.id, o.nom, ({ sport: RUBRIQUES_SPORT, repas: RUBRIQUES_REPAS, argent: RUBRIQUES_ARGENT, corps: RUBRIQUES_CORPS }[o.id] || [[null, null]])]));
    for (const [id, nom, rubs] of onglets) for (const [rub, nomRub] of rubs)
      await voir(nom + (nomRub ? " → " + nomRub : ""), { f: async ([id, rub]) => { Nav.toutFermer(); Nav.tab(id === "jour" ? "coach" : "jour"); await new Promise(r => setTimeout(r, 80)); rub ? allerRubrique(id, rub) : Nav.tab(id); }, a: [id, rub] }, nomRub);
    // Les réglages
    await voir("Réglages", { f: () => { Nav.tab("jour"); Nav.toutFermer(); Nav.sheet("reglages"); } });
    const regl = await p.evaluate(() => RUBRIQUES_REGLAGES.flatMap(g => g[1]).map(x => [x[0], x[1]]));
    for (const [rub, nom] of regl) await voir("Réglages → " + nom, { f: rub => { Nav.toutFermer(); Nav.sheet("reglage", { rub }); }, a: rub });
    // Chaque feuille, avec ce qu'il faut pour l'ouvrir
    const feuilles = await p.evaluate(() => {
      const auj = aujourdhui(), sl = DB.get("sport-logs").slice(-1)[0], nl = DB.get("natation-logs").slice(-1)[0], ps = DB.get("polar-seances")[0];
      const ligne = jourNutrition(auj).lignes[0], item = ligne?.m?.items?.find(i => !i.t);
      const A = { seance: { iso: auj, prog: "salle", code: "Push" }, exercice: { nom: "DC haltères" }, seanceDetail: sl ? { id: sl.id } : null, nageModele: { neuf: nageExemple() },
        editeur: { neuf: copiePPL() }, fiche: { nom: "DC haltères" }, technique: { nom: TECHNIQUES[0].nom }, repas: ligne ? { iso: auj, id: ligne.id } : null, equivalents: item ? { nom: item.n, g: 100 } : null,
        sortie: ps ? { id: ps.id } : null, noteExo: { nom: "DC haltères" }, nage: nl ? { id: nl.id } : null, matin: { iso: auj }, pesee: { iso: auj }, choisir: { iso: auj }, natation: { iso: auj }, douleur: { iso: auj }, aliment: { iso: auj }, reglage: null, reglages: null };
      return Object.keys(FEUILLES).map(k => [k, k in A ? A[k] : {}]).filter(([, a]) => a);
    });
    for (const [k, a] of feuilles) await voir("Feuille « " + k + " »", { f: ([k, a]) => { Nav.tab("jour"); Nav.toutFermer(); Nav.sheet(k, a); }, a: [k, a] });

    // Doublons dans les données : la montre relue deux fois de suite ne doit rien ajouter en double
    if (rempli) {
      const d = await p.evaluate(async () => {
        await synchroPolarJour(true).catch(() => {}); await importerSortiesPolar().catch(() => {}); await synchroPolarJour(true).catch(() => {}); await importerSortiesPolar().catch(() => {});
        const pb = [];
        for (const k of Object.keys(DEFAUTS)) {
          const v = DB.get(k);
          if (!Array.isArray(v)) continue;
          const ids = v.map(x => x && x.id).filter(x => x != null), dbl = ids.filter((x, i) => ids.indexOf(x) !== i);
          if (dbl.length) pb.push(k + " : identifiant en double (" + [...new Set(dbl)].slice(0, 3).join(", ") + ")");
        }
        const unique = (k, cle, quoi) => { const v = (DB.get(k) || []).map(cle).filter(x => x != null && x !== ""), dbl = v.filter((x, i) => v.indexOf(x) !== i); if (dbl.length) pb.push(k + " : " + quoi + " (" + [...new Set(dbl)].slice(0, 3).join(", ") + ")"); };
        unique("recup-logs", l => l.dateISO, "deux formes du matin le même jour");
        unique("nutri-logs", l => l.dateISO, "deux journées repas le même jour");
        unique("mensurations", l => l.dateISO, "deux mesures le même jour");
        unique("natation-logs", l => l.polarId, "la même nage de la montre ajoutée deux fois");
        unique("sport-logs", l => l.dateISO + " " + l.seance, "la même séance notée deux fois");
        unique("polar-seances", l => l.id, "la même séance de la montre importée deux fois");
        return { pb, nages: DB.get("natation-logs").length, sorties: DB.get("polar-seances").length };
      });
      d.pb.length ? d.pb.forEach(x => ko("Doublon dans les données : " + x)) : ok("Aucun doublon dans les données, même en relisant la montre deux fois (" + d.sorties + " séances de la montre, " + d.nages + " nages)");
    }
    await ctx.close();
  }

  try { await passage("app vide", false); await passage("app remplie", true); }
  finally { await b.close(); serveur.close(); }

  const parPassage = n => vues.filter(v => v.passage === n);
  ["app vide", "app remplie"].forEach(n => {
    const v = parPassage(n), plantes = v.filter(x => x.plante || x.erreurs.length);
    plantes.length ? plantes.forEach(x => ko(n + " — " + x.lieu + " : " + (x.erreurs[0] || x.err || "l'écran a planté").replace(n + " : ", ""))) : ok(n + " : " + v.length + " écrans ouverts, aucun ne plante");
  });
  vues.filter(v => v.rate).forEach(v => ko(v.passage + " — " + v.lieu + " : la rubrique n'a pas pu être ouverte (vérification incomplète)"));
  const debords = vues.filter(v => v.debord || v.depasse.length);
  debords.length ? debords.forEach(v => avert(v.passage + " — " + v.lieu + " : dépasse sur le côté " + (v.depasse.slice(0, 2).join(" ; ") || "(page plus large que l'écran)"))) : ok("Rien ne dépasse sur le côté");
  const coupes = vues.filter(v => v.coupes.length);
  coupes.length ? coupes.forEach(v => avert(v.passage + " — " + v.lieu + " : coupé sur le bord (rogné) " + v.coupes.slice(0, 2).join(" ; "))) : ok("Rien de rogné sur le bord");
  const dbl = vues.filter(v => v.titres.length || v.textes.length);
  dbl.length ? dbl.forEach(v => avert(v.passage + " — " + v.lieu + " : en double à l'écran " + [...v.titres, ...v.textes].slice(0, 3).join(" ; "))) : ok("Aucun titre ni texte en double sur un même écran");
  const autres = erreursPage.filter(e => !vues.some(v => v.erreurs.includes(e)));
  autres.forEach(e => ko("Erreur pendant le chargement — " + e));
}

(async () => {
  if (!SANS_NAV) await navigateur().catch(e => ko("La vérification à l'écran n'a pas pu aller au bout : " + e.message.split("\n")[0]));
  else { titre("4. À l'écran"); avert("Pas faite (--sans-navigateur)"); }
  console.log("VÉRIFICATION AVANT PUBLICATION — Ensō" + rapport.join("\n"));
  console.log("\n" + (bloquants.length ? "✗ " + bloquants.length + " problème(s) bloquant(s) : ne pas publier avant de les corriger." : "✓ Rien de bloquant.") + (aRegarder.length ? "  ⚠ " + aRegarder.length + " point(s) à regarder." : ""));
  console.log("Reste à faire à la main : pour chaque nouveauté, passer les onglets de la partie 3 (et le coach, la sauvegarde, LISEZMOI.md, ARBITRAGES.md).");
  process.exit(bloquants.length ? 1 : 0);
})();
