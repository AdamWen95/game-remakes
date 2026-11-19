export const CREW = [
  { name: '莓莓', type: 'berry', title: '草莓领航员', light: '#ff91a5', color: '#f45d82', dark: '#ac335c', accent: '#94d568', tile: '#ffe5ec' },
  { name: '泡芙', type: 'fox', title: '奶油狐', light: '#ffcf87', color: '#f2a44c', dark: '#a25c33', accent: '#fff0b0', tile: '#ffefd8' },
  { name: '豆丁', type: 'frog', title: '青蛙飞行员', light: '#c7ed85', color: '#88c854', dark: '#4d8644', accent: '#daffb2', tile: '#edf6d6' },
  { name: '月牙', type: 'cat', title: '星际小猫', light: '#d3b9ff', color: '#aa89e9', dark: '#65438d', accent: '#ffd6f7', tile: '#efe5ff' },
] as const;
export type Pilot = typeof CREW[number];
