(function () {
  'use strict';

  function NeonAudio() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = 0;
    this.step = 0;
    this.settings = { music: true, sfx: true };
  }

  NeonAudio.prototype.unlock = function () {
    if (!this.ctx) {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.master.gain.value = 0.78;
      this.musicGain.gain.value = this.settings.music ? 0.18 : 0;
      this.sfxGain.gain.value = this.settings.sfx ? 0.58 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  };

  NeonAudio.prototype.setSettings = function (settings) {
    this.settings = Object.assign(this.settings, settings || {});
    if (!this.ctx) return;
    var now = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.music ? 0.18 : 0, now, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx ? 0.58 : 0, now, 0.04);
  };

  NeonAudio.prototype.tone = function (frequency, duration, type, volume, slide, delay) {
    if (!this.ctx || !this.settings.sfx) return;
    var start = this.ctx.currentTime + (delay || 0);
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(Math.max(30, frequency), start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), start + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume || 0.1), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(start); osc.stop(start + duration + 0.02);
  };

  NeonAudio.prototype.noise = function (duration, volume) {
    if (!this.ctx || !this.settings.sfx) return;
    var size = Math.floor(this.ctx.sampleRate * duration);
    var buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    var source = this.ctx.createBufferSource();
    var gain = this.ctx.createGain();
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 480;
    gain.gain.value = volume || 0.08;
    source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain); source.start();
  };

  NeonAudio.prototype.play = function (name) {
    this.unlock();
    if (!this.ctx) return;
    if (name === 'shoot') { this.tone(520, 0.055, 'square', 0.028, 210); }
    else if (name === 'hit') { this.tone(150, 0.09, 'sawtooth', 0.055, -80); }
    else if (name === 'hurt') { this.noise(0.12, 0.1); this.tone(110, 0.18, 'square', 0.07, -50); }
    else if (name === 'coin') { this.tone(880, 0.07, 'sine', 0.05, 420); }
    else if (name === 'xp') { this.tone(630, 0.045, 'triangle', 0.025, 180); }
    else if (name === 'dash') { this.noise(0.16, 0.08); this.tone(180, 0.14, 'sawtooth', 0.06, 520); }
    else if (name === 'nova') { this.tone(90, 0.5, 'sine', 0.12, 820); this.tone(180, 0.42, 'triangle', 0.06, 980, 0.03); }
    else if (name === 'level') { this.tone(440, 0.13, 'sine', 0.06, 220); this.tone(660, 0.18, 'sine', 0.06, 330, 0.11); }
    else if (name === 'boss') { this.tone(58, 0.7, 'sawtooth', 0.12, -18); this.noise(0.5, 0.05); }
    else if (name === 'death') { this.tone(260, 0.7, 'sawtooth', 0.1, -220); }
    else if (name === 'ui') { this.tone(460, 0.06, 'triangle', 0.035, 100); }
    else if (name === 'buy') { this.tone(520, 0.1, 'sine', 0.05, 180); this.tone(760, 0.15, 'sine', 0.05, 320, 0.08); }
  };

  NeonAudio.prototype.startMusic = function () {
    this.unlock();
    if (!this.ctx || this.musicTimer) return;
    var self = this;
    var notes = [110, 146.83, 164.81, 220, 164.81, 146.83, 123.47, 164.81];
    function tick() {
      if (!self.ctx || !self.settings.music) return;
      var now = self.ctx.currentTime;
      var osc = self.ctx.createOscillator();
      var gain = self.ctx.createGain();
      var filter = self.ctx.createBiquadFilter();
      osc.type = self.step % 4 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = notes[self.step % notes.length];
      filter.type = 'lowpass'; filter.frequency.value = 520 + (self.step % 4) * 120;
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(filter); filter.connect(gain); gain.connect(self.musicGain);
      osc.start(now); osc.stop(now + 0.26);
      if (self.step % 4 === 0) {
        var bass = self.ctx.createOscillator(); var bassGain = self.ctx.createGain();
        bass.type = 'sine'; bass.frequency.value = notes[self.step % notes.length] / 2;
        bassGain.gain.setValueAtTime(0.07, now); bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        bass.connect(bassGain); bassGain.connect(self.musicGain); bass.start(now); bass.stop(now + 0.4);
      }
      self.step += 1;
    }
    tick();
    this.musicTimer = window.setInterval(tick, 250);
  };

  NeonAudio.prototype.stopMusic = function () {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
  };

  window.NeonAudio = NeonAudio;
}());
