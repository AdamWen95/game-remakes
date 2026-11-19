import { icon } from './icons';
import { CHARACTERS, characterSvg } from '../art/characters';
import { THEMES } from '../art/textures';
import type { Match } from '../game/match';
import type { SaveData } from '../storage';

const closeButton = `<button class="icon-button modal-close" data-action="close" aria-label="关闭弹窗">${icon('close')}</button>`;
export function guide(music: boolean) {
  return `${closeButton}<div class="modal-eyebrow">HOW TO PLAY</div><h2 id="modal-title">三分钟，快乐入门。</h2><p class="modal-description">最后留在花园里的冒险家，就是赢家。</p>
  <div class="guide-steps"><div><span>01</span><p><b>动起来，找好位置</b>WASD 或方向键移动；手机用下方方向按钮。所有角色初始能力相同。</p></div><div><span>02</span><p><b>放一颗泡泡，记得转弯</b>按空格或触屏按钮放泡泡。2.4 秒后十字爆开，命中即淘汰；爆炸会引爆其他泡泡。</p></div><div><span>03</span><p><b>收集惊喜，留到最后</b>木箱可以炸开，绿篱不可破坏。泡泡被木箱阻挡，拐角通常是安全的藏身处。</p></div></div>
  <div class="guide-powers"><span>${icon('bubble')} 数量 +1<small>最多 5 颗</small></span><span>${icon('star')} 范围 +1<small>最远 7 格</small></span><span>${icon('bolt')} 速度 +1<small>最高 5 级</small></span></div>
  <p class="guide-rules">破坏木箱 +10 · 收集道具 +25 · 淘汰对手 +200 · 获胜 +500。时间结束时，在存活者中按积分决胜；最高分并列或全员淘汰为平局。淘汰后可继续观战。</p>
  <div class="guide-options"><label><input id="music-setting" type="checkbox" ${music ? 'checked' : ''}/> 播放背景音乐</label><span><kbd>Esc</kbd> / <kbd>P</kbd> 暂停</span></div><button class="primary-button" data-action="close">知道啦，去冒险 ${icon('arrow')}</button>`;
}
export function pause() {
  return `<div class="pause-illustration">${characterSvg(0)}</div><div class="modal-eyebrow">TAKE A LITTLE BREAK</div><h2 id="modal-title">快乐暂停一下。</h2><p class="modal-description">花园会等你，泡泡也会。</p><button class="primary-button" data-action="resume">${icon('play')} 继续游戏</button><button class="secondary-button" data-action="restart">${icon('restart')} 重新开始</button><button class="text-button" data-action="lobby">返回大厅</button>`;
}
export function confirmDialog(action: 'restart' | 'lobby') {
  return `${closeButton}<div class="modal-eyebrow">A FRESH START</div><h2 id="modal-title">${action === 'restart' ? '开启一场新的冒险？' : '要回大厅休息一下吗？'}</h2><p class="modal-description">当前对局进度不会计入战绩。</p><button class="primary-button" data-action="${action}">确认${action === 'restart' ? '重新开始' : '返回大厅'}</button><button class="secondary-button" data-action="close">继续当前对局</button>`;
}
export function result(match: Match) {
  const win = match.winner === 0, draw = match.winner === null;
  const player = match.actors[0];
  const rows = [...match.actors].sort((a, b) => Number(b.id === match.winner) - Number(a.id === match.winner) || Number(b.alive) - Number(a.alive) || b.score - a.score);
  return `<div class="result-art ${win ? 'win' : ''}"><span>✦</span>${characterSvg(player.character)}<span>✧</span></div><div class="modal-eyebrow">${win ? 'WINNER, WINNER!' : draw ? 'A LOVELY TIE' : 'ANOTHER LITTLE ADVENTURE'}</div><h2 id="modal-title">${win ? '这片花园，你最闪耀！' : draw ? '势均力敌，一起可爱。' : '差一点点，下局再来！'}</h2><p class="modal-description">${match.reason === 'timeout' ? '时间到！存活者按积分决出胜者。' : draw ? '本局平局，快乐没有输赢。' : `${match.winner === 0 ? '你' : match.actors[match.winner!].name}成为了最后的冒险家。`}</p><div class="result-score"><span>本局获得</span><b>${player.score}<small> pts</small></b></div><div class="leaderboard">${rows.map((a, i) => `<div class="${a.id === 0 ? 'self' : ''}"><span class="rank">${i + 1}</span><span class="mini-portrait">${characterSvg(a.character)}</span><b>${a.name}${a.id === 0 ? ' · ' + CHARACTERS[a.character].name : ''}</b><span>${a.kills} 淘汰</span><strong>${a.score}</strong></div>`).join('')}</div><button class="primary-button" data-action="restart">${icon('restart')} 再来一局 ${icon('arrow')}</button><button class="text-button" data-action="lobby">返回游戏大厅</button>`;
}
export function records(data: SaveData, available: boolean) {
  return `${closeButton}<div class="modal-eyebrow">YOUR LITTLE ACHIEVEMENTS</div><h2 id="modal-title">每一次快乐，都算数。</h2><div class="record-stats"><div><strong>${data.played}</strong><span>完成对局</span></div><div><strong>${data.wins}</strong><span>花园冠军</span></div><div><strong>${data.best}</strong><span>最高积分</span></div></div>${data.records.length ? `<div class="record-list">${data.records.slice(0, 8).map(r => `<div><span class="record-result ${r.win ? 'win' : ''}">${r.win ? '胜利' : r.draw ? '平局' : '再接再厉'}</span><p><b>${THEMES[r.theme].name}</b><small>${new Date(r.date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></p><strong>${r.score}<small> pts</small></strong></div>`).join('')}</div>` : `<div class="empty-records">${icon('trophy')}<h3>第一份快乐，等你来收集。</h3><p>完成一场对局后，战绩就会出现在这里。</p></div>`}<p class="record-note">${available ? '战绩仅保存在当前浏览器，清除网站数据会重置记录。' : '浏览器暂时无法保存数据，本次战绩仅在当前页面保留。'}</p>`;
}
