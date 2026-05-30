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
  var shopSelectedTea = null; // V3: 当前选中的奶茶
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

        // V3: 商店有选中茶时，主按钮变为"购买"
        if (shopOpen && stage !== 'MINING' && shopSelectedTea) {
          buySelectedTea();
          return;
        }
        if (shopOpen && stage !== 'MINING') {
          State.set('shopOpen', false);
          shopSelectedTea = null;
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
        } else if (shopOpen && shopSelectedTea) {
          // V3: 取消选中
          shopSelectedTea = null;
          State.set('mengpoLine', MengPo.getLine ? MengPo.getLine('enter') : '想喝点什么？');
          State.set('mengpoLineTimer', 2.5);
        } else if (shopOpen) {
          // Bug#4: 返回时清除孟婆对话框
          State.set('shopOpen', false);
          shopSelectedTea = null;
          State.set('mengpoLine', null);
          State.set('mengpoLineTimer', 0);
        } else if (stage === 'IDLE') {
          State.set('shopOpen', true);
          shopScrollY = 0;
          shopSelectedTea = null;
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
    // ★ 重置每局特效标志
    State.set('_bigWinFired', false);
    State.set('_lassoFlash', false);
    State.set('_prevSettleCoins', 0);
    State.changeStage('RUNNING');
    Audio.play('stage');
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
    var hc = State.get('hitCount') + 1;
    State.set('hitCount', hc);
    Audio.play('hit');
    // 连击音效
    if (hc >= 3 && hc % 3 === 0) Audio.play('combo');
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
    // V3: 分界线 counterY=280, 两列布局
    var counterY = 280;
    var listY = counterY + 14;
    var itemH = 32;
    var gap = 4;
    var colW = (W - 16 - gap) / 2;
    var itemsPerRow = 2;
    var clicked = false;
    for (var i = 0; i < teas.length; i++) {
      var row = M.floor(i / itemsPerRow);
      var col = i % itemsPerRow;
      var rx = 8 + col * (colW + gap);
      var ry = listY + row * (itemH + gap) - shopScrollY;
      if (ry < listY || ry > H) continue;
      if (ty > ry && ty < ry + itemH && tx > rx && tx < rx + colW) {
        selectTea(teas[i]);
        clicked = true; break;
      }
    }
    // 请孟婆喝一杯(最后一行, 全宽)
    if (!clicked) {
      var treatRow = M.ceil(teas.length / itemsPerRow);
      var treatY = listY + treatRow * (itemH + gap) - shopScrollY;
      if (ty > treatY && ty < treatY + itemH && tx > 8 && tx < W - 8) {
        buyMengpoTreat(); clicked = true;
      }
    }
    updateDOM();
  }

  // V3: 选中奶茶
  function selectTea(tea) {
    shopSelectedTea = tea;
    // 孟婆介绍该茶
    var desc = tea.name + ' — ' + getEffectDesc(tea) + ', ' + tea.duration + '局有效';
    State.set('mengpoLine', desc);
    State.set('mengpoLineTimer', 4);
  }

  // V3: 购买选中的茶
  function buySelectedTea() {
    if (!shopSelectedTea) return;
    buyTea(shopSelectedTea);
    shopSelectedTea = null;
    State.set('mengpoLine', MengPo.getLine ? MengPo.getLine('buy') : '多谢惠顾~');
    State.set('mengpoLineTimer', 2.5);
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
    Audio.play('buy');
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
      Audio.play('levelup');
      Renderer.spawnFloatingText(W/2, 160, '好感升级! Lv.'+favor.level, CO.COPPER_SHINE);
      if (typeof MengPo !== 'undefined') { State.set('mengpoLine', MengPo.getLine('levelUp')); State.set('mengpoLineTimer', 3); }
    }
  }

  // Bug#3: 道具描述模糊化
  function getEffectDesc(tea) {
    if (tea.type === 'red') {
      if (tea.catchBonus <= 0.02) return '略微提升捕获率';
      if (tea.catchBonus <= 0.035) return '小幅提升捕获率';
      if (tea.catchBonus <= 0.05) return '显著提升捕获率';
      return '大幅提升捕获率';
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
      // V3: 有选中茶时按钮变为购买/取消
      if (shopSelectedTea) {
        var canBuy = State.get('coins') >= shopSelectedTea.price;
        btnAction.textContent = '购买'; btnAction.disabled = !canBuy;
        btnShop.textContent = '取消'; btnShop.style.fontSize = smFontSize; btnShop.disabled = false;
      } else {
        btnAction.textContent = '打工'; btnAction.disabled = false;
        btnShop.textContent = '返回'; btnShop.style.fontSize = smFontSize; btnShop.disabled = false;
      }
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

    // ★ 像素钟馗 V2: 16×32 精致像素立绘 + 呼吸金光
    var cx = M.floor(x), cy = M.floor(y);
    var breathY = M.floor(M.sin(t * 1.8) * 1.5);
    var breathS = 1 + M.sin(t * 1.8) * 0.03;
    var wingB = M.floor(M.sin(t * 2.5) * 1.5);

    ctx.save();
    ctx.translate(cx, cy + breathY);
    ctx.scale(breathS, breathS);
    ctx.translate(-cx, -(cy + breathY));

    // 底座阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 8, cy + 16, 16, 3);

    // 呼吸金光
    ctx.shadowColor = CO.COPPER_SHINE;
    ctx.shadowBlur = 4 + M.sin(t * 2) * 3;

    // L7: 帽翅
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(cx - 11 + wingB, cy - 26, 4, 3);
    ctx.fillRect(cx + 7 + wingB, cy - 26, 4, 3);
    ctx.fillStyle = CO.COPPER;
    ctx.fillRect(cx - 10 + wingB, cy - 25, 2, 1);
    ctx.fillRect(cx + 8 + wingB, cy - 25, 2, 1);

    // L6: 官帽顶
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(cx - 6, cy - 26, 12, 5);
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillRect(cx - 6, cy - 26, 12, 1);
    ctx.fillRect(cx - 6, cy - 22, 1, 1);
    ctx.fillRect(cx + 5, cy - 22, 1, 1);
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillRect(cx - 1, cy - 28, 2, 2);

    // L5: 额头+眉毛
    ctx.fillStyle = CO.BONE;
    ctx.fillRect(cx - 5, cy - 21, 10, 3);
    ctx.fillStyle = CO.CHAIN;
    ctx.fillRect(cx - 4, cy - 20, 3, 1);
    ctx.fillRect(cx + 1, cy - 20, 3, 1);

    ctx.shadowBlur = 0;

    // L4: 脸 + 丹凤眼
    ctx.fillStyle = CO.BONE;
    ctx.fillRect(cx - 5, cy - 18, 10, 8);
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(cx - 4, cy - 15, 2, 2);
    ctx.fillRect(cx - 3, cy - 16, 2, 1);
    ctx.fillRect(cx + 2, cy - 15, 2, 2);
    ctx.fillRect(cx + 3, cy - 16, 2, 1);
    ctx.fillStyle = CO.WHITE;
    ctx.fillRect(cx - 3, cy - 15, 1, 1);
    ctx.fillRect(cx + 3, cy - 15, 1, 1);

    // L3: 胡须
    ctx.fillStyle = CO.CHAIN;
    ctx.fillRect(cx - 3, cy - 10, 1, 4);
    ctx.fillRect(cx - 1, cy - 10, 1, 5);
    ctx.fillRect(cx + 1, cy - 10, 1, 5);
    ctx.fillRect(cx + 3, cy - 10, 1, 4);
    ctx.fillRect(cx - 4, cy - 7, 1, 2);
    ctx.fillRect(cx + 4, cy - 7, 1, 2);

    // L2: 红袍 + 云纹
    ctx.fillStyle = CO.BLOOD;
    ctx.fillRect(cx - 7, cy - 10, 14, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 5, cy - 6, 3, 2);
    ctx.fillRect(cx + 2, cy - 3, 3, 2);
    ctx.fillRect(cx - 4, cy + 1, 2, 3);
    ctx.fillRect(cx + 1, cy + 3, 3, 2);
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillRect(cx - 7, cy + 7, 14, 1);

    // L1: 腰带 + 玉佩
    ctx.fillStyle = CO.COPPER;
    ctx.fillRect(cx - 8, cy + 2, 16, 4);
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillRect(cx - 8, cy + 2, 16, 1);
    ctx.fillStyle = '#21BDAE';
    ctx.fillRect(cx - 1, cy + 4, 2, 3);
    ctx.fillStyle = CO.WHITE;
    ctx.fillRect(cx - 1, cy + 4, 1, 1);

    // L0: 腿 + 靴
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(cx - 5, cy + 8, 4, 10);
    ctx.fillRect(cx + 1, cy + 8, 4, 10);
    ctx.fillStyle = CO.DUSK;
    ctx.fillRect(cx - 6, cy + 15, 6, 3);
    ctx.fillRect(cx + 0, cy + 15, 6, 3);
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(cx - 6, cy + 17, 6, 1);
    ctx.fillRect(cx + 0, cy + 17, 6, 1);

    ctx.restore();

    // 链环: 移到头顶+牛仔式晃荡旋转
    var chainCount = 0;
    if (stage === 'IDLE' && coinMode) chainCount = State.get('coinsInserted');
    else if (stage === 'RUNNING') chainCount = State.get('roundCoins');
    for (var i = 0; i < chainCount; i++) {
      var col = i % 3;
      var row = M.floor(i / 3);
      // 水平散开，位于头顶上方
      var baseX = cx - 10 + col * 10;
      var baseY = cy - 32 - row * 6;
      // 牛仔式晃荡: 水平旋转+垂直摆动
      var swingAngle = M.sin(t * 2.5 + i * 1.3) * 0.4;
      var swayY = M.sin(t * 3 + i * 0.8) * 2;
      var ox = baseX + M.sin(swingAngle) * 6;
      var oy = baseY + swayY;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(swingAngle);
      ctx.strokeStyle = CO.CHAIN; ctx.lineWidth = 1.5;
      ctx.shadowColor = CO.CHAIN_GLOW; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.5, 0, 0, M.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      // 链节高光
      ctx.fillStyle = '#8899AA';
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    }
  }

  setInterval(function() { updateDOM(); }, 200);

  // ── 设置面板按钮边界(统一计算, 消除Bug1偏移) ──
  function _settingsBtnBounds() {
    var centerY = 160;
    var btnW = 200, btnH = 36, gap = 10;
    var sfxY = centerY;
    var musicY = sfxY + gap + btnH;
    var trackY = musicY + gap + btnH;
    var resetY = trackY + gap + btnH;
    return {
      sfx:   { x: W/2-btnW/2, y: sfxY,   w: btnW, h: btnH },
      music: { x: W/2-btnW/2, y: musicY, w: btnW, h: btnH },
      track: { x: W/2-btnW/2, y: trackY, w: btnW, h: btnH },
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
    // 切换曲目
    if (tx > b.track.x && tx < b.track.x+b.track.w && ty > b.track.y && ty < b.track.y+b.track.h) {
      Audio.cycleBGM();
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

    // 切换曲目
    ctx.fillStyle = CO.PANEL;
    ctx.fillRect(b.track.x, b.track.y, b.track.w, b.track.h);
    ctx.strokeStyle = CO.COPPER; ctx.lineWidth = 2;
    ctx.strokeRect(b.track.x+1, b.track.y+1, b.track.w-2, b.track.h-2);
    ctx.font = FS.M+'px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;
    var trackNames = {idle:'地府夜行', shop:'奈何桥铺', mining:'阴河撑船'};
    ctx.fillText('曲目: ' + (trackNames[Audio.getCurrentBGM()] || '地府夜行'), W/2, b.track.y+23);

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
    getSelectedTea: function() { return shopSelectedTea; },
    exitCoinMode: function() { coinMode = false; },
    getEffectDesc: getEffectDesc,
    drawSettings: drawSettings,
    isSettingsOpen: function() { return settingsOpen; }
  };
})();
