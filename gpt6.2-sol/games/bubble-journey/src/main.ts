import Phaser from 'phaser';
import { ArcadeAudio } from './game/audio.ts';
import { CREW } from './game/crew.ts';
import { HEIGHT, WIDTH } from './game/maps.ts';
import { ArenaView } from './game/render.ts';
import { Match, ROUND_SECONDS } from './game/rules.ts';
import { icon } from './ui/icons.ts';
import { Controls } from './ui/input.ts';
import { face, mapImage, markup } from './ui/layout.ts';
import { load, save } from './ui/storage.ts';
import './ui/style.css';
import './ui/battle.css';

const app = document.querySelector('#app')!;
app.innerHTML = markup;
const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const updateText = (element: HTMLElement, value: string | number) => {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
};
const lobby = get('lobby');
const battle = get('battle');
const dialog = get<HTMLDialogElement>('popup');
const mapSelect = get<HTMLSelectElement>('map');
const sound = get<HTMLButtonElement>('audio');
const crew = [...get('crew').querySelectorAll<HTMLButtonElement>('button')];
const settings = load();
const audio = new ArcadeAudio();
const stats = {
  time: get('time'), count: get('count'), score: get('score'), capacity: get('capacity'), range: get('range'), speed: get('speed'),
};

let match: Match | undefined;
let view: ArenaView | undefined;
let game: Phaser.Game | undefined;
let screen: 'lobby' | 'battle' = 'lobby';
let popup: 'help' | 'pause' | 'result' | null = null;
let resultDelayVisible = false;
let roster: HTMLElement[] = [];
let restoreFocus: HTMLElement | null = null;

const input = new Controls(pause, get('touch'), get('touch-bomb'));

function refreshLobby() {
  for (const [id, button] of crew.entries()) button.setAttribute('aria-pressed', String(id === settings.pilot));
  mapSelect.value = settings.map;
  const art = get('map-art');
  art.style.backgroundImage = `url("${mapImage(settings.map)}")`;
  art.classList.toggle('random', settings.map === 'random');
  get('map-icon').innerHTML = icon(settings.map === 'random' ? 'shuffle' : 'map');
  updateText(get('best'), settings.best);
  updateText(get('wins'), settings.wins);
  audio.mute(settings.muted);
  sound.innerHTML = icon(settings.muted ? 'muted' : 'sound');
  sound.setAttribute('aria-pressed', String(settings.muted));
  sound.setAttribute('aria-label', settings.muted ? '开启声音' : '静音');
}

function setScreen(next: 'lobby' | 'battle') {
  screen = next;
  lobby.hidden = next !== 'lobby';
  battle.hidden = next !== 'battle';
  window.scrollTo(0, 0);
}

function newRound(sameSeed?: number) {
  closePopup(false);
  setScreen('battle');
  const seed = sameSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  match = new Match(seed, settings.map, settings.pilot);
  resultDelayVisible = false;
  get<HTMLButtonElement>('pause').disabled = false;
  updateText(get('arena-name'), match.arena.name);
  battle.dataset.theme = match.arena.id;
  const players = get('players');
  players.innerHTML = match.actors.map(actor => {
    const pilot = CREW[actor.pilot];
    return `<li style="--pilot-tile:${pilot.tile}">
      <span class="roster-face">${face(actor.pilot)}</span>
      <span class="roster-name"><b>${pilot.name}</b><small>${actor.id === 0 ? '你' : 'AI 对手'}</small></span>
      <span class="roster-score">0</span>
    </li>`;
  }).join('');
  roster = [...players.children] as HTMLElement[];
  paintHud(match);
  if (!view) {
    view = new ArenaView({
      input: () => input.poll(match?.player.to === -1),
      events: events => {
        for (const event of new Set(events.filter(event => event.type !== 'plant' || event.actor === 0).map(event => event.type))) audio.play(event);
      },
      frame: paintHud,
      end: finish,
    });
    game = new Phaser.Game({
      type: Phaser.CANVAS, parent: 'arena-canvas', width: WIDTH, height: HEIGHT,
      backgroundColor: '#6ab184', scene: [view], banner: false,
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      render: { antialias: true, roundPixels: false },
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    });
  }
  view.start(match);
  game?.scale.refresh();
  input.clear();
  input.active = true;
  audio.loop(true);
  void audio.unlock();
  (document.activeElement as HTMLElement | null)?.blur();
}

