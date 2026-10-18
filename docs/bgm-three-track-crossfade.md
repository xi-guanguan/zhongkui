# BGM 切换方法论：多轨持续循环，只切音量，不重启播放

> 从「钟馗捉鬼」的 UrhoX Lua 实现提炼。重点不是音乐生成，而是多个场景之间的背景音乐切换。
> 整理日期：2026-10-19。本文只记录方法与示例，不修改游戏代码，也不上传音乐素材。

## 1. 核心原则

**播放生命周期与场景切换解耦：所有 BGM 在初始化时开始循环播放；场景变化只改变各轨的目标音量，不重新调用 `Play()`，不调用 `Stop()` 或 `Seek()`。**

传统写法：

```text
进入主界面 → Play(idle)
进入商店   → Stop(idle) → Play(shop)
返回主界面 → Stop(shop) → Play(idle)，又从开头听起
```

本方法：

```text
初始化：idle、shop、mining 全部开始循环，初始音量为 0

场景             idle 目标音量    shop 目标音量    mining 目标音量
主玩法           最大增益        0               0
商店             0               最大增益        0
忘川打捞         0               0               最大增益

切换：从当前音量逐帧靠近新的目标音量
播放：三轨的播放进度始终继续，不因切换场景而重置
```

**静音不是停止。**不可闻的轨道仍处于播放状态，返回该场景时听到的是它此刻的位置，而不是开头。

注意，这也不是“恢复上次离开时的进度”。如果离开商店 20 秒，商店音乐的播放进度也向前推进约 20 秒，并可能跨过循环边界。

## 2. 为什么采用它

适合主玩法、商店、小游戏之间频繁往返，且曲目数量较少的游戏。

- 避免反复听同一段前奏。
- 切换无需重新创建播放器或重新启动音频。
- 用淡入淡出代替直接切断，减轻音量突变。
- 快速反复切换时，始终从当前增益继续过渡，不先归零再重播。
- 音乐模块只处理播放和增益，场景模块只决定“现在应该听哪首”。

它解决的是**播放连续性和音量过渡**，不保证任意两首音乐在旋律、和声或节拍上自然衔接。

## 3. 分成三个职责

### A. 初始化：每轨只启动一次

1. 预加载所有 `Sound`。
2. 设置 `sound.looped = true`。
3. 每轨创建独立、持久的 `SoundSource`。
4. 设置初始增益为 0，再启动播放。
5. 保存播放器、当前增益和目标状态。

资源路径相对于 `assets/` 资源根，例如 `audio/bgm/idle.ogg`，不要写成 `assets/audio/bgm/idle.ogg`。

下面是初始化模式示例，`scene` 为调用方已经创建且会持续存活的 `Scene`：

```lua
local files = {
    idle = "audio/bgm/idle.ogg",
    shop = "audio/bgm/shop.ogg",
    mining = "audio/bgm/mining.ogg",
}

local tracks = {}

for name, path in pairs(files) do
    local sound = cache:GetResource("Sound", path)
    if sound then
        sound.looped = true
        local node = scene:CreateChild("BGM_" .. name)
        local source = node:CreateComponent("SoundSource")
        source.soundType = "Music"
        source:Play(sound, 0, 0)
        tracks[name] = { source = source, currentGain = 0 }
    else
        print("[BGM] 资源加载失败：" .. path)
    end
end
```

`Play(sound, 0, 0)` 的两个 `0` 分别表示使用素材采样率、初始静音。第二个参数是绝对播放频率 Hz，不是 pitch 倍率。

不要给持久 BGM 播放器设置一次性音效使用的自动删除模式。不要每次开店都重新执行初始化。若需要跨场景保留音乐，播放器不能挂在即将销毁的场景节点下。

### B. 场景决策：只改变期望曲目

项目中的规则是：商店打开时选 `shop`，否则打捞阶段选 `mining`，其余选 `idle`。当前工作区的切换入口是 `scripts/main.lua` 的 `_updateBGM()`（整理时约第 2611 行）：

```lua
local function _updateBGM()
    local stage = State.get('stage')
    local shopOpen = State.get('shopOpen')
    local target
    if shopOpen then target = 'shop'
    elseif stage == 'MINING' then target = 'mining'
    else target = 'idle' end
    if target ~= _currentBGM then
        _currentBGM = target
        Audio.switchBGM(target)
    end
end
```

`switchBGM()` 的关键不是播放，而是把目标轨标记为活跃、其他轨标记为静音。

**曲目请求与静音设置必须分开。**即使用户音量为 0，也要保存最新的期望曲目，解除静音后才会回到正确场景的音乐。

通用控制模式可以简化为：

```lua
local activeTrack = ""

local function switchBGM(name)
    if not tracks[name] then
        print("[BGM] 未加载曲目：" .. tostring(name))
        return false
    end
    activeTrack = name
    return true
end
```

这里不检查用户音量，也不调用 `Play()`。相同请求不重置任何增益或计时，因此可以安全重复请求。

项目当前从渲染入口调用 `_updateBGM()`；新项目更适合把场景决策放在逻辑更新或状态变化回调，把音乐增益更新放在持续执行的 `Update` 中。不要让 UI 遮罩或玩法暂停的提前返回意外冻结音乐过渡。

### C. 每帧更新：音量逐渐接近目标

