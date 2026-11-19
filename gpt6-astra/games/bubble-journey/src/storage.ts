import type { Match } from './game/match';

export interface RecordEntry { date: string; score: number; win: boolean; draw: boolean; kills: number; theme: number; character: number }
export interface SaveData { version: 1; character: number; theme: number; muted: boolean; music: boolean; played: number; wins: number; best: number; records: RecordEntry[] }
const defaults = (): SaveData => ({ version: 1, character: 0, theme: 0, muted: false, music: true, played: 0, wins: 0, best: 0, records: [] });
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export class Storage {
  data = defaults();
  available = true;
  constructor() {
    try {
      const parsed = JSON.parse(localStorage.getItem('bubble-journey-v1') ?? 'null');
      if (parsed?.version === 1) {
        for (const prop of ['played', 'wins', 'best'] as const) if (finite(parsed[prop])) this.data[prop] = Math.floor(parsed[prop]);
        if (Number.isInteger(parsed.character) && parsed.character >= 0 && parsed.character < 4) this.data.character = parsed.character;
        if (Number.isInteger(parsed.theme) && parsed.theme >= 0 && parsed.theme < 3) this.data.theme = parsed.theme;
        if (typeof parsed.muted === 'boolean') this.data.muted = parsed.muted;
        if (typeof parsed.music === 'boolean') this.data.music = parsed.music;
        if (Array.isArray(parsed.records)) this.data.records = parsed.records.filter((r: RecordEntry) =>
          r && finite(r.score) && finite(r.kills) && Number.isInteger(r.theme) && r.theme >= 0 && r.theme < 3 && Number.isInteger(r.character) && r.character >= 0 && r.character < 4 && typeof r.win === 'boolean' && typeof r.draw === 'boolean' && typeof r.date === 'string' && !Number.isNaN(Date.parse(r.date))).slice(0, 20);
      }
    } catch { this.available = false; }
  }
  save() { try { localStorage.setItem('bubble-journey-v1', JSON.stringify(this.data)); } catch { this.available = false; } }
  record(match: Match) {
    const player = match.actors[0]; const win = match.winner === 0;
    this.data.played++; if (win) this.data.wins++;
    this.data.best = Math.max(this.data.best, player.score);
    this.data.records.unshift({ date: new Date().toISOString(), score: player.score, win, draw: match.winner === null, kills: player.kills, theme: match.options.theme, character: player.character });
    this.data.records = this.data.records.slice(0, 20); this.save();
  }
}
