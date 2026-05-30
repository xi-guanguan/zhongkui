/* zhongkui.js — 钟馗控制：输入、渲染
 * 输入逻辑迁移套牛: 底部按钮投币/开始/拍打, 点击/空格丢绳
 * 商店改为IDLE时独立入口
 * 依赖：CONFIG, State, Renderer, Audio
 * 暴露：ZhongKui (全局) */

var ZhongKui = (function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var LY = CONFIG.LY, CO = CONFIG.CO;

  // ── 钟馗位置 ──
  var x = W / 2;
  var y = LY.ZHONGKUI_Y;

  // ── DOM按钮 (同套牛底部栏) ──
  var btnCoin, btnStart;

  function init() {
    btnCoin = document.getElementById('btn-coin');
    btnStart = document.getElementById('btn-start');

    if (btnCoin) {
      btnCoin.addEventListener('click', function() {
        Audio.play('btn');
        if (window._GameAPI) window._GameAPI.addCoin();
        updateDOM();
      });
    }
    if (btnStart) {
      btnStart.addEventListener('click', function() {
        Audio.play('btn');
        var stage = State.get('stage');
        if (stage === 'HITTING') {
          if (window._GameAPI) window._GameAPI.doHit();
        } else if (stage === 'SETTLE') {
          if (window._GameAPI) window._GameAPI.doSettle();
        } else {
          if (window._GameAPI) window._GameAPI.doStart();
        }
        updateDOM();
      });
    }

    // Canvas触摸/点击 (同套牛touch-layer)
    var canvas = document.getElementById('gc');
    if (canvas) {
      canvas.addEventListener('pointerdown', onPointer);
      canvas.addEventListener('touchstart', function(e) { e.preventDefault(); }, {passive: false});
    }

    // 键盘 (同套牛)
    document.addEventListener('keydown', function(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        var stage = State.get('stage');
        if (stage === 'RUNNING') {
          // 空格不做什么，等倒计时自动丢链
        } else if (stage === 'HITTING') {
          if (window._GameAPI) window._GameAPI.doHit();
        }
      }
      if (e.code === 'Enter' && State.get('stage') === 'SETTLE') {
        if (window._GameAPI) window._GameAPI.doSettle();
      }
    });

    updateDOM();
  }

  function onPointer(e) {
    e.preventDefault();
    var canvas = document.getElementById('gc');
    var rect = canvas.getBoundingClientRect();
    var tx = (e.clientX - rect.left) / rect.width * W;
    var ty = (e.clientY - rect.top) / rect.height * H;

    var stage = State.get('stage');

    // 商店打开时
    if (State.get('shopOpen')) {
      handleShopTap(tx, ty);
      return;
    }

    switch(stage) {
      case 'IDLE':
        handleIdleTap(tx, ty);
        break;
      case 'HITTING':
        if (window._GameAPI) window._GameAPI.doHit();
        break;
      case 'SETTLE':
        if (window._GameAPI) window._GameAPI.doSettle();
        break;
    }
    updateDOM();
  }

  // ── IDLE阶段点击 ──
  function handleIdleTap(tx, ty) {
    var inserted = State.get('coinsInserted');

    // 商店入口 (同套牛: IDLE时右上角商店按钮)
    if (inserted === 0 && tx > W - 52 && tx < W - 8 && ty > LY.HUD_H + 8 && ty < LY.HUD_H + 28) {
      State.set('shopOpen', true);
      if (typeof MengPo !== 'undefined') {
        State.set('mengpoLine', MengPo.getLine('enter'));
        State.set('mengpoLineTimer', 2.5);
      }
      return;
    }
  }

  // ── 商店点击 (同套牛drawShop交互) ──
  function handleShopTap(tx, ty) {
    var teas = CONFIG.MILK_TEA;
    var colW = 145, rowH = 50;
    var startY = 60;
    var leftX = 8, rightX = W / 2 + 5;
    var clicked = false;

    for (var i = 0; i < teas.length; i++) {
      var col = i < 5 ? 0 : 1;
      var row = i < 5 ? i : i - 5;
      var rx = col === 0 ? leftX : rightX;
      var ry = startY + row * rowH;
      if (ty > ry && ty < ry + rowH - 4 && tx > rx && tx < rx + colW - 4) {
        buyTea(teas[i]);
        clicked = true;
        break;
      }
    }

    // 请孟婆喝一杯
    var treatY = startY + 5 * rowH + 5;
    if (!clicked && ty > treatY && ty < treatY + 36 && tx > W / 2 - 150 && tx < W / 2 + 150) {
      buyMengpoTreat();
      clicked = true;
    }

    // 点击空白处关闭 (同套牛)
    if (!clicked) {
      State.set('shopOpen', false);
    }
    updateDOM();
  }

  function buyTea(tea) {
    var coins = State.get('coins');
    if (coins < tea.price) {
      Renderer.spawnFloatingText(W / 2, 200, '铜钱不足!', '#FF4444');
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
        var lockedIdx = M.floor(M.random() * CONFIG.GT.length);
        buffs.special_catch = { lockedIdx: lockedIdx, remaining: tea.duration };
        break;
      case 'special_super':
        buffs.special_super = { remaining: tea.duration };
        break;
    }
    Audio.play('coin');
    Renderer.spawnFloatingText(W / 2, 180, '+' + tea.name, CO.GHOST_GREEN);
    if (typeof MengPo !== 'undefined') {
      State.set('mengpoLine', MengPo.getLine('buy'));
      State.set('mengpoLineTimer', 2.5);
    }
  }

  function buyMengpoTreat() {
    var coins = State.get('coins');
    if (coins < CONFIG.MENGPO_TREAT_PRICE) {
      Renderer.spawnFloatingText(W / 2, 200, '铜钱不足!', '#FF4444');
      return;
    }
    State.set('coins', coins - CONFIG.MENGPO_TREAT_PRICE);
    var randIdx = M.floor(M.random() * 8);
    buyTea(CONFIG.MILK_TEA[randIdx]);
    var favor = State.get('favor');
    favor.exp++;
    var leveled = State.checkFavorLevelUp();
    if (leveled) {
      Renderer.spawnFloatingText(W / 2, 160, '好感升级! Lv.' + favor.level, CO.COPPER_SHINE);
      if (typeof MengPo !== 'undefined') {
        State.set('mengpoLine', MengPo.getLine('levelUp'));
        State.set('mengpoLineTimer', 3);
      }
    }
  }

  // ── DOM按钮状态更新 (同套牛updateDOM) ──
  function updateDOM() {
    if (!btnCoin || !btnStart) return;

    var stage = State.get('stage');
    var idle = stage === 'IDLE';
    var hitting = stage === 'HITTING';
    var settling = stage === 'SETTLE';

    // 投币按钮: IDLE时可用
    btnCoin.disabled = !idle;

    // 开始按钮: 动态切换功能 (同套牛)
    if (hitting) {
      btnStart.textContent = '拍打';
      btnStart.disabled = false;
      btnStart.style.background = '#FF4444';
      btnStart.style.borderColor = '#CC0000';
    } else if (settling) {
      btnStart.textContent = '继续';
      btnStart.disabled = false;
      btnStart.style.background = '#4CAF50';
      btnStart.style.borderColor = '#388E3C';
    } else {
      btnStart.textContent = '开始';
      btnStart.disabled = !idle || State.get('coinsInserted') === 0;
      btnStart.style.background = '';
      btnStart.style.borderColor = '';
    }
  }

  // ── 渲染钟馗 ──
  function draw(ctx, t) {
    var stage = State.get('stage');
    if (stage === 'MINING') return;

    // 呼吸金光
    ctx.shadowColor = CO.COPPER_SHINE;
    ctx.shadowBlur = 3 + M.sin(t * 1.8) * 2;
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

    // IDLE投币后: 画手中链条 (同套牛drawHeldRopes)
    if (stage === 'IDLE' && State.get('coinsInserted') > 0) {
      var count = State.get('coinsInserted');
      for (var i = 0; i < count; i++) {
        var ox = x - 10 + (i % 3) * 10;
        var oy = y + 15 - M.floor(i / 3) * 6 + M.floor(M.sin(t * 0.8 + i) * 2);
        ctx.strokeStyle = CO.CHAIN;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ox, oy, 9, 5, 0, 0, M.PI * 2);
        ctx.stroke();
      }
    }

    // RUNNING阶段: 画手中链 (同套牛sRun底部牛仔握绳)
    if (stage === 'RUNNING') {
      var roundCoins = State.get('roundCoins');
      for (var i = 0; i < roundCoins; i++) {
        var ox = x - 10 + (i % 3) * 10;
        var oy = y + 15 - M.floor(i / 3) * 6 + M.floor(M.sin(t * 0.8 + i) * 2);
        ctx.strokeStyle = CO.CHAIN;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ox, oy, 9, 5, 0, 0, M.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ── 定时更新DOM ──
  setInterval(function() { updateDOM(); }, 200);

  return {
    init: init,
    draw: draw,
    updateDOM: updateDOM
  };
})();
