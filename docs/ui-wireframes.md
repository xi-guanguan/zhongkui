# UI 线框图拆解

> 基于用户手绘 UI 原型的结构化描述，供 CodeBuddy 实现参考

---

## 屏幕一：主游戏界面（钟馗钩魂）

### JSON 描述

```json
{
  "screen": "game_main",
  "device_frame": {
    "type": "竖屏街机/手机外框",
    "border": { "color": "#00FF00", "width": 12, "radius": 8 },
    "background": "#000000",
    "aspect_ratio": "9:16"
  },
  "layout": {
    "regions": [
      {
        "id": "game_viewport",
        "role": "核心玩法演出区 — 钟馗钩魂的全部动作在此发生",
        "position": { "top": "5%", "left": "8%", "right": "8%", "bottom": "22%" },
        "border": { "color": "#00BFFF", "width": 6, "radius": 12 },
        "background": "#000000",
        "content": "钟馗角色 + 鬼怪 + 钩链动画 + 粒子特效 + 背景场景"
      },
      {
        "id": "controls_bar",
        "role": "底部操作区",
        "position": { "top": "80%", "bottom": "2%", "left": "5%", "right": "5%" },
        "layout": "row",
        "justify": "space-around",
        "align": "center",
        "children": [
          {
            "id": "btn_settings",
            "role": "设置按钮",
            "shape": "circle",
            "size": 56,
            "border": { "color": "#FFD700", "width": 3 },
            "icon": "⚙ 齿轮",
            "note": "打开设置面板（音量/重置等）"
          },
          {
            "id": "btn_action",
            "role": "主操作按钮 — 拍/甩钩链",
            "shape": "circle",
            "size": 80,
            "border": { "color": "#FF3030", "width": 6 },
            "fill": "none (空心红圈)",
            "interaction": "tap = 出钩, hold = 蓄力(?)",
            "note": "最大按钮，核心交互入口"
          },
          {
            "id": "btn_shop",
            "role": "切换到孟婆奶茶店",
            "shape": "circle",
            "size": 56,
            "border": { "color": "#FFD700", "width": 3 },
            "icon": "右箭头 →",
            "note": "点击后屏幕过渡到孟婆店界面"
          }
        ]
      }
    ]
  },
  "mapping_from_original": {
    "蓝色框": "原套牛游戏的 ARENA 区域 (LY.ARENA) → 现在是钟馗演出区",
    "红色大按钮": "原 tap 操作 → 现在是甩钩链",
    "左按钮": "设置键（原投币键位置改为设置）",
    "右箭头": "切换到孟婆奶茶店（双屏切换）"
  }
}
```

### 设计分析

| 区域 | 占比 | 说明 |
|------|------|------|
| 游戏演出区 | ~75% 屏高 | 所有视觉重点在这里：钟馗、鬼、钩链、粒子 |
| 控制栏 | ~20% 屏高 | 三按钮横排，大拇指操作区 |
| 顶部留白 | ~5% | 安全区/状态栏 |

**关键洞察**：
- 蓝色框 = 不需要 HUD 侵入的"纯演出区"，分数/连击可以用浮动文字（粒子式弹出）
- 红色按钮是唯一核心交互，极简——适合单手竖屏街机
- 投币键位置留了，但机制待定

---

## 屏幕二：孟婆奶茶（商店/成长界面）

### JSON 描述

