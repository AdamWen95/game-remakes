import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Section = [z: number, halfWidth: number, bottom: number, top: number];

// Cross sections give the car a sculpted silhouette without external model assets.
function shell(sections: Section[], material: THREE.Material): THREE.Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [z, width, bottom, top] of sections) {
    positions.push(-width, bottom, z, width, bottom, z, width, top, z, -width, top, z);
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let side = 0; side < 4; side++) {
      const a = i * 4 + side;
      const b = i * 4 + (side + 1) % 4;
      indices.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  const end = (sections.length - 1) * 4;
  indices.push(0, 2, 1, 0, 3, 2, end, end + 1, end + 2, end, end + 2, end + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Merge only direct static children. Wheel pivots and exhaust animation groups stay independent.
function mergeStaticParts(parent: THREE.Group, retired: Set<THREE.BufferGeometry>) {
  const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of parent.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const parts = byMaterial.get(child.material) ?? [];
    parts.push(child);
    byMaterial.set(child.material, parts);
  }
  for (const [material, parts] of byMaterial) {
    if (parts.length < 2) continue;
    const transformed = parts.map(part => {
      part.updateMatrix();
      return part.geometry.clone().applyMatrix4(part.matrix);
    });
    const geometry = mergeGeometries(transformed, false);
    for (const source of transformed) source.dispose();
    if (!geometry) throw new Error('Racer geometry attributes must match before merging.');
    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = parts.some(part => part.castShadow);
    merged.receiveShadow = parts.some(part => part.receiveShadow);
    for (const part of parts) {
      parent.remove(part);
      retired.add(part.geometry);
    }
    parent.add(merged);
  }
}

/** Original arcade sports car. Forward is +Z; wheel contact plane is Y=0. */
export function createCar(color: number, style = 0): THREE.Group {
  const car = new THREE.Group();
  car.name = 'apex-racer';
  const variant = Math.max(0, Math.min(2, Math.floor(style)));
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.58, roughness: 0.29 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101d2b, metalness: 0.55, roughness: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.92 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8e8f1, metalness: 0.85, roughness: 0.24 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x123f54, metalness: 0.75, roughness: 0.15 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xf1f8ff, metalness: 0.2, roughness: 0.4 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xd7ffff, emissive: 0x8bffff, emissiveIntensity: 2.5 });
  const rearLamp = new THREE.MeshStandardMaterial({ color: 0xff335e, emissive: 0xff123d, emissiveIntensity: 2 });
  const underglow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, depthWrite: false });
  const flameOuter = new THREE.MeshBasicMaterial({ color: 0x23cfff, transparent: true, opacity: 0.75, depthWrite: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: 0xd8ffff });

  function box(parent: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const rearWidth = variant === 2 ? 1.16 : 1.08;
  car.add(shell([
    [-2.24, 0.96, 0.34, 0.72], [-1.72, rearWidth, 0.32, 0.85],
    [-0.72, 1.08, 0.35, 0.86], [0.42, 1.04, 0.34, 0.76],
    [1.62, 1.08, 0.32, 0.67], [2.25, 0.91, 0.35, 0.57],
  ], paint));
  box(car, [2.04, 0.15, 4.36], [0, 0.32, 0], dark);
  box(car, [2.28, 0.085, 0.62], [0, 0.29, 2.03], dark);
  box(car, [2.16, 0.07, 0.17], [0, 0.31, 2.34], paint);
  box(car, [1.48, 0.16, 0.075], [0, 0.45, 2.26], dark);
  for (let i = -3; i <= 3; i++) box(car, [0.045, 0.13, 0.08], [i * 0.19, 0.45, 2.3], silver);

  const roofHeight = variant === 1 ? 1.24 : 1.32;
  const roofStart = variant === 2 ? -1.06 : -0.9;
  car.add(shell([
    [-1.43, 0.77, 0.79, 0.85], [roofStart, 0.71, 0.79, roofHeight],
    [0.08, 0.69, 0.77, roofHeight], [0.97, 0.82, 0.72, 0.8],
  ], glass));
  box(car, [1.45, 0.055, 0.98], [-0.01, roofHeight + 0.015, -0.42], paint);
  // A narrow central spine makes the windscreen and bonnet read as one racing stripe.
  const windshieldSpine = box(car, [0.105, 0.025, 1.06], [0, 1.045, 0.52], paint);
  windshieldSpine.rotation.x = Math.atan2(roofHeight - 0.8, 0.89);
  for (const side of [-1, 1]) {
    const hoodStripe = box(car, [0.14, 0.018, 1.26], [side * 0.18, 0.697, 1.48], stripe);
    hoodStripe.rotation.x = 0.105;
    box(car, [0.14, 0.014, 0.98], [side * 0.18, roofHeight + 0.05, -0.42], stripe);
    box(car, [0.14, 0.014, 0.51], [side * 0.18, 0.823, -1.84], stripe).rotation.x = -0.13;
    // Window pillars, mirrors and side intake panels.
    const pillar = box(car, [0.055, 0.48, 0.08], [side * 0.718, 1.07, -0.6], paint);
    pillar.rotation.z = side * 0.12;
    box(car, [0.16, 0.055, 0.12], [side * 0.91, 0.88, 0.45], dark);
    box(car, [0.24, 0.13, 0.3], [side * 1.025, 0.91, 0.45], paint);
    box(car, [0.085, 0.18, 0.77], [side * 1.085, 0.59, -0.66], dark);
    for (let i = 0; i < 3; i++) {
      const vent = box(car, [0.025, 0.15, 0.045], [side * 1.133, 0.59, -0.9 + i * 0.22], silver);
      vent.rotation.x = -0.2;
    }
    box(car, [0.17, 0.12, 2.19], [side * 1.115, 0.32, 0], dark);
    box(car, [0.05, 0.04, 1.8], [side * 1.21, 0.37, 0], paint);
    const headlight = box(car, [0.6, 0.085, 0.09], [side * 0.64, 0.59, 2.15], lamp);
    headlight.rotation.y = side * 0.22;
    box(car, [0.055, 0.13, 0.09], [side * 0.91, 0.54, 2.09], lamp);
    box(car, [0.66, 0.075, 0.065], [side * 0.63, 0.65, -2.26], rearLamp);
    box(car, [0.04, 0.16, 0.065], [side * 0.91, 0.6, -2.26], rearLamp);
  }

  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  const tireGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 16);
  const rimGeometry = new THREE.CylinderGeometry(0.302, 0.302, 0.334, 12);
  const hubGeometry = new THREE.CylinderGeometry(0.085, 0.085, 0.36, 10);
  for (const side of [-1, 1]) {
    for (const z of [-1.39, 1.38]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.055, 0.43, z);
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(tireGeometry, rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheel.add(tire);
      const rim = new THREE.Mesh(rimGeometry, dark);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
      const hub = new THREE.Mesh(hubGeometry, paint);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.024, 4, 16), silver);
      outerRing.rotation.y = Math.PI / 2;
      outerRing.position.x = side * 0.174;
      wheel.add(outerRing);
      for (let spoke = 0; spoke < 5; spoke++) {
        const spokeMesh = box(wheel, [0.035, 0.066, 0.25], [side * 0.18, 0, 0], silver);
        const angle = spoke * Math.PI * 2 / 5;
        spokeMesh.position.y = Math.sin(angle) * 0.16;
        spokeMesh.position.z = Math.cos(angle) * 0.16;
        spokeMesh.rotation.x = -angle;
      }
      pivot.add(wheel);
      car.add(pivot);
      wheels.push(wheel);
      if (z > 0) frontWheels.push(pivot);
      // Squared shoulders around each wheel lend the body a low, planted stance.
      box(car, [0.14, 0.08, 0.91], [side * 1.13, 0.875, z], paint);
    }
  }

  const wingHeight = variant === 2 ? 1.19 : variant === 1 ? 0.95 : 1.09;
  for (const side of [-1, 1]) {
    box(car, [0.09, wingHeight - 0.7, 0.16], [side * 0.73, (wingHeight + 0.7) / 2, -1.89], dark);
  }
  const wingWidth = variant === 2 ? 2.55 : 2.32;
  box(car, [wingWidth, 0.09, 0.43], [0, wingHeight, -1.94], dark).rotation.x = -0.1;
  box(car, [wingWidth, 0.035, 0.065], [0, wingHeight + 0.03, -2.15], paint);
  for (const side of [-1, 1]) box(car, [0.055, 0.22, 0.5], [side * wingWidth / 2, wingHeight + 0.055, -1.94], paint);
  box(car, [1.86, 0.17, 0.16], [0, 0.39, -2.21], dark);
  for (let i = -2; i <= 2; i++) box(car, [0.055, 0.21, 0.34], [i * 0.31, 0.32, -2.17], dark);

  const flames: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 10), silver);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * 0.67, 0.4, -2.24);
    car.add(exhaust);
    const exhaustInside = new THREE.Mesh(new THREE.CircleGeometry(0.105, 10), dark);
    exhaustInside.rotation.y = Math.PI;
    exhaustInside.position.set(side * 0.67, 0.4, -2.397);
    car.add(exhaustInside);
    const flame = new THREE.Group();
    flame.position.set(side * 0.67, 0.4, -2.4);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.19, 1.75, 7), flameOuter);
    outer.rotation.x = -Math.PI / 2;
    outer.position.z = -0.87;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.05, 7), flameInner);
    inner.rotation.x = -Math.PI / 2;
    inner.position.z = -0.48;
    flame.add(outer, inner);
    flame.visible = false;
    car.add(flame);
    flames.push(flame);
  }

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 4.6), underglow);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.025;
  car.add(glow);
  car.userData.wheels = wheels;
  car.userData.frontWheels = frontWheels;
  car.userData.flames = flames;
  const retired = new Set<THREE.BufferGeometry>();
  mergeStaticParts(car, retired);
  for (const wheel of wheels) mergeStaticParts(wheel, retired);
  // Some original wheel geometries are shared by four wheels; dispose only unreferenced ones.
  car.traverse(object => {
    if (object instanceof THREE.Mesh) retired.delete(object.geometry);
  });
  for (const geometry of retired) geometry.dispose();
  return car;
}
