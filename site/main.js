const input = document.querySelector('#game-search');
const cards = [...document.querySelectorAll('[data-game-card]')];
const count = document.querySelector('#visible-count');
const empty = document.querySelector('#empty-state');
function filterGames() {
  const query = input.value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const card of cards) {
    card.hidden = !card.dataset.search.includes(query);
    if (!card.hidden) visible++;
  }
  count.textContent = String(visible).padStart(2, '0');
  empty.hidden = visible !== 0;
}
input.addEventListener('input', filterGames);
document.querySelector('#clear-search').addEventListener('click', () => { input.value = ''; filterGames(); input.focus(); });
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.matches('input,textarea,select,[contenteditable]')) {
    event.preventDefault(); input.focus();
  }
  if (event.key === 'Escape' && document.activeElement === input) { input.value = ''; filterGames(); }
});
for (const image of document.querySelectorAll('.game-preview img')) {
  const showFallback = () => {
    if (image.hidden) return;
    image.hidden = true;
    const message = document.createElement('p'); message.className = 'preview-error';
    message.textContent = '预览图暂时不可用，点击仍可进入游戏。'; image.after(message);
  };
  image.addEventListener('error', showFallback, { once: true });
  if (image.complete && image.naturalWidth === 0) showFallback();
}
