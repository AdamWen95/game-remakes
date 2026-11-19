const rifle = `<svg viewBox="0 0 210 64" aria-hidden="true"><path d="M10 24h36l12-9h37v6h55l4 5h42v6h-42v6h-40l-7 23H91l1-23H75l-8 21H54l3-24H40L15 48H7Z" fill="currentColor"/><path d="M78 13h33v6H78zm44 6v-9h6v9M168 24v-8h5v8" fill="currentColor"/></svg>`;
export function layout(): void {
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="world" aria-label="运输船三维游戏画面"></canvas>
  <div id="loading"><span class="brand-mark">C</span><p>正在装载运输船</p><small>构建场景 · 检查装备</small></div>
  <section id="lobby" aria-label="游戏大厅">
    <header class="topbar"><a class="brand" href="#" aria-label="Cargo Strike 首页"><span class="brand-mark">C</span><span>CARGO<span class="brand-light"> / STRIKE</span><small>TACTICAL COMBAT EXPERIENCE</small></span></a><div class="top-location">NORTH PACIFIC <span>35° 41′ N &nbsp; 139° 46′ E</span></div><button id="settings-open" class="icon-button" aria-label="打开设置">⚙</button></header>
    <div class="lobby-content"><div class="eyebrow"><span></span> CLASSIC BATTLEFIELD / 001</div><h1>运输船<span>CARGO STRIKE</span></h1><p class="intro">海风掠过甲板，下一发决定胜负。<br>重返集装箱之间，找回最纯粹的枪战。</p>
      <div class="mode-tabs" role="group" aria-label="游戏模式"><button data-mode="team" class="selected" aria-pressed="true">团队竞技 <small>4 VS 4</small></button><button data-mode="practice" aria-pressed="false">自由练枪 <small>PRACTICE</small></button></div>
      <div class="match-config"><label>对手强度<select id="difficulty"><option value="recruit">新兵 · 轻松上手</option><option value="regular" selected>常规 · 势均力敌</option><option value="veteran">老兵 · 高压交火</option></select></label><label>对局目标<select id="target"><option value="40">40 击杀 / 5 分钟</option><option value="20">20 击杀 / 3 分钟</option><option value="10">10 击杀 / 2 分钟</option></select></label></div>
      <div class="loadout-label"><span>选择主武器</span><small>LOADOUT / <b id="weapon-description">均衡 · 突击步枪</b></small></div>
      <div class="loadouts" role="group" aria-label="选择主武器"><button class="selected" data-weapon="m4" aria-pressed="true"><span>01</span>${rifle}<strong>M4A1</strong><small>稳定 · 精准</small></button><button data-weapon="ak" aria-pressed="false"><span>02</span>${rifle}<strong>AK-47</strong><small>力量 · 突破</small></button><button data-weapon="awp" aria-pressed="false"><span>03</span>${rifle}<strong>AWP</strong><small>远距 · 狙击</small></button></div>
      <button id="start" class="primary"><span>进入战场 <small>DEPLOY TO BATTLE</small></span><b>↗</b></button>
      <div class="start-note"><i></i> 单人 + AI 对战 <span>无需联网 · 即刻开战</span></div>
    </div>
    <aside class="map-card"><div><span class="eyebrow">OPERATION / MERCURY</span><span class="map-live"><i></i> 甲板已就绪</span></div><canvas id="overview" width="240" height="280" aria-label="运输船战术地图"></canvas><h2>熟悉的战场。<br><span>全新的交火。</span></h2><p>中央对枪 · 侧翼绕行 · 高台压制</p><div class="map-spec"><span>海上货轮<b>开放甲板</b></span><span>作战规模<b>4 对 4</b></span><span>环境<b>晴间多云</b></span></div></aside>
    <footer class="lobby-footer"><div><kbd>W A S D</kbd> 移动 <kbd>鼠标</kbd> 瞄准 / 射击 <kbd>R</kbd> 换弹 <kbd>Shift</kbd> 冲刺</div><button id="help-open">操作指南 <span>↗</span></button><small>TRANSPORT SHIP / FAN-MADE RECREATION</small></footer>
  </section>
  <section id="hud" class="hidden" aria-label="战斗信息">
    <div class="radar-wrap"><canvas id="radar" width="176" height="200" aria-label="战场雷达"></canvas><span id="location">A 区 · 出生甲板</span></div>
    <div class="scoreboard"><div class="blue"><small>BLUE TEAM</small><b id="blue-score">00</b></div><div class="score-center"><span id="match-timer">05:00</span><small id="score-target">40 击杀获胜</small></div><div class="red"><b id="red-score">00</b><small>RED TEAM</small></div></div>
    <div class="hud-top-right"><span id="fps">60 FPS</span><button id="pause" class="icon-button" aria-label="暂停游戏">Ⅱ</button></div>
    <div id="killfeed" aria-live="polite"></div><div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker">×</div>
    <div id="scope" class="hidden"><div class="scope-ring"><i></i><b></b><span>4 × OPTIC</span></div></div>
    <div id="damage-vignette"></div><div id="protection"></div><div id="notification" aria-live="polite"></div>
    <div id="reload-indicator" class="hidden"><span>正在更换弹匣</span><div><i></i></div></div>
    <div class="health-panel"><span class="health-icon">✚</span><div><b id="health">100</b><span>生命值</span><div class="health-track"><i id="health-bar"></i></div></div><div class="armor"><span>◈</span> <b id="armor">100</b><small>护甲</small></div></div>
    <div class="bottom-hints"><span><kbd>1 / 2</kbd> 切枪</span><span><kbd>G</kbd> 手雷 <b id="grenade-count">2</b></span><span><kbd>Tab</kbd> 战绩</span><span><kbd>Esc</kbd> 暂停</span></div>
    <div class="ammo-panel"><span id="current-weapon">M4A1</span><div><b id="ammo">30</b><span>/ <i id="reserve">120</i></span></div><small id="fire-mode">5.56 × 45 MM &nbsp; / &nbsp; AUTO</small></div>
    <div id="death" class="hidden"><span>你已阵亡</span><h2>重新集结</h2><p><b id="respawn-seconds">3</b> 秒后返回战场</p></div>
    <div id="touch-controls"><div id="move-pad"><i></i><span>移动</span></div><div id="look-pad" aria-label="滑动瞄准"></div><button id="touch-aim" aria-label="瞄准">◎</button><button id="touch-jump" aria-label="跳跃">↑</button><button id="touch-reload" aria-label="换弹">R</button><button id="touch-grenade" aria-label="投掷手雷">G</button><button id="touch-fire" aria-label="开火">⌖</button></div>
    <div id="mouse-hint" class="hidden">按住鼠标拖动转向 · 点击射击 <button id="capture-mouse">锁定鼠标</button></div>
  </section>
  <div id="scores-overlay" class="hidden"><div class="scores-card"><span class="eyebrow">LIVE MATCH / 战场记录</span><h2>团队战绩</h2><div id="scores-table"></div></div></div>
  <dialog id="dialog"><div id="dialog-content"></div></dialog>
  <div id="error" class="hidden" role="alert"><h2>暂时无法进入战场</h2><p id="error-message"></p><button id="retry" class="primary">重新加载</button></div>`;
}
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
