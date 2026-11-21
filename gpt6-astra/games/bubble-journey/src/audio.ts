const tracks = {
  lobby: {
    beatMs: 320, length: .24, volume: .06, bassVolume: .038,
    melody: [67, 71, 74, 76, 74, 71, 69, 0, 69, 72, 76, 79, 76, 74, 72, 0, 71, 74, 79, 81, 79, 74, 71, 0, 72, 76, 74, 72, 69, 71, 67, 0],
    bass: [43, 45, 47, 48],
  },
  battle: {
    beatMs: 230, length: .3, volume: .045, bassVolume: .055,
    melody: [76, 79, 81, 79, 76, 72, 74, 0, 76, 79, 84, 81, 79, 76, 74, 0, 72, 76, 79, 76, 74, 72, 69, 0, 72, 74, 76, 79, 76, 74, 72, 0],
    bass: [48, 53, 57, 55],
  },
};
type MusicTrack = keyof typeof tracks;

export class Sound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private beat = { lobby: 0, battle: 0 };
  private track: MusicTrack | null = null;
  private musicEnabled = true;
  muted = false;

  get music() { return this.musicEnabled; }
  set music(enabled: boolean) { this.musicEnabled = enabled; this.syncMusic(); }

  async unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.4; this.master.connect(this.context.destination);
      } catch { return; }
    }
    if (this.context.state === 'suspended') await this.context.resume().catch(() => {});
    this.syncMusic();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : .4, this.context.currentTime, .03);
    this.syncMusic();
  }
  private note(frequency: number, length: number, volume = .1, type: OscillatorType = 'sine', delay = 0, slide?: number) {
    if (!this.context || !this.master || this.context.state !== 'running' || this.muted) return;
    const time = this.context.currentTime + delay;
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, time);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, time + length);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .008);
    gain.gain.exponentialRampToValueAtTime(.001, time + length);
    osc.connect(gain); gain.connect(this.master); osc.start(time); osc.stop(time + length + .03);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  play(kind: 'click' | 'place' | 'explode' | 'pickup' | 'death' | 'win' | 'lose' | 'tick') {
    if (kind === 'click') this.note(650, .07, .1, 'sine', 0, 850);
    if (kind === 'place') this.note(220, .17, .2, 'sine', 0, 440);
    if (kind === 'explode') { this.note(100, .26, .28, 'triangle', 0, 35); this.note(290, .15, .12, 'sine', 0, 80); }
    if (kind === 'pickup') [660, 880, 1320].forEach((f, i) => this.note(f, .18, .12, 'sine', i * .07));
    if (kind === 'death' || kind === 'lose') [440, 330, 220].forEach((f, i) => this.note(f, .25, .12, 'triangle', i * .1));
    if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => this.note(f, .4, .15, 'triangle', i * .13));
    if (kind === 'tick') this.note(740, .1, .13);
  }
  startMusic(track: MusicTrack = 'battle') {
    if (this.track !== track) {
      this.clearMusicTimer();
      this.track = track;
    }
    this.syncMusic();
  }
  private syncMusic() {
    const track = this.track;
    if (!track || !this.musicEnabled || this.muted || this.context?.state !== 'running') {
      this.clearMusicTimer();
      return;
    }
    if (this.timer !== null) return;
    const { beatMs, length, volume, bassVolume, melody, bass } = tracks[track];
    this.timer = setInterval(() => {
      if (document.hidden || this.context?.state !== 'running') return;
      const beat = this.beat[track]++;
      const midi = melody[beat % melody.length];
      if (midi) this.note(440 * 2 ** ((midi - 69) / 12), length, volume, 'triangle');
      if (beat % 4 === 0) this.note(440 * 2 ** ((bass[Math.floor(beat / 8) % bass.length] - 69) / 12), .6, bassVolume);
    }, beatMs);
  }
  private clearMusicTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
  stopMusic() { this.track = null; this.clearMusicTimer(); }
  dispose() { this.stopMusic(); void this.context?.close(); }
}
