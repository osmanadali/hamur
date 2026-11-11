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
  itSn: .07,        // öteki parçaya doğru itince iplik bu kadar sürede dolar
  kararsizSn: .28,   // yanında duruyor, yönü belli değil
  kopSn: .12,       // ters yöne çekince iplik bu kadar sürede kopar
  itEsik: .12,       // parmağın öteki parçaya doğru yaslanması (kare) → "itiyor"
  cekEsik: .2,      // ters yöne yaslanma (kare) → "kaçınıyor"
  gecHiz: .8,       // yanından geçme hızı (kare/sn) → "sadece geçiyor"
  kesSn: .25,       // çok kareli parça makasa doğru bu kadar itilince kesilir (kararsız parmak kesmez)
};

const $ = id => document.getElementById(id);
const cv = $('cv'), stage = $('stage'); let ctx = cv.getContext('2d');   // ctx: açılış animasyonu aynı çizimi kendi tuvalinde kullanır (bkz. sahne)
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
// Görseller (docs/gorseller kaynaklarından küçültüldü). Yüklenene kadar düz renkle çizilir; oyun görselsiz de çalışır.
const IMG = {};
for (const ad of ['tepsi', 'duvar', 'blok', 'yuzler', 'makas', 'makas-kapali', 'damgalar', 'yuz-dikey', 'parcacik', 'el', 'hucre', 'girdap']) { const im = new Image(); im.onload = () => { IMG[ad] = im; if (ad === 'blok') blokHazirla(im); if (ad === 'girdap') { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 128, 128); maske = x.getImageData(0, 0, 128, 128).data; } }; im.src = 'img/' + ad + '.webp'; }

