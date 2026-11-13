"use strict";
/* CORPS — « Est-ce que ça marche ? »
 * La tendance de poids, la composition, la forme, les mensurations, les photos. */
const PLAGES = [["1 mois", 31], ["3 mois", 92], ["Tout", 9999]];

function EcranCorps() {
  useDB();
  const [plage, setPlage] = useState(92), t = tendancePoids(), auj = aujourdhui(), pr = profil();
  const der = t.length ? t[t.length - 1] : null, prem = t[0], ry = rythme(), compo = composition(), cl = compo.length ? compo[compo.length - 1] : null;
  const pts = t.filter(p => ecart(p.dateISO, auj) <= plage).map(p => ({ x: p.dateISO, y: arrondi(p.t, 2), brut: p.kg }));
  const obj = pr.objectifKg, eta = der && obj && ry.kg ? dateObjectif(der.t, ry.kg, obj) : null;
  const forme = historiqueForme(14), notes = forme.filter(j => j.score != null), r = recuperation(auj);
  const mens = DB.get("mensurations"), m = mens.length ? mens[mens.length - 1] : null, m0 = mens[0];
  const photos = DB.get("photos-index");
  return h("div.page", { "data-t": "corps" },
    h("header.hero", { "data-ton": "corps" },
      h("span.affiche-e", "Ta tendance"),
      h("div.affiche-g", h(Geant, null, der ? h(Compteur, { v: nb1(der.t) }) : "—"), h("em", "kg")),
      h("p", der ? (prem && prem !== der ? signe(arrondi(der.t - prem.t)) + " kg depuis le " + dateJour(prem.dateISO) : "Première pesée enregistrée") + (ry.kg != null ? ". Rythme : " + signe(ry.kg, 2) + " kg par semaine." : ".") : "Pèse-toi pour lancer ta courbe."),
      der && h("p.pesee-j", (der.dateISO === auj ? "Ce matin : " : "Dernière pesée, " + dateJour(der.dateISO) + " : ") + nb1(der.kg) + " kg. La tendance bouge doucement pour gommer l'eau : c'est elle qui compte."),
      h("div.hero-b", h(Bouton, { cl: "noir", ico: "plus", onClick: () => Nav.sheet("pesee") }, "Me peser"), h(Bouton, { cl: "contour-n", onClick: () => Nav.sheet("bilan") }, "Bilan de la semaine"))),
    h("div.corps-p",
      h(Section, null,
        h(Puces, null, PLAGES.map(([l, v]) => h(Puce, { key: v, actif: plage === v, onClick: () => setPlage(v) }, l))),
        pts.length >= 2 ? h(Courbe, { pts, unite: "kg", ton: "corps", haut: 200, repere: obj && Math.abs(obj - pts[pts.length - 1].y) < 4 ? obj : null }) : h(Vide, null, "Ta courbe apparaîtra dès la deuxième pesée."),
        h("p.note", "Le trait ignore les variations d'eau, les points sont tes pesées.")),
      h(Section, { titre: "Objectif" }, h("div.deux",
        h(Champ, { etiquette: "Poids visé", valeur: obj || null, mode: "dec", unite: "kg", pas: [.5, 1], min: 30, max: 300, onChange: v => setProfil({ objectifKg: v }) }),
        h("p.texte-p", !obj ? "Fixe un poids pour voir la date d'arrivée." : !eta ? "Il faut un rythme de perte pour estimer la date." : eta.atteignable ? "À ce rythme : " + dateDe(eta.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) + ", dans " + nb(eta.semaines, 0) + " semaines." : "Ta tendance ne va pas vers ce poids."))),
      h(Section, { titre: "Composition", droite: cl ? h("span.compte", "méthode Navy, " + dateMini(cl.dateISO)) : null },
        cl?.bf != null ? h(Fragment, null,
          h("div.tuiles", h(Tuile, { v: nb(cl.bf) + " %", l: "de gras" }), h(Tuile, { v: cl.lean != null ? nb(cl.lean) : "—", l: "kg maigres" }), h(Tuile, { v: cl.fat != null ? nb(cl.fat) : "—", l: "kg de gras" })),
          compo.filter(c => c.lean != null).length >= 2 && h(Courbe, { pts: compo.filter(c => c.lean != null).map(c => ({ x: c.dateISO, y: c.lean })), unite: "kg maigres", ton: "corps", haut: 120 }))
          : h(Vide, null, "Note ton tour de taille et ton tour de cou pour estimer ta composition."),
      ),
      h(Section, { titre: "Forme", droite: h(Lien, { onClick: () => Nav.sheet("forme") }, "Le détail") },
        notes.length ? h(Fragment, null,
          h("div.tuiles", h(Tuile, { v: r?.score ?? "—", l: "ce matin", ton: r?.verdict?.ton }), h(Tuile, { v: Math.round(moyenne(notes.map(j => j.score))), l: "moyenne 14 j" }), h(Tuile, { v: sommeil().dette >= .5 ? dureeHM(sommeil().dette) : "0", l: "dette de sommeil" })),
          h(Barres, { pts: forme.map(j => ({ l: JOURS_L[(jourSem(j.iso) + 6) % 7], v: j.score || 0 })), ton: "corps", haut: 100 }))
          : h(Vide, null, "Ta forme apparaîtra après ta première saisie du matin.")),
      h(Section, { titre: "Mensurations", droite: h(Lien, { onClick: () => Nav.sheet("mensurations") }, "Mesurer") },
        m ? h("div.table-m", MENSURATIONS.filter(c => m.vals[c.k] != null).map(c => { const d = m0 && m0 !== m && m0.vals[c.k] != null ? m.vals[c.k] - m0.vals[c.k] : null; return h("button", { key: c.k, onClick: () => Nav.sheet("mensurations", { voir: c.k }) }, h("span", c.l), h("b", nb(m.vals[c.k]) + " cm"), d != null && h("small", signe(arrondi(d), 1))); }))
          : h(Vide, null, "Toutes les 2 à 4 semaines, à jeun, au même moment.")),
      h(Section, { titre: "Suivi" },
        h(Rangee, { ico: "photo", titre: "Photos", sous: photos.length ? pluriel(photos.length, "photo") + ", avant / après" : "Face, profil, dos", onClick: () => Nav.sheet("photos") }))));
}

