import { CREW } from './crew.ts';
import { adjacent, makeMap, rng, SPAWNS, Tile, type Direction, type MapChoice } from './maps.ts';
import { decide, forecast, type Choice } from './ai.ts';

export const FUSE = 2.45;
export const BURN = 0.57;
export const ROUND_SECONDS = 150;
export type Item = 'bomb' | 'range' | 'speed';
export type Outcome = 'win' | 'loss' | 'draw';
export interface Actor {
  id: number;
  pilot: number;
  cell: number;
  to: number;
  progress: number;
  direction: Direction;
  alive: boolean;
  capacity: number;
  range: number;
  speed: number;
  score: number;
  kills: number;
  thinkAt: number;
}

export interface Bomb { cell: number; owner: number; range: number; at: number }
export interface Fire { until: number; owner: number }
export type GameEvent =
  | { type: 'plant'; actor: number; cell: number }
  | { type: 'blast'; cells: number[]; broken: number[]; origin: number }
  | { type: 'pickup'; actor: number; item: Item; cell: number }
  | { type: 'out'; actor: number; attacker: number; cell: number };

export const indexes = [0, 1, 2, 3] as const;
export const actorCell = (actor: Actor) => actor.to >= 0 && actor.progress >= 0.5 ? actor.to : actor.cell;

export function blastCells(tiles: Tile[], origin: number, range: number) {
  const cells = [origin];
  for (const direction of indexes) {
    let next = origin;
    for (let step = 0; step < range; step++) {
      next = adjacent(next, direction);
      const tile = tiles[next];
      if (next < 0 || tile === Tile.Wall) break;
      cells.push(next);
      if (tile === Tile.Crate) break;
    }
  }
  return cells;
}

export class Match {
  readonly arena;
  readonly tiles;
  readonly actors: Actor[];
  readonly bombs = new Map<number, Bomb>();
  readonly fire = new Map<number, Fire>();
  readonly items = new Map<number, Item>();
  readonly events: GameEvent[] = [];
  private readonly pendingItems = new Map<number, Item>();
  readonly random;
  readonly seed: number;
  time = 0;
  outcome: Outcome | null = null;

  constructor(seed: number, map: MapChoice, pilot: number) {
    this.seed = seed;
    this.random = rng(seed);
    const { tiles, arena } = makeMap(map, this.random);
    this.tiles = tiles;
    this.arena = arena;
    const order = [pilot, ...CREW.map((_, index) => index).filter(index => index !== pilot)];
    this.actors = SPAWNS.map((cell, id) => ({
      id, pilot: order[id], cell, to: -1, progress: 0, direction: id === 1 || id === 2 ? 3 : 1,
      alive: true, capacity: 1, range: 2, speed: id === 0 ? 5.65 : 4.25 + id * 0.17,
      score: 0, kills: 0, thinkAt: id * 0.18,
    }));
  }

  get player() { return this.actors[0]; }

  available(actor: Actor) {
    let available = actor.capacity;
    for (const bomb of this.bombs.values()) if (bomb.owner === actor.id) available--;
    return available;
  }

  walkable(cell: number) {
    return this.tiles[cell] === Tile.Floor && !this.bombs.has(cell);
  }

  plant(actor: Actor) {
    const cell = actorCell(actor);
    if (!actor.alive || !this.walkable(cell) || this.fire.has(cell) || this.available(actor) <= 0) return false;
    this.bombs.set(cell, { cell, owner: actor.id, range: actor.range, at: this.time + FUSE });
    this.events.push({ type: 'plant', actor: actor.id, cell });
    return true;
  }

