/* HerbHub data store — localStorage-backed persistence layer.
 * All data lives under a single key as JSON. No server required. */
(function (global) {
  "use strict";

  var KEY = "herbhub.data.v1";

  var DEFAULT_DATA = {
    settings: { clinicName: "HerbHub", currency: "$", nextIds: {} },
    patients: [],
    remedies: [],
    visits: []
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT_DATA);
      var data = JSON.parse(raw);
      // Ensure shape (forward-compatible defaults)
      data.settings = Object.assign({}, DEFAULT_DATA.settings, data.settings || {});
      data.settings.nextIds = data.settings.nextIds || {};
      data.patients = data.patients || [];
      data.remedies = data.remedies || [];
      data.visits = data.visits || [];
      return data;
    } catch (e) {
      console.error("HerbHub: failed to load data", e);
      return clone(DEFAULT_DATA);
    }
  }

  var _data = load();

  function persist() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(_data));
    } catch (e) {
      console.error("HerbHub: failed to save data", e);
      alert("Could not save data — your browser storage may be full or disabled.");
    }
  }

  function genId(kind) {
    var n = (_data.settings.nextIds[kind] || 0) + 1;
    _data.settings.nextIds[kind] = n;
    return kind.charAt(0) + n + "-" + Math.random().toString(36).slice(2, 7);
  }

  function nowISO() { return new Date().toISOString(); }

  var Store = {
    /* ---- raw access ---- */
    all: function () { return _data; },
    settings: function () { return _data.settings; },

    saveSettings: function (partial) {
      _data.settings = Object.assign({}, _data.settings, partial);
      persist();
      return _data.settings;
    },

    /* ---- patients ---- */
    patients: function () { return _data.patients.slice(); },
    getPatient: function (id) { return _data.patients.find(function (p) { return p.id === id; }) || null; },
    addPatient: function (p) {
      var rec = Object.assign({ id: genId("p"), createdAt: nowISO() }, p);
      _data.patients.push(rec);
      persist();
      return rec;
    },
    updatePatient: function (id, patch) {
      var p = this.getPatient(id);
      if (!p) return null;
      Object.assign(p, patch);
      persist();
      return p;
    },
    deletePatient: function (id) {
      _data.patients = _data.patients.filter(function (p) { return p.id !== id; });
      _data.visits = _data.visits.filter(function (v) { return v.patientId !== id; });
      persist();
    },

    /* ---- remedies ---- */
    remedies: function () { return _data.remedies.slice(); },
    getRemedy: function (id) { return _data.remedies.find(function (r) { return r.id === id; }) || null; },
    addRemedy: function (r) {
      var rec = Object.assign({ id: genId("r"), createdAt: nowISO() }, r);
      _data.remedies.push(rec);
      persist();
      return rec;
    },
    updateRemedy: function (id, patch) {
      var r = this.getRemedy(id);
      if (!r) return null;
      Object.assign(r, patch);
      persist();
      return r;
    },
    deleteRemedy: function (id) {
      _data.remedies = _data.remedies.filter(function (r) { return r.id !== id; });
      persist();
    },

    /* ---- visits ---- */
    visits: function () { return _data.visits.slice(); },
    getVisit: function (id) { return _data.visits.find(function (v) { return v.id === id; }) || null; },
    visitsForPatient: function (patientId) {
      return _data.visits.filter(function (v) { return v.patientId === patientId; });
    },
    addVisit: function (v) {
      var rec = Object.assign({ id: genId("v"), createdAt: nowISO() }, v);
      _data.visits.push(rec);
      persist();
      return rec;
    },
    updateVisit: function (id, patch) {
      var v = this.getVisit(id);
      if (!v) return null;
      Object.assign(v, patch);
      persist();
      return v;
    },
    deleteVisit: function (id) {
      _data.visits = _data.visits.filter(function (v) { return v.id !== id; });
      persist();
    },

    /* ---- backup / restore ---- */
    exportJSON: function () { return JSON.stringify(_data, null, 2); },
    importJSON: function (json) {
      var incoming = JSON.parse(json);
      if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.patients)) {
        throw new Error("This file does not look like a HerbHub backup.");
      }
      incoming.settings = Object.assign({}, DEFAULT_DATA.settings, incoming.settings || {});
      incoming.settings.nextIds = incoming.settings.nextIds || {};
      incoming.patients = incoming.patients || [];
      incoming.remedies = incoming.remedies || [];
      incoming.visits = incoming.visits || [];
      _data = incoming;
      persist();
      return _data;
    },
    reset: function () { _data = clone(DEFAULT_DATA); persist(); }
  };

  /* ---- derived calculations ---- */
  var Calc = {
    visitCharge: function (visit) {
      return (visit.items || []).reduce(function (s, it) { return s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0); }, 0);
    },
    visitCost: function (visit) {
      return (visit.items || []).reduce(function (s, it) { return s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0); }, 0);
    },
    visitProfit: function (visit) { return Calc.visitCharge(visit) - Calc.visitCost(visit); },
    visitPaid: function (visit) { return Number(visit.amountPaid) || 0; },
    visitBalance: function (visit) { return Math.max(0, Calc.visitCharge(visit) - Calc.visitPaid(visit)); },
    visitStatus: function (visit) {
      var charge = Calc.visitCharge(visit), paid = Calc.visitPaid(visit);
      if (charge <= 0) return "paid";
      if (paid >= charge) return "paid";
      if (paid <= 0) return "unpaid";
      return "partial";
    },
    totals: function (visits) {
      var t = { charge: 0, cost: 0, profit: 0, paid: 0, balance: 0, count: visits.length };
      visits.forEach(function (v) {
        t.charge += Calc.visitCharge(v);
        t.cost += Calc.visitCost(v);
        t.paid += Calc.visitPaid(v);
        t.balance += Calc.visitBalance(v);
      });
      t.profit = t.charge - t.cost;
      return t;
    }
  };

  Store.Calc = Calc;
  global.Store = Store;
})(window);
