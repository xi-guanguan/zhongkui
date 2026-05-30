/* main.js — 胶水：初始化 + requestAnimationFrame 主循环
 * 依赖：所有模块
 * 暴露：无(自动执行) */

(function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var CO = CONFIG.CO, LY = CONFIG.LY, FS = CONFIG.FS;
  var canvas, ctx;
  var lastTime = 0;
  var totalTime = 0;

  // ── 初始化 ──
  function init() {
    canvas = document.getElementById('gc');
    ctx = canvas.getContext('2d');
    Renderer.init(canvas);
    Audio.init();
    ZhongKui.init();
    loadSave();
    State.changeStage('MENU');
    console.log('[钟馗] 初始化完成, 分辨率:', W, 'x', H);
  }

  // ── 主循环 ──
  function loop(timestamp) {
    requestAnimationFrame(loop);
    var dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.1) dt = 0.016; // 防止跳帧
    totalTime += dt;

    State.set('time', totalTime);
    State.set('hitTimer', State.get('hitTimer') + dt);

    // 更新
    update(dt);

    // 渲染
    render(dt);
  }

  // ── 更新逻辑 ──
  function update(dt) {
    var stage = State.get('stage');

    // 震屏
    Renderer.updateShake(dt);

    // 粒子
    Renderer.updateParticles(dt);
    Renderer.updateFloatingTexts(dt);

    // 孟婆台词计时
    var lineTimer = State.get('mengpoLineTimer');
    if (lineTimer > 0) State.set('mengpoLineTimer', lineTimer - dt);

    switch(stage) {
      case 'MENU':
        break;

      case 'ROUND':
        // 等待投币输入(ZhongKui处理)
        break;

      case 'PAT':
        Ghosts.update(dt);
        // 拍打阶段2秒后自动进入RESULT
        if (State.get('hitTimer') > 2.0) {
          State.changeStage('RESULT');
          State.set('resultTimer', 0);
          resolveRound();
        }
        break;

      case 'RESULT':
        State.set('resultTimer', State.get('resultTimer') + dt);
        Ghosts.update(dt);
        // 3秒后自动进入SHOP
        if (State.get('resultTimer') > 3.0) {
          State.changeStage('SHOP');
          // 进入商店触发孟婆对话
          State.set('mengpoLine', MengPo.getLine('enter'));
          State.set('mengpoLineTimer', 2.5);
        }
        break;

      case 'SHOP':
        // 空闲3秒触发孟婆闲聊
        break;

      case 'MINING':
        Mining.update(dt);
        break;

      case 'SHOP_BACK':
        break;
    }
  }

  // ── 回合结算 ──
  function resolveRound() {
    var chains = State.get('chains');
    var ghost = State.currentGhost();
    var totalWin = 0;
    var anyCaught = false;

    for (var i = 0; i < chains.length; i++) {
      if (chains[i].caught) {
        anyCaught = true;
        totalWin += chains[i].odds;
      }
    }

    if (anyCaught) {
      State.set('coins', State.get('coins') + totalWin);
      Renderer.spawnFloatingText(W/2, 250, '+' + totalWin + ' 铜钱', CO.COPPER_SHINE);
      Renderer.spawnParticles(W/2, 200, CO.COPPER_SHINE, 10);
      if (totalWin >= 5) {
        Audio.play('bigwin');
        Renderer.triggerShake(10);
      } else {
        Audio.play('catchOk');
      }
      console.log('[结算] 抓到鬼! +' + totalWin + '铜钱');
    } else {
      Audio.play('escape');
      Renderer.spawnFloatingText(W/2, 250, '跑了...', CO.BLOOD);
      console.log('[结算] 鬼跑了');
    }

    // ROI更新
    var betAmount = State.get('betAmount');
    State.updateROI(totalWin / betAmount);

    // buff回合--
    State.tickBuffs();

    // 推进鬼轮番
    State.advanceGhost();

    // 存档
    saveGame();
  }

  // ── 渲染 ──
  function render(dt) {
    var stage = State.get('stage');
    var t = totalTime;

    ctx.save();
    Renderer.applyShake();

    // 打工场景由mining模块独立渲染
    if (stage === 'MINING') {
      Mining.draw(ctx, t);
      Renderer.drawHUD();
      ctx.restore();
      return;
    }

    // 清屏
    Renderer.clear();

    // ── 场景背景(色块占位) ──
    drawBackground(t);

    // ── 鬼 ──
    if (stage === 'ROUND' || stage === 'PAT' || stage === 'RESULT') {
      Ghosts.draw(ctx, t);
    }

    // ── 钟馗 ──
    ZhongKui.draw(ctx, t);

    // ── 粒子 ──
    Renderer.drawParticles();
    Renderer.drawFloatingTexts();

    // ── 场景专属UI ──
    switch(stage) {
      case 'MENU':
        drawMenu();
        break;
      case 'ROUND':
        Renderer.drawCoinSelector();
        Renderer.drawBottomBar();
        break;
      case 'PAT':
        drawPatUI();
        break;
      case 'RESULT':
        drawResultUI();
        break;
      case 'SHOP':
        drawShopUI();
        break;
    }

    // ── HUD ──
    Renderer.drawHUD();
    Renderer.drawMengpoLine();

    ctx.restore();
  }

  // ── 背景渲染(极简色块) ──
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

  // ── 菜单 ──
  function drawMenu() {
    ctx.font = 'bold ' + FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('黑笑话：钟馗', W/2, 180);
    ctx.font = FS.M + 'px monospace';
    ctx.fillStyle = CO.BONE;
    ctx.fillText('点击开始', W/2, 250);
    Renderer.drawBottomBar();
  }

  // ── 拍打阶段UI ──
  function drawPatUI() {
    var hitCount = State.get('hitCount');
    ctx.font = FS.L + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.GHOST_GREEN;
    ctx.fillText('拍! x' + hitCount, W/2, LY.BOTTOM_Y - 10);

    // 进度条(纯装饰)
    var prog = Math.min(1, State.get('hitTimer') / 2.0);
    ctx.fillStyle = '#333';
    ctx.fillRect(40, LY.BOTTOM_Y + 2, W - 80, 6);
    ctx.fillStyle = CO.GHOST_GREEN;
    ctx.fillRect(40, LY.BOTTOM_Y + 2, (W - 80) * prog, 6);
  }

  // ── 结果UI ──
  function drawResultUI() {
    var chains = State.get('chains');
    var y = LY.ZHONGKUI_Y - 30;
    ctx.font = FS.M + 'px monospace';
    ctx.textAlign = 'center';

    for (var i = 0; i < chains.length; i++) {
      var c = chains[i];
      var label = c.caught ? ('链' + (i+1) + ': x' + c.odds) : ('链' + (i+1) + ': 断');
      ctx.fillStyle = c.caught ? CO.COPPER_SHINE : CO.BLOOD;
      ctx.fillText(label, W/2, y + i * 20);
    }
    Renderer.drawBottomBar();
  }

  // ── 商店UI (双列紧凑布局，适配320×480) ──
  function drawShopUI() {
    var teas = CONFIG.MILK_TEA;
    var coins = State.get('coins');

    ctx.font = FS.M + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.LANTERN;
    ctx.fillText('— 孟婆奶茶 —', W/2, 60);

    // 双列布局: 左5种奶红+特调, 右5种奶绿+特调
    var colW = 145, rowH = 50;
    var startY = 78;
    var leftX = 8, rightX = W/2 + 5;

    for (var i = 0; i < teas.length; i++) {
      var tea = teas[i];
      var col = i < 5 ? 0 : 1;
      var row = i < 5 ? i : i - 5;
      var tx = col === 0 ? leftX : rightX;
      var ty = startY + row * rowH;
      var canBuy = coins >= tea.price;

      // 条目背景
      ctx.fillStyle = canBuy ? 'rgba(44,27,61,0.8)' : 'rgba(30,30,30,0.5)';
      ctx.fillRect(tx, ty, colW - 4, rowH - 4);
      ctx.strokeStyle = canBuy ? CO.FOG : '#222';
      ctx.strokeRect(tx, ty, colW - 4, rowH - 4);

      // 名称
      ctx.textAlign = 'left';
      ctx.fillStyle = canBuy ? CO.BONE : '#666';
      ctx.font = FS.S + 'px monospace';
      ctx.fillText(tea.name, tx + 4, ty + 15);

      // 效果
      var effect = '';
      if (tea.type === 'red') effect = '+' + (tea.catchBonus*100).toFixed(0) + '% ' + tea.duration + '局';
      else if (tea.type === 'green') effect = '赔+' + tea.oddsBonus + ' ' + tea.duration + '局';
      else if (tea.type === 'special_catch') effect = '锁定 ' + tea.duration + '局';
      else if (tea.type === 'special_super') effect = 'x10 ' + tea.duration + '局';
      ctx.fillStyle = canBuy ? '#AAA' : '#444';
      ctx.fillText(effect, tx + 4, ty + 30);

      // 价格
      ctx.textAlign = 'right';
      ctx.fillStyle = canBuy ? CO.COPPER : '#555';
      ctx.fillText(tea.price + '币', tx + colW - 10, ty + 30);
    }

    // 请孟婆喝一杯
    var treatY = startY + 5 * rowH + 5;
    var canTreat = coins >= CONFIG.MENGPO_TREAT_PRICE;
    ctx.fillStyle = canTreat ? 'rgba(139,0,0,0.4)' : 'rgba(30,30,30,0.5)';
    ctx.fillRect(W/2 - 150, treatY, 300, 36);
    ctx.textAlign = 'center';
    ctx.fillStyle = canTreat ? CO.LANTERN : '#666';
    ctx.font = FS.S + 'px monospace';
    ctx.fillText('请孟婆喝一杯 (' + CONFIG.MENGPO_TREAT_PRICE + '币)', W/2, treatY + 22);

    Renderer.drawBottomBar();
  }

  // ── 存档 ──
  function saveGame() {
    try {
      var data = {
        coins: State.get('coins'),
        favor: State.get('favor'),
        buffs: State.get('buffs'),
        currentGhostIdx: State.get('currentGhostIdx'),
        lockedGhostIdx: State.get('lockedGhostIdx'),
        lockedRounds: State.get('lockedRounds'),
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
      if (typeof data.currentGhostIdx === 'number') State.set('currentGhostIdx', data.currentGhostIdx);
      if (typeof data.lockedGhostIdx === 'number') State.set('lockedGhostIdx', data.lockedGhostIdx);
      if (typeof data.lockedRounds === 'number') State.set('lockedRounds', data.lockedRounds);
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
})();
