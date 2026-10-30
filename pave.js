"use strict";
/* PAVÉ NUMÉRIQUE — remplace le clavier du téléphone pour tous les chiffres de l'app.
 * Le clavier numérique de l'iPhone n'a ni « − » ni « : ». Ici : touche ± pour le signe, et les durées
 * se tapent comme sur un micro-ondes : 7, 4, 5 donne 7 h 45 ; 3, 8, 3, 0 donne 38:30.
 *
 * Modes : "ent" (entier), "dec" (décimal), "signe" (décimal signé), "hm" (heures + minutes, renvoie des heures),
 *         "ms" (minutes:secondes, renvoie des secondes).
 * saisir({ titre, valeur, mode, unite, pas, min, max }) renvoie une promesse : la valeur, ou null si annulé.
 * Plusieurs champs d'affilée : saisir([{…}, {…}], { suite }) avec un bouton « Suivant ». */

const texteDepuis = (v, mode) => {
  if (v == null || v === "") return "";
  if (mode === "hm") { const H = Math.floor(v), M = Math.round((v - H) * 60); return M === 60 ? String(H + 1) + "00" : String(H) + pad2(M); }
  if (mode === "ms") { const s = Math.round(v); return String(Math.floor(s / 60)) + pad2(s % 60); }
  return String(v).replace(".", ",");
};
function valeurDepuis(txt, mode) {
  if (!txt || txt === "-") return null;
  if (mode === "hm") { const n = txt.padStart(3, "0"), h = +n.slice(0, -2), m = Math.min(59, +n.slice(-2)); return h + m / 60; }
  if (mode === "ms") { const n = txt.padStart(3, "0"), a = +n.slice(0, -2), s = Math.min(59, +n.slice(-2)); return a * 60 + s; }
  const v = parseFloat(txt.replace(",", "."));
  return isFinite(v) ? v : null;
}
function affichage(txt, mode) {
  if (mode === "hm") { const n = (txt || "").padStart(3, "0"); return +n.slice(0, -2) + " h " + n.slice(-2); }
  if (mode === "ms") { const n = (txt || "").padStart(3, "0"); return +n.slice(0, -2) + ":" + n.slice(-2); }
  return (txt || "0").replace("-", "−");
}
const estDuree = mode => mode === "hm" || mode === "ms";

