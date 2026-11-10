// POLAR — intermédiaire entre RECOMP et le service AccessLink de Polar.
// Il garde la clé secrète (variables Netlify POLAR_CLIENT_ID et POLAR_CLIENT_SECRET) et ne conserve rien :
// le jeton d'accès de l'utilisateur vit sur son téléphone et accompagne chaque demande.
// Exception à la règle « pas de sous-dossier » : Netlify exige ce dossier pour ses fonctions (voir CLAUDE.md).

const API = "https://www.polaraccesslink.com";
const JETON = "https://polarremote.com/v2/oauth2/token";
const reponse = (o, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export default async (req) => {
  const url = new URL(req.url), action = url.searchParams.get("action");
  const id = process.env.POLAR_CLIENT_ID, secret = process.env.POLAR_CLIENT_SECRET;
  if (!id || !secret) return reponse({ erreur: "config", message: "Les clés Polar ne sont pas encore dans les variables d'environnement Netlify." }, 500);

  // Identifiant public de l'application, pour construire l'adresse d'autorisation
  if (action === "config") return reponse({ client_id: id });

  // Échange du code d'autorisation contre un jeton, puis inscription de l'utilisateur (une fois)
  if (action === "jeton" && req.method === "POST") {
    let corps = {};
    try { corps = await req.json(); } catch (e) { return reponse({ erreur: "requete" }, 400); }
    if (!corps.code) return reponse({ erreur: "code manquant" }, 400);
    const params = new URLSearchParams({ grant_type: "authorization_code", code: String(corps.code).trim() });
    if (corps.redirect_uri) params.set("redirect_uri", corps.redirect_uri);
    const r = await fetch(JETON, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json;charset=UTF-8" },
      body: params,
    });
    const t = await r.json().catch(() => null);
    if (!r.ok || !t?.access_token) return reponse({ erreur: "jeton", statut: r.status, detail: t }, 400);
    const ins = await fetch(API + "/v3/users", {
      method: "POST",
      headers: { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ "member-id": "recomp-" + t.x_user_id }),
    });
    // 200 = inscrit, 409 = déjà inscrit : les deux conviennent
    return reponse({ jeton: t.access_token, utilisateur: t.x_user_id, expire: t.expires_in, inscription: ins.status });
  }

  // Relais d'une lecture (ou d'une désinscription) vers AccessLink, avec le jeton fourni par le téléphone
  if (action === "api" && (req.method === "GET" || req.method === "DELETE")) {
    const chemin = url.searchParams.get("chemin") || "";
    if (!/^\/v3\/(users|exercises)(\/[A-Za-z0-9._:-]+)*$/.test(chemin)) return reponse({ erreur: "chemin non autorisé" }, 400);
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) return reponse({ erreur: "jeton manquant" }, 401);
    const suite = new URLSearchParams(url.searchParams);
    suite.delete("action"); suite.delete("chemin");
    const r = await fetch(API + chemin + (suite.toString() ? "?" + suite : ""), { method: req.method, headers: { Authorization: auth, Accept: "application/json" } });
    const texte = await r.text();
    return new Response(texte || "null", { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "no-store" } });
  }

  return reponse({ erreur: "action inconnue" }, 400);
};
