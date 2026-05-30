/* ghosts.js — 鬼怪系统：鬼队列(从右到左穿过屏幕) + AI行为
 * 类似套牛牛群循环：多只鬼在竞技场内从右向左移动，
 * 到达左边后从右边重新出现，形成连续流动的鬼群
 * 依赖：CONFIG, State, Renderer
 * 暴露：Ghosts (全局) */

var Ghosts = (function() {
  var M = Math;
  var W = CONFIG.W;
  var LY = CONFIG.LY;
  var CO_GLOW_BORDER = '#FFD700';

  // ── 队列参数 ──
  var QUEUE_SIZE = 5;           // 队列中同时可见的鬼数
  var BASE_SPEED = 30;          // 基础移动速度 px/s
  var SPACING = 70;             // 鬼之间水平间距
  var ARENA_TOP = LY.ARENA_Y + 20;
  var ARENA_BOT = LY.ARENA_Y + LY.ARENA_H - 20;

  // ── 鬼队列 ──
  var queue = [];   // [{type, x, y, speed, wobbleSeed, wobbleAmp}]
  var targetGhost = null; // 当前目标鬼(链指向的)

  // ── 随机选鬼类型(按概率) ──
  function rollGhostType() {
    var r = Math.random();
    var cum = 0;
    var gt = CONFIG.GT;
    for (var i = 0; i < gt.length; i++) {
      cum += gt[i].catchP;
      if (r < cum) return gt[i];
    }
    return gt[0]; // 保底牛头
  }

  // ── 创建一只鬼 ──
  function createGhost(x) {
    var type = rollGhostType();
    var speedVar = 0.6 + Math.random() * 0.8; // 速度波动0.6~1.4
    var yCenter = (ARENA_TOP + ARENA_BOT) / 2;
    var yRange = (ARENA_BOT - ARENA_TOP) * 0.3;
    return {
      type: type,
      x: x,
      y: yCenter + (Math.random() - 0.5) * yRange,
      speed: BASE_SPEED * speedVar,
      wobbleSeed: Math.random() * 100,
      wobbleAmpY: 5 + Math.random() * 15,  // 垂直抖动幅度
      wobbleAmpX: 2 + Math.random() * 5,   // 水平微调
      wobbleFreqY: 1 + Math.random() * 2,
      wobbleFreqX: 0.5 + Math.random() * 1.5,
      timer: 0,
      isTarget: false
    };
  }

  // ── 初始化本回合鬼队列 ──
  function initRound() {
    queue = [];
    // 均匀分布在竞技场内(含右侧屏幕外)
    for (var i = 0; i < QUEUE_SIZE; i++) {
      var x = W + i * SPACING;
      queue.push(createGhost(x));
    }
    // 标记目标鬼(最接近中央的那只)
    pickTarget();
  }

  // ── 选目标鬼: 最接近画面中央的 ──
  function pickTarget() {
    var bestDist = 99999;
    targetGhost = queue[0];
    for (var i = 0; i < queue.length; i++) {
      queue[i].isTarget = false;
      var dist = M.abs(queue[i].x - W / 2);
      if (dist < bestDist) {
        bestDist = dist;
        targetGhost = queue[i];
      }
    }
    if (targetGhost) targetGhost.isTarget = true;
  }

  // ── 更新鬼队列 ──
  function update(dt) {
    for (var i = 0; i < queue.length; i++) {
      var g = queue[i];
      g.timer += dt;

      // 基础从右到左移动
      g.x -= g.speed * dt;

      // 垂直抖动(按性格调整幅度)
      var wobbleMul = 1;
      switch(g.type.personality) {
        case 'timid':  wobbleMul = 0.5; break;
        case 'normal': wobbleMul = 1.0; break;
        case 'crazy':  wobbleMul = 2.0; break;
        case 'cool':   wobbleMul = 0.3; break;
        case 'rage':   wobbleMul = 1.5; break;
      }
      var wobbleY = Math.sin(g.timer * g.wobbleFreqY + g.wobbleSeed) * g.wobbleAmpY * wobbleMul;
      var wobbleX = Math.sin(g.timer * g.wobbleFreqX + g.wobbleSeed * 2) * g.wobbleAmpX * wobbleMul;
      g.x += wobbleX * dt * 10;
      g.y += wobbleY * dt;

      // 垂直钳制
      g.y = M.max(ARENA_TOP + g.type.size[1] / 2, M.min(ARENA_BOT - g.type.size[1] / 2, g.y));

      // 出左边后从右边重新进入(循环)
      if (g.x < -40) {
        // 找队列中最右边的鬼，在其右侧SPACING处重生
        var maxX = 0;
        for (var j = 0; j < queue.length; j++) {
          if (queue[j].x > maxX) maxX = queue[j].x;
        }
        g.x = M.max(W + 20, maxX + SPACING);
        // 重新随机类型和速度
        g.type = rollGhostType();
        g.speed = BASE_SPEED * (0.6 + Math.random() * 0.8);
        g.wobbleSeed = Math.random() * 100;
        g.y = (ARENA_TOP + ARENA_BOT) / 2 + (Math.random() - 0.5) * (ARENA_BOT - ARENA_TOP) * 0.3;
        g.timer = 0;
      }
    }

    // 更新目标鬼
    pickTarget();
  }

  // ── 渲染鬼队列 ──
  function draw(ctx, t) {
    for (var i = 0; i < queue.length; i++) {
      var g = queue[i];
      var ghost = g.type;
      var w = ghost.size[0], h = ghost.size[1];

      // 只画屏幕内的鬼
      if (g.x < -50 || g.x > W + 50) continue;

      ctx.save();

      // 目标鬼: 呼吸光环 + 高亮轮廓
      if (g.isTarget) {
        ctx.shadowColor = ghost.glow;
        ctx.shadowBlur = 6 + Math.sin(t * 3 + g.wobbleSeed) * 4;
        // 高亮边框
        ctx.strokeStyle = CO_GLOW_BORDER;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(g.x - w/2 - 2, g.y - h/2 - 2, w + 4, h + 4);
      }

      // 身体色块
      ctx.fillStyle = ghost.color;
      ctx.fillRect(g.x - w/2, g.y - h/2, w, h);
      ctx.shadowBlur = 0;

      // 眼睛
      ctx.fillStyle = '#FFF';
      ctx.fillRect(M.floor(g.x - w * 0.2), M.floor(g.y - h * 0.15), 3, 3);
      ctx.fillRect(M.floor(g.x + w * 0.1), M.floor(g.y - h * 0.15), 3, 3);

      // 名字
      ctx.font = CONFIG.FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ghost.color;
      ctx.fillText(ghost.name, M.floor(g.x), M.floor(g.y - h/2 - 6));

      // 赔率范围
      ctx.fillStyle = CONFIG.CO.COPPER;
      ctx.fillText('x' + ghost.oddsMin + '~' + ghost.oddsMax, M.floor(g.x), M.floor(g.y + h/2 + 14));

      // 目标鬼标记: 闪烁的"★"
      if (g.isTarget) {
        ctx.fillStyle = CONFIG.CO.COPPER_SHINE;
        ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.5;
        ctx.fillText('★', M.floor(g.x), M.floor(g.y - h/2 - 18));
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }
  }

  // ── 获取目标鬼位置(链指向) ──
  function getPos() {
    if (targetGhost) return {x: targetGhost.x, y: targetGhost.y};
    return {x: W/2, y: (ARENA_TOP + ARENA_BOT) / 2};
  }

  // ── 获取目标鬼类型 ──
  function getTargetType() {
    if (targetGhost) return targetGhost.type;
    return CONFIG.GT[0];
  }

  return {
    initRound: initRound,
    update: update,
    draw: draw,
    getPos: getPos,
    getTargetType: getTargetType
  };
})();
