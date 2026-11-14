import * as THREE from 'three';
import type { Track } from '../game/track';

type Placement = { x: number; y: number; z: number; sx?: number; sy?: number; sz?: number; rx?: number; ry?: number; rz?: number; color?: number };
class Batch {
  private readonly placements: Placement[] = [];
  constructor(private readonly geometry: THREE.BufferGeometry, private readonly material: THREE.Material, private readonly name: string) {}
  add(value: Placement) { this.placements.push(value); }
  finish(parent: THREE.Group) {
    if (!this.placements.length) { this.geometry.dispose(); return; }
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.placements.length);
    mesh.name = this.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    this.placements.forEach((p, i) => {
      transform.position.set(p.x, p.y, p.z);
      transform.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
      transform.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      if (p.color !== undefined) mesh.setColorAt(i, color.setHex(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }
}

function randomGenerator(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function leafGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -0.65, 0.2, 1.5, 0.65, 0.2, 1.5,
    -0.5, -0.25, 3.5, 0.5, -0.25, 3.5, 0, -1.2, 5.3,
  ], 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]);
  geometry.computeVertexNormals();
  return geometry;
}

function sailGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 8, 0, 0, 0, 5], 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic, batched set dressing. Track and lighting belong to the scene owner. */
export function createScenery(track: Track): THREE.Group {
  const group = new THREE.Group();
  group.name = `scenery-${track.definition.id}`;
  const isCity = track.definition.id === 'city';
  const isAlpine = track.definition.id === 'alpine';
  const random = randomGenerator(isCity ? 0xc17a : isAlpine ? 0xa1f1 : 0xc0a57);
  const matte = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true });
  const white = matte(0xffffff);
  const emissive = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const batches: Batch[] = [];
  const batch = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material = white) => {
    const value = new Batch(geometry, material, name); batches.push(value); return value;
  };
  const boxes = batch('architecture', new THREE.BoxGeometry(1, 1, 1));
  const lights = batch('architectural-lights', new THREE.BoxGeometry(1, 1, 1), emissive);
  const cylinders = batch('trunks-and-towers', new THREE.CylinderGeometry(0.8, 1, 1, 8));
  const cones = batch('peaks-and-canopies', new THREE.ConeGeometry(1, 1, 7));
  const rocks = batch('islands-and-rocks', new THREE.IcosahedronGeometry(1, 1));
  const nearby = track.points.filter((_, i) => i % 4 === 0);
  const clearance = track.definition.width / 2 + 5;
  const clear = (x: number, z: number, radius: number) => nearby.every(p => Math.hypot(x - p.x, z - p.z) > clearance + radius);
  const bounds = {
    minX: Math.min(...track.points.map(p => p.x)), maxX: Math.max(...track.points.map(p => p.x)),
    minZ: Math.min(...track.points.map(p => p.z)), maxZ: Math.max(...track.points.map(p => p.z)),
  };
  const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };

  if (!isCity && !isAlpine) {
    const foliage = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
    const leaves = batch('palm-fronds', leafGeometry(), foliage);
    const sails = batch('sails', sailGeometry(), new THREE.MeshStandardMaterial({ color: 0xfff8e6, side: THREE.DoubleSide, roughness: 0.9 }));
    const palmColors = [0x2f9875, 0x52b784, 0x77c78e];
    for (let i = 0; i < 86; i++) {
      const side = i % 2 ? -1 : 1;
      const p = track.sample((i + 0.3) / 86 * track.length, side * (20 + random() * 25));
      if (!clear(p.x, p.z, 5)) continue;
      const height = 8 + random() * 6;
      const lean = (random() - 0.5) * 0.22;
      const ground = 0.75;
      rocks.add({ x: p.x, y: -0.8, z: p.z, sx: 12, sy: 2, sz: 11, color: 0xe9d5a4 });
      cylinders.add({ x: p.x, y: ground + height / 2, z: p.z, sx: 0.38, sy: height, sz: 0.38, rz: lean, color: 0x96714e });
      const crownX = p.x - Math.sin(lean) * height / 2;
      const crownY = ground + height;
      for (let leaf = 0; leaf < 6; leaf++) {
        leaves.add({ x: crownX, y: crownY, z: p.z, ry: leaf * Math.PI / 3 + i, sx: 0.9, sy: 0.9, sz: 0.9, color: palmColors[leaf % 3] });
      }
      rocks.add({ x: p.x + 3, y: 0.6, z: p.z + 2, sx: 2.1, sy: 1.6, sz: 2.7, ry: random() * 6, color: 0xb8b7a3 });
    }
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const x = center.x + Math.cos(angle) * (400 + random() * 110);
      const z = center.z + Math.sin(angle) * (400 + random() * 110);
      const scale = 0.9 + random() * 0.5;
      boxes.add({ x, y: 0.65, z, sx: 2.3 * scale, sy: 0.85, sz: 9 * scale, ry: angle, color: i % 2 ? 0xd3665b : 0xf2ead7 });
      cylinders.add({ x, y: 4 * scale, z, sx: 0.08, sy: 8 * scale, sz: 0.08, color: 0xe4ece9 });
      sails.add({ x, y: 1, z, ry: angle, sx: scale, sy: scale, sz: scale });
    }
    // One clear landmark for the seaside circuit, deliberately outside the road loop.
    const tower = { x: bounds.minX - 65, z: bounds.maxZ - 40 };
    rocks.add({ x: tower.x, y: -1.5, z: tower.z, sx: 30, sy: 5, sz: 25, color: 0xdbd1af });
    for (let level = 0; level < 6; level++) cylinders.add({ x: tower.x, y: 4 + level * 4, z: tower.z, sx: 3.2 - level * 0.14, sy: 4, sz: 3.2 - level * 0.14, color: level % 2 ? 0xe88470 : 0xfff4da });
    cylinders.add({ x: tower.x, y: 28.4, z: tower.z, sx: 3.3, sy: 1.3, sz: 3.3, color: 0x304b5a });
    cylinders.add({ x: tower.x, y: 30.1, z: tower.z, sx: 2.4, sy: 2.2, sz: 2.4, color: 0xa7e7e8 });
    cones.add({ x: tower.x, y: 32.3, z: tower.z, sx: 4.2, sy: 2.8, sz: 4.2, color: 0xdb7768 });
    lights.add({ x: tower.x, y: 30, z: tower.z - 2.5, sx: 2, sy: 1.2, sz: 0.1, color: 0xffedac });
    for (let i = 0; i < 9; i++) {
      const x = bounds.maxX + 200 + random() * 230;
      const z = center.z + (random() - 0.5) * 1000;
      const size = 45 + random() * 60;
      rocks.add({ x, y: size * 0.17 - 4, z, sx: size * 1.5, sy: size * 0.55, sz: size, color: 0x729e9d });
    }
  } else if (isCity) {
    const buildingColors = [0x263c5b, 0x35496c, 0x233148, 0x414463, 0x2d5262];
    const neonColors = [0x65e9f1, 0xd18aff, 0xff799c, 0x75bfff, 0xffd69a];
    for (let i = 0; i < 115; i++) {
      const side = i % 2 ? 1 : -1;
      const p = track.sample(i / 115 * track.length, side * (27 + random() * 72));
      const width = 9 + random() * 14;
      const depth = 8 + random() * 14;
      if (!clear(p.x, p.z, Math.hypot(width, depth) / 2)) continue;
      const height = 17 + random() * 83;
      const hue = neonColors[i % neonColors.length];
      const body = buildingColors[i % buildingColors.length];
      boxes.add({ x: p.x, y: height / 2, z: p.z, sx: width, sy: height, sz: depth, color: body });
      boxes.add({ x: p.x, y: height + 2, z: p.z, sx: width * 0.65, sy: 4, sz: depth * 0.65, color: body });
      lights.add({ x: p.x, y: height + 0.15, z: p.z, sx: width + 0.15, sy: 0.3, sz: depth + 0.15, color: hue });
      for (const sideX of [-1, 1]) lights.add({ x: p.x + sideX * width / 2, y: height / 2, z: p.z - depth / 2 - 0.06, sx: 0.24, sy: height, sz: 0.2, color: hue });
      for (let floor = 5; floor < height - 3; floor += 5) {
        for (let column = -width / 2 + 2; column < width / 2 - 1; column += 3) {
          if (random() > 0.73) continue;
          for (const face of [-1, 1]) lights.add({ x: p.x + column, y: floor, z: p.z + face * (depth / 2 + 0.04), sx: 1.1, sy: 1.5, sz: 0.08, color: floor % 10 ? 0x7c9bb7 : hue });
        }
      }
      if (i % 5 === 0) {
        cylinders.add({ x: p.x, y: height + 8, z: p.z, sx: 0.2, sy: 14, sz: 0.2, color: 0x718d9b });
        lights.add({ x: p.x, y: height + 15, z: p.z, sx: 0.65, sy: 0.65, sz: 0.65, color: 0xff608c });
      }
    }
    // A distant skyline keeps the horizon readable between the close buildings.
    for (let i = 0; i < 45; i++) {
      const angle = i / 45 * Math.PI * 2;
      const x = center.x + Math.cos(angle) * 530;
      const z = center.z + Math.sin(angle) * 530;
      const height = 40 + random() * 135;
      const width = 18 + random() * 28;
      boxes.add({ x, y: height / 2, z, sx: width, sy: height, sz: width, color: 0x25334e });
      lights.add({ x, y: height, z, sx: width, sy: 0.4, sz: width, color: neonColors[i % neonColors.length] });
    }
  } else {
    const greens = [0x2e655a, 0x3f7c69, 0x4b8b75, 0x4b726b];
    for (let i = 0; i < 210; i++) {
      const side = i % 2 ? -1 : 1;
      const p = track.sample(i / 210 * track.length, side * (20 + random() * 75));
      if (!clear(p.x, p.z, 5)) continue;
      const height = 8 + random() * 14;
      // Road elevation is independent; trees remain rooted in the valley floor.
      cylinders.add({ x: p.x, y: 2.2, z: p.z, sx: 0.55, sy: 4.4, sz: 0.55, color: 0x766b59 });
      for (let tier = 0; tier < 3; tier++) {
        const radius = height * (0.24 - tier * 0.045);
        const tierHeight = height * 0.55;
        cones.add({ x: p.x, y: height * (0.42 + tier * 0.21), z: p.z, sx: radius, sy: tierHeight, sz: radius, ry: i * 0.7, color: greens[(i + tier) % greens.length] });
      }
      if (i % 4 === 0) rocks.add({ x: p.x + 3, y: 1, z: p.z - 2, sx: 2.7, sy: 2.2, sz: 3.1, ry: random() * 6, color: 0x83928d });
    }
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const radius = 650 + random() * 180;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const width = 70 + random() * 85;
      const height = 110 + random() * 160;
      cones.add({ x, y: height / 2 - 8, z, sx: width, sy: height, sz: width * 0.85, ry: angle, color: i % 2 ? 0x8b9fab : 0x728c99 });
      cones.add({ x, y: height * 0.82 - 8, z, sx: width * 0.36, sy: height * 0.36, sz: width * 0.306, ry: angle, color: 0xe4f0f2 });
      rocks.add({ x, y: -12, z, sx: width * 1.6, sy: height * 0.2, sz: width * 1.4, color: 0x7a918f });
    }
    // Alpine lodge near a clear outer bend.
    const p = track.sample(track.length * 0.31, 53);
    if (clear(p.x, p.z, 17)) {
      boxes.add({ x: p.x, y: 4.5, z: p.z, sx: 20, sy: 9, sz: 12, color: 0xb4977a });
      boxes.add({ x: p.x, y: 0.9, z: p.z, sx: 23, sy: 1.8, sz: 15, color: 0x8e9d98 });
      const roof = new THREE.CylinderGeometry(0, 1, 1, 4);
      const roofs = batch('lodge-roof', roof);
      roofs.add({ x: p.x, y: 11, z: p.z, sx: 17, sy: 7, sz: 11, ry: Math.PI / 4, color: 0x3e6166 });
      for (const x of [-6, 0, 6]) lights.add({ x: p.x + x, y: 5.5, z: p.z + 6.1, sx: 2.1, sy: 2.8, sz: 0.1, color: 0xffdea5 });
    }
  }
  for (const value of batches) value.finish(group);
  return group;
}
