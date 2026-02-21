// Stage 1 config (Living room + 2 item types + longer stage + big cats)
(() => {
  window.Stage1 = {
    name: "STAGE 1",
    debug: false,
    letterboxColor: "#000",

    sprites: {
      luca: "assets/luca.png",
      marca: "assets/marca.png",
      robo_blue: "assets/robo_blue.png",
      robo_red: "assets/robo_red.png",
      stage1_back: "assets/stage1_back.png",
      gun: "assets/gun.png",
      fish_can: "assets/fish_can.png"
    },

    // ✅ 루카/마르카 크기 확대
    playerSize: 168,
    enemySize: 64,

    // ✅ 게임 템포 (원하면 더 늘릴 수 있음)
    spawnInterval: [0.42, 0.74],
    enemyShootChancePerSec: 0.85,

    dropRates: {
      gun: 0.15,
      heal: 0.5
    },
    healAmount: 22,

    score: {
      enemyKill: 60,
      bossKill: 900
    },

    boss: {
      name: "ROBO FATHER",
      // ✅ 보스 더 늦게 등장 (게임 시간 늘리기)
      appearAt: 40,     // 기존 18 → 40초
      // ✅ 보스 HP 5000
      maxHP: 5000,
      size: 210
    },

    drawBackground(ctx, dt, env) {
      const { LOG_W, LOG_H, sprites } = env;
      ctx.fillStyle = "#0f1220";
      ctx.fillRect(0, 0, LOG_W, LOG_H);

      const img = sprites.stage1_back;
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(LOG_W / iw, LOG_H / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = (LOG_W - dw) / 2;
      const dy = (LOG_H - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    },

    spawnEnemy({ LOG_W }) {
      return {
        x: Math.random() * (LOG_W - 60) + 30,
        y: -60,
        vy: 70 + Math.random() * 40, // slow fall
        r: 16,
        hp: 28,
        weaveAmp: 36 + Math.random() * 22,
        weaveFreq: 1.7 + Math.random() * 1.2,
        shootCD: Math.random() * 1.0
      };
    },

    updateBoss(boss, dt, { LOG_W }) {
      if (!boss.entered) {
        boss.y += 150 * dt;
        if (boss.y >= 120) { boss.y = 120; boss.entered = true; }
        return;
      }
      boss.x = LOG_W / 2 + Math.sin(boss.t * 1.1) * 70;
      boss.y = 120 + Math.sin(boss.t * 1.5) * 10;
    }
  };
})();
