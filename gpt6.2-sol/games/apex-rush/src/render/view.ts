import * as T from 'three';
import type { Race } from '../race.ts';
import { clamp, mix } from '../track.ts';
import { garage, type CarVisual } from './car.ts';
import { road } from './road.ts';
import { environment } from './terrain.ts';
import { random, texture } from './mesh.ts';

export type Quality = 'high' | 'low';
const vectors = () => new T.Vector3();
const fx = 92;

export class RaceView {
  readonly renderer: T.WebGLRenderer;
  readonly camera = new T.PerspectiveCamera(62, 1, .17, 1610);
  private readonly scene = new T.Scene();
  private readonly views: CarVisual[];
  private readonly target = vectors();
  private readonly ideal = vectors();
  private readonly aim = vectors();
  private readonly smoke: T.Points<T.BufferGeometry, T.PointsMaterial>;
  private readonly particles = Array.from({ length: fx }, () => ({ x: 0, y: -800, z: 0, life: 0, side: 0 }));
  private readonly rng = random(89112);
  private timestamp = 0;
  private emitter = 0;
  private nextParticle = 0;
  private initialized = false;
  private size = '';
  private follow = 0;

  constructor(canvas: HTMLCanvasElement, private readonly race: Race) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setClearColor('#1b222c');
    environment(this.scene, race.track);
    road(this.scene, race.track);
    this.views = garage(this.scene, race.drivers);
    const mist = texture(64, 64, ctx => {
      const radial = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      radial.addColorStop(0, 'rgba(255,255,255,.91)');
      radial.addColorStop(.37, 'rgba(255,255,255,.58)');
      radial.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, 64, 64);
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(fx * 3), 3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(fx * 3), 3).setUsage(T.DynamicDrawUsage));
    const material = new T.PointsMaterial({ size: 2.29, map: mist, opacity: .49, transparent: true, depthWrite: false, vertexColors: true });
    this.smoke = new T.Points(geometry, material);
    this.smoke.frustumCulled = false;
    this.scene.add(this.smoke);
  }

  draw(dt: number, quality: Quality, close: boolean, braking: boolean) {
    const { renderer, race } = this;
    const canvas = renderer.domElement;
    const ratio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.65 : 1);
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const size = [width, height, ratio].join(':');
    if (size !== this.size) {
      this.size = size;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
    }
    this.timestamp += dt;
    race.drivers.forEach((car, i) => {
      const pose = race.track.sample(car.s, car.lane);
      const front = race.track.sample(car.s + 2.25, car.lane);
      const back = race.track.sample(car.s - 2.25, car.lane);
      const slope = Math.atan2(front.y - back.y, 4.5);
      const view = this.views[i];
      view.pose(car, this.timestamp, dt, i === 0 && braking);
      view.group.position.set(pose.x, pose.y + .062, pose.z);
      view.group.rotation.set(-slope, pose.yaw + view.viewYaw, 0, 'YXZ');
      view.shadow.position.set(pose.x, pose.y + .075, pose.z);
      view.shadow.rotation.set(-Math.PI / 2 - slope, 0, -pose.yaw, 'YXZ');
    });
    this.followPlayer(dt, close);
    this.drawParticles(dt, quality);
    renderer.render(this.scene, this.camera);
  }

  private followPlayer(dt: number, close: boolean) {
    const { player, track } = this.race;
    const pose = track.sample(player.s, player.lane);
    const ahead = track.sample(player.s + 16 + player.speed * .1, player.lane * .31);
    const toward = pose.yaw + this.views[0].viewYaw * .29;
    const distance = (close ? 7.9 : 11.7) + player.speed * .022;
    const height = close ? 3.8 : 6.1;
    const landscape = this.camera.aspect >= 1;
    const back = distance * (landscape ? 1 : 1.19);
    const base = track.sample(player.s - back);
    this.ideal.set(pose.x - Math.sin(toward) * back, Math.max(pose.y, base.y) + height, pose.z - Math.cos(toward) * back);
    this.aim.set(mix(ahead.x, pose.x, .23), ahead.y + .93, mix(ahead.z, pose.z, .23));
    const smoothing = 1 - Math.exp(-dt * 11);
    this.follow = mix(this.follow, player.boost ? 1 : 0, 1 - Math.exp(-dt * 5));
    if (!this.initialized || this.camera.position.distanceTo(this.ideal) > 25) {
      this.camera.position.copy(this.ideal);
      this.target.copy(this.aim);
      this.initialized = true;
    }
    this.camera.position.lerp(this.ideal, smoothing);
    this.target.lerp(this.aim, smoothing);
    this.camera.fov = (landscape ? 56 : 69) + this.follow * 8 + clamp(player.speed * .053, 0, 5);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.target);
  }

  private drawParticles(dt: number, quality: Quality) {
    this.smoke.visible = quality === 'high';
    if (!this.smoke.visible) return;
    const { track, player } = this.race;
    this.emitter += dt;
    if ((player.drift || player.impact > .24) && player.speed > 12 && this.emitter > .027) {
      this.emitter = 0;
      for (const side of [-1, 1]) {
        const p = track.sample(player.s - 1.6, player.lane + side * 1.07);
        const particle = this.particles[this.nextParticle++ % fx];
        Object.assign(particle, { x: p.x, y: p.y + .48, z: p.z, life: .73 + this.rng() * .48, side: side * (1 + this.rng() * 2) });
      }
    }
    const positions = this.smoke.geometry.attributes.position as T.BufferAttribute;
    const colors = this.smoke.geometry.attributes.color as T.BufferAttribute;
    this.particles.forEach((p, i) => {
      p.life = Math.max(0, p.life - dt);
      p.y += dt * 1.02;
      p.x += dt * p.side;
      positions.setXYZ(i, p.x, p.life ? p.y : -800, p.z);
      const a = Math.min(1, p.life * 1.22);
      colors.setXYZ(i, .65 * a, .58 * a, .47 * a);
    });
    positions.needsUpdate = colors.needsUpdate = true;
  }

  dispose() {
    const textures = new Set<T.Texture>();
    const materials = new Set<T.Material>();
    const geometries = new Set<T.BufferGeometry>();
    this.scene.traverse(node => {
      if (!(node instanceof T.Mesh || node instanceof T.Points)) return;
      // Immutable geometry/material templates are shared across race sessions.
      if (!node.geometry.userData.shared) geometries.add(node.geometry);
      const items = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of items) if (!mat.userData.shared) materials.add(mat);
      if (node instanceof T.InstancedMesh) node.dispose();
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
      material.dispose();
    }
    geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
    this.renderer.dispose();
  }
}
