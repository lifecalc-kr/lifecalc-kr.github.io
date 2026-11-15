/* ═══════════════════════════════════════════════════════════════
   공유하기 공용 스크립트 — LCShare
   1) 모바일(iOS/Android): navigator.share({title,text,url}) 로 네이티브
      공유 시트(카카오톡·메시지·SNS)를 바로 엽니다.
   2) navigator.share 가 없는 환경: 결과 요약 문구 + 링크를 클립보드에
      복사하고 "공유 문구와 링크가 복사됐어요!" 토스트를 띄웁니다.
   ※ 네이티브 공유를 사용자가 닫은 경우(AbortError)에는 조용히 끝냅니다.

   사용법
     LCShare.bind(버튼, function () { return { title, text, url }; });
     LCShare.bindAll('[data-share]', function (btn) { return {...}; });
     LCShare.share({ title, text, url }, 버튼);
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.LCShare) return;

  var S = {};
  window.LCShare = S;

  var TOAST_ID = 'lcShareToast';
  var MSG_COPIED = '공유 문구와 링크가 복사됐어요!';
  var MSG_BLOCKED = '복사가 막혀 있어요. 주소창의 주소를 직접 복사해 주세요.';
  var toastTimer = null;

  /* ── 토스트 ─────────────────────────────────────────── */
  S.toast = function (msg) {
    var el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      el.className = 'share-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  };

  /* ── 클립보드 복사 (실패하면 execCommand) ───────────── */
  S.copy = function (text) {
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
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacy(); });
    }
    return Promise.resolve(legacy());
  };

  /* ── 버튼 라벨 잠깐 바꾸기 ──────────────────────────── */
  function flash(btn) {
    if (!btn) return;
    if (!btn.__lcShareLabel) btn.__lcShareLabel = btn.innerHTML;
    if (btn.__lcShareTimer) return;
    btn.innerHTML = '✅ 복사했어요';
    btn.__lcShareTimer = setTimeout(function () {
      btn.innerHTML = btn.__lcShareLabel;
      btn.__lcShareTimer = null;
    }, 1800);
  }

  /* ── 공유 실행 ──────────────────────────────────────── */
  S.share = function (payload, btn) {
    var p = payload || {};
    var title = p.title || document.title;
    var text = p.text || '';
    var url = p.url || location.href;
    var packed = text ? text + '\n' + url : url;

    function fallbackCopy() {
      S.copy(packed).then(function (ok) {
        if (ok) {
          S.toast(MSG_COPIED);
          flash(btn);
        } else {
          S.toast(MSG_BLOCKED);
        }
      });
    }

    if (typeof navigator.share === 'function') {
      var started;
      try {
        started = navigator.share({ title: title, text: text, url: url });
      } catch (e) {
        fallbackCopy();
        return;
      }
      Promise.resolve(started).catch(function (err) {
        if (err && err.name === 'AbortError') return; /* 사용자가 공유 시트를 닫음 */
        fallbackCopy();
      });
      return;
    }

    fallbackCopy();
  };

  /* ── 버튼 연결 ──────────────────────────────────────── */
  S.bind = function (btn, getPayload) {
    if (!btn || btn.__lcShareBound) return;
    btn.__lcShareBound = true;
    btn.addEventListener('click', function (e) {
      if (btn.tagName === 'A') e.preventDefault();
      var p = typeof getPayload === 'function' ? getPayload() : getPayload;
      S.share(p || {}, btn);
    });
  };

  S.bindAll = function (selector, getPayload) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (btn) {
      S.bind(btn, function () { return getPayload(btn); });
    });
  };
})();
