import './style.css';
import './race.css';
import keyArt from './art/tidewater.jpg';
import { cars, tracks } from './track.ts';
import { clock, LAPS, Race, STEP, type Difficulty, type Mode } from './race.ts';
import { RaceView, type Quality } from './render/view.ts';
import { Input, Sound } from './devices.ts';
import { bestTime, loadOptions, recordTime, saveOptions } from './storage.ts';
import { icon, layout, mapLayout, results } from './ui.ts';

const app = document.querySelector<HTMLElement>('#app')!;
layout(app);
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const lobby = byId('lobby');
const stage = byId('race-screen');
const canvas = byId<HTMLCanvasElement>('course-canvas');
const modal = byId<HTMLDialogElement>('overlay');
const touchControls = byId('touch-controls');
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
touchControls.hidden = !touch;
stage.dataset.touch = String(touch);
app.style.setProperty('--key-art', `url("${keyArt}")`);

const options = loadOptions(touch);
const sound = new Sound();
sound.muted = options.muted;
let trackIndex = 0;
let carIndex = 0;
let mode: Mode = 'race';
let difficulty: Difficulty = 'normal';
let race: Race | undefined;
let view: RaceView | undefined;
let closeCamera = false;
let phase: 'lobby' | 'running' | 'paused' | 'finished' = 'lobby';
let updateMap = () => {};
let previousTime = 0;
let accumulated = 0;
let startClock = 0;
let displayedCountdown = '';
let hudWait = 0;
let feedbackTime = 0;
let animation = 0;
let returnFocus: HTMLElement | null = null;

const input = new Input(touchControls, () => phase === 'running' && !modal.open, handle);
const live = {
  speed: byId('speed'), lap: byId('lap'), timer: byId('timer'), bottles: byId('bottles'),
  boost: byId('boost-overlay'), map: document.querySelector<SVGSVGElement>('#map')!,
  standings: byId('standings'), countdown: byId('countdown'), feedback: byId('race-feedback'),
  meter: document.querySelector<HTMLElement>('.boost-meter')!,
  segments: Array.from(document.querySelectorAll<HTMLElement>('.boost-meter i')),
};

const feedback: Record<string, string> = {
  drift: '漂移集气', mini: '出弯小喷', nitro: '氮气加速', pad: '加速带', hit: '发生碰撞',
  lap: '最后一圈', ready: '氮气就绪', reset: '车辆已回正',
};

function updateLobby() {
  const press = (selector: string, value: string) => document.querySelectorAll<HTMLElement>(`[data-${selector}]`)
    .forEach(button => button.setAttribute('aria-pressed', String(button.dataset[selector] === value)));
  press('track', String(trackIndex));
  press('car', String(carIndex));
  press('mode', mode);
  press('difficulty', difficulty);
  byId('difficulty').hidden = mode === 'trial';
  const track = tracks[trackIndex].course;
  const car = cars[carIndex];
  byId('track-detail').textContent = track.feature;
  byId('car-detail').textContent = `${car.trait} · ${Math.round(car.top * 3.6)} km/h`;
  byId('start-label').textContent = mode === 'race' ? '开始竞速' : '开始挑战';
  byId('hero-mode').innerHTML = mode === 'race' ? '2 圈竞速<span></span>5 名 AI 对手' : '2 圈计时<span></span>挑战个人最佳';
  const best = bestTime(track, car, mode, difficulty);
  byId('record').textContent = `个人最佳 ${best === null ? '—' : clock(best)}`;
  refreshAudioButton();
}

function refreshAudioButton() {
  const button = lobby.querySelector<HTMLButtonElement>('[data-action="audio"]')!;
  button.innerHTML = icon(options.muted ? 'mute' : 'volume');
  button.setAttribute('aria-pressed', String(options.muted));
  const inDialog = document.querySelector<HTMLInputElement>('#muted');
  if (inDialog) inDialog.checked = options.muted;
}

function stopFrames() {
  if (animation) cancelAnimationFrame(animation);
  animation = 0;
  previousTime = 0;
  input.clear();
  sound.mix();
}

function start() {
  closeModal(false);
  stopFrames();
  view?.dispose();
  view = undefined;
  race = new Race(tracks[trackIndex], cars[carIndex], mode, difficulty);
  try {
    view = new RaceView(canvas, race);
  } catch (error) {
    console.error('无法启动 3D 赛道', error);
    toLobby(false);
    showModal(`<h2 id="dialog-title">无法启动 3D 赛道</h2>
      <p>请在支持 WebGL 2 的浏览器里开启硬件加速，刷新页面后重试。</p>
      <div class="modal-actions"><button type="button" class="secondary" data-action="dismiss">返回大厅</button></div>`);
    return;
  }
  phase = 'running';
  sound.setLobby(false);
  sound.unlock();
  sound.mix(race);
  stage.style.setProperty('--race-accent', race.track.course.accent);
  byId('course-name').textContent = race.track.course.name;
  updateMap = mapLayout(live.map, race);
  startClock = 3;
  displayedCountdown = '';
  accumulated = 0;
  feedbackTime = 0;
  hudWait = 0;
  live.feedback.textContent = '';
  live.feedback.classList.remove('show');
  live.boost.classList.remove('show');
  live.standings.hidden = mode === 'trial';
  lobby.hidden = true;
  stage.hidden = false;
  canvas.tabIndex = -1;
  canvas.focus({ preventScroll: true });
  updateHud(race);
  updateCountdown();
  animation = requestAnimationFrame(frame);
}

