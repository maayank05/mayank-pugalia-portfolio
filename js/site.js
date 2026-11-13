// Site behaviour: menu, live Jaipur clock, header state, role board, story timeline, reveals, back to top.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme: dark by default, the pull cord switches and remembers the choice.
  const meta = document.querySelector('meta[name="theme-color"]');
  const cord = document.querySelector('.cord');
  const paint = () => {
    const dark = root.dataset.theme !== 'light';
    if (meta) meta.content = dark ? '#161414' : '#E8E4E0';
    if (cord) {
      cord.setAttribute('aria-pressed', String(!dark));
      cord.setAttribute('aria-label', dark ? 'Pull for light theme' : 'Pull for dark theme');
      cord.title = cord.getAttribute('aria-label');
    }
  };
  paint();
  // Swap the theme. With View Transitions the new theme opens as a circle from (x, y).
  const toggleTheme = (x, y) => {
    const swap = () => {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* storage blocked */ }
      paint();
    };
    if (!document.startViewTransition || still) {
      root.classList.add('theming'); swap();
      setTimeout(() => root.classList.remove('theming'), 500);
      return;
    }
    const cx = x ?? window.innerWidth - 40; const cy = y ?? 200;
    const r = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
    const vt = document.startViewTransition(swap);
    vt.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${r}px at ${cx}px ${cy}px)`] },
        { duration: 750, easing: 'cubic-bezier(.65,0,.25,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  };
  window.__toggleTheme = toggleTheme;
  if (cord) {
    cord.addEventListener('click', (e) => {
      if (cord.dataset.physics) return; // motion.js drives the cord when it is loaded
      cord.classList.remove('is-pull'); void cord.offsetWidth; cord.classList.add('is-pull');
      const k = cord.querySelector('.cord__knob').getBoundingClientRect();
      setTimeout(() => toggleTheme(k.left + k.width / 2, k.top + k.height / 2), still ? 0 : 200);
    });
  }

  // Motion layer: smooth scroll, springs, reveals. Content shows even if it never loads.
  const self = document.currentScript;
  setTimeout(() => document.body.classList.add('is-ready'), 2500);
  if (self && !still) import(new URL('motion.js', self.src).href).catch(() => document.body.classList.add('is-ready'));
  else document.body.classList.add('is-ready');

  // Mobile menu closes after a choice or on Escape.
  document.querySelectorAll('.top__menu').forEach((menu) => {
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.removeAttribute('open'); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.open) { menu.removeAttribute('open'); menu.querySelector('summary').focus(); }
    });
  });

  // Local time in Jaipur.
  const clocks = document.querySelectorAll('[data-clock]');
  const dates = document.querySelectorAll('[data-date]');
  const tz = 'Asia/Kolkata';
  const tick = () => {
    const now = new Date();
    const t = now.toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(now);
    const get = (k) => parts.find((p) => p.type === k).value;
    clocks.forEach((c) => { c.textContent = t; });
    dates.forEach((d) => { d.textContent = `${get('day')} ${get('month')}, ${get('year')}`; });
  };
  if (clocks.length || dates.length) { tick(); setInterval(tick, 15000); }

  // Header gets a frosted backing once the page moves; back-to-top ring follows progress.
  const top = document.querySelector('.top');
  const totop = document.querySelector('.totop');
  const onScroll = () => {
    const y = window.scrollY;
    if (top) top.classList.toggle('is-stuck', y > 8);
    if (totop) {
      const max = root.scrollHeight - window.innerHeight;
      totop.style.setProperty('--p', max > 0 ? Math.round((y / max) * 100) : 0);
      totop.classList.toggle('is-shown', y > window.innerHeight * 0.8);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Split-flap role board.
  const flap = document.querySelector('.flap');
  if (flap) {
    const words = [...flap.querySelectorAll('.flap__word')];
    const count = flap.querySelector('.flap__count');
    let i = 0;
    const setCount = (n) => { if (count) count.textContent = `${String(n + 1).padStart(2, '0')} / ${String(words.length).padStart(2, '0')}`; };
    // A leaf is a copy of the board showing one word, clipped to its top or bottom half.
    const leaf = (word, half) => {
      const el = document.createElement('span');
      el.className = `flap__leaf flap__leaf--${half}`; el.setAttribute('aria-hidden', 'true');
      words.forEach((w, k) => { const c = w.cloneNode(true); c.classList.toggle('is-on', k === word); el.appendChild(c); });
      flap.appendChild(el); return el;
    };
    // Split-flap: the old top half falls forward, then the new bottom half lands.
    const flipTo = (from, to) => {
      words.forEach((w, k) => w.classList.toggle('is-on', k === to));
      setCount(to);
      if (still) return;
      const topOld = leaf(from, 'top'); const botOld = leaf(from, 'bottom');
      topOld.classList.add('is-falling');
      setTimeout(() => {
        const botNew = leaf(to, 'bottom'); botNew.classList.add('is-landing');
        setTimeout(() => { topOld.remove(); botOld.remove(); botNew.remove(); }, 340);
      }, 280);
    };
    words.forEach((w, k) => w.classList.toggle('is-on', k === 0)); setCount(0);
    if (!still && words.length > 1) setInterval(() => { const from = i; i = (i + 1) % words.length; flipTo(from, i); }, 2800);
  }

  // Story: the entry nearest the middle of the screen sets the year, range and pager.
  const story = document.querySelector('.story');
  if (story) {
    const items = [...story.querySelectorAll('.tl > li')];
    const year = story.querySelector('.story__year');
    const range = story.querySelector('.story__range');
    const pagerN = story.querySelector('.story__pager b');
    const bar = story.querySelector('.story__bar');
    const dial = story.querySelector('.story__dial');
    const tl = story.querySelector('.tl');
    let current = -1;
    const pick = () => {
      const mid = window.innerHeight / 2;
      let best = 0; let dist = Infinity;
      items.forEach((li, k) => {
        const r = li.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < dist) { dist = d; best = k; }
      });
      if (dial) {
        const r = story.getBoundingClientRect();
        dial.style.setProperty('--turn', `${(-r.top / 12).toFixed(1)}deg`);
      }
      if (tl) {
        const r = tl.getBoundingClientRect();
        const p = Math.min(100, Math.max(0, ((mid - r.top) / r.height) * 100));
        tl.style.setProperty('--prog', `${p}%`);
      }
      if (best === current) return;
      current = best;
      const li = items[best];
      items.forEach((x, k) => x.classList.toggle('is-on', k === best));
      if (year && year.textContent !== li.dataset.year) {
        year.textContent = li.dataset.year;
        year.classList.remove('is-turn');
        if (!still) { void year.offsetWidth; year.classList.add('is-turn'); }
      }
      if (range) range.textContent = li.dataset.range;
      if (pagerN) pagerN.textContent = String(best + 1).padStart(2, '0');
      if (bar) bar.style.setProperty('--fill', `${((best + 1) / items.length) * 100}%`);
    };
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    pick();
  }

  // Reveal on scroll.
  const rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !still) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach((el) => io.observe(el));
  } else {
    rv.forEach((el) => el.classList.add('in'));
  }
})();
