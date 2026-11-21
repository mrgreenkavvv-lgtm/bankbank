/* ==========================================================================
   state.js · Глобальное состояние игры
   Единственный источник правды: капитал, дата, очередь заявок, режим времени.
   Умеет сохраняться в localStorage и восстанавливаться при загрузке.
   ========================================================================== */
(function (global) {
  'use strict';

  var MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн',
                'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  var SAVE_KEY = 'bank-save';
  var SAVE_VERSION = 2;
  var APP_VERSION = 'v2.14.1';   // синхронизировать с VERSION в sw.js

  function nbsp(value) {
    return String(value).replace(/\u00A0/g, ' ');
  }

  function formatMoney(value) {
    var abs = Math.abs(value);
    var sign = value < 0 ? '−' : '';

    if (abs >= 1e12) return sign + nbsp((abs / 1e12).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' трлн ₽';
    if (abs >= 1e9) return sign + nbsp((abs / 1e9).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' млрд ₽';
    if (abs >= 1e6) return sign + nbsp((abs / 1e6).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' млн ₽';
    return sign + nbsp(Math.round(abs).toLocaleString('ru-RU')) + ' ₽';
  }

  function formatMoneyParts(value) {
    var abs = Math.abs(value);
    var sign = value < 0 ? '−' : '';

    if (abs >= 1e12) return { num: sign + nbsp((abs / 1e12).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), unit: ' трлн ₽' };
    if (abs >= 1e9) return { num: sign + nbsp((abs / 1e9).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), unit: ' млрд ₽' };
    if (abs >= 1e6) return { num: sign + nbsp((abs / 1e6).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), unit: ' млн ₽' };
    return { num: sign + nbsp(Math.round(abs).toLocaleString('ru-RU')), unit: ' ₽' };
  }

  var START_DATE = new Date(2027, 2, 14, 9, 40, 0);

  /* ---------- Справочники ---------- */
  var CLIENT_NAMES = [
    'ИП Орлов А. В.', 'Смирнова Е. К.', 'ООО «Вектор»', 'ООО «Лира»',
    'Ким А. С.', 'Данилов Р. Р.', 'ООО «Гранит»', 'Гаврилов Т. Ю.',
    'Петрова Л. М.', 'АО «Плазма»', 'Соколов Д. И.', 'ООО «Стриж»',
    'Макаров О. П.', 'Фёдорова А. С.', 'ООО «Меридиан»', 'Никитин В. В.',
    'ИП Белова Н. Г.', 'ООО «Атлас»', 'Ефимов А. А.', 'ООО «Темп»'
  ];

  var MANAGERS = ['Иванов П.', 'Петров С.', 'Ковалёв И.', 'Сидорова А.'];

  var CANDIDATE_NAMES = [
    'Петров Сергей', 'Сидорова Анна', 'Ковалёв Игорь', 'Морозова Ольга',
    'Волков Дмитрий', 'Соколова Мария', 'Лебедев Артём', 'Новикова Елена',
    'Зайцев Павел', 'Орлова Ксения', 'Белов Никита', 'Гусева Ирина'
  ];

  var CHARACTERS = {
    ambitious:    { name: 'Амбициозный',    hint: 'Ненавидит застой: без повышения дольше 3 месяцев теряет лояльность сильнее' },
    calm:         { name: 'Спокойный',      hint: 'Ценит стабильность: ни бонусов, ни штрафов' },
    perfectionist:{ name: 'Перфекционист',  hint: 'Ненавидит ошибки: каждый дефолт в портфеле бьёт по лояльности' },
    loyalist:     { name: 'Лоялист',        hint: 'Ценит банк: при росте капитала +1, при дефолте −4' },
    materialist:  { name: 'Материалист',    hint: 'Ценит деньги: ниже рынка −4, выше рынка +3' }
  };

  var RARE_BUFFS = [
    { name: 'Скоростной',   desc: '+15 к скорости',     apply: { speed: 15 } },
    { name: 'Аналитик',     desc: '+15 к аналитике',    apply: { analytics: 15 } },
    { name: 'Страж',        desc: '+15 к осторожности',  apply: { caution: 15 } },
    { name: 'Харизматик',   desc: '+10 к лояльности',    apply: { loyalty: 10 } },
    { name: 'Трудяга',      desc: '+10 к скорости',      apply: { speed: 10 } },
    { name: 'Стратег',      desc: '+12 к аналитике',     apply: { analytics: 12 } },
    { name: 'Осторожный',   desc: '+12 к осторожности',  apply: { caution: 12 } },
    { name: 'Верный',       desc: '+12 к лояльности',    apply: { loyalty: 12 } }
  ];

  var LEGENDARY_BUFFS = [
    { name: 'Легенда',      desc: '+10 ко всем навыкам',        apply: { analytics: 10, speed: 10, caution: 10 } },
    { name: 'Гуру',         desc: '+20 к аналитике',            apply: { analytics: 20 } },
    { name: 'Молния',       desc: '+20 к скорости',             apply: { speed: 20 } },
    { name: 'Скала',        desc: '+20 к осторожности',         apply: { caution: 20 } },
    { name: 'Оракул',       desc: '+15 к аналитике и +10 к осторожности', apply: { analytics: 15, caution: 10 } },
    { name: 'Титан',        desc: '+10 ко всем навыкам и +5 к лояльности', apply: { analytics: 10, speed: 10, caution: 10, loyalty: 5 } },
    { name: 'Икона',        desc: '+25 к лояльности',           apply: { loyalty: 25 } },
    { name: 'Ветеран',      desc: '+15 к аналитике и скорости', apply: { analytics: 15, speed: 15 } }
  ];

  var COMMON_SKILLS = ['analytics', 'speed', 'caution'];

  var GOAL_POOL = [
    { id: 'level50', title: 'Дорасти до 50 уровня', target: 50 },
    { id: 'courses3', title: 'Пройти 3 курса обучения', target: 3 },
    { id: 'moles1', title: 'Помочь поймать крота', target: 1 },
    { id: 'clean12', title: '12 месяцев без дефолтов', target: 12 }
  ];

  var MANAGER_ACHIEVEMENTS = [
    { id: 'loans100', name: 'Сто кредитов', desc: '100 одобренных кредитов', target: 100 },
    { id: 'veteran', name: 'Ветеран', desc: '5 лет в банке', target: 1800 },
    { id: 'clean', name: 'Без дефолтов', desc: '12 месяцев без дефолтов', target: 12 },
    { id: 'mentor', name: 'Наставник', desc: '3 курса обучения', target: 3 }
  ];

  /* старый type → категория уведомлений */
  /* 10 строгих иконок эмблемы (viewBox 0 0 24 24, stroke) */
  var LOGO_ICONS = {
    shield: '<path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z"/><path d="M9.5 12l1.8 1.8L15 10"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M9.5 10.2h4a1.8 1.8 0 0 1 0 3.6h-4"/>',
    chart: '<path d="M4 19h16"/><path d="M6 16l4-5 3.5 3L18 7"/>',
    bank: '<path d="M3 9l9-5 9 5"/><path d="M5 9v9M9.7 9v9M14.3 9v9M19 9v9"/><path d="M3 19h18"/>',
    diamond: '<path d="M12 3l4.5 6L12 21 7.5 9z"/><path d="M7.5 9h9"/>',
    crown: '<path d="M3 18h18"/><path d="M4 18l-1-9 5.5 4L12 6l3.5 7L21 9l-1 9"/>',
    key: '<circle cx="8" cy="12" r="3.6"/><path d="M11.6 12H21"/><path d="M18 12v3.5"/><path d="M15 12v2.5"/>',
    safe: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8V7.4M12 16.6v-1.4"/>',
    arrow: '<path d="M12 20V5"/><path d="M6 11l6-6 6 6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>'
  };

  var PERK_INFO = {
    retail: { name: 'Розничный', effects: '+20% к вкладам · риск −1 · маржа −5%' },
    corporate: { name: 'Корпоративный', effects: '+15% к ставке · риск +1 · поток −10%' },
    universal: { name: 'Универсальный', effects: 'без бонусов и штрафов' },
    mortgage: { name: 'Ипотечный', effects: '+25% к суммам · срок +12 мес · риск +1' },
    investment: { name: 'Инвестиционный', effects: '+10% купонов · валюта волатильнее · поток −15%' },
    micro: { name: 'Микрозаймы', effects: '+50% к потоку · риск +2 · суммы −40%' },
    vip: { name: 'VIP-банк', effects: '+30% шанса VIP-заявок · зарплаты +20%' },
    currency: { name: 'Валютный', effects: '+15% спреда · 10% капитала в валюте · проверки раз в 120 дней' },
    construction: { name: 'Строительный', effects: '+20% к суммам · дефолт забирает всё тело' },
    cooperative: { name: 'Кооперативный', effects: '+15 к лояльности · зарплаты +10% · поток −5%' },

    honest: { name: 'Честный банкир', effects: 'репутация +10 · штрафы ×1,2' },
    shark: { name: 'Акула рынка', effects: 'капитал ×1,05 · репутация −5' },
    people: { name: 'Народный банк', effects: 'поток +20% · маржа ×0,9' },
    aristocrat: { name: 'Аристократ', effects: 'репутация +15 · зарплаты +15%' },
    analyst: { name: 'Аналитик', effects: 'поток −10%' },
    risky: { name: 'Рисковый игрок', effects: 'биржа удачнее на 10% · риск +1' },
    conservative: { name: 'Консерватор', effects: 'риск −1 · поток −15%' },
    careerist: { name: 'Карьерист', effects: 'рост менеджеров +20% · зарплаты +10%' },
    expansionist: { name: 'Экспансионист', effects: 'филиал −20% · проверки раз в 150 дней' },
    ludoman: { name: 'Лудоман', effects: 'шанс баффа +10% · лояльность падает быстрее' }
  };

  /* этапы банка: всё, что открывается вместе с лицензией */
  var STAGES = [
    null,
    { name: 'Ларёк', capital: 0, branches: 1, cost: 0,
      branchesMax: 3, queueBase: 15, managersMax: 3, h1Min: 8, inspectDays: 180,
      products: ['consumer'], treasury: ['rates', 'liquidity'] },
    { name: 'Городской банк', capital: 50e6, branches: 3, cost: 10e6,
      branchesMax: 8, queueBase: 25, managersMax: 8, h1Min: 8.5, inspectDays: 180,
      products: ['consumer', 'mortgage'], treasury: ['rates', 'liquidity', 'invest'] },
    { name: 'Региональный', capital: 200e6, branches: 5, cost: 50e6,
      branchesMax: 14, queueBase: 40, managersMax: 14, h1Min: 9, inspectDays: 150,
      products: ['consumer', 'mortgage', 'corporate'], treasury: ['rates', 'liquidity', 'invest'] },
    { name: 'Федеральный', capital: 500e6, branches: 8, cost: 120e6,
      branchesMax: 20, queueBase: 55, managersMax: 22, h1Min: 9.5, inspectDays: 150,
      products: ['consumer', 'mortgage', 'corporate'], treasury: ['rates', 'liquidity', 'invest', 'fx'] },
    { name: 'Национальный', capital: 1e9, branches: 12, cost: 300e6,
      branchesMax: 28, queueBase: 75, managersMax: 32, h1Min: 10, inspectDays: 120,
      products: ['consumer', 'mortgage', 'corporate', 'syndicated'],
      treasury: ['rates', 'liquidity', 'invest', 'fx'] },
    { name: 'Международный', capital: 2e9, branches: 16, cost: 700e6,
      branchesMax: 40, queueBase: 100, managersMax: 45, h1Min: 10.5, inspectDays: 120,
      products: ['consumer', 'mortgage', 'corporate', 'syndicated', 'foreign'],
      treasury: ['rates', 'liquidity', 'invest', 'fx'] },
    { name: 'Мировой', capital: 5e9, branches: 22, cost: 1.5e9,
      branchesMax: 60, queueBase: 130, managersMax: 60, h1Min: 11, inspectDays: 90,
      products: ['consumer', 'mortgage', 'corporate', 'syndicated', 'foreign'],
      treasury: ['rates', 'liquidity', 'invest', 'fx'] }
  ];

  /* продукты: доля капитала, срок, риск, надбавка к ставке, вес */
  var PRODUCTS = {
    consumer:  { label: 'Потребкредит', min: 0.02, max: 0.08, termMin: 6, termMax: 36, riskMin: 1, riskMax: 4, rate: 0, weight: 0.60 },
    mortgage:  { label: 'Ипотека', min: 0.04, max: 0.12, termMin: 60, termMax: 180, riskMin: 1, riskMax: 2, rate: -3, weight: 0.25 },
    corporate: { label: 'Корпоратив', min: 0.06, max: 0.20, termMin: 12, termMax: 48, riskMin: 2, riskMax: 4, rate: 1, weight: 0.25 },
    syndicated:{ label: 'Синдикат', min: 0.15, max: 0.40, termMin: 36, termMax: 60, riskMin: 2, riskMax: 3, rate: 0.5, weight: 0.10 },
    foreign:   { label: 'Внешний', min: 0.05, max: 0.15, termMin: 12, termMax: 36, riskMin: 3, riskMax: 5, rate: 2, weight: 0.20 }
  };

  var NOTIFY_CATEGORY = {
    loan: 'money', deposit: 'money', default: 'money', closed: 'money', month: 'money',
    treasury: 'money', bankrupt: 'money', stock: 'competitor',
    hire: 'people', fire: 'people', growth: 'people', auto: 'people', 'auto-decline': 'people',
    cbr: 'cbr',
    security: 'security',
    achievement: 'achievement',
    stage: 'system', branch: 'system', warn: 'system'
  };

  var NOTIFY_TITLE = {
    loan: 'Выдан кредит', deposit: 'Принят вклад', default: 'Дефолт', closed: 'Сделка закрыта',
    month: 'Итоги месяца', cbr: 'Проверка ЦБ', auto: 'Автопилот', 'auto-decline': 'Автопилот: отказ',
    hire: 'Найм', fire: 'Увольнение', growth: 'Рост', security: 'Безопасность',
    achievement: 'Достижение', stage: 'Уровень банка', branch: 'Филиал', stock: 'Биржа',
    treasury: 'Казначейство', warn: 'Внимание', bankrupt: 'Банкротство'
  };

  var NOTIFY_LINK = {
    money: 'treasury.html', people: 'manager.html', cbr: 'cbr.html',
    competitor: 'stocks.html', security: 'security.html',
    achievement: 'achievements.html', system: 'index.html'
  };

  var NOTIFY_SEQ = 1;

  var NEW_MANAGER_SEQ = 1;
  var NEW_CANDIDATE_SEQ = 0;

  var clientSeq = 0;

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function makeClient(day, name, type, amount, term, rate, risk) {
    clientSeq += 1;
    return {
      id: 'c' + clientSeq,
      day: day,
      name: name,
      type: type,                                   // 'loan' | 'deposit'
      amount: amount,
      term: term || (6 + Math.floor(Math.random() * 31)),     // 6–36 мес
      rate: rate || round2(12 + Math.random() * 10),          // 12–22%
      risk: risk || (1 + Math.floor(Math.random() * 5)),      // 1–5
      isVip: amount >= (type === 'deposit' ? GameState.vipThresholdDeposit : GameState.vipThresholdLoan),
      manager: MANAGERS[Math.floor(Math.random() * MANAGERS.length)]
    };
  }

  /* выбор продукта по весам среди доступных этапу */
  function pickProduct() {
    var ids = GameState.availableProducts();
    var total = 0;
    ids.forEach(function (id) { total += (PRODUCTS[id] || {}).weight || 0; });

    var roll = Math.random() * total;
    for (var i = 0; i < ids.length; i += 1) {
      var p = PRODUCTS[ids[i]];
      if (!p) continue;
      roll -= p.weight;
      if (roll <= 0) return ids[i];
    }
    return ids[0];
  }

  function randomClient(day, forcedType) {
    var name = CLIENT_NAMES[Math.floor(Math.random() * CLIENT_NAMES.length)];
    var type = forcedType || (Math.random() < 0.66 ? 'loan' : 'deposit');
    /* сумма — доля собственного капитала, иначе поток теряет смысл на крупном банке */
    var equity = Math.max(500000, GameState.capital || 500000);

    var productId = type === 'loan' ? pickProduct() : null;
    var product = productId ? PRODUCTS[productId] : null;

    var lo = product ? product.min : 0.02;
    var hi = product ? product.max : 0.08;
    var amount = Math.round((equity * (lo + Math.random() * (hi - lo))) / 50000) * 50000;
    amount = Math.max(50000, amount);

    var client = makeClient(day, name, type, amount);

    if (product) {
      client.product = productId;
      client.term = product.termMin + Math.floor(Math.random() * (product.termMax - product.termMin + 1));
      client.risk = product.riskMin + Math.floor(Math.random() * (product.riskMax - product.riskMin + 1));
    }

    /* ставка клиента — вокруг базовой ставки игрока, со сдвигом продукта */
    var base = type === 'loan' ? GameState.playerLoanRate : GameState.playerDepositRate;
    var spread = type === 'loan' ? 3 : 1.5;
    client.rate = round2(base + (product ? product.rate : 0) + (Math.random() - 0.5) * 2 * spread);

    return client;
  }

  var GameState = {
    /* ---------- Время ---------- */
    startDate: START_DATE,
    date: new Date(START_DATE.getTime()),
    startDayNumber: 41,
    dayNumber: 41,
    elapsedDays: 0,
    dayLength: 30,
    speed: 1,
    paused: false,

    /* история капитала для графика: до 90 точек */
    capitalHistory: [],
    today: { day: 0, clients: 0, approved: 0, auto: 0 },

    /* ---------- Регулятор ---------- */
    /* упрощённые нормативы: одни и те же цифры на дашборде и в проверке */
    computeRatios: function () {
      var loansTotal = this.activeLoans.reduce(function (sum, l) { return sum + l.amount; }, 0);
      var depositsTotal = this.activeDeposits.reduce(function (sum, d) { return sum + d.amount; }, 0);

      return {
        loansTotal: loansTotal,
        depositsTotal: depositsTotal,
        h1: loansTotal > 0 ? (this.capital / loansTotal) * 100 : 999,
        h2: depositsTotal > 0 ? (this.cash() / depositsTotal) * 100 : 999,
        h3: depositsTotal > 0 ? ((this.cash() + loansTotal) / depositsTotal) * 100 : 999
      };
    },

    startInspection: function () {
      var ratios = this.computeRatios();
      var loansTotal = ratios.loansTotal;
      var depositsTotal = ratios.depositsTotal;
      var h1 = ratios.h1;
      var h2 = ratios.h2;
      var h3 = ratios.h3;

      var h1Min = this.stageInfo().h1Min || 8;

      var rows = [
        { label: 'Н1 · достаточность капитала', fact: h1, min: h1Min, fine: 450000, ok: h1 >= h1Min },
        { label: 'Н2 · мгновенная ликвидность', fact: h2, min: 15, fine: 320000, ok: h2 >= 15 },
        { label: 'Н3 · текущая ликвидность', fact: h3, min: 50, fine: 200000, ok: h3 >= 50 }
      ];

      if (this.capital < this.startCapital * 0.1) {
        rows.push({
          label: 'Капитал ниже 10% от стартового',
          fact: (this.capital / this.startCapital) * 100,
          min: 10, fine: 500000, ok: false
        });
      }

      var fineMult = (this.bonuses && this.bonuses.fineMult) || 1;
      var base = rows.reduce(function (sum, r) { return sum + (r.ok ? 0 : r.fine); }, 0);
      /* штраф привязан к размеру банка: 0,5–2% капитала */
      var fine = base > 0
        ? Math.round(Math.max(base, this.capital * 0.005) * fineMult)
        : 0;
      fine = Math.min(fine, Math.round(this.capital * 0.02));

      this.inspection = {
        day: this.dayNumber,
        rows: rows,
        fine: fine,
        loansTotal: loansTotal,
        depositsTotal: depositsTotal,
        resolved: false,
        result: null
      };

      this.inspecting = true;
      this.nextInspectionDay = this.dayNumber +
        ((this.bonuses && this.bonuses.inspectionDays) || this.stageInfo().inspectDays || 180);
      this.paused = true;

      this.log.push({
        day: this.dayNumber,
        type: 'cbr',
        text: fine > 0
          ? 'ЦБ начал проверку · найдено нарушений: ' + rows.filter(function (r) { return !r.ok; }).length
          : 'ЦБ начал проверку · нарушений не найдено'
      });

      console.warn('[cbr] проверка · штраф ' + formatMoney(fine));
      this.save();
      return this.inspection;
    },

    inspectionChance: function () {
      return Math.max(0.5, Math.min(0.9, 0.55 + this.reputation / 200));
    },

    resolveInspection: function (mode, bribeSum) {
      var insp = this.inspection;
      if (!insp || insp.resolved) return null;

      var result = { mode: mode, ok: false, fine: 0, reputation: 0 };

      if (mode === 'accept' && insp.fine <= 0) {
        result.fine = 0;
        result.reputation = -5;          /* −5 к штрафу, т.е. +5 репутации */
        result.ok = true;
        insp.result = 'clean';
        insp.resolved = true;
        insp.resolvedFine = 0;
        insp.resolvedOk = true;
        this.inspecting = false;
        this.paused = false;
        this.reputation = Math.min(100, this.reputation + 5);
        this.log.push({
          day: this.dayNumber,
          type: 'cbr',
          text: 'Проверка ЦБ пройдена без нарушений · репутация +5'
        });
        this.checkCapital();
        this.save();
        return result;
      }

      if (mode === 'bribe' && insp.fine > 0 && bribeSum < insp.fine * 0.3) {
        return { mode: 'bribe', ok: false, error: 'too-small', min: Math.round(insp.fine * 0.3) };
      }

      if (mode === 'accept') {
        result.fine = insp.fine;
        result.reputation = 4;
        result.ok = true;
        insp.result = 'accept';
        this.log.push({
          day: this.dayNumber,
          type: 'cbr',
          text: 'ЦБ выявил нарушения. Штраф ' + formatMoney(insp.fine) + ' ₽ · репутация −4'
        });
      } else {
        var chance = this.inspectionChance();
        var success = Math.random() < chance;

        if (success) {
          result.fine = bribeSum;
          result.reputation = 2;
          result.ok = true;
          insp.result = 'bribe-ok';
          this.log.push({ day: this.dayNumber, type: 'cbr', text: 'Взятка сработала. Проверка пройдена · ' + formatMoney(bribeSum) + ' ₽' });
          console.warn('[cbr] взятка удалась · ' + formatMoney(bribeSum));
        } else {
          result.fine = bribeSum * 3;
          result.reputation = 12;
          result.ok = false;
          insp.result = 'bribe-fail';
          this.log.push({ day: this.dayNumber, type: 'cbr', text: 'Провал взятки: проверяющий оказался честным · штраф ' + formatMoney(bribeSum * 3) + ' ₽' });
          console.error('[cbr] взятка провалилась · ' + formatMoney(bribeSum * 3));
        }
      }

      this.capital -= result.fine;
      this.reputation = Math.max(0, this.reputation - result.reputation);

      insp.resolved = true;
      insp.resolvedFine = result.fine;
      insp.resolvedOk = result.ok;

      this.inspecting = false;
      this.paused = false;
      this.checkCapital();
      this.save();

      return result;
    },

    /* ---------- Экономика ---------- */
    capital: 8420000,
    startCapital: 8420000,
    ratePerDay: 0,
    salary: 200000,
    salaryEveryDays: 30,

    appVersion: APP_VERSION,

    /* ---------- Профиль банка ---------- */
    bankName: 'Восток',
    founderName: 'Основатель',
    logoColor: 'gold',
    logoType: 'letter',
    logoLetter: 'В',
    logoIcon: 'shield',
    specialization: 'universal',
    motivation: 'honest',
    difficulty: 'normal',
    totalLoansIssued: 0,
    totalDepositsTaken: 0,

    bonuses: {
      flowMult: 1,
      depShareMult: 1,
      loanRateDelta: 0,
      riskDelta: 0,
      fineMult: 1,
      marginMult: 1,
      capitalMult: 1,
      loanAmountMult: 1,
      loanTermDelta: 0,
      bondYieldMult: 1,
      fxVolatilityMult: 1,
      vipChanceBonus: 0,
      salaryMult: 1,
      branchCostMult: 1,
      loyaltyGainBonus: 0,
      loyaltyDecayMult: 1,
      buffChanceBonus: 0,
      growthMult: 1,
      defaultLoss: 0.8,
      corpDefaultMult: 1,
      fxSpreadMult: 1,
      inspectionDays: 0
    },

    /* ---------- VIP-пороги и фильтр очереди ---------- */
    vipThreshold: 3000000,
    vipThresholdLoan: 3000000,
    vipThresholdDeposit: 3000000,
    clientFilter: 'all',

    /* ---------- Казначейство ---------- */
    ratesLog: [],
    fxSpread: 1.5,
    currencies: {
      usd: { rate: 90, prev: 90, amount: 0, cost: 0 },
      eur: { rate: 100, prev: 100, amount: 0, cost: 0 },
      cny: { rate: 12.5, prev: 12.5, amount: 0, cost: 0 }
    },
    investments: {
      cbLoan: 0,
      mbkTaken: { amount: 0, monthsLeft: 0 },
      mbkGiven: { amount: 0, monthsLeft: 0 },
      bonds: []
    },

    /* ---------- Люди: диалоги ---------- */
    negotiation: null,
    defaultsThisMonth: 0,
    prevCapital: null,

    /* ---------- Уровни банка ---------- */
    bankStage: 1,
    stageNames: ['Ларёк', 'Городской банк', 'Региональный', 'Федеральный', 'Национальный', 'Международный', 'Мировой'],
    stageUpgrades: [
      null,
      { to: 2, name: 'Городской банк', capital: 50000000, branches: 3, cost: 10000000 },
      { to: 3, name: 'Региональный', capital: 200000000, branches: 5, cost: 50000000 }
    ],

    /* ---------- Достижения ---------- */
    achievements: {
      first_million: false,
      mole_hunter: false,
      magnate: false,
      credit_baron: false,
      city_bank: false
    },
    stats: { loansIssued: 0, molesCaught: 0, sharesBought: 0 },
    pendingToasts: [],

    /* ---------- Служба безопасности ---------- */
    securityLevel: 10,
    incidents: [],

    /* ---------- Ставки игрока ---------- */
    playerLoanRate: 22,
    playerDepositRate: 6,

    /* ---------- Конкуренты ---------- */
    competitors: [
      {
        id: 'imp', name: 'Империал', strategy: 'агрессивный',
        depositRate: 12, loanRate: 15,
        capital: 80000000, playerShare: 0, status: 'competitor', cbWarned: false, stolen: 0
      },
      {
        id: 'tver', name: 'ТверьКапитал', strategy: 'консервативный',
        depositRate: 9, loanRate: 19,
        capital: 36000000, playerShare: 0, status: 'competitor', cbWarned: false, stolen: 0
      }
    ],

    /* ---------- Филиалы ---------- */
    branches: 1,
    branchCost: 5000000,
    clientsPerDay: 0.3,
    flowBonus: 0,
    clientAcc: 0,

    /* ---------- Казначейство: ставки ---------- */
    pushRatesHistory: function () {
      var last = this.ratesLog[this.ratesLog.length - 1];
      if (last && last.day === this.dayNumber) {
        last.loan = this.playerLoanRate;
        last.dep = this.playerDepositRate;
        return;
      }
      this.ratesLog.push({ day: this.dayNumber, loan: this.playerLoanRate, dep: this.playerDepositRate });
      if (this.ratesLog.length > 10) this.ratesLog.shift();
    },

    /* ---------- Казначейство: резервы ---------- */
    reserveAdd: function (amount) {
      amount = Math.round(amount);
      if (!(amount > 0)) return { ok: false, error: 'amount' };
      if (this.liquidFunds() < amount) {
        return { ok: false, error: 'money', need: amount, available: this.liquidFunds() };
      }

      this.reserved += amount;
      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'В резерв отправлено ' + formatMoney(amount) + ' · всего резерв ' + formatMoney(this.reserved)
      });
      this.save();
      return { ok: true, reserved: this.reserved, paid: amount };
    },

    reserveRemove: function (amount) {
      amount = Math.round(amount);
      if (!(amount > 0)) return { ok: false, error: 'amount' };
      if (this.reserved < amount) return { ok: false, error: 'reserve', need: this.reserved };

      this.reserved -= amount;
      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Из резерва выведено ' + formatMoney(amount) + ' · резерв ' + formatMoney(this.reserved)
      });
      this.save();
      return { ok: true, reserved: this.reserved };
    },

    /* ---------- Казначейство: валюты ---------- */
    driftCurrencies: function () {
      var self = this;
      ['usd', 'eur', 'cny'].forEach(function (code) {
        var c = self.currencies[code];
        c.prev = c.rate;
        var vol = (self.bonuses && self.bonuses.fxVolatilityMult) || 1;
        var drift = (Math.random() - 0.5) * 0.01 * vol;      // ±0,5% в день
        c.rate = Math.max(1, Math.round(c.rate * (1 + drift) * 10000) / 10000);
      });
    },

    fxPrice: function (code, side) {
      var rate = this.currencies[code].rate;
      var spread = (this.fxSpread / 100) * ((this.bonuses && this.bonuses.fxSpreadMult) || 1);
      return side === 'buy' ? rate * (1 + spread) : rate * (1 - spread);
    },

    fxBuy: function (code, rub) {
      var c = this.currencies[code];
      if (!c) return { ok: false, error: 'code' };
      rub = Math.round(rub);
      if (!(rub > 0)) return { ok: false, error: 'amount' };
      if (this.liquidFunds() < rub) {
        return { ok: false, error: 'money', need: rub, available: this.liquidFunds() };
      }

      var price = this.fxPrice(code, 'buy');
      var amount = rub / price;

      c.amount += amount;
      c.cost += rub;

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Куплено ' + amount.toFixed(2) + ' ' + code.toUpperCase() + ' по ' + price.toFixed(2) + ' ₽'
      });
      this.save();
      return { ok: true, amount: amount, price: price };
    },

    fxSell: function (code, amount) {
      var c = this.currencies[code];
      if (!c) return { ok: false, error: 'code' };
      amount = Math.round(amount * 100) / 100;
      if (!(amount > 0)) return { ok: false, error: 'amount' };
      if (c.amount < amount) return { ok: false, error: 'stock', need: c.amount };

      var price = this.fxPrice(code, 'sell');
      var rub = amount * price;
      var avg = c.amount > 0 ? c.cost / c.amount : 0;

      c.amount -= amount;
      c.cost = Math.max(0, c.cost - avg * amount);
      this.capital += (rub - avg * amount);   /* в капитал только реализованный результат */

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Продано ' + amount.toFixed(2) + ' ' + code.toUpperCase() + ' по ' + price.toFixed(2) + ' ₽ · ' + formatMoney(rub)
      });
      this.save();
      return { ok: true, rub: rub, price: price };
    },

    fxPosition: function () {
      var self = this;
      var value = 0;
      var cost = 0;

      ['usd', 'eur', 'cny'].forEach(function (code) {
        var c = self.currencies[code];
        value += c.amount * c.rate;
        cost += c.cost;
      });

      return { value: value, cost: cost, pnl: value - cost };
    },

    /* ---------- Казначейство: инвестиции ---------- */
    cbLoanLimit: function () {
      return Math.round(Math.max(0, this.capital) * 1.5);
    },

    takeCBLoan: function (amount) {
      amount = Math.round(amount);
      if (!(amount > 0)) return { ok: false, error: 'amount' };

      var limit = this.cbLoanLimit();
      var left = Math.max(0, limit - this.investments.cbLoan);
      if (amount > left) {
        return { ok: false, error: 'limit', limit: limit, available: left };
      }

      this.investments.cbLoan += amount;

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Взят кредит ЦБ ' + formatMoney(amount) + ' под 28% · долг ' + formatMoney(this.investments.cbLoan)
      });
      this.checkCapital();
      this.save();
      return { ok: true, debt: this.investments.cbLoan };
    },

    repayCBLoan: function (amount) {
      amount = Math.round(amount);
      var debt = this.investments.cbLoan;
      if (!(amount > 0)) return { ok: false, error: 'amount' };
      if (this.liquidFunds() < amount) return { ok: false, error: 'money', need: amount };
      if (debt <= 0) return { ok: false, error: 'debt' };

      amount = Math.min(amount, debt);
      this.investments.cbLoan -= amount;

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Погашено ЦБ ' + formatMoney(amount) + ' · остаток долга ' + formatMoney(this.investments.cbLoan)
      });
      this.checkCapital();
      this.save();
      return { ok: true, debt: this.investments.cbLoan };
    },

    takeMBK: function (amount) {
      amount = Math.round(amount);
      if (!(amount > 0)) return { ok: false, error: 'amount' };

      var mbk = this.investments.mbkTaken;
      mbk.amount += amount;
      mbk.monthsLeft = 6;

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Взят МБК ' + formatMoney(amount) + ' под 15% на 6 месяцев'
      });
      this.checkCapital();
      this.save();
      return { ok: true, amount: mbk.amount };
    },

    giveMBK: function (amount) {
      amount = Math.round(amount);
      if (!(amount > 0)) return { ok: false, error: 'amount' };
      if (this.liquidFunds() < amount) {
        return { ok: false, error: 'money', need: amount, available: this.liquidFunds() };
      }

      var mbk = this.investments.mbkGiven;
      mbk.amount += amount;
      mbk.monthsLeft = 6;

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Выдан МБК ' + formatMoney(amount) + ' под 12% на 6 месяцев'
      });
      this.save();
      return { ok: true, amount: mbk.amount };
    },

    buyBond: function (type, amount) {
      amount = Math.round(amount);
      if (!(amount > 0)) return { ok: false, error: 'amount' };
      if (this.liquidFunds() < amount) {
        return { ok: false, error: 'money', need: amount, available: this.liquidFunds() };
      }

      var ofz = type === 'ofz';
      this.investments.bonds.push({
        id: 'b' + (this.investments.bonds.length + 1) + '-' + this.dayNumber,
        type: type,
        amount: amount,
        rate: ofz ? 8 : 15,
        monthsLeft: 12
      });

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Куплено ' + (ofz ? 'ОФЗ' : 'корпоративных облигаций') + ' на ' + formatMoney(amount) + ' · доход ' + (ofz ? 8 : 15) + '%'
      });
      this.save();
      return { ok: true };
    },

    bondsValue: function () {
      return this.investments.bonds.reduce(function (sum, b) { return sum + b.amount; }, 0);
    },

    /* ---------- Уровни банка ---------- */
    stageInfo: function () {
      return STAGES[this.bankStage] || STAGES[1];
    },

    stageName: function () {
      return this.stageInfo().name;
    },

    stageMaxBranches: function () {
      return this.stageInfo().branchesMax;
    },

    stageManagersMax: function () {
      return this.stageInfo().managersMax;
    },

    /* продукты, доступные на текущем этапе */
    availableProducts: function () {
      return this.stageInfo().products || ['consumer'];
    },

    treasuryTabs: function () {
      return this.stageInfo().treasury || ['rates', 'liquidity'];
    },

    /* лимит очереди считается, а не накапливается */
    recalcQueue: function () {
      var base = this.stageInfo().queueBase || 15;
      var subs = this.competitors ? this.competitors.filter(function (c) { return c.status === 'subsidiary'; }).length : 0;
      this.queueLimit = base + 10 * Math.max(0, this.branches - 1) + 10 * subs;
      return this.queueLimit;
    },

    nextStage: function () {
      var nxt = STAGES[this.bankStage + 1];
      if (!nxt) return null;
      return {
        to: this.bankStage + 1,
        name: nxt.name,
        capital: nxt.capital,
        branches: nxt.branches,
        cost: nxt.cost,
        info: nxt
      };
    },

    canUpgradeStage: function () {
      var next = this.nextStage();
      if (!next) return { ok: false, reason: 'max' };
      if (this.liquidFunds() < next.cost) {
        return { ok: false, reason: 'capital', need: next.capital, next: next };
      }
      if (this.branches < next.branches) {
        return { ok: false, reason: 'branches', need: next.branches, next: next };
      }
      return { ok: true, next: next };
    },

    upgradeStage: function () {
      var check = this.canUpgradeStage();
      if (!check.ok) return check;

      var next = check.next;
      this.capital -= next.cost;
      this.bankStage = next.to;
      this.recalcQueue();
      this.recalcFlow();

      this.log.push({
        day: this.dayNumber,
        type: 'stage',
        text: '🏛 Банк стал «' + next.name + '» · лицензия ' + formatMoney(next.cost)
      });
      console.log('[stage] ' + next.name + ' · капитал −' + formatMoney(next.cost));

      this.checkAchievements();
      this.checkCapital();
      this.save();
      return { ok: true, stage: this.bankStage, name: next.name, paid: next.cost };
    },

    /* ---------- Достижения ---------- */
    achievementList: function () {
      var a = this.achievements;
      var maxShare = this.competitors.reduce(function (max, c) { return Math.max(max, c.playerShare); }, 0);

      return [
        { id: 'first_million', name: 'Первый миллион', desc: 'Заработать 1 млн ₽ сверх стартового капитала',
          got: a.first_million,
          value: Math.max(0, Math.min(this.capital - this.startCapital, 1000000)),
          target: 1000000,
          text: formatMoney(Math.max(0, this.capital - this.startCapital)) + ' / 1 млн' },
        { id: 'mole_hunter', name: 'Кротолов', desc: 'Поймать 3 кротов',
          got: a.mole_hunter, value: Math.min(this.stats.molesCaught, 3), target: 3,
          text: this.stats.molesCaught + ' / 3' },
        { id: 'magnate', name: 'Магнат', desc: 'Купить 50% акций конкурента',
          got: a.magnate, value: Math.min(maxShare, 50), target: 50,
          text: Math.round(maxShare) + ' / 50%' },
        { id: 'credit_baron', name: 'Кредитный барон', desc: 'Выдать 50 кредитов',
          got: a.credit_baron, value: Math.min(this.stats.loansIssued, 50), target: 50,
          text: this.stats.loansIssued + ' / 50' },
        { id: 'city_bank', name: 'Городской банк', desc: 'Перейти на 2-й уровень банка',
          got: a.city_bank, value: Math.min(this.bankStage - 1, 1), target: 1,
          text: this.stageName() }
      ];
    },

    checkAchievements: function () {
      var a = this.achievements;
      var unlocked = [];
      var maxShare = this.competitors.reduce(function (max, c) { return Math.max(max, c.playerShare); }, 0);

      if (!a.first_million && this.capital >= this.startCapital + 1000000) { a.first_million = true; unlocked.push('Первый миллион'); }
      if (!a.mole_hunter && this.stats.molesCaught >= 3) { a.mole_hunter = true; unlocked.push('Кротолов'); }
      if (!a.magnate && maxShare >= 50) { a.magnate = true; unlocked.push('Магнат'); }
      if (!a.credit_baron && this.stats.loansIssued >= 50) { a.credit_baron = true; unlocked.push('Кредитный барон'); }
      if (!a.city_bank && this.bankStage >= 2) { a.city_bank = true; unlocked.push('Городской банк'); }

      var self = this;
      unlocked.forEach(function (name) {
        self.log.push({ day: self.dayNumber, type: 'achievement', text: '🏆 Достижение: ' + name });
        self.pendingToasts.push('🏆 Достижение: ' + name);
        console.log('[achievement] ' + name);
      });

      return unlocked;
    },

    /* ---------- VIP-порог ---------- */
    vipLimitFor: function (type) {
      return type === 'deposit'
        ? (this.vipThresholdDeposit || 3000000)
        : (this.vipThresholdLoan || 3000000);
    },

    vipFor: function (type, amount) {
      return amount >= this.vipLimitFor(type);
    },

    setVipThreshold: function (type, value) {
      value = Math.max(100000, Math.min(100000000, Math.round(Number(value) || 0)));
      if (type === 'deposit') this.vipThresholdDeposit = value;
      else this.vipThresholdLoan = value;

      this.vipThreshold = this.vipThresholdLoan;
      this.recomputeVip();
      this.save();
      return value;
    },

    recomputeVip: function () {
      var self = this;
      this.queue.forEach(function (c) { c.isVip = self.vipFor(c.type, c.amount); });
      this.activeClients.forEach(function (c) { c.isVip = self.vipFor(c.type, c.amount); });
    },

    setClientFilter: function (value) {
      if (['all', 'loans', 'deposits', 'vip'].indexOf(value) === -1) return;
      this.clientFilter = value;
      this.save();
    },

    /* ---------- Навыки: база + бафф ---------- */
    skillValue: function (manager, key) {
      var base = (manager.skills && manager.skills[key]) || 0;
      var bonus = (manager.buffBonus && manager.buffBonus[key]) || 0;
      return base + bonus;
    },

    perkInfo: function () {
      var spec = PERK_INFO[this.specialization] || PERK_INFO.universal;
      var motiv = PERK_INFO[this.motivation] || PERK_INFO.honest;
      return { spec: spec, motiv: motiv };
    },

    /* ---------- Эмблема ---------- */
    logoIconSvg: function (id, size) {
      var paths = LOGO_ICONS[id] || LOGO_ICONS.shield;
      var s = size || 24;

      return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
        'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true">' + paths + '</svg>';
    },

    logoIconsList: function () {
      return Object.keys(LOGO_ICONS);
    },

    setLogo: function (opts) {
      if (opts.type) this.logoType = opts.type === 'icon' ? 'icon' : 'letter';
      if (opts.color) this.logoColor = opts.color;
      if (opts.icon && LOGO_ICONS[opts.icon]) this.logoIcon = opts.icon;
      if (typeof opts.letter === 'string') this.logoLetter = opts.letter;
      this.save();
    },

    /* ---------- Уведомления ---------- */
    normalizeLog: function () {
      var self = this;

      this.log = this.log.map(function (entry) {
        if (typeof entry === 'string') entry = { day: self.dayNumber, type: 'system', text: entry };

        if (!entry.id) {
          NOTIFY_SEQ += 1;
          entry.id = 'n' + NOTIFY_SEQ;
        }

        if (!entry.category) entry.category = NOTIFY_CATEGORY[entry.type] || 'system';
        if (!entry.title) entry.title = NOTIFY_TITLE[entry.type] || 'Событие';
        if (!entry.message) entry.message = entry.text || '';
        if (typeof entry.read !== 'boolean') entry.read = false;
        if (entry.link === undefined) entry.link = NOTIFY_LINK[entry.category] || '';

        return entry;
      });

      if (this.log.length > 200) this.log = this.log.slice(-200);
      return this.log;
    },

    unreadCount: function () {
      return this.log.reduce(function (sum, e) { return sum + (e.read ? 0 : 1); }, 0);
    },

    markRead: function (id) {
      var entry = null;
      for (var i = 0; i < this.log.length; i += 1) {
        if (this.log[i].id === id) entry = this.log[i];
      }
      if (!entry || entry.read) return null;

      entry.read = true;
      this.save();
      return entry;
    },

    markAllRead: function () {
      this.log.forEach(function (e) { e.read = true; });
      this.save();
      return this.log.length;
    },

    /* ---------- Онбординг ---------- */
    applyOnboarding: function (opts) {
      var b = this.bonuses;

      this.bankName = String(opts.bankName || 'Восток').slice(0, 25);
      this.founderName = String(opts.founderName || 'Основатель').slice(0, 40);
      this.logoColor = opts.logoColor || 'gold';
      this.logoType = opts.logoType === 'icon' ? 'icon' : 'letter';
      this.logoIcon = LOGO_ICONS[opts.logoIcon] ? opts.logoIcon : 'shield';
      this.logoLetter = String(this.bankName).trim().charAt(0).toUpperCase() || '?';
      this.specialization = opts.spec || 'universal';
      this.motivation = opts.motiv || 'honest';
      this.difficulty = opts.diff || 'normal';

      /* --- сброс всех модификаторов --- */
      b.flowMult = 1;
      b.depShareMult = 1;
      b.loanRateDelta = 0;
      b.riskDelta = 0;
      b.fineMult = 1;
      b.marginMult = 1;
      b.capitalMult = 1;
      b.loanAmountMult = 1;
      b.loanTermDelta = 0;
      b.bondYieldMult = 1;
      b.fxVolatilityMult = 1;
      b.vipChanceBonus = 0;
      b.salaryMult = 1;
      b.branchCostMult = 1;
      b.loyaltyGainBonus = 0;
      b.loyaltyDecayMult = 1;
      b.buffChanceBonus = 0;
      b.growthMult = 1;
      b.defaultLoss = 0.8;
      b.corpDefaultMult = 1;
      b.fxSpreadMult = 1;
      b.inspectionDays = 0;

      this.playerLoanRate = 22;
      this.playerDepositRate = 6;

      /* --- специализация --- */
      switch (this.specialization) {
        case 'retail':
          b.depShareMult = 1.2; b.riskDelta = -1; b.marginMult = 0.95;
          break;
        case 'corporate':
          b.loanRateDelta = 2.7; b.riskDelta = 1; b.flowMult = 0.9;
          this.playerLoanRate = 24.7;
          break;
        case 'mortgage':
          b.loanAmountMult = 1.25; b.loanTermDelta = 12; b.riskDelta = 1;
          break;
        case 'investment':
          b.bondYieldMult = 1.1; b.fxVolatilityMult = 1.05; b.flowMult = 0.85;
          break;
        case 'micro':
          b.flowMult = 1.5; b.riskDelta = 2; b.loanAmountMult = 0.6;
          break;
        case 'vip':
          b.vipChanceBonus = 0.3; b.salaryMult = 1.2;
          break;
        case 'currency':
          b.fxSpreadMult = 1.15; b.inspectionDays = 120;
          break;
        case 'construction':
          b.loanAmountMult = 1.2; b.defaultLoss = 1;
          break;
        case 'cooperative':
          b.loyaltyGainBonus = 15; b.salaryMult = 1.1; b.flowMult = 0.95;
          break;
        default:
          break;
      }

      /* --- мотивация --- */
      this.reputation = 61;

      switch (this.motivation) {
        case 'honest':
          this.reputation = 71; b.fineMult = 1.2;
          break;
        case 'shark':
          this.reputation = 56; b.capitalMult = 1.05;
          break;
        case 'people':
          b.flowMult *= 1.2; b.marginMult = 0.9;
          break;
        case 'aristocrat':
          this.reputation = 76; b.salaryMult *= 1.15;
          break;
        case 'analyst':
          b.flowMult *= 0.9;
          break;
        case 'risky':
          b.corpDefaultMult = 0.9; b.riskDelta += 1;
          break;
        case 'conservative':
          b.riskDelta -= 1; b.flowMult *= 0.85;
          break;
        case 'careerist':
          b.growthMult = 1.2; b.salaryMult *= 1.1;
          break;
        case 'expansionist':
          b.branchCostMult = 0.8; b.inspectionDays = 150;
          break;
        case 'ludoman':
          b.buffChanceBonus = 0.1; b.loyaltyDecayMult = 1.2;
          break;
        default:
          break;
      }

      /* --- сложность --- */
      var base = 8420000;
      var interval = 180;
      var difficultyFine = 1;

      if (this.difficulty === 'hardcore') {
        base = 5000000;
        interval = 90;
        difficultyFine = 2;
      } else if (this.difficulty === 'sandbox') {
        base = 50000000;
        interval = 0;
        difficultyFine = 0;
      }

      b.fineMult *= difficultyFine;

      if (interval > 0 && b.inspectionDays > 0) {
        interval = Math.min(interval, b.inspectionDays);
      }

      this.capital = Math.round(base * b.capitalMult);
      this.startCapital = this.capital;

      /* зарплаты менеджеров с модификатором */
      if (b.salaryMult !== 1) {
        this.managers.forEach(function (m) {
          m.salary = Math.round((m.salary * b.salaryMult) / 1000) * 1000;
        });
      }

      /* валютный банк: стартовый запас валюты */
      if (this.specialization === 'currency') {
        var usd = this.currencies.usd;
        var stash = Math.round(this.capital * 0.1);
        usd.amount = Math.round((stash / usd.rate) * 100) / 100;
        usd.cost = stash;
      }

      this.dayNumber = 41;
      this.elapsedDays = 0;
      this.nextInspectionDay = interval ? this.dayNumber + interval : 999999;
      this.prevCapital = this.capital;

      this.recalcFlow();
      this.save();
      return this;
    },

    /* ---------- Характеры, баффы, цели ---------- */
    characterInfo: function (manager) {
      return CHARACTERS[manager.character] || CHARACTERS.calm;
    },

    makeGoal: function () {
      var g = GOAL_POOL[Math.floor(Math.random() * GOAL_POOL.length)];
      return {
        id: g.id,
        title: g.title,
        target: g.target,
        deadlineDay: this.dayNumber + 180,
        done: false,
        failed: false
      };
    },

    goalProgress: function (manager) {
      var g = manager.goal;
      if (!g) return 0;

      if (g.id === 'level50') return manager.level;
      if (g.id === 'courses3') return manager.courses || 0;
      if (g.id === 'moles1') return this.stats.molesCaught;
      if (g.id === 'clean12') return manager.cleanMonths || 0;
      return 0;
    },

    rollBuff: function (level) {
      if (level >= 100) {
        var legend = LEGENDARY_BUFFS[Math.floor(Math.random() * LEGENDARY_BUFFS.length)];
        return { kind: 'legendary', name: legend.name, desc: legend.desc, apply: legend.apply };
      }

      /* 10% на 10-м уровне → 50% на 90-м */
      var chance = 0.1 + ((level - 10) / 80) * 0.4 + ((this.bonuses && this.bonuses.buffChanceBonus) || 0);

      if (Math.random() < chance) {
        var rare = RARE_BUFFS[Math.floor(Math.random() * RARE_BUFFS.length)];
        return { kind: 'rare', name: rare.name, desc: rare.desc, apply: rare.apply };
      }

      var skill = COMMON_SKILLS[Math.floor(Math.random() * COMMON_SKILLS.length)];
      var value = 1 + Math.floor(Math.random() * 5);
      var apply = {};
      apply[skill] = value;

      var label = skill === 'analytics' ? 'аналитика' : skill === 'speed' ? 'скорость' : 'осторожность';
      return { kind: 'common', name: 'Практика', desc: '+' + value + ' к ' + label, apply: apply };
    },

    applyBuff: function (manager, buff) {
      var a = buff.apply || {};
      if (!manager.buffBonus) manager.buffBonus = { analytics: 0, speed: 0, caution: 0 };

      if (a.analytics) manager.buffBonus.analytics += a.analytics;
      if (a.speed) manager.buffBonus.speed += a.speed;
      if (a.caution) manager.buffBonus.caution += a.caution;
      if (a.loyalty) manager.loyalty = Math.min(100, manager.loyalty + a.loyalty);
    },

    awardBuffs: function (manager) {
      var self = this;
      var granted = [];

      if (!Array.isArray(manager.buffLevels)) manager.buffLevels = [];
      if (!Array.isArray(manager.buffs)) manager.buffs = [];

      for (var lvl = 10; lvl <= manager.level; lvl += 10) {
        if (manager.buffLevels.indexOf(lvl) !== -1) continue;
        manager.buffLevels.push(lvl);

        var buff = this.rollBuff(lvl);
        buff.level = lvl;
        manager.buffs.push(buff);
        this.applyBuff(manager, buff);

        var label = buff.kind === 'legendary' ? 'легендарный' : buff.kind === 'rare' ? 'редкий' : 'обычный';
        this.log.push({
          day: this.dayNumber,
          type: 'growth',
          text: '✨ ' + manager.name + ' достиг ' + lvl + ' ур. Выпал ' + label + ' бафф: «' + buff.name + '»'
        });
        granted.push(buff);
      }

      return granted;
    },

    managerAchievementList: function (manager) {
      var self = this;
      return MANAGER_ACHIEVEMENTS.map(function (a) {
        var value = a.id === 'loans100' ? (manager.loans || 0)
          : a.id === 'veteran' ? (self.dayNumber - (manager.hiredDay || self.dayNumber))
          : a.id === 'clean' ? (manager.cleanMonths || 0)
          : (manager.courses || 0);

        return {
          id: a.id, name: a.name, desc: a.desc, target: a.target,
          value: Math.min(value, a.target),
          got: !!(manager.achievements && manager.achievements[a.id])
        };
      });
    },

    checkManagerAchievements: function (manager) {
      var self = this;
      var list = this.managerAchievementList(manager);

      list.forEach(function (a) {
        if (a.got || a.value < a.target) return;

        if (!manager.achievements) manager.achievements = {};
        manager.achievements[a.id] = true;

        manager.skills.analytics = Math.min(100, manager.skills.analytics + 2);
        manager.skills.speed = Math.min(100, manager.skills.speed + 2);
        manager.skills.caution = Math.min(100, manager.skills.caution + 2);

        self.log.push({
          day: self.dayNumber,
          type: 'achievement',
          text: '🏅 ' + manager.name + ' · достижение «' + a.name + '» · навыки +2'
        });
      });
    },

    /* ---------- Диалог о прибавке ---------- */
    resolveNegotiation: function (action) {
      var neg = this.negotiation;
      if (!neg) return { ok: false, error: 'none' };

      var m = this.managerById(neg.managerId);
      this.negotiation = null;
      if (!m) return { ok: false, error: 'gone' };

      if (action === 'raise') {
        m.salary = Math.round((m.salary * 1.15) / 1000) * 1000;
        m.loyalty = Math.min(100, m.loyalty + 10);
        this.log.push({ day: this.dayNumber, type: 'growth', text: '📈 ' + m.name + ' получил прибавку · ' + formatMoney(m.salary) + '/мес · лояльность +10' });
      } else if (action === 'bonus') {
        var cost = Math.round((m.salary * 0.5) / 1000) * 1000;
        this.capital -= cost;
        m.loyalty = Math.min(100, m.loyalty + 5);
        this.log.push({ day: this.dayNumber, type: 'growth', text: '💸 ' + m.name + ' получил премию ' + formatMoney(cost) + ' · лояльность +5' });
      } else {
        m.loyalty = Math.max(0, m.loyalty - 10);
        var risk = Math.random() < 0.25;
        if (risk) m.mole = true;
        this.log.push({
          day: this.dayNumber,
          type: 'warn',
          text: '⚠ ' + m.name + ' получил отказ · лояльность −10' + (risk ? ' · он обиделся и стал кротом' : '')
        });
      }

      this.checkCapital();
      this.save();
      return { ok: true, manager: m };
    },

    /* ---------- Развитие персонала ---------- */
    trainCost: 100000,

    promoteCost: function (manager) {
      return Math.round(manager.salary * 2 / 1000) * 1000;
    },

    trainManager: function (id) {
      var m = this.managerById(id);
      if (!m) return { ok: false, error: 'not-found' };
      if (m.level >= (m.potentialMax || 100)) return { ok: false, error: 'potential' };
      if (m.level >= 100) return { ok: false, error: 'max' };
      if (this.liquidFunds() < this.trainCost) {
        return { ok: false, error: 'money', need: this.trainCost, available: this.capital };
      }

      this.capital -= this.trainCost;
      m.level = Math.min(100, m.level + 1);
      m.skills.analytics = Math.min(100, m.skills.analytics + 2);
      m.skills.speed = Math.min(100, m.skills.speed + 2);
      m.skills.caution = Math.min(100, m.skills.caution + 2);
      m.loyalty = Math.min(100, m.loyalty + 5 + ((this.bonuses && this.bonuses.loyaltyGainBonus) || 0));
      m.promotedDay = this.dayNumber;

      m.courses = (m.courses || 0) + 1;
      this.awardBuffs(m);

      this.log.push({
        day: this.dayNumber,
        type: 'growth',
        text: '📚 ' + m.name + ' · курсы · уровень ' + m.level + ' · лояльность +5'
      });
      console.log('[growth] курсы · ' + m.name + ' → ' + m.level);

      this.save();
      return { ok: true, manager: m, paid: this.trainCost };
    },

    promoteManager: function (id) {
      var m = this.managerById(id);
      if (!m) return { ok: false, error: 'not-found' };
      if (m.level >= (m.potentialMax || 100)) return { ok: false, error: 'potential' };
      if (m.level >= 100) return { ok: false, error: 'max' };

      var cost = this.promoteCost(m);
      if (this.liquidFunds() < cost) {
        return { ok: false, error: 'money', need: cost, available: this.liquidFunds() };
      }

      var growth = (this.bonuses && this.bonuses.growthMult) || 1;
      var levels = Math.round((m.level < 50 ? 10 : 5) * growth);
      var loyaltyGain = 15 + Math.floor(Math.random() * 6) + ((this.bonuses && this.bonuses.loyaltyGainBonus) || 0);
      var bump = function (value) { return Math.min(100, value + 3 + Math.floor(Math.random() * 3)); };

      this.capital -= cost;
      m.level = Math.min(100, m.level + levels);
      m.skills.analytics = bump(m.skills.analytics);
      m.skills.speed = bump(m.skills.speed);
      m.skills.caution = bump(m.skills.caution);
      m.salary = Math.round(m.salary * 1.15 / 1000) * 1000;
      m.loyalty = Math.min(100, m.loyalty + loyaltyGain);
      m.promotedDay = this.dayNumber;

      this.awardBuffs(m);

      this.log.push({
        day: this.dayNumber,
        type: 'growth',
        text: '📈 ' + m.name + ' повышен до уровня ' + m.level + ' · лояльность +' + loyaltyGain
      });
      console.log('[growth] повышение · ' + m.name + ' → ' + m.level + ' · +' + loyaltyGain + ' лояльности');

      this.save();
      return { ok: true, manager: m, paid: cost, loyalty: loyaltyGain };
    },

    /* ---------- Служба безопасности ---------- */
    managerMarketSalary: function (manager) {
      return Math.round((30000 + manager.level * 2600) / 1000) * 1000;
    },

    upgradeSecurity: function (points, cost) {
      if (this.securityLevel >= 100) return { ok: false, error: 'max' };
      if (this.liquidFunds() < cost) return { ok: false, error: 'money', need: cost, available: this.liquidFunds() };

      this.capital -= cost;
      this.securityLevel = Math.min(100, this.securityLevel + points);

      this.log.push({
        day: this.dayNumber,
        type: 'security',
        text: 'СБ усилена до ' + this.securityLevel + ' · ' + formatMoney(cost)
      });
      this.incidents.push({
        day: this.dayNumber,
        type: 'upgrade',
        text: 'Уровень СБ повышен до ' + this.securityLevel + ' (' + formatMoney(cost) + ')'
      });

      this.save();
      return { ok: true, level: this.securityLevel, paid: cost };
    },

    moles: function () {
      return this.managers.filter(function (m) { return m.mole; });
    },

    /* застой: лояльность падает каждый месяц */
    applyLoyaltyDecay: function () {
      var self = this;

      this.managers.forEach(function (m) {
        /* повышение/курсы сбрасывают застой на месяц */
        if (m.promotedDay && self.dayNumber - m.promotedDay < 30) return;

        var market = self.managerMarketSalary(m);
        var drop = 2 + Math.floor(Math.random() * 3);            // 2–4
        if (m.salary < market) drop += 1;                        // низкая зарплата — ещё пункт

        var bonus = 0;
        var character = m.character || 'calm';
        var monthsSincePromotion = m.promotedDay ? (self.dayNumber - m.promotedDay) / 30 : 99;

        if (m.level >= (m.potentialMax || 100)) {
          drop += 2;
          self.log.push({
            day: self.dayNumber,
            type: 'warn',
            text: '⚠ ' + m.name + ' достиг потолка ' + (m.potentialMax || 100) + ' · роста больше не будет'
          });
        }

        if (character === 'ambitious') {
          /* ненавидит застой: три месяца без повышения — падение сильнее */
          if (monthsSincePromotion >= 3) drop += 3;
        } else if (character === 'materialist') {
          if (m.salary < market) drop += 2;
          else if (m.salary > market * 1.1) bonus += 3;
        } else if (character === 'loyalist') {
          if (self.defaultsThisMonth > 0) drop += 4;
          else if (self.prevCapital !== null && self.capital > self.prevCapital) bonus += 1;
        } else if (character === 'perfectionist') {
          if (self.defaultsThisMonth > 0) drop += 3;
        }

        var decayMult = (self.bonuses && self.bonuses.loyaltyDecayMult) || 1;
        if (drop > 0 && decayMult !== 1) drop = Math.round(drop * decayMult);

        m.loyalty = Math.max(0, Math.min(100, m.loyalty - drop + bonus));

        if (m.loyalty < 20) {
          self.log.push({
            day: self.dayNumber,
            type: 'warn',
            text: '⚠ ' + m.name + ' на грани увольнения · лояльность ' + m.loyalty
          });
        }
      });
    },

    processMoles: function () {
      var self = this;
      var caught = [];

      /* 1. кроты вредят: фейковые кредиты */
      this.managers.forEach(function (m) {
        if (!m.mole) return;

        var count = Math.random() < 0.5 ? 1 : 2;
        for (var i = 0; i < count; i += 1) {
          var amount = Math.round((300000 + Math.random() * 1200000) / 1000) * 1000;
          self.capital -= amount;

          self.log.push({
            day: self.dayNumber,
            type: 'default',
            text: '❌ Фейковый кредит: ' + m.name + ' одобрил ' + formatMoney(amount) + ' — ушёл в дефолт'
          });
          self.incidents.push({
            day: self.dayNumber,
            type: 'leak',
            text: m.name + ' · фиктивный кредит ' + formatMoney(amount)
          });
        }

        self.log.push({
          day: self.dayNumber,
          type: 'warn',
          text: '⚠ Утечка: ' + m.name + ' сливает данные конкуренту'
        });
      });

      /* 2. вербовка недовольных */
      this.managers.forEach(function (m) {
        if (m.mole || m.loyalty >= 40) return;

        var chance = (100 - m.loyalty) * 0.01;
        if (Math.random() < chance) {
          m.mole = true;
          self.log.push({
            day: self.dayNumber,
            type: 'warn',
            text: '⚠ ' + m.name + ' завербован конкурентом · лояльность ' + m.loyalty
          });
          self.incidents.push({
            day: self.dayNumber,
            type: 'recruit',
            text: m.name + ' завербован конкурентом (лояльность ' + m.loyalty + ')'
          });
          console.warn('[sb] завербован · ' + m.name);
        }
      });

      /* 3. проверки СБ */
      this.managers.forEach(function (m) {
        if (!m.mole) return;
        if (Math.random() < self.securityLevel / 100) caught.push(m.id);
      });

      if (caught.length) {
        var self2 = this;
        caught.forEach(function (id) {
          var m = self2.managerById(id);
          if (!m) return;

          self2.stats.molesCaught += 1;
          self2.log.push({
            day: self2.dayNumber,
            type: 'security',
            text: '🛡 СБ поймала крота: ' + m.name
          });
          self2.incidents.push({
            day: self2.dayNumber,
            type: 'caught',
            text: m.name + ' пойман и уволен'
          });
        });

        this.managers = this.managers.filter(function (m) { return caught.indexOf(m.id) === -1; });

        if (!this.managers.length) {
          this.activeManagerId = null;
        } else if (caught.indexOf(this.activeManagerId) !== -1) {
          this.activeManagerId = this.managers[0].id;
        }
      }

      return caught.length;
    },

    /* ---------- Ставки ---------- */
    setLoanRate: function (value) {
      this.playerLoanRate = Math.max(5, Math.min(35, value));
      this.save();
    },

    setDepositRate: function (value) {
      this.playerDepositRate = Math.max(1, Math.min(25, value));
      this.save();
    },

    activeCompetitors: function () {
      return this.competitors.filter(function (c) { return c.status === 'competitor'; });
    },

    bestDepositRate: function () {
      return this.activeCompetitors().reduce(function (max, c) { return Math.max(max, c.depositRate); }, 0);
    },

    bestLoanRate: function () {
      return this.activeCompetitors().reduce(function (min, c) {
        return min === null ? c.loanRate : Math.min(min, c.loanRate);
      }, null);
    },

    /* кто выигрывает по вкладам / кредитам */
    rateAdvantage: function () {
      var bestDep = this.bestDepositRate();
      var bestLoan = this.bestLoanRate();
      return {
        deposit: this.playerDepositRate - bestDep,      // > 0 — мы платим больше
        loan: (bestLoan === null ? this.playerLoanRate : bestLoan) - this.playerLoanRate // > 0 — мы берем меньше
      };
    },

    /* поток клиентов: (0,25 + 2 за филиал + бонусы) × 1,2 */
    recalcFlow: function () {
      var base = 1 + 1.9 * Math.pow(Math.max(0, this.branches - 1), 0.6) + (this.flowBonus || 0);
      var mult = (this.bonuses && this.bonuses.flowMult) || 1;
      this.clientsPerDay = Math.round(base * mult * 100) / 100;
    },

    /* ---------- Найм ---------- */
    candidates: [],

    /* ---------- Менеджеры ---------- */
    managers: [
      {
        id: 'm1',
        name: 'Иванов Пётр',
        level: 34,
        skills: { analytics: 62, speed: 48, caution: 39 },
        loyalty: 64,
        salary: 40000,
        autopilot: false,
        progress: 0
      }
    ],
    activeManagerId: 'm1',

    /* ---------- Портфель ---------- */
    activeLoans: [],
    activeDeposits: [],
    lastMonth: null,

    /* ---------- Клиенты ---------- */
    activeClients: [],      // живой поток: последние 5 пришедших
    queue: [],              // ждут решения
    queueLimit: 15,
    nextClientDay: 44,
    maxClients: 5,
    burned: 0,              // сколько ушло к конкурентам

    /* ---------- Регулятор ---------- */
    reputation: 61,
    nextInspectionDay: 221,     // старт (день 41) + 180
    inspecting: false,
    inspection: null,

    /* ---------- Деньги в обороте ---------- */
    reserved: 0,            // зарезервировано (задел на будущее)
    bankrupt: false,
    lowWarned: false,
    alert: null,            // 'low' | 'bankrupt' — одноразовое уведомление
    notice: null,           // одноразовое сообщение для тоста
    noSave: false,          // после сброса не пишем сейв до перезагрузки

    /* ---------- Журнал ---------- */
    log: [],

    /* ---------- Представление ---------- */
    dateLabel: function () {
      return this.date.getDate() + ' ' + MONTHS[this.date.getMonth()] + ' ' + this.date.getFullYear();
    },

    /* расходы за месяц: оклады + содержание филиалов + фикс */
    monthlyExpenses: function () {
      var salaries = this.managers.reduce(function (sum, m) { return sum + (m.salary || 0); }, 0);
      return salaries + 30000 * Math.max(1, this.branches) + 30000;
    },

    /* вероятность дефолта в месяц по уровню риска (годовые: 1/3/8/18/35%) */
    monthlyDefaultChance: function (risk) {
      var annual = { 1: 0.005, 2: 0.02, 3: 0.05, 4: 0.25, 5: 0.50 }[risk];
      if (!annual) annual = 0.08;
      return 1 - Math.pow(1 - annual, 1 / 12);
    },

    dayLabel: function () {
      return 'день ' + this.dayNumber;
    },

    /* ---------- Учёт: капитал — это собственные средства ---------- */
    loansBody: function () {
      return this.activeLoans.reduce(function (s, l) { return s + l.amount; }, 0);
    },

    depositsBody: function () {
      return this.activeDeposits.reduce(function (s, d) { return s + d.amount; }, 0);
    },

    fxCost: function () {
      var c = this.currencies || {};
      return ((c.usd && c.usd.cost) || 0) + ((c.eur && c.eur.cost) || 0) + ((c.cny && c.cny.cost) || 0);
    },

    /* свободные деньги: капитал + привлечённое − выданное */
    cash: function () {
      var inv = this.investments || {};
      return this.capital
        + this.depositsBody()
        + (inv.cbLoan || 0) + ((inv.mbkTaken && inv.mbkTaken.amount) || 0)
        - this.loansBody()
        - this.bondsValue()
        - this.fxCost()
        - ((inv.mbkGiven && inv.mbkGiven.amount) || 0)
        - this.reserved;
    },

    liquidFunds: function () {
      return Math.max(0, this.cash());
    },

    /* инвариант cash() >= 0: сначала ЦБ, потом бумаги/валюта, в конце капитал */
    ensureLiquidity: function () {
      var gap = -this.cash();
      if (gap <= 0) return 0;

      var taken = 0;

      var limitLeft = Math.max(0, this.cbLoanLimit() - this.investments.cbLoan);
      if (limitLeft > 0) {
        var take = Math.min(gap, limitLeft);
        this.investments.cbLoan += take;
        gap -= take;
        taken += take;
      }

      if (gap > 0 && this.investments.bonds.length) {
        var bonds = this.investments.bonds;
        while (gap > 0 && bonds.length) {
          var b = bonds[0];
          if (b.amount <= gap) {
            gap -= b.amount;
            bonds.shift();
          } else {
            b.amount -= gap;
            gap = 0;
          }
        }
      }

      if (gap > 0) {
        ['usd', 'eur', 'cny'].forEach(function (code) {
          var c = this.currencies[code];
          if (gap <= 0 || !c || c.cost <= 0) return;
          var avg = c.amount > 0 ? c.cost / c.amount : 0;
          if (avg <= 0) return;
          var sellAmount = Math.min(c.amount, gap / avg);
          c.amount -= sellAmount;
          c.cost = Math.max(0, c.cost - avg * sellAmount);
          gap -= sellAmount * avg;
        }, this);
      }

      if (gap > 0) {
        this.capital -= gap;
        gap = 0;
      }

      if (taken > 0) {
        this.log.push({
          day: this.dayNumber,
          type: 'treasury',
          text: 'Кассовый разрыв: взят кредит ЦБ ' + formatMoney(taken) +
            ' · долг ' + formatMoney(this.investments.cbLoan)
        });
      }

      return taken;
    },

    /* хватает ли свободных денег на заявку */
    canApprove: function (client) {
      if (!client) return false;
      if (client.type !== 'loan') return true;       // вклад приносит деньги
      return this.liquidFunds() >= client.amount;
    },

    /* пороги: < 10% от стартового — предупреждение, < 0 — крах */
    checkCapital: function () {
      this.ensureLiquidity();
      var low = this.startCapital * 0.1;

      if (this.capital < 0 && !this.bankrupt) {
        this.bankrupt = true;
        this.paused = true;
        this.alert = 'bankrupt';
        this.log.push({ day: this.dayNumber, type: 'bankrupt',
          text: '🔴 Банк неплатёжеспособен: капитал ' + formatMoney(this.capital) });
        console.error('[state] БАНК НЕПЛАТЁЖЕСПОСОБЕН · ' + formatMoney(this.capital));
        return 'bankrupt';
      }

      if (this.capital < low && this.capital >= 0 && !this.lowWarned) {
        this.lowWarned = true;
        this.alert = 'low';
        this.log.push({ day: this.dayNumber, type: 'warn',
          text: '⚠ Критически низкий уровень свободных средств: ' + formatMoney(this.capital) });
        console.warn('[state] критически низкий капитал · ' + formatMoney(this.capital));
        return 'low';
      }

      return null;
    },

    typeLabel: function (type) {
      return type === 'loan' ? 'кредит' : 'вклад';
    },

    riskLabel: function (risk) {
      if (risk >= 4) return 'высокий';
      if (risk === 3) return 'средний';
      return 'низкий';
    },

    /* ---------- Найм ---------- */
    makeCandidate: function () {
      var stageFloor = [0, 5, 10, 20, 30, 40, 50][this.bankStage] || 5;
      var level = stageFloor + Math.floor(Math.random() * (91 - stageFloor));
      var jitter = function (base) {
        return Math.max(5, Math.min(99, base + Math.round((Math.random() - 0.5) * 30)));
      };

      NEW_CANDIDATE_SEQ += 1;

      var chars = Object.keys(CHARACTERS);

      /* потенциал: потолок роста. Гений — 2% и всегда ровно 100 */
      var roll = Math.random();
      var potential;
      var potentialMax;

      if (roll < 0.02 + 0.005 * (this.bankStage - 1)) {
        potential = 'genius';
        potentialMax = 100;
      } else if (roll < 0.52) {
        potential = 'low';
        potentialMax = 50 + Math.floor(Math.random() * 11);
      } else if (roll < 0.87) {
        potential = 'medium';
        potentialMax = 70 + Math.floor(Math.random() * 11);
      } else {
        potential = 'high';
        potentialMax = 90 + Math.floor(Math.random() * 11);
      }

      if (potential !== 'genius') potentialMax = Math.max(potentialMax, level + 1);
      potentialMax = Math.min(100, potentialMax);

      var market = Math.round(((30000 + level * 2200) * ((this.bonuses && this.bonuses.salaryMult) || 1)) / 1000) * 1000;

      return {
        id: 'cand' + NEW_CANDIDATE_SEQ,
        potential: potential,
        potentialMax: potentialMax,
        name: CANDIDATE_NAMES[Math.floor(Math.random() * CANDIDATE_NAMES.length)],
        level: level,
        /* гений знает себе цену: двойной оклад */
        salary: potential === 'genius' ? market * 2 : market,
        character: potential === 'genius' ? 'ambitious' : chars[Math.floor(Math.random() * chars.length)],
        skills: {
          analytics: jitter(level),
          speed: jitter(level),
          caution: jitter(level)
        }
      };
    },

    ensureCandidates: function () {
      while (this.candidates.length < 3) this.candidates.push(this.makeCandidate());
      return this.candidates;
    },

    hireCandidate: function (id) {
      var idx = -1;
      for (var i = 0; i < this.candidates.length; i += 1) {
        if (this.candidates[i].id === id) idx = i;
      }
      if (idx < 0) return { ok: false, error: 'not-found' };

      if (this.managers.length >= this.stageManagersMax()) {
        var nxtStage = this.nextStage();
        return {
          ok: false,
          error: 'staff',
          need: nxtStage ? nxtStage.name : 'максимум',
          limit: this.stageManagersMax()
        };
      }

      var cand = this.candidates[idx];
      var upfront = cand.salary;                 // первый месяц вперёд

      if (this.liquidFunds() < upfront) {
        return { ok: false, error: 'money', need: upfront, available: this.capital };
      }

      this.capital -= upfront;
      NEW_MANAGER_SEQ += 1;

      var manager = {
        id: 'm' + NEW_MANAGER_SEQ,
        name: cand.name,
        level: cand.level,
        skills: cand.skills,
        loyalty: 55,
        salary: cand.salary,
        autopilot: false,
        progress: 0,
        character: cand.character || 'calm',
        buffBonus: { analytics: 0, speed: 0, caution: 0 },
        workMode: 'all',
        potential: cand.potential || 'medium',
        potentialMax: cand.potentialMax || 75,
        buffs: [],
        buffLevels: [],
        courses: 0,
        cleanMonths: 0,
        loans: 0,
        hiredDay: this.dayNumber,
        achievements: {},
        goal: this.makeGoal()
      };

      this.awardBuffs(manager);

      this.managers.push(manager);
      this.candidates.splice(idx, 1);
      this.ensureCandidates();

      this.log.push({ day: this.dayNumber, type: 'hire', text: 'Нанят менеджер: ' + cand.name + ' · ' + formatMoney(cand.salary) + '/мес' });
      console.log('[hire] ' + cand.name + ' · уровень ' + cand.level);

      this.checkCapital();
      this.save();
      return { ok: true, manager: manager, paid: upfront };
    },

    fireManager: function (id) {
      if (this.managers.length <= 1) return { ok: false, error: 'last' };

      var idx = -1;
      for (var i = 0; i < this.managers.length; i += 1) {
        if (this.managers[i].id === id) idx = i;
      }
      if (idx < 0) return { ok: false, error: 'not-found' };

      var manager = this.managers[idx];
      var severance = manager.salary;

      this.capital -= severance;
      this.managers.splice(idx, 1);

      if (this.activeManagerId === id) this.activeManagerId = this.managers[0].id;

      this.log.push({ day: this.dayNumber, type: 'fire', text: 'Уволен менеджер: ' + manager.name + ' · выходное пособие ' + formatMoney(severance) });

      if (manager.potential === 'genius') {
        this.log.push({
          day: this.dayNumber,
          type: 'warn',
          text: '⚠ Вы уволили менеджера с потенциалом Гений!'
        });
      }
      console.log('[fire] ' + manager.name + ' · пособие ' + formatMoney(severance));

      this.checkCapital();
      this.save();
      return { ok: true, manager: manager, paid: severance };
    },

    /* ---------- Акции конкурентов ---------- */
    sharePrice: function (competitor) {
      return Math.round(competitor.capital / 100000);
    },

    packagePrice: function (competitor, percent) {
      return Math.round(competitor.capital * percent / 100);
    },

    buyShares: function (id, percent) {
      var comp = null;
      for (var i = 0; i < this.competitors.length; i += 1) {
        if (this.competitors[i].id === id) comp = this.competitors[i];
      }
      if (!comp || comp.status !== 'competitor') return { ok: false, error: 'not-found' };

      var price = this.packagePrice(comp, percent);
      if (this.liquidFunds() < price) {
        return { ok: false, error: 'money', need: price, available: this.liquidFunds() };
      }

      this.capital -= price;
      comp.playerShare = Math.min(100, comp.playerShare + percent);

      this.log.push({
        day: this.dayNumber,
        type: 'stock',
        text: 'Куплено ' + percent + '% «' + comp.name + '» · ' + formatMoney(price)
      });

      if (comp.playerShare >= 20 && !comp.cbWarned) {
        comp.cbWarned = true;
        this.log.push({
          day: this.dayNumber,
          type: 'warn',
          text: '⚠ «' + comp.name + '»: доля выше 20% — требуется согласие ЦБ'
        });
      }

      if (comp.playerShare >= 50.5) {
        comp.status = 'subsidiary';
        /* капитал остаётся у дочернего банка; вы получаете его поток и долю прибыли */
        this.queueLimit += 10;
        this.flowBonus = (this.flowBonus || 0) + 1;
        this.recalcFlow();
        this.log.push({
          day: this.dayNumber,
          type: 'stock',
          text: '🏦 «' + comp.name + '» стал дочерним: поток клиентов и 3% его капитала в год вам'
        });
      }

      this.stats.sharesBought += percent;
      this.checkAchievements();

      console.log('[stocks] ' + comp.name + ' · доля ' + comp.playerShare + '% · −' + formatMoney(price));
      this.save();
      return { ok: true, competitor: comp, paid: price };
    },

    /* ---------- Филиалы ---------- */
    branchPrice: function () {
      var mult = (this.bonuses && this.bonuses.branchCostMult) || 1;
      var scale = 1 + Math.max(0, this.capital) / 100000000;
      return Math.round((this.branchCost * mult * scale) / 100000) * 100000;
    },

    openBranch: function () {
      if (this.branches >= this.stageMaxBranches()) {
        var nxt = this.nextStage();
        return {
          ok: false,
          error: 'stage',
          need: nxt ? nxt.name : 'максимум',
          limit: this.stageMaxBranches()
        };
      }

      var price = this.branchPrice();
      if (this.liquidFunds() < price) {
        return { ok: false, error: 'money', need: price, available: this.liquidFunds() };
      }

      this.capital -= price;
      this.branches += 1;
      this.recalcQueue();
      this.recalcFlow();

      this.log.push({
        day: this.dayNumber,
        type: 'branch',
        text: 'Открыт филиал №' + this.branches + ' · ' + formatMoney(price) + ' · очередь до ' + this.queueLimit
      });
      console.log('[branch] открыт №' + this.branches + ' · поток ' + this.clientsPerDay.toFixed(2) + '/день');

      this.checkCapital();
      this.save();
      return { ok: true, branches: this.branches, queueLimit: this.queueLimit };
    },

    /* ---------- Экономика ---------- */
    monthlyIncome: function () {
      return this.activeLoans.reduce(function (sum, loan) {
        return sum + loan.amount * (loan.rate / 100) / 12;
      }, 0);
    },

    monthlyExpense: function () {
      return this.activeDeposits.reduce(function (sum, dep) {
        return sum + dep.amount * (dep.rate / 100) / 12;
      }, 0);
    },

    portfolioValue: function () {
      return this.activeLoans.reduce(function (s2, l) { return s2 + l.amount; }, 0);
    },

    /* месячный цикл: проценты, дефолты, закрытия */
    processMonthlyEconomy: function () {
      var self = this;
      var income = 0;
      var expense = 0;
      var defaults = 0;

      this.defaultsThisMonth = 0;
      var cleanMonth = true;

      /* ---- кредиты: наш доход ---- */
      this.activeLoans.forEach(function (loan) {
        var interest = loan.amount * (loan.rate / 100) / 12 * ((self.bonuses && self.bonuses.marginMult) || 1);
        self.capital += interest;
        income += interest;
        loan.monthsLeft -= 1;

        /* дефолт возможен на любом риске — по годовой вероятности уровня */
        if (Math.random() < self.monthlyDefaultChance(loan.risk)) {
          loan.closed = 'default';
          defaults += 1;
          self.defaultsThisMonth += 1;
          cleanMonth = false;

          var recovered = Math.round(loan.amount * (0.40 + Math.random() * 0.05));
          self.capital -= (loan.amount - recovered);

          self.log.push({
            day: self.dayNumber,
            type: 'default',
            text: '❌ ДЕФОЛТ: ' + loan.name + ' не вернул ' + formatMoney(loan.amount) +
              (recovered > 0 ? ' · взыскано ' + formatMoney(recovered) : '')
          });
          console.warn('[economy] дефолт · ' + loan.name + ' · ' + formatMoney(loan.amount));
          return;
        }

        if (loan.monthsLeft <= 0) {
          loan.closed = 'paid';
          self.log.push({
            day: self.dayNumber,
            type: 'closed',
            text: '✅ Кредит закрыт: ' + loan.name + ' вернул ' + formatMoney(loan.amount)
          });
        }
      });
      this.activeLoans = this.activeLoans.filter(function (l) { return !l.closed; });

      if (cleanMonth && defaults === 0) {
        this.reputation = Math.min(100, this.reputation + 1);
      }

      /* ---- вклады: наш расход ---- */
      this.activeDeposits.forEach(function (dep) {
        var interest = dep.amount * (dep.rate / 100) / 12;
        self.capital -= interest;
        expense += interest;
        dep.monthsLeft -= 1;

        if (dep.monthsLeft <= 0) {
          /* денег на выплату нет — вклад пролонгируется, кассового разрыва не создаём */
          if (self.cash() < dep.amount) {
            dep.monthsLeft = dep.term || 12;
            self.log.push({
              day: self.dayNumber,
              type: 'deposit',
              text: 'Вклад пролонгирован: ' + dep.name + ' · ' + formatMoney(dep.amount)
            });
            return;
          }

          dep.closed = 'returned';
          self.log.push({
            day: self.dayNumber,
            type: 'closed',
            text: '✅ Вклад закрыт: ' + dep.name + ' забрал ' + formatMoney(dep.amount)
          });
        }
      });
      this.activeDeposits = this.activeDeposits.filter(function (d) { return !d.closed; });

      /* свободные деньги приносят ключевую ставку ЦБ */
      this.capital += Math.max(0, this.cash()) * 0.075 / 12;

      this.lastMonth = {
        day: this.dayNumber,
        income: income,
        expense: expense,
        defaults: defaults,
        profit: income - expense
      };

      /* казначейство: проценты по долгам, купоны */
      var treasury = this.investments;
      var treasuryNet = 0;

      if (treasury.cbLoan > 0) {
        var cbInterest = treasury.cbLoan * 0.28 / 12;
        this.capital -= cbInterest;
        treasuryNet -= cbInterest;
        expense += cbInterest;
        this.log.push({
          day: this.dayNumber,
          type: 'treasury',
          text: 'Проценты ЦБ · −' + formatMoney(cbInterest) + ' · долг ' + formatMoney(treasury.cbLoan)
        });
      }

      /* дивиденды дочерних банков */
      this.competitors.forEach(function (comp) {
        if (comp.status !== 'subsidiary') return;
        var share = comp.capital * 0.03 / 12;
        self.capital += share;
        income += share;
      });

      if (treasury.mbkTaken.amount > 0) {
        var mbkIn = treasury.mbkTaken.amount * 0.15 / 12;
        this.capital -= mbkIn;
        treasuryNet -= mbkIn;
        expense += mbkIn;
        treasury.mbkTaken.monthsLeft -= 1;
        if (treasury.mbkTaken.monthsLeft <= 0) {
          this.log.push({
            day: this.dayNumber,
            type: 'treasury',
            text: 'МБК погашен: −' + formatMoney(treasury.mbkTaken.amount)
          });
          treasury.mbkTaken = { amount: 0, monthsLeft: 0 };
        }
      }

      if (treasury.mbkGiven.amount > 0) {
        var mbkOut = treasury.mbkGiven.amount * 0.12 / 12;
        this.capital += mbkOut;
        treasuryNet += mbkOut;
        income += mbkOut;
        treasury.mbkGiven.monthsLeft -= 1;
        if (treasury.mbkGiven.monthsLeft <= 0) {
          this.log.push({
            day: this.dayNumber,
            type: 'treasury',
            text: 'МБК возвращён: +' + formatMoney(treasury.mbkGiven.amount)
          });
          treasury.mbkGiven = { amount: 0, monthsLeft: 0 };
        }
      }

      var bonds = treasury.bonds;
      var selfT = this;
      bonds.forEach(function (bond) {
        var coupon = bond.amount * (bond.rate / 100) / 12 * ((selfT.bonuses && selfT.bonuses.bondYieldMult) || 1);
        selfT.capital += coupon;
        treasuryNet += coupon;
        income += coupon;
        bond.monthsLeft -= 1;

        var corpRisk = 0.04 * ((selfT.bonuses && selfT.bonuses.corpDefaultMult) || 1);
        if (bond.type === 'corp' && Math.random() < corpRisk) {
          bond.defaulted = true;
          selfT.defaultsThisMonth += 1;
          selfT.capital -= bond.amount;
          selfT.log.push({
            day: selfT.dayNumber,
            type: 'default',
            text: '❌ Дефолт эмитента · потеряно ' + formatMoney(bond.amount)
          });
          return;
        }

        if (bond.monthsLeft <= 0) {
          /* бумага гасится в деньги: капитал не меняется */
          bond.redeemed = true;
          selfT.log.push({
            day: selfT.dayNumber,
            type: 'treasury',
            text: 'Облигации погашены: +' + formatMoney(bond.amount)
          });
        }
      });
      treasury.bonds = bonds.filter(function (b) { return !b.defaulted && !b.redeemed; });

      var fx = this.fxPosition();
      if (fx.cost > 0) {
        this.log.push({
          day: this.dayNumber,
          type: fx.pnl >= 0 ? 'treasury' : 'warn',
          text: (fx.pnl >= 0 ? 'Курсовая прибыль: +' : 'Курсовой убыток: −') + formatMoney(Math.abs(fx.pnl))
        });
      }

      /* люди: застой, кроты, проверки СБ */
      this.applyLoyaltyDecay();
      this.processMoles();

      /* личные цели менеджеров */
      this.managers.forEach(function (m) {
        if (m.cleanMonths === undefined) m.cleanMonths = 0;
        if (self.defaultsThisMonth === 0) m.cleanMonths += 1;

        self.checkManagerAchievements(m);

        var goal = m.goal;
        if (!goal || goal.done || goal.failed) return;

        if (self.goalProgress(m) >= goal.target) {
          goal.done = true;
          m.loyalty = Math.min(100, m.loyalty + 20);

          var premium = m.salary;
          self.capital -= premium;

          self.log.push({
            day: self.dayNumber,
            type: 'growth',
            text: '🎯 ' + m.name + ' выполнил цель «' + goal.title + '» · +20 лояльности, премия ' + formatMoney(premium)
          });
        } else if (self.dayNumber >= goal.deadlineDay) {
          goal.failed = true;
          m.loyalty = Math.max(0, m.loyalty - 15);

          self.log.push({
            day: self.dayNumber,
            type: 'warn',
            text: '⏳ ' + m.name + ' провалил цель «' + goal.title + '» · лояльность −15'
          });
        }
      });

      /* просьба о прибавке */
      if (!this.negotiation) {
        for (var ni = 0; ni < this.managers.length; ni += 1) {
          var nm = this.managers[ni];
          if (!nm.mole && nm.loyalty < 40) {
            this.negotiation = { managerId: nm.id, day: this.dayNumber };
            this.log.push({
              day: this.dayNumber,
              type: 'warn',
              text: '💬 ' + nm.name + ' просит прибавку · лояльность ' + nm.loyalty
            });
            break;
          }
        }
      }

      this.prevCapital = this.capital;

      /* сводка по переманенным клиентам */
      this.competitors.forEach(function (c) {
        if (c.stolen > 0) {
          self.log.push({
            day: self.dayNumber,
            type: 'warn',
            text: c.name + ' переманил ' + c.stolen + ' клиентов из-за более выгодной ставки'
          });
          c.stolen = 0;
        }
      });

      this.log.push({
        day: this.dayNumber,
        type: 'month',
        text: '📅 Месяц: проценты +' + formatMoney(income) + ' · по вкладам −' + formatMoney(expense)
      });

      this.checkAchievements();
      this.checkCapital();
      this.save();
      return this.lastMonth;
    },

    /* ---------- Время ---------- */
    advanceDay: function () {
      this.elapsedDays += 1;
      this.dayNumber = this.startDayNumber + this.elapsedDays;

      if (this.today.day !== this.dayNumber) {
        this.today = { day: this.dayNumber, clients: 0, approved: 0, auto: 0 };
      }

      if (!Array.isArray(this.capitalHistory)) this.capitalHistory = [];
      this.capitalHistory.push({ day: this.dayNumber, capital: Math.round(this.capital) });
      if (this.capitalHistory.length > 90) this.capitalHistory.shift();

      var before = this.capital;

      if (this.elapsedDays % this.salaryEveryDays === 0) {
        var monthlyCost = this.monthlyExpenses();
        this.capital -= monthlyCost;
        this.log.push({ day: this.dayNumber, type: 'salary', text: 'Расходы за месяц −' + formatMoney(monthlyCost) });
        console.log('[state] расходы · −' + formatMoney(monthlyCost) + ' · день ' + this.dayNumber);

        this.processMonthlyEconomy();
      }

      this.date = new Date(this.startDate.getTime() + this.elapsedDays * 86400000);

      this.driftCurrencies();
      this.pushRatesHistory();

      /* поток зависит от числа филиалов */
      /* округляем накопитель, иначе 0,3 × 30 даёт 8,999… и клиент теряется */
      this.clientAcc = Math.round((this.clientAcc + this.clientsPerDay) * 10000) / 10000;
      while (this.clientAcc >= 1) {
        this.clientAcc -= 1;
        var client = this.spawnClient();
        if (client) {
          console.log('[clients] новый клиент: ' + client.name + ' · ' + this.typeLabel(client.type) +
                      ' · ' + formatMoney(client.amount) + ' · риск ' + client.risk + ' · день ' + client.day);
        }
      }

      this.checkCapital();
      this.save();
      return this.capital - before;
    },

    setSpeed: function (value) {
      this.speed = value;
      this.save();
    },

    setPaused: function (value) {
      this.paused = !!value;
      this.save();
    },

    togglePause: function () {
      this.paused = !this.paused;
      this.save();
      return this.paused;
    },

    /* ---------- Менеджеры ---------- */
    managerById: function (id) {
      for (var i = 0; i < this.managers.length; i += 1) {
        if (this.managers[i].id === id) return this.managers[i];
      }
      return this.managers[0] || null;
    },

    /* сколько игровых дней уходит на одного клиента */
    /* сколько клиентов менеджер разбирает за игровой день */
    managerClientsPerDay: function (manager) {
      var speed = this.skillValue(manager, 'speed');
      /* 10 → 0,56 · 50 → 1,2 · 100 → 2,0 клиента в день */
      return 0.4 + (Math.max(0, speed) / 100) * 1.6;
    },

    managerDaysPerClient: function (manager) {
      return 1 / this.managerClientsPerDay(manager);
    },

    /* шанс, что менеджер ошибочно одобрит рискового клиента */
    managerMistakeChance: function (manager) {
      var sum = this.skillValue(manager, 'analytics') + this.skillValue(manager, 'caution');
      /* порог 5% снят: сумма выше 190 продолжает снижать шанс ошибки */
      return Math.max(0, Math.min(0.6, (200 - sum) / 200));
    },

    /* кого менеджер берёт в работу: первый не-VIP из очереди */
    autopilotTarget: function (manager) {
      var mode = (manager && manager.workMode) || 'all';

      for (var i = 0; i < this.queue.length; i += 1) {
        var client = this.queue[i];
        if (mode === 'vip' && !client.isVip) continue;
        if (mode === 'regular' && client.isVip) continue;
        if (mode === 'all' && client.isVip) continue;
        return client;
      }
      return null;
    },

    /* автопилот: один шаг прогресса за игровой день */
    processAutopilot: function () {
      var self = this;
      var results = [];

      this.managers.forEach(function (manager) {
        if (!manager.autopilot) { manager.progress = 0; return; }

        var target = self.autopilotTarget(manager);
        if (!target) { manager.progress = 0; return; }

        /* скорость менеджера задаёт, сколько клиентов он успевает за день */
        manager.progress += self.managerClientsPerDay(manager);

        var guard = 0;
        while (manager.progress >= 1 && guard < 60) {
          manager.progress -= 1;
          guard += 1;

          var next = self.autopilotTarget(manager);
          if (!next) { manager.progress = 0; break; }

          var result = self.autopilotDecide(manager, next);
          if (result) {
            results.push(result);
            if (self.today.day === self.dayNumber) self.today.auto += 1;
          }
        }
      });

      if (results.length) this.save();
      return results;
    },

    autopilotDecide: function (manager, client) {
      var approve;

      if (client.type === 'deposit') {
        approve = true;                                   // вклады всегда в плюс
      } else if (this.liquidFunds() < client.amount) {
        approve = false;                                  // денег нет
      } else if (client.risk >= 4) {
        approve = false;                                  // рискованные не берём никогда
      } else {
        approve = true;
      }

      var result = approve ? this.approveClient(client.id) : this.declineClient(client.id);
      if (!result || !result.ok) return null;

      if (approve && client.type === 'loan') manager.loans = (manager.loans || 0) + 1;

      client.decidedBy = manager.name;
      client.decision = approve ? 'approved' : 'declined';

      this.log.push({
        day: this.dayNumber,
        type: approve ? 'auto' : 'auto-decline',
        text: (approve ? 'Одобрено: ' : 'Отказ: ') + manager.name + ' · ' + client.name
      });
      console.log('[autopilot] ' + manager.name + ' → ' + (approve ? 'одобрил ' : 'отклонил ') + client.name);
      return { manager: manager, client: client, approved: approve };
    },

    /* ---------- Клиенты ---------- */
    /* прибыль за последние 30 дней по истории капитала */
    profit30: function () {
      var h = this.capitalHistory || [];
      if (h.length < 2) return 0;
      var cutoff = this.dayNumber - 30;
      var past = h[0].capital;
      for (var i = 0; i < h.length; i += 1) {
        if (h[i].day <= cutoff) past = h[i].capital;
      }
      return this.capital - past;
    },

    spawnClient: function () {
      /* привлекательность наших условий: конкуренты переманивают клиентов */
      var adv = this.rateAdvantage();
      var depositShare = Math.max(0.15, Math.min(0.75, (0.34 + adv.deposit * 0.04) * ((this.bonuses && this.bonuses.depShareMult) || 1)));
      var loanShare = Math.max(0.15, Math.min(0.85, 0.66 + adv.loan * 0.04));
      var total = depositShare + loanShare;

      var type = Math.random() < (depositShare / total) ? 'deposit' : 'loan';

      var stolenBy = null;
      var rivals = this.activeCompetitors();
      for (var i = 0; i < rivals.length; i += 1) {
        var rival = rivals[i];
        var gap = type === 'deposit'
          ? rival.depositRate - this.playerDepositRate
          : this.playerLoanRate - rival.loanRate;

        /* конкурент выгоднее — часть клиентов уходит к нему */
        if (gap > 0 && Math.random() < Math.min(0.45, gap * 0.05)) {
          stolenBy = rival;
          break;
        }
      }

      if (stolenBy) {
        stolenBy.stolen += 1;
        console.log('[rivals] ' + stolenBy.name + ' переманил клиента · ' + this.typeLabel(type));
        return null;
      }

      var client = randomClient(this.dayNumber, type);

      var bonus = this.bonuses || {};

      if (bonus.riskDelta) {
        client.risk = Math.max(1, Math.min(5, client.risk + bonus.riskDelta));
      }

      if (bonus.loanAmountMult && bonus.loanAmountMult !== 1) {
        client.amount = Math.round((client.amount * bonus.loanAmountMult) / 1000) * 1000;
        client.amount = Math.max(20000, Math.min(8000000, client.amount));
      }

      if (bonus.loanTermDelta && client.type === 'loan') {
        client.term = Math.min(60, client.term + bonus.loanTermDelta);
      }

      /* VIP-банк: часть обычных клиентов приходит крупными */
      var limit = this.vipLimitFor(client.type);

      if (bonus.vipChanceBonus > 0 && client.amount < limit && Math.random() < bonus.vipChanceBonus) {
        client.amount = Math.round((limit + Math.random() * 2500000) / 1000) * 1000;
      }

      client.isVip = client.amount >= limit;

      this.activeClients.unshift(client);
      if (this.activeClients.length > this.maxClients) {
        this.activeClients.length = this.maxClients;
      }

      this.nextClientDay = this.dayNumber + 3 + Math.floor(Math.random() * 3);

      /* очередь переполнена — клиент уходит к конкурентам */
      if (this.queue.length >= this.queueLimit) {
        this.burned += 1;
        this.log.push({ day: this.dayNumber, type: 'burn', text: 'Очередь переполнена: ' + client.name + ' ушёл к конкурентам' });
        console.warn('[clients] очередь переполнена (' + this.queueLimit + ') — ' + client.name + ' ушёл к конкурентам');
        return null;
      }

      this.queue.push(client);
      return client;
    },

    findIndex: function (id) {
      for (var i = 0; i < this.queue.length; i += 1) {
        if (this.queue[i].id === id) return i;
      }
      return -1;
    },

    approveClient: function (id) {
      var index = this.findIndex(id);
      if (index < 0) return { ok: false, error: 'not-found' };

      var client = this.queue[index];

      /* достаточность капитала: портфель не может расти быстрее собственных средств */
      if (client.type === 'loan') {
        var cap = Math.max(0, this.capital) * 8;
        if (this.loansBody() + client.amount > cap) {
          return {
            ok: false,
            error: 'capital',
            client: client,
            need: Math.round(this.loansBody() + client.amount - cap),
            available: Math.round(cap)
          };
        }
      }

      /* кредит нельзя выдать, если свободных денег не хватает */
      if (client.type === 'loan' && this.liquidFunds() < client.amount) {
        console.warn('[state] отказ движка: нужно ' + formatMoney(client.amount) +
                     ', свободно ' + formatMoney(this.liquidFunds()));
        return {
          ok: false,
          error: 'insufficient',
          client: client,
          need: client.amount,
          available: this.liquidFunds()
        };
      }

      this.queue.splice(index, 1);

      if (client.type === 'loan') {
        /* деньги уходят в актив, капитал не меняется */
        this.activeLoans.push({
          id: client.id, name: client.name, amount: client.amount,
          rate: client.rate, monthsLeft: client.term, risk: client.risk,
          openedDay: this.dayNumber
        });
        this.stats.loansIssued += 1;
        this.totalLoansIssued += 1;
        this.checkAchievements();
        this.log.push({ day: this.dayNumber, type: 'loan', text: 'Выдан кредит · ' + client.name + ' · ' + formatMoney(client.amount) });
        console.log('[state] одобрен кредит · ' + client.name + ' · −' + formatMoney(client.amount));
      } else {
        /* привлечённые деньги — обязательство, капитал не растёт */
        this.activeDeposits.push({
          id: client.id, name: client.name, amount: client.amount,
          rate: client.rate, monthsLeft: client.term, risk: client.risk,
          openedDay: this.dayNumber
        });
        this.totalDepositsTaken += 1;
        this.log.push({ day: this.dayNumber, type: 'deposit', text: 'Принят вклад · ' + client.name + ' · ' + formatMoney(client.amount) });
        console.log('[state] принят вклад · ' + client.name + ' · +' + formatMoney(client.amount));
      }

      if (this.today.day === this.dayNumber) this.today.approved += 1;

      this.checkCapital();
      this.save();
      return { ok: true, client: client };
    },

    declineClient: function (id) {
      var index = this.findIndex(id);
      if (index < 0) return { ok: false, error: 'not-found' };

      var client = this.queue.splice(index, 1)[0];
      this.log.push({ day: this.dayNumber, type: 'decline', text: 'Отказ · ' + client.name });
      console.log('[state] отказ · ' + client.name);
      this.save();
      return { ok: true, client: client };
    },

    /* ---------- Сохранение ---------- */
    save: function () {
      if (this.noSave) return;
      this.normalizeLog();
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          v: SAVE_VERSION,
          capital: this.capital,
          t: this.date.getTime(),
          dayNumber: this.dayNumber,
          elapsedDays: this.elapsedDays,
          speed: this.speed,
          paused: this.paused,
          flow: this.activeClients.slice(0, this.maxClients),
          queue: this.queue.slice(0, this.queueLimit),
          burned: this.burned,
          reserved: this.reserved,
          managers: this.managers,
          branches: this.branches,
          queueLimit: this.queueLimit,
          clientsPerDay: this.clientsPerDay,
          flowBonus: this.flowBonus,
          clientAcc: this.clientAcc,
          candidates: this.candidates,
          managerSeq: NEW_MANAGER_SEQ,
          candidateSeq: NEW_CANDIDATE_SEQ,
          loans: this.activeLoans,
          deposits: this.activeDeposits,
          reputation: this.reputation,
          startCapital: this.startCapital,
          bankName: this.bankName,
          founderName: this.founderName,
          logoColor: this.logoColor,
          logoType: this.logoType,
          logoLetter: this.logoLetter,
          logoIcon: this.logoIcon,
          specialization: this.specialization,
          motivation: this.motivation,
          difficulty: this.difficulty,
          totalLoansIssued: this.totalLoansIssued,
          totalDepositsTaken: this.totalDepositsTaken,
          bonuses: this.bonuses,
          negotiation: this.negotiation,
          defaultsThisMonth: this.defaultsThisMonth,
          prevCapital: this.prevCapital,
          vipThreshold: this.vipThreshold,
          vipThresholdLoan: this.vipThresholdLoan,
          vipThresholdDeposit: this.vipThresholdDeposit,
          clientFilter: this.clientFilter,
          log: this.log.slice(-200),
          ratesLog: this.ratesLog,
          fxSpread: this.fxSpread,
          currencies: this.currencies,
          investments: this.investments,
          bankStage: this.bankStage,
          achievements: this.achievements,
          stats: this.stats,
          securityLevel: this.securityLevel,
          incidents: this.incidents,
          activeManagerId: this.activeManagerId,
          notifySeq: NOTIFY_SEQ,
          capitalHistory: this.capitalHistory,
          today: this.today,
          playerLoanRate: this.playerLoanRate,
          playerDepositRate: this.playerDepositRate,
          competitors: this.competitors,
          nextInspectionDay: this.nextInspectionDay,
          inspection: this.inspection,
          inspecting: this.inspecting,
          bankrupt: this.bankrupt,
          lowWarned: this.lowWarned
        }));
      } catch (e) { /* приватный режим — живём без сохранения */ }
    },

    load: function () {
      try {
        var raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;

        var data = JSON.parse(raw);
        if (!data || data.v !== SAVE_VERSION) return false;

        /* сейв неплатёжеспособного банка — тупик: начинаем заново */
        if (data.bankrupt || Number(data.capital) < 0) {
          localStorage.removeItem(SAVE_KEY);
          this.notice = 'Сохранение с отрицательным капиталом сброшено — старт заново';
          console.warn('[state] сейв с отрицательным капиталом удалён');
          return false;
        }

        this.capital = Number(data.capital) || this.capital;
        this.dayNumber = Number(data.dayNumber) || this.dayNumber;
        this.elapsedDays = Number(data.elapsedDays) || 0;
        this.date = new Date(Number(data.t) || this.startDate.getTime());

        var speed = Number(data.speed);
        this.speed = [1, 2, 5, 10, 20, 50].indexOf(speed) >= 0 ? speed : 1;
        this.paused = !!data.paused;

        if (Array.isArray(data.flow) && data.flow.length) {
          this.activeClients = data.flow.slice(0, this.maxClients);
        }
        if (Array.isArray(data.queue)) {
          this.queue = data.queue.slice(0, this.queueLimit);
        }
        this.burned = Number(data.burned) || 0;
        this.reserved = Number(data.reserved) || 0;
        if (Array.isArray(data.managers) && data.managers.length) {
          this.managers = data.managers;
          /* старые сейвы без потенциала — выдаём средний */
          this.managers.forEach(function (m) {
            if (!m.potentialMax) {
              m.potential = m.potential || 'medium';
              m.potentialMax = 75;
            }
            if (!m.workMode) m.workMode = 'all';

            /* баффы — единственный источник бонуса: всегда пересчитываем из истории.
               Так старые сейвы, где баффы выпадали до разделения base/buffBonus,
               тоже показывают реальные цифры. */
            if (!Array.isArray(m.buffs)) m.buffs = [];
            var bonus = { analytics: 0, speed: 0, caution: 0 };
            m.buffs.forEach(function (b) {
              var a = (b && b.apply) || {};
              if (a.analytics) bonus.analytics += a.analytics;
              if (a.speed) bonus.speed += a.speed;
              if (a.caution) bonus.caution += a.caution;
            });
            m.buffBonus = bonus;
          });
        }
        if (Number(data.branches)) this.branches = Number(data.branches);
        this.recalcQueue();   // лимит очереди считается от этапа и филиалов
        if (typeof data.flowBonus === 'number') this.flowBonus = data.flowBonus;
        this.recalcFlow();
        if (typeof data.clientAcc === 'number') this.clientAcc = data.clientAcc;
        if (Array.isArray(data.candidates)) this.candidates = data.candidates;
        NEW_MANAGER_SEQ = Number(data.managerSeq) || this.managers.length;
        NEW_CANDIDATE_SEQ = Number(data.candidateSeq) || 0;
        if (Array.isArray(data.loans)) this.activeLoans = data.loans;
        if (Array.isArray(data.deposits)) this.activeDeposits = data.deposits;
        if (typeof data.reputation === 'number') this.reputation = data.reputation;
        if (Array.isArray(data.capitalHistory)) this.capitalHistory = data.capitalHistory.slice(-90);
        if (data.today && typeof data.today === 'object') this.today = data.today;

        if (typeof data.activeManagerId === 'string') this.activeManagerId = data.activeManagerId;
        if (Number(data.notifySeq)) NOTIFY_SEQ = Math.max(NOTIFY_SEQ, Number(data.notifySeq));

        /* страховка для старых сейвов: поднимаем счётчик выше всех id в логе */
        if (Array.isArray(this.log)) {
          this.log.forEach(function (entry) {
            var m = entry && typeof entry.id === 'string' && /^n(\d+)$/.exec(entry.id);
            if (m) NOTIFY_SEQ = Math.max(NOTIFY_SEQ, Number(m[1]));
          });
        }
        if (typeof data.playerLoanRate === 'number') this.playerLoanRate = data.playerLoanRate;
        if (typeof data.playerDepositRate === 'number') this.playerDepositRate = data.playerDepositRate;
        if (Array.isArray(data.competitors) && data.competitors.length) this.competitors = data.competitors;
        if (typeof data.startCapital === 'number') this.startCapital = data.startCapital;
        if (typeof data.bankName === 'string') this.bankName = data.bankName;
        if (typeof data.founderName === 'string') this.founderName = data.founderName;
        if (typeof data.logoColor === 'string') this.logoColor = data.logoColor;
        if (typeof data.logoType === 'string') this.logoType = data.logoType === 'icon' ? 'icon' : 'letter';
        if (typeof data.logoLetter === 'string' && data.logoLetter) this.logoLetter = data.logoLetter;
        if (typeof data.logoIcon === 'string' && LOGO_ICONS[data.logoIcon]) this.logoIcon = data.logoIcon;
        if (typeof data.specialization === 'string') this.specialization = data.specialization;
        if (typeof data.motivation === 'string') this.motivation = data.motivation;
        if (typeof data.difficulty === 'string') this.difficulty = data.difficulty;
        if (typeof data.totalLoansIssued === 'number') this.totalLoansIssued = data.totalLoansIssued;
        if (typeof data.totalDepositsTaken === 'number') this.totalDepositsTaken = data.totalDepositsTaken;
        if (data.bonuses) this.bonuses = data.bonuses;

        /* поток зависит от перков — пересчитываем уже после их загрузки */
        this.recalcFlow();
        if (data.negotiation) this.negotiation = data.negotiation;
        if (typeof data.defaultsThisMonth === 'number') this.defaultsThisMonth = data.defaultsThisMonth;
        if (typeof data.prevCapital === 'number') this.prevCapital = data.prevCapital;
        if (Number(data.vipThreshold)) this.vipThreshold = Number(data.vipThreshold);
        if (Number(data.vipThresholdLoan)) this.vipThresholdLoan = Number(data.vipThresholdLoan);
        else if (Number(data.vipThreshold)) this.vipThresholdLoan = Number(data.vipThreshold);
        if (Number(data.vipThresholdDeposit)) this.vipThresholdDeposit = Number(data.vipThresholdDeposit);
        else if (Number(data.vipThreshold)) this.vipThresholdDeposit = Number(data.vipThreshold);
        if (typeof data.clientFilter === 'string') this.clientFilter = data.clientFilter;

        if (Array.isArray(data.log)) this.log = data.log;
        if (Array.isArray(data.ratesLog)) this.ratesLog = data.ratesLog;
        if (typeof data.fxSpread === 'number') this.fxSpread = data.fxSpread;
        if (data.currencies) this.currencies = data.currencies;
        if (data.investments) this.investments = data.investments;
        if (Number(data.bankStage)) this.bankStage = Number(data.bankStage);
        if (data.achievements) this.achievements = data.achievements;
        if (data.stats) this.stats = data.stats;
        if (typeof data.securityLevel === 'number') this.securityLevel = data.securityLevel;
        if (Array.isArray(data.incidents)) this.incidents = data.incidents;
        if (Number(data.nextInspectionDay)) this.nextInspectionDay = Number(data.nextInspectionDay);
        if (data.inspection) this.inspection = data.inspection;
        this.inspecting = !!data.inspecting;
        this.bankrupt = !!data.bankrupt;
        this.lowWarned = !!data.lowWarned;

        var all = this.activeClients.concat(this.queue);
        clientSeq = all.reduce(function (max, c) {
          return Math.max(max, Number(String(c.id).replace('c', '')) || 0);
        }, 0);

        this.nextClientDay = this.dayNumber + 3;
        return true;
      } catch (e) {
        return false;
      }
    },

    reset: function () {
      this.noSave = true;   // beforeunload не должен вернуть стёртый сейв
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    }
  };

  /* ---------- Стартовый набор ---------- */
  GameState.activeClients = [
    makeClient(41, 'ИП Орлов А. В.', 'loan', 1000000, 24, 18.4, 3),
    makeClient(41, 'Смирнова Е. К.', 'deposit', 120000, 12, 12.1, 1),
    makeClient(41, 'ООО «Вектор»', 'loan', 14200000, 36, 16.8, 4),
    makeClient(41, 'Ким А. С.', 'loan', 240000, 12, 21.0, 2),
    makeClient(41, 'Данилов Р. Р.', 'deposit', 2800000, 6, 11.8, 1)
  ];
  GameState.queue = GameState.activeClients.slice();

  GameState.log = [
    { day: 41, type: 'info', text: 'Филиал «Тверской» открыт · 4 менеджера' },
    { day: 41, type: 'info', text: 'Ключевая ставка ЦБ — 7,50%' },
    { day: 41, type: 'info', text: 'Цель: капитал 1 млрд ₽ и все конкуренты' }
  ];

  GameState.load();

  global.GameState = GameState;
  global.formatMoney = formatMoney;
  global.formatMoneyParts = formatMoneyParts;
})(window);
