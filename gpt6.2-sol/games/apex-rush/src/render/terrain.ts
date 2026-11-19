import * as T from 'three';
import { box, cone, cylinder, stone, prop, lit, glow, batch, random } from './mesh.ts';
import type { Track, TrackId } from '../track.ts';

export const moods = {
  coast: { sky: '#477c9d', horizon: '#ffd6a5', sun: '#fff0c0', fog: '#cbaf99', ambient: '#e0eff6',
    ground: '#528679', cliff: '#b28160', flora: '#496044', bark: '#735744', rail: '#eee0b9', paint: '#ffc04b',
    sunVector: [-.51, .34, .67] },
  canyon: { sky: '#5a6294', horizon: '#f6a98a', sun: '#fff0cf', fog: '#cd9b8c', ambient: '#e3cde7',
    ground: '#815b65', cliff: '#af725e', flora: '#785262', bark: '#7b5262', rail: '#f8cfb1', paint: '#fe7956',
    sunVector: [.55, .33, .63] },
  metro: { sky: '#0a1124', horizon: '#455b83', sun: '#c0e8ff', fog: '#465477', ambient: '#92b6eb',
    ground: '#192639', cliff: '#2b3d56', flora: '#34535b', bark: '#303d50', rail: '#6e89a3', paint: '#63e9ff',
    sunVector: [-.68, .44, .52] },
} as const;
type Mood = typeof moods[TrackId];

export function environment(scene: T.Scene, track: Track) {
  const mood = moods[track.course.id];
  const night = track.course.id === 'metro';
  const sun = new T.Vector3(...mood.sunVector).normalize();
  scene.fog = new T.FogExp2(mood.fog, night ? .0018 : .00146);
  const sky = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: {
      upper: { value: new T.Color(mood.sky) }, horizon: { value: new T.Color(mood.horizon) },
      sunColor: { value: new T.Color(mood.sun) }, sunDirection: { value: sun },
      moon: { value: night ? 1 : 0 },
    },
    vertexShader: 'varying vec3 ray; void main(){ ray = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      varying vec3 ray;
      uniform vec3 upper, horizon, sunColor, sunDirection;
      uniform float moon;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
      }
      void main(){
        vec3 d=normalize(ray);
        float altitude=max(0.,d.y);
        float align=max(0.,dot(d,sunDirection));
        vec3 color=mix(horizon,upper,pow(smoothstep(0.,.82,altitude),.63));
        color=mix(color, sunColor, pow(align,11.) * .28);
        vec2 plane=d.xz/(.22+altitude);
        float cloud=noise(plane*vec2(5.,11.))*.64+noise(plane*vec2(13.,23.))*.23+noise(plane*46.)*.13;
        float haze=smoothstep(.49,.76,cloud)*smoothstep(.02,.15,altitude)*(1.-smoothstep(.45,.8,altitude));
        color=mix(color,sunColor,haze*mix(.54,.12,moon));
        color=mix(color,sunColor,smoothstep(.99895,.99922,align));
        vec2 starGrid=vec2(atan(d.z,d.x),altitude)*240.;
        float stars=step(.993,hash(floor(starGrid)))*(1.-smoothstep(.06,.26,length(fract(starGrid)-.5)));
        color+=vec3(.45,.56,.72)*stars*moon*smoothstep(.08,.35,altitude);
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new T.Mesh(new T.SphereGeometry(1060, 36, 21), sky);
  dome.renderOrder = -10;
  scene.add(dome);
  scene.add(new T.HemisphereLight(mood.ambient, mood.ground, night ? 2.0 : 2.5));
  const light = new T.DirectionalLight(mood.sun, night ? 1.6 : 3.25);
  light.position.copy(sun).multiplyScalar(300);
  scene.add(light);

  const ground = new T.Mesh(new T.PlaneGeometry(3600, 3600), makeGround(track.course.id, mood));
  ground.position.y = track.course.id === 'canyon' ? 4 : 0;
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  if (night) skyline(scene, track, mood);
  else landscape(scene, track, mood);
}

