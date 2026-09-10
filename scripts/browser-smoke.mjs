import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
let initialAudioStorage;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:5173/?renderer=webgl&debug', { waitUntil: 'networkidle' });
  initialAudioStorage = await page.evaluate(() => localStorage.getItem('veu-audio-settings'));
  await page.getByRole('button', { name: 'START MISSION' }).waitFor({ timeout: 60000 });
  await page.locator('.topbar .locale-toggle').getByRole('button', { name: 'PT-BR' }).click();
  assert.match(await page.locator('#start').textContent(), /INICIAR MISSÃO/, 'Portuguese locale switches in the menu');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'INICIAR MISSÃO' }).waitFor({ timeout: 60000 });
  assert.match(await page.locator('#start').textContent(), /INICIAR MISSÃO/, 'locale persists after reload');
  await page.locator('.topbar .locale-toggle').getByRole('button', { name: 'EN' }).click();
  await page.getByRole('button', { name: 'START MISSION' }).waitFor({ timeout: 60000 });
  await page.locator('[data-ship="classic"]').click();
  assert.ok(await page.locator('[data-ship="classic"]').evaluate(button => button.classList.contains('active')), 'classic ship can be selected');
  assert.match(await page.locator('#selected-ship-name').textContent(), /GAEL RAY/, 'classic ship details update');
  await page.locator('[data-ship="lego"]').click();
  assert.ok(await page.locator('[data-ship="lego"]').evaluate(button => button.classList.contains('active')), 'LEGO ship can be selected');
  const pickerBox = await page.locator('.ship-picker').boundingBox();
  const startBox = await page.locator('#start').boundingBox();
  assert.ok(pickerBox && startBox && pickerBox.y < startBox.y, 'ship selection appears before launch button');
  await page.screenshot({ path: '/private/tmp/veu-menu.png' });
  console.log('MENU', await page.locator('#backend').textContent());
  await page.locator('#fast').check();
  await page.getByRole('button', { name: 'START MISSION' }).click();
  await page.locator('#hud').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#shield-visibility')?.textContent === 'SHIELD HIDDEN');
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => document.querySelector('#shield-visibility')?.textContent === 'SHIELD VISIBLE');
  await page.waitForTimeout(750); // Allow first-use shield shaders to finish before visual capture.
  await page.screenshot({ path: '/private/tmp/veu-shield.png' });
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => document.querySelector('#shield-visibility')?.textContent === 'SHIELD HIDDEN');
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.waitForTimeout(400);
  assert.ok(Number((await page.locator('#debug').textContent()).match(/SHOTS (\d+)/)?.[1]) > 0, 'holding primary fire produces projectiles before enemy spawn');
  await page.mouse.move(950, 380);
  await page.waitForTimeout(400);
  assert.ok(Number.parseFloat(await page.locator('#aim-cursor').evaluate(el => el.style.left)) > 60, 'mouse steers while firing');
  await page.mouse.up();
  await page.mouse.move(720, 450);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyW');
  assert.ok(Number(await page.locator('#speed').textContent()) > 75, 'accelerates');
  await page.keyboard.down('Shift');
  await page.waitForTimeout(1200);
  await page.keyboard.up('Shift');
  assert.ok(Number(await page.locator('#speed').textContent()) > 140, 'boost increases speed');
  await page.keyboard.down('KeyS'); await page.waitForTimeout(2000); await page.keyboard.up('KeyS');
  await page.keyboard.press('Space');
  assert.match(await page.locator('#dodge-status').textContent(), /DODGE/);
  await page.waitForTimeout(2500);
  await page.keyboard.press('KeyF');
  await page.mouse.down();
  await page.waitForTimeout(400);
  assert.ok(Number((await page.locator('#debug').textContent()).match(/SHOTS (\d+)/)?.[1]) > 0, 'holding primary fire produces projectiles');
  // Steer using the same visible target marker presented to a player.
  for (let i = 0; i < 100; i++) {
    if (await page.locator('#result').isVisible()) break;
    const marker = page.locator('.target-marker.selected');
    if (await marker.count()) {
      const box = await marker.boundingBox();
      if (box) await page.mouse.move(Math.max(40, Math.min(1400, 720 + (box.x + box.width / 2 - 720) * 2)), Math.max(90, Math.min(800, 450 + (box.y + box.height / 2 - 450) * 2)));
    } else {
      await page.keyboard.press('KeyF');
      const arrow = page.locator('#target-arrow');
      if (await arrow.isVisible()) { const box = await arrow.boundingBox(); if (box) await page.mouse.move(box.x, box.y); }
    }
    await page.waitForTimeout(160);
  }
  await page.mouse.up(); await page.mouse.move(720, 450);
  await page.screenshot({ path: '/private/tmp/veu-flight.png' });
  console.log('FLIGHT', await page.locator('#debug').textContent());
  console.log('KILLS', await page.locator('#kills').textContent());
  assert.ok(Number(await page.locator('#kills').textContent()) > 0, 'combat destroys an enemy and updates score');
  await page.keyboard.press('Escape');
  await page.locator('#pause').waitFor({ state: 'visible' });
  const clock = await page.locator('#mission-time').textContent();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#mission-time').textContent(), clock, 'pause freezes mission');
  await page.getByRole('button', { name: 'CONTINUE FLIGHT' }).click();
  await page.locator('#hud').waitFor({ state: 'visible' });
  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => { const raw = localStorage.getItem('veu-audio-settings'); return raw !== null && JSON.parse(raw).muted === true; });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('veu-audio-settings')).muted), true, 'mute preference persists');
  await page.keyboard.press('Escape');
  const sfxSlider = page.locator('#pause input[data-audio="sfx"]');
  await sfxSlider.fill('0.42');
  await page.waitForFunction(() => { const raw = localStorage.getItem('veu-audio-settings'); return raw !== null && JSON.parse(raw).sfx === 0.42; });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('veu-audio-settings')).sfx), 0.42, 'audio volume preference persists');
  await page.getByRole('button', { name: 'RESTART MISSION' }).click();
  await page.locator('#intro').waitFor({ state: 'visible' });
  await page.locator('#hud').waitFor({ state: 'visible', timeout: 20000 });
  assert.equal(await page.locator('#kills').textContent(), '00');
  assert.equal(await page.locator('#hull-value').textContent(), '100');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('PASS: renderer, launch, acceleration, boost, combat, pause, resume, restart');
} catch (error) {
  await page.screenshot({ path: '/private/tmp/veu-failure.png' });
  console.log('BROWSER ERRORS', errors);
  throw error;
} finally {
  if (initialAudioStorage !== undefined) {
    await page.evaluate(value => {
      if (value === null) localStorage.removeItem('veu-audio-settings');
      else localStorage.setItem('veu-audio-settings', value);
    }, initialAudioStorage);
  }
  await browser.close();
}
