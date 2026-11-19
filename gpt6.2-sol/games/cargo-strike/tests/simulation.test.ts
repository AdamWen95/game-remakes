import assert from 'node:assert/strict';
import test from 'node:test';
import { makeActor, move } from '../src/actor.ts';
import { DECK, direction, lookAt, practiceSpots, spawns, wallDistance, type Vec } from '../src/arena.ts';
import { damage, fire } from '../src/combat.ts';
import { blankInput, Match, type Input, type Setup } from '../src/match.ts';
import { route } from '../src/navigation.ts';

const step = 1 / 60;
const base: Setup = { mode: 'team', primary: 'm4', level: 'standard', target: 10 };
const team = () => new Match(base, 11);
const range = (primary: Setup['primary'] = 'm4') => new Match({ ...base, mode: 'range', primary }, 11);
const tick = (m: Match, input: Partial<Input> = {}) => m.update({ ...blankInput(), ...input }, step);
function run(m: Match, duration: number, input: Partial<Input> = {}) {
  for (let i = 0; i < Math.ceil(duration / step) && !m.ended; i++) tick(m, input);
}

test('team and practice modes have their declared rosters and time limits', () => {
  assert.equal(team().actors.length, 8);
  assert.equal(team().actors.filter(a => a.team === 0).length, 4);
  assert.deepEqual([10, 20, 40].map(target => new Match({ ...base, target: target as Setup['target'] }).remaining), [120, 180, 300]);
  const m = range();
  assert.equal(m.actors.length, 5);
  assert.equal(m.remaining, Infinity);
  assert.deepEqual(m.actors[1].pos, practiceSpots[0]);
});

test('deck edges and containers stop movement while the catwalk is accessible from both sides', () => {
  const a = makeActor(0, 'test', 0, { x: 13.2, y: 0, z: 27 }, 'm4', true);
  for (let i = 0; i < 90; i++) move(a, 6, 0, false, false, step);
  assert.ok(a.pos.x <= DECK.x - .32);
  a.pos = { x: -6.3, y: 0, z: 24 };
  for (let i = 0; i < 60; i++) move(a, 0, -5, false, false, step);
  assert.ok(a.pos.z > 22);
  for (const start of [{ z: 14, v: -4.55 }, { z: -15.5, v: 4.55 }]) {
    a.pos = { x: -11.9, y: 0, z: start.z };
    for (let i = 0; i < 105; i++) move(a, 0, start.v, false, false, step);
    assert.ok(a.pos.y > 2.35);
  }
});

test('jump lands and crouch changes speed and stance', () => {
  const m = range(), a = m.player;
  tick(m, { jump: true });
  run(m, .21);
  assert.ok(a.pos.y > .55);
  run(m, .65);
  assert.equal(a.pos.y, 0);
  run(m, .25, { crouch: true, x: 1 });
  assert.ok(a.moving < 2.3 && a.crouched);
  tick(m);
  assert.equal(a.crouched, false);
});

test('geometry obstructs shots and all bot spawns have an opposing route', () => {
  const from = { x: -6.3, y: 1.6, z: 25 }, to = { x: -6.3, y: 1.6, z: 10 };
  const { yaw, pitch } = lookAt(from, to);
  assert.ok(wallDistance(from, direction(yaw, pitch), 15) < 4);
  for (const start of spawns[0]) for (const end of spawns[1]) assert.ok(route(start, end).length > 20);
  assert.equal(route(spawns[0][0], { x: 23, y: 0, z: 0 }).length, 0);
});

test('scoped aim hits the first practice target and it respawns', () => {
  const m = range('awp');
  const target = m.actors[1];
  tick(m, { pressed: true, ads: true });
  assert.equal(m.player.ammo.awp.loaded, 4);
  assert.equal(target.hp, 0);
  assert.equal(m.player.headshots, 1);
  assert.deepEqual(m.stats, { shots: 1, hits: 1 });
  run(m, .92);
  assert.equal(target.hp, 100);
  assert.equal(target.deaths, 1);
});

test('weapon switching cancels reload, magazines are separate, and reserve is conserved', () => {
  const m = range(), a = m.player;
  run(m, .37, { fire: true });
  assert.ok(a.ammo.m4.loaded < 30);
  const before = a.ammo.m4.loaded;
  tick(m, { reload: true });
  assert.ok(a.reloadUntil > 0);
  tick(m, { slot: 2 });
  assert.equal(a.reloadUntil, 0);
  assert.equal(a.ammo.m9.loaded, 15);
  run(m, .28);
  tick(m, { slot: 1, reload: true });
  run(m, 2);
  assert.equal(a.ammo.m4.loaded, 30);
  assert.equal(a.ammo.m4.reserve, 90 - (30 - before));
});

test('semi-automatic weapons require a fresh press and fire respects cooldown', () => {
  const m = range('awp');
  run(m, 1.3, { fire: true });
  assert.equal(m.player.ammo.awp.loaded, 5);
  tick(m, { pressed: true });
  tick(m, { pressed: true });
  assert.equal(m.player.ammo.awp.loaded, 4);
});

test('team damage, spawn protection and armor retain their independent rules', () => {
  const m = team(), a = m.player, friendly = m.actors[1], enemy = m.actors[4];
  const hit = (target: typeof enemy) => damage(m, a, target, 30, false, 'm4', a.pos);
  assert.equal(hit(enemy), false);
  m.time = 1.7;
  assert.equal(hit(friendly), false);
  assert.equal(hit(enemy), true);
  assert.equal(enemy.armor, 68);
  assert.equal(enemy.hp, 77);
  a.safeUntil = 9;
  fire(m, a);
  assert.equal(a.safeUntil, 0);
});

test('grenade is finite per life, bounces on deck, and times out once', () => {
  const m = range();
  tick(m, { grenade: true }); tick(m, { grenade: true });
  assert.equal(m.player.grenades, 0);
  assert.equal(m.grenades.length, 1);
  run(m, 1.84);
  assert.ok(m.grenades[0].pos.y >= .084);
  run(m, .2);
  assert.equal(m.grenades.length, 0);
  assert.equal(m.events.filter(e => e.type === 'boom').length, 1);
});

test('blast respects cover and causes distance-dependent damage', () => {
  const m = range(), p = m.player;
  const place = (target: number, point: Vec) => { m.actors[target].pos = point; };
  place(1, { x: -2.6, y: 0, z: 5.7 });
  place(2, { x: -2.6, y: 0, z: 11.2 });
  place(3, { x: -2.6, y: 0, z: 14.5 });
  m.grenades.push({ from: p, pos: { x: -2.6, y: 1, z: 10.1 }, v: { x: 0, y: 0, z: 0 }, fuse: 0 });
  tick(m);
  assert.equal(m.actors[1].hp, 100);
  assert.ok(m.actors[2].hp < m.actors[3].hp && m.actors[3].hp < 100);
});

test('AI completes a real match and the final result freezes', () => {
  const m = team();
  run(m, 120);
  assert.equal(m.ended, true);
  assert.equal(Math.max(...m.score), 10);
  assert.ok(m.actors.some(a => a.deaths > 0));
  const time = m.time;
  tick(m, { fire: true });
  assert.equal(m.time, time);
});

test('running out of time settles a match even with no shots', () => {
  const m = team();
  m.remaining = .02;
  run(m, .08);
  assert.equal(m.ended, true);
  assert.deepEqual(m.score, [0, 0]);
});
