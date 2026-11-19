export const COLS = 15;
export const ROWS = 11;
export const CELL = 56;
export const WIDTH = COLS * CELL;
export const HEIGHT = ROWS * CELL;

export const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
export type Direction = 0 | 1 | 2 | 3;
export const Tile = { Floor: 0, Wall: 1, Crate: 2 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];
export const tileAt = (x: number, y: number) => y * COLS + x;
export const col = (index: number) => index % COLS;
export const row = (index: number) => Math.floor(index / COLS);
export const adjacent = (index: number, direction: Direction) => {
  const [dx, dy] = DIRECTIONS[direction];
  const x = col(index) + dx;
  const y = row(index) + dy;
  return x >= 0 && x < COLS && y >= 0 && y < ROWS ? tileAt(x, y) : -1;
};
export const distance = (a: number, b: number) => Math.abs(col(a) - col(b)) + Math.abs(row(a) - row(b));

export const SPAWNS = [tileAt(1, 1), tileAt(13, 9), tileAt(13, 1), tileAt(1, 9)];
export const MAPS = [
  { id: 'garden', name: '青柠花园', note: '藤蔓与巷道', floor: ['#90d9a3', '#a8e4ae'], trim: '#65b484', wall: ['#acedd1', '#55aa91', '#337a68'], crate: ['#ffce80', '#e39649', '#a85733'], ink: '#2b7a57' },
  { id: 'coast', name: '汽水海湾', note: '开阔的海岸', floor: ['#9cdbdf', '#b6eced'], trim: '#61b3c0', wall: ['#b5efff', '#58a6ce', '#365e9c'], crate: ['#ffe6a2', '#dfa764', '#a96e4d'], ink: '#268197' },
  { id: 'night', name: '月光糖港', note: '星光与回廊', floor: ['#7774ae', '#8885be'], trim: '#625c9a', wall: ['#d7c6ff', '#8973c6', '#4d448a'], crate: ['#ffc0d8', '#d875a5', '#963971'], ink: '#524284' },
] as const;
export type Arena = typeof MAPS[number];
export type MapChoice = Arena['id'] | 'random';

export function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeMap(choice: MapChoice, random: () => number) {
  const arena = choice === 'random' ? MAPS[Math.floor(random() * MAPS.length)] : MAPS.find(map => map.id === choice) ?? MAPS[0];
  const tiles = new Array<Tile>(COLS * ROWS).fill(Tile.Floor);
  for (let index = 0; index < tiles.length; index++) {
    const x = col(index);
    const y = row(index);
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
      tiles[index] = Tile.Wall;
    } else if (!(x % 2) && !(y % 2)) {
      const opening = arena.id === 'coast' && (y === 4 || y === 6) && (x === 6 || x === 8);
      const grove = arena.id === 'garden' && (x === 4 || x === 10) && y === 6;
      if (!opening && !grove) tiles[index] = Tile.Wall;
    }
  }
  const density = arena.id === 'coast' ? 0.41 : arena.id === 'night' ? 0.60 : 0.51;
  for (let index = 0; index <= (tiles.length - 1) / 2; index++) {
    const opposite = tiles.length - 1 - index;
    if (tiles[index] !== Tile.Floor || tiles[opposite] !== Tile.Floor) continue;
    if (SPAWNS.some(spawn => distance(spawn, index) <= 1 || distance(spawn, opposite) <= 1)) continue;
    if (random() < density) tiles[index] = tiles[opposite] = Tile.Crate;
  }
  return { arena, tiles };
}
