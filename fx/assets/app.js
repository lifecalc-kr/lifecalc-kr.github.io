/*!
 * 글로벌 환율 레이더 — 전세계 실시간 환율 계산기
 * · 기준 환율: open.er-api.com (exchangerate-api.com, 무료·무키·CORS 허용) 166개 통화
 * · 2차 소스: api.frankfurter.dev (ECB 기준, 29개 통화) → 실패 시 내장 스냅샷/캐시
 * · 모든 계산은 브라우저에서만 이루어지며 입력값은 어디에도 전송되지 않습니다.
 */
(function () {
  'use strict';

  var DATA = window.CURRENCY_DATA;
  if (!DATA || !DATA.list || !DATA.list.length) return;

  var LIST = DATA.list;
  var BY = Object.create(null);
  LIST.forEach(function (c) { BY[c.code] = c; });

  /* 1원당 각 통화(스냅샷) — 오프라인 기준값 */
  var SNAP = Object.create(null);
  LIST.forEach(function (c) { SNAP[c.code] = c.krw; });

  var API_PRIMARY = 'https://open.er-api.com/v6/latest/KRW';
  var API_BACKUP = 'https://api.frankfurter.dev/v1/latest?from=KRW';

  var MAJOR = ['USD', 'JPY', 'EUR', 'CNY', 'VND', 'THB', 'PHP', 'IDR', 'MYR', 'SGD', 'TWD', 'HKD',
    'GBP', 'AUD', 'CAD', 'CHF', 'NZD', 'AED', 'MXN', 'INR', 'TRY', 'RUB', 'BRL', 'ZAR'];

  /* 검색 보조 키워드 (흔히 쓰는 우리말 이름) */
  var ALIAS = {
    USD: '달러 불 미쿡 미국돈 usdollar dollar', JPY: '엔 엔화 일본돈 백엔', EUR: '유로 유로화 유럽돈',
    CNY: '위안 런민비 인민폐 중국돈', CNH: '역외위안', VND: '동 베트남돈', THB: '바트 태국돈',
    PHP: '페소 필리핀돈', IDR: '루피아 인도네시아돈', MYR: '링깃 말레이시아돈', SGD: '싱가폴 싱가포르',
    TWD: '대만 타이완 대만돈', HKD: '홍콩 홍콩돈', GBP: '파운드 영국돈', AUD: '호주 오스트레일리아',
    CAD: '캐나다 캐나다돈', CHF: '스위스 프랑', KHR: '리엘 캄보디아돈', MMK: '짯 미얀마돈',
    LAK: '킵 라오스돈', MNT: '투그릭 몽골돈', KZT: '텡게 카자흐', RUB: '루블 러시아돈',
    INR: '루피 인도돈', NPR: '네팔', PKR: '파키스탄', LKR: '스리랑카', BDT: '방글라데시',
    AED: '디르함 두바이', SAR: '리얄 사우디', QAR: '카타르', KWD: '쿠웨이트', BHD: '바레인',
    OMR: '오만', JOD: '요르단', ILS: '셰켈 이스라엘', TRY: '리라 터키 튀르키예',
    EGP: '이집트 파운드', ZAR: '랜드 남아공', BRL: '헤알 브라질', MXN: '멕시코 페소',
    ARS: '아르헨티나', CLP: '칠레', COP: '콜롬비아', PEN: '솔 페루', UYU: '우루과이',
    NZD: '뉴질랜드', FJD: '피지', SEK: '크로네 스웨덴', NOK: '크로네 노르웨이', DKK: '크로네 덴마크',
    PLN: '즈워티 폴란드', CZK: '코루나 체코', HUF: '포린트 헝가리', RON: '레우 루마니아',
    BGN: '레프 불가리아', HRK: '쿠나 크로아티아', ISK: '아이슬란드', UAH: '흐리우냐 우크라이나',
    GEL: '라리 조지아', AMD: '드람 아르메니아', AZN: '마나트 아제르바이잔', UZS: '숨 우즈베키스탄',
    KGS: '솜 키르기스', TJS: '소모니 타지키스탄', TMT: '마나트 투르크멘', AFN: '아프가니',
    IQD: '디나르 이라크', IRR: '리알 이란', SYP: '시리아', LBP: '레바논', YER: '예멘',
    KES: '실링 케냐', TZS: '탄자니아', UGX: '우간다', GHS: '세디 가나', NGN: '나이라 나이지리아',
    ETB: '비르 에티오피아', MAD: '디르함 모로코', TND: '디나르 튀니지', XOF: '서아프리카 CFA',
    XAF: '중앙아프리카 CFA', XPF: 'CFP 프랑', XCD: '동카리브', XDR: 'SDR 특별인출권'
  };

  /* 환전 수단별 스프레드 기본값 (참고용 · 모두 수정 가능) */
  var PRESETS = [
    { id: 'mid', name: '시장 기준 환율', s: 0, hint: '스프레드 없음' },
    { id: 'travel', name: '트래블카드·토스뱅크', s: 0, hint: '주요 통화 충전 0% 우대' },
    { id: 'bankapp', name: '은행 앱 (우대 90%)', s: 0.18, hint: '모바일 환전' },
    { id: 'counter', name: '은행 창구 현찰', s: 1.75, hint: '현찰 살 때' },
    { id: 'wallet', name: '트래블월렛 기타 통화', s: 1.0, hint: '주요 3통화 외' },
    { id: 'airport', name: '공항 환전소', s: 4.5, hint: '현장 환전' }
  ];

  var REGIONS = ['전체', '동남아', '아시아', '유럽', '미주', '중동', '오세아니아', '아프리카']; 

  var LS = { watch: 'fxnote.watch.v1', rates: 'fxnote.rates.v1', state: 'fxnote.state.v1' };

  /* ── 상태 ───────────────────────────────────────────── */
  var S = {
    base: 'KRW',
    target: 'USD',
    amount: 1000000,
    mode: 'buy',
    spread: 0,
    presetId: 'mid',
    watch: ['USD', 'JPY', 'EUR', 'VND', 'THB', 'PHP', 'IDR', 'MYR', 'CNY', 'TWD', 'GBP', 'AUD', 'SGD', 'HKD', 'CAD', 'CHF'],
    region: '전체',
    query: ''
  };

  var R = {
    perKRW: assign({}, SNAP),
    at: new Date((DATA.meta.updatedUnix || 0) * 1000),
    source: 'snapshot',
    partial: true,
    loading: true
  };

  function assign(a, b) { for (var k in b) { a[k] = b[k]; } return a; }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function load(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

  (function restore() {
    var w = load(LS.watch);
    if (Array.isArray(w)) {
      S.watch = w.filter(function (c) { return BY[c]; }).slice(0, 40);
      if (!S.watch.length) S.watch = ['USD', 'JPY', 'EUR', 'VND'];
    }
    var st = load(LS.state);
    if (st) {
      if (BY[st.base]) S.base = st.base;
      if (BY[st.target]) S.target = st.target;
      if (typeof st.amount === 'number' && isFinite(st.amount)) S.amount = st.amount;
      if (st.mode === 'buy' || st.mode === 'sell') S.mode = st.mode;
      if (typeof st.spread === 'number' && st.spread >= 0 && st.spread <= 20) S.spread = st.spread;
      S.presetId = (st.presetId === undefined) ? null : st.presetId;
    }
  })();

  function persistState() {
    store(LS.state, { base: S.base, target: S.target, amount: S.amount, mode: S.mode, spread: S.spread, presetId: S.presetId });
  }

  /* ── 환율 계산 ──────────────────────────────────────── */
  function perK(code) {
    var v = R.perKRW[code];
    if (!v || !isFinite(v) || v <= 0) v = SNAP[code];
    return v || 1;
  }
  function krwOf(code) { return code === 'KRW' ? 1 : 1 / perK(code); }
  function rate(from, to) { return from === to ? 1 : perK(to) / perK(from); }

  /* 스프레드가 붙는 방향: 원화로 외화를 사는 쪽은 가산, 외화를 팔아 원화로 받는 쪽은 차감 */
  function spreadDir(from, to, mode) {
    if (to === 'KRW' && from !== 'KRW') return 'sell';
    if (from === 'KRW' && to !== 'KRW') return 'buy';
    return mode === 'sell' ? 'sell' : 'buy';
  }

  /* buy: 지금 통화로 상대 통화를 살 때(스프레드 가산) / sell: 상대 통화를 팔 때(차감) */
  function convert(amount, from, to, mode, spreadPct) {
    var r = rate(from, to);
    var s = (spreadPct || 0) / 100;
    if (!isFinite(r) || r <= 0 || !isFinite(amount)) return 0;
    return spreadDir(from, to, mode) === 'sell' ? amount * r * (1 - s) : amount * r / (1 + s);
  }

  /* ── 포맷 ───────────────────────────────────────────── */
  function num(v, minD, maxD) {
    if (!isFinite(v)) v = 0;
    return new Intl.NumberFormat('ko-KR', {
      minimumFractionDigits: Math.min(minD, maxD),
      maximumFractionDigits: maxD
    }).format(v);
  }
  function decimalsFor(code, v) {
    var d = (BY[code] && BY[code].dec != null) ? BY[code].dec : 2;
    var a = Math.abs(v);
    if (a > 0 && a < 1) return a < 0.01 ? 6 : 4;
    return d;
  }
  function fmtMoney(v, code) {
    var d = decimalsFor(code, v);
    return num(v, d === 0 ? 0 : Math.min(d, 2), d);
  }
  function fmtKrw(v) {
    var a = Math.abs(v);
    var d = a >= 1000 ? 0 : a >= 1 ? 2 : 4;
    return num(v, d === 0 ? 0 : 2, d);
  }
  /* 환율 표기: 1,336.90원 처럼 소수 둘째 자리까지 */
  function fmtRate(v) {
    var a = Math.abs(v);
    if (a >= 100000) return num(v, 0, 0);
    if (a >= 1) return num(v, 2, 2);
    return num(v, 0, 4);
  }
  function kst(d) {
    try {
      var p = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(d);
      var o = {};
      p.forEach(function (x) { o[x.type] = x.value; });
      return o.year + '.' + o.month + '.' + o.day + ' ' + o.hour + ':' + o.minute;
    } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
  }
  function shortKst(d) {
    var full = kst(d);
    return full.slice(5); // MM.DD HH:MM
  }
  function ago(d) {
    var ms = Date.now() - d.getTime();
    if (!isFinite(ms) || ms < 0) return '방금';
    var m = Math.round(ms / 60000);
    if (m < 2) return '방금 전';
    if (m < 60) return m + '분 전';
    var h = Math.round(m / 60);
    if (h < 24) return h + '시간 전';
    var dd = Math.round(h / 24);
    return dd + '일 전';
  }

  /* ── DOM ────────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    statusPill: $('statusPill'), statusText: $('statusText'),
    ticker: $('ticker'),
    segBuy: $('segBuy'), segSell: $('segSell'),
    amount: $('amountInput'),
    baseBtn: $('baseBtn'), targetBtn: $('targetBtn'),
    basePanel: $('basePanel'), targetPanel: $('targetPanel'),
    swap: $('swapBtn'),
    outValue: $('outValue'), outCode: $('outCode'),
    rateText: $('rateText'), feeTag: $('feeTag'),
    copyBtn: $('copyBtn'), refreshBtn: $('refreshBtn'), shareBtn: $('shareBtn'),
    chips: $('amountChips'),
    presets: $('presets'), spreadInput: $('spreadInput'), modeNote: $('modeNote'),
    board: $('board'), addBtn: $('addBtn'),
    cmpTitle: $('cmpTitle'), cmpBody: $('cmpBody'), cmpFoot: $('cmpFoot'),
    search: $('rateSearch'), rfilters: $('regionFilters'), rateBody: $('rateBody'),
    count: $('rateCount'), sourceText: $('sourceText'),
    addModal: $('addModal'), addSearch: $('addSearch'), addList: $('addList'), addClose: $('addClose')
  };

  function flag(c) { return (BY[c] && BY[c].flag) || '🏳️'; }
  function codeName(c) { return BY[c] ? BY[c].ko : c; }

  /* ── 상태 표시 ──────────────────────────────────────── */
  function renderStatus() {
    var p = el.statusPill, t = el.statusText;
    var srcLabel = { 'er-api': 'exchangerate-api.com', ecb: 'ECB 기준', cache: '저장된 환율', snapshot: '내장 기준 환율' }[R.source] || R.source;

    if (R.loading) {
      p.className = 'status-pill';
      t.textContent = '환율 불러오는 중…';
      p.title = '실시간 환율을 요청하고 있습니다.';
      return;
    }
    if (R.source === 'er-api' && !R.partial) {
      p.className = 'status-pill live';
      t.textContent = '실시간 · 기준 ' + shortKst(R.at);
      p.title = '출처 ' + srcLabel + ' · 기준 시각 ' + kst(R.at) + ' (KST, ' + ago(R.at) + ')';
    } else if (R.source === 'ecb') {
      p.className = 'status-pill stale';
      t.textContent = 'ECB 기준 · ' + shortKst(R.at);
      p.title = '기본 API 응답이 없어 ECB 고시 환율(29개 통화)로 표시 중입니다. 나머지 통화는 스냅샷 기준값입니다.';
    } else {
      p.className = 'status-pill stale';
      t.textContent = '기준 환율 · ' + shortKst(R.at);
      p.title = '네트워크 또는 API 응답이 없어 ' + (R.source === 'cache' ? '마지막으로 저장된 환율' : '사이트에 내장된 기준 환율') +
        '(' + kst(R.at) + ' KST 스냅샷)로 표시 중입니다.';
    }
  }

  function setSourceText() {
    if (!el.sourceText) return;
    var txt = {
      'er-api': '출처 exchangerate-api.com (open.er-api.com) · 기준 시각 ' + kst(R.at) + ' KST',
      ecb: '출처 ECB (frankfurter.dev) · 기준일 ' + kst(R.at) + ' KST',
      cache: '저장된 환율 · 기준 시각 ' + kst(R.at) + ' KST (' + ago(R.at) + ')',
      snapshot: '내장 기준 환율 · 기준 시각 ' + kst(R.at) + ' KST (오프라인 기준값)'
    }[R.source];
    el.sourceText.textContent = txt || '';
  }

  /* ── 티커 ───────────────────────────────────────────── */
  var TICK = [['USD', 1], ['JPY', 100], ['EUR', 1], ['VND', 100], ['CNY', 1], ['THB', 1], ['GBP', 1]];

  function renderTicker() {
    if (!el.ticker) return;
    el.ticker.innerHTML = TICK.map(function (t) {
      var c = t[0], unit = t[1];
      if (!BY[c]) return '';
      var v = krwOf(c) * unit;
      return '<span class="tick">' + flag(c) + ' <b>' + c + '</b><span>' + fmtRate(v) + '원' +
        (unit > 1 ? '<span style="color:#9aa8bb;font-weight:600;font-size:11px">/' + unit + '</span>' : '') +
        '</span></span>';
    }).join('');
  }

  /* ── 통화 선택 패널 ─────────────────────────────────── */
  function sortForList(list) {
    return list.slice().sort(function (a, b) {
      var ia = MAJOR.indexOf(a.code), ib = MAJOR.indexOf(b.code);
      if (ia < 0) ia = 999; if (ib < 0) ib = 999;
      if (ia !== ib) return ia - ib;
      return a.code < b.code ? -1 : 1;
    });
  }

  function haystack(c) {
    return (c.code + ' ' + c.ko + ' ' + c.en + ' ' + c.country + ' ' + c.countryEn + ' ' + c.group + ' ' + (ALIAS[c.code] || '')).toLowerCase();
  }
  function matches(c, q) {
    if (!q) return true;
    var parts = q.toLowerCase().replace(/[,·]/g, ' ').split(/\s+/).filter(Boolean);
    var hay = haystack(c);
    return parts.every(function (p) { return hay.indexOf(p) >= 0; });
  }

  function Picker(panel, opts) {
    var input = panel.querySelector('.picker-search input');
    var filterWrap = panel.querySelector('.picker-filters');
    var listEl = panel.querySelector('.picker-list');
    var trigger = opts.trigger;
    var st = { q: '', region: '전체', active: 0, items: [] };

    if (filterWrap) {
      filterWrap.innerHTML = REGIONS.map(function (r) {
        return '<button type="button" data-region="' + r + '" aria-pressed="' + (r === '전체') + '">' + r + '</button>';
      }).join('');
      filterWrap.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-region]');
        if (!b) return;
        st.region = b.dataset.region;
        Array.prototype.forEach.call(filterWrap.querySelectorAll('button'), function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        render();
      });
    }

    function render() {
      var list = opts.source ? opts.source() : LIST;
      st.items = sortForList(list.filter(function (c) {
        if (st.region !== '전체' && c.group !== st.region) return false;
        return matches(c, st.q);
      }));
      if (st.active >= st.items.length) st.active = 0;
      if (!st.items.length) {
        listEl.innerHTML = '<li class="picker-empty">검색 결과가 없어요. 통화 코드(예: USD)나 국가명으로 다시 찾아보세요.</li>';
        return;
      }
      listEl.innerHTML = st.items.map(function (c, i) {
        var sel = opts.isSelected && opts.isSelected(c.code);
        return '<li><button type="button" role="option" data-code="' + c.code + '"' +
          ' aria-selected="' + (sel ? 'true' : 'false') + '"' +
          ' class="' + (i === st.active ? 'active' : '') + '">' +
          '<span class="fl">' + c.flag + '</span>' +
          '<span class="meta"><b>' + c.code + ' · ' + c.ko + '</b><span>' + c.country + ' · ' + c.en + '</span></span>' +
          '<span class="val">' + (c.code === 'KRW' ? '기준' : fmtRate(krwOf(c.code)) + '원') + '</span>' +
          '</button></li>';
      }).join('');
    }

    function open() {
      closeOthers(panel);
      panel.classList.add('open');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      st.q = ''; st.active = 0;
      if (input) input.value = '';
      render();
      if (input) setTimeout(function () { input.focus(); }, 30);
    }
    function close() {
      panel.classList.remove('open');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
    function isOpen() { return panel.classList.contains('open'); }

    if (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        isOpen() ? close() : open();
      });
    }
    if (input) {
      input.addEventListener('input', function () {
        st.q = input.value.trim(); st.active = 0; render();
      });
    }
    listEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button[data-code]');
      if (!b) return;
      opts.onSelect(b.dataset.code);
      close();
    });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); if (trigger) trigger.focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!st.items.length) return;
        st.active = (st.active + (e.key === 'ArrowDown' ? 1 : -1) + st.items.length) % st.items.length;
        var nodes = listEl.querySelectorAll('button[data-code]');
        Array.prototype.forEach.call(nodes, function (n, i) { n.classList.toggle('active', i === st.active); });
        if (nodes[st.active]) nodes[st.active].scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter') {
        var node = st.items[st.active];
        if (node) { e.preventDefault(); opts.onSelect(node.code); close(); }
      }
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    panel._close = close;
    return { open: open, close: close, isOpen: isOpen, refresh: render };
  }

  var pickers = [];
  function closeOthers(except) {
    pickers.forEach(function (p) { if (p.__panel !== except) p.close(); });
    var m = el.addModal;
    if (m && !m.hidden) m.hidden = true;
  }
  function registerPicker(p, panel) { p.__panel = panel; pickers.push(p); return p; }

  var basePicker = registerPicker(Picker(el.basePanel, {
    trigger: el.baseBtn,
    isSelected: function (c) { return c === S.base; },
    onSelect: function (c) { S.base = c; onBaseChange(); }
  }), el.basePanel);

  var targetPicker = registerPicker(Picker(el.targetPanel, {
    trigger: el.targetBtn,
    isSelected: function (c) { return c === S.target; },
    onSelect: function (c) { S.target = c; persistState(); renderAll(); }
  }), el.targetPanel);

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.picker') && !e.target.closest('#addModal')) closeOthers(null);
  });

  /* ── 금액 입력 ──────────────────────────────────────── */
  function parseAmount(str) {
    var n = parseFloat(String(str).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  }
  function formatAmountInput() {
    var raw = el.amount.value.replace(/[^\d.]/g, '');
    var parts = raw.split('.');
    var ip = parts[0].replace(/^0+(?=\d)/, '').slice(0, 15);
    var s = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts.length > 1) s += '.' + parts[1].slice(0, 4);
    el.amount.value = s;
  }
  if (el.amount) {
    el.amount.addEventListener('input', function () {
      formatAmountInput();
      S.amount = parseAmount(el.amount.value);
      persistState();
      renderConverter();
      renderBoard();
      renderCompare();
    });
    el.amount.addEventListener('focus', function () { el.amount.select && el.amount.select(); });
  }

  /* ── 모드 · 스프레드 ────────────────────────────────── */
  function setMode(mode) {
    S.mode = mode;
    el.segBuy.setAttribute('aria-selected', String(mode === 'buy'));
    el.segSell.setAttribute('aria-selected', String(mode === 'sell'));
    if (mode === 'sell' && S.base === 'KRW' && S.target !== 'KRW') { var t = S.base; S.base = S.target; S.target = t; }
    if (mode === 'buy' && S.target === 'KRW' && S.base !== 'KRW') { var t2 = S.base; S.base = S.target; S.target = t2; }
    persistState();
    renderAll();
  }
  if (el.segBuy) el.segBuy.addEventListener('click', function () { setMode('buy'); });
  if (el.segSell) el.segSell.addEventListener('click', function () { setMode('sell'); });

  function setSpread(v, presetId) {
    v = Math.max(0, Math.min(20, Math.round(v * 100) / 100));
    S.spread = v;
    S.presetId = (presetId === undefined || presetId === null) ? null : presetId;
    if (el.spreadInput && document.activeElement !== el.spreadInput) el.spreadInput.value = String(v);
    persistState();
    renderConverter();
    renderBoard();
    renderCompare();
  }
  if (el.spreadInput) {
    el.spreadInput.addEventListener('input', function () {
      var v = parseFloat(el.spreadInput.value);
      setSpread(isFinite(v) ? v : 0);
    });
    el.spreadInput.addEventListener('blur', function () { el.spreadInput.value = String(S.spread); });
  }
  function renderPresets() {
    if (!el.presets) return;
    el.presets.innerHTML = PRESETS.map(function (p) {
      var on = S.presetId ? p.id === S.presetId : (Math.abs(p.s - S.spread) < 0.001 && false);
      return '<button type="button" data-id="' + p.id + '" data-s="' + p.s + '" aria-pressed="' + on + '" title="' + p.hint + '">' +
        p.name + (p.s > 0 ? ' ' + p.s + '%' : '') + '</button>';
    }).join('');
  }
  if (el.presets) {
    el.presets.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-s]');
      if (!b) return;
      setSpread(parseFloat(b.dataset.s), b.dataset.id);
    });
  }


  /* ── 변환기 렌더 ────────────────────────────────────── */
  function setCurBtn(btn, code) {
    if (!btn) return;
    var c = BY[code] || { code: code, ko: code, flag: '🏳️' };
    btn.innerHTML = '<span class="fl">' + c.flag + '</span><span class="cd">' + c.code + '</span>' +
      '<span class="nm">' + c.ko + '</span><span class="car">▾</span>';
  }

  function renderConverter() {
    setCurBtn(el.baseBtn, S.base);
    setCurBtn(el.targetBtn, S.target);
    el.amount.value = S.amount ? num(S.amount, 0, 4) : '';

    var out = convert(S.amount, S.base, S.target, S.mode, S.spread);
    el.outValue.textContent = fmtMoney(out, S.target);
    el.outCode.textContent = S.target;

    var r = rate(S.base, S.target);
    var unitKrw = krwOf(S.target);
    var dir = spreadDir(S.base, S.target, S.mode);
    var spreadTxt = S.spread > 0
      ? (dir === 'sell' ? '−' : '+') + S.spread + '% 반영'
      : '수수료 미반영';

    var html;
    if (S.target === 'KRW') {
      html = '1 ' + S.base + ' = <b>' + fmtRate(krwOf(S.base)) + '원</b>';
    } else {
      html = '1 ' + S.target + ' = <b>' + fmtRate(unitKrw) + '원</b>';
      if (S.base !== 'KRW') {
        html += ' · 1 ' + S.base + ' = <b>' + fmtMoney(r, S.target) + ' ' + S.target + '</b>';
      }
    }
    el.rateText.innerHTML = html;
    if (el.modeNote) {
      el.modeNote.textContent = dir === 'sell'
        ? '외화를 팔 때는 기준 환율에서 스프레드를 뺀 값으로 계산합니다.'
        : '외화를 살 때는 기준 환율에 스프레드를 더한 값으로 계산합니다.';
    }
    if (el.feeTag) {
      el.feeTag.textContent = spreadTxt;
      el.feeTag.className = 'tag' + (S.spread > 0 ? '' : ' zero');
    }
    renderChips();
    renderPresets();
  }

  function renderChips() {
    if (!el.chips) return;
    var vals = S.base === 'KRW' ? [10000, 100000, 500000, 1000000, 5000000] : [10, 100, 500, 1000, 5000];
    el.chips.innerHTML = vals.map(function (v) {
      var label = S.base === 'KRW' ? (v >= 10000 ? (v / 10000) + '만' : num(v, 0, 0))
        : (v >= 1000 ? (v / 1000) + '천' : num(v, 0, 0));
      return '<button type="button" data-amt="' + v + '">' + label + (S.base === 'KRW' ? '원' : ' ' + S.base) + '</button>';
    }).join('');
  }
  if (el.chips) {
    el.chips.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-amt]');
      if (!b) return;
      S.amount = parseFloat(b.dataset.amt);
      persistState();
      renderConverter(); renderBoard(); renderCompare();
    });
  }

  function onBaseChange() {
    if (S.base === S.target) {
      S.target = S.base === 'KRW' ? 'USD' : 'KRW';
    }
    if (S.mode === 'buy' && S.base !== 'KRW' && S.target !== 'KRW') { /* 교차 환율 허용 */ }
    persistState();
    renderAll();
  }

  if (el.swap) {
    el.swap.addEventListener('click', function () {
      var t = S.base; S.base = S.target; S.target = t;
      persistState();
      renderAll();
      el.swap.blur();
    });
  }
  if (el.copyBtn) {
    el.copyBtn.addEventListener('click', function () {
      var out = convert(S.amount, S.base, S.target, S.mode, S.spread);
      var text = num(S.amount, 0, 4) + ' ' + S.base + ' = ' + fmtMoney(out, S.target) + ' ' + S.target +
        ' (기준 ' + kst(R.at) + ' KST' + (S.spread > 0 ? ', 스프레드 ' + S.spread + '%' : '') + ')';
      var done = function () {
        el.copyBtn.textContent = '복사됨 ✓';
        setTimeout(function () { el.copyBtn.textContent = '결과 복사'; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
      } else { fallbackCopy(text, done); }
    });
  }
  if (el.shareBtn) {
    el.shareBtn.addEventListener('click', function () {
      if (!window.LCShare) return;
      var out = convert(S.amount, S.base, S.target, S.mode, S.spread);
      var line = num(S.amount, 0, 4) + ' ' + S.base + ' = ' + fmtMoney(out, S.target) + ' ' + S.target +
        ' (기준 ' + kst(R.at) + ' KST' + (S.spread > 0 ? ', 스프레드 ' + S.spread + '%' : '') + ')';
      LCShare.share({
        title: '전세계 실시간 환율 계산기 — 글로벌 환율 레이더',
        text: line + '\n166개국 통화를 한 번에, 지금 환율로 계산해 봐!',
        url: location.href.split('#')[0]
      }, el.shareBtn);
    });
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ── 동시 비교 보드 ─────────────────────────────────── */
  var CC_LIMIT = 24;
  function renderBoard() {
    if (!el.board) return;
    el.board.innerHTML = S.watch.map(function (code) {
      var c = BY[code];
      if (!c) return '';
      var out = convert(S.amount, S.base, code, S.mode, S.spread);
      var midOut = convert(S.amount, S.base, code, S.mode, 0);
      var diff = midOut - out;
      return '<div class="cc" role="button" tabindex="0" data-code="' + code + '" aria-label="' + c.ko + '로 계산">' +
        '<button type="button" class="cc-x" data-remove="' + code + '" aria-label="' + c.ko + ' 보드에서 빼기">×</button>' +
        '<span class="cc-top"><span class="fl">' + c.flag + '</span><span class="cd">' + c.code + '</span>' +
        '<span class="nm">' + c.ko + '</span></span>' +
        '<span class="cc-val">' + fmtMoney(out, code) + '<small>' + c.code + '</small></span>' +
          '<span class="cc-rate">' + (code === 'KRW'
            ? '대한민국 원 · 기준 통화'
            : '1 ' + c.code + ' = <b>' + fmtRate(krwOf(code)) + '원</b>') + '</span>' +
        (S.spread > 0 && diff > 0
          ? '<span class="cc-fee">수수료 반영 −' + fmtMoney(diff, code) + ' ' + c.code + '</span>'
          : '') +
        '</div>';
    }).join('');
  }
  if (el.board) {
    el.board.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-remove]');
      if (rm) {
        e.stopPropagation();
        var code = rm.dataset.remove;
        S.watch = S.watch.filter(function (c) { return c !== code; });
        store(LS.watch, S.watch);
        renderBoard();
        return;
      }
      var card = e.target.closest('.cc');
      if (!card) return;
      S.target = card.dataset.code;
      persistState();
      renderAll();
      document.querySelector('.conv').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    el.board.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.cc');
      if (!card) return;
      e.preventDefault();
      S.target = card.dataset.code;
      persistState(); renderAll();
    });
  }

  /* ── 통화 추가 모달 ─────────────────────────────────── */
  function renderAddList() {
    if (!el.addList) return;
    var q = (el.addSearch.value || '').trim();
    var list = sortForList(LIST.filter(function (c) {
      if (S.watch.indexOf(c.code) >= 0) return false;
      return matches(c, q);
    })).slice(0, 80);
    if (!list.length) {
      el.addList.innerHTML = '<li class="picker-empty">추가할 통화가 없어요. 이미 모두 보드에 있거나 검색 결과가 없습니다.</li>';
      return;
    }
    el.addList.innerHTML = list.map(function (c) {
      return '<li><button type="button" data-add="' + c.code + '">' +
        '<span class="fl">' + c.flag + '</span>' +
        '<span class="meta"><b>' + c.code + ' · ' + c.ko + '</b><span>' + c.country + ' · ' + c.en + '</span></span>' +
        '<span class="val">' + (c.code === 'KRW' ? '기준' : fmtRate(krwOf(c.code)) + '원') + '</span></button></li>';
    }).join('');
  }
  if (el.addBtn) {
    el.addBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeOthers(null);
      el.addModal.hidden = false;
      el.addSearch.value = '';
      renderAddList();
      setTimeout(function () { el.addSearch.focus(); }, 40);
    });
  }
  if (el.addClose) el.addClose.addEventListener('click', function () { el.addModal.hidden = true; });
  if (el.addModal) {
    el.addModal.addEventListener('click', function (e) {
      if (e.target === el.addModal) el.addModal.hidden = true;
    });
  }
  if (el.addSearch) el.addSearch.addEventListener('input', renderAddList);
  if (el.addList) {
    el.addList.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button[data-add]');
      if (!b) return;
      var code = b.dataset.add;
      if (S.watch.indexOf(code) < 0 && S.watch.length < CC_LIMIT) S.watch.push(code);
      store(LS.watch, S.watch);
      renderBoard();
      renderAddList();
    });
  }

  /* ── 실구매 금액 비교 ───────────────────────────────── */
  function renderCompare() {
    if (!el.cmpBody) return;
    var target = S.target !== 'KRW' ? S.target : 'USD';
    var krwBudget = S.base === 'KRW' ? S.amount : S.amount * rate(S.base, 'KRW');
    el.cmpTitle.textContent = num(Math.round(krwBudget), 0, 0) + '원으로 ' + codeName(target) + ' 살 때';

    var mid = krwBudget * rate('KRW', target);
    var rows = PRESETS.slice().sort(function (a, b) { return a.s - b.s; }).map(function (p) {
      var got = krwBudget * rate('KRW', target) / (1 + p.s / 100);
      var loss = mid - got;
      return { p: p, got: got, loss: loss };
    });
    var real = rows.filter(function (r) { return r.p.id !== 'mid'; });
    var best = Math.max.apply(null, real.map(function (r) { return r.got; }));

    el.cmpBody.innerHTML = rows.map(function (r) {
      var isBest = r.p.id !== 'mid' && Math.abs(r.got - best) < 1e-9;
      return '<tr' + (isBest ? ' class="best"' : '') + '>' +
        '<td>' + r.p.name + '<span class="cmp-sp">' + (r.p.s ? r.p.s + '%' : '0%') + '</span>' +
        (isBest ? ' <span class="badge-best">최대</span>' : '') + '</td>' +
        '<td class="num">' + (r.p.s ? r.p.s + '%' : '0%') + '</td>' +
        '<td class="num">' + fmtMoney(r.got, target) + ' <span style="color:#8b9bb2;font-weight:600">' + target + '</span></td>' +
        '<td class="num ' + (r.loss > 0.5 ? 'loss' : '') + '">' + (r.loss > 0.5 ? '−' + fmtMoney(r.loss, target) : '—') + '</td>' +
        '</tr>';
    }).join('');

    if (el.cmpFoot) {
      el.cmpFoot.textContent = '기준 환율로 받는 금액은 ' + fmtMoney(mid, target) + ' ' + target +
        '입니다. 스프레드는 금융사 고시 우대율에 따라 달라지므로 아래 값을 참고해 직접 조정하세요.';
    }
  }

  /* ── 전체 환율 표 ───────────────────────────────────── */
  function renderRateTable() {
    if (!el.rateBody) return;
    var q = S.query;
    var list = sortForList(LIST.filter(function (c) {
      if (S.region !== '전체' && c.group !== S.region) return false;
      return matches(c, q);
    }));
    el.rateBody.innerHTML = list.map(function (c) {
      var krw = krwOf(c.code);
      return '<tr data-code="' + c.code + '" title="' + c.ko + '로 계산하기">' +
        '<td><div class="cur"><span class="fl">' + c.flag + '</span><span><b>' + c.code + '</b> ' +
        '<span class="sub">' + c.ko + '</span></span></div></td>' +
        '<td class="mid">' + (c.code === 'KRW' ? '1원' : fmtRate(krw) + '원') + '</td>' +
        '<td>' + (c.code === 'KRW' ? '1,000,000원' : fmtMoney(1000000 * rate('KRW', c.code), c.code)) + '</td>' +
        '</tr>';
    }).join('');
    if (el.count) {
      el.count.textContent = list.length + '개 통화 · ' + (R.source === 'er-api' ? '실시간 기준' : '기준 환율') + ' · ' + shortKst(R.at) + ' KST';
    }
  }
  if (el.search) {
    el.search.addEventListener('input', function () {
      S.query = el.search.value.trim();
      renderRateTable();
    });
  }
  if (el.rfilters) {
    el.rfilters.innerHTML = ['전체', '동남아', '아시아', '유럽', '미주', '오세아니아', '아프리카'].map(function (r) {
      return '<button type="button" data-region="' + r + '" aria-pressed="' + (r === '전체') + '">' + r + '</button>';
    }).join('');
    el.rfilters.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-region]');
      if (!b) return;
      S.region = b.dataset.region;
      Array.prototype.forEach.call(el.rfilters.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderRateTable();
    });
  }
  if (el.rateBody) {
    el.rateBody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-code]');
      if (!tr) return;
      var code = tr.dataset.code;
      if (code === S.base) return;
      S.target = code;
      persistState();
      renderAll();
      document.querySelector('.conv').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ── 네트워크 ───────────────────────────────────────── */
  function getJSON(url, ms) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var done = false;
      var timer = setTimeout(function () { done = true; if (ctrl) ctrl.abort(); reject(new Error('timeout')); }, ms || 9000);
      var opts = { cache: 'no-store', credentials: 'omit', mode: 'cors' };
      if (ctrl) opts.signal = ctrl.signal;
      fetch(url, opts).then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      }).then(function (json) {
        if (done) return;
        clearTimeout(timer); resolve(json);
      }).catch(function (err) {
        if (done) return;
        clearTimeout(timer); reject(err);
      });
    });
  }

  function saveCache() {
    try {
      store(LS.rates, { at: R.at.toISOString(), source: R.source, perKRW: R.perKRW });
    } catch (e) {}
  }

  function applyLive(j) {
    if (!j || j.result !== 'success' || !j.rates) throw new Error('bad payload');
    var p = {};
    for (var k in j.rates) {
      var v = j.rates[k];
      if (typeof v === 'number' && isFinite(v) && v > 0) p[k] = v;
    }
    p.KRW = 1;
    if (Object.keys(p).length < 100) throw new Error('too few rates');
    R.perKRW = p;
    R.source = 'er-api';
    R.partial = false;
    R.at = j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000) : new Date();
    saveCache();
  }

  function applyEcb(j) {
    if (!j || !j.rates) throw new Error('bad payload');
    var p = assign({}, SNAP);
    var n = 0;
    for (var k in j.rates) {
      var v = j.rates[k];
      if (typeof v === 'number' && isFinite(v) && v > 0) { p[k] = v; n++; }
    }
    if (!n) throw new Error('empty');
    p.KRW = 1;
    R.perKRW = p;
    R.source = 'ecb';
    R.partial = true;
    R.at = j.date ? new Date(j.date + 'T00:00:00Z') : new Date();
    saveCache();
  }

  function applyFallback() {
    var cached = load(LS.rates);
    if (cached && cached.perKRW) {
      R.perKRW = cached.perKRW;
      R.at = new Date(cached.at || Date.now());
      R.source = 'cache';
    } else {
      R.perKRW = assign({}, SNAP);
      R.at = new Date((DATA.meta.updatedUnix || 0) * 1000);
      R.source = 'snapshot';
    }
    R.partial = true;
  }

  function loadRates() {
    R.loading = true;
    renderStatus();
    if (el.refreshBtn) el.refreshBtn.classList.add('spinning');
    var finish = function () {
      R.loading = false;
      if (el.refreshBtn) el.refreshBtn.classList.remove('spinning');
      renderStatus();
      renderTicker();
      renderAll();
    };
    if (navigator.onLine === false) { applyFallback(); finish(); return; }
    getJSON(API_PRIMARY, 9000)
      .then(applyLive)
      .catch(function () { return getJSON(API_BACKUP, 9000).then(applyEcb); })
      .catch(function () { applyFallback(); })
      .then(finish, finish);
  }
  if (el.refreshBtn) el.refreshBtn.addEventListener('click', loadRates);

  /* ── 전체 렌더 ──────────────────────────────────────── */
  function renderAll() {
    renderConverter();
    renderBoard();
    renderCompare();
    renderRateTable();
    setSourceText();
  }

  /* 초기 실행 */
  el.segBuy.setAttribute('aria-selected', String(S.mode === 'buy'));
  el.segSell.setAttribute('aria-selected', String(S.mode === 'sell'));
  if (el.spreadInput) el.spreadInput.value = String(S.spread);
  renderTicker();
  renderAll();
  renderStatus();
  loadRates();

  setInterval(function () {
    if (document.visibilityState === 'visible') loadRates();
  }, 15 * 60 * 1000);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Date.now() - R.at.getTime() > 30 * 60 * 1000) loadRates();
  });

  /* 다른 곳에서 환율 데이터를 읽을 수 있게 (디버그/검증용) */
  window.HWANUL = {
    state: S, rates: R,
    convert: convert, krwOf: krwOf, rate: rate, load: loadRates
  };
})();
