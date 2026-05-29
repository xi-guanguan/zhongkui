# UI 风格规范 — PixelForge 像素复古风

> 适用于：黑笑话钟馗（HTML5 Canvas 2D）
> 来源：PixelForge Retro Pixel-Art Style（已从 UrhoX Lua 适配为 Canvas 2D / CSS）
> 状态：**可直接使用**

---

## 0. 设计 DNA — 6 条铁律

| # | 规则 | 说明 |
|---|------|------|
| 1 | **圆角 = 0** | 所有 UI 元素尖角。零圆角。永远。唯一例外：日历导航按钮用 2px。 |
| 2 | **2px 内描边** | 每个交互元素有 2px inset border，颜色为填充色的暗 20% 变体。 |
| 3 | **硬投影** | 零模糊投影（blur=0），不同组件用不同偏移量营造像素深度感。 |
| 4 | **深暗背景** | `#0F0F23` 底色 + `#1B1B3A` 面板色。高对比让像素边缘 pop。 |
| 5 | **高饱和强调色** | Teal `#21BDAE` 主色、Purple `#6C5CE7` 副色、Red `#FF4757` 危险色。 |
| 6 | **像素字体** | Fusion Pixel 12px（正文/粗体/等宽三套）。 |

---

## 1. 色板

### 1.1 核心色

| 用途 | 色值 | Hex | Canvas 写法 |
|------|------|-----|------------|
| 主色 | Teal | `#21BDAE` | `ctx.fillStyle = '#21BDAE'` |
| 主色 Hover | | `#3DD0C1` | |
| 主色 Pressed | | `#19A899` | |
| 副色 | Purple | `#6C5CE7` | |
| 副色 Hover | | `#8577ED` | |
| 副色 Pressed | | `#5A4BD6` | |

### 1.2 背景/面板

| 用途 | Hex | 说明 |
|------|-----|------|
| 页面底色 | `#0F0F23` | 深海军蓝 |
| 面板/卡片 | `#1B1B3A` | 暗面板 |
| 面板 Hover | `#252550` | 悬停高亮 |
| 禁用背景 | `#2A2A4A` | |

### 1.3 文字

| 用途 | Hex | 说明 |
|------|-----|------|
| 主文字 | `#F0F0F0` | 近白 |
| 次要文字 | `#A0A0C0` | 淡紫灰 |
| 禁用文字 | `#505070` | |

### 1.4 边框

| 用途 | Hex |
|------|-----|
| 默认边框 | `#3A3A6A` |
| 焦点边框 | `#21BDAE`（= 主色） |

### 1.5 语义色

| 语义 | Hex | 游戏用途 |
|------|-----|---------|
| Success | `#50C878` | 治愈、获得铜钱 |
| Warning | `#FFD93D` | 警告、金色物品 |
| Error/Danger | `#FF4757` | 伤害、失败 |
| Info | `#45AAF2` | 信息提示、灵力 |

### 1.6 HUD 专用色

| 条 | Hex | 用途 |
|----|-----|------|
| HP | `#FF4757` | 血条 |
| MP | `#45AAF2` | 灵力条 |
| 体力 | `#FFD93D` | 体力/耐力 |
| 经验 | `#50C878` | 经验条 |

### 1.7 稀有度色

| 等级 | Hex | 说明 |
|------|-----|------|
| 普通 | `#606080` | 灰色边框 |
| 优良 | `#50C878` | 绿 |
| 稀有 | `#45AAF2` | 蓝 |
| 史诗 | `#6C5CE7` | 紫 |
| 传说 | `#FF9F43` | 橙 |

---

## 2. 投影系统（硬像素阴影）

所有投影 `blur = 0`，纯偏移+颜色：

```javascript
// Canvas 2D 实现硬阴影
ctx.shadowBlur = 0;
ctx.shadowOffsetX = offset;
ctx.shadowOffsetY = offset;
ctx.shadowColor = color;
```

| 组件类型 | 偏移 (px) | 颜色 | 附加 |
|---------|-----------|------|------|
| 按钮 | 3, 3 | `rgba(10,10,26,0.8)` | + (-1,-1) `rgba(255,255,255,0.19)` 左上高光 |
| 菜单/下拉/Toast | 3, 3 | `rgba(10,10,26,0.8)` | — |
| 工具提示 | 2, 2 | `rgba(10,10,26,0.8)` | — |
| 卡片(浮起) | 4, 4 | `rgba(10,10,26,0.8)` | — |
| 弹窗 | 4, 4 | `rgba(0,0,0,0.8)` | 更暗 |
| 侧边栏 | 4, 0 | `rgba(10,10,26,0.8)` | 仅水平 |

### 按钮 Bevel 高光

