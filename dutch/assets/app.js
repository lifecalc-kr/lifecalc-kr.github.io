/* 더치노트 — 화면 배선 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  var totalIn = $('total'), alcRange = $('alcShare'), unitSel = $('unit'), alcOnly = $('alcOnly');
  var memberBox = $('members');

  LC.bindMoney(totalIn);
  LC.bindChips($('totalChips'), function (v) { LC.setMoney(totalIn, Number(v)); renderResults(); });

  var members = [
    { name: '김대리', cond: 'full', drink: true },
    { name: '이사원', cond: 'full', drink: true },
    { name: '박주임', cond: 'late', drink: false },
    { name: '정대리', cond: 'second', drink: true }
  ];

  var PALETTE = ['#0f9d76', '#2f6bff', '#e8590c', '#7c3aed', '#d9468f', '#0f766e', '#b45309', '#4b5563'];

  function condOptions(selected) {
    var sel = document.createElement('select');
    sel.className = 'mcond';
    sel.setAttribute('aria-label', '참석 조건');
    DutchCore.CONDS.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.v;
      o.textContent = c.label + ' · ' + c.w;
      if (c.v === selected) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function buildMembers() {
    memberBox.innerHTML = '';
    members.forEach(function (m, i) {
      var row = document.createElement('div');
      row.className = 'member';

      var name = document.createElement('input');
      name.type = 'text';
      name.className = 'mname';
      name.value = m.name;
      name.maxLength = 20;
      name.setAttribute('aria-label', '참여자 ' + (i + 1) + ' 이름');
      name.addEventListener('input', function () { m.name = name.value; renderResults(); });

      var sel = condOptions(m.cond);
      sel.addEventListener('change', function () { m.cond = sel.value; renderResults(); });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.setAttribute('aria-label', m.name + ' 삭제');
      del.textContent = '×';
      del.addEventListener('click', function () {
        if (members.length <= 1) { LC.toast('참여자는 한 명 이상이어야 합니다.'); return; }
        members.splice(i, 1);
        buildMembers();
        renderResults();
      });

      var drink = document.createElement('label');
      drink.className = 'check mdrink';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = m.drink;
      cb.addEventListener('change', function () { m.drink = cb.checked; renderResults(); });
      var txt = document.createElement('span');
      txt.textContent = '술 마심';
      drink.appendChild(cb);
      drink.appendChild(txt);

      row.appendChild(name);
      row.appendChild(sel);
      row.appendChild(del);
      row.appendChild(drink);
      memberBox.appendChild(row);
    });
    $('memberCount').textContent = members.length + '명';
  }

  $('addMember').addEventListener('click', function () {
    if (members.length >= 12) { LC.toast('최대 12명까지 계산할 수 있어요.'); return; }
    members.push({ name: '참여자 ' + (members.length + 1), cond: 'full', drink: false });
    buildMembers();
    renderResults();
  });

  totalIn.addEventListener('input', renderResults);
  alcRange.addEventListener('input', function () {
    $('alcOut').textContent = alcRange.value + '%';
    renderResults();
  });
  unitSel.addEventListener('change', renderResults);
  alcOnly.addEventListener('change', renderResults);

  var last = null;

  function readInput() {
    return {
      total: LC.money(totalIn),
      alcShare: (parseInt(alcRange.value, 10) || 0) / 100,
      unit: parseInt(unitSel.value, 10) || 1000,
      alcOnly: alcOnly.checked,
      members: members
    };
  }

  function renderResults() {
    var input = readInput();
    var r = DutchCore.compute(input);
    last = { r: r, input: input };

    $('alcOut').textContent = Math.round(r.alcShare * 100) + '%';
    $('memberCount').textContent = members.length + '명';

    LC.text('avgPay', LC.fmt(r.avg));
    LC.text('avgLabel', members.length + '명이 나누면 1인당 평균');
    LC.text('dutchSub', '총 ' + LC.won(r.total) + ' · 술 마신 ' + r.drinkerCount + '명 / ' + members.length + '명');

    var badge = $('dutchBadge');
    if (r.total <= 0) {
      badge.className = 'res-badge';
      badge.textContent = '—';
    } else if (!r.alcDistributed || r.max === r.min) {
      badge.className = 'res-badge ok';
      badge.textContent = '단순 N빵과 같음';
    } else {
      badge.className = 'res-badge ok';
      badge.textContent = '최대 ' + LC.won(r.max - r.min) + ' 차이';
    }

    var quote = $('dutchQuote');
    var msg;
    if (r.total <= 0) {
      msg = '총 결제 금액을 입력하면 각자 낼 금액이 나옵니다.';
    } else if (!r.alcDistributed) {
      msg = r.drinkerCount === 0
        ? '술을 마신 사람이 없어 음식값만 참석 비율대로 나눴습니다.'
        : '주류값까지 모두가 나누는 설정입니다. 술 안 마신 사람이 조금 더 내게 됩니다.';
    } else if (r.max === r.min) {
      msg = '모두 같은 조건이라 단순 N빵과 결과가 같습니다.';
    } else {
      var low = r.results.filter(function (x) { return x.amount === r.min; })[0];
      var high = r.results.filter(function (x) { return x.amount === r.max; })[0];
      msg = low.name + '은(는) ' + LC.won(r.simple - r.min) + ' 적게, ' + high.name + '은(는) ' + LC.won(r.max - r.simple) + ' 더 냅니다. 단순 N빵(' + LC.won(r.simple) + ')보다 서로 납득하기 쉬운 금액입니다.';
    }
    quote.textContent = msg;
    quote.className = 'res-quote';

    /* 인당 금액 리스트 */
    var listHtml = '';
    r.results.forEach(function (x) {
      var cls = x.amount === r.max && r.max !== r.min ? 'hi' : (x.amount === r.min && r.max !== r.min ? 'lo' : '');
      listHtml += '<div><span class="nm">' + escapeHtml(x.name) + '<small>' + x.condLabel + (x.drink ? ' · 술' : ' · 무알콜') + '</small></span>'
        + '<span class="am ' + cls + '">' + LC.won(x.amount) + '</span></div>';
    });
    $('payList').innerHTML = listHtml;

    LC.text('rSimple', LC.won(r.simple) + ' (1/' + members.length + ')');
    $('rMax').innerHTML = LC.won(r.max) + ' <small>' + escapeHtml(r.maxName) + '</small>';
    $('rMin').innerHTML = LC.won(r.min) + ' <small>' + escapeHtml(r.minName) + '</small>';
    LC.text('rPots', LC.fmt(Math.round(r.foodPot)) + ' / ' + LC.fmt(Math.round(r.alcPot)) + '원');
    $('rTotal').innerHTML = LC.won(r.sum) + (r.sum === Math.round(r.total) ? ' <small>총액 일치</small>' : ' <small>확인 필요</small>');

    renderDetail(r);
    renderBar(r);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderDetail(r) {
    var html = '';
    r.results.forEach(function (x) {
      html += '<tr>'
        + '<th scope="row">' + escapeHtml(x.name) + '</th>'
        + '<td style="text-align:left">' + x.condLabel + ' <small>' + x.weight + '</small></td>'
        + '<td>' + (x.drink ? 'O' : '—') + '</td>'
        + '<td>' + LC.won(x.foodPart) + '</td>'
        + '<td>' + LC.won(x.alcPart) + '</td>'
        + '<td class="num"><b>' + LC.won(x.amount) + '</b></td>'
        + '</tr>';
    });
    html += '<tr class="on"><th scope="row">합계</th><td></td><td>' + r.drinkerCount + '명</td>'
      + '<td><b>' + LC.won(r.foodPot) + '</b></td><td><b>' + LC.won(r.alcPot) + '</b></td>'
      + '<td class="num"><b>' + LC.won(r.sum) + '</b></td></tr>';
    $('detailBody').innerHTML = html;
  }

  function renderBar(r) {
    var bar = $('splitBar'), legend = $('splitLegend');
    bar.innerHTML = '';
    legend.innerHTML = '';
    var sum = r.sum || 1;
    r.results.forEach(function (x, i) {
      var color = PALETTE[i % PALETTE.length];
      var seg = document.createElement('span');
      seg.style.width = ((x.amount / sum) * 100).toFixed(2) + '%';
      seg.style.background = color;
      seg.title = x.name + ' ' + LC.won(x.amount);
      bar.appendChild(seg);
      legend.innerHTML += '<span><i style="background:' + color + '"></i>' + escapeHtml(x.name) + ' ' + LC.won(x.amount) + '</span>';
    });
  }

  /* ── 정산 내역 문구 ─────────────────────────────── */
  function shareParams() {
    var s = last ? last.input : readInput();
    var packed = s.members.map(function (m) { return m.name + ':' + m.cond + ':' + (m.drink ? 1 : 0); }).join(',');
    return { t: s.total, a: Math.round(s.alcShare * 100), u: s.unit, p: packed };
  }

  function settlementText() {
    if (!last) return '';
    var r = last.r;
    var lines = [];
    lines.push('🍻 정산 내역 (총 ' + LC.won(r.total) + ' · ' + members.length + '명)');
    lines.push('');
    r.results.forEach(function (x) { lines.push(x.name + '  ' + LC.won(x.amount)); });
    lines.push('');
    lines.push('합계 ' + LC.won(r.sum));
    if (r.alcDistributed) {
      lines.push('· 주류값 ' + LC.won(r.alcPot) + '은 술 마신 ' + r.drinkerCount + '명이 나눴습니다.');
      lines.push('· 음식값 ' + LC.won(r.foodPot) + '은 참석 비율대로 나눴습니다.');
    } else {
      lines.push('· 총액을 참석 비율대로 나눴습니다.');
    }
    return lines.join('\n');
  }

  LC.onCopy($('copyBtn'), function () {
    return settlementText() + '\n\n계산 → ' + LC.shareUrl(shareParams());
  }, '정산 내역을 복사했어요. 단톡방에 붙여넣으세요!');

  LC.onShare($('shareBtn'), function () {
    return {
      title: '더치페이 정산',
      text: settlementText(),
      url: LC.shareUrl(shareParams())
    };
  });

  /* ── URL 파라미터 복원 ──────────────────────────── */
  (function fromParams() {
    if (LC.param('t')) LC.setMoney(totalIn, Number(LC.param('t')) || 0);
    if (LC.param('a') != null) {
      var a = Math.min(70, Math.max(0, Number(LC.param('a')) || 0));
      alcRange.value = Math.round(a / 5) * 5;
    }
    if (LC.param('u')) unitSel.value = LC.param('u');
    var p = LC.param('p');
    if (p) {
      var parsed = p.split(',').map(function (chunk) {
        var parts = chunk.split(':');
        var cond = parts.length > 1 ? parts[1] : 'full';
        var drink = parts.length > 2 ? parts[2] === '1' : false;
        var ok = DutchCore.CONDS.some(function (c) { return c.v === cond; });
        return { name: (parts[0] || '참여자').slice(0, 20), cond: ok ? cond : 'full', drink: drink };
      }).filter(function (m) { return m.name; });
      if (parsed.length) members = parsed.slice(0, 12);
    }
  })();

  buildMembers();
  renderResults();
})();
