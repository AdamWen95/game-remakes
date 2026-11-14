import { describe, it, expect } from 'vitest';
import { Race, IDLE, CARS, formatTime, type Controls } from '../../src/game/race';
import { Track, TRACKS, angleDifference } from '../../src/game/track';
function advance(race: Race, seconds: number, controls: Controls={...IDLE,throttle:true}) {
  for(let i=0;i<Math.round(seconds*120);i++)race.step(1/120,controls);
}
function ready(car=0, mode: 'race'|'time'='race') {const race=new Race(new Track(TRACKS[0]),car,mode);advance(race,3.1,IDLE);return race;}
describe('track geometry and progress',()=>{
  for(const definition of TRACKS)it(`${definition.id} is closed, finite and has continuous direction`,()=>{
    const track=new Track(definition);expect(track.length).toBeGreaterThan(1200);
    expect(track.sample(0)).toEqual(track.sample(track.length));
    for(let s=0;s<track.length;s+=3){const p=track.sample(s);expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(Math.abs(angleDifference(p.yaw,track.sample(s+1).yaw))).toBeLessThan(0.16);}
    const p=track.sample(55),q=track.sample(55,4);expect(Math.hypot(p.x-q.x,p.z-q.z)).toBeCloseTo(4);
  });
  it('reset is recoverable without gaining progress or laps',()=>{const race=ready();advance(race,5);const s=race.player.s;race.player.d=6;race.resetCar();expect(race.player.s).toBe(s);expect(race.player.d).toBe(0);expect(race.lap).toBe(1);});
});
describe('driving invariants',()=>{
  it('boost acceleration respects every car absolute speed limit and brakes remain effective',()=>{
    for(let car=0;car<CARS.length;car++){
      const race=ready(car,'time');race.player.speed=CARS[car].top;race.nitro=2;
      for(let i=0;i<240;i++){
        race.step(1/120,{...IDLE,throttle:true,nitro:true});
        expect(race.player.speed).toBeLessThanOrEqual(CARS[car].top*1.42);
      }
      const speed=race.player.speed;advance(race,.2,{...IDLE,brake:true});expect(race.player.speed).toBeLessThan(speed);
    }
  });
  it('requires throttle, brakes and never reverses progress',()=>{const race=ready();advance(race,2,IDLE);expect(race.player.speed).toBe(0);advance(race,2);expect(race.player.speed).toBeGreaterThan(40);const s=race.player.s;advance(race,4,{...IDLE,brake:true});expect(race.player.speed).toBe(0);expect(race.player.s).toBeGreaterThan(s);});
  it('pauses countdown and race clocks without consuming input',()=>{const race=new Race(new Track(TRACKS[0]));race.pause();advance(race,5);expect(race.countdown).toBe(3);race.resume();advance(race,5);race.pause();const snapshot=JSON.stringify(race);advance(race,5,{...IDLE,nitro:true});expect(JSON.stringify(race)).toBe(snapshot);race.resume();expect(race.phase).toBe('racing');});
  it('nitro is edge triggered and does not spend more while held',()=>{const race=ready();race.nitro=2;advance(race,3,{...IDLE,nitro:true});expect(race.nitro).toBe(1);expect(race.nitrosUsed).toBe(1);advance(race,.1,IDLE);advance(race,.1,{...IDLE,nitro:true});expect(race.nitro).toBe(0);expect(race.nitrosUsed).toBe(2);});
  it('steering drift charges and release triggers a bounded mini turbo',()=>{const race=ready(0,'time');advance(race,1.3);advance(race,.6,{...IDLE,throttle:true,drift:true,steer:-1});expect(race.driftTotal).toBeGreaterThan(.5);expect(race.charge).toBeGreaterThan(10);advance(race,.01);expect(race.player.boost).toBeGreaterThan(.5);advance(race,1);expect(race.player.boost).toBe(0);});
  it('right steering moves to the driver right in world coordinates',()=>{const race=ready(0,'time');const p=race.track.sample(70,0),q=race.track.sample(70,1);expect((q.x-p.x)*-Math.cos(p.yaw)+(q.z-p.z)*Math.sin(p.yaw)).toBeCloseTo(1);advance(race,1);const d=race.player.d;advance(race,.2,{...IDLE,throttle:true,steer:1});expect(race.player.d).toBeGreaterThan(d);expect(race.player.slide).toBeLessThan(0);});
  it('stationary drift cannot farm nitro',()=>{const race=ready();advance(race,5,{...IDLE,drift:true,steer:1});expect(race.charge).toBe(0);expect(race.driftTotal).toBe(0);});
  it('barriers bound lateral position and reduce speed',()=>{const race=ready();advance(race,2);advance(race,2,{...IDLE,throttle:true,steer:1});expect(Math.abs(race.player.d)).toBeLessThanOrEqual(race.track.definition.width/2-1.3);expect(race.player.speed).toBeLessThan(CARS[0].top);});
  it('large resumed frame and invalid time cannot jump a lap',()=>{const race=ready();advance(race,2);const s=race.player.s;race.step(600,{...IDLE,throttle:true});race.step(NaN,IDLE);expect(race.player.s-s).toBeLessThan(3);expect(Number.isFinite(race.player.s)).toBe(true);});
  it('AI and player collisions have a cooldown rather than repeated speed loss',()=>{const race=ready();race.player.speed=40;race.racers[1].s=race.player.s;race.racers[1].d=race.player.d;race.step(1/120,{...IDLE,throttle:true});expect(race.player.collision).toBeGreaterThan(0);expect(race.player.speed).toBeLessThan(35);});
});
describe('complete races',()=>{
  it('even continuous barrier scraping eventually completes without teleporting',()=>{
    const race=ready(0,'time');
    for(let i=0;i<120*330 && race.phase!=='finished';i++)race.step(1/120,{...IDLE,throttle:true});
    expect(race.phase).toBe('finished');expect(race.laps).toHaveLength(2);
    console.info(`Unsteered completion: ${race.elapsed.toFixed(2)} seconds`);
  });
  for(const def of TRACKS)it(`${def.id} supports an unmodified two lap race and freezes the result`,()=>{
    const race=new Race(new Track(def),0,'time');
    for(let i=0;i<120*180 && race.phase!=='finished';i++){
      const p=race.player,v=p.speed,curve=race.track.sample(p.s).curvature;
      const steer=Math.max(-1,Math.min(1,(-curve*v*v*.055-p.d*2)/(4.1+v*.07)));
      race.step(1/120,{...IDLE,throttle:true,steer,nitro:race.nitro>0 && race.elapsed>3});
    }
    expect(race.phase).toBe('finished');expect(race.laps).toHaveLength(2);expect(race.lap).toBe(2);expect(race.player.finished).toBe(race.elapsed);expect(race.position).toBe(1);
    const elapsed=race.elapsed;advance(race,10);expect(race.elapsed).toBe(elapsed);
  });
  it('formats deterministic times',()=>{expect(formatTime(61.2349)).toBe('01:01.234');expect(formatTime(NaN)).toBe('--:--.---');});
});
