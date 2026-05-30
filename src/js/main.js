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

  function init() {
    canvas = document.getElementById('gc');
    ctx = canvas.getContext('2d');
    Renderer.init(canvas);
    Audio.init();
    loadSave();
    initBackground(); // T2.3 预计算背景元素
    ZhongKui.init();
    State.changeStage('IDLE');
    console.log('[钟馗] 初始化完成', W, 'x', H, '铜钱:', State.get('coins'));
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

  function render(dt) {
    var stage = State.get('stage');
    var t = totalTime;
    var se = State.get('stageTimer');

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

    Renderer.drawHUD();
    Renderer.drawMengpoLine();
    Renderer.drawFlash();
    ctx.restore();
  }

  // ── T2.3 场景渲染: 冥界天空+鬼火星点+黄泉山脉+竞技场暗角 ──
  var _starPositions = null;
  var _mountainPath = null;

  function initBackground() {
    // 预计算鬼火星点位置(确定性随机)
    _starPositions = [];
    var M2 = Math;
    for (var i = 0; i < 20; i++) {
      _starPositions.push({
        x: M2.floor(M2.random() * W),
        y: M2.floor(LY.HUD_H + 10 + M2.random() * (LY.SKY_H - 20)),
        phase: M2.random() * M2.PI * 2,
        size: 1 + M2.floor(M2.random() * 2)
      });
    }
    // 预生成山脉Path2D
    _mountainPath = new Path2D();
    _mountainPath.moveTo(0, LY.ARENA_Y);
    for (var x = 0; x <= W; x += 4) {
      _mountainPath.lineTo(x, LY.ARENA_Y - (8 + M2.sin(x * 0.04) * 6 + M2.sin(x * 0.07) * 3));
    }
    _mountainPath.lineTo(W, LY.ARENA_Y);
    _mountainPath.closePath();
  }

  function drawBackground(t) {
    // 1. 冥界天空(线性渐变)
    var sky = ctx.createLinearGradient(0, LY.HUD_H, 0, LY.HUD_H + LY.SKY_H);
    sky.addColorStop(0, CO.VOID);
    sky.addColorStop(0.5, CO.DUSK);
    sky.addColorStop(1, CO.FOG);
    ctx.fillStyle = sky;
    ctx.fillRect(0, LY.HUD_H, W, LY.SKY_H);

    // 2. 鬼火星点(lighter叠光)
    if (_starPositions) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < _starPositions.length; i++) {
        var s = _starPositions[i];
        var blink = (M.sin(t * (1 + (i % 5) * 0.4) + s.phase) + 1) * 0.5;
        var r = s.size + blink * 2;
        var grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        grd.addColorStop(0, 'rgba(57,255,20,' + (0.5 + blink * 0.5) + ')');
        grd.addColorStop(1, 'rgba(57,255,20,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    // 3. 黄泉山脉(Path2D缓存 + shadowBlur微光)
    if (_mountainPath) {
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#1C1033';
      ctx.fill(_mountainPath);
      ctx.shadowBlur = 0;
    }

    // 4. 竞技场(暗紫背景 + 径向渐变暗角)
    ctx.fillStyle = '#180E22';
    ctx.fillRect(0, LY.ARENA_Y, W, LY.ARENA_H);
    var vignette = ctx.createRadialGradient(W / 2, LY.ARENA_Y + LY.ARENA_H / 2, 30, W / 2, LY.ARENA_Y + LY.ARENA_H / 2, LY.ARENA_H * 0.7);
    vignette.addColorStop(0, 'rgba(24,14,34,0)');
    vignette.addColorStop(1, 'rgba(13,13,26,0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, LY.ARENA_Y, W, LY.ARENA_H);

    // 5. 钟馗站位区(迷雾过渡)
    ctx.fillStyle = CO.FOG;
    ctx.fillRect(0, LY.ZHONGKUI_Y - 20, W, 40);

    // 6. 底部暗区
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(0, LY.BOTTOM_Y - 20, W, LY.BOTTOM_H + 20);
  }

  function drawIdleUI(t) {
    var inserted = State.get('coinsInserted');
    var coins = State.get('coins');

    ctx.font = 'bold ' + FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('黑笑话：钟馗', W/2, 180);

    if (inserted > 0) {
      ctx.font = 'bold ' + FS.L + 'px monospace';
      ctx.fillStyle = CO.COPPER;
      ctx.fillText(inserted + ' 币', W/2, 220);
      ctx.font = FS.S + 'px monospace';
      ctx.fillStyle = CO.BONE;
      ctx.fillText('按「开始」丢索套鬼', W/2, 244);
    } else {
      ctx.font = FS.M + 'px monospace';
      ctx.fillStyle = CO.BONE;
      ctx.fillText('按「开始」投币', W/2, 220);
    }
    ctx.font = FS.S + 'px monospace';
    ctx.fillStyle = '#A0A0C0';
    ctx.fillText('持有 ' + coins + ' 铜钱', W/2, 270);

    // 打工入口已移至商店(孟婆→), 主界面不再显示
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

  function drawLassoUI(t, progress) {
    var chains = State.get('chains');
    if (!chains) return;
    if (progress > 0.95) Renderer.triggerShake(3);
    var ep = progress * (2 - progress);
    var originX = W / 2, originY = LY.ZHONGKUI_Y;
    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      var tg = chain.targetGhost;
      var tx = tg ? tg.x : chain.targetX;
      var ty2 = tg ? tg.y : chain.targetY;
      var cx = originX + M.floor((tx - originX) * ep);
      var cy = originY + M.floor((ty2 - originY) * ep) - M.floor(M.sin(ep * M.PI) * 50);
      ctx.strokeStyle = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
      ctx.lineWidth = chain.isSuper ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.quadraticCurveTo(M.floor((originX+cx)/2), M.floor((originY+cy)/2)+20, cx, cy);
      ctx.stroke();
      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillText('x' + chain.odds, cx + 12, cy - 12);
    }
  }

  // ★ Bug#9: 钓鱼节奏HITTING UI(renderX/Y振荡, 不拉到身旁)
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

        ctx.fillStyle = ghost.color;
        ctx.fillRect(px-M.floor(w/2)+sx, py-M.floor(h/2)+sy, w, h);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(px-3+sx, py-2+sy, 2, 2);
        ctx.fillRect(px+2+sx, py-2+sy, 2, 2);

        // 画链
        ctx.strokeStyle = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
        ctx.lineWidth = chain.isSuper ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.quadraticCurveTo(M.floor((originX+px)/2), M.floor((originY+py)/2)+15, px, py);
        ctx.stroke();

        ctx.font = FS.S + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = CO.COPPER_SHINE;
        ctx.fillText('x' + chain.odds, px, py - M.floor(h/2) - 8);
      }
    }

    ctx.font = FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.GHOST_GREEN;
    ctx.fillText(hitCount + ' 拉扯', W/2, LY.BOTTOM_Y - 10);

    ctx.fillStyle = '#333';
    ctx.fillRect(40, LY.BOTTOM_Y+2, W-80, 6);
    ctx.fillStyle = pr > 0.5 ? CO.COPPER : '#FF4444';
    ctx.fillRect(40, LY.BOTTOM_Y+2, M.floor((W-80)*(1-pr)), 6);
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
      ctx.font = 'bold '+FS.L+'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillText('获得 '+tw+' 币', W/2, 410);
    }
    var roundCoins = State.get('roundCoins');
    if (tw >= roundCoins*5 && tw > 0) {
      ctx.globalAlpha = M.max(0, 0.3*M.sin(progress*M.PI));
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.font = 'bold '+FS.L+'px monospace';
      ctx.fillText('BIG WIN!', W/2, 180);
    }
  }

  function drawSettleUI(t, se) {
    var tw = State.get('totalWin');
    var cp = State.get('settleCoinsPaid');
    drawBackground(t);
    Ghosts.draw(ctx, t);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, LY.HUD_H, W, H-LY.HUD_H);
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText(String(cp).padStart(3,'0'), W/2, 150);
    var results = State.get('roundResult') || [];
    var successes = [];
    for (var i = 0; i < results.length; i++) { if (results[i].success) successes.push(results[i]); }
    var scStart = successes.length > 0 ? (W-(successes.length-1)*55)/2 : 0;
    for (var i = 0; i < successes.length; i++) {
      var r = successes[i], cx = scStart+i*55;
      ctx.fillStyle = CONFIG.GT[r.ghostType].color;
      ctx.fillRect(cx-8, 270, 16, 12);
      ctx.globalAlpha = 0.4+M.sin(t*2.5+i)*0.4;
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(cx-16, 258, 5, 5);
      ctx.fillRect(cx+14, 252, 5, 5);
      ctx.globalAlpha = 1;
    }
  }

  // ── ★ 孟婆奶茶店UI (Bug#7: 缩小商品+放大看板娘) ──
  function drawShopUI(t) {
    var teas = CONFIG.MILK_TEA;
    var coins = State.get('coins');
    var scrollY = ZhongKui.getShopScrollY();

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = CO.BLACK;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // ── 招牌 ──
    ctx.fillStyle = CO.DARK;
    ctx.fillRect(15, 6, W-30, 30);
    ctx.strokeStyle = CO.COPPER_SHINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 7, W-32, 28);
    ctx.font = 'bold '+FS.L+'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('孟婆奶茶', W/2, 28);

    // ── 孟婆看板娘(大区域, Bug#7) ──
    var mpY = 82;
    // 头
    ctx.fillStyle = CO.BONE;
    ctx.beginPath(); ctx.arc(W/2, mpY, 22, 0, M.PI*2); ctx.fill();
    // 头发
    ctx.fillStyle = '#555';
    ctx.fillRect(W/2-22, mpY-22, 44, 14);
    // 眼
    ctx.fillStyle = '#333';
    ctx.fillRect(W/2-10, mpY-4, 5, 5);
    ctx.fillRect(W/2+5, mpY-4, 5, 5);
    // 嘴
    ctx.fillStyle = CO.LANTERN;
    ctx.fillRect(W/2-4, mpY+8, 8, 3);
    // 身
    ctx.strokeStyle = CO.BONE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W/2, mpY+22); ctx.lineTo(W/2, mpY+70); ctx.stroke();
    // 手臂
    ctx.beginPath();
    ctx.moveTo(W/2-24, mpY+48); ctx.lineTo(W/2, mpY+36); ctx.lineTo(W/2+24, mpY+48);
    ctx.stroke();
    // 裙摆
    ctx.fillStyle = CO.BONE;
    ctx.beginPath();
    ctx.moveTo(W/2-30, mpY+95); ctx.lineTo(W/2, mpY+70); ctx.lineTo(W/2+30, mpY+95);
    ctx.fill();

    // 对话气泡
    var line = State.get('mengpoLine');
    var lineTimer = State.get('mengpoLineTimer');
    if (line && lineTimer > 0) {
      ctx.fillStyle = 'rgba(13,13,26,0.9)';
      ctx.fillRect(W/2-95, mpY-42, 190, 24);
      ctx.strokeStyle = CO.CHAIN_GLOW; ctx.lineWidth = 1;
      ctx.strokeRect(W/2-95, mpY-42, 190, 24);
      ctx.font = FS.S+'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.BONE;
      ctx.fillText(line, W/2, mpY-25);
    }

    // ── 柜台 ──
    var counterY = 186;
    ctx.fillStyle = CO.BONE;
    ctx.fillRect(10, counterY, W-20, 2);

    // ── 商品列表(Bug#7: 缩小行高26px, 可滚动) ──
    var productStartY = 196;
    var rowH = 26;
    var visibleTop = productStartY;
    var visibleBot = H - 6;
    var maxScroll = M.max(0, teas.length*rowH + 40 - (visibleBot - visibleTop));
    scrollY = M.max(0, M.min(scrollY, maxScroll));
    ZhongKui.setShopScrollY(scrollY);

    ctx.save();
    ctx.beginPath(); ctx.rect(0, visibleTop, W, visibleBot - visibleTop); ctx.clip();

    for (var i = 0; i < teas.length; i++) {
      var tea = teas[i];
      var ry = productStartY + i*rowH - scrollY;
      if (ry + rowH < visibleTop || ry > visibleBot) continue;
      var canBuy = coins >= tea.price;

      ctx.fillStyle = canBuy ? CO.PANEL : '#0a0a0a';
      ctx.fillRect(8, ry, W-16, rowH-2);

      // 类型色条
      ctx.fillStyle = tea.type==='red'?'#CC3333':tea.type==='green'?'#33CC33':CO.COPPER_SHINE;
      ctx.fillRect(8, ry, 2, rowH-2);

      // Bug#3: 模糊化描述
      ctx.textAlign = 'left';
      ctx.font = FS.S+'px monospace';
      ctx.fillStyle = canBuy ? CO.BONE : '#666';
      ctx.fillText(tea.name + ' ' + ZhongKui.getEffectDesc(tea), 14, ry + 11);

      ctx.textAlign = 'right';
      ctx.fillStyle = canBuy ? CO.COPPER : '#555';
      ctx.fillText(tea.price+'币', W-14, ry + 11);
    }

    // 请孟婆喝一杯
    var treatY = productStartY + teas.length*rowH + 4 - scrollY;
    if (treatY < visibleBot) {
      var canTreat = coins >= CONFIG.MENGPO_TREAT_PRICE;
      ctx.fillStyle = canTreat ? 'rgba(139,0,0,0.4)' : '#0a0a0a';
      ctx.fillRect(8, treatY, W-16, 24);
      ctx.textAlign = 'center';
      ctx.fillStyle = canTreat ? CO.LANTERN : '#666';
      ctx.font = FS.S+'px monospace';
      ctx.fillText('请孟婆喝一杯 ('+CONFIG.MENGPO_TREAT_PRICE+'币)', W/2, treatY+16);
    }
    ctx.restore();

    // 滚动条
    if (maxScroll > 0) {
      var barH = M.max(16, (visibleBot-visibleTop)*(visibleBot-visibleTop)/(teas.length*rowH+40));
      var barY = visibleTop + scrollY/maxScroll*(visibleBot-visibleTop-barH);
      ctx.fillStyle = 'rgba(255,215,0,0.25)';
      ctx.fillRect(W-5, barY, 3, barH);
    }
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
