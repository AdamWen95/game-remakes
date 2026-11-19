import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cars, tracks, WALL, clamp, angleDiff } from '../src/track.ts';
import { Race, neutral, STEP, clock } from '../src/race.ts';

test('three closed circuits have continuous distance and valid pad placements', () => {
  assert.equal(tracks.length, 3);
  for (const track of tracks) {
    assert.ok(track.length > 1000);
    assert.deepEqual(track.sample(0), track.sample(track.length));
    const a = track.sample(-.1);
    const b = track.sample(.1);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .21);
    assert.ok(Math.abs(angleDiff(a.yaw, b.yaw)) < .025);
    for (const [fraction, lane] of track.course.pads) {
      assert.ok(fraction > 0 && fraction < 1);
      assert.ok(Math.abs(lane) + 2.45 < WALL);
    }
  }
});

test('all tracks and cars can complete two timed laps with ordered splits', () => {
  for (const track of tracks) {
    for (const spec of cars) {
      const race = new Race(track, spec, 'trial', 'normal');
      assert.equal(race.drivers.length, 1);
      for (let i = 0; i < 100 / STEP && race.player.finish === null; i++) {
        const { lane, side, speed, s } = race.player;
        const curve = track.sample(s + 2).curve;
        const steer = clamp(curve * speed * .17 - lane * .12 - side * .036, -1, 1);
        race.tick({ ...neutral, gas: true, steer }, STEP);
      }
      const { splits, finish, lap } = race.player;
      assert.equal(lap, 2, track.course.name + ' ' + spec.name);
      assert.equal(splits.length, 2);
      assert.ok(splits.every(split => split > 0));
      assert.ok(finish !== null && Math.abs(splits[0] + splits[1] - finish) < 1e-7);
    }
  }
});

test('a drift fills nitro, release gives a mini boost, and a full bottle is consumed once', () => {
  const race = new Race(tracks[0], cars[0], 'trial', 'normal');
  const car = race.player;
  car.speed = 35;
  car.charge = 85;
  for (let i = 0; i < 66; i++) race.tick({ ...neutral, gas: true, steer: .7, drift: true }, STEP);
  assert.ok(car.charge >= 100);
  race.tick({ ...neutral, gas: true }, STEP);
  assert.ok(race.events.has('mini'));
  const before = car.charge;
  race.tick({ ...neutral, gas: true, boost: true }, STEP);
  assert.ok(race.events.has('nitro'));
  assert.equal(car.charge, before - 100);
  assert.ok(car.boost > 2);
  race.tick({ ...neutral, gas: true }, STEP);
  assert.equal(car.charge, before - 100);
});

test('a boost pad, wall, and recenter have distinct consequences', () => {
  const track = tracks[0];
  const race = new Race(track, cars[0], 'trial', 'normal');
  const car = race.player;
  const [fraction, lane] = track.course.pads[0];
  car.s = fraction * track.length;
  car.lane = lane;
  car.speed = 40;
  race.tick({ ...neutral, gas: true }, STEP);
  assert.ok(race.events.has('pad') && car.boost > 0);
  car.lane = WALL + .1;
  race.tick({ ...neutral, gas: true }, STEP);
  assert.ok(race.events.has('hit') && car.boost === 0);
  const s = car.s;
  const speed = car.speed;
  race.tick({ ...neutral, reset: true }, STEP);
  assert.ok(race.events.has('reset'));
  assert.ok(Math.abs(car.lane) < .001);
  assert.ok(car.s >= s && car.s < s + .2);
  assert.ok(car.speed < speed);
});

test('five independent rivals race and expert difficulty is measurably faster', () => {
  const easy = new Race(tracks[0], cars[0], 'race', 'normal');
  const hard = new Race(tracks[0], cars[0], 'race', 'expert');
  for (let i = 0; i < 18 / STEP; i++) {
    easy.tick(neutral, STEP);
    hard.tick(neutral, STEP);
  }
  assert.equal(easy.drivers.length, 6);
  assert.equal(easy.standings.at(-1)?.id, 0);
  assert.ok(hard.standings[0].s > easy.standings[0].s + 80);
  assert.equal(new Set(hard.drivers.map(car => car.s)).size, 6);
});

test('steering gives a measurable advantage over holding only the throttle', () => {
  const track = tracks[0];
  const steered = new Race(track, cars[0], 'trial', 'normal');
  const straight = new Race(track, cars[0], 'trial', 'normal');
  for (let i = 0; i < 45 / STEP; i++) {
    const { lane, side, speed, s } = steered.player;
    const curve = track.sample(s + 2).curve;
    steered.tick({ ...neutral, gas: true, steer: clamp(curve * speed * .17 - lane * .12 - side * .036, -1, 1) }, STEP);
    straight.tick({ ...neutral, gas: true }, STEP);
  }
  assert.ok(steered.player.s > straight.player.s + track.length * .3);
});

test('contact between cars reduces speed and cannot add progress', () => {
  const race = new Race(tracks[0], cars[0], 'race', 'normal');
  const rival = race.drivers[1];
  race.player.s = rival.s - 2.5;
  race.player.lane = rival.lane;
  race.player.speed = 32;
  const before = race.player.s;
  race.tick({ ...neutral, gas: true }, STEP);
  assert.ok(race.events.has('hit'));
  assert.ok(race.player.speed < 31);
  assert.ok(race.player.s - before < .3);
});

test('finish order is based on crossing time and the timer handles minute boundaries', () => {
  const race = new Race(tracks[0], cars[0], 'race', 'normal');
  race.drivers[1].finish = 41.3;
  race.drivers[2].finish = 40.4;
  race.drivers[1].s = 2760;
  race.drivers[2].s = 2730;
  race.drivers[3].s = 3060;
  assert.deepEqual(race.standings.slice(0, 3).map(car => car.id), [2, 1, 3]);
  assert.equal(clock(59.9996), '01:00.000');
});