function updateCountdown() {
  const text = startClock > 0 ? String(Math.ceil(startClock)) : startClock > -.77 ? '出发！' : '';
  if (text === displayedCountdown) return;
  displayedCountdown = text;
  live.countdown.dataset.go = String(startClock <= 0);
  live.countdown.textContent = text;
  if (text) sound.cue(startClock > 0 ? 'count' : 'go');
}

function updateHud(match: Race) {
  const car = match.player;
  live.speed.textContent = String(Math.round(car.speed * 3.6)).padStart(3, '0');
  live.lap.textContent = `${Math.min(LAPS, car.lap + 1)} / ${LAPS}`;
  live.timer.textContent = clock(car.finish ?? match.time);
  const bottles = Math.floor(car.charge / 100);
  live.bottles.textContent = `${bottles} / 2`;
  live.meter.setAttribute('aria-valuenow', String(Math.floor(car.charge)));
  live.segments.forEach((segment, i) => {
    segment.style.setProperty('--fill', `${Math.max(0, Math.min(100, car.charge - i * 100))}%`);
  });
  live.boost.classList.toggle('show', car.boost > 0);
  updateMap();
  if (match.mode === 'race') {
    const order = match.standings;
    const place = order.indexOf(car) + 1;
    live.standings.innerHTML = `<div class="place"><b>${place}</b><span> / ${order.length}</span></div><ol>${
      order.map(driver => `<li class="${driver.id ? '' : 'is-player'}"><i style="--paint:${driver.paint}"></i>${driver.name}</li>`).join('')
    }</ol>`;
  }
}

function showFeedback(match: Race, event: string) {
  live.feedback.textContent = feedback[event];
  live.feedback.classList.add('show');
  feedbackTime = match.time + (event === 'drift' ? .7 : 1.2);
  if (event === 'mini' || event === 'nitro' || event === 'hit' || event === 'lap' || event === 'ready') sound.cue(event);
  if (event === 'pad') sound.cue('mini');
}

function frame(now: number) {
  if (!race || !view || phase !== 'running') return;
  const dt = previousTime ? Math.min(.085, (now - previousTime) / 1000) : 1 / 60;
  previousTime = now;
  startClock = Math.max(-1, startClock - dt);
  updateCountdown();
  let brake = false;
  if (startClock <= 0) {
    accumulated += dt;
    while (accumulated >= STEP && race.player.finish === null) {
      const controls = input.read(options.autoGas);
      brake = controls.brake;
      race.tick(controls, STEP);
      accumulated -= STEP;
      const current = ['lap', 'hit', 'nitro', 'pad', 'mini', 'ready', 'reset', 'drift'].find(name =>
        race!.events.has(name as Parameters<Race['events']['has']>[0]));
      if (current) showFeedback(race, current);
    }
    if (race.time > feedbackTime) live.feedback.classList.remove('show');
  }
  sound.mix(race);
  hudWait -= dt;
  if (hudWait <= 0 || race.player.finish !== null) {
    updateHud(race);
    hudWait = .085;
  }
  view.draw(dt, options.quality, closeCamera, brake);
  if (race.player.finish !== null) finish(race);
  else animation = requestAnimationFrame(frame);
}

function finish(match: Race) {
  phase = 'finished';
  stopFrames();
  sound.cue('finish');
  const record = recordTime(match.track.course, match.player.spec, match.mode, match.difficulty, match.player.finish!);
  showModal(results(match, record));
}

function settingsContent() {
  return `<div class="settings">
    <label><span>静音<small>关闭引擎、漂移和比赛提示音</small></span><input id="muted" type="checkbox" data-option="muted" ${options.muted ? 'checked' : ''}></label>
    <label><span>自动油门<small>方向键和刹车仍可控制车辆</small></span><input type="checkbox" data-option="autoGas" ${options.autoGas ? 'checked' : ''}></label>
    <label><span>画质</span><select data-option="quality"><option value="high" ${options.quality === 'high' ? 'selected' : ''}>精细</option><option value="low" ${options.quality === 'low' ? 'selected' : ''}>流畅</option></select></label>
  </div>`;
}

function showModal(html: string) {
  if (modal.open) modal.close();
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.innerHTML = html;
  modal.setAttribute('aria-labelledby', 'dialog-title');
  const heading = byId('dialog-title');
  heading.tabIndex = -1;
  heading.autofocus = true;
  modal.showModal();
  modal.scrollTop = 0;
}

