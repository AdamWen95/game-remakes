export type Brush = CanvasRenderingContext2D;

export function round(ctx: Brush, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function block(ctx: Brush, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string, width = 2) {
  round(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

export function ellipse(ctx: Brush, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function fade(ctx: Brush, y: number, end: number, light: string, dark: string) {
  const gradient = ctx.createLinearGradient(0, y, 0, end);
  gradient.addColorStop(0, light);
  gradient.addColorStop(1, dark);
  return gradient;
}

export function stroke(ctx: Brush, points: number[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function spark(ctx: Brush, x: number, y: number, size: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.quadraticCurveTo(x, y - size * 0.15, x, y - size);
  ctx.quadraticCurveTo(x + size * 0.15, y, x + size, y);
  ctx.quadraticCurveTo(x, y + size * 0.15, x, y + size);
  ctx.quadraticCurveTo(x - size * 0.15, y, x - size, y);
  ctx.fillStyle = color;
  ctx.fill();
}
