/* mining.js — 打工/黄金矿工
 * 依赖：CONFIG, State, Renderer, Audio
 * 暴露：Mining (全局) */

var Mining = (function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var MINING_CFG = CONFIG.MINING;

  // ── 钩子状态 ──
  var HOOK = { IDLE:0, SHOOTING:1, RETRACTING_WITH:2, RETRACTING_EMPTY:3 };
  var hookState = HOOK.IDLE;
  var hookAngle = 0;     // 当前摆动角度
  var hookLength = 0;     // 钩子伸出长度
  var hookMaxLength = H * 0.6;
  var hookX = W/2, hookY = 80;  // 钩子原点
  var hookTipX = 0, hookTipY = 0; // 钩子头位置
  var hookDir = 1;  // 摆动方向
  var hookSwingT = 0;

  // ── 铜钱 ──
  var coins = [];
  var grabbedCoin = null;

  // ── 计时 ──
  var timer = 0;
  var coinCount = 0;
  var active = false;

  function start() {
    active = true;
    hookState = HOOK.IDLE;
    hookAngle = 0;
    hookLength = 0;
    hookSwingT = 0;
    timer = MINING_CFG.duration;
    coinCount = 0;
    grabbedCoin = null;
    generateCoins();
  }

  function generateCoins() {
    coins = [];
    var count = MINING_CFG.coinMin + Math.floor(Math.random() * (MINING_CFG.coinMax - MINING_CFG.coinMin + 1));
    for (var i = 0; i < count; i++) {
      var isBig = Math.random() < MINING_CFG.bigCoinChance;
      coins.push({
        x: 40 + Math.random() * (W - 80),
        y: 150 + Math.random() * (H - 250),
        size: isBig ? 20 : 12,
        value: isBig ? 3 : 1,
        rotation: Math.random() * M.PI * 2,
        grabbed: false
      });
    }
  }

  function update(dt) {
    if (!active) return;

    // 倒计时
    timer -= dt;
    if (timer <= 0) {
      endMining();
      return;
    }

    switch(hookState) {
      case HOOK.IDLE:
        // 摆动
        hookSwingT += dt;
        hookAngle = Math.sin(hookSwingT * M.PI / MINING_CFG.hookPeriod) * MINING_CFG.hookSwing;
        break;

      case HOOK.SHOOTING:
        hookLength += MINING_CFG.shootSpeed * dt;
        // 计算钩头位置
        hookTipX = hookX + Math.sin(hookAngle) * hookLength;
        hookTipY = hookY + Math.cos(hookAngle) * hookLength;
        // 碰撞检测
        for (var i = 0; i < coins.length; i++) {
          var c = coins[i];
          if (c.grabbed) continue;
          var dx = hookTipX - c.x, dy = hookTipY - c.y;
          if (Math.sqrt(dx*dx + dy*dy) < c.size + 5) {
            hookState = HOOK.RETRACTING_WITH;
            grabbedCoin = c;
            c.grabbed = true;
            Audio.play('coin');
            break;
          }
        }
        // 到达最大距离
        if (hookLength >= hookMaxLength) {
          hookState = HOOK.RETRACTING_EMPTY;
        }
        break;

      case HOOK.RETRACTING_WITH:
        hookLength -= MINING_CFG.retractWithSpeed * dt;
        if (grabbedCoin) {
          grabbedCoin.x = hookX + Math.sin(hookAngle) * hookLength;
          grabbedCoin.y = hookY + Math.cos(hookAngle) * hookLength;
        }
        if (hookLength <= 0) {
          hookLength = 0;
          hookState = HOOK.IDLE;
          if (grabbedCoin) {
            coinCount += grabbedCoin.value;
            grabbedCoin = null;
          }
        }
        break;

      case HOOK.RETRACTING_EMPTY:
        hookLength -= MINING_CFG.retractSpeed * dt;
        if (hookLength <= 0) {
          hookLength = 0;
          hookState = HOOK.IDLE;
        }
        break;
    }
  }

  function onTap(tx, ty) {
    if (!active) return;
    if (hookState === HOOK.IDLE) {
      hookState = HOOK.SHOOTING;
      hookLength = 10;
      Audio.play('chain');
    }
  }

  function endMining() {
    active = false;
    // 固定收入(由好感等级决定)
    var income = State.getMiningIncome();
    State.set('coins', State.get('coins') + income);
    Renderer.spawnFloatingText(W/2, H/2, '+' + income + ' 铜钱', CONFIG.CO.COPPER);
    State.changeStage('IDLE');  // ★ 回到IDLE，商店是独立入口
  }

  function draw(ctx, t) {
    if (!active) return;

    // 背景
    ctx.fillStyle = '#0D0D1A';
    ctx.fillRect(0, 0, W, H);

    // 钟馗/船(顶部)
    ctx.fillStyle = CONFIG.CO.CHAIN;
    ctx.fillRect(W/2 - 30, 40, 60, 20);
    ctx.fillStyle = CONFIG.CO.BONE;
    ctx.fillRect(W/2 - 3, 30, 6, 14);

    // 钩绳
    hookTipX = hookX + Math.sin(hookAngle) * hookLength;
    hookTipY = hookY + Math.cos(hookAngle) * hookLength;
    ctx.strokeStyle = CONFIG.CO.CHAIN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hookX, hookY);
    ctx.lineTo(hookTipX, hookTipY);
    ctx.stroke();

    // 钩头
    ctx.fillStyle = CONFIG.CO.CHAIN_GLOW;
    ctx.fillRect(hookTipX - 4, hookTipY - 4, 8, 8);

    // 铜钱
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (c.grabbed && hookState === HOOK.RETRACTING_WITH) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillStyle = CONFIG.CO.COPPER;
      ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size);
      // 方孔
      ctx.fillStyle = CONFIG.CO.VOID;
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }

    // HUD
    ctx.font = CONFIG.FS.M + 'px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = CONFIG.CO.BONE;
    ctx.fillText('时间: ' + Math.ceil(timer) + 's', 10, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = CONFIG.CO.COPPER;
    ctx.fillText('已抓: ' + coinCount, W - 10, 30);
  }

  return {
    start:start, update:update, onTap:onTap, draw:draw,
    isActive:function(){return active;}
  };
})();
