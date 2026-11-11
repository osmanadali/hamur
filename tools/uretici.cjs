// Hamur — bölüm üretici. Geriye doğru üretir: önce kalıpları ve içlerindeki bitmiş şekilleri koyar, sonra şekilleri böler,
// parçaları kalıptan çıkarıp tahtaya dağıtır. Her adayı çözücü puanlar; çözülemeyen, çok kolay, çok zor ve tek hamlede biten adaylar elenir.
// Son seçim elle yapılır: üretici aday verir, bölüme karakterini insan verir (tools/uretici/elle.cjs sabit bölümler).
//
// Kullanım: node tools/uretici.cjs            → 60 bölümü üretir, özet tabloyu yazar (dosyaya dokunmaz)
//           node tools/uretici.cjs --yaz      → www/bolumler.js dosyasını yazar
//           node tools/uretici.cjs --bant=3   → yalnız o bandın aday havuzunu ve seçimini gösterir
// Üretim tohumludur: aynı kod aynı bölümleri verir.
'use strict';
const fs = require('fs'), path = require('path');
const K = require('../www/rules/cekirdek.js'), C = require('../www/rules/cozucu.js');
const ELLE = require('./uretici/elle.cjs'), IPUCU = ELLE.ipucu || {};

// ---------- tohumlu rastgele ----------
function rastgele(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sec = (r, a) => a[Math.floor(r() * a.length)];
const ara_ = (r, [a, b]) => a + Math.floor(r() * (b - a + 1));
const karistir = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- şekiller ----------
// n karelik rastgele bağlı şekil (sol üst köşesi 0,0)
function sekil(r, n) {
  const cells = [[0, 0]], set = new Set(['0,0']);
  while (cells.length < n) {
    const [x, y] = sec(r, cells), [dx, dy] = sec(r, D4), k = (x + dx) + ',' + (y + dy);
    if (set.has(k)) continue;
    set.add(k); cells.push([x + dx, y + dy]);
  }
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(c => [c[0] - mx, c[1] - my]);
}
// Bağlı şekli k bağlı parçaya böl (tohum karelerden rastgele büyüterek)
function bol(r, cells, k) {
  k = Math.min(k, cells.length);
  const kim = new Map(), tohum = karistir(r, cells).slice(0, k), parts = tohum.map(c => [c]);
  tohum.forEach((c, i) => kim.set(c + '', i));
  let kalan = cells.length - k, guard = 0;
  while (kalan > 0 && guard++ < 500) {
    const i = Math.floor(r() * k), [x, y] = sec(r, parts[i]), [dx, dy] = sec(r, D4), c = cells.find(q => q[0] === x + dx && q[1] === y + dy);
    if (!c || kim.has(c + '')) continue;
    kim.set(c + '', i); parts[i].push(c); kalan--;
  }
  return kalan ? null : parts;
}
const bagli = cells => { const S = new Set(cells.map(c => c + '')), q = [cells[0]], g = new Set([cells[0] + '']); while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of D4) { const k = (x + dx) + ',' + (y + dy); if (S.has(k) && !g.has(k)) { g.add(k); q.push([x + dx, y + dy]); } } } return g.size === cells.length; };

