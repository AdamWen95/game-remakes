import './style.css';
import './ui/race.css';
import './ui/mobile.css';
import { Track, TRACKS } from './game/track';
import { Race } from './game/race';
import { Input } from './game/input';
import { AudioEngine } from './audio';
import { loadSave, persist } from './storage';
import { World } from './render/world';
import { HUD, el, mount, updateLobby } from './ui/layout';
import { closeDialog, initDialogTrap, showHelp, showPause, showResult } from './ui/dialogs';

mount();
const save=loadSave(),audio=new AudioEngine();
let world: World;
let track=new Track(TRACKS[save.settings.track]);
let race: Race|null=null,hud: HUD|null=null;
let modalKind: 'help'|'pause'|'result'|null=null;
let finished=false,accumulator=0,lastTime=0,hudTime=0,lastBeep=4;
const input=new Input(action);
initDialogTrap();
document.body.dataset.phase='lobby';
updateLobby(save);
audio.setMuted(save.settings.muted);
input.auto=save.settings.auto;

function saveSettings() { persist(save);updateLobby(save); }
function action(name: string) {
  if(name==='blur') { if(race && (race.phase==='racing' || race.phase==='countdown')) pause(); return; }
  if(name==='mute') { save.settings.muted=!save.settings.muted;audio.setMuted(save.settings.muted);saveSettings();return; }
  if(name==='camera' && race) world.cameraMode=(world.cameraMode+1)%2;
  if(name==='reset') race?.resetCar();
  if(name==='pause'){
    if(modalKind==='help'){closeDialog();modalKind=null;return;}
    if(!race || race.phase==='finished')return;
    race.phase==='paused'?resume():pause();
  }
}
function pause() {
  if(!race || race.phase==='finished' || race.phase==='paused')return;
  race.pause();input.clear();document.body.dataset.phase='paused';modalKind='pause';
  audio.update(0,false,false,false);
  showPause(resume,start,backToLobby);
}
function resume() {
  closeDialog();modalKind=null;race?.resume();input.clear();accumulator=0;
  document.body.dataset.phase=race?.phase || 'lobby';
  el<HTMLCanvasElement>('world').focus();void audio.unlock();
}
function start() {
  if(!world)return;
  closeDialog();modalKind=null;input.clear();
  // Keyboard activation should return focus to the play surface so Space always fires nitro.
  (document.activeElement as HTMLElement)?.blur();
  race=new Race(track,save.settings.car,save.settings.mode,save.settings.difficulty);
  hud=new HUD(race);world.setCars(save.settings.car,race);finished=false;lastBeep=4;accumulator=0;
  el('lobby').hidden=true;el('race-ui').hidden=false;document.body.dataset.phase=race.phase;
  window.scrollTo(0,0);void audio.unlock();world.update(0,0,race);hud.update();
}
function backToLobby() {
  closeDialog();modalKind=null;race=null;hud=null;finished=false;input.clear();
  document.body.dataset.phase='lobby';document.body.classList.remove('boosting');
  el('lobby').hidden=false;el('race-ui').hidden=true;world.setCars(save.settings.car);world.update(0,0,null);
  audio.update(0,false,false,false);updateLobby(save);el('start').focus();
}
function finish() {
  if(!race || finished)return;finished=true;document.body.dataset.phase='finished';input.clear();
  const key=`${track.definition.id}:${save.settings.car}:${save.settings.mode}:${save.settings.mode==='time'?'casual':save.settings.difficulty}`;
  const best=!save.records[key] || race.elapsed<save.records[key];
  if(best)save.records[key]=race.elapsed;
  const saved=persist(save);audio.tone(880,0.4);audio.update(0,false,false,false);modalKind='result';
  showResult(race,best,saved,start,backToLobby);
}
function changeCar(delta: number) {save.settings.car=(save.settings.car+delta+3)%3;saveSettings();world.setCars(save.settings.car);world.update(0,0,null);}
el('start').onclick=start;
el('prev-car').onclick=()=>changeCar(-1);el('next-car').onclick=()=>changeCar(1);
document.querySelectorAll<HTMLButtonElement>('[data-track]').forEach(button=>button.onclick=()=>{
  save.settings.track=Number(button.dataset.track);track=new Track(TRACKS[save.settings.track]);world.setTrack(track,save.settings.car);world.update(0,0,null);saveSettings();
});
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.onclick=()=>{save.settings.mode=button.dataset.mode as 'race'|'time';saveSettings();});
el<HTMLSelectElement>('difficulty').onchange=event=>{save.settings.difficulty=(event.target as HTMLSelectElement).value as 'casual'|'pro';saveSettings();};
el<HTMLInputElement>('auto').onchange=event=>{save.settings.auto=(event.target as HTMLInputElement).checked;input.auto=save.settings.auto;saveSettings();};
el('sound').onclick=()=>{void audio.unlock();action('mute');};
el('quality').onclick=()=>{save.settings.quality=save.settings.quality==='high'?'low':'high';world.setQuality(save.settings.quality);saveSettings();};
el('help').onclick=()=>{modalKind='help';showHelp(()=>{modalKind=null;});};
el('pause').onclick=pause;
document.querySelector<HTMLAnchorElement>('.brand')!.onclick=event=>{event.preventDefault();if(race)backToLobby();};
addEventListener('resize',()=>world?.resize());
el('world').addEventListener('webglcontextlost',event=>{event.preventDefault();pause();failure('图形连接已中断。重新加载页面后可继续游玩，已保存的纪录会保留。');});

