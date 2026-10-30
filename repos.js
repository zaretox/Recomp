"use strict";
/* MINUTEUR DE REPOS — basé sur l'heure de fin : il reste juste écran verrouillé et survit à un rechargement. */
const Repos = (() => {
  const CLE = "recomp_timer";
  const abonnes = new Set();
  let t = null, ac = null, id = null, version = 0;
  try {
    const s = JSON.parse(localStorage.getItem(CLE) || "null");
    if (s && s.endAt > Date.now()) t = s;
  } catch (e) { /* facultatif */ }
  const maj = () => { version++; abonnes.forEach(f => f()); };
  const garde = () => { try { t ? localStorage.setItem(CLE, JSON.stringify(t)) : localStorage.removeItem(CLE); } catch (e) { /* facultatif */ } };
  const sonne = () => {
    try {
      if (ac) [0, .35].forEach(d => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination); o.frequency.value = 880;
        g.gain.setValueAtTime(.001, ac.currentTime + d);
        g.gain.exponentialRampToValueAtTime(.3, ac.currentTime + d + .02);
        g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d + .3);
        o.start(ac.currentTime + d); o.stop(ac.currentTime + d + .3);
      });
      navigator.vibrate?.([220, 90, 220]);
    } catch (e) { /* facultatif */ }
  };
  const tic = () => {
    if (!t) { clearInterval(id); id = null; return; }
    if (Date.now() >= t.endAt) { const reste = Date.now() - t.endAt; t = null; garde(); clearInterval(id); id = null; if (reste < 4000) sonne(); }
    maj();
  };
  const lance = () => { if (!id) id = setInterval(tic, 250); };
  if (t) lance();
  document.addEventListener("visibilitychange", () => { if (t) tic(); });
  return {
    abonner: f => { abonnes.add(f); return () => abonnes.delete(f); },
    version: () => version,
    lire: () => t ? { ...t, reste: Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)) } : null,
    demarrer(sec, label, ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!ac && AC) ac = new AC();
        ac?.resume?.();
      } catch (e) { /* facultatif */ }
      t = { endAt: Date.now() + sec * 1000, total: sec, label: label || "", ctx: ctx || null };
      garde(); lance(); maj();
    },
    ajoute(s) { if (!t) return; t = { ...t, endAt: Math.max(t.endAt, Date.now()) + s * 1000, total: t.total + Math.max(0, s) }; garde(); maj(); },
    arreter() { t = null; garde(); maj(); },
  };
})();
function useRepos() { useSyncExternalStore(Repos.abonner, Repos.version); return Repos.lire(); }

/* Garde l'écran allumé pendant la séance */
function useEcranAllume(actif) {
  useEffect(() => {
    if (!actif || !navigator.wakeLock) return;
    let verrou = null, vivant = true;
    const prendre = () => navigator.wakeLock.request("screen").then(v => { if (vivant) verrou = v; else v.release(); }).catch(() => {});
    prendre();
    const vis = () => { if (document.visibilityState === "visible") prendre(); };
    document.addEventListener("visibilitychange", vis);
    return () => { vivant = false; document.removeEventListener("visibilitychange", vis); verrou?.release?.(); };
  }, [actif]);
}
