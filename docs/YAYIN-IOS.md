# Hamur'u TestFlight'a yükleme (iOS)

Mac gerekmez. GitHub, Hamur'u Apple'ın bulut makinesinde derler, imzalar ve App Store Connect'e yükler; yapı birkaç dakika sonra TestFlight'ta görünür. Düzen Ray'dekiyle aynıdır, gizli değerlerin adları da aynıdır.

İki iş akışı var:

| Ad (Actions sekmesinde) | Dosya | Ne yapar |
|---|---|---|
| **iOS (simülatör)** | `.github/workflows/ios.yml` | İmzasız deneme derlemesi. Apple hesabı ve gizli değer istemez. "Proje derleniyor mu?" sorusunu yanıtlar. |
| **iOS yayın (App Store Connect)** | `.github/workflows/ios-release.yml` | İmzalı yapı üretir ve TestFlight'a yükler. Aşağıdaki adımlar bunun içindir. |

## 1. Apple tarafında bir kez yapılacaklar

Apple Developer Program üyeliği (Ray için alınan) yeterlidir; yeni üyelik gerekmez.

1. **Bundle ID'yi aç.** developer.apple.com → Account → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
   - Description: `Hamur`
   - Bundle ID: **Explicit** seç, tam olarak `com.osmanadali.hamur` yaz.
   - Yetenek listesinde bir şey işaretlemene gerek yok. Kaydet.
2. **Uygulama kaydını aç.** appstoreconnect.apple.com → Apps → **+** → New App.
   - Platform: iOS
   - Name: `Hamur` (ad başkasında ise `Hamur: Bulmaca` gibi bir ad seç; telefonda görünen ad yine "Hamur" olur)
   - Primary Language: Turkish
   - Bundle ID: listeden `com.osmanadali.hamur`
   - SKU: `hamur-ios`
   - User Access: Full Access

Bu kayıt olmadan yükleme reddedilir ("uygulama bulunamadı" benzeri bir hata).

## 2. GitHub'a eklenecek gizli değerler

Yer: github.com/osmanadali/hamur → **Settings → Secrets and variables → Actions → Secrets → New repository secret**.

Zorunlu dört gizli değer:

| Ad | Ne | Nereden alınır |
|---|---|---|
| `APPSTORE_API_KEY_ID` | API anahtarının kimliği, 10 karakter | App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys; anahtarın satırındaki "Key ID" |
| `APPSTORE_API_ISSUER_ID` | Tireli uzun kod (UUID) | Aynı sayfanın üstündeki "Issuer ID" |
| `APPSTORE_API_KEY_P8_BASE64` | `AuthKey_XXXX.p8` dosyasının base64 hâli | Anahtarı oluştururken indirdiğin `.p8` dosyası (aşağıya bak) |
| `APPLE_TEAM_ID` | Takım kimliği, 10 karakter | developer.apple.com → Account → Membership details → "Team ID" |

**Ray'deki değerlerin aynısı kullanılır.** API anahtarı takıma aittir, takımdaki bütün uygulamalarda geçer; Hamur için yeni anahtar gerekmez. Ancak GitHub kayıtlı bir gizli değeri geri göstermez: Ray deposundan kopyalayamazsın, dört değeri kaynağından yeniden girmen gerekir.

- **Key ID, Issuer ID, Team ID** yukarıdaki sayfalarda her zaman görünür.
- **`.p8` dosyası** Apple'dan yalnız bir kez indirilebilir. Ray için indirdiğin yedeği kullan. Yedek yoksa aynı sayfada **+** ile yeni bir Team Key oluştur (rol: **Admin**), `.p8`'i indir ve yedekle; bu durumda `APPSTORE_API_KEY_ID` de yeni anahtarınki olur.
- `.p8` dosyasını base64'e çevirmek için:
  - Mac: `base64 -i AuthKey_XXXX.p8 | pbcopy` (sonuç panoya kopyalanır)
  - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8")) | Set-Clipboard`
  - Linux: `base64 -w0 AuthKey_XXXX.p8`

İsteğe bağlı:

| Tür | Ad | Not |
|---|---|---|
| Gizli değer | `FIREBASE_IOS_PLIST` | Ölçüm (Firebase) için. Yoksa yapı ölçümsüz derlenir, sorun olmaz. **Ray'inkini kopyalama:** içindeki paket kimliği `com.osmanadali.hamur` olmalı; Hamur için Firebase'de ayrı iOS uygulaması açılınca eklenir. |
| Değişken | `ADMOB_APP_ID_IOS`, `ADMOB_INTERSTITIAL_IOS`, `ADMOB_REWARDED_IOS` | Şimdilik **boş bırak** (bkz. §6). |

