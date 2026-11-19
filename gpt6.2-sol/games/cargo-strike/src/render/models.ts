import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Actor } from '../actor.ts';
import type { Team } from '../actor.ts';
import type { Gun } from '../loadout.ts';

const mat = (color: string, metalness = .12, roughness = .66) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
const black = mat('#232a2d', .36, .37), iron = mat('#47545a', .54, .32), graphite = mat('#131b20', .2, .82);
const walnut = mat('#795036', .04, .54), polymer = mat('#515745', .18), brass = mat('#9e8558', .59);
const textile = mat('#66706a'), carrier = mat('#434b42'), glove = mat('#2c3230'), skin = mat('#a38971', .02);
const glass = mat('#345c66', .64, .19);
const insignia = [mat('#38acc4', .16), mat('#db6042', .14)];
const fatigue = [mat('#455e68'), mat('#695947')];

function mesh(parent: T.Group, geo: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) {
  const m = new T.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(parent: T.Group, material: T.Material, dims: [number, number, number], at: [number, number, number], round = .014) {
  return mesh(parent, round ? new RoundedBoxGeometry(...dims, 1, round) : new T.BoxGeometry(...dims), material, ...at);
}
function tube(parent: T.Group, material: T.Material, r1: number, r2: number, len: number, at: [number, number, number], axis = 'z') {
  const cylinder = mesh(parent, new T.CylinderGeometry(r1, r2, len, 12), material, ...at);
  if (axis === 'z') cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}
function join(parent: T.Group, material: T.Material, a: number[], b: number[], r1: number, r2: number) {
  const from = new T.Vector3(...a), to = new T.Vector3(...b);
  const d = to.clone().sub(from);
  const mid = from.lerp(to, .5);
  const limb = tube(parent, material, r2, r1, d.length(), [mid.x, mid.y, mid.z], 'y');
  limb.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
}

function batch(group: T.Group) {
  const parts = new Map<T.Material, T.BufferGeometry[]>();
  for (const child of [...group.children]) {
    if (!(child instanceof T.Mesh) || Array.isArray(child.material)) continue;
    const mat = child.material as T.Material;
    child.updateMatrix();
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat)!.push(geometry);
    group.remove(child);
    child.geometry.dispose();
  }
  for (const [mat, pieces] of parts) {
    const geo = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (geo) mesh(group, geo, mat, 0, 0, 0);
  }
}

export function firearm(gun: Gun, arms: boolean) {
  const model = new T.Group();
  const pistol = gun === 'm9', sniper = gun === 'awp', wooden = gun === 'ak';
  const length = pistol ? .25 : sniper ? .83 : .66;
  const barrelTip = -length - (pistol ? .035 : .17);
  const receiver = pistol ? .23 : .35;
  box(model, iron, [.09, .091, receiver], [0, .015, -.065]);
  box(model, black, [.083, .035, receiver + .017], [0, .071, -.087]);
  box(model, graphite, [.086, .045, receiver * .85], [0, -.041, -.048]);
  box(model, black, [.071, .125, .10], [0, -.123, .047]).rotation.x = -.32;
  box(model, iron, [.099, .018, .125], [0, -.103, -.039]);
  box(model, brass, [.003, .024, .09], [.046, .033, -.09]);
  box(model, black, [.006, .022, .116], [-.047, .033, -.107]);
  if (!pistol) {
    box(model, wooden ? walnut : polymer, [.104, .125, .25], [0, -.027, .208]);
    box(model, graphite, [.108, .138, .025], [0, -.03, .341]);
    box(model, wooden ? walnut : black, [.105, .096, length * .62], [0, .006, -length * .55]);
    const mag = box(model, graphite, [.072, sniper ? .105 : .218, .125], [0, -.15, -.123]);
    mag.rotation.x = wooden ? .28 : .11;
    for (let i = 0; i < 5; i++) {
      box(model, wooden ? walnut : iron, [.113, .011, .025], [0, .01, -.28 - i * .041], .003);
      box(model, iron, [.074, .011, .029], [0, .091, -.08 - i * .038], .003);
    }
  } else {
    for (let i = 0; i < 6; i++) box(model, graphite, [.091, .039, .008], [0, .048, .026 - i * .013], .001);
  }
  tube(model, iron, pistol ? .028 : .025, .029, length * .46, [0, .034, barrelTip + length * .23]);
  tube(model, graphite, .034, .035, .051, [0, .034, barrelTip + .019]);
  tube(model, black, .019, .019, .004, [0, .034, barrelTip - .008]);
  if (sniper) {
    for (const z of [-.05, -.27]) box(model, iron, [.061, .063, .037], [0, .108, z]);
    tube(model, black, .041, .042, .315, [0, .165, -.18]);
    tube(model, graphite, .065, .042, .12, [0, .165, -.345]);
    tube(model, graphite, .056, .042, .095, [0, .165, .003]);
    tube(model, glass, .044, .044, .006, [0, .165, .052]);
    tube(model, iron, .027, .027, .052, [0, .224, -.16], 'y');
  } else {
    const z = pistol ? -.198 : -length + .05;
    for (const x of [-.022, .022]) box(model, black, [.012, .028, .059], [x, .092, .032], .004);
    box(model, black, [.038, .046, .039], [0, .068, z], .007);
    box(model, iron, [.008, .047, .027], [0, .1, z], .003);
    box(model, brass, [.012, .008, .008], [0, .123, z + .009], .001);
    if (!pistol && !wooden) {
      box(model, black, [.082, .051, .072], [0, .096, -.22]);
      tube(model, glass, .023, .023, .005, [0, .11, -.183]);
    }
  }
  if (arms) {
    const end = pistol ? -.092 : -length * .57;
    join(model, textile, [.29, -.27, .38], [.076, -.141, .093], .093, .059);
    join(model, textile, [-.26, -.31, .25], [-.046, -.104, end], .085, .056);
    box(model, glove, [.107, .105, .132], [.036, -.106, .049]).rotation.z = -.21;
    box(model, glove, [.101, .095, .15], [-.052, -.064, end]).rotation.z = .18;
    for (let i = 0; i < 4; i++) {
      box(model, graphite, [.054, .018, .024], [-.024, -.038, end - .047 + i * .028], .005);
      box(model, glove, [.054, .018, .024], [-.015, -.105 - i * .018, .063], .006);
    }
    box(model, carrier, [.13, .074, .17], [.184, -.199, .25]).rotation.y = .58;
  }
  batch(model);
  return { model, muzzle: new T.Vector3(0, .033, barrelTip - .009) };
}

