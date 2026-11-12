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
// Boya damlası (501. bölümden itibaren):
//  B1. Damla tahtada bir zemin karesidir (molds'ta küçük harf: r y b g o p) ve tek kullanımlıktır.
//  B2. Üstünden geçen parça boyanmaz. Parça damlanın üstünde KALINCA (bırakılınca ya da orada yapışacakken) bütünüyle damlanın rengine döner,
//      damla biter. Sıra: önce boyanır, sonra kalıbına oturur ya da komşusuyla yapışır (settle).
//  B3. Açık damla varken renkler değişebilir: hızlı çıkmaz denetimi ve çıkmaz kanıtı bir şey söylemez.
//
// Kilitli kalıp (601. bölümden itibaren; bölümde kilit: [[x, y]…], her biri kilitli kalıbın bir karesi):
//  K1. Kilitli kalıba parça oturmaz (üstünde durabilir). Başka bir kalıp dolunca bütün kilitler açılır.
//  K2. Kilit açıldığında tam üstünde duran, rengi ve şekli uyan parça hemen oturur (olayda zincir).
//
// Kırılgan zemin (701. bölümden itibaren; bölümde kirik: [[x, y]…]):
//  Z1. Üstünden geçmek serbesttir. Bir parça üstünde KALIP sonra ayrılınca zemin çöker: o kare duvar gibi kapanır.
//  Z2. Bölüm başında üstünde duran parça "kalmış" sayılır.
//
// "Orada kalmak" kararını çekirdek vermez: move() yalnız taşır, yapıştırmaz. Oyun parmağı okuyup (niyet okuma) fuse() ya da settle() çağırır;
// çözücü "yanından geçmek serbest, yanında durmak yapışma" kuralıyla hedef karede settle() çağırır.
//
// Bölüm biçimi: { t: saniye, hint: 'metin', map: [satır…], molds: [satır…] }
//   map:   '.' boş · '#' duvar · r y b g o p parça karesi (bitişik aynı harfler tek parça)
//   molds: '.' boş · R Y B G O P kalıp karesi (bitişik aynı harfler tek kalıp) · 'x' makas karesi · r y b g o p boya damlası
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
  function load0(L) {
    const H = L.map.length, W = L.map[0].length, walls = new Set(), wallCells = [];
    L.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') { walls.add(key(x, y)); wallCells.push([x, y]); } }));
    const makas = [];
    L.molds.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') makas.push({ x, y, open: true }); }));
    const boya = [];
    L.molds.forEach((row, y) => [...row].forEach((ch, x) => { if ('rybgop'.includes(ch)) boya.push({ x, y, color: ch, open: true }); }));
    const kirik = (L.kirik || []).map(([x, y]) => ({ x, y, open: true, basili: false }));
    return { W, H, walls, wallCells, makas, boya, kirik,
      // Donmuş parça (D1): map'te büyük harf (R Y B …). Oyuncu onu sürükleyemez; başka bir parça ona yapışınca çözülür (birleşen parça serbesttir).
      pieces: groups(L.map.map(r => r.replace(/[RYBGOP]/g, c => c.toLowerCase())), 'rybgop').map(g => { const p = { color: g.ch, cells: g.cells }; if (g.cells.some(c => /[RYBGOP]/.test(L.map[c[1]][c[0]]))) p.donuk = true; return p; }),
      holes: groups(L.molds, 'RYBGOP').map(g => { const h = { color: g.ch.toLowerCase(), cells: g.cells, filled: false }; if ((L.kilit || []).some(k => g.cells.some(c => c[0] === k[0] && c[1] === k[1]))) h.kilit = true; return h; }) };
  }
  function load(L) { const st = load0(L); for (const z of st.kirik) if (st.pieces.some(p => p.cells.some(c => c[0] === z.x && c[1] === z.y))) z.basili = true; return st; }
  // (x,y) çökmüş kırılgan zemin mi (duvar gibi)
  const cokuk = (st, x, y) => { if (st.kirik) for (const z of st.kirik) if (!z.open && z.x === x && z.y === y) return true; return false; };
  // p olduğu yerde kaldı: altındaki kırılgan zeminler basılı sayılır (ayrılınca çöker)
  const bas = (st, p) => { if (st.kirik) for (const z of st.kirik) if (z.open && p.cells.some(c => c[0] === z.x && c[1] === z.y)) z.basili = true; };
  const fuseColor = (a, b) => a === b ? a : MIX[a + b];
  // Makas durumu: open = henüz kesmedi · hold = kesti, kestiği kare hâlâ üstünde (ayrılınca kapanır).
  // (x,y) açık bir makas karesi mi (çok kareli parçayı durdurur ve keser)
  const makasta = (st, x, y) => { if (st.makas) for (const m of st.makas) if (m.open && m.x === x && m.y === y) return true; return false; };
  // (x,y)'nin kenarından dikiş geçmez mi (M2)
  const yalitik = (st, x, y) => { if (st.makas) for (const m of st.makas) if ((m.open || m.hold) && m.x === x && m.y === y) return true; return false; };
  // p yerinden ayrılıyor: altındaki "kesti, tutuyor" makaslar kapanır
  const ayril = (st, p) => { if (st.makas) for (const m of st.makas) if (m.hold && p.cells.some(c => c[0] === m.x && c[1] === m.y)) m.hold = false;
    if (st.kirik) for (const z of st.kirik) if (z.open && z.basili && p.cells.some(c => c[0] === z.x && c[1] === z.y)) z.open = false; };   // Z1: kalınan kırılgan zemin ayrılınca çöker
  // Parçanın (dx,dy) kadar kayması: 'yol' = serbest · 'makas' = yalnız açık makas engelliyor (çok kareli parça; kesilerek girilir) · '' = engel
  function gecis(st, p, dx, dy) {
    if (p.donuk) return '';   // donmuş parça kıpırdamaz
    const occ = new Set(); let m = false;
    for (const q of st.pieces) if (q !== p) for (const c of q.cells) occ.add(key(c[0], c[1]));
    for (const [x, y] of p.cells) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= st.W || ny >= st.H || st.walls.has(k) || occ.has(k) || cokuk(st, nx, ny)) return '';
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
  const moldUnder = (st, p) => st.holes.find(h => !h.filled && !h.kilit && h.color === p.color && same(h.cells, p.cells));
  function sink(st, p) {
    const h = moldUnder(st, p); if (!h) return null;
    h.filled = true; st.pieces.splice(st.pieces.indexOf(p), 1);
    const ev = { type: 'sink', hole: h };
    const kilitli = st.holes.filter(x => x.kilit && !x.filled);
    if (kilitli.length) {   // K1, K2: kilitler açılır; tam üstünde bekleyen parçalar oturur
      for (const x of kilitli) delete x.kilit; ev.acilan = kilitli; ev.zincir = [];
      for (const q of st.pieces.slice()) { const h2 = st.pieces.includes(q) && moldUnder(st, q); if (h2) { h2.filled = true; st.pieces.splice(st.pieces.indexOf(q), 1); ev.zincir.push({ type: 'sink', hole: h2, p: q }); } }
    }
    return ev;
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
    const ev = { type: 'fuse', seam: s, color, mixed: color !== p.color || color !== q.color, q, cozuldu: !!(p.donuk || q.donuk),
      cols: p.cells.map(() => p.color).concat(q.cells.map(() => q.color)) };
    p.cells = p.cells.concat(q.cells); p.color = color; delete p.donuk;
    st.pieces.splice(st.pieces.indexOf(q), 1);
    return ev;
  }
  // p olduğu yerde kaldı: kalıbının üstündeyse oturur; değilse yapışabileceği bir komşuyla yapışır ve baştan bakılır
  // (renk değişince yeni komşular, şekil tamamlanınca kalıp). Sıra parça listesine bağlı değildir:
  //   1) önce aynı renkli komşular (aynı renkler birleşir, sonra karışır);
  //   2) aynı anda iki farklı ana renge değiyorsa (gerçek belirsizlik): tercih(t) varsa onun seçtiği (oyun: ipliği en dolu olan),
  //      yoksa renk sırası (kırmızı, sarı, mavi). Üretici, çözümünde böyle bir temas olan bölümü eler (cozucu rapor › belirsizTemas).
  const SIRA = 'rybgop';
  // p olduğu yerde kaldı ve altında açık damla var: boyanır (B2). Dönen: olay listesi (boşsa damla yok).
  function boyan(st, p) {
    const ev = [];
    if (st.boya) for (const d of st.boya) if (d.open && p.cells.some(c => c[0] === d.x && c[1] === d.y)) { d.open = false; ev.push({ type: 'boya', color: d.color, once: p.color, at: [d.x, d.y] }); p.color = d.color; }
    return ev;
  }
  const boyaAcik = st => !!(st.boya && st.boya.some(d => d.open));
  function settle(st, p, tercih) {
    const ev = boyan(st, p); bas(st, p);
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
    if (boyaAcik(st)) return null;
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
    return { W: st.W, H: st.H, walls: st.walls, wallCells: st.wallCells, makas: (st.makas || []).map(m => ({ x: m.x, y: m.y, open: m.open, hold: !!m.hold })), boya: (st.boya || []).map(d => ({ x: d.x, y: d.y, color: d.color, open: d.open })),
      pieces: st.pieces.map(p => { const q = { color: p.color, cells: p.cells.map(c => [c[0], c[1]]) }; if (p.donuk) q.donuk = true; return q; }),
      kirik: (st.kirik || []).map(z => ({ x: z.x, y: z.y, open: z.open, basili: z.basili })),
      holes: st.holes.map(h => { const x = { color: h.color, cells: h.cells, filled: h.filled }; if (h.kilit) x.kilit = true; return x; }) };
  }
  // Durumun kimliği: parça sırasından bağımsız. Aynı kimlik = aynı oyun durumu.
  function stateKey(st) {
    const ps = st.pieces.map(p => (p.donuk ? '*' : '') + p.color + p.cells.map(c => c[1] * st.W + c[0]).sort((a, b) => a - b).join('.')).sort();
    return ps.join('|') + '#' + st.holes.map(h => h.filled ? 1 : h.kilit ? 2 : 0).join('') + (st.kirik && st.kirik.length ? '^' + st.kirik.map(z => z.open ? (z.basili ? 2 : 1) : 0).join('') : '') + (st.makas && st.makas.length ? '#' + st.makas.map(m => m.open ? 1 : m.hold ? 2 : 0).join('') : '') + (st.boya && st.boya.length ? '~' + st.boya.map(d => d.open ? 1 : 0).join('') : '');
  }
  // Bölüm dosyası doğrulaması: hata metinlerinin listesi (boşsa geçerli). Çözülebilirliğe bakmaz (o çözücünün işi).
  function validate(L) {
    const E = [];
    if (!L || !Array.isArray(L.map) || !Array.isArray(L.molds) || !L.map.length || typeof L.map[0] !== 'string' || !L.map[0].length) return ['map ve molds satır dizisi olmalı'];
    const W = L.map[0].length, H = L.map.length;
    if (W > 10 || H > 10) E.push('tahta en çok 10×10 olabilir');
    if (L.molds.length !== H) E.push('map ve molds aynı sayıda satır içermeli');
    for (const [ad, rows, ok] of [['map', L.map, '.#rybgopRYBGOP'], ['molds', L.molds, '.RYBGOPxrybgop']]) rows.forEach((r, y) => {
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
    if (st.boya.some(d => st.walls.has(key(d.x, d.y)) || st.pieces.some(p => p.cells.some(c => c[0] === d.x && c[1] === d.y)) || st.makas.some(m => m.x === d.x && m.y === d.y))) E.push('boya damlası duvarın, parçanın ya da makasın üstünde olamaz');
    if (st.kirik.some(z => z.x < 0 || z.y < 0 || z.x >= W || z.y >= H || st.walls.has(key(z.x, z.y)))) E.push('kırılgan zemin tahtanın içinde ve duvarsız karede olmalı');
    if ((L.kilit || []).length && st.holes.every(h => h.kilit)) E.push('bütün kalıplar kilitli olamaz');
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
  return { DIRS, MIX, PARTS, key, groups, load, fuseColor, makasta, yalitik, ayril, gecis, canMove, canCut, cut, bilesenler, seam, same, moldUnder, sink, move, touching, fuse, settle, boyan, boyaAcik, cokuk, bas, belirsiz, step, fitsIn, doomed, clone, stateKey, validate };
});
