/*!
 * 퇴사·월급 노트 — 2026 퇴사 원스톱 계산기 (실수령액 · 퇴직금 · 연차수당 · 실업급여 · 건강보험 전환)
 * 2026년 기준 공식 수치를 반영했습니다. 모든 계산은 브라우저 안에서만 이루어지며
 * 입력값은 어디에도 전송·저장되지 않습니다.
 */
(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────
   * 1. 2026년 기준 상수 (출처는 index.html 하단 '출처' 참고)
   * ──────────────────────────────────────────────────────────── */
  var C = {
    year: 2026,
    // 최저임금 (고용노동부 고시 제2025-47호, 2026.1.1~12.31)
    minWageHourly: 10320,
    minWageMonthly: 2156880,
    // 국민연금 (2026년 9.5%, 근로자 4.75%)
    pensionEmployeeRate: 0.0475,
    pensionMinBase: 410000,
    pensionMaxBase: 6590000,
    // 건강보험 (2026년 7.19%, 근로자 3.595%)
    healthRate: 0.0719,
    healthEmployeeRate: 0.03595,
    healthMinPremium: 10080,    // 노사 합계 하한 20,160원의 근로자 부담분
    healthMaxPremium: 4591740,  // 노사 합계 상한 9,183,480원의 근로자 부담분
    // 장기요양보험 (0.9448% → 건강보험료의 13.14%)
    careRateOfHealth: 0.1314,
    // 고용보험 실업급여 (2026년 1.8%, 근로자 0.9%)
    employEmployeeRate: 0.009,
    // 비과세 식대 한도 (소득세법 제12조 제3호 러목)
    mealNonTaxLimit: 200000,
    // 구직급여(실업급여) 2026년 기준
    uiMaxDailyBase: 113500,
    uiMaxDaily: 68100,
    uiMinDailyHours: 8,
    // 지역가입자 건강보험료 (2026년)
    localMinPremium: 20160,      // 소득월액 28만원 이하 세대 최저보험료
    localMaxPremium: 4591740,
    localLowIncomeLine: 280000,  // 소득월액 기준선
    propertyDeduction: 100000000, // 재산 기본공제 1억원
    propertyPointValue: 211.5,    // 재산보험료 부과점수당 금액
    // 임의계속가입자 보험료 경감률 (보건복지부 보험료 경감고시 제9조)
    voluntaryReliefRate: 0.5,
    voluntaryMaxMonths: 36
  };

  // 종합소득 기본세율 (소득세법 제55조) — 과세표준 상한, 세율, 누진공제
  var TAX_BRACKETS = [
    [14000000, 0.06, 0],
    [50000000, 0.15, 1260000],
    [88000000, 0.24, 5760000],
    [150000000, 0.35, 15440000],
    [300000000, 0.38, 19940000],
    [500000000, 0.40, 25940000],
    [1000000000, 0.42, 35940000],
    [Infinity, 0.45, 65940000]
  ];

  // 지역가입자 재산보험료 부과점수 60등급 (국민건강보험법 시행령 별표4)
  // [재산 공제 후 금액 상한(원), 점수]
  var PROPERTY_POINTS = [
    [4500000, 22], [9000000, 44], [13500000, 66], [18000000, 97], [22500000, 122],
    [27000000, 146], [31500000, 171], [36000000, 195], [40500000, 219], [45000000, 244],
    [50200000, 268], [55900000, 294], [62200000, 320], [69300000, 344], [77100000, 365],
    [85900000, 386], [95700000, 412], [107000000, 439], [119000000, 465], [133000000, 490],
    [148000000, 516], [164000000, 535], [183000000, 559], [204000000, 586], [227000000, 611],
    [253000000, 637], [281000000, 659], [313000000, 681], [349000000, 706], [388000000, 731],
    [432000000, 757], [481000000, 785], [536000000, 812], [597000000, 841], [665000000, 881],
    [740000000, 921], [824000000, 961], [918000000, 1001], [1030000000, 1041], [1140000000, 1091],
    [1270000000, 1141], [1420000000, 1191], [1580000000, 1241], [1760000000, 1291], [1960000000, 1341],
    [2180000000, 1391], [2420000000, 1451], [2700000000, 1511], [3000000000, 1571], [3300000000, 1641],
    [3630000000, 1711], [3993000000, 1781], [4392300000, 1851], [4831530000, 1921], [5314680000, 1991],
    [5846150000, 2061], [6430770000, 2131], [7073850000, 2201], [7781240000, 2271], [Infinity, 2341]
  ];

  /* ────────────────────────────────────────────────────────────
   * 2. 공통 유틸
   * ──────────────────────────────────────────────────────────── */
  function floorTo(value, unit) {
    if (!isFinite(value)) return 0;
    return Math.floor(value / unit) * unit;
  }
  var won10 = function (v) { return floorTo(v, 10); };
  var won1 = function (v) { return floorTo(v, 1); };

  function taxByBracket(base) {
    if (base <= 0) return 0;
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      if (base <= TAX_BRACKETS[i][0]) {
        return base * TAX_BRACKETS[i][1] - TAX_BRACKETS[i][2];
      }
    }
    return 0;
  }

  function marginalRate(base) {
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      if (base <= TAX_BRACKETS[i][0]) return TAX_BRACKETS[i][1];
    }
    return 0.45;
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

  function wageTaxCreditLimit(gross) {
    if (gross <= 33000000) return 740000;
    if (gross <= 70000000) return 660000;
    if (gross <= 120000000) return 500000;
    return 200000;
  }

  function childTaxCredit(children) {
    if (children <= 0) return 0;
    if (children === 1) return 250000;
    if (children === 2) return 550000;
    return 550000 + (children - 2) * 300000;
  }

  function propertyPoints(amount) {
    if (amount <= 0) return 0;
    for (var i = 0; i < PROPERTY_POINTS.length; i++) {
      if (amount <= PROPERTY_POINTS[i][0]) return PROPERTY_POINTS[i][1];
    }
    return 2341;
  }

  function toDate(str) {
    if (!str) return null;
    var p = String(str).split('-');
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  function daysBetween(a, b) {
    var MS = 86400000;
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / MS);
  }
  function addMonths(d, m) {
    var y = d.getFullYear();
    var mo = d.getMonth() + m;
    var day = d.getDate();
    var target = new Date(y, mo, 1);
    var lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return target;
  }

  /* ────────────────────────────────────────────────────────────
   * 3. ① 연봉·월급 실수령액
   * ──────────────────────────────────────────────────────────── */
  function computeSalary(input) {
    var annual = Math.max(0, Math.min(Number(input.annual) || 0, 2000000000));
    var monthlyGross = annual / 12;
    var mealMonthly = Math.max(0, Math.min(Number(input.meal) || 0, C.mealNonTaxLimit));
    var dependents = Math.max(1, Math.min(Number(input.dependents) || 1, 10));
    var children = Math.max(0, Math.min(Number(input.children) || 0, 10));

    var taxableMonthly = Math.max(0, monthlyGross - mealMonthly);

    var pensionBase = Math.min(
      Math.max(floorTo(taxableMonthly, 1000), C.pensionMinBase),
      C.pensionMaxBase
    );
    var pension = won10(pensionBase * C.pensionEmployeeRate);

    var health = won10(Math.min(
      Math.max(taxableMonthly * C.healthEmployeeRate, C.healthMinPremium),
      C.healthMaxPremium
    ));
    var care = won10(health * C.careRateOfHealth);
    var employ = won10(taxableMonthly * C.employEmployeeRate);

    var insuranceMonthly = pension + health + care + employ;

    var taxableAnnual = taxableMonthly * 12;
    var laborDeduction = laborIncomeDeduction(taxableAnnual);
    var laborIncome = Math.max(0, taxableAnnual - laborDeduction);

    var personalDeduction = 1500000 * dependents;
    var pensionDeduction = pension * 12;
    var otherInsuranceDeduction = (health + care + employ) * 12;

    var taxBase = Math.max(0, laborIncome - personalDeduction - pensionDeduction - otherInsuranceDeduction);

    var calculatedTax = taxByBracket(taxBase);
    var creditRaw = calculatedTax <= 1300000
      ? calculatedTax * 0.55
      : 715000 + (calculatedTax - 1300000) * 0.30;
    var wageCredit = Math.min(won1(creditRaw), wageTaxCreditLimit(taxableAnnual));
    var childCredit = childTaxCredit(children);

    var incomeTaxAnnual = Math.max(0, won10(calculatedTax - wageCredit - childCredit));
    var localTaxAnnual = won10(incomeTaxAnnual * 0.1);

    var incomeTaxMonthly = won10(incomeTaxAnnual / 12);
    var localTaxMonthly = won10(incomeTaxMonthly * 0.1);

    var totalDeduction = insuranceMonthly + incomeTaxMonthly + localTaxMonthly;

    return {
      annual: annual,
      monthlyGross: monthlyGross,
      mealMonthly: mealMonthly,
      taxableMonthly: taxableMonthly,
      pension: pension,
      health: health,
      care: care,
      employ: employ,
      insuranceMonthly: insuranceMonthly,
      insuranceAnnual: insuranceMonthly * 12,
      taxableAnnual: taxableAnnual,
      laborDeduction: laborDeduction,
      laborIncome: laborIncome,
      personalDeduction: personalDeduction,
      pensionDeduction: pensionDeduction,
      otherInsuranceDeduction: otherInsuranceDeduction,
      taxBase: taxBase,
      calculatedTax: calculatedTax,
      wageCredit: wageCredit,
      childCredit: childCredit,
      incomeTaxAnnual: incomeTaxAnnual,
      localTaxAnnual: localTaxAnnual,
      incomeTaxMonthly: incomeTaxMonthly,
      localTaxMonthly: localTaxMonthly,
      totalDeduction: totalDeduction,
      netMonthly: monthlyGross - totalDeduction,
      netAnnual: (monthlyGross - totalDeduction) * 12,
      deductionRate: monthlyGross > 0 ? totalDeduction / monthlyGross : 0,
      marginalRate: marginalRate(taxBase),
      dependents: dependents,
      children: children
    };
  }

  /* ────────────────────────────────────────────────────────────
   * 4. ② 퇴직금 + 퇴직소득세
   * ──────────────────────────────────────────────────────────── */
  function computeRetirementTax(severance, workDays) {
    var serviceYears = Math.max(1, Math.ceil(workDays / 365));
    var yearsDeduction;
    if (serviceYears <= 5) yearsDeduction = serviceYears * 1000000;
    else if (serviceYears <= 10) yearsDeduction = 5000000 + (serviceYears - 5) * 2000000;
    else if (serviceYears <= 20) yearsDeduction = 15000000 + (serviceYears - 10) * 2500000;
    else yearsDeduction = 40000000 + (serviceYears - 20) * 3000000;

    var afterYears = Math.max(0, severance - yearsDeduction);
    var converted = won1(afterYears * 12 / serviceYears);

    var convertedDeduction;
    if (converted <= 8000000) convertedDeduction = converted;
    else if (converted <= 70000000) convertedDeduction = 8000000 + (converted - 8000000) * 0.6;
    else if (converted <= 100000000) convertedDeduction = 45200000 + (converted - 70000000) * 0.55;
    else if (converted <= 300000000) convertedDeduction = 61700000 + (converted - 100000000) * 0.45;
    else convertedDeduction = 151700000 + (converted - 300000000) * 0.35;

    var taxBase = Math.max(0, won1(converted - convertedDeduction));
    var convertedTax = taxByBracket(taxBase);
    var tax = won10(convertedTax / 12 * serviceYears);
    var localTax = won10(tax * 0.1);

    return {
      serviceYears: serviceYears,
      yearsDeduction: yearsDeduction,
      converted: converted,
      convertedDeduction: won1(convertedDeduction),
      taxBase: taxBase,
      convertedTax: won1(convertedTax),
      tax: tax,
      localTax: localTax
    };
  }

  function computeSeverance(input) {
    var start = toDate(input.startDate);
    var end = toDate(input.endDate);
    var monthlyGross = Math.max(0, Number(input.monthlyGross) || 0);
    var bonusAnnual = Math.max(0, Number(input.bonusAnnual) || 0);
    var leaveAnnual = Math.max(0, Number(input.leaveAnnual) || 0);

    if (!start || !end || daysBetween(start, end) < 0) {
      return { valid: false, reason: 'dates' };
    }

    var workDays = daysBetween(start, end) + 1;
    var periodStart = addMonths(end, -3);
    periodStart.setDate(periodStart.getDate() + 1);
    var periodDays = daysBetween(periodStart, end) + 1;

    var wageTotal = monthlyGross * 3 + bonusAnnual * 3 / 12 + leaveAnnual * 3 / 12;
    var dailyAvg = won1(wageTotal / periodDays);
    var severance = won1(dailyAvg * 30 * workDays / 365);
    var eligible = workDays >= 365;
    var t = computeRetirementTax(severance, workDays);

    return {
      valid: true,
      eligible: eligible,
      workDays: workDays,
      periodStart: periodStart,
      periodDays: periodDays,
      wageTotal: wageTotal,
      monthlyGross: monthlyGross,
      dailyAvg: dailyAvg,
      severance: severance,
      serviceYears: t.serviceYears,
      yearsDeduction: t.yearsDeduction,
      converted: t.converted,
      convertedDeduction: t.convertedDeduction,
      retirementTaxBase: t.taxBase,
      convertedTax: t.convertedTax,
      retirementTax: t.tax,
      retirementLocalTax: t.localTax,
      netSeverance: severance - t.tax - t.localTax,
      effectiveTaxRate: severance > 0 ? (t.tax + t.localTax) / severance : 0
    };
  }

  /* ────────────────────────────────────────────────────────────
   * 5. ②-b 남은 연차수당
   *    연차수당 = 통상임금(일급) × 미사용 연차일수
   *    통상임금 일급 = 월 통상임금 ÷ 월 소정근로시간 × 1일 소정근로시간
   * ──────────────────────────────────────────────────────────── */
  function monthlyOrdinaryHours(weeklyHours) {
    var h = Math.max(1, Math.min(Number(weeklyHours) || 40, 60));
    var weeklyPaid = h + h / 5;              // 주휴 포함(주 5일 기준)
    return Math.round(weeklyPaid * 365 / 12 / 7);
  }

  function computeLeavePay(input) {
    var monthlyWage = Math.max(0, Number(input.monthlyOrdinaryWage) || 0);
    var unusedDays = Math.max(0, Math.min(Number(input.unusedDays) || 0, 60));
    var weeklyHours = Math.max(1, Math.min(Number(input.weeklyHours) || 40, 60));
    // 1일 소정근로시간: 주 5일 기준(주 35시간 → 7시간, 주 20시간 → 4시간)
    var dailyHours = Math.max(1, Math.min(weeklyHours / 5, 12));

    var monthHours = monthlyOrdinaryHours(weeklyHours);
    var hourly = monthlyWage > 0 ? Math.floor(monthlyWage / monthHours) : 0;
    var dailyWage = hourly * dailyHours;
    var allowance = won1(dailyWage * unusedDays);

    return {
      monthlyWage: monthlyWage,
      unusedDays: unusedDays,
      weeklyHours: weeklyHours,
      dailyHours: dailyHours,
      monthHours: monthHours,
      hourly: hourly,
      dailyWage: dailyWage,
      allowance: allowance
    };
  }

  /* ────────────────────────────────────────────────────────────
   * 6. ③ 실업급여(구직급여)
   * ──────────────────────────────────────────────────────────── */
  function uiDays(age, insuredMonths, disabled) {
    var senior = disabled || age >= 50;
    if (insuredMonths < 12) return 120;
    if (insuredMonths < 36) return senior ? 180 : 150;
    if (insuredMonths < 60) return senior ? 210 : 180;
    if (insuredMonths < 120) return senior ? 240 : 210;
    return senior ? 270 : 240;
  }

  function computeUnemployment(input) {
    var age = Math.max(15, Math.min(Number(input.age) || 30, 99));
    var years = Math.max(0, Number(input.insuredYears) || 0);
    var months = Math.max(0, Math.min(Number(input.insuredMonths) || 0, 11));
    var insuredMonths = years * 12 + months;
    var disabled = !!input.disabled;

    var hours = Math.max(1, Math.min(Number(input.hours) || 8, 12));
    var dailyAvg = Math.max(0, Number(input.dailyAvgWage) || 0);

    var baseDaily = Math.min(won1(dailyAvg), C.uiMaxDailyBase);
    var raw = baseDaily * 0.6;
    var minDaily = won1(C.minWageHourly * hours * 0.8);
    var maxDaily = C.uiMaxDaily;

    var daily = won10(raw);
    var applied = 'basis';
    if (daily < minDaily) { daily = minDaily; applied = 'min'; }
    else if (daily >= maxDaily) { daily = maxDaily; applied = 'max'; }

    var days = uiDays(age, insuredMonths, disabled);

    return {
      age: age,
      senior: disabled || age >= 50,
      disabled: disabled,
      insuredMonths: insuredMonths,
      insuredYears: years,
      insuredMonthRemainder: months,
      hours: hours,
      dailyAvgWage: dailyAvg,
      baseDaily: baseDaily,
      rawDaily: won1(raw),
      daily: daily,
      minDaily: minDaily,
      maxDaily: maxDaily,
      applied: applied,
      days: days,
      total: daily * days,
      monthly30: daily * 30,
      meetsUnitPeriod: insuredMonths >= 6
    };
  }

  function estimateDailyAverage(monthlyGross, bonusAnnual, endDateStr) {
    var end = toDate(endDateStr) || new Date();
    var periodStart = addMonths(end, -3);
    periodStart.setDate(periodStart.getDate() + 1);
    var periodDays = daysBetween(periodStart, end) + 1;
    var total = monthlyGross * 3 + (bonusAnnual || 0) * 3 / 12;
    return { dailyAvg: won1(total / periodDays), periodDays: periodDays };
  }

  /* ────────────────────────────────────────────────────────────
   * 7. ④ 건강보험 전환 (임의계속가입 vs 지역가입자)
   * ──────────────────────────────────────────────────────────── */
  function healthFromWage(monthlyWage) {
    var wage = Math.max(0, Number(monthlyWage) || 0);
    var health = won10(Math.min(
      Math.max(wage * C.healthRate, C.healthMinPremium * 2),
      C.healthMaxPremium * 2
    ));
    var care = won10(health * C.careRateOfHealth);
    return {
      wage: wage,
      healthFull: health,
      careFull: care,
      totalFull: health + care,
      employeeShare: won10(health / 2) + won10(care / 2)
    };
  }

  function computeVoluntary(avgMonthlyWage) {
    var full = healthFromWage(avgMonthlyWage);
    var relievedHealth = won10(full.healthFull * (1 - C.voluntaryReliefRate));
    var relievedCare = won10(relievedHealth * C.careRateOfHealth);
    return {
      avgMonthlyWage: full.wage,
      healthFull: full.healthFull,
      careFull: full.careFull,
      totalFull: full.totalFull,
      relievedHealth: relievedHealth,
      relievedCare: relievedCare,
      payable: relievedHealth + relievedCare,
      reliefAmount: full.totalFull - (relievedHealth + relievedCare),
      months: C.voluntaryMaxMonths
    };
  }

  function computeLocalHealth(input) {
    var annualIncome = Math.max(0, Number(input.annualIncome) || 0);
    var incomeFactor = input.incomeType === 'earned' ? 0.5 : 1;
    var evaluatedIncome = annualIncome * incomeFactor;
    var incomeMonthly = evaluatedIncome / 12;

    var propertyBase = Math.max(0, Number(input.propertyTaxBase) || 0);
    var deposit = Math.max(0, Number(input.deposit) || 0);
    var rent = Math.max(0, Number(input.monthlyRent) || 0);
    var rentEvaluated = (deposit + rent * 40) * 0.3;
    var propertyTotal = propertyBase + rentEvaluated;
    var propertyAfterDeduction = Math.max(0, propertyTotal - C.propertyDeduction);
    var points = propertyPoints(propertyAfterDeduction);
    var propertyPremium = won10(points * C.propertyPointValue);

    var incomePremium;
    var lowIncome = incomeMonthly <= C.localLowIncomeLine;
    if (lowIncome) incomePremium = C.localMinPremium;
    else incomePremium = won10(incomeMonthly * C.healthRate);

    var healthTotal = Math.min(
      Math.max(won10(incomePremium + propertyPremium), C.localMinPremium),
      C.localMaxPremium
    );
    var care = won10(healthTotal * C.careRateOfHealth);

    return {
      annualIncome: annualIncome,
      incomeFactor: incomeFactor,
      evaluatedIncome: evaluatedIncome,
      incomeMonthly: incomeMonthly,
      lowIncome: lowIncome,
      incomePremium: incomePremium,
      propertyBase: propertyBase,
      rentEvaluated: won1(rentEvaluated),
      propertyTotal: propertyTotal,
      propertyAfterDeduction: propertyAfterDeduction,
      points: points,
      propertyPremium: propertyPremium,
      healthTotal: healthTotal,
      care: care,
      total: healthTotal + care,
      months: 12
    };
  }

  /* ────────────────────────────────────────────────────────────
   * 8. 화면 연결
   * ──────────────────────────────────────────────────────────── */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  function fmt(n) {
    if (!isFinite(n)) return '-';
    return Math.round(n).toLocaleString('ko-KR');
  }
  function won(n) { return fmt(n) + '원'; }
  function setText(sel, value) {
    var el = $(sel);
    if (el) el.textContent = value;
  }
  function bindMoneyInput(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^\d]/g, '');
      input.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    });
  }
  function readMoney(input) {
    if (!input) return 0;
    var raw = String(input.value).replace(/[^\d]/g, '');
    return raw ? Number(raw) : 0;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function koreanDate(str) {
    var d = toDate(str);
    if (!d) return '';
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  function todayStr() {
    var t = new Date();
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }

  /* ── 탭 ── */
  var tabs = $$('.tab');
  var panels = $$('.panel');
  function activateTab(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    panels.forEach(function (p) {
      var on = p.getAttribute('data-panel') === name;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activateTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(t);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        activateTab(next.getAttribute('data-tab'));
      }
    });
  });

  /* ── ① 실수령액 ── */
  var salaryState = { mode: 'yearly' };
  var annualInput = $('#salary-amount');

  function renderSalary() {
    var amount = readMoney(annualInput);
    var annual = salaryState.mode === 'yearly' ? amount : amount * 12;

    setText('#salary-amount-hint', amount
      ? (salaryState.mode === 'yearly'
        ? '월 ' + won(annual / 12) + ' 기준으로 계산합니다'
        : '연 ' + won(annual) + ' 기준으로 계산합니다')
      : '급여를 입력하면 바로 계산됩니다');

    var r = computeSalary({
      annual: annual,
      meal: readMoney($('#salary-meal')),
      dependents: Number($('#salary-dependents').value),
      children: Number($('#salary-children').value)
    });

    setText('#res-net-monthly', won(r.netMonthly));
    setText('#res-net-annual', '연 ' + won(r.netAnnual));
    setText('#res-deduction-total', won(r.totalDeduction));
    setText('#res-deduction-rate', (r.deductionRate * 100).toFixed(1) + '%');
    setText('#res-tax', won(r.incomeTaxMonthly + r.localTaxMonthly));
    setText('#res-insurance', won(r.insuranceMonthly));
    setText('#res-gross-monthly', won(r.monthlyGross));

    setText('#d-pension', won(r.pension));
    setText('#d-health', won(r.health));
    setText('#d-care', won(r.care));
    setText('#d-employ', won(r.employ));
    setText('#d-income-tax', won(r.incomeTaxMonthly));
    setText('#d-local-tax', won(r.localTaxMonthly));
    setText('#d-total', won(r.totalDeduction));

    setText('#t-taxable-annual', won(r.taxableAnnual));
    setText('#t-labor-deduction', '− ' + won(r.laborDeduction));
    setText('#t-personal', '− ' + won(r.personalDeduction));
    setText('#t-pension-deduction', '− ' + won(r.pensionDeduction));
    setText('#t-insurance-deduction', '− ' + won(r.otherInsuranceDeduction));
    setText('#t-base', won(r.taxBase));
    setText('#t-band', '과세표준 구간 ' + (r.marginalRate * 100).toFixed(0) + '%');
    setText('#t-calc-tax', won(r.calculatedTax));
    setText('#t-wage-credit', '− ' + won(r.wageCredit));
    setText('#t-child-credit', '− ' + won(r.childCredit));
    setText('#t-income-tax', won(r.incomeTaxAnnual));
    setText('#t-local-tax', won(r.localTaxAnnual));
    setText('#t-monthly-tax', won(r.incomeTaxMonthly + r.localTaxMonthly));

    return r;
  }

  if (annualInput) {
    bindMoneyInput(annualInput);
    annualInput.addEventListener('input', function () { renderSalary(); renderSummary(); });
    if (!annualInput.value) annualInput.value = '60,000,000';
  }
  $$('.seg-btn[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      salaryState.mode = btn.getAttribute('data-mode');
      $$('.seg-btn[data-mode]').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      setText('#salary-amount-label', salaryState.mode === 'yearly' ? '연봉 (세전)' : '월급 (세전)');
      $$('.chip[data-amount]').forEach(function (chip) {
        var v = Number(chip.getAttribute('data-amount'));
        chip.textContent = salaryState.mode === 'yearly'
          ? fmt(v / 10000) + '만'
          : fmt(v / 12 / 10000) + '만';
      });
      syncChips();
      renderSalary();
      renderSummary();
    });
  });
  $$('.chip[data-amount]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var v = Number(chip.getAttribute('data-amount'));
      annualInput.value = (salaryState.mode === 'yearly' ? v : Math.round(v / 12))
        .toLocaleString('ko-KR');
      syncChips();
      renderSalary();
      renderSummary();
    });
  });
  function syncChips() {
    var current = readMoney(annualInput);
    $$('.chip[data-amount]').forEach(function (chip) {
      var v = Number(chip.getAttribute('data-amount'));
      var shown = salaryState.mode === 'yearly' ? v : Math.round(v / 12);
      chip.classList.toggle('is-on', Math.abs(shown - current) < 1);
    });
  }
  ['#salary-meal', '#salary-dependents', '#salary-children'].forEach(function (sel) {
    var el = $(sel);
    if (!el) return;
    if (el.type !== 'select-one') bindMoneyInput(el);
    el.addEventListener('input', function () { renderSalary(); renderSummary(); });
    el.addEventListener('change', function () { renderSalary(); renderSummary(); });
  });
  var mealBtn = $('#fill-meal');
  if (mealBtn) {
    mealBtn.addEventListener('click', function () {
      $('#salary-meal').value = '200,000';
      renderSalary();
      renderSummary();
    });
  }

  /* ── ② 퇴사 정산 ── */
  var leaveStart = $('#leave-start');
  var leaveEnd = $('#leave-end');
  var lastSeverance = null;

  function renderLeave() {
    var r = computeSeverance({
      startDate: leaveStart.value,
      endDate: leaveEnd.value,
      monthlyGross: readMoney($('#leave-salary')),
      bonusAnnual: readMoney($('#leave-bonus')),
      leaveAnnual: readMoney($('#leave-annual-leave'))
    });

    var warn = $('#leave-warning');
    setText('#leave-end-hint', koreanDate(leaveEnd.value));
    var pay = computeLeavePay({
      monthlyOrdinaryWage: readMoney($('#leave-ordinary-wage')) || readMoney($('#leave-salary')),
      unusedDays: Number($('#leave-unused-days').value) || 0,
      weeklyHours: Number($('#leave-weekly-hours').value) || 40,
      dailyHours: 8
    });

    setText('#res-annual-leave-pay', won(pay.allowance));
    setText('#res-annual-leave-daily', won(pay.dailyWage));
    setText('#res-annual-leave-hours', pay.monthHours + '시간 · 시급 ' + won(pay.hourly));

    if (!r.valid) {
      if (warn) {
        warn.hidden = false;
        warn.textContent = '입사일과 퇴사일을 확인해 주세요. 퇴사일이 입사일보다 빠를 수 없습니다.';
      }
      lastSeverance = null;
      setText('#res-package-total', won(pay.allowance));
      setText('#res-package-gross', won(pay.allowance));
      return;
    }

    if (warn) {
      if (!r.eligible) {
        warn.hidden = false;
        warn.textContent = '법정 퇴직금은 계속 근로기간이 1년 이상일 때 발생합니다. 현재 재직일수는 '
          + fmt(r.workDays) + '일입니다.';
      } else {
        warn.hidden = true;
      }
    }

    lastSeverance = r;
    setText('#res-leave-total', won(r.severance));
    setText('#res-leave-net', won(r.netSeverance));
    setText('#res-leave-tax', won(r.retirementTax + r.retirementLocalTax));
    setText('#res-leave-daily', won(r.dailyAvg));
    setText('#res-leave-days', fmt(r.workDays) + '일');
    setText('#res-leave-years', r.serviceYears + '년');
    setText('#res-leave-wage-total', won(r.wageTotal) + ' · ' + r.periodDays + '일');
    setText('#res-leave-rate', (r.effectiveTaxRate * 100).toFixed(2) + '%');
    setText('#t-years-deduction', '− ' + won(r.yearsDeduction));
    setText('#t-converted', won(r.converted));
    setText('#t-converted-deduction', '− ' + won(r.convertedDeduction));
    setText('#t-leave-base', won(r.retirementTaxBase));
    setText('#t-converted-tax', won(r.convertedTax));
    setText('#t-retirement-tax', won(r.retirementTax));
    setText('#t-retirement-local', won(r.retirementLocalTax));
    setText('#leave-period-note', '평균임금 산정기간 ' + r.periodStart.getFullYear() + '.'
      + (r.periodStart.getMonth() + 1) + '.' + r.periodStart.getDate() + ' ~ 퇴사일 ('
      + r.periodDays + '일)');

    var packageNet = r.netSeverance + pay.allowance;
    setText('#res-package-total', won(packageNet));
    setText('#res-package-gross', '세전 ' + won(r.severance + pay.allowance));
  }

  ['#leave-start', '#leave-end', '#leave-salary', '#leave-bonus', '#leave-annual-leave',
    '#leave-ordinary-wage', '#leave-unused-days', '#leave-weekly-hours'].forEach(function (sel) {
    var el = $(sel);
    if (!el) return;
    if (el.type !== 'date' && el.tagName !== 'SELECT') bindMoneyInput(el);
    el.addEventListener('input', function () { renderLeave(); renderSummary(); });
    el.addEventListener('change', function () { renderLeave(); renderSummary(); });
  });
  if (leaveStart && !leaveStart.value) leaveStart.value = '2023-01-01';
  if (leaveEnd && !leaveEnd.value) leaveEnd.value = todayStr();
  if ($('#leave-unused-days') && !$('#leave-unused-days').value) $('#leave-unused-days').value = '5';

  /* ── ③ 실업급여 ── */
  var uiMode = 'monthly';
  function setUIMode(mode) {
    uiMode = mode;
    $$('.seg-btn[data-uimode]').forEach(function (b) {
      var on = b.getAttribute('data-uimode') === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var mBox = $('#ui-monthly-box');
    var dBox = $('#ui-daily-box');
    if (mBox) mBox.hidden = mode !== 'monthly';
    if (dBox) dBox.hidden = mode !== 'daily';
  }
  $$('.seg-btn[data-uimode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setUIMode(btn.getAttribute('data-uimode'));
      renderUnemployment();
      renderSummary();
    });
  });

  function renderUnemployment() {
    var dailyAvg = 0;
    if (uiMode === 'daily') {
      dailyAvg = readMoney($('#ui-daily'));
      setText('#ui-end-hint', koreanDate($('#ui-end').value));
    } else {
      var est = estimateDailyAverage(
        readMoney($('#ui-salary')),
        readMoney($('#ui-bonus')),
        $('#ui-end') ? $('#ui-end').value : null
      );
      dailyAvg = est.dailyAvg;
      setText('#ui-end-hint', koreanDate($('#ui-end').value)
        + (dailyAvg ? ' · 1일 평균임금 약 ' + won(dailyAvg) + ' (' + est.periodDays + '일 기준)' : ''));
    }

    var r = computeUnemployment({
      age: Number($('#ui-age').value),
      insuredYears: Number($('#ui-years').value),
      insuredMonths: Number($('#ui-months').value),
      disabled: $('#ui-disabled').checked,
      hours: Number($('#ui-hours').value),
      dailyAvgWage: dailyAvg
    });

    setText('#res-ui-days', r.days + '일');
    setText('#res-ui-daily', won(r.daily));
    setText('#res-ui-total', won(r.total));
    setText('#res-ui-monthly', won(r.monthly30));
    setText('#res-ui-raw', won(r.rawDaily));
    setText('#res-ui-min', won(r.minDaily));
    setText('#res-ui-max', won(r.maxDaily));
    setText('#res-ui-base', won(r.baseDaily));
    setText('#res-ui-raw2', won(r.rawDaily));
    setText('#res-ui-min2', won(r.minDaily));
    setText('#res-ui-max2', won(r.maxDaily));
    setText('#res-ui-daily2', won(r.daily));

    var badge = $('#ui-badge');
    if (badge) {
      if (r.applied === 'max') { badge.hidden = false; badge.textContent = '상한액 적용'; badge.className = 'badge badge--max'; }
      else if (r.applied === 'min') { badge.hidden = false; badge.textContent = '하한액 적용'; badge.className = 'badge badge--min'; }
      else { badge.hidden = false; badge.textContent = '평균임금의 60%'; badge.className = 'badge'; }
    }

    var note = $('#ui-note');
    if (note) {
      if (!r.meetsUnitPeriod) {
        note.hidden = false;
        note.textContent = '고용보험 가입기간이 6개월 미만이면 이직 전 18개월 중 피보험단위기간 180일을 채우지 못해 수급이 어려울 수 있습니다.';
      } else {
        note.hidden = true;
      }
    }

    var table = $('#ui-days-table');
    if (table) {
      $$('td', table).forEach(function (cell) { cell.classList.remove('is-on'); });
      var col = r.senior ? 2 : 1;
      $$('tr[data-row]', table).forEach(function (row) {
        if (Number(row.getAttribute('data-row')) === r.days && row.children[col]) {
          row.children[col].classList.add('is-on');
        }
      });
    }
    return r;
  }

  ['#ui-age', '#ui-years', '#ui-months', '#ui-hours', '#ui-end'].forEach(function (sel) {
    var el = $(sel);
    if (el) {
      el.addEventListener('input', function () { renderUnemployment(); renderSummary(); });
      el.addEventListener('change', function () { renderUnemployment(); renderSummary(); });
    }
  });
  ['#ui-salary', '#ui-bonus', '#ui-daily'].forEach(function (sel) {
    var el = $(sel);
    if (el) {
      bindMoneyInput(el);
      el.addEventListener('input', function () { renderUnemployment(); renderSummary(); });
    }
  });
  if ($('#ui-disabled')) {
    $('#ui-disabled').addEventListener('change', function () { renderUnemployment(); renderSummary(); });
  }
  if ($('#ui-end') && !$('#ui-end').value) $('#ui-end').value = todayStr();

  /* ── ④ 건강보험 전환 ── */
  function renderHealth() {
    var wage = readMoney($('#h-avg-wage'));
    var voluntary = computeVoluntary(wage);
    var local = computeLocalHealth({
      annualIncome: readMoney($('#h-income')),
      incomeType: $('#h-income-type').value,
      propertyTaxBase: readMoney($('#h-property')),
      deposit: readMoney($('#h-deposit')),
      monthlyRent: readMoney($('#h-rent'))
    });
    var employeeShare = healthFromWage(wage).employeeShare;

    setText('#res-h-cont', won(employeeShare));
    setText('#res-h-voluntary', won(voluntary.payable));
    setText('#res-h-voluntary-full', '경감 전 ' + won(voluntary.totalFull) + ' → 50% 경감');
    setText('#res-h-local', won(local.total));
    setText('#res-h-local-total', won(local.total));
    setText('#res-h-voluntary2', won(voluntary.payable));
    setText('#res-h-local-income', won(local.incomePremium));
    setText('#res-h-local-property', won(local.propertyPremium));
    setText('#res-h-local-points', fmt(local.points) + '점');
    setText('#res-h-local-ltc', won(local.care));
    setText('#res-h-local-base', local.lowIncome
      ? '소득월액 ' + won(local.incomeMonthly) + ' → 최저보험료 적용'
      : '소득월액 ' + won(local.incomeMonthly) + ' × 7.19%');

    var diff = local.total - voluntary.payable;
    setText('#res-h-diff', (diff >= 0 ? '+' : '−') + won(Math.abs(diff)));
    setText('#res-h-diff36', (diff >= 0 ? '＋' : '−') + won(Math.abs(diff) * C.voluntaryMaxMonths));
    setText('#res-h-increase', won(local.total - employeeShare));

    var rec = $('#h-recommend');
    if (rec) {
      if (!wage) {
        rec.textContent = '퇴직 전 월 보수를 입력하면 두 제도를 비교해 드립니다.';
        rec.className = 'reco';
      } else if (diff > 0) {
        rec.innerHTML = '<strong>임의계속가입이 월 ' + won(diff) + ' 유리</strong>합니다. '
          + '36개월이면 약 ' + won(diff * 36) + ' 차이입니다. 자격(퇴직 전 18개월 중 직장가입 365일 이상)과 '
          + '신청 기한(최초 지역보험료 납부기한 +2개월)을 확인하세요.';
        rec.className = 'reco reco--good';
      } else if (diff < 0) {
        rec.innerHTML = '<strong>지역가입자가 월 ' + won(-diff) + ' 유리</strong>합니다. '
          + '임의계속가입을 신청하지 않으면 자동으로 지역가입자가 됩니다.';
        rec.className = 'reco reco--warn';
      } else {
        rec.textContent = '두 제도의 월 보험료가 같습니다. 피부양자 등재 가능 여부를 먼저 확인해 보세요.';
        rec.className = 'reco';
      }
    }
    setText('#h-unit-note', '재산 ' + (local.propertyTotal > 0
      ? won(local.propertyTotal) + ' − 기본공제 1억원 = ' + won(local.propertyAfterDeduction)
      : '0원 (기본공제 1억원 이하)'));
    return { voluntary: voluntary, local: local, employeeShare: employeeShare, diff: diff };
  }

  ['#h-avg-wage', '#h-income', '#h-property', '#h-deposit', '#h-rent'].forEach(function (sel) {
    var el = $(sel);
    if (el) {
      bindMoneyInput(el);
      el.addEventListener('input', function () { renderHealth(); renderSummary(); });
    }
  });
  if ($('#h-income-type')) {
    $('#h-income-type').addEventListener('change', function () { renderHealth(); renderSummary(); });
  }

  /* ── 퇴사 원스톱 요약 ── */
  function renderSummary() {
    var sev = lastSeverance && lastSeverance.valid ? lastSeverance : null;
    var pay = computeLeavePay({
      monthlyOrdinaryWage: readMoney($('#leave-ordinary-wage')) || readMoney($('#leave-salary')),
      unusedDays: Number($('#leave-unused-days').value) || 0,
      weeklyHours: Number($('#leave-weekly-hours').value) || 40,
      dailyHours: 8
    });
    var ui = computeUnemployment({
      age: Number($('#ui-age').value),
      insuredYears: Number($('#ui-years').value),
      insuredMonths: Number($('#ui-months').value),
      disabled: $('#ui-disabled').checked,
      hours: Number($('#ui-hours').value),
      dailyAvgWage: uiMode === 'daily'
        ? readMoney($('#ui-daily'))
        : estimateDailyAverage(readMoney($('#ui-salary')), readMoney($('#ui-bonus')),
          $('#ui-end') ? $('#ui-end').value : null).dailyAvg
    });
    var h = renderHealth();

    setText('#sum-severance', sev ? won(sev.netSeverance) : '—');
    setText('#sum-leave-pay', won(pay.allowance));
    setText('#sum-package', won((sev ? sev.netSeverance : 0) + pay.allowance));
    setText('#sum-ui', won(ui.total));
    setText('#sum-ui-days', ui.days + '일 · 1일 ' + won(ui.daily));
    setText('#sum-health-local', won(h.local.total));
    setText('#sum-health-voluntary', won(h.voluntary.payable));
    setText('#sum-health-inside', won(h.employeeShare));
    setText('#sum-cash', won((sev ? sev.netSeverance : 0) + pay.allowance + ui.total));
  }

  var copyBtn = $('#copy-to-ui');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (lastSeverance && lastSeverance.valid) {
        if ($('#ui-daily')) $('#ui-daily').value = lastSeverance.dailyAvg.toLocaleString('ko-KR');
        if ($('#ui-salary')) $('#ui-salary').value = lastSeverance.monthlyGross.toLocaleString('ko-KR');
        if ($('#ui-bonus')) $('#ui-bonus').value = (readMoney($('#leave-bonus'))).toLocaleString('ko-KR');
      }
      if ($('#h-avg-wage')) $('#h-avg-wage').value = (readMoney($('#leave-salary'))).toLocaleString('ko-KR');
      if ($('#ui-end') && leaveEnd) $('#ui-end').value = leaveEnd.value;
      renderUnemployment();
      renderHealth();
      renderSummary();
      activateTab('ui');
      var panel = $('#panel-ui');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ── 공유하기 (결과 카드마다) ─────────────────── */
  var SHARE_TITLES = {
    salary: '월 실수령액 — 2026 퇴사 원스톱 계산기',
    leave: '퇴직금 — 2026 퇴사 원스톱 계산기',
    ui: '실업급여 — 2026 퇴사 원스톱 계산기',
    health: '퇴직 후 건강보험 — 2026 퇴사 원스톱 계산기',
    summary: '퇴사하면 받는 돈 — 2026 퇴사 원스톱 계산기'
  };

  function cardLabel(card) {
    var labelEl = card.querySelector('.result-label');
    if (!labelEl) return '';
    var clone = labelEl.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('.badge'), function (b) {
      if (b.parentNode) b.parentNode.removeChild(b);
    });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function sharePayload(btn) {
    var key = btn.getAttribute('data-share') || '';
    var card = btn.closest('.result-card, .summary-card');
    var label = '', main = '', sub = '';

    if (card) {
      label = cardLabel(card);
      var mainEl = card.querySelector('.result-main');
      var subEl = card.querySelector('.result-sub');
      main = mainEl ? mainEl.textContent.replace(/\s+/g, ' ').trim() : '';
      sub = subEl ? subEl.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    if (key === 'summary') {
      var total = $('#sum-cash');
      label = '퇴사하면 받는 돈(퇴직금+연차수당+실업급여, 세후)';
      main = total ? total.textContent.trim() : '';
      sub = '';
    }

    var lines = [(label ? label + ' ' : '') + main];
    if (sub) lines.push('· ' + sub);
    lines.push('너도 계산해 봐!');

    var base = location.href.split('#')[0];
    var url = (key && key !== 'summary') ? base + '#' + key : base;

    return {
      title: SHARE_TITLES[key] || document.title,
      text: lines.join('\n'),
      url: url
    };
  }

  if (window.LCShare) {
    LCShare.bindAll('[data-share]', sharePayload);
  }

  /* ── 초기화 ── */
  if (!$('#ui-salary').value) $('#ui-salary').value = '5,000,000';
  if (!$('#leave-salary').value) $('#leave-salary').value = '5,000,000';
  if (!$('#leave-ordinary-wage').value) $('#leave-ordinary-wage').value = '5,000,000';
  if (!$('#h-avg-wage').value) $('#h-avg-wage').value = '5,000,000';
  if (!$('#h-income').value) $('#h-income').value = '0';
  if (!$('#h-property').value) $('#h-property').value = '0';
  if (!$('#ui-age').value) $('#ui-age').value = '35';

  setUIMode('monthly');
  renderSalary();
  renderLeave();
  renderUnemployment();
  renderHealth();
  renderSummary();

  if (location.hash) {
    var name = location.hash.replace('#', '');
    if (['salary', 'leave', 'ui', 'health'].indexOf(name) >= 0) activateTab(name);
  }

  /* ── 테스트용 노출 ── */
  window.WolgeupNote = {
    C: C,
    computeSalary: computeSalary,
    computeSeverance: computeSeverance,
    computeRetirementTax: computeRetirementTax,
    computeLeavePay: computeLeavePay,
    monthlyOrdinaryHours: monthlyOrdinaryHours,
    computeUnemployment: computeUnemployment,
    computeVoluntary: computeVoluntary,
    computeLocalHealth: computeLocalHealth,
    propertyPoints: propertyPoints,
    estimateDailyAverage: estimateDailyAverage,
    taxByBracket: taxByBracket,
    laborIncomeDeduction: laborIncomeDeduction
  };
})();
