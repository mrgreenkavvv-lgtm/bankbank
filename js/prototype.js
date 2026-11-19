/* ==========================================================================
   Прототип · минимум поведения
   Здесь только состояние интерфейса: скорость, пауза, меню, свайпы, тосты.
   Логики игры нет — цифры статичны.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Тост ---------- */
  var toastEl = null;
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-shown');
    }, 2200);
  }

  /* ---------- Скорость и пауза ---------- */
  function initSpeed() {
    /* на дашборде скоростью и паузой управляет движок (engine.js) */
    if (window.GameEngine) return;
    var bars = document.querySelectorAll('.speed');
    var stored = localStorage.getItem('bank-speed') || '1';
    var paused = localStorage.getItem('bank-paused') === '1';

    bars.forEach(function (bar) {
      bar.querySelectorAll('button[data-speed]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          stored = btn.dataset.speed;
          localStorage.setItem('bank-speed', stored);
          paused = false;
          localStorage.setItem('bank-paused', '0');
          document.body.classList.remove('is-paused');
          syncSpeed();
        });
      });
      var pauseBtn = bar.querySelector('button[data-pause]');
      if (pauseBtn) {
        pauseBtn.addEventListener('click', function () {
          paused = !paused;
          localStorage.setItem('bank-paused', paused ? '1' : '0');
          document.body.classList.toggle('is-paused', paused);
          syncSpeed();
          toast(paused ? 'Пауза' : 'Игра продолжается · ×' + stored);
        });
      }
    });

    function syncSpeed() {
      bars.forEach(function (bar) {
        bar.querySelectorAll('button[data-speed]').forEach(function (btn) {
          btn.classList.toggle('is-on', !paused && btn.dataset.speed === stored);
        });
        var p = bar.querySelector('button[data-pause]');
        if (p) {
          p.classList.toggle('is-on', paused);
          p.setAttribute('aria-pressed', paused ? 'true' : 'false');
        }
      });
    }

    document.body.classList.toggle('is-paused', paused);
    syncSpeed();
  }

  /* ---------- Меню «Ещё» ---------- */
  function initMenus() {
    document.querySelectorAll('[data-menu-trigger]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var menu = trigger.parentElement.querySelector('.menu');
        var open = menu.classList.contains('is-open');
        closeMenus();
        if (!open) {
          menu.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });

    function closeMenus() {
      document.querySelectorAll('.menu.is-open').forEach(function (m) {
        m.classList.remove('is-open');
        var t = m.parentElement.querySelector('[data-menu-trigger]');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenus();
    });
  }

  /* ---------- Заглушки будущих экранов ---------- */
  function initStubs() {
    document.querySelectorAll('[data-soon]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        toast('Экран появится в следующей версии прототипа');
      });
    });
  }

  /* ---------- Решение по заявке ---------- */
  function decide(card, kind) {
    card.classList.remove('is-approved', 'is-declined');
    card.classList.add(kind === 'approved' ? 'is-approved' : 'is-declined');

    var stamp = card.querySelector('.req-stamp');
    if (stamp) stamp.textContent = kind === 'approved' ? 'Одобрено' : 'Отказ';

    var name = card.querySelector('.req-name');
    var who = name ? name.textContent.trim().split('\n')[0] : 'заявка';
    toast((kind === 'approved' ? 'Одобрено: ' : 'Отказ: ') + who);
  }

  function initDecisions() {
    /* на страницах с движком заявками управляет ui.js */
    if (window.GameState) return;

    document.querySelectorAll('.req').forEach(function (card) {
      card.querySelectorAll('[data-decide]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          decide(card, btn.dataset.decide);
        });
      });

      /* свайп: вправо — одобрить, влево — отказ */
      var startX = 0;
      var dx = 0;
      var active = false;

      card.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        if (e.target.closest('a, button')) return;
        if (card.classList.contains('is-approved') || card.classList.contains('is-declined')) return;
        active = true;
        startX = e.clientX;
        dx = 0;
        card.style.transition = 'none';
      });

      card.addEventListener('pointermove', function (e) {
        if (!active) return;
        dx = e.clientX - startX;
        if (Math.abs(dx) > 6) card.style.transform = 'translateX(' + dx + 'px)';
      });

      function finish() {
        if (!active) return;
        active = false;
        card.style.transition = '';
        card.style.transform = '';
        if (dx > 72) decide(card, 'approved');
        else if (dx < -72) decide(card, 'declined');
        dx = 0;
      }

      card.addEventListener('pointerup', finish);
      card.addEventListener('pointercancel', finish);
      card.addEventListener('pointerleave', finish);
    });
  }

  /* ---------- Порог VIP ---------- */
  function initRanges() {
    document.querySelectorAll('input[type="range"][data-output]').forEach(function (input) {
      var out = document.getElementById(input.dataset.output);
      if (!out) return;
      function render() {
        var v = Number(input.value);
        out.textContent = v.toLocaleString('ru-RU').replace(/\u00A0/g, ' ') + ' ₽';
        var pct = (v - Number(input.min || 0)) / (Number(input.max) - Number(input.min || 0)) * 100;
        input.style.setProperty('--fill', pct + '%');
      }
      input.addEventListener('input', render);
      render();
    });
  }

  /* ---------- Переключение профилей менеджера ---------- */
  function initProfiles() {
    var buttons = document.querySelectorAll('[data-profile-btn]');
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.profileBtn;
        buttons.forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        document.querySelectorAll('[data-profile]').forEach(function (block) {
          block.style.display = block.dataset.profile === id ? '' : 'none';
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ---------- Фильтры по округам ---------- */
  function initFilters() {
    var chips = document.querySelectorAll('[data-filter]');
    if (!chips.length) return;

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.dataset.filter;
        chips.forEach(function (c) {
          c.classList.toggle('is-on', c === chip);
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        document.querySelectorAll('[data-district]').forEach(function (row) {
          row.style.display = (f === 'all' || row.dataset.district === f) ? '' : 'none';
        });
      });
    });
  }

  /* ---------- Карта: показать / скрыть ---------- */
  function initMapToggle() {
    var btn = document.querySelector('[data-map-toggle]');
    var panel = document.querySelector('[data-map-panel]');
    if (!btn || !panel) return;

    var label = btn.querySelector('span');

    btn.addEventListener('click', function () {
      var willOpen = panel.hasAttribute('hidden');
      if (willOpen) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (label) label.textContent = willOpen ? 'Скрыть карту' : 'Показать карту';
    });
  }

  /* ---------- Плотность интерфейса ---------- */
  function initDensity() {
    var html = document.documentElement;
    var buttons = document.querySelectorAll('button[data-density]');
    var saved = localStorage.getItem('bank-density') || 'terminal';
    html.dataset.density = saved;

    buttons.forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.density === saved);
      btn.addEventListener('click', function () {
        var val = btn.dataset.density;
        html.dataset.density = val;
        localStorage.setItem('bank-density', val);
        buttons.forEach(function (b) { b.classList.toggle('is-on', b === btn); });
        toast(val === 'comfort' ? 'Плотность: Комфорт' : 'Плотность: Терминал');
      });
    });
  }

  /* ---------- Звук ---------- */
  function initSound() {
    var input = document.getElementById('soundToggle');
    if (!input) return;
    input.checked = localStorage.getItem('bank-sound') !== '0';
    input.addEventListener('change', function () {
      localStorage.setItem('bank-sound', input.checked ? '1' : '0');
      toast(input.checked ? 'Звук включён' : 'Звук выключен');
    });
  }

  /* ---------- Начать заново ---------- */
  function initRestart() {
    document.querySelectorAll('[data-restart]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!window.confirm('Начать заново? Текущий прогресс будет удалён.')) return;
        try { localStorage.removeItem('bank-save'); } catch (e) {}
        if (window.GameState && window.GameState.reset) window.GameState.reset();
        window.location.reload();
      });
    });
  }

  /* ---------- Выход в главное меню ---------- */
  function initExit() {
    document.querySelectorAll('[data-exit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.confirm('Выйти в главное меню? Прогресс сохранён.')) {
          window.location.href = 'index.html';
        }
      });
    });
  }

  /* ---------- Проверка ЦБ: исход решения ---------- */
  function initCbr() {
    /* на страницах с движком проверкой управляет ui.js */
    if (window.GameState) return;

    var decisions = document.getElementById('decisions');
    var box = document.getElementById('outcome');
    if (!decisions || !box) return;

    var step3 = document.getElementById('step3');
    var step4 = document.getElementById('step4');

    function show(kind) {
      var ok = kind !== 'fail';
      var html;

      if (kind === 'accept') {
        html = '<h3>Предписание принято</h3>' +
          '<p>Штраф 890 000 ₽ списан · репутация −4 · строгий контроль ЦБ на 3 месяца. ' +
          'Нарушения нужно устранить до следующей проверки.</p>';
      } else if (ok) {
        html = '<h3>Проверяющий согласился</h3>' +
          '<p>Штраф снижен до 120 000 ₽ · репутация −2 (слухи уже пошли) · требование по резервам снято. ' +
          'Нарушение Н2 осталось и всплывёт на следующей проверке.</p>';
      } else {
        html = '<h3>Провал: проверяющий вызвал комиссию</h3>' +
          '<p>Штраф 2 670 000 ₽ · репутация −12 · строгий режим. Повторный провал — отзыв лицензии.</p>';
      }

      box.className = 'outcome ' + (ok && kind !== 'accept' ? 'is-ok' : 'is-fail');
      box.innerHTML = '<svg class="ic" style="width:22px;height:22px;flex:0 0 22px"><use href="#' +
        (ok && kind !== 'accept' ? 'i-check' : 'i-alert') + '"/></svg>' +
        '<div style="flex:1">' + html + '</div>' +
        '<a class="btn btn-ghost" href="index.html" style="align-self:flex-start">Вернуться на Обзор</a>';
      box.hidden = false;
      decisions.style.display = 'none';

      if (step3) step3.className = 'step done';
      if (step4) step4.className = 'step ' + (ok ? 'done' : 'bad');
    }

    var accept = document.querySelector('[data-cbr-accept]');
    if (accept) accept.addEventListener('click', function () { show('accept'); });

    var bribe = document.querySelector('[data-cbr-bribe]');
    if (bribe) bribe.addEventListener('click', function () {
      var amount = document.querySelector('[data-cbr-amount]');
      var sum = amount ? Number(amount.value) || 0 : 0;
      if (sum <= 0) { toast('Укажите сумму'); return; }
      show(Math.random() < 0.2 ? 'fail' : 'ok');
    });
  }

  /* ---------- Сохранение: статус и сброс (страница «Ещё») ---------- */
  function initSaveInfo() {
    var el = document.getElementById('saveStatus');
    if (!el) return;

    function render() {
      var raw = null;
      try { raw = localStorage.getItem('bank-save'); } catch (e) {}
      if (!raw) {
        el.textContent = 'сохранения нет — игра начнётся с 8,42 млн ₽ и 14 марта 2027';
        return;
      }
      try {
        var data = JSON.parse(raw);
        var money = typeof window.formatMoney === 'function' ? window.formatMoney(data.capital) : '';
        el.textContent = 'сохранён · день ' + data.dayNumber + (money ? ' · ' + money : '');
      } catch (e) {
        el.textContent = 'сохранение повреждено — можно сбросить';
      }
    }

    render();

    var btn = document.querySelector('[data-reset]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!window.confirm('Сбросить прогресс? Капитал, дата и клиенты вернутся к старту.')) return;
      if (window.GameState && window.GameState.reset) {
        window.GameState.reset();
      } else {
        try { localStorage.removeItem('bank-save'); } catch (e) {}
      }
      render();
      toast('Прогресс сброшен');
    });
  }

  /* ---------- Service worker: оффлайн ---------- */
  function initSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    var badge = document.getElementById('swBadge');
    var status = document.getElementById('swStatus');
    var hadController = !!navigator.serviceWorker.controller;
    var reloaded = false;

    /* новая версия заняла место старой — один раз перезагружаемся,
       чтобы игрок увидел свежие файлы, а не кэш прошлой сборки */
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloaded) return;
      reloaded = true;
      console.log('[sw] новая версия активно — перезагрузка');
      location.reload();
    });

    navigator.serviceWorker.register('sw.js').then(function () {
      if (badge) badge.textContent = 'активен';
      if (status) status.textContent = 'оболочка закэширована · работает без сети';
    }).catch(function () {
      if (badge) { badge.className = 'badge badge-coral'; badge.textContent = 'нет'; }
      if (status) status.textContent = 'service worker недоступен (нужен https или localhost)';
    });
  }

  /* ---------- Клавиши: пробел = пауза, J/K/A/D — работа с заявками ---------- */
  function initRequestKeys() {
    var reqs = Array.prototype.slice.call(document.querySelectorAll('.req'));
    if (!reqs.length) return;
    var idx = -1;

    function focus(i) {
      if (i < 0 || i >= reqs.length) return;
      if (idx >= 0) reqs[idx].classList.remove('is-focused');
      idx = i;
      reqs[idx].classList.add('is-focused');
      reqs[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      var k = e.key;

      if (k === 'ArrowDown' || k === 'j' || k === 'J' || k === 'о' || k === 'О') {
        e.preventDefault();
        focus(Math.min(reqs.length - 1, idx + 1));
      } else if (k === 'ArrowUp' || k === 'k' || k === 'K' || k === 'л' || k === 'Л') {
        e.preventDefault();
        focus(Math.max(0, idx - 1));
      } else if ((k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') && idx >= 0) {
        e.preventDefault();
        decide(reqs[idx], 'approved');
      } else if ((k === 'd' || k === 'D' || k === 'в' || k === 'В') && idx >= 0) {
        e.preventDefault();
        decide(reqs[idx], 'declined');
      }
    });
  }

  function initKeys() {
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Space') return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'button' || tag === 'a' || tag === 'select' || tag === 'textarea') return;
      e.preventDefault();
      var pauseBtn = document.querySelector('.speed button[data-pause]');
      if (pauseBtn) pauseBtn.click();
    });
  }

  /* тост доступен другим модулям (ui.js) */
  window.showToast = toast;

  document.addEventListener('DOMContentLoaded', function () {    initSpeed();
    initMenus();
    initStubs();
    initDecisions();
    initRanges();
    initProfiles();
    initFilters();
    initMapToggle();
    initDensity();
    initSound();
    initExit();
    initCbr();
    initSaveInfo();
    initRestart();
    initSW();
    initRequestKeys();
    initKeys();
  });
})();
