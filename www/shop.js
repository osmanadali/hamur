// Mağaza: uygulama içi ürünler (cordova-plugin-purchase 13). Android: Google Play, iOS: App Store. Ray'in shop.js'i, ürün listesi Hamur'un.
// Mağaza yoksa (web, mağaza dışından kurulan test APK'sı) sessizce devre dışı kalır; oyun etkilenmez.
// Ürün kimlikleri taslaktır: mağaza kaydı açılınca (7. aşama) kesinleşir. Tüketilemez (nc): geri yüklenir. Tüketilebilir: her alışta ödül verilir,
// ödül kayda yazıldıktan SONRA işlem bitirilir (finish → Play'de consume). Ödül yazılamazsa işlem açık kalır, sonraki açılışta yeniden gelir.
// Aynı işlem iki kez gelirse işlem kimliği kayıtta olduğundan ikinci ödül verilmez (app.js grant).
window.Shop = (() => {
  const ITEMS = [
    { key: 'noads', id: 'hamur_reklamsiz', nc: true },   // bölüm arası reklamı kapatır; ödüllü reklam isteyene açık kalır
    { key: 'bst', id: 'hamur_guclendirici', give: { bst: { geri: 3, sure: 3, makas: 3 } } },   // geri alma, +15 sn, makas
  ];
  const byKey = Object.fromEntries(ITEMS.map(x => [x.key, x])), byId = Object.fromEntries(ITEMS.map(x => [x.id, x]));
  const C = () => window.CdvPurchase;
  const ios = () => window.Capacitor?.getPlatform?.() === 'ios';
  const prods = {};
  let started = false, plat = null, H = { owned() {}, grant() { return false; } };
  const keep = p => { if (p && byId[p.id]) prods[p.id] = p; };
  // tüketilemezler: sahiplik mağazadan (satın alma, geri yükleme, yeni cihaz)
  function owned() { const S = C()?.store; if (!S) return; ITEMS.forEach(x => { if (x.nc && S.owned(x.id)) H.owned(x.key); }); }
  // onaylanan işlem: tüketilebilir ürün → önce ödül (kayda yazılır), sonra finish. Tüketilemez → doğrula → bitir.
  function approved(t) {
    const cons = (t.products || []).map(p => byId[p.id]).filter(x => x && !x.nc);
    if (!cons.length) return t.verify();
    const tx = String(t.transactionId || t.purchaseId || '');
    if (cons.every(x => H.grant(x, tx))) t.finish();
  }
  function setup() {
    const P = C(); if (!P || started) return;
    started = true;
    const { store, ProductType, Platform } = P;
    plat = ios() ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
    store.register(ITEMS.map(x => ({ id: x.id, type: x.nc ? ProductType.NON_CONSUMABLE : ProductType.CONSUMABLE, platform: plat })));
    store.when()
      .approved(approved)
      .verified(r => r.finish())
      .productUpdated(keep)
      .receiptUpdated(owned);
    store.initialize([plat]).then(() => { ITEMS.forEach(x => keep(store.get(x.id, plat))); owned(); }).catch(() => {});
  }
  // h: { owned(key), grant(item, txId) → true yalnız ödül kayda yazıldıysa }
  function init(h) { H = { ...H, ...h }; document.addEventListener('deviceready', setup, { once: true }); setup(); }
  const prod = key => prods[byKey[key || 'noads']?.id];
  // 'ok' | 'iptal' | 'hata'
  async function buy(key = 'noads') {
    const p = prod(key), o = p?.getOffer?.(); if (!o) return 'hata';
    try {
      const err = await o.order();
      if (err) return err.code === C().ErrorCode.PAYMENT_CANCELLED ? 'iptal' : 'hata';
      // gelir Firebase'in otomatik in_app_purchase olayında; burada değer (value) gönderilmez, çift sayılmasın
      window.Olcum?.event('purchase', { item_id: p.id, kind: byKey[key].nc ? 'non_consumable' : 'consumable', currency: p.pricing?.currency || '' });
      return 'ok';
    } catch { return 'hata'; }
  }
  // Geri yükleme (iki mağazada da) yalnız tüketilemezleri getirir: Play satın alımları yeniden sorgular, App Store tamamlanmış işlemleri geri getirir → receiptUpdated → owned
  async function restore() { try { const S = C()?.store; if (!S) return; await S.restorePurchases(); owned(); } catch {} }
  return { init, buy, restore, ITEMS, item: k => byKey[k], avail: () => !!C(), ready: k => !!prod(k)?.canPurchase, price: k => prod(k)?.pricing?.price || '',
    name: () => ios() ? 'App Store' : 'Google Play' };
})();
