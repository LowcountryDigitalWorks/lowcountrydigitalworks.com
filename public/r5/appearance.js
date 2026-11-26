/* LDW appearance (k5f). Loaded synchronously in <head> from the same origin (CSP script-src 'self'; no inline script), so the
   resolved mode is on <html> before first paint. Preference contract follows the owner's theme/appearance.mjs reference:
   'system' (default) | 'light' | 'dark'; anything else is 'system'. Stored only in this browser (localStorage, try/catch); no
   analytics, no network. Without this file (no JS) the CSS follows prefers-color-scheme; with storage blocked it still follows
   the OS and the control works for the current page. */
(() => {
  'use strict';
  const KEY = 'ldw-appearance';
  const MODES = ['system', 'light', 'dark'];
  const root = document.documentElement;
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const normalize = (v) => (typeof v === 'string' && MODES.indexOf(v) !== -1 ? v : 'system');
  const read = () => { try { return normalize(window.localStorage.getItem(KEY)); } catch (e) { return 'system'; } };
  const write = (v) => {
    try { if (v === 'system') window.localStorage.removeItem(KEY); else window.localStorage.setItem(KEY, v); } catch (e) { /* storage blocked: this page only */ }
  };
  let pref = read();
  const sync = () => {
    const inputs = document.querySelectorAll('input[name="ldw-appearance"]');
    for (let i = 0; i < inputs.length; i += 1) inputs[i].checked = inputs[i].value === pref;
  };
  const apply = () => {
    const resolved = pref === 'system' ? (mq && mq.matches ? 'dark' : 'light') : pref;
    root.setAttribute('data-color-pref', pref);
    root.setAttribute('data-color-mode', resolved);
    sync();
  };
  root.setAttribute('data-appearance', 'js');
  apply();
  if (mq) {
    const onOs = () => { if (pref === 'system') apply(); };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onOs); else if (typeof mq.addListener === 'function') mq.addListener(onOs);
  }
  window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) { pref = read(); apply(); } });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || t.name !== 'ldw-appearance') return;
    pref = normalize(t.value);
    write(pref);
    apply();
  });
  document.addEventListener('DOMContentLoaded', sync);
})();
