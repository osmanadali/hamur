// Hamur — kural çekirdeği: hareket, yapışma, renk karışımı, kalıba oturma, hızlı çıkmaz denetimi.
// Çizimden, sesten ve zamandan bağımsızdır; tarayıcıda window.HamurKural, Node'da require() ile aynı dosya kullanılır
// (oyun, çözücü, bölüm editörü ve test robotu aynı kuralları koşar). Prototipteki //#core bölümünden ayrıldı.
//
// Kesin kurallar (yol haritası › Oyun tasarımı):
//  1. Parça kare kare ilerler; duvardan, tahta kenarından ve başka parçadan geçemez.
//  2. Aynı renkteki iki parça kenar kenara gelip orada kalınca kalıcı olarak yapışır. Yanından geçip giden parça yapışmaz.
//  3. İki farklı ana renk (r kırmızı, y sarı, b mavi) kenar kenara kalınca yapışır ve ara renge döner: b+y=g yeşil, r+b=p mor, r+y=o turuncu.
//     Ara renkler başka renkle karışmaz, yalnız kendi rengiyle yapışır.
//  4. Rengi ve şekli kalıpla birebir aynı olan parça kalıbın üstüne gelince oturur ve tahtadan çıkar. Parçalar dönmez.
//  5. Tahta boşalınca bölüm biter.
//  6. Bir parça hiçbir kalıba giremez hale gelirse bölüm kaybedilir (hızlı denetim: doomed; tam denetim: cozucu.js › cikmaz).
//
// "Orada kalmak" kararını çekirdek vermez: move() yalnız taşır, yapıştırmaz. Oyun parmağı okuyup (niyet okuma) fuse() ya da settle() çağırır;
// çözücü "yanından geçmek serbest, yanında durmak yapışma" kuralıyla hedef karede settle() çağırır.
//
// Bölüm biçimi: { t: saniye, hint: 'metin', map: [satır…], molds: [satır…] }
//   map:   '.' boş · '#' duvar · r y b g o p parça karesi (bitişik aynı harfler tek parça)
//   molds: '.' boş · R Y B G O P kalıp karesi (bitişik aynı harfler tek kalıp)
(function (root, factory) {
  const K = factory();
  if (typeof module === 'object' && module.exports) module.exports = K; else root.HamurKural = K;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const MIX = { by: 'g', yb: 'g', rb: 'p', br: 'p', ry: 'o', yr: 'o' };
  const PARTS = { g: 'by', p: 'rb', o: 'ry' };
  const key = (x, y) => x + ',' + y;

  function groups(rows, set) {
    const H = rows.length, W = rows[0].length, seen = new Set(), out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      if (!set.includes(ch) || seen.has(key(x, y))) continue;
      const cells = [], q = [[x, y]]; seen.add(key(x, y));
      while (q.length) {
        const [cx, cy] = q.pop(); cells.push([cx, cy]);
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || rows[ny][nx] !== ch || seen.has(key(nx, ny))) continue;
          seen.add(key(nx, ny)); q.push([nx, ny]);
        }
      }
      out.push({ ch, cells });
    }
    return out;
  }
  function load(L) {
    const H = L.map.length, W = L.map[0].length, walls = new Set(), wallCells = [];
    L.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') { walls.add(key(x, y)); wallCells.push([x, y]); } }));
    return { W, H, walls, wallCells,
      pieces: groups(L.map, 'rybgop').map(g => ({ color: g.ch, cells: g.cells })),
      holes: groups(L.molds, 'RYBGOP').map(g => ({ color: g.ch.toLowerCase(), cells: g.cells, filled: false })) };
  }
  const fuseColor = (a, b) => a === b ? a : MIX[a + b];
  function canMove(st, p, dx, dy) {
    const occ = new Set();
    for (const q of st.pieces) if (q !== p) for (const c of q.cells) occ.add(key(c[0], c[1]));
    return p.cells.every(([x, y]) => {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      return nx >= 0 && ny >= 0 && nx < st.W && ny < st.H && !st.walls.has(k) && !occ.has(k);
    });
  }
  // p ile q'nun ortak kenarları: [x, y, dx, dy] = p'nin (x,y) karesinden (dx,dy) yönünde q var
  function seam(p, q) {
    const s = [], Q = new Set(q.cells.map(c => key(c[0], c[1])));
    for (const [x, y] of p.cells) for (const [dx, dy] of DIRS) if (Q.has(key(x + dx, y + dy))) s.push([x, y, dx, dy]);
    return s;
  }
  function same(a, b) {
    if (a.length !== b.length) return false;
    const B = new Set(b.map(c => key(c[0], c[1])));
    return a.every(c => B.has(key(c[0], c[1])));
  }
  // p şu an tam üstünde durduğu, rengi ve şekli aynı boş kalıp (yoksa undefined)
  const moldUnder = (st, p) => st.holes.find(h => !h.filled && h.color === p.color && same(h.cells, p.cells));
  function sink(st, p) {
    const h = moldUnder(st, p); if (!h) return null;
    h.filled = true; st.pieces.splice(st.pieces.indexOf(p), 1);
    return { type: 'sink', hole: h };
  }
  // Bir kare taşı. Engel varsa null; yoksa olanların listesi (yalnız kalıba oturma olabilir). Yapıştırmaz.
  function move(st, p, dx, dy) {
    if (!canMove(st, p, dx, dy)) return null;
    p.cells = p.cells.map(([x, y]) => [x + dx, y + dy]);
    const s = sink(st, p);
    return s ? [s] : [];
  }
  // p'ye kenar kenara duran ve onunla yapışabilecek parçalar: [{ q, seam, color }] (color: yapışınca oluşacak renk)
  function touching(st, p) {
    const out = [];
    for (const q of st.pieces) {
      if (q === p) continue;
      const color = fuseColor(p.color, q.color); if (!color) continue;
      const s = seam(p, q); if (s.length) out.push({ q, seam: s, color });
    }
    return out;
  }
  // q'yu p'ye yapıştır (kenar kenara ve renkleri uyumlu olmalı). p büyür ve gerekirse renk değiştirir, q tahtadan kalkar.
  function fuse(st, p, q) {
    const color = fuseColor(p.color, q.color), s = seam(p, q);
    if (!color || !s.length) return null;
    const ev = { type: 'fuse', seam: s, color, mixed: color !== p.color || color !== q.color, q,
      cols: p.cells.map(() => p.color).concat(q.cells.map(() => q.color)) };
    p.cells = p.cells.concat(q.cells); p.color = color;
    st.pieces.splice(st.pieces.indexOf(q), 1);
    return ev;
  }
  // p olduğu yerde kaldı: yapışabileceği her komşuyla yapışır (renk değişince yeni komşular da), sonra kalıbın üstündeyse oturur.
  // Aynı anda iki farklı ana renge değiyorsa sıra st.pieces sırasıdır (bölüm doğrulaması böyle belirsiz başlangıçları reddeder).
  function settle(st, p) {
    const ev = [];
    for (let t; (t = touching(st, p)).length;) ev.push(fuse(st, p, t[0].q));
    const s = st.pieces.includes(p) && sink(st, p);
    if (s) ev.push(s);
    return ev;
  }
  // Prototipin eski davranışı (niyet okuma kapalı): her karede hemen yapışır.
  function step(st, p, dx, dy) {
    const ev = move(st, p, dx, dy);
    if (!ev) return null;
    return ev.length ? ev : settle(st, p);
  }
  function fitsIn(p, h) {
    const hs = new Set(h.cells.map(c => key(c[0], c[1]))), [px, py] = p.cells[0];
    return h.cells.some(([hx, hy]) => p.cells.every(c => hs.has(key(c[0] + hx - px, c[1] + hy - py))));
  }
  // Artık hiçbir kalıba giremeyecek parça (yalnız gerekli koşullar: asla yanlış alarm vermez, bazı çıkmazları kaçırır).
  function doomed(st) {
    const open = st.holes.filter(h => !h.filled), count = c => st.pieces.filter(q => q.color === c).length;
    for (const p of st.pieces) {
      let ok = false;
      for (const h of open) {
        if (!fitsIn(p, h)) continue;
        const full = p.cells.length === h.cells.length;
        if (h.color === p.color) {
          if (full || count(p.color) > 1) ok = true;
          else if (PARTS[p.color] && [...PARTS[p.color]].every(c => count(c) > 0)) ok = true;
        } else if (!full && PARTS[h.color] && PARTS[h.color].includes(p.color)) {
          if (count(PARTS[h.color].replace(p.color, '')) > 0) ok = true;
        }
        if (ok) break;
      }
      if (!ok) return p;
    }
    return null;
  }
  // Durumun kopyası (geri alma, arama). Yalnız kural alanları kopyalanır; walls ve wallCells paylaşılır (değişmezler).
  function clone(st) {
    return { W: st.W, H: st.H, walls: st.walls, wallCells: st.wallCells,
      pieces: st.pieces.map(p => ({ color: p.color, cells: p.cells.map(c => [c[0], c[1]]) })),
      holes: st.holes.map(h => ({ color: h.color, cells: h.cells, filled: h.filled })) };
  }
  // Durumun kimliği: parça sırasından bağımsız. Aynı kimlik = aynı oyun durumu.
  function stateKey(st) {
    const ps = st.pieces.map(p => p.color + p.cells.map(c => c[1] * st.W + c[0]).sort((a, b) => a - b).join('.')).sort();
    return ps.join('|') + '#' + st.holes.map(h => h.filled ? 1 : 0).join('');
  }
  // Bölüm dosyası doğrulaması: hata metinlerinin listesi (boşsa geçerli). Çözülebilirliğe bakmaz (o çözücünün işi).
  function validate(L) {
    const E = [];
    if (!L || !Array.isArray(L.map) || !Array.isArray(L.molds) || !L.map.length) return ['map ve molds satır dizisi olmalı'];
    const W = L.map[0].length, H = L.map.length;
    if (L.molds.length !== H) E.push('map ve molds aynı sayıda satır içermeli');
    for (const [ad, rows, ok] of [['map', L.map, '.#rybgop'], ['molds', L.molds, '.RYBGOP']]) rows.forEach((r, y) => {
      if (typeof r !== 'string' || r.length !== W) E.push(`${ad} ${y + 1}. satır ${W} kare olmalı`);
      else for (const ch of r) if (!ok.includes(ch)) E.push(`${ad} ${y + 1}. satırda geçersiz harf: ${ch}`);
    });
    if (!(L.t > 0)) E.push('t (süre, saniye) pozitif olmalı');
    if (E.length) return E;
    const st = load(L);
    if (!st.pieces.length) E.push('en az bir parça olmalı');
    if (!st.holes.length) E.push('en az bir kalıp olmalı');
    for (const h of st.holes) if (h.cells.some(c => st.walls.has(key(c[0], c[1])))) E.push('kalıp duvarın üstünde olamaz');
    const alan = a => a.reduce((n, x) => n + x.cells.length, 0);
    if (alan(st.pieces) !== alan(st.holes)) E.push(`parça kareleri (${alan(st.pieces)}) kalıp karelerine (${alan(st.holes)}) eşit olmalı`);
    for (const p of st.pieces) {
      if (touching(st, p).length) { E.push('başlangıçta yapışabilecek iki parça kenar kenara duramaz'); break; }
      if (moldUnder(st, p)) { E.push('başlangıçta kalıbının üstünde duran parça olamaz'); break; }
    }
    return E;
  }
  return { DIRS, MIX, PARTS, key, groups, load, fuseColor, canMove, seam, same, moldUnder, sink, move, touching, fuse, settle, step, fitsIn, doomed, clone, stateKey, validate };
});
