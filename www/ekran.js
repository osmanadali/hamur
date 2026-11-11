// Hamur — ekranlar: ana ekran, bölüm yolu, tepsi koleksiyonu, ayarlar. Oyun ekranı game.js'te.
// Görsellerde yazı yoktur; bütün metin ve sayılar buradan gelir. Görsel kaynakları docs/gorseller altındadır.
(() => {
'use strict';
const App = window.__hamur, O = App.oyun, save = App.save, $ = id => document.getElementById(id);
const N = O.ASIL, EKRAN = { ana: 'sAna', yol: 'sYol', tepsi: 'sTepsi', magaza: 'sMagaza', oyun: 'sOyun' };
let acik = '';

// Sıradaki bölüm: bitirilmemiş ilk bölüm. Açık bölümler: sıradakine kadar (ayarlardan "bütün bölümler açık" test seçeneği).
const bitti = n => (save.done || []).includes(n);
const siradaki = () => { for (let n = 1; n <= N; n++) if (!bitti(n)) return n; return N; };
const acikMi = n => save.hepsiAcik || n <= siradaki();

// Ekran geçişi: un bulutu silmesi, 250 ms, bütün ekranlarda aynı (hareket azaltmada düz solma). Ekran hemen değişir; bulut üstünden geçer.
function gecis(ad) {
  const g = $('gecis'), e = $(EKRAN[ad]);
  for (const el of [g, e]) { el.classList.remove('oyna', 'giris'); void el.offsetWidth; }
  g.classList.add('oyna'); e.classList.add('giris');
}
// Bekleme: 'serit' 500 ms'yi geçen beklemede (oklavayla açılan hamur), 'top' reklam ve satın alma beklerken (yoğrulan hamur topu).
const bekle = (() => {
  let z = 0, n = 0; const el = $('bekle');
  const kilit = v => { if ($('ayar').hidden) for (const id of Object.values(EKRAN)) $(id).inert = v; };
  const ac = tur => { if (n++ > 0) return; z = setTimeout(() => { el.className = 'bekle b-' + tur; el.hidden = false; kilit(true); }, tur === 'top' ? 150 : 500); };   // iç içe beklemede sayaç ve tür ilk çağrınındır
  const kapat = () => { if (n <= 0 || --n > 0) return; clearTimeout(z); if (!el.hidden) { el.hidden = true; kilit(false); } };
  return { ac, kapat, sar: (p, tur = 'serit') => { ac(tur); return Promise.resolve(p).finally(kapat); } };
})();
App.bekle = bekle;
function goster(ad) {
  if (acik && acik !== ad) gecis(ad);
  acik = ad; document.body.classList.toggle('ana-acik', ad === 'ana'); document.body.classList.toggle('oyun-acik', ad === 'oyun'); document.body.classList.remove('gunluk-acik');
  if (ad !== 'oyun') O.dur();   // oyundan çıkınca süre, bekleyen bölüm geçişi ve reklam durur
  for (const [k, id] of Object.entries(EKRAN)) $(id).hidden = k !== ad;
  if (ad === 'ana') ana();
  if (ad === 'yol') yol();
  if (ad === 'tepsi') tepsi();
  if (ad === 'magaza') magaza();
  window.Olcum?.event('screen_view', { screen_name: ad });
}
function oyna(n) { goster('oyun'); O.setup(Math.max(1, Math.min(N, n)) - 1, false); if (!window.__hamurRobot) setTimeout(() => { if (acik === 'oyun') O.giris(); }, 400); }
function gunlukAc() { goster('oyun'); document.body.classList.add('gunluk-acik'); O.setup(O.gunlukNo(), true); if (!window.__hamurRobot) setTimeout(() => { if (acik === 'oyun') O.giris(); }, 400); }   // günlük kalıp: canlı arka plan

/* ---------- ana ekran ---------- */
function canCiz() { $('canN').textContent = O.can.n + '/' + O.can.max; const k = O.can.kalan(); $('canT').textContent = k ? O.can.yazi(k) : L('Dolu', 'Full'); }
setInterval(() => { if (acik === 'ana') canCiz(); }, 1000);
function ana() {
  const n = siradaki(), hepsi = (save.done || []).length >= N;
  if ((save.done || []).length >= 3 && !save.bildirimSoruldu) { save.bildirimSoruldu = true; App.persist(); hatirlat(true); } else hatirlat(false);
  canCiz();
  const seri = save.seri && save.seri.gun >= O.bugun() - 1 ? save.seri.n : 0;
  $('gunlukYazi').textContent = L('Günlük kalıp', 'Daily mold') + (save.gunluk?.gun === O.bugun() && save.gunluk.bitti ? ' ✓' : '') + (seri > 1 ? ' · ' + seri : ''); $('bGunluk').classList.toggle('serili', seri > 1);
  $('oynaNo').textContent = hepsi ? L('Hepsi tamam', 'All done') : L('Bölüm ', 'Level ') + n;
}

/* ---------- bölüm yolu ---------- */
// Bir karoda 11 kurabiye var (alttan üste yol sırası). Konumlar karonun eni ve boyuna göre oran (bolum-yolu-tekrar görselinden ölçüldü).
const DURAK = [[0.4982,0.955],[0.4179,0.8641],[0.2571,0.7732],[0.3063,0.6823],[0.5723,0.5914],[0.725,0.5005],[0.5634,0.4096],[0.2732,0.3187],[0.2643,0.2278],[0.4464,0.1369],[0.5045,0.046]];
function yol() {
  const el = $('yol'), sira = siradaki(); el.innerHTML = '';
  const karoSay = Math.ceil(N / DURAK.length);
  let hedef = null;
  for (let k = 0; k < karoSay; k++) {
    const karo = document.createElement('div'); karo.className = 'karo';
    DURAK.forEach(([x, y], i) => {
      const n = k * DURAK.length + i + 1;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'durak'; b.style.left = x * 100 + '%'; b.style.top = y * 100 + '%';
      if (n > N) { b.classList.add('kilitli', 'yok'); b.disabled = true; b.setAttribute('aria-label', L('Yakında', 'Coming soon')); karo.appendChild(b); return; }
      const durum = bitti(n) ? 'tamam' : n === sira ? 'siradaki' : acikMi(n) ? 'bos' : 'kilitli';
      b.classList.add(durum); b.dataset.no = n;
      b.setAttribute('aria-label', L('Bölüm ', 'Level ') + n + (durum === 'tamam' ? L(', tamamlandı', ', completed') : durum === 'kilitli' ? L(', kilitli', ', locked') : ''));
      if (durum === 'kilitli') b.disabled = true; else { const s = document.createElement('span'); s.textContent = n; b.appendChild(s); b.onclick = () => oyna(n); }
      if (durum === 'tamam') { const y = save.yildiz?.[n] || 1, e = document.createElement('em'); for (let k = 0; k < 3; k++) { const yi = document.createElement('i'); if (k >= y) yi.className = 'bos'; e.appendChild(yi); } b.appendChild(e); }
      if (n % 10 === 0) b.classList.add('figurlu');   // her 10. bölüm bir figürü tamamlar
      if (n === sira) hedef = b;
      karo.appendChild(b);
    });
    // süsler: yolun karşı tarafında, karoya göre değişen adacıklar (ayrı katman: yol ekran görüntüsü gibi durmasın)
    [.14, .47, .8].forEach((fy, j) => { const d = DURAK.reduce((p, c) => Math.abs(c[1] - fy) < Math.abs(p[1] - fy) ? c : p), su = document.createElement('i'); su.className = 'sus'; su.style.backgroundImage = `url(img/sus-${(k * 3 + j) % 10 + 1}.webp)`; su.style.top = fy * 100 + '%'; su.style.left = (d[0] < .5 ? 78 : 22) + '%'; karo.appendChild(su); });
    { const d = DURAK[3 + (k % 2) * 4], kr = document.createElement('i'); kr.className = 'sus kar'; kr.style.backgroundImage = `url(img/kar-${k % 6 + 1}.webp)`; const ustunde = k % 6 === 2 || k % 6 === 4, d2 = DURAK[3 + (k % 2) * 4 + 1]; kr.style.top = (ustunde ? (d[1] + d2[1]) * 50 - 1.5 : d[1] * 100 - 1) + '%'; kr.style.left = (ustunde ? (d[0] + d2[0]) * 50 : d[0] < .5 ? d[0] * 100 + 27 : d[0] * 100 - 27) + '%'; if (ustunde) kr.classList.add('ustte'); karo.appendChild(kr); }   // yolun kenarında oturan hamur karakter
    el.appendChild(karo);
  }
  // sıradaki bölüm ekranın ortasına gelsin
  requestAnimationFrame(() => { if (hedef) { const r = hedef.getBoundingClientRect(), e = el.getBoundingClientRect(); el.scrollTop += r.top - e.top - e.height / 2 + r.height / 2; } else el.scrollTop = el.scrollHeight; });
}

/* ---------- tepsi koleksiyonu ---------- */
// Her 10 bölümde bir figür tamamlanır. Boş siluet görselin kendi alfa kanalından gelir (CSS: karartılmış, soluk).
const FIGUR = [['Kedi', 'Cat'], ['Ev', 'House'], ['Çiçek', 'Flower'], ['Balık', 'Fish'], ['Kalp', 'Heart'], ['Roket', 'Rocket'],
  ['Tavşan', 'Rabbit'], ['Ağaç', 'Tree'], ['Araba', 'Car'], ['Yelkenli', 'Sailboat'], ['Kelebek', 'Butterfly'], ['Taç', 'Crown'],
  ['Gece kedisi', 'Night cat'], ['Şeker ev', 'Candy house'], ['Mor çiçek', 'Purple flower']].slice(0, Math.ceil(N / 10));
// Görsel: figur-<no>.webp varsa o; yoksa ilk altı figürden biri, rengi kaydırılmış (yeni varyasyon)
const VAR_FIGUR = new Set();   // kendi görseli olan numaralar (yüklenince işaretlenir)
const FIGUR_GORSEL = 12;   // kendi görseli olan figür sayısı (figur-1 … figur-N); yenileri gelince artırılır
function figurResim(im, k) { if (k < FIGUR_GORSEL) { im.src = `img/figur-${k + 1}.webp`; return; } im.src = `img/figur-${k % 6 + 1}.webp`; im.dataset.kaydir = Math.floor(k / 6) * 70; im.style.setProperty('--kaydir', Math.floor(k / 6) * 70 + 'deg'); }
const figurDurum = k => { let v = 0; for (let n = k * 10 + 1; n <= k * 10 + 10; n++) if (bitti(n)) v++; return v; };
function tepsi() {
  const el = $('figurler'); el.innerHTML = '';
  FIGUR.forEach((ad, k) => {
    const v = figurDurum(k), kart = document.createElement('div'); kart.className = 'figur' + (v >= 10 ? ' tamam' : '');
    const im = document.createElement('img'); figurResim(im, k); im.alt = ''; im.width = im.height = 256;
    // tamamlanmamış figür: alttan yukarı doğru, biten bölüm sayısı kadar dolar
    if (v < 10) { const dolu = document.createElement('img'); figurResim(dolu, k); dolu.alt = ''; dolu.className = 'dolu'; dolu.style.clipPath = `inset(${100 - v * 10}% 0 0 0)`; im.className = 'siluet'; const sar = document.createElement('div'); sar.className = 'resim'; sar.append(im, dolu); kart.append(sar); } else kart.append(im);
    const b = document.createElement('b'); b.textContent = L(...ad);
    const s = document.createElement('small'); s.textContent = v >= 10 ? L('Tamamlandı', 'Completed') : `${v} / 10`;
    kart.append(b, s); kart.setAttribute('role', 'img'); kart.setAttribute('aria-label', `${L(...ad)}: ${s.textContent}`);
    el.appendChild(kart);
  });
}

/* ---------- mağaza ---------- */
// Kart: üstte içerik (ne verdiği simgelerle), altta ad ve yeşil fiyat düğmesi. Fiyat mağazadan gelir; mağaza yoksa (tarayıcı) düğme pasif.
const URUN = [
  { key: 'buyuk', g: 'm-sandik', tr: 'Büyük paket', en: 'Big pack', rozet: ['En iyi teklif', 'Best value'], ic: [['geri', '×10'], ['saat', '+15 ×10'], ['makas', '×10'], ['kalp', L('dolu', 'full')]] },
  { key: 'bst', g: 'm-canta', tr: 'Güçlendirici paketi', en: 'Booster pack', ic: [['geri', '×3'], ['saat', '+15 ×3'], ['makas', '×3']] },
  { key: 'can', g: 'm-kalpler', tr: 'Canları doldur', en: 'Refill lives', ic: [['kalp', '×5']] },
  { key: 'noads', g: 'm-reklamsiz', tr: 'Reklamları kaldır', en: 'Remove ads', ic: [['klaket', L('reklam yok', 'no ads')]] },
];
function magaza() {
  const el = $('magaza'); el.innerHTML = '';
  const kart = (u, fiyat, tikla, pasif) => {
    const k = document.createElement('div'); k.className = 'urun';
    k.innerHTML = (u.rozet ? `<em>${L(...u.rozet)}</em>` : '') + `<div class="icerik">${u.g ? `<img class="mg" src="img/${u.g}.webp" alt="">` : ''}${u.ic.map(([r, y]) => `<span><i style="background-image:url(img/${r}.webp)"></i><b>${y}</b></span>`).join('')}</div><div class="serit2"><b>${L(u.tr, u.en)}</b></div>`;
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'hap yesil fiyat', textContent: fiyat }); b.disabled = !!pasif; b.onclick = tikla; k.querySelector('.serit2').appendChild(b); el.appendChild(k);
  };
  // günde bir ücretsiz güçlendirici: ödüllü reklamla
  const bugun = O.bugun(), aldi = save.hediyeGun === bugun;
  kart({ g: 'm-hediye', tr: 'Günün hediyesi', en: 'Daily gift', ic: [['makas', '+1'], ['saat', '+15 · +1']] }, aldi ? L('Yarın', 'Tomorrow') : L('Reklam izle', 'Watch ad'), async () => {
    let r = ''; try { r = await bekle.sar(Ads.rewarded(), 'top'); } catch {}
    if (r === 'earned') { save.bst = { ...save.bst, makas: (save.bst.makas | 0) + 1, sure: (save.bst.sure | 0) + 1 }; save.hediyeGun = bugun; App.persist(); magaza(); }
  }, aldi || !Ads.online());
  for (const u of URUN) {
    const sahip = u.key === 'noads' && save.noads, hazir = Shop.avail() && Shop.ready(u.key);
    kart(u, sahip ? L('Alındı', 'Owned') : Shop.price(u.key) || '—', async () => { const r = await bekle.sar(Shop.buy(u.key), 'top'); if (r === 'ok') magaza(); }, sahip || !hazir);
  }
  const g = Object.assign(document.createElement('button'), { type: 'button', className: 'hap mor geri-yukle', textContent: L('Satın alımları geri yükle', 'Restore purchases') });
  g.onclick = async () => { await bekle.sar(Shop.restore(), 'top'); magaza(); }; el.appendChild(g);
  if (!Shop.avail()) el.appendChild(Object.assign(document.createElement('p'), { className: 'aciklama', textContent: L('Satın alma yalnız telefondaki uygulamada çalışır.', 'Purchases work only in the app on your phone.') }));
}

