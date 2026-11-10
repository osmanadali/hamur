// Hamur — oyun: tahta, sürükleme, niyet okuma, çizim, geri alma. Prototipten (hamur.html) taşındı.
// Kurallar www/rules/cekirdek.js'te, çıkmaz kanıtı www/rules/cozucu.js'te; burada kural yazılmaz.
(() => {
'use strict';
const K = window.HamurKural, Coz = window.HamurCozucu, LEVELS = window.HAMUR_BOLUMLER, App = window.__hamur, save = App.save;
const { DIRS, PARTS, fuseColor, canMove } = K;

// Oynatarak verilecek kararlar ve his ayarları (yol haritası › Oynatarak verilecek kararlar, Niyet okuma). Süreler başlangıç değeridir.
const CFG = {
  niyet: true,      // true: yanından geçen yapışmaz, parmak okunur · false: prototipin eski hali (değdiği an yapışır)
  geriHak: 1,       // bölüm başına ücretsiz geri alma (0: yok)
  itSn: .15,        // öteki parçaya doğru itince iplik bu kadar sürede dolar
  kararsizSn: .5,   // yanında duruyor, yönü belli değil
  kopSn: .12,       // ters yöne çekince iplik bu kadar sürede kopar
  itEsik: .3,       // parmağın öteki parçaya doğru yaslanması (kare) → "itiyor"
  cekEsik: .2,      // ters yöne yaslanma (kare) → "kaçınıyor"
  gecHiz: .8,       // yanından geçme hızı (kare/sn) → "sadece geçiyor"
};

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage');
const css = getComputedStyle(document.documentElement), C = {};
for (const k of ['r', 'y', 'b', 'g', 'o', 'p', 'mat', 'field', 'grid', 'rule', 'wall', 'pit']) C[k] = css.getPropertyValue('--' + k).trim();
const NAME = { r: L('Kırmızı', 'Red'), y: L('Sarı', 'Yellow'), b: L('Mavi', 'Blue'), g: L('Yeşil', 'Green'), o: L('Turuncu', 'Orange'), p: L('Mor', 'Purple') };
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MIXMS = RM ? 450 : 1050, PAD = 20;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const tint = (h, s) => 'rgb(' + rgb(h).map(v => Math.round(v * s)).join(',') + ')';
const rgba = (h, a) => 'rgba(' + rgb(h).join(',') + ',' + a + ')';
const lighten = (h, t) => '#' + rgb(h).map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
const tone = Ses.fx, buzz = Ses.buzz;

const ASIL = LEVELS.length;   // sonrasına eklenenler deneme bölümüdür (editör, test): ilerlemeye yazılmaz
let st, cz, Lv, li = clamp((save.level || 1) - 1, 0, LEVELS.length - 1), done = new Set(save.done || []);
let cell = 60, dpr = 1, state = 'play', timeLeft = 0, running = false, drag = null, sinks = [], parts = [], rings = [], after = null, wonAt = 0, shownS = -1, wallPath = null, last = performance.now();
let threads = new Map();   // tutulan parçanın komşularıyla arasındaki hamur iplikleri: q → { v: 0…1 doluluk, seam, color }
let geri = null, geriKalan = 0;   // geri: son yapışmanın olduğu sürüklemenin başındaki durum

/* ---------- şekiller ---------- */
function outline(cells) {
  const S = new Set(cells.map(c => K.key(c[0], c[1]))), E = [];
  for (const [x, y] of cells) {
    S.has(K.key(x, y - 1)) || E.push([x, y, 1, 0]);
    S.has(K.key(x + 1, y)) || E.push([x + 1, y, 0, 1]);
    S.has(K.key(x, y + 1)) || E.push([x + 1, y + 1, -1, 0]);
    S.has(K.key(x - 1, y)) || E.push([x, y + 1, 0, -1]);
  }
  const by = new Map();
  for (const e of E) { const k = K.key(e[0], e[1]); by.has(k) ? by.get(k).push(e) : by.set(k, [e]); }
  const loops = [];
  for (const e0 of E) {
    if (e0.u) continue;
    const loop = []; let e = e0;
    while (!e.u) {
      e.u = 1; loop.push(e);
      const c = by.get(K.key(e[0] + e[2], e[1] + e[3]));
      e = c.find(n => n[2] === -e[3] && n[3] === e[2]) || c.find(n => n[2] === e[2] && n[3] === e[3]) || c[0];
    }
    const pts = [], n = loop.length;
    for (let i = 0; i < n; i++) {
      const a = loop[(i + n - 1) % n], b = loop[i];
      if (a[2] !== b[2] || a[3] !== b[3]) pts.push([b[0], b[1], -a[3] - b[3], a[2] + b[2]]);
    }
    loops.push(pts);
  }
  return loops;
}
function pathOf(cells, inset, rad) {
  const P = new Path2D();
  for (const pts of outline(cells)) {
    const q = pts.map(([x, y, nx, ny]) => [x * cell + nx * inset, y * cell + ny * inset]), n = q.length;
    P.moveTo((q[n - 1][0] + q[0][0]) / 2, (q[n - 1][1] + q[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const b = q[(i + 1) % n];
      P.arcTo(q[i][0], q[i][1], (q[i][0] + b[0]) / 2, (q[i][1] + b[1]) / 2, rad);
    }
    P.closePath();
  }
  return P;
}
const relPath = p => { const [x0, y0] = p.cells[0]; return pathOf(p.cells.map(c => [c[0] - x0, c[1] - y0]), cell * .045, cell * .27); };
const vis = () => st.pieces.concat(sinks.map(s => s.p));
function center(p) {
  let x = 0, y = 0; for (const c of p.cells) { x += c[0] + .5; y += c[1] + .5; }
  return [x / p.cells.length * cell, y / p.cells.length * cell];
}
function gap(p, q) {
  let m = 99;
  for (const a of p.cells) for (const b of q.cells) m = Math.min(m, Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]));
  return m;
}

/* ---------- bölüm kurulumu + yerleşim ---------- */
// Kural durumundaki parçaya çizim alanlarını ekle (yüzün olduğu kare: en üstteki, eşitse en soldaki)
function giydir(p) {
  let f = 0; p.cells.forEach((c, j) => { const b = p.cells[f]; if (c[1] < b[1] || (c[1] === b[1] && c[0] < b[0])) f = j; });
  return Object.assign(p, { ox: 0, oy: 0, pulse: 0, pv: 0, lift: 0, face: f, seed: Math.random() * 9, mix: null, flash: null, shakeT: 0 });
}
function setup(i) {
  li = i; Lv = LEVELS[i]; st = K.load(Lv); cz = Coz.hazirla(st);
  if (i < ASIL) { save.level = i + 1; App.persist(); }
  st.pieces.forEach(giydir);
  state = 'play'; timeLeft = Lv.t; running = false; drag = null; sinks = []; parts = []; rings = []; after = null; wonAt = 0; shownS = -1;
  threads = new Map(); geri = null; geriKalan = CFG.geriHak;
  $('ov').hidden = true; $('hint').textContent = L(...Lv.hint); $('rx').hidden = i < 2;
  $('pills').innerHTML = '';
  LEVELS.forEach((_, j) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pill' + (done.has(j + 1) ? ' done' : ''); b.textContent = j + 1; b.id = 'lvl' + j;
    b.setAttribute('aria-label', L('Bölüm ', 'Level ') + (j + 1));
    if (j === i) b.setAttribute('aria-current', 'true');
    b.onclick = () => setup(j);
    $('pills').appendChild(b);
  });
  paintUndo(); layout();
  window.Olcum?.event('level_start', { level: i + 1 });
}
function layout() {
  if (!st) return;
  const s = stage.getBoundingClientRect();
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  cell = Math.max(22, Math.floor(Math.min((s.width - 2 * PAD) / st.W, (s.height - 2 * PAD) / st.H, 86)));
  const w = st.W * cell + 2 * PAD, h = st.H * cell + 2 * PAD;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  for (const p of vis()) p.path = relPath(p);
  for (const h2 of st.holes) h2.path = pathOf(h2.cells, 2, cell * .2);
  wallPath = st.wallCells.length ? pathOf(st.wallCells, 1, cell * .15) : null;
}

/* ---------- hamleler ---------- */
function burst(x, y, cols, n, sp) {
  if (RM) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = sp * (.35 + Math.random());
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: .4 + Math.random() * .35, c: cols[i % cols.length], r: cell * (.03 + Math.random() * .05) });
  }
}
// Çekirdekten gelen olayları (yapışma, kalıba oturma) ekrana ve sese yansıt, sonra kazanma / çıkmaz denetimi.
function olaylar(p, ev) {
  const now = performance.now();
  for (const e of ev) {
    if (e.type === 'fuse') {
      const [x0, y0] = p.cells[0];
      let mx = 0, my = 0;
      for (const s of e.seam) { mx += s[0] + .5 + s[2] / 2 - x0; my += s[1] + .5 + s[3] / 2 - y0; }
      mx /= e.seam.length; my /= e.seam.length;
      p.path = relPath(p);
      const a = C[e.cols[0]], b = C[e.cols[e.cols.length - 1]];
      if (e.mixed) p.mix = { t0: now, cols: e.cols, lead: lighten(C[e.color], .42), srcs: [a, b], seed: Math.random() * 6, ox: mx, oy: my };
      else if (p.mix) p.mix.cols = p.mix.cols.concat(e.cols.slice(p.mix.cols.length));
      if (p.mix) p.mix.maxR = Math.max(...p.cells.map(c => Math.hypot(c[0] + .5 - x0 - p.mix.ox, c[1] + .5 - y0 - p.mix.oy))) + .8;
      p.flash = { t0: now, segs: e.seam.map(s => [s[0] - x0, s[1] - y0, s[2], s[3]]) };
      p.pv += 1.5;
      burst((x0 + mx) * cell, (y0 + my) * cell, [a, b], 12, cell * 2.6);
      if (e.mixed) { buzz([16, 40, 16]); tone(280, .2, 'sine', 130, .16); tone(420, .7, 'sine', 700, .05, .05); }
      else { buzz(14); tone(300, .16, 'sine', 150, .16); tone(640, .09, 'triangle', 880, .05, .03); }
      threads.delete(e.q);
      if (drag && drag.snap) { geri = drag.snap; drag.snap = null; paintUndo(); }   // geri alma: bu sürüklemenin başına döner
    } else {
      sinks.push({ p, h: e.hole, t0: now + (p.mix ? MIXMS * .62 : 70) });
      if (drag && drag.p === p) drag = null;
      threads = new Map();
    }
  }
  if (!ev.length) return;
  if (st.pieces.length === 0) { state = 'won'; running = false; wonAt = 0; }
  else if (Coz.cikmaz(st, cz)) lose('doom', K.doomed(st) || (st.pieces.includes(p) ? p : st.pieces[0]));
}
function tryStep(p, dx, dy) {
  const ev = CFG.niyet ? K.move(st, p, dx, dy) : K.step(st, p, dx, dy);
  if (!ev) return false;
  p.ox -= dx * cell; p.oy -= dy * cell; p.pv += .25;
  olaylar(p, ev);
  return true;
}
// Parmağın tuttuğu karenin merkezine göre yaslanması (kare cinsinden)
const yaslan = () => { const g = drag.p.cells[drag.gi]; return [drag.px / cell - g[0] - .5 - drag.offx, drag.py / cell - g[1] - .5 - drag.offy]; };
function dragTo() {
  let n = 0;
  while (drag && state === 'play' && n++ < 30) {
    const p = drag.p, [fx, fy] = yaslan();
    const sx = Math.abs(fx) > .58 ? Math.sign(fx) : 0, sy = Math.abs(fy) > .58 ? Math.sign(fy) : 0;
    if (!sx && !sy) break;
    const tries = Math.abs(fx) >= Math.abs(fy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
    if (!tries.some(([dx, dy]) => (dx || dy) && tryStep(p, dx, dy))) break;
  }
}
// Niyet okuma: yapışma tek bir an değil, dolan bir ölçü. Üç sinyal: parmağın son 0,1 sn'deki yönü, kare içinde hangi tarafa
// yaslandığı, yan yana geçen süre. Karar her zaman görünür (iplik kalınlaşır). Aynı kural renk karışımı için de geçerli.
function niyet(dt, now) {
  const p = drag.p, T = K.touching(st, p);
  for (const q of [...threads.keys()]) if (!T.some(t => t.q === q)) threads.delete(q);
  if (!T.length) return;
  const [fx, fy] = yaslan(), h = drag.hist;
  while (h.length > 1 && now - h[0].t > 100) h.shift();
  const son = h[h.length - 1], span = Math.max(.016, (son.t - h[0].t) / 1000), taze = now - son.t < 100 && h.length > 1;
  const vx = taze ? (son.x - h[0].x) / cell / span : 0, vy = taze ? (son.y - h[0].y) / cell / span : 0;
  for (const t of T) {
    let dx = 0, dy = 0; for (const s of t.seam) { dx += s[2]; dy += s[3]; }
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    const it = fx * dx + fy * dy, yanHiz = Math.abs(vx * -dy + vy * dx), yan = Math.abs(fx * -dy + fy * dx);
    const sgn = Math.sign(fx * -dy + fy * dx), gecebilir = sgn !== 0 && canMove(st, p, Math.round(-dy * sgn), Math.round(dx * sgn));
    let th = threads.get(t.q); if (!th) threads.set(t.q, th = { v: 0, ne: '' });
    th.seam = t.seam; th.color = t.color;
    if (it < -CFG.cekEsik) { th.ne = 'kacin'; th.v -= dt / CFG.kopSn; }                                   // ters yöne çekiyor: iplik incelir ve kopar
    else if (it > CFG.itEsik) { th.ne = 'it'; th.v += dt / CFG.itSn; }                                    // öteki parçaya doğru itiyor
    else if (gecebilir && (yanHiz > CFG.gecHiz || yan > .3)) { th.ne = 'gec'; th.v -= dt / CFG.kararsizSn; }   // yanından geçip gidiyor: dolmaz
    else { th.ne = 'kararsiz'; th.v += dt / CFG.kararsizSn; }                                             // yanında duruyor, yönü belli değil
    th.v = clamp(th.v, 0, 1);
    if (th.v >= 1) { olaylar(p, [K.fuse(st, p, t.q)]); if (state === 'play' && st.pieces.includes(p)) { const s = K.sink(st, p); if (s) olaylar(p, [s]); } return; }
  }
}
// Parmak kalktı: parça olduğu yerde kaldı → yapışabileceği her şeye yapışır.
function birak() {
  const p = drag.p, d = drag;
  if (CFG.niyet && state === 'play' && st.pieces.includes(p) && K.touching(st, p).length) olaylar(p, K.settle(st, p));
  if (drag === d) drag = null;
  threads = new Map();
}
function showOv(t, p, b, fn, b2, fn2) {
  $('ovT').textContent = t; $('ovP').textContent = p; $('ovB').textContent = b; $('ovB').onclick = fn;
  $('ovB2').hidden = !b2; if (b2) { $('ovB2').textContent = b2; $('ovB2').onclick = fn2; }
  $('ov').hidden = false;
}
function lose(kind, piece) {
  state = 'lost'; running = false; drag = null; threads = new Map();
  const now = performance.now(), yine = L('Tekrar dene', 'Try again');
  window.Olcum?.event('level_fail', { level: li + 1, reason: kind, time_left: Math.ceil(timeLeft) });
  if (kind === 'doom') {
    piece.shakeT = now; buzz([30, 50, 70]); tone(210, .4, 'sawtooth', 80, .07, .25);
    const open = st.holes.filter(h => !h.filled);
    const msg = PARTS[piece.color] && !open.some(h => h.color === piece.color) ? NAME[piece.color] + L(' renkte kalıp yok. Bu parça artık hiçbir yere giremez.', ' has no mold. This piece cannot go anywhere now.') : L('Bu parça artık hiçbir kalıba uymuyor.', 'This piece no longer fits any mold.');
    after = { at: now + 1400, fn: () => geri && geriKalan > 0
      ? showOv(L('Yanlış yapıştı', 'Wrong stick'), msg, L('Geri al', 'Undo'), geriAl, yine, () => setup(li))
      : showOv(L('Yanlış yapıştı', 'Wrong stick'), msg, yine, () => setup(li)) };
  } else {
    buzz([60, 40, 60]); tone(210, .45, 'sawtooth', 70, .08);
    showOv(L('Süre bitti', 'Time is up'), L('Parçalar kalıba yetişmedi.', 'The pieces did not reach the molds in time.'), yine, () => setup(li));
  }
}
// Geri alma: son yapışmanın olduğu sürüklemenin başına döner. Süre geri gelmez.
function geriAl() {
  if (!geri || geriKalan <= 0 || state === 'won') return;
  geriKalan--; st = geri; geri = null; cz = Coz.hazirla(st);
  st.pieces.forEach(giydir); for (const h of st.holes) h.shown = h.filled;
  state = 'play'; running = true; drag = null; sinks = []; rings = []; after = null; threads = new Map();
  $('ov').hidden = true; paintUndo(); layout();
  buzz(10); tone(520, .12, 'sine', 300, .06);
  window.Olcum?.event('undo', { level: li + 1 });
}
const paintUndo = () => { const b = $('undo'); b.hidden = !CFG.geriHak; b.disabled = !(geri && geriKalan > 0); };
// Bölüm arası reklam: yalnız kazanınca, sıradaki tahta gelmeden önce. İlk 10 bölümde yok, sonra 3 bölümde bir (iki reklam arası en az 90 sn: ads.js).
async function sonraki(i) {
  if (!save.noads && li + 1 > 10 && save.wins % 3 === 0) await Ads.interstitial();
  setup(i);
}
function win() {
  if (li < ASIL) { done.add(li + 1); save.done = [...done]; save.wins = (save.wins || 0) + 1; App.persist(); }
  const b = $('lvl' + li); if (b) b.classList.add('done');
  [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', 0, .07, i * .09));
  window.Olcum?.event('level_end', { level: li + 1, time_left: Math.ceil(timeLeft) });
  Ads.warm();
  const lastOne = li === LEVELS.length - 1, kalan = L('Kalan süre ', 'Time left: ') + Math.ceil(timeLeft) + L(' sn.', ' s.');
  showOv(lastOne ? L('Hepsi tamam', 'All done') : L('Bölüm tamam', 'Level complete'),
    lastOne ? L('Bütün bölümler bitti. ', 'Every level is finished. ') + kalan : kalan,
    lastOne ? L('Baştan oyna', 'Play again') : L('Sıradaki bölüm', 'Next level'), () => sonraki(lastOne ? 0 : li + 1));
}

/* ---------- girdi ---------- */
function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left - PAD, e.clientY - r.top - PAD]; }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || drag) return;
  const [x, y] = pos(e), gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const p = st.pieces.find(q => q.cells.some(c => c[0] === gx && c[1] === gy));
  if (!p) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch {}
  drag = { p, id: e.pointerId, gi: p.cells.findIndex(c => c[0] === gx && c[1] === gy), offx: x / cell - gx - .5, offy: y / cell - gy - .5, px: x, py: y,
    hist: [{ t: performance.now(), x, y }], snap: CFG.geriHak ? K.clone(st) : null };
  running = true; p.pv += .9; tone(520, .07, 'sine', 700, .05); buzz(6);
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const [x, y] = pos(e); drag.px = x; drag.py = y; drag.hist.push({ t: performance.now(), x, y }); dragTo();
});
const drop = e => { if (drag && e.pointerId === drag.id) birak(); };
cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);
$('retry').onclick = () => setup(li);
$('undo').onclick = geriAl;
const paintSound = () => { $('sound').classList.toggle('off', !save.sound); $('sound').setAttribute('aria-pressed', String(save.sound)); };
$('sound').onclick = () => { save.sound = !save.sound; App.persist(); paintSound(); };
paintSound();

