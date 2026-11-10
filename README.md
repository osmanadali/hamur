# Hamur

Renkli hamur parçalarını yapıştırıp şekil kurduğun ve o şekli süre bitmeden kalıbına oturttuğun, bölüm bölüm ilerleyen telefon oyunu. Çalışma adıdır.

Plan: [docs/Hamur-Yol-Haritasi.pdf](docs/Hamur-Yol-Haritasi.pdf). Şu an 1. aşamadayız (kural ve çözücü).

## Yapı

Ray (`osmanadali/mobil-oyun`) ile aynı: hazır oyun motoru yok, düz JavaScript, Canvas 2D, Web Audio, Capacitor 8.

| Yol | İçerik |
|---|---|
| `www/app.js` | Kabuk: kayıt, ayarlar, reklam ve mağaza bağlantısı. Oyun prototipten buraya taşınacak. |
| `www/rules/` | Kural çekirdeği (hareket, yapışma, karışım, kalıp, çıkmaz). Henüz boş. |
| `www/ses.js` | Ses, müzik, titreşim (Ray'den) |
| `www/ads.js`, `www/shop.js`, `www/olcum.js` | Reklam, mağaza, ölçüm (Ray'den) |
| `www/i18n.js`, `tools/diller.cjs`, `tools/diller/` | `L('Türkçe', 'English')` ve öteki dillerin sözlükleri (Ray'den) |
| `tools/hakem.cjs`, `tools/hakem/` | Test robotu (Playwright). Oyun kontrolleri `tools/hakem/*.cjs` altına eklenir. |
| `tools/android/`, `tools/olcum-hazirla.cjs` | `cap add android` sonrası yerel proje hazırlığı |
| `.github/workflows/` | `hakem.yml` (robot), `apk.yml` (test APK'sı, elle), `web.yml` (Pages, elle) |

## Komutlar

```bash
npm run serve
```

```bash
node tools/hakem.cjs --strict
```

```bash
node tools/diller.cjs
```

## Ray'den henüz alınmayanlar

- `release.yml`, `ios.yml`, `ios-release.yml`, `ios-iap.yml`, `tools/ios/`: mağaza kaydı ve reklam kimlikleri açılınca (7. aşama).
- `tools/store-shots.cjs`, `tools/ikon.cjs`, `tools/make-assets.cjs`, bildirim simgesi: ikon ve ekranlar çizilince (3. aşama).
- Müzik şimdilik Ray'in bestesi; görsel kimlikle birlikte yeniden yazılacak.

Paket adı (`com.osmanadali.hamur`) ve ürün kimlikleri (`hamur_reklamsiz`, `hamur_guclendirici`) taslaktır.
