/* ==========================================================================
   engine.js · Игровой цикл
   Один игровой день = GameState.dayLength реальных секунд при ×1.
   Считаем по delta time: тик раз в TICK_MS, время идёт ровно и не зависит
   от того, сколько кадров успела отрисовать вкладка.
   ========================================================================== */
(function (global) {
  'use strict';

  var state = global.GameState;
  if (!state) return;

  var TICK_MS = 200;    // частота просчёта (не длина дня)
  var MAX_DELTA = 3;    // сек: защита от прыжка после фоновой вкладки

  var timer = null;
  var lastTs = 0;
  var acc = 0;          // накопленные секунды текущего дня
  var bound = false;
  var firstTick = true;

  function tick() {
    var now = performance.now();
    var dt = (now - lastTs) / 1000;
    lastTs = now;

    if (firstTick) {
      firstTick = false;
      console.log('[engine] tick 1 · цикл живой · день ' + state.dayNumber);
    }

    if (dt > MAX_DELTA) dt = MAX_DELTA;
    if (state.paused || state.bankrupt) return;

    acc += dt * state.speed;

    var guard = 0;
    while (acc >= state.dayLength && guard < 500) {
      acc -= state.dayLength;
      state.advanceDay();
      state.processAutopilot();
      guard += 1;

      /* наступил день проверки ЦБ — пауза и переход на экран проверки */
      if (state.dayNumber >= state.nextInspectionDay) {
        state.startInspection();
        goToInspection();
        return;
      }

      console.log('[engine] tick · день ' + state.dayNumber +
                  ' · капитал ' + global.formatMoney(state.capital));

      if (global.GameUI) global.GameUI.update();
    }
  }

  function goToInspection() {
    if (location.pathname.indexOf('cbr.html') !== -1) return;
    setTimeout(function () {
      location.href = 'cbr.html?inspection=true';
    }, 250);
  }

  function start() {
    if (timer) return;
    bind();
    lastTs = performance.now();
    timer = setInterval(tick, TICK_MS);

    console.log('[engine] старт · сборка 0.8.0 · ×' + state.speed + ' · ' +
                state.dayLength + ' с на игровой день · день ' + state.dayNumber +
                ' · капитал ' + global.formatMoney(state.capital));
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      console.log('[engine] остановлен');
    }
  }

  function bind() {
    if (bound) return;
    bound = true;

    document.querySelectorAll('.speed button[data-speed]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.setSpeed(Number(btn.dataset.speed));
        if (!state.bankrupt) state.setPaused(false);   // из краха скорость не выводит
        if (global.GameUI) global.GameUI.syncControls();
      });
    });

    document.querySelectorAll('.speed button[data-pause]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.bankrupt) return;                     // на крахе пауза принудительная
        state.togglePause();
        if (global.GameUI) global.GameUI.syncControls();
      });
    });

    /* сохраняем прогресс при уходе со страницы */
    window.addEventListener('beforeunload', function () { state.save(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') state.save();
    });
  }

  global.GameEngine = {
    start: start,
    stop: stop,
    bind: bind,
    tick: tick,
    isRunning: function () { return timer !== null; }
  };
})(window);
