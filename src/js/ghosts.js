/* ghosts.js — 鬼怪系统：鬼队列(迁移套牛牛群循环机制)
 * 核心逻辑:
 *   1. 5种鬼固定循环出现(cycle打乱后无限重复)
 *   2. 全部鬼匀速从右到左移动
 *   3. 出左界后回收到队列末尾，类型按cycle分配
 *   4. 链套向最接近画面中央的鬼
 *   5. catchP是链套住后的被抓概率，不是出现概率
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

  // ── 更新鬼队列 (同套牛update RUNNING) ──
  function update(dt) {
    if (queue.length === 0) return;

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

  // ── 渲染鬼队列 (同套牛sRun绘制牛) ──
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

      // 身体色块
      ctx.fillStyle = ghost.color;
      ctx.fillRect(gx - M.floor(w / 2), gy - M.floor(h / 2), w, h);

      // 眼睛
      ctx.fillStyle = '#FFF';
      ctx.fillRect(gx - M.floor(w * 0.2), gy - M.floor(h * 0.15), 3, 3);
      ctx.fillRect(gx + M.floor(w * 0.1), gy - M.floor(h * 0.15), 3, 3);

      // 名字
      ctx.font = CONFIG.FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ghost.color;
      ctx.fillText(ghost.name, gx, gy - M.floor(h / 2) - 6);

      // 赔率
      ctx.fillStyle = CONFIG.CO.COPPER;
      ctx.fillText('x' + g.odds, gx, gy + M.floor(h / 2) + 14);
    }
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

  return {
    initRound: initRound,
    update: update,
    draw: draw,
    getTargets: getTargets,
    allVisible: allVisible
  };
})();
