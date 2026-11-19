export const COLS = 15;
export const ROWS = 13;
export const TILE = 48;
export const FUSE = 2400;
export const FIRE_TIME = 560;
export type Cell = 'floor' | 'wall' | 'crate';
export type Power = 'bomb' | 'range' | 'speed';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Phase = 'lobby' | 'countdown' | 'playing' | 'paused' | 'ended';
export interface Point { x: number; y: number }
export const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
export interface Actor extends Point {
  id: number; character: number; name: string; alive: boolean; facing: Direction;
  target: Point | null; capacity: number; range: number; speed: number;
  score: number; kills: number; boxes: number; eliminatedAt: number | null;
}
export interface Bomb extends Point { id: number; owner: number; range: number; explodesAt: number }
export interface Flame extends Point { owner: number; expiresAt: number }
export interface Drop extends Point { kind: Power; availableAt: number }
export interface MatchOptions { seed: number; theme: number; character: number; duration: number; difficulty: 'normal' | 'hard' }
export type GameEvent =
  | { type: 'place'; bomb: Bomb }
  | { type: 'explode'; cells: Point[] }
  | { type: 'break'; x: number; y: number }
  | { type: 'pickup'; actor: number; kind: Power }
  | { type: 'death'; actor: number; x: number; y: number }
  | { type: 'end'; winner: number | null; reason: 'survivor' | 'timeout' | 'draw' };
export const key = (x: number, y: number) => y * COLS + x;
export const cellOf = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
export function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
