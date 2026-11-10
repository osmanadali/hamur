#!/bin/bash
# 'npx cap add ios' ile üretilen projeyi Hamur için hazırlar (CI: ios.yml, ios-release.yml; macOS). ios/ depoda yok, her derlemede yeniden üretilir.
# Ortam: ADMOB_APP_ID_IOS (yoksa Google test App ID), ADMOB_INTERSTITIAL_IOS + ADMOB_REWARDED_IOS (gerçekse index.html'e window.HAMUR_ADS;
#        boşsa ya da Google test kimliğiyse yazılmaz, www/ads.js kendi test kimliklerine ve test kipine düşer),
#        VERSION_CODE (yapı numarası, yoksa 1), VERSION_NAME (yoksa package.json), FIREBASE_IOS_PLIST (gizli değer, isteğe bağlı: ölçüm)
set -euo pipefail
cd "$(dirname "$0")/../.."
P=ios/App/App/Info.plist PBX=ios/App/App.xcodeproj/project.pbxproj PB=/usr/libexec/PlistBuddy
APP_ID=${ADMOB_APP_ID_IOS:-ca-app-pub-3940256099942544~1458002511}
VN=${VERSION_NAME:-$(node -p "require('./package.json').version")} VC=${VERSION_CODE:-1}
pb() { "$PB" -c "$1" "$P"; }
put() { pb "Delete :$1" 2>/dev/null || true; pb "Add :$1 $2${3:+ \"$3\"}"; }   # anahtar varsa yenisiyle değiştir

# 1) Info.plist
pb "Set :CFBundleDisplayName Hamur"
# Dil: WKWebView navigator.languages'ı uygulamanın desteklediği dillerden verir, eşleşme yoksa geliştirme bölgesine düşer.
# Bu yüzden geliştirme bölgesi 'en' ve altı dil de CFBundleLocalizations + .lproj ile bildirilir (bkz. 5. adım).
LANGS="en tr de es pt-BR fr"
ATT_EN="If you allow it, ads can be chosen based on your interests. If you do not, the game works just the same; you will still see ads, but they will be less personal."
ATT_TR="İzin verirsen reklamlar ilgi alanlarına göre seçilebilir. Vermesen de oyun aynen çalışır; reklamlar yine görünür ama daha az kişisel olur."
ATT_DE="Wenn du es erlaubst, können Anzeigen nach deinen Interessen ausgewählt werden. Wenn nicht, funktioniert das Spiel genauso; du siehst weiterhin Anzeigen, nur weniger persönliche."
ATT_ES="Si lo permites, los anuncios pueden elegirse según tus intereses. Si no, el juego funciona igual; seguirás viendo anuncios, pero menos personalizados."
ATT_PT="Se você permitir, os anúncios podem ser escolhidos de acordo com seus interesses. Se não, o jogo funciona do mesmo jeito; você continua vendo anúncios, mas menos personalizados."
ATT_FR="Si tu l’autorises, les publicités peuvent être choisies selon tes centres d’intérêt. Sinon, le jeu fonctionne exactement pareil ; tu verras toujours des publicités, mais moins personnalisées."
pb "Set :CFBundleDevelopmentRegion en"
put CFBundleLocalizations array; i=0; for l in $LANGS; do pb "Add :CFBundleLocalizations:$i string $l"; i=$((i+1)); done
put GADApplicationIdentifier string "$APP_ID"
put NSUserTrackingUsageDescription string "$ATT_EN"
put ITSAppUsesNonExemptEncryption bool false
put UIRequiresFullScreen bool true
for k in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do   # yalnız dikey
  put "$k" array; pb "Add :$k:0 string UIInterfaceOrientationPortrait"
done
put SKAdNetworkItems array; i=0
while read -r id; do
  case "$id" in ''|\#*) continue;; esac
  pb "Add :SKAdNetworkItems:$i dict"; pb "Add :SKAdNetworkItems:$i:SKAdNetworkIdentifier string $id"; i=$((i+1))
done < tools/ios/skadnetwork.txt
plutil -lint "$P"
echo "✓ Info.plist: AdMob $([ "$APP_ID" = "ca-app-pub-3940256099942544~1458002511" ] && echo '(Google test)' || echo '(gerçek)'), $i SKAdNetwork, yalnız dikey, diller $LANGS (geliştirme: en)"

# 2) Xcode projesi: yalnız iPhone, sürüm
grep -q 'TARGETED_DEVICE_FAMILY' "$PBX" || { echo "TARGETED_DEVICE_FAMILY bulunamadı"; exit 1; }
sed -i '' -E "s/TARGETED_DEVICE_FAMILY = [^;]*;/TARGETED_DEVICE_FAMILY = 1;/g; s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $VN;/g; s/CURRENT_PROJECT_VERSION = [^;]*;/CURRENT_PROJECT_VERSION = $VC;/g" "$PBX"
grep -E 'TARGETED_DEVICE_FAMILY|MARKETING_VERSION|CURRENT_PROJECT_VERSION|IPHONEOS_DEPLOYMENT_TARGET' "$PBX" | sort | uniq -c
echo "✓ Proje: yalnız iPhone, sürüm $VN ($VC)"

