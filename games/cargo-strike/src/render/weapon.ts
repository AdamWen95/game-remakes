import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { WeaponId } from '../game/weapons';
export function makeWeapon(id: WeaponId, arms = false): THREE.Group {
    const root = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#303839', metalness: .82, roughness: .38 });
    const polymer = new THREE.MeshStandardMaterial({ color: '#242b2c', roughness: .72 });
    const detail = new THREE.MeshStandardMaterial({ color: '#65716b', metalness: .8, roughness: .33 });
    const wood = new THREE.MeshStandardMaterial({ color: id === 'ak' ? '#70452c' : '#687466', roughness: .65 });
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    function add(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) { if (g.index) {
        const original = g;
        g = g.toNonIndexed();
        original.dispose();
    } g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); const a = batches.get(m); if (a)
        a.push(g);
    else
        batches.set(m, [g]); }
    const b = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0) => add(new RoundedBoxGeometry(w, h, d, 1, Math.min(.006, w / 5, h / 5, d / 5)), m, x, y, z, rx);
    const c = (r: number, l: number, m: THREE.Material, x: number, y: number, z: number) => add(new THREE.CylinderGeometry(r, r, l, 12), m, x, y, z, Math.PI / 2);
    if (id === 'pistol') {
        b(.07, .075, .28, steel, 0, 0, -.04);
        b(.065, .12, .09, polymer, 0, -.08, .05, -.22);
        c(.018, .05, detail, 0, .005, -.19);
        b(.012, .012, .015, detail, 0, .048, -.15);
        for (let z = .02; z < .08; z += .012)
            b(.074, .045, .004, detail, 0, .01, z);
    }
    else {
        const sniper = id === 'awp';
        b(.085, .12, .31, steel, 0, 0, 0);
        b(.078, .13, .09, polymer, 0, -.11, .08, -.2);
        b(.075, .2, .1, id === 'ak' ? steel : detail, 0, -.145, -.08, id === 'ak' ? .22 : .05);
        for (let z = -.12; z < -.03; z += .022)
            b(.078, .15, .003, polymer, 0, -.15, z);
        b(sniper ? .1 : .075, .095, .34, id === 'ak' || sniper ? wood : polymer, 0, 0, -.29);
        c(sniper ? .018 : .014, sniper ? .53 : .32, steel, 0, .015, sniper ? -.72 : -.59);
        c(.023, .065, steel, 0, .015, sniper ? -.99 : -.78);
        for (let i = 0; i < 3; i++)
            c(.024, .008, detail, 0, .015, -.76 - i * .014);
        if (!arms) {
            b(.068, .1, .25, polymer, 0, -.012, .27);
            b(.085, .17, .065, id === 'ak' ? wood : polymer, 0, -.04, .42);
            c(.027, .23, steel, 0, .01, .2);
        }
        b(.02, .035, .36, steel, 0, .08, -.13);
        for (let z = -.34; z < .07; z += .022)
            b(.065, .009, .01, detail, 0, .102, z);
        for (let z = -.4; z < -.15; z += .035) {
            b(.083, .008, .014, detail, 0, -.05, z);
            b(.089, .033, .012, steel, 0, .005, z);
        }
        b(.012, .07, .025, steel, 0, .075, -.53);
        b(.045, .02, .025, steel, 0, .11, -.53);
        if (sniper) {
            c(.043, .31, steel, 0, .15, -.05);
            c(.055, .075, polymer, 0, .15, .14);
            c(.061, .07, steel, 0, .15, -.24);
            c(.053, .003, new THREE.MeshStandardMaterial({ color: '#4a857c', metalness: .9, roughness: .05 }), 0, .15, -.278);
            for (const z of [-.16, .05])
                b(.07, .12, .035, steel, 0, .1, z);
            add(new THREE.CylinderGeometry(.024, .024, .045, 10), detail, 0, .215, -.04);
        }
        else {
            b(.055, .02, .065, steel, 0, .112, .027);
            const ring = new THREE.TorusGeometry(.032, .007, 8, 20);
            add(ring, steel, 0, .15, .035);
            add(new THREE.SphereGeometry(.0035, 6, 6), new THREE.MeshBasicMaterial({ color: '#ee6950' }), 0, .146, .034);
        }
        b(.012, .04, .06, detail, .052, .025, .02);
        b(.022, .014, .05, steel, .06, .035, -.07);
        // Trigger guard and receiver pins.
        b(.065, .008, .12, steel, 0, -.084, .035);
        b(.015, .06, .014, steel, 0, -.055, -.018);
        for (const z of [-.075, .06])
            add(new THREE.SphereGeometry(.008, 8, 6), detail, .044, .012, z);
    }
    if (arms) {
        const sleeve = new THREE.MeshStandardMaterial({ color: '#4d5c54', roughness: .9 });
        const glove = new THREE.MeshStandardMaterial({ color: '#3e443f', roughness: .86 });
        const skin = new THREE.MeshStandardMaterial({ color: '#b58d72', roughness: .85 });
        const limb = (a: THREE.Vector3, end: THREE.Vector3, r: number, m: THREE.Material) => { const d = end.clone().sub(a), g = new THREE.CylinderGeometry(r * .85, r, d.length(), 10); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); const mid = a.clone().add(end).multiplyScalar(.5); add(g, m, mid.x, mid.y, mid.z); };
        limb(new THREE.Vector3(.18, -.34, .45), new THREE.Vector3(.015, -.14, .08), .062, sleeve);
        limb(new THREE.Vector3(-.22, -.33, .3), new THREE.Vector3(-.055, -.075, -.3), .065, sleeve);
        add(new THREE.SphereGeometry(.06, 12, 10), glove, .018, -.105, .085);
        add(new THREE.SphereGeometry(.055, 12, 10), glove, -.032, -.06, id === 'pistol' ? -.04 : -.3);
        for (let i = 0; i < 4; i++)
            b(.014, .027, .055, skin, .046, -.08 + i * .012, .063);
    }
    for (const [mat, gs] of batches) {
        const geometry = mergeGeometries(gs);
        if (!geometry)
            continue;
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
        gs.forEach(g => g.dispose());
    }
    return root;
}
