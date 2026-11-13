import type { Direction } from './types';

const KEYS: Record<string, Direction> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
export class Controls {
  private held: string[] = [];
  private touch: Direction | null = null;
  private queued: Direction | null = null;
  private pointerId: number | null = null;
  private disposeCallbacks: (() => void)[] = [];
  enabled = false;
  constructor(place: () => void, pause: () => void) {
    const down = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input,select,textarea')) return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        // Opening a dialog on Escape must not also trigger its native cancel action.
        event.preventDefault();
        if (!event.repeat) pause();
        return;
      }
      if (!this.enabled) return;
      if (KEYS[event.code] || event.code === 'Space') event.preventDefault();
      if (KEYS[event.code] && !this.held.includes(event.code)) { this.held.push(event.code); this.queued = KEYS[event.code]; }
      if (event.code === 'Space' && !event.repeat) place();
    };
    const up = (event: KeyboardEvent) => { this.held = this.held.filter(k => k !== event.code); };
    const blur = () => this.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    this.disposeCallbacks.push(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); });
  }
  consumeDirection(): Direction | null {
    if (!this.enabled) return null;
    const direction = this.queued ?? this.touch ?? KEYS[this.held.at(-1) ?? ''] ?? null;
    this.queued = null;
    return direction;
  }
  clear() { this.held = []; this.touch = null; this.queued = null; this.pointerId = null; document.querySelectorAll('.dpad button').forEach(b => b.classList.remove('pressed')); }
  bindTouch(root: HTMLElement, place: () => void) {
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-dir]')) {
      const down = (e: PointerEvent) => {
        e.preventDefault(); if (!this.enabled) return;
        this.pointerId = e.pointerId; this.touch = button.dataset.dir as Direction; this.queued = this.touch;
        button.setPointerCapture(e.pointerId); button.classList.add('pressed');
      };
      const release = (e: PointerEvent) => {
        if (this.pointerId === e.pointerId) { this.pointerId = null; this.touch = null; }
        if (e.type === 'pointercancel') this.queued = null;
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerdown', down);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release as EventListener);
    }
    root.querySelector('#touch-bomb')?.addEventListener('pointerdown', e => { e.preventDefault(); if (this.enabled) place(); });
  }
  dispose() { this.disposeCallbacks.forEach(fn => fn()); }
}
