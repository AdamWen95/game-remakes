import { cars, clamp, mix, ROAD_HALF, WALL, wrap, type CarSpec, type Track } from './track.ts';

export type Mode = 'race' | 'trial';
export type Difficulty = 'normal' | 'expert';
export type Controls = { steer: number; gas: boolean; brake: boolean; drift: boolean; boost: boolean; reset: boolean };
export const neutral: Controls = { steer: 0, gas: false, brake: false, drift: false, boost: false, reset: false };
export const LAPS = 2;
export const STEP = 1 / 120;

export type Driver = {
  id: number; name: string; spec: CarSpec; paint: string;
  s: number; lane: number; targetLane: number; speed: number; yaw: number; side: number;
  lap: number; splits: number[]; lapAt: number; finish: number | null;
  drift: number; charge: number; boost: number; impact: number; pad: number;
};

const grid = [
  ['陆小野', '#ef685f'], ['岑霁', '#66b9ee'], ['白栀', '#ebeee8'],
  ['陶野', '#af86f4'], ['林一川', '#70d6a4'],
] as const;

function driver(id: number, spec: CarSpec, name: string, paint: string, s: number, lane: number): Driver {
  return {
    id, spec, name, paint, s, lane, targetLane: lane, speed: 0, yaw: 0, side: 0,
    lap: 0, splits: [], lapAt: 0, finish: null, drift: 0, charge: 0, boost: 0, impact: 0, pad: 0,
  };
}

export class Race {
  readonly track: Track;
  readonly mode: Mode;
  readonly difficulty: Difficulty;
  readonly player: Driver;
  readonly drivers: Driver[];
  readonly events = new Set<'drift' | 'mini' | 'nitro' | 'pad' | 'hit' | 'lap' | 'ready' | 'reset'>();
  time = 0;

  constructor(track: Track, spec: CarSpec, mode: Mode, difficulty: Difficulty) {
    this.track = track;
    this.mode = mode;
    this.difficulty = difficulty;
    this.player = driver(0, spec, '你', spec.color, mode === 'race' ? -21 : -10, mode === 'race' ? -3.7 : 0);
    this.drivers = [this.player];
    if (mode === 'race') {
      grid.forEach(([name, paint], i) => {
        this.drivers.push(driver(i + 1, cars[(i + 1) % cars.length], name, paint, -6 - Math.floor(i / 2) * 7, i % 2 === 0 ? 3.7 : -3.7));
      });
    }
  }

