/* ═══════════════════════════════════════════════════════════════
   생활금융 계산기 연구소 — 공용 스크립트
   숫자 포맷 · 금액 입력 · 복사/공유 · 토스트 · 로컬 저장
   모든 계산은 이 브라우저 안에서만 이루어집니다.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LC = {};
  window.LC = LC;

  /* ── 숫자 ─────────────────────────────────────────── */
  LC.fmt = function (n) {
    if (!isFinite(n)) return '0';
    return Math.round(n).toLocaleString('ko-KR');
  };
  LC.won = function (n) { return LC.fmt(n) + '원'; };
  LC.num = function (input, fallback) {
    if (!input) return fallback || 0;
    var v = parseFloat(String(input.value).replace(/[^\d.-]/g, ''));
    return isFinite(v) ? v : (fallback || 0);
  };
  LC.clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
  LC.pct = function (v, digits) {
    var d = digits == null ? 1 : digits;
    return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace(/\.0$/, '') + '%';
  };

  /* ── 금액 입력 (콤마 자동) ────────────────────────── */
  LC.bindMoney = function (input) {
    if (!input || input.dataset.moneyBound) return;
    input.dataset.moneyBound = '1';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^\d]/g, '');
      if (raw.length > 12) raw = raw.slice(0, 12);
      if (raw === '') { input.value = ''; return; }
      var n = parseInt(raw, 10);
      input.value = n.toLocaleString('ko-KR');
    });
  };
  LC.money = function (input) {
    if (!input) return 0;
    var v = parseInt(String(input.value).replace(/[^\d]/g, ''), 10);
    return isFinite(v) ? v : 0;
  };
  LC.setMoney = function (input, n) {
    if (!input) return;
    input.value = Math.round(n).toLocaleString('ko-KR');
  };

  /* ── 텍스트 출력 ──────────────────────────────────── */
  function resolve(sel) {
    if (!sel) return null;
    if (typeof sel !== 'string') return sel;
    var byId = document.getElementById(sel);
    if (byId) return byId;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }
  LC.text = function (sel, value) {
    var el = resolve(sel);
    if (el) el.textContent = value;
  };
  LC.html = function (sel, value) {
    var el = resolve(sel);
    if (el) el.innerHTML = value;
  };
  LC.show = function (sel, on) {
    var el = resolve(sel);
    if (el) el.hidden = !on;
  };
  LC.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  LC.$ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ── 로컬 저장 (실패해도 계산은 계속) ─────────────── */
  var PREFIX = 'lifecalc.';
  LC.save = function (key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  };
  LC.load = function (key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  };

  /* ── 토스트 ───────────────────────────────────────── */
  var toastTimer = null;
  LC.toast = function (msg) {
    var el = document.getElementById('lcToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lcToast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  };

  /* ── 복사 ─────────────────────────────────────────── */
  LC.copy = function (text) {
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacy(); });
    }
    return Promise.resolve(legacy());
  };

  /* 결과 복사 버튼: data-copy-text 또는 콜백 */
  LC.onCopy = function (btn, getText, okMsg) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var text = typeof getText === 'function' ? getText() : getText;
      LC.copy(text).then(function (ok) {
        LC.toast(ok ? (okMsg || '결과를 복사했어요. 붙여넣기만 하세요!') : '복사가 막혀 있어요. 직접 선택해 주세요.');
        if (ok) flash(btn, '복사 완료!');
      });
    });
  };

  /* 공유: 모바일 네이티브 공유 → 실패하면 복사 */
  LC.onShare = function (btn, getPayload) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var p = typeof getPayload === 'function' ? getPayload() : getPayload;
      if (navigator.share) {
        navigator.share({ title: p.title || document.title, text: p.text, url: p.url || location.href })
          .then(function () { /* 공유 완료 */ })
          .catch(function (err) {
            if (err && err.name === 'AbortError') return; /* 사용자가 닫음 */
            LC.copy(p.text + '\n' + (p.url || location.href)).then(function (ok) {
              if (ok) LC.toast('공유가 안 돼서 문구를 복사했어요.');
            });
          });
      } else {
        LC.copy(p.text + '\n' + (p.url || location.href)).then(function (ok) {
          if (ok) { LC.toast('공유 문구를 복사했어요. 카톡에 붙여넣기!'); flash(btn, '복사 완료!'); }
        });
      }
    });
  };

  function flash(btn, label) {
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { btn.textContent = btn.dataset.label; }, 1600);
  }

  /* ── URL 파라미터 ─────────────────────────────────── */
  LC.param = function (name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  };
  LC.shareUrl = function (params) {
    try {
      var u = new URL(location.href);
      u.search = '';
      Object.keys(params || {}).forEach(function (k) {
        var v = params[k];
        if (v !== null && v !== undefined && v !== '') u.searchParams.set(k, v);
      });
      return u.toString();
    } catch (e) { return location.href; }
  };

  /* ── 숫자 칩 (빠른 선택) ──────────────────────────── */
  LC.bindChips = function (container, onPick, read) {
    if (!container) return;
    LC.$$('.chip', container).forEach(function (chip) {
      chip.setAttribute('type', 'button');
      chip.addEventListener('click', function () {
        LC.$$('.chip', container).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        chip.setAttribute('aria-pressed', 'true');
        onPick(chip.dataset.value, chip);
      });
    });
    if (read) read();
  };

  /* ── 모션 최소화 환경 대응 ────────────────────────── */
  LC.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
})();
