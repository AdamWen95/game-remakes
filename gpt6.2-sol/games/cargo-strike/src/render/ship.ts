import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DECK, solids, type Solid } from '../arena.ts';
import { pallet, sign } from './materials.ts';

type Material = T.Material;
type Box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: Material) => void;

export function createShip(scene: T.Scene) {
  const m = pallet();
  const batches = new Map<Material, T.BufferGeometry[]>();
  function add(geometry: T.BufferGeometry, mat: Material) {
    const batch = batches.get(mat) ?? [];
    if (!batches.has(mat)) batches.set(mat, batch);
    batch.push(geometry);
  }
  const box: Box = (x, y, z, w, h, d, mat) => add(new T.BoxGeometry(w, h, d).translate(x, y, z), mat);
  function rod(a: [number, number, number], b: [number, number, number], r: number, mat: Material, sides = 8) {
    const point = new T.Vector3(...a);
    const dir = new T.Vector3(...b).sub(point);
    const len = dir.length();
    const mid = point.addScaledVector(dir, .5);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    const matrix = new T.Matrix4().compose(mid, q, new T.Vector3(1, 1, 1));
    add(new T.CylinderGeometry(r, r, len, sides).applyMatrix4(matrix), mat);
  }
  function stencil(x: number, y: number, z: number, rotation: number, size: number, line: string, detail: string, dark = false) {
    const geo = new T.PlaneGeometry(size, size).rotateY(rotation).translate(x, y, z);
    add(geo, sign(line, detail, dark ? '#263b3f' : '#d7d9c4'));
  }
  function deckStencil(x: number, z: number, width: number, rotation: number, line: string, detail: string) {
    const geo = new T.PlaneGeometry(width, width).rotateZ(rotation).rotateX(-Math.PI / 2).translate(x, .017, z);
    add(geo, sign(line, detail, '#d0bc83'));
  }
  function container(s: Solid) {
    const { x, y, z, w, h, d } = s, mat = m[s.surface];
    const across = w > d;
    const l = across ? w : d, width = across ? d : w;
    const origin = (u: number, v: number) => [x + (across ? u : v), z + (across ? v : u)] as const;
    const piece: Box = (u, yy, v, l, hh, ww, material) => {
      const [px, pz] = origin(u, v);
      box(px, yy, pz, across ? l : ww, hh, across ? ww : l, material);
    };
    piece(0, y + h / 2, 0, l - .06, h, width - .11, mat);
    for (const side of [-1, 1]) {
      for (let u = -l / 2 + .2; u < l / 2 - .12; u += .257) {
        piece(u, y + h / 2, side * (width / 2 - .04), .098, h - .24, .105, mat);
        piece(u, y + h + .009, 0, .082, .026, width - .17, mat);
      }
      piece(0, y + .085, side * (width / 2 - .012), l + .04, .15, .095, m.edge);
      piece(0, y + h - .05, side * (width / 2 - .012), l + .04, .13, .11, mat);
      for (const end of [-1, 1]) {
        piece(end * l / 2, y + h / 2, side * (width / 2 - .04), .17, h, .15, mat);
        for (const level of [.13, h - .09]) piece(end * l / 2, y + level, side * (width / 2 - .043), .24, .19, .23, m.edge);
        piece(end * (l / 2 + .037), y + h / 2, side * .53, .039, h - .32, .057, m.bolt);
        for (const level of [.22, .76, h - .24]) piece(end * (l / 2 + .059), y + level, side * .53, .065, .08, .11, m.edge);
      }
      const [sx, sz] = origin(-.56, side * (width / 2 + .018));
      stencil(sx, y + 1.43, sz, across ? (side === 1 ? 0 : Math.PI) : side * Math.PI / 2, 2.38,
        s.container!, 'DECK FREIGHT   /   2261', s.surface === 'cream');
    }
    if (s.surface === 'cream') {
      piece(-l / 2 - .11, y + h * .52, 0, .23, 1.3, 1.42, m.dark);
      for (let v = -.51; v <= .51; v += .12) piece(-l / 2 - .255, y + h * .52, v, .038, 1.05, .04, m.steel);
    }
  }
  function crate(s: Solid) {
    const { x, y, z, w, h, d } = s;
    box(x, y + h / 2, z, w, h, d, m.wood);
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        box(x + side * (w / 2 - .09), y + h / 2, z + end * (d / 2 - .06), .19, h + .012, .18, m.plank);
        box(x, y + h / 2 + side * (h / 2 - .12), z + end * (d / 2 + .009), w + .025, .175, .08, m.plank);
        box(x + end * (w / 2 + .01), y + h / 2 + side * (h / 2 - .12), z, .08, .175, d, m.plank);
      }
    }
    stencil(x, y + h * .56, z + d / 2 + .018, 0, Math.min(1.25, w), 'SHIP', 'NO STACK', true);
  }
  box(0, -.19, 0, DECK.x * 2, .38, DECK.z * 2, m.deck);
  box(0, -2.17, -.35, 29.7, 3.62, 66.3, m.dark);
  box(0, -4.16, -.34, 29, 1.46, 65.6, m.red);
  for (const s of solids) {
    if (s.invisible) continue;
    if (s.container) container(s);
    else if (s.surface === 'wood') crate(s);
    else {
      box(s.x, s.y + s.h / 2, s.z, s.w, s.h, s.d, m[s.surface]);
      if (s.surface === 'grate') {
        const steps = Math.ceil(s.d / .21);
        for (let i = 0; i < steps; i++)
          box(s.x, s.y + s.h + .012, s.z - s.d / 2 + (i + .5) * s.d / steps, s.w, .018, .039, m.dark);
        if (s.d < .5) box(s.x, s.y + s.h + .015, s.z + s.d * .33, s.w, .024, .033, m.safety);
      }
    }
  }
  const rail = (x: number, ymin: number, z0: number, z1: number, mat: Material) => {
    for (const y of [.41, .98]) rod([x, ymin + y, z0], [x, ymin + y, z1], .037, mat);
    for (let z = z0; z < z1 + .01; z += (z1 - z0) / Math.ceil((z1 - z0) / 2.3)) {
      rod([x, ymin, z], [x, ymin + 1.01, z], .043, mat);
      box(x, ymin + .04, z, .17, .08, .22, m.edge);
    }
  };
  for (const x of [-13.09, -10.71]) rail(x, 2.4, -10, 8.5, m.rail);
  for (const x of [9.91, 14.22]) {
    for (const z of [4.14, 11.26]) {
      box(x, 2.5, z, .21, .32, .24, m.rail);
      rod([x, 1.95, z], [x, 2.65, z + (z < 6 ? .7 : -.7)], .064, m.steel);
      box(x, .08, z, .37, .15, .43, m.dark);
    }
    box(x, 2.61, 7.7, .18, .25, 7.55, m.steel);
  }
  for (const z of [4.25, 7.82, 11.17]) {
    box(12.05, 2.49, z, 4.29, .18, .21, m.edge);
    box(12.13, 2.38, z, .66, .12, .35, m.dark);
    box(12.13, 2.306, z, .54, .05, .22, m.lamp);
  }
  for (const z of [-8, -3.5, 1, 5.5]) {
    box(-11.9, 2.08, z, 2.51, .25, .22, m.steel);
    box(-11.9, 1.927, z, .54, .08, .17, m.lamp);
  }
  deckStencil(-1.37, 25.7, 4.25, 0, '01 / BLUE DECK', 'KEEP WALKWAY CLEAR');
  deckStencil(1.9, -25.6, 4.25, Math.PI, '02 / RED DECK', 'KEEP WALKWAY CLEAR');
  deckStencil(-8.8, 14, 3.75, Math.PI / 2, 'PORT ACCESS', 'MAINTENANCE');
  deckStencil(12.6, 13.8, 3.85, 0, 'WALKWAY', 'STARBOARD SIDE');
  deckStencil(.4, 1.9, 4.9, 0, 'HOLD / 03', 'CARGO LOADING ZONE');
  for (const [x, z] of [[-8.3, 23.4], [8.2, 21.4], [-8.3, -12.6], [9.2, -2.8], [3.7, 9.6], [-3.1, -14.2]]) {
    box(x, .009, z, 1.35, .017, .82, m.edge);
    box(x, .021, z, 1.23, .016, .71, m.grate);
    for (let i = -.29; i < .3; i += .12) box(x, .031, z + i, 1.14, .005, .027, m.dark);
    for (const dx of [-.575, .575]) for (const dz of [-.31, .31]) box(x + dx, .033, z + dz, .055, .013, .05, m.bolt);
  }
  for (const side of [-1, 1]) {
    const x = side * (DECK.x - .07);
    rail(x, .55, -32, 32, m.pale);
    box(x, .3, 0, .18, .6, 64, m.teal);
    box(side * 13.25, .008, 0, .076, .014, 63.2, m.safety);
    for (let z = -30; z < 31; z += 1.62) box(side * 13.68, .009, z, .052, .015, .78, m.white);
    for (let z = -29; z <= 29; z += 8.5) {
      box(side * 14.33, .175, z, .6, .35, 1.05, m.dark);
      rod([side * 14.31, .36, z - .28], [side * 14.31, .71, z - .28], .135, m.rail);
      rod([side * 14.31, .36, z + .28], [side * 14.31, .71, z + .28], .135, m.rail);
    }
    const end = side * 32.1;
    box(0, .91, end, 29.7, 1.82, .45, m.steel);
    box(0, 1.85, end, 29.78, .11, .54, m.teal);
    stencil(side === 1 ? -3.6 : 3.6, 1.04, end - side * .25, side === 1 ? Math.PI : 0, 4.5,
      side === 1 ? 'BLUE  /  01' : 'RED  /  02', 'PELAGIC SERVICE DECK');
    for (const x of [-7, 7]) {
      box(x, 1.18, end - .34 * side, .52, .31, .22, m.dark);
      box(x, 1.18, end - .48 * side, .32, .142, .08, m.lamp);
    }
    for (let x = -13; x <= 13; x += 1) {
      box(x, .012, side * 25.7, .7, .019, .046, side === 1 ? m.blue : m.red);
    }
  }
  for (const [x, z, w, d] of [[-.5, 3, 8.4, 5.8], [1.4, -9.6, 6.5, 3.4]]) {
    for (const side of [-1, 1]) {
      box(x + side * w / 2, .013, z, .065, .022, d, m.safety);
      for (let i = -.4; i < .5; i += .2) box(x + i * w, .013, z + side * d / 2, .94, .022, .067, m.safety);
    }
  }
  // Deckhouse and crane are outside the play area and supply silhouettes from both spawn decks.
  box(0, 2.7, -36.5, 24, 5.6, 8.6, m.pale);
  box(0, 5.8, -36.2, 26, .9, 8.7, m.steel);
  box(0, 7.15, -36.7, 21, 2.12, 7.2, m.pale);
  box(0, 7.36, -33.06, 20.7, 1.02, .12, m.glass);
  for (let x = -9.8; x <= 10; x += 1.3) box(x, 7.36, -32.97, .09, 1.13, .1, m.edge);
  box(0, 8.35, -36.8, 22.5, .24, 7.7, m.white);
  stencil(0, 4.25, -32.17, 0, 6.4, 'MV PELAGIC', 'REGISTRY  /  PEL 2261', true);
  rod([2, 8.4, -36], [2, 15.9, -36], .16, m.pale);
  rod([-2, 12.8, -36], [5.7, 12.8, -36], .06, m.pale);
  box(2, 16, -36, .19, .18, .19, m.lamp);
  box(-6.5, 10.1, -38.6, 2.8, 3.5, 2.1, m.rust);
  box(-6.5, 11.8, -38.6, 2.98, .65, 2.29, m.dark);
  for (const [x, z, reverse] of [[-17.5, -14, 1], [17.5, 19, -1]]) {
    const hinge = x + reverse * 3.6, tip = x + reverse * 15;
    box(x, 1.7, z, 3.5, 5.5, 4, m.steel);
    rod([x, 3.6, z], [x, 12.5, z], .65, m.orange, 12);
    box(x, 12.4, z, 3.65, 2.15, 3.53, m.orange);
    box(x + reverse * 1.35, 12.8, z + 1.797, 1.14, .76, .073, m.glass);
    for (const side of [-1, 1]) {
      const zz = z + side * .49;
      rod([x, 12.9, zz], [tip, 16.9, zz], .17, m.orange, 6);
      rod([x, 14.1, zz], [tip, 16.9, zz], .138, m.orange, 6);
      for (let i = 0; i < 6; i++) {
        rod([x + reverse * i * 2.5, 12.9 + i * 2 / 3, zz],
          [x + reverse * (i + 1) * 2.5, 14.1 + (i + 1) * .467, zz], .065, m.edge, 6);
      }
    }
    rod([hinge, 14, z], [x, 18.2, z], .14, m.orange);
    rod([x, 18.2, z], [tip, 16.9, z], .043, m.edge);
    rod([tip, 16.9, z], [tip, 8.4, z], .027, m.dark, 5);
    box(tip, 8.36, z, .57, .39, .45, m.rail);
  }
  for (const [material, geometry] of batches) {
    const merged = mergeGeometries(geometry);
    geometry.forEach(item => item.dispose());
    if (!merged) throw Error('Ship geometry could not be batched');
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = material !== m.deck && !material.transparent;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
