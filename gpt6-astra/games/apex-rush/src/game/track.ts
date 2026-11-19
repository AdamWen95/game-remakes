export type Point = { x: number; y: number; z: number };
export type Sample = Point & { yaw: number; curvature: number };
export type TrackId = 'coast' | 'city' | 'alpine';
export interface TrackDefinition {
  id: TrackId; name: string; english: string; tagline: string; difficulty: string;
  sky: number; fog: number; ground: number; road: number; accent: number;
  points: [number, number][]; elevation: number; width: number;
}
export const TRACKS: TrackDefinition[] = [
  { id: 'coast', name: '晴空海岸', english: 'SUNSET COAST', tagline: '海风、棕榈与无尽弯道', difficulty: '入门',
    sky: 0x93cddc, fog: 0xaed4db, ground: 0x29a8b8, road: 0x384e5b, accent: 0x55e8df, elevation: 2, width: 18,
    points: [[0,0],[0,170],[60,265],[200,295],[320,220],[335,100],[260,25],[320,-110],[240,-225],[90,-260],[-50,-210],[-110,-100],[-65,-25]] },
  { id: 'city', name: '霓虹环线', english: 'NEON CIRCUIT', tagline: '在城市灯火里，追上自己的极限', difficulty: '进阶',
    sky: 0x101b38, fog: 0x253252, ground: 0x131f35, road: 0x29354e, accent: 0xd68aff, elevation: 0.6, width: 17,
    points: [[0,0],[0,160],[70,220],[210,215],[270,150],[245,70],[130,60],[135,-20],[280,-80],[270,-200],[150,-250],[10,-235],[-95,-140],[-80,-35]] },
  { id: 'alpine', name: '云顶山道', english: 'ALPINE PASS', tagline: '穿越松林，奔向云端', difficulty: '挑战',
    sky: 0xb3d0e2, fog: 0xc5dbe7, ground: 0x80a6a0, road: 0x49596a, accent: 0xa7f06a, elevation: 13, width: 16,
    points: [[0,0],[0,130],[70,190],[160,150],[155,65],[260,75],[340,180],[435,125],[440,0],[345,-65],[365,-180],[250,-235],[130,-170],[65,-240],[-60,-180],[-75,-55]] },
];
export const wrap = (v: number, length: number) => ((v % length) + length) % length;
export const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function catmull(a: number, b: number, c: number, d: number, t: number) {
  return 0.5 * ((2*b) + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t);
}
export class Track {
  readonly points: Point[] = [];
  readonly distances: number[] = [0];
  readonly length: number;
  readonly boosts: number[];
  constructor(readonly definition: TrackDefinition) {
    const count = definition.points.length, steps = count * 80;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps * count, index = Math.floor(u) % count, t = u % 1;
      const p = [-1, 0, 1, 2].map(offset => definition.points[wrap(index + offset, count)]);
      const x = catmull(p[0][0], p[1][0], p[2][0], p[3][0], t);
      const z = catmull(p[0][1], p[1][1], p[2][1], p[3][1], t);
      const y = 5 + definition.elevation * (1 - Math.cos(i / steps * Math.PI * 4)) / 2;
      this.points.push({ x, y, z });
      if (i) this.distances.push(this.distances[i-1] + Math.hypot(x-this.points[i-1].x, y-this.points[i-1].y, z-this.points[i-1].z));
    }
    this.length = this.distances[steps];
    this.boosts = [0.18, 0.48, 0.77].map(p => p * this.length);
  }
  private point(distance: number): Point {
    const s = wrap(distance, this.length);
    let low = 0, high = this.distances.length - 1;
    while (low + 1 < high) { const mid = (low + high) >> 1; if (this.distances[mid] <= s) low = mid; else high = mid; }
    const f = (s - this.distances[low]) / (this.distances[high] - this.distances[low]);
    const a = this.points[low], b = this.points[high];
    return { x: a.x+(b.x-a.x)*f, y: a.y+(b.y-a.y)*f, z: a.z+(b.z-a.z)*f };
  }
  sample(distance: number, lateral = 0): Sample {
    const p = this.point(distance), before = this.point(distance-2), after = this.point(distance+2);
    const yaw = Math.atan2(after.x-before.x, after.z-before.z);
    const ahead = this.point(distance+8), back = this.point(distance-8);
    const a = Math.atan2(p.x-back.x, p.z-back.z), b = Math.atan2(ahead.x-p.x, ahead.z-p.z);
    // +lateral is the driver's right (forward × up), including a +Z starting straight.
    return { x: p.x-Math.cos(yaw)*lateral, y: p.y, z: p.z+Math.sin(yaw)*lateral, yaw, curvature: angleDifference(b,a)/8 };
  }
}
