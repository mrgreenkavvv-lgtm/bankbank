/* ==========================================================================
   ui.js · Связка состояния и DOM
   Только чтение GameState и запись в узлы с data-ui. Обновляем изменившееся.
   ========================================================================== */
(function (global) {
  'use strict';

  var state = global.GameState;
  var els = { capital: [], flow: null, vip: null, queue: null, bankrupt: null, events: null };
  var last = {
    capital: null, date: null, dayline: null, stage: null, kpi: null, delta: null,
    liquid: null, flow: null, vip: null, queue: null, counts: null, events: null, bankrupt: null,
    manager: null, 'ap-name': null, 'ap-eta': null, vipControl: null,
    portfolio: null, profit: null, profitNote: null, rep: null, ratios: null,
    branches: null, kpiBranches: null, branchesPanel: null,
    rates: null, stocks: null, stocksSub: null, stocksCount: null, myLoan: null, myDep: null,
    security: null
  };

  function money(value) {
    return global.formatMoney(value);
  }

  function setText(node, value, key) {
    if (!node || last[key] === value) return;
    node.textContent = value;
    last[key] = value;
  }

  function riskDots(risk) {
    var html = '<span class="risk' + (risk >= 4 ? ' is-high' : '') + '">';
    for (var i = 0; i < 5; i += 1) {
      html += '<i' + (i < risk ? ' class="f"' : '') + '></i>';
    }
    return html + '</span>';
  }

  function rateLabel(rate) {
    return rate.toFixed(2).replace('.', ',') + '%';
  }

  /* ---------- Дельта капитала от старта ---------- */
  function renderDelta() {
    var pct = ((state.capital - state.startCapital) / state.startCapital) * 100;
    var flat = Math.abs(pct) < 0.05;
    var up = pct > 0;
    var sign = flat ? '' : (up ? '▲ +' : '▼ −');
    var body = Math.abs(pct).toFixed(1).replace('.', ',') + '%';
    var cls = flat ? 'num muted' : (up ? 'num up' : 'num down');
    var value = sign + body;

    if (last.delta !== cls + value) {
      last.delta = cls + value;

      document.querySelectorAll('[data-ui="cap-delta"]').forEach(function (node) {
        node.className = 'tiny ' + cls;
        node.textContent = value;
      });
      document.querySelectorAll('[data-ui="kpi-delta"]').forEach(function (node) {
        node.className = 'd ' + (flat ? 'muted' : (up ? 'up' : 'down'));
        node.textContent = value + ' от старта';
      });
    }
  }

  /* ---------- Свободные средства ---------- */
  function renderLiquid() {
    var liquid = money(state.liquidFunds());

    setText(document.querySelector('[data-ui="liquid"]'), liquid, 'liquid');
    setText(document.querySelector('[data-ui="liquid-line"]'), 'Свободно: ' + liquid, 'liquid-line');
  }

  /* ---------- Живой поток ---------- */
  function renderFlow() {
    if (!els.flow) return;

    var clients = state.activeClients || [];
    /* отмечаем и id, и автора решения: бейдж должен появляться сразу */
    var signature = clients.map(function (c) { return c.id + (c.decidedBy ? ':' + c.decidedBy : ''); }).join('|');
    if (signature === last.flow) return;
    last.flow = signature;

    els.flow.innerHTML = clients.map(function (c) {
      var hot = c.amount >= 3000000 ? ' is-warn' : '';
      return '' +
        '<div class="frow">' +
          '<span class="t">д. ' + c.day + '</span>' +
          '<span class="dot' + hot + '"></span>' +
          '<span class="nm">' + c.name + '</span>' +
          '<span class="' + (c.decidedBy ? 'muted' : 'muted') + '">' +
            (c.decidedBy ? '✓ ' + c.decidedBy : state.typeLabel(c.type)) + '</span>' +
          '<span class="amt">' + money(c.amount) + '</span>' +
        '</div>';
    }).join('');
  }

  /* ---------- «Требует решения»: только VIP ---------- */
  function renderVip() {
    if (!els.vip) return;

    var vips = state.queue.filter(function (c) { return c.isVip; }).slice(0, 3);
    var signature = vips.map(function (c) { return c.id; }).join('|');
    if (signature === last.vip) return;
    last.vip = signature;

    if (!vips.length) {
      els.vip.innerHTML =
        '<div class="qitem">' +
          '<span class="badge badge-muted">—</span>' +
          '<div><div class="qname">Срочных решений нет</div>' +
          '<div class="qmeta">VIP-заявки появятся по мере потока</div></div>' +
        '</div>';
      return;
    }

    els.vip.innerHTML = vips.map(function (c) {
      return '<a class="qitem" href="clients.html">' +
        '<span class="badge badge-gold">VIP</span>' +
        '<div>' +
          '<div class="qname">' + (c.type === 'loan' ? 'Кредит' : 'Вклад') + ' · ' + c.name + '</div>' +
          '<div class="qmeta">' + c.term + ' мес · риск ' + state.riskLabel(c.risk) + ' · ' + rateLabel(c.rate) + '</div>' +
        '</div>' +
        '<span class="qsum">' + money(c.amount) + '</span>' +
      '</a>';
    }).join('');
  }

  /* ---------- Очередь заявок ---------- */
  /* ---------- VIP-порог ---------- */
  var VIP_MIN = 100000;
  var VIP_MAX = 100000000;

  function vipToSlider(value) {
    var v = Math.max(VIP_MIN, Math.min(VIP_MAX, value));
    return Math.round((Math.log(v / VIP_MIN) / Math.log(VIP_MAX / VIP_MIN)) * 1000);
  }

  function sliderToVip(pos) {
    var raw = VIP_MIN * Math.pow(VIP_MAX / VIP_MIN, pos / 1000);
    return Math.round(raw / 100000) * 100000;
  }

  function vipRowHtml(type, label) {
    var value = type === 'deposit' ? state.vipThresholdDeposit : state.vipThresholdLoan;
    var pos = vipToSlider(value);

    return '<div class="vip-row">' +
      '<div class="between"><span class="small">' + label + '</span>' +
        '<input class="vip-input" type="number" min="100000" max="100000000" step="100000" value="' + value +
          '" data-vip-input="' + type + '" aria-label="' + label + ', порог">' +
      '</div>' +
      '<input type="range" min="0" max="1000" step="1" value="' + pos + '" data-vip-slider="' + type +
        '" aria-label="' + label + ', ползунок">' +
      '<div class="range-scale"><span>100 тыс</span><span>' + money(value) + '</span><span>100 млн</span></div>' +
    '</div>';
  }

  function renderVipControl() {
    var box = document.querySelector('[data-ui="vip-control"]');
    if (!box) return;

    var sig = state.vipThresholdLoan + '|' + state.vipThresholdDeposit;
    if (last.vipControl === sig) return;
    last.vipControl = sig;

    box.innerHTML = '<div class="threshold">' +
      '<div style="flex:1">' +
        '<div class="lbl"><span>VIP-порог — выше этой суммы решаете вы</span>' +
          '<b>' + money(state.vipThresholdLoan) + '</b></div>' +
        vipRowHtml('loan', 'Кредиты') +
        vipRowHtml('deposit', 'Вклады') +
      '</div>' +
    '</div>';
  }

  function renderClientFilters() {
    var box = document.querySelector('[data-ui="client-filters"]');
    if (!box) return;

    var queue = state.queue;
    var counts = {
      all: queue.length,
      loans: queue.filter(function (c) { return c.type === 'loan'; }).length,
      deposits: queue.filter(function (c) { return c.type === 'deposit'; }).length,
      vip: queue.filter(function (c) { return c.isVip; }).length
    };

    var chips = [
      { id: 'all', label: 'Все' },
      { id: 'loans', label: 'Кредиты' },
      { id: 'deposits', label: 'Вклады' },
      { id: 'vip', label: 'VIP' }
    ];

    var html = chips.map(function (c) {
      return '<button class="chip' + (state.clientFilter === c.id ? ' is-on' : '') + '" type="button" data-client-filter="' +
        c.id + '">' + c.label + ' ' + counts[c.id] + '</button>';
    }).join('');

    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function renderQueue() {
    if (!els.queue) return;

    var list = state.queue;
    if (state.clientFilter === 'loans') list = list.filter(function (c) { return c.type === 'loan'; });
    else if (state.clientFilter === 'deposits') list = list.filter(function (c) { return c.type === 'deposit'; });
    else if (state.clientFilter === 'vip') list = list.filter(function (c) { return c.isVip; });
    var signature = list.map(function (c) { return c.id; }).join('|');
    if (signature === last.queue) return;
    last.queue = signature;

    if (!list.length) {
      els.queue.innerHTML =
        '<li class="req" style="grid-template-columns:1fr">' +
          '<div class="req-name"><span class="muted">Очередь пуста — ждём новых клиентов</span></div>' +
        '</li>';
      return;
    }

    els.queue.innerHTML = list.map(function (c) {
      var vip = c.isVip ? ' is-vip' : '';
      return '<li class="req' + vip + '" data-client-id="' + c.id + '" data-type="' + c.type + '" data-amount="' + c.amount + '">' +
        '<div class="req-name"><span>' + c.name + '</span>' +
          (c.isVip ? '<span class="badge badge-gold">VIP</span>' : '') +
        '</div>' +
        '<div class="req-meta">' +
          '<span class="chip req-type' + (c.type === 'deposit' ? ' chip-blue' : '') + '">' + state.typeLabel(c.type) + '</span>' +
          '<span class="req-term">' + c.term + ' мес</span>' +
          '<span class="req-risk">' + riskDots(c.risk) + '</span>' +
          '<span class="req-rate">' + rateLabel(c.rate) + '</span>' +
        '</div>' +
        '<div class="req-amount">' + money(c.amount) + '</div>' +
        '<div class="req-manager muted">' + c.manager + '</div>' +
        '<div class="req-actions">' +
          '<button class="btn btn-ok btn-sm" type="button" data-decide="approved">✓ Одобрить</button>' +
          '<button class="btn btn-no btn-sm" type="button" data-decide="declined">✕ Отказ</button>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  /* ---------- Доступность кнопки «Одобрить» ---------- */
  function refreshAffordability() {
    var liquid = state.liquidFunds();

    document.querySelectorAll('[data-ui="queue"] .req[data-client-id]').forEach(function (row) {
      var btn = row.querySelector('[data-decide="approved"]');
      if (!btn) return;

      var isLoan = row.dataset.type === 'loan';
      var amount = Number(row.dataset.amount) || 0;
      var can = !isLoan || liquid >= amount;

      if (btn.disabled === !can) return;
      btn.disabled = !can;
      btn.title = can ? '' : 'Недостаточно средств';
    });
  }

  /* ---------- Счётчики ---------- */
  function renderCounts() {
    var n = state.queue.length;
    if (last.counts === String(n)) return;
    last.counts = String(n);

    document.querySelectorAll('[data-ui="queue-num"]').forEach(function (el) { el.textContent = n; });
    document.querySelectorAll('[data-ui="queue-count"]').forEach(function (el) { el.textContent = n + ' ждут'; });
    document.querySelectorAll('[data-ui="resolve-btn"]').forEach(function (el) { el.textContent = 'Решить · ' + n; });
    document.querySelectorAll('[data-ui="queue-badge"]').forEach(function (el) { el.textContent = n + ' у вас'; });
    document.querySelectorAll('[data-ui="queue-chip"]').forEach(function (el) { el.textContent = '⚠ ' + n; });
  }

  /* ---------- События ---------- */
  function renderEvents() {
    if (!els.events) return;

    var entries = state.log.slice(-5).reverse();
    var signature = entries.map(function (e) { return e.day + e.text; }).join('|');
    if (signature === last.events) return;
    last.events = signature;

    if (!entries.length) {
      els.events.innerHTML = '<div class="nitem"><span class="t">—</span><p class="muted">Пока тихо</p></div>';
      return;
    }

    els.events.innerHTML = entries.map(function (e) {
      var colors = {
        bankrupt: 'var(--coral)', warn: 'var(--coral)', default: 'var(--coral)', fire: 'var(--coral)',
        closed: 'var(--mint)', growth: 'var(--mint)', stock: 'var(--mint)', branch: 'var(--mint)',
        hire: 'var(--mint)', security: 'var(--mint)', achievement: 'var(--mint)', stage: 'var(--mint)',
        cbr: 'var(--amber)'
      };
      var cls = colors[e.type] ? ' style="color:' + colors[e.type] + '"' : '';
      return '<div class="nitem"><span class="t">д. ' + e.day + '</span><p' + cls + '>' + e.text + '</p></div>';
    }).join('');
  }

  /* ---------- Неплатёжеспособность ---------- */
  function renderBankrupt() {
    var bar = els.bankrupt;
    var message = state.bankrupt ? '1' : '0';
    if (last.bankrupt === message) return;
    last.bankrupt = message;

    if (bar) bar.hidden = !state.bankrupt;
    document.body.classList.toggle('is-bankrupt', state.bankrupt);
  }

  /* ---------- Менеджеры ---------- */
  function initials(name) {
    return name.split(' ').map(function (w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase();
  }

  function loyaltyLabel(value) {
    if (value >= 80) return 'преданный';
    if (value >= 50) return 'лояльный';
    if (value >= 20) return 'недовольный';
    return 'на грани';
  }

  function skillRow(name, base, bonus) {
    var total = base + (bonus || 0);
    var width = Math.max(2, Math.min(100, total / 1.2));

    return '<div class="skill">' +
      '<span class="skill-name">' + name + '</span>' +
      '<span class="skill-bar"><i style="width:' + width + '%"></i></span>' +
      '<span class="skill-val">' + total +
        (bonus ? '<small class="up"> +' + bonus + '</small>' : '') + '</span>' +
    '</div>';
  }

  var POTENTIAL_LABEL = { low: 'низкий', medium: 'средний', high: 'высокий' };
  var POTENTIAL_TONE = { low: 'badge-muted', medium: 'badge-muted', high: 'badge-gold' };

  function potentialRange(m) {
    var max = m.potentialMax || 100;
    if (max <= 60) return '≈50–60';
    if (max <= 80) return '≈70–80';
    return '≈90–100';
  }

  function potentialCardHtml(m) {
    var max = m.potentialMax || 100;
    var capped = m.level >= max;
    var label = POTENTIAL_LABEL[m.potential] || 'средний';
    var filled = Math.round((max / 100) * 5);
    var bars = '';
    for (var i = 0; i < 5; i += 1) bars += i < filled ? '▓' : '▒';

    return '<section class="card">' +
      '<div class="card-h"><h2>Потенциал</h2>' +
        '<div class="r"><span class="badge ' + (capped ? 'badge-coral' : (POTENTIAL_TONE[m.potential] || 'badge-muted')) + '">' +
          (capped ? 'потенциал исчерпан' : label) + '</span></div></div>' +
      '<div class="card-b">' +
        '<div class="pot-row">' +
          '<span class="pot-bars">' + bars + '</span>' +
          '<span class="small num">' + potentialRange(m) + '</span>' +
        '</div>' +
        '<div class="small muted" style="margin-top:6px">' +
          (capped
            ? max + ' / 100 · роста больше не будет'
            : 'сейчас ' + m.level + ' · потолок ' + max + ' из 100') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function goalCardHtml(m) {
    var goal = m.goal;
    if (!goal) return '';

    var progress = state.goalProgress(m);
    var percent = Math.max(0, Math.min(100, (progress / goal.target) * 100));
    var daysLeft = Math.max(0, goal.deadlineDay - state.dayNumber);

    var status = goal.done
      ? '<span class="badge badge-mint">выполнена</span>'
      : goal.failed
        ? '<span class="badge badge-coral">провалена</span>'
        : '<span class="badge badge-muted">в работе</span>';

    return '<section class="card">' +
      '<div class="card-h"><h2>Личная цель</h2><div class="r">' + status + '</div></div>' +
      '<div class="card-b">' +
        '<div class="goal-title">' + goal.title + '</div>' +
        '<div class="ach-bar"><div class="track"><i style="width:' + (goal.done ? 100 : percent) + '%"></i></div>' +
          '<span class="small muted num">' + Math.min(progress, goal.target) + ' / ' + goal.target + '</span></div>' +
        '<div class="small muted" style="margin-top:6px">' +
          (goal.done ? 'Награда получена: +20 лояльности и премия'
            : goal.failed ? 'Дедлайн прошёл: −15 лояльности'
            : 'Дедлайн через ' + daysLeft + ' дн. · награда: +20 лояльности и премия') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function buffsCardHtml(m) {
    var buffs = m.buffs || [];

    var rows = buffs.length
      ? buffs.slice().sort(function (a, b) { return a.level - b.level; }).map(function (b) {
          var tone = b.kind === 'legendary' ? 'badge-gold' : b.kind === 'rare' ? 'badge-violet' : 'badge-muted';
          var label = b.kind === 'legendary' ? 'легендарный' : b.kind === 'rare' ? 'редкий' : 'обычный';

          return '<div class="buff-row">' +
            '<span class="buff-lvl num">Ур. ' + b.level + '</span>' +
            '<span class="badge ' + tone + '">' + label + '</span>' +
            '<b class="buff-name">«' + b.name + '»</b>' +
            '<span class="small muted">' + b.desc + '</span>' +
          '</div>';
        }).join('')
      : '<div class="muted small">Баффов пока нет — они выпадают на каждом 10-м уровне.</div>';

    return '<section class="card">' +
      '<div class="card-h"><h2>Баффы</h2><div class="r">' + buffs.length + ' шт</div></div>' +
      '<div class="card-b">' + rows + '</div>' +
    '</section>';
  }

  function achievementsCardHtml(m) {
    var list = state.managerAchievementList(m);
    var got = list.filter(function (a) { return a.got; }).length;

    var rows = list.map(function (a) {
      var percent = a.got ? 100 : Math.max(0, Math.min(100, (a.value / a.target) * 100));

      return '<div class="ach-line' + (a.got ? ' is-got' : '') + '">' +
        '<span class="ach-line-ico">' + (a.got ? '🏅' : '🔒') + '</span>' +
        '<div class="ach-line-body">' +
          '<div class="between"><b>' + (a.got ? a.name : '???') + '</b>' +
            '<span class="small muted num">' + (a.got ? 'получено' : a.value + ' / ' + a.target) + '</span></div>' +
          '<div class="small muted">' + a.desc + '</div>' +
          '<div class="track" style="height:4px;margin-top:6px"><i style="width:' + percent + '%"></i></div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<section class="card">' +
      '<div class="card-h"><h2>Достижения</h2><div class="r">' + got + ' / ' + list.length + '</div></div>' +
      '<div class="card-b">' + rows + '</div>' +
    '</section>';
  }

  /* ---------- Диалог о прибавке ---------- */
  function renderNegotiation() {
    var box = document.querySelector('[data-ui="negotiation"]');
    if (!box) return;

    var neg = state.negotiation;
    var manager = neg ? state.managerById(neg.managerId) : null;

    if (!neg || !manager) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    box.hidden = false;
    box.innerHTML = '<section class="card negotiation">' +
      '<div class="card-h"><h2>Требует решения</h2><div class="r">' + manager.name + '</div></div>' +
      '<div class="card-b">' +
        '<p class="neg-text">«Я работаю здесь уже давно, а зарплата ниже рынка. Могу я рассчитывать на прибавку?»</p>' +
        '<div class="neg-meta small muted">лояльность ' + manager.loyalty + ' · ' +
          money(manager.salary) + '/мес · рынок ' + money(state.managerMarketSalary(manager)) + '</div>' +
        '<div class="neg-actions">' +
          '<button class="btn btn-sm btn-primary" type="button" data-neg="raise">Повысить зарплату · +10</button>' +
          '<button class="btn btn-sm" type="button" data-neg="bonus">Премия ' + money(manager.salary * 0.5) + ' · +5</button>' +
          '<button class="btn btn-sm btn-no" type="button" data-neg="refuse">Отказать · −10</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function renderManager() {
    var card = document.querySelector('[data-ui="manager-card"]');
    if (!card) return;

    var m = state.managerById(state.activeManagerId);
    if (!m) return;

    var market = Math.round((30000 + m.level * 2600) / 1000) * 1000;
    var diff = Math.round(((m.salary - market) / market) * 100);
    var perDay = (1 / state.managerDaysPerClient(m)).toFixed(2).replace('.', ',');
    var mistake = Math.round(state.managerMistakeChance(m) * 100);

    var signature = [m.id, m.level, m.loyalty, m.autopilot, m.salary,
                     m.skills.analytics, m.skills.speed, m.skills.caution,
                     state.managers.length, Math.round(state.capital), m.mole ? 1 : 0,
                     m.promotedDay || 0, m.character || '', (m.buffs || []).length,
                     m.goal ? (m.goal.done ? 'd' : m.goal.failed ? 'f' : String(state.goalProgress(m))) : '',
                     m.courses || 0, m.cleanMonths || 0, m.potential || '', m.potentialMax || 0,
                     (m.workMode || 'all'), JSON.stringify(m.buffBonus || {})].join('|');
    if (signature === last.manager) return;
    last.manager = signature;

    var list = document.querySelector('[data-ui="managers"]');
    if (list) {
      list.innerHTML = state.managers.map(function (x) {
        var on = x.id === state.activeManagerId ? ' is-on' : '';
        return '<button class="chip' + on + '" type="button" data-manager="' + x.id + '">' +
               x.name + ' · ' + x.level + '</button>';
      }).join('');
    }

    var trainBtn = document.querySelector('[data-train]');
    var promoteBtn = document.querySelector('[data-promote]');
    var capped = m.level >= (m.potentialMax || 100);
    var maxed = m.level >= 100 || capped;

    if (trainBtn) {
      trainBtn.disabled = maxed || state.capital < state.trainCost;
      trainBtn.title = capped ? 'Потенциал исчерпан' : maxed ? 'Максимальный уровень' : (state.capital < state.trainCost ? 'Не хватает денег' : '');
    }
    if (promoteBtn) {
      var cost = state.promoteCost(m);
      promoteBtn.disabled = maxed || state.capital < cost;
      promoteBtn.title = capped ? 'Потенциал исчерпан' : maxed ? 'Максимальный уровень' : (state.capital < cost ? 'Не хватает денег' : '');
    }

    var costTrain = document.querySelector('[data-ui="cost-train"]');
    if (costTrain) costTrain.textContent = money(state.trainCost);

    var costPromote = document.querySelector('[data-ui="cost-promote"]');
    if (costPromote) costPromote.textContent = money(state.promoteCost(m));

    card.innerHTML = '' +
      '<section class="card">' +
        '<div class="profile">' +
          '<div class="ava" style="--p:' + m.level + '"><b>' + initials(m.name) + '</b></div>' +
          '<div>' +
            '<div class="p-name">' + m.name + '</div>' +
            '<div class="p-meta">уровень ' + m.level + ' · операционист</div>' +
            '<div class="tagrow">' +
              '<span class="badge badge-gold">' + loyaltyLabel(m.loyalty) + ' · ' + m.loyalty + '</span>' +
              '<span class="badge badge-muted">шанс ошибки ' + mistake + '%</span>' +
              '<span class="badge badge-muted" title="' + state.characterInfo(m).hint + '">' +
                state.characterInfo(m).name + '</span>' +
              (m.mole
                ? '<span class="badge badge-coral">крот</span>'
                : '<span class="badge badge-mint">чист</span>') +
            '</div>' +
          '</div>' +
          '<div class="p-level"><span>Уровень</span><b>' + m.level + '<i>/100</i></b></div>' +
        '</div>' +

        '<div class="salary">' +
          '<b>' + money(m.salary) + '/мес</b>' +
          '<span>· рынок ' + money(market) + '</span>' +
          '<span class="' + (diff < 0 ? 'down' : 'up') + '">· ' +
            (diff < 0 ? 'ниже' : 'выше') + ' рынка на ' + Math.abs(diff) + '%</span>' +
        '</div>' +

        '<div class="workmode-box">' +
          '<span class="small muted">Режим работы</span>' +
          '<div class="segmented">' +
            '<button type="button" data-workmode="all" class="' + (m.workMode === 'all' || !m.workMode ? 'is-on' : '') + '">Все</button>' +
            '<button type="button" data-workmode="vip" class="' + (m.workMode === 'vip' ? 'is-on' : '') + '">Только VIP</button>' +
            '<button type="button" data-workmode="regular" class="' + (m.workMode === 'regular' ? 'is-on' : '') + '">Только обычные</button>' +
          '</div>' +
        '</div>' +
        '<div class="autopilot-box">' +
          '<div class="ap-txt">' +
            '<b>Автопилот</b>' +
            '<span>' + (m.autopilot ? 'Включён — разбирает очередь сам' : 'Выключен — очередь разбираете вы') + '</span>' +
          '</div>' +
          '<label class="switch">' +
            '<input type="checkbox" data-autopilot="' + m.id + '"' + (m.autopilot ? ' checked' : '') +
              ' aria-label="Автопилот">' +
            '<span class="track-ui"></span>' +
          '</label>' +
        '</div>' +
        (m.autopilot
          ? '<div class="ap-hint">Разбирает очередь со скоростью ~' + perDay + ' клиента/день · VIP оставляет вам</div>'
          : '') +
      '</section>' +

      '<section class="card">' +
        '<div class="card-h"><h2>Навыки</h2><div class="r">база + бафф</div></div>' +
        '<div class="card-b"><div class="skills">' +
          skillRow('Аналитика', m.skills.analytics, (m.buffBonus || {}).analytics) +
          skillRow('Скорость', m.skills.speed, (m.buffBonus || {}).speed) +
          skillRow('Осторожность', m.skills.caution, (m.buffBonus || {}).caution) +
        '</div></div>' +
      '</section>' +

      potentialCardHtml(m) +
      goalCardHtml(m) +
      buffsCardHtml(m) +
      achievementsCardHtml(m) +
      '<section class="card">' +
        '<div class="card-h"><h2>Лояльность</h2><div class="r">' + m.loyalty + ' · ' + loyaltyLabel(m.loyalty) + '</div></div>' +
        '<div class="card-b">' +
          '<div class="track" style="height:9px"><i class="is-gold" style="width:' + m.loyalty + '%"></i></div>' +
          '<div class="between small muted" style="margin-top:6px">' +
            '<span>порог ухода 20</span><span>шанс ухода скрыт</span>' +
          '</div>' +
          '<div class="hr"></div>' +
          '<button class="btn btn-no btn-sm" type="button" data-fire="' + m.id + '">Уволить · пособие ' + money(m.salary) + '</button>' +
        '</div>' +
      '</section>' +
      renderCandidates();
  }

  /* ---------- Кандидаты ---------- */
  function renderCandidates() {
    var list = state.ensureCandidates();
    var canPay = state.capital;

    var rows = list.map(function (c) {
      var affordable = canPay >= c.salary;
      return '<div class="cand">' +
        '<div class="cand-top"><b>' + c.name + '</b>' +
          '<span class="badge ' + (POTENTIAL_TONE[c.potential] || 'badge-muted') + '" title="Потенциал: ' +
            potentialRange(c) + '">потенциал ' + (POTENTIAL_LABEL[c.potential] || 'средний') + '</span>' +
          '<span class="badge badge-muted">ур. ' + c.level + '</span></div>' +
        '<div class="cand-skills">' +
          '<span>аналитика ' + c.skills.analytics + '</span>' +
          '<span>скорость ' + c.skills.speed + '</span>' +
          '<span>осторожность ' + c.skills.caution + '</span>' +
        '</div>' +
        '<div class="cand-foot">' +
          '<span class="num">' + money(c.salary) + '/мес</span>' +
          '<button class="btn btn-sm ' + (affordable ? 'btn-primary' : '') + '" type="button" data-hire="' + c.id + '"' +
            (affordable ? '' : ' disabled title="Не хватает денег на первый месяц"') + '>Нанять</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<section class="card">' +
      '<div class="card-h"><h2>Найм</h2><div class="r">' +
        '<button class="btn btn-sm btn-ghost" type="button" data-reroll>Другие</button>' +
      '</div></div>' +
      '<div class="cand-list">' + rows + '</div>' +
      '<div class="card-f">При найме сразу списывается первый месяц · на вас ' + state.managers.length + ' из ' + state.branches + ' филиалов</div>' +
    '</section>';
  }

  /* ---------- Филиалы ---------- */
  function renderBranches() {
    var hud = document.querySelector('[data-ui="branches"]');
    if (hud) setText(hud, String(state.branches), 'branches');

    var kpi = document.querySelector('[data-ui="kpi-branches"]');
    if (kpi) setText(kpi, String(state.branches), 'kpiBranches');

    var sub = document.querySelector('[data-ui="branch-sub"]');
    if (sub) {
      setText(sub, state.branches + (state.branches === 1 ? ' филиал' : ' филиала') +
        ' · очередь до ' + state.queueLimit, 'branchSub');
    }

    var box = document.querySelector('[data-ui="branches-panel"]');
    if (!box) return;

    var sig = [state.branches, state.queueLimit, state.clientsPerDay, state.managers.length, Math.round(state.capital)].join('|');
    if (sig === last.branchesPanel) return;
    last.branchesPanel = sig;

    var shortfall = state.branches - state.managers.length;
    var affordable = state.capital >= state.branchCost;

    var list = '';
    for (var i = 1; i <= state.branches; i += 1) {
      var staffed = state.managers.length >= i;
      list += '<div class="frow" style="height:34px">' +
        '<span class="t">#' + i + '</span>' +
        '<span class="nm">Филиал ' + i + (i === 1 ? ' · Тверь' : '') + '</span>' +
        '<span class="' + (staffed ? 'up' : 'down') + ' small">' + (staffed ? 'укомплектован' : 'некомплект') + '</span>' +
      '</div>';
    }

    var next = state.nextStage();
    var check = state.canUpgradeStage();

    var stageCard = '<section class="card">' +
      '<div class="card-h"><h2>Уровень банка</h2><div class="r">' + state.bankStage + ' / 7</div></div>' +
      '<div class="card-b">' +
        '<div class="between"><span class="muted small">Сейчас</span>' +
          '<b>' + state.stageName() + '</b></div>' +
        (next
          ? '<div class="small muted" style="margin-top:8px;line-height:1.4">Для перехода нужны капитал ' +
              money(next.capital) + ' и ' + next.branches + ' филиала. Лицензия — ' + money(next.cost) + '.</div>' +
            '<button class="btn btn-primary btn-block" style="margin-top:10px" type="button" data-stage-up' +
              (check.ok ? '' : ' disabled') + '>' +
              'Стать «' + next.name + '»' + (check.ok ? ' · ' + money(next.cost) : '') + '</button>'
          : '<div class="small muted" style="margin-top:8px">Максимальный уровень в прототипе</div>') +
      '</div>' +
    '</section>';

    box.innerHTML = stageCard + '<section class="card">' +
      '<div class="card-h"><h2>Ваша сеть</h2><div class="r">' +
        '<span class="badge badge-gold">' + state.branches + ' ' + (state.branches === 1 ? 'филиал' : 'филиала') + '</span>' +
      '</div></div>' +
      '<div class="card-b">' +
        '<div class="row" style="gap:8px">' +
          '<div class="kpi" style="flex:1;border:0;background:var(--raised);padding:8px 12px"><span>Очередь до</span>' +
            '<div class="v" style="font-size:var(--fs-15)">' + state.queueLimit + '</div></div>' +
          '<div class="kpi" style="flex:1;border:0;background:var(--raised);padding:8px 12px"><span>Поток / день</span>' +
            '<div class="v" style="font-size:var(--fs-15)">' + state.clientsPerDay.toFixed(2).replace('.', ',') + '</div></div>' +
          '<div class="kpi" style="flex:1;border:0;background:var(--raised);padding:8px 12px"><span>Персонал</span>' +
            '<div class="v" style="font-size:var(--fs-15)' + (shortfall > 0 ? ';color:var(--coral)' : '') + '">' +
            state.managers.length + ' / ' + state.branches + '</div></div>' +
        '</div>' +
        '<div style="margin-top:12px">' + list + '</div>' +
        (shortfall > 0
          ? '<div class="warn-note" style="margin-top:10px"><svg class="ic"><use href="#i-alert"/></svg>' +
            '<div><b>Некомплект персонала</b><p>Филиалов ' + state.branches + ', менеджеров ' + state.managers.length +
            '. Каждый месяц убыток ' + money(shortfall * 50000) + '.</p></div></div>'
          : '') +
        '<button class="btn btn-primary btn-block" style="margin-top:12px" type="button" data-open-branch' +
          (affordable ? '' : ' disabled title="Не хватает денег"') + '>' +
          'Открыть филиал · ' + money(state.branchCost) + '</button>' +
      '</div>' +
    '</section>';
  }

  /* ---------- Прогресс автопилота на странице «Клиенты» ---------- */
  function renderAutopilot() {
    var bar = document.querySelector('[data-ui="autopilot"]');
    if (!bar) return;

    var manager = null;
    state.managers.forEach(function (m) {
      if (!manager && m.autopilot) manager = m;
    });

    var target = manager ? state.autopilotTarget() : null;
    if (!manager || !target) {
      bar.hidden = true;
      return;
    }

    var days = state.managerDaysPerClient(manager);
    var hoursLeft = Math.max(0, Math.ceil((1 - manager.progress) * days * 24));

    bar.hidden = false;
    setText(bar.querySelector('[data-ui="ap-name"]'), manager.name + ' обрабатывает ' + target.name, 'ap-name');
    setText(bar.querySelector('[data-ui="ap-eta"]'), 'осталось ~' + hoursLeft + ' игровых часов', 'ap-eta');

    var fill = bar.querySelector('[data-ui="ap-fill"]');
    if (fill) fill.style.width = Math.round(manager.progress * 100) + '%';
  }

  /* ---------- Портфель ---------- */
  function pfSection(title, items) {
    if (!items.length) {
      return '<div class="pf-sec">' +
        '<div class="pf-head"><span>' + title + ' · 0</span><b>0 ₽</b></div>' +
        '<div class="pf-empty muted">Пока пусто</div>' +
      '</div>';
    }

    var total = items.reduce(function (sum, x) { return sum + x.amount; }, 0);
    var rows = items.map(function (x) {
      return '<div class="pf-row">' +
        '<span class="pf-name">' + x.name + '</span>' +
        '<span class="pf-amt">' + money(x.amount) + '</span>' +
        '<span class="pf-term">' + x.monthsLeft + ' мес</span>' +
        '<span class="pf-rate">' + rateLabel(x.rate) + '</span>' +
      '</div>';
    }).join('');

    return '<div class="pf-sec">' +
      '<div class="pf-head"><span>' + title + ' · ' + items.length + '</span><b>' + money(total) + '</b></div>' +
      rows +
    '</div>';
  }

  function renderPortfolio() {
    var box = document.querySelector('[data-ui="portfolio"]');
    if (!box) return;

    var loans = state.activeLoans || [];
    var deposits = state.activeDeposits || [];

    var signature = loans.map(function (x) { return x.id + ':' + x.monthsLeft; }).join(',') +
                    '#' + deposits.map(function (x) { return x.id + ':' + x.monthsLeft; }).join(',');
    if (signature === last.portfolio) return;
    last.portfolio = signature;

    box.innerHTML = pfSection('Выданные кредиты', loans) + pfSection('Принятые вклады', deposits);

    var total = document.querySelector('[data-ui="pf-total"]');
    if (total) total.textContent = money(loans.reduce(function (s2, x) { return s2 + x.amount; }, 0));
  }

  /* ---------- Прибыль в месяц ---------- */
  function renderProfit() {
    var value = document.querySelector('[data-ui="kpi-profit"]');
    if (!value) return;

    var income = state.monthlyIncome();
    var expense = state.monthlyExpense();
    var profit = income - expense;

    var parts = global.formatMoneyParts(profit);
    var html = parts.num + '<small>' + parts.unit + '</small>';
    if (last.profit !== html) {
      value.innerHTML = html;
      last.profit = html;
    }

    var note = document.querySelector('[data-ui="kpi-profit-d"]');
    if (note) {
      var sig = income + '|' + expense;
      if (last.profitNote !== sig) {
        last.profitNote = sig;
        note.innerHTML = '<span class="up">+' + money(income) + '</span> · <span class="down">−' + money(expense) + '</span>';
      }
    }
  }

  /* ---------- Вкладки на «Клиентах» ---------- */
  function bindTabs() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.tab;

        buttons.forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });

        var queue = document.querySelector('[data-ui="tab-queue"]');
        var portfolio = document.querySelector('[data-ui="tab-portfolio"]');
        if (queue) queue.hidden = name !== 'queue';
        if (portfolio) portfolio.hidden = name !== 'portfolio';
      });
    });
  }

  /* ---------- Процентная политика ---------- */
  function ratesHint(kind) {
    var best = kind === 'loan' ? state.bestLoanRate() : state.bestDepositRate();
    var mine = kind === 'loan' ? state.playerLoanRate : state.playerDepositRate;
    if (best === null) return 'конкурентов нет — ставку можно не трогать';

    var diff = kind === 'loan' ? best - mine : mine - best;
    var round = Math.abs(diff).toFixed(1).replace('.', ',');

    if (diff > 0.2) return 'выгоднее конкурентов на ' + round + ' п.п. — клиенты идут к вам';
    if (diff < -0.2) return 'хуже конкурентов на ' + round + ' п.п. — клиенты уходят';
    return 'на уровне рынка';
  }

  function renderRates() {
    var box = document.querySelector('[data-ui="rates"]');
    if (!box) return;

    var sig = [state.playerLoanRate, state.playerDepositRate, state.bestLoanRate(), state.bestDepositRate()].join('|');
    if (sig === last.rates) return;
    last.rates = sig;

    var rival = state.activeCompetitors();
    var rivalText = rival.length
      ? rival.map(function (c) { return c.name + ': вкл ' + c.depositRate + '% · кр ' + c.loanRate + '%'; }).join(' · ')
      : 'конкурентов не осталось';

    box.innerHTML = '<div class="card-h"><h2>Процентная политика</h2>' +
        '<div class="r"><a class="link-more" href="treasury.html">Казначейство →</a></div></div>' +
      '<div class="card-b rates-mini">' +
        '<div class="rm-cell"><span>Кредиты</span><b class="num">' + rateLabel(state.playerLoanRate) + '</b></div>' +
        '<div class="rm-cell"><span>Вклады</span><b class="num">' + rateLabel(state.playerDepositRate) + '</b></div>' +
        '<div class="rm-note small muted">' + rivalText + '</div>' +
      '</div>';
  }

  /* ---------- Бренд ---------- */
  var LOGO_COLORS = { gold: '#C8A04A', mint: '#3DDC97', blue: '#4DA3FF', violet: '#9B8CFF' };

  function renderBrand() {
    var name = String(state.bankName || 'Восток').toUpperCase();
    var letter = String(state.bankName || 'Восток').trim().charAt(0).toUpperCase();
    var color = LOGO_COLORS[state.logoColor] || LOGO_COLORS.gold;

    var label = 'БАНК «' + name + '»';
    Array.prototype.forEach.call(document.querySelectorAll('[data-ui="bankname"]'), function (node) {
      /* в кэш setText ключ один на все узлы — сравниваем напрямую */
      if (node.textContent !== label) node.textContent = label;
    });

    Array.prototype.forEach.call(document.querySelectorAll('.brand-mark'), function (node) {
      if (node.textContent !== letter) node.textContent = letter;
      node.style.background = color;
    });
  }

  /* ---------- Профиль ---------- */
  function renderProfile() {
    var head = document.querySelector('[data-ui="profile-head"]');
    if (!head) return;

    var got = state.achievementList().filter(function (a) { return a.got; });
    var total = state.achievementList().length;
    var days = state.elapsedDays || 0;
    var color = LOGO_COLORS[state.logoColor] || LOGO_COLORS.gold;
    var letter = String(state.bankName || 'В').trim().charAt(0).toUpperCase();

    head.innerHTML =
      '<div class="ph-mono" style="background:' + color + '">' + letter + '</div>' +
      '<div class="ph-body">' +
        '<h1>' + state.bankName + '</h1>' +
        '<div class="ph-meta">' + state.stageName() + ' · основатель: ' + state.founderName + '</div>' +
        '<div class="ph-meta muted">Дней в деле: ' + days + '</div>' +
      '</div>' +
      '<div class="ph-level">' + state.bankStage + '<i>/7</i></div>';

    var stats = document.querySelector('[data-ui="profile-stats"]');
    if (stats) {
      var cells = [
        { label: 'Капитал', value: money(state.capital) },
        { label: 'Репутация', value: String(state.reputation) },
        { label: 'Филиалы', value: String(state.branches) },
        { label: 'Менеджеры', value: String(state.managers.length) },
        { label: 'Выдано кредитов', value: String(state.totalLoansIssued || 0) },
        { label: 'Принято вкладов', value: String(state.totalDepositsTaken || 0) }
      ];

      stats.innerHTML = cells.map(function (c) {
        return '<div class="stat-cell"><span>' + c.label + '</span><b class="num">' + c.value + '</b></div>';
      }).join('');
    }

    var ach = document.querySelector('[data-ui="profile-ach"]');
    if (ach) {
      var icons = state.achievementList().map(function (a) {
        return '<span class="ach-mini' + (a.got ? ' is-got' : '') + '" title="' + a.name + '">' +
          (a.got ? '🏆' : '🔒') + '</span>';
      }).join('');

      ach.innerHTML = '<section class="card">' +
        '<div class="card-h"><h2>Достижения</h2>' +
          '<div class="r"><a class="link-more" href="achievements.html">Все →</a></div></div>' +
        '<div class="card-b">' +
          '<div class="between" style="margin-bottom:10px">' +
            '<b>' + got.length + ' из ' + total + '</b>' +
            '<span class="small muted">' + Math.round((got.length / total) * 100) + '%</span>' +
          '</div>' +
          '<div class="track"><i style="width:' + Math.round((got.length / total) * 100) + '%"></i></div>' +
          '<div class="ach-minirow">' + icons + '</div>' +
        '</div>' +
      '</section>';
    }

    var sw = document.querySelector('[data-ui="sw-status"]');
    if (sw) {
      var active = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
      sw.textContent = 'Service Worker: ' + (active ? 'оффлайн активен' : 'прогрев');
    }
  }

  /* ---------- Казначейство ---------- */
  var treasuryTab = 'rates';

  function ratesHistoryHtml() {
    var log = state.ratesLog.slice(-10);
    if (!log.length) return '<div class="muted small">История появится, когда пройдёт первый игровой день.</div>';

    return log.map(function (item) {
      return '<div class="hist-row">' +
        '<span class="muted">д. ' + item.day + '</span>' +
        '<span class="num">' + rateLabel(item.loan) + '</span>' +
        '<span class="num">' + rateLabel(item.dep) + '</span>' +
      '</div>';
    }).join('');
  }

  function fxCardHtml(code, title) {
    var c = state.currencies[code];
    var delta = ((c.rate - c.prev) / c.prev) * 100;
    var buy = state.fxPrice(code, 'buy');
    var sell = state.fxPrice(code, 'sell');
    var avg = c.amount > 0 ? c.cost / c.amount : 0;
    var pnl = c.amount * c.rate - c.cost;

    return '<div class="fx-card">' +
      '<div class="fx-top">' +
        '<b>' + title + '</b>' +
        '<span class="num fx-rate">' + c.rate.toFixed(2).replace('.', ',') + ' ₽</span>' +
        '<span class="tiny num ' + (delta >= 0 ? 'up' : 'down') + '">' +
          (delta >= 0 ? '▲ +' : '▼ ') + Math.abs(delta).toFixed(2).replace('.', ',') + '%</span>' +
      '</div>' +
      '<div class="fx-meta small muted">' +
        'у вас ' + c.amount.toFixed(2) + ' · средняя ' + avg.toFixed(2).replace('.', ',') + ' ₽' +
        (pnl < -0.5 ? ' · <span class="down">убыток ' + money(Math.abs(pnl)) + '</span>'
                    : pnl > 0.5 ? ' · <span class="up">+' + money(pnl) + '</span>' : '') +
      '</div>' +
      '<div class="fx-buy">' + buy.toFixed(2).replace('.', ',') + ' ₽</div>' +
      '<div class="fx-sell">' + sell.toFixed(2).replace('.', ',') + ' ₽</div>' +
      '<div class="fx-form">' +
        '<input type="number" min="0" step="1000" placeholder="₽" data-fx-buy-sum="' + code + '" aria-label="Сумма в рублях">' +
        '<button class="btn btn-sm" type="button" data-fx-buy="' + code + '">Купить</button>' +
        '<input type="number" min="0" step="100" placeholder="' + title + '" data-fx-sell-sum="' + code + '" aria-label="Сумма в валюте">' +
        '<button class="btn btn-sm" type="button" data-fx-sell="' + code + '">Продать</button>' +
      '</div>' +
    '</div>';
  }

  function treasuryRates() {
    return '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>Процентная политика</h2><div class="r">сравнение с рынком</div></div>' +
          '<div class="card-b rates">' +
            '<div class="rate-block">' +
              '<div class="between"><span>Кредиты</span><b class="num" data-rate-value="loan">' + rateLabel(state.playerLoanRate) + '</b></div>' +
              '<input type="range" min="5" max="35" step="0.5" value="' + state.playerLoanRate + '" data-rate="loan" aria-label="Ставка по кредитам">' +
              '<div class="small muted">' + ratesHint('loan') + '</div>' +
            '</div>' +
            '<div class="rate-block">' +
              '<div class="between"><span>Вклады</span><b class="num" data-rate-value="deposit">' + rateLabel(state.playerDepositRate) + '</b></div>' +
              '<input type="range" min="1" max="25" step="0.5" value="' + state.playerDepositRate + '" data-rate="deposit" aria-label="Ставка по вкладам">' +
              '<div class="small muted">' + ratesHint('deposit') + '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>История ставок</h2><div class="r">10 дней</div></div>' +
          '<div class="card-b">' +
            '<div class="hist-head small muted"><span>день</span><span>кредиты</span><span>вклады</span></div>' +
            ratesHistoryHtml() +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function treasuryLiquidity() {
    var res = state.reserved;
    var liquid = state.liquidFunds();
    var ratios = state.computeRatios();

    return '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>Ликвидность</h2><div class="r">резервы</div></div>' +
          '<div class="card-b">' +
            '<div class="liq-row"><span class="muted">Капитал всего</span><b class="num">' + money(state.capital) + '</b></div>' +
            '<div class="liq-row"><span class="muted">Свободные средства</span><b class="num up">' + money(liquid) + '</b></div>' +
            '<div class="liq-row"><span class="muted">В резерве</span><b class="num">' + money(res) + '</b></div>' +
            '<div class="hr"></div>' +
            '<div class="liq-row"><span class="muted">Н1 сейчас</span><b class="num">' + rateLabel(Math.min(ratios.h1, 999)) + '</b></div>' +
            '<div class="small muted" style="margin-top:6px">Резерв учитывается в числителе Н1, но замораживается: эти деньги нельзя выдать в кредит.</div>' +
            '<div class="hr"></div>' +
            '<input type="number" min="0" step="100000" placeholder="Сумма, ₽" data-reserve-sum aria-label="Сумма резерва">' +
            '<div class="row" style="gap:8px;margin-top:8px">' +
              '<button class="btn btn-primary" type="button" data-reserve-add>Отправить в резерв</button>' +
              '<button class="btn" type="button" data-reserve-remove>Вывести из резерва</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>Зачем это</h2><div class="r">регулятор</div></div>' +
          '<div class="card-b small muted" style="line-height:1.5">' +
            'Н1 — достаточность капитала: капитал к выданным кредитам. На проверке ЦБ минимум 8%.<br><br>' +
            'Резерв повышает Н1, но уменьшает сумму, доступную для выдачи кредитов и МБК. ' +
            'Держите его, когда ждёте проверку или готовитесь к оттоку вкладов.' +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function treasuryFx() {
    var fx = state.fxPosition();

    return '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>Курсы</h2><div class="r">обновляются каждый игровой день</div></div>' +
          '<div class="card-b">' +
            fxCardHtml('usd', 'USD') +
            fxCardHtml('eur', 'EUR') +
            fxCardHtml('cny', 'CNY') +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>Спред</h2><div class="r">' + state.fxSpread.toFixed(1).replace('.', ',') + '%</div></div>' +
          '<div class="card-b">' +
            '<input type="range" min="0" max="5" step="0.1" value="' + state.fxSpread + '" data-fx-spread aria-label="Спред">' +
            '<div class="small muted" style="margin-top:8px">Покупка — по курсу плюс спред, продажа — минус. Чем шире спред, тем больше зарабатываете на обмене, но меньше клиентов меняют.</div>' +
            '<div class="hr"></div>' +
            '<div class="liq-row"><span class="muted">Портфель валют</span><b class="num">' + money(fx.value) + '</b></div>' +
            '<div class="liq-row"><span class="muted">Вложено рублей</span><b class="num">' + money(fx.cost) + '</b></div>' +
            '<div class="liq-row"><span class="muted">' + (fx.pnl >= 0 ? 'Курсовая прибыль' : 'Курсовой убыток') + '</span>' +
              '<b class="num ' + (fx.pnl >= 0 ? 'up' : 'down') + '">' + (fx.pnl >= 0 ? '+' : '−') + money(Math.abs(fx.pnl)) + '</b></div>' +
            (fx.pnl < -0.5
              ? '<div class="warn-line" style="margin-top:10px">Курсовой убыток: ' + money(Math.abs(fx.pnl)) + ' ₽</div>'
              : '') +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function treasuryInvest() {
    var inv = state.investments;
    var cbClass = inv.cbLoan > 0 ? 'down' : 'up';

    var bonds = inv.bonds.length
      ? inv.bonds.map(function (b) {
          return '<div class="liq-row"><span class="muted">' +
            (b.type === 'ofz' ? 'ОФЗ' : 'Корп.') + ' · ' + b.rate + '% · ' + b.monthsLeft + ' мес</span>' +
            '<b class="num">' + money(b.amount) + '</b></div>';
        }).join('')
      : '<div class="muted small">Портфель пуст</div>';

    return '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>Кредит ЦБ</h2><div class="r">25% годовых</div></div>' +
          '<div class="card-b">' +
            '<div class="liq-row"><span class="muted">Долг перед ЦБ</span>' +
              '<b class="num ' + cbClass + '">' + money(inv.cbLoan) + '</b></div>' +
            '<input type="number" min="0" step="1000000" placeholder="Сумма, ₽" data-cb-sum aria-label="Сумма кредита ЦБ">' +
            '<div class="row" style="gap:8px;margin-top:8px">' +
              '<button class="btn btn-primary" type="button" data-cb-take>Взять кредит ЦБ</button>' +
              '<button class="btn" type="button" data-cb-repay>Погасить</button>' +
            '</div>' +
            '<div class="small muted" style="margin-top:8px">Проценты списываются каждый месяц. Спасает от банкротства, но долг давит на капитал.</div>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-h"><h2>Межбанковский кредит</h2><div class="r">6 месяцев</div></div>' +
          '<div class="card-b">' +
            '<div class="liq-row"><span class="muted">Взято (15%)</span><b class="num down">' + money(inv.mbkTaken.amount) + '</b></div>' +
            '<div class="liq-row"><span class="muted">Выдано (12%)</span><b class="num up">' + money(inv.mbkGiven.amount) + '</b></div>' +
            '<input type="number" min="0" step="1000000" placeholder="Сумма, ₽" data-mbk-sum aria-label="Сумма МБК">' +
            '<div class="row" style="gap:8px;margin-top:8px">' +
              '<button class="btn" type="button" data-mbk-take>Взять МБК</button>' +
              '<button class="btn" type="button" data-mbk-give>Дать МБК</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="dash-col">' +
        '<section class="card">' +
          '<div class="card-h"><h2>Облигации</h2><div class="r">' + money(state.bondsValue()) + '</div></div>' +
          '<div class="card-b">' +
            '<input type="number" min="0" step="100000" placeholder="Сумма, ₽" data-bond-sum aria-label="Сумма облигаций">' +
            '<div class="row" style="gap:8px;margin-top:8px">' +
              '<button class="btn btn-primary" type="button" data-bond="ofz">Купить ОФЗ · 8%</button>' +
              '<button class="btn" type="button" data-bond="corp">Корпоративные · 15%</button>' +
            '</div>' +
            '<div class="hr"></div>' +
            bonds +
            '<div class="small muted" style="margin-top:8px">Купоны капают каждый месяц. У корпоративных есть риск дефолта эмитента.</div>' +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function renderTreasury() {
    var panel = document.querySelector('[data-ui="treasury-panel"]');
    if (!panel) return;

    var body = treasuryTab === 'rates' ? treasuryRates()
      : treasuryTab === 'liquidity' ? treasuryLiquidity()
      : treasuryTab === 'fx' ? treasuryFx()
      : treasuryInvest();

    panel.innerHTML = '<div class="dash">' + body + '</div>';

    var tabs = document.querySelectorAll('[data-ttab]');
    Array.prototype.forEach.call(tabs, function (btn) {
      var on = btn.dataset.ttab === treasuryTab;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function bindTreasury() {
    var panel = document.querySelector('[data-ui="treasury-panel"]');
    if (!panel) return;

    document.addEventListener('click', function (event) {
      var tab = event.target.closest && event.target.closest('[data-ttab]');
      if (tab) {
        treasuryTab = tab.dataset.ttab;
        renderTreasury();
        return;
      }

      var el = event.target.closest && event.target.closest('[data-reserve-add],[data-reserve-remove],[data-fx-buy],[data-fx-sell],[data-cb-take],[data-cb-repay],[data-mbk-take],[data-mbk-give],[data-bond]');
      if (!el) return;

      var res;
      var toast = function (text) { if (typeof global.showToast === 'function') global.showToast(text); };
      var num = function (sel) {
        var input = document.querySelector(sel);
        return input ? Number(input.value) || 0 : 0;
      };

      if (el.hasAttribute('data-reserve-add')) {
        res = state.reserveAdd(num('[data-reserve-sum]'));
        toast(res.ok ? 'В резерв: ' + money(res.paid) : res.error === 'money' ? 'Свободно только ' + money(res.available) : 'Не вышло');
      } else if (el.hasAttribute('data-reserve-remove')) {
        res = state.reserveRemove(num('[data-reserve-sum]'));
        toast(res.ok ? 'Из резерва: ' + money(num('[data-reserve-sum]')) : 'В резерве меньше');
      } else if (el.hasAttribute('data-fx-buy')) {
        res = state.fxBuy(el.dataset.fxBuy, num('[data-fx-buy-sum="' + el.dataset.fxBuy + '"]'));
        toast(res.ok ? 'Куплено ' + res.amount.toFixed(2) + ' по ' + res.price.toFixed(2) + ' ₽' : 'Не хватает рублей');
      } else if (el.hasAttribute('data-fx-sell')) {
        res = state.fxSell(el.dataset.fxSell, num('[data-fx-sell-sum="' + el.dataset.fxSell + '"]'));
        toast(res.ok ? 'Продано за ' + money(res.rub) : 'Столько валюты нет');
      } else if (el.hasAttribute('data-cb-take')) {
        res = state.takeCBLoan(num('[data-cb-sum]'));
        toast(res.ok ? 'Кредит ЦБ получен' : 'Укажите сумму');
      } else if (el.hasAttribute('data-cb-repay')) {
        res = state.repayCBLoan(num('[data-cb-sum]'));
        toast(res.ok ? 'Долг перед ЦБ: ' + money(res.debt) : 'Не хватает средств');
      } else if (el.hasAttribute('data-mbk-take')) {
        res = state.takeMBK(num('[data-mbk-sum]'));
        toast(res.ok ? 'МБК получен' : 'Укажите сумму');
      } else if (el.hasAttribute('data-mbk-give')) {
        res = state.giveMBK(num('[data-mbk-sum]'));
        toast(res.ok ? 'МБК выдан' : 'Не хватает свободных средств');
      } else if (el.hasAttribute('data-bond')) {
        res = state.buyBond(el.dataset.bond, num('[data-bond-sum]'));
        toast(res.ok ? 'Облигации куплены' : 'Не хватает свободных средств');
      }

      render();
    });

    document.addEventListener('input', function (event) {
      var spread = event.target.closest && event.target.closest('[data-fx-spread]');
      if (!spread) return;
      state.fxSpread = Number(spread.value);
      state.save();
      renderTreasury();
    });
  }

  /* ---------- Биржа ---------- */
  function renderStocks() {
    var list = document.querySelector('[data-ui="stocks-list"]');
    if (!list) return;

    var sub = document.querySelector('[data-ui="stocks-sub"]');
    if (sub) setText(sub, 'свободно ' + money(state.capital) + ' · комиссия 0,3%', 'stocksSub');

    var myLoan = document.querySelector('[data-ui="my-loan"]');
    if (myLoan) setText(myLoan, rateLabel(state.playerLoanRate), 'myLoan');

    var myDep = document.querySelector('[data-ui="my-deposit"]');
    if (myDep) setText(myDep, rateLabel(state.playerDepositRate), 'myDep');

    var count = document.querySelector('[data-ui="stocks-count"]');
    if (count) setText(count, String(state.competitors.filter(function (c) { return c.status === 'competitor'; }).length), 'stocksCount');

    var sig = state.competitors.map(function (c) {
      return c.id + ':' + c.playerShare + ':' + c.status;
    }).join('|') + '#' + Math.round(state.capital);
    if (sig === last.stocks) return;
    last.stocks = sig;

    list.innerHTML = state.competitors.map(function (c) {
      var subsidiary = c.status === 'subsidiary';
      var price5 = state.packagePrice(c, 5);
      var price10 = state.packagePrice(c, 10);
      var can5 = state.capital >= price5;
      var can10 = state.capital >= price10;
      var tone = subsidiary ? 'badge-mint' : (c.strategy === 'агрессивный' ? 'badge-coral' : 'badge-muted');

      return '<div class="stock' + (subsidiary ? ' is-sub' : '') + '">' +
        '<div class="stock-top">' +
          '<b>' + c.name + '</b>' +
          '<span class="badge ' + tone + '">' + (subsidiary ? 'дочерний' : c.strategy) + '</span>' +
          '<span class="stock-price num">' + state.sharePrice(c) + ' ₽</span>' +
        '</div>' +
        '<div class="stock-meta">' +
          'вклады <b>' + rateLabel(c.depositRate) + '</b> · кредиты <b>' + rateLabel(c.loanRate) + '</b>' +
          ' · капитал ' + money(c.capital) +
        '</div>' +
        '<div class="stock-share">' +
          '<div class="track"><i style="width:' + Math.min(100, c.playerShare) + '%"></i></div>' +
          '<span class="num">' + c.playerShare + '%</span>' +
        '</div>' +
        (subsidiary
          ? '<div class="stock-note mint">Капитал и клиенты перешли вам</div>'
          : '<div class="stock-actions">' +
              '<button class="btn btn-sm" type="button" data-buy="' + c.id + '" data-pct="5"' +
                (can5 ? '' : ' disabled') + '>Купить 5% · ' + money(price5) + '</button>' +
              '<button class="btn btn-sm" type="button" data-buy="' + c.id + '" data-pct="10"' +
                (can10 ? '' : ' disabled') + '>10% · ' + money(price10) + '</button>' +
            '</div>' +
            (c.playerShare >= 20
              ? '<div class="stock-warn">⚠ Требуется согласие ЦБ на покупку &gt;20%</div>'
              : '')) +
      '</div>';
    }).join('');
  }

  /* ---------- Нормативы на дашборде ---------- */
  function renderRatios() {
    var box = document.querySelector('[data-ui="ratios"]');
    if (!box) return;

    var r = state.computeRatios();
    var sig = [r.h1, r.h2, r.h3].join('|');
    if (sig === last.ratios) return;
    last.ratios = sig;

    var rows = [
      { name: 'Н1 · достаточность', value: r.h1, min: 8 },
      { name: 'Н2 · мгновенная ликв.', value: r.h2, min: 15 },
      { name: 'Н3 · текущая ликв.', value: r.h3, min: 50 }
    ];

    box.innerHTML = rows.map(function (x) {
      var capped = Math.min(x.value, 999);
      var ok = capped >= x.min;
      var width = Math.max(4, Math.min(100, capped));
      var dev = Math.abs(capped - x.min).toFixed(1).replace('.', ',');

      return '<div class="gauge">' +
        '<div class="gauge-h"><span>' + x.name + '</span>' +
          '<b class="num ' + (ok ? 'up' : 'down') + '">' + (capped >= 999 ? '—' : rateLabel(capped)) + '</b></div>' +
        '<div class="track"><i class="' + (ok ? '' : 'is-bad') + '" style="width:' + width + '%"></i>' +
          '<u style="left:' + Math.min(96, x.min) + '%"></u></div>' +
        '<div class="gauge-f"><span>минимум ' + x.min + '%</span>' +
          '<span class="' + (ok ? 'up' : 'down') + '">' + (ok ? '+' : '−') + dev + ' п.п.</span></div>' +
      '</div>';
    }).join('');
  }

  /* ---------- Уведомления ---------- */
  var notifFilter = 'all';
  var notifLimit = 30;

  var NOTIF_META = {
    money: { ico: '💵', label: 'Финансы' },
    people: { ico: '👥', label: 'Персонал' },
    cbr: { ico: '⚖️', label: 'ЦБ' },
    competitor: { ico: '📈', label: 'Конкуренты' },
    security: { ico: '🛡', label: 'Безопасность' },
    achievement: { ico: '🏆', label: 'Достижения' },
    system: { ico: '⚙️', label: 'Система' }
  };

  function renderBell() {
    var unread = state.unreadCount();
    Array.prototype.forEach.call(document.querySelectorAll('[data-ui="unread"]'), function (node) {
      node.textContent = unread > 99 ? '99+' : String(unread);
      node.hidden = unread === 0;
    });
  }

  function notifDateLabel(day) {
    var days = state.log.map(function (e) { return e.day; });
    var latest = days.length ? Math.max.apply(null, days) : state.dayNumber;

    if (day === latest) return 'Сегодня';
    if (day === latest - 1) return 'Вчера';
    return 'День ' + day;
  }

  function renderNotifications() {
    var list = document.querySelector('[data-ui="notif-list"]');
    if (!list) return;

    var entries = state.log.slice().reverse();
    var unread = state.unreadCount();

    var sub = document.querySelector('[data-ui="notif-sub"]');
    if (sub) sub.textContent = 'непрочитанных: ' + unread + ' · всего ' + entries.length;

    /* фильтры */
    var filters = document.querySelector('[data-ui="notif-filters"]');
    if (filters) {
      var chips = [{ id: 'all', label: 'Все' }].concat(Object.keys(NOTIF_META).filter(function (k) {
        return k !== 'system';
      }).map(function (k) {
        return { id: k, label: NOTIF_META[k].label };
      }));

      filters.innerHTML = chips.map(function (c) {
        return '<button class="chip' + (notifFilter === c.id ? ' is-on' : '') + '" type="button" data-notif-filter="' +
          c.id + '">' + c.label + '</button>';
      }).join('');
    }

    var visible = notifFilter === 'all'
      ? entries
      : entries.filter(function (e) { return e.category === notifFilter; });

    var more = document.querySelector('[data-notif-more]');
    if (more) more.hidden = visible.length <= notifLimit;

    if (!visible.length) {
      list.innerHTML = '<section class="card"><div class="card-b"><div class="muted">Пока тихо. Всё под контролем.</div></div></section>';
      return;
    }

    var slice = visible.slice(0, notifLimit);
    var html = '';
    var lastDay = null;

    slice.forEach(function (e) {
      if (e.day !== lastDay) {
        lastDay = e.day;
        html += '<div class="notif-day">' + notifDateLabel(e.day) + '</div>';
      }

      var meta = NOTIF_META[e.category] || NOTIF_META.system;

      html += '<div class="notif' + (e.read ? '' : ' is-unread') + '" data-notif="' + e.id + '"' +
        (e.link ? ' role="link" tabindex="0"' : '') + '>' +
        '<span class="notif-ico">' + meta.ico + '</span>' +
        '<div class="notif-body">' +
          '<div class="notif-top"><b>' + e.title + '</b>' +
            '<span class="small muted">день ' + e.day + '</span></div>' +
          '<div class="notif-msg">' + e.message + '</div>' +
        '</div>' +
        (e.read ? '' : '<span class="notif-dot"></span>') +
      '</div>';
    });

    list.innerHTML = html;
  }

  function bindNotifications() {
    document.addEventListener('click', function (event) {
      var readAll = event.target.closest && event.target.closest('[data-notif-readall]');
      if (readAll) {
        state.markAllRead();
        if (typeof global.showToast === 'function') global.showToast('Все уведомления прочитаны');
        render();
        return;
      }

      var more = event.target.closest && event.target.closest('[data-notif-more]');
      if (more) {
        notifLimit += 30;
        renderNotifications();
        return;
      }

      var chip = event.target.closest && event.target.closest('[data-notif-filter]');
      if (chip) {
        notifFilter = chip.dataset.notifFilter;
        notifLimit = 30;
        renderNotifications();
        return;
      }

      var item = event.target.closest && event.target.closest('[data-notif]');
      if (item) {
        var id = item.dataset.notif;
        var entry = null;
        for (var i = 0; i < state.log.length; i += 1) {
          if (state.log[i].id === id) entry = state.log[i];
        }
        if (!entry) return;

        state.markRead(id);

        if (entry.link) {
          window.location.href = entry.link;
          return;
        }

        render();
      }
    });
  }

  /* ---------- Достижения ---------- */
  function renderAchievements() {
    var box = document.querySelector('[data-ui="achievements"]');
    var counter = document.querySelector('[data-ui="ach-count"]');

    if (!box) {
      if (counter) {
        var list0 = state.achievementList();
        counter.textContent = list0.filter(function (a) { return a.got; }).length + '/' + list0.length;
      }
      return;
    }

    var list = state.achievementList();
    var got = list.filter(function (a) { return a.got; }).length;

    if (counter) counter.textContent = got + ' / ' + list.length;

    var head = document.querySelector('[data-ui="ach-head"]');
    if (head) head.textContent = 'получено ' + got + ' из ' + list.length;

    box.innerHTML = list.map(function (a) {
      var percent = a.got ? 100 : Math.max(0, Math.min(100, (a.value / a.target) * 100));

      return '<div class="ach' + (a.got ? ' is-got' : '') + '">' +
        '<span class="ach-ico">' + (a.got ? '🏆' : '🔒') + '</span>' +
        '<div class="ach-body">' +
          '<div class="ach-top"><b>' + a.name + '</b>' +
            (a.got ? '<span class="badge badge-gold">получено</span>' : '') + '</div>' +
          '<div class="small muted">' + a.desc + '</div>' +
          '<div class="ach-bar"><div class="track"><i style="width:' + percent + '%"></i></div>' +
            '<span class="small muted num">' + a.text + '</span></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------- Служба безопасности ---------- */
  function renderSecurity() {
    var shield = document.querySelector('[data-ui="security"]');
    if (shield) setText(shield, String(state.securityLevel), 'security');

    var panel = document.querySelector('[data-ui="security-panel"]');
    var incidents = document.querySelector('[data-ui="incidents-panel"]');

    if (panel) {
      var moles = state.moles();
      var level = state.securityLevel;
      var nextCost = 500000;

      panel.innerHTML = '<section class="card">' +
        '<div class="card-h"><h2>Уровень СБ</h2><div class="r">' + level + ' / 100</div></div>' +
        '<div class="card-b">' +
          '<div class="sec-level"><b class="num">' + level + '</b><span>/100</span></div>' +
          '<div class="track"><i class="' + (level >= 60 ? '' : 'is-bad') + '" style="width:' + level + '%"></i></div>' +
          '<div class="small muted" style="margin-top:8px">шанс поймать крота — ' + level + '% за месяц</div>' +
          '<div class="hr"></div>' +
          '<div class="between small" style="margin-bottom:8px">' +
            '<span class="muted">Кроты в штате</span>' +
            '<b class="' + (moles.length ? 'down' : 'up') + '">' + (moles.length ? moles.map(function (m) { return m.name; }).join(', ') : 'не выявлено') + '</b>' +
          '</div>' +
          '<div class="row" style="gap:8px">' +
            '<button class="btn" type="button" data-sec="10" data-cost="300000">Улучшить +10 · 300 000 ₽</button>' +
            '<button class="btn btn-primary" type="button" data-sec="20" data-cost="500000">Нанять безопасника +20 · 500 000 ₽</button>' +
          '</div>' +
          '<div class="small muted" style="margin-top:10px">Менеджеры с лояльностью ниже 40 — лёгкая добыча для конкурентов. ' +
            'Застой (без повышения) съедает 2–5 пунктов лояльности в месяц.</div>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-h"><h2>Люди</h2><div class="r">' + state.managers.length + ' в штате</div></div>' +
        '<div class="card-b">' +
          state.managers.map(function (m) {
            return '<div class="between" style="padding:7px 0;border-top:1px solid var(--border)">' +
              '<span>' + m.name + '</span>' +
              '<span class="row" style="gap:8px"><span class="small muted num">' + m.loyalty + '</span>' +
                '<span class="badge ' + (m.mole ? 'badge-coral' : 'badge-mint') + '">' + (m.mole ? 'крот' : 'чист') + '</span>' +
              '</span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</section>';
    }

    if (incidents) {
      var list = state.incidents.slice(-12).reverse();
      var labels = { leak: 'утечка', recruit: 'вербовка', caught: 'поимка', upgrade: 'апгрейд' };
      var tones = { leak: 'badge-coral', recruit: 'badge-coral', caught: 'badge-mint', upgrade: 'badge-muted' };

      incidents.innerHTML = '<section class="card">' +
        '<div class="card-h"><h2>Инциденты</h2><div class="r">' + state.incidents.length + ' всего</div></div>' +
        '<div class="card-b">' +
          (list.length
            ? list.map(function (i) {
                return '<div class="inc-row">' +
                  '<span class="t">д. ' + i.day + '</span>' +
                  '<span class="badge ' + (tones[i.type] || 'badge-muted') + '">' + (labels[i.type] || i.type) + '</span>' +
                  '<span class="inc-text">' + i.text + '</span>' +
                '</div>';
              }).join('')
            : '<div class="muted small">Пока тихо. Инциденты появятся, если у менеджеров упадёт лояльность.</div>') +
        '</div>' +
      '</section>';
    }
  }

  /* ---------- Репутация ---------- */
  function renderReputation() {
    var value = document.querySelector('[data-ui="reputation"]');
    if (value) setText(value, String(Math.round(state.reputation)), 'rep');

    var bar = document.querySelector('[data-ui="rep-bar"]');
    if (bar) bar.style.width = Math.round(state.reputation) + '%';
  }

  /* ---------- Проверка ЦБ ---------- */
  function cbrRowHtml(row) {
    var hasValue = row.fact < 999;
    var dev = Math.abs(row.fact - row.min);
    var devText = hasValue ? (row.ok ? '+' : '−') + dev.toFixed(2).replace('.', ',') + ' п.п.' : '—';

    return '<div class="cbr-row' + (row.ok ? '' : ' is-bad') + '">' +
      '<span class="cbr-name">' + row.label + '</span>' +
      '<span class="cbr-facts">' +
        '<span class="cbr-fact">' + (hasValue ? rateLabel(row.fact) : '—') + '</span>' +
        '<span class="cbr-min">' + rateLabel(row.min) + '</span>' +
        '<span class="cbr-dev ' + (row.ok ? 'up' : 'down') + '">' + devText + '</span>' +
      '</span>' +
      '<span class="cbr-status"><span class="badge ' + (row.ok ? 'badge-mint' : 'badge-coral') + '">' +
        (row.ok ? 'в норме' : 'нарушение') + '</span></span>' +
      '<span class="cbr-fine' + (row.ok ? ' muted' : '') + '">' + (row.ok ? '—' : money(row.fine)) + '</span>' +
    '</div>';
  }

  function cbrStepsHtml(insp) {
    var bad = insp.rows.some(function (r) { return !r.ok; });
    var done2 = insp.resolved ? 'done' : (bad ? 'bad' : 'done');
    var done3 = insp.resolved ? 'done' : 'now';
    var done4 = insp.resolved ? (insp.resolvedOk ? 'done' : 'bad') : '';

    return '<div class="step done"><i>✓</i><span>Документы</span></div>' +
      '<div class="step-line"></div>' +
      '<div class="step ' + done2 + '"><i>' + (bad ? '✗' : '✓') + '</i><span>Нормативы</span></div>' +
      '<div class="step-line"></div>' +
      '<div class="step ' + done3 + '"><i>3</i><span>Решение</span></div>' +
      '<div class="step-line"></div>' +
      '<div class="step ' + done4 + '"><i>4</i><span>Итог</span></div>';
  }

  function cbrOutcomeHtml(insp) {
    var titles = {
      accept: insp.fine > 0 ? 'Предписание принято' : 'Проверка пройдена',
      'bribe-ok': 'Взятка сработала',
      'bribe-fail': 'Провал взятки'
    };
    var texts = {
      accept: insp.fine > 0
        ? 'Штраф ' + money(insp.fine) + ' списан · репутация −4 · строгий контроль ЦБ.'
        : 'Нарушений не выявлено — банк работает штатно.',
      'bribe-ok': 'Списано ' + money(insp.resolvedFine) + ' · репутация −2. Проверка закрыта, нарушения скрыты.',
      'bribe-fail': 'Проверяющий оказался честным. Штраф ' + money(insp.resolvedFine) + ' · репутация −12.'
    };

    return '<div class="outcome ' + (insp.resolvedOk ? 'is-ok' : 'is-fail') + '">' +
      '<svg class="ic" style="width:22px;height:22px;flex:0 0 22px"><use href="#' +
        (insp.resolvedOk ? 'i-check' : 'i-alert') + '"/></svg>' +
      '<div style="flex:1"><h3>' + (titles[insp.result] || 'Итог') + '</h3>' +
      '<p>' + (texts[insp.result] || '') + '</p></div>' +
      '<a class="btn btn-ghost" href="index.html" style="align-self:flex-start">Вернуться на Обзор</a>' +
    '</div>';
  }

  function renderInspection() {
    var body = document.querySelector('[data-ui="cbr-body"]');
    if (!body) return;

    var insp = state.inspection;
    var meta = document.querySelector('[data-ui="cbr-meta"]');
    var count = document.querySelector('[data-ui="cbr-count"]');
    var steps = document.querySelector('[data-ui="cbr-steps"]');

    if (!insp) {
      if (meta) meta.textContent = 'активной проверки нет';
      if (count) count.textContent = '—';
      if (steps) steps.innerHTML = '';
      body.innerHTML = '<section class="card"><div class="card-b">' +
        '<div class="muted">Регулятор придёт на ' + state.nextInspectionDay + '-й игровой день. ' +
        'Проверку можно вызвать вручную: <code>GameState.startInspection()</code></div>' +
        '<div style="margin-top:14px"><a class="btn" href="index.html">Вернуться на Обзор</a></div>' +
        '</div></section>';
      return;
    }

    var bad = insp.rows.filter(function (r) { return !r.ok; });

    if (meta) meta.textContent = 'день ' + insp.day + ' · охват: все филиалы · инспектор Савельев Д. К.';
    if (count) count.textContent = bad.length ? bad.length + ' нарушения' : 'нарушений нет';
    if (steps) steps.innerHTML = cbrStepsHtml(insp);

    var table = '<section class="card">' +
      '<div class="card-h"><h2>Проверка нормативов</h2><div class="r">методика ЦБ · 5-я редакция</div></div>' +
      '<div class="cbr-head-row" aria-hidden="true">' +
        '<span>Норматив</span><span>Факт</span><span>Минимум</span>' +
        '<span>Отклонение</span><span>Статус</span><span>Штраф</span>' +
      '</div>' +
      insp.rows.map(cbrRowHtml).join('') +
      '<div class="card-f">' +
        '<svg class="ic" style="width:13px;height:13px;color:var(--amber)"><use href="#i-alert"/></svg>' +
        'Итого штраф <b class="num" style="color:var(--text)">' + money(insp.fine) + '</b>' +
        '<span class="ml-auto">кредитов ' + money(insp.loansTotal) + ' · вкладов ' + money(insp.depositsTotal) + '</span>' +
      '</div>' +
    '</section>';

    if (insp.resolved) {
      body.innerHTML = table + cbrOutcomeHtml(insp);
      return;
    }

    var decisions;

    if (!bad.length) {
      decisions = '<section class="decision">' +
        '<h3>Нарушений не выявлено</h3>' +
        '<p>Нормативы в порядке. Регулятор закрывает проверку без предписания.</p>' +
        '<button class="btn btn-block" type="button" data-cbr-accept>Завершить проверку</button>' +
      '</section>';
    } else {
      decisions = '<div class="decisions">' +
        '<section class="decision">' +
          '<h3>Принять предписание</h3>' +
          '<p>Штраф ' + money(insp.fine) + ' · репутация −4 · строгий контроль ЦБ на 3 месяца. ' +
            'Нарушения нужно устранить до следующей проверки.</p>' +
          '<ul class="factors" style="font-size:var(--fs-11)">' +
            '<li><span>Штраф</span><b class="down">−' + money(insp.fine) + '</b></li>' +
            '<li><span>Репутация</span><b class="down">−4</b></li>' +
            '<li><span>Следующая проверка</span><b>через 180 дней</b></li>' +
          '</ul>' +
          '<button class="btn btn-block" type="button" data-cbr-accept>Принять предписание</button>' +
        '</section>' +
        '<section class="decision is-danger">' +
          '<h3>Договориться с проверяющим</h3>' +
          '<p>Шанс успеха ' + Math.round(state.inspectionChance() * 100) + '% — зависит от вашей репутации. ' +
            'Провал: штраф ×3 от суммы и репутация −12.</p>' +
          '<div class="bribe-input">' +
            '<input type="number" min="0" step="50000" value="300000" data-cbr-amount aria-label="Сумма взятки">' +
            '<span>₽</span>' +
          '</div>' +
          '<button class="btn btn-no btn-block" type="button" data-cbr-bribe>Предложить договорённость</button>' +
        '</section>' +
      '</div>';
    }

    body.innerHTML = table + decisions;
  }

  /* ---------- Общий рендер ---------- */
  function render() {
    var cash = money(state.capital);

    if (last.capital !== cash) {
      els.capital.forEach(function (node) { node.textContent = cash; });
      last.capital = cash;
    }

    setText(els.date, state.dateLabel(), 'date');
    setText(els.dayline, '09:40 · ' + state.dayLabel(), 'dayline');
    setText(els.stage, state.stageName() + ' · ' + state.dayLabel(), 'stage');

    if (document.documentElement.dataset.stage !== String(state.bankStage)) {
      document.documentElement.dataset.stage = String(state.bankStage);
    }

    if (els.kpi) {
      var parts = global.formatMoneyParts(state.capital);
      var html = parts.num + '<small>' + parts.unit + '</small>';
      if (last.kpi !== html) {
        els.kpi.innerHTML = html;
        last.kpi = html;
      }
    }

    renderDelta();
    renderLiquid();
    renderFlow();
    renderVip();
    renderQueue();
    renderVipControl();
    renderClientFilters();
    renderManager();
    renderAutopilot();
    renderPortfolio();
    renderProfit();
    renderBrand();
    renderBell();
    renderNotifications();
    renderProfile();
    renderReputation();
    renderRatios();
    renderInspection();
    renderBranches();
    renderRates();
    renderTreasury();
    renderStocks();
    renderSecurity();
    renderAchievements();
    renderNegotiation();

    /* всплывающие достижения */
    if (state.pendingToasts && state.pendingToasts.length && typeof global.showToast === 'function') {
      state.pendingToasts.splice(0).forEach(function (text) { global.showToast(text); });
    }
    refreshAffordability();
    renderCounts();
    renderEvents();
    renderBankrupt();

    /* одноразовые уведомления из состояния */
    if (state.notice && typeof global.showToast === 'function') {
      global.showToast(state.notice);
      state.notice = null;
    }

    if (state.alert) {
      if (state.alert === 'bankrupt' && typeof global.showToast === 'function') {
        global.showToast('🔴 Банк неплатёжеспособен — нужен кредит ЦБ или дефолт');
      } else if (state.alert === 'low' && typeof global.showToast === 'function') {
        global.showToast('⚠ Капитал ниже 10% от стартового — кредиты под угрозой');
      }
      state.alert = null;
    }
  }

  function syncControls() {
    document.querySelectorAll('.speed button[data-speed]').forEach(function (btn) {
      var on = !state.paused && !state.bankrupt && Number(btn.dataset.speed) === state.speed;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    document.querySelectorAll('.speed button[data-pause]').forEach(function (btn) {
      btn.classList.toggle('is-on', state.paused || state.bankrupt);
      btn.setAttribute('aria-pressed', (state.paused || state.bankrupt) ? 'true' : 'false');
    });

    document.body.classList.toggle('is-paused', state.paused || state.bankrupt);
  }

  /* ---------- Решения по заявкам ---------- */
  function bindQueue() {
    document.querySelectorAll('[data-ui="queue"]').forEach(function (box) {
      if (box.dataset.bound) return;
      box.dataset.bound = '1';

      box.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-decide]');
        if (!btn || btn.disabled) return;

        var row = btn.closest('[data-client-id]');
        if (!row) return;

        var id = row.dataset.clientId;
        var approved = btn.dataset.decide === 'approved';
        var result = approved ? state.approveClient(id) : state.declineClient(id);

        if (!result || !result.ok) {
          if (result && result.error === 'insufficient' && typeof global.showToast === 'function') {
            global.showToast('Недостаточно свободных средств: нужно ' + money(result.need) +
                             ', доступно ' + money(result.available));
          }
          render();
          return;
        }

        if (typeof global.showToast === 'function') {
          global.showToast((approved ? 'Одобрено: ' : 'Отказ: ') + result.client.name + ' · ' + money(result.client.amount));
        }

        render();
        syncControls();
      });
    });
  }

  function bindManagers() {
    document.addEventListener('change', function (event) {
      var input = event.target.closest && event.target.closest('[data-autopilot]');
      if (!input) return;

      var manager = state.managerById(input.dataset.autopilot);
      if (!manager) return;

      manager.autopilot = input.checked;
      manager.progress = 0;
      state.save();

      if (typeof global.showToast === 'function') {
        global.showToast(manager.autopilot
          ? 'Автопилот включён: ' + manager.name
          : 'Автопилот выключен: ' + manager.name);
      }
      render();
    });

    document.addEventListener('click', function (event) {
      var chip = event.target.closest && event.target.closest('[data-manager]');
      if (chip) {
        state.activeManagerId = chip.dataset.manager;
        last.manager = null;
        render();
        return;
      }

      var hire = event.target.closest && event.target.closest('[data-hire]');
      if (hire) {
        var res = state.hireCandidate(hire.dataset.hire);
        if (!res.ok) {
          if (typeof global.showToast === 'function') {
            global.showToast(res.error === 'money'
              ? 'Не хватает на первый месяц: нужно ' + money(res.need)
              : 'Кандидат недоступен');
          }
          return;
        }
        last.manager = null;
        if (typeof global.showToast === 'function') global.showToast('Нанят: ' + res.manager.name);
        render();
        return;
      }

      var reroll = event.target.closest && event.target.closest('[data-reroll]');
      if (reroll) {
        state.candidates = [];
        state.ensureCandidates();
        state.save();
        last.manager = null;
        render();
        return;
      }

      var train = event.target.closest && event.target.closest('[data-train]');
      if (train) {
        var trained = state.trainManager(state.activeManagerId);
        if (!trained.ok) {
          if (typeof global.showToast === 'function') {
            global.showToast(trained.error === 'money' ? 'Не хватает ' + money(trained.need)
              : trained.error === 'potential' ? 'Потенциал исчерпан'
              : trained.error === 'max' ? 'Максимальный уровень' : 'Не получилось');
          }
          return;
        }
        last.manager = null;
        if (typeof global.showToast === 'function') {
          global.showToast('Уровень ' + trained.manager.level + ' · лояльность +5');
        }
        render();
        return;
      }

      var promote = event.target.closest && event.target.closest('[data-promote]');
      if (promote) {
        var grown = state.promoteManager(state.activeManagerId);
        if (!grown.ok) {
          if (typeof global.showToast === 'function') {
            global.showToast(grown.error === 'money' ? 'Не хватает ' + money(grown.need)
              : grown.error === 'potential' ? 'Потенциал исчерпан'
              : grown.error === 'max' ? 'Максимальный уровень' : 'Не получилось');
          }
          return;
        }
        last.manager = null;
        if (typeof global.showToast === 'function') {
          global.showToast('Уровень ' + grown.manager.level + ' · лояльность +' + grown.loyalty);
        }
        render();
        return;
      }

      var fire = event.target.closest && event.target.closest('[data-fire]');
      if (fire) {
        if (!window.confirm('Уволить менеджера? Выходное пособие — одна зарплата.')) return;
        var out = state.fireManager(fire.dataset.fire);
        if (!out.ok) {
          if (typeof global.showToast === 'function') {
            global.showToast(out.error === 'last' ? 'Нельзя уволить последнего менеджера' : 'Не получилось');
          }
          return;
        }
        last.manager = null;
        if (typeof global.showToast === 'function') global.showToast('Уволен: ' + out.manager.name);
        render();
      }
    });
  }

  function bindRates() {
    document.addEventListener('input', function (event) {
      var input = event.target.closest && event.target.closest('[data-rate]');
      if (!input) return;

      var kind = input.dataset.rate;
      var value = Number(input.value);

      if (kind === 'loan') state.setLoanRate(value);
      else state.setDepositRate(value);

      var label = document.querySelector('[data-rate-value="' + kind + '"]');
      if (label) label.textContent = rateLabel(value);

      /* подсказка и шапка карточки */
      last.rates = null;
      renderRates();
    });
  }

  function bindStocks() {
    document.addEventListener('click', function (event) {
      var buy = event.target.closest && event.target.closest('[data-buy]');
      if (!buy) return;

      var percent = Number(buy.dataset.pct);
      var res = state.buyShares(buy.dataset.buy, percent);

      if (!res.ok) {
        if (typeof global.showToast === 'function') {
          global.showToast(res.error === 'money'
            ? 'Не хватает на пакет: нужно ' + money(res.need)
            : 'Сделка недоступна');
        }
        return;
      }

      if (typeof global.showToast === 'function') {
        global.showToast(percent + '% «' + res.competitor.name + '» куплено · −' + money(res.paid));
      }
      render();
    });
  }

  function bindProfileReset() {
    if (!document.querySelector('[data-ui="profile-head"]')) return;

    var btn = document.querySelector('[data-reset]');
    if (!btn) return;

    btn.addEventListener('click', function () {
      if (!window.confirm('Сбросить прогресс? Банк придётся зарегистрировать заново.')) return;
      try { localStorage.removeItem('bank-save'); } catch (e) {}
      window.location.href = 'onboarding.html';
    });
  }

  function bindNegotiation() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest && event.target.closest('[data-neg]');
      if (!btn) return;

      var res = state.resolveNegotiation(btn.dataset.neg);
      if (!res.ok) return;

      if (typeof global.showToast === 'function') {
        var action = btn.dataset.neg;
        global.showToast(action === 'raise' ? 'Зарплата повышена'
          : action === 'bonus' ? 'Премия выдана'
          : 'Отказано');
      }
      last.manager = null;
      render();
    });
  }

  function bindBranchButton() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest && event.target.closest('[data-open-branch]');
      if (!btn || btn.disabled) return;

      var res = state.openBranch();
      if (!res.ok) {
        if (typeof global.showToast === 'function') {
          global.showToast('Не хватает: нужно ' + money(res.need || state.branchCost));
        }
        return;
      }

      if (typeof global.showToast === 'function') {
        global.showToast('Филиал открыт · всего ' + res.branches + ', очередь до ' + res.queueLimit);
      }

      last.branchesPanel = null;
      render();
    });
  }

  function bindVipAndFilters() {
    document.addEventListener('input', function (event) {
      var slider = event.target.closest && event.target.closest('[data-vip-slider]');
      if (slider) {
        var type = slider.dataset.vipSlider;
        state.setVipThreshold(type, sliderToVip(Number(slider.value)));
        last.vipControl = null;
        render();
        return;
      }

      var input = event.target.closest && event.target.closest('[data-vip-input]');
      if (input && input.type === 'number') {
        var t = input.dataset.vipInput;
        state.setVipThreshold(t, Number(input.value));
        last.vipControl = null;
        render();
      }
    });

    document.addEventListener('click', function (event) {
      var chip = event.target.closest && event.target.closest('[data-client-filter]');
      if (chip) {
        state.setClientFilter(chip.dataset.clientFilter);
        last.queue = null;
        renderQueue();
        renderClientFilters();
        return;
      }

      var mode = event.target.closest && event.target.closest('[data-workmode]');
      if (mode) {
        var m = state.managerById(state.activeManagerId);
        if (!m) return;
        m.workMode = mode.dataset.workmode;
        state.save();
        last.manager = null;
        if (typeof global.showToast === 'function') {
          global.showToast(mode.dataset.workmode === 'vip' ? 'Только VIP-заявки'
            : mode.dataset.workmode === 'regular' ? 'Только обычные заявки' : 'Все клиенты');
        }
        render();
      }
    });
  }

  function bindStage() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest && event.target.closest('[data-stage-up]');
      if (!btn) return;

      var res = state.upgradeStage();
      if (!res.ok) {
        if (typeof global.showToast === 'function') {
          global.showToast(res.reason === 'capital' ? 'Нужен капитал ' + money(res.need)
            : res.reason === 'branches' ? 'Нужно филиалов: ' + res.need
            : 'Не получилось');
        }
        return;
      }

      if (typeof global.showToast === 'function') {
        global.showToast('Банк стал «' + res.name + '»');
      }
      last.branchesPanel = null;
      render();
    });
  }

  function bindSecurity() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest && event.target.closest('[data-sec]');
      if (!btn) return;

      var res = state.upgradeSecurity(Number(btn.dataset.sec), Number(btn.dataset.cost));
      if (!res.ok) {
        if (typeof global.showToast === 'function') {
          global.showToast(res.error === 'money' ? 'Не хватает: нужно ' + money(res.need) : 'СБ уже на максимуме');
        }
        return;
      }

      if (typeof global.showToast === 'function') global.showToast('СБ: ' + res.level + ' / 100');
      render();
    });
  }

  function bindInspection() {
    var body = document.querySelector('[data-ui="cbr-body"]');
    if (!body) return;

    body.addEventListener('click', function (event) {
      var accept = event.target.closest('[data-cbr-accept]');
      if (accept) {
        state.resolveInspection('accept', 0);
        render();
        return;
      }

      var bribe = event.target.closest('[data-cbr-bribe]');
      if (bribe) {
        var input = body.querySelector('[data-cbr-amount]');
        var sum = input ? Number(input.value) || 0 : 0;
        if (sum <= 0) {
          if (typeof global.showToast === 'function') global.showToast('Укажите сумму взятки');
          return;
        }
        state.resolveInspection('bribe', sum);
        render();
      }
    });
  }

  function init() {
    els.capital = Array.prototype.slice.call(document.querySelectorAll('[data-ui="capital"]'));
    els.date = document.querySelector('[data-ui="date"]');
    els.dayline = document.querySelector('[data-ui="dayline"]');
    els.stage = document.querySelector('[data-ui="stage"]');
    els.kpi = document.querySelector('[data-ui="kpi-capital"]');
    els.flow = document.querySelector('[data-ui="flow"]');
    els.vip = document.querySelector('[data-ui="vip-queue"]');
    els.queue = document.querySelector('[data-ui="queue"]');
    els.bankrupt = document.querySelector('[data-ui="bankrupt"]');
    els.events = document.querySelector('[data-ui="events"]');

    if (!global.GameEngine) {
      document.querySelectorAll('.speed').forEach(function (node) { node.style.display = 'none'; });
    }

    var visible = Array.prototype.slice
      .call(document.querySelectorAll('.speed button[data-speed]'))
      .filter(function (btn) { return btn.offsetParent !== null; })
      .map(function (btn) { return Number(btn.dataset.speed); });

    if (visible.length && visible.indexOf(state.speed) === -1) {
      state.speed = Math.max.apply(null, visible);
      state.save();
    }

    bindQueue();
    bindManagers();
    bindTabs();
    bindInspection();
    bindRates();
    bindTreasury();
    bindStocks();
    bindSecurity();
    bindStage();
    bindBranchButton();
    bindVipAndFilters();
    bindNegotiation();
    bindProfileReset();
    bindNotifications();
    render();
    syncControls();
  }

  global.GameUI = {
    init: init,
    update: render,
    render: render,
    renderFlow: renderFlow,
    renderQueue: renderQueue,
    syncControls: syncControls
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!global.GameState) return;
    if (!document.querySelector('[data-ui="date"]')) return;
    init();
    if (global.GameEngine) global.GameEngine.start();
  });
})(window);
