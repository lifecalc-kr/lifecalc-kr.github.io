/* 마진노트 — 배달앱 수수료·순수익 계산기
   2026년 11월 16일 확인 기준 요율 데이터.
   모든 요율은 "부가세 별도"로 고지된 값을 그대로 담고, 부가세는 계산 단계에서 더합니다. */
(function () {
  'use strict';

  // ── 매출 구간 (배민배달·쿠팡이츠 배달 공통 구조) ──────────────────────────
  // 중개이용료 %, 사장님 부담 배달비(지역별, 배민 고지 기준)
  var TIERS = [
    {
      id: 't1',
      label: '상위 35% 이내 · 신규 입점',
      short: '상위 35%',
      fee: 7.8,
      delivery: { seoul: 3400, incheon: 3300, metro: 3100, etc: 3000, pohang: 2400 }
    },
    {
      id: 't2',
      label: '35% 초과 ~ 50%',
      short: '35~50%',
      fee: 6.8,
      delivery: { seoul: 3100, incheon: 3000, metro: 2800, etc: 2700, pohang: 2100 }
    },
    {
      id: 't3',
      label: '50% 초과 ~ 80%',
      short: '50~80%',
      fee: 6.8,
      delivery: { seoul: 2900, incheon: 2800, metro: 2600, etc: 2500, pohang: 1900 }
    },
    {
      id: 't4',
      label: '80% 초과 ~ 100%',
      short: '80~100%',
      fee: 2.0,
      delivery: { seoul: 2900, incheon: 2800, metro: 2600, etc: 2500, pohang: 1900 }
    }
  ];

  var REGIONS = [
    { id: 'seoul', label: '서울 · 경기 주요 시', note: '고양·성남·수원·용인·화성 등' },
    { id: 'incheon', label: '인천', note: '' },
    { id: 'metro', label: '부산·대구·광주·대전·세종', note: '경기 안성·동두천·여주·포천 포함' },
    { id: 'etc', label: '그 외 지역', note: '울산·제주, 강원·경남·경북·전남·전북·충남·충북 일부' },
    { id: 'pohang', label: '경북 포항 · 경남 양산', note: '' }
  ];

  // ── 플랫폼 ────────────────────────────────────────────────────────────
  var PLATFORMS = {
    baemin: {
      id: 'baemin',
      name: '배민',
      full: '배달의민족',
      services: [
        {
          id: 'delivery',
          name: '배민배달',
          alias: '구 배민1플러스',
          kind: 'tier',
          delivery: 'region',
          feeBase: 'after',
          desc: '배민 라이더가 배달. 중개이용료는 매출 구간별 2.0~7.8%.'
        },
        {
          id: 'pickup',
          name: '픽업',
          alias: '구 포장주문',
          kind: 'fixed',
          fee: 6.8,
          delivery: 0,
          feeBase: 'after',
          desc: '고객이 매장에서 픽업. 2025년 4월 14일부터 6.8% 유료.'
        }
      ],
      pgDefault: 3.0,
      pgPresets: [
        { v: 3.0, label: '일반 3.0%' },
        { v: 1.4, label: '3억↓ 1.40%' },
        { v: 2.0, label: '5억↓ 2.00%' },
        { v: 2.15, label: '10억↓ 2.15%' },
        { v: 2.4, label: '30억↓ 2.40%' }
      ],
      pgTitle: '결제정산수수료',
      pgNote: '일반 3.0%. 연매출 3억 이하 1.40%, 3~5억 2.00%, 5~10억 2.15%, 10~30억 2.40% (VAT 별도). 우대는 카드 결제분에만 적용됩니다.',
      feeBaseNote: '배민은 사장님 부담 할인액을 수수료 산정에서 제외합니다. 2026년 11월 12일 배달팁 할인까지 공제하는 약관 개정을 예고했습니다.'
    },
    coupang: {
      id: 'coupang',
      name: '쿠팡이츠',
      full: '쿠팡이츠',
      services: [
        {
          id: 'delivery',
          name: '배달',
          alias: '상생요금제',
          kind: 'tier',
          delivery: 'region',
          feeBase: 'before',
          desc: '쿠팡이츠 배달. 1구간 7.8%로 정산 후 매월 차액 환급.'
        },
        {
          id: 'pickup',
          name: '포장',
          alias: '2026.4.1부터 6.8%',
          kind: 'fixed',
          fee: 6.8,
          delivery: 0,
          feeBase: 'before',
          desc: '2026년 4월 1일부터 6.8%. 전통시장·하위 20%는 2027년 3월까지 무료.'
        },
        {
          id: 'pickupFree',
          name: '포장 (영세 무료)',
          alias: '하위 20% · 전통시장',
          kind: 'fixed',
          fee: 0,
          delivery: 0,
          feeBase: 'before',
          desc: '매출 하위 20% 이하·전통시장은 중개이용료 100% 환급(2027년 3월 31일까지).'
        }
      ],
      pgDefault: 3.0,
      pgPresets: [{ v: 3.0, label: '결제대행 3.0%' }],
      pgTitle: '결제대행 수수료',
      pgNote: '주문금액의 3% (VAT 별도). 영세·중소 가맹점은 우대수수료율이 적용되고 차액이 환급됩니다.',
      feeBaseNote: '쿠팡이츠 약관은 수수료 산정 기준을 "할인 전 판매가"로 정하고 있습니다. 공정위가 2026년 10월 27일 이 조항에 시정명령을 내려 60일 안에 개정해야 합니다.'
    },
    yogiyo: {
      id: 'yogiyo',
      name: '요기요',
      full: '요기요',
      services: [
        {
          id: 'delivery',
          name: '요기배달',
          alias: '라이더 배달',
          kind: 'rate',
          delivery: 2900,
          feeBase: 'after',
          desc: '요기요 라이더가 배달. 주문건당 배달대행 이용료 2,900원 별도.'
        },
        {
          id: 'pickup',
          name: '포장',
          alias: '고객 픽업',
          kind: 'fixed',
          fee: 7.7,
          delivery: 0,
          feeBase: 'after',
          desc: '포장 주문 중개이용료 7.7%. 배달비는 없습니다.'
        }
      ],
      rates: [
        { v: 9.7, label: '라이트 9.7% (기본)' },
        { v: 8.7, label: '성과 인하 8.7%' },
        { v: 7.7, label: '성과 인하 7.7%' },
        { v: 4.7, label: '성과 인하 최저 4.7%' }
      ],
      membershipExtra: 1.2,
      pgDefault: 3.3,
      pgPresets: [
        { v: 3.3, label: '참고 3.3%' },
        { v: 3.0, label: '3.0%' },
        { v: 2.0, label: '2.0%' },
        { v: 1.4, label: '1.4%' }
      ],
      pgTitle: '외부 결제 이용료',
      pgNote: '연간 매출 구간에 따라 우대가 적용됩니다. 카드사·계약 조건에 따라 다르므로 3.3%는 참고 기본값입니다 (VAT 별도).',
      feeBaseNote: '요기요는 프랜차이즈 본사·사장님 부담 할인을 제외한 금액에 주문중개·외부결제 이용료를 부과합니다.'
    }
  };

  // 배달앱 3사와 함께 비교할 때 쓰는 행 순서
  var COMPARE_ROWS = [
    { platform: 'baemin', service: 'delivery' },
    { platform: 'baemin', service: 'pickup' },
    { platform: 'coupang', service: 'delivery' },
    { platform: 'coupang', service: 'pickup' },
    { platform: 'yogiyo', service: 'delivery' },
    { platform: 'yogiyo', service: 'pickup' }
  ];

  window.FEE_DATA = {
    meta: {
      checkedOn: '2026-11-16',
      label: '2026년 11월 기준',
      vatRate: 0.1,
      saleVatDivisor: 11, // 음식값에 포함된 매출 부가세 = 금액 / 11
      sources: [
        { name: '배민 입점 안내(요금제)', url: 'https://ols.baemin.com/' },
        { name: '배민외식업광장 요금 안내', url: 'https://ceo.baemin.com/guide/12699' },
        { name: '쿠팡이츠 사장님 요금제', url: 'https://store.coupangeats.com/merchant/app/fee' },
        { name: '요기요 입점 안내', url: 'https://partner.yogiyo.co.kr/partner' },
        { name: '요기요 정산 안내', url: 'https://partner.yogiyo.co.kr/guide/pay' }
      ]
    },
    tiers: TIERS,
    regions: REGIONS,
    platforms: PLATFORMS,
    compareRows: COMPARE_ROWS
  };
})();
