(function () {
  'use strict';

  function parseResult(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (error) { return { ok: false, code: 'BAD_RESPONSE', message: String(raw) }; }
  }

  function NeonBilling(config) {
    this.config = config;
    this.ready = false;
    this.bridge = null;
    this.listeners = [];
    this.pending = {};
  }

  NeonBilling.prototype.initialize = function () {
    this.bridge = window.BymelBilling || window.bymelBilling || null;
    if (!this.bridge) {
      this.ready = false;
      return Promise.resolve({ ok: false, code: 'PLAY_BUILD_REQUIRED' });
    }
    var self = this;
    var products = this.config.products;
    window.onBymelBillingEvent = function (payload) { self.handleEvent(parseResult(payload)); };
    try {
      var result = parseResult(this.bridge.initialize(JSON.stringify(Object.keys(products).map(function (key) { return products[key]; }))));
      this.ready = !result || result.ok !== false;
      return Promise.resolve(result || { ok: true });
    } catch (error) {
      this.ready = false;
      return Promise.resolve({ ok: false, code: 'INIT_ERROR', message: error.message });
    }
  };

  NeonBilling.prototype.onEvent = function (listener) { this.listeners.push(listener); };
  NeonBilling.prototype.handleEvent = function (event) {
    if (!event) return;
    this.listeners.forEach(function (listener) { listener(event); });
    if (event.requestId && this.pending[event.requestId]) {
      var pending = this.pending[event.requestId];
      delete this.pending[event.requestId];
      if (event.ok) pending.resolve(event); else pending.reject(event);
    }
  };

  NeonBilling.prototype.purchase = function (productId) {
    if (!this.bridge || !this.ready) return Promise.reject({ ok: false, code: 'PLAY_BUILD_REQUIRED', message: 'Satın alma yalnızca Google Play test/yayın sürümünde kullanılabilir.' });
    var self = this;
    var requestId = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    return new Promise(function (resolve, reject) {
      self.pending[requestId] = { resolve: resolve, reject: reject };
      try {
        var immediate = parseResult(self.bridge.purchase(productId, requestId));
        if (immediate && immediate.ok === false) {
          delete self.pending[requestId]; reject(immediate);
        }
      } catch (error) {
        delete self.pending[requestId]; reject({ ok: false, code: 'BRIDGE_ERROR', message: error.message });
      }
      window.setTimeout(function () {
        if (self.pending[requestId]) {
          delete self.pending[requestId]; reject({ ok: false, code: 'TIMEOUT', message: 'Google Play yanıt vermedi.' });
        }
      }, 120000);
    });
  };

  NeonBilling.prototype.restore = function () {
    if (!this.bridge || !this.ready) return Promise.resolve({ ok: false, code: 'PLAY_BUILD_REQUIRED' });
    try { return Promise.resolve(parseResult(this.bridge.restorePurchases()) || { ok: true }); }
    catch (error) { return Promise.resolve({ ok: false, code: 'RESTORE_ERROR', message: error.message }); }
  };

  window.NeonBilling = NeonBilling;
}());
