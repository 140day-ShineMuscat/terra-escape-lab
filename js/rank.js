// js/rank.js
(() => {
  const KEY_GLOBAL = "TEL_RANK_GLOBAL";
  const KEY_STAGE  = "TEL_RANK_STAGE";
  const KEY_NAME   = "TEL_PLAYER_NAME";

  const _loadJSON = (k, fb) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
    catch(e){ return fb; }
  };
  const _saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };

  const _todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const safeName = (raw) => {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const cleaned = s.replace(/[^0-9a-zA-Z가-힣 _-]/g, "").trim();
    return cleaned.slice(0, 12);
  };

  // 기본 정렬: score DESC, 동점이면 timeSec ASC
  const sortRank = (a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    return (a.timeSec ?? 1e9) - (b.timeSec ?? 1e9);
  };

  const pushTopN = (arr, entry, limit=10) => {
    arr.push(entry);
    arr.sort(sortRank);
    if (arr.length > limit) arr.length = limit;
    return arr;
  };

  const fmtTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  };

  window.TELRank = {
    fmtTime,
    getLastName() {
      try { return localStorage.getItem(KEY_NAME) || ""; } catch(e) { return ""; }
    },
    setLastName(name) {
      try { localStorage.setItem(KEY_NAME, safeName(name)); } catch(e) {}
    },
    getGlobal() { return _loadJSON(KEY_GLOBAL, []); },
    getStage(stageId) {
      const obj = _loadJSON(KEY_STAGE, {});
      return Array.isArray(obj[stageId]) ? obj[stageId] : [];
    },
    resetAll() {
      try {
        localStorage.removeItem(KEY_GLOBAL);
        localStorage.removeItem(KEY_STAGE);
      } catch(e) {}
    },

    // ✅ 통합 + 스테이지별 동시 저장
    save({ name, stageId, score, timeSec, success=true, meta={} }) {
      const n = safeName(name);
      if (!n) return { ok:false, msg:"이름을 입력해줘!" };

      const entry = {
        name: n,
        stage: stageId || "UNKNOWN",
        score: Math.floor(score ?? 0),
        timeSec: Math.floor(timeSec ?? 0),
        success: !!success,
        date: _todayISO(),
        meta: meta || {}
      };

      // GLOBAL
      const g = _loadJSON(KEY_GLOBAL, []);
      pushTopN(g, entry, 10);
      _saveJSON(KEY_GLOBAL, g);

      // STAGE
      const sObj = _loadJSON(KEY_STAGE, {});
      const arr = Array.isArray(sObj[entry.stage]) ? sObj[entry.stage] : [];
      pushTopN(arr, entry, 10);
      sObj[entry.stage] = arr;
      _saveJSON(KEY_STAGE, sObj);

      this.setLastName(n);
      return { ok:true, msg:"저장 완료! (GLOBAL + STAGE)" };
    }
  };
})();