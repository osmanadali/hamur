// Ekran testleri: ana ekran, bölüm yolu, tepsi koleksiyonu, ayarlar, renk damgaları.
'use strict';
module.exports = async ({ browser, URL, open, shot, getSave, inViewport, check }) => {
  const ANA = 'window.__anaEkran = 1;', on = n => Array.from({ length: n }, (_, i) => i + 1);
  const acik = p => p.evaluate(() => window.__hamur.ekran.acik);
  {
    const { ctx, page, errors } = await open(browser, URL, { init: ANA, save: { done: on(14), level: 15 } });
    const a = await acik(page), no = await page.textContent('#oynaNo');
    await shot(page, 'ekran-ana');
    check('ekran.ana', 'Uygulama ana ekranda açılır; Oyna düğmesi sıradaki bölümü gösterir', a === 'ana' && /15/.test(no) && !errors.length, errors[0] || `${a} · "${no}"`);
    await page.click('#bOyna'); await page.waitForTimeout(400);
    const o = await page.evaluate(() => [window.__hamur.ekran.acik, window.__hamur.oyun.bolum, window.__hamur.oyun.cell > 30]);
    check('ekran.oyna', 'Oyna sıradaki bölümü açar ve tahta ekrana yerleşir', o.join() === 'oyun,15,true', o.join(' · '));
    await page.click('#bCik'); await page.waitForTimeout(500);
    const y = await page.evaluate(() => { const d = [...document.querySelectorAll('.durak')], say = c => d.filter(x => x.classList.contains(c)).length, s = document.querySelector('.durak.siradaki'), r = s.getBoundingClientRect(), e = document.getElementById('yol').getBoundingClientRect();
      return { acik: window.__hamur.ekran.acik, toplam: d.length, tamam: say('tamam'), sira: s.dataset.no, kilitli: say('kilitli'), kilitKapali: d.filter(x => x.classList.contains('kilitli')).every(x => x.disabled), gorunur: r.top >= e.top && r.bottom <= e.bottom }; });
    await shot(page, 'ekran-yol');
    check('ekran.yol', 'Bölüm yolu: biten bölümler işaretli, sıradaki bölüm ortada ve parlıyor, sonrakiler kilitli', y.acik === 'yol' && y.toplam === 66 && y.tamam === 14 && y.sira === '15' && y.kilitli === 66 - 15 && y.kilitKapali && y.gorunur, JSON.stringify(y));
    await page.click('.durak[data-no="7"]'); await page.waitForTimeout(400);
    const b = await page.evaluate(() => [window.__hamur.ekran.acik, window.__hamur.oyun.bolum]);
    check('ekran.yol.sec', 'Yoldan biten bir bölüme dokununca o bölüm açılır', b.join() === 'oyun,7', b.join(' · '));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, URL, { init: ANA, save: { done: on(14), level: 15 } });
    await page.click('#bTepsi'); await page.waitForTimeout(300);
    const t = await page.evaluate(() => [...document.querySelectorAll('.figur')].map(f => (f.classList.contains('tamam') ? 'T' : '') + f.querySelector('small').textContent).join(' | '));
    await shot(page, 'ekran-tepsi');
    check('ekran.tepsi', 'Tepsi: her 10 bölümde bir figür tamamlanır, yarım figür kaç bölüm kaldığını gösterir', /^T/.test(t) && t.includes('4 / 10') && t.split('|').length === 6, t);
    await page.click('#tepsiGeri'); await page.click('#bAyar'); await page.waitForTimeout(200);
    await page.click('#sec-damga'); await page.click('#sec-hepsiAcik');
    const k = await getSave(page); await shot(page, 'ekran-ayar');
    check('ekran.ayar', 'Ayarlar: renk damgaları ve test seçeneği açılıp kapanır, kalıcıdır', k.damga === true && k.hepsiAcik === true, JSON.stringify({ damga: k.damga, hepsiAcik: k.hepsiAcik }));
    await page.click('#ayarKapat'); await page.click('#bYol'); await page.waitForTimeout(300);
    const kilit = await page.evaluate(() => document.querySelectorAll('.durak.kilitli:not(.yok)').length);
    check('ekran.hepsi', '"Bütün bölümler açık" seçilince yolda kilitli bölüm kalmaz', kilit === 0, kilit + ' kilitli');
    await page.click('.durak[data-no="45"]'); await page.waitForTimeout(600); await shot(page, 'ekran-damga');
    await ctx.close();
  }
  {
    // dar ekran: düğmeler ekrana sığar
    const { ctx, page, errors } = await open(browser, URL, { init: ANA, vp: [320, 568] });
    const f = [await inViewport(page, '#bOyna'), await inViewport(page, '#bYol'), await inViewport(page, '#bTepsi'), await inViewport(page, '#bAyar')];
    await shot(page, 'ekran-ana-320');
    check('ekran.dar', '320 px ekranda ana ekranın bütün düğmeleri görünür', f.every(x => x.ok) && !errors.length, errors[0] || f.map(x => x.ok ? '✓' : '✗').join(''));
    await ctx.close();
  }
  {
    // 10. bölüm bitince figür kutlaması
    const { ctx, page } = await open(browser, URL, { save: { done: on(9), level: 10 } });
    const ad = await page.evaluate(() => { const s = window.__hamur.save; s.done = [...s.done, 10]; return window.__hamur.oyun.figurAdi(10)?.ad; });
    check('ekran.figur', '10. bölüm bitince tamamlanan figür kutlanır', ad === 'Kedi', String(ad));
    await ctx.close();
  }
  {
    // Açılış animasyonu: olağan açılışta kendiliğinden oynar ve ana ekrana geçer; dokununca hemen geçilir
    const AC = 'window.__anaEkran = 1; window.__acilisTest = 1;';
    const { ctx, page, errors } = await open(browser, URL, { init: AC, save: { done: on(3), level: 4 } });
    const ilkKare = await page.evaluate(() => { const a = document.getElementById('acilis'); return !!a && getComputedStyle(a).backgroundColor; });
    await page.waitForTimeout(2600);
    const son = await page.evaluate(() => [!document.getElementById('acilis'), window.__hamur.ekran.acik]);
    check('acilis.olagan', 'Açılış animasyonu oynar (ilk kare düz #c59af1), sonra ana ekran açılır', ilkKare === 'rgb(197, 154, 241)' && son.join() === 'true,ana' && !errors.length, errors[0] || `${ilkKare} · ${son.join(' · ')}`);
    await page.reload(); await page.waitForTimeout(250); await page.mouse.click(195, 300); await page.waitForTimeout(500);
    const gec = await page.evaluate(() => !document.getElementById('acilis'));
    check('acilis.gec', 'Açılışa dokununca animasyon geçilir', gec, String(gec));
    await ctx.close();
  }
  {
    // İlk açılış: animasyon kendiliğinden oynamaz; oyuncu maviyi sarıya sürükler, sonra 1. bölüm başlar
    const { ctx, page, errors } = await open(browser, URL, { init: 'window.__anaEkran = 1; window.__acilisTest = 1;' });
    await page.waitForTimeout(2600);
    const bekler = await page.evaluate(() => [!!document.getElementById('acilis'), document.querySelector('#acilis p')?.textContent]);
    const vp = page.viewportSize(), x = vp.width / 2 - 70 - 105 + 35, y = vp.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(x + i * 9, y); await page.waitForTimeout(16); } await page.mouse.up();
    await page.waitForTimeout(2200);
    const son = await page.evaluate(() => [!document.getElementById('acilis'), window.__hamur.ekran.acik, window.__hamur.oyun.bolum]);
    check('acilis.ilk', 'İlk açılışta animasyon bekler; mavi sarıya sürüklenince karışır ve 1. bölüm başlar', bekler[0] && !!bekler[1] && son.join() === 'true,oyun,1' && !errors.length, errors[0] || `${bekler.join(' · ')} → ${son.join(' · ')}`);
    await ctx.close();
  }
  {
    // Bekleme göstergesi: kısa işte görünmez, 500 ms'yi geçince hamur şeridi çıkar, iş bitince kalkar
    const { ctx, page } = await open(browser, URL, { init: 'window.__anaEkran = 1;' });
    const r = await page.evaluate(async () => { const B = window.__hamur.bekle, el = document.getElementById('bekle'), bek = ms => new Promise(f => setTimeout(f, ms));
      await B.sar(bek(120)); const kisa = el.hidden; const p = B.sar(bek(900)); await bek(700); const uzun = !el.hidden && el.className; await p; return [kisa, uzun, el.hidden].join(); });
    check('bekle', 'Bekleme: kısa işte gösterge çıkmaz; 500 ms geçince hamur şeridi çıkar, bitince kalkar', r === 'true,bekle b-serit,true', r);
    await ctx.close();
  }
};