// ---------- bantlar (mekanik takvimi) ----------
// renk: bölümde bulunabilecek kalıp renkleri kümeleri. İlk iki bantta birbirine karışabilecek iki ana renk aynı bölümde bulunmaz
// (karışım 21. bölümde öğretilir): tek ana renk, ya da bir ana renk + onunla karışmayan ara renk.
const BANT = [
  { no: 1, ad: 'yapışma ve kalıp', bas: 1, son: 10, boy: [[4, 4], [5, 4], [5, 5]], duvar: ['yok'], kalip: [1, 2], kalipBoy: [2, 4], parca: [2, 5],
    renk: [['r'], ['y'], ['b'], ['r', 'g'], ['y', 'p'], ['b', 'o']], karisim: 0 },
  { no: 2, ad: 'duvar ve dar aralık', bas: 11, son: 20, boy: [[5, 5], [5, 6], [6, 6]], duvar: ['aralik'], kalip: [1, 2], kalipBoy: [2, 4], parca: [3, 5],
    renk: [['r'], ['y'], ['b'], ['r', 'g'], ['y', 'p'], ['b', 'o']], karisim: 0 },
  { no: 3, ad: 'yeşil', bas: 21, son: 35, boy: [[5, 5], [5, 6], [6, 6]], duvar: ['yok', 'yok', 'aralik', 'adacik'], kalip: [1, 3], kalipBoy: [2, 4], parca: [3, 6],
    renk: [['g'], ['g', 'b'], ['g', 'y'], ['g', 'g'], ['g', 'b', 'y']], karisim: 1 },
  { no: 4, ad: 'mor ve turuncu', bas: 36, son: 50, boy: [[5, 6], [6, 6], [6, 7]], duvar: ['yok', 'aralik', 'adacik'], kalip: [2, 3], kalipBoy: [2, 4], parca: [4, 7],
    renk: [['p', 'y'], ['o', 'b'], ['p', 'o'], ['g', 'p'], ['g', 'o'], ['p', 'r'], ['o', 'y'], ['g', 'p', 'o'], ['p', 'y', 'b']], karisim: 1 },
  // Makas: en kısa çözümde en az bir kesim olmalı. İki kurgu: "yapışık başla, kes, doğru yerden yapıştır" (bir tek kare başka parçaya
  // yapışık başlar) ve "karıştır, kes, dağıt" (aynı ara renkte iki kalıp, her biri tek ana renk parçayla dolar: önce karışıp sonra kesilmeli).
  { no: 5, ad: 'makas', bas: 51, son: 60, boy: [[5, 5], [5, 6], [6, 6]], duvar: ['yok', 'yok', 'adacik'], kalip: [2, 3], kalipBoy: [1, 3], parca: [2, 5], makas: [1, 2],
    renk: [['r', 'r'], ['y', 'y'], ['b', 'b'], ['g', 'g'], ['p', 'p'], ['o', 'o'], ['r', 'r', 'g'], ['b', 'b', 'o'], ['g', 'g', 'b'], ['p', 'p', 'y']], karisim: 1 },
  // 61 sonrası: yeni mekanik yok, öğrenilenler karışır ve tahta büyür (ikinci ve üçüncü dünya). Zorluk önceki bantların üstünden başlar.
  { no: 6, ad: 'karışık renkler', bas: 61, son: 90, havuz: 60, boy: [[6, 6], [6, 7], [7, 7]], duvar: ['yok', 'aralik', 'adacik'], kalip: [2, 4], kalipBoy: [2, 4], parca: [5, 8],
    renk: [['g', 'p'], ['g', 'o'], ['p', 'o'], ['g', 'p', 'o'], ['p', 'y', 'b'], ['o', 'b', 'r'], ['g', 'r', 'y'], ['g', 'g', 'p'], ['p', 'p', 'o'], ['g', 'b', 'o']], karisim: 1 },
  { no: 7, ad: 'makaslı karışık', bas: 91, son: 120, havuz: 60, boy: [[5, 6], [6, 6], [6, 7]], duvar: ['yok', 'yok', 'adacik'], kalip: [2, 3], kalipBoy: [1, 3], parca: [3, 6], makas: [1, 2],
    renk: [['g', 'g'], ['p', 'p'], ['o', 'o'], ['r', 'r', 'g'], ['b', 'b', 'o'], ['g', 'g', 'b'], ['p', 'p', 'y'], ['o', 'o', 'b'], ['g', 'g', 'p'], ['p', 'p', 'o']], karisim: 1 },
  { no: 8, ad: 'büyük tahta', bas: 121, son: 150, havuz: 60, boy: [[6, 6], [6, 7], [7, 7]], duvar: ['yok', 'aralik', 'adacik', 'adacik'], kalip: [3, 4], kalipBoy: [2, 4], parca: [5, 8],
    renk: [['g', 'p', 'o'], ['p', 'y', 'b'], ['o', 'b', 'r'], ['g', 'r', 'y'], ['g', 'p', 'r'], ['g', 'o', 'b'], ['p', 'o', 'y'], ['g', 'p', 'o', 'r']], karisim: 1 },
];
const PARTS = K.PARTS;

