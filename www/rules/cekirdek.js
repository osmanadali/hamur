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
// Makas karesi (51. bölümden itibaren; öneri, his testinde onaylanacak):
//  M1. Makas tahtada bir zemin karesidir ve tek kullanımlıktır: bir kez keser. Kestiği kare üstünden ayrılınca kapanır, sıradan zemin olur.
//  M2. Makas karesinin kenarından dikiş geçmez (açıkken ve kestiği kare üstünde dururken): üstündeki tek karelik parça orada hiçbir şeyle yapışmaz.
//  M3. Çok kareli parça açık makasa kendiliğinden giremez (duvar gibi durur). Oyuncu parçayı makasa doğru iterse (cut) parça o kareye
//      girer ve makasın üstündeki kare parçadan kopar: aynı renkte tek karelik parça olur, geri kalan bağlı bileşenlerine ayrılır.
//      Renk geri ayrışmaz (yeşil kesilince iki yeşil olur): makas şekil hatasını telafi eder, renk hatasını değil.
//  M4. Kesim sürüklemeyi bitirir: bütün parçalar oldukları yerde kalmış sayılır (önce kalıbına oturur, sonra yapışabildiğine yapışır).
//
// "Orada kalmak" kararını çekirdek vermez: move() yalnız taşır, yapıştırmaz. Oyun parmağı okuyup (niyet okuma) fuse() ya da settle() çağırır;
// çözücü "yanından geçmek serbest, yanında durmak yapışma" kuralıyla hedef karede settle() çağırır.
//
// Bölüm biçimi: { t: saniye, hint: 'metin', map: [satır…], molds: [satır…] }
//   map:   '.' boş · '#' duvar · r y b g o p parça karesi (bitişik aynı harfler tek parça)
//   molds: '.' boş · R Y B G O P kalıp karesi (bitişik aynı harfler tek kalıp) · 'x' makas karesi
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
    const makas = [];
    L.molds.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') makas.push({ x, y, open: true }); }));
    return { W, H, walls, wallCells, makas,
      pieces: groups(L.map, 'rybgop').map(g => ({ color: g.ch, cells: g.cells })),
      holes: groups(L.molds, 'RYBGOP').map(g => ({ color: g.ch.toLowerCase(), cells: g.cells, filled: false })) };
  }
  const fuseColor = (a, b) => a === b ? a : MIX[a + b];
  // Makas durumu: open = henüz kesmedi · hold = kesti, kestiği kare hâlâ üstünde (ayrılınca kapanır).
  // (x,y) açık bir makas karesi mi (çok kareli parçayı durdurur ve keser)
  const makasta = (st, x, y) => { if (st.makas) for (const m of st.makas) if (m.open && m.x === x && m.y === y) return true; return false; };
  // (x,y)'nin kenarından dikiş geçmez mi (M2)
  const yalitik = (st, x, y) => { if (st.makas) for (const m of st.makas) if ((m.open || m.hold) && m.x === x && m.y === y) return true; return false; };
  // p yerinden ayrılıyor: altındaki "kesti, tutuyor" makaslar kapanır
  const ayril = (st, p) => { if (st.makas) for (const m of st.makas) if (m.hold && p.cells.some(c => c[0] === m.x && c[1] === m.y)) m.hold = false; };
  // Parçanın (dx,dy) kadar kayması: 'yol' = serbest · 'makas' = yalnız açık makas engelliyor (çok kareli parça; kesilerek girilir) · '' = engel
  function gecis(st, p, dx, dy) {
    const occ = new Set(); let m = false;
    for (const q of st.pieces) if (q !== p) for (const c of q.cells) occ.add(key(c[0], c[1]));
    for (const [x, y] of p.cells) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= st.W || ny >= st.H || st.walls.has(k) || occ.has(k)) return '';
      if (p.cells.length > 1 && makasta(st, nx, ny)) m = true;
    }
    return m ? 'makas' : 'yol';
  }
  const canMove = (st, p, dx, dy) => gecis(st, p, dx, dy) === 'yol';
  const canCut = (st, p, dx, dy) => gecis(st, p, dx, dy) === 'makas';
  // p ile q'nun ortak kenarları: [x, y, dx, dy] = p'nin (x,y) karesinden (dx,dy) yönünde q var.
  // st verilirse açık makas karesinden geçen kenarlar sayılmaz (M2).
  function seam(p, q, st) {
    const s = [], Q = new Set(q.cells.map(c => key(c[0], c[1])));
    for (const [x, y] of p.cells) for (const [dx, dy] of DIRS) if (Q.has(key(x + dx, y + dy)) && !(st && (yalitik(st, x, y) || yalitik(st, x + dx, y + dy)))) s.push([x, y, dx, dy]);
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
    ayril(st, p);
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
      const s = seam(p, q, st); if (s.length) out.push({ q, seam: s, color });
    }
    return out;
  }
  // q'yu p'ye yapıştır (kenar kenara ve renkleri uyumlu olmalı). p büyür ve gerekirse renk değiştirir, q tahtadan kalkar.
  function fuse(st, p, q) {
    const color = fuseColor(p.color, q.color), s = seam(p, q, st);
    if (!color || !s.length) return null;
    const ev = { type: 'fuse', seam: s, color, mixed: color !== p.color || color !== q.color, q,
      cols: p.cells.map(() => p.color).concat(q.cells.map(() => q.color)) };
    p.cells = p.cells.concat(q.cells); p.color = color;
    st.pieces.splice(st.pieces.indexOf(q), 1);
    return ev;
  }
  // p olduğu yerde kaldı: kalıbının üstündeyse oturur; değilse yapışabileceği bir komşuyla yapışır ve baştan bakılır
  // (renk değişince yeni komşular, şekil tamamlanınca kalıp). Sıra parça listesine bağlı değildir:
  //   1) önce aynı renkli komşular (aynı renkler birleşir, sonra karışır);
  //   2) aynı anda iki farklı ana renge değiyorsa (gerçek belirsizlik): tercih(t) varsa onun seçtiği (oyun: ipliği en dolu olan),
  //      yoksa renk sırası (kırmızı, sarı, mavi). Üretici, çözümünde böyle bir temas olan bölümü eler (cozucu rapor › belirsizTemas).
  const SIRA = 'rybgop';
  function settle(st, p, tercih) {
    const ev = [];
    for (;;) {
      const s = sink(st, p); if (s) { ev.push(s); break; }
      const t = touching(st, p); if (!t.length) break;
      const sec = t.find(x => x.q.color === p.color) || (tercih && tercih(t)) || t.slice().sort((a, b) => SIRA.indexOf(a.q.color) - SIRA.indexOf(b.q.color))[0];
      ev.push(fuse(st, p, sec.q));
    }
    return ev;
  }
  // p şu an iki farklı sonuç verecek temasta mı (aynı renkli komşu yokken birden çok karışım seçeneği)
  const belirsiz = (st, p) => { const t = touching(st, p); return !t.some(x => x.q.color === p.color) && new Set(t.map(x => x.color)).size > 1; };
  const bilesenler = cells => {
    const S = new Map(cells.map(c => [key(c[0], c[1]), c])), out = [];
    while (S.size) {
      const [k0, c0] = S.entries().next().value, g = [c0], q = [c0]; S.delete(k0);
      while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of DIRS) { const k = key(x + dx, y + dy), c = S.get(k); if (c) { S.delete(k); g.push(c); q.push(c); } } }
      out.push(g);
    }
    return out;
  };
  // Çok kareli parçayı makasa doğru it: parça (dx,dy) kayar, açık makasın üstüne gelen kareler kopar, makas kapanır (M3).
  // Sonra bütün parçalar yerinde kalmış sayılır (M4). Dönen olay: { type:'cut', at:[[x,y]…], parts:[parça…], sonra:[{ p, ev }…] }.
  // Kesilemiyorsa null.
  function cut(st, p, dx, dy) {
    if (!canCut(st, p, dx, dy)) return null;
    const cells = p.cells.map(([x, y]) => [x + dx, y + dy]), at = [], kalan = [];
    for (const c of cells) {
      const m = st.makas.find(m => m.open && m.x === c[0] && m.y === c[1]);
      if (m) { m.open = false; m.hold = true; at.push(c); } else kalan.push(c);
    }
    const parts = at.map(c => ({ color: p.color, cells: [c] })).concat(bilesenler(kalan).map(g => ({ color: p.color, cells: g })));
    st.pieces.splice(st.pieces.indexOf(p), 1, ...parts);
    const sonra = [];
    for (const q of parts) if (st.pieces.includes(q)) { const ev = settle(st, q); if (ev.length) sonra.push({ p: q, ev }); }
    return { type: 'cut', at, parts, sonra, from: p };
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
  // Açık makas varken şekil kesilerek düzeltilebilir; o durumda hiçbir şey söylemez (null).
  function doomed(st) {
    if (st.makas && st.makas.some(m => m.open)) return null;
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
    return { W: st.W, H: st.H, walls: st.walls, wallCells: st.wallCells, makas: (st.makas || []).map(m => ({ x: m.x, y: m.y, open: m.open, hold: !!m.hold })),
      pieces: st.pieces.map(p => ({ color: p.color, cells: p.cells.map(c => [c[0], c[1]]) })),
      holes: st.holes.map(h => ({ color: h.color, cells: h.cells, filled: h.filled })) };
  }
  // Durumun kimliği: parça sırasından bağımsız. Aynı kimlik = aynı oyun durumu.
  function stateKey(st) {
    const ps = st.pieces.map(p => p.color + p.cells.map(c => c[1] * st.W + c[0]).sort((a, b) => a - b).join('.')).sort();
    return ps.join('|') + '#' + st.holes.map(h => h.filled ? 1 : 0).join('') + (st.makas && st.makas.length ? '#' + st.makas.map(m => m.open ? 1 : m.hold ? 2 : 0).join('') : '');
  }
  // Bölüm dosyası doğrulaması: hata metinlerinin listesi (boşsa geçerli). Çözülebilirliğe bakmaz (o çözücünün işi).
  function validate(L) {
    const E = [];
    if (!L || !Array.isArray(L.map) || !Array.isArray(L.molds) || !L.map.length || typeof L.map[0] !== 'string' || !L.map[0].length) return ['map ve molds satır dizisi olmalı'];
    const W = L.map[0].length, H = L.map.length;
    if (W > 10 || H > 10) E.push('tahta en çok 10×10 olabilir');
    if (L.molds.length !== H) E.push('map ve molds aynı sayıda satır içermeli');
    for (const [ad, rows, ok] of [['map', L.map, '.#rybgop'], ['molds', L.molds, '.RYBGOPx']]) rows.forEach((r, y) => {
      if (typeof r !== 'string' || r.length !== W) E.push(`${ad} ${y + 1}. satır ${W} kare olmalı`);
      else for (const ch of r) if (!ok.includes(ch)) E.push(`${ad} ${y + 1}. satırda geçersiz harf: ${ch}`);
    });
    if (typeof L.t !== 'number' || !Number.isFinite(L.t) || !(L.t > 0)) E.push('t (süre, saniye) pozitif bir sayı olmalı');
    if (E.length) return E;
    const st = load(L);
    if (!st.pieces.length) E.push('en az bir parça olmalı');
    if (!st.holes.length) E.push('en az bir kalıp olmalı');
    for (const h of st.holes) if (h.cells.some(c => st.walls.has(key(c[0], c[1])))) E.push('kalıp duvarın üstünde olamaz');
    if (st.makas.some(m => st.walls.has(key(m.x, m.y)))) E.push('makas duvarın üstünde olamaz');
    if (st.holes.length > 30 || st.makas.length > 30) E.push('en çok 30 kalıp ve 30 makas olabilir');
    // kalıbın şekli bölüm başında görünmeli: hiçbir parça bir kalıp karesinin üstünde başlamaz
    const kalipKare = new Set(st.holes.flatMap(h => h.cells.map(c => key(c[0], c[1]))));
    if (st.pieces.some(p => p.cells.some(c => kalipKare.has(key(c[0], c[1]))))) E.push('başlangıçta parça kalıbın üstünde duramaz');
    if (st.pieces.some(p => p.cells.length > 1 && p.cells.some(c => makasta(st, c[0], c[1])))) E.push('başlangıçta makasın üstünde yalnız tek karelik parça durabilir');
    const alan = a => a.reduce((n, x) => n + x.cells.length, 0);
    if (alan(st.pieces) !== alan(st.holes)) E.push(`parça kareleri (${alan(st.pieces)}) kalıp karelerine (${alan(st.holes)}) eşit olmalı`);
    // iki ayrı parça aynı harfle bitişik yazılamaz (biçim gereği tek parça sayılır); farklı renkler için burada bakılır
    for (const p of st.pieces) {
      if (touching(st, p).length) { E.push('başlangıçta yapışabilecek iki parça kenar kenara duramaz'); break; }
      if (moldUnder(st, p)) { E.push('başlangıçta kalıbının üstünde duran parça olamaz'); break; }
    }
    return E;
  }
  return { DIRS, MIX, PARTS, key, groups, load, fuseColor, makasta, yalitik, ayril, gecis, canMove, canCut, cut, bilesenler, seam, same, moldUnder, sink, move, touching, fuse, settle, belirsiz, step, fitsIn, doomed, clone, stateKey, validate };
});
