import './style.css';
import './battle.css';
import { Sound } from './audio.ts';
import { el, Hud, table } from './hud.ts';
import { controls } from './input.ts';
import { matchRules } from './loadout.ts';
import { Match, type Setup } from './match.ts';
import { View } from './render/view.ts';

type Preferences = { volume: number; sensitivity: number; quality: 'detail' | 'low' };
const defaults: Preferences = { volume: .65, sensitivity: 1, quality: 'detail' };
const settingKey = 'cargo-strike-sol:settings';
function readPreferences(): Preferences {
  try {
    const value: Partial<Preferences> = JSON.parse(localStorage.getItem(settingKey) ?? '{}');
    return {
      volume: typeof value.volume === 'number' && value.volume >= 0 && value.volume <= 1 ? value.volume : defaults.volume,
      sensitivity: typeof value.sensitivity === 'number' && value.sensitivity >= .4 && value.sensitivity <= 2 ? value.sensitivity : defaults.sensitivity,
      quality: value.quality === 'low' ? 'low' : 'detail',
    };
  } catch { return { ...defaults }; }
}

const prefs = readPreferences();
const lobby = el('#lobby'), battle = el('#battle'), canvas = el<HTMLCanvasElement>('#viewport');
const form = el<HTMLFormElement>('#setup'), startButton = el<HTMLButtonElement>('#start');
const settings = el<HTMLDialogElement>('#settings'), pauseDialog = el<HTMLDialogElement>('#pause-dialog');
const result = el<HTMLDialogElement>('#result'), help = el<HTMLDialogElement>('#controls');
const vol = el<HTMLInputElement>('#volume'), sens = el<HTMLInputElement>('#sensitivity'), quality = el<HTMLSelectElement>('#quality');
const hud = new Hud(), sound = new Sound();
let view: View | undefined, match: Match | undefined;
let stage: 'lobby' | 'active' | 'paused' | 'result' = 'lobby';
let frame = 0, last = 0, bucket = 0, settingsOrigin: 'lobby' | 'paused' = 'lobby';
const step = 1 / 60;
const devices = controls(battle, () => stage === 'active', pause, show => hud.toggleBoard(show, match));

function fullQuality() { return prefs.quality === 'detail'; }
function bootError(message: string) {
  const error = el('#boot-error'); error.textContent = message; error.hidden = !message;
}
function setup(): Setup {
  const data = new FormData(form);
  return {
    mode: data.get('mode') === 'range' ? 'range' : 'team',
    primary: data.get('primary') === 'ak' ? 'ak' : data.get('primary') === 'awp' ? 'awp' : 'm4',
    level: data.get('level') === 'recruit' ? 'recruit' : data.get('level') === 'veteran' ? 'veteran' : 'standard',
    target: data.get('target') === '10' ? 10 : data.get('target') === '40' ? 40 : 20,
  };
}
function changeSetup() {
  const s = setup();
  for (const select of form.querySelectorAll<HTMLSelectElement>('.team-select select')) select.disabled = s.mode === 'range';
  el('#mode-note').textContent = s.mode === 'range'
    ? '四名静止靶手循环复活。按 Esc 可重开并补充弹药。'
    : `先达成 ${s.target} 击杀或 ${matchRules[s.target] / 60} 分钟结束时领先的队伍获胜。`;
  startButton.textContent = s.mode === 'range' ? '开始练枪' : '进入战场';
}
form.addEventListener('change', changeSetup);
changeSetup();

function engage(next: Setup) {
  bootError('');
  startButton.disabled = true;
  try { view ??= new View(canvas, fullQuality()); }
  catch (error) {
    bootError('无法启动 WebGL 2。请在支持硬件加速的浏览器中重试。');
    console.error(error); startButton.disabled = false; return;
  }
  startButton.disabled = false;
  pauseDialog.close(); result.close();
  match = new Match(next);
  last = 0; bucket = 0;
  sound.setLobby(false);
  sound.start();
  devices.reset(true);
  view.reset(); hud.reset();
  lobby.hidden = true; battle.hidden = false; stage = 'active';
  hud.update(match);
  devices.lock();
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(tick);
}

