// Motion layer, loaded by site.js. Smooth scrolling, spring physics, entrance choreography,
// word reveals, count-ups, a portrait that paints into colour, a cursor label and a cord you can pull.
const root = document.documentElement;
const body = document.body;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- one shared animation loop ---------- */
const tasks = new Set();
const loop = (t) => { tasks.forEach((f) => f(t)); requestAnimationFrame(loop); };
requestAnimationFrame(loop);

// A damped spring. tension pulls toward the target, friction bleeds speed.
class Spring {
  constructor(v = 0, tension = 260, friction = 22) { this.v = v; this.target = v; this.vel = 0; this.k = tension; this.c = friction; }
  step(dt) {
    const a = this.k * (this.target - this.v) - this.c * this.vel;
    this.vel += a * dt; this.v += this.vel * dt;
    if (Math.abs(this.vel) < 0.0005 && Math.abs(this.target - this.v) < 0.0005) { this.v = this.target; this.vel = 0; return false; }
    return true;
  }
}
// Drive a set of springs and call render while any of them moves.
const animate = (springs, render) => {
  let last = 0; let on = false;
  const tick = (t) => {
    const dt = Math.min(0.032, last ? (t - last) / 1000 : 0.016); last = t;
    let moving = false;
    springs.forEach((s) => { if (s.step(dt)) moving = true; });
    render();
    if (!moving) { tasks.delete(tick); on = false; last = 0; }
  };
  return () => { if (!on) { on = true; tasks.add(tick); } };
};

/* ---------- smooth scrolling (desktop only; phones keep native momentum) ---------- */
let lenis = null;
if (fine) {
  try {
    const { default: Lenis } = await import('https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.mjs');
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    tasks.add((t) => lenis.raf(t));
    root.style.scrollBehavior = 'auto';
    // in-page links glide instead of jumping
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const el = url.hash === '#main' ? 0 : document.querySelector(url.hash);
      if (el === null) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: el === 0 ? 0 : -84, duration: 1.4 });
      history.replaceState(null, '', url.hash === '#main' ? location.pathname : url.hash);
    });
  } catch (err) { /* offline or blocked: native scrolling stays */ }
}

/* ---------- header slides away going down, returns going up ---------- */
const top = document.querySelector('.top');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY; const menuOpen = top && top.querySelector('details[open]');
  if (top) {
    if (y < 480 || menuOpen || y < lastY - 2) top.classList.remove('is-away');
    else if (y > lastY + 2) top.classList.add('is-away');
  }
  lastY = y;
}, { passive: true });

/* ---------- hero entrance ---------- */
const hero = document.querySelector('.hero');
if (hero) {
  hero.querySelectorAll('.line > span').forEach((s, i) => { s.style.transitionDelay = `${120 + i * 110}ms`; });
  hero.querySelectorAll('[data-in]').forEach((el) => { el.style.transitionDelay = `${260 + Number(el.dataset.in) * 110}ms`; });
}
const ready = () => requestAnimationFrame(() => body.classList.add('is-ready'));
(document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]) : Promise.resolve()).then(ready);

/* ---------- headings: split into words that rise when seen ---------- */
const splitWords = (el) => {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const inner = document.createElement('span'); inner.textContent = p; inner.style.setProperty('--i', i++);
          w.appendChild(inner); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
    });
  };
  walk(el);
  el.classList.add('wsplit');
};
const heads = [...document.querySelectorAll('main h2:not(.visually-hidden), .statement, .night h2, .doc-head h1, .prose h1, .plain h1')];
heads.forEach(splitWords);
const seen = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
}, { rootMargin: '0px 0px -12% 0px' });
heads.forEach((h) => seen.observe(h));

/* staggered groups */
document.querySelectorAll('.folders, .cards, .ledger').forEach((g) => {
  [...g.querySelectorAll(':scope > .rv')].forEach((el, i) => el.style.setProperty('--i', i));
});

/* ---------- count-up figures ---------- */
const counters = document.querySelectorAll('.figures dd');
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target; const end = parseInt(el.textContent, 10); if (!end) return;
    const t0 = performance.now(); const dur = 1500;
    const run = (t) => {
      const p = Math.min(1, (t - t0) / dur); const eased = 1 - Math.pow(2, -10 * p);
      el.textContent = String(Math.round(end * (p === 1 ? 1 : eased)));
      if (p === 1) tasks.delete(run);
    };
    el.textContent = '0'; tasks.add(run);
  });
}, { threshold: 0.6 });
counters.forEach((c) => countIO.observe(c));

