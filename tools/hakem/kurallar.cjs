// Kural çekirdeği ve çözücü testleri (tarayıcısız; her kod değişikliğinde robotla birlikte koşar).
'use strict';
const path = require('path');
const K = require('../../www/rules/cekirdek.js'), C = require('../../www/rules/cozucu.js'), B = require('../ornek/prototip.cjs'), BOLUM = require('../../www/bolumler.js');
const { BANT, RITIM } = require('../uretici.cjs');
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
      [{ t: '9', map: ['r.'], molds: ['.R'] }, 'süre'],
      [{ t: 9, map: ['r..........'], molds: ['..........R'] }, '10×10'],
      [{ t: 9, map: [null], molds: ['.'] }, 'dizisi'],
      [{ t: 9, map: ['.r.', '...'], molds: ['.YY', 'R..'] }, 'kalıbın üstünde'],
    ].map(([L, ne]) => K.validate(L).some(e => e.includes(ne)));
    check('kural.dogrulama', 'Bölüm doğrulaması: örnek bölümler geçerli, bozuk bölümler nedeniyle reddedilir', iyi && kotu.every(Boolean), kotu.join());
  }
  {
    const st = K.load(B[3]), s0 = K.stateKey(st), c = K.clone(st);
    K.move(c, c.pieces[0], 0, 1);
    check('kural.kopya', 'Durum kopyası bağımsızdır (geri alma ve arama asıl durumu değiştirmez)', K.stateKey(st) === s0 && K.stateKey(c) !== s0);
  }

  // --- makas karesi ---
  {
    const L = { t: 9, map: ['rr...', '.....', '.....', '.....'], molds: ['.....', '..x..', '.....', 'R...R'] }, st = K.load(L), p = st.pieces[0];
    git(st, p, 0, 1);
    const dur = K.move(st, p, 1, 0), kesilir = K.canCut(st, p, 1, 0);
    const e = K.cut(st, p, 1, 0);
    check('makas.kes', 'Çok kareli parça açık makasa kendiliğinden girmez; itilince makasın üstündeki kare kopar', dur === null && kesilir && e && e.at.length === 1 && st.pieces.length === 2 && st.pieces.every(q => q.cells.length === 1) && !st.makas[0].open && st.makas[0].hold);
    const m = at(st, 2, 1), o = at(st, 1, 1);
    check('makas.yalitim', 'Kesilen kare makasın üstündeyken komşusuyla yapışmaz (kesim hemen geri dönmez)', K.touching(st, o).length === 0 && K.settle(st, o).length === 0);
    git(st, m, 0, 1);
    check('makas.tek', 'Makas tek kullanımlık: kestiği kare ayrılınca kapanır, sıradan zemin olur', !st.makas[0].open && !st.makas[0].hold && !K.makasta(st, 2, 1) && K.touching(st, o).length === 0);
    git(st, m, -1, 0);   // (1,2): öteki kırmızının altı
    check('makas.sonra', 'Kesilen parçalar makastan uzakta yeniden yapışabilir', K.settle(st, m).length === 1 && st.pieces.length === 1);
    const tek = K.load(L), u = K.load({ t: 9, map: ['r....', '.....'], molds: ['..x..', '....R'] });
    check('makas.tekkare', 'Tek karelik parça makasın üstünden geçer, makas harcanmaz', git(u, u.pieces[0], 3, 0).every(Boolean) && u.makas[0].open && K.validate(L).length === 0 && !!tek);
    const R1 = C.rapor(L), R2 = C.rapor({ t: 9, map: ['b...y', '.....', '.....'], molds: ['.G.G.', '.....', '..x..'] }), R3 = C.coz(K.load({ t: 9, map: ['b...y', '.....', '.....'], molds: ['.G.G.', '.....', '.....'] }));
    check('makas.cozucu', 'Çözücü kesmeyi hamle olarak kullanır: "yapışık başla, kes" ve "karıştır, kes, dağıt" çözülür', R1.cozuldu && R1.kes === 1 && R2.cozuldu && R2.kes === 1 && R2.hamle === 4, `${R1.hamle} ve ${R2.hamle} hamle`);
    check('makas.cikmaz', 'Makas varken çıkmaz kanıtı yanlış alarm vermez; makas yokken aynı bölüm kanıtlı çıkmazdır', !C.cikmaz(K.load(L)) && R3.cikmaz === true);
    const s2 = K.load({ t: 9, map: ['r....', 'r....', '.....'], molds: ['.x...', '.x...', 'R...R'] }), q = s2.pieces[0], e2 = K.cut(s2, q, 1, 0);
    check('makas.iki', 'Aynı anda iki makasa giren parça iki yerden kesilir', e2 && e2.at.length === 2 && s2.pieces.length === 2 && s2.makas.every(m => !m.open));
    check('makas.dogrulama', 'Başlangıçta makasın üstünde çok kareli parça duramaz', K.validate({ t: 9, map: ['rr.'], molds: ['x..'] }).some(e => e.includes('makas')));
  }

  // --- oyundaki bölümler (bölüm fabrikası) ---
  {
    const t0 = Date.now(), R = BOLUM.map(L => K.validate(L).length ? null : C.rapor(L)), kotu = [];
    R.forEach((r, i) => { if (!r || !r.cozuldu || !C.dogrula(BOLUM[i], r.yol)) kotu.push(i + 1); });
    metrics.bolumler = { sayi: BOLUM.length, ms: Date.now() - t0, hamle: R.map(r => r?.hamle), puan: R.map(r => r?.puan) };
    check('bolum.cozulur', `Oyundaki ${BOLUM.length} bölümün hepsi geçerli, çözücüden geçer ve çözümü doğrulanır`, BOLUM.length >= 60 && !kotu.length, kotu.length ? 'sorunlu: ' + kotu.join(', ') : `${Date.now() - t0} ms`);
    const kisa = R.map((r, i) => r && r.cozuldu && BOLUM[i].t < r.sureZor ? i + 1 : 0).filter(Boolean);
    check('bolum.sure', 'Her bölümün süresi en kısa çözüme yeter (en az 15 sn + kare adımı başına 1 sn)', !kisa.length, kisa.join(', '));
    const tek = R.map((r, i) => r && r.cozuldu && r.hamle < 2 ? i + 1 : 0).filter(Boolean);
    check('bolum.tekhamle', 'Tek hamlede biten bölüm yok', !tek.length, tek.join(', '));
    // mekanik takvimi: yeni mekanik kendi bandından önce görünmez
    const renkler = L => new Set((L.map.join('') + L.molds.join('').toLowerCase()).replace(/[^rybgop]/g, '')), has = (L, re) => re.test(L.map.join('') + L.molds.join(''));
    const erken = [];
    BOLUM.forEach((L, i) => {
      const n = i + 1, c = renkler(L), ana = ['r', 'y', 'b'].filter(x => c.has(x)).length;
      if (n <= 5 && has(L, /#/)) erken.push(n + ': duvar');
      if (n <= 12 && ana > 1) erken.push(n + ': iki ana renk');
      if (n <= 25 && c.has('r') && (c.has('y') || c.has('b'))) erken.push(n + ': kırmızı karışımı');
      if (n <= 40 && has(L, /x/)) erken.push(n + ': makas');
    });
    check('bolum.takvim', 'Mekanik takvimi: duvar 6, karışım 13, mor ve turuncu 26, makas 41. bölümden önce görünmez', !erken.length, erken.join(' · '));
    const makas = R.slice(40, 50).map((r, i) => r && r.kes ? 0 : 41 + i).filter(Boolean);
    check('bolum.makas', 'Makas bölümlerinin (41-50) en kısa çözümü kesim içerir', !makas.length, makas.join(', '));
    const ayni = new Set(BOLUM.map(L => L.map.join('/') + '|' + L.molds.join('/'))).size;
    check('bolum.farkli', 'Birbirinin aynısı bölüm yok', ayni === BOLUM.length, `${ayni}/${BOLUM.length}`);
    // zorluk ritmi: her 10'lukta 10. bölüm döngünün en zoru, 1. bölüm en zorlardan değil
    const dongu = []; for (let d = 0; d < 6; d++) { const p = R.slice(d * 10, d * 10 + 10).map(r => r.puan), enZor = Math.max(...p); if (p[9] < enZor) dongu.push(`${d * 10 + 10}. bölüm döngünün en zoru değil (${p[9]} < ${enZor})`); }
    check('bolum.ritim', 'Zorluk ritmi: her 10 bölümlük döngünün en zoru 10. bölümdür', !dongu.length, dongu.join(' · '), 'medium');
    // basamak sırası: döngü içinde rahat < orta < zor (mekaniği tanıtan elle bölümler bilerek kolaydır, sayılmaz)
    const ELLE = require('../uretici/elle.cjs'), SIRA = ['rahat', 'orta', 'zor', 'enzor'], ters = [];
    for (let d = 0; d < 6; d++) for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
      const x = d * 10 + a, y = d * 10 + b; if (ELLE[x + 1]?.tanitim || ELLE[y + 1]?.tanitim) continue;
      if (SIRA.indexOf(RITIM[a]) < SIRA.indexOf(RITIM[b]) && R[x].puan >= R[y].puan) ters.push(`${x + 1} (${RITIM[a]} ${R[x].puan}) ≥ ${y + 1} (${RITIM[b]} ${R[y].puan})`);
    }
    check('bolum.basamak', 'Zorluk ritmi: döngü içinde rahat bölümler ortadan, orta bölümler zordan kolaydır', !ters.length, ters.slice(0, 4).join(' · '), 'medium');
    const ustunde = BOLUM.map((L, i) => { const st = K.load(L), k = new Set(st.holes.flatMap(h => h.cells.map(c => c + ''))); return st.pieces.some(p => p.cells.some(c => k.has(c + ''))) ? i + 1 : 0; }).filter(Boolean);
    check('bolum.gorunur', 'Hiçbir bölümde parça kalıbın üstünde başlamaz (kalıbın şekli baştan görünür)', !ustunde.length, ustunde.join(', '));
    const kisaSure = BOLUM.map((L, i) => L.t < 30 ? i + 1 : 0).filter(Boolean);
    check('bolum.sure.alt', 'Hiçbir bölümün süresi 30 saniyeden kısa değil', !kisaSure.length, kisaSure.join(', '));
    const ipucu = BOLUM[1].hint.join(' ');
    check('bolum.ipucu', 'İpuçları oyunla çelişmez: "geri alınmaz" denmez (geri al düğmesi var)', !BOLUM.some(L => /geri alınmaz|cannot be undone/i.test(L.hint.join(' '))) && /geri al/i.test(ipucu), ipucu);
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