function FeuillePesee({ iso }) {
  useDB();
  const jour = iso || aujourdhui(), n = DB.get("nutri-logs").find(l => l.dateISO === jour), pts = pesees();
  const ref = n?.weight || (pts.length ? pts[pts.length - 1].kg : 100);
  const [v, setV] = useState(ref), min = Math.floor(ref) - 12, max = Math.ceil(ref) + 12;
  const delta = pts.length ? arrondi(v - pts[pts.length - 1].kg) : null;
  const ok = async () => { await ecrireJour(jour, { weight: arrondi(v) }); Nav.fermer(); toast(nb1(v) + " kg enregistrés"); };
  const taper = async () => { const r = await saisir({ titre: "Poids", valeur: v, mode: "dec", unite: "kg", pas: [.1, .5], min: 25, max: 350 }); if (r) setV(r); };
  return h(Feuille, { titre: "Pesée", ton: "corps" },
    h("button.pesee-v", { onClick: taper }, h("b", nb1(v)), h("em", "kg")),
    h("p.sous-t.centre", delta != null && !n?.weight ? signe(delta) + " kg depuis la dernière pesée" : "Glisse la règle ou touche le chiffre"),
    h(Regle, { valeur: v, onChange: setV, min, max }),
    h("div.pas-b", [-.1, .1].map(d => h("button.mini", { key: d, onClick: () => { vibre(); setV(arrondi(v + d)); } }, (d > 0 ? "+" : "−") + "0,1"))),
    h(Bouton, { cl: "plein grand", onClick: ok }, "Enregistrer"));
}

