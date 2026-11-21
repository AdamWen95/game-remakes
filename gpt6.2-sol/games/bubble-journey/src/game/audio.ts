const tracks = {
  lobby: {
    step: 0.32, duration: 0.23, melodyGain: 0.22, bassGain: 0.25,
    melody: [77, 81, 84, -1, 86, 84, 81, -1, 79, 82, 86, -1, 84, 82, 79, -1, 81, 84, 89, -1, 88, 84, 81, -1, 82, 79, 81, 77, 84, -1, 77, -1],
    bass: [53, 53, 55, 55, 57, 57, 48, 53],
  },
  battle: {
    step: 0.228, duration: 0.15, melodyGain: 0.3, bassGain: 0.38,
    melody: [72, 76, 79, -1, 81, 79, 76, -1, 74, 77, 81, -1, 79, 77, 74, -1, 72, 76, 79, 84, 81, -1, 79, 76, 74, 77, 76, 74, 72, -1, 67, -1],
    bass: [48, 48, 53, 53, 45, 45, 55, 55],
  },
};
type Track = keyof typeof tracks;
type Sound = 'plant' | 'blast' | 'pickup' | 'out' | 'win' | 'loss' | 'click';

export class ArcadeAudio {
  private context?: AudioContext;
  private music?: GainNode;
  private effects?: GainNode;
  private timer?: number;
  private noise?: AudioBuffer;
  private beat = { lobby: 0, battle: 0 };
  private next = 0;
  private enabled = true;
  private track: Track | null = null;

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
    if (this.track && this.enabled) this.startClock();
  }

  mute(muted: boolean) {
    this.enabled = !muted;
    if (this.context && this.music && this.effects) {
      this.music.gain.setTargetAtTime(muted ? 0 : 0.17, this.context.currentTime, 0.015);
      this.effects.gain.setTargetAtTime(muted ? 0 : 0.32, this.context.currentTime, 0.015);
    }
    if (!muted && this.track) this.startClock();
    else if (muted) this.stopClock();
  }

  loop(track: Track | null) {
    if (this.track !== track) this.stopClock();
    this.track = track;
    if (track && this.enabled) this.startClock();
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
    const track = this.track;
    if (!context || !this.music || !track || context.state !== 'running' || document.hidden) return;
    const { step, duration, melodyGain, bassGain, melody, bass } = tracks[track];
    if (this.next < context.currentTime) this.next = context.currentTime + 0.02;
    while (this.next < context.currentTime + 0.13) {
      const beat = this.beat[track]++;
      const note = melody[beat % melody.length];
      if (note > 0) this.tone(note, duration, this.next, melodyGain, 'sine', this.music);
      if (beat % 4 === 0) this.tone(bass[Math.floor(beat / 4) % bass.length], 0.34, this.next, bassGain, 'triangle', this.music);
      if (track === 'battle' && beat % 4 === 2) this.tone(89 - Math.floor(beat % 8 / 4) * 3, 0.035, this.next, 0.04, 'sine', this.music);
      this.next += step;
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
