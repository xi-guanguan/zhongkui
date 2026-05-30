/* zhongkui.js — 钟馗控制：输入、动画、技能
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
  var tapTarget = null; // {x,y} 点击位置

  function init() {
    // 绑定触摸/点击
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
        // 点击开始
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
        // 点击继续
        State.changeStage('SHOP');
        Audio.play('btn');
        break;
      case 'SHOP':
        handleShopTap(tx, ty);
        break;
      case 'MINING':
        // 打工点击由mining模块处理
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
    // 投币选择区域
    if (ty > bottomY && ty < bottomY + 50) {
      // 检测投币按钮 1~5
      for (var i = 1; i <= 5; i++) {
        var bx = 65 + (i-1)*48;
        if (tx > bx && tx < bx + 42) {
          var bet = State.get('betAmount');
          if (i === bet) {
            // 再次点击已选=确认投币
            startRound();
          } else {
            State.set('betAmount', i);
            Audio.play('coin');
          }
          return;
        }
      }
      // 确认按钮
      if (tx > W/2 - 50 && tx < W/2 + 50 && ty > bottomY + 40) {
        startRound();
      }
    }
  }

  function startRound() {
    var bet = State.get('betAmount');
    var coins = State.get('coins');
    if (coins < bet) {
      // 钱不够，去打工
      State.changeStage('SHOP');
      return;
    }
    State.set('coins', coins - bet);
    var chains = Physics.rollChains(bet);
    State.set('chains', chains);
    Ghosts.initRound();
    State.changeStage('PAT');
    State.set('hitCount', 0);
    State.set('hitTimer', 0);
    Audio.play('chain');
  }

  // ── 商店点击 ──
  function handleShopTap(tx, ty) {
    var bottomY = LY.BOTTOM_Y;
    // 打工按钮
    if (tx < W/2 && ty > bottomY) {
      State.changeStage('MINING');
      if (typeof Mining !== 'undefined') Mining.start();
      Audio.play('btn');
      return;
    }
    // 返回抓鬼按钮
    if (tx >= W/2 && ty > bottomY) {
      State.changeStage('ROUND');
      Audio.play('btn');
      return;
    }
    // 奶茶列表点击
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
    // 请孟婆喝一杯
    var treatY = startY + 5 * rowH + 5;
    if (ty > treatY && ty < treatY + 36 && tx > W/2 - 150 && tx < W/2 + 150) {
      buyMengpoTreat();
    }
  }

  function buyTea(tea) {
    var coins = State.get('coins');
    if (coins < tea.price) {
      Renderer.spawnFloatingText(W/2, 400, '铜钱不足!', '#FF4444');
      return;
    }
    State.set('coins', coins - tea.price);
    // 应用buff
    var buffs = State.get('buffs');
    switch(tea.type) {
      case 'red':
        buffs.red = { value: tea.catchBonus, remaining: tea.duration };
        break;
      case 'green':
        buffs.green = { value: tea.oddsBonus, remaining: tea.duration };
        break;
      case 'special_catch':
        // 随机锁定一种鬼
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
    // 触发孟婆对话
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
    // 随机获得#1~#8的buff
    var randIdx = Math.floor(Math.random() * 8);
    buyTea(CONFIG.MILK_TEA[randIdx]);
    // +好感经验
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
    if (stage === 'MINING') return; // 打工场景不画钟馗

    // 呼吸金光
    ctx.shadowColor = CO.COPPER_SHINE;
    ctx.shadowBlur = 3 + Math.sin(t*1.8)*2;
    // 身体(红袍)
    ctx.fillStyle = CO.BLOOD;
    ctx.fillRect(x - 6, y, 12, 16);
    // 头
    ctx.fillStyle = CO.BONE;
    ctx.fillRect(x - 5, y - 8, 10, 10);
    // 帽子
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(x - 7, y - 14, 14, 6);
    ctx.shadowBlur = 0;
    // 腿
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(x - 5, y + 16, 4, 8);
    ctx.fillRect(x + 1, y + 16, 4, 8);

    // 如果在PAT阶段，画链
    if (stage === 'PAT' || stage === 'RESULT') {
      drawChains(ctx, t);
    }
  }

  function drawChains(ctx, t) {
    var chains = State.get('chains');
    var ghostPos = Ghosts.getPos();
    var buffs = State.get('buffs');

    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      var chainColor = chain.isSuper ? CO.COPPER_SHINE : CO.CHAIN;
      // 从钟馗到鬼画线
      ctx.strokeStyle = chainColor;
      ctx.lineWidth = chain.isSuper ? 3 : 1.5;
      if (chain.caught && State.get('stage') === 'RESULT') {
        ctx.shadowColor = CO.CHAIN_GLOW;
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      ctx.moveTo(x, y);
      // 带垂坠弧
      var midX = (x + ghostPos.x) / 2;
      var midY = (y + ghostPos.y) / 2 + 20;
      ctx.quadraticCurveTo(midX, midY, ghostPos.x, ghostPos.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  return {
    init:init, draw:draw, getTapTarget:function(){return tapTarget;},
    clearTapTarget:function(){tapTarget=null;}
  };
})();
