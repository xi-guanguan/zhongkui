/* audio.js — Web Audio 音效：程序化合成
 * 依赖：无
 * 暴露：Audio (全局) */

var Audio = (function() {
  var _ac = null;
  var _muted = false;

  function init() {
    try { _ac = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { _ac = null; }
  }

  function play(name) {
    if (!_ac || _muted) return;
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

  function toggleMute() { _muted = !_muted; return _muted; }
  function isMuted() { return _muted; }

  return { init:init, play:play, toggleMute:toggleMute, isMuted:isMuted };
})();