# 3) App Store simgesi saydamlık (alfa) içeremez → varsa düzleştir
for f in ios/App/App/Assets.xcassets/AppIcon.appiconset/*.png; do
  if sips -g hasAlpha "$f" | grep -q 'hasAlpha: yes'; then
    sips -s format jpeg -s formatOptions best "$f" --out /tmp/hamur-ikon.jpg >/dev/null && sips -s format png /tmp/hamur-ikon.jpg --out "$f" >/dev/null; echo "  alfa kaldırıldı: $f"
  fi
done
echo "✓ Simge: $(sips -g pixelWidth -g hasAlpha ios/App/App/Assets.xcassets/AppIcon.appiconset/*.png | grep -E 'pixelWidth|hasAlpha' | tr -s ' ' | paste -sd ' ' -)"

# 4) Gerçek reklam birimleri (ads.js'ten önce window.HAMUR_ADS). Yoksa ads.js Google test kimliklerini kullanır.
#    Google test kimliği (3940256099942544) verilirse de yazılmaz: yazılsaydı ads.js bunları gerçek sanıp test kipini kapatırdı.
if [ -n "${ADMOB_INTERSTITIAL_IOS:-}" ] && [ -n "${ADMOB_REWARDED_IOS:-}" ] && ! echo "$ADMOB_INTERSTITIAL_IOS $ADMOB_REWARDED_IOS" | grep -q 3940256099942544; then
  node -e "const f='www/index.html',fs=require('fs'),s=fs.readFileSync(f,'utf8'),t='<script src=\"ads.js\"></script>';if(!s.includes(t))throw Error('ads.js satırı yok');
    fs.writeFileSync(f,s.replace(t,'<script>window.HAMUR_ADS = '+JSON.stringify({ios:{interstitial:process.env.ADMOB_INTERSTITIAL_IOS,rewarded:process.env.ADMOB_REWARDED_IOS}})+'</script>'+t))"
  echo "✓ window.HAMUR_ADS (iOS)"
else
  echo "✓ window.HAMUR_ADS yazılmadı: reklamlar Google test kimlikleriyle (Test Ad) çalışır"
fi

# 5) Yerelleştirme: <dil>.lproj/InfoPlist.strings (6 dil) (ATT metni), projeye Resources olarak eklenir (xcodeproj gem'i)
for l in $LANGS; do   # macOS /bin/bash 3.2: ${l^^} yok
  mkdir -p "ios/App/App/$l.lproj"
  case $l in en) t=$ATT_EN;; tr) t=$ATT_TR;; de) t=$ATT_DE;; es) t=$ATT_ES;; pt-BR) t=$ATT_PT;; fr) t=$ATT_FR;; esac
  printf '"NSUserTrackingUsageDescription" = "%s";\n' "$t" > "ios/App/App/$l.lproj/InfoPlist.strings"
  plutil -lint "ios/App/App/$l.lproj/InfoPlist.strings"
done
ruby -rxcodeproj -e1 2>/dev/null || gem install --no-document xcodeproj >/dev/null || sudo gem install --no-document xcodeproj >/dev/null
LANGS="$LANGS" ruby -rxcodeproj -e '
  proj = Xcodeproj::Project.open("ios/App/App.xcodeproj")
  target = proj.targets.find { |t| t.name == "App" } or abort "App hedefi yok"
  group = proj.main_group["App"] or abort "App grubu yok"
  vg = group.children.find { |c| c.isa == "PBXVariantGroup" && c.display_name == "InfoPlist.strings" } || group.new_variant_group("InfoPlist.strings")
  langs = ENV["LANGS"].split
  langs.each do |l|
    next if vg.files.any? { |f| f.name == l }
    ref = vg.new_reference("#{l}.lproj/InfoPlist.strings"); ref.name = l
  end
  target.resources_build_phase.add_file_reference(vg, true)
  proj.root_object.known_regions = (proj.root_object.known_regions | langs | %w[Base])
  proj.save
  puts "  knownRegions: #{proj.root_object.known_regions.join(", ")}; Resources: #{vg.files.map(&:path).join(", ")}"'
echo "✓ Yerelleştirme: $LANGS (InfoPlist.strings) projede"

# 6) Ölçüm (Firebase Analytics): FIREBASE_IOS_PLIST gizli değeri varsa GoogleService-Info.plist projeye eklenir, yoksa eklenti çıkarılır
node tools/olcum-hazirla.cjs ios
