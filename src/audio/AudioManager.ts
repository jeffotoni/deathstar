type AudioPosition = { x: number; y: number; z: number };
type AudioListenerState = { position: AudioPosition; forward: AudioPosition; up: AudioPosition; boosting: boolean };

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private sfx?: GainNode;
  private music?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private ambient?: OscillatorNode;
  private ambientGain?: GainNode;
  private beat = 0;
  private beatTimer = 0;
  private radarTimer = 0;
  private musicDuck = 1;
  private musicDuckHold = 0;
  private appliedMusicGain = 0;
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
      this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0.012;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 150;
      this.engine.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.sfx); this.engine.start();
      this.ambient = ctx.createOscillator(); this.ambient.type = 'triangle'; this.ambient.frequency.value = 62;
      this.ambientGain = ctx.createGain(); this.ambientGain.gain.value = 0.0025;
      const ambientFilter = ctx.createBiquadFilter(); ambientFilter.type = 'lowpass'; ambientFilter.frequency.value = 220;
      this.ambient.connect(ambientFilter); ambientFilter.connect(this.ambientGain); this.ambientGain.connect(this.sfx); this.ambient.start();
      this.appliedMusicGain = this.volume.music;
    }
    void this.context.resume();
  }
  setVolume(bus: 'master' | 'music' | 'sfx', value: number) {
    this.volume[bus] = value; const node = this[bus];
    if (node && !(bus === 'master' && this.muted)) node.gain.value = bus === 'music' ? value * this.musicDuck : value;
    if (bus === 'music') this.appliedMusicGain = value * this.musicDuck;
  }
  setMuted(muted: boolean) { this.muted = muted; if (this.master) this.master.gain.value = muted ? 0 : this.volume.master; }
  private createPanner(position: AudioPosition) {
    const panner = this.context!.createPanner();
    panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 120; panner.maxDistance = 4000; panner.rolloffFactor = 0.45;
    panner.setPosition(position.x, position.y, position.z);
    return panner;
  }
  private randomPitch(amount = 0.04) { return 1 + (Math.random() * 2 - 1) * amount; }
  private duckMusic(amount: number) { this.musicDuck = Math.min(this.musicDuck, amount); this.musicDuckHold = Math.max(this.musicDuckHold, 0.22); }
  private tone(frequency: number, end: number, duration: number, volume: number, type: OscillatorType, music = false, position?: AudioPosition) {
    const ctx = this.context; const bus = music ? this.music : this.sfx; if (!ctx || !bus) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, end), ctx.currentTime + duration);
    const mixBoost = music ? 1.2 : 1.5;
    gain.gain.setValueAtTime(volume * mixBoost, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain); const panner = position ? this.createPanner(position) : undefined;
    if (panner) { gain.connect(panner); panner.connect(bus); } else gain.connect(bus);
    oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); panner?.disconnect(); };
  }
  private noise(duration: number, volume: number, cutoff: number, music = false, position?: AudioPosition) {
    const ctx = this.context; const bus = music ? this.music : this.sfx; if (!ctx || !bus || !this.noiseBuffer) return;
    const source = ctx.createBufferSource(); source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
    const gain = ctx.createGain(); const mixBoost = music ? 1.2 : 1.5;
    gain.gain.setValueAtTime(volume * mixBoost, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter); filter.connect(gain); const panner = position ? this.createPanner(position) : undefined;
    if (panner) { gain.connect(panner); panner.connect(bus); } else gain.connect(bus);
    source.start(); source.stop(ctx.currentTime + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); panner?.disconnect(); };
  }
  laser(position?: AudioPosition) {
    const pitch = this.randomPitch(0.035);
    this.tone(1180 * pitch, 260 * pitch, 0.09, 0.045, 'sawtooth', false, position);
    this.tone(1850 * pitch, 650 * pitch, 0.045, 0.025, 'triangle', false, position);
    this.noise(0.045, 0.018, 5200 * pitch, false, position);
  }
  plasma(position?: AudioPosition) {
    const pitch = this.randomPitch(0.06); this.duckMusic(0.72);
    this.tone(180 * pitch, 35 * pitch, 0.4, 0.14, 'sawtooth', false, position);
    this.tone(75 * pitch, 25 * pitch, 0.32, 0.08, 'triangle', false, position);
    this.noise(0.18, 0.045, 900 * pitch, false, position);
  }
  burst(position?: AudioPosition) {
    const pitch = this.randomPitch(0.05); this.duckMusic(0.55);
    this.tone(430 * pitch, 25 * pitch, 0.9, 0.20, 'triangle', false, position);
    this.tone(900 * pitch, 120 * pitch, 0.22, 0.08, 'sawtooth', false, position);
    this.noise(0.28, 0.07, 2600 * pitch, false, position);
  }
  hit(position?: AudioPosition, heavy = false) {
    const pitch = this.randomPitch(0.08); this.duckMusic(heavy ? 0.48 : 0.78);
    this.tone(1250 * pitch, 700 * pitch, 0.06, heavy ? 0.075 : 0.06, 'triangle', false, position);
    this.noise(0.035, heavy ? 0.022 : 0.015, 6000 * pitch, false, position);
  }
  explosion(position?: AudioPosition, size = 1) {
    const pitch = this.randomPitch(0.045); this.duckMusic(size >= 2 ? 0.3 : 0.48);
    this.tone(55 * pitch, 14 * pitch, 0.95, 0.30, 'sawtooth', false, position);
    this.tone(135 * pitch, 20 * pitch, 0.45, 0.12, 'triangle', false, position);
    this.noise(0.78, 0.16, 950 * pitch, false, position);
    this.noise(0.20, 0.08, 3800 * pitch, false, position);
  }
  damage(position?: AudioPosition) {
    this.duckMusic(0.45);
    this.tone(170, 90, 0.32, 0.12, 'sawtooth', false, position);
    this.tone(620, 420, 0.22, 0.06, 'square', false, position);
  }
  bossArrival(position?: AudioPosition) {
    this.duckMusic(0.3);
    this.tone(42, 110, 1.8, 0.18, 'sawtooth', false, position);
    this.tone(88, 28, 1.25, 0.12, 'sine', false, position);
    this.noise(1.4, 0.07, 700, false, position);
  }
  bossPhase(position: AudioPosition, phase: number) {
    const base = [180, 240, 130, 82][Math.min(3, phase)];
    this.duckMusic(0.52);
    this.tone(base, base * 2.1, 0.55, 0.13, 'square', false, position);
    this.tone(base * 0.5, base * 0.24, 0.9, 0.09, 'sawtooth', false, position);
    this.noise(0.32, 0.045, 1800, false, position);
  }
  bossSubsystem(position: AudioPosition, phase: number) {
    const tones = [[280, 70, 0.36], [620, 110, 0.48], [105, 26, 0.72], [150, 18, 1.05]][Math.min(3, phase)];
    this.duckMusic(phase === 3 ? 0.28 : 0.58);
    this.tone(tones[0], tones[1], tones[2], phase === 3 ? 0.16 : 0.11, phase === 0 ? 'square' : 'sawtooth', false, position);
    this.noise(Math.min(0.6, tones[2]), phase === 3 ? 0.11 : 0.055, phase === 0 ? 3200 : 1300, false, position);
  }
  bossFinale(position: AudioPosition, intensity: number, final = false) {
    const pitch = this.randomPitch(0.04); const size = Math.min(8, Math.max(1, intensity));
    this.duckMusic(final ? 0.18 : 0.38);
    this.tone(48 * pitch, 14 * pitch, final ? 1.35 : 0.5, (final ? 0.32 : 0.12) * Math.min(1.5, size / 4), 'sawtooth', false, position);
    this.tone(120 * pitch, 28 * pitch, final ? 0.75 : 0.3, (final ? 0.14 : 0.06) * Math.min(1.5, size / 4), 'triangle', false, position);
    this.noise(final ? 1.15 : 0.38, (final ? 0.18 : 0.07) * Math.min(1.5, size / 4), final ? 780 : 1100, false, position);
  }
  lock() { this.tone(740 * this.randomPitch(0.03), 1480, 0.18, 0.08, 'sine'); }
  alert() { this.duckMusic(0.7); this.tone(520, 390, 0.65, 0.10, 'triangle'); }
  pause() { void this.context?.suspend(); }
  update(dt: number, speed: number, stage: number, listener?: AudioListenerState, contacts = 0, radarPosition?: AudioPosition) {
    if (!this.context) return;
    const ctx = this.context;
    if (listener) {
      const audioListener = ctx.listener;
      audioListener.setPosition(listener.position.x, listener.position.y, listener.position.z);
      audioListener.setOrientation(listener.forward.x, listener.forward.y, listener.forward.z, listener.up.x, listener.up.y, listener.up.z);
    }
    if (this.musicDuckHold > 0) this.musicDuckHold -= dt;
    else this.musicDuck += (1 - this.musicDuck) * (1 - Math.exp(-dt * 3.2));
    const targetMusicGain = this.volume.music * this.musicDuck;
    if (this.music && Math.abs(targetMusicGain - this.appliedMusicGain) > 0.004) {
      this.music.gain.setTargetAtTime(targetMusicGain, ctx.currentTime, 0.04); this.appliedMusicGain = targetMusicGain;
    }
    this.engine?.frequency.setTargetAtTime(30 + speed * 0.23, this.context.currentTime, 0.2);
    this.engineGain?.gain.setTargetAtTime(0.012 + Math.min(speed, 240) * 0.000035 + (listener?.boosting ? 0.008 : 0), ctx.currentTime, 0.16);
    this.ambient?.frequency.setTargetAtTime(58 + speed * 0.09, ctx.currentTime, 0.3);
    this.ambientGain?.gain.setTargetAtTime(0.0025 + Math.min(speed, 240) * 0.000006 + (listener?.boosting ? 0.003 : 0), ctx.currentTime, 0.25);
    this.radarTimer -= dt;
    if (contacts > 0 && this.radarTimer <= 0) { this.radarTimer = stage >= 4 ? 0.62 : 0.95; this.tone(760, 1280, 0.055, 0.018, 'sine', false, radarPosition); }
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
