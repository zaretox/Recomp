"use strict";
/* POLAR — liaison avec le service AccessLink de Polar, par la fonction Netlify « polar » qui garde la clé secrète.
 * Le jeton d'accès reste sur ce téléphone (clé « polar-lien », exclue des sauvegardes) ; rien n'est stocké côté serveur. */
const POLAR_FN = "/.netlify/functions/polar";
const polarRetour = () => location.origin + "/polar-retour.html";
const lienPolar = () => DB.get("polar-lien");

/* 1. Partir chez Polar pour donner son accord */
async function relierPolar() {
  let c = null;
  try { c = await fetch(POLAR_FN + "?action=config", { cache: "no-store" }).then(r => r.json()); } catch (e) { /* hors ligne */ }
  if (!c?.client_id) return toast(c?.message || "Liaison impossible pour l'instant : vérifie ta connexion et les clés Polar dans Netlify.", { danger: true });
  const etat = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem("recomp_polar_etat", etat); } catch (e) { /* le code sera à recopier */ }
  location.href = "https://flow.polar.com/oauth2/authorization?response_type=code&client_id=" + encodeURIComponent(c.client_id) + "&redirect_uri=" + encodeURIComponent(polarRetour()) + "&state=" + etat;
}

/* 2. Échanger le code contre un jeton (fait par la fonction, qui inscrit aussi l'utilisateur) */
async function finirLiaisonPolar(code) {
  const r = await fetch(POLAR_FN + "?action=jeton", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: String(code).trim(), redirect_uri: polarRetour() }) });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.jeton) throw new Error(d?.detail?.error_description || d?.detail?.error || d?.message || d?.erreur || "erreur " + r.status);
  try { localStorage.removeItem("recomp_polar_etat"); } catch (e) { /* rien */ }
  await DB.set("polar-lien", { jeton: d.jeton, utilisateur: d.utilisateur, depuis: aujourdhui(), expire: d.expire ? isoDe(new Date(Date.now() + d.expire * 1000)) : null });
}
async function collerCodePolar() {
  const code = window.prompt("Colle le code de liaison affiché par Polar :");
  if (!code || !code.trim()) return;
  try { await finirLiaisonPolar(code); toast("Montre Polar reliée"); }
  catch (e) { toast("Liaison refusée : " + e.message + ". Le code n'est valable que 10 minutes et une seule fois.", { danger: true }); }
}
/* Au démarrage : la page de retour a renvoyé le code dans l'adresse de l'app */
function codePolarDansAdresse() {
  const p = new URLSearchParams(location.search), code = p.get("polar_code");
  if (!code) return;
  history.replaceState(null, "", location.pathname);
  finirLiaisonPolar(code).then(() => toast("Montre Polar reliée")).catch(e => toast("Liaison Polar impossible : " + e.message, { danger: true }));
}
async function delierPolar() {
  const l = lienPolar();
  if (l?.utilisateur) { try { await polarLire("/v3/users/" + l.utilisateur, "DELETE"); } catch (e) { /* on délie quand même ce téléphone */ } }
  await DB.set("polar-lien", null);
  toast("Montre Polar déliée");
}

/* Lecture d'une donnée AccessLink */
async function polarLire(chemin, methode = "GET") {
  const l = lienPolar();
  if (!l?.jeton) throw new Error("montre non reliée");
  const r = await fetch(POLAR_FN + "?action=api&chemin=" + encodeURIComponent(chemin), { method: methode, cache: "no-store", headers: { Authorization: "Bearer " + l.jeton } });
  if (r.status === 401 || r.status === 403) throw new Error(r.status === 403 ? "Polar demande d'accepter ses conditions dans Polar Flow" : "liaison expirée : relie à nouveau ta montre");
  if (r.status === 204 || r.status === 404) return null;
  if (!r.ok) throw new Error("Polar a répondu " + r.status);
  return r.json().catch(() => null);
}

/* La saisie du matin : Recharge nocturne (SNA, VFC, FC de la nuit) et durée de sommeil */
async function matinPolar(jour) {
  const [rc, nuits] = await Promise.all([polarLire("/v3/users/nightly-recharge"), polarLire("/v3/users/sleep")]);
  // La nuit du jour, ou à défaut celle de la veille (selon l'heure de l'endormissement)
  const choisir = l => (l || []).filter(x => x.date && x.date <= jour && ecart(x.date, jour) <= 1).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const r = choisir(rc?.recharges), s = choisir(nuits?.nights);
  const dormi = s ? ((s.light_sleep || 0) + (s.deep_sleep || 0) + (s.rem_sleep || 0)) / 3600 : null;
  return {
    ans: r?.ans_charge != null ? arrondi(r.ans_charge, 1) : null,
    rmssd: r?.heart_rate_variability_avg ?? null,
    fc: r?.heart_rate_avg ?? null,
    sleep: dormi ? arrondi(dormi, 2) : null,
    dates: [r?.date, s?.date].filter(Boolean),
  };
}
