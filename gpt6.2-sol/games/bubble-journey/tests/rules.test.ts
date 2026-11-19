import assert from 'node:assert/strict';
import test from 'node:test';
import { forecast } from '../src/game/ai.ts';
import { adjacent, MAPS, makeMap, rng, SPAWNS, Tile, tileAt } from '../src/game/maps.ts';
import { BURN, FUSE, Match, ROUND_SECONDS, blastCells } from '../src/game/rules.ts';
import { CREW } from '../src/game/crew.ts';

const grid = () => {
  const match = new Match(42, 'garden', 0);
  for (let i = 0; i < match.tiles.length; i++) if (match.tiles[i] === Tile.Crate) match.tiles[i] = Tile.Floor;
  for (const rival of match.actors.slice(1)) rival.thinkAt = Infinity;
  return match;
};

test('procedural maps have repeatable layouts, open spawn lanes, and distinct themes', () => {
  const randomMaps = new Set(Array.from({ length: 18 }, (_, seed) => makeMap('random', rng(seed)).arena.id));
  assert.equal(randomMaps.size, MAPS.length);
  for (const { id } of MAPS) {
    const map = makeMap(id, rng(332));
    assert.deepEqual(map, makeMap(id, rng(332)));
    assert.notDeepEqual(map.tiles, makeMap(id, rng(333)).tiles);
    for (const spawn of SPAWNS) {
      assert.equal(map.tiles[spawn], Tile.Floor);
      assert.equal(([0, 1, 2, 3] as const).filter(dir => map.tiles[adjacent(spawn, dir)] === Tile.Floor).length, 2);
    }
  }
});

test('cross-shaped blasts stop at crates and permanent walls', () => {
  const { tiles } = grid();
  const origin = tileAt(5, 5);
  tiles[tileAt(5, 3)] = Tile.Crate;
  tiles[tileAt(6, 5)] = Tile.Wall;
  const cells = blastCells(tiles, origin, 3);
  assert.ok(cells.includes(tileAt(5, 3)));
  assert.ok(cells.includes(tileAt(4, 5)));
  assert.ok(cells.includes(tileAt(5, 8)));
  assert.ok(!cells.includes(tileAt(5, 2)));
  assert.ok(!cells.includes(tileAt(6, 5)));
  assert.ok(!cells.includes(tileAt(4, 4)));
});

test('chain explosions reach later bombs, award destruction points, and return capacity', () => {
  const round = grid();
  round.player.cell = tileAt(3, 3);
  round.player.capacity = 2;
  round.actors[1].cell = tileAt(4, 3);
  round.actors[2].cell = tileAt(5, 2);
  round.tiles[tileAt(7, 3)] = Tile.Crate;
  assert.ok(round.plant(round.player));
  round.tick(0.5, null, false);
  assert.ok(round.plant(round.actors[1]));
  assert.ok(!round.plant(round.actors[1]));
  assert.equal(round.available(round.player), 1);
  round.player.cell = tileAt(3, 2);
  assert.deepEqual(forecast(round).get(tileAt(6, 3))?.[0], [FUSE, FUSE + BURN]);
  round.player.cell = tileAt(2, 1);
  round.tick(FUSE, null, false);
  assert.equal(round.bombs.size, 0);
  assert.equal(round.available(round.player), 2);
  assert.ok(round.events.some(event => event.type === 'blast' && event.origin === tileAt(4, 3)));
  assert.equal(round.tiles[tileAt(7, 3)], Tile.Crate);
  assert.equal(round.actors[1].alive, false);
  assert.equal(round.player.kills, 1);
  assert.equal(round.player.score, 250);
});

test('destroyed crates can drop items after the blast and award points', () => {
  const round = grid();
  const crate = tileAt(4, 1);
  round.tiles[crate] = Tile.Crate;
  round.player.cell = tileAt(3, 1);
  round.plant(round.player);
  round.player.cell = tileAt(4, 3);
  round.tick(FUSE + 0.02, null, false);
  assert.equal(round.tiles[crate], Tile.Floor);
  assert.equal(round.items.has(crate), false);
  assert.equal(round.player.score, 20);
  round.tick(BURN + 0.01, null, false);
  assert.equal(round.fire.has(crate), false);
});

test('bomb collision permits leaving an occupied tile and prevents reentry', () => {
  const round = grid();
  assert.ok(round.plant(round.player));
  round.tick(0.2, 1, false);
  assert.equal(round.player.cell, tileAt(2, 1));
  round.tick(0.2, 3, false);
  assert.equal(round.player.to, -1);
  assert.equal(round.player.cell, tileAt(2, 1));
});

test('a bomb placed by a rival blocks a pilot already approaching that tile', () => {
  const round = grid();
  round.actors[1].cell = tileAt(2, 1);
  round.tick(0.03, 1, false);
  assert.equal(round.player.to, tileAt(2, 1));
  round.plant(round.actors[1]);
  round.tick(0.12, 1, false);
  assert.equal(round.player.cell, tileAt(1, 1));
  assert.equal(round.player.to, -1);
});

test('all upgrades are collectable and range and capacity are bounded', () => {
  const round = grid();
  const player = round.player;
  for (const item of ['range', 'bomb', 'speed'] as const) {
    for (let i = 0; i < 12; i++) {
      round.items.set(player.cell, item);
      round.tick(0.01, null, false);
    }
  }
  assert.equal(player.range, 8);
  assert.equal(player.capacity, 6);
  assert.equal(player.speed, 8.5);
  assert.equal(player.score, 36 * 35);
});

test('the player can win, lose, or draw; timeout singles out the highest-scoring survivor', () => {
  const last = grid();
  last.actors.slice(1).forEach(rival => { rival.alive = false; });
  last.tick(0.02, null, false);
  assert.equal(last.outcome, 'win');
  assert.equal(last.player.score, 500);
  last.tick(0.5, null, false);
  assert.equal(last.player.score, 500);
  const timeout = grid();
  timeout.time = ROUND_SECONDS;
  timeout.tick(0.02, null, false);
  assert.equal(timeout.outcome, 'draw');
  const ahead = grid();
  ahead.player.score = 35;
  ahead.time = ROUND_SECONDS;
  ahead.tick(0.02, null, false);
  assert.equal(ahead.outcome, 'win');
  const behind = grid();
  behind.actors[1].score = 35;
  behind.time = ROUND_SECONDS;
  behind.tick(0.02, null, false);
  assert.equal(behind.outcome, 'loss');
});

test('an AI plants in attack range and walks out of the future blast', () => {
  const round = grid();
  round.actors[1].cell = tileAt(5, 5);
  round.actors[1].thinkAt = 0;
  round.player.cell = tileAt(5, 7);
  assert.equal(new Set(round.actors.map(actor => CREW[actor.pilot])).size, 4);
  let planted = false;
  for (let i = 0; i < 190; i++) {
    round.tick(1 / 60, null, false);
    planted ||= round.events.some(event => event.type === 'plant' && event.actor === 1);
    if (round.outcome) break;
  }
  assert.ok(planted);
  assert.ok(round.actors[1].alive);
  assert.equal(round.outcome, 'loss');
  assert.equal(round.actors[1].kills, 1);
});
