// Hamur — bölümler. Biçim: www/rules/cekirdek.js başındaki açıklama. Şimdilik prototipin beş bölümü; bölüm fabrikası (2. aşama) burayı doldurur.
// hint: [Türkçe, English]. t: süre (sn); prototipte elle verildi, çözücünün önerdiği süreyle kapalı testte ayarlanır.
(function (root, B) { if (typeof module === 'object' && module.exports) module.exports = B; else root.HAMUR_BOLUMLER = B; })(typeof self !== 'undefined' ? self : this, [
  { t: 30, hint: ['Aynı renkler yan yana kalınca yapışır. Şekli kur, kalıba oturt.', 'Same colors stick when they stay side by side. Build the shape, drop it in the mold.'],
    map: ['.....', 'r...r', '.....', '.....'],
    molds: ['.....', '.....', '.....', '.RR..'] },
  { t: 45, hint: ['Yapışma geri alınmaz. Şekil kalıba uymazsa bölüm biter.', 'Sticking cannot be undone. If the shape does not fit the mold, the level ends.'],
    map: ['y....', '.....', '....y', '.pp..', 'y....'],
    molds: ['...PP', '.....', '.Y...', '.YY..', '.....'] },
  { t: 40, hint: ['Mavi sarının yanında kalırsa yeşil olur. Yeşil parça da ona yapışır.', 'Blue turns green when it stays next to yellow. The green piece sticks to it too.'],
    map: ['b...y', '.....', '..#..', '.....', '..g..'],
    molds: ['.....', '.GGG.', '.....', '.....', '.....'] },
  { t: 60, hint: ['Kırmızı sarının yanında kalmasın, turuncunun kalıbı yok. Yan yana yapışan parça dar aralıktan geçmez.', 'Do not leave red next to yellow: there is no orange mold. A piece stuck side by side cannot pass the narrow gap.'],
    map: ['r.r...', '......', 'r.r...', '###.##', '...y..', '......', '......'],
    molds: ['......', '......', '......', '......', '......', '.RR...', '.RR..Y'] },
  { t: 70, hint: ['Önce aynı renkleri birleştir, sonra karıştır. Yanlış renkle yapışan parça gider.', 'Join the same colors first, then mix. A piece stuck to the wrong color is lost.'],
    map: ['y..r.b', '......', '##..##', '......', 'b....y', '......', '......'],
    molds: ['......', '......', '......', '......', '......', 'GG..P.', 'G...P.'] },
]);