/* ---------- springs on hover ---------- */
if (fine) {
  // buttons: lift, and the filled ones lean toward the pointer
  document.querySelectorAll('.btn').forEach((b) => {
    const s = new Spring(1, 300, 20); const x = new Spring(0, 220, 18); const y = new Spring(0, 220, 18);
    const magnetic = b.classList.contains('btn--primary');
    b.classList.add('spring');
    const kick = animate([s, x, y], () => { b.style.transform = `translate3d(${x.v}px, ${y.v}px, 0) scale(${s.v})`; });
    b.addEventListener('pointerenter', () => { s.target = 1.04; kick(); });
    b.addEventListener('pointermove', (e) => {
      if (!magnetic) return;
      const r = b.getBoundingClientRect();
      x.target = (e.clientX - (r.left + r.width / 2)) * 0.22; y.target = (e.clientY - (r.top + r.height / 2)) * 0.3; kick();
    });
    b.addEventListener('pointerleave', () => { s.target = 1; x.target = 0; y.target = 0; kick(); });
    b.addEventListener('pointerdown', () => { s.target = 0.96; kick(); });
    b.addEventListener('pointerup', () => { s.target = 1.04; kick(); });
  });

  // nav links bob up a touch
  document.querySelectorAll('.top__links a, .foot a').forEach((a) => {
    const y = new Spring(0, 320, 18); a.style.display = 'inline-block'; a.classList.add('spring');
    const kick = animate([y], () => { a.style.transform = `translateY(${y.v}px)`; });
    a.addEventListener('pointerenter', () => { y.target = -2; kick(); });
    a.addEventListener('pointerleave', () => { y.target = 0; kick(); });
  });

  // folders lean toward the pointer while their cover swings open (the swing itself is CSS)
  body.classList.add('js-tilt');
  document.querySelectorAll('.folder').forEach((f) => {
    const rx = new Spring(0, 170, 16); const ry = new Spring(0, 170, 16); const lift = new Spring(0, 200, 18);
    f.classList.add('spring');
    const kick = animate([rx, ry, lift], () => {
      f.style.transform = `translateY(${lift.v}px) rotateX(${rx.v}deg) rotateY(${ry.v}deg)`;
    });
    f.addEventListener('pointermove', (e) => {
      const r = f.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5;
      ry.target = px * 6; rx.target = -py * 5; lift.target = -10; kick();
    });
    f.addEventListener('pointerleave', () => { rx.target = 0; ry.target = 0; lift.target = 0; kick(); });
  });

  // the portrait frame tilts with depth
  const frame3d = document.querySelector('.hero__photo');
  if (frame3d) {
    const rx = new Spring(0, 140, 16); const ry = new Spring(0, 140, 16);
    frame3d.classList.add('tilt3d');
    setTimeout(() => frame3d.classList.add('tilt-on'), 2000);
    const kick = animate([rx, ry], () => { frame3d.style.setProperty('--rx', `${rx.v}deg`); frame3d.style.setProperty('--ry', `${ry.v}deg`); });
    frame3d.addEventListener('pointermove', (e) => {
      const r = frame3d.getBoundingClientRect();
      ry.target = ((e.clientX - r.left) / r.width - 0.5) * 9; rx.target = -((e.clientY - r.top) / r.height - 0.5) * 7; kick();
    });
    frame3d.addEventListener('pointerleave', () => { rx.target = 0; ry.target = 0; kick(); });
  }

  // cards lean slightly
  document.querySelectorAll('.card, .next, .posts a, .lab-band').forEach((c) => {
    const rx = new Spring(0, 200, 20); const ry = new Spring(0, 200, 20); const lift = new Spring(0, 220, 20);
    c.classList.add('spring');
    const kick = animate([rx, ry, lift], () => { c.style.transform = `perspective(1100px) translateY(${lift.v}px) rotateX(${rx.v}deg) rotateY(${ry.v}deg)`; });
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      ry.target = ((e.clientX - r.left) / r.width - 0.5) * 4; rx.target = -((e.clientY - r.top) / r.height - 0.5) * 4; lift.target = -4; kick();
    });
    c.addEventListener('pointerleave', () => { rx.target = 0; ry.target = 0; lift.target = 0; kick(); });
  });
  document.querySelectorAll('.lab-band').forEach((l) => { l.dataset.cursor = 'Open'; });

  /* ---------- cursor label ---------- */
  const tag = document.createElement('div'); tag.className = 'cursor-tag'; tag.setAttribute('aria-hidden', 'true');
  body.appendChild(tag);
  const cx = new Spring(innerWidth / 2, 380, 30); const cy = new Spring(innerHeight / 2, 380, 30); const cs = new Spring(0, 300, 22);
  const kickTag = animate([cx, cy, cs], () => { tag.style.transform = `translate3d(${cx.v}px, ${cy.v}px, 0) scale(${Math.max(0, cs.v)})`; });
  addEventListener('pointermove', (e) => {
    cx.target = e.clientX; cy.target = e.clientY;
    const over = e.target.closest && e.target.closest('[data-cursor]');
    if (over) { if (tag.textContent !== over.dataset.cursor) tag.textContent = over.dataset.cursor; cs.target = 1; } else cs.target = 0;
    kickTag();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { cs.target = 0; kickTag(); });
}