const ASIL = LEVELS.length;   // sonrasına eklenenler deneme bölümüdür (editör, test): ilerlemeye yazılmaz
let st, cz, Lv, li = clamp((save.level || 1) - 1, 0, LEVELS.length - 1), done = new Set(save.done || []);
let cell = 60, dpr = 1, state = 'play', timeLeft = 0, running = false, drag = null, sinks = [], parts = [], rings = [], after = null, wonAt = 0, shownS = -1, wallPath = null, last = performance.now();
let sonGirdi = performance.now();   // son dokunuş: uzun süre dokunulmazsa parçalar esner
let egil = new Map();   // yapışabilecek kadar yaklaşan parçalar birbirine doğru eğilir: p → karşısındaki parça
let threads = new Map();   // tutulan parçanın komşularıyla arasındaki hamur iplikleri: q → { v: 0…1 doluluk, seam, color }
let kesim = null;   // dolan makas ölçüsü { dx, dy, v }
let gunluk = false, ekGuc = 0;   // gunluk: günlük kalıp oynanıyor (ilerlemeye yazılmaz) · ekGuc: güçlendiriciyle eklenen süre (yıldıza sayılmaz)
let ekSure = 0, gecisT = 0;   // ekSure: üç kayıptan sonra eklenen süre · gecisT: sıradaki bölüme geçiş zamanlayıcısı
let durak = false, makasKoy = false;   // durak: duraklatıldı (süre durur, tahta gizlenir) · makasKoy: makas güçlendiricisi için kare seçiliyor
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
// Günlük kalıp: herkes aynı gün aynı bölümü oynar (11-50 arası havuzdan, güne göre). İlerlemeye yazılmaz; sonuç paylaşılabilir.
const bugun = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5), gunlukNo = () => 10 + (bugun() * 7919) % 40;
function setup(i, g) {
  gunluk = g === undefined ? gunluk && i === li : !!g; ekGuc = 0;
  li = i; Lv = LEVELS[i]; st = K.load(Lv); cz = Coz.hazirla(st);
  if (i < ASIL && !gunluk) { save.level = i + 1; App.persist(); }
  st.pieces.forEach(giydir);
  ekSure = i < ASIL && !gunluk && (save.fails?.[i + 1] || 0) >= 3 ? 10 : 0;   // aynı bölümde üç kez kaybeden oyuncuya 10 sn eklenir
  state = 'play'; timeLeft = Lv.t + ekSure; running = false; drag = null; sinks = []; parts = []; rings = []; after = null; wonAt = 0; shownS = -1; sonGirdi = performance.now();
  threads = new Map(); geri = null; geriKalan = CFG.geriHak; kesim = null; durak = false; makasKoy = false; cv.style.visibility = '';
  $('ov').hidden = true; $('tost').hidden = true; clearTimeout(gecisT); $('hint').textContent = L(...Lv.hint); tarif(false); $('gTarif').hidden = i < 20; $('rx').classList.toggle('damgali', !!save.damga);   // renk tarifi düğmesi karışımın öğretildiği 21. bölümden itibaren
  $('lvlNo').textContent = gunluk ? L('Günlük kalıp', 'Daily mold') : i < ASIL ? L('Bölüm ', 'Level ') + (i + 1) : L('Deneme', 'Test'); $('lvlNo').classList.toggle('done', done.has(i + 1));
  paintUndo(); layout();
  window.Olcum?.event('level_start', { level: i + 1 });
}
function layout() {
  if (!st) return;
  const s = stage.getBoundingClientRect();
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const eski = cell;
  cell = Math.max(22, Math.floor(Math.min((s.width - 2 * PAD) / st.W, (s.height - 2 * PAD) / st.H, 86)));
  if (cell !== eski) {   // tahta yeniden boyutlandı (ekran döndü, pencere değişti): piksel cinsinden tutulanlar ölçeklenir, parmak kıpırdamadan karar çıkmaz
    const k = cell / eski;
    if (drag) { drag.px *= k; drag.py *= k; for (const h of drag.hist) { h.x *= k; h.y *= k; } }
    for (const p of vis()) { p.ox *= k; p.oy *= k; }
  }
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
// Un tozu: yapışma ve oturma anında yarı saydam, bulanık pufluk (parcacik şeridinin ilk üç karesi).
function un(x, y, n) {
  if (RM) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = cell * (.5 + Math.random() * .9);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - cell * .3, l: 0, m: .55 + Math.random() * .3, k: i % 3, r: cell * (.3 + Math.random() * .22), un: 1, a: Math.random() * 6.283, w: 0 });
  }
}
// Bölüm sonu: şekerler ve yıldızlar tahtanın üstünden yağar (şeridin 3-13. kareleri).
function konfeti() {
  if (RM) return;
  const w = st.W * cell, n = 34;
  for (let i = 0; i < n; i++) {
    const yildiz = i % 4 === 0;
    parts.push({ x: Math.random() * w, y: -PAD - Math.random() * cell * 2.5, vx: (Math.random() - .5) * cell * 1.6, vy: cell * (2.5 + Math.random() * 3), g: cell * 9, l: 0, m: 1.5 + Math.random() * .7,
      k: yildiz ? 3 + (i >> 2) % 3 : 6 + i % 8, r: cell * (yildiz ? .2 : .13) * (.8 + Math.random() * .5), a: Math.random() * 6.283, w: (Math.random() - .5) * 9 });
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
      p.mutluT = now + (e.mixed ? MIXMS : 0) + 900; p.ezT = now; p.sik = { t0: now, x: x0 + mx, y: y0 + my }; Ses.pat(.14, 1100, 220, .28); if (e.mixed) Ses.pat(.5, 700, 300, .1, .1);   // ezilip uzar; şlap
      p.flash = { t0: now, segs: e.seam.map(s => [s[0] - x0, s[1] - y0, s[2], s[3]]) };
      p.pv += 1.5;
      burst((x0 + mx) * cell, (y0 + my) * cell, [a, b], 7, cell * 2.6); un((x0 + mx) * cell, (y0 + my) * cell, 4);
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
  if (ev.length) denetle(p);
}
// Kazanma / çıkmaz denetimi (her yapışma, kalıba oturma ve kesimden sonra)
function denetle(p) {
  if (state !== 'play') return;
  if (st.pieces.length === 0) { state = 'won'; running = false; wonAt = 0; kazanKaydet(); paintUndo(); }
  else if (Coz.cikmaz(st, cz, 20000, 80)) lose('doom', K.doomed(st) || (st.pieces.includes(p) ? p : st.pieces[0]));
}
// Makas: çok kareli parça açık makasa doğru itilince dolan ölçü. Dolunca parça o kareye girer, makasın üstündeki kare kopar,
// sürükleme biter ve bütün parçalar oldukları yerde kalır (cekirdek M3-M4). Kararsız parmak kesmez: karar görünür (makas kapanır).
function kesNiyet(dt) {
  const p = drag.p, [fx, fy] = yaslan();
  let yon = null;
  if (p.cells.length > 1) {
    const sx = Math.abs(fx) > .58 ? Math.sign(fx) : 0, sy = Math.abs(fy) > .58 ? Math.sign(fy) : 0;
    const aday = Math.abs(fx) >= Math.abs(fy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
    yon = aday.find(([dx, dy]) => (dx || dy) && K.canCut(st, p, dx, dy)) || null;
  }
  if (!yon) { kesim = null; return; }
  if (!kesim || kesim.dx !== yon[0] || kesim.dy !== yon[1]) kesim = { dx: yon[0], dy: yon[1], v: 0 };
  kesim.v += dt / CFG.kesSn;
  if (kesim.v >= 1) kes(p, yon[0], yon[1]);
}
function kes(p, dx, dy) {
  const d = drag;
  if (d && d.snap) { geri = d.snap; paintUndo(); }   // kesim de geri alınabilir
  const e = K.cut(st, p, dx, dy); kesim = null; drag = null; threads = new Map();
  if (!e) return;
  for (const q of e.parts) { giydir(q); q.ox = p.ox - dx * cell; q.oy = p.oy - dy * cell; q.pv = 1.2; q.path = relPath(q); }
  for (const [x, y] of e.at) { burst((x + .5) * cell, (y + .5) * cell, [C[p.color], '#ffffff'], 10, cell * 2.4); }
  Ses.pat(.05, 7000, 3000, .22); Ses.pat(.06, 6000, 2500, .2, .07); buzz([10, 30, 18]); tone(1500, .05, 'square', 900, .05); tone(1900, .06, 'square', 1100, .05, .07);
  for (const s of e.sonra) olaylar(s.p, s.ev);
  denetle(e.parts.find(q => st.pieces.includes(q)) || st.pieces[0]);
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
  }
  // İpliği dolan komşu varsa yapış. Sıra çekirdeğin kuralıdır (settle): önce aynı renkli komşular, sonra karışım. Böylece elde
  // tutarken de, bırakınca da, çözücüde de sonuç aynıdır. Birden çok karışım ipliği aynı anda dolduysa renk sırası (kırmızı, sarı, mavi).
  const dolan = T.filter(t => threads.get(t.q)?.v >= 1);
  if (!dolan.length) return;
  const ev = [];
  for (const t of T.filter(t => t.q.color === p.color && dolan.some(d => d.q.color !== p.color || d === t))) ev.push(K.fuse(st, p, t.q));   // karışımdan önce aynı renkli komşular (iplikleri dolmamış olsa da)
  const kar = dolan.filter(t => st.pieces.includes(t.q) && t.q.color !== p.color).sort((a, b) => 'rybgop'.indexOf(a.q.color) - 'rybgop'.indexOf(b.q.color))[0];
  if (kar && K.fuseColor(p.color, kar.q.color)) ev.push(K.fuse(st, p, kar.q));
  const s = K.sink(st, p); if (s) ev.push(s);
  olaylar(p, ev.filter(Boolean));
}
// Parmak kalktı: parça olduğu yerde kaldı → yapışabileceği her şeye yapışır.
function birak() {
  const p = drag.p, d = drag; kesim = null;
  // iki farklı renge aynı anda değiyorsa ipliği belirgin biçimde daha dolu olanla yapışır (oyuncunun ekranda gördüğü);
  // iplikler eşitse karar çekirdeğin renk sırasına kalır (çözücüyle aynı sonuç, parça listesi sırasına bağlı değil)
  const dolu = t => { const s = t.slice().sort((a, b) => (threads.get(b.q)?.v || 0) - (threads.get(a.q)?.v || 0)), v = x => threads.get(x.q)?.v || 0; return s.length > 1 && v(s[0]) - v(s[1]) < .15 ? undefined : s[0]; };
  if (CFG.niyet && state === 'play' && st.pieces.includes(p) && K.touching(st, p).length) olaylar(p, K.settle(st, p, dolu));
  if (drag === d) drag = null;
  threads = new Map();
}
function showOv(t, p, b, fn, b2, fn2) {
  $('ovT').textContent = t; $('ovP').textContent = p; $('ovB').textContent = b; $('ovB').onclick = fn;
  $('ovB2').hidden = !b2; if (b2) { $('ovB2').textContent = b2; $('ovB2').onclick = fn2; }
  $('ovB2').classList.remove('cikis'); $('ovEk').hidden = true; $('ovX').hidden = true;   // duraklatma bunları kendisi açar
  const r = ovResim || (state === 'won' ? 'kazanc' : state === 'lost' ? (kayipTur === 'time' ? 'kayip-sure' : 'kayip-yapisma') : ''); ovResim = '';   // sonuç görseli; yazı ve düğmeler altında
  $('ovR').hidden = !r; if (r) $('ovR').src = 'img/' + r + '.webp';
  $('ov').hidden = false;
}
let kayipTur = '', ovResim = '';   // ovResim: sıradaki pencere için özel görsel (ör. eriyen kalp)
function lose(kind, piece) {
  state = 'lost'; kayipTur = kind; makasKoy = false; paintUndo(); canHarca(); running = false; drag = null; threads = new Map();
  if ((li < ASIL && !gunluk)) { save.fails = { ...save.fails, [li + 1]: (save.fails?.[li + 1] || 0) + 1 }; App.persist(); }
  const now = performance.now(), yine = L('Tekrar dene', 'Try again');
  // ne kadar yaklaşıldı: kaç kalıp doldu; süre bittiyse yaklaşık kaç saniye eksik kaldı (kalan en kısa çözümden)
  const dolu = st.holes.filter(h => h.filled).length, yakin = st.holes.length > 1 ? L(` ${st.holes.length} kalıptan ${dolu} tanesi doldu.`, ` ${dolu} of ${st.holes.length} molds were filled.`) : '';
  const ek = (save.fails?.[li + 1] || 0) === 3 && (li < ASIL && !gunluk) ? L(' Sıradaki denemede 10 saniye fazlan var.', ' You get 10 extra seconds on the next try.') : '';
  window.Olcum?.event('level_fail', { level: li + 1, reason: kind, time_left: Math.ceil(timeLeft) });
  if (kind === 'doom') {
    piece.shakeT = now; buzz([30, 50, 70]); tone(210, .4, 'sawtooth', 80, .07, .25);
    const open = st.holes.filter(h => !h.filled);
    const msg = PARTS[piece.color] && !open.some(h => h.color === piece.color) ? NAME[piece.color] + L(' renkte kalıp yok. Bu parça artık hiçbir yere giremez.', ' has no mold. This piece cannot go anywhere now.') : L('Bu parça artık hiçbir kalıba uymuyor.', 'This piece no longer fits any mold.');
    after = { at: now + 1400, fn: () => geriOlur()
      ? showOv(L('Yanlış yapıştı', 'Wrong stick'), yakin.trim(), L('Geri al', 'Undo'), geriAl, yine, tekrar)
      : showOv(L('Yanlış yapıştı', 'Wrong stick'), (yakin + ek).trim(), yine, tekrar) };
  } else {
    buzz([60, 40, 60]); tone(210, .45, 'sawtooth', 70, .08); geri = null; paintUndo();
    let eksik = '';
    try { const r = Coz.ara(cz, K.clone(st), { cap: 2500 }); if (r.cozuldu) { const sn = Math.max(1, Math.round(r.kare + 2 * r.hamle)); eksik = L(` Yaklaşık ${sn} saniye daha gerekiyordu.`, ` About ${sn} more seconds were needed.`); } } catch {}
    const metin = L('Parçalar kalıba yetişmedi.', 'The pieces did not reach the molds in time.') + yakin + eksik + ek;
    stok('sure') > 0 ? showOv(L('Süre bitti', 'Time is up'), metin, L('+15 sn ile devam et', 'Continue with +15 s'), surDevam, yine, tekrar)
      : Ads.online() ? showOv(L('Süre bitti', 'Time is up'), metin, L('Reklam izle: +15 sn', 'Watch an ad: +15 s'), reklamDevam, yine, tekrar) : showOv(L('Süre bitti', 'Time is up'), metin, yine, tekrar);
  }
}
// Geri alma: son yapışmanın olduğu sürüklemenin başına döner. Süre geri gelmez.
function geriAl() {
  if (!geriOlur() || state === 'won' || timeLeft <= 0 || durak) return;   // süre bittiyse geri alma işe yaramaz: hak harcanmaz
  if (geriKalan > 0) geriKalan--; else harca('geri');   // önce bölümün ücretsiz hakkı, sonra stok
  if (state === 'lost') canVer(1);   // kayıp geri alındı: can geri gelir
  st = geri; geri = null; cz = Coz.hazirla(st);
  st.pieces.forEach(giydir); for (const h of st.holes) h.shown = h.filled;
  state = 'play'; running = true; drag = null; sinks = []; rings = []; after = null; threads = new Map(); kesim = null;
  $('ov').hidden = true; paintUndo(); layout();
  buzz(10); tone(520, .12, 'sine', 300, .06);
  window.Olcum?.event('undo', { level: li + 1 });
}
/* ---------- can ---------- */
// 5 can; kaybedince ya da bölümü yarıda bırakınca 1 gider; 5 dakikada 1 dolar. Geri alma ve "+15 sn ile devam" kaybı geri verir.
// Her figür (10 bölüm) tamamlanınca ödül: canlar dolar, +1 makas, +1 ek süre. Test seçeneği (bütün bölümler açık) açıkken can azalmaz.
const CAN_MAX = 5, CAN_MS = 5 * 60e3;
function canDurum() {
  const c = save.can && typeof save.can.n === 'number' ? save.can : (save.can = { n: CAN_MAX, t: 0 });
  if (c.n >= CAN_MAX) { c.t = 0; return c; }
  const simdi = Date.now(); if (!c.t || c.t > simdi) c.t = simdi;
  const k = Math.floor((simdi - c.t) / CAN_MS);
  if (k > 0) { c.n = Math.min(CAN_MAX, c.n + k); c.t = c.n >= CAN_MAX ? 0 : c.t + k * CAN_MS; App.persist(); }
  return c;
}
const canVar = () => !!save.hepsiAcik || canDurum().n > 0;
function canHarca() { if (save.hepsiAcik || li >= ASIL) return; const c = canDurum(); if (c.n > 0) { if (c.n === CAN_MAX) c.t = Date.now(); c.n--; App.persist(); } }
function canVer(k) { const c = canDurum(); c.n = Math.min(CAN_MAX, c.n + k); if (c.n >= CAN_MAX) c.t = 0; App.persist(); }
const canKalanMs = () => { const c = canDurum(); return c.n >= CAN_MAX ? 0 : Math.max(0, CAN_MS - (Date.now() - c.t)); };
const sureYazi = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function canYok() {   // can bitti: beklenir ya da reklamla 1 can alınır
  ovResim = 'kalp-eriyor';
  const ana = () => App.ekran.goster('ana'), metin = L('Sonraki can: ', 'Next life in ') + sureYazi(canKalanMs());
  if (Ads.online()) showOv(L('Can bitti', 'Out of lives'), metin, L('Reklam izle: +1 can', 'Watch an ad: +1 life'), async () => { let r = ''; try { r = await (App.bekle ? App.bekle.sar(Ads.rewarded(), 'top') : Ads.rewarded()); } catch {} if (r === 'earned') { canVer(1); setup(li); } }, L('Ana ekran', 'Home'), ana);
  else { ovResim = 'kalp-eriyor'; showOv(L('Can bitti', 'Out of lives'), metin, L('Ana ekran', 'Home'), ana); }
}
const tekrar = () => canVar() ? setup(li) : canYok();

/* ---------- güçlendiriciler, duraklatma, renk tarifi ---------- */
// Stok kayıtta durur (save.bst). Para kararı verilene dek her oyuncu üçer taneyle başlar; test seçeneği (bütün bölümler açık) açıkken stok azalmaz.
// Hiçbir bölüm güçlendirici istemez (çözücü kanıtlar); bunlar yalnız kolaylıktır.
const stok = k => save.hepsiAcik ? 9 : Math.max(0, save.bst?.[k] | 0);
function harca(k) {
  if (!save.hepsiAcik) { save.bst = { ...save.bst, [k]: stok(k) - 1 }; App.persist(); }
  window.Olcum?.event('booster_use', { level: li + 1, booster: k });
}
const geriOlur = () => !!geri && (geriKalan > 0 || stok('geri') > 0);
function paintUndo() {
  const oyun = state === 'play' && !durak, yaz = (id, n, acik) => { const b = $(id); b.disabled = !acik; b.querySelector('b').textContent = n > 0 ? n : ''; };
  yaz('undo', geriKalan + stok('geri'), geriOlur() && state !== 'won' && !durak);
  yaz('gSure', stok('sure'), oyun && running && stok('sure') > 0);   // süre işlemeden ek süre kullanılmaz
  yaz('gMakas', stok('makas'), oyun && stok('makas') > 0);
  $('gMakas').setAttribute('aria-pressed', String(makasKoy));
}
// +15 sn: oyun sırasında süreye eklenir. Süre bitince çıkan kartta da "devam et" olarak sunulur (surDevam).
function sureEkle() {
  if (state !== 'play' || durak || stok('sure') <= 0) return;
  harca('sure'); timeLeft += 15; ekGuc += 15; shownS = -1; bilgi('+15 ' + L('sn', 's')); paintUndo(); buzz(12); tone(660, .1, 'triangle', 990, .06); tone(990, .16, 'triangle', 0, .05, .09);
}
// Yıldız: kalan süreye göre (güçlendiriciyle eklenen süre sayılmaz). %45 ve üstü üç, %25 ve üstü iki, bitirmek bir yıldız.
const yildizSay = () => { const r = (timeLeft - ekGuc) / (Lv.t + ekSure); return r >= .45 ? 3 : r >= .25 ? 2 : 1; };
const yildizYazi = n => '★'.repeat(n) + '☆'.repeat(3 - n);
function canlan() { canVer(1); state = 'play'; timeLeft = 15; ekGuc = 999; running = false; shownS = -1; after = null; $('ov').hidden = true; paintUndo(); }   // süre ilk dokunuşta yeniden işler; devam eden bölüm bir yıldız
async function reklamDevam() {   // kaybedince: ödüllü reklam izleyip 15 sn ile devam
  if (state !== 'lost' || kayipTur !== 'time') return;
  let oldu = false; try { oldu = (await (App.bekle ? App.bekle.sar(Ads.rewarded(), 'top') : Ads.rewarded())) === 'earned'; } catch {}
  if (oldu && state === 'lost') canlan();
}
// Şerit yazısı: şerit kavisli olduğu için yazı da aynı yay üstünde dizilir (SVG textPath). Uzun yazı küçülür.
function seritYazi(m) {   // şerit dikeyde daraltılmış çizilir (480×230); yazının yayı şeridin krem bandının yayıyla aynıdır
  const b = document.createElement('b'), boy = m.length > 17 ? 25 : m.length > 13 ? 31 : m.length > 9 ? 38 : 46;
  b.innerHTML = `<svg viewBox="0 0 480 230" aria-hidden="true"><path id="seritYay" d="M60,${123 + boy * .34} Q240,${41 + boy * .34} 420,${123 + boy * .34}" fill="none"/><text font-size="${boy}" text-anchor="middle"><textPath href="#seritYay" startOffset="50%"></textPath></text></svg>`;
  b.querySelector('textPath').textContent = m; b.setAttribute('aria-label', m); return b;
}
let bilgiT = 0;
function bilgi(m) { const t = $('tost'); t.innerHTML = ''; t.append(seritYazi(m)); t.hidden = false; clearTimeout(bilgiT); bilgiT = setTimeout(() => { if (state === 'play') t.hidden = true; }, 1100); }   // kısa ekran bildirimi
function basla() { if (state === 'play' && !durak && !(li === 0 && done.size === 0)) { running = true; paintUndo(); } }   // süreyi başlatır; öğretici ilk bölüm ilk dokunuşu bekler
function surDevam() {
  if (state !== 'lost' || kayipTur !== 'time' || stok('sure') <= 0) return;
  harca('sure'); canlan();   // süre ilk dokunuşta yeniden işler
}
// Makas: oyuncu boş bir zemin karesi seçer, oraya tek kullanımlık makas karesi konur. Sonrası oyundaki makas kuralıyla aynıdır.
function makasSec() {
  if (state !== 'play' || durak || stok('makas') <= 0) return;
  makasKoy = !makasKoy; paintUndo(); if (makasKoy) bilgi(L('Boş bir kareye dokun', 'Tap an empty square'));
  // alttaki yazı değişmez (tahta yerinden oynamasın); yönerge ekranda kısa bildirimle verilir
}
function makasKonur(gx, gy) {
  const k = K.key(gx, gy), dolu = gx < 0 || gy < 0 || gx >= st.W || gy >= st.H || st.walls.has(k) || st.pieces.some(p => p.cells.some(c => c[0] === gx && c[1] === gy))
    || st.holes.some(h => h.cells.some(c => c[0] === gx && c[1] === gy)) || st.makas.some(m => m.x === gx && m.y === gy);
  if (dolu) { buzz(20); tone(180, .1, 'square', 140, .04); return; }
  st.makas.push({ x: gx, y: gy, open: true, hold: false }); cz = Coz.hazirla(st); geri = null;   // geri alma makası geri getirmez
  harca('makas'); makasKoy = false; $('hint').textContent = L(...Lv.hint); paintUndo();
  Ses.pat(.05, 7000, 3000, .22); Ses.pat(.06, 6000, 2500, .2, .07); buzz([10, 30, 18]); tone(1500, .05, 'square', 900, .05); tone(1900, .06, 'square', 1100, .05, .07);
}
// Renk tarifi: düğmeye basınca çubuğun üstünde yatay bir şerit olarak açılır, yeniden basınca ya da dışına dokununca kapanır.
function tarif(ac) { $('rx').hidden = !ac; $('gTarif').setAttribute('aria-expanded', String(!!ac)); }
// Duraklatma: süre durur ve tahta gizlenir (duraklatıp tahtaya bakarak düşünülmesin).
function duraklat() {
  if (state !== 'play' || durak) return;
  durak = true; drag = null; threads = new Map(); kesim = null; makasKoy = false; tarif(false); cv.style.visibility = 'hidden'; paintUndo();
  showOv(L('Duraklatıldı', 'Paused'), '', L('Sürdür', 'Resume'), devam, L('Çıkış', 'Quit'), () => App.ekran.goster('ana'));
  $('ovB2').classList.add('cikis');   // Sürdür yeşil, Çıkış kırmızı; anahtar, açıklama ve kapat düğmesi yok
}
// Bölüm sürerken çıkmak isteyene sorulur: çıkmak 1 can götürür.
function cikisSor() {
  if (state !== 'play' || !running || durak) return App.ekran.goster('ana');
  durak = true; drag = null; threads = new Map(); kesim = null; makasKoy = false; tarif(false); cv.style.visibility = 'hidden'; paintUndo();
  if (!save.hepsiAcik) ovResim = 'kalp';
  showOv(L('Çıkılsın mı?', 'Quit level?'), save.hepsiAcik ? L('Bu bölümdeki ilerlemen kaybolur.', 'Your progress in this level will be lost.') : L('1 can kaybedeceksin.', 'You will lose 1 life.'), L('Devam et', 'Keep playing'), devam, L('Çık', 'Quit'), () => { canHarca(); App.ekran.goster('ana'); });
  $('ovB2').classList.add('cikis');
}
function devam() { if (!durak) return; durak = false; cv.style.visibility = ''; $('ov').hidden = true; $('hint').textContent = L(...Lv.hint); paintUndo(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && running) duraklat(); });   // uygulama arka plana geçince
// Bölüm arası reklam: yalnız kazanınca, sıradaki tahta gelmeden önce. İlk 10 bölümde yok, sonra 3 bölümde bir (iki reklam arası en az 90 sn: ads.js).
async function sonraki(i) {
  if (!save.noads && (li < ASIL && !gunluk) && li + 1 > 10 && save.wins % 3 === 0) await (App.bekle ? App.bekle.sar(Ads.interstitial(), 'top') : Ads.interstitial());
  const eski = li;
  if (!RM && cv.animate) { try { await cv.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-55%)', opacity: 0 }], { duration: 230, easing: 'ease-in' }).finished; } catch {} }
  if (li !== eski || (App.ekran && App.ekran.acik !== 'oyun')) return;   // bu arada başka bölüme geçildi
  setup(i); setTimeout(() => { if (li === i && $('ov').hidden) basla(); }, 700);
  if (!RM && cv.animate) cv.animate([{ transform: 'translateX(55%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 260, easing: 'ease-out' });
}
// Kazanç, tahta boşaldığı an kayda yazılır (bindirme gelmeden başka bölüme geçilse de kaybolmaz). Deneme bölümü ilerlemeye yazmaz.
let sonYildiz = 1;
function paylas() {
  const m = L(`Hamur günlük kalıp: ${yildizYazi(sonYildiz)} · ${Math.ceil(timeLeft)} sn kaldı`, `Dough daily mold: ${yildizYazi(sonYildiz)} · ${Math.ceil(timeLeft)} s left`);
  try { const P = window.Capacitor?.Plugins?.Share; if (P) return P.share({ text: m }); if (navigator.share) return navigator.share({ text: m }); navigator.clipboard?.writeText(m); $('ovP').textContent = L('Sonuç panoya kopyalandı.', 'Result copied to clipboard.'); } catch {}
}
function kazanKaydet() {
  if (li < ASIL && !gunluk && !done.has(li + 1) && (li + 1) % 10 === 0) { canVer(CAN_MAX); save.bst = { ...save.bst, makas: stok('makas') + 1, sure: stok('sure') + 1 }; }   // figür ödülü
  if ((li < ASIL && !gunluk)) { done.add(li + 1); save.done = [...done]; save.wins = (save.wins || 0) + 1; if (save.fails?.[li + 1]) { save.fails = { ...save.fails }; delete save.fails[li + 1]; } App.persist(); $('lvlNo').classList.add('done'); }
  sonYildiz = yildizSay();
  if (li < ASIL && !gunluk) { save.yildiz = { ...save.yildiz, [li + 1]: Math.max(save.yildiz?.[li + 1] || 0, sonYildiz) }; App.persist(); }
  if (gunluk) { save.gunluk = { gun: bugun(), bitti: true, sure: Math.ceil(timeLeft), yildiz: sonYildiz }; App.persist(); }
  window.Olcum?.event('level_end', { level: li + 1, time_left: Math.ceil(timeLeft), stars: sonYildiz, daily: gunluk });
}
function win() {
  konfeti();
  [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', 0, .07, i * .09));
  Ads.warm();
  const kalan = L('Kalan süre ', 'Time left: ') + Math.ceil(timeLeft) + L(' sn.', ' s.');
  if (gunluk) return showOv(L('Günlük kalıp tamam', 'Daily mold done'), yildizYazi(sonYildiz) + ' · ' + kalan + L(' Yarın yeni kalıp var.', ' A new mold comes tomorrow.'), L('Paylaş', 'Share'), paylas, L('Ana ekran', 'Home'), () => App.ekran.goster('ana'));
  if (li >= ASIL) return showOv(L('Deneme tamam', 'Test complete'), kalan, L('Yeniden oyna', 'Play again'), () => setup(li));   // editörden gelen deneme bölümü
  const lastOne = li === ASIL - 1;
  if (!lastOne) {   // bölüm bitince menü açılmaz: kısa bir kutlama, sonra tahta kayar ve sıradaki bölüm gelir
    const t = $('tost'), fig = App.oyun.figurAdi?.(li + 1); t.innerHTML = '';
    if (fig) App.ekran.kutla(fig);   // figür tamamlandı: tam ekran kutlama
    t.append(seritYazi(fig ? fig.ad + L(' tamamlandı!', ' completed!') : L('Bölüm tamam!', 'Level complete!')));
    const y = document.createElement('span'); y.className = 'yildiz'; for (let k = 0; k < 3; k++) { const yi = document.createElement('i'); if (k >= sonYildiz) yi.className = 'bos'; y.appendChild(yi); } t.append(y);
    const k = document.createElement('small'); k.textContent = kalan; t.append(k); t.hidden = false;
    const hedef = li + 1; clearTimeout(gecisT); gecisT = setTimeout(() => { if (state === 'won' && li === hedef - 1) sonraki(hedef); }, fig ? 3400 : RM ? 1100 : 950);
    return;
  }
  showOv(lastOne ? L('Hepsi tamam', 'All done') : L('Bölüm tamam', 'Level complete'),
    lastOne ? L('Bütün bölümler bitti. ', 'Every level is finished. ') + kalan : kalan,
    lastOne ? L('Baştan oyna', 'Play again') : L('Sıradaki bölüm', 'Next level'), () => sonraki(lastOne ? 0 : li + 1));
}

/* ---------- girdi ---------- */
function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left - PAD, e.clientY - r.top - PAD]; }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || drag || durak) return;
  const [x, y] = pos(e), gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  if (makasKoy) { e.preventDefault(); return makasKonur(gx, gy); }
  const p = st.pieces.find(q => q.cells.some(c => c[0] === gx && c[1] === gy));
  if (!p) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch {}
  drag = { p, id: e.pointerId, gi: p.cells.findIndex(c => c[0] === gx && c[1] === gy), offx: x / cell - gx - .5, offy: y / cell - gy - .5, px: x, py: y,
    hist: [{ t: performance.now(), x, y }], snap: CFG.geriHak ? K.clone(st) : null };
  running = true; paintUndo(); p.pv += 1.3; p.gulT = sonGirdi = performance.now(); Ses.pat(.05, 1600, 600, .1); tone(880, .05, 'sine', 1100, .04); tone(1100, .06, 'sine', 1320, .04, .07); buzz(6);
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const [x, y] = pos(e); drag.px = x; drag.py = y; drag.hist.push({ t: performance.now(), x, y }); dragTo();
});
const drop = e => { if (drag && e.pointerId === drag.id) birak(); };
cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);
$('retry').onclick = () => { if (state === 'play' && running) canHarca(); tekrar(); };   // süren bölümü baştan almak 1 can
$('undo').onclick = geriAl; $('gSure').onclick = sureEkle; $('gMakas').onclick = makasSec; $('duraklat').onclick = duraklat;
$('gTarif').onclick = e => { e.stopPropagation(); tarif($('rx').hidden); };
document.addEventListener('pointerdown', e => { if (!$('rx').hidden && !e.target.closest('#rx,#gTarif')) tarif(false); });
const paintSound = () => { $('sound').classList.toggle('off', !save.sound); $('sound').setAttribute('aria-pressed', String(save.sound)); };
$('sound').onclick = () => { save.sound = !save.sound; save.music = save.sound; App.persist(); paintSound(); App.ekran?.muzik?.(); };   // üstteki ses düğmesi müziği de susturur
paintSound();

