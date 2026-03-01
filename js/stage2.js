(() => {
  const STAGE_ID = "1-2";
  const ROWS = 14;
  const COLS = 10;
  const TUNA_COUNT = 14;
  const ASSET_FISH = "assets/fish_can.png";

  const boardEl = document.getElementById("board");
  const hudEl = document.getElementById("hudText");
  const btnMode = document.getElementById("btnMode");
  const btnRestart = document.getElementById("btnRestart");
  const btnStage = document.getElementById("btnStage");
  const resultOverlay = document.getElementById("resultOverlay");

  if (!boardEl || !hudEl || !btnMode || !btnRestart || !btnStage || !resultOverlay) {
    console.error("[Stage2] Missing DOM ids.");
    return;
  }

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const nowMs = ()=>performance.now();

  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  }

  function safeName(raw){
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const cleaned = s.replace(/[^0-9a-zA-Z가-힣 _-]/g, "").trim();
    return cleaned.slice(0, 12);
  }

  function getLastName(){
    try { return localStorage.getItem("TEL_PLAYER_NAME") || ""; } catch(e){ return ""; }
  }
  function setLastName(n){
    try { localStorage.setItem("TEL_PLAYER_NAME", n); } catch(e){}
  }

  let mode = "OPEN";        // OPEN | FLAG
  let gameState = "PLAY";   // PLAY | WIN | LOSE
  let startAt = 0;
  let timerRAF = 0;

  let grid = [];
  let openedSafe = 0;
  let flagCount = 0;
  const totalSafe = ROWS*COLS - TUNA_COUNT;

  const fishImg = new Image();
  fishImg.src = ASSET_FISH;

  function setBoardGridStyle(){
    boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
  }

  function idx(r,c){ return r*COLS + c; }

  function neighbors(r,c){
    const out = [];
    for (let dr=-1; dr<=1; dr++){
      for (let dc=-1; dc<=1; dc++){
        if (dr===0 && dc===0) continue;
        const nr=r+dr, nc=c+dc;
        if (nr<0||nr>=ROWS||nc<0||nc>=COLS) continue;
        out.push({r:nr,c:nc,i:idx(nr,nc)});
      }
    }
    return out;
  }

  function buildGrid(){
    grid = new Array(ROWS*COLS).fill(0).map((_,i)=>({
      i,
      r: Math.floor(i/COLS),
      c: i%COLS,
      tuna:false,
      n:0,
      open:false,
      flag:false,
      el:null
    }));

    const picks = new Set();
    while (picks.size < TUNA_COUNT){
      picks.add(Math.floor(Math.random() * grid.length));
    }
    for (const i of picks) grid[i].tuna = true;

    for (const cell of grid){
      if (cell.tuna) continue;
      const ns = neighbors(cell.r, cell.c);
      let count=0;
      for (const t of ns) if (grid[t.i].tuna) count++;
      cell.n = count;
    }
  }

  function renderGrid(){
    boardEl.innerHTML = "";
    for (const cell of grid){
      const d = document.createElement("div");
      d.className = "cell closed";
      d.dataset.i = String(cell.i);

      d.addEventListener("pointerdown", (e)=>{
        e.preventDefault();
        onCellAction(cell.i);
      }, {passive:false});

      d.addEventListener("contextmenu", (e)=>{
        e.preventDefault();
        if (gameState !== "PLAY") return;
        toggleFlag(cell.i);
      });

      cell.el = d;
      boardEl.appendChild(d);
    }
  }

  function setMode(m){
    mode = m;
    btnMode.textContent = `MODE: ${mode}`;
    if (mode === "FLAG") {
      btnMode.classList.remove("primary");
      btnMode.classList.add("danger");
    } else {
      btnMode.classList.remove("danger");
      btnMode.classList.add("primary");
    }
  }

  function timeSec(){
    if (!startAt) return 0;
    return (nowMs() - startAt) / 1000;
  }

  function updateHUD(){
    const t = fmtTime(timeSec());
    hudEl.textContent = `TIME ${t} · OPEN ${openedSafe}/${totalSafe} · FLAG ${flagCount}/${TUNA_COUNT}`;
  }

  function tick(){
    if (gameState === "PLAY") updateHUD();
    timerRAF = requestAnimationFrame(tick);
  }

  function setCellClosed(cell){
    cell.el.className = "cell closed";
    cell.el.textContent = "";
    cell.el.innerHTML = "";
  }
  function setCellFlag(cell){
    cell.el.className = "cell flag";
    cell.el.textContent = "🚩";
  }
  function setCellOpenBlank(cell){
    cell.el.className = "cell blank";
    cell.el.textContent = "";
  }
  function setCellOpenNum(cell){
    cell.el.className = "cell open num";
    cell.el.textContent = String(cell.n);
  }
  function setCellOpenTuna(cell){
    cell.el.className = "cell open fish";
    if (fishImg.complete && fishImg.naturalWidth > 0) {
      cell.el.innerHTML = "";
      const im = document.createElement("img");
      im.src = ASSET_FISH;
      im.alt = "tuna";
      im.style.width = "70%";
      im.style.height = "70%";
      im.style.objectFit = "contain";
      im.draggable = false;
      cell.el.appendChild(im);
    } else {
      cell.el.textContent = "🐟";
    }
  }

  function onCellAction(i){
    if (gameState !== "PLAY") return;
    if (mode === "FLAG") toggleFlag(i);
    else openCell(i);
  }

  function toggleFlag(i){
    const cell = grid[i];
    if (cell.open) return;

    cell.flag = !cell.flag;
    if (cell.flag) {
      flagCount++;
      setCellFlag(cell);
    } else {
      flagCount = Math.max(0, flagCount - 1);
      setCellClosed(cell);
    }
    updateHUD();
  }

  function openCell(i){
    const cell = grid[i];
    if (cell.open || cell.flag) return;

    cell.open = true;

    if (cell.tuna){
      setCellOpenTuna(cell);
      revealAllTuna();
      endGame(false, "충분한 양의 참치캔을 찾지 못했다. 실패");
      return;
    }

    openedSafe++;
    if (cell.n === 0) setCellOpenBlank(cell);
    else setCellOpenNum(cell);

    if (cell.n === 0) floodOpen(cell.r, cell.c);

    if (openedSafe >= totalSafe){
      endGame(true, "참치캔 함정 회피 성공. 탈출 준비 완료.");
    }

    updateHUD();
  }

  function floodOpen(r,c){
    const stack = [{r,c}];
    const seen = new Set([idx(r,c)]);
    while (stack.length){
      const cur = stack.pop();
      for (const nb of neighbors(cur.r, cur.c)){
        if (seen.has(nb.i)) continue;
        seen.add(nb.i);

        const cell = grid[nb.i];
        if (cell.open || cell.flag) continue;
        if (cell.tuna) continue;

        cell.open = true;
        openedSafe++;
        if (cell.n === 0) setCellOpenBlank(cell);
        else setCellOpenNum(cell);

        if (cell.n === 0) stack.push({r:cell.r,c:cell.c});
      }
    }
  }

  function revealAllTuna(){
    for (const cell of grid){
      if (cell.tuna && !cell.open){
        cell.open = true;
        setCellOpenTuna(cell);
      }
    }
  }

  function calcScore(success){
    const t = Math.floor(timeSec());
    const base = success ? 100000 : 15000;
    const score = base - t * (success ? 900 : 400) + openedSafe * 8;
    return Math.max(0, Math.floor(score));
  }

  function endGame(success, subText){
    if (gameState !== "PLAY") return;
    gameState = success ? "WIN" : "LOSE";

    const tSec = Math.floor(timeSec());
    const score = calcScore(success);

    showResultModal({
      success,
      score,
      timeSec: tSec,
      opened: openedSafe,
      totalSafe,
      flags: flagCount
    }, subText);
  }

  function showResultModal(stats, subText){
    const title = stats.success ? "✅ MISSION CLEAR" : "❌ MISSION FAILED";
    const stageLabel = "1 - HOUSE";
    const lastName = getLastName();

    resultOverlay.innerHTML = `
      <div class="card">
        <div class="title">${title}</div>
        <div class="sub">${subText || ""}</div>

        <div class="stats">
          <div class="stat"><div class="k">TIME</div><div class="v">${fmtTime(stats.timeSec)}</div></div>
          <div class="stat"><div class="k">SCORE</div><div class="v">${stats.score}</div></div>
          <div class="stat"><div class="k">OPEN</div><div class="v">${stats.opened}/${stats.totalSafe}</div></div>
          <div class="stat"><div class="k">STAGE</div><div class="v">${stageLabel}</div></div>
        </div>

        <div class="nameBlock">
          <div class="nameLabel">NAME (랭킹 기록)</div>
          <input id="rankNameInput" value="${lastName}" placeholder="이름 입력 (최대 12자)" />
          <div class="rankMsg" id="rankMsg"></div>
        </div>

        <div class="btnRow">
          <button class="btn primary" id="btnSaveRank">SAVE RANK</button>
        </div>

        <div class="btnRow">
          <button class="btn danger" id="btnResRestart">RESTART</button>
          <button class="btn" id="btnResStage">STAGE SELECT</button>
          <button class="btn" id="btnResHome">HOME</button>
        </div>
      </div>
    `;
    resultOverlay.style.display = "flex";

    const msgEl = document.getElementById("rankMsg");
    const inputEl = document.getElementById("rankNameInput");

    function setMsg(text, ok){
      msgEl.textContent = text || "";
      msgEl.style.color = ok ? "rgba(166,255,176,0.95)" : "rgba(255,180,180,0.95)";
    }

document.getElementById("btnSaveRank").onclick = () => {
      const name = safeName(inputEl?.value || "");
      if (!name) { setMsg("이름을 입력해줘!", false); return; }
      setLastName(name);

      // 🚨 수정된 부분: TEL_saveRank 대신 TELRank.save 를 사용하도록 변경
      if (typeof window.TELRank === "undefined" || typeof window.TELRank.save !== "function") {
        setMsg("rank.js 로드 실패: js/rank.js 경로/파일명(대소문자) 확인!", false);
        console.error("[Stage2] TELRank.save not found. rank.js might not be loaded.");
        return;
      }

      // 🚨 수정된 부분: window.TELRank.save 호출
      const res = window.TELRank.save({
        name,
        stageId: STAGE_ID,
        score: stats.score,
        timeSec: stats.timeSec,
        maxWeaponLv: 1, // 필요에 따라 변경 가능
        success: stats.success
      });

      if (res && typeof res === "object") setMsg(res.msg || "저장됨", !!res.ok);
      else setMsg("저장 완료!", true);
    };
    inputEl?.addEventListener("keydown", (e)=>{
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("btnSaveRank").click();
      }
    });

    document.getElementById("btnResRestart").onclick = () => restart();
    document.getElementById("btnResStage").onclick = () => location.href = "stage_select_ch1.html";
    document.getElementById("btnResHome").onclick = () => location.href = "index.html";
  }

  function bindButton(el, fn){
    el.addEventListener("pointerdown", (e)=>{ e.preventDefault(); fn(); }, {passive:false});
    el.addEventListener("click", (e)=>{ e.preventDefault(); fn(); });
  }

