import { cars, tracks, type Track } from './track.ts';
import { clock, LAPS, type Race } from './race.ts';

const icons = {
  flag: '<path d="M5 22V4m0 1c6-4 9 4 15 0v11c-6 4-9-4-15 0"/><path d="M10 5v10m5-8v10M5 10c6-4 9 4 15 0"/>',
  volume: '<path d="M4 9h4l5-4v14l-5-4H4zm12-1a5 5 0 0 1 0 8m2-11a9 9 0 0 1 0 14"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4zm12 1 5 5m0-5-5 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M8 4l1-2h6l1 2 3 2 2 1v6l-2 1-1 3-1 3H7l-1-3-2-3-2-1V7l3-1z" transform="translate(.8 1) scale(.92)"/>',
  play: '<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3.4"/>',
  left: '<path d="m15 5-7 7 7 7" stroke-width="3"/>',
  right: '<path d="m9 5 7 7-7 7" stroke-width="3"/>',
  up: '<path d="m5 15 7-7 7 7" stroke-width="3"/>',
  down: '<path d="m5 9 7 7 7-7" stroke-width="3"/>',
  flash: '<path d="M13 2 4 14h7l-1 8 10-13h-8z" fill="currentColor" stroke="none"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><path d="m4 10 5.7 1.3m4.6 0L20 10m-8 4v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 1 1-10 0zm5 11v6m-4 1h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"/>',
} as const;
export const icon = (name: keyof typeof icons) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;

function line(track: Track, width: number, height: number, step = 5) {
  const project = track.outline(width, height);
  return track.samples.filter((_, i) => i % step === 0).map(p => project(p).map(x => x.toFixed(2)).join(' ')).join(' ');
}

function trackDiagram(track: Track) {
  const color = track.course.accent;
  const [x, y] = track.outline(128, 66)(track.samples[0]);
  return `<svg aria-hidden="true" viewBox="0 0 128 66" preserveAspectRatio="xMidYMid meet">
    <polygon points="${line(track, 128, 66)}" fill="none" stroke="${color}" stroke-opacity=".18" stroke-width="6"/>
    <polygon points="${line(track, 128, 66)}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round"/>
    <circle cx="${x}" cy="${y}" r="2.4" fill="#fff6df"/>
  </svg>`;
}

const carDiagram = (number: number) => `<svg aria-hidden="true" viewBox="0 0 94 41" fill="none">
 <path d="M5 28l7-7 16-3 12-${number === 1 ? 8 : 9}h20l14 9 12 3 3 8H5v-4Z" fill="currentColor" opacity=".88"/>
 <path d="M34 18l8-6h17l10 6H34Z" fill="#151918"/><path d="M7 22v-3h15v3" stroke="currentColor" opacity="${number === 2 ? .25 : 1}"/>
 <path d="M8 30h78" stroke="#0d0f0e" stroke-width="2"/>
 <circle cx="21" cy="30" r="7" fill="#181b1b" stroke="currentColor" stroke-width="1.2"/>
 <circle cx="72" cy="30" r="7" fill="#181b1b" stroke="currentColor" stroke-width="1.2"/>
 <path d="M80 24h7m-73 1H7" stroke="#f8f0dd" stroke-width="1.1"/>
 </svg>`;