function failure(message: string) {
  const loading=el('loading');loading.hidden=false;loading.classList.add('failed');
  loading.innerHTML='<h2>暂时无法启动 3D 画面</h2><p></p><button class="primary" id="reload">重新加载</button>';
  loading.querySelector('p')!.textContent=message;
  el('reload').onclick=()=>location.reload();
}
function frame(time: number) {
  requestAnimationFrame(frame);
  const dt=lastTime?Math.min((time-lastTime)/1000,0.1):0;lastTime=time;
  if(document.hidden || !el('loading').hidden)return;
  if(race){
    const controls=input.read();
    accumulator+=dt;
    while(accumulator>=1/120){race.step(1/120,controls);accumulator-=1/120;}
    if(race.phase==='countdown'){
      const beep=Math.ceil(race.countdown);
      if(beep!==lastBeep){audio.tone(beep===1?660:440);lastBeep=beep;}
    }
    if(document.body.dataset.phase!==race.phase)document.body.dataset.phase=race.phase;
    if(race.phase==='finished')finish();
    audio.update(race.player.speed,race.driftTime>0,race.player.boost>0,race.phase==='racing');
    hudTime+=dt;if(hudTime>0.05){hud?.update();hudTime=0;}
  }
  world.update(dt,time/1000,race);
}
try {
  world=new World(el<HTMLCanvasElement>('world'));
  world.setQuality(save.settings.quality);world.setTrack(track,save.settings.car);world.update(0,0,null);
  el('loading').hidden=true;requestAnimationFrame(frame);
} catch(error) {
  console.error('APEX RUSH renderer initialization failed',error instanceof Error?error.message:'Unknown rendering failure');
  failure('浏览器需要支持 WebGL 2。请尝试开启浏览器硬件加速，或使用新版 Chrome、Edge、Safari 后重新加载。');
}
// Read-only diagnostics are compiled out of production and standalone exports.
if(import.meta.env.DEV){
  Object.assign(window,{__apexSnapshot:()=>race?{phase:race.phase,elapsed:race.elapsed,lap:race.lap,position:race.position,s:race.player.s,d:race.player.d,speed:race.player.speed,nitro:race.nitro,charge:race.charge,drift:race.driftTime,boost:race.player.boost,trackLength:track.length,curvature:track.sample(race.player.s).curvature}:{phase:'lobby'}});
}
