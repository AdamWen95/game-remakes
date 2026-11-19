import { adjacent, distance, Tile, type Direction } from './maps.ts';
import { actorCell, blastCells, BURN, FUSE, indexes, type Actor, type Bomb, type Match } from './rules.ts';

export interface Choice { direction: Direction | null; plant: boolean }
type Window = [number, number];
type Danger = Map<number, Window[]>;
interface Step { cell: number; steps: number; first: Direction | null }

export function forecast(match: Match, extra?: Bomb): Danger {
  const danger: Danger = new Map();
  for (const [cell, fire] of match.fire) danger.set(cell, [[match.time, fire.until]]);
  const bombs = [...match.bombs.values()];
  if (extra) bombs.push(extra);
  const tiles = match.tiles.slice();
  const pending = new Map(bombs.map(bomb => [bomb.cell, bomb]));
  const schedule = bombs.sort((a, b) => a.at - b.at);
  for (const next of schedule) {
    if (!pending.has(next.cell)) continue;
    const queue = [next];
    const broken = new Set<number>();
    for (const bomb of queue) {
      if (!pending.delete(bomb.cell)) continue;
      for (const cell of blastCells(tiles, bomb.cell, bomb.range)) {
        const windows = danger.get(cell) ?? [];
        windows.push([next.at, next.at + BURN]);
        danger.set(cell, windows);
        const chained = pending.get(cell);
        if (chained) queue.push(chained);
        if (tiles[cell] === Tile.Crate) broken.add(cell);
      }
    }
    for (const cell of broken) tiles[cell] = Tile.Floor;
  }
  return danger;
}

function safe(danger: Danger, cell: number, from: number, to: number) {
  return !danger.get(cell)?.some(([start, end]) => start <= to && end >= from);
}

function paths(match: Match, actor: Actor, danger: Danger, limit = 10) {
  const steps: Step[] = [{ cell: actor.cell, steps: 0, first: null }];
  const seen = new Set([actor.cell]);
  const perStep = 1 / (actor.speed * 0.93);
  for (const step of steps) {
    if (step.steps >= limit) continue;
    for (const offset of indexes) {
      const direction = ((offset + actor.id) % 4) as Direction;
      const cell = adjacent(step.cell, direction);
      if (seen.has(cell) || !match.walkable(cell)) continue;
      const depart = match.time + step.steps * perStep;
      const middle = depart + perStep * 0.48;
      const arrival = depart + perStep;
      if (!safe(danger, step.cell, depart, middle) || !safe(danger, cell, middle - 0.03, arrival + 0.08)) continue;
      seen.add(cell);
      steps.push({ cell, steps: step.steps + 1, first: step.first ?? direction });
    }
  }
  return steps;
}

function escape(match: Match, actor: Actor, danger: Danger) {
  return paths(match, actor, danger, 9).find(step => step.first !== null && safe(danger, step.cell, match.time + step.steps / actor.speed, match.time + FUSE + BURN + 0.2));
}

export function decide(match: Match, actor: Actor, danger: Danger): Choice {
  if (!safe(danger, actor.cell, match.time, match.time + 1.55)) {
    const refuge = escape(match, actor, danger);
    if (refuge) return { direction: refuge.first, plant: false };
    const fallback = paths(match, actor, danger, 5).slice(1).sort((a, b) => {
      const deadline = (cell: number) => danger.get(cell)?.find(([, end]) => end > match.time)?.[0] ?? Infinity;
      return deadline(b.cell) - deadline(a.cell);
    })[0];
    return { direction: fallback?.first ?? null, plant: false };
  }

  const rivals = match.actors.filter(other => other.id !== actor.id && other.alive).map(actorCell);
  const targetDistance = (cell: number) => Math.min(...rivals.map(rival => distance(cell, rival)));
  const blast = blastCells(match.tiles, actor.cell, actor.range);
  const crateInRange = blast.some(cell => match.tiles[cell] === Tile.Crate);
  const rivalInRange = rivals.some(target => blast.includes(target));
  if (match.available(actor) > 0 && !match.bombs.has(actor.cell) && (crateInRange || rivalInRange)) {
    const hypothetical = { cell: actor.cell, owner: actor.id, range: actor.range, at: match.time + FUSE };
    const refuge = escape(match, actor, forecast(match, hypothetical));
    if (refuge) return { direction: refuge.first, plant: true };
  }

  let best: Step | undefined;
  let bestValue = -Infinity;
  for (const step of paths(match, actor, danger).slice(1)) {
    const arrive = match.time + step.steps / actor.speed;
    if (!safe(danger, step.cell, arrive, arrive + 0.6)) continue;
    const improvement = targetDistance(actor.cell) - targetDistance(step.cell);
    const crate = indexes.some(dir => match.tiles[adjacent(step.cell, dir)] === Tile.Crate);
    const item = match.items.has(step.cell);
    const value = (item ? 11 : 0) + (crate && match.available(actor) ? 2.8 : 0) + improvement * 1.05 - step.steps * 0.48 +
      (step.first === actor.direction ? 0.38 : 0) + match.random() * 0.42;
    if (value <= bestValue) continue;
    best = step;
    bestValue = value;
  }
  return { direction: best?.first ?? null, plant: false };
}
