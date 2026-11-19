export const weapons = {
  m4: { name: 'M4A1', group: '突击步枪', mag: 30, reserve: 90, cycle: .095, reload: 1.92, damage: 30, spread: .009, recoil: .014, auto: true, zoom: .77 },
  ak: { name: 'AK-47', group: '突击步枪', mag: 30, reserve: 90, cycle: .11, reload: 2.13, damage: 37, spread: .013, recoil: .021, auto: true, zoom: .81 },
  awp: { name: 'AWP', group: '栓动狙击', mag: 5, reserve: 20, cycle: 1.18, reload: 2.58, damage: 106, spread: .018, recoil: .054, auto: false, zoom: .30 },
  m9: { name: 'M9', group: '副武器', mag: 15, reserve: 45, cycle: .19, reload: 1.37, damage: 23, spread: .014, recoil: .021, auto: false, zoom: .84 },
} as const;

export type Gun = keyof typeof weapons;
export type Primary = Exclude<Gun, 'm9'>;
export const matchRules = { 10: 120, 20: 180, 40: 300 } as const;
export type Target = keyof typeof matchRules;
export type Level = 'recruit' | 'standard' | 'veteran';
export const difficulty = {
  recruit: { delay: .63, error: .10, tempo: .44, damage: .55 },
  standard: { delay: .32, error: .059, tempo: .29, damage: .72 },
  veteran: { delay: .19, error: .032, tempo: .17, damage: .88 },
};
