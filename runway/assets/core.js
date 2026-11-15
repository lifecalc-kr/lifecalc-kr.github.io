/* 런웨이노트 — 계산 코어 (DOM 없음)
   버티는 개월 = (저축 + 실업급여 총액) ÷ 월 고정비 */
(function () {
  'use strict';

  var UI_MAX = 68100;      /* 2026.1.1 이후 이직자 1일 상한 */
  var UI_MIN_HOUR = 8256;  /* 2026 하한 1시간: 66,048원 ÷ 8 */
  var MIN_WAGE = 10320;
  var DAYS_PER_MONTH = 30.4375;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* 소정급여일수: 나이·고용보험 가입기간 */
  function benefitDays(age, insuredMonths, senior) {
    var old = senior || age >= 50;
    if (insuredMonths < 12) return 120;
    if (insuredMonths < 36) return old ? 180 : 150;
    if (insuredMonths < 60) return old ? 210 : 180;
    if (insuredMonths < 120) return old ? 240 : 210;
    return old ? 270 : 240;
  }

  /* 자동 실업급여 추정 */
  function autoUI(input) {
    var wage = Math.max(0, Number(input.wage) || 0);
    var age = clamp(Number(input.age) || 35, 15, 99);
    var years = clamp(Number(input.years) || 0, 0, 40);
    var insuredMonths = Math.round(years * 12);
    var hours = clamp(Number(input.hoursPerDay) || 8, 1, 12);

    var avgDaily = wage > 0 ? wage / DAYS_PER_MONTH : 0;
    var raw = avgDaily * 0.6;
    var minDaily = Math.round(UI_MIN_HOUR * hours);
    var maxDaily = UI_MAX;

    var daily = Math.round(raw);
    var applied = 'basis';
    if (daily < minDaily) { daily = minDaily; applied = 'min'; }
    if (daily > maxDaily) { daily = maxDaily; applied = 'max'; }

    var days = benefitDays(age, insuredMonths, !!input.senior);
    return {
      wage: wage,
      age: age,
      years: years,
      insuredMonths: insuredMonths,
      hoursPerDay: hours,
      avgDaily: avgDaily,
      raw: raw,
      daily: daily,
      minDaily: minDaily,
      maxDaily: maxDaily,
      applied: applied,
      days: days,
      months: days / DAYS_PER_MONTH,
      total: daily * days,
      eligible: insuredMonths >= 6
    };
  }

  function compute(input) {
    var savings = Math.max(0, Number(input.savings) || 0);
    var cost = Math.max(0,
      (Number(input.costHouse) || 0) + (Number(input.costFood) || 0) +
      (Number(input.costFix) || 0) + (Number(input.costEtc) || 0));
    var uiOn = input.uiOn !== false;
    var uiDaily = clamp(Number(input.uiDaily) || 0, 0, 500000);
    var uiDays = clamp(Number(input.uiDays) || 0, 0, 400);
    var uiMonths = uiDays / DAYS_PER_MONTH;
    var uiTotal = uiDaily * uiDays;

    var funds = savings + (uiOn ? uiTotal : 0);
    var months = cost > 0 ? funds / cost : 0;
    var noUI = cost > 0 ? savings / cost : 0;
    var cutMonths = cost > 100000 ? funds / (cost - 100000) : 0;

    var now = input.now ? new Date(input.now) : new Date();
    var end = new Date(now.getTime() + months * DAYS_PER_MONTH * 86400000);
    var noUIEnd = new Date(now.getTime() + noUI * DAYS_PER_MONTH * 86400000);

    return {
      savings: savings,
      cost: cost,
      uiOn: uiOn,
      uiDaily: uiDaily,
      uiDays: uiDays,
      uiMonths: uiMonths,
      uiTotal: uiTotal,
      funds: funds,
      months: months,
      days: months * DAYS_PER_MONTH,
      noUI: noUI,
      noUIEnd: noUIEnd,
      cutMonths: cutMonths,
      cutGainDays: (cutMonths - months) * DAYS_PER_MONTH,
      end: end,
      today: now
    };
  }

  /* 고정비 절감 시나리오 표 */
  function cutTable(input, steps) {
    var list = steps || [0, 100000, 200000, 300000, 500000];
    var base = compute(input);
    return list.map(function (cut) {
      var cost = Math.max(0, base.cost - cut);
      var months = cost > 0 ? base.funds / cost : 0;
      return {
        cut: cut,
        cost: cost,
        months: months,
        gainDays: months > 0 ? (months - base.months) * DAYS_PER_MONTH : 0
      };
    });
  }

  function formatDate(d) {
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  window.RunwayCore = {
    compute: compute,
    autoUI: autoUI,
    benefitDays: benefitDays,
    cutTable: cutTable,
    formatDate: formatDate,
    UI_MAX: UI_MAX,
    DAYS_PER_MONTH: DAYS_PER_MONTH
  };
})();