/* Saisie du matin : quatre chiffres Polar à la suite, sans jamais ouvrir le clavier du téléphone */
const CHAMPS_MATIN = [
  { k: "ans", t: "Statut SNA", court: "SNA", mode: "signe", u: "", i: "Recharge nocturne, de −10 à +10", pas: [.5], min: -10, max: 10 },
  { k: "rmssd", t: "VFC", court: "VFC", mode: "ent", u: "ms", i: "Recharge nocturne, moyenne de la nuit", pas: [1], min: 5, max: 300 },
  { k: "fc", t: "FC nocturne", court: "FC", mode: "ent", u: "bpm", i: "Recharge nocturne, moyenne de la nuit", pas: [1], min: 25, max: 130 },
  { k: "sleep", t: "Sommeil", court: "Sommeil", mode: "hm", u: "", i: "Tape 7, 4, 5 pour 7 h 45", pas: [.25], min: 0, max: 15.9 },
];
function FeuilleMatin({ iso, auto }) {
  useDB();
  const jour = iso || aujourdhui(), ex = useMemo(() => DB.get("recup-logs").find(l => l.dateISO === jour), []);
  const veille = useMemo(() => [...DB.get("recup-logs")].filter(l => l.dateISO < jour).sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0], []);
  const [vals, setVals] = useState({ ans: ex?.ans ?? null, rmssd: ex?.rmssd ?? null, fc: ex?.fc ?? null, sleep: ex?.sleep ?? null });
  const [tags, setTags] = useState(ex?.tags || []), [etape, setEtape] = useState(0), [fini, setFini] = useState(false);
  const c = CHAMPS_MATIN[etape] || null, [txt, setTxt] = useState(texteDepuis(vals.ans, "signe")), [neuf, setNeuf] = useState(true);
  const lu = () => c ? valeurDepuis(txt, c.mode) : null;
  const garde = () => {
    if (!c) return vals;
    const v = lu(), n = { ...vals, [c.k]: v == null ? null : borne(v, c.min, c.max) };
    setVals(n);
    return n;
  };
  const aller = k => { garde(); setEtape(k); setNeuf(true); if (k < 4) setTxt(texteDepuis(vals[CHAMPS_MATIN[k].k] ?? (k === etape ? lu() : null), CHAMPS_MATIN[k].mode)); };
  const suivant = () => {
    const n = garde();
    setEtape(etape + 1); setNeuf(true);
    if (etape < 3) setTxt(texteDepuis(n[CHAMPS_MATIN[etape + 1].k], CHAMPS_MATIN[etape + 1].mode));
  };
  const enregistrer = async () => {
    const v = vals, e = { id: ex?.id || Date.now(), dateISO: jour, ans: v.ans == null ? null : arrondi(v.ans), rmssd: v.rmssd == null ? null : Math.round(v.rmssd), fc: v.fc == null ? null : Math.round(v.fc), sleep: v.sleep > 0 ? arrondi(v.sleep, 2) : null, tags };
    if (e.ans == null && e.rmssd == null && e.fc == null && e.sleep == null) return toast("Remplis au moins un chiffre", { danger: true });
    await DB.set("recup-logs", [...DB.get("recup-logs").filter(l => l.dateISO !== jour), e].sort((a, b) => a.dateISO.localeCompare(b.dateISO)));
    setFini(true);
  };
  // Remplit les quatre chiffres depuis la Recharge nocturne de la montre Polar
  const [charge, setCharge] = useState(false), polar = lienPolar();
  const depuisPolar = async () => {
    setCharge(true);
    try {
      const m = await matinPolar(jour), n = { ...garde() };
      let k = 0;
      CHAMPS_MATIN.forEach(x => { if (m[x.k] != null) { n[x.k] = borne(m[x.k], x.min, x.max); k++; } });
      if (!k) return toast("Polar n'a pas encore de nuit pour ce jour. Synchronise ta montre avec Polar Flow, puis réessaie.", { danger: true });
      // Tout est là : on passe aux étiquettes ; sinon on s'arrête sur le premier chiffre manquant
      const manque = CHAMPS_MATIN.findIndex(x => n[x.k] == null);
      setVals(n); setNeuf(true); setEtape(manque < 0 ? 4 : manque);
      if (manque >= 0) setTxt("");
      toast(k + " chiffre" + (k > 1 ? "s" : "") + " récupéré" + (k > 1 ? "s" : "") + " depuis ta montre" + (manque >= 0 ? ". Complète le reste à la main." : ""));
    } catch (e) { toast("Polar : " + e.message, { danger: true }); }
    finally { setCharge(false); }
  };
  // Ouverte depuis la notification « Ta nuit est arrivée » : on remplit tout de suite
  useEffect(() => { if (auto && polar?.jeton) depuisPolar(); }, []);
  const r = fini ? recuperation(jour) : null;
  if (fini) return h(Feuille, { plein: true, sansTete: true, ton: "corps" },
    h("div.resultat", { "data-ton": r?.verdict?.ton || "papier" },
      h("span.affiche-e", "Ta forme ce matin"),
      r?.score != null ? h(Fragment, null, h(Geant, null, h(Compteur, { v: r.score })), h("h2", r.verdict.t), h("p", r.conseil)) : h("h2", "Saisie enregistrée"),
      h("div.hero-b", h(Bouton, { cl: "noir", onClick: Nav.fermer }, "Compris"), r?.score != null && h(Bouton, { cl: "contour-n", onClick: () => { Nav.fermer(); Nav.sheet("forme"); } }, "Le détail"))));
  const fmtVal = (k, v) => v == null ? "—" : k.mode === "hm" ? dureeHM(v) : k.mode === "signe" ? signe(v) : nb(v);
  return h(Feuille, { titre: "Forme du matin", ton: "corps" },
    polar?.jeton && h(Bouton, { cl: "contour polar-matin" + (charge ? " occupe" : ""), ico: "coeur", disabled: charge, onClick: depuisPolar }, charge ? "Lecture de ta nuit…" : "Récupérer depuis ma montre Polar"),
    h("div.pave-etapes.matin", CHAMPS_MATIN.map((x, k) => h("button", { key: x.k, className: k === etape ? "actif" : "", onClick: () => aller(k) }, h("small", x.court), h("b", k === etape ? (neuf && !txt ? "…" : affichage(txt, x.mode)) : fmtVal(x, vals[x.k]))))),
    c ? h(Fragment, null,
      h("div.pave-v", { className: neuf ? "neuf" : "" }, h("b", txt || !veille?.[c.k] ? affichage(txt, c.mode) : fmtVal(c, veille[c.k])), c.u && h("em", c.u)),
      h("p.pave-i", !txt && veille?.[c.k] != null ? "Hier : " + fmtVal(c, veille[c.k]) + ". " + c.i : c.i),
      h(Clavier, { mode: c.mode, txt, setTxt, neuf, setNeuf, pas: c.pas, min: c.min, max: c.max, valeurNum: () => lu() ?? veille?.[c.k] ?? 0, onOk: suivant, ok: "Suivant" }))
    : h(Fragment, null,
      h(Section, { titre: "Hier soir, quelque chose à signaler ?" }, h(Puces, null, ETIQUETTES.map(([k, l]) => h(Puce, { key: k, actif: tags.includes(k), onClick: () => setTags(tags.includes(k) ? tags.filter(x => x !== k) : [...tags, k]) }, l)))),
      h("p.note", "Facultatif. Au fil des semaines, je te dirai ce qui joue vraiment sur ta forme."),
      h(Bouton, { cl: "plein grand", onClick: enregistrer }, "Voir ma forme")));
}

