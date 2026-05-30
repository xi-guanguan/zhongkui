/* audio.js — Web Audio 音效 + 8bit BGM音序器
 * 新增: 程序化8bit音乐(地府感+小丑牌风格)
 * 依赖：无
 * 暴露：Audio (全局) */

var Audio = (function() {
  var _ac = null;
  var _sfxMuted = false;
  var _bgmMuted = false;

  // ── BGM 音序器 ──
  var _bgm = {
    masterGain: null,
    currentTrack: null,
    isPlaying: false,
    beatIndex: 0,
    nextNoteTime: 0,
    lookahead: 0.15,
    timerID: null,
    bpm: 72,
    patterns: null,
    trackName: null
  };

  // 音符频率表 (A2 ~ C5)
  var _NOTES = {
    A2:110.00, As2:116.54, B2:123.47, C3:130.81, Cs3:138.59, D3:146.83,
    Ds3:155.56, E3:164.81, F3:174.61, Fs3:185.00, G3:196.00, Gs3:207.65,
    A3:220.00, As3:233.08, B3:246.94, C4:261.63, Cs4:277.18, D4:293.66,
    Ds4:311.13, E4:329.63, F4:349.23, Fs4:369.99, G4:392.00, Gs4:415.30,
    A4:440.00, As4:466.16, B4:493.88, C5:523.25, r:0
  };

  // 8bit 波形脉冲宽度模拟 (duty cycle 近似)
  function _createSquareWave(ac, duty) {
    // 用4个sine谐波近似方波
    var real = new Float32Array(5);
    var imag = new Float32Array(5);
    for (var i = 1; i < 5; i += 2) {
      real[i] = 4 / (i * M.PI) * M.sin(i * M.PI * duty);
    }
    return ac.createPeriodicWave(real, imag);
  }

  // ── 曲目定义 ──
  // 格式: [ {n:'音符', d:拍数, ch:'声部', type:'波形', vol:音量}, ... ]
  var _TRACKS = {
    // === IDLE: 地府夜行 ===
    // A小调, BPM72, 阴郁缓慢, 鬼火星点般的旋律
    idle: {
      bpm: 72,
      data: [
        // Melody (square)
        {n:'A3',d:1,ch:'m',t:'square',v:0.07},{n:'G3',d:0.5,ch:'m',t:'square',v:0.07},{n:'E3',d:0.5,ch:'m',t:'square',v:0.07},
        {n:'D3',d:1,ch:'m',t:'square',v:0.07},{n:'C3',d:1,ch:'m',t:'square',v:0.07},{n:'E3',d:2,ch:'m',t:'square',v:0.07},
        {n:'A3',d:1,ch:'m',t:'square',v:0.07},{n:'B3',d:0.5,ch:'m',t:'square',v:0.07},{n:'C4',d:0.5,ch:'m',t:'square',v:0.07},
        {n:'B3',d:1,ch:'m',t:'square',v:0.07},{n:'A3',d:1,ch:'m',t:'square',v:0.07},{n:'G3',d:2,ch:'m',t:'square',v:0.07},
        // Bass (triangle, 低沉)
        {n:'A2',d:2,ch:'b',t:'triangle',v:0.10},{n:'r',d:0,ch:'b',t:'triangle',v:0},
        {n:'E2',d:2,ch:'b',t:'triangle',v:0.10},{n:'r',d:0,ch:'b',t:'triangle',v:0},
        {n:'C2',d:2,ch:'b',t:'triangle',v:0.10},{n:'r',d:0,ch:'b',t:'triangle',v:0},
        {n:'D2',d:2,ch:'b',t:'triangle',v:0.10},{n:'r',d:0,ch:'b',t:'triangle',v:0},
        // 诡异装饰音 (sawtooth, 极低音量)
        {n:'Gs3',d:0.25,ch:'d',t:'sawtooth',v:0.02},{n:'r',d:0.75,ch:'d',t:'sawtooth',v:0},
        {n:'r',d:1,ch:'d',t:'sawtooth',v:0},{n:'Fs3',d:0.25,ch:'d',t:'sawtooth',v:0.02},{n:'r',d:2.75,ch:'d',t:'sawtooth',v:0},
        {n:'r',d:3,ch:'d',t:'sawtooth',v:0},{n:'Gs3',d:0.25,ch:'d',t:'sawtooth',v:0.02},{n:'r',d:0.75,ch:'d',t:'sawtooth',v:0}
      ]
    },

    // === SHOP: 奈何桥奶茶铺 ===
    // E小调, BPM80, 小丑牌式诡异爵士感, 三全音(F-B)点缀
    shop: {
      bpm: 80,
      data: [
        // Melody: 跳跃感, 不对称节奏
        {n:'E4',d:0.5,ch:'m',t:'square',v:0.07},{n:'r',d:0.25,ch:'m',t:'square',v:0},
        {n:'Fs4',d:0.25,ch:'m',t:'square',v:0.07},{n:'G4',d:0.5,ch:'m',t:'square',v:0.07},
        {n:'B4',d:0.5,ch:'m',t:'square',v:0.07},{n:'r',d:0.5,ch:'m',t:'square',v:0},
        {n:'A4',d:0.5,ch:'m',t:'square',v:0.07},{n:'G4',d:0.25,ch:'m',t:'square',v:0.07},
        {n:'Fs4',d:0.25,ch:'m',t:'square',v:0.07},{n:'E4',d:1,ch:'m',t:'square',v:0.07},
        // 三全音装饰 (小丑牌感)
        {n:'B3',d:0.25,ch:'m',t:'square',v:0.05},{n:'F4',d:0.25,ch:'m',t:'square',v:0.05},
        {n:'r',d:2.5,ch:'m',t:'square',v:0},
        // Bass:  walking bass
        {n:'E2',d:1,ch:'b',t:'triangle',v:0.10},{n:'Fs2',d:1,ch:'b',t:'triangle',v:0.10},
        {n:'G2',d:1,ch:'b',t:'triangle',v:0.10},{n:'B2',d:1,ch:'b',t:'triangle',v:0.10},
        {n:'A2',d:1,ch:'b',t:'triangle',v:0.10},{n:'G2',d:1,ch:'b',t:'triangle',v:0.10},
        {n:'Fs2',d:1,ch:'b',t:'triangle',v:0.10},{n:'E2',d:1,ch:'b',t:'triangle',v:0.10},
        // 拨弦点缀
        {n:'E3',d:0.125,ch:'d',t:'triangle',v:0.04},{n:'r',d:0.875,ch:'d',t:'triangle',v:0},
        {n:'B3',d:0.125,ch:'d',t:'triangle',v:0.04},{n:'r',d:1.875,ch:'d',t:'triangle',v:0},
        {n:'G3',d:0.125,ch:'d',t:'triangle',v:0.04},{n:'r',d:1.875,ch:'d',t:'triangle',v:0}
      ]
    },

    // === MINING: 阴河撑船 ===
    // D小调, BPM96, 划船律动, 稳健节奏感
    mining: {
      bpm: 96,
      data: [
        // Melody: 划船号子
        {n:'D4',d:0.75,ch:'m',t:'square',v:0.07},{n:'A3',d:0.75,ch:'m',t:'square',v:0.07},
        {n:'D4',d:0.5,ch:'m',t:'square',v:0.07},{n:'F4',d:0.75,ch:'m',t:'square',v:0.07},
        {n:'D4',d:0.75,ch:'m',t:'square',v:0.07},{n:'A3',d:0.5,ch:'m',t:'square',v:0.07},
        {n:'G4',d:0.75,ch:'m',t:'square',v:0.07},{n:'F4',d:0.75,ch:'m',t:'square',v:0.07},
        {n:'D4',d:0.5,ch:'m',t:'square',v:0.07},{n:'A3',d:0.75,ch:'m',t:'square',v:0.07},
        {n:'D4',d:0.75,ch:'m',t:'square',v:0.07},{n:'F4',d:0.5,ch:'m',t:'square',v:0.07},
        // Bass: 沉稳的划船节奏
        {n:'D2',d:1,ch:'b',t:'triangle',v:0.11},{n:'D2',d:1,ch:'b',t:'triangle',v:0.11},
        {n:'A2',d:1,ch:'b',t:'triangle',v:0.11},{n:'A2',d:1,ch:'b',t:'triangle',v:0.11},
        {n:'D2',d:1,ch:'b',t:'triangle',v:0.11},{n:'D2',d:1,ch:'b',t:'triangle',v:0.11},
        {n:'A2',d:1,ch:'b',t:'triangle',v:0.11},{n:'A2',d:1,ch:'b',t:'triangle',v:0.11},
        // 水波装饰 (高频三角波, 极短, 模拟水花)
        {n:'D5',d:0.0625,ch:'d',t:'triangle',v:0.02},{n:'r',d:0.9375,ch:'d',t:'triangle',v:0},
        {n:'A4',d:0.0625,ch:'d',t:'triangle',v:0.02},{n:'r',d:1.9375,ch:'d',t:'triangle',v:0},
        {n:'F4',d:0.0625,ch:'d',t:'triangle',v:0.02},{n:'r',d:1.9375,ch:'d',t:'triangle',v:0}
      ]
    }
  };

  function init() {
    try { _ac = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { _ac = null; }
    if (_ac) {
      _bgm.masterGain = _ac.createGain();
      _bgm.masterGain.gain.value = 0;
      _bgm.masterGain.connect(_ac.destination);
    }
  }

  // ── 音效 ──
  function play(name) {
    if (!_ac || _sfxMuted) return;
    if (_ac.state === 'suspended') _ac.resume();
    var osc = _ac.createOscillator();
    var gain = _ac.createGain();
    osc.connect(gain);
    gain.connect(_ac.destination);
    var t = _ac.currentTime;

    switch(name) {
      case 'coin':
        osc.type='triangle'; osc.frequency.setValueAtTime(800,t);
        osc.frequency.exponentialRampToValueAtTime(1200,t+0.08);
        gain.gain.setValueAtTime(0.15,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.12);
        osc.start(t); osc.stop(t+0.12); break;
      case 'hit':
        osc.type='square'; osc.frequency.setValueAtTime(200,t);
        osc.frequency.exponentialRampToValueAtTime(80,t+0.1);
        gain.gain.setValueAtTime(0.12,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.1);
        osc.start(t); osc.stop(t+0.1); break;
      case 'chain':
        osc.type='sawtooth'; osc.frequency.setValueAtTime(300,t);
        osc.frequency.exponentialRampToValueAtTime(150,t+0.15);
        gain.gain.setValueAtTime(0.08,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.15);
        osc.start(t); osc.stop(t+0.15); break;
      case 'catchOk':
        osc.type='sine'; osc.frequency.setValueAtTime(523,t);
        osc.frequency.setValueAtTime(659,t+0.1);
        osc.frequency.setValueAtTime(784,t+0.2);
        gain.gain.setValueAtTime(0.15,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.35);
        osc.start(t); osc.stop(t+0.35); break;
      case 'escape':
        osc.type='sine'; osc.frequency.setValueAtTime(400,t);
        osc.frequency.exponentialRampToValueAtTime(100,t+0.3);
        gain.gain.setValueAtTime(0.1,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.3);
        osc.start(t); osc.stop(t+0.3); break;
      case 'bigwin':
        osc.type='sine'; osc.frequency.setValueAtTime(523,t);
        osc.frequency.setValueAtTime(659,t+0.08);
        osc.frequency.setValueAtTime(784,t+0.16);
        osc.frequency.setValueAtTime(1047,t+0.24);
        gain.gain.setValueAtTime(0.18,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.5);
        osc.start(t); osc.stop(t+0.5); break;
      case 'tick':
        osc.type='sine'; osc.frequency.setValueAtTime(1000,t);
        gain.gain.setValueAtTime(0.06,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.03);
        osc.start(t); osc.stop(t+0.03); break;
      case 'btn':
        osc.type='triangle'; osc.frequency.setValueAtTime(600,t);
        gain.gain.setValueAtTime(0.1,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.06);
        osc.start(t); osc.stop(t+0.06); break;
      default: break;
    }
  }

  // ── BGM 音序器 ──
  function _secondsPerBeat(bpm) { return 60 / bpm; }

  function _scheduleNote(noteData, time) {
    if (!_ac || noteData.n === 'r') return;
    var freq = _NOTES[noteData.n];
    if (!freq) return;

    var osc = _ac.createOscillator();
    var gain = _ac.createGain();
    osc.type = noteData.t || 'square';
    osc.frequency.value = freq;

    // 8bit音色: 方波加轻微滤波感 (用 lowpass 模拟)
    if (noteData.t === 'square') {
      var filter = _ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000 + M.random() * 500;
      filter.Q.value = 0.5;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(_bgm.masterGain);

    var dur = noteData.d * _secondsPerBeat(_bgm.bpm) * 0.95; // 稍微断开，避免粘连
    var vol = noteData.v || 0.06;
    if (_bgmMuted) vol = 0;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.start(time);
    osc.stop(time + dur);
  }

  function _scheduler() {
    if (!_bgm.isPlaying || !_ac) return;
    var lookahead = _bgm.lookahead;
    var spb = _secondsPerBeat(_bgm.bpm);

    while (_bgm.nextNoteTime < _ac.currentTime + lookahead) {
      var noteData = _bgm.patterns[_bgm.beatIndex];
      if (noteData) {
        _scheduleNote(noteData, _bgm.nextNoteTime);
      }
      _bgm.beatIndex++;
      if (_bgm.beatIndex >= _bgm.patterns.length) {
        _bgm.beatIndex = 0;
      }
      _bgm.nextNoteTime += noteData ? noteData.d * spb : spb;
    }

    _bgm.timerID = setTimeout(_scheduler, 50);
  }

  function playBGM(trackName, fadeInSec) {
    if (!_ac) return;
    if (_ac.state === 'suspended') _ac.resume();

    var track = _TRACKS[trackName];
    if (!track) return;

    // 如果正在播放同曲目，不重置
    if (_bgm.isPlaying && _bgm.trackName === trackName) return;

    // 淡出当前
    if (_bgm.isPlaying) {
      _stopBGMInternal(0.8);
    }

    _bgm.trackName = trackName;
    _bgm.bpm = track.bpm;
    _bgm.patterns = track.data;
    _bgm.beatIndex = 0;
    _bgm.nextNoteTime = _ac.currentTime + 0.1;
    _bgm.isPlaying = true;

    // 淡入
    var fi = fadeInSec || 1.5;
    var t = _ac.currentTime;
    _bgm.masterGain.gain.cancelScheduledValues(t);
    _bgm.masterGain.gain.setValueAtTime(0, t);
    _bgm.masterGain.gain.linearRampToValueAtTime(_bgmMuted ? 0 : 0.35, t + fi);

    _scheduler();
  }

  function _stopBGMInternal(fadeOutSec) {
    if (!_ac || !_bgm.isPlaying) return;
    var fo = fadeOutSec || 1.0;
    var t = _ac.currentTime;
    _bgm.masterGain.gain.cancelScheduledValues(t);
    _bgm.masterGain.gain.setValueAtTime(_bgm.masterGain.gain.value, t);
    _bgm.masterGain.gain.linearRampToValueAtTime(0, t + fo);

    if (_bgm.timerID) {
      clearTimeout(_bgm.timerID);
      _bgm.timerID = null;
    }
    _bgm.isPlaying = false;
    _bgm.trackName = null;
  }

  function stopBGM(fadeOutSec) {
    _stopBGMInternal(fadeOutSec);
  }

  function switchBGM(trackName) {
    playBGM(trackName, 1.2);
  }

  function getCurrentBGM() {
    return _bgm.trackName;
  }

  function cycleBGM() {
    var tracks = ['idle', 'shop', 'mining'];
    var cur = _bgm.trackName || 'idle';
    var idx = tracks.indexOf(cur);
    var next = tracks[(idx + 1) % tracks.length];
    playBGM(next, 1.0);
    return next;
  }

  function toggleSfxMute() { _sfxMuted = !_sfxMuted; return _sfxMuted; }
  function toggleBgmMute() {
    _bgmMuted = !_bgmMuted;
    if (_ac && _bgm.masterGain) {
      var t = _ac.currentTime;
      _bgm.masterGain.gain.cancelScheduledValues(t);
      _bgm.masterGain.gain.setValueAtTime(_bgm.masterGain.gain.value, t);
      _bgm.masterGain.gain.linearRampToValueAtTime(_bgmMuted ? 0 : 0.35, t + 0.3);
    }
    return _bgmMuted;
  }
  function isSfxMuted() { return _sfxMuted; }
  function isBgmMuted() { return _bgmMuted; }
  function setSfxMuted(v) { _sfxMuted = v; }
  function setBgmMuted(v) {
    _bgmMuted = v;
    if (_ac && _bgm.masterGain) {
      var t = _ac.currentTime;
      _bgm.masterGain.gain.cancelScheduledValues(t);
      _bgm.masterGain.gain.setValueAtTime(_bgm.masterGain.gain.value, t);
      _bgm.masterGain.gain.linearRampToValueAtTime(_bgmMuted ? 0 : 0.35, t + 0.3);
    }
  }

  return {
    init:init, play:play,
    playBGM:playBGM, stopBGM:stopBGM, switchBGM:switchBGM,
    getCurrentBGM:getCurrentBGM, cycleBGM:cycleBGM,
    toggleSfxMute:toggleSfxMute, toggleBgmMute:toggleBgmMute,
    isSfxMuted:isSfxMuted, isBgmMuted:isBgmMuted,
    setSfxMuted:setSfxMuted, setBgmMuted:setBgmMuted
  };
})();
