// 'npx cap add android' ile üretilen projeyi Hamur için hazırlar (CI: apk.yml, release.yml). android/ depoda yok, her derlemede yeniden üretilir.
// Her yama kalıbı bulunamazsa durur: Capacitor şablonu değişirse derleme sessizce yanlış çıkmasın.
// Ortam: ADMOB_APP_ID (yoksa Google test App ID), ADMOB_INTERSTITIAL + ADMOB_REWARDED (varsa index.html'e window.HAMUR_ADS),
//        VERSION_CODE, VERSION_NAME (yoksa package.json), HAMUR_KEYSTORE (+ _PASSWORD, HAMUR_KEY_ALIAS, HAMUR_KEY_PASSWORD: imzalı sürüm),
//        FIREBASE_ANDROID_JSON (gizli değer, isteğe bağlı: ölçüm).
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..'), A = path.join(R, 'android'), E = process.env;
const TEST_APP = 'ca-app-pub-3940256099942544~3347511713';
const rd = f => fs.readFileSync(f, 'utf8'), wr = (f, s) => fs.writeFileSync(f, s);
function yama(f, eski, yeni, ad) {
  const s = rd(f); if (!(typeof eski === 'string' ? s.includes(eski) : eski.test(s))) throw new Error(`${ad}: kalıp bulunamadı (${path.relative(R, f)})`);
  wr(f, s.replace(eski, yeni)); console.log('✓', ad);
}
const bul = (d, ad) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { const x = bul(p, ad); if (x) return x; } else if (e.name === ad) return p; } };

// 1) AdMob App ID + yalnız dikey (Android 16+ büyük ekranlarda sistem yok sayar; telefonda geçerli)
const MAN = path.join(A, 'app/src/main/AndroidManifest.xml'), appId = E.ADMOB_APP_ID || TEST_APP;
yama(MAN, '</application>', `    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${appId}"/>\n    </application>`, `AdMob App ID ${appId === TEST_APP ? '(Google test)' : '(gerçek)'}`);
yama(MAN, 'android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"', 'Yalnız dikey');
// Hatırlatmalar kesin alarm istemez (game.js: isExactNotification:false) → LocalNotifications'ın eklediği izni birleşik bildirgeden çıkar
yama(MAN, /<manifest xmlns:android="([^"]+)">/, '<manifest xmlns:android="$1" xmlns:tools="http://schemas.android.com/tools">', 'tools ad alanı');
yama(MAN, '</manifest>', '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />\n</manifest>', 'SCHEDULE_EXACT_ALARM kaldırıldı');

// 2) Bildirim simgesi: Hamur'un ikonu 3. aşamada (görsel kimlik) çizilince eklenir (Ray: tools/android/ic_stat_ray.xml + LocalNotifications.smallIcon)

// 3) Kenardan kenara: Capacitor 8 SystemBars belgesi BridgeActivity'de EdgeToEdge.enable() önerir (Capacitor 9'da varsayılan olacak).
//    Böylece Android 15 öncesi de 15+ gibi davranır; güvenli alanı SystemBars (insetsHandling) + CSS env()/--safe-area-inset-* çözer.
const MA = bul(path.join(A, 'app/src/main/java'), 'MainActivity.java');
yama(MA, /import com\.getcapacitor\.BridgeActivity;\s*public class MainActivity extends BridgeActivity \{\}/,
  `import android.os.Bundle;\nimport androidx.activity.EdgeToEdge;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        EdgeToEdge.enable(this);\n    }\n}`, 'EdgeToEdge.enable');

// 4) SDK düzeyleri: Play hedef API ≥ 35 ister (2025-08'den beri); Play Billing minSdk ≥ 23
const VG = path.join(A, 'variables.gradle'), vg = rd(VG), sdk = k => +(vg.match(new RegExp(k + '\\s*=\\s*(\\d+)')) || [])[1];
const [mn, tg, cp] = ['minSdkVersion', 'targetSdkVersion', 'compileSdkVersion'].map(sdk);
console.log(`  minSdk=${mn} targetSdk=${tg} compileSdk=${cp}`);
if (!(mn >= 23)) yama(VG, /minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 23', 'minSdk 23');
if (!(tg >= 35)) throw new Error(`targetSdk ${tg} < 35: Google Play kabul etmez (Capacitor sürümünü yükselt)`);

// 5) Sürüm: versionCode (Play'de her yüklemede artmalı) + versionName
const BG = path.join(A, 'app/build.gradle'), vc = +(E.VERSION_CODE || 1), vn = E.VERSION_NAME || require(path.join(R, 'package.json')).version;
if (!(vc >= 1 && vc <= 2100000000 && Number.isInteger(vc))) throw new Error('VERSION_CODE 1…2100000000 arası tam sayı olmalı: ' + E.VERSION_CODE);
yama(BG, /versionCode \d+/, `versionCode ${vc}`, `versionCode ${vc}`);
yama(BG, /versionName "[^"]*"/, `versionName "${vn}"`, `versionName ${vn}`);

// 6) İmza (yalnız release.yml): anahtar deposu yolu ve parolalar ortamdan okunur, dosyaya yazılmaz
if (E.HAMUR_KEYSTORE) {
  yama(BG, /\n    buildTypes \{\n        release \{/, `
    signingConfigs {
        release {
            storeFile = file(System.getenv("HAMUR_KEYSTORE"))
            storePassword = System.getenv("HAMUR_KEYSTORE_PASSWORD")?.trim()
            keyAlias = System.getenv("HAMUR_KEY_ALIAS")?.trim()
            keyPassword = System.getenv("HAMUR_KEY_PASSWORD")?.trim()
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.release`, 'İmza yapılandırması');
}

// 7) Gerçek reklam birimleri (ads.js'ten önce window.HAMUR_ADS). Yoksa ads.js Google test kimliklerini kullanır.
if (E.ADMOB_INTERSTITIAL || E.ADMOB_REWARDED) {
  const ads = { android: { interstitial: E.ADMOB_INTERSTITIAL, rewarded: E.ADMOB_REWARDED } };
  yama(path.join(R, 'www/index.html'), '<script src="ads.js"></script>', `<script>window.HAMUR_ADS = ${JSON.stringify(ads)}</script><script src="ads.js"></script>`, 'window.HAMUR_ADS (Android)');
}

// 8) Ölçüm (Firebase Analytics): FIREBASE_ANDROID_JSON gizli değeri varsa google-services.json yazılır, yoksa eklenti çıkarılır (tools/olcum-hazirla.cjs)
require('child_process').execFileSync(process.execPath, [path.join(R, 'tools/olcum-hazirla.cjs'), 'android'], { stdio: 'inherit' });
