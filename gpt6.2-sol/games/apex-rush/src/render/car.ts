import * as T from 'three';
import type { Driver } from '../race.ts';
import { box, glow, lit, prop, texture } from './mesh.ts';

function shell(sections: [number, number, number, number][]) {
  // Cross sections are z, half-width at the shoulder, underside and top.
  const vertices: number[] = [];
  const indices: number[] = [];
  sections.forEach(([z, width, low, high], i) => {
    vertices.push(-width * .84, low, z, -width, high - .15, z, -width * .76, high, z,
      width * .76, high, z, width, high - .15, z, width * .84, low, z);
    if (!i) return;
    const a = i * 6 - 6;
    for (let j = 0; j < 6; j++) {
      const next = (j + 1) % 6;
      indices.push(a + j, a + j + 6, a + next, a + next, a + j + 6, a + next + 6);
    }
  });
  const rear = (sections.length - 1) * 6;
  for (let i = 1; i < 5; i++) indices.push(0, i, i + 1, rear, rear + i + 1, rear + i);
  const mesh = new T.BufferGeometry();
  mesh.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  mesh.setIndex(indices);
  return mesh.toNonIndexed();
}

function solid(geometry: T.BufferGeometry) {
  geometry.computeVertexNormals();
  return geometry;
}

const chassis = solid(shell([[-2.38, 1.10, .32, .90], [-1.73, 1.25, .3, 1.16], [-.56, 1.10, .29, 1.11],
  [.67, 1.11, .30, 1.00], [1.5, 1.22, .32, .87], [2.43, .91, .38, .67]]));
const cockpit = solid(shell([[-1.63, .69, 1.03, 1.17], [-.71, .78, 1.08, 1.63],
  [.36, .72, 1, 1.55], [1.19, .68, .91, .98]]));
const tireShape = new T.CylinderGeometry(.487, .487, .42, 15);
const rimShape = new T.CylinderGeometry(.315, .315, .451, 12);
const shadowMap = () => texture(64, 64, context => {
  const grad = context.createRadialGradient(32, 32, 9, 32, 32, 32);
  grad.addColorStop(0, 'rgba(3,6,10,0.86)');
  grad.addColorStop(.61, 'rgba(3,6,10,0.5)');
  grad.addColorStop(1, 'rgba(3,6,10,0)');
  context.fillStyle = grad;
  context.fillRect(0, 0, 64, 64);
});
const dark = lit('#181c20', .52, .36);
const black = lit('#20242a', .9);
const alloy = lit('#777e8a', .33, .62);
const glass = new T.MeshPhysicalMaterial({ color: '#233140', roughness: .21, metalness: .33, clearcoat: .9, side: T.DoubleSide });
const light = glow('#fff5db');
for (const item of [chassis, cockpit, tireShape, rimShape, dark, black, alloy, glass, light]) item.userData.shared = true;

export class CarVisual {
  readonly group = new T.Group();
  readonly body = new T.Group();
  readonly shadow: T.Mesh;
  readonly brake: T.MeshBasicMaterial;
  readonly jets: T.Object3D[] = [];
  readonly wheels: T.Object3D[] = [];
  viewYaw = 0;

  constructor(parent: T.Object3D, driver: Driver, shadow: T.Texture) {
    const { paint, spec } = driver;
    const enamel = new T.MeshPhysicalMaterial({ color: paint, roughness: .31, metalness: .22, clearcoat: .7, side: T.DoubleSide });
    const cabinPaint = lit(paint, .42, .22);
    this.brake = glow('#ff4033');
    this.shadow = new T.Mesh(new T.PlaneGeometry(4.3, 6.9), new T.MeshBasicMaterial({
      map: shadow, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    this.shadow.rotation.x = -Math.PI / 2;
    parent.add(this.shadow, this.group);
    this.group.add(this.body);
    this.body.add(new T.Mesh(chassis, enamel), new T.Mesh(cockpit, glass));
    prop(this.body, box, dark, 0, .49, -2.18, 2.22, .28, .50);
    prop(this.body, box, dark, 0, .36, 2.17, 1.80, .18, .49);
    prop(this.body, box, dark, 0, .82, -2.35, 1.98, .23, .082);
    prop(this.body, box, this.brake, 0, .88, -2.407, spec.id === 'viper' ? 1.92 : 1.73, .066, .042);
    prop(this.body, box, cabinPaint, 0, 1.603, -.21, 1.06, .060, .68).rotation.x = .071;

    for (const side of [-1, 1]) {
      prop(this.body, box, dark, side * 1.03, .34, -.03, .32, .17, 3.03);
      prop(this.body, box, dark, side * .69, .33, -2.415, .29, .16, .22);
      const jet = prop(this.body, new T.ConeGeometry(.16, 1.9, 8), glow('#7defed'),
        side * .69, .34, -3.28, 1, 1, 1);
      jet.rotation.x = -Math.PI / 2;
      this.jets.push(jet);

      prop(this.body, box, light, side * .68, .63, 2.377, .48, .066, .19, side * .13);
      prop(this.body, box, dark, side * .69, .46, 2.302, .52, .105, .19, side * .13);
      prop(this.body, box, enamel, side * 1.15, 1.21, .32, .22, .099, .28, side * .12);
      if (spec.id !== 'atlas') prop(this.body, box, dark, side * .63, 1.16, -1.94, .12, .48, .37);
      for (const z of [-1.53, 1.43]) {
        const axle = new T.Group();
        axle.position.set(side * 1.07, .47, z);
        const wheel = new T.Group();
        prop(wheel, tireShape, black, 0, 0, 0, 1, 1, 1).rotation.z = Math.PI / 2;
        prop(wheel, rimShape, alloy, 0, 0, 0, 1, 1, 1).rotation.z = Math.PI / 2;
        for (let i = 0; i < 5; i++) {
          const spoke = prop(wheel, box, dark, side * .232, 0, 0, .054, .53, .062);
          spoke.rotation.x = i * Math.PI / 5;
        }
        axle.add(wheel);
        this.body.add(axle);
        this.wheels.push(wheel);
      }
    }
    if (spec.id !== 'atlas') prop(this.body, box, dark, 0, 1.401, -1.94, spec.id === 'viper' ? 2.46 : 2.24, .095, .51);
    else prop(this.body, box, cabinPaint, 0, 1.07, -2.19, 1.93, .12, .30);
  }

  pose(car: Driver, phase: number, dt: number, brake: boolean) {
    this.viewYaw += (car.yaw - this.viewYaw) * (1 - Math.exp(-dt * 12));
    const shake = car.impact > .2 ? Math.sin(phase * 66) * .025 * car.impact : 0;
    this.body.rotation.z = -this.viewYaw * .23 + shake;
    this.body.position.y = Math.sin(phase * 21) * car.speed * .00031;
    this.wheels.forEach(wheel => { wheel.rotation.x -= car.speed * dt / .487; });
    this.brake.color.set(brake ? '#ff9a7e' : '#ff372c');
    this.jets.forEach((jet, i) => {
      jet.visible = car.boost > 0;
      jet.scale.y = 1 + .25 * Math.sin(phase * 62 + i * 2);
    });
  }
}

export function garage(scene: T.Scene, drivers: Driver[]) {
  const map = shadowMap();
  return drivers.map(driver => new CarVisual(scene, driver, map));
}
