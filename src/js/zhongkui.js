/* zhongkui.js — 钟馗控制：按钮状态机 + 输入
 * Bug修复: #4返回清孟婆对话 #5打工返回 #6字号 #8死锁
 * 依赖：CONFIG, State, Renderer, Audio, Ghosts, Mining, MengPo
 * 暴露：ZhongKui (全局) */

var ZhongKui = (function() {
  var M = Math;
  var W = CONFIG.W, H = CONFIG.H;
  var LY = CONFIG.LY, CO = CONFIG.CO, FS = CONFIG.FS;
  var x = W / 2, y = LY.ZHONGKUI_Y;
  var coinMode = false;
  var settingsOpen = false;
  var shopScrollY = 0, shopDragging = false, shopDragStartY = 0, shopDragStartScroll = 0, shopDragMoved = false;
  var btnSettings, btnAction, btnShop;

  function init() {
    btnSettings = document.getElementById('btn-settings');
    btnAction = document.getElementById('btn-action');
    btnShop = document.getElementById('btn-shop');

    if (btnSettings) {
      btnSettings.addEventListener('click', function() {
        Audio.play('btn');
        if (coinMode) { coinMode = false; State.set('coinsInserted', 0); }
        settingsOpen = !settingsOpen;
        // Bug1修复: 打开设置时清零shake, 避免渲染偏移导致点击不准
        if (settingsOpen) { State.set('shake', {x:0,y:0,t:0}); }
        updateDOM();
      });
    }

    if (btnAction) {
      btnAction.addEventListener('click', function() {
        Audio.play('btn');
        var stage = State.get('stage');
        var shopOpen = State.get('shopOpen');

        if (shopOpen && stage !== 'MINING') {
          State.set('shopOpen', false);
          State.changeStage('MINING');
          Mining.start();
        } else if (stage === 'IDLE' && !shopOpen) {
          if (coinMode) { doStart(); }
          else { coinMode = true; State.set('coinsInserted', 0); }
        } else if (stage === 'RUNNING') {
          doLasso();
        } else if (stage === 'HITTING') {
          doHit();
        } else if (stage === 'SETTLE') {
          if (window._GameAPI) window._GameAPI.doSettle();
        } else if (stage === 'MINING') {
          Mining.onTap(0, 0);
        }
        updateDOM();
      });
    }

    if (btnShop) {
      btnShop.addEventListener('click', function() {
        Audio.play('btn');
        var stage = State.get('stage');
        var shopOpen = State.get('shopOpen');

        if (coinMode) {
          addCoin();
        } else if (stage === 'MINING') {
          Mining.endMining(); // Bug#5: 返回回孟婆店
        } else if (shopOpen) {
          // Bug#4: 返回时清除孟婆对话框
          State.set('shopOpen', false);
          State.set('mengpoLine', null);
          State.set('mengpoLineTimer', 0);
        } else if (stage === 'IDLE') {
          State.set('shopOpen', true);
          shopScrollY = 0;
          if (typeof MengPo !== 'undefined') {
            State.set('mengpoLine', MengPo.getLine('enter'));
            State.set('mengpoLineTimer', 2.5);
          }
        }
        updateDOM();
      });
    }

    var canvas = document.getElementById('gc');
    if (canvas) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('touchstart', function(e) { e.preventDefault(); }, {passive: false});
    }

    document.addEventListener('keydown', function(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        var stage = State.get('stage');
        if (stage === 'IDLE' && !State.get('shopOpen')) {
          if (coinMode) doStart();
          else { coinMode = true; State.set('coinsInserted', 0); }
        } else if (stage === 'RUNNING') doLasso();
        else if (stage === 'HITTING') doHit();
        else if (stage === 'MINING') Mining.onTap(0, 0);
        updateDOM();
      }
      if (e.code === 'Enter' && State.get('stage') === 'SETTLE') {
        if (window._GameAPI) window._GameAPI.doSettle();
        updateDOM();
      }
      if (e.code >= 'Digit1' && e.code <= 'Digit5' && coinMode) {
        var n = parseInt(e.code.replace('Digit', ''));
        State.set('coinsInserted', M.min(n, State.get('coins'), State.get('maxCoins')));
        updateDOM();
      }
    });
    updateDOM();
  }

  function addCoin() {
    var inserted = State.get('coinsInserted');
    var coins = State.get('coins');
    if (inserted < State.get('maxCoins') && inserted < coins) {
      State.set('coinsInserted', inserted + 1);
      Audio.play('coin');
    }
    updateDOM();
  }

  function doStart() {
    if (State.get('stage') !== 'IDLE') return;
    var inserted = State.get('coinsInserted');
    var coins = State.get('coins');
    if (inserted <= 0 || coins < inserted) {
      Renderer.spawnFloatingText(W/2, 200, '请先投币!', CO.BLOOD);
      return;
    }
    State.set('coins', coins - inserted);
    State.set('roundCoins', inserted);
    State.set('coinsInserted', 0);
    coinMode = false;
    Ghosts.initRound();
    Ghosts.resume();
    State.set('chains', []);
    State.set('roundResult', null);
    State.set('hitCount', 0);
    State.set('hitTimer', 0);
    State.set('stageTimer', 0);
    State.changeStage('RUNNING');
    Audio.play('coin');
    updateDOM();
  }

  function doLasso() {
    if (State.get('stage') !== 'RUNNING') return;
    if (window._GameAPI) window._GameAPI.doLasso();
    updateDOM();
  }

  function doHit() {
    if (State.get('stage') !== 'HITTING') return;
    State.set('hitCount', State.get('hitCount') + 1);
    Audio.play('hit');
    Renderer.triggerShake(1);
    updateDOM();
  }

  function onPointerDown(e) {
    e.preventDefault();
    var pos = canvasPos(e);

    // 设置面板打开时
    if (settingsOpen) {
      handleSettingsTap(pos.x, pos.y);
      return;
    }

    if (State.get('shopOpen') && State.get('stage') !== 'MINING') {
      shopDragging = true;
      shopDragStartY = pos.y;
      shopDragStartScroll = shopScrollY;
      shopDragMoved = false;
      return;
    }
    switch(State.get('stage')) {
      case 'IDLE': handleIdleTap(pos.x, pos.y); break;
      case 'HITTING': doHit(); break;
      case 'SETTLE': if (window._GameAPI) window._GameAPI.doSettle(); break;
      case 'MINING': Mining.onTap(pos.x, pos.y); break;
    }
    updateDOM();
  }

  function onPointerMove(e) {
    if (!shopDragging) return;
    var pos = canvasPos(e);
    var dy = shopDragStartY - pos.y;
    shopScrollY = M.max(0, shopDragStartScroll + dy);
    if (M.abs(pos.y - shopDragStartY) > 5) shopDragMoved = true;
  }

  function onPointerUp(e) {
    if (!shopDragging) return;
    shopDragging = false;
    if (!shopDragMoved) { var pos = canvasPos(e); handleShopTap(pos.x, pos.y); }
    updateDOM();
  }

  function canvasPos(e) {
    var canvas = document.getElementById('gc');
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX-rect.left)/rect.width*W, y: (e.clientY-rect.top)/rect.height*H };
  }

  function handleIdleTap(tx, ty) {
    // 打工入口已移至商店, 主界面无按钮
  }

  function handleShopTap(tx, ty) {
    var teas = CONFIG.MILK_TEA;
    var productStartY = 208;
    var rowH = 26;
    var clicked = false;
    for (var i = 0; i < teas.length; i++) {
      var ry = productStartY + i * rowH - shopScrollY;
      if (ry < 200 || ry > H) continue;
      if (ty > ry && ty < ry + rowH && tx > 10 && tx < W - 10) {
        buyTea(teas[i]); clicked = true; break;
      }
    }
    var treatY = productStartY + teas.length * rowH + 4 - shopScrollY;
    if (!clicked && ty > treatY && ty < treatY + 26 && tx > 10 && tx < W - 10) {
      buyMengpoTreat(); clicked = true;
    }
    updateDOM();
  }

  function buyTea(tea) {
    var coins = State.get('coins');
    if (coins < tea.price) { Renderer.spawnFloatingText(W/2, 200, '铜钱不足!', '#FF4444'); return; }
    State.set('coins', coins - tea.price);
    var buffs = State.get('buffs');
    switch(tea.type) {
      case 'red': buffs.red={value:tea.catchBonus,remaining:tea.duration}; break;
      case 'green': buffs.green={value:tea.oddsBonus,remaining:tea.duration}; break;
      case 'special_catch': buffs.special_catch={lockedIdx:M.floor(M.random()*CONFIG.GT.length),remaining:tea.duration}; break;
      case 'special_super': buffs.special_super={remaining:tea.duration}; break;
    }
    Audio.play('coin');
    Renderer.spawnFloatingText(W/2, 180, '+' + tea.name, CO.GHOST_GREEN);
    if (typeof MengPo !== 'undefined') { State.set('mengpoLine', MengPo.getLine('buy')); State.set('mengpoLineTimer', 2.5); }
  }

  function buyMengpoTreat() {
    var coins = State.get('coins');
    if (coins < CONFIG.MENGPO_TREAT_PRICE) { Renderer.spawnFloatingText(W/2, 200, '铜钱不足!', '#FF4444'); return; }
    State.set('coins', coins - CONFIG.MENGPO_TREAT_PRICE);
    var tea = CONFIG.MILK_TEA[M.floor(M.random()*CONFIG.MILK_TEA.length)];
    var buffs = State.get('buffs');
    switch(tea.type) {
      case 'red': buffs.red={value:tea.catchBonus,remaining:tea.duration}; break;
      case 'green': buffs.green={value:tea.oddsBonus,remaining:tea.duration}; break;
      case 'special_catch': buffs.special_catch={lockedIdx:M.floor(M.random()*CONFIG.GT.length),remaining:tea.duration}; break;
      case 'special_super': buffs.special_super={remaining:tea.duration}; break;
    }
    Renderer.spawnFloatingText(W/2, 180, '孟婆请喝: '+tea.name, CO.COPPER_SHINE);
    Audio.play('coin');
    var favor = State.get('favor');
    favor.exp++;
    if (State.checkFavorLevelUp()) {
      Renderer.spawnFloatingText(W/2, 160, '好感升级! Lv.'+favor.level, CO.COPPER_SHINE);
      if (typeof MengPo !== 'undefined') { State.set('mengpoLine', MengPo.getLine('levelUp')); State.set('mengpoLineTimer', 3); }
    }
  }

  // Bug#3: 道具描述模糊化
  function getEffectDesc(tea) {
    if (tea.type === 'red') {
      if (tea.catchBonus <= 0.02) return '略微提升捕获';
      if (tea.catchBonus <= 0.035) return '小幅提升捕获';
      if (tea.catchBonus <= 0.05) return '显著提升捕获';
      return '大幅提升捕获';
    }
    if (tea.type === 'green') {
      if (tea.oddsBonus <= 3) return '略微提升赔率';
      if (tea.oddsBonus <= 6) return '小幅提升赔率';
      if (tea.oddsBonus <= 9) return '显著提升赔率';
      return '大幅提升赔率';
    }
    if (tea.type === 'special_catch') return '锁定同种鬼';
    if (tea.type === 'special_super') return '极大幅提升某一钩';
    return '';
  }

  // ── 按钮状态机 ──
  function updateDOM() {
    if (!btnAction) return;
    var stage = State.get('stage');
    var inserted = State.get('coinsInserted');
    var coins = State.get('coins');
    var shopOpen = State.get('shopOpen');

    // Bug3修复: 设置面板打开时禁用主操作和商店按钮
    if (settingsOpen) {
      btnAction.disabled = true;
      if (btnShop) { btnShop.disabled = true; }
      if (btnSettings) btnSettings.disabled = false;
      return;
    }

    btnAction.className = 'btn-lg';
    // Bug#6: 右侧按钮文字时缩小字号
    var smFontSize = '14px';

    if (shopOpen && stage !== 'MINING') {
      btnAction.textContent = '打工'; btnAction.disabled = false;
      btnShop.textContent = '返回'; btnShop.style.fontSize = smFontSize; btnShop.disabled = false;
      btnSettings.disabled = false;
      return;
    }

    if (stage === 'MINING') {
      btnAction.textContent = '射钩'; btnAction.disabled = false;
      btnShop.textContent = '返回'; btnShop.style.fontSize = smFontSize; btnShop.disabled = false;
      btnSettings.disabled = false;
      return;
    }

    if (stage === 'IDLE' && coinMode) {
      btnAction.textContent = '开始'; btnAction.disabled = inserted <= 0;
      btnShop.textContent = '投币'; btnShop.style.fontSize = smFontSize;
      btnShop.disabled = inserted >= State.get('maxCoins') || inserted >= coins;
      btnSettings.disabled = false;
      return;
    }

    switch(stage) {
      case 'IDLE':
        btnAction.textContent = '开始'; btnAction.disabled = false;
        btnShop.textContent = '→'; btnShop.style.fontSize = '22px'; btnShop.disabled = false;
        break;
      case 'RUNNING':
        btnAction.textContent = '丢索';
        btnAction.disabled = Ghosts.getTargets(1).length <= 0;
        btnShop.textContent = '投币'; btnShop.style.fontSize = smFontSize; btnShop.disabled = true;
        break;
      case 'LASSO':
        btnAction.textContent = '拉扯'; btnAction.className = 'btn-lg hit-mode'; btnAction.disabled = true;
        btnShop.textContent = '投币'; btnShop.style.fontSize = smFontSize; btnShop.disabled = true;
        break;
      case 'HITTING':
        btnAction.textContent = '拉扯'; btnAction.className = 'btn-lg hit-mode'; btnAction.disabled = false;
        btnShop.textContent = '投币'; btnShop.style.fontSize = smFontSize; btnShop.disabled = true;
        break;
      case 'RESULT':
      case 'SETTLE':
        btnAction.textContent = '继续'; btnAction.className = 'btn-lg settle-mode'; btnAction.disabled = true;
        btnShop.textContent = '→'; btnShop.style.fontSize = '22px'; btnShop.disabled = true;
        break;
      default:
        btnAction.textContent = '...'; btnAction.disabled = true;
        btnShop.textContent = '→'; btnShop.style.fontSize = '22px'; btnShop.disabled = true;
    }
    btnSettings.disabled = false;
  }

  function draw(ctx, t) {
    var stage = State.get('stage');
    if (stage === 'MINING') return;

    // ★ 像素钟馗: 红黑立绘 + 呼吸金光
    var cx = M.floor(x), cy = M.floor(y);
    var breathY = M.floor(M.sin(t * 1.8) * 1.5);

    // 呼吸金光(如如之心: shadowBlur自己呼吸)
    ctx.shadowColor = CO.COPPER_SHINE;
    ctx.shadowBlur = 3 + M.sin(t * 1.8) * 2;

    // 官帽(14×6, VOID黑 + 两翼3×2)
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(cx - 7, cy - 24 + breathY, 14, 6);
    ctx.fillRect(cx - 10, cy - 24 + breathY, 3, 3);
    ctx.fillRect(cx + 7, cy - 24 + breathY, 3, 3);
    // 帽带(铜色)
    ctx.fillStyle = CO.COPPER;
    ctx.fillRect(cx - 7, cy - 19 + breathY, 14, 2);

    // 脸(10×8, BONE骨白)
    ctx.fillStyle = CO.BONE;
    ctx.fillRect(cx - 5, cy - 18 + breathY, 10, 8);
    // 眼睛(2×2, VOID黑)
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(cx - 4, cy - 15 + breathY, 2, 2);
    ctx.fillRect(cx + 2, cy - 15 + breathY, 2, 2);
    // 胡须(3条2px竖线, CHAIN灰)
    ctx.fillStyle = CO.CHAIN;
    ctx.fillRect(cx - 3, cy - 10 + breathY, 1, 3);
    ctx.fillRect(cx, cy - 10 + breathY, 1, 3);
    ctx.fillRect(cx + 3, cy - 10 + breathY, 1, 3);

    // 躯干(12×16, BLOOD红袍)
    ctx.fillStyle = CO.BLOOD;
    ctx.fillRect(cx - 6, cy - 10 + breathY, 12, 16);
    // 腰带(14×3, COPPER铜)
    ctx.fillStyle = CO.COPPER;
    ctx.fillRect(cx - 7, cy + 3 + breathY, 14, 3);
    // 袍纹(2px装饰线)
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillRect(cx - 1, cy - 8 + breathY, 2, 12);

    ctx.shadowBlur = 0;

    // 腿(2条4×8, VOID黑)
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(cx - 5, cy + 6 + breathY, 4, 8);
    ctx.fillRect(cx + 1, cy + 6 + breathY, 4, 8);
    // 靴(稍宽, DUSK暗紫)
    ctx.fillStyle = CO.DUSK;
    ctx.fillRect(cx - 6, cy + 13 + breathY, 5, 3);
    ctx.fillRect(cx + 1, cy + 13 + breathY, 5, 3);

    // 链环(待机投币数或回合链数)
    var chainCount = 0;
    if (stage === 'IDLE' && coinMode) chainCount = State.get('coinsInserted');
    else if (stage === 'RUNNING') chainCount = State.get('roundCoins');
    for (var i = 0; i < chainCount; i++) {
      var ox = cx - 8 + (i % 3) * 8;
      var oy = cy + 14 - M.floor(i / 3) * 5 + M.floor(M.sin(t * 0.8 + i) * 2);
      ctx.strokeStyle = CO.CHAIN; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(ox, oy, 7, 4, 0, 0, M.PI * 2); ctx.stroke();
    }
  }

  setInterval(function() { updateDOM(); }, 200);

  // ── 设置面板按钮边界(统一计算, 消除Bug1偏移) ──
  function _settingsBtnBounds() {
    var centerY = 160;
    var btnW = 200, btnH = 36, gap = 10;
    var sfxY = centerY;
    var musicY = sfxY + gap + btnH;
    var resetY = musicY + gap + btnH;
    return {
      sfx:   { x: W/2-btnW/2, y: sfxY,   w: btnW, h: btnH },
      music: { x: W/2-btnW/2, y: musicY, w: btnW, h: btnH },
      reset: { x: W/2-btnW/2, y: resetY, w: btnW, h: btnH },
      lastBtnBottom: resetY + btnH,
      topBound: centerY - 40
    };
  }

  // ── 设置面板点击处理 ──
  function handleSettingsTap(tx, ty) {
    var b = _settingsBtnBounds();

    // 音效开关
    if (tx > b.sfx.x && tx < b.sfx.x+b.sfx.w && ty > b.sfx.y && ty < b.sfx.y+b.sfx.h) {
      Audio.toggleSfxMute();
    }
    // 音乐开关
    if (tx > b.music.x && tx < b.music.x+b.music.w && ty > b.music.y && ty < b.music.y+b.music.h) {
      Audio.toggleBgmMute();
    }
    // 重置存档
    if (tx > b.reset.x && tx < b.reset.x+b.reset.w && ty > b.reset.y && ty < b.reset.y+b.reset.h) {
      if (typeof window._GameAPI !== 'undefined' && window._GameAPI.resetSave) {
        window._GameAPI.resetSave();
      }
      // Bug2修复: 重置存档后关闭设置面板
      settingsOpen = false;
    }
    // 点击空白区域关闭设置
    if (ty > b.lastBtnBottom || ty < b.topBound) {
      settingsOpen = false;
    }
    updateDOM();
  }

  // ── 设置面板渲染 ──
  function drawSettings(ctx, t) {
    if (!settingsOpen) return;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    var b = _settingsBtnBounds();

    ctx.font = 'bold '+FS.L+'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('设置', W/2, b.sfx.y - 30);

    // 音效
    ctx.fillStyle = CO.PANEL;
    ctx.fillRect(b.sfx.x, b.sfx.y, b.sfx.w, b.sfx.h);
    ctx.strokeStyle = CO.PANEL_BORDER; ctx.lineWidth = 2;
    ctx.strokeRect(b.sfx.x+1, b.sfx.y+1, b.sfx.w-2, b.sfx.h-2);
    ctx.font = FS.M+'px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;
    ctx.fillText('音效: ' + (Audio.isSfxMuted() ? '关' : '开'), W/2, b.sfx.y+23);

    // 音乐
    ctx.fillStyle = CO.PANEL;
    ctx.fillRect(b.music.x, b.music.y, b.music.w, b.music.h);
    ctx.strokeStyle = CO.PANEL_BORDER; ctx.lineWidth = 2;
    ctx.strokeRect(b.music.x+1, b.music.y+1, b.music.w-2, b.music.h-2);
    ctx.font = FS.M+'px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;
    ctx.fillText('音乐: ' + (Audio.isBgmMuted() ? '关' : '开'), W/2, b.music.y+23);

    // 重置存档
    ctx.fillStyle = 'rgba(139,0,0,0.4)';
    ctx.fillRect(b.reset.x, b.reset.y, b.reset.w, b.reset.h);
    ctx.strokeStyle = CO.BLOOD; ctx.lineWidth = 2;
    ctx.strokeRect(b.reset.x+1, b.reset.y+1, b.reset.w-2, b.reset.h-2);
    ctx.font = FS.M+'px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = CO.LANTERN;
    ctx.fillText('重置存档', W/2, b.reset.y+23);

    // 提示
    ctx.font = FS.S+'px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('点击⚙关闭', W/2, b.lastBtnBottom + 30);
  }

  return {
    init: init, draw: draw, updateDOM: updateDOM,
    getShopScrollY: function() { return shopScrollY; },
    setShopScrollY: function(v) { shopScrollY = v; },
    exitCoinMode: function() { coinMode = false; },
    getEffectDesc: getEffectDesc,
    drawSettings: drawSettings,
    isSettingsOpen: function() { return settingsOpen; }
  };
})();
