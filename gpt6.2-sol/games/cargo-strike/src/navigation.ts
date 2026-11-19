import { DECK, canStand, floorAt, type Vec } from './arena.ts';

// Ground routes are shared across heights. Two stair approaches and the catwalk
// form a separate landmark for the player. Bots only use the ground network.
const spacing = .9;
const cols = 33, rows = 71;
const positions = Array.from({ length: cols * rows }, (_, i) => ({
  x: (i % cols - (cols - 1) / 2) * spacing, y: 0, z: (Math.floor(i / cols) - (rows - 1) / 2) * spacing,
}));
const open = positions.map(p => canStand(p.x, p.z, 0, 1.8, .57) && floorAt(p.x, p.z, .3) === 0);
const links = positions.map((_, i) => {
  if (!open[i]) return [];
  const x = i % cols, z = Math.floor(i / cols);
  const neighbors: number[] = [];
  for (const [dx, dz] of [[0, -1], [-1, 0], [0, 1], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    if (x + dx < 0 || x + dx >= cols || z + dz < 0 || z + dz >= rows) continue;
    const n = i + dz * cols + dx;
    if (open[n] && open[i + dx] && open[i + dz * cols]) neighbors.push(n);
  }
  return neighbors;
});

function closest(p: Vec) {
  const col = Math.round(p.x / spacing + (cols - 1) / 2);
  const row = Math.round(p.z / spacing + (rows - 1) / 2);
  let index = -1, best = Infinity;
  for (let z = Math.max(0, row - 4); z <= Math.min(rows - 1, row + 4); z++) {
    for (let x = Math.max(0, col - 4); x <= Math.min(cols - 1, col + 4); x++) {
      const i = z * cols + x, cell = positions[i];
      const d = (cell.x - p.x) ** 2 + (cell.z - p.z) ** 2;
      if (open[i] && d < best) { index = i; best = d; }
    }
  }
  return index;
}

export function route(from: Vec, to: Vec): Vec[] {
  if (Math.abs(to.x) > DECK.x || Math.abs(to.z) > DECK.z) return [];
  const start = closest(from), end = closest(to);
  if (start < 0 || end < 0) return [];
  if (start === end) return [positions[end]];
  const previous = new Int16Array(positions.length).fill(-1);
  previous[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length && previous[end] < 0; head++) {
    const current = queue[head];
    for (const next of links[current]) {
      if (previous[next] >= 0) continue;
      previous[next] = current;
      queue.push(next);
    }
  }
  if (previous[end] < 0) return [];
  const path: Vec[] = [];
  for (let i = end; i !== start; i = previous[i]) path.push(positions[i]);
  return path.reverse();
}
