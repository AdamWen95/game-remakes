import { along, direction, length, rayBox, wallDistance, type Vec } from './arena.ts';
import { eye, stature, type Actor } from './actor.ts';
import { difficulty, weapons, type Gun, type Level } from './loadout.ts';

export type Event =
  | { type: 'shot'; actor: Actor; gun: Gun; from: Vec; to: Vec; impact: boolean; flesh: boolean }
  | { type: 'hit'; actor: Actor; source: Vec; target: Actor; head: boolean; fatal: boolean }
  | { type: 'kill'; actor: Actor; target: Actor; head: boolean; gun: Gun | 'grenade' }
  | { type: 'reload' | 'switch' | 'empty' | 'step' | 'throw' | 'spawn'; actor: Actor }
  | { type: 'boom'; at: Vec };
export type Combat = {
  time: number; actors: Actor[]; score: [number, number]; level: Level; practice: boolean;
  goal: number; events: Event[]; random: () => number; stats: { shots: number; hits: number };
};

export function reload(round: Combat, a: Actor) {
  const gun = weapons[a.gun], mag = a.ammo[a.gun];
  if (a.reloadUntil || mag.loaded === gun.mag || !mag.reserve) return;
  a.reloadUntil = round.time + gun.reload;
  a.ads = false;
  round.events.push({ type: 'reload', actor: a });
}

export function switchGun(round: Combat, a: Actor, gun: Gun) {
  if (gun === a.gun) return;
  a.gun = gun; a.reloadUntil = 0; a.recoil = 0; a.ads = false;
  a.nextShot = Math.max(a.nextShot, round.time + .26);
  round.events.push({ type: 'switch', actor: a });
}

export function settleGun(time: number, a: Actor, dt: number) {
  a.recoil *= Math.exp(-5.4 * dt);
  a.kick *= Math.exp(-15 * dt);
  if (a.reloadUntil && time >= a.reloadUntil) {
    const mag = a.ammo[a.gun];
    const total = Math.min(weapons[a.gun].mag - mag.loaded, mag.reserve);
    mag.loaded += total; mag.reserve -= total; a.reloadUntil = 0;
  }
}

export function damage(round: Combat, shooter: Actor, victim: Actor, value: number, head: boolean, gun: Gun | 'grenade', source: Vec) {
  if (!victim.hp || victim.team === shooter.team || victim.safeUntil > round.time || Math.max(...round.score) >= round.goal) return false;
  const soak = Math.min(victim.armor, Math.round(value * (head ? .13 : .23)));
  victim.armor -= soak;
  victim.hp = Math.max(0, victim.hp - Math.round(value - soak));
  round.events.push({ type: 'hit', actor: shooter, source, target: victim, head, fatal: !victim.hp });
  if (!victim.hp) {
    victim.deaths++;
    victim.respawnAt = round.time + (round.practice ? .85 : 2.75);
    shooter.kills++;
    if (head) shooter.headshots++;
    round.score[shooter.team]++;
    round.events.push({ type: 'kill', actor: shooter, target: victim, head, gun });
  }
  return true;
}

