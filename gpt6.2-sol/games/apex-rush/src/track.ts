export type Point = [number, number, number];
export type TrackId = 'coast' | 'canyon' | 'metro';

export const courses = [
  {
    id: 'coast', name: '潮汐港', english: 'TIDEWATER BAY', accent: '#ffca63',
    feature: '滨海栈桥 · 连续弯',
    nodes: [[-198, 8, -94], [-35, 9, -112], [153, 12, -110], [224, 15, -48],
      [197, 20, 82], [91, 22, 113], [28, 16, 46], [-78, 10, 40],
      [-157, 8, 116], [-253, 7, 107], [-273, 7, -6]] as Point[],
    pads: [[.27, 3.5], [.68, -3.6]] as const,
  },
  {
    id: 'canyon', name: '晶脊谷', english: 'CRYSTAL RIDGE', accent: '#ff8b72',
    feature: '山脊跃坡 · 发卡弯',
    nodes: [[-199, 24, -128], [-53, 31, -147], [98, 48, -157], [172, 49, -87],
      [105, 41, -15], [18, 31, -30], [-39, 32, 35], [69, 45, 110],
      [185, 32, 121], [237, 19, 188], [72, 14, 240], [-96, 17, 194],
      [-229, 16, 129], [-273, 16, -14]] as Point[],
    pads: [[.37, -3.3], [.65, 4.3]] as const,
  },
  {
    id: 'metro', name: '零点环城', english: 'MIDNIGHT LOOP', accent: '#81e4f5',
    feature: '夜间高架 · 高速折弯',
    nodes: [[-222, 12, -136], [-62, 12, -137], [165, 15, -137], [229, 20, -73],
      [241, 26, 68], [182, 29, 131], [63, 22, 129], [-12, 17, 57],
      [-86, 12, 108], [-211, 12, 128], [-281, 12, 59], [-283, 12, -62]] as Point[],
    pads: [[.22, -4.2], [.73, 3.8]] as const,
  },
] as const;

export const cars = [
  { id: 'spark', name: '曜锋', english: 'SPARK', color: '#ffca4c', trait: '均衡 · 起步稳定', top: 65, acceleration: 18, grip: 1.04 },
  { id: 'viper', name: '赤电', english: 'VIPER', color: '#fd624d', trait: '极速 · 擅长直道', top: 72, acceleration: 16, grip: .93 },
  { id: 'atlas', name: '银翼', english: 'ATLAS', color: '#74e1ea', trait: '操控 · 适合多弯', top: 61, acceleration: 20.5, grip: 1.16 },
] as const;

export type Course = typeof courses[number];
export type CarSpec = typeof cars[number];
export const ROAD_HALF = 10.7;
export const WALL = 12.1;
export const wrap = (value: number, period: number) => ((value % period) + period) % period;
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

type Station = { x: number; y: number; z: number; yaw: number; curve: number };
type Sample = { x: number; y: number; z: number; s: number };

function spline(p0: number, p1: number, p2: number, p3: number, t: number) {
  return p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * p1 - p0 - 3 * p2 + p3)));
}

export class Track {
  readonly course: Course;
  readonly length: number;
  readonly segments: number;
  readonly interval: number;
  readonly samples: Station[];

  constructor(course: Course) {
    this.course = course;
    const dense: Sample[] = [];
    const { nodes } = course;
    for (let section = 0; section < nodes.length; section++) {
      const [a, b, c, d] = [-1, 0, 1, 2].map(delta => nodes[wrap(section + delta, nodes.length)]);
      for (let j = 0; j < 96; j++) {
        const t = j / 96;
        const [x, y, z] = [0, 1, 2].map(axis => spline(a[axis], b[axis], c[axis], d[axis], t));
        const last = dense.at(-1);
        dense.push({ x, y, z, s: last ? last.s + Math.hypot(x - last.x, z - last.z) : 0 });
      }
    }
    const end = dense[dense.length - 1];
    this.length = end.s + Math.hypot(end.x - dense[0].x, end.z - dense[0].z);
    dense.push({ ...dense[0], s: this.length });
    this.segments = Math.ceil(this.length / 2.35);
    this.interval = this.length / this.segments;
    let index = 0;
    this.samples = Array.from({ length: this.segments }, (_, step) => {
      const s = step * this.interval;
      while (dense[index + 1].s < s) index++;
      const a = dense[index];
      const b = dense[index + 1];
      const t = (s - a.s) / (b.s - a.s);
      return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t), yaw: 0, curve: 0 };
    });
    const at = (i: number) => this.samples[wrap(i, this.segments)];
    this.samples.forEach((sample, i) => {
      const before = at(i - 1);
      const next = at(i + 1);
      sample.yaw = Math.atan2(next.x - before.x, next.z - before.z);
    });
    this.samples.forEach((sample, i) => {
      sample.curve = angleDiff(at(i - 3).yaw, at(i + 3).yaw) / (6 * this.interval);
    });
  }

  sample(distance: number, lateral = 0): Station {
    const index = wrap(distance, this.length) / this.interval;
    const whole = Math.floor(index);
    const fraction = index - whole;
    const a = this.samples[whole % this.segments];
    const b = this.samples[(whole + 1) % this.segments];
    const yaw = a.yaw + angleDiff(a.yaw, b.yaw) * fraction;
    return {
      x: mix(a.x, b.x, fraction) + lateral * Math.cos(yaw),
      y: mix(a.y, b.y, fraction),
      z: mix(a.z, b.z, fraction) - lateral * Math.sin(yaw),
      yaw, curve: mix(a.curve, b.curve, fraction),
    };
  }

  outline(width: number, height: number, pad = 7) {
    const xs = this.samples.map(p => p.x);
    const zs = this.samples.map(p => p.z);
    const spans = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const scale = Math.min((width - 2 * pad) / (spans[1] - spans[0]), (height - 2 * pad) / (spans[3] - spans[2]));
    return (p: Pick<Station, 'x' | 'z'>): [number, number] => [
      width / 2 + (p.x - (spans[0] + spans[1]) / 2) * scale,
      height / 2 + (p.z - (spans[2] + spans[3]) / 2) * scale,
    ];
  }
}

export function angleDiff(from: number, to: number) {
  return wrap(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

export const tracks = courses.map(course => new Track(course));