以下增益更新示例延续项目的线性、恒定速率模式，复用前面的 `tracks` 和 `activeTrack`：

```lua
local baseGain = 0.4
local userVolume = 0.5
local fadeSpeed = 2.0

local function updateBGM(dt)
    local maxGain = baseGain * userVolume
    local step = fadeSpeed * math.max(0, dt)
    for name, track in pairs(tracks) do
        local target = (name == activeTrack) and maxGain or 0
        local diff = target - track.currentGain
        if math.abs(diff) <= step then
            track.currentGain = target
        else
            track.currentGain = track.currentGain + (diff > 0 and step or -step)
        end
        track.source.gain = track.currentGain
    end
end
```

`userVolume` 是归一化的 0～1 用户音量；修改它不会改变 `activeTrack`，静音期间的场景请求也不会丢失。

这些片段是教学模式，不是独立游戏入口，也不是对当前脚本的替换补丁。接入时仍需绑定 `Update`、取得 `TimeStep`、设置初始曲目，并实现音量设置入口。

## 4. 正确理解淡变时间

项目参数为：

```text
最大增益 = 0.4 × 用户音乐音量百分比 / 100
淡变速度 = 2.0 增益单位 / 秒
过渡时间 = |目标增益 - 当前增益| / 淡变速度
```

因此，从静音淡入的理论时间：

| 用户音乐音量 | 最大增益 | 淡入时间 |
|---|---:|---:|
| 50% | 0.2 | 约 0.1 秒 |
| 100% | 0.4 | 约 0.2 秒 |

实际完成时刻受更新帧间隔影响。不能把 `fadeSpeed = 2.0` 描述为“固定半秒切换”，更不能声称现有 `playBGM(trackName, fadeInSec)` 已实现指定时长：当前函数并未使用 `fadeInSec`，`stopBGM(fadeOutSec)` 也未使用 `fadeOutSec`。

如果设计要求“无论用户音量多少，都在指定时间完成过渡”，应改用按时长插值：

```text
切换瞬间：记录每轨当前增益 startGain、目标增益 endGain
每帧：t = clamp(已过时间 / 过渡时长, 0, 1)
gain = startGain + (endGain - startGain) × t
再次切换：从当时的实际增益重新记录起点，不归零
```

这是可选改进，不是当前项目已实现的行为。

## 5. 必须说明的适用边界

### 不等于节拍同步或分轨编曲

三首独立曲目同时启动，不代表它们具有相同 BPM、调性、小节边界或循环长度。程序中逐个启动也不是采样级同步调度。

若要同一首曲子的鼓、贝斯、旋律随强度叠加，需要另外设计同 BPM、同拍数、同长度、严格对齐的分轨素材，以及可靠的同步播放方案。

### 不等于天然无缝循环

`sound.looped = true` 只让文件重复播放。素材首尾的节奏、和声、混响尾音和静音段仍须制作与试听验证。淡入淡出不能自动修复素材自己的循环接缝。

### 不是免费保留进度

此方案让所有曲目保持播放状态，可能持续产生解码、混音和资源占用；静音轨道具体优化程度取决于运行时实现，应在目标设备测量。

少量曲目、频繁往返场景适合它；几十首曲目不应无条件全部常驻播放。大曲库可另外设计按需加载、双播放器切换或恢复位置机制。

### “不 Stop”指场景切换期间

退出游戏、销毁音频模块或替换素材时，仍应正常停止并释放播放器。模块初始化、清理和重新初始化必须成对处理，避免重复创建轨道。

### 线性交叉淡变不是恒定感知响度

增益变化连续，不代表听感响度恒定。独立曲目的相关性、响度差异和过渡中的叠加都会影响听感。先统一素材响度，再试听决定是否需要等功率淡变或其他过渡曲线。

## 6. 验收清单

- 主玩法 → 商店 → 主玩法：没有重新从前奏开始。
- 离开场景一段时间后返回：目标轨在自己的循环时间线上继续，而非恢复离开时的固定位置。
- 快速往返：过渡从当前音量接续，没有重播或增益重置。
- 同一场景反复请求：不重复创建播放器，不重复调用 `Play()`。
- 静音时换场景，再解除静音：播放当前场景对应的音乐。
- 音量调整：用户设置与目标曲目分别维护，静音不丢失场景意图。
- 缺失或无效曲目：有日志和明确策略，不静默切成全部无声。
- 菜单、遮罩和玩法暂停：音乐更新是否继续符合设计预期。
- 播放器数量固定；退出或重新初始化不叠加新轨。
- 每首曲子的循环接缝、曲目间响度差异及移动端性能经过实机检查。

本次整理依据源码与素材格式检查，未进行引擎试听或移动端性能测试；验收清单不代表这些项目已通过。

## 7. 来源与可迁移结论

- 本地来源：`scripts/audio.lua` 的 `init()`、`switchBGM()`、`update()`。
- 场景决策来源：`scripts/main.lua` 的 `_updateBGM()`；行号会随版本变化，优先按函数名查找。
- 当前 GitHub `main` 仍包含较早的原型目录，本文自带方法示例；本文发布不意味着完整 Lua 工程或音乐素材也已同步。

**可迁移结论：少量常驻 BGM 的频繁场景切换，应改变“哪轨可闻”，而不是反复改变“哪轨正在播放”。**
