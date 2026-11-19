import './ui/style.css';
import { layout, $ } from './ui/layout';
import { HUD, drawMap } from './ui/hud';
import { Dialogs, loadPreferences, savePreferences } from './ui/dialogs';
import { Match } from './game/match';
import { clamp } from './game/math';
import { eye, type Settings } from './game/types';
import { WEAPONS, type WeaponId } from './game/weapons';
import { GameRenderer } from './render/renderer';
import { Controls } from './input';
import { AudioEngine } from './audio';
layout();
const match = new Match(), audio = new AudioEngine(), hud = new HUD();
const preferences = loadPreferences();
let renderer: GameRenderer, controls: Controls, dialogs: Dialogs;
let primary: WeaponId = 'm4', mode: Settings['mode'] = 'team';
let last = performance.now(), accumulator = 0, fps = 60, fpsFrames = 0, fpsTime = 0, footstep = 0;
let stopped = false;
function phase(): void {
    document.body.dataset.phase = match.phase;
    $('lobby').classList.toggle('hidden', match.phase !== 'lobby');
    $('hud').classList.toggle('hidden', match.phase === 'lobby');
    $('hud').classList.toggle('practice', match.settings.mode === 'practice');
}
function releasePointer(): void { if (document.pointerLockElement)
    document.exitPointerLock(); }