// ---------- aday üretimi ----------
function duvarKoy(r, tur, W, H) {
  const map = Array.from({ length: H }, () => Array(W).fill('.'));
  let bolge = null;   // aralıklı duvarda: kalıpların konacağı taraf (y aralığı)
  if (tur === 'aralik') {
    const yatay = H >= W || r() < .5;
    if (yatay) { const y = ara_(r, [2, H - 3]), g = ara_(r, [0, W - 1]); for (let x = 0; x < W; x++) if (x !== g) map[y][x] = '#'; bolge = r() < .5 ? { y0: 0, y1: y - 1, yan: 'y', duvar: y } : { y0: y + 1, y1: H - 1, yan: 'y', duvar: y }; }
    else { const x = ara_(r, [2, W - 3]), g = ara_(r, [0, H - 1]); for (let y = 0; y < H; y++) if (y !== g) map[y][x] = '#'; bolge = r() < .5 ? { x0: 0, x1: x - 1, yan: 'x', duvar: x } : { x0: x + 1, x1: W - 1, yan: 'x', duvar: x }; }
  } else if (tur === 'adacik') {
    for (let n = ara_(r, [1, 3]); n > 0; n--) { const x = ara_(r, [1, W - 2]), y = ara_(r, [1, H - 2]); map[y][x] = '#'; if (r() < .5) { const [dx, dy] = sec(r, D4); if (map[y + dy]?.[x + dx] !== undefined) map[y + dy][x + dx] = '#'; } }
  }
  return { map, bolge };
}
const icinde = (b, x, y) => !b || (b.yan === 'y' ? y >= b.y0 && y <= b.y1 : x >= b.x0 && x <= b.x1);

