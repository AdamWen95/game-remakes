import { afterEach, describe, expect, test, vi } from 'vitest';
import { Controls } from '../../src/game/input';

function fixture() {
  const target = new EventTarget() as EventTarget & { matches: () => boolean };
  target.matches = () => false;
  vi.stubGlobal('window', target);
  vi.stubGlobal('document', { querySelectorAll: () => [] });
  const place = vi.fn(), pause = vi.fn();
  const controls = new Controls(place, pause); controls.enabled = true;
  const press = (type: string, code: string, repeat = false) => {
    const event = new Event(type, { cancelable: true }); Object.assign(event, { code, repeat }); target.dispatchEvent(event); return event;
  };
  return { controls, place, pause, press, target };
}
afterEach(() => vi.unstubAllGlobals());
describe('input lifecycle', () => {
  test('Escape consumes the native cancel action, avoiding instant dialog close', () => {
    const { controls, press, pause } = fixture();
    expect(press('keydown', 'Escape').defaultPrevented).toBe(true);
    press('keydown', 'Escape', true); expect(pause).toHaveBeenCalledTimes(1); controls.dispose();
  });
  test('a short key press between simulation frames is consumed exactly once', () => {
    const { controls, press } = fixture();
    press('keydown', 'KeyD'); press('keyup', 'KeyD');
    expect(controls.consumeDirection()).toBe('right'); expect(controls.consumeDirection()).toBeNull();
    controls.dispose();
  });
  test('holding a direction continues movement; blur clears held and queued inputs', () => {
    const { controls, press, target } = fixture();
    press('keydown', 'ArrowDown'); expect(controls.consumeDirection()).toBe('down'); expect(controls.consumeDirection()).toBe('down');
    target.dispatchEvent(new Event('blur')); expect(controls.consumeDirection()).toBeNull(); controls.dispose();
  });
  test('space autorepeat never spams bombs and disabled input cannot act', () => {
    const { controls, press, place } = fixture();
    press('keydown', 'Space'); press('keydown', 'Space', true); expect(place).toHaveBeenCalledTimes(1);
    controls.enabled = false; press('keydown', 'Space'); expect(place).toHaveBeenCalledTimes(1); controls.dispose();
  });
  test('disposal removes keyboard listeners', () => {
    const { controls, press, place } = fixture(); controls.dispose(); press('keydown', 'Space'); expect(place).not.toHaveBeenCalled();
  });
});
