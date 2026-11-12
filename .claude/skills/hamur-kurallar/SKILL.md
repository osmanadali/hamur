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

## Makas karesi (51. bölümden itibaren)

Öneridir; his testinde onaylanacak.

- Makas tahtada bir zemin karesidir (`molds` katmanında `x`) ve tek kullanımlıktır: bir kez keser.
- Tek karelik parça makasın üstünden geçer ve üstünde durabilir; makas harcanmaz.
- Çok kareli parça açık makasa kendiliğinden giremez, duvar gibi durur. Oyuncu parçayı makasa doğru iterse (yaklaşık 0,25 sn dolan ölçü) parça o kareye girer ve makasın üstündeki kare kopar. Kararsız parmak kesmez.
- Kopan kare aynı renkte tek karelik parça olur; geri kalan bağlı bileşenlerine ayrılır. Renk geri ayrışmaz: makas şekil hatasını telafi eder, renk hatasını değil.
- Makasın kenarından dikiş geçmez: kesilen kare makasın üstündeyken komşusuyla yapışmaz. Kare ayrılınca makas kapanır, sıradan zemin olur.
- Kesim sürüklemeyi bitirir: bütün parçalar oldukları yerde kalmış sayılır. Kesim geri alınabilir.
- Çekirdekte `canCut`, `cut`; çözücüde `kes` hamlesi.

## Aynı anda iki komşu

Parça olduğu yerde kalınca (`settle`) önce aynı renkli komşularıyla yapışır, sonra karışır. Aynı anda iki farklı ana renge değiyorsa oyun ipliği en dolu olanı seçer; üretici, çözümünde böyle bir temas olan bölümü eler.

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
- `molds`: `.` boş, `R Y B G O P` kalıp karesi, `x` makas karesi. Bitişik aynı harfler tek kalıptır.
- `t`: süre, saniye.
- `K.validate(L)` hata listesi döner. Geçerli bölümde parça kareleri kalıp karelerine eşittir ve başlangıçta yapışabilecek iki parça kenar kenara durmaz.
- Bölümler `www/bolumler.js` içindedir; dosya üretilir (bkz. `hamur-bolum` becerisi).

## Çözücü

- `cikmaz(st)`: gevşetilmiş modelde arar (parçalar birbirini engellemez, yalnız duvarlar engeldir). `true` kesin çıkmazdır ve asla yanlış alarm vermez. Oyun her yapışmadan sonra bunu çağırır.
- `coz(st)`: gerçek kurallarla, taşıma hamlesiyle arar. Hamle dört türdür: yapışma, kalıba oturma, kesme, yer değiştirme. Yer değiştirme hedefleri kip kip genişler: kalıp içi park, kenara çekilme, hepsi. "Çözülemedi" kesin değildir; kesinlik için `cikmaz`a bakılır.
- `rapor(L)`: hamle, kare adımı, yanlış yapışma kararı ve nedenleri, darlık, karışım ve kesim sayısı, taslak zorluk puanı, önerilen süre.
- `dogrula(L, yol)`: çözümü aramanın kodunu kullanmadan, yalnız çekirdekle tek tek kare adımıyla oynatır.

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

Robot tam geçmeden iş bitmiş sayılmaz. Yeni kural için `tools/hakem/kurallar.cjs`, parmak davranışı için `tools/hakem/oyun.cjs` içine test eklenir. Çekirdeğe ya da çözücüye dokunan her değişiklikte `tools/hakem/rastgele.cjs` çıkmaz kanıtını ve çözümleri bağımsız bir modelle karşılaştırır.

## Sonradan eklenen mekanikler (251. bölümden itibaren)

Kesin metin `www/rules/cekirdek.js` başındadır; özet:

- **Boya damlası** (`molds` içinde küçük harf `r y b g o p`): tek kullanımlık zemin karesi. Üstünden geçen parça boyanmaz; üstünde **kalan** parça (bırakılınca ya da orada yapışacakken) bütünüyle damlanın rengine döner. Sıra: boyan → kalıba otur → yapış. Açık damla varken `doomed` ve `cikmaz` bir şey söylemez; çözücü aramada sezgisel `olu` kullanır (kanıt değildir, oyunda kullanılmaz).
- **Kilitli kalıp** (bölümde `kilit: [[x, y]…]`): kilitli kalıba parça oturmaz. Başka bir kalıp dolunca bütün kilitler açılır; tam üstünde bekleyen uygun parça hemen oturur (`sink` olayında `acilan`, `zincir`).
- **Kırılgan zemin** (bölümde `kirik: [[x, y]…]`): geçmek serbest. Üstünde kalıp sonra ayrılınca çöker ve duvar gibi kapanır (`bas`, `ayril`, `cokuk`). Başta üstünde duran parça kalmış sayılır.

Oyun tarafı: `birak()` her bırakmada `K.boyan` ve `K.bas` çağırır; çizimler `drawBoya`, `drawKirik`, `drawKilit`.
