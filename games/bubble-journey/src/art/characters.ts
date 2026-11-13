export const CHARACTERS = [
  { name: '薄荷兔', tag: '把好运装进口袋', color: '#76cbb5', pale: '#e1f3ea', dark: '#348c75', type: 'rabbit' },
  { name: '蜜桃狐', tag: '一点机灵，一点甜', color: '#efa18d', pale: '#fce9e1', dark: '#bd685b', type: 'fox' },
  { name: '奶油熊', tag: '慢慢来，也能赢', color: '#e9c476', pale: '#faf0d7', dark: '#ac8241', type: 'bear' },
  { name: '蓝莓啵', tag: '小小身体，大大勇气', color: '#a9a5db', pale: '#eeecfa', dark: '#7773ad', type: 'blob' },
] as const;

let portraitSerial = 0;

/** Original vector character artwork, shared by DOM portraits and Phaser textures. */
export function characterSvg(index: number, back = false): string {
  const c = CHARACTERS[index];
  // SVG fragment IDs are document-global, including instances inside hidden panels.
  const gradientId = `portrait-${index}-${portraitSerial++}`;
  const ears = c.type === 'rabbit'
    ? `<path d="M28 39C16 10 25 1 33 12L41 37M55 37L61 11C67-2 80 8 69 40" fill="${c.color}" stroke="${c.dark}" stroke-width="2"/><path d="M29 18l6 18m31-19-5 19" stroke="#f5d9d4" stroke-width="5" stroke-linecap="round"/>`
    : c.type === 'fox'
      ? `<path d="M23 42L18 12Q20 4 40 29M55 29Q76 5 78 13L72 44" fill="${c.color}" stroke="${c.dark}" stroke-width="2"/><path d="M25 20l3 16 8-5m25 0 9-10-3 16" fill="#ffe3cf"/>`
      : c.type === 'bear'
        ? `<circle cx="26" cy="30" r="13" fill="${c.color}" stroke="${c.dark}" stroke-width="2"/><circle cx="70" cy="30" r="13" fill="${c.color}" stroke="${c.dark}" stroke-width="2"/><circle cx="26" cy="30" r="7" fill="#f6dfb2"/><circle cx="70" cy="30" r="7" fill="#f6dfb2"/>`
        : `<path d="M33 27Q25 9 39 13Q45 12 47 23Q58 4 64 17L61 30" fill="${c.color}" stroke="${c.dark}" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="108" viewBox="0 0 96 108">
  <defs><linearGradient id="${gradientId}" x2="0.3" y2="1"><stop stop-color="${c.pale}"/><stop offset=".32" stop-color="${c.color}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient></defs>
  <ellipse cx="48" cy="99" rx="28" ry="6" fill="#244d46" opacity=".15"/>
  <ellipse cx="31" cy="93" rx="11" ry="7" fill="${c.dark}"/><ellipse cx="65" cy="93" rx="11" ry="7" fill="${c.dark}"/>
  <ellipse cx="18" cy="73" rx="8" ry="12" fill="${c.color}" transform="rotate(24 18 73)"/><ellipse cx="78" cy="73" rx="8" ry="12" fill="${c.color}" transform="rotate(-24 78 73)"/>
  ${ears}<path d="M16 55C16 31 30 26 48 26S80 32 80 56L78 76Q76 94 48 94T18 76Z" fill="url(#${gradientId})" stroke="${c.dark}" stroke-width="1.7"/>
  <path d="M25 43Q32 33 43 34" fill="none" stroke="white" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
  ${back ? `<ellipse cx="48" cy="79" rx="10" ry="9" fill="${c.pale}"/>` : `
  <ellipse cx="48" cy="75" rx="22" ry="16" fill="${c.pale}" opacity=".9"/>
  ${c.type === 'fox' ? '<path d="M24 53l24 12 24-12-7 21H31Z" fill="#fff1e2"/>' : ''}
  <ellipse cx="35" cy="56" rx="3.5" ry="5" fill="#284740"/><ellipse cx="61" cy="56" rx="3.5" ry="5" fill="#284740"/>
  <circle cx="36" cy="54" r="1.2" fill="white"/><circle cx="62" cy="54" r="1.2" fill="white"/>
  <ellipse cx="27" cy="65" rx="6" ry="3.5" fill="#f2999a" opacity=".65"/><ellipse cx="69" cy="65" rx="6" ry="3.5" fill="#f2999a" opacity=".65"/>
  <path d="M44 65q4 5 8 0M48 68v3m-6 0q6 6 12 0" fill="none" stroke="#39534a" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M24 80Q48 90 72 80" fill="none" stroke="${index === 0 ? '#f9df94' : '#fff6df'}" stroke-width="6"/>
  <path d="M57 85l5 13 8-4-6-12" fill="${index === 0 ? '#f9df94' : '#fff6df'}"/>
  `}</svg>`;
}

// Phaser 3's XHR loader expects embedded assets to use base64 data URIs.
export const svgData = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;
