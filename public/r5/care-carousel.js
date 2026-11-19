/* Website Care plans carousel. Progressive enhancement only: without this file the track is a plain scroll-snap list. */
(() => {
  'use strict';
  const root = document.querySelector('[data-care-carousel]');
  if (!root) return;
  const track = root.querySelector('.care-track');
  const slides = Array.from(track.querySelectorAll('[data-care-option]'));
  const dotsWrap = root.querySelector('.care-dots');
  const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('.care-dot')) : [];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const start = Math.max(0, slides.findIndex((s) => s.classList.contains('care-tier--rec')));
  let active = -1;

  const isCarousel = () => track.scrollWidth > track.clientWidth + 1;

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    dots.forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
  };

  // Scrolls only the track (never the page, which scrollIntoView can also do).
  const centerOn = (i, smooth) => {
    const slide = slides[i];
    if (!slide) return;
    const t = track.getBoundingClientRect();
    const r = slide.getBoundingClientRect();
    const left = track.scrollLeft + (r.left - t.left) - (t.width - r.width) / 2;
    track.scrollTo({ left, behavior: smooth && !reduce.matches ? 'smooth' : 'auto' });
  };

  const nearest = () => {
    const t = track.getBoundingClientRect();
    const mid = t.left + t.width / 2;
    let best = 0;
    let bestD = Infinity;
    slides.forEach((s, k) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) { bestD = d; best = k; }
    });
    return best;
  };

  const syncFocusable = () => { track.tabIndex = isCarousel() ? 0 : -1; };
  syncFocusable();
  if (dotsWrap) dotsWrap.hidden = false;
  centerOn(start, false);
  setActive(start);

  dots.forEach((d, k) => d.addEventListener('click', () => { setActive(k); centerOn(k, true); }));

  if ('IntersectionObserver' in window) {
    const ratios = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => ratios.set(e.target, e.intersectionRatio));
      let best = active < 0 ? start : active;
      let bestR = -1;
      slides.forEach((s, k) => { const v = ratios.get(s) || 0; if (v > bestR) { bestR = v; best = k; } });
      if (bestR > 0) setActive(best);
    }, { root: track, threshold: [0, 0.25, 0.5, 0.75, 1] });
    slides.forEach((s) => io.observe(s));
  }

  track.addEventListener('keydown', (e) => {
    if (!isCarousel()) return;
    const last = slides.length - 1;
    let next = null;
    if (e.key === 'ArrowRight') next = Math.min(last, nearest() + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, nearest() - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    centerOn(next, true);
  });

  let timer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { syncFocusable(); if (isCarousel()) centerOn(active < 0 ? start : active, false); }, 150);
  });
})();
