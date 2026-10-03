// Runs only inside the opaque-origin preview iframe.
function bootstrap(token) {
  let inspect = false;
  let drag = null;
  const send = (kind, data = {}) => parent.postMessage({studioPreview: token, kind, ...data}, '*');
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level];
    console[level] = (...args) => {
      send('console', {level, text: args.map(value => {
        try { return typeof value === 'string' ? value : JSON.stringify(value); }
        catch { return String(value); }
      }).join(' ').slice(0, 4000)});
      original.apply(console, args);
    };
  }
  addEventListener('error', e => send('error', {text: e.message, line: e.lineno}));
  addEventListener('unhandledrejection', e => send('error', {text: String(e.reason)}));
  function move(x, y) {
    if (!drag) return;
    const {element, rect, base, startX, startY, resize} = drag;
    const dx = x - startX, dy = y - startY;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    drag.changed = true;
    if (resize) {
      element.style.width = Math.max(20, rect.width + dx) + 'px';
      element.style.height = Math.max(20, rect.height + dy) + 'px';
      element.style.boxSizing = 'border-box';
    } else {
      element.style.position = 'absolute';
      element.style.margin = '0';
      element.style.left = Math.max(0, rect.left - base.left + dx) + 'px';
      element.style.top = Math.max(0, rect.top - base.top + dy) + 'px';
    }
  }
  function finish() {
    if (!drag) return;
    const {element, changed, resize} = drag;
    drag = null;
    if (changed) send('move', {node: Number(element.dataset.studioNode), style: resize
      ? {width: element.style.width, height: element.style.height, 'box-sizing': 'border-box'}
      : {position: 'absolute', margin: '0', left: element.style.left, top: element.style.top}});
    send('drag-end');
  }
  addEventListener('message', e => {
    if (e.source !== parent || e.data?.studioPreview !== token) return;
    if (e.data.drag) { move(e.data.drag.x, e.data.drag.y); return; }
    if (e.data.finishDrag) { finish(); return; }
    inspect = !!e.data.inspect;
    document.documentElement.style.cursor = inspect ? 'crosshair' : '';
  });
  document.addEventListener('click', e => {
    const element = e.target.closest('[data-studio-node]');
    if (inspect && element) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const s = getComputedStyle(element);
      document.querySelectorAll('[data-studio-selected]').forEach(el => {
        el.style.outline = '';
        el.removeAttribute('data-studio-selected');
      });
      element.setAttribute('data-studio-selected', '');
      element.style.outline = '2px solid #8b5cf6';
      send('select', {node: Number(element.dataset.studioNode), tag: element.tagName.toLowerCase(),
        text: element.children.length ? null : element.textContent, background: s.backgroundColor,
        color: s.color, width: s.width, height: s.height, borderRadius: s.borderRadius,
        padding: s.padding, href: element.getAttribute('href') || ''});
      return;
    }
    const a = e.target.closest('a');
    if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('#')) {
      e.preventDefault();
      send('navigate', {path: a.getAttribute('href')});
    }
  }, true);
  document.addEventListener('pointerdown', e => {
    const element = e.target.closest('[data-studio-selected]');
    if (!inspect || !element || e.button !== 0) return;
    e.preventDefault();
    const rect = element.getBoundingClientRect();
    const parentElement = element.offsetParent;
    const base = !parentElement || parentElement === document.body
      ? {left: -scrollX, top: -scrollY} : parentElement.getBoundingClientRect();
    drag = {element, rect, base, startX: e.clientX, startY: e.clientY, resize: e.shiftKey, changed: false};
    send('drag-start', {resize: e.shiftKey});
  }, true);
  document.addEventListener('pointermove', e => move(e.clientX, e.clientY));
  document.addEventListener('pointerup', finish);
  addEventListener('DOMContentLoaded', () => send('ready'));
}

export const bridge = token => `(${bootstrap.toString()})(${JSON.stringify(token).replace(/</g, '\\u003c')});`;
