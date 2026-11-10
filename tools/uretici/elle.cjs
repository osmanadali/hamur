// Elle yazılan sabit bölümler: bölüm numarası → bölüm. Her mekaniğin ilk bölümü burada durur (tek başına, rahat) ve
// prototipin beş bölümü uygun yerlerine konur. Üretici bu numaraları atlar. Biçim: www/rules/cekirdek.js.
'use strict';
module.exports = {
  // --- yapışma ve kalıp ---
  1: { t: 30, hint: ['Aynı renkler yan yana kalınca yapışır. Şekli kur, kalıba oturt.', 'Same colors stick when they stay side by side. Build the shape, drop it in the mold.'],
    map: ['.....', 'r...r', '.....', '.....'],
    molds: ['.....', '.....', '.....', '.RR..'] },
  2: { t: 30, hint: ['Yapışma geri alınmaz. Şekil kalıba uymazsa bölüm biter.', 'Sticking cannot be undone. If the shape does not fit the mold, the level ends.'],
    map: ['r..r', '....', '....', 'r...'],
    molds: ['....', '.RR.', '.R..', '....'] },
  5: { t: 45, hint: ['Her renk kendi kalıbına. Hazır parça da kalıbına gider.', 'Each color goes to its own mold. A ready piece goes to its mold too.'],
    map: ['y....', '.....', '....y', '.pp..', 'y....'],
    molds: ['...PP', '.....', '.Y...', '.YY..', '.....'] },
  // --- duvar ve dar aralık ---
  11: { t: 40, hint: ['Dar aralıktan tek tek geçir, sonra birleştir.', 'Pass them through the gap one by one, then join them.'],
    map: ['r...r', '.....', '##.##', '.....', '.....'],
    molds: ['.....', '.....', '.....', '.....', '.RR..'] },
  15: { t: 60, hint: ['Yan yana yapışan parça dar aralıktan geçmez.', 'A piece stuck side by side cannot pass the narrow gap.'],
    map: ['r.r...', '......', 'r.r...', '###.##', '......', '......', '......'],
    molds: ['......', '......', '......', '......', '......', '.RR...', '.RR...'] },
  // --- yeşil ---
  21: { t: 40, hint: ['Mavi sarının yanında kalırsa yeşil olur. Yeşil parça da ona yapışır.', 'Blue turns green when it stays next to yellow. The green piece sticks to it too.'],
    map: ['b...y', '.....', '..#..', '.....', '..g..'],
    molds: ['.....', '.GGG.', '.....', '.....', '.....'] },
  // --- mor ve turuncu ---
  36: { t: 40, hint: ['Kırmızı ile mavi mor olur.', 'Red and blue make purple.'],
    map: ['r....', '.....', '....b', '.....'],
    molds: ['.....', '.....', '.....', '.PP..'] },
  37: { t: 40, hint: ['Kırmızı ile sarı turuncu olur.', 'Red and yellow make orange.'],
    map: ['....y', '.....', 'r....', '.....'],
    molds: ['.O...', '.O...', '.....', '.....'] },
  38: { t: 55, hint: ['Kırmızı sarının yanında kalmasın: turuncunun kalıbı yok.', 'Do not leave red next to yellow: there is no orange mold.'],
    map: ['r.....', '......', '..y...', '......', '.....b', '......'],
    molds: ['......', '......', '......', '......', '.PP...', '.....Y'] },
  40: { t: 70, hint: ['Önce aynı renkleri birleştir, sonra karıştır.', 'Join the same colors first, then mix.'],
    map: ['y..r.b', '......', '##..##', '......', 'b....y', '......', '......'],
    molds: ['......', '......', '......', '......', '......', 'GG..P.', 'G...P.'] },
  // --- makas ---
  51: { t: 40, hint: ['Parçayı makasa doğru it: üstüne giren kare kopar.', 'Push the piece into the scissors: the square that enters is cut off.'],
    map: ['.....', 'rr...', '.....', '.....'],
    molds: ['.....', '...x.', '.....', 'R...R'] },
  52: { t: 45, hint: ['Yanlış şekli kes, doğru yerden yeniden yapıştır. Makas bir kez keser.', 'Cut the wrong shape, then stick it back the right way. Scissors cut once.'],
    map: ['y....', 'yy...', '.....', '.....'],
    molds: ['..x..', '.....', '.....', '.YYY.'] },
  53: { t: 50, hint: ['Renk geri ayrılmaz: yeşil kesilince iki yeşil olur.', 'Colors do not unmix: cut green and you get two greens.'],
    map: ['b...y', '.....', '.....', '.....'],
    molds: ['.....', '.....', '..x..', 'G...G'] },
};
