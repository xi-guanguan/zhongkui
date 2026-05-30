/* physics.js — 碰撞检测 + 判定
 * catchP在结算时判定(同套牛calc: M.random()<p)
 * 依赖：CONFIG, State
 * 暴露：Physics (全局) */

var Physics = (function() {
  // ── 结算: 判定每条链是否抓到鬼 (同套牛calc) ──
  function resolveChains(chains) {
    var catchBonus = State.getCatchBonus();
    var oddsBonus = State.getOddsBonus();
    var buffs = State.get('buffs');
    var totalWin = 0;
    var anyCaught = false;
    var details = [];

    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      var ghostType = CONFIG.GT[chain.ghostType];

      // 基础捕获概率 (同套牛: let p=CT[r.targetCow.type].catchP)
      var catchP = ghostType.catchP + catchBonus;

      // 杨枝甘露: x10概率
      if (chain.isSuper) {
        catchP = Math.min(1.0, catchP * 10);
      }

      // 百香果锁定: 匹配时概率提升
      if (buffs.special_catch && buffs.special_catch.lockedIdx === chain.ghostType) {
        catchP = Math.min(1.0, catchP + 0.15);
      }

      // 爆奖控制 (同套牛burst)
      catchP = applyBurst(catchP, ghostType.id);

      // 判定 (同套牛: M.random()<p)
      var success = Math.random() < catchP;
      var odds = 0;
      if (success) {
        anyCaught = true;
        odds = chain.odds + oddsBonus;
        totalWin += odds;
      }

      details.push({
        ghostType: chain.ghostType,
        success: success,
        odds: odds,
        _shook: false,
        _broke: false,
        _rShook: false
      });
    }

    return { totalWin: totalWin, anyCaught: anyCaught, details: details };
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
    // 高ROI降温
    if (rt > 0.8 && (ghostId === 'HWC' || ghostId === 'BWC' || ghostId === 'XT')) return prob * 0.5;
    // 低ROI保底
    if (rt < 0.4 && (ghostId === 'NT' || ghostId === 'MM')) return prob * 1.5;
    return prob;
  }

  return {
    resolveChains: resolveChains
  };
})();
