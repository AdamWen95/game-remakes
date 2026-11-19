import { DECK, lookAt, solids, type Vec } from './arena.ts';
import type { Event } from './combat.ts';
import { weapons } from './loadout.ts';
import type { Match } from './match.ts';

export const el = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const text = (node: HTMLElement, value: string) => { if (node.textContent !== value) node.textContent = value; };
const timeString = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const teamClass = (team: number) => team ? 'enemy' : 'allied';

function paintMap(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d')!;
  const back = document.createElement('canvas');
  back.width = canvas.width; back.height = canvas.height;
  const b = back.getContext('2d')!;
  const px = .5 * (canvas.width - DECK.z * 4.46);
  const py = .5 * (canvas.height - DECK.x * 5.64);
  const sx = (z: number) => px + (z + DECK.z) * 2.23;
  const sy = (x: number) => py + (x + DECK.x) * 2.82;
  b.strokeStyle = '#78a9ae20'; b.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 12) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, canvas.height); b.stroke(); }
  for (let y = 0; y < canvas.height; y += 12) { b.beginPath(); b.moveTo(0, y); b.lineTo(canvas.width, y); b.stroke(); }
  b.fillStyle = '#32464b'; b.fillRect(sx(-32), sy(-14.8), DECK.z * 4.46, DECK.x * 5.64);
  b.strokeStyle = '#b7cbc46b'; b.strokeRect(sx(-32), sy(-14.8), DECK.z * 4.46, DECK.x * 5.64);
  for (const s of solids) {
    if (s.invisible || s.container && s.y) continue;
    b.fillStyle = s.surface === 'grate' ? '#9e9258' : s.surface === 'wood' ? '#6b6556' : '#87958f';
    b.fillRect(sx(s.z - s.d / 2), sy(s.x - s.w / 2), s.d * 2.23, s.w * 2.82);
  }
  b.font = 'bold 11px monospace';
  b.fillStyle = '#e59d8d'; b.fillText('RED', 16, 22);
  b.fillStyle = '#a0dfe8'; b.fillText('BLUE', 119, 22);
  b.fillStyle = '#bfccc4'; b.font = '10px monospace'; b.fillText('MV PELAGIC', 54, 135);
  return (m: Match) => {
    g.clearRect(0, 0, canvas.width, canvas.height); g.drawImage(back, 0, 0);
    for (const a of m.actors) {
      if (!a.hp || (a.team && !m.practice && a.kick < .25)) continue;
      const x = sx(a.pos.z), y = sy(a.pos.x);
      g.fillStyle = a.bot ? a.team ? '#ff9e87' : '#6ad4f4' : '#faffd8';
      g.strokeStyle = '#101d22'; g.lineWidth = 1.35;
      g.beginPath();
      if (a.bot) g.arc(x, y, 2.7, 0, 6.29);
      else {
        g.save(); g.translate(x, y); g.rotate(a.yaw + Math.PI);
        g.moveTo(6, 0); g.lineTo(-4, -4); g.lineTo(-2, 0); g.lineTo(-4, 4); g.closePath(); g.restore();
      }
      g.fill(); g.stroke();
    }
  };
}

export function table(container: HTMLElement, match: Match) {
  const grid = document.createElement('table');
  grid.className = 'battle-table';
  const labels = grid.createTHead().insertRow();
  for (const title of ['队员', '击杀', '阵亡', '爆头']) {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = title; labels.append(cell);
  }
  const body = grid.createTBody();
  for (const a of [...match.actors].sort((a, b) => a.team - b.team || b.kills - a.kills || a.deaths - b.deaths)) {
    const row = body.insertRow();
    row.className = teamClass(a.team) + (a.bot ? '' : ' self');
    for (const value of [a.name, a.kills, a.deaths, a.headshots]) row.insertCell().textContent = String(value);
  }
  container.replaceChildren(grid);
}

export class Hud {
  private blue = el('#blue'); private red = el('#red'); private clock = el('#time'); private goal = el('#goal');
  private health = el('#health'); private armor = el('#armor'); private hp = el('#hp-fill');
  private ammo = el('#loaded'); private spare = el('#reserve'); private weapon = el('#gun'); private inventory = el('#inventory');
  private progress = el('#reload-progress'); private progressBar = el('#reload-progress i');
  private place = el('#zone'); private reticle = el('#reticle'); private hit = el('#hit'); private damage = el('#damage');
  private direction = el('#direction'); private note = el('#notification'); private callout = el('#center-callout');
  private feed = el('#feed'); private board = el('#scoreboard');
  private drawMap = paintMap(el<HTMLCanvasElement>('#minimap'));
  private timetable = new Map<HTMLElement, number>();
  private noteUntil = 0;
  private hitUntil = 0;
  private damageUntil = 0;
  private lastSource?: Vec;
  private mapAt = 0;
  private boardAt = 0;

