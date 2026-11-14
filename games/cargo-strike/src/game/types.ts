import type { Vec3 } from './math';
import type { Magazine, WeaponId } from './weapons';
export type Team = 0 | 1;
export type Phase = 'lobby' | 'playing' | 'paused' | 'finished';
export type Difficulty = 'recruit' | 'regular' | 'veteran';
export interface Settings {
    primary: WeaponId;
    difficulty: Difficulty;
    mode: 'team' | 'practice';
    target: number;
    duration: number;
}
export interface Actor {
    id: number;
    name: string;
    team: Team;
    pos: Vec3;
    yaw: number;
    pitch: number;
    hp: number;
    armor: number;
    alive: boolean;
    respawn: number;
    shield: number;
    kills: number;
    deaths: number;
    headshots: number;
    weapon: WeaponId;
    primary: WeaponId;
    magazines: Record<WeaponId, Magazine>;
    cooldown: number;
    reload: number;
    crouch: boolean;
    vy: number;
    grounded: boolean;
    moving: number;
    sprint: boolean;
    fired: boolean;
    path: Vec3[];
    repath: number;
    target: number;
    reaction: number;
    strafe: number;
    grenades: number;
}
export interface Input {
    forward: number;
    right: number;
    jump: boolean;
    crouch: boolean;
    sprint: boolean;
    fire: boolean;
    aim: boolean;
}
export const emptyInput = (): Input => ({ forward: 0, right: 0, jump: false, crouch: false, sprint: false, fire: false, aim: false });
export interface Shot {
    type: 'shot';
    actor: number;
    weapon: WeaponId;
    from: Vec3;
    to: Vec3;
    hit: boolean;
}
export interface Hit {
    type: 'hit';
    actor: number;
    victim: number;
    amount: number;
    head: boolean;
    position: Vec3;
}
export interface Kill {
    type: 'kill';
    actor: number;
    victim: number;
    weapon: WeaponId | 'grenade';
    head: boolean;
}
export type GameEvent = Shot | Hit | Kill | {
    type: 'reload';
    actor: number;
} | {
    type: 'blast';
    pos: Vec3;
} | {
    type: 'finish';
} | {
    type: 'empty';
};
export interface Grenade {
    pos: Vec3;
    vel: Vec3;
    fuse: number;
    owner: number;
}
export const eye = (actor: Actor): Vec3 => ({ x: actor.pos.x, y: actor.pos.y + (actor.crouch ? 1.05 : 1.62), z: actor.pos.z });
