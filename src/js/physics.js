/* physics.js — 钩链物理：绳索模拟、碰撞检测
 * 依赖：CONFIG, State
 * 暴露：Physics (全局) */

var Physics = (function() {
  // ── 链判定(投币瞬间骰好) ──
  function rollChains(betAmount) {
    var ghost = State.currentGhost();
    var catchBonus = State.getCatchBonus();
    var oddsBonus = State.getOddsBonus();
    var buffs = State.get('buffs');
    var chains = [];

    for (var i = 0; i < betAmount; i++) {
      var isSuperChain = (buffs.special_super && i === 0);
      var catchP = ghost.catchP + catchBonus;
      if (isSuperChain) {
        catchP = Math.min(1.0, catchP * 10);
      }
      var caught = Math.random() < catchP;
      var odds = 0;
      if (caught) {
        odds = ghost.oddsMin + Math.floor(Math.random() * (ghost.oddsMax - ghost.oddsMin + 1));
        odds += oddsBonus;
      }
      chains.push({ caught:caught, odds:odds, isSuper:isSuperChain });
    }
    return chains;
  }

  // ── 碰撞检测(圆形) ──
  function circleHit(x1, y1, r1, x2, y2, r2) {
    var dx = x1 - x2, dy = y1 - y2;
    var dist = Math.sqrt(dx*dx + dy*dy);
    return dist < r1 + r2;
  }

  return {
    rollChains: rollChains,
    circleHit: circleHit
  };
})();