function FeuilleForme() {
  useDB();
  const auj = aujourdhui(), r = recuperation(auj), h14 = historiqueForme(14), rl = DB.get("recup-logs"), s = sommeil(), inf = influences();
  const vfc = [...rl].filter(l => l.rmssd > 0 && ecart(l.dateISO, auj) <= 30).map(l => ({ x: l.dateISO, y: l.rmssd }));
  const nuits = [...rl].filter(l => l.sleep > 0 && ecart(l.dateISO, auj) <= 13).map(l => ({ l: JOURS_L[(jourSem(l.dateISO) + 6) % 7], v: arrondi(l.sleep) }));
  const TAG = { m: "mesuré", c: "calculé", e: "estimé" };
  return h(Feuille, { titre: "Ta forme", ton: "corps" },
    r?.score != null ? h(Fragment, null,
      h("div.forme-t", { "data-ton": r.verdict.ton }, h("b", r.score), h("div", h("strong", r.verdict.t), h("p", r.conseil))),
      h(Section, { titre: "Ce qui compose ton score" }, ORDRE_FACTEURS.filter(k => r.parts[k] != null || r.det[k].length).map(k => h("details.facteur", { key: k, open: k === r.lowest },
        h("summary", h("span", NOM_FACTEUR[k]), r.parts[k] != null ? h(Fragment, null, h(Jauge, { v: r.parts[k], max: 100, ton: tonFacteur(r.parts[k]) }), h("b", Math.round(r.parts[k]))) : h("small", "en attente")),
        r.det[k].map(([t, ty], i) => h("p", { key: i }, t, h("em", TAG[ty]))))))) : h(Bouton, { cl: "plein", onClick: () => { Nav.fermer(); Nav.sheet("matin"); } }, "Faire ma saisie du matin"),
    h(Section, { titre: "Ce qui joue sur ta forme" }, inf.liste.length ? h("div.liste", inf.liste.map(x => h("div.influence", { key: x.nom, "data-sens": x.ecart > 0 ? "plus" : "moins" }, h("b", (x.ecart > 0 ? "+" : "−") + Math.abs(x.ecart)), h("span", x.nom), h("small", x.n + " matins")))) : h(Vide, null, "Encore quelques matins et je te dirai ce qui fait monter ou baisser ton score (" + inf.matins + " pour l'instant).")),
    h(Section, { titre: "Sommeil" },
      h("div.tuiles", h(Tuile, { v: s.moyenne ? dureeHM(s.moyenne) : "—", l: "moyenne 7 nuits" }), h(Tuile, { v: dureeHM(s.dette), l: "dette sur 7 nuits" }), h(Tuile, { v: hhmm(s.coucher), l: "coucher conseillé" })),
      nuits.length >= 2 && h(Barres, { pts: nuits, ton: "corps", haut: 100, unite: " h", cible: SOMMEIL_CIBLE })),
    h(Section, { titre: "Score sur 14 jours" }, h(Barres, { pts: h14.map(j => ({ l: JOURS_L[(jourSem(j.iso) + 6) % 7], v: j.score || 0 })), ton: "corps", haut: 110 })),
    vfc.length >= 2 && h(Section, { titre: "VFC sur 30 jours" }, h(Courbe, { pts: vfc, unite: "ms", ton: "corps", haut: 120 })),
    h("p.note", "Ce score n'est pas un avis médical. Il résume tes mesures et tes données pour orienter ta séance."));
}