/* ---------- çizim ---------- */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function board() {
  const W = st.W * cell, H = st.H * cell;
  // şekerli tepsi: görsel dokuz dilim halinde tahta boyuna gerilir (köşeler bozulmaz)
  const im = IMG.tepsi;
  if (im) {
    const s = im.width, sh = im.height, c = s * .17, x0 = -PAD, y0 = -PAD, w = W + 2 * PAD, h = H + 2 * PAD, d = Math.min(PAD + 12, w / 2, h / 2);
    const X = [[0, c, x0, d], [c, s - 2 * c, x0 + d, w - 2 * d], [s - c, c, x0 + w - d, d]], Y = [[0, c, y0, d], [c, sh - 2 * c, y0 + d, h - 2 * d], [sh - c, c, y0 + h - d, d]];
    for (const [sx, sw, dx, dw] of X) for (const [sy, sh2, dy, dh] of Y) ctx.drawImage(im, sx, sy, sw, sh2, dx, dy, dw + .5, dh + .5);
  } else { rr(-PAD + 1, -PAD + 1, W + 2 * PAD - 2, H + 2 * PAD - 2, 18); ctx.fillStyle = C.mat; ctx.fill(); rr(0, 0, W, H, 8); ctx.fillStyle = C.field; ctx.fill(); }
  // ızgara çizgisi yok: her kareye tepsi-hucre karosu döşenir; tekdüzelik kırılsın diye kareye göre 90 derecelik dönüşle
  if (IMG.hucre) {
    ctx.save(); rr(0, 0, W, H, 10); ctx.clip();
    for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
      ctx.save(); ctx.translate((x + .5) * cell, (y + .5) * cell); ctx.rotate(((x * 7 + y * 13 + li * 3) % 4) * Math.PI / 2); ctx.drawImage(IMG.hucre, -cell / 2 - .5, -cell / 2 - .5, cell + 1, cell + 1); ctx.restore();
    }
    ctx.restore();
  }
  // duvar: kesme şeker
  if (IMG.duvar) {
    for (const [x, y] of st.wallCells) {
      ctx.fillStyle = 'rgba(90,60,130,.22)'; ctx.beginPath(); ctx.ellipse((x + .5) * cell, (y + .93) * cell, cell * .42, cell * .1, 0, 0, 6.2832); ctx.fill();
      ctx.drawImage(IMG.duvar, x * cell + cell * .02, y * cell - cell * .06, cell * .96, cell * .96);
    }
  } else if (wallPath) {
    ctx.fillStyle = 'rgba(90,60,130,.25)'; ctx.save(); ctx.translate(0, cell * .05); ctx.fill(wallPath); ctx.restore();
    ctx.fillStyle = tint(C.wall, .82); ctx.fill(wallPath);
    ctx.save(); ctx.translate(0, -cell * .08); ctx.fillStyle = C.wall; ctx.fill(wallPath); ctx.restore();
  }
}
// Makas karesi: açıkken parlak ve kıpırdar; itilirken ağzı kapanır (kesim ölçüsü); kesince soluk kalır.
function drawMakas(m, now) {
  const cx = (m.x + .5) * cell, cy = (m.y + .5) * cell, r = cell * .3;
  let v = 0;
  if (kesim && drag && m.open && drag.p.cells.some(c => c[0] + kesim.dx === m.x && c[1] + kesim.dy === m.y)) v = Math.min(1, kesim.v);
  const acik = m.open ? (1 - v) * (.42 + (RM ? 0 : .06 * Math.sin(now / 420 + m.x))) : .04;   // bıçakların açısı (radyan)
  ctx.save(); ctx.translate(cx, cy);
  ctx.globalAlpha = m.open ? 1 : .28;
  rr(-cell * .42, -cell * .42, cell * .84, cell * .84, cell * .16); ctx.fillStyle = 'rgba(255,255,255,' + (m.open ? .45 + .3 * v : .2) + ')'; ctx.fill();
  if (m.open) { ctx.setLineDash([cell * .07, cell * .07]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(120,80,170,.55)'; ctx.stroke(); ctx.setLineDash([]); }
  if (IMG.makas) {   // hamur makas: açıkken hafifçe sallanır, itilirken küçülüp döner (kapanır); kullanılınca kapalı makas görseli
    const sal = m.open && !RM ? Math.sin(now / 520 + m.x * 2) * .08 : 0, w = cell * .78 * (1 - .22 * v), im = m.open ? IMG.makas : IMG['makas-kapali'] || IMG.makas;
    ctx.globalAlpha = m.open ? 1 : .55; ctx.rotate(sal - v * .5); ctx.drawImage(im, -w / 2, -w / 2, w, w); ctx.restore(); return;
  }
  ctx.lineCap = 'round'; ctx.rotate(-Math.PI / 4);
  for (const s of [-1, 1]) {
    ctx.save(); ctx.rotate(s * acik);
    ctx.strokeStyle = '#8f86a3'; ctx.lineWidth = Math.max(2.5, cell * .085); ctx.beginPath(); ctx.moveTo(-r * .15, 0); ctx.lineTo(r * 1.05, 0); ctx.stroke();   // bıçak
    ctx.strokeStyle = C.p; ctx.lineWidth = Math.max(2, cell * .06); ctx.beginPath(); ctx.arc(-r * .55, s * r * .3, r * .3, 0, 6.2832); ctx.stroke();   // sap halkası
    ctx.restore();
  }
  ctx.restore();
}
// Kalıp: tepsiye gömülü çukur. İçte koyu üst gölge, kenarda hedef renkte kesikli ve hafif parlayan çizgi. Dolunca hamur çukura oturur.
function drawHole(h, now) {
  const c = C[h.color], [hx, hy] = h.cells[0];
  ctx.save();
  if (h.shown) {
    ctx.fillStyle = C.pit; ctx.fill(h.path);
    ctx.save(); ctx.clip(h.path); ctx.translate(hx * cell, hy * cell + cell * .03); govde(h, () => koyu(c, .9), .05); ctx.restore();
    ctx.save(); ctx.clip(h.path); ctx.lineWidth = cell * .12; ctx.strokeStyle = 'rgba(50,20,80,.3)'; ctx.translate(0, cell * .05); ctx.stroke(h.path); ctx.restore();
  } else {
    ctx.fillStyle = C.pit; ctx.fill(h.path);
    // içte koyu üst gölge (çukur derinliği): kenar çizgisinin gölgesi aşağı düşürülür ve kalıbın içine kırpılır; her şekilde kenarı izler
    ctx.save(); ctx.clip(h.path);
    ctx.lineWidth = cell * .1; ctx.strokeStyle = 'rgba(40,10,70,.45)';
    ctx.shadowColor = 'rgba(40,10,70,.9)'; ctx.shadowBlur = cell * .2 * dpr; ctx.shadowOffsetY = cell * .14 * dpr; ctx.stroke(h.path); ctx.stroke(h.path);
    ctx.restore();
    const nabiz = RM ? .5 : .5 + .5 * Math.sin(now / 420);
    ctx.setLineDash([cell * .15, cell * .1]); ctx.lineDashOffset = RM ? 0 : -now / 60; ctx.lineCap = 'round';
    ctx.shadowColor = c; ctx.shadowBlur = cell * (.08 + .1 * nabiz);                // hafif parlama
    ctx.lineWidth = Math.max(3, cell * .075); ctx.strokeStyle = lighten(c, .15 * nabiz); ctx.stroke(h.path);
    ctx.shadowBlur = 0; ctx.setLineDash([]);
    if (save.damga) for (const [x, y] of h.cells) damga(h.color, (x + .5) * cell, (y + .5) * cell, .46, .6);
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
// Boyalı yastık: parca-blok görseli × renk. Çarpma bloğun ortalama grisine göre normallenir (piksel = renk × gri / ortalama gri):
// bloğun ortalama tonu rengin kendisini verir, renkler kararmaz; doku ve kenar gölgesi kalır. Renk başına bir kez hesaplanır.
const BLOK = 256, boyali = new Map(); let blokGri = null, blokOrt = 1;
function blokHazirla(im) {
  const c = document.createElement('canvas'); c.width = c.height = BLOK;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, BLOK, BLOK);
  const d = x.getImageData(0, 0, BLOK, BLOK).data, g = new Uint8ClampedArray(BLOK * BLOK * 2); let s = 0, n = 0;
  for (let i = 0; i < BLOK * BLOK; i++) { g[i * 2] = d[i * 4]; g[i * 2 + 1] = d[i * 4 + 3]; if (d[i * 4 + 3] > 200) { s += d[i * 4]; n++; } }
  blokGri = g; blokOrt = s / Math.max(1, n); boyali.clear();
}
function yastik(hex) {
  let c = boyali.get(hex); if (c || !blokGri) return c || null;
  c = document.createElement('canvas'); c.width = c.height = BLOK;
  const x = c.getContext('2d'), id = x.createImageData(BLOK, BLOK), o = id.data, [r, g, b] = rgb(hex);
  for (let i = 0; i < BLOK * BLOK; i++) { const k = blokGri[i * 2] / blokOrt; o[i * 4] = r * k; o[i * 4 + 1] = g * k; o[i * 4 + 2] = b * k; o[i * 4 + 3] = blokGri[i * 2 + 1]; }
  x.putImageData(id, 0, 0); if (boyali.size > 80) boyali.clear(); boyali.set(hex, c); return c;
}
const koyu = (h, s) => '#' + rgb(h).map(v => Math.round(v * s).toString(16).padStart(2, '0')).join('');
// Parçanın gövdesi: her kare ayrı yastık olarak kalır. Komşu iki karenin arası aynı renkle dolar, dikişte hafif bir çukur gölgesi olur.
// renkOf(i): i. karenin rengi (#rrggbb). Çizim parçanın ilk karesinin köşesine göredir. cukur: dikiş gölgesinin koyuluğu.
function govde(p, renkOf, cukur = .2) {
  const sk = p.sik, st2 = sk ? (performance.now() - sk.t0) / 420 : 1, sa = st2 < 1 && !RM ? Math.sin(st2 * Math.PI) * (1 - st2 * .5) * .34 : 0;
  const SX = c => sa ? (sk.x - (c[0] + .5)) * cell * sa : 0, SY = c => sa ? (sk.y - (c[1] + .5)) * cell * sa : 0;
  const [x0, y0] = p.cells[0], S = new Set(p.cells.map(c => c[0] + ',' + c[1])), ins = cell * .02, rad = cell * .2, dolu = (x, y) => S.has(x + ',' + y);
  const dik = (sp, hex, x, y, w, h) => { if (sp) ctx.drawImage(sp, BLOK * .32, BLOK * .32, BLOK * .36, BLOK * .36, x, y, w, h); else { ctx.fillStyle = hex; ctx.fillRect(x, y, w, h); } };
  p.cells.forEach((c, i) => {   // köprüler
    const hex = renkOf(i), sp = yastik(hex), X = (c[0] - x0) * cell + SX(c), Y = (c[1] - y0) * cell + SY(c), sag = dolu(c[0] + 1, c[1]), alt = dolu(c[0], c[1] + 1);
    if (sag) dik(sp, hex, X + cell - rad, Y + rad * .85, rad * 2, cell - rad * 1.7);
    if (alt) dik(sp, hex, X + rad * .85, Y + cell - rad, cell - rad * 1.7, rad * 2);
    if (sag && alt && dolu(c[0] + 1, c[1] + 1)) dik(sp, hex, X + cell - rad, Y + cell - rad, rad * 2, rad * 2);
  });
  p.cells.forEach((c, i) => {   // yastıklar
    const hex = renkOf(i), sp = yastik(hex), X = (c[0] - x0) * cell + SX(c), Y = (c[1] - y0) * cell + SY(c);
    if (sp) ctx.drawImage(sp, X + ins, Y + ins, cell - 2 * ins, cell - 2 * ins); else { rr(X + ins, Y + ins, cell - 2 * ins, cell - 2 * ins, rad); ctx.fillStyle = hex; ctx.fill(); }
  });
  if (cukur > 0) for (const c of p.cells) {   // dikiş çukuru
    const X = (c[0] - x0) * cell + SX(c), Y = (c[1] - y0) * cell + SY(c), w = cell * .09;
    if (dolu(c[0] + 1, c[1])) { const g = ctx.createLinearGradient(X + cell - w, 0, X + cell + w, 0); g.addColorStop(0, 'rgba(45,15,70,0)'); g.addColorStop(.5, 'rgba(45,15,70,' + cukur + ')'); g.addColorStop(1, 'rgba(45,15,70,0)'); ctx.fillStyle = g; ctx.fillRect(X + cell - w, Y + rad * .85, 2 * w, cell - rad * 1.7); }
    if (dolu(c[0], c[1] + 1)) { const g = ctx.createLinearGradient(0, Y + cell - w, 0, Y + cell + w); g.addColorStop(0, 'rgba(45,15,70,0)'); g.addColorStop(.5, 'rgba(45,15,70,' + cukur + ')'); g.addColorStop(1, 'rgba(45,15,70,0)'); ctx.fillStyle = g; ctx.fillRect(X + rad * .85, Y + cell - w, cell - rad * 1.7, 2 * w); }
  }
}
// Renk karışımı: kareler önce eski renkleriyle durur, yeni renk temas noktasından dalgalı kenarla yayılır.
// Yayılan renk de aynı yastıklarla çizildiği için doku görünür kalır.
// Yeni renk daire olarak değil girdap maskesiyle yayılır: piksel, (maske × 0,45 + temas noktasına uzaklık × 0,55) eşiğin altındaysa
// yeni rengi alır; eşik süre boyunca 0'dan 1'e çıkar. Sınırda iki rengin karışımı (açık ton) ince bir şerit olarak görünür.
// Parça küçük olduğu için ayrı, düşük çözünürlüklü tuvalde hesaplanır (kare başına KR piksel). Maske kodla üretilir (girdap + dalga).
const KR = 36; let maske = null;   // girdap-maske görseli (128×128 gri); yüklenmezse kodla üretilen girdap kullanılır
function girdap(x, y, ox, oy, s) { const dx = x - ox, dy = y - oy, r = Math.hypot(dx, dy) / KR, a = Math.atan2(dy, dx); return clamp(.5 + .32 * Math.sin(a * 3 + r * 4.2 + s) + .18 * Math.sin(x / KR * 5.1 + s * 2) * Math.sin(y / KR * 4.3 - s), 0, 1); }
function karisimHazirla(p, m) {
  const xs = p.cells.map(c => c[0]), ys = p.cells.map(c => c[1]), [x0, y0] = p.cells[0], mnx = Math.min(...xs), mny = Math.min(...ys), w = (Math.max(...xs) - mnx + 1) * KR, h = (Math.max(...ys) - mny + 1) * KR;
  const tuval = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const boya = hex => { const c = tuval(), x = c.getContext('2d'), e = [ctx, cell]; ctx = x; cell = KR; x.translate((x0 - mnx) * KR, (y0 - mny) * KR); const sk = p.sik; p.sik = null; try { govde(p, () => hex); } finally { [ctx, cell] = e; p.sik = sk; } return c; };
  m.yeni = boya(C[p.color]); m.serit = boya(m.lead); m.mask = tuval(); m.tmp = tuval(); m.mx = m.mask.getContext('2d'); m.tx = m.tmp.getContext('2d'); m.id = m.mx.createImageData(w, h);
  const ox = (x0 - mnx + m.ox) * KR, oy = (y0 - mny + m.oy) * KR, R = m.maxR * KR, T = m.T = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) T[y * w + x] = (maske ? maske[(((y * 1.4 + m.seed * 20) | 0) & 127) * 512 + (((x * 1.4 + m.seed * 31) | 0) & 127) * 4] / 255 : girdap(x, y, ox, oy, m.seed)) * .45 + Math.min(1, Math.hypot(x - ox, y - oy) / R) * .55;
  m.w = w; m.h = h; m.dx = mnx - x0; m.dy = mny - y0; m.n = p.cells.length;
}
function body(p, now) {
  const m = p.mix;
  if (!m) return govde(p, () => C[p.color]);
  if (!m.T || m.n !== p.cells.length) karisimHazirla(p, m);
  const t = Math.min(1, (now - m.t0) / MIXMS), esik = t * 1.08, T = m.T, d = m.id.data;
  govde(p, i => C[m.cols[i]]);
  const kat = (src, e) => {
    for (let i = 0; i < T.length; i++) d[i * 4 + 3] = clamp((e - T[i]) * 30, 0, 1) * 255;
    m.mx.putImageData(m.id, 0, 0); m.tx.globalCompositeOperation = 'copy'; m.tx.drawImage(src, 0, 0); m.tx.globalCompositeOperation = 'destination-in'; m.tx.drawImage(m.mask, 0, 0);
    ctx.drawImage(m.tmp, m.dx * cell, m.dy * cell, m.w / KR * cell, m.h / KR * cell);
  };
  kat(m.serit, esik + .07);   // sınır şeridi: iki rengin karışımı
  kat(m.yeni, esik);
}
// Renk damgası (renk körlüğü; ayarlardan açılır): her rengin kendi şekli, parçanın yüzsüz karelerine ve kalıbın içine hafif kabartma
// olarak basılır. Gri damga, alttaki rengin üstüne çarpılarak çizilir (rengin koyu tonu: kabartma).
const DAMGA = { y: 0, r: 1, b: 2, g: 3, p: 4, o: 5 };   // sarı yıldız, kırmızı kalp, mavi damla, yeşil yaprak, mor ay, turuncu elmas
function damga(renk, cx, cy, boy, a) {
  const im = IMG.damgalar; if (!im || !save.damga) return;
  const s = im.height, w = cell * boy;
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(im, DAMGA[renk] * s, 0, s, s, cx - w / 2, cy - w / 2, w, w); ctx.restore();
}
// Yüz (kaynak: docs/gorseller/yuzler.png, 4×2 ifade): parçanın tek karesine yerleşir, ifade duruma göre değişir.
// normalde sakin · sürüklenirken yöne bakar · süre azalınca telaşlı · yanlış yapışınca (ya da kaybedince) üzgün · kalıba oturunca mutlu
const DIKEY = { yukari: 0, asagi: 1 };
const YUZ = { sakin: 0, mutlu: 1, kirp: 2, sol: 3, sag: 4, telas: 5, saskin: 6, uzgun: 7 };
function ifade(p, now) {
  if (p.ifade) return p.ifade;   // açılış sahnesi ifadeyi kendisi verir
  if (p.mutluT && now < p.mutluT && state === 'play' && !(p.shakeT && now - p.shakeT < 1600)) return 'mutlu';   // yapıştıktan sonra kısa süre mutlu
  if (state === 'lost' || (p.shakeT && now - p.shakeT < 1600)) return 'uzgun';
  if (state === 'won' || sinks.some(s => s.p === p)) return 'mutlu';
  if (state === 'play' && running && timeLeft < 10) return 'telas';
  if (drag) {
    let dx, dy;
    const yon = (dx, dy) => Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'yukari' : 'asagi') : dx < 0 ? 'sol' : 'sag';
    if (drag.p === p && now - (p.gulT || 0) < 380) return 'mutlu';   // dokununca kıkırdar
    if (drag.p === p) {   // tutulan parça gittiği yöne bakar (dört yön); durunca son baktığı yerde kalır
      const h = drag.hist, a = h[Math.max(0, h.length - 6)], oyn = Math.hypot(drag.px - a.x, drag.py - a.y) > 2, y = yaslan();
      dx = oyn ? drag.px - a.x : y[0] * cell; dy = oyn ? drag.py - a.y : y[1] * cell;
      if ((oyn || !p.bak) && Math.hypot(dx, dy) > cell * .08) p.bak = yon(dx, dy);
      return p.bak || 'sag';
    }
    const c = center(drag.p), d = center(p); dx = c[0] - d[0]; dy = c[1] - d[1];
    return Math.hypot(dx, dy) < cell * .4 ? 'sakin' : yon(dx, dy);
  }
  p.bak = null;
  // uzun süre dokunulmayınca sırayla esnerler
  if (state === 'play' && now - sonGirdi > 8000 && ((now + p.seed * 1300) % 6000) < 900) return 'saskin';
  // yan yana duran (yapışmayan) parçalar ara sıra birbirine bakar
  const z = (now + p.seed * 700) % 5200;
  if (z > 3600 && z < 4700) { const [cx, cy] = center(p); for (const q of st.pieces) if (q !== p && gap(p, q) === 1) { const [qx, qy] = center(q), dx = qx - cx, dy = qy - cy; return Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'yukari' : 'asagi') : dx < 0 ? 'sol' : 'sag'; } }
  // kişilik: her rengin boştayken kendi huyu var
  const t = (now + p.seed * 900) % 7000, kirp = ((now + p.seed * 900) % 4200) < 140;
  switch (p.color) {
    case 'b': return t < 1500 || kirp ? 'kirp' : 'sakin';                                  // mavi uykulu: gözleri uzun uzun kapanır
    case 'r': return t < 450 ? 'sol' : t < 900 ? 'sag' : t > 3400 && t < 3800 ? 'sol' : kirp ? 'kirp' : 'sakin';   // kırmızı telaşlı: sağa sola bakınır
    case 'y': return t < 900 ? 'mutlu' : kirp ? 'kirp' : 'sakin';                          // sarı neşeli: ara sıra güler
    case 'g': return t < 800 ? 'yukari' : t > 3000 && t < 3600 ? 'sag' : kirp ? 'kirp' : 'sakin';   // yeşil meraklı: etrafa bakar
    case 'p': return t < 2200 ? 'yukari' : kirp ? 'kirp' : 'sakin';                        // mor hayalperest: göğe dalar
    case 'o': return t < 500 ? 'saskin' : kirp ? 'kirp' : 'sakin';                         // turuncu şaşkın
  }
  return kirp ? 'kirp' : 'sakin';
}
function face(p, now) {
  const [x0, y0] = p.cells[0], f = p.cells[p.face], fx = (f[0] - x0 + .5) * cell, fy = (f[1] - y0 + .5) * cell, ne = ifade(p, now);
  const jx = ne === 'telas' && !RM ? Math.sin(now / 38 + p.seed) * cell * .014 : 0, im = IMG.yuzler;
  if (im) {
    const sw = im.width / 4, sh = im.height / 2, i = YUZ[ne] || 0, w = cell * .8, h = w * sh / sw, dk = IMG['yuz-dikey'];
    if (ne in DIKEY && dk) { ctx.drawImage(dk, DIKEY[ne] * sw, 0, sw, sh, fx - w / 2, fy + cell * .27 - h, w, h); return; }
    ctx.drawImage(im, (i % 4) * sw, (i / 4 | 0) * sh, sw, sh, fx - w / 2 + jx, fy + cell * .27 - h, w, h);
    return;
  }
  // görsel yüklenmediyse: iki nokta göz, yay ağız
  ctx.fillStyle = '#4a322c'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(fx + s * cell * .15 + jx, fy - cell * .05, cell * .055, 0, 6.2832); ctx.fill(); }
  ctx.strokeStyle = '#4a322c'; ctx.lineWidth = Math.max(1.5, cell * .035); ctx.lineCap = 'round'; ctx.beginPath();
  ne === 'uzgun' ? ctx.arc(fx, fy + cell * .19, cell * .07, 1.2 * Math.PI, 1.8 * Math.PI) : ctx.arc(fx, fy + cell * .07, cell * .075, .2 * Math.PI, .8 * Math.PI); ctx.stroke();
}
// Parça: altında yumuşak gölge (tutulunca büyür), koyu yan yüz (kalınlık), üstte mat yastıklar. Parlak vurgu yok.
function drawPiece(p, now, k, glow) {
  const [x0, y0] = p.cells[0], depth = cell * (.1 + .04 * p.lift) * k, up = cell * .07 * p.lift * k;
  const [cx, cy] = center(p), s = (1 + p.pulse) * (1 + .03 * p.lift);
  let sh = 0;
  if (p.shakeT && now - p.shakeT < 800) { const t = (now - p.shakeT) / 800; sh = Math.sin((now - p.shakeT) / 26) * cell * .07 * (1 - t); }
  ctx.save();
  const eh = egil.get(p), ek = eh && !RM ? clamp((center(eh)[0] + eh.ox - cx - p.ox) / cell, -1, 1) * .1 : 0, ez = p.ezT && now - p.ezT < 320 && !RM ? Math.sin((now - p.ezT) / 320 * Math.PI) * .13 : 0;
  ctx.translate(cx + p.ox + sh, cy + p.oy); ctx.scale(s * (1 + ez), s * (1 - ez)); if (ek) ctx.transform(1, 0, -ek, 1, 0, 0); ctx.translate(-cx + x0 * cell, -cy + y0 * cell);
  ctx.save();   // yumuşak gölge
  ctx.translate(0, cell * (.07 + .1 * p.lift) * k); ctx.shadowColor = 'rgba(60,25,100,' + (.5 * k) + ')'; ctx.shadowBlur = cell * (.14 + .3 * p.lift) * dpr; ctx.shadowOffsetY = cell * .03 * dpr;
  ctx.fillStyle = 'rgba(60,25,100,' + (.2 * k) + ')'; ctx.fill(p.path); ctx.restore();
  ctx.save(); ctx.translate(0, -up); ctx.fillStyle = koyu(C[p.color], .7); ctx.fill(p.path); ctx.restore();   // yan yüz
  ctx.translate(0, -up - depth);
  body(p, now);
  if (p.flash) {
    const t = (now - p.flash.t0) / 480;
    if (t >= 1) p.flash = null;
    else {
      ctx.save(); ctx.clip(p.path);
      ctx.strokeStyle = 'rgba(255,255,255,' + (.75 * (1 - t)) + ')'; ctx.lineWidth = cell * .14 * (1 - t) + 1; ctx.lineCap = 'round'; ctx.beginPath();
      for (const [x, y, dx, dy] of p.flash.segs) {
        const mx = (x + .5 + dx / 2) * cell, my = (y + .5 + dy / 2) * cell;
        ctx.moveTo(mx - dy * cell * .36, my - dx * cell * .36); ctx.lineTo(mx + dy * cell * .36, my + dx * cell * .36);
      }
      ctx.stroke(); ctx.restore();
    }
  }
  // (tutunca dışta yanıp sönen renk çizgisi kaldırıldı: yaklaşan parçalar eğilerek ve iplikle haber verir)
  if (save.damga && !p.mix) p.cells.forEach((c, i) => { if (i !== p.face || p.cells.length === 1) damga(p.color, (c[0] - x0 + .5) * cell, (c[1] - y0 + (p.cells.length === 1 ? .23 : .5)) * cell, p.cells.length === 1 ? .32 : .5, .75); });   // tek karede yüzün üstüne (alna) küçük damga
  if (k > .25) face(p, now);
  ctx.restore();
}
// Hamur ipliği: iki parçanın ortak kenarında, çıkacak renkte, doldukça kalınlaşan köprü. Oyuncu ne olacağını buradan görür.
function drawThreads(now) {
  return;   // iplik çizimi kapalı (geri bildirim: arada dolan şekil kötü duruyordu). Ölçü (threads) yapışma kararında kullanılmaya devam eder.
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
  for (const m of st.makas) drawMakas(m, now);
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
  const glow = new Map(); egil = new Map();
  if (drag) for (const q of st.pieces) {
    if (q === drag.p) continue;
    const nc = fuseColor(drag.p.color, q.color);
    if (nc && gap(drag.p, q) <= 2) { glow.set(q, nc); glow.set(drag.p, nc); egil.set(q, drag.p); egil.set(drag.p, q); }
  }
  for (const p of st.pieces) if (!drag || p !== drag.p) drawPiece(p, now, 1, glow.get(p));
  if (drag) drawPiece(drag.p, now, 1, glow.get(drag.p));
  drawThreads(now);
  const pim = IMG.parcacik;
  for (const q of parts) {
    const t = q.l / q.m;
    if (q.k == null) { ctx.globalAlpha = 1 - t; ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill(); continue; }
    if (!pim) continue;
    const r = q.un ? q.r * (1 + 1.1 * t) : q.r, hc = pim.height;
    ctx.globalAlpha = q.un ? .6 * (1 - t) * Math.min(1, t * 8) : Math.min(1, (1 - t) * 4);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.drawImage(pim, q.k * hc, 0, hc, hc, -r, -r, 2 * r, 2 * r); ctx.restore();
  }
  ctx.globalAlpha = 1;
  el(now);
}

