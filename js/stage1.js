// Stage 1 config (Living room background image)
(() => {
  // 배경 스크롤(원하면 0으로 두면 고정 배경)
  let bgScroll = 0;

  window.Stage1 = {
    name: "STAGE 1",
    debug: false,

    letterboxColor: "#000",

    sprites: {
      luca: "assets/luca.png",
      marca: "assets/marca.png",
      robo_blue: "assets/robo_blue.png",
      robo_red: "assets/robo_red.png",
      // ✅ 배경 추가
      stage1_back: "assets/stage1_back.png",
    },

    playerSize: 72,
    enemySize: 64,

    spawnInterval: [0.35, 0.65],

    boss: {
      name: "ROBO FATHER",
      appearAt: 18,
      maxHP: 500,
      size: 150
    },

    // ✅ 배경을 "이미지로" 그리기
    drawBackground(ctx, dt, env) {
      const { LOG_W, LOG_H } = env;

      // 기본 배경색 (이미지 로딩 전 대비)
      ctx.fillStyle = "#0f1220";
      ctx.fillRect(0, 0, LOG_W, LOG_H);

      // 이미지 가져오기 (engine.js가 stage.sprites를 Image로 만들어서 넘겨줌)
      // engine.js 쪽에서 sprites 접근이 필요하므로, 아래 방법을 씀:
      // 1) stage 객체에 캐시해둠 (처음 한 번)
      if (!this._bgImg) this._bgImg = (window.__TEL_SPRITES__?.stage1_back) || null;

      const img = this._bgImg;

      // 엔진이 스프라이트를 전역으로 노출하게끔 stage1.html에 2줄만 추가할 거야(아래 2번 참고)
      const ready = img && img.complete && img.naturalWidth > 0;

      if (!ready) return;

      // --- 옵션 A: 고정 배경(추천 기본) ---
      // 배경을 화면 꽉 채우면서 비율 유지(cover)
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(LOG_W / iw, LOG_H / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (LOG_W - dw) / 2;
      const dy = (LOG_H - dh) / 2;

      ctx.drawImage(img, dx, dy, dw, dh);

      // --- 옵션 B: 살짝 아래로 흐르는 느낌을 원하면 아래 3줄만 활성화 ---
      // bgScroll = (bgScroll + 20 * dt) % 9999;
      // const ddy = dy + (bgScroll % 40); // 0~40px 정도만 천천히 움직임
      // ctx.drawImage(img, dx, ddy, dw, dh);
    },

    spawnEnemy({ LOG_W }) {
      return {
        x: Math.random() * (LOG_W - 60) + 30,
        y: -50,
        vy: 110 + Math.random() * 60,
        r: 16,
        hp: 26
      };
    },

    updateBoss(boss, dt, { LOG_W }) {
      if (!boss.entered) {
        boss.y += 140 * dt;
        if (boss.y >= 120) { boss.y = 120; boss.entered = true; }
        return;
      }
      boss.x = LOG_W / 2 + Math.sin(boss.t * 1.2) * 60;
      boss.y = 120 + Math.sin(boss.t * 1.6) * 10;
    }
  };
})();
