export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
export interface Box {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
}
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const direction = (yaw: number, pitch: number): Vec3 => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
export function normalize(v: Vec3): Vec3 { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n }; }
export function rayBox(o: Vec3, v: Vec3, b: Box, range = 150): number | null {
    let near = 0, far = range;
    for (const [axis, size] of [['x', 'w'], ['y', 'h'], ['z', 'd']] as const) {
        const low = b[axis] - b[size] / 2, high = b[axis] + b[size] / 2;
        if (Math.abs(v[axis]) < 1e-8) {
            if (o[axis] < low || o[axis] > high)
                return null;
            continue;
        }
        let a = (low - o[axis]) / v[axis], c = (high - o[axis]) / v[axis];
        if (a > c)
            [a, c] = [c, a];
        near = Math.max(near, a);
        far = Math.min(far, c);
        if (near > far)
            return null;
    }
    return near;
}
export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number | null {
    const x = o.x - c.x, y = o.y - c.y, z = o.z - c.z, b = x * d.x + y * d.y + z * d.z;
    const q = b * b - (x * x + y * y + z * z - r * r);
    if (q < 0)
        return null;
    const t = -b - Math.sqrt(q);
    return t >= 0 ? t : null;
}
export function randomSeed(seed: number) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
