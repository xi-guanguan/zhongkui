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

## [2026-05-30 17:55] Bug1~4 ✅ 设置界面修复

- Bug1: _settingsBtnBounds()统一按钮位置, 消除硬编码偏移
- Bug2: 重置存档后settingsOpen=false关闭面板
- Bug3: updateDOM()开头判断settingsOpen禁用btnAction/btnShop
- Bug4: FAVOR_LEVELS经验从[0,3,8,15,25]改为[0,1,3,6,10]

## [2026-05-30 17:55] T2.1 ✅ 像素角色渲染

- 钟馗: 官帽/脸/胡须/红袍/腰带/腿 fillRect拼接 + 呼吸微动(sin*1.5)
- 5鬼: 牛头(抖动)/马面(漂浮)/黑无常(鬼火绿眼)/白无常(闪现)/刑天(冲撞)
- shadowBlur光环: 4+sin(t*2)*3, 各鬼独立glow色
- 链环: 待机投币数/回合链数显示

## [2026-05-30 17:55] T2.2 ✅ 堆叠精灵图

- drawStackedSprite(ctx, layers, x, y, scale)通用函数
- prerenderStacked(layers, scale, w, h) OffscreenCanvas缓存
- prerenderCoinStack(size): 3层铜钱(顶/底方孔+中间边缘环)
- drawCoin(x,y,size,rotation): 预渲染+旋转

## [2026-05-30 17:55] T2.3 ✅ 场景渲染

- 冥界天空: 线性渐变 VOID→DUSK→FOG
- 鬼火星点: lighter叠光 + 确定性随机预计算 + 正弦闪烁
- 黄泉山脉: Path2D缓存 + shadowBlur脊线微光
- 竞技场: 径向渐变暗角(中亮边暗)
- 迷雾过渡区 + 底部暗区

## [2026-05-30 17:55] T2.4 ✅ HUD PixelForge风格

- 顶栏背景: #0F0F23 + 2px内描边 #3A3A6A
- 铜钱图标: 小方块+方孔
- 文字: 先strokeText(黑2px)后fillText
- Buff图标: 背景+稀有度色边框+文字标签(捕/赔/锁/超)

## [2026-05-30 17:55] T2.5 ✅ GameJuice

- 屏幕闪白: triggerFlash(color, duration) BIG WIN闪金/普通闪白
- 鬼消散粒子: spawnDissolveParticles(x,y,color,count)
- 铜钱飞入: spawnCoinFly(fromX,fromY,toX,toY) 飞向HUD
- 连击/成功: triggerShake(intensity) 已有

## [2026-05-30 17:55] T2.6 ✅ 色板统一

- CO新增: PANEL/PANEL_BORDER/TEAL/SUCCESS/DANGER (PixelForge融合)
- 替换硬编码: #1B1B3A→CO.PANEL, #3A3A6A→CO.PANEL_BORDER
- 5鬼专色保持不变(牛头=#8B4513 马面=#4B0082 等)
- 12色基础+4色UI扩展=16色(文档允许PixelForge融合)
