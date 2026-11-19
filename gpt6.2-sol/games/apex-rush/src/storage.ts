import type { Difficulty, Mode } from './race.ts';
import type { CarSpec, Course } from './track.ts';
import type { Quality } from './render/view.ts';

const prefix = 'sol-apex-rush.v1.';
export type Options = { muted: boolean; quality: Quality; autoGas: boolean };

const store = new Map<string, string>();
function read(key: string) {
  try { return store.get(key) ?? localStorage.getItem(prefix + key); }
  catch { return store.get(key); }
}
function write(key: string, value: string) {
  store.set(key, value);
  try {
    localStorage.setItem(prefix + key, value);
    return true;
  } catch { return false; }
}

export function loadOptions(touch: boolean): Options {
  try {
    const data = JSON.parse(read('options') ?? '{}');
    return {
      muted: data?.muted === true,
      quality: data?.quality === 'low' || data?.quality === 'high' ? data.quality : touch ? 'low' : 'high',
      autoGas: typeof data?.autoGas === 'boolean' ? data.autoGas : touch,
    };
  } catch {
    return { muted: false, quality: touch ? 'low' : 'high', autoGas: touch };
  }
}
export const saveOptions = (options: Options) => write('options', JSON.stringify(options));

function key(track: Course, car: CarSpec, mode: Mode, difficulty: Difficulty) {
  return ['best', track.id, car.id, mode, mode === 'race' ? difficulty : 'solo'].join('.');
}
export function bestTime(track: Course, car: CarSpec, mode: Mode, difficulty: Difficulty) {
  const raw = read(key(track, car, mode, difficulty));
  const time = Number(raw);
  return Number.isFinite(time) && time > 0 ? time : null;
}
export function recordTime(track: Course, car: CarSpec, mode: Mode, difficulty: Difficulty, time: number) {
  if (!Number.isFinite(time) || time <= 0) return 'none';
  if ((bestTime(track, car, mode, difficulty) ?? Infinity) <= time) return 'same';
  return write(key(track, car, mode, difficulty), String(time)) ? 'best' : 'temporary';
}
