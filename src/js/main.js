/* main.js — 主循环 + 渲染 + 游戏逻辑
 * Bug#1: SETTLE stageTimer递增 + tw=0跳过结算
 * Bug#2: Cookie存档 + 100币开局
 * Bug#7: 孟婆UI缩小商品+放大看板娘
 * Bug#9: 拉扯钓鱼节奏动画(拉远-拉近振荡)
 * 依赖：所有模块 */

(function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var CO = CONFIG.CO, LY = CONFIG.LY, FS = CONFIG.FS;
  var canvas, ctx;
  var lastTime = 0, totalTime = 0;
  var _mengpoImg = null;
  var _currentBGM = null;

  function _loadMengpoImg() {
    var img = new Image();
    img.onload = function() { _mengpoImg = img; };
    img.onerror = function() { _mengpoImg = null; };
    img.src = 'assets/mengpo.png';
  }

  function init() {
    canvas = document.getElementById('gc');
    ctx = canvas.getContext('2d');
    Renderer.init(canvas);
    Audio.init();
    loadSave();
    initBackground();
    _loadMengpoImg();
    ZhongKui.init();
    State.changeStage('IDLE');
    // 启动BGM(需用户交互后才可播放，这里先准备)
    setTimeout(function() { Audio.playBGM('idle', 2.0); }, 100);
    console.log('[钟馗 v0.8] 初始化完成', W, 'x', H, '铜钱:', State.get('coins'));
    console.log('v0.8更新: 钟馗重绘V2/5鬼重绘V2/链节纹理+辉光/BigWin全屏冲击/结算飞币/Combo标签');
  }

  function loop(timestamp) {
    requestAnimationFrame(loop);
    var dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.1) dt = 0.016;
    totalTime += dt;
    State.set('time', totalTime);
    update(dt);
    render(dt);
  }

  function update(dt) {
    var stage = State.get('stage');

    // 设置面板打开时暂停一切
    if (typeof ZhongKui !== 'undefined' && ZhongKui.isSettingsOpen()) return;

    Renderer.updateShake(dt);
    Renderer.updateParticles(dt);
    Renderer.updateFloatingTexts(dt);
    Renderer.updateFlash(dt);
    Renderer.updateCoinFlies(dt);

    var lineTimer = State.get('mengpoLineTimer');
    if (lineTimer > 0) State.set('mengpoLineTimer', lineTimer - dt);

    if (State.get('shopOpen') && stage !== 'MINING') return;

    switch(stage) {
      case 'IDLE':
        Ghosts.update(dt);
        break;

      case 'RUNNING':
        Ghosts.update(dt);
        var rt = State.get('stageTimer') + dt;
        State.set('stageTimer', rt);
        if (rt >= 20) doLasso();
        break;

      case 'LASSO':
        var st = State.get('stageTimer') + dt;
        State.set('stageTimer', st);
        Ghosts.update(dt);
        if (st >= 0.5) {
          Ghosts.pause();
          var chains = State.get('chains');
          if (chains) {
            for (var i = 0; i < chains.length; i++) {
              var tg = chains[i].targetGhost;
              if (tg) {
                chains[i].originX = tg.x;
                chains[i].originY = tg.y;
                chains[i].renderX = tg.x;
                chains[i].renderY = tg.y;
              }
            }
          }
          State.changeStage('HITTING');
          State.set('hitCount', 0);
          State.set('hitTimer', 0);
        }
        break;

      case 'HITTING':
        var hitTimer = State.get('hitTimer') + dt;
        State.set('hitTimer', hitTimer);
        updatePullPositions();
        if (hitTimer >= State.get('hitMax')) doCalc();
        break;

      case 'RESULT':
        var resT = State.get('stageTimer') + dt;
        State.set('stageTimer', resT);
        if (resT >= 3.5) {
          // ★ Bug#1: tw=0时跳过SETTLE直接回IDLE
          var results = State.get('roundResult') || [];
          var tw = 0;
          for (var i = 0; i < results.length; i++) { if (results[i].success) tw += results[i].odds; }

          if (tw <= 0) {
            // 没套中: 直接回IDLE, 不进SETTLE
            State.changeStage('IDLE');
            State.set('roundResult', null);
            State.set('chains', []);
            State.set('totalWin', 0);
            State.set('coinsInserted', 0);
            Ghosts.resume();
            saveGame();
            ZhongKui.exitCoinMode();
            ZhongKui.updateDOM();
          } else {
            State.changeStage('SETTLE');
            State.set('settleCoinsPaid', 0);
            State.set('totalWin', tw);
          }
        }
        break;

      case 'SETTLE':
        // ★ Bug#1: 递增stageTimer(之前缺失导致卡死!)
        var stlT = State.get('stageTimer') + dt;
        State.set('stageTimer', stlT);
        var tw = State.get('totalWin');
        var cp = M.min(tw, M.floor(stlT * 10));
        State.set('settleCoinsPaid', cp);
        // 自动推进: 币数数完+最小0.8s
        if (stlT > 0.8 && cp >= tw) {
          doSettle();
        }
        break;

      case 'MINING':
        Mining.update(dt);
        break;
    }
  }

  // ★ Bug#9: 钓鱼节奏动画(拉远-拉近振荡, 不拉到身旁)
  function updatePullPositions() {
    var chains = State.get('chains');
    if (!chains) return;
    var centerX = W / 2;
    var zhongkuiY = LY.ZHONGKUI_Y;
    var pr = M.min(State.get('hitTimer') / State.get('hitMax'), 1);

    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      // 基础进度: 只靠拢到35%位置(不拉到身旁)
      var basePr = pr * 0.35;
      // 振荡: 正弦波模拟拉远-拉近节奏
      var rhythmAmp = 0.1 * (1 - pr * 0.6);
      var rhythm = M.sin(pr * M.PI * 6) * rhythmAmp;
      var effectivePr = M.max(0, basePr + rhythm);

      chain.renderX = chain.originX + (centerX - chain.originX) * effectivePr;
      chain.renderY = chain.originY + (zhongkuiY - chain.originY) * effectivePr;
    }
  }

  function doLasso() {
    if (State.get('stage') !== 'RUNNING') return;
    State.changeStage('LASSO');
    Audio.play('chain');

    var roundCoins = State.get('roundCoins');
    var targets = Ghosts.getTargets(roundCoins);
    var chains = [];
    for (var i = 0; i < targets.length; i++) {
      var g = targets[i];
      chains.push({
        targetGhost: g,
        originX: g.x, originY: g.y,
        renderX: g.x, renderY: g.y,
        targetX: g.x, targetY: g.y,
        odds: g.odds, ghostType: g.type,
        caught: false, isSuper: false
      });
    }
    var buffs = State.get('buffs');
    if (buffs.special_super && chains.length > 0) chains[0].isSuper = true;
    State.set('chains', chains);
    ZhongKui.updateDOM();
  }

  function doCalc() {
    State.changeStage('RESULT');
    var chains = State.get('chains');
    var results = Physics.resolveChains(chains);
    State.set('roundResult', results.details);

    var totalWin = results.totalWin;
    if (results.anyCaught) {
      State.set('coins', State.get('coins') + totalWin);
      Renderer.spawnFloatingText(W/2, 200, '+' + totalWin + ' 铜钱', CO.COPPER_SHINE);
      Renderer.spawnParticles(W/2, 180, CO.COPPER_SHINE, 10);
      // T2.5 GameJuice: 铜钱飞入HUD
      Renderer.spawnCoinFly(W/2, 180, 20, 15);
      if (totalWin >= State.get('roundCoins') * 5) {
        Audio.play('bigwin');
        Renderer.triggerShake(10);
        Renderer.triggerFlash(CO.COPPER_SHINE, 0.4); // BIG WIN闪金
      } else {
        Audio.play('catchOk');
        Renderer.triggerFlash('#FFF', 0.15); // 普通闪白
      }
      // 鬼消散粒子
      var chains = State.get('chains');
      for (var i = 0; i < chains.length; i++) {
        var ch = chains[i];
        var ghost = CONFIG.GT[ch.ghostType];
        Renderer.spawnDissolveParticles(ch.renderX || ch.originX, ch.renderY || ch.originY, ghost.glow, 6);
      }
    } else {
      Audio.play('escape');
      Renderer.spawnFloatingText(W/2, 200, '跑了...', CO.BLOOD);
    }
    State.updateROI({spent: State.get('roundCoins'), won: totalWin});
    State.tickBuffs();
    State.set('coinsInserted', 0);
    ZhongKui.exitCoinMode();
    ZhongKui.updateDOM();
  }

  function doSettle() {
    if (State.get('stage') !== 'SETTLE') return;
    State.changeStage('IDLE');
    State.set('roundResult', null);
    State.set('chains', []);
    State.set('totalWin', 0);
    State.set('settleCoinsPaid', 0);
    State.set('coinsInserted', 0);
    Ghosts.resume();
    saveGame();
    ZhongKui.exitCoinMode();
    ZhongKui.updateDOM();
  }

  // ════════════════ 渲染 ════════════════

  function _updateBGM() {
    var stage = State.get('stage');
    var shopOpen = State.get('shopOpen');
    var target = shopOpen ? 'shop' : (stage === 'MINING' ? 'mining' : 'idle');
    if (target !== _currentBGM) {
      _currentBGM = target;
      Audio.switchBGM(target);
    }
  }

  function render(dt) {
    var stage = State.get('stage');
    var t = totalTime;
    var se = State.get('stageTimer');

    _updateBGM();

    ctx.save();
    Renderer.applyShake();

    // 设置面板(最顶层)
    if (typeof ZhongKui !== 'undefined' && ZhongKui.isSettingsOpen()) {
      drawBackground(t);
      ZhongKui.drawSettings(ctx, totalTime);
      ctx.restore();
      return;
    }

    if (State.get('shopOpen') && stage !== 'MINING') {
      drawBackground(t);
      Ghosts.draw(ctx, t);
      drawShopUI(t);
      Renderer.drawHUD();
      ctx.restore();
      return;
    }

    if (stage === 'MINING') {
      Mining.draw(ctx, t);
      Renderer.drawHUD();
      ctx.restore();
      return;
    }

    Renderer.clear();
    drawBackground(t);
    if (stage !== 'MINING') Ghosts.draw(ctx, t);
    ZhongKui.draw(ctx, t);
    Renderer.drawParticles();
    Renderer.drawCoinFlies();
    Renderer.drawFloatingTexts();

    switch(stage) {
      case 'IDLE': drawIdleUI(t); break;
      case 'RUNNING': drawRunningUI(t, se); break;
      case 'LASSO': drawLassoUI(t, M.min(se / 0.5, 1)); break;
      case 'HITTING': drawHittingUI(t); break;
      case 'RESULT': drawResultUI(t, M.min(se / 3.5, 1)); break;
      case 'SETTLE': drawSettleUI(t, se); break;
    }

    // 行囊在所有非商店阶段持续显示
    if (!State.get('shopOpen') && stage !== 'MINING') {
      drawInventory(t);
    }

    Renderer.drawHUD();
    Renderer.drawMengpoLine();
    Renderer.drawFlash();
    ctx.restore();
  }

  // ── T2.3 场景渲染: 多层视差像素背景 ──
  var _starPositions = null;
  var _mountainPath = null;
  var _buildings = null;
  var _lanterns = null;
  var _parallax = { building:0.08, star:0.15, mountain:0.25, lantern:0.4, stone:0.6 };

  function initBackground() {
    var M2 = Math;
    // 鬼火星点
    _starPositions = [];
    for (var i = 0; i < 20; i++) {
      _starPositions.push({
        x: M2.floor(M2.random() * W),
        y: M2.floor(LY.HUD_H + 10 + M2.random() * (LY.SKY_H - 20)),
        phase: M2.random() * M2.PI * 2,
        size: 1 + M2.floor(M2.random() * 2)
      });
    }
    // 黄泉山脉
    _mountainPath = new Path2D();
    _mountainPath.moveTo(0, LY.ARENA_Y);
    for (var x = 0; x <= W; x += 4) {
      _mountainPath.lineTo(x, LY.ARENA_Y - (8 + M2.sin(x * 0.04) * 6 + M2.sin(x * 0.07) * 3));
    }
    _mountainPath.lineTo(W, LY.ARENA_Y);
    _mountainPath.closePath();
    // 冥府建筑剪影(尖顶塔楼)
    _buildings = [];
    for (var i = 0; i < 6; i++) {
      _buildings.push({
        x: i * 70 + M2.floor(M2.random() * 20),
        w: 24 + M2.floor(M2.random() * 20),
        h: 30 + M2.floor(M2.random() * 25),
        type: M2.random() > 0.5 ? 'tower' : 'temple'
      });
    }
    // 灯笼
    _lanterns = [];
    for (var i = 0; i < 5; i++) {
      _lanterns.push({
        x: i * 80 + 20,
        y: LY.ARENA_Y + 20 + M2.floor(M2.random() * 40),
        phase: M2.random() * M2.PI * 2,
        color: i % 2 === 0 ? CO.LANTERN : '#FF4444'
      });
    }
  }

  function _wrapX(x, layerW) {
    return ((x % layerW) + layerW) % layerW;
  }

  function drawBackground(t) {
    // 1. 冥界天空
    var sky = ctx.createLinearGradient(0, LY.HUD_H, 0, LY.HUD_H + LY.SKY_H);
    sky.addColorStop(0, CO.VOID);
    sky.addColorStop(0.5, CO.DUSK);
    sky.addColorStop(1, CO.FOG);
    ctx.fillStyle = sky;
    ctx.fillRect(0, LY.HUD_H, W, LY.SKY_H);

    // 2. 远景冥府建筑(最慢视差)
    if (_buildings) {
      var bxOff = -t * 8 * _parallax.building;
      ctx.fillStyle = '#151025';
      for (var i = 0; i < _buildings.length; i++) {
        var b = _buildings[i];
        var bx = _wrapX(b.x + bxOff, W + 60) - 30;
        if (b.type === 'tower') {
          // 塔楼: 矩形+尖顶
          ctx.fillRect(bx, LY.ARENA_Y - b.h, b.w, b.h);
          ctx.beginPath();
          ctx.moveTo(bx - 4, LY.ARENA_Y - b.h);
          ctx.lineTo(bx + b.w / 2, LY.ARENA_Y - b.h - 12);
          ctx.lineTo(bx + b.w + 4, LY.ARENA_Y - b.h);
          ctx.fill();
          // 小窗
          ctx.fillStyle = '#2A1B3D';
          ctx.fillRect(bx + 4, LY.ARENA_Y - b.h + 6, 4, 6);
          ctx.fillRect(bx + b.w - 8, LY.ARENA_Y - b.h + 6, 4, 6);
          ctx.fillStyle = '#151025';
        } else {
          // 庙宇: 宽体+坡顶
          ctx.fillRect(bx, LY.ARENA_Y - b.h, b.w, b.h);
          ctx.beginPath();
          ctx.moveTo(bx - 6, LY.ARENA_Y - b.h);
          ctx.lineTo(bx + b.w / 2, LY.ARENA_Y - b.h - 8);
          ctx.lineTo(bx + b.w + 6, LY.ARENA_Y - b.h);
          ctx.fill();
        }
      }
    }

    // 3. 鬼火星点(视差+闪烁)
    if (_starPositions) {
      var sxOff = -t * 8 * _parallax.star;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < _starPositions.length; i++) {
        var s = _starPositions[i];
        var blink = (M.sin(t * (1 + (i % 5) * 0.4) + s.phase) + 1) * 0.5;
        var r = s.size + blink * 2;
        var drawX = _wrapX(s.x + sxOff, W);
        var grd = ctx.createRadialGradient(drawX, s.y, 0, drawX, s.y, r);
        grd.addColorStop(0, 'rgba(57,255,20,' + (0.5 + blink * 0.5) + ')');
        grd.addColorStop(1, 'rgba(57,255,20,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(drawX - r, s.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    // 4. 黄泉山脉(视差)
    if (_mountainPath) {
      ctx.save();
      ctx.translate(-t * 8 * _parallax.mountain, 0);
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#1C1033';
      ctx.fill(_mountainPath);
      // 画两遍实现无缝循环
      ctx.translate(W, 0);
      ctx.fill(_mountainPath);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 5. 竞技场(暗紫背景 + 径向渐变暗角)
    ctx.fillStyle = '#180E22';
    ctx.fillRect(0, LY.ARENA_Y, W, LY.ARENA_H);
    var vignette = ctx.createRadialGradient(W / 2, LY.ARENA_Y + LY.ARENA_H / 2, 30, W / 2, LY.ARENA_Y + LY.ARENA_H / 2, LY.ARENA_H * 0.7);
    vignette.addColorStop(0, 'rgba(24,14,34,0)');
    vignette.addColorStop(1, 'rgba(13,13,26,0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, LY.ARENA_Y, W, LY.ARENA_H);

    // 6. 像素灯笼(中速视差+摆动)
    if (_lanterns) {
      var lxOff = -t * 8 * _parallax.lantern;
      for (var i = 0; i < _lanterns.length; i++) {
        var ln = _lanterns[i];
        var drawX = _wrapX(ln.x + lxOff, W);
        var sway = M.sin(t * 1.5 + ln.phase) * 3;
        var ly = ln.y + sway;
        // 挂线
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(drawX, ly - 14);
        ctx.lineTo(drawX, ly - 6);
        ctx.stroke();
        // 灯笼体
        ctx.fillStyle = ln.color;
        ctx.beginPath();
        ctx.arc(drawX, ly, 5, 0, M.PI * 2);
        ctx.fill();
        // 内发光
        ctx.shadowColor = ln.color;
        ctx.shadowBlur = 6 + M.sin(t * 2 + ln.phase) * 3;
        ctx.fillStyle = 'rgba(255,200,100,0.4)';
        ctx.beginPath();
        ctx.arc(drawX, ly, 3, 0, M.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // 灯笼上下框
        ctx.fillStyle = '#222';
        ctx.fillRect(drawX - 3, ly - 6, 6, 2);
        ctx.fillRect(drawX - 3, ly + 4, 6, 2);
      }
    }

    // 7. 石板路纹理(近景视差)
    var stoneOff = -t * 20 * _parallax.stone;
    ctx.strokeStyle = 'rgba(40,30,50,0.4)';
    ctx.lineWidth = 1;
    for (var row = 0; row < 3; row++) {
      var sy = LY.ARENA_Y + LY.ARENA_H - 12 - row * 8;
      var segW = 24;
      var offset = row % 2 === 0 ? 0 : segW / 2;
      for (var sx = -segW; sx < W + segW; sx += segW) {
        var drawSX = _wrapX(sx + offset + stoneOff, segW * 3) - segW;
        ctx.strokeRect(drawSX, sy, segW - 2, 6);
      }
    }

    // 8. 钟馗站位区(迷雾过渡)
    ctx.fillStyle = CO.FOG;
    ctx.fillRect(0, LY.ZHONGKUI_Y - 20, W, 40);

    // 9. 底部暗区
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(0, LY.BOTTOM_Y - 20, W, LY.BOTTOM_H + 20);
  }

  function drawInventory(t) {
    var coins = State.get('coins');
    var buffs = State.get('buffs');
    // 行囊固定在底部栏上方（黄色区域）
    var bagX = 20, bagY = 388, bagW = W - 40, bagH = 36;
    // 面板底
    ctx.fillStyle = CO.PANEL;
    ctx.fillRect(bagX, bagY, bagW, bagH);
    // 面板边框(像素风双层)
    ctx.strokeStyle = CO.PANEL_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(bagX, bagY, bagW, bagH);
    ctx.strokeStyle = CO.COPPER;
    ctx.lineWidth = 1;
    ctx.strokeRect(bagX + 2, bagY + 2, bagW - 4, bagH - 4);
    // 标题"行囊"
    ctx.font = FS.S + 'px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('行囊', bagX + 6, bagY + 10);

    // ── 铜钱小图标 + 数量 ──
    var coinX = bagX + 16, coinY = bagY + 26;
    for (var ci = 0; ci < 2; ci++) {
      var cy = coinY - ci * 5 + M.floor(M.sin((t||0) * 2 + ci) * 0.5);
      ctx.fillStyle = CO.COPPER;
      ctx.fillRect(coinX - 5, cy - 5, 10, 10);
      ctx.fillStyle = '#A0522D';
      ctx.fillRect(coinX - 3, cy - 3, 6, 6);
      ctx.fillStyle = CO.VOID;
      ctx.fillRect(coinX - 2, cy - 2, 4, 4);
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(coinX - 4, cy - 4, 2, 2);
    }
    ctx.font = 'bold ' + FS.S + 'px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('x' + coins, coinX + 8, coinY + 3);

    // ── Buff 格子 1x4 横排 ──
    var slotSize = 18, slotGap = 4;
    var gridX = bagX + 80, gridY = bagY + 8;
    var buffTypes = [
      {key:'red', label:'捕', color:'#CC3333'},
      {key:'green', label:'赔', color:'#33CC33'},
      {key:'special_catch', label:'锁', color:'#9933CC'},
      {key:'special_super', label:'超', color:'#FFD700'}
    ];
    for (var i = 0; i < 4; i++) {
      var sx = gridX + i * (slotSize + slotGap);
      var sy = gridY;
      var bt = buffTypes[i];
      var b = buffs[bt.key];
      ctx.fillStyle = b ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)';
      ctx.fillRect(sx, sy, slotSize, slotSize);
      ctx.strokeStyle = b ? bt.color : '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, slotSize, slotSize);
      if (b) {
        ctx.fillStyle = bt.color;
        ctx.fillRect(sx + 6, sy + 3, 6, 8);
        ctx.fillStyle = CO.WHITE;
        ctx.fillRect(sx + 6, sy + 2, 6, 2);
        ctx.fillStyle = CO.VOID;
        ctx.fillRect(sx + 8, sy, 2, 3);
        ctx.font = '7px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = CO.BONE;
        ctx.fillText(b.remaining, sx + 17, sy + 16);
      } else {
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(sx + 4, sy + 4, slotSize - 8, slotSize - 8);
        ctx.setLineDash([]);
      }
    }
  }

  function drawIdleUI(t) {
    var inserted = State.get('coinsInserted');
    var coins = State.get('coins');

    // 标题
    ctx.font = 'bold ' + FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('黑笑话：钟馗', W/2, 175);

    // ── 投币提示 ──
    ctx.textAlign = 'center';
    if (inserted > 0) {
      ctx.font = FS.M + 'px monospace';
      ctx.fillStyle = CO.COPPER;
      ctx.fillText('已投 ' + inserted + ' 币', W/2, LY.ZHONGKUI_Y - 80);
      ctx.font = FS.S + 'px monospace';
      ctx.fillStyle = CO.BONE;
      ctx.fillText('按「开始」丢索套鬼', W/2, LY.ZHONGKUI_Y - 60);
    } else {
      ctx.font = FS.S + 'px monospace';
      ctx.globalAlpha = 0.5 + M.sin(t * 2) * 0.3;
      ctx.fillStyle = CO.BONE;
      ctx.fillText('按「开始」投币开始游戏', W/2, LY.ZHONGKUI_Y - 60);
      ctx.globalAlpha = 1;
    }
  }

  // 像素铜钱堆叠绘制
  function _drawPixelCoinStack(ctx2d, x, y, count, t) {
    for (var i = 0; i < count; i++) {
      var cy = y - i * 5 + M.floor(M.sin(t * 2 + i) * 0.5);
      // 外圆(方形模拟)
      ctx2d.fillStyle = CO.COPPER;
      ctx2d.fillRect(x - 8, cy - 8, 16, 16);
      ctx2d.fillStyle = '#A0522D';
      ctx2d.fillRect(x - 6, cy - 6, 12, 12);
      // 方孔
      ctx2d.fillStyle = CO.VOID;
      ctx2d.fillRect(x - 3, cy - 3, 6, 6);
      // 高光
      ctx2d.fillStyle = CO.COPPER_SHINE;
      ctx2d.fillRect(x - 7, cy - 7, 3, 2);
    }
  }

  function drawRunningUI(t, se) {
    ctx.globalAlpha = 0.5 + M.sin(t * 4) * 0.3;
    ctx.font = FS.M + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('按「丢索」套鬼!', W/2, 350);
    ctx.globalAlpha = 1;
    ctx.font = FS.S + 'px monospace';
    ctx.fillStyle = CO.COPPER;
    ctx.fillText('投币 ' + State.get('roundCoins') + ' 链', W/2, LY.BOTTOM_Y + 30);
  }

  // ── 链节纹理绘制: 每8px一个菱形节 + 辉光 ──
  function drawChainLink(ctx2d, x1, y1, x2, y2, color, glowColor, isSuper) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = M.sqrt(dx*dx + dy*dy);
    if (len < 1) return;
    var nx = dx/len, ny = dy/len;
    var px = -ny, py = nx; // 垂直方向

    // 辉光底层
    if (isSuper) {
      ctx2d.shadowColor = glowColor || CO.COPPER_SHINE;
      ctx2d.shadowBlur = 8;
    } else {
      ctx2d.shadowColor = glowColor || CO.CHAIN_GLOW;
      ctx2d.shadowBlur = 3;
    }

    // 主链线
    ctx2d.strokeStyle = color || CO.CHAIN;
    ctx2d.lineWidth = isSuper ? 3 : 2;
    ctx2d.beginPath();
    ctx2d.moveTo(x1, y1);
    ctx2d.lineTo(x2, y2);
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;

    // 链节(每10px一个菱形)
    var segLen = isSuper ? 12 : 10;
    var segs = M.floor(len / segLen);
    ctx2d.fillStyle = isSuper ? CO.COPPER_SHINE : '#8899AA';
    for (var i = 1; i < segs; i++) {
      var sx = x1 + nx * i * segLen;
      var sy = y1 + ny * i * segLen;
      var sz = isSuper ? 3 : 2;
      // 菱形
      ctx2d.beginPath();
      ctx2d.moveTo(sx + px * sz, sy + py * sz);
      ctx2d.lineTo(sx + nx * sz, sy + ny * sz);
      ctx2d.lineTo(sx - px * sz, sy - py * sz);
      ctx2d.lineTo(sx - nx * sz, sy - ny * sz);
      ctx2d.closePath();
      ctx2d.fill();
    }
  }

  function drawLassoUI(t, progress) {
    var chains = State.get('chains');
    if (!chains) return;
    if (progress > 0.95 && !State.get('_lassoFlash')) {
      Renderer.triggerShake(3);
      Renderer.triggerFlash(CO.COPPER_SHINE, 0.15);
      State.set('_lassoFlash', true);
    }
    var ep = progress * (2 - progress);
    var originX = W / 2, originY = LY.ZHONGKUI_Y;
    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      var tg = chain.targetGhost;
      var tx = tg ? tg.x : chain.targetX;
      var ty2 = tg ? tg.y : chain.targetY;
      var cx = originX + M.floor((tx - originX) * ep);
      var cy = originY + M.floor((ty2 - originY) * ep) - M.floor(M.sin(ep * M.PI) * 50);
      // 链节纹理+辉光
      var chainColor = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
      var glowColor = chain.isSuper ? '#FFD700' : CO.CHAIN_GLOW;
      drawChainLink(ctx, originX, originY, cx, cy, chainColor, glowColor, chain.isSuper);
      // 钩子(链头)
      ctx.fillStyle = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
      ctx.fillStyle = CO.VOID;
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
      // 赔率(带脉冲)
      var pl = 1 + M.sin(t * 3 + i) * 0.15;
      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.save();
      ctx.translate(cx + 14, cy - 12);
      ctx.scale(pl, pl);
      ctx.fillText('x' + chain.odds, 0, 0);
      ctx.restore();
    }
  }

  // ★ Bug#9: 钓鱼节奏HITTING UI(renderX/Y振荡, 不拉到身旁) V2: 链绷紧+连击特效
  function drawHittingUI(t) {
    var chains = State.get('chains');
    var hitCount = State.get('hitCount');
    var hitTimer = State.get('hitTimer');
    var hitMax = State.get('hitMax');
    var pr = M.min(hitTimer / hitMax, 1);

    ctx.fillStyle = 'rgba(26,10,0,0.35)';
    ctx.fillRect(0, LY.HUD_H, W, H - LY.HUD_H);

    var originX = W / 2, originY = LY.ZHONGKUI_Y;

    if (chains) {
      for (var i = 0; i < chains.length; i++) {
        var chain = chains[i];
        var px = M.floor(chain.renderX);
        var py = M.floor(chain.renderY);

        var ghost = CONFIG.GT[chain.ghostType];
        var w = ghost.size[0], h = ghost.size[1];
        // 挣扎抖动(随进度减弱)
        var shake = (1 - pr) * 4;
        var sx = M.floor((M.random()-0.5)*shake);
        var sy = M.floor((M.random()-0.5)*shake);

        // 鬼(用完整绘制替代色块)
        ctx.save();
        ctx.translate(px + sx, py + sy);
        // 简化的鬼体(基于ghosts.js的对应函数)
        ctx.fillStyle = ghost.color;
        ctx.fillRect(-M.floor(w/2), -M.floor(h/2), w, h);
        // 挣扎红眼
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(-3, -2, 2, 2);
        ctx.fillRect(2, -2, 2, 2);
        ctx.restore();

        // 链: 绷紧效果(随拉扯进度链变直+缩短)
        var tension = pr * 0.6; // 链收紧程度
        var midX = originX + (px - originX) * (0.5 - tension * 0.3);
        var midY = originY + (py - originY) * 0.5 + 15 * (1 - tension);
        var chainColor = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
        var glowColor = chain.isSuper ? '#FFD700' : CO.CHAIN_GLOW;
        drawChainLink(ctx, originX, originY, px, py, chainColor, glowColor, chain.isSuper);

        // 赔率(脉冲)
        var pl = 1 + M.sin(t * 3 + i) * 0.1;
        ctx.font = FS.S + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = CO.COPPER_SHINE;
        ctx.save();
        ctx.translate(px, py - M.floor(h/2) - 10);
        ctx.scale(pl, pl);
        ctx.fillText('x' + chain.odds, 0, 0);
        ctx.restore();
      }
    }

    // 连击数(带Combo特效)
    var comboScale = 1;
    var comboColor = CO.GHOST_GREEN;
    if (hitCount >= 3) { comboScale = 1.1; comboColor = CO.COPPER_SHINE; }
    if (hitCount >= 5) { comboScale = 1.2; comboColor = '#FF6600'; }
    if (hitCount >= 8) { comboScale = 1.3; comboColor = '#FF4444'; }
    ctx.save();
    ctx.translate(W/2, LY.BOTTOM_Y - 10);
    ctx.scale(comboScale, comboScale);
    ctx.font = FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = comboColor;
    ctx.fillText(hitCount + ' 拉扯', 0, 0);
    // Combo标签
    if (hitCount >= 3) {
      ctx.font = FS.S + 'px monospace';
      ctx.fillStyle = comboColor;
      ctx.globalAlpha = 0.6 + M.sin(t * 8) * 0.4;
      ctx.fillText('COMBO x' + hitCount, 0, -20);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 进度条(增强版: 从绿→黄→红渐变)
    ctx.fillStyle = '#333';
    ctx.fillRect(40, LY.BOTTOM_Y+2, W-80, 6);
    var barW = M.floor((W-80)*(1-pr));
    var barColor;
    if (pr < 0.3) barColor = CO.GHOST_GREEN;
    else if (pr < 0.6) barColor = CO.COPPER;
    else barColor = '#FF4444';
    ctx.fillStyle = barColor;
    ctx.fillRect(40, LY.BOTTOM_Y+2, barW, 6);
    // 进度条高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(40, LY.BOTTOM_Y+2, barW, 2);
  }

  function drawResultUI(t, progress) {
    var results = State.get('roundResult') || [];
    var tw = 0, successes = [], failures = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].success) { tw += results[i].odds; successes.push(results[i]); }
      else failures.push(results[i]);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, LY.HUD_H, W, H - LY.HUD_H);

    // ★ Bug#9: 成功的鬼→拉至身旁动画(判定成功后才播放)
    for (var i = 0; i < successes.length; i++) {
      var r = successes[i];
      var lp = M.min(1, progress*1.5 - i*0.15);
      if (lp <= 0) continue;
      var n = successes.length;
      var endX = 160-(n-1)*28+i*56, endY = 300;
      var bounce = lp<0.5 ? 2*lp*lp : 1-M.pow(-2*lp+2,2)/2;
      var px = 160+(endX-160)*bounce;
      var py = 240+(endY-240)*bounce - M.sin(lp*M.PI)*90;
      var ghost = CONFIG.GT[r.ghostType];
      var w = ghost.size[0], h = ghost.size[1];
      ctx.fillStyle = ghost.color;
      ctx.fillRect(M.floor(px-w/2), M.floor(py-h/2), w, h);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(M.floor(px-3), M.floor(py-2), 2, 2);
      ctx.fillRect(M.floor(px+2), M.floor(py-2), 2, 2);
      ctx.font = FS.M + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.GHOST_GREEN;
      ctx.fillText('x'+r.odds, M.floor(px+22), M.floor(py-20));
      ctx.font = FS.S + 'px monospace';
      ctx.fillStyle = CO.BONE;
      ctx.fillText(ghost.name, M.floor(px+22), M.floor(py-8));
    }
    for (var i = 0; i < failures.length; i++) {
      var r = failures[i];
      var ep = M.min(1, progress*1.2-i*0.1);
      if (ep <= 0) continue;
      var fx = 290*ep, fy = 230+i*28;
      var ghost = CONFIG.GT[r.ghostType];
      var w = ghost.size[0], h = ghost.size[1];
      ctx.fillStyle = ghost.color;
      ctx.fillRect(M.floor(fx-w/2), M.floor(fy-h/2), w, h);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(M.floor(fx-3), M.floor(fy-2), 2, 2);
      ctx.fillRect(M.floor(fx+2), M.floor(fy-2), 2, 2);
      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF4444';
      ctx.fillText(ghost.name+' 逃脱', 150, M.floor(fy));
    }
    if (tw > 0) {
      // 获得币数字(带缩放脉冲)
      var winScale = 1 + M.sin(progress * M.PI * 2) * 0.1;
      ctx.save();
      ctx.translate(W/2, 410);
      ctx.scale(winScale, winScale);
      ctx.font = 'bold '+FS.L+'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillText('获得 '+tw+' 币', 0, 0);
      ctx.restore();
    }
    var roundCoins = State.get('roundCoins');
    if (tw >= roundCoins*5 && tw > 0) {
      // ★ Big Win全屏金色冲击波
      var bwPr = M.min(1, progress * 1.2);
      // 1. 全屏金色闪光
      ctx.globalAlpha = M.max(0, 0.4 * M.sin(bwPr * M.PI));
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      // 2. "BIG WIN!" 文字 outElastic 弹出
      if (bwPr > 0.15) {
        var txtPr = EASE.outElastic(M.min(1, (bwPr - 0.15) / 0.7));
        var sc = 0.3 + txtPr * 1.2;
        ctx.save();
        ctx.translate(W/2, 160);
        ctx.scale(sc, sc);
        // 文字背景框
        ctx.fillStyle = CO.DARK;
        ctx.fillRect(-70, -22, 140, 44);
        ctx.strokeStyle = CO.COPPER_SHINE;
        ctx.lineWidth = 2;
        ctx.strokeRect(-68, -20, 136, 40);
        ctx.font = 'bold '+FS.L+'px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = CO.COPPER_SHINE;
        ctx.fillText('BIG WIN!', 0, 8);
        ctx.restore();
      }
      // 3. 首次触发: 大量金色粒子爆发
      if (!State.get('_bigWinFired') && bwPr > 0.3) {
        State.set('_bigWinFired', true);
        Renderer.triggerShake(12, 0.6);
        // 从屏幕中央向四周爆发20+粒子
        for (var pi = 0; pi < 25; pi++) {
          Renderer.spawnParticles(W/2, 200, ['#FFD700', '#FFAA00', CO.WHITE][M.floor(M.random()*3)], 1);
        }
        // 飞币
        for (var fi = 0; fi < 8; fi++) {
          Renderer.spawnCoinFly(W/2 + (M.random()-0.5)*60, 180 + (M.random()-0.5)*40, 20, 15);
        }
      }
    }
  }

  function drawSettleUI(t, se) {
    var tw = State.get('totalWin');
    var cp = State.get('settleCoinsPaid');
    drawBackground(t);
    Ghosts.draw(ctx, t);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, LY.HUD_H, W, H-LY.HUD_H);

    // ★ 结算飞币: 每增加1币发射1枚飞向HUD
    var prevCp = State.get('_prevSettleCoins') || 0;
    if (cp > prevCp && cp <= tw) {
      var diff = cp - prevCp;
      for (var fi = 0; fi < M.min(diff, 3); fi++) {
        var fromX = W/2 + (M.random()-0.5)*40;
        var fromY = 160 + (M.random()-0.5)*30;
        Renderer.spawnCoinFly(fromX, fromY, 20, 15);
      }
    }
    State.set('_prevSettleCoins', cp);

    // 数字滚动显示(大号+金色)
    ctx.save();
    ctx.translate(W/2, 150);
    var numScale = 1 + M.sin(t * 4) * 0.05;
    ctx.scale(numScale, numScale);
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = CO.BLACK;
    ctx.lineWidth = 3;
    ctx.strokeText(String(cp).padStart(3,'0'), 0, 0);
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText(String(cp).padStart(3,'0'), 0, 0);
    ctx.restore();

    // 成功鬼展示(带呼吸金光)
    var results = State.get('roundResult') || [];
    var successes = [];
    for (var i = 0; i < results.length; i++) { if (results[i].success) successes.push(results[i]); }
    var scStart = successes.length > 0 ? (W-(successes.length-1)*55)/2 : 0;
    for (var i = 0; i < successes.length; i++) {
      var r = successes[i], scx = scStart+i*55;
      var ghost = CONFIG.GT[r.ghostType];
      // 鬼体+光环
      ctx.shadowColor = ghost.glow;
      ctx.shadowBlur = 4 + M.sin(t*2.5+i)*3;
      ctx.fillStyle = ghost.color;
      ctx.fillRect(scx-8, 270, 16, 12);
      ctx.shadowBlur = 0;
      // 赔率标签
      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.GHOST_GREEN;
      ctx.fillText('x'+r.odds, scx, 260);
      // 闪烁星星
      ctx.globalAlpha = 0.4+M.sin(t*2.5+i)*0.4;
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(scx-16, 258, 5, 5);
      ctx.fillRect(scx+14, 252, 5, 5);
      ctx.globalAlpha = 1;
    }

    // 失败鬼(右侧小图标)
    var failures = [];
    for (var i = 0; i < results.length; i++) { if (!results[i].success) failures.push(results[i]); }
    for (var i = 0; i < failures.length; i++) {
      var r = failures[i];
      var fx = 280 + i*18;
      ctx.fillStyle = '#333';
      ctx.fillRect(fx, 255, 12, 10);
      ctx.fillStyle = '#555';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('×', fx+6, 263);
    }

    // 提示文字
    if (cp >= tw && se > tw/10+0.5) {
      ctx.globalAlpha = 0.5 + M.sin(t*0.3)*0.3;
      ctx.font = FS.M + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.BONE;
      ctx.fillText('点击继续', W/2, 400);
      ctx.globalAlpha = 1;
    }
  }

  // ── ★ 孟婆奶茶店UI V3: 大立绘+选中购买+柜台遮挡 ──
  function drawShopUI(t) {
    var teas = CONFIG.MILK_TEA;
    var coins = State.get('coins');
    var scrollY = ZhongKui.getShopScrollY();
    var selected = ZhongKui.getSelectedTea();

    // ── 1. 奶茶店背景 ──
    ctx.fillStyle = '#0D0D1A';
    ctx.fillRect(0, 0, W, H);
    // 木质纹理(水平暗线)
    ctx.strokeStyle = 'rgba(139,105,20,0.06)';
    ctx.lineWidth = 1;
    for (var wi = 0; wi < 14; wi++) {
      var wy = wi * 36;
      ctx.beginPath(); ctx.moveTo(0, wy); ctx.lineTo(W, wy); ctx.stroke();
    }
    // 左上角装饰灯笼(小)
    ctx.fillStyle = 'rgba(255,100,0,0.08)';
    ctx.beginPath(); ctx.arc(30, 50, 12, 0, M.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(W-30, 70, 10, 0, M.PI*2); ctx.fill();

    // ── 2. 招牌(更高，确保不被遮挡) ──
    var signY = 4, signH = 28;
    ctx.fillStyle = '#2A1A10';
    ctx.fillRect(10, signY, W-20, signH);
    ctx.strokeStyle = CO.COPPER_SHINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(12, signY+2, W-24, signH-4);
    ctx.fillStyle = CO.COPPER;
    ctx.fillRect(16, signY+5, 3, signH-10);
    ctx.fillRect(W-19, signY+5, 3, signH-10);
    ctx.font = 'bold '+FS.M+'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('奈何桥奶茶铺', W/2, signY+19);

    // ── 3. 孟婆立绘: 优先使用外部图片, fallback到手绘 ──
    var counterY = 280; // 分界线下移至280
    if (_mengpoImg && _mengpoImg.complete) {
      // 缩放图片: 保持宽高比, 高度340px, 腰部约在y=280(柜台线)
      var targetH = 340;
      var scale = targetH / _mengpoImg.naturalHeight;
      var drawW = _mengpoImg.naturalWidth * scale;
      var drawH = targetH;
      var drawX = (W - drawW) / 2;
      var drawY = 50;
      ctx.drawImage(_mengpoImg, drawX, drawY, drawW, drawH);
    } else {
      // Fallback: 手绘像素孟婆
      var mpX = W/2, mpTop = 45;
      var mpBreath = M.sin(t * 1.5) * 1;
      // 头发
      ctx.fillStyle = '#6A0DAD';
      ctx.fillRect(mpX-14, mpTop-4, 28, 14);
      ctx.fillRect(mpX-18, mpTop+2, 8, 10);
      ctx.fillRect(mpX+10, mpTop+2, 8, 10);
      ctx.fillRect(mpX-10, mpTop-10, 20, 8);
      ctx.fillStyle = '#8A2BE2';
      ctx.fillRect(mpX-10, mpTop-6, 6, 4);
      ctx.fillRect(mpX+2, mpTop-4, 4, 3);
      ctx.fillStyle = '#C0C0C0';
      ctx.fillRect(mpX+10, mpTop-12, 2, 10);
      // 脸
      ctx.fillStyle = '#F5DEB3';
      ctx.fillRect(mpX-9, mpTop+10, 18, 14);
      ctx.fillStyle = '#4B0082';
      ctx.fillRect(mpX-6, mpTop+16, 4, 3);
      ctx.fillRect(mpX+2, mpTop+16, 4, 3);
      ctx.fillStyle = CO.WHITE;
      ctx.fillRect(mpX-4, mpTop+17, 1, 1);
      ctx.fillRect(mpX+4, mpTop+17, 1, 1);
      ctx.fillStyle = '#CC6666';
      ctx.fillRect(mpX-3, mpTop+22, 6, 2);
      // 身体/紫袍
      ctx.fillStyle = '#4B0082';
      ctx.fillRect(mpX-11, mpTop+24, 22, 55);
      ctx.fillStyle = '#6A0DAD';
      ctx.fillRect(mpX-8, mpTop+30, 3, 12);
      ctx.fillRect(mpX+5, mpTop+34, 3, 12);
      ctx.fillStyle = '#8A2BE2';
      ctx.fillRect(mpX-12, mpTop+50, 24, 5);
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(mpX-2, mpTop+51, 4, 3);
      // 手臂+汤杯
      ctx.strokeStyle = '#4B0082'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mpX+10, mpTop+40); ctx.lineTo(mpX+18, mpTop+46);
      ctx.stroke();
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(mpX+16, mpTop+42, 8, 10);
      ctx.fillStyle = '#6A0DAD';
      ctx.fillRect(mpX+19, mpTop+36+mpBreath, 2, 5);
      // 裙摆
      ctx.fillStyle = '#3D0066';
      ctx.beginPath();
      ctx.moveTo(mpX-18, mpTop+80); ctx.lineTo(mpX-10, mpTop+78);
      ctx.lineTo(mpX+10, mpTop+78); ctx.lineTo(mpX+18, mpTop+80);
      ctx.lineTo(mpX+22, mpTop+110); ctx.lineTo(mpX-22, mpTop+110);
      ctx.closePath(); ctx.fill();
    }

    // ── 4. 对话气泡(在孟婆右上方) ──
    var line = State.get('mengpoLine');
    var lineTimer = State.get('mengpoLineTimer');
    if (line && lineTimer > 0) {
      // 根据是否有图片调整气泡位置
      var bubbleW = 260, bubbleH = 40;
      var bubbleX, bubbleY;
      if (_mengpoImg && _mengpoImg.complete) {
        // 图片模式: 气泡在人物右上方, 上移避免挡脸
        bubbleX = 150; bubbleY = 40;
      } else {
        // 手绘模式
        bubbleX = W/2 + 24; bubbleY = 45;
      }
      if (bubbleX + bubbleW > W - 4) bubbleX = W - bubbleW - 4;
      ctx.fillStyle = 'rgba(13,13,26,0.95)';
      ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
      ctx.strokeStyle = selected ? CO.COPPER_SHINE : CO.CHAIN_GLOW;
      ctx.lineWidth = 1;
      ctx.strokeRect(bubbleX+1, bubbleY+1, bubbleW-2, bubbleH-2);
      // 小箭头指向孟婆
      ctx.fillStyle = 'rgba(13,13,26,0.95)';
      ctx.beginPath();
      ctx.moveTo(bubbleX+8, bubbleY+bubbleH); ctx.lineTo(bubbleX+4, bubbleY+bubbleH+5); ctx.lineTo(bubbleX+12, bubbleY+bubbleH);
      ctx.fill();
      ctx.font = FS.S+'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = selected ? CO.COPPER_SHINE : CO.BONE;
      // 自动换行: 每行最多24个字符(260px/10px≈26)
      var maxChars = 24;
      if (line.length <= maxChars) {
        ctx.fillText(line, bubbleX + bubbleW/2, bubbleY+16);
      } else {
        ctx.fillText(line.substring(0, maxChars), bubbleX + bubbleW/2, bubbleY+14);
        ctx.fillText(line.substring(maxChars), bubbleX + bubbleW/2, bubbleY+28);
      }
    }

    // ── 5. 柜台分界线(蓝线位置=240，有厚度) ──
    // 柜台上表面
    ctx.fillStyle = '#5C3A10';
    ctx.fillRect(0, counterY, W, 10);
    // 柜台高光
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(0, counterY, W, 2);
    // 柜台前沿
    ctx.fillStyle = '#3D2608';
    ctx.fillRect(0, counterY+8, W, 2);
    // 柜台装饰线
    ctx.strokeStyle = 'rgba(255,215,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, counterY+4); ctx.lineTo(W, counterY+4); ctx.stroke();
    // 左右角柱
    ctx.fillStyle = '#4A2F0C';
    ctx.fillRect(4, counterY-4, 6, 14);
    ctx.fillRect(W-10, counterY-4, 6, 14);

    // ── 6. 商品列表(两列排列) ──
    var listY = counterY + 14;
    var itemH = 32;
    var gap = 4;
    var colW = (W - 16 - gap) / 2;
    var visibleBot = H - 6;
    var itemsPerRow = 2;
    var totalRows = M.ceil(teas.length / itemsPerRow) + 1; // +1 for treat row
    var maxScroll = M.max(0, totalRows*(itemH+gap) + 8 - (visibleBot - listY));
    scrollY = M.max(0, M.min(scrollY, maxScroll));
    ZhongKui.setShopScrollY(scrollY);

    ctx.save();
    ctx.beginPath(); ctx.rect(0, listY, W, visibleBot - listY); ctx.clip();

    // 列表区域实色背景底(不透)
    ctx.fillStyle = '#0D0D1A';
    ctx.fillRect(0, listY, W, visibleBot - listY);

    for (var i = 0; i < teas.length; i++) {
      var tea = teas[i];
      var row = M.floor(i / itemsPerRow);
      var col = i % itemsPerRow;
      var rx = 8 + col * (colW + gap);
      var ry = listY + row * (itemH + gap) - scrollY;
      if (ry + itemH < listY || ry > visibleBot) continue;
      var isSel = selected && selected.id === tea.id;
      var canBuy = coins >= tea.price;

      // 格子背景(实色不透)
      if (isSel) {
        ctx.fillStyle = '#2A2508';
        ctx.fillRect(rx, ry, colW, itemH);
        ctx.strokeStyle = CO.COPPER_SHINE;
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, colW, itemH);
      } else {
        ctx.fillStyle = canBuy ? '#131326' : '#0A0A14';
        ctx.fillRect(rx, ry, colW, itemH);
        ctx.strokeStyle = '#222240';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, colW, itemH);
      }

      // 图标(像素杯 8×10)
      var iconColor = tea.type==='red'?'#CC3333':tea.type==='green'?'#33CC33':tea.type==='special_catch'?'#9933CC':'#FFD700';
      ctx.fillStyle = iconColor;
      ctx.fillRect(rx + 6, ry + 10, 8, 10);
      ctx.fillStyle = CO.WHITE;
      ctx.fillRect(rx + 6, ry + 8, 8, 3);
      ctx.fillStyle = CO.VOID;
      ctx.fillRect(rx + 9, ry + 6, 2, 4);

      // 名称(截短)
      ctx.textAlign = 'left';
      ctx.font = FS.S+'px monospace';
      var displayName = tea.name.length > 4 ? tea.name.substring(0,4) : tea.name;
      ctx.fillStyle = isSel ? CO.COPPER_SHINE : (canBuy ? CO.BONE : '#666');
      ctx.fillText(displayName, rx + 18, ry + 18);

      // 价格
      ctx.textAlign = 'right';
      ctx.fillStyle = canBuy ? CO.COPPER_SHINE : '#555';
      ctx.fillText(tea.price, rx + colW - 6, ry + 18);
    }

    // 请孟婆喝一杯(占两列宽度)
    var treatRow = M.ceil(teas.length / itemsPerRow);
    var treatY = listY + treatRow*(itemH+gap) - scrollY;
    if (treatY < visibleBot) {
      var canTreat = coins >= CONFIG.MENGPO_TREAT_PRICE;
      ctx.fillStyle = canTreat ? '#1A0A0A' : '#0A0A14';
      ctx.fillRect(8, treatY, W-16, itemH);
      ctx.strokeStyle = canTreat ? '#552222' : '#222240';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, treatY, W-16, itemH);
      ctx.textAlign = 'center';
      ctx.font = FS.S+'px monospace';
      ctx.fillStyle = canTreat ? CO.LANTERN : '#666';
      ctx.fillText('请孟婆喝一杯 ('+CONFIG.MENGPO_TREAT_PRICE+'币)', W/2, treatY + 20);
    }
    ctx.restore();

    // 滚动条
    if (maxScroll > 0) {
      var barH = M.max(16, (visibleBot-listY)*(visibleBot-listY)/(totalRows*(itemH+gap)+8));
      var barY = listY + scrollY/maxScroll*(visibleBot-listY-barH);
      ctx.fillStyle = 'rgba(255,215,0,0.25)';
      ctx.fillRect(W-5, barY, 3, barH);
    }

    // ── 7. 柜台遮挡层(确保孟婆下半身被遮挡) ──
    // 柜台实体部分已经在上面画了，但孟婆裙摆有一部分在柜台后面
    // 我们已经在柜台Y=240画了厚度10的柜台，所以y>240的部分被覆盖
  }

  // ── Bug#2: Cookie存档 ──
  function saveGame() {
    try {
      var data = {
        coins: State.get('coins'), favor: State.get('favor'),
        buffs: State.get('buffs'), roiHistory: State.get('roiHistory'),
        sfxMuted: Audio.isSfxMuted(), bgmMuted: Audio.isBgmMuted(), v: 2
      };
      document.cookie = 'zhongkui_save=' + encodeURIComponent(JSON.stringify(data)) +
        ';max-age=31536000;path=/;SameSite=Lax';
    } catch(e) {}
  }
  function loadSave() {
    try {
      var match = document.cookie.match(/zhongkui_save=([^;]+)/);
      if (!match) { State.set('coins', CONFIG.START_COINS); return; }
      var data = JSON.parse(decodeURIComponent(match[1]));
      if (typeof data.coins === 'number') State.set('coins', data.coins);
      if (data.favor) State.set('favor', data.favor);
      if (data.buffs) State.set('buffs', data.buffs);
      if (data.roiHistory) State.set('roiHistory', data.roiHistory);
      if (data.sfxMuted) Audio.setSfxMuted(true);
      if (data.bgmMuted) Audio.setBgmMuted(true);
    } catch(e) { State.set('coins', CONFIG.START_COINS); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); requestAnimationFrame(loop); });
  } else { init(); requestAnimationFrame(loop); }

  window._GameAPI = { doSettle: doSettle, doLasso: doLasso,
    resetSave: function() {
      document.cookie = 'zhongkui_save=;max-age=0;path=/';
      State.set('coins', CONFIG.START_COINS);
      State.set('favor', {level:1,exp:0});
      State.set('buffs', {red:null,green:null,special_catch:null,special_super:null});
      State.set('roiHistory', []);
      Renderer.spawnFloatingText(W/2, 200, '存档已重置', CO.COPPER_SHINE);
    }
  };
})();
