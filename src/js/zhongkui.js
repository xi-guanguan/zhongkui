/* zhongkui.js — 钟馗控制：输入、动画、技能
 * 链机制迁移套牛: 多条链分别指向不同目标鬼
 * 依赖：CONFIG, State, Renderer, Audio
 * 暴露：ZhongKui (全局) */

var ZhongKui = (function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var LY = CONFIG.LY, CO = CONFIG.CO;

  // ── 钟馗位置 ──
  var x = W/2;
  var y = LY.ZHONGKUI_Y;

  // ── 输入状态 ──
  var tapTarget = null;

  function init() {
    var touchLayer = document.getElementById('touch-layer');
    if (touchLayer) {
      touchLayer.addEventListener('touchstart', onTouch, {passive:false});
      touchLayer.addEventListener('mousedown', onMouse);
    }
  }

  function onTouch(e) {
    e.preventDefault();
    var rect = e.target.getBoundingClientRect();
    var tx = (e.touches[0].clientX - rect.left) / rect.width * W;
    var ty = (e.touches[0].clientY - rect.top) / rect.height * H;
    handleTap(tx, ty);
  }

  function onMouse(e) {
    var rect = e.target.getBoundingClientRect();
    var tx = (e.clientX - rect.left) / rect.width * W;
    var ty = (e.clientY - rect.top) / rect.height * H;
    handleTap(tx, ty);
  }

  function handleTap(tx, ty) {
    var stage = State.get('stage');
    tapTarget = {x:tx, y:ty};

    switch(stage) {
      case 'MENU':
        State.changeStage('ROUND');
        Audio.play('btn');
        break;
      case 'ROUND':
        handleRoundTap(tx, ty);
        break;
      case 'PAT':
        // 拍打(纯表演)
        State.set('hitCount', State.get('hitCount') + 1);
        Audio.play('hit');
        Renderer.triggerShake(4);
        break;
      case 'RESULT':
        State.changeStage('SHOP');
        Audio.play('btn');
        break;
      case 'SHOP':
        handleShopTap(tx, ty);
        break;
      case 'MINING':
        if (typeof Mining !== 'undefined') Mining.onTap(tx, ty);
        break;
      case 'SHOP_BACK':
        State.changeStage('ROUND');
        Audio.play('btn');
        break;
    }
  }

  // ── 投币选择+确认 ──
  function handleRoundTap(tx, ty) {
    var bottomY = LY.BOTTOM_Y;
    if (ty > bottomY && ty < bottomY + 50) {
      for (var i = 1; i <= 5; i++) {
        var bx = 65 + (i-1)*48;
        if (tx > bx && tx < bx + 42) {
          var bet = State.get('betAmount');
          if (i === bet) {
            startRound();
          } else {
            State.set('betAmount', i);
            Audio.play('coin');
          }
          return;
        }
      }
      if (tx > W/2 - 50 && tx < W/2 + 50 && ty > bottomY + 40) {
        startRound();
      }
    }
  }

  function startRound() {
    var bet = State.get('betAmount');
    var coins = State.get('coins');
    if (coins < bet) {
      State.changeStage('SHOP');
      return;
    }
    State.set('coins', coins - bet);

    // 获取链目标鬼 (同套牛doLasso: 按距中央排序取前bet个)
    var targets = Ghosts.getTargets(bet);

    // 构建链 (同套牛doLasso构建ropes)
    var chains = [];
    for (var i = 0; i < targets.length; i++) {
      var g = targets[i];
      var ghostType = CONFIG.GT[g.type];
      chains.push({
        targetGhost: g,         // 引用鬼队列中的鬼对象
        targetX: g.x,
        targetY: g.y,
        odds: g.odds,
        ghostType: g.type,
        caught: false,           // PAT阶段未知，RESULT阶段才骰
        isSuper: false
      });
    }
    // 杨枝甘露: 第1条链x10概率
    var buffs = State.get('buffs');
    if (buffs.special_super && chains.length > 0) {
      chains[0].isSuper = true;
    }

    State.set('chains', chains);
    Ghosts.initRound();  // 重新生成鬼队列
    State.changeStage('PAT');
    State.set('hitCount', 0);
    State.set('hitTimer', 0);
    Audio.play('chain');
  }

  // ── 商店点击 ──
  function handleShopTap(tx, ty) {
    var bottomY = LY.BOTTOM_Y;
    if (tx < W/2 && ty > bottomY) {
      State.changeStage('MINING');
      if (typeof Mining !== 'undefined') Mining.start();
      Audio.play('btn');
      return;
    }
    if (tx >= W/2 && ty > bottomY) {
      State.changeStage('ROUND');
      Audio.play('btn');
      return;
    }
    handleMilkTeaTap(tx, ty);
  }

  function handleMilkTeaTap(tx, ty) {
    var teas = CONFIG.MILK_TEA;
    var startY = 78;
    var colW = 145, rowH = 50;
    var leftX = 8, rightX = W/2 + 5;

    for (var i = 0; i < teas.length; i++) {
      var col = i < 5 ? 0 : 1;
      var row = i < 5 ? i : i - 5;
      var rx = col === 0 ? leftX : rightX;
      var ry = startY + row * rowH;
      if (ty > ry && ty < ry + rowH - 4 && tx > rx && tx < rx + colW - 4) {
        buyTea(teas[i]);
        return;
      }
    }
    var treatY = startY + 5 * rowH + 5;
    if (ty > treatY && ty < treatY + 36 && tx > W/2 - 150 && tx < W/2 + 150) {
      buyMengpoTreat();
    }
  }

  function buyTea(tea) {
    var coins = State.get('coins');
    if (coins < tea.price) {
      Renderer.spawnFloatingText(W/2, 300, '铜钱不足!', '#FF4444');
      return;
    }
    State.set('coins', coins - tea.price);
    var buffs = State.get('buffs');
    switch(tea.type) {
      case 'red':
        buffs.red = { value: tea.catchBonus, remaining: tea.duration };
        break;
      case 'green':
        buffs.green = { value: tea.oddsBonus, remaining: tea.duration };
        break;
      case 'special_catch':
        var lockedIdx = Math.floor(Math.random() * CONFIG.GT.length);
        buffs.special_catch = { lockedIdx: lockedIdx, remaining: tea.duration };
        State.set('lockedGhostIdx', lockedIdx);
        State.set('lockedRounds', tea.duration);
        break;
      case 'special_super':
        buffs.special_super = { remaining: tea.duration };
        break;
    }
    Audio.play('coin');
    Renderer.spawnFloatingText(W/2, 240, '+' + tea.name, CO.GHOST_GREEN);
    if (typeof MengPo !== 'undefined') {
      State.set('mengpoLine', MengPo.getLine('buy'));
      State.set('mengpoLineTimer', 2.5);
    }
  }

  function buyMengpoTreat() {
    var coins = State.get('coins');
    if (coins < CONFIG.MENGPO_TREAT_PRICE) {
      Renderer.spawnFloatingText(W/2, 300, '铜钱不足!', '#FF4444');
      return;
    }
    State.set('coins', coins - CONFIG.MENGPO_TREAT_PRICE);
    var randIdx = Math.floor(Math.random() * 8);
    buyTea(CONFIG.MILK_TEA[randIdx]);
    var favor = State.get('favor');
    favor.exp++;
    var leveled = State.checkFavorLevelUp();
    if (leveled) {
      Renderer.spawnFloatingText(W/2, 200, '好感升级! Lv.' + favor.level, CO.COPPER_SHINE);
      if (typeof MengPo !== 'undefined') {
        State.set('mengpoLine', MengPo.getLine('levelUp'));
        State.set('mengpoLineTimer', 3);
      }
    }
  }

  // ── 渲染钟馗(色块占位) ──
  function draw(ctx, t) {
    var stage = State.get('stage');
    if (stage === 'MINING') return;

    // 呼吸金光
    ctx.shadowColor = CO.COPPER_SHINE;
    ctx.shadowBlur = 3 + Math.sin(t*1.8)*2;
    ctx.fillStyle = CO.BLOOD;
    ctx.fillRect(x - 6, y, 12, 16);
    ctx.fillStyle = CO.BONE;
    ctx.fillRect(x - 5, y - 8, 10, 10);
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(x - 7, y - 14, 14, 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(x - 5, y + 16, 4, 8);
    ctx.fillRect(x + 1, y + 16, 4, 8);

    // PAT/RESULT阶段画链 (同套牛sLasso/sHit绘制ropes)
    if (stage === 'PAT' || stage === 'RESULT') {
      drawChains(ctx, t);
    }
  }

  function drawChains(ctx, t) {
    var chains = State.get('chains');
    if (!chains) return;
    var stage = State.get('stage');

    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      var targetGhost = chain.targetGhost;

      // 鬼还在队列中移动，用当前位置
      var tx, ty2;
      if (targetGhost) {
        tx = targetGhost.x;
        ty2 = targetGhost.y;
      } else {
        tx = chain.targetX;
        ty2 = chain.targetY;
      }

      var chainColor = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
      ctx.strokeStyle = chainColor;
      ctx.lineWidth = chain.isSuper ? 3 : 1.5;

      // RESULT阶段: 抓到的链发光
      if (stage === 'RESULT' && chain.caught) {
        ctx.shadowColor = CO.CHAIN_GLOW;
        ctx.shadowBlur = 6;
      }

      // 从钟馗到鬼画线 (同套牛rope: 二次贝塞尔)
      ctx.beginPath();
      ctx.moveTo(x, y);
      var midX = (x + tx) / 2;
      var midY = (y + ty2) / 2 + 20;
      ctx.quadraticCurveTo(midX, midY, tx, ty2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  return {
    init:init, draw:draw, getTapTarget:function(){return tapTarget;},
    clearTapTarget:function(){tapTarget=null;}
  };
})();
