import { COLS, ROWS, type Cell, type Point, randomGenerator, key } from './types';

export const SPAWNS: Point[] = [{ x: 1, y: 1 }, { x: 13, y: 11 }, { x: 13, y: 1 }, { x: 1, y: 11 }];

export function generateMap(seed: number, theme: number): Cell[] {
  const random = randomGenerator(seed);
  const cells: Cell[] = Array(COLS * ROWS).fill('floor');
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const index = key(x, y);
      if (!x || !y || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) cells[index] = 'wall';
      else if (random() < [0.62, 0.7, 0.58][theme]) cells[index] = 'crate';
    }
  }
  // All four corners have equivalent openings, including an escape bend.
  for (const spawn of SPAWNS) {
    const dx = spawn.x === 1 ? 1 : -1, dy = spawn.y === 1 ? 1 : -1;
    for (const [a, b] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [2, 1], [1, 2]]) {
      cells[key(spawn.x + a * dx, spawn.y + b * dy)] = 'floor';
    }
  }
  for (let x = 1; x < COLS - 1; x++) cells[key(x, 5)] = 'floor';
  for (let y = 1; y < ROWS - 1; y++) cells[key(7, y)] = 'floor';
  return cells;
}