export function layout(app: HTMLElement) {
  app.innerHTML = `
  <main id="lobby">
    <header class="mast">
      <div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>APEX RUSH<small>疾风竞速</small></span></div>
      <div class="mast-tools">
        <span class="edition">GPT-6.2 SOL</span>
        <button type="button" class="plain iconic" data-action="audio" aria-label="静音">${icon('volume')}</button>
        <button type="button" class="plain iconic" data-action="help" aria-label="玩法说明">${icon('info')}</button>
        <button type="button" class="plain iconic" data-action="settings" aria-label="设置">${icon('settings')}</button>
      </div>
    </header>
    <section class="hero" aria-labelledby="title">
      <div class="hero-copy">
        <div class="hero-kicker"><span></span>街机漂移竞速</div>
        <h1 id="title"><span>APEX</span><span>RUSH</span></h1>
        <p class="hero-local">疾 风 竞 速</p>
        <button type="button" class="cta" data-action="start"><span id="start-label">开始竞速</span>${icon('play')}</button>
        <p class="shortcut" id="hero-mode">2 圈竞速<span></span>5 名 AI 对手</p>
      </div>
      <div class="hero-caption"><i></i><b>潮汐港</b><span>TIDEWATER BAY</span></div>
    </section>
    <section class="setup" aria-label="比赛配置">
      <div class="setup-panel courses">
        <header><h2>赛道</h2><span>CIRCUIT</span></header>
        <div class="course-grid">
          ${tracks.map(({ course, length }, i) => `<button type="button" class="choice course" data-track="${i}" aria-pressed="${i === 0}" style="--accent:${course.accent}">
             <div class="track-preview ${course.id}">${trackDiagram(tracks[i])}</div>
             <div class="choice-copy"><strong>${course.name}</strong><span>${(length / 1000).toFixed(2)} KM</span></div>
          </button>`).join('')}
        </div>
        <p class="panel-caption" id="track-detail">${tracks[0].course.feature}</p>
      </div>
      <div class="setup-panel fleet">
        <header><h2>车辆</h2><span>GARAGE</span></header>
        <div class="car-grid">
          ${cars.map((car, i) => `<button type="button" class="choice car" data-car="${i}" aria-pressed="${i === 0}" style="--accent:${car.color}">
              <div class="car-preview">${carDiagram(i)}</div><div class="choice-copy"><strong>${car.name}</strong><span>${car.english}</span></div>
          </button>`).join('')}
        </div>
        <p class="panel-caption" id="car-detail">${cars[0].trait} · ${Math.round(cars[0].top * 3.6)} km/h</p>
      </div>
      <div class="setup-panel format">
        <header><h2>模式</h2><span>EVENT</span></header>
        <div class="segmented" aria-label="比赛模式">
          <button type="button" data-mode="race" aria-pressed="true">${icon('flag')}竞速赛</button><button type="button" data-mode="trial" aria-pressed="false">${icon('trophy')}计时挑战</button>
        </div>
        <div class="segmented difficulty" id="difficulty" aria-label="难度">
          <button type="button" data-difficulty="normal" aria-pressed="true">轻松</button><button type="button" data-difficulty="expert" aria-pressed="false">高手</button>
        </div>
        <p class="panel-caption" id="record">个人最佳 —</p>
      </div>
    </section>
    <footer class="footer">
      <span>原创 3D 竞速 · 支持离线游玩</span>
      <button type="button" class="link" data-action="help">键位与技巧 ${icon('info')}</button>
    </footer>
  </main>
  <main id="race-screen" hidden aria-label="赛道">
    <canvas id="course-canvas" aria-label="3D 赛道"></canvas>
    <div class="race-vignette"></div><div id="boost-overlay"></div>
    <div class="race-hud">
      <div class="race-top">
        <div class="race-data">
          <div id="course-name"></div>
          <div class="race-metrics"><div><span>圈数</span><b id="lap">1 / 2</b></div>
            <div><span>用时</span><b id="timer">00:00.000</b></div></div>
          <div id="standings" aria-label="实时排名"></div>
        </div>
        <div class="race-right">
          <div class="race-actions">
            <button type="button" class="iconic" data-action="camera" aria-label="切换镜头">${icon('camera')}</button>
            <button type="button" class="iconic" data-action="pause" aria-label="暂停">${icon('pause')}</button>
          </div>
          <svg id="map" aria-label="小地图" role="img" viewBox="0 0 150 106"><polygon></polygon><g></g></svg>
        </div>
      </div>
      <div id="race-feedback" aria-live="polite"></div>
      <div id="countdown" aria-live="polite"></div>
      <div class="speed-cluster">
        <div class="speed-value"><strong id="speed">000</strong><span>KM/H</span></div>
        <div class="boost-caption"><span>${icon('flash')} 氮气</span><b id="bottles">0 / 2</b></div>
        <div class="boost-meter" role="meter" aria-label="氮气" aria-valuemin="0" aria-valuemax="200" aria-valuenow="0"><i></i><i></i></div>
      </div>
      <div id="touch-controls" aria-label="触屏操作" hidden>
        <div class="touch-station">
          <button type="button" data-control="left" aria-label="左转">${icon('left')}</button>
          <button type="button" data-control="right" aria-label="右转">${icon('right')}</button>
        </div>
        <div class="touch-station">
          <button type="button" data-control="brake" aria-label="刹车">${icon('down')}</button>
          <button type="button" data-control="gas" aria-label="油门">${icon('up')}</button>
          <button type="button" data-control="drift" aria-label="漂移">${icon('wheel')}</button>
          <button type="button" data-control="boost" aria-label="氮气">${icon('flash')}</button>
        </div>
      </div>
      <div class="race-keys"><kbd>Shift</kbd> 漂移 <kbd>Space</kbd> 氮气 <kbd>R</kbd> 回正</div>
    </div>
  </main>
  <dialog id="overlay"></dialog>`;
}

export function mapLayout(map: SVGSVGElement, race: Race) {
  map.querySelector('polygon')!.setAttribute('points', line(race.track, 150, 106));
  const dots = race.drivers.map(driver => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', driver.id ? '2.6' : '4.3');
    dot.setAttribute('fill', driver.id ? driver.paint : '#fff6d6');
    return dot;
  });
  map.querySelector('g')!.replaceChildren(...dots.slice(1), dots[0]);
  const project = race.track.outline(150, 106);
  return () => race.drivers.forEach((car, i) => {
    const [x, y] = project(race.track.sample(car.s, car.lane));
    dots[i].setAttribute('cx', x.toFixed(1));
    dots[i].setAttribute('cy', y.toFixed(1));
  });
}

export function results(race: Race, record: 'best' | 'temporary' | 'same' | 'none') {
  const player = race.player;
  const rank = race.standings.indexOf(player) + 1;
  const detail = record === 'best' ? '刷新个人最佳' : record === 'temporary' ? '刷新本次会话个人最佳' : '完赛成绩';
  return `<header class="modal-header"><div class="modal-label">${race.track.course.name} · ${race.mode === 'race' ? '竞速赛' : '计时挑战'}</div>
    <h2 id="dialog-title">比赛结束</h2></header>
    <div class="result-top"><div><span>${detail}</span><strong>${clock(player.finish ?? race.time)}</strong></div>
      ${race.mode === 'race' ? `<div><span>名次</span><strong>${rank}<small> / ${race.drivers.length}</small></strong></div>` : ''}</div>
    <div class="split-times">${player.splits.slice(0, LAPS).map((split, i) => `<span>第 ${i + 1} 圈 <b>${clock(split)}</b></span>`).join('')}</div>
    ${race.mode === 'race' ? `<ol class="result-list">${race.standings.map(driver =>
      `<li class="${driver.id ? '' : 'is-player'}"><span>${driver.name}</span><b>${driver.finish === null ? '未完赛' : clock(driver.finish)}</b></li>`).join('')}</ol>` : ''}
    <div class="modal-actions"><button type="button" class="secondary" data-action="garage">返回大厅</button>
      <button type="button" class="cta compact" data-action="restart">再跑一场 ${icon('play')}</button></div>`;
}