/* ---------- ayarlar ---------- */
const SECENEK = [
  ['music', 'Müzik', 'Music'], ['sound', 'Efekt sesleri', 'Sound effects'], ['vib', 'Titreşim', 'Vibration'],
  ['bildirim', 'Günlük hatırlatma', 'Daily reminder'],
  ['damga', 'Renk damgaları (renk körlüğü)', 'Color stamps (color blindness)'],
  ['hepsiAcik', 'Bütün bölümler açık (test)', 'All levels open (test)'],
];
function ayar() {
  const el = $('secenekler'); el.innerHTML = '';
  for (const [k, tr, en] of SECENEK) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'secenek'; b.setAttribute('role', 'switch'); b.id = 'sec-' + k;
    const acik2 = () => k === 'bildirim' || k === 'music' ? save[k] !== false : !!save[k];   // müzik ve hatırlatma varsayılan açık
    const ciz = () => { b.setAttribute('aria-checked', String(acik2())); };
    b.append(Object.assign(document.createElement('span'), { textContent: L(tr, en) }), Object.assign(document.createElement('i'), { className: 'anahtar' }));
    b.onclick = () => { save[k] = !acik2(); App.persist(); ciz(); O.ayarDegisti?.(); muzik(); if (k === 'bildirim') hatirlat(true); if (acik === 'yol') yol(); Ses.buzz(8); };
    ciz(); el.appendChild(b);
  }
  // dil: değişince sayfa yenilenir (metinler yüklemede seçilir)
  const d = document.createElement('div'); d.className = 'secenek dil'; d.append(Object.assign(document.createElement('span'), { textContent: L('Dil', 'Language') }));
  const ad = (window.HAMUR_LANGS.find(x => x[0] === window.HAMUR_LANG) || [])[1] || window.HAMUR_LANG;
  const sel = Object.assign(document.createElement('button'), { type: 'button', id: 'sec-dil', className: 'dil-dugme', textContent: ad }); sel.setAttribute('aria-expanded', 'false');
  const liste = document.createElement('div'); liste.className = 'diller'; liste.hidden = true;
  for (const [k, isim] of window.HAMUR_LANGS) { const b = Object.assign(document.createElement('button'), { type: 'button', className: 'dil-dugme', textContent: isim }); b.dataset.dil = k; b.setAttribute('aria-current', String(k === window.HAMUR_LANG));
    b.onclick = () => { if (k === window.HAMUR_LANG) return; save.lang = k; App.persist(); bekle.ac('serit'); try { sessionStorage.setItem('hamurAcilisAtla', '1'); } catch {} location.reload(); }; liste.appendChild(b); }
  sel.onclick = () => { liste.hidden = !liste.hidden; sel.setAttribute('aria-expanded', String(!liste.hidden)); };
  d.append(sel); el.append(d, liste);
  [...el.children].forEach((c, i) => c.style.setProperty('--i', i));   // satırlar 30 ms arayla belirir
  ayarOnce = document.activeElement;
  for (const id of Object.values(EKRAN)) $(id).inert = true;   // arkadaki düğmeler klavye ve ekran okuyucuya kapalı
  $('ayar').classList.remove('kapan'); $('ayar').hidden = false; $('ayarKapat').focus();
}
let ayarOnce = null;
function ayarKapat() {
  if ($('ayar').hidden || $('ayar').classList.contains('kapan')) return;
  $('ayar').classList.add('kapan'); setTimeout(() => { $('ayar').hidden = true; $('ayar').classList.remove('kapan'); }, 170);   // ezilip küçülerek kapanır
  for (const id of Object.values(EKRAN)) $(id).inert = false;
  if (ayarOnce && ayarOnce.isConnected) ayarOnce.focus(); ayarOnce = null;
}

