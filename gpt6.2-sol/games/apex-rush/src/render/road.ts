import * as T from 'three';
import { ROAD_HALF, WALL, type Track } from '../track.ts';
import { batch, box, glow, lit, prop, texture, random } from './mesh.ts';
import { moods } from './terrain.ts';

function strip(track: Track, offsets: number[], height: number,
  paint: (i: number, across: number) => T.ColorRepresentation) {
  const geometry = new T.BufferGeometry();
  const coords: number[] = [];
  const shades: number[] = [];
  const uv: number[] = [];
  const faces: number[] = [];
  const width = offsets.length;
  const color = new T.Color();
  for (let i = 0; i <= track.segments; i++) {
    const s = i * track.interval;
    offsets.forEach((offset, j) => {
      const p = track.sample(s, offset);
      coords.push(p.x, p.y + height, p.z);
      color.set(paint(i, j));
      shades.push(color.r, color.g, color.b);
      uv.push(offset / 5, s / 5);
      if (i < track.segments && j < width - 1) {
        const index = i * width + j;
        faces.push(index, index + width, index + 1, index + 1, index + width, index + width + 1);
      }
    });
  }
  geometry.setAttribute('position', new T.Float32BufferAttribute(coords, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

export function road(scene: T.Scene, track: Track) {
  const mood = moods[track.course.id];
  const night = track.course.id === 'metro';
  const rng = random(9153);
  const grit = texture(128, 128, context => {
    const pixels = context.createImageData(128, 128);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const shade = 231 - Math.round(rng() ** 2 * 59);
      pixels.data.set([shade, shade, shade, 255], i);
    }
    context.putImageData(pixels, 0, 0);
  });
  grit.wrapS = grit.wrapT = T.RepeatWrapping;
  const asphalt = new T.MeshStandardMaterial({ map: grit, color: '#c7c7cb', roughness: .81, vertexColors: true });
  scene.add(new T.Mesh(strip(track, [-WALL, -ROAD_HALF, -7, -3.5, 0, 3.5, 7, ROAD_HALF, WALL], 0,
    (_, j) => j === 0 || j === 8 ? '#787980' : ['#565b61', '#5b6068', '#565a64'][j % 3]), asphalt));

  const rails = lit(night ? '#334757' : '#958573');
  const pillars: [number, number, number, number, number, number, number][] = [];
  const posts: typeof pillars = [];
  const marks: typeof pillars = [];
  const curbA: typeof pillars = [];
  const curbB: typeof pillars = [];
  const emissive: typeof pillars = [];
  const chevrons: typeof pillars = [];
  for (const side of [-1, 1]) {
    const edge = side * WALL;
    const offsets = [edge - .23, edge + .23];
    const barrier = strip(track, offsets, 1.05, () => mood.rail);
    scene.add(new T.Mesh(barrier, new T.MeshStandardMaterial({ vertexColors: true, roughness: .64, side: T.DoubleSide })));
    const edgeLine = strip(track, [side * ROAD_HALF - .105, side * ROAD_HALF + .105], .019, () => '#f4e5ca');
    scene.add(new T.Mesh(edgeLine, new T.MeshBasicMaterial({ vertexColors: true })));
    for (let i = 0; i < track.segments; i++) {
      const s = track.interval * i;
      const p = track.sample(s, side * (ROAD_HALF + .59));
      const curb = i % 4 < 2 ? curbA : curbB;
      curb.push([p.x, p.y + .05, p.z, .94, .12, track.interval + .05, p.yaw]);
      const guard = track.sample(s, edge);
      if (i % 3 === 0) posts.push([guard.x, guard.y + .49, guard.z, .24, 1.05, .27, guard.yaw]);
      if (i % 7 === 1) {
        emissive.push([guard.x, guard.y + 1.19, guard.z, .23, .135, 1.16, guard.yaw]);
        if (night) emissive.push([p.x, p.y + .135, p.z, .24, .09, 1.3, p.yaw]);
      }
      if (i % 10 === 2 && side * p.curve < -.012) {
        chevrons.push([guard.x, guard.y + 1.86, guard.z, 2.4, 1.04, 1, guard.yaw + (side > 0 ? -1 : 1) * Math.PI / 2]);
      }
    }
  }

  for (let i = 0; i < track.segments; i += 3) {
    const p = track.samples[i];
    marks.push([p.x, p.y + .021, p.z, .12, .024, 2.5, p.yaw]);
    if (i % 18 === 0) pillars.push([p.x, (p.y - 1) / 2, p.z, 5.1, p.y + 1, 3, p.yaw]);
  }
  batch(scene, box, rails, posts);
  batch(scene, box, rails, pillars);
  batch(scene, box, lit('#ebe0c8'), curbA);
  batch(scene, box, lit(mood.paint), curbB);
  batch(scene, box, glow(mood.paint), emissive);
  batch(scene, box, lit('#888789'), marks);
  const arrow = texture(128, 64, ctx => {
    ctx.fillStyle = '#171b22';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = mood.paint;
    for (const x of [12, 46, 80]) {
      ctx.beginPath();
      ctx.moveTo(x, 9);
      ctx.lineTo(x + 17, 9);
      ctx.lineTo(x + 37, 32);
      ctx.lineTo(x + 17, 55);
      ctx.lineTo(x, 55);
      ctx.lineTo(x + 20, 32);
      ctx.fill();
    }
  });
  // The plane faces the passing car from both shoulders.
  batch(scene, new T.PlaneGeometry(), new T.MeshBasicMaterial({ map: arrow, side: T.DoubleSide }), chevrons);

  for (const [fraction, lane] of track.course.pads) addPad(scene, track, fraction, lane, mood.paint);
  gantry(scene, track, rails, mood.paint);
}

function addPad(parent: T.Object3D, track: Track, fraction: number, lane: number, tint: string) {
  const s = fraction * track.length + .8;
  const p = track.sample(s, lane);
  const pad = new T.Group();
  pad.position.set(p.x, p.y + .055, p.z);
  pad.rotation.y = p.yaw;
  parent.add(pad);
  prop(pad, box, lit('#253b41'), 0, 0, 0, 4.85, .12, 8.3);
  const tube = glow(tint);
  for (const side of [-1, 1]) {
    prop(pad, box, tube, side * 2.3, .07, 0, .12, .06, 8.2);
    for (const z of [-2.65, 0, 2.65]) {
      prop(pad, box, tube, side * .92, .076, z, .24, .08, 2.3, side * -.88);
    }
  }
}

function gantry(parent: T.Object3D, track: Track, metal: T.Material, tint: string) {
  const p = track.sample(0);
  const gate = new T.Group();
  gate.position.set(p.x, p.y, p.z);
  gate.rotation.y = p.yaw;
  parent.add(gate);
  const dark = lit('#252822', .38, .24);
  const accent = glow(tint);
  for (const side of [-1, 1]) {
    prop(gate, box, metal, side * 12.45, 3.4, 0, .92, 7.0, 1.34);
    prop(gate, box, accent, side * 12.0, 3.8, -.66, .17, 5.45, .14);
  }
  prop(gate, box, dark, 0, 6.7, 0, 25.3, 1.95, 1.21);
  prop(gate, box, accent, 0, 5.73, -.04, 25.6, .17, 1.55);
  const face = texture(1024, 96, ctx => {
    ctx.fillStyle = '#191d1d';
    ctx.fillRect(0, 0, 1024, 96);
    ctx.textAlign = 'center';
    ctx.font = '900 italic 61px Arial';
    ctx.fillStyle = '#fff4dc';
    ctx.fillText('A P E X   R U S H', 512, 70);
    ctx.fillStyle = tint;
    for (let x = 33; x < 295; x += 34) ctx.fillRect(x, 72 - x * .16, 9, 10);
    for (let x = 743; x < 1000; x += 34) ctx.fillRect(x, 30 + (x - 743) * .16, 9, 10);
  });
  const panel = new T.Mesh(new T.PlaneGeometry(20.7, 1.63), new T.MeshBasicMaterial({ map: face }));
  panel.rotation.y = Math.PI;
  panel.position.set(0, 6.76, -.63);
  gate.add(panel);
  const colors = [lit('#eddbaf'), lit('#26262b')];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 18; col++) {
      const offset = (col - 8.5) * 1.19;
      const tile = track.sample(row * .85, offset);
      prop(parent, box, colors[(row + col) % 2], tile.x, tile.y + .035, tile.z, 1.19, .045, .86, tile.yaw);
    }
  }
  for (const s of [-6, -13, -20]) {
    for (const offset of [-3.7, 3.7]) {
      for (const shift of [-1.64, 1.64]) {
        const p = track.sample(s, offset + shift);
        prop(parent, box, colors[0], p.x, p.y + .039, p.z, .15, .047, 5.4, p.yaw);
      }
    }
  }
}
