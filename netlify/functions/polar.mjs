// POLAR — intermédiaire entre RECOMP et le service AccessLink de Polar.
// Il garde la clé secrète (variables Netlify POLAR_CLIENT_ID et POLAR_CLIENT_SECRET) et ne conserve rien :
// le jeton d'accès de l'utilisateur vit sur son téléphone et accompagne chaque demande.
// Exception à la règle « pas de sous-dossier » : Netlify exige ce dossier pour ses fonctions (voir CLAUDE.md).

import crypto from "node:crypto";

const API = "https://www.polaraccesslink.com";
const JETON = "https://polarremote.com/v2/oauth2/token";
const reponse = (o, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/* NOTIFICATIONS — Polar prévient cette fonction quand une séance ou une nuit arrive (webhook),
 * et la fonction envoie une notification à l'iPhone (Web Push, chiffré de bout en bout).
 * Rien n'est stocké ici : l'adresse de notification de l'iPhone voyage dans l'adresse du webhook, chez Polar. */
const b64u = b => Buffer.from(b).toString("base64url");
const hmac = (k, ...d) => { const m = crypto.createHmac("sha256", k); d.forEach(x => m.update(x)); return m.digest(); };

// Clés de notification (VAPID), tirées de la clé secrète Polar : aucune clé de plus à ranger dans Netlify
export function clesPush(secret) {
  const e = crypto.createECDH("prime256v1");
  let d = hmac(secret, "recomp-notifications-vapid");
  for (let i = 0; ; i++) { try { e.setPrivateKey(d); break; } catch (x) { d = hmac(secret, "recomp-notifications-vapid-" + i); } }
  const pub = e.getPublicKey();
  return { pub, cle: crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: "jwk" }) };
}
function jetonVapid(endpoint, sujet, cles) {
  const t = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" })) + "." + b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: sujet }));
  return t + "." + b64u(crypto.sign("sha256", Buffer.from(t), { key: cles.cle, dsaEncoding: "ieee-p1363" }));
}
// Chiffrement « aes128gcm » des notifications (RFC 8291) : seul l'iPhone peut lire le message
export function chiffrer(texte, p256dh, auth) {
  const ua = Buffer.from(p256dh, "base64url"), sec = Buffer.from(auth, "base64url");
  const e = crypto.createECDH("prime256v1"); e.generateKeys();
  const moi = e.getPublicKey(), ikm = hmac(hmac(sec, e.computeSecret(ua)), "WebPush: info\0", ua, moi, Buffer.from([1]));
  const sel = crypto.randomBytes(16), prk = hmac(sel, ikm);
  const cek = hmac(prk, "Content-Encoding: aes128gcm\0", Buffer.from([1])).subarray(0, 16), nonce = hmac(prk, "Content-Encoding: nonce\0", Buffer.from([1])).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const corps = Buffer.concat([c.update(Buffer.concat([Buffer.from(texte, "utf8"), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const tete = Buffer.alloc(21); sel.copy(tete); tete.writeUInt32BE(4096, 16); tete[20] = moi.length;
  return Buffer.concat([tete, moi, corps]);
}
async function pousser(ab, message, sujet, cles) {
  return fetch(ab.e, {
    method: "POST",
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "43200", Urgency: "normal", Authorization: "vapid t=" + jetonVapid(ab.e, sujet, cles) + ", k=" + b64u(cles.pub) },
    body: chiffrer(JSON.stringify(message), ab.p, ab.k),
  });
}
// L'abonnement de l'iPhone, compacté pour tenir dans l'adresse du webhook, avec un sceau pour refuser les adresses fabriquées
const sceau = (secret, a) => hmac(secret, "recomp-webhook", a).toString("hex").slice(0, 32);
const lireAbonnement = (secret, a, j) => {
  if (!a || !j || j.length !== 32 || !crypto.timingSafeEqual(Buffer.from(sceau(secret, a)), Buffer.from(j))) return null;
  try { return JSON.parse(Buffer.from(a, "base64url").toString("utf8")); } catch (e) { return null; }
};
// Vérifie que le jeton envoyé par le téléphone est bien celui de l'utilisateur Polar
async function jetonValide(req, utilisateur) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || !/^\d+$/.test(String(utilisateur || ""))) return false;
  const r = await fetch(API + "/v3/users/" + utilisateur, { headers: { Authorization: auth, Accept: "application/json" } });
  return r.ok;
}

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
    // Le fichier complet d'une séance (FIT) est binaire : on le relaie tel quel
    const fit = /\/fit$/.test(chemin);
    const r = await fetch(API + chemin + (suite.toString() ? "?" + suite : ""), { method: req.method, headers: { Authorization: auth, Accept: fit ? "*/*" : "application/json" } });
    const corps = await r.arrayBuffer();
    return new Response(corps.byteLength ? corps : "null", { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || (fit ? "application/octet-stream" : "application/json"), "Cache-Control": "no-store" } });
  }

  const cles = clesPush(secret), origine = url.origin, basic = { Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"), Accept: "application/json" };

  // Clé publique, pour que l'iPhone s'abonne aux notifications
  if (action === "cle-push") return reponse({ cle: b64u(cles.pub) });

  // Messages de Polar : séance ou nuit arrivée → notification à l'iPhone. Toujours répondre 200, sinon Polar coupe le webhook.
  if (action === "webhook") {
    if (req.method !== "POST") return reponse({ ok: true });
    const ev = await req.json().catch(() => ({}));
    const ab = lireAbonnement(secret, url.searchParams.get("a"), url.searchParams.get("j"));
    if (!ab || ev.event === "PING") return reponse({ ok: true });
    const msg = ev.event === "EXERCISE" ? { titre: "Nouvelle séance", corps: "Ta montre vient d'envoyer une séance. Touche pour la voir.", ouvrir: "sortie:" + ev.entity_id, tag: "seance-" + ev.entity_id, seance: ev.entity_id }
      : ev.event === "SLEEP" ? { titre: "Ta nuit est arrivée", corps: "Touche pour remplir ta forme du matin.", ouvrir: "matin", tag: "nuit-" + (ev.date || "") }
      : null;
    if (msg) { try { await pousser(ab, msg, origine, cles); } catch (e) { /* l'iPhone n'est pas joignable : tant pis pour cette fois */ } }
    return reponse({ ok: true });
  }

  // Activer : vérifie l'utilisateur, place l'abonnement dans le webhook Polar, puis envoie une notification d'essai
  if (action === "abonner" && req.method === "POST") {
    const c = await req.json().catch(() => ({})), s = c.abonnement;
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth || !/^https:\/\//.test(s.endpoint)) return reponse({ erreur: "abonnement invalide" }, 400);
    if (!(await jetonValide(req, c.utilisateur))) return reponse({ erreur: "liaison Polar expirée" }, 401);
    const ab = { e: s.endpoint, p: s.keys.p256dh, k: s.keys.auth }, a = b64u(JSON.stringify(ab));
    const cible = origine + "/.netlify/functions/polar?action=webhook&a=" + a + "&j=" + sceau(secret, a), events = ["EXERCISE", "SLEEP"];
    const ex = await fetch(API + "/v3/webhooks", { headers: basic }).then(r => r.ok ? r.json() : null).catch(() => null);
    const w = Array.isArray(ex?.data) ? ex.data[0] : ex?.data;
    const r = w?.id
      ? await fetch(API + "/v3/webhooks/" + w.id, { method: "PATCH", headers: { ...basic, "Content-Type": "application/json" }, body: JSON.stringify({ events, url: cible }) })
      : await fetch(API + "/v3/webhooks", { method: "POST", headers: { ...basic, "Content-Type": "application/json" }, body: JSON.stringify({ events, url: cible }) });
    if (!r.ok) return reponse({ erreur: "webhook", statut: r.status, detail: await r.text().catch(() => "") }, 502);
    if (w?.id && w.active === false) await fetch(API + "/v3/webhooks/activate", { method: "POST", headers: basic }).catch(() => {});
    const essai = await pousser(ab, { titre: "Notifications activées", corps: "Je te préviendrai quand une séance ou ta nuit arrive de ta montre.", ouvrir: "", tag: "essai" }, origine, cles).catch(() => null);
    return reponse({ ok: true, essai: essai ? essai.status : null });
  }

  // Couper : supprime le webhook Polar (plus aucun message)
  if (action === "desabonner" && req.method === "POST") {
    const c = await req.json().catch(() => ({}));
    if (!(await jetonValide(req, c.utilisateur))) return reponse({ erreur: "liaison Polar expirée" }, 401);
    const ex = await fetch(API + "/v3/webhooks", { headers: basic }).then(r => r.ok ? r.json() : null).catch(() => null);
    const w = Array.isArray(ex?.data) ? ex.data[0] : ex?.data;
    if (w?.id) await fetch(API + "/v3/webhooks/" + w.id, { method: "DELETE", headers: basic });
    return reponse({ ok: true });
  }

  return reponse({ erreur: "action inconnue" }, 400);
};
