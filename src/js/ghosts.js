/* ghosts.js — 鬼怪系统：类型、AI行为、动画
 * 依赖：CONFIG, State, Renderer
 * 暴露：Ghosts (全局) */

var Ghosts = (function() {
  var M = Math;
  var W = CONFIG.W;

  // ── 鬼运行时状态 ──
  var ghostX = W/2;
  var ghostY = 300;
  var ghostSeed = 0;
  var ghostTimer = 0;

  // ── 初始化本回合鬼 ──
  function initRound() {
    ghostX = W/2;
    ghostY = 300;
    ghostSeed = Math.random() * 100;
    ghostTimer = 0;
  }

  // ── 更新鬼位置(性格行为) ──
  function update(dt) {
    var ghost = State.currentGhost();
    ghostTimer += dt;

    var arenaLeft = 60, arenaRight = W - 60;
    var arenaTop = 200, arenaBottom = 600;

    switch(ghost.personality) {
      case 'timid': // 牛头：小幅抖动
        ghostX = W/2 + Math.sin(ghostTimer*3 + ghostSeed) * 15;
        ghostY = 300 + Math.sin(ghostTimer*2 + ghostSeed*2) * 10;
        break;
      case 'normal': // 马面：匀速漂浮
        ghostX = W/2 + Math.sin(ghostTimer*1.5 + ghostSeed) * 80;
        ghostY = 350 + Math.sin(ghostTimer*1 + ghostSeed*2) * 40;
        break;
      case 'crazy': // 黑无常：高速乱窜
        ghostX = W/2 + Math.sin(ghostTimer*5 + ghostSeed) * 130;
        ghostY = 350 + Math.cos(ghostTimer*4 + ghostSeed*3) * 120;
        break;
      case 'cool': // 白无常：极缓飘动+偶尔闪现
        ghostX = W/2 + Math.sin(ghostTimer*0.5 + ghostSeed) * 100;
        ghostY = 350 + Math.sin(ghostTimer*0.3 + ghostSeed*2) * 50;
        break;
      case 'rage': // 刑天：直线冲撞
        ghostX = W/2 + Math.sin(ghostTimer*2 + ghostSeed) * 150;
        ghostY = 300 + Math.abs(Math.sin(ghostTimer*3 + ghostSeed)) * 200;
        break;
    }

    // 边界钳制
    ghostX = M.max(arenaLeft, M.min(arenaRight, ghostX));
    ghostY = M.max(arenaTop, M.min(arenaBottom, ghostY));
  }

  // ── 渲染鬼(色块占位) ──
  function draw(ctx, t) {
    var ghost = State.currentGhost();
    var w = ghost.size[0], h = ghost.size[1];

    // 呼吸光环
    ctx.shadowColor = ghost.glow;
    ctx.shadowBlur = 4 + Math.sin(t*2 + ghostSeed)*3;
    ctx.fillStyle = ghost.color;
    ctx.fillRect(ghostX - w/2, ghostY - h/2, w, h);
    ctx.shadowBlur = 0;

    // 眼睛
    ctx.fillStyle = '#FFF';
    ctx.fillRect(ghostX - w*0.2, ghostY - h*0.15, 3, 3);
    ctx.fillRect(ghostX + w*0.1, ghostY - h*0.15, 3, 3);

    // 名字
    ctx.font = CONFIG.FS.S + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = ghost.color;
    ctx.fillText(ghost.name, ghostX, ghostY - h/2 - 8);

    // 赔率范围
    ctx.fillStyle = CONFIG.CO.COPPER;
    ctx.fillText('x' + ghost.oddsMin + '~' + ghost.oddsMax, ghostX, ghostY + h/2 + 16);
  }

  function getPos() { return {x:ghostX, y:ghostY}; }

  return {
    initRound:initRound, update:update, draw:draw, getPos:getPos
  };
})();
