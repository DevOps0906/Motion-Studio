process.env.VERIFY_BASE??=process.env.WEBSITE_QA_URL||'http://127.0.0.1:4110';const {authorizePage}=require('./verify-session.cjs');// Creates temporary QA records; removes only those records in finally.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {openBrowser} = require('@remotion/renderer');
const base = process.env.VERIFY_BASE;
const title = `Website QA ${randomUUID()}`;
const created = [];
let assetId, browser;
async function json(url, options = {}) {
  const response = await fetch(base + url, options);
  return {status: response.status, body: await response.json()};
}
const payload = data => ({headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
async function wait(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Website UI wait timed out');
}
(async () => {
  try {
    const data = {title, brand: 'QA ATELIER', headline: 'A new chapter', description: '브랜드 소개와 테스트',
      audience: '브랜드 팀', referenceUrl: 'https://example.com/reference', ctaLabel: '서비스 보기',
      services: ['전략', '디자인'], theme: 'dark', accent: '#c4b5fd', heroImageId: ''};
    const upload = new FormData();
    upload.set('file', new Blob([await fs.readFile('public/photos/01.jpg')], {type: 'image/jpeg'}), 'website-qa.jpg');
    const asset = await json('/api/media', {method: 'POST', body: upload});
    assert.equal(asset.status, 201); assetId = asset.body.id;
    const saved = await json('/api/websites', {method: 'POST', ...payload({...data, heroImageId: assetId, id: 'forged', createdAt: 'forged'})});
    assert.equal(saved.status, 201); created.push(saved.body.id);
    assert.notEqual(saved.body.id, 'forged'); assert.notEqual(saved.body.createdAt, 'forged');
    const id = saved.body.id;
    assert.equal((await json(`/api/websites/${id}`)).body.referenceUrl, data.referenceUrl);
    assert.ok((await json('/api/websites')).body.some(p => p.id === id));
    const blocked = await json(`/api/media/${assetId}`, {method: 'DELETE'});
    assert.equal(blocked.status, 400); assert.match(blocked.body.error, /웹 프로젝트/);
    for (const patch of [{referenceUrl: 'javascript:alert(1)'}, {accent: 'url(bad)'}, {heroImageId: 'missing-asset'}, {services: []}]) {
      assert.equal((await json(`/api/websites/${id}`, {method: 'PATCH', ...payload({...data, ...patch})})).status, 400);
    }
    assert.equal((await json(`/api/websites/${id}`)).body.heroImageId, assetId);
    assert.equal((await json('/api/websites/qa-missing')).status, 404);
    assert.equal((await json('/api/websites/qa-missing', {method: 'PATCH', ...payload(data)})).status, 404);
    assert.equal((await fetch(base + '/api/websites', {method: 'POST', ...payload(data), headers: {'Content-Type': 'application/json', Origin: 'https://other.example'}})).status, 403);
    browser = await openBrowser('chrome', {browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', chromiumOptions: {headless: true}});
    const logs = [];
    const page = await browser.newPage({context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: log => logs.push(log), onLog: () => {}});await authorizePage(page);
    await page.setViewport({width: 1600, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false});
    await page.goto({url: base + '/websites/editor/basic', timeout: 60000});
    await wait(() => page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).some(b => b.textContent.includes(name)), title));
    await page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).find(b => b.textContent.includes(name)).click(), title);
    await wait(() => page.evaluate(() => document.querySelector('.website-brief input[name=title]').value.startsWith('Website QA')));
    // Exercise React's controlled input, preview update and save button.
    await page.evaluate(() => {
      const input = document.querySelector('.website-brief input[name=headline]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Updated from the editor');
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
    await wait(() => page.evaluate(() => document.querySelector('.website-preview h1').textContent === 'Updated from the editor'));
    await page.evaluate(() => document.querySelector('.website-brief button[type=submit]').click());
    await wait(async () => (await json(`/api/websites/${id}`)).body.headline === 'Updated from the editor');
    await wait(() => page.evaluate(() => document.querySelector('.save-state').textContent === '저장됨'));
    await wait(() => page.evaluate(() => Array.from(document.querySelectorAll('.website-cover')).every(img => img.complete && img.naturalWidth > 0)));
    await fs.mkdir('out/qa', {recursive: true});
    let shot = await page._client().send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    await fs.writeFile('out/qa/website-builder-desktop.png', Buffer.from(shot.value.data, 'base64'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewport({width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.website-hero')).gridTemplateColumns.split(' ').length), 1);
    shot = await page._client().send('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile('out/qa/website-builder-mobile.png', Buffer.from(shot.value.data, 'base64'));
    await page.goto({url: `${base}/websites/${id}`, timeout: 60000});
    assert.equal(await page.evaluate(() => document.querySelector('.website-preview h1').textContent), 'Updated from the editor');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goto({url: base + '/websites/editor/basic', timeout: 60000});
    await wait(() => page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).some(b => b.textContent.includes(name)), title));
    await page.evaluate(name => Array.from(document.querySelectorAll('.website-project-list button')).find(b => b.textContent.includes(name)).click(), title);
    await wait(() => page.evaluate(() => document.querySelector('.website-preview h1').textContent === 'Updated from the editor'));
    await page.evaluate(() => document.querySelector('.website-preview-panel button:last-child').click());
    assert.ok(await page.evaluate(() => document.querySelector('.website-preview-frame').getBoundingClientRect().width <= 390));
    // Exercise new-project creation through the actual form as well.
    await page.evaluate(() => document.querySelector('.website-project-list .section-head button').click());
    await page.evaluate(name => {
      const fields = ['title','brand','headline'].map(name=>document.querySelector('.website-brief input[name='+name+']'));
      const set = (element, value, prototype) => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event('input', {bubbles: true}));
      };
      set(fields[0], name + ' UI', HTMLInputElement.prototype);
      set(fields[1], 'UI BRAND', HTMLInputElement.prototype);
      set(fields[2], 'Created in the form', HTMLInputElement.prototype);
      set(document.querySelector('.website-brief textarea'), '폼에서 생성한 소개입니다.', HTMLTextAreaElement.prototype);
    }, title);
    await wait(() => page.evaluate(() => document.querySelector('.website-preview h1').textContent === 'Created in the form'));
    await page.evaluate(() => document.querySelector('.website-brief button[type=submit]').click());
    await wait(async () => {
      const project = (await json('/api/websites')).body.find(p => p.title === title + ' UI');
      if (project && !created.includes(project.id)) created.push(project.id);
      return Boolean(project);
    });
    await wait(() => page.evaluate(() => document.querySelector('.save-state').textContent === '저장됨'));
    await page.goto({url: base + '/architecture', timeout: 60000});
    assert.match(await page.evaluate(() => document.querySelector('h1').textContent), /가져온 파일/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await wait(() => page.evaluate(() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)));
    await page.setViewport({width: 1440, height: 1100, deviceScaleFactor: 1, isMobile: false, hasTouch: false});
    shot = await page._client().send('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile('out/qa/import-workflow-page.png', Buffer.from(shot.value.data, 'base64'));
    await fs.writeFile('out/qa/website-result.json', JSON.stringify({api: 'passed', editorSave: true, reopen: true, uiCreate: true, mediaProtection: true, mobileOverflow: false, logs}, null, 2));
    console.log('PASS: website create/update/reopen, validation, media protection, origin guard, desktop/mobile UI and saved preview');
  } finally {
    if (browser) await browser.close({silent: true});
    for (const id of created) {
      assert.match(id, /^[a-zA-Z0-9-]{1,80}$/);
      await fs.unlink(path.join('.local-data', 'websites', `${id}.json`)).catch(e=>{if(e.code!=='ENOENT')throw e;});
    }
    if (assetId) assert.equal((await json(`/api/media/${assetId}`, {method: 'DELETE'})).status, 200);
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
