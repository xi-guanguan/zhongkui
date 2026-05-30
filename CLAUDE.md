# 黑笑话钟馗 — 项目核心记忆

> AI 自维护，每次 POST 自动更新。详细规则见 memory-system skill。

## 当前状态
- 版本: 0.7.0
- 进度: v0.6骨架 + v0.7交互重构(按键流程+鬼队列暂停+双向拉扯+孟婆商店UI)
- 上次交付: v0.7 — 四大核心修复

## v0.7 修改详情
1. **按键重构**: 右=投币+(1币/次最多5), 中=开始/丢索/拉扯/继续, 左=孟婆🍵
   - 开始键: 仅投币≥1时解锁
   - 丢索键: RUNNING阶段手动掷链
   - 拉扯键: HITTING阶段双向位移
2. **鬼队列暂停**: LASSO→HITTING转换时Ghosts.pause(), SETTLE→IDLE时Ghosts.resume()
3. **双向拉扯位移**: 水平向中央(W/2) + 竖直向钟馗(LY.ZHONGKUI_Y), 记录originX/Y实现斜向收缩
4. **孟婆商店UI重构**:
   - 对照线框图: 黄色光环返回+孟婆角色+白色柜台分隔+单列商品列表(稀有度色边框)
   - 修复buyMengpoTreat双重扣币Bug(不再调buyTea, 直接加buff)
   - 效果描述修正: 红茶=+X%捕获, 绿茶=赔率+X

## 文件结构
```
zhongkui/src/
├── index.html     — 按钮[孟婆🍵][主操作⭕][投币+]
├── css/style.css  — btn-coin铜色特化
└── js/
    ├── config.js   — 常量(W=320,H=480,LY,CO,FS,GT,MILK_TEA)
    ├── state.js    — 状态管理+存档
    ├── audio.js    — Web Audio音效9种
    ├── renderer.js — 渲染(粒子/飘字/震屏/HUD/孟婆气泡)
    ├── physics.js  — 判定(catchP+爆奖控制)
    ├── ghosts.js   — ★ pause()/resume()鬼队列暂停
    ├── zhongkui.js — ★ 投币+/丢索/拉扯按键逻辑
    ├── mengpo.js   — 孟婆对话
    ├── mining.js   — 打工(黄金矿工)
    └── main.js     — ★ 手动丢索流程+双向拉扯+商店UI
```

## 核心交互流程
```
IDLE → 按+(投币) → 按⭕开始 → RUNNING(鬼跑,等丢索) 
→ 按⭕丢索 → LASSO(0.5s链动画) → ★鬼队列暂停
→ HITTING(按⭕拉扯, 双向位移) → RESULT(判定) → SETTLE → 按⭕继续 → IDLE
```

## 避雷清单
- ★ 套中鬼后Ghosts必须pause(), 否则鬼继续前走
- ★ 拉扯位移用chain.originX/Y(被套时快照), 不能用tg.x/y(会随拉扯变化)
- ★ buyMengpoTreat只扣MENGPO_TREAT_PRICE一次, 不调buyTea
- ★ doStart时coinsInserted先清零再changeStage, 避免状态残留
- 浮点数做数组索引必P()
- Canvas文本描边先stroke后fill
- FS字号3层(L=22/M=13/S=10)
- CO调色板12色不新增
