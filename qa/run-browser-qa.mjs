import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const project = path.resolve(import.meta.dirname, '..');
const screenshotDir = path.join(project, 'qa', 'screenshots');
const browser = process.env.PVM_BROWSER_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const appBaseUrl = process.env.PVM_APP_URL || pathToFileURL(path.join(project, 'index.html')).href;
const appOrigin = new URL(appBaseUrl).origin;
const debugPort = Number(process.env.PVM_DEBUG_PORT || 9223);
const browserProfile = path.join(project, 'qa', '.edge-profile');
await mkdir(screenshotDir, { recursive: true });

const child = spawn(browser, [
  '--headless=new', '--no-sandbox', '--password-store=basic', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--hide-scrollbars',
  `--remote-debugging-port=${debugPort}`, '--remote-allow-origins=*',
  `--user-data-dir=${browserProfile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });

class CDP {
  nextId = 0;
  pending = new Map();
  errors = [];
  externalRequests = [];
  documentResponses = [];
  httpErrors = [];
  socket;

  async connect(url) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener('error', event => this.errors.push(`WebSocket error: ${JSON.stringify({ message:event.message, error:String(event.error), stack:event.error?.stack })}`));
    this.socket.addEventListener('close', event => this.errors.push(`WebSocket closed: ${event.code} ${event.reason}`));
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', async event => {
      const data = event.data;
      const raw = typeof data === 'string' ? data
        : data instanceof ArrayBuffer ? Buffer.from(data).toString('utf8')
          : Buffer.isBuffer(data) ? data.toString('utf8')
            : await data.text();
      const message = JSON.parse(raw);
      if (message.id) {
        const slot = this.pending.get(message.id);
        if (slot) {
          this.pending.delete(message.id);
          message.error ? slot.reject(new Error(JSON.stringify(message.error))) : slot.resolve(message.result);
        }
      } else if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(JSON.stringify(message.params.exceptionDetails || {}));
      } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        this.errors.push(message.params.entry.text);
      } else if (message.method === 'Network.requestWillBeSent') {
        const url = message.params.request.url;
        if (!/^(file:|data:|blob:|devtools:)/i.test(url) && new URL(url).origin !== appOrigin) this.externalRequests.push(url);
      } else if (message.method === 'Network.responseReceived' && message.params.type === 'Document') {
        this.documentResponses.push({ url: message.params.response.url, status: message.params.response.status });
      }
      if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
        this.httpErrors.push({ url: message.params.response.url, status: message.params.response.status });
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for CDP ${method}; WebSocket readyState=${this.socket?.readyState}; socket events=${JSON.stringify(this.errors)}`));
      }, 5000);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result?.value;
  }

  async close() {
    try { this.socket?.close(); } catch {}
  }
}

async function waitForDebugger() {
  const endpoint = `http://127.0.0.1:${debugPort}/json/version`;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(`Browser exited early with code ${child.exitCode}`);
    try { return await (await fetch(endpoint)).json(); } catch { await delay(250); }
  }
  throw new Error('Timed out waiting for the local browser debug port.');
}

async function setViewport(cdp, width, height, mobile = false) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height
  });
}

function stageUrl(stage) {
  const url = new URL(appBaseUrl);
  url.searchParams.set('stage', String(stage));
  return url.href;
}

async function openApp(cdp, stage = 0) {
  await cdp.send('Page.navigate', { url: stageUrl(stage) });
  for (let i = 0; i < 100; i++) {
    try {
      if (await cdp.evaluate("document.readyState === 'complete' && !!window.PVM_LAB_UI")) return;
    } catch {}
    await delay(100);
  }
  throw new Error('The local application did not finish loading.');
}

async function screenshot(cdp, name, width, height) {
  const size = await cdp.evaluate('({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})');
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.min(width, size.width), height: Math.max(height, size.height), scale: 1 }
  });
  await writeFile(path.join(screenshotDir, name), Buffer.from(result.data, 'base64'));
  return { name, viewport: `${width}x${height}`, document: `${size.width}x${size.height}` };
}

