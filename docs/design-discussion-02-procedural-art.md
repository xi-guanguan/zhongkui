# 设计讨论 #02 — 程序化美术方案（美术指导文档）

> 状态: **讨论中**
> 日期: 2026-05-29
> 渲染技术: **HTML5 Canvas 2D**
> 哲学框架: **AI美学方法论 — "如如之心"**

---

## 0. 创作哲学：如如之心 × 如意之心

> 核心命题（原文）：**美术需要如如，程序需要如意。**

本项目同时包含"美术生成"和"系统程序"两个面向，需要在两种心智之间切换。

### 如如之心 — 指导一切美学生成

**适用范围**：所有涉及视觉美感的生成过程，无论载体是 AI 还是代码。

| 原则 | 在程序化美术中的实践 | 在 AI 生图中的实践 |
|------|---------------------|-------------------|
| 不预设最终形态，让结果自己涌现 | shadowBlur 调到"看着诡异"为止，不死抠数值 | 给"中式鬼怪风"方向，不写100行描述 |
| 不追求一次命中，而是迭代筛选 | 频率/振幅反复调，保留"感觉活"的参数 | 生成10张 → 人判断 → 保留最有生命力的 |
| 允许意外之美 | 调参中出现文档未规划但好看的效果 → 保留 | AI 涌现了预期外的美感 → 保留 |
| 人负责审美判断，不负责像素级控制 | 视觉参数以"看着对"为准，非精确数学 | 选择权和系统整合权归人 |

**反面教训（如意之心的陷阱用在美术上）**：
> 控制越强，惊喜越少；要求越细，作品越平庸。
> 不要把程序思维用在美术调参上——不是算出来的，是看出来的。

### 如意之心 — 指导系统架构

**适用范围**：渲染管线、数据结构、性能约束、坐标系——一切需要精密秩序的部分。

- 渲染管线分层顺序：**不可乱**（1-9 层级精确）
- 对象池上限：**不可突破**（铜钱20、鬼火30、飘字10）
- 坐标系：**不可偏移**（450×1000 设计分辨率）
- 性能规则：**不可省略**（shadowBlur 用完必关、lighter 用 save/restore 包裹）

### 辩证统一：同一个鬼火，两种心智

```
如如（美术面）: 鬼火"看起来诡异而美" → 不预设具体数值，调到满意为止
如意（系统面）: radialGradient + lighter + 对象池 + save/restore → 精确控制每一帧的执行结构
```

### CodeBuddy 执行时的指导原则

1. **系统骨架**：渲染管线、分层、对象池、坐标系 — 按文档精确实现（如意）
2. **视觉调参**：shadowBlur 值、正弦频率、渐变色标位置 — 初始值按文档，但调到"看着对"为准（如如）
3. **AI 生图资源**：给方向和约束，允许生成→筛选→迭代（如如）
4. **意外之美**：程序化生成中出现文档未规划但视觉效果好的结果 → 保留（如如）

---

## 确认事项

| 项 | 决策 |
|----|------|
| 美术策略 | **全程序化**（Canvas 2D 绘制） |
| 渲染 API | HTML5 Canvas 2D Context（`ctx.*`） |
| 例外资源 | 孟婆立绘 + 道具图（AI 生图，如如之心流程） |
| 经济系统 | **待定**（本次不锁） |

---

## 1. 设计基准

| 参数 | 值 | 说明 |
|------|-----|------|
| 设计分辨率 | **450 × 1000** | 9:20 竖屏，蒸馏文档标准规范 |
| 适配模式 | SHOW_ALL（CSS `object-fit: contain`） | letterbox 黑边，保证画面不变形 |
| 字号基准 | 15px = 核心信息 | 蒸馏文档字号层级 |
| 坐标系 | 所有 px 基于 450×1000 | Canvas 内部坐标 |
| 风格定位 | **像素拼接为骨，Canvas 特效为魂** | 保留原版方块感 + 辉光/渐变增味 |