/* ---------- bağlantılar ---------- */
$('bOyna').onclick = () => oyna(siradaki()); $('bGunluk').onclick = gunlukAc;
$('bYol').onclick = () => goster('yol'); $('bTepsi').onclick = () => goster('tepsi');
$('yolGeri').onclick = $('tepsiGeri').onclick = $('magazaGeri').onclick = () => goster('ana'); $('bMagaza').onclick = () => goster('magaza');
$('bCik').onclick = () => O.cikisSor();   // oyundan çıkınca ana ekran
$('bAyar').onclick = ayar; $('ayarKapat').onclick = ayarKapat;
$('ayar').addEventListener('click', e => { if (e.target === $('ayar')) ayarKapat(); });
addEventListener('keydown', e => { if (e.key === 'Escape') ayarKapat(); });
// Android geri tuşu: oyun → bölüm yolu → ana ekran
window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => { if (!$('ayar').hidden) ayarKapat(); else if (acik === 'oyun') O.cikisSor(); else if (acik !== 'ana') goster('ana'); else window.Capacitor.Plugins.App.exitApp?.(); });

// Oyun bir figürü tamamlayan bölümü bildirir (kutlama yazısı için)
O.figurAdi = n => n % 10 === 0 && figurDurum(n / 10 - 1) >= 10 ? { ad: L(...FIGUR[n / 10 - 1]), resim: `img/figur-${n / 10 > FIGUR_GORSEL ? (n / 10 - 1) % 6 + 1 : n / 10}.webp`, kaydir: n / 10 > FIGUR_GORSEL ? Math.floor((n / 10 - 1) / 6) * 70 : 0 } : null;