function aday(r, B, zorla = {}) {
  const [W, H] = zorla.boy || sec(r, B.boy), { map, bolge } = duvarKoy(r, sec(r, B.duvar), W, H);
  const molds = Array.from({ length: H }, () => Array(W).fill('.')), renkler = karistir(r, sec(r, B.renk));
  const nKalip = Math.min(renkler.length, ara_(r, B.kalip)) || 1, parcalar = [];
  // makas bandı, "karıştır, kes, dağıt" kurgusu: ilk iki kalıp aynı ara renkteyse her biri tek ana renk parçayla dolar
  const dagit = B.makas && PARTS[renkler[0]] && renkler[1] === renkler[0] && r() < .6 ? (r() < .5 ? [...PARTS[renkler[0]]] : [...PARTS[renkler[0]]].reverse()) : null;
  // 1) kalıplar: birbirine değmeden, duvarsız karelere (aralıklı duvarda kalıp tarafına)
  for (let k = 0; k < nKalip; k++) {
    const renk = renkler[k % renkler.length];
    let kondu = false;
    for (let dene = 0; dene < 60 && !kondu; dene++) {
      const s = sekil(r, ara_(r, B.kalipBoy)), sw = Math.max(...s.map(c => c[0])) + 1, sh = Math.max(...s.map(c => c[1])) + 1;
      if (sw > W || sh > H) continue;
      const ox = ara_(r, [0, W - sw]), oy = ara_(r, [0, H - sh]), cells = s.map(c => [c[0] + ox, c[1] + oy]);
      if (!cells.every(([x, y]) => map[y][x] === '.' && molds[y][x] === '.' && icinde(bolge, x, y))) continue;
      if (cells.some(([x, y]) => D4.some(([dx, dy]) => (molds[y + dy]?.[x + dx] || '.') !== '.'))) continue;   // kalıplar birbirine değmez
      if (dagit && k === 1 && cells.length !== 1) continue;                                                     // "dağıt" kurgusunda ikinci kalıp tek kare
      // 2) şekli parçalara böl ve renk ver
      const mix = PARTS[renk];
      let grup;
      if (dagit && k < 2) grup = [[dagit[k], cells]];
      else if (mix && B.karisim && cells.length >= 2) {
        // ara renk kalıbı: iki bağlı bölge (iki ana renk); her bölge kendi içinde bölünebilir. Önce aynı renkler birleşir, sonra karışır.
        const iki = bol(r, cells, 2); if (!iki || !iki.every(bagli)) continue;
        const [a, b] = r() < .5 ? [mix[0], mix[1]] : [mix[1], mix[0]];
        grup = [[a, iki[0]], [b, iki[1]]].flatMap(([c, bolge_]) => (bol(r, bolge_, r() < .45 ? 2 : 1) || [bolge_]).map(p => [c, p]));
      } else {
        const n = cells.length === 1 ? 1 : Math.min(cells.length, ara_(r, [2, 3]));
        const ps = bol(r, cells, n); if (!ps) continue;
        grup = ps.map(p => [renk, p]);
      }
      if (!grup.every(([, p]) => bagli(p))) continue;
      for (const [x, y] of cells) molds[y][x] = renk.toUpperCase();
      for (const [c, p] of grup) parcalar.push({ renk: c, cells: p });
      kondu = true;
    }
    if (!kondu) return null;
  }
  // makas bandı, "yapışık başla" kurgusu: tek karelik bir parça, aynı renkteki başka bir parçaya rastgele bir kenarından yapışık başlar
  if (B.makas && !dagit) {
    const tekler = parcalar.filter(p => p.cells.length === 1), u = tekler.length && sec(r, tekler), ev = u && parcalar.filter(p => p !== u && p.renk === u.renk);
    if (!u || !ev.length) return null;
    const v = sec(r, ev), bos = [];
    for (const [x, y] of v.cells) for (const [dx, dy] of D4) if (!v.cells.some(c => c[0] === x + dx && c[1] === y + dy)) bos.push([x + dx, y + dy]);
    v.cells = v.cells.concat([sec(r, bos)]); parcalar.splice(parcalar.indexOf(u), 1);
  }
  if (parcalar.length < B.parca[0] || parcalar.length > B.parca[1]) return null;
  // 3) parçaları kalıptan çıkar: boş (duvarsız, kalıpsız, başka parçaya değmeyen) rastgele yerlere koy
  const dolu = map.map(row => row.slice());
  for (const p of karistir(r, parcalar)) {
    const mx = Math.min(...p.cells.map(c => c[0])), my = Math.min(...p.cells.map(c => c[1])), rel = p.cells.map(c => [c[0] - mx, c[1] - my]);
    const sw = Math.max(...rel.map(c => c[0])) + 1, sh = Math.max(...rel.map(c => c[1])) + 1;
    let kondu = false;
    for (let dene = 0; dene < 80 && !kondu; dene++) {
      const ox = ara_(r, [0, W - sw]), oy = ara_(r, [0, H - sh]), cells = rel.map(c => [c[0] + ox, c[1] + oy]);
      if (!cells.every(([x, y]) => dolu[y][x] === '.' && molds[y][x] === '.')) continue;
      if (cells.some(([x, y]) => D4.some(([dx, dy]) => 'rybgop'.includes(dolu[y + dy]?.[x + dx] || '.')))) continue;   // hiçbir parçaya değmeden başlar
      if (bolge && r() < .8 && cells.some(([x, y]) => icinde(bolge, x, y))) continue;   // aralıklı duvarda çoğu parça karşı tarafta başlar
      if (bolge && cells.some(([x, y]) => (bolge.yan === 'y' ? y : x) === bolge.duvar)) continue;   // aralığın içinde parça başlamaz (aralık baştan tıkalı olmasın)
      for (const [x, y] of cells) dolu[y][x] = p.renk;
      kondu = true;
    }
    if (!kondu) return null;
  }
  if (B.makas) for (let n = ara_(r, B.makas), dene = 0; n > 0 && dene < 60; dene++) {
    const x = ara_(r, [0, W - 1]), y = ara_(r, [0, H - 1]);
    if (dolu[y][x] !== '.' || molds[y][x] !== '.') continue;
    molds[y][x] = 'x'; n--;
  }
  const L = { t: 60, hint: ['', ''], map: dolu.map(row => row.join('')), molds: molds.map(row => row.join('')) };
  if (K.validate(L).length) return null;
  return K.load(L).pieces.length === parcalar.length ? L : null;   // bitişik aynı harfler sessizce tek parça olmasın
}

