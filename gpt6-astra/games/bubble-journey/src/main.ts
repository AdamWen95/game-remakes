import './style.css';
import './responsive.css';
import { ArenaScene, createGame } from './game/scene';
import { Controls } from './game/input';
import { Sound } from './audio';
import { Storage } from './storage';
import { CHARACTERS, characterSvg } from './art/characters';
import { THEMES } from './art/textures';
import { layout } from './ui/layout';
import { icon } from './ui/icons';
import * as dialogs from './ui/dialogs';
import type { Match } from './game/match';
import type { GameEvent, MatchOptions, Phase } from './game/types';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const storage = new Storage(), sound = new Sound();
sound.muted = storage.data.muted; sound.music = storage.data.music;
$('#app').innerHTML = layout();
let seed = Math.floor(Math.random() * 1000000);
let character = storage.data.character, theme = storage.data.theme;
let duration = 180, difficulty: MatchOptions['difficulty'] = 'normal';
let modalKind: 'guide' | 'records' | 'pause' | 'confirm' | 'result' | null = null;
let resumeAfterDialog = false, toastTimer: ReturnType<typeof setTimeout>;
const modal = $<HTMLDialogElement>('#modal');
const controls = new Controls(() => scene.place(), () => togglePause());
const scene = new ArenaScene(controls, sound, {
  ready() { $('#loading').classList.add('hidden'); $<HTMLButtonElement>('#start').disabled = false; refreshLobby(); },
  phase: onPhase, status: updateStatus, event: onEvent,
});
const game = createGame($('#game-canvas'), scene);

