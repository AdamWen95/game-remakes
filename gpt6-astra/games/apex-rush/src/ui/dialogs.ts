import { el } from './layout';
import { formatTime, type Race } from '../game/race';
let returnFocus: HTMLElement|null=null;
export function closeDialog() { el('modal').hidden=true;returnFocus?.focus(); }
export function showDialog(html: string) {
  returnFocus=document.activeElement as HTMLElement;
  el('modal-content').innerHTML=html;el('modal').hidden=false;
  el('modal').querySelector<HTMLElement>('button')?.focus();
}
export function initDialogTrap() {
  el('modal').addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const items=[...el('modal').querySelectorAll<HTMLElement>('button,a,input,select,[tabindex="0"]')].filter(node=>!node.hasAttribute('disabled'));
    const first=items[0],last=items.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  });
}
export function showHelp(onClose: ()=>void) {
  showDialog(`<span class="modal-kicker">DRIVER'S HANDBOOK</span><h2 id="modal-title">每个弯道，都有答案。</h2><p>保持油门，在弯中控制漂移，出弯时释放速度。</p><div class="help-grid"><span><kbd>W / ↑</kbd> 加速</span><span><kbd>S / ↓</kbd> 刹车</span><span><kbd>A D / ← →</kbd> 转向</span><span><kbd>SHIFT + 转向</kbd> 漂移</span><span><kbd>SPACE / CTRL</kbd> 释放氮气</span><span><kbd>R</kbd> 车辆回正</span><span><kbd>C</kbd> 切换追尾视角</span><span><kbd>ESC / P</kbd> 暂停比赛</span></div><div class="help-tip"><b>从漂移，到小喷，再到氮气。</b><p>车速超过 62 km/h 时按住漂移和方向键即可集气；持续至少半秒后松开漂移，触发出弯小喷。集满一格获得一瓶氮气，最多储存两瓶。路面的绿色箭头也能加速。</p><p>触屏设备使用底部按钮，默认开启自动油门。竞速赛与计时挑战均为 2 圈；计时挑战没有 AI。</p></div><button id="close-help" class="primary full">准备好了，出发</button>`);
  el('close-help').onclick=()=>{closeDialog();onClose();};
}
export function showPause(resume: ()=>void,restart: ()=>void,lobby: ()=>void) {
  showDialog(`<span class="modal-kicker">TAKE A BREATHER</span><h2 id="modal-title">风在等你。</h2><p>比赛已暂停。准备好了，继续下一道弯。</p><button id="resume" class="primary full">继续比赛 →</button><div class="modal-actions"><button id="restart" class="secondary">重新出发</button><button id="back-lobby" class="secondary">返回车库</button></div>`);
  el('resume').onclick=resume;el('restart').onclick=restart;el('back-lobby').onclick=lobby;
}
export function showResult(race: Race,newBest: boolean,saved: boolean,restart: ()=>void,lobby: ()=>void) {
  const win=race.position===1;
  showDialog(`<span class="modal-kicker">${newBest?'NEW PERSONAL BEST':'FINISH LINE'}</span><div class="result-place">${race.mode==='time'?'✓':String(race.position).padStart(2,'0')}<span>${race.mode==='time'?'挑战完成':win?'冠军 · 领跑全场':'完赛 · 下一场更快'}</span></div><h2 id="modal-title">${newBest?'新的纪录，新的自己。':win?'这一程，属于你。':'每一次出发，都更进一步。'}</h2><p>${race.track.definition.name} · 2 圈${newBest?' · 个人最佳已刷新':''}</p><div class="result-time">${formatTime(race.elapsed)}</div><div class="result-stats"><div><b>${Math.round(race.topSpeed)}</b><span>最高时速 km/h</span></div><div><b>${race.driftTotal.toFixed(1)}s</b><span>漂移时长</span></div><div><b>${race.nitrosUsed}</b><span>氮气释放</span></div></div><div class="lap-times">${race.laps.map((time,i)=>`<span>LAP ${i+1} <b>${formatTime(time)}</b></span>`).join('')}</div>${saved?'':'<p class="save-warning">浏览器未允许保存纪录，本次成绩仅在当前页面保留。</p>'}<button id="again" class="primary full">再来一场 →</button><button id="result-lobby" class="secondary full">返回车库</button>`);
  el('again').onclick=restart;el('result-lobby').onclick=lobby;
}
