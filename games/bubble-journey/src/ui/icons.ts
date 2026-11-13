const paths: Record<string, string> = {
  play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  bubble: '<circle cx="12" cy="14" r="8"/><path d="M12 6V3h4M7 12l2-2"/>',
  leaf: '<path d="M19 4C6 2 2 10 7 16S22 16 19 4Z"/><path d="m5 21 9-12m-4 4h6"/>',
  trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v5m-4 1h8"/>',
  volume: '<path d="m11 4-5 4H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-5 4H3v8h3l5 4Zm5 5 6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  restart: '<path d="M4 9a8 8 0 1 1 1 9M4 3v6h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-3 4 3-4 3m0 6 4 3-4 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
};
export function icon(name: string, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.star}</svg>`;
}
