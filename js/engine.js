// Stage 1 config (Living room background + 2 item types + tuned boss)
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

      // ✅ items
      gun: "assets/gun.png",          // 미사일 업그레이드
      fish_can: "assets/fish_can.png" // 체력 회복
    },

    playerSize: 72,
    enemySize: 64,

    // 스테이지 템포
    spawnInterval: [0.42, 0.72],

    // 적 발사 빈도
    enemyShootChancePerSec: 0.85,

    // ✅ 아이템 드랍율 (적 처치 시 각각 확률)
    dropRates: {
      gun: 0.20,      // 미사일 업그레이드
      heal: 0.10      // 체력 회복
    },

    // 회복량
    healAmount: 22,

    score: {
      enemyKill: 60,
      bossKill: 900
    },

    boss: {
      name: "ROBO FATHER",
      appearAt: 18,
      maxHP: 1200,
      size: 170
    },

    drawBackground(ctx, dt, env) {
      const { LOG_W, LOG_H, sprites } = env;

      ctx.fillStyle = "#0f1220";
      ctx.fillRect(0, 0, LOG_W, LOG_H);

      const img = sprites.stage1_back;
      if (!img || !img.complete || img.naturalWidth === 0) return;

      // cover
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(LOG_W / iw, LOG_H / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = (LOG_W - dw) / 2;
      const dy = (LOG_H - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    },

    spawnEnemy({ LOG_W }) {
      // robo_blue가 천천히 내려오게
      return {
        x: Math.random() * (LOG_W - 60) + 30,
        y: -60,
        vy: 70 + Math.random() * 40, // slow
        r: 16,
        hp: 28,

        // 좌우 흔들림
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
