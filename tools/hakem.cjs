// Hamur — otomatik hakem (test robotu). Ray'in tools/hakem.cjs iskeleti: sunucu, sahte Capacitor eklentileri, özet ve çıkış kodu.
// Oyunu gerçek tarayıcıda açar, ölçer, ekran görüntüsü alır.
// Kullanım: node tools/hakem.cjs [--strict] [--only=<tools/hakem dosya adı parçası>]
// Çıktı: hakem-out/metrics.json, hakem-out/ozet.md, hakem-out/shots/*.png
// Oyun kontrolleri (kural çekirdeği, çözücü, bölümler) tools/hakem/*.cjs dosyalarında durur; her dosya T yardımcılarını alan bir işlev dışa verir.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const OUT = process.env.HAKEM_OUT || path.join(__dirname, '..', 'hakem-out');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
function serve(ROOT_ = ROOT) {
  const ROOT = ROOT_;
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

const checks = [], metrics = {};
function check(id, name, pass, detail = '', severity = 'high') {
  checks.push({ id, name, pass: !!pass, detail: String(detail), severity });
  console.log(`${pass ? '✓' : '✗'} [${severity}] ${name}${detail ? ' — ' + detail : ''}`);
}

// Capacitor eklentilerinin sahtesi: reklam, titreşim, paylaşım çağrılarını kaydeder.
const MOCK = `
  window.__log = { ads: [], hap: 0, share: [], raf: 0, errors: [] };
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { window.__log.raf++; return _raf(cb); };
  if (!window.__noCap) window.Capacitor = { Plugins: {
    AdMob: (() => { const L = {}, emit = e => (L[e] || []).slice().forEach(f => f({}));
      return { addListener: (e, f) => { (L[e] = L[e] || []).push(f); return Promise.resolve({ remove() { L[e] = L[e].filter(x => x !== f); } }); },
        initialize: async () => {}, prepareInterstitial: async () => {}, prepareRewardVideoAd: async () => {},
        showInterstitial: async () => { window.__log.ads.push('interstitial'); setTimeout(() => emit('interstitialAdDismissed'), 50); },
        showRewardVideoAd: async () => { window.__log.ads.push('rewarded'); setTimeout(() => { emit('onRewardedVideoAdReward'); emit('onRewardedVideoAdDismissed'); }, 50); return { type: 'sure', amount: 1 }; } }; })(),
    Haptics: { impact() { window.__log.hap++; }, notification() { window.__log.hap++; } },
    Share: { share: async o => { window.__log.share.push(o.text); } } } };
`;
// Mağaza sahtesi (cordova-plugin-purchase): sipariş → işlem onaylanır. Tüketilebilir: approved(t) → ödül → t.finish(). Tüketilemez: sahip olunur.
// window.__dupTx doluysa her sipariş aynı işlem kimliğiyle gelir (yarıda kalan işlemin yeniden teslimi).
const SHOP_MOCK = `window.CdvPurchase = (() => { const own = new Set(), cb = {}, P = {}; let n = 0;
  const product = id => P[id] ||= { id, canPurchase: true, pricing: { price: '₺59,99', currency: 'TRY' }, getOffer: () => ({ order: async () => {
    const tx = { products: [{ id }], transactionId: window.__dupTx || 'tx' + (++n), finish() { (window.__log.fin ||= []).push(this.transactionId); }, verify() { own.add(id); (cb.r || []).forEach(f => f({})); } };
    (window.__log.orders ||= []).push(id); (cb.a || []).forEach(f => f(tx)); } }) };
  const when = { approved(f) { cb.a = [f]; return when; }, verified() { return when; }, productUpdated(f) { cb.p = [f]; return when; }, receiptUpdated(f) { cb.r = [f]; return when; } };
  return { ProductType: { NON_CONSUMABLE: 'nc', CONSUMABLE: 'c' }, Platform: { GOOGLE_PLAY: 'gp', APPLE_APPSTORE: 'as' }, ErrorCode: { PAYMENT_CANCELLED: 1 },
    store: { register(l) { l.forEach(x => product(x.id)); }, when: () => when, initialize: async () => { Object.values(P).forEach(p => (cb.p || []).forEach(f => f(p))); return []; },
      get: id => P[id], owned: id => own.has(id), restorePurchases: async () => {} } }; })();`;

async function open(browser, url, { vp = [390, 844], scheme = 'light', save = null, cap = true, init = '', rm = false, locale } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, colorScheme: scheme, hasTouch: true, isMobile: true, reducedMotion: rm ? 'reduce' : 'no-preference', ...(locale ? { locale } : {}) });
  if (!cap) await ctx.addInitScript('window.__noCap = true');
  if (init) await ctx.addInitScript(init);
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url);
  if (save) { await page.evaluate(s => localStorage.setItem('hamur', JSON.stringify(s)), save); await page.reload(); }
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const getSave = page => page.evaluate(() => JSON.parse(localStorage.getItem('hamur') || '{}'));
async function inViewport(page, sel) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel); if (!el) return { ok: false, why: 'yok' };
    const r = el.getBoundingClientRect();
    return { ok: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.width > 0, w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);
}

