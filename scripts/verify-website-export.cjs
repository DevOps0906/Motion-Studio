process.env.VERIFY_BASE??=process.env.WEBSITE_QA_URL||'http://127.0.0.1:4110';const {authorizePage}=require('./verify-session.cjs');// Temporary QA records only. Downloaded HTML and screenshots are retained in out/qa.
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {randomUUID} = require('node:crypto');
const assert = require('node:assert/strict');
const {openBrowser} = require('@remotion/renderer');
const base = process.env.VERIFY_BASE;
const title = `Export QA ${randomUUID()}`;
let id, assetId, browser;
async function json(url, options) {
  const response = await fetch(base + url, options);
  const body = await response.json();
  assert.ok(response.ok, JSON.stringify(body));
  return body;
}
async function wait(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Export QA wait timeout');
}
(async () => {
  try {
    const upload = new FormData();
    upload.set('file', new Blob([await fs.readFile('public/photos/02.jpg')], {type: 'image/jpeg'}), 'export-qa.jpg');
    assetId = (await json('/api/media', {method: 'POST', body: upload})).id;
    const brief = {title, brand: 'MOTION ATELIER', headline: '브랜드의 다음 장면', description: '가져온 사진으로 구성한 독립 웹페이지입니다.',
      audience: '새로운 경험을 준비하는 브랜드', referenceUrl: 'https://example.com/reference', ctaLabel: '문의하기',
      services: ['브랜드 전략', '디지털 경험', '콘텐츠 제작'], theme: 'light', accent: '#c4b5fd', heroImageId: assetId,
      sections: [{id: 'about', enabled: true}, {id: 'services', enabled: true}, {id: 'contact', enabled: true}],
      aboutHeading: '우리의 이야기', aboutBody: '이 소개는 숨길 예정입니다.', contactHeading: '함께 새로운 경험을 만드세요.', contactText: '프로젝트 이야기를 들려주세요.', contactUrl: 'https://example.com/contact'};
    id = (await json('/api/websites', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(brief)})).id;
    assert.equal((await fetch(base + '/api/websites/not-found/export')).status, 404);
    browser = await openBrowser('chrome', {browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', chromiumOptions: {headless: true}});
    const logs = [];
    const page = await browser.newPage({context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: log => logs.push(log), onLog: () => {}});await authorizePage(page);
    await page.setViewport({width: 1440, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false});
    await page.goto({url: base + '/websites/editor/basic', timeout: 60000});
    await wait(() => page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).some(b => b.textContent.includes(name)), title));
    await page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).find(b => b.textContent.includes(name)).click(), title);
    await wait(() => page.evaluate(() => document.querySelectorAll('[data-website-section]').length === 3));
    await page.evaluate(() => document.querySelector('[data-section-editor=about] input').click());
    await wait(() => page.evaluate(() => !document.querySelector('#website-about')));
    assert.equal(await page.evaluate(() => document.querySelector('.website-export-button').disabled), true);
    await page.evaluate(() => document.querySelector('[data-section-editor=contact] button[aria-label$="위로"]').click());
    await page.evaluate(() => document.querySelector('[data-section-editor=contact] button[aria-label$="위로"]').click());
    await wait(() => page.evaluate(() => Array.from(document.querySelectorAll('[data-website-section]')).map(el => el.dataset.websiteSection).join(',') === 'contact,services'));
    await page.evaluate(() => document.querySelector('.website-brief button[type=submit]').click());
    await wait(() => page.evaluate(() => document.querySelector('.save-state').textContent === '저장됨'));
    const saved = await json(`/api/websites/${id}`);
    assert.equal(saved.sections.filter(s => s.enabled).map(s => s.id).join(','), 'contact,services');
    const exported = await fetch(`${base}/api/websites/${id}/export`);
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-disposition'), /attachment; filename="motion-studio-/);
    const html = await exported.text();
    assert.ok(html.includes('src="data:image/jpeg;base64,'));
    assert.ok(!html.includes('/api/media/'));
    assert.ok(!html.includes('id="website-about"'));
    assert.ok(html.indexOf('id="website-contact"') < html.indexOf('id="website-services"'));
    await fs.mkdir('out/qa', {recursive: true});
    const downloadDir = path.resolve('out/qa/website-downloads');
    await fs.mkdir(downloadDir, {recursive: true});
    await page._client().send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadDir});
    await page.evaluate(() => document.querySelector('.website-export-button').click());
    const downloadedFile = path.join(downloadDir, `motion-studio-${id}.html`);
    await wait(async () => {try { return (await fs.readFile(downloadedFile, 'utf8')) === html; } catch { return false; }});
    await wait(() => page.evaluate(() => !document.querySelector('.website-export-button').disabled));
    // Reload and reopen to confirm persisted order and visibility.
    await page.goto({url: base + '/websites/editor/basic', timeout: 60000});
    await wait(() => page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).some(b => b.textContent.includes(name)), title));
    await page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).find(b => b.textContent.includes(name)).click(), title);
    await wait(() => page.evaluate(() => Array.from(document.querySelectorAll('[data-website-section]')).map(el => el.dataset.websiteSection).join(',') === 'contact,services'));
    // Open the actual download with networking disabled.
    await page._client().send('Network.enable');
    await page._client().send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
    await page.goto({url: pathToFileURL(downloadedFile).href, timeout: 60000});
    await wait(() => page.evaluate(() => document.querySelector('.website-cover').complete && document.querySelector('.website-cover').naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.querySelector('h1').textContent), brief.headline);
    assert.equal(await page.evaluate(() => document.querySelectorAll('script,link[rel=stylesheet]').length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => document.querySelector('.website-hero .website-cta').href), brief.contactUrl);
    let shot = await page._client().send('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile('out/qa/website-export-desktop.png', Buffer.from(shot.value.data, 'base64'));
    await page.setViewport({width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.website-hero')).gridTemplateColumns.split(' ').length), 1);
    shot = await page._client().send('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile('out/qa/website-export-mobile.png', Buffer.from(shot.value.data, 'base64'));
    await fs.writeFile('out/qa/website-export-result.json', JSON.stringify({sectionReorder: true, visibility: true, reopen: true, uiDownload: true, offlineFile: true, embeddedImage: true, mobileOverflow: false, logs}, null, 2));
    console.log('PASS: section reorder/hide/save/reopen, actual HTML download, offline embedded image and desktop/mobile output');
  } finally {
    if (browser) await browser.close({silent: true});
    if (id) {assert.match(id, /^[a-zA-Z0-9-]{1,80}$/); await fs.unlink(path.join('.local-data', 'websites', id + '.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});}
    if (assetId) await json(`/api/media/${assetId}`, {method: 'DELETE'});
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
