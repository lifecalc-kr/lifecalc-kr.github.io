/* ═══════════════════════════════════════════════════════════════
   트래블노트 — 화면 배선
   · 실시간 환율: open.er-api.com (무료·무키·CORS 허용)
     → 실패 시 저장된 환율 → 내장 스냅샷 순서로 폴백
   · 모든 계산은 이 브라우저 안에서만 이루어집니다.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = TravelCore.COUNTRIES;

  /* ── 내장 환율 스냅샷 (1 KRW 당 현지 통화, 2026-11-15 기준) ── */
  var SNAPSHOT = {
    at: '2026-11-15T09:00:00+09:00',
    rates: { VND: 19.2536, JPY: 0.119621, THB: 0.025369, PHP: 0.047785,
             TWD: 0.024642, HKD: 0.00587, SGD: 0.000963, USD: 0.000748, EUR: 0.000677 }
  };

  var FX = { rates: null, at: null, source: 'snapshot' };

  function $(id) { return document.getElementById(id); }

  /* ── 상태 ─────────────────────────────────────────── */
  var state = LC.load('travel', {
    country: 'vietnam', budget: 500000, nights: 3,
    deduct: false, flight: 0, hotel: 0,
    custom: {}, cart: {}
  });
  function save() { LC.save('travel', state); }

  /* ── 환율 로딩 ─────────────────────────────────────── */
  function setStatus(label, live) {
    LC.text('statusText', label);
    var pill = $('statusPill');
    if (pill) pill.classList.toggle('live', !!live);
  }

  function applyRates(rates, at, source) {
    FX.rates = rates; FX.at = at ? new Date(at) : new Date(); FX.source = source;
    try { localStorage.setItem('lifecalc.travel.fx', JSON.stringify({ rates: rates, at: at })); } catch (e) {}
    render();
  }

  function loadRates() {
    // 1) 실시간 API
    fetch('https://open.er-api.com/v6/latest/KRW')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        if (!d || !d.rates || !d.time_last_update_unix) throw new Error('bad payload');
        applyRates(d.rates, d.time_last_update_unix * 1000, 'er-api');
        setStatus('실시간 환율 · ' + kst(FX.at), true);
        renderCompare();
      })
      .catch(function () {
        // 2) 마지막 저장 환율
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem('lifecalc.travel.fx') || 'null'); } catch (e) {}
        if (saved && saved.rates) {
          applyRates(saved.rates, saved.at, 'cache');
          setStatus('저장된 환율 · ' + kst(FX.at), false);
        } else {
          // 3) 내장 스냅샷
          applyRates(SNAPSHOT.rates, SNAPSHOT.at, 'snapshot');
          setStatus('내장 기준 환율 (오프라인)', false);
        }
      });
  }

  function sig(n) {
    if (!isFinite(n)) return '0';
    var v = n >= 1 ? Math.round(n * 100) / 100 : Math.round(n * 10000) / 10000;
    return String(v);
  }

  function kst(t) {
    if (!t || isNaN(t.getTime())) return '';
    return new Date(t.getTime() + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ') + ' KST';
  }

  function rate(ccy) { return (FX.rates && FX.rates[ccy]) || 0; }

  /* ── 표시 포맷 ─────────────────────────────────────── */
  function fmtLocal(n, ccy) {
    var dec = (ccy === 'HKD' || ccy === 'SGD' || ccy === 'EUR' || ccy === 'USD') && n % 1 !== 0;
    var v = dec ? (Math.round(n * 100) / 100) : Math.round(n);
    return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }

  function currentCountry() { return TravelCore.country(state.country); }

  /* ── 렌더 ─────────────────────────────────────────── */
  function render() {
    var c = currentCountry();
    var r = rate(c.ccy);
    var b = TravelCore.budget(state);

    // 나라 선택 버튼
    LC.$$('#countryGrid .ctry').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.id === state.country ? 'true' : 'false');
    });

    // 결과 헤더
    LC.text('resCountry', c.flag + ' ' + c.name);
    LC.text('resCity', c.city + ' 기준');
    LC.text('resDays', b.days + '일(' + state.nights + '박)');
    LC.text('resDay', LC.fmt(b.perDay) + '원');
    LC.text('resDayLocal', b.perDay ? '≈ ' + fmtLocal(TravelCore.toLocal(b.perDay, r), c.ccy) + ' ' + c.ccyShort : '—');
    LC.text('resTotal', LC.fmt(b.total) + '원');
    LC.text('resTotalLocal', b.total ? '≈ ' + fmtLocal(TravelCore.toLocal(b.total, r), c.ccy) + ' ' + c.ccyShort : '—');
    LC.text('rateLine', r ? '1원 = ' + sig(r) + ' ' + c.ccyShort +
      ' · 1만원 = ' + fmtLocal(TravelCore.toLocal(10000, r), c.ccy) + ' ' + c.ccyShort : '환율을 불러오는 중…');

    // 예산 진행 바 (하루 예산 기준)
    var cartSum = TravelCore.cartTotal(cartArray(), c.items, state.custom).local;
    var dayLocal = TravelCore.toLocal(b.perDay, r);
    var pct = dayLocal > 0 ? Math.min(100, cartSum / dayLocal * 100) : 0;
    $('barFill').style.width = pct + '%';
    $('barLabel').textContent = cartSum ? '장바구니 ' + fmtLocal(cartSum, c.ccy) + ' ' + c.ccyShort +
      ' / 하루 예산 ' + fmtLocal(dayLocal, c.ccy) + ' ' + c.ccyShort : '아래 항목을 눌러 담아 보세요';
    $('barLeft').textContent = dayLocal ? (cartSum <= dayLocal ? '하루 예산에서 ' + fmtLocal(dayLocal - cartSum, c.ccy) + ' ' + c.ccyShort + ' 남았어요' : '하루 예산을 ' + fmtLocal(cartSum - dayLocal, c.ccy) + ' ' + c.ccyShort + ' 넘었어요') : '';

    // 항목별 체감 리스트
    var counts = TravelCore.counts(TravelCore.toLocal(b.total, r), c.items, state.custom);
    var box = $('itemList');
    box.innerHTML = '';
    counts.forEach(function (it) {
      var src = itemById(c, it.id);
      var row = document.createElement('div');
      row.className = 'item' + (it.taxi ? ' item-taxi' : '');
      row.innerHTML =
        '<span class="item-emoji" aria-hidden="true">' + it.emoji + '</span>' +
        '<div class="item-main">' +
          '<span class="item-name">' + it.name + (it.taxi ? ' <em class="tag-taxi">교통</em>' : '') + '</span>' +
          '<span class="item-price"><button type="button" class="price-btn" data-id="' + it.id + '" title="가격 직접 수정">' +
            fmtLocal(it.price, c.ccy) + ' ' + c.ccyShort + '</button>' +
            ' <span class="item-krw">≈ ' + LC.fmt(TravelCore.toKRW(it.price, r)) + '원</span>' +
            '<span class="item-range">' + it.range + '</span></span>' +
        '</div>' +
        '<div class="item-side">' +
          '<span class="item-count">' + (it.count > 0 ? it.count.toLocaleString('ko-KR') + '<small>' + it.unit + '</small>' : '0<small>' + it.unit + '</small>') + '</span>' +
          '<div class="item-btns">' +
            '<button type="button" class="qty-btn" data-id="' + it.id + '" data-d="-1" aria-label="' + it.name + ' 하나 빼기">−</button>' +
            '<button type="button" class="qty-btn" data-id="' + it.id + '" data-d="1" aria-label="' + it.name + ' 하나 담기">+</button>' +
          '</div>' +
        '</div>';
      box.appendChild(row);
    });

    // 가격 수정 버튼 → 인라인 입력
    LC.$$('.price-btn', box).forEach(function (btn) {
      btn.addEventListener('click', function () { editPrice(btn.dataset.id, btn); });
    });
    // 장바구니 ± 버튼
    LC.$$('.qty-btn', box).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.id, d = parseInt(btn.dataset.d, 10);
        var q = state.cart[state.country + ':' + id] || 0;
        q = Math.max(0, q + d);
        if (q) state.cart[state.country + ':' + id] = q; else delete state.cart[state.country + ':' + id];
        save(); renderCart(); render();
      });
    });

    // 공유 문구는 공유 버튼을 누를 때 buildShare 에서 만듭니다.
    renderCart();
  }

  function itemById(c, id) {
    for (var i = 0; i < c.items.length; i++) if (c.items[i].id === id) return c.items[i];
    return null;
  }

  function editPrice(id, btn) {
    var c = currentCountry();
    var it = itemById(c, id);
    if (!it || btn.querySelector('input')) return;
    var cur = (state.custom[id] != null) ? state.custom[id] : it.price;
    var input = document.createElement('input');
    input.type = 'text'; input.inputMode = 'decimal';
    input.value = String(cur);
    input.className = 'price-input';
    input.setAttribute('aria-label', it.name + ' 현지 가격 수정');
    btn.replaceWith(input);
    input.focus(); input.select();
    function commit() {
      var v = parseFloat(String(input.value).replace(/[^\d.]/g, ''));
      if (isFinite(v) && v > 0) state.custom[id] = v; else delete state.custom[id];
      save(); render();
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
  }

  /* ── 장바구니 ─────────────────────────────────────── */
  function cartArray() {
    var out = [], pre = state.country + ':';
    Object.keys(state.cart).forEach(function (k) {
      if (k.indexOf(pre) !== 0) return;
      out.push({ id: k.slice(pre.length), qty: state.cart[k] });
    });
    return out;
  }

  function renderCart() {
    var c = currentCountry();
    var r = rate(c.ccy);
    var cart = cartArray();
    var sum = TravelCore.cartTotal(cart, c.items, state.custom);
    var list = $('cartList');
    if (!cart.length) {
      list.innerHTML = '<p class="cart-empty">아직 비었어요. 위 항목의 <b>+</b>를 눌러 담아 보세요.<br>쌀국수 2 + 그랩 3 + 마사지 1 … 하루 예산 안에 들어오는지 바로 확인됩니다.</p>';
    } else {
      list.innerHTML = sum.lines.map(function (l) {
        return '<div class="cart-line"><span class="cart-nm">' + l.emoji + ' ' + l.name +
          ' <small>' + l.qty + l.unit + '</small></span><span class="cart-am">' +
          fmtLocal(l.sum, c.ccy) + ' ' + c.ccyShort + '</span></div>';
      }).join('');
    }
    LC.text('cartTotal', cart.length ? fmtLocal(sum.local, c.ccy) + ' ' + c.ccyShort : '—');
    LC.text('cartTotalKRW', cart.length ? '≈ ' + LC.fmt(TravelCore.toKRW(sum.local, r)) + '원' : '—');
    $('cartClear').hidden = !cart.length;
  }

  /* ── 공유 ─────────────────────────────────────────── */
  function buildShare() {
    var c = currentCountry();
    var b = TravelCore.budget(state);
    var r = rate(c.ccy);
    var counts = TravelCore.counts(TravelCore.toLocal(b.total, r), c.items, state.custom);
    var line = TravelCore.shareLine(c.name, b.total, counts);
    var text = (line || (c.flag + ' ' + c.name + ' 여행 물가 환산!')) +
      ' (' + state.nights + '박 ' + b.days + '일 · 하루 ' + LC.fmt(b.perDay) + '원) 너도 계산해 봐!';
    return {
      title: '트래블노트 — 해외 여행물가 환산기',
      text: text,
      url: LC.shareUrl({ c: state.country, b: state.budget || '', n: state.nights || '' })
    };
  }

  /* ── 나라별 비교표 (1만원 기준) ──────────────── */
  function renderCompare() {
    var body = $('compareBody');
    if (!body) return;
    body.innerHTML = C.map(function (c) {
      var r = rate(c.ccy);
      var cheapest = null;
      c.items.forEach(function (it) {
        if (it.taxi) return;
        if (!cheapest || it.price < cheapest.price) cheapest = it;
      });
      var cnt = (r && cheapest) ? Math.floor(TravelCore.toLocal(10000, r) / cheapest.price) : 0;
      return '<tr><th scope="row">' + c.flag + ' ' + c.name + '</th><td>' +
        (r ? fmtLocal(TravelCore.toLocal(10000, r), c.ccy) + ' ' + c.ccyShort : '—') + '</td><td>' +
        (cnt ? cheapest.emoji + ' ' + cheapest.name + ' ' + cnt.toLocaleString('ko-KR') + cheapest.unit : '—') + '</td></tr>';
    }).join('');
  }

  /* ── 입력 바인딩 ───────────────────────────────────── */
  function init() {
    // 나라 버튼
    var grid = $('countryGrid');
    C.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ctry'; b.dataset.id = c.id;
      b.innerHTML = '<span aria-hidden="true">' + c.flag + '</span> ' + c.name;
      b.addEventListener('click', function () { state.country = c.id; save(); render(); });
      grid.appendChild(b);
    });

    // 입력값 복원
    LC.setMoney($('budget'), state.budget || 500000);
    $('nights').value = state.nights || 3;
    $('deduct').checked = !!state.deduct;
    LC.setMoney($('flight'), state.flight || 0);
    LC.setMoney($('hotel'), state.hotel || 0);
    toggleDeduct();

    LC.bindMoney($('budget'));
    LC.bindMoney($('flight'));
    LC.bindMoney($('hotel'));

    LC.bindChips($('budgetChips'), function (v) {
      state.budget = parseInt(v, 10) || 0;
      LC.setMoney($('budget'), state.budget);
      save(); render();
    });

    $('budget').addEventListener('input', function () { state.budget = LC.money($('budget')); save(); render(); });
    $('nights').addEventListener('input', function () {
      state.nights = Math.max(0, parseInt($('nights').value, 10) || 0);
      save(); render();
    });
    $('deduct').addEventListener('change', function () {
      state.deduct = $('deduct').checked; save(); toggleDeduct(); render();
    });
    $('flight').addEventListener('input', function () { state.flight = LC.money($('flight')); save(); render(); });
    $('hotel').addEventListener('input', function () { state.hotel = LC.money($('hotel')); save(); render(); });

    $('cartClear').addEventListener('click', function () {
      Object.keys(state.cart).forEach(function (k) {
        if (k.indexOf(state.country + ':') === 0) delete state.cart[k];
      });
      save(); renderCart(); render();
    });

    // URL 파라미터로 진입 (공유 링크)
    var pc = LC.param('c'), pb = LC.param('b'), pn = LC.param('n');
    if (pc && TravelCore.country(pc).id === pc) state.country = pc;
    if (pb) state.budget = Math.max(0, parseInt(pb, 10) || 0);
    if (pn != null) state.nights = Math.max(0, parseInt(pn, 10) || 0);

    LC.onShare($('shareBtn'), buildShare);
    loadRates();
    render();
    renderCompare();
  }

  function toggleDeduct() {
    $('deductFields').hidden = !state.deduct;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
