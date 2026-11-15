/* 더치노트 — 계산 코어 (DOM 없음)
   음식값 = 총액 × (1 − 주류비중) → 참석 가중치 비율
   주류값 = 총액 × 주류비중 → 술 마신 사람 가중치 비율 */
(function () {
  'use strict';

  var CONDS = [
    { v: 'full', label: '전체 참석', w: 1 },
    { v: 'late', label: '늦게 도착', w: 0.8 },
    { v: 'early', label: '먼저 귀가', w: 0.7 },
    { v: 'first', label: '1차만 참석', w: 0.6 },
    { v: 'second', label: '2차만 참석', w: 0.4 },
    { v: 'brief', label: '잠깐 들름', w: 0.25 }
  ];

  function condOf(v) {
    for (var i = 0; i < CONDS.length; i++) if (CONDS[i].v === v) return CONDS[i];
    return CONDS[0];
  }

  function compute(input) {
    var total = Math.max(0, Number(input.total) || 0);
    var share = Math.min(0.9, Math.max(0, Number(input.alcShare) || 0));
    var unit = Number(input.unit) || 1000;
    var alcOnly = input.alcOnly !== false;
    var list = (input.members || []).map(function (m) {
      var c = condOf(m.cond);
      return { name: String(m.name || '이름 없음').slice(0, 20), cond: c.v, condLabel: c.label, w: c.w, drink: !!m.drink };
    });

    var foodPot = total * (1 - share);
    var alcPot = total * share;

    var foodSum = list.reduce(function (a, m) { return a + m.w; }, 0);
    var drinkers = list.filter(function (m) { return m.drink; });
    var alcSum = drinkers.reduce(function (a, m) { return a + m.w; }, 0);

    /* 술 마신 사람이 없거나 함께 나누는 경우 */
    var alcDistributed = alcOnly && drinkers.length > 0;
    if (!alcDistributed) {
      foodPot = total;
      alcPot = 0;
    }

    var results = list.map(function (m, i) {
      var foodShare = foodSum > 0 ? foodPot * (m.w / foodSum) : 0;
      var alcShareAmt = (alcDistributed && m.drink && alcSum > 0) ? alcPot * (m.w / alcSum) : 0;
      var raw = foodShare + alcShareAmt;
      return {
        index: i,
        name: m.name,
        cond: m.cond,
        condLabel: m.condLabel,
        weight: m.w,
        drink: m.drink,
        foodPart: foodShare,
        alcPart: alcShareAmt,
        raw: raw,
        amount: raw,
        rounded: Math.round(raw / unit) * unit
      };
    });

    /* 반올림 후 합계를 총액에 맞춤 */
    var sumRounded = results.reduce(function (a, r) { return a + Math.max(0, r.rounded); }, 0);
    var diff = Math.round(total - sumRounded);
    if (results.length) {
      var maxIdx = 0;
      results.forEach(function (r, i) { if (r.raw > results[maxIdx].raw) maxIdx = i; });
      var adj = Math.max(0, results[maxIdx].rounded + diff);
      results[maxIdx].rounded = adj;
      results[maxIdx].adjust = diff;
    }

    results.forEach(function (r) { r.amount = Math.max(0, r.rounded); });

    var sum = results.reduce(function (a, r) { return a + r.amount; }, 0);
    var amounts = results.map(function (r) { return r.amount; });
    var max = amounts.length ? Math.max.apply(null, amounts) : 0;
    var min = amounts.length ? Math.min.apply(null, amounts) : 0;
    var avg = list.length ? total / list.length : 0;

    return {
      total: total,
      alcShare: share,
      unit: unit,
      alcOnly: alcOnly,
      foodPot: foodPot,
      alcPot: alcPot,
      foodSum: foodSum,
      alcSum: alcSum,
      alcDistributed: alcDistributed,
      drinkerCount: drinkers.length,
      members: list,
      results: results,
      sum: sum,
      max: max,
      min: min,
      maxName: (results.filter(function (r) { return r.amount === max; })[0] || {}).name || '',
      minName: (results.filter(function (r) { return r.amount === min; })[0] || {}).name || '',
      avg: avg,
      simple: list.length ? total / list.length : 0,
      balanced: Math.abs(sum - Math.round(total)) <= 0
    };
  }

  window.DutchCore = { compute: compute, CONDS: CONDS, condOf: condOf };
})();
