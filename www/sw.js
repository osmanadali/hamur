// Çevrimdışı: önbellekten anında aç, arkada güncelle (stale-while-revalidate).
// Yeni dosya eklenince F listesine girer (robot www/ ile listeyi karşılaştırır: tools/hakem.cjs "sw.liste").
const C = 'hamur-v15', F = ['./', 'index.html', 'style.css', 'i18n.js', 'ses.js', 'olcum.js', 'ads.js', 'shop.js', 'app.js', 'game.js', 'ekran.js', 'acilis.js', 'bolumler.js', 'rules/cekirdek.js', 'rules/cozucu.js', 'font/titan-latin-ext.woff2', 'font/titan-latin.woff2', 'img/acilis.webp', 'img/akrep.webp', 'img/ana.webp', 'img/ayarlar.webp', 'img/bastan.webp', 'img/blok.webp', 'img/bulut-1.webp', 'img/bulut-2.webp', 'img/bulut-3.webp', 'img/bulut-4.webp', 'img/bulut-5.webp', 'img/bulut-6.webp', 'img/canta.webp', 'img/damgalar.webp', 'img/doku.webp', 'img/duvar.webp', 'img/el.webp', 'img/figur-1.webp', 'img/figur-2.webp', 'img/figur-3.webp', 'img/figur-4.webp', 'img/figur-5.webp', 'img/figur-6.webp', 'img/geri.webp', 'img/hap-mor.webp', 'img/hap-sari.webp', 'img/hap-yesil.webp', 'img/hucre.webp', 'img/ikon-192.png', 'img/ikon-512.png', 'img/kadran.webp', 'img/kapat.webp', 'img/kayip-sure.webp', 'img/kayip-yapisma.webp', 'img/kazanc.webp', 'img/kilit.webp', 'img/klaket.webp', 'img/kurabiye-bos.webp', 'img/kurabiye-kilitli.webp', 'img/kurabiye-siradaki.webp', 'img/kurabiye-tamam.webp', 'img/logo.webp', 'img/makas-kapali.webp', 'img/makas.webp', 'img/oynat.webp', 'img/panel.webp', 'img/parcacik.webp', 'img/saat.webp', 'img/ses.webp', 'img/sessiz.webp', 'img/tepsi.webp', 'img/top-kirmizi.webp', 'img/top-mor.webp', 'img/top-sari.webp', 'img/top-yesil.webp', 'img/yildiz.webp', 'img/yol.webp', 'img/yuz-dikey.webp', 'img/yuzler.webp', ...['de', 'es', 'pt-BR', 'fr'].map(l => `lang/${l}.js`), 'manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(F)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.open(C).then(c => c.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
