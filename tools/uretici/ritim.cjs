// 251–500. bölümlerin zorluğunu ölçer ve 10'luk ritme göre yeniden sıralar (mekanik.cjs'ten sonra koşulur; tekrar koşmak sonucu değiştirmez).
// Mekanik eklenince bölümün puanı değişir; sıra eski puana göre kalmıştı. Her 10'lukta bölümler çözücü puanına göre dizilir:
//   1-2 rahat, 3 orta, 4 rahat, 5 zor, 6-7 rahat, 8 orta, 9 rahat, 10 en zor   (uretici.cjs › RITIM)
// Önce bant (50 bölüm) kolaydan zora beş 10'luğa ayrılır; sonra her 10'luk ritme dizilir.
// Bandın ilk bölümü (251, 301, 351) mekaniği tanıtır: o 10'luğun mekanikli en kolay bölümü oraya gelir, ipucu numarada kalır.
// Sıra: node tools/uretici.cjs --yaz → node tools/uretici/mekanik.cjs → node tools/uretici/ritim.cjs
'use strict';
const fs = require('fs'), path = require('path');
const C = require('../../www/rules/cozucu.js'), U = require('../uretici.cjs');
const DOSYA = path.join(__dirname, '..', '..', 'www', 'bolumler.js'), B = require(DOSYA);
const BAS = 251, SON = 500, TANIT = [251, 301, 351];
const mekanikli = L => !!(L.kilit || L.kirik || /[rybgop]/.test(L.molds.join('')));
const t0 = Date.now(), P = new Map();
for (let no = BAS; no <= SON; no++) { const R = C.rapor(B[no - 1], { cap: 6000, kip: 1 }); if (!R.cozuldu) { console.error(no, 'çözülemedi'); process.exit(2); } P.set(B[no - 1], R); }
const sira = { rahat: 0, orta: 1, zor: 2, enzor: 3 }, yerler = U.RITIM.map((r, i) => [i, sira[r]]).sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(x => x[0]);   // kolaydan zora konumlar
const ozet = (bas) => { const p = []; for (let i = 0; i < 50; i++) p.push(P.get(B[bas - 1 + i]).puan); const ort = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  const sl = r => ort(p.filter((_, i) => U.RITIM[i % 10] === r)); return `rahat ${sl('rahat')} · orta ${sl('orta')} · zor ${sl('zor')} · en zor ${sl('enzor')} (en az ${Math.min(...p)}, en çok ${Math.max(...p)})`; };
const once = {}; for (let b = BAS; b <= SON; b += 50) once[b] = ozet(b);
let degisen = 0;
const anahtar = L => P.get(L).puan.toFixed(2).padStart(6, '0') + JSON.stringify([L.map, L.molds, L.kilit || 0, L.kirik || 0]);   // eşit puanda sıra içeriğe bağlı: tekrar koşunca değişmez
for (let bb = BAS; bb <= SON; bb += 50) {
  // bant kolaydan zora beş dilime ayrılır (yeni mekanik yumuşak başlar, bant sonuna doğru zorlaşır); her dilim kendi 10'luk ritmine dizilir
  const eskiBant = B.slice(bb - 1, bb + 49), ipucu = eskiBant.map(L => L.hint), sirali = eskiBant.slice().sort((x, y) => anahtar(x) < anahtar(y) ? -1 : 1);
  if (TANIT.includes(bb)) { const t = sirali.slice(0, 10).find(mekanikli) || sirali.find(mekanikli); if (t) { sirali.splice(sirali.indexOf(t), 1); sirali.unshift(t); } }   // tanıtım bölümü ilk dilimde
  for (let d = 0; d < 5; d++) {
    let dizi = sirali.slice(d * 10, d * 10 + 10); const yeni = new Array(10);
    if (d === 0 && TANIT.includes(bb)) yeni[0] = dizi.shift();
    dizi.sort((x, y) => anahtar(x) < anahtar(y) ? -1 : 1);
    for (const k of yerler) if (!yeni[k]) yeni[k] = dizi.shift();
    yeni.forEach((L, i) => { const j = d * 10 + i; if (L !== eskiBant[j]) degisen++; B[bb - 1 + j] = { ...L, hint: ipucu[j] }; P.set(B[bb - 1 + j], P.get(L)); });
  }
}
const dilim = bb => { const o = []; for (let d = 0; d < 5; d++) { let t = 0; for (let i = 0; i < 10; i++) t += P.get(B[bb - 1 + d * 10 + i]).puan; o.push((t / 10).toFixed(1)); } return o.join(' → '); };
for (let b = BAS; b <= SON; b += 50) console.log(`${b}-${b + 49}\n  önce : ${once[b]}\n  sonra: ${ozet(b)}\n  10'luk ortalamaları: ${dilim(b)}`);
const satir = L => `  { t: ${L.t}, hint: ${JSON.stringify(L.hint)},\n    map: ${JSON.stringify(L.map)},\n    molds: ${JSON.stringify(L.molds)}${L.kilit ? `,\n    kilit: ${JSON.stringify(L.kilit)}` : ''}${L.kirik ? `,\n    kirik: ${JSON.stringify(L.kirik)}` : ''} },`;
const kaynak = fs.readFileSync(DOSYA, 'utf8'), bas = kaynak.slice(0, kaynak.indexOf('  // 1\n'));
fs.writeFileSync(DOSYA, bas + B.map((L, i) => `  // ${i + 1}\n` + satir(L)).join('\n') + '\n]);\n');
console.log(`yer değiştiren ${degisen} bölüm · ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
if (process.argv.includes('--tablo')) { const p = []; for (let no = 1; no <= B.length; no++) p.push((no >= BAS ? P.get(B[no - 1]) : C.rapor(B[no - 1], { cap: 6000, kip: 1 })).puan); for (let b = 1; b <= B.length; b += 50) { const a = p.slice(b - 1, b + 49); console.log(`| ${b}–${b + 49} | ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} | ${Math.min(...a)} | ${Math.max(...a)} |`); } }
