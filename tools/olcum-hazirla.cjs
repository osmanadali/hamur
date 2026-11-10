// Ölçüm (Firebase Analytics) yerel kurulumu — CI'da 'cap add' ile 'cap sync' arasında çalışır (android/hazirla.cjs, ios/hazirla.sh çağırır).
// Kullanım: node tools/olcum-hazirla.cjs android|ios
// Yapılandırma dosyaları depoya girmez; GitHub gizli değerlerinden gelir (ham içerik ya da base64):
//   FIREBASE_ANDROID_JSON → android/app/google-services.json   ·   FIREBASE_IOS_PLIST → ios/App/App/GoogleService-Info.plist
// Gizli değer yoksa, çözülemezse ya da içindeki paket/bundle kimliği bu derlemeninkiyle (capacitor.config.json appId) eşleşmezse
// @capacitor-firebase/analytics bu makinede kaldırılır (package.json yalnız CI kopyasında değişir): derleme bozulmaz, ölçüm kapalı kalır
// (www/olcum.js eklentiyi bulamaz → no-op). Varsa: toplama varsayılan KAPALI, reklam kimliği toplanmaz, rıza varsayılanları reddedilmiş;
// olcum.js UMP sonucuna göre açar (docs/YAYIN.md §5).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const R = path.join(__dirname, '..'), OS = process.argv[2], E = process.env;
if (!['android', 'ios'].includes(OS)) { console.error('kullanım: node tools/olcum-hazirla.cjs android|ios'); process.exit(2); }
const appId = JSON.parse(fs.readFileSync(path.join(R, 'capacitor.config.json'), 'utf8')).appId;
const sh = c => execSync(c, { cwd: R, stdio: 'inherit' });
// ham içerik ya da base64 (satır sonlu da olabilir)
function coz(v) {
  if (!v || !v.trim()) return '';
  const t = v.trim();
  if (t.startsWith('{') || t.startsWith('<')) return t;
  try { const d = Buffer.from(t.replace(/\s+/g, ''), 'base64').toString('utf8').trim(); return d.startsWith('{') || d.startsWith('<') ? d : ''; } catch { return ''; }
}
function kapat(neden) {
  console.log(`• Ölçüm kapalı (${neden}): @capacitor-firebase/analytics bu derlemeden çıkarılıyor`);
  sh('npm uninstall @capacitor-firebase/analytics --no-audit --no-fund --silent');
  if (E.GITHUB_ACTIONS) console.log(`::notice title=Ölçüm kapalı::${neden} · docs/YAYIN.md §5`);
}
function yama(f, eski, yeni, ad) {
  const s = fs.readFileSync(f, 'utf8'); if (!(typeof eski === 'string' ? s.includes(eski) : eski.test(s))) throw new Error(`${ad}: kalıp bulunamadı (${path.relative(R, f)})`);
  fs.writeFileSync(f, s.replace(eski, yeni)); console.log('✓', ad);
}

