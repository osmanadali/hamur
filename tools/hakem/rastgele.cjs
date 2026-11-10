// Rastgele karşılaştırma testi: çıkmaz kanıtı ve çözücü, "serbest model" ile sınanır.
// Serbest model yalnız çekirdek çağrılarıyla (tek kare adım, tek tek yapışma, kesme, kalıba oturma) küçük bölümün BÜTÜN durumlarını çıkarır
// ve geriye doğru "kazanılır" kümesini hesaplar. Sonra: (1) kazanılır hiçbir durumda cikmaz true dememeli (yanlış alarm yok);
// (2) çözücünün bulduğu her çözüm serbest modelde de kazanılır olmalı ve dogrula'dan geçmeli. Tohumlu: her koşuda aynı bölümler.
'use strict';
const K = require('../../www/rules/cekirdek.js'), C = require('../../www/rules/cozucu.js');
module.exports = async ({ check, metrics }) => {
  let seed = 20261110; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff, ri = n => Math.floor(rnd() * n);
  function gen() {
    const W = 3 + ri(3), H = 3 + ri(2), map = Array.from({ length: H }, () => Array(W).fill('.')), molds = Array.from({ length: H }, () => Array(W).fill('.'));
    for (let i = ri(4); i > 0; i--) map[ri(H)][ri(W)] = '#';
    for (let m = 1 + ri(2); m > 0; m--) {
      const col = 'RYBGOP'[ri(6)], n = 1 + ri(4), sh = []; let x = ri(W), y = ri(H);
      for (let t = 0; t < 30 && sh.length < n; t++) {
        if (map[y][x] === '.' && molds[y][x] === '.') { molds[y][x] = col; sh.push([x, y]); }
        const c = sh.length ? sh[ri(sh.length)] : [ri(W), ri(H)], d = K.DIRS[ri(4)];
        x = Math.min(W - 1, Math.max(0, c[0] + d[0])); y = Math.min(H - 1, Math.max(0, c[1] + d[1]));
      }
    }
    for (let i = ri(3); i > 0; i--) { const x = ri(W), y = ri(H); if (map[y][x] !== '#' && molds[y][x] === '.') molds[y][x] = 'x'; }
    for (const g of K.groups(molds.map(r => r.join('')), 'RYBGOP')) {
      const col = g.ch.toLowerCase(); let left = g.cells.length;
      while (left > 0) {
        const n = 1 + ri(Math.min(left, 2)); let c = col;
        if (K.PARTS[col] && rnd() < .7) c = K.PARTS[col][ri(2)];
        if (rnd() < .05) c = 'rybgop'[ri(6)];
        for (let t = 0; t < 50; t++) {
          const x = ri(W), y = ri(H), hor = ri(2), cs = []; for (let i = 0; i < n; i++) cs.push(hor ? [x + i, y] : [x, y + i]);
          if (cs.every(q => q[0] < W && q[1] < H && map[q[1]][q[0]] === '.')) { cs.forEach(q => { map[q[1]][q[0]] = c; }); left -= n; break; }
          if (t === 49) left = -99;
        }
      }
    }
    return { t: 30, map: map.map(r => r.join('')), molds: molds.map(r => r.join('')) };
  }
  function succ(st) {
    const out = [];
    for (let i = 0; i < st.pieces.length; i++) {
      for (const [dx, dy] of K.DIRS) { const s = K.clone(st); if (K.move(s, s.pieces[i], dx, dy)) out.push(s); else if (K.canCut(s, s.pieces[i], dx, dy)) { K.cut(s, s.pieces[i], dx, dy); out.push(s); } }
      for (const t of K.touching(st, st.pieces[i])) {
        const s = K.clone(st), j = st.pieces.indexOf(t.q), p = s.pieces[i]; K.fuse(s, p, s.pieces[j]); out.push(s);
        const s2 = K.clone(s); if (K.sink(s2, s2.pieces[s.pieces.indexOf(p)])) out.push(s2);
      }
    }
    return out;
  }
  let alarm = 0, sinanan = 0, durum = 0, cozulur = 0, makasli = 0, cozBad = 0, cozBuldu = 0, cozKacti = 0; const ornek = [], t0 = Date.now();
  for (let n = 0; n < 4000 && sinanan < 70 && Date.now() - t0 < 25000; n++) {
    const L = gen(); if (K.validate(L).length) continue;
    const st = K.load(L); if (st.pieces.length > 4) continue;
    const k0 = K.stateKey(st), all = new Map([[k0, { st, pred: [] }]]), q = [k0], wins = []; let buyuk = false;
    for (let t = 0; t < q.length; t++) {
      const n0 = all.get(q[t]);
      if (!n0.st.pieces.length) { wins.push(q[t]); continue; }
      for (const s of succ(n0.st)) { const k = K.stateKey(s); let e = all.get(k); if (!e) { all.set(k, e = { st: s, pred: [] }); q.push(k); } e.pred.push(q[t]); }
      if (all.size > 30000) { buyuk = true; break; }
    }
    if (buyuk) continue;
    const win = new Set(wins), w = [...wins]; while (w.length) { const k = w.pop(); for (const p of all.get(k).pred) if (!win.has(p)) { win.add(p); w.push(p); } }
    sinanan++; if (win.has(k0)) cozulur++; if (st.makas.length) makasli++;
    const ctx = C.hazirla(st), keys = [...all.keys()], adim = Math.max(1, Math.floor(keys.length / 200));
    for (let i = 0; i < keys.length; i += adim) {
      const s = all.get(keys[i]).st; if (!s.pieces.length) continue; durum++;
      if ((C.cikmaz(s, ctx) || C.cikmaz(s, null, 50)) && win.has(keys[i])) { alarm++; if (ornek.length < 2) ornek.push(JSON.stringify(L)); }
    }
    const r = C.coz(K.clone(st));
    if (r.cozuldu) { cozBuldu++; if (!win.has(k0) || !C.dogrula(L, r.yol)) { cozBad++; if (ornek.length < 2) ornek.push('ÇÖZÜM: ' + JSON.stringify(L)); } }
    else if (win.has(k0)) cozKacti++;
  }
  metrics.rastgele = { sinanan, cozulur, makasli, durum, alarm, cozBuldu, cozBad, cozKacti, ms: Date.now() - t0 };
  check('rastgele.alarm', 'Rastgele küçük bölümlerde çıkmaz kanıtı kazanılabilir hiçbir durumda yanlış alarm vermez (serbest modelle karşılaştırma)', sinanan >= 40 && alarm === 0, ornek[0] || `${sinanan} bölüm (${makasli} makaslı), ${durum} durum`);
  check('rastgele.cozum', 'Çözücünün bulduğu her çözüm serbest modelde de kazanılır ve çekirdekle oynatılınca doğrulanır', cozBuldu > 10 && cozBad === 0, ornek[0] || `${cozBuldu} çözüm`);
  check('rastgele.kacan', 'Çözücü, çözülebilen küçük bölümlerin çoğunu bulur (kaçırdıkları üretimde yalnız aday kaybıdır)', cozKacti <= cozulur * .15, `${cozKacti} / ${cozulur} kaçtı`, 'medium');
};
