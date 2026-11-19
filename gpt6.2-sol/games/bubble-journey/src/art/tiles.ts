import { CELL, COLS, HEIGHT, WIDTH, Tile, col, makeMap, rng, row, type Arena } from '../game/maps.ts';
import { block, ellipse, fade, spark, stroke, type Brush } from './paint.ts';
import type { Item } from '../game/rules.ts';

export function drawGround(ctx: Brush, arena: Arena) {
  ctx.fillStyle = arena.trim;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < (WIDTH * HEIGHT) / (CELL * CELL); i++) {
    const x = col(i) * CELL;
    const y = row(i) * CELL;
    const tone = arena.floor[(col(i) + row(i)) % 2];
    ctx.save();
    ctx.translate(x, y);
    block(ctx, 0.8, 0.8, 54.4, 54.4, 4, tone);
    stroke(ctx, [5, 52, 49, 52, 52, 49], '#122a341a', 1.7);
    stroke(ctx, [4, 13, 4, 6, 8, 4, 19, 4], '#ffffff23', 1.3);
    if (i * 19 % 31 < 9) {
      const mark = arena.id === 'night' ? '#e1d5ff55' : '#faffdc9e';
      spark(ctx, 40, 39, 3, mark);
      ellipse(ctx, 13, 17, 2.5, 1.25, arena.ink + '50');
      ellipse(ctx, 20, 19, 1.55, 0.95, arena.ink + '40');
    }
    ctx.restore();
  }
}

export function drawWall(ctx: Brush, arena: Arena, index: number) {
  const [light, body, dark] = arena.wall;
  block(ctx, 3.5, 7, 52, 48, 9, '#1c464b44');
  block(ctx, 2, 2, 51, 49, 9, dark);
  block(ctx, 2, 1, 51, 39, 9, fade(ctx, 1, 39, light, body), dark, 2);
  block(ctx, 7, 6, 41, 29, 7, '#ffffff1b', '#ffffff55', 1);
  stroke(ctx, [8, 14, 8, 10, 12, 7, 24, 7], '#ffffff89', 1.7);
  stroke(ctx, [10, 45, 44, 45], '#ffffff3b', 2);
  if (arena.id === 'night') spark(ctx, 27, 21, 8, '#eee1ff9c');
  else if (arena.id === 'coast') {
    for (const y of [18, 24]) stroke(ctx, [18, y, 24, y - 2, 30, y, 36, y - 2], '#edf9ff99', 1.6);
  } else if (index % 4 !== 0) {
    ellipse(ctx, 22, 23, 7, 3.4, '#42866a66', 0.6);
    ellipse(ctx, 30, 20, 8, 4, '#ecffd479', -0.53);
    stroke(ctx, [23, 26, 31, 20], '#478b6d94', 1.1);
  }
}

export function drawCrate(ctx: Brush, arena: Arena) {
  const [light, body, dark] = arena.crate;
  block(ctx, 6, 9, 49, 46, 9, '#2d3b4a41');
  block(ctx, 4, 6, 48, 45, 8, dark);
  block(ctx, 4, 3, 48, 42, 8, fade(ctx, 3, 46, light, body), dark, 2);
  block(ctx, 10, 9, 36, 29, 4, '#53213b26', '#742e4833', 1.2);
  for (const y of [17, 26, 34]) stroke(ctx, [12, y, 43, y], '#742e4838', 1);
  stroke(ctx, [12, 11, 43, 36], dark + '91', 5);
  stroke(ctx, [43, 11, 13, 36], dark + '91', 5);
  stroke(ctx, [12, 10, 42, 34], light, 3.1);
  stroke(ctx, [42, 10, 12, 34], light, 3.1);
  for (const x of [10, 46]) {
    for (const y of [9, 39]) ellipse(ctx, x, y, 2.1, 2, '#fff7ddaf');
  }
  stroke(ctx, [10, 47, 43, 47], '#fff7dd55', 1.5);
}

export function drawBomb(ctx: Brush) {
  ellipse(ctx, 32, 52, 25, 7, '#194e537c');
  const glass = ctx.createRadialGradient(22, 23, 1, 32, 32, 26);
  glass.addColorStop(0, '#fff6fd');
  glass.addColorStop(0.22, '#ffaacb');
  glass.addColorStop(0.63, '#ec588b');
  glass.addColorStop(0.88, '#c82575');
  glass.addColorStop(1, '#65175e');
  ellipse(ctx, 30, 34, 23, 23, glass);
  ellipse(ctx, 21, 21, 9, 4, '#fff8f0e0', -0.55);
  ellipse(ctx, 43, 43, 8, 2.5, '#ffb4d9b0', -0.84);
  block(ctx, 26, 9, 13, 7, 3, '#773260');
  stroke(ctx, [33, 10, 37, 6, 44, 5], '#815035', 4);
  stroke(ctx, [33, 9, 37, 5, 44, 4], '#f8bd70', 1.6);
  spark(ctx, 46, 5, 6, '#fff5a4');
}

export function drawItem(ctx: Brush, type: Item) {
  const color = type === 'bomb' ? '#f9659e' : type === 'range' ? '#ffb951' : '#54ccbd';
  block(ctx, 7, 9, 38, 38, 11, '#274e5c42');
  block(ctx, 6, 5, 39, 39, 11, fade(ctx, 4, 44, '#fffbe2', color), '#fffce8', 1.9);
  block(ctx, 9.5, 8.5, 32, 32, 9, '#fff7e85e', color, 1);
  if (type === 'bomb') {
    ellipse(ctx, 24, 26, 8, 8, '#a62e69');
    stroke(ctx, [28, 20, 29, 17, 34, 16], '#a62e69', 2.5);
    ellipse(ctx, 22, 23, 2.7, 1.9, '#fff1f3');
  } else if (type === 'range') {
    spark(ctx, 25, 25, 12, '#bc6336');
    spark(ctx, 25, 24.5, 7, '#fff1a4');
  } else {
    stroke(ctx, [17, 18, 23, 25, 16, 31], '#167b75', 3.5);
    stroke(ctx, [26, 17, 33, 25, 25, 32], '#167b75', 3.5);
  }
}

export function mapPreview(arena: Arena) {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 286;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(0.8, 0.8);
  ctx.translate(-98, -113);
  const { tiles } = makeMap(arena.id, rng(63912));
  drawGround(ctx, arena);
  for (let i = 0; i < tiles.length; i++) {
    ctx.save();
    ctx.translate((i % COLS) * CELL, row(i) * CELL);
    if (tiles[i] === Tile.Wall) drawWall(ctx, arena, i);
    if (tiles[i] === Tile.Crate) drawCrate(ctx, arena);
    ctx.restore();
  }
  return canvas.toDataURL('image/jpeg', 0.82);
}
