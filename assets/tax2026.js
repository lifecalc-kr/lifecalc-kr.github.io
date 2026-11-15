/* ═══════════════════════════════════════════════════════════════
   TaxKR — 2026년 근로소득 간이 세후 계산 (공용)
   · 4대보험: 국민연금 9.5%(근로자 4.75%) · 건강보험 7.19%(3.595%)
     장기요양 건강보험료의 13.14% · 고용보험 1.8%(근로자 0.9%)
   · 소득세: 근로소득공제 → 인적공제 → 연금보험료공제 → 기본세율 →
     근로소득세액공제 → 자녀세액공제 → 지방소득세 10%
   · 식대 비과세 월 20만원(소득세법 §12 ③ 러목)
   회사마다 상여·수당·부양가족 신고가 달라 실제 급여명세서와 ±수만원
   차이가 날 수 있습니다. 참고용 간이 계산입니다.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = {
    year: 2026,
    minWageHourly: 10320,          // 고용노동부 고시 제2025-47호 (2026.1.1~12.31)
    minWageMonthly: 2156880,       // 209시간 기준
    minWageHourlyNext: 10700,      // 고용노동부 고시 제2026-60호 (2027.1.1~)
    pensionEmployeeRate: 0.0475,
    pensionMinBase: 410000,
    pensionMaxBase: 6590000,
    healthEmployeeRate: 0.03595,
    healthMinPremium: 10080,
    healthMaxPremium: 4591740,
    careRateOfHealth: 0.1314,
    employEmployeeRate: 0.009,
    mealNonTaxLimit: 200000
  };

  var BRACKETS = [
    [14000000, 0.06, 0],
    [50000000, 0.15, 1260000],
    [88000000, 0.24, 5760000],
    [150000000, 0.35, 15440000],
    [300000000, 0.38, 19940000],
    [500000000, 0.40, 25940000],
    [1000000000, 0.42, 35940000],
    [Infinity, 0.45, 65940000]
  ];

  function floorTo(v, unit) { return isFinite(v) ? Math.floor(v / unit) * unit : 0; }
  function won10(v) { return floorTo(v, 10); }

  function taxByBracket(base) {
    if (base <= 0) return 0;
    for (var i = 0; i < BRACKETS.length; i++) {
      if (base <= BRACKETS[i][0]) return base * BRACKETS[i][1] - BRACKETS[i][2];
    }
    return 0;
  }

  function laborIncomeDeduction(gross) {
    if (gross <= 0) return 0;
    var d;
    if (gross <= 5000000) d = gross * 0.7;
    else if (gross <= 15000000) d = 3500000 + (gross - 5000000) * 0.4;
    else if (gross <= 45000000) d = 7500000 + (gross - 15000000) * 0.15;
    else if (gross <= 100000000) d = 12000000 + (gross - 45000000) * 0.05;
    else d = 14750000 + (gross - 100000000) * 0.02;
    return Math.min(Math.floor(d), 20000000);
  }

  function creditLimit(gross) {
    if (gross <= 33000000) return 740000;
    if (gross <= 70000000) return 660000;
    if (gross <= 120000000) return 500000;
    return 200000;
  }

  function childCredit(n) {
    if (n <= 0) return 0;
    if (n === 1) return 250000;
    if (n === 2) return 550000;
    return 550000 + (n - 2) * 300000;
  }

  /**
   * 월 세전급여 → 세후(실수령)
   * opts: { meal: 식대(비과세, 최대 20만), dependents: 부양가족 수(본인 포함), children: 자녀 수 }
   */
  function fromGross(monthlyGross, opts) {
    opts = opts || {};
    var gross = Math.max(0, Math.min(Number(monthlyGross) || 0, 200000000));
    var meal = Math.max(0, Math.min(Number(opts.meal) || 0, C.mealNonTaxLimit));
    var dependents = Math.max(1, Math.min(Number(opts.dependents) || 1, 10));
    var children = Math.max(0, Math.min(Number(opts.children) || 0, 10));

    var taxableMonthly = Math.max(0, gross - meal);

    var pensionBase = Math.min(Math.max(floorTo(taxableMonthly, 1000), C.pensionMinBase), C.pensionMaxBase);
    var pension = won10(pensionBase * C.pensionEmployeeRate);
    var health = won10(Math.min(Math.max(taxableMonthly * C.healthEmployeeRate, C.healthMinPremium), C.healthMaxPremium));
    var care = won10(health * C.careRateOfHealth);
    var employ = won10(taxableMonthly * C.employEmployeeRate);
    var insurance = pension + health + care + employ;

    var taxableAnnual = taxableMonthly * 12;
    var laborIncome = Math.max(0, taxableAnnual - laborIncomeDeduction(taxableAnnual));
    var personal = 1500000 * dependents;
    var pensionDeduct = pension * 12;
    var otherInsurance = (health + care + employ) * 12;

    var taxBase = Math.max(0, laborIncome - personal - pensionDeduct - otherInsurance);
    var calculated = taxByBracket(taxBase);
    var creditRaw = calculated <= 1300000 ? calculated * 0.55 : 715000 + (calculated - 1300000) * 0.30;
    var wageCredit = Math.min(floorTo(creditRaw, 1), creditLimit(taxableAnnual));
    var incomeTaxAnnual = Math.max(0, won10(calculated - wageCredit - childCredit(children)));

    var incomeTax = won10(incomeTaxAnnual / 12);
    var localTax = won10(incomeTax * 0.1);
    var deduction = insurance + incomeTax + localTax;

    return {
      year: C.year,
      gross: gross,
      meal: meal,
      taxable: taxableMonthly,
      pension: pension,
      health: health,
      care: care,
      employ: employ,
      insurance: insurance,
      incomeTax: incomeTax,
      localTax: localTax,
      deduction: deduction,
      net: Math.max(0, gross - deduction),
      rate: gross > 0 ? deduction / gross : 0
    };
  }

  /** 월 세후 실수령액 → 세전급여 (이분탐색) */
  function toGross(monthlyNet, opts) {
    var target = Math.max(0, Number(monthlyNet) || 0);
    if (target <= 0) return fromGross(0, opts);
    var lo = target;
    var hi = Math.max(target * 1.05, target + 200000);
    var guard = 0;
    while (fromGross(hi, opts).net < target && guard < 60) { hi *= 1.15; guard++; }
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (fromGross(mid, opts).net < target) lo = mid; else hi = mid;
    }
    var r = fromGross(Math.round((lo + hi) / 2), opts);
    r.fromNet = true;
    return r;
  }

  window.TaxKR = {
    C: C,
    fromGross: fromGross,
    toGross: toGross
  };
})();
