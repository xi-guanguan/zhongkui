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
    if (!active) return;
    active = false;
    // ★ 按完成进度给比例工资
    var elapsed = MINING_CFG.duration - timer;
    var progress = M.min(1, elapsed / MINING_CFG.duration);
    var fullIncome = State.getMiningIncome();
    // 至少10%, 最多100%, 中途退出按进度比例
    var income = M.max(1, M.ceil(fullIncome * M.max(0.1, progress)));
    State.set('coins', State.get('coins') + income);
    Renderer.spawnFloatingText(W/2, H/2, '+' + income + ' 铜钱', CONFIG.CO.COPPER);
    State.set('shopOpen', true);
    State.changeStage('IDLE');
    if (typeof ZhongKui !== 'undefined') ZhongKui.updateDOM();
  }

  function draw(ctx, t) {
    if (!active) return;
    var M = Math;
    var CO = CONFIG.CO;

    // ── 1. 阴河背景 ──
    var waterGrad = ctx.createLinearGradient(0, 0, 0, H);
    waterGrad.addColorStop(0, '#0D1A1A');
    waterGrad.addColorStop(0.4, '#0D0D1A');
    waterGrad.addColorStop(1, '#1A0D1A');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, W, H);

    // ── 2. 水面波纹(多层视差) ──
    ctx.strokeStyle = 'rgba(57,255,20,0.08)';
    ctx.lineWidth = 1;
    for (var wli = 0; wli < 5; wli++) {
      var wly = 100 + wli * 70;
      var wlSpeed = 0.5 + wli * 0.3;
      var wlAmp = 3 + wli;
      ctx.beginPath();
      for (var wx = 0; wx <= W; wx += 8) {
        var wly2 = wly + M.sin(wx * 0.05 + t * wlSpeed + wli) * wlAmp;
        if (wx === 0) ctx.moveTo(wx, wly2);
        else ctx.lineTo(wx, wly2);
      }
      ctx.stroke();
    }

    // ── 3. 水底古币(远景装饰, 模糊小点) ──
    ctx.globalAlpha = 0.15;
    for (var di = 0; di < 8; di++) {
      var dcx = (di * 47 + t * 3) % (W + 20) - 10;
      var dcy = 200 + di * 35;
      ctx.fillStyle = CO.COPPER;
      ctx.beginPath();
      ctx.arc(dcx, dcy, 3, 0, M.PI * 2);
      ctx.fill();
      ctx.fillStyle = CO.VOID;
      ctx.fillRect(dcx - 1, dcy - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // ── 4. 木船(像素风) ──
    var boatY = 55;
    // 船体
    ctx.fillStyle = '#4A3728';
    ctx.fillRect(W/2 - 40, boatY, 80, 16);
    // 船头船尾翘起
    ctx.beginPath();
    ctx.moveTo(W/2 - 40, boatY);
    ctx.lineTo(W/2 - 48, boatY - 6);
    ctx.lineTo(W/2 - 40, boatY + 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W/2 + 40, boatY);
    ctx.lineTo(W/2 + 48, boatY - 6);
    ctx.lineTo(W/2 + 40, boatY + 4);
    ctx.fill();
    // 船舷高光
    ctx.fillStyle = '#6B5344';
    ctx.fillRect(W/2 - 38, boatY + 2, 76, 3);
    // 船舱阴影
    ctx.fillStyle = '#2A1F16';
    ctx.fillRect(W/2 - 30, boatY - 6, 60, 8);

    // ── 5. 船上钟馗(简化像素8x14) ──
    var zkX = W/2, zkY = boatY - 14;
    // 身体(红袍)
    ctx.fillStyle = CO.BLOOD;
    ctx.fillRect(zkX - 4, zkY, 8, 10);
    // 头
    ctx.fillStyle = CO.BONE;
    ctx.fillRect(zkX - 3, zkY - 6, 6, 6);
    // 帽子
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(zkX - 4, zkY - 9, 8, 3);
    ctx.fillStyle = CO.COPPER;
    ctx.fillRect(zkX - 1, zkY - 11, 2, 2);
    // 眼
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(zkX - 2, zkY - 4, 1, 1);
    ctx.fillRect(zkX + 1, zkY - 4, 1, 1);
    // 手持钓竿
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(zkX + 4, zkY + 4);
    ctx.lineTo(zkX + 10, zkY - 2);
    ctx.stroke();
    // 竿头(绳起点)
    var ropeOriginX = zkX + 10, ropeOriginY = zkY - 2;

    // ── 6. 钩子方向指示+绳 ──
    var showLength = hookLength;
    if (hookState === HOOK.IDLE) showLength = 50;

    hookTipX = ropeOriginX + M.sin(hookAngle) * showLength;
    hookTipY = ropeOriginY + M.cos(hookAngle) * showLength;

    // IDLE时画摆动弧线
    if (hookState === HOOK.IDLE) {
      ctx.strokeStyle = 'rgba(255,215,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ropeOriginX, ropeOriginY, 50, M.PI/2 - MINING_CFG.hookSwing, M.PI/2 + MINING_CFG.hookSwing);
      ctx.stroke();
    }

    // 绳(链节纹理)
    ctx.strokeStyle = hookState === HOOK.IDLE ? CO.COPPER_SHINE : CO.CHAIN;
    ctx.lineWidth = hookState === HOOK.IDLE ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(ropeOriginX, ropeOriginY);
    ctx.lineTo(hookTipX, hookTipY);
    ctx.stroke();

    // 钩头(古铜钱形状)
    ctx.fillStyle = hookState === HOOK.IDLE ? CO.COPPER_SHINE : CO.CHAIN_GLOW;
    var dx = hookTipX - ropeOriginX, dy = hookTipY - ropeOriginY;
    var len = M.sqrt(dx*dx + dy*dy);
    if (len > 0) {
      var nx = dx/len, ny = dy/len;
      var arrowSize = hookState === HOOK.IDLE ? 10 : 6;
      ctx.beginPath();
      ctx.moveTo(hookTipX + nx*arrowSize, hookTipY + ny*arrowSize);
      ctx.lineTo(hookTipX + (-ny)*arrowSize*0.5, hookTipY + nx*arrowSize*0.5);
      ctx.lineTo(hookTipX - nx*arrowSize*0.3, hookTipY - ny*arrowSize*0.3);
      ctx.lineTo(hookTipX - (-ny)*arrowSize*0.5, hookTipY - nx*arrowSize*0.5);
      ctx.closePath();
      ctx.fill();
    }

    // ── 7. 圆形古币 ──
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (c.grabbed && hookState === HOOK.RETRACTING_WITH) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      // 外圆
      ctx.fillStyle = CO.COPPER;
      ctx.beginPath();
      ctx.arc(0, 0, c.size/2, 0, M.PI*2);
      ctx.fill();
      // 外圆边框
      ctx.strokeStyle = '#A0522D';
      ctx.lineWidth = 1;
      ctx.stroke();
      // 内环
      ctx.strokeStyle = '#8B6914';
      ctx.beginPath();
      ctx.arc(0, 0, c.size/2 - 2, 0, M.PI*2);
      ctx.stroke();
      // 方孔
      ctx.fillStyle = CO.VOID;
      ctx.fillRect(-c.size/5, -c.size/5, c.size/2.5, c.size/2.5);
      // 文字(简化)
      ctx.fillStyle = '#A0522D';
      ctx.font = (c.size*0.4) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.value === 3 ? '三' : '一', 0, c.size*0.15);
      ctx.restore();
    }

    // ── 8. 迷雾前景 ──
    ctx.fillStyle = 'rgba(13,13,26,0.25)';
    ctx.fillRect(0, H - 80, W, 80);

    // ── 9. HUD ──
    ctx.font = CONFIG.FS.M + 'px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = CO.BONE;
    ctx.fillText('时间: ' + M.ceil(timer) + 's', 10, 25);
    ctx.textAlign = 'right';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('已捞: ' + coinCount, W - 10, 25);

    // ── 10. 底部提示 ──
    if (hookState === HOOK.IDLE) {
      ctx.globalAlpha = 0.5 + M.sin(t * 4) * 0.4;
      ctx.font = CONFIG.FS.M + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillText('点击射钩捞币!', W/2, H - 20);
      ctx.globalAlpha = 1;
    }
  }

  return {
    start:start, update:update, onTap:onTap, draw:draw, endMining:endMining,
    isActive:function(){return active;}
  };
})();