function FeuilleMensurations({ voir }) {
  useDB();
  const mens = DB.get("mensurations"), der = mens[mens.length - 1], [k, setK] = useState(voir || "taille"), auj = aujourdhui();
  const mesurer = async () => {
    const r = await saisir(MENSURATIONS.map(c => ({ titre: c.l, court: c.l.replace("Tour de ", ""), valeur: mens.find(x => x.dateISO === auj)?.vals[c.k] ?? null, mode: "dec", unite: "cm", pas: [.5, 1], min: 0, max: 250, indice: der?.vals[c.k] != null ? "Dernière mesure : " + nb(der.vals[c.k]) + " cm" : null })));
    if (!r) return;
    const vals = {};
    MENSURATIONS.forEach((c, i) => { if (r[i] != null && r[i] > 0) vals[c.k] = r[i]; });
    if (!Object.keys(vals).length) return;
    await DB.set("mensurations", [...mens.filter(x => x.dateISO !== auj), { id: Date.now(), dateISO: auj, date: dateCourte(auj), vals }].sort((a, b) => a.dateISO.localeCompare(b.dateISO)));
    toast("Mesures enregistrées");
  };
  const pts = mens.filter(m => m.vals[k] != null).map(m => ({ x: m.dateISO, y: m.vals[k] }));
  return h(Feuille, { titre: "Mensurations", ton: "corps" },
    h(Bouton, { cl: "plein", onClick: mesurer }, "Nouvelles mesures"),
    h(Puces, { defile: true }, MENSURATIONS.map(c => h(Puce, { key: c.k, actif: k === c.k, onClick: () => setK(c.k) }, c.l.replace("Tour de ", "")))),
    pts.length >= 2 ? h(Courbe, { pts, unite: "cm", ton: "corps" }) : h(Vide, null, "Deux mesures suffisent pour voir une courbe."),
    h(Section, { titre: "Historique" }, [...mens].reverse().slice(0, 10).map(m => h("div.histo", { key: m.id }, h("span", dateMini(m.dateISO)), h("b", m.vals[k] != null ? nb(m.vals[k]) + " cm" : "—"), h("button.mini-x", { "aria-label": "Supprimer", onClick: () => avecAnnuler("mensurations", DB.get("mensurations").filter(x => x.id !== m.id), "Mesure supprimée") }, h(Icone, { n: "fermer", t: 16 }))))));
}

