import { type Box, type Vec3, rayBox, normalize, distance, clamp } from './math';
export interface Prop extends Box {
    kind: 'container' | 'crate' | 'wall' | 'roof' | 'step';
    color?: string;
    label?: string;
}
export const WIDTH = 30, LENGTH = 62;
export const props: Prop[] = [];
const put = (kind: Prop['kind'], x: number, y: number, z: number, w: number, h: number, d: number, color?: string, label?: string) => props.push({ kind, x, y, z, w, h, d, color, label });
// Dimensions are gameplay metres. Every solid is shared by render, collision and line of sight.
put('wall', -15, 1, 0, .5, 2, 62);
put('wall', 15, 1, 0, .5, 2, 62);
put('wall', 0, 2, -31, 30, 4, .5);
put('wall', 0, 2, 31, 30, 4, .5);
for (const side of [-1, 1]) {
    // Rotationally symmetric forward cover and two protected spawn exits.
    put('container', side * 5, 1.7, side * 21, 6, 3.4, 4.3, '#405c53', side > 0 ? 'A—01' : 'B—01');
    put('container', side * -6, 1.7, side * 14, 5, 3.4, 7, '#51685b', side > 0 ? 'MERCURY' : 'PACIFIC');
    put('container', side * 7.7, 1.7, side * 3, 4.2, 3.4, 9.5, '#546a5c', 'CARGO 07');
    put('crate', side * 2.6, 1.35, side * 5, 3.5, 2.7, 3.5);
    put('crate', side * -2.7, .65, side * 11.2, 2.3, 1.3, 2.3);
    put('crate', side * 8.3, .65, side * 11, 2.3, 1.3, 2.3);
    put('crate', side * 1, .58, side * 18, 1.8, 1.16, 1.8);
    put('crate', side * -7.3, .64, side * 25, 2, 1.28, 2);
    // Enclosed outer flank, with stepped access to an elevated firing platform.
    put('wall', side * 11, 1.55, side * 9, 0.4, 3.1, 28, '#737c79');
    put('roof', side * 12.8, 3.25, side * 12.5, 3.5, .3, 21, '#505b59');
    put('container', side * 12.8, 1.55, side * -7, 3.5, 3.1, 4, '#344e48', 'UPPER DECK');
    for (let i = 0; i < 7; i++)
        put('step', side * 12.8, (i + 1) * .22, side * (.8 - i * .85), 3.3, (i + 1) * .44, .88, '#818b86');
}
export const solids: Box[] = props;
export const spawns: [
    Vec3[],
    Vec3[]
] = [
    [-7, -2, 3, 8].map(x => ({ x, y: 0, z: 27 })), [-8, -3, 2, 7].map(x => ({ x, y: 0, z: -27 }))
];
export function wallDistance(origin: Vec3, dir: Vec3, max = 120): number {
    let nearest = max;
    for (const box of solids) {
        const hit = rayBox(origin, dir, box, nearest);
        if (hit !== null)
            nearest = Math.min(nearest, hit);
    }
    return nearest;
}
export function visible(a: Vec3, b: Vec3): boolean {
    const length = distance(a, b);
    return wallDistance(a, normalize({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }), length) >= length - .05;
}
export function overlaps(x: number, z: number, b: Box, r = .32): boolean {
    return x + r > b.x - b.w / 2 && x - r < b.x + b.w / 2 && z + r > b.z - b.d / 2 && z - r < b.z + b.d / 2;
}
export function canStand(x: number, y: number, z: number, height = 1.8): boolean {
    if (Math.abs(x) > WIDTH / 2 - .6 || Math.abs(z) > LENGTH / 2 - .6) return false;
    return !solids.some(b => overlaps(x, z, b) && y + height > b.y - b.h / 2 + .02 && y < b.y + b.h / 2 - .02);
}
export function moveBody(p: Vec3, dx: number, dz: number, height: number, grounded: boolean): void {
    // Small per-tick displacement prevents tunnelling; each horizontal axis slides separately.
    for (const axis of ['x', 'z'] as const) {
        // The arena boundary also applies above the railings, preventing escapes from the high platform.
        const limit = (axis === 'x' ? WIDTH : LENGTH) / 2 - .6;
        const next = clamp(p[axis] + (axis === 'x' ? dx : dz), -limit, limit);
        const x = axis === 'x' ? next : p.x, z = axis === 'z' ? next : p.z;
        const blocks = solids.filter(b => overlaps(x, z, b) && p.y + height > b.y - b.h / 2 + .02 && p.y < b.y + b.h / 2 - .02);
        if (!blocks.length) {
            p[axis] = next;
            continue;
        }
        const top = Math.max(...blocks.map(b => b.y + b.h / 2));
        if (grounded && top - p.y <= .48 && canStand(x, top, z, height)) {
            p.y = top;
            p[axis] = next;
        }
    }
}
export function floorAt(p: Vec3, previousY: number): number {
    let floor = 0;
    for (const b of solids) {
        const top = b.y + b.h / 2;
        if (overlaps(p.x, p.z, b, .28) && top <= previousY + .05)
            floor = Math.max(floor, top);
    }
    return floor;
}
