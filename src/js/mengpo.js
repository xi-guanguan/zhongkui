/* mengpo.js — 孟婆对话：间断台词、好感反馈
 * 依赖：无
 * 暴露：MengPo (全局) */

var MengPo = (function() {
  var lines = {
    enter: ['来啦？', '今天气色不错嘛。', '冥界天气真热，来杯冷的？', '老样子？', '又来找我了～'],
    buy:   ['好眼光。', '这杯我也爱喝。', '要加珍珠吗？哦已经有了。', '祝你好运～'],
    idle:  ['发什么呆呢？', '要不...出去抓两只？', '站着也不点单啊。'],
    back:  ['辛苦了，喝杯茶歇歇。', '赚到钱了？让我看看。', '又去钩铜钱了？'],
    levelUp: { 2:'嗯...算你还不赖。', 3:'行吧，算你半个熟客。', 4:'每天都来，还挺有毅力。', 5:'...你是我最好的客人了。' }
  };

  var lastLine = null;

  function getLine(context) {
    var pool = lines[context];
    if (!pool) return null;

    // 好感升级按等级取
    if (context === 'levelUp') {
      var favor = (typeof State !== 'undefined') ? State.get('favor') : {level:2};
      return pool[favor.level] || '...';
    }

    // 不重复上一句
    var line;
    var attempts = 0;
    do {
      line = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (line === lastLine && pool.length > 1 && attempts < 10);
    lastLine = line;
    return line;
  }

  return {
    getLine: getLine
  };
})();
