import * as T from 'three';
import { eye } from '../actor.ts';
import type { Event } from '../combat.ts';
import { weapons, type Gun } from '../loadout.ts';
import type { Match } from '../match.ts';
import { effects, glowMap } from './effects.ts';
import { firearm, soldier } from './models.ts';
import { createSeascape, sun } from './sea.ts';
import { createShip } from './ship.ts';

export class View {
  private renderer: T.WebGLRenderer;
  private world = new T.Scene();
  private camera = new T.PerspectiveCamera(72, 1, .032, 440);
  private foreground = new T.Scene();
  private gunCamera = new T.PerspectiveCamera(56, 1, .022, 12);
  private guns = new Map<Gun, ReturnType<typeof firearm>>();
  private bodies = Array.from({ length: 7 }, (_, i) => soldier(i < 3 ? 0 : 1));
  private environment: ReturnType<typeof createSeascape>;
  private fx: ReturnType<typeof effects>;
  private grenades = new T.Group();
  private grenadeGeometry = new T.IcosahedronGeometry(.093, 2);
  private grenadeMaterial = new T.MeshStandardMaterial({ color: 0x706b46, roughness: .66, metalness: .52 });
  private flash = new T.Sprite(new T.SpriteMaterial({ map: glowMap(), color: 0xffb34b, blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
  private flashLight = new T.PointLight(0xffb870, 0, 2.4, 2);
  private flashFor = 0;
  private aim = 0;
  private height = 1.63;
  private clock = 0;
  private stride = 0;
  private swapUntil = 0;
  private shake = 0;
  private width = 0;
  private heightPx = 0;
  private detail = true;

  constructor(private canvas: HTMLCanvasElement, detail: boolean) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.autoClear = false;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.world.fog = new T.FogExp2(0x92a6ae, .0115);
    this.world.add(new T.HemisphereLight(0xadcee8, 0x726052, 2.0));
    const key = new T.DirectionalLight(0xffdcaa, 2.6);
    key.position.copy(sun).multiplyScalar(68);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -37; key.shadow.camera.right = 37;
    key.shadow.camera.top = 44; key.shadow.camera.bottom = -44;
    key.shadow.camera.near = 2; key.shadow.camera.far = 142;
    key.shadow.normalBias = .034; key.shadow.bias = -.0002;
    key.shadow.intensity = .83;
    this.world.add(key, this.grenades);
    this.environment = createSeascape(this.world);
    createShip(this.world);
    this.fx = effects(this.world);
    this.world.add(...this.bodies.map(b => b.root));
    this.foreground.add(new T.HemisphereLight(0xe0ebf1, 0x818273, 2.4), this.flash, this.flashLight);
    const gunKey = new T.DirectionalLight(0xffdfa3, 2.8);
    gunKey.position.set(-2, 2, -2);
    this.foreground.add(gunKey);
    for (const gun of Object.keys(weapons) as Gun[]) {
      const model = firearm(gun, true);
      this.guns.set(gun, model);
      this.foreground.add(model.model);
    }
    this.quality(detail);
  }

  quality(detail: boolean) {
    this.detail = detail;
    this.width = 0;
    this.renderer.shadowMap.enabled = detail;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, detail ? 1.55 : 1) * (detail ? 1 : .84));
  }

  reset() {
    this.fx.clear();
    this.aim = 0; this.height = 1.63; this.shake = 0; this.flashFor = 0; this.swapUntil = 0;
  }

  event(e: Event) {
    this.fx.handle(e, this.camera);
    if (e.type === 'shot' && !e.actor.bot) this.flashFor = .058;
    if (e.type === 'switch' && !e.actor.bot) this.swapUntil = this.clock + .26;
    if (e.type === 'hit' && !e.target.bot) this.shake = .026;
    if (e.type === 'boom' && this.camera.position.distanceTo(new T.Vector3(e.at.x, e.at.y, e.at.z)) < 13) this.shake = .023;
    if (e.type === 'spawn' && !e.actor.bot) { this.height = eye(e.actor).y; this.aim = 0; }
  }