// Aday kalitesi: çözücü raporu + eleme. null = elendi.
function puanla(L, B) {
  const R = C.rapor(L, { cap: 6000, kip: 1 });
  if (!R.gecerli || !R.cozuldu || R.kesildi) return null;
  if (!C.dogrula(L, R.yol)) return null;                                // çözüm çekirdekle tek tek adımla oynatılınca tahtayı boşaltmalı
  const st = K.load(L);
  if (R.belirsizTemas) return null;                                    // çözümde iki farklı renge aynı anda değen hamle: sonuç sıraya bağlı
  if (R.hamle < 2 || R.yapisHamle < 1) return null;                    // tek hamlede biten, çözümünde hiç yapışma olmayan
  if (R.yanlis < 1) return null;                                        // yanlış yapılabilecek hiçbir yapışma yok: karar yok
  if (R.kare / st.pieces.length < 2) return null;                       // parçalar zaten kalıbın dibinde
  if (R.hamle > B.parca[1] + 3) return null;                           // bant için fazla uzun
  if (B.no === 3 && !R.karisim) return null;                            // yeşil bandı: çözümde karışım olmalı
  if (B.no === 4 && (!R.karisim || !R.etiket.renk)) return null;       // mor ve turuncu bandı: karışım ve yanlış renk tuzağı olmalı
  if (B.makas) {                                                        // makas bandı: kesim zorunlu olmalı (makassız çözülemez)
    if (!R.kes) return null;
    const duz = { ...L, molds: L.molds.map(row => row.replace(/x/g, '.')) };
    if (C.coz(K.load(duz), { cap: 3000, kip: 1 }).cozuldu) return null;
  }
  // aralıklı duvar bandı: aralık gerçekten kullanılmalı (en az bir hamle duvarın öbür yanına geçmeli)
  if (B.duvar.length === 1 && B.duvar[0] === 'aralik') {
    const satir = L.map.findIndex(row => (row.match(/#/g) || []).length >= row.length - 1), sutun = satir < 0 ? [...L.map[0]].findIndex((_, x) => L.map.filter(row => row[x] === '#').length >= L.map.length - 1) : -1;
    const taraf = c => satir >= 0 ? Math.sign(c[1] - satir) : Math.sign(c[0] - sutun);
    if (!R.yol.some(m => taraf(m.kareler[0]) !== taraf([m.kareler[0][0] + m.dx, m.kareler[0][1] + m.dy]))) return null;
  }
  return { L, R, parca: st.pieces.length, alan: st.W * st.H };
}
// Kopya denetimi: yatay / dikey ayna ve renk yeniden adlandırma altında aynı olan bölümler aynı imzayı verir
const imza = L => {
  const ters = s => [...s].reverse().join(''), ad = s => { const m = {}; let n = 0; return s.replace(/[rybgop]/gi, c => { const k = c.toLowerCase(); if (!(k in m)) m[k] = String.fromCharCode(97 + n++); return c === k ? m[k] : m[k].toUpperCase(); }); };
  const bic = (map, molds) => ad(map.join('/') + '|' + molds.join('/'));
  return [bic(L.map, L.molds), bic(L.map.map(ters), L.molds.map(ters)), bic(L.map.slice().reverse(), L.molds.slice().reverse()), bic(L.map.map(ters).reverse(), L.molds.map(ters).reverse())].sort()[0];
};
// Kaba benzerlik ("aynı his"): tahta boyundan, yönden ve renkten bağımsız iskelet. Kalıp şekilleri dönme ve ayna altında eşitlenir,
// renkler ana / ara diye ayrılır, parça boyları eklenir. Bant içinde aynı iskelet cezalanır, art arda gelemez.
const sekilKanon = cells => {
  let en = null;
  for (let d = 0; d < 8; d++) {
    const c = cells.map(([x, y]) => { for (let i = 0; i < (d & 3); i++) [x, y] = [-y, x]; return d & 4 ? [-x, y] : [x, y]; });
    const mx = Math.min(...c.map(q => q[0])), my = Math.min(...c.map(q => q[1])), k = c.map(q => (q[0] - mx) + '' + (q[1] - my)).sort().join('.');
    if (en === null || k < en) en = k;
  }
  return en;
};
const tur = L => { const st = K.load(L), sinif = c => 'ryb'.includes(c) ? 'a' : 'k'; return st.holes.map(h => sinif(h.color) + sekilKanon(h.cells)).sort().join(',') + ':' + st.pieces.map(p => sinif(p.color) + p.cells.length).sort().join('') + ':' + st.makas.length; };   // duvar anahtara girmez: aynı bulmacanın duvarlı hali de aynı histir

function havuz(B, n = 70, tohum = 1000) {
  const r = rastgele(tohum + B.no * 7919), out = [], gor = new Set(); let deneme = 0;
  while (out.length < n && deneme++ < n * 400) {
    const L = aday(r, B); if (!L) continue;
    const k = imza(L); if (gor.has(k)) continue; gor.add(k);
    const p = puanla(L, B); if (p) out.push(p);
  }
  return out.sort((a, b) => a.R.puan - b.R.puan);
}

// ---------- seçim: 10 bölümlük zorluk ritmi ----------
// 1-2 rahat, 3 orta, 4 rahat, 5 zor, 6-7 rahat, 8 orta, 9 rahat, 10 döngünün en zoru
const RITIM = ['rahat', 'rahat', 'orta', 'rahat', 'zor', 'rahat', 'rahat', 'orta', 'rahat', 'enzor'];
// Bant başına mutlak hedef puanlar (cozucu rapor puanı). Bantlar üst üste biner: yeni mekanik gelince zorluk bir basamak iner,
// sonra önceki bandın üstüne çıkar. Bant içinde aynı basamak sona doğru 1,5 puan zorlaşır. Kapalı test verisiyle ayarlanır.
const HEDEF = {
  1: { rahat: 10, orta: 14.5, zor: 17.5, enzor: 19.5 },
  2: { rahat: 14.5, orta: 18, zor: 19.5, enzor: 21.5 },
  3: { rahat: 18, orta: 21, zor: 24, enzor: 26 },
  4: { rahat: 20, orta: 23.5, zor: 26.5, enzor: 28 },
  5: { rahat: 14, orta: 18, zor: 21.5, enzor: 24.5 },
  6: { rahat: 22, orta: 25.5, zor: 28.5, enzor: 30.5 },
  7: { rahat: 20, orta: 24, zor: 27, enzor: 29.5 },
  8: { rahat: 24, orta: 27.5, zor: 30.5, enzor: 33 },
};
// Bütün bantlar birlikte seçilir: 10'luk döngü bant sınırını aşabilir (31-40) ve döngünün en zoru her zaman 10. bölüm olmalıdır.
function secHepsi(bantlar) {
  const son = Math.max(...bantlar.map(x => x.B.son)), bas = Math.min(...bantlar.map(x => x.B.bas)), out = new Map(), kullan = new Set(), turSay = new Map();
  const bant = no => bantlar.find(x => no >= x.B.bas && no <= x.B.son);
  const koy = (no, L, R, ek) => { out.set(no, { no, L, R, ritim: RITIM[(no - 1) % 10], ...ek }); const t = bant(no).B.no + '|' + tur(L); turSay.set(t, (turSay.get(t) || 0) + 1); };
  for (let no = bas; no <= son; no++) if (ELLE[no] && bant(no)) koy(no, ELLE[no], C.rapor(ELLE[no]), { elle: true });
  const SIRA = ['rahat', 'orta', 'zor', 'enzor'], basamak = no => SIRA.indexOf(RITIM[(no - 1) % 10]);
  const sec1 = (no, nolar) => {
    const { B, P } = bant(no), ritim = RITIM[(no - 1) % 10];
    // döngü içinde basamak sırası korunur: rahat < orta < zor < en zor (elle yazılanlar dahil, tanıtım bölümleri hariç)
    let alt = 0, ust = Infinity;
    for (const n of nolar) { const x = out.get(n); if (!x || x.L.tanitim) continue; if (basamak(n) < basamak(no)) alt = Math.max(alt, x.R.puan + .1); if (basamak(n) > basamak(no)) ust = Math.min(ust, x.R.puan - .1); }
    const hedef = Math.max(alt, Math.min(ust, HEDEF[B.no][ritim] + 1.5 * (no - B.bas) / Math.max(1, B.son - B.bas)));
    const onceki = out.get(no - 1) && tur(out.get(no - 1).L), sonraki = out.get(no + 1) && tur(out.get(no + 1).L);
    let en = null, enC = Infinity;
    for (const p of P) {
      if (kullan.has(p) || p.R.puan < alt || p.R.puan > ust) continue;
      if (ritim !== 'rahat' && B.no === 2 && !p.R.etiket.duvar) continue;                     // duvar bandı: rahat dışındaki bölümlerde aralık tuzağı olmalı (duvar kalkınca çıkmaz olmayan yanlış)
      const t = tur(p.L); if (t === onceki || t === sonraki) continue;                         // art arda aynı iskelet olmaz
      const c = Math.abs(p.R.puan - hedef) + 3 * (turSay.get(B.no + '|' + t) || 0);          // bantta aynı iskelet tekrar etmesin
      if (c < enC) { enC = c; en = p; }
    }
    if (!en) throw new Error(`bölüm ${no}: uygun aday yok (bant ${B.no}, ${ritim}, puan ${alt.toFixed(1)}…${ust}, havuz ${P.length})`);
    kullan.add(en); koy(no, en.L, en.R, {});
  };
  for (let d = Math.floor((bas - 1) / 10); d * 10 < son; d++) {
    const nolar = []; for (let no = d * 10 + 1; no <= d * 10 + 10; no++) if (no >= bas && no <= son) nolar.push(no);
    for (const b of [0, 1, 2, 3]) for (const no of nolar) if (basamak(no) === b && !out.has(no)) sec1(no, nolar);   // önce rahatlar, en son döngünün en zoru
  }
  // elle yazılan bölümler de kabul ölçütlerine bakılır: geçmeyen uyarı olarak yazılır (tanıtım bölümleri bilerek kolaydır)
  for (const x of out.values()) if (x.elle) {
    const R = x.R, sorun = [];
    if (!R.cozuldu || !C.dogrula(x.L, R.yol)) sorun.push('çözülemiyor');
    else { if (R.hamle < 2) sorun.push('tek hamle'); if (R.belirsizTemas) sorun.push('belirsiz temas'); if (!x.L.tanitim && R.yanlis < 1) sorun.push('yanlış yapılabilecek karar yok'); }
    if (sorun.length) console.warn(`UYARI: elle bölüm ${x.no}: ${sorun.join(', ')}`);
  }
  return [...out.values()].sort((a, b) => a.no - b.no);
}
// Süre: yol haritasının başlangıç formülü (15 sn okuma payı + en kısa çözümün her kare adımı için 1,3 sn; zor ve en zor bölümlerde 1,0 sn)
// + hamle başına 2 sn (yapışma ölçüsünün dolması ve karar payı; yoksa en zor bölümler en kısa süreyi alıyordu), en az 30 sn.
// Elle bölümlerde yazılı süre kalır. Hepsi kapalı testte ayarlanır.
const sure = (x) => x.elle && x.L.t ? x.L.t : Math.max(30, (x.ritim === 'zor' || x.ritim === 'enzor' ? x.R.sureZor : x.R.sure) + 2 * x.R.hamle);

function uret(bantNo) {
  const bantlar = BANT.filter(B => !bantNo || B.no === bantNo).map(B => ({ B, P: havuz(B, B.havuz || 110) }));
  const S = secHepsi(bantlar);
  return bantlar.map(x => ({ ...x, S: S.filter(s => s.no >= x.B.bas && s.no <= x.B.son) }));
}

if (require.main === module) {
  const a = process.argv.slice(2), bantNo = +(a.find(x => x.startsWith('--bant='))?.slice(7) || 0), t0 = Date.now();
  const U = uret(bantNo);
  for (const { B, P, S } of U) {
    console.log(`\nBant ${B.no} · ${B.ad} · bölüm ${B.bas}-${B.son} · havuz ${P.length} aday · puan ${P[0]?.R.puan}…${P[P.length - 1]?.R.puan}`);
    console.log('  no  ritim   boy  parça kalıp hamle kare yanlış(renk/şekil/yol) darlık  puan süre');
    for (const x of S) { const st = K.load(x.L); console.log(`  ${String(x.no).padStart(2)}  ${x.ritim.padEnd(6)} ${st.W}x${st.H} ${String(st.pieces.length).padStart(5)} ${String(st.holes.length).padStart(5)} ${String(x.R.hamle).padStart(5)} ${String(x.R.kare).padStart(4)} ${String(x.R.yanlis).padStart(6)} ${(x.R.etiket.renk + '/' + x.R.etiket.sekil + '/' + x.R.etiket.yol).padStart(15)} ${String(x.R.darlik).padStart(6)} ${String(x.R.puan).padStart(5)} ${String(sure(x)).padStart(4)}${x.elle ? '  elle' : ''}`); }
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} sn`);
  if (a.includes('--yaz')) {
    if (bantNo) { console.error('--yaz bütün bantları yazar; --bant ile birlikte kullanılmaz'); process.exit(2); }
    const B_ = U.flatMap(u => u.S).sort((x, y) => x.no - y.no).map(x => ({ t: sure(x), hint: (x.elle && x.L.hint) || IPUCU[x.no] || ['', ''], map: x.L.map, molds: x.L.molds }));
    const satir = L => `  { t: ${L.t}, hint: ${JSON.stringify(L.hint)},\n    map: ${JSON.stringify(L.map)},\n    molds: ${JSON.stringify(L.molds)} },`;
    const bas = `// Hamur — bölümler. ÜRETİLDİ: node tools/uretici.cjs --yaz (elle düzenlenmez; sabit bölümler tools/uretici/elle.cjs içinde).\n// Biçim: www/rules/cekirdek.js başındaki açıklama. hint: [Türkçe, English]. t: süre (sn).\n(function (root, B) { if (typeof module === 'object' && module.exports) module.exports = B; else root.HAMUR_BOLUMLER = B; })(typeof self !== 'undefined' ? self : this, [\n`;
    fs.writeFileSync(path.join(__dirname, '..', 'www', 'bolumler.js'), bas + B_.map((L, i) => `  // ${i + 1}\n` + satir(L)).join('\n') + '\n]);\n');
    console.log(`www/bolumler.js yazıldı: ${B_.length} bölüm`);
  }
}
module.exports = { BANT, HEDEF, aday, puanla, havuz, uret, rastgele, RITIM, sure, IPUCU };
