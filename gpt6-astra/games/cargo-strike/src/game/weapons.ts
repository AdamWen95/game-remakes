export type WeaponId = 'm4' | 'ak' | 'awp' | 'pistol';
export interface WeaponSpec {
    id: WeaponId;
    name: string;
    label: string;
    mag: number;
    reserve: number;
    damage: number;
    interval: number;
    reload: number;
    spread: number;
    recoil: number;
    automatic: boolean;
    zoom: number;
}
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
    m4: { id: 'm4', name: 'M4A1', label: '均衡 · 突击步枪', mag: 30, reserve: 120, damage: 29, interval: .096, reload: 2.2, spread: .006, recoil: .011, automatic: true, zoom: 56 },
    ak: { id: 'ak', name: 'AK-47', label: '高伤害 · 突击步枪', mag: 30, reserve: 120, damage: 36, interval: .112, reload: 2.5, spread: .009, recoil: .017, automatic: true, zoom: 58 },
    awp: { id: 'awp', name: 'AWP', label: '高精度 · 狙击步枪', mag: 5, reserve: 25, damage: 125, interval: 1.4, reload: 2.8, spread: .018, recoil: .035, automatic: false, zoom: 20 },
    pistol: { id: 'pistol', name: 'M9', label: '半自动 · 副武器', mag: 15, reserve: 75, damage: 27, interval: .19, reload: 1.55, spread: .012, recoil: .02, automatic: false, zoom: 63 }
};
export interface Magazine {
    ammo: number;
    reserve: number;
}
export const magazine = (id: WeaponId): Magazine => ({ ammo: WEAPONS[id].mag, reserve: WEAPONS[id].reserve });
export function transferAmmo(mag: Magazine, id: WeaponId): void { const n = Math.min(WEAPONS[id].mag - mag.ammo, mag.reserve); mag.ammo += n; mag.reserve -= n; }
