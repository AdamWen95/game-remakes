import { center, eye, move, type Actor } from './actor.ts';
import { direction, length, lookAt, wallDistance, type Vec } from './arena.ts';
import { fire, reload, type Combat } from './combat.ts';
import { difficulty } from './loadout.ts';
import { route } from './navigation.ts';

type Brain = {
  target?: Actor; ready: number; updateAt: number; routeAt: number; path: Vec[];
  lane: number; checkpoint: number; sidestep: number;
};
export const makeBrain = (index: number): Brain =>
  ({ ready: 0, updateAt: 0, routeAt: 0, path: [], lane: index % 4, checkpoint: 0, sidestep: index % 2 ? 1 : -1 });

function visible(from: Vec, to: Vec, max: number) {
  const dist = length(from, to);
  if (dist > max || dist < .01) return false;
  const aim = lookAt(from, to);
  return wallDistance(from, direction(aim.yaw, aim.pitch), dist) >= dist - .025;
}

const laneX = [-9.3, 1, 8, 12.6];
function waypoint(a: Actor, b: Brain): Vec {
  const side = a.team ? -1 : 1;
  const xs = a.team ? [...laneX].reverse() : laneX;
  const checkpoints = [
    { x: xs[b.lane], y: 0, z: side * 12 },
    { x: xs[b.lane], y: 0, z: -side * 10 },
    { x: 6 * side, y: 0, z: -side * 23 },
    { x: -10 * side, y: 0, z: -side * 20 },
  ];
  return checkpoints[b.checkpoint % checkpoints.length];
}

export function updateBot(round: Combat, a: Actor, b: Brain, dt: number) {
  if (round.practice) return;
  const from = eye(a);
  const skill = difficulty[round.level];
  if (round.time >= b.updateAt) {
    b.updateAt = round.time + .13 + round.random() * .055;
    let choice: Actor | undefined, near = 39;
    for (const enemy of round.actors) {
      if (enemy.team === a.team || enemy.hp <= 0 || enemy.safeUntil > round.time) continue;
      const dist = length(a.pos, enemy.pos);
      if (dist < near && visible(from, center(enemy), 39)) { near = dist; choice = enemy; }
    }
    if (b.target !== choice) { b.target = choice; b.ready = round.time + skill.delay + round.random() * .13; }
  }
  if (b.target?.hp && visible(from, center(b.target), 39)) {
    const target = center(b.target);
    const dist = length(from, target);
    target.y += .11 + Math.sin(round.time * 2 + a.id) * .097;
    const aim = lookAt(from, target);
    a.yaw = aim.yaw; a.pitch = aim.pitch;
    const side = b.sidestep * Math.sin(round.time * 1.7 + a.id);
    const retreat = dist < 4.7 ? -1.5 : dist > 21 ? 1.2 : 0;
    const dir = direction(a.yaw, 0);
    move(a, Math.cos(a.yaw) * side * 1.65 + dir.x * retreat, -Math.sin(a.yaw) * side * 1.65 + dir.z * retreat, false, false, dt);
    if (round.time >= b.ready) fire(round, a);
    return;
  }
  if (round.time >= b.routeAt || !b.path.length) {
    b.routeAt = round.time + 2.7 + round.random();
    if (length(a.pos, waypoint(a, b)) < 2 || (b.path.length && a.moving < .15)) b.checkpoint++;
    b.path = route(a.pos, waypoint(a, b));
  }
  if (a.ammo[a.gun].loaded < 6) reload(round, a);
  while (b.path.length && length(a.pos, b.path[0]) < .29) b.path.shift();
  if (!b.path.length) { b.checkpoint++; return; }
  const aim = lookAt(a.pos, b.path[0]);
  a.yaw = aim.yaw; a.pitch = 0;
  const d = direction(a.yaw, 0);
  const speed = Math.min(4.05, length(a.pos, b.path[0]) / dt);
  move(a, d.x * speed, d.z * speed, false, false, dt);
}
