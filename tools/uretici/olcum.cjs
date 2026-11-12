// Zorluk ölçümü (yüzde): her 50 bölümlük bant için çözücü puanı, tuzak sayısı ve süre sıkılığı.
//   zorluk %  = çözücü puanı / 40 (40: üreticinin en zor hedefinin üstü; 100 = insanın zor çözeceği)
//   tuzak     = çözüm yolunda yapılabilecek yanlış yapışma sayısı (ortalama)
//   süre %    = en kısa çözümün gerektirdiği süre / verilen süre (kare başına 1 sn + hamle başına 2 sn; 100 = hiç pay yok)
// Kullanım: node tools/uretici/olcum.cjs
'use strict';
const C = require('../../www/rules/cozucu.js'), B = require('../../www/bolumler.js');
const ort = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log('| Bölümler | Zorluk % | Tuzak | Hamle | Süre % | Verilen süre |\n|---|---|---|---|---|---|');
const hepsi = [];
for (let b = 0; b < B.length; b += 50) {
  const R = B.slice(b, b + 50).map(L => ({ L, R: C.rapor(L, { cap: 6000, kip: 1 }) })).filter(x => x.R.cozuldu);
  const z = ort(R.map(x => x.R.puan)) / 40 * 100, s = ort(R.map(x => (x.R.kare + 2 * x.R.hamle) / x.L.t)) * 100; hepsi.push(z);
  console.log(`| ${b + 1}–${b + 50} | ${z.toFixed(0)} | ${ort(R.map(x => x.R.yanlis)).toFixed(1)} | ${ort(R.map(x => x.R.hamle)).toFixed(1)} | ${s.toFixed(0)} | ${ort(R.map(x => x.L.t)).toFixed(0)} sn |`);
}
console.log(`\nGenel ortalama zorluk: %${ort(hepsi).toFixed(0)}`);

// --sure=70 : 51. bölümden itibaren süreyi sıkılaştırır: en kısa çözüm verilen sürenin en az %70'ini kullanır.
// Süre yalnız kısalır, 30 saniyenin ve çözücünün alt sınırının (sureZor) altına inmez. İlk 50 bölüme (öğretim) dokunulmaz.
const hedef = +(process.argv.find(a => a.startsWith('--sure=')) || '').slice(7);
if (hedef) {
  const fs = require('fs'), path = require('path'), DOSYA = path.join(__dirname, '..', '..', 'www', 'bolumler.js'); let src = fs.readFileSync(DOSYA, 'utf8'), n = 0, toplam = 0;
  for (let i = 50; i < B.length; i++) {
    const R = C.rapor(B[i], { cap: 6000, kip: 1 }); if (!R.cozuldu) continue;
    const t = Math.max(30, R.sureZor, Math.ceil((R.kare + 2 * R.hamle) / (hedef / 100)));
    if (t < B[i].t) { const a = `  // ${i + 1}\n  { t: ${B[i].t},`; if (!src.includes(a)) throw new Error('bulunamadı: ' + (i + 1)); src = src.replace(a, `  // ${i + 1}\n  { t: ${t},`); n++; toplam += B[i].t - t; }
  }
  fs.writeFileSync(DOSYA, src); console.log(`süre %${hedef}: ${n} bölüm kısaldı, ortalama ${(toplam / Math.max(1, n)).toFixed(1)} sn`);
}
