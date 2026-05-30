# src/js/ 模块索引（三级摘要 L1）

## 加载顺序
1. config.js — 配置常量
2. state.js — 响应式状态+阶段机
3. audio.js — Web Audio音效
4. renderer.js — Canvas绘制+粒子+HUD
5. physics.js — 链判定+碰撞
6. ghosts.js — 鬼怪AI+绘制
7. zhongkui.js — 钟馗控制+输入
8. mengpo.js — 孟婆对话
9. mining.js — 打工/黄金矿工
10. main.js — 主循环+存档

## 模块边界
- CONFIG: 只读常量，无状态
- State: 读写状态，set/get接口
- Audio: play()触发音效
- Renderer: 纯绘制，读State画Canvas
- Physics: 纯计算，返回结果不触发渲染
- Ghosts: 鬼位置+绘制
- ZhongKui: 输入处理+链绘制
- MengPo: getLine()对话接口
- Mining: 打工状态机+绘制
- main.js: 胶水，无逻辑
