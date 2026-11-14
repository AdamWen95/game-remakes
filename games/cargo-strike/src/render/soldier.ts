import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeWeapon } from './weapon';
import { canvasTexture } from './textures';
import type { Actor } from '../game/types';
export class Soldier {
    root = new THREE.Group();
    leftLeg = new THREE.Group();
    rightLeg = new THREE.Group();
    torso = new THREE.Group();
    constructor(team: number) {
        const camo = canvasTexture((c, s) => { c.fillStyle = team === 0 ? '#677f80' : '#948974'; c.fillRect(0, 0, s, s); for (let i = 0; i < 500; i++) {
            c.fillStyle = ['#242c2444', '#142e2244', '#b0b7a333'][i % 3];
            c.fillRect(Math.random() * s, Math.random() * s, Math.random() * 35 + 8, Math.random() * 25 + 4);
        } }, 256);
        const cloth = new THREE.MeshStandardMaterial({ map: camo, roughness: .94 });
        const armor = new THREE.MeshStandardMaterial({ color: team === 0 ? '#34454a' : '#4a4a3c', roughness: .84 });
        const black = new THREE.MeshStandardMaterial({ color: '#242c2b', roughness: .7 });
        const skin = new THREE.MeshStandardMaterial({ color: '#b49176', roughness: .85 });
        const band = new THREE.MeshStandardMaterial({ color: team === 0 ? '#82bed0' : '#c77451', roughness: .75 });
        function part(group: THREE.Group, items: {
            g: THREE.BufferGeometry;
            m: THREE.Material;
            x: number;
            y: number;
            z: number;
        }[]) {
            const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
            for (const i of items) {
                if (i.g.index) {
                    const original = i.g;
                    i.g = i.g.toNonIndexed();
                    original.dispose();
                }
                i.g.translate(i.x, i.y, i.z);
                const list = batches.get(i.m);
                if (list)
                    list.push(i.g);
                else
                    batches.set(i.m, [i.g]);
            }
            for (const [m, gs] of batches) {
                const mesh = new THREE.Mesh(mergeGeometries(gs)!, m);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                group.add(mesh);
                gs.forEach(g => g.dispose());
            }
        }
        const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => ({ g: new RoundedBoxGeometry(w, h, d, 2, Math.min(.035, w / 5, h / 5, d / 5)), m, x, y, z });
        const sphere = (r: number, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => ({ g: new THREE.SphereGeometry(r, 12, 10).scale(sx, sy, sz), m, x, y, z });
        const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => { const d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(.5); const g = new THREE.CapsuleGeometry(r, Math.max(0, d.length() - r * 2), 4, 10); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); return { g, m, x: mid.x, y: mid.y, z: mid.z }; };
        const body: {
            g: THREE.BufferGeometry;
            m: THREE.Material;
            x: number;
            y: number;
            z: number;
        }[] = [box(.48, .51, .28, cloth, 0, 1.12, 0), box(.44, .4, .14, armor, 0, 1.14, -.18), box(.36, .4, .17, armor, 0, 1.16, .2),
            box(.46, .09, .31, black, 0, .86, 0), sphere(.195, skin, 0, 1.58, 0, .82, 1.12, .9), sphere(.208, armor, 0, 1.68, .012, 1, .68, 1.05),
            box(.3, .08, .1, black, 0, 1.62, -.16), box(.28, .09, .1, armor, 0, 1.49, -.15), sphere(.09, armor, -.19, 1.59, .01, .5, 1, 1), sphere(.09, armor, .19, 1.59, .01, .5, 1, 1),
            box(.15, .065, .16, band, -.32, 1.25, -.03), box(.15, .065, .16, band, .32, 1.25, -.03),
            sphere(.08, black, -.17, 1.12, -.39), sphere(.08, black, .16, 1.12, -.23)];
        for (const x of [-.14, 0, .14])
            body.push(box(.105, .16, .08, armor, x, 1.08, -.28));
        for (const side of [-1, 1]) {
            body.push(limb(new THREE.Vector3(side * .27, 1.33, 0), new THREE.Vector3(side * .32, 1.04, -.07), .095, cloth));
            body.push(limb(new THREE.Vector3(side * .32, 1.04, -.07), new THREE.Vector3(side * .15, 1.12, -.36), .075, cloth));
            body.push(box(.075, .13, .04, black, side * .2, 1.36, -.19));
        }
        part(this.torso, body);
        const gun = makeWeapon('m4');
        gun.position.set(.13, 1.13, -.38);
        gun.scale.setScalar(.7);
        this.torso.add(gun);
        this.root.add(this.torso, this.leftLeg, this.rightLeg);
        for (const [group, x] of [[this.leftLeg, -.14], [this.rightLeg, .14]] as const) {
            group.position.set(x, .86, 0);
            part(group, [limb(new THREE.Vector3(0, -.01, 0), new THREE.Vector3(0, -.44, 0), .115, cloth), limb(new THREE.Vector3(0, -.4, 0), new THREE.Vector3(0, -.78, 0), .09, cloth), box(.18, .15, .1, armor, 0, -.44, -.1), box(.2, .14, .32, black, 0, -.79, -.06), box(.04, .19, .15, armor, .1, -.2, .02)]);
        }
    }
    update(a: Actor, time: number): void {
        this.root.visible = a.alive || a.respawn > 1.5;
        this.root.position.set(a.pos.x, a.pos.y, a.pos.z);
        this.root.rotation.set(0, a.yaw, 0);
        if (!a.alive) {
            this.root.rotation.z = Math.PI / 2;
            this.root.position.y += .18;
            return;
        }
        this.torso.position.y = a.crouch ? -.38 : 0;
        const swing = Math.sin(time * 9 + a.id) * .45 * a.moving;
        this.leftLeg.rotation.x = swing;
        this.rightLeg.rotation.x = -swing;
        this.root.scale.y = a.crouch ? .85 : 1;
    }
}