/* Photos : compressées, stockées à part, comparées au curseur */
function compresser(fichier, max = 900, q = .68) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const f = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", q));
      };
      img.onerror = ko;
      img.src = r.result;
    };
    r.onerror = ko;
    r.readAsDataURL(fichier);
  });
}
function Comparateur({ a, b }) {
  const [x, setX] = useState(50), z = useRef(null);
  const glisse = e => { const r = z.current.getBoundingClientRect(); setX(borne(((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * 100)); };
  return h("div.compare", { ref: z, onTouchMove: glisse, onTouchStart: glisse, onPointerDown: glisse, onPointerMove: e => { if (e.buttons) glisse(e); } },
    h("img", { src: b, alt: "Après" }),
    h("img.haut", { src: a, alt: "Avant", style: { clipPath: `inset(0 ${100 - x}% 0 0)` } }),
    h("i", { style: { left: x + "%" } }));
}
function FeuillePhotos() {
  useDB();
  const idx = DB.get("photos-index"), [type, setType] = useState("face"), [images, setImages] = useState({}), [occupe, setOccupe] = useState(false), auj = aujourdhui();
  const [cmpA, setA] = useState(null), [cmpB, setB] = useState(null);
  useEffect(() => { let vivant = true; (async () => { for (const p of idx) { if (images[p.id]) continue; const d = await DB.lireBrut("photo:" + p.id); if (vivant && d) setImages(m => ({ ...m, [p.id]: d })); } })(); return () => { vivant = false; }; }, [idx.length]);
  const ajoute = async f => {
    if (!f) return;
    setOccupe(true);
    try {
      const data = await compresser(f), id = Date.now();
      if (await DB.brut("photo:" + id, data)) { setImages(m => ({ ...m, [id]: data })); await DB.set("photos-index", [...idx, { id, dateISO: auj, date: dateCourte(auj), type }]); toast("Photo ajoutée"); }
      else toast("Stockage plein : exporte tes données puis supprime d'anciennes photos.", { danger: true });
    } catch (e) { toast("Impossible de lire cette image.", { danger: true }); }
    setOccupe(false);
  };
  const suppr = async p => {
    const data = images[p.id], avant = idx;
    await DB.supprimerBrut("photo:" + p.id);
    await DB.set("photos-index", idx.filter(x => x.id !== p.id));
    toast("Photo supprimée", { annuler: data ? async () => { await DB.brut("photo:" + p.id, data); await DB.set("photos-index", avant); } : null });
  };
  const ordre = [...idx].sort((a, b) => a.dateISO.localeCompare(b.dateISO)), memeType = ordre.filter(p => p.type === type);
  const A = cmpA ? idx.find(p => p.id === cmpA) : memeType[0], B = cmpB ? idx.find(p => p.id === cmpB) : memeType[memeType.length - 1];
  const LIB = { face: "Face", profil: "Profil", dos: "Dos" };
  return h(Feuille, { titre: "Photos", ton: "corps" },
    h(Puces, null, Object.entries(LIB).map(([k, l]) => h(Puce, { key: k, actif: type === k, onClick: () => { setType(k); setA(null); setB(null); } }, l))),
    A && B && A !== B && images[A.id] && images[B.id] && h(Section, { titre: "Avant / après", droite: h("span.compte", dateMini(A.dateISO) + " → " + dateMini(B.dateISO)) }, h(Comparateur, { a: images[A.id], b: images[B.id] }), h("p.note", "Fais glisser le trait.")),
    h("label.bouton.plein", { className: occupe ? "occupe" : "" }, occupe ? "Compression…" : "Ajouter une photo (" + LIB[type].toLowerCase() + ")",
      h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { ajoute(e.target.files?.[0]); e.target.value = ""; } })),
    h("p.note", "Garde le même cadrage et la même lumière. Les photos restent sur ton téléphone."),
    h("div.grille-ph", [...idx].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).map(p => h("figure", { key: p.id },
      images[p.id] ? h("img", { src: images[p.id], alt: LIB[p.type] + " du " + p.date }) : h("span", "…"),
      h("figcaption", dateMini(p.dateISO) + ", " + (LIB[p.type] || p.type).toLowerCase()),
      h("button.mini-x", { "aria-label": "Supprimer", onClick: () => suppr(p) }, h(Icone, { n: "fermer", t: 14 }))))));
}

