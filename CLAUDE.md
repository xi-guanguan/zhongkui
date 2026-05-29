# 黑笑话钟馗 — 项目核心记忆

> AI 自维护，每次 POST 自动更新。详细规则见 memory-system skill。

## 当前状态
- 版本: 0.5.4
- 进度: 经济系统数值表 v4.1（整数化加成+百香果机制修正+好感经验曲线）
- 上次交付: `docs/design-discussion-03-economy.md` v4.1

## 项目身份
- 这是**策划区**，只写 `docs/`，实现代码由 CodeBuddy 在 GitHub 仓库完成
- 比赛：腾讯云黑客松 AI CAN DO IT — 赛题二（文化表达类）
- 仓库：https://github.com/xi-guanguan/zhongkui.git

## 用户画像摘要
- 称呼: 西瓜官 (xi-guanguan)
- 风格: 简洁直接，口语化，会立即纠正误解
- 角色: 总导演/决策者，把控方向

## 预测下一步
- likely_next_task: 数值表已稳定 → 交付任务卡给 CodeBuddy / 开始下一个系统设计
- 相关文件: docs/design-discussion-03-economy.md

## 恢复指令（新会话必执行）
1. 读本文件 → 获取项目状态和避雷清单
2. 读 `docs/memory-index.md` → 恢复项目上下文
3. 读 `docs/persona.md` → 加载用户画像和偏好
4. 自测：项目是什么？上次做了什么？下一步？不够清楚就多读文件
5. 如有 likely_next_task → 预加载相关文件
6. 详细规则见 memory-system skill

## 避雷清单
- POST 是记忆存活唯一入口，每次交付后必须执行 POST
- **本工作区只写 docs/**，不碰 src/assets/
- 蒸馏文档库是已有 GitHub 仓库（urhox-distilled-docs），不要自己创建
- git push 需先设 http.proxy=127.0.0.1:1080，认证 URL 含 token
- 用户说"嗒啦啦"=本工作区平台
- **绝不把未讨论的设计当作已确认**——被纠正过一次（"笑话弹出"事件）
- **本游戏是 HTML5 Canvas 2D，不是 NanoVG/嗒啦啦**——被纠正过一次，不要混淆平台
- **"黑笑话"只是游戏名，不是幽默系统**——被骂过多次，游戏改叫"钟馗捉鬼"也行
- **如如之心=一切美学生成（含程序化调参+AI生图），如意之心=仅系统架构**——被纠正过一次
- **游戏内容是 fillRect 像素拼接，PixelForge 只管 UI**——被纠正过一次
- **设计新系统前先读现有设计文档和原代码**——被骂过一次（经济系统事件）
- **满杯百香果是"锁定全部鬼为同一种"，不是加权随机**——被纠正过一次
- **buff加成必须给整数**（+1pp, +3pp, 不要+1.5pp）——被纠正过一次

## 工作流模板（收到任务后立即创建） 🔴

```
TodoWrite([
  { content: "DEV: [具体任务描述]", status: "in_progress" },
  { content: "POST-1 更新记忆：CLAUDE.md + memory-index.md + persona.md", status: "pending" },
  { content: "POST-2 持久化：versions.md + git commit", status: "pending" },
  { content: "POST-3 同步随行记忆：.agent/memory-runtime/", status: "pending" },
  { content: "POST-4 向用户汇报", status: "pending" }
])
```
