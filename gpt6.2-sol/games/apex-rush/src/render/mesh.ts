import * as T from 'three';

export const lit = (color: T.ColorRepresentation, roughness = .76, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });
export const glow = (color: T.ColorRepresentation) => new T.MeshBasicMaterial({ color });
export const box = new T.BoxGeometry(1, 1, 1);
export const cone = new T.ConeGeometry(1, 1, 7);
export const cylinder = new T.CylinderGeometry(1, 1, 1, 12);
export const stone = new T.DodecahedronGeometry(1, 0);
for (const geometry of [box, cone, cylinder, stone]) geometry.userData.shared = true;

export function prop(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material,
  x: number, y: number, z: number, width: number, height: number, depth: number, yaw = 0) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.rotation.y = yaw;
  parent.add(mesh);
  return mesh;
}

export function random(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

type Placement = [number, number, number, number, number, number, number?];
export function batch(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, items: Placement[]) {
  if (!items.length) return;
  const mesh = new T.InstancedMesh(geometry, material, items.length);
  const instance = new T.Object3D();
  items.forEach(([x, y, z, sx, sy, sz, yaw = 0], i) => {
    instance.position.set(x, y, z);
    instance.scale.set(sx, sy, sz);
    instance.rotation.y = yaw;
    instance.updateMatrix();
    mesh.setMatrixAt(i, instance.matrix);
  });
  mesh.computeBoundingSphere();
  parent.add(mesh);
}

export function texture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  paint(ctx);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
