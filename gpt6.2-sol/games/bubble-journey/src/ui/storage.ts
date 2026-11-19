import { MAPS, type MapChoice } from '../game/maps.ts';

const key = 'bubble-circuit-v1';
export interface Settings { pilot: number; map: MapChoice; muted: boolean; best: number; wins: number }

export function load(): Settings {
  const defaults: Settings = { pilot: 0, map: 'random', muted: false, best: 0, wins: 0 };
  try {
    const item = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Settings> | null;
    if (!item) return defaults;
    return {
      pilot: Number.isInteger(item.pilot) && item.pilot! >= 0 && item.pilot! < 4 ? item.pilot! : 0,
      map: MAPS.some(map => map.id === item.map) ? item.map! : 'random',
      muted: item.muted === true,
      best: Number.isSafeInteger(item.best) && item.best! >= 0 ? item.best! : 0,
      wins: Number.isSafeInteger(item.wins) && item.wins! >= 0 ? item.wins! : 0,
    };
  } catch { return defaults; }
}

export function save(settings: Settings) {
  try { localStorage.setItem(key, JSON.stringify(settings)); } catch { /* Browser storage is optional for offline play. */ }
}
