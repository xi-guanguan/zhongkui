/* config.js — 配置中心：所有数值常量
 * 依赖：无
 * 暴露：CONFIG (全局) */

var CONFIG = (function() {
  var M = Math;

  // ── 画布 ──
  var W = 450, H = 1000;

  // ── 布局常量 ──
  var LY = {
    hudH: 46,        // HUD顶栏高
    skyH: 120,       // 天空层高
    arenaY: 166,     // 竞技场起始Y
    arenaH: 614,     // 竞技场高
    zhongkuiY: 780,  // 钟馗站位Y
    bottomBarY: 900, // 底栏Y
    bottomBarH: 100, // 底栏高
    centerX: 225     // 水平中心
  };

  // ── 色板（冥界中式鬼怪12色）──
  var CO = {
    VOID:        '#0D0D1A',
    DUSK:        '#1C1033',
    FOG:         '#2A1B3D',
    GHOST_GREEN: '#39FF14',
    COPPER:      '#CD7F32',
    COPPER_SHINE:'#FFD700',
    BLOOD:       '#8B0000',
    SOUL_BLUE:   '#4169E1',
    BONE:        '#F5F5DC',
    CHAIN:       '#708090',
    CHAIN_GLOW:  '#A0C4FF',
    LANTERN:     '#FF6600'
  };

  // ── 5种鬼参数 ──
  var GT = [
    { id:'NT', name:'牛头',   catchP:0.20, oddsMin:1,  oddsMax:3,  midOdds:2,   color:'#8B4513', glow:'#654321', size:[16,12], personality:'timid' },
    { id:'MM', name:'马面',   catchP:0.10, oddsMin:4,  oddsMax:6,  midOdds:5,   color:'#4B0082', glow:'#6A0DAD', size:[20,16], personality:'normal' },
    { id:'HWC',name:'黑无常', catchP:0.05, oddsMin:7,  oddsMax:12, midOdds:9.5, color:'#1A1A1A', glow:'#39FF14', size:[20,14], personality:'crazy' },
    { id:'BWC',name:'白无常', catchP:0.03, oddsMin:13, oddsMax:20, midOdds:16.5,color:'#F0F0F0', glow:'#DC143C', size:[24,18], personality:'cool' },
    { id:'XT', name:'刑天',   catchP:0.012,oddsMin:20, oddsMax:50, midOdds:35,  color:'#8B0000', glow:'#FF4500', size:[28,20], personality:'rage' }
  ];

  // ── 10种奶茶 ──
  var MILK_TEA = [
    { id:1,  name:'阿萨姆奶红',   type:'red',  catchBonus:0.015, oddsBonus:0, duration:5, price:8 },
    { id:2,  name:'红糖珍珠',     type:'red',  catchBonus:0.025, oddsBonus:0, duration:5, price:15 },
    { id:3,  name:'万里木兰',     type:'red',  catchBonus:0.04,  oddsBonus:0, duration:3, price:22 },
    { id:4,  name:'红豆双皮奶',   type:'red',  catchBonus:0.06,  oddsBonus:0, duration:3, price:30 },
    { id:5,  name:'茉香奶绿',     type:'green',catchBonus:0,     oddsBonus:2, duration:5, price:5 },
    { id:6,  name:'薄荷奶绿',     type:'green',catchBonus:0,     oddsBonus:4, duration:5, price:12 },
    { id:7,  name:'伯牙绝弦',     type:'green',catchBonus:0,     oddsBonus:7, duration:3, price:18 },
    { id:8,  name:'满贯烧仙草',   type:'green',catchBonus:0,     oddsBonus:12,duration:3, price:28 },
    { id:9,  name:'满杯百香果',   type:'special_catch',catchBonus:0,oddsBonus:0,duration:3,price:10 },
    { id:10, name:'杨枝甘露',     type:'special_super',catchBonus:0,oddsBonus:0,duration:1,price:25 }
  ];

  // ── 好感经验曲线 ──
  var FAVOR_LEVELS = [
    { level:1, expNeeded:0,  miningIncome:5 },
    { level:2, expNeeded:3,  miningIncome:10 },
    { level:3, expNeeded:8,  miningIncome:20 },
    { level:4, expNeeded:15, miningIncome:35 },
    { level:5, expNeeded:25, miningIncome:50 }
  ];

  // ── 打工参数 ──
  var MINING = {
    duration: 30,      // 秒
    hookSwing: M.PI/3, // ±60°
    hookPeriod: 2,     // 摆动周期(秒)
    shootSpeed: 400,   // 射出速度 px/s
    retractSpeed: 300,  // 空钩收回速度 px/s
    retractWithSpeed: 200, // 带铜钱收回速度 px/s
    coinMin: 8,
    coinMax: 12,
    bigCoinChance: 0.3
  };

  // ── 爆奖控制 ──
  var ROI = {
    windowSize: 10,     // 滑动窗口大小
    highThreshold: 0.8, // ROI>0.8 压高级鬼
    lowThreshold: 0.4   // ROI<0.4 加低级鬼
  };

  // ── 初始赠送 ──
  var START_COINS = 20;

  // ── 请孟婆喝一杯 ──
  var MENGPO_TREAT_PRICE = 20;

  // ── 字号3层 ──
  var FS = { L:24, M:15, S:13 };

  return {
    W:W, H:H, LY:LY, CO:CO, GT:GT, MILK_TEA:MILK_TEA,
    FAVOR_LEVELS:FAVOR_LEVELS, MINING:MINING, ROI:ROI,
    START_COINS:START_COINS, MENGPO_TREAT_PRICE:MENGPO_TREAT_PRICE,
    FS:FS
  };
})();
