import type { Pilot } from '../game/crew.ts';
import type { Direction } from '../game/maps.ts';
import { block, ellipse, fade, spark, stroke, type Brush } from './paint.ts';

function ears(ctx: Brush, pilot: Pilot) {
  if (pilot.type === 'berry') {
    ellipse(ctx, 37, 16, 13, 6, '#5ba456', 0.65);
    ellipse(ctx, 47, 12, 12, 6, '#83c861', -1.42);
    ellipse(ctx, 57, 15, 13, 5, '#a4de70', -0.53);
    return;
  }
  for (const side of [-1, 1]) {
    const x = 48 + 22 * side;
    if (pilot.type === 'frog') {
      ellipse(ctx, x, 19, 11, 11, pilot.dark);
      ellipse(ctx, x, 17, 9, 9, pilot.light);
      ellipse(ctx, x - 1, 16, 4, 5, '#355b39');
      ellipse(ctx, x - 2, 14, 1.5, 1.5, '#fff8ea');
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(x - 10, 31);
    ctx.quadraticCurveTo(x + side * 1, -4, x + side * 7, 10);
    ctx.lineTo(x + 10, 33);
    ctx.fillStyle = pilot.dark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 8, 31);
    ctx.quadraticCurveTo(x + side * 1, 2, x + side * 6, 13);
    ctx.lineTo(x + 8, 33);
    ctx.fillStyle = pilot.light;
    ctx.fill();
    ellipse(ctx, x + 1 * side, 24, 4.6, 8, '#f5a6b7', side * -0.22);
  }
}

export function drawPilot(ctx: Brush, pilot: Pilot, direction: Direction = 2, gait = 0, blink = false) {
  const stride = Math.sin(gait);
  const bob = -Math.abs(stride) * 2;
  ctx.save();
  ellipse(ctx, 48, 86, 29, 6, '#152c2b28');
  const boot = fade(ctx, 72, 88, pilot.light, pilot.dark);
  for (const side of [-1, 1]) {
    const x = 48 + side * 12;
    ellipse(ctx, x + side * stride * 2, 82 + side * stride * 4, 12, 7, pilot.dark);
    ellipse(ctx, x + side * stride * 2, 80 + side * stride * 4, 10.5, 5.7, boot);
  }
  ctx.translate(0, bob);
  const suit = fade(ctx, 56, 84, pilot.light, pilot.color);
  ellipse(ctx, 48, 71, 22, 14, pilot.dark);
  ellipse(ctx, 48, 69, 20, 13, suit);
  for (const side of [-1, 1]) {
    ellipse(ctx, 48 + 23 * side, 69 + side * stride * 4, 8, 7, pilot.dark, side * -0.5);
    ellipse(ctx, 48 + 23 * side, 67 + side * stride * 4, 7, 6, pilot.light, side * -0.5);
  }
  block(ctx, 39, 67, 18, 11, 4, direction === 0 ? pilot.dark : '#fff5d8', pilot.color, 1.4);
  ctx.translate(direction === 1 ? 1.5 : direction === 3 ? -1.5 : 0, 1);
  ears(ctx, pilot);
  ellipse(ctx, 48, 43, 35, 30, pilot.dark);
  ellipse(ctx, 48, 40, 33, 28, fade(ctx, 12, 70, pilot.light, pilot.color));
  ellipse(ctx, 33, 23, 12, 3, '#ffffff63', -0.29);
  if (pilot.type === 'berry') {
    for (const [x, y, angle] of [[28, 26, -0.4], [42, 22, 0.15], [60, 24, 0.3], [69, 31, 0.45], [23, 38, -0.4], [71, 55, -0.2]]) {
      ellipse(ctx, x, y, 1.5, 2.8, '#fff2b7', angle);
    }
  }
  if (direction === 0) {
    ellipse(ctx, 48, 47, 14, 13, '#ffffff32');
    spark(ctx, 48, 47, 8, '#fff7d5');
    ctx.restore();
    return;
  }
  const look = direction === 1 ? 6 : direction === 3 ? -6 : 0;
  const face = 48 + look;
  ellipse(ctx, face, 48, 26 - Math.abs(look) / 4, 20, pilot.dark);
  ellipse(ctx, face, 49, 23.5 - Math.abs(look) / 4, 17, fade(ctx, 33, 66, '#fff6df', '#ffd0a7'));
  ellipse(ctx, face - 15, 53, 4.4, 2.6, '#fb9b96');
  ellipse(ctx, face + 15, 53, 4.4, 2.6, '#fb9b96');
  for (const side of [-1, 1]) {
    const x = face + side * (9 - Math.abs(look) / 5);
    ellipse(ctx, x, 46, 3.2, blink ? 1 : 4.5, '#43283a');
    if (!blink) ellipse(ctx, x - 0.8, 44.5, 1.1, 1.35, '#fffdf3');
  }
  ellipse(ctx, face, 55, 4.2, 3.4, '#7b3e48');
  ellipse(ctx, face, 57, 2.8, 1.45, '#f38180');
  if (pilot.type === 'cat') spark(ctx, 47, 22, 5.7, pilot.accent);
  if (pilot.type === 'fox') ellipse(ctx, 48, 22, 5.5, 2.8, '#fff3c6', -0.16);
  ctx.restore();
}

export function pilotPortrait(pilot: Pilot) {
  const canvas = document.createElement('canvas');
  canvas.width = 114;
  canvas.height = 110;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(4, 4);
  ctx.scale(1.11, 1.11);
  drawPilot(ctx, pilot, 2, 0.39);
  return canvas.toDataURL();
}
