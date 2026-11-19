import Phaser from 'phaser';
import { drawPilot } from '../art/pilots.ts';
import { drawBomb, drawCrate, drawGround, drawItem, drawWall } from '../art/tiles.ts';
import { CREW } from './crew.ts';
import { CELL, HEIGHT, WIDTH, col, row, Tile, type Direction } from './maps.ts';
import { BURN, FUSE, Match, type GameEvent } from './rules.ts';

type Sprite = Phaser.GameObjects.Image;
type Particle = { x: number; y: number; dx: number; dy: number; life: number; length: number; color: number; size: number; gravity: number };
const position = (cell: number) => [(col(cell) + 0.5) * CELL, (row(cell) + 0.5) * CELL] as const;
const fixedStep = 1 / 120;

interface RoundHooks {
  input: () => { direction: Direction | null; plant: boolean };
  events: (events: GameEvent[]) => void;
  frame: (match: Match) => void;
  end: (match: Match) => void;
}

export class ArenaView extends Phaser.Scene {
  private match?: Match;
  private running = false;
  private accumulator = 0;
  private ending = -1;
  private visualTime = 0;
  private ready = false;
  private pilots: Sprite[] = [];
  private crates = new Map<number, Sprite>();
  private bombs = new Map<number, Sprite>();
  private loot = new Map<number, Sprite>();
  private particles: Particle[] = [];
  private ink!: Phaser.GameObjects.Graphics;

  constructor(private hooks: RoundHooks) { super('arena'); }

  create() {
    this.texture('orb', 64, 64, drawBomb);
    for (const type of ['bomb', 'range', 'speed'] as const) this.texture(type, 52, 52, ctx => drawItem(ctx, type));
    for (const [index, pilot] of CREW.entries()) {
      for (const dir of [0, 1, 2, 3] as const) {
        for (let frame = 0; frame < 7; frame++) {
          this.texture(`pilot-${index}-${dir}-${frame}`, 96, 96, ctx => drawPilot(ctx, pilot, dir, 2 * Math.PI * frame / 6, frame === 6));
        }
      }
    }
    this.game.canvas.setAttribute('aria-label', '泡泡奇旅竞技场');
    this.game.canvas.setAttribute('role', 'img');
    this.ready = true;
    if (this.match) this.loadRound(this.match);
  }

  start(match: Match) {
    this.match = match;
    this.running = true;
    this.accumulator = 0;
    this.ending = -1;
    this.visualTime = 0;
    if (this.ready) this.loadRound(match);
  }

  paused(paused: boolean) {
    this.running = !paused;
    this.accumulator = 0;
    if (paused && this.ready) this.cameras.main.resetFX();
  }

  private texture(key: string, width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) {
    const texture = this.textures.createCanvas(key, width, height)!;
    paint(texture.context);
    texture.refresh();
  }

  private loadRound(match: Match) {
    this.cameras.main.resetFX();
    this.children.removeAll(true);
    this.crates.clear();
    this.bombs.clear();
    this.loot.clear();
    this.particles = [];
    for (const key of ['ground', 'crate']) if (this.textures.exists(key)) this.textures.remove(key);
    this.texture('ground', WIDTH, HEIGHT, ctx => {
      drawGround(ctx, match.arena);
      match.tiles.forEach((tile, cell) => {
        if (tile !== Tile.Wall) return;
        ctx.save();
        ctx.translate(col(cell) * CELL, row(cell) * CELL);
        drawWall(ctx, match.arena, cell);
        ctx.restore();
      });
    });
    this.texture('crate', CELL, CELL, ctx => drawCrate(ctx, match.arena));
    this.add.image(0, 0, 'ground').setOrigin(0);
    match.tiles.forEach((tile, cell) => {
      if (tile === Tile.Crate) this.crates.set(cell, this.add.image(...position(cell), 'crate').setDepth(1));
    });
    this.ink = this.add.graphics().setDepth(10);
    this.pilots = match.actors.map(actor => this.add.image(...position(actor.cell), `pilot-${actor.pilot}-2-0`).setScale(0.69).setDepth(4));
    this.draw(match, 0);
  }

  update(_time: number, delta: number) {
    const match = this.match;
    if (!this.ready || !match || !this.running) return;
    const elapsed = Math.min(0.08, delta / 1000);
    this.visualTime += elapsed;
    this.accumulator += elapsed;
    while (this.accumulator >= fixedStep && !match.outcome) {
      const { direction, plant } = this.hooks.input();
      match.tick(fixedStep, direction, plant);
      this.accumulator -= fixedStep;
      if (match.events.length) this.apply(match.events);
    }
    this.draw(match, elapsed);
    this.hooks.frame(match);
    if (!match.outcome) return;
    if (this.ending < 0) this.ending = this.visualTime + 0.62;
    if (this.visualTime >= this.ending) {
      this.running = false;
      this.hooks.end(match);
    }
  }

