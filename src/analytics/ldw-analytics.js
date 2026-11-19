/* LDW analytics + consent adapter. ONE external file, no inline script. Emitted to dist/ldw-analytics.js ONLY when ANALYTICS_ENABLED=1 at build time.

   Behaviour (Basic Consent Mode with hard script-load gating):
   - Runs only on the production hostnames baked in at build, and never on excluded private routes (/share, /admin, /api).
   - Before an affirmative choice NOTHING from Google or Microsoft is loaded or requested. Only the consent banner (first-party DOM) is shown.
   - Consent lives in first-party localStorage only (key ldw-consent-v1). Global Privacy Control (navigator.globalPrivacyControl) is treated as "reject" until the visitor chooses.
   - Analytics category: Google tag (direct gtag, GA4) + the GTM container (container must not contain a GA4/Google tag). ad_storage, ad_user_data and ad_personalization stay denied.
   - Session-replay category (separate toggle): Microsoft Clarity, with forms, inputs and contact links masked.
   - URLs sent to GA4 carry no visitor-supplied text: page_location, page_path and a same-origin page_referrer use a route from the build's own
     route allowlist (ROUTES, generated from the emitted pages) or "/other/" for anything else (404s, typed or crafted paths). Query strings and
     fragments are always dropped. A cross-site referrer is reduced to its origin plus "/", never its path.
   - Session replay (Clarity) only starts on an allowlisted route, after query/fragment text has been removed from the address bar.
   - Exactly one page_view: gtag config sends none (send_page_view:false) and this file sends one sanitized page_view per page load.
   - Events come only from inert data-ldw-* attributes on real anchors (the links work with JavaScript off). Allowlisted low-cardinality values only:
     no hrefs, phone numbers, emails, link text, query strings, fragments or form contents are ever sent.
   - Revoking consent clears the stored choice, expires first-party analytics cookies and reloads the page so nothing keeps transmitting. */
