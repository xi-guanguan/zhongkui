/* ghosts.js — 鬼怪系统：鬼队列(迁移套牛牛群循环机制)
 * 核心逻辑:
 *   1. 5种鬼固定循环出现(cycle打乱后无限重复)
 *   2. 全部鬼匀速从右到左移动
 *   3. 出左界后回收到队列末尾，类型按cycle分配
 *   4. 链套向最接近画面中央的鬼
 *   5. catchP是链套住后的被抓概率，不是出现概率
 *   6. ★ 套中鬼后队列必须立即停止(paused)
 * 依赖：CONFIG, State
 * 暴露：Ghosts (全局) */

var Ghosts = (function() {
  var M = Math;
  var W = CONFIG.W;
  var LY = CONFIG.LY;

  // ── 队列参数 (迁移套牛LY.COW) ──
  var GHOST_Y = LY.ARENA_Y + LY.ARENA_H / 2;  // 鬼在竞技场中央
  var VISIBLE = 5;
  var SPACING = M.floor(W / VISIBLE);  // 同套牛64px
  var SPEED = 40;           // 匀速 px/s (同套牛)
  var MAX_HW = 16;

  // ── 鬼队列 (同套牛GS.cows) ──
  var queue = [];
  var cycle = [];
  var cycleIdx = 0;

  // ── 暂停标志: 套中鬼后队列立即停止 ──
  var paused = false;

  // ── 打乱5种鬼的循环序列 (同套牛cowCycle) ──
  function shuffleCycle() {
    cycle = [0, 1, 2, 3, 4].sort(function() { return M.random() - 0.5; });
    cycleIdx = 0;
  }

  function nextType() {
    var ti = cycle[cycleIdx % 5];
    cycleIdx++;
    return ti;
  }

  // ── 初始化鬼队列 (同套牛doStart) ──
  function initRound() {
    shuffleCycle();
    queue = [];
    paused = false;
    // 8只鬼: 5只在屏 + 3只右侧缓冲 (同套牛)
    for (var i = 0; i < 8; i++) {
      var ti = nextType();
      var gt = CONFIG.GT[ti];
      queue.push({
        type: ti,
        x: W + SPACING + i * SPACING,  // 从右边界外依次排列
        y: GHOST_Y,
        speed: SPEED,
        odds: gt.oddsMin + M.floor(M.random() * (gt.oddsMax - gt.oddsMin + 1))
      });
    }
  }

  // ── 更新鬼队列 ──
  function update(dt) {
    if (queue.length === 0) return;
    if (paused) return;  // ★ 套中鬼后队列立即停止

    // 全部鬼匀速向左移动
    for (var i = 0; i < queue.length; i++) {
      queue[i].x -= queue[i].speed * dt;
    }

    // 连续队列: 鬼完全出左界后回收到队列末尾 (同套牛)
    for (var i = 0; i < queue.length; i++) {
      var g = queue[i];
      if (g.x < -MAX_HW * 2) {
        var maxR = -999;
        for (var j = 0; j < queue.length; j++) {
          if (queue[j].x > maxR) maxR = queue[j].x;
        }
        g.x = maxR + SPACING;
        g.type = nextType();
        var gt = CONFIG.GT[g.type];
        g.odds = gt.oddsMin + M.floor(M.random() * (gt.oddsMax - gt.oddsMin + 1));
      }
    }
  }

  // ── 渲染鬼队列 (像素角色 + shadowBlur光环) ──
  function draw(ctx, t) {
    if (queue.length === 0) return;

    // x大的先画(远处)
    var sorted = queue.slice().sort(function(a, b) { return b.x - a.x; });

    for (var i = 0; i < sorted.length; i++) {
      var g = sorted[i];
      if (g.x < -MAX_HW * 2 || g.x > W + MAX_HW * 2) continue;

      var ghost = CONFIG.GT[g.type];
      var w = ghost.size[0], h = ghost.size[1];
      var gx = M.floor(g.x), gy = M.floor(g.y);
      var halfW = M.floor(w / 2), halfH = M.floor(h / 2);

      // ★ shadowBlur光环(如如之心: 让光环自己呼吸)
      ctx.shadowColor = ghost.glow;
      ctx.shadowBlur = 4 + M.sin(t * 2 + i * 1.7) * 3;

      // === 按鬼类型绘制像素角色 ===
      switch(g.type) {
        case 0: drawNiutou(ctx, gx, gy, w, h, halfW, halfH, t, i); break;
        case 1: drawMamian(ctx, gx, gy, w, h, halfW, halfH, t, i); break;
        case 2: drawHeiWuchang(ctx, gx, gy, w, h, halfW, halfH, t, i); break;
        case 3: drawBaiWuchang(ctx, gx, gy, w, h, halfW, halfH, t, i); break;
        case 4: drawXingtian(ctx, gx, gy, w, h, halfW, halfH, t, i); break;
      }

      ctx.shadowBlur = 0;

      // 名字
      ctx.font = CONFIG.FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ghost.color;
      ctx.fillText(ghost.name, gx, gy - halfH - 6);

      // 赔率
      ctx.fillStyle = CONFIG.CO.COPPER;
      ctx.fillText('x' + g.odds, gx, gy + halfH + 14);
    }
  }

  // ── 牛头: 棕色牛头人身,胆小抖动 ──
  function drawNiutou(ctx, gx, gy, w, h, halfW, halfH, t, seed) {
    var shake = M.floor(M.sin(t * 8 + seed) * 1.5);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(gx - halfW + shake, gy - halfH, w, h);
    ctx.fillStyle = '#654321';
    ctx.fillRect(gx - halfW + 2 + shake, gy - halfH - 4, 3, 4);
    ctx.fillRect(gx + halfW - 5 + shake, gy - halfH - 4, 3, 4);
    ctx.fillStyle = '#CD7F32';
    ctx.fillRect(gx - 1 + shake, gy - halfH + 4, 3, 2);
    ctx.fillStyle = '#FFF';
    ctx.fillRect(gx - 4 + shake, gy - halfH + 3, 2, 2);
    ctx.fillRect(gx + 3 + shake, gy - halfH + 3, 2, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(gx - 3 + shake, gy - halfH + 3, 1, 1);
    ctx.fillRect(gx + 4 + shake, gy - halfH + 3, 1, 1);
    ctx.fillStyle = '#654321';
    ctx.fillRect(gx - halfW + 2 + shake, gy + halfH, 4, 4);
    ctx.fillRect(gx + halfW - 6 + shake, gy + halfH, 4, 4);
  }

  // ── 马面: 靛紫马脸,沉稳漂浮 ──
  function drawMamian(ctx, gx, gy, w, h, halfW, halfH, t, seed) {
    var bob = M.floor(M.sin(t * 1.5 + seed) * 2);
    ctx.fillStyle = '#4B0082';
    ctx.fillRect(gx - halfW, gy - halfH + bob, w, h);
    ctx.fillStyle = '#6A0DAD';
    ctx.fillRect(gx - halfW + 1, gy - halfH - 3 + bob, w - 2, 3);
    ctx.fillRect(gx - halfW + 1, gy - halfH + 3 + bob, w - 2, 2);
    ctx.fillStyle = '#FFF';
    ctx.fillRect(gx - 4, gy - halfH + 2 + bob, 2, 2);
    ctx.fillRect(gx + 3, gy - halfH + 2 + bob, 2, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(gx - 3, gy - halfH + 2 + bob, 1, 1);
    ctx.fillRect(gx + 4, gy - halfH + 2 + bob, 1, 1);
    ctx.fillStyle = '#4B0082';
    ctx.fillRect(gx - halfW + 2, gy + halfH + bob, 4, 4);
    ctx.fillRect(gx + halfW - 6, gy + halfH + bob, 4, 4);
  }

  // ── 黑无常: 纯黑身体+鬼火绿眼,疯狂高速 ──
  function drawHeiWuchang(ctx, gx, gy, w, h, halfW, halfH, t, seed) {
    var jitter = M.floor(M.sin(t * 12 + seed * 3) * 2);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(gx - halfW + jitter, gy - halfH, w, h);
    ctx.fillStyle = '#333';
    ctx.fillRect(gx - halfW + 2 + jitter, gy - halfH - 2, w - 4, 2);
    ctx.fillStyle = '#39FF14';
    ctx.fillRect(gx - 4 + jitter, gy - halfH + 3, 3, 3);
    ctx.fillRect(gx + 2 + jitter, gy - halfH + 3, 3, 3);
    ctx.fillStyle = '#0D0D1A';
    ctx.fillRect(gx - 3 + jitter, gy - halfH + 4, 1, 1);
    ctx.fillRect(gx + 3 + jitter, gy - halfH + 4, 1, 1);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(gx - halfW + 2 + jitter, gy + halfH, 4, 4);
    ctx.fillRect(gx + halfW - 6 + jitter, gy + halfH, 4, 4);
  }

  // ── 白无常: 惨白身体+血红舌,阴冷闪现 ──
  function drawBaiWuchang(ctx, gx, gy, w, h, halfW, halfH, t, seed) {
    var slowBob = M.floor(M.sin(t * 0.8 + seed) * 2);
    var flicker = M.sin(t * 6 + seed * 2);
    var alpha = flicker > 0.7 ? 0.6 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(gx - halfW, gy - halfH + slowBob, w, h);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(gx - halfW + 2, gy - halfH - 3 + slowBob, w - 4, 3);
    ctx.fillStyle = '#DC143C';
    ctx.fillRect(gx - 2, gy - halfH + 5 + slowBob, 5, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(gx - 5, gy - halfH + 2 + slowBob, 2, 2);
    ctx.fillRect(gx + 3, gy - halfH + 2 + slowBob, 2, 2);
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(gx - halfW + 2, gy + halfH + slowBob, 4, 4);
    ctx.fillRect(gx + halfW - 6, gy + halfH + slowBob, 4, 4);
    ctx.globalAlpha = 1;
  }

  // ── 刑天: 暗红身体+火焰橙,狂暴冲撞 ──
  function drawXingtian(ctx, gx, gy, w, h, halfW, halfH, t, seed) {
    var charge = M.floor(M.sin(t * 4 + seed) * 3);
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(gx - halfW + charge, gy - halfH, w, h);
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(gx - halfW + 2 + charge, gy - halfH - 2, w - 4, 2);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(gx - 4 + charge, gy - halfH + 3, 2, 2);
    ctx.fillRect(gx + 3 + charge, gy - halfH + 3, 2, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(gx - 3 + charge, gy - halfH + 3, 1, 1);
    ctx.fillRect(gx + 4 + charge, gy - halfH + 3, 1, 1);
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(gx - halfW + 2 + charge, gy + halfH, 4, 4);
    ctx.fillRect(gx + halfW - 6 + charge, gy + halfH, 4, 4);
  }

  // ── 获取链目标鬼 (同套牛doLasso: 按距离中央排序) ──
  function getTargets(count) {
    var visible = [];
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].x > -10 && queue[i].x < W + 10) {
        visible.push(queue[i]);
      }
    }
    visible.sort(function(a, b) { return M.abs(a.x - W / 2) - M.abs(b.x - W / 2); });
    return visible.slice(0, M.min(count, visible.length));
  }

  // ── 是否所有鬼都在屏幕内 (同套牛allIn检测) ──
  function allVisible() {
    if (queue.length === 0) return true;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].x > W + 10) return false;
    }
    return true;
  }

  // ── 暂停/恢复: 套中鬼时暂停, 新回合恢复 ──
  function pause() { paused = true; }
  function resume() { paused = false; }
  function isPaused() { return paused; }

  return {
    initRound: initRound,
    update: update,
    draw: draw,
    getTargets: getTargets,
    allVisible: allVisible,
    pause: pause,
    resume: resume,
    isPaused: isPaused,
    getQueue: function() { return queue; }
  };
})();
