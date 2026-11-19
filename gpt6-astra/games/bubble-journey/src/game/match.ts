import { generateMap, SPAWNS } from './map';
import { type Actor, type Bomb, type Cell, type Direction, type Drop, type Flame, type GameEvent, type MatchOptions, type Point, type Power, DIRECTIONS, FUSE, FIRE_TIME, key, inside, same, cellOf, randomGenerator } from './types';

export class Match {
  readonly options: MatchOptions;
  cells: Cell[];
  actors: Actor[];
  bombs: Bomb[] = [];
  flames: Flame[] = [];
  drops: Drop[] = [];
  events: GameEvent[] = [];
  time = 0;
  ended = false;
  winner: number | null = null;
  reason: 'survivor' | 'timeout' | 'draw' = 'draw';
  private nextBomb = 1;
  readonly random: () => number;

  constructor(options: MatchOptions) {
    this.options = options;
    this.cells = generateMap(options.seed, options.theme);
    this.random = randomGenerator(options.seed + 17);
    this.actors = SPAWNS.map((p, id) => ({
      ...p, id, character: (options.character + id) % 4,
      name: id === 0 ? '你' : ['糯米', '小莓', '阿栗'][id - 1],
      alive: true, target: null, facing: 'down', capacity: 1, range: 2, speed: 0,
      score: 0, kills: 0, boxes: 0, eliminatedAt: null,
    }));
  }

  get remaining() { return Math.max(0, this.options.duration * 1000 - this.time); }
  at(x: number, y: number): Cell { return inside(x, y) ? this.cells[key(x, y)] : 'wall'; }
  bombAt(x: number, y: number) { return this.bombs.find(b => b.x === x && b.y === y); }
  walkable(x: number, y: number) { return this.at(x, y) === 'floor' && !this.bombAt(x, y); }
  stepTime(actor: Actor) { return 205 - actor.speed * 23; }

  move(id: number, direction: Direction): boolean {
    const actor = this.actors[id];
    if (this.ended || !actor?.alive || actor.target) return false;
    const delta = DIRECTIONS[direction];
    const next = { x: actor.x + delta.x, y: actor.y + delta.y };
    actor.facing = direction;
    if (!this.walkable(next.x, next.y)) return false;
    actor.target = next;
    return true;
  }

  place(id: number): boolean {
    const actor = this.actors[id];
    if (this.ended || !actor?.alive || this.bombs.filter(b => b.owner === id).length >= actor.capacity) return false;
    const position = cellOf(actor);
    if (this.bombAt(position.x, position.y) || this.at(position.x, position.y) !== 'floor') return false;
    const bomb = { ...position, id: this.nextBomb++, owner: id, range: actor.range, explodesAt: this.time + FUSE };
    this.bombs.push(bomb);
    this.events.push({ type: 'place', bomb });
    return true;
  }

  blastCells(bomb: Bomb): Point[] {
    const cells: Point[] = [{ x: bomb.x, y: bomb.y }];
    for (const d of Object.values(DIRECTIONS)) {
      for (let distance = 1; distance <= bomb.range; distance++) {
        const p = { x: bomb.x + d.x * distance, y: bomb.y + d.y * distance };
        if (this.at(p.x, p.y) === 'wall') break;
        cells.push(p);
        if (this.at(p.x, p.y) === 'crate' || this.bombAt(p.x, p.y)) break;
      }
    }
    return cells;
  }

  tick(dt: number) {
    if (this.ended) return;
    this.time += dt;
    this.flames = this.flames.filter(f => f.expiresAt > this.time);
    for (const actor of this.actors) {
      if (!actor.alive || !actor.target) continue;
      const distance = Math.abs(actor.target.x - actor.x) + Math.abs(actor.target.y - actor.y);
      const step = Math.min(distance, dt / this.stepTime(actor));
      actor.x += Math.sign(actor.target.x - actor.x) * step;
      actor.y += Math.sign(actor.target.y - actor.y) * step;
      if (distance <= step + 0.0001) { actor.x = actor.target.x; actor.y = actor.target.y; actor.target = null; }
    }
    const due = this.bombs.filter(b => b.explodesAt <= this.time || this.flames.some(f => same(f, b)));
    for (const bomb of due) this.explode(bomb.id);
    // All blasts settle before survivor evaluation, so simultaneous eliminations are a draw.
    for (const actor of this.actors) {
      if (!actor.alive) continue;
      const pos = cellOf(actor);
      const flame = this.flames.find(f => same(f, pos));
      if (flame) {
        actor.alive = false; actor.target = null; actor.eliminatedAt = this.time;
        const owner = this.actors[flame.owner];
        if (owner && owner.id !== actor.id) { owner.score += 200; owner.kills++; }
        this.events.push({ type: 'death', actor: actor.id, ...pos });
        continue;
      }
      const drop = this.drops.find(d => same(d, pos) && d.availableAt <= this.time);
      if (drop) {
        if (drop.kind === 'bomb') actor.capacity = Math.min(5, actor.capacity + 1);
        if (drop.kind === 'range') actor.range = Math.min(7, actor.range + 1);
        if (drop.kind === 'speed') actor.speed = Math.min(4, actor.speed + 1);
        actor.score += 25;
        this.drops = this.drops.filter(d => d !== drop);
        this.events.push({ type: 'pickup', actor: actor.id, kind: drop.kind });
      }
    }
    const survivors = this.actors.filter(a => a.alive);
    if (survivors.length <= 1) this.finish(survivors[0]?.id ?? null, survivors.length ? 'survivor' : 'draw');
    else if (this.remaining <= 0) {
      const sorted = [...survivors].sort((a, b) => b.score - a.score);
      const winner = sorted[0].score > sorted[1].score ? sorted[0].id : null;
      this.finish(winner, winner === null ? 'draw' : 'timeout');
    }
  }

  private explode(id: number) {
    const bomb = this.bombs.find(b => b.id === id);
    if (!bomb) return;
    const affected = this.blastCells(bomb);
    this.bombs = this.bombs.filter(b => b.id !== id);
    const chain: number[] = [];
    for (const cell of affected) {
      const other = this.bombAt(cell.x, cell.y);
      if (other) chain.push(other.id);
      this.drops = this.drops.filter(d => !same(d, cell) || d.availableAt > this.time);
      if (this.at(cell.x, cell.y) === 'crate') {
        this.cells[key(cell.x, cell.y)] = 'floor';
        const actor = this.actors[bomb.owner];
        actor.score += 10; actor.boxes++;
        this.events.push({ type: 'break', ...cell });
        if (this.random() < 0.48) {
          const kind = (['bomb', 'range', 'speed'] as Power[])[Math.floor(this.random() * 3)];
          this.drops.push({ ...cell, kind, availableAt: this.time + FIRE_TIME });
        }
      }
      this.flames.push({ ...cell, owner: bomb.owner, expiresAt: this.time + FIRE_TIME });
    }
    this.events.push({ type: 'explode', cells: affected });
    // Each bomb is removed before recursion; chain reaction depth is bounded by actor capacities.
    for (const other of chain) this.explode(other);
  }

  private finish(winner: number | null, reason: 'survivor' | 'timeout' | 'draw') {
    this.ended = true; this.winner = winner; this.reason = reason;
    if (winner !== null) this.actors[winner].score += 500;
    this.events.push({ type: 'end', winner, reason });
  }

  drainEvents() { const events = this.events; this.events = []; return events; }
}
