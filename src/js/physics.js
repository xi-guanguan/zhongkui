/* physics.js — 碰撞检测
 * catchP在结算时判定(同套牛calc: M.random()<p)
 * 依赖：CONFIG, State
 * 暴露：Physics (全局) */

var Physics = (function() {
  // ── 碰撞检测(圆形) ──
  function circleHit(x1, y1, r1, x2, y2, r2) {
    var dx = x1 - x2, dy = y1 - y2;
    var dist = Math.sqrt(dx*dx + dy*dy);
    return dist < r1 + r2;
  }

  // ── 结算: 判定每条链是否抓到鬼 (同套牛calc) ──
  // catchP是套住后被抓的概率, 不是出现概率
  function resolveChains(chains) {
    var catchBonus = State.getCatchBonus();
    var oddsBonus = State.getOddsBonus();
    var buffs = State.get('buffs');
    var totalWin = 0;
    var anyCaught = false;

    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      var ghostType = CONFIG.GT[chain.ghostType];

      // 基础捕获概率 (同套牛: let p=CT[r.targetCow.type].catchP)
      var catchP = ghostType.catchP + catchBonus;

      // 杨枝甘露: x10概率
      if (chain.isSuper) {
        catchP = Math.min(1.0, catchP * 10);
      }

      // 百香果锁定: 如果锁定了某种鬼，且当前鬼匹配，概率提升
      if (buffs.special_catch && buffs.special_catch.lockedIdx === chain.ghostType) {
        catchP = Math.min(1.0, catchP + 0.15);
      }

      // 爆奖控制 (同套牛burst)
      catchP = applyBurst(catchP, ghostType.id);

      // 判定 (同套牛: M.random()<p)
      chain.caught = Math.random() < catchP;

      if (chain.caught) {
        anyCaught = true;
        // 赔率加成
        var odds = chain.odds + oddsBonus;
        chain.finalOdds = odds;
        totalWin += odds;
      } else {
        chain.finalOdds = 0;
      }
    }

    return { totalWin: totalWin, anyCaught: anyCaught };
  }

  // ── 爆奖控制 (同套牛burst) ──
  function applyBurst(prob, ghostId) {
    var history = State.get('roiHistory');
    if (!history || history.length < 10) return prob;
    var recent = history.slice(-10);
    var spent = 0, won = 0;
    for (var i = 0; i < recent.length; i++) {
      spent += recent[i].spent;
      won += recent[i].won;
    }
    if (!spent) return prob;
    var rt = won / spent;
    // 高ROI降温(降低D/E鬼概率)
    if (rt > 0.8 && (ghostId === 'HWC' || ghostId === 'BWC' || ghostId === 'XT')) return prob * 0.5;
    // 低ROI保底(提升A/B鬼概率)
    if (rt < 0.4 && (ghostId === 'NT' || ghostId === 'MM')) return prob * 1.5;
    return prob;
  }

  return {
    resolveChains: resolveChains,
    circleHit: circleHit
  };
})();