> 为什么"像素为骨，特效为魂"？
> - 骨架（fillRect 矩形拼接）= 原版代码 DNA，玩家认知锚点
> - 魂魄（shadowBlur/lighter/radialGradient）= Canvas 2D 独有，让冥界"活"起来

---

## 2. 色板（冥界中式鬼怪）

### 环境色板（12色）

| 名称 | 色号 | 角色 |
|------|------|------|
| `VOID` | `#0D0D1A` | 冥界深空 / 最暗底色 |
| `DUSK` | `#1C1033` | 暮紫 / 分层深度 |
| `FOG` | `#2A1B3D` | 迷雾紫 / 远景 |
| `GHOST_GREEN` | `#39FF14` | 鬼火绿 / 核心强调 |
| `COPPER` | `#CD7F32` | 铜钱色 / 货币 |
| `COPPER_SHINE` | `#FFD700` | 铜钱反光 / 金闪 |
| `BLOOD` | `#8B0000` | 暗血红 / 危险 |
| `SOUL_BLUE` | `#4169E1` | 魂蓝 / 冷色对比 |
| `BONE` | `#F5F5DC` | 骨白 / 文本 |
| `CHAIN` | `#708090` | 锁链灰 |
| `CHAIN_GLOW` | `#A0C4FF` | 锁链辉光 |
| `LANTERN` | `#FF6600` | 灯笼橙 / 暖点缀 |

### 5 鬼专色

| 鬼 | 主色 | 辅色/光环 | 性格色彩逻辑 |
|----|------|----------|-------------|
| 牛头 | `#8B4513` 棕 | `#654321` 深棕 | 泥土感=胆小卑微 |
| 马面 | `#4B0082` 靛紫 | `#6A0DAD` 亮紫 | 冷紫=沉稳普通 |
| 黑无常 | `#1A1A1A` 纯黑 | `#39FF14` 鬼火绿 | 极暗+极亮=疯狂 |
| 白无常 | `#F0F0F0` 纯白 | `#DC143C` 血舌红 | 白衣飘飘=阴冷 |
| 刑天 | `#8B0000` 暗红 | `#FF4500` 火焰橙 | 血与火=狂暴 |

---

## 3. 画面分层（纵向区域）

```
Canvas (450×1000)
┌──────────────────────────┐ Y=0
│  HUD 顶栏 (h=46)         │  🪙 数 | 波次 | ⚙️
├──────────────────────────┤ Y=46
│  天空层 (h≈120)          │  深紫渐变 + 鬼火星点(lighter叠光)
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  远景层                   │  黄泉山脉(sin波 + shadowBlur微光)
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  竞技场 (核心游戏区)      │  鬼出没 + 锁链甩动(radialGradient暗角)
│                          │
│  钟馗站位 (h≈80)         │  像素角色 + 呼吸金光
├──────────────────────────┤ Y≈780
│  暗底操作区 (h≈120)      │  铜钱爆出粒子 / 飘字
├──────────────────────────┤ Y≈900
│  底栏 (h≈100)            │  [孟婆店] | [打工]
└──────────────────────────┘ Y=1000
```

---

## 4. 程序化生成技术选型

> 参考: 程序化生成蒸馏.txt 技术库（§5.1 - §5.12）
> 转译: 所有代码从 NanoVG Lua → Canvas 2D JavaScript

