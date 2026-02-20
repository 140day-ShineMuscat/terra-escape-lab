/* Terra Escape Lab - Engine (Stage-driven)
 * - Portrait 2:1 fixed logical resolution (360x720)
 * - Letterbox scaling (contain)
 * - Touch drag to move + auto fire
 * - Stage provides background + spawn rules + boss rules
 */
(() => {
  const LOG_W = 360;
  const LOG_H = 720;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  function imgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function loadSprites(map) {
    const out = {};
    for (const [key, src] of Object.entries(map || {})) {
      const im = new Image();
      im.src = src;
      out[key] = im;
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

  // Expose as global
  window.TEL = {
    start(stage) {
      // ---------- Canvas ----------
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d", { alpha: false });

      // ---------- View transform (letterbox contain) ----------
      const view = { scale: 1, offX: 0, offY: 0 };

      function resize() {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(innerWidth * dpr);
        canvas.height = Math.floor(innerHeight * dpr);
      }
      addEventListener("resize", resize);
      resize();

      function beginFrame() {
        // letterbox background
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
        return {
          x: (px - view.offX) / view.scale,
          y: (py - view.offY) / view.scale
        };
      }

      // ---------- Sprites ----------
      const sprites = loadSprites(stage.sprites);
	window.__TEL_SPRITES__ = sprites;


      // ---------- UI ----------
      const elStart = document.getElementById("startLayer");
      const btnSwap = document.getElementById("btnSwap");
      const btnRestart = document.getElementById("btnRestart");

      // ---------- State ----------
      const State = { TITLE: "TITLE", PLAY: "PLAY", WIN: "WIN", LOSE: "LOSE" };
      let stateNow = State.TITLE;
      let timeInPlay = 0;

      // ---------- Player ----------
      const player = {
        x: LOG_W / 2,
        y: LOG_H * 0.82,
        char: "LUCA",  // or MARCA
        hp: 100,
        r: 14,
        inv: 0
      };
      const drag = { active: false, id: null, tx: player.x, ty: player.y };

      // ---------- Entities ----------
      const bullets = [];
      const enemies = [];

      // Boss object lives always; stage decides when active
      const boss = {
        active: false,
        x: LOG_W / 2,
        y: -140,
        r: 34,
        hp: stage.boss?.maxHP ?? 500,
        maxHP: stage.boss?.maxHP ?? 500,
        t: 0,
        entered: false
      };

      // ---------- Reset / Start ----------
      function resetGame() {
        stateNow = State.TITLE;
        timeInPlay = 0;

        player.x = LOG_W / 2;
        player.y = LOG_H * 0.82;
        player.char = "LUCA";
        player.hp = 100;
        player.inv = 0;

        drag.active = false; drag.id = null;
        drag.tx = player.x; drag.ty = player.y;

        bullets.length = 0;
        enemies.length = 0;

        boss.active = false;
        boss.x = LOG_W / 2;
        boss.y = -140;
        boss.hp = boss.maxHP;
        boss.t = 0;
        boss.entered = false;

        if (elStart) elStart.style.display = "flex";
      }

      function startPlay() {
        if (stateNow !== State.TITLE) return;
        stateNow = State.PLAY;
        if (elStart) elStart.style.display = "none";
      }

      // ---------- Input ----------
      function onPointerDown(e) {
        e.preventDefault();
        startPlay();
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

      // iOS fallback
      function onTouch(e) {
        e.preventDefault();
        startPlay();
        const t = e.touches[0] || e.changedTouches[0];
        if (!t) return;
        const p = screenToLogical(t.clientX, t.clientY);
        drag.tx = p.x; drag.ty = p.y;
        drag.active = (e.type !== "touchend" && e.type !== "touchcancel");
      }
      canvas.addEventListener("touchstart", onTouch, { passive: false });
      canvas.addEventListener("touchmove", onTouch, { passive: false });
      canvas.addEventListener("touchend", onTouch, { passive: false });
      canvas.addEventListener("touchcancel", onTouch, { passive: false });
      addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

      // start overlay also starts
      if (elStart) {
        elStart.addEventListener("pointerdown", (e) => { e.preventDefault(); startPlay(); }, { passive: false });
        elStart.addEventListener("touchstart", (e) => { e.preventDefault(); startPlay(); }, { passive: false });
      }

      // buttons
      if (btnSwap) {
        btnSwap.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (stateNow !== State.PLAY) return;
          player.char = (player.char === "LUCA") ? "MARCA" : "LUCA";
        }, { passive: false });
      }
      if (btnRestart) {
        btnRestart.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          resetGame();
        }, { passive: false });
      }

      // ---------- Fire ----------
      let fireCD = 0;
      function fire(dt) {
        fireCD = Math.max(0, fireCD - dt);
        if (fireCD > 0) return;

        const isLuca = player.char === "LUCA";
        bullets.push({
          x: player.x,
          y: player.y - 26,
          vy: -760,
          r: 3.2,
          dmg: isLuca ? 12 : 10,
          life: 1.6,
          t: 0
        });
        fireCD = isLuca ? 0.11 : 0.14;
      }

      // ---------- Spawn (stage-driven) ----------
      let spawnCD = 0;

      function spawnEnemyFromStage() {
        const e = stage.spawnEnemy({
          LOG_W, LOG_H,
          rand, clamp
        });
        if (e) enemies.push(e);
      }

      // ---------- Draw helpers ----------
      function drawBackground(dt) {
        stage.drawBackground(ctx, dt, {
          LOG_W, LOG_H,
          timeInPlay
        });
      }

      function drawPlayer() {
        const img = (player.char === "LUCA") ? sprites.luca : sprites.marca;
        const size = stage.playerSize ?? 72;

        if (!imgReady(img)) {
          ctx.fillStyle = "rgba(232,242,255,0.9)";
          ctx.beginPath();
          ctx.arc(player.x, player.y, 22, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        drawSpriteCentered(ctx, img, player.x, player.y, size);
      }

      function drawEnemy(e) {
        const img = sprites.robo_blue;
        const size = stage.enemySize ?? 64;

        if (!imgReady(img)) {
          ctx.fillStyle = "rgba(80,160,255,0.95)";
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 6, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        drawSpriteCentered(ctx, img, e.x, e.y, size);
      }

      function drawBoss() {
        if (!boss.active) return;
        const img = sprites.robo_red;
        const size = stage.boss?.size ?? 150;

        if (!imgReady(img)) {
          ctx.fillStyle = "rgba(255,90,90,0.95)";
          ctx.beginPath();
          ctx.arc(boss.x, boss.y, boss.r, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        drawSpriteCentered(ctx, img, boss.x, boss.y, size);
      }

      function drawHUD() {
        // HP box
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(8, 8, 140, 34);

        ctx.fillStyle = "rgba(232,242,255,0.9)";
        ctx.font = "12px system-ui";
        ctx.fillText("HP", 14, 22);

        ctx.fillStyle = "rgba(255,90,90,0.85)";
        ctx.fillRect(36, 14, 104 * (player.hp / 100), 10);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(36, 14, 104, 10);

        // boss bar
        if (boss.active) {
          const w = 260, h = 12;
          const x = (LOG_W - w) / 2;
          const y = 40;
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

        // debug (원하면 stage.debug=false로 끄기)
        if (stage.debug) {
          ctx.fillStyle = "rgba(232,242,255,0.85)";
          ctx.font = "11px system-ui";
          ctx.fillText(`STATE: ${stateNow}`, 10, LOG_H - 30);
          ctx.fillText(`ENEMIES: ${enemies.length}  TIME: ${timeInPlay.toFixed(1)}s`, 10, LOG_H - 14);
        }

        ctx.restore();
      }

      // ---------- Main loop ----------
      let last = performance.now();
      function loop(t) {
        const dt = Math.min(0.033, (t - last) / 1000);
        last = t;

        beginFrame();
        drawBackground(dt);

        if (stateNow === State.PLAY) {
          timeInPlay += dt;

          // move toward drag target
          const tx = clamp(drag.tx, 22, LOG_W - 22);
          const ty = clamp(drag.ty, LOG_H * 0.45, LOG_H - 46);
          player.x = lerp(player.x, tx, 0.28);
          player.y = lerp(player.y, ty, 0.28);

          // auto fire
          fire(dt);

          // enemy spawn (until boss)
          if (!boss.active) {
            spawnCD = Math.max(0, spawnCD - dt);
            if (spawnCD <= 0) {
              spawnEnemyFromStage();
              const [a, b] = stage.spawnInterval ?? [0.35, 0.65];
              spawnCD = rand(a, b);
            }
          }

          // boss appear
          if (!boss.active && timeInPlay >= (stage.boss?.appearAt ?? 18)) {
            boss.active = true;
          }
        }

        // update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.t += dt;
          b.y += b.vy * dt;
          if (b.t > b.life || b.y < -60) bullets.splice(i, 1);
        }

        // update enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          e.y += e.vy * dt;
          if (e.y > LOG_H + 60) enemies.splice(i, 1);
        }

        // update boss (stage-driven motion)
        if (boss.active) {
          boss.t += dt;
          stage.updateBoss(boss, dt, { LOG_W, LOG_H });
          if (boss.hp <= 0 && stateNow === State.PLAY) {
            boss.hp = 0;
            stateNow = State.WIN;
          }
        }

        // collisions: bullets vs enemies/boss
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          let hit = false;

          // enemies
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (circleHit(b.x, b.y, b.r, e.x, e.y, e.r)) {
              e.hp -= b.dmg;
              hit = true;
              if (e.hp <= 0) enemies.splice(j, 1);
              break;
            }
          }

          // boss
          if (!hit && boss.active && circleHit(b.x, b.y, b.r, boss.x, boss.y, boss.r)) {
            boss.hp -= b.dmg;
            hit = true;
          }

          if (hit) bullets.splice(i, 1);
        }

        // draw enemies / boss / bullets / player
        for (const e of enemies) drawEnemy(e);
        drawBoss();

        // bullets
        ctx.fillStyle = "rgba(232,242,255,0.95)";
        for (const b of bullets) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }

        drawPlayer();
        drawHUD();

        // overlays
        if (stateNow === State.WIN) {
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(0, 0, LOG_W, LOG_H);
          ctx.fillStyle = "rgba(232,242,255,0.95)";
          ctx.textAlign = "center";
          ctx.font = "900 22px system-ui";
          ctx.fillText("BOSS DOWN", LOG_W / 2, LOG_H / 2 - 10);
          ctx.font = "650 12px system-ui";
          ctx.fillText("RESTART로 다시", LOG_W / 2, LOG_H / 2 + 16);
          ctx.restore();
          ctx.textAlign = "left";
        }

        requestAnimationFrame(loop);
      }

      resetGame();
      requestAnimationFrame(loop);
    }
  };
})();
