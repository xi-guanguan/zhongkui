/* renderer.js — Canvas 绘制基础层：背景、粒子、特效、HUD
 * 依赖：CONFIG, State
 * 暴露：Renderer (全局) */

var Renderer = (function() {
  var ctx = null;
  var W = CONFIG.W, H = CONFIG.H;
  var LY = CONFIG.LY, CO = CONFIG.CO, FS = CONFIG.FS;

  // ── 粒子池 ──
  var particles = [];
  var floatingTexts = [];

  // ── T2.2 堆叠精灵图缓存 ──
  var _stackCache = {}; // key -> OffscreenCanvas

  function init(canvas) {
    ctx = canvas.getContext('2d');
  }

  // ── 堆叠精灵图: 从下往上逐层绘制, 每层Y偏移1px ──
  function drawStackedSprite(ctx2d, layers, x, y, scale) {
    scale = scale || 1;
    for (var i = 0; i < layers.length; i++) {
      var ly = layers[i];
      if (typeof ly === 'string') {
        ctx2d.fillStyle = ly;
        ctx2d.fillRect(x, y - i * scale, 1, 1);
      } else if (ly && ly.w) {
        ctx2d.fillStyle = ly.c || '#FFF';
        ctx2d.fillRect(x + (ly.ox || 0), y - i * scale + (ly.oy || 0), ly.w, ly.h || 1);
      }
    }
  }

  // ── 预渲染堆叠精灵到OffscreenCanvas ──
  function prerenderStacked(layers, scale, w, h) {
    var key = '';
    for (var i = 0; i < layers.length; i++) {
      var ly = layers[i];
      key += (ly && ly.c ? ly.c : String(ly)) + ',' + (ly && ly.w ? ly.w : 0) + ',' + (ly && ly.ox ? ly.ox : 0) + ';';
    }
    if (_stackCache[key]) return _stackCache[key];

    var off = document.createElement('canvas');
    off.width = w || 32; off.height = h || 32;
    var oc = off.getContext('2d');
    drawStackedSprite(oc, layers, w ? w / 2 : 16, h ? h - 2 : 30, scale);
    _stackCache[key] = off;
    return off;
  }

  // ── 预渲染铜钱堆叠(3层: 顶/底=方孔全貌, 中间=边缘环) ──
  function prerenderCoinStack(size) {
    var key = 'coin_' + size;
    if (_stackCache[key]) return _stackCache[key];

    var off = document.createElement('canvas');
    off.width = size + 4; off.height = size + 6;
    var oc = off.getContext('2d');
    var hs = size / 2;

    // 底层(完整面)
    oc.fillStyle = '#CD7F32';
    oc.fillRect(2, 4, size, size);
    oc.fillStyle = '#0D0D1A';
    oc.fillRect(2 + hs - 2, 4 + hs - 2, 4, 4);

    // 中层(边缘环)
    oc.fillStyle = '#B87333';
    oc.fillRect(1, 2, size + 2, size + 2);
    oc.fillStyle = '#CD7F32';
    oc.fillRect(2, 3, size, size);
    oc.fillStyle = '#0D0D1A';
    oc.fillRect(2 + hs - 2, 3 + hs - 2, 4, 4);

    // 顶层(完整面)
    oc.fillStyle = '#FFD700';
    oc.fillRect(0, 0, size, size);
    oc.fillStyle = '#0D0D1A';
    oc.fillRect(hs - 2, hs - 2, 4, 4);
    // 高光
    oc.fillStyle = 'rgba(255,255,255,0.3)';
    oc.fillRect(1, 1, size - 2, 2);

    _stackCache[key] = off;
    return off;
  }

  // ── 绘制预渲染铜钱 ──
  function drawCoin(ctx2d, x, y, size, rotation) {
    var img = prerenderCoinStack(size);
    ctx2d.save();
    ctx2d.translate(x, y);
    if (rotation) ctx2d.rotate(rotation);
    ctx2d.drawImage(img, -img.width / 2, -img.height / 2);
    ctx2d.restore();
  }

  // ── 清屏 ──
  function clear() {
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(0, 0, W, H);
  }

  // ── T2.4 HUD顶栏: PixelForge风格 ──
  function drawHUD() {
    var coins = State.get('coins');
    var stage = State.get('stage');
    var favor = State.get('favor');

    // 背景(深暗底色 #0F0F23)
    ctx.fillStyle = '#0F0F23';
    ctx.fillRect(0, 0, W, LY.HUD_H);
    // 2px内描边(暗色变体)
    ctx.strokeStyle = CO.PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, W - 2, LY.HUD_H - 2);

    // 铜钱图标(小方块+描边)
    ctx.fillStyle = CO.COPPER;
    ctx.fillRect(6, 6, 10, 10);
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(9, 9, 4, 4);

    // 铜钱数(先stroke后fill, PixelForge文字)
    ctx.font = FS.M + 'px monospace';
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText('' + coins, 20, 20);
    ctx.fillStyle = CO.COPPER_SHINE;
    ctx.fillText('' + coins, 20, 20);

    // 阶段名(居中)
    ctx.textAlign = 'center';
    var stageLabel = stage;
    if (stage === 'RUNNING') stageLabel = '丢索';
    else if (stage === 'HITTING') stageLabel = '拉扯!';
    else if (stage === 'RESULT') stageLabel = '判定';
    else if (stage === 'SETTLE') stageLabel = '结算';
    else if (stage === 'IDLE') stageLabel = '待机';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(stageLabel, W / 2, 20);
    ctx.fillStyle = CO.BONE;
    ctx.fillText(stageLabel, W / 2, 20);

    // 好感等级(右侧)
    ctx.textAlign = 'right';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText('Lv.' + favor.level, W - 10, 20);
    ctx.fillStyle = CO.LANTERN;
    ctx.fillText('Lv.' + favor.level, W - 10, 20);

    // buff图标(带稀有度色边框)
    var buffs = State.get('buffs');
    var bx = W - 60;
    if (buffs.red) {
      drawBuffIcon(bx, 4, '#CC3333', '捕');
      bx -= 16;
    }
    if (buffs.green) {
      drawBuffIcon(bx, 4, '#33CC33', '赔');
      bx -= 16;
    }
    if (buffs.special_catch) {
      drawBuffIcon(bx, 4, CO.COPPER_SHINE, '锁');
      bx -= 16;
    }
    if (buffs.special_super) {
      drawBuffIcon(bx, 4, '#FF8800', '超');
    }

    // HUD底边线
    ctx.fillStyle = CO.CHAIN;
    ctx.fillRect(0, LY.HUD_H, W, 1);
  }

  // ── buff图标: 背景+2px稀有度边框 ──
  function drawBuffIcon(x, y, color, label) {
    ctx.fillStyle = CO.PANEL;
    ctx.fillRect(x, y, 12, 12);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, 10, 10);
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(label, x + 6, y + 9);
  }

  // ── 孟婆对话气泡 ──
  function drawMengpoLine() {
    var line = State.get('mengpoLine');
    var timer = State.get('mengpoLineTimer');
    if (!line || timer <= 0) return;

    var alpha = Math.min(1, timer);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(13,13,26,0.85)';
    var bw = 260, bh = 40;
    var bx = (W - bw) / 2, by = 120;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = CO.CHAIN_GLOW;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.font = FS.S + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;
    ctx.fillText(line, W / 2, by + 25);
    ctx.restore();
  }

  // ── 粒子 ──
  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count && particles.length < 30; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 30 + Math.random() * 60;
      particles.push({
        x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, color: color, size: 2 + Math.random() * 3
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.5;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ── 飘字 ──
  function spawnFloatingText(x, y, text, color) {
    if (floatingTexts.length >= 10) floatingTexts.shift();
    floatingTexts.push({ x: x, y: y, text: text, color: color, life: 1.5 });
  }

  function updateFloatingTexts(dt) {
    for (var i = floatingTexts.length - 1; i >= 0; i--) {
      var f = floatingTexts[i];
      f.y -= 30 * dt;
      f.life -= dt;
      if (f.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  function drawFloatingTexts() {
    ctx.font = 'bold ' + FS.L + 'px monospace';
    ctx.textAlign = 'center';
    for (var i = 0; i < floatingTexts.length; i++) {
      var f = floatingTexts[i];
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ── 震屏 ──
  function applyShake() {
    var s = State.get('shake');
    if (s.t > 0) ctx.translate(s.x, s.y);
  }

  function triggerShake(intensity) {
    State.set('shake', { x: (Math.random() - 0.5) * intensity, y: (Math.random() - 0.5) * intensity, t: 0.15 });
  }

  // ── T2.5 GameJuice: 屏幕闪白 ──
  function triggerFlash(color, duration) {
    _flashColor = color || '#FFF';
    _flashTimer = duration || 0.3;
  }
  var _flashColor = '#FFF', _flashTimer = 0;

  function updateFlash(dt) {
    if (_flashTimer > 0) _flashTimer -= dt;
  }

  function drawFlash() {
    if (_flashTimer <= 0) return;
    ctx.globalAlpha = _flashTimer * 2;
    ctx.fillStyle = _flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // ── 鬼消散粒子(抓到鬼→向中心收缩粒子) ──
  function spawnDissolveParticles(x, y, color, count) {
    for (var i = 0; i < count && particles.length < 30; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 20 + Math.random() * 40;
      particles.push({
        x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, color: color, size: 2 + Math.random() * 3,
        mode: 'dissolve', shrink: true
      });
    }
  }

  // ── 铜钱飞入动画(从目标位置飞向HUD) ──
  var coinFlies = [];
  function spawnCoinFly(fromX, fromY, toX, toY) {
    coinFlies.push({ x: fromX, y: fromY, tx: toX, ty: toY, life: 1, size: 10 });
  }

  function updateCoinFlies(dt) {
    for (var i = coinFlies.length - 1; i >= 0; i--) {
      var c = coinFlies[i];
      c.life -= dt * 1.5;
      c.x += (c.tx - c.x) * dt * 5;
      c.y += (c.ty - c.y) * dt * 5;
      c.size = Math.max(2, c.size - dt * 6);
      if (c.life <= 0) coinFlies.splice(i, 1);
    }
  }

  function drawCoinFlies() {
    for (var i = 0; i < coinFlies.length; i++) {
      var c = coinFlies[i];
      ctx.globalAlpha = c.life;
      drawCoin(ctx, c.x, c.y, c.size, 0);
    }
    ctx.globalAlpha = 1;
  }

  function updateShake(dt) {
    var s = State.get('shake');
    if (s.t > 0) {
      s.t -= dt;
      s.x = (Math.random() - 0.5) * s.t * 40;
      s.y = (Math.random() - 0.5) * s.t * 40;
      if (s.t <= 0) { s.x = 0; s.y = 0; s.t = 0; }
    }
  }

  return {
    init: init, clear: clear, drawHUD: drawHUD, drawMengpoLine: drawMengpoLine,
    spawnParticles: spawnParticles, updateParticles: updateParticles,
    drawParticles: drawParticles, spawnFloatingText: spawnFloatingText,
    updateFloatingTexts: updateFloatingTexts, drawFloatingTexts: drawFloatingTexts,
    applyShake: applyShake, triggerShake: triggerShake, updateShake: updateShake,
    // T2.2 堆叠精灵图
    drawStackedSprite: drawStackedSprite, prerenderStacked: prerenderStacked,
    drawCoin: drawCoin, prerenderCoinStack: prerenderCoinStack,
    // T2.5 GameJuice
    triggerFlash: triggerFlash, updateFlash: updateFlash, drawFlash: drawFlash,
    spawnDissolveParticles: spawnDissolveParticles,
    spawnCoinFly: spawnCoinFly, updateCoinFlies: updateCoinFlies, drawCoinFlies: drawCoinFlies,
    getCtx: function() { return ctx; }
  };
})();