按钮特有的"左上 1px 高光"营造凸起像素感：

```javascript
function drawPixelButton(ctx, x, y, w, h, fillColor, darkColor) {
  // 主体
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);
  
  // 2px 内描边（暗色）
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  
  // 硬投影
  ctx.fillStyle = 'rgba(10,10,26,0.8)';
  ctx.fillRect(x + 3, y + h, w, 3);       // 底部
  ctx.fillRect(x + w, y + 3, 3, h);       // 右侧
  
  // 左上 bevel 高光
  ctx.fillStyle = 'rgba(255,255,255,0.19)';
  ctx.fillRect(x, y, w, 1);               // 顶边
  ctx.fillRect(x, y, 1, h);               // 左边
}
```

---

## 3. 字体

### 3.1 字体文件

| 字体 | 文件名 | 用途 |
|------|--------|------|
| 正文 | `FusionPixel-12px-Prop-zh_hans.ttf` | 所有常规文字 |
| 粗体 | `FusionPixel-12px-Prop-zh_hans-Bold.ttf` | 标题、强调 |
| 等宽 | `FusionPixel-12px-Mono-zh_hans.ttf` | 数字、计时器、代码 |

### 3.2 加载方式

```javascript
// CSS @font-face（在 HTML 或 JS 中注入）
const fontCSS = `
@font-face {
  font-family: 'PixelSans';
  src: url('fonts/FusionPixel-12px-Prop-zh_hans.ttf');
  font-weight: normal;
}
@font-face {
  font-family: 'PixelSans';
  src: url('fonts/FusionPixel-12px-Prop-zh_hans-Bold.ttf');
  font-weight: bold;
}
@font-face {
  font-family: 'PixelMono';
  src: url('fonts/FusionPixel-12px-Mono-zh_hans.ttf');
}`;

// Canvas 使用
ctx.font = '14px PixelSans';        // 正文
ctx.font = 'bold 18px PixelSans';   // 标题
ctx.font = '14px PixelMono';        // 数字/计时器
```

### 3.3 字号规范

| 语义 | 设计尺寸 | Canvas font-size | 用途 |
|------|---------|-----------------|------|
| display | 28px | `28px` | 超大标题 |
| headline | 22px | `22px` | 页面标题 |
| title | 18px | `18px` | 区块标题 |
| subtitle | 16px | `16px` | 副标题 |
| body | 14px | `14px` | 正文、按钮 |
| bodySmall | 12px | `12px` | 小字 |
| caption | 10px | `10px` | 标签、辅助 |

> **像素字体最佳实践**：font-size 应为字体设计尺寸（12px）的整数倍，即 12/24/36 显示最清晰。其他尺寸在低 DPR 屏可能模糊。

---

## 4. 间距系统

| Token | 值 (px) | 用途 |
|-------|---------|------|
| xs | 4 | 图标-文字间距 |
| sm | 8 | 组件内部 padding |
| md | 12 | 区块内元素间距 |
| lg | 16 | 区块 padding |
| xl | 24 | 区块之间间距 |
| xxl | 32 | 页面级间距 |

---

## 5. 组件样式速查

### 5.1 按钮

```
┌─────────────────────┐
│  ┌─────────────────┐│ ← 2px 内描边（暗色）
│  │   BUTTON TEXT   ││ ← 填充色
│  └─────────────────┘│
└─────────────────────┘
   ███                   ← 3px 硬投影
```

| 变体 | 填充色 | 描边色 |
|------|--------|--------|
| Primary | `#21BDAE` | `#19A899` |
| Secondary | `#6C5CE7` | `#4A3DB0` |
| Danger | `#FF4757` | `#B8323F` |
| Success | `#50C878` | `#38905A` |
| Disabled | `#2A2A4A` | `#3A3A6A` |

### 5.2 卡片/面板

```
背景: #1B1B3A
边框: 2px solid #3A3A6A
圆角: 0
投影: 4px 4px 0 rgba(10,10,26,0.8)  [浮起变体]
```

### 5.3 进度条 / 状态条

```
外框: 2px solid #3A3A6A, 背景 #1B1B3A, 高度 16px
填充: 对应语义色（HP=#FF4757, MP=#45AAF2 等）
无圆角
```

### 5.4 Toast / 提示

```
背景: #1B1B3A
边框: 2px solid #3A3A6A
投影: 3px 3px
左侧: 4px 宽彩色条（对应语义色）
无图标
```

### 5.5 弹窗 / Modal

```
背景: #1B1B3A
边框: 2px solid #3A3A6A
投影: 4px 4px rgba(0,0,0,0.8)  [更暗]
Header 背景: #14142E（比面板更暗）
Header/Footer 分隔线: 2px
遮罩: rgba(0,0,0,0.7)
```

