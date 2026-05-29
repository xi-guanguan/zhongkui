# 进度记录

## [2026-05-30 01:35] T1.1 ✅ 项目骨架+状态机

- 创建9文件结构: config.js/state.js/audio.js/renderer.js/physics.js/ghosts.js/zhongkui.js/mengpo.js/main.js + mining.js + _summary.md
- index.html + style.css (450x1000设计分辨率, SHOW_ALL适配)
- CONFIG: GT[5种鬼]/MILK_TEA[10种奶茶]/FAVOR_LEVELS[5级]/MINING/LY/CO/FS
- State: 响应式set/get/on + 阶段机(MENU→ROUND→PAT→RESULT→SHOP→MINING→SHOP_BACK)
- 语法检查: 全部10个JS通过 node --check
- 逻辑测试: 配置/状态/对话/链判定/鬼轮番/buff/好感/ROI 全部OK

## [2026-05-30 01:35] T1.2 ✅ 核心抓鬼循环

- Physics.rollChains(): 投币瞬间骰catchP(虚假斯金纳箱)
- Ghosts: 5种鬼AI行为(timid/normal/crazy/cool/rage)
- ZhongKui: 输入处理→投币→拍拍拍→结果揭晓
- 爆奖控制: ROI滑动窗口(最近10局)

## [2026-05-30 01:35] T1.3 ✅ buff系统

- 奶红buff: catchP加算
- 奶绿buff: odds加算
- 特调#9百香果: 锁定鬼种3回合
- 特调#10杨枝甘露: 1链x10 catchP
- tickBuffs(): 回合结束remaining--, 0时移除
- 同类覆盖规则: 新买覆盖旧

## [2026-05-30 01:35] T1.4 ✅ 孟婆商店

- 10种奶茶购买流程(扣铜钱→触发buff)
- "请孟婆喝一杯"(20铜钱→随机#1~#8 buff + 好感经验+1)
- 好感升级逻辑(经验达标→等级+1, cap Lv.5)
- MengPo.getLine(context): 不重复上一句
- 对话触发: enter/buy/idle/back/levelUp

## [2026-05-30 01:35] T1.5 ✅ 打工/黄金矿工

- 钩子状态机: IDLE→SHOOTING→RETRACTING_WITH/RETRACTING_EMPTY
- 钩子摆动: ±60°, 2s周期
- 射出/收回: 400/300/200 px/s
- 铜钱碰撞检测(圆形)
- 30s倒计时→结算→固定收入(按好感等级)

## [2026-05-30 01:35] T1.6 ✅ 数据持久化

- localStorage存/读: coins/favor/buffs/currentGhostIdx/lockedGhostIdx/lockedRounds/roiHistory
- 初始赠送20铜钱(首次打开)

## [2026-05-30 01:35] T1.7 ✅ 胶水联调

- 全stage串联: MENU→ROUND→PAT→RESULT→SHOP→MINING→SHOP
- 色块占位渲染: fillRect色块代替所有视觉元素
- console.log验证: 投币→判定→buff生效→回合减少→打工→好感升级
