import Phaser from 'phaser';
import { characterSvg, svgData } from './characters';

export const THEMES = [
  { name: '薄荷花园', subtitle: '微风、青草和一点小惊喜', color: '#80b6a0', floor: ['#c0dcb1', '#c8e2ba'], wall: '#5a9d78', light: '#8ac298', crate: '#dba978', edge: '#9f7452', bg: '#b5d6bd' },
  { name: '桃桃糖镇', subtitle: '今天的对决，是蜜桃味的', color: '#d59694', floor: ['#efd8c4', '#f5e1cd'], wall: '#c8899f', light: '#e3aabe', crate: '#f0bc83', edge: '#bc876b', bg: '#eac8b8' },
  { name: '星光营地', subtitle: '在星星睡着之前，赢一场', color: '#909bc8', floor: ['#bfc8de', '#c9d2e6'], wall: '#7d87b1', light: '#a2b0d7', crate: '#c9acd6', edge: '#947ea9', bg: '#b0bdd5' },
] as const;

export function preloadCharacters(scene: Phaser.Scene) {
  for (let i = 0; i < 4; i++) {
    scene.load.svg(`actor-${i}`, svgData(characterSvg(i)), { width: 192, height: 216 });
    scene.load.svg(`back-${i}`, svgData(characterSvg(i, true)), { width: 192, height: 216 });
  }
}

function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!; ctx.scale(2, 2); draw(ctx); scene.textures.addCanvas(key, canvas);
}
function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

export function createTextures(scene: Phaser.Scene) {
  THEMES.forEach((theme, t) => {
    for (let v = 0; v < 2; v++) texture(scene, `floor-${t}-${v}`, 48, 48, c => {
      c.fillStyle = theme.floor[v]; c.fillRect(0, 0, 48, 48);
      c.fillStyle = '#ffffff18'; c.fillRect(0, 0, 48, 1); c.fillRect(0, 0, 1, 48);
      c.strokeStyle = t === 2 ? '#ffffff40' : '#729c6b32'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(9, 35); c.lineTo(8, 31); c.moveTo(9, 35); c.lineTo(12, 32); c.stroke();
      ellipse(c, 36, 12, 1.1, 1.1, '#ffffff40');
    });
    texture(scene, `wall-${t}`, 48, 58, c => {
      ellipse(c, 25, 49, 22, 7, '#254d4427');
      round(c, 3, 13, 42, 38, 12, theme.wall);
      round(c, 3, 6, 42, 36, 11, theme.light);
      if (t === 0) {
        ellipse(c, 13, 18, 10, 11, theme.light); ellipse(c, 31, 13, 13, 11, theme.light);
        ellipse(c, 16, 15, 7, 4, '#b7dfad80'); ellipse(c, 31, 28, 7, 6, '#609c6c40');
        c.strokeStyle = '#538c6b60'; c.lineWidth = 2; c.beginPath(); c.moveTo(12, 31); c.quadraticCurveTo(17, 34, 22, 31); c.stroke();
      } else if (t === 1) {
        c.strokeStyle = '#f8d4d8'; c.lineWidth = 5; c.beginPath(); c.moveTo(11, 10); c.lineTo(35, 34); c.moveTo(26, 7); c.lineTo(42, 23); c.stroke();
      } else {
        c.fillStyle = '#cedaf5'; c.beginPath(); c.moveTo(24, 10); c.lineTo(34, 25); c.lineTo(24, 36); c.lineTo(14, 25); c.fill();
        c.fillStyle = '#eef2ff'; c.beginPath(); c.moveTo(24, 10); c.lineTo(24, 36); c.lineTo(14, 25); c.fill();
      }
      c.strokeStyle = '#ffffff45'; c.lineWidth = 2; c.beginPath(); c.moveTo(13, 9); c.lineTo(34, 9); c.stroke();
    });
    texture(scene, `crate-${t}`, 48, 56, c => {
      ellipse(c, 24, 48, 21, 6, '#355b4627');
      round(c, 4, 11, 40, 39, 6, theme.edge); round(c, 4, 6, 40, 38, 5, theme.crate);
      round(c, 8, 10, 32, 29, 3, t === 0 ? '#eabe8c' : t === 1 ? '#f8dba4' : '#dfc6e4');
      c.strokeStyle = `${theme.edge}88`; c.lineWidth = 1.4;
      for (const y of [20, 30]) { c.beginPath(); c.moveTo(9, y); c.lineTo(39, y); c.stroke(); }
      if (t === 0) {
        round(c, 10, 10, 5, 29, 1, '#f3cfa0'); round(c, 33, 10, 5, 29, 1, '#f3cfa0');
        ellipse(c, 24, 25, 6, 7, '#f5ddae');
        c.strokeStyle = '#b68e52'; c.beginPath(); c.moveTo(24, 30); c.lineTo(24, 20); c.stroke();
        ellipse(c, 22, 22, 3, 1.5, '#7eaa73'); ellipse(c, 27, 20, 3, 1.5, '#7eaa73');
      } else {
        round(c, 21, 7, 6, 36, 1, '#fff0d880'); round(c, 5, 21, 38, 5, 1, '#fff0d880');
        ellipse(c, 20, 23, 6, 4, '#f5e5de'); ellipse(c, 29, 23, 6, 4, '#f5e5de');
      }
      for (const x of [11, 37]) for (const y of [13, 36]) ellipse(c, x, y, 1, 1, theme.edge);
    });
  });
  texture(scene, 'bubble', 52, 56, c => {
    ellipse(c, 26, 49, 21, 5, '#24554e30');
    const gradient = c.createRadialGradient(19, 18, 2, 27, 29, 24);
    gradient.addColorStop(0, '#d4fff9'); gradient.addColorStop(.45, '#7edecf'); gradient.addColorStop(1, '#309f9e');
    ellipse(c, 26, 28, 22, 22, gradient as unknown as string);
    c.strokeStyle = '#207f80'; c.lineWidth = 1.5; c.beginPath(); c.arc(26, 28, 22, 0, Math.PI * 2); c.stroke();
    ellipse(c, 18, 18, 8, 4.5, '#ffffffc0'); ellipse(c, 36, 37, 4, 2, '#c7fff3aa');
    round(c, 21, 3, 10, 7, 3, '#f4d696');
    c.strokeStyle = '#557759'; c.lineWidth = 2; c.beginPath(); c.moveTo(26, 5); c.quadraticCurveTo(28, -2, 34, 2); c.stroke();
  });
  const icons: Record<string, string> = { bomb: '●', range: '✦', speed: 'ϟ' };
  const colors: Record<string, string> = { bomb: '#91d9c4', range: '#f0c670', speed: '#b5ade0' };
  for (const kind of ['bomb', 'range', 'speed']) texture(scene, `power-${kind}`, 40, 44, c => {
    ellipse(c, 20, 39, 14, 4, '#335e4520'); round(c, 3, 5, 34, 32, 11, '#ffffff');
    round(c, 6, 7, 28, 26, 8, colors[kind]);
    c.fillStyle = '#fff'; c.font = 'bold 24px sans-serif'; c.textAlign = 'center'; c.fillText(icons[kind], 20, 29);
    ellipse(c, 11, 12, 3, 1.5, '#ffffff80');
  });
}
