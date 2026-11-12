// Hamur — çözücü. Bir bölüm (ya da oyun ortasındaki bir durum) için dört şey söyler: çözülebilir mi, en kısa çözüm ne,
// kaç farklı en kısa çözüm var, kaç yerde yanlış yapışma mümkün. Bölüm üretimi, zorluk puanı ve çıkmaz tespiti bu koda dayanır.
// Tarayıcıda window.HamurCozucu, Node'da require(). Kurallar cekirdek.js'ten gelir; burada kural yeniden yazılmaz.
//
// İki ayrı araç vardır:
//
// cikmaz(st)  — KANIT. Gevşetilmiş modelde arar: parçalar birbirini engellemez, yalnız duvarlar ve tahta kenarı engeldir.
//   Gerçek oyunda yapılabilen her şey bu modelde de yapılabilir; öyleyse burada kazanılamayan durum gerçekte de kazanılamaz.
//   true = kesin çıkmaz (asla yanlış alarm vermez). false = çıkmaz olduğu kanıtlanamadı. Hızlıdır; telefonda her yapışmadan sonra çalışır.
//
// coz(st)     — ARAMA. Gerçek kurallarla, tek tek kare adımıyla değil "parçayı ulaşabildiği bir kareye taşı" hamlesiyle arar.
//   Yanından geçmek serbesttir; hedef karede durmak yapışma sayılır (cekirdek settle). Kalıbının üstünden geçen parça oraya oturur.
//   Hamle üç türdür: yapışma, kalıba oturma, yer değiştirme (hiçbir şeye yapışmadan başka kareye gitmek).
//   Yer değiştirme hedefleri sınırlanmazsa durum sayısı patlar; önce "akıllı" küme denenir (parçanın kalıbının içine park etmesi
//   ve birkaç boş park yeri), çözüm çıkmazsa küçük bütçeyle bütün hedefler ("tam"). Bulunan çözüm her zaman gerçek ve doğrulanmıştır;
//   "çözülemedi" ise "bu sınırlar içinde bulunamadı" demektir (kesin çıkmaz için cikmaz'a bakılır).
(function (root, factory) {
  const K = typeof module === 'object' && module.exports ? require('./cekirdek.js') : root.HamurKural;
  const C = factory(K);
  if (typeof module === 'object' && module.exports) module.exports = C; else root.HamurCozucu = C;
})(typeof self !== 'undefined' ? self : this, function (K) {
  'use strict';
  const { DIRS, PARTS, fuseColor } = K;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---------- şekiller ----------
  // Şekil: sol üst köşesi (0,0)'a çekilmiş kare listesi. Aynı şekil = aynı anahtar (parçalar dönmez, o yüzden döndürme yok).
  function shapeOf(cells) {
    let mx = Infinity, my = Infinity;
    for (const c of cells) { if (c[0] < mx) mx = c[0]; if (c[1] < my) my = c[1]; }
    const n = cells.map(c => [c[0] - mx, c[1] - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    let w = 0, h = 0; for (const c of n) { if (c[0] >= w) w = c[0] + 1; if (c[1] >= h) h = c[1] + 1; }
    return { key: n.map(c => c[0] + '' + c[1]).join(''), cells: n, w, h, x: mx, y: my };
  }

  // ---------- bölüme özgü önbellek ----------
  function hazirla(st) {
    const { W, H } = st, wall = new Uint8Array(W * H);
    for (const c of st.wallCells) wall[c[1] * W + c[0]] = 1;
    const holes = st.holes.map((h, i) => { const s = shapeOf(h.cells); return { i, color: h.color, shape: s, pos: s.y * W + s.x, cells: h.cells, n: h.cells.length, set: new Set(h.cells.map(c => c[1] * W + c[0])) }; });
    if (W > 10 || H > 10 || st.holes.length > 30 || (st.makas || []).length > 30 || st.pieces.length > 120) throw new Error('çözücü sınırı: tahta en çok 10×10, en çok 30 kalıp ve 30 makas');
    const makas = (st.makas || []).map((m, i) => ({ i, x: m.x, y: m.y, pos: m.y * W + m.x }));
    return { W, H, wall, holes, makas, shapes: new Map(), comps: new Map(), fits: new Map(), fuses: new Map(), dead: new Map(), solv: new Map(), nodes: 0, asim: 0, pahali: false, son: 0 };
  }
  const intern = (ctx, s) => ctx.shapes.get(s.key) || (ctx.shapes.set(s.key, s), s);
  // Şeklin yalnız duvarlara göre gidebildiği yerler: comp[konum] = o konumun bağlı bileşeninin kimliği (en küçük konum), geçersizse -1.
  function compsOf(ctx, s) {
    let r = ctx.comps.get(s.key); if (r) return r;
    const { W, H, wall } = ctx, comp = new Int16Array(W * H).fill(-1), ok = new Uint8Array(W * H), lists = new Map();
    for (let y = 0; y + s.h <= H; y++) for (let x = 0; x + s.w <= W; x++) ok[y * W + x] = s.cells.every(c => !wall[(y + c[1]) * W + x + c[0]]) ? 1 : 0;
    for (let p0 = 0; p0 < W * H; p0++) {
      if (!ok[p0] || comp[p0] >= 0) continue;
      const list = [p0], q = [p0]; comp[p0] = p0;
      while (q.length) {
        const p = q.pop(), x = p % W, y = (p / W) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx; if (!ok[n] || comp[n] >= 0) continue;
          comp[n] = p0; list.push(n); q.push(n);
        }
      }
      lists.set(p0, list);
    }
    ctx.comps.set(s.key, r = { comp, lists });
    return r;
  }
  // Şekil, kalıbın içine (bir kaydırmayla) sığıyor mu?
  function fitsHole(ctx, s, h) {
    const k = s.key + '>' + h.i; let r = ctx.fits.get(k); if (r !== undefined) return r;
    const hs = new Set(h.shape.cells.map(c => c[0] + ',' + c[1]));
    r = false;
    for (let oy = 0; oy + s.h <= h.shape.h && !r; oy++) for (let ox = 0; ox + s.w <= h.shape.w && !r; ox++) r = s.cells.every(c => hs.has((c[0] + ox) + ',' + (c[1] + oy)));
    ctx.fits.set(k, r); return r;
  }
  // Parça (renk + şekil) açık kalıplardan birinin tamamı ya da parçası olabilir mi? (gerekli koşul)
  // kesilir: açık makas var. O zaman karışıp kesilen ana renk kare, tek başına ara renk kalıbını da doldurabilir (b + y = yeşil, kes, iki yeşil).
  function yeriVar(ctx, color, s, mask, kesilir) {
    for (const h of ctx.holes) {
      if (!(mask >> h.i & 1)) continue;
      const n = s.cells.length;
      if (h.color === color ? n <= h.n : ((kesilir ? n <= h.n : n < h.n) && PARTS[h.color] && PARTS[h.color].includes(color))) if (fitsHole(ctx, s, h)) return true;
    }
    return false;
  }
  // İki parça gevşetilmiş modelde hangi biçimlerde yapışabilir: [{ s (yeni şekil), comp }] (tekrarsız)
  function fuseOptions(ctx, a, b) {
    const k = a.s.key + '@' + a.comp + '+' + b.s.key + '@' + b.comp; let r = ctx.fuses.get(k); if (r) return r;
    const { W, H } = ctx, A = compsOf(ctx, a.s), B = compsOf(ctx, b.s), seen = new Set(); r = [];
    const bset = new Set(b.s.cells.map(c => c[0] + ',' + c[1]));
    // b'nin a'ya göre kayması: kareler çakışmaz ve en az bir kenar ortak
    for (let ry = -b.s.h; ry <= a.s.h; ry++) for (let rx = -b.s.w; rx <= a.s.w; rx++) {
      let over = false, adj = false;
      for (const c of a.s.cells) {
        const x = c[0] - rx, y = c[1] - ry;
        if (bset.has(x + ',' + y)) { over = true; break; }
        if (!adj) for (const [dx, dy] of DIRS) if (bset.has((x + dx) + ',' + (y + dy))) { adj = true; break; }
      }
      if (over || !adj) continue;
      const cells = a.s.cells.concat(b.s.cells.map(c => [c[0] + rx, c[1] + ry])), m = intern(ctx, shapeOf(cells)), M = compsOf(ctx, m);
      for (const pa of A.lists.get(a.comp)) {
        const ax = pa % W, ay = (pa / W) | 0, bx = ax + rx, by = ay + ry;
        if (bx < 0 || by < 0 || bx + b.s.w > W || by + b.s.h > H || B.comp[by * W + bx] !== b.comp) continue;
        const mc = M.comp[(ay + Math.min(0, ry)) * W + ax + Math.min(0, rx)];
        if (mc < 0 || seen.has(m.key + '@' + mc)) continue;
        seen.add(m.key + '@' + mc); r.push({ s: m, comp: mc });
      }
    }
    ctx.fuses.set(k, r); return r;
  }
  const rKey = (ps, mask, tm) => ps.map(p => p.color + p.s.key + '@' + p.comp).sort().join('|') + '#' + mask + '#' + tm;
  // Gevşetilmiş modelde bir parçayı açık makaslarla kesme seçenekleri: [{ tm (kalan makaslar), parts:[{ s, comp }] }] (tekrarsız).
  // Parça, duvar-bileşenindeki her yerleşimde, altına gelen bütün açık makaslarla kesilir (gerçekteki sonuçla aynı; yol için makas yok sayılır).
  function cutOptions(ctx, p, tm) {
    const { W } = ctx, A = compsOf(ctx, p.s), out = [], seen = new Set();
    for (const pa of A.lists.get(p.comp)) {
      const ax = pa % W, ay = (pa / W) | 0; let yeni = tm; const at = [], kalan = [];
      for (const c of p.s.cells) { const pos = (ay + c[1]) * W + ax + c[0], m = ctx.makas.find(m => m.pos === pos && (tm >> m.i & 1)); if (m) { yeni &= ~(1 << m.i); at.push([ax + c[0], ay + c[1]]); } else kalan.push([ax + c[0], ay + c[1]]); }
      if (!at.length) continue;
      const parts = at.map(c => [c]).concat(K.bilesenler(kalan)).map(cells => { const sh = shapeOf(cells), s2 = intern(ctx, sh); return { s: s2, comp: compsOf(ctx, s2).comp[sh.y * W + sh.x] }; });
      const k = yeni + ':' + parts.map(q => q.s.key + '@' + q.comp).sort().join('|');
      if (seen.has(k)) continue; seen.add(k); out.push({ tm: yeni, parts });
    }
    return out;
  }
  // Gevşetilmiş modelde kazanılabilir mi? Bütçe aşılırsa "bilinmiyor" sayılır (ctx.over) ve çıkmaz denmez.
  // tm: açık makasların maskesi. Makas varken çok kareli parça kesilip küçülebilir; "kalıba sığmalı" budaması o zaman yalnız tek karelere uygulanır.
  function kazanilir(ctx, ps, mask, tm = 0) {
    if (!ps.length) return true;
    const k = rKey(ps, mask, tm), m = ctx.dead.get(k); if (m !== undefined) return m;
    if (++ctx.nodes > ctx.cap || (ctx.son && !(ctx.nodes & 127) && now() > ctx.son)) { ctx.over = true; return true; }
    const sigmali = p => !tm || p.s.cells.length === 1;
    let ok = true;
    // renk sayımı (makas açıkken de geçerli gerekli koşul; kesme ve yapışma kare sayısını değiştirmez, ara renk geri ayrışmaz):
    // her rengin kareleri, o rengi alabilecek açık kalıpların karelerine sığmalı
    if (tm) {
      const kare = {}, yer = {};
      for (const p of ps) kare[p.color] = (kare[p.color] || 0) + p.s.cells.length;
      for (const h of ctx.holes) if (mask >> h.i & 1) { yer[h.color] = (yer[h.color] || 0) + h.n; if (PARTS[h.color]) for (const a of PARTS[h.color]) yer[a] = (yer[a] || 0) + h.n; }
      for (const c in kare) if (kare[c] > (yer[c] || 0)) { ok = false; break; }
    }
    if (ok) for (const p of ps) if (sigmali(p) && !yeriVar(ctx, p.color, p.s, mask, !!tm)) { ok = false; break; }
    if (ok) {
      ok = false;
      // kalıba oturma
      for (let i = 0; i < ps.length && !ok; i++) for (const h of ctx.holes) {
        const p = ps[i];
        if (!(mask >> h.i & 1) || h.color !== p.color || h.shape.key !== p.s.key || compsOf(ctx, p.s).comp[h.pos] !== p.comp) continue;
        if (kazanilir(ctx, ps.filter((_, j) => j !== i), mask & ~(1 << h.i), tm)) { ok = true; break; }
      }
      // yapışma
      for (let i = 0; i < ps.length && !ok; i++) for (let j = i + 1; j < ps.length && !ok; j++) {
        const color = fuseColor(ps[i].color, ps[j].color); if (!color) continue;
        const rest = ps.filter((_, t) => t !== i && t !== j);
        for (const o of fuseOptions(ctx, ps[i], ps[j])) {
          if (!tm && !yeriVar(ctx, color, o.s, mask)) continue;
          if (kazanilir(ctx, rest.concat({ color, s: o.s, comp: o.comp }), mask, tm)) { ok = true; break; }
        }
      }
      // kesme
      if (tm) for (let i = 0; i < ps.length && !ok; i++) {
        if (ps[i].s.cells.length < 2) continue;
        const rest = ps.filter((_, t) => t !== i);
        for (const o of cutOptions(ctx, ps[i], tm)) if (kazanilir(ctx, rest.concat(o.parts.map(q => ({ color: ps[i].color, s: q.s, comp: q.comp }))), mask, o.tm)) { ok = true; break; }
      }
    }
    if (!ctx.over) ctx.dead.set(k, ok);
    return ok;
  }
  const maskOf = st => st.holes.reduce((m, h, i) => h.filled ? m : m | 1 << i, 0);
  // true: kesin çıkmaz (kanıtlı). false: çıkmaz olduğu kanıtlanamadı (çözülebilir ya da bütçe yetmedi).
  // cap: düğüm bütçesi · ms: süre bütçesi (oyunda donma olmasın). Bütçe aşılırsa "kanıtlanamadı" (false) döner; ctx.over ile anlaşılır.
  function cikmaz(st, ctx, cap = 20000, ms = 0) {
    if (K.boyaAcik(st)) return false;   // açık boya damlası: renkler değişebilir, kanıt yok (B3)
    ctx = ctx || hazirla(st);
    if (ctx.dead.size > 150000) { ctx.dead.clear(); ctx.fuses.clear(); }   // bellek sınırı (kalabalık makaslı tahtalar)
    ctx.son = ms ? now() + ms : 0;
    const ps = st.pieces.map(p => { const s = intern(ctx, shapeOf(p.cells)), sh = shapeOf(p.cells); return { color: p.color, s, comp: compsOf(ctx, s).comp[sh.y * ctx.W + sh.x] }; });
    ctx.nodes = 0; ctx.cap = cap; ctx.over = false;
    const ok = kazanilir(ctx, ps, maskOf(st), (st.makas || []).reduce((m, t, i) => t.open ? m | 1 << i : m, 0));
    return !ok && !ctx.over;
  }

  // Aramada budama: açık boya damlası varken kanıt yoktur (cikmaz false döner); arama yine de yön bulsun diye sezgisel bakılır:
  // şimdiki renklerle ve "damla şu parçayı boyadı" seçeneklerinin her biriyle gevşetilmiş modelde kazanılamıyorsa dal ölü sayılır.
  // Kanıt değildir (yapıştıktan sonra boyanmayı ve iki damlanın birlikte kullanımını görmez): yalnız aramada ve raporda kullanılır, oyunda değil.
  function olu(st, ctx, cap) {
    if (!K.boyaAcik(st)) return cikmaz(st, ctx, cap);
    const acik = st.boya.filter(d => d.open), kapali = st.boya.map(d => ({ ...d, open: false }));
    if (!cikmaz({ ...st, boya: kapali }, ctx, cap)) return false;
    for (const d of acik) for (let i = 0; i < st.pieces.length; i++) {
      const p = st.pieces[i]; if (p.color === d.color || p.donuk) continue;
      const ps = st.pieces.slice(); ps[i] = { ...p, color: d.color };
      if (!cikmaz({ ...st, boya: kapali, pieces: ps }, ctx, cap)) return false;
    }
    return true;
  }

  // ---------- gerçek kurallarla arama ----------
  // i. parçanın şu anki durumda ulaşabildiği yerler: [{ dx, dy, d (kare adımı), tip: 'otur' | 'yapis' | 'yer', park }]
  // Kalıbının üstüne gelen parça oraya oturur ve daha ileri gidemez. park: 'kalip' = parça açık bir kalıbın tamamen içinde.
  function hedefler(ctx, st, i) {
    if (st.pieces[i].donuk) return [];   // donmuş parça hamle yapamaz (ona yapışılır)
    const { W, H, wall } = ctx, p = st.pieces[i], occ = new Int8Array(W * H), hole = new Int8Array(W * H).fill(-1), mk = new Uint8Array(W * H), ya = new Uint8Array(W * H), cok = p.cells.length > 1;
    if (st.makas) for (const m of st.makas) { if (m.open) mk[m.y * W + m.x] = 1; if (m.open || m.hold) ya[m.y * W + m.x] = 1; }
    const by = new Uint8Array(W * H); if (st.boya) for (const d of st.boya) if (d.open) by[d.y * W + d.x] = 1;
    for (const c of p.cells) if (!mk[c[1] * W + c[0]]) ya[c[1] * W + c[0]] = 0;   // parça ayrılınca altındaki "tutan" makas kapanır
    st.pieces.forEach((q, j) => { if (j !== i) for (const c of q.cells) occ[c[1] * W + c[0]] = j + 1; });
    const cok2 = new Uint8Array(W * H); if (st.kirik) for (const z of st.kirik) if (!z.open || (z.basili && p.cells.some(c => c[0] === z.x && c[1] === z.y))) cok2[z.y * W + z.x] = 1;   // çökmüş ya da bu parça ayrılınca çökecek zemin
    ctx.holes.forEach(h => { if (!st.holes[h.i].filled) for (const c of h.cells) hole[c[1] * W + c[0]] = h.i; });
    const sh = shapeOf(p.cells), sinks = new Set();
    for (const h of ctx.holes) if (!st.holes[h.i].filled && !st.holes[h.i].kilit && h.color === p.color && h.shape.key === sh.key) sinks.add((h.shape.y - sh.y) * 64 + (h.shape.x - sh.x));
    const seen = new Set([0]), q = [[0, 0, 0]], out = [];
    for (let t = 0; t < q.length; t++) {
      const [dx, dy, d] = q[t];
      for (const [ex, ey] of DIRS) {
        const nx = dx + ex, ny = dy + ey, k = ny * 64 + nx; if (seen.has(k)) continue;
        let ok = true, kes = false;
        for (const c of p.cells) { const x = c[0] + nx, y = c[1] + ny; if (x < 0 || y < 0 || x >= W || y >= H || wall[y * W + x] || occ[y * W + x] || cok2[y * W + x]) { ok = false; break; } if (cok && mk[y * W + x]) kes = true; }
        if (!ok) continue;
        seen.add(k);
        if (kes) { out.push({ dx: nx, dy: ny, d: d + 1, tip: 'kes' }); continue; }   // çok kareli parça makasa itilir: kesilir, hamle orada biter
        if (sinks.has(k)) { out.push({ dx: nx, dy: ny, d: d + 1, tip: 'otur' }); continue; }
        let yapis = false, komsu = false, h0 = -2, icinde = true;
        for (const c of p.cells) {
          const x = c[0] + nx, y = c[1] + ny, hi = hole[y * W + x];
          if (h0 === -2) h0 = hi; if (hi < 0 || hi !== h0) icinde = false;
          for (const [fx, fy] of DIRS) {
            const ax = x + fx, ay = y + fy; if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
            const j = occ[ay * W + ax]; if (!j) continue;
            komsu = true; if (!ya[y * W + x] && !ya[ay * W + ax] && fuseColor(p.color, st.pieces[j - 1].color)) yapis = true;   // açık makasın kenarından dikiş geçmez
          }
        }
        if (icinde) { const hc = ctx.holes[h0].color; icinde = hc === p.color || !!(PARTS[hc] && PARTS[hc].includes(p.color)); }
        let kalipta = false; for (const c of p.cells) if (hole[(c[1] + ny) * W + c[0] + nx] >= 0) { kalipta = true; break; }
        let boya = false; for (const c of p.cells) if (by[(c[1] + ny) * W + c[0] + nx]) { boya = true; break; }
        if (boya) { out.push({ dx: nx, dy: ny, d: d + 1, tip: 'boya', park: '' }); q.push([nx, ny, d + 1]); continue; }   // damlanın üstünde kalmak: boyanır (her kipte hamle)
        out.push({ dx: nx, dy: ny, d: d + 1, tip: yapis ? 'yapis' : 'yer', park: yapis ? '' : icinde ? 'kalip' : (!komsu && !kalipta) ? 'bos' : '' });
        q.push([nx, ny, d + 1]);
      }
    }
    return out;
  }
  // Hamleyi uygula: parçayı hedefe koy; kalıbının üstündeyse oturur, değilse orada kalır (yapışabileceği her şeye yapışır).
  function uygula(st, i, dx, dy) {
    const s = K.clone(st), p = s.pieces[i];
    if (K.gecis(s, p, dx, dy) === 'makas') { K.cut(s, p, dx, dy); return s; }   // kes: bütün parçalar yerinde kalır (cekirdek M4)
    K.ayril(s, p); p.cells = p.cells.map(c => [c[0] + dx, c[1] + dy]);
    K.settle(s, p);   // yapışacak komşu yoksa yalnız kalıp denetimi yapar
    return s;
  }
  // Durumdan çıkan hamleler. Yapışma ve kalıba oturma hep vardır; yer değiştirmeler kipe göre:
  //   kip 0: yalnız kalıp içi park (parça, parçası olacağı kalıbın içine gider)
  //   kip 1: + parça başına en yakın ve en uzak boş park yeri (yol açmak için kenara çekilme)
  //   kip 2: bütün yer değiştirmeler
  function hamleler(ctx, st, kip = 0) {
    const out = [];
    for (let i = 0; i < st.pieces.length; i++) {
      const hs = hedefler(ctx, st, i); let yakin = null, uzak = null;
      for (const h of hs) {
        if (h.tip !== 'yer' || kip === 2 || h.park === 'kalip') { out.push({ i, ...h }); continue; }
        if (h.park !== 'bos') continue;
        if (!yakin) yakin = h; uzak = h;   // BFS sırası: ilk = en yakın, son = en uzak
      }
      if (kip === 1) { if (yakin) out.push({ i, ...yakin }); if (uzak && uzak !== yakin) out.push({ i, ...uzak }); }
    }
    return out;
  }
  // Genişlik öncelikli arama (hamle sayısına göre). { cozuldu, hamle, kare, yol, yolSayisi, dugum, kesildi }
  function ara(ctx, st0, { kip = 0, cap = 60000, yerSinir = Infinity } = {}) {
    const k0 = K.stateKey(st0), root = { st: st0, key: k0, g: 0, yer: 0, kare: 0, ways: 1, par: null, mv: null };
    const seen = new Map([[k0, root]]); let layer = [root], dugum = 0, kesildi = false;
    if (!st0.pieces.length) return { cozuldu: true, hamle: 0, kare: 0, yol: [], yolSayisi: 1, dugum: 0, kesildi: false };
    while (layer.length) {
      const next = [], wins = [];
      for (const n of layer) {
        for (const mv of hamleler(ctx, n.st, kip)) {
          if (mv.tip === 'yer' && n.yer >= yerSinir) continue;
          const s = uygula(n.st, mv.i, mv.dx, mv.dy), k = K.stateKey(s), old = seen.get(k);
          if (old) {
            if (old.g === n.g + 1) { old.ways += n.ways; if (n.kare + mv.d < old.kare) { old.kare = n.kare + mv.d; old.par = n; old.mv = mv; old.st = s; } }   // aynı hamle sayısıyla daha az kare adımı: o yolu tut (durum da o yoldan gelen sıralamayla; hamle indeksleri ona göre)
            continue;
          }
          if (++dugum > cap) { kesildi = true; break; }
          const c = { st: s, key: k, g: n.g + 1, yer: n.yer + (mv.tip === 'yer' ? 1 : 0), kare: n.kare + mv.d, ways: n.ways, par: n, mv };
          seen.set(k, c);
          if (!s.pieces.length) { wins.push(c); continue; }
          // kanıt bu tahtada bütçeyi aşıyorsa (kalabalık makaslı tahta) aramada her düğümde yeniden denenmez
          if (!ctx.pahali) { if (olu(s, ctx, 4000)) continue; if (ctx.over && ++ctx.asim > 20) ctx.pahali = true; }
          next.push(c);
        }
        if (kesildi) break;
      }
      if (wins.length) {
        // en az hamleli çözümler arasından kare adımı az olan tutulur (her düğümde en az kareli ebeveyn; süre formülü kare adımına bakar)
        const w = wins.reduce((a, b) => b.kare < a.kare ? b : a), yol = []; let kare = 0;
        for (let n = w; n.par; n = n.par) { const p = n.par.st.pieces[n.mv.i]; yol.unshift({ renk: p.color, kareler: p.cells.map(c => [c[0], c[1]]), dx: n.mv.dx, dy: n.mv.dy, d: n.mv.d, tip: n.mv.tip, i: n.mv.i }); kare += n.mv.d; }
        return { cozuldu: true, hamle: w.g, kare, yol, yolSayisi: wins.reduce((a, x) => a + x.ways, 0), dugum, kesildi };
      }
      if (kesildi) break;
      layer = next;
    }
    return { cozuldu: false, dugum, kesildi };
  }
  // Çöz: önce akıllı yer değiştirme kümesi, bulunamazsa bütün hedeflerle (en çok 2 yer değiştirme).
  function coz(st, opt = {}) {
    const ctx = opt.ctx || hazirla(st), t0 = now(), k = K.stateKey(st);
    if (cikmaz(st, ctx)) return { cozuldu: false, cikmaz: true, dugum: 0, ms: now() - t0 };
    // kip merdiveni: önce en dar hamle kümesi; çözüm çıkmazsa genişlet. Çözüm hangi kipte bulunduysa "en kısa" o kümeye göredir.
    let r = null, dugum = 0, kip = 0;
    for (const [kp, cap, yerSinir] of [[0, opt.cap || 40000, Infinity], [1, opt.cap || 40000, Infinity], [2, opt.capTam || 40000, 2]]) {
      if (kp > (opt.kip ?? 2)) break;
      r = ara(ctx, st, { kip: kp, cap, yerSinir }); dugum += r.dugum; kip = kp;
      if (r.cozuldu) break;
    }
    r.dugum = dugum; r.kip = kip; r.mod = ['kalip', 'park', 'tam'][kip]; r.cikmaz = false; r.ms = now() - t0;
    if (r.cozuldu || !r.kesildi) ctx.solv.set(k, r.cozuldu);   // bütçeye takılan arama "çözülemez" diye saklanmaz
    return r;
  }
  const cozulur = (ctx, st) => { const k = K.stateKey(st), m = ctx.solv.get(k); if (m !== undefined) return m; const r = !cikmaz(st, ctx) && (ara(ctx, st, { cap: 3000 }).cozuldu || ara(ctx, st, { kip: 1, cap: 3000 }).cozuldu); ctx.solv.set(k, r); return r; };   // yalnız "belirsiz" sayımında kullanılır, puana girmez

  // Bölüm raporu: çözüm + zorluk bileşenleri + önerilen süre.
  // Yanlış yapışma KARAR olarak sayılır, yerleşim olarak değil: aynı hatalı sonuç (oluşan parçanın rengi + şekli) tahtanın neresinde ve
  // çözümün hangi adımında yapılırsa yapılsın bir kez sayılır. Yalnız kanıtlı çıkmaza götüren yapışma yanlış sayılır (cikmaz);
  // aramada çözümü bulunamayan ama kanıtlanamayan yapışmalar "belirsiz"dir ve puana girmez.
  //   yapisma: çözüm boyunca yapılabilecek farklı yapışma kararı · yanlis: bunlardan kanıtlı çıkmaza götürenler · darlik: yanlis / yapisma
  //   etiket:  yanlışların nedeni: renk (oluşan rengin açık kalıbı yok) · sekil (hiçbir kalıba sığmıyor) · yol (sığıyor ama çıkmaz)
  //            duvar: yanlışlardan kaçı yalnız duvar yüzünden çıkmaz (duvarlar kalkınca çıkmaz değil): "aralıktan geçmeyen şekil" tuzağı
  //   karisim: çözümdeki renk karışımı sayısı · kes: çözümdeki kesim sayısı
  //   puan:    2·hamle + 3·log2(1 + yanlis) + 4·darlik   (taslak; katsayılar kapalı testte ayarlanır)
  //   sure:    15 sn okuma payı + en kısa çözümün her kare adımı için 1,3 sn (sureZor: 1,0 sn). Başlangıç formülü, testte ayarlanır.
  function rapor(L, opt = {}) {
    const hata = K.validate(L); if (hata.length) return { gecerli: false, hata };
    const t0 = now(), st = K.load(L), ctx = hazirla(st), r = coz(st, { ...opt, ctx });
    const out = { gecerli: true, hata: [], ...r, parca: st.pieces.length, kalip: st.holes.length };
    if (!r.cozuldu) return out;
    const pk = (s, p) => p.color + ':' + p.cells.map(c => c[1] * s.W + c[0]).sort((a, b) => a - b).join('.');
    // hamlenin sonucu: oluşan (yeni) en büyük parça → karar sınıfı (renk + şekil) ve neden etiketi
    const sonuc = (once, sonra) => {
      const eski = new Set(once.pieces.map(p => pk(once, p))); let yeni = null;
      for (const p of sonra.pieces) if (!eski.has(pk(sonra, p)) && (!yeni || p.cells.length > yeni.cells.length)) yeni = p;
      if (!yeni) return null;
      const sh = intern(ctx, shapeOf(yeni.cells)), acik = ctx.holes.filter(h => !sonra.holes[h.i].filled);
      const renkli = acik.filter(h => h.color === yeni.color);
      return { sinif: yeni.color + sh.key, renk: yeni.color, etiket: !renkli.length ? 'renk' : !renkli.some(h => fitsHole(ctx, sh, h)) ? 'sekil' : 'yol' };
    };
    let s = st; const sinif = new Map(), etiket = { renk: 0, sekil: 0, yol: 0 }; let karisim = 0, belirsiz = 0, belirsizTemas = 0;
    for (const mv of r.yol) {
      const gor = new Set();
      for (const h of hamleler(ctx, s, 0)) {
        if (h.tip !== 'yapis') continue;
        const c = uygula(s, h.i, h.dx, h.dy), k = K.stateKey(c); if (gor.has(k)) continue; gor.add(k);
        const x = sonuc(s, c); if (!x) continue;
        const kotu = c.pieces.length ? olu(c, ctx) : false;
        if (!kotu && c.pieces.length && !cozulur(ctx, c)) { belirsiz++; continue; }
        const o = sinif.get(x.sinif); if (!o) sinif.set(x.sinif, { kotu, etiket: x.etiket, st: c }); else if (!kotu) o.kotu = false;   // aynı karar bir yerde doğruysa yanlış sayılmaz
      }
      if (mv.tip === 'yapis') { const s2 = K.clone(s), p2 = s2.pieces[mv.i]; K.ayril(s2, p2); p2.cells = p2.cells.map(c => [c[0] + mv.dx, c[1] + mv.dy]); if (K.belirsiz(s2, p2)) belirsizTemas++; }
      const sonraki = uygula(s, mv.i, mv.dx, mv.dy);
      if (mv.tip === 'yapis' && 'ryb'.includes(mv.renk)) { const x = sonuc(s, sonraki); if (x ? 'gop'.includes(x.renk) : sonraki.holes.some((h, i) => h.filled && !s.holes[i].filled && 'gop'.includes(h.color))) karisim++; }
      s = sonraki;
    }
    let yanlis = 0, duvar = 0; const bos = st.wallCells.length ? { walls: new Set(), wallCells: [] } : null, ctx2 = bos && hazirla({ ...st, ...bos });
    for (const o of sinif.values()) if (o.kotu) { yanlis++; etiket[o.etiket]++; if (bos && !cikmaz({ ...o.st, ...bos }, ctx2)) duvar++; }
    etiket.duvar = duvar;
    out.yapisma = sinif.size; out.yanlis = yanlis; out.darlik = sinif.size ? +(yanlis / sinif.size).toFixed(2) : 0;
    out.etiket = etiket; out.belirsiz = belirsiz; out.karisim = karisim;
    out.belirsizTemas = belirsizTemas;   // çözümde, parçanın aynı anda iki farklı ana renge değdiği hamle sayısı (sonuç sıraya bağlı: üretici eler)
    out.kes = r.yol.filter(m => m.tip === 'kes').length; out.yapisHamle = r.yol.filter(m => m.tip === 'yapis').length;
    out.sure = Math.round(15 + 1.3 * r.kare); out.sureZor = Math.round(15 + 1.0 * r.kare);
    out.puan = +(2 * r.hamle + 3 * Math.log2(1 + yanlis) + 4 * out.darlik).toFixed(1);
    out.ms = now() - t0;
    return out;
  }
  // Çözümü baştan oynatıp doğrula. Aramanın kodunu kullanmaz: yalnız çekirdekle, oyunun yaptığı gibi tek tek kare adımıyla oynatır
  // (K.gecis ile yol arar, kendi kalıbının üstünden geçmez, kesimde K.cut, hedefte K.settle). Tahta boşalıyorsa true.
  function dogrula(L, yol) {
    const st = K.load(L);
    for (const mv of yol) {
      const p = st.pieces[mv.i]; if (!p) return false;
      const bas = p.cells.map(c => [c[0], c[1]]), at = (dx, dy) => { p.cells = bas.map(c => [c[0] + dx, c[1] + dy]); };
      // tek kare adımlarıyla (dx,dy)'ye ulaşılabiliyor mu
      const gor = new Set(['0,0']), q = [[0, 0]]; let vardi = false, kes = null;
      for (let t = 0; t < q.length && !vardi; t++) {
        const [x, y] = q[t];
        for (const [ex, ey] of DIRS) {
          const nx = x + ex, ny = y + ey, k = nx + ',' + ny; if (gor.has(k)) continue;
          at(x, y); const g = K.gecis(st, p, ex, ey);
          if (g === 'makas' && nx === mv.dx && ny === mv.dy && mv.tip === 'kes') { kes = [x, y, ex, ey]; vardi = true; break; }
          if (g !== 'yol') continue;
          gor.add(k);
          if (nx === mv.dx && ny === mv.dy) { vardi = true; break; }
          at(nx, ny); if (K.moldUnder(st, p)) continue;   // kalıbının üstünden geçemez: oraya oturur
          q.push([nx, ny]);
        }
      }
      at(0, 0);
      if (!vardi || (mv.tip === 'kes') !== !!kes) return false;
      if (kes) { at(kes[0], kes[1]); if (!K.cut(st, p, kes[2], kes[3])) return false; }
      else { K.ayril(st, p); at(mv.dx, mv.dy); K.settle(st, p); }
    }
    return st.pieces.length === 0;
  }
  return { hazirla, cikmaz, coz, ara, rapor, dogrula, hedefler, hamleler, uygula, shapeOf };
});
