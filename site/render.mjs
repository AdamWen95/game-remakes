export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const download = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></svg>';
export function renderCollection(catalog, assets) {
  const cards = catalog.games.map((game, index) => {
    const href = `./${game.id}/index.html`;
    return `<article class="game-card ${game.accent}" data-game-card data-search="${escapeHtml([game.title, game.subtitle, game.description, game.category, ...game.tags].join(' ').toLowerCase())}">
      <a class="game-preview" href="${href}" aria-label="开始游玩${escapeHtml(game.title)}"><span class="preview-browser"><i></i><i></i><i></i><span>${escapeHtml(game.subtitle.toLowerCase())}</span><b>LIVE DEMO</b></span><img src="${game.previewData}" alt="${escapeHtml(game.title)}的实际游戏大厅" width="1440" height="1106" loading="lazy"/><span class="preview-caption"><i></i> 真实游戏画面 <span>点击进入 ${arrow}</span></span></a>
      <div class="game-detail"><div class="game-kicker"><span>EXPERIMENT ${String(index + 1).padStart(2, '0')}</span><b><i></i> 可游玩</b></div><div class="genre">${escapeHtml(game.category)}<span> / SINGLE HTML</span></div><h3>${escapeHtml(game.title)}</h3><div class="english-title">${escapeHtml(game.subtitle)}</div><p class="game-description">${escapeHtml(game.description)}</p><div class="tags">${game.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="game-controls"><span>⌘</span>${escapeHtml(game.controls)}<small>也支持手机触屏</small></div><div class="game-actions"><a class="button primary" href="${href}" data-play>开始游玩 ${arrow}</a><a class="button download" href="${href}" download="${game.id}.html" data-download>${download} 下载 HTML</a></div><div class="game-foot"><span>${escapeHtml(game.technology)}</span><span>${(game.bytes / 1024 / 1024).toFixed(2)} MiB</span></div></div>
    </article>`;
  }).join('\n');
  const substitutions = {
    '{{TITLE}}': escapeHtml(catalog.title), '{{DESCRIPTION}}': escapeHtml(catalog.description),
    '{{COUNT}}': String(catalog.games.length).padStart(2, '0'), '{{CARDS}}': cards,
    '{{STYLE}}': assets.css, '{{SCRIPT}}': assets.script.replace(/<\/script/gi, '<\\/script'),
  };
  let html = assets.template;
  for (const [marker, value] of Object.entries(substitutions)) html = html.replaceAll(marker, () => value);
  if (/\{\{[A-Z]+\}\}/.test(html)) throw new Error('Unresolved collection template marker.');
  return html;
}
