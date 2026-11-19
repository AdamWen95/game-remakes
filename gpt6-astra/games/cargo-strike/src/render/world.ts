import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { props } from '../game/map';
import { surface, labelTexture } from './textures';
export function createWorld(scene: THREE.Scene): void {
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    const texture = { wood: surface('wood'), deck: surface('deck'), metal: surface('metal'), concrete: surface('concrete') };
    texture.deck.wrapS = texture.deck.wrapT = THREE.RepeatWrapping;
    texture.deck.repeat.set(10, 21);
    function material(color: string, map?: THREE.Texture, metalness = .1) {
        const key = color + (map?.uuid ?? '');
        let m = materials.get(key);
        if (!m) {
            m = new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: .82, metalness });
            materials.set(key, m);
        }
        return m;
    }
    function box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, rotation = 0) {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.rotateY(rotation);
        geo.translate(x, y, z);
        const existing = groups.get(mat);
        if (existing)
            existing.push(geo);
        else
            groups.set(mat, [geo]);
    }
    function beam(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
        const dir = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, dir.length(), 7);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
        g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
        const batch = groups.get(mat);
        if (batch)
            batch.push(g);
        else
            groups.set(mat, [g]);
    }
    const deck = material('#ffffff', texture.deck, .35), steel = material('#3f4a47', undefined, .55), white = material('#d8dace', texture.concrete), yellow = material('#c69d4b', undefined, .4);
    box(0, -.25, 0, 30, .5, 62, deck);
    box(0, -2, 0, 30, 3, 64, steel);
    // Painted deck markings, cargo rails and drainage channels.
    for (const x of [-10, 10]) {
        box(x, .012, 0, .09, .018, 60, yellow);
        for (let z = -29; z < 30; z += 1.3)
            box(x + Math.sign(x) * .4, .014, z, .55, .02, .045, steel);
    }
    for (const z of [-23, 23])
        for (let x = -10; x < 10; x += 1.2)
            box(x, .016, z, .65, .02, .16, yellow, -.6);
    for (const p of props) {
        const mat = p.kind === 'crate' ? material('#d8c8a4', texture.wood) : p.kind === 'container' ? material(p.color!, texture.metal, .35) : material(p.color ?? '#a7b0a9', texture.concrete, .12);
        box(p.x, p.y, p.z, p.w, p.h, p.d, mat);
        if (p.kind === 'container') {
            const edge = material(p.color!, undefined, .45);
            for (const x of [-1, 1])
                for (const z of [-1, 1])
                    box(p.x + x * (p.w / 2 - .04), p.y, p.z + z * (p.d / 2 - .04), .13, p.h + .05, .13, edge);
            for (const y of [-1, 1]) {
                box(p.x, p.y + y * p.h / 2, p.z - p.d / 2, p.w, .12, .12, edge);
                box(p.x, p.y + y * p.h / 2, p.z + p.d / 2, p.w, .12, .12, edge);
            }
            for (let z = -p.d / 2 + .18; z < p.d / 2; z += .38)
                for (const x of [-1, 1])
                    box(p.x + x * (p.w / 2 + .01), p.y, p.z + z, .045, p.h - .18, .07, edge);
            for (const x of [-.32, .32])
                beam(new THREE.Vector3(p.x + x * p.w, p.y - p.h / 2 + .15, p.z + p.d / 2 + .06), new THREE.Vector3(p.x + x * p.w, p.y + p.h / 2 - .15, p.z + p.d / 2 + .06), .035, steel);
            const decal = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(p.w - 1, 4.5), 2.5), new THREE.MeshStandardMaterial({ map: labelTexture(p.label!), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
            decal.position.set(p.x, p.y + .2, p.z + p.d / 2 + .075);
            scene.add(decal);
        }
        if (p.kind === 'crate') {
            const frame = material('#ac9369', texture.wood);
            for (const x of [-1, 1])
                for (const z of [-1, 1])
                    box(p.x + x * (p.w / 2 - .08), p.y, p.z + z * (p.d / 2 + .025), .18, p.h + .05, .12, frame);
            for (const y of [-1, 1])
                for (const z of [-1, 1])
                    box(p.x, p.y + y * (p.h / 2 - .08), p.z + z * (p.d / 2 + .03), p.w, .18, .13, frame);
            for (const z of [-1, 1]) {
                const a = new THREE.Vector3(p.x - p.w * .4, p.y - p.h * .36, p.z + z * (p.d / 2 + .08)), b = new THREE.Vector3(p.x + p.w * .4, p.y + p.h * .36, p.z + z * (p.d / 2 + .08));
                beam(a, b, .075, frame);
            }
        }
    }
    // Guard rails, numbered bollards, ship superstructure and navigational equipment.
    for (const x of [-15.1, 15.1]) {
        for (let z = -30; z <= 30; z += 3) {
            beam(new THREE.Vector3(x, 2, z), new THREE.Vector3(x, 3.05, z), .045, white);
        }
        for (const y of [2.5, 3.05])
            beam(new THREE.Vector3(x, y, -31), new THREE.Vector3(x, y, 31), .045, white);
    }
    for (const sign of [-1, 1]) {
        box(0, 3.7, sign * 33.5, 30, 7.4, 4.5, white);
        box(0, 7.8, sign * 34.5, 19, 1.2, 5.5, white);
        box(0, 8.48, sign * 34.5, 21, .22, 6, steel);
        for (let x = -8; x <= 8; x += 2.5)
            box(x, 7.85, sign * 31.7, 1.9, .65, .06, material('#32484c', undefined, .5));
        for (const x of [-11, 11]) {
            box(x, 4, sign * 31.15, 2, 2.6, .08, steel);
            box(x, 5.55, sign * 30.95, 2.3, .13, .3, yellow);
        }
        box(sign * 7, 9.2, sign * 34, 2.2, 2, 2, steel);
        box(sign * 7, 10.3, sign * 34, 2.5, .3, 2.3, material('#bd794c'));
        beam(new THREE.Vector3(0, 8, sign * 34), new THREE.Vector3(0, 14, sign * 34), .1, white);
        beam(new THREE.Vector3(-3, 12, sign * 34), new THREE.Vector3(3, 12, sign * 34), .08, white);
        const signboard = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshStandardMaterial({ map: labelTexture(sign === 1 ? 'SECTOR A' : 'SECTOR B', 'MERCURY  /  TRANSPORT VESSEL'), transparent: true }));
        signboard.position.set(0, 4.4, sign * 31.2);
        if (sign === 1)
            signboard.rotation.y = Math.PI;
        scene.add(signboard);
    }
    // Cargo cranes silhouette the skyline and visually locate the two outer flanks.
    for (const sign of [-1, 1]) {
        const x = sign * 18, z = sign * -8;
        box(x, 6, z, 1.6, 16, 1.6, yellow);
        box(x - sign * 4, 13.4, z, 10, .6, .7, yellow);
        beam(new THREE.Vector3(x, 14, z), new THREE.Vector3(x - sign * 9, 13.4, z), .1, steel);
        beam(new THREE.Vector3(x - sign * 8.5, 13.4, z), new THREE.Vector3(x - sign * 8.5, 7, z), .035, steel);
        for (let y = 0; y < 13; y += 1.2)
            beam(new THREE.Vector3(x - .7, y, z - .85), new THREE.Vector3(x + .7, y + 1.2, z - .85), .06, yellow);
    }
    for (const [mat, geometries] of groups) {
        const merged = mergeGeometries(geometries);
        if (!merged)
            continue;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        geometries.forEach(g => g.dispose());
    }
}