function closeModal(restore = true) {
  if (!modal.open) return;
  modal.close();
  if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
}

function pause() {
  if (phase !== 'running') return;
  phase = 'paused';
  stopFrames();
  showModal(`<div class="modal-label">${race?.track.course.name}</div><h2 id="dialog-title">比赛暂停</h2>${settingsContent()}
    <div class="modal-actions"><button type="button" class="secondary" data-action="garage">返回大厅</button>
      <button type="button" class="secondary" data-action="restart">重新开始</button><button type="button" class="cta compact" data-action="resume">继续 ${icon('play')}</button></div>`);
}

function resume() {
  if (phase !== 'paused' || !view) return;
  closeModal(false);
  canvas.focus({ preventScroll: true });
  sound.unlock();
  phase = 'running';
  previousTime = 0;
  accumulated = 0;
  animation = requestAnimationFrame(frame);
}

function toLobby(focus = true) {
  closeModal(false);
  stopFrames();
  view?.dispose();
  race = view = undefined;
  phase = 'lobby';
  sound.setLobby(true);
  lobby.hidden = false;
  stage.hidden = true;
  updateLobby();
  if (focus) lobby.querySelector<HTMLButtonElement>('.cta')?.focus({ preventScroll: true });
}

function help() {
  showModal(`<h2 id="dialog-title">操作与漂移</h2>
    <dl class="key-table"><div><dt>加速 / 刹车</dt><dd>W / S 或 ↑ / ↓</dd></div><div><dt>转向</dt><dd>A / D 或 ← / →</dd></div>
    <div><dt>漂移集气</dt><dd>Shift + 转向</dd></div><div><dt>氮气</dt><dd>Space 或 Ctrl</dd></div>
    <div><dt>回正 / 镜头 / 暂停</dt><dd>R / C / Esc</dd></div><div><dt>静音</dt><dd>M</dd></div></dl>
    <p>以约 62 km/h 以上的车速入弯，配合方向按住漂移。连续漂移至少 0.45 秒后松开漂移键即可小喷。氮气最多存两瓶，经过赛道发光标记也会获得加速。</p>
    <p>手机支持多指操作，默认开启自动油门。</p>
    <div class="modal-actions"><button type="button" class="cta compact" data-action="dismiss">返回</button></div>`);
}

function handle(action: string) {
  switch (action) {
    case 'start': case 'restart': start(); break;
    case 'garage': toLobby(); break;
    case 'pause': if (phase === 'paused') resume(); else pause(); break;
    case 'resume': resume(); break;
    case 'camera': closeCamera = !closeCamera; break;
    case 'dismiss': closeModal(); break;
    case 'help': help(); break;
    case 'settings':
      showModal(`<h2 id="dialog-title">设置</h2>${settingsContent()}
        <div class="modal-actions"><button type="button" class="cta compact" data-action="dismiss">完成</button></div>`);
      break;
    case 'audio':
      options.muted = !options.muted;
      sound.muted = options.muted;
      if (!options.muted) sound.unlock();
      sound.mix(phase === 'running' ? race : undefined);
      saveOptions(options);
      refreshAudioButton();
      break;
  }
}

app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  const data = button.dataset;
  if (data.action) handle(data.action);
  else if (phase === 'lobby') {
    if (data.track !== undefined) trackIndex = Number(data.track);
    if (data.car !== undefined) carIndex = Number(data.car);
    if (data.mode) mode = data.mode as Mode;
    if (data.difficulty) difficulty = data.difficulty as Difficulty;
    updateLobby();
  }
});
modal.addEventListener('change', event => {
  const field = event.target as HTMLInputElement | HTMLSelectElement;
  if (field.dataset.option === 'autoGas' && field instanceof HTMLInputElement) options.autoGas = field.checked;
  if (field.dataset.option === 'muted' && field instanceof HTMLInputElement) {
    options.muted = sound.muted = field.checked;
    if (!options.muted) sound.unlock();
    sound.mix();
    refreshAudioButton();
  }
  if (field.dataset.option === 'quality') options.quality = field.value as Quality;
  saveOptions(options);
});
modal.addEventListener('cancel', event => {
  event.preventDefault();
  if (phase === 'paused') resume();
  else if (phase === 'finished') toLobby();
  else closeModal();
});
function unlockLobbyAudio() {
  if (phase === 'lobby') sound.unlock();
}
document.addEventListener('click', unlockLobbyAudio);
document.addEventListener('keydown', unlockLobbyAudio);
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  if (phase === 'lobby') return;
  toLobby(false);
  showModal(`<h2 id="dialog-title">3D 画面中断</h2><p>图形设备暂时不可用。返回大厅后可以将画质切换为流畅再开赛。</p>
    <div class="modal-actions"><button type="button" class="cta compact" data-action="dismiss">返回大厅</button></div>`);
});

updateLobby();
