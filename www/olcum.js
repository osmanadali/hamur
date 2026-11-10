// Ölçüm: Firebase Analytics (@capacitor-firebase/analytics). Web'de ve eklenti yoksa (yapılandırma dosyası verilmeden derlenen sürüm) no-op.
// Rıza ("temel" mod, docs/YAYIN.md §5): yerel projede toplama varsayılan KAPALI; her açılışta reklam katmanının UMP sonucu beklenir.
//   UMP "rıza gerekmiyor" (NOT_REQUIRED) → toplama açık, yalnız analytics_storage verilir; reklam rızaları (ad_*) hep reddedilir.
//   UMP rıza gerektiren bölge (AB/BK/İsviçre, ABD eyalet mesajı) → toplama kapalı, bekleyen olaylar atılır.
//   Sorgu sonuçsuz (internet yok) → karar değişmez; olaylar bellekte bekler (en çok 60), yerel toplama son kararda kalır.
//   iOS ATT: ölçüm IDFA kullanmaz (AnalyticsWithoutAdIdSupport) ve veriyi başka şirketlerin verisiyle birleştirmez → "izleme" değildir;
//   ATT reddi ölçümü etkilemez, yalnız reklam katmanını (kişisel olmayan reklam) etkiler.
// Reklam kimliği (AAID/IDFA) ölçümde toplanmaz; kullanıcı kimliği, e-posta ya da serbest metin gönderilmez.
// Arayüz: Olcum.event(ad, parametreler) — öteki modüller window.Olcum?.event(...) ile çağırır (ev eski adı, aynı işlev).
window.Olcum = (() => {
  const plug = () => window.Capacitor?.Plugins?.FirebaseAnalytics;
  let on = null, q = [];   // on: null = karar yok (olaylar bellekte bekler), true/false
  const clean = p => Object.fromEntries(Object.entries(p || {}).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => [k.slice(0, 40), typeof v === 'boolean' ? +v : typeof v === 'number' ? Math.round(v * 100) / 100 : String(v).slice(0, 100)]));
  const send = (name, params) => { try { plug().logEvent({ name, params }).catch(() => {}); } catch {} };
  function event(name, params) {
    if (!plug() || on === false) return;
    const p = clean(params);
    if (on) send(name, p); else if (q.length < 60) q.push([name, p]);
  }
  // c: UMP rıza bilgisi (AdMob requestConsentInfo yanıtı) ya da null (sorgu sonuçsuz / rıza API'si yok)
  async function consent(c) {
    const A = plug(); if (!A || !c) return;   // sonuçsuz sorgu kararı değiştirmez (bağlantı gelince yeniden sorulur)
    const ok = c?.status === 'NOT_REQUIRED';
    if (ok === on) return;
    on = ok;
    try {
      const deny = ['AD_STORAGE', 'AD_USER_DATA', 'AD_PERSONALIZATION'].map(type => A.setConsent?.({ type, status: 'DENIED' }));
      await Promise.all([...deny, A.setConsent?.({ type: 'ANALYTICS_STORAGE', status: ok ? 'GRANTED' : 'DENIED' }), A.setEnabled({ enabled: ok })]);
    } catch {}
    if (ok) q.splice(0).forEach(([n, p]) => send(n, p)); else q = [];
  }
  // Verilerimi sil: ölçüm verisi sıfırlanır ve toplama kapanır
  async function reset() { const A = plug(); if (!A) return; on = false; q = []; try { await A.setEnabled({ enabled: false }); await A.resetAnalyticsData(); } catch {} }
  return { event, ev: event, consent, reset, state: () => on };
})();