function options(): MatchOptions { return { seed, character, theme, duration, difficulty }; }
function toast(message: string) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.remove('hidden');
  toastTimer = setTimeout(() => $('#toast').classList.add('hidden'), 2800);
}
function persistSettings() { storage.data.character = character; storage.data.theme = theme; storage.save(); }
function refreshLobby() {
  $('#selected-portrait').innerHTML = characterSvg(character);
  $('#character-name').textContent = CHARACTERS[character].name;
  $('#character-tag').textContent = CHARACTERS[character].tag;
  document.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.character) === character)));
  document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.theme) === theme)));
  $('#seed-label').textContent = `#${String(seed).padStart(6, '0')}`;
  $('#arena-title').textContent = THEMES[theme].name;
  $('#arena-stage').style.setProperty('--stage-bg', THEMES[theme].bg);
  if (scene.ready) scene.loadArena(options(), true);
}
function start(newLayout = false) {
  closeModal(false);
  if (newLayout) seed = Math.floor(Math.random() * 1000000);
  $('#event-message').textContent = '保持移动，记得给自己留条退路。';
  $('#spectating').classList.add('hidden');
  scene.loadArena(options());
  $('#players').innerHTML = scene.match.actors.map(a => `<div class="player-row ${a.id === 0 ? 'self' : ''}" data-player="${a.id}"><span class="mini-portrait">${characterSvg(a.character)}</span><p><b>${a.name}${a.id === 0 ? ' · ' + CHARACTERS[a.character].name : ''}</b><small>${a.id === 0 ? '今日冒险家' : ['爱探索的机灵鬼', '稳稳当当的策略家', '不服输的小勇士'][a.id - 1]}</small></p><span class="player-state">准备中</span></div>`).join('');
  if (window.innerWidth < 760) $('.arena-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function onPhase(phase: Phase) {
  document.body.dataset.phase = phase;
  const lobby = phase === 'lobby';
  $('#lobby-panel').classList.toggle('hidden', !lobby);
  $('#match-panel').classList.toggle('hidden', lobby);
  $('#preview-label').classList.toggle('hidden', !lobby);
  $('#pause').classList.toggle('hidden', lobby || phase === 'ended');
  $('#touch-controls').classList.toggle('hidden', lobby || phase === 'ended');
  $('#countdown').classList.toggle('hidden', phase !== 'countdown');
  $('#arena-subtitle').textContent = lobby ? '经典竞技 · 1 位玩家 + 3 位 AI' : phase === 'ended' ? '本局已结束 · 快乐继续' : phase === 'paused' ? '对局已暂停' : '经典竞技 · 留到最后，成为赢家';
}
function updateStatus(match: Match, countdown: number) {
  const seconds = Math.ceil(match.remaining / 1000);
  $('#round-timer b').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('#round-timer').classList.toggle('urgent', seconds <= 30);
  if (scene.phase === 'countdown' && $('#countdown b')?.textContent !== String(Math.max(1, countdown))) {
    $('#countdown').innerHTML = `<span>准备好了吗？</span><b>${Math.max(1, countdown)}</b><small>找到退路，再放泡泡</small>`;
  }
  const player = match.actors[0];
  $('#stat-bombs').textContent = `${player.capacity - match.bombs.filter(b => b.owner === 0).length}/${player.capacity}`;
  $('#stat-range').textContent = String(player.range); $('#stat-speed').textContent = String(player.speed + 1);
  $('#score').innerHTML = `${player.score}<span> pts</span>`;
  $('#alive-count').textContent = `${match.actors.filter(a => a.alive).length} 人存活`;
  match.actors.forEach(a => {
    const row = document.querySelector<HTMLElement>(`[data-player="${a.id}"]`);
    if (row) { row.classList.toggle('eliminated', !a.alive); row.querySelector('.player-state')!.textContent = !a.alive ? '已淘汰' : scene.phase === 'countdown' ? '准备中' : '存活'; }
  });
}
function onEvent(event: GameEvent, match: Match) {
  if (event.type === 'pickup' && event.actor === 0) {
    $('#event-message').textContent = `捡到${{ bomb: '泡泡口袋，数量增加', range: '能量星，爆炸范围扩大', speed: '轻盈鞋，移动更快' }[event.kind]}！`;
  }
  if (event.type === 'death') {
    $('#event-message').textContent = `${match.actors[event.actor].name}被泡泡击中了！${event.actor === 0 ? '别灰心，下局再来。' : '继续加油，胜利更近了。'}`;
    if (event.actor === 0 && !match.ended) $('#spectating').classList.remove('hidden');
  }
  if (event.type === 'end') {
    storage.record(match); $('#spectating').classList.add('hidden');
    updateStatus(match, 0); showModal('result', dialogs.result(match));
  }
}
function showModal(kind: NonNullable<typeof modalKind>, content: string) {
  modalKind = kind; modal.innerHTML = content; modal.dataset.kind = kind;
  if (!modal.open) modal.showModal();
  requestAnimationFrame(() => modal.querySelector<HTMLElement>('button')?.focus());
}
function closeModal(resume = true) {
  modal.close(); modalKind = null;
  if (resume && resumeAfterDialog) scene.resume();
  resumeAfterDialog = false;
}
function auxiliary(kind: 'guide' | 'records') {
  if (modalKind === 'result') return;
  resumeAfterDialog = scene.phase === 'playing' || scene.phase === 'countdown';
  if (resumeAfterDialog) scene.pause();
  showModal(kind, kind === 'guide' ? dialogs.guide(sound.music) : dialogs.records(storage.data, storage.available));
}
function togglePause() {
  if (modal.open) {
    if (modalKind === 'pause') { closeModal(false); scene.resume(); }
    else if (modalKind !== 'result') closeModal();
    return;
  }
  if (scene.phase === 'playing' || scene.phase === 'countdown') { scene.pause(); showModal('pause', dialogs.pause()); }
}
function confirm(action: 'restart' | 'lobby') {
  if (scene.phase === 'lobby' || scene.phase === 'ended') { action === 'restart' ? start(true) : goLobby(); return; }
  resumeAfterDialog = scene.phase === 'playing' || scene.phase === 'countdown';
  scene.pause(); showModal('confirm', dialogs.confirmDialog(action));
}
function goLobby() { closeModal(false); refreshLobby(); }
function soundButton() {
  $('#sound-toggle').innerHTML = icon(sound.muted ? 'mute' : 'volume');
  $('#sound-toggle').setAttribute('aria-label', sound.muted ? '开启声音' : '关闭声音');
  $('#sound-toggle').setAttribute('aria-pressed', String(!sound.muted));
}

document.addEventListener('keydown', () => { void sound.unlock(); }, { passive: true });
document.addEventListener('click', e => {
  const button = (e.target as HTMLElement).closest('button');
  void sound.unlock().then(() => { if (button) sound.play('click'); });
});
document.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b => b.addEventListener('click', () => { character = Number(b.dataset.character); persistSettings(); refreshLobby(); }));
document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(b => b.addEventListener('click', () => { theme = Number(b.dataset.theme); persistSettings(); refreshLobby(); }));
$('#shuffle').addEventListener('click', () => { seed = Math.floor(Math.random() * 1000000); refreshLobby(); toast('新的花园布局，新的小惊喜。'); });
$('#duration').addEventListener('change', e => { duration = Number((e.target as HTMLSelectElement).value); refreshLobby(); });
$('#difficulty').addEventListener('change', e => { difficulty = (e.target as HTMLSelectElement).value as MatchOptions['difficulty']; });
$('#start').addEventListener('click', () => start());
$('#pause').addEventListener('click', togglePause);
$('#nav-guide').addEventListener('click', () => auxiliary('guide'));
$('#help').addEventListener('click', () => auxiliary('guide'));
$('#nav-records').addEventListener('click', () => auxiliary('records'));
$('#nav-lobby').addEventListener('click', () => { if (scene.phase !== 'lobby') confirm('lobby'); });
$('.brand').addEventListener('click', e => { e.preventDefault(); if (scene.phase !== 'lobby') confirm('lobby'); });
$('#match-restart').addEventListener('click', () => confirm('restart'));
$('#spectate-restart').addEventListener('click', () => confirm('restart'));
$('#match-leave').addEventListener('click', () => confirm('lobby'));
$('#sound-toggle').addEventListener('click', () => { sound.setMuted(!sound.muted); storage.data.muted = sound.muted; storage.save(); soundButton(); });
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('.arena-card').requestFullscreen) await $('.arena-card').requestFullscreen();
    else toast('当前浏览器不支持全屏，可以横屏获得更大视野。');
  } catch { toast('暂时无法进入全屏，当前视野仍可正常游玩。'); }
});
modal.addEventListener('click', e => {
  const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'close') closeModal();
  if (action === 'resume') { closeModal(false); scene.resume(); }
  if (action === 'restart') start(true);
  if (action === 'lobby') goLobby();
});
modal.addEventListener('change', e => {
  if ((e.target as HTMLElement).id === 'music-setting') { sound.music = (e.target as HTMLInputElement).checked; storage.data.music = sound.music; storage.save(); }
});
modal.addEventListener('cancel', e => {
  e.preventDefault();
  if (modalKind === 'result') return;
  if (modalKind === 'pause') { closeModal(false); scene.resume(); } else closeModal();
});
controls.bindTouch($('#touch-controls'), () => scene.place());
function pauseWhenAway() {
  controls.clear();
  if (scene.phase === 'playing' || scene.phase === 'countdown') { scene.pause(); if (!modal.open) showModal('pause', dialogs.pause()); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseWhenAway(); });
window.addEventListener('blur', pauseWhenAway);
window.addEventListener('pagehide', () => { sound.stopMusic(); });
window.addEventListener('pageshow', () => { if (scene.phase === 'lobby') sound.startMusic('lobby'); });
window.addEventListener('error', () => {
  if (!scene.ready) {
    $('#loading').innerHTML = '<b>花园加载遇到问题</b><p>请刷新页面重试，或使用新版浏览器。</p><button id="retry-load">重新加载</button>';
    $('#retry-load').addEventListener('click', () => location.reload());
  }
});
soundButton();

// Read-only diagnostics in development only; production never exposes mutable match state.
if (import.meta.env.DEV) {
  Object.defineProperty(window, '__bubbleSnapshot', { value: () => structuredClone({
    phase: scene.phase, time: scene.match?.time, options: scene.match?.options,
    actors: scene.match?.actors, bombs: scene.match?.bombs, flames: scene.match?.flames,
    cells: scene.match?.cells, drops: scene.match?.drops, renderer: game.renderer?.type,
  }) });
}
if (import.meta.hot) import.meta.hot.dispose(() => { controls.dispose(); sound.dispose(); game.destroy(true); });
