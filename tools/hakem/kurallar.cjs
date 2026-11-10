// Kural çekirdeği ve çözücü testleri (tarayıcısız; her kod değişikliğinde robotla birlikte koşar).
'use strict';
const path = require('path');
const K = require('../../www/rules/cekirdek.js'), C = require('../../www/rules/cozucu.js'), B = require('../../www/bolumler.js');
const at = (st, x, y) => st.pieces.find(p => p.cells.some(c => c[0] === x && c[1] === y));
const git = (st, p, dx, dy) => { const ev = []; for (let i = 0; i < Math.abs(dx); i++) ev.push(K.move(st, p, Math.sign(dx), 0)); for (let i = 0; i < Math.abs(dy); i++) ev.push(K.move(st, p, 0, Math.sign(dy))); return ev; };

module.exports = async ({ check, metrics }) => {
  // --- hareket ve yapışma ---
  {
    const st = K.load(B[0]), p = at(st, 0, 1);
    const ev = git(st, p, 3, 0);
    check('kural.gecis', 'Yanına gelen parça kendiliğinden yapışmaz (move yalnız taşır)', ev.every(e => e && !e.length) && st.pieces.length === 2 && K.touching(st, p).length === 1);
    const duvar = K.move(st, p, 1, 0);
    check('kural.engel', 'Parça başka parçanın içinden ve tahta dışına geçemez', duvar === null && K.move(st, at(st, 4, 1), 1, 0) === null);
    const f = K.settle(st, p);
    check('kural.yapisma', 'Yanında kalan aynı renk parça yapışır ve tek parça olur', f.length === 1 && f[0].type === 'fuse' && !f[0].mixed && st.pieces.length === 1 && st.pieces[0].cells.length === 2);
    const s = git(st, st.pieces[0], -2, 2).flat();
    check('kural.kalip', 'Rengi ve şekli aynı parça kalıbın üstüne gelince oturur, tahta boşalır', s.some(e => e && e.type === 'sink') && !st.pieces.length && st.holes[0].filled);
  }
  {
    const st = K.load({ t: 9, map: ['by.', '..r', 'g..'], molds: ['...', '...', '...'] }), b = at(st, 0, 0);
    const ev = K.settle(st, b);
    check('kural.karisim', 'Mavi sarının yanında kalınca yeşile döner', ev.length === 1 && ev[0].mixed && ev[0].color === 'g' && b.color === 'g' && b.cells.length === 2);
    git(st, at(st, 2, 1), -1, 0);   // kırmızı yeşilin altına gelir
    check('kural.ara', 'Ara renk başka renkle karışmaz, yalnız kendi rengiyle yapışır', K.touching(st, at(st, 1, 1)).length === 0 && K.fuseColor('g', 'r') === undefined && K.fuseColor('g', 'g') === 'g');
    git(st, at(st, 0, 2), 0, -1);   // yeşil, yeşilin altına gelir
    check('kural.zincir', 'Karışımdan çıkan renk aynı renkli komşuyla da yapışır', K.settle(st, at(st, 0, 1)).length === 1 && at(st, 0, 0).cells.length === 3);
  }
  {
    const iyi = B.every(L => !K.validate(L).length);
    const kotu = [
      [{ t: 9, map: ['rr.'], molds: ['.R.'] }, 'eşit'],
      [{ t: 9, map: ['r.r', 'y..'], molds: ['RR.', '..Y'] }, 'kenar kenara'],
      [{ t: 9, map: ['r.', 'r'], molds: ['..', '..'] }, 'kare'],
      [{ t: 0, map: ['r.'], molds: ['.R'] }, 'süre'],
    ].map(([L, ne]) => K.validate(L).some(e => e.includes(ne)));
    check('kural.dogrulama', 'Bölüm doğrulaması: beş bölüm geçerli, bozuk bölümler nedeniyle reddedilir', iyi && kotu.every(Boolean), kotu.join());
  }
  {
    const st = K.load(B[3]), s0 = K.stateKey(st), c = K.clone(st);
    K.move(c, c.pieces[0], 0, 1);
    check('kural.kopya', 'Durum kopyası bağımsızdır (geri alma ve arama asıl durumu değiştirmez)', K.stateKey(st) === s0 && K.stateKey(c) !== s0);
  }

  // --- çözücü ---
  const R = B.map(L => C.rapor(L));
  metrics.cozucu = R.map((r, i) => ({ bolum: i + 1, hamle: r.hamle, kare: r.kare, yol: r.yolSayisi, yanlis: r.yanlis, darlik: r.darlik, puan: r.puan, sure: r.sure, ms: Math.round(r.ms) }));
  check('cozucu.bes', 'Çözücü beş prototip bölümünü çözer ve çözümler baştan oynatılınca tahtayı boşaltır',
    R.every((r, i) => r.cozuldu && C.dogrula(B[i], r.yol)), R.map(r => r.cozuldu ? r.hamle : '✗').join(' · ') + ' hamle');
  // paylaşılan bulut makinesinde süre oynak olabilir: eşik hedefin (1 sn) iki katı, önem orta
  const enYavas = Math.max(...R.map(r => r.ms));
  check('cozucu.hiz', 'Çözücü her bölümü 1 sn içinde çözer (zorluk ölçümleri dahil)', enYavas < 2000, `en yavaş ${enYavas.toFixed(0)} ms`, enYavas < 1000 ? 'high' : 'medium');
  {
    // çözüm boyunca hiçbir durum çıkmaz sayılmamalı (kanıt asla yanlış alarm vermez)
    let alarm = 0;
    B.forEach((L, i) => { let st = K.load(L); const ctx = C.hazirla(st); if (C.cikmaz(st, ctx)) alarm++; for (const m of R[i].yol) { st = C.uygula(st, m.i, m.dx, m.dy); if (st.pieces.length && C.cikmaz(st, ctx)) alarm++; } });
    check('cikmaz.alarm', 'Çıkmaz kanıtı çözüm yolundaki hiçbir durumda yanlış alarm vermez', alarm === 0, alarm + ' yanlış alarm');
  }
  {
    // prototipte yakalanmayan çıkmaz: 4. bölümde yan yana yapışan kırmızılar dar aralıktan geçemez
    const st = K.load(B[3]), p = at(st, 0, 0);
    git(st, p, 1, 0); K.settle(st, p);
    check('cikmaz.dar', '4. bölümde yan yana yapışan kırmızılar çıkmaz olarak yakalanır (prototip kaçırıyordu)', p.cells.length === 2 && K.doomed(st) === null && C.cikmaz(st) === true);
    const st2 = K.load(B[3]), q = at(st2, 0, 0);
    git(st2, q, 0, 1); K.settle(st2, q);
    check('cikmaz.dik', 'Alt alta yapışan kırmızılar (aralıktan geçer) çıkmaz sayılmaz', q.cells.length === 2 && C.cikmaz(st2) === false && C.coz(st2).cozuldu);
  }
  {
    const st = K.load(B[3]), r = at(st, 2, 2), y = at(st, 3, 4);
    git(st, r, 1, 0); git(st, r, 0, 1);   // kırmızı aralığa girer: sarının hemen üstü
    K.settle(st, r);
    check('cikmaz.renk', 'Kalıbı olmayan renk (turuncu) çıkınca çıkmaz', r.color === 'o' && !st.pieces.includes(y) && C.cikmaz(st) === true && !!K.doomed(st));
  }
  {
    const coz = C.coz(K.load({ t: 9, map: ['r#r'], molds: ['...'] }));
    const L2 = { t: 9, map: ['r.#.r', '..#..'], molds: ['.....', 'RR...'] }, r2 = C.coz(K.load(L2));
    check('cozucu.yok', 'Duvarla ayrılmış parçalar: çözüm yok ve bu kanıtlanır', !r2.cozuldu && r2.cikmaz === true && !coz.cozuldu);
  }
};
