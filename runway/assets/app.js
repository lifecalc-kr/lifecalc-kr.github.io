/* 런웨이노트 — 화면 배선 + 잔고 그래프 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  var savingsIn = $('savings');
  var costIns = ['costHouse', 'costFood', 'costFix', 'costEtc'].map(function (id) { return $(id); });
  var uiOn = $('uiOn'), uiBox = $('uiBox');
  var uiWage = $('uiWage'), uiAge = $('uiAge'), uiYears = $('uiYears');
  var uiDaily = $('uiDaily'), uiDays = $('uiDays');

  [savingsIn, uiWage].concat(costIns).forEach(function (el) { LC.bindMoney(el); });
  LC.bindMoney(uiDaily);
  LC.bindChips($('savingsChips'), function (v) { LC.setMoney(savingsIn, Number(v)); render(); });

  var manualUI = false;

  function readInput() {
    return {
      savings: LC.money(savingsIn),
      costHouse: LC.money(costIns[0]),
      costFood: LC.money(costIns[1]),
      costFix: LC.money(costIns[2]),
      costEtc: LC.money(costIns[3]),
      uiOn: uiOn.checked,
      uiDaily: LC.money(uiDaily),
      uiDays: parseInt(uiDays.value, 10) || 0
    };
  }

  function syncUI() {
    var auto = RunwayCore.autoUI({
      wage: LC.money(uiWage),
      age: parseInt(uiAge.value, 10) || 35,
      years: parseFloat(uiYears.value) || 0
    });
    LC.setMoney(uiDaily, auto.daily);
    uiDays.value = auto.days;
    manualUI = false;
    var note = auto.applied === 'max'
      ? '상한액 68,100원 적용'
      : (auto.applied === 'min' ? '하한액 ' + LC.won(auto.minDaily) + ' 적용' : '평균임금의 60% 적용');
    var months = Math.round(auto.months * 10) / 10;
    $('uiSum').textContent = '1일 ' + LC.won(auto.daily) + ' × ' + auto.days + '일 = ' + LC.won(auto.total)
      + ' (약 ' + months + '개월치) · ' + note;
    if (!auto.eligible) {
      $('uiSum').textContent += ' · 고용보험 6개월 미만은 수급이 어렵습니다';
    }
  }

  [uiWage, uiAge, uiYears].forEach(function (el) {
    el.addEventListener('input', function () { syncUI(); render(); });
  });
  [uiDaily, uiDays].forEach(function (el) {
    el.addEventListener('input', function () { manualUI = true; render(); });
  });
  savingsIn.addEventListener('input', render);
  costIns.forEach(function (el) { el.addEventListener('input', render); });
  uiOn.addEventListener('change', function () {
    LC.show(uiBox, uiOn.checked);
    render();
  });

  function monthsText(m) {
    if (m <= 0) return '0';
    if (m >= 100) return String(Math.round(m));
    return (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, '');
  }

  var last = null;

  function render() {
    var input = readInput();
    var r = RunwayCore.compute(input);
    last = { r: r, input: input };

    var sum = r.cost;
    $('costSum').textContent = '월 고정비 합계 ' + LC.won(sum) + ' · 하루 약 ' + LC.won(sum / 30.4375);

    LC.text('runwayMonths', monthsText(r.months));
    LC.text('runwaySub', r.cost > 0
      ? '잔고가 0이 되는 날 ' + RunwayCore.formatDate(r.end) + ' · 하루 ' + LC.won(r.cost / 30.4375) + '씩'
      : '월 고정비를 입력해 주세요.');

    var badge = $('runwayBadge');
    if (r.cost <= 0) {
      badge.className = 'res-badge';
      badge.textContent = '—';
    } else if (r.months >= 6) {
      badge.className = 'res-badge ok';
      badge.textContent = '6개월 마지노선 통과 (+' + monthsText(r.months - 6) + '개월)';
    } else {
      badge.className = 'res-badge warn';
      badge.textContent = '6개월에 ' + monthsText(6 - r.months) + '개월 부족';
    }

    var quote = $('runwayQuote');
    var msg;
    if (r.cost <= 0) {
      msg = '저축과 월 고정비를 입력하면 버틸 수 있는 기간이 나옵니다.';
    } else if (r.uiOn && r.uiTotal > 0) {
      if (r.uiMonths >= r.months) {
        msg = '실업급여가 끝나기 전에 잔고가 바닥납니다. ' + monthsText(r.months) + '개월 시점부터는 수입이 없는 상태입니다.';
      } else {
        msg = '실업급여 ' + LC.won(r.uiTotal) + '(' + monthsText(r.uiMonths) + '개월치)가 버팀의 절반을 맡습니다. ' + monthsText(r.uiMonths) + '개월 뒤부터는 저축만으로 버텨야 합니다.';
      }
    } else {
      msg = '실업급여를 포함하면 ' + monthsText(r.months + (r.cost > 0 ? r.uiTotal / r.cost : 0)) + '개월까지 늘어납니다. 비자발적 퇴사라면 꼭 확인하세요.';
    }
    quote.textContent = msg;
    quote.className = 'res-quote' + (r.months < 6 && r.cost > 0 ? ' warn' : '');

    LC.text('rFunds', LC.won(r.funds));
    LC.text('rCost', LC.won(r.cost) + ' /월');
    $('rUI').innerHTML = r.uiOn
      ? LC.won(r.uiTotal) + ' <small>' + r.uiDays + '일</small>'
      : '<small>제외</small>';
    LC.text('rEnd', RunwayCore.formatDate(r.end));
    $('rNoUI').innerHTML = monthsText(r.noUI) + '개월 <small>' + RunwayCore.formatDate(r.noUIEnd) + '</small>';
    LC.text('rCut', r.cutMonths > 0 ? monthsText(r.cutMonths) + '개월' : '—');
    $('rLine').innerHTML = r.months >= 6
      ? '<span style="color:var(--green)">통과</span> <small>+' + monthsText(r.months - 6) + '개월 여유</small>'
      : '<span style="color:var(--warn)">미달</span> <small>' + monthsText(6 - r.months) + '개월 부족</small>';

    drawChart(r);
    renderCutTable(input);
  }

  function renderCutTable(input) {
    var rows = RunwayCore.cutTable(input);
    var html = '';
    rows.forEach(function (row, i) {
      html += '<tr' + (i === 0 ? ' class="on"' : '') + '>'
        + '<th scope="row">' + (i === 0 ? '현재 ' + LC.won(row.cost) : LC.won(row.cost)) + '</th>'
        + '<td>' + (row.cut === 0 ? '—' : '−' + LC.won(row.cut)) + '</td>'
        + '<td><b>' + monthsText(row.months) + '개월</b></td>'
        + '<td>' + (row.cut === 0 ? '—' : '+' + Math.round(row.gainDays) + '일') + '</td>'
        + '</tr>';
    });
    $('cutBody').innerHTML = html;
  }

  /* ── 잔고 그래프 ─────────────────────────────── */
  function drawChart(r) {
    var box = $('chart');
    var W = Math.max(280, box.clientWidth || 640);
    var H = W < 480 ? 208 : 244;
    var pad = { l: 46, r: 12, t: 16, b: 26 };
    var xMax = Math.max(12, Math.ceil(Math.max(r.months, r.noUI)) + 2);
    var yMax = Math.max(r.funds, r.savings, 1);
    var plotW = W - pad.l - pad.r;
    var plotH = H - pad.t - pad.b;

    function X(m) { return pad.l + (Math.min(m, xMax) / xMax) * plotW; }
    function Y(v) { return pad.t + (1 - v / yMax) * plotH; }

    function labelWon(v) {
      if (v >= 100000000) return (Math.round(v / 10000000) / 10) + '억';
      if (v >= 10000) return Math.round(v / 10000).toLocaleString('ko-KR') + '만';
      return String(Math.round(v));
    }

    var s = [];
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="월별 잔고 감소 그래프">');

    /* y 그리드 */
    [0, yMax / 2, yMax].forEach(function (v) {
      var y = Y(v);
      s.push('<line class="' + (v === 0 ? 'zero' : 'grid-line') + '" x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + y.toFixed(1) + '"/>');
      s.push('<text x="' + (pad.l - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + labelWon(v) + '</text>');
    });

    /* x 그리드 */
    var step = xMax <= 12 ? 2 : (xMax <= 24 ? 3 : (xMax <= 48 ? 6 : 12));
    for (var m = 0; m <= xMax; m += step) {
      var x = X(m);
      s.push('<line class="grid-line" x1="' + x.toFixed(1) + '" y1="' + pad.t + '" x2="' + x.toFixed(1) + '" y2="' + (H - pad.b) + '"/>');
      s.push('<text x="' + x.toFixed(1) + '" y="' + (H - pad.b + 15) + '" text-anchor="middle">' + (m === 0 ? '0' : m + '개월') + '</text>');
    }

    /* 실업급여 포함 영역 */
    if (r.months > 0) {
      var x0 = X(0), x1 = X(r.months), y0 = Y(r.funds), yb = Y(0);
      s.push('<polygon class="area" points="' + x0.toFixed(1) + ',' + y0.toFixed(1) + ' ' + x1.toFixed(1) + ',' + yb.toFixed(1) + ' ' + x0.toFixed(1) + ',' + yb.toFixed(1) + '"/>');
      s.push('<polyline class="line" points="' + x0.toFixed(1) + ',' + y0.toFixed(1) + ' ' + x1.toFixed(1) + ',' + yb.toFixed(1) + '"/>');
      s.push('<circle class="dot" cx="' + x1.toFixed(1) + '" cy="' + yb.toFixed(1) + '" r="4"/>');
      s.push('<text x="' + (x1 - 6).toFixed(1) + '" y="' + (yb - 10).toFixed(1) + '" text-anchor="end" style="fill:var(--accent);font-weight:800">' + monthsText(r.months) + '개월</text>');
    }

    /* 실업급여 없이 */
    if (r.noUI > 0) {
      s.push('<polyline class="line-2" points="' + X(0).toFixed(1) + ',' + Y(r.savings).toFixed(1) + ' ' + X(r.noUI).toFixed(1) + ',' + Y(0).toFixed(1) + '"/>');
    }

    /* 6개월 마지노선 */
    if (6 <= xMax) {
      s.push('<line class="marker" x1="' + X(6).toFixed(1) + '" y1="' + pad.t + '" x2="' + X(6).toFixed(1) + '" y2="' + (H - pad.b) + '"/>');
      s.push('<text x="' + (X(6) + 4).toFixed(1) + '" y="' + (H - pad.b - 7) + '" style="fill:var(--warm)">마지노선 6개월</text>');
    }

    /* 실업급여 종료 (6개월 선과 가까우면 라벨을 위로 올림) */
    if (r.uiOn && r.uiMonths > 0 && r.uiMonths < xMax) {
      var uiX = X(r.uiMonths);
      s.push('<line class="marker" x1="' + uiX.toFixed(1) + '" y1="' + pad.t + '" x2="' + uiX.toFixed(1) + '" y2="' + (H - pad.b) + '" style="stroke:var(--accent-2);opacity:.5"/>');
      var anchor = uiX > W - 110 ? 'end' : 'start';
      var tx = uiX + (anchor === 'end' ? -5 : 5);
      s.push('<text x="' + tx.toFixed(1) + '" y="' + (pad.t + 10) + '" text-anchor="' + anchor + '" style="fill:var(--accent-2)">실업급여 종료</text>');
    }

    s.push('</svg>');
    box.innerHTML = s.join('');
    $('chartLegend').innerHTML = '<span>잔고 0: <b>' + RunwayCore.formatDate(r.end) + '</b></span>'
      + '<span>·</span><span>총 ' + LC.won(r.funds) + ' ÷ 월 ' + LC.won(r.cost) + '</span>';
  }

  /* ── 공유 ─────────────────────────────────────── */
  var lastSummary = null;
  function summary() {
    if (!last) return '';
    var r = last.r;
    return [
      '퇴사하면 ' + monthsText(r.months) + '개월 버틸 수 있습니다.',
      '· 총 가용 자금 ' + LC.won(r.funds) + ' ÷ 월 고정비 ' + LC.won(r.cost),
      '· 잔고 소진 예상일 ' + RunwayCore.formatDate(r.end),
      '· 실업급여 없이는 ' + monthsText(r.noUI) + '개월',
      '당신도 계산해 보세요 → ' + LC.shareUrl({ s: r.savings, c: r.cost })
    ].join('\n');
  }

  LC.onCopy($('copyBtn'), summary, '생존 기간을 복사했어요. 퇴사 고민 친구에게 보내 보세요.');
  LC.onShare($('shareBtn'), function () {
    var r = last ? last.r : null;
    if (!r) return { title: '퇴사 생존 개월수 계산기', text: '퇴사하면 몇 개월 버틸 수 있을까?', url: location.href };
    return {
      title: '퇴사 생존 개월수 계산기',
      text: '퇴사하면 ' + monthsText(r.months) + '개월 버틸 수 있습니다.\n잔고 소진 예상일 ' + RunwayCore.formatDate(r.end),
      url: LC.shareUrl({ s: r.savings, c: r.cost })
    };
  });

  /* ── URL 파라미터 ─────────────────────────────── */
  if (LC.param('s')) LC.setMoney(savingsIn, Number(LC.param('s')) || 0);
  if (LC.param('c')) {
    var c = Number(LC.param('c')) || 0;
    if (c > 0) {
      var parts = [Math.round(c * 0.5), Math.round(c * 0.32), Math.round(c * 0.06)];
      parts.push(c - parts[0] - parts[1] - parts[2]);
      [0, 1, 2, 3].forEach(function (i) { LC.setMoney(costIns[i], parts[i]); });
    }
  }

  /* ── 시작 ─────────────────────────────────────── */
  syncUI();
  LC.show(uiBox, uiOn.checked);
  render();

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (last) drawChart(last.r); }, 180);
  });
})();