```json
{
  "screen": "shop_mengpo",
  "device_frame": {
    "type": "同主界面外框",
    "border": { "color": "#00FF00", "width": 12, "radius": 8 },
    "background": "#000000"
  },
  "layout": {
    "regions": [
      {
        "id": "btn_back_to_game",
        "role": "返回游戏按钮（黄色光环造型）",
        "position": { "top": "2%", "height": "12%" },
        "content": {
          "element": "黄色光环/椭圆",
          "color": "#FFD700",
          "style": "空心粗描边椭圆",
          "meaning": "点击切换回游戏界面",
          "interaction": "tap → 过渡动画 → 回到游戏屏"
        }
      },
      {
        "id": "shop_scene",
        "role": "孟婆角色展示 + 互动区",
        "position": { "top": "14%", "height": "48%" },
        "border": { "color": "#808080", "width": 4, "radius": 6 },
        "background": "#000000",
        "children": [
          {
            "id": "btn_back",
            "role": "返回按钮",
            "position": "top-left",
            "shape": "square",
            "size": 48,
            "border": { "color": "#FFD700", "width": 3 },
            "icon": "← 左箭头"
          },
          {
            "id": "mengpo_character",
            "role": "孟婆（看板娘）— 有对话能力",
            "position": "center",
            "description": "圆形头 + 竖线身体 + 底部展开裙摆",
            "color": "#FFFFFF",
            "style": "极简线条，像纸片人/鬼魂",
            "interaction": "显示对话气泡：老板寒暄 + 介绍下方道具"
          },
          {
            "id": "item_dots",
            "role": "可购买道具展示（缩略图/图标）",
            "position": "bottom",
            "layout": "row",
            "children": [
              { "shape": "circle", "size": 12, "color": "#00BFFF" },
              { "shape": "circle", "size": 14, "color": "#0088FF" },
              { "shape": "rounded_rect", "width": 28, "height": 14, "color": "#0066CC" },
              { "shape": "circle", "size": 10, "color": "#00BFFF", "margin_left": 20 }
            ],
            "note": "道具图标横排，可能是不同奶茶/buff道具"
          }
        ]
      },
      {
        "id": "counter_desk",
        "role": "柜台/桌面分隔",
        "position": { "top": "63%", "height": "4%" },
        "style": "白色圆角长条",
        "note": "视觉分隔：上方是孟婆站台区，下方是商品货架区。代表奶茶店柜台"
      },
      {
        "id": "shop_items_list",
        "role": "商品列表",
        "position": { "top": "68%", "bottom": "3%" },
        "layout": "column",
        "gap": 8,
        "children": [
          {
            "id": "shop_item_1",
            "layout": "row",
            "children": [
              { "id": "item_icon_1", "shape": "rounded_rect", "size": 48, "border": "#FFD700", "fill": "none" },
              { "id": "item_info_1", "type": "text_block", "background": "#333333", "border": "#808080", "height": 48, "flex": 1 }
            ]
          },
          {
            "id": "shop_item_2",
            "layout": "row",
            "children": [
              { "id": "item_icon_2", "shape": "rounded_rect", "size": 48, "border": "#FFD700", "fill": "none" },
              { "id": "item_info_2", "type": "text_block", "background": "#333333", "border": "#808080", "height": 48, "flex": 1 }
            ]
          }
        ],
        "note": "每行：黄色方框图标 + 灰色信息栏（名称+价格+效果）"
      }
    ]
  },
  "mapping_from_original": {
    "孟婆奶茶": "原游戏的道具商店 ITEMS[] → 现在是冥界主题奶茶铺",
    "光环": "品牌标识 — 孟婆是有佛光/仙气的冥界NPC",
    "火柴人": "孟婆角色，极简画风保持像素/街机感",
    "蓝色道具": "原游戏的4种道具 → 现在可能是不同口味奶茶 = 不同buff",
    "打工机制": "类似'刮个爽'(另一款游戏)，通过小游戏赚入场费，增加粘性"
  }
}
```

### 设计分析

| 区域 | 占比 | 说明 |
|------|------|------|
| 返回按钮（光环） | ~12% | 黄色光环造型，点击回到游戏 |
| 角色互动区 | ~48% | 孟婆（看板娘）站台 + 对话气泡 + 道具预览 |
| 柜台桌面 | ~4% | 白色横条 = 柜台视觉分隔 |
| 商品列表 | ~32% | 可滚动，购买入口 |

**关键洞察**：
- 结构清晰：上面看人（孟婆看板娘），中间柜台，下面买东西
- 黄色元素（光环=返回按钮、图标框）= 冥界金色调，形成视觉统一
- 孟婆有对话能力：老板寒暄感 + 介绍商品
- 道具显示为小蓝圆点 → 可能是"奶茶珍珠/配料"的视觉比喻
- 底部列表 = 标准商店列表模式（图标 + 描述 + 价格）

---

## 整体设计语言总结

```
配色方案:
- 背景: 纯黑 #000000（冥界基调）
- 主强调: 黄金 #FFD700（冥币/神器/光环）
- 游戏框: 天蓝 #00BFFF（演出区边界）
- 操作: 红色 #FF3030（核心按钮）
- 道具: 蓝色系 #00BFFF~#0066CC
- 边框: 荧光绿 #00FF00（设备外框/街机感）
- 灰色: #808080（次级边框/信息区）

视觉风格:
- 黑底霓虹 — 街机/冥界双重氛围
- 极简线条 — 像素/街机美学
- 圆形按钮 — 拇指友好
- 高对比度 — 暗室可玩

字体建议:
- 像素体/方块体（如 Press Start 2P 或中文像素体）
- 黄色文字 on 黑底 = 冥界告示风
```

---

## 已解决问题 ✅

| # | 原问题 | 确认结果 |
|---|--------|---------|
| 1 | 左边按钮 → 改成什么？ | **设置键**（非投币） |
| 2 | 右边箭头按钮功能？ | **切换到孟婆奶茶店** |
| 3 | 孟婆互动内容？ | **看板娘** + 对话（寒暄 + 介绍道具） |
| 4 | 白色横条是什么？ | **柜台/桌面**（非进度条） |
| 5 | 黄色光环功能？ | **返回游戏按钮** |
| 6 | 打工在哪里玩？ | **切回游戏区**进行（不在孟婆店内） |

## 仍在讨论

详见 `design-discussion-01-economy-and-flow.md`：
1. 货币系统用什么方案？
2. 笑话何时/何处展示？
3. 打工小游戏的具体玩法？