/* Le clavier seul : utilisé dans le panneau flottant et directement dans certains écrans */
function Clavier({ mode, txt, setTxt, neuf, setNeuf, pas, onOk, ok, valeurNum, min, max }) {
  const frappe = c => {
    vibre();
    let t = neuf ? "" : txt;
    if (neuf) setNeuf(false);
    if (c === "⌫") { setTxt(neuf ? "" : txt.slice(0, -1)); return; }
    if (c === ",") {
      if (mode === "ent" || estDuree(mode) || t.includes(",")) return;
      t = (t === "" || t === "-" ? t + "0" : t) + ",";
    } else {
      const d = t.split(",")[1];
      if (d != null && d.length >= 2) return;
      if (t === "0") t = "";
      if (t === "-0") t = "-";
      t += c;
      if (t.replace(/\D/g, "").length > (estDuree(mode) ? 6 : 7)) return;
    }
    setTxt(t);
  };
  const ajuste = d => {
    vibre();
    const base = valeurNum() ?? 0;
    let v = arrondi(base + d, 2);
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    setNeuf(true);
    setTxt(texteDepuis(v, mode));
  };
  const signe = () => { vibre(); setNeuf(false); setTxt(txt.startsWith("-") ? txt.slice(1) : "-" + txt); };
  const [p1, p2] = pas || [];
  const libelle = d => (d > 0 ? "+" : "−") + (mode === "hm" ? Math.round(Math.abs(d) * 60) + " min" : mode === "ms" ? Math.abs(d) + " s" : nb(Math.abs(d), 2));
  const Tch = (c, o) => h("button.tch", { key: c, onClick: () => frappe(c), "aria-label": c === "⌫" ? "Effacer" : c, ...o }, c === "⌫" ? h("svg", { viewBox: "0 0 24 24", width: 26, height: 26, "aria-hidden": true }, h("path", { d: "M9 6h11v12H9l-6-6 6-6zM12 10l4 4M16 10l-4 4", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" })) : c);
  const Cote = (cle, contenu, faire, aria) => h("button.tch.cote", { key: cle, onClick: faire, "aria-label": aria }, contenu);
  return h("div.clavier",
    ["1", "2", "3"].map(c => Tch(c)),
    p1 != null ? Cote("p-", libelle(-p1), () => ajuste(-p1), "Retirer " + nb(p1, 2)) : h("span", { key: "v1" }),
    ["4", "5", "6"].map(c => Tch(c)),
    p1 != null ? Cote("p+", libelle(p1), () => ajuste(p1), "Ajouter " + nb(p1, 2)) : h("span", { key: "v2" }),
    ["7", "8", "9"].map(c => Tch(c)),
    mode === "signe" ? Cote("±", "+/−", signe, "Changer le signe") : p2 != null ? Cote("p2", libelle(p2), () => ajuste(p2), "Ajouter " + nb(p2, 2)) : h("span", { key: "v3" }),
    estDuree(mode) || mode === "ent" ? h("span", { key: "v4" }) : Tch(","),
    Tch("0"), Tch("⌫"),
    h("button.tch.ok", { key: "ok", onClick: onOk }, ok || "OK"));
}

/* Panneau flottant, un par application */
function HotePave() {
  const [q, setQ] = useState(null);
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState("");
  const [neuf, setNeuf] = useState(true);
  const vals = useRef([]);
  useEffect(() => bus.on("pave", ({ champs, res }) => {
    vals.current = champs.map(c => c.valeur ?? null);
    setQ({ champs, res }); setI(0); setNeuf(true);
    setTxt(texteDepuis(champs[0].valeur, champs[0].mode));
  }), []);
  if (!q) return null;
  const c = q.champs[i], mode = c.mode || "dec", dernier = i === q.champs.length - 1;
  const clore = v => { q.res(v); setQ(null); };
  const lit = () => valeurDepuis(txt, mode);
  const garde = () => { const v = lit(); vals.current[i] = v == null ? null : (c.min != null ? Math.max(c.min, c.max != null ? Math.min(c.max, v) : v) : c.max != null ? Math.min(c.max, v) : v); };
  const aller = k => { garde(); setI(k); setNeuf(true); setTxt(texteDepuis(vals.current[k], q.champs[k].mode)); };
  const valider = () => { garde(); if (dernier) clore(q.champs.length > 1 ? vals.current : vals.current[0]); else aller(i + 1); };
  return h(Fragment, null,
    h("div.voile.pave-voile", { onClick: () => clore(null) }),
    h("div.pave", { role: "dialog", "aria-modal": true, "aria-label": c.titre },
      q.champs.length > 1 && h("div.pave-etapes", q.champs.map((x, k) => h("button", { key: k, className: k === i ? "actif" : "", onClick: () => aller(k) },
        h("small", x.court || x.titre), h("b", k === i ? affichage(txt, mode) : vals.current[k] == null ? "—" : affichage(texteDepuis(vals.current[k], x.mode), x.mode))))),
      h("div.pave-t", h("span", c.titre), h("button.rond", { onClick: () => clore(null), "aria-label": "Annuler" }, h(Icone, { n: "fermer", t: 18 }))),
      h("div.pave-v", { className: neuf ? "neuf" : "" }, h("b", affichage(txt, mode)), c.unite && h("em", c.unite)),
      c.indice && h("p.pave-i", c.indice),
      c.presets && h(Puces, { defile: true }, c.presets.map(p => h(Puce, { key: p, onClick: () => { setNeuf(true); setTxt(texteDepuis(p, mode)); } }, nb(p, 2)))),
      h(Clavier, { mode, txt, setTxt, neuf, setNeuf, pas: c.pas, min: c.min, max: c.max, valeurNum: lit, onOk: valider, ok: dernier ? "OK" : "Suivant" })));
}
function saisir(champs) {
  const liste = Array.isArray(champs) ? champs : [champs];
  return new Promise(res => bus.emit("pave", { champs: liste, res }));
}

/* Un chiffre à toucher pour le modifier */
const Champ = ({ etiquette, valeur, texte, onChange, unite, mode, pas, min, max, titre, vide }) => h("button.champ", {
  onClick: async () => { const v = await saisir({ titre: titre || etiquette, valeur, mode, unite, pas, min, max }); if (v != null) onChange(v); },
}, etiquette && h("small", etiquette), h("b", texte ?? (valeur == null || valeur === "" ? (vide || "—") : nb(valeur, 2)), unite && h("em", " " + unite)));

/* Règle à faire glisser : la pesée sans clavier. Un trait = 0,1 kg. */
function Regle({ valeur, onChange, min, max }) {
  const r = useRef(null), PX = 12, ignore = useRef(false);
  const place = v => { if (r.current) { ignore.current = true; r.current.scrollLeft = (v - min) * 10 * PX; requestAnimationFrame(() => { ignore.current = false; }); } };
  useLayoutEffect(() => place(valeur), []);
  const dernier = useRef(valeur);
  useEffect(() => { if (Math.abs(valeur - dernier.current) > .049) { dernier.current = valeur; place(valeur); } }, [valeur]);
  const defile = () => {
    if (ignore.current) return;
    const v = arrondi(min + Math.round(r.current.scrollLeft / PX) / 10);
    if (v !== dernier.current) { dernier.current = v; onChange(v); }
  };
  const nbKg = Math.floor(max - min);
  return h("div.regle", h("i.regle-m", { "aria-hidden": true }),
    h("div.regle-s", { ref: r, onScroll: defile, role: "slider", "aria-label": "Poids", "aria-valuenow": valeur, "aria-valuemin": min, "aria-valuemax": max },
      h("div.regle-p", { style: { width: (max - min) * 10 * PX + "px" } },
        Array.from({ length: nbKg + 1 }, (_, i) => h("span", { key: i, style: { left: i * 10 * PX + "px" } }, Math.round(min) + i)))));
}
