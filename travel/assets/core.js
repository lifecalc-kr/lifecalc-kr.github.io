/* ═══════════════════════════════════════════════════════════════
   트래블노트 — 해외 여행물가 환산기 (계산 코어, DOM 없음)
   · 국가별 대표 체감 물가 데이터 (2025~2026 실제 시세 조사 기준)
   · 예산 → 현지 통화 환산 → 항목별 "몇 개 먹/타볼 수 있나" 계산
   · 가격은 대표 관광지 평균 기준이며 상점·지역에 따라 다를 수 있음
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TravelCore = {};

  /* ── 국가·항목 데이터 ─────────────────────────────────
     price: 현지 통화 가격(대표값) · range: 조사된 현실 범위 안내문
     unit: 공유 문구에 쓰는 단위 · taxi/transit: 교통 항목 플래그 */
  TravelCore.COUNTRIES = [
    {
      id: 'vietnam', name: '베트남', flag: '🇻🇳', city: '호치민·다낭',
      ccy: 'VND', ccyName: '베트남 동', ccyShort: '동',
      items: [
        { id: 'pho',    name: '쌀국수(포)',              emoji: '🍜', price: 55000,  unit: '그릇', taxi: false, range: '로컬 전문점 40,000~70,000동' },
        { id: 'buncha', name: '분짜',                    emoji: '🥩', price: 60000,  unit: '인분', taxi: false, range: '유명 로컬 매장 50,000~70,000동' },
        { id: 'banhxeo',name: '반쎄오',                  emoji: '🥞', price: 45000,  unit: '인분', taxi: false, range: '로컬 식당 35,000~60,000동' },
        { id: 'banhmi', name: '반미 바게트',             emoji: '🥖', price: 27000,  unit: '개',   taxi: false, range: '길거리 22,000~40,000동' },
        { id: 'cong',   name: '콩카페 코코넛 커피 스무디', emoji: '🥥', price: 59000,  unit: '잔',   taxi: false, range: '콩카페 55,000~69,000동' },
        { id: 'grabbike', name: '그랩 바이크 3km',        emoji: '🏍️', price: 25000,  unit: '번',   taxi: true,  range: '도심 15,000~40,000동' },
        { id: 'grabcar',  name: '그랩카·택시 5km',        emoji: '🚕', price: 60000,  unit: '번',   taxi: true,  range: '기본 2km 25,000동 + km당 9,000동' },
        { id: 'massage',  name: '로컬 마사지 60분',       emoji: '💆', price: 150000, unit: '회',   taxi: false, range: '로컬 10만~중급 스파 45만동' },
        { share: false, id: 'transit',  name: '대중교통(버스·메트로) 1회', emoji: '🚌', price: 8000, unit: '회',   taxi: false, range: '버스 7,000동 · 메트로 1호선 6,000~20,000동' }
      ]
    },
    {
      id: 'japan', name: '일본', flag: '🇯🇵', city: '도쿄·오사카',
      ccy: 'JPY', ccyName: '일본 엔', ccyShort: '엔',
      items: [
        { id: 'sushi',  name: '회전초밥 1접시(2피스)', emoji: '🍣', price: 150,  unit: '접시', taxi: false, range: '스시로 등 110~300엔' },
        { id: 'ramen',  name: '라멘',                  emoji: '🍜', price: 900,  unit: '그릇', taxi: false, range: '이치란 등 600~1,200엔' },
        { id: 'gacha',  name: '가챠(캡슐토이) 1회',    emoji: '🎰', price: 400,  unit: '회',   taxi: false, range: '200~500엔' },
        { id: 'bento',  name: '편의점 도시락',         emoji: '🍱', price: 600,  unit: '개',   taxi: false, range: '500~700엔' },
        { id: 'onigiri',name: '편의점 삼각김밥(오니기리)', emoji: '🍙', price: 150, unit: '개', taxi: false, range: '130~230엔' },
        { id: 'beer',   name: '생맥주·하이볼 1잔',     emoji: '🍺', price: 500,  unit: '잔',   taxi: false, range: '이자카야 400~700엔' },
        { share: false, id: 'metro',  name: '지하철 1회',            emoji: '🚇', price: 180,  unit: '회',   taxi: false, range: '도쿄 메트로 170~250엔' },
        { id: 'taxi',   name: '택시 기본요금',         emoji: '🚕', price: 500,  unit: '회',   taxi: true,  range: '도쿄·오사카 500~600엔' },
        { id: 'donki',  name: '돈키호테 쇼핑 바구니',  emoji: '🛍️', price: 2000, unit: '바구니', taxi: false, range: '과자·화장품 소파 1,000~3,000엔' }
      ]
    },
    {
      id: 'thailand', name: '태국', flag: '🇹🇭', city: '방콕',
      ccy: 'THB', ccyName: '태국 바트', ccyShort: '바트',
      items: [
        { id: 'padthai', name: '팟타이',            emoji: '🍤', price: 100, unit: '접시', taxi: false, range: '로컬 60~200바트' },
        { id: 'khao',    name: '카오맨가이',        emoji: '🍗', price: 80,  unit: '그릇', taxi: false, range: '50~120바트' },
        { id: 'mangosticky', name: '땡모반',        emoji: '🥭', price: 70,  unit: '컵',   taxi: false, range: '시장 50~90바트' },
        { id: 'massage', name: '타이마사지 60분',   emoji: '💆', price: 350, unit: '회',   taxi: false, range: '로컬 250~600바트' },
        { id: 'tuktuk',  name: '툭툭 짧은 거리',    emoji: '🛺', price: 100, unit: '번',   taxi: true,  range: '흥정 필요 · 50~300바트' },
        { id: 'grab',    name: '그랩카 5km',        emoji: '🚕', price: 120, unit: '번',   taxi: true,  range: '기본 45바트 · 5km 100~150바트' },
        { share: false, id: 'bts',     name: 'BTS·MRT 1회',       emoji: '🚈', price: 32,  unit: '회',   taxi: false, range: 'BTS 17~47바트 · MRT 15~40바트' },
        { id: 'beer',    name: '싱하 맥주 1캔',     emoji: '🍺', price: 60,  unit: '캔',   taxi: false, range: '편의점 55~90바트' }
      ]
    },
    {
      id: 'philippines', name: '필리핀', flag: '🇵🇭', city: '세부·마닐라',
      ccy: 'PHP', ccyName: '필리핀 페소', ccyShort: '페소',
      items: [
        { id: 'jollibee', name: '졸리비 치킨 세트',   emoji: '🍗', price: 180,  unit: '세트', taxi: false, range: '치킨+밥+음료 180~250페소' },
        { id: 'mangoshake', name: '망고 쉐이크',       emoji: '🥤', price: 180,  unit: '잔',   taxi: false, range: '120~250페소' },
        { id: 'beefnoodle', name: '소고기 국수(비프 파레스)', emoji: '🍜', price: 150, unit: '그릇', taxi: false, range: '로컬 100~250페소' },
        { share: false, id: 'jeepney', name: '지프니·버스 1회',     emoji: '🚌', price: 15,   unit: '회',   taxi: false, range: '기차·지프니 기본 13~15페소' },
        { id: 'grab',    name: '그랩·택시 5km',       emoji: '🚕', price: 160,  unit: '번',   taxi: true,  range: '그랩 기본 50페소 · 택시 5km 약 150페소' },
        { id: 'tricycle',name: '트라이시클 짧은 거리', emoji: '🛺', price: 80,   unit: '번',   taxi: true,  range: '50~150페소 · 탑승 전 협상 필수' },
        { id: 'bbq',     name: '길거리 바비큐 꼬치',  emoji: '🍢', price: 30,   unit: '개',   taxi: false, range: '20~100페소' },
        { id: 'beer',    name: '산미구엘 맥주 1캔',   emoji: '🍺', price: 70,   unit: '캔',   taxi: false, range: '60~90페소' },
        { id: 'hopping', name: '호핑투어(1인)',       emoji: '⛵', price: 2500, unit: '회',   taxi: false, range: '푸에르토프린세사 2,000~3,500페소' }
      ]
    },
    {
      id: 'taiwan', name: '대만', flag: '🇹🇼', city: '타이베이',
      ccy: 'TWD', ccyName: '대만 달러', ccyShort: '위안',
      items: [
        { id: 'beefnoodle', name: '우육면',             emoji: '🍜', price: 180, unit: '그릇', taxi: false, range: '유명 맛집 120~250위안' },
        { id: 'mangoshave', name: '망고빙수',           emoji: '🥭', price: 200, unit: '그릇', taxi: false, range: '4천~8천원(약 150~280위안)' },
        { id: 'bubbletea',  name: '버블티',             emoji: '🧋', price: 55,  unit: '잔',   taxi: false, range: '35~80위안' },
        { id: 'jipai',      name: '야시장 지파이(튀김닭)', emoji: '🍗', price: 80, unit: '개',  taxi: false, range: '스린 야시장 60~120위안' },
        { id: 'xiaolongbao',name: '샤오롱바오(5개)',     emoji: '🥟', price: 180, unit: '주문', taxi: false, range: '딘타이펑 기준 150~220위안' },
        { share: false, id: 'mrt',        name: 'MRT 1회',            emoji: '🚇', price: 25,  unit: '회',   taxi: false, range: '기본 20~65위안 · 버스 15위안' },
        { id: 'taxi',       name: '택시 기본요금',       emoji: '🚕', price: 100, unit: '회',   taxi: true,  range: '기본 약 85~125위안' },
        { id: 'taipei101',  name: '타이베이101 전망대',  emoji: '🏙️', price: 600, unit: '회',  taxi: false, range: '성인 600위안' }
      ]
    },
    {
      id: 'hongkong', name: '홍콩·마카오', flag: '🇭🇰', city: '홍콩섬·침사추이',
      ccy: 'HKD', ccyName: '홍콩 달러', ccyShort: '홍콩달러',
      items: [
        { id: 'dimsum',  name: '딤섬(하가우 등 1접시)', emoji: '🥟', price: 38,  unit: '접시', taxi: false, range: '딤딤섬 등 28~50홍콩달러' },
        { id: 'wonton',  name: '완탕면',               emoji: '🍜', price: 50,  unit: '그릇', taxi: false, range: '40~70홍콩달러' },
        { id: 'milktea', name: '홍콩식 밀크티',        emoji: '🥛', price: 20,  unit: '잔',   taxi: false, range: '차찬텡 15~30홍콩달러' },
        { id: 'egtart',  name: '에그타르트',           emoji: '🥧', price: 12,  unit: '개',   taxi: false, range: '타이청 베이커리 등 10~15홍콩달러' },
        { id: 'mtr',     name: 'MTR 1회',              emoji: '🚇', price: 12,  unit: '회',   taxi: false, range: '기본 4.5~13홍콩달러' },
        { share: false, id: 'tram',    name: '트램(딩딩) 1회',       emoji: '🚋', price: 3.3, unit: '회',   taxi: false, range: '균일요금 3.3홍콩달러' },
        { share: false, id: 'ferry',   name: '스타페리 1회',         emoji: '⛴️', price: 5,   unit: '회',   taxi: false, range: '4~6.5홍콩달러' },
        { id: 'taxi',    name: '택시 기본요금(첫 2km)', emoji: '🚕', price: 29, unit: '회',   taxi: true,  range: '도시택시 29홍콩달러' }
      ]
    },
    {
      id: 'singapore', name: '싱가포르', flag: '🇸🇬', city: '마리나베이·차이나타운',
      ccy: 'SGD', ccyName: '싱가포르 달러', ccyShort: '달러',
      items: [
        { id: 'chickenrice', name: '하이난 치킨라이스', emoji: '🍗', price: 5,   unit: '그릇', taxi: false, range: '호커센터 3.5~7달러' },
        { id: 'laksa',       name: '락사',              emoji: '🍜', price: 5,   unit: '그릇', taxi: false, range: '4~7달러' },
        { id: 'kaya',        name: '카야토스트 세트',   emoji: '🍞', price: 5.6, unit: '세트', taxi: false, range: '야쿤 5.6~6.3달러' },
        { id: 'kopi',        name: '코피·테타릭(커피·밀크티)', emoji: '☕', price: 1.8, unit: '잔', taxi: false, range: '호커센터 1.5~2달러' },
        { id: 'satay',       name: '사테 10꼬치',       emoji: '🍢', price: 10,  unit: '접시', taxi: false, range: '라우파삿 10달러 내외' },
        { share: false, id: 'mrt',         name: 'MRT 1회',           emoji: '🚇', price: 1.5, unit: '회',   taxi: false, range: '0.95~2.21달러 · 버스 0.88~2.10달러' },
        { id: 'grab',        name: '그랩 5km',          emoji: '🚕', price: 12,  unit: '번',   taxi: true,  range: '도심 8~15달러' },
        { id: 'taxi',        name: '택시 기본요금',     emoji: '🚖', price: 4.8, unit: '회',   taxi: true,  range: '기본 4.4~5.2달러' }
      ]
    },
    {
      id: 'usa', name: '미국·괌', flag: '🇺🇸', city: '괌 투몬·LA',
      ccy: 'USD', ccyName: '미국 달러', ccyShort: '달러',
      items: [
        { id: 'bigmac',  name: '빅맥 세트',            emoji: '🍔', price: 11, unit: '개',   taxi: false, range: '괌 기준 약 9~13달러' },
        { id: 'lunch',   name: '캐주얼 점심 1인',      emoji: '🥗', price: 20, unit: '끼',   taxi: false, range: '레스토랑 점심 15~30달러' },
        { id: 'dinner',  name: '레스토랑 디너+팁',     emoji: '🍽️', price: 40, unit: '회',   taxi: false, range: '디너 30~50달러 + 팁 15~20%' },
        { id: 'latte',   name: '스타벅스 라떼',        emoji: '☕', price: 6,  unit: '잔',   taxi: false, range: '5~7달러' },
        { id: 'taxi5',   name: '택시 5km',             emoji: '🚕', price: 20, unit: '번',   taxi: true,  range: '기본 2.4달러 · 단거리도 10달러 이상 잦음' },
        { id: 'taxibase',name: '택시 기본요금',        emoji: '🚖', price: 3,  unit: '회',   taxi: true,  range: '기본 2.4~4달러' },
        { share: false, id: 'trolley', name: '트롤리·셔틀버스 1회',  emoji: '🚌', price: 7,  unit: '회',   taxi: false, range: '괌 레드트롤리 1회 7달러 · 1일권 10~15달러' },
        { id: 'chamorro',name: '타클롯 플레이트(야시장)', emoji: '🍢', price: 10, unit: '접시', taxi: false, range: '차모로 빌리지 6~12달러' }
      ]
    },
    {
      id: 'europe', name: '서유럽', flag: '🇪🇺', city: '파리·로마',
      ccy: 'EUR', ccyName: '유로', ccyShort: '유로',
      items: [
        { id: 'pizza',   name: '마르게리타 피자 1판', emoji: '🍕', price: 10,  unit: '판',   taxi: false, range: '8~15유로' },
        { id: 'pasta',   name: '파스타 1인분',        emoji: '🍝', price: 14,  unit: '그릇', taxi: false, range: '캐주얼 8~18유로' },
        { id: 'pizzaSlice', name: '조각 피자',        emoji: '🍕', price: 4,   unit: '조각', taxi: false, range: '피자 알 탈리오 3~6유로' },
        { id: 'espresso',name: '에스프레소(바에서 서서)', emoji: '☕', price: 1.5, unit: '잔', taxi: false, range: '1~3유로 · 앉으면 3~4유로' },
        { id: 'gelato',  name: '젤라또 1컵',          emoji: '🍨', price: 3.5, unit: '컵',   taxi: false, range: '2.5~5유로' },
        { share: false, id: 'metro',   name: '지하철 1회권',        emoji: '🚇', price: 2,   unit: '회',   taxi: false, range: '파리 2.50 · 로마 1.50유로' },
        { id: 'taxi',    name: '택시 기본요금',       emoji: '🚕', price: 5,   unit: '회',   taxi: true,  range: '파리 4.1+최소 8유로 · 로마 4.5유로' },
        { id: 'museum',  name: '박물관 입장료',       emoji: '🖼️', price: 18,  unit: '회',   taxi: false, range: '주요 박물관 13~22유로' }
      ]
    }
  ];

  TravelCore.country = function (id) {
    for (var i = 0; i < TravelCore.COUNTRIES.length; i++) {
      if (TravelCore.COUNTRIES[i].id === id) return TravelCore.COUNTRIES[i];
    }
    return TravelCore.COUNTRIES[0];
  };

  /* ── 예산 계산 ───────────────────────────────────────
     budget: 총 예산(원) · flight/hotel: 차감할 항공·숙박비(원)
     nights: 박 수 → 일수 = 박+1 (최소 1일) */
  TravelCore.budget = function (state) {
    var budget = Math.max(0, state.budget || 0);
    var deduct = Math.max(0, state.flight || 0) + Math.max(0, state.hotel || 0);
    var stay = Math.max(0, budget - deduct);
    var days = Math.max(1, (state.nights || 0) + 1);
    return {
      days: days,
      total: stay,
      perDay: stay / days,
      deduct: deduct,
      input: budget
    };
  };

  /* ── 환산 ────────────────────────────────────────────
     rate: 1 KRW 당 현지 통화 (open.er-api.com 기준) */
  TravelCore.toLocal = function (krw, rate) { return (krw || 0) * (rate || 0); };
  TravelCore.toKRW = function (local, rate) {
    if (!rate) return 0;
    return (local || 0) / rate;
  };

  /* 항목별 "살 수 있는 개수" — 전체 체류 예산 기준 */
  TravelCore.counts = function (localBudget, items, custom) {
    return items.map(function (it) {
      var price = (custom && custom[it.id] != null) ? custom[it.id] : it.price;
      var count = price > 0 ? Math.floor(localBudget / price) : 0;
      return { id: it.id, name: it.name, emoji: it.emoji, price: price,
               count: count, unit: it.unit, taxi: !!it.taxi, share: it.share !== undefined ? !!it.share : true, range: it.range };
    });
  };

  /* ── 일정 시뮬레이터 (장바구니) ──────────────────────
     cart: [{id, qty}] · custom: {id: 현지 가격} */
  TravelCore.cartTotal = function (cart, items, custom) {
    var map = {};
    items.forEach(function (it) { map[it.id] = it; });
    var lines = [], local = 0;
    (cart || []).forEach(function (c) {
      var it = map[c.id];
      if (!it || !c.qty) return;
      var price = (custom && custom[it.id] != null) ? custom[it.id] : it.price;
      var sum = price * c.qty;
      local += sum;
      lines.push({ id: it.id, name: it.name, emoji: it.emoji, qty: c.qty, price: price, sum: sum, unit: it.unit });
    });
    return { lines: lines, local: local };
  };

  /* ── 공유 문구 ───────────────────────────────────────
     예: "내 예산 50만 원이면 베트남에서 쌀국수 9그릇+그랩 바이크 20번! 너도 계산해 봐!" */
  TravelCore.shareLine = function (countryName, budgetKRW, counts) {
    function manwon(n) {
      var w = n / 10000;
      return (w % 1 === 0 ? w : Math.round(w * 10) / 10) + '만 원';
    }
    var top = (counts || []).filter(function (c) { return c.count > 0 && c.share; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 2);
    if (!top.length) {
      top = (counts || []).filter(function (c) { return c.count > 0; })
        .sort(function (a, b) { return b.count - a.count; }).slice(0, 2);
    }
    if (!top.length) return '';
    var part = top.map(function (c) { return c.emoji + ' ' + c.name + ' ' + c.count + c.unit; }).join(' + ');
    return '내 예산 ' + manwon(budgetKRW) + '이면 ' + countryName + '에서 ' + part + '! 너도 계산해 봐!';
  };

  window.TravelCore = TravelCore;
})();
