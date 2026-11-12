// Site behaviour: menu, live Jaipur clock, header state, role board, story timeline, reveals, back to top.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const show = (n) => {
      words.forEach((w, k) => { w.classList.toggle('is-on', k === n); w.classList.remove('is-flip'); });
      if (!still) { void words[n].offsetWidth; words[n].classList.add('is-flip'); }
      if (count) count.textContent = `${String(n + 1).padStart(2, '0')} / ${String(words.length).padStart(2, '0')}`;
    };
    show(0);
    if (!still && words.length > 1) setInterval(() => { i = (i + 1) % words.length; show(i); }, 2600);
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