// İlk açılış: henüz hiç bölüm bitirmemiş oyuncuya el, ilk parçayı eşine doğru sürüklemeyi gösterir. İşaret noktası parmak ucu (görselin sol üstü).
function el(now) {
  const im = IMG.el;
  if (!im || li !== 0 || running || drag || state !== 'play' || done.size > 0 || st.pieces.length < 2) return;
  const a = center(st.pieces[0]), b = center(st.pieces[1]), yon = Math.sign(b[0] - a[0]) || 1;
  const hx = b[0] - yon * cell, T = 2400, t = (now % T) / T, u = t < .15 ? 0 : t < .7 ? (t - .15) / .55 : 1, e = RM ? 0 : u * u * (3 - 2 * u);
  const x = a[0] + (hx - a[0]) * e, y = a[1] + (b[1] - a[1]) * e + cell * .12, w = cell * 1.6, bas = t > .08 && t < .8 ? .92 : 1;
  ctx.globalAlpha = RM ? 1 : Math.min(1, t * 12, (1 - t) * 7);
  ctx.drawImage(im, x - w * .23 * bas, y - w * .18 * bas, w * bas, w * bas * im.height / im.width);
  ctx.globalAlpha = 1;
}

/* ---------- döngü ---------- */
function update(dt, now) {
  if (state === 'play' && running && !durak) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; lose('time'); }
  }
  if (CFG.niyet && drag && state === 'play') niyet(dt, now);
  if (drag && state === 'play') kesNiyet(dt); else kesim = null;
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
    if (p.mix && now - p.mix.t0 >= MIXMS) { p.mix = null; p.pv += 1.3; }   // karışım bitince bir kez nabız atar
  }
  for (const s of sinks) {
    if (now - s.t0 >= 340) {
      s.h.shown = true; s.gone = true; rings.push({ h: s.h, t0: now });
      const [x, y] = center(s.p); burst(x, y, [C[s.h.color], '#ffffff'], 9, cell * 3); un(x, y, 3 + Math.min(4, s.p.cells.length));
      Ses.pat(.2, 600, 90, .32); buzz(22); tone(170, .2, 'sine', 85, .2); tone(784, .16, 'triangle', 0, .07, .08); tone(1175, .24, 'triangle', 0, .06, .16);
    }
  }
  sinks = sinks.filter(s => !s.gone);
  for (const q of parts) { q.l += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.g) { q.vy += q.g * dt; q.a += q.w * dt; continue; } const d = Math.exp(-dt * 4); q.vx *= d; q.vy *= d; }
  parts = parts.filter(q => q.l < q.m);
  if (state === 'won' && !sinks.length && $('ov').hidden) {
    if (!wonAt) wonAt = now;
    else if (wonAt > 0 && now - wonAt > 520) { wonAt = -1; win(); }   // kutlama bir kez
  }
  if (after && now >= after.at) { const f = after.fn; after = null; f(); }
  const s = Math.ceil(timeLeft);
  if (s !== shownS) {
    shownS = s; $('secs').textContent = s;
    if (running && state === 'play' && s <= 5 && s > 0) { tone(900, .05, 'square', 0, .03); buzz(10); }
  }
  $('fill').style.transform = 'scaleX(' + Math.min(1, timeLeft / (Lv.t + ekSure)) + ')';
  $('saat').style.setProperty('--k', clamp(timeLeft / (Lv.t + ekSure), 0, 1).toFixed(4));   // akrep bölüm süresi boyunca tam bir tur; çevredeki halka kalan süre
  $('timer').classList.toggle('low', timeLeft < 10 && state !== 'won'); $('sOyun').classList.toggle('az', timeLeft < 10 && state === 'play' && running);
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
try { setup(li); } catch (e) { if ((li < ASIL && !gunluk)) throw e; LEVELS.length = ASIL; setup(li = clamp((save.level || 1) - 1, 0, ASIL - 1)); }   // bozuk deneme bölümü: kayıtlı bölüme dön
if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
else addEventListener('resize', layout);
requestAnimationFrame(frame);