| 游戏元素 | 核心技术 | 蒸馏§ | Canvas 2D 增强技法 |
|---------|---------|------|-------------------|
| 冥界天空 | 确定性随机 + 正弦闪烁 | §5.1+§5.2 | `createRadialGradient` + `lighter` 叠光 |
| 山脉轮廓 | sin(x) 多波叠加 | §5.2 | `Path2D` 缓存 + `shadowBlur` 脊线微光 |
| 鬼火粒子 | 对象池 + 简化物理 + HSV | §5.3+§5.11+§5.5 | `lighter` 自动叠亮 |
| 5鬼角色 | 像素矩形拼接 + 个性行为 | — | `shadowColor` 独立光环色 |
| 锁链动画 | 贝塞尔 + 链节参数化 | §5.10 | `shadowBlur` 一行辉光 |
| 铜钱爆出 | 对象池 + 黄金角 + 旋转 | §5.3+§5.4+§5.7 | `OffscreenCanvas` 预渲染 + `drawImage` |
| 飘字淡出 | easeOutCubic + alpha | §5.7 | `globalAlpha` + `strokeText` 描边 |
| 呼吸光环 | 正弦驱动 | §5.2 | `shadowBlur` 动态值 |
| 黄金矿工钩 | Lissajous 摆动 | §5.8 | — |
| 鬼出场轨迹 | Lissajous 漂浮(不重复) | §5.8 | — |
| 大数显示 | 对数映射 | §5.6 | — |
| HUD图标 | 统一接口 `draw(ctx,cx,cy,size,color)` | §七 | `OffscreenCanvas` 预渲染 |
| 竞技场暗角 | 径向渐变(中亮边暗) | — | `createRadialGradient` |

---

## 5. Canvas 2D 专属技法库

> NanoVG 做不到这些。这是本项目选 Canvas 2D 的核心优势。

### 5.1 混合模式 `globalCompositeOperation`

```javascript
// 🔥 鬼火叠光 — 多粒子自动叠亮，无需手算颜色
ctx.globalCompositeOperation = 'lighter';
// 绘制所有鬼火粒子...
ctx.globalCompositeOperation = 'source-over'; // 恢复

// 🌙 灯笼光照范围 — 在暗层上"挖"亮区
ctx.globalCompositeOperation = 'destination-out';
// 画圆形渐变 → 暗层被擦除 → 露出下面的内容

// 🔮 冥界氛围滤镜 — 叠一层半透明紫色
ctx.globalCompositeOperation = 'soft-light';
ctx.fillStyle = 'rgba(42, 27, 61, 0.3)';
ctx.fillRect(0, 0, 450, 1000);
```

**用在哪**: 鬼火叠光、锁链辉光、屏幕闪白、孟婆店灯笼光照

### 5.2 阴影系统 `shadowBlur` + `shadowColor`

```javascript
// 一行代码 = 辉光效果（NanoVG 需要画两遍不同粗细的线）
ctx.shadowColor = '#39FF14';
ctx.shadowBlur = 12;
ctx.fillRect(x, y, w, h);  // 鬼身体自动带绿光环
ctx.shadowBlur = 0;         // ⚠️ 用完必须关！
```

**用在哪**: 每只鬼的独立光环色、锁链辉光、钟馗呼吸金光、山脊鬼火微光

### 5.3 径向渐变 `createRadialGradient`

```javascript
// 鬼火核心 — 中亮边散
const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
grd.addColorStop(0, 'rgba(57,255,20, 0.9)');
grd.addColorStop(0.5, 'rgba(57,255,20, 0.3)');
grd.addColorStop(1, 'rgba(57,255,20, 0)');

// 竞技场暗角 — 中间稍亮边缘纯暗
const vignette = ctx.createRadialGradient(225, 470, 50, 225, 470, 350);
vignette.addColorStop(0, '#180E22');
vignette.addColorStop(1, '#0D0D1A');
```

**用在哪**: 鬼火粒子、呼吸光环、灯笼光晕、铜钱金光、场景暗角

### 5.4 离屏预渲染 `OffscreenCanvas` / `createElement('canvas')`

```javascript
// 铜钱只画一次 → 每帧 drawImage（快 10x）
const coinOff = document.createElement('canvas');
coinOff.width = 32; coinOff.height = 32;
const oc = coinOff.getContext('2d');
// ... 画铜钱 ...
// 每帧: ctx.drawImage(coinOff, x-16, y-16);
```

**用在哪**: 铜钱图标、HUD 元素、鬼的静态帧缓存、齿轮图标

### 5.5 `Path2D` 路径复用

```javascript
// 山脉路径只算一次
const mountainPath = new Path2D();
mountainPath.moveTo(0, 166);
for (let x = 0; x <= 450; x += 4) {
    mountainPath.lineTo(x, 166 - (12 + Math.sin(x*0.04)*8 + Math.sin(x*0.07)*4));
}
mountainPath.lineTo(450, 166);
mountainPath.closePath();
// 每帧: ctx.fill(mountainPath);
```

