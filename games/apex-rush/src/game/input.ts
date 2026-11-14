import { IDLE, type Controls } from './race';
export class Input {
  private keys = new Set<string>();
  private pointers = new Map<number,string>();
  private nitroQueued = false;
  auto = false;
  constructor(private action: (name: string) => void) {
    addEventListener('keydown', event => {
      if ((event.target as HTMLElement).matches('input,select,textarea')) return;
      const key = event.code;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(key)) {
        if ((event.target as HTMLElement).tagName === 'BUTTON' && key==='Space') return;
        event.preventDefault();
      }
      this.keys.add(key);
      if (!event.repeat && ['Space','ControlLeft','ControlRight'].includes(key)) this.nitroQueued = true;
      if (!event.repeat) { const actions: Record<string,string> = { Escape:'pause',KeyP:'pause',KeyR:'reset',KeyC:'camera',KeyM:'mute' }; if (actions[key]) this.action(actions[key]); }
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    addEventListener('blur', () => { this.clear(); this.action('blur'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); this.action('blur'); } });
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(button => {
      button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId,button.dataset.control!); if (button.dataset.control==='nitro') this.nitroQueued=true; button.classList.add('held'); });
      const release = (event: PointerEvent) => { this.pointers.delete(event.pointerId); button.classList.remove('held'); };
      button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('lostpointercapture',release);
    });
  }
  clear() { this.keys.clear(); this.pointers.clear(); this.nitroQueued=false; document.querySelectorAll('.held').forEach(el=>el.classList.remove('held')); }
  read(): Controls {
    const touch = (name: string) => [...this.pointers.values()].includes(name);
    const has = (...names: string[]) => names.some(name=>this.keys.has(name));
    const nitro=this.nitroQueued || has('Space','ControlLeft','ControlRight') || touch('nitro');this.nitroQueued=false;
    return { ...IDLE,
      throttle: this.auto || has('KeyW','ArrowUp') || touch('gas'),
      brake: has('KeyS','ArrowDown') || touch('brake'),
      steer: Number(has('KeyD','ArrowRight') || touch('right'))-Number(has('KeyA','ArrowLeft') || touch('left')),
      drift: has('ShiftLeft','ShiftRight') || touch('drift'),
      nitro,
    };
  }
}