/* BILAN DE LA SEMAINE — plein écran, une idée par écran, on touche pour avancer */
function FeuilleBilan() {
  useDB();
  useDiscret();
  const b = bilanSemaine(), [i, setI] = useState(0), cal = cfgCalories(), dep = b.depenseReelle, ry = b.rythme;
  const decision = (() => {
    if (ry.nouveau != null) return { g: signe(cal.deficit - ry.nouveau, 0), u: "kcal", t: (ry.etat === "vite" ? "Tu perds un peu vite." : "Ta perte ralentit trop.") + " Je passe ton déficit de " + cal.deficit + " à " + ry.nouveau + " kcal.", l: "Oui, ajuste", run: () => appliquerDeficit(ry.nouveau) };
    if (dep.pret && Math.abs(dep.ecart) >= 150 && cal?.depense !== dep.kcal) return { g: entier(dep.kcal), u: "kcal", t: "Ton corps dépense " + entier(dep.kcal) + " kcal, soit " + signe(dep.ecart, 0) + " par rapport à la formule. J'adopte ce chiffre pour ta cible ?", l: "Oui, adopte", run: () => DB.set("nutri-cal-cfg", { ...DB.get("nutri-cal-cfg"), depense: dep.kcal, lastAdjust: aujourdhui() }) };
    return { g: "Cap", t: "Rien à changer : ton rythme est bon. On garde le cap." };
  })();
  const ecrans = [
    { ton: "corps", e: "Ton poids", g: b.deltaPoids != null ? signe(b.deltaPoids) : b.poids != null ? nb1(b.poids) : "—", u: "kg", p: b.poids != null ? "Tendance à " + nb1(b.poids) + " kg." + (ry.pct != null ? " Soit " + signe(ry.pct) + " % par semaine, " + (ry.etat === "ideal" ? "pile dans la zone." : ry.etat === "vite" ? "un peu trop vite." : "en dessous de la zone.") : "") : "Pèse-toi pour que je suive ta tendance." },
    { ton: "sport", e: "Tes séances", g: b.seances + "/" + b.prevues, p: nb(b.volume / 1000) + " tonnes soulevées" + (b.volumePrec ? " (" + signe((b.volume - b.volumePrec) / b.volumePrec * 100, 0) + " %)" : "") + (b.records.length ? ", " + pluriel(b.records.length, "record") + " : " + b.records.slice(0, 2).map(r => r.nom + " " + nb(r.kg) + " kg").join(", ") : "") + "." },
    { ton: "repas", e: "Tes repas", g: b.suivi != null ? b.suivi + " %" : "—", p: (b.kcal ? entier(b.kcal) + " kcal par jour en moyenne. " : "") + (b.suivi >= 80 ? "Belle régularité." : b.suivi != null ? "Vise 80 % : c'est là que tout se joue." : "Coche tes repas pour que je suive.") },
    { ton: "papier", e: "Ta forme", g: b.forme != null ? b.forme : "—", u: "/100", p: (b.formePrec != null && b.forme != null ? signe(b.forme - b.formePrec, 0) + " par rapport à la semaine d'avant. " : "") + (b.sommeil ? "Sommeil moyen : " + dureeHM(b.sommeil) + "." : "") },
    { ton: "argent", e: "Ton argent", g: Discret.cache() ? "•••" : entier(b.depense), u: "€", p: "dépensés en 7 jours. Il te reste " + eurosD(Math.max(0, bilanCourant().reste)) + (bilanCourant().civil ? " ce mois-ci." : " jusqu'à ta paye.") },
    // Une fois par semaine, la sauvegarde (sauf si elle est récente)
    ...(ageSauvegarde() == null || ageSauvegarde() >= 6 ? [{ ton: "papier", e: "Ta sauvegarde", g: ageSauvegarde() == null ? "Jamais" : ageSauvegarde() + " j", u: ageSauvegarde() == null ? "" : "sans", sauve: true,
      p: "Tout RECOMP vit sur ce téléphone. Sauvegarde, puis choisis « Enregistrer dans Fichiers » et un dossier iCloud Drive : même si tu perds ton téléphone, tu retrouves tout." }] : []),
    { ton: "noir", e: "Ma décision", g: decision.g, u: decision.u, p: decision.t, fin: true },
  ];
  const e = ecrans[i];
  return h(Feuille, { plein: true, sansTete: true },
    h("div.story", { "data-ton": e.ton, onClick: ev => { const g = ev.clientX < window.innerWidth * .3; setI(borne(i + (g ? -1 : 1), 0, ecrans.length - 1)); } },
      h("div.story-p", ecrans.map((_, k) => h("i", { key: k, className: k <= i ? "fait" : "" }))),
      h("button.rond.story-x", { onClick: ev => { ev.stopPropagation(); Nav.fermer(); }, "aria-label": "Fermer" }, h(Icone, { n: "fermer", t: 20 })),
      h("div.story-c", { key: i },
        h("span.affiche-e", e.e),
        e.g != null && h("div.affiche-g", h(Geant, null, e.g), e.u && h("em", e.u)),
        h("p", e.p),
        e.sauve && h("div.hero-b", h(Bouton, { cl: "noir", onClick: async ev => { ev.stopPropagation(); const r = await exporter(); if (r === "partage" || r === "telecharge") setI(i + 1); } }, "Sauvegarder maintenant")),
        e.fin && h("div.hero-b", decision.l && h(Bouton, { cl: "plein", onClick: async ev => { ev.stopPropagation(); await decision.run(); toast("C'est fait : ton menu suit"); Nav.fermer(); } }, decision.l), h(Bouton, { cl: "contour", onClick: ev => { ev.stopPropagation(); Nav.fermer(); } }, decision.l ? "Pas cette fois" : "Fermer"))),
      i < ecrans.length - 1 && h("small.story-s", "Touche pour continuer")));
}
