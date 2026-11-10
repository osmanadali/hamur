---
name: hamur-arayuz
description: Hamur'un arayüz kalıpları (düğme, pencere, başlık, üst çubuk, güçlendirici çubuğu, mağaza kartı). Ekran, düğme, pencere ya da başlık tasarlarken, CSS'e ya da ekran yerleşimine dokunurken önce bunu oku.
---

# Hamur arayüz kalıpları

Kaynak: Osman'ın gönderdiği, beğendiği bir blok bulmaca oyununun sekiz ekran görüntüsü (mağaza, can pencereleri, kayıp,
duraklat, oyun, bölüm başlangıcı). Görseller depoda yok ve olmamalı: başkasının oyununa ait. Buradan alınan şey **yapı ve
ölçüdür**; çizim, renk paleti, simgeler ve karakterler Hamur'un kendi kil/hamur dünyasından gelir. O oyunun görselini,
simgesini ya da adını kopyalama.

## 1. Düğme
- Tombul, kalın, iki katmanlı: dışta koyu çerçeve (aynı rengin koyusu), içte daha açık iç yüzey, üst kenarda açık vurgu, altta
  belirgin kalınlık. Düğme "basılabilir" görünür.
- Yazı düğmenin yüksekliğinin yaklaşık %40-45'i. Beyaz ya da krem dolgu, koyu kontur, altta 2-3 px gölge. Yazı asla küçük kalmaz.
- Renk anlam taşır, ekranda iki düğme aynı renkte olmaz:
  - **yeşil** = ana olumlu eylem (Oyna, Devam et, Tekrar dene, fiyat)
  - **turuncu / sarı** = ikincil ya da ödüllü eylem (reklam izle, bedava)
  - **kırmızı** = çıkış, vazgeç, kapat
  - **mor / mavi** = yansız gezinme
- Simgeli düğme: simge solda, yazı sağda, ikisi aynı satırda (ör. klaket + "+15 sn").
- Basılı: aşağı kayar, alt kalınlık kısalır, biraz koyulaşır. Pasif: gri ve soluk.
- Hamur'da: düğme hamur hap görselidir (9 dilim), yazı koddan gelir (altı dil).

## 2. Pencere (modal)
- Arka plan belirgin kararır (yaklaşık %75) ve hafif bulanır; oyun arkada seçilir ama dikkat çekmez.
- Gövde tek renk, kalın, çok yuvarlak köşeli; içinde bir ton koyu iç paneller (içerik kutuları).
- **Başlık pencerenin üst kenarına biner**: yarısı dışarıda, kendi koyu kontur "etiketi" içinde, çok büyük ve tombul.
- **Kapat düğmesi** sağ üst köşede, köşeye binen yuvarlak kırmızı, beyaz çarpı.
- İçerik sırası hep aynı: görsel ya da durum → tek cümle açıklama → ana düğme → (varsa) ikincil düğme.
- Bir pencerede en çok iki büyük düğme; alt alta, ana eylem üstte.
- Açılış: küçükten taşarak büyür ve oturur. Kapanış: ezilip küçülür.

## 3. Başlık ve yazı
- Tek tombul yazı ailesi her yerde. Başlık: beyaz/krem dolgu, kalın koyu kontur, altta kalınlık. İnce ya da gri yazı yok.
- Gövde metni de kalın ve yüksek kontrastlı; koyu zeminde beyaz, açık zeminde koyu mor.
- Sayılar (süre, adet, fiyat) başlık yazısıyla, konturlu.

## 4. Oyun ekranı
- **Üst çubuk** iki satır: üstte sayaç(lar) ve bölüm etiketi koyu hap içinde; altta solda yeniden başlat, ortada süre, sağda
  duraklat. Süre büyük, tek bakışta okunur, kendi koyu hapında.
- **Tahta** ekranın ortasında ve en büyük öğe; arka plan sakin ve koyu, tahta ondan ayrışır.
- **Güçlendirici çubuğu** en altta: üç kare, tombul düğme; her birinin üstünde büyük simge, altında adet ya da fiyat rozeti.
- Duraklatma penceresi: ses, müzik, titreşim anahtarları (Kapalı | Açık, seçili olan renkli) + Sürdür (yeşil) + Çıkış (kırmızı).
  Hamur'da duraklatınca tahta gizlenir.

## 5. Bölüm başlangıcı ve sonucu
- Bölüme girmeden önce küçük pencere: "Bölüm N" başlığı, güçlendirici seçimi, büyük yeşil Oyna.
- Kayıpta: kırık simge + tek cümle + tek büyük yeşil "Tekrar dene". Ek seçenek (reklamla devam) ikinci düğme olarak altta.

## 6. Mağaza kartı
- Kart iki bölüm: üstte açık zeminli içerik (ana ödül büyük, yanında küçük ek ödüller ve adetleri), altta renkli şerit
  (solda paket adı, sağda yeşil fiyat düğmesi).
- Köşe şeridi ("Popüler", "İyi teklif"), indirim rozeti sol üstte.
- Bölüm başlıkları ("Özel teklifler", "Paketler") tam genişlikte renkli hap.
- Altta sabit gezinme çubuğu: beş simge, seçili olan büyür ve adı yazılır, bildirim sayısı kırmızı rozetle.

## 7. Hamur'a uyarlarken
- Malzeme plastik/parlak değil, mat hamur: parmak izi dokusu, un tozu, yumuşak gölge. Parlak vurgu ve cam efekti yok.
- Palet pastel lila gökyüzü + altı hamur rengi. Koyu lacivert zemin kullanılmaz; kararan arka plan mor tonludur.
- Görsellerde yazı olmaz, bütün metin koddan gelir.
- Bir ekranda aynı renkte iki düğme olmaz; ayarlarda kullanılan renk ana ekranda yinelenmez.
- Dokunma alanı en az 44 px. Hareket azaltma açıksa animasyon yok.
