/* state.js — GameState 响应式状态 + 阶段机
 * 依赖：CONFIG
 * 暴露：State (全局) */

var State = (function() {
  var _listeners = {};
  var _data = {
    // ── 阶段机 ──
    stage: 'MENU',  // MENU → ROUND → PAT → RESULT → SHOP → MINING → SHOP_BACK
    prevStage: null,

    // ── 核心状态 ──
    coins: CONFIG.START_COINS,
    currentGhostIdx: 0,  // 当前鬼轮番索引
    lockedGhostIdx: -1,  // 百香果锁定的鬼(-1=未锁定)
    lockedRounds: 0,     // 百香果锁定剩余回合

    // ── 回合数据 ──
    betAmount: 1,        // 投币数(1~5)
    chains: [],          // 当前回合的链[{caught:bool, odds:number, catchP:number}]
    hitCount: 0,         // 拍打次数(纯表演)
    hitTimer: 0,         // 拍打阶段计时

    // ── buff系统 ──
    buffs: {
      red: null,   // {value:1.5pp, remaining:5}
      green: null,  // {value:2, remaining:5}
      special_catch: null,  // {lockedIdx:2, remaining:3}
      special_super: null   // {remaining:1}
    },

    // ── 好感 ──
    favor: { level:1, exp:0 },

    // ── ROI滑动窗口 ──
    roiHistory: [],     // 最近10局盈亏
    recentROI: 0.5,    // 计算值

    // ── 打工 ──
    miningTimer: 0,
    miningCoins: [],

    // ── 孟婆对话 ──
    mengpoLine: null,
    mengpoLineTimer: 0,

    // ── 场景时间 ──
    roundTimer: 0,
    resultTimer: 0,
    transitionAlpha: 0,

    // ── 抖动 ──
    shake: { x:0, y:0, t:0 },

    // ── 帧时间 ──
    time: 0
  };

  function set(key, val) {
    _data[key] = val;
    var fns = _listeners[key];
    if (fns) { for (var i = 0; i < fns.length; i++) fns[i](val); }
  }

  function get(key) {
    return _data[key];
  }

  function on(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
  }

  // ── 阶段切换 ──
  function changeStage(newStage) {
    _data.prevStage = _data.stage;
    _data.stage = newStage;
    var fns = _listeners['stage'];
    if (fns) { for (var i = 0; i < fns.length; i++) fns[i](newStage); }
  }

  // ── 获取当前鬼类型(用于HUD显示) ──
  function currentGhost() {
    // 百香果锁定
    if (_data.lockedGhostIdx >= 0) return CONFIG.GT[_data.lockedGhostIdx];
    // 从鬼队列获取(最接近中央的鬼)
    if (typeof Ghosts !== 'undefined' && Ghosts.getTargets) {
      var targets = Ghosts.getTargets(1);
      if (targets.length > 0) return CONFIG.GT[targets[0].type];
    }
    // 兜底
    return CONFIG.GT[0];
  }

  // ── 推进鬼锁定回合 ──
  function advanceGhost() {
    if (_data.lockedRounds > 0) {
      _data.lockedRounds--;
      if (_data.lockedRounds <= 0) {
        _data.lockedGhostIdx = -1;
        _data.buffs.special_catch = null;
      }
    }
    // 鬼队列自己管理循环，不再轮番推进
  }
      }
    } else {
      _data.currentGhostIdx = (_data.currentGhostIdx + 1) % CONFIG.GT.length;
    }
  }

  // ── ROI计算 (同套牛payoutHistory: 存{spent,won}) ──
  function updateROI(record) {
    _data.roiHistory.push(record);
    if (_data.roiHistory.length > CONFIG.ROI.windowSize) {
      _data.roiHistory.shift();
    }
    if (_data.roiHistory.length === 0) { _data.recentROI = 0.5; return; }
    var spent = 0, won = 0;
    for (var i = 0; i < _data.roiHistory.length; i++) {
      spent += _data.roiHistory[i].spent;
      won += _data.roiHistory[i].won;
    }
    _data.recentROI = spent > 0 ? won / spent : 0.5;
  }

  // ── buff 获取当前加成 ──
  function getCatchBonus() {
    return _data.buffs.red ? _data.buffs.red.value : 0;
  }

  function getOddsBonus() {
    return _data.buffs.green ? _data.buffs.green.value : 0;
  }

  // ── 回合结束：buff remaining-- ──
  function tickBuffs() {
    var types = ['red', 'green', 'special_catch', 'special_super'];
    for (var i = 0; i < types.length; i++) {
      var b = _data.buffs[types[i]];
      if (b) {
        b.remaining--;
        if (b.remaining <= 0) {
          _data.buffs[types[i]] = null;
        }
      }
    }
  }

  // ── 好感升级检查 ──
  function checkFavorLevelUp() {
    var lv = _data.favor.level;
    if (lv >= 5) return false;
    var needed = CONFIG.FAVOR_LEVELS[lv].expNeeded; // index=level, 0-based偏移
    // FAVOR_LEVELS[0]=Lv1, [1]=Lv2...
    // 升级到Lv2需要3杯,即FAVOR_LEVELS[1].expNeeded=3
    var nextNeeded = CONFIG.FAVOR_LEVELS[lv].expNeeded;
    if (_data.favor.exp >= nextNeeded) {
      _data.favor.level++;
      return true;
    }
    return false;
  }

  // ── 打工收入 ──
  function getMiningIncome() {
    var lv = _data.favor.level;
    for (var i = CONFIG.FAVOR_LEVELS.length - 1; i >= 0; i--) {
      if (CONFIG.FAVOR_LEVELS[i].level <= lv) return CONFIG.FAVOR_LEVELS[i].miningIncome;
    }
    return CONFIG.FAVOR_LEVELS[0].miningIncome;
  }

  return {
    set: set,
    get: get,
    on: on,
    changeStage: changeStage,
    currentGhost: currentGhost,
    advanceGhost: advanceGhost,
    updateROI: updateROI,
    getCatchBonus: getCatchBonus,
    getOddsBonus: getOddsBonus,
    tickBuffs: tickBuffs,
    checkFavorLevelUp: checkFavorLevelUp,
    getMiningIncome: getMiningIncome,
    _data: _data  // 调试用
  };
})();