  private apply(events: GameEvent[]) {
    let shake = false;
    for (const event of events) {
      if (event.type === 'blast') {
        shake = true;
        this.bombs.get(event.origin)?.destroy();
        this.bombs.delete(event.origin);
        this.spray(event.origin, 20, [0xfff3a1, 0xffaf56, 0xff7191, 0xfff5e2], 165);
        for (const cell of event.broken) {
          this.crates.get(cell)?.destroy();
          this.crates.delete(cell);
          this.spray(cell, 11, [0xf9ba64, 0xde784c, 0xffd99a], 115);
        }
      } else if (event.type === 'plant') {
        this.bombs.set(event.cell, this.add.image(...position(event.cell), 'orb').setScale(0.7).setDepth(2));
      } else if (event.type === 'pickup') {
        this.spray(event.cell, 10, [0xfef9aa, 0xfffbf2, 0xb4ffb1], 95);
      } else {
        this.spray(event.cell, 18, [0xfff9e8, 0xffa4bd, 0xdfc4ff], 145);
      }
    }
    if (shake && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.cameras.main.shake(135, 0.006);
    this.hooks.events(events);
  }

  private spray(cell: number, amount: number, colors: number[], force: number) {
    const [x, y] = position(cell);
    for (let i = 0; i < amount && this.particles.length < 256; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = (0.32 + Math.random() * 0.68) * force;
      const length = 0.24 + Math.random() * 0.42;
      this.particles.push({ x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 14, life: length, length, color: colors[i % colors.length], size: 2 + Math.random() * 5, gravity: 90 + Math.random() * 45 });
    }
  }

  private draw(match: Match, elapsed: number) {
    const t = this.visualTime;
    for (const [cell, sprite] of this.bombs) {
      const bomb = match.bombs.get(cell);
      if (!bomb) continue;
      const urge = Math.max(0, 1 - (bomb.at - match.time) / FUSE);
      sprite.setScale(0.74 + Math.sin(t * (12 + urge * 19)) * (0.05 + urge * 0.12)).setAngle(Math.sin(t * 34) * urge * urge * 12);
    }
    for (const [cell, sprite] of this.loot) {
      if (match.items.has(cell)) continue;
      sprite.destroy();
      this.loot.delete(cell);
    }
    for (const [cell, item] of match.items) {
      const [x, y] = position(cell);
      let sprite = this.loot.get(cell);
      if (!sprite) {
        sprite = this.add.image(x, y, item).setScale(0.86).setDepth(2);
        this.loot.set(cell, sprite);
      }
      sprite.setY(y + Math.sin(t * 5 + cell) * 3.4);
    }

    this.ink.clear();
    for (const actor of match.actors) {
      const sprite = this.pilots[actor.id];
      sprite.setVisible(actor.alive);
      if (!actor.alive) continue;
      const [x, y] = position(actor.cell);
      const [tx, ty] = actor.to < 0 ? [x, y] : position(actor.to);
      const px = Phaser.Math.Linear(x, tx, actor.progress);
      const py = Phaser.Math.Linear(y, ty, actor.progress);
      const walking = actor.to >= 0;
      const frame = walking ? Math.floor((t * 26 + actor.id) % 6) : (t + actor.id * 0.7) % 3.8 > 3.64 ? 6 : 0;
      sprite.setTexture(`pilot-${actor.pilot}-${actor.direction}-${frame}`).setPosition(px, py - 7 + Math.sin(t * 5 + actor.id) * (walking ? 0 : 0.8)).setDepth(4 + py / 1000);
      if (actor.id === 0) {
        this.ink.lineStyle(2.5, 0xfefff2, 0.9).strokeEllipse(px, py + 17, 35, 12);
        this.ink.fillStyle(0x21473b, 0.94).fillTriangle(px - 5, py - 41, px + 5, py - 41, px, py - 34);
        this.ink.fillStyle(0xffefac, 1).fillTriangle(px - 3, py - 40, px + 3, py - 40, px, py - 36);
      }
    }
    this.drawFire(match);
    this.particles = this.particles.filter(particle => particle.life > 0);
    for (const p of this.particles) {
      p.life -= elapsed;
      p.x += p.dx * elapsed;
      p.y += p.dy * elapsed;
      p.dy += elapsed * p.gravity;
      this.ink.fillStyle(p.color, Math.max(0, p.life / p.length));
      this.ink.fillCircle(p.x, p.y, p.size);
      this.ink.fillStyle(0xffffff, Math.max(0, p.life / p.length * 0.62));
      this.ink.fillCircle(p.x - 0.8, p.y - 1, p.size / 2.4);
    }
  }

  private drawFire(match: Match) {
    for (const [cell, fire] of match.fire) {
      const [x, y] = position(cell);
      const fade = Math.max(0, Math.min(1, (fire.until - match.time - Math.max(0, this.ending < 0 ? 0 : this.visualTime - this.ending + 0.62)) / BURN));
      const alpha = Math.pow(fade, 0.55);
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (!match.fire.has(cell + dx + dy * (WIDTH / CELL))) continue;
        this.ink.lineStyle(33 * alpha + 3, 0xff799e, 0.64 * alpha).lineBetween(x, y, x + dx * CELL, y + dy * CELL);
        this.ink.lineStyle(18 * alpha + 2, 0xffd581, 0.94 * alpha).lineBetween(x, y, x + dx * CELL, y + dy * CELL);
        this.ink.lineStyle(8 * alpha + 1, 0xfffee6, alpha).lineBetween(x, y, x + dx * CELL, y + dy * CELL);
      }
      this.ink.fillStyle(0xff8a9c, alpha * 0.48).fillCircle(x, y, 23 * alpha + 3);
      this.ink.fillStyle(0xffd67f, alpha * 0.94).fillCircle(x, y, 16 * alpha + 3);
      this.ink.fillStyle(0xffffec, alpha).fillCircle(x, y, 9 * alpha + 2);
    }
  }
}