## 3. Yapıyı başlat

1. github.com/osmanadali/hamur → **Actions**.
2. Soldan **iOS yayın (App Store Connect)** seç.
3. Sağda **Run workflow** → dal `main` → **Run workflow**. "Yapı numarası" kutusunu boş bırak (numara kendiliğinden artar).
4. Yaklaşık 15-25 dakika sürer. Yeşil tik: yüklendi. Kırmızı çarpı: işi aç, kırmızı adımın günlüğünde neyin eksik olduğu Türkçe yazar.

İlk kez deniyorsan önce **iOS (simülatör)** akışını çalıştırmak iyi olur: gizli değer istemez, derleme sorunlarını imza sorunlarından ayırır.

## 4. Yüklemeden sonra TestFlight'ta ne görürsün

1. App Store Connect → Apps → Hamur → **TestFlight** sekmesi.
2. Yapı önce "Processing" (işleniyor) olarak görünür; genelde 10-30 dakika. Bitince Apple e-posta gönderir.
3. Şifreleme sorusu çıkmaz (yapıda beyan hazır). Durum "Ready to Submit" ya da "Ready to Test" olur.
4. **İç test (kendin ve ekibin):** TestFlight → Internal Testing → **+** ile bir grup aç, kendini ekle, yapıyı gruba ekle. İnceleme beklemez. iPhone'una **TestFlight** uygulamasını kur, aynı Apple hesabıyla gir; Hamur listede çıkar.
5. **Dış test (herkese açık bağlantı):** External Testing grubu açılır; ilk yapı Apple'ın kısa "Beta App Review" incelemesinden geçer (genelde bir gün).
6. Her TestFlight yapısı 90 gün geçerlidir. Yeni yapı için 3. adımı yinele.

Sürüm `package.json`'daki `version` değeridir (şu an 0.1.0); yapı numarası her çalıştırmada artar.

## 5. Sık görülen hatalar

| Günlükteki ileti | Çözüm |
|---|---|
| "Eksik ayar var" | §2'deki dört gizli değerden biri girilmemiş. |
| "Apple anahtarı kabul etmedi (HTTP 401)" | Key ID, Issuer ID ve `.p8` aynı anahtara ait değil ya da anahtar silinmiş. |
| "APPSTORE_API_KEY_P8_BASE64 çözülemedi" | `.p8`'in kendisi değil base64 hâli yapıştırılmalı; eksik kopyalanmış olabilir. |
| Arşivde imza / "provisioning profile" hatası | Anahtarın rolü Admin mi? Bundle ID (§1.1) açık mı? Apple hesabında en az bir kayıtlı iPhone var mı? Yeni bir sözleşme onayı bekliyor olabilir (developer.apple.com'a girince çıkar). |
| Yüklemede "bundle version must be higher" | Run workflow'da "Yapı numarası"na TestFlight'taki son numaradan büyük bir sayı yaz. |
| Yüklemede uygulama bulunamadı | App Store Connect'teki uygulama kaydı (§1.2) yok ya da başka paket kimliğiyle açılmış. |

## 6. Reklamlar: şimdilik test reklamı

Hamur'un AdMob'da iOS kaydı henüz yok. Bu yüzden yapı Google'ın herkese açık **test kimlikleriyle** derlenir: reklamlarda "Test Ad" yazar, gelir oluşmaz. TestFlight denemesi için bu yeterlidir; iş akışı sarı bir uyarı verir ama durmaz. Ray'in AdMob kimlikleri bilerek taşınmadı.

App Store incelemesine göndermeden önce:

1. admob.google.com → Apps → Add app → iOS → "Hamur (iOS)". Bir **geçiş** (interstitial) ve bir **ödüllü** (rewarded) reklam birimi aç.
2. GitHub → Settings → Secrets and variables → Actions → **Variables** sekmesine üçünü birlikte ekle:
   - `ADMOB_APP_ID_IOS` (içinde `~` olan: `ca-app-pub-…~…`)
   - `ADMOB_INTERSTITIAL_IOS` (`ca-app-pub-…/…`)
   - `ADMOB_REWARDED_IOS` (`ca-app-pub-…/…`)
3. Yapıyı yeniden başlat. Üçü de girilmişse gerçek reklamlar açılır; yalnız biri ya da ikisi girilmişse iş akışı durur.

## 7. Bu düzen neleri kapsamıyor

- Uygulama içi satın alma ürünleri (henüz yok; açılınca App Store Connect'te ürün kaydı ve ayrı bir adım gerekir).
- App Store sayfası: ekran görüntüleri, açıklama, gizlilik anketi, yaş derecelendirmesi. Bunlar mağazaya gönderimde doldurulur, TestFlight için gerekmez.