// Paralaks: parmağın ya da telefonun eğiminin konumuna göre gökyüzü katmanları hafifçe kayar. Hareket azaltmada kapalı.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const gok = document.querySelector('.gok'), yaz = (x, y) => { gok.style.setProperty('--px', Math.max(-1, Math.min(1, x)).toFixed(3)); gok.style.setProperty('--py', Math.max(-1, Math.min(1, y)).toFixed(3)); };
  // (parmakla paralaks kaldırıldı: dokununca arka plan sallanıyordu)
  addEventListener('deviceorientation', e => { if (e.gamma != null) yaz(e.gamma / 25, (e.beta - 45) / 25); }, { passive: true });
}

// Tepsi ödülü: figür tamamlanınca tam ekran kutlama (ışınlar, büyüyerek gelen figür). Dokununca ya da 3 sn sonra kapanır.
let kutlaT = 0;
function kutla(fig) {
  const k = $('kutla'); k.querySelector('img').src = fig.resim; k.querySelector('img').style.filter = fig.kaydir ? `hue-rotate(${fig.kaydir}deg) drop-shadow(0 14px 14px rgba(40,10,80,.45))` : ''; k.querySelector('h2').textContent = fig.ad + L(' tamamlandı!', ' completed!');
  k.hidden = false; clearTimeout(kutlaT); kutlaT = setTimeout(() => { k.hidden = true; }, 3000); k.onclick = () => { clearTimeout(kutlaT); k.hidden = true; };
  Ses.buzz([20, 60, 20, 60, 40]); [523, 659, 784, 1047, 1319].forEach((f, i) => Ses.fx(f, .3, 'triangle', 0, .07, .1 + i * .11));
}
// Günlük hatırlatma: her gün 10.00'da "bugünün kalıbı hazır" yerel bildirimi (yalnız telefonda). İzin, oyuncu üç bölüm bitirince bir kez sorulur;
// ayarlardaki anahtarla açılıp kapanır.
async function hatirlat(sor) {
  const B = window.Capacitor?.Plugins?.LocalNotifications; if (!B) return;
  try {
    await B.cancel({ notifications: [{ id: 1 }] });
    if (save.bildirim === false) return;
    let izin = (await B.checkPermissions()).display;
    if (izin !== 'granted' && sor) izin = (await B.requestPermissions()).display;
    if (izin !== 'granted') return;
    await B.schedule({ notifications: [{ id: 1, title: L('Bugünün kalıbı hazır', "Today's mold is ready"), body: L('Günlük kalıp seni bekliyor. Hamurlar yerinde duramıyor!', 'The daily mold is waiting. The dough can hardly sit still!'), schedule: { on: { hour: 10, minute: 0 }, allowWhileIdle: false } }] });
  } catch {}
}

