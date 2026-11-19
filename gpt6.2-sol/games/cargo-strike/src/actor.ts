import { canStand, floorAt, RADIUS, type Vec } from './arena.ts';
import { weapons, type Gun, type Primary } from './loadout.ts';

export type Team = 0 | 1;
export type Magazine = { loaded: number; reserve: number };
export type Actor = {
  id: number; name: string; team: Team; bot: boolean; pos: Vec; yaw: number; pitch: number;
  crouched: boolean; grounded: boolean; vy: number; moving: number; sprinting: boolean;
  hp: number; armor: number; safeUntil: number; respawnAt: number; kills: number; deaths: number; headshots: number;
  primary: Primary; gun: Gun; ammo: Record<Gun, Magazine>; grenades: number;
  nextShot: number; reloadUntil: number; recoil: number; kick: number; ads: boolean; nextStep: number;
};

function loadAmmo() {
  const magazine = (gun: Gun): Magazine => ({ loaded: weapons[gun].mag, reserve: weapons[gun].reserve });
  return { m4: magazine('m4'), ak: magazine('ak'), awp: magazine('awp'), m9: magazine('m9') };
}

export function makeActor(id: number, name: string, team: Team, spawn: Vec, primary: Primary, practice: boolean): Actor {
  return {
    id, name, team, bot: id !== 0, pos: { ...spawn }, yaw: team ? Math.PI : 0, pitch: 0,
    crouched: false, grounded: true, vy: 0, moving: 0, sprinting: false,
    hp: 100, armor: practice && id ? 0 : 75, safeUntil: practice ? 0 : 1.65, respawnAt: 0,
    kills: 0, deaths: 0, headshots: 0, primary, gun: primary, ammo: loadAmmo(), grenades: 1,
    nextShot: 0, reloadUntil: 0, recoil: 0, kick: 0, ads: false, nextStep: 0,
  };
}

export const stature = (a: Actor) => a.crouched ? 1.12 : 1.77;
export const eye = (a: Actor): Vec => ({ ...a.pos, y: a.pos.y + stature(a) - .14 });
export const center = (a: Actor): Vec => ({ ...a.pos, y: a.pos.y + stature(a) * .64 });

export function move(a: Actor, x: number, z: number, jump: boolean, crouch: boolean, dt: number) {
  if (crouch || canStand(a.pos.x, a.pos.z, a.pos.y, 1.77)) a.crouched = crouch;
  const h = stature(a);
  if (jump && a.grounded && !a.crouched) { a.vy = 5.4; a.grounded = false; }
  const beforeX = a.pos.x, beforeZ = a.pos.z;
  for (const [mx, mz] of [[x, 0], [0, z]]) {
    const nx = a.pos.x + mx * dt, nz = a.pos.z + mz * dt;
    const stepped = floorAt(nx, nz, a.pos.y + (a.grounded ? .265 : .012), RADIUS);
    const y = Math.max(a.pos.y, stepped);
    if (canStand(nx, nz, y, h)) a.pos = { x: nx, y, z: nz };
  }
  const underside = a.pos.y;
  a.vy -= 16 * dt;
  let y = a.pos.y + a.vy * dt;
  const floor = floorAt(a.pos.x, a.pos.z, a.pos.y + .04, RADIUS);
  if (y <= floor) { y = floor; a.vy = 0; a.grounded = true; }
  else a.grounded = false;
  if (canStand(a.pos.x, a.pos.z, y, h)) a.pos.y = y;
  else if (y > underside) a.vy = 0;
  a.moving = Math.hypot(beforeX - a.pos.x, beforeZ - a.pos.z) / dt;
}
