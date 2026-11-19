const melody = [72, 76, 79, -1, 81, 79, 76, -1, 74, 77, 81, -1, 79, 77, 74, -1, 72, 76, 79, 84, 81, -1, 79, 76, 74, 77, 76, 74, 72, -1, 67, -1];
const bass = [48, 48, 53, 53, 45, 45, 55, 55];
type Sound = 'plant' | 'blast' | 'pickup' | 'out' | 'win' | 'loss' | 'click';

export class ArcadeAudio {
  private context?: AudioContext;
  private music?: GainNode;
  private effects?: GainNode;
  private timer?: number;
  private noise?: AudioBuffer;
  private beat = 0;
  private next = 0;
  private enabled = true;
  private playing = false;

  async unlock() {
    const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    if (!this.context) {
      try {
        const context = new Context();
        this.context = context;
        this.music = context.createGain();
        this.effects = context.createGain();
        this.music.gain.value = this.enabled ? 0.17 : 0;
        this.effects.gain.value = this.enabled ? 0.32 : 0;
        const limit = context.createDynamicsCompressor();
        this.music.connect(limit);
        this.effects.connect(limit);
        limit.connect(context.destination);
        this.noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.4), context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      } catch {
        return;
      }
    }
    try { if (this.context.state !== 'running') await this.context.resume(); } catch { return; }
    if (this.playing && this.enabled) this.startClock();
  }

  mute(muted: boolean) {
    this.enabled = !muted;
    if (this.context && this.music && this.effects) {
      this.music.gain.setTargetAtTime(muted ? 0 : 0.17, this.context.currentTime, 0.015);
      this.effects.gain.setTargetAtTime(muted ? 0 : 0.32, this.context.currentTime, 0.015);
    }
    if (!muted && this.playing) this.startClock();
    else if (muted) this.stopClock();
  }

  loop(playing: boolean) {
    this.playing = playing;
    if (playing && this.enabled) this.startClock();
    else this.stopClock();
  }

  private startClock() {
    if (this.context?.state !== 'running' || this.timer !== undefined) return;
    this.next = this.context.currentTime + 0.045;
    this.timer = window.setInterval(() => this.schedule(), 55);
    this.schedule();
  }

  private stopClock() {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private schedule() {
    const context = this.context;
    if (!context || !this.music || context.state !== 'running') return;
    if (this.next < context.currentTime) this.next = context.currentTime + 0.02;
    while (this.next < context.currentTime + 0.13) {
      const note = melody[this.beat % melody.length];
      if (note > 0) this.tone(note, 0.15, this.next, 0.3, 'sine', this.music);
      if (this.beat % 4 === 0) this.tone(bass[Math.floor(this.beat / 4) % bass.length], 0.34, this.next, 0.38, 'triangle', this.music);
      if (this.beat % 4 === 2) this.tone(89 - Math.floor(this.beat % 8 / 4) * 3, 0.035, this.next, 0.04, 'sine', this.music);
      this.beat++;
      this.next += 0.228;
    }
  }

  play(sound: Sound) {
    const context = this.context;
    if (!context || !this.effects || !this.enabled || context.state !== 'running') return;
    const now = context.currentTime;
    const notes: Record<Sound, number[]> = {
      plant: [56, 71], blast: [36], pickup: [72, 79, 86], out: [75, 65, 48],
      win: [67, 72, 76, 79, 84], loss: [72, 69, 64, 60], click: [81],
    };
    notes[sound].forEach((note, index) => this.tone(note, sound === 'blast' ? 0.29 : 0.13, now + index * 0.067, sound === 'blast' ? 0.63 : 0.24, sound === 'blast' ? 'sine' : 'triangle', this.effects!));
    if (sound !== 'blast' || !this.noise) return;
    const source = context.createBufferSource();
    const damp = context.createBiquadFilter();
    const volume = context.createGain();
    source.buffer = this.noise;
    damp.type = 'lowpass';
    damp.frequency.setValueAtTime(2300, now);
    damp.frequency.exponentialRampToValueAtTime(160, now + 0.35);
    volume.gain.setValueAtTime(0.47, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.37);
    source.connect(damp).connect(volume).connect(this.effects);
    source.start();
  }

  private tone(note: number, length: number, at: number, loudness: number, wave: OscillatorType, channel: GainNode) {
    if (!this.context) return;
    const voice = this.context.createOscillator();
    const level = this.context.createGain();
    voice.type = wave;
    voice.frequency.value = 440 * 2 ** ((note - 69) / 12);
    level.gain.setValueAtTime(0.001, at);
    level.gain.linearRampToValueAtTime(loudness, at + 0.009);
    level.gain.exponentialRampToValueAtTime(0.001, at + length);
    voice.connect(level).connect(channel);
    voice.start(at);
    voice.stop(at + length + 0.015);
  }
}
