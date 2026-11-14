import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Match } from '../game/match';
import { eye, type GameEvent } from '../game/types';
import { WEAPONS, type WeaponId } from '../game/weapons';
import { environment } from './environment';
import { createWorld } from './world';
import { Soldier } from './soldier';
import { makeWeapon } from './weapon';
import { Effects } from './effects';
export class GameRenderer {
    renderer: THREE.WebGLRenderer;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(76, 1, .06, 800);
    private viewScene = new THREE.Scene();
    private viewCamera = new THREE.PerspectiveCamera(68, 1, .01, 10);
    private weaponRoot = new THREE.Group();
    private weapon?: THREE.Group;
    private weaponId?: WeaponId;
    private arsenal = new Map<WeaponId, THREE.Group>();
    private soldiers: Soldier[] = [];
    private environment: ReturnType<typeof environment>;
    private effects: Effects;
    private recoil = 0;
    private flashTimer = 0;
    private flash: THREE.Mesh;
    private clock = 0;
    private grenades: THREE.Mesh[] = [];
    private sun: THREE.DirectionalLight;
    private kick = 0;
    private quality = 'high';
    constructor(public canvas: HTMLCanvasElement) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.14;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.autoClear = false;
        this.renderer.info.autoReset = false;
        this.scene.fog = new THREE.Fog('#9caeae', 80, 350);
        this.scene.add(new THREE.HemisphereLight('#c9e2ec', '#626153', 2.2));
        this.sun = new THREE.DirectionalLight('#fff1d2', 3.1);
        this.sun.position.set(-25, 42, -28);
        this.sun.castShadow = true;
        Object.assign(this.sun.shadow.camera, { left: -42, right: 42, top: 45, bottom: -45, near: .5, far: 130 });
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.bias = -.00025;
        this.sun.shadow.normalBias = .035;
        this.scene.add(this.sun);
        const pmrem = new THREE.PMREMGenerator(this.renderer), room = new RoomEnvironment();
        this.scene.environment = pmrem.fromScene(room, .04).texture;
        this.scene.environmentIntensity = .28;
        room.dispose();
        pmrem.dispose();
        this.environment = environment(this.scene);
        createWorld(this.scene);
        this.effects = new Effects(this.scene);
        for (let i = 1; i < 8; i++) {
            const soldier = new Soldier(i < 4 ? 0 : 1);
            this.soldiers.push(soldier);
            this.scene.add(soldier.root);
        }
        this.viewScene.environment = this.scene.environment;
        this.viewScene.environmentIntensity = .75;
        this.viewScene.add(new THREE.HemisphereLight('#d9e9f0', '#665a48', 2.5));
        const weaponLight = new THREE.DirectionalLight('#fff1d4', 4);
        weaponLight.position.set(-2, 3, -1);
        this.viewScene.add(weaponLight);
        this.viewScene.add(this.weaponRoot);
        this.flash = new THREE.Mesh(new THREE.ConeGeometry(.055, .22, 6), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: .95, depthTest: false }));
        this.flash.rotation.x = -Math.PI / 2;
        this.flash.position.set(0, .015, -.84);
        this.flash.visible = false;
        this.weaponRoot.add(this.flash);
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    resize(): void {
        this.renderer.setSize(innerWidth, innerHeight, false);
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.viewCamera.aspect = this.camera.aspect;
        this.viewCamera.updateProjectionMatrix();
    }
    setQuality(value: string): void { this.quality = value; this.renderer.setPixelRatio(value === 'high' ? Math.min(devicePixelRatio, 1.5) : 1); this.sun.castShadow = value === 'high'; this.resize(); }
    get stats() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, quality: this.quality }; }
    event(e: GameEvent): void {
        if (e.type === 'shot') {
            this.effects.shot(e.from, e.to, e.hit, e.actor === 0);
            if (e.actor === 0) {
                this.recoil = 1;
                this.flashTimer = .045;
            }
        }
        if (e.type === 'blast') {
            this.effects.burst(e.pos, 75, '#f7b45d', 9, .7, .11);
            this.kick = .1;
        }
        if (e.type === 'hit' && e.victim === 0)
            this.kick = .04;
    }
    render(match: Match, dt: number): void {
        this.clock += dt;
        const time = this.clock, p = match.player, playing = match.phase !== 'lobby';
        this.environment.update(time);
        this.effects.update(dt);
        this.soldiers.forEach((s, i) => { s.update(match.actors[i + 1], time); if (!playing)
            s.root.visible = false; });
        if (playing) {
            const e = eye(p);
            const bob = p.alive && p.grounded ? Math.sin(time * (p.sprint ? 14 : 10)) * .025 * p.moving : 0;
            this.camera.position.set(e.x, e.y + bob, e.z);
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.set(p.pitch + (Math.random() - .5) * this.kick, p.yaw, 0);
            if (!p.alive) {
                this.camera.position.y = p.pos.y + .55;
                this.camera.rotation.z = .12;
            }
            const fov = match.aim && p.alive ? WEAPONS[p.weapon].zoom : p.sprint ? 83 : 76;
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, 1 - Math.exp(-12 * dt));
            this.camera.updateProjectionMatrix();
        }
        else {
            this.camera.position.set(23 + Math.sin(time * .035) * 2, 17.5, 27);
            this.camera.lookAt(-1, 1.2, -4);
            this.camera.fov = 59;
            this.camera.updateProjectionMatrix();
        }
        this.kick *= Math.exp(-12 * dt);
        while (this.grenades.length < match.grenades.length) {
            const g = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 8), new THREE.MeshStandardMaterial({ color: '#505c37', roughness: .7 }));
            this.scene.add(g);
            this.grenades.push(g);
        }
        this.grenades.forEach((g, i) => { g.visible = i < match.grenades.length; if (g.visible) {
            const p = match.grenades[i].pos;
            g.position.set(p.x, p.y, p.z);
        } });
        this.renderer.info.reset();
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        if (playing && p.alive && !(p.weapon === 'awp' && match.aim)) {
            if (this.weaponId !== p.weapon) {
                if (this.weapon)
                    this.weaponRoot.remove(this.weapon);
                this.weaponId = p.weapon;
                this.weapon = this.arsenal.get(p.weapon) ?? makeWeapon(p.weapon, true);
                this.arsenal.set(p.weapon, this.weapon);
                this.weaponRoot.add(this.weapon);
            }
            const aim = match.aim ? 1 : 0;
            this.recoil *= Math.exp(-15 * dt);
            this.flashTimer -= dt;
            this.flash.visible = this.flashTimer > 0;
            this.flash.position.z = p.weapon === 'pistol' ? -.22 : p.weapon === 'awp' ? -1.04 : -.84;
            this.flash.rotation.z = Math.random() * 6;
            const reload = p.reload > 0 ? Math.sin(Math.PI * (1 - p.reload / WEAPONS[p.weapon].reload)) : 0;
            const x = .25 * (1 - aim), y = -.27 + aim * .12, z = -.7;
            this.weaponRoot.position.lerp(new THREE.Vector3(x + Math.cos(time * 5) * p.moving * .008, y - reload * .23 + Math.sin(time * 10) * p.moving * .006, z + this.recoil * .08), 1 - Math.exp(-18 * dt));
            this.weaponRoot.rotation.set(this.recoil * .08 - reload * .5, p.sprint ? -.35 : reload * .25, reload * -.5 + (p.sprint ? .22 : 0));
            this.renderer.clearDepth();
            this.renderer.render(this.viewScene, this.viewCamera);
        }
    }
}
