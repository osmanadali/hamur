---
name: hamur-bolum
description: Hamur bölümlerinin kabul ölçütleri, zorluk ritmi, mekanik takvimi ve bölüm üreticisinin kullanımı. Bölüm eklerken, üretirken, seçerken ya da zorluk puanına dokunurken önce bunu oku.
---

# Hamur: bölüm kabul ölçütleri, zorluk ritmi, mekanik takvimi

Kurallar ve bölüm dosyası biçimi için önce `hamur-kurallar` becerisine bak.

## Bölümler nereden gelir

- `tools/uretici.cjs` aday üretir, çözücü puanlar, seçim tablosunu yazar. Üretim tohumludur: aynı kod aynı bölümleri verir.
- `tools/uretici/elle.cjs` elle yazılan sabit bölümlerdir (bölüm numarası → bölüm). Her mekaniğin ilk bölümü ve ipuçlu bölümler buradadır.
- `www/bolumler.js` üretilir, elle düzenlenmez.

```bash
node tools/uretici.cjs
```

```bash
node tools/uretici.cjs --yaz
```

Son seçim elle yapılır: üretici aday verir, bölüme karakterini insan verir. Bir bölümü değiştirmek için ya `elle.cjs` içine o numarayla yazılır ya da üreticinin parametresi değiştirilir. Üretilen bir bölüme yalnız ipucu eklemek için `elle.cjs › ipucu` kullanılır. İpuçları oyundaki davranışla çelişmemelidir (ör. geri al düğmesi varken "geri alınmaz" denmez).

## Mekanik takvimi

Her yeni mekanik önce tek başına, rahat bir bölümde tanıtılır (elle yazılır, ipucu taşır), sonra eskilerle birleşir.

| Bölüm | Yeni gelen | Öğrettiği | Bölümde bulunmayan |
|---|---|---|---|
| 1-10 | Yapışma ve kalıp | Şekil kurma | Duvar, karışabilecek iki ana renk |
| 11-20 | Duvar ve dar aralık | Önce geçir, sonra birleştir | Karışabilecek iki ana renk |
| 21-35 | Yeşil | Renk karışımı | Kırmızının mavi ya da sarıyla aynı tahtada olması |
| 36-50 | Mor ve turuncu | Yanlış renge değmeme | Makas |
| 51-70 | Makas karesi | Kes, doğru yerden yapıştır; karıştır, kes, dağıt | |

İlk 20 bölümde ikinci renk gerekiyorsa hazır ara renk parçası kullanılır (sarı + mor, mavi + turuncu, kırmızı + yeşil): bunlar birbirine yapışmaz, karışım öğretilmeden tuzak doğmaz.

## Kabul ölçütleri

Bir aday şu durumlarda elenir (`tools/uretici.cjs` içindeki `puanla`):

- Çözücü çözemiyor ya da arama bütçeye takılıyor.
- Tek hamlede bitiyor ya da çözümünde hiç yapışma yok.
- Yanlış yapılabilecek hiçbir yapışma kararı yok.
- Parçalar zaten kalıbın dibinde (parça başına 2 kare adımından az).
- Çözümde bir parça aynı anda iki farklı ana renge değiyor (sonuç sıraya bağlı olur).
- Banda özgü şart tutmuyor:
  - Duvar: çözümde en az bir hamle aralıktan geçer; hiçbir parça aralığın içinde başlamaz; rahat dışındaki bölümlerde "aralıktan geçmeyen şekil" tuzağı vardır (yanlış karar duvarla çıkmaz, duvarsız çıkmaz değil: `etiket.duvar`).
  - Yeşil: çözümde karışım vardır.
  - Mor ve turuncu: çözümde karışım ve "kalıbı olmayan renk" tuzağı vardır.
  - Makas: en kısa çözüm kesim içerir ve bölüm makassız çözülemez.
- Ayna ya da renk değişimi altında başka bir adayın kopyası.
- Aynı iskelet (kalıp şekilleri dönme ve ayna altında aynı, parça boyları aynı) art arda gelemez; bant içinde tekrarı cezalanır.
- Bir parça kalıbın üstünde başlıyor (kalıbın şekli baştan görünmeli; `validate` da reddeder).

Bozulmayan kurallar (yol haritası): her bölümde en az bir yapışma kararı olur, her bölüm güçlendirici kullanmadan çözülür ve çözücü bunu kanıtlar.

## Zorluk puanı

`cozucu.js › rapor` hesaplar; taslak formüldür, katsayılar kapalı testte ayarlanır.

`puan = 2 × hamle + 3 × log2(1 + yanlış) + 4 × darlık`

- `hamle`: en kısa çözümün taşıma sayısı.
- `yanlış`: çözüm boyunca yapılabilecek, kanıtlı çıkmaza götüren farklı yapışma kararı. Karar sayılır, yerleşim değil: aynı hatalı sonuç (renk + şekil) tahtanın neresinde yapılırsa yapılsın bir kez sayılır.
- `darlık`: yanlış kararların bütün yapışma kararlarına oranı.
- Yanlışların nedeni etiketlenir: `renk` (oluşan rengin kalıbı yok), `sekil` (hiçbir kalıba sığmıyor), `yol` (sığıyor ama kalıba ulaşamıyor).
- Süre puana girmez; ayrı ayarlanır.

## Zorluk ritmi

10 bölümlük döngü: 1-2 rahat, 3 orta, 4 rahat, 5 zor, 6-7 rahat, 8 orta, 9 rahat, 10 döngünün en zoru.

Her bandın her basamak için mutlak hedef puanı vardır (`uretici.cjs › HEDEF`). Bantlar üst üste biner: yeni mekanik gelince zorluk bir basamak iner, sonra önceki bandın üstüne çıkar. Döngü içinde sıra korunur: rahat < orta < zor < döngünün en zoru (10. bölüm); robot bunu denetler. Mekaniği tek başına tanıtan elle bölümler (`tanitim: true`) bilerek kolaydır ve bu sıraya girmez.

## Süre

Yol haritasının başlangıç formülü: 15 sn okuma payı + en kısa çözümün her kare adımı için 1,3 sn (zor ve en zor bölümlerde 1,0 sn). Buna hamle başına 2 sn eklenir ve süre 30 sn'den kısa olmaz; yoksa en zor bölümler en kısa süreyi alıyordu. Elle yazılan bölümlerde yazılı süre kalır. Aynı bölümde üç kez kaybeden oyuncuya 10 sn eklenir (henüz kodlanmadı). Hepsi kapalı testte ayarlanır.

## Yeni bölüm eklerken

1. Bölümü editörde çiz ya da üreticiden al: `npm run editor`.
2. Çözücüden geçir, puanına ve etiketlerine bak.
3. Takvime uyduğunu denetle: bandından önce gelen mekanik yok.
4. Robotu çalıştır: `node tools/hakem.cjs --strict`. `bolum.*` kontrolleri 60 bölümün hepsini çözer, takvimi, ritmi ve kopyaları denetler.
