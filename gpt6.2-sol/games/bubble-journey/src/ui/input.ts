import type { Direction } from '../game/maps.ts';

const keys: Record<string, Direction> = { KeyW: 0, ArrowUp: 0, KeyD: 1, ArrowRight: 1, KeyS: 2, ArrowDown: 2, KeyA: 3, ArrowLeft: 3 };

export class Controls {
  private held = new Map<string, Direction>();
  private queued: Direction | null = null;
  private plant = false;
  active = false;

  constructor(togglePause: () => void, touch: HTMLElement, bomb: HTMLElement) {
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape' && this.active && !event.repeat) {
        event.preventDefault();
        togglePause();
        return;
      }
      if (!this.active || event.metaKey || event.ctrlKey || event.altKey) return;
      const direction = keys[event.code];
      if (direction !== undefined) {
        event.preventDefault();
        if (!this.held.has(event.code)) {
          this.held.set(event.code, direction);
          this.queued = direction;
        }
      } else if (event.code === 'Space') {
        if (event.target instanceof HTMLButtonElement && event.target.closest('.topbar, .battle-actions')) return;
        event.preventDefault();
        if (!event.repeat) this.plant = true;
      }
    });
    window.addEventListener('keyup', event => this.held.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    for (const element of touch.querySelectorAll<HTMLButtonElement>('[data-dir]')) {
      element.addEventListener('pointerdown', event => {
        if (!this.active) return;
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        const direction = Number(element.dataset.dir) as Direction;
        this.held.set(String(event.pointerId), direction);
        this.queued = direction;
        element.classList.add('held');
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        element.addEventListener(type, event => {
          this.held.delete(String((event as PointerEvent).pointerId));
          if (![...this.held.values()].includes(Number(element.dataset.dir) as Direction)) element.classList.remove('held');
        });
      }
    }
    bomb.addEventListener('pointerdown', event => {
      if (!this.active) return;
      event.preventDefault();
      this.plant = true;
    });
    bomb.addEventListener('click', event => {
      if (this.active && event.detail === 0) this.plant = true;
    });
  }

  clear() {
    this.held.clear();
    this.queued = null;
    this.plant = false;
    for (const element of document.querySelectorAll('.dpad .held')) element.classList.remove('held');
  }

  poll(consumeDirection: boolean) {
    const activeDirection = [...this.held.values()].at(-1) ?? null;
    const direction = this.queued ?? activeDirection;
    if (consumeDirection) this.queued = null;
    const plant = this.plant;
    this.plant = false;
    return { direction, plant };
  }
}
