/* Manou Matteucci: menu, video's en flipboek */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ----- menu op telefoon (Escape sluit het weer) ----- */
  const btn = document.querySelector('.menu-btn'), side = document.querySelector('.side');
  if (btn && side) {
    const setOpen = (open) => { side.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    btn.addEventListener('click', () => setOpen(!side.classList.contains('open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && side.classList.contains('open')) { setOpen(false); btn.focus(); } });
  }

  /* ----- datum en tijd in de onderbalk (zoals op de Cargo-site, in het Engels: "Thursday, November 26, 2026 2:33 PM") ----- */
  const clock = document.querySelector('.clock');
  if (clock) {
    const tick = () => { const d = new Date(); clock.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
    tick(); setInterval(tick, 20000);
  }

  /* ----- korte animaties spelen alleen als ze in beeld zijn (en niet bij "minder beweging") ----- */
  const loops = Array.from(document.querySelectorAll('video[data-loop]'));
  if (loops.length) {
    if (reduce.matches || !('IntersectionObserver' in window)) loops.forEach((v) => { v.controls = true; v.removeAttribute('autoplay'); });
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) { if (v.dataset.paused) return; const p = v.play(); if (p && p.catch) p.catch(() => { v.controls = true; }); } else v.pause(); }), { threshold: 0.25 });
      loops.forEach((v) => {
        io.observe(v);
        /* een bewegend beeld moet te pauzeren zijn: klik, Enter of spatie zet de animatie stil of speelt hem weer af */
        v.tabIndex = 0; v.style.cursor = 'pointer';
        const toggle = () => { if (v.paused) { delete v.dataset.paused; v.play().catch(() => {}); } else { v.dataset.paused = '1'; v.pause(); } };
        v.addEventListener('click', toggle);
        v.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      });
    }
  }
})();

