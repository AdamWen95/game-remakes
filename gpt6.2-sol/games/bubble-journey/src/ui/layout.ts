import { pilotPortrait } from '../art/pilots.ts';
import { mapPreview } from '../art/tiles.ts';
import { CREW } from '../game/crew.ts';
import { MAPS } from '../game/maps.ts';
import { icon } from './icons.ts';

export const portraits = CREW.map(pilotPortrait);
const maps = MAPS.map(mapPreview);
export const face = (id: number) => `<img class="face" src="${portraits[id]}" alt="" draggable="false">`;

export const markup = `
<header class="topbar">
  <div class="shell nav">
    <button type="button" class="wordmark" id="brand" aria-label="泡泡奇旅大厅">
      <span class="logo">${icon('bubble')}</span><span>泡泡奇旅<small>BUBBLE JOURNEY</small></span>
    </button>
    <div class="nav-actions">
      <button type="button" id="help" class="quiet">${icon('help')}<span>怎么玩</span></button>
      <button type="button" id="audio" class="square" aria-label="静音" aria-pressed="false">${icon('sound')}</button>
    </div>
  </div>
</header>
<main class="shell">
  <section id="lobby">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-art"></div>
      <div class="hero-copy">
        <span class="kicker">${icon('gamepad')} 经典竞技 · 四人乱斗</span>
        <h1 id="hero-title">泡泡<span>奇旅</span></h1>
        <p class="english">BUBBLE JOURNEY</p>
        <p class="description">炸开砖块，收集强化，在四人混战中<br class="hero-break">成为最后一位站在场上的领航员。</p>
        <button type="button" id="start" class="cta">${icon('play')} 开始游戏</button>
      </div>
      <span class="hero-credit">${icon('spark')} 青柠花园</span>
    </section>
    <div class="lobby-grid">
      <section class="panel crew-panel" aria-labelledby="crew-title">
        <div class="panel-heading"><span class="panel-icon rosy">${icon('users')}</span><div><h2 id="crew-title">选择角色</h2><p>挑选你的领航员</p></div></div>
        <div id="crew" class="crew-grid" aria-label="选择角色">${CREW.map((pilot, id) => `
          <button class="pilot-choice" type="button" data-pilot="${id}" aria-pressed="false">
            <span class="pilot-art ${pilot.type}">${face(id)}<span class="selection">${icon('check')}</span></span>
            <strong>${pilot.name}</strong><small>${pilot.title}</small>
          </button>`).join('')}
        </div>
      </section>
      <section class="panel map-panel" aria-labelledby="maps-title">
        <div class="panel-heading"><span class="panel-icon mint">${icon('map')}</span><div><h2 id="maps-title">对战地图</h2><p>每局生成新的砖块布局</p></div></div>
        <div class="map-pick">
          <div class="map-art" id="map-art"></div>
          <label class="map-select"><span id="map-icon">${icon('shuffle')}</span><select id="map" aria-label="对战地图">
            <option value="random">随机地图</option>${MAPS.map(arena => `<option value="${arena.id}">${arena.name}</option>`).join('')}
          </select>${icon('chevron')}</label>
        </div>
      </section>
    </div>
    <footer class="lobby-footer">
      <div class="record">${icon('trophy')}<span>最高积分 <b id="best">0</b></span><i></i><span>累计胜场 <b id="wins">0</b></span></div>
      <div class="keyboard-hint"><kbd>W A S D</kbd><span>移动</span><kbd>Space</kbd><span>放置泡泡</span></div>
    </footer>
  </section>
  <section id="battle" hidden aria-label="对战">
    <section class="battle-top">
      <div class="battle-name"><span class="panel-icon mint">${icon('map')}</span><div><h1 id="arena-name"></h1><p>经典竞技 <span>·</span> 单机四人</p></div></div>
      <div class="battle-actions">
        <button type="button" id="battle-home" class="quiet">${icon('home')}<span>大厅</span></button>
        <button type="button" id="pause" class="square" aria-label="暂停">${icon('pause')}</button>
      </div>
    </section>
    <div class="battle-grid">
      <div class="battle-stage">
        <div class="battle-ribbon">
          <div>${icon('clock')} <time id="time">02:30</time></div>
          <div>${icon('users')} <span id="count">4 / 4</span></div>
          <div>${icon('trophy')} <span id="score">0</span></div>
        </div>
        <div class="arena-frame"><div id="arena-canvas"></div></div>
      </div>
      <aside class="battle-aside">
        <section class="panel standings"><h2>领航员</h2><ul id="players"></ul></section>
        <section class="panel power-panel"><h2>我的强化</h2><div class="powers">
          <div><span class="power-icon rosy">${icon('bubble')}</span><strong id="capacity">1/1</strong><small>泡泡</small></div>
          <div><span class="power-icon sunny">${icon('spark')}</span><strong id="range">2</strong><small>范围</small></div>
          <div><span class="power-icon mint">${icon('speed')}</span><strong id="speed">1</strong><small>速度</small></div>
        </div></section>
        <div class="panel controls-card">${icon('gamepad')} <div><b>键盘操作</b><p>WASD / 方向键移动</p><p>空格放置泡泡 · Esc 暂停</p></div></div>
      </aside>
    </div>
    <div id="touch" class="touch" aria-label="触屏控制">
      <div class="dpad">
        ${(['up', 'right', 'down', 'left'] as const).map((dir, index) => `<button type="button" class="d-${dir}" aria-label="${['上', '右', '下', '左'][index]}" data-dir="${index}">${icon(dir)}</button>`).join('')}
      </div>
      <button type="button" id="touch-bomb" class="touch-bomb" aria-label="放置泡泡">${icon('bubble')}<span>放泡泡</span></button>
    </div>
  </section>
</main>
<dialog id="popup" aria-labelledby="dialog-title"></dialog>`;

export const mapImage = (id: string) => maps[MAPS.findIndex(map => map.id === id)] ?? maps[0];
