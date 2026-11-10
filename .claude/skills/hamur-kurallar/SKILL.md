---
name: hamur-kurallar
description: Hamur oyununun kural seti, bölüm dosyası biçimi ve terimleri. Kural çekirdeğine, çözücüye, bölümlere, niyet okumaya ya da bölüm editörüne dokunan her işte önce bunu oku.
---

# Hamur: kurallar, bölüm biçimi, terimler

Plan `docs/Hamur-Yol-Haritasi.pdf` içinde. Bu beceri oradaki kuralların koddaki karşılığını anlatır.

## Kurallar tek yerde durur

- `www/rules/cekirdek.js` kural çekirdeğidir. Oyun, çözücü, editör ve robot aynı dosyayı kullanır. Kural başka hiçbir dosyada yeniden yazılmaz.
- `www/rules/cozucu.js` çözücüdür: `cikmaz` (kanıt) ve `coz` / `rapor` (arama).
- `www/game.js` yalnız girdi, çizim ve sestir. Kural değişikliği buraya yapılmaz.

## Kesin kurallar

1. Parça parmakla sürüklenir, kare kare ilerler, duvardan ve başka parçadan geçemez.
2. Aynı renkteki iki parça kenar kenara gelip orada kalınca kalıcı olarak yapışır. Yanından geçip giden parça yapışmaz.
3. İki farklı ana renk kenar kenara kalınca yapışır ve ara renge döner: mavi + sarı = yeşil, kırmızı + mavi = mor, kırmızı + sarı = turuncu. Ara renkler başka renkle karışmaz, yalnız kendi rengiyle yapışır.
4. Rengi ve şekli kalıpla birebir aynı olan parça kalıbın üstüne gelince oturur ve tahtadan çıkar. Parçalar dönmez.
5. Tahta boşalınca bölüm biter. Süre ilk dokunuşta başlar.
6. Süre biterse ya da bir parça hiçbir kalıba giremez hale gelirse bölüm kaybedilir.

"Orada kalmak" kararını çekirdek vermez. `move` yalnız taşır. Yapışmayı çağıran taraf belirler:

- Oyun parmağı okur (niyet okuma) ve `fuse` ya da `settle` çağırır.
- Çözücü için kural şudur: yanından geçmek serbesttir, hedef karede durmak yapışmadır (`settle`).

## Niyet okuma

Yapışma tek bir an değil, dolan bir ölçüdür: iki parça arasında hamur ipliği kalınlaşır, dolunca yapışırlar. Ayarlar `www/game.js` başındaki `CFG` içindedir ve his testinde değiştirilir.

| Parmak | Sonuç |
|---|---|
| Öteki parçaya doğru itiyor | İplik yaklaşık 0,15 sn'de dolar |
| Yanında duruyor, yönü belli değil | Yaklaşık 0,5 sn'de dolar |
| Yanından geçip gidiyor | Dolmaz |
| Ters yöne çekiyor | İplik incelir ve kopar |
| Parmağını yanında kaldırıyor | Yapışır |

Üç şart bozulmaz: karar her zaman görünür, yapışmadan yan yana bekleyen parça olmaz, çözücü aynı kuralla çalışır.

## Bölüm dosyası

```json
{ "t": 40, "hint": ["Türkçe ipucu", "English hint"],
  "map":   ["b...y", ".....", "..#..", ".....", "..g.."],
  "molds": [".....", ".GGG.", ".....", ".....", "....."] }
```

- `map`: `.` boş, `#` duvar, `r y b g o p` parça karesi. Bitişik aynı harfler tek parçadır.
- `molds`: `.` boş, `R Y B G O P` kalıp karesi. Bitişik aynı harfler tek kalıptır.
- `t`: süre, saniye.
- `K.validate(L)` hata listesi döner. Geçerli bölümde parça kareleri kalıp karelerine eşittir ve başlangıçta yapışabilecek iki parça kenar kenara durmaz.
- Bölümler şimdilik `www/bolumler.js` içindedir.

## Çözücü

- `cikmaz(st)`: gevşetilmiş modelde arar (parçalar birbirini engellemez, yalnız duvarlar engeldir). `true` kesin çıkmazdır ve asla yanlış alarm vermez. Oyun her yapışmadan sonra bunu çağırır.
- `coz(st)`: gerçek kurallarla, taşıma hamlesiyle arar. Hamle üç türdür: yapışma, kalıba oturma, yer değiştirme. Yer değiştirme hedefleri kip kip genişler: kalıp içi park, kenara çekilme, hepsi. "Çözülemedi" kesin değildir; kesinlik için `cikmaz`a bakılır.
- `rapor(L)`: hamle, kare adımı, farklı en kısa çözüm sayısı, yanlış yapışma fırsatı, darlık, taslak zorluk puanı, önerilen süre.

Her yeni bölüm oyuna girmeden önce çözücüden geçer:

```bash
node tools/cozucu.cjs -v
```

## Terimler

| Terim | Anlamı |
|---|---|
| Parça | Tahtadaki hamur. Bir ya da daha çok bitişik kare, tek renk |
| Kalıp | Parçanın oturacağı boşluk (`molds`) |
| Yapışma | İki parçanın kalıcı olarak tek parça olması (`fuse`) |
| Karışım | İki ana rengin yapışıp ara renge dönmesi |
| Kalıba oturma | Parçanın kalıbına girip tahtadan çıkması (`sink`) |
| Çıkmaz | Artık kazanılamayan durum |
| Yer değiştirme | Hiçbir şeye yapışmadan başka kareye gitme (çözücü hamlesi) |
| İplik | İki parça arasında dolan yapışma ölçüsü |
| Hamle | Bir parçayı bir kareden ötekine taşımak (çözücünün birimi) |
| Kare adımı | Hamlenin geçtiği kare sayısı (süre formülünün birimi) |

## Değişiklikten sonra

```bash
node tools/hakem.cjs --strict
```

Robot tam geçmeden iş bitmiş sayılmaz. Yeni kural için `tools/hakem/kurallar.cjs`, parmak davranışı için `tools/hakem/oyun.cjs` içine test eklenir.