**用在哪**: 山脉、固定 UI 框架、不变形的角色部件

### 5.6 CSS 滤镜 `ctx.filter`（低频使用）

```javascript
// 远景模糊 — 一行大气透视
ctx.filter = 'blur(1.5px)';
ctx.fill(mountainPath);
ctx.filter = 'none';
```

**⚠️ 性能注意**: 仅用于静态/低频元素，不要每帧全屏使用

---

## 6. 关键绘制方案

### 6.1 钟馗（像素骨 + 辉光魂）

```
结构（像素骨）:
  头: 10×10 fillRect, BONE
  官帽: 14×6, VOID, 顶部两翼 3×2
  胡须: 3条 2px 竖线, CHAIN
  身体: 12×16, BLOOD（红袍）
  腰带: 14×3, COPPER
  腿: 2条 4×10, VOID
  手臂: 动态偏移（跟随锁链方向）

增强（辉光魂）:
  待机: shadowBlur = sin(t*1.8)*3+3, shadowColor = COPPER_SHINE
  甩链: shadowBlur 骤增到 12 后快速衰减（easeOutExpo）
```

### 6.2 鬼（矩形骨 + 独立光环 + 性格行为）

每只鬼的数据结构（沿用原版牛的模式）：

```javascript
const GHOSTS = [
  { id:"NT", name:"牛头", catchP:0.30,
    color:"#8B4513", glow:"#654321", size:[16,12],
    personality:"timid" },    // 小幅抖动
  { id:"MM", name:"马面", catchP:0.16,
    color:"#4B0082", glow:"#6A0DAD", size:[20,16],
    personality:"normal" },   // 匀速漂浮
  { id:"HWC", name:"黑无常", catchP:0.08,
    color:"#1A1A1A", glow:"#39FF14", size:[20,14],
    personality:"crazy" },    // 高速乱窜 (Lissajous §5.8)
  { id:"BWC", name:"白无常", catchP:0.03,
    color:"#F0F0F0", glow:"#DC143C", size:[24,18],
    personality:"cool" },     // 极缓飘动 + 突然闪现
  { id:"XT", name:"刑天", catchP:0.01,
    color:"#8B0000", glow:"#FF4500", size:[28,20],
    personality:"rage" },     // 直线冲撞
];
```

绘制（通用模板）：
```javascript
function drawGhost(ctx, ghost, x, y, t) {
    const [w, h] = ghost.size;
    // 光环（如如 — 让 shadowBlur 自己"呼吸"）
    ctx.shadowColor = ghost.glow;
    ctx.shadowBlur = 4 + Math.sin(t * 2 + ghost.seed) * 3;
    // 像素骨架
    ctx.fillStyle = ghost.color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // 眼睛（2×2 白点）
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x + w*0.3, y + h*0.25, 2, 2);
    ctx.fillRect(x + w*0.6, y + h*0.25, 2, 2);
    // 个性特征由子函数处理...
}
```

### 6.3 锁链（shadowBlur 一行辉光）

```javascript
function drawChain(ctx, x1, y1, x2, y2) {
    const midX = (x1+x2)/2, midY = (y1+y2)/2 + 20; // 垂坠弧

    // 辉光 = 只需设 shadow
    ctx.shadowColor = '#A0C4FF';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#708090';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 链环节点（像素感）(§5.10 参数化几何)
    const len = Math.hypot(x2-x1, y2-y1);
    const segs = Math.floor(len / 8);
    ctx.fillStyle = '#708090';
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const px = (1-t)**2*x1 + 2*(1-t)*t*midX + t**2*x2;
        const py = (1-t)**2*y1 + 2*(1-t)*t*midY + t**2*y2;
        ctx.fillRect(px-2, py-2, 4, 4);
    }
}
```

### 6.4 背景渲染

