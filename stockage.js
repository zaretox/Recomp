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

  const moteur = (async () => {
    try {
      const db = await ouvrir();
      const magasin = mode => db.transaction("kv", mode).objectStore("kv");
      if (LS && !LS.getItem(MIGRE)) {
        const anciennes = clesLS();
        if (anciennes.length) {
          const tx = db.transaction("kv", "readwrite");
          anciennes.forEach(k => tx.objectStore("kv").put(LS.getItem(PREFIXE + k), k));
          await fin(tx);
        }
        LS.setItem(MIGRE, "1");
      }
      try { navigator.storage?.persist?.(); } catch (e) { /* facultatif */ }
      return {
        get: k => req(magasin("readonly").get(k)),
        set: (k, v) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); return fin(tx); },
        del: k => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").delete(k); return fin(tx); },
        keys: () => req(magasin("readonly").getAllKeys()),
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
    set: async (k, v) => { await (await moteur).set(k, v); cache.set(k, v); return { key: k, value: v }; },
    delete: async k => { await (await moteur).del(k); cache.delete(k); return { key: k, deleted: true }; },
    list: async prefixe => {
      const toutes = (await (await moteur).keys()).map(String);
      return { keys: prefixe ? toutes.filter(k => k.startsWith(prefixe)) : toutes };
    },
  };
})();
