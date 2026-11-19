import { eye, makeActor, move, type Actor } from './actor.ts';
import { clamp, practiceSpots, regions, spawns } from './arena.ts';
import { makeBrain, updateBot } from './bots.ts';
import { fire, reload, settleGun, switchGun, throwGrenade, updateGrenade, type Combat, type Event, type Grenade } from './combat.ts';
import { matchRules, weapons, type Level, type Primary, type Target } from './loadout.ts';

export type Setup = { mode: 'team' | 'range'; primary: Primary; level: Level; target: Target };
export type Input = {
  x: number; z: number; yaw: number; pitch: number; fire: boolean; pressed: boolean; ads: boolean;
  sprint: boolean; jump: boolean; crouch: boolean; reload: boolean; grenade: boolean; slot: 0 | 1 | 2;
};
export const blankInput = (): Input =>
  ({ x: 0, z: 0, yaw: 0, pitch: 0, fire: false, pressed: false, ads: false, sprint: false, jump: false, crouch: false, reload: false, grenade: false, slot: 0 });

const names = ['你', '泊位', '锚点', '北辰', '余烬', '冷锋', '礁石', '鸢尾'];
const botGuns = ['m4', 'ak', 'm4', 'ak', 'ak', 'm4', 'ak', 'm4'] as const;

export class Match implements Combat {
  readonly setup: Setup;
  time = 0;
  practice: boolean;
  goal: number;
  level: Level;
  actors: Actor[];
  brains: ReturnType<typeof makeBrain>[];
  events: Event[] = [];
  score: [number, number] = [0, 0];
  stats = { shots: 0, hits: 0 };
  grenades: Grenade[] = [];
  remaining: number;
  ended = false;
  random: () => number;

  constructor(setup: Setup, seed = Math.floor(Math.random() * 2147483646) + 1) {
    this.setup = setup;
    this.practice = setup.mode === 'range';
    this.goal = this.practice ? Infinity : setup.target;
    this.level = setup.level;
    this.remaining = this.practice ? Infinity : matchRules[setup.target];
    this.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    this.actors = names.flatMap((name, id) => {
      if (this.practice && id > 0 && id < 4) return [];
      return [this.actor(id, this.practice && id ? `训练靶 ${id - 3}` : name)];
    });
    this.brains = names.map((_, id) => makeBrain(id));
  }

  get player() { return this.actors[0]; }
  get location() {
    const { x, z } = this.player.pos;
    return regions.reduce((best, r) => Math.hypot(r.x - x, r.z - z) < Math.hypot(best.x - x, best.z - z) ? r : best);
  }

  private actor(id: number, name: string) {
    const team = id < 4 ? 0 : 1;
    const point = this.practice && id ? practiceSpots[id - 4] : spawns[team][id % 4];
    return makeActor(id, name, team, point, id ? botGuns[id] : this.setup.primary, this.practice);
  }

  private respawn(a: Actor) {
    const fresh = this.actor(a.id, a.name);
    Object.assign(a, fresh, { kills: a.kills, deaths: a.deaths, headshots: a.headshots, safeUntil: this.practice ? 0 : this.time + 1.65 });
    this.brains[a.id] = makeBrain(a.id);
    this.events.push({ type: 'spawn', actor: a });
  }

  private updatePlayer(a: Actor, input: Input, dt: number) {
    a.yaw = (a.yaw + input.yaw) % (2 * Math.PI);
    a.pitch = clamp(a.pitch + input.pitch, -1.46, 1.46);
    if (input.slot) switchGun(this, a, input.slot === 1 ? a.primary : 'm9');
    if (input.reload) reload(this, a);
    a.sprinting = input.sprint && input.z < 0 && !input.ads && !input.crouch;
    a.ads = input.ads && !a.reloadUntil && !a.sprinting;
    const speed = input.crouch ? 2.15 : a.sprinting ? 6.65 : a.ads ? 2.78 : 4.55;
    const scale = speed / Math.max(1, Math.hypot(input.x, input.z));
    const c = Math.cos(a.yaw), s = Math.sin(a.yaw);
    move(a, (input.x * c + input.z * s) * scale, (input.z * c - input.x * s) * scale, input.jump, input.crouch, dt);
    if (input.grenade) {
      const grenade = throwGrenade(this, a);
      if (grenade) this.grenades.push(grenade);
    }
    if (!a.sprinting && (input.pressed || input.fire && weapons[a.gun].auto)) fire(this, a);
  }

  update(input: Input, dt: number) {
    if (this.ended || dt <= 0) return;
    this.time += dt;
    if (!this.practice) this.remaining = Math.max(0, this.remaining - dt);
    for (const a of this.actors) {
      if (!a.hp) {
        a.moving = 0;
        if (this.time >= a.respawnAt) this.respawn(a);
        else continue;
      }
      settleGun(this.time, a, dt);
      if (a.bot) updateBot(this, a, this.brains[a.id], dt);
      else this.updatePlayer(a, input, dt);
      if (a.grounded && a.moving > 1 && a.nextStep < this.time) {
        a.nextStep = this.time + (a.crouched ? .6 : a.sprinting ? .29 : .43);
        this.events.push({ type: 'step', actor: a });
      }
    }
    this.grenades = this.grenades.filter(grenade => updateGrenade(this, grenade, dt));
    if (this.remaining <= 0 || Math.max(...this.score) >= this.goal) this.ended = true;
  }

  get listener() { return eye(this.player); }
}