(async () => {
  const t0 = Date.now();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/`;
  // varsayılan dil Türkçe: oyun cihaz dili tr değilse İngilizce açılır; İngilizce testi locale'i açıkça verir
  const _browser = await chromium.launch();
  const browser = { newContext: o => _browser.newContext({ locale: 'tr-TR', ...o }), close: () => _browser.close() };
  const T = { browser, URL, ROOT, serve, open, shot, getSave, inViewport, check, metrics, MOCK, SHOP_MOCK };
  const eklentiler = only => fs.readdirSync(path.join(__dirname, 'hakem')).filter(f => f.endsWith('.cjs') && (!only || f.includes(only))).sort();

  // geliştirirken yalnız bir dosya: node tools/hakem.cjs --only=cozucu (birleştirmeden önceki tam koşunun yerini tutmaz)
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
  if (only) {
    for (const f of eklentiler(only)) await require(path.join(__dirname, 'hakem', f))(T);
  } else {
  // ---------- A. Açılış: hatasız, iki dilde, dar ekranda sığar ----------
  for (const [locale, vp, ad] of [['tr-TR', [390, 844], 'tr'], ['en-US', [320, 568], 'en']]) {
    const { ctx, page, errors } = await open(browser, URL, { locale, vp });
    const lang = await page.evaluate(() => [window.HAMUR_LANG, document.documentElement.lang, typeof L]);
    const fit = await inViewport(page, '#cv');
    await shot(page, 'acilis-' + ad);
    check('acilis.' + ad, `Açılış hatasız (${locale}, ${vp[0]} px)`, !errors.length && lang[0] === ad && lang[1] === ad && lang[2] === 'function' && fit.ok, errors[0] || `dil ${lang[0]}`);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(browser, URL, { cap: false });
    const ok = await page.evaluate(() => !!window.__hamur && !window.Capacitor && window.Ads.online() === false && window.Shop.avail() === false);
    check('acilis.web', 'Tarayıcıda (Capacitor yok) reklam ve mağaza sessizce kapalı', ok && !errors.length, errors[0] || '');
    await ctx.close();
  }

  // ---------- B. Kayıt: bozuk kayıtla açılır, ayarlar kalıcı ----------
  {
    const { ctx, page, errors } = await open(browser, URL, { init: `try { if (!sessionStorage.getItem('b')) { sessionStorage.setItem('b', 1); localStorage.setItem('hamur', '{bozuk'); } } catch {}` });
    const s = await page.evaluate(() => { const h = window.__hamur; h.save.sound = false; h.persist(); return h.save.level; });
    await page.reload(); await page.waitForTimeout(200);
    const s2 = await page.evaluate(() => window.__hamur.save.sound);
    check('kayit', 'Bozuk kayıtla açılır, ayar yeniden açılışta korunur', s === 1 && s2 === false && !errors.length, errors[0] || '');
    await ctx.close();
  }

  // ---------- C. Reklam akışı (sahte AdMob) ----------
  {
    const { ctx, page } = await open(browser, URL);
    const r = await page.evaluate(async () => {
      const A = window.Ads; await A.init(); A.warm(); await new Promise(r => setTimeout(r, 100));
      const rew = await A.rewarded();
      const hemen = await A.interstitial();   // ödüllü videonun hemen ardından geçiş reklamı gelmez (90 sn)
      return { rew, hemen, log: window.__log.ads };
    });
    check('reklam.odullu', 'Ödüllü reklam: izlenince ödül hak edilir', r.rew === 'earned' && r.log.join() === 'rewarded', `${r.rew} · ${r.log}`);
    check('reklam.aralik', 'Bölüm arası reklam bir önceki reklamdan sonra 90 sn geçmeden gösterilmez', r.hemen === false, String(r.hemen));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, URL);
    const r = await page.evaluate(async () => {
      const A = window.Ads; await A.init(); A.warm(); await new Promise(r => setTimeout(r, 100));
      const ilk = await A.interstitial(), ikinci = await A.interstitial();
      return { ilk, ikinci, log: window.__log.ads };
    });
    check('reklam.gecis', 'Bölüm arası reklam: hazırsa gösterilir, art arda ikincisi gösterilmez', r.ilk === true && r.ikinci === false && r.log.join() === 'interstitial', `${r.ilk}/${r.ikinci} · ${r.log}`);
    await ctx.close();
  }

  // ---------- D. Mağaza (sahte mağaza) ----------
  {
    const { ctx, page, errors } = await open(browser, URL, { init: SHOP_MOCK });
    await page.waitForTimeout(200);
    const r = await page.evaluate(async () => {
      const S = window.Shop, h = window.__hamur, once = { ...h.save.bst };
      const a = await S.buy('bst'), b = await S.buy('noads');
      window.__dupTx = 'tx1'; await S.buy('bst');   // aynı işlem yeniden gelirse ikinci ödül yok
      return { a, b, once, sonra: h.save.bst, noads: h.save.noads, fin: window.__log.fin, ready: S.ready('bst'), price: S.price('bst') };
    });
    const disk = await getSave(page);
    check('magaza.tuketilebilir', 'Güçlendirici paketi: ödül kayda yazılır, sonra işlem bitirilir; aynı işlem ikinci kez ödül vermez',
      r.a === 'ok' && r.sonra.geri === r.once.geri + 3 && r.sonra.sure === r.once.sure + 3 && r.sonra.makas === r.once.makas + 3 && disk.bst?.geri === r.sonra.geri && disk.iapTx?.includes('tx1') && r.fin?.length === 2 && r.ready && !!r.price && !errors.length,
      errors[0] || JSON.stringify(r.sonra));
    check('magaza.reklamsiz', 'Reklamsız paket: satın alınca kayda işlenir', r.b === 'ok' && r.noads === true && disk.noads === true, String(r.noads));
    await ctx.close();
  }

  // ---------- E. Ses: ayar kapalıyken ses üretilmez ----------
  {
    const { ctx, page, errors } = await open(browser, URL, { save: { sound: false, music: false, vib: true } });
    const r = await page.evaluate(() => { const S = window.Ses; S.tone(440); S.Music.start(); S.haptic('light'); return { ctx: !!S.ctx(), on: S.Music.state().on, hap: window.__log.hap }; });
    check('ses.kapali', 'Ses ve müzik kapalıyken ses üretilmez, titreşim çalışır', !r.ctx && !r.on && r.hap === 1 && !errors.length, errors[0] || JSON.stringify(r));
    await ctx.close();
  }

  // ---------- K. Oyun kontrolleri (tools/hakem/*.cjs) ----------
  for (const f of eklentiler()) await require(path.join(__dirname, 'hakem', f))(T);

  // ---------- H. Çevrimdışı açılış (service worker) ----------
  {
    // önbellek listesi www/ ile birebir: listede olup dosyası olmayan kurulumu düşürür, dosyası olup listede olmayan çevrimdışı açılmaz
    const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), F = new Function(src.replace(/self\.addEventListener[\s\S]*$/, '') + '; return F;')();
    const var_ = []; const walk = (d, pre = '') => fs.readdirSync(d).forEach(f => { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, pre + f + '/') : var_.push(pre + f); });
    walk(ROOT);
    const liste = new Set(F.filter(f => f !== './')), disk = new Set(var_.filter(f => f !== 'sw.js'));
    const eksik = [...disk].filter(f => !liste.has(f)), fazla = [...liste].filter(f => !disk.has(f));
    check('sw.liste', 'Çevrimdışı önbellek listesi www/ ile aynı', !eksik.length && !fazla.length, [eksik.length ? 'listede yok: ' + eksik.join(', ') : '', fazla.length ? 'dosyası yok: ' + fazla.join(', ') : ''].filter(Boolean).join(' · '));

    const { ctx, page } = await open(browser, URL, { cap: false });
    const ready = await page.evaluate(() => navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 5000))]) : false);
    await page.waitForTimeout(800);
    await ctx.setOffline(true);
    let ok = false, err = '';
    try { await page.reload({ timeout: 8000 }); await page.waitForTimeout(500); ok = await page.evaluate(() => !!window.__hamur.oyun.st.pieces.length && !!window.Ses && !!window.Shop); }
    catch (e) { err = e.message.split('\n')[0]; }
    await shot(page, 'offline').catch(() => {});
    check('offline', 'İnternetsiz yeniden açılıyor ve bölüm kuruluyor', ready && ok, ready ? err : 'service worker hazır değil');
    await ctx.close();
  }

  // ---------- I. Boyut (yol haritası: web tarafı 1,5 MB altında) ----------
  {
    let bytes = 0; const walk = d => fs.readdirSync(d).forEach(f => { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : bytes += fs.statSync(p).size; });
    walk(ROOT); metrics.webBytes = bytes;
    check('size', 'Web paketi < 1,5 MB', bytes < 1.5 * 1024 * 1024, `${(bytes / 1024).toFixed(0)} KB`, 'low');
  }
  }

  await browser.close(); server.close();
  const failed = checks.filter(c => !c.pass);
  metrics.durationSec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify({ when: new Date().toISOString(), checks, metrics }, null, 2));
  const md = [`# Hakem — otomatik test özeti`, ``, `${checks.length - failed.length}/${checks.length} kontrol geçti · ${metrics.durationSec} sn`, ``, `| | Önem | Kontrol | Ayrıntı |`, `|---|---|---|---|`,
    ...checks.map(c => `| ${c.pass ? '✅' : '❌'} | ${c.severity} | ${c.name} | ${c.detail.replace(/\|/g, '/')} |`)].join('\n');
  fs.writeFileSync(path.join(OUT, 'ozet.md'), md + '\n');
  console.log(`\n${checks.length - failed.length}/${checks.length} geçti → ${path.relative(process.cwd(), OUT)}/ozet.md`);
  if (process.argv.includes('--strict') && failed.some(c => c.severity === 'high')) process.exit(1);
})().catch(e => { console.error(e); process.exit(2); });
