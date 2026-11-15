/* 시급노트 — 화면 배선 (계산은 core.js) */
(function () {
  'use strict';

  var mode = 'gross';
  var MIN_WAGE = 10320;

  function $(id) { return document.getElementById(id); }
  var payIn = $('pay'), daysIn = $('days'), hoursIn = $('hours'), otIn = $('overtime');
  var lunchIn = $('lunch'), commuteIn = $('commute'), lunchTgl = $('lunchIn');
  var depIn = $('dependents'), mealIn = $('meal');

  LC.bindMoney(payIn);
  LC.bindMoney(mealIn);

  function setMode(next) {
    mode = next === 'net' ? 'net' : 'gross';
    LC.$$('.seg button[data-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
    });
    $('payHint').textContent = mode === 'gross' ? '세전 금액 · 식대 포함' : '통장에 들어오는 실수령액';
    $('payNote').textContent = mode === 'gross'
      ? '세전으로 넣으면 4대보험·소득세를 빼서, 세후로 넣으면 세전급여를 역산해서 함께 보여줍니다.'
      : '실수령액으로 넣으면 4대보험·소득세를 역산해 세전급여를 함께 보여줍니다.';
  }

  LC.$$('.seg button[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(btn.dataset.mode); render(); });
  });

  LC.bindChips($('payChips'), function (v) { LC.setMoney(payIn, Number(v)); render(); });
  LC.$$('.chip[data-commute]').forEach(function (chip) {
    chip.addEventListener('click', function () { commuteIn.value = chip.dataset.commute; render(); });
  });

  ['days', 'hours', 'overtime', 'lunch', 'commute', 'dependents'].forEach(function (id) {
    $(id).addEventListener('input', render);
  });
  payIn.addEventListener('input', render);
  mealIn.addEventListener('input', render);
  lunchTgl.addEventListener('change', render);

  function readInput() {
    return {
      mode: mode,
      pay: LC.money(payIn),
      days: parseFloat(daysIn.value) || 5,
      hours: parseFloat(hoursIn.value) || 0,
      overtime: parseFloat(otIn.value) || 0,
      lunch: parseFloat(lunchIn.value) || 0,
      lunchBound: lunchTgl.checked,
      commute: parseFloat(commuteIn.value) || 0,
      meal: LC.money(mealIn),
      dependents: parseInt(depIn.value, 10) || 1
    };
  }

  function hhmm(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    if (h && m) return h + '시간 ' + m + '분';
    if (h) return h + '시간';
    return m + '분';
  }

  var last = null;

  function render() {
    var input = readInput();
    var r = WageCore.compute(input);
    last = { r: r, input: input };

    LC.text('realNet', LC.fmt(r.realNet));
    LC.text('realSub', '회사가 인정하는 시급 ' + LC.won(r.contractHourly) + ' · 세전 기준 ' + LC.won(r.realGross));

    var badge = $('vsMin');
    if (r.ratio < 1) {
      badge.className = 'res-badge warn';
      badge.textContent = '2026 최저시급 ' + LC.won(MIN_WAGE) + '보다 ' + LC.won(MIN_WAGE - r.realNet) + ' 낮음';
    } else {
      badge.className = 'res-badge ok';
      badge.textContent = '2026 최저시급의 ' + (Math.round(r.ratio * 100) / 100) + '배 (+' + LC.won(r.realNet - MIN_WAGE) + ')';
    }

    var quote = $('shock');
    var msg;
    if (r.monthHours <= 0 || r.net <= 0) {
      msg = '월급과 근무 조건을 입력하면 진짜 시급이 나옵니다.';
    } else if (r.ratio < 0.75) {
      msg = '법정 최저시급의 ' + Math.round(r.ratio * 100) + '%입니다. 일해서 받는 돈보다 회사를 위해 사라지는 시간이 더 많은 구조라는 뜻입니다.';
    } else if (r.ratio < 1) {
      msg = '최저시급(' + LC.won(MIN_WAGE) + ')보다 ' + LC.won(MIN_WAGE - r.realNet) + ' 낮습니다. 일한 시간이 아니라 "묶여 있던 시간"으로 나눈 결과입니다.';
    } else if (r.ratio < 1.25) {
      msg = '최저시급의 ' + (Math.round(r.ratio * 100) / 100) + '배. 통근 ' + r.state.commute + '분을 빼면 시급이 ' + LC.won(r.noCommuteHourly) + '까지 올라갑니다.';
    } else {
      msg = '최저시급의 ' + (Math.round(r.ratio * 100) / 100) + '배. 숫자는 나쁘지 않지만, 1년에 ' + Math.round(r.yearDays) + '일을 회사를 위해 쓰고 있습니다.';
    }
    quote.textContent = msg;
    quote.className = 'res-quote' + (r.ratio < 1 ? ' warn' : '');

    LC.text('rDay', hhmm(r.dailyMin));
    LC.text('rWeek', hhmm(r.weekMin));
    LC.text('rMonth', Math.round(r.monthHours) + '시간');
    LC.text('rNet', LC.won(r.net) + ' /월');
    LC.text('rGross', LC.won(r.gross) + ' /월');
    LC.text('rTax', LC.won(r.tx.deduction) + ' (' + LC.pct(r.tx.rate * 100) + ')');
    LC.text('rCommute', Math.round(r.commuteMonthHours) + '시간');
    LC.html('rYear', Math.round(r.yearDays) + '일 <small>' + LC.fmt(r.yearHours) + '시간</small>');

    renderScenario(input);
    LC.save('realWage', {
      hourlyNet: Math.round(r.realNet),
      hourlyGross: Math.round(r.realGross),
      monthlyNet: Math.round(r.net),
      monthlyGross: Math.round(r.gross),
      monthlyHours: Math.round(r.monthHours),
      updatedAt: new Date().toISOString()
    });
  }

  function renderScenario(input) {
    var rows = [
      { min: 0, label: '재택 · 0분' },
      { min: 30, label: '30분' },
      { min: 60, label: '1시간' },
      { min: 90, label: '1시간 30분' },
      { min: 120, label: '2시간' },
      { min: 150, label: '2시간 30분' }
    ];
    var html = '';
    rows.forEach(function (row) {
      var res = WageCore.compute(Object.assign({}, input, { commute: row.min }));
      var on = Math.abs(row.min - input.commute) < 1;
      var ratioText = res.ratio < 1
        ? '<span style="color:var(--warn)">0.' + Math.round(res.ratio * 100) + '배</span>'
        : (Math.round(res.ratio * 100) / 100) + '배';
      html += '<tr' + (on ? ' class="on"' : '') + '>'
        + '<th scope="row">' + row.label + (on ? ' <small>(지금)</small>' : '') + '</th>'
        + '<td>' + hhmm(res.dailyMin) + '</td>'
        + '<td>' + Math.round(res.monthHours) + '시간</td>'
        + '<td><b>' + LC.won(res.realNet) + '</b></td>'
        + '<td>' + ratioText + '</td>'
        + '</tr>';
    });
    $('scenarioBody').innerHTML = html;
  }

  function shareParams() {
    var s = last ? last.input : readInput();
    return {
      g: s.pay, m: s.mode, d: s.days, h: s.hours, o: s.overtime,
      l: s.lunch, c: s.commute, li: s.lunchBound ? 1 : 0
    };
  }

  function summary() {
    if (!last) return '';
    var r = last.r, s = r.state;
    return [
      '내 진짜 시급은 ' + LC.won(r.realNet) + '입니다.',
      '· 월급 ' + LC.won(r.gross) + (s.mode === 'net' ? '(세후 기준 입력)' : '(세전)') + ' → 실수령 ' + LC.won(r.net),
      '· 하루 구속 ' + hhmm(r.dailyMin) + ' (통근 ' + s.commute + '분 포함)',
      '· 2026 최저시급 ' + LC.won(MIN_WAGE) + '의 ' + (Math.round(r.ratio * 100) / 100) + '배',
      '당신도 계산해 보세요 → ' + LC.shareUrl(shareParams())
    ].join('\n');
  }

  LC.onCopy($('copyBtn'), summary, '진짜 시급을 복사했어요. 카톡에 붙여넣기!');
  LC.onShare($('shareBtn'), function () {
    if (!last) {
      return {
        title: '내 진짜 시급 계산기 — 시급노트',
        text: '월급을 회사에 묶인 모든 시간으로 나누면 내 시급은 얼마일까? 통근·점심·야근까지 넣고 계산해 봐!',
        url: LC.shareUrl(shareParams())
      };
    }
    var r = last.r, s = r.state;
    return {
      title: '내 진짜 시급 계산기 — 시급노트',
      text: '내 진짜 시급은 ' + LC.won(r.realNet) + '… 너도 계산해 봐!\n'
        + '· 월급 ' + LC.won(r.gross) + (s.mode === 'net' ? '(세후 기준 입력)' : '(세전)') + ' → 실수령 ' + LC.won(r.net) + '\n'
        + '· 하루 구속 ' + hhmm(r.dailyMin) + ' (통근 ' + s.commute + '분 포함)\n'
        + '· 2026 최저시급 ' + LC.won(MIN_WAGE) + '의 ' + (Math.round(r.ratio * 100) / 100) + '배',
      url: LC.shareUrl(shareParams())
    };
  });

  /* URL 파라미터 복원 (공유 링크로 결과 재현) */
  (function fromParams() {
    if (!LC.param('g')) return;
    if (LC.param('m')) setMode(LC.param('m'));
    LC.setMoney(payIn, Number(LC.param('g')) || 0);
    if (LC.param('d')) daysIn.value = LC.param('d');
    if (LC.param('h')) hoursIn.value = LC.param('h');
    if (LC.param('o')) otIn.value = LC.param('o');
    if (LC.param('l')) lunchIn.value = LC.param('l');
    if (LC.param('c')) commuteIn.value = LC.param('c');
    if (LC.param('li') === '0') lunchTgl.checked = false;
  })();

  var saved = LC.load('realWageInput', null);
  if (saved && !LC.param('g')) {
    if (saved.mode) setMode(saved.mode);
    if (saved.pay) LC.setMoney(payIn, saved.pay);
  }
  setMode(mode);
  render();

  window.addEventListener('pagehide', function () {
    LC.save('realWageInput', { pay: LC.money(payIn), mode: mode });
  });
})();
