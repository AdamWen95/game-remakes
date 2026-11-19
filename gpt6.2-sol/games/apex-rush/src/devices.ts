import { neutral, type Controls, type Race } from './race.ts';

const driving = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
  ShiftLeft: 'drift', ShiftRight: 'drift', Space: 'boost', ControlLeft: 'boost', ControlRight: 'boost',
  KeyR: 'reset',
} as const;
const commands = { Escape: 'pause', KeyP: 'pause', KeyC: 'camera', KeyM: 'audio' } as const;
type Action = typeof driving[keyof typeof driving];
type Command = typeof commands[keyof typeof commands];

export class Input {
  private keys = new Set<string>();
  private pointers = new Map<number, { action: Action; button: HTMLElement }>();
  private pending = new Set<Action>();

  constructor(touch: HTMLElement, live: () => boolean, command: (value: Command) => void) {
    window.addEventListener('keydown', event => {
      const key = event.code as keyof typeof driving;
      const shortcut = commands[event.code as keyof typeof commands];
      if (shortcut && !event.repeat && !event.ctrlKey && !event.metaKey && (live() || shortcut === 'pause' || shortcut === 'audio')) {
        if (event.code === 'Escape' && document.querySelector('dialog[open]')) return;
        event.preventDefault();
        command(shortcut);
      }
      if (!live() || !Object.hasOwn(driving, key) || event.altKey || event.metaKey) return;
      if (key === 'Space' && event.target instanceof HTMLButtonElement && event.target.matches(':focus-visible')) return;
      if (event.ctrlKey && !['ControlLeft', 'ControlRight'].includes(key)) return;
      event.preventDefault();
      this.keys.add(key);
      if (!event.repeat) this.pending.add(driving[key]);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    touch.addEventListener('pointerdown', event => {
      const target = (event.target as Element).closest<HTMLElement>('[data-control]');
      if (!target || !live() || event.button !== 0) return;
      const action = target.dataset.control as Action;
      event.preventDefault();
      target.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { action, button: target });
      this.pending.add(action);
      target.classList.add('pressed');
    });
    const release = (event: PointerEvent) => {
      const active = this.pointers.get(event.pointerId);
      if (!active) return;
      this.pointers.delete(event.pointerId);
      if (![...this.pointers.values()].some(p => p.button === active.button)) active.button.classList.remove('pressed');
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) touch.addEventListener(event, release);
  }

  read(autoGas: boolean): Controls {
    if (!this.keys.size && !this.pointers.size && !this.pending.size) return autoGas ? { ...neutral, gas: true } : neutral;
    const buttons = new Set([...this.keys].map(key => driving[key as keyof typeof driving]));
    for (const state of this.pointers.values()) buttons.add(state.action);
    const result = {
      steer: Number(buttons.has('right')) - Number(buttons.has('left')),
      gas: autoGas || buttons.has('gas'), brake: buttons.has('brake'), drift: buttons.has('drift'),
      boost: this.pending.has('boost'), reset: this.pending.has('reset'),
    };
    this.pending.clear();
    return result;
  }

  clear() {
    this.keys.clear();
    this.pending.clear();
    for (const [id, { button }] of this.pointers) {
      button.classList.remove('pressed');
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
    this.pointers.clear();
  }
}

export class Sound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private rpm?: OscillatorNode;
  private harmonics?: OscillatorNode;
  private engine?: GainNode;
  private tires?: GainNode;
  muted = false;

  unlock() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        const ctx = this.ctx;
        const master = ctx.createGain();
        master.gain.value = .32;
        master.connect(ctx.destination);
        this.master = master;
        const engine = ctx.createGain();
        engine.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 560;
        const rpm = ctx.createOscillator();
        const harmonics = ctx.createOscillator();
        rpm.type = 'triangle';
        harmonics.type = 'sawtooth';
        const upper = ctx.createGain();
        upper.gain.value = .24;
        rpm.connect(filter);
        harmonics.connect(upper).connect(filter);
        filter.connect(engine).connect(master);
        rpm.start();
        harmonics.start();
        const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const values = noise.getChannelData(0);
        for (let i = 0; i < values.length; i++) values[i] = (Math.random() - .5) * .62;
        const source = ctx.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 1020;
        band.Q.value = .6;
        const tires = ctx.createGain();
        tires.gain.value = 0;
        source.connect(band).connect(tires).connect(master);
        source.start();
        Object.assign(this, { engine, rpm, harmonics, tires });
      }
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
    } catch {
      // Audio is optional on browsers with restricted Web Audio support.
    }
  }

  mix(race?: Race) {
    const time = this.ctx?.currentTime;
    if (time === undefined) return;
    const car = race?.player;
    const speed = car?.speed ?? 0;
    const pitch = 41 + speed * 1.54 + (car?.boost ? 23 : 0);
    this.rpm?.frequency.setTargetAtTime(pitch, time, .06);
    this.harmonics?.frequency.setTargetAtTime(pitch * 2.04, time, .06);
    this.engine?.gain.setTargetAtTime(car ? .12 + speed / 195 : 0, time, .09);
    this.tires?.gain.setTargetAtTime(car?.drift ? Math.min(.31, speed * .004) : 0, time, .075);
    this.master?.gain.setTargetAtTime(this.muted ? 0 : .32, time, .06);
  }

  cue(kind: 'count' | 'go' | 'mini' | 'nitro' | 'hit' | 'lap' | 'ready' | 'finish') {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;
    const cues = {
      count: [420, 320, .17], go: [560, 880, .26], mini: [405, 710, .23], nitro: [205, 850, .48],
      hit: [125, 48, .23], lap: [525, 890, .25], ready: [700, 1140, .20], finish: [544, 1180, .68],
    };
    const [from, to, duration] = cues[kind];
    const now = ctx.currentTime;
    const note = ctx.createOscillator();
    const gain = ctx.createGain();
    note.type = kind === 'hit' ? 'triangle' : 'sine';
    note.frequency.setValueAtTime(from, now);
    note.frequency.exponentialRampToValueAtTime(to, now + duration * .8);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.exponentialRampToValueAtTime(.48, now + .016);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    note.connect(gain).connect(this.master);
    note.start(now);
    note.stop(now + duration);
  }
}
