/* 임펄스노트 — 화면 배선 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  var priceIn = $('price'), wageIn = $('wage'), hpdIn = $('hoursPerDay'), monthlyIn = $('monthly');

  LC.bindMoney(priceIn);
  LC.bindMoney(wageIn);
  LC.bindMoney(monthlyIn);

  LC.bindChips($('priceChips'), function (v) { LC.setMoney(priceIn, Number(v)); render(); });
  LC.bindChips($('wageChips'), function (v) { LC.setMoney(wageIn, Number(v)); render(); });

  [priceIn, wageIn].forEach(function (el) { el.addEventListener('input', render); });
  [hpdIn, monthlyIn].forEach(function (el) { el.addEventListener('input', render); });

  function readInput() {
    return {
      price: LC.money(priceIn),
      wage: LC.money(wageIn),
      hoursPerDay: parseFloat(hpdIn.value) || 8,
      monthly: LC.money(monthlyIn)
    };
  }

  function timeText(r) {
    if (!r.wage || !r.price) return '0';
    if (r.h === 0) return String(r.m);
    return String(r.h);
  }
  function unitText(r) {
    if (!r.wage || !r.price) return '';
    if (r.h === 0) return '분';
    return r.m > 0 ? '시간 ' + r.m + '분' : '시간';
  }

  var last = null;

  function render() {
    var input = readInput();
    var r = ImpulseCore.compute(input);
    last = { r: r, input: input };

    $('impulseTime').textContent = timeText(r);
    $('impulseUnit').textContent = unitText(r);

    var sub;
    if (!r.price || !r.wage) {
      sub = '가격과 시급을 입력해 주세요.';
    } else {
      sub = '출근 ' + (Math.round(r.days * 10) / 10) + '일치 · 하루 벌이 ' + LC.won(r.dailyEarning);
    }
    LC.text('impulseSub', sub);

    var badge = $('impulseBadge');
    if (!r.price || !r.wage) {
      badge.textContent = '—';
      badge.className = 'res-badge';
    } else if (r.pct != null) {
      badge.className = 'res-badge ok';
      badge.textContent = '월 실수령의 ' + (Math.round(r.pct * 10) / 10) + '%';
    } else {
      badge.className = 'res-badge ok';
      badge.textContent = '출근 ' + (Math.round(r.days * 10) / 10) + '일치';
    }

    $('impulseQuote').textContent = ImpulseCore.verdict(r);

    $('rDays').innerHTML = (Math.round(r.days * 10) / 10) + '일 <small>하루 ' + r.hoursPerDay + '시간 기준</small>';
    LC.text('rWage', LC.won(r.wage) + ' /시간');
    LC.text('rMin', (Math.round(r.minHours * 10) / 10) + '시간');
    LC.text('rPct', r.pct == null ? '월급 입력 시' : (Math.round(r.pct * 10) / 10) + '%');
    $('rAlt').innerHTML = r.alt.length
      ? r.alt.map(function (a) { return a.name + ' ' + (Math.round(a.count * 10) / 10) + '개'; }).join(' · ')
      : '<small>단위보다 작음</small>';
    $('rSave').innerHTML = r.wage > 0 ? (Math.round(r.hours * 10) / 10) + '시간 <small>안 사면 그대로 남습니다</small>' : '—';

    renderTable(input);
    LC.save('impulseWage', Math.round(r.wage));
  }

  function renderTable(input) {
    var rows = ImpulseCore.table(input);
    var html = '';
    rows.forEach(function (row) {
      var t = row.h === 0 ? row.m + '분' : (row.m ? row.h + '시간 ' + row.m + '분' : row.h + '시간');
      html += '<tr>'
        + '<td><b>' + LC.won(row.price) + '</b></td>'
        + '<td>' + row.label + '</td>'
        + '<td>' + t + '</td>'
        + '<td>' + (Math.round(row.days * 10) / 10) + '일</td>'
        + '</tr>';
    });
    $('tableBody').innerHTML = html;
  }

  function shareParams() {
    var s = last ? last.input : readInput();
    return { p: s.price, w: s.wage };
  }

  function summary() {
    if (!last) return '';
    var r = last.r;
    var t = r.h === 0 ? r.m + '분' : (r.m ? r.h + '시간 ' + r.m + '분' : r.h + '시간');
    var lines = [
      LC.won(r.price) + ' = ' + t + ' 일해야 합니다.',
      '· 내 시급 ' + LC.won(r.wage) + ' · 출근 ' + (Math.round(r.days * 10) / 10) + '일치'
    ];
    if (r.pct != null) lines.push('· 월 실수령의 ' + (Math.round(r.pct * 10) / 10) + '%');
    lines.push('당신도 계산해 보세요 → ' + LC.shareUrl(shareParams()));
    return lines.join('\n');
  }

  LC.onCopy($('copyBtn'), summary, '시간 환산 결과를 복사했어요!');
  LC.onShare($('shareBtn'), function () {
    var lines = summary().split('\n');
    return {
      title: '충동구매 시간 환산기',
      text: lines.slice(0, lines.length - 1).join('\n'),
      url: LC.shareUrl(shareParams())
    };
  });

  /* 진짜 시급 연결 */
  function initWageLink() {
    var saved = LC.load('realWage', null);
    if (!saved || !saved.hourlyNet) return;
    var box = $('wageLink');
    box.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm';
    btn.textContent = '내 진짜 시급 ' + LC.won(saved.hourlyNet) + ' 불러오기';
    btn.addEventListener('click', function () {
      LC.setMoney(wageIn, saved.hourlyNet);
      render();
      LC.toast('진짜 시급 ' + LC.won(saved.hourlyNet) + '을 불러왔어요.');
    });
    box.appendChild(btn);
    var link = document.createElement('a');
    link.className = 'hint';
    link.href = '../real-wage/';
    link.style.display = 'inline-block';
    link.style.marginTop = '6px';
    link.textContent = '다시 계산하기 →';
    box.appendChild(link);
  }

  /* 시작 */
  if (LC.param('p')) LC.setMoney(priceIn, Number(LC.param('p')) || 0);
  if (LC.param('w')) LC.setMoney(wageIn, Number(LC.param('w')) || 0);
  else {
    var w = LC.load('impulseWage', 0);
    if (w) LC.setMoney(wageIn, w);
  }
  initWageLink();
  render();
})();
