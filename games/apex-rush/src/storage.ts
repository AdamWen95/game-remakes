export interface Settings { track: number; car: number; mode: 'race'|'time'; difficulty: 'casual'|'pro'; muted: boolean; auto: boolean; quality: 'high'|'low' }
export interface Save { settings: Settings; records: Record<string, number> }
const defaults = (): Save => ({ settings: { track:0, car:0, mode:'race', difficulty:'casual', muted:false, auto:matchMedia('(pointer: coarse)').matches, quality:'high' }, records:{} });
export function loadSave(): Save {
  const result = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem('apex-rush-v1') || '{}');
    const s = raw.settings || {};
    for (const key of ['track','car'] as const) if (Number.isInteger(s[key]) && s[key]>=0 && s[key]<3) result.settings[key] = s[key];
    for (const key of ['muted','auto'] as const) if (typeof s[key]==='boolean') result.settings[key] = s[key];
    if (s.mode==='race' || s.mode==='time') result.settings.mode = s.mode;
    if (s.difficulty==='casual' || s.difficulty==='pro') result.settings.difficulty = s.difficulty;
    if (s.quality==='high' || s.quality==='low') result.settings.quality = s.quality;
    for (const [key,value] of Object.entries(raw.records || {})) if (/^(coast|city|alpine):[0-2]:(race|time):(casual|pro)$/.test(key) && typeof value==='number' && Number.isFinite(value) && value>0) result.records[key] = value;
  } catch { /* Private browsing and corrupt saves fall back to an ephemeral session. */ }
  return result;
}
export function persist(save: Save) { try { localStorage.setItem('apex-rush-v1',JSON.stringify(save)); return true; } catch { return false; } }
