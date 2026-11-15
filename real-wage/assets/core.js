/* 시급노트 — 계산 코어 (DOM 없음, 단독 테스트 가능)
   진짜 시급 = 월 실수령액 ÷ (하루 근무 + 야근 + 점심(구속) + 통근) × 주 근무일 × 4.345주 */
(function () {
  'use strict';

  var WEEKS = 365 / 7 / 12;   /* 4.345238… */
  var MIN_WAGE = 10320;       /* 2026년 법정 최저시급 */
  var MIN_WAGE_NEXT = 10700;  /* 2027년 1월 1일부터 */

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function compute(input) {
    var s = {
      mode: input.mode === 'net' ? 'net' : 'gross',
      pay: Math.max(0, Number(input.pay) || 0),
      days: clamp(Number(input.days) || 5, 1, 7),
      hours: clamp(Number(input.hours) || 0, 0.5, 16),
      overtime: clamp(Number(input.overtime) || 0, 0, 12),
      lunch: clamp(Number(input.lunch) || 0, 0, 180),
      lunchBound: input.lunchBound !== false,
      commute: clamp(Number(input.commute) || 0, 0, 360)
    };

    var opts = {
      meal: clamp(Number(input.meal) || 0, 0, 200000),
      dependents: clamp(Number(input.dependents) || 1, 1, 10),
      children: 0
    };

    var tx = s.mode === 'net' ? TaxKR.toGross(s.pay, opts) : TaxKR.fromGross(s.pay, opts);
    var dailyMin = s.hours * 60 + s.overtime * 60 + (s.lunchBound ? s.lunch : 0) + s.commute;
    var weekMin = dailyMin * s.days;
    var monthMin = weekMin * WEEKS;
    var monthHours = monthMin / 60;

    var gross = tx.gross;
    var net = tx.net;
    var realNet = monthHours > 0 ? net / monthHours : 0;
    var realGross = monthHours > 0 ? gross / monthHours : 0;

    var contractHours = s.hours * s.days * WEEKS;
    var contractHourly = contractHours > 0 ? gross / contractHours : 0;

    var noCommuteHours = (dailyMin - s.commute) * s.days * WEEKS / 60;
    var noCommuteHourly = noCommuteHours > 0 ? net / noCommuteHours : 0;

    var ratio = realNet / MIN_WAGE;
    var yearHours = monthHours * 12;
    var commuteMonthHours = s.commute * s.days * WEEKS / 60;

    return {
      state: s,
      opts: opts,
      tx: tx,
      gross: gross,
      net: net,
      dailyMin: dailyMin,
      weekMin: weekMin,
      monthMin: monthMin,
      monthHours: monthHours,
      realNet: realNet,
      realGross: realGross,
      contractHourly: contractHourly,
      noCommuteHourly: noCommuteHourly,
      ratio: ratio,
      minWage: MIN_WAGE,
      minWageNext: MIN_WAGE_NEXT,
      yearHours: yearHours,
      yearDays: yearHours / 24,
      commuteMonthHours: commuteMonthHours,
      commuteYearHours: commuteMonthHours * 12
    };
  }

  /* 통근 시간만 바꾼 시나리오 (표) */
  function scenario(input, commutes) {
    return (commutes || [0, 30, 60, 90, 120, 150]).map(function (c) {
      var r = compute(Object.assign({}, input, { commute: c }));
      return { commute: c, hourMin: r.dailyMin, monthHours: r.monthHours, hourly: r.realNet, ratio: r.ratio };
    });
  }

  window.WageCore = { compute: compute, scenario: scenario, WEEKS: WEEKS, MIN_WAGE: MIN_WAGE, MIN_WAGE_NEXT: MIN_WAGE_NEXT };
})();
