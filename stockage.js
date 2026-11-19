"use strict";
/* STOCKAGE — IndexedDB (base « recomp », magasin « kv »), repli sur localStorage puis sur la mémoire.
 * Même base et mêmes clés que les versions précédentes : aucune donnée n'est déplacée.
 * Interface : window.storage.get / set / delete / list. */
(function () {
  if (window.storage) return;
  const PREFIXE = "recomp:", MIGRE = "recomp_idb_migrated";
  const cache = new Map();
  let LS = null;
  try {
    localStorage.setItem("__recomp_t", "1");
    localStorage.removeItem("__recomp_t");
    LS = localStorage;
  } catch (e) { /* navigation privée stricte */ }

  const clesLS = () => {
    const out = [];
    if (!LS) return out;
    for (let i = 0; i < LS.length; i++) {
      const k = LS.key(i);
      if (k && k.startsWith(PREFIXE)) out.push(k.slice(PREFIXE.length));
    }
    return out;
  };
  const req = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  const fin = tx => new Promise((ok, ko) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error || new Error("transaction annulée (espace plein ?)"));
  });
  const ouvrir = () => new Promise((ok, ko) => {
    if (!window.indexedDB) return ko(new Error("IndexedDB absent"));
    const r = indexedDB.open("recomp", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error("IndexedDB bloqué"));
  });

  // iOS ferme parfois la connexion à la base quand l'app reste en arrière-plan :
  // elle est rouverte au besoin, et chaque opération est retentée une fois sur une connexion neuve
  let base = null;
  const connecter = async () => {
    if (base) return base;
    const db = await ouvrir();
    db.onclose = () => { if (base === db) base = null; };
    db.onversionchange = () => { try { db.close(); } catch (e) { /* déjà fermée */ } if (base === db) base = null; };
    return (base = db);
  };
  const avecBase = async f => {
    try { return await f(await connecter()); }
    catch (e) { if (e?.name === "QuotaExceededError") throw e; base = null; return f(await connecter()); }
  };
  // Écritures en attente : si la base ne répond plus, la valeur est gardée ici et rejoint la base au démarrage suivant
  const ATTENTE = "recomp_attente:";
  const enAttente = () => { const o = {}; if (!LS) return o; for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k && k.startsWith(ATTENTE)) o[k.slice(ATTENTE.length)] = LS.getItem(k); } return o; };
  // Journal des incidents (Réglages → Sauvegarde et données)
  const noter = (k, e, secours) => { try { const j = JSON.parse(LS.getItem("recomp_journal_stockage") || "[]"); j.push({ t: Date.now(), k, e: (e?.name || "Erreur") + (e?.message ? " : " + String(e.message).slice(0, 120) : ""), secours: !!secours }); LS.setItem("recomp_journal_stockage", JSON.stringify(j.slice(-12))); } catch (x) { /* facultatif */ } };

  const moteur = (async () => {
    try {
      const db = await connecter();
      if (LS && !LS.getItem(MIGRE)) {
        const anciennes = clesLS();
        if (anciennes.length) {
          const tx = db.transaction("kv", "readwrite");
          anciennes.forEach(k => tx.objectStore("kv").put(LS.getItem(PREFIXE + k), k));
          await fin(tx);
        }
        LS.setItem(MIGRE, "1");
      }
      // Ce qui n'avait pas pu être enregistré la dernière fois rejoint la base
      const att = enAttente(), cles = Object.keys(att);
      if (cles.length) {
        try { await avecBase(d => { const tx = d.transaction("kv", "readwrite"); cles.forEach(k => tx.objectStore("kv").put(att[k], k)); return fin(tx); }); cles.forEach(k => LS.removeItem(ATTENTE + k)); }
        catch (e) { noter("reprise", e); }
      }
      try { navigator.storage?.persist?.(); } catch (e) { /* facultatif */ }
      return {
        idb: true,
        get: k => k in att && LS?.getItem(ATTENTE + k) != null ? Promise.resolve(LS.getItem(ATTENTE + k)) : avecBase(d => req(d.transaction("kv", "readonly").objectStore("kv").get(k))),
        set: (k, v) => avecBase(d => { const tx = d.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); return fin(tx); }),
        del: k => avecBase(d => { const tx = d.transaction("kv", "readwrite"); tx.objectStore("kv").delete(k); return fin(tx); }),
        keys: async () => [...new Set([...(await avecBase(d => req(d.transaction("kv", "readonly").objectStore("kv").getAllKeys()))).map(String), ...Object.keys(enAttente())])],
      };
    } catch (e) {
      console.warn("IndexedDB indisponible, repli", e);
      if (LS) return {
        get: async k => LS.getItem(PREFIXE + k),
        set: async (k, v) => LS.setItem(PREFIXE + k, v),
        del: async k => LS.removeItem(PREFIXE + k),
        keys: async () => clesLS(),
      };
      const mem = {};
      return { get: async k => mem[k], set: async (k, v) => { mem[k] = v; }, del: async k => { delete mem[k]; }, keys: async () => Object.keys(mem) };
    }
  })();

  window.storage = {
    get: async k => {
      if (!cache.has(k)) { const v = await (await moteur).get(k); cache.set(k, v == null ? null : v); }
      const v = cache.get(k);
      return v == null ? null : { key: k, value: v };
    },
    set: async (k, v) => {
      const m = await moteur;
      try { await m.set(k, v); if (m.idb && LS) LS.removeItem(ATTENTE + k); }
      catch (e) {
        // La base ne répond plus : la valeur attend dans le stockage de secours (sauf si elle est trop grosse pour lui)
        if (!m.idb || !LS) { noter(k, e); throw e; }
        try { LS.setItem(ATTENTE + k, v); } catch (x) { noter(k, e); throw e; }
        noter(k, e, true);
      }
      cache.set(k, v);
      return { key: k, value: v };
    },
    delete: async k => { await (await moteur).del(k); if (LS) try { LS.removeItem(ATTENTE + k); } catch (e) { /* facultatif */ } cache.delete(k); return { key: k, deleted: true }; },
    list: async prefixe => {
      const toutes = (await (await moteur).keys()).map(String);
      return { keys: prefixe ? toutes.filter(k => k.startsWith(prefixe)) : toutes };
    },
  };
})();