/* ---------- portrait: colour follows the cursor and fades back to grey ---------- */
const fig = document.querySelector('.hero__photo');
if (fig && fine) {
  const img = fig.querySelector('img');
  const canvas = document.createElement('canvas'); canvas.className = 'paint'; canvas.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('span'); hint.className = 'hero__hint'; hint.textContent = 'Move across the photo';
  fig.append(canvas, hint);
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas'); const mctx = mask.getContext('2d');
  const colour = new Image(); colour.src = img.currentSrc || img.src;
  let W = 0; let H = 0; let dpr = 1; let active = false; let quiet = 0; let prev = null;
  const size = () => {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.width = mask.width = Math.round(r.width * dpr); H = canvas.height = mask.height = Math.round(r.height * dpr);
  };
  size(); addEventListener('resize', size);
  const brush = (x, y) => {
    const rad = 82 * dpr;
    const g = mctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = g; mctx.beginPath(); mctx.arc(x, y, rad, 0, Math.PI * 2); mctx.fill();
  };
  const frame = () => {
    // fade the trail
    mctx.globalCompositeOperation = 'destination-out'; mctx.fillStyle = 'rgba(0,0,0,.028)'; mctx.fillRect(0, 0, W, H);
    mctx.globalCompositeOperation = 'source-over';
    // draw colour photo (object-fit: cover, focus 50% 30%) and keep only the painted part
    ctx.clearRect(0, 0, W, H);
    if (colour.naturalWidth) {
      const s = Math.max(W / colour.naturalWidth, H / colour.naturalHeight);
      const dw = colour.naturalWidth * s; const dh = colour.naturalHeight * s;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(colour, (W - dw) * 0.5, (H - dh) * 0.3, dw, dh);
      ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (++quiet > 160) { tasks.delete(frame); active = false; }
  };
  fig.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
    // fill gaps between fast moves
    if (prev) { const d = Math.hypot(p.x - prev.x, p.y - prev.y); const n = Math.ceil(d / (18 * dpr)); for (let k = 1; k <= n; k++) brush(prev.x + (p.x - prev.x) * (k / n), prev.y + (p.y - prev.y) * (k / n)); } else brush(p.x, p.y);
    prev = p; quiet = 0; fig.classList.add('is-painted');
    if (!active) { active = true; tasks.add(frame); }
  });
  fig.addEventListener('pointerleave', () => { prev = null; });

  // gentle parallax on scroll
  const par = new Spring(0, 120, 18);
  const kickPar = animate([par], () => { img.style.transform = `translateY(${par.v}px) scale(1.06)`; canvas.style.transform = img.style.transform; });
  img.style.transform = canvas.style.transform = 'scale(1.06)';
  addEventListener('scroll', () => { par.target = Math.min(40, scrollY * 0.06); kickPar(); }, { passive: true });
}

/* ---------- the cord: drag it down, let go, it springs back ---------- */
const cord = document.querySelector('.cord');
if (cord) {
  cord.dataset.physics = '1';
  const hint = document.createElement('span'); hint.className = 'cord__hint'; hint.textContent = 'Pull me'; cord.appendChild(hint);
  const pull = new Spring(0, 240, 9); const ang = new Spring(0, 90, 4.5);
  const render = () => { cord.style.setProperty('--pull', `${pull.v}px`); cord.style.setProperty('--ang', `${ang.v}deg`); };
  const kick = animate([pull, ang], render);
  let down = null; let fired = false;
  const knobPoint = () => { const k = cord.querySelector('.cord__knob').getBoundingClientRect(); return [k.left + k.width / 2, k.top + k.height / 2]; };
  const fire = () => { if (fired) return; fired = true; const [x, y] = knobPoint(); window.__toggleTheme && window.__toggleTheme(x, y); };
  // brushing past it gives a small sway, never enough to swing the handle away from the pointer
  cord.addEventListener('pointerenter', (e) => { if (!down && fine) { ang.vel += Math.sign(e.movementX || 1) * 14; kick(); } });
  cord.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() }; fired = false;
    cord.setPointerCapture(e.pointerId); cord.classList.add('is-dragging');
  });
  cord.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dy = Math.max(0, e.clientY - down.y); const dx = e.clientX - down.x;
    pull.v = pull.target = 130 * (1 - Math.exp(-dy / 120)); pull.vel = 0;   // stretches, but resists the further it goes
    ang.v = ang.target = Math.max(-18, Math.min(18, -dx * 0.12)); ang.vel = 0;
    render();
  });
  const release = (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const pulled = pull.v;
    down = null; cord.classList.remove('is-dragging');
    pull.target = 0; ang.target = 0;
    if (moved < 6) { pull.vel = 520; ang.vel += (Math.random() - 0.5) * 60; setTimeout(fire, 140); }   // a tap is a quick tug
    else if (pulled > 38) fire();
    kick();
  };
  cord.addEventListener('pointerup', release);
  cord.addEventListener('pointercancel', release);
  cord.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fired = false; pull.vel = 520; kick(); setTimeout(fire, 140); } });
  cord.addEventListener('click', (e) => e.preventDefault());
}
