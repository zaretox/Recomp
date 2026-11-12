// BANQUE — intermédiaire entre RECOMP et Enable Banking (accès aux comptes, en lecture seule).
// Il garde la clé privée de l'application (variables Netlify EB_APP_ID et EB_PRIVATE_KEY) et ne conserve rien :
// l'identifiant de session vit sur le téléphone et accompagne chaque demande.
// Seules les lectures sont relayées (comptes, soldes, opérations) : aucun paiement n'est possible par ici.
import crypto from "node:crypto";

const API = "https://api.enablebanking.com";
const reponse = (o, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const UUID = "[0-9a-fA-F-]{36}";

// La clé peut être collée telle quelle, avec des « \n » à la place des retours à la ligne, ou encodée en base64
export function lireCle(brut) {
  let k = String(brut || "").trim();
  if (k.includes("\\n")) k = k.replace(/\\n/g, "\n");
  if (!k.includes("-----BEGIN")) { try { k = Buffer.from(k, "base64").toString("utf8"); } catch (e) { /* laissé tel quel */ } }
  return crypto.createPrivateKey(k);
}
// Jeton signé (RS256) demandé par Enable Banking à chaque requête, valable une heure
export function jetonEB(appId, cle) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url"), iat = Math.floor(Date.now() / 1000);
  const t = b64({ typ: "JWT", alg: "RS256", kid: appId }) + "." + b64({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 });
  return t + "." + crypto.sign("sha256", Buffer.from(t), cle).toString("base64url");
}

export default async (req) => {
  const url = new URL(req.url), action = url.searchParams.get("action");
  const appId = process.env.EB_APP_ID, brut = process.env.EB_PRIVATE_KEY;
  if (!appId || !brut) return reponse({ erreur: "config", message: "Les clés Enable Banking ne sont pas encore dans les variables d'environnement Netlify." }, 500);
  let cle;
  try { cle = lireCle(brut); } catch (e) { return reponse({ erreur: "config", message: "La clé privée Enable Banking est illisible : recopie tout le fichier .pem dans EB_PRIVATE_KEY." }, 500); }
  const eb = (chemin, o = {}) => fetch(API + chemin, { ...o, headers: { Authorization: "Bearer " + jetonEB(appId, cle), Accept: "application/json", ...(o.body ? { "Content-Type": "application/json" } : {}) } });
  const relais = async r => new Response(await r.text() || "null", { status: r.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

  // Banques françaises dont le nom contient « BNP » (pour particuliers)
  if (action === "banques") {
    const r = await eb("/aspsps?country=FR&psu_type=personal");
    const d = await r.json().catch(() => null);
    if (!r.ok) return reponse({ erreur: "aspsps", statut: r.status, detail: d }, 502);
    return reponse({ banques: (d?.aspsps || []).filter(a => /bnp/i.test(a.name)).map(a => ({ nom: a.name, duree: a.maximum_consent_validity || null })) });
  }

  // Début de la liaison : adresse de la banque où valider l'accès
  if (action === "lier" && req.method === "POST") {
    const c = await req.json().catch(() => ({}));
    if (!c.banque || !c.state) return reponse({ erreur: "requete" }, 400);
    const jours = Math.min(180, Math.max(1, Math.floor((+c.duree || 15552000) / 86400) - 1));
    const r = await eb("/auth", { method: "POST", body: JSON.stringify({
      access: { valid_until: new Date(Date.now() + jours * 86400000).toISOString() },
      aspsp: { name: String(c.banque), country: "FR" }, state: String(c.state), redirect_url: url.origin + "/banque-retour.html", psu_type: "personal",
    }) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.url) return reponse({ erreur: "auth", statut: r.status, detail: d }, 502);
    return reponse({ url: d.url, jours });
  }

  // Fin de la liaison : le code revenu de la banque devient une session ; on ne renvoie que l'utile sur les comptes
  if (action === "session" && req.method === "POST") {
    const c = await req.json().catch(() => ({}));
    if (!c.code) return reponse({ erreur: "code manquant" }, 400);
    const r = await eb("/sessions", { method: "POST", body: JSON.stringify({ code: String(c.code).trim() }) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.session_id) return reponse({ erreur: "session", statut: r.status, detail: d }, 502);
    return reponse({
      session: d.session_id, expire: d.access?.valid_until || null, banque: d.aspsp?.name || null,
      comptes: (d.accounts || []).map(a => ({ uid: a.uid, nom: a.name || a.product || "Compte", type: a.cash_account_type || null, fin: String(a.account_id?.iban || "").slice(-4) || null, devise: a.currency || "EUR" })),
    });
  }

  // Lectures : la session doit être valide et contenir le compte demandé
  if (action === "lire" && req.method === "GET") {
    const session = url.searchParams.get("session") || "", compte = url.searchParams.get("compte") || "", quoi = url.searchParams.get("quoi");
    if (!new RegExp("^" + UUID + "$").test(session)) return reponse({ erreur: "session manquante" }, 400);
    const s = await eb("/sessions/" + session);
    const sd = await s.json().catch(() => null);
    if (!s.ok) return reponse({ erreur: "session", statut: s.status, detail: sd }, s.status === 404 ? 401 : s.status);
    if (quoi === "session") return reponse({ statut: sd?.status, expire: sd?.access?.valid_until || null });
    if (!(sd?.accounts || []).includes(compte)) return reponse({ erreur: "compte inconnu" }, 403);
    if (quoi === "soldes") return relais(await eb("/accounts/" + compte + "/balances"));
    if (quoi === "operations") {
      const q = new URLSearchParams();
      const du = url.searchParams.get("du"), suite = url.searchParams.get("suite");
      if (du && /^\d{4}-\d{2}-\d{2}$/.test(du)) q.set("date_from", du);
      if (suite) q.set("continuation_key", suite);
      return relais(await eb("/accounts/" + compte + "/transactions" + (q.toString() ? "?" + q : "")));
    }
    return reponse({ erreur: "lecture inconnue" }, 400);
  }

  // Délier : ferme la session (et l'accord chez la banque si possible)
  if (action === "delier" && req.method === "POST") {
    const c = await req.json().catch(() => ({}));
    if (!new RegExp("^" + UUID + "$").test(String(c.session || ""))) return reponse({ erreur: "session manquante" }, 400);
    const r = await eb("/sessions/" + c.session, { method: "DELETE" });
    return reponse({ ok: r.ok || r.status === 404 });
  }

  return reponse({ erreur: "action inconnue" }, 400);
};
