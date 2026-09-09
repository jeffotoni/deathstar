export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private sfx?: GainNode;
  private music?: GainNode;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private beat = 0;
  private beatTimer = 0;
  private muted = false;
  private volume = { master: 0.55, music: 0.32, sfx: 0.6 };
  start() {
    if (!this.context) {
      const ctx = this.context = new AudioContext();
      this.master = ctx.createGain(); this.master.gain.value = this.volume.master; this.master.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.gain.value = this.volume.sfx; this.sfx.connect(this.master);
      this.music = ctx.createGain(); this.music.gain.value = this.volume.music; this.music.connect(this.master);
      this.engine = ctx.createOscillator(); this.engine.type = 'sawtooth'; this.engine.frequency.value = 38;
      this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0.009;
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
    gain.gain.setValueAtTime(volume, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain); gain.connect(bus); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  laser() { this.tone(920, 190, 0.10, 0.025, 'sawtooth'); }
  plasma() { this.tone(180, 35, 0.4, 0.08, 'sawtooth'); }
  burst() { this.tone(430, 25, 0.9, 0.12, 'triangle'); }
  hit() { this.tone(1250, 700, 0.06, 0.03, 'triangle'); }
  explosion() { this.tone(65, 15, 0.8, 0.18, 'sawtooth'); this.tone(120, 20, 0.35, 0.06, 'triangle'); }
  lock() { this.tone(740, 1480, 0.18, 0.05, 'sine'); }
  alert() { this.tone(520, 390, 0.65, 0.065, 'triangle'); }
  pause() { void this.context?.suspend(); }
  update(dt: number, speed: number, stage: number) {
    if (!this.context) return;
    this.engine?.frequency.setTargetAtTime(30 + speed * 0.23, this.context.currentTime, 0.2);
    this.beatTimer -= dt;
    if (this.beatTimer > 0) return;
    this.beatTimer = stage >= 5 ? 0.34 : stage >= 2 ? 0.48 : 0.8;
    const notes = [55, 82.41, 110, 65.41, 55, 98, 73.42, 82.41];
    const note = notes[this.beat++ % notes.length];
    this.tone(note, note, 2.5, 0.025, 'sine', true);
    this.tone(note * 2, note * 2, 1.6, 0.012, 'triangle', true);
    if (stage >= 2) this.tone(110, 35, 0.18, 0.05, 'sine', true);
    if (stage >= 5) this.tone(note * 4, note * 4, 0.5, 0.018, 'triangle', true);
  }
}
