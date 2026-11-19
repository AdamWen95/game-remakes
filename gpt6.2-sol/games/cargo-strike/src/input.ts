import { blankInput, type Input } from './match.ts';

const bindings = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'Space', 'KeyR', 'KeyG', 'Digit1', 'Digit2',
]);

export function controls(battle: HTMLElement, active: () => boolean, pause: () => void, board: (show: boolean) => void) {
  const plane = battle.querySelector<HTMLElement>('#control-plane')!;
  const stick = battle.querySelector<HTMLElement>('#stick')!;
  const knob = stick.querySelector('i')!;
  const adsButton = battle.querySelector<HTMLButtonElement>('[data-action="ads"]')!;
  const keys = new Set<string>();
  let pending = blankInput(), fire = false, mouseAds = false, touchAds = false, touchGun: 1 | 2 = 1;
  let aimPointer: number | null = null, movePointer: number | null = null, shootPointer: number | null = null;
  let lockOwned = false, mx = 0, mz = 0;
  let lastX = 0, lastY = 0;

  function reset() {
    keys.clear(); pending = blankInput(); fire = false; mouseAds = false; touchAds = false;
    adsButton.setAttribute('aria-pressed', 'false');
    aimPointer = movePointer = shootPointer = null; mx = mz = 0; knob.style.transform = '';
    board(false);
  }
  function lock() {
    if (battle.classList.contains('touch-mode') || !plane.requestPointerLock || document.pointerLockElement) return;
    try {
      const request = plane.requestPointerLock();
      request?.catch(() => {});
    } catch {
      // The drag controls use the same input when the browser rejects capture.
    }
  }
  function touch() {
    battle.classList.add('touch-mode');
  }
  if (matchMedia('(pointer: coarse)').matches) touch();
  document.addEventListener('pointerlockchange', () => {
    const now = document.pointerLockElement === plane;
    if (lockOwned && !now && active()) pause();
    lockOwned = now;
  });
  document.addEventListener('keydown', e => {
    if (!active()) return;
    if (e.code === 'Escape') { e.preventDefault(); pause(); return; }
    if (e.code === 'Tab') { e.preventDefault(); board(true); return; }
    if (!bindings.has(e.code)) return;
    e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space') pending.jump = true;
    if (e.code === 'KeyR') pending.reload = true;
    if (e.code === 'KeyG') pending.grenade = true;
    if (e.code === 'Digit1' || e.code === 'Digit2') pending.slot = touchGun = e.code === 'Digit1' ? 1 : 2;
  });
  document.addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'Tab' && active()) { e.preventDefault(); board(false); }
  });
  plane.addEventListener('contextmenu', e => e.preventDefault());
  plane.addEventListener('pointerdown', e => {
    if (!active()) return;
    if (e.pointerType === 'touch') {
      e.preventDefault();
      touch();
    }
    if (document.pointerLockElement !== plane && aimPointer === null) {
      aimPointer = e.pointerId;
      lastX = e.clientX; lastY = e.clientY;
      plane.setPointerCapture(e.pointerId);
    }
  });
  plane.addEventListener('mousedown', e => {
    if (!active() || battle.classList.contains('touch-mode')) return;
    if (e.button === 0) { fire = true; pending.pressed = true; }
    if (e.button === 2) mouseAds = true;
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) fire = false;
    if (e.button === 2) mouseAds = false;
  });
  document.addEventListener('pointermove', e => {
    const locked = document.pointerLockElement === plane;
    if (!active() || (!locked && aimPointer !== e.pointerId)) return;
    const sensitivity = e.pointerType === 'touch' ? .0034 : .0023;
    pending.yaw -= (locked ? e.movementX : e.clientX - lastX) * sensitivity;
    pending.pitch -= (locked ? e.movementY : e.clientY - lastY) * sensitivity;
    lastX = e.clientX; lastY = e.clientY;
  });
  function stop(e: PointerEvent) {
    if (aimPointer === e.pointerId) aimPointer = null;
    if (e.pointerType === 'mouse') {
      fire = (e.buttons & 1) !== 0;
      mouseAds = (e.buttons & 2) !== 0;
    }
    if (shootPointer === e.pointerId) { shootPointer = null; fire = false; }
    if (movePointer === e.pointerId) { movePointer = null; mx = mz = 0; knob.style.transform = ''; }
  }
  document.addEventListener('pointerup', stop);
  document.addEventListener('pointercancel', stop);
  document.addEventListener('lostpointercapture', stop);
  function stickMove(e: PointerEvent) {
    const r = stick.getBoundingClientRect();
    const range = r.width * .32;
    const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    const dist = Math.max(range, Math.hypot(dx, dy));
    mx = dx / dist; mz = dy / dist;
    knob.style.transform = `translate(${mx * range}px,${mz * range}px)`;
  }
  stick.addEventListener('pointerdown', e => {
    if (!active() || movePointer !== null) return;
    e.preventDefault(); stick.setPointerCapture(e.pointerId); movePointer = e.pointerId; stickMove(e);
  });
  stick.addEventListener('pointermove', e => { if (movePointer === e.pointerId) stickMove(e); });
  for (const button of battle.querySelectorAll<HTMLButtonElement>('[data-action]')) {
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('pointerdown', e => {
      if (!active()) return;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      switch (button.dataset.action) {
        case 'fire': shootPointer = e.pointerId; fire = true; pending.pressed = true; break;
        case 'ads':
          touchAds = !touchAds; adsButton.setAttribute('aria-pressed', String(touchAds)); break;
        case 'reload': pending.reload = true; break;
        case 'jump': pending.jump = true; break;
        case 'grenade': pending.grenade = true; break;
        case 'slot': touchGun = touchGun === 1 ? 2 : 1; pending.slot = touchGun; break;
      }
    });
  }
  return {
    lock,
    reset(restart = false) {
      reset();
      if (restart) touchGun = 1;
    },
    unlock() { if (document.pointerLockElement === plane) document.exitPointerLock(); },
    poll(sensitivity: number): Input {
      const has = (...codes: string[]) => +codes.some(code => keys.has(code));
      const output = {
        ...pending,
        x: mx + has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft'),
        z: mz + has('KeyS', 'ArrowDown') - has('KeyW', 'ArrowUp'),
        yaw: pending.yaw * sensitivity, pitch: pending.pitch * sensitivity,
        fire, ads: mouseAds || touchAds, sprint: !!has('ShiftLeft', 'ShiftRight'),
        crouch: !!has('ControlLeft', 'ControlRight', 'KeyC'),
      };
      pending = blankInput();
      return output;
    },
  };
}