function start(): void {
    const target = Number($<HTMLSelectElement>('target').value);
    match.start({ primary, mode, difficulty: $<HTMLSelectElement>('difficulty').value as Settings['difficulty'], target, duration: target === 40 ? 300 : target === 20 ? 180 : 120 });
    hud.clear();
    controls.reset();
    accumulator = 0;
    phase();
    void controls.capture();
    void audio.start().catch(() => hud.notify('声音暂未启用', '可以继续游玩，或在设置中检查音量'));
    hud.notify(mode === 'practice' ? '射击训练' : '行动开始', mode === 'practice' ? '瞄准前方靶手，按 R 换弹' : '蓝方行动组 · 抢占甲板');
}
function pause(): void {
    if (match.phase !== 'playing')
        return;
    match.phase = 'paused';
    controls.reset();
    releasePointer();
    phase();
    dialogs.pause();
    $('pause-settings').onclick = () => dialogs.settings(preferences, applyPreferences, () => pauseDialog());
}
function pauseDialog(): void { dialogs.pause(); $('pause-settings').onclick = () => dialogs.settings(preferences, applyPreferences, pauseDialog); }
function resume(): void { if (match.phase === 'paused') {
    match.phase = 'playing';
    controls.reset();
    accumulator = 0;
    phase();
    void controls.capture();
} }
function lobby(): void { match.phase = 'lobby'; controls.reset(); releasePointer(); phase(); }
function applyPreferences(): void { controls.sensitivity = preferences.sensitivity; audio.setVolume(preferences.volume); renderer.setQuality(preferences.quality); savePreferences(preferences); }
function fail(message: string): void { $('loading').classList.add('hidden'); $('error-message').textContent = message; $('error').classList.remove('hidden'); stopped = true; }
async function boot(): Promise<void> {
    // Yield so loading feedback is painted before geometry and textures are constructed.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    try {
        renderer = new GameRenderer($<HTMLCanvasElement>('world'));
        controls = new Controls(renderer.canvas, {
            active: () => match.phase === 'playing',
            look: (dx, dy) => { if (!match.player.alive)
                return; const s = match.aim ? .0011 : .002; match.player.yaw -= dx * s; match.player.pitch = clamp(match.player.pitch - dy * s, -1.45, 1.45); },
            reload: () => match.reload(), switch: slot => { match.switchWeapon(slot); controls.state.aim = false; }, grenade: () => match.throwGrenade(), pause,
            scores: show => { $('scores-overlay').classList.toggle('hidden', !show); if (show)
                hud.scores(match); }, unlocked: pause
        });
        dialogs = new Dialogs(resume, lobby, start);
        applyPreferences();
        $('start').onclick = start;
        $('pause').onclick = pause;
        $('settings-open').onclick = () => dialogs.settings(preferences, applyPreferences, () => { });
        $('help-open').onclick = () => dialogs.help();
        $('capture-mouse').onclick = () => void controls.capture();
        $('retry').onclick = () => location.reload();
        for (const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))
            b.onclick = () => {
                mode = b.dataset.mode as Settings['mode'];
                for (const el of document.querySelectorAll('[data-mode]')) {
                    el.classList.toggle('selected', el === b);
                    el.setAttribute('aria-pressed', String(el === b));
                }
                $<HTMLSelectElement>('target').disabled = mode === 'practice';
                $<HTMLSelectElement>('difficulty').disabled = mode === 'practice';
            };
        for (const b of document.querySelectorAll<HTMLButtonElement>('[data-weapon]'))
            b.onclick = () => {
                primary = b.dataset.weapon as WeaponId;
                $('weapon-description').textContent = WEAPONS[primary].label;
                for (const el of document.querySelectorAll('[data-weapon]')) {
                    el.classList.toggle('selected', el === b);
                    el.setAttribute('aria-pressed', String(el === b));
                }
            };
        renderer.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); pause(); fail('显卡渲染已中断。请关闭占用显卡的页面后重新加载；也可在设置中使用流畅画质。'); });
        drawMap($<HTMLCanvasElement>('overview'));
        phase();
        $('loading').classList.add('hidden');
        last = performance.now();
        requestAnimationFrame(frame);
        if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
            Object.assign(window, { __cargoTest: { match, renderer, snapshot: () => ({ phase: match.phase, position: { ...match.player.pos }, hp: match.player.hp, ammo: match.player.magazines[match.player.weapon].ammo, scores: [...match.scores], elapsed: match.elapsed, actors: match.actors.map(a => ({ id: a.id, pos: { ...a.pos }, alive: a.alive, kills: a.kills })), stats: renderer.stats }) } });
        }
    }
    catch (error) {
        console.error(error);
        fail('无法创建 3D 场景。请使用支持 WebGL 2 的 Chrome、Edge 或 Safari，并开启浏览器硬件加速。');
    }
}
function frame(now: number): void {
    if (stopped)
        return;
    const dt = Math.min(.1, (now - last) / 1000);
    last = now;
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 1) {
        fps = fpsFrames / fpsTime;
        fpsTime = 0;
        fpsFrames = 0;
    }
    if (match.phase === 'playing') {
        accumulator = Math.min(accumulator + dt, 5 / 60);
        while (accumulator >= 1 / 60) {
            match.update(1 / 60, controls.read());
            accumulator -= 1 / 60;
        }
        footstep -= dt;
        if (match.player.alive && match.player.moving > .2 && match.player.grounded && footstep <= 0) {
            audio.step(match.player.sprint);
            footstep = match.player.sprint ? .28 : .4;
        }
        for (const event of match.events) {
            renderer.event(event);
            hud.event(event, match);
            if (event.type === 'shot')
                audio.shot(event.weapon, event.actor === 0 ? undefined : event.from, event.actor === 0 ? undefined : eye(match.player), match.player.yaw);
            if (event.type === 'reload' && event.actor === 0)
                audio.reload();
            if (event.type === 'hit' && event.actor === 0)
                audio.hit(event.head);
            if (event.type === 'kill' && event.actor === 0)
                audio.kill();
            if (event.type === 'blast')
                audio.blast();
        }
        const finished = match.events.some(e => e.type === 'finish');
        match.events = [];
        if (finished) {
            controls.reset();
            releasePointer();
            phase();
            dialogs.result(match);
        }
    }
    renderer.render(match, dt);
    if (match.phase !== 'lobby')
        hud.update(match, match.phase === 'playing' ? dt : 0, fps);
    requestAnimationFrame(frame);
}
void boot();