function paintHud(round: Match) {
  const seconds = Math.max(0, Math.ceil(ROUND_SECONDS - round.time));
  updateText(stats.time, `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
  stats.time.parentElement?.classList.toggle('urgent', seconds <= 15);
  updateText(stats.count, `${round.actors.filter(actor => actor.alive).length} / 4`);
  updateText(stats.score, round.player.score);
  updateText(stats.capacity, `${round.available(round.player)}/${round.player.capacity}`);
  updateText(stats.range, round.player.range);
  updateText(stats.speed, 1 + Math.round((round.player.speed - 5.65) / 0.62));
  for (const [id, element] of roster.entries()) {
    const actor = round.actors[id];
    element.classList.toggle('eliminated', !actor.alive);
    updateText(element.querySelector('.roster-score')!, actor.alive ? actor.score : '出局');
  }
  if (round.outcome && !resultDelayVisible) {
    resultDelayVisible = true;
    input.active = false;
    input.clear();
    get<HTMLButtonElement>('pause').disabled = true;
  }
}

function pause() {
  if (screen !== 'battle' || popup || !match || match.outcome) return;
  view?.paused(true);
  input.active = false;
  input.clear();
  audio.loop(false);
  openPopup('pause', icon('pause'), '游戏暂停', '准备好后继续比赛。', [
    ['resume', '继续游戏', 'cta', 'play'],
    ['restart', '重开本局', 'secondary', 'reset'],
    ['home', '返回大厅', 'secondary', 'home'],
  ]);
}

function finish(round: Match) {
  audio.loop(false);
  audio.play(round.outcome === 'win' ? 'win' : 'loss');
  settings.best = Math.max(settings.best, round.player.score);
  if (round.outcome === 'win') settings.wins++;
  save(settings);
  showResult(round);
}

function showResult(round: Match) {
  const title = { win: '赢下这一局！', loss: '本局结束', draw: '势均力敌' }[round.outcome!];
  const reason = round.outcome === 'win' ? '你拿下了本场比赛。' : round.outcome === 'draw' ? '本场比赛以平局结束。' : round.player.alive ? '时间到，对手的积分更高。' : '你的领航员已经出局。';
  openPopup('result', face(round.player.pilot), title, reason, [
    ['again', '再来一局', 'cta', 'play'], ['home', '返回大厅', 'secondary', 'home'],
  ], `<div class="result-stats"><div><b>${round.player.score}</b><span>本局积分</span></div><div><b>${round.player.kills}</b><span>淘汰对手</span></div><div><b>${settings.best}</b><span>个人最高</span></div></div>`);
}

function help() {
  if (popup || (screen === 'battle' && match?.outcome)) return;
  if (screen === 'battle') {
    view?.paused(true);
    input.clear();
    input.active = false;
    audio.loop(false);
  }
  openPopup('help', icon('gamepad'), '怎么玩', '经典竞技 · 一位玩家与三位 AI 同场对战', [
    ['resume', '了解了', 'cta', 'check'],
  ], `<ul class="help-list">
    <li><b>移动与放泡泡</b><span>WASD 或方向键移动，空格放置泡泡，Esc 暂停。手机使用方向键和放泡泡按钮。</span></li>
    <li><b>爆炸与强化</b><span>泡泡约 2.5 秒后十字爆开，可引爆沿途泡泡。砖块挡住火焰，炸开后可能掉落数量、范围或速度强化。</span></li>
    <li><b>胜负与积分</b><span>留到最后即获胜，时间到由存活者按积分排名，同分为平局。砖块 +20、强化 +35、淘汰 +250、胜利 +500。</span></li>
  </ul>`);
}

type Action = [string, string, string, Parameters<typeof icon>[0]];
function openPopup(type: NonNullable<typeof popup>, emblem: string, title: string, copy: string, actions: Action[], details = '') {
  restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  popup = type;
  dialog.dataset.kind = type;
  dialog.innerHTML = `<div class="dialog-inner">
    <div class="dialog-mark">${emblem}</div><h2 id="dialog-title">${title}</h2><p>${copy}</p>
    ${details}<div class="dialog-actions">${actions.map(([action, label, style, graphic]) => `<button type="button" data-action="${action}" class="${style}">${icon(graphic)} ${label}</button>`).join('')}</div></div>`;
  dialog.showModal();
}

function closePopup(restore = true) {
  if (dialog.open) dialog.close();
  popup = null;
  if (restore) restoreFocus?.focus();
  restoreFocus = null;
}

function resume() {
  closePopup(screen === 'lobby');
  if (screen === 'battle' && !match?.outcome) {
    input.active = true;
    view?.paused(false);
    audio.loop(true);
    void audio.unlock();
    battle.focus({ preventScroll: true });
  }
}

function home() {
  closePopup(false);
  input.active = false;
  input.clear();
  view?.paused(true);
  audio.loop(false);
  setScreen('lobby');
  refreshLobby();
  get('start').focus({ preventScroll: true });
}

battle.tabIndex = -1;
dialog.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null;
  if (!target) return;
  if (target.dataset.action === 'resume') resume();
  if (target.dataset.action === 'home') home();
  if (target.dataset.action === 'restart' && match) newRound(match.seed);
  if (target.dataset.action === 'again') newRound();
});
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (popup !== 'result') resume();
  else home();
});
get('start').addEventListener('click', () => newRound());
get('pause').addEventListener('click', pause);
get('help').addEventListener('click', help);
get('brand').addEventListener('click', () => { if (screen === 'battle') home(); });
get('battle-home').addEventListener('click', home);
for (const [id, button] of crew.entries()) button.addEventListener('click', () => {
  settings.pilot = id;
  save(settings);
  refreshLobby();
  void audio.unlock().then(() => audio.play('click'));
});
mapSelect.addEventListener('change', () => {
  settings.map = mapSelect.value as typeof settings.map;
  save(settings);
  refreshLobby();
  void audio.unlock().then(() => audio.play('click'));
});
sound.addEventListener('click', () => {
  settings.muted = !settings.muted;
  save(settings);
  refreshLobby();
  if (!settings.muted) void audio.unlock().then(() => audio.play('click'));
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'battle') pause();
});
refreshLobby();
