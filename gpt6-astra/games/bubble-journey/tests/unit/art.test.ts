import { expect, test } from 'vitest';
import { characterSvg, svgData } from '../../src/art/characters';

test('every portrait owns its gradient even when another instance is hidden', () => {
  const portraits = Array.from({ length: 24 }, (_, i) => characterSvg(i % 4));
  const ids = portraits.map(svg => svg.match(/linearGradient id="([^"]+)"/)![1]);
  expect(new Set(ids).size).toBe(portraits.length);
  portraits.forEach((svg, i) => expect(svg).toContain(`fill="url(#${ids[i]})"`));
});
test('Phaser embedded portrait round-trips through its required base64 decoder', () => {
  const svg = characterSvg(0); const data = svgData(svg);
  expect(data.startsWith('data:image/svg+xml;base64,')).toBe(true);
  expect(atob(data.split(',')[1])).toBe(svg);
});