const cdp = new CDP();
const screenshots = [];
const results = [];
try {
  const browserInfo = await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  await cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Log.enable');
  await setViewport(cdp, 1440, 1100);
  await openApp(cdp, 0);

  const navResults = await cdp.evaluate(`(() => {
    const results=[];
    for(let id=0;id<=7;id++){
      const button=document.querySelector('[data-stage="'+id+'"]');
      if(!button)return {ok:false,results,missing:id};
      button.click();
      results.push({stage:id,active:window.PVM_LAB_UI.getStage(),heading:document.querySelector('#stageContent h1')?.textContent?.trim()||document.querySelector('#stageContent h2')?.textContent?.trim()||''});
    }
    return {ok:results.every(x=>x.active===x.stage),results};
  })()`);
  assert.equal(navResults.ok, true, `Navigation did not reach all eight stages: ${JSON.stringify(navResults)}`);
  results.push(`Stage navigation: all 8 stages opened by clicking the in-page navigation.`);

  await cdp.evaluate(`document.querySelector('[data-stage="1"]').click()`);
  const presetResults = await cdp.evaluate(`(() => {
    const names=['No Change','Price Only','Pure Quantity Growth','Product Mix Shift','Channel Mix Shift','Cost Shock','Mixed Reality','Legacy SKU Removed'];
    return names.map(name=>{const b=[...document.querySelectorAll('[data-preset]')].find(x=>x.textContent.trim()===name);if(!b)return {name,missing:true};b.click();const active=[...document.querySelectorAll('[data-preset]')].find(x=>x.textContent.trim()===name);return {name,pressed:active?.getAttribute('aria-pressed'),scenario:document.querySelector('#scenarioName')?.textContent.trim(),finite:!/(NaN|Infinity)/.test(document.querySelector('#stageContent').innerText)};});
  })()`);
  const presetState = await cdp.evaluate(`({stage:window.PVM_LAB_UI.getStage(),count:document.querySelectorAll('[data-preset]').length,html:document.querySelector('#stageContent')?.innerHTML.slice(0,500)})`);
  assert.ok(presetResults.every(x => !x.missing && x.pressed === 'true' && x.finite), `Preset interaction failed: ${JSON.stringify({presetResults,presetState,navResults,errors:cdp.errors})}`);
  results.push(`Preset buttons: all 8 scenarios applied and remained finite.`);

  await cdp.evaluate(`document.querySelector('[data-stage="6"]').click();document.querySelector('[data-preset="Cost Shock"]').click()`);
  const gpCheck = await cdp.evaluate(`({stage:window.PVM_LAB_UI.getStage(),scenario:document.querySelector('#scenarioName')?.textContent.trim(),text:document.querySelector('#stageContent').innerText,chart:!!document.querySelector('#chartWrap svg')})`);
  assert.equal(gpCheck.stage, 6);
  assert.equal(gpCheck.scenario, 'Cost Shock');
  assert.equal(gpCheck.chart, true);
  assert.ok(!/(NaN|Infinity)/.test(gpCheck.text));
  results.push(`Gross Profit simulation: Cost Shock updated stage 6, waterfall, and values.`);

  await cdp.evaluate(`document.querySelector('[data-stage="1"]').click();document.querySelector('#editButton').click()`);
  const editBefore = await cdp.evaluate(`(() => {const i=document.querySelector('#editorTable input[data-period="2"][data-field="q"]');return {id:i?.dataset.key,value:Number(i?.value),open:document.querySelector('#datasetDetails')?.open};})()`);
  assert.ok(editBefore.id && editBefore.open, `Dataset editor did not open: ${JSON.stringify(editBefore)}`);
  const editAfter = await cdp.evaluate(`(() => {const i=document.querySelector('#editorTable input[data-key="${editBefore.id}"][data-period="2"][data-field="q"]');i.value=String(Number(i.value)+7);i.dispatchEvent(new Event('input',{bubbles:true}));return {scenario:document.querySelector('#scenarioName')?.textContent.trim(),value:Number(i.value),text:document.querySelector('#stageContent').innerText};})()`);
  assert.equal(editAfter.scenario, 'Custom');
  assert.ok(!/(NaN|Infinity)/.test(editAfter.text));
  await cdp.evaluate(`document.querySelector('#resetButton').click()`);
  const resetCheck = await cdp.evaluate(`({scenario:document.querySelector('#scenarioName')?.textContent.trim(),value:Number(document.querySelector('#editorTable input[data-key="${editBefore.id}"][data-period="2"][data-field="q"]').value)})`);
  assert.equal(resetCheck.scenario, 'Mixed Reality');
  assert.equal(resetCheck.value, editBefore.value);
  results.push(`Editable dataset: input updated the analysis; Reset restored the original value.`);

  await cdp.evaluate(`document.querySelector('[data-stage="2"]').click();const d=document.querySelector('.math-details');d.querySelector('summary').click();`);
  const analystMode = await cdp.evaluate(`({open:document.querySelector('.math-details')?.open,copy:document.querySelector('.math-details')?.innerText||''})`);
  assert.equal(analystMode.open, true);
  assert.ok(analystMode.copy.length > 20);
  results.push(`Analyst Mode: disclosure opened and exposed its formula notes.`);

  const keyboardStart = await cdp.evaluate(`(() => {document.querySelector('[data-stage="3"]').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',ctrlKey:true,bubbles:true,cancelable:true}));return window.PVM_LAB_UI.getStage();})()`);
  assert.equal(keyboardStart, 4);
  results.push(`Keyboard navigation: Ctrl+Right advanced one stage.`);

  await cdp.evaluate(`document.querySelector('[data-stage="7"]').click();document.querySelector('[data-answer="A"][data-choice="0"]').click();`);
  const interpretation = await cdp.evaluate(`({stage:window.PVM_LAB_UI.getStage(),revealed:document.querySelector('.scenario-card [data-visible="true"]')!==null,copy:document.querySelector('.scenario-card [data-visible="true"]')?.innerText||''})`);
  assert.equal(interpretation.stage, 7);
  assert.equal(interpretation.revealed, true);
  assert.ok(!/(NaN|Infinity)/.test(interpretation.copy));
  const moreInterpretations = await cdp.evaluate(`(() => {const out=[];for(const key of ['B','D']){const b=document.querySelector('[data-answer="'+key+'"][data-choice="0"]');b.click();out.push({key,revealed:document.querySelector('[data-visible="true"]')!==null,copy:document.querySelector('[data-visible="true"]')?.innerText||''});}const s=document.querySelector('#stakeSelect');s.value='effort';s.dispatchEvent(new Event('change',{bubbles:true}));return {out,stake:document.querySelector('#stakeAnswer')?.innerText||''};})()`);
  assert.ok(moreInterpretations.out.every(x=>x.revealed && x.copy.length>20));
  assert.match(moreInterpretations.stake,/overstates the evidence/i);
  results.push(`Interpretation Lab: Scenarios A, B, and D revealed; stakeholder wording feedback appeared.`);

  await setViewport(cdp, 1440, 1100);
  for (const [stage, name] of [[0,'desktop-stage-0.png'],[2,'desktop-stage-2.png'],[6,'desktop-stage-6.png'],[7,'desktop-stage-7.png']]) {
    await openApp(cdp, stage);
    const check = await cdp.evaluate(`({stage:window.PVM_LAB_UI.getStage(),width:document.documentElement.scrollWidth,viewport:window.innerWidth,hasChart:${stage===0||stage===7?'false':'!!document.querySelector("#chartWrap svg")'},text:document.body.innerText})`);
    assert.equal(check.stage, stage);
    assert.ok(check.width <= check.viewport, `Desktop horizontal overflow at stage ${stage}: ${check.width}/${check.viewport}`);
    assert.ok(!/(NaN|Infinity)/.test(check.text));
    screenshots.push(await screenshot(cdp, name, 1440, 1100));
  }

  for (const [width,height,stage,name,mobile] of [
    [1024,900,2,'tablet-stage-2.png',false],
    [390,844,0,'mobile-stage-0.png',true],
    [390,844,2,'mobile-stage-2.png',true],
    [390,844,6,'mobile-stage-6.png',true],
    [390,844,7,'mobile-stage-7.png',true]
  ]) {
    await setViewport(cdp, width, height, mobile);
    await openApp(cdp, stage);
    const check = await cdp.evaluate(`({stage:window.PVM_LAB_UI.getStage(),width:document.documentElement.scrollWidth,viewport:window.innerWidth,text:document.body.innerText,chart:!!document.querySelector('#chartWrap svg')})`);
    assert.equal(check.stage, stage);
    assert.ok(check.width <= check.viewport, `Horizontal overflow at ${width}px, stage ${stage}: ${check.width}/${check.viewport}`);
    assert.ok(!/(NaN|Infinity)/.test(check.text));
    if (stage > 0 && stage < 7) assert.equal(check.chart, true, `Missing waterfall at ${width}px, stage ${stage}`);
    screenshots.push(await screenshot(cdp, name, width, height));
  }

  await delay(250);
  assert.deepEqual(cdp.httpErrors, [], `HTTP resource errors: ${JSON.stringify(cdp.httpErrors)}`);
  assert.deepEqual(cdp.errors, [], `Browser console/runtime errors: ${JSON.stringify(cdp.errors)}; HTTP errors=${JSON.stringify(cdp.httpErrors)}`);
  assert.deepEqual(cdp.externalRequests, [], `Unexpected runtime requests: ${JSON.stringify(cdp.externalRequests)}`);
  if (appOrigin !== 'null') {
    const pageResponse = cdp.documentResponses.find(response => new URL(response.url).origin === appOrigin);
    assert.equal(pageResponse?.status, 200, `Public app did not return HTTP 200: ${JSON.stringify(pageResponse)}`);
    results.push(`Live URL: ${pageResponse.status} ${pageResponse.url}`);
  }
  results.push(`Responsive layouts: 1440px desktop, 1024px tablet, 390px mobile; no horizontal overflow on sampled stages.`);
  results.push(`Runtime dependencies: no external requests, console errors, or uncaught exceptions.`);
  const appLocation = appOrigin === 'null' ? 'the local HTML file directly' : 'the public GitHub Pages URL';
  const browserSection = `## Browser interaction and visual QA\n\n`+
    `- **Status:** PASS in Microsoft Edge 153.0.4234.48, opening ${appLocation}.\n`+
    (appOrigin === 'null' ? '' : `- **Public smoke test:** HTTP 200 from ${appBaseUrl}.\n`) +
    `- **Interactions:** all eight navigation buttons; all eight presets; Gross Profit Cost Shock; editable quantity; Reset; Analyst Mode; Ctrl+Right; Interpretation scenarios A, B, and D; stakeholder wording response.\n`+
    `- **Responsive:** sampled at 1440px desktop, 1024px tablet, and 390px mobile. No horizontal overflow on checked stages.\n`+
    `- **Runtime:** zero external requests, console errors, or uncaught exceptions. No missing runtime assets.\n`+
    `- **Screenshots:** [Orientation](qa/screenshots/desktop-stage-0.png), [Revenue: 3 factors](qa/screenshots/desktop-stage-2.png), [Gross Profit: full bridge](qa/screenshots/desktop-stage-6.png), [Interpretation Lab](qa/screenshots/desktop-stage-7.png), [mobile Revenue](qa/screenshots/mobile-stage-2.png).\n`;
  const reportPath = path.join(project, 'QA_REPORT.md');
  let report = await readFile(reportPath, 'utf8');
  report = report.replace(/\nThis report covers[^\n]*\n?$/, '').replace(/\n## Browser interaction and visual QA[\s\S]*$/, '');
  await writeFile(reportPath, `${report.trimEnd()}\n\n${browserSection}`, 'utf8');
  console.log(JSON.stringify({ status: 'PASS', browser: browserInfo.Browser, results, screenshots }, null, 2));
} finally {
  await cdp.close();
  child.kill();
}
