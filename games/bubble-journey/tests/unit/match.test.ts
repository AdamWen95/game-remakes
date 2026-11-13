import { describe, expect, test } from 'vitest';
import { Match } from '../../src/game/match';
import { Brain, forecast } from '../../src/game/ai';
import { generateMap, SPAWNS } from '../../src/game/map';
import { COLS, ROWS, FUSE, FIRE_TIME, key, cellOf, type Power } from '../../src/game/types';

const options = { seed: 15237, theme: 0, character: 0, duration: 180, difficulty: 'normal' as const };
function openMatch() {
  const match = new Match(options);
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) match.cells[key(x, y)] = 'floor';
  return match;
}
function tick(match: Match, duration: number) { for (let t = 0; t < duration; t += 10) match.tick(Math.min(10, duration - t)); }

describe('map generation', () => {
  test('same seed reproduces map; different seeds change crates', () => {
    expect(generateMap(34, 0)).toEqual(generateMap(34, 0));
    expect(generateMap(34, 0)).not.toEqual(generateMap(35, 0));
  });
  test.each([0, 1, 2])('theme %i preserves boundaries and safe spawn exits over 100 seeds', theme => {
    for (let seed = 0; seed < 100; seed++) {
      const map = generateMap(seed, theme);
      for (let x = 0; x < COLS; x++) { expect(map[key(x, 0)]).toBe('wall'); expect(map[key(x, ROWS - 1)]).toBe('wall'); }
      for (const p of SPAWNS) {
        const dx = p.x === 1 ? 1 : -1, dy = p.y === 1 ? 1 : -1;
        for (const [x, y] of [[0, 0], [1, 0], [2, 0], [2, 1], [0, 1], [0, 2], [1, 2]]) expect(map[key(p.x + x * dx, p.y + y * dy)]).toBe('floor');
      }
    }
  });
});
describe('movement and bombs', () => {
  test('solid walls prevent movement; stepping completes exactly on the grid', () => {
    const m = openMatch(); expect(m.move(0, 'left')).toBe(false); expect(m.move(0, 'right')).toBe(true);
    tick(m, 210); expect(m.actors[0].x).toBe(2); expect(m.actors[0].target).toBeNull();
  });
  test('owner can leave a bomb but cannot reenter; capacity cannot be exceeded', () => {
    const m = openMatch(); expect(m.place(0)).toBe(true); expect(m.place(0)).toBe(false);
    m.move(0, 'right'); tick(m, 210); expect(m.move(0, 'left')).toBe(false); expect(m.place(0)).toBe(false);
  });
  test('bomb placement is safe while moving between two cells', () => {
    const m = openMatch(); m.move(0, 'right'); tick(m, 120); expect(m.place(0)).toBe(true);
    expect(m.bombs[0].x).toBe(2); tick(m, 100); expect(m.actors[0].x).toBe(2);
    expect(m.move(0, 'right')).toBe(true);
  });
  test('blast is a cross with range limits, never diagonals', () => {
    const m = openMatch(); m.actors[0].x = 5; m.actors[0].y = 5; m.place(0);
    const cells = m.blastCells(m.bombs[0]); expect(cells).toHaveLength(9);
    expect(cells).toContainEqual({ x: 7, y: 5 }); expect(cells).not.toContainEqual({ x: 6, y: 6 });
  });
  test('wall stops blast; crate is destroyed and shields cells behind it', () => {
    const m = openMatch(); m.actors[0].x = 5; m.actors[0].y = 5; m.actors[0].range = 5;
    m.cells[key(6, 5)] = 'crate'; m.cells[key(5, 4)] = 'wall'; m.place(0); m.actors[0].y = 8;
    tick(m, FUSE); expect(m.at(6, 5)).toBe('floor'); expect(m.at(5, 4)).toBe('wall');
    expect(m.flames.some(f => f.x === 7 && f.y === 5)).toBe(false);
    expect(m.flames.some(f => f.x === 5 && f.y === 3)).toBe(false);
    expect(m.actors[0].score).toBe(10);
  });
  test('chain reaction detonates once and returns bomb capacity', () => {
    const m = openMatch(); m.actors[0].x = 5; m.actors[0].y = 5; m.actors[0].capacity = 2; m.place(0);
    tick(m, 500); m.actors[0].x = 7; m.place(0); m.actors[0].x = 10; m.actors[0].y = 9;
    tick(m, FUSE - 500); expect(m.bombs).toHaveLength(0);
    expect(m.drainEvents().filter(e => e.type === 'explode')).toHaveLength(2); expect(m.place(0)).toBe(true);
  });
  test('chain forecast propagates earliest fuse without changing live bombs', () => {
    const m = openMatch(); m.bombs = [{ id: 1, owner: 0, x: 3, y: 3, range: 3, explodesAt: 400 }, { id: 2, owner: 1, x: 5, y: 3, range: 2, explodesAt: 2000 }];
    const hazards = forecast(m); expect(hazards.get(key(5, 5))?.[0].starts).toBe(400); expect(m.bombs[1].explodesAt).toBe(2000);
  });
});
describe('elimination and scoring', () => {
  test('same-tick full elimination is draw rather than arbitrary victory', () => {
    const m = openMatch(); m.actors.forEach(a => { a.x = 5; a.y = 5; }); m.place(0); tick(m, FUSE);
    expect(m.ended).toBe(true); expect(m.winner).toBeNull(); expect(m.actors.filter(a => a.alive)).toHaveLength(0);
  });
  test('opponent kill earns 200; self elimination gives no kill points', () => {
    const m = openMatch(); m.actors[1].x = 2; m.actors[1].y = 1; m.place(0); tick(m, FUSE);
    expect(m.actors[0].kills).toBe(1); expect(m.actors[0].score).toBe(200);
  });
  test('last survivor wins and end event is emitted only once', () => {
    const m = openMatch(); m.actors.slice(1).forEach(a => { a.alive = false; }); tick(m, 1000);
    expect(m.winner).toBe(0); expect(m.actors[0].score).toBe(500);
    expect(m.drainEvents().filter(e => e.type === 'end')).toHaveLength(1);
  });
  test('timeout compares only living players, with ties as a draw', () => {
    const m = openMatch(); m.time = 179999; m.actors[0].score = 1000; m.actors[0].alive = false; m.actors[1].score = 10;
    m.tick(1); expect(m.winner).toBe(1); expect(m.actors[1].score).toBe(510);
    const draw = openMatch(); draw.time = 179999; draw.tick(1); expect(draw.winner).toBeNull(); expect(draw.ended).toBe(true);
  });
  test('flames expire and eliminated actors can no longer move or plant', () => {
    const m = openMatch(); m.place(0); tick(m, FUSE); expect(m.actors[0].alive).toBe(false);
    expect(m.move(0, 'right')).toBe(false); expect(m.place(0)).toBe(false);
    tick(m, FIRE_TIME); expect(m.flames).toHaveLength(0);
  });
});
describe('power-ups', () => {
  test.each<Power>(['bomb', 'range', 'speed'])('%s drops respect availability and maximum levels', kind => {
    const m = openMatch(); const a = m.actors[0];
    a.capacity = 5; a.range = 7; a.speed = 4;
    m.drops = [{ x: 1, y: 1, kind, availableAt: 100 }]; m.tick(50); expect(m.drops).toHaveLength(1);
    m.tick(50); expect(m.drops).toHaveLength(0); expect(a.score).toBe(25);
    expect([a.capacity, a.range, a.speed]).toEqual([5, 7, 4]);
  });
  test('future drop from destroyed box survives its producing explosion', () => {
    const m = openMatch(); m.cells[key(2, 1)] = 'crate';
    m.drops = [{ x: 2, y: 1, kind: 'range', availableAt: FUSE + FIRE_TIME }];
    m.place(0); m.actors[0].y = 5; tick(m, FUSE);
    expect(m.drops.some(d => d.availableAt === FUSE + FIRE_TIME)).toBe(true);
  });
});
describe('AI behavior', () => {
  test('escapes an imminent cross blast using a turning route', () => {
    const m = openMatch(); const bot = new Brain(1); m.actors[1].x = 5; m.actors[1].y = 5;
    m.bombs = [{ id: 1, owner: 0, x: 5, y: 5, range: 3, explodesAt: 1000 }];
    for (let t = 0; t < 1200; t += 10) { bot.update(m); m.tick(10); }
    expect(m.actors[1].alive).toBe(true); expect(cellOf(m.actors[1])).not.toEqual({ x: 5, y: 5 });
  });
  test('refuses to plant when trapped without a safe exit', () => {
    const m = openMatch(); const bot = new Brain(1); m.actors[1].x = 5; m.actors[1].y = 5; m.time = 4000;
    for (const [x, y] of [[4, 5], [6, 5], [5, 4], [5, 6]]) m.cells[key(x, y)] = 'crate';
    bot.update(m); expect(m.bombs).toHaveLength(0);
  });
  test('targets a reachable power-up using pathfinding', () => {
    const m = openMatch(); const bot = new Brain(1); m.actors[1].x = 5; m.actors[1].y = 5;
    m.drops = [{ x: 7, y: 5, kind: 'speed', availableAt: 0 }];
    for (let t = 0; t < 500; t += 10) { bot.update(m); m.tick(10); }
    expect(m.actors[1].speed).toBe(1);
  });
  test('30 seeded full matches terminate and bots actively destroy crates', () => {
    let destroyed = 0, planted = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const m = new Match({ ...options, seed, theme: seed % 3, duration: 120 }); const brains = m.actors.map(a => new Brain(a.id));
      for (let step = 0; step < 7500 && !m.ended; step++) {
        brains.forEach(b => b.update(m)); m.tick(1000 / 60);
        m.drainEvents().forEach(e => { if (e.type === 'place') planted++; });
        expect(m.actors.every(a => Number.isFinite(a.x) && Number.isFinite(a.y))).toBe(true);
      }
      expect(m.ended).toBe(true); destroyed += m.actors.reduce((n, a) => n + a.boxes, 0);
    }
    expect(destroyed).toBeGreaterThan(300); expect(planted).toBeGreaterThan(400);
  });
});
