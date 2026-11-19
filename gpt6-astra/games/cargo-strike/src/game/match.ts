import { clamp, direction, distance, normalize, randomSeed, rayBox, raySphere, type Vec3 } from './math';
import { canStand, floorAt, moveBody, spawns, visible, wallDistance } from './map';
import { WEAPONS, magazine, transferAmmo, type WeaponId } from './weapons';
import { eye, type Actor, type GameEvent, type Grenade, type Input, type Phase, type Settings, type Team } from './types';
import { updateBot } from './bots';
const NAMES = ['YOU', 'Kestrel', 'Nomad', 'Echo', 'Viper', 'Ghost', 'Raven', 'Spectre'];
export class Match {
    phase: Phase = 'lobby';
    actors: Actor[] = [];
    events: GameEvent[] = [];
    grenades: Grenade[] = [];
    scores: [
        number,
        number
    ] = [0, 0];
    elapsed = 0;
    shots = 0;
    hits = 0;
    streak = 0;
    settings: Settings = { primary: 'm4', difficulty: 'regular', mode: 'team', target: 40, duration: 300 };
    random: () => number;
    aim = false;
    constructor(seed = Date.now()) { this.random = randomSeed(seed); this.createActors(); }
    get player() { return this.actors[0]; }
    createActors(): void {
        this.actors = Array.from({ length: 8 }, (_, id) => this.createActor(id, id < 4 ? 0 : 1));
    }
    private createActor(id: number, team: Team): Actor {
        return { id, name: NAMES[id], team, pos: { ...spawns[team][id % 4] }, yaw: team === 0 ? 0 : Math.PI, pitch: 0, hp: 100, armor: 100,
            alive: true, respawn: 0, shield: 2.3, kills: 0, deaths: 0, headshots: 0, weapon: id === 0 ? this.settings.primary : 'm4',
            primary: id === 0 ? this.settings.primary : 'm4', magazines: { m4: magazine('m4'), ak: magazine('ak'), awp: magazine('awp'), pistol: magazine('pistol') },
            cooldown: 0, reload: 0, crouch: false, vy: 0, grounded: true, moving: 0, sprint: false, fired: false, path: [], repath: 0, target: -1, reaction: 0, strafe: 1, grenades: 2 };
    }
    start(settings: Settings): void {
        this.settings = { ...settings };
        this.createActors();
        this.events = [];
        this.grenades = [];
        this.scores = [0, 0];
        this.elapsed = 0;
        this.shots = 0;
        this.hits = 0;
        this.streak = 0;
        this.aim = false;
        if (settings.mode === 'practice') {
            this.player.pos = { x: 0, y: 0, z: 16 };
            for (const actor of this.actors.slice(1)) {
                if (actor.team === 0)
                    actor.alive = false;
                else {
                    actor.pos = { x: [0, 6, -6, 0][actor.id - 4], y: 0, z: [9, 6, -3, -15][actor.id - 4] };
                    actor.shield = 0;
                }
            }
        }
        this.phase = 'playing';
    }
    update(dt: number, input: Input): void {
        if (this.phase !== 'playing')
            return;
        dt = clamp(dt, 0, 1 / 30);
        this.elapsed += dt;
        for (const actor of this.actors) {
            if (!actor.alive) {
                if (this.settings.mode === 'practice' && actor.team === 0 && actor.id !== 0)
                    continue;
                actor.respawn -= dt;
                if (actor.respawn <= 0)
                    this.respawn(actor);
                continue;
            }
            actor.shield = Math.max(0, actor.shield - dt);
            actor.cooldown = Math.max(0, actor.cooldown - dt);
            if (actor.reload > 0) {
                actor.reload -= dt;
                if (actor.reload <= 0) {
                    actor.reload = 0;
                    transferAmmo(actor.magazines[actor.weapon], actor.weapon);
                }
            }
            if (actor.id === 0)
                this.updatePlayer(dt, input);
            else
                updateBot(this, actor, dt);
        }
        this.updateGrenades(dt);
        if (this.settings.mode === 'team' && (this.scores.some(n => n >= this.settings.target) || this.elapsed >= this.settings.duration)) {
            this.phase = 'finished';
            this.events.push({ type: 'finish' });
        }
    }
    private updatePlayer(dt: number, input: Input): void {
        const p = this.player;
        this.aim = input.aim;
        p.crouch = input.crouch || (p.crouch && !canStand(p.pos.x, p.pos.y, p.pos.z, 1.8));
        p.sprint = input.sprint && !p.crouch && !input.aim && input.forward > 0 && !input.fire;
        const speed = p.crouch ? 2.25 : p.sprint ? 7 : 4.6;
        const n = Math.max(1, Math.hypot(input.forward, input.right));
        const dx = (-Math.sin(p.yaw) * input.forward + Math.cos(p.yaw) * input.right) / n;
        const dz = (-Math.cos(p.yaw) * input.forward - Math.sin(p.yaw) * input.right) / n;
        p.moving = Math.hypot(dx, dz);
        moveBody(p.pos, dx * speed * dt, dz * speed * dt, p.crouch ? 1.2 : 1.8, p.grounded);
        if (input.jump && p.grounded) {
            p.vy = 6.5;
            p.grounded = false;
        }
        const before = p.pos.y;
        p.vy -= 18 * dt;
        p.pos.y += p.vy * dt;
        if (p.vy > 0 && !canStand(p.pos.x, p.pos.y, p.pos.z, p.crouch ? 1.2 : 1.8)) {
            p.pos.y = before;
            p.vy = 0;
        }
        const floor = floorAt(p.pos, before);
        if (p.pos.y <= floor) {
            p.pos.y = floor;
            p.vy = 0;
            p.grounded = true;
        }
        else
            p.grounded = false;
        const weapon = WEAPONS[p.weapon];
        if (input.fire && (!p.fired || weapon.automatic))
            this.shoot(p);
        p.fired = input.fire;
    }
    shoot(actor: Actor, forced?: Vec3): void {
        if (this.phase !== 'playing' || !actor.alive || actor.cooldown > 0 || actor.reload > 0 || actor.sprint)
            return;
        const spec = WEAPONS[actor.weapon], mag = actor.magazines[actor.weapon];
        if (mag.ammo === 0) {
            if (actor.id === 0)
                this.events.push({ type: 'empty' });
            this.reload(actor);
            actor.cooldown = .25;
            return;
        }
        mag.ammo--;
        actor.cooldown = spec.interval;
        actor.shield = 0;
        const origin = eye(actor), isPlayer = actor.id === 0;
        const spread = spec.spread * (isPlayer && this.aim ? .18 : 1) * (actor.crouch ? .65 : 1) * (1 + actor.moving * 2);
        const dir = forced ?? direction(actor.yaw + (this.random() - .5) * spread, actor.pitch + (this.random() - .5) * spread);
        let end = wallDistance(origin, dir), target: Actor | undefined, head = false;
        for (const victim of this.actors) {
            if (victim.team === actor.team || !victim.alive || victim.shield > 0)
                continue;
            const e = eye(victim);
            const headHit = raySphere(origin, dir, { ...e, y: e.y + .03 }, .235);
            const bodyHit = rayBox(origin, dir, { x: e.x, y: victim.pos.y + (victim.crouch ? .48 : .72), z: e.z, w: .62, h: victim.crouch ? .78 : 1.22, d: .48 });
            const h = headHit ?? Infinity, b = bodyHit ?? Infinity, t = Math.min(h, b);
            if (t < end) {
                end = t;
                target = victim;
                head = h <= b;
            }
        }
        const to = { x: origin.x + dir.x * end, y: origin.y + dir.y * end, z: origin.z + dir.z * end };
        this.events.push({ type: 'shot', actor: actor.id, weapon: actor.weapon, from: origin, to, hit: !!target });
        if (isPlayer) {
            this.shots++;
            actor.pitch = clamp(actor.pitch + spec.recoil * (this.aim ? .55 : 1), -1.45, 1.45);
        }
        if (target) {
            if (isPlayer)
                this.hits++;
            this.damage(target, actor, spec.damage * (head ? 4 : 1), head, actor.weapon, to);
        }
    }
    damage(victim: Actor, actor: Actor, raw: number, head: boolean, weapon: WeaponId | 'grenade', position: Vec3): void {
        if (!victim.alive || victim.shield > 0 || victim.team === actor.team)
            return;
        const absorbed = Math.min(victim.armor, raw * (head ? .12 : .22));
        victim.armor -= absorbed;
        const amount = raw - absorbed;
        victim.hp = Math.max(0, victim.hp - amount);
        this.events.push({ type: 'hit', actor: actor.id, victim: victim.id, amount, head, position: { ...position } });
        if (victim.hp === 0) {
            victim.alive = false;
            victim.deaths++;
            victim.respawn = this.settings.mode === 'practice' ? 1.5 : 3;
            victim.reload = 0;
            actor.kills++;
            if (head)
                actor.headshots++;
            this.scores[actor.team]++;
            if (actor.id === 0)
                this.streak++;
            if (victim.id === 0)
                this.streak = 0;
            this.events.push({ type: 'kill', actor: actor.id, victim: victim.id, weapon, head });
        }
    }
    private respawn(actor: Actor): void {
        const old = actor;
        const fresh = this.createActor(actor.id, actor.team);
        // Prefer the safest of four slots; protection never lasts after firing.
        const slots = [...spawns[actor.team]].sort((a, b) => {
            const enemies = this.actors.filter(e => e.alive && e.team !== actor.team);
            return Math.min(...enemies.map(e => distance(b, e.pos))) - Math.min(...enemies.map(e => distance(a, e.pos)));
        });
        fresh.pos = { ...slots[Math.floor(this.random() * 2)] };
        if (this.settings.mode === 'practice') {
            fresh.pos = { ...old.pos };
            fresh.shield = 0;
        }
        Object.assign(actor, fresh, { kills: old.kills, deaths: old.deaths, headshots: old.headshots });
    }
    reload(actor = this.player): void {
        if (this.phase !== 'playing' || !actor.alive || actor.reload > 0)
            return;
        const spec = WEAPONS[actor.weapon], mag = actor.magazines[actor.weapon];
        if (mag.ammo >= spec.mag || mag.reserve === 0)
            return;
        actor.reload = spec.reload;
        this.events.push({ type: 'reload', actor: actor.id });
    }
    switchWeapon(slot: 1 | 2): void {
        const p = this.player;
        if (!p.alive || this.phase !== 'playing')
            return;
        const next = slot === 1 ? p.primary : 'pistol';
        if (next === p.weapon)
            return;
        p.weapon = next;
        p.reload = 0;
        p.cooldown = .3;
        p.fired = true;
        this.aim = false;
    }
    throwGrenade(): void {
        const p = this.player;
        if (this.phase !== 'playing' || !p.alive || p.grenades <= 0 || p.cooldown > 0)
            return;
        p.grenades--;
        p.shield = 0;
        p.cooldown = .6;
        const d = direction(p.yaw, p.pitch + .15), o = eye(p);
        this.grenades.push({ owner: p.id, pos: { ...o }, vel: { x: d.x * 13, y: d.y * 13 + 3, z: d.z * 13 }, fuse: 2.2 });
    }
    private updateGrenades(dt: number): void {
        for (const g of this.grenades) {
            g.fuse -= dt;
            g.vel.y -= 12 * dt;
            const delta = { x: g.vel.x * dt, y: g.vel.y * dt, z: g.vel.z * dt }, length = Math.hypot(delta.x, delta.y, delta.z);
            if (wallDistance(g.pos, normalize(delta), length + .12) < length + .12) {
                g.vel.x *= -.4;
                g.vel.z *= -.4;
                g.vel.y = Math.abs(g.vel.y) * .35;
            }
            else {
                g.pos.x += delta.x;
                g.pos.y += delta.y;
                g.pos.z += delta.z;
            }
            if (g.pos.y < .15) {
                g.pos.y = .15;
                g.vel.y = Math.abs(g.vel.y) * .4;
                g.vel.x *= .8;
                g.vel.z *= .8;
            }
            if (g.fuse <= 0) {
                this.events.push({ type: 'blast', pos: { ...g.pos } });
                for (const a of this.actors) {
                    const d = distance(g.pos, eye(a));
                    if (d < 7 && visible(g.pos, eye(a)))
                        this.damage(a, this.actors[g.owner], 140 * (1 - d / 7), false, 'grenade', eye(a));
                }
            }
        }
        this.grenades = this.grenades.filter(g => g.fuse > 0);
    }
}