  tick(delta: number, direction: Direction | null, plant: boolean) {
    if (this.outcome) return;
    this.time += delta;
    this.events.length = 0;
    for (const [cell, fire] of this.fire) {
      if (this.time < fire.until) continue;
      this.fire.delete(cell);
      const drop = this.pendingItems.get(cell);
      if (drop) this.items.set(cell, drop);
      this.pendingItems.delete(cell);
    }
    if (plant) this.plant(this.player);
    for (const bomb of this.bombs.values()) if (this.time >= bomb.at) this.explode(bomb);
    for (const actor of this.actors) this.checkCell(actor);
    for (const actor of this.actors) {
      if (!actor.alive) continue;
      let choice: Choice = { direction: null, plant: false };
      if (actor.id === 0) {
        choice.direction = direction;
      } else if (actor.to < 0 && this.time >= actor.thinkAt) {
        choice = decide(this, actor, forecast(this));
        actor.thinkAt = this.time + (choice.direction === null ? 0.12 : 0.04);
      }
      if (choice.plant) this.plant(actor);
      this.move(actor, choice.direction, delta);
      this.checkCell(actor);
    }
    const survivors = this.actors.filter(actor => actor.alive);
    if (!survivors.length) this.outcome = 'draw';
    else if (!this.player.alive) this.outcome = 'loss';
    else if (survivors.length === 1) this.outcome = 'win';
    else if (this.time >= ROUND_SECONDS) {
      const bestRival = Math.max(...survivors.slice(1).map(actor => actor.score));
      this.outcome = this.player.score === bestRival ? 'draw' : this.player.score > bestRival ? 'win' : 'loss';
    }
    if (this.outcome === 'win') this.player.score += 500;
  }

  private move(actor: Actor, direction: Direction | null, delta: number) {
    if (actor.to < 0 && direction !== null) {
      actor.direction = direction;
      const destination = adjacent(actor.cell, direction);
      if (this.walkable(destination)) actor.to = destination;
    }
    if (actor.to < 0) return;
    if (actor.progress > 0 && actor.progress < 0.5 && !this.walkable(actor.to)) {
      [actor.cell, actor.to] = [actor.to, actor.cell];
      actor.progress = 1 - actor.progress;
      actor.direction = ((actor.direction + 2) % 4) as Direction;
    }
    actor.progress += delta * actor.speed;
    if (actor.progress >= 1) {
      actor.cell = actor.to;
      actor.to = -1;
      actor.progress = 0;
    }
  }

  private checkCell(actor: Actor) {
    if (!actor.alive) return;
    const cell = actorCell(actor);
    const fire = this.fire.get(cell);
    if (fire) {
      actor.alive = false;
      if (fire.owner !== actor.id) {
        this.actors[fire.owner].score += 250;
        this.actors[fire.owner].kills++;
      }
      this.events.push({ type: 'out', actor: actor.id, attacker: fire.owner, cell });
      return;
    }
    const item = this.items.get(cell);
    if (!item) return;
    this.items.delete(cell);
    if (item === 'bomb') actor.capacity = Math.min(6, actor.capacity + 1);
    if (item === 'range') actor.range = Math.min(8, actor.range + 1);
    if (item === 'speed') actor.speed = Math.min(8.5, actor.speed + 0.62);
    actor.score += 35;
    this.events.push({ type: 'pickup', actor: actor.id, item, cell });
  }

  private explode(first: Bomb) {
    const queue = [first];
    const broken = new Set<number>();
    // All chained blasts see the same walls. Crates remain a barrier until the wave ends.
    for (const bomb of queue) {
      if (!this.bombs.delete(bomb.cell)) continue;
      const cells = blastCells(this.tiles, bomb.cell, bomb.range);
      const destroyed = [];
      for (const cell of cells) {
        const chained = this.bombs.get(cell);
        if (chained) queue.push(chained);
        if (!this.fire.has(cell)) this.fire.set(cell, { until: this.time + BURN, owner: bomb.owner });
        else this.fire.get(cell)!.until = this.time + BURN;
        if (this.tiles[cell] === Tile.Crate && !broken.has(cell)) {
          broken.add(cell);
          destroyed.push(cell);
          this.actors[bomb.owner].score += 20;
          if (this.random() < 0.59) {
            const options: Item[] = ['bomb', 'range', 'speed'];
            this.pendingItems.set(cell, options[Math.floor(this.random() * options.length)]);
          }
        }
        this.items.delete(cell);
      }
      this.events.push({ type: 'blast', cells, broken: destroyed, origin: bomb.cell });
    }
    for (const cell of broken) this.tiles[cell] = Tile.Floor;
  }
}