(function () {
  'use strict';
  var HOSTS = /*__ANALYTICS_HOSTS__*/[];
  var ROUTES = /*__ANALYTICS_ROUTES__*/[];
  var OTHER = '/other/';
  var GA4_ID = 'G-127KLSQHRB';
  var GTM_ID = 'GTM-WZJ8HHKK';
  var CLARITY_ID = 'zabyszkk6y';
  var STORE_KEY = 'ldw-consent-v1';
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  var EXCLUDED = ['/share', '/admin', '/api'];

  var EVENTS = { service_cta_click: 1, contact_method_click: 1, contact_card_download: 1, discovery_handoff_click: 1 };
  var PLACEMENTS = ['connect_card', 'connect_actions', 'service_detail', 'mobile_bar', 'footer', 'discovery_hero', 'discovery_bottom', 'home_hero', 'home_cta_band', 'services_hub'];
  var SERVICES = ['websites', 'business-systems-automation', 'digital-ownership-platform-administration', 'technology-consulting'];
  var METHODS = { phone: 'tel:', sms: 'sms:', email: 'mailto:' };

  var host = String(location.hostname).toLowerCase();
  var path = String(location.pathname).toLowerCase();
  if (HOSTS.indexOf(host) === -1) return;
  for (var x = 0; x < EXCLUDED.length; x++) if (path === EXCLUDED[x] || path.indexOf(EXCLUDED[x] + '/') === 0) return;

  var loaded = { analytics: false, clarity: false };
  var banner = null;
  var boxes = null;
  var opener = null;

  function readChoice() {
    try {
      var c = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (c && c.v === 1 && typeof c.t === 'number' && Date.now() - c.t < MAX_AGE_MS) return { a: c.a === 1, c: c.c === 1 };
    } catch (e) { /* storage unavailable: treated as no stored choice */ }
    return null;
  }
  function writeChoice(a, c) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, a: a ? 1 : 0, c: c ? 1 : 0, t: Date.now() })); } catch (e) { /* not persisted */ }
  }

  function addScript(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    (document.head || document.documentElement).appendChild(s);
  }

  // Map any pathname to a known route of this build or OTHER. Matching is exact (after lower-casing and adding a missing trailing slash);
  // nothing from an unknown path is kept.
  function safePath(pathname) {
    var p = String(pathname).toLowerCase();
    if (p.charAt(p.length - 1) !== '/') p += '/';
    return ROUTES.indexOf(p) === -1 ? OTHER : p;
  }
  var routePath = safePath(path);

  function safeReferrer() {
    try {
      var r = new URL(document.referrer);
      if (r.protocol !== 'https:' && r.protocol !== 'http:') return '';
      return r.origin === location.origin ? r.origin + safePath(r.pathname) : r.origin + '/';
    } catch (e) { return ''; }
  }

  function loadAnalytics() {
    if (loaded.analytics) return;
    loaded.analytics = true;
    var pageLocation = location.origin + routePath;
    var pageReferrer = safeReferrer();
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_flags: 'SameSite=Lax;Secure',
      page_location: pageLocation,
      page_referrer: pageReferrer
    });
    window.gtag('event', 'page_view', { page_location: pageLocation, page_referrer: pageReferrer, page_path: routePath, page_title: document.title });
    addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID));
    // GTM container only. A GA4/Google tag inside the container would double-count page views.
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    addScript('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID));
  }

  // Clarity records the live URL itself and has no URL override, so (L1): it never starts on a non-allowlisted path, and before it starts any
  // query string is removed from the address bar, as is any fragment that is not a plain in-page anchor id. Nothing on this site uses queries.
  function cleanAddressForReplay() {
    var keepHash = /^#[a-z][a-z0-9-]{0,63}$/.test(location.hash) && document.getElementById(location.hash.slice(1)) ? location.hash : '';
    if (!location.search && location.hash === keepHash) return;
    try { window.history.replaceState(window.history.state, '', location.pathname + keepHash); } catch (e) { /* leave URL as is */ }
  }

  function loadClarity() {
    if (loaded.clarity) return;
    if (routePath === OTHER) return;
    loaded.clarity = true;
    cleanAddressForReplay();
    var mask = document.querySelectorAll('form, input, textarea, select, a[href^="tel:"], a[href^="sms:"], a[href^="mailto:"]');
    for (var i = 0; i < mask.length; i++) mask[i].setAttribute('data-clarity-mask', 'True');
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
    addScript('https://www.clarity.ms/tag/' + encodeURIComponent(CLARITY_ID));
  }

  function applyChoice(choice) {
    if (choice.a) loadAnalytics();
    if (choice.c) loadClarity();
  }

  function whenIdle(fn) {
    function schedule() {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout: 4000 });
      else window.setTimeout(fn, 1500);
    }
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
  }

  function expireCookies() {
    var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); });
    var owned = /^(_ga(_[A-Za-z0-9]+)?|_gid|_gat(_[A-Za-z0-9_]+)?|_gcl_[a-z]+|_clck|_clsk|CLID|ANONCHK|MR|MUID|SM)$/;
    var domains = ['', '; domain=' + host, '; domain=.' + host.replace(/^www\./, '')];
    names.forEach(function (n) {
      if (!n || !owned.test(n)) return;
      domains.forEach(function (d) { document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d; });
    });
  }

  // ---- events (data-ldw-event / -method / -placement / -service on real anchors) ----
  function eventFor(anchor) {
    var name = anchor.getAttribute('data-ldw-event');
    if (!EVENTS[name]) return null;
    var placement = anchor.getAttribute('data-ldw-placement');
    if (PLACEMENTS.indexOf(placement) === -1) return null;
    var href = anchor.getAttribute('href') || '';
    if (name === 'contact_method_click') {
      var method = anchor.getAttribute('data-ldw-method');
      if (!METHODS[method] || href.toLowerCase().indexOf(METHODS[method]) !== 0) return null;
      return { name: name, params: { method: method, placement: placement } };
    }
    if (name === 'service_cta_click') {
      var service = anchor.getAttribute('data-ldw-service');
      if (SERVICES.indexOf(service) === -1) return null;
      return { name: name, params: { service_id: service, placement: placement } };
    }
    if (name === 'contact_card_download') {
      if (!/\.vcf(?:[?#]|$)/i.test(href)) return null;
      return { name: name, params: { placement: placement } };
    }
    if (name === 'discovery_handoff_click') {
      var h; try { h = new URL(href, location.href).hostname.toLowerCase(); } catch (e) { return null; }
      if (h !== 'getaiform.com') return null;
      return { name: name, params: { destination: 'dashform', placement: placement } };
    }
    return null;
  }

  document.addEventListener('click', function (e) {
    if (!loaded.analytics || !window.gtag) return;
    var node = e.target && e.target.closest ? e.target.closest('a[data-ldw-event]') : null;
    if (!node) return;
    var ev = eventFor(node);
    if (!ev) return;
    ev.params.transport_type = 'beacon';
    window.gtag('event', ev.name, ev.params);
  }, true);

  // ---- consent banner (first-party DOM only; opens from the footer "Privacy choices" link) ----
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function button(label, cls, onclick) {
    var b = el('button', 'ldw-consent__btn ' + cls, label);
    b.type = 'button';
    b.addEventListener('click', onclick);
    return b;
  }
  function checkbox(id, label, detail, checked) {
    var wrap = el('div', 'ldw-consent__opt');
    var input = el('input'); input.type = 'checkbox'; input.id = id; input.checked = checked;
    var lab = el('label'); lab.htmlFor = id;
    lab.appendChild(el('strong', '', label));
    lab.appendChild(el('span', 'ldw-consent__detail', detail));
    wrap.appendChild(input); wrap.appendChild(lab);
    return { wrap: wrap, input: input };
  }

  function announce(text) {
    var s = document.getElementById('ldw-consent-status');
    if (!s) { s = el('div', 'ldw-consent__sr'); s.id = 'ldw-consent-status'; s.setAttribute('role', 'status'); document.body.appendChild(s); }
    s.textContent = '';
    window.setTimeout(function () { s.textContent = text; }, 50);
  }

  function setHeight() {
    document.documentElement.style.setProperty('--ldw-consent-h', banner && !banner.hidden ? Math.ceil(banner.getBoundingClientRect().height) + 'px' : '0px');
  }

  function closeBanner(focusBack) {
    if (!banner) return;
    banner.hidden = true;
    document.body.classList.remove('ldw-consent-open');
    setHeight();
    if (focusBack && opener && opener.focus) opener.focus();
  }

  function commit(a, c) {
    var before = readChoice() || { a: false, c: false };
    writeChoice(a, c);
    var revoked = (before.a && !a) || (before.c && !c);
    if (revoked) {
      // Scripts already running cannot be unloaded: clear first-party cookies and reload with nothing loaded.
      expireCookies();
      window.location.reload();
      return;
    }
    closeBanner(true);
    announce('Privacy choices saved.');
    applyChoice({ a: a, c: c });
  }

  function buildBanner() {
    var current = readChoice() || { a: false, c: false };
    var root = el('section', 'ldw-consent');
    root.id = 'ldw-consent';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-labelledby', 'ldw-consent-title');
    root.tabIndex = -1;
    root.hidden = true;
    var title = el('h2', 'ldw-consent__title', 'Your privacy choices'); title.id = 'ldw-consent-title';
    root.appendChild(title);
        root.appendChild(el('p', 'ldw-consent__text', 'We would like to use optional tools to see which pages and buttons are used so we can improve this site. Nothing optional loads unless you choose it.'));
    var link = el('a', 'ldw-consent__link', 'Privacy Notice'); link.href = '/privacy/';
    var pl = el('p', 'ldw-consent__text ldw-consent__text--small'); pl.appendChild(link);
    root.appendChild(pl);

    var prefs = el('div', 'ldw-consent__prefs'); prefs.id = 'ldw-consent-prefs'; prefs.hidden = true;
    var fs = el('fieldset', 'ldw-consent__fieldset');
    fs.appendChild(el('legend', 'ldw-consent__legend', 'Optional tools'));
    var oa = checkbox('ldw-consent-a', 'Site analytics', 'Google Analytics and Google Tag Manager: which pages and contact buttons are used. No advertising features.', current.a);
    var oc = checkbox('ldw-consent-c', 'Session replay and heatmaps', 'Microsoft Clarity: how pages are scrolled and clicked. Forms and contact details are masked.', current.c);
    fs.appendChild(oa.wrap); fs.appendChild(oc.wrap);
    fs.appendChild(el('p', 'ldw-consent__text ldw-consent__text--small', 'Remembering this choice uses local storage in your browser on this site.'));
    prefs.appendChild(fs);
    prefs.appendChild(button('Save choices', 'ldw-consent__btn--save', function () { commit(oa.input.checked, oc.input.checked); }));
    boxes = { a: oa.input, c: oc.input, prefs: prefs };

    var actions = el('div', 'ldw-consent__actions');
    var prefBtn = button('Preferences', 'ldw-consent__btn--quiet', function () {
      var open = prefs.hidden;
      prefs.hidden = !open;
      prefBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      setHeight();
    });
    prefBtn.setAttribute('aria-expanded', 'false'); prefBtn.setAttribute('aria-controls', 'ldw-consent-prefs');
    actions.appendChild(button('Reject all', 'ldw-consent__btn--choice', function () { commit(false, false); }));
    actions.appendChild(button('Accept all', 'ldw-consent__btn--choice', function () { commit(true, true); }));
    actions.appendChild(prefBtn);
    root.appendChild(actions);
    root.appendChild(prefs);

    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && readChoice()) closeBanner(true); });
    var skip = document.querySelector('.skip-link');
    document.body.insertBefore(root, skip ? skip.nextSibling : document.body.firstChild);
    return root;
  }

  function openBanner(moveFocus) {
    if (!banner) banner = buildBanner();
    var cur = readChoice() || { a: false, c: false };
    boxes.a.checked = cur.a; boxes.c.checked = cur.c;
    banner.hidden = false;
    document.body.classList.add('ldw-consent-open');
    setHeight();
    if (moveFocus) banner.focus();
  }

  function init() {
    var choice = readChoice();
    if (!choice && navigator.globalPrivacyControl === true) { writeChoice(false, false); choice = { a: false, c: false }; }
    if (!choice) openBanner(false);
    else whenIdle(function () { applyChoice(choice); });
    window.addEventListener('resize', setHeight);
    document.addEventListener('click', function (e) {
      var o = e.target && e.target.closest ? e.target.closest('[data-ldw-consent-open]') : null;
      if (!o) return;
      e.preventDefault();
      opener = o;
      openBanner(true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
