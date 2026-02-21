/* Terra Escape Lab - Engine (Stage 1 v4)
 * - Items 2 types: gun(upgrade) / fish_can(heal)
 * - BGM: intro 1 bar -> loop 4 bars (catchy)
 * - Boss HP < 50%: filter opens + tempo up (more urgent)
 * - Clear stats: time / score / max weapon levels
 */
(() => {
  const LOG_W = 360;
  const LOG_H = 720;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const rand  = (a, b) => a + Math.random() * (b - a);

  function imgReady(img) { return img && img.complete && img.naturalWidth > 0; }
  function loadSprites(map) {
    const out = {};
    for (const [k, src] of Object.entries(map || {})) {
      const im = new Image();
      im.src = src;
      out[k] = im;
    }
    return out;
  }
  function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy <= (ar + br) * (ar + br);
  }
  function drawSpriteCentered(ctx, img, x, y, size) {
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  // =========================
  // BGM (WebAudio)
  // - Intro 1 bar -> Loop 4 bars
  // - Boss mode: tempo up + filter brighter + slight drive
  // =========================
  function createBGM() {
    const A = {
      ctx: null,
      master: null,
      lp: null,
      drive: null,
      isOn: true,
      isPlaying: false,
      bossMode: false,
      _timer: null,
      _introDone: false,
      _loopIndex: 0,
      _lastScheduleAt: 0
    };

    const noteHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

    function playTone(ctx, dest, when, freq, dur, type="triangle", gain=0.12, detune=0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, when);
      o.detune.setValueAtTime(detune, when);

      // snappy envelope
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(gain, when + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

      o.connect(g);
      g.connect(dest);

      o.start(when);
      o.stop(when + dur + 0.03);
    }

    function playNoiseHat(ctx, dest, when, dur, gain=0.03) {
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0;i<bufferSize;i++) data[i] = (Math.random() * 2 - 1) * (1 - i/bufferSize);

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(5000, when);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(gain, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

      src.connect(hp);
      hp.connect(g);
      g.connect(dest);

      src.start(when);
      src.stop(when + dur + 0.02);
    }

    function ensureGraph() {
      if (A.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      A.ctx = new AC();

      A.master = A.ctx.createGain();
      A.master.gain.value = 0.55;

      // gentle drive via waveshaper (for boss mode punch)
      A.drive = A.ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i=0;i<256;i++){
        const x = (i/255)*2 - 1;
        curve[i] = Math.tanh(1.2 * x);
      }
      A.drive.curve = curve;
      A.drive.oversample = "2x";

      A.lp = A.ctx.createBiquadFilter();
      A.lp.type = "lowpass";
      A.lp.frequency.value = 1050;
      A.lp.Q.value = 0.7;

      A.master.connect(A.drive);
      A.drive.connect(A.lp);
      A.lp.connect(A.ctx.destination);
    }

    function applyModeParams() {
      if (!A.ctx) return;
      // bossMode: brighter + a bit louder
      const targetCut = A.bossMode ? 2200 : 1100;
      const targetQ   = A.bossMode ? 1.1 : 0.7;
      const targetG   = A.bossMode ? 0.62 : 0.55;

      const now = A.ctx.currentTime;
      A.lp.frequency.cancelScheduledValues(now);
      A.lp.frequency.setTargetAtTime(targetCut, now, 0.08);
      A.lp.Q.setTargetAtTime(targetQ, now, 0.08);
      A.master.gain.setTargetAtTime(targetG, now, 0.08);
    }

    // “중독성 멜로디” 구성:
    // - Key: A minor-ish
    // - Intro 1 bar: hook phrase
    // - Loop 4 bars: hook 변형 + 리듬 고정
    // - Boss mode: bpm up + hat/lead density up
    function scheduleIntro(t0, beat) {
      const ctx = A.ctx;

      // 1 bar = 4 beats. 8th step
      const step = beat / 2;

      // Hook (짧고 반복되는 패턴)
      // A4 C5 E5 D5 | E5 C5 A4 A4 (8 steps)
      const hook = [69, 72, 76, 74, 76, 72, 69, 69];

      // Bass A2 -> E2
      playTone(ctx, A.master, t0 + 0*beat, noteHz(45), beat*1.95, "square", 0.08);
      playTone(ctx, A.master, t0 + 2*beat, noteHz(40), beat*1.95, "square", 0.08);

      for (let i=0;i<8;i++){
        const when = t0 + i*step;
        playTone(ctx, A.master, when, noteHz(hook[i]), step*0.9, "triangle", 0.11, (i%2? -6: 6));
        // light hat
        if (i%2===0) playNoiseHat(ctx, A.master, when, step*0.22, 0.018);
      }
    }

    function scheduleLoop4Bars(t0, beat, urgent) {
      const ctx = A.ctx;
      const step = beat / 2; // 8th
      const bars = 4;
      const barLen = beat * 4;

      // 4-bar progression feel: Am | F | G | Em
      const chords = [
        [57, 60, 64], // Am (A3 C4 E4)
        [53, 57, 60], // F
        [55, 59, 62], // G
        [52, 55, 59], // Em
      ];
      const bass = [45, 41, 43, 40]; // A2 F2 G2 E2

      // main hook motif (slightly varied per bar)
      const motif = [
        [69,72,76,74,76,72,69,69], // bar1
        [69,72,74,72,76,74,72,69], // bar2
        [71,74,78,76,78,74,71,71], // bar3 (up a bit for lift)
        [69,72,76,74,72,69,69,69], // bar4 (resolve)
      ];

      for (let b=0;b<bars;b++){
        const chord = chords[b];
        const root = bass[b];

        // bass: 2 hits per bar
        playTone(ctx, A.master, t0 + b*barLen + 0*beat, noteHz(root), beat*1.9, "square", urgent?0.10:0.085);
        playTone(ctx, A.master, t0 + b*barLen + 2*beat, noteHz(root), beat*1.9, "square", urgent?0.10:0.085);

        // arpy pad (quiet)
        for (let i=0;i<8;i++){
          const when = t0 + b*barLen + i*step;
          const arpNote = chord[i%3] + 12; // one octave up
          playTone(ctx, A.master, when + 0.01, noteHz(arpNote), step*0.8, "sine", urgent?0.045:0.035);
        }

        // lead motif + hats
        for (let i=0;i<8;i++){
          const when = t0 + b*barLen + i*step;
          const midi = motif[b][i];

          playTone(ctx, A.master, when, noteHz(midi), step*0.92, "triangle", urgent?0.13:0.115, (i%2? -8: 8));

          // hats (urgent -> denser)
          const hatGain = urgent ? 0.030 : 0.020;
          playNoiseHat(ctx, A.master, when, step*0.18, hatGain);
          if (urgent && i%2===1) playNoiseHat(ctx, A.master, when + step*0.5, step*0.12, hatGain*0.75);
        }

        // accent stab at bar start (urgent)
        if (urgent) {
          playTone(ctx, A.master, t0 + b*barLen, noteHz(chord[0] + 24), beat*0.35, "sawtooth", 0.05);
        }
      }

      return bars * barLen;
    }

    function computeBeat() {
      // normal 112bpm, urgent 132bpm
      const bpm = A.bossMode ? 132 : 112;
      return 60 / bpm;
    }

    function schedule() {
      if (!A.isPlaying) return;

      // if OFF: just reschedule check
      if (!A.isOn) {
        A._timer = setTimeout(schedule, 120);
        return;
      }

      const ctx = A.ctx;
      const beat = computeBeat();
      applyModeParams();

      // schedule slightly ahead
      const t0 = Math.max(ctx.currentTime + 0.06, A._lastScheduleAt + 0.01);

      if (!A._introDone) {
        scheduleIntro(t0, beat);
        A._introDone = true;

        const introLen = beat * 4;
        A._lastScheduleAt = t0 + introLen;
        A._timer = setTimeout(schedule, introLen * 1000 - 30);
        return;
      }

      const loopLen = scheduleLoop4Bars(t0, beat, A.bossMode);
      A._lastScheduleAt = t0 + loopLen;

      A._timer = setTimeout(schedule, loopLen * 1000 - 30);
    }

    A.start = async () => {
      if (A.isPlaying) return;
      ensureGraph();
      if (A.ctx.state === "suspended") await A.ctx.resume();

      A.isPlaying = true;
      A._introDone = false;
      A._lastScheduleAt = A.ctx.currentTime;
      applyModeParams();
      schedule();
    };

    A.stop = () => {
      A.isPlaying = false;
      if (A._timer) { clearTimeout(A._timer); A._timer = null; }
    };

    A.toggle = async () => {
      A.isOn = !A.isOn;
      if (A.isOn) await A.start();
      // OFF: scheduler keeps lightweight checks; no tones
    };

    A.setBossMode = (on) => {
      A.bossMode = !!on;
      applyModeParams();
      // 템포는 다음 루프부터 반영 (자연스럽게 전환)
    };

    return A;
  }

  window.TEL = {
    start(stage) {
      // ===== Canvas / View =====
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d", { alpha: false });
      const view = { scale: 1, offX: 0, offY: 0 };

      function resize() {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(innerWidth * dpr);
        canvas.height = Math.floor(innerHeight * dpr);
      }
      addEventListener("resize", resize);
      resize();

      function beginFrame() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = stage.letterboxColor || "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const scale = Math.min(canvas.width / LOG_W, canvas.height / LOG_H);
        const offX = (canvas.width - LOG_W * scale) / 2;
        const offY = (canvas.height - LOG_H * scale) / 2;
        view.scale = scale; view.offX = offX; view.offY = offY;
        ctx.setTransform(scale, 0, 0, scale, offX, offY);
      }

      function screenToLogical(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const px = (clientX - rect.left) / rect.width * canvas.width;
        const py = (clientY - rect.top) / rect.height * canvas.height;
        return { x: (px - view.offX) / view.scale, y: (py - view.offY) / view.scale };
      }

      // ===== Sprites =====
      const sprites = loadSprites(stage.sprites);
      window.__TEL_SPRITES__ = sprites;

      // ===== UI =====
      const elStart = document.getElementById("startLayer");
      const btnSwap = document.getElementById("btnSwap");
      const btnRestart = document.getElementById("btnRestart");
      const btnBgm = document.getElementById("btnBgm");

      // ===== BGM =====
      const BGM = createBGM();

      function syncBgmButton() {
        if (!btnBgm) return;
        btnBgm.textContent = BGM.isOn ? "BGM: ON" : "BGM: OFF";
      }

      // ===== State =====
      const State = { TITLE: "TITLE", PLAY: "PLAY", WIN: "WIN", LOSE: "LOSE" };
      let stateNow = State.TITLE;
      let timeInPlay = 0;

      // ===== Entities =====
      const bullets = [];
      const enemies = [];
      const eBullets = [];
      const items = []; // {type:"GUN"|"HEAL", x,y, vy, r}

      // ===== Player =====
      const player = {
        x: LOG_W / 2,
        y: LOG_H * 0.82,
        char: "LUCA",
        hp: 100,
        r: 14,
        score: 0,
        weaponLv: { LUCA: 1, MARCA: 1 },
        maxWeaponLv: { LUCA: 1, MARCA: 1 },
      };
      const drag = { active: false, id: null, tx: player.x, ty: player.y };

      // ===== Boss =====
      const boss = {
        active: false,
        entered: false,
        x: LOG_W / 2,
        y: -160,
        r: 34,
        t: 0,
        hp: stage.boss?.maxHP ?? 3000,
        maxHP: stage.boss?.maxHP ?? 3000,
        shootCD: 1.0,
        phase: 0
      };

      // ===== WIN: Back button =====
      let winMenuBtn = null;
      function ensureWinMenuButton(show) {
        if (!winMenuBtn) {
          winMenuBtn = document.createElement("button");
          winMenuBtn.textContent = "스테이지 선택으로";
          Object.assign(winMenuBtn.style, {
            position: "fixed",
            left: "50%",
            top: "70%",
            transform: "translate(-50%,-50%)",
            padding: "12px 16px",
            borderRadius: "14px",
            border: "1px solid rgba(42,49,67,0.9)",
            background: "rgba(12,16,28,0.75)",
            color: "#e8f2ff",
            fontWeight: "900",
            fontSize: "14px",
            zIndex: "9999",
            display: "none",
            cursor: "pointer"
          });
          winMenuBtn.addEventListener("click", () => location.href = "index.html");
          document.body.appendChild(winMenuBtn);
        }
        winMenuBtn.style.display = show ? "block" : "none";
      }

      // ===== Reset / Start =====
      function resetGame() {
        stateNow = State.TITLE;
        timeInPlay = 0;

        player.x = LOG_W / 2;
        player.y = LOG_H * 0.82;
        player.char = "LUCA";
        player.hp = 100;
        player.score = 0;
        player.weaponLv.LUCA = 1;
        player.weaponLv.MARCA = 1;
        player.maxWeaponLv.LUCA = 1;
        player.maxWeaponLv.MARCA = 1;

        drag.active = false; drag.id = null;
        drag.tx = player.x; drag.ty = player.y;

        bullets.length = 0;
        enemies.length = 0;
        eBullets.length = 0;
        items.length = 0;

        boss.active = false;
        boss.entered = false;
        boss.x = LOG_W / 2;
        boss.y = -160;
        boss.t = 0;
        boss.hp = boss.maxHP;
        boss.shootCD = 1.0;
        boss.phase = 0;

        BGM.setBossMode(false);

        if (elStart) elStart.style.display = "flex";
        ensureWinMenuButton(false);
      }

      async function startPlay() {
        if (stateNow !== State.TITLE) return;
        stateNow = State.PLAY;
        if (elStart) elStart.style.display = "none";
        ensureWinMenuButton(false);

        await BGM.start();
        syncBgmButton();
      }

      // ===== Input =====
      async function onPointerDown(e) {
        e.preventDefault();
        await startPlay();
        drag.active = true;
        drag.id = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
        const p = screenToLogical(e.clientX, e.clientY);
        drag.tx = p.x; drag.ty = p.y;
      }
      function onPointerMove(e) {
        if (!drag.active || e.pointerId !== drag.id) return;
        e.preventDefault();
        const p = screenToLogical(e.clientX, e.clientY);
        drag.tx = p.x; drag.ty = p.y;
      }
      function onPointerUp(e) {
        if (e.pointerId !== drag.id) return;
        e.preventDefault();
        drag.active = false;
        drag.id = null;
      }

      canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
      canvas.addEventListener("pointermove", onPointerMove, { passive: false });
      canvas.addEventListener("pointerup", onPointerUp, { passive: false });
      canvas.addEventListener("pointercancel", onPointerUp, { passive: false });

      function onTouch(e) {
        e.preventDefault();
        const t = e.touches[0] || e.changedTouches[0];
        if (!t) return;
        const p = screenToLogical(t.clientX, t.clientY);
        drag.tx = p.x; drag.ty = p.y;
        drag.active = (e.type !== "touchend" && e.type !== "touchcancel");
      }
      canvas.addEventListener("touchstart", async (e) => { await startPlay(); onTouch(e); }, { passive:false });
      canvas.addEventListener("touchmove", onTouch, { passive:false });
      canvas.addEventListener("touchend", onTouch, { passive:false });
      canvas.addEventListener("touchcancel", onTouch, { passive:false });
      addEventListener("touchmove", (e) => e.preventDefault(), { passive:false });

      if (elStart) {
        elStart.addEventListener("pointerdown", async (e)=>{ e.preventDefault(); await startPlay(); }, { passive:false });
        elStart.addEventListener("touchstart", async (e)=>{ e.preventDefault(); await startPlay(); }, { passive:false });
      }

      if (btnSwap) {
        btnSwap.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (stateNow !== State.PLAY) return;
          player.char = (player.char === "LUCA") ? "MARCA" : "LUCA";
        }, { passive:false });
      }
      if (btnRestart) {
        btnRestart.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          resetGame();
        }, { passive:false });
      }
      if (btnBgm) {
        btnBgm.addEventListener("pointerdown", async (e) => {
          e.preventDefault();
          await BGM.toggle();
          syncBgmButton();
        }, { passive:false });
      }

      // ===== Player Fire (upgrade patterns) =====
      let fireCD = 0;
      function firePlayer(dt) {
        fireCD = Math.max(0, fireCD - dt);
        if (fireCD > 0) return;

        const key = player.char;
        const lv = clamp(player.weaponLv[key] ?? 1, 1, 5);

        const isLuca = key === "LUCA";
        const baseDmg = isLuca ? 12 : 10;
        const dmg = baseDmg + (lv - 1) * 2;

        const n = lv;
        const maxAngle = isLuca
          ? (0.10 + 0.06 * (lv - 1))
          : (0.02 + 0.005 * (lv - 1));

        for (let i = 0; i < n; i++) {
          const t = (n === 1) ? 0 : (i - (n - 1) / 2) / ((n - 1) / 2);
          const ang = t * maxAngle;
          const speed = 820;

          bullets.push({
            x: player.x,
            y: player.y - 28,
            vx: Math.sin(ang) * speed,
            vy: -Math.cos(ang) * speed,
            r: 3.2,
            dmg,
            t: 0,
            life: 1.4
          });
        }

        fireCD = isLuca ? 0.12 : 0.14;
      }

      // ===== Enemy / Boss shooting =====
      function shootEnemyDown(e) {
        eBullets.push({
          kind: "ENEMY",
          x: e.x,
          y: e.y + 18,
          vx: 0,
          vy: rand(240, 320),
          r: 4.2,
          dmg: 12,
          life: 3.0,
          t: 0
        });
      }

      function shootBossFan(count, speed, spreadRad) {
        const base = Math.PI / 2;
        for (let i = 0; i < count; i++) {
          const t = (count === 1) ? 0 : (i - (count - 1) / 2) / ((count - 1) / 2);
          const ang = base + t * spreadRad;
          eBullets.push({
            kind: "BOSS",
            x: boss.x,
            y: boss.y + 40,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            r: 4.6,
            dmg: 14,
            life: 4.0,
            t: 0
          });
        }
      }

      function shootBossAimedBurst(burst = 3, speed = 320, gap = 0.10) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / dist, uy = dy / dist;

        for (let i = 0; i < burst; i++) {
          const off = (i - (burst - 1) / 2) * gap;
          const vx = (ux * Math.cos(off) - uy * Math.sin(off)) * speed;
          const vy = (ux * Math.sin(off) + uy * Math.cos(off)) * speed;
          eBullets.push({
            kind: "BOSS",
            x: boss.x,
            y: boss.y + 30,
            vx, vy,
            r: 4.8,
            dmg: 16,
            life: 4.0,
            t: 0
          });
        }
      }

      function updateBossShooting(dt) {
        const hpRatio = boss.hp / boss.maxHP;
        boss.phase = (hpRatio < 0.25) ? 2 : (hpRatio < 0.55) ? 1 : 0;

        boss.shootCD = Math.max(0, boss.shootCD - dt);
        if (boss.shootCD > 0) return;

        if (boss.phase === 0) {
          shootBossFan(5, 300, 0.55);
          boss.shootCD = 1.05;
        } else if (boss.phase === 1) {
          shootBossFan(7, 320, 0.75);
          shootBossAimedBurst(3, 340, 0.10);
          boss.shootCD = 0.95;
        } else {
          shootBossFan(9, 340, 0.95);
          shootBossAimedBurst(5, 360, 0.12);
          boss.shootCD = 0.70;
        }
      }

      // ===== Items (2 types) =====
      function spawnItem(type, x, y) {
        items.push({ type, x, y, vy: 140, r: 12 });
      }

      function maybeDropItemsOnKill(x, y) {
        const rates = stage.dropRates || { gun: 0.20, heal: 0.10 };
        const r = Math.random();
        if (r < (rates.heal ?? 0.10)) {
          spawnItem("HEAL", x, y);
          return;
        }
        if (r < (rates.heal ?? 0.10) + (rates.gun ?? 0.20)) {
          spawnItem("GUN", x, y);
        }
      }

      function applyGunUpgrade() {
        const key = player.char;
        player.weaponLv[key] = clamp((player.weaponLv[key] ?? 1) + 1, 1, 5);
        player.maxWeaponLv[key] = Math.max(player.maxWeaponLv[key], player.weaponLv[key]);
      }

      function applyHeal() {
        const heal = stage.healAmount ?? 22;
        player.hp = clamp(player.hp + heal, 0, 100);
      }

      // ===== Spawning =====
      let spawnCD = 0;
      function spawnEnemyFromStage() {
        const e = stage.spawnEnemy({ LOG_W, LOG_H, rand, clamp });
        if (e) enemies.push(e);
      }

      // ===== Draw =====
      function drawBackground(dt) {
        stage.drawBackground(ctx, dt, { LOG_W, LOG_H, timeInPlay, sprites });
      }

      function drawEnemy(e) {
        const img = sprites.robo_blue;
        const size = stage.enemySize ?? 64;
        if (!imgReady(img)) {
          ctx.fillStyle = "rgba(80,160,255,0.95)";
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, Math.PI * 2); ctx.fill();
          return;
        }
        drawSpriteCentered(ctx, img, e.x, e.y, size);
      }

      function drawBoss() {
        if (!boss.active) return;
        const img = sprites.robo_red;
        const size = stage.boss?.size ?? 170;
        if (!imgReady(img)) {
          ctx.fillStyle = "rgba(255,90,90,0.95)";
          ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.r, 0, Math.PI * 2); ctx.fill();
          return;
        }
        drawSpriteCentered(ctx, img, boss.x, boss.y, size);
      }

      function drawPlayer() {
        const img = (player.char === "LUCA") ? sprites.luca : sprites.marca;
        const size = stage.playerSize ?? 72;
        if (!imgReady(img)) {
          ctx.fillStyle = "rgba(232,242,255,0.9)";
          ctx.beginPath(); ctx.arc(player.x, player.y, 22, 0, Math.PI * 2); ctx.fill();
          return;
        }
        drawSpriteCentered(ctx, img, player.x, player.y, size);
      }

      function drawItems() {
        for (const it of items) {
          const img = (it.type === "GUN") ? sprites.gun : sprites.fish_can;
          if (imgReady(img)) {
            drawSpriteCentered(ctx, img, it.x, it.y, 44);
          } else {
            ctx.save();
            ctx.fillStyle = it.type === "GUN" ? "rgba(255,220,120,0.95)" : "rgba(118,210,200,0.95)";
            ctx.beginPath(); ctx.arc(it.x, it.y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        }
      }

      function drawHUD() {
        ctx.save();

        // HP
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(8, 8, 140, 34);
        ctx.fillStyle = "rgba(232,242,255,0.9)";
        ctx.font = "12px system-ui";
        ctx.fillText("HP", 14, 22);
        ctx.fillStyle = "rgba(255,90,90,0.85)";
        ctx.fillRect(36, 14, 104 * (player.hp / 100), 10);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(36, 14, 104, 10);

        // SCORE
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(232,242,255,0.95)";
        ctx.font = "900 14px system-ui";
        ctx.fillText(`SCORE ${player.score}`, LOG_W - 10, 24);
        ctx.textAlign = "left";

        // Weapon levels
        ctx.fillStyle = "rgba(232,242,255,0.85)";
        ctx.font = "12px system-ui";
        ctx.fillText(`LUCA LV.${player.weaponLv.LUCA}  MARCA LV.${player.weaponLv.MARCA}`, 10, LOG_H - 10);

        // Boss bar
        if (boss.active) {
          const w = 260, h = 12;
          const x = (LOG_W - w) / 2, y = 40;
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(x - 8, y - 10, w + 16, h + 28);
          ctx.fillStyle = "rgba(232,242,255,0.9)";
          ctx.fillText(stage.boss?.name ?? "BOSS", x, y);
          const p = Math.max(0, boss.hp / boss.maxHP);
          ctx.fillStyle = "rgba(255,120,120,0.9)";
          ctx.fillRect(x, y + 6, w * p, h);
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.strokeRect(x, y + 6, w, h);
        }

        ctx.restore();
      }

      // boss hp 50%↓ 어둡게
      function drawDimIfNeeded() {
        if (!boss.active) return;
        const hpRatio = boss.hp / boss.maxHP;
        if (hpRatio > 0.5) return;
        const t = clamp((0.5 - hpRatio) / 0.5, 0, 1);
        const a = 0.10 + 0.12 * t;
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
        ctx.fillRect(0, 0, LOG_W, LOG_H);
        ctx.restore();
      }

      function drawClearStatsOverlay() {
        const seconds = Math.max(0, timeInPlay);
        const mm = Math.floor(seconds / 60);
        const ss = Math.floor(seconds % 60);
        const timeText = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.60)";
        ctx.fillRect(0, 0, LOG_W, LOG_H);

        ctx.fillStyle = "rgba(232,242,255,0.96)";
        ctx.textAlign = "center";
        ctx.font = "900 22px system-ui";
        ctx.fillText("STAGE 1 CLEAR", LOG_W / 2, LOG_H * 0.38);

        ctx.font = "650 13px system-ui";
        ctx.fillText("실험 로그 요약", LOG_W / 2, LOG_H * 0.38 + 22);

        const cardW = 280, cardH = 150;
        const cx = (LOG_W - cardW) / 2;
        const cy = LOG_H * 0.45;

        ctx.fillStyle = "rgba(12,16,28,0.72)";
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(232,242,255,0.92)";
        ctx.font = "700 13px system-ui";
        ctx.fillText(`TIME  : ${timeText}`, cx + 18, cy + 38);
        ctx.fillText(`SCORE : ${player.score}`, cx + 18, cy + 64);
        ctx.fillText(`MAX LV (LUCA)  : ${player.maxWeaponLv.LUCA}`, cx + 18, cy + 90);
        ctx.fillText(`MAX LV (MARCA) : ${player.maxWeaponLv.MARCA}`, cx + 18, cy + 116);

        ctx.textAlign = "center";
        ctx.font = "650 12px system-ui";
        ctx.fillStyle = "rgba(232,242,255,0.80)";
        ctx.fillText("버튼으로 스테이지 선택 / RESTART로 다시", LOG_W / 2, LOG_H * 0.66);

        ctx.restore();
        ctx.textAlign = "left";
      }

      // ===== Main loop =====
      let last = performance.now();
      function loop(t) {
        const dt = Math.min(0.033, (t - last) / 1000);
        last = t;

        beginFrame();
        drawBackground(dt);

        if (stateNow === State.PLAY) {
          timeInPlay += dt;

          // move
          const tx = clamp(drag.tx, 22, LOG_W - 22);
          const ty = clamp(drag.ty, LOG_H * 0.45, LOG_H - 46);
          player.x = lerp(player.x, tx, 0.28);
          player.y = lerp(player.y, ty, 0.28);

          // fire
          firePlayer(dt);

          // spawn enemies (until boss)
          if (!boss.active) {
            spawnCD = Math.max(0, spawnCD - dt);
            if (spawnCD <= 0) {
              spawnEnemyFromStage();
              const [a, b] = stage.spawnInterval ?? [0.42, 0.72];
              spawnCD = rand(a, b);
            }
          }

          // boss appear
          if (!boss.active && timeInPlay >= (stage.boss?.appearAt ?? 18)) {
            boss.active = true;
          }
        }

        // bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.t += dt;
          b.x += (b.vx ?? 0) * dt;
          b.y += (b.vy ?? -760) * dt;
          if (b.t > b.life || b.y < -80 || b.x < -80 || b.x > LOG_W + 80) bullets.splice(i, 1);
        }

        // enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          e.t = (e.t ?? 0) + dt;

          e.y += e.vy * dt;

          if (e.baseX == null) e.baseX = e.x;
          const amp = e.weaveAmp ?? 48;
          const freq = e.weaveFreq ?? 2.2;
          e.x = clamp(e.baseX + Math.sin(e.t * freq) * amp, 24, LOG_W - 24);

          e.shootCD = Math.max(0, (e.shootCD ?? rand(0.2, 1.0)) - dt);
          if (stateNow === State.PLAY && e.y > 40 && e.shootCD <= 0) {
            if (Math.random() < (stage.enemyShootChancePerSec ?? 0.85) * dt) {
              shootEnemyDown(e);
              e.shootCD = rand(0.9, 1.6);
            }
          }

          if (e.y > LOG_H + 80) enemies.splice(i, 1);
        }

        // boss
        if (boss.active && stateNow === State.PLAY) {
          boss.t += dt;
          stage.updateBoss(boss, dt, { LOG_W, LOG_H });

          // ✅ boss mode switch for BGM (50%↓)
          const hpRatio = boss.hp / boss.maxHP;
          BGM.setBossMode(hpRatio <= 0.5);

          if (boss.entered) updateBossShooting(dt);

          if (boss.hp <= 0) {
            boss.hp = 0;
            stateNow = State.WIN;
            player.score += (stage.score?.bossKill ?? 900);
            ensureWinMenuButton(true);
            BGM.setBossMode(false);
          }
        }

        // enemy bullets
        for (let i = eBullets.length - 1; i >= 0; i--) {
          const b = eBullets[i];
          b.t += dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.t > (b.life ?? 4.0) || b.y > LOG_H + 120 || b.x < -120 || b.x > LOG_W + 120) {
            eBullets.splice(i, 1);
          }
        }

        // items
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.y += it.vy * dt;
          if (it.y > LOG_H + 60) items.splice(i, 1);
        }

        // collisions: bullets vs enemies/boss
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          let hit = false;

          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (circleHit(b.x, b.y, b.r, e.x, e.y, e.r)) {
              e.hp -= b.dmg;
              hit = true;
              if (e.hp <= 0) {
                player.score += (stage.score?.enemyKill ?? 60);
                maybeDropItemsOnKill(e.x, e.y);
                enemies.splice(j, 1);
              }
              break;
            }
          }

          if (!hit && boss.active && circleHit(b.x, b.y, b.r, boss.x, boss.y, boss.r)) {
            boss.hp -= b.dmg;
            hit = true;
          }

          if (hit) bullets.splice(i, 1);
        }

        // enemy bullets vs player
        for (let i = eBullets.length - 1; i >= 0; i--) {
          const b = eBullets[i];
          if (circleHit(b.x, b.y, b.r, player.x, player.y, player.r)) {
            player.hp -= (b.dmg ?? 12);
            eBullets.splice(i, 1);
            if (player.hp <= 0) {
              player.hp = 0;
              stateNow = State.LOSE;
              ensureWinMenuButton(false);
              BGM.setBossMode(false);
            }
          }
        }

        // item pickup
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (circleHit(it.x, it.y, it.r, player.x, player.y, player.r + 10)) {
            if (it.type === "GUN") applyGunUpgrade();
            if (it.type === "HEAL") applyHeal();
            items.splice(i, 1);
          }
        }

        // draw
        for (const e of enemies) drawEnemy(e);
        drawBoss();
        drawItems();

        ctx.fillStyle = "rgba(255,180,90,0.95)";
        for (const b of eBullets) {
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = "rgba(232,242,255,0.95)";
        for (const b of bullets) {
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        }

        drawPlayer();

        // visuals: dim when boss hp<50%
        drawDimIfNeeded();

        drawHUD();

        if (stateNow === State.WIN) drawClearStatsOverlay();

        requestAnimationFrame(loop);
      }

      resetGame();
      requestAnimationFrame(loop);

      // ensure button label
      syncBgmButton();
    }
  };
})();