export function fire(round: Combat, shooter: Actor) {
  if (shooter.nextShot > round.time || shooter.reloadUntil) return;
  const gun = weapons[shooter.gun], ammo = shooter.ammo[shooter.gun];
  if (!ammo.loaded) {
    shooter.nextShot = round.time + .25;
    round.events.push({ type: 'empty', actor: shooter });
    reload(round, shooter);
    return;
  }
  const bot = difficulty[round.level];
  shooter.nextShot = round.time + gun.cycle + (shooter.bot ? bot.tempo * (.8 + round.random() * .45) : 0);
  shooter.safeUntil = 0;
  ammo.loaded--;
  if (!shooter.bot) round.stats.shots++;
  const spread = shooter.bot ? bot.error : gun.spread * (shooter.ads ? .19 : 1)
    + (shooter.grounded ? 0 : .048) + shooter.moving * .004 + (shooter.crouched ? -.001 : 0);
  const r = Math.sqrt(round.random()) * Math.max(.00075, spread);
  const angle = round.random() * Math.PI * 2;
  const d = direction(shooter.yaw + Math.cos(angle) * r, shooter.pitch + shooter.recoil + Math.sin(angle) * r);
  shooter.recoil = Math.min(.13, shooter.recoil + gun.recoil * (shooter.ads ? .72 : 1));
  shooter.kick = 1;
  const from = eye(shooter);
  const wall = wallDistance(from, d, 83);
  let nearest = wall, target: Actor | undefined, head = false;
  for (const a of round.actors) {
    if (a === shooter || !a.hp) continue;
    const h = stature(a);
    const upper = rayBox(from, d,
      { x: a.pos.x - .17, y: a.pos.y + h - .29, z: a.pos.z - .17 },
      { x: a.pos.x + .17, y: a.pos.y + h + .02, z: a.pos.z + .17 }, nearest);
    const lower = rayBox(from, d,
      { x: a.pos.x - .31, y: a.pos.y + .11, z: a.pos.z - .24 },
      { x: a.pos.x + .31, y: a.pos.y + h - .29, z: a.pos.z + .24 }, nearest);
    const t = Math.min(upper, lower);
    if (t < nearest) { nearest = t; target = a; head = upper <= lower; }
  }
  const to = along(from, d, nearest);
  const damageValue = gun.damage * (head ? 3.65 : 1) * (shooter.bot ? bot.damage : 1) * (1 - Math.max(0, nearest - 25) * .004);
  round.events.push({ type: 'shot', actor: shooter, gun: shooter.gun, from, to, impact: nearest < 83, flesh: !!target });
  if (target && damage(round, shooter, target, damageValue, head, shooter.gun, from) && !shooter.bot) round.stats.hits++;
}

export type Grenade = { from: Actor; pos: Vec; v: Vec; fuse: number };

export function throwGrenade(round: Combat, actor: Actor): Grenade | undefined {
  if (!actor.grenades) return;
  actor.grenades--; actor.safeUntil = 0; actor.reloadUntil = 0;
  actor.nextShot = Math.max(actor.nextShot, round.time + .46);
  const d = direction(actor.yaw, actor.pitch);
  round.events.push({ type: 'throw', actor });
  return { from: actor, pos: eye(actor), v: { x: d.x * 13, y: d.y * 12 + 4.7, z: d.z * 13 }, fuse: round.time + 1.95 };
}

export function updateGrenade(round: Combat, grenade: Grenade, dt: number) {
  if (round.time >= grenade.fuse) {
    const at = grenade.pos;
    round.events.push({ type: 'boom', at });
    for (const a of round.actors) {
      const chest = { ...a.pos, y: a.pos.y + stature(a) * .58 };
      const range = length(at, chest);
      if (range < .001 || range > 6.2) continue;
      const d = { x: (chest.x - at.x) / range, y: (chest.y - at.y) / range, z: (chest.z - at.z) / range };
      if (wallDistance(at, d, range) >= range - .01) damage(round, grenade.from, a, 145 * (1 - range / 6.2), false, 'grenade', at);
    }
    return false;
  }
  grenade.v.y -= 13 * dt;
  for (const axis of ['x', 'y', 'z'] as const) {
    const travel = grenade.v[axis] * dt;
    if (!travel) continue;
    const d = { x: 0, y: 0, z: 0 };
    d[axis] = Math.sign(travel);
    const range = Math.abs(travel) + .085;
    const stop = wallDistance(grenade.pos, d, range);
    grenade.pos[axis] += Math.sign(travel) * Math.max(0, Math.min(Math.abs(travel), stop - .085));
    if (stop < range) {
      grenade.v[axis] *= -.42;
      if (axis === 'y') { grenade.v.x *= .89; grenade.v.z *= .89; }
    }
  }
  return true;
}
