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
    await page.click('#bCik'); await page.waitForTimeout(400);
    const cik = await acik(page); check('ekran.cik', 'Oyundan çıkınca ana ekrana dönülür', cik === 'ana', cik);
    await page.click('#bYol'); await page.waitForTimeout(500);
    const y = await page.evaluate(() => { const d = [...document.querySelectorAll('.durak')], say = c => d.filter(x => x.classList.contains(c)).length, s = document.querySelector('.durak.siradaki'), r = s.getBoundingClientRect(), e = document.getElementById('yol').getBoundingClientRect();
      return { acik: window.__hamur.ekran.acik, toplam: d.length, tamam: say('tamam'), sira: s.dataset.no, kilitli: say('kilitli'), kilitKapali: d.filter(x => x.classList.contains('kilitli')).every(x => x.disabled), gorunur: r.top >= e.top && r.bottom <= e.bottom }; });
    await shot(page, 'ekran-yol');
    check('ekran.yol', 'Bölüm yolu: biten bölümler işaretli, sıradaki bölüm ortada ve parlıyor, sonrakiler kilitli', y.acik === 'yol' && y.toplam % 11 === 0 && y.toplam >= 66 && y.tamam === 14 && y.sira === '15' && y.kilitli === y.toplam - 15 && y.kilitKapali && y.gorunur, JSON.stringify(y));
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
    check('ekran.tepsi', 'Tepsi: her 10 bölümde bir figür tamamlanır, yarım figür kaç bölüm kaldığını gösterir', /^T/.test(t) && t.includes('4 / 10') && t.split('|').length >= 15, t);
    await page.click('#bAna'); await page.click('#bAyar'); await page.waitForTimeout(200);
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
    await page.waitForTimeout(700); const orta = await page.evaluate(() => !!document.getElementById('acilis') && !document.getElementById('acilis').classList.contains('ac'));
    await page.waitForTimeout(3200);
    const son = await page.evaluate(() => [!document.getElementById('acilis'), window.__hamur.ekran.acik, document.getElementById('sAna').inert]);
    check('acilis.olagan', 'Açılış animasyonu oynar (ilk kare düz #c59af1), sonra ana ekran açılır', ilkKare === 'rgb(122, 92, 196)' && orta && son.join() === 'true,ana,false' && !errors.length, errors[0] || `${ilkKare} · ${son.join(' · ')}`);
    await page.reload(); await page.waitForTimeout(250);
    const o = await page.evaluate(() => { const r = document.getElementById('bOyna').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.touchscreen.tap(o[0], o[1]); await page.waitForTimeout(600);   // Oyna düğmesinin tam üstüne dokunulur: dokunuş alta geçmemeli
    const gec = await page.evaluate(() => [!document.getElementById('acilis'), window.__hamur.ekran.acik]);
    check('acilis.gec', 'Açılış dokununca geçilmez; dokunuş alttaki düğmeye de gitmez', gec.join() === 'false,ana', gec.join(' · ')); await page.waitForTimeout(2400);
    await page.click('#bYol'); await page.waitForTimeout(30); const g1 = await page.evaluate(() => document.querySelector('#gecis i').getAnimations().map(a => a.effect.getTiming().duration).join()); await page.waitForTimeout(400);
    const g2 = await page.evaluate(() => [document.querySelector('#gecis i').getAnimations().length, document.querySelector('#gecis i').getBoundingClientRect().right < 0, window.__hamur.ekran.acik]);
    check('gecis', 'Ekran geçişi: 360 ms un bulutu, bitince ekranda kalmaz', g1 === '360' && g2.join() === '0,true,yol', `${g1} · ${g2.join(' · ')}`);
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
  {
    // Duraklatma: süre durur, tahta gizlenir; devam edince kaldığı yerden sürer
    const { ctx, page, errors } = await open(browser, URL, { save: { level: 1 } });
    const tut = async () => { const g = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(), O = window.__hamur.oyun, q = O.st.pieces[0].cells[0]; return { x: r.left + O.PAD + (q[0] + .5) * O.cell, y: r.top + O.PAD + (q[1] + .5) * O.cell }; }); await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.up(); };
    await tut(); await page.waitForTimeout(300); await page.click('#duraklat'); await page.waitForTimeout(100);
    const d1 = await page.evaluate(() => ({ s: window.__hamur.oyun.sure, gizli: getComputedStyle(document.getElementById('cv')).visibility, kart: !document.getElementById('ov').hidden, durak: window.__hamur.oyun.durakta }));
    await page.waitForTimeout(700);
    const d2 = await page.evaluate(() => window.__hamur.oyun.sure);
    await shot(page, 'duraklat');
    await page.click('#ovB'); await page.waitForTimeout(400);
    const d3 = await page.evaluate(() => ({ s: window.__hamur.oyun.sure, gizli: getComputedStyle(document.getElementById('cv')).visibility, durak: window.__hamur.oyun.durakta }));
    check('duraklat', 'Duraklatınca süre durur ve tahta gizlenir; devam edince süre yeniden işler', d1.durak && d1.kart && d1.gizli === 'hidden' && d2 === d1.s && !d3.durak && d3.gizli === 'visible' && d3.s < d1.s && !errors.length, errors[0] || JSON.stringify([d1, d2, d3]));
    // +15 sn
    const once = await page.evaluate(() => [window.__hamur.oyun.sure, window.__hamur.oyun.stok.sure]); await page.click('#gSure'); await page.waitForTimeout(100);
    const sonra = await page.evaluate(() => [window.__hamur.oyun.sure, window.__hamur.oyun.stok.sure]);
    check('guc.sure', '+15 sn güçlendiricisi süreye 15 saniye ekler ve stoktan bir tane düşer', sonra[0] - once[0] > 14 && sonra[0] - once[0] < 15.5 && once[1] === 3 && sonra[1] === 2, `${once} → ${sonra}`);
    // makas: boş kareye konur, dolu kareye konmaz
    await page.click('#gMakas');
    const yer = async (x, y) => { const g = await page.evaluate(([x, y]) => { const r = document.getElementById('cv').getBoundingClientRect(), O = window.__hamur.oyun; return { x: r.left + O.PAD + (x + .5) * O.cell, y: r.top + O.PAD + (y + .5) * O.cell }; }, [x, y]); await page.mouse.click(g.x, g.y); };
    const p0 = await page.evaluate(() => window.__hamur.oyun.st.pieces[0].cells[0]);
    await yer(p0[0], p0[1]); const m0 = await page.evaluate(() => [window.__hamur.oyun.st.makas.length, window.__hamur.oyun.stok.makas]);
    await yer(2, 0); const m1 = await page.evaluate(() => [window.__hamur.oyun.st.makas.length, window.__hamur.oyun.stok.makas, document.getElementById('gMakas').getAttribute('aria-pressed')]);
    await shot(page, 'guc-makas');
    check('guc.makas', 'Makas güçlendiricisi: parçanın üstüne konmaz, boş kareye konur ve stoktan düşer', m0.join() === '0,3' && m1.join() === '1,2,false', `${m0} → ${m1}`);
    await ctx.close();
  }
  {
    // Renk tarifi: 21. bölümden itibaren düğme; basınca şerit açılır, dışına dokununca kapanır
    const { ctx, page } = await open(browser, URL, { save: { level: 21, done: on(20) } });
    const a = await page.evaluate(() => [document.getElementById('gTarif').hidden, document.getElementById('rx').hidden]);
    await page.click('#gTarif'); const b = await page.evaluate(() => { const r = document.getElementById('rx').getBoundingClientRect(); return [document.getElementById('rx').hidden, r.left >= 0 && r.right <= innerWidth && r.width > r.height * 3]; });
    await shot(page, 'tarif');
    await page.mouse.click(195, 300); const c = await page.evaluate(() => document.getElementById('rx').hidden);
    const ilk = await page.evaluate(() => { window.__hamur.oyun.setup(4); return document.getElementById('gTarif').hidden; });
    check('tarif', 'Renk tarifi düğmeyle açılan yatay şerittir; dışına dokununca kapanır; 21. bölümden önce düğme yoktur', a.join() === 'false,true' && b.join() === 'false,true' && c === true && ilk === true, `${a} · ${b} · ${c} · ${ilk}`);
    await ctx.close();
  }
  {
    // Geri alma: bölümün ücretsiz hakkı bitince stoktan harcanır
    const { ctx, page } = await open(browser, URL, { save: { level: 1 } });
    const r = await page.evaluate(() => { const O = window.__hamur.oyun; return [O.geriKalan, O.stok.geri, document.querySelector('#undo b').textContent]; });
    check('guc.geri.rozet', 'Geri al düğmesi ücretsiz hak ile stoğun toplamını gösterir', r.join() === '1,3,4', r.join());
    await ctx.close();
  }
};
