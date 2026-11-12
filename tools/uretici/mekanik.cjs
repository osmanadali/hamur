// 251–500. bölümlere yeni mekanikleri ekler: boya damlası, kilitli kalıp, kırılgan zemin (kurallar: www/rules/cekirdek.js başı).
// Sıfırdan üretmez: uretici.cjs'in yazdığı, çözülebilirliği ve zorluk ritmi belli bölümleri alır, mekaniği ekler ve
// çözücüyle doğrular (çözülmeli, çözüm çekirdekle adım adım oynatılabilmeli, belirsiz temas olmamalı). Tutmayan bölüm olduğu gibi kalır.
// Sıra: node tools/uretici.cjs --yaz  →  node tools/uretici/mekanik.cjs
//   251–300 boya damlası · 301–350 kilitli kalıp · 351–400 kırılgan zemin · 401–450 boya damlası · 451–500 kilit + kırılgan
'use strict';
const fs = require('fs'), path = require('path');
const K = require('../../www/rules/cekirdek.js'), C = require('../../www/rules/cozucu.js'), U = require('../uretici.cjs');
const DOSYA = path.join(__dirname, '..', '..', 'www', 'bolumler.js'), B = require(DOSYA);
const TAKVIM = [[251, 300, 'boya'], [301, 350, 'kilit'], [351, 400, 'kirik'], [401, 450, 'boya'], [451, 500, 'kilit+kirik']];
const IPUCU = { 251: ['Hamuru boya damlasının üstünde bırak: o renge boyanır.', 'Leave the dough on a paint drop: it takes that color.'],
  301: ['Kilitli kalıp, başka bir kalıp dolunca açılır.', 'A locked mold opens when another mold is filled.'],
  351: ['Çatlak zemin: üstünde durup ayrılınca çöker.', 'Cracked floor: it collapses after you rest on it and leave.'] };
const sec = (r, a) => a[Math.floor(r() * a.length)];
const karistir = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gecer = L => { if (K.validate(L).length) return null; const R = C.rapor(L, { cap: 6000, kip: 1 }); return R.gecerli && R.cozuldu && !R.kesildi && !R.belirsizTemas && C.dogrula(L, R.yol) ? R : null; };

// Boya: bir parçanın başlangıç rengi değişir; asıl rengi, o parçanın baştan ulaşabildiği boş bir kareye damla olarak konur.
function boya(r, L) {
  const st = K.load(L), ctx = C.hazirla(st);
  for (const i of karistir(r, st.pieces.map((_, i) => i)).slice(0, 4)) {
    const p = st.pieces[i]; if (p.donuk) continue;
    const H = C.hedefler(ctx, st, i).filter(h => h.tip === 'yer' && h.d >= 2);
    for (const h of karistir(r, H).slice(0, 3)) {
      const [x, y] = sec(r, p.cells).map((v, k) => v + (k ? h.dy : h.dx));
      if (L.map[y][x] !== '.' || L.molds[y][x] !== '.') continue;
      const map = L.map.map(s => [...s]), molds = L.molds.map(s => [...s]);
      molds[y][x] = p.color; const c2 = sec(r, [...'rybgop'].filter(c => c !== p.color)); for (const [cx, cy] of p.cells) map[cy][cx] = c2;
      const L2 = { ...L, map: map.map(s => s.join('')), molds: molds.map(s => s.join('')) };
      { const R2 = gecer(L2); if (R2) { L2.R = R2; return L2; } }
    }
  }
  return null;
}
// Kilit ve kırılgan zemin, bölümün kilitsiz çözümüne göre konur ki plan değişsin:
// kilit o çözümde ilk dolan kalıba; kırılgan zemin parçaların o çözümde durduğu karelere.
function kilitKirik(r, L, kilit, kirik) {
  const st = K.load(L), R = C.rapor(L, { cap: 6000, kip: 1 }); if (!R.cozuldu || !R.yol) return null;
  let s = st, ilk = null; const durak = [];
  for (const mv of R.yol) {
    const hedef = s.pieces[mv.i].cells.map(c => [c[0] + mv.dx, c[1] + mv.dy]), n = C.uygula(s, mv.i, mv.dx, mv.dy);
    if (!ilk) { const j = n.holes.findIndex((h, k) => h.filled && !s.holes[k].filled); if (j >= 0) ilk = n.holes[j].cells[0]; }
    if (mv.tip !== 'otur') durak.push(...hedef);
    s = n;
  }
  const gor = new Set(), uygun = durak.filter(c => { const k = c[0] + ',' + c[1]; if (gor.has(k) || L.molds[c[1]][c[0]] !== '.') return false; gor.add(k); return true; });
  for (let d = 0; d < 6; d++) {
    const L2 = { ...L };
    if (kilit) { if (!ilk || st.holes.length < 2) return null; L2.kilit = [[ilk[0], ilk[1]]]; }
    if (kirik) { const n = 1 + Math.floor(r() * 2); if (uygun.length < n) { if (!kilit) return null; const R2 = gecer(L2); if (R2) { L2.R = R2; return L2; } return null; } L2.kirik = karistir(r, uygun).slice(0, n); }
    { const R2 = gecer(L2); if (R2) { L2.R = R2; return L2; } }
    if (!kirik) return null;
  }
  return null;
}

