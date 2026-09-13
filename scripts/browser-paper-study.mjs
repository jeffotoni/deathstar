import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

// Expose the instance in this isolated test page only. Production gets no
// globals, debug menus, camera changes or extra application code.
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('**/src/main.ts*', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('new Game(engine, canvas, backend)', '(window.__paperTest = new Game(engine, canvas, backend))');
  await route.fulfill({ response, body });
});
try {
  await page.goto('http://127.0.0.1:5173/?renderer=webgl', { waitUntil: 'networkidle' });
  await page.locator('#start').waitFor();
  await page.waitForFunction(() => Boolean(window.__paperTest));
  const original = await page.evaluate(() => {
    const g = window.__paperTest;
    g.engine.stopRenderLoop();
    return { meshes: g.scene.meshes.length, materials: g.scene.materials.length,
      light: g.scene.lights.map(l => l.intensity), clear: g.scene.clearColor.asArray() };
  });
  await page.locator('[data-visual-style="draft"]').click();
  await page.evaluate(async () => {
    const g = window.__paperTest;
    g.visualStyles.update();
    await g.scene.whenReadyAsync();
    g.scene.render();
  });
  const saturnMaterial = await page.evaluate(() => {
    const scene = window.__paperTest.scene;
    const body = scene.meshes.find(m => m.parent?.name === 'draft outline · illustration · náris' && m.name.endsWith('pencil wash'));
    return { color: body.material.emissiveColor.toHexString(), alpha: body.material.alpha,
      unlit: body.material.disableLighting };
  });
  assert.deepEqual(saturnMaterial, { color: '#FAFAFA', alpha: 0.1, unlit: true });
  // Five round trips catch disposal of shared materials and leftover proxies.
  for (let i = 0; i < 5; i++) {
    await page.locator('[data-visual-style="original"]').click();
    const restored = await page.evaluate(() => {
      const g = window.__paperTest;
      return { meshes: g.scene.meshes.length, materials: g.scene.materials.length,
        light: g.scene.lights.map(l => l.intensity), clear: g.scene.clearColor.asArray() };
    });
    assert.deepEqual(restored, original, 'original resources and lighting restore after each switch');
    await page.locator('[data-visual-style="draft"]').click();
  }
  const counts = await page.evaluate(() => {
    const g = window.__paperTest;
    const before = [g.scene.meshes.length, g.scene.materials.length];
    for (let i = 0; i < 120; i++) g.visualStyles.update();
    return { before, after: [g.scene.meshes.length, g.scene.materials.length] };
  });
  assert.deepEqual(counts.after, counts.before, 'steady frames do not create more resources');

  // Same world-space body, same camera, both UI states. This comparison must
  // actually contain Saturn rather than relying on a random combat screenshot.
  for (const state of ['menu', 'playing']) {
    await page.evaluate(async state => {
      const g = window.__paperTest;
      g.hud.show(state);
      g.camera.position.set(0, 650, 0);
      g.camera.setTarget(g.scene.getMeshByName('Náris').position);
      g.visualStyles.update();
      await g.scene.whenReadyAsync();
      g.scene.render();
    }, state);
    await page.screenshot({ path: `/private/tmp/paper-saturn-${state}.png` });
  }
  await page.evaluate(async () => {
    const g = window.__paperTest;
    g.camera.position.set(0, 7, -25);
    g.camera.setTarget(g.player.position.add(g.player.forward.scale(140)));
    g.player.toggleShield();
    g.visualStyles.update(); await g.scene.whenReadyAsync(); g.scene.render();
  });
  await page.screenshot({ path: '/private/tmp/paper-lines-study.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: paper resources, original restoration, repeated toggles, controlled Saturn captures');
} finally { await browser.close(); }
