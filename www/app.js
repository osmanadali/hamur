// Hamur — uygulama kabuğu: kayıt, ayarlar, reklam ve mağaza bağlantısı, çevrimdışı açılış.
// Oyun (tahta, sürükleme, çizim) game.js'te, kurallar www/rules/ altında. Bu dosya ikisinden önce yüklenir.
'use strict';
const KEY = 'hamur';
// level: sıradaki bölüm (1'den başlar) · done: bitirilen bölüm numaraları · wins: kazanılan bölüm sayısı (reklam aralığı)
// fails: bölüm numarası → art arda kayıp sayısı (üç kayıptan sonra o bölümde 10 sn eklenir; kazanınca silinir)
const def = { level: 1, done: [], wins: 0, fails: {}, sound: true, music: true, vib: true, lang: '', noads: false, bst: { geri: 3, sure: 3, makas: 3 }, iapTx: [] };
let save;
try { save = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { save = { ...def }; }
save.bst = { ...def.bst, ...save.bst };
if (!save.bstHediye) { for (const k of Object.keys(def.bst)) save.bst[k] = Math.max(save.bst[k] | 0, def.bst[k]); save.bstHediye = true; }   // başlangıç stoku: eski kayıtlara da bir kez verilir
const persist = () => { save.ts = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; } };

Ses.init(() => save);

// Satın alma ödülü: önce kayda yazılır, yazıldıysa true (shop.js işlemi ancak o zaman bitirir). Aynı işlem kimliği ikinci kez ödül vermez.
function grant(item, tx) {
  if (tx && save.iapTx.includes(tx)) return true;
  for (const [k, n] of Object.entries(item.give?.bst || {})) save.bst[k] = (save.bst[k] || 0) + n;
  if (tx) save.iapTx = [...save.iapTx, tx].slice(-200);
  return persist();
}
Shop.init({ owned(key) { if (key === 'noads' && !save.noads) { save.noads = true; persist(); } }, grant });

// Reklam: açılışta rıza ve başlatma. Bölüm arası reklamın ne zaman gösterileceğine oyun karar verir
// (ilk 10 bölümde yok, sonra 3 bölümde bir, yalnız kazanınca; iki reklam arası en az 90 sn ads.js'te).
Ads.init();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

window.__hamur = { get save() { return save; }, persist, grant };