```javascript
function renderBackground(ctx, t) {
    // 1. 冥界天空（线性渐变）
    const sky = ctx.createLinearGradient(0, 46, 0, 166);
    sky.addColorStop(0, '#0D0D1A');
    sky.addColorStop(0.6, '#1C1033');
    sky.addColorStop(1, '#2A1B3D');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 46, 450, 120);

    // 2. 鬼火星点（§5.1 确定性随机 + §5.2 正弦 + lighter）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < starPositions.length; i++) {
        const {x, y, phase} = starPositions[i]; // 预计算位置
        const blink = (Math.sin(t * (1 + (i%5)*0.4) + phase) + 1) * 0.5;
        const r = 2 + blink * 3;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(57,255,20,${0.5+blink*0.5})`);
        grd.addColorStop(1, 'rgba(57,255,20,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(x-r, y-r, r*2, r*2);
    }
    ctx.restore();

    // 3. 黄泉山脉（Path2D 缓存 + shadowBlur 微光）
    ctx.shadowColor = '#39FF14';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#1C1033';
    ctx.fill(mountainPath); // 预生成的 Path2D
    ctx.shadowBlur = 0;

    // 4. 竞技场暗角
    const vignette = ctx.createRadialGradient(225, 470, 50, 225, 470, 350);
    vignette.addColorStop(0, '#180E22');
    vignette.addColorStop(1, '#0D0D1A');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 166, 450, 614);
}
```

### 6.5 铜钱爆出粒子系统

```javascript
// 技术组合: §5.3 对象池 + §5.4 黄金角 + §5.7 缓动 + OffscreenCanvas
const COIN_POOL_SIZE = 20;
const GOLDEN_ANGLE = 2.399;

// 预渲染铜钱（只画一次）
const coinBitmap = prerenderCoin(); // → OffscreenCanvas 32×32

function spawnCoins(x, y, count) {
    for (let i = 0; i < count; i++) {
        const coin = pool.allocate();
        const angle = performance.now() * 0.002 + i * GOLDEN_ANGLE;
        coin.x = x; coin.y = y;
        coin.vx = Math.cos(angle) * 60;
        coin.vy = -Math.random() * 80 - 30;
        coin.rot = Math.random() * 6.28;
        coin.life = 1.0;
    }
}