if (OS === 'android') {
  const raw = coz(E.FIREBASE_ANDROID_JSON);
  let j = null; try { j = raw && JSON.parse(raw); } catch {}
  const pk = (j?.client || []).map(c => c.client_info?.android_client_info?.package_name);
  if (!j) kapat(E.FIREBASE_ANDROID_JSON ? 'FIREBASE_ANDROID_JSON çözülemedi' : 'FIREBASE_ANDROID_JSON gizli değeri yok');
  else if (!pk.includes(appId)) kapat(`google-services.json içinde ${appId} yok (var: ${pk.join(', ') || '—'})`);
  else {
    const A = path.join(R, 'android');
    fs.writeFileSync(path.join(A, 'app/google-services.json'), raw); console.log(`✓ google-services.json (${appId}, proje ${j.project_info?.project_id})`);
    // Capacitor şablonu: kök build.gradle'da google-services sınıf yolu, app/build.gradle'da dosya varsa eklentiyi uygulayan blok
    if (!/com\.google\.gms:google-services/.test(fs.readFileSync(path.join(A, 'build.gradle'), 'utf8'))) throw new Error('android/build.gradle: google-services sınıf yolu yok (Capacitor şablonu değişmiş)');
    if (!/com\.google\.gms\.google-services/.test(fs.readFileSync(path.join(A, 'app/build.gradle'), 'utf8'))) throw new Error('android/app/build.gradle: google-services eklentisi uygulanmıyor (Capacitor şablonu değişmiş)');
    const meta = { firebase_analytics_collection_enabled: false, google_analytics_adid_collection_enabled: false, google_analytics_ssaid_collection_enabled: false,
      google_analytics_default_allow_analytics_storage: false, google_analytics_default_allow_ad_storage: false,
      google_analytics_default_allow_ad_user_data: false, google_analytics_default_allow_ad_personalization_signals: false };
    yama(path.join(A, 'app/src/main/AndroidManifest.xml'), '</application>', Object.entries(meta).map(([k, v]) => `    <meta-data android:name="${k}" android:value="${v}"/>\n`).join('') + '    </application>',
      'Firebase: toplama varsayılan kapalı, reklam kimliği yok, rıza varsayılanları reddedilmiş');
  }
} else {
  const raw = coz(E.FIREBASE_IOS_PLIST), bid = (raw.match(/<key>BUNDLE_ID<\/key>\s*<string>([^<]+)<\/string>/) || [])[1];
  if (!raw) kapat(E.FIREBASE_IOS_PLIST ? 'FIREBASE_IOS_PLIST çözülemedi' : 'FIREBASE_IOS_PLIST gizli değeri yok');
  else if (bid !== appId) kapat(`GoogleService-Info.plist BUNDLE_ID ${bid || '—'} ≠ ${appId}`);
  else {
    const P = 'ios/App/App/Info.plist';
    fs.writeFileSync(path.join(R, 'ios/App/App/GoogleService-Info.plist'), raw); sh('plutil -lint ios/App/App/GoogleService-Info.plist');
    for (const k of ['FIREBASE_ANALYTICS_COLLECTION_ENABLED', 'GOOGLE_ANALYTICS_IDFV_COLLECTION_ENABLED', 'GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE',
      'GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE', 'GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA', 'GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS']) sh(`plutil -replace ${k} -bool NO ${P}`);
    console.log('✓ Info.plist: toplama varsayılan kapalı, IDFV yok, rıza varsayılanları reddedilmiş');
    // plist uygulama paketine girmeli: Xcode projesine kaynak olarak eklenir (xcodeproj gem'i, hazirla.sh kurar)
    sh(`ruby -rxcodeproj -e 'p = Xcodeproj::Project.open("ios/App/App.xcodeproj"); t = p.targets.find { |x| x.name == "App" } or abort "App hedefi yok"
      g = p.main_group["App"] or abort "App grubu yok"; f = g.files.find { |x| x.path == "GoogleService-Info.plist" } || g.new_reference("GoogleService-Info.plist")
      t.resources_build_phase.add_file_reference(f, true); p.save; puts "  Resources: GoogleService-Info.plist"'`);
    // SPM: IDFA'sız Firebase (AnalyticsWithoutAdIdSupport) ve paket kimliği çakışmasına karşı symlink (eklenti README; Capacitor CLI 8.4+)
    const cf = path.join(R, 'capacitor.config.json'), c = JSON.parse(fs.readFileSync(cf, 'utf8'));
    c.experimental = { ...c.experimental, ios: { spm: { swiftToolsVersion: '6.1', packageOptions: { '@capacitor-firebase/analytics': { symlink: true } }, packageTraits: { '@capacitor-firebase/analytics': ['AnalyticsWithoutAdIdSupport'] } } } };
    fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n'); console.log('✓ capacitor.config.json: SPM AnalyticsWithoutAdIdSupport');
  }
}
