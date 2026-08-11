(function () {
  'use strict';

  function parseResult(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (error) { return { ok: false, code: 'BAD_RESPONSE', message: String(raw) }; }
  }

  function NeonAds() {
    this.bridge = null;
    this.ready = false;
    this.pending = {};
    this.state = { interstitialReady: false, rewardedReady: false };
  }

  NeonAds.prototype.initialize = function () {
    this.bridge = window.BymelAds || null;
    if (!this.bridge) {
      this.ready = false;
      return Promise.resolve({ ok: false, code: 'PLAY_BUILD_REQUIRED' });
    }
    var self = this;
    window.onBymelAdEvent = function (payload) { self.handleEvent(parseResult(payload)); };
    try {
      var result = parseResult(this.bridge.initialize());
      this.ready = !result || result.ok !== false;
      this.refreshState();
      return Promise.resolve(result || { ok: true });
    } catch (error) {
      this.ready = false;
      return Promise.resolve({ ok: false, code: 'INIT_ERROR', message: error.message });
    }
  };

  NeonAds.prototype.refreshState = function () {
    if (!this.bridge || typeof this.bridge.status !== 'function') return this.state;
    var status = parseResult(this.bridge.status());
    if (status) {
      this.state.interstitialReady = !!status.interstitialReady;
      this.state.rewardedReady = !!status.rewardedReady;
    }
    return this.state;
  };

  NeonAds.prototype.handleEvent = function (event) {
    if (!event) return;
    if (event.code === 'INTERSTITIAL_READY') this.state.interstitialReady = true;
    if (event.code === 'REWARDED_READY') this.state.rewardedReady = true;
    if (event.code === 'INTERSTITIAL_LOAD_FAILED') this.state.interstitialReady = false;
    if (event.code === 'REWARDED_LOAD_FAILED') this.state.rewardedReady = false;
    if (event.type === 'reward' || event.code === 'AD_CLOSED') this.refreshState();
    if (this.onStateChange) this.onStateChange(this.state);

    if (!event.requestId || !this.pending[event.requestId]) return;
    var pending = this.pending[event.requestId];
    delete this.pending[event.requestId];
    window.clearTimeout(pending.timer);
    if (event.ok) pending.resolve(event); else pending.reject(event);
  };

  NeonAds.prototype.track = function (requestId, resolve, reject, timeoutMs) {
    var self = this;
    this.pending[requestId] = {
      resolve: resolve,
      reject: reject,
      timer: window.setTimeout(function () {
        if (!self.pending[requestId]) return;
        delete self.pending[requestId];
        reject({ ok: false, code: 'TIMEOUT', message: 'Reklam yanıt vermedi.' });
      }, timeoutMs)
    };
  };

  /**
   * Bölüm sonu / ölüm reklamı. Reklam gösterilemezse de promise reject edilir;
   * çağıran taraf her iki durumda da oyun akışını sürdürmelidir.
   */
  NeonAds.prototype.showGameOverAd = function () {
    if (!this.bridge || !this.ready) return Promise.reject({ ok: false, code: 'PLAY_BUILD_REQUIRED' });
    var self = this;
    var requestId = 'a_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    return new Promise(function (resolve, reject) {
      self.track(requestId, resolve, reject, 90000);
      try {
        var immediate = parseResult(self.bridge.showGameOverAd(requestId));
        if (immediate && immediate.ok === false) {
          window.clearTimeout(self.pending[requestId].timer);
          delete self.pending[requestId];
          reject(immediate);
        }
      } catch (error) {
        window.clearTimeout(self.pending[requestId].timer);
        delete self.pending[requestId];
        reject({ ok: false, code: 'BRIDGE_ERROR', message: error.message });
      }
    });
  };

  /** Mağazadaki ödüllü reklam. Yalnızca kullanıcı reklamı tamamlarsa resolve olur. */
  NeonAds.prototype.showRewardedAd = function () {
    if (!this.bridge || !this.ready) return Promise.reject({ ok: false, code: 'PLAY_BUILD_REQUIRED' });
    var self = this;
    var requestId = 'r_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    return new Promise(function (resolve, reject) {
      self.track(requestId, resolve, reject, 300000);
      try {
        var immediate = parseResult(self.bridge.showRewardedAd(requestId));
        if (immediate && immediate.ok === false) {
          window.clearTimeout(self.pending[requestId].timer);
          delete self.pending[requestId];
          reject(immediate);
        }
      } catch (error) {
        window.clearTimeout(self.pending[requestId].timer);
        delete self.pending[requestId];
        reject({ ok: false, code: 'BRIDGE_ERROR', message: error.message });
      }
    });
  };

  window.NeonAds = NeonAds;
}());
