import { Match } from './match';
import { type Actor, type Bomb, type Direction, type Point, DIRECTIONS, FIRE_TIME, FUSE, key, same, cellOf } from './types';

interface Hazard { starts: number; ends: number }
type Forecast = Map<number, Hazard[]>;
interface RouteNode extends Point { first: Direction | null; steps: number }

/** Fuse propagation includes chain reactions; callers never mutate the live match to predict a bomb. */
export function forecast(match: Match, extra?: Bomb): Forecast {
  const result: Forecast = new Map();
  const bombs = extra ? [...match.bombs, extra] : match.bombs;
  const times = bombs.map(b => b.explodesAt);
  for (let pass = 0; pass < bombs.length; pass++) {
    let changed = false;
    bombs.forEach((bomb, i) => {
      const cells = match.blastCells(bomb);
      bombs.forEach((other, j) => {
        if (times[j] > times[i] && cells.some(c => same(c, other))) { times[j] = times[i]; changed = true; }
      });
    });
    if (!changed) break;
  }
  const add = (p: Point, starts: number, ends: number) => {
    const index = key(p.x, p.y);
    result.set(index, [...(result.get(index) ?? []), { starts, ends }]);
  };
  bombs.forEach((bomb, i) => match.blastCells(bomb).forEach(p => add(p, times[i], times[i] + FIRE_TIME)));
  match.flames.forEach(f => add(f, match.time, f.expiresAt));
  return result;
}

const unsafe = (hazards: Forecast, p: Point, from: number, to: number) =>
  hazards.get(key(p.x, p.y))?.some(h => h.starts <= to && h.ends >= from) ?? false;

function search(match: Match, actor: Actor, hazards: Forecast, goal: (p: RouteNode) => boolean, extra?: Point): RouteNode | null {
  const start = cellOf(actor);
  const queue: RouteNode[] = [{ ...start, first: null, steps: 0 }];
  const seen = new Set([key(start.x, start.y)]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (goal(current)) return current;
    if (current.steps >= 14) continue;
    for (const [direction, delta] of Object.entries(DIRECTIONS) as [Direction, Point][]) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      if (seen.has(key(next.x, next.y)) || !match.walkable(next.x, next.y) || (extra && same(next, extra))) continue;
      const arrival = match.time + (current.steps + 1) * match.stepTime(actor);
      if (unsafe(hazards, next, arrival - match.stepTime(actor) / 2, arrival + 250)) continue;
      // Cannot travel out of a square after its explosion has reached the actor.
      if (unsafe(hazards, current, arrival - match.stepTime(actor), arrival - match.stepTime(actor) / 2)) continue;
      seen.add(key(next.x, next.y));
      queue.push({ ...next, first: current.first ?? direction, steps: current.steps + 1 });
    }
  }
  return null;
}

export class Brain {
  private nextThink = 0;
  private nextBomb = 1800;
  private direction: Direction | null = null;
  constructor(readonly id: number) { this.nextBomb += id * 450; }

  update(match: Match) {
    const actor = match.actors[this.id];
    if (!actor.alive || actor.target || match.ended) return;
    if (match.time < this.nextThink) return;
    this.nextThink = match.time + (match.options.difficulty === 'hard' ? 65 : 120);
    const hazards = forecast(match);
    const position = cellOf(actor);
    if (unsafe(hazards, position, match.time, match.time + FUSE)) {
      const escape = search(match, actor, hazards, p => p.steps > 0 && !unsafe(hazards, p, match.time, match.time + FUSE + FIRE_TIME));
      if (escape?.first) match.move(actor.id, escape.first);
      return;
    }
    const hypothetical: Bomb = { ...position, id: -1, owner: actor.id, range: actor.range, explodesAt: match.time + FUSE };
    const blast = match.blastCells(hypothetical);
    const targets = blast.some(p => match.at(p.x, p.y) === 'crate' || match.actors.some(a => a.alive && a.id !== actor.id && same(cellOf(a), p)));
    if (targets && match.time >= this.nextBomb) {
      const future = forecast(match, hypothetical);
      const escape = search(match, actor, future, p => p.steps > 0 && !unsafe(future, p, match.time, match.time + FUSE + FIRE_TIME), position);
      if (escape?.first && match.place(actor.id)) {
        this.nextBomb = match.time + (match.options.difficulty === 'hard' ? 1800 : 2600);
        match.move(actor.id, escape.first);
        return;
      }
    }
    const power = search(match, actor, hazards, p => match.drops.some(d => same(d, p) && d.availableAt <= match.time));
    if (power?.first) { match.move(actor.id, power.first); return; }
    const attack = search(match, actor, hazards, p => p.steps > 0 && Object.values(DIRECTIONS).some(d => {
      const next = { x: p.x + d.x, y: p.y + d.y };
      return match.at(next.x, next.y) === 'crate' || match.actors.some(a => a.alive && a.id !== actor.id && same(cellOf(a), next));
    }));
    if (attack?.first) { this.direction = attack.first; match.move(actor.id, attack.first); return; }
    const possible = (Object.keys(DIRECTIONS) as Direction[]).filter(d => {
      const next = { x: position.x + DIRECTIONS[d].x, y: position.y + DIRECTIONS[d].y };
      return match.walkable(next.x, next.y) && !unsafe(hazards, next, match.time, match.time + 700);
    });
    const direction = this.direction && possible.includes(this.direction) && match.random() < 0.6
      ? this.direction : possible[Math.floor(match.random() * possible.length)];
    if (direction) { this.direction = direction; match.move(actor.id, direction); }
  }
}
