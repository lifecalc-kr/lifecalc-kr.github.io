/* 루팡노트 — 화면 배선 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  var mode = 'gross';
  var payIn = $('pay'), daysIn = $('days'), hoursIn = $('hours');
  var fields = ['wc', 'coffee', 'youtube', 'chat'];

  LC.bindMoney(payIn);
  LC.bindMoney($('meal'));
  LC.bindChips($('payChips'), function (v) { LC.setMoney(payIn, Number(v)); render(); });

  function setMode(next) {
    mode = next === 'net' ? 'net' : 'gross';
    LC.$$('.seg button[data-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
    });
  }
  LC.$$('.seg button[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(btn.dataset.mode); render(); });
  });

  LC.$$('#timeChips .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var add = Number(chip.dataset.add) || 0;
      if (add === 0) {
        fields.forEach(function (k) { $(k).value = 0; });
      } else {
        var per = add / 4;
        fields.forEach(function (k) {
          var el = $(k);
          el.value = Math.round((Number(el.value) || 0) + per);
        });
      }
      render();
    });
  });

  [payIn, daysIn, hoursIn, $('dependents'), $('meal')].concat(fields.map(function (k) { return $(k); }))
    .forEach(function (el) { el.addEventListener('input', render); });

  function readInput() {
    var o = {
      mode: mode,
      pay: LC.money(payIn),
      days: parseFloat(daysIn.value) || 20.9,
      hours: parseFloat(hoursIn.value) || 8,
      meal: LC.money($('meal')),
      dependents: parseInt($('dependents').value, 10) || 1
    };
    fields.forEach(function (k) { o[k] = parseFloat($(k).value) || 0; });
    return o;
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
    var r = LupinCore.compute(input);
    last = { r: r, input: input };

    $('timeSum').textContent = '하루 딴짓 합계 ' + hhmm(r.minutes) + ' · 근무시간의 ' + (Math.round(r.pct * 10) / 10) + '%';

    LC.text('lupinToday', LC.fmt(r.dayMoney));
    LC.text('lupinSub', '이번 달 ' + LC.won(r.monthMoney) + ' · 1년이면 ' + LC.won(r.yearMoney));

    var badge = $('lupinGrade');
    badge.className = 'res-badge' + (r.grade.tier >= 2 ? ' warn' : ' ok');
    badge.textContent = r.grade.name + ' · 근무시간의 ' + (Math.round(r.pct * 10) / 10) + '%';

    $('lupinQuote').textContent = r.minutes > 0
      ? r.grade.desc
      : '오늘은 딴짓을 안 했습니다. 이 계산기를 켠 시간도 업무시간이라면 살짝 딴짓입니다.';

    $('rMonth').innerHTML = LC.won(r.monthMoney) + ' <small>' + r.days + '일</small>';
    $('rYear').innerHTML = LC.won(r.yearMoney) + ' <small>12개월</small>';
    LC.text('rPct', (Math.round(r.pct * 10) / 10) + '%');
    LC.text('rHourly', LC.won(r.hourly) + ' /시간');
    LC.text('rMinute', LC.won(r.minuteRate) + ' /분');

    var alt = [];
    if (r.alts.coffees >= 1) alt.push('커피 ' + r.alts.coffees + '잔');
    if (r.alts.chickens >= 1) alt.push('치킨 ' + r.alts.chickens + '마리');
    if (!alt.length && r.alts.movies >= 1) alt.push('영화 ' + r.alts.movies + '편');
    if (!alt.length) alt.push('최저시급 ' + (Math.round(r.alts.minWageHours * 10) / 10) + '시간');
    $('rAlt').textContent = alt.join(' · ');

    $('rDaysEq').innerHTML = (Math.round(r.annualDaysEq * 10) / 10) + '일 <small>1년 누적 딴짓</small>';

    renderBreak(r);
    renderGrades(r);
    LC.save('lupinLast', { pay: r.pay, mode: r.mode, minutes: r.minutes, day: Math.round(r.dayMoney) });
  }

  function renderBreak(r) {
    var html = '';
    r.items.forEach(function (it) {
      html += '<tr>'
        + '<th scope="row">' + it.emoji + ' ' + it.label + '</th>'
        + '<td>' + it.min + '분</td>'
        + '<td><b>' + LC.won(it.money) + '</b></td>'
        + '<td>' + LC.won(it.money * r.days) + '</td>'
        + '<td>' + Math.round(it.share * 100) + '%</td>'
        + '</tr>';
    });
    html += '<tr class="on"><th scope="row">합계</th><td>' + r.minutes + '분</td><td><b>' + LC.won(r.dayMoney) + '</b></td><td>' + LC.won(r.monthMoney) + '</td><td>100%</td></tr>';
    $('breakBody').innerHTML = html;
  }

  function renderGrades(r) {
    var rows = [
      ['성실한 모범사원', '3% 미만', '딴짓 14분 이하', '오늘은 거의 일만 했습니다'],
      ['초보 루팡', '3~8%', '15~38분', '커피 한 잔의 여유'],
      ['중급 루팡', '8~15%', '39~72분', '회사가 커피값을 내줍니다'],
      ['고수 루팡', '15~25%', '73~120분', '하루의 4분의 1이 내 시간'],
      ['전설의 루팡', '25% 이상', '121분 이상', '회사가 취미를 후원합니다']
    ];
    var html = '';
    rows.forEach(function (row) {
      var on = row[0] === r.grade.name;
      html += '<tr' + (on ? ' class="on"' : '') + '><th scope="row">' + row[0] + '</th><td>' + row[1] + '</td><td>' + row[2] + '</td><td>' + row[3] + '</td></tr>';
    });
    $('gradeBody').innerHTML = html;
  }

  function shareParams() {
    var s = last ? last.input : readInput();
    return { p: s.pay, m: s.mode, d: s.days, h: s.hours, wc: s.wc, cf: s.coffee, yt: s.youtube, ch: s.chat };
  }

  function summary() {
    if (!last) return '';
    var r = last.r;
    return [
      '오늘 회사에서 슬쩍 가져간 돈: ' + LC.won(r.dayMoney),
      '· 딴짓 ' + hhmm(r.minutes) + ' (근무시간의 ' + (Math.round(r.pct * 10) / 10) + '%)',
      '· 이번 달 ' + LC.won(r.monthMoney) + ' · 1년 ' + LC.won(r.yearMoney),
      '· 내 등급: ' + r.grade.name,
      '당신도 계산해 보세요 → ' + LC.shareUrl(shareParams())
    ].join('\n');
  }

  LC.onCopy($('copyBtn'), summary, '루팡 손익을 복사했어요. 단톡방에 던져 보세요.');
  LC.onShare($('shareBtn'), function () {
    var r = last ? last.r : null;
    return {
      title: '월급 루팡 손익 계산기',
      text: r ? '오늘 회사에서 슬쩍 가져간 돈은 ' + LC.won(r.dayMoney) + '\n내 등급: ' + r.grade.name + ' (근무시간의 ' + (Math.round(r.pct * 10) / 10) + '%)' : '오늘 회사에서 슬쩍 가져간 돈은?',
      url: LC.shareUrl(shareParams())
    };
  });

  /* URL 파라미터 */
  if (LC.param('p')) LC.setMoney(payIn, Number(LC.param('p')) || 0);
  if (LC.param('m')) setMode(LC.param('m'));
  if (LC.param('d')) daysIn.value = LC.param('d');
  if (LC.param('h')) hoursIn.value = LC.param('h');
  var map = { wc: 'wc', cf: 'coffee', yt: 'youtube', ch: 'chat' };
  Object.keys(map).forEach(function (k) {
    if (LC.param(k) != null) $(map[k]).value = LC.param(k);
  });

  render();
})();
