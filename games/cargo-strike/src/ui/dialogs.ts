import { $ } from './layout';
import type { Match } from '../game/match';
export interface Preferences {
    sensitivity: number;
    volume: number;
    quality: 'high' | 'balanced';
}
const defaults: Preferences = { sensitivity: 1, volume: .65, quality: 'high' };
export function loadPreferences(): Preferences {
    try {
        const v = JSON.parse(localStorage.getItem('cargo-strike.preferences.v1') || 'null');
        if (!v)
            return { ...defaults };
        return { sensitivity: Number.isFinite(v.sensitivity) && v.sensitivity >= .3 && v.sensitivity <= 2.5 ? v.sensitivity : 1, volume: Number.isFinite(v.volume) && v.volume >= 0 && v.volume <= 1 ? v.volume : .65, quality: v.quality === 'balanced' ? 'balanced' : 'high' };
    }
    catch {
        return { ...defaults };
    }
}
export function savePreferences(p: Preferences): void { try {
    localStorage.setItem('cargo-strike.preferences.v1', JSON.stringify(p));
}
catch { /* Private browsers may disable local persistence; the current session remains usable. */ } }
export class Dialogs {
    private dialog = $<HTMLDialogElement>('dialog');
    constructor(private resume: () => void, private lobby: () => void, private restart: () => void) { this.dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); this.resume(); }); }
    close(): void { this.dialog.close(); }
    private show(html: string): void { $('dialog-content').innerHTML = html; if (!this.dialog.open)
        this.dialog.showModal(); }
    pause(): void {
        this.show('<span class="eyebrow">MISSION ON HOLD</span><h2>战斗已暂停</h2><p>整场战斗已经暂停。准备好后，继续交火。</p><button id="resume" class="primary">返回战场 <span>→</span></button><button id="pause-settings" class="secondary">声音与操作设置</button><button id="restart" class="secondary">重新开始本局</button><button id="leave" class="secondary">结束本局，返回大厅</button>');
        $('resume').onclick = () => { this.close(); this.resume(); };
        $('leave').onclick = () => { this.close(); this.lobby(); };
        $('restart').onclick = () => { this.close(); this.restart(); };
    }
    settings(p: Preferences, change: (p: Preferences) => void, back: () => void): void {
        this.show(`<span class="eyebrow">SYSTEM / PREFERENCES</span><h2>声音与操作</h2><label>鼠标灵敏度<input id="sensitivity" aria-label="鼠标灵敏度" type="range" min="0.3" max="2.5" step="0.1" value="${p.sensitivity}"></label><label>主音量<input id="volume" aria-label="主音量" type="range" min="0" max="1" step="0.05" value="${p.volume}"></label><label>画面质量<select id="quality"><option value="high">高画质 · 实时阴影</option><option value="balanced">流畅 · 降低渲染负担</option></select></label><p>键鼠可获得完整体验；触屏使用左侧摇杆移动，右侧空白处滑动瞄准。低帧率时可切换流畅模式。</p><button id="settings-close" class="primary">完成设置 <span>✓</span></button>`);
        $<HTMLSelectElement>('quality').value = p.quality;
        for (const id of ['sensitivity', 'volume', 'quality'])
            $(id).oninput = () => { p.sensitivity = Number($<HTMLInputElement>('sensitivity').value); p.volume = Number($<HTMLInputElement>('volume').value); p.quality = $<HTMLSelectElement>('quality').value as Preferences['quality']; change(p); };
        $('settings-close').onclick = () => { this.close(); back(); };
    }
    help(): void {
        this.show('<span class="eyebrow">FIELD MANUAL / 001</span><h2>准备交火</h2><div class="guide"><kbd>W A S D / 方向键</kbd><span>移动</span><kbd>鼠标移动 / 左键</kbd><span>瞄准 / 射击</span><kbd>右键</kbd><span>精确瞄准 / 狙击开镜</span><kbd>R / 1 / 2</kbd><span>换弹 / 主武器 / 手枪</span><kbd>Shift / 空格 / Ctrl</kbd><span>冲刺 / 跳跃 / 蹲下</span><kbd>G / Tab / Esc</kbd><span>手雷 / 战绩 / 暂停</span></div><p>蓝方为友军，橙褐色为敌军。掩体阻挡子弹，侧道尽头可沿台阶登上高台。复活有短暂保护，主动开火即解除。胜负由团队击杀数或时间决定。</p><p>练枪模式提供静止靶手和无限目标复活。子弹用完可切换副武器，或从暂停菜单重新开始。</p><button id="help-close" class="primary">已准备好 <span>→</span></button>');
        $('help-close').onclick = () => this.close();
    }
    result(match: Match): void {
        const p = match.player, win = match.scores[0] > match.scores[1], tie = match.scores[0] === match.scores[1];
        this.show(`<span class="eyebrow">MISSION COMPLETE</span><h2>${tie ? '势均力敌' : win ? '任务胜利' : '整队再战'}</h2><p>BLUE ${match.scores[0]} : ${match.scores[1]} RED · ${Math.floor(match.elapsed / 60)} 分 ${Math.floor(match.elapsed % 60)} 秒</p><div class="result-summary"><span><b>${p.kills}</b>击杀</span><span><b>${p.deaths}</b>阵亡</span><span><b>${p.headshots}</b>爆头</span><span><b>${match.shots ? Math.round(match.hits / match.shots * 100) : 0}%</b>命中率</span></div><button id="again" class="primary">再次出击 <span>↗</span></button><button id="result-lobby" class="secondary">返回大厅</button>`);
        $('again').onclick = () => { this.close(); this.restart(); };
        $('result-lobby').onclick = () => { this.close(); this.lobby(); };
    }
}
