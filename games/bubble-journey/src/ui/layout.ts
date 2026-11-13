import { characterSvg, CHARACTERS } from '../art/characters';
import { THEMES } from '../art/textures';
import { icon } from './icons';

export function mapThumb(theme: number): string {
  const t = THEMES[theme];
  let blocks = '';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
    if ((x + y * 3) % 4 === 0) blocks += `<rect x="${x * 18 + 6}" y="${y * 17 + 7}" width="16" height="15" rx="4" fill="${t.wall}"/><rect x="${x * 18 + 6}" y="${y * 17 + 5}" width="16" height="13" rx="4" fill="${t.light}"/>`;
    else if ((x * 3 + y) % 5 === 0) blocks += `<rect x="${x * 18 + 7}" y="${y * 17 + 7}" width="14" height="13" rx="2" fill="${t.crate}" stroke="${t.edge}" stroke-width="1"/>`;
  }
  return `<svg viewBox="0 0 156 76" aria-hidden="true"><rect width="156" height="76" fill="${t.floor[0]}"/>${blocks}<circle cx="80" cy="39" r="8" fill="#ffffffbb"/><circle cx="78" cy="37" r="3" fill="#fff"/></svg>`;
}

export function layout() {
  return `<div class="site-shell">
    <header class="header">
      <a class="brand" href="./" aria-label="泡泡奇旅首页"><span class="brand-mark">${icon('bubble')}</span><span><strong>泡泡奇旅<span class="brand-spark">✦</span></strong><small>BUBBLE JOURNEY</small></span></a>
      <nav aria-label="主导航"><button class="nav-link active" id="nav-lobby">游戏大厅</button><button class="nav-link" id="nav-guide">玩法指南</button><button class="nav-link" id="nav-records">我的战绩</button></nav>
      <div class="header-actions"><span class="local-badge"><i></i> 快乐，即刻开场</span><button class="icon-button" id="sound-toggle" aria-label="关闭声音" title="声音">${icon('volume')}</button><button class="icon-button" id="help" aria-label="打开玩法指南">${icon('help')}</button></div>
    </header>
    <main>
      <section class="intro"><div><div class="eyebrow"><span></span> A LITTLE BUBBLE. A BIG ADVENTURE.</div><h1>把快乐，<span>炸成小泡泡。</span><span class="title-star">✧</span></h1><p>带上你的可爱，来一场热热闹闹的花园对决。</p></div><div class="intro-note"><span class="tiny-stars">✦ · ✧</span><span>轻松一局<br><b>快乐不打烊</b></span><svg viewBox="0 0 80 48" aria-hidden="true"><path d="M3 12q35-15 39 12t30-5m-5-5 7 5-7 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div></section>
      <div class="game-layout">
        <section class="arena-card" aria-label="游戏竞技场">
          <div class="arena-toolbar"><div class="arena-heading"><span class="mode-icon">${icon('leaf')}</span><div><h2 id="arena-title">薄荷花园</h2><span id="arena-subtitle">经典竞技 · 1 位玩家 + 3 位 AI</span></div></div><div class="arena-tools"><span id="round-timer" class="timer">${icon('clock')} <b>03:00</b></span><button class="icon-button hidden" id="pause" aria-label="暂停游戏">${icon('pause')}</button><button class="icon-button" id="fullscreen" aria-label="全屏竞技场">${icon('expand')}</button></div></div>
          <div id="arena-stage" class="arena-stage"><div class="stage-decoration left">✧<span>✿</span>·</div><div class="stage-decoration right">·<span>✿</span>✧</div><div id="game-canvas" role="img" aria-label="俯视角泡泡竞技场。使用方向键移动，空格放置泡泡。"></div><div id="loading" class="loading"><span class="loading-bubble"></span><b>花园正在苏醒…</b></div><div id="countdown" class="countdown hidden" aria-live="assertive"></div><div id="spectating" class="spectating hidden">你被泡泡击中了 · 正在观战 <button id="spectate-restart">再来一局</button></div><span id="preview-label" class="preview-label"><i></i> 你的下一场快乐，就在这里</span></div>
          <div class="arena-footer"><div class="keyboard-tip"><span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>移动</span><span class="divider"></span><kbd class="space-key">SPACE</kbd><span>放泡泡</span></div><span class="footer-note">小心，快乐会连锁反应 ${icon('bubble')}</span></div>
          <div id="touch-controls" class="touch-controls hidden"><div class="dpad" aria-label="移动方向"><button data-dir="up" aria-label="向上移动">▲</button><button data-dir="left" aria-label="向左移动">◀</button><span></span><button data-dir="right" aria-label="向右移动">▶</button><button data-dir="down" aria-label="向下移动">▼</button></div><div class="touch-hint">走位要灵活<br>放完记得跑！</div><button id="touch-bomb" aria-label="放置泡泡">${icon('bubble')}<span>放泡泡</span></button></div>
        </section>
        <aside class="sidebar">
          <section class="setup-panel" id="lobby-panel"><div class="panel-heading"><h2>准备好出发了吗？</h2><span>LET’S PLAY</span></div>
            <div class="section-label"><span>01</span><h3>选一个可爱搭子</h3><small>属性相同 · 随心挑选</small></div>
            <div class="selected-character"><div id="selected-portrait"></div><div><strong id="character-name"></strong><p id="character-tag"></p><span class="character-badge">今日冒险家</span></div><span class="portrait-spark">✧</span></div>
            <div class="characters" role="group" aria-label="选择角色">${CHARACTERS.map((c, i) => `<button class="character-option" data-character="${i}" aria-label="选择${c.name}" aria-pressed="false"><span>${characterSvg(i)}</span><b>${c.name}</b><i>${icon('check')}</i></button>`).join('')}</div>
            <div class="section-label map-label"><span>02</span><h3>今天，去哪里玩？</h3></div>
            <div class="maps" role="group" aria-label="选择地图">${THEMES.map((t, i) => `<button class="map-option" data-theme="${i}" aria-pressed="false"><span>${mapThumb(i)}</span><b>${t.name}</b></button>`).join('')}</div>
            <button id="shuffle" class="shuffle-button">${icon('shuffle')} 随机布局 <span id="seed-label"></span></button>
            <div class="match-settings"><label>对局时长<select id="duration" aria-label="对局时长"><option value="120">2 分钟</option><option value="180" selected>3 分钟</option><option value="240">4 分钟</option></select></label><label>对手难度<select id="difficulty" aria-label="对手难度"><option value="normal">轻松竞技</option><option value="hard">高手过招</option></select></label></div>
            <button id="start" class="primary-button" disabled>${icon('play')} <span>开始冒险</span> ${icon('arrow')}</button><p class="start-note"><i></i> 无需等待，3 位 AI 伙伴已就位</p>
          </section>
          <section id="match-panel" class="match-panel hidden"><div class="panel-heading"><h2>花园里的伙伴</h2><span id="alive-count">4 人存活</span></div><div id="players"></div><div class="section-label"><span>✦</span><h3>我的背包</h3></div><div class="inventory"><div>${icon('bubble')}<b id="stat-bombs">1</b><small>泡泡数量</small></div><div>${icon('star')}<b id="stat-range">2</b><small>爆炸范围</small></div><div>${icon('bolt')}<b id="stat-speed">1</b><small>移动速度</small></div></div><div class="score-card"><span>本局积分</span><strong id="score">0<span> pts</span></strong></div><div id="event-message" class="event-message" aria-live="polite">保持移动，记得给自己留条退路。</div><button id="match-restart" class="secondary-button">${icon('restart')} 重新开始</button><button id="match-leave" class="text-button">${icon('home')} 返回大厅</button></section>
          <div class="daily-tip"><span>✦</span><p><b>冒险家小贴士</b><span id="tip-text">泡泡会十字爆开。拐个弯，<br>就是最好的藏身之处。</span></p></div>
        </aside>
      </div>
      <section class="bottom-strip"><div><span class="strip-icon mint">${icon('bubble')}</span><p><b>小道具，大惊喜</b><span>打破木箱，收集三种能力提升</span></p></div><div><span class="strip-icon peach">${icon('shuffle')}</span><p><b>每一局，都不一样</b><span>三处秘境，无数种奇妙布局</span></p></div><div><span class="strip-icon lilac">${icon('trophy')}</span><p><b>好胜心，也可以很可爱</b><span>灵活走位，成为最后的冒险家</span></p></div></section>
    </main><footer class="page-footer"><span>泡泡奇旅 © 2026 <i>·</i> 为每一个想快乐一下的你</span><span>原创美术与音乐 <i>·</i> 单人离线竞技</span></footer>
    <dialog id="modal" aria-labelledby="modal-title"></dialog><div id="toast" class="toast hidden" role="status"></div>
  </div>`;
}
