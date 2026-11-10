// Hamur — çözücü komut satırı. Bölümleri çözer, tabloyu yazar; çözülemeyen ya da geçersiz bölüm varsa çıkış kodu 1.
// Kullanım: node tools/cozucu.cjs            → www/bolumler.js'teki bütün bölümler
//           node tools/cozucu.cjs dosya.json → tek bölüm dosyası (editörün dışa aktardığı biçim)
//           node tools/cozucu.cjs -v         → çözüm hamlelerini de yazar
'use strict';
const fs = require('fs'), path = require('path');
const C = require('../www/rules/cozucu.js');
const args = process.argv.slice(2), v = args.includes('-v'), f = args.find(a => !a.startsWith('-'));
const B = f ? [JSON.parse(fs.readFileSync(f, 'utf8'))] : require('../www/bolumler.js');
const AD = { r: 'kırmızı', y: 'sarı', b: 'mavi', g: 'yeşil', o: 'turuncu', p: 'mor' }, TIP = { otur: 'kalıba oturur', yapis: 'yapışır', yer: 'yer değiştirir', kes: 'makasa itilir, kesilir' };
let kotu = 0;
// yol: en kısa durum yolu sayısı (hamle kümesine bağlı; "farklı çözüm" değildir, puana girmez)
console.log('bölüm  çözüm  hamle  kare  yol  yapışma  yanlış  darlık  puan  süre(öneri)  süre(şimdi)  düğüm  ms');
B.forEach((L, n) => {
  const r = C.rapor(L), ad = String(f ? path.basename(f) : n + 1).padEnd(5);
  if (!r.gecerli) { kotu++; return console.log(`${ad}  GEÇERSİZ: ${r.hata.join('; ')}`); }
  if (!r.cozuldu) { kotu++; return console.log(`${ad}  ${r.cikmaz ? 'ÇIKMAZ (kanıtlı)' : 'ÇÖZÜLEMEDİ (arama sınırında)'}  düğüm ${r.dugum}  ${r.ms.toFixed(0)} ms`); }
  if (!C.dogrula(L, r.yol)) { kotu++; return console.log(`${ad}  ÇÖZÜM DOĞRULANAMADI`); }
  const c = (x, w) => String(x).padStart(w);
  console.log(`${ad}  ${r.mod.padEnd(6)} ${c(r.hamle, 5)} ${c(r.kare, 5)} ${c(r.yolSayisi, 4)} ${c(r.yapisma, 8)} ${c(r.yanlis, 7)} ${c(r.darlik, 7)} ${c(r.puan, 5)} ${c(r.sure, 12)} ${c(L.t, 12)} ${c(r.dugum, 6)} ${c(r.ms.toFixed(0), 3)}`);
  if (v) r.yol.forEach((m, k) => console.log(`       ${k + 1}. ${AD[m.renk]} (${m.kareler.map(c => c.join(',')).join(' ')}) → ${m.dx >= 0 ? '+' : ''}${m.dx},${m.dy >= 0 ? '+' : ''}${m.dy} · ${m.d} kare · ${TIP[m.tip]}`));
});
process.exit(kotu ? 1 : 0);
