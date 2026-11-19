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
      isVip: amount >= 3000000,
      manager: MANAGERS[Math.floor(Math.random() * MANAGERS.length)]
    };
  }

  function randomClient(day, forcedType) {
    var name = CLIENT_NAMES[Math.floor(Math.random() * CLIENT_NAMES.length)];
    var type = forcedType || (Math.random() < 0.66 ? 'loan' : 'deposit');
    var amount = Math.round((50000 + Math.random() * 4950000) / 1000) * 1000;
    var client = makeClient(day, name, type, amount);

    /* ставка клиента — вокруг базовой ставки игрока */
    var base = type === 'loan' ? GameState.playerLoanRate : GameState.playerDepositRate;
    var spread = type === 'loan' ? 3 : 1.5;
    client.rate = round2(base + (Math.random() - 0.5) * 2 * spread);

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

    /* ---------- Регулятор ---------- */
    /* упрощённые нормативы: одни и те же цифры на дашборде и в проверке */
    computeRatios: function () {
      var loansTotal = this.activeLoans.reduce(function (sum, l) { return sum + l.amount; }, 0);
      var depositsTotal = this.activeDeposits.reduce(function (sum, d) { return sum + d.amount; }, 0);

      return {
        loansTotal: loansTotal,
        depositsTotal: depositsTotal,
        h1: loansTotal > 0 ? ((this.capital + this.reserved) / loansTotal) * 100 : 999,
        h2: depositsTotal > 0 ? (this.liquidFunds() / depositsTotal) * 100 : 999,
        h3: depositsTotal > 0 ? (this.capital / depositsTotal) * 100 : 999
      };
    },

    startInspection: function () {
      var ratios = this.computeRatios();
      var loansTotal = ratios.loansTotal;
      var depositsTotal = ratios.depositsTotal;
      var h1 = ratios.h1;
      var h2 = ratios.h2;
      var h3 = ratios.h3;

      var rows = [
        { label: 'Н1 · достаточность капитала', fact: h1, min: 8, fine: 450000, ok: h1 >= 8 },
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

      var fine = rows.reduce(function (sum, r) { return sum + (r.ok ? 0 : r.fine); }, 0);

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
      this.nextInspectionDay = this.dayNumber + 180;
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
    ratePerDay: 0.001,
    salary: 200000,
    salaryEveryDays: 30,

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
    playerLoanRate: 18,
    playerDepositRate: 10,

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
        var drift = (Math.random() - 0.5) * 0.01;          // ±0,5% в день
        c.rate = Math.max(1, Math.round(c.rate * (1 + drift) * 10000) / 10000);
      });
    },

    fxPrice: function (code, side) {
      var rate = this.currencies[code].rate;
      var spread = this.fxSpread / 100;
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

      this.capital -= rub;
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
      this.capital += rub;

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
    takeCBLoan: function (amount) {
      amount = Math.round(amount);
      if (!(amount > 0)) return { ok: false, error: 'amount' };

      this.capital += amount;
      this.investments.cbLoan += amount;

      this.log.push({
        day: this.dayNumber,
        type: 'treasury',
        text: 'Взят кредит ЦБ ' + formatMoney(amount) + ' под 25% · долг ' + formatMoney(this.investments.cbLoan)
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
      this.capital -= amount;
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
      this.capital += amount;

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
      this.capital -= amount;

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
      this.capital -= amount;
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
    stageName: function () {
      return this.stageNames[this.bankStage - 1] || 'Ларёк';
    },

    nextStage: function () {
      return this.stageUpgrades[this.bankStage] || null;
    },

    canUpgradeStage: function () {
      var next = this.nextStage();
      if (!next) return { ok: false, reason: 'max' };
      if (this.capital < next.capital) {
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

    /* ---------- Развитие персонала ---------- */
    trainCost: 100000,

    promoteCost: function (manager) {
      return Math.round(manager.salary * 2 / 1000) * 1000;
    },

    trainManager: function (id) {
      var m = this.managerById(id);
      if (!m) return { ok: false, error: 'not-found' };
      if (m.level >= 100) return { ok: false, error: 'max' };
      if (this.capital < this.trainCost) {
        return { ok: false, error: 'money', need: this.trainCost, available: this.capital };
      }

      this.capital -= this.trainCost;
      m.level = Math.min(100, m.level + 1);
      m.skills.analytics = Math.min(100, m.skills.analytics + 2);
      m.skills.speed = Math.min(100, m.skills.speed + 2);
      m.skills.caution = Math.min(100, m.skills.caution + 2);
      m.loyalty = Math.min(100, m.loyalty + 5);
      m.promotedDay = this.dayNumber;

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
      if (m.level >= 100) return { ok: false, error: 'max' };

      var cost = this.promoteCost(m);
      if (this.capital < cost) {
        return { ok: false, error: 'money', need: cost, available: this.capital };
      }

      var levels = m.level < 50 ? 10 : 5;
      var loyaltyGain = 15 + Math.floor(Math.random() * 6);   // 15–20
      var bump = function (value) { return Math.min(100, value + 3 + Math.floor(Math.random() * 3)); };

      this.capital -= cost;
      m.level = Math.min(100, m.level + levels);
      m.skills.analytics = bump(m.skills.analytics);
      m.skills.speed = bump(m.skills.speed);
      m.skills.caution = bump(m.skills.caution);
      m.salary = Math.round(m.salary * 1.15 / 1000) * 1000;
      m.loyalty = Math.min(100, m.loyalty + loyaltyGain);
      m.promotedDay = this.dayNumber;

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
      if (this.capital < cost) return { ok: false, error: 'money', need: cost, available: this.capital };

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

        var drop = 2 + Math.floor(Math.random() * 3);            // 2–4
        if (m.salary < self.managerMarketSalary(m)) drop += 1;   // низкая зарплата — ещё пункт

        m.loyalty = Math.max(0, m.loyalty - drop);

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
      var base = 0.25 + 2 * Math.max(0, this.branches - 1) + (this.flowBonus || 0);
      this.clientsPerDay = Math.round(base * 1.2 * 100) / 100;
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

    dayLabel: function () {
      return 'день ' + this.dayNumber;
    },

    liquidFunds: function () {
      return this.capital - this.reserved;
    },

    /* хватает ли свободных денег на заявку */
    canApprove: function (client) {
      if (!client) return false;
      if (client.type !== 'loan') return true;       // вклад приносит деньги
      return this.liquidFunds() >= client.amount;
    },

    /* пороги: < 10% от стартового — предупреждение, < 0 — крах */
    checkCapital: function () {
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
      var level = 5 + Math.floor(Math.random() * 86);
      var jitter = function (base) {
        return Math.max(5, Math.min(99, base + Math.round((Math.random() - 0.5) * 30)));
      };

      NEW_CANDIDATE_SEQ += 1;

      return {
        id: 'cand' + NEW_CANDIDATE_SEQ,
        name: CANDIDATE_NAMES[Math.floor(Math.random() * CANDIDATE_NAMES.length)],
        level: level,
        salary: Math.round((30000 + level * 2200) / 1000) * 1000,
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

      var cand = this.candidates[idx];
      var upfront = cand.salary;                 // первый месяц вперёд

      if (this.capital < upfront) {
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
        progress: 0
      };

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
      if (this.capital < price) {
        return { ok: false, error: 'money', need: price, available: this.capital };
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
        this.capital += comp.capital;
        this.queueLimit += 10;
        this.flowBonus = (this.flowBonus || 0) + 1;
        this.recalcFlow();
        this.log.push({
          day: this.dayNumber,
          type: 'stock',
          text: '🏦 «' + comp.name + '» стал дочерним: капитал ' + formatMoney(comp.capital) + ' перешёл вам'
        });
      }

      this.stats.sharesBought += percent;
      this.checkAchievements();

      console.log('[stocks] ' + comp.name + ' · доля ' + comp.playerShare + '% · −' + formatMoney(price));
      this.save();
      return { ok: true, competitor: comp, paid: price };
    },

    /* ---------- Филиалы ---------- */
    openBranch: function () {
      if (this.capital < this.branchCost) {
        return { ok: false, error: 'money', need: this.branchCost, available: this.capital };
      }

      this.capital -= this.branchCost;
      this.branches += 1;
      this.queueLimit += 10;
      this.recalcFlow();

      this.log.push({
        day: this.dayNumber,
        type: 'branch',
        text: 'Открыт филиал №' + this.branches + ' · ' + formatMoney(this.branchCost) + ' · очередь до ' + this.queueLimit
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

      /* ---- кредиты: наш доход ---- */
      this.activeLoans.forEach(function (loan) {
        var interest = loan.amount * (loan.rate / 100) / 12;
        self.capital += interest;
        income += interest;
        loan.monthsLeft -= 1;

        /* дефолт только по рисковым */
        if (loan.risk >= 4 && Math.random() < 0.15) {
          loan.closed = 'default';
          defaults += 1;
          self.log.push({
            day: self.dayNumber,
            type: 'default',
            text: '❌ ДЕФОЛТ: ' + loan.name + ' не вернул ' + formatMoney(loan.amount)
          });
          console.warn('[economy] дефолт · ' + loan.name + ' · ' + formatMoney(loan.amount));
          return;
        }

        if (loan.monthsLeft <= 0) {
          self.capital += loan.amount;
          loan.closed = 'paid';
          self.log.push({
            day: self.dayNumber,
            type: 'closed',
            text: '✅ Кредит закрыт: ' + loan.name + ' вернул ' + formatMoney(loan.amount)
          });
        }
      });
      this.activeLoans = this.activeLoans.filter(function (l) { return !l.closed; });

      /* ---- вклады: наш расход ---- */
      this.activeDeposits.forEach(function (dep) {
        var interest = dep.amount * (dep.rate / 100) / 12;
        self.capital -= interest;
        expense += interest;
        dep.monthsLeft -= 1;

        if (dep.monthsLeft <= 0) {
          self.capital -= dep.amount;
          dep.closed = 'returned';
          self.log.push({
            day: self.dayNumber,
            type: 'closed',
            text: '✅ Вклад закрыт: ' + dep.name + ' забрал ' + formatMoney(dep.amount)
          });
        }
      });
      this.activeDeposits = this.activeDeposits.filter(function (d) { return !d.closed; });

      this.lastMonth = {
        day: this.dayNumber,
        income: income,
        expense: expense,
        defaults: defaults,
        profit: income - expense
      };

      /* некомплект персонала: филиалов больше, чем менеджеров */
      var shortfall = this.branches - this.managers.length;
      if (shortfall > 0) {
        var loss = shortfall * 50000;
        this.capital -= loss;
        this.log.push({
          day: this.dayNumber,
          type: 'warn',
          text: '⚠ Некомплект персонала в филиале ' + (this.managers.length + 1) + ' · убыток ' + formatMoney(loss)
        });
        console.warn('[branch] некомплект · филиалов ' + this.branches + ', менеджеров ' + this.managers.length);
      }

      /* казначейство: проценты по долгам, купоны */
      var treasury = this.investments;
      var treasuryNet = 0;

      if (treasury.cbLoan > 0) {
        var cbInterest = treasury.cbLoan * 0.25 / 12;
        this.capital -= cbInterest;
        treasuryNet -= cbInterest;
        expense += cbInterest;
        this.log.push({
          day: this.dayNumber,
          type: 'treasury',
          text: 'Проценты ЦБ · −' + formatMoney(cbInterest) + ' · долг ' + formatMoney(treasury.cbLoan)
        });
      }

      if (treasury.mbkTaken.amount > 0) {
        var mbkIn = treasury.mbkTaken.amount * 0.15 / 12;
        this.capital -= mbkIn;
        treasuryNet -= mbkIn;
        expense += mbkIn;
        treasury.mbkTaken.monthsLeft -= 1;
        if (treasury.mbkTaken.monthsLeft <= 0) {
          this.capital -= treasury.mbkTaken.amount;
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
          this.capital += treasury.mbkGiven.amount;
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
        var coupon = bond.amount * (bond.rate / 100) / 12;
        selfT.capital += coupon;
        treasuryNet += coupon;
        income += coupon;
        bond.monthsLeft -= 1;

        if (bond.type === 'corp' && Math.random() < 0.04) {
          bond.defaulted = true;
          selfT.log.push({
            day: selfT.dayNumber,
            type: 'default',
            text: '❌ Дефолт эмитента · потеряно ' + formatMoney(bond.amount)
          });
          return;
        }

        if (bond.monthsLeft <= 0) {
          selfT.capital += bond.amount;
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

      var before = this.capital;
      this.capital = this.capital * (1 + this.ratePerDay);

      if (this.elapsedDays % this.salaryEveryDays === 0) {
        this.capital -= this.salary;
        this.log.push({ day: this.dayNumber, type: 'salary', text: 'Зарплата менеджеров −' + formatMoney(this.salary) });
        console.log('[state] зарплата · −' + formatMoney(this.salary) + ' · день ' + this.dayNumber);

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
    },

    togglePause: function () {
      this.paused = !this.paused;
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
    managerDaysPerClient: function (manager) {
      var speed = manager.skills.speed;
      var days = 3 - speed / 50;          // скорость 100 → 1 день, 1 → ~3 дня
      return Math.max(1, Math.min(3, days));
    },

    /* шанс, что менеджер ошибочно одобрит рискового клиента */
    managerMistakeChance: function (manager) {
      var sum = manager.skills.analytics + manager.skills.caution;
      return Math.max(0.05, Math.min(0.6, (200 - sum) / 200));
    },

    /* кого менеджер берёт в работу: первый не-VIP из очереди */
    autopilotTarget: function () {
      for (var i = 0; i < this.queue.length; i += 1) {
        if (!this.queue[i].isVip) return this.queue[i];
      }
      return null;
    },

    /* автопилот: один шаг прогресса за игровой день */
    processAutopilot: function () {
      var self = this;
      var results = [];

      this.managers.forEach(function (manager) {
        if (!manager.autopilot) { manager.progress = 0; return; }

        var target = self.autopilotTarget();
        if (!target) { manager.progress = 0; return; }

        manager.progress += 1 / self.managerDaysPerClient(manager);
        if (manager.progress < 1) return;

        manager.progress = 0;
        var result = self.autopilotDecide(manager, target);
        if (result) results.push(result);
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
        approve = Math.random() < this.managerMistakeChance(manager);  // риск: может ошибиться
      } else {
        approve = true;
      }

      var result = approve ? this.approveClient(client.id) : this.declineClient(client.id);
      if (!result || !result.ok) return null;

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
    spawnClient: function () {
      /* привлекательность наших условий: конкуренты переманивают клиентов */
      var adv = this.rateAdvantage();
      var depositShare = Math.max(0.15, Math.min(0.75, 0.34 + adv.deposit * 0.04));
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
        this.capital -= client.amount;
        this.activeLoans.push({
          id: client.id, name: client.name, amount: client.amount,
          rate: client.rate, monthsLeft: client.term, risk: client.risk,
          openedDay: this.dayNumber
        });
        this.stats.loansIssued += 1;
        this.checkAchievements();
        this.log.push({ day: this.dayNumber, type: 'loan', text: 'Выдан кредит · ' + client.name + ' · ' + formatMoney(client.amount) });
        console.log('[state] одобрен кредит · ' + client.name + ' · −' + formatMoney(client.amount));
      } else {
        this.capital += client.amount;
        this.activeDeposits.push({
          id: client.id, name: client.name, amount: client.amount,
          rate: client.rate, monthsLeft: client.term, risk: client.risk,
          openedDay: this.dayNumber
        });
        this.log.push({ day: this.dayNumber, type: 'deposit', text: 'Принят вклад · ' + client.name + ' · ' + formatMoney(client.amount) });
        console.log('[state] принят вклад · ' + client.name + ' · +' + formatMoney(client.amount));
      }

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
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          v: SAVE_VERSION,
          capital: this.capital,
          t: this.date.getTime(),
          dayNumber: this.dayNumber,
          elapsedDays: this.elapsedDays,
          speed: this.speed,
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
          ratesLog: this.ratesLog,
          fxSpread: this.fxSpread,
          currencies: this.currencies,
          investments: this.investments,
          bankStage: this.bankStage,
          achievements: this.achievements,
          stats: this.stats,
          securityLevel: this.securityLevel,
          incidents: this.incidents,
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
        }
        if (Number(data.branches)) this.branches = Number(data.branches);
        if (Number(data.queueLimit)) this.queueLimit = Number(data.queueLimit);
        if (typeof data.flowBonus === 'number') this.flowBonus = data.flowBonus;
        this.recalcFlow();
        if (typeof data.clientAcc === 'number') this.clientAcc = data.clientAcc;
        if (Array.isArray(data.candidates)) this.candidates = data.candidates;
        NEW_MANAGER_SEQ = Number(data.managerSeq) || this.managers.length;
        NEW_CANDIDATE_SEQ = Number(data.candidateSeq) || 0;
        if (Array.isArray(data.loans)) this.activeLoans = data.loans;
        if (Array.isArray(data.deposits)) this.activeDeposits = data.deposits;
        if (typeof data.reputation === 'number') this.reputation = data.reputation;
        if (typeof data.playerLoanRate === 'number') this.playerLoanRate = data.playerLoanRate;
        if (typeof data.playerDepositRate === 'number') this.playerDepositRate = data.playerDepositRate;
        if (Array.isArray(data.competitors) && data.competitors.length) this.competitors = data.competitors;
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
