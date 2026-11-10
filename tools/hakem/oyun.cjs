// Oyun testleri (gerçek tarayıcı, parmak hareketi): niyet okuma, kalıba oturma, çıkmaz, geri alma, süre.
'use strict';
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

  // ---------- baştan sona bir bölüm ----------
  {
    const o = await ac({ save: { level: 1 } });
    await o.basla(0, 1); await o.gotur(3, 1, 250); await o.birak(); await o.page.waitForTimeout(150);
    const yapisti = await o.d();
    await o.basla(3, 1); await o.gotur(1, 1, 200); await o.gotur(1, 3, 200); await o.birak(); await o.page.waitForTimeout(1500);
    const s = await o.d(), kayit = await getSave(o.page);
    await shot(o.page, 'kazan');
    check('oyun.bolum1', '1. bölüm parmakla çözülür: yapıştır, kalıba oturt, bölüm tamam', yapisti.n === 1 && s.n === 0 && s.durum === 'won' && !!s.ov && kayit.done?.includes(1) && kayit.wins === 1 && !o.errors.length, o.errors[0] || `${s.durum} · "${s.ov}"`);
    await o.page.click('#ovB'); await o.page.waitForTimeout(200);
    const b2 = await o.page.evaluate(() => [window.__hamur.oyun.bolum, window.__hamur.oyun.durum, document.getElementById('ov').hidden]);
    check('oyun.sonraki', 'Bölüm bitince menü açılmadan sıradaki bölüm gelir', b2[0] === 2 && b2[1] === 'play' && b2[2] === true, b2.join(' · '));
    await o.ctx.close();
  }

  // ---------- çıkmaz + geri alma ----------
  {
    const o = await ac({ save: { level: 4 } });
    await o.basla(0, 0); await o.gotur(1, 0, 150); await o.birak(); await o.page.waitForTimeout(300);
    const hemen = await o.d(); await o.page.waitForTimeout(1500); const sonra = await o.d();
    await shot(o.page, 'cikmaz');
    check('oyun.cikmaz', '4. bölümde yan yana yapışan kırmızılar anında çıkmaz sayılır ve neden gösterilir', hemen.durum === 'lost' && hemen.boy === '1112' && !!sonra.ov, `${hemen.durum} · "${sonra.ov}"`);
    const iki = await o.page.evaluate(() => !document.getElementById('ovB2').hidden);
    await o.page.click('#ovB'); await o.page.waitForTimeout(200);
    const s = await o.d();
    check('oyun.geri', 'Geri al: yapışmanın olduğu sürüklemenin başına döner, bölüm sürer; hak bir kez', iki && s.durum === 'play' && s.boy === '11111' && s.geri === 0 && !s.btn && !s.ov, `${s.durum} · parçalar ${s.boy} · kalan hak ${s.geri}`);
    // ikinci yanlışta geri alma yok
    await o.basla(0, 0); await o.gotur(1, 0, 150); await o.birak(); await o.page.waitForTimeout(1800);
    const iki2 = await o.page.evaluate(() => [window.__hamur.oyun.durum, document.getElementById('ovB2').hidden]);
    check('oyun.geri.tek', 'İkinci yanlış yapışmada geri alma önerilmez', iki2[0] === 'lost' && iki2[1] === true, iki2.join(' · '));
    await o.ctx.close();
  }
  {
    const o = await ac({ save: { level: 1 } });
    await o.basla(0, 1); await o.gotur(1, 1, 100); await o.birak();
    await o.page.evaluate(() => { window.__hamur.oyun.sure = .2; }); await o.page.waitForTimeout(500);
    const s = await o.d();
    check('oyun.sure', 'Süre ilk dokunuşta başlar; bitince bölüm kaybedilir', s.durum === 'lost' && !!s.ov, `${s.durum} · "${s.ov}"`);
    const bekle = await ac({ save: { level: 1 } }); await bekle.page.waitForTimeout(600);
    const t = await bekle.page.evaluate(() => window.__hamur.oyun.sure);
    check('oyun.sure.bekle', 'Dokunmadan önce süre işlemez', t === 30, t + ' sn');
    await bekle.ctx.close(); await o.ctx.close();
  }
};
