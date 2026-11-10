// Elle yazılan sabit bölümler: bölüm numarası → bölüm. Her mekaniğin ilk bölümü burada durur (tek başına, rahat) ve
// prototipin beş bölümü uygun yerlerine konur. Üretici bu numaraları atlar. Biçim: www/rules/cekirdek.js.
'use strict';
// tanitim: true → mekaniği tek başına tanıtan, bilerek kolay bölüm (ritim sırasına ve "yanlış karar olmalı" ölçütüne girmez).
const BOLUM = {
  // --- yapışma ve kalıp ---
  1: { tanitim: true, t: 30, hint: ['Aynı renkler yan yana kalınca yapışır. Şekli kur, kalıba oturt.', 'Same colors stick when they stay side by side. Build the shape, drop it in the mold.'],
    map: ['.....', 'r...r', '.....', '.....'],
    molds: ['.....', '.....', '.....', '.RR..'] },
  2: { t: 35, hint: ['Şekil kalıba uymalı. Yanlış yapışırsa bir kez geri alabilirsin.', 'The shape must fit the mold. If it sticks wrong, you can undo once.'],
    map: ['.....', 'r...r', '.....', '..r..'],
    molds: ['.RRR.', '.....', '.....', '.....'] },
  4: { t: 45, hint: ['Hazır parça doğrudan kalıbına gider.', 'A ready piece goes straight to its mold.'],
    map: ['y....', '.pp..', '....y', '.....', 'y....'],
    molds: ['...PP', '.....', '.Y...', '.YY..', '.....'] },
  // --- duvar ve dar aralık ---
  11: { tanitim: true, t: 40, hint: ['Dar aralıktan tek tek geçir, sonra birleştir.', 'Pass them through the gap one by one, then join them.'],
    map: ['r...r', '.....', '##.##', '.....', '.....'],
    molds: ['.....', '.....', '.....', '.....', '.RR..'] },
  15: { t: 60, hint: ['Yan yana yapışan parça dar aralıktan geçmez.', 'A piece stuck side by side cannot pass the narrow gap.'],
    map: ['r.r...', '......', 'r.r...', '###.##', '......', '......', '......'],
    molds: ['......', '......', '......', '......', '......', '.RR...', '.RR...'] },
  // --- yeşil ---
  21: { tanitim: true, t: 40, hint: ['Mavi sarının yanında kalırsa yeşil olur. Yeşil parça da ona yapışır.', 'Blue turns green when it stays next to yellow. The green piece sticks to it too.'],
    map: ['b...y', '.....', '..#..', '.....', '..g..'],
    molds: ['.....', '.GGG.', '.....', '.....', '.....'] },
  // --- mor ve turuncu ---
  36: { tanitim: true, t: 40, hint: ['Kırmızı ile mavi mor olur.', 'Red and blue make purple.'],
    map: ['r....', '.....', '....b', '.....'],
    molds: ['.....', '.....', '.....', '.PP..'] },
  37: { tanitim: true, t: 40, hint: ['Kırmızı ile sarı turuncu olur.', 'Red and yellow make orange.'],
    map: ['....y', '.....', 'r....', '.....'],
    molds: ['.O...', '.O...', '.....', '.....'] },
  39: { t: 55, hint: ['Kırmızı sarının yanında kalmasın: turuncunun kalıbı yok.', 'Do not leave red next to yellow: there is no orange mold.'],
    map: ['r.....', '......', '..y...', '......', '.....b', '......'],
    molds: ['......', '......', '......', '......', '.PP...', '.....Y'] },
  40: { t: 70, hint: ['Önce aynı renkleri birleştir, sonra karıştır.', 'Join the same colors first, then mix.'],
    map: ['y..r.b', '......', '##..##', '......', 'b....y', '......', '......'],
    molds: ['......', '......', '......', '......', '......', 'GG..P.', 'G...P.'] },
  // --- makas ---
  51: { tanitim: true, t: 40, hint: ['Parçayı makasa doğru it: üstüne giren kare kopar.', 'Push the piece into the scissors: the square that enters is cut off.'],
    map: ['.....', 'rr...', '.....', '.....'],
    molds: ['.....', '...x.', '.....', 'R...R'] },
  52: { t: 45, hint: ['Yanlış şekli kes, doğru yerden yeniden yapıştır. Makas bir kez keser.', 'Cut the wrong shape, then stick it back the right way. Scissors cut once.'],
    map: ['y....', 'yy...', '.....', '.....'],
    molds: ['..x..', '.....', '.....', '.YYY.'] },
  54: { tanitim: true, t: 50, hint: ['Renk geri ayrılmaz: yeşil kesilince iki yeşil olur.', 'Colors do not unmix: cut green and you get two greens.'],
    map: ['b...y', '.....', '.....', '.....'],
    molds: ['.....', '.....', '..x..', 'G...G'] },
};
// Üretilen bölümlere eklenen ipuçları (bölüm numarası → [Türkçe, English]): yeni bir kavramın ilk göründüğü ipuçsuz bölümler için.
BOLUM.ipucu = {
  3: ['Her renk kendi kalıbına gider.', 'Each color goes to its own mold.'],
};
module.exports = BOLUM;
