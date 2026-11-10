// Çevrimdışı: önbellekten anında aç, arkada güncelle (stale-while-revalidate).
// Yeni dosya eklenince F listesine girer (robot www/ ile listeyi karşılaştırır: tools/hakem.cjs "sw.liste").
const C = 'hamur-v3', F = ['./', 'index.html', 'style.css', 'i18n.js', 'ses.js', 'olcum.js', 'ads.js', 'shop.js', 'app.js', 'game.js', 'bolumler.js', 'rules/cekirdek.js', 'rules/cozucu.js', 'img/gok.webp', 'img/tepsi.webp', 'img/doku.webp', 'img/duvar.webp', ...['de', 'es', 'pt-BR', 'fr'].map(l => `lang/${l}.js`), 'manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(F)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.open(C).then(c => c.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
