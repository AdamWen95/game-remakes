import { Match } from '../game/match';
import { props } from '../game/map';
import { distance } from '../game/math';
import { WEAPONS } from '../game/weapons';
import type { GameEvent } from '../game/types';
import { $ } from './layout';
function text(id: string, value: string) { const el = $(id); if (el.textContent !== value)
    el.textContent = value; }
export function drawMap(canvas: HTMLCanvasElement, match?: Match): void {
    const c = canvas.getContext('2d')!, w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    const scale = Math.min((w - 20) / 32, (h - 22) / 64);
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(scale, scale);
    c.fillStyle = '#b8c4b514';
    c.fillRect(-15, -31, 30, 62);
    c.strokeStyle = '#d2dcc04d';
    c.lineWidth = .3;
    c.strokeRect(-15, -31, 30, 62);
    for (const p of props) {
        if (p.kind === 'roof' || p.kind === 'wall')
            continue;
        c.fillStyle = p.kind === 'container' ? '#a3b39e64' : '#d1b48178';
        c.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
    }
    c.fillStyle = '#7db3c037';
    c.fillRect(-14, 23, 28, 7);
    c.fillStyle = '#c6826b37';
    c.fillRect(-14, -30, 28, 7);
    c.font = '2.8px monospace';
    c.textAlign = 'center';
    c.fillStyle = '#b0d6df';
    c.fillText('A', 0, 28);
    c.fillStyle = '#ddb09b';
    c.fillText('B', 0, -26);
    if (match) {
        for (const a of match.actors) {
            if (!a.alive || a.id === 0)
                continue;
            if (a.team === 1 && distance(a.pos, match.player.pos) > 16)
                continue;
            c.fillStyle = a.team === 0 ? '#9cd9ed' : '#e18e6c';
            c.beginPath();
            c.arc(a.pos.x, a.pos.z, a.team === 0 ? .65 : .55, 0, 7);
            c.fill();
        }
        const p = match.player;
        c.translate(p.pos.x, p.pos.z);
        c.rotate(-p.yaw);
        c.fillStyle = '#fff0bc';
        c.beginPath();
        c.moveTo(0, -1.5);
        c.lineTo(1.05, 1);
        c.lineTo(0, .5);
        c.lineTo(-1.05, 1);
        c.closePath();
        c.fill();
    }
    c.restore();
}
export class HUD {
    private notifyTimer = 0;
    private hitTimer = 0;
    private damage = 0;
    private feed: {
        html: string;
        time: number;
    }[] = [];
    private radarClock = 0;
    event(e: GameEvent, match: Match): void {
        if (e.type === 'hit') {
            if (e.actor === 0) {
                this.hitTimer = .18;
                $('hitmarker').style.color = e.head ? '#f1ba71' : '#ebefdf';
            }
            if (e.victim === 0)
                this.damage = .85;
        }
        if (e.type === 'kill') {
            const killer = match.actors[e.actor], victim = match.actors[e.victim];
            this.feed.unshift({ html: `<strong>${killer.name}</strong><small>${e.head ? '⌖ ' : ''}${e.weapon === 'grenade' ? 'GRENADE' : WEAPONS[e.weapon].name}</small><em>${victim.name}</em>`, time: 6 });
            this.feed = this.feed.slice(0, 4);
            this.renderFeed();
            if (e.actor === 0)
                this.notify(e.head ? '精准爆头' : match.streak >= 3 ? `${match.streak} 连杀` : '确认击杀', `${victim.name}  /  +1`);
        }
        if (e.type === 'empty')
            this.notify('弹匣已空', '按 R 换弹，或按 2 切换副武器');
    }
    notify(title: string, subtitle = ''): void { $('notification').replaceChildren(document.createTextNode(title)); if (subtitle) {
        const small = document.createElement('small');
        small.textContent = subtitle;
        $('notification').append(small);
    } this.notifyTimer = 2; }
    clear(): void { this.feed = []; this.renderFeed(); this.damage = 0; this.hitTimer = 0; this.notifyTimer = 0; }
    private renderFeed(): void { $('killfeed').innerHTML = this.feed.map(item => `<div>${item.html}</div>`).join(''); }
    update(match: Match, dt: number, fps: number): void {
        const p = match.player, weapon = WEAPONS[p.weapon], mag = p.magazines[p.weapon];
        text('blue-score', String(match.scores[0]).padStart(2, '0'));
        text('red-score', String(match.scores[1]).padStart(2, '0'));
        const time = Math.max(0, Math.ceil(match.settings.duration - match.elapsed));
        text('match-timer', match.settings.mode === 'practice' ? 'TRAINING' : `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`);
        text('score-target', match.settings.mode === 'practice' ? '自由练习 · 无限复活' : `${match.settings.target} 击杀获胜`);
        text('health', String(Math.ceil(p.hp)));
        text('armor', String(Math.ceil(p.armor)));
        text('ammo', String(mag.ammo).padStart(2, '0'));
        text('reserve', String(mag.reserve));
        text('current-weapon', weapon.name);
        text('fire-mode', p.weapon === 'awp' ? '7.62 × 51 MM / BOLT ACTION' : p.weapon === 'pistol' ? '9 × 19 MM / SEMI AUTO' : '5.56 / 7.62 MM / AUTO');
        text('grenade-count', String(p.grenades));
        text('fps', `${Math.round(fps)} FPS`);
        text('protection', p.alive && p.shield > 0 ? `复活保护 ${p.shield.toFixed(1)}s · 开火后解除` : '');
        text('location', Math.abs(p.pos.x) > 11 ? '侧翼 · 货舱通道' : p.pos.z > 19 ? 'A 区 · 出生甲板' : p.pos.z < -19 ? 'B 区 · 敌方甲板' : p.pos.y > 1 ? '上层 · 高台' : '中部 · 集装箱甲板');
        $('health-bar').style.width = `${p.hp}%`;
        $('health-bar').style.background = p.hp < 30 ? '#ed8c6c' : '#d4e0bd';
        $('ammo').style.color = mag.ammo < 6 ? '#efb078' : '';
        $('death').classList.toggle('hidden', p.alive);
        text('respawn-seconds', String(Math.max(1, Math.ceil(p.respawn))));
        $('scope').classList.toggle('hidden', !(match.aim && p.weapon === 'awp' && p.alive));
        $('crosshair').classList.toggle('hidden', !p.alive || (match.aim && p.weapon === 'awp'));
        $('crosshair').style.setProperty('--gap', `${match.aim ? 3 : 6 + p.moving * 5 + (p.cooldown > 0 ? 3 : 0)}px`);
        $('reload-indicator').classList.toggle('hidden', p.reload <= 0 || !p.alive);
        $('reload-indicator').querySelector('i')!.style.width = `${(1 - p.reload / weapon.reload) * 100}%`;
        this.notifyTimer -= dt;
        this.hitTimer -= dt;
        this.damage = Math.max(0, this.damage - dt * 1.7);
        $('notification').style.opacity = this.notifyTimer > 0 ? '1' : '0';
        $('hitmarker').style.opacity = this.hitTimer > 0 ? '1' : '0';
        $('damage-vignette').style.opacity = String(this.damage);
        const prev = this.feed.length;
        for (const f of this.feed)
            f.time -= dt;
        this.feed = this.feed.filter(f => f.time > 0);
        if (prev !== this.feed.length)
            this.renderFeed();
        this.radarClock += dt;
        if (this.radarClock > .1) {
            drawMap($<HTMLCanvasElement>('radar'), match);
            this.radarClock = 0;
        }
        if (!$('scores-overlay').classList.contains('hidden'))
            this.scores(match);
    }
    scores(match: Match): void {
        $('scores-table').innerHTML = '<div class="score-row header"><span>队员</span><span>击杀</span><span>阵亡</span><span>爆头</span></div>' + match.actors.map(a => `<div class="score-row ${a.id === 0 ? 'own' : a.team === 1 ? 'enemy' : ''}"><span>${a.id === 0 ? '◆ ' : ''}${a.name}${a.alive ? '' : ' · 阵亡'}</span><span>${a.kills}</span><span>${a.deaths}</span><span>${a.headshots}</span></div>`).join('');
    }
}
