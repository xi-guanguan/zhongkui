/* main.js — 胶水：初始化 + requestAnimationFrame 主循环
 * 阶段流程迁移套牛: IDLE→RUNNING→LASSO→HITTING→RESULT→SETTLE
 * 投币机制迁移套牛: 底部按钮投币+开始, 鬼群跑过观察后自动丢链
 * 依赖：所有模块
 * 暴露：无(自动执行) */

(function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var CO = CONFIG.CO, LY = CONFIG.LY, FS = CONFIG.FS;
  var canvas, ctx;
  var lastTime = 0;
  var totalTime = 0;
  var frameCount = 0;  // 帧计数 (同套牛fr)

  // ── 初始化 ──
  function init() {
    canvas = document.getElementById('gc');
    ctx = canvas.getContext('2d');
    Renderer.init(canvas);
    Audio.init();
    loadSave();       // ★ 先加载存档
    ZhongKui.init();
    State.changeStage('IDLE');
    console.log('[钟馗] 初始化完成, 分辨率:', W, 'x', H, '铜钱:', State.get('coins'));
  }

  // ── 主循环 ──
  function loop(timestamp) {
    requestAnimationFrame(loop);
    var dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.1) dt = 0.016;
    totalTime += dt;
    frameCount++;

    State.set('time', totalTime);

    // 更新
    update(dt);

    // 渲染
    render(dt);
  }

  // ── 更新逻辑 (同套牛update) ──
  function update(dt) {
    var stage = State.get('stage');

    // 震屏+粒子+飘字
    Renderer.updateShake(dt);
    Renderer.updateParticles(dt);
    Renderer.updateFloatingTexts(dt);

    // 孟婆台词计时
    var lineTimer = State.get('mengpoLineTimer');
    if (lineTimer > 0) State.set('mengpoLineTimer', lineTimer - dt);

    // 商店时不更新游戏逻辑
    if (State.get('shopOpen')) return;

    switch(stage) {
      case 'IDLE':
        // 待机: 鬼群持续在背景跑过 (同套牛IDLE)
        Ghosts.update(dt);
        break;

      case 'RUNNING':
        // 鬼群跑过: 更新鬼位置 (同套牛RUNNING)
        Ghosts.update(dt);

        var subPhase = State.get('runningSubPhase');
        if (subPhase === 'OBSERVE') {
          var obsTimer = State.get('observeTimer') - dt;
          State.set('observeTimer', obsTimer);
          // 全部进入屏幕内才切换
          var allIn = Ghosts.allVisible();
          if (obsTimer <= 0 || allIn) {
            State.set('runningSubPhase', 'COUNTDOWN');
          }
        } else {
          var cdTimer = State.get('countdownTimer') - dt;
          State.set('countdownTimer', cdTimer);
          if (cdTimer <= 0) {
            doLasso();  // 倒计时结束，自动丢链 (同套牛doLasso)
          }
        }
        break;

      case 'LASSO':
        // 丢链动画0.5秒 (同套牛LASSO)
        var st = State.get('stageTimer') + dt;
        State.set('stageTimer', st);
        Ghosts.update(dt);
        if (st >= 0.5) {
          State.changeStage('HITTING');
          State.set('hitCount', 0);
          State.set('hitTimer', 0);
        }
        break;

      case 'HITTING':
        // 拍打阶段 (同套牛HITTING)
        var hitTimer = State.get('hitTimer') + dt;
        State.set('hitTimer', hitTimer);
        Ghosts.update(dt);
        if (hitTimer >= State.get('hitMax')) {
          doCalc();  // 拍打时间到，判定 (同套牛calc)
        }
        break;

      case 'RESULT':
        // 判定动画3.5秒 (同套牛RESULT)
        var rt = State.get('stageTimer') + dt;
        State.set('stageTimer', rt);
        Ghosts.update(dt);
        if (rt >= 3.5) {
          State.changeStage('SETTLE');
          State.set('settleCoinsPaid', 0);
          // 计算总赢得
          var tw = 0;
          var results = State.get('roundResult') || [];
          for (var i = 0; i < results.length; i++) {
            if (results[i].success) tw += results[i].odds;
          }
          State.set('totalWin', tw);
        }
        break;

      case 'SETTLE':
        // 结算 (同套牛SETTLE)
        break;

      case 'MINING':
        Mining.update(dt);
        break;
    }
  }

  // ── 丢链 (同套牛doLasso) ──
  function doLasso() {
    if (State.get('stage') !== 'RUNNING') return;
    State.changeStage('LASSO');
    Audio.play('chain');

    // 套链目标: 屏幕内所有可见鬼，按距中央排序 (同套牛doLasso)
    var roundCoins = State.get('roundCoins');
    var targets = Ghosts.getTargets(roundCoins);

    // 构建链 (同套牛ropes)
    var chains = [];
    for (var i = 0; i < targets.length; i++) {
      var g = targets[i];
      chains.push({
        targetGhost: g,
        targetX: g.x,
        targetY: g.y,
        odds: g.odds,
        ghostType: g.type,
        caught: false,
        isSuper: false
      });
    }
    // 杨枝甘露: 第1条链x10概率
    var buffs = State.get('buffs');
    if (buffs.special_super && chains.length > 0) {
      chains[0].isSuper = true;
    }

    State.set('chains', chains);
  }

  // ── 拍打 (同套牛doHit) ──
  function doHit() {
    if (State.get('stage') !== 'HITTING') return;
    State.set('hitCount', State.get('hitCount') + 1);
    Audio.play('hit');
    Renderer.triggerShake(1);
  }

  // ── 判定 (同套牛calc) ──
  function doCalc() {
    State.changeStage('RESULT');
    var chains = State.get('chains');

    // 判定: catchP此时才骰 (同套牛calc: M.random()<p)
    var results = Physics.resolveChains(chains);
    State.set('roundResult', results.details);

    var totalWin = results.totalWin;
    var anyCaught = results.anyCaught;

    if (anyCaught) {
      State.set('coins', State.get('coins') + totalWin);
      Renderer.spawnFloatingText(W/2, 200, '+' + totalWin + ' 铜钱', CO.COPPER_SHINE);
      Renderer.spawnParticles(W/2, 180, CO.COPPER_SHINE, 10);
      var roundCoins = State.get('roundCoins');
      if (totalWin >= roundCoins * 5) {
        Audio.play('bigwin');
        Renderer.triggerShake(10);
      } else {
        Audio.play('catchOk');
      }
    } else {
      Audio.play('escape');
      Renderer.spawnFloatingText(W/2, 200, '跑了...', CO.BLOOD);
    }

    // ROI记录 (同套牛payoutHistory)
    State.updateROI({ spent: State.get('roundCoins'), won: totalWin });

    // buff回合--
    State.tickBuffs();

    // 投币清零 (同套牛GS.coinsInserted=0)
    State.set('coinsInserted', 0);
  }

  // ── 结算完成回到待机 (同套牛doSettle) ──
  function doSettle() {
    if (State.get('stage') !== 'SETTLE') return;
    var tw = State.get('totalWin');
    var se = State.get('stageTimer');
    var cp = State.get('settleCoinsPaid');
    if (cp < tw && se < tw / 10 + 0.5) return;

    State.changeStage('IDLE');
    State.set('roundResult', null);
    State.set('chains', []);
    State.set('totalWin', 0);
    State.set('settleCoinsPaid', 0);
    // 存档
    saveGame();
  }

  // ── 渲染 ──
  function render(dt) {
    var stage = State.get('stage');
    var t = totalTime;
    var se = State.get('stageTimer');

    ctx.save();
    Renderer.applyShake();

    // 商店覆盖渲染
    if (State.get('shopOpen')) {
      drawBackground(t);
      Ghosts.draw(ctx, t);
      drawShopUI();
      Renderer.drawHUD();
      ctx.restore();
      return;
    }

    // 打工场景
    if (stage === 'MINING') {
      Mining.draw(ctx, t);
      Renderer.drawHUD();
      ctx.restore();
      return;
    }

    // 清屏+背景
    Renderer.clear();
    drawBackground(t);

    // ── 鬼 ──
    if (stage !== 'MINING') {
      Ghosts.draw(ctx, t);
    }

    // ── 钟馗 ──
    ZhongKui.draw(ctx, t);

    // ── 粒子 ──
    Renderer.drawParticles();
    Renderer.drawFloatingTexts();

    // ── 阶段专属UI (同套牛switch) ──
    switch(stage) {
      case 'IDLE':
        drawIdleUI(t);
        break;
      case 'RUNNING':
        drawRunningUI(t, se);
        break;
      case 'LASSO':
        drawLassoUI(t, M.min(se / 0.5, 1));
        break;
      case 'HITTING':
        drawHittingUI(t, se);
        break;
      case 'RESULT':
        drawResultUI(t, M.min(se / 3.5, 1));
        break;
      case 'SETTLE':
        drawSettleUI(t, se);
        break;
    }

    // ── HUD ──
    Renderer.drawHUD();
    Renderer.drawMengpoLine();

    ctx.restore();
  }

  // ── 背景渲染 ──
  function drawBackground(t) {
    // 天空
    ctx.fillStyle = CO.DUSK;
    ctx.fillRect(0, LY.HUD_H, W, LY.SKY_H);
    // 竞技场
    ctx.fillStyle = '#180E22';
    ctx.fillRect(0, LY.ARENA_Y, W, LY.ARENA_H);
    // 钟馗区
    ctx.fillStyle = CO.FOG;
    ctx.fillRect(0, LY.ZHONGKUI_Y - 20, W, 40);
    // 底区
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(0, LY.BOTTOM_Y - 20, W, LY.BOTTOM_H + 20);
  }

  // ── 待机UI (线框图: 画布内显示标题+提示，投币选择器在zhongkui.js) ──
  function drawIdleUI(t) {
    var inserted = State.get('coinsInserted');
    var coins = State.get('coins');

    // 标题 (线框图: 游戏演出区中央)
    ctx.font = 'bold ' + FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('黑笑话：钟馗', W/2, 180);

    if (ZhongKui.isCoinSelectorOpen()) {
      // 投币选择器打开中
      ctx.font = FS.M + 'px monospace';
      ctx.fillStyle = CO.BONE;
      ctx.fillText('选择投币数后按「确认」', W/2, 220);

      // 渲染投币选择器
      ZhongKui.drawCoinSelector(ctx, t);
    } else {
      // 未投币: 提示按主操作按钮
      ctx.font = FS.M + 'px monospace';
      ctx.fillStyle = CO.BONE;
      ctx.fillText('按「投币」开始游戏', W/2, 220);
      ctx.font = FS.S + 'px monospace';
      ctx.fillStyle = '#A0A0C0';
      ctx.fillText('持有 ' + coins + ' 铜钱', W/2, 244);

      // 打工入口 (线框图: 游戏演出区下方)
      var workBtnX = W/2 - 50, workBtnY = 360, workBtnW = 100, workBtnH = 28;
      ctx.fillStyle = '#1B1B3A';
      ctx.fillRect(workBtnX, workBtnY, workBtnW, workBtnH);
      ctx.strokeStyle = '#3A3A6A';
      ctx.lineWidth = 2;
      ctx.strokeRect(workBtnX + 1, workBtnY + 1, workBtnW - 2, workBtnH - 2);
      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.COPPER;
      ctx.fillText('打工赚币', W/2, workBtnY + 18);
    }
  }

  // ── 鬼群跑过UI (同套牛sRun) ──
  function drawRunningUI(t, se) {
    var subPhase = State.get('runningSubPhase');
    if (subPhase === 'COUNTDOWN') {
      var cdTimer = State.get('countdownTimer');
      var sec = M.ceil(cdTimer);
      var pl = 1 + (cdTimer % 1 < 0.3 ? 0.15 : 0);
      ctx.globalAlpha = 0.6 + (cdTimer % 1 < 0.5 ? 0.3 : 0);
      ctx.font = 'bold ' + M.floor(FS.L * pl) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF4444';
      ctx.fillText(String(sec), W/2, 350);
      ctx.globalAlpha = 1;
      // 倒计时边框闪烁
      if (M.floor(t * 10) % 2 === 0) {
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, W - 4, 4);
        ctx.strokeRect(2, H - 6, W - 4, 4);
      }
    } else {
      ctx.globalAlpha = 0.4 + M.sin(t * 6) * 0.2;
      ctx.font = FS.M + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.BONE;
      ctx.fillText('观察鬼群中...', W/2, 350);
      ctx.globalAlpha = 1;
    }

    // 底部提示
    ctx.font = FS.S + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER;
    ctx.fillText('投币 ' + State.get('roundCoins') + ' 链', W/2, LY.BOTTOM_Y + 30);
  }

  // ── 丢链动画 (同套牛sLasso) ──
  function drawLassoUI(t, progress) {
    var chains = State.get('chains');
    if (!chains) return;

    // 命中瞬间震屏 (同套牛)
    if (progress > 0.95) Renderer.triggerShake(3);

    // 链飞出减速 (同套牛outQuad)
    var ep = progress * (2 - progress);  // outQuad

    var originX = W / 2;
    var originY = LY.ZHONGKUI_Y;

    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      var tg = chain.targetGhost;
      var tx, ty2;
      if (tg) { tx = tg.x; ty2 = tg.y; }
      else { tx = chain.targetX; ty2 = chain.targetY; }

      // 链端点 (飞向目标)
      var cx = originX + M.floor((tx - originX) * ep);
      var cy = originY + M.floor((ty2 - originY) * ep) - M.floor(M.sin(ep * M.PI) * 50);

      // 画链 (同套牛rope: 二次贝塞尔)
      var chainColor = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
      ctx.strokeStyle = chainColor;
      ctx.lineWidth = chain.isSuper ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      var midX = M.floor((originX + cx) / 2);
      var midY = M.floor((originY + cy) / 2) + 20;
      ctx.quadraticCurveTo(midX, midY, cx, cy);
      ctx.stroke();

      // 赔率标签
      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillText('x' + chain.odds, cx + 12, cy - 12);
    }
  }

  // ── 拍打UI (同套牛sHit) ──
  function drawHittingUI(t, se) {
    var chains = State.get('chains');
    var hitTimer = State.get('hitTimer');
    var hitMax = State.get('hitMax');
    var pr = M.min(hitTimer / hitMax, 1);

    // 半透明遮罩 (同套牛)
    ctx.fillStyle = 'rgba(26,10,0,0.35)';
    ctx.fillRect(0, LY.HUD_H, W, H - LY.HUD_H);

    // 画链+被套住的鬼(挣扎)
    var originX = W / 2;
    var originY = LY.ZHONGKUI_Y;
    var pullProgress = pr;  // 拉近进度

    if (chains) {
      for (var i = 0; i < chains.length; i++) {
        var chain = chains[i];
        var tg = chain.targetGhost;
        if (!tg) continue;

        // 被拉近的效果
        var px = M.floor(tg.x - (tg.x - originX) * pullProgress);
        var py = tg.y;

        // 画鬼(挣扎态)
        var ghost = CONFIG.GT[tg.type];
        var w = ghost.size[0], h = ghost.size[1];
        ctx.fillStyle = ghost.color;
        ctx.fillRect(px - w / 2, py - h / 2, w, h);
        // 挣扎眼
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(px - 3, py - 2, 2, 2);
        ctx.fillRect(px + 2, py - 2, 2, 2);

        // 画链
        var chainColor = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
        ctx.strokeStyle = chainColor;
        ctx.lineWidth = chain.isSuper ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        var midX = M.floor((originX + px) / 2);
        var midY = M.floor((originY + py) / 2) + 15;
        ctx.quadraticCurveTo(midX, midY, px, py);
        ctx.stroke();

        // 赔率
        ctx.font = FS.S + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = CO.COPPER_SHINE;
        ctx.fillText('x' + chain.odds, px, py - h / 2 - 8);
      }
    }

    // 拍打提示
    var hitCount = State.get('hitCount');
    ctx.font = FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.GHOST_GREEN;
    ctx.fillText(hitCount + ' 连击', W/2, LY.BOTTOM_Y - 10);

    // 进度条
    ctx.fillStyle = '#333';
    ctx.fillRect(40, LY.BOTTOM_Y + 2, W - 80, 6);
    ctx.fillStyle = pr > 0.5 ? CO.COPPER : '#FF4444';
    ctx.fillRect(40, LY.BOTTOM_Y + 2, M.floor((W - 80) * (1 - pr)), 6);
  }

  // ── 判定动画 (同套牛sResult) ──
  function drawResultUI(t, progress) {
    var results = State.get('roundResult') || [];
    var tw = 0;
    var successes = [], failures = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].success) { tw += results[i].odds; successes.push(results[i]); }
      else failures.push(results[i]);
    }

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, LY.HUD_H, W, H - LY.HUD_H);

    // 成功: 落地动画
    for (var i = 0; i < successes.length; i++) {
      var r = successes[i];
      var lp = M.min(1, progress * 1.5 - i * 0.15);
      if (lp <= 0) continue;

      var n = successes.length;
      var startX = 160, startY = 240;
      var endX = 160 - (n - 1) * 28 + i * 56;
      var endY = 300;

      // 弹跳落地 (同套牛outBounce)
      var bounce = lp < 0.5 ? 2 * lp * lp : 1 - M.pow(-2 * lp + 2, 2) / 2;
      var px = startX + (endX - startX) * bounce;
      var py = startY + (endY - startY) * bounce - M.sin(lp * M.PI) * 90;

      // 画鬼
      var ghost = CONFIG.GT[r.ghostType];
      var w = ghost.size[0], h = ghost.size[1];
      ctx.fillStyle = ghost.color;
      ctx.fillRect(M.floor(px - w / 2), M.floor(py - h / 2), w, h);
      // 眩晕眼
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(M.floor(px - 3), M.floor(py - 2), 2, 2);
      ctx.fillRect(M.floor(px + 2), M.floor(py - 2), 2, 2);

      // 赔率
      ctx.font = FS.M + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = CO.GHOST_GREEN;
      ctx.fillText('x' + r.odds, M.floor(px + 22), M.floor(py - 20));
      ctx.font = FS.S + 'px monospace';
      ctx.fillStyle = CO.BONE;
      ctx.fillText(ghost.name, M.floor(px + 22), M.floor(py - 8));
    }

    // 失败: 逃跑
    for (var i = 0; i < failures.length; i++) {
      var r = failures[i];
      var ep = M.min(1, progress * 1.2 - i * 0.1);
      if (ep <= 0) continue;
      var fx = 290 * ep;
      var fy = 230 + i * 28;

      var ghost = CONFIG.GT[r.ghostType];
      var w = ghost.size[0], h = ghost.size[1];
      ctx.fillStyle = ghost.color;
      ctx.fillRect(M.floor(fx - w / 2), M.floor(fy - h / 2), w, h);
      // 嘲讽眼
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(M.floor(fx - 3), M.floor(fy - 2), 2, 2);
      ctx.fillRect(M.floor(fx + 2), M.floor(fy - 2), 2, 2);

      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF4444';
      ctx.fillText(ghost.name + ' 逃脱', 150, M.floor(fy));
    }

    // 总赢得
    ctx.font = 'bold ' + FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('获得 ' + tw + ' 币', W/2, 410);

    // Big Win (同套牛)
    var roundCoins = State.get('roundCoins');
    if (tw >= roundCoins * 5 && tw > 0) {
      ctx.globalAlpha = M.max(0, 0.3 * M.sin(progress * M.PI));
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.font = 'bold ' + FS.L + 'px monospace';
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillText('BIG WIN!', W/2, 180);
    }
  }

  // ── 结算UI (同套牛sSettle) ──
  function drawSettleUI(t, se) {
    var tw = State.get('totalWin');
    var results = State.get('roundResult') || [];
    var cp = M.min(tw, M.floor(se * 10));
    State.set('settleCoinsPaid', cp);

    // 背景
    drawBackground(t);
    Ghosts.draw(ctx, t);

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, LY.HUD_H, W, H - LY.HUD_H);

    // 金币数字
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText(String(cp).padStart(3, '0'), W/2, 150);

    // 成功的鬼
    var successes = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].success) successes.push(results[i]);
    }
    var scStart = successes.length > 0 ? (W - (successes.length - 1) * 55) / 2 : 0;
    for (var i = 0; i < successes.length; i++) {
      var r = successes[i];
      var cx = scStart + i * 55;
      var ghost = CONFIG.GT[r.ghostType];
      ctx.fillStyle = ghost.color;
      ctx.fillRect(cx - 8, 270, 16, 12);
      // 闪光
      ctx.globalAlpha = 0.4 + M.sin(t * 2.5 + i) * 0.4;
      ctx.fillStyle = CO.COPPER_SHINE;
      ctx.fillRect(cx - 16, 258, 5, 5);
      ctx.fillRect(cx + 14, 252, 5, 5);
      ctx.globalAlpha = 1;
    }

    // 继续
    if (cp >= tw && se > tw / 10 + 0.5) {
      ctx.font = FS.M + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#888';
      ctx.fillText('点击继续', W/2, 400);
    }
  }

  // ── 孟婆商店UI (独立覆盖, 同套牛drawShop) ──
  function drawShopUI() {
    var teas = CONFIG.MILK_TEA;
    var coins = State.get('coins');

    // 半透明遮罩 (同套牛)
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = CO.BLACK;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // 标题栏
    ctx.fillStyle = CO.DARK;
    ctx.fillRect(10, 20, W - 20, 30);
    ctx.fillStyle = CO.CHAIN;
    ctx.fillRect(10, 52, W - 20, 2);
    ctx.font = 'bold ' + FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('孟婆奶茶', W/2, 26);

    // 双列列表
    var colW = 145, rowH = 50;
    var startY = 60;
    var leftX = 8, rightX = W / 2 + 5;

    for (var i = 0; i < teas.length; i++) {
      var tea = teas[i];
      var col = i < 5 ? 0 : 1;
      var row = i < 5 ? i : i - 5;
      var tx = col === 0 ? leftX : rightX;
      var ty = startY + row * rowH;
      var canBuy = coins >= tea.price;

      ctx.fillStyle = canBuy ? CO.DARK : '#0a0a0a';
      ctx.fillRect(tx, ty, colW - 4, rowH - 4);
      // 类型指示条
      ctx.fillStyle = tea.type === 'red' ? '#CC3333' : tea.type === 'green' ? '#33CC33' : CO.COPPER_SHINE;
      ctx.fillRect(tx, ty, 2, rowH - 4);

      ctx.textAlign = 'left';
      ctx.font = FS.S + 'px monospace';
      ctx.fillStyle = canBuy ? CO.BONE : '#666';
      ctx.fillText(tea.name, tx + 6, ty + 15);

      var effect = '';
      if (tea.type === 'red') effect = '+' + (tea.catchBonus * 100).toFixed(0) + '% ' + tea.duration + '局';
      else if (tea.type === 'green') effect = '赔+' + tea.oddsBonus + ' ' + tea.duration + '局';
      else if (tea.type === 'special_catch') effect = '锁定 ' + tea.duration + '局';
      else if (tea.type === 'special_super') effect = 'x10 ' + tea.duration + '局';
      ctx.fillStyle = canBuy ? '#AAA' : '#444';
      ctx.fillText(effect, tx + 6, ty + 30);

      ctx.textAlign = 'right';
      ctx.fillStyle = canBuy ? CO.COPPER : '#555';
      ctx.fillText(tea.price + '币', tx + colW - 10, ty + 30);
    }

    // 请孟婆喝一杯
    var treatY = startY + 5 * rowH + 5;
    var canTreat = coins >= CONFIG.MENGPO_TREAT_PRICE;
    ctx.fillStyle = canTreat ? 'rgba(139,0,0,0.4)' : '#0a0a0a';
    ctx.fillRect(W / 2 - 150, treatY, 300, 36);
    ctx.textAlign = 'center';
    ctx.fillStyle = canTreat ? CO.LANTERN : '#666';
    ctx.font = FS.S + 'px monospace';
    ctx.fillText('请孟婆喝一杯 (' + CONFIG.MENGPO_TREAT_PRICE + '币)', W/2, treatY + 22);

    // 关闭提示
    ctx.globalAlpha = 0.5 + M.sin(totalTime * 3) * 0.3;
    ctx.fillStyle = '#888';
    ctx.fillText('点击空白处关闭', W/2, H - 30);
    ctx.globalAlpha = 1;
  }

  // ── 存档 ──
  function saveGame() {
    try {
      var data = {
        coins: State.get('coins'),
        favor: State.get('favor'),
        buffs: State.get('buffs'),
        roiHistory: State.get('roiHistory')
      };
      localStorage.setItem('zhongkui_save', JSON.stringify(data));
    } catch(e) {}
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem('zhongkui_save');
      if (!raw) {
        State.set('coins', CONFIG.START_COINS);
        return;
      }
      var data = JSON.parse(raw);
      if (typeof data.coins === 'number') State.set('coins', data.coins);
      if (data.favor) State.set('favor', data.favor);
      if (data.buffs) State.set('buffs', data.buffs);
      if (data.roiHistory) State.set('roiHistory', data.roiHistory);
    } catch(e) {
      State.set('coins', CONFIG.START_COINS);
    }
  }

  // ── 启动 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); requestAnimationFrame(loop); });
  } else {
    init();
    requestAnimationFrame(loop);
  }

  // ── 暴露给ZhongKui模块用的方法 ──
  window._GameAPI = {
    doHit: doHit,
    doSettle: doSettle,
  };
})();
