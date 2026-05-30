/* zhongkui.js — 钟馗控制：输入、渲染
 * UI布局匹配线框图: 底部三圆形按钮 [设置⚙] [主操作⭕] [孟婆→]
 * 投币: 画布内投币选择器(1~5币) + 主操作按钮确认开始
 * 依赖：CONFIG, State, Renderer, Audio
 * 暴露：ZhongKui (全局) */

var ZhongKui = (function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var LY = CONFIG.LY, CO = CONFIG.CO, FS = CONFIG.FS;

  // ── 钟馗位置 ──
  var x = W / 2;
  var y = LY.ZHONGKUI_Y;

  // ── 投币选择器状态 ──
  var coinSelectorOpen = false;  // 投币选择器是否打开
  var coinSelectorValue = 1;     // 当前选择的投币数

  // ── DOM按钮 ──
  var btnSettings, btnAction, btnShop;

  function init() {
    btnSettings = document.getElementById('btn-settings');
    btnAction = document.getElementById('btn-action');
    btnShop = document.getElementById('btn-shop');

    // 设置按钮 (线框图: 左小圆 ⚙)
    if (btnSettings) {
      btnSettings.addEventListener('click', function() {
        Audio.play('btn');
        // TODO: 打开设置面板
      });
    }

    // 主操作按钮 (线框图: 中间大圆 — 多功能)
    if (btnAction) {
      btnAction.addEventListener('click', function() {
        Audio.play('btn');
        var stage = State.get('stage');
        if (stage === 'IDLE') {
          if (coinSelectorOpen) {
            // 投币选择器已打开 → 确认投币并开始
            confirmCoinsAndStart();
          } else {
            // 打开投币选择器
            openCoinSelector();
          }
        } else if (stage === 'HITTING') {
          if (window._GameAPI) window._GameAPI.doHit();
        } else if (stage === 'SETTLE') {
          if (window._GameAPI) window._GameAPI.doSettle();
        } else if (stage === 'MINING') {
          // 打工: 射钩
          Mining.onTap(0, 0);
        }
        updateDOM();
      });
    }

    // 孟婆按钮 (线框图: 右小圆 →)
    if (btnShop) {
      btnShop.addEventListener('click', function() {
        Audio.play('btn');
        var stage = State.get('stage');
        if (stage === 'IDLE' && !State.get('shopOpen')) {
          State.set('shopOpen', true);
          coinSelectorOpen = false;
          if (typeof MengPo !== 'undefined') {
            State.set('mengpoLine', MengPo.getLine('enter'));
            State.set('mengpoLineTimer', 2.5);
          }
        }
        updateDOM();
      });
    }

    // Canvas触摸/点击
    var canvas = document.getElementById('gc');
    if (canvas) {
      canvas.addEventListener('pointerdown', onPointer);
      canvas.addEventListener('touchstart', function(e) { e.preventDefault(); }, {passive: false});
    }

    // 键盘
    document.addEventListener('keydown', function(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        var stage = State.get('stage');
        if (stage === 'HITTING') {
          if (window._GameAPI) window._GameAPI.doHit();
        } else if (stage === 'IDLE') {
          if (coinSelectorOpen) confirmCoinsAndStart();
          else openCoinSelector();
        } else if (stage === 'MINING') {
          Mining.onTap(0, 0);
        }
        updateDOM();
      }
      if (e.code === 'Enter' && State.get('stage') === 'SETTLE') {
        if (window._GameAPI) window._GameAPI.doSettle();
        updateDOM();
      }
      // 投币选择器: 数字键1~5
      if (e.code >= 'Digit1' && e.code <= 'Digit5' && coinSelectorOpen) {
        coinSelectorValue = parseInt(e.code.replace('Digit', ''));
        updateDOM();
      }
    });

    updateDOM();
  }

  // ── 投币选择器 ──
  function openCoinSelector() {
    var coins = State.get('coins');
    if (coins <= 0) {
      Renderer.spawnFloatingText(W/2, 200, '铜钱不足! 去打工吧', '#FF4444');
      return;
    }
    coinSelectorOpen = true;
    coinSelectorValue = M.min(1, coins);  // 默认1币
    updateDOM();
  }

  function confirmCoinsAndStart() {
    if (State.get('stage') !== 'IDLE') return;
    var coins = State.get('coins');
    var val = M.min(coinSelectorValue, coins, State.get('maxCoins'));
    if (val <= 0) {
      Renderer.spawnFloatingText(W/2, 200, '铜钱不足!', '#FF4444');
      return;
    }

    // 扣币+记录
    State.set('coins', coins - val);
    State.set('coinsInserted', val);
    State.set('roundCoins', val);
    coinSelectorOpen = false;

    // 开始游戏
    Ghosts.initRound();
    State.set('observeTimer', 8);
    State.set('countdownTimer', 5);
    State.set('runningSubPhase', 'OBSERVE');
    State.set('chains', []);
    State.set('roundResult', null);
    State.changeStage('RUNNING');
    Audio.play('coin');

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

    // 投币选择器打开时
    if (coinSelectorOpen) {
      handleCoinSelectorTap(tx, ty);
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
      case 'MINING':
        Mining.onTap(tx, ty);
        break;
    }
    updateDOM();
  }

  // ── 投币选择器触摸 ──
  function handleCoinSelectorTap(tx, ty) {
    // 选择器位置: 屏幕中央偏下
    var selectorY = 280;
    var btnW = 44, btnH = 36, gap = 6;
    var totalW = 5 * btnW + 4 * gap;
    var startX = (W - totalW) / 2;

    for (var i = 1; i <= 5; i++) {
      var bx = startX + (i - 1) * (btnW + gap);
      var by = selectorY;
      if (tx > bx && tx < bx + btnW && ty > by && ty < by + btnH) {
        var coins = State.get('coins');
        if (i <= coins) {
          coinSelectorValue = i;
          Audio.play('btn');
        }
        updateDOM();
        return;
      }
    }

    // 确认按钮
    var confirmY = selectorY + 50;
    if (tx > W/2 - 40 && tx < W/2 + 40 && ty > confirmY && ty < confirmY + 30) {
      confirmCoinsAndStart();
      return;
    }

    // 点击空白处取消选择器
    coinSelectorOpen = false;
    updateDOM();
  }

  // ── IDLE阶段点击 ──
  function handleIdleTap(tx, ty) {
    // 打工按钮 (画布内)
    var workBtnX = W/2 - 50, workBtnY = 360, workBtnW = 100, workBtnH = 28;
    if (tx > workBtnX && tx < workBtnX + workBtnW && ty > workBtnY && ty < workBtnY + workBtnH) {
      State.changeStage('MINING');
      Mining.start();
      updateDOM();
      return;
    }

    // 点击画布中央区域打开投币选择器
    if (ty > 150 && ty < 350) {
      openCoinSelector();
    }
  }

  // ── 商店点击 ──
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

    // 点击空白处关闭
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

  // ── DOM按钮状态更新 ──
  function updateDOM() {
    if (!btnAction) return;

    var stage = State.get('stage');
    var idle = stage === 'IDLE';
    var hitting = stage === 'HITTING';
    var settling = stage === 'SETTLE';
    var mining = stage === 'MINING';

    // 主操作按钮: 动态切换
    btnAction.className = 'btn-lg';
    if (hitting) {
      btnAction.textContent = '拍打';
      btnAction.className = 'btn-lg hit-mode';
      btnAction.disabled = false;
    } else if (settling) {
      btnAction.textContent = '继续';
      btnAction.className = 'btn-lg settle-mode';
      btnAction.disabled = false;
    } else if (mining) {
      btnAction.textContent = '射钩';
      btnAction.className = 'btn-lg';
      btnAction.disabled = false;
    } else if (coinSelectorOpen) {
      btnAction.textContent = '确认';
      btnAction.className = 'btn-lg';
      btnAction.disabled = false;
    } else {
      btnAction.textContent = '投币';
      btnAction.className = 'btn-lg';
      btnAction.disabled = !idle;
    }

    // 设置按钮: 始终可用
    if (btnSettings) btnSettings.disabled = false;

    // 孟婆按钮: 仅IDLE可用
    if (btnShop) btnShop.disabled = !idle || State.get('shopOpen');
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

    // 投币选择器打开: 画手中链条
    if ((stage === 'IDLE' && coinSelectorOpen) || stage === 'RUNNING') {
      var count = stage === 'RUNNING' ? State.get('roundCoins') : coinSelectorValue;
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
  }

  // ── 画投币选择器 (画布内) ──
  function drawCoinSelector(ctx, t) {
    if (!coinSelectorOpen || State.get('stage') !== 'IDLE') return;

    var coins = State.get('coins');
    var selectorY = 280;
    var btnW = 44, btnH = 36, gap = 6;
    var totalW = 5 * btnW + 4 * gap;
    var startX = (W - totalW) / 2;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, selectorY - 40, W, 140);

    // 标题
    ctx.font = 'bold ' + FS.M + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('选择投币数 (持有: ' + coins + ')', W/2, selectorY - 18);

    // 1~5按钮
    for (var i = 1; i <= 5; i++) {
      var bx = startX + (i - 1) * (btnW + gap);
      var by = selectorY;
      var canAfford = i <= coins;
      var selected = i === coinSelectorValue;

      // 按钮背景
      if (selected) {
        ctx.fillStyle = CO.COPPER_SHINE;
        ctx.fillRect(bx, by, btnW, btnH);
        ctx.fillStyle = '#1A1A2E';
      } else if (canAfford) {
        ctx.fillStyle = '#1B1B3A';
        ctx.fillRect(bx, by, btnW, btnH);
        ctx.fillStyle = CO.BONE;
      } else {
        ctx.fillStyle = '#2A2A4A';
        ctx.fillRect(bx, by, btnW, btnH);
        ctx.fillStyle = '#505070';
      }

      // 2px内描边 (PixelForge)
      ctx.strokeStyle = selected ? '#E6A000' : canAfford ? '#3A3A6A' : '#2A2A4A';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, by + 1, btnW - 2, btnH - 2);

      // 数字
      ctx.font = 'bold ' + FS.L + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(i), bx + btnW / 2, by + 24);
    }

    // 确认按钮
    var confirmY = selectorY + 50;
    var canStart = coinSelectorValue > 0 && coinSelectorValue <= coins;
    ctx.fillStyle = canStart ? '#FF3030' : '#2A2A4A';
    ctx.fillRect(W/2 - 40, confirmY, 80, 30);
    ctx.strokeStyle = canStart ? '#CC0000' : '#3A3A6A';
    ctx.lineWidth = 2;
    ctx.strokeRect(W/2 - 39, confirmY + 1, 78, 28);
    ctx.font = FS.M + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = canStart ? '#FFFFFF' : '#505070';
    ctx.fillText('确认', W/2, confirmY + 20);
  }

  // ── 暴露 ──
  function isCoinSelectorOpen() { return coinSelectorOpen; }
  function getCoinSelectorValue() { return coinSelectorValue; }

  // 定时更新DOM
  setInterval(function() { updateDOM(); }, 200);

  return {
    init: init,
    draw: draw,
    updateDOM: updateDOM,
    drawCoinSelector: drawCoinSelector,
    isCoinSelectorOpen: isCoinSelectorOpen,
    getCoinSelectorValue: getCoinSelectorValue
  };
})();
