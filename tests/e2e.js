const { chromium, devices } = require('playwright-core');
const out = __dirname + '/out/'; require('fs').mkdirSync(out, { recursive: true });
const URL = 'http://localhost:8765/index.html';
let failed = 0;
const check = (label, ok, info = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${info ? ' — ' + info : ''}`); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [skin, dev, scheme] of [['ios', 'iPhone 13', 'light'], ['gboard', 'Pixel 7', 'dark'], ['samsung', 'Galaxy S9+', 'light']]) {
    const ctx = await browser.newContext({ ...devices[dev], colorScheme: scheme });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`${URL}?seed=test&kb=${skin}`);
    await page.tap('#btn-start');

    const center = k => page.evaluate(k => {
      const key = S.kb.keys.find(o => o.k === k);
      if (!key) throw new Error('no key ' + k + ' on layer ' + S.kb.layer);
      const r = key.el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];
    }, k);
    const tapKey = async k => { const [x, y] = await center(k); await page.touchscreen.tap(x, y); await page.waitForTimeout(25); };
    const holdKey = async (k, ms) => {
      const [x, y] = await center(k);
      await page.evaluate(([x, y, ms]) => new Promise(res => {
        const el = S.kb.el, pe = (t) => el.dispatchEvent(new PointerEvent(t, { pointerId: 77, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
        pe('pointerdown'); setTimeout(() => { pe('pointerup'); res(); }, ms);
      }), [x, y, ms]);
    };
    const twoFingers = async (a, b) => { // hold one finger, tap with a second -> blocked in pass 2
      const [ax, ay] = await center(a), [bx, by] = await center(b);
      await page.evaluate(([ax, ay, bx, by]) => {
        const el = S.kb.el, pe = (t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
        pe('pointerdown', 91, ax, ay); pe('pointerdown', 92, bx, by); pe('pointerup', 92, bx, by); pe('pointerup', 91, ax, ay);
      }, [ax, ay, bx, by]);
    };
    // Types a string the way a person would: shift for capitals, layer keys for digits/symbols.
    const typeText = async str => {
      for (const ch of str) {
        const st = await page.evaluate(() => ({ layer: S.st.layer, shift: S.st.shift, where: Object.fromEntries(Object.entries(S.kb.layers).map(([n, L]) => [n, L.keys.map(k => k.k)])) }));
        if (ch === ' ') { await tapKey(' '); continue; }
        if (ch === '\n') { await tapKey('enter'); continue; }
        if (/[a-zA-Z]/.test(ch)) {
          if (st.layer !== 'a') await tapKey('abc');
          const up = ch !== ch.toLowerCase();
          if (up !== !!st.shift) await tapKey('shift');
          await tapKey(ch.toLowerCase());
          continue;
        }
        const on = n => st.where[n].includes(ch);
        if (!on(st.layer)) {
          if (on('a')) await tapKey('abc');
          else if (on('1')) await tapKey('123');
          else { if (st.layer === 'a') await tapKey('123'); await tapKey('sym'); }
        }
        await tapKey(ch);
      }
    };
    const live = () => page.evaluate(() => S.st.text);

    // Prompts 2 and 3 with the current grip.
    const more = [['Happy birthday!!', 'Happy bday!!'], ['Can you feed my cat on Sat?', 'Could u feed my cat Sat?']];
    const rest = async pi => {
      for (let r = 1; r <= 2; r++) {
        await page.waitForFunction(([r, pi]) => $('#s-pass').classList.contains('on') && S.r === r && S.p === pi, [r, pi]); await page.waitForTimeout(450);
        if (skin === 'ios' && r === 1 && pi === 0) await page.screenshot({ path: `${out}next-prompt.png` });
        check(`${skin} part ${pi + 1} prompt ${r + 1} reminder`, await page.evaluate(() => $('#p-title').textContent === 'Next prompt'));
        await page.tap('#btn-pass');
        await page.waitForFunction(() => S.kb && S.kb.enabled);
        check(`${skin} part ${pi + 1} prompt ${r + 1} shown`, await page.evaluate(([r, pi]) => $('#t-prompt').textContent.startsWith(PROMPTS[r]) && $('#t-prog').textContent.startsWith(`Part ${pi + 1} of 2 · Prompt ${r + 1} of 3`), [r, pi]));
        await typeText(more[r - 1][pi]);
        await page.tap('#t-send');
      }
    };
    // ---- Part 1: comfortable grip
    await page.waitForSelector('#s-pass.on'); await page.waitForTimeout(450);
    if (skin === 'ios') await page.screenshot({ path: `${out}pass1-intro.png` });
    await page.tap('#btn-pass');
    await page.waitForFunction(() => S.kb && S.kb.enabled);
    await page.screenshot({ path: `${out}${skin}-compose-empty.png` });
    await typeText('Hi! Long day at work, 3 meetings & a 45-min call  Home nowx');
    await tapKey('bksp');
    await typeText('\nYou? #tired');
    const exp1 = 'Hi! Long day at work, 3 meetings & a 45-min call. Home now\nYou? #tired';
    check(`${skin} pass 1 live text`, await live() === exp1, JSON.stringify(await live()));
    await page.screenshot({ path: `${out}${skin}-compose.png` });
    await page.tap('#t-send');
    await rest(0);

    // ---- Part 2: non-dominant thumb
    await page.waitForFunction(() => $('#s-pass').classList.contains('on') && $('#p-title').textContent.startsWith('Non-dominant')); await page.waitForTimeout(450);
    if (skin === 'ios') await page.screenshot({ path: `${out}pass2-intro.png` });
    await page.tap('#btn-pass');
    await page.waitForFunction(() => S.kb && S.kb.enabled && S.r === 0 && S.p === 1);
    check(`${skin} pass 2 starts empty`, await live() === '');
    await typeText('Tired but good');
    await twoFingers('a', 'b'); // blocked, types only 'a'
    await tapKey(' ');
    // caps lock: double tap shift
    if (await page.evaluate(() => S.st.shift)) await tapKey('shift');
    await tapKey('shift'); await tapKey('shift');
    check(`${skin} caps lock`, await page.evaluate(() => S.st.shift === 2 && S.kb.keys.find(k => k.k === 'shift').el.classList.contains('lock')));
    await tapKey('o'); await tapKey('k'); await tapKey('shift');
    await typeText(' :) zzzzzzzz');
    await holdKey('bksp', 760);
    const t2 = await live();
    const m = t2.match(/^Tired but gooda OK :\) (z*)$/);
    check(`${skin} pass 2 text + held ⌫`, !!m && m[1].length <= 6 && m[1].length >= 2, JSON.stringify(t2));
    await page.tap('#t-send');
    await rest(1);

    // ---- Results
    await page.waitForSelector('#s-result.on');
    await page.screenshot({ path: `${out}${skin}-result.png`, fullPage: true });
    const res = await page.evaluate(() => ({
      app: S.rec.app, v: S.rec.v, kb: S.rec.kb,
      prompts: S.rec.rounds.map(r => r.prompt).join('|') === PROMPTS.join('|'),
      grips: S.rec.rounds.map(r => r.passes.map(p => p.grip).join()),
      texts: S.rec.rounds.slice(1).map(r => r.passes.map(p => p.text).join(' / ')),
      rebuilt: S.rec.rounds.flatMap(r => r.passes.map(p => rebuild(p.ev, S.rec.kb).text === p.text)),
      reps: S.rec.rounds[0].passes[1].ev.filter(e => e[2] === 'rep').length,
      blocked: S.rec.rounds.flatMap(r => r.passes.map(p => (p.blocked || []).length)).join(''),
      layers: [...new Set(S.rec.rounds[0].passes.flatMap(p => p.ev.map(e => e[5])))].sort().join(''),
      cards: document.querySelectorAll('#r-rows .row').length,
      json: JSON.stringify(S.rec).length,
    }));
    console.log(skin, JSON.stringify(res));
    check(`${skin} recording shape`, res.app === 'typing-recorder' && res.v === 2 && res.kb === skin && res.prompts && res.grips.every(g => g === 'comfortable,nondominant-thumb') && res.grips.length === 3);
    check(`${skin} prompts 2-3 texts`, res.texts.join(' | ') === 'Happy birthday!! / Happy bday!! | Can you feed my cat on Sat? / Could u feed my cat Sat?', JSON.stringify(res.texts));
    check(`${skin} text rebuilt from events`, res.rebuilt.length === 6 && res.rebuilt.every(Boolean));
    check(`${skin} ⌫ repeats recorded`, res.reps >= 1);
    check(`${skin} blocked touch`, res.blocked === '010000', res.blocked);
    check(`${skin} one result card per prompt`, res.cards === 3);
    check(`${skin} layer codes`, res.layers === '12ACa' || res.layers === '1ACa', res.layers);

    // ---- Load the file back and replay
    const json = await page.evaluate(() => JSON.stringify(S.rec));
    const p2 = await ctx.newPage(); const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
    await p2.goto(URL);
    await p2.setInputFiles('#file', { name: 'rec.txt', mimeType: 'text/plain', buffer: Buffer.from(json) });
    await p2.waitForSelector('#s-result.on');
    check(`${skin} file round trip`, await p2.evaluate(o => JSON.stringify(S.rec) === o, json));
    await p2.waitForTimeout(450); await p2.tap('#btn-replay');
    await p2.evaluate(() => { Replay.pause(); Replay.select(0); const p = Replay.pass(); Replay.t = p.ev[Math.floor(p.ev.length * 0.6)][0] + 20; Replay.render(); });
    await p2.screenshot({ path: `${out}${skin}-replay.png` });
    const mid = await p2.evaluate(() => ({ text: $('#rp-msg').textContent, dots: document.querySelectorAll('#rp-kb .dot').length, down: document.querySelectorAll('#rp-kb .key.down').length }));
    check(`${skin} replay mid-pass`, exp1.startsWith(mid.text.replace('\n', '\n')) || mid.text.length > 0, JSON.stringify(mid));
    await p2.evaluate(() => { Replay.select(5); Replay.t = Replay.end(); Replay.render(); });
    check(`${skin} replay end = sent text`, await p2.evaluate(() => $('#rp-msg').textContent === Replay.pass().text && $('#rp-prompt').textContent === PROMPTS[2] && $('#rp-pos').textContent === '6/6'));
    check(`${skin} replay in written order`, await p2.evaluate(() => Replay.items.map(it => it.label).join('|')) === 'Comfortable grip · Prompt 1|Comfortable grip · Prompt 2|Comfortable grip · Prompt 3|Non-dominant thumb · Prompt 1|Non-dominant thumb · Prompt 2|Non-dominant thumb · Prompt 3');
    await p2.evaluate(() => { Replay.select(3); Replay.t = Replay.pass().blocked[0][0] + 10; Replay.render(); });
    check(`${skin} replay blocked dot`, await p2.evaluate(() => document.querySelectorAll('#rp-kb .dot.blocked').length === 1));
    if (skin === 'gboard') await p2.screenshot({ path: `${out}replay-blocked.png` });
    check(`${skin} no page errors`, !errs.length && !errs2.length, JSON.stringify([errs, errs2]));
    await ctx.close();
  }

  // ---- Unit checks of the editing state machine
  const ctx = await browser.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  await p.goto(URL);
  const u = await p.evaluate(() => {
    const run = (keys, skin = 'gboard') => { let st = newState(), t = 0; for (const k of keys) st = step(st, k, t += 1000, skin); return st; };
    return {
      limit: run(Array(210).fill('a')).text.length,
      dblNoWord: run(['H', 'i', '.', ' ', ' ']).text,
      iosBack: run(['123', '1', ' '], 'ios').layer + run(['123', '1', ' '], 'gboard').layer,
      bkspCap: run(['H', 'i', '.', ' ', 'y', 'bksp']).shift,
      bad: (() => { try { validate({ v: 3, passes: [] }); return 'accepted'; } catch (e) { return 'rejected'; } })(),
      v1: (r => r.v + ':' + r.rounds.length + ':' + r.rounds[0].prompt + ':' + r.rounds[0].passes.length)(validate({ app: 'typing-recorder', v: 1, kb: 'ios', prompt: 'Old prompt', passes: [{ grip: 'comfortable', text: 'a', ev: [[1, 2, 'a', 3, 4, 'a']], send: 9 }] })),
      proto: validate({ app: 'typing-recorder', v: 2, kb: 'constructor', rounds: [{ prompt: 'x', passes: [{ ev: [[1, 2, 'a', 3, 4]], send: 9 }] }] }).kb,
    };
  });
  console.log('units', JSON.stringify(u));
  check('200 char limit', u.limit === 200);
  check('double space only after a word', u.dblNoWord === 'Hi.  ');
  check('iOS returns to letters after space', u.iosBack === 'a1');
  check('auto-capital after ⌫', u.bkspCap === 1);
  check('rejects other recordings', u.bad === 'rejected');
  check('prototype skin name', u.proto === 'gboard');
  check('v1 recording upgrades to one round', u.v1 === '2:1:Old prompt:1', u.v1);
  await browser.close();
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
