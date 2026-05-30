/* state.js — GameState 响应式状态 + 阶段机
 * 阶段流程: IDLE→RUNNING(手动丢索)→LASSO(链动画)→HITTING(拉扯)→RESULT→SETTLE
 * 依赖：CONFIG
 * 暴露：State (全局) */

var State = (function() {
  var _listeners = {};
  var _data = {
    // ── 阶段机 ──
    // IDLE=待机投币, RUNNING=鬼群跑过(手动丢索),
    // LASSO=丢链动画, HITTING=拉扯(双向位移), RESULT=判定动画, SETTLE=结算
    stage: 'IDLE',
    prevStage: null,

    // ── 核心状态 ──
    coins: CONFIG.START_COINS,
    coinsInserted: 0,    // 已投币数 (同套牛)
    maxCoins: 5,          // 最多投5币 (同套牛)

    // ── 回合数据 ──
    chains: [],           // 当前回合的链
    hitCount: 0,          // 拉扯次数
    hitTimer: 0,          // 拉扯计时
    hitMax: 6,            // 拉扯最长时间
    roundResult: null,    // 判定结果 (同套牛)
    roundCoins: 0,        // 本轮投币数 (同套牛)
    totalWin: 0,          // 本轮赢得 (同套牛)
    settleCoinsPaid: 0,   // 结算已支付 (同套牛)

    // ── 跑过阶段(保留兼容, 已改为手动丢索) ──
    runningSubPhase: 'OBSERVE',
    observeTimer: 8,
    countdownTimer: 5,

    // ── buff系统 ──
    buffs: {
      red: null,
      green: null,
      special_catch: null,
      special_super: null
    },

    // ── 好感 ──
    favor: { level: 1, exp: 0 },

    // ── ROI滑动窗口 (同套牛payoutHistory) ──
    roiHistory: [],
    recentROI: 0.5,

    // ── 打工 ──
    miningTimer: 0,
    miningCoins: [],

    // ── 孟婆对话 ──
    mengpoLine: null,
    mengpoLineTimer: 0,
    shopOpen: false,     // 孟婆商店是否打开 (同套牛GS.shopOpen)

    // ── 场景时间 ──
    stageTimer: 0,       // 当前阶段已过时间 (同套牛se)

    // ── 震动 ──
    shake: { x: 0, y: 0, t: 0 },

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
    _data.stageTimer = 0;
    var fns = _listeners['stage'];
    if (fns) { for (var i = 0; i < fns.length; i++) fns[i](newStage); }
  }

  // ── 获取当前最近中央鬼类型(用于HUD) ──
  function currentGhost() {
    if (typeof Ghosts !== 'undefined' && Ghosts.getTargets) {
      var targets = Ghosts.getTargets(1);
      if (targets.length > 0) return CONFIG.GT[targets[0].type];
    }
    return CONFIG.GT[0];
  }

  // ── ROI计算 (同套牛payoutHistory) ──
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

  // ── buff ──
  function getCatchBonus() {
    return _data.buffs.red ? _data.buffs.red.value : 0;
  }
  function getOddsBonus() {
    return _data.buffs.green ? _data.buffs.green.value : 0;
  }

  // ── buff remaining-- ──
  function tickBuffs() {
    var types = ['red', 'green', 'special_catch', 'special_super'];
    for (var i = 0; i < types.length; i++) {
      var b = _data.buffs[types[i]];
      if (b) {
        b.remaining--;
        if (b.remaining <= 0) _data.buffs[types[i]] = null;
      }
    }
  }

  // ── 好感升级检查 ──
  function checkFavorLevelUp() {
    var lv = _data.favor.level;
    if (lv >= 5) return false;
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
    set: set, get: get, on: on,
    changeStage: changeStage,
    currentGhost: currentGhost,
    updateROI: updateROI,
    getCatchBonus: getCatchBonus,
    getOddsBonus: getOddsBonus,
    tickBuffs: tickBuffs,
    checkFavorLevelUp: checkFavorLevelUp,
    getMiningIncome: getMiningIncome,
    _data: _data
  };
})();