// ✅ MODE 버튼: PC 좌클릭 및 모바일 터치 한 번으로 완벽 호환되도록 수정
btnMode.addEventListener("pointerdown", (e) => {
  // 마우스 우클릭(e.button === 2) 시에는 토글되지 않도록 무시
  if (e.button === 2) return; 
  
  e.preventDefault(); // 모바일 더블 탭 줌 등 기본 동작 방지
  setMode(mode === "OPEN" ? "FLAG" : "OPEN");
});

// PC에서 pointerdown 직후 발생하는 click 이벤트가 모드를 다시 바꾸지 못하게 막음
btnMode.addEventListener("click", (e) => {
  e.preventDefault(); 
});

// 버튼 위에서 우클릭 시 브라우저 메뉴가 뜨는 것 방지
btnMode.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

  bindButton(btnRestart, ()=> restart());
  bindButton(btnStage, ()=> location.href = "stage_select_ch1.html");

  function restart(){
    cancelAnimationFrame(timerRAF);
    resultOverlay.style.display = "none";
    resultOverlay.innerHTML = "";

    gameState = "PLAY";
    openedSafe = 0;
    flagCount = 0;

    setMode("OPEN");
    setBoardGridStyle();
    buildGrid();
    renderGrid();

    startAt = nowMs();
    updateHUD();
    tick();
  }

  restart();
})();