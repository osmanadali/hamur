// Oyun testleri (gerçek tarayıcı, parmak hareketi): niyet okuma, kalıba oturma, çıkmaz, geri alma, süre.
'use strict';
const PROTO = require('../ornek/prototip.cjs');
// Geçiş testi tahtası: kırmızı (0,1) sağa giderken (2,2)'deki kırmızının üstünden geçer
const GECIS = { t: 60, hint: ['', ''], map: ['.....', 'r....', '..r..'], molds: ['...RR', '.....', '.....'] };

module.exports = async ({ browser, URL, open, shot, getSave, check }) => {
  const ac = async (opt = {}) => {
    const o = await open(browser, URL, opt);
    o.kur = async (L) => o.page.evaluate(L => { const O = window.__hamur.oyun; if (typeof L === 'number') return O.setup(L - 1); O.LEVELS.push(L); O.setup(O.LEVELS.length - 1); }, L);
    o.xy = async (x, y, ox = 0, oy = 0) => o.page.evaluate(([x, y, ox, oy]) => { const O = window.__hamur.oyun, r = document.getElementById('cv').getBoundingClientRect(); return [r.left + O.PAD + (x + .5 + ox) * O.cell, r.top + O.PAD + (y + .5 + oy) * O.cell]; }, [x, y, ox, oy]);
    o.tut = async (x, y) => { const [a, b] = await o.xy(x, y); await o.page.mouse.move(a, b); await o.page.mouse.down(); };
    // ms sürede (x,y) karesine sürükle; (ox,oy): kare merkezinden kayma (kare cinsinden)
    o.gotur = async (x, y, ms = 200, ox = 0, oy = 0) => { const [a, b] = await o.xy(x, y, ox, oy), n = Math.max(2, Math.round(ms / 16)), [sx, sy] = o.son || await o.xy(x, y); for (let i = 1; i <= n; i++) { await o.page.mouse.move(sx + (a - sx) * i / n, sy + (b - sy) * i / n); await o.page.waitForTimeout(ms / n); } o.son = [a, b]; };
    o.basla = async (x, y) => { o.son = await o.xy(x, y); await o.tut(x, y); };
    o.birak = async () => { await o.page.mouse.up(); o.son = null; };
    o.d = () => o.page.evaluate(() => { const O = window.__hamur.oyun; return { n: O.st.pieces.length, durum: O.durum, iplik: O.iplik, boy: O.st.pieces.map(p => p.cells.length).sort().join(''), ov: document.getElementById('ov').hidden ? '' : document.getElementById('ovT').textContent, geri: O.geriKalan, geriVar: O.geriVar, btn: !document.getElementById('undo').disabled }; });
    return o;
  };

  // ---------- niyet okuma ----------
  {
    const o = await ac(); await o.kur(GECIS);
    await o.basla(0, 1); await o.gotur(4, 1, 350); const tutarken = await o.d(); await o.birak(); await o.page.waitForTimeout(150);
    const s = await o.d();
    check('niyet.gec', 'Yanından geçip giden parça yapışmaz', tutarken.n === 2 && s.n === 2 && s.durum === 'play', `${s.n} parça`);
    await o.ctx.close();
  }
  {
    const o = await ac(); await o.kur(GECIS);
    await o.basla(0, 1); await o.gotur(2, 1, 200); await o.page.waitForTimeout(200);
    const erken = await o.d(); await o.page.waitForTimeout(600); const gec = await o.d();
    await shot(o.page, 'niyet-dur'); await o.birak();
    check('niyet.dur', 'Yanında duran parça yarım saniyede yapışır; iplik önce görünür', erken.n === 2 && erken.iplik[0]?.v > .1 && erken.iplik[0]?.v < 1 && gec.n === 1, `0,2 sn: ${erken.n} parça, iplik ${erken.iplik[0]?.v.toFixed(2)} (${erken.iplik[0]?.ne}) · 0,8 sn: ${gec.n} parça`);
    await o.ctx.close();
  }
  {
    const o = await ac(); await o.kur(GECIS);
    await o.basla(0, 1); await o.gotur(2, 1, 200); await o.gotur(2, 1, 60, 0, .5); await o.page.waitForTimeout(220);
    const s = await o.d(); await o.birak();
    check('niyet.it', 'Öteki parçaya doğru itince hemen yapışır (0,15 sn)', s.n === 1, `${s.n} parça`);
    await o.ctx.close();
  }
  {
    const o = await ac(); await o.kur(GECIS);
    await o.basla(0, 1); await o.gotur(2, 1, 200); await o.gotur(2, 1, 60, 0, -.4); await o.page.waitForTimeout(800);
    const s = await o.d(); await o.gotur(2, 0, 100); await o.birak(); await o.page.waitForTimeout(100); const son = await o.d();
    check('niyet.kacin', 'Ters yöne çekince iplik kopar, parça yapışmadan uzaklaşır', s.n === 2 && s.iplik[0]?.v === 0 && s.iplik[0]?.ne === 'kacin' && son.n === 2, `${s.n} parça, iplik ${s.iplik[0]?.v} (${s.iplik[0]?.ne})`);
    await o.ctx.close();
  }
  {
    const o = await ac(); await o.kur(GECIS);
    await o.basla(0, 1); await o.gotur(2, 1, 120); await o.birak(); await o.page.waitForTimeout(100);
    const s = await o.d();
    check('niyet.birak', 'Parmağını yanında kaldırınca yapışır (yapışmadan yan yana bekleyen parça olmaz)', s.n === 1, `${s.n} parça`);
    await o.ctx.close();
  }
  {
    const o = await ac(); await o.kur(GECIS);
    await o.page.evaluate(() => { window.__hamur.oyun.CFG.niyet = false; });
    await o.basla(0, 1); await o.gotur(4, 1, 350); const s = await o.d(); await o.birak();
    check('niyet.kapali', 'Niyet okuma kapatılınca prototipin eski hali: değdiği an yapışır', s.n === 1, `${s.n} parça`);
    await o.ctx.close();
  }

  // ---------- önce aynı renk, sonra karışım (elde tutarken de, bırakınca da, tahtanın iki yönünde de) ----------
  {
    // mavi, hem sarıya hem öteki maviye değecek yere gelir: önce mavi + mavi, sonra + sarı = 3 karelik yeşil (kalıba oturur)
    const son = [];
    for (const map of [['.....', 'y.b..', '.....', '.b...'], ['.....', 'b.y..', '.....', '.b...']]) for (const kip of ['bekle', 'sariya it', 'birak']) {
      const o = await ac(); await o.kur({ t: 60, hint: ['', ''], map, molds: ['.....', '.....', '.....', '..GGG'] });
      await o.basla(1, 3); await o.gotur(1, 2, 80); await o.gotur(1, 1, 80);
      if (kip === 'bekle') await o.page.waitForTimeout(900);
      if (kip === 'sariya it') { await o.gotur(1, 1, 60, map[1][0] === 'y' ? -.45 : .45, 0); await o.page.waitForTimeout(450); }
      if (kip === 'birak') { await o.birak(); await o.page.waitForTimeout(150); }
      const s = await o.d(); son.push(`${map[1]} ${kip}: ${s.boy} ${s.durum}`); if (kip !== 'birak') await o.birak();
      await o.ctx.close();
    }
    check('niyet.sira', 'Aynı anda kendi rengine ve karışacağı renge değen parça önce kendi rengiyle yapışır (tut, it ya da bırak; tahtanın iki yönü)', son.every(x => / 3 play$/.test(x)), son.join(' · '));
  }
  {
    // sarı, kırmızı ile mavinin arasına hemen bırakılır: iplikler eşit, sonuç tahtanın yönüne bağlı olmamalı (çekirdek: kırmızı önce → turuncu)
    const son = [];
    for (const map of [['.....', 'r.b..', '.....', '.y...'], ['.....', 'b.r..', '.....', '.y...']]) {
      const o = await ac(); await o.kur({ t: 60, hint: ['', ''], map, molds: ['OO.B.', '.....', '.....', '.....'] });
      await o.basla(1, 3); await o.gotur(1, 1, 120); await o.birak(); await o.page.waitForTimeout(150);
      son.push(await o.page.evaluate(() => window.__hamur.oyun.st.pieces.map(p => p.color + p.cells.length).sort().join(' '))); await o.ctx.close();
    }
    check('niyet.esit', 'İki farklı renge aynı anda değip hemen bırakınca sonuç tahtanın yönüne bağlı değildir', son[0] === son[1] && son[0] === 'b1 o2', son.join(' | '));
  }

  // ---------- makas ----------
  {
    const MAKAS = { t: 60, hint: ['', ''], map: ['.....', 'rr...', '.....', '.....'], molds: ['.....', '...x.', '.....', 'R...R'] };
    const o = await ac(); await o.kur(MAKAS);
    await o.basla(1, 1); await o.gotur(2, 1, 150); await o.page.waitForTimeout(500);   // makasın önünde durur, itmez
    const bekle = await o.d(), kon = await o.page.evaluate(() => window.__hamur.oyun.st.pieces[0].cells.map(c => c[0]).sort().join(''));
    await o.gotur(2, 1, 60, .75, 0); await o.page.waitForTimeout(120); const dolarken = await o.page.evaluate(() => window.__hamur.oyun.kesim);
    await shot(o.page, 'makas'); await o.page.waitForTimeout(400);
    const s = await o.d(), tut = await o.page.evaluate(() => !!window.__hamur.oyun.drag);
    check('makas.oyun.dur', 'Makasın önünde duran parça kesilmez (kararsız parmak kesmez)', bekle.n === 1 && kon === '12', `${bekle.n} parça, sütunlar ${kon}`);
    check('makas.oyun.it', 'Makasa doğru itince ölçü dolar, parça kesilir ve sürükleme biter', dolarken > 0 && dolarken < 1 && s.n === 2 && s.boy === '11' && !tut && s.durum === 'play' && s.geriVar, `ölçü ${dolarken && dolarken.toFixed(2)} · ${s.n} parça`);
    await o.birak(); await o.page.click('#undo'); await o.page.waitForTimeout(150);
    const g = await o.d();
    check('makas.oyun.geri', 'Kesim geri alınabilir', g.n === 1 && g.boy === '2', `${g.n} parça`);
    await o.ctx.close();
  }

  // ---------- baştan sona bir bölüm ----------
  {
    const o = await ac({ save: { level: 1 } });
    await o.basla(0, 1); await o.gotur(3, 1, 250); await o.birak(); await o.page.waitForTimeout(150);
    const yapisti = await o.d();
    await o.basla(3, 1); await o.gotur(1, 1, 200); await o.gotur(1, 3, 200); await o.birak(); await o.page.waitForTimeout(1100);
    const s = await o.d(), kayit = await getSave(o.page), tost = await o.page.evaluate(() => document.getElementById('tost').hidden ? '' : document.getElementById('tost').textContent);
    await shot(o.page, 'kazan');
    check('oyun.bolum1', '1. bölüm parmakla çözülür: yapıştır, kalıba oturt, bölüm tamam', yapisti.n === 1 && s.n === 0 && s.durum === 'won' && !s.ov && /tamam/.test(tost) && kayit.done?.includes(1) && kayit.wins === 1 && !o.errors.length, o.errors[0] || `${s.durum} · "${tost}"`);
    await o.page.waitForTimeout(1500);   // düğmeye basmadan: tahta kayar, sıradaki bölüm gelir
    const b2 = await o.page.evaluate(() => [window.__hamur.oyun.bolum, window.__hamur.oyun.durum, document.getElementById('ov').hidden && document.getElementById('tost').hidden]);
    check('oyun.sonraki', 'Bölüm bitince menü açılmadan sıradaki bölüm gelir', b2[0] === 2 && b2[1] === 'play' && b2[2] === true, b2.join(' · '));
    await o.ctx.close();
  }

  // ---------- kazanç kaydı ve deneme bölümü ----------
  {
    const o = await ac({ save: { level: 1 } });
    await o.basla(0, 1); await o.gotur(3, 1, 250); await o.birak(); await o.page.waitForTimeout(150);
    await o.basla(3, 1); await o.gotur(1, 1, 200); await o.gotur(1, 3, 200); await o.birak(); await o.page.click('#retry'); await o.page.waitForTimeout(1200);   // bindirme gelmeden Baştan
    const k = await getSave(o.page);
    check('oyun.kazanc', 'Kazanç tahta boşaldığı an kaydedilir (bindirme gelmeden Baştan ya da başka bölüme geçilse de)', k.done?.includes(1) && k.wins === 1, JSON.stringify({ done: k.done, wins: k.wins }));
    await o.ctx.close();
    const d = await ac({ save: { level: 37, done: [1, 2], wins: 3 } }); await d.kur({ t: 30, hint: ['', ''], map: ['r..', '...'], molds: ['..R', '...'] });
    await d.basla(0, 0); await d.gotur(2, 0, 200); await d.birak(); await d.page.waitForTimeout(1500);
    const ov = await d.d(); await d.page.click('#ovB'); await d.page.waitForTimeout(200);
    const k2 = await getSave(d.page), b = await d.page.evaluate(() => window.__hamur.oyun.bolum);
    check('oyun.deneme', 'Deneme bölümü kazanılınca ilerlemeye dokunmaz ve yeniden aynı bölümü açar', /Deneme/.test(ov.ov) && k2.level === 37 && k2.wins === 3 && k2.done.length === 2 && b > 60, `"${ov.ov}" · kayıt bölüm ${k2.level} · açık bölüm ${b}`);
    await d.ctx.close();
  }

  // ---------- çıkmaz + geri alma ----------
  {
    const o = await ac(); await o.kur(PROTO[3]);
    await o.basla(0, 0); await o.gotur(1, 0, 150); await o.birak(); await o.page.waitForTimeout(300);
    const hemen = await o.d(); await o.page.waitForTimeout(1500); const sonra = await o.d();
    await shot(o.page, 'cikmaz');
    const uyari = await o.page.evaluate(() => document.getElementById('tost').textContent);
    check('oyun.cikmaz', 'Çıkmazda bölüm bitmez: haber verilir, oyun süre bitene kadar sürer', hemen.durum === 'play' && hemen.boy === '1112' && sonra.durum === 'play' && !sonra.ov && /Çıkmaz/.test(uyari), `${hemen.durum} · "${uyari}"`);
    const iki = true;
    await o.page.click('#undo'); await o.page.waitForTimeout(200);
    const s = await o.d();
    check('oyun.geri', 'Geri al: yapışmanın olduğu sürüklemenin başına döner, bölüm sürer; hak bir kez', iki && s.durum === 'play' && s.boy === '11111' && s.geri === 0 && !s.btn && !s.ov, `${s.durum} · parçalar ${s.boy} · kalan hak ${s.geri}`);
    // ikinci yanlışta geri alma yok (stok boşken; stok varsa oradan harcanır: bkz. güçlendirici testleri)
    await o.page.evaluate(() => { window.__hamur.save.bst = { geri: 0, sure: 0, makas: 0 }; });
    await o.basla(0, 0); await o.gotur(1, 0, 150); await o.birak(); await o.page.waitForTimeout(1800);
    const iki2 = await o.page.evaluate(() => [window.__hamur.oyun.durum, document.getElementById('ovB2').hidden]);
    const kapali = await o.page.evaluate(() => document.getElementById('undo').disabled);
    check('oyun.geri.tek', 'Hak bitince ikinci yanlışta geri al kapalıdır; oyun yine sürer', iki2[0] === 'play' && kapali === true, iki2[0] + ' · geri al kapalı: ' + kapali);
    await o.ctx.close();
  }
  {
    const o = await ac({ save: { level: 1 } });
    await o.basla(0, 1); await o.gotur(1, 1, 100); await o.birak();
    await o.page.evaluate(() => { window.__hamur.oyun.sure = .2; }); await o.page.waitForTimeout(500);
    const s = await o.d();
    check('oyun.sure', 'Süre ilk dokunuşta başlar; bitince bölüm kaybedilir', s.durum === 'lost' && !!s.ov, `${s.durum} · "${s.ov}"`);
    // süre bittikten sonra geri al kullanılamaz: hak harcanmaz
    const z = await ac(); await z.kur({ t: 60, hint: ['', ''], map: ['....', 'r...', '..r.'], molds: ['...R', '...R', '....'] });
    await z.basla(0, 1); await z.gotur(2, 1, 150); await z.birak(); await z.page.waitForTimeout(150);
    const once = await z.d(); await z.page.evaluate(() => { window.__hamur.oyun.sure = .1; }); await z.page.waitForTimeout(500);
    const dugme = await z.page.evaluate(() => document.getElementById('undo').disabled); await z.page.evaluate(() => window.__hamur.oyun.geriAl()); await z.page.waitForTimeout(200);
    const sonra = await z.d();
    check('oyun.sure.geri', 'Süre bitince geri al kapanır, hak harcanmaz, tahta geri sarılmaz', once.geriVar && dugme === true && sonra.durum === 'lost' && sonra.boy === '2' && sonra.geri === 1, `düğme kapalı ${dugme} · parçalar ${sonra.boy} · hak ${sonra.geri}`);
    await z.ctx.close();
    // aynı bölümde üç kayıp → sıradaki denemede 10 sn fazla; kazanınca sayaç silinir
    const u = await ac({ save: { level: 1, fails: { 1: 2 } } });
    await u.basla(0, 1); await u.gotur(1, 1, 100); await u.birak(); await u.page.evaluate(() => { window.__hamur.save.bst = { geri: 0, sure: 0, makas: 0 }; window.__hamur.oyun.sure = .1; }); await u.page.waitForTimeout(500);
    const metin = await u.page.evaluate(() => document.getElementById('ovP').textContent); await u.page.evaluate(() => { const b2 = document.getElementById('ovB2'); (b2.hidden ? document.getElementById('ovB') : b2).click(); }); await u.page.waitForTimeout(150);   // "Tekrar dene": reklam varsa ikinci düğmedir
    const yeni = await u.page.evaluate(() => window.__hamur.oyun.sure), ks = await getSave(u.page);
    check('oyun.eksure', 'Aynı bölümde üç kez kaybedince sıradaki denemede 10 saniye eklenir; kayıp penceresinde yazı yoktur', yeni === 40 && ks.fails?.[1] === 3 && metin === '', `${yeni} sn · "${metin}"`);
    await u.ctx.close();
    const bekle = await ac({ save: { level: 1 } }); await bekle.page.waitForTimeout(600);
    const t = await bekle.page.evaluate(() => window.__hamur.oyun.sure);
    check('oyun.sure.bekle', 'Dokunmadan önce süre işlemez', t === 30, t + ' sn');
    await bekle.ctx.close(); await o.ctx.close();
  }

  // ---------- boya damlası, kilitli kalıp, kırılgan zemin (parmakla) ----------
  {
    const renk = o => o.page.evaluate(() => window.__hamur.oyun.st.pieces.map(p => p.color).join(''));
    let o = await ac(); await o.kur({ t: 60, hint: ['', ''], map: ['r....', '.....'], molds: ['..b..', '....B'] });
    await o.basla(0, 0); await o.gotur(2, 0, 200); await o.gotur(3, 0, 200); await o.birak(); await o.page.waitForTimeout(150);
    const gecti = await renk(o);                                    // üstünden geçti: boyanmaz
    await o.basla(3, 0); await o.gotur(2, 0, 200); await o.birak(); await o.page.waitForTimeout(150);
    const kaldi = await renk(o), damla = await o.page.evaluate(() => window.__hamur.oyun.st.boya[0].open);
    await o.basla(2, 0); await o.gotur(2, 1, 150); await o.gotur(4, 1, 250); await o.birak(); await o.page.waitForTimeout(700);
    const s = await o.d();
    check('boya.oyun', 'Boya damlası: üstünden geçen boyanmaz, üstünde bırakılan boyanır ve kalıbına oturur', gecti === 'r' && kaldi === 'b' && damla === false && s.n === 0 && s.durum === 'won', `${gecti} → ${kaldi}, ${s.n} parça, ${s.durum}`);
    await o.ctx.close();

    o = await ac(); await o.kur({ t: 60, hint: ['', ''], map: ['r...b', '.....', '.....'], molds: ['.....', '.....', 'R...B'], kilit: [[0, 2]] });
    await o.basla(0, 0); await o.gotur(0, 2, 300); await o.birak(); await o.page.waitForTimeout(500);
    const kilitli = await o.d();
    await o.basla(4, 0); await o.gotur(4, 2, 300); await o.birak(); await o.page.waitForTimeout(900);
    const acik = await o.d();
    check('kilit.oyun', 'Kilitli kalıba parça oturmaz; başka kalıp dolunca açılır ve üstünde bekleyen parça oturur', kilitli.n === 2 && kilitli.durum === 'play' && acik.n === 0 && acik.durum === 'won', `${kilitli.n} parça → ${acik.n} parça, ${acik.durum}`);
    await o.ctx.close();

    o = await ac(); await o.kur({ t: 60, hint: ['', ''], map: ['r...', '....'], molds: ['....', '...R'], kirik: [[1, 0], [2, 0]] });
    const z = () => o.page.evaluate(() => window.__hamur.oyun.st.kirik.map(z => z.open ? 1 : 0).join(''));
    await o.basla(0, 0); await o.gotur(1, 0, 200); await o.gotur(2, 0, 200); await o.birak(); await o.page.waitForTimeout(150);
    const gecince = await z();                                      // 1. karenin üstünden geçti, 2.'de kaldı: ikisi de sağlam
    await o.basla(2, 0); await o.gotur(2, 1, 200); await o.birak(); await o.page.waitForTimeout(150);
    const ayrilinca = await z();                                    // kaldığı kareden ayrıldı: o kare çöker
    await o.basla(2, 1); await o.gotur(2, 0, 250); await o.birak(); await o.page.waitForTimeout(150);
    const yer = await o.page.evaluate(() => window.__hamur.oyun.st.pieces[0].cells[0].join(','));
    check('kirik.oyun', 'Kırılgan zemin: geçince sağlam kalır, üstünde kalıp ayrılınca çöker ve geçit kapanır', gecince === '11' && ayrilinca === '10' && yer === '2,1', `${gecince} → ${ayrilinca}, parça ${yer}`);
    await o.ctx.close();
  }
};
