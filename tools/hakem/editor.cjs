// Bölüm editörü testleri: hazır bölümü açar, çözdürür, çizer, dışa aktarır, oyunda dener.
'use strict';
const path = require('path');
module.exports = async ({ browser, serve, check }) => {
  const s = await serve(path.join(__dirname, '..', '..')), U = `http://127.0.0.1:${s.address().port}`;
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(U + '/tools/editor/');
  await page.selectOption('#hazir', '14'); await page.click('#coz'); await page.waitForFunction(() => window.__editor.rap, null, { timeout: 15000 });
  const r = await page.evaluate(() => { const r = window.__editor.rap; return { ok: r.cozuldu, hamle: r.hamle, sure: r.sure, metin: document.getElementById('rapor').textContent }; });
  check('editor.coz', 'Editör hazır bölümü tek tuşla çözer; hamle, zorluk puanı ve önerilen süre görünür', r.ok && r.hamle === 4 && /Zorluk puanı/.test(r.metin) && r.metin.includes(r.sure + ' sn') && !errors.length, errors[0] || `${r.hamle} hamle · ${r.sure} sn`);
  await page.click('#ileri'); await page.click('#ileri');
  const oynat = await page.evaluate(() => [document.querySelectorAll('#yol li[aria-current=true]').length, document.querySelectorAll('.board .no').length]);
  check('editor.oynat', 'Çözüm hamle hamle tahtada izlenir', oynat[0] === 1 && oynat[1] > 0, oynat.join(' · '));
  // boş tahtaya çiz: iki kırmızı, bir çift kalıp
  await page.selectOption('#hazir', '-1'); await page.fill('#en', '4'); await page.dispatchEvent('#en', 'change'); await page.fill('#boy', '2'); await page.dispatchEvent('#boy', 'change');
  const tik = async (k, x, y) => { await page.click(`.tool[data-k="${k}"]`); await page.click(`.cell[data-x="${x}"][data-y="${y}"]`); };
  await tik('r', 0, 0); await tik('r', 3, 0); await tik('R', 1, 1); await tik('R', 2, 1); await tik('#', 1, 0); await tik('.', 1, 0);
  const L = await page.evaluate(() => JSON.parse(document.getElementById('json').value));
  await page.click('#coz'); await page.waitForFunction(() => window.__editor.rap, null, { timeout: 15000 });
  const r2 = await page.evaluate(() => window.__editor.rap.cozuldu && window.__editor.rap.hamle);
  check('editor.ciz', 'Çizilen bölüm dosyaya yazılır ve çözülür', L.map.join('/') === 'r..r/....' && L.molds.join('/') === '..../.RR.' && r2 === 2, `${L.map.join('/')} · ${L.molds.join('/')} · ${r2} hamle`);
  await page.click('#oner');
  const [p2] = await Promise.all([ctx.waitForEvent('page'), page.click('#dene')]);
  await p2.waitForFunction(() => window.__hamur?.oyun?.st, null, { timeout: 10000 });
  const oyun = await p2.evaluate(() => { const O = window.__hamur.oyun; return [O.st.W, O.st.H, O.st.pieces.length, O.bolum > 60, JSON.parse(localStorage.getItem('hamur') || '{}').level || 1]; });
  check('editor.dene', '"Oyunda dene" bölümü oyunda açar, ilerlemeye yazmaz', oyun.join() === '4,2,2,true,1', oyun.join(' · '));
  await ctx.close(); s.close();
};