export function soldier(team: Team) {
  const root = new T.Group(), upper = new T.Group(), legs = [new T.Group(), new T.Group()];
  root.add(upper, ...legs);
  const cloth = fatigue[team], patch = insignia[team];
  box(upper, cloth, [.45, .47, .27], [0, 1.18, .005], .05);
  box(upper, carrier, [.39, .37, .31], [0, 1.19, -.032], .035);
  for (const x of [-.122, 0, .122])
    box(upper, glove, [.098, .149, .061], [x, 1.12, -.203], .014);
  box(upper, patch, [.118, .046, .012], [0, 1.33, -.198], .004);
  box(upper, carrier, [.33, .31, .126], [0, 1.22, .177], .037);
  box(upper, patch, [.22, .036, .012], [0, 1.3, .244], .004);
  tube(upper, glove, .077, .084, .13, [0, 1.47, 0], 'y');
  box(upper, skin, [.207, .226, .209], [0, 1.6, -.008], .042);
  const helmet = mesh(upper, new T.SphereGeometry(.144, 14, 10), cloth, 0, 1.659, .004);
  helmet.scale.set(.92, .82, 1.03);
  box(upper, graphite, [.223, .07, .044], [0, 1.602, -.099], .018);
  box(upper, glass, [.175, .046, .022], [0, 1.605, -.127], .012);
  box(upper, glove, [.174, .082, .036], [0, 1.533, -.097], .023);
  for (const s of [-1, 1]) {
    box(upper, carrier, [.064, .099, .072], [s * .122, 1.6, .008], .016);
    join(upper, cloth, [s * .213, 1.35, -.02], [s * .27, 1.12, -.11], .085, .062);
    join(upper, cloth, [s * .27, 1.12, -.11], [s * .073, 1.209, s === 1 ? -.267 : -.44], .062, .045);
    box(upper, patch, [.023, .072, .088], [s * .278, 1.29, -.047], .01);
    box(upper, glove, [.075, .069, .086], [s * .07, 1.21, s === 1 ? -.263 : -.437]);
    const leg = legs[s === -1 ? 0 : 1];
    leg.position.set(s * .121, .87, 0);
    join(leg, cloth, [0, .022, 0], [s * .015, -.37, -.014], .106, .076);
    join(leg, cloth, [s * .015, -.37, -.014], [s * .02, -.733, .013], .075, .057);
    box(leg, glove, [.136, .123, .063], [s * .018, -.361, -.061], .021);
    box(leg, graphite, [.142, .117, .244], [s * .021, -.801, -.052], .029);
  }
  const rifle = firearm(team ? 'ak' : 'm4', false).model;
  rifle.scale.setScalar(.72); rifle.position.set(.06, 1.225, -.292);
  upper.add(rifle);
  batch(upper);
  legs.forEach(batch);
  return {
    root,
    update(a: Actor, t: number) {
      root.position.set(a.pos.x, a.pos.y, a.pos.z);
      root.rotation.y = a.yaw;
      const dead = !a.hp;
      const fall = dead ? T.MathUtils.clamp(1 - (a.respawnAt - t) / 2.75, 0, .32) / .32 : 0;
      root.rotation.z = -fall * 1.53; root.position.y += fall * .19;
      root.visible = !dead || a.respawnAt - t > 1.81;
      root.scale.y = a.crouched ? .68 : 1;
      const swing = dead ? 0 : Math.sin(t * 10 + a.id * 1.42) * Math.min(.55, a.moving * .15);
      legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
      upper.position.y = dead ? 0 : Math.abs(swing) * .064;
      rifle.rotation.x = a.pitch * .64;
      rifle.position.z = -.29 + a.kick * .052;
    },
  };
}
