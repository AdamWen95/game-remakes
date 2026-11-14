import { TRACKS, Track } from '../game/track';
import { CARS, formatTime, type Race } from '../game/race';
import type { Save } from '../storage';

const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const logo = '<svg viewBox="0 0 48 40" fill="currentColor"><path d="M2 36 22 3h12L15 36zm20 0 13-23 10 23H34l-3-10-5 10z"/></svg>';
export function mapPath(track: Track) {
  const xs=track.points.map(p=>p.x),zs=track.points.map(p=>p.z);
  const minX=Math.min(...xs),minZ=Math.min(...zs),size=Math.max(Math.max(...xs)-minX,Math.max(...zs)-minZ);
  return track.points.filter((_,i)=>i%8===0).map((p,i)=>`${i?'L':'M'}${(10+(p.x-minX)/size*80).toFixed(1)},${(10+(p.z-minZ)/size*80).toFixed(1)}`).join(' ')+' Z';
}
export function mount() {
  document.querySelector('#app')!.innerHTML=`
    <canvas id="world" aria-label="3D 赛车赛道"></canvas>
    <div class="cinema-shade"></div><div id="speed-lines" aria-hidden="true"></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="疾风竞速主页">${logo}<span>APEX<span class="brand-light">RUSH</span><small>疾 风 竞 速</small></span></a>
      <div class="top-actions"><span class="local-badge"><i></i> OFFLINE READY</span><button id="help" class="quiet">操作指南 <span>?</span></button><button id="sound" class="icon-button" aria-label="关闭声音">♪</button><button id="quality" class="quiet">画质 · 高</button></div>
    </header>
    <main id="lobby">
      <section class="hero"><div class="eyebrow"><span></span> THE ROAD IS YOURS</div><h1>把风，<br><em>甩在身后。</em></h1><p>入弯，漂移，氮气全开。<br>下一道弯，就是你的主场。</p><div class="hero-meta"><span>3D 街机竞速</span><i></i><span>5 位 AI 车手</span><i></i><span>自由驰骋</span></div></section>
      <section class="garage" aria-label="选择赛车"><div class="garage-label"><span>YOUR RIDE / 专属座驾</span><span id="car-number">01 / 03</span></div><div class="car-heading"><div><small id="car-english"></small><h2 id="car-name"></h2></div><div class="car-switch"><button id="prev-car" aria-label="上一辆赛车">‹</button><button id="next-car" aria-label="下一辆赛车">›</button></div></div><p id="car-description"></p><div id="car-stats"></div><div class="paint-dots" aria-label="赛车颜色"><i></i><i></i><i></i></div></section>
      <section class="race-setup" aria-label="比赛设置">
        <div class="section-heading"><div><span class="section-num">01</span><h2>选择你的赛道</h2><span class="subheading">PICK YOUR PLAYGROUND</span></div><span class="track-count">03 TRACKS</span></div>
        <div class="track-list">${TRACKS.map((track,i)=>`<button class="track-card ${track.id}" data-track="${i}" aria-pressed="${i===0}"><span class="track-icon"><svg viewBox="0 0 100 100" fill="none"><path d="${mapPath(new Track(track))}"/></svg></span><span class="track-number">0${i+1}</span><span class="track-title">${track.name}<small>${track.english}</small></span><span class="track-level">${track.difficulty} <i>${'●'.repeat(i+1)}${'○'.repeat(2-i)}</i></span><span class="selected-check">✓</span></button>`).join('')}</div>
        <div class="launch-row"><div class="mode-settings"><div class="mode-tabs" aria-label="比赛模式"><button data-mode="race" aria-pressed="true">竞速赛</button><button data-mode="time" aria-pressed="false">计时挑战</button></div><label class="difficulty-label">难度 <select id="difficulty" aria-label="AI 难度"><option value="casual">轻松驰骋</option><option value="pro">高手对决</option></select></label><label class="auto-label"><input id="auto" type="checkbox"> 自动油门</label></div><div class="start-area"><span id="best">个人最佳<br><b>等待你的首个纪录</b></span><button id="start" class="primary">开始竞速 ${arrow}</button></div></div>
      </section>
      <footer><span>原创赛车体验 · 灵感源自经典漂移竞速</span><span><kbd>W A S D</kbd> 驾驶 <kbd>SHIFT</kbd> 漂移 <kbd>SPACE</kbd> 氮气</span><span>BUILT FOR THE THRILL ↗</span></footer>
    </main>
    <section id="race-ui" hidden aria-label="比赛信息">
      <div class="race-top"><div class="position-block"><strong id="position">1</strong><span>/ <span id="racer-count">6</span><small>当前排名</small></span></div><div class="lap-block"><span>LAP</span><strong id="lap">1 <small>/ 2</small></strong></div><div class="timer-block"><span>RACE TIME</span><strong id="timer">00:00.000</strong><small id="race-track"></small></div><button id="pause" class="icon-button" aria-label="暂停比赛">Ⅱ</button></div>
      <ol id="leaderboard"></ol><div class="minimap"><canvas id="map" width="220" height="220" aria-label="赛道小地图"></canvas><span id="map-name"></span></div>
      <div id="countdown" aria-live="assertive"></div><div id="race-message" role="status"></div>
      <div class="drive-hint"><kbd>W / ↑</kbd> 加速 <kbd>SHIFT</kbd> 漂移 <kbd>SPACE</kbd> 氮气 <kbd>R</kbd> 回正 <kbd>C</kbd> 视角</div>
      <div class="telemetry"><div class="drift-label" id="drift-label">DRIFT TO CHARGE</div><div class="speed"><strong id="speed">0</strong><span>KM/H</span></div><div class="speed-meter"><i id="speed-bar"></i></div><div class="nitro-label"><span>N₂O <b id="nitro-count">01</b></span><span id="nitro-hint">SPACE 释放</span></div><div class="nitro-meter"><i id="nitro-bar"></i></div></div>
      <div class="touch-controls"><div class="touch-steer"><button data-control="left" aria-label="向左转">◀</button><button data-control="right" aria-label="向右转">▶</button><button data-control="brake" class="touch-small" aria-label="刹车">刹车</button></div><div class="touch-pedals"><button data-control="drift" class="drift-button">漂移</button><button data-control="nitro" class="nitro-button">N₂O</button><button data-control="gas" class="gas-button">油门</button></div></div>
    </section>
    <div id="modal" class="modal" hidden><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div id="modal-content"></div></section></div>
    <div id="loading" class="loading"><span class="loading-logo">${logo}</span><h2>准备出发</h2><p>正在铺设你的下一段旅程…</p></div>
    <div id="announcer" class="sr-only" aria-live="polite"></div>
  `;
}
export const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export function updateLobby(save: Save) {
  const {settings:s}=save,car=CARS[s.car];
  el('car-name').textContent=car.name;el('car-english').textContent=car.english;el('car-description').textContent=car.desc;
  el('car-number').textContent=`0${s.car+1} / 03`;
  el('car-stats').innerHTML=['极速','加速','操控'].map((name,i)=>`<div class="stat"><span>${name}</span><div><i style="width:${car.stats[i]}%"></i></div><b>${car.stats[i]}</b></div>`).join('');
  document.querySelectorAll<HTMLElement>('[data-track]').forEach(card=>card.setAttribute('aria-pressed',String(Number(card.dataset.track)===s.track)));
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===s.mode)));
  document.querySelectorAll<HTMLElement>('.paint-dots i').forEach((dot,i)=>dot.classList.toggle('selected',i===s.car));
  el<HTMLSelectElement>('difficulty').value=s.difficulty;el<HTMLSelectElement>('difficulty').disabled=s.mode==='time';
  el<HTMLInputElement>('auto').checked=s.auto;
  el('sound').textContent=s.muted?'♫̸':'♪';el('sound').setAttribute('aria-label',s.muted?'开启声音':'关闭声音');
  el('quality').textContent=`画质 · ${s.quality==='high'?'高':'流畅'}`;
  const key=`${TRACKS[s.track].id}:${s.car}:${s.mode}:${s.mode==='time'?'casual':s.difficulty}`,best=save.records[key];
  el('best').innerHTML=`个人最佳<br><b>${best?formatTime(best):'等待你的首个纪录'}</b>`;
  el('start').innerHTML=`${s.mode==='race'?'开始竞速':'开始挑战'} ${arrow}`;
}
export class HUD {
  private ctx=el<HTMLCanvasElement>('map').getContext('2d')!;
  private minX=0;private minZ=0;private scale=1;
  private lastOrder=''; private lastMessage: string|null=null;
  constructor(private race: Race) {
    const points=race.track.points,xs=points.map(p=>p.x),zs=points.map(p=>p.z);
    this.minX=Math.min(...xs);this.minZ=Math.min(...zs);this.scale=180/Math.max(Math.max(...xs)-this.minX,Math.max(...zs)-this.minZ);
    el('race-track').textContent=race.track.definition.name;el('map-name').textContent=race.track.definition.english;el('racer-count').textContent=String(race.racers.length);
  }
  update() {
    const r=this.race,p=r.player;
    el('position').textContent=String(r.position);el('lap').innerHTML=`${r.lap} <small>/ ${r.totalLaps}</small>`;
    el('timer').textContent=formatTime(r.elapsed);el('speed').textContent=String(Math.round(p.speed*3.6));
    el('speed-bar').style.width=`${Math.min(100,p.speed/95*100)}%`;el('nitro-bar').style.width=`${r.charge}%`;
    el('nitro-count').textContent=String(r.nitro).padStart(2,'0');el('nitro-hint').textContent=p.boost>0?'BOOST ACTIVE':r.nitro?'SPACE 释放':'漂移集气';
    el('drift-label').textContent=r.driftTime>0?'DRIFT  + CHARGING':'DRIFT TO CHARGE';
    el('drift-label').classList.toggle('active',r.driftTime>0);document.body.classList.toggle('boosting',p.boost>0 && r.phase==='racing');
    const count=r.phase==='countdown'?String(Math.ceil(Math.max(0,r.countdown))):r.elapsed<0.75 && r.phase==='racing'?'GO!':'';
    if(el('countdown').textContent!==count)el('countdown').textContent=count;
    const message=r.messageTime>0?r.message:'';
    if(message!==this.lastMessage){el('race-message').textContent=message;this.lastMessage=message;}
    const order=r.order.map(racer=>racer.id).join(',');
    if(order!==this.lastOrder){this.lastOrder=order;el('leaderboard').innerHTML=r.order.map((racer,i)=>`<li class="${racer.id===0?'you':''}"><span>${i+1}</span><i style="background:#${racer.color.toString(16).padStart(6,'0')}"></i><b>${racer.name}</b>${racer.id===0?'<small>YOU</small>':''}</li>`).join('');}
    this.drawMap();
  }
  private drawMap() {
    const ctx=this.ctx;ctx.clearRect(0,0,220,220);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    this.race.track.points.filter((_,i)=>i%6===0).forEach((p,i)=>{const x=20+(p.x-this.minX)*this.scale,y=20+(p.z-this.minZ)*this.scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
    ctx.strokeStyle='#ffffff26';ctx.lineWidth=10;ctx.stroke();ctx.strokeStyle='#ffffff8a';ctx.lineWidth=2;ctx.stroke();
    for(const racer of [...this.race.racers].reverse()){
      const p=this.race.track.sample(racer.s);ctx.beginPath();ctx.arc(20+(p.x-this.minX)*this.scale,20+(p.z-this.minZ)*this.scale,racer.id?3.4:5.2,0,Math.PI*2);ctx.fillStyle=racer.id?'#'+racer.color.toString(16).padStart(6,'0'):'#c5fc4c';ctx.fill();if(!racer.id){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
    }
  }
}