/* ---------- 8) EIGEN FLIPBOOK: een bladzijde die echt buigt. Stroken, licht en schaduw, met knoppen, pijltjes, klik of meesleuren ---------- */
(function initBook() {
  const books = Array.from(document.querySelectorAll('.book[data-pages]')); if (!books.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);   // zacht aanzetten en afremmen
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const PAPER = '#f4f1ea', NS = 'book-';
  const cache = {};   // url -> belofte: het beeld is geladen en klaar om te tekenen
  const ready = (url) => {
    if (!url) return Promise.resolve();
    if (!cache[url]) cache[url] = new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = url; if (i.decode) i.decode().then(res, res); });
    return cache[url];
  };
  const el = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };

  books.forEach((fig) => {
    const pages = fig.dataset.pages.split(','), N = pages.length;
    const stage = fig.querySelector('.book-stage'), count = fig.querySelector('.book-count');
    const prev = fig.querySelector('[data-dir="-1"]'), next = fig.querySelector('[data-dir="1"]');
    fig.style.setProperty('--bw', fig.dataset.w); fig.style.setProperty('--bh', fig.dataset.h);
    const narrow = window.matchMedia('(max-width: 700px)');
    const forceSingle = fig.hasAttribute('data-single');
    let single = false, pos = 0, built = false, T = null, queue = [];
    let inner, slotR, slotL, castR, castL;

    const sheets = () => (single ? N : Math.ceil(N / 2));
    const frontOf = (s) => (single ? pages[s] : pages[2 * s]);
    const backOf = (s) => (single ? undefined : pages[2 * s + 1]);
    const canNext = () => (single ? pos < N - 1 : pos < sheets());
    const canPrev = () => pos > 0;
    const shiftFor = (p) => (single ? 0 : p === 0 ? -25 : p === sheets() ? 25 : 0);   // omslag staat in het midden

    function fill(slot, url) {   // url: tekst = beeld, '' = lege pagina, null = niets
      const img = slot.firstChild;
      if (url === null) { slot.classList.add('empty'); return; }
      slot.classList.remove('empty');
      if (url) { if (img.getAttribute('src') !== url) img.src = url; img.style.display = ''; } else img.style.display = 'none';
    }
    const mkSlot = (cls) => { const s = el(NS + 'slot ' + cls); const i = new Image(); i.alt = ''; i.draggable = false; i.decoding = 'async'; s.appendChild(i); return s; };

    function preload(p) {   // de pagina's om de huidige heen alvast klaarzetten
      [p - 2, p - 1, p, p + 1, p + 2].forEach((q) => { if (q < 0) return; const s = single ? [pages[q]] : [pages[2 * q], pages[2 * q + 1], pages[2 * q - 1], pages[2 * q - 2]]; s.forEach((u) => u && ready(u)); });
    }
    function layout(p) {   // vaste stand zonder animatie
      pos = clamp(p, 0, single ? N - 1 : sheets());
      fill(slotR, single ? pages[pos] : pos < sheets() ? frontOf(pos) : null);
      fill(slotL, single ? null : pos > 0 ? backOf(pos - 1) || '' : null);
      inner.style.transform = 'translateX(' + shiftFor(pos) + '%)';
      castR.style.opacity = castL.style.opacity = 0; stage.style.setProperty('--lift', 0);
      const alt = (i) => 'Pagina ' + (i + 1) + ' van ' + N;
      slotR.firstChild.alt = single ? alt(pos) : (2 * pos < N ? alt(2 * pos) : ''); slotL.firstChild.alt = !single && pos > 0 && pages[2 * pos - 1] ? alt(2 * pos - 1) : '';
      let label;
      if (single) label = (pos + 1) + ' / ' + N; else if (pos === 0) label = '1 / ' + N; else if (pos === sheets()) label = N + ' / ' + N; else label = (2 * pos) + '-' + (2 * pos + 1) + ' / ' + N;
      count.textContent = label; prev.disabled = !canPrev(); next.disabled = !canNext();
      preload(pos);
    }
    function build(keepPage) {
      single = forceSingle || narrow.matches; fig.classList.toggle('single', single); fig.classList.toggle('wide', single && +fig.dataset.w > +fig.dataset.h);
      stage.textContent = '';
      inner = el(NS + 'inner'); slotL = mkSlot('l'); slotR = mkSlot('r'); castL = el(NS + 'cast l'); castR = el(NS + 'cast r');
      inner.append(slotL, slotR, castL, castR); stage.appendChild(inner);
      layout(single ? keepPage : Math.ceil(keepPage / 2));
    }

    /* ----- de bladerende pagina ----- */
    function begin(dir) {
      if (T || (dir > 0 ? !canNext() : !canPrev())) return false;
      const sheet = dir > 0 ? pos : pos - 1;
      if (dir > 0) fill(slotR, single ? pages[pos + 1] : pos + 1 < sheets() ? frontOf(pos + 1) : null);   // wat onder de pagina zichtbaar wordt
      else if (!single) fill(slotL, pos - 2 >= 0 ? backOf(pos - 2) || '' : null);
      const W = single ? stage.clientWidth : stage.clientWidth / 2, H = stage.clientHeight;
      const n = clamp(Math.round(W / 11), 28, 56), w = W / n, ov = 2.0;
      const curl = el(NS + 'curl'); curl.style.left = single ? '0' : '50%'; curl.style.width = W + 'px';
      const fu = frontOf(sheet), bu = backOf(sheet), strips = [];
      for (let k = 0; k < n; k++) {
        const s = el('cs'), f = el('cf'), b = el('cb'), fs = document.createElement('i'), bs = document.createElement('i');
        s.style.width = (w + ov) + 'px';
        [f, b].forEach((x) => { x.style.backgroundSize = W + 'px ' + H + 'px'; });
        if (fu) { f.style.backgroundImage = 'url("' + fu + '")'; f.style.backgroundPosition = (-k * w) + 'px 0'; }
        if (bu) { b.style.backgroundImage = 'url("' + bu + '")'; b.style.backgroundPosition = (-(W - (k + 1) * w - ov)) + 'px 0'; }
        f.appendChild(fs); b.appendChild(bs); s.append(f, b); curl.appendChild(s); strips.push({ s, fs, bs });
      }
      inner.appendChild(curl);
      T = { dir, sheet, curl, strips, n, w, W, t: dir > 0 ? 0 : 1, raf: 0, from: shiftFor(pos), to: shiftFor(pos + dir) };
      fig.classList.add('flipping');
      return true;
    }
    function draw(t) {
      T.t = t;
      const { n, w, W, strips } = T;
      const phi0 = 180 * t, bend = 34 * Math.sin(2 * Math.PI * t);   // eerst loopt de rand voor (opgetild), daarna blijft hij achter (valt)
      let x = 0, z = 0, minX = 0, maxX = 0;
      for (let k = 0; k < n; k++) {
        const f = k / n, phi = clamp(phi0 + bend * Math.pow(f, 1.35), 0, 180), r = phi * Math.PI / 180, sn = Math.sin(r);
        const st = strips[k];
        st.s.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,' + z.toFixed(2) + 'px) rotateY(' + (-phi).toFixed(2) + 'deg)';
        const gut = 0.22 * clamp(1 - (k * w) / (0.14 * W), 0, 1) * Math.abs(Math.cos(r));   // rugschaduw zoals op de vaste pagina
        const side = 0.3 * Math.pow(sn, 1.5);   // hoe schuiner naar het licht, hoe donkerder
        const sh = (gut + side * (1 - gut)).toFixed(3);
        st.fs.style.opacity = st.bs.style.opacity = sh;
        x += w * Math.cos(r); z += w * sn; minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      }
      const lift = clamp(z / W, 0, 1);
      const rightW = Math.max(0, maxX) + 0.1 * W, leftW = Math.max(0, -minX) + 0.1 * W;
      const a = Math.pow(lift, 0.7);
      castR.style.width = rightW + 'px'; castR.style.opacity = maxX > 2 ? (0.9 * a).toFixed(3) : 0;
      castL.style.width = leftW + 'px'; castL.style.opacity = minX < -2 ? (0.9 * a).toFixed(3) : 0;
      stage.style.setProperty('--lift', lift.toFixed(3));
      const m = T.dir > 0 ? t : 1 - t;
      inner.style.transform = 'translateX(' + (T.from + (T.to - T.from) * m).toFixed(3) + '%)';
    }
    function end(commit) {
      cancelAnimationFrame(T.raf); T.curl.remove();
      const d = T.dir; T = null; fig.classList.remove('flipping');
      layout(pos + (commit ? d : 0));
      if (queue.length) { const q = queue.shift(); run(q, true); }
    }
    function run(dir, fast) {   // een hele omslag afspelen
      if (reduce.matches) { if (!T && (dir > 0 ? canNext() : canPrev())) layout(pos + dir); return; }
      const urls = dir > 0 ? [frontOf(pos), single ? pages[pos + 1] : backOf(pos), frontOf(pos + 1)] : [frontOf(pos - 1), backOf(pos - 1), backOf(pos - 2)];
      const go = () => { if (!begin(dir)) return; const from = T.t, to = dir > 0 ? 1 : 0; glide(from, to, fast ? 640 : 1000, ease, () => end(true)); };
      let done = false; const once = () => { if (!done) { done = true; go(); } };
      Promise.all(urls.map(ready)).then(once); setTimeout(once, 450);
    }
    function glide(from, to, dur, easing, cb) {
      let t0 = null; draw(from);
      const step = (now) => { if (!T) return; if (t0 === null) t0 = now; const p = clamp((now - t0) / dur, 0, 1); draw(from + (to - from) * easing(p)); if (p < 1) T.raf = requestAnimationFrame(step); else cb(); };
      T.raf = requestAnimationFrame(step);
    }
    const go = (d) => { if (T) { if (queue.length < 3) queue.push(d); return; } run(d, false); };

    prev.addEventListener('click', () => go(-1)); next.addEventListener('click', () => go(1));
    stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });

    /* ----- meesleuren met muis of vinger; kort tikken blijft bladeren ----- */
    let down = null;
    stage.addEventListener('pointerdown', (e) => { if (e.button > 0 || T) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, samples: [[e.clientX, performance.now()]] }; });
    stage.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.drag) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
        if (reduce.matches || !begin(dx < 0 ? 1 : -1)) { down = null; return; }
        down.drag = true; down.dir = T.dir; down.x = e.clientX - dx; stage.classList.add('is-drag'); try { stage.setPointerCapture(e.pointerId); } catch (err) { /* geen capture: gewoon doorgaan */ }
      }
      if (!T) return;
      const reach = T.W * 1.05, p = clamp((down.dir > 0 ? -dx : dx) / reach, 0, 1);
      draw(down.dir > 0 ? p : 1 - p);
      down.samples.push([e.clientX, performance.now()]); if (down.samples.length > 6) down.samples.shift();
    });
    const release = (e, cancelled) => {
      if (!down || (e && e.pointerId !== down.id)) return; const d = down; down = null;
      stage.classList.remove('is-drag');
      if (d.drag && T) {
        const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1], v = (s1[0] - s0[0]) / Math.max(1, s1[1] - s0[1]);   // px per ms, negatief = naar links
        const prog = d.dir > 0 ? T.t : 1 - T.t, flick = (d.dir > 0 ? -v : v) > 0.45;
        const commit = !cancelled && (prog > 0.38 || flick), to = (d.dir > 0) === commit ? 1 : 0, cur = T.t;
        const dist = Math.abs(to - cur);
        glide(cur, to, clamp(750 * dist + 160, 200, 800), easeOut, () => end(commit));
        return;
      }
      if (cancelled || !e) return;
      const b = stage.getBoundingClientRect();
      if (single) go(e.clientX > b.left + b.width * 0.3 ? 1 : -1); else go(e.clientX > b.left + b.width / 2 ? 1 : -1);
    };
    stage.addEventListener('pointerup', (e) => release(e, false));
    stage.addEventListener('pointercancel', (e) => release(e, true));
    stage.addEventListener('dragstart', (e) => e.preventDefault());

    addEventListener('resize', () => { if (T) end(true); }, { passive: true });
    const init = () => { if (built) return; built = true; build(0); narrow.addEventListener('change', () => { if (T) end(true); const cur = single ? pos : Math.min(N - 1, pos * 2); build(cur); }); };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); init(); } }, { rootMargin: '200px' }); io.observe(fig); } else init();
  });
})();

(function fullscreen() {
  const fig = document.querySelector('.book'); if (!fig) return;
  const b = fig.querySelector('.book-full');
  if (!b || !document.fullscreenEnabled) return; b.hidden = false;
  const sync = () => { b.textContent = document.fullscreenElement ? 'Sluiten' : 'Volledig scherm'; };
  b.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else fig.requestFullscreen().catch(() => {}); });
  document.addEventListener('fullscreenchange', sync);
})();