---

## 6. 奶茶道具的稀有度边框

道具（奶茶）使用稀有度色作为边框：

```javascript
function drawItemSlot(ctx, x, y, size, rarityColor) {
  // 背景
  ctx.fillStyle = '#1B1B3A';
  ctx.fillRect(x, y, size, size);
  
  // 稀有度边框 (2px)
  ctx.strokeStyle = rarityColor;  // 如 '#6C5CE7' (史诗)
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  
  // 硬投影
  ctx.fillStyle = 'rgba(10,10,26,0.8)';
  ctx.fillRect(x + 2, y + size, size, 2);
  ctx.fillRect(x + size, y + 2, 2, size);
}
```

### 奶茶道具稀有度分配建议

| 道具 | 稀有度 | 边框色 | 理由 |
|------|--------|--------|------|
| 茉香奶绿 | 普通 | `#606080` | 基础款 |
| 阿萨姆奶红 | 普通 | `#606080` | 基础款 |
| 芋泥波波 | 优良 | `#50C878` | 口感升级 |
| 伯牙绝弦 | 稀有 | `#45AAF2` | 名字有典故 |
| 果茶系列 | 普通~优良 | `#606080`~`#50C878` | 看配方 |
| 特殊限定款 | 史诗/传说 | `#6C5CE7`/`#FF9F43` | 活动限定 |

---

## 7. 与程序化美术方案的对接

本风格指南与 `design-discussion-02-procedural-art.md` 的关系：

| 美术文档负责 | UI 风格文档负责 |
|-------------|----------------|
| 游戏场景渲染（冥河、钟馗、鬼怪） | UI 面板（孟婆店界面、HUD、道具栏） |
| 粒子、特效、背景动画 | 按钮、进度条、文字样式 |
| 色板 §1（游戏画面用色） | 色板 §1（UI 组件用色） |

**共享原则**：
- 两者使用**同一套深暗底色**（`#0F0F23` / `#1B1B3A`），视觉统一
- 游戏场景的强调色和 UI 主色保持一致（Teal `#21BDAE`）
- 像素字体同时用于游戏内飘字和 UI 文字

---

## 8. Canvas 2D 工具函数模板

### 8.1 圆角矩形（圆角=0 时退化为 fillRect）

```javascript
// 本风格几乎不用圆角，但保留通用函数
function roundRect(ctx, x, y, w, h, r) {
  if (r === 0) { ctx.rect(x, y, w, h); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
```

### 8.2 像素文字绘制

```javascript
function drawPixelText(ctx, text, x, y, options = {}) {
  const {
    size = 14,
    color = '#F0F0F0',
    font = 'PixelSans',
    weight = 'normal',
    align = 'left',
    baseline = 'top',
  } = options;
  
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.imageSmoothingEnabled = false;  // 像素锐利
  ctx.fillText(text, x, y);
}
```

### 8.3 九宫格面板

```javascript
function drawPanel(ctx, x, y, w, h, options = {}) {
  const {
    bg = '#1B1B3A',
    border = '#3A3A6A',
    borderWidth = 2,
    shadow = true,
    shadowOffset = 4,
  } = options;
  
  // 投影
  if (shadow) {
    ctx.fillStyle = 'rgba(10,10,26,0.8)';
    ctx.fillRect(x + shadowOffset, y + shadowOffset, w, h);
  }
  
  // 背景
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  
  // 边框
  ctx.strokeStyle = border;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
```

---

## 9. 字体文件位置

字体文件应放在项目的 `assets/fonts/` 目录：

```
assets/
└── fonts/
    ├── FusionPixel-12px-Prop-zh_hans.ttf
    ├── FusionPixel-12px-Prop-zh_hans-Bold.ttf
    └── FusionPixel-12px-Mono-zh_hans.ttf
```

> 字体文件来源：[Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)（开源，SIL Open Font License）

---

## 10. 实现检查清单

CodeBuddy 实现 UI 时对照：

- [ ] 所有矩形圆角 = 0（永远不要写 `borderRadius`）
- [ ] 交互元素有 2px 内描边（暗色变体）
- [ ] 按钮有 3px 硬投影 + 左上 1px 高光
- [ ] 背景色使用 `#0F0F23`（不是纯黑 `#000`）
- [ ] 文字使用 Fusion Pixel 字体（需 @font-face 加载）
- [ ] 数字/计时器使用等宽字体 `PixelMono`
- [ ] `ctx.imageSmoothingEnabled = false` 保持像素锐利
- [ ] 颜色值使用本文档色板（不要自己调色）
- [ ] 道具边框色 = 稀有度色
- [ ] 进度条高度 16px、边框 2px