window.__hamurCalm = () => !drag;   // sürükleme sırasında reklam yüklenmez (ads.js)
// test robotu ve bölüm editörü için
App.oyun = { CFG, PAD, setup, geriAl, LEVELS, ASIL, get deneme() { return li >= ASIL; }, ayarDegisti: () => { paintSound(); $('rx').classList.toggle('damgali', !!save.damga); }, get kesim() { return kesim && kesim.v; }, get st() { return st; }, get durum() { return state; }, get cell() { return cell; }, get bolum() { return li + 1; },
  get sure() { return timeLeft; }, set sure(v) { timeLeft = v; }, get drag() { return drag; }, get iplik() { return [...threads.values()].map(t => ({ v: t.v, ne: t.ne, renk: t.color })); },
  get geriKalan() { return geriKalan; }, get geriVar() { return !!geri; },
  // Açılış animasyonu oyunun kendi parça çizimini ve karışımını kullanır: verilen tuvalde, verilen kare boyuyla çizer.
  sahne: {
    MIXMS, RM, renk: C,
    parca: (cells, color) => giydir({ cells, color }),
    karistir(p, eski, now) {   // eski: karelerin karışmadan önceki renk harfleri; yeni renk p.color. Temas noktası karelerin ortası.
      const [x0, y0] = p.cells[0]; let mx = 0, my = 0; for (const c of p.cells) { mx += c[0] + .5 - x0; my += c[1] + .5 - y0; } mx /= p.cells.length; my /= p.cells.length;
      p.mix = { t0: now, cols: eski, lead: lighten(C[p.color], .42), srcs: [C[eski[0]], C[eski[eski.length - 1]]], seed: Math.random() * 6, ox: mx, oy: my, maxR: Math.max(...p.cells.map(c => Math.hypot(c[0] + .5 - x0 - mx, c[1] + .5 - y0 - my))) + .8 };
      p.pv += 1.5;
    },
    ciz(c2, hucre, olcek, parcalar, now, dt) {
      const e = [ctx, cell, dpr]; ctx = c2; cell = hucre; dpr = olcek;
      try {
        for (const p of parcalar) {
          p.pv += (-300 * p.pulse - 16 * p.pv) * dt; p.pulse += p.pv * dt;
          if (p.mix && now - p.mix.t0 >= MIXMS) { p.mix = null; p.pv += 1.3; }   // karışım bitince bir kez nabız atar
          p.path = relPath(p); drawPiece(p, now, 1);
        }
      } finally { [ctx, cell, dpr] = e; }
    },
    get hazir() { return !!blokGri; }, parcacik: () => IMG.parcacik, el: () => IMG.el,
  },
  can: { get n() { return save.hepsiAcik ? CAN_MAX : canDurum().n; }, max: CAN_MAX, kalan: canKalanMs, yazi: sureYazi },
  cikisSor, gunlukNo, bugun, get gunluk() { return gunluk; }, duraklat, devam, sureEkle, makasSec, get durakta() { return durak; }, get stok() { return { geri: stok('geri'), sure: stok('sure'), makas: stok('makas') }; },
  // Bölüm başlangıç penceresi: ana ekrandan ya da yoldan girince (bölümden bölüme geçerken çıkmaz). Süre zaten ilk dokunuşta başlar.
  giris() {
    if (!canVar()) return canYok();
    const y = save.yildiz?.[li + 1], kapat = () => { $('ov').hidden = true; basla(); };
    showOv(gunluk ? L('Günlük kalıp', 'Daily mold') : L('Bölüm ', 'Level ') + (li + 1),
      (y ? yildizYazi(y) + '\n' : '') + L(`Süre ${Math.round(timeLeft)} sn · Geri al ×${geriKalan + stok('geri')} · +15 sn ×${stok('sure')} · Makas ×${stok('makas')}`, `Time ${Math.round(timeLeft)} s · Undo ×${geriKalan + stok('geri')} · +15 s ×${stok('sure')} · Scissors ×${stok('makas')}`),
      L('Oyna', 'Play'), kapat);
    const sat = (resim, yazi) => `<span class="bs"><i style="background-image:url(img/${resim}.webp)"></i><b>${yazi}</b></span>`;
    $('ovP').innerHTML = (y ? `<span class="bs-yildiz">${[0, 1, 2].map(k => `<i${k >= y ? ' class="bos"' : ''}></i>`).join('')}</span>` : '') + '<span class="bs-izgara">' +
      sat('saat', Math.round(timeLeft) + L(' sn', ' s')) + sat('geri', '×' + (geriKalan + stok('geri'))) + sat('saat', '+15 ×' + stok('sure')) + sat('makas', '×' + stok('makas')) + '</span>';
    $('ovX').hidden = false; $('ovX').onclick = () => App.ekran.goster('ana');
  },
  dur() { if (durak || state === 'play') $('ov').hidden = true; durak = false; makasKoy = false; cv.style.visibility = ''; running = false; drag = null; after = null; threads = new Map(); kesim = null; clearTimeout(gecisT); if (state === 'won') wonAt = -1; } };
})();
