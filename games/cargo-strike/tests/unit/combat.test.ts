import {describe,it,expect} from 'vitest';
import {Match} from '../../src/game/match';
import {emptyInput,eye} from '../../src/game/types';
import {direction,normalize,rayBox} from '../../src/game/math';
import {canStand,moveBody,visible,wallDistance} from '../../src/game/map';
import {findPath} from '../../src/game/navigation';
import {magazine,transferAmmo} from '../../src/game/weapons';

function training(){const m=new Match(320);m.start({primary:'m4',difficulty:'regular',mode:'practice',target:10,duration:120});return m;}
function advance(m:Match,seconds:number,input=emptyInput()){for(let i=0;i<seconds*60;i++)m.update(1/60,input);}
describe('collision and navigation',()=>{
  it('parallel rays outside a box never hit; inside rays hit the facing plane',()=>{
    const b={x:0,y:1,z:0,w:2,h:2,d:2};expect(rayBox({x:2,y:1,z:4},{x:0,y:0,z:-1},b)).toBeNull();expect(rayBox({x:0,y:1,z:4},{x:0,y:0,z:-1},b)).toBe(3);
  });
  it('solid containers block both sight and movement',()=>{
    const p={x:5,y:0,z:25};for(let i=0;i<120;i++)moveBody(p,0,-.07,1.8,true);
    expect(p.z).toBeGreaterThan(23.4);expect(canStand(p.x,p.y,p.z)).toBe(true);
    expect(visible({x:5,y:1.6,z:25},{x:5,y:1.6,z:17})).toBe(false);
  });
  it('does not tunnel through the ship boundary',()=>{
    const m=training();m.player.pos={x:14,y:0,z:27};advance(m,5,{...emptyInput(),right:1});expect(m.player.pos.x).toBeLessThan(14.5);
  });
  it('high platforms cannot be used to leave the ship and stand on invisible ground',()=>{
    const p={x:14.3,y:3.1,z:-7};for(let i=0;i<200;i++)moveBody(p,.07,0,1.8,true);
    expect(p.x).toBeLessThanOrEqual(14.4);expect(canStand(16,0,0)).toBe(false);
  });
  it('outer passage has an unblocked route and walkable staircase',()=>{
    const p={x:12.8,y:0,z:22};for(let i=0;i<480;i++)moveBody(p,0,-.07,1.8,true);
    expect(p.y).toBeGreaterThan(3);expect(p.z).toBeLessThan(-6);
  });
  it('BFS connects opposite spawn zones without crossing a solid',()=>{
    const route=findPath({x:0,y:0,z:27},{x:0,y:0,z:-27});expect(route.length).toBeGreaterThan(50);
    for(const p of route)expect(canStand(p.x,0,p.z)).toBe(true);expect(route.at(-1)?.z).toBe(-27);
  });
  it('a jump lands at the original height and cannot fly by holding jump',()=>{
    const m=training();m.update(1/60,{...emptyInput(),jump:true});expect(m.player.pos.y).toBeGreaterThan(0);advance(m,1);expect(m.player.pos.y).toBe(0);expect(m.player.grounded).toBe(true);
  });
});
describe('weapons and combat',()=>{
  it('a headshot kills the visible target and increments the correct score once',()=>{
    const m=training();m.shoot(m.player,direction(0,0));expect(m.actors[4].alive).toBe(false);expect(m.scores).toEqual([1,0]);expect(m.player.headshots).toBe(1);
    m.shoot(m.player,direction(0,0));expect(m.player.magazines.m4.ammo).toBe(29);expect(m.scores[0]).toBe(1);
  });
  it('body armor absorbs part of the damage and reserves stay finite',()=>{
    const m=training();const e=m.actors[4];const a=eye(m.player),b={...e.pos,y:.9};
    m.shoot(m.player,normalize({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z}));expect(e.hp).toBeCloseTo(77.38);expect(e.armor).toBeCloseTo(93.62);expect(m.shots).toBe(1);expect(m.hits).toBe(1);
  });
  it('cover stops shots before reaching the target',()=>{
    const m=training();m.player.pos={x:5,y:0,z:25};m.actors[4].pos={x:5,y:0,z:17};m.shoot(m.player,direction(0,0));expect(m.actors[4].hp).toBe(100);expect(wallDistance(eye(m.player),direction(0,0))).toBeLessThan(3);
  });
  it('protection blocks damage and firing immediately removes shooter protection',()=>{
    const m=training();m.actors[4].shield=2;m.shoot(m.player,direction(0,0));expect(m.actors[4].hp).toBe(100);expect(m.player.shield).toBe(0);
  });
  it('teammates cannot damage one another',()=>{
    const m=training();m.actors[1].alive=true;m.actors[1].shield=0;m.damage(m.actors[1],m.player,500,false,'m4',eye(m.actors[1]));expect(m.actors[1].hp).toBe(100);
  });
  it('reload transfers only available rounds, with no free ammunition',()=>{
    const mag=magazine('m4');mag.ammo=23;mag.reserve=3;transferAmmo(mag,'m4');expect(mag).toEqual({ammo:26,reserve:0});transferAmmo(mag,'m4');expect(mag.ammo).toBe(26);
    const m=training();m.player.magazines.m4.ammo=12;m.reload();advance(m,2.3);expect(m.player.magazines.m4).toEqual({ammo:30,reserve:102});
  });
  it('switching weapons cancels reload without duplicating ammo',()=>{
    const m=training();m.player.magazines.m4.ammo=5;m.reload();advance(m,.3);m.switchWeapon(2);advance(m,3);
    expect(m.player.magazines.m4).toEqual({ammo:5,reserve:120});expect(m.player.weapon).toBe('pistol');expect(m.player.reload).toBe(0);
  });
  it('holding the trigger fires automatic rifles but only one semiautomatic pistol shot',()=>{
    const m=training();m.player.yaw=Math.PI/2;advance(m,.5,{...emptyInput(),fire:true});expect(m.player.magazines.m4.ammo).toBeLessThan(27);
    m.switchWeapon(2);advance(m,.4);advance(m,1,{...emptyInput(),fire:true});expect(m.player.magazines.pistol.ammo).toBe(14);
  });
  it('death leads to timed respawn with kills and deaths preserved',()=>{
    const m=training();m.player.shield=0;m.player.kills=3;m.damage(m.player,m.actors[4],500,true,'m4',eye(m.player));expect(m.player.alive).toBe(false);advance(m,1.6);expect(m.player.alive).toBe(true);expect(m.player.deaths).toBe(1);expect(m.player.kills).toBe(3);expect(m.player.hp).toBe(100);
  });
  it('grenade throws are bounded and paused fuses do not advance',()=>{
    const m=training();m.throwGrenade();m.throwGrenade();expect(m.grenades.length).toBe(1);expect(m.player.grenades).toBe(1);
    const fuse=m.grenades[0].fuse;m.phase='paused';advance(m,3);expect(m.grenades[0].fuse).toBe(fuse);m.phase='playing';advance(m,3);expect(m.grenades.length).toBe(0);expect(m.events.some(e=>e.type==='blast')).toBe(true);
  });
});
describe('match lifecycle and AI',()=>{
  it('a paused match freezes movement, timer, reload and AI',()=>{
    const m=training();m.player.magazines.m4.ammo=5;m.reload();m.phase='paused';const before=JSON.stringify(m.actors);advance(m,3,{...emptyInput(),forward:1});expect(JSON.stringify(m.actors)).toBe(before);expect(m.elapsed).toBe(0);
  });
  it('AI plays a complete bounded match without simulated score shortcuts',()=>{
    const m=new Match(29);m.start({primary:'m4',difficulty:'regular',mode:'team',target:10,duration:120});advance(m,121);
    expect(m.phase).toBe('finished');expect(m.elapsed).toBeLessThanOrEqual(120.1);expect(m.scores[0]+m.scores[1]).toBeGreaterThan(5);
    expect(m.actors.reduce((n,a)=>n+a.kills,0)).toBe(m.scores[0]+m.scores[1]);expect(m.events.filter(e=>e.type==='finish')).toHaveLength(1);
  });
  it('the timer ends a match even without a score winner',()=>{
    const m=training();m.settings.mode='team';m.settings.duration=.05;m.settings.target=100;advance(m,.1);expect(m.phase).toBe('finished');
  });
  it('restarting clears all previous match effects and statistics',()=>{
    const m=training();m.throwGrenade();m.scores=[6,9];m.player.kills=7;m.start(m.settings);expect(m.scores).toEqual([0,0]);expect(m.grenades).toHaveLength(0);expect(m.player.kills).toBe(0);expect(m.phase).toBe('playing');
  });
});
