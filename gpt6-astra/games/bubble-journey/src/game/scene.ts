import Phaser from 'phaser';
import { Match } from './match';
import { Brain } from './ai';
import { Controls } from './input';
import { COLS, ROWS, TILE, FUSE, type MatchOptions, type Phase, type GameEvent, key } from './types';
import { createTextures, preloadCharacters } from '../art/textures';
import type { Sound } from '../audio';

export interface SceneHooks {
  ready: () => void;
  phase: (phase: Phase) => void;
  status: (match: Match, countdown: number) => void;
  event: (event: GameEvent, match: Match) => void;
}

export class ArenaScene extends Phaser.Scene {
  match!: Match;
  phase: Phase = 'lobby';
  ready = false;
  private bots: Brain[] = [];
  private actors: Phaser.GameObjects.Image[] = [];
  private obstacles = new Map<number, Phaser.GameObjects.Image>();
  private bombs = new Map<number, Phaser.GameObjects.Image>();
  private drops = new Map<number, Phaser.GameObjects.Image>();
  private flameGraphics!: Phaser.GameObjects.Graphics;
  private rings!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Text;
  private accumulator = 0;
  private countdown = 3000;
  private previousCount = 4;
  private statusAt = 0;
  private particles = 0;
  private previousPhase: Phase = 'playing';
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(readonly controls: Controls, readonly sfx: Sound, readonly hooks: SceneHooks) { super('arena'); }
  preload() { preloadCharacters(this); }
  create() {
    createTextures(this); this.ready = true; this.hooks.ready();
  }
  loadArena(options: MatchOptions, preview = false) {
    if (!this.ready) return;
    this.tweens.killAll(); this.children.removeAll(true);
    this.obstacles.clear(); this.bombs.clear(); this.drops.clear(); this.particles = 0;
    this.match = new Match(options); this.bots = [1, 2, 3].map(id => new Brain(id));
    this.accumulator = 0; this.countdown = 3000; this.previousCount = 4; this.statusAt = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      this.add.image(x * TILE + 24, y * TILE + 24, `floor-${options.theme}-${(x + y) % 2}`).setDisplaySize(TILE, TILE).setDepth(-100);
      const cell = this.match.at(x, y);
      if (cell !== 'floor') {
        const image = this.add.image(x * TILE + 24, y * TILE + 17, `${cell}-${options.theme}`).setDisplaySize(48, cell === 'wall' ? 58 : 56).setDepth(y * TILE);
        this.obstacles.set(key(x, y), image);
      } else if ((x * 19 + y * 7) % 23 === 0) {
        this.add.text(x * TILE + 15, y * TILE + 12, options.theme === 2 ? '✧' : '✿', { fontSize: '15px', color: options.theme === 1 ? '#fff7e7' : '#fffae0' }).setAlpha(.65).setDepth(-50);
      }
    }
    if (preview) {
      const positions = [{ x: 5, y: 5 }, { x: 9, y: 5 }, { x: 7, y: 3 }, { x: 7, y: 9 }];
      this.match.actors.forEach((a, i) => {
        Object.assign(a, positions[i]);
      });
    }
    this.actors = this.match.actors.map(a => this.add.image(0, 0, `actor-${a.character}`).setDisplaySize(48, 54));
    this.flameGraphics = this.add.graphics().setDepth(1000);
    this.rings = this.add.graphics().setDepth(1001);
    this.marker = this.add.text(0, 0, preview ? '选好伙伴，一起出发！' : 'YOU', {
      fontFamily: 'system-ui, sans-serif', fontSize: preview ? '12px' : '10px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#297863', padding: { x: 7, y: 4 },
    }).setOrigin(.5, 1).setDepth(2000);
    this.setPhase(preview ? 'lobby' : 'countdown');
    this.sfx.startMusic(preview ? 'lobby' : 'battle');
    this.renderWorld(0); this.hooks.status(this.match, 3);
  }
  private setPhase(phase: Phase) {
    this.phase = phase; this.controls.enabled = phase === 'playing'; this.controls.clear(); this.hooks.phase(phase);
  }
  pause() {
    if (this.phase !== 'playing' && this.phase !== 'countdown') return;
    this.previousPhase = this.phase; this.setPhase('paused'); this.tweens.pauseAll(); this.sfx.stopMusic();
  }
  resume() {
    if (this.phase !== 'paused') return;
    this.setPhase(this.previousPhase); this.tweens.resumeAll(); this.sfx.startMusic();
  }
  place() { if (this.phase === 'playing') this.match.place(0); }
  update(time: number, delta: number) {
    if (!this.match || this.phase === 'paused') return;
    const dt = Math.min(delta, 100);
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const value = Math.ceil(this.countdown / 1000);
      if (value !== this.previousCount) { this.previousCount = value; this.sfx.play('tick'); this.hooks.status(this.match, value); }
      if (this.countdown <= 0) this.setPhase('playing');
    }
    if (this.phase === 'playing') {
      this.accumulator += dt;
      while (this.accumulator >= 1000 / 60 && !this.match.ended) {
        const direction = !this.match.actors[0].target ? this.controls.consumeDirection() : null;
        if (direction) this.match.move(0, direction);
        this.bots.forEach(bot => bot.update(this.match));
        this.match.tick(1000 / 60);
        this.accumulator -= 1000 / 60;
        this.match.drainEvents().forEach(event => this.handleEvent(event));
      }
    }
    this.renderWorld(time);
    if (this.phase !== 'lobby' && time >= this.statusAt) { this.statusAt = time + 100; this.hooks.status(this.match, Math.ceil(this.countdown / 1000)); }
  }
  private handleEvent(event: GameEvent) {
    if (event.type === 'break') {
      this.obstacles.get(key(event.x, event.y))?.destroy(); this.obstacles.delete(key(event.x, event.y));
      this.burst(event.x * TILE + 24, event.y * TILE + 24, 0xe6bf8d, 6);
    }
    if (event.type === 'explode') {
      this.sfx.play('explode');
      if (!this.reducedMotion) this.cameras.main.shake(120, .0025);
      event.cells.forEach(p => this.burst(p.x * TILE + 24, p.y * TILE + 24, 0xfaf3b7, 3));
    }
    if (event.type === 'place') this.sfx.play('place');
    if (event.type === 'pickup') { if (event.actor === 0) this.sfx.play('pickup'); }
    if (event.type === 'death') {
      this.burst(event.x * TILE + 24, event.y * TILE + 10, 0xffffff, 16);
      if (event.actor === 0) this.sfx.play('death');
    }
    if (event.type === 'end') {
      this.setPhase('ended'); this.sfx.stopMusic(); this.sfx.play(event.winner === 0 ? 'win' : 'lose');
    }
    this.hooks.event(event, this.match);
  }
  private burst(x: number, y: number, color: number, count: number) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count && this.particles < 160; i++) {
      const angle = Math.random() * Math.PI * 2, distance = 16 + Math.random() * 32;
      const dot = this.add.circle(x, y, 2 + Math.random() * 3, color).setDepth(1800);
      this.particles++;
      this.tweens.add({ targets: dot, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance,
        scale: 0, alpha: 0, duration: 350 + Math.random() * 200, ease: 'Cubic.easeOut',
        onComplete: () => { dot.destroy(); this.particles--; } });
    }
  }
  private renderWorld(time: number) {
    this.match.actors.forEach((actor, i) => {
      const image = this.actors[i]; image.setVisible(actor.alive);
      const moving = !!actor.target;
      const bob = this.reducedMotion ? 0 : Math.sin(time / (moving ? 65 : 260) + i) * (moving ? 2.5 : 1);
      image.setPosition(actor.x * TILE + 24, actor.y * TILE + 14 + bob).setDepth(actor.y * TILE + 10);
      image.setTexture(`${actor.facing === 'up' ? 'back' : 'actor'}-${actor.character}`);
      image.setFlipX(actor.facing === 'left');
      image.setAngle(moving && !this.reducedMotion ? Math.sin(time / 65) * 4 : 0);
      if (i === 0) this.marker.setPosition(image.x, image.y - 28).setVisible(actor.alive);
    });
    this.rings.clear();
    for (const [id, image] of this.bombs) if (!this.match.bombs.some(b => b.id === id)) { image.destroy(); this.bombs.delete(id); }
    for (const bomb of this.match.bombs) {
      let image = this.bombs.get(bomb.id);
      if (!image) { image = this.add.image(bomb.x * TILE + 24, bomb.y * TILE + 19, 'bubble').setDisplaySize(42, 46).setDepth(bomb.y * TILE + 3); this.bombs.set(bomb.id, image); }
      const left = bomb.explodesAt - this.match.time;
      const pulse = this.reducedMotion ? 1 : 1 + Math.sin(time / (left < 700 ? 35 : 100)) * (left < 700 ? .1 : .035);
      image.setDisplaySize(42 * pulse, 46 * pulse).setAngle(left < 700 && !this.reducedMotion ? Math.sin(time / 25) * 7 : 0);
      this.rings.lineStyle(2.5, left < 700 ? 0xffe09a : 0xffffff, .85);
      this.rings.beginPath(); this.rings.arc(image.x, image.y + 2, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, left / FUSE)); this.rings.strokePath();
    }
    this.flameGraphics.clear();
    const seen = new Set<number>();
    for (const flame of this.match.flames) {
      const index = key(flame.x, flame.y); if (seen.has(index)) continue; seen.add(index);
      const x = flame.x * TILE, y = flame.y * TILE;
      const alpha = Math.min(1, (flame.expiresAt - this.match.time) / 220);
      this.flameGraphics.fillStyle(0x62d6d2, .8 * alpha).fillRoundedRect(x - 1, y + 3, 50, 42, 14);
      this.flameGraphics.fillStyle(0xd4fff3, .9 * alpha).fillRoundedRect(x + 4, y + 10, 40, 28, 10);
      this.flameGraphics.fillStyle(0xfff8bc, alpha).fillCircle(x + 24, y + 24, 9 + Math.sin(time / 35) * 2);
    }
    const available = this.match.drops.filter(d => d.availableAt <= this.match.time);
    for (const [index, image] of this.drops) if (!available.some(d => key(d.x, d.y) === index)) { image.destroy(); this.drops.delete(index); }
    for (const drop of available) {
      const index = key(drop.x, drop.y); let image = this.drops.get(index);
      if (!image) { image = this.add.image(drop.x * TILE + 24, 0, `power-${drop.kind}`).setDisplaySize(34, 38).setDepth(drop.y * TILE + 2); this.drops.set(index, image); }
      image.y = drop.y * TILE + 20 + (this.reducedMotion ? 0 : Math.sin(time / 220) * 2);
    }
  }
}

export function createGame(parent: HTMLElement, scene: ArenaScene) {
  return new Phaser.Game({ type: Phaser.AUTO, parent, width: COLS * TILE, height: ROWS * TILE,
    backgroundColor: '#c0dcb1', scene: [scene], banner: false,
    render: { antialias: true, pixelArt: false, powerPreference: 'low-power', roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // The simulation already accumulates fixed steps. Phaser's default smoothing discards
    // slower frames, which would make round timers run slowly on software-rendered WebKit.
    fps: { target: 60, min: 10, smoothStep: false }, audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false },
  });
}
