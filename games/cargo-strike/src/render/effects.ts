import * as THREE from 'three';
import type { Vec3 } from '../game/math';
interface Particle {
    p: THREE.Vector3;
    v: THREE.Vector3;
    life: number;
    total: number;
    size: number;
    color: THREE.Color;
}
export class Effects {
    private particles: Particle[] = [];
    private sparks: THREE.InstancedMesh;
    private dummy = new THREE.Object3D();
    private tracers: {
        line: THREE.Line;
        life: number;
    }[] = [];
    constructor(private scene: THREE.Scene) {
        this.sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }), 160);
        this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.sparks.frustumCulled = false;
        this.sparks.count = 0;
        scene.add(this.sparks);
    }
    shot(from: Vec3, to: Vec3, hit: boolean, player: boolean): void {
        const start = new THREE.Vector3(from.x, from.y - .12, from.z);
        const geometry = new THREE.BufferGeometry().setFromPoints([start, new THREE.Vector3(to.x, to.y, to.z)]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: player ? '#ffe3a5' : '#ffd7a3', transparent: true, opacity: .5, depthWrite: false }));
        this.scene.add(line);
        this.tracers.push({ line, life: .055 });
        this.burst(to, hit ? 4 : 7, hit ? '#c7baa3' : '#ffbd69', 1.6, .4, .028);
    }
    burst(p: Vec3, count: number, color: string, speed: number, life: number, size: number): void {
        for (let i = 0; i < count && this.particles.length < 160; i++)
            this.particles.push({ p: new THREE.Vector3(p.x, p.y, p.z), v: new THREE.Vector3((Math.random() - .5) * speed, Math.random() * speed, (Math.random() - .5) * speed), life, total: life, size, color: new THREE.Color(color) });
    }
    update(dt: number): void {
        for (const t of this.tracers) {
            t.life -= dt;
            if (t.life <= 0) {
                this.scene.remove(t.line);
                t.line.geometry.dispose();
                (t.line.material as THREE.Material).dispose();
            }
        }
        this.tracers = this.tracers.filter(t => t.life > 0);
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach((p, i) => { p.life -= dt; p.v.y -= 6 * dt; p.p.addScaledVector(p.v, dt); this.dummy.position.copy(p.p); this.dummy.scale.setScalar(p.size * Math.max(0, p.life / p.total)); this.dummy.updateMatrix(); this.sparks.setMatrixAt(i, this.dummy.matrix); this.sparks.setColorAt(i, p.color); });
        this.sparks.count = this.particles.length;
        this.sparks.instanceMatrix.needsUpdate = true;
        if (this.sparks.instanceColor)
            this.sparks.instanceColor.needsUpdate = true;
    }
}