function makeGround(id: TrackId, mood: Mood) {
  if (id !== 'coast') {
    return new T.MeshLambertMaterial({ color: mood.ground });
  }
  const surface = new T.MeshPhongMaterial({
    color: '#357580', emissive: '#102834', specular: '#dce9c1', shininess: 42,
  });
  surface.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 shoreUV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nshoreUV = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 shoreUV;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sea = sin(shoreUV.y * .41 + sin(shoreUV.x * .14) * 2.5)
          + sin(shoreUV.x * .19 - shoreUV.y * .54)
          + sin(shoreUV.y * .96 + shoreUV.x * .13) * .40;
        diffuseColor.rgb *= .91 + sea * .109;
        diffuseColor.rgb += vec3(.14,.21,.24) * smoothstep(1.65, 2.3, sea) * .42;`);
  };
  return surface;
}

function clearance(track: Track, x: number, z: number) {
  let nearest = Infinity;
  for (let i = 0; i < track.samples.length; i += 3) {
    const p = track.samples[i];
    nearest = Math.min(nearest, (p.x - x) ** 2 + (p.z - z) ** 2);
  }
  return Math.sqrt(nearest);
}

function landscape(parent: T.Object3D, track: Track, mood: Mood) {
  const coast = track.course.id === 'coast';
  const rng = random(coast ? 43932 : 73674);
  const cliffs: [number, number, number, number, number, number, number][] = [];
  const layers: typeof cliffs = [];
  const trunks: typeof cliffs = [];
  const needles: typeof cliffs = [];
  const chips: typeof cliffs = [];
  const crystals: typeof cliffs = [];
  for (let n = 0; n < 735; n++) {
    const x = (rng() - .5) * 770;
    const z = (rng() - .5) * 590;
    const room = clearance(track, x, z);
    if (room < 20 || room > 119 || (coast && x > 221 && rng() < .69)) continue;
    const spread = Math.min(room - 16, 10 + rng() * (coast ? 32 : 41));
    const height = (coast ? 9 : 26) + rng() * (coast ? 22 : 57);
    const base = coast ? -5 : 2;
    const mound = rng() < .30;
    if (mound) {
      const yaw = rng() * Math.PI;
      cliffs.push([x, base + height * .12, z, spread, height * .68, spread * .78, yaw]);
      layers.push([x, base + height * .23, z, spread * .999, height * .39, spread * .77, yaw]);
    }
    if (coast || rng() < .18) {
      const h = 4 + rng() * 8;
      const y = mound ? base + height * .40 : base;
      if ((coast && !mound) || rng() < .58) continue;
      trunks.push([x, y + h * .19, z, .18 * h, .52 * h, .18 * h, 0]);
      needles.push([x, y + h * .62, z, h * .34, h * .86, h * .34, rng() * 6.28]);
      needles.push([x, y + h * .98, z, h * .26, h * .58, h * .26, rng() * 6.28]);
    } else {
      const h = 2 + rng() * 8;
      crystals.push([x, base + h, z, h * .32, h * 1.5, h * .32, rng() * 6.28]);
    }
    chips.push([x + 2, base + 4, z - 2, 6, 5, 4, rng() * 6.28]);
  }
  batch(parent, stone, striatedRock(mood.cliff), cliffs);
  batch(parent, stone, striatedRock(coast ? '#c49e75' : '#d78f68'), layers);
  batch(parent, stone, lit(coast ? '#82938b' : '#795e70'), chips);
  batch(parent, cylinder, lit(mood.bark), trunks);
  batch(parent, cone, lit(mood.flora), needles);
  batch(parent, new T.OctahedronGeometry(1, 0), lit('#dc6e78', .32, .13), crystals);

  const peaks: typeof cliffs = [];
  const slopes: typeof cliffs = [];
  for (let i = 0; i < 27; i++) {
    const a = i / 27 * Math.PI * 2;
    if (coast && Math.cos(a) > .52) continue;
    const x = Math.cos(a) * (460 + rng() * 240);
    const z = Math.sin(a) * (395 + rng() * 250);
    const width = 57 + rng() * 77;
    const height = 34 + rng() * (coast ? 60 : 105);
    peaks.push([x, -17, z, width, height, 72 + rng() * 69, a]);
    slopes.push([x - width * .61, -11, z - width * .3, width * .86, height * .72, width * .94, a * 2]);
  }
  batch(parent, stone, lit(coast ? '#8298a0' : '#887083'), peaks);
  batch(parent, stone, lit(coast ? '#788f91' : '#aa7c82'), slopes);
  if (coast) observationRing(parent);
}

function striatedRock(color: string) {
  const material = lit(color);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 cliffPoint;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 rock = vec4(position, 1.);
        #ifdef USE_INSTANCING
          rock = instanceMatrix * rock;
        #endif
        cliffPoint = (modelMatrix * rock).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 cliffPoint;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float seam = cliffPoint.y * 1.38 + cliffPoint.x * .058 + sin(cliffPoint.z * .098) * .41;
        float strata = .14 * sin(seam * .58) + .09 * sin(seam * 2.8) + .08 * sin(seam * .21);
        diffuseColor.rgb *= 1.04 + strata;`);
  };
  return material;
}

function observationRing(parent: T.Object3D) {
  const ring = new T.Group();
  ring.position.set(66, 99, -7);
  ring.rotation.set(Math.PI * .31, -.11, .19);
  const geometry = new T.TorusGeometry(58, 1.23, 6, 84);
  ring.add(new T.Mesh(geometry, lit('#c69a46', .39, .38)));
  const strip = new T.Mesh(new T.TorusGeometry(57.9, .23, 4, 84), glow('#ffcf64'));
  strip.position.z = 1.16;
  ring.add(strip);
  parent.add(ring);
  const sill = lit('#736c52', .65, .22);
  prop(parent, box, sill, 35, 41, -9, 3, 81, 3).rotation.z = -.29;
  prop(parent, box, sill, 93, 42, 15, 3, 85, 3).rotation.z = .22;
}

function skyline(parent: T.Object3D, track: Track, mood: Mood) {
  const rng = random(37819);
  const dark: [number, number, number, number, number, number, number][] = [];
  const blue: typeof dark = [];
  const warm: typeof dark = [];
  const crowns: typeof dark = [];
  for (let n = 0; n < 700; n++) {
    const x = (rng() - .5) * 1220;
    const z = (rng() - .5) * 990;
    const size = 8 + rng() * 25;
    if (clearance(track, x, z) < size + 17) continue;
    const height = 15 + rng() ** 2 * 100;
    dark.push([x, height / 2, z, size, height, size * .69, 0]);
    crowns.push([x, height + .15, z, size * .98, .31, size * .68, 0]);
    const lights = rng() < .22 ? warm : blue;
    for (let floor = 8; floor < height - 2; floor += 5) {
      if (rng() < .24) continue;
      const width = size * (.34 + rng() * .54);
      lights.push([x, floor, z + size * .347, width, .55, .13, 0]);
      lights.push([x, floor, z - size * .347, width, .55, .13, 0]);
      lights.push([x + size * .503, floor, z, .13, .55, width * .68, 0]);
      lights.push([x - size * .503, floor, z, .13, .55, width * .68, 0]);
    }
  }
  batch(parent, box, lit(mood.cliff, .41, .26), dark);
  batch(parent, box, glow('#6b9ec7'), crowns);
  batch(parent, box, glow('#789fd4'), blue);
  batch(parent, box, glow('#e8ab7a'), warm);
}