  get standings() {
    return [...this.drivers].sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.s - a.s);
  }

  tick(input: Controls, dt: number) {
    this.events.clear();
    if (this.player.finish !== null) return;
    this.time += dt;
    for (const car of this.drivers) {
      car.boost = Math.max(0, car.boost - dt);
      car.impact = Math.max(0, car.impact - dt);
      car.pad = Math.max(0, car.pad - dt);
      const previous = car.s;
      if (car.id === 0) this.drivePlayer(car, input, dt);
      else this.driveOpponent(car, dt);
      this.crossTimingLines(car, previous, dt);
    }
    this.applyContacts();
  }

  private drivePlayer(car: Driver, input: Controls, dt: number) {
    if (input.reset) {
      car.lane = car.yaw = car.side = car.drift = car.boost = 0;
      car.speed = Math.min(car.speed * .35, 17);
      car.impact = .48;
      this.events.add('reset');
    }
    if (input.boost && car.charge >= 100) {
      car.charge -= 100;
      car.boost = 2.45;
      this.events.add('nitro');
    }
    const road = this.track.sample(car.s);
    const canDrift = input.drift && Math.abs(input.steer) > .1 && car.speed > 17 && !input.brake;
    if (canDrift) {
      if (car.charge < 200) {
        const alreadyReady = Math.floor(car.charge / 100);
        car.charge = Math.min(200, car.charge + dt * (22 + car.speed * .43 + Math.abs(road.curve) * 280));
        if (Math.floor(car.charge / 100) > alreadyReady) this.events.add('ready');
      }
      if (!car.drift) this.events.add('drift');
      car.drift += dt;
    } else if (car.drift > 0) {
      if (!input.drift && car.drift >= .45 && car.impact <= 0) {
        car.boost = Math.max(car.boost, .62);
        this.events.add('mini');
      }
      car.drift = 0;
    }
    const throttle = input.gas && !input.brake;
    const boost = car.boost > 0;
    const shoulder = Math.abs(car.lane) > ROAD_HALF;
    const top = car.spec.top + (boost ? 17 : 0);
    const power = (throttle ? car.spec.acceleration * (1 - .66 * clamp(car.speed / top, 0, 1)) : -6.5)
      + (boost ? 21 : 0) - (input.brake ? 27 : 0) - (canDrift ? 3.3 : 0) - (shoulder ? 14 : 0);
    car.speed = clamp(car.speed + (car.speed > top ? -19 : power) * dt, 0, car.spec.top + 17);
    const steering = input.steer * car.spec.grip * (canDrift ? 2.65 : 1.8);
    // Follow part of the road's curvature so small corrections hold a line on a gamepad or keys.
    const turn = clamp(road.curve * car.speed, -1.45, 1.45);
    const assist = input.steer * turn >= 0 ? .72 : .66;
    car.yaw += (steering - turn * (1 - assist) - car.yaw * (canDrift ? 3.7 : 5.3)) * dt;
    car.yaw = clamp(car.yaw, -.72, .72);
    const slip = canDrift ? -input.steer * Math.min(8.2, car.speed * .16) : 0;
    car.side = mix(car.side, Math.sin(car.yaw) * car.speed + slip, 1 - Math.exp(-dt * (canDrift ? 5 : 9)));
    car.lane += car.side * dt;
    if (Math.abs(car.lane) > WALL) {
      const side = Math.sign(car.lane);
      car.lane = side * (WALL - .24);
      car.yaw = car.yaw * .36 - .095 * side;
      car.side *= -.48;
      if (car.impact < .02) this.hit(car, .66);
    }
    // Offset lanes have different path lengths on curves. This keeps progress and speed consistent.
    const laneScale = clamp(1 - road.curve * car.lane, .62, 1.45);
    car.s += car.speed * Math.cos(car.yaw) * dt / laneScale;
    this.applyPads(car);
  }

  private driveOpponent(car: Driver, dt: number) {
    const track = this.track;
    if (car.finish !== null) {
      car.speed = Math.max(0, car.speed - 12 * dt);
      car.s += car.speed * dt;
      car.yaw = 0;
      car.drift = 0;
      return;
    }
    const bends = Math.max(Math.abs(track.sample(car.s + 13).curve), Math.abs(track.sample(car.s + 31).curve));
    const wave = Math.sin(car.s / 104 + car.id * 1.28);
    const difficulty = this.difficulty === 'expert' ? 1.15 : .95;
    const desired = difficulty * (56 + (6 - car.id) * 1.38 + wave * 3.6) / (1 + bends * 16);
    car.speed += clamp(desired - car.speed, -28 * dt, (14.5 + car.id * .7) * dt);
    car.s += (car.speed + (car.boost > 0 ? 10 : 0)) * dt / clamp(1 - track.sample(car.s).curve * car.lane, .65, 1.42);
    if (Math.abs(car.lane - car.targetLane) < 1.9) {
      const blocked = this.drivers.some(other => other !== car && other.s > car.s
        && other.s < car.s + 12 && Math.abs(other.lane - car.lane) < 3.25 && other.speed + 1.5 < car.speed);
      if (blocked) car.targetLane = car.lane > 0 ? -4.1 : 4.1;
    }
    const curve = track.sample(car.s + 17).curve;
    const oldLane = car.lane;
    car.lane = mix(car.lane, clamp(car.targetLane + 1.75 * wave + curve * 61, -7.9, 7.9), dt * 1.35);
    car.yaw = (car.lane - oldLane) * .56 + clamp(curve * 7.4, -.28, .28);
    car.drift = Math.abs(curve) > .021 && car.speed > 28 ? 1 : 0;
    this.applyPads(car);
  }

  private crossTimingLines(car: Driver, previous: number, dt: number) {
    if (car.finish !== null || car.s <= previous) return;
    const lap = Math.floor(car.s / this.track.length);
    if (car.lap >= lap) return;
    const crossing = this.time - dt * (car.s - lap * this.track.length) / (car.s - previous);
    car.splits.push(crossing - car.lapAt);
    car.lapAt = crossing;
    car.lap = lap;
    if (lap >= LAPS) car.finish = crossing;
    else if (car.id === 0) this.events.add('lap');
  }

  private applyPads(car: Driver) {
    if (car.pad > 0) return;
    const s = wrap(car.s, this.track.length);
    for (const [fraction, lane] of this.track.course.pads) {
      const distance = s - fraction * this.track.length;
      if (distance >= -3 && distance <= 5 && Math.abs(car.lane - lane) < 2.45) {
        car.pad = 1.45;
        car.boost = Math.max(car.boost, .83);
        if (car.id === 0) this.events.add('pad');
        return;
      }
    }
  }

  private applyContacts() {
    for (let i = 0; i < this.drivers.length; i++) {
      const a = this.drivers[i];
      for (let j = i + 1; j < this.drivers.length; j++) {
        const b = this.drivers[j];
        const ds = wrap(a.s - b.s + this.track.length / 2, this.track.length) - this.track.length / 2;
        const dx = a.lane - b.lane;
        if (Math.abs(ds) > 4 || Math.abs(dx) >= 2.65 || a.impact > 0 || b.impact > 0 || a.finish !== null || b.finish !== null) continue;
        const sign = Math.sign(dx) || (a.lane < .1 ? -1 : 1);
        if (a.id === 0) a.side += sign * 6.8;
        else a.lane = clamp(a.lane + sign * .63, -WALL, WALL);
        b.lane = clamp(b.lane - sign * .63, -WALL, WALL);
        const impact = a.id === 0 ? .80 : .93;
        const graze = a.id === 0 ? .91 : .975;
        this.hit(a, ds < 0 ? impact : graze);
        this.hit(b, ds > 0 ? impact : graze);
      }
    }
  }

  private hit(car: Driver, retention: number) {
    car.speed *= retention;
    car.drift = 0;
    car.boost = 0;
    car.impact = .42;
    if (car.id === 0) this.events.add('hit');
  }
}

export function clock(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
