/* 임펄스노트 — 계산 코어 (DOM 없음)
   일하는 시간 = 가격 ÷ 시급 · 출근 일수 = 시간 ÷ 하루 근무시간 */
(function () {
  'use strict';

  var MIN_WAGE = 10320;

  function compute(input) {
    var price = Math.max(0, Number(input.price) || 0);
    var wage = Math.max(0, Number(input.wage) || 0);
    var hoursPerDay = Math.min(24, Math.max(0.5, Number(input.hoursPerDay) || 8));
    var monthly = Math.max(0, Number(input.monthly) || 0);

    var hours = wage > 0 ? price / wage : 0;
    var totalMinutes = Math.round(hours * 60);
    var h = Math.floor(totalMinutes / 60);
    var m = totalMinutes % 60;
    var days = hoursPerDay > 0 ? hours / hoursPerDay : 0;

    var items = [
      { name: '커피', unit: 4500 },
      { name: '치킨', unit: 25000 },
      { name: '영화 관람', unit: 15000 },
      { name: '편의점 도시락', unit: 4500 }
    ];
    var alt = items
      .map(function (it) { return { name: it.name, count: price / it.unit, unit: it.unit }; })
      .filter(function (it) { return it.count >= 1; })
      .sort(function (a, b) { return a.count - b.count; })
      .slice(0, 2);

    return {
      price: price,
      wage: wage,
      hoursPerDay: hoursPerDay,
      hours: hours,
      h: h,
      m: m,
      minutes: totalMinutes,
      days: days,
      pct: monthly > 0 ? (price / monthly) * 100 : null,
      minHours: price / MIN_WAGE,
      dailyEarning: wage * hoursPerDay,
      alt: alt,
      minWage: MIN_WAGE
    };
  }

  /* 가격대별 표 */
  function table(input, prices) {
    var list = prices || [
      { price: 4500, label: '커피 한 잔' },
      { price: 12000, label: '배달 음식' },
      { price: 29000, label: '티셔츠' },
      { price: 59000, label: '이어폰' },
      { price: 129000, label: '운동화' },
      { price: 1550000, label: '아이폰' }
    ];
    return list.map(function (row) {
      var r = compute({ price: row.price, wage: input.wage, hoursPerDay: input.hoursPerDay, monthly: input.monthly });
      return { price: row.price, label: row.label, h: r.h, m: r.m, minutes: r.minutes, days: r.days };
    });
  }

  /* 시간대별 한마디 */
  function verdict(r) {
    if (r.wage <= 0) return '시급을 입력하면 몇 시간 일해야 하는지 알려드립니다.';
    if (r.price <= 0) return '가격을 입력해 주세요.';
    if (r.hours < 0.5) return '30분도 안 걸립니다. 이 정도면 고민할 필요 없이 그냥 사도 됩니다.';
    if (r.hours < 2) return '한나절도 안 되는 시간입니다. 커피 몇 잔 값이네요.';
    if (r.hours < 8) return '하루 안에 벌 수 있는 금액입니다. 오늘 하루를 이 물건과 바꾸는 셈입니다.';
    if (r.hours < 24) return '출근 ' + (Math.round(r.days * 10) / 10) + '일치입니다. 장바구니에 24시간만 넣어 두고 다시 보세요.';
    if (r.hours < 80) return '일주일 넘게 일해야 합니다. 이 시간이면 다른 선택지도 충분히 많습니다.';
    return '출근 ' + (Math.round(r.days * 10) / 10) + '일. 한 달에 가까운 시간입니다. 정말 필요할 때만 사세요.';
  }

  window.ImpulseCore = { compute: compute, table: table, verdict: verdict, MIN_WAGE: MIN_WAGE };
})();
