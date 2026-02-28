// js/rank.js
(() => {
  const KEY_GLOBAL = "TEL_RANK_GLOBAL"; // 통합 TOP10
  const KEY_STAGE  = "TEL_RANK_STAGE";  // { "1-1": [..], ... }
  const KEY_NAME   = "TEL_PLAYER_NAME"; // 마지막 이름

  function loadJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function safeName(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const cleaned = s.replace(/[^0-9a-zA-Z가-힣 _-]/g, "").trim();
    return cleaned.slice(0, 12);
  }

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // score DESC, time ASC
  function sortRank(a, b) {
    const as = a.score ?? 0, bs = b.score ?? 0;
    if (bs !== as) return bs - as;
    return (a.timeSec ?? 1e9) - (b.timeSec ?? 1e9);
  }

  function pushTopN(list, entry, limit = 10) {
    list.push(entry);
    list.sort(sortRank);
    if (list.length > limit) list.length = limit;
    return list;
  }

  function saveRank({ name, stageId, score, timeSec, maxWeaponLv, success }) {
    const n = safeName(name);
    if (!n) return { ok: false, msg: "이름을 입력해줘!" };

    const entry = {
      name: n,
      stage: String(stageId || "unknown"),
      score: Math.max(0, Math.floor(score ?? 0)),
      timeSec: Math.max(0, Math.floor(timeSec ?? 0)),
      maxWeaponLv: Math.max(1, Math.floor(maxWeaponLv ?? 1)),
      success: !!success,
      date: todayISO()
    };

    // GLOBAL
    const g = loadJSON(KEY_GLOBAL, []);
    pushTopN(g, entry, 10);
    saveJSON(KEY_GLOBAL, g);

    // STAGE
    const obj = loadJSON(KEY_STAGE, {});
    const sid = entry.stage;
    const arr = Array.isArray(obj[sid]) ? obj[sid] : [];
    pushTopN(arr, entry, 10);
    obj[sid] = arr;
    saveJSON(KEY_STAGE, obj);

    try { localStorage.setItem(KEY_NAME, n); } catch {}
    return { ok: true, msg: "저장 완료! (GLOBAL + STAGE)" };
  }

  function getLastName() {
    try { return localStorage.getItem(KEY_NAME) || ""; } catch { return ""; }
  }

  function getGlobal() { return loadJSON(KEY_GLOBAL, []); }
  function getStage(stageId) {
    const obj = loadJSON(KEY_STAGE, {});
    return Array.isArray(obj[stageId]) ? obj[stageId] : [];
  }

  // 전역 노출
  window.TELRank = {
    saveRank,
    getLastName,
    getGlobal,
    getStage,
    _keys: { KEY_GLOBAL, KEY_STAGE, KEY_NAME }
  };
})();