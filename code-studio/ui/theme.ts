import './theme.css';

// The host and Studio iframe share storage, but each has its own document.
function syncTheme() {
  document.documentElement.dataset.theme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
}
syncTheme();
window.addEventListener('storage', event => { if(event.key === 'theme' || event.key === null) syncTheme(); });
window.addEventListener('focus', syncTheme);
