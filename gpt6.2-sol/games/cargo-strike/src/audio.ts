import { clamp, length, lookAt, type Vec } from './arena.ts';
import type { Event } from './combat.ts';

export class Sound {
  private context?: AudioContext;
  private mix?: GainNode;
  private noise?: AudioBuffer;
  private level = .65;

  start() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.mix = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        this.mix.connect(limiter).connect(this.context.destination);
        this.mix.gain.value = this.level * .76;
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      void this.context.resume().catch(() => {});
    } catch {
      // Web Audio may be unavailable on a device or blocked by its sound policy.
    }
  }

  volume(level: number) {
    this.level = level;
    if (this.context && this.mix) this.mix.gain.setTargetAtTime(level * .76, this.context.currentTime, .04);
  }

  private envelope(destination: AudioNode, gain: number, duration: number, delay = 0) {
    const ctx = this.context!;
    const out = ctx.createGain(), t = ctx.currentTime + delay;
    out.gain.setValueAtTime(Math.max(.0002, gain), t);
    out.gain.exponentialRampToValueAtTime(.0001, t + duration);
    out.connect(destination);
    return { out, t };
  }

  private burst(destination: AudioNode, gain: number, duration: number, freq: number, filter: BiquadFilterType, delay = 0) {
    const ctx = this.context!;
    const { out, t } = this.envelope(destination, gain, duration, delay);
    const source = ctx.createBufferSource(), band = ctx.createBiquadFilter();
    source.buffer = this.noise!;
    band.type = filter; band.frequency.value = freq; band.Q.value = .85;
    source.connect(band).connect(out);
    source.start(t, Math.random() * .24, duration);
    source.onended = () => { source.disconnect(); band.disconnect(); out.disconnect(); };
  }

  private note(destination: AudioNode, gain: number, duration: number, hz: number, end: number, delay = 0) {
    const { t, out } = this.envelope(destination, gain, duration, delay);
    const osc = this.context!.createOscillator();
    osc.frequency.setValueAtTime(hz, t); osc.frequency.exponentialRampToValueAtTime(end, t + duration);
    osc.connect(out); osc.start(t); osc.stop(t + duration);
    osc.onended = () => { osc.disconnect(); out.disconnect(); };
  }

  play(event: Event, listener: Vec, yaw: number) {
    const ctx = this.context;
    if (!ctx || !this.mix || !this.noise || ctx.state !== 'running' || this.level <= 0) return;
    const pos = event.type === 'boom' ? event.at : event.actor.pos;
    const own = event.type !== 'boom' && !event.actor.bot;
    const dist = own ? 0 : length(pos, listener);
    if (dist > (event.type === 'step' ? 14 : 68)) return;
    const gain = 1 / (1 + dist * .16);
    const pan = ctx.createStereoPanner();
    pan.pan.value = own ? 0 : clamp(-Math.sin(lookAt(listener, pos).yaw - yaw) * .9, -1, 1);
    pan.connect(this.mix);
    switch (event.type) {
      case 'shot': {
        const heavy = event.gun === 'awp' || event.gun === 'ak';
        this.burst(pan, gain * (heavy ? .74 : .62), .12, 1800 + 2500 * gain, 'lowpass');
        this.note(pan, gain * .31, heavy ? .19 : .12, heavy ? 139 : 198, 53);
        this.burst(pan, gain * .15, .31, 1200, 'lowpass', .045);
        break;
      }
      case 'step':
        this.burst(pan, gain * (own ? .09 : .21), .1, 850 + Math.random() * 340, 'bandpass');
        this.note(pan, gain * .03, .075, 145, 63);
        break;
      case 'boom':
        this.burst(pan, gain * .92, .54, 1800, 'lowpass');
        this.note(pan, gain * .55, .49, 101, 29);
        break;
      case 'reload':
        if (own) {
          for (const [delay, hz] of [[0, 1500], [.31, 2150], [.79, 1780], [1.08, 2640]])
            this.burst(pan, .23, .09, hz, 'bandpass', delay);
        }
        break;
      case 'throw':
      case 'switch':
      case 'empty':
        if (own) this.burst(pan, .23, .08, event.type === 'empty' ? 2700 : 1400, 'bandpass');
        break;
      case 'hit':
        if (!event.target.bot) this.burst(pan, .22, .12, 680, 'lowpass');
        if (own) this.note(pan, .17, .115, event.fatal ? 880 : 580, event.fatal ? 1320 : 700);
        break;
    }
    setTimeout(() => pan.disconnect(), 1300);
  }
}