// Müzik: tek döngü (ses/muzik.mp3). Tarayıcı izin verdiği ilk dokunuşta başlar; ayarlardan kapatılır; uygulama arka plandayken durur.
const calgi = new Audio('ses/muzik.mp3'); calgi.loop = true; calgi.volume = .32; calgi.preload = 'none';
function muzik() { try { if (save.music !== false && !document.hidden) calgi.play().catch(() => {}); else calgi.pause(); } catch {} }
addEventListener('pointerdown', muzik, { once: true }); document.addEventListener('visibilitychange', muzik);

// Basma tepkisi: her düğme basılınca içine çöker, işlem çökme bittikten sonra yapılır (ekran değişse de çökme görülür).
document.addEventListener('click', e => {
  if (window.__hamurRobot) return;   // test robotu düğmeleri beklemeden sınar
  const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return;
  if (b._gec) { b._gec = false; return; }
  e.stopImmediatePropagation(); e.preventDefault();
  if (b.classList.contains('bas')) return;
  b.classList.add('bas'); Ses.buzz(5);
  setTimeout(() => { b.classList.remove('bas'); if (!b.isConnected || b.disabled) return; b._gec = true; b.click(); }, 140);
}, true);

// Açılış: ana ekran. Editörden gelen deneme bölümü (#bolum=) ve test robotu (window.__hamurEkran) doğrudan oyunu açar.
goster(window.__hamurEkran || (O.deneme ? 'oyun' : 'ana'));
App.ekran = { muzik, kutla, goster, oyna, siradaki, acikMi, get acik() { return acik; }, ayar };
})();
