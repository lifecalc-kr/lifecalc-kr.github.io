/* 마진노트 — 배달앱 수수료·순수익 계산기
   계산 엔진 + 화면 렌더링. 외부 라이브러리 없음. */
(function () {
  'use strict';

  var D = window.FEE_DATA;
  var STORE_KEY = 'margin-note.v1';

  var DEFAULTS = {
    platform: 'baemin',
    service: 'delivery',
    tier: 't1',
    region: 'seoul',
    orderAmount: 20000,
    costRate: 35,
    container: 500,
    discount: 0,
    pgRate: 3.0,
    deliveryOverride: null,
    yogiyoRate: 9.7,
    membership: false,
    feeBaseMode: 'platform',
    salesVat: false,
    monthlyOrders: 300
  };

  var state = Object.assign({}, DEFAULTS);

  // ── helpers ────────────────────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function won(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function pct(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function digits(v) { return String(v == null ? '' : v).replace(/[^\d]/g, ''); }
  function num(v) {
    var n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  // 입력 중인 칸은 건드리지 않고, 나머지만 현재 상태값으로 맞춘다.
  function syncVal(sel, val) {
    var el = $(sel);
    if (!el || el === document.activeElement) return;
    el.value = val;
  }
  function tierById(id) {
    for (var i = 0; i < D.tiers.length; i++) if (D.tiers[i].id === id) return D.tiers[i];
    return D.tiers[0];
  }
  function platformOf(id) { return D.platforms[id] || D.platforms.baemin; }
  function serviceOf(platformId, serviceId) {
    var list = platformOf(platformId).services;
    for (var i = 0; i < list.length; i++) if (list[i].id === serviceId) return list[i];
    return list[0];
  }
  function currentPlatform() { return platformOf(state.platform); }
  function currentService() { return serviceOf(state.platform, state.service); }

  // ── 계산 엔진 ──────────────────────────────────────────────────────────
  /* opts: platform, service, tier, region, orderAmount, costRate, container,
           discount, pgRate, yogiyoRate, membership, feeBaseMode, deliveryFee */
  function compute(opts) {
    var p = platformOf(opts.platform);
    var svc = serviceOf(opts.platform, opts.service);
    var tier = tierById(opts.tier);
    var price = Math.max(0, opts.orderAmount || 0);
    var discount = clamp(opts.discount || 0, 0, price);
    var net = price - discount;

    // 중개이용료율
    var rate;
    if (svc.kind === 'tier') {
      rate = tier.fee;
    } else if (svc.kind === 'rate') {
      rate = (opts.yogiyoRate || 9.7) + (opts.membership && p.membershipExtra ? p.membershipExtra : 0);
    } else {
      rate = svc.fee;
      if (opts.membership && p.membershipExtra) rate += p.membershipExtra;
    }

    // 사장님 부담 배달비
    var delivery = 0;
    if (svc.delivery === 'region') {
      delivery = (opts.deliveryFee == null) ? tier.delivery[opts.region] : opts.deliveryFee;
    } else {
      delivery = svc.delivery;
    }
    delivery = Math.max(0, delivery || 0);

    // 수수료 산정 기준 금액
    var mode = opts.feeBaseMode === 'platform' ? svc.feeBase : opts.feeBaseMode;
    var basis = mode === 'before' ? price : net;

    var commission = basis * rate / 100;
    var commissionVat = commission * 0.1;
    var pg = basis * (opts.pgRate || 0) / 100;
    var pgVat = pg * 0.1;
    var deliveryVat = delivery * 0.1;

    var feeExVat = commission + pg + delivery;
    var feeTotal = feeExVat + commissionVat + pgVat + deliveryVat;
    var platformRate = net > 0 ? feeTotal / net * 100 : 0;
    var settlement = net - feeTotal;

    var cost = price * (opts.costRate || 0) / 100;
    var container = Math.max(0, opts.container || 0);
    var profit = settlement - cost - container;

    var vatSale = net / D.meta.saleVatDivisor;
    var vatInput = commissionVat + pgVat + deliveryVat;
    var vatPayable = vatSale - vatInput;
    var profitAfterVat = profit - vatPayable;

    return {
      platformId: p.id,
      platformName: p.name,
      serviceId: svc.id,
      serviceName: svc.name,
      platform: p,
      service: svc,
      tier: tier,
      rate: rate,
      basisMode: mode,
      basis: basis,
      price: price,
      discount: discount,
      net: net,
      commission: commission,
      commissionVat: commissionVat,
      pg: pg,
      pgVat: pgVat,
      delivery: delivery,
      deliveryVat: deliveryVat,
      feeExVat: feeExVat,
      feeTotal: feeTotal,
      platformRate: platformRate,
      settlement: settlement,
      cost: cost,
      container: container,
      profit: profit,
      margin: net > 0 ? profit / net * 100 : 0,
      vatSale: vatSale,
      vatInput: vatInput,
      vatPayable: vatPayable,
      profitAfterVat: profitAfterVat,
      marginAfterVat: net > 0 ? profitAfterVat / net * 100 : 0
    };
  }

  // 선택된 플랫폼에 적용할 배달비(직접 수정값 우선)
  function deliveryFor(platformId, serviceId) {
    var svc = serviceOf(platformId, serviceId);
    if (svc.delivery !== 'region') return svc.delivery;
    if (platformId === state.platform && serviceId === state.service && state.deliveryOverride != null) {
      return state.deliveryOverride;
    }
    return tierById(state.tier).delivery[state.region];
  }

  function selected() {
    return compute({
      platform: state.platform,
      service: state.service,
      tier: state.tier,
      region: state.region,
      orderAmount: state.orderAmount,
      costRate: state.costRate,
      container: state.container,
      discount: state.discount,
      pgRate: state.pgRate,
      yogiyoRate: state.yogiyoRate,
      membership: state.membership,
      feeBaseMode: state.feeBaseMode,
      deliveryFee: deliveryFor(state.platform, state.service)
    });
  }

  function computeRow(platformId, serviceId) {
    var p = platformOf(platformId);
    var pg = platformId === state.platform ? state.pgRate : p.pgDefault;
    return compute({
      platform: platformId,
      service: serviceId,
      tier: state.tier,
      region: state.region,
      orderAmount: state.orderAmount,
      costRate: state.costRate,
      container: state.container,
      discount: state.discount,
      pgRate: pg,
      yogiyoRate: state.yogiyoRate,
      membership: state.membership,
      feeBaseMode: state.feeBaseMode,
      deliveryFee: deliveryFor(platformId, serviceId)
    });
  }

  // ── 저장 ──────────────────────────────────────────────────────────────
  function save() {
    try {
      var out = {};
      Object.keys(DEFAULTS).forEach(function (k) { out[k] = state[k]; });
      localStorage.setItem(STORE_KEY, JSON.stringify(out));
    } catch (e) { /* 저장 실패는 무시 */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var obj = JSON.parse(raw);
      Object.keys(DEFAULTS).forEach(function (k) {
        if (obj[k] !== undefined && obj[k] !== null) state[k] = obj[k];
        else if (k === 'deliveryOverride') state[k] = null;
      });
      if (!D.platforms[state.platform]) state.platform = DEFAULTS.platform;
      if (!serviceOf(state.platform, state.service)) state.service = platformOf(state.platform).services[0].id;
      if (!D.regions.some(function (r) { return r.id === state.region; })) state.region = DEFAULTS.region;
    } catch (e) { state = Object.assign({}, DEFAULTS); }
  }

  // ── 칩·셀렉트 구성 ────────────────────────────────────────────────────
  function buildChips(host, values, onPick, fmt) {
    host.innerHTML = values.map(function (v) {
      return '<button type="button" data-v="' + v + '">' + (fmt ? fmt(v) : won(v)) + '</button>';
    }).join('');
    host.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { onPick(num(b.getAttribute('data-v'))); });
    });
  }

  function buildPgChips() {
    var p = currentPlatform();
    var host = $('#pgChips');
    host.innerHTML = p.pgPresets.map(function (x) {
      return '<button type="button" data-v="' + x.v + '">' + x.label + '</button>';
    }).join('');
    host.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.pgRate = num(b.getAttribute('data-v'));
        $('#pgRate').value = state.pgRate;
        save(); render();
      });
    });
  }

  function buildServiceSeg() {
    var p = currentPlatform();
    var host = $('#serviceSeg');
    host.innerHTML = p.services.map(function (s) {
      var on = s.id === state.service;
      return '<button type="button" role="tab" aria-selected="' + on + '" data-service="' + s.id + '">' +
        s.name + '<span class="seg-sub">' + s.alias + '</span></button>';
    }).join('');
    host.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.service = b.getAttribute('data-service');
        state.deliveryOverride = null;
        save(); render();
      });
    });
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────
  var lastPlatform = null;

  function render() {
    var p = currentPlatform();
    var svc = currentService();

    // 플랫폼 탭
    $$('#platformSeg button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-platform') === state.platform));
    });

    if (lastPlatform !== state.platform) {
      buildServiceSeg();
      buildPgChips();
      lastPlatform = state.platform;
    } else {
      $$('#serviceSeg button').forEach(function (b) {
        b.setAttribute('aria-selected', String(b.getAttribute('data-service') === state.service));
      });
    }

    // 입력값 반영 (지금 입력 중인 칸은 유지)
    syncVal('#orderAmount', won(state.orderAmount));
    syncVal('#costRate', state.costRate);
    syncVal('#container', state.container);
    syncVal('#discount', state.discount);
    syncVal('#pgRate', state.pgRate);
    syncVal('#monthlyOrders', state.monthlyOrders);
    syncVal('#feeBase', state.feeBaseMode);
    $('#salesVat').checked = !!state.salesVat;
    $('#membership').checked = !!state.membership;

    // 구간 / 요율 / 지역 표시
    var isTier = svc.kind === 'tier';
    var isRate = svc.kind === 'rate';
    $('#tierField').hidden = !isTier;
    $('#rateField').hidden = !isRate;
    $('#fixedFeeField').hidden = isTier || isRate;
    $('#regionField').hidden = svc.delivery !== 'region';
    $('#membershipField').hidden = !(p.id === 'yogiyo');
    $('#tierSelect').value = state.tier;
    $('#regionSelect').value = state.region;
    $('#rateSelect').value = String(state.yogiyoRate);
    if (!isTier && !isRate) {
      $('#fixedFeeText').textContent = pct(svc.fee) + '%';
      $('#fixedFeeDesc').textContent = svc.desc;
    }

    // 배달비
    var dlv = deliveryFor(state.platform, state.service);
    var dlvInput = $('#deliveryFee');
    syncVal('#deliveryFee', won(dlv));
    var editable = svc.delivery === 'region';
    dlvInput.disabled = !editable;
    dlvInput.setAttribute('aria-readonly', String(!editable));
    var hint = $('#deliveryHint');
    if (svc.delivery === 'region') {
      hint.textContent = '지역·구간에 따라 자동 입력됩니다. 포털에 표시된 금액으로 고쳐도 됩니다.';
    } else if (svc.delivery === 0) {
      hint.textContent = '포장·픽업 주문은 배달비가 없습니다.';
    } else {
      hint.textContent = '요기배달은 주문건당 배달대행 이용료 2,900원이 고정입니다.';
    }

    // 설명 문구
    $('#pgNote').textContent = p.pgNote;
    $('#feeBaseNote').textContent = p.feeBaseNote;
    var basisNow = state.feeBaseMode === 'platform' ? svc.feeBase : state.feeBaseMode;
    $('#basisTag').textContent = basisNow === 'before' ? '할인 전 금액 기준' : '할인 후 금액 기준';

    renderResult(selected());
    renderCompare();
    renderTiers();
  }

  function renderResult(r) {
    var useVat = !!state.salesVat;
    var profit = useVat ? r.profitAfterVat : r.profit;
    var margin = useVat ? r.marginAfterVat : r.margin;

    $('#resLabel').textContent = useVat ? '매출 부가세까지 빼고 남는 돈' : '이 주문, 통장에 남는 돈';
    $('#resProfit').textContent = won(profit);
    $('#resProfit').classList.toggle('loss', profit < 0);
    $('#resMargin').innerHTML = '마진율 <b>' + pct(margin) + '%</b> <span>실결제 ' + won(r.net) + '원 기준</span>';
    $('#resFeeTotal').textContent = won(r.feeTotal) + '원';
    $('#resFeeRate').textContent = '실결제의 ' + pct(r.platformRate) + '%';

    // 경고
    var warn = $('#resWarn');
    if (profit < 0) {
      warn.hidden = false;
      warn.textContent = '이 주문은 남는 돈이 없습니다. 원가율·용기비·배달비를 확인해 보세요.';
    } else if (margin < 10) {
      warn.hidden = false;
      warn.textContent = '마진율이 10% 아래입니다. 할인과 배달비가 이 주문의 이익을 거의 다 먹고 있어요.';
    } else {
      warn.hidden = true;
      warn.textContent = '';
    }

    // 상세 내역
    var rows = [];
    if (r.discount > 0) {
      rows.push(rr('판매가 (메뉴 금액)', won(r.price)));
      rows.push(rr('사장님 부담 할인', '−' + won(r.discount), 'sub'));
      rows.push(rr('고객 실결제', won(r.net), 'strong'));
    } else {
      rows.push(rr('고객 결제 금액', won(r.net), 'strong'));
    }
    rows.push(rr(pgName() + ' 중개이용료 <em>' + pct(r.rate) + '%</em>', won(r.commission + r.commissionVat), 'fee'));
    rows.push(rr(platformOf(r.platformId).pgTitle + ' <em>' + pct(state.pgRate) + '%</em>', won(r.pg + r.pgVat), 'fee'));
    if (r.delivery > 0) rows.push(rr('사장님 부담 배달비', won(r.delivery + r.deliveryVat), 'fee'));
    rows.push(rr('플랫폼에 낸 돈 (VAT 포함)', won(r.feeTotal), 'total'));
    rows.push(rr('정산금 (통장 입금)', won(r.settlement), 'strong'));
    rows.push(rr('식자재 원가 <em>' + pct(state.costRate) + '%</em>', won(r.cost), ''));
    if (r.container > 0) rows.push(rr('포장·용기비', won(r.container), ''));
    if (useVat) {
      rows.push(rr('매출 부가세 − 매입 부가세', won(r.vatPayable), 'sub'));
    }
    rows.push(rr(useVat ? '세후 순수익' : '순수익', won(profit), 'profit'));
    $('#resRows').innerHTML = rows.join('');

    // 비율 바
    var parts = [
      { k: 'cost', v: Math.max(0, r.cost), label: '원가' },
      { k: 'fee', v: Math.max(0, r.feeTotal), label: '플랫폼' },
      { k: 'pack', v: Math.max(0, r.container), label: '용기' },
      { k: 'profit', v: Math.max(0, profit), label: '남는 돈' }
    ];
    var total = parts.reduce(function (s, x) { return s + x.v; }, 0) || 1;
    $('#resBar').innerHTML = parts.map(function (x) {
      if (x.v <= 0) return '';
      return '<span class="sb sb-' + x.k + '" style="width:' + (x.v / total * 100).toFixed(2) + '%"></span>';
    }).join('');
    $('#resLegend').innerHTML = parts.map(function (x) {
      return '<span><i class="dot ' + x.k + '"></i>' + x.label + ' ' + pct(x.v / total * 100) + '%</span>';
    }).join('');

    // 월 환산
    var monthly = profit * (state.monthlyOrders || 0);
    $('#resMonth').innerHTML = '월 <b>' + won(state.monthlyOrders) + '건</b>이면 <b>' +
      won(monthly) + '원</b> <span>(' + (profit < 0 ? '월 적자' : '월 순수익') + ')</span>';

    // 복사용 텍스트
    copyText = [
      '[마진노트] ' + r.platformName + ' ' + r.serviceName + ' · ' + r.tier.label,
      '주문 ' + won(r.price) + '원 / 할인 ' + won(r.discount) + '원 / 원가율 ' + pct(state.costRate) + '% / 용기비 ' + won(r.container) + '원',
      '중개이용료 ' + won(r.commission + r.commissionVat) + '원 · 결제 ' + won(r.pg + r.pgVat) + '원 · 배달비 ' + won(r.delivery + r.deliveryVat) + '원',
      '정산금 ' + won(r.settlement) + '원 → 순수익 ' + won(profit) + '원 (마진 ' + pct(margin) + '%)'
    ].join('\n');
  }

  function pgName() {
    var p = currentPlatform();
    return p.id === 'baemin' ? '배민' : (p.id === 'coupang' ? '쿠팡이츠' : '요기요');
  }

  function rr(label, value, cls) {
    return '<div class="rr ' + (cls || '') + '"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function renderCompare() {
    var rows = D.compareRows.map(function (row) {
      return { row: row, r: computeRow(row.platform, row.service) };
    });
    var best = rows.reduce(function (a, b) { return b.r.profit > a.r.profit ? b : a; }, rows[0]);
    $('#cmpBody').innerHTML = rows.map(function (x) {
      var r = x.r;
      var isBest = x === best && rows.length > 1;
      var isCurrent = x.row.platform === state.platform && x.row.service === state.service;
      return '<tr class="' + (isBest ? 'best' : '') + (isCurrent ? ' current' : '') + '">' +
        '<td><span class="ch-name">' + r.platformName + ' · <b>' + r.serviceName + '</b></span>' +
        (isCurrent ? '<span class="tag-now">지금 설정</span>' : '') +
        '<span class="cmp-sp">중개 ' + pct(r.rate) + '%</span></td>' +
        '<td class="num hide-sm">' + pct(r.rate) + '%</td>' +
        '<td class="num">' + won(r.feeTotal) + '</td>' +
        '<td class="num strong">' + won(r.profit) + (isBest ? '<span class="badge-best">최고</span>' : '') + '</td>' +
        '<td class="num">' + pct(r.margin) + '%</td>' +
        '</tr>';
    }).join('');
    $('#cmpFoot').textContent = '배달은 ' + tierById(state.tier).short + ' 구간, 결제수수료는 각 사 기본값, 배달비는 ' +
      D.regions.filter(function (x) { return x.id === state.region; })[0].label + ' 기준입니다. 포장·픽업은 배달비 0원.';
  }

  function renderTiers() {
    var pf = state.platform === 'yogiyo' ? 'baemin' : state.platform;
    $('#tierProfitHead').textContent = platformOf(pf).name + ' 순수익';
    var rows = D.tiers.map(function (t) {
      var r = compute({
        platform: pf, service: 'delivery', tier: t.id, region: state.region,
        orderAmount: state.orderAmount, costRate: state.costRate, container: state.container,
        discount: state.discount, pgRate: platformOf(pf).pgDefault, yogiyoRate: state.yogiyoRate,
        membership: false, feeBaseMode: state.feeBaseMode,
        deliveryFee: t.delivery[state.region]
      });
      var cur = t.id === state.tier && state.platform !== 'yogiyo';
      return '<tr class="' + (cur ? 'current' : '') + '">' +
        '<th scope="row">' + t.label + (cur ? '<span class="tag-now">내 구간</span>' : '') + '</th>' +
        '<td class="num">' + pct(t.fee) + '%<small class="only-sm">배달 ' + won(t.delivery[state.region]) + '</small></td>' +
        '<td class="num hide-sm">' + won(t.delivery[state.region]) + '</td>' +
        '<td class="num hide-sm">' + won(r.feeTotal) + '</td>' +
        '<td class="num">' + won(r.profit) + '<small>' + pct(r.margin) + '%</small></td>' +
        '</tr>';
    }).join('');
    $('#tierBody').innerHTML = rows;
  }

  // ── 이벤트 ────────────────────────────────────────────────────────────
  var copyText = '';

  function bind() {
    $$('#platformSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.platform = b.getAttribute('data-platform');
        state.service = platformOf(state.platform).services[0].id;
        state.pgRate = platformOf(state.platform).pgDefault;
        state.deliveryOverride = null;
        save(); render();
      });
    });

    var amount = $('#orderAmount');
    amount.addEventListener('input', function () {
      var d = digits(amount.value).slice(0, 9);
      state.orderAmount = d ? num(d) : 0;
      amount.value = d ? won(state.orderAmount) : '';
      save(); render();
    });

    $('#costRate').addEventListener('input', function () {
      state.costRate = clamp(num(this.value), 0, 100);
      save(); render();
    });
    $('#container').addEventListener('input', function () {
      state.container = clamp(num(this.value), 0, 100000);
      save(); render();
    });
    $('#discount').addEventListener('input', function () {
      state.discount = Math.max(0, num(this.value));
      save(); render();
    });
    $('#pgRate').addEventListener('input', function () {
      state.pgRate = Math.max(0, num(this.value));
      save(); render();
    });
    $('#monthlyOrders').addEventListener('input', function () {
      state.monthlyOrders = clamp(num(this.value), 0, 100000);
      save(); render();
    });

    $('#tierSelect').addEventListener('change', function () {
      state.tier = this.value;
      state.deliveryOverride = null;
      save(); render();
    });
    $('#regionSelect').addEventListener('change', function () {
      state.region = this.value;
      state.deliveryOverride = null;
      save(); render();
    });
    $('#rateSelect').addEventListener('change', function () {
      state.yogiyoRate = num(this.value);
      save(); render();
    });
    $('#deliveryFee').addEventListener('input', function () {
      if (this.disabled) return;
      state.deliveryOverride = clamp(num(this.value), 0, 20000);
      this.value = won(state.deliveryOverride);
      save(); render();
    });
    $('#membership').addEventListener('change', function () {
      state.membership = this.checked;
      save(); render();
    });
    $('#feeBase').addEventListener('change', function () {
      state.feeBaseMode = this.value;
      save(); render();
    });
    $('#salesVat').addEventListener('change', function () {
      state.salesVat = this.checked;
      save(); render();
    });

    buildChips($('#orderChips'), [10000, 15000, 20000, 25000, 30000, 40000], function (v) {
      state.orderAmount = v; save(); render();
    }, function (v) { return won(v) + '원'; });

    buildChips($('#costChips'), [25, 30, 35, 40, 45], function (v) {
      state.costRate = v; save(); render();
    }, function (v) { return v + '%'; });

    buildChips($('#containerChips'), [0, 300, 500, 800], function (v) {
      state.container = v; save(); render();
    }, function (v) { return v === 0 ? '없음' : won(v) + '원'; });

    buildChips($('#discountChips'), [0, 1000, 2000, 3000], function (v) {
      state.discount = v; save(); render();
    }, function (v) { return v === 0 ? '없음' : won(v) + '원'; });

    $('#copyBtn').addEventListener('click', function () {
      var btn = this;
      var done = function () {
        var old = btn.textContent;
        btn.textContent = '복사됨 ✓';
        setTimeout(function () { btn.textContent = old; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = copyText;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
        done();
      }
    });

    $('#resetBtn').addEventListener('click', function () {
      state = Object.assign({}, DEFAULTS);
      state.pgRate = platformOf(state.platform).pgDefault;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      lastPlatform = null;
      buildServiceSeg();
      buildPgChips();
      render();
    });
  }

  // ── 시작 ──────────────────────────────────────────────────────────────
  load();
  bind();
  render();

  window.MarginNote = {
    compute: compute,
    computeRow: computeRow,
    state: state,
    tiers: D.tiers,
    platforms: D.platforms,
    setState: function (patch) {
      Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
      state.deliveryOverride = patch.deliveryOverride === undefined ? null : patch.deliveryOverride;
      lastPlatform = null;
      buildServiceSeg();
      buildPgChips();
      render();
    },
    getState: function () { return JSON.parse(JSON.stringify(state)); }
  };
})();
