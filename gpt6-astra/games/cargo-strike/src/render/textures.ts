import * as THREE from 'three';
import { randomSeed } from '../game/math';
const rng = randomSeed(84321);
export function canvasTexture(draw: (c: CanvasRenderingContext2D, s: number) => void, size = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const c = canvas.getContext('2d')!;
    draw(c, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
function grain(c: CanvasRenderingContext2D, s: number, count: number) {
    for (let i = 0; i < count; i++) {
        const light = rng() > .5;
        c.fillStyle = light ? `rgba(255,255,235,${rng() * .08})` : `rgba(9,12,8,${rng() * .15})`;
        c.fillRect(rng() * s, rng() * s, rng() * 3 + 1, rng() * 3 + 1);
    }
}
export function surface(kind: 'deck' | 'wood' | 'metal' | 'concrete'): THREE.CanvasTexture {
    return canvasTexture((c, s) => {
        c.fillStyle = { deck: '#798080', wood: '#887354', metal: '#9da59a', concrete: '#969b93' }[kind];
        c.fillRect(0, 0, s, s);
        grain(c, s, kind === 'wood' ? 18000 : 26000);
        if (kind === 'deck') {
            c.strokeStyle = '#495152';
            c.lineWidth = 3;
            c.strokeRect(1, 1, s - 2, s - 2);
            c.beginPath();
            c.moveTo(0, s / 2);
            c.lineTo(s, s / 2);
            c.stroke();
            for (let x = 12; x < s; x += 54)
                for (const y of [12, s / 2 - 12, s / 2 + 12, s - 12]) {
                    c.fillStyle = '#a3aaa7';
                    c.beginPath();
                    c.arc(x, y, 3, 0, Math.PI * 2);
                    c.fill();
                    c.fillStyle = '#485354';
                    c.fillRect(x - 1, y, 2, 2);
                }
            for (let i = 0; i < 150; i++) {
                c.strokeStyle = `rgba(34,43,40,${rng() * .2})`;
                const x = rng() * s, y = rng() * s;
                c.beginPath();
                c.moveTo(x, y);
                c.lineTo(x + rng() * 90, y + rng() * 3);
                c.stroke();
            }
        }
        if (kind === 'wood') {
            for (let i = 0; i < 8; i++) {
                const y = i * 64;
                c.fillStyle = `rgba(15,12,7,${.05 + rng() * .12})`;
                c.fillRect(0, y, s, 64);
                c.fillStyle = '#443b2e';
                c.fillRect(0, y, s, 3);
                for (let j = 0; j < 55; j++) {
                    c.strokeStyle = `rgba(${rng() > .5 ? '221,200,148' : '45,35,21'},${rng() * .25})`;
                    c.lineWidth = rng() * 2;
                    c.beginPath();
                    const yy = y + rng() * 64;
                    c.moveTo(0, yy);
                    c.bezierCurveTo(170, yy - 6, 250, yy + 6, s, yy);
                    c.stroke();
                }
            }
            for (const x of [12, s - 12])
                for (let y = 20; y < s; y += 64) {
                    c.fillStyle = '#343833';
                    c.beginPath();
                    c.arc(x, y, 3, 0, 7);
                    c.fill();
                }
            c.fillStyle = 'rgba(29,31,24,.65)';
            c.font = 'bold 36px monospace';
            c.fillText('↑  ↑  FRAGILE', 70, 230);
            c.font = '19px monospace';
            c.fillText('NET WT.  1,240 KG', 70, 265);
        }
        if (kind === 'metal') {
            for (let x = 0; x < s; x += 32) {
                const grad = c.createLinearGradient(x, 0, x + 32, 0);
                grad.addColorStop(0, '#151d1530');
                grad.addColorStop(.18, '#ecf4d82b');
                grad.addColorStop(.3, '#e8edda13');
                grad.addColorStop(.7, '#1c231a08');
                grad.addColorStop(1, '#0c170b3f');
                c.fillStyle = grad;
                c.fillRect(x, 0, 32, s);
            }
            for (let i = 0; i < 160; i++) {
                const x = rng() * s, y = rng() > .5 ? rng() * 30 : s - rng() * 38;
                c.fillStyle = `rgba(90,48,23,${rng() * .5})`;
                c.fillRect(x, y, rng() * 5 + 1, rng() * 35);
            }
            c.strokeStyle = '#222d2460';
            c.lineWidth = 8;
            c.strokeRect(0, 0, s, s);
        }
        if (kind === 'concrete') {
            for (let i = 0; i < 40; i++) {
                c.fillStyle = '#36413a12';
                c.fillRect(rng() * s, rng() * s, rng() * 100, rng() * 6);
            }
        }
    });
}
export function labelTexture(text: string, small = 'INTERNATIONAL SHIPPING • 22G1'): THREE.CanvasTexture {
    return canvasTexture((c, s) => { c.clearRect(0, 0, s, s); c.fillStyle = '#e6dfbf'; c.font = 'bold 74px Arial'; c.fillText(text, 25, 250); c.font = '19px monospace'; c.fillText(small, 28, 286); c.fillRect(28, 307, 100, 5); }, 512);
}
