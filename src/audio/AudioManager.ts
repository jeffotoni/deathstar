export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private sfx?: GainNode;
  private music?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private beat = 0;
  private beatTimer = 0;
  private muted = false;
  private volume = { master: 0.7, music: 0.4, sfx: 0.75 };
  start() {
    if (!this.context) {
      const ctx = this.context = new AudioContext();
      this.master = ctx.createGain(); this.master.gain.value = this.volume.master;
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -20; this.compressor.knee.value = 18; this.compressor.ratio.value = 5; this.compressor.attack.value = 0.003; this.compressor.release.value = 0.24;
      this.master.connect(this.compressor); this.compressor.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.gain.value = this.volume.sfx; this.sfx.connect(this.master);
      this.music = ctx.createGain(); this.music.gain.value = this.volume.music; this.music.connect(this.master);
      this.noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.5), ctx.sampleRate);
      const noise = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
      this.engine = ctx.createOscillator(); this.engine.type = 'sawtooth'; this.engine.frequency.value = 38;
      this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0.014;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 150;
      this.engine.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.sfx); this.engine.start();
    }
    void this.context.resume();
  }
  setVolume(bus: 'master' | 'music' | 'sfx', value: number) {
    this.volume[bus] = value; const node = this[bus]; if (node && !(bus === 'master' && this.muted)) node.gain.value = value;
  }
  setMuted(muted: boolean) { this.muted = muted; if (this.master) this.master.gain.value = muted ? 0 : this.volume.master; }
  private tone(frequency: number, end: number, duration: number, volume: number, type: OscillatorType, music = false) {
    const ctx = this.context; const bus = music ? this.music : this.sfx; if (!ctx || !bus) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, end), ctx.currentTime + duration);
    const mixBoost = music ? 1.2 : 1.5;
    gain.gain.setValueAtTime(volume * mixBoost, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain); gain.connect(bus); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  private noise(duration: number, volume: number, cutoff: number, music = false) {
    const ctx = this.context; const bus = music ? this.music : this.sfx; if (!ctx || !bus || !this.noiseBuffer) return;
    const source = ctx.createBufferSource(); source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
    const gain = ctx.createGain(); const mixBoost = music ? 1.2 : 1.5;
    gain.gain.setValueAtTime(volume * mixBoost, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(bus); source.start(); source.stop(ctx.currentTime + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  laser() {
    this.tone(1180, 260, 0.09, 0.045, 'sawtooth');
    this.tone(1850, 650, 0.045, 0.025, 'triangle');
    this.noise(0.045, 0.018, 5200);
  }
  plasma() {
    this.tone(180, 35, 0.4, 0.14, 'sawtooth');
    this.tone(75, 25, 0.32, 0.08, 'triangle');
    this.noise(0.18, 0.045, 900);
  }
  burst() {
    this.tone(430, 25, 0.9, 0.20, 'triangle');
    this.tone(900, 120, 0.22, 0.08, 'sawtooth');
    this.noise(0.28, 0.07, 2600);
  }
  hit() { this.tone(1250, 700, 0.06, 0.06, 'triangle'); this.noise(0.035, 0.015, 6000); }
  explosion() {
    this.tone(55, 14, 0.95, 0.30, 'sawtooth');
    this.tone(135, 20, 0.45, 0.12, 'triangle');
    this.noise(0.78, 0.16, 950);
    this.noise(0.20, 0.08, 3800);
  }
  lock() { this.tone(740, 1480, 0.18, 0.08, 'sine'); }
  alert() { this.tone(520, 390, 0.65, 0.10, 'triangle'); }
  pause() { void this.context?.suspend(); }
  update(dt: number, speed: number, stage: number) {
    if (!this.context) return;
    this.engine?.frequency.setTargetAtTime(30 + speed * 0.23, this.context.currentTime, 0.2);
    this.beatTimer -= dt;
    if (this.beatTimer > 0) return;
    this.beatTimer = stage >= 5 ? 0.34 : stage >= 2 ? 0.48 : 0.8;
    const notes = [55, 82.41, 110, 65.41, 55, 98, 73.42, 82.41];
    const note = notes[this.beat++ % notes.length];
    this.tone(note, note, 2.5, 0.035, 'sine', true);
    this.tone(note * 2, note * 2, 1.6, 0.018, 'triangle', true);
    if (stage >= 2) this.tone(110, 35, 0.18, 0.07, 'sine', true);
    if (stage >= 5) this.tone(note * 4, note * 4, 0.5, 0.025, 'triangle', true);
  }
}