function tick(now: number) {
  if (stage !== 'active' || !match || !view) return;
  const dt = last ? Math.min(.25, (now - last) / 1000) : step;
  last = now; bucket += dt;
  if (bucket >= step) {
    const input = devices.poll(prefs.sensitivity);
    while (bucket >= step && !match.ended) {
      match.update(input, step);
      input.yaw = input.pitch = 0; input.pressed = input.reload = input.jump = input.grenade = false; input.slot = 0;
      bucket -= step;
    }
  }
  for (const e of match.events.splice(0)) {
    view.event(e); hud.event(e, match); sound.play(e, match.listener, match.player.yaw);
  }
  hud.update(match);
  view.render(match, Math.min(dt, .07));
  if (match.ended) { finish(match); return; }
  frame = requestAnimationFrame(tick);
}

function pause() {
  if (stage !== 'active') return;
  stage = 'paused';
  cancelAnimationFrame(frame);
  devices.reset(); devices.unlock();
  pauseDialog.showModal();
}
function resume() {
  if (stage !== 'paused' || !match) return;
  pauseDialog.close(); stage = 'active'; last = 0; bucket = 0;
  devices.reset(); sound.start(); devices.lock();
  frame = requestAnimationFrame(tick);
}
function home() {
  stage = 'lobby';
  cancelAnimationFrame(frame);
  devices.reset(); devices.unlock();
  pauseDialog.close(); result.close();
  battle.hidden = true; lobby.hidden = false;
  sound.setLobby(true);
  match = undefined;
  startButton.focus();
}
function finish(ended: Match) {
  stage = 'result'; devices.reset(); devices.unlock();
  const [a, b] = ended.score;
  const title = a === b ? '平局' : a > b ? '蓝队胜利' : '红队胜利';
  el('#result-title').textContent = title;
  el('#result-score').textContent = `${a}  –  ${b}`;
  const { shots, hits } = ended.stats;
  el('#result-stats').textContent = `个人 ${ended.player.kills} 击杀 · ${ended.player.deaths} 阵亡 · 命中率 ${shots ? Math.round(100 * hits / shots) + '%' : '—'}`;
  table(result.querySelector('.table-wrap')!, ended);
  result.showModal();
}

function openSettings(origin: typeof settingsOrigin) {
  settingsOrigin = origin;
  if (origin === 'paused') pauseDialog.close();
  vol.value = String(prefs.volume); sens.value = String(prefs.sensitivity); quality.value = prefs.quality;
  settingLabels();
  settings.showModal();
}
function settingLabels() {
  el('#volume-text').textContent = Math.round(prefs.volume * 100) + '%';
  el('#sensitivity-text').textContent = prefs.sensitivity.toFixed(1) + '×';
}
function applySettings() {
  prefs.volume = Number(vol.value); prefs.sensitivity = Number(sens.value);
  const next = quality.value === 'low' ? 'low' : 'detail';
  if (next !== prefs.quality) { prefs.quality = next; view?.quality(fullQuality()); }
  sound.volume(prefs.volume); settingLabels();
  try { localStorage.setItem(settingKey, JSON.stringify(prefs)); } catch { /* this tab retains the settings */ }
}
sound.volume(prefs.volume);

function unlockLobbyAudio() {
  if (stage === 'lobby') sound.start();
}
document.addEventListener('click', unlockLobbyAudio);
document.addEventListener('keydown', unlockLobbyAudio);
form.addEventListener('submit', e => { e.preventDefault(); engage(setup()); });
el('#pause').addEventListener('click', pause);
el('#resume').addEventListener('click', resume);
el('#restart').addEventListener('click', () => { if (match) engage(match.setup); });
el('#replay').addEventListener('click', () => { if (match) engage(match.setup); });
el('#return').addEventListener('click', home);
el('#result-return').addEventListener('click', home);
el('#lobby-settings').addEventListener('click', () => openSettings('lobby'));
el('#pause-settings').addEventListener('click', () => openSettings('paused'));
el('#settings-done').addEventListener('click', () => settings.close());
settings.addEventListener('input', applySettings);
settings.addEventListener('close', () => { if (settingsOrigin === 'paused' && stage === 'paused') pauseDialog.showModal(); });
el('#controls-help').addEventListener('click', () => help.showModal());
el('#controls-done').addEventListener('click', () => help.close());
pauseDialog.addEventListener('cancel', e => { e.preventDefault(); resume(); });
result.addEventListener('cancel', e => { e.preventDefault(); home(); });
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); home(); bootError('图形上下文已中断。浏览器恢复后可重新进入战场。'); });
