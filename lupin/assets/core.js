/* 루팡노트 — 계산 코어 (DOM 없음)
   시간당 회사 비용 = 월급 ÷ (월 근무일 × 하루 근무시간) */
(function () {
  'use strict';

  var MIN_WAGE = 10320;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  var ITEMS = [
    { key: 'wc', label: '화장실', emoji: '🚽' },
    { key: 'coffee', label: '커피·담배', emoji: '☕' },
    { key: 'youtube', label: '유튜브·웹서핑', emoji: '📺' },
    { key: 'chat', label: '메신저·수다', emoji: '💬' }
  ];

  function grade(pct) {
    if (pct < 3) return { name: '성실한 모범사원', tier: 0, desc: '오늘은 거의 일만 했습니다. 화장실 1회는 인권입니다.' };
    if (pct < 8) return { name: '초보 루팡', tier: 1, desc: '평범한 직장인 수준입니다. 커피 한 잔의 여유는 필요하죠.' };
    if (pct < 15) return { name: '중급 루팡', tier: 2, desc: '이 정도면 회사가 커피값을 내준 셈입니다.' };
    if (pct < 25) return { name: '고수 루팡', tier: 3, desc: '하루의 4분의 1이 내 시간입니다. 유튜브 시청료를 회사가 냅니다.' };
    return { name: '전설의 루팡', tier: 4, desc: '회사가 당신의 취미 생활을 후원하고 있습니다. 이건 재능입니다.' };
  }

  function compute(input) {
    var mode = input.mode === 'net' ? 'net' : 'gross';
    var pay = Math.max(0, Number(input.pay) || 0);
    var days = clamp(Number(input.days) || 20.9, 1, 31);
    var hours = clamp(Number(input.hours) || 8, 1, 16);
    var opts = {
      meal: clamp(Number(input.meal) || 0, 0, 200000),
      dependents: clamp(Number(input.dependents) || 1, 1, 10),
      children: 0
    };

    var tx = mode === 'net' ? TaxKR.toGross(pay, opts) : TaxKR.fromGross(pay, opts);
    var gross = tx.gross;
    var net = tx.net;

    var mins = {};
    var totalMin = 0;
    ITEMS.forEach(function (it) {
      var v = clamp(Number(input[it.key]) || 0, 0, 720);
      mins[it.key] = v;
      totalMin += v;
    });

    var basePay = mode === 'net' ? net : gross;   /* 선택한 기준의 월급 */
    var paidHoursMonth = days * hours;
    var hourly = paidHoursMonth > 0 ? basePay / paidHoursMonth : 0;
    var minuteRate = hourly / 60;
    var dayMoney = totalMin * minuteRate;
    var monthMoney = dayMoney * days;
    var yearMoney = monthMoney * 12;
    var pct = hours > 0 ? (totalMin / (hours * 60)) * 100 : 0;

    var items = ITEMS.map(function (it) {
      return {
        key: it.key,
        label: it.label,
        emoji: it.emoji,
        min: mins[it.key],
        money: mins[it.key] * minuteRate,
        share: totalMin > 0 ? mins[it.key] / totalMin : 0
      };
    });

    var coffees = Math.floor(dayMoney / 4500);
    var chickens = Math.floor(dayMoney / 25000);
    var movies = Math.floor(dayMoney / 15000);
    var minWageHours = dayMoney / MIN_WAGE;

    return {
      mode: mode,
      pay: pay,
      gross: gross,
      net: net,
      basePay: basePay,
      tx: tx,
      days: days,
      hours: hours,
      minutes: totalMin,
      hoursTotal: totalMin / 60,
      paidHoursMonth: paidHoursMonth,
      hourly: hourly,
      minuteRate: minuteRate,
      dayMoney: dayMoney,
      monthMoney: monthMoney,
      yearMoney: yearMoney,
      pct: pct,
      grade: grade(pct),
      items: items,
      alts: { coffees: coffees, chickens: chickens, movies: movies, minWageHours: minWageHours },
      annualDaysEq: (totalMin * days * 12) / (hours * 60),
      minWage: MIN_WAGE
    };
  }

  window.LupinCore = { compute: compute, grade: grade, ITEMS: ITEMS, MIN_WAGE: MIN_WAGE };
})();