const r = U.rastgele(20261112), say = {};
for (const [bas, son, tur] of TAKVIM) {
  let n = 0;
  for (let no = bas; no <= son; no++) {
    const L = { t: B[no - 1].t, hint: B[no - 1].hint, map: B[no - 1].map, molds: B[no - 1].molds };   // önceki koşunun eklediği alanlar atılır
    if ('rybgop'.split('').some(c => L.molds.some(s => s.includes(c)))) { console.error(no, 'zaten damlalı: önce uretici --yaz'); process.exit(2); }
    const L2 = tur === 'boya' ? boya(r, L) : kilitKirik(r, L, tur.includes('kilit'), tur.includes('kirik'));
    if (L2) { n++; L2.t = Math.max(L.t + 6, L2.R.sureZor + 2 * L2.R.hamle); delete L2.R;   // süre yeni çözüme göre: eskisinden kısa olmaz
      if (IPUCU[no]) L2.hint = IPUCU[no]; B[no - 1] = L2; } else B[no - 1] = L;
  }
  if (IPUCU[bas] && !(B[bas - 1].kilit || B[bas - 1].kirik || /[rybgop]/.test(B[bas - 1].molds.join('')))) {   // bandın ilk bölümü mekaniği tanıtmalı: tutan ilk bölümle yer değişir
    const j = B.findIndex((x, i) => i >= bas && i < son && (x.kilit || x.kirik || /[rybgop]/.test(x.molds.join(''))));
    if (j > 0) { const a = B[bas - 1], b = B[j]; B[bas - 1] = { ...b, hint: IPUCU[bas] }; B[j] = { ...a, hint: ['', ''] }; }
  }
  say[tur + ' ' + bas] = n; console.log(`${bas}-${son} ${tur}: ${n}/${son - bas + 1}`);
}
const satir = L => `  { t: ${L.t}, hint: ${JSON.stringify(L.hint)},\n    map: ${JSON.stringify(L.map)},\n    molds: ${JSON.stringify(L.molds)}${L.kilit ? `,\n    kilit: ${JSON.stringify(L.kilit)}` : ''}${L.kirik ? `,\n    kirik: ${JSON.stringify(L.kirik)}` : ''} },`;
const kaynak = fs.readFileSync(DOSYA, 'utf8'), bas = kaynak.slice(0, kaynak.indexOf('  // 1\n'));
fs.writeFileSync(DOSYA, bas + B.map((L, i) => `  // ${i + 1}\n` + satir(L)).join('\n') + '\n]);\n');
console.log('www/bolumler.js yazıldı:', B.length, 'bölüm');