  reset() {
    this.feed.replaceChildren(); this.timetable.clear(); this.board.hidden = true;
    this.note.textContent = ''; this.noteUntil = this.hitUntil = this.damageUntil = this.mapAt = this.boardAt = 0;
    this.lastSource = undefined;
  }
  toggleBoard(show: boolean, match?: Match) {
    this.board.hidden = !show;
    if (show && match) table(this.board.querySelector('.table-wrap')!, match);
  }

  event(e: Event, match: Match) {
    if (e.type === 'kill') {
      const line = document.createElement('li');
      const shooter = document.createElement('b'), weapon = document.createElement('small'), victim = document.createElement('b');
      shooter.className = teamClass(e.actor.team); victim.className = teamClass(e.target.team);
      shooter.textContent = e.actor.name; victim.textContent = e.target.name;
      weapon.textContent = (e.gun === 'grenade' ? '手雷' : weapons[e.gun].name) + (e.head ? ' · 爆头' : '');
      line.append(shooter, weapon, victim); this.feed.prepend(line);
      this.timetable.set(line, match.time + 4.5);
      if (this.feed.children.length > 4) {
        const old = this.feed.lastElementChild as HTMLElement;
        this.timetable.delete(old); old.remove();
      }
      if (!e.actor.bot) {
        this.note.textContent = e.head ? `爆头击杀 · ${e.target.name}` : `击杀 · ${e.target.name}`;
        this.noteUntil = match.time + 1.35;
      }
    } else if (e.type === 'hit') {
      if (!e.actor.bot) { this.hitUntil = match.time + .20; this.hit.classList.toggle('lethal', e.fatal); }
      if (!e.target.bot) { this.damageUntil = match.time + .48; this.lastSource = e.source; }
    } else if (e.type === 'empty' && !e.actor.bot && !e.actor.ammo[e.actor.gun].reserve) {
      this.note.textContent = '弹药耗尽 · 按 1 / 2 切枪'; this.noteUntil = match.time + 1.25;
    }
  }

  update(match: Match) {
    const p = match.player, ammo = p.ammo[p.gun];
    const mag = weapons[p.gun];
    const time = match.time;
    text(this.blue, String(match.score[0]).padStart(2, '0'));
    text(this.red, String(match.score[1]).padStart(2, '0'));
    text(this.clock, match.practice ? '练枪' : timeString(Math.ceil(match.remaining)));
    text(this.goal, match.practice ? '靶手自动复活' : `目标 ${match.setup.target}`);
    text(this.health, String(p.hp)); text(this.armor, String(p.armor)); this.hp.style.width = p.hp + '%';
    text(this.ammo, String(ammo.loaded).padStart(2, '0')); text(this.spare, ' / ' + ammo.reserve);
    text(this.weapon, mag.name); text(this.inventory, `手雷 ${p.grenades} · ${p.gun === 'm9' ? '副武器' : '主武器'}`);
    this.progress.hidden = !p.reloadUntil || !p.hp;
    this.progressBar.style.width = `${100 * (1 - (p.reloadUntil - time) / mag.reload)}%`;
    text(this.place, p.pos.y > 1.6 && p.pos.x < -10.5 ? '左舷高架' : match.location.label);
    this.reticle.hidden = !p.hp;
    this.reticle.style.setProperty('--gap', `${(p.ads ? 4 : 7) + Math.round(p.moving * 1.1 + p.recoil * 86)}px`);
    this.hit.style.opacity = String(Math.min(1, Math.max(0, (this.hitUntil - time) / .12)));
    const hurt = Math.max(0, (this.damageUntil - time) / .48);
    this.damage.style.opacity = String(hurt * .82);
    this.direction.style.opacity = String(hurt);
    if (this.lastSource && hurt) this.direction.style.transform = `rotate(${p.yaw - lookAt(p.pos, this.lastSource).yaw}rad)`;
    if (time > this.noteUntil) this.note.textContent = '';
    for (const [item, until] of this.timetable) if (time > until) { item.remove(); this.timetable.delete(item); }
    this.callout.hidden = !!p.hp;
    if (!p.hp) {
      text(this.callout.querySelector('strong')!, '阵亡');
      text(this.callout.querySelector('span')!, `${Math.max(0, p.respawnAt - time).toFixed(1)} 秒后重返战场`);
    }
    if (p.hp && p.safeUntil > time && !this.note.textContent) {
      this.note.textContent = '复活保护';
      this.noteUntil = p.safeUntil;
    } else if (p.safeUntil <= time && this.note.textContent === '复活保护') this.note.textContent = '';
    if (time >= this.mapAt) { this.drawMap(match); this.mapAt = time + .07; }
    if (!this.board.hidden && time >= this.boardAt) {
      table(this.board.querySelector('.table-wrap')!, match); this.boardAt = time + .28;
    }
  }
}
