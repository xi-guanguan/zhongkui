/* ghosts.js — 鬼怪系统：鬼队列(迁移套牛牛群循环机制)
 * 核心逻辑:
 *   1. 5种鬼固定循环出现(cycle打乱后无限重复)，不是按概率随机
 *   2. 全部鬼匀速从右到左移动
 *   3. 出左界后回收到队列末尾，类型按cycle分配
 *   4. 链套向最接近画面中央的鬼
 *   5. catchP是链套住后的被抓概率，不是出现概率
 * 依赖：CONFIG, State, Renderer
 * 暴露：Ghosts (全局) */

var Ghosts = (function() {
  var M = Math;
  var W = CONFIG.W;
  var LY = CONFIG.LY;
  var CO = CONFIG.CO;

  // ── 队列参数 (迁移套牛LY.COW) ──
  var GHOST_Y = LY.ARENA_Y + LY.ARENA_H / 2;  // 鬼在竞技场中央水平线
  var VISIBLE = 5;          // 同屏可见鬼数
  var SPACING = M.floor(W / VISIBLE);  // 鬼间距 (同套牛64px)
  var SPEED = 40;            // 匀速移动 px/s (同套牛)
  var MAX_HW = 16;           // 鬼最大半宽

  // ── 鬼队列 (同套牛GS.cows) ──
  var queue = [];            // [{type, x, y, speed, odds}]
  var cycle = [];            // 类型循环序列 [0,1,2,3,4]打乱
  var cycleIdx = 0;          // cycle分配指针

  // ── 打乱5种鬼的循环序列 (同套牛cowCycle) ──
  function shuffleCycle() {
    cycle = [0, 1, 2, 3, 4].sort(function() { return M.random() - 0.5; });
    cycleIdx = 0;
  }

  // ── 从cycle取下一个类型索引 ──
  function nextType() {
    var ti = cycle[cycleIdx % 5];
    cycleIdx++;
    return ti;
  }

  // ── 初始化本回合鬼队列 (同套牛doStart) ──
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
    // 全部鬼匀速向左移动
    for (var i = 0; i < queue.length; i++) {
      queue[i].x -= queue[i].speed * dt;
    }

    // 连续队列: 鬼完全出左界后回收到队列末尾
    // 回收时类型按cycle序列分配，保证1234512345...循环
    for (var i = 0; i < queue.length; i++) {
      var g = queue[i];
      if (g.x < -MAX_HW * 2) {
        // 找当前最右鬼的位置，紧接其后+间距 (同套牛)
        var maxR = -999;
        for (var j = 0; j < queue.length; j++) {
          if (queue[j].x > maxR) maxR = queue[j].x;
        }
        g.x = maxR + SPACING;
        // 类型按cycle序列循环 (同套牛)
        g.type = nextType();
        var gt = CONFIG.GT[g.type];
        g.odds = gt.oddsMin + M.floor(M.random() * (gt.oddsMax - gt.oddsMin + 1));
      }
    }
  }

  // ── 渲染鬼队列 (同套牛sRun绘制牛) ──
  function draw(ctx, t) {
    // x大的先画(远处)，x小的后画(近处覆盖)
    var sorted = queue.slice().sort(function(a, b) { return b.x - a.x; });

    for (var i = 0; i < sorted.length; i++) {
      var g = sorted[i];
      // 只绘制屏幕可见范围内的鬼
      if (g.x < -MAX_HW * 2 || g.x > W + MAX_HW * 2) continue;

      var ghost = CONFIG.GT[g.type];
      var w = ghost.size[0], h = ghost.size[1];
      var gx = M.floor(g.x), gy = M.floor(g.y);

      // 身体色块
      ctx.fillStyle = ghost.color;
      ctx.fillRect(gx - w / 2, gy - h / 2, w, h);

      // 眼睛
      ctx.fillStyle = '#FFF';
      ctx.fillRect(gx - M.floor(w * 0.2), gy - M.floor(h * 0.15), 3, 3);
      ctx.fillRect(gx + M.floor(w * 0.1), gy - M.floor(h * 0.15), 3, 3);

      // 名字
      ctx.font = CONFIG.FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ghost.color;
      ctx.fillText(ghost.name, gx, gy - h / 2 - 6);

      // 赔率
      ctx.fillStyle = CO.COPPER;
      ctx.fillText('x' + g.odds, gx, gy + h / 2 + 14);
    }
  }

  // ── 获取链目标鬼 (同套牛doLasso: 按距离中央排序) ──
  function getTargets(count) {
    // 屏幕内所有可见鬼，按距中央排序
    var visible = [];
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].x > -10 && queue[i].x < W + 10) {
        visible.push(queue[i]);
      }
    }
    visible.sort(function(a, b) { return M.abs(a.x - W / 2) - M.abs(b.x - W / 2); });

    // 取前count个
    var targets = visible.slice(0, M.min(count, visible.length));
    return targets;
  }

  // ── 获取目标鬼位置 (链指向最近中央的鬼) ──
  function getPos() {
    var targets = getTargets(1);
    if (targets.length > 0) {
      return { x: targets[0].x, y: targets[0].y };
    }
    return { x: W / 2, y: GHOST_Y };
  }

  return {
    initRound: initRound,
    update: update,
    draw: draw,
    getTargets: getTargets,
    getPos: getPos
  };
})();
