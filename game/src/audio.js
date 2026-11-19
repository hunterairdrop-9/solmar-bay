// Synthesized sound: no audio files, everything is WebAudio oscillators and
// noise. Engine hum, sirens, gunshots, pickups, and a looping bassline radio.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.radio = 0;
    this.engineOsc = null;
    this.engineGain = null;
  }
  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }
  resume() { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.35; return this.muted; }
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }
  noise(dur, vol = 0.25, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  shoot() { this.noise(0.12, 0.4, 3000); this.tone(160, 0.08, 'square', 0.12, 60); }
  punch() { this.noise(0.08, 0.3, 800); }
  pickup() { this.tone(660, 0.1, 'sine', 0.2); setTimeout(() => this.tone(990, 0.14, 'sine', 0.2), 90); }
  cash() { this.tone(880, 0.1, 'triangle', 0.22); setTimeout(() => this.tone(1320, 0.18, 'triangle', 0.22), 100); }
  siren() { this.tone(720, 0.35, 'sawtooth', 0.06, 950); }
  horn() { this.tone(330, 0.18, 'square', 0.12); this.tone(415, 0.18, 'square', 0.1); }
  crash() { this.noise(0.25, 0.4, 500); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.22), i * 120)); }
  setEngine(rpm) {
    if (!this.ctx || this.muted) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 50 + rpm * 120;
    this.engineGain.gain.value = rpm > 0.02 ? 0.05 + rpm * 0.05 : 0;
  }
  // Simple looping bassline; step through a minor-key pattern.
  updateMusic(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer += dt;
    const stepDur = 0.21;
    if (this.musicTimer >= stepDur) {
      this.musicTimer -= stepDur;
      const basslines = [
        [55, 0, 55, 65.4, 49, 0, 55, 73.4],
        [82.4, 0, 73.4, 65.4, 82.4, 0, 98, 73.4],
        [49, 49, 0, 58.3, 65.4, 0, 49, 61.7],
      ];
      const line = basslines[this.radio % basslines.length];
      const f = line[this.musicStep % line.length];
      if (f) this.tone(f, 0.19, 'triangle', 0.12);
      if (this.musicStep % 4 === 0) this.tone(f * 4 || 440, 0.08, 'sine', 0.03);
      this.musicStep++;
    }
  }
}
