import { Track, wrap } from './track';
export interface Controls { throttle: boolean; brake: boolean; steer: number; drift: boolean; nitro: boolean }
export const IDLE: Controls = { throttle: false, brake: false, steer: 0, drift: false, nitro: false };
export const CARS = [
  { name: '逐风', english: 'BREEZE GT', color: 0x45dddf, top: 65, acceleration: 25, handling: 1, stats: [86,90,88], desc: '轻盈、敏捷，每一个弯都游刃有余。' },
  { name: '赤焰', english: 'BLAZE R', color: 0xff765f, top: 70, acceleration: 22, handling: 0.9, stats: [96,80,76], desc: '为长直道而生，把对手留在尾灯之外。' },
  { name: '星芒', english: 'NOVA S', color: 0xb5a0ff, top: 62, acceleration: 29, handling: 1.14, stats: [80,97,98], desc: '快速出弯，让每次漂移都成为优势。' },
];
export type Phase = 'countdown' | 'racing' | 'paused' | 'finished';
export interface Racer {
  id: number; name: string; color: number; s: number; d: number; speed: number;
  slide: number; finished: number | null; boost: number; collision: number;
}
export class Race {
  phase: Phase = 'countdown';
  private previousPhase: Phase = 'countdown';
  countdown = 3;
  elapsed = 0;
  racers: Racer[];
  nitro = 1;
  charge = 0;
  driftTime = 0;
  driftTotal = 0;
  topSpeed = 0;
  nitrosUsed = 0;
  laps: number[] = [];
  message = '';
  messageTime = 0;
  private lapStart = 0;
  private nitroHeld = false;
  private pad = -1;
  constructor(readonly track: Track, readonly carIndex = 0, readonly mode: 'race' | 'time' = 'race', readonly difficulty: 'casual' | 'pro' = 'casual', readonly totalLaps = 2) {
    const names = ['你', '橘子汽水', '夜航星', '山风', '小闪电', '追光者'];
    const colors = [CARS[carIndex].color, 0xffb64a, 0xb99aff, 0xef668d, 0x80dd9b, 0x6f9cff];
    this.racers = names.slice(0, mode === 'time' ? 1 : 6).map((name,id) => ({ id, name, color: colors[id], s: -9-Math.floor(id/2)*6, d: (id%2 ? -1 : 1)*3, speed: 0, slide: 0, finished: null, boost: 0, collision: 0 }));
  }
  get player() { return this.racers[0]; }
  get lap() { return Math.min(this.totalLaps, Math.max(1, Math.floor(this.player.s/this.track.length)+1)); }
  get order() { return [...this.racers].sort((a,b) => a.finished !== null && b.finished !== null ? a.finished-b.finished : a.finished !== null ? -1 : b.finished !== null ? 1 : b.s-a.s || a.id-b.id); }
  get position() { return this.order.findIndex(r => r.id === 0)+1; }
  pause() { if (this.phase === 'countdown' || this.phase === 'racing') { this.previousPhase = this.phase; this.phase = 'paused'; } }
  resume() { if (this.phase === 'paused') this.phase = this.previousPhase; }
  resetCar() {
    if (this.phase !== 'racing') return;
    this.player.d = 0; this.player.speed *= 0.45; this.player.slide = 0; this.driftTime = 0;
    this.say('已回到赛道中央');
  }
  private say(text: string) { this.message = text; this.messageTime = 1.5; }
  step(dt: number, input: Controls) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Fixed-step caller; cap here as a second boundary against resumed-tab time jumps.
    dt = Math.min(dt, 1/30);
    if (this.phase === 'paused' || this.phase === 'finished') return;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = 'racing'; this.say('出发！'); }
      return;
    }
    this.elapsed += dt;
    this.messageTime = Math.max(0, this.messageTime-dt);
    const p = this.player, spec = CARS[this.carIndex], oldS = p.s;
    p.collision = Math.max(0,p.collision-dt);
    const drifting = input.drift && Math.abs(input.steer)>0.1 && p.speed>17 && !input.brake;
    if (input.nitro && !this.nitroHeld && this.nitro>0 && p.boost<=0) {
      this.nitro--; this.nitrosUsed++; p.boost = 2.5; this.say('氮气加速！');
    }
    this.nitroHeld = input.nitro;
    if (drifting) {
      this.driftTime += dt; this.driftTotal += dt;
      this.charge += dt * (Math.abs(this.track.sample(p.s).curvature)>0.002 ? 35 : 21);
      if (this.charge>=100) { if (this.nitro<2) { this.nitro++; this.say('氮气 +1'); } this.charge = this.nitro>=2 ? 100 : this.charge-100; }
    } else if (this.driftTime>0) {
      if (this.driftTime>=0.45 && p.collision===0) { p.boost = Math.max(p.boost,0.65); this.say('完美出弯 · 小喷'); }
      this.driftTime = 0;
    }
    p.boost = Math.max(0,p.boost-dt);
    const boost = p.boost>0, maxSpeed = spec.top*(boost?1.42:drifting?0.89:1);
    const accel = input.brake ? -45 : input.throttle || boost ? spec.acceleration*(boost?1.8:1) : -12;
    if (accel<=0) p.speed = Math.max(0,p.speed+accel*dt);
    else if (p.speed<maxSpeed) p.speed = Math.min(maxSpeed,p.speed+accel*dt);
    else if (p.speed>maxSpeed) p.speed = Math.max(maxSpeed,p.speed-30*dt);
    const curvature = this.track.sample(p.s).curvature;
    const steer = Math.max(-1,Math.min(1,input.steer));
    const lateral = steer * (4.1 + p.speed*0.07) * spec.handling * (drifting?1.4:1);
    // Track-space handling keeps the arcade racer recoverable while corners still push outwards.
    p.d += (lateral + curvature*p.speed*p.speed*(drifting?0.085:0.055))*dt;
    p.slide += ((drifting?-steer*0.5:-steer*0.1)-p.slide)*Math.min(1,dt*9);
    const edge = this.track.definition.width/2-1.4;
    if (Math.abs(p.d)>edge) {
      p.d = Math.sign(p.d)*edge;
      if (p.collision<=0) { p.speed *= 0.65; p.collision = 0.75; p.boost = 0; this.say('擦到护栏 · 调整方向'); }
      p.speed = Math.max(0,p.speed-20*dt);
    }
    p.s += p.speed*dt;
    this.topSpeed = Math.max(this.topSpeed,p.speed*3.6);
    const local = wrap(p.s,this.track.length), pad = this.track.boosts.findIndex(s => Math.abs(local-s)<5);
    if (pad>=0 && pad!==this.pad && Math.abs(p.d)<5.8) { p.boost = Math.max(p.boost,1.1); this.say('加速带！'); }
    this.pad = pad;
    if (oldS<0 && p.s>=0) this.lapStart = this.elapsed;
    if (Math.floor(Math.max(0,oldS)/this.track.length)<Math.floor(p.s/this.track.length)) {
      this.laps.push(this.elapsed-this.lapStart); this.lapStart = this.elapsed;
      if (p.s < this.track.length*this.totalLaps) this.say('最后一圈！');
    }
    this.updateAI(dt);
    const finish = this.track.length*this.totalLaps;
    for (const racer of this.racers) if (racer.s>=finish && racer.finished===null) racer.finished = this.elapsed;
    if (p.finished!==null) { this.phase = 'finished'; p.boost = 0; }
  }
  private updateAI(dt: number) {
    const p = this.player;
    for (const bot of this.racers.slice(1)) {
      if (bot.finished!==null) { bot.speed = Math.max(0,bot.speed-25*dt); continue; }
      const curve = Math.abs(this.track.sample(bot.s+22).curvature);
      const base = (this.difficulty==='casual'?48:58) + bot.id*0.6;
      const target = base * Math.max(0.74,1-curve*6) + (Math.sin(this.elapsed*0.25+bot.id)>0.96?12:0);
      bot.speed += Math.max(-30*dt,Math.min(20*dt,target-bot.speed));
      bot.s += bot.speed*dt;
      const lane = Math.sin(bot.s*0.008+bot.id*1.8)*4.6;
      bot.d += (lane-bot.d)*Math.min(1,dt*1.3);
      bot.slide = -this.track.sample(bot.s).curvature*9;
      let gap = wrap(bot.s-p.s+this.track.length/2,this.track.length)-this.track.length/2;
      if (Math.abs(gap)<4 && Math.abs(bot.d-p.d)<2.2 && p.collision<=0) {
        p.speed *= 0.83; p.d += (p.d>=bot.d?1:-1)*0.6; p.collision = 0.7; this.say('发生碰撞');
      }
    }
  }
}
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const ms = Math.max(0,Math.floor(seconds*1000));
  return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}
