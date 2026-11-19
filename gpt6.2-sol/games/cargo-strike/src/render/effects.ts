import * as T from 'three';
import type { Vec } from '../arena.ts';
import type { Event } from '../combat.ts';

const set = (target: T.Vector3, p: Vec) => target.set(p.x, p.y, p.z);
type Effect = { node: T.Object3D; ttl: number; max: number; v?: T.Vector3; grow?: number };

export function glowMap() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(.15, '#fffc'); g.addColorStop(.48, '#fff6'); g.addColorStop(1, '#fff0');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(canvas);
}

export function effects(scene: T.Scene) {
  const glow = glowMap();
  const particles: Effect[] = [];
  const dust = new T.IcosahedronGeometry(.022, 0);
  const scorch = new T.CircleGeometry(.046, 9);
  let markCount = 0;
  function remove(item: Effect) {
    scene.remove(item.node);
    if (item.node instanceof T.Mesh && item.node.geometry === scorch) markCount--;
    if (item.node instanceof T.Line) item.node.geometry.dispose();
    if (item.node instanceof T.Line || item.node instanceof T.Sprite || item.node instanceof T.Mesh) item.node.material.dispose();
  }
  function add(node: T.Object3D, pos: Vec, ttl: number, v?: T.Vector3, grow?: number) {
    set(node.position, pos); scene.add(node);
    particles.push({ node, ttl, max: ttl, v, grow });
    if (particles.length > 180) remove(particles.shift()!);
  }
  function flare(p: Vec, size: number, color: number, life: number, grow = 0, v?: T.Vector3) {
    const sprite = new T.Sprite(new T.SpriteMaterial({
      color, map: glow, opacity: .88, depthWrite: false, blending: life < .2 ? T.AdditiveBlending : T.NormalBlending,
    }));
    sprite.scale.setScalar(size);
    add(sprite, p, life, v, grow);
  }
  function debris(at: Vec, size: number, count: number, color: number) {
    for (let i = 0; i < count; i++) {
      const spark = new T.Mesh(dust, new T.MeshBasicMaterial({ color, transparent: true }));
      spark.scale.setScalar(.6 + Math.random() * size);
      add(spark, at, .13 + Math.random() * .54,
        new T.Vector3((Math.random() - .5) * 6, Math.random() * 3.4, (Math.random() - .5) * 6).multiplyScalar(size));
    }
  }
  return {
    handle(e: Event, camera: T.Camera) {
      if (e.type === 'shot') {
        const { from, to } = e;
        const a = new T.Vector3(from.x, from.y - .28, from.z);
        const b = new T.Vector3(to.x, to.y, to.z);
        if (e.actor.bot) {
          const right = new T.Vector3(Math.cos(e.actor.yaw), 0, -Math.sin(e.actor.yaw));
          a.lerp(b, Math.min(.8, .72 / Math.max(1, a.distanceTo(b)))).addScaledVector(right, .07);
          flare(a, .63, 0xffa73d, .065);
        } else {
          a.lerp(b, Math.min(.8, 1.85 / Math.max(1, a.distanceTo(b))));
        }
        const mid = b.clone().lerp(a, Math.max(0, 1 - Math.min(1, 12 / Math.max(1, a.distanceTo(b)))));
        const line = new T.Line(new T.BufferGeometry().setFromPoints([mid, b]),
          new T.LineBasicMaterial({ color: e.actor.bot ? 0xffb767 : 0xffd99d, transparent: true, opacity: .62 }));
        add(line, { x: 0, y: 0, z: 0 }, .061);
        if (e.impact && !e.flesh) {
          flare(to, .34, 0xffc37a, .075);
          debris(to, .66, 5, 0xf4be79);
          if (markCount < 28) {
            const mark = new T.Mesh(scorch, new T.MeshBasicMaterial({ color: 0x222422, transparent: true, depthWrite: false }));
            mark.position.copy(b).lerp(a, Math.min(1, .018 / Math.max(.01, a.distanceTo(b))));
            mark.lookAt(camera.position);
            markCount++;
            add(mark, mark.position, 5.8);
          }
        }
      } else if (e.type === 'boom') {
        flare(e.at, 4.8, 0xffa23e, .15, 17);
        debris(e.at, 1.6, 22, 0xf2ba73);
        for (let i = 0; i < 7; i++)
          flare(e.at, 1.15, 0x595652, .72 + Math.random() * .6, 2.4,
            new T.Vector3((Math.random() - .5) * 2.6, .72 + Math.random() * 1.4, (Math.random() - .5) * 2.6));
      }
    },
    tick(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const e = particles[i];
        e.ttl -= dt;
        if (e.ttl <= 0) { remove(e); particles.splice(i, 1); continue; }
        if (e.v) {
          e.node.position.addScaledVector(e.v, dt);
          if (e.node instanceof T.Mesh) e.v.y -= 8 * dt;
        }
        if (e.grow) e.node.scale.addScalar(e.grow * dt);
        if (e.node instanceof T.Line || e.node instanceof T.Sprite || e.node instanceof T.Mesh) {
          const material = e.node.material as T.Material;
          material.opacity = (e.node instanceof T.Line ? .67 : .92) * Math.min(1, e.ttl / (e.max * .7));
        }
      }
    },
    clear() { while (particles.length) remove(particles.pop()!); },
  };
}
