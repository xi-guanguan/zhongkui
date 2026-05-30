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

  function init(canvas) {
    ctx = canvas.getContext('2d');
  }

  // ── 清屏 ──
  function clear() {
    ctx.fillStyle = CO.VOID;
    ctx.fillRect(0, 0, W, H);
  }

  // ── HUD顶栏 ──
  function drawHUD() {
    var coins = State.get('coins');
    var stage = State.get('stage');
    var ghost = State.currentGhost();
    var favor = State.get('favor');

    // 背景
    ctx.fillStyle = 'rgba(13,13,26,0.9)';
    ctx.fillRect(0, 0, W, LY.HUD_H);

    // 铜钱数
    ctx.font = FS.M + 'px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = CO.COPPER;
    ctx.fillText('\u2B50 ' + coins, 10, 30);

    // 波次/鬼名
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;
    if (stage === 'ROUND' || stage === 'PAT' || stage === 'RESULT') {
      ctx.fillText(ghost.name + ' (' + ghost.catchP*100 + '%)', W/2, 30);
    } else {
      ctx.fillText(stage, W/2, 30);
    }

    // 好感等级
    ctx.textAlign = 'right';
    ctx.fillStyle = CO.LANTERN;
    ctx.fillText('Lv.' + favor.level, W - 10, 30);

    // buff图标
    var buffs = State.get('buffs');
    var bx = W - 50;
    if (buffs.red) {
      ctx.fillStyle = '#CC3333';
      ctx.fillRect(bx, 10, 14, 14);
      bx -= 18;
    }
    if (buffs.green) {
      ctx.fillStyle = '#33CC33';
      ctx.fillRect(bx, 10, 14, 14);
      bx -= 18;
    }
  }

  // ── 底栏 ──
  function drawBottomBar() {
    var stage = State.get('stage');
    ctx.fillStyle = 'rgba(13,13,26,0.9)';
    ctx.fillRect(0, LY.BOTTOM_Y, W, LY.BOTTOM_H);

    ctx.font = FS.M + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;

    if (stage === 'MENU') {
      ctx.fillText('[ 开始游戏 ]', W/2, LY.BOTTOM_Y + 45);
    } else if (stage === 'RESULT') {
      ctx.fillText('[ 继续 ]', W/2, LY.BOTTOM_Y + 45);
    } else if (stage === 'SHOP') {
      ctx.fillText('[ 打工 ]', W/2 - 60, LY.BOTTOM_Y + 45);
      ctx.fillText('[ 返回 ]', W/2 + 60, LY.BOTTOM_Y + 45);
    } else if (stage === 'MINING') {
      // 打工HUD由mining模块绘制
    }
  }

  // ── 投币选择器 ──
  function drawCoinSelector() {
    var bet = State.get('betAmount');
    var y = LY.BOTTOM_Y + 10;
    ctx.font = FS.S + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;
    ctx.fillText('投币:', 40, y + 12);
    for (var i = 1; i <= 5; i++) {
      ctx.fillStyle = (i <= bet) ? CO.COPPER : '#333';
      ctx.fillRect(65 + (i-1)*48, y, 42, 24);
      ctx.fillStyle = (i <= bet) ? CO.VOID : '#666';
      ctx.fillText(i, 86 + (i-1)*48, y + 17);
    }
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
    var bx = (W - bw)/2, by = 120;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = CO.CHAIN_GLOW;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.font = FS.S + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CO.BONE;
    ctx.fillText(line, W/2, by + 25);
    ctx.restore();
  }

  // ── 粒子 ──
  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count && particles.length < 30; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 30 + Math.random() * 60;
      particles.push({
        x:x, y:y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        life:1, color:color, size:2+Math.random()*3
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
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ── 飘字 ──
  function spawnFloatingText(x, y, text, color) {
    if (floatingTexts.length >= 10) floatingTexts.shift();
    floatingTexts.push({ x:x, y:y, text:text, color:color, life:1.5 });
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
    if (s.t > 0) {
      ctx.translate(s.x, s.y);
    }
  }

  function triggerShake(intensity) {
    State.set('shake', { x:(Math.random()-0.5)*intensity, y:(Math.random()-0.5)*intensity, t:0.15 });
  }

  function updateShake(dt) {
    var s = State.get('shake');
    if (s.t > 0) {
      s.t -= dt;
      s.x = (Math.random()-0.5) * s.t * 40;
      s.y = (Math.random()-0.5) * s.t * 40;
      if (s.t <= 0) { s.x = 0; s.y = 0; s.t = 0; }
    }
  }

  // ── 色块占位渲染 ──
  function drawPlaceholder(x, y, w, h, color, label) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    if (label) {
      ctx.font = FS.S + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFF';
      ctx.fillText(label, x + w/2, y + h/2 + 4);
    }
  }

  return {
    init:init, clear:clear, drawHUD:drawHUD, drawBottomBar:drawBottomBar,
    drawCoinSelector:drawCoinSelector, drawMengpoLine:drawMengpoLine,
    spawnParticles:spawnParticles, updateParticles:updateParticles,
    drawParticles:drawParticles, spawnFloatingText:spawnFloatingText,
    updateFloatingTexts:updateFloatingTexts, drawFloatingTexts:drawFloatingTexts,
    applyShake:applyShake, triggerShake:triggerShake, updateShake:updateShake,
    drawPlaceholder:drawPlaceholder,
    getCtx: function() { return ctx; }
  };
})();