function renderCoins(ctx) {
    for (const c of coinPool) {
        if (!c.active) continue;
        ctx.save();
        ctx.globalAlpha = c.life;  // §5.7 easeOut 衰减
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.drawImage(coinBitmap, -16, -16); // 比重绘快 10x
        ctx.restore();
    }
}
```

### 6.6 鬼火粒子

```javascript
// 技术组合: §5.3 对象池 + §5.11 简化物理 + lighter
function renderGhostFires(ctx, fires, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // 自动叠亮！

    for (const f of fires) {
        if (!f.active) continue;
        const flicker = 0.6 + Math.sin(t*3 + f.seed) * 0.4;
        const r = f.radius * flicker;
        const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        grd.addColorStop(0, `rgba(57,255,20,${0.8*flicker})`);
        grd.addColorStop(0.4, `rgba(57,255,20,${0.3*flicker})`);
        grd.addColorStop(1, 'rgba(57,255,20,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();
}
```

---

## 7. 渲染管线

```javascript
function render(ctx, t) {
    ctx.clearRect(0, 0, 450, 1000);

    // ─── 层级从后到前 ───
    renderBackground(ctx, t);         // 1. 天空+山脉+暗角
    renderGhostFires(ctx, fires, t);  // 2. 鬼火(lighter)
    renderGhosts(ctx, ghosts, t);     // 3. 鬼怪(shadowBlur光环)
    renderChain(ctx, chain);          // 4. 锁链(shadowBlur辉光)
    renderZhongKui(ctx, player, t);   // 5. 钟馗(呼吸金光)
    renderCoins(ctx);                 // 6. 铜钱粒子(drawImage)
    renderEffects(ctx, effects, t);   // 7. 涟漪/闪白
    renderHUD(ctx, state);            // 8. HUD顶栏
    renderFloatingText(ctx, floats);  // 9. 飘字(最顶层)
}
```

---

## 8. 孟婆店（第二屏）

| 元素 | 技法 | 色调 |
|------|------|------|
| 背景 | `createLinearGradient`（暖紫→暗红） | DUSK → #2D1B1B |
| 柜台 | fillRect + strokeRect | COPPER + BONE 边 |
| 货架 | 矩形网格 | CHAIN 色框 |
| 灯笼 | `radialGradient` + `lighter` | LANTERN + 扩散光 |
| 孟婆 | **AI 生图** | 如如之心流程 |
| 道具 | **AI 生图** | 如如之心流程 |
| 对话框 | `roundRect` | VOID 底 + BONE 字 |

---

## 9. HUD 方案

```
┌──────────────────────────────────────┐
│ 🪙 999   │   第 3 波   │   ⚙️       │  h=46, Y=0
└──────────────────────────────────────┘
```

| 元素 | 字号 | 颜色 | 渲染 |
|------|------|------|------|
| 铜钱数 | 15 | COPPER | `drawImage(coinBitmap)` + fillText |
| 波次 | 15 | BONE | fillText |
| 齿轮 | — | BONE | `Path2D` 预渲染图标 |

---

## 10. 文字样式

| 场景 | 字号 | 填充色 | 描边 | 技法 |
|------|------|--------|------|------|
| HUD 数值 | 15 | BONE/COPPER | 黑 2px | `strokeText` → `fillText` |
| 抓到鬼飘字 | 18 | GHOST_GREEN | 黑 3px | + `shadowBlur` 绿光 |
| BIG WIN | 24 | COPPER_SHINE | 黑 4px | + `shadowColor: gold` |
| 鬼名字 | 13 | 对应鬼主色 | 黑 2px | `strokeText` → `fillText` |
| 笑话文本 | 13 | BONE | 黑 2px | 同上 |
| 按钮文字 | 15 | BONE | 无 | 纯 `fillText` |

---

## 11. 特效清单

| 特效 | 触发 | 技术组合 |
|------|------|---------|
| 鬼火闪烁 | 常驻 | §5.1确定性随机 + §5.2正弦 + lighter + radialGradient |
| 锁链辉光 | 甩链 | `shadowBlur` 一行 |
| 铜钱爆出 | 抓鬼 | §5.3池 + §5.4黄金角 + OffscreenCanvas + rotate |
| 命中涟漪 | 钩中 | 方形扩散 + `globalAlpha` 衰减 |
| 飘字淡出 | 得分 | §5.7 easeOutCubic + globalAlpha + 上移 |
| 呼吸光环 | 钟馗待机 | §5.2正弦 → shadowBlur(0↔6) |
| 鬼挣扎 | 被钩中 | ±2px translate 抖动 |
| 屏幕闪白 | BIG WIN | globalAlpha 0→0.7→0, 0.2s |
| 鬼消散 | 确认抓获 | scale缩小 + rotate + globalAlpha→0 |
| 灯笼光照 | 孟婆店 | radialGradient + lighter |

---

## 12. 性能策略

| 策略 | 说明 | 对应蒸馏§ |
|------|------|----------|
| `OffscreenCanvas` 预渲染 | 铜钱、图标、鬼静态帧 | — |
| `Path2D` 复用 | 山脉、固定UI | — |
| 对象池 | 粒子、飘字、铜钱 (零GC) | §5.3 |
| 确定性随机预计算 | 星点位置只算一次存数组 | §5.1 |
| `shadowBlur` 精控 | 仅需辉光的元素开、立即关 | — |
| `lighter` 局部化 | save/restore 包裹 | — |
| `requestAnimationFrame` | 主循环 60fps | — |
| 简化物理 | 不用物理引擎，1-2行代码 | §5.11 |

---

## 13. AI 生图资源（如如之心流程）

| 资源 | 用途 | 尺寸 | 生成策略 |
|------|------|------|---------|
| 孟婆立绘 | 店看板娘 | 256×512 | 方向:"中式水墨鬼怪" → 生10张 → 人筛选 |
| 道具图×N | 商品图标 | 64×64 | 方向:"像素风/简笔画" → 批量生成 → 筛选 |

**执行原则**：
1. 给 AI 审美方向，不给像素级描述
2. 生成大量候选 → 人判断取舍
3. 保留意外之美（"我没想到但很好"的结果）
4. 选定后精确裁切对齐，嵌入系统

---

## 14. 给 CodeBuddy 的实现指引

### 必须精确遵循的（如意之心）

- 色板色值（不要随意调色，这是设计决策）
- 分层顺序（渲染管线 1-9 层级不可乱）
- 坐标系（450×1000 设计分辨率 + SHOW_ALL 适配）
- 对象池上限（铜钱 20、鬼火 30、飘字 10）
- 性能约束（shadowBlur 用完必关、lighter 用 save/restore 包裹）

### 允许调整的（如如之心 — 审美判断优先）

- 各 `shadowBlur` 的具体数值（3/6/8/12 都可以，看着对就行）
- 正弦频率/振幅（1.8? 2.0? 2.3? 调到"感觉活"为止）
- 鬼火粒子数量（20? 30? 看帧率和视觉平衡）
- 径向渐变的色标位置（0.3/0.5/0.7? 凭视觉判断）

### 遇到意外效果时

- 如果调参中出现了文档未规划但视觉好的效果 → **保留**
- 如果某个技法组合产生了预期外的美感 → **截图记录并保留**
- 如如之心的核心：顺着生成结果走，不强行拉回预设

---

## 15. Canvas 2D vs NanoVG 优势对比

| 能力 | Canvas 2D | NanoVG | 本项目收益 |
|------|-----------|--------|-----------|
| 混合模式 | ✅ 25+ 种 | ❌ 无 | 鬼火叠光不用手算 |
| 阴影系统 | ✅ 原生 | ❌ 需画两层 | 辉光一行搞定 |
| CSS 滤镜 | ✅ 全套 | ❌ 无 | 远景模糊 |
| 离屏预渲染 | ✅ 原生 | ❌ 需 FBO | 铜钱缓存快 10x |
| Path2D | ✅ 可复用 | ❌ 每帧重建 | 山脉/UI 缓存 |
| drawImage | ✅ 极快 | ✅ 有 | AI 生图直接贴 |

---

## 待讨论（全部关闭）

### ~~Q1: 像素粒度~~ — 已删除
此问题无效。文档全篇（§1风格定位、§4技术选型、§6绘制方案）已明确：游戏内容使用 fillRect 像素矩形拼接，无需额外确认。

### ✅ Q2: 孟婆/道具风格 — 已确认
- **孟婆**：后续由用户用 GPT 对着游戏画面生成，风格与游戏整体一致
- **道具**：是奶茶（店名"孟婆奶茶"）
  - 品种：茉香奶绿、阿萨姆奶红、伯牙绝弦、芋泥波波 + 若干果茶
  - 视觉：**大体造型相似**（杯子），只是像"用了 shader 的变体"（色彩/纹理/光泽不同）
  - 实现：AI 生一个基础杯型 → 程序化调色/调纹理生成全系列变体
- **UI 风格**：PixelForge 像素复古风（详见 `docs/ui-style-pixelforge.md`）

### ✅ Q3: 黄金矿工视觉 — 已确认
- **场景**：钟馗在船上，对着下面的冥河钩东西
- **风格**：与主游戏一致（暗色冥界、像素复古）
- **钩取物品设计**（AI 自由发挥）：
  - 铜钱串（基础收益）
  - 漂浮的冥界杂物（灯笼碎片、纸钱团、破木板）
  - 沉底的宝物（金元宝、玉佩、古铜镜）
  - 危险物/障碍（水鬼手、旋涡、毒蘑菇）
  - 稀有物（封印符、鬼王碎片 → 触发特殊奖励）

### ✅ Q4: 低画质开关 — 删除
用户未设计此功能，从待讨论中移除。不做低画质开关。
