import { canStand } from './map';
import type { Vec3 } from './math';
const W = 29, H = 59;
const index = (x: number, z: number) => (z + 29) * W + x + 14;
const point = (n: number): Vec3 => ({ x: n % W - 14, y: 0, z: Math.floor(n / W) - 29 });
const grid = new Uint8Array(W * H);
for (let z = -29; z <= 29; z++)
    for (let x = -14; x <= 14; x++)
        grid[index(x, z)] = canStand(x, 0, z) ? 1 : 0;
function nearest(p: Vec3): number {
    let best = -1, dist = Infinity;
    for (let n = 0; n < grid.length; n++)
        if (grid[n]) {
            const q = point(n), d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
            if (d < dist) {
                dist = d;
                best = n;
            }
        }
    return best;
}
export function findPath(start: Vec3, goal: Vec3): Vec3[] {
    const from = nearest(start), to = nearest(goal);
    if (from < 0 || to < 0)
        return [];
    const queue = [from], prev = new Int32Array(grid.length).fill(-1);
    prev[from] = from;
    for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        if (current === to)
            break;
        const x = current % W;
        for (const next of [x > 0 ? current - 1 : -1, x < W - 1 ? current + 1 : -1, current - W, current + W]) {
            if (next < 0 || next >= grid.length || !grid[next] || prev[next] !== -1)
                continue;
            prev[next] = current;
            queue.push(next);
        }
    }
    if (prev[to] < 0)
        return [];
    const route: Vec3[] = [];
    for (let n = to; n !== from; n = prev[n])
        route.push(point(n));
    return route.reverse();
}
