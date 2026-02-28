// js/result_modal.js
(() => {
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  }

  function showResult({ success, score, timeSec, maxWeaponLv, stageId }) {
    const root = document.getElementById("resultOverlay");
    if (!root) return;

    const title = success ? "✅ MISSION CLEAR" : "❌ MISSION FAILED";
    const sub = success ? "감시 로봇 제거 완료. 탈출로 확보." : "실험 실패. 안정성 저하.";
    const lastName = (window.TELRank?.getLastName?.() ?? "");

    root.innerHTML = `
      <div class="card">
        <div class="title">${title}</div>
        <div class="sub">${sub}</div>

        <div class="stats">
          <div class="stat"><div class="k">TIME</div><div class="v">${fmtTime(timeSec)}</div></div>
          <div class="stat"><div class="k">SCORE</div><div class="v">${Math.floor(score ?? 0)}</div></div>
          <div class="stat"><div class="k">MAX WEAPON LV</div><div class="v">${Math.floor(maxWeaponLv ?? 1)}</div></div>
          <div class="stat"><div class="k">STAGE</div><div class="v">${stageId}</div></div>
        </div>

        <div style="margin-top:8px; text-align:left;">
          <div style="font-size:11px; opacity:0.8; margin:0 0 6px 2px;">NAME (랭킹 기록)</div>
          <input id="rankNameInput" value="${lastName}"
            placeholder="이름 입력 (최대 12자)"
            style="
              width:100%;
              box-sizing:border-box;
              padding:12px 12px;
              border-radius:14px;
              border:1px solid rgba(255,255,255,0.16);
              background: rgba(0,0,0,0.25);
              color:#e8f2ff;
              outline:none;
              font-weight:900;
              font-size:14px;
            "
          />
          <div id="rankMsg" style="margin:8px 2px 0; font-size:12px; opacity:0.9;"></div>
        </div>

        <div class="btnRow" style="margin-top:12px;">
          <div class="btn primary" id="btnSaveRank">SAVE RANK</div>
        </div>

        <div class="btnRow">
          <div class="btn danger" id="btnResRestart">RESTART</div>
          <div class="btn" id="btnResStage">STAGE SELECT</div>
          <div class="btn" id="btnResHome">HOME</div>
        </div>
      </div>
    `;

    root.style.display = "flex";

    const msgEl = document.getElementById("rankMsg");
    const inputEl = document.getElementById("rankNameInput");

    function setMsg(text, ok){
      msgEl.textContent = text || "";
      msgEl.style.color = ok ? "rgba(166,255,176,0.95)" : "rgba(255,180,180,0.95)";
    }

    document.getElementById("btnSaveRank").onclick = () => {
      const name = inputEl.value;
      const res = window.TELRank.saveRank({
        name,
        stageId,
        score,
        timeSec,
        maxWeaponLv,
        success
      });
      setMsg(res.msg, res.ok);
    };

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("btnSaveRank").click();
      }
    });

    document.getElementById("btnResRestart").onclick = () => {
      root.style.display = "none";
      if (window.TEL && typeof TEL.restart === "function") TEL.restart();
      else location.reload();
    };
    document.getElementById("btnResStage").onclick = () => location.href = "stage_select_ch1.html";
    document.getElementById("btnResHome").onclick  = () => location.href = "index.html";
  }

  // 엔진에서 호출할 단일 API로 노출
  window.TEL = window.TEL || {};
  window.TEL.showResult = showResult;
})();