  render(match: Match, dt: number) {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    if (this.width !== width || this.heightPx !== height) {
      this.width = width; this.heightPx = height;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = this.gunCamera.aspect = width / height;
      this.gunCamera.updateProjectionMatrix();
    }
    this.clock += dt;
    this.environment(this.clock);
    const a = match.player, wp = weapons[a.gun];
    const alive = !!a.hp;
    this.aim = T.MathUtils.damp(this.aim, alive && a.ads ? 1 : 0, 14, dt);
    this.stride += dt * a.moving * 2.7;
    this.flashFor = Math.max(0, this.flashFor - dt);
    this.shake *= Math.exp(-6 * dt);
    const targetHeight = alive ? eye(a).y : a.pos.y + .61;
    this.height = T.MathUtils.damp(this.height, targetHeight, 16, dt);
    const bounce = Math.sin(this.stride) * Math.min(.046, a.moving * .009);
    this.camera.position.set(a.pos.x, this.height + bounce * .63, a.pos.z);
    this.camera.rotation.set(a.pitch + a.recoil + this.shake * Math.sin(this.clock * 77), a.yaw,
      alive ? 0 : -.17, 'YXZ');
    this.camera.fov = 72 * T.MathUtils.lerp(1, wp.zoom, this.aim) + (a.sprinting ? 3.2 : 0);
    this.camera.updateProjectionMatrix();
    for (let i = 0; i < this.bodies.length; i++) {
      const target = match.actors.find(actor => actor.id === i + 1);
      const body = this.bodies[i];
      if (target) body.update(target, match.time);
      else body.root.visible = false;
    }
    while (this.grenades.children.length < match.grenades.length)
      this.grenades.add(new T.Mesh(this.grenadeGeometry, this.grenadeMaterial));
    this.grenades.children.forEach((obj, i) => {
      const grenade = match.grenades[i];
      obj.visible = !!grenade;
      if (grenade) { obj.position.set(grenade.pos.x, grenade.pos.y, grenade.pos.z); obj.rotation.x += dt * 6.9; }
    });
    this.fx.tick(dt);
    this.renderer.clear();
    this.renderer.render(this.world, this.camera);
    const scope = a.gun === 'awp' && this.aim > .78 && alive;
    this.canvas.classList.toggle('scoped', scope);
    if (!alive || scope) return;
    const active = this.guns.get(a.gun)!;
    for (const { model } of this.guns.values()) model.visible = model === active.model;
    const reload = a.reloadUntil > 0 ? Math.sin(Math.PI * Math.min(1, (a.reloadUntil - match.time) / wp.reload)) : 0;
    const swap = Math.max(0, (this.swapUntil - this.clock) / .26);
    const aspect = Math.min(1, Math.pow(this.camera.aspect / 1.7, .6));
    active.model.position.set(
      .39 * aspect * (1 - this.aim) + Math.sin(this.stride * .5) * bounce * .5 + reload * .07,
      -.35 + this.aim * (a.gun === 'awp' ? .184 : .22) + bounce * .72 - reload * .3 - swap * .37 - (a.sprinting ? .10 : 0),
      -.39 - this.aim * .08 + a.kick * .075,
    );
    active.model.rotation.set(.018 + a.kick * .045 + reload * -.27, .065 * (1 - this.aim) + reload * .23, a.sprinting ? -.16 : reload * -.39);
    active.model.updateMatrixWorld(true);
    this.flash.visible = this.flashFor > 0;
    this.flash.position.copy(active.model.localToWorld(active.muzzle.clone()));
    this.flash.scale.setScalar(.17 + this.flashFor * 2.8);
    this.flash.material.rotation = this.clock * 29;
    this.flashLight.position.copy(this.flash.position);
    this.flashLight.intensity = this.detail ? this.flashFor * 48 : 0;
    this.renderer.clearDepth();
    this.renderer.render(this.foreground, this.gunCamera);
  }
}
