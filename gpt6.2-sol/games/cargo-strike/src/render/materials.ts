import * as T from 'three';
import type { Surface } from '../arena.ts';

function paint(size: number, paintCanvas: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  paintCanvas(context);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function randomizer(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const colors = { teal: '#397579', navy: '#31465f', rust: '#974a37', cream: '#9fa6a0', steel: '#4d5960', grate: '#60696b', rail: '#dab548' };

function worn(color: string, kind: 'steel' | 'wood' | 'deck') {
  return paint(512, c => {
    const rand = randomizer(1339);
    const wood = kind === 'wood', deck = kind === 'deck';
    c.fillStyle = color; c.fillRect(0, 0, 512, 512);
    const grain = c.getImageData(0, 0, 512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const p = (y * 512 + x) * 4;
        const n = (rand() - .5) * (wood ? 31 : 22) + 3 * Math.sin(x * .038) * Math.sin(y * .027);
        for (let i = 0; i < 3; i++) grain.data[p + i] += n;
      }
    }
    c.putImageData(grain, 0, 0);
    for (let i = 0; i < 1700; i++) {
      const x = rand() * 512, y = rand() * 512;
      c.fillStyle = wood ? `rgba(52,28,14,${rand() * .23})` : `rgba(54,34,25,${rand() * .24})`;
      c.fillRect(x, y, wood ? 1 + rand() * 77 : rand() * 2.6, wood ? 1 + rand() * 2.3 : rand() * 59);
      if (i % 4 === 0 && !wood) {
        c.fillStyle = 'rgba(226,224,196,.13)';
        c.fillRect(x + 1, y, 1, 1 + rand() * 9);
      }
    }
    if (wood) {
      for (let y = 0; y < 512; y += 80) {
        c.fillStyle = '#553923'; c.fillRect(0, y, 512, 3);
        c.fillStyle = '#af8a56'; c.fillRect(0, y + 3, 512, 2);
      }
    }
    if (deck) {
      c.fillStyle = '#303e43'; c.fillRect(0, 0, 4, 512); c.fillRect(0, 0, 512, 4);
      c.fillStyle = '#898c83'; c.fillRect(4, 0, 2, 512); c.fillRect(0, 4, 512, 2);
      for (let i = 20; i < 512; i += 32) {
        c.fillStyle = '#2d373a'; c.fillRect(i, 9, 3, 3); c.fillRect(9, i, 3, 3);
        c.fillStyle = '#7f877e'; c.fillRect(i, 10, 2, 1); c.fillRect(9, i + 1, 2, 1);
      }
      for (let i = 0; i < 53; i++) {
        const x = rand() * 512, y = rand() * 512, r = 5 + rand() * 40;
        const spot = c.createRadialGradient(x, y, 1, x, y, r);
        spot.addColorStop(0, rand() > .43 ? '#363a3b36' : '#85482343');
        spot.addColorStop(1, '#68594f00');
        c.fillStyle = spot;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  });
}

const standard = (color: string, roughness = .76, metalness = .12) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });

export function pallet() {
  const metal = Object.fromEntries(Object.entries(colors).map(([name, color]) =>
    [name, new T.MeshStandardMaterial({ map: worn(color, 'steel'), roughness: .76, metalness: .23 })])) as Record<Exclude<Surface, 'wood'>, T.MeshStandardMaterial>;
  const deck = worn('#666e70', 'deck');
  deck.wrapS = deck.wrapT = T.RepeatWrapping;
  deck.repeat.set(12, 26);
  const wood = new T.MeshStandardMaterial({ map: worn('#806648', 'wood'), roughness: .93 });
  return {
    ...metal, wood,
    deck: new T.MeshStandardMaterial({ map: deck, bumpMap: deck, bumpScale: .025, roughness: .77, metalness: .28 }),
    edge: standard('#3b4447'), rail: standard('#d9ac45', .55, .27),
    dark: standard('#242f35'), pale: standard('#b7b9ad'), glass: standard('#234653', .3, .52),
    plank: standard('#a07c49', .91), bolt: standard('#353e40', .5, .35),
    safety: standard('#dcb447', .9), white: standard('#abb7ad'), orange: standard('#915332'),
    red: standard('#682c2a'), blue: standard('#395f7c'),
    lamp: new T.MeshBasicMaterial({ color: '#ffca76' }),
  };
}
export type Pallet = ReturnType<typeof pallet>;

export function sign(line: string, detail: string, color: string) {
  const map = paint(512, c => {
    c.clearRect(0, 0, 512, 512);
    c.font = 'bold 57px monospace'; c.fillStyle = color; c.fillText(line, 34, 238, 443);
    c.font = '23px monospace'; c.fillText(detail, 38, 286);
    c.fillRect(36, 304, 103, 6);
    const rand = randomizer(61);
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 240; i++) c.fillRect(rand() * 512, 185 + rand() * 127, rand() * 6, rand() * 3);
  });
  return new T.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
}
