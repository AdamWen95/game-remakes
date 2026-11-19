export type Vec = { x: number; y: number; z: number };
export type Surface = 'teal' | 'navy' | 'rust' | 'cream' | 'wood' | 'steel' | 'grate' | 'rail';
export type Solid = Vec & {
  w: number; h: number; d: number; surface: Surface; container?: string; walk?: boolean; invisible?: boolean;
};

export const DECK = { x: 14.8, z: 32 };
export const RADIUS = .33;
export const regions = [
  { label: '左舷维修道', x: -11.7, z: -2 },
  { label: '冷柜货区', x: 1, z: -9 },
  { label: '中央装卸区', x: 1, z: 4 },
  { label: '右舷外廊', x: 12, z: 0 },
  { label: '蓝队甲板', x: 0, z: 28 },
  { label: '红队甲板', x: 0, z: -28 },
];
export const spawns = [
  [{ x: -1.8, y: 0, z: 27.5 }, { x: -8.8, y: 0, z: 28 }, { x: 5, y: 0, z: 29.5 }, { x: 11.5, y: 0, z: 28.4 }],
  [{ x: 1.8, y: 0, z: -28 }, { x: 10.8, y: 0, z: -27.5 }, { x: -5, y: 0, z: -29.5 }, { x: -11.8, y: 0, z: -28.4 }],
] as const;
export const practiceSpots = [
  { x: -1.8, y: 0, z: 20.7 }, { x: 3.8, y: 0, z: 17.5 },
  { x: -11.6, y: 0, z: 18.8 }, { x: 10.8, y: 0, z: 12 },
];

const cargo = (x: number, z: number, w: number, d: number, surface: Surface, container: string, y = 0): Solid =>
  ({ x, y, z, w, d, h: 2.74, surface, container });
const crate = (x: number, z: number, w: number, h = 1.34, d = w): Solid =>
  ({ x, y: 0, z, w, h, d, surface: 'wood', walk: true });
const stair = (x: number, from: number, sign: number): Solid[] =>
  Array.from({ length: 10 }, (_, n) => ({
    x, z: from + sign * (n + .5) * .43, y: 0, w: 2.4, d: .43, h: (n + 1) * .24, surface: 'grate', walk: true,
  }));

export const solids: Solid[] = [
  cargo(-6.3, 16.8, 3.3, 10.5, 'teal', 'NORD / 27'),
  cargo(7.7, 12.8, 3.25, 10.3, 'rust', 'KAS / 14'),
  cargo(7.7, 12.8, 3.25, 10.3, 'navy', 'KAS / 08', 2.74),
  cargo(-2.1, 7.7, 8.05, 3.2, 'navy', 'PEL / 63'),
  cargo(-5.4, -5.1, 3.25, 11, 'cream', 'ICE / 11'),
  cargo(5.1, -3.8, 3.25, 10.1, 'teal', 'NORD / 05'),
  cargo(4.7, -15, 8.2, 3.25, 'rust', 'KAS / 26'),
  cargo(-5.9, -17.2, 3.3, 10.8, 'navy', 'PEL / 44'),
  cargo(-5.9, -17.2, 3.3, 10.8, 'teal', 'NORD / 19', 2.74),
  cargo(9.7, -20.6, 3.2, 7.8, 'cream', 'ICE / 31'),
  crate(3, 23.9, 2, 1.57, 1.65), crate(-5, 25, 1.73, 1.54), crate(-9.2, 11.6, 1.57, 1.56),
  crate(3, 5, 2.2, 1.6, 1.6), crate(10.8, 3.4, 2, 1.35, 2.4), crate(-9.2, 0, 2, 1.6),
  crate(-.65, -3.1, 2, 1.72, 2.25), crate(0, -18.7, 2.55, 1.6, 1.85), crate(5.6, -24, 2.2, 1.48),
  crate(-8.4, -25.5, 2.3, 1.6), crate(10, -7, 1.9, 1.48, 2.4),
  { x: -11.9, y: 2.12, z: -.75, w: 2.4, h: .28, d: 18.5, surface: 'grate', walk: true },
  ...stair(-11.9, 12.8, -1), ...stair(-11.9, -14.3, 1),
  ...[-9.5, -.75, 8].flatMap(z => [-13.03, -10.78].map(x =>
    ({ x, y: 0, z, w: .23, d: .27, h: 2.15, surface: 'steel' as const }))),
  ...[-13.09, -10.71].map(x => ({
    x, y: 2.4, z: -.75, w: .12, d: 18.5, h: 1.03, surface: 'rail' as const, invisible: true,
  })),
  { x: 12.05, y: 2.6, z: 7.7, w: 4.42, h: .19, d: 7.25, surface: 'teal' },
  ...[4.16, 11.21].flatMap(z => [10.01, 14.09].map(x =>
    ({ x, y: 0, z, w: .22, d: .25, h: 2.6, surface: 'steel' as const }))),
];

export function rayBox(o: Vec, d: Vec, lo: Vec, hi: Vec, cap: number) {
  let near = 0, far = cap;
  for (const k of ['x', 'y', 'z'] as const) {
    if (Math.abs(d[k]) < 1e-8) {
      if (o[k] < lo[k] || o[k] > hi[k]) return Infinity;
      continue;
    }
    const a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k];
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return Infinity;
  }
  return near;
}

export function wallDistance(o: Vec, d: Vec, range: number) {
  let best = range;
  for (const s of solids) {
    if (s.surface === 'rail') continue;
    best = Math.min(best, rayBox(o, d,
      { x: s.x - s.w / 2, y: s.y, z: s.z - s.d / 2 },
      { x: s.x + s.w / 2, y: s.y + s.h, z: s.z + s.d / 2 }, best));
  }
  if (d.y < 0 && o.y >= 0) best = Math.min(best, -o.y / d.y);
  return best;
}

function overlaps(x: number, z: number, s: Solid, r: number) {
  const dx = Math.max(Math.abs(x - s.x) - s.w / 2, 0);
  const dz = Math.max(Math.abs(z - s.z) - s.d / 2, 0);
  return dx * dx + dz * dz < r * r;
}

export function floorAt(x: number, z: number, from: number, radius = RADIUS) {
  let floor = 0;
  for (const s of solids) {
    const top = s.y + s.h;
    if (s.surface !== 'rail' && top <= from && top > floor && overlaps(x, z, s, radius)) floor = top;
  }
  return floor;
}

export function canStand(x: number, z: number, y: number, height: number, radius = RADIUS) {
  if (Math.abs(x) > DECK.x - radius || Math.abs(z) > DECK.z - radius) return false;
  return !solids.some(s => s.y + s.h > y + .035 && s.y < y + height - .015 && overlaps(x, z, s, radius));
}

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const length = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const along = (o: Vec, d: Vec, t: number): Vec => ({ x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t });
export const direction = (yaw: number, pitch: number): Vec => ({
  x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch),
});
export function lookAt(a: Vec, b: Vec) {
  return { yaw: Math.atan2(a.x - b.x, a.z - b.z), pitch: Math.atan2(b.y - a.y, Math.hypot(a.x - b.x, a.z - b.z)) };
}