/* ---------- çizim ---------- */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function board() {
  const W = st.W * cell, H = st.H * cell;
  rr(-PAD + 1, -PAD + 1, W + 2 * PAD - 2, H + 2 * PAD - 2, 18); ctx.fillStyle = C.mat; ctx.fill();
  rr(0, 0, W, H, 8); ctx.fillStyle = C.field; ctx.fill();
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 1; i < st.W; i++) { ctx.moveTo(i * cell + .5, 0); ctx.lineTo(i * cell + .5, H); }
  for (let i = 1; i < st.H; i++) { ctx.moveTo(0, i * cell + .5); ctx.lineTo(W, i * cell + .5); }
  ctx.stroke();
  // kesim altlığı cetveli
  ctx.fillStyle = C.rule; ctx.font = '600 9px system-ui,sans-serif'; ctx.textBaseline = 'alphabetic';
  for (let i = 0; i <= st.W; i++) {
    ctx.fillRect(i * cell - .5, -7, 1, 5);
    if (i < st.W) ctx.fillRect(i * cell + cell / 2 - .5, -5, 1, 3);
    if (i && i < st.W) ctx.fillText(i, i * cell + 3, -8);
  }
  for (let i = 0; i <= st.H; i++) {
    ctx.fillRect(-7, i * cell - .5, 5, 1);
    if (i < st.H) ctx.fillRect(-5, i * cell + cell / 2 - .5, 3, 1);
    if (i && i < st.H) ctx.fillText(i, -16, i * cell - 3);
  }
  if (wallPath) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.save(); ctx.translate(0, cell * .05); ctx.fill(wallPath); ctx.restore();
    ctx.fillStyle = tint(C.wall, .62); ctx.fill(wallPath);
    ctx.save(); ctx.translate(0, -cell * .08); ctx.fillStyle = C.wall; ctx.fill(wallPath);
    ctx.clip(wallPath); ctx.lineWidth = cell * .08; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.translate(cell * .03, cell * .04); ctx.stroke(wallPath);
    ctx.restore();
  }
}
function drawHole(h, now) {
  const c = C[h.color];
  ctx.save();
  if (h.shown) {
    ctx.fillStyle = tint(c, .8); ctx.fill(h.path);
    ctx.clip(h.path); ctx.lineWidth = cell * .1; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.translate(0, cell * .05); ctx.stroke(h.path);
  } else {
    ctx.fillStyle = C.pit; ctx.fill(h.path);
    ctx.fillStyle = rgba(c, .2); ctx.fill(h.path);
    ctx.save(); ctx.clip(h.path); ctx.lineWidth = cell * .16; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.translate(0, cell * .07); ctx.stroke(h.path); ctx.restore();
    ctx.setLineDash([cell * .15, cell * .11]); ctx.lineDashOffset = RM ? 0 : -now / 55;
    ctx.lineWidth = Math.max(2, cell * .055); ctx.strokeStyle = c; ctx.stroke(h.path);
  }
  ctx.restore();
}
function blob(x, y, R, now, s) {
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = i / 40 * 6.2832, r = R * (1 + .09 * Math.sin(3 * a + s) + .06 * Math.sin(7 * a - s * 2 + now / 260));
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function body(p, sh, dy, now) {
  const [x0, y0] = p.cells[0], m = p.mix;
  ctx.save(); ctx.translate(0, dy); ctx.clip(p.path);
  if (m) {
    const t = Math.min(1, (now - m.t0) / MIXMS);
    p.cells.forEach((c, i) => { ctx.fillStyle = tint(C[m.cols[i]], sh); ctx.fillRect((c[0] - x0) * cell - 2, (c[1] - y0) * cell - 2, cell + 4, cell + 4); });
    // yeni renk temas noktasından yayılır
    const R = m.maxR * cell * 1.3 * (1 - Math.pow(1 - t, 2.2)), ox = m.ox * cell, oy = m.oy * cell;
    blob(ox, oy, R, now, m.seed); ctx.fillStyle = tint(m.lead, sh); ctx.fill();
    blob(ox, oy, Math.max(0, R - cell * .28) * .95, now, m.seed + 2); ctx.fillStyle = tint(C[p.color], sh); ctx.fill();
    if (sh === 1) {
      ctx.lineWidth = cell * .07; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const r2 = R * (.2 + .17 * i);
        if (r2 < 4) continue;
        const a = m.seed + i * 1.7 + t * (5 + i);
        ctx.strokeStyle = rgba(m.srcs[i % 2], .55 * (1 - t));
        ctx.beginPath(); ctx.arc(ox, oy, r2, a, a + 1.8); ctx.stroke();
      }
    }
  } else {
    ctx.fillStyle = tint(C[p.color], sh); ctx.fillRect(-12 * cell, -12 * cell, 24 * cell, 24 * cell);
  }
  ctx.restore();
}
function face(p, now) {
  const [x0, y0] = p.cells[0], f = p.cells[p.face], fx = (f[0] - x0 + .5) * cell, fy = (f[1] - y0 + .5) * cell;
  const panic = state === 'play' && running && timeLeft < 10;
  let lx = Math.sin(now / 1700 + p.seed) * .5, ly = Math.cos(now / 2300 + p.seed) * .3;
  if (drag) {
    const t = drag.p === p ? [drag.px, drag.py] : center(drag.p), dx = t[0] - (x0 * cell + fx), dy = t[1] - (y0 * cell + fy), d = Math.hypot(dx, dy) || 1;
    lx = dx / d; ly = dy / d;
  }
  const blink = ((now + p.seed * 900) % 3800) < 130 ? .15 : 1, es = cell * (panic ? .078 : .062), g = cell * .15, ey = fy - cell * .05;
  const jx = panic && !RM ? Math.sin(now / 38 + p.seed) * cell * .012 : 0;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(fx + s * g + jx, ey, es, es * 1.15 * blink, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#1b2030'; ctx.beginPath(); ctx.ellipse(fx + s * g + jx + lx * es * .4, ey + ly * es * .4 * blink, es * .55, es * .62 * blink, 0, 0, 6.2832); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(27,32,48,.75)'; ctx.lineWidth = Math.max(1.5, cell * .032); ctx.lineCap = 'round'; ctx.beginPath();
  if (panic) ctx.ellipse(fx + jx, fy + cell * .16, cell * .035, cell * .05, 0, 0, 6.2832);
  else ctx.arc(fx, fy + cell * .07, cell * .075, .2 * Math.PI, .8 * Math.PI);
  ctx.stroke();
}
function drawPiece(p, now, k, glow) {
  const [x0, y0] = p.cells[0], depth = cell * (.12 + .05 * p.lift) * k, up = cell * .06 * p.lift * k;
  const [cx, cy] = center(p), s = (1 + p.pulse) * (1 + .03 * p.lift);
  let sh = 0;
  if (p.shakeT && now - p.shakeT < 800) { const t = (now - p.shakeT) / 800; sh = Math.sin((now - p.shakeT) / 26) * cell * .07 * (1 - t); }
  ctx.save();
  ctx.translate(cx + p.ox + sh, cy + p.oy); ctx.scale(s, s); ctx.translate(-cx + x0 * cell, -cy + y0 * cell);
  ctx.save(); ctx.translate(0, cell * .07 + up * .9); ctx.fillStyle = 'rgba(0,0,0,' + (.3 * k) + ')'; ctx.fill(p.path); ctx.restore();
  body(p, .64, -up, now);
  ctx.translate(0, -up - depth);
  body(p, 1, 0, now);
  ctx.save(); ctx.clip(p.path);
  if (p.flash) {
    const t = (now - p.flash.t0) / 480;
    if (t >= 1) p.flash = null;
    else {
      ctx.strokeStyle = 'rgba(255,255,255,' + (.9 * (1 - t)) + ')'; ctx.lineWidth = cell * .14 * (1 - t) + 1; ctx.lineCap = 'round'; ctx.beginPath();
      for (const [x, y, dx, dy] of p.flash.segs) {
        const mx = (x + .5 + dx / 2) * cell, my = (y + .5 + dy / 2) * cell;
        ctx.moveTo(mx - dy * cell * .36, my - dx * cell * .36); ctx.lineTo(mx + dy * cell * .36, my + dx * cell * .36);
      }
      ctx.stroke();
    }
  }
  ctx.lineWidth = cell * .12;
  ctx.translate(cell * .035, cell * .045); ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.stroke(p.path);
  ctx.translate(-cell * .07, -cell * .09); ctx.strokeStyle = 'rgba(0,0,0,.17)'; ctx.stroke(p.path);
  ctx.restore();
  if (glow) { ctx.lineWidth = cell * .075; ctx.strokeStyle = rgba(C[glow], .6 + .3 * Math.sin(now / 90)); ctx.stroke(p.path); }
  if (k > .25) face(p, now);
  ctx.restore();
}
// Hamur ipliği: iki parçanın ortak kenarında, çıkacak renkte, doldukça kalınlaşan köprü. Oyuncu ne olacağını buradan görür.
function drawThreads(now) {
  if (!drag) return;
  const p = drag.p, up = cell * (.17 + .06 * p.lift) * .7;
  for (const th of threads.values()) {
    if (th.v <= .02 || !th.seam) continue;
    const w = cell * (.1 + .5 * th.v), wob = RM ? 0 : Math.sin(now / 70) * cell * .015;
    ctx.fillStyle = lighten(C[th.color], .25 * (1 - th.v));
    for (const [x, y, dx, dy] of th.seam) {
      const mx = (x + .5 + dx / 2) * cell + p.ox * .5, my = (y + .5 + dy / 2) * cell + p.oy * .5 - up;
      const len = cell * .34;   // dikişi aşan köprü: ortası ince (bel), dolunca düzleşir
      const bel = w * (.35 + .65 * th.v) + wob;
      ctx.beginPath();
      if (dx) {
        ctx.moveTo(mx - len, my - w / 2); ctx.quadraticCurveTo(mx, my - bel / 2, mx + len, my - w / 2);
        ctx.lineTo(mx + len, my + w / 2); ctx.quadraticCurveTo(mx, my + bel / 2, mx - len, my + w / 2);
      } else {
        ctx.moveTo(mx - w / 2, my - len); ctx.quadraticCurveTo(mx - bel / 2, my, mx - w / 2, my + len);
        ctx.lineTo(mx + w / 2, my + len); ctx.quadraticCurveTo(mx + bel / 2, my, mx + w / 2, my - len);
      }
      ctx.closePath(); ctx.fill();
    }
  }
}
function draw(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.translate(PAD, PAD);
  board();
  for (const h of st.holes) drawHole(h, now);
  for (const r of rings) {
    const t = (now - r.t0) / 520;
    if (t < 1) { ctx.strokeStyle = rgba(C[r.h.color], .8 * (1 - t)); ctx.lineWidth = cell * .5 * t + 2; ctx.stroke(r.h.path); }
  }
  rings = rings.filter(r => now - r.t0 < 520);
  for (const s of sinks) {
    const t = (now - s.t0) / 340;
    drawPiece(s.p, now, t < 0 ? 1 : 1 - Math.min(1, t) * Math.min(1, t));
  }
  const glow = new Map();
  if (drag) for (const q of st.pieces) {
    if (q === drag.p) continue;
    const nc = fuseColor(drag.p.color, q.color);
    if (nc && gap(drag.p, q) <= 2) { glow.set(q, nc); glow.set(drag.p, nc); }
  }
  for (const p of st.pieces) if (!drag || p !== drag.p) drawPiece(p, now, 1, glow.get(p));
  if (drag) drawPiece(drag.p, now, 1, glow.get(drag.p));
  drawThreads(now);
  for (const q of parts) {
    ctx.globalAlpha = 1 - q.l / q.m; ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------- döngü ---------- */
function update(dt, now) {
  if (state === 'play' && running) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; lose('time'); }
  }
  if (CFG.niyet && drag && state === 'play') niyet(dt, now);
  for (const p of vis()) {
    let tx = 0, ty = 0;
    const held = drag && drag.p === p;
    if (held) {
      let [fx, fy] = yaslan();
      const sx = Math.sign(fx), sy = Math.sign(fy), okx = sx && canMove(st, p, sx, 0), oky = sy && canMove(st, p, 0, sy);
      fx = clamp(fx, -.58, .58); fy = clamp(fy, -.58, .58);
      if (!okx) fx *= .12;
      if (!oky) fy *= .12;
      if (okx && oky && !canMove(st, p, sx, sy)) { if (Math.abs(fx) > Math.abs(fy)) fy *= .12; else fx *= .12; }
      tx = fx * cell; ty = fy * cell;
    }
    const k = 1 - Math.exp(-dt * 32);
    p.ox += (tx - p.ox) * k; p.oy += (ty - p.oy) * k;
    p.lift += ((held ? 1 : 0) - p.lift) * (1 - Math.exp(-dt * 18));
    p.pv += (-300 * p.pulse - 16 * p.pv) * dt; p.pulse += p.pv * dt;
    if (p.mix && now - p.mix.t0 >= MIXMS) p.mix = null;
  }
  for (const s of sinks) {
    if (now - s.t0 >= 340) {
      s.h.shown = true; s.gone = true; rings.push({ h: s.h, t0: now });
      const [x, y] = center(s.p); burst(x, y, [C[s.h.color], '#ffffff'], 16, cell * 3);
      buzz(22); tone(170, .2, 'sine', 85, .2); tone(784, .16, 'triangle', 0, .07, .08); tone(1175, .24, 'triangle', 0, .06, .16);
    }
  }
  sinks = sinks.filter(s => !s.gone);
  for (const q of parts) { q.l += dt; q.x += q.vx * dt; q.y += q.vy * dt; const d = Math.exp(-dt * 4); q.vx *= d; q.vy *= d; }
  parts = parts.filter(q => q.l < q.m);
  if (state === 'won' && !sinks.length && $('ov').hidden) {
    if (!wonAt) wonAt = now;
    else if (now - wonAt > 520) win();
  }
  if (after && now >= after.at) { const f = after.fn; after = null; f(); }
  const s = Math.ceil(timeLeft);
  if (s !== shownS) {
    shownS = s; $('secs').textContent = s;
    if (running && state === 'play' && s <= 5 && s > 0) { tone(900, .05, 'square', 0, .03); buzz(10); }
  }
  $('fill').style.transform = 'scaleX(' + (timeLeft / Lv.t) + ')';
  $('timer').classList.toggle('low', timeLeft < 10 && state !== 'won');
}
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  update(dt, now); draw(now);
  requestAnimationFrame(frame);
}
// Bölüm editöründen "Oyunda dene": bölüm adres çubuğunda gelir (#bolum=<JSON>), geçerliyse deneme bölümü olarak açılır.
try {
  const m = location.hash.match(/^#bolum=(.+)$/), Lx = m && JSON.parse(decodeURIComponent(m[1]));
  if (Lx && !K.validate(Lx).length) { if (!Array.isArray(Lx.hint)) Lx.hint = [Lx.hint || '', Lx.hint || '']; LEVELS.push(Lx); li = LEVELS.length - 1; }
} catch {}
setup(li);
if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
else addEventListener('resize', layout);
requestAnimationFrame(frame);

window.__hamurCalm = () => !drag;   // sürükleme sırasında reklam yüklenmez (ads.js)
// test robotu ve bölüm editörü için
App.oyun = { CFG, PAD, setup, geriAl, LEVELS, get st() { return st; }, get durum() { return state; }, get cell() { return cell; }, get bolum() { return li + 1; },
  get sure() { return timeLeft; }, set sure(v) { timeLeft = v; }, get drag() { return drag; }, get iplik() { return [...threads.values()].map(t => ({ v: t.v, ne: t.ne, renk: t.color })); },
  get geriKalan() { return geriKalan; }, get geriVar() { return !!geri; } };
})();
