'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const VIDEO = new URLSearchParams(location.search).get('video') === '1';
  if (VIDEO) document.documentElement.classList.add('video');

  /* ---------- Sabitler ---------- */
  const PLACES = {
    kahve:  { e: '☕', n: 'Kahve' },
    pizza:  { e: '🍕', n: 'Pizza' },
    durum:  { e: '🌯', n: 'Dürüm' },
    sushi:  { e: '🍣', n: 'Sushi' },
    sinema: { e: '🎬', n: 'Sinema' },
    sahil:  { e: '🌊', n: 'Sahilde yürüyüş' },
  };
  const DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const DAYS_LONG = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const NO_TEXTS = ['Emin misin?', 'Bir daha düşün 🥺', 'Hayır butonu bakımda 🛠️'];
  const MAX_NAME = 30, MAX_NOTE = 60;

  /* ---------- Yardımcılar ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const rand = (a, b) => a + Math.random() * (b - a);
  const clean = (v, max) =>
    typeof v === 'string' ? Array.from(v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).slice(0, max).join('') : '';

  // Metni her zaman textContent ile basarız; innerHTML yok
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // UTF-8 güvenli base64url
  function enc(obj) {
    let s = '';
    new TextEncoder().encode(JSON.stringify(obj)).forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function dec(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  }

  function parseDate(s) {
    const m = typeof s === 'string' && s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  const validTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const longDate = (d) => `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${DAYS_LONG[d.getDay()]}`;
  const baseUrl = () => location.origin + location.pathname;

  /* ---------- Hash okuma (güvenli) ---------- */
  function readHash() {
    try {
      const m = location.hash.match(/^#([dr])=([A-Za-z0-9_-]{1,2000})$/);
      if (!m) return null;
      const o = dec(m[2]);
      if (!o || typeof o !== 'object') return null;
      const f = clean(o.f, MAX_NAME);
      const t = clean(o.t, MAX_NAME);
      if (!f) return null;
      if (m[1] === 'd') return { type: 'd', f, t };
      const date = parseDate(o.date);
      if (!t || !date || !PLACES[o.place]) return null;
      return {
        type: 'r', f, t, date: ymd(date),
        time: validTime(o.time) ? o.time : null,
        place: o.place,
        note: clean(o.note, MAX_NOTE),
      };
    } catch (e) {
      return null;
    }
  }

  /* ---------- Ses (Web Audio) ---------- */
  let ac = null;
  let muted = false;
  if (!VIDEO) { try { muted = localStorage.getItem('muted') === '1'; } catch (e) {} }
  const soundBtn = $('sound');
  const paintSound = () => (soundBtn.textContent = muted ? '🔇' : '🔊');
  paintSound();

  function audio() {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!ac) ac = new C();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, at, dur, type, vol) {
    if (muted) return;
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  const sfx = {
    click: () => tone(660, 0, 0.08, 'triangle', 0.12),
    nope: () => tone(240, 0, 0.12, 'square', 0.05),
    yes: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.16)),
    ding: () => { tone(1319, 0, 0.9, 'sine', 0.18); tone(1976, 0, 0.6, 'sine', 0.08); },
  };
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    if (!VIDEO) { try { localStorage.setItem('muted', muted ? '1' : '0'); } catch (e) {} }
    paintSound();
    sfx.click();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, a.btn') && !e.target.closest('[data-nosound], #sound')) sfx.click();
  });

  /* ---------- Konfeti (canvas) ---------- */
  const cv = $('confetti');
  const cx = cv.getContext('2d');
  const COLORS = ['#ff5d8f', '#ffb3c8', '#ffd166', '#7bdff2', '#b8f2a1', '#c3a6ff', '#ffffff'];
  let parts = [];
  let raf = 0;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sizeCanvas() {
    const d = window.devicePixelRatio || 1;
    cv.width = innerWidth * d;
    cv.height = innerHeight * d;
    cx.setTransform(d, 0, 0, d, 0, 0);
  }
  addEventListener('resize', sizeCanvas);
  sizeCanvas();

  function confetti(n) {
    n = reduce ? 40 : n || 160;
    for (let i = 0; i < n; i++) {
      parts.push({
        x: innerWidth / 2 + rand(-40, 40), y: innerHeight * 0.65,
        vx: rand(-8, 8), vy: rand(-18, -6),
        w: rand(6, 11), h: rand(9, 16),
        r: rand(0, 6.28), vr: rand(-0.3, 0.3), ph: rand(0, 6.28),
        c: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.y < innerHeight + 30);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.ph += 0.15;
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.r);
      cx.scale(1, Math.cos(p.ph));
      cx.fillStyle = p.c;
      cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cx.restore();
    }
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  }

  /* ---------- Ekran geçişi ---------- */
  let cur = null;
  let navTok = 0;
  function show(id) {
    const next = $(id);
    const tok = ++navTok;
    const old = cur;
    const go = () => {
      if (tok !== navTok) return;
      if (old) { old.hidden = true; old.classList.remove('leave'); }
      next.hidden = false;
      next.classList.remove('enter');
      void next.offsetWidth;
      next.classList.add('enter');
      cur = next;
      window.scrollTo(0, 0);
    };
    if (old && old !== next) {
      old.classList.add('leave');
      setTimeout(go, 180);
    } else go();
  }
  document.querySelectorAll('[data-back]').forEach((b) =>
    b.addEventListener('click', () => show(b.dataset.back)));

  /* ---------- Paylaşım / kopyalama ---------- */
  async function shareOut(text, url) {
    if (navigator.share) {
      try { await navigator.share({ text, url }); return; } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener');
  }
  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = el('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e2) {}
      ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = 'Kopyalandı ✓';
    setTimeout(() => (btn.textContent = old), 1600);
  }
  function invalid(input) {
    input.classList.remove('invalid');
    void input.offsetWidth;
    input.classList.add('invalid');
    input.focus();
  }

  /* ---------- 0) Oluşturma ---------- */
  let inviteUrl = '';
  function showCreate() {
    $('made').hidden = true;
    show('s-create');
  }
  $('btn-make').addEventListener('click', () => {
    const f = clean($('in-from').value, MAX_NAME);
    const t = clean($('in-to').value, MAX_NAME);
    if (!f) return invalid($('in-from'));
    const o = { f };
    if (t) o.t = t;
    inviteUrl = baseUrl() + '#d=' + enc(o);
    $('made-link').value = inviteUrl;
    $('made').hidden = false;
    sfx.ding();
  });
  $('btn-share').addEventListener('click', () => shareOut('Sana bir davet var 💌', inviteUrl));
  $('btn-copy').addEventListener('click', (e) => copyText(inviteUrl, e.currentTarget));

  /* ---------- 1) Davet ---------- */
  let S = {};            // akış durumu
  let attempts = 0;
  let lastDodge = 0;
  const yesB = $('btn-yes');
  const noB = $('btn-no');

  function showInvite(h) {
    S = { f: h.f, t: h.t, date: null, time: null, timeSet: false, place: null, note: '' };
    $('invite-title').textContent = (S.t ? S.t + ', ' : '') + S.f + ' seni dışarı çıkarmak istiyor';
    // sıfırla
    attempts = 0;
    noB.className = 'btn ghost no';
    noB.removeAttribute('style');
    noB.textContent = 'Hayır';
    yesB.style.transform = '';
    $('invite-main').hidden = false;
    $('yay').hidden = true;
    show('s-invite');
  }

  function dodge() {
    const now = Date.now();
    if (attempts >= 4 || now - lastDodge < 250) return;
    lastDodge = now;
    attempts++;
    sfx.nope();

    const yes = 1 + attempts * 0.2;
    const prevYes = 1 + (attempts - 1) * 0.2;
    const yr = yesB.getBoundingClientRect();
    yesB.style.transform = `scale(${yes})`;

    if (attempts >= 4) {
      noB.classList.add('gone');
      setTimeout(() => (noB.hidden = true), 300);
      return;
    }
    noB.textContent = NO_TEXTS[attempts - 1];

    // konumlar .actions kutusuna göre; sınırlar kart
    const cr = noB.closest('.card').getBoundingClientRect();
    const ar = $('actions').getBoundingClientRect();
    if (!noB.classList.contains('free')) {
      const nr = noB.getBoundingClientRect();
      noB.style.left = nr.left - ar.left + 'px';
      noB.style.top = nr.top - ar.top + 'px';
      noB.classList.add('free');
      void noB.offsetWidth;
    }
    noB.style.transform = `scale(${1 - attempts * 0.15})`;

    // "Evet"in büyümüş halinin kapladığı alan
    const k = yes / prevYes;
    const ew = yr.width * k, eh = yr.height * k;
    const ex = yr.left + yr.width / 2, ey = yr.top + yr.height / 2;
    const w = noB.offsetWidth, h = noB.offsetHeight, gap = 14;
    let x = 0, y = 0;
    for (let i = 0; i < 40; i++) {
      x = rand(gap, Math.max(gap, cr.width - w - gap));
      y = rand(gap, Math.max(gap, cr.height - h - gap));
      const nx = cr.left + x + w / 2, ny = cr.top + y + h / 2;
      const hit = Math.abs(nx - ex) < (ew + w) / 2 + 8 && Math.abs(ny - ey) < (eh + h) / 2 + 8;
      if (!hit) break;
    }
    noB.style.left = x + cr.left - ar.left + 'px';
    noB.style.top = y + cr.top - ar.top + 'px';
  }

  // mobilde dokununca, masaüstünde yaklaşınca kaç
  noB.addEventListener('pointerdown', (e) => { e.preventDefault(); dodge(); });
  noB.addEventListener('click', (e) => { if (e.detail === 0) dodge(); });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || cur !== $('s-invite') || attempts >= 4) return;
    const r = noB.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (d < Math.max(r.width, r.height) / 2 + 40) dodge();
  });

  yesB.addEventListener('click', () => {
    sfx.yes();
    confetti(200);
    $('invite-main').hidden = true;
    $('yay').hidden = false;
    setTimeout(() => { buildDates(); show('s-date'); }, 1000);
  });

  /* ---------- 2) Tarih ---------- */
  function choose(grid, btn) {
    grid.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
    btn.classList.add('sel');
  }
  function buildDates() {
    const grid = $('date-grid');
    grid.replaceChildren();
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const b = el('button', 'chip', `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`);
      b.type = 'button';
      if (i < 2) b.appendChild(el('small', '', i === 0 ? 'Bugün' : 'Yarın'));
      b.addEventListener('click', () => {
        S.date = ymd(d);
        choose(grid, b);
        setTimeout(() => { buildTimes(); show('s-time'); }, 220);
      });
      grid.appendChild(b);
    }
  }

  /* ---------- 3) Saat ---------- */
  function buildTimes() {
    const grid = $('time-grid');
    grid.replaceChildren();
    const add = (label, value, cls) => {
      const b = el('button', 'chip' + (cls ? ' ' + cls : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => {
        S.time = value;
        S.timeSet = true;
        choose(grid, b);
        setTimeout(() => show('s-place'), 220);
      });
      grid.appendChild(b);
    };
    for (let h = 12; h <= 22; h++) add(`${pad(h)}:00`, `${pad(h)}:00`);
    add('Sen söyle 🤷', null, 'wide');
  }

  /* ---------- 4) Mekan ---------- */
  (function buildPlaces() {
    const grid = $('place-grid');
    Object.keys(PLACES).forEach((key) => {
      const b = el('button', 'pcard');
      b.type = 'button';
      b.appendChild(el('span', '', PLACES[key].e));
      b.appendChild(document.createTextNode(PLACES[key].n));
      b.addEventListener('click', () => {
        S.place = key;
        choose(grid, b);
        $('btn-place-next').disabled = false;
      });
      grid.appendChild(b);
    });
  })();
  $('btn-place-next').addEventListener('click', () => {
    S.note = clean($('in-note').value, MAX_NOTE);
    setToName = renderTicket($('ticket-slot'), S, false);
    $('name-field').hidden = !!S.t;
    $('sent').hidden = true;
    show('s-ticket');
  });

  /* ---------- Bilet çizimi ---------- */
  function renderTicket(slot, d, stamped) {
    const place = PLACES[d.place];
    const t = el('div', 'ticket');

    const main = el('div', 't-main');
    main.appendChild(el('div', 't-label', 'RANDEVU BİLETİ'));
    const names = el('div', 't-names');
    names.appendChild(document.createTextNode(d.f + ' '));
    names.appendChild(el('span', 'heart', '♥'));
    const toName = document.createTextNode(' ' + (d.t || '…'));
    names.appendChild(toName);
    main.appendChild(names);
    main.appendChild(el('div', 't-date', longDate(parseDate(d.date))));
    main.appendChild(el('div', 't-time', d.time ? 'Saat ' + d.time : 'Saati sonra konuşuruz 🤷'));

    const stub = el('div', 't-stub');
    const pl = el('div', 't-place');
    pl.appendChild(el('span', '', place.e));
    pl.appendChild(document.createTextNode(place.n));
    stub.appendChild(pl);
    if (d.note) stub.appendChild(el('div', 't-note', '📍 ' + d.note));

    t.append(main, stub);
    if (stamped) t.appendChild(el('div', 'stamp', 'ONAYLANDI'));
    slot.replaceChildren(t);
    return (name) => (toName.nodeValue = ' ' + (name || '…'));
  }

  /* ---------- 5) Bilet ekranı ---------- */
  let resultUrl = '';
  let setToName = () => {};
  $('in-name').addEventListener('input', (e) => setToName(clean(e.target.value, MAX_NAME)));

  $('btn-confirm').addEventListener('click', async () => {
    if (!S.t) {
      const n = clean($('in-name').value, MAX_NAME);
      if (!n) return invalid($('in-name'));
      S.t = n;
    }
    resultUrl = baseUrl() + '#r=' + enc({
      f: S.f, t: S.t, date: S.date, time: S.time, place: S.place, note: S.note,
    });
    const text = `${S.t} randevunu kabul etti! Detaylar burada 👉 ${resultUrl}`;
    $('btn-wa').href = 'https://wa.me/?text=' + encodeURIComponent(text);
    $('sent').hidden = false;
    sfx.ding();
    if (navigator.share) {
      try { await navigator.share({ text: 'Randevumuz hazır 💌', url: resultUrl }); } catch (e) {}
    }
  });
  $('btn-copy2').addEventListener('click', (e) => copyText(resultUrl, e.currentTarget));

  /* ---------- 6) Sonuç ---------- */
  let R = null;
  function showResult(r) {
    R = r;
    $('result-title').textContent = r.t + ' kabul etti! 🎉';
    renderTicket($('result-slot'), r, true);
    const place = PLACES[r.place];
    const q = place.n + (r.note ? ' ' + r.note : '');
    $('btn-map').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    show('s-result');
    setTimeout(() => confetti(220), 350);
    setTimeout(sfx.ding, 800);
  }

  function buildIcs(r) {
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const compact = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const day = parseDate(r.date);
    let start, end;
    if (r.time) {
      const [h, m] = r.time.split(':').map(Number);
      const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h + 2, m);
      const stamp = (d) => `${compact(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
      start = 'DTSTART:' + stamp(s);
      end = 'DTEND:' + stamp(e);
    } else {
      const e = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      start = 'DTSTART;VALUE=DATE:' + compact(day);
      end = 'DTEND;VALUE=DATE:' + compact(e);
    }
    const loc = PLACES[r.place].n + (r.note ? ', ' + r.note : '');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//memir.codes//randevu//TR', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@memir.codes',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
      start, end,
      'SUMMARY:' + esc(`${r.f} ♥ ${r.t} randevu`),
      'LOCATION:' + esc(loc),
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
  }
  $('btn-ics').addEventListener('click', () => {
    if (!R) return;
    const blob = new Blob([buildIcs(R)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = 'randevu.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
  $('btn-new').addEventListener('click', () => {
    history.pushState(null, '', location.pathname + location.search);
    route();
  });

  /* ---------- Yönlendirme ---------- */
  function route() {
    const h = readHash();
    if (h && h.type === 'd') showInvite(h);
    else if (h && h.type === 'r') showResult(h);
    else showCreate();
  }
  addEventListener('hashchange', route);
  route();
})();
